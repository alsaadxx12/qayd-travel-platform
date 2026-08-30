import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../api/client';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';

/**
 * Issuing, printing and revoking the customer barcodes.
 *
 * The screen is built around the three things a clerk actually does at the counter:
 * find a customer, print their card, and — when someone says their code has been seen
 * by the wrong person — kill it. Everything else is reporting: how many times a code
 * has been opened, and when it was last opened, which is the only signal the agency
 * gets that a code may be circulating further than intended.
 */

interface QrToken {
  id: string;
  token: string;
  url: string;
  qrDataUrl: string | null;
  holderName: string;
  canVerify: boolean;
  phoneHint: string | null;
  viewCount: number;
  lastViewedAt: string | null;
  createdAt: string;
  customerId?: string | null;
  supplierId?: string | null;
  lockedUntil?: string | null;
}

interface Party {
  id: string;
  nameAr: string;
  phone?: string | null;
  kind: 'CUSTOMER' | 'SUPPLIER';
}

export const StatementQrPage: React.FC = () => {
  const [tokens, setTokens] = useState<QrToken[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState<QrToken | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [issued, customers, suppliers] = await Promise.all([
        apiRequest('/statement-tokens').catch(() => []),
        apiRequest('/partners/customers').catch(() => []),
        apiRequest('/partners/suppliers').catch(() => []),
      ]);
      setTokens(Array.isArray(issued) ? issued : []);
      setParties([
        ...(customers || []).map((c: any) => ({ ...c, kind: 'CUSTOMER' as const })),
        ...(suppliers || []).map((s: any) => ({ ...s, kind: 'SUPPLIER' as const })),
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const issuedBy = useMemo(() => {
    const map = new Map<string, QrToken>();
    for (const t of tokens) {
      const key = t.customerId || t.supplierId;
      if (key) map.set(key, t);
    }
    return map;
  }, [tokens]);

  const rows = useMemo(() => {
    const q = search.trim();
    return parties
      .filter((p) => !q || p.nameAr?.includes(q) || String(p.phone || '').includes(q))
      .slice(0, 300);
  }, [parties, search]);

  const issue = async (party: Party, regenerate = false) => {
    setBusyId(party.id);
    try {
      const body =
        party.kind === 'CUSTOMER'
          ? { customerId: party.id, regenerate }
          : { supplierId: party.id, regenerate };
      const created: QrToken = await apiRequest('/statement-tokens', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      showSuccessNotification(
        regenerate ? 'تم إصدار باركود جديد' : 'الباركود جاهز',
        regenerate
          ? 'أُبطل الباركود القديم. كل ورقة تحمله لم تعد تعمل.'
          : `باركود ${created.holderName} جاهز للطباعة.`,
      );
      await load();
      setPreview(created);
    } catch (err: any) {
      showErrorNotification('تعذّر إصدار الباركود', err?.message || 'حدث خطأ.');
    } finally {
      setBusyId('');
    }
  };

  const revoke = async (row: QrToken) => {
    setBusyId(row.id);
    try {
      await apiRequest(`/statement-tokens/${row.id}`, { method: 'DELETE' });
      showSuccessNotification('تم الإبطال', 'كل ورقة تحمل هذا الباركود توقفت عن العمل.');
      await load();
      setPreview(null);
    } catch (err: any) {
      showErrorNotification('تعذّر الإبطال', err?.message || 'حدث خطأ.');
    } finally {
      setBusyId('');
    }
  };

  /**
   * Printing opens a bare window with only the card in it. Printing the page itself
   * would carry the whole table — every customer's code — onto paper, which is exactly
   * the leak this feature exists to prevent.
   */
  const printCard = (row: QrToken) => {
    const w = window.open('', '_blank', 'width=420,height=620');
    if (!w) return;
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>بطاقة ${row.holderName}</title>
      <style>
        body{font-family:system-ui,'Segoe UI',sans-serif;margin:0;padding:28px;text-align:center;color:#0f172a}
        .card{border:2px solid #e2e8f0;border-radius:18px;padding:24px;max-width:320px;margin:0 auto}
        h1{font-size:17px;margin:0 0 4px}
        p{font-size:12px;color:#64748b;margin:4px 0}
        img{width:220px;height:220px;margin:14px 0}
        .hint{font-size:11px;color:#94a3b8;margin-top:10px;line-height:1.7}
      </style></head><body>
      <div class="card">
        <h1>${row.holderName}</h1>
        <p>كشف الحساب</p>
        ${row.qrDataUrl ? `<img src="${row.qrDataUrl}" alt="">` : '<p>تعذّر توليد الباركود</p>'}
        <p class="hint">امسح الرمز بكاميرا هاتفك،<br>ثم أدخل آخر أربعة أرقام من رقم هاتفك.</p>
      </div>
      <script>window.onload=function(){window.print()}<\/script>
      </body></html>`);
    w.document.close();
  };

  return (
    <div className="p-4 space-y-4">
      <header>
        <h1 className="text-lg font-black text-slate-900">باركود كشف الحساب</h1>
        <p className="mt-1 text-xs text-slate-600">
          يمسح العميل الرمز، يُدخل آخر أربعة أرقام من هاتفه، فيرى رصيده وكل حركاته. الرمز وحده لا
          يكفي لفتح الكشف.
        </p>
      </header>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="ابحث بالاسم أو رقم الهاتف…"
        aria-label="بحث عن عميل أو مورد"
        className="h-10 w-full max-w-md rounded-xl border border-slate-300 px-3 text-sm font-medium focus:border-[#F45A0A] focus:outline-none"
      />

      {loading ? (
        <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-slate-800">
              <tr className="h-9 font-bold">
                <th className="px-3 text-center">الاسم</th>
                <th className="px-3 text-center">النوع</th>
                <th className="px-3 text-center">الهاتف</th>
                <th className="px-3 text-center">الحالة</th>
                <th className="px-3 text-center">مرات الاطلاع</th>
                <th className="px-3 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((party) => {
                const issued = issuedBy.get(party.id);
                const busy = busyId === party.id || busyId === issued?.id;
                return (
                  <tr key={party.id} className="h-11 hover:bg-orange-50/40">
                    <td className="px-3 text-center font-bold text-slate-900">{party.nameAr}</td>
                    <td className="px-3 text-center text-slate-600">
                      {party.kind === 'CUSTOMER' ? 'عميل' : 'مورد'}
                    </td>
                    <td className="px-3 text-center font-mono text-slate-600" dir="ltr">
                      {party.phone || '—'}
                    </td>
                    <td className="px-3 text-center">
                      {!issued ? (
                        <span className="text-slate-400">لم يُصدر</span>
                      ) : !issued.canVerify ? (
                        // Without a phone the customer can never answer the question,
                        // so the code is dead on arrival. Say so where it is issued.
                        <span className="rounded-md bg-amber-50 px-2 py-0.5 font-bold text-amber-800">
                          لا يعمل: لا يوجد هاتف
                        </span>
                      ) : (
                        <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700">
                          فعّال
                        </span>
                      )}
                    </td>
                    <td className="px-3 text-center font-mono tabular-nums text-slate-700">
                      {issued ? issued.viewCount : '—'}
                    </td>
                    <td className="px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {!issued ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => issue(party)}
                            className="h-7 rounded-lg bg-[#F45A0A] px-2.5 font-bold text-white disabled:opacity-50"
                          >
                            إصدار
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setPreview(issued)}
                              className="h-7 rounded-lg border border-slate-200 px-2.5 font-bold text-slate-700 hover:bg-slate-100"
                            >
                              عرض
                            </button>
                            <button
                              type="button"
                              onClick={() => printCard(issued)}
                              className="h-7 rounded-lg border border-slate-200 px-2.5 font-bold text-slate-700 hover:bg-slate-100"
                            >
                              طباعة
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => revoke(issued)}
                              className="h-7 rounded-lg border border-rose-200 bg-rose-50 px-2.5 font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                            >
                              إبطال
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center font-bold text-slate-500">
                    لا نتائج.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-black text-slate-900">{preview.holderName}</h2>
            {preview.qrDataUrl ? (
              <img src={preview.qrDataUrl} alt="" className="mx-auto my-4 h-56 w-56" />
            ) : (
              <p className="my-6 text-sm font-bold text-rose-700">تعذّر توليد صورة الباركود.</p>
            )}
            <p className="text-[11px] leading-relaxed text-slate-500">
              يمسح العميل الرمز ثم يُدخل آخر أربعة أرقام من هاتفه {preview.phoneHint ? `(${preview.phoneHint})` : ''}.
            </p>
            <p className="mt-3 break-all rounded-lg bg-slate-50 p-2 font-mono text-[10px] text-slate-500" dir="ltr">
              {preview.url}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => printCard(preview)}
                className="h-9 flex-1 rounded-xl bg-[#F45A0A] font-bold text-white"
              >
                طباعة البطاقة
              </button>
              <button
                type="button"
                onClick={() => {
                  const party = parties.find(
                    (p) => p.id === (preview.customerId || preview.supplierId),
                  );
                  if (party) void issue(party, true);
                }}
                className="h-9 flex-1 rounded-xl border border-slate-200 font-bold text-slate-700"
              >
                إصدار بديل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatementQrPage;
