import { apiRequest } from './client';

export interface SystemFeedback {
  id: string;
  tenantId?: string;
  companyId?: string;
  userId?: string;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  tenantName?: string;
  type: 'BUG' | 'FEEDBACK' | 'INQUIRY' | 'FEATURE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  screenshotUrl?: string;
  pageUrl?: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  adminReply?: string;
  resolvedAt?: string;
  resolvedById?: string;
  createdAt: string;
  updatedAt: string;
  tenant?: {
    id: string;
    name: string;
    slug: string;
    phone?: string;
  };
}

export interface CreateFeedbackPayload {
  title: string;
  description: string;
  type?: string;
  severity?: string;
  screenshotUrl?: string;
  pageUrl?: string;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  tenantName?: string;
}

export interface ResolveFeedbackPayload {
  adminReply: string;
  status?: string;
}

export const feedbackApi = {
  submitFeedback: async (payload: CreateFeedbackPayload): Promise<SystemFeedback> => {
    return apiRequest<SystemFeedback>('/feedback', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getMyFeedbacks: async (): Promise<SystemFeedback[]> => {
    return apiRequest<SystemFeedback[]>('/feedback/my/tickets');
  },

  getAllFeedbacks: async (params?: {
    status?: string;
    type?: string;
    severity?: string;
    search?: string;
  }): Promise<SystemFeedback[]> => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.type) query.append('type', params.type);
    if (params?.severity) query.append('severity', params.severity);
    if (params?.search) query.append('search', params.search);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiRequest<SystemFeedback[]>(`/feedback${qs}`);
  },

  getFeedbackById: async (id: string): Promise<SystemFeedback> => {
    return apiRequest<SystemFeedback>(`/feedback/${id}`);
  },

  resolveFeedback: async (id: string, payload: ResolveFeedbackPayload): Promise<SystemFeedback> => {
    return apiRequest<SystemFeedback>(`/feedback/${id}/resolve`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  updateStatus: async (id: string, status: string): Promise<SystemFeedback> => {
    return apiRequest<SystemFeedback>(`/feedback/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },

  deleteFeedback: async (id: string): Promise<SystemFeedback> => {
    return apiRequest<SystemFeedback>(`/feedback/${id}`, {
      method: 'DELETE',
    });
  },
};
