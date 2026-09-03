import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Users,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Armchair,
  CheckCircle2,
  Clock,
  Coins,
  TrendingUp,
  Lock,
  Unlock,
  FolderOpen,
} from 'lucide-react';
import { Loader, Modal } from '@mantine/core';
import { GroupFileWorkspace } from '../../components/groups/GroupFileWorkspace';
import { matchesSearchTokens } from '../../components/ui/SearchableCombobox';
import { tourGroupsApi, type TourGroup } from '../../api/tourGroups';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { useLanguageStore } from '../../store/useLanguageStore';

/*
 * صفحة الكروبات — قائمة ملفات، لا قائمة تذاكر.
 *
 * كل بطاقة كروبٌ حقيقي من جداول tour_groups بملخّصه المحسوب في الخادم:
 * المقاعد والمبيع والمتبقي، المبيعات والمحصَّل، والربح الفعلي. الضغط عليها
 * يفتح النافذة الواحدة (ملف الكروب) حيث يجري كل شيء.
 */

const fmt = (n: number) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const money = (n: number, c: string) => `${fmt(n)} ${c === 'USD' ? '$' : 'IQD'}`;

export const GroupsPage: React.FC = () => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  const [rows, setRows] = useState<TourGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [fileOpen, setFileOpen] = useState(false);
  const [fileGroupId, setFileGroupId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TourGroup | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await tourGroupsApi.list();
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      showErrorNotification(isAr ? 'تعذّر جلب الكروبات' : 'Load failed', e?.message || '');
    } finally {
      setLoading(false);
    }
  }, [isAr]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return rows;
    return rows.filter((g) =>
      matchesSearchTokens(q, [g.groupName, g.country || '', ...g.passengers.map((p) => p.passengerName)].join(' ')),
    );
  }, [rows, search]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (a, g) => ({
          groups: a.groups + 1,
          sold: a.sold + g.summary.sold,
          seats: a.seats + g.summary.seats,
          sales: a.sales + g.summary.sales,
          outstanding: a.outstanding + g.summary.outstanding,
          profit: a.profit + g.summary.actualProfit,
        }),
        { groups: 0, sold: 0, seats: 0, sales: 0, outstanding: 0, profit: 0 },
      ),
    [rows],
  );

  const openFile = (id: string | null) => {
    setFileGroupId(id);
    setFileOpen(true);
  };

  return (
    <div className="min-h-full bg-[#F7F8FA] font-sans" dir={direction}>
      <div className="max-w-[1500px] mx-auto w-full px-4 sm:px-6 py-4 space-y-4">
        {/* ── الترويسة ── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#F45A0A] to-[#f59e0b] text-white flex items-center justify-center shadow-xs">
              <Users size={22} strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="font-black text-base text-slate-900">{isAr ? 'الكروبات' : 'Tour Groups'}</h1>
              <p className="text-[11.5px] font-bold text-slate-500 mt-0.5">
                {isAr ? 'كل كروب ملف مالي وتشغيلي كامل — افتحه لترى ملخّصه ومسافريه' : 'Each group is a full financial file'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => load()}
              className="h-[38px] w-[38px] rounded-[9px] bg-white border border-slate-200 text-slate-500 hover:text-[#F45A0A] hover:border-[#FED7AA] flex items-center justify-center transition-all cursor-pointer"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={() => openFile(null)}
              className="h-[38px] px-4 rounded-[9px] bg-[#F45A0A] hover:bg-[#DD4F05] active:scale-[0.98] text-white font-bold text-[13px] shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus size={15} strokeWidth={2.4} />
              {isAr ? 'كروب جديد' : 'New group'}
            </button>
          </div>
        </div>

        {/* ── بطاقات الإجمالي: برتقالي وأبيض فقط ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: isAr ? 'الكروبات' : 'Groups', value: String(totals.groups), sub: `${totals.sold}/${totals.seats} ${isAr ? 'مقعداً مبيعاً' : 'seats sold'}` },
            { label: isAr ? 'المبيعات' : 'Sales', value: fmt(totals.sales), sub: isAr ? 'مجموع بيع المقاعد' : 'total seat sales' },
            { label: isAr ? 'الذمم' : 'Outstanding', value: fmt(totals.outstanding), sub: isAr ? 'غير محصَّل بعد' : 'not collected yet' },
            { label: isAr ? 'الربح الفعلي' : 'Actual profit', value: fmt(totals.profit), sub: isAr ? 'بعد الشراء والمصاريف' : 'after buy & expenses' },
          ].map((c) => (
            <div key={c.label} className="relative overflow-hidden bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 min-h-[118px] flex flex-col justify-center">
              <span className="absolute inset-y-0 start-0 w-1.5 bg-gradient-to-b from-[#F45A0A] to-[#f59e0b]" />
              <p className="text-[11px] font-bold text-slate-500">{c.label}</p>
              <p className="text-2xl font-black text-slate-900 mt-1 font-mono" dir="ltr">{c.value}</p>
              <p className="text-[10.5px] font-bold text-[#F45A0A]/70 mt-1">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* ── البحث ── */}
        <div className="relative">
          <Search size={15} className={`absolute top-1/2 -translate-y-1/2 text-slate-400 ${direction === 'rtl' ? 'right-3' : 'left-3'}`} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? 'ابحث باسم الكروب أو الوجهة أو مسافر…' : 'Search…'}
            className={`w-full h-[42px] rounded-xl bg-white border border-slate-200 text-[13px] font-bold text-slate-900 outline-none focus:border-[#F45A0A] focus:ring-2 focus:ring-orange-100 transition-all ${direction === 'rtl' ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
          />
        </div>

        {/* ── القائمة ── */}
        {loading && rows.length === 0 ? (
          <div className="py-24 flex items-center justify-center gap-3 text-sm font-bold text-slate-500">
            <Loader size="sm" color="orange" /> {isAr ? 'جارٍ جلب الكروبات…' : 'Loading…'}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center space-y-2">
            <p className="text-sm font-black text-slate-600">{isAr ? 'لا كروبات بعد' : 'No groups yet'}</p>
            <p className="text-xs font-bold text-slate-400">
              {isAr ? 'أنشئ كروباً، صمّم أنظمة أسعاره، افتح البيع، ثم بِع المقاعد' : 'Create a group, add price systems, open sale'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((g) => {
              const s = g.summary;
              return (
                <div
                  key={g.id}
                  onClick={() => openFile(g.id)}
                  className="group bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md hover:border-[#FED7AA] transition-all cursor-pointer p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-[13.5px] text-slate-900 truncate">{g.groupName}</h3>
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-black rounded px-1.5 py-0.5 border shrink-0 ${
                            g.openSale ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {g.openSale ? <Unlock size={10} /> : <Lock size={10} />}
                          {g.openSale ? (isAr ? 'البيع مفتوح' : 'Open') : isAr ? 'مقفل' : 'Closed'}
                        </span>
                      </div>
                      <p className="text-[11px] font-bold text-slate-500 mt-0.5 truncate">
                        {g.country || '—'} · {g.travelDate ? new Date(g.travelDate).toLocaleDateString('en-GB') : isAr ? 'بلا تاريخ' : 'no date'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openFile(g.id);
                        }}
                        title={isAr ? 'فتح الملف' : 'Open file'}
                        className="w-7 h-7 rounded-lg text-slate-400 hover:text-[#F45A0A] hover:bg-orange-50 flex items-center justify-center cursor-pointer"
                      >
                        <FolderOpen size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(g);
                        }}
                        title={isAr ? 'حذف' : 'Delete'}
                        className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* شريط المقاعد */}
                  <div>
                    <div className="flex items-center justify-between text-[10.5px] font-black text-slate-600 mb-1">
                      <span className="inline-flex items-center gap-1">
                        <Armchair size={11} className="text-[#F45A0A]" /> {s.sold}/{s.seats} {isAr ? 'مقعداً' : 'seats'}
                      </span>
                      <span className={s.remaining > 0 ? 'text-slate-500' : 'text-rose-600'}>
                        {s.remaining > 0 ? `${s.remaining} ${isAr ? 'متبقٍ' : 'left'}` : isAr ? 'نفدت' : 'full'}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#F45A0A] to-[#f59e0b] transition-all"
                        style={{ width: `${s.seats > 0 ? Math.min(100, (s.sold / s.seats) * 100) : 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-slate-50 py-2">
                      <p className="text-[10px] font-bold text-slate-500 flex items-center justify-center gap-1"><Coins size={10} /> {isAr ? 'مبيعات' : 'Sales'}</p>
                      <p className="text-[12px] font-mono font-black text-slate-900 mt-0.5" dir="ltr">{money(s.sales, g.currency)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 py-2">
                      <p className="text-[10px] font-bold text-slate-500 flex items-center justify-center gap-1"><CheckCircle2 size={10} /> {isAr ? 'محصَّل' : 'Collected'}</p>
                      <p className="text-[12px] font-mono font-black text-emerald-700 mt-0.5" dir="ltr">{money(s.collected, g.currency)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 py-2">
                      <p className="text-[10px] font-bold text-slate-500 flex items-center justify-center gap-1"><TrendingUp size={10} /> {isAr ? 'ربح فعلي' : 'Profit'}</p>
                      <p className={`text-[12px] font-mono font-black mt-0.5 ${s.actualProfit >= 0 ? 'text-slate-900' : 'text-rose-600'}`} dir="ltr">{money(s.actualProfit, g.currency)}</p>
                    </div>
                  </div>

                  {s.notComplete > 0 && (
                    <p className="text-[10.5px] font-bold text-amber-700 flex items-center gap-1">
                      <Clock size={11} /> {s.notComplete} {isAr ? 'مسافراً بخدمات غير مكتملة' : 'passengers not complete'}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* النافذة الواحدة */}
      <GroupFileWorkspace
        opened={fileOpen}
        groupId={fileGroupId}
        onClose={() => {
          setFileOpen(false);
          setFileGroupId(null);
          load(true);
        }}
        onChanged={() => load(true)}
      />

      {/* تأكيد الحذف */}
      <Modal opened={!!deleteTarget} onClose={() => setDeleteTarget(null)} centered radius="lg" withCloseButton={false} zIndex={10050}>
        {deleteTarget && (
          <div className="space-y-3 font-sans" dir={direction}>
            <p className="font-black text-sm text-slate-900">{isAr ? 'حذف الكروب؟' : 'Delete group?'}</p>
            <p className="text-xs font-bold text-slate-600 leading-relaxed">
              {isAr
                ? `سيُحذف «${deleteTarget.groupName}» بكل أنظمته ومسافريه وخدماتهم (${deleteTarget.summary.passengers} مسافراً) نهائياً.`
                : `"${deleteTarget.groupName}" and everything in it will be deleted.`}
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="h-9 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await tourGroupsApi.remove(deleteTarget.id);
                    showSuccessNotification(isAr ? 'حُذف' : 'Deleted', deleteTarget.groupName);
                    setDeleteTarget(null);
                    load(true);
                  } catch (e: any) {
                    showErrorNotification(isAr ? 'تعذّر الحذف' : 'Failed', e?.message || '');
                  } finally {
                    setDeleting(false);
                  }
                }}
                className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-black cursor-pointer flex items-center gap-1.5"
              >
                {deleting && <Loader size={12} color="white" />}
                {isAr ? 'حذف نهائي' : 'Delete'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default GroupsPage;
