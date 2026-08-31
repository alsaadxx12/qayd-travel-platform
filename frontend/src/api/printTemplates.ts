import { apiRequest } from './client';

export interface PrintTemplateSavedItem {
  id: string;
  docType: string;
  name: string;
  config: any;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export async function fetchAllPrintTemplates() {
  return apiRequest<Record<string, any>>('/print-templates');
}

/**
 * `fresh: true` يتجاوز ذاكرة الواجهة كلياً.
 *
 * تُطلب عند فتح نافذة الطباعة وعند فتح شاشة الإعدادات: المستند الذي سيُطبع ورقاً
 * يجب أن يعكس آخر حفظ حتماً — ولو جرى الحفظ في تبويب متصفح آخر لا تصل إليه
 * عمليات إسقاط الذاكرة. طلبٌ إضافي واحد عند فتح النافذة ثمن زهيد لصحّة مطبوعة.
 */
export async function fetchPrintTemplate(docType: string, opts?: { fresh?: boolean }) {
  return apiRequest<{ id?: string; name?: string; docType: string; isDefault?: boolean; config: any }>(
    `/print-templates/${docType}`,
    opts?.fresh ? ({ noCache: true } as any) : undefined
  );
}

export async function fetchTemplatesForDocType(docType: string) {
  return apiRequest<PrintTemplateSavedItem[]>(`/print-templates/doc/${docType}`);
}

export async function createPrintTemplate(
  docType: string,
  name: string,
  config: any,
  isDefault: boolean = false
) {
  return apiRequest<{ success: boolean; id: string; name: string; isDefault: boolean; message: string }>(
    '/print-templates',
    {
      method: 'POST',
      body: JSON.stringify({ docType, name, config, isDefault }),
    }
  );
}

export async function updatePrintTemplate(
  id: string,
  name?: string,
  config?: any,
  isDefault?: boolean
) {
  return apiRequest<{ success: boolean; id: string; name: string; isDefault: boolean; message: string }>(
    `/print-templates/${id}`,
    {
      method: 'PUT',
      body: JSON.stringify({ name, config, isDefault }),
    }
  );
}

export async function setDefaultPrintTemplate(id: string) {
  return apiRequest<{ success: boolean; id: string; name: string; isDefault: boolean; message: string }>(
    `/print-templates/${id}/set-default`,
    {
      method: 'POST',
    }
  );
}

export async function deletePrintTemplate(id: string) {
  return apiRequest<{ success: boolean; message: string }>(`/print-templates/${id}`, {
    method: 'DELETE',
  });
}

export async function savePrintTemplate(docType: string, config: any, name?: string) {
  return apiRequest<{ success: boolean; docType: string; message: string }>(`/print-templates/${docType}`, {
    method: 'POST',
    body: JSON.stringify({ config, name }),
  });
}

