import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader } from '@mantine/core';
import { Users, RefreshCw, TrendingUp, Wallet, Building2, Search, BadgePercent } from 'lucide-react';
import { getEmployeeProfits, type EmployeeProfitRow } from '../api/reports';
import { matchesSearchTokens } from '../components/ui/SearchableCombobox';
import { showErrorNotification } from '../utils/notifications';
import { useLanguageStore } from '../store/useLanguageStore';

/*
 * أرباح الموظفين — بنفس نظام التصميم: ترويسة برتقالية/بيضاء، بطاقات مؤشرات،
 * وجدول. يعرض ربح كل موظف (من مستندات إصداره) مقسوماً بينه وبين الشركة وفق
 * هامش الربح المحفوظ في «إعدادات النظام ← الموظفون». الأرقام إنجليزية واضحة.
 */

const fmt = (n: number) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const money = (n: number) => `${fmt(n)} $`;

const todayISO = () => new Date().toISOString().slice(0, 10);
const yearStartISO = () => `${new Date().getFullYear()}-01-01`;

export const EmployeeProfitsPage: React.FC = () => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  const [rows, setRows] = useState<EmployeeProfitRow[]>([]);
  const [totals, setTotals] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState(yearStartISO());
  const [endDate, setEndDate] = useState(todayISO());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getEmployeeProfits({ startDate, endDate });
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setTotals(data.totals || null);
    } catch (e: any) {
      showErrorNotification(isAr ? 'تعذّر جلب أرباح الموظفين' : 'Load failed', e?.message || '');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, isAr]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return rows;
    return rows.filter((r) => matchesSearchTokens(q, r.employeeName));
  }, [rows, search]);

  const cards = [
    { label: isAr ? 'إجمالي الأرباح' : 'Total Profit', value: fmt(totals?.totalProfit || 0), sub: isAr ? 'ربح المستندات كاملاً' : 'gross profit', icon: TrendingUp },
    { label: isAr ? 'حصة الموظفين' : 'Employees Share', value: fmt(totals?.employeeShare || 0), sub: isAr ? 'وفق هوامش الأرباح' : 'per margins', icon: Wallet },
    { label: isAr ? 'حصة الشركة' : 'Company Share', value: fmt(totals?.companyShare || 0), sub: isAr ? 'الباقي بعد الموظفين' : 'remainder', icon: Building2 },
    { label: isAr ? 'عدد الموظفين' : 'Employees', value: String(rows.length), sub: `${totals?.docCount || 0} ${isAr ? 'مستنداً' : 'docs'}`, icon: Users },
  ];

  const th = 'px-3 py-2.5 text-[11px] font-black text-slate-500 whitespace-nowrap';
  const td = 'px-3 py-2.5 text-[12px] whitespace-nowrap';

  return (
    <div className="min-h-full bg-[#F8FAFC] font-sans pb-10" dir={direction}>
      <div className="max-w-[1500px] mx-auto w-full px-4 sm:px-6 py-4 space-y-4">
        {/* ── الترويسة ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-orange-50 border border-orange-200/80 text-[#F45A0A] flex items-center justify-center shadow-2xs shrink-0">
              <BadgePercent size={22} strokeWidth={2.4} />
            </div>
            <div>
              <h1 className="font-black text-base sm:text-lg text-slate-900 leading-none">
                {isAr ? 'أرباح الموظفين' : 'Employee Profits'}
              </h1>
              <p className="text-xs font-bold text-slate-500 mt-1">
                {isAr ? 'ربح كل موظف مقسوماً بينه وبين الشركة وفق هوامش الأرباح' : 'Each employee profit split with the company by margin'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2 h-[38px] shadow-2xs">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-full bg-transparent text-[12px] font-bold text-slate-800 outline-none font-mono" dir="ltr" />
              <span className="text-slate-300">→</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-full bg-transparent text-[12px] font-bold text-slate-800 outline-none font-mono" dir="ltr" />
            </div>
            <button
              type="button"
              onClick={load}
              className="h-[38px] w-[38px] rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-[#F45A0A] hover:border-orange-300 hover:bg-orange-50/40 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* ── بطاقات المؤشرات ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.label} className="relative overflow-hidden bg-white rounded-xl border border-slate-200 shadow-2xs p-4 min-h-[118px] flex flex-col justify-between hover:border-orange-200 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">{c.label}</span>
                  <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#F45A0A] flex items-center justify-center border border-orange-100">
                    <Icon size={16} />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-2xl font-black text-slate-900 font-mono tracking-tight" dir="ltr">{c.value}</div>
                  <p className="text-[10.5px] font-bold text-[#F45A0A]/70 mt-1">{c.sub}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── البحث ── */}
        <div className="relative">
          <Search size={15} className={`absolute top-1/2 -translate-y-1/2 text-slate-400 ${direction === 'rtl' ? 'right-3' : 'left-3'}`} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? 'ابحث باسم الموظف…' : 'Search employee…'}
            className={`w-full h-[42px] rounded-xl bg-white border border-slate-200 text-[13px] font-bold text-slate-900 outline-none focus:border-[#F45A0A] focus:ring-2 focus:ring-orange-100 transition-all ${direction === 'rtl' ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
          />
        </div>

        {/* ── الجدول ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className={`${th} text-start`}>{isAr ? 'الموظف' : 'Employee'}</th>
                  <th className={`${th} text-center`}>{isAr ? 'المستندات' : 'Docs'}</th>
                  <th className={`${th} text-end`}>{isAr ? 'المبيعات' : 'Sales'}</th>
                  <th className={`${th} text-end`}>{isAr ? 'إجمالي الربح' : 'Profit'}</th>
                  <th className={`${th} text-center`}>{isAr ? 'هامش الموظف' : 'Emp %'}</th>
                  <th className={`${th} text-end`}>{isAr ? 'حصة الموظف' : 'Emp Share'}</th>
                  <th className={`${th} text-end`}>{isAr ? 'حصة الشركة' : 'Company Share'}</th>
                </tr>
              </thead>
              <tbody>
                {loading && rows.length === 0 ? (
                  <tr><td colSpan={7} className="py-16 text-center"><Loader size="sm" color="orange" /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="py-16 text-center text-sm font-black text-slate-400">{isAr ? 'لا أرباح في هذه الفترة' : 'No profits in this range'}</td></tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.employeeName} className="border-b border-slate-100 hover:bg-orange-50/30 transition-colors">
                      <td className={`${td} text-start`}>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-orange-50 text-[#F45A0A] flex items-center justify-center shrink-0 text-[11px] font-black">
                            {r.employeeName.slice(0, 1)}
                          </div>
                          <span className="font-black text-slate-900">{r.employeeName}</span>
                        </div>
                      </td>
                      <td className={`${td} text-center font-mono font-bold text-slate-600`}>{r.docCount}</td>
                      <td className={`${td} text-end font-mono font-bold text-slate-700`} dir="ltr">{money(r.totalSales)}</td>
                      <td className={`${td} text-end font-mono font-black ${r.totalProfit >= 0 ? 'text-slate-900' : 'text-rose-600'}`} dir="ltr">{money(r.totalProfit)}</td>
                      <td className={`${td} text-center`}>
                        <span className="inline-block text-[11px] font-black bg-orange-50 text-[#F45A0A] border border-orange-200 rounded-full px-2 py-0.5 font-mono">{r.employeeMargin}%</span>
                      </td>
                      <td className={`${td} text-end font-mono font-black text-emerald-700`} dir="ltr">{money(r.employeeShare)}</td>
                      <td className={`${td} text-end font-mono font-black text-slate-800`} dir="ltr">{money(r.companyShare)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {filtered.length > 0 && totals && (
                <tfoot>
                  <tr className="bg-orange-50/60 border-t-2 border-orange-200 font-black">
                    <td className={`${td} text-start text-[#F45A0A]`}>{isAr ? 'الإجمالي' : 'Total'}</td>
                    <td className={`${td} text-center font-mono text-slate-700`}>{totals.docCount}</td>
                    <td className={`${td} text-end font-mono text-slate-800`} dir="ltr">{money(totals.totalSales)}</td>
                    <td className={`${td} text-end font-mono text-slate-900`} dir="ltr">{money(totals.totalProfit)}</td>
                    <td className={`${td} text-center`}>—</td>
                    <td className={`${td} text-end font-mono text-emerald-700`} dir="ltr">{money(totals.employeeShare)}</td>
                    <td className={`${td} text-end font-mono text-slate-900`} dir="ltr">{money(totals.companyShare)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <p className="text-[11px] font-bold text-slate-400 text-center">
          {isAr
            ? 'تُضبط هوامش الربح لكل موظف من: إعدادات النظام ← الموظفون.'
            : 'Set each employee margin in: System Settings → Employees.'}
        </p>
      </div>
    </div>
  );
};

export default EmployeeProfitsPage;
