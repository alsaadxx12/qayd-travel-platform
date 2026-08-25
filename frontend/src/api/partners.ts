import { apiRequest } from './client';

export interface Customer {
  id: string;
  accountId?: string;
  source?: 'customer' | 'account';
  code: string;
  nameAr: string;
  nameEn: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  account?: { id: string; code: string; nameAr: string };
}

export interface Supplier {
  id: string;
  accountId?: string;
  source?: 'supplier' | 'account';
  code: string;
  nameAr: string;
  nameEn: string;
  isAirline: boolean;
  phone: string | null;
  email: string | null;
  address: string | null;
  account?: { id: string; code: string; nameAr: string };
}

export const partnersApi = {
  getCustomers: async (): Promise<Customer[]> => {
    return apiRequest('/partners/customers');
  },

  getSuppliers: async (): Promise<Supplier[]> => {
    return apiRequest('/partners/suppliers');
  },

  createCustomer: async (data: {
    code: string;
    nameAr: string;
    nameEn?: string;
    phone?: string;
    email?: string;
    address?: string;
  }): Promise<Customer> => {
    return apiRequest('/partners/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  createSupplier: async (data: {
    code: string;
    nameAr: string;
    nameEn?: string;
    isAirline?: boolean;
    phone?: string;
    email?: string;
    address?: string;
  }): Promise<Supplier> => {
    return apiRequest('/partners/suppliers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
