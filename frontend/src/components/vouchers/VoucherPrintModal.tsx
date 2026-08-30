import React, { useState, useEffect } from 'react';
import { Modal, Button, Badge, Loader, Group, SegmentedControl } from '@mantine/core';
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
} from '@tabler/icons-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { fetchPrintTemplate } from '../../api/printTemplates';
import { apiRequest } from '../../api/client';
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

export const DEFAULT_VOUCHER_CONFIG = {
  companyName: 'رودا 10 للبرمجيات والحلول المحاسبية',
  companyNameEn: 'RODA 10 Software & Accounting Solutions',
  subtitle: 'شركة البرمجيات والحلول المالية المتقدمة',
  subtitleEn: 'Advanced Software & Accounting Solutions',
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
  showQrCode: true,
  showSignatures: true,
  showTafqeet: true,
  thankYouText: 'نشكر لكم ثقتكم ونتطلع إلى المزيد من التعاملات',
  payerSignTitle: 'توقيع الدافع / المسلّم للمبلغ',
  receiverSignTitle: 'توقيع المستلم / المحاسب',
  notesText: '',
  footerText: 'جميع الحقوق محفوظة © 2026',
  fontSizes: {
    companyTitle: 16,
    subtitle: 11,
    docTitle: 24,
    body: 11,
    amount: 19,
  },
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
}

export const PrintableVoucherSheet: React.FC<PrintableVoucherSheetProps> = ({
  voucher,
  config: userConfig,
  lang = 'ar',
  qrDataUrl,
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

  const tafqeetText = tafqeetArabic(voucher.amount || 0);

  const docTitleAr = isReceipt ? 'سند قبض' : 'سند صرف ودفع';
  const docTitleEn = isReceipt ? 'RECEIPT VOUCHER' : 'PAYMENT VOUCHER';

  const cardTitleAr = isReceipt ? 'بيانات سند القبض' : 'بيانات سند الصرف والدفع';
  const cardTitleEn = isReceipt ? 'Receipt Voucher Details' : 'Payment Voucher Details';

  const partyName = voucher.accountName || voucher.accountCode || (isEn ? 'Client / Entity' : 'العميل / الطرف المستفيد');
  const partyLabelAr = isReceipt ? 'استلمنا من السيد/السادة :' : 'ادفعوا للسيد/السادة :';
  const partyLabelEn = isReceipt ? 'Received From:' : 'Paid To:';

  const splitLabelAr = isReceipt ? 'تقسيم القبض :' : 'تقسيم الصرف :';
  const splitLabelEn = isReceipt ? 'Split Receipt:' : 'Split Payment:';

  const splitAccountsList = voucher.splitAccounts && voucher.splitAccounts.length > 0
    ? voucher.splitAccounts
    : null;

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

  const logoUrl = cfg.logoUrl || '';

  const topPadding = cfg.headerMarginTop !== undefined
    ? `${cfg.headerMarginTop}mm`
    : (cfg.useFullHeaderImage ? '4mm' : '10mm');

  return (
    <div
      id="printable-voucher-sheet"
      className="bg-white text-slate-900 mx-auto relative select-text"
      dir={isEn ? 'ltr' : 'rtl'}
      style={{
        width: '100%',
        maxWidth: '210mm',
        minHeight: '297mm', // Standard A4
        padding: `${topPadding} 14mm 10mm 14mm`,
        fontFamily: cfg.fontFamily || "'IBM Plex Sans Arabic', sans-serif",
        boxSizing: 'border-box',
        backgroundColor: '#ffffff',
        position: 'relative',
        overflow: 'hidden',
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
            className="font-black tracking-widest select-none"
            style={{
              fontSize: '85px',
              transform: 'rotate(-28deg)',
              opacity: 0.045,
              whiteSpace: 'nowrap',
              color: watermarkColor,
              fontWeight: 900,
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

                {/* الصفحة */}
                <div className="flex items-center gap-1.5 border-r border-slate-300 pr-3">
                  <IconFileDescription size={13} className="text-slate-400" />
                  <span className="text-slate-600 font-bold">{isEn ? 'Page :' : 'الصفحة :'}</span>
                  <span className="font-mono font-bold text-slate-800" dir="ltr">1 / 1</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4 pb-4 mb-5 border-b border-slate-100">
              {/* Header Right (in RTL): Meta Box (رقم السند، التاريخ، وقت الإصدار، الصفحة) */}
              <div
                className="bg-white rounded-xl border p-2.5 min-w-[200px] space-y-1 shadow-2xs text-xs font-bold shrink-0"
                style={{ borderColor: fieldBorderColor }}
              >
                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                  <span className="text-slate-600 font-bold">{isEn ? 'Voucher No :' : 'رقم السند :'}</span>
                  <span className="font-mono font-black tracking-wider text-xs" dir="ltr" style={{ color: primaryColor }}>
                    {voucher.voucherNumber || 'RCV-2025-000123'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-600 flex items-center gap-1 font-bold">
                    <IconCalendar size={12} className="text-slate-400" />
                    <span>{isEn ? 'Date :' : 'التاريخ :'}</span>
                  </span>
                  <span className="font-mono font-bold text-slate-800" dir="ltr">{dateFormatted}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-600 flex items-center gap-1 font-bold">
                    <IconClock size={12} className="text-slate-400" />
                    <span>{isEn ? 'Issue Time :' : 'وقت الإصدار :'}</span>
                  </span>
                  <span className="font-mono font-bold text-slate-800" dir="ltr">{timeFormatted}</span>
                </div>

                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-slate-600 flex items-center gap-1 font-bold">
                    <IconFileDescription size={12} className="text-slate-400" />
                    <span>{isEn ? 'Page :' : 'الصفحة :'}</span>
                  </span>
                  <span className="font-mono font-bold text-slate-800" dir="ltr">1 / 1</span>
                </div>
              </div>

              {/* Header Center (CENTERED): Clean Document Icon & Title Only */}
              <div className="flex flex-col items-center justify-center text-center pt-1">
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

                <h1
                  className="font-black tracking-tight"
                  style={{
                    fontSize: `${cfg.fontSizes?.docTitle || 24}px`,
                    color: '#0f172a',
                  }}
                >
                  {isEn ? docTitleEn : docTitleAr}
                </h1>
                <div className="w-12 h-0.5 mt-1 rounded-full" style={{ backgroundColor: primaryColor }} />
              </div>

              {/* Header Left (in RTL): Company Logo ONLY (No address or phone) */}
              <div className="min-w-[200px] flex items-center justify-end">
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
              className="absolute -top-3.5 right-6 px-5 py-1 rounded-full text-white font-black text-xs tracking-wide shadow-xs flex items-center gap-1.5"
              style={{ backgroundColor: headerBgColor }}
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
                className="flex-1 rounded-xl p-2.5 px-4 font-black text-sm text-slate-900 border"
                style={{ backgroundColor: fieldBgColor, borderColor: fieldBorderColor }}
              >
                {voucher.accountCode ? `${voucher.accountCode} - ` : ''}
                {voucher.accountName || 'شركة النور للتجارة العامة'}
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
                  className="font-mono font-black text-xl tracking-wider text-center"
                  style={{ color: amountTextColor }}
                >
                  {amountFormatted}
                </div>

                {/* حقل العملة الأنيق على طرف الحاوية (موضع مطلق لا يؤثر على توسيط المبلغ) */}
                <div
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 px-3 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold flex items-center gap-1.5 shadow-2xs"
                >
                  <IconWorld size={14} style={{ color: primaryColor }} />
                  <span className="font-black text-xs" style={{ color: primaryColor }}>
                    {currencyName}
                  </span>
                </div>
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
                className="flex-1 rounded-xl p-2.5 px-4 font-bold text-xs text-slate-800 border flex items-center gap-2 overflow-hidden flex-wrap"
                style={{
                  backgroundColor: fieldBgColor,
                  borderColor: fieldBorderColor,
                }}
              >
                {splitAccountsList ? (
                  splitAccountsList.map((item, idx) => (
                    <div
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 shadow-2xs font-mono font-bold text-xs flex items-center gap-1.5"
                    >
                      <span className="text-slate-800">{item.accountName}</span>
                      {item.amount && (
                        <span className="text-blue-600 font-black">
                          ({Number(item.amount).toLocaleString('en-US')} {item.currency || currencyCode})
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-2 font-mono text-slate-800 font-bold text-xs">
                    <span className="px-2.5 py-0.5 rounded-lg bg-white border border-slate-200 text-blue-700 font-black">
                      {splitDisplayVal}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Field 6: ملاحظات */}
            <div className="flex items-start gap-3">
              <span className="font-black text-xs text-slate-700 flex items-center gap-1.5 w-32 shrink-0 pt-2">
                <IconMessageDots size={16} style={{ color: primaryColor }} />
                <span>{isEn ? 'Notes :' : 'ملاحظات :'}</span>
              </span>

              <div
                className="flex-1 rounded-xl p-2.5 px-4 font-bold text-xs text-slate-700 border min-h-[42px] leading-relaxed"
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
              className="absolute -top-3.5 right-6 px-4 py-1 rounded-full text-white font-black text-xs tracking-wide shadow-xs flex items-center gap-1"
              style={{ backgroundColor: headerBgColor }}
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
                <div className="font-mono font-black text-base tracking-tight" style={{ color: summaryTotalColor }}>
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
            <span className="font-black text-xs text-slate-800 px-3 tracking-wide select-none">
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
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
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

  /**
   * The counter-party's statement barcode, fetched alongside the template.
   *
   * Kept separate from the config fetch so a missing or un-issued barcode can never
   * stop the voucher from printing — the worst case is a receipt without a code,
   * which is exactly what was printed before this existed.
   */
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
          <IconReceipt size={18} className="text-blue-600" />
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
          @page { size: A4 portrait; margin: 4mm !important; }
          body, html { background: #ffffff !important; color: #000000 !important; margin: 0 !important; padding: 0 !important; }
          .no-print, header, nav, aside, footer, button, .mantine-Modal-header, .mantine-Modal-close, .mantine-Overlay-root { display: none !important; }
          .mantine-Modal-content { box-shadow: none !important; border: none !important; padding: 0 !important; margin: 0 !important; width: 100% !important; background: transparent !important; }
          #printable-voucher-sheet { width: 100% !important; max-width: 210mm !important; margin: 0 auto !important; box-shadow: none !important; border: none !important; }
        }
      `}</style>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 space-y-3">
          <Loader color="blue" size="md" />
          <span className="text-xs font-bold text-slate-600">
            {printLang === 'en' ? 'Fetching approved template...' : 'جارٍ استجلاب قالب السند المعتمد...'}
          </span>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200 no-print">
            <div className="flex items-center gap-2">
              <Badge color="blue" size="md" variant="filled">
                {isReceipt ? (printLang === 'en' ? 'Receipt Voucher' : 'سند قبض معتمد ✓') : (printLang === 'en' ? 'Payment Voucher' : 'سند صرف ودفع معتمد ✓')}
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
                color="blue"
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

          <div className="bg-slate-100/60 p-2 rounded-xl border border-slate-200 overflow-x-auto flex justify-center print:bg-white print:p-0 print:border-none shadow-inner">
            <PrintableVoucherSheet
              voucher={voucher}
              config={config}
              qrDataUrl={qrDataUrl}
              lang={printLang}
            />
          </div>
        </div>
      )}
    </Modal>
  );
};
