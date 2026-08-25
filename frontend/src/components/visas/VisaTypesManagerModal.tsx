import React, { useState, useMemo } from 'react';
import { Modal, Button, ActionIcon, Tooltip, SegmentedControl } from '@mantine/core';
import {
  Globe,
  Plus,
  Trash2,
  Edit2,
  Search,
  Check,
  X,
  Sparkles,
  AlertCircle,
  TrendingUp,
  Tag,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPrintTemplate, savePrintTemplate } from '../../api/printTemplates';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { useLanguageStore } from '../../store/useLanguageStore';
import { CountryFlagImage, resolveCountryCode, ALL_WORLD_COUNTRIES, WorldCountry } from '../ui/CountryFlagImage';

export interface VisaTypeRecord {
  id: string;
  name: string;
  flag?: string;
  countryCode?: string;
  defaultBuyPrice?: number | null;
  defaultSellPrice?: number | null;
  defaultCurrency?: 'USD' | 'IQD';
  createdAt?: string;
}

// Convert Arabic-Indic numerals (٠-٩ / ۰-۹) to standard Western Latin digits (0-9)
export const normalizeArabicNumbers = (val: any): string => {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
};

export function autoDetectCountryFlag(text: string): { code?: string; flag?: string } {
  const code = resolveCountryCode(text);
  return { code: code || undefined };
}

interface VisaTypesManagerModalProps {
  opened: boolean;
  onClose: () => void;
  onSelectVisaType?: (selectedName: string, record?: VisaTypeRecord) => void;
}

export const VisaTypesManagerModal: React.FC<VisaTypesManagerModalProps> = ({
  opened,
  onClose,
  onSelectVisaType,
}) => {
  const queryClient = useQueryClient();
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  // Form State
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formCountryCode, setFormCountryCode] = useState<string>('iq');
  const [formDefaultBuy, setFormDefaultBuy] = useState<string>('');
  const [formDefaultSell, setFormDefaultSell] = useState<string>('');
  const [formDefaultCurrency, setFormDefaultCurrency] = useState<'USD' | 'IQD'>('USD');
  const [flagPickerOpen, setFlagPickerOpen] = useState(false);
  const [flagSearchQuery, setFlagSearchQuery] = useState('');

  // ── 1. Fetch Real Database Visa Types Catalog ──
  const { data: visaRecords = [], isLoading } = useQuery<VisaTypeRecord[]>({
    queryKey: ['visa-types-catalog-full'],
    queryFn: async () => {
      try {
        const res = await fetchPrintTemplate('visa_types_catalog');
        if (res && res.config) {
          if (Array.isArray(res.config.items)) {
            return res.config.items.map((i: any) => ({
              ...i,
              defaultBuyPrice: i.defaultBuyPrice !== undefined && i.defaultBuyPrice !== null ? Number(normalizeArabicNumbers(i.defaultBuyPrice)) : null,
              defaultSellPrice: i.defaultSellPrice !== undefined && i.defaultSellPrice !== null ? Number(normalizeArabicNumbers(i.defaultSellPrice)) : null,
              defaultCurrency: i.defaultCurrency || 'USD',
            }));
          }
          if (Array.isArray(res.config.types)) {
            return res.config.types.map((nameStr: any, idx: number) => {
              const detected = resolveCountryCode(String(nameStr)) || undefined;
              return {
                id: `vt-${idx + 1}`,
                name: String(nameStr),
                countryCode: detected,
                defaultBuyPrice: null,
                defaultSellPrice: null,
                defaultCurrency: 'USD',
              };
            });
          }
        }
      } catch (e) {
        console.warn('Failed to load visa types from database:', e);
      }
      return [];
    },
    staleTime: 2 * 60 * 1000,
  });

  // ── 2. Save Mutation to PostgreSQL ──
  const saveCatalogMutation = useMutation({
    mutationFn: async (updatedItems: VisaTypeRecord[]) => {
      const legacyTypes = updatedItems.map((item) => item.name);
      return await savePrintTemplate(
        'visa_types_catalog',
        {
          items: updatedItems,
          types: legacyTypes,
        },
        'دليل أنواع ووجهات التأشيرات والأسعار المثبتة'
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visa-types-catalog-full'] });
      queryClient.invalidateQueries({ queryKey: ['visa-types-catalog'] });
    },
  });

  // Auto detect flag on typing name
  const handleNameChange = (val: string) => {
    setFormName(val);
    if (!editingId) {
      const detected = resolveCountryCode(val);
      if (detected) {
        setFormCountryCode(detected);
      }
    }
  };

  // Submit Add or Edit
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = formName.trim();
    if (!trimmed) {
      showErrorNotification(
        isAr ? 'حقل مطلوب' : 'Required Field',
        isAr ? 'يرجى كتابة اسم نوع التأشيرة أو الدولة' : 'Please enter visa type or destination name'
      );
      return;
    }

    const buyClean = normalizeArabicNumbers(formDefaultBuy).trim();
    const sellClean = normalizeArabicNumbers(formDefaultSell).trim();
    const buyPriceNum = buyClean ? Number(buyClean) : null;
    const sellPriceNum = sellClean ? Number(sellClean) : null;

    try {
      let nextList: VisaTypeRecord[] = [];

      if (editingId) {
        // Edit Mode
        nextList = visaRecords.map((item) => {
          if (item.id === editingId) {
            return {
              ...item,
              name: trimmed,
              countryCode: formCountryCode || resolveCountryCode(trimmed) || undefined,
              defaultBuyPrice: buyPriceNum,
              defaultSellPrice: sellPriceNum,
              defaultCurrency: formDefaultCurrency,
            };
          }
          return item;
        });

        await saveCatalogMutation.mutateAsync(nextList);
        showSuccessNotification(
          isAr ? 'تم تعديل نوع التأشيرة والأسعار' : 'Visa Type & Prices Updated',
          isAr ? `تم تحديث بيانات وأسعار (${trimmed}) في قاعدة البيانات` : `Successfully updated (${trimmed})`
        );
        resetForm();
      } else {
        // Add Mode
        const exists = visaRecords.some(
          (v) => v.name.trim().toLowerCase() === trimmed.toLowerCase()
        );
        if (exists) {
          showErrorNotification(
            isAr ? 'موجودة مسبقاً' : 'Already Exists',
            isAr ? `نوع التأشيرة (${trimmed}) مسجل مسبقاً في الدليل` : `(${trimmed}) already exists in catalog`
          );
          return;
        }

        const newItem: VisaTypeRecord = {
          id: `vt-${Date.now()}`,
          name: trimmed,
          countryCode: formCountryCode || resolveCountryCode(trimmed) || undefined,
          defaultBuyPrice: buyPriceNum,
          defaultSellPrice: sellPriceNum,
          defaultCurrency: formDefaultCurrency,
          createdAt: new Date().toISOString(),
        };

        nextList = [newItem, ...visaRecords];
        await saveCatalogMutation.mutateAsync(nextList);

        showSuccessNotification(
          isAr ? 'تمت إضافة نوع التأشيرة وتثبيت السعر' : 'Visa Type Added',
          isAr ? `تم حفظ (${trimmed}) وأسعارها بنجاح في قاعدة البيانات` : `Successfully saved (${trimmed}) to database`
        );

        if (onSelectVisaType) {
          onSelectVisaType(trimmed, newItem);
        }
        resetForm();
      }
    } catch (err: any) {
      showErrorNotification(
        isAr ? 'خطأ في الحفظ' : 'Save Error',
        err?.message || (isAr ? 'تعذر حفظ البيانات في قاعدة البيانات' : 'Failed to save data')
      );
    }
  };

  // Start Edit
  const handleStartEdit = (record: VisaTypeRecord) => {
    setEditingId(record.id);
    setFormName(record.name);
    setFormCountryCode(record.countryCode || resolveCountryCode(record.name) || 'iq');
    setFormDefaultBuy(record.defaultBuyPrice !== undefined && record.defaultBuyPrice !== null ? String(record.defaultBuyPrice) : '');
    setFormDefaultSell(record.defaultSellPrice !== undefined && record.defaultSellPrice !== null ? String(record.defaultSellPrice) : '');
    setFormDefaultCurrency(record.defaultCurrency || 'USD');
    setFlagPickerOpen(false);
  };

  // Delete Record
  const handleDelete = async (record: VisaTypeRecord) => {
    if (!window.confirm(isAr ? `هل أنت متأكد من حذف (${record.name}) من دليل التأشيرات؟` : `Are you sure you want to delete (${record.name})?`)) {
      return;
    }

    try {
      const nextList = visaRecords.filter((item) => item.id !== record.id);
      await saveCatalogMutation.mutateAsync(nextList);
      showSuccessNotification(
        isAr ? 'تم الحذف' : 'Deleted',
        isAr ? `تم حذف (${record.name}) من قاعدة البيانات` : `Deleted (${record.name})`
      );
      if (editingId === record.id) {
        resetForm();
      }
    } catch (err: any) {
      showErrorNotification(
        isAr ? 'خطأ في الحذف' : 'Delete Error',
        err?.message || (isAr ? 'تعذر حذف السجل من قاعدة البيانات' : 'Failed to delete record')
      );
    }
  };

  // Reset form
  const resetForm = () => {
    setEditingId(null);
    setFormName('');
    setFormCountryCode('iq');
    setFormDefaultBuy('');
    setFormDefaultSell('');
    setFormDefaultCurrency('USD');
    setFlagPickerOpen(false);
    setFlagSearchQuery('');
  };

  // Filtered list of registered visas
  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return visaRecords;
    const q = searchQuery.toLowerCase().trim();
    return visaRecords.filter((r) => r.name.toLowerCase().includes(q));
  }, [visaRecords, searchQuery]);

  // Filtered list of all world countries for flag picker
  const filteredCountries = useMemo(() => {
    if (!flagSearchQuery.trim()) return ALL_WORLD_COUNTRIES;
    const q = flagSearchQuery.toLowerCase().trim();
    return ALL_WORLD_COUNTRIES.filter(
      (c) =>
        c.code.includes(q) ||
        c.nameAr.toLowerCase().includes(q) ||
        c.nameEn.toLowerCase().includes(q) ||
        c.keywords.some((k) => k.toLowerCase().includes(q))
    );
  }, [flagSearchQuery]);

  const buyNumPreview = Number(normalizeArabicNumbers(formDefaultBuy)) || 0;
  const sellNumPreview = Number(normalizeArabicNumbers(formDefaultSell)) || 0;
  const hasPreviewPrices = Boolean(formDefaultBuy && formDefaultSell);

  return (
    <Modal
      opened={opened}
      onClose={() => {
        resetForm();
        onClose();
      }}
      title={
        <div className="flex items-center gap-2.5 font-bold text-slate-900 text-sm">
          <div className="w-8 h-8 rounded-xl bg-[#FFF3E8] text-[#F45A0A] border border-[#FFD8B2] flex items-center justify-center shadow-2xs">
            <Globe size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 leading-tight">
              {isAr ? 'دليل أنواع الفيزا وتثبيت الأسعار الافتراضية' : 'Visa Types & Preset Pricing Catalog'}
            </h3>
            <span className="text-[11.5px] text-slate-500 font-normal">
              {isAr ? 'تحديد أسعار الشراء والبيع الافتراضية لكل نوع فيزا مع إمكانية استخدامها تلقائياً عند إصدار الفواتير' : 'Set default buy & sell fares for each visa destination with optional auto-apply in invoices'}
            </span>
          </div>
        </div>
      }
      size="860px"
      centered
      radius="24px"
      padding="lg"
      dir={direction}
      styles={{
        header: { borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' },
        body: { paddingTop: '16px' },
      }}
    >
      <div className="space-y-4 font-sans text-xs">

        {/* ── 1. ADD / EDIT FORM CARD (Airy Light Glassmorphism with Brand Accents) ── */}
        <form onSubmit={handleSubmit} className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 text-xs flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-[#FFF3E8] text-[#F45A0A] border border-[#FFD8B2] flex items-center justify-center shrink-0">
                {editingId ? <Edit2 size={13} /> : <Plus size={13} />}
              </span>
              <span className="text-[13px]">{editingId ? (isAr ? 'تعديل نوع التأشيرة والأسعار المثبتة' : 'Edit Selected Visa & Preset Prices') : (isAr ? 'إضافة نوع فيزا جديد وتثبيت الأسعار' : 'Add New Visa & Set Preset Prices')}</span>
            </span>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs"
              >
                <X size={12} />
                <span>{isAr ? 'إلغاء التعديل' : 'Cancel Edit'}</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            
            {/* Flag Selector Button */}
            <div className="sm:col-span-3">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                {isAr ? 'علم الدولة / الوجهة' : 'Country Flag'}
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setFlagPickerOpen(!flagPickerOpen)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white hover:border-[#F45A0A]/50 flex items-center justify-between text-base cursor-pointer shadow-2xs transition-all"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CountryFlagImage countryCode={formCountryCode} name={formName} size="md" />
                    <span className="text-[11.5px] font-bold text-slate-800 truncate">
                      {ALL_WORLD_COUNTRIES.find((c) => c.code === formCountryCode)?.nameEn || formCountryCode.toUpperCase()}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-[#F45A0A] bg-[#FFF3E8] px-1.5 py-0.5 rounded border border-[#FFD8B2] shrink-0">
                    {isAr ? 'تغيير' : 'Change'}
                  </span>
                </button>

                {/* Flag Picker Popover */}
                {flagPickerOpen && (
                  <div className="absolute z-50 top-full mt-1.5 start-0 w-[340px] bg-white border border-slate-200 rounded-2xl shadow-2xl p-3 space-y-2 animate-dropdown-pop">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <Globe size={14} className="text-[#F45A0A]" />
                        <span className="font-bold text-xs text-slate-800">
                          {isAr ? 'اختر علم الدولة' : 'Select Country Flag'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFlagPickerOpen(false);
                          setFlagSearchQuery('');
                        }}
                        className="text-slate-400 hover:text-slate-700 p-0.5 rounded hover:bg-slate-100 cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div className="relative">
                      <Search size={13} className={`absolute ${direction === 'rtl' ? 'right-2.5' : 'left-2.5'} top-1/2 -translate-y-1/2 text-slate-400`} />
                      <input
                        type="text"
                        value={flagSearchQuery}
                        onChange={(e) => setFlagSearchQuery(e.target.value)}
                        placeholder={isAr ? 'ابحث عن دولة أو رمز...' : 'Search country, code...'}
                        className={`w-full h-8 ${direction === 'rtl' ? 'pr-8 pl-6' : 'pl-8 pr-6'} rounded-lg border border-slate-200 text-[11.5px] bg-slate-50 focus:bg-white focus:border-[#F45A0A] outline-none transition-colors`}
                        autoFocus
                      />
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 max-h-[220px] overflow-y-auto p-1 border border-slate-100 rounded-xl bg-slate-50/50">
                      {filteredCountries.map((c) => {
                        const isSelected = formCountryCode === c.code;
                        return (
                          <button
                            key={c.code}
                            type="button"
                            title={`${c.nameEn} - ${c.nameAr}`}
                            onClick={() => {
                              setFormCountryCode(c.code);
                              if (!formName.trim()) {
                                setFormName(`${c.nameEn} Visa`);
                              }
                              setFlagPickerOpen(false);
                              setFlagSearchQuery('');
                            }}
                            className={`p-1.5 rounded-lg flex flex-col items-center justify-center gap-1 transition-all cursor-pointer border ${
                              isSelected
                                ? 'border-[#F45A0A] bg-orange-100/80 shadow-2xs'
                                : 'border-white bg-white hover:bg-orange-50/60 hover:border-orange-200'
                            }`}
                          >
                            <CountryFlagImage countryCode={c.code} name={c.nameEn} size="md" />
                            <span className="text-[9.5px] font-bold text-slate-700 truncate w-full text-center">
                              {c.nameEn}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Visa Name Input */}
            <div className="sm:col-span-3">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                {isAr ? 'اسم نوع التأشيرة *' : 'Visa Type Name *'}
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. فيزا دبي 30 يوم"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-900 outline-none hover:border-slate-300 focus:border-[#F45A0A] shadow-2xs transition-all"
              />
            </div>

            {/* Preset Default Buy Price */}
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                {isAr ? 'سعر الشراء المثبت' : 'Preset Buy Fare'}
              </label>
              <input
                type="text"
                dir="ltr"
                value={formDefaultBuy}
                onChange={(e) => setFormDefaultBuy(normalizeArabicNumbers(e.target.value))}
                placeholder="0.00"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold text-slate-900 outline-none hover:border-slate-300 focus:border-[#F45A0A] shadow-2xs transition-all text-center"
              />
            </div>

            {/* Preset Default Sell Price */}
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                {isAr ? 'سعر البيع المثبت' : 'Preset Sell Fare'}
              </label>
              <input
                type="text"
                dir="ltr"
                value={formDefaultSell}
                onChange={(e) => setFormDefaultSell(normalizeArabicNumbers(e.target.value))}
                placeholder="0.00"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold text-slate-900 outline-none hover:border-slate-300 focus:border-[#F45A0A] shadow-2xs transition-all text-center"
              />
            </div>

            {/* Crisp Custom Currency Selector Button Group */}
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                {isAr ? 'عملة السعر' : 'Currency'}
              </label>
              <div className="flex items-center h-10 p-1 bg-white rounded-xl border border-slate-200 gap-1 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setFormDefaultCurrency('USD')}
                  className={`flex-1 h-full rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    formDefaultCurrency === 'USD'
                      ? 'bg-[#F45A0A] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <span>$ USD</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormDefaultCurrency('IQD')}
                  className={`flex-1 h-full rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    formDefaultCurrency === 'IQD'
                      ? 'bg-[#F45A0A] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <span>د.ع IQD</span>
                </button>
              </div>
            </div>

          </div>

          {/* Profit preview + Action button bar */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-200/80 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              {hasPreviewPrices && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-emerald-200 text-emerald-800 text-[11.5px] font-bold shadow-2xs">
                  <TrendingUp size={14} className="text-emerald-600" />
                  <span>{isAr ? 'الربح المتوقع للتأشيرة:' : 'Expected Profit:'}</span>
                  <span className="font-mono font-extrabold text-emerald-700" dir="ltr">
                    {(sellNumPreview - buyNumPreview).toLocaleString('en-US')} {formDefaultCurrency}
                  </span>
                </div>
              )}
            </div>

            <Button
              type="submit"
              color="orange"
              loading={saveCatalogMutation.isPending}
              disabled={!formName.trim() || saveCatalogMutation.isPending}
              leftSection={editingId ? <Check size={15} /> : <Plus size={15} />}
              className="bg-[#F45A0A] hover:bg-orange-600 h-9 px-5 rounded-xl font-bold text-xs text-white shadow-xs cursor-pointer ms-auto"
            >
              {editingId ? (isAr ? 'حفظ تعديل التأشيرة والأسعار' : 'Save Changes') : (isAr ? 'إضافة للدليل وتثبيت السعر' : 'Add Visa & Preset Price')}
            </Button>
          </div>
        </form>

        {/* ── 2. SEARCH & COUNT BAR ── */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isAr ? 'بحث في التأشيرات المسجلة...' : 'Search registered visas...'}
              className="w-full h-9 ps-8 pe-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 outline-none hover:border-slate-300 focus:border-[#F45A0A]"
            />
          </div>

          <span className="text-[11.5px] font-bold text-slate-500 shrink-0">
            {isAr ? `إجمالي [${filteredRecords.length}] تأشيرة مسجلة` : `[${filteredRecords.length}] registered`}
          </span>
        </div>

        {/* ── 3. DATA TABLE OF ALL REGISTERED VISA TYPES WITH PRESET PRICES ── */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs bg-white">
          <div className="max-h-[320px] overflow-y-auto">
            <table className={`w-full text-${direction === 'rtl' ? 'right' : 'left'} border-collapse text-xs`}>
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-700 font-bold z-10">
                <tr className="h-10 text-[11.5px]">
                  <th className="px-3 text-center w-12">#</th>
                  <th className="px-3 w-16 text-center">{isAr ? 'العلم' : 'Flag'}</th>
                  <th className="px-3 min-w-[180px]">{isAr ? 'نوع التأشيرة / الوجهة' : 'Visa Destination'}</th>
                  <th className="px-3 text-center w-36">{isAr ? 'سعر الشراء المثبت' : 'Preset Buy'}</th>
                  <th className="px-3 text-center w-36">{isAr ? 'سعر البيع المثبت' : 'Preset Sell'}</th>
                  <th className="px-3 text-center w-32">{isAr ? 'الربح المتوقع' : 'Est. Profit'}</th>
                  <th className="px-3 text-center w-36">{isAr ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-semibold">
                      {isAr ? 'جاري جلب قائمة التأشيرات من قاعدة البيانات...' : 'Loading visas from database...'}
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-semibold">
                      {searchQuery
                        ? (isAr ? 'لا توجد تأشيرة مطابقة لكلمة البحث' : 'No matching visa found')
                        : (isAr ? 'لا توجد تأشيرات مسجلة بعد. استخدم النموذج أعلاه للإضافة.' : 'No visas registered yet.')}
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((item, idx) => {
                    const isSelectedBeingEdited = editingId === item.id;
                    const buyVal = item.defaultBuyPrice !== null && item.defaultBuyPrice !== undefined ? Number(item.defaultBuyPrice) : null;
                    const sellVal = item.defaultSellPrice !== null && item.defaultSellPrice !== undefined ? Number(item.defaultSellPrice) : null;
                    const profitVal = buyVal !== null && sellVal !== null ? sellVal - buyVal : null;
                    const curr = item.defaultCurrency || 'USD';

                    return (
                      <tr
                        key={item.id || idx}
                        className={`hover:bg-[#FFF3E8]/40 transition-colors ${
                          isSelectedBeingEdited ? 'bg-[#FFF3E8] font-bold' : ''
                        }`}
                      >
                        {/* Index */}
                        <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-400">
                          {idx + 1}
                        </td>

                        {/* Real Flag Image */}
                        <td className="px-3 py-2.5 text-center">
                          <CountryFlagImage countryCode={item.countryCode} name={item.name} size="md" />
                        </td>

                        {/* Visa Name */}
                        <td className="px-3 py-2.5 font-bold text-slate-900">
                          <span>{item.name}</span>
                        </td>

                        {/* Default Buy Price */}
                        <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-700">
                          {buyVal !== null ? (
                            <span className="inline-block px-2.5 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 text-xs" dir="ltr">
                              {buyVal.toLocaleString('en-US')} {curr}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-normal">—</span>
                          )}
                        </td>

                        {/* Default Sell Price */}
                        <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-900">
                          {sellVal !== null ? (
                            <span className="inline-block px-2.5 py-0.5 rounded-lg bg-[#FFF3E8] text-[#F45A0A] border border-[#FFD8B2] text-xs" dir="ltr">
                              {sellVal.toLocaleString('en-US')} {curr}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-normal">—</span>
                          )}
                        </td>

                        {/* Expected Profit */}
                        <td className="px-3 py-2.5 text-center font-mono font-bold">
                          {profitVal !== null ? (
                            <span className={`inline-block px-2.5 py-0.5 rounded-lg text-xs ${profitVal >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`} dir="ltr">
                              {profitVal > 0 ? `+${profitVal.toLocaleString('en-US')}` : profitVal.toLocaleString('en-US')} {curr}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-normal">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {onSelectVisaType && (
                              <Button
                                size="compact-xs"
                                variant="light"
                                color="orange"
                                radius="md"
                                onClick={() => {
                                  onSelectVisaType(item.name, item);
                                  onClose();
                                }}
                                className="font-bold text-[11px] h-7 px-2.5 bg-[#FFF3E8] text-[#F45A0A] hover:bg-orange-200 border border-[#FFD8B2] cursor-pointer"
                              >
                                {isAr ? 'اختيار' : 'Select'}
                              </Button>
                            )}

                            <Tooltip label={isAr ? 'تعديل وتغيير الأسعار' : 'Edit & change prices'} withArrow>
                              <ActionIcon
                                size="sm"
                                variant="subtle"
                                color="gray"
                                radius="md"
                                onClick={() => handleStartEdit(item)}
                                className="hover:text-slate-900 cursor-pointer"
                              >
                                <Edit2 size={14} />
                              </ActionIcon>
                            </Tooltip>

                            <Tooltip label={isAr ? 'حذف من قاعدة البيانات' : 'Delete'} withArrow color="red">
                              <ActionIcon
                                size="sm"
                                variant="subtle"
                                color="red"
                                radius="md"
                                onClick={() => handleDelete(item)}
                                className="hover:bg-red-50 text-red-500 cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </ActionIcon>
                            </Tooltip>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── 4. FOOTER NOTE ── */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
          <span>{isAr ? 'الأسعار المثبتة اختيارية ويتم اقتراحها تلقائياً عند إضافة المسافرين مع إمكانية تعديلها في أي وقت.' : 'Preset fares are suggested automatically when adding travelers and can be modified anytime.'}</span>
          <Button
            size="xs"
            variant="default"
            radius="md"
            onClick={onClose}
            className="font-semibold text-xs border-slate-300"
          >
            {isAr ? 'إغلاق' : 'Close'}
          </Button>
        </div>

      </div>
    </Modal>
  );
};

export default VisaTypesManagerModal;

