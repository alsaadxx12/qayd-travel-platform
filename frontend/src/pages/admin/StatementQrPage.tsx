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
  accountId?: string | null;
  customerId?: string | null;
  supplierId?: string | null;
  lockedUntil?: string | null;
}

interface Party {
  id: string;
  code?: string;
  nameAr: string;
  phone?: string | null;
  kind: 'CUSTOMER' | 'SUPPLIER' | 'ACCOUNT';
  accountId?: string;
}

export const StatementQrPage: React.FC = () => {
  const [tokens, setTokens] = useState<QrToken[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'ACCOUNT' | 'CUSTOMER' | 'SUPPLIER'>('ALL');
  const [preview, setPreview] = useState<QrToken | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [issued, customers, suppliers, accounts] = await Promise.all([
        apiRequest('/statement-tokens').catch(() => []),
        apiRequest('/partners/customers').catch(() => []),
        apiRequest('/partners/suppliers').catch(() => []),
        apiRequest('/accounts?lite=1').catch(() => []),
      ]);
      setTokens(Array.isArray(issued) ? issued : []);

      const list: Party[] = [];
      const seenAccountIds = new Set<string>();

      (customers || []).forEach((c: any) => {
        list.push({
          id: c.id,
          code: c.code,
          nameAr: c.nameAr,
          phone: c.phone,
          kind: 'CUSTOMER',
          accountId: c.accountId,
        });
        if (c.accountId) seenAccountIds.add(c.accountId);
      });

      (suppliers || []).forEach((s: any) => {
        list.push({
          id: s.id,
          code: s.code,
          nameAr: s.nameAr,
          phone: s.phone,
          kind: 'SUPPLIER',
          accountId: s.accountId,
        });
        if (s.accountId) seenAccountIds.add(s.accountId);
      });

      // Add all general ledger accounts / advances / employee accounts
      (accounts || []).forEach((a: any) => {
        if (!seenAccountIds.has(a.id)) {
          list.push({
            id: a.id,
            code: a.code,
            nameAr: a.nameAr,
            phone: a.phone || null,
            kind: 'ACCOUNT',
            accountId: a.id,
          });
        }
      });

      setParties(list);
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
      if (t.accountId) map.set(t.accountId, t);
      if (t.customerId) map.set(t.customerId, t);
      if (t.supplierId) map.set(t.supplierId, t);
      if (t.id) map.set(t.id, t);
    }
    return map;
  }, [tokens]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return parties
      .filter((p) => {
        if (activeTab !== 'ALL' && p.kind !== activeTab) return false;
        if (!q) return true;
        const nameMatch = (p.nameAr || '').toLowerCase().includes(q);
        const codeMatch = String(p.code || '').toLowerCase().includes(q);
        const phoneMatch = String(p.phone || '').includes(q);
        return nameMatch || codeMatch || phoneMatch;
      })
      .slice(0, 300);
  }, [parties, search, activeTab]);

  const issue = async (party: Party, regenerate = false) => {
    setBusyId(party.id);
    try {
      const body =
        party.kind === 'CUSTOMER'
          ? { customerId: party.id, regenerate }
          : party.kind === 'SUPPLIER'
          ? { supplierId: party.id, regenerate }
          : { accountId: party.id, label: party.nameAr, regenerate };

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
    <div className="p-4 md:p-6 space-y-4 max-w-[1500px] mx-auto w-full font-sans" dir="rtl">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-black text-slate-900">باركود كشف الحساب وبطاقات العملاء</h1>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            يمسح العميل أو الموظف الرمز بكاميرا الهاتف لمتابعة رصيده وكشف حسابه المحدث لحظة بلحظة.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => load()}
            className="h-9 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            تحديث القائمة
          </button>
        </div>
      </header>

      {/* Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الكل ({parties.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ACCOUNT')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'ACCOUNT' ? 'bg-[#F45A0A] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الحسابات والسلف ({parties.filter((p) => p.kind === 'ACCOUNT').length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('CUSTOMER')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'CUSTOMER' ? 'bg-[#F45A0A] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            العملاء ({parties.filter((p) => p.kind === 'CUSTOMER').length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('SUPPLIER')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'SUPPLIER' ? 'bg-[#F45A0A] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الموردين ({parties.filter((p) => p.kind === 'SUPPLIER').length})
          </button>
        </div>

        {/* Search */}
        <div className="w-full sm:w-80">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالاسم، رقم الحساب (مثل 16141110)، أو الهاتف..."
            aria-label="بحث عن حساب أو عميل"
            className="h-9 w-full rounded-xl border border-slate-300 px-3 text-xs font-semibold focus:border-[#F45A0A] focus:outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
              <tr className="h-10 font-bold">
                <th className="px-4 text-start">رقم الحساب / الكود</th>
                <th className="px-4 text-start">اسم الحساب / الطرف</th>
                <th className="px-3 text-center">النوع والتصنيف</th>
                <th className="px-3 text-center">رقم الهاتف للتحقق</th>
                <th className="px-3 text-center">حالة الباركود</th>
                <th className="px-3 text-center">مرات الفتح</th>
                <th className="px-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((party) => {
                const issued = issuedBy.get(party.id) || (party.accountId ? issuedBy.get(party.accountId) : undefined);
                const busy = busyId === party.id || busyId === issued?.id;
                return (
                  <tr key={party.id} className="h-12 hover:bg-orange-50/30 transition">
                    <td className="px-4 text-start font-mono font-bold text-slate-600" dir="ltr">
                      {party.code || '—'}
                    </td>
                    <td className="px-4 text-start font-extrabold text-slate-900 text-sm">
                      {party.nameAr}
                    </td>
                    <td className="px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                          party.kind === 'ACCOUNT'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : party.kind === 'CUSTOMER'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}
                      >
                        {party.kind === 'ACCOUNT' ? 'حساب / سلف' : party.kind === 'CUSTOMER' ? 'عميل' : 'مورد'}
                      </span>
                    </td>
                    <td className="px-3 text-center font-mono font-semibold text-slate-600" dir="ltr">
                      {party.phone || (issued?.phoneHint ? `***${issued.phoneHint}` : '—')}
                    </td>
                    <td className="px-3 text-center">
                      {!issued ? (
                        <span className="text-slate-400 font-semibold">لم يُصدر بعد</span>
                      ) : !issued.canVerify ? (
                        <span className="rounded-md bg-amber-50 px-2 py-0.5 font-bold text-amber-800 border border-amber-200">
                          بدون هاتف (مفتوح مباشر)
                        </span>
                      ) : (
                        <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700 border border-emerald-200">
                          ✓ فعّال ومحمّي
                        </span>
                      )}
                    </td>
                    <td className="px-3 text-center font-mono font-bold tabular-nums text-slate-700">
                      {issued ? issued.viewCount : '0'}
                    </td>
                    <td className="px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {!issued ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => issue(party)}
                            className="h-8 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] px-3 font-bold text-white transition cursor-pointer shadow-2xs disabled:opacity-50"
                          >
                            إصدار باركود
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setPreview(issued)}
                              className="h-8 rounded-xl border border-slate-200 bg-white px-2.5 font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                            >
                              معاينة
                            </button>
                            <button
                              type="button"
                              onClick={() => printCard(issued)}
                              className="h-8 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] px-3 font-bold text-white transition cursor-pointer shadow-2xs"
                            >
                              طباعة البطاقة
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => revoke(issued)}
                              className="h-8 rounded-xl border border-rose-200 bg-rose-50 px-2.5 font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer disabled:opacity-50"
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
                  <td colSpan={7} className="py-12 text-center font-bold text-slate-400 text-sm">
                    لا توجد حسابات أو أطراف تطابق البحث.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Preview */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl border border-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-black text-slate-900">{preview.holderName}</h2>
            <p className="text-xs text-slate-500 font-bold mt-0.5">بطاقة الباركود لكشف الحساب</p>
            {preview.qrDataUrl ? (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl my-4 inline-block">
                <img src={preview.qrDataUrl} alt="" className="h-56 w-56 mx-auto rounded-xl shadow-xs" />
              </div>
            ) : (
              <p className="my-6 text-sm font-bold text-rose-700">تعذّر توليد صورة الباركود.</p>
            )}
            <p className="text-[11.5px] leading-relaxed text-slate-500 font-medium">
              يمسح العميل الرمز ثم يُدخل آخر 4 أرقام من هاتفه {preview.phoneHint ? `(${preview.phoneHint})` : ''} لعرض حسابه.
            </p>
            <p className="mt-3 break-all rounded-xl bg-slate-100 p-2.5 font-mono text-[10px] text-slate-600 font-bold" dir="ltr">
              {preview.url}
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => printCard(preview)}
                className="h-10 flex-1 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] font-bold text-white transition cursor-pointer shadow-xs"
              >
                طباعة البطاقة
              </button>
              <button
                type="button"
                onClick={() => {
                  const party = parties.find(
                    (p) => p.id === (preview.customerId || preview.supplierId || preview.accountId),
                  );
                  if (party) void issue(party, true);
                }}
                className="h-10 flex-1 rounded-xl border border-slate-200 hover:bg-slate-50 font-bold text-slate-700 transition cursor-pointer"
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
