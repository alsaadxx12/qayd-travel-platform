import React, { useState, useEffect, useMemo } from 'react';
import { Paper, Button, TextInput, Select, ColorInput, Slider, Switch, Tabs, Badge } from '@mantine/core';
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
  IconPhoto,
  IconUpload,
  IconSparkles,
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
    date: '2026/08/01',
    docRef: 'OB-2026',
    pnr: '',
    route: '',
    statement: 'رصيد افتتاحي مرحل من الدورة المالية السابقة',
    debit: 0,
    credit: 0,
    runningBalance: 0,
    currency: 'IQD',
  },
  {
    rowNumber: 2,
    date: '2026/08/02',
    docRef: 'INV-01005',
    pnr: 'PRMCK',
    route: 'BGW ➔ MHD',
    statement: 'مبيعات تذاكر طيران خطوط كاسبيان | المسافرين (3): Mr SALAM ALSHAMOOSI',
    debit: 1250000,
    credit: 0,
    runningBalance: 1250000,
    currency: 'IQD',
  },
  {
    rowNumber: 3,
    date: '2026/08/04',
    docRef: 'RCV-0042',
    pnr: '',
    route: '',
    statement: 'سند قبض نقدي دفعة أولى لحساب حجز التذاكر',
    debit: 0,
    credit: 500000,
    runningBalance: 750000,
    currency: 'IQD',
  },
];

const MOCK_STATEMENT_TOTALS = {
  totalDebit: 1250000,
  totalCredit: 500000,
  finalBalance: 750000,
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
  const [printTab, setPrintTab] = useState<'colors' | 'info' | 'fonts' | 'toggles'>('colors');

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
      titleAccentColor: '#059669',
      headerBgColor: '#059669',
      tableHeaderBgColor: '#059669',
      tableHeaderTextColor: '#ffffff',
      tableZebraBgColor: '#f8fafc',
      tableBorderColor: '#e2e8f0',
      tableTextColor: '#0f172a',
      summaryDebitTextColor: '#059669',
      summaryCreditTextColor: '#e11d48',
      summaryBalanceBg: '#059669',
      summaryBalanceTextColor: '#ffffff',
      watermarkColor: '#059669',
      footerTextColor: '#64748b',
      fontFamily: 'IBM Plex Sans Arabic',
      isTableBold: false,
      notesText: 'ملاحظة: هذا الكشف يعتبر مطبقاً وموافقاً عليه رسمياً ما لم يتم الإعتراض خلال 7 أيام من تاريخ صدوره.',
      footerText: 'شركة الروضتين للسياحة والسفر — جميع الحقوق محفوظة © 2026',
      showFinancialSummary: true,
      showOpeningBalance: true,
      showSignatures: true,
      showWatermark: true,
      watermarkText: 'كشف حساب رسمي معتمد',
      showQrCode: true,
      logoWidth: 80,
      logoHeight: 50,
      logoBorderRadius: 6,
      fontSizes: {
        companyTitle: 17,
        subtitle: 11,
        tableHeader: 11,
        tableBody: 10,
      },
    },
    receipt_voucher: {
      ...DEFAULT_VOUCHER_CONFIG,
      primaryColor: '#0066FF',
      headerBgColor: '#0066FF',
      fieldBgColor: '#F0F7FF',
      fieldBorderColor: '#BFDBFE',
      amountTextColor: '#0f172a',
      tafqeetTextColor: '#0066FF',
      summaryBorderColor: '#0066FF',
      summaryTotalColor: '#0066FF',
      statusColor: '#059669',
      watermarkColor: '#0066FF',
    },
    payment_voucher: {
      ...DEFAULT_PAYMENT_VOUCHER_CONFIG,
      primaryColor: '#0066FF',
      headerBgColor: '#0066FF',
      fieldBgColor: '#F0F7FF',
      fieldBorderColor: '#BFDBFE',
      amountTextColor: '#0f172a',
      tafqeetTextColor: '#0066FF',
      summaryBorderColor: '#0066FF',
      summaryTotalColor: '#0066FF',
      statusColor: '#059669',
      watermarkColor: '#0066FF',
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
      primaryColor: '#d97706',
      titleAccentColor: '#d97706',
      headerBgColor: '#d97706',
      tableHeaderBgColor: '#d97706',
      tableHeaderTextColor: '#ffffff',
      tableZebraBgColor: '#fffbeb',
      tableBorderColor: '#fde68a',
      fontFamily: 'IBM Plex Sans Arabic',
      isTableBold: false,
      notesText: 'ملاحظة: هذا التقرير يوضح المصاريف المعتمدة والمقيدة في السجلات المالية الرسمية.',
      footerText: 'شركة الروضتين للسياحة والسفر — جميع الحقوق محفوظة © 2026',
      showFinancialSummary: true,
      showSignatures: true,
      showWatermark: true,
      watermarkText: 'تقرير مصاريف رسمي معتمد',
      showQrCode: true,
      logoWidth: 80,
      logoHeight: 50,
      logoBorderRadius: 6,
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
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);

  const currentDocKey = activeDocTab || 'statement';
  const currentConfig = configs[currentDocKey] || configs.statement;

  // Active logo lookup (from current template config or active branch logo)
  const activeLogoUrl = useMemo(() => {
    return currentConfig?.logoUrl || branches[0]?.logo || (branches[0] as any)?.logoUrl || '';
  }, [currentConfig, branches]);

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showErrorNotification(isAr ? 'ملف غير صالح' : 'Invalid File', isAr ? 'يرجى اختيار صورة صالحة' : 'Please select an image file');
      return;
    }

    setIsUploadingBanner(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        try {
          const res = await branchesApi.uploadLogo(`header_banner_${Date.now()}_${file.name}`, base64);
          if (res && res.url) {
            updateCurrentConfig('headerImageUrl', res.url);
            updateCurrentConfig('useFullHeaderImage', true);
            showSuccessNotification(
              isAr ? 'تم رفع الترويسة بنجاح' : 'Header Uploaded',
              isAr ? 'تم رفع صورة الترويسة وتعيينها فورياً' : 'Header banner uploaded successfully'
            );
          }
        } catch (err: any) {
          showErrorNotification(isAr ? 'خطأ في الرفع' : 'Upload Failed', err?.message || 'Failed to upload header');
        } finally {
          setIsUploadingBanner(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setIsUploadingBanner(false);
    }
  };

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

      const toSave = {
        ...baseConfig,
        logoUrl: activeLogoUrl || baseConfig.logoUrl || '',
      };

      await savePrintTemplate(currentDocKey, toSave);

      const titles: Record<string, string> = {
        statement: isAr ? 'كشف الحساب' : 'Account Statement',
        receipt_voucher: isAr ? 'سند القبض' : 'Receipt Voucher',
        payment_voucher: isAr ? 'سند الدفع' : 'Payment Voucher',
        expense_report: isAr ? 'تقرير المصاريف' : 'Expense Report',
      };

      showSuccessNotification(
        isAr ? 'تم حفظ إعدادات الطباعة' : 'Print Settings Saved',
        isAr
          ? `تم حفظ ألوان وخطوط وشعار ونصوص قالب [${titles[currentDocKey] || currentDocKey}] بنجاح في قاعدة البيانات وتحديثها فورياً.`
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
      desc: isAr ? 'تخصيص ألوان وتصميم وترويسة وتذييل وجداول كشوفات الحساب' : 'Customize statement colors, headers, tables, and footers',
    },
    receipt_voucher: {
      title: isAr ? 'إعدادات وتصميم سند القبض (وصل الاستلام)' : 'Receipt Voucher Settings',
      desc: isAr ? 'تخصيص ألوان وتصميم وبطاقات سندات واستلام المبالغ النقدية والتحويلات' : 'Customize receipt vouchers, amounts, Tafqeet, and signatures',
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
                {isAr ? 'إعدادات الطباعة والتصاميم الرسمية' : 'Print & Template Settings'}
              </h1>
              <p className="text-[11px] text-slate-500 font-bold mt-0.5">
                {isAr
                  ? 'تخصيص كامل للألوان والشعار والخطوط والترويسة لكشوفات الحساب، سندات القبض والدفع، وتقارير المصاريف'
                  : 'Full customization of colors, logo, fonts, and headers for statements, vouchers, and reports'}
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

                {/* ══════════════════════════════════════════════════════
                    Sub-Tab 1: Rich Color Controls (Expanded for each Doc)
                   ══════════════════════════════════════════════════════ */}
                {printTab === 'colors' && (
                  <div className="space-y-3.5 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <h4 className="font-extrabold text-xs text-slate-900 border-b pb-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <IconPalette size={14} className="text-[#F45A0A]" />
                        <span>{isAr ? 'تخصيص الألوان والتدرجات الكاملة' : 'Full Color Customization'}</span>
                      </div>
                      <Badge size="xs" color="orange" variant="light">
                        {currentDocKey}
                      </Badge>
                    </h4>

                    {/* Statement Colors */}
                    {currentDocKey === 'statement' && (
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-700 block mb-1">
                            {isAr ? 'اللون الرئيسي وهوية الكشف' : 'Primary Theme Color'}
                          </label>
                          <ColorInput
                            value={currentConfig.primaryColor || '#059669'}
                            onChange={(v) => {
                              updateCurrentConfig('primaryColor', v);
                              updateCurrentConfig('titleAccentColor', v);
                            }}
                            size="xs"
                            format="hex"
                            swatches={['#059669', '#0284c7', '#0066FF', '#7c3aed', '#e11d48', '#d97706', '#0f172a', '#F45A0A']}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-slate-700 block mb-1">
                              {isAr ? 'خلفية ترويسة الجدول' : 'Table Header Bg'}
                            </label>
                            <ColorInput
                              value={currentConfig.tableHeaderBgColor || currentConfig.primaryColor || '#059669'}
                              onChange={(v) => updateCurrentConfig('tableHeaderBgColor', v)}
                              size="xs"
                              format="hex"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-700 block mb-1">
                              {isAr ? 'خط ترويسة الجدول' : 'Table Header Text'}
                            </label>
                            <ColorInput
                              value={currentConfig.tableHeaderTextColor || '#ffffff'}
                              onChange={(v) => updateCurrentConfig('tableHeaderTextColor', v)}
                              size="xs"
                              format="hex"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-slate-700 block mb-1">
                              {isAr ? 'خلفية الأسطر الفردية (Zebra)' : 'Row Alternate Bg'}
                            </label>
                            <ColorInput
                              value={currentConfig.tableZebraBgColor || '#f8fafc'}
                              onChange={(v) => updateCurrentConfig('tableZebraBgColor', v)}
                              size="xs"
                              format="hex"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-700 block mb-1">
                              {isAr ? 'إطار وحدود الجدول' : 'Table Border Color'}
                            </label>
                            <ColorInput
                              value={currentConfig.tableBorderColor || '#e2e8f0'}
                              onChange={(v) => updateCurrentConfig('tableBorderColor', v)}
                              size="xs"
                              format="hex"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-slate-700 block mb-1">
                              {isAr ? 'لون المدين (+)' : 'Debit Color (+)'}
                            </label>
                            <ColorInput
                              value={currentConfig.summaryDebitTextColor || '#059669'}
                              onChange={(v) => updateCurrentConfig('summaryDebitTextColor', v)}
                              size="xs"
                              format="hex"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-700 block mb-1">
                              {isAr ? 'لون الدائن (-)' : 'Credit Color (-)'}
                            </label>
                            <ColorInput
                              value={currentConfig.summaryCreditTextColor || '#e11d48'}
                              onChange={(v) => updateCurrentConfig('summaryCreditTextColor', v)}
                              size="xs"
                              format="hex"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-slate-700 block mb-1">
                              {isAr ? 'خلفية بطاقة الرصيد' : 'Balance Card Bg'}
                            </label>
                            <ColorInput
                              value={currentConfig.summaryBalanceBg || currentConfig.primaryColor || '#059669'}
                              onChange={(v) => updateCurrentConfig('summaryBalanceBg', v)}
                              size="xs"
                              format="hex"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-700 block mb-1">
                              {isAr ? 'خط صافي الرصيد' : 'Balance Text Color'}
                            </label>
                            <ColorInput
                              value={currentConfig.summaryBalanceTextColor || '#ffffff'}
                              onChange={(v) => updateCurrentConfig('summaryBalanceTextColor', v)}
                              size="xs"
                              format="hex"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Receipt Voucher & Payment Voucher Colors */}
                    {(currentDocKey === 'receipt_voucher' || currentDocKey === 'payment_voucher') && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-slate-700 block mb-1">
                              {isAr ? 'لون الإطارات والخطوط' : 'Primary Borders'}
                            </label>
                            <ColorInput
                              value={currentConfig.primaryColor || '#0066FF'}
                              onChange={(v) => updateCurrentConfig('primaryColor', v)}
                              size="xs"
                              format="hex"
                              swatches={['#0066FF', '#059669', '#e11d48', '#7c3aed', '#d97706', '#0f172a', '#F45A0A']}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-700 block mb-1">
                              {isAr ? 'لون الشارة العلوية' : 'Pill Badges Bg'}
                            </label>
                            <ColorInput
                              value={currentConfig.headerBgColor || currentConfig.primaryColor || '#0066FF'}
                              onChange={(v) => updateCurrentConfig('headerBgColor', v)}
                              size="xs"
                              format="hex"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-slate-700 block mb-1">
                              {isAr ? 'خلفية صناديق البيانات' : 'Field Box Bg'}
                            </label>
                            <ColorInput
                              value={currentConfig.fieldBgColor || '#F0F7FF'}
                              onChange={(v) => updateCurrentConfig('fieldBgColor', v)}
                              size="xs"
                              format="hex"
                              swatches={['#F0F7FF', '#f8fafc', '#ecfdf5', '#fff1f2', '#fffbeb', '#ffffff']}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-700 block mb-1">
                              {isAr ? 'إطار صناديق البيانات' : 'Field Box Border'}
                            </label>
                            <ColorInput
                              value={currentConfig.fieldBorderColor || '#BFDBFE'}
                              onChange={(v) => updateCurrentConfig('fieldBorderColor', v)}
                              size="xs"
                              format="hex"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-slate-700 block mb-1">
                              {isAr ? 'خط المبلغ الرقمي' : 'Amount Number Color'}
                            </label>
                            <ColorInput
                              value={currentConfig.amountTextColor || '#0f172a'}
                              onChange={(v) => updateCurrentConfig('amountTextColor', v)}
                              size="xs"
                              format="hex"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-700 block mb-1">
                              {isAr ? 'خط التفقيط (كتابة)' : 'Tafqeet Text Color'}
                            </label>
                            <ColorInput
                              value={currentConfig.tafqeetTextColor || currentConfig.primaryColor || '#0066FF'}
                              onChange={(v) => updateCurrentConfig('tafqeetTextColor', v)}
                              size="xs"
                              format="hex"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-slate-700 block mb-1">
                              {isAr ? 'إجمالي ملخص السند' : 'Summary Total Color'}
                            </label>
                            <ColorInput
                              value={currentConfig.summaryTotalColor || currentConfig.primaryColor || '#0066FF'}
                              onChange={(v) => updateCurrentConfig('summaryTotalColor', v)}
                              size="xs"
                              format="hex"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-700 block mb-1">
                              {isAr ? 'لون شارة الحالة' : 'Status Badge Color'}
                            </label>
                            <ColorInput
                              value={currentConfig.statusColor || '#059669'}
                              onChange={(v) => updateCurrentConfig('statusColor', v)}
                              size="xs"
                              format="hex"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Expense Report Colors */}
                    {currentDocKey === 'expense_report' && (
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-700 block mb-1">
                            {isAr ? 'اللون الرئيسي للتقرير' : 'Report Primary Color'}
                          </label>
                          <ColorInput
                            value={currentConfig.primaryColor || '#d97706'}
                            onChange={(v) => updateCurrentConfig('primaryColor', v)}
                            size="xs"
                            format="hex"
                            swatches={['#d97706', '#059669', '#0284c7', '#7c3aed', '#e11d48', '#0f172a', '#F45A0A']}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-slate-700 block mb-1">
                              {isAr ? 'خلفية ترويسة الجدول' : 'Table Header Bg'}
                            </label>
                            <ColorInput
                              value={currentConfig.tableHeaderBgColor || '#d97706'}
                              onChange={(v) => updateCurrentConfig('tableHeaderBgColor', v)}
                              size="xs"
                              format="hex"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-700 block mb-1">
                              {isAr ? 'خط ترويسة الجدول' : 'Table Header Text'}
                            </label>
                            <ColorInput
                              value={currentConfig.tableHeaderTextColor || '#ffffff'}
                              onChange={(v) => updateCurrentConfig('tableHeaderTextColor', v)}
                              size="xs"
                              format="hex"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ══════════════════════════════════════════════════════
                    Sub-Tab 2: Company Info & Logo Controls
                   ══════════════════════════════════════════════════════ */}
                {printTab === 'info' && (
                  <div className="space-y-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <h4 className="font-extrabold text-xs text-slate-900 border-b pb-1.5 flex items-center gap-1.5">
                      <IconBuilding size={14} className="text-[#F45A0A]" />
                      <span>{isAr ? 'بيانات الشركة والترويسة والشعار' : 'Company & Logo Settings'}</span>
                    </h4>

                    {/* Full Header Banner Section (صورة الترويسة الكاملة) */}
                    <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs">
                          <IconPhoto size={16} className="text-blue-600" />
                          <span>{isAr ? 'صورة الترويسة الكاملة (Header Banner)' : 'Full Header Banner'}</span>
                        </span>
                        <Switch
                          size="xs"
                          color="blue"
                          label={isAr ? 'تفعيل' : 'Enable'}
                          checked={currentConfig.useFullHeaderImage === true}
                          onChange={(e) => updateCurrentConfig('useFullHeaderImage', e.currentTarget.checked)}
                        />
                      </div>

                      {/* Visual Header Banner Preview */}
                      <div className="h-16 bg-white rounded-lg border border-dashed border-blue-300 flex items-center justify-center p-1 overflow-hidden">
                        {currentConfig.headerImageUrl ? (
                          <img
                            src={currentConfig.headerImageUrl}
                            alt="Header Banner Preview"
                            style={{
                              maxHeight: `${currentConfig.headerImageHeight || 55}px`,
                              width: '100%',
                              objectFit: 'contain',
                            }}
                          />
                        ) : (
                          <span className="text-[10px] text-blue-500 font-bold">
                            {isAr ? 'لم يتم تعيين صورة ترويسة كاملة بعد' : 'No full header banner set'}
                          </span>
                        )}
                      </div>

                      {/* Upload & Preset Actions */}
                      <div className="flex items-center gap-2">
                        <label className="flex-1">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleBannerUpload}
                          />
                          <Button
                            component="span"
                            size="xs"
                            variant="light"
                            color="blue"
                            fullWidth
                            loading={isUploadingBanner}
                            leftSection={<IconUpload size={14} />}
                            className="font-bold cursor-pointer"
                          >
                            {isAr ? 'رفع صورة ترويسة جديدة ☁️' : 'Upload Banner Image'}
                          </Button>
                        </label>

                        <Button
                          size="xs"
                          variant="outline"
                          color="blue"
                          onClick={() => {
                            updateCurrentConfig(
                              'headerImageUrl',
                              'https://mgsgslrjbbjwkhhmdype.supabase.co/storage/v1/object/public/branch-images/voucher_header_banner_1788007955181.png'
                            );
                            updateCurrentConfig('useFullHeaderImage', true);
                            showSuccessNotification(
                              isAr ? 'تم تعيين الترويسة المعتمدة' : 'Official Banner Set',
                              isAr ? 'تم تعيين ترويسة شركة الروضتين المعتمدة' : 'Official RODA 10 banner applied'
                            );
                          }}
                          className="font-bold text-[10px]"
                        >
                          {isAr ? 'ترويسة الروضتين ⚡' : 'RODA 10 Preset'}
                        </Button>
                      </div>

                      {/* Header Banner Height Slider */}
                      {currentConfig.useFullHeaderImage && (
                        <div>
                          <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                            <span>{isAr ? 'ارتفاع الترويسة الكاملة:' : 'Full Banner Height:'}</span>
                            <span className="font-mono text-blue-600">{currentConfig.headerImageHeight || 115}px</span>
                          </div>
                          <Slider
                            size="xs"
                            color="blue"
                            min={40}
                            max={240}
                            step={5}
                            value={currentConfig.headerImageHeight || 115}
                            onChange={(v) => updateCurrentConfig('headerImageHeight', v)}
                          />
                        </div>
                      )}
                    </div>

                    {/* Logo Preview & Size Sliders */}
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                      <span className="font-extrabold text-slate-900 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5">
                          <IconPhoto size={15} className="text-[#F45A0A]" />
                          <span>{isAr ? 'شعار الشركة (اللوجو)' : 'Company Logo'}</span>
                        </span>
                        {activeLogoUrl && (
                          <Badge size="xs" color="emerald" variant="light">
                            {isAr ? 'شعار معتمد ✓' : 'Active Logo ✓'}
                          </Badge>
                        )}
                      </span>

                      {/* Visual Logo Preview */}
                      <div className="h-14 bg-white rounded-lg border border-dashed border-slate-300 flex items-center justify-center p-1.5 overflow-hidden">
                        {activeLogoUrl ? (
                          <img
                            src={activeLogoUrl}
                            alt="Logo"
                            style={{
                              maxHeight: `${currentConfig.logoHeight || 50}px`,
                              maxWidth: `${currentConfig.logoWidth || 140}px`,
                              borderRadius: `${currentConfig.logoBorderRadius || 6}px`,
                              objectFit: 'contain',
                            }}
                          />
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold">
                            {isAr ? 'لا يوجد شعار مرفوع — اضبط الشعار من إعدادات الفروع' : 'No logo uploaded'}
                          </span>
                        )}
                      </div>

                      {/* Logo Width Slider */}
                      <div>
                        <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                          <span>{isAr ? 'عرض الشعار:' : 'Logo Width:'}</span>
                          <span className="font-mono text-[#F45A0A]">{currentConfig.logoWidth || 140}px</span>
                        </div>
                        <Slider
                          size="xs"
                          color="orange"
                          min={40}
                          max={220}
                          step={5}
                          value={currentConfig.logoWidth || 140}
                          onChange={(v) => updateCurrentConfig('logoWidth', v)}
                        />
                      </div>

                      {/* Logo Height Slider */}
                      <div>
                        <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                          <span>{isAr ? 'ارتفاع الشعار:' : 'Logo Height:'}</span>
                          <span className="font-mono text-[#F45A0A]">{currentConfig.logoHeight || 50}px</span>
                        </div>
                        <Slider
                          size="xs"
                          color="orange"
                          min={20}
                          max={120}
                          step={5}
                          value={currentConfig.logoHeight || 50}
                          onChange={(v) => updateCurrentConfig('logoHeight', v)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        {isAr ? 'اسم الشركة (بالعربية)' : 'Company Name (Arabic)'}
                      </label>
                      <TextInput
                        size="xs"
                        value={currentConfig.companyName || ''}
                        onChange={(e) => updateCurrentConfig('companyName', e.target.value)}
                        placeholder="رودا 10 للبرمجيات والحلول المحاسبية"
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
                        placeholder="RODA 10 Software & Solutions"
                        dir="ltr"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        {isAr ? 'العنوان' : 'Address'}
                      </label>
                      <TextInput
                        size="xs"
                        value={currentConfig.address || ''}
                        onChange={(e) => updateCurrentConfig('address', e.target.value)}
                        placeholder="العراق - بغداد - المنصور - شارع الصناعة"
                      />
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
                          placeholder="7714569870"
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
                          placeholder="info@roda10.com"
                          dir="ltr"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        {isAr ? 'الموقع الإلكتروني' : 'Website'}
                      </label>
                      <TextInput
                        size="xs"
                        value={currentConfig.website || ''}
                        onChange={(e) => updateCurrentConfig('website', e.target.value)}
                        placeholder="www.roda10.com"
                        dir="ltr"
                      />
                    </div>
                  </div>
                )}

                {/* ══════════════════════════════════════════════════════
                    Sub-Tab 3: Fonts & Typography
                   ══════════════════════════════════════════════════════ */}
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
                          min={12}
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
                          <span>{isAr ? 'حجم عنوان المستند:' : 'Doc Title Size:'}</span>
                          <span className="font-mono">{currentConfig.fontSizes?.docTitle || 24}px</span>
                        </div>
                        <Slider
                          min={16}
                          max={32}
                          step={1}
                          size="xs"
                          color="orange"
                          value={currentConfig.fontSizes?.docTitle || 24}
                          onChange={(v) => updateCurrentConfig('fontSizes.docTitle', v)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ══════════════════════════════════════════════════════
                    Sub-Tab 4: Toggles, Watermark & Signatures
                   ══════════════════════════════════════════════════════ */}
                {printTab === 'toggles' && (
                  <div className="space-y-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <h4 className="font-extrabold text-xs text-slate-900 border-b pb-1.5 flex items-center gap-1.5">
                      <IconAdjustments size={14} className="text-[#F45A0A]" />
                      <span>{isAr ? 'خيارات العرض والعلامة المائية والتواقيع' : 'Toggles & Signatures'}</span>
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
                          {isAr ? 'نص العلامة المائية' : 'Watermark Text'}
                        </label>
                        <TextInput
                          size="xs"
                          value={currentConfig.watermarkText || ''}
                          onChange={(e) => updateCurrentConfig('watermarkText', e.target.value)}
                          placeholder="نسخة رسمية"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-700 block mb-1">
                          {isAr ? 'العبارة الترحيبية والفاصل' : 'Thank You Text'}
                        </label>
                        <TextInput
                          size="xs"
                          value={currentConfig.thankYouText || ''}
                          onChange={(e) => updateCurrentConfig('thankYouText', e.target.value)}
                          placeholder="نشكر لكم ثقتكم ونتطلع إلى المزيد من التعاملات"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-700 block mb-1">
                          {isAr ? 'مسمى توقيع الدافع / المسلّم للمبلغ' : 'Payer Signature Title'}
                        </label>
                        <TextInput
                          size="xs"
                          value={currentConfig.payerSignTitle || ''}
                          onChange={(e) => updateCurrentConfig('payerSignTitle', e.target.value)}
                          placeholder="توقيع الدافع / المسلّم للمبلغ"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-700 block mb-1">
                          {isAr ? 'مسمى توقيع المستلم / المحاسب' : 'Receiver / Cashier Signature Title'}
                        </label>
                        <TextInput
                          size="xs"
                          value={currentConfig.receiverSignTitle || ''}
                          onChange={(e) => updateCurrentConfig('receiverSignTitle', e.target.value)}
                          placeholder="توقيع المستلم / المحاسب"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ══════════════════════════════════════════════════════
                  Live Interactive Preview (8 cols)
                 ══════════════════════════════════════════════════════ */}
              <div className="lg:col-span-8 space-y-2">
                <div className="flex items-center justify-between bg-slate-100/70 p-2.5 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2">
                    <IconEye size={16} className="text-slate-600" />
                    <span className="font-extrabold text-xs text-slate-800">
                      {isAr ? 'المعاينة الحية الفورية للمستند المعتمد' : 'Live Interactive Document Preview'}
                    </span>
                  </div>
                  <Badge color="orange" variant="light" size="sm" className="font-bold">
                    {isAr ? 'التصميم الرسمي المعتمد ⚡' : 'Official Approved Design ⚡'}
                  </Badge>
                </div>

                <div className="bg-slate-200/70 p-4 rounded-xl border border-slate-300 overflow-x-auto flex justify-center shadow-inner min-h-[600px]">
                  {currentDocKey === 'statement' ? (
                    <PrintableAccountStatementSheet
                      accountName="حساب العميل علي السعدي"
                      accountCode="1413"
                      startDate="2026/08/01"
                      endDate="2026/08/31"
                      rows={MOCK_STATEMENT_ROWS}
                      totals={MOCK_STATEMENT_TOTALS}
                      config={{
                        ...currentConfig,
                        logoUrl: activeLogoUrl || currentConfig?.logoUrl || '',
                      }}
                      lang="ar"
                    />
                  ) : currentDocKey === 'receipt_voucher' ? (
                    <PrintableVoucherSheet
                      voucher={MOCK_RECEIPT_VOUCHER}
                      config={{
                        ...currentConfig,
                        logoUrl: activeLogoUrl || currentConfig?.logoUrl || '',
                      }}
                      lang="ar"
                    />
                  ) : currentDocKey === 'payment_voucher' ? (
                    <PrintableVoucherSheet
                      voucher={MOCK_PAYMENT_VOUCHER}
                      config={{
                        ...currentConfig,
                        logoUrl: activeLogoUrl || currentConfig?.logoUrl || '',
                      }}
                      lang="ar"
                    />
                  ) : (
                    <PrintableAccountStatementSheet
                      accountName="تقرير المصاريف العمومية والإدارية"
                      accountCode="510001"
                      startDate="2026/08/01"
                      endDate="2026/08/31"
                      rows={MOCK_STATEMENT_ROWS}
                      totals={MOCK_STATEMENT_TOTALS}
                      config={{
                        ...currentConfig,
                        logoUrl: activeLogoUrl || currentConfig?.logoUrl || '',
                      }}
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
