import { apiRequest } from './client';

export interface TicketPassengerData {
  id?: string;
  name: string;
  ticketType?: string;
  ticketNumber?: string;
  documentNumber?: string;
  passportNumber?: string;
  visaType?: string;
  orderNumber?: string;
  pnr?: string;
  fareBuy?: number;
  fareSell?: number;
  tax1?: number;
  tax2?: number;
  charge?: number;
  percentage?: number;
  status?: string;
}

export interface TicketData {
  id?: string;
  invoiceNumber: string;
  issueDate?: string | Date;
  travelDate?: string | Date | null;
  returnDate?: string | Date | null;
  customerName?: string;
  customerId?: string | null;
  customerAccountId?: string | null;
  employeeName?: string;
  entryEmployee?: string;
  modifiedByEmployee?: string;
  cashbox?: string | null;
  currency?: string;
  exchangeRate?: number;
  paymentType?: string | null;
  supplierAccount?: string | null;
  supplierAccountName?: string | null;
  supplierId?: string | null;
  supplierAccountId?: string | null;
  tripType?: string | null;
  airline?: string | null;
  airlineId?: string | null;
  travelClass?: string | null;
  pnr?: string | null;
  route?: string | null;
  discountType?: string | null;
  discountValue?: number;
  discountAmount?: number;
  totalSell?: number;
  totalBuy?: number;
  netSell?: number;
  netBuy?: number;
  profit?: number;
  notes?: string;
  agentName?: string;
  reference?: string;
  status?: string;
  paymentMethod?: string | null;
  receivingCashbox?: string | null;
  cashboxAccountId?: string | null;
  transferImage?: string | null;
  isAudited?: boolean;
  auditedBy?: string;
  auditedAt?: string;
  branchId?: string;
  companyId?: string;
  createdAt?: string;
  updatedAt?: string;
  passengers?: TicketPassengerData[];
  customer?: { id: string; code: string; nameAr: string; accountId: string } | null;
  supplier?: { id: string; code: string; nameAr: string; accountId: string } | null;
  airlineRef?: { id: string; code?: string; nameAr: string; nameEn?: string; logo?: string } | null;
  cashboxAccount?: { id: string; code: string; nameAr: string } | null;
  branch?: { id: string; code: string; nameAr: string } | null;
}

export interface TicketStats {
  count: number;
  totalSales: number;
  totalCost: number;
  totalProfit: number;
  totalPassengers: number;
}

export interface TicketDashboardSummary {
  kpis: {
    salesIQD: number;
    salesUSD: number;
    buyCostIQD: number;
    buyCostUSD: number;
    netProfitIQD: number;
    netProfitUSD: number;
    refundsIQD: number;
    refundsUSD: number;
    auditedCount: number;
    pendingAuditCount: number;
    unauditedCount: number;
    receiptsIQD: number;
    receiptsUSD: number;
    paymentsIQD: number;
    paymentsUSD: number;
  };
  servicesData: Record<string, {
    count: number;
    salesIQD: number;
    salesUSD: number;
    costIQD: number;
    costUSD: number;
    profitIQD: number;
    profitUSD: number;
  }>;
  trendChartData: Array<{ date: string; sales: number; purchases: number; profit: number }>;
}

function ticketListQuery(params?: { limit?: number; dateFrom?: string; dateTo?: string }): string {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params?.dateTo) query.set('dateTo', params.dateTo);
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

export const ticketsApi = {
  getAll: (params?: { limit?: number; dateFrom?: string; dateTo?: string }): Promise<TicketData[]> =>
    apiRequest(`/tickets${ticketListQuery(params)}`),

  getFlights: (params?: { limit?: number; dateFrom?: string; dateTo?: string }): Promise<TicketData[]> =>
    apiRequest(`/tickets/flights${ticketListQuery(params)}`),

  getVisas: (params?: { limit?: number; dateFrom?: string; dateTo?: string }): Promise<TicketData[]> =>
    apiRequest(`/tickets/visas${ticketListQuery(params)}`),

  getOne: (id: string): Promise<TicketData> =>
    apiRequest(`/tickets/${id}`),

  getStats: (): Promise<TicketStats> =>
    apiRequest('/tickets/stats'),

  getDashboardSummary: (params: Record<string, string | undefined>): Promise<TicketDashboardSummary> => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) query.set(key, value);
    });
    return apiRequest(`/tickets/dashboard-summary?${query.toString()}`);
  },

  create: (data: Omit<TicketData, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>): Promise<TicketData> =>
    apiRequest('/tickets', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<TicketData>): Promise<TicketData> =>
    apiRequest(`/tickets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  toggleAudit: (id: string): Promise<TicketData> =>
    apiRequest(`/tickets/${id}/audit`, {
      method: 'PATCH',
    }),

  cancel: (id: string, reason?: string): Promise<TicketData> =>
    apiRequest(`/tickets/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  delete: (id: string): Promise<void> =>
    apiRequest(`/tickets/${id}`, {
      method: 'DELETE',
    }),
};
