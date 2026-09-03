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
  Plane,
  Briefcase,
  Percent,
  MapPin,
  CalendarRange,
  Info,
} from 'lucide-react';
import { SearchableCombobox, type ComboboxOption } from '../ui/SearchableCombobox';
import { SegmentedDatePicker } from '../ui/SegmentedDatePicker';
import { AccountFinderModal, type AccountFinderResult } from '../common/AccountFinderModal';
import { ticketsApi, type TicketData } from '../../api/tickets';
import { partnersApi } from '../../api/partners';
import { accountsApi } from '../../api/accounts';
import { useAuthStore } from '../../store/useAuthStore';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { useLanguageStore } from '../../store/useLanguageStore';
import { allocateDocumentNumber } from '../../utils/sequenceUtils';
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

  const { user } = useAuthStore();
  const currentUserName = user?.name || (isAr ? 'الموظف الحالي' : 'Current User');

  // 1: معلومات الكروب (Group Info)
  // 2: مشتريات وتكاليف الخدمات (Purchases & Services Costs)
  // 3: المستفيدين وتوزيع المقاعد (Passengers & Seat Allocation)
  // 4: تسعير المقاعد والمبيعات (Seat Pricing & Sales)
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);
  const [design, setDesign] = useState<GroupDesign>(emptyDesign());
  const [saving, setSaving] = useState(false);
  const [customersList, setCustomersList] = useState<any[]>([]);
  const [suppliersList, setSuppliersList] = useState<any[]>([]);

  // Active Template & Purchases Tab for Inline Workspace
  const [activeTemplateId, setActiveTemplateId] = useState<string>('');
  const [purchasesTab, setPurchasesTab] = useState<'AUTO' | 'GLOBAL' | 'EXPENSES'>('AUTO');

  // Prices Template Editor Modal State
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<GroupTemplate | null>(null);

  // Sale CustomGroup Modal State (Image 2)
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<GroupCustomer | null>(null);
  const [selectedTemplateForSale, setSelectedTemplateForSale] = useState<string>('');

  // Cashboxes List
  const [cashboxOptions, setCashboxOptions] = useState<ComboboxOption[]>([
    { value: 'صندوق الشركات والقاصة', label: isAr ? 'صندوق الشركات والقاصة' : 'Box Cash' },
    { value: 'القاصة الرئيسية', label: isAr ? 'القاصة الرئيسية' : 'Main Cash' },
    { value: 'صندوق الفرع', label: isAr ? 'صندوق الفرع' : 'Branch Cash' },
  ]);

  // Account Finder Modal State
  const [finder, setFinder] = useState<{ open: boolean; onSelectCallback?: (acc: AccountFinderResult) => void }>({
    open: false,
  });

  useEffect(() => {
    if (!opened) return;
    setActiveStep(1);
    const loaded = designFromTicket(initialData);
    setDesign(loaded);
    if (loaded.templates && loaded.templates.length > 0) {
      setActiveTemplateId(loaded.templates[0].id);
    }
    partnersApi
      .getCustomers()
      .then((d: any) => setCustomersList(Array.isArray(d) ? d : d?.data || []))
      .catch(() => undefined);

    partnersApi
      .getSuppliers()
      .then((d: any) => setSuppliersList(Array.isArray(d) ? d : d?.data || []))
      .catch(() => undefined);

    accountsApi
      .getTree(true)
      .then((tree) => {
        if (Array.isArray(tree)) {
          const findAccounts = (nodes: any[]): ComboboxOption[] => {
            let accs: ComboboxOption[] = [];
            for (const n of nodes) {
              if (
                n.type === 'CASH' ||
                n.category === 'CASH' ||
                n.category === 'BANK' ||
                (n.code && String(n.code).startsWith('18'))
              ) {
                accs.push({
                  value: n.nameAr || n.name || n.id,
                  label: n.nameAr || n.name || String(n.code || ''),
                });
              }
              if (n.children && n.children.length > 0) {
                accs = accs.concat(findAccounts(n.children));
              }
            }
            return accs;
          };
          const found = findAccounts(tree);
          if (found.length > 0) setCashboxOptions(found);
        }
      })
      .catch(() => undefined);
  }, [opened, initialData]);

  const patch = (changes: Partial<GroupDesign>) => setDesign((d) => ({ ...d, ...changes }));

  const supplierOptions: ComboboxOption[] = useMemo(() => {
    return suppliersList.map((s) => ({
      value: s.accountId || s.account?.id || s.id,
      label: s.nameAr || s.nameEn || s.id,
      subtitle: s.code || undefined,
    }));
  }, [suppliersList]);

  // Trip Duration (Days & Nights)
  const tripDuration = useMemo(() => {
    if (!design.travelDate || !design.returnDate) return null;
    const start = new Date(design.travelDate);
    const end = new Date(design.returnDate);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return null;
    const nights = Math.max(0, diffDays - 1);
    return {
      days: diffDays,
      nights,
      labelAr: `${diffDays} أيام / ${nights} ليالٍ`,
      labelEn: `${diffDays} Days / ${nights} Nights`,
    };
  }, [design.travelDate, design.returnDate]);

  // Smart Auto-generate group name
  const handleAutoGenerateGroupName = () => {
    const from = design.routeFrom?.trim() || 'BGW';
    const to = design.routeTo?.trim() || (design.country?.trim() || 'DEST');
    const datePart = design.travelDate ? design.travelDate.replace(/-/g, '/') : new Date().toISOString().slice(0, 10).replace(/-/g, '/');
    const generated = `${from}-${to} (${datePart})`;
    patch({ groupName: generated });
  };

  // Sync Ready Package total buy cost to first template as a global group purchase
  const handleSyncPackageCost = (totalCost: number, supName?: string, supAccId?: string) => {
    const seats = Math.max(1, design.seats || 1);
    const costPerSeat = Math.round((totalCost / seats) * 100) / 100;

    patch({
      packageTotalCost: totalCost,
      packageCostPerSeat: costPerSeat,
      supplierName: supName !== undefined ? supName : design.supplierName,
      supplierAccountId: supAccId !== undefined ? supAccId : design.supplierAccountId,
      templates: (design.templates || []).map((t, idx) => {
        if (idx === 0) {
          const existingPkgIdx = (t.components || []).findIndex((c) => c.kind === 'PACKAGE');
          let newComps = [...(t.components || [])];
          if (existingPkgIdx >= 0) {
            newComps[existingPkgIdx] = {
              ...newComps[existingPkgIdx],
              cost: totalCost,
              perSeat: false, // مشتريات عامة شاملة للكروب بالكامل
              supplierName: (supName !== undefined ? supName : design.supplierName) || newComps[existingPkgIdx].supplierName,
              supplierAccountId: (supAccId !== undefined ? supAccId : design.supplierAccountId) || newComps[existingPkgIdx].supplierAccountId,
            };
          } else if (totalCost > 0) {
            newComps.unshift({
              id: `comp-pkg-${Date.now()}`,
              kind: 'PACKAGE',
              supplierName: (supName !== undefined ? supName : design.supplierName) || 'المورد السياحي',
              supplierAccountId: supAccId !== undefined ? supAccId : design.supplierAccountId,
              cost: totalCost,
              perSeat: false, // مشتريات عامة شاملة للكروب بالكامل
              currency: design.currency,
              active: true,
            });
          }
          return {
            ...t,
            components: newComps,
          };
        }
        return t;
      }),
    });
  };

  // Apply batch price to all customers assigned to a template/package
  const handleApplyBatchPrice = (templateId: string, price: number) => {
    setDesign((prev) => ({
      ...prev,
      templates: (prev.templates || []).map((t) => (t.id === templateId ? { ...t, seatPrice: price } : t)),
      customers: (prev.customers || []).map((c) =>
        c.templateId === templateId ? { ...c, sale: price } : c
      ),
    }));
  };

  // Open Sale Modal (Image 2)
  const handleOpenSaleModal = (templateId?: string, customer?: GroupCustomer) => {
    const tpl = (design.templates || []).find((t) => t.id === templateId) || (design.templates || [])[0];
    setSelectedTemplateForSale(tpl?.id || '');
    if (customer) {
      setEditingCustomer({ ...customer });
    } else {
      setEditingCustomer({
        id: `cus-${Date.now()}-${(design.customers || []).length}`,
        name: '',
        agent: '',
        templateId: tpl?.id,
        templateName: tpl?.name,
        payType: 'CASH',
        sale: tpl ? Number(tpl.seatPrice) || 0 : Number(design.seatPrice) || 0,
        boxCash: cashboxOptions[0]?.value || 'صندوق الشركات والقاصة',
        date: new Date().toISOString().slice(0, 10),
        state: 'MR',
        passport: '',
        voucher: '',
        fCode: '',
        notes: '',
      });
    }
    setSaleModalOpen(true);
  };

  const handleSaveCustomerFromModal = (savedCustomer: GroupCustomer) => {
    const exists = (design.customers || []).some((c) => c.id === savedCustomer.id);
    if (exists) {
      setDesign((d) => ({
        ...d,
        customers: (d.customers || []).map((c) => (c.id === savedCustomer.id ? savedCustomer : c)),
      }));
    } else {
      setDesign((d) => ({
        ...d,
        customers: [...(d.customers || []), savedCustomer],
      }));
    }
    setSaleModalOpen(false);
    setEditingCustomer(null);
    setActiveStep(3);
  };

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
  const currentActiveTemplate = useMemo(() => {
    const list = design.templates || [];
    return list.find((t) => t.id === activeTemplateId) || list[0];
  }, [design.templates, activeTemplateId]);

  const patchActiveTemplate = (changes: Partial<GroupTemplate>) => {
    if (!currentActiveTemplate) return;
    setDesign((d) => ({
      ...d,
      templates: (d.templates || []).map((t) =>
        t.id === currentActiveTemplate.id ? { ...t, ...changes } : t,
      ),
    }));
  };

  const addComponentToActiveTemplate = (kind: GroupComponentKind) => {
    if (!currentActiveTemplate) return;
    const newComp: GroupComponent = {
      id: `cmp-${Date.now()}-${(currentActiveTemplate.components || []).length}`,
      kind,
      supplierName: '',
      cost: 0,
      issueDate: new Date().toISOString().slice(0, 10),
      currency: currentActiveTemplate.currency,
      perSeat: kind !== 'EXPENSE' && purchasesTab === 'AUTO',
      active: true,
    };
    patchActiveTemplate({
      components: [...(currentActiveTemplate.components || []), newComp],
    });
  };

  const patchComponentInActiveTemplate = (componentId: string, changes: Partial<GroupComponent>) => {
    if (!currentActiveTemplate) return;
    patchActiveTemplate({
      components: (currentActiveTemplate.components || []).map((c) =>
        c.id === componentId ? { ...c, ...changes } : c,
      ),
    });
  };

  const removeComponentFromActiveTemplate = (componentId: string) => {
    if (!currentActiveTemplate) return;
    patchActiveTemplate({
      components: (currentActiveTemplate.components || []).filter((c) => c.id !== componentId),
    });
  };

  const activeTabComponents = useMemo(() => {
    if (!currentActiveTemplate) return [];
    return (currentActiveTemplate.components || []).filter((c) => {
      if (purchasesTab === 'EXPENSES') return c.kind === 'EXPENSE';
      if (purchasesTab === 'GLOBAL') return c.kind !== 'EXPENSE' && !c.perSeat;
      // purchasesTab === 'AUTO'
      return c.kind !== 'EXPENSE' && c.perSeat;
    });
  }, [currentActiveTemplate, purchasesTab]);

  const activeTemplateTotals = useMemo(() => {
    if (!currentActiveTemplate) {
      return {
        seats: 0,
        autoBuy: 0,
        globalBuy: 0,
        globalExpenses: 0,
        costPerSeat: 0,
        seatPrice: 0,
        totalCost: 0,
        totalSale: 0,
        totalProfit: 0,
      };
    }
    return computeTemplateTotals(currentActiveTemplate);
  }, [currentActiveTemplate]);

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
    setActiveTemplateId(newTpl.id);
  };

  const handleEditTemplate = (tpl: GroupTemplate) => {
    setActiveTemplateId(tpl.id);
    setEditingTemplate({ ...tpl, components: [...(tpl.components || [])] });
    setTemplateModalOpen(true);
  };

  const handleSaveTemplateChanges = (updatedTpl: GroupTemplate) => {
    setDesign((d) => ({
      ...d,
      templates: (d.templates || []).map((t) => (t.id === updatedTpl.id ? updatedTpl : t)),
    }));
    setActiveTemplateId(updatedTpl.id);
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
    const remaining = (design.templates || []).filter((t) => t.id !== tplId);
    setDesign((d) => ({
      ...d,
      templates: remaining,
    }));
    if (activeTemplateId === tplId) {
      setActiveTemplateId(remaining[0]?.id || '');
    }
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
      setActiveStep(1);
      return;
    }

    setSaving(true);
    try {
      const route = [design.routeFrom, design.routeTo].filter(Boolean).join(' - ');
      const payload: any = {
        invoiceNumber: (initialData as any)?.invoiceNumber || (await allocateDocumentNumber('groups')),
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
                  ? isAr ? 'تعديل الكروب السياحي' : 'Edit Tour Group'
                  : isAr ? 'تصميم وإدارة الكروب السياحي' : 'Tour Group Workspace'}
              </h2>
              {design.groupName && (
                <p className="text-[11px] font-bold text-[#F45A0A] mt-0.5 font-mono">
                  {design.groupName}
                </p>
              )}
            </div>
          </div>

          {/* Stepper Wizard Bar (4 Steps: Group Info -> Purchases & Costs -> Passengers & Seats -> Pricing & Sales) */}
          <div className="flex items-center gap-1.5 bg-[#F1F5F9] p-1 rounded-2xl border border-slate-200">
            {/* Step 1 */}
            <button
              type="button"
              onClick={() => setActiveStep(1)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[12px] font-black transition-all cursor-pointer ${
                activeStep === 1
                  ? 'bg-[#F45A0A] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black ${
                  activeStep === 1 ? 'bg-white text-[#F45A0A]' : 'bg-slate-200 text-slate-700'
                }`}
              >
                1
              </span>
              <span>{isAr ? 'معلومات الكروب' : 'Group Info'}</span>
            </button>

            {/* Step 2 */}
            <button
              type="button"
              onClick={() => setActiveStep(2)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[12px] font-black transition-all cursor-pointer ${
                activeStep === 2
                  ? 'bg-[#F45A0A] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black ${
                  activeStep === 2 ? 'bg-white text-[#F45A0A]' : 'bg-slate-200 text-slate-700'
                }`}
              >
                2
              </span>
              <span>{isAr ? 'مشتريات وتكاليف الخدمات' : 'Purchases & Costs'}</span>
            </button>

            {/* Step 3 */}
            <button
              type="button"
              onClick={() => setActiveStep(3)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[12px] font-black transition-all cursor-pointer ${
                activeStep === 3
                  ? 'bg-[#F45A0A] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black ${
                  activeStep === 3 ? 'bg-white text-[#F45A0A]' : 'bg-slate-200 text-slate-700'
                }`}
              >
                3
              </span>
              <span>{isAr ? 'المستفيدين وتوزيع المقاعد' : 'Passengers & Seats'}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10.5px] font-mono font-bold bg-white/20">
                {(design.customers || []).length}
              </span>
            </button>

            {/* Step 4 */}
            <button
              type="button"
              onClick={() => setActiveStep(4)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[12px] font-black transition-all cursor-pointer ${
                activeStep === 4
                  ? 'bg-[#F45A0A] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black ${
                  activeStep === 4 ? 'bg-white text-[#F45A0A]' : 'bg-slate-200 text-slate-700'
                }`}
              >
                4
              </span>
              <span>{isAr ? 'تسعير المقاعد والمبيعات' : 'Seat Pricing & Sales'}</span>
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
          
          {activeStep === 1 ? (
            /* ══════════════════════════════════════════════════════════════
               STEP 1: GROUP GENERAL INFORMATION (معلومات وهوية الكروب)
               ══════════════════════════════════════════════════════════════ */
            /* ══════════════════════════════════════════════════════════════
               STEP 1: SMART GROUP SOURCING & IDENTITY (معلومات وهوية الكروب)
               ══════════════════════════════════════════════════════════════ */
            <div className="space-y-4">
              
              {/* Card 1: Sourcing Model Selector (جاهز من مورد أو مجمع أو طيران) */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-[#FFF3E8] border border-[#FED7AA] text-[#F45A0A] flex items-center justify-center">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <span className="font-black text-[14px] text-slate-900 block leading-tight">
                        {isAr ? 'نموذج الكروب ومصدر التجهيز الذكي' : 'Group Sourcing & Operational Model'}
                      </span>
                      <span className="text-[11.5px] text-slate-500 font-medium block mt-0.5">
                        {isAr ? 'اختر طريقة تجهيز الكروب: باكج جاهز من مورد، أو تجميع مخصص، أو مقاعد طيران فقط' : 'Select how this group is sourced: Ready package, custom assembled, or seat block'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3 Interactive Sourcing Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {/* Card 1: Ready Package */}
                  <div
                    onClick={() => {
                      patch({ sourcingType: 'READY_PACKAGE', groupType: 'PACKAGE' });
                      if (!design.templates || design.templates.length === 0) {
                        patch({ templates: [createDefaultTemplate(design.seats, design.currency, design.seatPrice)] });
                      }
                    }}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      (design.sourcingType || 'READY_PACKAGE') === 'READY_PACKAGE'
                        ? 'bg-orange-50/40 border-[#F45A0A] shadow-xs ring-2 ring-orange-500/15'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/40'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        (design.sourcingType || 'READY_PACKAGE') === 'READY_PACKAGE'
                          ? 'bg-[#F45A0A] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        <Package size={20} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-[13.5px] text-slate-900 block truncate">
                            {isAr ? 'باكج كامل جاهز من مورد' : 'Ready All-Inclusive Package'}
                          </span>
                          {(design.sourcingType || 'READY_PACKAGE') === 'READY_PACKAGE' && (
                            <CheckCircle2 size={15} className="text-[#F45A0A] shrink-0" />
                          )}
                        </div>
                        <p className="text-[11.5px] text-slate-500 font-medium mt-1 leading-relaxed">
                          {isAr
                            ? 'برنامج متكامل (طيران + فندق + خدمات) تم شراؤه كحزمة واحدة من شركة موردة أو منظم رحلات بسعر مقعد محدد'
                            : 'Full tour package bought ready from a tour operator or wholesaler with fixed seat cost'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Custom Assembled Group */}
                  <div
                    onClick={() => {
                      patch({ sourcingType: 'CUSTOM_ASSEMBLED', groupType: 'FULL' });
                    }}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      design.sourcingType === 'CUSTOM_ASSEMBLED'
                        ? 'bg-orange-50/40 border-[#F45A0A] shadow-xs ring-2 ring-orange-500/15'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/40'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        design.sourcingType === 'CUSTOM_ASSEMBLED'
                          ? 'bg-[#F45A0A] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        <Layers size={20} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-[13.5px] text-slate-900 block truncate">
                            {isAr ? 'كروب مجمّع ومفصّل' : 'Custom Assembled Group'}
                          </span>
                          {design.sourcingType === 'CUSTOM_ASSEMBLED' && (
                            <CheckCircle2 size={15} className="text-[#F45A0A] shrink-0" />
                          )}
                        </div>
                        <p className="text-[11.5px] text-slate-500 font-medium mt-1 leading-relaxed">
                          {isAr
                            ? 'تجميع تذاكر الطيران، الفنادق، الفيزا، والنقل من عدة مصادر وموردين محلياً وتحديد كلفة كل مكوّن'
                            : 'Assemble flights, hotels, visas, and transfers from multiple vendors with itemized cost tracking'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Flight Seats Block Only */}
                  <div
                    onClick={() => {
                      patch({ sourcingType: 'FLIGHT_ONLY', groupType: 'FLIGHT' });
                    }}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      design.sourcingType === 'FLIGHT_ONLY'
                        ? 'bg-orange-50/40 border-[#F45A0A] shadow-xs ring-2 ring-orange-500/15'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/40'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        design.sourcingType === 'FLIGHT_ONLY'
                          ? 'bg-[#F45A0A] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        <Plane size={20} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-[13.5px] text-slate-900 block truncate">
                            {isAr ? 'مقاعد طيران جماعية فقط' : 'Flight Seats Block Only'}
                          </span>
                          {design.sourcingType === 'FLIGHT_ONLY' && (
                            <CheckCircle2 size={15} className="text-[#F45A0A] shrink-0" />
                          )}
                        </div>
                        <p className="text-[11.5px] text-slate-500 font-medium mt-1 leading-relaxed">
                          {isAr
                            ? 'حجز مقاعد طيران جماعية (بلوك تذاكر كروب فير) مع شركة الطيران دون خدمات أو برامج أرضية'
                            : 'Group airline seats block with airline carrier without ground arrangements'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* If Ready Package: Fast Supplier & Seat Pricing Box */}
                {(design.sourcingType || 'READY_PACKAGE') === 'READY_PACKAGE' && (
                  <div className="p-4 rounded-xl bg-[#FFF8F2] border border-[#FDE3CF] space-y-3 mt-2">
                    <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-[#FED7AA]/60">
                      <span className="font-black text-[12.5px] text-[#9A3412] flex items-center gap-1.5">
                        <Briefcase size={15} className="text-[#F45A0A]" />
                        <span>{isAr ? 'تحديد المورد وسعر شراء الكروب' : 'Package Supplier & Purchase Price'}</span>
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {isAr ? 'أدخل المورد المجهز وسعر شراء الكروب فقط — يتم توزيع التكاليف في القوالب تلقائياً' : 'Enter supplier and total group buy price only'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-end">
                      {/* Supplier Selection */}
                      <div className="sm:col-span-7 lg:col-span-8">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11.5px] font-bold text-slate-700 block">
                            {isAr ? 'المورد / المنظم السياحي *' : 'Tour Supplier / Wholesaler *'}
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setFinder({
                                open: true,
                                onSelectCallback: (acc) => {
                                  handleSyncPackageCost(design.packageTotalCost || 0, acc.name, acc.id);
                                },
                              });
                            }}
                            className="text-[10.5px] text-[#F45A0A] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Search size={11} />
                            <span>{isAr ? 'بحث في شجرة الحسابات' : 'Browse Chart'}</span>
                          </button>
                        </div>
                        <SearchableCombobox
                          label=""
                          value={design.supplierAccountId || design.supplierName}
                          onChange={(val) => {
                            const found = suppliersList.find((s) => (s.accountId || s.account?.id || s.id) === val);
                            const name = found?.nameAr || found?.nameEn || val || '';
                            handleSyncPackageCost(design.packageTotalCost || 0, name, val || '');
                          }}
                          options={supplierOptions}
                          placeholder={isAr ? 'اختر المورد أو الشركة السياحية المجهزة...' : 'Select package supplier...'}
                        />
                      </div>

                      {/* Group Total Buy Price (سعر شراء الكروب فقط) */}
                      <div className="sm:col-span-5 lg:col-span-4">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11.5px] font-bold text-slate-700 block">
                            {isAr ? 'سعر شراء الكروب من المورد *' : 'Group Total Buy Price *'}
                          </label>
                          {Number(design.packageTotalCost || 0) > 0 && totals.soldSeats > 0 && (
                            <span className="text-[10px] font-mono text-emerald-700 font-bold" dir="ltr">
                              ~{money(Number(design.packageTotalCost) / totals.soldSeats, design.currency)} / seat
                            </span>
                          )}
                        </div>
                        <div className="flex items-center h-[46px] rounded-[11px] border border-[#E5E7EB] bg-white hover:border-slate-300 focus-within:border-2 focus-within:border-[#F45A0A] transition-all shadow-2xs overflow-hidden px-3.5" dir="ltr">
                          <input
                            value={design.packageTotalCost || ''}
                            onChange={(e) => {
                              const cost = numeric(e.target.value);
                              handleSyncPackageCost(cost);
                            }}
                            placeholder="0.00"
                            dir="ltr"
                            className="flex-1 w-full bg-transparent text-[14px] font-mono font-black text-slate-900 outline-none"
                          />
                          <span className="font-mono text-[11px] font-bold text-slate-400 ps-2 shrink-0 select-none" dir="ltr">
                            {design.currency}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Card 2: Trip Route, Dates, Seats & Currency */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-200 text-[#F45A0A] flex items-center justify-center">
                      <MapPin size={18} />
                    </div>
                    <div>
                      <span className="font-black text-[14px] text-slate-900 block leading-tight">
                        {isAr ? 'بيانات وهوية الرحلة والمسار' : 'Trip Route, Travel Dates & Capacity'}
                      </span>
                      <span className="text-[11.5px] text-slate-500 font-medium block mt-0.5">
                        {isAr ? 'حدد مسار الرحلة، ومواعيد الذهاب والعودة، وسعة المقاعد' : 'Specify route endpoints, travel window, and passenger capacity'}
                      </span>
                    </div>
                  </div>

                  {tripDuration && (
                    <div className="px-3 py-1 rounded-full bg-[#FFF3E8] border border-[#FED7AA] text-[#F45A0A] font-bold text-xs flex items-center gap-1.5">
                      <CalendarRange size={13} />
                      <span>{isAr ? tripDuration.labelAr : tripDuration.labelEn}</span>
                    </div>
                  )}
                </div>

                {/* Form Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Group Name + Auto-Generate */}
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11.5px] font-bold text-slate-700 block">
                        {isAr ? 'اسم الكروب أو الرحلة *' : 'Group Name *'}
                      </label>
                      <button
                        type="button"
                        onClick={handleAutoGenerateGroupName}
                        className="text-[10.5px] text-[#F45A0A] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                        title={isAr ? 'توليد اسم الكروب بناءً على المسار والتاريخ' : 'Auto generate group name from route & date'}
                      >
                        <Sparkles size={11} />
                        <span>{isAr ? 'توليد اسم تلقائي' : 'Auto Generate'}</span>
                      </button>
                    </div>
                    <input
                      value={design.groupName}
                      onChange={(e) => patch({ groupName: e.target.value })}
                      placeholder={isAr ? 'مثال: BGW-IST 18-09-2026' : 'e.g. BGW-IST 18-09-2026'}
                      className="w-full h-[46px] px-3.5 rounded-[11px] border border-[#E5E7EB] bg-white text-[13px] font-bold text-slate-900 outline-none hover:border-slate-300 focus:border-2 focus:border-[#F45A0A] transition-all shadow-2xs"
                    />
                  </div>

                  {/* Route From */}
                  <div>
                    <label className="text-[11.5px] font-bold text-slate-700 block mb-1">
                      {isAr ? 'محطة الانطلاق (من)' : 'Departure (From)'}
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
                      {isAr ? 'الوجهة (إلى)' : 'Destination (To)'}
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
                    <SegmentedDatePicker
                      label={isAr ? 'تاريخ السفر (الذهاب)' : 'Travel Date (Departure)'}
                      value={design.travelDate}
                      onChange={(d, iso) => patch({ travelDate: iso ? iso.slice(0, 10) : '' })}
                      placeholder={isAr ? 'سنة/شهر/يوم' : 'YYYY/MM/DD'}
                    />
                  </div>

                  {/* Return Date */}
                  <div>
                    <SegmentedDatePicker
                      label={isAr ? 'تاريخ العودة (اختياري)' : 'Return Date (Optional)'}
                      value={design.returnDate || ''}
                      onChange={(d, iso) => patch({ returnDate: iso ? iso.slice(0, 10) : '' })}
                      placeholder={isAr ? 'سنة/شهر/يوم' : 'YYYY/MM/DD'}
                      clearable
                    />
                  </div>

                  {/* Buy / Booking Date */}
                  <div>
                    <SegmentedDatePicker
                      label={isAr ? 'تاريخ الشراء / الحجز' : 'Booking Date'}
                      value={design.buyDate}
                      onChange={(d, iso) => patch({ buyDate: iso ? iso.slice(0, 10) : '' })}
                      placeholder={isAr ? 'سنة/شهر/يوم' : 'YYYY/MM/DD'}
                    />
                  </div>

                  {/* Destination Country */}
                  <div>
                    <SearchableCombobox
                      label={isAr ? 'الوجهة / الدولة' : 'Destination Country'}
                      value={design.country}
                      onChange={(val) => patch({ country: val || 'العراق' })}
                      options={countryOptions}
                      placeholder={isAr ? 'اختر الدولة...' : 'Select country...'}
                    />
                  </div>

                  {/* Currency */}
                  <div>
                    <SearchableCombobox
                      label={isAr ? 'العملة المعتمدة' : 'Operating Currency'}
                      value={design.currency}
                      onChange={(val) => patch({ currency: (val as 'IQD' | 'USD') || 'USD' })}
                      options={currencyOptions}
                      placeholder={isAr ? 'اختر العملة...' : 'Currency...'}
                    />
                  </div>

                  {/* Group Notes */}
                  <div className="sm:col-span-2">
                    <label className="text-[11.5px] font-bold text-slate-700 block mb-1">
                      {isAr ? 'ملاحظات وتفاصيل الكروب' : 'Group Notes & Instructions'}
                    </label>
                    <input
                      value={design.notes}
                      onChange={(e) => patch({ notes: e.target.value })}
                      placeholder={isAr ? 'أي شروط أو تفاصيل تخص برنامج الرحلة والفنادق...' : 'Any conditions or trip notes...'}
                      className="w-full h-[46px] px-3.5 rounded-[11px] border border-[#E5E7EB] bg-white text-[12.5px] font-medium text-slate-900 outline-none hover:border-slate-300 focus:border-2 focus:border-[#F45A0A] transition-all shadow-2xs"
                    />
                  </div>
                </div>
              </div>

            </div>
          ) : activeStep === 2 ? (
            /* ══════════════════════════════════════════════════════════════
               STEP 2: PURCHASES & SERVICES COSTS (مشتريات وتكاليف الخدمات)
               (تحديد التكاليف والمشتريات فقط - بدون تسعير بيع المقاعد)
               ══════════════════════════════════════════════════════════════ */
            <div className="space-y-4">
              
              {/* Card 1: Purchases & Packages Configuration */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-200 text-[#F45A0A] flex items-center justify-center">
                        <Package size={18} />
                      </div>
                      <div>
                        <span className="font-black text-[15px] text-slate-900 block leading-tight">
                          {isAr ? 'مشتريات وتكاليف خدمات الكروب' : 'Group Purchases & Costs'}
                        </span>
                        <span className="text-[11.5px] text-slate-500 font-medium block mt-0.5">
                          {isAr
                            ? 'حدد مشتريات وتكاليف الخدمات من الموردين (طيران، فنادق، فيز، نقل) - التكاليف والمشتريات فقط'
                            : 'Specify service supplier costs, airline tickets, hotels, visas, and transfers'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Package / Room Type Switcher Pills */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {(design.templates || []).map((t, idx) => {
                      const isActive = t.id === currentActiveTemplate?.id;
                      const assignedCount = (design.customers || []).filter((c) => c.templateId === t.id).length;
                      return (
                        <div
                          key={t.id}
                          className={`flex items-center rounded-xl border transition-all ${
                            isActive
                              ? 'bg-[#FFF3E8] border-[#FED7AA] text-[#F45A0A] shadow-xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setActiveTemplateId(t.id)}
                            className="px-3.5 py-2 text-[12px] font-black cursor-pointer flex items-center gap-2"
                          >
                            <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-[#F45A0A]' : 'bg-slate-300'}`} />
                            <span>{t.name || `${isAr ? 'باقة' : 'Package'} #${idx + 1}`}</span>
                            {assignedCount > 0 && (
                              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded-full">
                                {assignedCount} {isAr ? 'مسافر' : 'pax'}
                              </span>
                            )}
                          </button>

                          {(design.templates || []).length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteTemplate(t.id)}
                              className="pe-2.5 ps-1 py-2 text-slate-400 hover:text-rose-600 cursor-pointer transition-colors"
                              title={isAr ? 'حذف نوع الباقة/الغرفة' : 'Delete package/room'}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      onClick={handleAddNewTemplate}
                      className="h-[38px] px-3.5 rounded-xl border border-dashed border-orange-300 text-[#F45A0A] hover:bg-orange-50 text-[11.5px] font-black cursor-pointer flex items-center gap-1.5 transition-all shadow-2xs"
                    >
                      <Plus size={15} strokeWidth={2.4} />
                      <span>{isAr ? 'إضافة نوع باقة / غرفة' : 'Add Room / Package'}</span>
                    </button>
                  </div>
                </div>

                {/* Active Package Meta Details (Name & Currency only - NO selling price!) */}
                {currentActiveTemplate && (
                  <div className="bg-[#FAFAFA] rounded-2xl border border-slate-200 p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-end">
                      {/* Package / Room Type Name */}
                      <div className="sm:col-span-8 lg:col-span-9">
                        <label className="text-[11.5px] font-bold text-slate-700 block mb-1">
                          {isAr ? 'اسم الباقة أو نوع الغرفة' : 'Package / Room Type Name'}
                        </label>
                        <input
                          value={currentActiveTemplate.name}
                          onChange={(e) => patchActiveTemplate({ name: e.target.value })}
                          placeholder={isAr ? 'مثال: غرفة مزدوجة (Double Room) أو باقة رئيسية' : 'e.g. Standard Package or Double Room'}
                          className="w-full h-[46px] px-3.5 rounded-[11px] border border-[#E5E7EB] bg-white text-[13px] font-bold text-slate-900 outline-none hover:border-slate-300 focus:border-2 focus:border-[#F45A0A] transition-all shadow-2xs"
                        />
                      </div>

                      {/* Currency */}
                      <div className="sm:col-span-4 lg:col-span-3">
                        <SearchableCombobox
                          label={isAr ? 'العملة' : 'Currency'}
                          value={currentActiveTemplate.currency}
                          onChange={(val) =>
                            patchActiveTemplate({
                              currency: (val as 'IQD' | 'USD') || design.currency,
                            })
                          }
                          options={[
                            { value: 'USD', label: isAr ? '$ دولار أمريكي (USD)' : '$ USD' },
                            { value: 'IQD', label: isAr ? 'د.ع دينار عراقي (IQD)' : 'IQD' },
                          ]}
                          placeholder={isAr ? 'العملة...' : 'Currency...'}
                        />
                      </div>
                    </div>

                    {/* Ready Package Sourcing Overview Card */}
                    {(design.sourcingType || 'READY_PACKAGE') === 'READY_PACKAGE' && Number(design.packageTotalCost || 0) > 0 && (
                      <div className="p-3.5 rounded-xl bg-orange-50/70 border border-orange-200/80 flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-white border border-orange-200 text-[#F45A0A] flex items-center justify-center font-bold shadow-2xs shrink-0">
                            <Briefcase size={16} />
                          </div>
                          <div>
                            <span className="text-[12px] font-black text-slate-900 block leading-tight">
                              {isAr ? 'كلفة شراء الباكج المجهز من المورد' : 'Supplier Ready Package Cost'}
                            </span>
                            <span className="text-[11px] text-slate-600 font-medium block mt-0.5">
                              {isAr ? 'المورد المجهز:' : 'Supplier:'} <strong className="text-slate-900">{design.supplierName || (isAr ? 'مورد غير محدد' : 'Unspecified')}</strong>
                              {design.buyDate && (
                                <span className="ms-2 text-slate-400 font-mono" dir="ltr">• {design.buyDate}</span>
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs font-mono">
                          <div>
                            <span className="text-slate-500 block text-[10px] font-sans font-bold">
                              {isAr ? 'إجمالي كلفة الشراء من المورد:' : 'Total Purchase Cost:'}
                            </span>
                            <span className="font-black text-slate-900 text-[14px]" dir="ltr">
                              {money(Number(design.packageTotalCost), design.currency)}
                            </span>
                          </div>
                          {totals.soldSeats > 0 && (
                            <div className="ps-3 border-s border-orange-200">
                              <span className="text-slate-500 block text-[10px] font-sans font-bold">
                                {isAr ? 'معدل الكلفة لكل مقعد مسجل:' : 'Avg Cost / Registered Seat:'}
                              </span>
                              <span className="font-black text-slate-800 text-[14px]" dir="ltr">
                                ~{money(Number(design.packageTotalCost) / totals.soldSeats, design.currency)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 3 Tabs for Cost Components (Auto Per Seat, Global Purchases, General Expenses) */}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <div className="bg-slate-50 border-b border-slate-200 px-3 pt-1.5 flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPurchasesTab('AUTO')}
                            className={`px-3.5 py-2 text-[12px] font-black border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                              purchasesTab === 'AUTO'
                                ? 'border-[#F45A0A] text-[#F45A0A] bg-white rounded-t-lg'
                                : 'border-transparent text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            <Ticket size={14} />
                            <span>{isAr ? 'المشتريات التلقائية للمقعد' : 'Per-Seat Purchases'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setPurchasesTab('GLOBAL')}
                            className={`px-3.5 py-2 text-[12px] font-black border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                              purchasesTab === 'GLOBAL'
                                ? 'border-[#F45A0A] text-[#F45A0A] bg-white rounded-t-lg'
                                : 'border-transparent text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            <Package size={14} />
                            <span>{isAr ? 'المشتريات العامة الشاملة' : 'Global Purchases'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setPurchasesTab('EXPENSES')}
                            className={`px-3.5 py-2 text-[12px] font-black border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                              purchasesTab === 'EXPENSES'
                                ? 'border-[#F45A0A] text-[#F45A0A] bg-white rounded-t-lg'
                                : 'border-transparent text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            <Coins size={14} />
                            <span>{isAr ? 'المصاريف العامة' : 'General Expenses'}</span>
                          </button>
                        </div>

                        {/* Add Component Menu */}
                        <Menu position="bottom-end" shadow="lg" radius="xl" width={220} withinPortal zIndex={10080}>
                          <Menu.Target>
                            <button
                              type="button"
                              className="h-[34px] px-3.5 rounded-lg bg-[#F45A0A] hover:bg-[#DD4F05] text-white text-[11.5px] font-black cursor-pointer flex items-center gap-1.5 shadow-xs transition-all my-1"
                            >
                              <Plus size={14} strokeWidth={2.4} />
                              <span>{isAr ? 'إضافة خدمة أو مكوّن' : 'Add Component'}</span>
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
                                    <span
                                      className={`w-7 h-7 rounded-lg border flex items-center justify-center ${tone.bg} ${tone.border} ${tone.text}`}
                                    >
                                      <Icon size={14} />
                                    </span>
                                  }
                                  onClick={() => addComponentToActiveTemplate(k.kind)}
                                >
                                  <span className="text-[12.5px] font-bold text-slate-800">
                                    {isAr ? k.ar : k.en}
                                  </span>
                                </Menu.Item>
                              );
                            })}
                          </Menu.Dropdown>
                        </Menu>
                      </div>

                      {/* Components List */}
                      <div className="p-3.5 space-y-2.5">
                        {activeTabComponents.length === 0 ? (
                          <div className="py-8 text-center rounded-xl border border-dashed border-slate-200 bg-white">
                            <Package size={26} className="mx-auto text-slate-300 mb-1" />
                            <p className="text-[12px] font-bold text-slate-600">
                              {isAr
                                ? 'لا توجد خدمات إضافية في هذا القسم'
                                : 'No extra services added in this section'}
                            </p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {isAr
                                ? 'اضغط على «إضافة خدمة أو مكوّن» لإدراج تذاكر طيران، فنادق، فيز، أو نقل وتحديد المصدر وسعر الشراء'
                                : 'Click "Add Component" to add tickets, hotels, visas, or transfers'}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {activeTabComponents.map((c) => {
                              const Icon = KIND_ICON[c.kind];
                              const tone = KIND_TONE[c.kind];
                              return (
                                <div
                                  key={c.id}
                                  className="grid grid-cols-1 md:grid-cols-[auto_minmax(0,1.8fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto_auto] items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-2xs"
                                >
                                  {/* Kind Badge */}
                                  <div className="flex items-center gap-2 shrink-0">
                                    <div
                                      className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${tone.bg} ${tone.border} ${tone.text}`}
                                    >
                                      <Icon size={17} />
                                    </div>
                                    <span className="text-[11.5px] font-black text-slate-700 block md:hidden">
                                      {kindLabel(c.kind, isAr)}
                                    </span>
                                  </div>

                                  {/* Supplier */}
                                  <div className="min-w-0">
                                    <label className="text-[10px] font-black text-slate-500 block mb-1">
                                      {isAr ? 'المصدر / المورد (Supplier)' : 'Supplier'}
                                    </label>
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        value={c.supplierName || ''}
                                        onChange={(e) =>
                                          patchComponentInActiveTemplate(c.id, {
                                            supplierName: e.target.value,
                                          })
                                        }
                                        placeholder={isAr ? 'اسم المورد أو شركة الطيران...' : 'Supplier name...'}
                                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[12px] font-bold text-slate-900 outline-none focus:border-[#F45A0A]"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setFinder({
                                            open: true,
                                            onSelectCallback: (account) =>
                                              patchComponentInActiveTemplate(c.id, {
                                                supplierName: account.name,
                                                supplierAccountId: account.id,
                                              }),
                                          })
                                        }
                                        className="h-8 w-8 rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100 flex items-center justify-center cursor-pointer shrink-0 transition-colors shadow-2xs"
                                        title={isAr ? 'بحث في الحسابات' : 'Search accounts'}
                                      >
                                        <Search size={13} />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Issue Date */}
                                  <div>
                                    <label className="text-[10px] font-black text-slate-500 block mb-1">
                                      {isAr ? 'تاريخ الإصدار' : 'Issue Date'}
                                    </label>
                                    <SegmentedDatePicker
                                      value={c.issueDate}
                                      onChange={(d, iso) =>
                                        patchComponentInActiveTemplate(c.id, { issueDate: iso ? iso.slice(0, 10) : '' })
                                      }
                                      placeholder={isAr ? 'حدد التاريخ...' : 'Select date...'}
                                    />
                                  </div>

                                  {/* Buy Cost */}
                                  <div>
                                    <label className="text-[10px] font-black text-slate-500 block mb-1">
                                      {isAr
                                        ? `سعر الشراء (${currentActiveTemplate.currency})`
                                        : `Buy Cost (${currentActiveTemplate.currency})`}
                                    </label>
                                    <input
                                      value={c.cost ? c.cost.toLocaleString('en-US') : ''}
                                      onChange={(e) =>
                                        patchComponentInActiveTemplate(c.id, {
                                          cost: numeric(e.target.value),
                                        })
                                      }
                                      placeholder="0.00"
                                      dir="ltr"
                                      className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[12.5px] font-mono font-black text-slate-900 text-end outline-none focus:border-[#F45A0A]"
                                    />
                                  </div>

                                  {/* Scope Toggle */}
                                  <div>
                                    <label className="text-[10px] font-black text-slate-500 block mb-1">
                                      {isAr ? 'النطاق' : 'Scope'}
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        patchComponentInActiveTemplate(c.id, {
                                          perSeat: !c.perSeat,
                                        })
                                      }
                                      className={`h-8 px-2.5 rounded-lg border text-[10.5px] font-black cursor-pointer transition-all ${
                                        c.perSeat
                                          ? 'bg-blue-50 border-blue-200 text-blue-700'
                                          : 'bg-amber-50 border-amber-200 text-amber-800'
                                      }`}
                                    >
                                      {c.perSeat
                                        ? isAr
                                          ? 'لكل مقعد'
                                          : 'Per Seat'
                                        : isAr
                                          ? 'للكروب كامل'
                                          : 'Whole Group'}
                                    </button>
                                  </div>

                                  {/* Delete Component */}
                                  <div>
                                    <label className="text-[10px] font-black text-transparent block mb-1">
                                      .
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeComponentFromActiveTemplate(c.id)
                                      }
                                      className="h-8 w-8 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer transition-colors"
                                      title={isAr ? 'حذف المكون' : 'Delete'}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Card 2: Purchases & Costs Summary Table */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-5 space-y-3">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200 text-[#F45A0A] flex items-center justify-center font-bold">
                      <Coins size={16} />
                    </div>
                    <div>
                      <span className="text-[13.5px] font-black text-slate-900 block leading-tight">
                        {isAr ? 'ملخص تكاليف ومشتريات الكروب' : 'Group Purchases & Costs Summary'}
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                        {isAr ? 'إجمالي كلفة المشتريات والخدمات والمصاريف المعتمدة للكروب' : 'Total purchases, expenses, and overall group cost'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-mono">
                    <span className="text-slate-500 font-sans font-bold">{isAr ? 'إجمالي التكلفة الكلية:' : 'Total Cost:'}</span>
                    <span className="font-black text-slate-900 text-[14px] bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200" dir="ltr">
                      {money(totals.costTotal, design.currency)}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-[#E5E7EB]">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-[#E5E7EB] text-slate-700 text-[11.5px] font-black">
                        <th className="p-3 w-12 text-center">#</th>
                        <th className="p-3 text-start">{isAr ? 'نوع الباقة / الغرفة' : 'Package / Room'}</th>
                        <th className="p-3 w-36 text-end">{isAr ? 'مشتريات المقاعد' : 'Seat Purchases'}</th>
                        <th className="p-3 w-36 text-end">{isAr ? 'مشتريات شاملة' : 'Global Purchases'}</th>
                        <th className="p-3 w-32 text-end">{isAr ? 'المصاريف' : 'Expenses'}</th>
                        <th className="p-3 w-36 text-end">{isAr ? 'إجمالي الكلفة' : 'Total Cost'}</th>
                        <th className="p-3 w-32 text-center">{isAr ? 'المسافرين المسجلين' : 'Booked Pax'}</th>
                        <th className="p-3 w-20 text-center">{isAr ? 'الإجراءات' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {(design.templates || []).map((tpl, idx) => {
                        const tplTotals = computeTemplateTotals(tpl);
                        const assignedCustomers = (design.customers || []).filter(
                          (c) => c.templateId === tpl.id,
                        );
                        const isCurrent = tpl.id === currentActiveTemplate?.id;

                        return (
                          <tr
                            key={tpl.id}
                            onClick={() => setActiveTemplateId(tpl.id)}
                            className={`cursor-pointer transition-colors ${
                              isCurrent ? 'bg-orange-50/50' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="p-3 text-center font-mono font-bold text-slate-400">
                              {idx + 1}
                            </td>
                            <td className="p-3 font-black text-slate-900">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    isCurrent ? 'bg-[#F45A0A]' : 'bg-slate-300'
                                  }`}
                                />
                                <span>{tpl.name}</span>
                              </div>
                            </td>
                            <td className="p-3 text-end font-mono font-bold text-slate-800 text-[12.5px]" dir="ltr">
                              {money(tplTotals.autoBuy, tpl.currency)}
                            </td>
                            <td className="p-3 text-end font-mono font-bold text-slate-800 text-[12.5px]" dir="ltr">
                              {money(tplTotals.globalBuy, tpl.currency)}
                            </td>
                            <td className="p-3 text-end font-mono font-bold text-slate-500 text-[12.5px]" dir="ltr">
                              {money(tplTotals.globalExpenses, tpl.currency)}
                            </td>
                            <td className="p-3 text-end font-mono font-black text-slate-900 text-[13px]" dir="ltr">
                              {money(tplTotals.totalCost, tpl.currency)}
                            </td>
                            <td className="p-3 text-center font-mono font-black text-indigo-700 text-[12.5px]" dir="ltr">
                              {assignedCustomers.length} {isAr ? 'مسافر' : 'pax'}
                            </td>
                            <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                              {(design.templates || []).length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTemplate(tpl.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                                  title={isAr ? 'حذف' : 'Delete'}
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#F8FAFC] border-t-2 border-[#E5E7EB] font-black text-[12px] text-slate-900">
                        <td colSpan={2} className="p-3 text-start font-sans">
                          {isAr ? 'إجمالي تكاليف الكروب:' : 'Total Group Costs:'}
                        </td>
                        <td className="p-3 text-end font-mono text-slate-800" dir="ltr">
                          {money(totals.sumBuy, design.currency)}
                        </td>
                        <td className="p-3 text-end font-mono text-slate-800" dir="ltr">
                          {money(totals.costTotal - totals.sumBuy - totals.sumExpenses, design.currency)}
                        </td>
                        <td className="p-3 text-end font-mono text-slate-500" dir="ltr">
                          {money(totals.sumExpenses, design.currency)}
                        </td>
                        <td className="p-3 text-end font-mono text-slate-900 text-[13.5px]" dir="ltr">
                          {money(totals.costTotal, design.currency)}
                        </td>
                        <td className="p-3 text-center font-mono text-indigo-700" dir="ltr">
                          {totals.soldSeats} {isAr ? 'مسافر' : 'pax'}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

            </div>
          ) : activeStep === 3 ? (
            /* ══════════════════════════════════════════════════════════════
               STEP 3: BENEFICIARIES & SEAT ALLOCATION (المستفيدين وتوزيع المقاعد)
               (تسجيل المسافرين والوكلاء وتوزيعهم على الغرف/الباقات - بدون تسعير)
               ══════════════════════════════════════════════════════════════ */
            <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-5 space-y-4">
              
              {/* Header with Seat Progress */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-3">
                <div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-200 text-[#F45A0A] flex items-center justify-center font-bold">
                      <Armchair size={18} />
                    </div>
                    <div>
                      <span className="font-black text-[15px] text-slate-900 block leading-tight">
                        {isAr ? 'المستفيدين وتوزيع مقاعد الكروب' : 'Passengers & Seat Allocation'}
                      </span>
                      <span className="text-[11.5px] text-slate-500 font-medium block mt-0.5">
                        {isAr
                          ? 'سجل أسماء المسافرين والعملاء وقم بتعيين نوع الغرفة أو الباقة لكل مسافر (العدد مفتوح)'
                          : 'Register passenger names and assign rooms/packages (Open capacity)'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Seat allocation badge */}
                  <span className="inline-flex items-center gap-1.5 text-[11.5px] font-black px-3.5 py-1.5 rounded-xl border shadow-2xs bg-emerald-50 border-emerald-200 text-emerald-800">
                    <CheckCircle2 size={14} />
                    <span>
                      {isAr
                        ? `إجمالي المقاعد المسجلة: ${totals.soldSeats} مقعداً (العدد مفتوح)`
                        : `Total Registered: ${totals.soldSeats} seats (Open Capacity)`}
                    </span>
                  </span>

                  <button
                    type="button"
                    onClick={() => handleOpenSaleModal()}
                    className="h-[40px] px-4 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white text-[12px] font-black cursor-pointer flex items-center gap-1.5 shadow-xs transition-all active:scale-[0.98]"
                  >
                    <Plus size={16} strokeWidth={2.4} />
                    <span>{isAr ? 'إضافة مسافر / مقعد' : 'Add Passenger / Seat'}</span>
                  </button>
                </div>
              </div>

              {/* Customers List */}
              {(design.customers || []).length === 0 ? (
                <div className="py-14 text-center rounded-2xl border border-dashed border-slate-200 bg-[#FAFAFA]">
                  <Armchair size={36} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-[13.5px] font-bold text-slate-700">
                    {isAr ? 'لم يتم تسجيل أي مسافر أو مقعد في الكروب بعد' : 'No passengers registered yet'}
                  </p>
                  <p className="text-[11.5px] text-slate-400 mt-0.5">
                    {isAr
                      ? 'اضغط على «إضافة مسافر / مقعد» لتسجيل أسماء الركاب وتوزيعهم على الغرف والباقات'
                      : 'Click "Add Passenger / Seat" to register passengers and assign rooms'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(design.customers || []).map((c, idx) => {
                    const assignedTpl = (design.templates || []).find((t) => t.id === c.templateId);

                    return (
                      <div
                        key={c.id}
                        className="bg-white rounded-2xl border border-[#E5E7EB] p-4 hover:border-orange-200 transition-all shadow-2xs space-y-3"
                      >
                        {/* Seat Row Header */}
                        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-lg bg-orange-50 text-[#F45A0A] border border-orange-200 font-mono font-black text-xs flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="font-bold text-[13px] text-slate-900">
                              {isAr ? `المقعد #${idx + 1}` : `Seat #${idx + 1}`}
                            </span>
                            {c.name && (
                              <span className="text-[12px] font-bold text-slate-600 font-sans">
                                • {c.name}
                              </span>
                            )}
                            {assignedTpl && (
                              <span className="text-[11px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg border border-slate-200">
                                {assignedTpl.name}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleRemoveCustomer(c.id)}
                              className="w-8 h-8 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 flex items-center justify-center cursor-pointer transition-colors"
                              title={isAr ? 'حذف المقعد' : 'Remove seat'}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Input Fields Grid (Passenger details ONLY - NO selling price here!) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 items-end">
                          {/* 1. Customer Selection */}
                          <div className="sm:col-span-4 md:col-span-4">
                            <SearchableCombobox
                              label={isAr ? 'اسم المسافر / العميل *' : 'Passenger / Customer *'}
                              value={c.name}
                              onChange={(val) => handlePatchCustomer(c.id, { name: val || '' })}
                              options={customerOptions}
                              placeholder={isAr ? 'اختر العميل أو اكتب اسماً...' : 'Select or type customer...'}
                              allowCustomValue
                            />
                          </div>

                          {/* 2. Agent Name */}
                          <div className="sm:col-span-4 md:col-span-3">
                            <label className="text-[11.5px] font-bold text-slate-700 block mb-1">
                              {isAr ? 'اسم الوكيل' : 'Agent Name'}
                            </label>
                            <input
                              value={c.agent || ''}
                              onChange={(e) => handlePatchCustomer(c.id, { agent: e.target.value })}
                              placeholder={isAr ? 'اسم الوكيل (اختياري)...' : 'Agent (optional)...'}
                              className="w-full h-[46px] px-3.5 rounded-[11px] border border-[#E5E7EB] bg-white text-[12.5px] font-bold outline-none hover:border-slate-300 focus:border-2 focus:border-[#F45A0A] transition-all shadow-2xs"
                            />
                          </div>

                          {/* 3. Room / Template Assignment */}
                          <div className="sm:col-span-4 md:col-span-3">
                            <SearchableCombobox
                              label={isAr ? 'نوع الغرفة / الباقة المخصصة' : 'Room / Package'}
                              value={c.templateId}
                              onChange={(val) => {
                                const tpl = (design.templates || []).find((t) => t.id === val);
                                handlePatchCustomer(c.id, {
                                  templateId: val,
                                  templateName: tpl?.name,
                                });
                              }}
                              options={templateComboboxOptions}
                              placeholder={isAr ? 'اختر نوع الغرفة...' : 'Select room/package...'}
                            />
                          </div>

                          {/* 4. Notes / Passport */}
                          <div className="sm:col-span-12 md:col-span-2">
                            <label className="text-[11.5px] font-bold text-slate-700 block mb-1">
                              {isAr ? 'ملاحظات / الجواز' : 'Notes / Passport'}
                            </label>
                            <input
                              value={c.notes || ''}
                              onChange={(e) => handlePatchCustomer(c.id, { notes: e.target.value })}
                              placeholder={isAr ? 'جواز السفر أو ملاحظات...' : 'Passport or notes...'}
                              className="w-full h-[46px] px-3.5 rounded-[11px] border border-[#E5E7EB] bg-white text-[12px] outline-none hover:border-slate-300 focus:border-2 focus:border-[#F45A0A] transition-all shadow-2xs"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          ) : (
            /* ══════════════════════════════════════════════════════════════
               STEP 4: SEAT PRICING, SALES & INVOICING (تسعير المقاعد والمبيعات)
               (هنا يتم تسعير المقاعد للعملاء واحتساب المبيعات والأرباح)
               ══════════════════════════════════════════════════════════════ */
            <div className="space-y-4">

              {/* 1. Batch Pricing per Package Card */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-200 text-[#F45A0A] flex items-center justify-center font-bold">
                        <TrendingUp size={18} />
                      </div>
                      <div>
                        <span className="font-black text-[15px] text-slate-900 block leading-tight">
                          {isAr ? 'تسعير المقاعد والمبيعات والفوترة' : 'Seat Pricing & Sales Invoicing'}
                        </span>
                        <span className="text-[11.5px] text-slate-500 font-medium block mt-0.5">
                          {isAr
                            ? 'حدد أسعار بيع المقاعد للمسافرين، طريقة الدفع، واطلع على الأرباح والفوترة النهائية للكروب'
                            : 'Set customer seat sale prices, payment methods, and calculate final group profits'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <span className="text-[11.5px] font-mono font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                    {isAr ? 'إجمالي المقاعد المسجلة:' : 'Total Seats:'} <strong className="text-slate-900 font-black">{totals.soldSeats}</strong>
                  </span>
                </div>

                {/* Batch Pricing Strips for each Package */}
                <div>
                  <span className="text-[12px] font-black text-slate-700 block mb-2.5">
                    {isAr ? 'التسعير الجماعي السريع حسب الباقة / الغرفة:' : 'Quick Batch Pricing by Room/Package:'}
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(design.templates || []).map((tpl) => {
                      const assignedCount = (design.customers || []).filter((c) => c.templateId === tpl.id).length;
                      return (
                        <div
                          key={tpl.id}
                          className="p-3.5 rounded-xl border border-slate-200 bg-[#FAFAFA] space-y-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-black text-[13px] text-slate-900 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-[#F45A0A]" />
                              <span>{tpl.name}</span>
                            </span>
                            <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                              {assignedCount} {isAr ? 'مسافر' : 'pax'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex items-center h-[38px] flex-1 rounded-lg border border-orange-200 bg-white px-2.5 focus-within:border-[#F45A0A]" dir="ltr">
                              <input
                                value={tpl.seatPrice ? tpl.seatPrice.toLocaleString('en-US') : ''}
                                onChange={(e) => {
                                  const newPrice = numeric(e.target.value);
                                  handleApplyBatchPrice(tpl.id, newPrice);
                                }}
                                placeholder="0.00"
                                className="w-full bg-transparent text-[13px] font-mono font-black text-end text-slate-900 outline-none"
                              />
                              <span className="text-[10.5px] font-bold text-[#F45A0A] ps-1.5 select-none">{tpl.currency}</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleApplyBatchPrice(tpl.id, Number(tpl.seatPrice) || 0)}
                              className="h-[38px] px-3 rounded-lg bg-orange-50 border border-orange-200 hover:bg-orange-100 text-[#F45A0A] text-[11px] font-black cursor-pointer shrink-0 transition-colors"
                              title={isAr ? 'تطبيق هذا السعر على جميع ركاب هذه الباقة' : 'Apply to all passengers in this package'}
                            >
                              {isAr ? 'تطبيق للكل' : 'Apply All'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 2. Detailed Passengers Pricing Table */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-5 space-y-3">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200 text-[#F45A0A] flex items-center justify-center font-bold">
                      <ShoppingCart size={16} />
                    </div>
                    <div>
                      <span className="text-[13.5px] font-black text-slate-900 block leading-tight">
                        {isAr ? 'جدول تسعير مبيعات المقاعد والأرباح' : 'Seat Sales Pricing & Profit Table'}
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                        {isAr ? 'سعر البيع المعتمد لكل مسافر، طريقة الدفع، وصافي الربح المحقق' : 'Individual passenger sale price, payment type, and net profit'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenSaleModal()}
                    className="h-[34px] px-3.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11.5px] font-bold cursor-pointer flex items-center gap-1.5 transition-colors"
                  >
                    <Plus size={14} />
                    <span>{isAr ? 'إضافة مسافر' : 'Add Passenger'}</span>
                  </button>
                </div>

                {(design.customers || []).length === 0 ? (
                  <div className="py-10 text-center rounded-xl border border-dashed border-slate-200 bg-[#FAFAFA]">
                    <Armchair size={32} className="mx-auto text-slate-300 mb-1.5" />
                    <p className="text-[12.5px] font-bold text-slate-700">
                      {isAr ? 'لم يتم إضافة أي مسافرين بعد' : 'No passengers added yet'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {isAr ? 'عد إلى الخطوة 3 لإضافة أسماء المسافرين أو اضغط على «إضافة مسافر» أعلاه' : 'Go back to step 3 to add passenger names'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-[#E5E7EB]">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-[#F8FAFC] border-b border-[#E5E7EB] text-slate-700 text-[11.5px] font-black">
                          <th className="p-3 w-12 text-center">#</th>
                          <th className="p-3 text-start">{isAr ? 'اسم المسافر / العميل' : 'Passenger Name'}</th>
                          <th className="p-3 w-36 text-start">{isAr ? 'الباقة / الغرفة' : 'Room / Package'}</th>
                          <th className="p-3 w-32 text-end">{isAr ? 'كلفة المقعد' : 'Seat Cost'}</th>
                          <th className="p-3 w-40 text-end">{isAr ? 'سعر بيع المقعد *' : 'Sale Price *'}</th>
                          <th className="p-3 w-32 text-center">{isAr ? 'طريقة الدفع' : 'Payment Type'}</th>
                          <th className="p-3 w-32 text-end">{isAr ? 'صافي الربح' : 'Net Profit'}</th>
                          <th className="p-3 w-28 text-center">{isAr ? 'ملف البيع' : 'Profile'}</th>
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
                            <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                              <td className="p-3 text-center font-mono font-bold text-slate-400">
                                {idx + 1}
                              </td>
                              <td className="p-3 font-black text-slate-900">
                                <div>
                                  <span>{c.name || (isAr ? 'مسافر غير مسمى' : 'Unnamed Passenger')}</span>
                                  {c.agent && (
                                    <span className="block text-[10.5px] font-medium text-slate-400">
                                      {isAr ? 'الوكيل:' : 'Agent:'} {c.agent}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3 text-slate-700 font-bold">
                                {assignedTpl?.name || '—'}
                              </td>
                              <td className="p-3 text-end font-mono font-bold text-slate-600 text-[12.5px]" dir="ltr">
                                {money(seatCost, design.currency)}
                              </td>
                              <td className="p-3 text-end" dir="ltr">
                                <div className="inline-flex items-center h-[34px] w-36 rounded-lg border-2 border-orange-200 bg-white px-2 focus-within:border-[#F45A0A]">
                                  <input
                                    value={c.sale ? c.sale.toLocaleString('en-US') : ''}
                                    onChange={(e) => handlePatchCustomer(c.id, { sale: numeric(e.target.value) })}
                                    dir="ltr"
                                    placeholder="0.00"
                                    className="w-full bg-transparent font-mono font-black text-[13px] text-end text-slate-900 outline-none"
                                  />
                                  <span className="text-[10px] font-bold text-[#F45A0A] ps-1 select-none">{design.currency}</span>
                                </div>
                              </td>
                              <td className="p-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handlePatchCustomer(c.id, { payType: c.payType === 'CREDIT' ? 'CASH' : 'CREDIT' })}
                                  className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black cursor-pointer border transition-colors ${
                                    c.payType === 'CREDIT'
                                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                  }`}
                                >
                                  {c.payType === 'CREDIT' ? (isAr ? 'آجل (Credit)' : 'Credit') : (isAr ? 'نقدي (Cash)' : 'Cash')}
                                </button>
                              </td>
                              <td className="p-3 text-end font-mono font-black text-[13px]" dir="ltr">
                                <span className={profit >= 0 ? 'text-[#078B61]' : 'text-rose-600'}>
                                  {profit >= 0 ? '+' : ''}
                                  {money(profit, design.currency)}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenSaleModal(c.templateId, c)}
                                    className="px-2 py-1 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-800 text-[10.5px] font-black cursor-pointer transition-colors"
                                    title={isAr ? 'فتح ملف البيع الكامل' : 'Full Sale Profile'}
                                  >
                                    <ShoppingCart size={12} className="inline me-0.5" />
                                    <span>{isAr ? 'ملف' : 'Profile'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveCustomer(c.id)}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-[#F8FAFC] border-t-2 border-[#E5E7EB] font-black text-[12px] text-slate-900">
                          <td colSpan={3} className="p-3 text-start font-sans">
                            {isAr ? 'إجمالي المبيعات والأرباح:' : 'Total Sales & Profit:'}
                          </td>
                          <td className="p-3 text-end font-mono text-slate-700" dir="ltr">
                            {money(totals.soldCost, design.currency)}
                          </td>
                          <td className="p-3 text-end font-mono text-slate-900 text-[13.5px]" dir="ltr">
                            {money(totals.salesTotal, design.currency)}
                          </td>
                          <td />
                          <td className="p-3 text-end font-mono text-[13.5px]" dir="ltr">
                            <span className={totals.realisedProfit >= 0 ? 'text-[#078B61]' : 'text-rose-600'}>
                              {totals.realisedProfit >= 0 ? '+' : ''}
                              {money(totals.realisedProfit, design.currency)}
                            </span>
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

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
              <span className="text-[10px] font-bold text-slate-500 block">{isAr ? 'المقاعد المسجلة' : 'Registered Seats'}</span>
              <span className="font-mono font-black text-slate-900 text-[12.5px]" dir="ltr">
                {totals.soldSeats} {isAr ? 'مقعد (مفتوح)' : 'seats (open)'}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1">
              <span className="text-[10px] font-bold text-slate-500 block">{isAr ? 'إجمالي كلفة الكروب' : 'Total Group Cost'}</span>
              <span className="font-mono font-black text-slate-900 text-[12.5px]" dir="ltr">
                {money(totals.costTotal, design.currency)}
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
            {activeStep === 1 && (
              <button
                type="button"
                onClick={() => setActiveStep(2)}
                className="h-[42px] px-5 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white text-xs font-black cursor-pointer flex items-center gap-1.5 shadow-xs transition-all active:scale-[0.98]"
              >
                <span>{isAr ? 'التالي: مشتريات وتكاليف الخدمات' : 'Next: Purchases & Costs'}</span>
                {direction === 'rtl' ? <ArrowLeft size={15} /> : <ArrowRight size={15} />}
              </button>
            )}

            {activeStep === 2 && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveStep(1)}
                  className="h-[42px] px-4 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer flex items-center gap-1.5 transition-colors"
                >
                  {direction === 'rtl' ? <ArrowRight size={15} /> : <ArrowLeft size={15} />}
                  <span>{isAr ? 'السابق: معلومات الكروب' : 'Back: Group Info'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveStep(3)}
                  className="h-[42px] px-5 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white text-xs font-black cursor-pointer flex items-center gap-1.5 shadow-xs transition-all active:scale-[0.98]"
                >
                  <span>{isAr ? 'التالي: المستفيدين وتوزيع المقاعد' : 'Next: Passengers & Seats'}</span>
                  {direction === 'rtl' ? <ArrowLeft size={15} /> : <ArrowRight size={15} />}
                </button>
              </>
            )}

            {activeStep === 3 && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveStep(2)}
                  className="h-[42px] px-4 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer flex items-center gap-1.5 transition-colors"
                >
                  {direction === 'rtl' ? <ArrowRight size={15} /> : <ArrowLeft size={15} />}
                  <span>{isAr ? 'السابق: المشتريات والتكاليف' : 'Back: Purchases & Costs'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveStep(4)}
                  className="h-[42px] px-5 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white text-xs font-black cursor-pointer flex items-center gap-1.5 shadow-xs transition-all active:scale-[0.98]"
                >
                  <span>{isAr ? 'التالي: تسعير المقاعد والمبيعات' : 'Next: Seat Pricing & Sales'}</span>
                  {direction === 'rtl' ? <ArrowLeft size={15} /> : <ArrowRight size={15} />}
                </button>
              </>
            )}

            {activeStep === 4 && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveStep(3)}
                  className="h-[42px] px-4 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer flex items-center gap-1.5 transition-colors"
                >
                  {direction === 'rtl' ? <ArrowRight size={15} /> : <ArrowLeft size={15} />}
                  <span>{isAr ? 'السابق: المستفيدين والمقاعد' : 'Back: Passengers & Seats'}</span>
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveGroup}
                  className="h-[42px] px-6 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] disabled:opacity-60 text-white text-xs font-black cursor-pointer flex items-center gap-1.5 shadow-xs transition-all active:scale-[0.98]"
                >
                  {saving ? <Loader size={15} color="white" /> : <Save size={16} />}
                  <span>{isAr ? 'حفظ الكروب والترحيل' : 'Save Group & Post'}</span>
                </button>
              </>
            )}
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
              handleOpenSaleModal(updated.id);
            }}
            onClose={() => {
              setTemplateModalOpen(false);
              setEditingTemplate(null);
            }}
            onOpenAccountFinder={(callback) => setFinder({ open: true, onSelectCallback: callback })}
          />
        )}
      </Modal>

      {/* ══════════════════════════════════════════════════════════════
          5. SALE CUSTOMGROUP MODAL (نافذة بيع الكروب للمستفيد - الصورة 2)
         ══════════════════════════════════════════════════════════════ */}
      <Modal
        opened={saleModalOpen}
        onClose={() => {
          setSaleModalOpen(false);
          setEditingCustomer(null);
        }}
        size="880px"
        centered
        radius="2xl"
        withCloseButton={false}
        overlayProps={{ backgroundOpacity: 0.45, blur: 3 }}
        styles={{ body: { padding: 0 } }}
      >
        {editingCustomer && (
          <SaleCustomGroupModalContent
            customer={editingCustomer}
            groupDesign={design}
            selectedTemplateId={selectedTemplateForSale || editingCustomer.templateId}
            cashboxOptions={cashboxOptions}
            customerOptions={customerOptions}
            currentUserName={currentUserName}
            isAr={isAr}
            direction={direction}
            onSave={(saved) => handleSaveCustomerFromModal(saved)}
            onClose={() => {
              setSaleModalOpen(false);
              setEditingCustomer(null);
            }}
          />
        )}
      </Modal>

      {/* Account Finder Modal */}
      <AccountFinderModal
        opened={finder.open}
        initialScope="SUPPLIER"
        onClose={() => setFinder({ open: false })}
        onSelect={(account: AccountFinderResult) => {
          finder.onSelectCallback?.(account);
          setFinder({ open: false });
        }}
      />
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// 6. PRICES TEMPLATE EDITOR MODAL (قالب الأسعار - الصورة 1 و 4)
// ══════════════════════════════════════════════════════════════
interface TemplateModalProps {
  template: GroupTemplate;
  groupCurrency: 'IQD' | 'USD';
  isAr: boolean;
  direction: 'rtl' | 'ltr';
  onSave: (tpl: GroupTemplate) => void;
  onOpenSale: (tpl: GroupTemplate) => void;
  onClose: () => void;
  onOpenAccountFinder: (callback: (acc: AccountFinderResult) => void) => void;
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

  // Sub-modal: Design Trip Package Modal (الصورة 1 المنبثقة)
  const [componentModalOpen, setComponentModalOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<GroupComponent | null>(null);

  const patchTpl = (changes: Partial<GroupTemplate>) => setTpl((t) => ({ ...t, ...changes }));

  const handleAddNewComponent = (kind: GroupComponentKind) => {
    const newComp: GroupComponent = {
      id: `cmp-${Date.now()}-${(tpl.components || []).length}`,
      kind,
      supplierName: '',
      cost: 0,
      issueDate: new Date().toISOString().slice(0, 10),
      currency: tpl.currency,
      perSeat: kind !== 'EXPENSE' && tab === 'AUTO',
      active: true,
    };
    setEditingComponent(newComp);
    setComponentModalOpen(true);
  };

  const handleEditComponent = (c: GroupComponent) => {
    setEditingComponent({ ...c });
    setComponentModalOpen(true);
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
      
      {/* ── Top Bar (Image 1: Template Name, Seats, Currency, Price Sale, Open Sale) ── */}
      <div className="bg-white border-b border-[#E5E7EB] p-4 shadow-2xs shrink-0">
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200 text-[#F45A0A] flex items-center justify-center">
              <Palette size={17} />
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-900 leading-tight">
                {isAr ? 'قالب الأسعار والمشتريات' : 'Prices Template Designer'}
              </h3>
              <span className="text-[11px] font-bold text-slate-400 font-mono">{tpl.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Green Open Sale Button (Image 1: Open Sale) */}
            <button
              type="button"
              onClick={() => onOpenSale(tpl)}
              className="h-[38px] px-4 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-[12px] font-black cursor-pointer flex items-center gap-1.5 shadow-xs transition-all active:scale-[0.98]"
            >
              <ShoppingCart size={15} />
              <span>{isAr ? 'فتح البيع للعملاء' : 'Open Sale'}</span>
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

        {/* Inputs Row (Image 1) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 items-end">
          {/* Template Name */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">
              {isAr ? 'اسم القالب' : 'Template Name'}
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
              {isAr ? 'عدد المقاعد' : 'Seats'}
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
              label={isAr ? 'العملة' : 'Currency'}
              value={tpl.currency}
              onChange={(val) => patchTpl({ currency: (val as 'IQD' | 'USD') || groupCurrency })}
              options={[
                { value: 'USD', label: isAr ? '$ دولار أمريكي (USD)' : '$ US Dollar (USD)' },
                { value: 'IQD', label: isAr ? 'د.ع دينار عراقي (IQD)' : 'IQD Iraqi Dinar' },
              ]}
              placeholder={isAr ? 'العملة...' : 'Currency...'}
            />
          </div>

          {/* Price Sale (Image 1) */}
          <div>
            <label className="text-[11px] font-bold text-[#F45A0A] block mb-1">
              {isAr ? 'سعر البيع المقترح' : 'Price Sale'}
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

      {/* ── 3 Tabs (Image 1: Auto Purchases, Global Purchases, Global Expenses) ── */}
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
          <span>{isAr ? 'المشتريات التلقائية للمقعد' : 'Auto Purchases'}</span>
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
          <span>{isAr ? 'المشتريات العامة الشاملة' : 'Global Purchases'}</span>
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
          <span>{isAr ? 'المصاريف العامة' : 'Global Expenses'}</span>
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

          {/* Yellow (+) Button Menu as in Image 1 & 4 */}
          <Menu position="bottom-end" shadow="lg" radius="xl" width={220} withinPortal zIndex={10080}>
            <Menu.Target>
              <button
                type="button"
                className="h-[36px] px-3.5 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white text-[12px] font-black cursor-pointer flex items-center gap-1.5 shadow-xs transition-all"
              >
                <Plus size={15} strokeWidth={2.4} />
                <span>{isAr ? 'إضافة مكوّن جديد' : 'Add Component'}</span>
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
                    onClick={() => handleAddNewComponent(k.kind)}
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
                ? 'اضغط على «إضافة مكوّن جديد» لإضافة تذكرة، فندق، فيزا، أو نقل وتحديد المصدر وتاريخ الإصدار'
                : 'Click "Add Component" to add tickets, hotels, visas, or transports'}
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
                  className="grid grid-cols-[auto_minmax(0,1.5fr)_minmax(0,1fr)_auto_auto_auto] items-center gap-2.5 p-3 rounded-xl border border-[#E5E7EB] bg-white hover:border-slate-300 transition-all shadow-2xs"
                >
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${tone.bg} ${tone.border} ${tone.text}`}>
                    <Icon size={17} />
                  </div>

                  {/* Supplier & Details */}
                  <div className="min-w-0">
                    <span className="text-[10px] font-black text-slate-500 block mb-0.5">
                      {kindLabel(c.kind, isAr)} {c.issueDate ? `• ${c.issueDate}` : ''}
                    </span>
                    <span className="font-bold text-[13px] text-slate-900 block truncate">
                      {c.supplierName || (isAr ? '— بدون مصدر محدد —' : '— No supplier —')}
                    </span>
                  </div>

                  {/* Cost Display */}
                  <div className="text-end">
                    <span className="text-[10px] font-black text-slate-500 block mb-0.5">
                      {isAr ? 'الكلفة' : 'Cost'}
                    </span>
                    <span className="font-mono font-black text-[13.5px] text-slate-900" dir="ltr">
                      {money(c.cost, c.currency || tpl.currency)}
                    </span>
                  </div>

                  {/* Scope Badge */}
                  <span
                    className={`h-7 px-2.5 rounded-lg border text-[10.5px] font-black inline-flex items-center justify-center whitespace-nowrap ${
                      c.perSeat
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-800'
                        : 'bg-amber-50 border-amber-200 text-amber-800'
                    }`}
                  >
                    {c.perSeat ? (isAr ? 'للمقعد' : 'Per seat') : isAr ? 'للكروب كامل' : 'Whole group'}
                  </span>

                  {/* Edit Button (Opens Design Trip Package Modal - Image 1 popup) */}
                  <button
                    type="button"
                    onClick={() => handleEditComponent(c)}
                    className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 flex items-center gap-1 text-[11px] font-bold cursor-pointer transition-colors shadow-2xs"
                    title={isAr ? 'تعديل تفاصيل باقة الرحلة' : 'Edit Package Component'}
                  >
                    <Palette size={13} />
                    <span>{isAr ? 'تعديل' : 'Edit'}</span>
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

      {/* ── Bottom Summary Row (Image 1: Buy, Global Buy, Expenses, Cost, Sale) ── */}
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

      {/* ══════════════════════════════════════════════════════════════
          DESIGN TRIP PACKAGE MODAL (تصميم باقة الرحلة - الصورة 1 المنبثقة)
         ══════════════════════════════════════════════════════════════ */}
      <Modal
        opened={componentModalOpen}
        onClose={() => {
          setComponentModalOpen(false);
          setEditingComponent(null);
        }}
        size="620px"
        centered
        radius="2xl"
        withCloseButton={false}
        overlayProps={{ backgroundOpacity: 0.5, blur: 3 }}
        styles={{ body: { padding: 0 } }}
      >
        {editingComponent && (
          <DesignTripPackageModalContent
            priceSystemName={tpl.name}
            component={editingComponent}
            defaultCurrency={tpl.currency}
            isAr={isAr}
            direction={direction}
            onSave={(updatedCmp) => {
              const exists = (tpl.components || []).some((c) => c.id === updatedCmp.id);
              if (exists) {
                patchTpl({
                  components: (tpl.components || []).map((c) => (c.id === updatedCmp.id ? updatedCmp : c)),
                });
              } else {
                patchTpl({
                  components: [...(tpl.components || []), updatedCmp],
                });
              }
              setComponentModalOpen(false);
              setEditingComponent(null);
            }}
            onClose={() => {
              setComponentModalOpen(false);
              setEditingComponent(null);
            }}
            onOpenAccountFinder={() => {
              onOpenAccountFinder((account) => {
                if (editingComponent) {
                  setEditingComponent({
                    ...editingComponent,
                    supplierName: account.name,
                    supplierAccountId: account.id,
                  });
                }
              });
            }}
          />
        )}
      </Modal>

    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// 7. DESIGN TRIP PACKAGE MODAL CONTENT (الصورة 1 المنبثقة)
// ══════════════════════════════════════════════════════════════
interface DesignTripPackageModalProps {
  priceSystemName: string;
  component: GroupComponent;
  defaultCurrency: 'IQD' | 'USD';
  isAr: boolean;
  direction: 'rtl' | 'ltr';
  onSave: (cmp: GroupComponent) => void;
  onClose: () => void;
  onOpenAccountFinder: () => void;
}

const DesignTripPackageModalContent: React.FC<DesignTripPackageModalProps> = ({
  priceSystemName,
  component: initialCmp,
  defaultCurrency,
  isAr,
  direction,
  onSave,
  onClose,
  onOpenAccountFinder,
}) => {
  const [cmp, setCmp] = useState<GroupComponent>({
    ...initialCmp,
    currency: initialCmp.currency || defaultCurrency,
    issueDate: initialCmp.issueDate || new Date().toISOString().slice(0, 10),
    active: initialCmp.active !== false,
  });

  return (
    <div className="bg-white rounded-2xl overflow-hidden font-sans select-none" dir={direction}>
      
      {/* Title Bar (Design Trip Package) */}
      <div className="bg-[#0284C7] px-4 py-3 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
            <Package size={16} />
          </div>
          <span className="font-black text-[13.5px]">
            {isAr ? 'تصميم باقة الرحلة (Design Trip Package)' : 'Design Trip Package'}
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      {/* Body Box */}
      <div className="p-5 space-y-4">
        
        {/* Header Badge: Price System */}
        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3">
          <div>
            <span className="text-[11px] font-bold text-slate-500 block">
              {isAr ? 'نظام القالب المعتمد' : 'Price System'}
            </span>
            <span className="font-black text-[13.5px] text-slate-900 font-mono">
              Price System : {priceSystemName}
            </span>
          </div>

          <div className="w-10 h-10 rounded-xl bg-orange-100/70 border border-orange-200 text-[#F45A0A] flex items-center justify-center">
            <Package size={22} />
          </div>
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          
          {/* Supplier (المورد / المصدر) */}
          <div className="sm:col-span-2">
            <label className="text-[11.5px] font-black text-rose-600 block mb-1">
              {isAr ? 'المورد / المصدر (Supplier) *' : 'Supplier *'}
            </label>
            <div className="flex items-center gap-1.5">
              <input
                value={cmp.supplierName}
                onChange={(e) => setCmp({ ...cmp, supplierName: e.target.value })}
                placeholder={isAr ? 'اسم المورد أو شركة الطيران...' : 'Supplier name...'}
                className="w-full h-[44px] px-3.5 rounded-xl border border-slate-200 bg-white text-[13px] font-bold text-slate-900 outline-none hover:border-slate-300 focus:border-2 focus:border-[#F45A0A] transition-all"
              />
              <button
                type="button"
                onClick={onOpenAccountFinder}
                className="h-[44px] w-[44px] rounded-xl border border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100 flex items-center justify-center cursor-pointer shrink-0 transition-colors shadow-2xs"
                title={isAr ? 'بحث في دليل الحسابات' : 'Find Account'}
              >
                <Search size={18} />
              </button>
            </div>
          </div>

          {/* Issue Date */}
          <div>
            <SegmentedDatePicker
              label={isAr ? 'تاريخ الإصدار (Issue Date)' : 'Issue Date'}
              value={cmp.issueDate}
              onChange={(d, iso) => setCmp({ ...cmp, issueDate: iso ? iso.slice(0, 10) : '' })}
              placeholder={isAr ? 'حدد التاريخ...' : 'Select date...'}
            />
          </div>

          {/* Buy (سعر الشراء / الكلفة) */}
          <div>
            <label className="text-[11.5px] font-black text-slate-700 block mb-1">
              {isAr ? 'سعر الشراء / الكلفة (Buy) *' : 'Buy Price *'}
            </label>
            <input
              value={cmp.cost ? cmp.cost.toLocaleString('en-US') : ''}
              onChange={(e) => setCmp({ ...cmp, cost: numeric(e.target.value) })}
              placeholder="0.00"
              dir="ltr"
              className="w-full h-[44px] px-3.5 rounded-xl border border-slate-200 bg-white text-[13.5px] font-mono font-black text-end text-slate-900 outline-none hover:border-slate-300 focus:border-2 focus:border-[#F45A0A] transition-all shadow-2xs"
            />
          </div>

          {/* Currency */}
          <div>
            <SearchableCombobox
              label={isAr ? 'العملة (Currency)' : 'Currency'}
              value={cmp.currency}
              onChange={(val) => setCmp({ ...cmp, currency: (val as 'IQD' | 'USD') || defaultCurrency })}
              options={[
                { value: 'USD', label: isAr ? '$ دولار أمريكي (Dollar)' : 'Dollar ($)' },
                { value: 'IQD', label: isAr ? 'د.ع دينار عراقي (IQD)' : 'Iraqi Dinar (IQD)' },
              ]}
              placeholder={isAr ? 'العملة...' : 'Currency...'}
            />
          </div>

          {/* Scope: Per Seat vs Whole Group */}
          <div>
            <label className="text-[11.5px] font-black text-slate-700 block mb-1">
              {isAr ? 'نطاق الكلفة' : 'Cost Scope'}
            </label>
            <div className="flex items-center gap-1.5 h-[44px]">
              <button
                type="button"
                onClick={() => setCmp({ ...cmp, perSeat: true })}
                className={`flex-1 h-full rounded-xl border text-[11.5px] font-black cursor-pointer transition-colors ${
                  cmp.perSeat
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                {isAr ? 'للمقعد الواحد' : 'Per Seat'}
              </button>
              <button
                type="button"
                onClick={() => setCmp({ ...cmp, perSeat: false })}
                className={`flex-1 h-full rounded-xl border text-[11.5px] font-black cursor-pointer transition-colors ${
                  !cmp.perSeat
                    ? 'bg-amber-50 border-amber-300 text-amber-800'
                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                {isAr ? 'للكروب كامل' : 'Whole Group'}
              </button>
            </div>
          </div>

        </div>

        {/* Active Toggle Switch */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-black text-slate-800">
              {isAr ? 'الحالة (Active):' : 'Status (Active):'}
            </span>
            <span className={`text-[11.5px] font-bold ${cmp.active ? 'text-teal-700' : 'text-slate-400'}`}>
              {cmp.active ? (isAr ? 'مفعل (On)' : 'On') : isAr ? 'معطل (Off)' : 'Off'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setCmp({ ...cmp, active: !cmp.active })}
            className={`w-12 h-6 rounded-full transition-colors cursor-pointer p-0.5 flex items-center ${
              cmp.active ? 'bg-teal-600 justify-end' : 'bg-slate-300 justify-start'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-white shadow-xs block" />
          </button>
        </div>

      </div>

      {/* Action Footer */}
      <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="h-[38px] px-4 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
        >
          {isAr ? 'إلغاء' : 'Cancel'}
        </button>

        <button
          type="button"
          onClick={() => onSave(cmp)}
          className="h-[38px] px-5 rounded-xl bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-black cursor-pointer flex items-center gap-1.5 shadow-xs transition-all active:scale-[0.98]"
        >
          <Save size={15} />
          <span>{isAr ? 'حفظ المكوّن' : 'Save Package'}</span>
        </button>
      </div>

    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// 8. SALE CUSTOMGROUP MODAL CONTENT (الصورة 2 القديمة)
// ══════════════════════════════════════════════════════════════
interface SaleCustomGroupModalProps {
  customer: GroupCustomer;
  groupDesign: GroupDesign;
  selectedTemplateId?: string;
  cashboxOptions: ComboboxOption[];
  customerOptions: ComboboxOption[];
  currentUserName: string;
  isAr: boolean;
  direction: 'rtl' | 'ltr';
  onSave: (cust: GroupCustomer) => void;
  onClose: () => void;
}

const SaleCustomGroupModalContent: React.FC<SaleCustomGroupModalProps> = ({
  customer: initialCustomer,
  groupDesign,
  selectedTemplateId,
  cashboxOptions,
  customerOptions,
  currentUserName,
  isAr,
  direction,
  onSave,
  onClose,
}) => {
  const targetTpl =
    (groupDesign.templates || []).find((t) => t.id === (selectedTemplateId || initialCustomer.templateId)) ||
    (groupDesign.templates || [])[0];

  const [cust, setCust] = useState<GroupCustomer>({
    ...initialCustomer,
    templateId: targetTpl?.id,
    templateName: targetTpl?.name,
    sale: initialCustomer.sale || Number(targetTpl?.seatPrice) || Number(groupDesign.seatPrice) || 0,
    boxCash: initialCustomer.boxCash || cashboxOptions[0]?.value || 'صندوق الشركات والقاصة',
    date: initialCustomer.date || new Date().toISOString().slice(0, 10),
    state: initialCustomer.state || 'MR',
  });

  return (
    <div className="bg-white rounded-2xl overflow-hidden font-sans select-none" dir={direction}>
      
      {/* Top Purple Bar (Sale CustomGroup - Image 2) */}
      <div className="bg-[#7E22CE] px-5 py-3 text-white flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
            <ShoppingCart size={16} />
          </div>
          <span className="font-black text-[14px]">
            {isAr ? 'بيع وتعيين مقعد لمستفيد (Sale CustomGroup)' : 'Sale CustomGroup'}
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      {/* Body Content (Image 2) */}
      <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
        
        {/* Section 1: Customer Profile (Image 2) */}
        <div className="border border-slate-200 rounded-2xl p-4 bg-[#FAFAFA] space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="text-[12.5px] font-black text-slate-800">
              {isAr ? 'ملف العميل والمستفيد (Customer Profile)' : 'Customer Profile'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            
            {/* Box Cash (الصندوق / القاصة) */}
            <div>
              <SearchableCombobox
                label={isAr ? 'الصندوق / القاصة (Box Cash)' : 'Box Cash'}
                value={cust.boxCash}
                onChange={(val) => setCust({ ...cust, boxCash: val || '' })}
                options={cashboxOptions}
                placeholder={isAr ? 'اختر القاصة...' : 'Select Box Cash...'}
              />
            </div>

            {/* User */}
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                {isAr ? 'المستخدم / المحرر (User)' : 'User'}
              </label>
              <input
                value={currentUserName}
                readOnly
                className="w-full h-[46px] px-3.5 rounded-[11px] border border-[#E5E7EB] bg-slate-100 text-[12.5px] font-bold text-slate-700 outline-none"
              />
            </div>

            {/* Date */}
            <div>
              <SegmentedDatePicker
                label={isAr ? 'تاريخ البيع (Date)' : 'Date'}
                value={cust.date}
                onChange={(d, iso) => setCust({ ...cust, date: iso ? iso.slice(0, 10) : '' })}
                placeholder={isAr ? 'حدد التاريخ...' : 'Select date...'}
              />
            </div>

            {/* Agent */}
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                {isAr ? 'الوكيل (Agent)' : 'Agent'}
              </label>
              <input
                value={cust.agent || ''}
                onChange={(e) => setCust({ ...cust, agent: e.target.value })}
                placeholder={isAr ? 'اسم الوكيل...' : 'Agent name...'}
                className="w-full h-[46px] px-3.5 rounded-[11px] border border-[#E5E7EB] bg-white text-[12.5px] font-bold text-slate-900 outline-none hover:border-slate-300 focus:border-2 focus:border-[#F45A0A] transition-all"
              />
            </div>

            {/* State: MR / MRS */}
            <div>
              <SearchableCombobox
                label={isAr ? 'اللقب (State)' : 'Title (State)'}
                value={cust.state}
                onChange={(val) => setCust({ ...cust, state: val || 'MR' })}
                options={[
                  { value: 'MR', label: 'MR (السيد)' },
                  { value: 'MRS', label: 'MRS (السيدة)' },
                  { value: 'CHD', label: 'CHD (طفل)' },
                  { value: 'INF', label: 'INF (رضيع)' },
                ]}
                placeholder="MR"
              />
            </div>

            {/* Pay Type */}
            <div>
              <SearchableCombobox
                label={isAr ? 'طريقة الدفع (Pay)' : 'Pay Type'}
                value={cust.payType}
                onChange={(val) => setCust({ ...cust, payType: (val as 'CASH' | 'CREDIT') || 'CASH' })}
                options={[
                  { value: 'CASH', label: isAr ? 'نقدي (Cash)' : 'Cash' },
                  { value: 'CREDIT', label: isAr ? 'آجل (Debit / Credit)' : 'Debit / Credit' },
                ]}
                placeholder="Pay..."
              />
            </div>

            {/* Name (Passenger / Customer) */}
            <div className="sm:col-span-2">
              <SearchableCombobox
                label={isAr ? 'اسم المسافر / المستفيد (Name) *' : 'Passenger Name *'}
                value={cust.name}
                onChange={(val) => setCust({ ...cust, name: val || '' })}
                options={customerOptions}
                placeholder={isAr ? 'اختر العميل أو اكتب اسماً جديداً...' : 'Select or type name...'}
                allowCustomValue
              />
            </div>

            {/* Price Sale */}
            <div>
              <label className="text-[11px] font-black text-[#F45A0A] block mb-1">
                {isAr ? 'سعر البيع (Price) *' : 'Price *'}
              </label>
              <input
                value={cust.sale ? cust.sale.toLocaleString('en-US') : ''}
                onChange={(e) => setCust({ ...cust, sale: numeric(e.target.value) })}
                placeholder="0.00"
                dir="ltr"
                className="w-full h-[46px] px-3.5 rounded-[11px] border border-orange-300 bg-white text-[13.5px] font-mono font-black text-end text-slate-900 outline-none hover:border-orange-400 focus:border-2 focus:border-[#F45A0A] transition-all"
              />
            </div>

            {/* Passport */}
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                {isAr ? 'رقم الجواز (Passport)' : 'Passport'}
              </label>
              <input
                value={cust.passport || ''}
                onChange={(e) => setCust({ ...cust, passport: e.target.value })}
                placeholder="A12345678"
                dir="ltr"
                className="w-full h-[46px] px-3.5 rounded-[11px] border border-[#E5E7EB] bg-white text-[12.5px] font-mono font-bold text-slate-900 outline-none hover:border-slate-300 focus:border-2 focus:border-[#F45A0A] transition-all"
              />
            </div>

            {/* Voucher */}
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                {isAr ? 'الفاوتشر (Voucher)' : 'Voucher'}
              </label>
              <input
                value={cust.voucher || ''}
                onChange={(e) => setCust({ ...cust, voucher: e.target.value })}
                placeholder="VCH-1002"
                dir="ltr"
                className="w-full h-[46px] px-3.5 rounded-[11px] border border-[#E5E7EB] bg-white text-[12.5px] font-mono font-bold text-slate-900 outline-none hover:border-slate-300 focus:border-2 focus:border-[#F45A0A] transition-all"
              />
            </div>

            {/* F.Code */}
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                {isAr ? 'كود الطيران (F.Code)' : 'F.Code'}
              </label>
              <input
                value={cust.fCode || ''}
                onChange={(e) => setCust({ ...cust, fCode: e.target.value })}
                placeholder="IA-702"
                dir="ltr"
                className="w-full h-[46px] px-3.5 rounded-[11px] border border-[#E5E7EB] bg-white text-[12.5px] font-mono font-bold text-slate-900 outline-none hover:border-slate-300 focus:border-2 focus:border-[#F45A0A] transition-all"
              />
            </div>

            {/* Note */}
            <div className="sm:col-span-3">
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                {isAr ? 'ملاحظات (Note)' : 'Note'}
              </label>
              <input
                value={cust.notes || ''}
                onChange={(e) => setCust({ ...cust, notes: e.target.value })}
                placeholder={isAr ? 'أي شروط أو تفاصيل إضافية للبيع...' : 'Additional notes...'}
                className="w-full h-[46px] px-3.5 rounded-[11px] border border-[#E5E7EB] bg-white text-[12.5px] font-medium text-slate-900 outline-none hover:border-slate-300 focus:border-2 focus:border-[#F45A0A] transition-all"
              />
            </div>

          </div>
        </div>

        {/* Section 2: Group Information (Image 2 Bottom Box) */}
        <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-2">
          <span className="text-[11.5px] font-black text-slate-700 block">
            {isAr ? 'معلومات الكروب المعتمدة (Group Information)' : 'Group Information'}
          </span>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-500 font-bold block text-[11px]">Group Name :</span>
              <span className="font-black text-rose-700 font-mono text-[13px] block">
                {groupDesign.groupName || '31521'}
              </span>
            </div>

            <div>
              <span className="text-slate-500 font-bold block text-[11px]">System Price :</span>
              <span className="font-black text-rose-700 font-mono text-[13px] block">
                {targetTpl ? `${targetTpl.name} (${money(targetTpl.seatPrice, targetTpl.currency)})` : '321023'}
              </span>
            </div>

            <div>
              <span className="text-slate-500 font-bold block text-[11px]">User Create :</span>
              <span className="font-black text-emerald-700 font-mono text-[12.5px] block">
                {currentUserName}
              </span>
            </div>

            <div>
              <span className="text-slate-500 font-bold block text-[11px]">Date Create :</span>
              <span className="font-black text-slate-700 font-mono text-[12px] block">
                {groupDesign.buyDate || new Date().toISOString().slice(0, 10)}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Action Footer */}
      <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="h-[38px] px-4 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
        >
          {isAr ? 'إلغاء' : 'Cancel'}
        </button>

        <button
          type="button"
          onClick={() => onSave(cust)}
          className="h-[38px] px-5 rounded-xl bg-[#7E22CE] hover:bg-[#6B21A8] text-white text-xs font-black cursor-pointer flex items-center gap-1.5 shadow-xs transition-all active:scale-[0.98]"
        >
          <Save size={15} />
          <span>{isAr ? 'حفظ وتعيين المقعد' : 'Save Seat Sale'}</span>
        </button>
      </div>

    </div>
  );
};

export default GroupDesignWorkspace;
