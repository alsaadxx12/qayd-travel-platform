import { apiRequest } from './client';

export interface RoleGroup {
  id: string;
  name: string;
  description?: string;
  permissions: string; // JSON stringified array
  allowedBranches?: string;
  companyId: string;
  createdAt?: string;
  updatedAt?: string;
  _count?: { users: number; employees: number };
}

export const rolesApi = {
  getAll: async (): Promise<RoleGroup[]> => {
    return apiRequest('/roles');
  },

  getOne: async (id: string): Promise<RoleGroup> => {
    return apiRequest(`/roles/${id}`);
  },

  create: async (data: Partial<RoleGroup>): Promise<RoleGroup> => {
    return apiRequest('/roles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: string, data: Partial<RoleGroup>): Promise<RoleGroup> => {
    return apiRequest(`/roles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string): Promise<void> => {
    return apiRequest(`/roles/${id}`, {
      method: 'DELETE',
    });
  },
};
