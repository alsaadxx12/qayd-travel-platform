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

/**
 * Resolved here rather than imported from `api/client`, so this page does not drag the
 * staff app's cache, auth and telemetry machinery into the bundle a customer downloads
 * on mobile data. The values match `API_BASE_URL` exactly — and note it already ends
 * with `/api`, so paths below must not repeat it.
 */
const API_BASE =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? '/api' : 'https://qayd-api-r04m.onrender.com/api');

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
  const [digits, setDigits] = useState<string>('');
  const [verifyError, setVerifyError] = useState<string>('');
  const [verifying, setVerifying] = useState(false);
  // Held in memory only: no localStorage, so a shared phone does not keep the door open.
  const [session, setSession] = useState<string>('');
  const [data, setData] = useState<StatementData | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [downloaded, setDownloaded] = useState<'pdf' | 'html' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute('dir', 'rtl');
    document.title = 'كشف الحساب';
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/portal/statement/${encodeURIComponent(token)}`);
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

  const submitDigits = useCallback(async () => {
    if (digits.length !== 4 || verifying) return;
    setVerifying(true);
    setVerifyError('');
    try {
      const res = await fetch(`${API_BASE}/portal/statement/${encodeURIComponent(token)}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ last4: digits }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'الأرقام غير صحيحة.');
      setSession(json.session);
    } catch (err: any) {
      setVerifyError(err?.message || 'الأرقام غير صحيحة.');
      setDigits('');
      inputRef.current?.focus();
    } finally {
      setVerifying(false);
    }
  }, [digits, token, verifying]);

  // Four digits is the whole answer, so submitting on the fourth keystroke saves the
  // customer a tap without ever guessing at an incomplete entry.
  useEffect(() => {
    if (digits.length === 4 && !session) void submitDigits();
  }, [digits, session, submitDigits]);

  /**
   * The four digits are the last step the customer should have to take: as soon as
   * they are right, the statement downloads itself. The on-screen statement is not
   * the destination — it is what remains on the page afterwards, so a phone that
   * blocks the download still shows everything.
   *
   * The file is fetched rather than linked because the session travels in a header,
   * which a plain <a href> cannot carry.
   */
  const downloadStatement = useCallback(async () => {
    if (!session) return;
    const res = await fetch(
      `${API_BASE}/portal/statement/${encodeURIComponent(token)}/download`,
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
    // Revoked on a delay: revoking immediately can cancel the save on some mobile
    // browsers, which start reading the blob after the click returns.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    setDownloaded(kind);
  }, [session, token]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setLoadingData(true);
    (async () => {
      // The download is attempted first and its failure is not fatal — the page
      // below is a complete statement in its own right.
      try {
        await downloadStatement();
      } catch {
        /* fall through to the on-screen statement */
      }
      try {
        const res = await fetch(`${API_BASE}/portal/statement/${encodeURIComponent(token)}/data`, {
          headers: { 'x-portal-session': session },
        });
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
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">كشف حساب</p>
          <h1 className="mt-1 text-xl font-black text-slate-900">{intro.holderName}</h1>

          {intro.phoneHint ? (
            <>
              <label htmlFor="last4" className="mt-6 block text-sm font-bold text-slate-800">
                للتأكد من أنك صاحب الحساب، أدخل آخر أربعة أرقام من هاتفك
              </label>
              <p className="mt-1 font-mono text-sm tracking-widest text-slate-500" dir="ltr">
                {intro.phoneHint}
              </p>

              <input
                id="last4"
                ref={inputRef}
                autoFocus
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={4}
                value={digits}
                onChange={(e) => {
                  setVerifyError('');
                  setDigits(e.target.value.replace(/\D/g, '').slice(0, 4));
                }}
                disabled={verifying}
                aria-describedby={verifyError ? 'last4-error' : undefined}
                className="mt-3 h-16 w-full rounded-2xl border-2 border-slate-300 bg-white text-center font-mono text-3xl font-black tracking-[0.5em] text-slate-900 focus:border-[#F45A0A] focus:outline-none disabled:opacity-60"
                dir="ltr"
              />
            </>
          ) : (
            <div className="mt-6">
              <button
                type="button"
                disabled={verifying}
                onClick={async () => {
                  setVerifying(true);
                  setVerifyError('');
                  try {
                    const res = await fetch(`${API_BASE}/portal/statement/${encodeURIComponent(token)}/verify`, {
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
                className="h-13 w-full rounded-2xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-black text-sm shadow-md transition cursor-pointer flex items-center justify-center gap-2"
              >
                {verifying ? 'جارٍ فتح الكشف…' : 'عرض وتحميل كشف الحساب 📄'}
              </button>
            </div>
          )}

          {verifying && <p className="mt-3 text-sm font-bold text-slate-500">جارٍ التحقق…</p>}
          {verifyError && (
            <p id="last4-error" role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-800">
              {verifyError}
            </p>
          )}
          {loadingData && <p className="mt-3 text-sm font-bold text-slate-500">جارٍ تحميل الكشف…</p>}
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
