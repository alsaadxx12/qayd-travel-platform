import { apiRequest } from './client';

/*
 * بوابة واتساب السحابية (Meta WhatsApp Cloud API).
 * الأسرار لا تعود من الخادم إلا مقنَّعة؛ الحقل الفارغ عند الحفظ يعني «أبقِ المحفوظ».
 */

export interface WhatsAppSettingsView {
  configured: boolean;
  enabled: boolean;
  phoneNumberId: string;
  wabaId: string;
  hasAccessToken: boolean;
  accessTokenMasked: string;
  hasAppSecret: boolean;
  appSecretMasked: string;
  verifyToken: string;
  defaultCountryCode: string;
  testTemplateName: string;
  testTemplateLang: string;
  displayPhone?: string;
  verifiedName?: string;
  qualityRating?: string;
  lastCheckedAt?: string;
  updatedAt?: string;
  webhookPath: string;
  /** العنوان الجاهز للّصق عند Meta، على دومن الموقع. */
  webhookUrl: string;
  graphVersion: string;
}

export interface WhatsAppStatus {
  configured: boolean;
  ok: boolean;
  enabled?: boolean;
  displayPhone?: string;
  verifiedName?: string;
  qualityRating?: string;
  codeVerificationStatus?: string;
  nameStatus?: string;
  messagingLimitTier?: string;
  platformType?: string;
  wabaName?: string;
  accountReviewStatus?: string;
  wabaError?: string;
  checkedAt?: string;
  error?: string;
}

export interface SaveWhatsAppSettingsInput {
  enabled?: boolean;
  phoneNumberId?: string;
  wabaId?: string;
  accessToken?: string;
  appSecret?: string;
  verifyToken?: string;
  defaultCountryCode?: string;
  testTemplateName?: string;
  testTemplateLang?: string;
}

export interface WhatsAppSendResult {
  success: boolean;
  messageId: string;
  to: string;
}

const J = (body: unknown) => ({ body: JSON.stringify(body) });

export const whatsappApi = {
  getSettings: () => apiRequest<WhatsAppSettingsView>('/api/whatsapp/settings', { noCache: true }),
  saveSettings: (dto: SaveWhatsAppSettingsInput) => apiRequest<WhatsAppSettingsView>('/api/whatsapp/settings', { method: 'POST', ...J(dto) }),
  getStatus: () => apiRequest<WhatsAppStatus>('/api/whatsapp/status', { noCache: true, timeoutMs: 40_000 }),
  sendTest: (dto: { to: string; mode?: 'template' | 'text'; text?: string }) =>
    apiRequest<WhatsAppSendResult>('/api/whatsapp/test', { method: 'POST', timeoutMs: 40_000, ...J(dto) }),
  sendText: (dto: { to: string; text: string }) =>
    apiRequest<WhatsAppSendResult>('/api/whatsapp/send', { method: 'POST', timeoutMs: 40_000, ...J(dto) }),
  sendStatement: (dto: {
    to: string;
    accountName: string;
    accountCode?: string;
    fromDate?: string;
    toDate?: string;
    caption?: string;
    pdfBase64?: string;
    fileName?: string;
  }) => apiRequest<WhatsAppSendResult>('/api/whatsapp/send-statement', { method: 'POST', timeoutMs: 90_000, ...J(dto) }),
};
