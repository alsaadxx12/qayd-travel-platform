import React, { useCallback, useEffect, useRef, useState } from 'react';
import { IconMail, IconCheck, IconAlertTriangle, IconLoader2 } from '@tabler/icons-react';
import { apiRequest } from '../../../api/client';
import { fetchPrintTemplate } from '../../../api/printTemplates';
import {
  PrintableAccountStatementSheet,
  useStatementQr,
  type StatementMovementItem,
} from '../../reports/AccountStatementPrintModal';

/**
 * Emailing a statement from the assistant, using the browser to make the PDF.
 *
 * The server cannot be the one to render it. Producing a PDF there needs a headless
 * browser, which the deployment may not have — but more importantly the server renders
 * a DIFFERENT document: its own Handlebars template, not the sheet the accountant sees
 * and approves on the statement screen. Two designs for the same statement is a defect
 * of its own, quite apart from whether Chromium is installed.
 *
 * So the assistant no longer renders anything. It hands over the statement's data, and
 * this block draws the very same sheet component the statement page prints, turns it
 * into a PDF the same way, and posts it to the same email endpoint. What the customer
 * receives is byte-for-byte the document the staff would have exported by hand.
 */

export interface StatementEmailPayload {
  accountName: string;
  accountCode?: string;
  accountPhone?: string;
  accountEmail?: string;
  accountAddress?: string;
  recipientEmail: string;
  recipientName?: string;
  startDate: string;
  endDate: string;
  periodLabel?: string;
  rows: StatementMovementItem[];
  totals: {
    totalDebit: number;
    totalCredit: number;
    finalBalance: number;
    openingBalance?: number;
    previousBalance?: number;
  };
}

type Phase = 'preparing' | 'rendering' | 'sending' | 'sent' | 'failed';

export const StatementEmailBlock: React.FC<{ payload: StatementEmailPayload }> = ({ payload }) => {
  const [phase, setPhase] = useState<Phase>('preparing');
  const [error, setError] = useState('');
  const [config, setConfig] = useState<any>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  // A block re-renders whenever the conversation does; without this the same statement
  // would be emailed again on every re-render.
  const startedRef = useRef(false);

  const qrDataUrl = useStatementQr(payload.accountCode, undefined, true);

  useEffect(() => {
    let cancelled = false;
    fetchPrintTemplate('statement')
      .then((res: any) => {
        if (!cancelled) setConfig(res?.config || {});
      })
      .catch(() => {
        // The sheet has its own defaults; a missing template must not stop the send.
        if (!cancelled) setConfig({});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const run = useCallback(async () => {
    if (!sheetRef.current) return;
    setPhase('rendering');
    setError('');
    try {
      // Fetched at the moment of use, not with the panel: the PDF stack is over a
      // megabyte and most conversations never email a statement.
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas-pro'),
      ]);

      const canvas = await html2canvas(sheetRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const dataUri = pdf.output('datauristring');
      const pdfBase64 = dataUri.split(',')[1] || dataUri;
      if (!pdfBase64) throw new Error('تعذّر توليد ملف الكشف.');

      setPhase('sending');
      await apiRequest('/api/email/send-statement', {
        method: 'POST',
        body: JSON.stringify({
          recipientEmail: payload.recipientEmail,
          recipientName: payload.recipientName || payload.accountName,
          accountName: payload.accountName,
          accountCode: payload.accountCode,
          currency: 'IQD',
          currentBalance: payload.totals.finalBalance,
          fromDate: payload.startDate,
          toDate: payload.endDate,
          subject: `كشف حساب — ${payload.accountCode ? `${payload.accountCode} - ` : ''}${payload.accountName}`,
          pdfBase64,
        }),
      });
      setPhase('sent');
    } catch (err: any) {
      setError(err?.message || 'تعذّر إرسال الكشف.');
      setPhase('failed');
    }
  }, [payload]);

  useEffect(() => {
    // The sheet must be laid out and its fonts settled before it is photographed, or
    // the PDF comes out with unstyled or missing Arabic text.
    if (config === null || startedRef.current) return;
    startedRef.current = true;
    const timer = setTimeout(() => {
      void (document as any).fonts?.ready?.catch?.(() => {});
      void run();
    }, 350);
    return () => clearTimeout(timer);
  }, [config, run]);

  const label =
    phase === 'sent'
      ? `تم إرسال الكشف إلى ${payload.recipientEmail}`
      : phase === 'failed'
        ? error
        : phase === 'sending'
          ? 'جارٍ الإرسال…'
          : 'جارٍ توليد ملف الكشف…';

  return (
    <>
      <div
        className={`rounded-xl border p-3 flex items-start gap-2.5 ${
          phase === 'sent'
            ? 'border-emerald-200 bg-emerald-50'
            : phase === 'failed'
              ? 'border-rose-200 bg-rose-50'
              : 'border-slate-200 bg-slate-50'
        }`}
      >
        {phase === 'sent' ? (
          <IconCheck size={16} className="text-emerald-600 shrink-0 mt-0.5" />
        ) : phase === 'failed' ? (
          <IconAlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
        ) : (
          <IconLoader2 size={16} className="text-slate-500 shrink-0 mt-0.5 animate-spin" />
        )}
        <div className="min-w-0">
          <p
            className={`text-xs font-bold leading-relaxed ${
              phase === 'sent'
                ? 'text-emerald-900'
                : phase === 'failed'
                  ? 'text-rose-900'
                  : 'text-slate-700'
            }`}
          >
            {label}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {payload.accountName}
            {payload.periodLabel ? ` — ${payload.periodLabel}` : ''}
          </p>
          {phase === 'failed' && (
            <button
              type="button"
              onClick={() => void run()}
              className="mt-2 h-7 px-3 rounded-lg bg-[#F45A0A] text-white text-[11px] font-bold"
            >
              إعادة المحاولة
            </button>
          )}
        </div>
        <IconMail size={15} className="text-slate-400 shrink-0 ms-auto" />
      </div>

      {/*
        Off-screen rather than hidden: html2canvas photographs a live layout, and an
        element with `display:none` has no layout to photograph. Moving it out of view
        keeps it measurable while keeping it out of the conversation.
      */}
      <div
        style={{ position: 'fixed', left: '-9999px', top: 0, width: '780px', pointerEvents: 'none', opacity: 0 }}
        aria-hidden="true"
      >
        <div ref={sheetRef}>
          {config !== null && (
            <PrintableAccountStatementSheet
              accountName={payload.accountName}
              accountCode={payload.accountCode}
              accountPhone={payload.accountPhone}
              accountEmail={payload.accountEmail}
              accountAddress={payload.accountAddress}
              startDate={payload.startDate}
              endDate={payload.endDate}
              rows={payload.rows}
              totals={payload.totals}
              config={config}
              lang="ar"
              qrDataUrl={qrDataUrl}
            />
          )}
        </div>
      </div>
    </>
  );
};

export default StatementEmailBlock;
