/**
 * Maps high-frequency user questions to the exact registered tool name.
 * Prevents the model from inventing names from page routes (e.g. getCashboxesBanks)
 * or dumping a JSON tool request as chat text (e.g. searchPartners).
 */

import { baghdadLongAr, baghdadYmd } from './baghdad-clock';

export interface IntentHit {
  toolName: string;
  args?: Record<string, any>;
}

export const TOOL_ALIASES: Record<string, string> = {
  getCashboxesBanks: 'getCashboxBalances',
  getCashAndBankBalances: 'getCashboxBalances',
  getCashboxes: 'getCashboxBalances',
  getBanks: 'getCashboxBalances',
  getCashAndBanks: 'getCashboxBalances',
  getCashboxBankBalances: 'getCashboxBalances',
  getCashboxesBalances: 'getCashboxBalances',
  searchPartners: 'searchEntity',
  searchPartner: 'searchEntity',
  searchCustomers: 'searchEntity',
  searchCustomer: 'searchEntity',
  searchEmployees: 'searchEntity',
  searchEmployee: 'searchEntity',
  searchAccounts: 'searchEntity',
  searchAccount: 'searchEntity',
  searchSuppliers: 'searchEntity',
  searchSupplier: 'searchEntity',
  findEntity: 'searchEntity',
  lookupEntity: 'searchEntity',
  exportAccountStatementPdf: 'exportAccountStatementPdf',
  generateStatementPdf: 'exportAccountStatementPdf',
  sendStatementEmail: 'emailAccountStatement',
  emailStatement: 'emailAccountStatement',
  sendAccountStatement: 'emailAccountStatement',
};

export function canonicalToolName(name?: string): string {
  if (!name) return '';
  if (TOOL_ALIASES[name]) return TOOL_ALIASES[name];
  if (/(cashbox|cashboxes|bank).*(balance)|balances.*(cash|bank)/i.test(name)) {
    return 'getCashboxBalances';
  }
  if (/^search(partners?|customers?|employees?|accounts?|suppliers?|airlines?)$/i.test(name)) {
    return 'searchEntity';
  }
  return name;
}

export function normalizeToolArgs(toolName: string, args: any): Record<string, any> {
  const a = args && typeof args === 'object' && !Array.isArray(args) ? { ...args } : {};
  delete a.balanced;
  delete a.isBalanced;
  delete a.balance;
  if (toolName === 'searchEntity') {
    a.query = String(a.query || a.name || a.q || a.search || a.term || '').trim();
  }
  if (toolName === 'exportAccountStatementPdf' || toolName === 'emailAccountStatement') {
    a.query = String(a.query || a.name || a.q || a.search || a.term || '').trim();
    if (!a.query || /^(pdf|email|الإيميل|الايميل|بالإيميل|بالايميل)$/i.test(a.query)) delete a.query;
    if (a.recipientEmail) a.recipientEmail = String(a.recipientEmail).trim();
    if (a.confirm === 'true' || a.confirm === true) a.confirm = true;
    if (a.entityId) a.entityId = String(a.entityId).trim();
    if (a.kind) a.kind = String(a.kind).trim();
  }
  if (toolName === 'searchVouchers') {
    const cur = String(a.currency || a.curr || '').toUpperCase();
    if (cur === 'USD' || cur === '$' || /دولار/.test(String(a.currency || ''))) a.currency = 'USD';
    else if (cur === 'IQD' || /دينار/.test(String(a.currency || ''))) a.currency = 'IQD';
    if (/دفع|مصروف|صرف|payment/i.test(String(a.voucherType || a.type || ''))) a.voucherType = 'PAYMENT';
    if (/قبض|receipt/i.test(String(a.voucherType || a.type || ''))) a.voucherType = 'RECEIPT';
  }
  if (toolName === 'findUnbalancedJournalEntries') {
    delete a.balanced;
  }
  return a;
}

export function stripEntityPickTokens(text: string): string {
  return (text || '').replace(/\n?\[\[entity:[^\]]+\]\]/g, '').trim();
}

export function extractEntityQuery(question: string): string | null {
  const q = stripEntityPickTokens(question || '');
  if (parseEntityPick(question || '')) return null;
  if (parseEntityFollowUp(question || '')) return null;
  if (looksLikeLiveWorldQuestion(q)) return null;
  const patterns = [
    /من\s+هو+ه?\s+(.+)$/,
    /تحقق\s+من\s+(?:هوه?\s+)?(?:سلف\s+)?(.+)$/,
    /سلف\s+(.+)$/,
    /(?:رصيد|كشف)\s+(?:حساب\s+)?(.+)$/,
    /(?:شركة|العميل|عميل|المورد|مورد)\s+(.+)$/,
  ];
  const generic = /^(الحساب|هذا|هذه|اختيارك|المقصود|العميل|المورد|pdf|email|الإيميل|الايميل|بالإيميل|بالايميل)$/i;
  for (const p of patterns) {
    const m = q.match(p);
    if (!m) continue;
    let name = m[1].replace(/[؟?!.،,]+$/g, '').trim();
    name = name.replace(/^(سلف|حساب|هوه?)\s+/, '');
    if (generic.test(name)) continue;
    if (name.length >= 3 && name.split(/\s+/).length <= 6) return name;
  }
  return null;
}

export interface EntityPick {
  kind: string;
  id: string;
  accountId?: string;
  label: string;
}

export function parseEntityPick(text: string): EntityPick | null {
  const raw = text || '';
  const m = raw.match(/\[\[entity:([^:\]]+):([^:\]]+)(?::([^\]]*))?\]\]/);
  if (!m) return null;
  const label =
    raw.match(/«([^»]+)»/)?.[1] ||
    raw.match(/اخترت:\s*\S+\s+(.+?)(?:\s+—|$)/)?.[1]?.trim() ||
    '';
  return {
    kind: m[1],
    id: m[2],
    accountId: m[3] || undefined,
    label,
  };
}

export function looksLikeImageGeneration(question: string): boolean {
  const q = (question || '').trim();
  if (!q) return false;
  if (/(تذكرة|فاتورة|سند|قيد|كشف|screenshot|ticket)/i.test(q) && /(حلّل|حلل|اقرأ|استخرج)/i.test(q)) {
    return false;
  }
  return /(صمم|تصميم|ولّد|ولد\s+صور|ارسم|شعار|بوستر|لوجو|generate\s+(an?\s+)?image|create\s+(an?\s+)?image|dall-?e|gpt-image)/i.test(
    q,
  );
}

export type EntityFollowUpAction =
  | 'balance'
  | 'statement'
  | 'statement_pdf'
  | 'statement_email'
  | 'statement_email_confirm'
  | 'tickets';

export function extractEmailAddress(text: string): string | null {
  const m = (text || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0] : null;
}

export function parseEntityFollowUp(question: string): EntityFollowUpAction | null {
  const q = stripEntityPickTokens(question || '')
    .replace(/[؟?!.،,]+$/g, '')
    .trim();
  if (!q || q.length > 160) return null;
  if (/^اخترت:/.test(q) && !/(كشف|رصيد|تذاكر|أيميل|ايميل|إيميل|pdf|email)/i.test(q)) return null;

  const wantsPdf = /(pdf|بي\s*دي\s*اف|تصدير|طب[اأ]عة)/i.test(q);
  const wantsEmail = /(أرسل|ارسل|ايميل|إيميل|بريد|email|send)/i.test(q);
  const hasStatement = /كشف/.test(q);
  const confirms = /(نعم|أكد|أأكد|تأكيد|confirm)/i.test(q);

  if (confirms && (wantsEmail || hasStatement)) return 'statement_email_confirm';
  if (hasStatement && wantsPdf) return 'statement_pdf';
  if (hasStatement && wantsEmail) return 'statement_email';
  if (/^(كشف\s*PDF|صدّر الكشف|صدر الكشف|تصدير الكشف)$/i.test(q)) return 'statement_pdf';
  if (/^(أرسل الكشف|ارسل الكشف|أرسله بالإيميل|ارسله بالايميل)$/i.test(q)) return 'statement_email';
  if (/^(كشف(?:\s*الحساب)?)$/i.test(q)) return 'statement';
  if (/^رصيد(?:ه|ها)?$/i.test(q)) return 'balance';
  if (/^تذاكر(?:ه|ها)?$/i.test(q)) return 'tickets';
  return null;
}

export function isEntityFollowUp(question: string): boolean {
  return parseEntityFollowUp(question) != null;
}

const NAME_STOP = /^(مرحبا|اهلا|أهلا|السلام|سلام|شكرا|تمام|زين|حسنا|ok|okay|hi|hello|hey|yo|كيفك|شلونك)$/i;
const NAME_QUESTION = /^(كم|هل|ما|ماذا|لماذا|ليش|متى|وين|أين|اعرض|قارن|احسب|صمم|ارسم|ولد|ولّد)/;

export function looksLikeBareEntityName(question: string): boolean {
  const q = (question || '').replace(/[؟?!.،,]+$/g, '').trim();
  if (!q || q.length < 2 || q.length > 42) return false;
  if (NAME_STOP.test(q) || NAME_QUESTION.test(q)) return false;
  if (parseEntityPick(q) || parseEntityFollowUp(q) || looksLikeImageGeneration(q)) return false;
  if (/(رصيد|كشف|تذاكر|سند|قيد|أرباح|ارباح|مبيعات|ذمم|صندوق|بنك|ميزان)/.test(q)) return false;
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length > 4) return false;
  return /[\u0600-\u06FFa-zA-Z]/.test(q);
}

export function parseStatementRequest(question: string): IntentHit | null {
  const q = stripEntityPickTokens(question || '').trim();
  if (!q) return null;
  const follow = parseEntityFollowUp(question || '');
  if (!follow || (follow !== 'statement_pdf' && follow !== 'statement_email' && follow !== 'statement_email_confirm')) {
    return null;
  }

  let name = '';
  const named = q.match(
    /(?:كشف(?:\s*الحساب)?(?:\s*PDF)?|أرسل(?:\s*الكشف)?|ارسل(?:\s*الكشف)?|تصدير(?:\s*الكشف)?)\s*(?:ل(?:حساب)?|عن|لدى)?\s*(?:شركة|عميل|العميل|المورد)?\s*(.+)$/i,
  );
  if (named) {
    name = named[1].replace(/[؟?!.،,]+$/g, '').trim();
    name = name.replace(/^(شركة|عميل|العميل|المورد|حساب|إلى|الى)\s+/, '');
    name = name.replace(/\s+(بالإيميل|بالايميل|email|pdf)$/i, '');
    if (
      extractEmailAddress(name) ||
      /^(الحساب|هذا|هذه|اختيارك|المقصود|نعم|أكد|pdf|الإيميل|الايميل|email)$/i.test(name) ||
      name.length < 2
    ) {
      name = '';
    }
  }

  const recipientEmail = extractEmailAddress(q) || undefined;
  const args: Record<string, any> = {};
  if (name) args.query = name;
  if (recipientEmail) args.recipientEmail = recipientEmail;
  if (follow === 'statement_email_confirm') args.confirm = true;

  if (follow === 'statement_pdf') return { toolName: 'exportAccountStatementPdf', args };
  return { toolName: 'emailAccountStatement', args };
}

export function looksLikeLeakedToolCall(text: string): boolean {
  const t = text || '';
  if (/"tool"\s*:/i.test(t) && /"(arguments|args|parameters)"\s*:/i.test(t)) return true;
  if (/```(?:json|tool)/i.test(t) && /"(tool|function)"\s*:/i.test(t)) return true;
  return false;
}

export function parseLeakedToolCall(text: string): { name: string; arguments: Record<string, any> } | null {
  if (!text) return null;
  const unfenced = text.replace(/```(?:json|tool)?/gi, '').replace(/```/g, '').trim();
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start < 0 || end <= start) return null;

  const slice = unfenced.slice(start, end + 1);
  try {
    const obj = JSON.parse(slice);
    const rawName = obj.tool || obj.function || (obj.arguments || obj.args ? obj.name : '');
    if (!rawName || typeof rawName !== 'string') return null;
    const name = canonicalToolName(rawName);
    const args = obj.arguments || obj.args || obj.parameters || {};
    return { name, arguments: normalizeToolArgs(name, args) };
  } catch {
    const toolMatch = slice.match(/"(?:tool|function)"\s*:\s*"([A-Za-z][A-Za-z0-9_]+)"/);
    if (!toolMatch) return null;
    const name = canonicalToolName(toolMatch[1]);
    const valueMatch = slice.match(/"(?:name|query|q|search)"\s*:\s*"([^"]+)"/);
    return {
      name,
      arguments: normalizeToolArgs(name, valueMatch ? { query: valueMatch[1] } : {}),
    };
  }
}

export function instantChatReply(question: string, locale: 'ar' | 'en' = 'ar'): string | null {
  const q = (question || '').replace(/[\s!؟?.،,~]+$/g, '').trim();
  if (!q) return null;
  const ar = locale !== 'en';

  if (/معرفتك|قطع المعرفة|knowledge cutoff|حتى يونيو|يونيو\s*2024|تحديث معلوماتك|معلوماتك حتى/i.test(q)) {
    return ar
      ? `التاريخ الحالي ${baghdadLongAr()} (${baghdadYmd()}، بغداد). بيانات الشركة أقرأها حيّة من النظام، وللأخبار والأحداث العامة أبحث على الويب. لا تعتمد على حد تدريب يونيو 2024.`
      : `Today is ${baghdadYmd()} (Baghdad). Company data is live from the system, and public facts are looked up on the web — not limited to a June 2024 training cutoff.`;
  }
  if (/تاريخ\s*اليوم|اليوم\s*كم|كم\s*(هو\s*)?التاريخ|شنو\s*تاريخ|what('?s)?\s*today'?s?\s*date/i.test(q) && q.length <= 80) {
    return ar
      ? `اليوم ${baghdadLongAr()} (${baghdadYmd()} بتوقيت بغداد).`
      : `Today is ${baghdadYmd()} (Asia/Baghdad).`;
  }
  if (q.length > 48) return null;

  if (/^(مرحبا|مرحباً|مرحباا+|اهلا|أهلا|أهلاً|اهلاً|السلام عليكم|سلام عليكم|السلام|سلام|hi+|hello|hey|yo|صباح الخير|مساء الخير)$/i.test(q)) {
    return ar ? 'مرحباً، تفضل. كيف أساعدك؟' : 'Hello — how can I help?';
  }
  if (/^(كيفك|شلونك|شلونكم|كيف حالك|how are you)$/i.test(q)) {
    return ar ? 'بخير، شكراً. ماذا تريد أن نراجع في النظام؟' : 'Doing well. What should we look up?';
  }
  if (/^(شكرا|شكرًا|شكراً|تسلم|مشكور|thanks|thank you|thx)$/i.test(q)) {
    return ar ? 'العفو. إذا احتجت شيئاً آخر أنا هنا.' : 'You are welcome.';
  }
  if (/^(تمام|زين|حسنا|حسناً|حسنًا|ok+|okay|done)$/i.test(q)) {
    return ar ? 'حاضر. أرسل سؤالك متى شئت.' : 'Ready when you are.';
  }
  return null;
}

export function looksLikeLiveWorldQuestion(question: string): boolean {
  const q = question || '';
  if (/(معرفتك|قطع المعرفة|knowledge cutoff|حتى يونيو|يونيو\s*2024|تحديث معلوماتك|معلوماتك حتى)/i.test(q)) {
    return true;
  }
  if (/(ما\s*(هو\s*)?تاريخ\s*اليوم|اليوم كم التاريخ|شنو تاريخ اليوم)/.test(q)) return true;
  if (/(أخبار|خبر عاجل|حالياً في|حاليا في|سعر الذهب|سعر النفط|طقس|انتخاب)/.test(q)) return true;
  if (/من\s+هو/.test(q) && /(رئيس|وزير|ملك|سلطان|بابا|دولة|جمهورية|العالم)/.test(q)) return true;
  return false;
}

export function resolveIntent(question: string): IntentHit | null {
  const q = (question || '').trim();
  if (!q) return null;

  if (/(صندوق|صناديق|بنك|بنوك)/.test(q) && /(رصيد|أرصدة|ارصدة|balances?)/i.test(q)) {
    return { toolName: 'getCashboxBalances' };
  }
  if (/قيود?\s*غير\s*متوازن|غير\s*متوازن/.test(q) && /قيد/.test(q)) {
    return { toolName: 'findUnbalancedJournalEntries' };
  }
  if (/ميزان\s*المراجعة/.test(q)) return { toolName: 'getTrialBalance' };
  if (/(غير\s*مسدد|الآجل|الاجل)/.test(q) && /(تذكر|تذاكر|حجز)/.test(q)) {
    return { toolName: 'getUnpaidTickets' };
  }
  if (/أرباح|ارباح/.test(q) && /اليوم/.test(q)) return { toolName: 'getDailyProfit', args: { period: 'TODAY' } };
  if (/أرباح|ارباح/.test(q) && /الشهر/.test(q) && !/السابق|الماضي/.test(q)) {
    return { toolName: 'getDailyProfit', args: { period: 'MONTH' } };
  }
  if (/مبيعات/.test(q) && /اليوم/.test(q)) return { toolName: 'getSalesSummary', args: { period: 'TODAY' } };
  if (/مبيعات/.test(q) && /الشهر/.test(q) && !/السابق|الماضي/.test(q)) {
    return { toolName: 'getSalesSummary', args: { period: 'MONTH' } };
  }
  if (/سعر\s*الصرف|أسعار\s*الصرف/.test(q)) return { toolName: 'getExchangeRate' };
  if (looksLikeLiveWorldQuestion(q)) {
    return { toolName: 'searchCurrentInfo', args: { query: q } };
  }
  if (/قائمة\s*الدخل/.test(q)) return { toolName: 'getIncomeStatement' };
  if (/ميزانية/.test(q) && !/مراجعة/.test(q)) return { toolName: 'getBalanceSheet' };
  if (/قارن/.test(q) && /فرع/.test(q)) return { toolName: 'compareBranches' };
  if (/ذمم\s*دائن|علينا|مستحق\s*للمورد/.test(q)) return { toolName: 'getPayables' };
  if (/ذمم|مدينة|لنا|على\s*العميل/.test(q) && !/علينا/.test(q)) return { toolName: 'getReceivables' };

  if (/سند/.test(q) && /(دفع|مصروف|صرف)/.test(q)) {
    const currency = /دولار|\$|USD/i.test(q) ? 'USD' : /دينار|د\.ع|IQD/i.test(q) ? 'IQD' : undefined;
    return { toolName: 'searchVouchers', args: { voucherType: 'PAYMENT', ...(currency ? { currency } : {}) } };
  }
  if (/سند/.test(q) && /قبض/.test(q)) {
    return { toolName: 'searchVouchers', args: { voucherType: 'RECEIPT' } };
  }
  if (/آخر\s*السند|السندات/.test(q)) return { toolName: 'searchVouchers' };
  if (/قيد|قيود/.test(q) && !/اشرح|شرح/.test(q)) return { toolName: 'searchJournalEntries' };

  if (parseEntityPick(q) || looksLikeImageGeneration(q)) return null;

  const statementReq = parseStatementRequest(q);
  if (statementReq) return statementReq;

  if (isEntityFollowUp(q)) return null;

  const entityQuery = extractEntityQuery(q);
  if (entityQuery) return { toolName: 'searchEntity', args: { query: entityQuery } };

  if (looksLikeBareEntityName(q)) {
    const name = q.replace(/^(شركة|عميل|العميل|المورد)\s+/, '').trim();
    if (name.length >= 2) return { toolName: 'searchEntity', args: { query: name } };
  }

  return null;
}

export function looksLikeInternalReasoning(text: string): boolean {
  const t = text || '';
  if (/<think>/i.test(t)) return true;
  if (looksLikeLeakedToolCall(t)) return true;
  if (/\bI need to check the available tools\b/i.test(t)) return true;
  if (/\bWait, let me double-check\b/i.test(t)) return true;
  if (/\bSelf-Correction\b/i.test(t)) return true;
  if (/call:\s*`?get[A-Z]/i.test(t)) return true;
  if (/\bI will assume there is a tool\b/i.test(t)) return true;
  if (/\bLooking at the system description\b/i.test(t)) return true;
  return false;
}

export function stripModelScratch(text: string): string {
  let t = text || '';
  t = t.replace(/<think>[\s\S]*?<\/think>/gi, '');
  t = t.replace(/<think>[\s\S]*$/gi, '');
  t = t.replace(/<\/think>/gi, '');
  t = t.trim();
  if (looksLikeInternalReasoning(t) || looksLikeLeakedToolCall(t)) return '';
  return t;
}

export function narrationForTool(toolName: string): string {
  if (toolName === 'getCashboxBalances') {
    return 'هذه أرصدة الصناديق والبنوك الحالية من سجلات النظام.';
  }
  if (toolName === 'searchEntity') {
    return 'هذه نتيجة البحث في سجلات النظام.';
  }
  if (toolName === 'findUnbalancedJournalEntries') {
    return 'هذه القيود غير المتوازنة حسب سجلات النظام.';
  }
  if (toolName === 'searchVouchers') {
    return 'هذه السندات المطابقة من سجلات النظام.';
  }
  if (toolName === 'exportAccountStatementPdf') {
    return 'تم تجهيز كشف PDF بنفس قالب الطباعة المعتمد.';
  }
  if (toolName === 'emailAccountStatement') {
    return 'تم تجهيز إرسال كشف الحساب عبر خدمة الإيميل.';
  }
  return 'تم جلب البيانات. راجع البطاقات والجداول أعلاه.';
}
