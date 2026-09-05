import { apiRequest } from './client';

/** ملف الكروب الكامل كما يعيده الخادم، مع ملخّصه المحسوب. */
export interface TourGroupSummary {
  seats: number; sold: number; remaining: number;
  passengers: number; complete: number; notComplete: number;
  sales: number; collected: number; outstanding: number;
  plannedCost: number; actualCost: number; buy: number; globalBuy: number; expenses: number;
  plannedProfit: number; actualProfit: number;
  beneficiariesCount?: number;
  unitBuyPrice?: number;
}

export interface GroupTemplateItem {
  id?: string; kind: string; supplierName?: string | null;
  supplierAccountId?: string | null; expectedBuy: number; currency?: string;
}
export interface GroupPriceSystem {
  id: string; name: string; seats: number; currency: string;
  salePrice: number; active: boolean; items: GroupTemplateItem[];
}
export interface GroupCharge {
  id: string; chargeType: 'GLOBAL_PURCHASE' | 'EXPENSE'; category: string;
  supplierName?: string | null; amount: number; currency: string; date: string; notes?: string | null;
}
export interface GroupPassengerService {
  id: string; kind: string; supplierName?: string | null; supplierAccountId?: string | null;
  expectedBuy: number; finalBuy: number | null; currency: string;
  status: 'NOT_COMPLETE' | 'COMPLETE'; completedAt?: string | null;
}
export interface GroupPassenger {
  id: string; priceSystemId?: string | null; customerName: string; passengerName: string;
  customerId?: string | null; customerAccountId?: string | null;
  passport?: string | null; agent?: string | null; salePrice: number; currency: string;
  payType: 'CASH' | 'CREDIT'; paymentMethod?: string | null; paymentAccountId?: string | null; collectedAmount: number;
  transferImage?: string | null;
  voucherNumber?: string | null; fCode?: string | null; state: string; notes?: string | null;
  services: GroupPassengerService[];
}
export interface TourGroup {
  id: string; groupName: string; groupType: string; country?: string | null;
  buyDate?: string | null; travelDate?: string | null; active: boolean; status: string;
  openSale: boolean; currency: string; exchangeRate: number; notes?: string | null;
  priceSystems: GroupPriceSystem[]; charges: GroupCharge[]; passengers: GroupPassenger[];
  summary: TourGroupSummary; createdAt?: string; createdById?: string | null; createdByName?: string;
}

const J = (b: any) => ({ headers: undefined, body: JSON.stringify(b) });

export const tourGroupsApi = {
  list: (): Promise<TourGroup[]> => apiRequest('/tour-groups', { noCache: true }),
  getOne: (id: string): Promise<TourGroup> => apiRequest(`/tour-groups/${id}`, { noCache: true }),
  create: (dto: Partial<TourGroup>): Promise<TourGroup> =>
    apiRequest('/tour-groups', { method: 'POST', ...J(dto) }),
  update: (id: string, dto: Partial<TourGroup>): Promise<TourGroup> =>
    apiRequest(`/tour-groups/${id}`, { method: 'PUT', ...J(dto) }),
  remove: (id: string): Promise<{ deleted: boolean }> =>
    apiRequest(`/tour-groups/${id}`, { method: 'DELETE' }),
  savePriceSystem: (groupId: string, dto: Partial<GroupPriceSystem>): Promise<TourGroup> =>
    apiRequest(`/tour-groups/${groupId}/price-systems`, { method: 'POST', ...J(dto) }),
  removePriceSystem: (groupId: string, psId: string): Promise<TourGroup> =>
    apiRequest(`/tour-groups/${groupId}/price-systems/${psId}`, { method: 'DELETE' }),
  addCharge: (groupId: string, dto: Partial<GroupCharge>): Promise<TourGroup> =>
    apiRequest(`/tour-groups/${groupId}/charges`, { method: 'POST', ...J(dto) }),
  removeCharge: (groupId: string, chargeId: string): Promise<TourGroup> =>
    apiRequest(`/tour-groups/${groupId}/charges/${chargeId}`, { method: 'DELETE' }),
  addPassenger: (groupId: string, dto: Partial<GroupPassenger>): Promise<TourGroup> =>
    apiRequest(`/tour-groups/${groupId}/passengers`, { method: 'POST', ...J(dto) }),
  updatePassenger: (groupId: string, paxId: string, dto: Partial<GroupPassenger>): Promise<TourGroup> =>
    apiRequest(`/tour-groups/${groupId}/passengers/${paxId}`, { method: 'PUT', ...J(dto) }),
  removePassenger: (groupId: string, paxId: string): Promise<TourGroup> =>
    apiRequest(`/tour-groups/${groupId}/passengers/${paxId}`, { method: 'DELETE' }),
  updateService: (groupId: string, serviceId: string, dto: Partial<GroupPassengerService> & { status?: string }): Promise<TourGroup> =>
    apiRequest(`/tour-groups/${groupId}/services/${serviceId}`, { method: 'PUT', ...J(dto) }),
};
