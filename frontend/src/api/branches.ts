import { apiRequest } from './client';

export interface Branch {
  id: string;
  code: string;
  name?: string;
  nameAr: string;
  nameEn?: string;
  currency?: string;
  city: string;
  address?: string;
  phone?: string;
  phone2?: string;
  email?: string;
  email2?: string;
  logo?: string;
  managerName?: string;
  whatsapp?: string;
  facebook?: string;
  instagram?: string;
  telegram?: string;
  website?: string;
  isMain: boolean;
  status: string;
}

export const branchesApi = {
  getAll: async (): Promise<Branch[]> => {
    return apiRequest('/branches');
  },

  getLoginOptions: async (): Promise<Branch[]> => {
    return apiRequest('/branches/login-options', {
      noCache: true,
      skipBranchContext: true,
    });
  },

  getOne: async (id: string): Promise<Branch> => {
    return apiRequest(`/branches/${id}`);
  },

  create: async (data: Partial<Branch>): Promise<Branch> => {
    return apiRequest('/branches', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: string, data: Partial<Branch>): Promise<Branch> => {
    return apiRequest(`/branches/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string): Promise<void> => {
    return apiRequest(`/branches/${id}`, {
      method: 'DELETE',
    });
  },

  uploadLogo: async (fileName: string, fileBase64: string): Promise<{ url: string }> => {
    return apiRequest('/branches/upload-logo', {
      method: 'POST',
      body: JSON.stringify({ fileName, fileBase64 }),
    });
  },
};
