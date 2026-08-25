import { apiRequest } from './client';
import { AccountNode } from '../components/common/AccountingTreeGrid';

export interface CreateAccountPayload {
  code: string;
  nameAr: string;
  nameEn?: string;
  type: string;
  category?: string;
  parentId?: string;
  currency?: string;
  branchScope?: string;
  branchIds?: string[];
  phone?: string;
  email?: string;
  address?: string;
  contactPerson?: string;
  creditLimit?: number;
  creditLimitUSD?: number;
  paymentDays?: number;
  paymentMode?: string;
  overduePolicy?: string;
  openingAmountIQD?: number;
  openingAmountUSD?: number;
  openingNature?: string;
  openingDate?: string;
  openingNotes?: string;
}

export interface UpdateAccountPayload {
  code?: string;
  nameAr?: string;
  nameEn?: string;
  type?: string;
  category?: string;
  parentId?: string;
  currency?: string;
  branchScope?: string;
  branchIds?: string[];
  phone?: string;
  email?: string;
  address?: string;
  contactPerson?: string;
  creditLimit?: number;
  creditLimitUSD?: number;
  paymentDays?: number;
  paymentMode?: string;
  overduePolicy?: string;
  openingAmountIQD?: number;
  openingAmountUSD?: number;
  openingNature?: string;
  openingDate?: string;
  openingNotes?: string;
}

export const accountsApi = {
  getTree: async (): Promise<AccountNode[]> => {
    const rawData = await apiRequest('/accounts/tree');
    return mapAccountsToNodes(rawData);
  },

  getFlat: async (type?: string, category?: string): Promise<AccountNode[]> => {
    const query = new URLSearchParams();
    if (type) query.append('type', type);
    if (category) query.append('category', category);
    const endpoint = `/accounts${query.toString() ? `?${query.toString()}` : ''}`;
    const rawData = await apiRequest(endpoint);
    return mapAccountsToNodes(rawData);
  },

  getById: async (id: string): Promise<any> => {
    return apiRequest(`/accounts/${id}`);
  },

  create: async (payload: CreateAccountPayload): Promise<any> => {
    return apiRequest('/accounts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  update: async (id: string, payload: UpdateAccountPayload): Promise<any> => {
    return apiRequest(`/accounts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  delete: async (id: string): Promise<any> => {
    return apiRequest(`/accounts/${id}`, {
      method: 'DELETE',
    });
  },

  importTree: async (accounts: any[], wipeExisting: boolean = true): Promise<any> => {
    return apiRequest('/accounts/import-tree', {
      method: 'POST',
      body: JSON.stringify({ accounts, wipeExisting }),
      timeoutMs: 120000,
    });
  },

  wipeAll: async (): Promise<any> => {
    return apiRequest('/accounts/wipe-all', {
      method: 'DELETE',
    });
  },
};

function mapAccountsToNodes(rawList: any[]): AccountNode[] {
  if (!Array.isArray(rawList)) return [];

  const mapTypeToArabic = (type: string) => {
    switch (type) {
      case 'ASSET': return 'أصول';
      case 'LIABILITY': return 'التزامات';
      case 'EQUITY': return 'حقوق الملكية';
      case 'REVENUE': return 'إيرادات';
      case 'EXPENSE': return 'تكاليف الخدمات';
      default: return type;
    }
  };

  const mapNature = (type: string): 'DEBIT' | 'CREDIT' => {
    return (type === 'ASSET' || type === 'EXPENSE') ? 'DEBIT' : 'CREDIT';
  };

  return rawList.map((item) => ({
    id: item.id,
    code: item.code,
    nameAr: item.nameAr,
    nameEn: item.nameEn || '',
    type: mapTypeToArabic(item.type),
    nature: mapNature(item.type),
    parentId: item.parentId || undefined,
    level: item.level || 1,
    isGroup: item.isParent || (item.children && item.children.length > 0) || false,
    scope: item.branchScope || 'ALL_BRANCHES',
    currency: item.currency || 'IQD',
    branchIds: item.branchIds || [],
    openingAmountIQD: Number(item.openingAmountIQD || 0),
    openingAmountUSD: Number(item.openingAmountUSD || 0),
    openingBalance: Number(item.openingBalance || 0),
    openingNature: item.openingNature || 'BOTH',
    openingDate: item.openingDate || null,
    openingNotes: item.openingNotes || '',
    debitIQD: Number(item.debitIQD || item.debit || 0),
    creditIQD: Number(item.creditIQD || item.credit || 0),
    balanceIQD: Number(item.balanceIQD || item.balance || 0),
    debitUSD: Number(item.debitUSD || 0),
    creditUSD: Number(item.creditUSD || 0),
    balanceUSD: Number(item.balanceUSD || 0),
    debit: Number(item.debit || 0),
    credit: Number(item.credit || 0),
    balance: Number(item.balance || 0),
    status: 'نشط',
    category: item.category,
    accountRole: item.accountRole,
    isBlocked: item.isBlocked,
    customer: item.customer,
    supplier: item.supplier,
    phone: item.phone || item.customer?.phone || item.supplier?.phone || '',
    email: item.email || item.customer?.email || item.supplier?.email || '',
    address: item.address || item.customer?.address || item.supplier?.address || '',
    contactPerson: item.contactPerson || item.customer?.contactPerson || item.supplier?.contactPerson || '',
    creditLimit: item.creditLimit !== null && item.creditLimit !== undefined ? Number(item.creditLimit) : 0,
    creditLimitUSD: item.creditLimitUSD !== null && item.creditLimitUSD !== undefined ? Number(item.creditLimitUSD) : 0,
    paymentDays: item.paymentDays !== null && item.paymentDays !== undefined ? Number(item.paymentDays) : 0,
    paymentMode: item.paymentMode || 'CASH_ONLY',
    overduePolicy: item.overduePolicy || 'BLOCK',
    children: item.children ? mapAccountsToNodes(item.children) : [],
  }));
}
