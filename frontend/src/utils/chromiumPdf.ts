import { API_BASE_URL } from '../api/client';

/**
 * Inline computed styles so Chromium on the server can print without the Vite CSS bundle.
 */
export function serializeElementForChromium(element: HTMLElement): string {
  const clone = element.cloneNode(true) as HTMLElement;

  const copyStyles = (from: Element, to: Element) => {
    if (!(from instanceof HTMLElement) || !(to instanceof HTMLElement)) return;
    const computed = window.getComputedStyle(from);
    const parts: string[] = [];
    for (let i = 0; i < computed.length; i++) {
      const prop = computed[i];
      if (!prop) continue;
      parts.push(`${prop}:${computed.getPropertyValue(prop)}`);
    }
    to.setAttribute('style', parts.join(';'));
    to.removeAttribute('class');
    const fromKids = from.children;
    const toKids = to.children;
    for (let i = 0; i < fromKids.length; i++) {
      copyStyles(fromKids[i], toKids[i]);
    }
  };

  copyStyles(element, clone);
  clone.style.width = '210mm';
  clone.style.maxWidth = '210mm';
  clone.style.minHeight = 'auto';
  clone.style.margin = '0';
  clone.style.boxShadow = 'none';
  clone.style.opacity = '1';
  clone.style.position = 'relative';
  clone.style.left = '0';
  clone.style.top = '0';
  return clone.outerHTML;
}

export async function generateChromiumPdf(options: {
  html: string;
  lang?: 'ar' | 'en';
  filename?: string;
}): Promise<{ blob: Blob; base64: string; filename: string }> {
  const token = localStorage.getItem('token');
  const branchId =
    localStorage.getItem('active_branch_id') || localStorage.getItem('activeBranchId') || '';
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 90_000);

  try {
    const res = await fetch(`${API_BASE_URL}/pdf/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(branchId ? { 'x-branch-id': branchId } : {}),
      },
      body: JSON.stringify({
        html: options.html,
        lang: options.lang || 'ar',
        format: 'A4',
        marginTop: '0mm',
        marginBottom: '0mm',
        marginLeft: '0mm',
        marginRight: '0mm',
        filename: options.filename,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      let message = 'تعذر توليد ملف PDF عبر محرك الطباعة';
      try {
        const err = await res.json();
        if (err?.message) message = Array.isArray(err.message) ? err.message.join(' | ') : err.message;
      } catch {
        /* keep default */
      }
      throw new Error(message);
    }

    const blob = await res.blob();
    const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
    if (String.fromCharCode(...head) !== '%PDF-') {
      throw new Error('الخادم لم يُرجع ملف PDF صالحاً');
    }

    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }

    return {
      blob,
      base64: btoa(binary),
      filename: options.filename || 'document.pdf',
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('انتهت مهلة توليد PDF. أعد المحاولة.');
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}
