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
