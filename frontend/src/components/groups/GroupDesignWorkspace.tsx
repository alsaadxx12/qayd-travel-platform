import React, { useEffect, useMemo, useState } from 'react';
import { Loader, Menu, Tooltip } from '@mantine/core';
import {
  X,
  Users,
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  Save,
  Search,
  Ticket,
  Building2,
  FileCheck,
  ShieldCheck,
  Bus,
  UserCheck,
  Package,
  Coins,
  Armchair,
  TrendingUp,
  Calendar,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  DollarSign,
} from 'lucide-react';
import { SearchableCombobox } from '../ui/SearchableCombobox';
import { AccountFinderModal, type AccountFinderResult } from '../common/AccountFinderModal';
import { ticketsApi, type TicketData } from '../../api/tickets';
import { partnersApi } from '../../api/partners';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { useLanguageStore } from '../../store/useLanguageStore';
import {
  COMPONENT_KINDS,
  computeGroupTotals,
  designFromTicket,
  emptyDesign,
  encodeDesignIntoNotes,
  kindLabel,
  type GroupComponent,
  type GroupComponentKind,
  type GroupCustomer,
  type GroupDesign,
} from './groupDesign';

const KIND_ICON: Record<GroupComponentKind, any> = {
  TICKET: Ticket,
  HOTEL: Building2,
  VISA: FileCheck,
  INSURANCE: ShieldCheck,
  TRANSPORT: Bus,
  GUIDE: UserCheck,
  PACKAGE: Package,
  EXPENSE: Coins,
};

const KIND_TONE: Record<GroupComponentKind, { bg: string; border: string; text: string }> = {
  TICKET: { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700' },
  HOTEL: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700' },
  VISA: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' },
  INSURANCE: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
  TRANSPORT: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800' },
  GUIDE: { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700' },
  PACKAGE: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-[#F45A0A]' },
  EXPENSE: { bg: 'bg-slate-100', border: 'border-slate-200', text: 'text-slate-700' },
};

const formatEnglishNumber = (v: number, decimals = 0): string => {
  if (isNaN(v) || v === null || v === undefined) return '0';
  return v.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

const money = (v: number, currency: string) => {
  const isUSD = currency === 'USD';
  return `${isUSD ? '$' : ''}${formatEnglishNumber(Number(v || 0), isUSD ? 2 : 0)}${isUSD ? '' : ' IQD'}`;
};

const numeric = (raw: string) => {
  const n = Number(String(raw ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
};

interface Props {
  opened: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialData?: TicketData | null;
}

/**
 * مساحة عمل تصميم الكروب السياحي وبيعه — في خطوتين واضحتين واحترافيتين.
 * الخطوة 1: تصميم الكروب وتكاليفه (مكونات المقعد والرحلة)
 * الخطوة 2: توزيع وبيع المقاعد على العملاء والركاب
 */
export const GroupDesignWorkspace: React.FC<Props> = ({ opened, onClose, onSuccess, initialData }) => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  const [step, setStep] = useState<1 | 2>(1);
  const [design, setDesign] = useState<GroupDesign>(emptyDesign());
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [finder, setFinder] = useState<{ open: boolean; componentId?: string; customerId?: string }>({
    open: false,
  });

  useEffect(() => {
    if (!opened) return;
    setStep(1);
    setDesign(designFromTicket(initialData));
    partnersApi
      .getCustomers()
      .then((d: any) => setCustomers(Array.isArray(d) ? d : d?.data || []))
      .catch(() => undefined);
  }, [opened, initialData]);

  const totals = useMemo(() => computeGroupTotals(design), [design]);

  const patch = (changes: Partial<GroupDesign>) => setDesign((d) => ({ ...d, ...changes }));

  const addComponent = (kind: GroupComponentKind) =>
    setDesign((d) => ({
      ...d,
      components: [
        ...d.components,
        { id: `cmp-${Date.now()}-${d.components.length}`, kind, supplierName: '', cost: 0, perSeat: kind !== 'EXPENSE' },
      ],
    }));

  const patchComponent = (id: string, changes: Partial<GroupComponent>) =>
    setDesign((d) => ({
      ...d,
      components: d.components.map((c) => (c.id === id ? { ...c, ...changes } : c)),
    }));

  const removeComponent = (id: string) =>
    setDesign((d) => ({ ...d, components: d.components.filter((c) => c.id !== id) }));

  const addCustomer = () =>
    setDesign((d) => ({
      ...d,
      customers: [
        ...d.customers,
        {
          id: `cus-${Date.now()}-${d.customers.length}`,
          name: '',
          payType: 'CASH',
          sale: Number(d.seatPrice) || 0,
        },
      ],
    }));

  const patchCustomer = (id: string, changes: Partial<GroupCustomer>) =>
    setDesign((d) => ({
      ...d,
      customers: d.customers.map((c) => (c.id === id ? { ...c, ...changes } : c)),
    }));

  const removeCustomer = (id: string) =>
    setDesign((d) => ({ ...d, customers: d.customers.filter((c) => c.id !== id) }));

  const customerOptions = useMemo(
    () =>
      customers.map((c: any) => ({
        value: c.nameAr || c.name || c.id,
        label: c.nameAr || c.name || '',
        code: c.code,
      })),
    [customers],
  );

  const stepOneReady = design.groupName.trim().length > 0 && design.seats > 0;

  const handleSave = async () => {
    if (!design.groupName.trim()) {
      showErrorNotification(
        isAr ? 'اسم الكروب مطلوب' : 'Group name required',
        isAr ? 'يرجى تحديد اسم الكروب أولاً قبل الحفظ.' : 'Please enter a group name.',
      );
      setStep(1);
      return;
    }
    setSaving(true);
    try {
      const route = [design.routeFrom, design.routeTo].filter(Boolean).join(' - ');
      const payload: any = {
        invoiceNumber: (initialData as any)?.invoiceNumber || `GRP-${Date.now().toString().slice(-8)}`,
        issueDate: design.buyDate || new Date().toISOString().slice(0, 10),
        travelDate: design.travelDate || null,
        tripType: 'GROUP_FARE',
        reference: design.groupName.trim(),
        route: route || null,
        currency: design.currency,
        customerName: design.customers[0]?.name || null,
        notes: encodeDesignIntoNotes(design.notes, design),
        status: 'POSTED',
        totalBuy: totals.soldCost,
        netBuy: totals.soldCost,
        totalSell: totals.salesTotal,
        netSell: totals.salesTotal,
        profit: totals.realisedProfit,
        passengers: design.customers.map((c) => ({
          name: c.name || (isAr ? 'مقعد' : 'Seat'),
          ticketType: 'ADULT',
          fareBuy: totals.costPerSeat,
          fareSell: Number(c.sale) || 0,
        })),
      };

      if ((initialData as any)?.id) {
        await ticketsApi.update((initialData as any).id, payload);
      } else {
        await ticketsApi.create(payload);
      }

      showSuccessNotification(
        isAr ? 'تم حفظ الكروب بنجاح' : 'Group saved successfully',
        isAr
          ? `${design.groupName} — تم بيع ${totals.soldSeats} من إجمالي ${totals.seats} مقعداً.`
          : `${design.groupName} — ${totals.soldSeats} of ${totals.seats} seats sold.`,
      );
      onSuccess?.();
      onClose();
    } catch (err: any) {
      showErrorNotification(
        isAr ? 'تعذّر الحفظ' : 'Save failed',
        err?.message || (isAr ? 'لم يتم حفظ الكروب' : 'The group was not saved'),
      );
    } finally {
      setSaving(false);
    }
  };

  if (!opened) return null;

  const inputClass =
    'w-full h-[42px] px-3 rounded-xl border border-[#E5E7EB] bg-white text-[13px] font-bold text-slate-900 outline-none hover:border-slate-300 focus:border-2 focus:border-[#F45A0A] focus:ring-0 transition-all placeholder:text-slate-300 placeholder:font-normal';

  return (
    <div
      className="fixed inset-0 z-9998 bg-[#F8FAFC] flex flex-col font-sans select-none"
      dir={direction}
      style={{ fontFamily: language === 'ar' ? "'IBM Plex Sans Arabic', system-ui, sans-serif" : "'IBM Plex Sans', system-ui, sans-serif" }}
    >
      {/* ── 1. HEADER HERO BAR ── */}
      <div className="bg-white border-b border-[#E5E7EB] shadow-2xs shrink-0">
        <div className="max-w-[1650px] mx-auto w-full px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
          
          {/* Identity */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFF3E8] border border-[#FED7AA] text-[#F45A0A] flex items-center justify-center shadow-2xs shrink-0">
              <Package size={20} strokeWidth={2.2} />
            </div>
            <div>
              <h2 className="font-black text-sm sm:text-base text-[#111827] leading-tight">
                {(initialData as any)?.id
                  ? isAr ? 'تعديل حزمة الكروب السياحي' : 'Edit Tour Group'
                  : isAr ? 'تصميم كروب سياحي جديد' : 'New Tour Group Package'}
              </h2>
              <p className="text-[11px] font-bold text-slate-500 mt-0.5 font-mono">
                {design.groupName || (isAr ? '— كروب بدون اسم بعد —' : '— Unnamed Group —')}
              </p>
            </div>
          </div>

          {/* Stepper (Two intuitive steps) */}
          <div className="flex items-center gap-2 bg-[#F1F5F9] p-1 rounded-2xl border border-slate-200">
            {([
              { n: 1 as const, ar: '١. تصميم الكروب والتكاليف', en: '1. Design & Cost' },
              { n: 2 as const, ar: '٢. بيع وتوزيع المقاعد', en: '2. Sell Seats' },
            ]).map((s) => (
              <button
                key={s.n}
                type="button"
                onClick={() => (s.n === 1 || stepOneReady) && setStep(s.n)}
                disabled={s.n === 2 && !stepOneReady}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-[12px] font-black transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
                  step === s.n
                    ? 'bg-[#F45A0A] text-white shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <span>{isAr ? s.ar : s.en}</span>
              </button>
            ))}
          </div>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-[#E5E7EB] bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 flex items-center justify-center cursor-pointer transition-colors shadow-2xs"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ── 2. WORKSPACE BODY ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1650px] mx-auto w-full px-4 sm:px-6 py-4 pb-32 space-y-4">
          
          {step === 1 ? (
            /* ── STEP 1: DESIGN & COST COMPONENTS ── */
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,390px)_minmax(0,1fr)] gap-4 items-start">
              
              {/* Left Column: Group General Information */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-5 space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                  <div className="w-7 h-7 rounded-lg bg-orange-50 border border-orange-200 text-[#F45A0A] flex items-center justify-center">
                    <Users size={15} />
                  </div>
                  <span className="font-black text-[13px] text-slate-900">
                    {isAr ? 'معلومات وهوية الكروب' : 'Group Information'}
                  </span>
                </div>

                <div>
                  <label className="text-[11.5px] font-bold text-slate-700 block mb-1">
                    {isAr ? 'اسم الكروب أو الرحلة *' : 'Group / Tour Name *'}
                  </label>
                  <input
                    value={design.groupName}
                    onChange={(e) => patch({ groupName: e.target.value })}
                    placeholder={isAr ? 'مثال: كروب طرابزون وإسطنبول 2026' : 'e.g. Istanbul & Trabzon Tour 2026'}
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11.5px] font-bold text-slate-700 block mb-1">
                      {isAr ? 'محطة الانطلاق (من)' : 'From'}
                    </label>
                    <input
                      value={design.routeFrom}
                      onChange={(e) => patch({ routeFrom: e.target.value.toUpperCase() })}
                      placeholder="BGW"
                      dir="ltr"
                      className={`${inputClass} font-mono text-center uppercase`}
                    />
                  </div>
                  <div>
                    <label className="text-[11.5px] font-bold text-slate-700 block mb-1">
                      {isAr ? 'الوجهة (إلى)' : 'To'}
                    </label>
                    <input
                      value={design.routeTo}
                      onChange={(e) => patch({ routeTo: e.target.value.toUpperCase() })}
                      placeholder="IST"
                      dir="ltr"
                      className={`${inputClass} font-mono text-center uppercase`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11.5px] font-bold text-slate-700 block mb-1">
                      {isAr ? 'تاريخ السفر' : 'Travel Date'}
                    </label>
                    <input
                      type="date"
                      value={design.travelDate}
                      onChange={(e) => patch({ travelDate: e.target.value })}
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                  <div>
                    <label className="text-[11.5px] font-bold text-slate-700 block mb-1">
                      {isAr ? 'تاريخ الشراء / الحجز' : 'Booking Date'}
                    </label>
                    <input
                      type="date"
                      value={design.buyDate}
                      onChange={(e) => patch({ buyDate: e.target.value })}
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11.5px] font-bold text-slate-700 block mb-1">
                      {isAr ? 'نوع الكروب' : 'Group Type'}
                    </label>
                    <select
                      value={design.groupType}
                      onChange={(e) => patch({ groupType: e.target.value })}
                      className={`${inputClass} cursor-pointer`}
                    >
                      <option value="FULL">{isAr ? 'برنامج كامل (Full)' : 'Full Package'}</option>
                      <option value="LAND">{isAr ? 'بري فقط (Land)' : 'Land Only'}</option>
                      <option value="AIR">{isAr ? 'طيران فقط (Air)' : 'Flight Only'}</option>
                      <option value="HOTEL_ONLY">{isAr ? 'فندق فقط' : 'Hotel Only'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11.5px] font-bold text-slate-700 block mb-1">
                      {isAr ? 'الدولة / الوجهة' : 'Country'}
                    </label>
                    <input
                      value={design.country}
                      onChange={(e) => patch({ country: e.target.value })}
                      placeholder={isAr ? 'تركيا، جورجيا...' : 'Turkey, Georgia...'}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11.5px] font-bold text-slate-700 block mb-1">
                      {isAr ? 'عدد المقاعد الإجمالي *' : 'Total Seats *'}
                    </label>
                    <input
                      value={design.seats}
                      onChange={(e) => patch({ seats: Math.max(1, Math.round(numeric(e.target.value))) })}
                      dir="ltr"
                      className={`${inputClass} font-mono text-center font-black`}
                    />
                  </div>
                  <div>
                    <label className="text-[11.5px] font-bold text-slate-700 block mb-1">
                      {isAr ? 'العملة المعتمدة' : 'Currency'}
                    </label>
                    <select
                      value={design.currency}
                      onChange={(e) => patch({ currency: e.target.value as 'IQD' | 'USD' })}
                      className={`${inputClass} cursor-pointer font-bold`}
                    >
                      <option value="USD">$ دولار أمريكي (USD)</option>
                      <option value="IQD">د.ع دينار عراقي (IQD)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11.5px] font-bold text-slate-700 block mb-1">
                    {isAr ? 'ملاحظات وتفاصيل إضافية' : 'Notes'}
                  </label>
                  <textarea
                    rows={2}
                    value={design.notes}
                    onChange={(e) => patch({ notes: e.target.value })}
                    placeholder={isAr ? 'أي شروط أو تفاصيل تخص البرنامج...' : 'Any program notes...'}
                    className="w-full p-3 rounded-xl border border-[#E5E7EB] bg-white text-[12px] font-medium text-slate-900 outline-none hover:border-slate-300 focus:border-2 focus:border-[#F45A0A] transition-all"
                  />
                </div>
              </div>

              {/* Right Column: Cost Components & Seat Price */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-5 space-y-4">
                
                {/* Header & Add Button */}
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-orange-50 border border-orange-200 text-[#F45A0A] flex items-center justify-center">
                        <Coins size={15} />
                      </div>
                      <span className="font-black text-[13px] text-slate-900">
                        {isAr ? 'مكوّنات كلفة المقعد والرحلة' : 'Seat Cost Components'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      {isAr
                        ? 'تذكرة طيران · حجز فندقي · تأشيرة · نقل سياحي · مرشد · تأمين...'
                        : 'Flight ticket · Hotel · Visa · Transport · Guide · Insurance...'}
                    </p>
                  </div>

                  <Menu position="bottom-end" shadow="lg" radius="xl" width={220} withinPortal zIndex={10060}>
                    <Menu.Target>
                      <button
                        type="button"
                        className="h-[38px] px-3.5 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white text-[12px] font-black cursor-pointer flex items-center gap-1.5 shadow-xs transition-all active:scale-[0.98]"
                      >
                        <Plus size={15} strokeWidth={2.4} />
                        <span>{isAr ? 'إضافة مكوّن كلفة' : 'Add Cost Item'}</span>
                      </button>
                    </Menu.Target>
                    <Menu.Dropdown className="p-1.5" style={{ direction }}>
                      {COMPONENT_KINDS.map((k) => {
                        const Icon = KIND_ICON[k.kind];
                        const tone = KIND_TONE[k.kind];
                        return (
                          <Menu.Item
                            key={k.kind}
                            className="rounded-xl py-2"
                            leftSection={
                              <span className={`w-7 h-7 rounded-lg border flex items-center justify-center ${tone.bg} ${tone.border} ${tone.text}`}>
                                <Icon size={14} />
                              </span>
                            }
                            onClick={() => addComponent(k.kind)}
                          >
                            <span className="text-[12.5px] font-bold text-slate-800">{isAr ? k.ar : k.en}</span>
                          </Menu.Item>
                        );
                      })}
                    </Menu.Dropdown>
                  </Menu>
                </div>

                {/* Empty State */}
                {design.components.length === 0 ? (
                  <div className="py-12 text-center rounded-2xl border border-dashed border-slate-200 bg-[#FAFAFA]">
                    <Package size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-[13px] font-bold text-slate-600">
                      {isAr ? 'لم تتم إضافة أي مكوّن كلفة بعد' : 'No cost components added yet'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {isAr
                        ? 'اضغط على «إضافة مكوّن كلفة» لإدخال تذكرة الطيران أو الفندق أو التأشيرة واحتساب سعر المقعد تلقائياً'
                        : 'Click "Add Cost Item" to add flights, hotels, or visas and compute seat cost automatically'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {design.components.map((c) => {
                      const Icon = KIND_ICON[c.kind];
                      const tone = KIND_TONE[c.kind];
                      return (
                        <div
                          key={c.id}
                          className="grid grid-cols-[auto_minmax(0,1.5fr)_minmax(0,1fr)_auto_auto] items-center gap-2.5 p-3 rounded-2xl border border-[#E5E7EB] bg-[#FAFAFA] hover:border-slate-300 transition-all shadow-2xs"
                        >
                          {/* Kind Icon */}
                          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${tone.bg} ${tone.border} ${tone.text}`}>
                            <Icon size={17} />
                          </div>

                          {/* Supplier Name & Account Finder */}
                          <div className="min-w-0">
                            <span className="text-[10px] font-black text-slate-500 block mb-0.5">
                              {kindLabel(c.kind, isAr)}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <input
                                value={c.supplierName}
                                onChange={(e) => patchComponent(c.id, { supplierName: e.target.value })}
                                placeholder={isAr ? 'اسم المورد أو شركة الطيران...' : 'Supplier name...'}
                                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[12px] font-bold text-slate-900 outline-none focus:border-[#F45A0A]"
                              />
                              <Tooltip label={isAr ? 'بحث متقدّم في دليل الحسابات' : 'Search accounts'} withArrow position="top">
                                <button
                                  type="button"
                                  onClick={() => setFinder({ open: true, componentId: c.id })}
                                  className="h-8 w-8 rounded-lg border border-orange-200 bg-orange-50 text-[#F45A0A] hover:bg-orange-100 flex items-center justify-center cursor-pointer shrink-0 transition-colors"
                                >
                                  <Search size={14} />
                                </button>
                              </Tooltip>
                            </div>
                          </div>

                          {/* Cost Input */}
                          <div>
                            <span className="text-[10px] font-black text-slate-500 block mb-0.5">
                              {isAr ? `الكلفة (${design.currency})` : `Cost (${design.currency})`}
                            </span>
                            <input
                              value={c.cost ? c.cost.toLocaleString('en-US') : ''}
                              onChange={(e) => patchComponent(c.id, { cost: numeric(e.target.value) })}
                              placeholder="0"
                              dir="ltr"
                              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[12.5px] font-mono font-black text-slate-900 text-end outline-none focus:border-[#F45A0A]"
                            />
                          </div>

                          {/* Per Seat vs Whole Group Toggle */}
                          <Tooltip
                            label={
                              c.perSeat
                                ? isAr ? 'الكلفة تحسب لكل مقعد/مسافر' : 'Cost applies per individual seat'
                                : isAr ? 'الكلفة إجمالية للكروب كامل وتقسّم على المقاعد' : 'Cost applies to the entire group'
                            }
                            withArrow
                            position="top"
                          >
                            <button
                              type="button"
                              onClick={() => patchComponent(c.id, { perSeat: !c.perSeat })}
                              className={`h-8 px-2.5 rounded-lg border text-[11px] font-black cursor-pointer whitespace-nowrap transition-colors ${
                                c.perSeat
                                  ? 'bg-indigo-50 border-indigo-200 text-indigo-800 hover:bg-indigo-100'
                                  : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                              }`}
                            >
                              {c.perSeat ? (isAr ? 'للمقعد' : 'Per seat') : isAr ? 'للكروب كامل' : 'Whole group'}
                            </button>
                          </Tooltip>

                          {/* Delete Component */}
                          <button
                            type="button"
                            onClick={() => removeComponent(c.id)}
                            className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:border-rose-200 flex items-center justify-center cursor-pointer shrink-0 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Seat Cost & Suggested Sale Price Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
                  
                  {/* Card 1: Computed Seat Cost */}
                  <div className="rounded-2xl border border-slate-200 bg-[#FAFAFA] p-3.5 flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-slate-500 block">
                      {isAr ? 'كلفة المقعد الواحد (محسوبة)' : 'Seat Cost (Calculated)'}
                    </span>
                    <span className="font-mono font-black text-base text-slate-900 block mt-1 tabular-nums" dir="ltr">
                      {money(totals.costPerSeat, design.currency)}
                    </span>
                  </div>

                  {/* Card 2: Seat Sale Price (Editable) */}
                  <div className="rounded-2xl border border-orange-200 bg-[#FFF3E8]/40 p-3.5">
                    <label className="text-[11px] font-bold text-[#F45A0A] block mb-1">
                      {isAr ? 'سعر بيع المقعد المقترح *' : 'Seat Sale Price *'}
                    </label>
                    <input
                      value={design.seatPrice ? design.seatPrice.toLocaleString('en-US') : ''}
                      onChange={(e) => patch({ seatPrice: numeric(e.target.value) })}
                      placeholder="0"
                      dir="ltr"
                      className="w-full h-8 px-2.5 rounded-lg border border-orange-300 bg-white text-[13px] font-mono font-black text-slate-900 text-end outline-none focus:border-[#F45A0A]"
                    />
                  </div>

                  {/* Card 3: Profit Per Seat */}
                  <div
                    className={`rounded-2xl border p-3.5 flex flex-col justify-between ${
                      totals.profitPerSeat >= 0
                        ? 'border-emerald-200 bg-emerald-50/70'
                        : 'border-rose-200 bg-rose-50/70'
                    }`}
                  >
                    <span className="text-[11px] font-bold text-slate-600 block">
                      {isAr ? 'ربح المقعد الواحد' : 'Profit Per Seat'}
                    </span>
                    <span
                      className={`font-mono font-black text-base block mt-1 tabular-nums ${
                        totals.profitPerSeat >= 0 ? 'text-[#078B61]' : 'text-rose-700'
                      }`}
                      dir="ltr"
                    >
                      {totals.profitPerSeat >= 0 ? '+' : ''}
                      {money(totals.profitPerSeat, design.currency)}
                    </span>
                  </div>

                </div>

              </div>

            </div>
          ) : (
            /* ── STEP 2: SELL SEATS TO CUSTOMERS ── */
            <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-5 space-y-4">
              
              {/* Header & Seat Progress */}
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-orange-50 border border-orange-200 text-[#F45A0A] flex items-center justify-center">
                      <Armchair size={15} />
                    </div>
                    <span className="font-black text-[13px] text-slate-900">
                      {isAr ? 'توزيع وبيع مقاعد الكروب' : 'Seat Sales & Allocation'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`inline-flex items-center gap-1 text-[11.5px] font-black px-2.5 py-0.5 rounded-full border ${
                        totals.remainingSeats === 0
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-amber-50 border-amber-200 text-amber-800'
                      }`}
                    >
                      {totals.remainingSeats === 0 ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                      <span>
                        {isAr
                          ? `تم بيع ${totals.soldSeats} من إجمالي ${totals.seats} مقعداً — المتبقي: ${totals.remainingSeats} مقعد`
                          : `Sold ${totals.soldSeats} of ${totals.seats} seats — Remaining: ${totals.remainingSeats}`}
                      </span>
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={addCustomer}
                  disabled={totals.remainingSeats === 0}
                  className="h-[38px] px-4 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-[12px] font-black cursor-pointer flex items-center gap-1.5 shadow-xs transition-all active:scale-[0.98]"
                >
                  <Plus size={15} strokeWidth={2.4} />
                  <span>{isAr ? 'إضافة مشتري / عميل' : 'Add Passenger / Buyer'}</span>
                </button>
              </div>

              {/* Customers List Table */}
              {design.customers.length === 0 ? (
                <div className="py-14 text-center rounded-2xl border border-dashed border-slate-200 bg-[#FAFAFA]">
                  <Armchair size={34} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-[13px] font-bold text-slate-600">
                    {isAr ? 'لم يتم بيع أو تخصيص أي مقعد بعد' : 'No seats allocated yet'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {isAr
                      ? 'اضغط على «إضافة مشتري / عميل» لاختيار العميل وتحديد سعر المقعد وطريقة الدفع'
                      : 'Click "Add Passenger / Buyer" to select customer, sale price, and payment method'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-[#E5E7EB]">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#F8FAFC] text-slate-700 text-[11.5px] font-black border-b border-[#E5E7EB]">
                        <th className="p-2.5 w-12 text-center">#</th>
                        <th className="p-2.5 text-start">{isAr ? 'العميل / المستفيد' : 'Customer'}</th>
                        <th className="p-2.5 text-start w-40">{isAr ? 'الوكيل' : 'Agent'}</th>
                        <th className="p-2.5 w-32 text-center">{isAr ? 'نوع المبيع' : 'Payment'}</th>
                        <th className="p-2.5 w-36 text-end">{isAr ? 'سعر البيع' : 'Sale Price'}</th>
                        <th className="p-2.5 w-36 text-end">{isAr ? 'صافي الربح' : 'Profit'}</th>
                        <th className="p-2.5 w-12 text-center" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {design.customers.map((c, idx) => {
                        const profit = (Number(c.sale) || 0) - totals.costPerSeat;
                        return (
                          <tr key={c.id} className="hover:bg-orange-50/30 transition-colors">
                            <td className="p-2.5 text-center">
                              <span className="w-6 h-6 rounded-full bg-orange-50 text-[#F45A0A] border border-orange-200 text-[11px] font-mono font-black inline-flex items-center justify-center">
                                {idx + 1}
                              </span>
                            </td>
                            <td className="p-2.5">
                              <SearchableCombobox
                                value={c.name}
                                onChange={(val) => patchCustomer(c.id, { name: val || '' })}
                                options={customerOptions}
                                placeholder={isAr ? 'اختر العميل أو اكتب اسماً...' : 'Customer...'}
                                allowCustomValue
                              />
                            </td>
                            <td className="p-2.5">
                              <input
                                value={c.agent || ''}
                                onChange={(e) => patchCustomer(c.id, { agent: e.target.value })}
                                placeholder={isAr ? 'اسم الوكيل' : 'Agent'}
                                className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-[12px] font-bold outline-none focus:border-[#F45A0A]"
                              />
                            </td>
                            <td className="p-2.5">
                              <select
                                value={c.payType}
                                onChange={(e) => patchCustomer(c.id, { payType: e.target.value as 'CASH' | 'CREDIT' })}
                                className="w-full h-9 px-2 rounded-lg border border-slate-200 bg-white text-[11.5px] font-bold cursor-pointer outline-none focus:border-[#F45A0A]"
                              >
                                <option value="CASH">{isAr ? 'نقدي' : 'Cash'}</option>
                                <option value="CREDIT">{isAr ? 'آجل' : 'Credit'}</option>
                              </select>
                            </td>
                            <td className="p-2.5">
                              <input
                                value={c.sale ? c.sale.toLocaleString('en-US') : ''}
                                onChange={(e) => patchCustomer(c.id, { sale: numeric(e.target.value) })}
                                dir="ltr"
                                placeholder="0"
                                className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-[12.5px] font-mono font-black text-end outline-none focus:border-[#F45A0A]"
                              />
                            </td>
                            <td className="p-2.5 text-end font-mono font-black text-[12.5px]" dir="ltr">
                              <span className={profit >= 0 ? 'text-[#078B61]' : 'text-rose-600'}>
                                {profit >= 0 ? '+' : ''}
                                {money(profit, design.currency)}
                              </span>
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => removeCustomer(c.id)}
                                className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:border-rose-200 inline-flex items-center justify-center cursor-pointer transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          )}

        </div>
      </div>

      {/* ── 3. BOTTOM SUMMARY & NAVIGATION DOCK ── */}
      <div className="bg-white border-t border-[#E5E7EB] shadow-lg shrink-0">
        <div className="max-w-[1650px] mx-auto w-full px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          
          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-2.5 flex-wrap text-[11.5px]">
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1">
              <span className="text-[10px] font-bold text-slate-500 block">{isAr ? 'المقاعد المبيعة' : 'Seats Sold'}</span>
              <span className="font-mono font-black text-slate-900 text-[12.5px]" dir="ltr">
                {totals.soldSeats} / {totals.seats}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1">
              <span className="text-[10px] font-bold text-slate-500 block">{isAr ? 'كلفة المقعد' : 'Seat Cost'}</span>
              <span className="font-mono font-black text-slate-900 text-[12.5px]" dir="ltr">
                {money(totals.costPerSeat, design.currency)}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1">
              <span className="text-[10px] font-bold text-slate-500 block">{isAr ? 'إجمالي المبيعات' : 'Total Sales'}</span>
              <span className="font-mono font-black text-slate-900 text-[12.5px]" dir="ltr">
                {money(totals.salesTotal, design.currency)}
              </span>
            </div>

            <div
              className={`rounded-xl px-3 py-1 border ${
                totals.realisedProfit >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
              }`}
            >
              <span className="text-[10px] font-bold text-slate-600 block flex items-center gap-1">
                <TrendingUp size={12} />
                <span>{isAr ? 'الربح المحقق' : 'Realised Profit'}</span>
              </span>
              <span
                className={`font-mono font-black text-[12.5px] ${
                  totals.realisedProfit >= 0 ? 'text-[#078B61]' : 'text-rose-700'
                }`}
                dir="ltr"
              >
                {totals.realisedProfit >= 0 ? '+' : ''}
                {money(totals.realisedProfit, design.currency)}
              </span>
            </div>
          </div>

          {/* Navigation & Action Buttons */}
          <div className="flex items-center gap-2">
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="h-9 px-3.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer flex items-center gap-1.5 transition-colors"
              >
                {direction === 'rtl' ? <ArrowRight size={14} /> : <ArrowLeft size={14} />}
                <span>{isAr ? 'رجوع للتصميم' : 'Back to Design'}</span>
              </button>
            )}

            {step === 1 ? (
              <button
                type="button"
                disabled={!stepOneReady}
                onClick={() => setStep(2)}
                className="h-9 px-5 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-xs font-black cursor-pointer flex items-center gap-1.5 shadow-xs transition-all active:scale-[0.98]"
              >
                <span>{isAr ? 'التالي: بيع المقاعد' : 'Next: Sell Seats'}</span>
                {direction === 'rtl' ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}
              </button>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="h-9 px-6 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] disabled:opacity-60 text-white text-xs font-black cursor-pointer flex items-center gap-1.5 shadow-xs transition-all active:scale-[0.98]"
              >
                {saving ? <Loader size={14} color="white" /> : <Save size={15} />}
                <span>{isAr ? 'حفظ الكروب' : 'Save Group'}</span>
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Account Finder Modal */}
      <AccountFinderModal
        opened={finder.open}
        initialScope="SUPPLIER"
        onClose={() => setFinder({ open: false })}
        onSelect={(account: AccountFinderResult) => {
          if (finder.componentId) {
            patchComponent(finder.componentId, {
              supplierName: account.name,
              supplierAccountId: account.id,
            });
          }
        }}
      />
    </div>
  );
};

export default GroupDesignWorkspace;
