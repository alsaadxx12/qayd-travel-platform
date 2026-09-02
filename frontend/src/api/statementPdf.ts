import { API_BASE_URL } from './client';

interface StatementPdfRow {
  rowNumber?: number;
  date?: string;
  docRef?: string;
  /** رقم الفاتورة أو السند، وله عمود مستقل في الكشف المطبوع. */
  docNumber?: string;
  pnr?: string;
  route?: string;
  airline?: string;
  statement?: string;
  docLabel?: string;
  typeCode?: string;
  debit?: number;
  credit?: number;
  runningBalance?: number;
  currency?: string;
  passengersDetail?: Array<{ name?: string; ticketType?: string; ticketNumber?: string }>;
}

export interface StatementPdfPayload {
  accountId?: string;
  accountName: string;
  accountCode?: string;
  accountPhone?: string;
  accountEmail?: string;
  accountAddress?: string;
  startDate: string;
  endDate: string;
  rows: StatementPdfRow[];
  totals: {
    totalDebit: number;
    totalCredit: number;
    finalBalance: number;
    openingBalance?: number;
    previousBalance?: number;
  };
  lang?: 'ar' | 'en';
  /** Live print-template overrides (settings page). Server otherwise uses the saved DB template. */
  settings?: Record<string, unknown>;
}

function mapPassengerType(raw?: string): 'ADT' | 'CHD' | 'INF' {
  const u = (raw || '').toUpperCase();
  if (u === 'CHD' || u === 'CHILD') return 'CHD';
  if (u === 'INF' || u === 'INFANT') return 'INF';
  return 'ADT';
}

function formatDay(value?: string): string {
  if (!value) return '';
  const direct = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (direct) return `${direct[3]}/${direct[2]}/${direct[1]}`;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-GB');
}

function toServerRows(rows: StatementPdfRow[]) {
  return (rows || []).map((r, idx) => {
    const passengers = (Array.isArray(r.passengersDetail) ? r.passengersDetail : []).map((p) => {
      const type = mapPassengerType(p.ticketType);
      return {
        // رقم التذكرة يسافر مع الاسم: الكشف المطبوع مستندٌ يُراجَع.
        fullName: p.ticketNumber ? `${p.name || ''} (${p.ticketNumber})` : p.name || '',
        type,
        typeClass: type === 'INF' ? 'pax-type-inf' : type === 'CHD' ? 'pax-type-chd' : 'pax-type-adt',
        isChild: type !== 'ADT',
      };
    });
    return {
      rowNumber: r.rowNumber || idx + 1,
      date: formatDay(r.date),
      docRef: r.docRef || '',
      docNumber: r.docNumber || r.docRef || '',
      pnr: r.pnr || '',
      route: r.route || '',
      airline: r.airline || '',
      statement: r.statement || r.docLabel || '',
      type: r.typeCode || undefined,
      debit: Number(r.debit || 0),
      credit: Number(r.credit || 0),
      runningBalance: Number(r.runningBalance || 0),
      currency: r.currency,
      passengers,
    };
  });
}

async function isPdfBlob(blob: Blob): Promise<boolean> {
  const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
  return String.fromCharCode(...head) === '%PDF-';
}

function filenameFromHeader(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const utf = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf?.[1]) {
    try {
      return decodeURIComponent(utf[1]);
    } catch {
      /* keep fallback */
    }
  }
  const ascii = header.match(/filename="?([^";]+)"?/i);
  return ascii?.[1] || fallback;
}

/**
 * Official statement PDF via Chromium on the server (vector text, not a screenshot).
 */
export async function generateStatementPdf(
  payload: StatementPdfPayload,
): Promise<{ blob: Blob; filename: string }> {
  const token = localStorage.getItem('token');
  const branchId =
    localStorage.getItem('active_branch_id') || localStorage.getItem('activeBranchId') || '';
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 90_000);

  try {
    const res = await fetch(`${API_BASE_URL}/pdf/statement`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(branchId ? { 'x-branch-id': branchId } : {}),
      },
      body: JSON.stringify({
        accountId: payload.accountId,
        accountName: payload.accountName,
        accountCode: payload.accountCode,
        accountPhone: payload.accountPhone,
        accountEmail: payload.accountEmail,
        accountAddress: payload.accountAddress,
        startDate: payload.startDate,
        endDate: payload.endDate,
        lang: payload.lang || 'ar',
        rows: toServerRows(payload.rows),
        totals: payload.totals,
        ...(payload.settings ? { settings: payload.settings } : {}),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      let message = 'تعذر توليد كشف PDF عبر الخادم';
      try {
        const err = await res.json();
        if (err?.message) message = Array.isArray(err.message) ? err.message.join(' | ') : err.message;
      } catch {
        /* keep default */
      }
      throw new Error(message);
    }

    const blob = await res.blob();
    if (!(await isPdfBlob(blob))) {
      throw new Error('الخادم لم يُرجع ملف PDF صالحاً');
    }

    const filename = filenameFromHeader(
      res.headers.get('Content-Disposition'),
      `statement_${payload.accountCode || 'report'}.pdf`,
    );
    return { blob, filename };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('انتهت مهلة توليد كشف PDF. أعد المحاولة.');
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function downloadStatementPdf(payload: StatementPdfPayload): Promise<void> {
  const { blob, filename } = await generateStatementPdf(payload);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function statementPdfToBase64(payload: StatementPdfPayload): Promise<string> {
  const { blob } = await generateStatementPdf(payload);
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
