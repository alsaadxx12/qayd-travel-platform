import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Lottie } from 'lottie-react';
import {
  IconPrinter,
  IconDownload,
  IconArrowDownLeft,
  IconArrowUpRight,
  IconMinus,
} from '@tabler/icons-react';
import { API_BASE_URL } from '../../api/client';
import manBalanceAnimation from '../../assets/animations/man-balance-sheet.json';
import womanAccountingAnimation from '../../assets/animations/woman-accounting.json';

interface PortalIntro {
  companyName: string;
  logoUrl: string | null;
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
  company: { name: string; phone: string | null; address: string | null; logoUrl: string | null } | null;
  logoUrl: string | null;
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
  const [downloading, setDownloading] = useState(false);

  const [otp, setOtp] = useState<string[]>(['', '', '', '']);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Prevent background html scrolling on verification screen while allowing smooth internal center
  useEffect(() => {
    document.documentElement.setAttribute('dir', 'rtl');
    document.title = 'كشف الحساب الإلكتروني';

    if (!data) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [data]);

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

  const submitDigits = useCallback(
    async (code: string) => {
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
        if (!res.ok) throw new Error(json?.message || 'الأرقام غير صحيحة');
        setSession(json.session);
      } catch (err: any) {
        setVerifyError(err?.message || 'الأرقام غير صحيحة، يرجى إعادة المحاولة.');
        setOtp(['', '', '', '']);
        otpRefs.current[0]?.focus();
      } finally {
        setVerifying(false);
      }
    },
    [token, verifying],
  );

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

  const downloadStatement = useCallback(async () => {
    if (!session || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/portal/statement/${encodeURIComponent(token)}/download?session=${encodeURIComponent(session)}`,
      );
      if (!res.ok) throw new Error('تعذّر تحضير ملف الكشف.');

      const kind = (res.headers.get('X-Statement-Kind') as 'pdf' | 'html') || 'pdf';
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `statement_${intro?.holderName || 'account'}.${kind}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err: any) {
      console.error(err);
    } finally {
      setDownloading(false);
    }
  }, [session, token, downloading, intro]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setLoadingData(true);
    (async () => {
      try {
        await downloadStatement();
      } catch {
        /* fall through to display the on-screen statement */
      }
      try {
        const res = await fetch(
          `${API_BASE_URL}/portal/statement/${encodeURIComponent(token)}/data?session=${encodeURIComponent(session)}`,
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
  const isSettled = Math.abs(balance) < 0.01;
  const isCredit = balance < 0; // Balance is for customer (Green)

  // ── 1. Error State (Fixed) ────────────────────────────────────────────────
  if (introError) {
    return (
      <div className="fixed inset-0 h-[100dvh] w-screen flex items-center justify-center bg-slate-100 p-4 overflow-hidden">
        <div className="max-w-sm w-full rounded-3xl border border-rose-200 bg-white p-7 text-center shadow-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="mt-3 text-base font-black text-rose-900">تعذّر فتح الكشف</h2>
          <p className="mt-1 text-xs text-slate-600 leading-relaxed">{introError}</p>
        </div>
      </div>
    );
  }

  // ── 2. Initial Loading State (Fixed) ──────────────────────────────────────
  if (!intro) {
    return (
      <div className="fixed inset-0 h-[100dvh] w-screen flex items-center justify-center bg-slate-100 p-4 overflow-hidden">
        <div className="max-w-sm w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-lg animate-pulse">
          <div className="mx-auto h-20 w-20 rounded-full bg-slate-100 mb-3" />
          <div className="h-4 w-36 bg-slate-200 rounded-xl mx-auto mb-2" />
          <div className="h-3 w-24 bg-slate-100 rounded-lg mx-auto" />
        </div>
      </div>
    );
  }

  const effectiveLogo = intro?.logoUrl || null;

  // ── 3. Challenge Screen: Enlarged Container, Prominent Logo, Keyboard-Resilient
  if (!data) {
    return (
      <div className="fixed inset-0 h-[100dvh] w-screen flex items-center justify-center bg-gradient-to-b from-slate-50 via-orange-50/20 to-slate-100 p-4 sm:p-6 overflow-y-auto overscroll-none select-none">
        <div className="my-auto w-full max-w-[440px] sm:max-w-[460px] rounded-[32px] border border-slate-200/90 bg-white p-7 sm:p-9 text-center shadow-2xl shadow-slate-200/70 relative">
          
          {/* Company/Branch Logo inside container */}
          {effectiveLogo && (
            <div className="mb-3 flex justify-center">
              <img
                src={effectiveLogo}
                alt="شعار الشركة"
                className="h-14 sm:h-16 w-auto max-w-[190px] object-contain drop-shadow-xs"
              />
            </div>
          )}

          {/* Lottie Animation: Man Analyzing Balance Sheet */}
          <div className="mx-auto w-36 h-36 sm:w-44 sm:h-44 -mt-1 flex items-center justify-center pointer-events-none">
            <Lottie
              src={manBalanceAnimation}
              loop={true}
              autoplay={true}
              className="w-full h-full"
            />
          </div>

          {/* Clean Single Account Holder Name */}
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
            {intro.holderName}
          </h1>

          {intro.phoneHint ? (
            <div className="mt-4">
              <label className="block text-sm font-bold text-slate-600">
                أدخل آخر 4 أرقام من هاتفك
              </label>

              {/* 4 Large Connected/Separated OTP Digit Boxes */}
              <div className="mt-3.5 flex items-center justify-center gap-3 sm:gap-3.5" dir="ltr">
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
                    className="h-15 w-13 sm:h-18 sm:w-16 rounded-2xl border-2 border-slate-200 bg-slate-50/80 text-center font-mono text-2xl sm:text-3xl font-black text-slate-900 shadow-xs transition-all duration-150 focus:border-[#F45A0A] focus:bg-white focus:shadow-md focus:shadow-orange-500/15 focus:scale-105 focus:outline-none disabled:opacity-60"
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4">
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
                {verifying ? 'جارٍ الفتح…' : 'عرض كشف الحساب 📄'}
              </button>
            </div>
          )}

          {verifying && (
            <div className="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold text-slate-500 animate-pulse">
              <div className="h-1.5 w-1.5 rounded-full bg-[#F45A0A] animate-ping" />
              <span>جارٍ التحقق…</span>
            </div>
          )}

          {verifyError && (
            <p id="last4-error" role="alert" className="mt-3 rounded-xl bg-rose-50 p-2.5 text-xs font-bold text-rose-700 border border-rose-200">
              {verifyError}
            </p>
          )}

          {loadingData && (
            <div className="mt-3 text-xs font-bold text-slate-500">
              <span>جارٍ تحميل البيانات…</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  const statementLogo = data.logoUrl || data.company?.logoUrl || null;

  // ── 4. The Verified Statement Screen (Clean, Container-Only Logo, No Outside Header)
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-orange-50/20 to-slate-100 px-4 py-6 antialiased">
      <div className="mx-auto w-full max-w-lg space-y-4">
        {/* Main Hero Card with Woman Accounting Animation & Company Logo */}
        <div className="rounded-[32px] border border-slate-200/90 bg-white p-6 sm:p-7 shadow-xl shadow-slate-200/50 relative">
          
          {/* Company/Branch Logo at Top of Container */}
          {statementLogo && (
            <div className="mb-3 flex justify-center">
              <img
                src={statementLogo}
                alt="شعار الشركة"
                className="h-14 sm:h-16 w-auto max-w-[190px] object-contain drop-shadow-xs"
              />
            </div>
          )}

          {/* Woman Doing Financial Accounting Animation */}
          <div className="mx-auto w-40 h-40 -mt-1 mb-2 flex items-center justify-center pointer-events-none">
            <Lottie
              src={womanAccountingAnimation}
              loop={true}
              autoplay={true}
              className="w-full h-full"
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <div>
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">كشف حساب العميل</span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">{data.holderName}</h1>
            </div>

            {/* Dynamic Arrow Badge for Credit / Debit */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-black border ${
                isSettled
                  ? 'bg-slate-50 text-slate-700 border-slate-200'
                  : isCredit
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              {isSettled ? (
                <>
                  <IconMinus size={15} className="text-slate-500" />
                  <span>خالص الرصيد</span>
                </>
              ) : isCredit ? (
                <>
                  <IconArrowDownLeft size={16} className="text-emerald-600" />
                  <span>الرصيد لك (دائن)</span>
                </>
              ) : (
                <>
                  <IconArrowUpRight size={16} className="text-rose-600" />
                  <span>المطلوب منك (مدين)</span>
                </>
              )}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 text-center bg-slate-50/60 rounded-2xl p-4">
            <span className="text-xs font-bold text-slate-500">صافي الرصيد الحالي المستحق</span>
            <div className="mt-1 flex items-baseline justify-center gap-2" dir="ltr">
              <span
                className={`font-mono text-4xl sm:text-5xl font-black tabular-nums tracking-tight ${
                  isSettled ? 'text-slate-800' : isCredit ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {money(Math.abs(balance))}
              </span>
              <span className="text-base font-black text-slate-600">IQD</span>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 text-center">
              <p className="text-[11px] font-bold text-slate-500">إجمالي المدين (عليك)</p>
              <p className="mt-1 font-mono text-base sm:text-lg font-black tabular-nums text-slate-900" dir="ltr">
                {money(data.totalDebit)} <span className="text-xs font-bold text-slate-500">IQD</span>
              </p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 text-center">
              <p className="text-[11px] font-bold text-slate-500">إجمالي الدائن (لك)</p>
              <p className="mt-1 font-mono text-base sm:text-lg font-black tabular-nums text-slate-900" dir="ltr">
                {money(data.totalCredit)} <span className="text-xs font-bold text-slate-500">IQD</span>
              </p>
            </div>
          </div>

          {/* Action Buttons with Standard System Tabler Icons */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={downloading}
              onClick={() => {
                void downloadStatement();
              }}
              className="h-12 w-full rounded-2xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white text-xs font-black shadow-md shadow-orange-500/20 transition cursor-pointer flex items-center justify-center gap-2"
            >
              <IconDownload size={18} stroke={2.5} />
              <span>{downloading ? 'جارٍ التحميل…' : 'تحميل كشف PDF الرسمي'}</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="h-12 w-full rounded-2xl border-2 border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-black transition cursor-pointer flex items-center justify-center gap-2"
            >
              <IconPrinter size={18} stroke={2} className="text-slate-600" />
              <span>طباعة كشف الحساب</span>
            </button>
          </div>
        </div>

        {/* Transactions List */}
        <div className="rounded-[32px] border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xl shadow-slate-200/50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <span>سجل الحركات والمعاملات</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold font-mono">
                {data.lines.length}
              </span>
            </h2>
            <span className="text-[11px] font-bold text-slate-400">مرتبة حسب التاريخ</span>
          </div>

          {data.lines.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
              <span className="text-2xl">📋</span>
              <p className="mt-2 text-xs font-bold text-slate-500">لا توجد حركات مالية مسجلة في هذا الكشف</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.lines.map((line) => {
                const isDebit = Number(line.debit) > 0;
                return (
                  <div
                    key={line.id}
                    className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-xl text-xs font-black ${
                            isDebit ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                          }`}
                        >
                          {isDebit ? <IconArrowUpRight size={15} /> : <IconArrowDownLeft size={15} />}
                        </span>
                        <div>
                          <span className="font-mono text-[11px] font-black text-slate-400" dir="ltr">
                            {formatDate(line.date)}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`font-mono text-base font-black tabular-nums ${
                          isDebit ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                        dir="ltr"
                      >
                        {isDebit ? '−' : '+'}
                        {money(isDebit ? line.debit : line.credit)}
                        <span className="text-[11px] font-bold text-slate-400 mr-1">IQD</span>
                      </span>
                    </div>

                    <p className="mt-2 text-xs font-bold leading-relaxed text-slate-800">
                      {line.description || 'حركة مالية'}
                    </p>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-400">
                      <span className="font-mono bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100" dir="ltr">
                        {line.entryNumber}
                      </span>
                      <span className="font-mono" dir="ltr">
                        الرصيد: <strong className="text-slate-700">{money(line.runningBalance)}</strong> IQD
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Company Contact Info Inside Container */}
        {data.company && (data.company.phone || data.company.address) && (
          <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-3.5 text-center text-xs text-slate-500">
            {data.company.address && <p className="text-[11px] text-slate-400">{data.company.address}</p>}
            {data.company.phone && (
              <p className="mt-1 text-xs font-bold text-[#F45A0A] font-mono" dir="ltr">
                📞 {data.company.phone}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatementPortalPage;
