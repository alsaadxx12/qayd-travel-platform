import React, { useEffect, useMemo, useState } from 'react';
import { Loader } from '@mantine/core';
import { IconUsers, IconDeviceFloppy, IconSearch } from '@tabler/icons-react';
import { employeesApi } from '../../api/employees';
import { fetchPrintTemplate, savePrintTemplate } from '../../api/printTemplates';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';

/*
 * تبويب «الموظفون وهوامش الأرباح» في إعدادات النظام.
 *
 * لكل موظف يُضبط «هامش ربح الموظف %»، وتُشتق «حصة الشركة %» تلقائياً كمتمّمٍ له
 * إلى مئة. تُحفظ الهوامش كإعدادٍ باسم employee_profit_margins مفتاحُه اسمُ الموظف
 * (كما يُسجَّل موظفَ إصدارٍ على المستندات)، فتقرؤها صفحة «أرباح الموظفين».
 */
export const EmployeesMarginsSection: React.FC = () => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [margins, setMargins] = useState<Record<string, number>>({});
  const [defaultMargin, setDefaultMargin] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [emps, cfg] = await Promise.all([
          employeesApi.getAll().catch(() => []),
          fetchPrintTemplate('employee_profit_margins').catch(() => ({ config: {} } as any)),
        ]);
        if (cancelled) return;
        const list = Array.isArray(emps) ? emps : (emps as any)?.data || [];
        setEmployees(list);
        const c = (cfg as any)?.config || {};
        setMargins(c.employees || {});
        setDefaultMargin(Number(c.defaultEmployeeMargin) || 0);
      } catch {
        /* تُترك القيم الافتراضية */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setMargin = (name: string, val: string) => {
    const n = Math.max(0, Math.min(100, Number(String(val).replace(/[^\d.]/g, '')) || 0));
    setMargins((prev) => ({ ...prev, [name]: n }));
  };

  const marginOf = (name: string) => (margins[name] !== undefined && margins[name] !== null ? margins[name] : defaultMargin);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => String(e.fullName || e.name || '').toLowerCase().includes(q));
  }, [employees, search]);

  const save = async () => {
    setSaving(true);
    try {
      await savePrintTemplate('employee_profit_margins', { employees: margins, defaultEmployeeMargin: defaultMargin }, 'هوامش أرباح الموظفين');
      showSuccessNotification('تم الحفظ', 'حُفظت هوامش الأرباح');
    } catch (e: any) {
      showErrorNotification('تعذّر الحفظ', e?.message || '');
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'h-9 w-20 px-2 rounded-lg border border-slate-300 bg-white text-[12.5px] font-mono font-black text-center text-slate-900 outline-none focus:border-[#F45A0A] focus:ring-2 focus:ring-orange-100';

  return (
    <div className="space-y-4 text-xs">
      <h3 className="font-extrabold text-sm text-slate-900 border-b pb-1 flex items-center gap-2">
        <IconUsers size={18} className="text-[#F45A0A]" />
        الموظفون وهوامش الأرباح
      </h3>
      <p className="text-slate-500 text-xs leading-relaxed">
        اضبط لكل موظف نسبة حصته من الربح الذي يحقّقه؛ وتُحسب حصة الشركة تلقائياً كمكمّلٍ لها إلى 100%. تظهر النتائج في صفحة «أرباح الموظفين».
      </p>

      {/* الهامش الافتراضي */}
      <div className="bg-orange-50/60 border border-orange-200 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="font-black text-slate-800 text-[13px]">الهامش الافتراضي للموظفين</div>
          <div className="text-[11px] font-bold text-slate-500 mt-0.5">يُطبَّق على أي موظف لم يُخصَّص له هامش صراحةً.</div>
        </div>
        <div className="flex items-center gap-1.5">
          <input value={defaultMargin} onChange={(e) => setDefaultMargin(Math.max(0, Math.min(100, Number(String(e.target.value).replace(/[^\d.]/g, '')) || 0)))} dir="ltr" className={inputCls} />
          <span className="font-black text-[#F45A0A]">%</span>
        </div>
      </div>

      {/* البحث */}
      <div className="relative">
        <IconSearch size={15} className="absolute top-1/2 -translate-y-1/2 text-slate-400" style={{ insetInlineStart: 10 }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث باسم الموظف…"
          className="w-full h-10 rounded-xl border border-slate-200 bg-white text-[13px] font-bold text-slate-900 outline-none focus:border-[#F45A0A] focus:ring-2 focus:ring-orange-100"
          style={{ paddingInlineStart: 34, paddingInlineEnd: 12 }}
        />
      </div>

      {/* جدول الموظفين */}
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-14 flex items-center justify-center"><Loader size="sm" color="orange" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-14 text-center text-sm font-black text-slate-400">لا يوجد موظفون</div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-3 py-2.5 text-[11px] font-black text-slate-500 text-start">الموظف</th>
                  <th className="px-3 py-2.5 text-[11px] font-black text-slate-500 text-start">الفرع / القسم</th>
                  <th className="px-3 py-2.5 text-[11px] font-black text-slate-500 text-center">هامش الموظف %</th>
                  <th className="px-3 py-2.5 text-[11px] font-black text-slate-500 text-center">هامش الشركة %</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  const name = e.fullName || e.name || '';
                  const m = marginOf(name);
                  return (
                    <tr key={e.id || name} className="border-b border-slate-100 hover:bg-orange-50/30 transition-colors">
                      <td className="px-3 py-2 text-[12.5px]">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-orange-50 text-[#F45A0A] flex items-center justify-center shrink-0 text-[11px] font-black">
                            {name.slice(0, 1)}
                          </div>
                          <span className="font-black text-slate-900">{name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-[11.5px] font-bold text-slate-500">
                        {[e.branchName || e.branch?.nameAr, e.departmentName || e.department?.name].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="inline-flex items-center gap-1">
                          <input value={m} onChange={(ev) => setMargin(name, ev.target.value)} dir="ltr" className={inputCls} />
                          <span className="font-black text-[#F45A0A] text-[11px]">%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="inline-block text-[12px] font-mono font-black bg-slate-100 text-slate-700 rounded-lg px-2.5 py-1.5">{100 - m}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end">
        <button
          type="button"
          disabled={saving || loading}
          onClick={save}
          className="h-10 px-5 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] disabled:bg-slate-200 disabled:text-slate-400 text-white text-[13px] font-black cursor-pointer flex items-center gap-2 shadow-2xs"
        >
          {saving ? <Loader size={15} color="white" /> : <IconDeviceFloppy size={16} />}
          حفظ هوامش الأرباح
        </button>
      </div>
    </div>
  );
};

export default EmployeesMarginsSection;
