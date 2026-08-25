import { apiRequest } from './client';

export interface AirlineItem {
  id: string;
  code?: string;
  nameAr: string;
  nameEn?: string;
  logo?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const airlinesApi = {
  getAll: async (): Promise<AirlineItem[]> => {
    return apiRequest('/airlines');
  },

  getOne: async (id: string): Promise<AirlineItem> => {
    return apiRequest(`/airlines/${id}`);
  },

  create: async (data: { nameAr: string; code?: string; logo?: string; nameEn?: string }): Promise<AirlineItem> => {
    return apiRequest('/airlines', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: string, data: { nameAr?: string; code?: string; logo?: string; nameEn?: string }): Promise<AirlineItem> => {
    return apiRequest(`/airlines/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string): Promise<void> => {
    return apiRequest(`/airlines/${id}`, {
      method: 'DELETE',
    });
  },
};
