import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

/**
 * What a customer sees after scanning the barcode on their statement or receipt.
 *
 * This page lives OUTSIDE the application shell — no sidebar, no login, no staff
 * session — because the person holding the phone is not a user of the system. It talks
 * to the public portal endpoints only, and keeps its short-lived session in memory
 * rather than in storage: closing the tab ends the visit, which is the right default
 * for a screen opened on a borrowed or shared phone.
 *
 * The design goal is that the two questions a customer actually has — «كم عليّ؟» and
 * «من أين جاء هذا الرقم؟» — are answered in that order, the first without scrolling.
 */

import { API_BASE_URL } from '../../api/client';

interface PortalIntro {
  companyName: string;
  holderName: string;
  phoneHint: string | null;
  canVerify: boolean;
  locked: boolean;
}

interface StatementLine {
  id: string;
  date: string;
  entryNumber: string;
  reference: string | null;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

interface StatementData {
  company: { name: string; phone: string | null; address: string | null } | null;
  holderName: string;
  account: { code: string; nameAr: string };
  openingBalance: number;
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
  lines: StatementLine[];
}

const money = (value: number) =>
  Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const formatDate = (value: string) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const StatementPortalPage: React.FC = () => {
  const { token = '' } = useParams();

  const [intro, setIntro] = useState<PortalIntro | null>(null);
  const [introError, setIntroError] = useState<string>('');
  const [verifyError, setVerifyError] = useState<string>('');
  const [verifying, setVerifying] = useState(false);
  const [session, setSession] = useState<string>('');
  const [data, setData] = useState<StatementData | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [downloaded, setDownloaded] = useState<'pdf' | 'html' | null>(null);
  const [otp, setOtp] = useState<string[]>(['', '', '', '']);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    document.documentElement.setAttribute('dir', 'rtl');
    document.title = 'كشف الحساب';
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/portal/statement/${encodeURIComponent(token)}`);
        if (!res.ok) throw new Error('هذا الباركود غير صالح أو تم إبطاله.');
        const json = await res.json();
        if (!cancelled) setIntro(json);
      } catch (err: any) {
        if (!cancelled) setIntroError(err?.message || 'تعذّر فتح هذا الباركود.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleOtpChange = (index: number, val: string) => {
    setVerifyError('');
    const cleaned = val.replace(/\D/g, '');
    if (!cleaned) {
      const next = [...otp];
      next[index] = '';
      setOtp(next);
      return;
    }

    if (cleaned.length > 1) {
      // Pasted code (e.g. "9278")
      const chars = cleaned.slice(0, 4).split('');
      const next = ['', '', '', ''];
      chars.forEach((ch, i) => {
        if (i < 4) next[i] = ch;
      });
      setOtp(next);
      if (chars.length === 4) {
        submitDigits(next.join(''));
      } else {
        const nextFocus = Math.min(chars.length, 3);
        otpRefs.current[nextFocus]?.focus();
      }
      return;
    }

    const next = [...otp];
    next[index] = cleaned[cleaned.length - 1];
    setOtp(next);

    if (index < 3) {
      otpRefs.current[index + 1]?.focus();
    } else if (index === 3) {
      const full = next.join('');
      if (full.length === 4) {
        submitDigits(full);
      }
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        const next = [...otp];
        next[index - 1] = '';
        setOtp(next);
        otpRefs.current[index - 1]?.focus();
      } else {
        const next = [...otp];
        next[index] = '';
        setOtp(next);
      }
    } else if (e.key === 'ArrowRight' && index < 3) {
      otpRefs.current[index + 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const submitDigits = useCallback(async (code: string) => {
    if (code.length !== 4 || verifying) return;
    setVerifying(true);
    setVerifyError('');
    try {
      const res = await fetch(`${API_BASE_URL}/portal/statement/${encodeURIComponent(token)}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ last4: code }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'الأرقام غير صحيحة.');
      setSession(json.session);
    } catch (err: any) {
      setVerifyError(err?.message || 'الأرقام غير صحيحة.');
      setOtp(['', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  }, [token, verifying]);

  /**
   * The statement download: session is passed both in header and query string
   * for 100% preflight/CORS resilience.
   */
  const downloadStatement = useCallback(async () => {
    if (!session) return;
    const res = await fetch(
      `${API_BASE_URL}/portal/statement/${encodeURIComponent(token)}/download?session=${encodeURIComponent(session)}`,
      { headers: { 'x-portal-session': session } },
    );
    if (!res.ok) throw new Error('تعذّر تحضير ملف الكشف.');

    const kind = (res.headers.get('X-Statement-Kind') as 'pdf' | 'html') || 'pdf';
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `statement.${kind}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    setDownloaded(kind);
  }, [session, token]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setLoadingData(true);
    (async () => {
      try {
        await downloadStatement();
      } catch {
        /* fall through to the on-screen statement */
      }
      try {
        const res = await fetch(
          `${API_BASE_URL}/portal/statement/${encodeURIComponent(token)}/data?session=${encodeURIComponent(session)}`,
          { headers: { 'x-portal-session': session } },
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || 'تعذّر تحميل الكشف.');
        if (!cancelled) setData(json);
      } catch (err: any) {
        if (!cancelled) {
          setVerifyError(err?.message || 'تعذّر تحميل الكشف.');
          setSession('');
        }
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, token, downloadStatement]);

  const balance = data?.closingBalance ?? 0;
  const balanceLabel = useMemo(() => {
    if (!data) return '';
    if (Math.abs(balance) < 0.01) return 'لا يوجد رصيد مستحق';
    return balance > 0 ? 'الرصيد المطلوب منك' : 'الرصيد لك';
  }, [balance, data]);

  // ── Refused ────────────────────────────────────────────────────────────────
  if (introError) {
    return (
      <Shell>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <p className="text-base font-bold text-rose-900">{introError}</p>
          <p className="mt-2 text-sm text-rose-800">يرجى مراجعة الوكالة للحصول على باركود جديد.</p>
        </div>
      </Shell>
    );
  }

  if (!intro) {
    return (
      <Shell>
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
      </Shell>
    );
  }

  // ── The challenge ──────────────────────────────────────────────────────────
  if (!data) {
    return (
      <Shell companyName={intro.companyName}>
        <div className="rounded-3xl border border-slate-200/90 bg-white p-7 text-center shadow-lg">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-[#F45A0A]">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>

          <p className="mt-3 text-xs font-black uppercase tracking-wider text-slate-400">كشف حساب إلكتروني</p>
          <h1 className="mt-1 text-2xl font-black text-slate-900">{intro.holderName}</h1>

          {intro.phoneHint ? (
            <div className="mt-6">
              <label className="block text-sm font-bold text-slate-700">
                أدخل آخر 4 أرقام من رقم الهاتف المسجّل للتحقق
              </label>

              {/* 4 Connected/Separated OTP Digit Boxes */}
              <div className="mt-5 flex items-center justify-center gap-3" dir="ltr">
                {[0, 1, 2, 3].map((idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      otpRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={1}
                    value={otp[idx]}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    disabled={verifying}
                    className="h-16 w-14 rounded-2xl border-2 border-slate-300 bg-slate-50/50 text-center font-mono text-2xl font-black text-slate-900 shadow-xs transition focus:border-[#F45A0A] focus:bg-white focus:shadow-md focus:shadow-orange-500/10 focus:outline-none disabled:opacity-60"
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-6">
              <button
                type="button"
                disabled={verifying}
                onClick={async () => {
                  setVerifying(true);
                  setVerifyError('');
                  try {
                    const res = await fetch(`${API_BASE_URL}/portal/statement/${encodeURIComponent(token)}/verify`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ last4: '' }),
                    });
                    const json = await res.json();
                    if (!res.ok) throw new Error(json?.message || 'تعذّر فتح الكشف.');
                    setSession(json.session);
                  } catch (err: any) {
                    setVerifyError(err?.message || 'تعذّر فتح الكشف.');
                  } finally {
                    setVerifying(false);
                  }
                }}
                className="h-13 w-full rounded-2xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-black text-sm shadow-md shadow-orange-500/20 transition cursor-pointer flex items-center justify-center gap-2"
              >
                {verifying ? 'جارٍ فتح الكشف…' : 'عرض وتحميل كشف الحساب 📄'}
              </button>
            </div>
          )}

          {verifying && <p className="mt-4 text-xs font-bold text-slate-500">جارٍ التحقق من الهوية…</p>}
          {verifyError && (
            <p id="last4-error" role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-800 border border-rose-200">
              {verifyError}
            </p>
          )}
          {loadingData && <p className="mt-4 text-xs font-bold text-slate-500">جارٍ تحميل بيانات الكشف المالي…</p>}
        </div>
      </Shell>
    );
  }

  // ── The statement ──────────────────────────────────────────────────────────
  return (
    <Shell companyName={data.company?.name || intro.companyName}>
      {/* The balance is the answer to the question that made them scan, so it comes
          first and large, before any table. */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-slate-500">{data.holderName}</p>
        <p className="mt-4 text-sm font-bold text-slate-600">{balanceLabel}</p>
        <p
          className={`mt-1 font-mono text-4xl font-black tabular-nums ${
            Math.abs(balance) < 0.01 ? 'text-emerald-700' : balance > 0 ? 'text-rose-700' : 'text-emerald-700'
          }`}
          dir="ltr"
        >
          {money(Math.abs(balance))} <span className="text-lg text-slate-500">د.ع</span>
        </p>
        <p className="mt-3 text-xs text-slate-500">
          الحساب {data.account?.code} — {data.account?.nameAr}
        </p>
      </div>

      <button
        type="button"
        onClick={() => { void downloadStatement().catch(() => {}); }}
        className="mt-4 h-12 w-full rounded-2xl bg-[#F45A0A] text-sm font-black text-white"
      >
        {downloaded === 'html'
          ? 'تنزيل الكشف مرة أخرى'
          : downloaded === 'pdf'
            ? 'تنزيل ملف PDF مرة أخرى'
            : 'تنزيل الكشف'}
      </button>
      {downloaded === 'html' && (
        <p className="mt-2 text-center text-[11px] text-slate-500">
          نُزّل الكشف كملف صفحة، لأن تحويله إلى PDF غير متاح حالياً على الخادم.
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat label="إجمالي المدين" value={money(data.totalDebit)} />
        <Stat label="إجمالي الدائن" value={money(data.totalCredit)} />
      </div>

      <h2 className="mt-6 mb-2 text-sm font-black text-slate-800">كل الحركات</h2>

      {/* A phone is narrow, so the movements are cards rather than a wide table that
          would force horizontal scrolling on the device this page is made for. */}
      <ol className="space-y-2">
        {data.lines.length === 0 && (
          <li className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-500">
            لا توجد حركات في هذه الفترة.
          </li>
        )}
        {data.lines.map((line) => {
          const isDebit = Number(line.debit) > 0;
          return (
            <li key={line.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <span className="font-mono text-xs font-bold text-slate-500" dir="ltr">
                  {formatDate(line.date)}
                </span>
                <span
                  className={`font-mono text-sm font-black tabular-nums ${
                    isDebit ? 'text-rose-700' : 'text-emerald-700'
                  }`}
                  dir="ltr"
                >
                  {isDebit ? '+' : '−'}
                  {money(isDebit ? line.debit : line.credit)}
                </span>
              </div>
              <p className="mt-1 text-sm font-medium leading-relaxed text-slate-800">{line.description}</p>
              <div className="mt-1.5 flex items-center justify-between gap-3 text-[11px] text-slate-500">
                <span className="font-mono" dir="ltr">
                  {line.entryNumber}
                </span>
                <span className="font-mono tabular-nums" dir="ltr">
                  الرصيد: {money(line.runningBalance)}
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      {data.company?.phone && (
        <p className="mt-6 text-center text-xs text-slate-500">
          لأي استفسار: <span dir="ltr">{data.company.phone}</span>
        </p>
      )}
    </Shell>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-3">
    <p className="text-[11px] font-bold text-slate-500">{label}</p>
    <p className="mt-0.5 font-mono text-base font-black tabular-nums text-slate-900" dir="ltr">
      {value}
    </p>
  </div>
);

const Shell: React.FC<{ companyName?: string; children: React.ReactNode }> = ({
  companyName,
  children,
}) => (
  <div className="min-h-screen bg-slate-50 px-4 py-6">
    <div className="mx-auto w-full max-w-lg">
      {companyName && (
        <p className="mb-4 text-center text-sm font-black text-slate-700">{companyName}</p>
      )}
      {children}
      <p className="mt-8 text-center text-[11px] text-slate-400">
        هذه الصفحة خاصة بك. لا تشارك الباركود مع أحد.
      </p>
    </div>
  </div>
);

export default StatementPortalPage;
