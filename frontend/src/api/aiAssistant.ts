import { apiRequest } from './client';

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
}

export const aiAssistantApi = {
  sendMessage: async (messages: ChatMessage[], currentPage?: string): Promise<ChatResponse> => {
    return apiRequest<ChatResponse>('/ai-assistant/chat', {
      method: 'POST',
      body: JSON.stringify({ messages, currentPage }),
    });
  },

  getFinancialBrief: async (): Promise<FinancialContext> => {
    return apiRequest<FinancialContext>('/ai-assistant/financial-brief');
  },
};
