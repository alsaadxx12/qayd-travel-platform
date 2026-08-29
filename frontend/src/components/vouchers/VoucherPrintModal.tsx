import React, { useState, useEffect } from 'react';
import { Modal, Button, Badge, Loader, Group, SegmentedControl } from '@mantine/core';
import {
  IconPrinter,
  IconReceipt,
  IconLanguage,
  IconFileTypePdf,
} from '@tabler/icons-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { fetchPrintTemplate } from '../../api/printTemplates';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { useLanguageStore } from '../../store/useLanguageStore';
import { tafqeetArabic } from '../reports/AccountStatementPrintModal';

export type VoucherType = 'RECEIPT' | 'PAYMENT' | 'JOURNAL';

export interface VoucherPrintItem {
  id?: string;
  voucherNumber: string;
  type: VoucherType;
  date: string;
  amount: number;
  currency?: string;
  accountName: string;
  accountCode?: string;
  accountPhone?: string;
  cashboxName?: string;
  reference?: string;
  description?: string;
  costCenter?: string;
  user?: string;
  receivedFromOrPaidTo?: string;
}

export const DEFAULT_VOUCHER_CONFIG = {
  companyName: 'شركة الروضتين للسفر والسياحة',
  companyNameEn: 'Al-Rawdatan Travel & Tourism',
  subtitle: 'قسم الحسابات والإدارة المالية',
  subtitleEn: 'Financial & Accounting Department',
  commercialReg: 'س.ت: 90182471 / بغداد',
  taxNumber: 'الرقم الضريبي: 300012345600003',
  phone: '+964 770 123 4567',
  email: 'finance@alrawdatan-travel.com',
  address: 'العراق — كربلاء المقدسة / بغداد',
  logoUrl: '',
  logoWidth: 70,
  logoHeight: 70,
  primaryColor: '#059669', // Emerald for Receipt, Rose for Payment by default
  headerBgColor: '#059669',
  fontFamily: 'IBM Plex Sans Arabic',
  isTableBold: false,
  showWatermark: true,
  watermarkText: 'سند مالي رسمي معتمد',
  showQrCode: true,
  showSignatures: true,
  showTafqeet: true,
  managerSignTitle: 'توقيع المدير العام / المعتمد',
  accountantSignTitle: 'توقيع المحاسب / أمين الصندوق',
  receiverSignTitle: 'توقيع المستلم / الدافع',
  notesText: 'ملاحظة: يعتبر هذا السند إشعاراً ووصلاً رسمياً معتمداً ومسجلاً في قيود النظام المحاسبي.',
  footerText: 'شركة الروضتين للسفر والسياحة — هاتف خدمة العملاء: 6012 — جميع الحقوق محفوظة © 2026',
  fontSizes: {
    companyTitle: 16,
    subtitle: 11,
    docTitle: 14,
    body: 11,
    amount: 17,
  },
};

export const DEFAULT_PAYMENT_VOUCHER_CONFIG = {
  ...DEFAULT_VOUCHER_CONFIG,
  primaryColor: '#e11d48', // Rose / Red for payment
  headerBgColor: '#e11d48',
};

// ── Printable Voucher Sheet Component ──
export interface PrintableVoucherSheetProps {
  voucher: VoucherPrintItem;
  config?: any;
  lang?: 'ar' | 'en';
}

export const PrintableVoucherSheet: React.FC<PrintableVoucherSheetProps> = ({
  voucher,
  config: userConfig,
  lang = 'ar',
}) => {
  const isEn = lang === 'en';
  const isReceipt = voucher.type === 'RECEIPT';
  const defaultConfig = isReceipt ? DEFAULT_VOUCHER_CONFIG : DEFAULT_PAYMENT_VOUCHER_CONFIG;
  const cfg = { ...defaultConfig, ...userConfig };

  const primaryColor = cfg.primaryColor || (isReceipt ? '#059669' : '#e11d48');
  const headerBgColor = cfg.headerBgColor || primaryColor;
  const currencySymbol = voucher.currency === 'USD' || voucher.currency === '$' ? '$' : (isEn ? 'IQD' : 'د.ع');
  const amountFormatted = Number(voucher.amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  const tafqeetText = tafqeetArabic(voucher.amount || 0);

  const docTitleAr = isReceipt ? 'سَنَـد قَبْـض مَالِي' : 'سَنَـد صَـرْف وَدَفْـع مَالِي';
  const docTitleEn = isReceipt ? 'OFFICIAL RECEIPT VOUCHER' : 'OFFICIAL PAYMENT VOUCHER';

  const partyLabel = isReceipt
    ? (isEn ? 'Received From:' : 'استلمنا من السيد / السادة:')
    : (isEn ? 'Pay To:' : 'ادفعوا للسيد / السادة:');

  const methodLabel = isReceipt
    ? (isEn ? 'Deposit Cashbox / Bank:' : 'الصندوق / الحساب المودع فيه:')
    : (isEn ? 'Disbursement Cashbox / Bank:' : 'الصندوق / الحساب المصروف منه:');

  return (
    <div
      id="printable-voucher-sheet"
      className="bg-white text-slate-900 mx-auto relative select-text"
      dir={isEn ? 'ltr' : 'rtl'}
      style={{
        width: '100%',
        maxWidth: '210mm',
        minHeight: '148mm', // Half A4 or full A4
        padding: '12mm 14mm',
        fontFamily: cfg.fontFamily || "'IBM Plex Sans Arabic', sans-serif",
        boxSizing: 'border-box',
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ── Watermark (Optional) ── */}
      {cfg.showWatermark && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden"
          style={{ zIndex: 0 }}
        >
          <span
            className="font-black text-slate-100 uppercase tracking-widest"
            style={{
              fontSize: '48px',
              transform: 'rotate(-25deg)',
              opacity: 0.35,
              whiteSpace: 'nowrap',
              color: primaryColor,
            }}
          >
            {cfg.watermarkText || (isReceipt ? 'RECEIPT VOUCHER' : 'PAYMENT VOUCHER')}
          </span>
        </div>
      )}

      <div className="relative" style={{ zIndex: 1 }}>
        {/* ── 1. Official Header ── */}
        <div className="flex items-start justify-between border-b-2 pb-4 mb-4" style={{ borderColor: primaryColor }}>
          {/* Company Details (Right in RTL / Left in LTR) */}
          <div className="space-y-1 max-w-[65%]">
            <h1
              className="font-black leading-tight"
              style={{
                fontSize: `${cfg.fontSizes?.companyTitle || 16}px`,
                color: '#0f172a',
              }}
            >
              {isEn ? (cfg.companyNameEn || cfg.companyName) : cfg.companyName}
            </h1>
            <p
              className="font-bold text-slate-600 text-xs"
              style={{ fontSize: `${cfg.fontSizes?.subtitle || 11}px` }}
            >
              {isEn ? (cfg.subtitleEn || cfg.subtitle) : cfg.subtitle}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-slate-500 font-bold pt-1">
              {cfg.commercialReg && <span>{cfg.commercialReg}</span>}
              {cfg.taxNumber && <span>{cfg.taxNumber}</span>}
              {cfg.phone && <span dir="ltr">📞 {cfg.phone}</span>}
              {cfg.address && <span>📍 {cfg.address}</span>}
            </div>
          </div>

          {/* Logo & Document Reference */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            {cfg.logoUrl ? (
              <img
                src={cfg.logoUrl}
                alt="Company Logo"
                style={{
                  width: `${cfg.logoWidth || 70}px`,
                  height: `${cfg.logoHeight || 70}px`,
                  objectFit: 'contain',
                  borderRadius: '8px',
                }}
              />
            ) : (
              <div
                className="rounded-xl flex items-center justify-center font-bold text-white shadow-xs"
                style={{
                  width: `${cfg.logoWidth || 60}px`,
                  height: `${cfg.logoHeight || 60}px`,
                  backgroundColor: primaryColor,
                }}
              >
                <IconReceipt size={32} />
              </div>
            )}
          </div>
        </div>

        {/* ── 2. Document Title Banner & Meta Grid ── */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 p-3 rounded-xl mb-4 border" style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
          {/* Badge & Voucher Type */}
          <div className="flex items-center gap-2.5">
            <div
              className="px-3.5 py-1.5 rounded-lg text-white font-black text-xs md:text-sm tracking-wide shadow-xs flex items-center gap-1.5"
              style={{ backgroundColor: headerBgColor }}
            >
              <IconReceipt size={16} />
              <span>{isEn ? docTitleEn : docTitleAr}</span>
            </div>
            <span className="text-xs font-bold text-slate-500">
              {isEn ? (isReceipt ? 'Credit Slip' : 'Debit Slip') : (isReceipt ? 'إشعار قبض معتمد' : 'إشعار صرف معتمد')}
            </span>
          </div>

          {/* Number & Date Meta */}
          <div className="flex items-center gap-4 text-xs">
            <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
              <span className="text-slate-400 font-bold text-[10px] block">{isEn ? 'Voucher No:' : 'رقم السند:'}</span>
              <strong className="font-mono font-black text-sm tracking-wider" style={{ color: primaryColor }}>
                {voucher.voucherNumber || 'RV-0000'}
              </strong>
            </div>
            <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
              <span className="text-slate-400 font-bold text-[10px] block">{isEn ? 'Date:' : 'التاريخ:'}</span>
              <strong className="font-mono font-bold text-slate-800 text-xs">
                {voucher.date ? new Date(voucher.date).toLocaleDateString(isEn ? 'en-US' : 'ar-IQ') : '-'}
              </strong>
            </div>
          </div>
        </div>

        {/* ── 3. Big Amount Hero Banner ── */}
        <div
          className="p-3.5 rounded-xl border mb-4 flex items-center justify-between flex-wrap gap-2"
          style={{
            backgroundColor: isReceipt ? '#ecfdf5' : '#fff1f2',
            borderColor: isReceipt ? '#a7f3d0' : '#fecdd3',
          }}
        >
          <div>
            <span className="text-xs font-bold block" style={{ color: primaryColor }}>
              {isEn ? 'Total Amount Received / Paid:' : 'المبلغ المالي الصافي:'}
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span
                className="font-mono font-black tracking-tight"
                style={{
                  fontSize: `${cfg.fontSizes?.amount || 20}px`,
                  color: primaryColor,
                }}
              >
                {amountFormatted}
              </span>
              <span className="font-bold text-xs text-slate-700 font-mono">
                {currencySymbol} ({voucher.currency || (isEn ? 'IQD' : 'د.ع')})
              </span>
            </div>
          </div>

          {/* Tafqeet (Amount in words) */}
          {cfg.showTafqeet && (
            <div className="max-w-[60%] text-start bg-white/80 px-3 py-2 rounded-lg border border-slate-200/80">
              <span className="text-[10px] font-bold text-slate-400 block">{isEn ? 'Amount in Words:' : 'المبلغ كتابةً:'}</span>
              <span className="text-xs font-bold text-slate-800 leading-snug">
                {tafqeetText}
              </span>
            </div>
          )}
        </div>

        {/* ── 4. Main Voucher Details Grid ── */}
        <div className="space-y-2.5 text-xs mb-4">
          {/* Party (Account Name) */}
          <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="font-bold text-slate-600 shrink-0 w-44">{partyLabel}</span>
            <strong className="font-black text-slate-900 text-[13px] text-end flex-1">
              {voucher.accountCode ? `${voucher.accountCode} — ` : ''}{voucher.accountName}
            </strong>
          </div>

          {/* Payment Method & Cashbox */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="font-bold text-slate-600 shrink-0">{methodLabel}</span>
              <span className="font-bold text-slate-900 text-end truncate">
                {voucher.cashboxName || (isEn ? 'Main Cashbox' : 'الصندوق الرئيسي')}
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="font-bold text-slate-600 shrink-0">{isEn ? 'Ref / Check No:' : 'المرجع / رقم الإشعار:'}</span>
              <span className="font-mono font-bold text-slate-800 text-end">
                {voucher.reference || '—'}
              </span>
            </div>
          </div>

          {/* Description & Accounting Purpose */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <span className="font-bold text-slate-500 text-[11px] block">
              {isEn ? 'Accounting Description & Details:' : 'البيان وشرح الحركة المحاسبية:'}
            </span>
            <p className="font-medium text-slate-800 text-xs leading-relaxed">
              {voucher.description || (isEn ? 'No description provided.' : 'لا يوجد شرح إضافي مسجل.')}
            </p>
          </div>
        </div>

        {/* ── 5. Notes & Verification ── */}
        <div className="flex items-center justify-between gap-4 py-2 border-t border-b border-slate-200 mb-6 text-[11px] text-slate-600">
          <p className="font-bold max-w-[75%] leading-relaxed">
            {cfg.notesText || 'ملاحظة: هذا السند يعتبر إشعاراً رسمياً مسجلاً ومعتمداً في قيود الحسابات.'}
          </p>

          {cfg.showQrCode && (
            <div className="shrink-0 flex items-center gap-2 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
              <div className="text-[9px] font-bold text-slate-500 text-end">
                <span>{isEn ? 'Verified' : 'موثق'}</span>
                <span className="block font-mono text-[8px] text-slate-400">QR-AUTH</span>
              </div>
              <div className="w-8 h-8 bg-slate-900 rounded p-1 flex items-center justify-center text-white">
                <svg viewBox="0 0 100 100" className="w-full h-full fill-white">
                  <rect x="5" y="5" width="35" height="35" />
                  <rect x="12" y="12" width="21" height="21" fill="#0f172a" />
                  <rect x="60" y="5" width="35" height="35" />
                  <rect x="67" y="12" width="21" height="21" fill="#0f172a" />
                  <rect x="5" y="60" width="35" height="35" />
                  <rect x="12" y="67" width="21" height="21" fill="#0f172a" />
                  <rect x="45" y="45" width="10" height="10" />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* ── 6. Signatures Grid ── */}
        {cfg.showSignatures && (
          <div className="grid grid-cols-3 gap-4 text-center pt-2 mb-4">
            <div className="space-y-6">
              <span className="font-bold text-slate-700 text-xs block">
                {cfg.receiverSignTitle || (isReceipt ? 'توقيع المستلم' : 'توقيع الدافع')}
              </span>
              <div className="h-8 border-b border-dashed border-slate-300 mx-4"></div>
            </div>

            <div className="space-y-6">
              <span className="font-bold text-slate-700 text-xs block">
                {cfg.accountantSignTitle || 'توقيع المحاسب / الصندوق'}
              </span>
              <div className="h-8 border-b border-dashed border-slate-300 mx-4"></div>
            </div>

            <div className="space-y-6">
              <span className="font-bold text-slate-700 text-xs block">
                {cfg.managerSignTitle || 'توقيع المدير المالي'}
              </span>
              <div className="h-8 border-b border-dashed border-slate-300 mx-4"></div>
            </div>
          </div>
        )}

        {/* ── 7. Footer ── */}
        <div className="pt-2 text-center text-[10px] text-slate-400 font-bold border-t border-slate-100 flex items-center justify-between">
          <span>{voucher.user ? `بواسطة: ${voucher.user}` : 'النظام المحاسبي'}</span>
          <span>{cfg.footerText}</span>
          <span dir="ltr">{new Date().toISOString().split('T')[0]}</span>
        </div>
      </div>
    </div>
  );
};

// ── Interactive Voucher Print Modal ──
export interface VoucherPrintModalProps {
  opened: boolean;
  onClose: () => void;
  voucher: VoucherPrintItem | null;
}

export const VoucherPrintModal: React.FC<VoucherPrintModalProps> = ({
  opened,
  onClose,
  voucher,
}) => {
  const { language } = useLanguageStore();
  const [printLang, setPrintLang] = useState<'ar' | 'en'>(language === 'en' ? 'en' : 'ar');
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!opened || !voucher) return;
    setLoading(true);
    const docType = voucher.type === 'RECEIPT' ? 'receipt_voucher' : 'payment_voucher';
    fetchPrintTemplate(docType)
      .then((res) => {
        if (res && res.config) {
          setConfig(res.config);
        } else {
          setConfig(voucher.type === 'RECEIPT' ? DEFAULT_VOUCHER_CONFIG : DEFAULT_PAYMENT_VOUCHER_CONFIG);
        }
      })
      .catch(() => {
        setConfig(voucher.type === 'RECEIPT' ? DEFAULT_VOUCHER_CONFIG : DEFAULT_PAYMENT_VOUCHER_CONFIG);
      })
      .finally(() => setLoading(false));
  }, [opened, voucher]);

  if (!voucher) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleExportPdf = async () => {
    const element = document.getElementById('printable-voucher-sheet');
    if (!element) return;
    setExporting(true);
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

      const filename = `voucher_${voucher.voucherNumber || 'doc'}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(filename);
      showSuccessNotification(
        printLang === 'en' ? 'Downloaded' : 'تم التحميل',
        printLang === 'en' ? 'Voucher PDF exported successfully' : 'تم تصدير وحفظ السند المالي بصيغة PDF فورياً'
      );
    } catch (err: any) {
      console.error('Voucher PDF export failed:', err);
      handlePrint();
    } finally {
      setExporting(false);
    }
  };

  const isReceipt = voucher.type === 'RECEIPT';

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="xl"
      title={
        <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm">
          <IconReceipt size={18} className={isReceipt ? 'text-emerald-600' : 'text-rose-600'} />
          <span>
            {printLang === 'en'
              ? `Preview & Export Voucher [${voucher.voucherNumber}]`
              : `معاينة وتصدير ${isReceipt ? 'سند القبض' : 'سند الدفع'} [${voucher.voucherNumber}]`}
          </span>
        </div>
      }
      styles={{ body: { padding: '1rem' } }}
    >
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 6mm !important; }
          body, html { background: #ffffff !important; color: #000000 !important; margin: 0 !important; padding: 0 !important; }
          .no-print, header, nav, aside, footer, button, .mantine-Modal-header, .mantine-Modal-close, .mantine-Overlay-root { display: none !important; }
          .mantine-Modal-content { box-shadow: none !important; border: none !important; padding: 0 !important; margin: 0 !important; width: 100% !important; background: transparent !important; }
          #printable-voucher-sheet { width: 100% !important; max-width: 210mm !important; margin: 0 auto !important; box-shadow: none !important; border: none !important; }
        }
      `}</style>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 space-y-3">
          <Loader color={isReceipt ? 'emerald' : 'red'} size="md" />
          <span className="text-xs font-bold text-slate-600">
            {printLang === 'en' ? 'Fetching approved template...' : 'جارٍ استجلاب قالب السند المعتمد...'}
          </span>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200 no-print">
            <div className="flex items-center gap-2">
              <Badge color={isReceipt ? 'emerald' : 'red'} size="md" variant="filled">
                {isReceipt ? (printLang === 'en' ? 'Receipt Voucher' : 'سند قبض معتمد ✓') : (printLang === 'en' ? 'Payment Voucher' : 'سند دفع معتمد ✓')}
              </Badge>
              <span className="text-xs font-bold text-slate-700">
                {voucher.accountName}
              </span>
            </div>

            <Group gap="xs">
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-0.5">
                <IconLanguage size={15} className="text-blue-600" />
                <SegmentedControl
                  size="xs"
                  value={printLang}
                  onChange={(v) => setPrintLang(v as 'ar' | 'en')}
                  data={[
                    { label: 'عربي', value: 'ar' },
                    { label: 'English', value: 'en' },
                  ]}
                  styles={{ root: { backgroundColor: 'transparent' } }}
                />
              </div>
              <Button
                size="xs"
                color={isReceipt ? 'teal' : 'rose'}
                leftSection={<IconFileTypePdf size={15} />}
                onClick={handleExportPdf}
                loading={exporting}
                className="font-bold shadow-xs"
              >
                {printLang === 'en' ? 'Export PDF' : 'تصدير PDF'}
              </Button>
              <Button
                size="xs"
                variant="light"
                color="gray"
                leftSection={<IconPrinter size={15} />}
                onClick={handlePrint}
                className="font-bold"
              >
                {printLang === 'en' ? 'Print' : 'طباعة 🖨️'}
              </Button>
              <Button size="xs" variant="subtle" color="gray" onClick={onClose}>
                {printLang === 'en' ? 'Close' : 'إغلاق'}
              </Button>
            </Group>
          </div>

          <div className="bg-slate-100/50 p-2 rounded-xl border border-slate-200 overflow-x-auto flex justify-center print:bg-white print:p-0 print:border-none">
            <PrintableVoucherSheet
              voucher={voucher}
              config={config}
              lang={printLang}
            />
          </div>
        </div>
      )}
    </Modal>
  );
};
