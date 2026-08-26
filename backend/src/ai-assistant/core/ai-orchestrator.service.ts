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
  looksLikeLiveWorldQuestion,
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

    yield { type: 'status', message: instant ? 'جاهز' : 'جارٍ فهم السؤال...' };

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
        yield { type: 'status', message: 'جارٍ تجهيز كشف PDF بنفس قالب الطباعة...' };
      } else if (resolvedName === 'emailAccountStatement') {
        yield {
          type: 'status',
          message: intent.args?.confirm ? 'جارٍ إرسال الكشف بالإيميل...' : 'جارٍ تجهيز إرسال الكشف...',
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
        if (!ran.event.ok) {
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
    } else if (
      !streamedText &&
      !DATA_QUESTION.test(question) &&
      !looksLikeLiveWorldQuestion(question) &&
      !looksLikeImageGeneration(question) &&
      !lastUser?.imageBase64
    ) {
      yield { type: 'status', message: 'جارٍ الكتابة...' };
      const messages: LlmMessage[] = [
        {
          role: 'system',
          content:
            `أنت المستشار الذكي في نظام قيد. ${nowContextLine()}. أجب بجملة أو جملتين بنفس لغة المستخدم. لا تقل إن معرفتك تتوقف في 2024. لا تخترع أرقامًا مالية ولا تستدع أدوات.`,
        },
        ...this.toLlmMessages(params.dto),
      ];
      let streamed = '';
      try {
        for await (const delta of this.llm.streamText({ messages, temperature: 0.4, maxTokens: 350 })) {
          streamed += delta;
          yield { type: 'delta', text: delta };
        }
        finalText = stripModelScratch(streamed) || streamed;
        streamedText = Boolean(finalText);
        modelUsed = streamed ? this.llm.primaryModelName : 'none';
      } catch (err: any) {
        this.logger.warn(`Fast chat stream failed: ${err.message}`);
      }
    } else if (!streamedText && !this.llm.hasToolCapableProvider) {
      yield { type: 'status', message: 'OpenAI غير مهيأ.' };
      finalText = 'تعذر تشغيل المستشار الذكي: مفتاح OpenAI غير موجود. عيّن OPENAI_API_KEY ثم أعد المحاولة.';
      yield { type: 'delta', text: finalText };
      streamedText = true;
    } else if (!streamedText) {
      const systemPrompt = this.buildFastSystemPrompt(ctx, allowedTools);
      const messages: LlmMessage[] = [
        { role: 'system', content: systemPrompt },
        ...this.toLlmMessages(params.dto),
      ];

      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          if (usedToolsSuccessfully) break;
          if (Date.now() - started > TIME_BUDGET_MS) {
            yield { type: 'status', message: 'انتهت مهلة التحليل، أجهّز الإجابة مما توفر حتى الآن.' };
            break;
          }

          yield { type: 'status', message: round === 0 ? 'جارٍ استدعاء النموذج...' : 'جارٍ استكمال التحليل...' };

          const completion = await this.llm.complete({
            messages,
            tools: allowedTools,
            toolChoice: DATA_QUESTION.test(question) && !usedToolsSuccessfully && !looksLikeImageGeneration(question) ? 'required' : 'auto',
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
            const needsData = DATA_QUESTION.test(question) && !usedToolsSuccessfully;

            if (needsData && reasoning && round < MAX_TOOL_ROUNDS - 1) {
              continue;
            }

            if (needsData) {
              finalText =
                'لم أجد عملية مطابقة لهذه البيانات، أو لا أملك معلومات كافية لتحديد الرقم دون الرجوع إلى سجلات النظام.';
              yield { type: 'delta', text: finalText };
              streamedText = true;
              break;
            }

            if (cleaned) {
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
        yield { type: 'status', message: 'تعذر الوصول إلى OpenAI، أعيد المحاولة...' };
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
                cleaned && !looksLikeInternalReasoning(cleaned)
                  ? cleaned
                  : 'لم أجد عملية مطابقة لهذه البيانات، أو لا أملك معلومات كافية لتحديد الرقم دون الرجوع إلى سجلات النظام.';
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
      DATA_QUESTION.test(question) &&
      !usedToolsSuccessfully &&
      !ranStatementTool &&
      !parseEntityPick(question) &&
      !looksLikeImageGeneration(question)
    ) {
      const safe = 'لم أجد عملية مطابقة لهذه البيانات، أو لا أملك معلومات كافية لتحديد الرقم دون الرجوع إلى سجلات النظام.';
      if (!finalText || this.looksLikeInventedNumber(finalText)) {
        finalText = safe;
        if (!streamedText) yield { type: 'delta', text: finalText };
      }
    }

    if (looksLikeInternalReasoning(finalText)) {
      finalText = usedToolsSuccessfully
        ? narrationForTool(forcedToolName || toolsUsed[0] || '')
        : 'لم أجد عملية مطابقة لهذه البيانات، أو لا أملك معلومات كافية لتحديد الرقم دون الرجوع إلى سجلات النظام.';
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
    event: { ok: boolean; durationMs: number; ui?: AiUiBlock[]; suggestions?: string[]; summary?: string };
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
        event: { ok: result.ok, durationMs, ui: result.ui, suggestions: result.suggestions, summary },
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
    if (follow === 'tickets') {
      const selected = this.selectedLedger(ctx);
      if (selected?.query) return { toolName: 'searchTickets', args: { query: selected.query } };
    }
    if (follow === 'balance') {
      return { toolName: 'getAccountBalance', args: this.statementToolArgs(ctx) };
    }
    if (follow === 'statement') {
      return { toolName: 'getAccountStatement', args: this.statementToolArgs(ctx) };
    }
    if (follow === 'statement_pdf') {
      return { toolName: 'exportAccountStatementPdf', args: this.statementToolArgs(ctx) };
    }
    if (follow === 'statement_email' || follow === 'statement_email_confirm') {
      return {
        toolName: 'emailAccountStatement',
        args: this.statementToolArgs(ctx, {
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

  private buildFastSystemPrompt(ctx: AiRequestContext, allowedTools: AiTool[]): string {
    const session = this.contextBuilder.describe(ctx);
    const catalog = allowedTools
      .map((t) => `- ${t.name}: ${(t.description || '').split('.')[0]}`)
      .join('\n');

    return `أنت مساعد ذكي طبيعي داخل نظام قيد. تكلم بطبيعتك، بنفس لغة المستخدم.
${nowContextLine()}
لا تقل إن معرفتك تتوقف في يونيو 2024 أو أي تاريخ تدريب. التاريخ أعلاه هو المرجع الحالي.
للأسئلة المحاسبية والأرصدة والتذاكر والسندات: استخدم الأدوات بالاسم الدقيق ولا تخمّن أي رقم.
للأخبار والأحداث العامة والأسعار العالمية و«ما الجديد اليوم»: استخدم searchCurrentInfo.
للأسئلة العامة الأخرى (شرح، ترجمة، رأي) أجب مباشرة دون أدوات.
إذا طلب المستخدم تصميم/توليد صورة استخدم generateImage.
إذا اختار المستخدم كياناً من قائمة، لا تبحث عنه من جديد. اسأله: ما طلبك بخصوص هذا الاختيار؟
بعد الاختيار استخدم الكيان المحفوظ للمتابعة (رصيده، كشف PDF، إرسال الكشف بالإيميل، كشفه، تذاكره).
إذا طلب المستخدم اسم شركة أو عميل فابحث بـ searchEntity واعرض النتائج المشابهة ليختار.
كشف PDF = exportAccountStatementPdf بنفس قالب الطباعة المعتمد. أرسل الكشف = emailAccountStatement عبر خدمة الإيميل ولا ترسل قبل confirm=true.
غير مسدد = آجل. باقي = غير مسعّر.
ممنوع كتابة JSON كمحادثة. استدع الأدوات عبر function calling فقط.

الأدوات:
${catalog}

${session}`;
  }
}
