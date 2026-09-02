import React, { useEffect, useMemo, useState } from 'react';
import { Loader, Menu, Modal, Tooltip } from '@mantine/core';
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
  Layers,
  Sparkles,
  Palette,
  ShoppingCart,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import { SearchableCombobox, type ComboboxOption } from '../ui/SearchableCombobox';
import { AccountingDatePicker } from '../common/date/AccountingDatePicker';
import { AccountFinderModal, type AccountFinderResult } from '../common/AccountFinderModal';
import { ticketsApi, type TicketData } from '../../api/tickets';
import { partnersApi } from '../../api/partners';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { useLanguageStore } from '../../store/useLanguageStore';
import {
  COMPONENT_KINDS,
  computeGroupTotals,
  computeTemplateTotals,
  createDefaultTemplate,
  designFromTicket,
  emptyDesign,
  encodeDesignIntoNotes,
  kindLabel,
  type GroupComponent,
  type GroupComponentKind,
  type GroupCustomer,
  type GroupDesign,
  type GroupTemplate,
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

const money = (v: number, currency = 'USD') => {
  const isUSD = currency === 'USD';
  return `${isUSD ? '$' : ''}${formatEnglishNumber(Number(v || 0), isUSD ? 2 : 0)}${isUSD ? '' : ' IQD'}`;
};

const numeric = (raw: any) => {
  const n = Number(String(raw ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
};

interface Props {
  opened: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialData?: TicketData | null;
}

export const GroupDesignWorkspace: React.FC<Props> = ({ opened, onClose, onSuccess, initialData }) => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  // 1: معلومات الكروب وقوالب الأسعار (Group Info & Templates)
  // 2: بيع وتوزيع المقاعد على المستفيدين (Customers & Seat Sales)
  const [activeTab, setActiveTab] = useState<1 | 2>(1);
  const [design, setDesign] = useState<GroupDesign>(emptyDesign());
  const [saving, setSaving] = useState(false);
  const [customersList, setCustomersList] = useState<any[]>([]);

  // Prices Template Editor Modal State
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<GroupTemplate | null>(null);
  const [templateActiveTab, setTemplateActiveTab] = useState<'AUTO' | 'GLOBAL' | 'EXPENSES'>('AUTO');
  const [componentFilterKind, setComponentFilterKind] = useState<string>('ALL');
  const [componentFilterSupplier, setComponentFilterSupplier] = useState<string>('');

  // Account Finder Modal State
  const [finder, setFinder] = useState<{ open: boolean; componentId?: string }>({
    open: false,
  });

  useEffect(() => {
    if (!opened) return;
    setActiveTab(1);
    setDesign(designFromTicket(initialData));
    partnersApi
      .getCustomers()
      .then((d: any) => setCustomersList(Array.isArray(d) ? d : d?.data || []))
      .catch(() => undefined);
  }, [opened, initialData]);

  const patch = (changes: Partial<GroupDesign>) => setDesign((d) => ({ ...d, ...changes }));

  // Totals for all templates & customers
  const totals = useMemo(() => computeGroupTotals(design), [design]);

  // Customer Combobox Options
  const customerOptions: ComboboxOption[] = useMemo(() => {
    return customersList.map((c: any) => ({
      value: c.nameAr || c.name || c.id,
      label: c.nameAr || c.name || '',
      code: c.code,
    }));
  }, [customersList]);

  // Group Type Options
  const groupTypeOptions: ComboboxOption[] = useMemo(
    () => [
      { value: 'FULL', label: isAr ? 'برنامج كامل (طيران + فندق + خدمات)' : 'Full Package (Flight + Hotel + Services)' },
      { value: 'LAND', label: isAr ? 'بري فقط (Land Package)' : 'Land Package Only' },
      { value: 'AIR', label: isAr ? 'طيران فقط (Flight Only)' : 'Flight Only' },
      { value: 'HOTEL_ONLY', label: isAr ? 'فندق فقط (Hotel Only)' : 'Hotel Only' },
    ],
    [isAr],
  );

  // Currency Options
  const currencyOptions: ComboboxOption[] = useMemo(
    () => [
      { value: 'USD', label: isAr ? '$ دولار أمريكي (USD)' : '$ US Dollar (USD)' },
      { value: 'IQD', label: isAr ? 'د.ع دينار عراقي (IQD)' : 'IQD Iraqi Dinar' },
    ],
    [isAr],
  );

  // Country / Destination Options
  const countryOptions: ComboboxOption[] = useMemo(
    () => [
      { value: 'العراق', label: isAr ? 'العراق' : 'Iraq' },
      { value: 'تركيا', label: isAr ? 'تركيا' : 'Turkey' },
      { value: 'جورجيا', label: isAr ? 'جورجيا' : 'Georgia' },
      { value: 'أذربيجان', label: isAr ? 'أذربيجان' : 'Azerbaijan' },
      { value: 'الإمارات', label: isAr ? 'الإمارات' : 'United Arab Emirates' },
      { value: 'مصر', label: isAr ? 'مصر' : 'Egypt' },
      { value: 'إيران', label: isAr ? 'إيران' : 'Iran' },
      { value: 'ماليزيا', label: isAr ? 'ماليزيا' : 'Malaysia' },
      { value: 'لبنان', label: isAr ? 'لبنان' : 'Lebanon' },
      { value: 'الأردن', label: isAr ? 'الأردن' : 'Jordan' },
    ],
    [isAr],
  );

  // Template Options for Customers Table
  const templateComboboxOptions: ComboboxOption[] = useMemo(() => {
    return (design.templates || []).map((t) => ({
      value: t.id,
      label: `${t.name} (${money(t.seatPrice, t.currency)})`,
    }));
  }, [design.templates]);

  // ── TEMPLATE MANAGEMENT ──
  const handleAddNewTemplate = () => {
    const newTpl = createDefaultTemplate(
      design.seats || 1,
      design.currency,
      design.seatPrice || 0,
    );
    newTpl.name = `${isAr ? 'قالب أسعار' : 'Price Template'} #${(design.templates || []).length + 1}`;
    setDesign((d) => ({
      ...d,
      templates: [...(d.templates || []), newTpl],
    }));
    setEditingTemplate(newTpl);
    setTemplateModalOpen(true);
  };

  const handleEditTemplate = (tpl: GroupTemplate) => {
    setEditingTemplate({ ...tpl, components: [...(tpl.components || [])] });
    setTemplateModalOpen(true);
  };

  const handleSaveTemplateChanges = (updatedTpl: GroupTemplate) => {
    setDesign((d) => ({
      ...d,
      templates: (d.templates || []).map((t) => (t.id === updatedTpl.id ? updatedTpl : t)),
    }));
    setTemplateModalOpen(false);
    setEditingTemplate(null);
  };

  const handleDeleteTemplate = (tplId: string) => {
    if ((design.templates || []).length <= 1) {
      showErrorNotification(
        isAr ? 'تنبيه' : 'Alert',
        isAr ? 'يجب أن يحتوي الكروب على قالب أسعار واحد على الأقل.' : 'Group must have at least one price template.',
      );
      return;
    }
    setDesign((d) => ({
      ...d,
      templates: (d.templates || []).filter((t) => t.id !== tplId),
    }));
  };

  // ── CUSTOMER MANAGEMENT ──
  const handleAddCustomer = (defaultTemplateId?: string) => {
    const targetTpl = (design.templates || []).find((t) => t.id === defaultTemplateId) || (design.templates || [])[0];
    const initialSale = targetTpl ? Number(targetTpl.seatPrice) || 0 : Number(design.seatPrice) || 0;

    setDesign((d) => ({
      ...d,
      customers: [
        ...(d.customers || []),
        {
          id: `cus-${Date.now()}-${(d.customers || []).length}`,
          name: '',
          agent: '',
          templateId: targetTpl?.id,
          templateName: targetTpl?.name,
          payType: 'CASH',
          sale: initialSale,
        },
      ],
    }));
  };

  const handlePatchCustomer = (id: string, changes: Partial<GroupCustomer>) => {
    setDesign((d) => ({
      ...d,
      customers: (d.customers || []).map((c) => (c.id === id ? { ...c, ...changes } : c)),
    }));
  };

  const handleRemoveCustomer = (id: string) => {
    setDesign((d) => ({
      ...d,
      customers: (d.customers || []).filter((c) => c.id !== id),
    }));
  };

  // ── MAIN SAVE ──
  const handleSaveGroup = async () => {
    if (!design.groupName.trim()) {
      showErrorNotification(
        isAr ? 'اسم الكروب مطلوب' : 'Group name required',
        isAr ? 'يرجى تحديد اسم الكروب أو الرحلة قبل الحفظ.' : 'Please enter a group name.',
      );
      setActiveTab(1);
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
        totalBuy: totals.sumCost,
        netBuy: totals.sumCost,
        totalSell: totals.salesTotal || totals.sumExpectedSale,
        netSell: totals.salesTotal || totals.sumExpectedSale,
        profit: totals.realisedProfit || totals.expectedProfit,
        passengers: (design.customers || []).map((c) => ({
          name: c.name || (isAr ? 'مسافر' : 'Passenger'),
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
          ? `${design.groupName} — تم حفظ القوالب ومبيعات المقاعد.`
          : `${design.groupName} — Templates & seat sales saved.`,
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

  return (
    <div
      className="fixed inset-0 z-9998 bg-[#F8FAFC] flex flex-col font-sans select-none"
      dir={direction}
      style={{ fontFamily: language === 'ar' ? "'IBM Plex Sans Arabic', system-ui, sans-serif" : "'IBM Plex Sans', system-ui, sans-serif" }}
    >
      {/* ── 1. HEADER HERO BAR ── */}
      <div className="bg-white border-b border-[#E5E7EB] shadow-2xs shrink-0">
        <div className="max-w-[1720px] mx-auto w-full px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
          
          {/* Identity */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFF3E8] border border-[#FED7AA] text-[#F45A0A] flex items-center justify-center shadow-2xs shrink-0">
              <Package size={22} strokeWidth={2.2} />
            </div>
            <div>
              <h2 className="font-black text-sm sm:text-base text-[#111827] leading-tight">
                {(initialData as any)?.id
                  ? isAr ? 'تعديل الكروب السياحي وقوالب الأسعار' : 'Edit Tour Group & Templates'
                  : isAr ? 'تصميم وإدارة الكروب السياحي (Design Custom Groups)' : 'Design Custom Groups & Pricing Templates'}
              </h2>
              <p className="text-[11px] font-bold text-slate-500 mt-0.5 font-mono">
                {design.groupName || (isAr ? '— كروب بدون اسم بعد —' : '— Unnamed Group —')}
              </p>
            </div>
          </div>

          {/* Stepper / Tabs Bar */}
          <div className="flex items-center gap-1.5 bg-[#F1F5F9] p-1 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab(1)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-[12px] font-black transition-all cursor-pointer ${
                activeTab === 1
                  ? 'bg-[#F45A0A] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              <Palette size={14} />
              <span>{isAr ? '١. معلومات وتصميم الكروب (Group Design)' : '1. Group Info & Design'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab(2)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-[12px] font-black transition-all cursor-pointer ${
                activeTab === 2
                  ? 'bg-[#F45A0A] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              <Users size={14} />
              <span>{isAr ? '٢. المستفيدين وتوزيع المقاعد (Customers & Sale)' : '2. Customers & Seats'}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10.5px] font-mono font-bold bg-white/20">
                {(design.customers || []).length}
              </span>
            </button>
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

      {/* ── 2. BODY CONTENT ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1720px] mx-auto w-full px-4 sm:px-6 py-4 pb-32 space-y-4">
          
          {activeTab === 1 ? (
            /* ══════════════════════════════════════════════════════════════
               TAB 1: GROUP INFO & PRICES TEMPLATES TABLE (الصورة 3)
               ══════════════════════════════════════════════════════════════ */
            <div className="space-y-4">
              
              {/* Card A: Group General Information */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-orange-50 border border-orange-200 text-[#F45A0A] flex items-center justify-center">
                      <Package size={15} />
                    </div>
                    <span className="font-black text-[13.5px] text-slate-900">
                      {isAr ? 'معلومات وهوية الكروب (Group Info)' : 'Group Information'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  {/* Group Name */}
                  <div className="lg:col-span-2">
                    <label className="text-[11.5px] font-bold text-slate-700 block mb-1">
                      {isAr ? 'اسم الكروب أو الرحلة *' : 'Group Name *'}
                    </label>
                    <input
                      value={design.groupName}
                      onChange={(e) => patch({ groupName: e.target.value })}
                      placeholder={isAr ? 'مثال: BGW-TBS 18-09-2026' : 'e.g. BGW-TBS 18-09-2026'}
                      className="w-full h-[46px] px-3.5 rounded-[11px] border border-[#E5E7EB] bg-white text-[13px] font-bold text-slate-900 outline-none hover:border-slate-300 focus:border-2 focus:border-[#F45A0A] transition-all shadow-2xs"
                    />
                  </div>

                  {/* Route From */}
                  <div>
                    <label className="text-[11.5px] font-bold text-slate-700 block mb-1">
                      {isAr ? 'محطة الانطلاق (من)' : 'From'}
                    </label>
                    <input
                      value={design.routeFrom}
                      onChange={(e) => patch({ routeFrom: e.target.value.toUpperCase() })}
                      placeholder="BGW"
                      dir="ltr"
                      className="w-full h-[46px] px-3.5 rounded-[11px] border border-[#E5E7EB] bg-white text-[13px] font-mono font-black text-center text-slate-900 uppercase outline-none hover:border-slate-300 focus:border-2 focus:border-[#F45A0A] transition-all shadow-2xs"
                    />
                  </div>

                  {/* Route To */}
                  <div>
                    <label className="text-[11.5px] font-bold text-slate-700 block mb-1">
                      {isAr ? 'الوجهة (إلى)' : 'To'}
                    </label>
                    <input
                      value={design.routeTo}
                      onChange={(e) => patch({ routeTo: e.target.value.toUpperCase() })}
                      placeholder="IST"
                      dir="ltr"
                      className="w-full h-[46px] px-3.5 rounded-[11px] border border-[#E5E7EB] bg-white text-[13px] font-mono font-black text-center text-slate-900 uppercase outline-none hover:border-slate-300 focus:border-2 focus:border-[#F45A0A] transition-all shadow-2xs"
                    />
                  </div>

                  {/* Travel Date */}
                  <div>
                    <AccountingDatePicker
                      label={isAr ? 'تاريخ السفر' : 'Travel Date'}
                      value={design.travelDate}
                      onChange={(val) => patch({ travelDate: val })}
                      placeholder={isAr ? 'سنة/شهر/يوم' : 'YYYY/MM/DD'}
                    />
                  </div>

                  {/* Buy/Booking Date */}
                  <div>
                    <AccountingDatePicker
                      label={isAr ? 'تاريخ الشراء / الحجز' : 'Booking Date'}
                      value={design.buyDate}
                      onChange={(val) => patch({ buyDate: val })}
                      placeholder={isAr ? 'سنة/شهر/يوم' : 'YYYY/MM/DD'}
                    />
                  </div>

                  {/* Group Type (SearchableCombobox) */}
                  <div>
                    <SearchableCombobox
                      label={isAr ? 'نوع الكروب' : 'Group Type'}
                      value={design.groupType}
                      onChange={(val) => patch({ groupType: val || 'FULL' })}
                      options={groupTypeOptions}
                      placeholder={isAr ? 'اختر نوع الكروب...' : 'Select type...'}
                    />
                  </div>

                  {/* Destination Country (SearchableCombobox) */}
                  <div>
                    <SearchableCombobox
                      label={isAr ? 'الوجهة / الدولة' : 'Destination Country'}
                      value={design.country}
                      onChange={(val) => patch({ country: val || 'العراق' })}
                      options={countryOptions}
                      placeholder={isAr ? 'اختر الدولة...' : 'Select country...'}
                      allowCustomValue
                    />
                  </div>

                  {/* Currency (SearchableCombobox) */}
                  <div>
                    <SearchableCombobox
                      label={isAr ? 'العملة المعتمدة' : 'Currency'}
                      value={design.currency}
                      onChange={(val) => patch({ currency: (val as 'IQD' | 'USD') || 'USD' })}
                      options={currencyOptions}
                      placeholder={isAr ? 'العملة...' : 'Currency...'}
                    />
                  </div>

                  {/* Total Seats */}
                  <div>
                    <label className="text-[11.5px] font-bold text-slate-700 block mb-1">
                      {isAr ? 'المقاعد الإجمالية *' : 'Total Seats *'}
                    </label>
                    <input
                      value={design.seats}
                      onChange={(e) => patch({ seats: Math.max(1, Math.round(numeric(e.target.value))) })}
                      dir="ltr"
                      className="w-full h-[46px] px-3.5 rounded-[11px] border border-[#E5E7EB] bg-white text-[14px] font-mono font-black text-center text-slate-900 outline-none hover:border-slate-300 focus:border-2 focus:border-[#F45A0A] transition-all shadow-2xs"
                    />
                  </div>

                  {/* Notes */}
                  <div className="lg:col-span-2">
                    <label className="text-[11.5px] font-bold text-slate-700 block mb-1">
                      {isAr ? 'ملاحظات وتفاصيل الكروب' : 'Group Notes'}
                    </label>
                    <input
                      value={design.notes}
                      onChange={(e) => patch({ notes: e.target.value })}
                      placeholder={isAr ? 'أي شروط أو تفاصيل تخص برنامج الرحلة...' : 'Any details or conditions...'}
                      className="w-full h-[46px] px-3.5 rounded-[11px] border border-[#E5E7EB] bg-white text-[12.5px] font-medium text-slate-900 outline-none hover:border-slate-300 focus:border-2 focus:border-[#F45A0A] transition-all shadow-2xs"
                    />
                  </div>
                </div>
              </div>

              {/* Card B: Prices Templates Table (تيمبلت الأسعار - الصورة 3) */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-orange-50 border border-orange-200 text-[#F45A0A] flex items-center justify-center">
                        <Palette size={15} />
                      </div>
                      <span className="font-black text-[13.5px] text-slate-900">
                        {isAr ? 'قوالب الأسعار وتكاليف المقاعد (Prices Templates)' : 'Prices Templates'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      {isAr
                        ? 'أضف قالباً أو أكثر لتخصيص أسعار وتكاليف المشتريات (طيران، فندق، فيزا، خدمات) وبيعها للمستفيدين'
                        : 'Add templates with distinct purchasing costs (flights, hotels, visas) and seat prices'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddNewTemplate}
                    className="h-[38px] px-4 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white text-[12px] font-black cursor-pointer flex items-center gap-1.5 shadow-xs transition-all active:scale-[0.98]"
                  >
                    <Plus size={16} strokeWidth={2.4} />
                    <span>{isAr ? 'إضافة تيمبلت جديد (Add Template)' : 'Add Template (+)'}</span>
                  </button>
                </div>

                {/* Templates Grid / Table */}
                <div className="overflow-x-auto rounded-xl border border-[#E5E7EB]">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#0284C7] text-white text-[11.5px] font-black divide-x divide-white/20">
                        <th className="p-2.5 w-12 text-center">ID</th>
                        <th className="p-2.5 text-start">{isAr ? 'اسم التيمبلت' : 'Template Name'}</th>
                        <th className="p-2.5 w-20 text-center">{isAr ? 'المقاعد*' : 'Seats*'}</th>
                        <th className="p-2.5 w-20 text-center">{isAr ? 'المستفيدون' : 'Customers'}</th>
                        <th className="p-2.5 w-28 text-end">{isAr ? 'كلفة مفرد' : 'Single Buy'}</th>
                        <th className="p-2.5 w-28 text-end">{isAr ? 'بيع مفرد' : 'Single Sale'}</th>
                        <th className="p-2.5 w-28 text-end">{isAr ? 'المشتريات' : 'Purchase'}</th>
                        <th className="p-2.5 w-24 text-end">{isAr ? 'المصاريف' : 'Expenses'}</th>
                        <th className="p-2.5 w-28 text-end">{isAr ? 'التكلفة' : 'Cost'}</th>
                        <th className="p-2.5 w-28 text-end">{isAr ? 'المبيعات' : 'Sales'}</th>
                        <th className="p-2.5 w-28 text-end">{isAr ? 'الربح' : 'Profit'}</th>
                        <th className="p-2.5 w-40 text-center">{isAr ? 'الإجراءات' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {(design.templates || []).map((tpl, idx) => {
                        const tplTotals = computeTemplateTotals(tpl);
                        const assignedCustomers = (design.customers || []).filter(
                          (c) => c.templateId === tpl.id,
                        ).length;

                        return (
                          <tr key={tpl.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-2.5 text-center font-mono font-bold text-slate-500">
                              {idx + 1}
                            </td>
                            <td className="p-2.5 font-bold text-slate-900">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-[#F45A0A]" />
                                <span>{tpl.name}</span>
                              </div>
                            </td>
                            <td className="p-2.5 text-center font-mono font-black text-slate-900" dir="ltr">
                              {tplTotals.seats}
                            </td>
                            <td className="p-2.5 text-center font-mono font-bold text-indigo-700" dir="ltr">
                              {assignedCustomers}
                            </td>
                            <td className="p-2.5 text-end font-mono font-black text-slate-800" dir="ltr">
                              {money(tplTotals.costPerSeat, tpl.currency)}
                            </td>
                            <td className="p-2.5 text-end font-mono font-black text-slate-900" dir="ltr">
                              {money(tplTotals.seatPrice, tpl.currency)}
                            </td>
                            <td className="p-2.5 text-end font-mono font-bold text-slate-800" dir="ltr">
                              {money(tplTotals.autoBuy + tplTotals.globalBuy, tpl.currency)}
                            </td>
                            <td className="p-2.5 text-end font-mono font-bold text-slate-500" dir="ltr">
                              {money(tplTotals.globalExpenses, tpl.currency)}
                            </td>
                            <td className="p-2.5 text-end font-mono font-black text-slate-900" dir="ltr">
                              {money(tplTotals.totalCost, tpl.currency)}
                            </td>
                            <td className="p-2.5 text-end font-mono font-black text-slate-900" dir="ltr">
                              {money(tplTotals.totalSale, tpl.currency)}
                            </td>
                            <td className="p-2.5 text-end font-mono font-black text-[#078B61]" dir="ltr">
                              {tplTotals.totalProfit >= 0 ? '+' : ''}
                              {money(tplTotals.totalProfit, tpl.currency)}
                            </td>
                            <td className="p-2.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {/* Design Button (Cyan button like legacy Image 3) */}
                                <button
                                  type="button"
                                  onClick={() => handleEditTemplate(tpl)}
                                  className="px-2.5 py-1 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white text-[11px] font-black cursor-pointer flex items-center gap-1 shadow-2xs transition-colors"
                                >
                                  <Palette size={12} />
                                  <span>{isAr ? 'تصميم' : 'Design'}</span>
                                </button>

                                {/* Sale Button (Magenta button like legacy Image 3) */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleAddCustomer(tpl.id);
                                    setActiveTab(2);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-[#BE185D] hover:bg-[#9D174D] text-white text-[11px] font-black cursor-pointer flex items-center gap-1 shadow-2xs transition-colors"
                                >
                                  <ShoppingCart size={12} />
                                  <span>{isAr ? 'بيع' : 'Sale'}</span>
                                </button>

                                {/* Delete */}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTemplate(tpl.id)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                                  title={isAr ? 'حذف القالب' : 'Delete'}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {/* Summary Row at bottom of table (Image 3) */}
                    <tfoot>
                      <tr className="bg-[#F8FAFC] border-t-2 border-[#E5E7EB] font-black text-[12px] text-slate-900">
                        <td colSpan={6} className="p-2.5 text-start font-sans">
                          {isAr ? 'إجمالي مجاميع القوالب (Summary):' : 'Templates Summary:'}
                        </td>
                        <td className="p-2.5 text-end font-mono text-slate-800" dir="ltr">
                          {money(totals.sumBuy, design.currency)}
                        </td>
                        <td className="p-2.5 text-end font-mono text-slate-500" dir="ltr">
                          {money(totals.sumExpenses, design.currency)}
                        </td>
                        <td className="p-2.5 text-end font-mono text-slate-900" dir="ltr">
                          {money(totals.sumCost, design.currency)}
                        </td>
                        <td className="p-2.5 text-end font-mono text-slate-900" dir="ltr">
                          {money(totals.sumExpectedSale, design.currency)}
                        </td>
                        <td className="p-2.5 text-end font-mono text-[#078B61]" dir="ltr">
                          +{money(totals.expectedProfit, design.currency)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

            </div>
          ) : (
            /* ══════════════════════════════════════════════════════════════
               TAB 2: BENEFICIARIES & SEAT SALES (المستفيدين والبيع)
               ══════════════════════════════════════════════════════════════ */
            <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-5 space-y-4">
              
              {/* Header with Seat Progress */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-orange-50 border border-orange-200 text-[#F45A0A] flex items-center justify-center">
                      <Armchair size={15} />
                    </div>
                    <span className="font-black text-[13.5px] text-slate-900">
                      {isAr ? 'توزيع مقاعد الكروب على المستفيدين والعملاء (Customers & Sales)' : 'Seat Sales & Customers'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`inline-flex items-center gap-1.5 text-[11.5px] font-black px-3 py-0.5 rounded-full border ${
                        totals.remainingSeats === 0
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-amber-50 border-amber-200 text-amber-800'
                      }`}
                    >
                      {totals.remainingSeats === 0 ? <CheckCircle2 size={13} /> : <Clock size={13} />}
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
                  onClick={() => handleAddCustomer()}
                  className="h-[38px] px-4 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white text-[12px] font-black cursor-pointer flex items-center gap-1.5 shadow-xs transition-all active:scale-[0.98]"
                >
                  <Plus size={16} strokeWidth={2.4} />
                  <span>{isAr ? 'إضافة مستفيد / مشتري' : 'Add Passenger / Buyer'}</span>
                </button>
              </div>

              {/* Customers Table */}
              {(design.customers || []).length === 0 ? (
                <div className="py-14 text-center rounded-2xl border border-dashed border-slate-200 bg-[#FAFAFA]">
                  <Armchair size={36} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-[13.5px] font-bold text-slate-700">
                    {isAr ? 'لم يتم تسجيل أي مستفيد أو بيع أي مقعد بعد' : 'No customers or seats registered yet'}
                  </p>
                  <p className="text-[11.5px] text-slate-400 mt-0.5">
                    {isAr
                      ? 'اضغط على «إضافة مستفيد / مشتري» لاختيار العميل وتحديد التيمبلت وسعر البيع'
                      : 'Click "Add Passenger / Buyer" to select customer, price template, and sale price'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[#E5E7EB]">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#F8FAFC] text-slate-700 text-[11.5px] font-black border-b border-[#E5E7EB]">
                        <th className="p-2.5 w-12 text-center">#</th>
                        <th className="p-2.5 text-start">{isAr ? 'المستفيد / العميل' : 'Customer'}</th>
                        <th className="p-2.5 text-start w-40">{isAr ? 'الوكيل' : 'Agent'}</th>
                        <th className="p-2.5 text-start w-52">{isAr ? 'القالب المخصص (Template)' : 'Template'}</th>
                        <th className="p-2.5 w-36 text-center">{isAr ? 'نوع المبيع / الدفع' : 'Payment Type'}</th>
                        <th className="p-2.5 w-36 text-end">{isAr ? 'سعر البيع' : 'Sale Price'}</th>
                        <th className="p-2.5 w-36 text-end">{isAr ? 'صافي الربح' : 'Profit'}</th>
                        <th className="p-2.5 w-12 text-center" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {(design.customers || []).map((c, idx) => {
                        const assignedTpl = (design.templates || []).find((t) => t.id === c.templateId);
                        const seatCost = assignedTpl
                          ? computeTemplateTotals(assignedTpl).costPerSeat
                          : totals.costPerSeat;
                        const profit = (Number(c.sale) || 0) - seatCost;

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
                                onChange={(val) => handlePatchCustomer(c.id, { name: val || '' })}
                                options={customerOptions}
                                placeholder={isAr ? 'اختر العميل أو اكتب اسماً...' : 'Customer...'}
                                allowCustomValue
                              />
                            </td>
                            <td className="p-2.5">
                              <input
                                value={c.agent || ''}
                                onChange={(e) => handlePatchCustomer(c.id, { agent: e.target.value })}
                                placeholder={isAr ? 'اسم الوكيل' : 'Agent'}
                                className="w-full h-[46px] px-3 rounded-[11px] border border-[#E5E7EB] bg-white text-[12px] font-bold outline-none hover:border-slate-300 focus:border-2 focus:border-[#F45A0A] transition-all"
                              />
                            </td>
                            <td className="p-2.5">
                              <SearchableCombobox
                                value={c.templateId}
                                onChange={(val) => {
                                  const tpl = (design.templates || []).find((t) => t.id === val);
                                  handlePatchCustomer(c.id, {
                                    templateId: val,
                                    templateName: tpl?.name,
                                    sale: tpl ? Number(tpl.seatPrice) || 0 : c.sale,
                                  });
                                }}
                                options={templateComboboxOptions}
                                placeholder={isAr ? 'اختر القالب...' : 'Template...'}
                              />
                            </td>
                            <td className="p-2.5">
                              <SearchableCombobox
                                value={c.payType}
                                onChange={(val) => handlePatchCustomer(c.id, { payType: (val as 'CASH' | 'CREDIT') || 'CASH' })}
                                options={[
                                  { value: 'CASH', label: isAr ? 'نقدي (Cash)' : 'Cash' },
                                  { value: 'CREDIT', label: isAr ? 'آجل (Credit)' : 'Credit' },
                                ]}
                                placeholder={isAr ? 'الدفع...' : 'Payment...'}
                              />
                            </td>
                            <td className="p-2.5">
                              <input
                                value={c.sale ? c.sale.toLocaleString('en-US') : ''}
                                onChange={(e) => handlePatchCustomer(c.id, { sale: numeric(e.target.value) })}
                                dir="ltr"
                                placeholder="0"
                                className="w-full h-[46px] px-3 rounded-[11px] border border-[#E5E7EB] bg-white text-[13px] font-mono font-black text-end text-slate-900 outline-none hover:border-slate-300 focus:border-2 focus:border-[#F45A0A] transition-all"
                              />
                            </td>
                            <td className="p-2.5 text-end font-mono font-black text-[13px]" dir="ltr">
                              <span className={profit >= 0 ? 'text-[#078B61]' : 'text-rose-600'}>
                                {profit >= 0 ? '+' : ''}
                                {money(profit, design.currency)}
                              </span>
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveCustomer(c.id)}
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

      {/* ── 3. BOTTOM STICKY SUMMARY & NAVIGATION DOCK ── */}
      <div className="bg-white border-t border-[#E5E7EB] shadow-lg shrink-0">
        <div className="max-w-[1720px] mx-auto w-full px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          
          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-2.5 flex-wrap text-[11.5px]">
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1">
              <span className="text-[10px] font-bold text-slate-500 block">{isAr ? 'المقاعد المبيعة' : 'Seats Sold'}</span>
              <span className="font-mono font-black text-slate-900 text-[12.5px]" dir="ltr">
                {totals.soldSeats} / {totals.seats}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1">
              <span className="text-[10px] font-bold text-slate-500 block">{isAr ? 'متوسط كلفة المقعد' : 'Avg Seat Cost'}</span>
              <span className="font-mono font-black text-slate-900 text-[12.5px]" dir="ltr">
                {money(totals.costPerSeat, design.currency)}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1">
              <span className="text-[10px] font-bold text-slate-500 block">{isAr ? 'إجمالي المبيعات' : 'Total Sales'}</span>
              <span className="font-mono font-black text-slate-900 text-[12.5px]" dir="ltr">
                {money(totals.salesTotal || totals.sumExpectedSale, design.currency)}
              </span>
            </div>

            <div
              className={`rounded-xl px-3 py-1 border ${
                (totals.realisedProfit || totals.expectedProfit) >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
              }`}
            >
              <span className="text-[10px] font-bold text-slate-600 block flex items-center gap-1">
                <TrendingUp size={12} />
                <span>{isAr ? 'صافي الربح' : 'Net Profit'}</span>
              </span>
              <span
                className={`font-mono font-black text-[12.5px] ${
                  (totals.realisedProfit || totals.expectedProfit) >= 0 ? 'text-[#078B61]' : 'text-rose-700'
                }`}
                dir="ltr"
              >
                {(totals.realisedProfit || totals.expectedProfit) >= 0 ? '+' : ''}
                {money(totals.realisedProfit || totals.expectedProfit, design.currency)}
              </span>
            </div>
          </div>

          {/* Navigation & Action Buttons */}
          <div className="flex items-center gap-2">
            {activeTab === 2 ? (
              <button
                type="button"
                onClick={() => setActiveTab(1)}
                className="h-[42px] px-4 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer flex items-center gap-1.5 transition-colors"
              >
                {direction === 'rtl' ? <ArrowRight size={15} /> : <ArrowLeft size={15} />}
                <span>{isAr ? 'رجوع لتصميم الكروب' : 'Back to Design'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab(2)}
                className="h-[42px] px-5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-black cursor-pointer flex items-center gap-1.5 shadow-xs transition-all active:scale-[0.98]"
              >
                <span>{isAr ? 'التالي: توزيع المقاعد للمستفيدين' : 'Next: Customers & Seats'}</span>
                {direction === 'rtl' ? <ArrowLeft size={15} /> : <ArrowRight size={15} />}
              </button>
            )}

            <button
              type="button"
              disabled={saving}
              onClick={handleSaveGroup}
              className="h-[42px] px-6 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] disabled:opacity-60 text-white text-xs font-black cursor-pointer flex items-center gap-1.5 shadow-xs transition-all active:scale-[0.98]"
            >
              {saving ? <Loader size={15} color="white" /> : <Save size={16} />}
              <span>{isAr ? 'حفظ الكروب' : 'Save Group'}</span>
            </button>
          </div>

        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          4. PRICES TEMPLATE MODAL (قالب الأسعار - الصورة 2 و 4)
         ══════════════════════════════════════════════════════════════ */}
      <Modal
        opened={templateModalOpen}
        onClose={() => {
          setTemplateModalOpen(false);
          setEditingTemplate(null);
        }}
        size="90%"
        centered
        radius="2xl"
        withCloseButton={false}
        overlayProps={{ backgroundOpacity: 0.45, blur: 3 }}
        styles={{ body: { padding: 0 } }}
      >
        {editingTemplate && (
          <PricesTemplateModalContent
            template={editingTemplate}
            groupCurrency={design.currency}
            isAr={isAr}
            direction={direction}
            onSave={(updated) => handleSaveTemplateChanges(updated)}
            onOpenSale={(updated) => {
              handleSaveTemplateChanges(updated);
              handleAddCustomer(updated.id);
              setActiveTab(2);
            }}
            onClose={() => {
              setTemplateModalOpen(false);
              setEditingTemplate(null);
            }}
            onOpenAccountFinder={(componentId) => setFinder({ open: true, componentId })}
          />
        )}
      </Modal>

      {/* Account Finder Modal */}
      <AccountFinderModal
        opened={finder.open}
        initialScope="SUPPLIER"
        onClose={() => setFinder({ open: false })}
        onSelect={(account: AccountFinderResult) => {
          if (finder.componentId && editingTemplate) {
            const updatedComponents = (editingTemplate.components || []).map((c) =>
              c.id === finder.componentId
                ? { ...c, supplierName: account.name, supplierAccountId: account.id }
                : c,
            );
            setEditingTemplate({ ...editingTemplate, components: updatedComponents });
          }
        }}
      />
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// PRICES TEMPLATE EDITOR MODAL COMPONENT (قالب الأسعار - الصورة 2 و 4)
// ══════════════════════════════════════════════════════════════
interface TemplateModalProps {
  template: GroupTemplate;
  groupCurrency: 'IQD' | 'USD';
  isAr: boolean;
  direction: 'rtl' | 'ltr';
  onSave: (tpl: GroupTemplate) => void;
  onOpenSale: (tpl: GroupTemplate) => void;
  onClose: () => void;
  onOpenAccountFinder: (componentId: string) => void;
}

const PricesTemplateModalContent: React.FC<TemplateModalProps> = ({
  template: initialTemplate,
  groupCurrency,
  isAr,
  direction,
  onSave,
  onOpenSale,
  onClose,
  onOpenAccountFinder,
}) => {
  const [tpl, setTpl] = useState<GroupTemplate>(initialTemplate);
  const [tab, setTab] = useState<'AUTO' | 'GLOBAL' | 'EXPENSES'>('AUTO');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterSupplier, setFilterSupplier] = useState<string>('');

  const patchTpl = (changes: Partial<GroupTemplate>) => setTpl((t) => ({ ...t, ...changes }));

  const addComponent = (kind: GroupComponentKind) => {
    const newComp: GroupComponent = {
      id: `cmp-${Date.now()}-${(tpl.components || []).length}`,
      kind,
      supplierName: '',
      cost: 0,
      perSeat: kind !== 'EXPENSE' && tab === 'AUTO',
    };
    patchTpl({ components: [...(tpl.components || []), newComp] });
  };

  const patchComponent = (id: string, changes: Partial<GroupComponent>) => {
    patchTpl({
      components: (tpl.components || []).map((c) => (c.id === id ? { ...c, ...changes } : c)),
    });
  };

  const removeComponent = (id: string) => {
    patchTpl({
      components: (tpl.components || []).filter((c) => c.id !== id),
    });
  };

  const tplTotals = useMemo(() => computeTemplateTotals(tpl), [tpl]);

  // Components filtered by active tab
  const tabComponents = useMemo(() => {
    return (tpl.components || []).filter((c) => {
      if (tab === 'EXPENSES') return c.kind === 'EXPENSE';
      if (tab === 'GLOBAL') return c.kind !== 'EXPENSE' && !c.perSeat;
      // tab === 'AUTO'
      return c.kind !== 'EXPENSE' && c.perSeat;
    });
  }, [tpl.components, tab]);

  return (
    <div className="flex flex-col h-[85vh] bg-[#F8FAFC] font-sans" dir={direction}>
      
      {/* ── Top Bar (Image 2: Template Name, Seats, Currency, Price Sale, Open Sale) ── */}
      <div className="bg-white border-b border-[#E5E7EB] p-4 shadow-2xs shrink-0">
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200 text-[#F45A0A] flex items-center justify-center">
              <Palette size={17} />
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-900 leading-tight">
                {isAr ? 'قالب الأسعار والمشتريات (Prices Template)' : 'Prices Template Designer'}
              </h3>
              <span className="text-[11px] font-bold text-slate-400 font-mono">{tpl.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Green Open Sale Button (Image 2: Open Sale) */}
            <button
              type="button"
              onClick={() => onOpenSale(tpl)}
              className="h-[38px] px-4 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-[12px] font-black cursor-pointer flex items-center gap-1.5 shadow-xs transition-all active:scale-[0.98]"
            >
              <ShoppingCart size={15} />
              <span>{isAr ? 'فتح البيع للعملاء (Open Sale)' : 'Open Sale'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 flex items-center justify-center cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Inputs Row (Image 2) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 items-end">
          {/* Template Name */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">
              {isAr ? 'اسم القالب (Template Name)' : 'Template Name'}
            </label>
            <input
              value={tpl.name}
              onChange={(e) => patchTpl({ name: e.target.value })}
              className="w-full h-[46px] px-3.5 rounded-[11px] border border-[#E5E7EB] bg-white text-[12.5px] font-bold text-slate-900 outline-none hover:border-slate-300 focus:border-2 focus:border-[#F45A0A] transition-all"
            />
          </div>

          {/* Seats* */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">
              {isAr ? 'عدد المقاعد (Seats*)' : 'Seats*'}
            </label>
            <input
              value={tpl.seats}
              onChange={(e) => patchTpl({ seats: Math.max(1, Math.round(numeric(e.target.value))) })}
              dir="ltr"
              className="w-full h-[46px] px-3.5 rounded-[11px] border border-[#E5E7EB] bg-white text-[13px] font-mono font-black text-center text-slate-900 outline-none hover:border-slate-300 focus:border-2 focus:border-[#F45A0A] transition-all"
            />
          </div>

          {/* Currency (SearchableCombobox) */}
          <div>
            <SearchableCombobox
              label={isAr ? 'العملة (Currency)' : 'Currency'}
              value={tpl.currency}
              onChange={(val) => patchTpl({ currency: (val as 'IQD' | 'USD') || groupCurrency })}
              options={[
                { value: 'USD', label: isAr ? '$ دولار أمريكي (USD)' : '$ US Dollar (USD)' },
                { value: 'IQD', label: isAr ? 'د.ع دينار عراقي (IQD)' : 'IQD Iraqi Dinar' },
              ]}
              placeholder={isAr ? 'العملة...' : 'Currency...'}
            />
          </div>

          {/* Price Sale (Image 2) */}
          <div>
            <label className="text-[11px] font-bold text-[#F45A0A] block mb-1">
              {isAr ? 'سعر البيع المقترح (Price Sale)' : 'Price Sale'}
            </label>
            <input
              value={tpl.seatPrice ? tpl.seatPrice.toLocaleString('en-US') : ''}
              onChange={(e) => patchTpl({ seatPrice: numeric(e.target.value) })}
              placeholder="0.00"
              dir="ltr"
              className="w-full h-[46px] px-3.5 rounded-[11px] border border-orange-300 bg-white text-[13.5px] font-mono font-black text-end text-slate-900 outline-none hover:border-orange-400 focus:border-2 focus:border-[#F45A0A] transition-all"
            />
          </div>
        </div>
      </div>

      {/* ── 3 Tabs (Image 2: Auto Purchases, Global Purchases, Global Expenses) ── */}
      <div className="bg-white border-b border-[#E5E7EB] px-4 pt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTab('AUTO')}
          className={`px-4 py-2 text-[12px] font-black border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            tab === 'AUTO'
              ? 'border-[#F45A0A] text-[#F45A0A]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Ticket size={14} />
          <span>{isAr ? 'المشتريات التلقائية للمقعد (Auto Purchases)' : 'Auto Purchases'}</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('GLOBAL')}
          className={`px-4 py-2 text-[12px] font-black border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            tab === 'GLOBAL'
              ? 'border-[#F45A0A] text-[#F45A0A]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Package size={14} />
          <span>{isAr ? 'المشتريات العامة الشاملة (Global Purchases)' : 'Global Purchases'}</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('EXPENSES')}
          className={`px-4 py-2 text-[12px] font-black border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            tab === 'EXPENSES'
              ? 'border-[#F45A0A] text-[#F45A0A]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Coins size={14} />
          <span>{isAr ? 'المصاريف العامة (Global Expenses)' : 'Global Expenses'}</span>
        </button>
      </div>

      {/* ── Components List & Filter Bar ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        
        {/* Actions Bar with Kind Selector Dropdown */}
        <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-xl border border-[#E5E7EB] flex-wrap">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
            <span>{isAr ? 'عناصر هذا القسم:' : 'Items:'}</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 font-mono">
              {tabComponents.length}
            </span>
          </div>

          {/* Yellow (+) Button Menu as in Image 2 & 4 */}
          <Menu position="bottom-end" shadow="lg" radius="xl" width={220} withinPortal zIndex={10080}>
            <Menu.Target>
              <button
                type="button"
                className="h-[36px] px-3.5 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white text-[12px] font-black cursor-pointer flex items-center gap-1.5 shadow-xs transition-all"
              >
                <Plus size={15} strokeWidth={2.4} />
                <span>{isAr ? 'إضافة مكوّن جديد (+)' : 'Add Component (+)'}</span>
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

        {/* Components Rows */}
        {tabComponents.length === 0 ? (
          <div className="py-12 text-center rounded-xl border border-dashed border-slate-200 bg-white">
            <Package size={30} className="mx-auto text-slate-300 mb-2" />
            <p className="text-[12.5px] font-bold text-slate-600">
              {isAr ? 'لا توجد عناصر مضافة في هذا التبويب' : 'No items added in this tab yet'}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {isAr
                ? 'اضغط على «إضافة مكوّن جديد (+)» لإضافة تذكرة، فندق، فيزا، أو نقل'
                : 'Click "Add Component (+)" to add tickets, hotels, visas, or transports'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {tabComponents.map((c) => {
              const Icon = KIND_ICON[c.kind];
              const tone = KIND_TONE[c.kind];
              return (
                <div
                  key={c.id}
                  className="grid grid-cols-[auto_minmax(0,1.5fr)_minmax(0,1fr)_auto_auto] items-center gap-2.5 p-3 rounded-xl border border-[#E5E7EB] bg-white hover:border-slate-300 transition-all shadow-2xs"
                >
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${tone.bg} ${tone.border} ${tone.text}`}>
                    <Icon size={17} />
                  </div>

                  {/* Supplier & Account Finder */}
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
                      <button
                        type="button"
                        onClick={() => onOpenAccountFinder(c.id)}
                        className="h-8 w-8 rounded-lg border border-orange-200 bg-orange-50 text-[#F45A0A] hover:bg-orange-100 flex items-center justify-center cursor-pointer shrink-0 transition-colors"
                        title={isAr ? 'بحث في الحسابات' : 'Search accounts'}
                      >
                        <Search size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Cost Input */}
                  <div>
                    <span className="text-[10px] font-black text-slate-500 block mb-0.5">
                      {isAr ? `الكلفة (${tpl.currency})` : `Cost (${tpl.currency})`}
                    </span>
                    <input
                      value={c.cost ? c.cost.toLocaleString('en-US') : ''}
                      onChange={(e) => patchComponent(c.id, { cost: numeric(e.target.value) })}
                      placeholder="0"
                      dir="ltr"
                      className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[12.5px] font-mono font-black text-slate-900 text-end outline-none focus:border-[#F45A0A]"
                    />
                  </div>

                  {/* Scope Toggle: per seat vs whole group */}
                  <button
                    type="button"
                    onClick={() => patchComponent(c.id, { perSeat: !c.perSeat })}
                    className={`h-8 px-2.5 rounded-lg border text-[11px] font-black cursor-pointer whitespace-nowrap transition-colors ${
                      c.perSeat
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-800'
                        : 'bg-amber-50 border-amber-200 text-amber-800'
                    }`}
                  >
                    {c.perSeat ? (isAr ? 'للمقعد' : 'Per seat') : isAr ? 'للكروب كامل' : 'Whole group'}
                  </button>

                  {/* Delete */}
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
      </div>

      {/* ── Bottom Summary Row (Image 2: Buy, Global Buy, Expenses, Cost, Sale) ── */}
      <div className="bg-white border-t border-[#E5E7EB] p-3 shadow-md shrink-0">
        <div className="flex items-center justify-between gap-3 flex-wrap text-xs">
          
          <div className="flex items-center gap-3 font-mono font-bold flex-wrap" dir="ltr">
            <span className="text-slate-600">
              <span className="font-sans text-slate-400 font-semibold">{isAr ? 'مشتريات المقاعد: ' : 'Buy: '}</span>
              {money(tplTotals.autoBuy, tpl.currency)}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-600">
              <span className="font-sans text-slate-400 font-semibold">{isAr ? 'شاملة: ' : 'Global Buy: '}</span>
              {money(tplTotals.globalBuy, tpl.currency)}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-600">
              <span className="font-sans text-slate-400 font-semibold">{isAr ? 'مصاريف: ' : 'Expenses: '}</span>
              {money(tplTotals.globalExpenses, tpl.currency)}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-900 font-black">
              <span className="font-sans text-slate-500">{isAr ? 'الكلفة الكلية: ' : 'Cost: '}</span>
              {money(tplTotals.totalCost, tpl.currency)}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-900 font-black">
              <span className="font-sans text-slate-500">{isAr ? 'المبيعات: ' : 'Sale: '}</span>
              {money(tplTotals.totalSale, tpl.currency)}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-[#078B61] font-black">
              <span className="font-sans text-emerald-800">{isAr ? 'صافي الربح: ' : 'Profit: '}</span>
              +{money(tplTotals.totalProfit, tpl.currency)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-[36px] px-4 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => onSave(tpl)}
              className="h-[36px] px-5 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white text-xs font-black cursor-pointer shadow-xs transition-all"
            >
              {isAr ? 'حفظ تعديلات القالب' : 'Save Template'}
            </button>
          </div>

        </div>
      </div>

    </div>
  );
};

export default GroupDesignWorkspace;
