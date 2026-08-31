import React, { useCallback, useEffect, useRef, useState } from 'react';
import { IconMail, IconCheck, IconAlertTriangle, IconLoader2 } from '@tabler/icons-react';
import { apiRequest } from '../../../api/client';
import { statementPdfToBase64 } from '../../../api/statementPdf';
import type { StatementMovementItem } from '../../reports/AccountStatementPrintModal';

/**
 * Emails the official statement PDF rendered by Chromium on the server — the same
 * vector document the statement page now exports, not a JPEG screenshot of the UI.
 */

export interface StatementEmailPayload {
  accountId?: string;
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

/**
 * Statements already emailed, remembered for the life of the tab.
 *
 * A ref is not enough. A ref lives with one component instance, and this block sits in
 * a chat message React may unmount and remount — scrolling, reopening the panel, a
 * re-render with new keys — and each remount would auto-send the same statement to the
 * same customer again. Reloading the page and replaying the conversation would do it
 * once more, which is why the record goes to sessionStorage rather than memory alone.
 *
 * Sending mail is not an idempotent side effect; the guard has to outlive the component
 * that performs it. It is deliberately per-tab: a deliberate resend is still one click
 * on «إعادة المحاولة», which bypasses this entirely.
 */
const SENT_STORE_KEY = 'statement-email-sent';

const sendKey = (p: StatementEmailPayload) =>
  [p.recipientEmail, p.accountCode || p.accountName, p.startDate, p.endDate, p.rows.length].join('|');

const readSent = (): Set<string> => {
  try {
    return new Set<string>(JSON.parse(sessionStorage.getItem(SENT_STORE_KEY) || '[]'));
  } catch {
    // Private windows and blocked site data both throw here; an unusable store just
    // means the in-memory guard is the only one, which is still better than none.
    return new Set<string>();
  }
};

const alreadySent = readSent();

const markSent = (key: string) => {
  alreadySent.add(key);
  try {
    sessionStorage.setItem(SENT_STORE_KEY, JSON.stringify(Array.from(alreadySent)));
  } catch {
    /* memory-only is an acceptable degradation */
  }
};

export const StatementEmailBlock: React.FC<{ payload: StatementEmailPayload }> = ({ payload }) => {
  const key = sendKey(payload);
  const [phase, setPhase] = useState<Phase>(alreadySent.has(key) ? 'sent' : 'preparing');
  const [error, setError] = useState('');
  /** Stops a second run within one mount; `alreadySent` stops it across mounts. */
  const startedRef = useRef(false);

  const run = useCallback(async () => {
    setPhase('rendering');
    setError('');
    try {
      const pdfBase64 = await statementPdfToBase64({
        accountId: payload.accountId,
        accountName: payload.accountName,
        accountCode: payload.accountCode,
        accountPhone: payload.accountPhone,
        accountEmail: payload.accountEmail,
        accountAddress: payload.accountAddress,
        startDate: payload.startDate,
        endDate: payload.endDate,
        rows: payload.rows,
        totals: payload.totals,
        lang: 'ar',
      });

      setPhase('sending');
      await apiRequest('/api/email/send-statement', {
        method: 'POST',
        timeoutMs: 60_000,
        body: JSON.stringify({
          recipientEmail: payload.recipientEmail,
          recipientName: payload.recipientName || payload.accountName,
          accountName: payload.accountName,
          accountCode: payload.accountCode,
          fromDate: payload.startDate,
          toDate: payload.endDate,
          subject: `كشف حساب — ${payload.accountCode ? `${payload.accountCode} - ` : ''}${payload.accountName}`,
          pdfBase64,
        }),
      });
      markSent(key);
      setPhase('sent');
    } catch (err: any) {
      setError(err?.message || 'تعذّر إرسال الكشف.');
      setPhase('failed');
    }
  }, [payload, key]);

  useEffect(() => {
    if (startedRef.current || alreadySent.has(key)) return;
    startedRef.current = true;
    void run();
  }, [run, key]);

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
    </>
  );
};

export default StatementEmailBlock;
