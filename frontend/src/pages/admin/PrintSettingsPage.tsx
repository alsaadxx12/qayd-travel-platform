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
  IconLayoutBoard,
  IconArrowUp,
  IconArrowDown,
} from '@tabler/icons-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { fetchPrintTemplate, savePrintTemplate } from '../../api/printTemplates';
import { downloadStatementPdf } from '../../api/statementPdf';
import { generateChromiumPdf, serializeElementForChromium } from '../../utils/chromiumPdf';
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
import { VOUCHER_FIELDS, VOUCHER_TEXT_ELEMENTS } from '../../components/vouchers/FormalVoucherSheet';

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

/**
 * أسماء تبويبات هذه الصفحة ليست هي أسماء المستندات في قاعدة البيانات.
 *
 * التبويب هنا اسمه `receipt_voucher`، بينما نافذة طباعة السند وصفحة «قوالب الطباعة»
 * تتعاملان مع `receipt`. وهذه الخريطة هي الجسر الوحيد بينهما: كل قراءة وكل كتابة
 * تمرّ منها، فلا يبقى في الكود مكانان يقرّران أين يُحفظ تصميم السند.
 */
const CANONICAL_DOC_TYPE: Record<string, string> = {
  receipt_voucher: 'receipt',
  payment_voucher: 'payment',
};

/** المفتاح الذي تقرأ منه بقية أنحاء النظام هذا المستند. */
const canonicalDocType = (tabKey: string) => CANONICAL_DOC_TYPE[tabKey] || tabKey;

/**
 * التصميم المحفوظ لمستندٍ ما، من المفتاح المرجعي ثم من الاسم القديم.
 *
 * الترتيب مقصود: من ضبط تصميمه حديثاً من أي شاشة فتصميمه في المفتاح المرجعي، ومن
 * لم يضبط شيئاً منذ زمن فتصميمه في الاسم القديم — وكلاهما يصل.
 */
async function resolveTemplateConfig(tabKey: string): Promise<any | null> {
  const keys = [canonicalDocType(tabKey), tabKey].filter((k, i, a) => a.indexOf(k) === i);
  for (const key of keys) {
    const res = await fetchPrintTemplate(key, { fresh: true }).catch(() => null);
    if (res && res.config) return res.config;
  }
  return null;
}

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
  description: 'تسديد جزء من قيمة الفاتورة رقم INV-2025-0456',
  customCategory: 'فلأي',
  splitAccounts: [{ accountName: 'فلأي', amount: 250000, currency: 'IQD' }],
  user: 'أحمد المحاسب',
};

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
  description: 'سداد دفعة حساب مستحقات تذاكر طيران الخطوط لشهر حزيران',
  splitAccounts: [{ accountName: 'تذاكر', amount: 450000, currency: 'IQD' }],
  user: 'علي جعفر',
};

export const PrintSettingsPage: React.FC = () => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  const [activeDocTab, setActiveDocTab] = useState<string | null>('statement');
  const [printTab, setPrintTab] = useState<'colors' | 'info' | 'fonts' | 'toggles' | 'layout'>('colors');
  /** النص المختار في محرّر «تخصيص نص بعينه» في تبويب الخطوط. */
  const [selectedTextEl, setSelectedTextEl] = useState('docTitle');

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
      /**
       * تُقرأ السندات من المفتاح الذي تقرأ منه نافذة الطباعة نفسها.
       *
       * كان في النظام مخزنان لتصميم سند واحد: هذه الصفحة تكتب في `receipt_voucher`،
       * وصفحة «قوالب الطباعة» تكتب في `receipt`، ونافذة الطباعة تقرأ `receipt`
       * أولاً. فمن ضبط ألوانه هنا ثم فتح سنداً وجد تصميماً آخر تماماً، ولا رسالة
       * خطأ في أي مكان — لأن كل طرف كان يعمل بصورة صحيحة على مخزن مختلف.
       *
       * فصار `receipt` / `payment` هو المرجع، ويُجرَّب الاسم القديم بعده كي لا يضيع
       * ما حُفظ تحته سابقاً.
       */
      resolveTemplateConfig(dt)
        .then((cfg) => {
          if (cfg) {
            setConfigs((prev) => ({
              ...prev,
              [dt]: { ...prev[dt], ...cfg },
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
      } else if (field.startsWith('fieldLabels.')) {
        // «fieldLabels.party» — تسمية حقل واحد بعينه.
        const labelKey = field.split('.')[1];
        active.fieldLabels = { ...(active.fieldLabels || {}), [labelKey]: value };
      } else if (field.startsWith('textStyles.')) {
        // «textStyles.docTitle.color» — نمط نصٍّ بعينه فوق الضبط العام.
        const [, el, prop] = field.split('.');
        active.textStyles = {
          ...(active.textStyles || {}),
          [el]: { ...((active.textStyles || {})[el] || {}), [prop]: value },
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

  /**
   * تبويب «التخطيط» يخصّ السندات وحدها.
   *
   * حجم الورق والكثافة وترتيب الحقول والتواقيع كلّها مفاتيح يقرؤها سند القبض والدفع؛
   * وكشف الحساب وتقرير المصاريف لهما بنية أخرى لا تستعملها. وإظهار تبويب لا يفعل
   * شيئاً أسوأ من إخفائه، فيُخفى — ويعود التبويب إلى «الألوان» إن كان مفتوحاً حين
   * ينتقل المستخدم إلى مستند لا تخطيط له.
   */
  const isVoucherDoc = currentDocKey === 'receipt_voucher' || currentDocKey === 'payment_voucher';

  useEffect(() => {
    if (!isVoucherDoc && printTab === 'layout') setPrintTab('colors');
  }, [isVoucherDoc, printTab]);

  /** ترتيب الحقول كما هو محفوظ، مكمَّلاً بأي حقل جديد أُضيف بعد آخر حفظ. */
  const orderedFieldKeys: string[] = useMemo(() => {
    const saved: string[] = Array.isArray(currentConfig.fieldOrder) ? currentConfig.fieldOrder : [];
    const known = VOUCHER_FIELDS.map((f) => f.key);
    const kept = saved.filter((k) => known.includes(k));
    return [...kept, ...known.filter((k) => !kept.includes(k))];
  }, [currentConfig.fieldOrder]);

  const hiddenFieldKeys: string[] = Array.isArray(currentConfig.hiddenFields)
    ? currentConfig.hiddenFields
    : [];

  const moveField = (key: string, delta: number) => {
    const next = [...orderedFieldKeys];
    const from = next.indexOf(key);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= next.length) return;
    [next[from], next[to]] = [next[to], next[from]];
    updateCurrentConfig('fieldOrder', next);
  };

  const toggleField = (key: string, visible: boolean) => {
    const next = visible
      ? hiddenFieldKeys.filter((k) => k !== key)
      : [...hiddenFieldKeys.filter((k) => k !== key), key];
    updateCurrentConfig('hiddenFields', next);
  };

  /**
   * مسميات التواقيع قائمة لا حقلان.
   *
   * كان في الإعدادات حقلان ثابتان («الدافع» و«المستلم») بينما الورقة ترسم عموداً لكل
   * عنوان في `signatureTitles` — فمن أراد توقيعاً ثالثاً للمدير أو المدقّق لم يكن
   * لديه أي سبيل إلى ذلك. والحقلان القديمان باقيان في تبويب «خيارات» كما هما، فلا
   * يفقد أحد ما ضبطه.
   */
  const signatureTitles: string[] = Array.isArray(currentConfig.signatureTitles)
    ? currentConfig.signatureTitles
    : [];

  const updateSignatureTitle = (index: number, value: string) => {
    const next = [...signatureTitles];
    next[index] = value;
    updateCurrentConfig('signatureTitles', next);
  };

  const handleSaveCurrentConfig = async () => {
    setIsSaving(true);
    try {
      let baseConfig = currentConfig;
      try {
        const latest = await resolveTemplateConfig(currentDocKey);
        if (latest) {
          baseConfig = { ...latest, ...currentConfig };
        }
      } catch {}

      const toSave = {
        ...baseConfig,
        logoUrl: activeLogoUrl || baseConfig.logoUrl || '',
      };

      /**
       * يُكتب في المفتاح المرجعي، ويُنسخ إلى الاسم القديم.
       *
       * المرجعي هو ما تقرؤه نافذة الطباعة فعلاً، فبه وحده يظهر أثر الحفظ على السند.
       * والنسخة إلى الاسم القديم ليست ترفاً: أي شاشة أو تقرير لم يُحدَّث بعد وما زال
       * يقرأ `receipt_voucher` سيجد تصميماً مطابقاً لا تصميماً متجمّداً عند آخر مرة
       * حُفظ فيها بالطريقة القديمة — ولا يُبطَل الحفظ كلّه إن تعذّرت هذه النسخة.
       */
      const canonical = canonicalDocType(currentDocKey);
      await savePrintTemplate(canonical, toSave);
      if (canonical !== currentDocKey) {
        await savePrintTemplate(currentDocKey, toSave).catch(() => {});
      }

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

  // Official Chromium PDF for the statement tab. Other docs still use a client raster
  // until they have the same server print pipeline.
  const handleExportTestPdf = async () => {
    setIsExportingTestPdf(true);
    try {
      if (currentDocKey === 'statement') {
        await downloadStatementPdf({
          accountName: isAr ? 'شركة النور للتجارة العامة' : 'Al-Noor Trading Co.',
          accountCode: '1201',
          accountPhone: '+964 770 000 0000',
          accountEmail: 'accounts@example.com',
          accountAddress: isAr ? 'بغداد — الكرادة' : 'Baghdad — Karrada',
          startDate: '2026-08-01',
          endDate: '2026-08-31',
          rows: MOCK_STATEMENT_ROWS,
          totals: MOCK_STATEMENT_TOTALS,
          lang: isAr ? 'ar' : 'en',
          settings: currentConfig,
        });
        showSuccessNotification(
          isAr ? 'تم تصدير PDF التجريبي' : 'Test PDF Exported',
          isAr ? 'تم تنزيل العينة عبر محرك الطباعة الرسمي (نص متجه)' : 'Sample exported with the official print engine',
        );
        return;
      }

      if (currentDocKey === 'receipt_voucher' || currentDocKey === 'payment_voucher') {
        const element = document.getElementById('printable-voucher-sheet');
        if (!element) {
          throw new Error(isAr ? 'معاينة السند غير جاهزة' : 'Voucher preview is not ready');
        }
        const html = serializeElementForChromium(element);
        const { blob, filename } = await generateChromiumPdf({
          html,
          lang: isAr ? 'ar' : 'en',
          filename: `test_template_${currentDocKey}.pdf`,
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        showSuccessNotification(
          isAr ? 'تم تصدير PDF التجريبي' : 'Test PDF Exported',
          isAr ? 'تم تنزيل عينة السند عبر محرك الطباعة الرسمي' : 'Voucher sample exported with the official print engine',
        );
        return;
      }

      const element = document.getElementById('printable-statement-sheet');
      if (!element) return;

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
        isAr ? 'تم تنزيل عينة المعاينة بصيغة PDF' : 'Sample PDF exported',
      );
    } catch (err: any) {
      console.error('Test export failed:', err);
      showErrorNotification(
        isAr ? 'خطأ في التصدير' : 'Export Failed',
        err?.message || (isAr ? 'تعذر توليد ملف PDF' : 'Could not generate the PDF'),
      );
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
                  <div className={`grid gap-1 ${isVoucherDoc ? 'grid-cols-5' : 'grid-cols-4'}`}>
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
                    {isVoucherDoc && (
                      <button
                        type="button"
                        onClick={() => setPrintTab('layout')}
                        className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                          printTab === 'layout'
                            ? 'bg-[#F45A0A] text-white shadow-xs scale-[1.02]'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        <IconLayoutBoard size={14} />
                        <span>{isAr ? 'التخطيط' : 'Layout'}</span>
                      </button>
                    )}
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

                        {/* ألوان النصوص العامة — المتن والتسميات والتذييل. */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-slate-700 block mb-1">
                              {isAr ? 'لون نصوص السند (المتن)' : 'Body Text Color'}
                            </label>
                            <ColorInput
                              value={currentConfig.textColor || '#0f172a'}
                              onChange={(v) => updateCurrentConfig('textColor', v)}
                              size="xs"
                              format="hex"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-700 block mb-1">
                              {isAr ? 'لون تسميات الحقول' : 'Field Labels Color'}
                            </label>
                            <ColorInput
                              value={currentConfig.labelColor || ''}
                              onChange={(v) => updateCurrentConfig('labelColor', v)}
                              size="xs"
                              format="hex"
                              placeholder={isAr ? 'تلقائي من لون المتن' : 'Auto from body color'}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-700 block mb-1">
                            {isAr ? 'لون نص التذييل وبيانات الاتصال' : 'Footer & Contact Text Color'}
                          </label>
                          <ColorInput
                            value={currentConfig.footerTextColor || ''}
                            onChange={(v) => updateCurrentConfig('footerTextColor', v)}
                            size="xs"
                            format="hex"
                            placeholder={isAr ? 'تلقائي من لون المتن' : 'Auto from body color'}
                          />
                        </div>

                        {/* ── لون كل نص على حدة ──
                            فوق الألوان العامة أعلاه: من أراد لعنوان السند لوناً
                            ولرقم المبلغ آخر ولعبارة الشكر ثالثاً، فمن هنا. الحقل
                            الفارغ يعني «اتبع الضبط العام». */}
                        <div className="pt-2 border-t border-slate-100">
                          <label className="text-[10px] font-black text-slate-800 block mb-1.5">
                            {isAr ? 'لون كل نص على حدة' : 'Per-Text Colors'}
                          </label>
                          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                            {VOUCHER_TEXT_ELEMENTS.map((el) => (
                              <div key={el.key}>
                                <label className="text-[9px] font-bold text-slate-600 block mb-0.5">
                                  {isAr ? el.label : el.labelEn}
                                </label>
                                <ColorInput
                                  value={currentConfig.textStyles?.[el.key]?.color || ''}
                                  onChange={(v) => updateCurrentConfig(`textStyles.${el.key}.color`, v)}
                                  size="xs"
                                  format="hex"
                                  placeholder={isAr ? 'تلقائي' : 'Auto'}
                                />
                              </div>
                            ))}
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
                      {/* Upload Banner Action (Full Width) */}
                      <div>
                        <label className="block w-full">
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
                      </div>

                      {/* Header Banner Height & Vertical Offset Sliders */}
                      {currentConfig.useFullHeaderImage && (
                        <div className="space-y-2.5 pt-1 border-t border-blue-100">
                          {/* Banner Height */}
                          <div>
                            <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                              <span>{isAr ? 'ارتفاع الترويسة الكاملة:' : 'Full Banner Height:'}</span>
                              <span className="font-mono text-blue-600 font-black">{currentConfig.headerImageHeight || 115}px</span>
                            </div>
                            <Slider
                              size="xs"
                              color="blue"
                              min={40}
                              max={260}
                              step={5}
                              value={currentConfig.headerImageHeight || 115}
                              onChange={(v) => updateCurrentConfig('headerImageHeight', v)}
                            />
                          </div>

                          {/* Move Banner Up/Down (bannerOffsetY) */}
                          <div>
                            <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                              <span>{isAr ? 'تحريك الترويسة (للأعلى ⬆️ / للأسفل ⬇️):' : 'Vertical Move (Up/Down):'}</span>
                              <span className="font-mono text-blue-600 font-black">
                                {currentConfig.bannerOffsetY || 0}px {currentConfig.bannerOffsetY < 0 ? '(أعلى)' : currentConfig.bannerOffsetY > 0 ? '(أسفل)' : '(وسط)'}
                              </span>
                            </div>
                            <Slider
                              size="xs"
                              color="blue"
                              min={-40}
                              max={50}
                              step={1}
                              value={currentConfig.bannerOffsetY || 0}
                              onChange={(v) => updateCurrentConfig('bannerOffsetY', v)}
                            />
                          </div>
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

                    {/*
                      وصف الشركة — حقلٌ كان ينقص تماماً.

                      النصّ كان يُطبع تحت اسم الشركة في كل سند، ولم يكن له حقل في أي
                      شاشة؛ فمن أراد تغييره أو حذفه لم يجد إليه سبيلاً. وإظهاره من
                      عدمه مفتاحٌ في تبويب «التخطيط».
                    */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        {isAr ? 'وصف الشركة تحت الاسم (عربي)' : 'Company Tagline (Arabic)'}
                      </label>
                      <TextInput
                        size="xs"
                        value={currentConfig.subtitle || ''}
                        onChange={(e) => updateCurrentConfig('subtitle', e.target.value)}
                        placeholder={isAr ? 'اتركه فارغاً لعدم طباعة أي وصف' : 'Leave empty to print no tagline'}
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        {isAr ? 'وصف الشركة تحت الاسم (إنجليزي)' : 'Company Tagline (English)'}
                      </label>
                      <TextInput
                        size="xs"
                        value={currentConfig.subtitleEn || ''}
                        onChange={(e) => updateCurrentConfig('subtitleEn', e.target.value)}
                        placeholder="Leave empty to print no tagline"
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

                      {/* حجم المبلغ ونصّ الجسم — يقرؤهما السند وحده، فلا يُعرضان لغيره. */}
                      {isVoucherDoc && (
                        <>
                          <div className="pt-2 border-t border-slate-100">
                            <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                              <span>{isAr ? 'تكبير جميع النصوص:' : 'Scale All Text:'}</span>
                              <span className="font-mono">{currentConfig.fontScale || 100}%</span>
                            </div>
                            <Slider
                              min={80}
                              max={160}
                              step={5}
                              size="xs"
                              color="orange"
                              value={currentConfig.fontScale || 100}
                              onChange={(v) => updateCurrentConfig('fontScale', v)}
                            />
                            <p className="text-[9px] text-slate-500 mt-1 font-medium">
                              {isAr
                                ? 'يكبّر كل نصوص الورقة معاً بنسبة واحدة، مع بقاء الأحجام أدناه للضبط الفردي.'
                                : 'Scales every text on the sheet together; the sliders below still fine-tune each size.'}
                            </p>
                          </div>

                          <div>
                            <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                              <span>{isAr ? 'حجم المبلغ الرئيسي:' : 'Amount Size:'}</span>
                              <span className="font-mono">{currentConfig.fontSizes?.amount || 30}px</span>
                            </div>
                            <Slider
                              min={14}
                              max={44}
                              step={1}
                              size="xs"
                              color="orange"
                              value={currentConfig.fontSizes?.amount || 30}
                              onChange={(v) => updateCurrentConfig('fontSizes.amount', v)}
                            />
                          </div>

                          <div>
                            <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                              <span>{isAr ? 'حجم نص الحقول:' : 'Field Text Size:'}</span>
                              <span className="font-mono">{currentConfig.fontSizes?.body || 11}px</span>
                            </div>
                            <Slider
                              min={8}
                              max={16}
                              step={1}
                              size="xs"
                              color="orange"
                              value={currentConfig.fontSizes?.body || 11}
                              onChange={(v) => updateCurrentConfig('fontSizes.body', v)}
                            />
                          </div>

                          <div>
                            <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                              <span>{isAr ? 'حجم تسميات الحقول:' : 'Field Label Size:'}</span>
                              <span className="font-mono">{currentConfig.fontSizes?.label || 10}px</span>
                            </div>
                            <Slider
                              min={7}
                              max={14}
                              step={1}
                              size="xs"
                              color="orange"
                              value={currentConfig.fontSizes?.label || 10}
                              onChange={(v) => updateCurrentConfig('fontSizes.label', v)}
                            />
                          </div>

                          {/* ── تخصيص نص بعينه ──
                              اختر النص ثم اضبط مقاسه ووزنه ومحاذاته وميله — كل
                              خاصية غير مضبوطة تبقى على مظهرها الموروث، ولون النص
                              نفسه في تبويب «الألوان». */}
                          <div className="pt-2 border-t border-slate-100 space-y-2">
                            <label className="text-[10px] font-black text-slate-800 block">
                              {isAr ? 'تخصيص نص بعينه' : 'Style One Text'}
                            </label>
                            {/* القائمة مبوّبة: نصوص الورقة العامة، ثم تسمية كل
                                حقل وقيمته على حدة — فتخضع بيانات كل حقل بعينه
                                للتخصيص، والأخص يغلب الأعم خاصيةً بخاصية. */}
                            <Select
                              size="xs"
                              value={selectedTextEl}
                              onChange={(v) => setSelectedTextEl(v || 'docTitle')}
                              data={[
                                {
                                  group: isAr ? 'نصوص الورقة' : 'Sheet texts',
                                  items: VOUCHER_TEXT_ELEMENTS.map((el) => ({
                                    value: el.key,
                                    label: isAr ? el.label : el.labelEn,
                                  })),
                                },
                                {
                                  group: isAr ? 'قيمة حقل بعينه' : 'A single field value',
                                  items: VOUCHER_FIELDS.map((f) => ({
                                    value: `fieldValue:${f.key}`,
                                    label: isAr ? `قيمة: ${f.label}` : `Value: ${f.labelEn}`,
                                  })),
                                },
                                {
                                  group: isAr ? 'تسمية حقل بعينه' : 'A single field label',
                                  items: VOUCHER_FIELDS.map((f) => ({
                                    value: `fieldLabel:${f.key}`,
                                    label: isAr ? `تسمية: ${f.label}` : `Label: ${f.labelEn}`,
                                  })),
                                },
                              ]}
                              allowDeselect={false}
                              searchable
                              maxDropdownHeight={420}
                              nothingFoundMessage={isAr ? 'لا نتيجة' : 'Nothing found'}
                            />

                            <div>
                              <label className="text-[10px] font-bold text-slate-700 block mb-1">
                                {isAr ? 'لون هذا النص' : 'This Text Color'}
                              </label>
                              <ColorInput
                                value={currentConfig.textStyles?.[selectedTextEl]?.color || ''}
                                onChange={(v) => updateCurrentConfig(`textStyles.${selectedTextEl}.color`, v)}
                                size="xs"
                                format="hex"
                                placeholder={isAr ? 'تلقائي' : 'Auto'}
                              />
                            </div>

                            <div>
                              <div className="flex justify-between text-[10px] font-bold text-slate-700 mb-1">
                                <span>{isAr ? 'حجم الخط:' : 'Size:'}</span>
                                <span className="font-mono">
                                  {currentConfig.textStyles?.[selectedTextEl]?.size
                                    ? `${currentConfig.textStyles[selectedTextEl].size}px`
                                    : isAr ? 'تلقائي' : 'auto'}
                                </span>
                              </div>
                              <Slider
                                size="xs"
                                color="orange"
                                min={7}
                                max={48}
                                value={currentConfig.textStyles?.[selectedTextEl]?.size || 0}
                                onChange={(v) => updateCurrentConfig(`textStyles.${selectedTextEl}.size`, v)}
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] font-bold text-slate-700 block mb-1">
                                  {isAr ? 'وزن الخط' : 'Weight'}
                                </label>
                                <Select
                                  size="xs"
                                  value={currentConfig.textStyles?.[selectedTextEl]?.weight || ''}
                                  onChange={(v) => updateCurrentConfig(`textStyles.${selectedTextEl}.weight`, v || undefined)}
                                  data={[
                                    { value: '', label: isAr ? 'تلقائي' : 'Auto' },
                                    { value: 'normal', label: isAr ? 'عادي' : 'Normal' },
                                    { value: 'semibold', label: isAr ? 'متوسط' : 'Semibold' },
                                    { value: 'bold', label: isAr ? 'عريض (بولد)' : 'Bold' },
                                    { value: 'black', label: isAr ? 'أسود ثقيل' : 'Black' },
                                  ]}
                                  allowDeselect={false}
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-700 block mb-1">
                                  {isAr ? 'المحاذاة' : 'Alignment'}
                                </label>
                                <Select
                                  size="xs"
                                  value={currentConfig.textStyles?.[selectedTextEl]?.align || ''}
                                  onChange={(v) => updateCurrentConfig(`textStyles.${selectedTextEl}.align`, v || undefined)}
                                  data={[
                                    { value: '', label: isAr ? 'تلقائي' : 'Auto' },
                                    { value: 'start', label: isAr ? 'بداية' : 'Start' },
                                    { value: 'center', label: isAr ? 'وسط' : 'Center' },
                                    { value: 'end', label: isAr ? 'نهاية' : 'End' },
                                  ]}
                                  allowDeselect={false}
                                />
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              <Switch
                                size="xs"
                                color="orange"
                                label={isAr ? 'مائل' : 'Italic'}
                                checked={currentConfig.textStyles?.[selectedTextEl]?.italic === true}
                                onChange={(e) =>
                                  updateCurrentConfig(`textStyles.${selectedTextEl}.italic`, e.currentTarget.checked)
                                }
                              />
                              <Button
                                size="compact-xs"
                                variant="light"
                                color="gray"
                                className="font-bold"
                                onClick={() => {
                                  const next = { ...(currentConfig.textStyles || {}) };
                                  delete next[selectedTextEl];
                                  updateCurrentConfig('textStyles', next);
                                }}
                              >
                                {isAr ? 'إعادة هذا النص للتلقائي' : 'Reset this text'}
                              </Button>
                            </div>
                          </div>
                        </>
                      )}
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

                      {isVoucherDoc && (
                        <div>
                          <label className="text-[10px] font-bold text-slate-700 block mb-1">
                            {isAr ? 'الشرط القانوني المطبوع فوق التواقيع' : 'Legal Note Above Signatures'}
                          </label>
                          <TextInput
                            size="xs"
                            value={currentConfig.notesText || ''}
                            onChange={(e) => updateCurrentConfig('notesText', e.target.value)}
                            placeholder="تم استلام المبلغ أعلاه، ويعتبر هذا السند حجة إثبات رسمية."
                          />
                        </div>
                      )}

                      <div>
                        <label className="text-[10px] font-bold text-slate-700 block mb-1">
                          {isAr ? 'نص التذييل السفلي' : 'Footer Text'}
                        </label>
                        <TextInput
                          size="xs"
                          value={currentConfig.footerText || ''}
                          onChange={(e) => updateCurrentConfig('footerText', e.target.value)}
                          placeholder="جميع الحقوق محفوظة"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ══════════════════════════════════════════════════════
                    Sub-Tab 5: Layout — the shape of the printed voucher.
                    كل مفتاح هنا يقرؤه سند القبض والدفع مباشرةً؛ وما لا يُضبط من هنا
                    لا يُضبط من مكان آخر.
                   ══════════════════════════════════════════════════════ */}
                {printTab === 'layout' && isVoucherDoc && (
                  <div className="space-y-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <h4 className="font-extrabold text-xs text-slate-900 border-b pb-1.5 flex items-center gap-1.5">
                      <IconLayoutBoard size={14} className="text-[#F45A0A]" />
                      <span>{isAr ? 'تخطيط الورقة والحقول والتواقيع' : 'Sheet, Fields & Signatures Layout'}</span>
                    </h4>

                    {/* ── الورقة ── */}
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-700 block mb-1">
                            {isAr ? 'نمط التصميم' : 'Sheet Style'}
                          </label>
                          <Select
                            size="xs"
                            value={currentConfig.sheetStyle || 'formal'}
                            onChange={(v) => updateCurrentConfig('sheetStyle', v || 'formal')}
                            data={[
                              { value: 'formal', label: isAr ? 'رسمي محاسبي' : 'Formal' },
                              { value: 'modern', label: isAr ? 'عصري (بطاقات ملوّنة)' : 'Modern (cards)' },
                            ]}
                            allowDeselect={false}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-700 block mb-1">
                            {isAr ? 'حجم الورق' : 'Paper Size'}
                          </label>
                          <Select
                            size="xs"
                            value={currentConfig.voucherPaperSize || 'A4'}
                            onChange={(v) => updateCurrentConfig('voucherPaperSize', v || 'A4')}
                            data={[
                              { value: 'A4', label: 'A4' },
                              { value: 'A5', label: 'A5' },
                              { value: 'THERMAL80', label: isAr ? 'حراري 80mm' : 'Thermal 80mm' },
                            ]}
                            allowDeselect={false}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-700 block mb-1">
                            {isAr ? 'كثافة الأسطر' : 'Density'}
                          </label>
                          <Select
                            size="xs"
                            value={currentConfig.density || 'normal'}
                            onChange={(v) => updateCurrentConfig('density', v || 'normal')}
                            data={[
                              { value: 'comfortable', label: isAr ? 'مريحة' : 'Comfortable' },
                              { value: 'normal', label: isAr ? 'عادية' : 'Normal' },
                              { value: 'compact', label: isAr ? 'مضغوطة' : 'Compact' },
                            ]}
                            allowDeselect={false}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-700 block mb-1">
                            {isAr ? 'نسخ في الصفحة' : 'Copies per Page'}
                          </label>
                          <Select
                            size="xs"
                            value={String(currentConfig.copiesPerPage || 1)}
                            onChange={(v) => updateCurrentConfig('copiesPerPage', Number(v) || 1)}
                            data={[
                              { value: '1', label: isAr ? 'نسخة واحدة' : 'One' },
                              { value: '2', label: isAr ? 'نسختان (أصل + صورة)' : 'Two (original + copy)' },
                            ]}
                            allowDeselect={false}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-700 block mb-1">
                          {isAr
                            ? `هامش الورقة: ${currentConfig.marginMm ?? 14}mm`
                            : `Page Margin: ${currentConfig.marginMm ?? 14}mm`}
                        </label>
                        <Slider
                          size="xs"
                          color="orange"
                          min={2}
                          max={28}
                          value={currentConfig.marginMm ?? 14}
                          onChange={(v) => updateCurrentConfig('marginMm', v)}
                        />
                      </div>
                    </div>

                    {/* ── الترويسة ── */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                      <div>
                        <label className="text-[10px] font-bold text-slate-700 block mb-1">
                          {isAr ? 'شكل الترويسة' : 'Header Style'}
                        </label>
                        <Select
                          size="xs"
                          value={currentConfig.voucherHeaderStyle || 'rule'}
                          onChange={(v) => updateCurrentConfig('voucherHeaderStyle', v || 'rule')}
                          data={[
                            { value: 'rule', label: isAr ? 'خط سفلي ملوّن' : 'Bottom rule' },
                            { value: 'band', label: isAr ? 'شريط ملوّن كامل' : 'Colour band' },
                            { value: 'frame', label: isAr ? 'إطار محيط' : 'Framed' },
                            { value: 'plain', label: isAr ? 'بلا فاصل' : 'Plain' },
                          ]}
                          allowDeselect={false}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-700 block mb-1">
                          {isAr ? 'موضع الشعار' : 'Logo Position'}
                        </label>
                        <Select
                          size="xs"
                          value={currentConfig.logoPosition || 'start'}
                          onChange={(v) => updateCurrentConfig('logoPosition', v || 'start')}
                          data={[
                            { value: 'start', label: isAr ? 'في بداية السطر (يمين)' : 'Start of the row' },
                            { value: 'end', label: isAr ? 'في نهاية السطر (يسار)' : 'End of the row' },
                            { value: 'center', label: isAr ? 'في الوسط فوق الاسم' : 'Centered, above the name' },
                          ]}
                          allowDeselect={false}
                          disabled={!currentConfig.logoUrl}
                        />
                        {!currentConfig.logoUrl && (
                          <p className="text-[9px] text-slate-500 mt-1 font-medium">
                            {isAr ? 'لا يوجد شعار مرفوع بعد.' : 'No logo uploaded yet.'}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* ── موضع الاسم وسطر الاتصال ── */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-700 block mb-1">
                          {isAr ? 'موضع اسم الشركة' : 'Company Name Position'}
                        </label>
                        <Select
                          size="xs"
                          value={currentConfig.headerTextAlign || 'opposite'}
                          onChange={(v) => updateCurrentConfig('headerTextAlign', v || 'opposite')}
                          data={[
                            { value: 'opposite', label: isAr ? 'في الطرف المقابل للشعار' : 'Opposite the logo' },
                            { value: 'beside', label: isAr ? 'ملاصقاً للشعار' : 'Beside the logo' },
                            { value: 'center', label: isAr ? 'في وسط المساحة' : 'Centered' },
                          ]}
                          allowDeselect={false}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-700 block mb-1">
                          {isAr ? 'موضع سطر بيانات الاتصال' : 'Contact Line Position'}
                        </label>
                        <Select
                          size="xs"
                          value={currentConfig.contactAlign || 'start'}
                          onChange={(v) => updateCurrentConfig('contactAlign', v || 'start')}
                          data={[
                            { value: 'start', label: isAr ? 'من البداية' : 'From the start' },
                            { value: 'center', label: isAr ? 'في الوسط' : 'Centered' },
                            { value: 'end', label: isAr ? 'من النهاية' : 'From the end' },
                          ]}
                          allowDeselect={false}
                        />
                      </div>
                    </div>

                    <Switch
                      size="xs"
                      color="orange"
                      label={isAr ? 'إظهار وصف الشركة تحت الاسم' : 'Show Company Tagline Under the Name'}
                      checked={currentConfig.showSubtitle === true}
                      onChange={(e) => updateCurrentConfig('showSubtitle', e.currentTarget.checked)}
                    />

                    <div className="space-y-2">
                      <Switch
                        size="xs"
                        color="orange"
                        label={isAr ? 'إظهار العنوان في الترويسة' : 'Show Address'}
                        checked={currentConfig.showAddress !== false}
                        onChange={(e) => updateCurrentConfig('showAddress', e.currentTarget.checked)}
                      />
                      <Switch
                        size="xs"
                        color="orange"
                        label={isAr ? 'إظهار الموقع الإلكتروني' : 'Show Website'}
                        checked={currentConfig.showWebsite !== false}
                        onChange={(e) => updateCurrentConfig('showWebsite', e.currentTarget.checked)}
                      />
                      <Switch
                        size="xs"
                        color="orange"
                        label={isAr ? 'إظهار رقم السجل التجاري' : 'Show Commercial Registration'}
                        checked={currentConfig.showCommercialReg === true}
                        onChange={(e) => updateCurrentConfig('showCommercialReg', e.currentTarget.checked)}
                      />
                      <Switch
                        size="xs"
                        color="orange"
                        label={isAr ? 'إظهار الرقم الضريبي' : 'Show Tax Number'}
                        checked={currentConfig.showTaxNumber === true}
                        onChange={(e) => updateCurrentConfig('showTaxNumber', e.currentTarget.checked)}
                      />
                    </div>

                    {/* ── بيانات السند والمبلغ ── */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                      <div>
                        <label className="text-[10px] font-bold text-slate-700 block mb-1">
                          {isAr ? 'رقم السند والتاريخ' : 'Number & Date Block'}
                        </label>
                        <Select
                          size="xs"
                          value={currentConfig.metaStyle || 'inline'}
                          onChange={(v) => updateCurrentConfig('metaStyle', v || 'inline')}
                          data={[
                            { value: 'inline', label: isAr ? 'سطر واحد' : 'Single line' },
                            { value: 'box', label: isAr ? 'صندوق تدقيق' : 'Boxed' },
                          ]}
                          allowDeselect={false}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-700 block mb-1">
                          {isAr ? 'شكل خانة المبلغ' : 'Amount Block'}
                        </label>
                        <Select
                          size="xs"
                          value={currentConfig.amountStyle || 'rule'}
                          onChange={(v) => updateCurrentConfig('amountStyle', v || 'rule')}
                          data={[
                            { value: 'rule', label: isAr ? 'خطّان أفقيان' : 'Rules' },
                            { value: 'panel', label: isAr ? 'لوحة ملوّنة' : 'Panel' },
                            { value: 'accent', label: isAr ? 'شريط جانبي' : 'Side accent' },
                          ]}
                          allowDeselect={false}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-700 block mb-1">
                          {isAr ? 'محاذاة المبلغ في خانته' : 'Amount Alignment'}
                        </label>
                        <Select
                          size="xs"
                          value={currentConfig.amountAlign || 'center'}
                          onChange={(v) => updateCurrentConfig('amountAlign', v || 'center')}
                          data={[
                            { value: 'center', label: isAr ? 'في وسط الخانة' : 'Centered' },
                            { value: 'edge', label: isAr ? 'في الطرف مقابل التسمية' : 'At the edge' },
                          ]}
                          allowDeselect={false}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-700 block mb-1">
                          {isAr ? 'موضع بيانات الاتصال' : 'Contact Info Placement'}
                        </label>
                        <Select
                          size="xs"
                          value={currentConfig.contactPlacement || 'footer'}
                          onChange={(v) => updateCurrentConfig('contactPlacement', v || 'footer')}
                          data={[
                            { value: 'footer', label: isAr ? 'في التذييل أسفل الورقة' : 'In the footer' },
                            { value: 'header', label: isAr ? 'تحت الترويسة' : 'Under the header' },
                          ]}
                          allowDeselect={false}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-700 block mb-1">
                        {isAr ? 'شكل تقسيم المبلغ' : 'Allocation Style'}
                      </label>
                      <Select
                        size="xs"
                        value={currentConfig.splitStyle || 'table'}
                        onChange={(v) => updateCurrentConfig('splitStyle', v || 'table')}
                        data={[
                          { value: 'table', label: isAr ? 'جدول (الحساب والمبلغ)' : 'Table (account & amount)' },
                          {
                            value: 'entry',
                            label: isAr ? 'قيد محاسبي (مدين / دائن)' : 'Journal entry (debit/credit)',
                          },
                          { value: 'inline', label: isAr ? 'سطر واحد' : 'Single line' },
                        ]}
                        allowDeselect={false}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-700 block mb-1">
                        {isAr ? 'موضع التفقيط (المبلغ كتابةً)' : 'Amount in Words Placement'}
                      </label>
                      <Select
                        size="xs"
                        value={currentConfig.tafqeetPlacement || 'underAmount'}
                        onChange={(v) => updateCurrentConfig('tafqeetPlacement', v || 'underAmount')}
                        data={[
                          { value: 'underAmount', label: isAr ? 'تحت المبلغ مباشرةً' : 'Under the amount' },
                          { value: 'field', label: isAr ? 'كحقل ضمن الجدول' : 'As a table field' },
                        ]}
                        allowDeselect={false}
                        disabled={currentConfig.showTafqeet === false}
                      />
                      {currentConfig.showTafqeet === false && (
                        <p className="text-[9px] text-slate-500 mt-1 font-medium">
                          {isAr
                            ? 'التفقيط مُطفأ من تبويب «خيارات» — فعّله ليظهر أثر هذا الاختيار.'
                            : 'Tafqeet is off in Options — turn it on for this to apply.'}
                        </p>
                      )}
                    </div>

                    {/* ── الحقول: أيّها يُطبع وبأي ترتيب ── */}
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-700 block mb-1">
                            {isAr ? 'شكل جدول الحقول' : 'Field Table Style'}
                          </label>
                          <Select
                            size="xs"
                            value={currentConfig.fieldStyle || 'table'}
                            onChange={(v) => updateCurrentConfig('fieldStyle', v || 'table')}
                            data={[
                              { value: 'table', label: isAr ? 'جدول بيانات مغلق' : 'Data table' },
                              { value: 'lines', label: isAr ? 'خطوط فاصلة' : 'Hairlines' },
                              { value: 'grid', label: isAr ? 'شبكة مغلقة' : 'Closed grid' },
                              { value: 'zebra', label: isAr ? 'أسطر متناوبة' : 'Zebra' },
                            ]}
                            allowDeselect={false}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-700 block mb-1">
                            {isAr
                              ? `عرض عمود التسميات: ${currentConfig.labelWidth || 150}px`
                              : `Label Column: ${currentConfig.labelWidth || 150}px`}
                          </label>
                          <Slider
                            size="xs"
                            color="orange"
                            min={90}
                            max={240}
                            value={currentConfig.labelWidth || 150}
                            onChange={(v) => updateCurrentConfig('labelWidth', v)}
                          />
                        </div>
                      </div>

                      {/* ── خصائص الجدول ── */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-700 block mb-1">
                            {isAr ? 'خلفية عمود التسميات' : 'Label Column Background'}
                          </label>
                          <ColorInput
                            value={currentConfig.fieldLabelBg || ''}
                            onChange={(v) => updateCurrentConfig('fieldLabelBg', v)}
                            size="xs"
                            format="hex"
                            placeholder={isAr ? 'تلقائي من لون الهوية' : 'Auto from ink'}
                            disabled={(currentConfig.fieldStyle || 'table') !== 'table'}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-700 block mb-1">
                            {isAr
                              ? `ارتفاع صف الجدول: ${currentConfig.fieldRowPadding ?? 8}px`
                              : `Row Padding: ${currentConfig.fieldRowPadding ?? 8}px`}
                          </label>
                          <Slider
                            size="xs"
                            color="orange"
                            min={2}
                            max={24}
                            value={currentConfig.fieldRowPadding ?? 8}
                            onChange={(v) => updateCurrentConfig('fieldRowPadding', v)}
                          />
                        </div>
                      </div>

                      <Switch
                        size="xs"
                        color="orange"
                        label={
                          isAr
                            ? 'طباعة حقل الملاحظات ولو فارغاً (سطر للكتابة اليدوية)'
                            : 'Print the notes field even when empty (hand-writing line)'
                        }
                        checked={(currentConfig.printEmptyFields ?? ['notes']).includes('notes')}
                        onChange={(e) =>
                          updateCurrentConfig('printEmptyFields', e.currentTarget.checked ? ['notes'] : [])
                        }
                      />

                      <div>
                        <label className="text-[10px] font-bold text-slate-700 block mb-1.5">
                          {isAr ? 'الحقول المطبوعة وترتيبها' : 'Printed Fields & Order'}
                        </label>
                        <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                          {orderedFieldKeys.map((key, i) => {
                            const field = VOUCHER_FIELDS.find((f) => f.key === key);
                            if (!field) return null;
                            const visible = !hiddenFieldKeys.includes(key);
                            return (
                              <div key={key} className="flex items-center gap-2 px-2 py-1.5 bg-white">
                                <Switch
                                  size="xs"
                                  color="orange"
                                  checked={visible}
                                  onChange={(e) => toggleField(key, e.currentTarget.checked)}
                                />
                                {/* التسمية نفسها قابلة للتحرير — ما يُكتب هنا
                                    يُطبع مكان التسمية الافتراضية، والفارغ يعيدها. */}
                                <TextInput
                                  size="xs"
                                  variant="unstyled"
                                  className={`flex-1 ${visible ? '' : 'opacity-40'}`}
                                  styles={{ input: { fontSize: 10, fontWeight: 700 } }}
                                  value={currentConfig.fieldLabels?.[key] ?? ''}
                                  onChange={(e) => updateCurrentConfig(`fieldLabels.${key}`, e.target.value)}
                                  placeholder={isAr ? field.label : field.labelEn}
                                />
                                <button
                                  type="button"
                                  disabled={i === 0}
                                  onClick={() => moveField(key, -1)}
                                  className="p-0.5 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
                                  aria-label={isAr ? 'تحريك لأعلى' : 'Move up'}
                                >
                                  <IconArrowUp size={13} />
                                </button>
                                <button
                                  type="button"
                                  disabled={i === orderedFieldKeys.length - 1}
                                  onClick={() => moveField(key, 1)}
                                  className="p-0.5 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
                                  aria-label={isAr ? 'تحريك لأسفل' : 'Move down'}
                                >
                                  <IconArrowDown size={13} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-[9px] text-slate-500 mt-1 font-medium">
                          {isAr
                            ? 'الحقل الفارغ في سند معيّن لا يُطبع أصلاً، حتى لو كان مُفعّلاً هنا.'
                            : 'A field with no value on a given voucher is never printed, even when enabled here.'}
                        </p>
                      </div>
                    </div>

                    {/* ── التواقيع والختم ── */}
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-700 block mb-1">
                          {isAr ? 'شكل خانة التوقيع' : 'Signature Style'}
                        </label>
                        <Select
                          size="xs"
                          value={currentConfig.signatureStyle || 'line'}
                          onChange={(v) => updateCurrentConfig('signatureStyle', v || 'line')}
                          data={[
                            { value: 'line', label: isAr ? 'خط توقيع' : 'Signature line' },
                            { value: 'box', label: isAr ? 'صندوق بعنوان' : 'Titled box' },
                          ]}
                          allowDeselect={false}
                          disabled={currentConfig.showSignatures === false}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-700 block mb-1">
                            {isAr
                              ? `ارتفاع حقل التوقيع: ${currentConfig.signatureHeight || 44}px`
                              : `Signature Height: ${currentConfig.signatureHeight || 44}px`}
                          </label>
                          <Slider
                            size="xs"
                            color="orange"
                            min={30}
                            max={110}
                            value={currentConfig.signatureHeight || 44}
                            onChange={(v) => updateCurrentConfig('signatureHeight', v)}
                            disabled={currentConfig.showSignatures === false}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-700 block mb-1">
                            {isAr
                              ? `حجم رمز الكشف: ${currentConfig.qrSize || (currentConfig.signatureHeight || 44) + 22}px`
                              : `QR Size: ${currentConfig.qrSize || (currentConfig.signatureHeight || 44) + 22}px`}
                          </label>
                          <Slider
                            size="xs"
                            color="orange"
                            min={48}
                            max={150}
                            value={currentConfig.qrSize || (currentConfig.signatureHeight || 44) + 22}
                            onChange={(v) => updateCurrentConfig('qrSize', v)}
                            disabled={currentConfig.showQrCode === false}
                          />
                          <p className="text-[9px] text-slate-500 mt-1 font-medium">
                            {isAr
                              ? 'ما لم يُضبط، يتبع الرمز ارتفاع التوقيع تلقائياً.'
                              : 'Unless set, the code follows the signature height.'}
                          </p>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-700 block mb-1.5">
                          {isAr ? 'أعمدة التواقيع' : 'Signature Columns'}
                        </label>
                        <div className="space-y-1.5">
                          {signatureTitles.map((title, i) => (
                            <div key={i} className="flex items-center gap-1.5">
                              <TextInput
                                size="xs"
                                className="flex-1"
                                value={title}
                                onChange={(e) => updateSignatureTitle(i, e.target.value)}
                                placeholder={isAr ? 'مسمى التوقيع' : 'Signature title'}
                              />
                              <Button
                                size="compact-xs"
                                variant="light"
                                color="red"
                                className="font-bold"
                                onClick={() =>
                                  updateCurrentConfig(
                                    'signatureTitles',
                                    signatureTitles.filter((_, j) => j !== i)
                                  )
                                }
                              >
                                {isAr ? 'حذف' : 'Remove'}
                              </Button>
                            </div>
                          ))}
                          <Button
                            size="compact-xs"
                            variant="light"
                            color="orange"
                            className="font-bold"
                            disabled={signatureTitles.length >= 4}
                            onClick={() =>
                              updateCurrentConfig('signatureTitles', [
                                ...signatureTitles,
                                isAr ? 'توقيع جديد' : 'New signature',
                              ])
                            }
                          >
                            {isAr ? '+ إضافة عمود توقيع' : '+ Add signature column'}
                          </Button>
                        </div>
                      </div>

                      <Switch
                        size="xs"
                        color="orange"
                        label={isAr ? 'إفساح مكان الختم الرسمي' : 'Reserve Space for Official Stamp'}
                        checked={currentConfig.showStamp === true}
                        onChange={(e) => updateCurrentConfig('showStamp', e.currentTarget.checked)}
                      />

                      {currentConfig.showStamp && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-slate-700 block mb-1">
                              {isAr ? 'نص داخل الختم' : 'Stamp Label'}
                            </label>
                            <TextInput
                              size="xs"
                              value={currentConfig.stampText || ''}
                              onChange={(e) => updateCurrentConfig('stampText', e.target.value)}
                              placeholder={isAr ? 'الختم' : 'Stamp'}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-700 block mb-1">
                              {isAr ? 'موضع الختم' : 'Stamp Position'}
                            </label>
                            <Select
                              size="xs"
                              value={currentConfig.stampPosition || 'end'}
                              onChange={(v) => updateCurrentConfig('stampPosition', v || 'end')}
                              data={[
                                { value: 'start', label: isAr ? 'قبل التواقيع' : 'Before signatures' },
                                { value: 'end', label: isAr ? 'بعد التواقيع' : 'After signatures' },
                              ]}
                              allowDeselect={false}
                            />
                          </div>
                        </div>
                      )}
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
                    /* qrPlaceholder: لا رمز حقيقياً في المعاينة — الرمز يُصدره الخادم لكل
                       طرف على حدة، فيُرسم إطار المكان كي يظهر أثر مفتاح «إظهار QR» بدل
                       أن يبدو المفتاح معطّلاً. */
                    <PrintableVoucherSheet
                      voucher={MOCK_RECEIPT_VOUCHER}
                      config={{
                        ...currentConfig,
                        logoUrl: activeLogoUrl || currentConfig?.logoUrl || '',
                      }}
                      lang={isAr ? 'ar' : 'en'}
                      qrPlaceholder
                    />
                  ) : currentDocKey === 'payment_voucher' ? (
                    <PrintableVoucherSheet
                      voucher={MOCK_PAYMENT_VOUCHER}
                      config={{
                        ...currentConfig,
                        logoUrl: activeLogoUrl || currentConfig?.logoUrl || '',
                      }}
                      lang={isAr ? 'ar' : 'en'}
                      qrPlaceholder
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
