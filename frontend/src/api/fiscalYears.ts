import { apiRequest } from './client';

export interface FiscalPeriod {
  id: string;
  name: string;
  periodNumber: number;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'CLOSED' | 'LOCKED';
  fiscalYearId?: string;
  companyId: string;
}

export interface FiscalYear {
  id: string;
  companyId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'DRAFT' | 'OPEN' | 'SOFT_CLOSED' | 'CLOSED' | 'REOPENED';
  baseCurrency: string;
  isCurrent: boolean;
  createdById: string;
  closedById?: string;
  closedAt?: string;
  reopenedById?: string;
  reopenedAt?: string;
  reopenReason?: string;
  closingEntryId?: string;
  openingEntryId?: string;
  previousYearId?: string;
  nextYearId?: string;
  notes?: string;
  periods?: FiscalPeriod[];
  totalPeriods?: number;
  openPeriods?: number;
  closedPeriods?: number;
  _count?: {
    journalEntries: number;
    balanceAuditLogs: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface BalanceAuditLogItem {
  id: string;
  companyId: string;
  fiscalYearId: string;
  reopenSessionId?: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  currency: string;
  documentType: string;
  documentNumber?: string;
  journalEntryId?: string;
  actionType: string;
  userId: string;
  userName: string;
  reason: string;
  beforeDebit: number;
  afterDebit: number;
  beforeCredit: number;
  afterCredit: number;
  beforeBalance: number;
  afterBalance: number;
  balanceDiff: number;
  affectedNextYears?: string;
  createdAt: string;
}

export interface PreCheckResult {
  fiscalYear: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    status: string;
  };
  isBalanced: boolean;
  totalDebit: number;
  totalCredit: number;
  balanceDiff: number;
  draftEntriesCount: number;
  openPeriodsCount: number;
  equityAccounts: Array<{ id: string; code: string; nameAr: string; balance: number }>;
  availableNextYears: FiscalYear[];
  canClose: boolean;
  warnings: string[];
}

export interface ClosingPreviewResult {
  sourceYear: { id: string; name: string };
  targetYear: { id: string; name: string; startDate: string };
  totalRevenues: number;
  totalExpenses: number;
  netProfitOrLoss: number;
  isProfit: boolean;
  totalRevenuesIQD?: number;
  totalRevenuesUSD?: number;
  totalExpensesIQD?: number;
  totalExpensesUSD?: number;
  netProfitOrLossIQD?: number;
  netProfitOrLossUSD?: number;
  retainedEarningsAccount: { id: string; code: string; nameAr: string } | null;
  closingLinesPreview: Array<{
    accountId: string;
    accountCode: string;
    accountName: string;
    type: string;
    balance: number;
    action: 'DEBIT' | 'CREDIT';
    amount: number;
  }>;
  openingLinesPreview: Array<{
    accountId: string;
    accountCode: string;
    accountName: string;
    type: string;
    closingBalance: number;
    debit: number;
    credit: number;
  }>;
  allAccounts?: Array<{
    accountId: string;
    accountCode: string;
    accountName: string;
    type: string;
    typeLabelAr: string;
    currency: string;
    balance: number;
    balanceIQD?: number;
    balanceUSD?: number;
    debit: number;
    credit: number;
    isExternalClearing?: boolean;
    clearingCategory?: string;
    action: 'ROLLOVER' | 'CLOSE_TO_RETAINED' | 'ZERO';
    actionLabelAr: string;
  }>;
}

export const fiscalYearsApi = {
  getAll: () => apiRequest<FiscalYear[]>('/api/fiscal-years'),
  getById: (id: string) => apiRequest<FiscalYear>(`/api/fiscal-years/${id}`),
  getActive: () => apiRequest<FiscalYear>('/api/fiscal-years/active'),
  setActive: (fiscalYearId: string) =>
    apiRequest<{ success: boolean; activeFiscalYear: FiscalYear }>('/api/fiscal-years/active', {
      method: 'POST',
      body: JSON.stringify({ fiscalYearId }),
    }),
  create: (data: {
    name: string;
    startDate: string;
    endDate: string;
    baseCurrency?: string;
    isCurrent?: boolean;
    previousYearId?: string;
    notes?: string;
    createMonthlyPeriods?: boolean;
  }) =>
    apiRequest<FiscalYear>('/api/fiscal-years', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  preCheckClosing: (id: string) => apiRequest<PreCheckResult>(`/api/fiscal-years/${id}/pre-check`),
  previewClosing: (data: { fiscalYearId: string; targetFiscalYearId: string; retainedEarningsAccountId: string }) =>
    apiRequest<ClosingPreviewResult>('/api/fiscal-years/preview-closing', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  executeClosing: (data: {
    fiscalYearId: string;
    targetFiscalYearId: string;
    retainedEarningsAccountId: string;
    closingDate?: string;
    notes?: string;
  }) =>
    apiRequest<{
      success: boolean;
      sourceYear: string;
      targetYear: string;
      closingEntryNumber: string;
      openingEntryNumber: string;
      netProfitOrLoss: number;
    }>('/api/fiscal-years/execute-closing', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  reopen: (id: string, reason: string) =>
    apiRequest<{ success: boolean; year: string; status: string; reopenSessionId: string }>(
      `/api/fiscal-years/${id}/reopen`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }
    ),
  recalculate: (id: string, reason?: string) =>
    apiRequest<{ success: boolean; message: string; affectedYears: string[] }>(
      `/api/fiscal-years/${id}/recalculate`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }
    ),
  reclose: (id: string, reason: string) =>
    apiRequest<{ success: boolean; year: string; status: string }>(`/api/fiscal-years/${id}/reclose`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  getAuditLogs: (id: string, params?: { accountId?: string; actionType?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiRequest<BalanceAuditLogItem[]>(`/api/fiscal-years/${id}/audit-logs${query ? `?${query}` : ''}`);
  },
  delete: (id: string) =>
    apiRequest<{ success: boolean; message: string }>(`/api/fiscal-years/${id}`, {
      method: 'DELETE',
    }),
};
