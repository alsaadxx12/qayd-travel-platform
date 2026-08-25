import { apiRequest } from './client';

export interface DepartmentData {
  id: string;
  branchId?: string;
  branchName: string;
  code: string;
  name: string;
  headName?: string;
  description?: string;
  companyId?: string;
  createdAt?: string;
  updatedAt?: string;
  branch?: { id: string; code: string; nameAr: string } | null;
}

export const departmentsApi = {
  getAll: (): Promise<DepartmentData[]> =>
    apiRequest('/departments'),

  getOne: (id: string): Promise<DepartmentData> =>
    apiRequest(`/departments/${id}`),

  create: (data: Omit<DepartmentData, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>): Promise<DepartmentData> =>
    apiRequest('/departments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<DepartmentData>): Promise<DepartmentData> =>
    apiRequest(`/departments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string): Promise<void> =>
    apiRequest(`/departments/${id}`, {
      method: 'DELETE',
    }),
};
