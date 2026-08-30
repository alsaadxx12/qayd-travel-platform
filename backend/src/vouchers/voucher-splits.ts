import { BadRequestException } from '@nestjs/common';

/**
 * Split allocation for receipt and payment vouchers.
 *
 * A split is a REAL accounting distribution: the counter-party side of the entry is
 * spread across several accounts instead of one. That means the split must live in
 * the journal lines, not beside them — the ledger is the single source of truth, and
 * the split is read back out of it rather than stored twice and left to drift.
 *
 * Two rules hold everything together:
 *   1. The legs always sum to exactly the voucher amount. The primary account
 *      absorbs whatever the custom splits did not take.
 *   2. A line's effect on an account balance is always `debit - credit`, so undoing
 *      a posting is the exact inverse of the lines that were written. Reversal is
 *      driven by the stored lines, never by the voucher's scalar fields — those
 *      describe one account and cannot describe a split.
 */

export interface SplitInput {
  accountId?: string | null;
  accountName?: string | null;
  amount?: number | string | null;
}

/** One counter-party posting: an account and the share of the amount it carries. */
export interface PostingLeg {
  accountId: string;
  amount: number;
}

export interface JournalLineLike {
  accountId: string | null;
  debit: any;
  credit: any;
}

/** Money is handled in minor units so repeated splitting cannot drift by fractions. */
const MINOR = 100;
const toMinor = (value: unknown): number => Math.round(Number(value ?? 0) * MINOR);
const fromMinor = (minor: number): number => minor / MINOR;

/**
 * Resolves the requested split into the exact set of counter-party legs.
 *
 * Duplicated accounts are merged rather than posted twice, and the primary account
 * takes the remainder — including the whole amount when no split was requested, which
 * reproduces the original single-line behaviour exactly.
 */
export function normalizeVoucherSplits(
  splits: SplitInput[] | undefined | null,
  totalAmount: number,
  primaryAccountId: string,
): PostingLeg[] {
  const totalMinor = toMinor(totalAmount);
  if (!Number.isFinite(totalMinor) || totalMinor <= 0) {
    throw new BadRequestException('مبلغ السند يجب أن يكون أكبر من الصفر');
  }

  const merged = new Map<string, number>();
  for (const split of splits ?? []) {
    const accountId = String(split?.accountId ?? '').trim();
    const amountMinor = toMinor(split?.amount);
    if (!accountId || !Number.isFinite(amountMinor) || amountMinor <= 0) continue;
    merged.set(accountId, (merged.get(accountId) ?? 0) + amountMinor);
  }

  let allocated = 0;
  merged.forEach((value) => {
    allocated += value;
  });

  if (allocated > totalMinor) {
    throw new BadRequestException(
      `مجموع التقسيم (${fromMinor(allocated).toLocaleString('en-US')}) يتجاوز مبلغ السند (${fromMinor(totalMinor).toLocaleString('en-US')})`,
    );
  }

  const remainder = totalMinor - allocated;
  if (remainder > 0) {
    if (!primaryAccountId) {
      throw new BadRequestException('الحساب المقابل مطلوب لاستيعاب الرصيد المتبقي من التقسيم');
    }
    merged.set(primaryAccountId, (merged.get(primaryAccountId) ?? 0) + remainder);
  }

  const legs: PostingLeg[] = [];
  merged.forEach((amountMinor, accountId) => {
    legs.push({ accountId, amount: fromMinor(amountMinor) });
  });

  // The entry must balance. If this ever trips, the posting is wrong and must not
  // reach the ledger.
  const check = legs.reduce((sum, leg) => sum + toMinor(leg.amount), 0);
  if (check !== totalMinor) {
    throw new BadRequestException('تعذّر توزيع مبلغ السند على الحسابات بشكل متوازن');
  }

  return legs;
}

/**
 * Net effect each stored line had on its account balance, keyed by account.
 * Used to undo a posting exactly, whatever shape it had.
 */
export function balanceDeltasFromLines(lines: JournalLineLike[]): Map<string, number> {
  const deltas = new Map<string, number>();
  for (const line of lines ?? []) {
    if (!line?.accountId) continue;
    const effect = toMinor(line.debit) - toMinor(line.credit);
    if (effect === 0) continue;
    deltas.set(line.accountId, (deltas.get(line.accountId) ?? 0) + effect);
  }
  const out = new Map<string, number>();
  deltas.forEach((minor, accountId) => out.set(accountId, fromMinor(minor)));
  return out;
}

/**
 * Reads the split back out of a posted entry, so the editor can show what was
 * actually booked rather than a copy kept somewhere else.
 *
 * For a receipt the counter-party legs are the credits; for a payment they are the
 * debits. The cashbox leg is excluded — it is the other side of the entry.
 */
export function splitsFromJournalLines(
  lines: JournalLineLike[] | undefined | null,
  cashboxAccountId: string | null | undefined,
  kind: 'RECEIPT' | 'PAYMENT',
): PostingLeg[] {
  if (!lines || lines.length === 0) return [];
  const out: PostingLeg[] = [];
  for (const line of lines) {
    if (!line?.accountId) continue;
    if (cashboxAccountId && line.accountId === cashboxAccountId) continue;
    const minor = kind === 'RECEIPT' ? toMinor(line.credit) : toMinor(line.debit);
    if (minor <= 0) continue;
    out.push({ accountId: line.accountId, amount: fromMinor(minor) });
  }
  return out;
}

/** Everything a line needs to describe itself in an account statement. */
export interface VoucherLineContext {
  kind: 'RECEIPT' | 'PAYMENT';
  voucherNumber: string;
  totalAmount: number;
  currency?: string | null;
  cashboxAccountId: string;
  primaryAccountId: string;
  /** accountId -> display name, for naming each leg. */
  accountNames?: Map<string, string>;
  /** The counterparty as the user knows them: customer or supplier. */
  partyName?: string | null;
  /** The user's own note, already stripped of any legacy marker. */
  note?: string | null;
  /**
   * A voucher can be written in a foreign currency while the ledger is posted in the
   * base one. The line amounts are therefore the CONVERTED figures, and a statement
   * that showed only those would contradict the voucher the user is holding — so the
   * original amount and the rate that produced the posting are named as well.
   */
  originalAmount?: number | null;
  originalCurrency?: string | null;
  exchangeRate?: number | null;
}

const money = (value: number, currency?: string | null): string => {
  const text = Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return currency ? `${text} ${currency}` : text;
};

/**
 * Names the original currency amount when the posting was converted, so the reader
 * can reconcile a dinar line against a dollar voucher.
 */
function fxSuffix(ctx: VoucherLineContext): string {
  const rate = Number(ctx.exchangeRate) || 1;
  const original = Number(ctx.originalAmount) || 0;
  if (!ctx.originalCurrency || rate === 1 || original <= 0) return '';
  if (ctx.originalCurrency === ctx.currency) return '';
  return ` (أصل المبلغ ${money(original, ctx.originalCurrency)} × ${money(rate)})`;
}

/**
 * Builds the full line set, cashbox side included.
 *
 * Line descriptions carry the whole story, because a journal line is the ONLY thing
 * an account statement shows. A generic "سداد/قبض من حساب" told the reader nothing:
 * not who paid, not which share of what total, not why this account was touched. Each
 * line now names its account, its share, the voucher total, the counterparty and the
 * user's own note — so a statement line stands on its own.
 */
export function buildVoucherLines(
  legs: PostingLeg[],
  ctx: VoucherLineContext,
): Array<{ accountId: string; debit: number; credit: number; description: string }> {
  const isReceipt = ctx.kind === 'RECEIPT';
  const label = isReceipt ? 'سند قبض' : 'سند دفع';
  const nameOf = (id: string) => ctx.accountNames?.get(id) || '';
  const total = money(ctx.totalAmount, ctx.currency);
  const isSplit = legs.length > 1;

  const note = (ctx.note || '').trim();
  const tail = note ? ` | ${note}` : '';

  const party = (ctx.partyName || nameOf(ctx.primaryAccountId) || '').trim();
  const cashboxName = nameOf(ctx.cashboxAccountId);

  const cashboxLine = {
    accountId: ctx.cashboxAccountId,
    debit: isReceipt ? ctx.totalAmount : 0,
    credit: isReceipt ? 0 : ctx.totalAmount,
    description:
      `${label} ${ctx.voucherNumber} — ` +
      (isReceipt ? `قبض ${total}` : `صرف ${total}`) +
      (cashboxName ? ` في «${cashboxName}»` : '') +
      (party ? (isReceipt ? ` من ${party}` : ` إلى ${party}`) : '') +
      fxSuffix(ctx) +
      tail,
  };

  const counterLines = legs.map((leg) => {
    const legName = nameOf(leg.accountId);
    const who = legName ? `«${legName}»` : 'حساب';
    const isRemainder = leg.accountId === ctx.primaryAccountId;

    let body: string;
    if (!isSplit) {
      body = `${who} ${money(leg.amount, ctx.currency)}`;
    } else if (isRemainder) {
      body = `${who} ${money(leg.amount, ctx.currency)} من ${total} (المتبقي بعد التقسيم)`;
    } else {
      body = `حصة ${who} ${money(leg.amount, ctx.currency)} من ${total}`;
    }

    // On a split leg the payer is not obvious from the account itself, so name them.
    const from =
      isSplit && !isRemainder && party ? (isReceipt ? ` · قبض من ${party}` : ` · صرف إلى ${party}`) : '';

    return {
      accountId: leg.accountId,
      debit: isReceipt ? 0 : leg.amount,
      credit: isReceipt ? leg.amount : 0,
      description: `${label} ${ctx.voucherNumber} — ${body}${from}${tail}`,
    };
  });

  return isReceipt ? [cashboxLine, ...counterLines] : [...counterLines, cashboxLine];
}

/**
 * Entry-level description. The header of a journal entry should say, on its own, how
 * the amount was distributed — otherwise the split is only visible by opening the lines.
 */
export function buildEntryDescription(
  legs: PostingLeg[],
  ctx: VoucherLineContext,
): string {
  const label = ctx.kind === 'RECEIPT' ? 'سند قبض' : 'سند دفع';
  const nameOf = (id: string) => ctx.accountNames?.get(id) || '';
  const note = (ctx.note || '').trim();
  // The note is kept last, like on the lines, so the header reads as one sentence
  // rather than being cut in half by the user's own text.
  const tail = note ? ` | ${note}` : '';
  const head =
    `${label} ${ctx.voucherNumber} — ${money(ctx.totalAmount, ctx.currency)}${fxSuffix(ctx)}` +
    (ctx.partyName ? `${ctx.kind === 'RECEIPT' ? ' من ' : ' إلى '}${ctx.partyName}` : '');
  if (legs.length <= 1) return `${head}${tail}`;

  const breakdown = legs
    .map((leg) => `${nameOf(leg.accountId) || 'حساب'} ${money(leg.amount, ctx.currency)}`)
    .join(' · ');
  return `${head} — موزّع على: ${breakdown}${tail}`;
}

/**
 * Splits used to be smuggled inside the voucher's description as
 * `[[VOUCHER_SPLIT:<json>]]`, because there was nowhere else to put them. They now
 * live in the journal lines, but vouchers written before that change still carry the
 * marker and still post a single counter line — so they never appear in the split
 * account's statement.
 *
 * This reads the old marker so those vouchers can be found and re-posted.
 */
export const VOUCHER_SPLIT_MARKER = '[[VOUCHER_SPLIT:';

export function parseLegacySplitMarker(description?: string | null): {
  cleanDescription: string;
  splits: SplitInput[];
} {
  const desc = description || '';
  const start = desc.indexOf(VOUCHER_SPLIT_MARKER);
  if (start === -1) return { cleanDescription: desc.trim(), splits: [] };

  const payloadStart = start + VOUCHER_SPLIT_MARKER.length;

  // The payload is a JSON array, so it ends with ']' and the terminator is ']]' —
  // which makes a naive indexOf(']]') match one character early and lose the array's
  // own closing bracket, so the parse always failed. The bracket depth is walked
  // instead (string literals skipped), which is exact regardless of the terminator.
  let depth = 0;
  let inString = false;
  let escaped = false;
  let payloadEnd = -1;
  for (let i = payloadStart; i < desc.length; i++) {
    const ch = desc[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) {
        payloadEnd = i + 1;
        break;
      }
    }
  }
  if (payloadEnd === -1) return { cleanDescription: desc.slice(0, start).trim(), splits: [] };

  // Skip the trailing ']]' terminator if it is there.
  const afterPayload = desc.startsWith(']]', payloadEnd) ? payloadEnd + 2 : payloadEnd;
  const cleanDescription = (desc.slice(0, start) + desc.slice(afterPayload)).trim();
  try {
    const parsed = JSON.parse(desc.slice(payloadStart, payloadEnd));
    if (!Array.isArray(parsed)) return { cleanDescription, splits: [] };
    // The old payload also carried the system account's remainder. It is derived, so
    // it must be dropped here or it would be counted twice on re-posting.
    const splits = parsed.filter(
      (item: any) =>
        item &&
        item.accountId &&
        item.note !== 'رصيد حساب النظام الأساسي' &&
        !String(item.accountName || '').startsWith('النظام ('),
    );
    return { cleanDescription, splits };
  } catch {
    return { cleanDescription, splits: [] };
  }
}
