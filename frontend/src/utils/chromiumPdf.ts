import { API_BASE_URL } from '../api/client';

/** CSS properties that break Arabic joining / RTL or lock layout when flattened. */
const SKIP_STYLE_PROPS = new Set([
  'letter-spacing',
  'word-spacing',
  'unicode-bidi',
  'writing-mode',
  'text-orientation',
  'text-rendering',
  'font-kerning',
  'font-variant',
  'font-variant-ligatures',
  'font-variant-caps',
  'font-variant-numeric',
  'font-variant-east-asian',
  'font-feature-settings',
  'font-variation-settings',
  'font-synthesis',
  'font-optical-sizing',
  'direction',
  'zoom',
  'text-spacing-trim',
  'hanging-punctuation',
  'height',
  'max-height',
  'block-size',
  'max-block-size',
  'line-height',
  'overflow',
  'overflow-x',
  'overflow-y',
  'transform',
]);

function capFontWeight(value: string): string {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) {
    if (value === 'black' || value === 'bolder') return '700';
    return value;
  }
  return n > 700 ? '700' : String(n);
}

function isReplacedElement(el: HTMLElement): boolean {
  const tag = el.tagName;
  return tag === 'IMG' || tag === 'SVG' || tag === 'CANVAS' || tag === 'VIDEO';
}

/**
 * Inline computed styles so Chromium on the server can print without the Vite CSS bundle.
 * Arabic-unsafe properties are stripped so HarfBuzz can join letters.
 * Height/line-height are not copied: locked pixel heights from the browser
 * cause rows to overlap when the PDF font metrics differ.
 */
export function serializeElementForChromium(element: HTMLElement): string {
  const clone = element.cloneNode(true) as HTMLElement;

  const copyStyles = (from: Element, to: Element) => {
    if (!(from instanceof HTMLElement) || !(to instanceof HTMLElement)) return;
    const computed = window.getComputedStyle(from);
    const replaced = isReplacedElement(from);
    const parts: string[] = [];
    for (let i = 0; i < computed.length; i++) {
      const prop = computed[i];
      if (!prop || SKIP_STYLE_PROPS.has(prop)) continue;
      if (prop.startsWith('--')) continue;
      parts.push(`${prop}:${computed.getPropertyValue(prop)}`);
    }

    if (replaced) {
      const h = computed.getPropertyValue('height');
      const w = computed.getPropertyValue('width');
      if (h) parts.push(`height:${h}`);
      if (w) parts.push(`width:${w}`);
    }

    const dirAttr = from.getAttribute('dir') || to.getAttribute('dir');
    if (dirAttr === 'ltr') {
      parts.push('direction:ltr', 'unicode-bidi:isolate');
    } else if (dirAttr === 'rtl') {
      parts.push('direction:rtl', 'unicode-bidi:normal');
    }

    parts.push(
      'letter-spacing:0',
      'word-spacing:0',
      'font-kerning:none',
      'font-variant-ligatures:common-ligatures',
      'font-synthesis:none',
      'text-rendering:optimizeLegibility',
      'line-height:1.55',
      'overflow:visible',
      `font-weight:${capFontWeight(computed.getPropertyValue('font-weight') || '400')}`,
      "font-family:'IBM Plex Sans Arabic','Tajawal','Cairo',sans-serif",
    );

    /**
     * ما كتبه المكوّن في style بيده يبقى — فهو قصدٌ لا أثرَ متصفح.
     *
     * القائمة أعلاه تحذف transform و height المحسوبتين لأن قيمهما المتجمدة من
     * المتصفح تكسر تخطيط الورقة على خادم الطباعة. لكن الحذف كان يطال قيم المؤلف
     * نفسها: دوران «نسخة رسمية» وإزاحتها inline transform، وفراغ التوقيع ومربع
     * الختم inline height — فتخرج الـPDF بعلامة مائية أفقية في المنتصف وتواقيع
     * بلا مساحة. فتُعاد التصريحات المكتوبة inline آخراً لتغلب ما قبلها.
     */
    const inline = (from as HTMLElement).style;
    for (let i = 0; i < inline.length; i++) {
      const prop = inline[i];
      if (!prop || prop.startsWith('--')) continue;
      parts.push(`${prop}:${inline.getPropertyValue(prop)}`);
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
  clone.style.height = 'auto';
  clone.style.minHeight = '297mm';
  clone.style.margin = '0';
  clone.style.boxShadow = 'none';
  clone.style.opacity = '1';
  clone.style.position = 'relative';
  clone.style.left = '0';
  clone.style.top = '0';
  clone.style.overflow = 'visible';
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
