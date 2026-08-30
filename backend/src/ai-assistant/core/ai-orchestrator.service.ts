import { Injectable, Logger } from '@nestjs/common';
import { ChatRequestDto } from '../ai-assistant.dto';
import { AiPermissionService } from './ai-permission.service';
import { AiAuditService } from './ai-audit.service';
import { ContextBuilderService } from './context-builder.service';
import { ConversationMemoryService } from './conversation-memory.service';
import { ConversationService } from './conversation.service';
import { LearningService } from './learning.service';
import { LlmMessage, LlmProviderService } from './llm-provider.service';
import { ToolRegistryService } from './tool-registry.service';
import { nowContextLine } from './baghdad-clock';
import {
  canonicalToolName,
  extractEmailAddress,
  instantChatReply,
  looksLikeImageGeneration,
  looksLikeInternalReasoning,
  looksLikeNoLiveAccess,
  narrationForTool,
  normalizeToolArgs,
  parseEntityFollowUp,
  parseEntityPick,
  parseLeakedToolCall,
  parseStatementRequest,
  resolveIntent,
  stripModelScratch,
} from './intent-router';
import {
  AiRequestContext,
  AiStreamEvent,
  AiTool,
  AiUiBlock,
} from '../types/ai-tool.types';

const MAX_TOOL_ROUNDS = 2;
const TIME_BUDGET_MS = 50_000;
/**
 * Per-tool ceiling. Tools that reach outside the database (Puppeteer PDF, Brevo,
 * web search) can stall; without this the SSE stream never emits tool_end/done
 * and the Copilot spins forever. Heavy tools get a wider budget.
 */
const TOOL_TIMEOUT_MS = Number(process.env.AI_TOOL_TIMEOUT_MS || 30_000);
const HEAVY_TOOL_TIMEOUT_MS = Number(process.env.AI_HEAVY_TOOL_TIMEOUT_MS || 75_000);
const HEAVY_TOOLS = new Set([
  'exportAccountStatementPdf',
  'emailAccountStatement',
  'generateImage',
  'searchCurrentInfo',
]);

/**
 * After a long stretch of questions the assistant ribs the user, in the same
 * Iraqi dialect the staff actually speak.
 */
const TEASES_AR = [
  'مو لحّيت هواي؟ 😄 بس كمّل، آني وياك.',
  'دفّوت حالي وياك! هاي شنو الأسئلة.',
  'تعبتني يمعود… خلي أتنفّس شوية.',
  'شوي شوي عليّ، راح يحترق الفيوز مالتي!',
  'أسئلتك ما تخلص — عاشت إيدك، كمّل.',
];

/** The first tease lands at question six, then only every fourth one. */
const TEASE_AFTER = 5;
const TEASE_EVERY = 4;

function teaseFor(userTurns: number, locale: 'ar' | 'en'): string | null {
  // A joke repeated on every single message stops being a joke by the third time.
  if (locale !== 'ar' || userTurns <= TEASE_AFTER) return null;
  const since = userTurns - (TEASE_AFTER + 1);
  if (since % TEASE_EVERY !== 0) return null;
  return TEASES_AR[Math.floor(since / TEASE_EVERY) % TEASES_AR.length];
}

/**
 * Command words that wrap a statement request, peeled off to leave the account name.
 *
 * NOT in this list, deliberately: سلف، مصاريف، صندوق، ماستر، إيرادات. Those open real
 * account names in this chart of accounts — «سلف علي السعدي» is an account, not "the
 * advance belonging to Ali" — and treating them as filler searched for the wrong
 * person and returned «علي السعدي اختبار».
 */
const STATEMENT_LEAD_IN =
  /^(?:من\s+فضلك|رجاءً|رجاء|نعم|ايه|أيه|اي|أكّد|أكد|تأكيد|confirm|ok|تمام|زين|أرسل|ارسل|ابعث|إبعث|صدّر|صدر|تصدير|جهّز|جهز|اعمل|سوّي|سوي|اطبعلي|اطبع|طبع|اعطني|عطني|كشف|الكشف|حساب|الحساب|بالإيميل|بالايميل|بالبريد|إيميل|ايميل|email|pdf|إلى|الى|عن|لدى|حق|مال|شركة|عميل|العميل|المورد|زبون)(?:\s+|$)/i;

const ANY_EMAIL_G = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

/**
 * "أرسل كشف الى سلف علي السعدي" → "سلف علي السعدي"; "أرسل الكشف بالإيميل" → "".
 *
 * Returns '' unless a command word was actually peeled off. Without that guard a
 * bare follow-up like "رصيده" would be read as an account NAME and would override
 * the entity the user picked a moment earlier.
 */
function stripStatementLeadIn(text: string): string {
  const cleaned = (text || '')
    .replace(/\n?\[\[entity:[^\]]+\]\]/g, ' ')
    .replace(ANY_EMAIL_G, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let out = cleaned;
  let prev = '';
  while (out && out !== prev) {
    prev = out;
    out = out.replace(STATEMENT_LEAD_IN, '').trim();
  }
  if (out === cleaned) return '';

  out = out.replace(/[؟?!.،,:]+$/g, '').trim();
  if (out.length < 2 || out.split(/\s+/).length > 6) return '';
  return out;
}

class ToolTimeoutError extends Error {
  constructor(toolName: string, ms: number) {
    super(
      `انتهت مهلة تنفيذ «${toolName}» بعد ${Math.round(ms / 1000)} ثانية. العملية لم تكتمل — أعد المحاولة، وإن تكرر الأمر تحقق من خدمة توليد PDF أو خدمة البريد.`,
    );
    this.name = 'ToolTimeoutError';
  }
}

function runWithTimeout<T>(work: Promise<T>, ms: number, toolName: string): Promise<T> {
  let timer: NodeJS.Timeout;
  return Promise.race([
    work,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new ToolTimeoutError(toolName, ms)), ms);
    }),
  ]).finally(() => clearTimeout(timer)) as Promise<T>;
}

const TOOL_LABELS: Record<string, string> = {
  searchEntity: 'البحث عن الكيان',
  findByReference: 'البحث بالرمز',
  describeSchema: 'خريطة البيانات',
  queryData: 'استعلام البيانات',
  recallConversations: 'استرجاع المحادثات',
  getDailyBrief: 'فحص وضع اليوم',
  listBranches: 'جلب الفروع',
  getAccountBalance: 'جلب رصيد الحساب',
  getAccountStatement: 'كشف الحساب',
  exportAccountStatementPdf: 'تصدير كشف PDF',
  emailAccountStatement: 'إرسال الكشف بالإيميل',
  analyzeAccountBalance: 'تحليل الرصيد',
  getReceivables: 'الذمم المدينة',
  getPayables: 'الذمم الدائنة',
  getTrialBalance: 'ميزان المراجعة',
  getIncomeStatement: 'قائمة الدخل',
  getBalanceSheet: 'الميزانية',
  listAccounts: 'قائمة الحسابات',
  searchTickets: 'البحث في الحجوزات',
  getTicketDetails: 'تفاصيل الحجز',
  getUnpaidTickets: 'التذاكر غير المسددة',
  getVisas: 'التأشيرات',
  getHotelBookings: 'الحجوزات الفندقية',
  searchVouchers: 'البحث في السندات',
  searchJournalEntries: 'البحث في القيود',
  explainJournalEntry: 'شرح القيد',
  findUnbalancedJournalEntries: 'مسح القيود غير المتوازنة',
  proposeJournalBalanceFix: 'اقتراح موازنة قيد',
  applyJournalBalanceFix: 'تنفيذ موازنة مسودة',
  getSalesSummary: 'ملخص المبيعات',
  getDailyProfit: 'حساب الأرباح',
  getBranchStats: 'إحصاءات الفرع',
  compareBranches: 'مقارنة الفروع',
  getCashboxBalances: 'أرصدة الصناديق',
  getCurrencyBalances: 'أرصدة العملات',
  getFinancialSummary: 'الملخص المالي',
  getExchangeRate: 'أسعار الصرف',
  searchCurrentInfo: 'البحث عن معلومات حالية',
  getSystemCapabilities: 'قدرات النظام',
  getUserContext: 'سياق المستخدم',
  rememberFact: 'حفظ معلومة',
  listLearnedFacts: 'عرض ما تم تعلّمه',
  forgetLearnedFact: 'نسيان معلومة',
  generateImage: 'تصميم صورة',
};

const DATA_QUESTION =
  /(رصيد|أرصدة|ارصدة|مبيعات|أرباح|ارباح|ذمم|تذاكر|سند|قيد|قيود|كشف|ميزان|صندوق|صناديق|بنك|بنوك|فرع|pnr|كم|شكد|علينا|غير مسدد|مدين|دائن|سلف|من\s+هو|تحقق|مصروف|غير متوازن|دولار|دينار|ايميل|إيميل|pdf)/i;

/**
 * DATA_QUESTION is deliberately loose — it catches "كم" and "من هو", which also
 * appear in ordinary questions ("كم عدد سكان العراق"). Forcing a tool call on those
 * used to dead-end the answer. This tighter pattern is what actually decides
 * "the user is asking about records in THIS system", and only it forces a tool.
 * Everything else may be answered from general knowledge or the web.
 */
const SYSTEM_SUBJECT =
  /(رصيد|أرصدة|ارصدة|ذمم|تذكرة|تذاكر|سند|سندات|قيد|قيود|كشف|ميزان|صندوق|صناديق|بنك|بنوك|فرع|فروع|pnr|مبيعات|أرباح|ارباح|مصروف|مصاريف|عميل|عملاء|زبون|مورد|موردين|فيزا|تأشيرة|تأشيرات|فندق|حجز|حجوزات|استرجاع|مسترجع|مسدد|مدين|دائن|سلف|شركة|حساب|حسابات|فاتورة|فواتير|مسافر|موظف|شكد|علينا|لنا|سعر\s*الصرف|السعر\s*المعتمد|هامش|صرف|عملة|شجرة\s*الحسابات|سنة\s*مالية|صلاحيات)/i;

@Injectable()
export class AiOrchestratorService {
  private readonly logger = new Logger(AiOrchestratorService.name);

  constructor(
    private readonly llm: LlmProviderService,
    private readonly tools: ToolRegistryService,
    private readonly permissions: AiPermissionService,
    private readonly contextBuilder: ContextBuilderService,
    private readonly conversations: ConversationService,
    private readonly memory: ConversationMemoryService,
    private readonly learning: LearningService,
    private readonly audit: AiAuditService,
  ) {}

  async *run(params: {
    dto: ChatRequestDto;
    user: any;
    branchHeader?: string;
    ipAddress?: string;
  }): AsyncGenerator<AiStreamEvent> {
    const started = Date.now();
    const lastUser = [...(params.dto.messages || [])].reverse().find((m) => m.role === 'user');
    const question = lastUser?.content || '';
    const locale = params.dto.locale === 'en' ? 'en' : 'ar';
    const instant = !lastUser?.imageBase64 ? instantChatReply(question, locale) : null;

    yield { type: 'status', message: instant ? 'جاهز' : 'أفهم سؤالك…' };

    if (instant) {
      yield { type: 'delta', text: instant };
      const conversation = await this.ensureConversation(params.dto, params.user);
      await this.persistUserTurn(conversation.id, question, undefined);
      const saved = await this.conversations.addMessage({
        conversationId: conversation.id,
        role: 'assistant',
        content: instant,
        model: 'instant',
        latencyMs: Date.now() - started,
      });
      yield {
        type: 'done',
        conversationId: conversation.id,
        messageId: saved.id,
        model: 'instant',
        toolsUsed: [],
      };
      return;
    }

    const conversation = await this.ensureConversation(params.dto, params.user);
    const [ctx] = await Promise.all([
      this.contextBuilder.build({
        user: params.user,
        branchHeader: params.branchHeader,
        page: params.dto.page || (params.dto.currentPage ? { route: params.dto.currentPage } : undefined),
        locale: params.dto.locale || 'ar',
        memory: this.memoryFromHistory(params.dto),
        ipAddress: params.ipAddress,
      }),
      this.persistUserTurn(conversation.id, question, lastUser?.imageBase64),
    ]);

    const allowedTools = this.permissions.filterTools(ctx, this.tools.getAll());
    // What this company has taught the assistant — names it was corrected on, rules
    // staff asked it to remember. It has been collecting these since day one, but
    // formatForPrompt() had no caller anywhere, so none of it ever reached the model.
    const learnedFacts = await this.learning
      .formatForPrompt(ctx.companyId, ctx.userId)
      .catch(() => '');

    // Streamed on its own, and deliberately NOT written into finalText: the joke
    // belongs in the moment, not in the saved transcript, and it must never be
    // mistaken for part of the answer.
    const recentTopics = await this.conversations
      .recentTopics(ctx.companyId, ctx.userId)
      .catch(() => '');

    const askedSoFar = await this.conversations
      .countUserMessages(conversation.id)
      .catch(() => 0);
    const tease = teaseFor(askedSoFar, locale);
    if (tease) yield { type: 'delta', text: `${tease}\n\n` };
    ctx.memory = this.memory.merge(ctx.memory, this.memoryFromHistory(params.dto));

    const collectedUi: AiUiBlock[] = [];
    const collectedSuggestions: string[] = [];
    const toolsUsed: string[] = [];
    let modelUsed = 'none';
    let finalText = '';
    let usedToolsSuccessfully = false;
    let streamedText = false;
    let forcedToolName = '';
    let lastSummary = '';

    const pick = parseEntityPick(question);
    if (pick) {
      ctx.memory = this.memory.merge(ctx.memory, [
        {
          kind: pick.kind,
          id: pick.id,
          label: pick.label || pick.id,
          extra: { accountId: pick.accountId },
        },
      ]);
      void this.learning.rememberAlias(
        ctx,
        pick.label || pick.id,
        pick.kind,
        pick.id,
        pick.accountId ? `${pick.kind}:${pick.id} account:${pick.accountId}` : `${pick.kind}:${pick.id}`,
      );
    }

    const intent = this.resolveFollowUpOrIntent(question, ctx);
    if (pick && !intent) {
      finalText = `تم اختيار «${pick.label || 'السجل'}». ما طلبك بخصوص هذا الاختيار؟`;
      yield { type: 'delta', text: finalText };
      streamedText = true;
      collectedSuggestions.push('رصيده', 'كشف PDF', 'أرسل الكشف بالإيميل', 'كشف الحساب');
    }

    if (intent) {
      const resolvedName = canonicalToolName(intent.toolName);
      if (resolvedName === 'exportAccountStatementPdf') {
        yield { type: 'status', message: 'أجهّز الكشف…' };
      } else if (resolvedName === 'emailAccountStatement') {
        yield {
          type: 'status',
          message: intent.args?.confirm ? 'أرسل الكشف…' : 'أجهّز الإرسال…',
        };
      }
      yield { type: 'tool_start', name: resolvedName, label: TOOL_LABELS[resolvedName] || resolvedName };
      const ran = await this.runNamedTool({
        toolName: intent.toolName,
        args: intent.args || {},
        allowedTools,
        ctx,
        conversationId: conversation.id,
        question,
      });
      if (ran) {
        forcedToolName = ran.resolvedName;
        toolsUsed.push(ran.resolvedName);
        if (ran.event.ok) usedToolsSuccessfully = true;
        lastSummary = ran.event.summary || lastSummary;
        yield { type: 'tool_end', name: ran.resolvedName, ok: ran.event.ok, durationMs: ran.event.durationMs };
        if (ran.event.ui?.length) {
          collectedUi.push(...ran.event.ui);
          yield { type: 'ui', blocks: ran.event.ui };
        }
        if (ran.event.ok && ran.event.suggestions?.length) collectedSuggestions.push(...ran.event.suggestions);
        // A name search that matched nothing is a wrong guess, never a final answer:
        // "من رئيس وزراء العراق" is not a customer, and "من أكثر عميل مدين" wants
        // getReceivables. searchEntity reports a miss as ok:false (note: "لا نتائج"),
        // so this MUST be handled before the generic failure text is streamed —
        // otherwise streamedText is already true and the retry can never happen.
        const entityGuessMissed =
          ran.resolvedName === 'searchEntity' && (ran.event.notFound === true || !ran.event.ok);

        if (entityGuessMissed) {
          usedToolsSuccessfully = false;
          forcedToolName = '';
          lastSummary = '';
          collectedSuggestions.length = 0;
          collectedUi.length = 0;
        } else if (!ran.event.ok) {
          finalText =
            ran.event.summary ||
            'تعذر تنفيذ الطلب. اختر العميل من القائمة ثم أعد المحاولة، أو تحقق من صلاحية كشف الحساب.';
          yield { type: 'delta', text: finalText };
          streamedText = true;
        }
      } else {
        yield { type: 'tool_end', name: resolvedName, ok: false, durationMs: 0 };
        finalText =
          resolvedName === 'exportAccountStatementPdf' || resolvedName === 'emailAccountStatement'
            ? 'لا تملك صلاحية تصدير أو إرسال كشف الحساب. اطلب تفعيل صلاحية كشف الحساب ثم أعد المحاولة.'
            : 'هذه العملية غير متاحة لحسابك.';
        yield { type: 'delta', text: finalText };
        streamedText = true;
      }
    }

    if (usedToolsSuccessfully) {
      finalText = this.narrateSuccessfulTools(forcedToolName, collectedUi, ctx, lastSummary);
      if (!forcedToolName || forcedToolName !== 'searchEntity' || !collectedUi.some((b) => b.type === 'disambiguation')) {
        if (forcedToolName === 'searchEntity') collectedSuggestions.push('رصيده', 'كشف PDF', 'أرسل الكشف بالإيميل', 'كشف الحساب');
      }
      yield { type: 'delta', text: finalText };
      streamedText = true;
    } else if (!streamedText && !this.llm.hasToolCapableProvider) {
      yield { type: 'status', message: 'تعذّر التشغيل' };
      finalText = 'تعذر تشغيل المستشار الذكي: مفتاح OpenAI غير موجود. عيّن OPENAI_API_KEY ثم أعد المحاولة.';
      yield { type: 'delta', text: finalText };
      streamedText = true;
    } else if (!streamedText) {
      const systemPrompt = this.buildFastSystemPrompt(ctx, allowedTools, learnedFacts, recentTopics);
      const messages: LlmMessage[] = [
        { role: 'system', content: systemPrompt },
        ...this.toLlmMessages(params.dto),
      ];

      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          if (usedToolsSuccessfully) break;
          if (Date.now() - started > TIME_BUDGET_MS) {
            yield { type: 'status', message: 'أجهّز الإجابة بما توفّر…' };
            break;
          }

          yield { type: 'status', message: round === 0 ? 'أفكّر…' : 'أواصل…' };

          const completion = await this.llm.complete({
            messages,
            tools: allowedTools,
            toolChoice:
              SYSTEM_SUBJECT.test(question) && !usedToolsSuccessfully && !looksLikeImageGeneration(question)
                ? 'required'
                : 'auto',
            temperature: 0.3,
            maxTokens: DATA_QUESTION.test(question) ? 500 : 900,
          });
          modelUsed = completion.model;

          if (!completion.toolCalls.length) {
            const leaked = parseLeakedToolCall(completion.content || '');
            if (leaked) {
              completion.toolCalls.push({
                id: `leaked_${round}_${leaked.name}`,
                name: leaked.name,
                arguments: leaked.arguments,
              });
              completion.content = '';
            }
          }

          if (!completion.toolCalls.length) {
            const cleaned = stripModelScratch(completion.content || '');
            const reasoning = looksLikeInternalReasoning(completion.content || '') || !cleaned;
            const needsData = SYSTEM_SUBJECT.test(question) && !usedToolsSuccessfully;

            if (needsData && reasoning && round < MAX_TOOL_ROUNDS - 1) {
              continue;
            }

            if (needsData) {
              // No tool produced records. Answer anyway when the model has something
              // real to say — the invented-number guard below still blocks fabricated
              // company figures. Refusing outright was making the Copilot look useless
              // on every question the tool layer did not happen to cover.
              finalText =
                cleaned && !this.looksLikeInventedNumber(cleaned)
                  ? cleaned
                  : 'لم أجد هذه المعلومة في سجلات النظام. حدّد الحساب أو الفترة أو رقم العملية وأعيد المحاولة.';
              yield { type: 'delta', text: finalText };
              streamedText = true;
              break;
            }

            if (cleaned) {
              // Backstop: the model sometimes answers a present-day question from stale
              // memory and hedges instead of reaching for the web. Detect the hedge and
              // search, rather than trying to predict such questions with keywords.
              if (looksLikeNoLiveAccess(cleaned)) {
                yield { type: 'status', message: 'أبحث…' };
                yield {
                  type: 'tool_start',
                  name: 'searchCurrentInfo',
                  label: TOOL_LABELS.searchCurrentInfo || 'البحث عن معلومات حالية',
                };
                const searched = await this.runNamedTool({
                  toolName: 'searchCurrentInfo',
                  args: { query: question },
                  allowedTools,
                  ctx,
                  conversationId: conversation.id,
                  question,
                });
                const searchOk = Boolean(searched?.event.ok);
                yield {
                  type: 'tool_end',
                  name: 'searchCurrentInfo',
                  ok: searchOk,
                  durationMs: searched?.event.durationMs || 0,
                };
                if (searchOk && searched?.event.summary) {
                  toolsUsed.push('searchCurrentInfo');
                  usedToolsSuccessfully = true;
                  finalText = searched.event.summary;
                  yield { type: 'delta', text: finalText };
                  streamedText = true;
                  break;
                }
              }
              finalText = cleaned;
              yield { type: 'delta', text: finalText };
              streamedText = true;
              break;
            }

            finalText = 'لم أتمكن من تجهيز إجابة. أعد صياغة السؤال أو حدد الحساب/العملية المقصودة.';
            yield { type: 'delta', text: finalText };
            streamedText = true;
            break;
          }

          messages.push({
            role: 'assistant',
            content: completion.content || '',
            tool_calls: completion.toolCalls.map((tc) => ({
              id: tc.id,
              type: 'function',
              function: { name: tc.name, arguments: JSON.stringify(tc.arguments || {}) },
            })),
          });

          for (const call of completion.toolCalls) {
            const resolvedName = canonicalToolName(call.name) || call.name;
            const tool = allowedTools.find((t) => t.name === resolvedName);
            const label = TOOL_LABELS[resolvedName] || resolvedName;
            const resolvedArgs = normalizeToolArgs(resolvedName, call.arguments);
            yield { type: 'tool_start', name: resolvedName, label };

            const { event, message } = await this.executeTool(
              tool,
              { ...call, name: resolvedName, arguments: resolvedArgs },
              ctx,
              conversation.id,
              question,
            );
            yield { type: 'tool_end', name: resolvedName, ok: event.ok, durationMs: event.durationMs };
            toolsUsed.push(resolvedName);
            if (event.ok) usedToolsSuccessfully = true;
            if (event.summary) lastSummary = event.summary;

            if (event.ui?.length) {
              collectedUi.push(...event.ui);
              yield { type: 'ui', blocks: event.ui };
            }
            if (event.suggestions?.length) {
              collectedSuggestions.push(...event.suggestions);
            }

            messages.push(message);

            if (resolvedName === 'searchEntity' && event.ok) {
              try {
                const parsed = JSON.parse(message.content || '{}') as any;
                const match = parsed?.data?.match;
                if (parsed?.data?.exact && match?.id && match?.label) {
                  const extra = match.accountId
                    ? `${match.kind}:${match.id} account:${match.accountId}`
                    : `${match.kind}:${match.id}`;
                  void this.learning.rememberAlias(ctx, match.label, match.kind, match.id, extra);
                }
              } catch {
                // truncated tool payload is not worth failing the turn over
              }
            }
          }

          if (usedToolsSuccessfully) {
            finalText = this.narrateSuccessfulTools(forcedToolName || toolsUsed[0] || '', collectedUi, ctx, lastSummary);
            yield { type: 'delta', text: finalText };
            streamedText = true;
            break;
          }
        }
      } catch (err: any) {
        this.logger.warn(`Tool loop failed: ${err.message}`);
        yield { type: 'status', message: 'أعيد المحاولة…' };
        if (usedToolsSuccessfully) {
          finalText = lastSummary || narrationForTool(forcedToolName || toolsUsed[0] || '');
          if (!streamedText) {
            yield { type: 'delta', text: finalText };
            streamedText = true;
          }
        } else {
          try {
            const fallback = await this.llm.complete({
              messages: [
                { role: 'system', content: this.buildFastSystemPrompt(ctx, allowedTools) },
                ...this.toLlmMessages(params.dto),
              ],
              tools: allowedTools,
              toolChoice: 'auto',
              temperature: 0.1,
              maxTokens: 500,
            });
            modelUsed = fallback.model;
            const call = fallback.toolCalls[0] || parseLeakedToolCall(fallback.content || '');
            if (call) {
              const ran = await this.runNamedTool({
                toolName: call.name,
                args: call.arguments || {},
                allowedTools,
                ctx,
                conversationId: conversation.id,
                question,
              });
              if (ran?.event.ok) {
                usedToolsSuccessfully = true;
                forcedToolName = ran.resolvedName;
                toolsUsed.push(ran.resolvedName);
                lastSummary = ran.event.summary || lastSummary;
                yield { type: 'tool_start', name: ran.resolvedName, label: TOOL_LABELS[ran.resolvedName] || ran.resolvedName };
                yield { type: 'tool_end', name: ran.resolvedName, ok: true, durationMs: ran.event.durationMs };
                if (ran.event.ui?.length) {
                  collectedUi.push(...ran.event.ui);
                  yield { type: 'ui', blocks: ran.event.ui };
                }
                finalText = lastSummary || narrationForTool(ran.resolvedName);
                yield { type: 'delta', text: finalText };
                streamedText = true;
              }
            }
            if (!streamedText) {
              const cleaned = stripModelScratch(fallback.content || '');
              finalText =
                cleaned && !looksLikeInternalReasoning(cleaned) ? cleaned : this.noAnswerText(question);
              yield { type: 'delta', text: finalText };
              streamedText = true;
            }
          } catch (fallbackErr: any) {
            this.logger.warn(`Fast fallback failed: ${fallbackErr.message}`);
            finalText = 'تعذر الوصول إلى OpenAI. تحقق من المفتاح والرصيد ثم أعد المحاولة.';
            yield { type: 'delta', text: finalText };
            streamedText = true;
          }
        }
      }
    }

    if (!finalText && usedToolsSuccessfully) {
      finalText = narrationForTool(forcedToolName || toolsUsed[0] || '');
      yield { type: 'delta', text: finalText };
      streamedText = true;
    }

    const ranStatementTool = toolsUsed.some(
      (n) => n === 'exportAccountStatementPdf' || n === 'emailAccountStatement',
    );
    if (
      SYSTEM_SUBJECT.test(question) &&
      !usedToolsSuccessfully &&
      !ranStatementTool &&
      !parseEntityPick(question) &&
      !looksLikeImageGeneration(question)
    ) {
      const safe = 'لم أجد هذه المعلومة في سجلات النظام. حدّد الحساب أو الفترة أو رقم العملية وأعيد المحاولة.';
      if (!finalText || this.looksLikeInventedNumber(finalText)) {
        finalText = safe;
        if (!streamedText) yield { type: 'delta', text: finalText };
      }
    }

    if (looksLikeInternalReasoning(finalText)) {
      finalText = usedToolsSuccessfully
        ? narrationForTool(forcedToolName || toolsUsed[0] || '')
        : this.noAnswerText(question);
      if (!streamedText) yield { type: 'delta', text: finalText };
    }

    if (!finalText) {
      finalText = 'لم أتمكن من تجهيز إجابة. أعد صياغة السؤال أو حدد الحساب/العملية المقصودة.';
      yield { type: 'delta', text: finalText };
    } else if (!streamedText) {
      yield { type: 'delta', text: finalText };
    }

    const uniqueSuggestions = Array.from(new Set(collectedSuggestions)).slice(0, 5);
    if (uniqueSuggestions.length) {
      yield { type: 'suggestions', items: uniqueSuggestions };
    }

    const saved = await this.conversations.addMessage({
      conversationId: conversation.id,
      role: 'assistant',
      content: finalText,
      toolCalls: toolsUsed.map((name) => ({ name })),
      uiBlocks: collectedUi,
      model: modelUsed,
      latencyMs: Date.now() - started,
    });

    yield {
      type: 'done',
      conversationId: conversation.id,
      messageId: saved.id,
      model: modelUsed,
      toolsUsed,
    };
  }

  async runToCompletion(params: {
    dto: ChatRequestDto;
    user: any;
    branchHeader?: string;
    ipAddress?: string;
  }) {
    let reply = '';
    const uiBlocks: AiUiBlock[] = [];
    let conversationId = '';
    let messageId = '';
    let model = '';
    const toolsUsed: string[] = [];
    const suggestions: string[] = [];

    for await (const event of this.run(params)) {
      if (event.type === 'delta') reply += event.text;
      if (event.type === 'ui') uiBlocks.push(...event.blocks);
      if (event.type === 'suggestions') suggestions.push(...event.items);
      if (event.type === 'done') {
        conversationId = event.conversationId;
        messageId = event.messageId;
        model = event.model;
        toolsUsed.push(...event.toolsUsed);
        if (!reply) {
          // Some paths emit a single delta equal to the full reply already collected.
        }
      }
      if (event.type === 'error') {
        throw new Error(event.message);
      }
    }

    return { reply, uiBlocks, conversationId, messageId, model, toolsUsed, suggestions };
  }

  private async runNamedTool(params: {
    toolName: string;
    args: Record<string, any>;
    allowedTools: AiTool[];
    ctx: AiRequestContext;
    conversationId: string;
    question: string;
  }) {
    const resolvedName = canonicalToolName(params.toolName);
    const tool = params.allowedTools.find((t) => t.name === resolvedName);
    if (!tool) return null;

    const call = {
      id: `intent_${resolvedName}`,
      name: resolvedName,
      arguments: normalizeToolArgs(resolvedName, params.args || {}),
    };
    const { event, message } = await this.executeTool(
      tool,
      call,
      params.ctx,
      params.conversationId,
      params.question,
    );

    return {
      resolvedName,
      event,
      toolMessage: message,
      assistantMessage: {
        role: 'assistant' as const,
        content: '',
        tool_calls: [
          {
            id: call.id,
            type: 'function',
            function: { name: resolvedName, arguments: JSON.stringify(call.arguments) },
          },
        ],
      },
    };
  }

  private async executeTool(
    tool: AiTool | undefined,
    call: { id: string; name: string; arguments: any },
    ctx: AiRequestContext,
    conversationId: string,
    question: string,
  ): Promise<{
    event: {
      ok: boolean;
      durationMs: number;
      ui?: AiUiBlock[];
      suggestions?: string[];
      summary?: string;
      /** Tool executed successfully but matched no record. */
      notFound?: boolean;
    };
    message: LlmMessage;
  }> {
    const started = Date.now();

    if (!tool) {
      void this.audit.logTool({
        ctx,
        conversationId,
        question,
        toolName: call.name,
        toolArgs: call.arguments,
        status: 'denied',
        durationMs: Date.now() - started,
        resultSummary: 'أداة غير موجودة أو غير مسموحة',
      });
      return {
        event: {
          ok: false,
          durationMs: Date.now() - started,
          summary: 'هذه الأداة غير متاحة لك أو غير موجودة',
        },
        message: {
          role: 'tool',
          tool_call_id: call.id,
          name: call.name,
          content: JSON.stringify({ ok: false, message: 'هذه الأداة غير متاحة لك أو غير موجودة' }),
        },
      };
    }

    try {
      this.permissions.assertToolAllowed(ctx, tool);
      const args = this.injectAccountFromMemory(tool.name, call.arguments || {}, ctx);
      const budget = HEAVY_TOOLS.has(tool.name) ? HEAVY_TOOL_TIMEOUT_MS : TOOL_TIMEOUT_MS;
      const result = await runWithTimeout(
        Promise.resolve(tool.handler(args, ctx)),
        budget,
        tool.name,
      );
      const durationMs = Date.now() - started;
      const incoming = this.memory.fromToolResult(tool.name, result);
      ctx.memory = this.memory.merge(ctx.memory, incoming);
      const summary = this.summarizeToolResult(tool.name, result.data, result.note);

      void this.audit.logTool({
        ctx,
        conversationId,
        question,
        toolName: tool.name,
        toolArgs: call.arguments,
        status: result.ok ? 'ok' : 'error',
        durationMs,
        resultSummary: summary,
        mutatedData: tool.sensitivity === 'write',
      });

      return {
        event: {
          ok: result.ok,
          durationMs,
          ui: result.ui,
          suggestions: result.suggestions,
          summary,
          notFound: result.data?.found === false,
        },
        message: {
          role: 'tool',
          tool_call_id: call.id,
          name: tool.name,
          content: JSON.stringify({
            ok: result.ok,
            note: result.note,
            data: result.data,
          }).slice(0, 4000),
        },
      };
    } catch (err: any) {
      const durationMs = Date.now() - started;
      const denied = err?.status === 403 || err?.name === 'ForbiddenException';
      if (err?.name === 'ToolTimeoutError') {
        this.logger.error(`Tool "${tool.name}" timed out after ${durationMs}ms`);
      }
      void this.audit.logTool({
        ctx,
        conversationId,
        question,
        toolName: tool.name,
        toolArgs: call.arguments,
        status: denied ? 'denied' : 'error',
        durationMs,
        resultSummary: err.message,
      });
      return {
        event: { ok: false, durationMs, summary: err.message || 'فشل تنفيذ الأداة' },
        message: {
          role: 'tool',
          tool_call_id: call.id,
          name: tool.name,
          content: JSON.stringify({ ok: false, message: err.message || 'فشل تنفيذ الأداة' }),
        },
      };
    }
  }

  private async ensureConversation(dto: ChatRequestDto, user: any) {
    if (dto.conversationId) {
      try {
        return await this.conversations.getOwnedMeta(dto.conversationId, user.companyId, user.userId);
      } catch {
        // fall through to create
      }
    }
    return this.conversations.create({
      companyId: user.companyId,
      userId: user.userId,
      tenantId: user.tenantId,
    });
  }

  private toLlmMessages(dto: ChatRequestDto): LlmMessage[] {
    const recent = (dto.messages || []).slice(-8);
    return recent.map((m) => {
      if (m.imageBase64 && m.imageBase64.startsWith('data:image/')) {
        return {
          role: m.role,
          content: [
            { type: 'text', text: m.content || 'انظر إلى هذه الصورة وأجب حسب طلب المستخدم. إذا لم يحدد طلباً فصف محتواها.' },
            { type: 'image_url', image_url: { url: m.imageBase64 } },
          ],
        };
      }
      if (m.imageBase64) {
        return {
          role: m.role,
          content: `${m.content || ''}\n[مرفق غير صوري تم تجاهل محتواه الثنائي حفاظًا على الأمان]`.trim(),
        };
      }
      return { role: m.role, content: m.content || '' };
    });
  }

  private memoryFromHistory(dto: ChatRequestDto) {
    const entries: { kind: string; id: string; label: string; extra?: Record<string, any> }[] = [];
    for (const m of dto.messages || []) {
      const pick = parseEntityPick(m.content || '');
      if (pick) {
        entries.push({
          kind: pick.kind,
          id: pick.id,
          label: pick.label || pick.id,
          extra: { accountId: pick.accountId },
        });
      }
    }
    return entries;
  }

  private narrateSuccessfulTools(
    toolName: string,
    collectedUi: AiUiBlock[],
    ctx: AiRequestContext,
    lastSummary: string,
  ) {
    if (toolName === 'searchEntity' || collectedUi.some((b) => b.type === 'disambiguation')) {
      const dis = collectedUi.find((b) => b.type === 'disambiguation');
      const selected = ctx.memory?.[ctx.memory.length - 1];
      if (dis) {
        return `يوجد أكثر من نتيجة لـ «${dis.payload?.query || ''}». اختر المقصود من القائمة، ثم أخبرني ماذا تريد بخصوصه.`;
      }
      return selected?.label
        ? `تم العثور على «${selected.label}». يمكنك طلب كشف PDF أو إرسال الكشف بالإيميل.`
        : 'وجدته. ما طلبك بخصوص هذا الاختيار؟';
    }
    if (toolName === 'exportAccountStatementPdf') {
      return lastSummary || 'تم تجهيز كشف PDF بنفس قالب الطباعة المعتمد. يمكنك تنزيله من البطاقة أعلاه.';
    }
    if (toolName === 'emailAccountStatement') {
      return lastSummary || 'راجع بيانات الإرسال أعلاه ثم أكّد إن كان الكشف جاهزاً.';
    }
    return lastSummary || narrationForTool(toolName);
  }

  private selectedLedger(ctx: AiRequestContext) {
    const selected = [...(ctx.memory || [])]
      .reverse()
      .find((m) => m.kind === 'account' || m.kind === 'customer' || m.kind === 'supplier');
    if (!selected) return null;
    const accountId = String(selected.extra?.accountId || (selected.kind === 'account' ? selected.id : '') || '').trim();
    return {
      accountId,
      entityId: selected.id,
      kind: selected.kind,
      query: selected.label,
    };
  }

  private statementToolArgs(ctx: AiRequestContext, extra: Record<string, any> = {}) {
    const selected = this.selectedLedger(ctx);
    const args: Record<string, any> = { ...extra };
    if (selected?.accountId && !args.accountId) args.accountId = selected.accountId;
    if (selected?.entityId && !args.entityId) args.entityId = selected.entityId;
    if (selected?.kind && !args.kind) args.kind = selected.kind;
    const junkQuery = !args.query || /^(pdf|email|الإيميل|الايميل|بالإيميل|بالايميل)$/i.test(String(args.query));
    if (selected?.query && junkQuery) args.query = selected.query;
    return args;
  }

  private resolveFollowUpOrIntent(question: string, ctx: AiRequestContext) {
    if (looksLikeImageGeneration(question)) {
      return { toolName: 'generateImage', args: { prompt: question } };
    }

    const follow = parseEntityFollowUp(question);
    const recipientEmail = extractEmailAddress(question);
    // The account may be named inside the very same sentence ("أرسل كشف الى سلف علي
    // السعدي"). Before this, the follow-up branches below looked only at the entity
    // remembered from an earlier turn, so the name the user just typed was thrown
    // away and the tool answered "لم يُحدد حساب للكشف".
    const namedInSentence = stripStatementLeadIn(question);
    const named = namedInSentence ? { query: namedInSentence } : {};

    if (follow === 'tickets') {
      const selected = this.selectedLedger(ctx);
      if (selected?.query) return { toolName: 'searchTickets', args: { query: selected.query } };
    }
    if (follow === 'balance') {
      return { toolName: 'getAccountBalance', args: this.statementToolArgs(ctx, named) };
    }
    if (follow === 'statement') {
      return { toolName: 'getAccountStatement', args: this.statementToolArgs(ctx, named) };
    }
    if (follow === 'statement_pdf') {
      return { toolName: 'exportAccountStatementPdf', args: this.statementToolArgs(ctx, named) };
    }
    if (follow === 'statement_email' || follow === 'statement_email_confirm') {
      return {
        toolName: 'emailAccountStatement',
        args: this.statementToolArgs(ctx, {
          ...named,
          confirm: follow === 'statement_email_confirm',
          ...(recipientEmail ? { recipientEmail } : {}),
        }),
      };
    }

    const statementReq = parseStatementRequest(question);
    if (statementReq) {
      return {
        toolName: statementReq.toolName,
        args: this.statementToolArgs(ctx, {
          ...(statementReq.args || {}),
          ...(recipientEmail ? { recipientEmail } : {}),
        }),
      };
    }

    return resolveIntent(question);
  }

  /** Last-resort wording. A general question must not be told "no matching record". */
  private noAnswerText(question: string): string {
    return SYSTEM_SUBJECT.test(question)
      ? 'لم أجد هذه المعلومة في سجلات النظام. حدّد الحساب أو الفترة أو رقم العملية وأعيد المحاولة.'
      : 'لم أتمكن من تجهيز إجابة لهذا السؤال. أعد صياغته وسأحاول من جديد.';
  }

  private looksLikeInventedNumber(text: string) {
    return /(?:\$|د\.ع|IQD|USD)\s*[\d,]+|[\d,]{4,}/.test(text);
  }

  private injectAccountFromMemory(toolName: string, args: Record<string, any>, ctx: AiRequestContext) {
    const needsAccount = [
      'exportAccountStatementPdf',
      'emailAccountStatement',
      'getAccountStatement',
      'getAccountBalance',
      'analyzeAccountBalance',
    ].includes(toolName);
    if (!needsAccount) return args;
    return this.statementToolArgs(ctx, args);
  }

  private persistUserTurn(conversationId: string, question: string, imageBase64?: string) {
    return this.conversations
      .addMessage({
        conversationId,
        role: 'user',
        content: question,
        imageBase64,
      })
      .then(() => {
        void this.conversations.setTitleIfDefault(conversationId, question);
      })
      .catch((err: any) => this.logger.warn(`Failed to persist user turn: ${err.message}`));
  }

  private summarizeToolResult(toolName: string, data: any, note?: string): string {
    if (toolName === 'searchCurrentInfo' && data?.answer) return String(data.answer);
    if (note && note.length <= 400) return note;
    if (data?.message) return String(data.message);
    if (data?.found === false) return 'لم أجد عملية مطابقة لهذه البيانات.';
    const count = Number(data?.count);
    if (Number.isFinite(count)) {
      if (count === 0) return 'لم أجد نتائج في سجلات النظام.';
      return `وجدت ${count.toLocaleString('en-US')} نتيجة من سجلات النظام.`;
    }
    return narrationForTool(toolName);
  }

  private buildFastSystemPrompt(
    ctx: AiRequestContext,
    allowedTools: AiTool[],
    learnedFacts = '',
    recentTopics = '',
  ): string {
    const session = this.contextBuilder.describe(ctx);
    const catalog = allowedTools
      .map((t) => `- ${t.name}: ${(t.description || '').split('.')[0]}`)
      .join('\n');

    return `أنت مساعد ذكي داخل نظام قيد، تشتغل وسط موظفي مكتب سفر عراقي.
${nowContextLine()}

## أسلوبك
تكلّم باللهجة العراقية البيضاء اللي يتكلّمها الموظف بالمكتب: قريبة، واضحة، بلا تكلّف وبلا فصحى ثقيلة.
خفّة الدم مطلوبة: تعليق قصير ظريف، كلمة دارجة، ردّ فيه دفء. «هلا بيك»، «تدلّل»، «شوف هاي»، «عاشت إيدك».
خلّي الجملة قصيرة — النكتة الطويلة تتعب، والموظف مستعجل.

**لكن الخفّة بالصياغة فقط، أبداً بالأرقام:**
- لا تمزح بمبلغ ولا رصيد ولا تاريخ ولا رقم عملية، ولا تقرّب رقم لأجل النكتة.
- إذا الخبر مو زين — خسارة، دين متأخر، قيد مو متوازن — قله بوضوح أول شي، وبعدين خفّف إذا تريد.
- لا تسخر من المستخدم ولا من عميل ولا من موظف بالاسم، ولا تعلّق على أحد بالسوء.
- إذا ما تعرف الجواب قله صريح: «ما لكيت» أحسن من جواب ظريف وغلط.
إذا كتب المستخدم بالفصحى أو بالإنجليزية، جاوب بلغته هو.
لا تقل إن معرفتك تتوقف في يونيو 2024 أو أي تاريخ تدريب. التاريخ أعلاه هو المرجع الحالي.
## نطاق عملك
أجب عن أي سؤال يُطرح عليك، بلا استثناء، وبأولوية واضحة:
1. إن كان السؤال عن سجلات هذا النظام (أرصدة، عملاء، موردون، ذمم، تذاكر، فيزا، فنادق، استرجاع، سندات، قيود، صناديق، فروع، صرف) فاستخدم الأداة المناسبة بالاسم الدقيق ولا تخمّن رقماً أبداً.
2. وإن كان عن العالم الآن (أخبار، أسعار عالمية، طقس، أحداث) فاستخدم searchCurrentInfo.
3. وإن كان سؤالاً عاماً لا علاقة له بالنظام (شرح، ترجمة، حساب رياضي، برمجة، تاريخ، رأي، نصيحة) فأجب مباشرة من معرفتك بلا أدوات، ولا تعتذر ولا تقل إن عملك يقتصر على النظام.
لا ترفض سؤالاً لمجرد أنه خارج النظام. الممنوع الوحيد هو اختراع رقم مالي يخص هذه الشركة دون أداة.

## قاعدة حاسمة في أسماء الحسابات
أسماء الحسابات في شجرة الحسابات تبدأ كثيراً بكلمة تبدو وصفاً وهي **جزء من الاسم**:
«سلف علي السعدي»، «مصاريف انترنيت»، «صندوق احمد»، «ماستر 1 الوكيل»، «إيرادات التذاكر».
ابحث بالنص الكامل مثل ما كتبه المستخدم حرفياً. **لا تحذف «سلف» ولا «مصاريف» ولا «صندوق» ولا «ماستر»** ظنّاً أنها كلمات زائدة —
«سلف علي السعدي» حساب مستقل غير «علي السعدي»، وحذف الكلمة يجيب حساباً خاطئاً وكشفاً لشخص آخر.
إذا ما لكيت نتيجة بالنص الكامل، جرّب نصاً أقصر، وقل للمستخدم إن هذي نتيجة تقريبية.

## من أين تأتي معلومات النظام
- العملاء والموردون وشركات الطيران والموظفون والحسابات والمسافرون: searchEntity ثم getAccountBalance أو getAccountStatement.
- «مين أكثر واحد مدين لنا» و«الذمم على العملاء»: getReceivables (مرتبة تنازلياً).
- «شكد علينا» و«المستحق للموردين»: getPayables.
- التذاكر وإصدارها وتفاصيلها: searchTickets ثم getTicketDetails. للتأشيرات getVisas، للفنادق getHotelBookings، وللاسترجاع searchTickets بـ tripType=REFUND.
- غير المسدّد: getUnpaidTickets. السندات: searchVouchers. القيود: searchJournalEntries و explainJournalEntry.
- **رمز أو رقم وحده**: إذا أرسل المستخدم رمزاً أو رقماً بلا سؤال — PNR مثل PRMCK، أو رقم تذكرة مثل 0762300332188، أو رقم جواز مثل LR4429416، أو رقم فاتورة أو سند أو قيد — فاستدعِ findByReference فوراً بذلك الرمز. لا تسأله عن نوع الرقم ولا تخمّنه: الأداة تبحث في كل العمليات والخدمات معاً وتخبرك أين تطابق.
- **«شنو الوضع اليوم؟»** أو «شي محتاج انتباه؟» أو «شلون الشركة؟»: استخدم getDailyBrief.
- **إشارة لشي سابق**: إذا قال «شنو حچينا عن…» أو «تتذكر» أو «قلتلك قبل» أو «المرة الماضية»، أو أشار لموضوع بلا تفاصيل — استخدم recallConversations للبحث بمحادثاتكم السابقة. لا تعتذر بأنك ما تتذكر قبل ما تدوّر.
- **سؤال لا تغطّيه أداة جاهزة**: استخدم queryData — استعلام قراءة على أي جدول في النظام. إن لم تكن متأكداً من اسم الجدول أو الحقل فاستدعِ describeSchema أولاً. لا تكتب SQL ولا تضع شرط الشركة بنفسك؛ الخادم يضيف العزل. وفضّل دائماً الأداة المخصّصة إن وُجدت (getReceivables أدقّ من queryData على Customer).

## سعر الصرف — قاعدة أساسية في هذا النظام
في السوق العراقي ثلاثة أسعار: بغداد، وأربيل (تسمّى الشمال)، والبصرة (تسمّى الجنوب) — ولكلٍّ سعر بيع وسعر شراء.
النظام لا يسعّر بسعر السوق مباشرة، بل بـ«السعر المعتمد»، وهو مشتق لا مُدخل:

  السعر المعتمد = سعر السوق المرتبط + هامش الأمان

الشركة تختار أي سوق يرتبط به السعر المعتمد (بيع بغداد، شراء بغداد، بيع الشمال، بيع الجنوب، أو متوسط الثلاثة)، ثم تضيف هامش الأمان الذي يُحدَّد إما لكل دولار أو لكل ١٠٠ دولار. ويمكن بدل ذلك تثبيت السعر يدوياً.
هامش الأمان يحمي من تقلّب السوق بين لحظة التسعير ولحظة التسديد؛ وكل بيع وتكلفة وربح في النظام يُحتسب بالسعر المعتمد لا بسعر السوق.
عند أي سؤال عن السعر أو الهامش أو «ليش السعر هيك» استخدم getExchangeRate — فهي ترجع السعر المعتمد والسوق المرتبط والهامش والأسواق الثلاثة — واشرح المعادلة بالأرقام الفعلية.
إذا طلب المستخدم تصميم/توليد صورة استخدم generateImage.
إذا اختار المستخدم كياناً من قائمة، لا تبحث عنه من جديد. اسأله: ما طلبك بخصوص هذا الاختيار؟
بعد الاختيار استخدم الكيان المحفوظ للمتابعة (رصيده، كشف PDF، إرسال الكشف بالإيميل، كشفه، تذاكره).
إذا طلب المستخدم اسم شركة أو عميل فابحث بـ searchEntity واعرض النتائج المشابهة ليختار.
كشف PDF = exportAccountStatementPdf بنفس قالب الطباعة المعتمد. أرسل الكشف = emailAccountStatement عبر خدمة الإيميل ولا ترسل قبل confirm=true. الإيميل يجب أن يحمل ملف PDF المرفق فقط دون ملخص أرصدة أو حركات في نص الرسالة.
غير مسدد = آجل. باقي = غير مسعّر.
ممنوع كتابة JSON كمحادثة. استدع الأدوات عبر function calling فقط.

الأدوات:
${catalog}

${session}
${learnedFacts ? `\n${learnedFacts}` : ''}
${recentTopics ? `\n${recentTopics}` : ''}`;
  }
}
