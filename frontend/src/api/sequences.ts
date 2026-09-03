import { apiRequest } from './client';

export interface DocumentSequence {
  id: string;
  docType: string;
  prefix: string;
  branchCode: string;
  includeYear: boolean;
  year: number | null;
  nextNumber: number;
  padding: number;
  separator: string;
}

/**
 * ترقيم المستندات من الخادم.
 *
 * كان العدّاد في localStorage، أي عدّادٌ مستقلّ في كل متصفّح: يبدأ موظفان من
 * الرقم نفسه فيحفظ أحدهما ويفشل الآخر على قيد التفرّد، ومسحُ بيانات المتصفّح
 * يعيد الترقيم إلى أوّله فيصطدم بما هو محفوظ. والعدّاد الآن صفٌّ واحد في
 * القاعدة يُزاد ويُقرأ في عبارة SQL واحدة، فلا يأخذ اثنان رقماً واحداً.
 */
export const sequencesApi = {
  list: (branchCode?: string): Promise<DocumentSequence[]> =>
    apiRequest(`/sequences${branchCode ? `?branchCode=${encodeURIComponent(branchCode)}` : ''}`, { noCache: true }),

  save: (configs: Partial<DocumentSequence>[]): Promise<DocumentSequence[]> =>
    apiRequest('/sequences', { method: 'PUT', body: JSON.stringify({ configs }) }),

  /** معاينة الرقم المتوقّع بلا حجزه — للعرض عند فتح النافذة. */
  peek: (docType: string, branchCode?: string): Promise<{ docType: string; number: string }> =>
    apiRequest(`/sequences/${encodeURIComponent(docType)}/peek${branchCode ? `?branchCode=${encodeURIComponent(branchCode)}` : ''}`, { noCache: true }),

  next: (docType: string, branchCode?: string): Promise<{ docType: string; number: string }> =>
    apiRequest(`/sequences/${encodeURIComponent(docType)}/next`, {
      method: 'POST',
      body: JSON.stringify({ branchCode: branchCode || '' }),
    }),
};
