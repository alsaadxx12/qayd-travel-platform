import { apiRequest } from './client';

export interface TenantSummary {
  id: string;
  name: string;
  legalName?: string;
  slug: string;
  logo?: string;
  phone?: string;
  email?: string;
  city?: string;
  country?: string;
  baseCurrency: string;
  status: 'TRIAL' | 'ACTIVE' | 'GRACE_PERIOD' | 'PAST_DUE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED';
  isRoot: boolean;
  createdAt: string;
  currentPlan: string;
  currentPlanCode: string;
  currentPriceMonthly: number;
  subscriptionStatus: string;
  currentPeriodEnd?: string;
  collectedPaymentsThisMonth?: {
    USD: number;
    IQD: number;
  };
  ownerPermissions?: string[];
  allowedBranchIds?: string[];
  owner?: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  } | null;
  stats: {
    usersCount: number;
    branchesCount: number;
    accountsCount: number;
    ticketsCount: number;
  };
}

export interface TenantUsageMeters {
  tenantId: string;
  planName: string;
  planCode: string;
  branches: {
    current: number;
    limit: number;
    isUnlimited: boolean;
  };
  users: {
    current: number;
    limit: number;
    isUnlimited: boolean;
  };
  emailsDaily: {
    current: number;
    limit: number;
    isUnlimited?: boolean;
  };
  emailsMonthly: {
    current: number;
    limit: number;
    isUnlimited?: boolean;
  };
  storageMB: {
    current: number;
    limit: number;
    isUnlimited?: boolean;
  };
  accountsCount: number;
  ticketsCount: number;
}

export interface TenantDatabaseUsageItem {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  isRoot: boolean;
  companyCount: number;
  owner: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  } | null;
  databaseBytes: number;
  recordCount: number;
  measuredTableCount: number;
  attachmentBytes: number;
  attachmentCount: number;
  largestTables: Array<{
    tableName: string;
    bytes: number;
    records: number;
    estimatedIndexBytes: number | null;
    indexMeasurement: 'PROPORTIONAL_ESTIMATE' | 'UNAVAILABLE';
  }>;
  attachmentTypes: Array<{
    fileType: 'PDF' | 'IMAGES' | 'DOCUMENTS' | 'OTHER';
    fileCount: number;
    fileBytes: number;
  }>;
  activeUserCount: number;
  databaseQuotaBytes: number | null;
  quotaUsagePercent: number | null;
  usageStatus: 'UNLIMITED' | 'UNCONFIGURED' | 'NORMAL' | 'WATCH' | 'NEAR_LIMIT' | 'CRITICAL' | 'OVER_LIMIT';
  monthlyGrowthBytes: number | null;
  monthlyGrowthPercent: number | null;
  estimatedProviderCostCents: number;
  costCurrency: string;
  monthlyRevenueByCurrency: Record<string, number>;
  billing: {
    planName: string;
    status: string;
    billingCycle: 'MONTHLY' | 'YEARLY' | null;
    currency: string;
    periodStart: string | null;
    periodEnd: string | null;
    invoiceAmountCents: number;
    paidCents: number;
    pendingCents: number;
    amountDueCents: number;
  };
}

export interface TenantDatabaseUsageResponse {
  measuredAt: string;
  measurement: 'POSTGRESQL_LOGICAL_ROW_BYTES';
  database: {
    provider: string;
    planName: string | null;
    physicalBytes: number;
    capacityBytes: number | null;
    availableBytes: number | null;
    usagePercent: number | null;
    capacityIsExact: boolean;
    capacitySource: 'CONFIGURED_PROVIDER_PLAN' | 'SUPABASE_PUBLIC_MINIMUM';
    billing: {
      invoiceAmountCents: number;
      paidAmountCents: number;
      amountDueCents: number;
      currency: string;
      billingPeriodStart: string;
      billingPeriodEnd: string;
      updatedAt: string | null;
    } | null;
  };
  resources: {
    database: TenantResourceUsage;
    storage: TenantResourceUsage & { objectCount: number | null };
    egress: TenantResourceUsage;
    realtime: {
      usage: number | null;
      unit: 'REQUESTS';
      interval: '1day';
      source: string;
    };
    edgeFunctions: {
      usage: number | null;
      active: number | null;
      unit: 'DEPLOYED_FUNCTIONS';
      source: string;
    };
  };
  providerIntegration: {
    configured: boolean;
    connected: boolean;
    projectRef: string | null;
    projectName: string | null;
    projectStatus: string | null;
    measuredAt: string;
    interval: '1day';
    apiRequests: {
      auth: number;
      rest: number;
      storage: number;
      realtime: number;
      total: number;
    } | null;
    edgeFunctions: {
      deployed: number;
      active: number;
    } | null;
    billingEgressAvailable: false;
    source: 'SUPABASE_MANAGEMENT_API' | 'NOT_CONFIGURED' | 'CONNECTION_FAILED';
    error: string | null;
  };
  forecast: {
    database: TenantResourceForecast;
    storage: TenantResourceForecast;
    egress: TenantResourceForecast;
  };
  comparison: {
    database: TenantUsageComparison | null;
    storage: TenantUsageComparison | null;
  };
  alerts: Array<{
    resource: string;
    threshold: number;
    level: 'WATCH' | 'WARNING' | 'CRITICAL';
    message: string;
  }>;
  history: TenantUsageSnapshot[];
  measurementLog: Array<{
    id: string;
    measuredAt: string;
    status: 'SUCCESS' | 'FAILED';
    measuredBy: { id: string; name: string; email: string } | null;
    error?: string;
  }>;
  profitability: {
    providerCost: {
      invoiceAmountCents: number;
      paidAmountCents: number;
      projectedCostCents: number;
      currency: string;
      projectionBasis: 'RECORDED_PROVIDER_INVOICE';
    } | null;
    subscriptionRevenueByCurrency: Array<{ currency: string; amountCents: number }>;
    netProfitByCurrency: Array<{ currency: string; amountCents: number }>;
    costAllocationBasis: 'DATABASE_LOGICAL_BYTES';
  };
  customerBilling: {
    totalsByCurrency: Array<{
      currency: string;
      invoiceAmountCents: number;
      paidCents: number;
      pendingCents: number;
      amountDueCents: number;
    }>;
  };
  totals: {
    tenantCount: number;
    databaseBytes: number;
    recordCount: number;
    attachmentBytes: number;
    attachmentCount: number;
    scopedTableCount: number;
  };
  tenants: TenantDatabaseUsageItem[];
}

export interface TenantResourceUsage {
  usedBytes: number | null;
  capacityBytes: number | null;
  usagePercent: number | null;
  source: string;
}

export interface TenantResourceForecast {
  status: 'UNAVAILABLE' | 'CAPACITY_NOT_CONFIGURED' | 'INSUFFICIENT_HISTORY' | 'STABLE' | 'PROJECTED';
  dailyGrowthBytes: number | null;
  at80Percent: string | null;
  at100Percent: string | null;
  projectedAtPeriodEndBytes: number | null;
}

export interface TenantUsageComparison {
  changeBytes: number;
  changePercent: number | null;
}

export interface TenantUsageSnapshot {
  id: string;
  measuredAt: string;
  databasePhysicalBytes: number;
  databaseLogicalBytes: number;
  storageBytes: number | null;
  egressBytes: number | null;
  tenantUsage: Array<{
    tenantId: string;
    databaseBytes: number;
    attachmentBytes: number;
    recordCount: number;
  }>;
}

export interface CreateTenantPayload {
  name: string;
  legalName?: string;
  slug: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  country?: string;
  baseCurrency?: string;
  planCode: 'FREE_TRIAL' | 'BASIC' | 'PRO' | 'ENTERPRISE';
  ownerName: string;
  ownerEmail: string;
  ownerPassword?: string;
  ownerPhone?: string;
}

export const tenantsApi = {
  getAllTenants: async (params?: { search?: string; status?: string }): Promise<TenantSummary[]> => {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.status) query.append('status', params.status);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiRequest<TenantSummary[]>(`/tenants${qs}`);
  },

  getCurrentTenant: async (): Promise<any> => {
    return apiRequest('/tenants/current');
  },

  getCurrentTenantUsage: async (): Promise<TenantUsageMeters> => {
    return apiRequest<TenantUsageMeters>('/tenants/current/usage');
  },

  getTenantById: async (id: string): Promise<any> => {
    return apiRequest(`/tenants/${id}`);
  },

  getTenantUsage: async (id: string): Promise<TenantUsageMeters> => {
    return apiRequest<TenantUsageMeters>(`/tenants/${id}/usage`);
  },

  getDatabaseUsage: async (): Promise<TenantDatabaseUsageResponse> => {
    return apiRequest<TenantDatabaseUsageResponse>('/tenants/database-usage');
  },

  measureDatabaseUsage: async (): Promise<TenantDatabaseUsageResponse> => {
    return apiRequest<TenantDatabaseUsageResponse>('/tenants/database-usage/measure', {
      method: 'POST',
    });
  },

  updateDatabaseProviderSettings: async (data: {
    providerName: string;
    planName: string;
    capacityBytes: number;
    storageCapacityBytes?: number;
    egressCapacityBytes?: number;
    invoiceAmountCents: number;
    paidAmountCents: number;
    currency: 'USD' | 'IQD';
    billingPeriodStart: string;
    billingPeriodEnd: string;
  }): Promise<any> => {
    return apiRequest('/tenants/database-provider-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  updateTenantDatabaseQuota: async (id: string, databaseQuotaBytes: number | null): Promise<any> => {
    return apiRequest(`/tenants/${id}/database-quota`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ databaseQuotaBytes }),
    });
  },

  createTenant: async (data: CreateTenantPayload): Promise<any> => {
    return apiRequest('/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  publicOnboarding: async (data: CreateTenantPayload): Promise<any> => {
    return apiRequest('/tenants/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  updateTenant: async (id: string, data: any): Promise<any> => {
    return apiRequest(`/tenants/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  suspendTenant: async (id: string, reason?: string): Promise<any> => {
    return apiRequest(`/tenants/${id}/suspend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
  },

  reactivateTenant: async (id: string): Promise<any> => {
    return apiRequest(`/tenants/${id}/reactivate`, {
      method: 'POST',
    });
  },

  deleteTenant: async (id: string): Promise<any> => {
    return apiRequest(`/tenants/${id}`, {
      method: 'DELETE',
    });
  },

  updateOwnerPermissions: async (id: string, payload: { customPermissions: string[]; allowedBranchIds?: string[] }): Promise<any> => {
    return apiRequest(`/tenants/${id}/owner-permissions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  impersonateTenantOwner: async (id: string): Promise<any> => {
    return apiRequest(`/tenants/${id}/impersonate`, {
      method: 'POST',
    });
  },
};
