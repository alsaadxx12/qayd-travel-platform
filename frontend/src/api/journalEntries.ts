import { apiRequest } from './client';

export interface JournalEntryLinePayload {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
  partnerId?: string;
}

export interface CreateJournalEntryPayload {
  date: string;
  description: string;
  reference?: string;
  branchId?: string;
  currency?: string;
  exchangeRate?: number;
  lines: JournalEntryLinePayload[];
}

export const journalEntriesApi = {
  create: async (payload: CreateJournalEntryPayload): Promise<any> => {
    return apiRequest('/journal-entries', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getAll: async (): Promise<any[]> => {
    return apiRequest('/journal-entries?limit=150');
  },

  getByAccountId: async (accountId: string): Promise<any[]> => {
    return apiRequest(`/journal-entries?accountId=${encodeURIComponent(accountId)}`);
  },

  update: async (
    id: string,
    payload: {
      description?: string;
      date?: string;
      reference?: string;
      lines?: JournalEntryLinePayload[];
    }
  ): Promise<any> => {
    return apiRequest(`/journal-entries/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  delete: async (id: string): Promise<any> => {
    return apiRequest(`/journal-entries/${id}`, {
      method: 'DELETE',
    });
  },
};
