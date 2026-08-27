import { AiRequestContext } from '../types/ai-tool.types';
import { baghdadYmd, utcYmd } from '../core/baghdad-clock';

/**
 * Arabic text is written inconsistently (أ/ا/إ, ة/ه, ى/ي, diacritics), so every
 * name comparison goes through this normaliser before matching.
 */
export function normalizeArabic(value: string): string {
  return (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670]/g, '')
    .replace(/[\u0622\u0623\u0625\u0671]/g, 'ا')
    .replace(/\u0629/g, 'ه')
    .replace(/\u0649/g, 'ي')
    .replace(/\u0640/g, '')
    .replace(/\s+/g, ' ');
}

export function looseMatch(haystack: string | null | undefined, needle: string): boolean {
  if (!haystack) return false;
  const h = normalizeArabic(haystack);
  const n = normalizeArabic(needle);
  if (!n) return false;
  // A short needle must match a WHOLE WORD, never a bare substring. Otherwise a
  // 3-letter query like "انت" matches «الريحانتان سماوة» and «مصاريف انترنيت»,
  // which is how the search used to return nonsense for "من انت".
  if (n.length < 4) {
    return h.split(' ').some((w) => w === n);
  }
  if (h.includes(n) || n.includes(h)) return true;
  // Every word in the query must appear somewhere, so "علي السعدي" matches "علي حسن السعدي".
  const words = n.split(' ').filter((w) => w.length > 1);
  return words.length > 1 && words.every((w) => h.includes(w));
}

export function toNumber(value: any): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function round2(value: any): number {
  return Math.round(toNumber(value) * 100) / 100;
}

export interface ResolvedPeriod {
  startDate: string;
  endDate: string;
  label: string;
}

/**
 * Turns natural-language period hints into a concrete date range.
 * Calendar days use Asia/Baghdad so "اليوم" matches the agency clock.
 */
export function resolvePeriod(
  args: { period?: string; startDate?: string; endDate?: string },
  ctx: AiRequestContext,
): ResolvedPeriod {
  const period = (args.period || '').toUpperCase();

  if (args.startDate && args.endDate) {
    return { startDate: args.startDate, endDate: args.endDate, label: `${args.startDate} → ${args.endDate}` };
  }

  const today = baghdadYmd();
  const [y, m, d] = today.split('-').map(Number);

  switch (period) {
    case 'TODAY':
      return { startDate: today, endDate: today, label: 'اليوم' };
    case 'YESTERDAY': {
      const yday = utcYmd(y, m, d - 1);
      return { startDate: yday, endDate: yday, label: 'أمس' };
    }
    case 'WEEK':
      return { startDate: utcYmd(y, m, d - 6), endDate: today, label: 'آخر 7 أيام' };
    case 'MONTH':
      return { startDate: utcYmd(y, m, 1), endDate: today, label: 'هذا الشهر' };
    case 'LAST_MONTH': {
      const s = utcYmd(y, m - 1, 1);
      const e = utcYmd(y, m, 0);
      return { startDate: s, endDate: e, label: 'الشهر الماضي' };
    }
    case 'QUARTER':
      return { startDate: utcYmd(y, m - 2, 1), endDate: today, label: 'آخر 3 أشهر' };
    case 'YEAR':
      return { startDate: utcYmd(y, 1, 1), endDate: today, label: 'هذه السنة' };
    default:
      break;
  }

  if (ctx.fiscalYear) {
    return {
      startDate: ctx.fiscalYear.startDate,
      endDate: ctx.fiscalYear.endDate,
      label: `السنة المالية ${ctx.fiscalYear.name}`,
    };
  }

  return {
    startDate: utcYmd(y, 1, 1),
    endDate: today,
    label: 'السنة الحالية',
  };
}

export const PERIOD_ENUM = [
  'TODAY',
  'YESTERDAY',
  'WEEK',
  'MONTH',
  'LAST_MONTH',
  'QUARTER',
  'YEAR',
  'FISCAL_YEAR',
];

/** A ticket counts as unpaid when it was sold on credit rather than settled in cash. */
const CASH_PAYMENT_TYPES = new Set(['DEBIT', 'CASH', 'CASH_HAND', 'MASTER_CARD', 'PAID', 'نقدي']);

export function isCreditTicket(paymentType?: string | null): boolean {
  const value = (paymentType || '').trim();
  if (!value) return false;
  return !CASH_PAYMENT_TYPES.has(value.toUpperCase()) && !CASH_PAYMENT_TYPES.has(value);
}

/** Keeps model-facing payloads small; the full set still reaches the UI block. */
export function capForModel<T>(rows: T[], max = 15): { rows: T[]; truncated: boolean; total: number } {
  return {
    rows: rows.slice(0, max),
    truncated: rows.length > max,
    total: rows.length,
  };
}

export function formatMoney(amount: number, currency = 'IQD'): string {
  const rounded = round2(amount);
  const formatted = rounded.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return currency === 'USD' ? `$${formatted}` : `${formatted} د.ع`;
}

export function emptyResult(message: string) {
  return { ok: false, data: { found: false, message }, note: message };
}
