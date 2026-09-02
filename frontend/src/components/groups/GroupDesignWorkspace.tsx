import React, { useEffect, useMemo, useState } from 'react';
import { Loader, Menu } from '@mantine/core';
import {
  IconX,
  IconUsersGroup,
  IconArrowLeft,
  IconArrowRight,
  IconPlus,
  IconTrash,
  IconDeviceFloppy,
  IconSearch,
  IconTicket,
  IconBuildingSkyscraper,
  IconId,
  IconShieldCheck,
  IconBus,
  IconUserStar,
  IconPackage,
  IconCoins,
  IconArmchair,
  IconTrendingUp,
} from '@tabler/icons-react';
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
  TICKET: IconTicket,
  HOTEL: IconBuildingSkyscraper,
  VISA: IconId,
  INSURANCE: IconShieldCheck,
  TRANSPORT: IconBus,
  GUIDE: IconUserStar,
  PACKAGE: IconPackage,
  EXPENSE: IconCoins,
};

const KIND_TONE: Record<GroupComponentKind, string> = {
  TICKET: 'bg-sky-50 border-sky-200 text-sky-700',
  HOTEL: 'bg-violet-50 border-violet-200 text-violet-700',
  VISA: 'bg-indigo-50 border-indigo-200 text-indigo-700',
  INSURANCE: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  TRANSPORT: 'bg-amber-50 border-amber-200 text-amber-800',
  GUIDE: 'bg-teal-50 border-teal-200 text-teal-700',
  PACKAGE: 'bg-orange-50 border-orange-200 text-[#F45A0A]',
  EXPENSE: 'bg-slate-100 border-slate-200 text-slate-700',
};

const money = (v: number, currency: string) =>
  `${Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${currency === 'USD' ? '$' : 'IQD'}`;

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
 * تصميم الكروب وبيعه — في خطوتين.
 *
 * الخطوة الأولى تجيب: ما هذا الكروب، وبكم يكلّف المقعد فيه؟ والثانية تجيب: من
 * أخذ المقاعد وبكم؟ وما بينهما محسوبٌ لا مُدخَل: كلفة المقعد تُشتقّ من مكوّناته،
 * وربحه من فرق سعره عن كلفته — فلا يُطلب من المستخدم رقمٌ يستطيع النظام حسابه.
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
          // سعر المقعد المقترح يُملأ تلقائياً، فالبيع بسعر الكروب هو الحال الغالب.
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
      showErrorNotification(isAr ? 'اسم الكروب مطلوب' : 'Group name required', isAr ? 'سمِّ الكروب قبل الحفظ.' : 'Name the group first.');
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
        // كل عميل مقعدٌ مبيع: يُحفظ مسافراً بكلفته وسعره، فيبقى الكروب مقروءاً
        // في كشوف الحسابات والتقارير مثل أي تذكرة.
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
        isAr ? 'حُفظ الكروب' : 'Group saved',
        isAr
          ? `${design.groupName} — ${totals.soldSeats} من ${totals.seats} مقعداً مبيعة`
          : `${design.groupName} — ${totals.soldSeats} of ${totals.seats} seats sold`,
      );
      onSuccess?.();
      onClose();
    } catch (err: any) {
      showErrorNotification(
        isAr ? 'تعذّر الحفظ' : 'Save failed',
        err?.message || (isAr ? 'لم يُحفظ الكروب' : 'The group was not saved'),
      );
    } finally {
      setSaving(false);
    }
  };

  if (!opened) return null;

  const Field: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({
    label,
    children,
    className = '',
  }) => (
    <div className={className}>
      <label className="text-[11.5px] font-bold text-slate-700 block mb-1">{label}</label>
      {children}
    </div>
  );

  const inputClass =
    'w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-[12.5px] font-bold text-slate-900 outline-none hover:border-slate-400 focus:border-[#F45A0A] focus:ring-2 focus:ring-orange-100 transition-all placeholder:text-slate-300 placeholder:font-normal';

  return (
    <div className="fixed inset-0 z-9998 bg-[#F7F8FA] flex flex-col font-sans" dir={direction}>
      {/* ── الترويسة والخطوتان ── */}
      <div className="bg-white border-b border-slate-200 shadow-2xs shrink-0">
        <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#F45A0A] to-[#f59e0b] text-white flex items-center justify-center shrink-0">
              <IconUsersGroup size={20} />
            </div>
            <div>
              <h2 className="font-black text-sm text-slate-900 leading-tight">
                {(initialData as any)?.id
                  ? isAr ? 'تعديل كروب' : 'Edit group'
                  : isAr ? 'كروب جديد' : 'New group'}
              </h2>
              <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                {design.groupName || (isAr ? 'بلا اسم بعد' : 'unnamed')}
              </p>
            </div>
          </div>

          {/* خطوتان لا سبع نوافذ */}
          <div className="flex items-center gap-1.5">
            {([
              { n: 1 as const, ar: 'تصميم الكروب وكلفته', en: 'Design & cost' },
              { n: 2 as const, ar: 'بيع المقاعد', en: 'Sell the seats' },
            ]).map((s, i) => (
              <React.Fragment key={s.n}>
                {i > 0 && <div className="w-6 h-px bg-slate-300" />}
                <button
                  type="button"
                  onClick={() => (s.n === 1 || stepOneReady) && setStep(s.n)}
                  disabled={s.n === 2 && !stepOneReady}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11.5px] font-black border transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-45 ${
                    step === s.n
                      ? 'bg-[#F45A0A] text-white border-[#F45A0A] shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`w-4.5 h-4.5 rounded-full text-[10px] flex items-center justify-center font-mono ${
                      step === s.n ? 'bg-white/25' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {s.n}
                  </span>
                  {isAr ? s.ar : s.en}
                </button>
              </React.Fragment>
            ))}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center cursor-pointer transition-colors"
          >
            <IconX size={16} />
          </button>
        </div>
      </div>

      {/* ── الجسم ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 py-4 pb-32 space-y-4">
          {step === 1 ? (
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)] gap-4 items-start">
              {/* ── هوية الكروب ── */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <IconUsersGroup size={16} className="text-[#F45A0A]" />
                  <span className="font-black text-xs text-slate-900">
                    {isAr ? 'معلومات الكروب' : 'Group info'}
                  </span>
                </div>

                <Field label={isAr ? 'اسم الكروب *' : 'Group name *'}>
                  <input
                    value={design.groupName}
                    onChange={(e) => patch({ groupName: e.target.value })}
                    placeholder={isAr ? 'مثال: BGW-TBS 18-09-2026' : 'e.g. BGW-TBS 18-09-2026'}
                    className={inputClass}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-2">
                  <Field label={isAr ? 'من' : 'From'}>
                    <input
                      value={design.routeFrom}
                      onChange={(e) => patch({ routeFrom: e.target.value.toUpperCase() })}
                      placeholder="BGW"
                      dir="ltr"
                      className={`${inputClass} font-mono text-center`}
                    />
                  </Field>
                  <Field label={isAr ? 'إلى' : 'To'}>
                    <input
                      value={design.routeTo}
                      onChange={(e) => patch({ routeTo: e.target.value.toUpperCase() })}
                      placeholder="TBS"
                      dir="ltr"
                      className={`${inputClass} font-mono text-center`}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Field label={isAr ? 'تاريخ السفر' : 'Travel date'}>
                    <input
                      type="date"
                      value={design.travelDate}
                      onChange={(e) => patch({ travelDate: e.target.value })}
                      className={`${inputClass} font-mono`}
                    />
                  </Field>
                  <Field label={isAr ? 'تاريخ الشراء' : 'Buy date'}>
                    <input
                      type="date"
                      value={design.buyDate}
                      onChange={(e) => patch({ buyDate: e.target.value })}
                      className={`${inputClass} font-mono`}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Field label={isAr ? 'نوع الكروب' : 'Group type'}>
                    <select
                      value={design.groupType}
                      onChange={(e) => patch({ groupType: e.target.value })}
                      className={`${inputClass} cursor-pointer`}
                    >
                      <option value="FULL">{isAr ? 'كامل (Full)' : 'Full'}</option>
                      <option value="LAND">{isAr ? 'بري' : 'Land'}</option>
                      <option value="AIR">{isAr ? 'جوي' : 'Air'}</option>
                      <option value="HOTEL_ONLY">{isAr ? 'فندق فقط' : 'Hotel only'}</option>
                    </select>
                  </Field>
                  <Field label={isAr ? 'الوجهة / الدولة' : 'Country'}>
                    <input
                      value={design.country}
                      onChange={(e) => patch({ country: e.target.value })}
                      className={inputClass}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Field label={isAr ? 'عدد المقاعد *' : 'Seats *'}>
                    <input
                      value={design.seats}
                      onChange={(e) => patch({ seats: Math.max(1, Math.round(numeric(e.target.value))) })}
                      dir="ltr"
                      className={`${inputClass} font-mono text-center`}
                    />
                  </Field>
                  <Field label={isAr ? 'العملة' : 'Currency'}>
                    <select
                      value={design.currency}
                      onChange={(e) => patch({ currency: e.target.value as 'IQD' | 'USD' })}
                      className={`${inputClass} cursor-pointer`}
                    >
                      <option value="IQD">IQD</option>
                      <option value="USD">USD</option>
                    </select>
                  </Field>
                </div>

                <Field label={isAr ? 'ملاحظات' : 'Notes'}>
                  <textarea
                    rows={2}
                    value={design.notes}
                    onChange={(e) => patch({ notes: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-[12px] font-medium text-slate-900 outline-none focus:border-[#F45A0A]"
                  />
                </Field>
              </div>

              {/* ── مكوّنات الكلفة ── */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 flex-wrap">
                  <div className="flex items-center gap-2">
                    <IconPackage size={16} className="text-[#F45A0A]" />
                    <span className="font-black text-xs text-slate-900">
                      {isAr ? 'ممّ يتركّب المقعد؟' : 'What makes up a seat?'}
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">
                      {isAr ? 'تذكرة · فندق · تأشيرة · نقل · مرشد…' : 'ticket · hotel · visa · transport · guide…'}
                    </span>
                  </div>

                  <Menu position="bottom-end" shadow="lg" radius="lg" width={190} withinPortal zIndex={10060}>
                    <Menu.Target>
                      <button
                        type="button"
                        className="h-8 px-3 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white text-[11.5px] font-black cursor-pointer flex items-center gap-1.5 shadow-xs"
                      >
                        <IconPlus size={14} />
                        {isAr ? 'إضافة مكوّن' : 'Add component'}
                      </button>
                    </Menu.Target>
                    <Menu.Dropdown className="p-1.5" style={{ direction }}>
                      {COMPONENT_KINDS.map((k) => {
                        const Icon = KIND_ICON[k.kind];
                        return (
                          <Menu.Item
                            key={k.kind}
                            className="rounded-lg"
                            leftSection={
                              <span className={`w-6 h-6 rounded-lg border flex items-center justify-center ${KIND_TONE[k.kind]}`}>
                                <Icon size={13} />
                              </span>
                            }
                            onClick={() => addComponent(k.kind)}
                          >
                            <span className="text-[12px] font-bold">{isAr ? k.ar : k.en}</span>
                          </Menu.Item>
                        );
                      })}
                    </Menu.Dropdown>
                  </Menu>
                </div>

                {design.components.length === 0 ? (
                  <div className="py-10 text-center text-slate-400">
                    <IconPackage size={26} className="mx-auto mb-1.5" />
                    <p className="text-xs font-bold">
                      {isAr ? 'لا مكوّن بعد — أضف تذكرة أو فندقاً لتبدأ كلفة المقعد' : 'No components yet'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {design.components.map((c) => {
                      const Icon = KIND_ICON[c.kind];
                      return (
                        <div
                          key={c.id}
                          className="grid grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] items-center gap-2 p-2 rounded-xl border border-slate-200 bg-slate-50/60"
                        >
                          <span className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${KIND_TONE[c.kind]}`}>
                            <Icon size={15} />
                          </span>

                          <div className="min-w-0">
                            <span className="text-[10px] font-black text-slate-500 block">{kindLabel(c.kind, isAr)}</span>
                            <div className="flex items-center gap-1">
                              <input
                                value={c.supplierName}
                                onChange={(e) => patchComponent(c.id, { supplierName: e.target.value })}
                                placeholder={isAr ? 'المورد…' : 'Supplier…'}
                                className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-[12px] font-bold text-slate-900 outline-none focus:border-[#F45A0A]"
                              />
                              <button
                                type="button"
                                title={isAr ? 'بحث متقدّم في الحسابات' : 'Advanced account search'}
                                onClick={() => setFinder({ open: true, componentId: c.id })}
                                className="h-8 w-8 rounded-lg border border-orange-200 bg-orange-50 text-[#F45A0A] hover:bg-orange-100 flex items-center justify-center cursor-pointer shrink-0"
                              >
                                <IconSearch size={13} />
                              </button>
                            </div>
                          </div>

                          <div>
                            <span className="text-[10px] font-black text-slate-500 block">
                              {isAr ? 'الكلفة' : 'Cost'}
                            </span>
                            <input
                              value={c.cost ? c.cost.toLocaleString('en-US') : ''}
                              onChange={(e) => patchComponent(c.id, { cost: numeric(e.target.value) })}
                              placeholder="0"
                              dir="ltr"
                              className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-[12px] font-mono font-bold text-slate-900 text-end outline-none focus:border-[#F45A0A]"
                            />
                          </div>

                          {/* للمقعد أم للمجموعة — الفرق بين ثمن تذكرةٍ لكل راكب وثمن حافلةٍ واحدة */}
                          <button
                            type="button"
                            onClick={() => patchComponent(c.id, { perSeat: !c.perSeat })}
                            className={`h-8 px-2 rounded-lg border text-[10.5px] font-black cursor-pointer whitespace-nowrap transition-colors ${
                              c.perSeat
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-800'
                                : 'bg-amber-50 border-amber-200 text-amber-800'
                            }`}
                          >
                            {c.perSeat ? (isAr ? 'للمقعد' : 'per seat') : isAr ? 'للمجموعة' : 'whole group'}
                          </button>

                          <button
                            type="button"
                            onClick={() => removeComponent(c.id)}
                            className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:border-rose-200 flex items-center justify-center cursor-pointer shrink-0"
                          >
                            <IconTrash size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* سعر البيع المقترح — يُملأ به كل مقعد يُباع */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                    <span className="text-[10.5px] font-black text-slate-500 block">
                      {isAr ? 'كلفة المقعد (محسوبة)' : 'Seat cost (computed)'}
                    </span>
                    <span className="font-mono font-black text-sm text-slate-900" dir="ltr">
                      {money(totals.costPerSeat, design.currency)}
                    </span>
                  </div>
                  <Field label={isAr ? 'سعر بيع المقعد' : 'Seat sale price'}>
                    <input
                      value={design.seatPrice ? design.seatPrice.toLocaleString('en-US') : ''}
                      onChange={(e) => patch({ seatPrice: numeric(e.target.value) })}
                      placeholder="0"
                      dir="ltr"
                      className={`${inputClass} font-mono text-end`}
                    />
                  </Field>
                  <div
                    className={`rounded-xl border p-2.5 ${
                      totals.profitPerSeat >= 0
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-rose-200 bg-rose-50'
                    }`}
                  >
                    <span className="text-[10.5px] font-black text-slate-500 block">
                      {isAr ? 'ربح المقعد' : 'Seat profit'}
                    </span>
                    <span
                      className={`font-mono font-black text-sm ${
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
            /* ── الخطوة ٢: بيع المقاعد ── */
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 flex-wrap">
                <div className="flex items-center gap-2">
                  <IconArmchair size={16} className="text-[#F45A0A]" />
                  <span className="font-black text-xs text-slate-900">{isAr ? 'بيع المقاعد' : 'Sell the seats'}</span>
                  <span
                    className={`text-[11px] font-black px-2 py-0.5 rounded-full border ${
                      totals.remainingSeats === 0
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-amber-50 border-amber-200 text-amber-800'
                    }`}
                  >
                    {isAr
                      ? `${totals.soldSeats} من ${totals.seats} — متبقٍ ${totals.remainingSeats}`
                      : `${totals.soldSeats} of ${totals.seats} — ${totals.remainingSeats} left`}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={addCustomer}
                  disabled={totals.remainingSeats === 0}
                  className="h-8 px-3 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-[11.5px] font-black cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <IconPlus size={14} />
                  {isAr ? 'إضافة عميل' : 'Add customer'}
                </button>
              </div>

              {design.customers.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <IconArmchair size={26} className="mx-auto mb-1.5" />
                  <p className="text-xs font-bold">
                    {isAr ? 'لم يُبَع مقعد بعد' : 'No seats sold yet'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 text-[11px] font-black">
                        <th className="p-2 w-10 text-center">#</th>
                        <th className="p-2 text-start">{isAr ? 'العميل' : 'Customer'}</th>
                        <th className="p-2 text-start w-36">{isAr ? 'الوكيل' : 'Agent'}</th>
                        <th className="p-2 w-28 text-center">{isAr ? 'الدفع' : 'Payment'}</th>
                        <th className="p-2 w-32 text-end">{isAr ? 'سعر البيع' : 'Sale'}</th>
                        <th className="p-2 w-32 text-end">{isAr ? 'الربح' : 'Profit'}</th>
                        <th className="p-2 w-12" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {design.customers.map((c, idx) => {
                        const profit = (Number(c.sale) || 0) - totals.costPerSeat;
                        return (
                          <tr key={c.id} className="hover:bg-slate-50/60">
                            <td className="p-2 text-center">
                              <span className="w-6 h-6 rounded-full bg-orange-50 text-[#F45A0A] border border-orange-200 text-[11px] font-black inline-flex items-center justify-center">
                                {idx + 1}
                              </span>
                            </td>
                            <td className="p-2">
                              <SearchableCombobox
                                value={c.name}
                                onChange={(val) => patchCustomer(c.id, { name: val || '' })}
                                options={customerOptions}
                                placeholder={isAr ? 'اسم العميل…' : 'Customer…'}
                                allowCustomValue
                              />
                            </td>
                            <td className="p-2">
                              <input
                                value={c.agent || ''}
                                onChange={(e) => patchCustomer(c.id, { agent: e.target.value })}
                                placeholder={isAr ? 'الوكيل' : 'Agent'}
                                className="w-full h-9 px-2 rounded-lg border border-slate-200 bg-white text-[12px] font-bold outline-none focus:border-[#F45A0A]"
                              />
                            </td>
                            <td className="p-2">
                              <select
                                value={c.payType}
                                onChange={(e) => patchCustomer(c.id, { payType: e.target.value as 'CASH' | 'CREDIT' })}
                                className="w-full h-9 px-1.5 rounded-lg border border-slate-200 bg-white text-[11.5px] font-bold cursor-pointer outline-none focus:border-[#F45A0A]"
                              >
                                <option value="CASH">{isAr ? 'نقدي' : 'Cash'}</option>
                                <option value="CREDIT">{isAr ? 'آجل' : 'Credit'}</option>
                              </select>
                            </td>
                            <td className="p-2">
                              <input
                                value={c.sale ? c.sale.toLocaleString('en-US') : ''}
                                onChange={(e) => patchCustomer(c.id, { sale: numeric(e.target.value) })}
                                dir="ltr"
                                placeholder="0"
                                className="w-full h-9 px-2 rounded-lg border border-slate-200 bg-white text-[12px] font-mono font-black text-end outline-none focus:border-[#F45A0A]"
                              />
                            </td>
                            <td className="p-2 text-end font-mono font-black text-[12px]" dir="ltr">
                              <span className={profit >= 0 ? 'text-[#078B61]' : 'text-rose-600'}>
                                {profit >= 0 ? '+' : ''}
                                {money(profit, design.currency)}
                              </span>
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => removeCustomer(c.id)}
                                className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:border-rose-200 inline-flex items-center justify-center cursor-pointer"
                              >
                                <IconTrash size={13} />
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

      {/* ── الشريط السفلي: الأرقام والتنقّل ── */}
      <div className="bg-white border-t border-slate-200 shadow-lg shrink-0">
        <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap text-[11px]">
            {[
              { label: isAr ? 'المقاعد' : 'Seats', value: `${totals.soldSeats}/${totals.seats}`, icon: IconArmchair },
              { label: isAr ? 'كلفة المقعد' : 'Seat cost', value: money(totals.costPerSeat, design.currency), icon: IconCoins },
              { label: isAr ? 'إجمالي البيع' : 'Sales', value: money(totals.salesTotal, design.currency), icon: IconCoins },
            ].map((s) => (
              <div key={s.label} className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
                <span className="text-[10px] font-bold text-slate-500 block">{s.label}</span>
                <span className="font-mono font-black text-slate-900 text-[12px]" dir="ltr">
                  {s.value}
                </span>
              </div>
            ))}
            <div
              className={`rounded-xl px-2.5 py-1 border ${
                totals.realisedProfit >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
              }`}
            >
              <span className="text-[10px] font-bold text-slate-500 block flex items-center gap-1">
                <IconTrendingUp size={11} />
                {isAr ? 'الربح المحقق' : 'Realised profit'}
              </span>
              <span
                className={`font-mono font-black text-[12px] ${
                  totals.realisedProfit >= 0 ? 'text-[#078B61]' : 'text-rose-700'
                }`}
                dir="ltr"
              >
                {totals.realisedProfit >= 0 ? '+' : ''}
                {money(totals.realisedProfit, design.currency)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer flex items-center gap-1.5"
              >
                {direction === 'rtl' ? <IconArrowRight size={14} /> : <IconArrowLeft size={14} />}
                {isAr ? 'رجوع للتصميم' : 'Back to design'}
              </button>
            )}

            {step === 1 ? (
              <button
                type="button"
                disabled={!stepOneReady}
                onClick={() => setStep(2)}
                className="h-9 px-5 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-xs font-black cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                {isAr ? 'التالي: بيع المقاعد' : 'Next: sell seats'}
                {direction === 'rtl' ? <IconArrowLeft size={14} /> : <IconArrowRight size={14} />}
              </button>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="h-9 px-5 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] disabled:opacity-60 text-white text-xs font-black cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                {saving ? <Loader size={14} color="white" /> : <IconDeviceFloppy size={15} />}
                {isAr ? 'حفظ الكروب' : 'Save group'}
              </button>
            )}
          </div>
        </div>
      </div>

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
