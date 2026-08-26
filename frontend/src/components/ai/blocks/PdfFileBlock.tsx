import React, { useState } from 'react';
import { IconDownload, IconFileTypePdf } from '@tabler/icons-react';
import { CopilotCardShell, formatMoney } from './blockUtils.tsx';
import { API_BASE_URL } from '../../../api/client';

async function downloadStatementPdf(artifactId: string, filename: string) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE_URL}/ai-assistant/statement-pdf/${encodeURIComponent(artifactId)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error('تعذر تنزيل الملف. أعد توليد الكشف.');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'statement.pdf';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export const PdfFileBlock: React.FC<{ payload: any }> = ({ payload }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDownload = async () => {
    if (!payload?.artifactId) return;
    setBusy(true);
    setError(null);
    try {
      await downloadStatementPdf(payload.artifactId, payload.filename);
    } catch (err: any) {
      setError(err?.message || 'تعذر التنزيل');
    } finally {
      setBusy(false);
    }
  };

  const sizeKb = payload?.sizeBytes ? Math.max(1, Math.round(Number(payload.sizeBytes) / 1024)) : null;

  return (
    <CopilotCardShell>
      <div className="px-3 py-2.5 flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-orange-50 text-[#F45A0A] flex items-center justify-center shrink-0">
          <IconFileTypePdf size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold text-slate-800">كشف حساب PDF</div>
          <div className="text-[12px] text-slate-600 truncate">{payload.accountName}</div>
          <div className="text-[11px] text-slate-500 mt-0.5 font-mono tabular-nums">
            {payload.period}
            {payload.closingBalance != null ? ` · ${formatMoney(payload.closingBalance)}` : ''}
            {sizeKb ? ` · ${sizeKb.toLocaleString('en-US')} KB` : ''}
          </div>
          {payload.emailedTo ? (
            <div className="text-[11px] text-emerald-700 mt-1" dir="ltr">
              أُرسل إلى {payload.emailedTo}
            </div>
          ) : null}
          {error ? <div className="text-[11px] text-red-600 mt-1">{error}</div> : null}
        </div>
        <button
          type="button"
          onClick={onDownload}
          disabled={busy || !payload?.artifactId}
          className="shrink-0 h-[38px] px-3 rounded-lg bg-[#F45A0A] text-white text-[12px] font-bold hover:bg-[#DD4F05] disabled:opacity-60 inline-flex items-center gap-1.5"
        >
          <IconDownload size={16} />
          {busy ? 'جارٍ التنزيل...' : 'تنزيل'}
        </button>
      </div>
    </CopilotCardShell>
  );
};
