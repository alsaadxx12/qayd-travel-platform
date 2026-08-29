import React, { useState, useEffect, useMemo } from 'react';
import { Paper, Button, TextInput, Checkbox, Select, ColorInput, Slider, Switch, Badge, Tabs } from '@mantine/core';
import {
  IconPrinter,
  IconDeviceFloppy,
  IconPalette,
  IconTypography,
  IconBuilding,
  IconAdjustments,
  IconEye,
  IconReceipt,
  IconReceiptOff,
  IconCoins,
  IconFileText,
} from '@tabler/icons-react';
import { fetchPrintTemplate, savePrintTemplate } from '../../api/printTemplates';
import { branchesApi, type Branch } from '../../api/branches';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { useLanguageStore } from '../../store/useLanguageStore';
import {
  PrintableAccountStatementSheet,
  type StatementMovementItem,
} from '../../components/reports/AccountStatementPrintModal';

export const PrintSettingsPage: React.FC = () => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  const [activeDocTab, setActiveDocTab] = useState<string | null>('statement');

  // Print Statement Customization State
  const [printConfig, setPrintConfig] = useState<any>({
    primaryColor: '#059669',
    headerBgColor: '#059669',
    fontFamily: 'IBM Plex Sans Arabic',
    isTableBold: false,
    subtitle: 'قسم المحاسبة والمالية — كشف حساب تفصيلي',
    notesText: 'ملاحظة: هذا الكشف يعتبر مطبقاً وموافقاً عليه رسمياً ما لم يتم الإعتراض خلال 7 أيام من تاريخ صدوره.',
    footerText: 'شركة الفرسان للسياحة والسفر — جميع الحقوق محفوظة © 2026',
    showFinancialSummary: true,
    showOpeningBalance: true,
    showSignatures: true,
    fontSizes: {
      companyTitle: 17,
      tableHeader: 11,
      tableBody: 10,
    },
  });
  const [isSavingPrintConfig, setIsSavingPrintConfig] = useState(false);
  const [printTab, setPrintTab] = useState<'colors' | 'fonts' | 'info' | 'toggles'>('colors');
  const [existingTemplateConfig, setExistingTemplateConfig] = useState<any>({});
  const [branches, setBranches] = useState<Branch[]>([]);

  // Active logo from existing config
  const activeLogoUrl = useMemo(() => {
    return existingTemplateConfig?.logoUrl || printConfig?.logoUrl || '';
  }, [existingTemplateConfig, printConfig]);

  useEffect(() => {
    // Load existing template config
    fetchPrintTemplate('statement')
      .then((res) => {
        if (res && res.config) {
          setExistingTemplateConfig(res.config);
          setPrintConfig((prev: any) => ({ ...prev, ...res.config }));
        }
      })
      .catch(() => {});

    branchesApi.getAll().then((data) => {
      if (Array.isArray(data)) setBranches(data);
    }).catch(() => {});
  }, []);

  const updatePrintConfig = (field: string, value: any) => {
    setPrintConfig((prev: any) => {
      if (field.startsWith('fontSizes.')) {
        const fontKey = field.split('.')[1];
        return {
          ...prev,
          fontSizes: {
            ...prev.fontSizes,
            [fontKey]: value,
          },
        };
      }
      return {
        ...prev,
        [field]: value,
      };
    });
  };

  const handleSavePrintConfig = async () => {
    setIsSavingPrintConfig(true);
    try {
      let baseConfig = existingTemplateConfig;
      try {
        const latest = await fetchPrintTemplate('statement');
        if (latest && latest.config) {
          baseConfig = latest.config;
        }
      } catch {}

      const newConfig = {
        ...baseConfig,
        ...printConfig,
        logoUrl: activeLogoUrl || baseConfig?.logoUrl || printConfig?.logoUrl || '',
      };

      await savePrintTemplate('statement', newConfig);
      setExistingTemplateConfig(newConfig);

      showSuccessNotification(
        isAr ? 'تم حفظ إعدادات الطباعة' : 'Print Settings Saved',
        isAr ? 'تم حفظ ألوان وخطوط ونصوص الكشف بنجاح في قاعدة البيانات وتحديث كشوفات الحساب فورياً' : 'Print settings saved and applied successfully'
      );
    } catch (err) {
      showErrorNotification(
        isAr ? 'خطأ في الحفظ' : 'Save Error',
        isAr ? 'تعذر حفظ إعدادات الطباعة والكشف في قاعدة البيانات' : 'Failed to save print settings'
      );
    } finally {
      setIsSavingPrintConfig(false);
    }
  };

  const comingSoonPlaceholder = (docType: string) => (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F45A0A] mb-4">
        <IconPrinter size={28} />
      </div>
      <h3 className="font-black text-base text-slate-900 mb-2">
        {isAr ? `إعدادات طباعة ${docType}` : `${docType} Print Settings`}
      </h3>
      <p className="text-sm text-slate-500 font-bold max-w-md">
        {isAr
          ? 'سيتم إضافة إعدادات تخصيص طباعة هذا المستند قريباً. حالياً يمكنك تخصيص إعدادات كشف الحساب من التبويب الأول.'
          : 'Print customization settings for this document will be available soon.'}
      </p>
      <Badge size="lg" color="orange" variant="light" className="font-black mt-4">
        {isAr ? 'قريباً' : 'Coming Soon'}
      </Badge>
    </div>
  );

  return (
    <div
      className="p-4 md:p-6 space-y-4 max-w-[1500px] mx-auto select-none"
      dir={direction}
      style={{ fontFamily: isAr ? "'IBM Plex Sans Arabic', system-ui, sans-serif" : "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif" }}
    >
      {/* Page Header */}
      <Paper p="sm" radius="md" withBorder className="bg-white shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F45A0A] flex items-center justify-center text-white shadow-md shadow-orange-500/20">
              <IconPrinter size={20} />
            </div>
            <div>
              <h1 className="font-black text-sm text-slate-900">
                {isAr ? 'إعدادات الطباعة' : 'Print Settings'}
              </h1>
              <p className="text-[11px] text-slate-500 font-bold mt-0.5">
                {isAr
                  ? 'تخصيص تصميم وإعدادات طباعة المستندات الرسمية: كشوفات الحساب، سندات القبض والدفع، وتقارير المصاريف'
                  : 'Customize print design for statements, receipt vouchers, payment vouchers, and expense reports'}
              </p>
            </div>
          </div>
        </div>
      </Paper>

      {/* Document Type Tabs */}
      <Paper p="md" radius="md" withBorder className="bg-white shadow-2xs">
        <Tabs value={activeDocTab} onChange={setActiveDocTab} color="orange">
          <Tabs.List grow className="font-bold">
            <Tabs.Tab
              value="statement"
              leftSection={<IconFileText size={16} />}
              className="font-black text-xs"
            >
              {isAr ? 'كشف الحساب' : 'Account Statement'}
            </Tabs.Tab>
            <Tabs.Tab
              value="receipt_voucher"
              leftSection={<IconReceipt size={16} />}
              className="font-black text-xs"
            >
              {isAr ? 'سند القبض' : 'Receipt Voucher'}
            </Tabs.Tab>
            <Tabs.Tab
              value="payment_voucher"
              leftSection={<IconReceiptOff size={16} />}
              className="font-black text-xs"
            >
              {isAr ? 'سند الدفع' : 'Payment Voucher'}
            </Tabs.Tab>
            <Tabs.Tab
              value="expense_report"
              leftSection={<IconCoins size={16} />}
              className="font-black text-xs"
            >
              {isAr ? 'تقرير المصاريف' : 'Expense Report'}
            </Tabs.Tab>
          </Tabs.List>

          {/* Statement Tab */}
          <Tabs.Panel value="statement" pt="md">
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between border-b pb-2">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                    <IconPrinter size={20} className="text-[#F45A0A]" />
                    <span>{isAr ? 'إعدادات وتصاميم كشف الحساب والطباعة' : 'Statement Print Design & Settings'}</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    {isAr ? 'معاينة حية وتعديل العبارات والنصوص الرسمية لكشف الحساب' : 'Live preview and edit official statement texts'}
                  </p>
                </div>
                <Button
                  color="orange"
                  size="xs"
                  loading={isSavingPrintConfig}
                  leftSection={<IconDeviceFloppy size={16} />}
                  onClick={handleSavePrintConfig}
                  className="font-extrabold px-4 shadow-xs bg-[#F45A0A] hover:bg-[#DD4F05]"
                >
                  {isAr ? 'حفظ إعدادات الكشف والطباعة' : 'Save Print Settings'}
                </Button>
              </div>

              {/* Grid: Controls (4 cols) & Live Preview (8 cols) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                {/* Tabbed Controls (4 cols) */}
                <div className="lg:col-span-4 space-y-3.5 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                  {/* Modern Pill Tab Selector */}
                  <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                    <div className="grid grid-cols-4 gap-1">
                      <button
                        type="button"
                        onClick={() => setPrintTab('colors')}
                        className={`flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                          printTab === 'colors'
                            ? 'bg-[#F45A0A] text-white shadow-xs scale-[1.02]'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        <IconPalette size={14} />
                        <span>{isAr ? 'الألوان' : 'Colors'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrintTab('fonts')}
                        className={`flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                          printTab === 'fonts'
                            ? 'bg-[#F45A0A] text-white shadow-xs scale-[1.02]'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        <IconTypography size={14} />
                        <span>{isAr ? 'الخطوط' : 'Fonts'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrintTab('info')}
                        className={`flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                          printTab === 'info'
                            ? 'bg-[#F45A0A] text-white shadow-xs scale-[1.02]'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        <IconBuilding size={14} />
                        <span>{isAr ? 'البيانات' : 'Info'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrintTab('toggles')}
                        className={`flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                          printTab === 'toggles'
                            ? 'bg-[#F45A0A] text-white shadow-xs scale-[1.02]'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        <IconAdjustments size={14} />
                        <span>{isAr ? 'العناصر' : 'Toggles'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Tab Panels */}
                  {printTab === 'colors' && (
                    <div className="space-y-3 bg-white p-3 rounded-xl border border-slate-200">
                      <span className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs border-b pb-1.5">
                        <IconPalette size={15} className="text-[#F45A0A]" />
                        <span>{isAr ? 'تخصيص ألوان أجزاء المستند' : 'Customize document colors'}</span>
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <ColorInput label={isAr ? 'شريط عنوان الكشف' : 'Title accent'} size="xs" value={printConfig.titleAccentColor || '#64748b'} onChange={(val) => updatePrintConfig('titleAccentColor', val)} format="hex" swatches={['#64748b', '#059669', '#2563eb', '#7c3aed', '#d97706', '#dc2626', '#0f172a']} />
                        <ColorInput label={isAr ? 'خلفية رأس الجدول' : 'Table header bg'} size="xs" value={printConfig.tableHeaderBgColor || '#e2e8f0'} onChange={(val) => updatePrintConfig('tableHeaderBgColor', val)} format="hex" swatches={['#e2e8f0', '#059669', '#1e293b', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444']} />
                        <ColorInput label={isAr ? 'نص رأس الجدول' : 'Table header text'} size="xs" value={printConfig.tableHeaderTextColor || '#0f172a'} onChange={(val) => updatePrintConfig('tableHeaderTextColor', val)} format="hex" swatches={['#0f172a', '#ffffff', '#334155', '#1e293b', '#047857']} />
                        <ColorInput label={isAr ? 'خلفية ملخص الحساب' : 'Summary bg'} size="xs" value={printConfig.summaryHeaderBgColor || '#e2e8f0'} onChange={(val) => updatePrintConfig('summaryHeaderBgColor', val)} format="hex" swatches={['#e2e8f0', '#ecfdf5', '#f1f5f9', '#eff6ff', '#fef3c7']} />
                        <ColorInput label={isAr ? 'نص ملخص الحساب' : 'Summary text'} size="xs" value={printConfig.summaryHeaderTextColor || '#0f172a'} onChange={(val) => updatePrintConfig('summaryHeaderTextColor', val)} format="hex" swatches={['#0f172a', '#065f46', '#1e40af', '#92400e', '#ffffff']} />
                        <ColorInput label={isAr ? 'صفوف الجدول الزوجية' : 'Striped rows'} size="xs" value={printConfig.tableRowStripedColor || '#f8fafc'} onChange={(val) => updatePrintConfig('tableRowStripedColor', val)} format="hex" swatches={['#f8fafc', '#f0fdf4', '#f0f9ff', '#fefce8', '#ffffff']} />
                        <ColorInput label={isAr ? 'نصوص حركات الجدول' : 'Table text'} size="xs" value={printConfig.tableTextColor || '#0f172a'} onChange={(val) => updatePrintConfig('tableTextColor', val)} format="hex" swatches={['#0f172a', '#334155', '#1e293b', '#475569']} />
                        <ColorInput label={isAr ? 'لون الرصيد النهائي' : 'Balance color'} size="xs" value={printConfig.balanceDueColor || '#0f172a'} onChange={(val) => updatePrintConfig('balanceDueColor', val)} format="hex" swatches={['#0f172a', '#dc2626', '#059669', '#2563eb', '#d97706']} />
                      </div>
                    </div>
                  )}

                  {printTab === 'fonts' && (
                    <div className="space-y-3 bg-white p-3.5 rounded-xl border border-slate-200">
                      <span className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs border-b pb-1.5">
                        <IconTypography size={15} className="text-[#F45A0A]" />
                        <span>{isAr ? 'أنواع الخطوط والأحجام' : 'Fonts & Sizes'}</span>
                      </span>
                      <Select label={isAr ? 'نوع الخط المستخدم بالكشف' : 'Statement font'} size="xs" data={['IBM Plex Sans Arabic', 'Tajawal', 'Cairo', 'Inter', 'Roboto']} value={printConfig.fontFamily || 'IBM Plex Sans Arabic'} onChange={(val) => updatePrintConfig('fontFamily', val || 'IBM Plex Sans Arabic')} className="font-bold" />
                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1">
                          <span>{isAr ? 'حجم خط عنوان المستند' : 'Doc title size'}</span>
                          <span className="text-[#F45A0A] font-mono">{printConfig.docTitleSize || 20}px</span>
                        </div>
                        <Slider size="xs" color="orange" min={16} max={28} step={1} value={printConfig.docTitleSize || 20} onChange={(val) => updatePrintConfig('docTitleSize', val)} />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1">
                          <span>{isAr ? 'حجم خط جدول الحركات' : 'Table font size'}</span>
                          <span className="text-[#F45A0A] font-mono">{printConfig.tableFontSize || 10}px</span>
                        </div>
                        <Slider size="xs" color="orange" min={8} max={14} step={0.5} value={printConfig.tableFontSize || 10} onChange={(val) => updatePrintConfig('tableFontSize', val)} />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1">
                          <span>{isAr ? 'حجم خط التذييل والفوتر' : 'Footer font size'}</span>
                          <span className="text-[#F45A0A] font-mono">{printConfig.footerFontSize || 10}px</span>
                        </div>
                        <Slider size="xs" color="orange" min={8} max={13} step={0.5} value={printConfig.footerFontSize || 10} onChange={(val) => updatePrintConfig('footerFontSize', val)} />
                      </div>
                      <div className="pt-1 border-t border-slate-100">
                        <Checkbox label={isAr ? 'تغميق الخطوط بجدول الحركات (Bold Text)' : 'Bold table text'} size="xs" checked={printConfig.isTableBold || false} onChange={(e) => updatePrintConfig('isTableBold', e.currentTarget.checked)} className="font-bold" />
                      </div>
                    </div>
                  )}

                  {printTab === 'info' && (
                    <div className="space-y-3 bg-white p-3.5 rounded-xl border border-slate-200">
                      <span className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs border-b pb-1.5">
                        <IconBuilding size={15} className="text-[#F45A0A]" />
                        <span>{isAr ? 'بيانات الشركة والعبارات الرسمية' : 'Company data & texts'}</span>
                      </span>
                      <TextInput label={isAr ? 'اسم الشركة / الفرع بالكشف' : 'Company name'} size="xs" value={printConfig.companyName || ''} onChange={(e) => updatePrintConfig('companyName', e.target.value)} placeholder="FLY4ALL" className="font-bold" />
                      <TextInput label={isAr ? 'العنوان الفرعي للكشف' : 'Subtitle'} size="xs" value={printConfig.subtitle || ''} onChange={(e) => updatePrintConfig('subtitle', e.target.value)} placeholder="Detailed Account Statement" className="font-bold" />
                      <TextInput label={isAr ? 'رقم الهاتف المعروض بالكشف' : 'Phone'} size="xs" value={printConfig.phone || ''} onChange={(e) => updatePrintConfig('phone', e.target.value)} placeholder="07700003377" className="font-bold" />
                      <TextInput label={isAr ? 'البريد الإلكتروني المعروض بالكشف' : 'Email'} size="xs" value={printConfig.email || ''} onChange={(e) => updatePrintConfig('email', e.target.value)} placeholder="Support@Fly4all.com" className="font-bold" />
                      <TextInput label={isAr ? 'عنوان الشركة / الفرع بالكشف' : 'Address'} size="xs" value={printConfig.address || ''} onChange={(e) => updatePrintConfig('address', e.target.value)} placeholder={isAr ? 'العراق - بغداد' : 'Iraq - Baghdad'} className="font-bold" />
                      <TextInput label={isAr ? 'نص التذييل والفوتر (Footer Text)' : 'Footer text'} size="xs" value={printConfig.footerText || ''} onChange={(e) => updatePrintConfig('footerText', e.target.value)} className="font-bold" />
                    </div>
                  )}

                  {printTab === 'toggles' && (
                    <div className="space-y-3 bg-white p-3.5 rounded-xl border border-slate-200">
                      <span className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs border-b pb-1.5">
                        <IconAdjustments size={15} className="text-[#F45A0A]" />
                        <span>{isAr ? 'خيارات إظهار وإخفاء عناصر الكشف' : 'Show/hide statement elements'}</span>
                      </span>
                      <div className="space-y-2 text-[11px] font-bold">
                        <div className="flex items-center justify-between py-1">
                          <span>{isAr ? 'إظهار كارت ملخص الحساب (Account summary)' : 'Show account summary'}</span>
                          <Switch size="xs" color="orange" checked={printConfig.showAccountSummary !== false} onChange={(e) => updatePrintConfig('showAccountSummary', e.currentTarget.checked)} />
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                          <span>{isAr ? 'إظهار رمز الـ QR Code في تذييل الكشف' : 'Show QR code in footer'}</span>
                          <Switch size="xs" color="orange" checked={printConfig.showQrCode !== false} onChange={(e) => updatePrintConfig('showQrCode', e.currentTarget.checked)} />
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                          <span>{isAr ? 'إظهار العلامة المائية الشفافة (Watermark)' : 'Show watermark'}</span>
                          <Switch size="xs" color="orange" checked={printConfig.showWatermark || false} onChange={(e) => updatePrintConfig('showWatermark', e.currentTarget.checked)} />
                        </div>
                      </div>
                      {printConfig.showWatermark && (
                        <TextInput label={isAr ? 'نص العلامة المائية' : 'Watermark text'} size="xs" value={printConfig.watermarkText || ''} onChange={(e) => updatePrintConfig('watermarkText', e.target.value)} placeholder="OFFICIAL STATEMENT" className="font-bold mt-2" />
                      )}
                    </div>
                  )}
                </div>

                {/* Official Live Preview (8 cols) */}
                <div className="lg:col-span-8 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-2 sticky top-2">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs">
                      <IconEye size={16} className="text-[#F45A0A]" />
                      <span>{isAr ? 'معاينة حية ومباشرة للكشف المعتمد (Official Live Preview)' : 'Official Live Preview'}</span>
                    </span>
                    <Badge color="orange" variant="light" size="sm" className="font-bold">
                      {isAr ? 'التصميم الرسمي الثابت ⚡' : 'Official Design ⚡'}
                    </Badge>
                  </div>

                  <div className="overflow-x-auto max-h-[720px] overflow-y-auto p-4 bg-slate-100/90 rounded-xl border border-slate-200 flex justify-center items-start" dir="ltr" style={{ direction: 'ltr', textAlign: 'left' }}>
                    <div className="scale-90 origin-top flex justify-center w-full min-w-[780px]" dir="ltr" style={{ direction: 'ltr', textAlign: 'left' }}>
                      <PrintableAccountStatementSheet
                        accountName="حساب العميل علي السعدي"
                        accountCode="1413"
                        startDate="2026/08/01"
                        endDate="2026/08/31"
                        rows={[
                          { rowNumber: 1, date: '2026/08/01', docRef: 'OB-2026', statement: 'رصيد افتتاحي مرحل من الدورة المالية السابقة', debit: 0, credit: 0, runningBalance: 0 },
                          { rowNumber: 2, date: '2026/08/02', docRef: 'INV-01005', pnr: 'PRMCK', route: 'BGW ➔ MHD', statement: 'مبيعات تذاكر طيران خطوط كاسبيان | المسافرين (3): Mr SALAM ALSHAMOOSI', debit: 1250000, credit: 0, runningBalance: 1250000 },
                          { rowNumber: 3, date: '2026/08/04', docRef: 'RV-0042', statement: 'سند قبض نقدي دفعة أولى لحساب حجز التذاكر', debit: 0, credit: 500000, runningBalance: 750000 },
                        ]}
                        totals={{ totalDebit: 1250000, totalCredit: 500000, finalBalance: 750000, openingBalance: 0, previousBalance: 0 }}
                        config={{
                          ...existingTemplateConfig,
                          ...printConfig,
                          logoPosX: 0,
                          logoPosY: 0,
                          logoUrl: activeLogoUrl || existingTemplateConfig?.logoUrl || printConfig?.logoUrl || '',
                        }}
                        lang="ar"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Tabs.Panel>

          {/* Receipt Voucher Tab */}
          <Tabs.Panel value="receipt_voucher" pt="md">
            {comingSoonPlaceholder(isAr ? 'سند القبض' : 'Receipt Voucher')}
          </Tabs.Panel>

          {/* Payment Voucher Tab */}
          <Tabs.Panel value="payment_voucher" pt="md">
            {comingSoonPlaceholder(isAr ? 'سند الدفع' : 'Payment Voucher')}
          </Tabs.Panel>

          {/* Expense Report Tab */}
          <Tabs.Panel value="expense_report" pt="md">
            {comingSoonPlaceholder(isAr ? 'تقرير المصاريف' : 'Expense Report')}
          </Tabs.Panel>
        </Tabs>
      </Paper>
    </div>
  );
};
