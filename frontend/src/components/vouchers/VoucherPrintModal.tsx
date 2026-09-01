import React, { useState, useEffect } from 'react';
import { Modal, Loader, TextInput } from '@mantine/core';
import {
  IconPrinter,
  IconReceipt,
  IconLanguage,
  IconFileTypePdf,
  IconUser,
  IconCoins,
  IconEdit,
  IconFileDescription,
  IconBuildingBank,
  IconWorld,
  IconMessageDots,
  IconCheck,
  IconCalendar,
  IconClock,
  IconFileText,
  IconMail,
  IconPhone,
  IconTag,
  IconDownload,
  IconX,
} from '@tabler/icons-react';
import { fetchPrintTemplate } from '../../api/printTemplates';
import { apiRequest } from '../../api/client';
import { generateChromiumPdf, serializeElementForChromium } from '../../utils/chromiumPdf';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { useLanguageStore } from '../../store/useLanguageStore';
import { tafqeetArabic } from '../reports/AccountStatementPrintModal';
import { FormalVoucherSheet } from './FormalVoucherSheet';

export type VoucherType = 'RECEIPT' | 'PAYMENT' | 'JOURNAL';

export interface VoucherPrintItem {
  id?: string;
  voucherNumber: string;
  type: VoucherType;
  date: string;
  amount: number;
  currency?: string;
  accountId?: string;
  accountName: string;
  accountCode?: string;
  accountPhone?: string;
  accountEmail?: string;
  cashboxName?: string;
  reference?: string;
  description?: string;
  costCenter?: string;
  user?: string;
  receivedFromOrPaidTo?: string;
  time?: string;
  customCategory?: string;
  splitDescription?: string;
  splitAccounts?: Array<{
    accountName: string;
    accountCode?: string;
    amount?: number;
    currency?: string;
    note?: string;
  }>;
}

function pickAccountEmail(source: any): string {
  if (!source) return '';
  const raw =
    source.accountEmail ||
    source.email ||
    source.account?.email ||
    source.customer?.email ||
    source.supplier?.email ||
    '';
  return String(raw).trim();
}

export function toVoucherPrintItem(row: any): VoucherPrintItem {
  return {
    id: row.id,
    voucherNumber: row.voucherNumber,
    type: row.type,
    date: row.date,
    amount: row.amount,
    currency: row.currency,
    accountId: row.accountId || row.account?.id,
    accountName: row.accountName || row.account?.nameAr || '',
    accountEmail: pickAccountEmail(row),
    accountPhone: row.accountPhone || row.account?.phone || row.customer?.phone,
    cashboxName: row.cashboxName,
    reference: row.reference,
    description: row.description,
    costCenter: row.costCenter || row.notes || '',
    user: row.userName || row.user,
    splitAccounts: row.splitAccounts,
    splitDescription: row.splitDescription,
    customCategory: row.customCategory,
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const DEFAULT_VOUCHER_CONFIG = {
  companyName: 'رودا 10 للبرمجيات والحلول المحاسبية',
  companyNameEn: 'RODA 10 Software & Accounting Solutions',
  /**
   * الوصف تحت اسم الشركة — فارغ ومُطفأ.
   *
   * كان نصّاً افتراضياً يُطبع على كل سند ولا حقل له في أي شاشة، فيراه صاحب الشركة
   * على ورقته الرسمية ولا يجد ما يحذفه به. والحقل موجود الآن في تبويب «الشركة»
   * ومفتاحه في «التخطيط»، فمن أراده كتبه وفعّله.
   */
  showSubtitle: false,
  subtitle: '',
  subtitleEn: '',
  commercialReg: 'س.ت: 90182471 / بغداد',
  taxNumber: 'الرقم الضريبي: 300012345600003',
  phone: '7714569870',
  email: 'info@roda10.com',
  website: 'www.roda10.com',
  address: 'العراق - بغداد - المنصور - شارع الصناعة',
  logoUrl: '',
  logoWidth: 140,
  logoHeight: 50,
  logoBorderRadius: 6,
  primaryColor: '#0066FF', // Vibrant Electric Blue
  headerBgColor: '#0066FF',
  fieldBgColor: '#F0F7FF',
  fieldBorderColor: '#BFDBFE',
  amountTextColor: '#0f172a',
  tafqeetTextColor: '#0066FF',
  summaryBorderColor: '#0066FF',
  summaryTotalColor: '#0066FF',
  statusColor: '#059669',
  watermarkColor: '#0066FF',
  fontFamily: 'IBM Plex Sans Arabic',
  isTableBold: false,
  showWatermark: true,
  watermarkText: 'نسخة رسمية',
  watermarkAngle: -24,
  watermarkOffsetX: 0,
  watermarkOffsetY: 0,
  watermarkSize: 76,
  watermarkOpacity: 0.055,
  showQrCode: true,
  showSignatures: true,
  showTafqeet: true,
  thankYouText: 'نشكر لكم ثقتكم ونتطلع إلى المزيد من التعاملات',
  payerSignTitle: 'توقيع الدافع / المسلّم للمبلغ',
  receiverSignTitle: 'توقيع المستلم / المحاسب',
  notesText: 'تم استلام المبلغ أعلاه، ويعتبر هذا السند حجة إثبات رسمية.',
  footerText: 'جميع الحقوق محفوظة © 2026',
  /**
   * مقاسات كُتبت للتخطيط العصري وحده، فصارت الآن مقاسات الورقة كلّها.
   *
   * منها ما لم يكن يقرؤه أحد قط (`companyTitle` و`subtitle` و`body` و`amount`) لأن
   * التخطيط العصري لا يستعمل غير `docTitle`، والتخطيط الرسمي كان يكتب مقاساته في
   * الكود. وحين صار الرسمي يقرؤها وجب أن تكون مقاساته هو: المبلغ 30 لا 19 — فالمبلغ
   * أكبر شيء على الورقة، وهو أصل الترتيب البصري فيها لا تفصيلاً من تفاصيله.
   */
  fontSizes: {
    companyTitle: 17,
    subtitle: 10,
    docTitle: 24,
    body: 11,
    label: 10,
    amount: 30,
  },

  /* ── التخطيط (تبويب «التخطيط» في إعدادات الطباعة) ──
     كلّ ما يلي يصف شكل الورقة لا ألوانها، وهو ما كان ينقص: الورق، الكثافة،
     الهوامش، شكل الترويسة، أي الحقول تُطبع وبأي ترتيب، والتواقيع والختم. */
  sheetStyle: 'formal' as 'formal' | 'modern',
  voucherPaperSize: 'A4' as 'A4' | 'A5' | 'THERMAL80',
  density: 'normal' as 'comfortable' | 'normal' | 'compact',
  marginMm: 14,
  copiesPerPage: 1 as 1 | 2,
  voucherHeaderStyle: 'rule' as 'band' | 'rule' | 'plain' | 'frame',
  logoPosition: 'start' as 'start' | 'center' | 'end',
  headerTextAlign: 'opposite' as 'opposite' | 'beside' | 'center',
  contactAlign: 'start' as 'start' | 'center' | 'end',
  showAddress: true,
  showPhone: true,
  showEmail: true,
  showWebsite: true,
  showCommercialReg: false,
  showTaxNumber: false,
  fieldOrder: ['party', 'amountWords', 'reason', 'split', 'paymentMethod', 'reference', 'notes'],
  hiddenFields: [] as string[],
  fieldLabels: {} as Record<string, string>,
  signatureTitles: ['توقيع الدافع / المسلِّم', 'توقيع المستلم / المحاسب'],
  showStamp: false,
  stampPosition: 'end' as 'start' | 'center' | 'end',
  stampText: 'الختم',

  /* ── شكل كل قسم على حدة ──
     أُضيفت لأن هذه المواضع بالذات كانت مكتوبة في الكود: شكل شريط الأرقام، وإطار
     المبلغ، وفواصل جدول الحقول، وعرض عمود التسميات، وخانة التوقيع. */
  metaStyle: 'inline' as 'inline' | 'box',
  amountStyle: 'rule' as 'rule' | 'panel' | 'accent',
  amountAlign: 'center' as 'center' | 'edge',
  tafqeetPlacement: 'underAmount' as 'underAmount' | 'field',
  fieldStyle: 'table' as 'lines' | 'grid' | 'zebra' | 'table',
  splitStyle: 'table' as 'inline' | 'table' | 'entry',
  splitRemainderLabel: 'جات النظام',
  labelWidth: 150,
  fieldLabelBg: '',
  fieldRowPadding: 8,
  printEmptyFields: ['notes'] as string[],
  signatureStyle: 'line' as 'line' | 'box',
  signatureHeight: 44,
  contactPlacement: 'footer' as 'header' | 'footer',
  fontScale: 100,
  textColor: '#0f172a',
  labelColor: '',
  footerTextColor: '',
};

export const DEFAULT_PAYMENT_VOUCHER_CONFIG = {
  ...DEFAULT_VOUCHER_CONFIG,
  primaryColor: '#0066FF',
  headerBgColor: '#0066FF',
  tafqeetTextColor: '#0066FF',
  summaryBorderColor: '#0066FF',
  summaryTotalColor: '#0066FF',
  payerSignTitle: 'توقيع المحاسب / الآمر بالصرف',
  receiverSignTitle: 'توقيع المستلم / المورد المستفيد',
};

// ── Printable Voucher Sheet Component (Centered Header, Centered Amounts, 2-Signatures) ──
export interface PrintableVoucherSheetProps {
  voucher: VoucherPrintItem;
  config?: any;
  lang?: 'ar' | 'en';
  /**
   * The counter-party account's statement barcode. Supplied by the modal; absent
   * when no barcode has been issued for that account, in which case nothing is
   * printed rather than a square that leads nowhere.
   */
  qrDataUrl?: string | null;
  /** Custom allocation accounts from system settings — used to resolve display names. */
  customAccounts?: Array<{ nameAr: string; targetAccountId: string; targetAccountName?: string }>;
  /** Design-preview only: outline the QR area when no code has been issued yet. */
  qrPlaceholder?: boolean;
}

export const PrintableVoucherSheet: React.FC<PrintableVoucherSheetProps> = ({
  voucher,
  config: userConfig,
  lang = 'ar',
  qrDataUrl,
  customAccounts,
  qrPlaceholder = false,
}) => {
  const isEn = lang === 'en';
  const isReceipt = voucher.type === 'RECEIPT';
  const defaultConfig = isReceipt ? DEFAULT_VOUCHER_CONFIG : DEFAULT_PAYMENT_VOUCHER_CONFIG;
  const cfg = { ...defaultConfig, ...userConfig };

  const primaryColor = cfg.primaryColor || '#0066FF';
  const headerBgColor = cfg.headerBgColor || primaryColor;
  const fieldBgColor = cfg.fieldBgColor || '#F0F7FF';
  const fieldBorderColor = cfg.fieldBorderColor || '#BFDBFE';
  const amountTextColor = cfg.amountTextColor || '#0f172a';
  const tafqeetTextColor = cfg.tafqeetTextColor || primaryColor;
  const summaryBorderColor = cfg.summaryBorderColor || primaryColor;
  const summaryTotalColor = cfg.summaryTotalColor || primaryColor;
  const statusColor = cfg.statusColor || '#059669';
  const watermarkColor = cfg.watermarkColor || primaryColor;

  const currencyCode = voucher.currency === 'USD' || voucher.currency === '$' ? 'USD' : 'IQD';
  const currencyNameAr = currencyCode === 'USD' ? 'دولار أمريكي (USD)' : 'دينار عراقي (IQD)';
  const currencyName = isEn ? (currencyCode === 'USD' ? 'US Dollar (USD)' : 'Iraqi Dinar (IQD)') : currencyNameAr;

  const amountFormatted = Number(voucher.amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const tafqeetText = tafqeetArabic(voucher.amount || 0, currencyCode);

  const docTitleAr = isReceipt ? 'سند قبض' : 'سند صرف ودفع';
  const docTitleEn = isReceipt ? 'RECEIPT VOUCHER' : 'PAYMENT VOUCHER';

  const cardTitleAr = isReceipt ? 'بيانات سند القبض' : 'بيانات سند الصرف والدفع';
  const cardTitleEn = isReceipt ? 'Receipt Voucher Details' : 'Payment Voucher Details';

  const partyNameRaw = voucher.accountName || (isEn ? 'Client / Entity' : 'العميل / الطرف المستفيد');
  const partyName = String(partyNameRaw)
    .replace(/^[\u200e\u200f]+/, '')
    .replace(/^[0-9٠-٩]{3,}\s*[-–—:\/]\s*/, '')
    .replace(/^[0-9٠-٩]{3,}\s+/, '')
    .trim() || String(partyNameRaw).trim();
  const partyLabelAr = isReceipt ? 'استلمنا من السيد/السادة :' : 'ادفعوا للسيد/السادة :';
  const partyLabelEn = isReceipt ? 'Received From:' : 'Paid To:';

  const splitAccountsList = voucher.splitAccounts && voucher.splitAccounts.length > 0
    ? voucher.splitAccounts
    : null;

  /**
   * Resolve custom display name (الاسم التعريفي) from system settings.
   * Falls back to account name, then generic label.
   */
  const resolveCustomDisplayName = (split: { accountName?: string; accountCode?: string; amount?: number }) => {
    if (customAccounts && customAccounts.length > 0) {
      // Match by accountId → targetAccountId, or by name substring
      const match = customAccounts.find(
        (ca) =>
          (split as any).accountId && ca.targetAccountId === (split as any).accountId ||
          (ca.targetAccountName && split.accountName && ca.targetAccountName.includes(split.accountName)) ||
          (split.accountName && ca.targetAccountName && split.accountName.includes(ca.targetAccountName?.split(' - ').pop() || ''))
      );
      if (match) return match.nameAr;
    }
    return split.accountName || '';
  };

  // Dynamic split label: show the custom display name (الاسم التعريفي) instead of the account name
  const splitLabelAr = (() => {
    if (splitAccountsList && splitAccountsList.length > 0) {
      const names = splitAccountsList.map((s: any) => resolveCustomDisplayName(s)).filter(Boolean);
      if (names.length > 0) return `${names.join(' ، ')} :`;
    }
    return isReceipt ? 'تقسيم القبض :' : 'تقسيم الصرف :';
  })();
  const splitLabelEn = (() => {
    if (splitAccountsList && splitAccountsList.length > 0) {
      const names = splitAccountsList.map((s: any) => resolveCustomDisplayName(s)).filter(Boolean);
      if (names.length > 0) return `${names.join(', ')}:`;
    }
    return isReceipt ? 'Split Receipt:' : 'Split Payment:';
  })();

  const defaultSplitText = isReceipt
    ? `حساب مخصص / مباشر على حـ (${partyName})`
    : `حساب مخصص / مباشر على حـ (${partyName})`;

  const splitDisplayVal = voucher.splitDescription
    || voucher.customCategory
    || (voucher.reference ? `حساب المقبوضات (${voucher.reference})` : defaultSplitText);

  const customCategoryVal = voucher.customCategory || voucher.reference
    ? (isEn ? `Transaction: ${voucher.reference || 'General Receipt'}` : `القبض المخصص: ${voucher.reference || 'قبض عام معتمد'}`)
    : (isEn ? 'General Receipt Voucher' : 'قبض نقدي / تحويل مالي معتمد');

  const dateFormatted = voucher.date
    ? new Date(voucher.date).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  const timeFormatted = voucher.time || '11:00 AM';
  const yearFormatted = dateFormatted.split('-')[0] || '2026';

  /**
   * التخطيط الرسمي — وهو الافتراضي الآن.
   *
   * صُمّم مكوّناً مستقلاً لا فرعاً داخل هذا المكوّن: التصميمان لا يتشاركان أي شيء من
   * البنية، وخلطهما بشروط داخل ملف واحد كان سيجعل تعديل أيّهما أصعب من تعديل
   * الاثنين منفصلين. و«العصري» (البطاقات الملوّنة) باقٍ كخيار — لم يُحذف شيء، إنما
   * لم يعد هو الافتراضي.
   *
   * أسماء التقسيم تُمرَّر محلولة (الاسم التعريفي من إعدادات النظام) كي لا يحتاج
   * التخطيط الرسمي بدوره إلى معرفة شيء عن الحسابات المخصصة.
   */
  if ((cfg.sheetStyle || 'formal') === 'formal') {
    const resolvedVoucher = splitAccountsList
      ? {
          ...voucher,
          accountName: partyName,
          splitAccounts: splitAccountsList.map((sp: any) => ({
            ...sp,
            accountName: resolveCustomDisplayName(sp) || sp.accountName,
          })),
        }
      : { ...voucher, accountName: partyName };

    return (
      <div id="printable-voucher-sheet">
        <FormalVoucherSheet
          voucher={resolvedVoucher}
          config={cfg}
          lang={lang}
          qrDataUrl={qrDataUrl}
          qrPlaceholder={qrPlaceholder}
        />
      </div>
    );
  }

  const logoUrl = cfg.logoUrl || '';

  const topPadding = cfg.headerMarginTop !== undefined
    ? `${cfg.headerMarginTop}mm`
    : (cfg.useFullHeaderImage ? '4mm' : '10mm');

  return (
    <div
      id="printable-voucher-sheet"
      className="bg-white text-slate-900 mx-auto relative select-text"
      dir={isEn ? 'ltr' : 'rtl'}
      lang={isEn ? 'en' : 'ar'}
      style={{
        width: '100%',
        maxWidth: '210mm',
        minHeight: '297mm', // Standard A4
        padding: `${topPadding} 14mm 10mm 14mm`,
        fontFamily: cfg.fontFamily || "'IBM Plex Sans Arabic', sans-serif",
        boxSizing: 'border-box',
        backgroundColor: '#ffffff',
        position: 'relative',
        overflow: 'visible',
        color: '#1e293b',
      }}
    >
      {/* ── Background Watermark ── */}
      {cfg.showWatermark && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden"
          style={{ zIndex: 0 }}
        >
          <span
            className="font-black select-none"
            style={{
              fontSize: '85px',
              transform: 'rotate(-28deg)',
              opacity: 0.045,
              whiteSpace: 'nowrap',
              color: watermarkColor,
              fontWeight: 700,
              letterSpacing: 0,
            }}
          >
            {cfg.watermarkText || 'نسخة رسمية'}
          </span>
        </div>
      )}

      <div className="relative flex flex-col justify-between" style={{ zIndex: 1, minHeight: '275mm' }}>
        <div>
          {/* ═══════════════════════════════════════════════════════
              1. TOP HEADER SECTION
                 - Option A: Full Header Banner Image + Single Horizontal Meta Bar (No standalone title)
                 - Option B: 3-Section Clean Header (Meta Right, Title Center, Logo Left)
             ═══════════════════════════════════════════════════════ */}
          {cfg.useFullHeaderImage && cfg.headerImageUrl ? (
            <div
              className="space-y-2 pb-1.5 mb-3.5 border-b border-slate-100 transition-transform"
              style={{
                marginTop: `${cfg.bannerOffsetY || 0}px`,
              }}
            >
              {/* Full Width Header Banner Image (Flush Top & Full Width) */}
              <div className="w-full flex items-center justify-center overflow-hidden rounded-lg bg-white">
                <img
                  src={cfg.headerImageUrl}
                  alt="Header Banner"
                  className="w-full object-contain"
                  style={{
                    maxHeight: `${cfg.headerImageHeight || 115}px`,
                    borderRadius: `${cfg.headerImageBorderRadius || 6}px`,
                  }}
                />
              </div>

              {/* Single Horizontal Meta Bar across the width (رقم السند، التاريخ، وقت الإصدار، الصفحة) */}
              <div
                className="rounded-xl border p-2 px-4 flex items-center justify-between gap-3 shadow-2xs text-xs font-bold"
                style={{
                  backgroundColor: fieldBgColor,
                  borderColor: fieldBorderColor,
                }}
              >
                {/* رقم السند */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600 font-bold">{isEn ? 'Voucher No :' : 'رقم السند :'}</span>
                  <span
                    className="font-mono font-black tracking-wider text-xs px-2.5 py-0.5 rounded-lg bg-white border"
                    dir="ltr"
                    style={{ color: primaryColor, borderColor: fieldBorderColor }}
                  >
                    {voucher.voucherNumber || 'RCV-2025-000123'}
                  </span>
                </div>

                {/* التاريخ */}
                <div className="flex items-center gap-1.5 border-r border-slate-300 pr-3">
                  <IconCalendar size={13} className="text-slate-400" />
                  <span className="text-slate-600 font-bold">{isEn ? 'Date :' : 'التاريخ :'}</span>
                  <span className="font-mono font-bold text-slate-800" dir="ltr">{dateFormatted}</span>
                </div>

                {/* وقت الإصدار */}
                <div className="flex items-center gap-1.5 border-r border-slate-300 pr-3">
                  <IconClock size={13} className="text-slate-400" />
                  <span className="text-slate-600 font-bold">{isEn ? 'Issue Time :' : 'وقت الإصدار :'}</span>
                  <span className="font-mono font-bold text-slate-800" dir="ltr">{timeFormatted}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4 pb-4 mb-5 border-b border-slate-100">
              {/*
                صندوق رقم السند والتاريخ والوقت.

                كان ينكسر: الصندوق عرضه ثابت تقريباً (minWidth 210) وقابل للانكماش داخل
                صفّ flex، وخلايا القيم بلا nowrap — فرقم مثل KAB-RV-2026-01029 ينقسم على
                سطرين، ويصطدم التاريخ بالوقت. الآن الصندوق لا ينكمش (shrink-0) ولا تنكسر
                القيم، فيتّسع الصندوق لمحتواه بدل أن يُقسّمه.
              */}
              <table
                className="shrink-0"
                style={{
                  width: 'auto',
                  borderCollapse: 'collapse',
                  border: `1px solid ${fieldBorderColor}`,
                  borderRadius: 12,
                  background: '#ffffff',
                  fontSize: 12,
                  fontWeight: 700,
                  tableLayout: 'auto',
                }}
              >
                <tbody>
                  <tr>
                    <td style={{ padding: '8px 10px', lineHeight: 1.6, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                      {isEn ? 'Voucher No :' : 'رقم السند :'}
                    </td>
                    <td
                      dir="ltr"
                      style={{ padding: '8px 10px', lineHeight: 1.6, textAlign: 'left', color: primaryColor, fontFamily: 'monospace', verticalAlign: 'middle', whiteSpace: 'nowrap' }}
                    >
                      {voucher.voucherNumber || 'RCV-2025-000123'}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px 10px', lineHeight: 1.6, whiteSpace: 'nowrap', verticalAlign: 'middle', borderTop: '1px solid #f1f5f9' }}>
                      {isEn ? 'Date :' : 'التاريخ :'}
                    </td>
                    <td
                      dir="ltr"
                      style={{ padding: '8px 10px', lineHeight: 1.6, textAlign: 'left', borderTop: '1px solid #f1f5f9', fontFamily: 'monospace', verticalAlign: 'middle', whiteSpace: 'nowrap' }}
                    >
                      {dateFormatted}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px 10px', lineHeight: 1.6, whiteSpace: 'nowrap', verticalAlign: 'middle', borderTop: '1px solid #f1f5f9' }}>
                      {isEn ? 'Issue Time :' : 'وقت الإصدار :'}
                    </td>
                    <td
                      dir="ltr"
                      style={{ padding: '8px 10px', lineHeight: 1.6, textAlign: 'left', borderTop: '1px solid #f1f5f9', fontFamily: 'monospace', verticalAlign: 'middle', whiteSpace: 'nowrap' }}
                    >
                      {timeFormatted}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Header Center (CENTERED): Clean Document Icon & Title Only */}
              <div className="flex-1 min-w-0 flex flex-col items-center justify-center text-center pt-1">
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center mb-1 shadow-2xs"
                  style={{ backgroundColor: fieldBgColor, border: `1.5px solid ${primaryColor}` }}
                >
                  <div className="relative">
                    <IconFileText size={22} style={{ color: primaryColor }} />
                    <div
                      className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-white"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <span className="text-[8px] font-black leading-none">↓</span>
                    </div>
                  </div>
                </div>

                <div
                  dir={isEn ? 'ltr' : 'rtl'}
                  className="font-bold"
                  style={{
                    fontSize: `${cfg.fontSizes?.docTitle || 24}px`,
                    color: '#0f172a',
                    letterSpacing: 0,
                    fontWeight: 700,
                    unicodeBidi: 'normal',
                  }}
                >
                  {isEn ? docTitleEn : docTitleAr}
                </div>
                <div className="w-12 h-0.5 mt-1 rounded-full" style={{ backgroundColor: primaryColor }} />
              </div>

              {/* Header Left (in RTL): Company Logo ONLY (No address or phone) */}
              <div className="shrink-0 flex items-center justify-end" style={{ minWidth: 140 }}>
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Company Logo"
                    style={{
                      maxHeight: cfg.logoHeight ? `${cfg.logoHeight}px` : '55px',
                      maxWidth: cfg.logoWidth ? `${cfg.logoWidth}px` : '180px',
                      objectFit: 'contain',
                      borderRadius: `${cfg.logoBorderRadius || 6}px`,
                    }}
                  />
                ) : (
                  <div className="flex items-center gap-1 font-black text-2xl tracking-tight">
                    <span style={{ color: primaryColor }}>RODA</span>
                    <span style={{ color: '#FF7A00' }}>10</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              2. MAIN CARD: بيانات سند القبض / الصرف
             ═══════════════════════════════════════════════════════ */}
          <div
            className="rounded-2xl border-2 bg-white relative p-5 pt-7 mb-5 shadow-2xs space-y-3.5"
            style={{ borderColor: primaryColor }}
          >
            {/* Top Pill Badge (Floating on Card Header) */}
            <div
              dir={isEn ? 'ltr' : 'rtl'}
              className="absolute -top-3.5 right-6 px-5 py-1 rounded-full text-white font-bold text-xs shadow-xs flex items-center gap-1.5"
              style={{ backgroundColor: headerBgColor, letterSpacing: 0, fontWeight: 700, unicodeBidi: 'normal' }}
            >
              <span>{isEn ? cardTitleEn : cardTitleAr}</span>
            </div>

            {/* Field 1: استلمنا من السيد/السادة */}
            <div className="flex items-center gap-3">
              <span className="font-black text-xs text-slate-700 flex items-center gap-1.5 w-32 shrink-0">
                <IconUser size={16} style={{ color: primaryColor }} />
                <span>{isEn ? partyLabelEn : partyLabelAr}</span>
              </span>
              <div
                className="flex-1 rounded-xl p-2.5 px-4 font-black text-sm text-slate-900 border text-center"
                style={{ backgroundColor: fieldBgColor, borderColor: fieldBorderColor }}
              >
                {partyName || 'شركة النور للتجارة العامة'}
              </div>
            </div>

            {/* Field 2: المبلغ رقماً (CENTERED AMOUNT) + شارة العملة الأنيقة على الطرف دون التأثير على التوسط */}
            <div className="flex items-center gap-3">
              <span className="font-black text-xs text-slate-700 flex items-center gap-1.5 w-32 shrink-0">
                <IconCoins size={16} style={{ color: primaryColor }} />
                <span>{isEn ? 'Amount (Digits) :' : 'المبلغ رقماً :'}</span>
              </span>

              <div
                className="flex-1 relative flex items-center justify-center rounded-xl p-2.5 px-4 min-h-[44px] border shadow-2xs"
                style={{
                  backgroundColor: fieldBgColor,
                  borderColor: fieldBorderColor,
                }}
              >
                {/* المبلغ في الوسط تماماً 100% بدون أي انزياح */}
                <div
                  className="font-mono font-black text-xl text-center"
                  style={{ color: amountTextColor, letterSpacing: 0 }}
                >
                  {amountFormatted}
                </div>

                {/*
                  رمز العملة فقط — بلا حاوية.

                  كان هنا صندوق أبيض بحدّ وظلّ يحمل «دينار عراقي (IQD)» داخل حقل
                  المبلغ، أي حاوية داخل حاوية، والاسم الكامل يزاحم الرقم وهو أهمّ ما
                  في السند. الرمز وحده (IQD / USD) يكفي محاسبياً ويُقرأ فوراً.
                */}
                <span
                  className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-black text-xs"
                  style={{ color: primaryColor }}
                >
                  {currencyCode}
                </span>
              </div>
            </div>

            {/* Field 3: المبلغ كتابة (CENTERED TAFQEET) */}
            {cfg.showTafqeet && (
              <div className="flex items-center gap-3">
                <span className="font-black text-xs text-slate-700 flex items-center gap-1.5 w-32 shrink-0">
                  <IconEdit size={16} style={{ color: primaryColor }} />
                  <span>{isEn ? 'Amount (Words) :' : 'المبلغ كتابة :'}</span>
                </span>

                <div
                  className="flex-1 rounded-xl p-2.5 px-4 text-center font-bold text-xs border"
                  style={{
                    backgroundColor: fieldBgColor,
                    borderColor: fieldBorderColor,
                    color: tafqeetTextColor,
                  }}
                >
                  {tafqeetText || 'مائتان وخمسون ألف دينار عراقي لا غير'}
                </div>
              </div>
            )}

            {/* Field 4: وذلك عن */}
            <div className="flex items-center gap-3">
              <span className="font-black text-xs text-slate-700 flex items-center gap-1.5 w-32 shrink-0">
                <IconFileDescription size={16} style={{ color: primaryColor }} />
                <span>{isEn ? 'Being For :' : 'وذلك عن :'}</span>
              </span>

              <div
                className="flex-1 rounded-xl p-2.5 px-4 text-center font-bold text-xs text-slate-800 border"
                style={{
                  backgroundColor: fieldBgColor,
                  borderColor: fieldBorderColor,
                }}
              >
                {voucher.description || 'تسديد جزء من قيمة الفاتورة رقم INV-2025-0456'}
              </div>
            </div>

            {/* Field 5: تقسيم القبض / تقسيم الصرف (بسطر لوحده ممتد) */}
            <div className="flex items-center gap-3">
              <span className="font-black text-xs text-slate-700 flex items-center gap-1.5 w-32 shrink-0">
                <IconTag size={16} style={{ color: primaryColor }} />
                <span>{isEn ? splitLabelEn : splitLabelAr}</span>
              </span>

              <div
                className="flex-1 rounded-xl p-2.5 px-4 font-bold text-xs text-slate-800 text-center"
                style={{
                  letterSpacing: 0,
                  lineHeight: 1.6,
                  background: 'transparent',
                  border: 'none',
                }}
              >
                {splitAccountsList
                  ? splitAccountsList
                      .map((item) =>
                        item.amount
                          ? `${Number(item.amount).toLocaleString('en-US')} ${item.currency || currencyCode}`
                          : '',
                      )
                      .filter(Boolean)
                      .join('  ·  ') || splitDisplayVal
                  : splitDisplayVal}
              </div>
            </div>

            {/* Field 6: ملاحظات */}
            <div className="flex items-start gap-3">
              <span className="font-black text-xs text-slate-700 flex items-center gap-1.5 w-32 shrink-0 pt-2">
                <IconMessageDots size={16} style={{ color: primaryColor }} />
                <span>{isEn ? 'Notes :' : 'ملاحظات :'}</span>
              </span>

              <div
                className="flex-1 rounded-xl p-4 px-4 font-bold text-xs text-slate-700 border min-h-[110px] leading-relaxed text-center"
                style={{
                  backgroundColor: fieldBgColor,
                  borderColor: fieldBorderColor,
                }}
              >
                {voucher.reference
                  ? `المرجع: ${voucher.reference} — ${cfg.notesText || 'تحويل من حساب شركة النور للتجارة العامة'}`
                  : (cfg.notesText || 'تحويل من حساب شركة النور للتجارة العامة')}
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════
              3. SUMMARY CARD: ملخص السند (3 CENTERED COLUMNS)
             ═══════════════════════════════════════════════════════ */}
          <div
            className="rounded-2xl border-2 bg-white relative p-3.5 mb-5 shadow-2xs"
            style={{ borderColor: summaryBorderColor }}
          >
            {/* Top Pill Badge */}
            <div
              dir={isEn ? 'ltr' : 'rtl'}
              className="absolute -top-3.5 right-6 px-4 py-1 rounded-full text-white font-bold text-xs shadow-xs flex items-center gap-1"
              style={{ backgroundColor: headerBgColor, letterSpacing: 0, fontWeight: 700, unicodeBidi: 'normal' }}
            >
              <span>{isEn ? 'Voucher Summary' : 'ملخص السند'}</span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center pt-2">
              {/* إجمالي المبلغ (CENTERED) */}
              <div className="space-y-1">
                <span className="font-black text-[11px] text-slate-600 flex items-center justify-center gap-1">
                  <IconCoins size={13} style={{ color: primaryColor }} />
                  <span>{isEn ? 'Total Amount :' : 'إجمالي المبلغ :'}</span>
                </span>
                <div className="font-mono font-black text-base" style={{ color: summaryTotalColor, letterSpacing: 0 }}>
                  {amountFormatted} {currencyCode}
                </div>
              </div>

              {/* العملة (CENTERED) */}
              <div className="space-y-1 border-r border-l border-slate-200">
                <span className="font-black text-[11px] text-slate-600 flex items-center justify-center gap-1">
                  <IconWorld size={13} style={{ color: primaryColor }} />
                  <span>{isEn ? 'Currency :' : 'العملة :'}</span>
                </span>
                <div className="font-mono font-black text-xs text-slate-800">
                  {currencyCode}
                </div>
              </div>

              {/* الحالة (CENTERED) */}
              <div className="space-y-1">
                <span className="font-black text-[11px] text-slate-600 flex items-center justify-center gap-1">
                  <IconCheck size={13} style={{ color: statusColor }} />
                  <span>{isEn ? 'Status :' : 'الحالة :'}</span>
                </span>
                <div className="font-black text-xs" style={{ color: statusColor }}>
                  {isEn ? 'POSTED' : 'مُسجَّل'}
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════
              4. THANK YOU & SLOGAN SEPARATOR
             ═══════════════════════════════════════════════════════ */}
          <div className="flex items-center justify-center gap-4 my-4">
            <div className="h-0.5 flex-1 rounded-full" style={{ backgroundColor: primaryColor }} />
            <span
              dir={isEn ? 'ltr' : 'rtl'}
              className="font-bold text-xs text-slate-800 px-3 select-none"
              style={{ letterSpacing: 0, fontWeight: 700, unicodeBidi: 'normal' }}
            >
              {cfg.thankYouText || (isEn ? 'Thank you for your trust and business' : 'نشكر لكم ثقتكم ونتطلع إلى المزيد من التعاملات')}
            </span>
            <div className="h-0.5 flex-1 rounded-full" style={{ backgroundColor: primaryColor }} />
          </div>

          {/* ═══════════════════════════════════════════════════════
              4b. STATEMENT BARCODE
              `showQrCode` existed in this config from the start but nothing ever read
              it, so the switch in the print settings moved nothing on the paper. It
              governs the block below now.
             ═══════════════════════════════════════════════════════ */}
          {cfg.showQrCode && qrDataUrl && (
            <div className="flex flex-col items-center gap-1 my-3">
              <img src={qrDataUrl} alt="" style={{ width: 84, height: 84 }} />
              <span className="text-[9px] font-bold text-slate-500">
                {isEn ? 'Scan to view your account statement' : 'امسح الرمز لعرض كشف حسابك'}
              </span>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              5. SIGNATURES SECTION (2 Columns: Payer & Receiver Only)
             ═══════════════════════════════════════════════════════ */}
          {cfg.showSignatures && (
            <div className="grid grid-cols-2 gap-12 text-center pt-2 mb-4 max-w-xl mx-auto">
              {/* توقيع الدافع / المسلّم للمبلغ */}
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-1 font-black text-xs text-slate-800">
                  <IconEdit size={14} style={{ color: primaryColor }} />
                  <span>{cfg.payerSignTitle || (isReceipt ? 'توقيع الدافع / المسلّم للمبلغ' : 'توقيع المحاسب / الآمر بالصرف')}</span>
                </div>
                <div className="h-10 border-b border-slate-300 mx-6"></div>
                <div className="font-mono text-[11px] text-slate-500 font-bold">
                  {isEn ? `Date: ${yearFormatted} /   / ` : `التاريخ :  ${yearFormatted}  /   / `}
                </div>
              </div>

              {/* توقيع المستلم / المحاسب */}
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-1 font-black text-xs text-slate-800">
                  <IconBuildingBank size={14} style={{ color: primaryColor }} />
                  <span>{cfg.receiverSignTitle || (isReceipt ? 'توقيع المستلم / المحاسب' : 'توقيع المستلم / المورد المستفيد')}</span>
                </div>
                <div className="h-10 border-b border-slate-300 mx-6"></div>
                <div className="font-mono text-[11px] text-slate-500 font-bold">
                  {isEn ? `Date: ${yearFormatted} /   / ` : `التاريخ :  ${yearFormatted}  /   / `}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════
            6. FOOTER WITH CONTACT INFO & MOSAIC PATTERN
           ═══════════════════════════════════════════════════════ */}
        <div className="pt-3 border-t-2" style={{ borderColor: primaryColor }}>
          <div className="flex items-center justify-between text-[10px] text-slate-600 font-bold">
            <div className="flex items-center gap-6">
              {cfg.email && (
                <div className="flex items-center gap-1">
                  <IconMail size={13} style={{ color: primaryColor }} />
                  <span dir="ltr">{cfg.email}</span>
                </div>
              )}
              {cfg.phone && (
                <div className="flex items-center gap-1">
                  <IconPhone size={13} style={{ color: primaryColor }} />
                  <span dir="ltr">{cfg.phone}</span>
                </div>
              )}
              {cfg.website && (
                <div className="flex items-center gap-1">
                  <IconWorld size={13} style={{ color: primaryColor }} />
                  <span dir="ltr">{cfg.website}</span>
                </div>
              )}
            </div>

            {/* Decorative 3x3 Blue Mosaic Dots */}
            <div className="flex items-center gap-1">
              <div className="grid grid-cols-3 gap-1">
                <div className="w-1.5 h-1.5 rounded-xs" style={{ backgroundColor: primaryColor }} />
                <div className="w-1.5 h-1.5 rounded-xs" style={{ backgroundColor: primaryColor }} />
                <div className="w-1.5 h-1.5 rounded-xs" style={{ backgroundColor: primaryColor }} />
                <div className="w-1.5 h-1.5 rounded-xs" style={{ backgroundColor: primaryColor }} />
                <div className="w-1.5 h-1.5 rounded-xs opacity-0" />
                <div className="w-1.5 h-1.5 rounded-xs" style={{ backgroundColor: primaryColor }} />
                <div className="w-1.5 h-1.5 rounded-xs" style={{ backgroundColor: primaryColor }} />
                <div className="w-1.5 h-1.5 rounded-xs" style={{ backgroundColor: primaryColor }} />
                <div className="w-1.5 h-1.5 rounded-xs" style={{ backgroundColor: primaryColor }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Language + PDF / Email (no on-screen preview) ──
export interface VoucherPrintModalProps {
  opened: boolean;
  onClose: () => void;
  voucher: VoucherPrintItem | null;
}

function waitFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export const VoucherPrintModal: React.FC<VoucherPrintModalProps> = ({
  opened,
  onClose,
  voucher,
}) => {
  const { language } = useLanguageStore();
  const [printLang, setPrintLang] = useState<'ar' | 'en'>(language === 'en' ? 'en' : 'ar');
  const [config, setConfig] = useState<any>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [customAccounts, setCustomAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sending, setSending] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [emailResolved, setEmailResolved] = useState(false);

  useEffect(() => {
    if (language === 'en' || language === 'ar') setPrintLang(language);
  }, [language]);

  useEffect(() => {
    if (!opened || !voucher) return;
    setRecipientEmail(pickAccountEmail(voucher));
    setEmailResolved(!voucher.accountId);
    setLoading(true);

    /**
     * المفتاح الصحيح للتصميم المحفوظ.
     *
     * هذا هو سبب أنّ تبويب تصميم السند بدا بلا أثر: صفحة «إعدادات الطباعة» تحفظ
     * تصميم سند القبض تحت النوع `receipt` (انظر TemplateDocType هناك)، بينما كانت
     * هذه النافذة تطلب `receipt_voucher` — اسماً لا يكتبه أحد. فيعود الطلب فارغاً،
     * وتسقط النافذة بهدوء إلى الإعدادات الافتراضية، فتضيع كل الألوان والخطوط
     * والشعار التي اختارها المستخدم في طريقها إلى الورقة، دون أي رسالة خطأ — لأنّ
     * «لا يوجد تصميم محفوظ» جواب طبيعي تماماً من وجهة نظر النافذة.
     *
     * ويُجرَّب الاسم القديم بعده، فلا يضيع تصميم قد يكون خُزّن تحته سابقاً.
     */
    const isReceiptDoc = voucher.type === 'RECEIPT';
    const docType = isReceiptDoc ? 'receipt' : 'payment';
    const legacyDocType = isReceiptDoc ? 'receipt_voucher' : 'payment_voucher';

    const loadTemplate = async () => {
      for (const key of [docType, legacyDocType]) {
        // طازجاً حتماً: ما سيُطبع ورقاً يجب أن يعكس آخر حفظ ولو جرى في تبويب آخر.
        const res = await fetchPrintTemplate(key, { fresh: true }).catch(() => null);
        if (res && res.config) return res;
      }
      return null;
    };

    Promise.all([
      loadTemplate(),
      fetchPrintTemplate('custom_voucher_accounts').catch(() => null),
    ])
      .then(([templateRes, customAccsRes]) => {
        if (templateRes && templateRes.config) {
          setConfig(templateRes.config);
        } else {
          setConfig(voucher.type === 'RECEIPT' ? DEFAULT_VOUCHER_CONFIG : DEFAULT_PAYMENT_VOUCHER_CONFIG);
        }
        const accs = (customAccsRes?.config?.accounts || []).filter((a: any) => a.isActive !== false);
        setCustomAccounts(accs);
      })
      .catch(() => {
        setConfig(voucher.type === 'RECEIPT' ? DEFAULT_VOUCHER_CONFIG : DEFAULT_PAYMENT_VOUCHER_CONFIG);
      })
      .finally(() => setLoading(false));
  }, [opened, voucher]);

  useEffect(() => {
    if (!opened || !voucher?.accountId) {
      if (opened) setEmailResolved(true);
      return;
    }
    let cancelled = false;
    setEmailResolved(false);
    apiRequest(`/api/accounts/${voucher.accountId}`)
      .then((acc: any) => {
        if (cancelled) return;
        const email = pickAccountEmail(acc);
        if (email) setRecipientEmail(email);
      })
      .catch(() => {
        /* keep whatever was already on the voucher */
      })
      .finally(() => {
        if (!cancelled) setEmailResolved(true);
      });
    return () => {
      cancelled = true;
    };
  }, [opened, voucher]);

  useEffect(() => {
    if (!opened || !voucher) {
      setQrDataUrl(null);
      return;
    }
    const accountId = (voucher as any).accountId;
    if (!accountId) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    apiRequest(`/api/statement-tokens/qr?accountId=${encodeURIComponent(accountId)}`)
      .then((res: any) => {
        if (!cancelled) setQrDataUrl(res?.qrDataUrl || null);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [opened, voucher]);

  if (!voucher) return null;

  const isReceipt = voucher.type === 'RECEIPT';
  const isEn = printLang === 'en';
  const voucherLabel = isReceipt
    ? (isEn ? 'Receipt Voucher' : 'سند القبض')
    : (isEn ? 'Payment Voucher' : 'سند الدفع');

  const buildPdf = async (): Promise<{ base64: string; filename: string }> => {
    await waitFrame();
    await new Promise((r) => setTimeout(r, 80));

    const element = document.getElementById('printable-voucher-sheet');
    if (!element) {
      throw new Error(isEn ? 'Print sheet is not ready' : 'ورقة الطباعة غير جاهزة');
    }

    const html = serializeElementForChromium(element);
    const filename = `voucher_${voucher.voucherNumber || 'doc'}_${printLang}.pdf`;
    return generateChromiumPdf({ html, lang: printLang, filename });
  };

  const handleDownloadPdf = async () => {
    setExporting(true);
    try {
      const { base64, filename } = await buildPdf();
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      showSuccessNotification(
        isEn ? 'Downloaded' : 'تم التحميل',
        isEn ? 'Voucher PDF generated' : 'تم توليد وصل السند بصيغة PDF',
      );
      onClose();
    } catch (err: any) {
      console.error('Voucher PDF export failed:', err);
      showErrorNotification(
        isEn ? 'Export failed' : 'تعذر التصدير',
        err?.message || (isEn ? 'Could not generate the PDF' : 'تعذر توليد ملف PDF'),
      );
    } finally {
      setExporting(false);
    }
  };

  const handleSendEmail = async () => {
    const email = recipientEmail.trim();
    if (!EMAIL_RE.test(email)) {
      showErrorNotification(
        isEn ? 'Email required' : 'البريد مطلوب',
        isEn ? 'This account has no email on file' : 'لا يوجد بريد إلكتروني على هذا الحساب',
      );
      return;
    }

    setSending(true);
    try {
      const { base64, filename } = await buildPdf();
      const subject = isEn
        ? `${voucherLabel} ${voucher.voucherNumber}`
        : `${voucherLabel} ${voucher.voucherNumber}`;
      await apiRequest('/api/email/send', {
        method: 'POST',
        timeoutMs: 60_000,
        body: JSON.stringify({
          to: email,
          subject,
          htmlContent: isEn
            ? `<p>Please find attached the ${voucherLabel.toLowerCase()} <strong>${voucher.voucherNumber}</strong> as a PDF file.</p>`
            : `<p dir="rtl">مرفق ${voucherLabel} رقم <strong>${voucher.voucherNumber}</strong> بصيغة PDF.</p>`,
          attachment: [{ name: filename.replace(/[^\x20-\x7E]/g, '_') || 'voucher.pdf', content: base64 }],
        }),
      });
      showSuccessNotification(
        isEn ? 'Sent' : 'تم الإرسال',
        isEn ? `PDF sent to ${email}` : `تم إرسال PDF إلى ${email}`,
      );
      onClose();
    } catch (err: any) {
      console.error('Voucher email failed:', err);
      showErrorNotification(
        isEn ? 'Send failed' : 'فشل الإرسال',
        err?.message || (isEn ? 'Could not send the email' : 'تعذر إرسال البريد الإلكتروني'),
      );
    } finally {
      setSending(false);
    }
  };

  const busy = exporting || sending || loading;
  const emailOk = EMAIL_RE.test(recipientEmail.trim());

  return (
    /**
     * الورقة المخفية خارج النافذة عمداً.
     *
     * كانت داخل <Modal>، وهذا سبب امتداد النافذة إلى الأسفل: العنصر المخفي ورقة
     * كاملة بعرض 210mm وبارتفاع صفحة، وهو موضوع بـ position:fixed — لكن نافذة
     * Mantine تُحرّك محتواها بـ transform، وأي سلف مُحوَّل يجعل fixed يتموضع داخله
     * بدل الشاشة. فصار للنافذة محتوى بحجم صفحة A4 كاملة تحت الأزرار، ومنطقة تمرير
     * فارغة طويلة. خارج النافذة يعود fixed إلى معناه الأصلي: منسوباً إلى الشاشة،
     * لا يشغل أي مساحة، ولا تراه العين — بينما html2canvas ما زال يجده ويصوّره.
     */
    <>
    <Modal
      opened={opened}
      onClose={onClose}
      size="md"
      centered
      radius="lg"
      withCloseButton={false}
      styles={{
        content: {
          background: 'linear-gradient(to bottom, #ffffff, #f8fafc)',
          border: '1px solid #e2e8f0',
        },
        body: { padding: 0 },
      }}
    >
      <div className="p-4 space-y-4 text-slate-900 font-sans" dir={isEn ? 'ltr' : 'rtl'}>
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-600 to-blue-500 text-white flex items-center justify-center shadow-md shadow-sky-500/20">
              <IconReceipt size={22} />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 leading-tight">
                {isEn ? 'Generate voucher PDF' : 'توليد وصل السند'}
              </h3>
              <p className="text-xs font-bold text-slate-500 mt-0.5">
                {voucherLabel} — {voucher.voucherNumber}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
          >
            <IconX size={16} />
          </button>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between text-xs">
          <div className="space-y-0.5 min-w-0">
            <span className="text-[10.5px] font-bold text-slate-400 block">
              {isEn ? 'Account' : 'الحساب'}
            </span>
            <span className="font-extrabold text-slate-900 truncate block">{voucher.accountName}</span>
          </div>
          <div className="text-end font-mono text-[11px] font-black text-slate-800" dir="ltr">
            {Number(voucher.amount || 0).toLocaleString()} {voucher.currency || 'IQD'}
          </div>
        </div>

        <div className="bg-slate-100/90 p-1.5 rounded-2xl flex items-center justify-between border border-slate-200">
          <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5 px-2">
            <IconLanguage size={16} className="text-[#F45A0A]" />
            {isEn ? 'Document language:' : 'لغة الوصل:'}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPrintLang('ar')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                printLang === 'ar' ? 'bg-[#F45A0A] text-white shadow-xs' : 'bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              العربية
            </button>
            <button
              type="button"
              onClick={() => setPrintLang('en')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                printLang === 'en' ? 'bg-[#F45A0A] text-white shadow-xs' : 'bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              English
            </button>
          </div>
        </div>

        <TextInput
          size="sm"
          label={isEn ? 'Recipient email' : 'بريد المستلم'}
          placeholder="name@example.com"
          value={recipientEmail}
          onChange={(e) => setRecipientEmail(e.currentTarget.value)}
          disabled={busy}
          dir="ltr"
          description={
            emailResolved && !emailOk
              ? (isEn ? 'No email on this account — send is disabled' : 'لا يوجد بريد على هذا الحساب — زر الإرسال معطّل')
              : undefined
          }
          styles={{ label: { fontWeight: 800, fontSize: 12, marginBottom: 6 }, description: { fontSize: 11, fontWeight: 700 } }}
        />

        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={busy}
            className="w-full h-12 rounded-2xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-extrabold text-xs shadow-md shadow-orange-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {exporting || loading ? (
              <>
                <Loader size={18} color="white" />
                <span>{isEn ? 'Generating PDF…' : 'جاري توليد PDF…'}</span>
              </>
            ) : (
              <>
                <IconDownload size={18} />
                <span>{isEn ? 'Generate & download PDF' : 'توليد وتحميل PDF'}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleSendEmail}
            disabled={busy || !emailOk}
            title={
              emailOk
                ? undefined
                : (isEn ? 'This account has no email' : 'لا يوجد بريد إلكتروني على هذا الحساب')
            }
            className="w-full h-12 rounded-2xl border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-950 font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-sky-50"
          >
            {sending ? (
              <>
                <Loader size={18} color="blue" />
                <span>{isEn ? 'Sending…' : 'جاري الإرسال…'}</span>
              </>
            ) : (
              <>
                <IconMail size={18} className="text-sky-600" />
                <span>{isEn ? 'Send PDF by email' : 'إرسال PDF عبر البريد'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>

    {/* مرتبطة بحالة الفتح: خارج النافذة لم تعد Mantine تُلغي تركيبها، فنتكفّل بذلك
        هنا كي لا تبقى ورقة سند مركّبة في الصفحة بعد إغلاق النافذة. */}
    {opened && (
      <div
        aria-hidden="true"
        dir={printLang === 'en' ? 'ltr' : 'rtl'}
        lang={printLang === 'en' ? 'en' : 'ar'}
        style={{
          position: 'fixed',
          left: '-9999px',
          top: 0,
          width: '210mm',
          pointerEvents: 'none',
          opacity: 0,
        }}
      >
        <PrintableVoucherSheet
          voucher={voucher}
          config={config}
          qrDataUrl={qrDataUrl}
          lang={printLang}
          customAccounts={customAccounts}
        />
      </div>
    )}
    </>
  );
};
