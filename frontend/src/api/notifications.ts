import { apiRequest } from './client';

export interface AppNotification {
  id: string;
  tenantId?: string;
  userId?: string;
  title: string;
  message: string;
  type: string; // FEEDBACK_RESOLVED, SYSTEM, ACCOUNTING, SUBSCRIPTION, ALERT
  severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'DANGER';
  link?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export const notificationsApi = {
  getMyNotifications: async (): Promise<AppNotification[]> => {
    return apiRequest<AppNotification[]>('/notifications');
  },

  getUnreadCount: async (): Promise<{ unreadCount: number }> => {
    return apiRequest<{ unreadCount: number }>('/notifications/unread-count');
  },

  markAsRead: async (id: string): Promise<AppNotification> => {
    return apiRequest<AppNotification>(`/notifications/${id}/read`, {
      method: 'PUT',
    });
  },

  markAllAsRead: async (): Promise<{ count: number }> => {
    return apiRequest<{ count: number }>('/notifications/read-all', {
      method: 'PUT',
    });
  },

  deleteNotification: async (id: string): Promise<AppNotification> => {
    return apiRequest<AppNotification>(`/notifications/${id}`, {
      method: 'DELETE',
    });
  },

  clearAll: async (): Promise<{ count: number }> => {
    return apiRequest<{ count: number }>('/notifications/clear/all', {
      method: 'DELETE',
    });
  },
};
