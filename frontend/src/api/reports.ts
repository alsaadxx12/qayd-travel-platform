import { apiRequest } from './client';

export type DebtTraceKind =
  | 'SERVICE'
  | 'RECEIPT_VOUCHER'
  | 'PAYMENT_VOUCHER'
  | 'MANUAL_JOURNAL'
  | 'OPENING'
  | 'REVERSAL';

export interface DebtTraceAccount {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string | null;
  type: string;
  category?: string;
  currency: string;
}

export interface DebtTraceSummary {
  currency: string;
  debit: number;
  credit: number;
  balance: number;
  movements: number;
}

export interface DebtTraceSource {
  id: string;
  type: string;
  label: string;
  number?: string | null;
  reference?: string | null;
  invoiceNumber?: string | null;
  pnr?: string | null;
  route?: string | null;
  tripType?: string | null;
  status?: string | null;
  passengers?: Array<{
    id: string;
    name: string;
    ticketNumber?: string | null;
    pnr?: string | null;
  }>;
  cashboxOrBank?: {
    id: string;
    code: string;
    nameAr: string;
  } | null;
}

export interface DebtTraceCounterpart {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string | null;
  debit: number;
  credit: number;
}

export interface DebtTracePathNode {
  role: 'SOURCE' | 'JOURNAL' | 'ACCOUNT' | 'COUNTERPART';
  id: string;
  label: string;
  number?: string | null;
}

export interface DebtTraceMovement {
  traceId: string;
  sequence: number;
  date: string;
  kind: DebtTraceKind;
  direction: 'DEBIT' | 'CREDIT';
  amount: number;
  signedAmount: number;
  debit: number;
  credit: number;
  currency: string;
  currencyConfidence: 'SOURCE' | 'REFERENCE_INFERENCE' | 'ACCOUNT_DEFAULT';
  description: string;
  source: DebtTraceSource;
  sourceConfidence: 'EXACT_RELATION' | 'EXACT_SOURCE_ID' | 'REFERENCE_FALLBACK' | 'LEGACY_RECORD';
  journal: {
    id: string;
    entryNumber: string;
    reference?: string | null;
    description: string;
    status: string;
  } | null;
  counterpartAccounts: DebtTraceCounterpart[];
  path: DebtTracePathNode[];
  balanceBefore: number;
  runningBalance: number;
}

export interface DebtAmountTraceResponse {
  account: DebtTraceAccount;
  generatedAt: string;
  summaries: DebtTraceSummary[];
  counts: {
    total: number;
    services: number;
    vouchers: number;
    journals: number;
  };
  movements: DebtTraceMovement[];
  integrity: {
    basis: string;
    warnings: string[];
    allocationNotice: string;
  };
}

export interface DebtsReportRow {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string | null;
  category?: string;
  type: string;
  debitUSD: number;
  creditUSD: number;
  endingBalanceUSD: number;
  debitIQD: number;
  creditIQD: number;
  endingBalanceIQD: number;
  totalDebit: number;
  totalCredit: number;
  endingBalance: number;
  debtType: 'receivable' | 'payable' | 'zero';
  debtLabel: string;
  accountCurrency: 'USD' | 'IQD';
}

export interface DebtsReportResponse {
  rows: DebtsReportRow[];
  generatedAt: string;
}

export interface AccountStatementLine {
  id: string;
  date: string;
  entryDate?: string | null;
  entryNumber?: string | null;
  voucherNumber?: string | null;
  voucherType?: string | null;
  reference?: string | null;
  description?: string | null;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface AccountStatementResponse {
  account: { id: string; code: string; nameAr: string; type: string };
  startDate: string;
  endDate: string;
  openingBalance: number;
  closingBalance: number;
  lines: AccountStatementLine[];
}

export function getDebtsReport() {
  return apiRequest<DebtsReportResponse>('/api/reports/debts', {
    ttl: 30_000,
    timeoutMs: 15000,
  });
}

export function getAccountStatement(accountId: string, startDate?: string, endDate?: string) {
  const query = new URLSearchParams();
  if (startDate) query.set('startDate', startDate);
  if (endDate) query.set('endDate', endDate);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<AccountStatementResponse>(
    `/api/reports/account-statement/${encodeURIComponent(accountId)}${suffix}`,
    { noCache: true, timeoutMs: 20000 },
  );
}

export function getDebtAmountTrace(accountId: string, signal?: AbortSignal) {
  return apiRequest<DebtAmountTraceResponse>(
    `/api/reports/debts/${encodeURIComponent(accountId)}/amount-trace`,
    {
      noCache: true,
      timeoutMs: 20000,
      signal,
    },
  );
}
