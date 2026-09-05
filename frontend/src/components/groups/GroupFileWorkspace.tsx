import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader, Menu, Modal } from '@mantine/core';
import {
  X,
  Users,
  Plus,
  Trash2,
  Lock,
  Unlock,
  Ticket,
  Building2,
  FileCheck2,
  ShieldCheck,
  Bus,
  UserCheck,
  Package,
  Coins,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  Ban,
  Calendar,
  MapPin,
  TrendingUp,
  Banknote,
  DollarSign,
  User,
  Search,
} from 'lucide-react';
import { SearchableCombobox } from '../ui/SearchableCombobox';
import { SegmentedDatePicker } from '../ui/SegmentedDatePicker';
import { AccountFinderModal, type AccountFinderResult } from '../common/AccountFinderModal';
import { partnersApi } from '../../api/partners';
import { WORLD_CITIES } from '../../data/worldCities';
import {
  tourGroupsApi,
  type TourGroup,
  type GroupPassenger,
  type GroupPassengerService,
  type GroupPriceSystem,
} from '../../api/tourGroups';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { useLanguageStore } from '../../store/useLanguageStore';

/**
 * النافذة الواحدة لملف الكروب السياحي
 * - بحث متقدم عن المورد (SearchableCombobox)
 * - إلغاء كلمة "متوقع" نهائياً واستبدالها بـ "سعر الشراء"
 * - نوافذ عريضة بانحناء أنيق (rounded-2xl) وخالية من البيانات التوضيحية الزائدة
 * - إلغاء المقاعد بالكامل
 */

const KIND_META: Record<string, { ar: string; icon: any; color: string }> = {
  TICKET: { ar: 'طيران', icon: Ticket, color: 'text-sky-600 bg-sky-50 border-sky-200' },
  HOTEL: { ar: 'فندق', icon: Building2, color: 'text-violet-600 bg-violet-50 border-violet-200' },
  VISA: { ar: 'فيزا', icon: FileCheck2, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  INSURANCE: { ar: 'تأمين', icon: ShieldCheck, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  TRANSPORT: { ar: 'نقل', icon: Bus, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  GUIDE: { ar: 'مرشد', icon: UserCheck, color: 'text-teal-600 bg-teal-50 border-teal-200' },
  PACKAGE: { ar: 'باكج', icon: Package, color: 'text-orange-600 bg-orange-50 border-orange-200' },
};

const fmt = (n: number) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const money = (v: number, c = 'USD') => `${fmt(v)} ${c === 'USD' ? '$' : 'IQD'}`;
const num = (raw: any) => Number(String(raw ?? '').replace(/,/g, '')) || 0;

const inputClass =
  'w-full h-[46px] px-3.5 rounded-[11px] border border-[#E5E7EB] bg-[#FAFAFA] hover:bg-white hover:border-[#D1D5DB] focus:bg-white text-xs font-bold text-slate-900 focus:outline-none focus:border-2 focus:border-[#F45A0A] transition-colors duration-150';

const Field: React.FC<{
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ label, action, children, className = '' }) => (
  <div className={className}>
    <div className="flex items-center justify-between gap-2 mb-1 min-h-[20px]">
      <label className="text-xs font-bold text-slate-700 block leading-[20px]">{label}</label>
      {action}
    </div>
    {children}
  </div>
);

/* ── الملخّص المالي والتشغيلي: 4 بطاقات بدون مقاعد ── */
const SummaryBlock: React.FC<{ g: TourGroup; isAr: boolean }> = ({ g, isAr }) => {
  const s = g.summary;
  const C = g.currency;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {/* 1. إجمالي المسافرين */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500">{isAr ? 'المسافرون' : 'Passengers'}</span>
          <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#F45A0A] flex items-center justify-center border border-orange-100">
            <Users size={16} />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-black text-slate-900 font-mono tracking-tight" dir="ltr">
            {g.passengers.length}
          </div>
          <div className="flex items-center justify-between text-[11px] font-bold mt-1">
            <span className="text-emerald-700 font-mono">
              {s.complete} {isAr ? 'مكتمل' : 'Complete'}
            </span>
            <span className="text-amber-700 font-mono">
              {s.notComplete} {isAr ? 'معلّق' : 'Pending'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. المبيعات */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500">{isAr ? 'المبيعات والتحصيل' : 'Sales'}</span>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <Coins size={16} />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-black text-slate-900 font-mono tracking-tight" dir="ltr">
            {money(s.sales, C)}
          </div>
          <div className="flex items-center justify-between text-[11px] font-bold mt-1">
            <span className="text-emerald-700 font-mono" dir="ltr">
              {isAr ? 'محصل:' : 'Paid:'} {money(s.collected, C)}
            </span>
          </div>
        </div>
      </div>

      {/* 3. الذمم المتبقية */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500">{isAr ? 'الذمم المتبقية' : 'Outstanding'}</span>
          <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
            <Banknote size={16} />
          </div>
        </div>
        <div className="mt-2">
          <div className={`text-2xl font-black font-mono tracking-tight ${s.outstanding > 0 ? 'text-rose-600' : 'text-slate-400'}`} dir="ltr">
            {money(s.outstanding, C)}
          </div>
          <div className="text-[11px] font-bold text-slate-400 mt-1">
            {s.outstanding > 0 ? (isAr ? 'مستحق على العملاء' : 'Pending payment') : (isAr ? 'لا توجد ذمم' : 'No dues')}
          </div>
        </div>
      </div>

      {/* 4. صافي الأرباح */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500">{isAr ? 'صافي الربح' : 'Net Profit'}</span>
          <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#F45A0A] flex items-center justify-center border border-orange-100">
            <TrendingUp size={16} />
          </div>
        </div>
        <div className="mt-2">
          <div
            className={`text-2xl font-black font-mono tracking-tight ${
              s.actualProfit >= 0 ? 'text-[#F45A0A]' : 'text-rose-600'
            }`}
            dir="ltr"
          >
            {money(s.actualProfit, C)}
          </div>
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mt-1">
            <span className="font-mono" dir="ltr">
              {isAr ? 'تكلفة:' : 'Cost:'} {money(s.actualCost, C)}
            </span>
            <span className="font-mono text-slate-400" dir="ltr">
              {isAr ? 'مصاريف:' : 'Exp:'} {money(s.expenses, C)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

interface Props {
  opened: boolean;
  groupId: string | null;
  onClose: () => void;
  onChanged?: () => void;
}

export const GroupFileWorkspace: React.FC<Props> = ({ opened, groupId, onClose, onChanged }) => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  const [g, setG] = useState<TourGroup | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [openPax, setOpenPax] = useState<string | null>(null);
  const [paxModal, setPaxModal] = useState(false);
  const [psModal, setPsModal] = useState<Partial<GroupPriceSystem> | null>(null);
  const [chargeModal, setChargeModal] = useState<'GLOBAL_PURCHASE' | 'EXPENSE' | null>(null);

  const run = useCallback(
    async (op: () => Promise<TourGroup>, okMsg?: string) => {
      setBusy(true);
      try {
        const next = await op();
        setG(next);
        onChanged?.();
        if (okMsg) showSuccessNotification(isAr ? 'تم' : 'Done', okMsg);
        return next;
      } catch (err: any) {
        showErrorNotification(isAr ? 'تعذّر التنفيذ' : 'Failed', err?.message || '');
        return null;
      } finally {
        setBusy(false);
      }
    },
    [isAr, onChanged],
  );

  useEffect(() => {
    if (!opened) return;
    setOpenPax(null);
    partnersApi
      .getCustomers()
      .then((d: any) => setCustomers(Array.isArray(d) ? d : d?.data || []))
      .catch(() => undefined);
    partnersApi
      .getSuppliers()
      .then((d: any) => setSuppliers(Array.isArray(d) ? d : d?.data || []))
      .catch(() => undefined);

    if (groupId) {
      setLoading(true);
      tourGroupsApi
        .getOne(groupId)
        .then(setG)
        .catch((e) => showErrorNotification(isAr ? 'تعذّر فتح الملف' : 'Open failed', e?.message || ''))
        .finally(() => setLoading(false));
    } else {
      setG(null);
    }
  }, [opened, groupId, isAr]);

  const customerOptions = useMemo(
    () =>
      customers.map((c: any) => ({
        value: c.nameAr || c.name || c.id,
        label: c.nameAr || c.name || '',
        code: c.code,
      })),
    [customers],
  );

  const supplierOptions = useMemo(
    () =>
      suppliers.map((s: any) => ({
        value: s.nameAr || s.name || s.id,
        label: s.nameAr || s.name || '',
        code: s.code,
      })),
    [suppliers],
  );

  if (!opened) return null;

  /* ── إنشاء كروب جديد: تصميم قياسي ── */
  if (!g && !loading) {
    return (
      <NewGroupModal
        opened={opened}
        direction={direction}
        isAr={isAr}
        onClose={onClose}
        onCreated={(created) => {
          setG(created);
          onChanged?.();
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[9998] bg-[#F8FAFC] flex flex-col font-sans" dir={direction}>
      {/* ── 1. الترويسة ── */}
      <div className="bg-white border-b border-slate-200 shadow-2xs shrink-0">
        <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200/80 text-[#F45A0A] flex items-center justify-center shrink-0">
              <Users size={20} strokeWidth={2.4} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-black text-sm sm:text-base text-slate-900 truncate">{g?.groupName || '…'}</h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-orange-50 text-[#F45A0A] border border-orange-200/70 font-mono" dir="ltr">
                  {g?.currency || 'USD'}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-500 mt-0.5 flex items-center gap-2">
                <span className="inline-flex items-center gap-1">
                  <MapPin size={12} className="text-[#F45A0A]" />
                  <span>{g?.country || '—'}</span>
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1 font-mono" dir="ltr">
                  <Calendar size={12} className="text-slate-400" />
                  <span>{g?.travelDate ? new Date(g.travelDate).toLocaleDateString('en-GB') : (isAr ? 'بلا تاريخ سفر' : 'no date')}</span>
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {g && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(
                    () => tourGroupsApi.update(g.id, { openSale: !g.openSale }),
                    g.openSale ? (isAr ? 'أُغلق البيع' : 'Sale closed') : isAr ? 'فُتح البيع' : 'Sale opened',
                  )
                }
                className={`h-[38px] px-3.5 rounded-xl text-xs font-black cursor-pointer flex items-center gap-1.5 border transition-all shadow-2xs ${
                  g.openSale
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                    : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                }`}
              >
                {g.openSale ? <Unlock size={14} /> : <Lock size={14} />}
                <span>{g.openSale ? (isAr ? 'البيع مفتوح' : 'Sale Open') : isAr ? 'البيع مقفل' : 'Sale Closed'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="h-[38px] w-[38px] rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 flex items-center justify-center cursor-pointer transition-colors shadow-2xs"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. جسم الملف ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 py-4 pb-20 space-y-4">
          {loading || !g ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-xs font-bold text-slate-500">
              <Loader size="sm" color="orange" />
              <span>{isAr ? 'جارٍ تحميل ملف الكروب…' : 'Loading tour group…'}</span>
            </div>
          ) : (
            <>
              {/* ١) الملخّص المالي والتشغيلي */}
              <SummaryBlock g={g} isAr={isAr} />

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                {/* ٢) أنظمة الأسعار */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Coins size={16} className="text-[#F45A0A]" />
                      <h3 className="font-black text-xs sm:text-sm text-slate-900">
                        {isAr ? 'أنظمة الأسعار' : 'Price Systems'}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-slate-100 text-slate-700 font-mono">
                        {g.priceSystems.length}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPsModal({ name: '', currency: g.currency, salePrice: 0, items: [] })}
                      className="h-8 px-3 rounded-lg bg-[#F45A0A] hover:bg-[#DD4F05] text-white text-xs font-black cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <Plus size={14} />
                      <span>{isAr ? 'نظام جديد' : 'New'}</span>
                    </button>
                  </div>

                  {g.priceSystems.length === 0 ? (
                    <div className="py-8 text-center space-y-1">
                      <p className="text-xs font-black text-slate-600">
                        {isAr ? 'لا يوجد نظام أسعار' : 'No price systems'}
                      </p>
                      <p className="text-[11px] font-bold text-slate-400">
                        {isAr ? 'أضف نظام أسعار لتحديد سعر البيع وبنود الخدمات التلقائية.' : 'Add price systems to define sales pricing.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {g.priceSystems.map((ps) => (
                        <div key={ps.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2 hover:bg-slate-50 transition-colors">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-xs text-slate-900">{ps.name}</span>
                              <span className="text-xs font-mono font-black text-slate-900 bg-white border border-slate-200 rounded-md px-2 py-0.5" dir="ltr">
                                {money(ps.salePrice, ps.currency)}
                              </span>
                              {!ps.active && (
                                <span className="text-[10px] font-bold bg-slate-200 text-slate-600 rounded px-1.5 py-0.5">
                                  {isAr ? 'معطَّل' : 'inactive'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setPsModal({ ...ps, items: ps.items.map((i) => ({ ...i })) })}
                                className="h-7 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-[#F45A0A] hover:bg-orange-50 cursor-pointer"
                              >
                                {isAr ? 'تعديل' : 'Edit'}
                              </button>
                              <button
                                type="button"
                                onClick={() => run(() => tourGroupsApi.removePriceSystem(g.id, ps.id))}
                                className="h-7 w-7 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:border-rose-300 flex items-center justify-center cursor-pointer"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {ps.items.map((it, i) => {
                              const meta = KIND_META[it.kind] || KIND_META.PACKAGE;
                              const Icon = meta.icon;
                              return (
                                <span
                                  key={i}
                                  className={`inline-flex items-center gap-1 text-[11px] font-bold border rounded-lg px-2 py-1 ${meta.color}`}
                                >
                                  <Icon size={12} />
                                  <span>{isAr ? meta.ar : it.kind}</span>
                                  <span className="font-mono text-slate-900 font-black" dir="ltr">
                                    {money(it.expectedBuy, it.currency || ps.currency)}
                                  </span>
                                  {it.supplierName && <span className="text-slate-600">({it.supplierName})</span>}
                                </span>
                              );
                            })}
                            {ps.items.length === 0 && (
                              <span className="text-[11px] font-bold text-slate-400">
                                {isAr ? 'بلا بنود خدمات' : 'No service items'}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ٣) المشتريات والمصاريف */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Banknote size={16} className="text-[#F45A0A]" />
                      <h3 className="font-black text-xs sm:text-sm text-slate-900">
                        {isAr ? 'المصاريف والمشتريات' : 'Purchases & Expenses'}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-slate-100 text-slate-700 font-mono">
                        {g.charges.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setChargeModal('GLOBAL_PURCHASE')}
                        className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:border-[#F45A0A] hover:text-[#F45A0A] cursor-pointer shadow-2xs"
                      >
                        + {isAr ? 'شراء عام' : 'Purchase'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setChargeModal('EXPENSE')}
                        className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:border-rose-400 hover:text-rose-600 cursor-pointer shadow-2xs"
                      >
                        + {isAr ? 'مصروف' : 'Expense'}
                      </button>
                    </div>
                  </div>

                  {g.charges.length === 0 ? (
                    <div className="py-8 text-center space-y-1">
                      <p className="text-xs font-black text-slate-600">
                        {isAr ? 'لا توجد مصاريف عامة' : 'No global charges'}
                      </p>
                      <p className="text-[11px] font-bold text-slate-400">
                        {isAr ? 'أضف مصاريف الدعاية أو استئجار الباصات والتكاليف المشتركة.' : 'Add bus rental, marketing, or general tour expenses.'}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {g.charges.map((c) => (
                        <div key={c.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`text-[10.5px] font-black rounded-md px-2 py-0.5 border shrink-0 ${
                                c.chargeType === 'EXPENSE'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-sky-50 text-sky-800 border-sky-200'
                              }`}
                            >
                              {c.chargeType === 'EXPENSE' ? (isAr ? 'مصروف' : 'EXP') : isAr ? 'شراء' : 'BUY'}
                            </span>
                            <span className="font-black text-slate-900 truncate">{c.category}</span>
                            {c.supplierName && <span className="text-slate-500 truncate">({c.supplierName})</span>}
                          </div>
                          <div className="flex items-center gap-2.5 shrink-0">
                            <span className="font-mono font-black text-slate-900" dir="ltr">
                              {money(c.amount, c.currency)}
                            </span>
                            <button
                              type="button"
                              onClick={() => run(() => tourGroupsApi.removeCharge(g.id, c.id))}
                              className="h-7 w-7 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-300 flex items-center justify-center cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ٤) المسافرون وخدماتهم */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-[#F45A0A]" />
                    <h3 className="font-black text-xs sm:text-sm text-slate-900">
                      {isAr ? 'المسافرون' : 'Passengers'}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-orange-50 text-[#F45A0A] border border-orange-200/70 font-mono" dir="ltr">
                      {g.passengers.length} {isAr ? 'مسافراً' : 'pax'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPaxModal(true)}
                    className="h-8 px-3.5 rounded-lg bg-[#F45A0A] hover:bg-[#DD4F05] text-white text-xs font-black cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  >
                    <Plus size={14} />
                    <span>{isAr ? 'إضافة مسافر' : 'Add Passenger'}</span>
                  </button>
                </div>

                {g.passengers.length === 0 ? (
                  <div className="py-10 text-center space-y-1">
                    <p className="text-xs font-black text-slate-600">
                      {isAr ? 'لا يوجد مسافرون مسجلون بعد' : 'No passengers yet'}
                    </p>
                    <p className="text-[11px] font-bold text-slate-400">
                      {isAr ? 'اضغط على «إضافة مسافر» لتسجيل المسافرين وتوليد بنود خدماتهم.' : 'Click "Add Passenger" to register passengers.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {g.passengers.map((p) => (
                      <PassengerRow
                        key={p.id}
                        g={g}
                        p={p}
                        isAr={isAr}
                        supplierOptions={supplierOptions}
                        open={openPax === p.id}
                        toggle={() => setOpenPax(openPax === p.id ? null : p.id)}
                        run={run}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── النوافذ الفرعية ── */}
      {g && psModal && (
        <PriceSystemModal
          isAr={isAr}
          direction={direction}
          draft={psModal}
          groupCurrency={g.currency}
          supplierOptions={supplierOptions}
          onClose={() => setPsModal(null)}
          onSave={async (dto) => {
            const ok = await run(() => tourGroupsApi.savePriceSystem(g.id, dto), isAr ? 'حُفظ نظام الأسعار' : 'Saved');
            if (ok) setPsModal(null);
          }}
        />
      )}

      {g && chargeModal && (
        <ChargeModal
          isAr={isAr}
          direction={direction}
          chargeType={chargeModal}
          currency={g.currency}
          supplierOptions={supplierOptions}
          onClose={() => setChargeModal(null)}
          onSave={async (dto) => {
            const ok = await run(() => tourGroupsApi.addCharge(g.id, dto));
            if (ok) setChargeModal(null);
          }}
        />
      )}

      {g && paxModal && (
        <PassengerModal
          isAr={isAr}
          direction={direction}
          g={g}
          customerOptions={customerOptions}
          onClose={() => setPaxModal(false)}
          onSave={async (dto) => {
            const ok = await run(() => tourGroupsApi.addPassenger(g.id, dto), isAr ? 'أُضيف المسافر وأُنشئت خدماته' : 'Passenger added');
            if (ok) setPaxModal(false);
          }}
        />
      )}
    </div>
  );
};

/* ── صف المسافر: كارد أنيق قابل للطي مع الخدمات والمبالغ ── */
const PassengerRow: React.FC<{
  g: TourGroup;
  p: GroupPassenger;
  isAr: boolean;
  supplierOptions: Array<{ value: string; label: string; code?: string }>;
  open: boolean;
  toggle: () => void;
  run: (op: () => Promise<TourGroup>, ok?: string) => Promise<TourGroup | null>;
}> = ({ g, p, isAr, supplierOptions, open, toggle, run }) => {
  const done = p.services.length > 0 && p.services.every((s) => s.status === 'COMPLETE');
  const cancelled = p.state === 'CANCELLED';
  const outstanding = Number(p.salePrice) - Number(p.collectedAmount);

  return (
    <div
      className={`rounded-xl border transition-all ${
        cancelled
          ? 'border-slate-200 bg-slate-50/60 opacity-60'
          : done
          ? 'border-emerald-200 bg-white'
          : 'border-slate-200 bg-white'
      }`}
    >
      <div
        onClick={toggle}
        className="w-full flex items-center justify-between gap-3 p-3 cursor-pointer text-start select-none hover:bg-slate-50/50 rounded-xl"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {cancelled ? (
            <Ban size={16} className="text-slate-400 shrink-0" />
          ) : done ? (
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          ) : (
            <Clock size={16} className="text-amber-600 shrink-0" />
          )}
          <span className="font-black text-xs sm:text-sm text-slate-900 truncate">{p.passengerName}</span>
          {p.customerName && p.customerName !== p.passengerName && (
            <span className="text-[11px] font-bold text-slate-500 truncate">({p.customerName})</span>
          )}
          <span
            className={`text-[10px] font-black rounded-md px-2 py-0.5 border shrink-0 ${
              cancelled
                ? 'bg-slate-100 text-slate-500 border-slate-200'
                : done
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            {cancelled ? (isAr ? 'ملغى' : 'Cancelled') : done ? (isAr ? 'مكتمل' : 'Complete') : (isAr ? 'معلّق' : 'Pending')}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0 text-xs font-mono font-black" dir="ltr">
          <span className="text-slate-900">{money(p.salePrice, p.currency)}</span>
          {outstanding > 0 && !cancelled ? (
            <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
              -{money(outstanding, p.currency)}
            </span>
          ) : (
            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {isAr ? 'مدفوع' : 'Paid'}
            </span>
          )}
          {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-100 p-3 space-y-2 bg-slate-50/40">
          <div className="space-y-1.5">
            {p.services.map((sv) => (
              <ServiceLine key={sv.id} g={g} sv={sv} isAr={isAr} supplierOptions={supplierOptions} run={run} disabled={cancelled} />
            ))}
          </div>

          {p.services.length === 0 && (
            <p className="text-xs font-bold text-slate-400 py-1">
              {isAr ? 'لا توجد خدمات لهذا المسافر' : 'No services'}
            </p>
          )}

          {!cancelled && (
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/80 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">{isAr ? 'تحصيل:' : 'Collect:'}</span>
                <CollectBox g={g} p={p} isAr={isAr} run={run} />
              </div>
              <button
                type="button"
                onClick={() =>
                  run(
                    () => tourGroupsApi.updatePassenger(g.id, p.id, { state: 'CANCELLED' }),
                    isAr ? 'أُلغي المسافر' : 'Cancelled',
                  )
                }
                className="h-8 px-3 rounded-lg border border-rose-200 bg-white text-rose-700 text-xs font-bold hover:bg-rose-50 cursor-pointer shadow-2xs"
              >
                {isAr ? 'إلغاء الحجز' : 'Cancel'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ── سطر الخدمة مع بحث متقدم عن المورد ── */
const ServiceLine: React.FC<{
  g: TourGroup;
  sv: GroupPassengerService;
  isAr: boolean;
  supplierOptions: Array<{ value: string; label: string; code?: string }>;
  disabled?: boolean;
  run: (op: () => Promise<TourGroup>, ok?: string) => Promise<TourGroup | null>;
}> = ({ g, sv, isAr, supplierOptions, disabled, run }) => {
  const meta = KIND_META[sv.kind] || KIND_META.PACKAGE;
  const Icon = meta.icon;
  const [supplier, setSupplier] = useState(sv.supplierName || '');
  const [finalBuy, setFinalBuy] = useState(sv.finalBuy === null ? '' : String(sv.finalBuy));

  useEffect(() => {
    setSupplier(sv.supplierName || '');
    setFinalBuy(sv.finalBuy === null ? '' : String(sv.finalBuy));
  }, [sv.supplierName, sv.finalBuy]);

  const dirty =
    supplier !== (sv.supplierName || '') || finalBuy !== (sv.finalBuy === null ? '' : String(sv.finalBuy));
  const complete = sv.status === 'COMPLETE';

  return (
    <div
      className={`grid grid-cols-[minmax(110px,auto)_1fr_auto_auto_auto] items-center gap-2 rounded-xl p-2 border ${
        complete ? 'bg-emerald-50/40 border-emerald-200' : 'bg-white border-slate-200'
      }`}
    >
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 shrink-0">
        <Icon size={14} className={complete ? 'text-emerald-600' : 'text-[#F45A0A]'} />
        <span>{isAr ? meta.ar : sv.kind}</span>
      </span>

      <div className="min-w-0">
        <SearchableCombobox
          value={supplier}
          onChange={(val) => setSupplier(val || '')}
          options={supplierOptions}
          placeholder={isAr ? 'اختر المورد...' : 'Supplier...'}
          allowCustomValue
          disabled={disabled}
        />
      </div>

      <span className="text-[11px] font-mono font-bold text-slate-500 whitespace-nowrap px-1" dir="ltr">
        {money(sv.expectedBuy, sv.currency)}
      </span>

      <input
        value={finalBuy}
        onChange={(e) => setFinalBuy(e.target.value)}
        disabled={disabled}
        placeholder={isAr ? 'النهائي' : 'Final'}
        dir="ltr"
        className="h-[46px] w-24 px-2.5 rounded-[11px] border border-[#E5E7EB] bg-white text-xs font-mono font-black text-end outline-none focus:border-2 focus:border-[#F45A0A] disabled:opacity-50"
      />

      {dirty ? (
        <button
          type="button"
          onClick={() =>
            run(
              () =>
                tourGroupsApi.updateService(g.id, sv.id, {
                  supplierName: supplier,
                  finalBuy: finalBuy.trim() === '' ? null : num(finalBuy),
                  ...(finalBuy.trim() === '' ? { status: 'NOT_COMPLETE' } : {}),
                }),
              undefined,
            )
          }
          className="h-9 px-3.5 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white text-xs font-black cursor-pointer shadow-2xs"
        >
          {isAr ? 'حفظ' : 'Save'}
        </button>
      ) : (
        <span
          className={`text-[10.5px] font-black rounded-md px-2 py-1 border ${
            complete ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-amber-100 text-amber-800 border-amber-200'
          }`}
        >
          {complete ? (isAr ? 'مكتمل' : 'Complete') : (isAr ? 'معلّق' : 'Pending')}
        </span>
      )}
    </div>
  );
};

/* ── تحصيل الدفعة ── */
const CollectBox: React.FC<{
  g: TourGroup;
  p: GroupPassenger;
  isAr: boolean;
  run: (op: () => Promise<TourGroup>, ok?: string) => Promise<TourGroup | null>;
}> = ({ g, p, isAr, run }) => {
  const [val, setVal] = useState('');
  const outstanding = Number(p.salePrice) - Number(p.collectedAmount);
  if (outstanding <= 0)
    return <span className="text-xs font-black text-emerald-700">{isAr ? 'محصَّل بالكامل' : 'Paid'}</span>;

  return (
    <div className="flex items-center gap-1.5">
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        dir="ltr"
        placeholder={String(outstanding)}
        className="h-8 w-24 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-mono font-black text-end outline-none focus:border-[#F45A0A]"
      />
      <button
        type="button"
        onClick={() => {
          const add = num(val) || outstanding;
          run(
            () => tourGroupsApi.updatePassenger(g.id, p.id, { collectedAmount: Number(p.collectedAmount) + add }),
            isAr ? 'سُجّل التحصيل' : 'Collected',
          );
          setVal('');
        }}
        className="h-8 px-3 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-black hover:bg-emerald-100 cursor-pointer shadow-2xs"
      >
        {isAr ? 'تحصيل' : 'Collect'}
      </button>
    </div>
  );
};

/* ── نافذة نظام الأسعار: نافذة عريضة وبحث متقدم عن المورد وبدون كلمة متوقع ── */
const PriceSystemModal: React.FC<{
  isAr: boolean;
  direction: string;
  draft: Partial<GroupPriceSystem>;
  groupCurrency: string;
  supplierOptions: Array<{ value: string; label: string; code?: string }>;
  onClose: () => void;
  onSave: (dto: any) => void;
}> = ({ isAr, direction, draft, groupCurrency, supplierOptions, onClose, onSave }) => {
  const [d, setD] = useState<any>({ currency: groupCurrency, items: [], seats: 9999, ...draft });
  const patchItem = (i: number, ch: any) =>
    setD((prev: any) => ({
      ...prev,
      items: prev.items.map((it: any, j: number) => (j === i ? { ...it, ...ch } : it)),
    }));

  const KIND_SELECT_OPTIONS = [
    { value: 'TICKET', label: isAr ? 'طيران' : 'Ticket' },
    { value: 'HOTEL', label: isAr ? 'فندق' : 'Hotel' },
    { value: 'VISA', label: isAr ? 'فيزا' : 'Visa' },
    { value: 'TRANSPORT', label: isAr ? 'نقل' : 'Transport' },
    { value: 'INSURANCE', label: isAr ? 'تأمين' : 'Insurance' },
    { value: 'GUIDE', label: isAr ? 'مرشد' : 'Guide' },
    { value: 'PACKAGE', label: isAr ? 'باكج' : 'Package' },
  ];

  const addItem = (kind = 'TICKET') => {
    setD((prev: any) => ({
      ...prev,
      items: [
        ...(prev.items || []),
        {
          kind,
          supplierName: '',
          expectedBuy: '',
          currency: prev.currency || groupCurrency,
        },
      ],
    }));
  };

  return (
    <Modal
      opened
      onClose={onClose}
      centered
      size={840}
      withCloseButton={false}
      zIndex={10050}
      classNames={{
        content: '!rounded-2xl border border-slate-200 shadow-2xl !overflow-visible',
        body: '!p-5',
      }}
    >
      <div className="space-y-4 font-sans" dir={direction}>
        {/* الترويسة المقتضبة */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#F45A0A] flex items-center justify-center">
              <Coins size={16} />
            </div>
            <h3 className="font-black text-sm text-slate-900">
              {d.id ? (isAr ? 'تعديل نظام الأسعار' : 'Edit Price System') : isAr ? 'نظام أسعار جديد' : 'New Price System'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* اسم النظام فقط بدون بيانات توضيحية */}
        <Field label={isAr ? 'اسم النظام *' : 'System Name *'}>
          <input
            value={d.name || ''}
            onChange={(e) => setD({ ...d, name: e.target.value })}
            className={inputClass}
            placeholder=""
            autoFocus
          />
        </Field>

        {/* بنود الخدمات المضمنة */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-800">
              {isAr ? 'بنود الخدمات المضمنة:' : 'Included Services:'}
            </span>
            <button
              type="button"
              onClick={() => addItem('TICKET')}
              className="h-8 px-3 rounded-xl border border-orange-200 bg-orange-50 text-[#F45A0A] text-xs font-black cursor-pointer flex items-center gap-1.5 hover:bg-orange-100 transition-colors shadow-2xs"
            >
              <Plus size={14} />
              <span>{isAr ? 'إضافة بند خدمة' : 'Add Item'}</span>
            </button>
          </div>

          {d.items && d.items.length > 0 && (
            <div className="grid grid-cols-[140px_1fr_140px_36px] gap-2.5 px-2 text-[11px] font-bold text-slate-500">
              <span>{isAr ? 'اختيار البند' : 'Select Item'}</span>
              <span>{isAr ? 'المورد' : 'Supplier'}</span>
              <span className="text-end">{isAr ? 'سعر الشراء' : 'Buy Price'}</span>
              <span></span>
            </div>
          )}

          <div className="space-y-2.5 overflow-visible">
            {(d.items || []).map((it: any, i: number) => (
              <div
                key={i}
                style={{ zIndex: (d.items?.length || 10) - i, position: 'relative' }}
                className="grid grid-cols-[140px_1fr_140px_auto] items-center gap-2.5 bg-slate-50/70 border border-slate-200 rounded-xl p-2 hover:bg-slate-50 transition-colors"
              >
                {/* اختيار البند */}
                <div className="min-w-0">
                  <SearchableCombobox
                    value={it.kind || 'TICKET'}
                    onChange={(val) => patchItem(i, { kind: val || 'TICKET' })}
                    options={KIND_SELECT_OPTIONS}
                    placeholder=""
                    clearable={false}
                  />
                </div>

                {/* بحث عن المورد */}
                <div className="min-w-0">
                  <SearchableCombobox
                    value={it.supplierName || ''}
                    onChange={(val) => patchItem(i, { supplierName: val || '' })}
                    options={supplierOptions}
                    placeholder=""
                    allowCustomValue
                  />
                </div>

                {/* سعر الشراء */}
                <div className="flex items-center h-[46px] w-full rounded-[11px] border border-[#E5E7EB] bg-white px-3 focus-within:border-2 focus-within:border-[#F45A0A] transition-colors">
                  <input
                    value={it.expectedBuy ?? ''}
                    onChange={(e) => patchItem(i, { expectedBuy: num(e.target.value) })}
                    dir="ltr"
                    placeholder=""
                    className="w-full bg-transparent font-mono font-black text-xs text-slate-900 outline-none text-end"
                  />
                  <span className="text-[11px] font-bold text-slate-400 font-mono shrink-0 select-none mr-1.5">
                    {d.currency === 'USD' ? '$' : 'IQD'}
                  </span>
                </div>

                {/* زر الحذف */}
                <button
                  type="button"
                  onClick={() => setD({ ...d, items: d.items.filter((_: any, j: number) => j !== i) })}
                  className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:border-rose-300 flex items-center justify-center cursor-pointer transition-colors shadow-2xs shrink-0"
                  title={isAr ? 'حذف البند' : 'Remove item'}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}

            {d.items.length === 0 && (
              <div className="py-6 text-center border-2 border-dashed border-slate-200 rounded-xl">
                <p className="text-xs font-bold text-slate-400">
                  {isAr ? 'لا توجد خدمات مضافة بعد' : 'No service items added yet'}
                </p>
              </div>
            )}
          </div>

          {d.items && d.items.length > 0 && (
            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <span className="font-bold text-slate-600">
                {isAr ? 'إجمالي سعر الشراء:' : 'Total Cost:'}
              </span>
              <span className="font-mono font-black text-xs text-slate-900" dir="ltr">
                {money(d.items.reduce((acc: number, it: any) => acc + num(it.expectedBuy), 0), d.currency)}
              </span>
            </div>
          )}
        </div>

        {/* الأزرار */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="h-[40px] px-5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={!d.name?.trim()}
            onClick={() => onSave({ ...d, salePrice: d.salePrice || 0, seats: 9999 })}
            className="h-[40px] px-6 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-black cursor-pointer shadow-2xs"
          >
            {isAr ? 'حفظ نظام الأسعار' : 'Save System'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

/* ── نافذة إضافة شراء عام أو مصروف: بحث متقدم عن المورد ── */
const ChargeModal: React.FC<{
  isAr: boolean;
  direction: string;
  chargeType: 'GLOBAL_PURCHASE' | 'EXPENSE';
  currency: string;
  supplierOptions: Array<{ value: string; label: string; code?: string }>;
  onClose: () => void;
  onSave: (dto: any) => void;
}> = ({ isAr, direction, chargeType, currency, supplierOptions, onClose, onSave }) => {
  const [d, setD] = useState<any>({ chargeType, currency, category: '', amount: 0, supplierName: '' });
  const [accountFinder, setAccountFinder] = useState<{ open: boolean; query: string }>({
    open: false,
    query: '',
  });
  const isExp = chargeType === 'EXPENSE';
  const presets = isExp
    ? ['دعاية وإعلان', 'عمولات سياحية', 'ضيافة وإدارة', 'أخرى']
    : ['استئجار باصات', 'حجوزات فندقية', 'نقل عام', 'أخرى'];

  return (
    <Modal
      opened
      onClose={onClose}
      centered
      size={580}
      withCloseButton={false}
      zIndex={10050}
      classNames={{
        content: '!rounded-2xl border border-slate-200 shadow-2xl !overflow-visible',
        body: '!p-5',
      }}
    >
      <div className="space-y-3.5 font-sans" dir={direction}>
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#F45A0A] flex items-center justify-center">
              <Banknote size={16} />
            </div>
            <h3 className="font-black text-sm text-slate-900">
              {isExp ? (isAr ? 'تسجيل مصروف عام' : 'Add Expense') : isAr ? 'تسجيل شراء عام' : 'Add Purchase'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        <Field label={isAr ? 'التصنيف *' : 'Category *'}>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {presets.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setD({ ...d, category: c })}
                className={`text-xs font-bold rounded-lg px-2.5 py-1 border cursor-pointer transition-all ${
                  d.category === c
                    ? 'bg-[#F45A0A] text-white border-[#F45A0A]'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <input
            value={d.category}
            onChange={(e) => setD({ ...d, category: e.target.value })}
            className={inputClass}
            placeholder={isAr ? 'التصنيف' : 'Category'}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <Field label={isAr ? 'المبلغ *' : 'Amount *'}>
            <input
              value={d.amount || ''}
              onChange={(e) => setD({ ...d, amount: num(e.target.value) })}
              dir="ltr"
              className={`${inputClass} font-mono text-end`}
              placeholder="0.00"
            />
          </Field>
          <Field
            label={isAr ? 'المورد / الجهة المستلمة' : 'Supplier'}
            action={
              <button
                type="button"
                onClick={() => setAccountFinder({ open: true, query: d.supplierName || '' })}
                className="h-[20px] px-1.5 text-[10.5px] font-bold text-[#F45A0A] hover:text-[#dd4f05] flex items-center gap-1 cursor-pointer bg-orange-50 hover:bg-orange-100 rounded border border-orange-200 transition-colors"
                title={isAr ? 'البحث المتقدم في كل الحسابات' : 'Advanced Account Search'}
              >
                <Search size={11} />
                <span>{isAr ? 'بحث متقدم' : 'Search'}</span>
              </button>
            }
          >
            <SearchableCombobox
              value={d.supplierName || ''}
              onChange={(val) => setD({ ...d, supplierName: val || '' })}
              options={supplierOptions}
              placeholder={isAr ? 'اختر أو ابحث عن المورد' : 'Supplier'}
              allowCustomValue
            />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="h-[40px] px-5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={!d.category.trim() || !d.amount}
            onClick={() => onSave(d)}
            className="h-[40px] px-6 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-black cursor-pointer shadow-2xs"
          >
            {isAr ? 'إضافة' : 'Add'}
          </button>
        </div>

        <AccountFinderModal
          opened={accountFinder.open}
          initialQuery={accountFinder.query}
          initialScope="SUPPLIER"
          title={isAr ? 'البحث المتقدم عن المورد' : 'Advanced Search: Supplier'}
          zIndex={11000}
          onClose={() => setAccountFinder({ open: false, query: '' })}
          onSelect={(account: AccountFinderResult) => {
            setD((prev: any) => ({ ...prev, supplierName: account.name }));
            setAccountFinder({ open: false, query: '' });
          }}
        />
      </div>
    </Modal>
  );
};

/* ── نافذة إضافة مسافر جديد ── */
const PassengerModal: React.FC<{
  isAr: boolean;
  direction: string;
  g: TourGroup;
  customerOptions: any[];
  onClose: () => void;
  onSave: (dto: any) => void;
}> = ({ isAr, direction, g, customerOptions, onClose, onSave }) => {
  const activeSystems = g.priceSystems.filter((s) => s.active);
  const [d, setD] = useState<any>({
    priceSystemId: activeSystems[0]?.id || '',
    passengerName: '',
    customerName: '',
    customerId: null,
    customerAccountId: null,
    passport: '',
    agent: '',
    payType: 'CASH',
    salePrice: activeSystems[0] ? Number(activeSystems[0].salePrice) : 0,
  });
  const [accountFinder, setAccountFinder] = useState<{ open: boolean; query: string }>({
    open: false,
    query: '',
  });

  return (
    <Modal
      opened
      onClose={onClose}
      centered
      size={580}
      withCloseButton={false}
      zIndex={10050}
      classNames={{
        content: '!rounded-2xl border border-slate-200 shadow-2xl !overflow-visible',
        body: '!p-5',
      }}
    >
      <div className="space-y-3.5 font-sans" dir={direction}>
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#F45A0A] flex items-center justify-center">
              <User size={16} />
            </div>
            <h3 className="font-black text-sm text-slate-900">
              {isAr ? 'إضافة مسافر' : 'Add Passenger'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        <Field label={isAr ? 'نظام الأسعار *' : 'Price System *'}>
          <SearchableCombobox
            value={d.priceSystemId}
            onChange={(val) => {
              const sel = g.priceSystems.find((s) => s.id === val);
              setD({ ...d, priceSystemId: val, salePrice: sel ? Number(sel.salePrice) : d.salePrice });
            }}
            options={activeSystems.map((s) => ({
              value: s.id,
              label: Number(s.salePrice) > 0 ? `${s.name} — ${money(s.salePrice, s.currency)}` : s.name,
            }))}
            placeholder=""
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <Field label={isAr ? 'اسم المسافر *' : 'Passenger *'}>
            <input
              value={d.passengerName}
              onChange={(e) => setD({ ...d, passengerName: e.target.value })}
              className={inputClass}
              placeholder=""
            />
          </Field>
          <Field
            label={isAr ? 'العميل / الحساب' : 'Customer'}
            action={
              <button
                type="button"
                onClick={() => setAccountFinder({ open: true, query: d.customerName || '' })}
                className="h-[20px] px-1.5 text-[10.5px] font-bold text-[#F45A0A] hover:text-[#dd4f05] flex items-center gap-1 cursor-pointer bg-orange-50 hover:bg-orange-100 rounded border border-orange-200 transition-colors"
                title={isAr ? 'البحث المتقدم في كل الحسابات' : 'Advanced Account Search'}
              >
                <Search size={11} />
                <span>{isAr ? 'بحث متقدم' : 'Search'}</span>
              </button>
            }
          >
            <SearchableCombobox
              value={d.customerName}
              onChange={(v) => {
                const match = customerOptions.find((c: any) => c.value === v || c.label === v || c.name === v);
                setD({
                  ...d,
                  customerName: v || '',
                  customerId: match?.id || null,
                  customerAccountId: match?.accountId || null,
                });
              }}
              options={customerOptions}
              placeholder=""
              allowCustomValue
            />
          </Field>
          <Field label={isAr ? 'الجواز' : 'Passport'}>
            <input
              value={d.passport}
              onChange={(e) => setD({ ...d, passport: e.target.value })}
              dir="ltr"
              className={`${inputClass} font-mono`}
              placeholder=""
            />
          </Field>
          <Field label={isAr ? 'الوكيل' : 'Agent'}>
            <input
              value={d.agent}
              onChange={(e) => setD({ ...d, agent: e.target.value })}
              className={inputClass}
              placeholder=""
            />
          </Field>
          <Field label={isAr ? 'سعر البيع *' : 'Sale Price *'}>
            <input
              value={d.salePrice || ''}
              onChange={(e) => setD({ ...d, salePrice: num(e.target.value) })}
              dir="ltr"
              placeholder=""
              className={`${inputClass} font-mono text-end`}
            />
          </Field>
          <Field label={isAr ? 'السداد' : 'Payment'}>
            <SearchableCombobox
              value={d.payType}
              onChange={(v) => setD({ ...d, payType: v })}
              options={[
                { value: 'CASH', label: isAr ? 'نقدي' : 'Cash' },
                { value: 'CREDIT', label: isAr ? 'آجل' : 'Credit' },
              ]}
              clearable={false}
            />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="h-[40px] px-5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={!d.passengerName.trim() || !d.priceSystemId}
            onClick={() => onSave(d)}
            className="h-[40px] px-6 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-black cursor-pointer shadow-2xs"
          >
            {isAr ? 'إضافة المسافر' : 'Add'}
          </button>
        </div>

        <AccountFinderModal
          opened={accountFinder.open}
          initialQuery={accountFinder.query}
          initialScope="CUSTOMER"
          title={isAr ? 'البحث المتقدم عن العميل / الحساب' : 'Advanced Search: Customer Account'}
          zIndex={11000}
          onClose={() => setAccountFinder({ open: false, query: '' })}
          onSelect={(account: AccountFinderResult) => {
            setD((prev: any) => ({
              ...prev,
              customerName: account.name,
              customerId: account.id,
              customerAccountId: account.id,
            }));
            setAccountFinder({ open: false, query: '' });
          }}
        />
      </div>
    </Modal>
  );
};

/* ── نافذة إنشاء كروب جديد: مقتضبة، أنيقة، بدون نصوص مطولة ── */
export const NewGroupModal: React.FC<{
  opened: boolean;
  direction: string;
  isAr: boolean;
  onClose: () => void;
  onCreated: (g: TourGroup) => void;
}> = ({ opened, direction, isAr, onClose, onCreated }) => {
  const [d, setD] = useState<any>({
    groupName: '',
    groupType: 'FULL',
    country: '',
    travelDate: new Date(),
    buyDate: new Date(),
    currency: 'USD',
  });
  const [saving, setSaving] = useState(false);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      size={580}
      withCloseButton={false}
      zIndex={10050}
      classNames={{
        content: '!rounded-2xl border border-slate-200 shadow-2xl !overflow-visible',
        body: '!p-5',
      }}
    >
      <div className="space-y-3.5 font-sans" dir={direction}>
        {/* الترويسة المقتضبة */}
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200/80 text-[#F45A0A] flex items-center justify-center">
              <Users size={18} strokeWidth={2.4} />
            </div>
            <h3 className="font-black text-sm sm:text-base text-slate-900">
              {isAr ? 'كروب سياحي جديد' : 'New Tour Group'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* الحقول المقتضبة */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* اسم الكروب */}
          <div className="sm:col-span-2">
            <label className="text-xs font-bold text-slate-700 block mb-1">
              {isAr ? 'اسم الكروب *' : 'Group Name *'}
            </label>
            <input
              value={d.groupName}
              onChange={(e) => setD({ ...d, groupName: e.target.value })}
              className={inputClass}
              placeholder={isAr ? 'اسم الكروب' : 'Group Name'}
            />
          </div>

          {/* نوع الكروب */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              {isAr ? 'النوع' : 'Type'}
            </label>
            <SearchableCombobox
              value={d.groupType}
              onChange={(val) => setD({ ...d, groupType: val })}
              options={[
                { value: 'FULL', label: isAr ? 'شامل' : 'Full' },
                { value: 'AIR', label: isAr ? 'طيران' : 'Air' },
                { value: 'LAND', label: isAr ? 'بري' : 'Land' },
              ]}
              clearable={false}
            />
          </div>

          {/* الوجهة */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
              <MapPin size={12} className="text-[#F45A0A]" />
              <span>{isAr ? 'الوجهة' : 'Destination'}</span>
            </label>
            <SearchableCombobox
              options={WORLD_CITIES.map((c) => ({
                value: isAr ? c.cityAr : c.cityEn,
                label: isAr ? `${c.cityAr} (${c.countryAr})` : `${c.cityEn} (${c.countryEn})`,
                subLabel: isAr ? c.countryAr : c.countryEn,
              }))}
              value={d.country}
              onChange={(val: string) => setD({ ...d, country: val })}
              placeholder={isAr ? 'الوجهة' : 'Destination'}
              allowCustomValue
            />
          </div>

          {/* تاريخ الشراء */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              {isAr ? 'تاريخ الشراء' : 'Purchase Date'}
            </label>
            <SegmentedDatePicker
              value={d.buyDate}
              onChange={(dt) => dt && setD({ ...d, buyDate: dt })}
              clearable={false}
            />
          </div>

          {/* تاريخ السفر */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              {isAr ? 'تاريخ السفر' : 'Travel Date'}
            </label>
            <SegmentedDatePicker
              value={d.travelDate}
              onChange={(dt) => dt && setD({ ...d, travelDate: dt })}
              clearable={false}
            />
          </div>

          {/* العملة */}
          <div className="sm:col-span-2">
            <label className="text-xs font-bold text-slate-700 block mb-1">
              {isAr ? 'العملة' : 'Currency'}
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setD({ ...d, currency: 'USD' })}
                className={`flex-1 h-[46px] rounded-[11px] font-black text-xs border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  d.currency === 'USD'
                    ? 'bg-[#F45A0A] text-white border-[#F45A0A] shadow-2xs'
                    : 'bg-[#FAFAFA] border-[#E5E7EB] text-slate-700 hover:bg-white'
                }`}
              >
                <DollarSign size={15} />
                <span>USD ($)</span>
              </button>
              <button
                type="button"
                onClick={() => setD({ ...d, currency: 'IQD' })}
                className={`flex-1 h-[46px] rounded-[11px] font-black text-xs border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  d.currency === 'IQD'
                    ? 'bg-[#F45A0A] text-white border-[#F45A0A] shadow-2xs'
                    : 'bg-[#FAFAFA] border-[#E5E7EB] text-slate-700 hover:bg-white'
                }`}
              >
                <Coins size={15} />
                <span>IQD (د.ع)</span>
              </button>
            </div>
          </div>
        </div>

        {/* الأزرار السفلية */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="h-[40px] px-5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={saving || !d.groupName.trim()}
            onClick={async () => {
              setSaving(true);
              try {
                const created = await tourGroupsApi.create({
                  groupName: d.groupName.trim(),
                  groupType: d.groupType,
                  country: d.country,
                  travelDate: d.travelDate ? new Date(d.travelDate).toISOString() : undefined,
                  buyDate: d.buyDate ? new Date(d.buyDate).toISOString() : undefined,
                  currency: d.currency,
                });
                showSuccessNotification(isAr ? 'أُنشئ الكروب' : 'Created', created.groupName);
                onCreated(created);
              } catch (e: any) {
                showErrorNotification(isAr ? 'تعذّر الإنشاء' : 'Failed', e?.message || '');
              } finally {
                setSaving(false);
              }
            }}
            className="h-[40px] px-6 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-black cursor-pointer flex items-center gap-2 shadow-2xs"
          >
            {saving ? <Loader size={14} color="white" /> : <Coins size={15} />}
            <span>{isAr ? 'إنشاء الكروب' : 'Create'}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default GroupFileWorkspace;
