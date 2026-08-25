import { apiRequest } from './client';

export interface Employee {
  id: string;
  branchId?: string;
  departmentId?: string;
  branchName: string;
  departmentName: string;
  fullName: string;
  jobTitle?: string;
  phone?: string;
  email?: string;
  assignedCashbox?: string;
  status: string;
  hasUserAccount?: boolean;
  username?: string;
  password?: string;
  permissionGroupId?: string;
  branch?: { id: string; code: string; nameAr: string } | null;
  department?: { id: string; code: string; name: string; branchId?: string } | null;
}

export const employeesApi = {
  getAll: async (): Promise<Employee[]> => {
    return apiRequest('/employees');
  },

  getOne: async (id: string): Promise<Employee> => {
    return apiRequest(`/employees/${id}`);
  },

  create: async (data: Partial<Employee>): Promise<Employee> => {
    return apiRequest('/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: string, data: Partial<Employee>): Promise<Employee> => {
    return apiRequest(`/employees/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string): Promise<void> => {
    return apiRequest(`/employees/${id}`, {
      method: 'DELETE',
    });
  },
};
