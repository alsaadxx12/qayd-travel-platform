import { apiRequest } from './client';

export interface PlanFeatureItem {
  id: string;
  featureCode: string;
  nameAr: string;
  nameEn?: string;
  category: string;
  isEnabled: boolean;
}

export interface PlanLimitItem {
  id: string;
  limitCode: string;
  nameAr: string;
  limitValue: number; // -1 = Unlimited
  unit?: string;
}

export interface PublicPlan {
  id: string;
  code: 'FREE_TRIAL' | 'BASIC' | 'PRO' | 'ENTERPRISE';
  nameAr: string;
  nameEn?: string;
  description?: string;
  sortOrder: number;
  versionId: string;
  priceMonthly: number;
  priceMonthlyCents: number;
  currency: string;
  isRecommended: boolean;
  features: PlanFeatureItem[];
  limits: PlanLimitItem[];
}

export interface AdminPlanVersion {
  id: string;
  versionNumber: number;
  priceMonthlyCents: number;
  currency: string;
  isRecommended: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  isActive: boolean;
  features: PlanFeatureItem[];
  limits: PlanLimitItem[];
  _count?: { subscriptions: number };
}

export interface AdminPlan {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  versions: AdminPlanVersion[];
}

export interface TenantSubscriptionDetails {
  id: string;
  tenantId: string;
  status: 'TRIAL' | 'ACTIVE' | 'GRACE_PERIOD' | 'PAST_DUE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED';
  billingCycle: 'MONTHLY' | 'YEARLY';
  lockedPriceCents: number;
  currency: string;
  startedAt: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  gracePeriodEnd?: string;
  cancellationReason?: string;
  planVersion: {
    id: string;
    versionNumber: number;
    priceMonthlyCents: number;
    currency: string;
    plan: {
      id: string;
      code: string;
      nameAr: string;
      nameEn?: string;
      description?: string;
    };
    features: PlanFeatureItem[];
    limits: PlanLimitItem[];
  };
  payments: Array<{
    id: string;
    amountCents: number;
    currency: string;
    status: string;
    paymentMethod: string;
    transactionRef?: string;
    notes?: string;
    paidAt: string;
  }>;
  events: Array<{
    id: string;
    eventType: string;
    details?: string;
    createdAt: string;
  }>;
}

export const subscriptionsApi = {
  getPublicPlans: async (): Promise<PublicPlan[]> => {
    return apiRequest<PublicPlan[]>('/subscriptions/plans');
  },

  getAllPlansAdmin: async (): Promise<AdminPlan[]> => {
    return apiRequest<AdminPlan[]>('/subscriptions/admin/plans');
  },

  updatePlan: async (planId: string, data: any): Promise<{ success: boolean; newVersionId?: string }> => {
    return apiRequest<{ success: boolean; newVersionId?: string }>(`/subscriptions/admin/plans/${planId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  togglePlanFeature: async (planId: string, featureCode: string, isEnabled: boolean): Promise<any> => {
    return apiRequest(`/subscriptions/admin/plans/${planId}/features/${featureCode}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isEnabled }),
    });
  },

  getTenantSubscription: async (tenantId: string): Promise<TenantSubscriptionDetails> => {
    return apiRequest<TenantSubscriptionDetails>(`/subscriptions/tenant/${tenantId}`);
  },

  changePlan: async (tenantId: string, planCode: string): Promise<any> => {
    return apiRequest(`/subscriptions/tenant/${tenantId}/change-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planCode }),
    });
  },

  createFeature: async (data: { featureCode: string; nameAr: string; category: string; defaultEnabled?: boolean }): Promise<any> => {
    return apiRequest('/subscriptions/admin/features', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  updateFeature: async (featureCode: string, data: { nameAr?: string; category?: string }): Promise<any> => {
    return apiRequest(`/subscriptions/admin/features/${featureCode}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  deleteFeature: async (featureCode: string): Promise<any> => {
    return apiRequest(`/subscriptions/admin/features/${featureCode}`, {
      method: 'DELETE',
    });
  },

  renewSubscription: async (
    tenantId: string,
    data: { amountCents: number; monthsToAdd?: number; paymentMethod?: string; transactionRef?: string; notes?: string }
  ): Promise<any> => {
    return apiRequest(`/subscriptions/tenant/${tenantId}/renew`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  suspendSubscription: async (tenantId: string, reason?: string): Promise<any> => {
    return apiRequest(`/subscriptions/tenant/${tenantId}/suspend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
  },

  getAllSubscriptionsHistory: async (): Promise<any[]> => {
    return apiRequest<any[]>('/subscriptions/admin/subscriptions-history');
  },

  updatePayment: async (id: string, data: any): Promise<any> => {
    return apiRequest(`/subscriptions/admin/payments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  cancelPayment: async (id: string, reason?: string): Promise<any> => {
    return apiRequest(`/subscriptions/admin/payments/${id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
  },

  deletePayment: async (id: string): Promise<any> => {
    return apiRequest(`/subscriptions/admin/payments/${id}`, {
      method: 'DELETE',
    });
  },

  createManualPayment: async (data: any): Promise<any> => {
    return apiRequest('/subscriptions/admin/payments/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  getPaymentMethods: async (): Promise<any> => {
    return apiRequest<any>('/subscriptions/payment-methods');
  },

  updatePaymentMethods: async (methods: any): Promise<any> => {
    return apiRequest('/subscriptions/admin/payment-methods', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(methods),
    });
  },

  submitCheckout: async (data: {
    planCode: string;
    amountCents: number;
    paymentMethod: string;
    transactionRef?: string;
    notes?: string;
    receiptUrls?: string[];
  }): Promise<any> => {
    return apiRequest('/subscriptions/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  getPendingRenewals: async (): Promise<any[]> => {
    return apiRequest<any[]>('/subscriptions/admin/pending-renewals');
  },

  approveRenewal: async (paymentId: string): Promise<any> => {
    return apiRequest(`/subscriptions/admin/approve-renewal/${paymentId}`, {
      method: 'POST',
    });
  },

  rejectRenewal: async (paymentId: string, reason?: string): Promise<any> => {
    return apiRequest(`/subscriptions/admin/reject-renewal/${paymentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
  },

  reactivateSubscription: async (tenantId: string): Promise<any> => {
    return apiRequest(`/subscriptions/tenant/${tenantId}/reactivate`, {
      method: 'POST',
    });
  },
};
