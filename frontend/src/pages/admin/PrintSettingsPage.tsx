import React, { useState, useEffect, useMemo } from 'react';
import { Paper, Button, TextInput, Select, ColorInput, Slider, Switch, Tabs } from '@mantine/core';
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
  IconFileTypePdf,
} from '@tabler/icons-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { fetchPrintTemplate, savePrintTemplate } from '../../api/printTemplates';
import { branchesApi, type Branch } from '../../api/branches';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { useLanguageStore } from '../../store/useLanguageStore';
import {
  PrintableAccountStatementSheet,
  type StatementMovementItem,
} from '../../components/reports/AccountStatementPrintModal';
import {
  PrintableVoucherSheet,
  DEFAULT_VOUCHER_CONFIG,
  DEFAULT_PAYMENT_VOUCHER_CONFIG,
  type VoucherPrintItem,
} from '../../components/vouchers/VoucherPrintModal';

// Sample mock data for live statement preview
const MOCK_STATEMENT_ROWS: StatementMovementItem[] = [
  {
    rowNumber: 1,
    date: new Date().toISOString().split('T')[0],
    docRef: 'TK-10492',
    pnr: 'BGW-IST-01',
    route: 'BGW -> IST',
    statement: 'إصدار تذكرة طيران بغداد - إسطنبول (الخطوط الجوية العراقية)',
    debit: 450000,
    credit: 0,
    runningBalance: 450000,
    currency: 'IQD',
  },
  {
    rowNumber: 2,
    date: new Date().toISOString().split('T')[0],
    docRef: 'RV-2026-004',
    pnr: '',
    route: '',
    statement: 'تسديد دفعة نقدية من رصيد الحساب باليد',
    debit: 0,
    credit: 250000,
    runningBalance: 200000,
    currency: 'IQD',
  },
];

const MOCK_STATEMENT_TOTALS = {
  totalDebit: 450000,
  totalCredit: 250000,
  finalBalance: 200000,
  openingBalance: 0,
  previousBalance: 0,
};

// Sample mock data for live receipt voucher preview (matching reference image)
const MOCK_RECEIPT_VOUCHER: VoucherPrintItem = {
  id: 'rv-demo',
  voucherNumber: 'RCV-2025-000123',
  type: 'RECEIPT',
  date: '2025-06-29',
  time: '11:00 AM',
  amount: 250000,
  currency: 'IQD',
  accountName: 'شركة النور للتجارة العامة',
  cashboxName: 'مصرف الرافدين - 123456789',
  reference: 'INV-2025-0456',
  description: 'تسديد جزء من قيمة الفاتورة رقم INV-2025-0456',
  user: 'أحمد المحاسب',
};

// Sample mock data for live payment voucher preview
const MOCK_PAYMENT_VOUCHER: VoucherPrintItem = {
  id: 'pv-demo',
  voucherNumber: 'PV-2025-000045',
  type: 'PAYMENT',
  date: '2025-06-29',
  time: '11:30 AM',
  amount: 450000,
  currency: 'IQD',
  accountName: 'شركة الخطوط الجوية العراقية',
  cashboxName: 'مصرف الرافدين - 123456789',
  reference: 'BILL-88912',
  description: 'سداد دفعة حساب مستحقات تذاكر طيران الخطوط لشهر حزيران',
  user: 'علي جعفر',
};

export const PrintSettingsPage: React.FC = () => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  const [activeDocTab, setActiveDocTab] = useState<string | null>('statement');
  const [printTab, setPrintTab] = useState<'colors' | 'fonts' | 'info' | 'toggles'>('colors');

  // Multi-doc configs state mapped by docType
  const [configs, setConfigs] = useState<Record<string, any>>({
    statement: {
      companyName: 'شركة الروضتين للسفر والسياحة',
      companyNameEn: 'Al-Rawdatan Travel & Tourism',
      subtitle: 'قسم المحاسبة والمالية — كشف حساب تفصيلي',
      subtitleEn: 'Accounting & Finance — Detailed Statement',
      commercialReg: 'س.ت: 90182471 / بغداد',
      taxNumber: 'الرقم الضريبي: 300012345600003',
      phone: '+964 770 123 4567',
      email: 'finance@alrawdatan-travel.com',
      address: 'العراق — كربلاء المقدسة / بغداد',
      primaryColor: '#059669',
      headerBgColor: '#059669',
      fontFamily: 'IBM Plex Sans Arabic',
      isTableBold: false,
      notesText: 'ملاحظة: هذا الكشف يعتبر مطبقاً وموافقاً عليه رسمياً ما لم يتم الإعتراض خلال 7 أيام من تاريخ صدوره.',
      footerText: 'شركة الروضتين للسياحة والسفر — جميع الحقوق محفوظة © 2026',
      showFinancialSummary: true,
      showOpeningBalance: true,
      showSignatures: true,
      showWatermark: true,
      showQrCode: true,
      logoWidth: 70,
      logoHeight: 70,
      fontSizes: {
        companyTitle: 17,
        subtitle: 11,
        tableHeader: 11,
        tableBody: 10,
      },
    },
    receipt_voucher: {
      ...DEFAULT_VOUCHER_CONFIG,
      primaryColor: '#059669',
      headerBgColor: '#059669',
    },
    payment_voucher: {
      ...DEFAULT_PAYMENT_VOUCHER_CONFIG,
      primaryColor: '#e11d48',
      headerBgColor: '#e11d48',
    },
    expense_report: {
      companyName: 'شركة الروضتين للسفر والسياحة',
      companyNameEn: 'Al-Rawdatan Travel & Tourism',
      subtitle: 'تقرير المصاريف التشغيلية والإدارية المعتمد',
      subtitleEn: 'Operational & Administrative Expenses Report',
      commercialReg: 'س.ت: 90182471 / بغداد',
      taxNumber: 'الرقم الضريبي: 300012345600003',
      phone: '+964 770 123 4567',
      email: 'finance@alrawdatan-travel.com',
      address: 'العراق — كربلاء المقدسة / بغداد',
      primaryColor: '#d97706', // Amber / Orange for expenses
      headerBgColor: '#d97706',
      fontFamily: 'IBM Plex Sans Arabic',
      isTableBold: false,
      notesText: 'ملاحظة: هذا التقرير يوضح المصاريف المعتمدة والمقيدة في السجلات المالية الرسمية.',
      footerText: 'شركة الروضتين للسياحة والسفر — جميع الحقوق محفوظة © 2026',
      showFinancialSummary: true,
      showSignatures: true,
      showWatermark: true,
      showQrCode: true,
      logoWidth: 70,
      logoHeight: 70,
      fontSizes: {
        companyTitle: 17,
        subtitle: 11,
        tableHeader: 11,
        tableBody: 10,
      },
    },
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isExportingTestPdf, setIsExportingTestPdf] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);

  const currentDocKey = activeDocTab || 'statement';
  const currentConfig = configs[currentDocKey] || configs.statement;

  // Load all 4 doc templates on mount
  useEffect(() => {
    const docTypes = ['statement', 'receipt_voucher', 'payment_voucher', 'expense_report'];
    docTypes.forEach((dt) => {
      fetchPrintTemplate(dt)
        .then((res) => {
          if (res && res.config) {
            setConfigs((prev) => ({
              ...prev,
              [dt]: { ...prev[dt], ...res.config },
            }));
          }
        })
        .catch(() => {});
    });

    branchesApi.getAll().then((data) => {
      if (Array.isArray(data)) setBranches(data);
    }).catch(() => {});
  }, []);

  const updateCurrentConfig = (field: string, value: any) => {
    setConfigs((prev) => {
      const active = { ...(prev[currentDocKey] || {}) };
      if (field.startsWith('fontSizes.')) {
        const fontKey = field.split('.')[1];
        active.fontSizes = {
          ...(active.fontSizes || {}),
          [fontKey]: value,
        };
      } else {
        active[field] = value;
      }
      return {
        ...prev,
        [currentDocKey]: active,
      };
    });
  };

  const handleSaveCurrentConfig = async () => {
    setIsSaving(true);
    try {
      let baseConfig = currentConfig;
      try {
        const latest = await fetchPrintTemplate(currentDocKey);
        if (latest && latest.config) {
          baseConfig = { ...latest.config, ...currentConfig };
        }
      } catch {}

      await savePrintTemplate(currentDocKey, baseConfig);

      const titles: Record<string, string> = {
        statement: isAr ? 'كشف الحساب' : 'Account Statement',
        receipt_voucher: isAr ? 'سند القبض' : 'Receipt Voucher',
        payment_voucher: isAr ? 'سند الدفع' : 'Payment Voucher',
        expense_report: isAr ? 'تقرير المصاريف' : 'Expense Report',
      };

      showSuccessNotification(
        isAr ? 'تم حفظ إعدادات الطباعة' : 'Print Settings Saved',
        isAr
          ? `تم حفظ ألوان وخطوط ونصوص قالب [${titles[currentDocKey] || currentDocKey}] بنجاح في قاعدة البيانات وتحديثها فورياً.`
          : `Print template for [${titles[currentDocKey] || currentDocKey}] saved and applied successfully.`
      );
    } catch (err) {
      showErrorNotification(
        isAr ? 'خطأ في الحفظ' : 'Save Error',
        isAr ? 'تعذر حفظ إعدادات الطباعة في قاعدة البيانات' : 'Failed to save print settings'
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Instant Client PDF test export for the active preview
  const handleExportTestPdf = async () => {
    const previewId = currentDocKey === 'statement' || currentDocKey === 'expense_report'
      ? 'printable-statement-sheet'
      : 'printable-voucher-sheet';

    const element = document.getElementById(previewId);
    if (!element) return;

    setIsExportingTestPdf(true);
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`test_template_${currentDocKey}_${Date.now()}.pdf`);
      showSuccessNotification(
        isAr ? 'تم تصدير PDF التجريبي' : 'Test PDF Exported',
        isAr ? 'تم تنزيل عينة المعاينة بصيغة PDF فورياً بجودة عالية' : 'Sample PDF exported instantly'
      );
    } catch (err: any) {
      console.error('Test export failed:', err);
      showErrorNotification(isAr ? 'خطأ في التصدير' : 'Export Failed', err.message);
    } finally {
      setIsExportingTestPdf(false);
    }
  };

  const docTitles: Record<string, { title: string; desc: string }> = {
    statement: {
      title: isAr ? 'إعدادات وتصميم كشف الحساب' : 'Account Statement Settings',
      desc: isAr ? 'تخصيص ألوان وتصميم وترويسة وتذييل كشوفات الحساب المالية' : 'Customize statement colors, headers, tables, and footers',
    },
    receipt_voucher: {
      title: isAr ? 'إعدادات وتصميم سند القبض (وصل الاستلام)' : 'Receipt Voucher Settings',
      desc: isAr ? 'تخصيص ألوان وتصميم وسندات واستلام المبالغ النقدية والتحويلات' : 'Customize receipt vouchers, amounts, Tafqeet, and signatures',
    },
    payment_voucher: {
      title: isAr ? 'إعدادات وتصميم سند الدفع والصرف' : 'Payment Voucher Settings',
      desc: isAr ? 'تخصيص سندات صرف ودفع المبالغ للشركات والموردين والخطوط' : 'Customize disbursement vouchers, amounts, Tafqeet, and signatures',
    },
    expense_report: {
      title: isAr ? 'إعدادات وتصميم تقرير المصاريف' : 'Expense Report Settings',
      desc: isAr ? 'تخصيص تقارير المصاريف التشغيلية والإدارية والعمومية' : 'Customize operational and administrative expenses print reports',
    },
  };

  return (
    <div
      className="p-4 md:p-6 space-y-4 max-w-[1500px] mx-auto select-none"
      dir={direction}
      style={{ fontFamily: isAr ? "'IBM Plex Sans Arabic', system-ui, sans-serif" : "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif" }}
    >
      {/* ── Page Header ── */}
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
                  ? 'تخصيص تصميم وقوالب طباعة المستندات: كشوفات الحساب، سندات القبض والدفع، وتقارير المصاريف'
                  : 'Customize print design for statements, receipt vouchers, payment vouchers, and expense reports'}
              </p>
            </div>
          </div>
        </div>
      </Paper>

      {/* ── Document Type Tabs ── */}
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

          {/* Unified Editor Panel for the Selected Document */}
          <div className="pt-4 space-y-4 text-xs">
            {/* Action Bar */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                  <IconPrinter size={18} className="text-[#F45A0A]" />
                  <span>{docTitles[currentDocKey]?.title}</span>
                </h3>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  {docTitles[currentDocKey]?.desc}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="light"
                  color="gray"
                  size="xs"
                  loading={isExportingTestPdf}
                  leftSection={<IconFileTypePdf size={15} />}
                  onClick={handleExportTestPdf}
                  className="font-bold"
                >
                  {isAr ? 'تصدير PDF تجريبي' : 'Test PDF'}
                </Button>

                <Button
                  color="orange"
                  size="xs"
                  loading={isSaving}
                  leftSection={<IconDeviceFloppy size={16} />}
                  onClick={handleSaveCurrentConfig}
                  className="font-extrabold px-4 shadow-xs bg-[#F45A0A] hover:bg-[#DD4F05]"
                >
                  {isAr ? 'حفظ إعدادات القالب' : 'Save Template'}
                </Button>
              </div>
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
                      className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
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
                      onClick={() => setPrintTab('info')}
                      className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                        printTab === 'info'
                          ? 'bg-[#F45A0A] text-white shadow-xs scale-[1.02]'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <IconBuilding size={14} />
                      <span>{isAr ? 'الشركة' : 'Info'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrintTab('fonts')}
                      className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
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
                      onClick={() => setPrintTab('toggles')}
                      className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                        printTab === 'toggles'
                          ? 'bg-[#F45A0A] text-white shadow-xs scale-[1.02]'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <IconAdjustments size={14} />
                      <span>{isAr ? 'خيارات' : 'Options'}</span>
                    </button>
                  </div>
                </div>

                {/* Sub-Tab 1: Colors & Badges */}
                {printTab === 'colors' && (
                  <div className="space-y-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <h4 className="font-extrabold text-xs text-slate-900 border-b pb-1.5 flex items-center gap-1.5">
                      <IconPalette size={14} className="text-[#F45A0A]" />
                      <span>{isAr ? 'تخصيص الألوان والشارات' : 'Colors & Accents'}</span>
                    </h4>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        {isAr ? 'اللون الرئيسي وهوية المستند' : 'Primary Accent Color'}
                      </label>
                      <ColorInput
                        value={currentConfig.primaryColor || '#059669'}
                        onChange={(v) => updateCurrentConfig('primaryColor', v)}
                        size="xs"
                        format="hex"
                        swatches={['#059669', '#0284c7', '#7c3aed', '#e11d48', '#d97706', '#0f172a', '#F45A0A']}
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        {isAr ? 'لون شارة الترويسة والعنوان' : 'Header Badge Color'}
                      </label>
                      <ColorInput
                        value={currentConfig.headerBgColor || currentConfig.primaryColor || '#059669'}
                        onChange={(v) => updateCurrentConfig('headerBgColor', v)}
                        size="xs"
                        format="hex"
                        swatches={['#059669', '#0284c7', '#7c3aed', '#e11d48', '#d97706', '#0f172a', '#F45A0A']}
                      />
                    </div>
                  </div>
                )}

                {/* Sub-Tab 2: Company Info & Texts */}
                {printTab === 'info' && (
                  <div className="space-y-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <h4 className="font-extrabold text-xs text-slate-900 border-b pb-1.5 flex items-center gap-1.5">
                      <IconBuilding size={14} className="text-[#F45A0A]" />
                      <span>{isAr ? 'بيانات الترويسة والتذييل' : 'Company & Header Info'}</span>
                    </h4>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        {isAr ? 'اسم الشركة (بالعربية)' : 'Company Name (Arabic)'}
                      </label>
                      <TextInput
                        size="xs"
                        value={currentConfig.companyName || ''}
                        onChange={(e) => updateCurrentConfig('companyName', e.target.value)}
                        placeholder="شركة الروضتين للسفر والسياحة"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        {isAr ? 'اسم الشركة (بالإنجليزية)' : 'Company Name (English)'}
                      </label>
                      <TextInput
                        size="xs"
                        value={currentConfig.companyNameEn || ''}
                        onChange={(e) => updateCurrentConfig('companyNameEn', e.target.value)}
                        placeholder="Al-Rawdatan Travel & Tourism"
                        dir="ltr"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        {isAr ? 'العنوان الفرعي / الوصف' : 'Subtitle'}
                      </label>
                      <TextInput
                        size="xs"
                        value={currentConfig.subtitle || ''}
                        onChange={(e) => updateCurrentConfig('subtitle', e.target.value)}
                        placeholder="قسم المحاسبة والمالية"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-700 block mb-1">
                          {isAr ? 'السجل التجاري' : 'Commercial Reg'}
                        </label>
                        <TextInput
                          size="xs"
                          value={currentConfig.commercialReg || ''}
                          onChange={(e) => updateCurrentConfig('commercialReg', e.target.value)}
                          placeholder="س.ت: 90182471"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-700 block mb-1">
                          {isAr ? 'الرقم الضريبي' : 'Tax Number'}
                        </label>
                        <TextInput
                          size="xs"
                          value={currentConfig.taxNumber || ''}
                          onChange={(e) => updateCurrentConfig('taxNumber', e.target.value)}
                          placeholder="300012345600003"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-700 block mb-1">
                          {isAr ? 'الهاتف' : 'Phone'}
                        </label>
                        <TextInput
                          size="xs"
                          value={currentConfig.phone || ''}
                          onChange={(e) => updateCurrentConfig('phone', e.target.value)}
                          placeholder="+964 770 123 4567"
                          dir="ltr"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-700 block mb-1">
                          {isAr ? 'البريد' : 'Email'}
                        </label>
                        <TextInput
                          size="xs"
                          value={currentConfig.email || ''}
                          onChange={(e) => updateCurrentConfig('email', e.target.value)}
                          placeholder="finance@alrawdatan-travel.com"
                          dir="ltr"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        {isAr ? 'العنوان' : 'Address'}
                      </label>
                      <TextInput
                        size="xs"
                        value={currentConfig.address || ''}
                        onChange={(e) => updateCurrentConfig('address', e.target.value)}
                        placeholder="العراق — كربلاء المقدسة / بغداد"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        {isAr ? 'نص التذييل وحقوق الحفظ' : 'Footer Copyright Text'}
                      </label>
                      <TextInput
                        size="xs"
                        value={currentConfig.footerText || ''}
                        onChange={(e) => updateCurrentConfig('footerText', e.target.value)}
                        placeholder="شركة الروضتين للسياحة — جميع الحقوق محفوظة © 2026"
                      />
                    </div>
                  </div>
                )}

                {/* Sub-Tab 3: Fonts & Typography */}
                {printTab === 'fonts' && (
                  <div className="space-y-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <h4 className="font-extrabold text-xs text-slate-900 border-b pb-1.5 flex items-center gap-1.5">
                      <IconTypography size={14} className="text-[#F45A0A]" />
                      <span>{isAr ? 'أنواع وأحجام الخطوط' : 'Typography & Font Sizes'}</span>
                    </h4>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        {isAr ? 'نوع الخط المعتمد للطباعة' : 'Font Family'}
                      </label>
                      <Select
                        size="xs"
                        value={currentConfig.fontFamily || 'IBM Plex Sans Arabic'}
                        onChange={(v) => updateCurrentConfig('fontFamily', v || 'IBM Plex Sans Arabic')}
                        data={[
                          { value: 'IBM Plex Sans Arabic', label: 'IBM Plex Sans Arabic (رسمي ومعتمد)' },
                          { value: 'Tajawal', label: 'Tajawal (تجوال عصري)' },
                          { value: 'Cairo', label: 'Cairo (القاهرة واضح)' },
                          { value: 'system-ui', label: 'System Default' },
                        ]}
                      />
                    </div>

                    <div className="space-y-2 pt-1 border-t border-slate-100">
                      <div>
                        <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                          <span>{isAr ? 'حجم عنوان الشركة:' : 'Company Title Size:'}</span>
                          <span className="font-mono">{currentConfig.fontSizes?.companyTitle || 16}px</span>
                        </div>
                        <Slider
                          min={13}
                          max={24}
                          step={1}
                          size="xs"
                          color="orange"
                          value={currentConfig.fontSizes?.companyTitle || 16}
                          onChange={(v) => updateCurrentConfig('fontSizes.companyTitle', v)}
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                          <span>{isAr ? 'حجم النص والبيانات:' : 'Body Font Size:'}</span>
                          <span className="font-mono">{currentConfig.fontSizes?.tableBody || currentConfig.fontSizes?.body || 10}px</span>
                        </div>
                        <Slider
                          min={8}
                          max={14}
                          step={1}
                          size="xs"
                          color="orange"
                          value={currentConfig.fontSizes?.tableBody || currentConfig.fontSizes?.body || 10}
                          onChange={(v) => {
                            updateCurrentConfig('fontSizes.tableBody', v);
                            updateCurrentConfig('fontSizes.body', v);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-Tab 4: Toggles & Signatures */}
                {printTab === 'toggles' && (
                  <div className="space-y-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <h4 className="font-extrabold text-xs text-slate-900 border-b pb-1.5 flex items-center gap-1.5">
                      <IconAdjustments size={14} className="text-[#F45A0A]" />
                      <span>{isAr ? 'خيارات العرض والعلامة المائية' : 'Toggles & Signatures'}</span>
                    </h4>

                    <div className="space-y-2.5">
                      <Switch
                        size="xs"
                        color="orange"
                        label={isAr ? 'إظهار العلامة المائية الخلفية' : 'Show Watermark'}
                        checked={currentConfig.showWatermark !== false}
                        onChange={(e) => updateCurrentConfig('showWatermark', e.currentTarget.checked)}
                      />

                      <Switch
                        size="xs"
                        color="orange"
                        label={isAr ? 'إظهار رمز QR للتوثيق' : 'Show Verification QR Code'}
                        checked={currentConfig.showQrCode !== false}
                        onChange={(e) => updateCurrentConfig('showQrCode', e.currentTarget.checked)}
                      />

                      <Switch
                        size="xs"
                        color="orange"
                        label={isAr ? 'إظهار قسم التواقيع الرسمية' : 'Show Signatures'}
                        checked={currentConfig.showSignatures !== false}
                        onChange={(e) => updateCurrentConfig('showSignatures', e.currentTarget.checked)}
                      />

                      <Switch
                        size="xs"
                        color="orange"
                        label={isAr ? 'إظهار التفقيط (المبلغ كتابةً)' : 'Show Amount in Words (Tafqeet)'}
                        checked={currentConfig.showTafqeet !== false}
                        onChange={(e) => updateCurrentConfig('showTafqeet', e.currentTarget.checked)}
                      />
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div>
                        <label className="text-[10px] font-bold text-slate-700 block mb-1">
                          {isAr ? 'مسمى توقيع المدير العام' : 'Manager Signature Title'}
                        </label>
                        <TextInput
                          size="xs"
                          value={currentConfig.managerSignTitle || ''}
                          onChange={(e) => updateCurrentConfig('managerSignTitle', e.target.value)}
                          placeholder="توقيع المدير العام / المعتمد"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-700 block mb-1">
                          {isAr ? 'مسمى توقيع المحاسب / أمين الصندوق' : 'Accountant Signature Title'}
                        </label>
                        <TextInput
                          size="xs"
                          value={currentConfig.accountantSignTitle || ''}
                          onChange={(e) => updateCurrentConfig('accountantSignTitle', e.target.value)}
                          placeholder="توقيع المحاسب / الصندوق"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-700 block mb-1">
                          {isAr ? 'مسمى توقيع المستلم / الدافع' : 'Receiver / Payer Signature Title'}
                        </label>
                        <TextInput
                          size="xs"
                          value={currentConfig.receiverSignTitle || ''}
                          onChange={(e) => updateCurrentConfig('receiverSignTitle', e.target.value)}
                          placeholder="توقيع المستلم / الدافع"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-700 block mb-1">
                          {isAr ? 'نص الملاحظات والشروط' : 'Notes & Conditions Text'}
                        </label>
                        <TextInput
                          size="xs"
                          value={currentConfig.notesText || ''}
                          onChange={(e) => updateCurrentConfig('notesText', e.target.value)}
                          placeholder="ملاحظة: هذا المستند معتمد رسمياً..."
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Live Interactive Preview (8 cols) */}
              <div className="lg:col-span-8 space-y-2">
                <div className="flex items-center justify-between bg-slate-100/70 p-2.5 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2">
                    <IconEye size={16} className="text-slate-600" />
                    <span className="font-extrabold text-xs text-slate-800">
                      {isAr ? 'المعاينة الحية الفورية للمستند' : 'Live Interactive Document Preview'}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500 font-mono">
                    A4 Portrait Standard
                  </span>
                </div>

                <div className="bg-slate-200/60 p-3 rounded-xl border border-slate-300/80 overflow-x-auto flex justify-center shadow-inner min-h-[500px]">
                  {currentDocKey === 'statement' ? (
                    <PrintableAccountStatementSheet
                      accountName="شركة الأفق للسياحة والخدمات المحدودة"
                      accountCode="110204"
                      startDate="2026-02-01"
                      endDate="2026-02-28"
                      rows={MOCK_STATEMENT_ROWS}
                      totals={MOCK_STATEMENT_TOTALS}
                      config={currentConfig}
                      lang="ar"
                    />
                  ) : currentDocKey === 'receipt_voucher' ? (
                    <PrintableVoucherSheet
                      voucher={MOCK_RECEIPT_VOUCHER}
                      config={currentConfig}
                      lang="ar"
                    />
                  ) : currentDocKey === 'payment_voucher' ? (
                    <PrintableVoucherSheet
                      voucher={MOCK_PAYMENT_VOUCHER}
                      config={currentConfig}
                      lang="ar"
                    />
                  ) : (
                    <PrintableAccountStatementSheet
                      accountName="تقرير المصاريف العمومية والإدارية"
                      accountCode="510001"
                      startDate="2026-02-01"
                      endDate="2026-02-28"
                      rows={MOCK_STATEMENT_ROWS}
                      totals={MOCK_STATEMENT_TOTALS}
                      config={currentConfig}
                      lang="ar"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </Tabs>
      </Paper>
    </div>
  );
};

export default PrintSettingsPage;
