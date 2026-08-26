import { apiRequest, API_BASE_URL } from './client';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  imageBase64?: string;
}

export interface FinancialContext {
  adoptedRate: number;
  baghdadSell: number;
  baghdadBuy: number;
  northernSell: number;
  southernSell: number;
  currentMargin: number;
  isMarginSafe: boolean;
  tenantName: string;
  planName: string;
  planCode: string;
  currency: string;
}

export interface ChatResponse {
  reply: string;
  financialContext: FinancialContext;
  modelUsed: string;
  conversationId?: string;
  messageId?: string;
  uiBlocks?: any[];
  suggestions?: string[];
  toolsUsed?: string[];
}

export interface AiPageContextPayload {
  route?: string;
  entity?: string;
  recordId?: string;
  label?: string;
}

export interface AiConversationSummary {
  id: string;
  title: string;
  lastMessageAt: string;
  createdAt: string;
  isPinned?: boolean;
  messages?: Array<{ content: string; role: string }>;
}

export interface QuickPrompt {
  text: string;
  permission: string;
  icon: string;
}

export const aiAssistantApi = {
  sendMessage: async (
    messages: ChatMessage[],
    currentPage?: string,
    extras?: { conversationId?: string; page?: AiPageContextPayload; locale?: 'ar' | 'en' },
  ): Promise<ChatResponse> => {
    return apiRequest<ChatResponse>('/ai-assistant/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages,
        currentPage,
        conversationId: extras?.conversationId,
        page: extras?.page,
        locale: extras?.locale,
      }),
      timeoutMs: 60_000,
      noCache: true,
    });
  },

  getFinancialBrief: async (): Promise<FinancialContext> => {
    return apiRequest<FinancialContext>('/ai-assistant/financial-brief');
  },

  getQuickPrompts: async (): Promise<QuickPrompt[]> => {
    return apiRequest<QuickPrompt[]>('/ai-assistant/quick-prompts', { ttl: 60_000 });
  },

  listConversations: async (): Promise<AiConversationSummary[]> => {
    return apiRequest<AiConversationSummary[]>('/ai-assistant/conversations', { noCache: true });
  },

  createConversation: async (title?: string): Promise<{ id: string; title: string }> => {
    return apiRequest('/ai-assistant/conversations', {
      method: 'POST',
      body: JSON.stringify({ title }),
      noCache: true,
    });
  },

  getConversation: async (id: string) => {
    return apiRequest(`/ai-assistant/conversations/${id}`, { noCache: true });
  },

  deleteConversation: async (id: string) => {
    return apiRequest(`/ai-assistant/conversations/${id}`, { method: 'DELETE', noCache: true });
  },

  importConversation: async (payload: { title?: string; messages: ChatMessage[] }) => {
    return apiRequest('/ai-assistant/conversations/import', {
      method: 'POST',
      body: JSON.stringify(payload),
      noCache: true,
    });
  },

  sendFeedback: async (messageId: string, feedback: 'up' | 'down') => {
    return apiRequest(`/ai-assistant/messages/${messageId}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ feedback }),
      noCache: true,
    });
  },

  getBilling: async (live = false): Promise<AiBillingSnapshot> => {
    return apiRequest<AiBillingSnapshot>(`/ai-assistant/billing${live ? '?live=1' : ''}`, {
      noCache: true,
      timeoutMs: 20_000,
    });
  },

  setCreditGrant: async (grantUsd: number): Promise<AiBillingSnapshot> => {
    return apiRequest<AiBillingSnapshot>('/ai-assistant/billing/grant', {
      method: 'POST',
      body: JSON.stringify({ grantUsd }),
      noCache: true,
    });
  },
};

export interface AiBillingSnapshot {
  configured: boolean;
  connected: boolean;
  adminConfigured?: boolean;
  status: 'ok' | 'no_credits' | 'unconfigured' | 'error';
  model: string;
  provider: 'openai';
  source?: 'openai_admin' | 'manual' | 'unknown';
  allocatedUsd?: number;
  grantUsd: number;
  usedUsd: number;
  usedTodayUsd?: number;
  usedMonthUsd?: number;
  remainingUsd: number;
  usagePercent?: number;
  remainingKnown: boolean;
  costsLagging?: boolean;
  message: string;
  lastCheckedAt: string;
}

export { API_BASE_URL };
