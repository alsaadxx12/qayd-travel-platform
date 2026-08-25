import React, { useState, useEffect } from 'react';
import { Modal, Button, Badge, Loader, Group, SegmentedControl, TextInput, Textarea, Switch } from '@mantine/core';
import { IconPrinter, IconFileText, IconCalculator, IconLanguage, IconFileTypePdf, IconDownload, IconBrandWhatsapp, IconMail, IconX, IconSend, IconPaperclip, IconCheck, IconAlertTriangle, IconAlertCircle } from '@tabler/icons-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { fetchPrintTemplate } from '../../api/printTemplates';
import { apiRequest, API_BASE_URL } from '../../api/client';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { useLanguageStore } from '../../store/useLanguageStore';

// ── Bilingual Labels Dictionary ──

type LangKey = 'ar' | 'en';
const LABELS: Record<LangKey, Record<string, string>> = {
  ar: {
    accountLabel: 'اسم الحساب / العميل',
    periodFrom: 'الفترة من',
    periodTo: 'إلى',
    dateDoc: 'التاريخ / المستند',
    description: 'البيان وشرح الحركة',
    debit: 'مدين',
    credit: 'دائن',
    runningBalance: 'الرصيد المتراكم',
    passengerList: 'قائمة المسافرين',
    passenger: 'مسافر',
    noMovements: 'لا توجد حركات مالية مسجلة لهذه الفترة',
    summaryTitle: 'الملخص المالي والختام الإجمالي للكشف',
    openingBalance: 'رصيد أول المدة',
    previousBalance: 'الرصيد السابق',
    totalDebit: 'مجموع المدين (+)',
    totalCredit: 'مجموع الدائن (-)',
    netBalance: 'صافي الرصيد',
    phoneLabel: 'الهاتف',
    emailLabel: 'البريد',
    addressLabel: 'العنوان',
    currency: 'د.ع',
    officialStatement: 'كشف حساب رسمي',
    printBtn: 'طباعة / تصدير PDF 🖨️',
    closeBtn: 'إغلاق',
    approvedTemplate: 'قالب معتمد ✓',
    accountShort: 'الحساب',
    previewTitle: 'معاينة وتصدير كشف الحساب وفق القالب المعتمد',
    loadingTemplate: 'جارٍ استجلاب القالب المعتمد من قاعدة البيانات...',
    defaultFooter: 'قسم الحسابات — شركة السعدي للسفر والسياحة',
  },
  en: {
    accountLabel: 'Account Name / Client',
    periodFrom: 'Period From',
    periodTo: 'To',
    dateDoc: 'Date / Doc Ref',
    description: 'Description',
    debit: 'Debit',
    credit: 'Credit',
    runningBalance: 'Running Balance',
    passengerList: 'Passenger List',
    passenger: 'Passenger',
    noMovements: 'No financial movements recorded for this period',
    summaryTitle: 'Financial Summary & Statement Closing',
    openingBalance: 'Opening Balance',
    previousBalance: 'Previous Balance',
    totalDebit: 'Total Debit (+)',
    totalCredit: 'Total Credit (-)',
    netBalance: 'Net Balance',
    phoneLabel: 'Phone',
    emailLabel: 'Email',
    addressLabel: 'Address',
    currency: 'IQD',
    officialStatement: 'Official Account Statement',
    printBtn: 'Print / Export PDF 🖨️',
    closeBtn: 'Close',
    approvedTemplate: 'Approved Template ✓',
    accountShort: 'Account',
    previewTitle: 'Preview & Export Account Statement',
    loadingTemplate: 'Fetching approved template from database...',
    defaultFooter: 'Accounts Department — Al-Saadi Travel & Tourism',
  },
};

// ── Arabic Tafqeet Helper ──
export function tafqeetArabic(num: number): string {
  if (!num || isNaN(num) || num === 0) return 'صفر دينار عراقي لا غير';
  const absNum = Math.abs(Math.round(num));

  const units = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة'];
  const teens = ['عشرة', 'أحد عشر', 'إثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

  function convertGroup(n: number): string {
    let result = '';
    const h = Math.floor(n / 100);
    const remainder = n % 100;
    const t = Math.floor(remainder / 10);
    const u = remainder % 10;

    if (h > 0) {
      result += hundreds[h];
    }

    if (remainder > 0) {
      if (result) result += ' و';
      if (remainder <= 10) {
        result += units[remainder];
      } else if (remainder < 20) {
        result += teens[remainder - 10];
      } else {
        if (u > 0) {
          result += units[u] + ' و' + tens[t];
        } else {
          result += tens[t];
        }
      }
    }
    return result;
  }

  const millions = Math.floor(absNum / 1000000);
  const thousands = Math.floor((absNum % 1000000) / 1000);
  const remainder = absNum % 1000;

  const parts: string[] = [];

  if (millions > 0) {
    if (millions === 1) parts.push('مليون');
    else if (millions === 2) parts.push('مليونان');
    else if (millions >= 3 && millions <= 10) parts.push(convertGroup(millions) + ' ملايين');
    else parts.push(convertGroup(millions) + ' مليون');
  }

  if (thousands > 0) {
    if (thousands === 1) parts.push('ألف');
    else if (thousands === 2) parts.push('ألفان');
    else if (thousands >= 3 && thousands <= 10) parts.push(convertGroup(thousands) + ' آلاف');
    else parts.push(convertGroup(thousands) + ' ألف');
  }

  if (remainder > 0) {
    parts.push(convertGroup(remainder));
  }

  const text = parts.join(' و');
  return `فقط ${text} دينار عراقي لا غير`;
}

// Default fallback config matching PrintTemplatesPage
const DEFAULT_STATEMENT_CONFIG = {
  companyName: 'شركة السعدي لخدمات السفر والسياحة',
  subtitle: 'كشف حساب مالي تفصيلي حي معتمد',
  commercialReg: 'س.ت: 90182471 / بغداد',
  phone: '+964 770 123 4567',
  email: 'finance@alsaadi-travel.com',
  address: 'بغداد — الكرادة — شارع 62',
  logoUrl: '',
  logoAlign: 'left',
  logoSize: 75,
  logoPosX: 0,
  logoPosY: 0,
  logoBorderRadius: 8,
  primaryColor: '#64748b',
  titleAccentColor: '#64748b',
  headerBgColor: '#ffffff',
  headerTextColor: 'dark',
  headerStyle: 'badge_card',
  footerStyle: 'classic_line',
  pageTheme: 'executive',
  tableTextColor: '#0f172a',
  tableHeaderBgColor: '#e2e8f0',
  tableHeaderTextColor: '#0f172a',
  summaryHeaderBgColor: '#e2e8f0',
  summaryHeaderTextColor: '#0f172a',
  tableRowStripedColor: '#f8fafc',
  tableRowStriped: true,
  fontFamily: 'IBM Plex Sans Arabic',
  isTableBold: false,
  paperSize: 'A4',
  orientation: 'portrait',
  watermarkText: 'كشف حساب رسمي',
  showWatermark: true,
  showQrCode: true,
  qrPosition: 'custom',
  qrSize: 48,
  qrPosX: 24,
  qrPosY: 870,
  qrColor: '#059669',
  qrBgColor: '#ffffff',
  qrBorderColor: '#059669',
  qrShowLabel: true,
  showSignatures: true,
  managerSignTitle: 'توقيع المدير العام',
  accountantSignTitle: 'توقيع الحسابات',
  receiverSignTitle: 'توقيع صاحب الحساب',
  notesText: 'ملاحظة: هذا الكشف يعتبر مطبقاً وموافقاً عليه رسمياً ما لم يتم الإعتراض خلال 7 أيام من تاريخ صدوره.',
  footerText: 'شركة السعدي للسفر والسياحة — هاتف خدمة العملاء: 6012 — جميع الحقوق محفوظة © 2026',
  footerAlign: 'center',
  showPageNumbers: true,
  showFinancialSummary: true,
  summaryStyle: 'grid_cards',
  showTafqeet: true,
  fontSizes: {
    companyTitle: 17,
    subtitle: 11,
    headerDetails: 10,
    docTitle: 13,
    tableHeader: 11,
    tableBody: 10,
    notes: 10,
    signatures: 11,
    footer: 10,
    summaryTitle: 12,
    summaryMetrics: 11,
  },
};

export function parsePassengerCategory(pName: string, pType?: string): { label: string; icon: string; tagColor: string } {
  const nameUpper = (pName || '').toUpperCase();
  const typeUpper = (pType || '').toUpperCase();

  if (typeUpper.includes('INF') || typeUpper.includes('رضيع') || typeUpper.includes('INFANT') || nameUpper.includes('(INF)')) {
    return { label: 'INF', icon: '🍼', tagColor: 'bg-amber-50 text-amber-800 border-amber-300' };
  }
  if (typeUpper.includes('CHD') || typeUpper.includes('CHILD') || typeUpper.includes('طفل') || nameUpper.startsWith('MSTR') || nameUpper.startsWith('MISS') || nameUpper.includes('(CHD)')) {
    return { label: 'CHD', icon: '🧒', tagColor: 'bg-blue-50 text-blue-800 border-blue-300' };
  }
  return { label: 'ADT', icon: '👤', tagColor: 'bg-emerald-50 text-emerald-800 border-emerald-300' };
}

export interface PassengerDetailItem {
  name: string;
  ticketNumber?: string;
  ticketType?: string;
}

export interface StatementMovementItem {
  rowNumber: number;
  date: string;
  docRef?: string;
  pnr?: string;
  route?: string;
  passengersDetail?: PassengerDetailItem[];
  statement: string;
  debit: number;
  credit: number;
  runningBalance: number;
  currency?: string;
}

export const PrintableAccountStatementSheet: React.FC<{
  accountName: string;
  accountCode?: string;
  accountPhone?: string;
  accountEmail?: string;
  accountAddress?: string;
  startDate: string;
  endDate: string;
  rows: StatementMovementItem[];
  totals: { totalDebit: number; totalCredit: number; finalBalance: number; openingBalance?: number; previousBalance?: number };
  config?: any;
  lang?: LangKey;
}> = ({ accountName, accountCode, accountPhone, accountEmail, accountAddress, startDate, endDate, rows, totals, config: propConfig, lang = 'ar' }) => {
  const config = propConfig || DEFAULT_STATEMENT_CONFIG;
  const logoUrl = config.logoUrl || '';

  const selectedFontFamily = config.fontFamily || 'IBM Plex Sans Arabic';
  const docTitleSize = config.docTitleSize || 20;
  const tableFontSize = config.tableFontSize || 10;
  const footerFontSize = config.footerFontSize || 10;
  const isTableBold = config.isTableBold || false;

  const titleAccentColor = config.titleAccentColor || config.primaryColor || '#64748b';
  const tableHeaderBgColor = config.tableHeaderBgColor || '#e2e8f0';
  const tableHeaderTextColor = config.tableHeaderTextColor || '#0f172a';
  const summaryHeaderBgColor = config.summaryHeaderBgColor || '#e2e8f0';
  const summaryHeaderTextColor = config.summaryHeaderTextColor || '#0f172a';
  const tableRowStripedColor = config.tableRowStripedColor || '#f8fafc';
  const tableTextColor = config.tableTextColor || '#0f172a';
  const balanceDueColor = config.balanceDueColor || '#0f172a';

  const fmtNum = (num: number) => {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num || 0);
  };

  const printDateStr = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }) + ' - ' + new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      id="printable-statement-sheet"
      dir="ltr"
      className="bg-white text-slate-900 w-[780px] min-h-[980px] p-6 text-left flex flex-col justify-between border border-slate-300 shadow-xs relative mx-auto"
      style={{
        direction: 'ltr',
        textAlign: 'left',
        fontFamily: `'${selectedFontFamily}', 'Tajawal', Arial, sans-serif`,
        fontSize: '10.5px',
      }}
    >
      {/* Watermark overlay */}
      {config.showWatermark && config.watermarkText && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0 opacity-[0.06]">
          <span className="text-6xl font-black text-slate-900 -rotate-30 select-none whitespace-nowrap uppercase tracking-wider">
            {config.watermarkText}
          </span>
        </div>
      )}

      <div className="space-y-4 relative z-10">
        {/* Top Header Card */}
        <div className="flex justify-between items-start gap-4 pb-2 border-b border-slate-200">
          {/* Left Column: Logo & TO Info */}
          <div className="flex-1 min-w-0">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="max-h-[50px] max-w-[180px] object-contain mb-3" />
            ) : (
              <div className="text-2xl font-black mb-2 tracking-tight" style={{ color: titleAccentColor }}>FLY4ALL</div>
            )}
            <div className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5 mb-1">
              <span className="font-extrabold text-slate-700">TO:</span>
              <span>{accountName}</span>
            </div>
            <div className="text-[10.5px] text-slate-700 font-semibold space-y-0.5 leading-snug">
              <div>Address: {accountAddress || config.address || '-'}</div>
              <div>Mobile: {accountPhone || config.phone || '-'}</div>
              <div>Email: {accountEmail || config.email || '-'}</div>
            </div>
            <div className="text-[10px] text-slate-500 font-bold mt-2">
              Date : {printDateStr}
            </div>
          </div>

          {/* Right Column: Statement Title & Account Summary Box */}
          <div className="w-[320px] text-left">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-1.5 h-10 rounded-xs shrink-0" style={{ backgroundColor: titleAccentColor }}></div>
              <div
                className="font-black text-slate-900 uppercase leading-tight tracking-wide"
                style={{ fontSize: `${docTitleSize}px` }}
              >
                STATEMENT<br />OF ACCOUNT
              </div>
            </div>

            {config.showAccountSummary !== false && (
              <div className="border border-slate-300 rounded overflow-hidden bg-white text-slate-900">
                <div
                  className="px-2.5 py-1 text-xs font-extrabold border-b border-slate-300"
                  style={{ backgroundColor: summaryHeaderBgColor, color: summaryHeaderTextColor }}
                >
                  Account summary
                </div>
                <div className="p-2.5 text-[10.5px] space-y-1">
                  <div className="font-extrabold text-slate-900 text-xs mb-1.5">
                    {startDate} to {endDate}
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-slate-700">Previous Balance:</span>
                    <span className="font-mono font-bold">IQD ({fmtNum(totals.previousBalance || 0)})</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-slate-700">Total credit / amount paid :</span>
                    <span className="font-mono font-bold">IQD {fmtNum(totals.totalCredit || 0)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-slate-700">Total debit / invoiced amount :</span>
                    <span className="font-mono font-bold">IQD {fmtNum(totals.totalDebit || 0)}</span>
                  </div>
                  <div className="border-t border-slate-400 pt-1 mt-1 flex justify-between font-black text-[11.5px] text-slate-900">
                    <span>Balance due :</span>
                    <span className="font-mono font-black" style={{ color: balanceDueColor }}>
                      IQD {fmtNum(totals.finalBalance || 0)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Movements Table */}
        <table
          className="w-full border-collapse border border-slate-300 text-left"
          style={{ fontSize: `${tableFontSize}px`, color: tableTextColor }}
        >
          <thead>
            <tr
              className="font-extrabold border-b border-slate-300"
              style={{ backgroundColor: tableHeaderBgColor, color: tableHeaderTextColor, fontSize: `${Math.max(10, tableFontSize + 0.5)}px` }}
            >
              <th className="p-2 text-center border-r border-slate-300 w-[4%]">No.</th>
              <th className="p-2 border-r border-slate-300 w-[13%]">Date</th>
              <th className="p-2 border-r border-slate-300 w-[41%]">Details</th>
              <th className="p-2 text-center border-r border-slate-300 w-[9%]">Type</th>
              <th className="p-2 text-right border-r border-slate-300 w-[11%]">Debit</th>
              <th className="p-2 text-right border-r border-slate-300 w-[11%]">Credit</th>
              <th className="p-2 text-right w-[11%]">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200" style={{ fontWeight: isTableBold ? 800 : 600 }}>
            {rows && rows.length > 0 ? (
              rows.map((row, idx) => {
                const hasPnr = row.pnr && row.pnr !== '-';
                const hasRoute = row.route && row.route !== '-';
                const paxDetails = row.passengersDetail && row.passengersDetail.length > 0;
                
                let paxSummaryStr = '';
                if (paxDetails) {
                  let adt = 0, chd = 0, inf = 0;
                  const names: string[] = [];
                  row.passengersDetail?.forEach((p: any) => {
                    const type = typeof p === 'string' ? 'ADT' : (p.ticketType || 'ADT').toUpperCase();
                    if (type === 'CHD' || type === 'CHILD') chd++;
                    else if (type === 'INF' || type === 'INFANT') inf++;
                    else adt++;

                    const name = typeof p === 'string' ? p : (p.name || p.passengerName || '');
                    if (name) names.push(name);
                  });
                  paxSummaryStr = `${adt} ADT ${chd} CHD ${inf} INF: ${names.join(', ')}`;
                }

                return (
                  <tr key={idx} style={{ backgroundColor: idx % 2 === 1 ? tableRowStripedColor : '#ffffff' }}>
                    <td className="p-2 text-center font-mono border-r border-slate-200">{row.rowNumber}</td>
                    <td className="p-2 font-mono leading-tight border-r border-slate-200">
                      <div className="font-bold text-slate-900">{row.date}</div>
                      <div className="text-slate-600 text-[9px] font-bold mt-0.5">{row.docRef}</div>
                    </td>
                    <td className="p-2 text-slate-900 leading-snug border-r border-slate-200">
                      {(hasRoute || hasPnr) ? (
                        <div>
                          <div className="font-bold text-slate-900">
                            FLIGHT, {hasRoute ? row.route : ''} , Dep. {row.date} {hasPnr ? `, PNR:${row.pnr}` : ''}
                          </div>
                          {paxSummaryStr && (
                            <div className="text-[9.5px] text-slate-700 font-bold mt-0.5">
                              {paxSummaryStr}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <div className="font-bold text-slate-900">{row.statement}</div>
                          {paxSummaryStr && (
                            <div className="text-[9.5px] text-slate-700 font-bold mt-0.5">
                              {paxSummaryStr}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-2 text-center font-black text-slate-800 border-r border-slate-200">
                      {hasPnr ? 'DT-ISSUE' : (row.docRef?.startsWith('RV') ? 'RV-PAY' : 'GL-ENTRY')}
                    </td>
                    <td className="p-2 text-right font-mono font-bold border-r border-slate-200 text-slate-900">
                      {row.debit > 0 ? `${fmtNum(row.debit)} IQD` : ''}
                    </td>
                    <td className="p-2 text-right font-mono font-bold border-r border-slate-200 text-slate-900">
                      {row.credit > 0 ? `${fmtNum(row.credit)} IQD` : ''}
                    </td>
                    <td className="p-2 text-right font-mono font-black text-slate-900 whitespace-nowrap">
                      ({fmtNum(row.runningBalance)}) IQD
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-500 font-bold">
                  No financial movements recorded for this period
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Bar */}
      <div
        className="border-t border-slate-300 pt-2.5 mt-6 flex justify-between items-center text-slate-700 font-semibold relative z-10"
        style={{ fontSize: `${footerFontSize}px` }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-1 h-10 rounded-xs shrink-0" style={{ backgroundColor: titleAccentColor }}></div>
          <div className="space-y-0.5">
            <div><strong className="text-slate-800">Mobile:</strong> {config.phone || '07700003377 - 07800003901'}</div>
            <div><strong className="text-slate-800">Email:</strong> {config.email || 'Support@Fly4all.com'}</div>
            <div><strong className="text-slate-800">Address:</strong> {config.address || 'Iraq - Baghdad'}</div>
          </div>
        </div>

        {/* QR Code graphic */}
        {config.showQrCode !== false && (
          <div className="w-11 h-11 border border-slate-300 p-0.5 bg-white flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <rect width="100" height="100" fill="#ffffff"/>
              <rect x="5" y="5" width="30" height="30" fill="#1e293b"/>
              <rect x="10" y="10" width="20" height="20" fill="#ffffff"/>
              <rect x="15" y="15" width="10" height="10" fill="#1e293b"/>
              <rect x="65" y="5" width="30" height="30" fill="#1e293b"/>
              <rect x="70" y="10" width="20" height="20" fill="#ffffff"/>
              <rect x="75" y="15" width="10" height="10" fill="#1e293b"/>
              <rect x="5" y="65" width="30" height="30" fill="#1e293b"/>
              <rect x="10" y="70" width="20" height="20" fill="#ffffff"/>
              <rect x="15" y="75" width="10" height="10" fill="#1e293b"/>
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};

export interface AccountStatementPrintModalProps {
  opened: boolean;
  onClose: () => void;
  accountName: string;
  accountCode?: string;
  startDate: string;
  endDate: string;
  rows: StatementMovementItem[];
  totals: {
    totalDebit: number;
    totalCredit: number;
    finalBalance: number;
    openingBalance?: number;
    previousBalance?: number;
  };
}

export const printElementHD = (elementId: string, lang: LangKey = 'ar') => {
  const element = document.getElementById(elementId);
  if (!element) {
    window.print();
    return;
  }

  const isEn = lang === 'en';

  let iframe = document.getElementById('hd-print-iframe') as HTMLIFrameElement;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'hd-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '-9999px';
    iframe.style.bottom = '-9999px';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
  }

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  const styleTags = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((s) => s.outerHTML)
    .join('\n');

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="${isEn ? 'en' : 'ar'}" dir="${isEn ? 'ltr' : 'rtl'}">
      <head>
        <meta charset="UTF-8">
        <title>كشف حساب مالي - شركة السعدي</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700;800&family=Tajawal:wght@400;500;700;800;900&family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
        ${styleTags}
        <style>
          @page {
            size: A4 portrait;
            margin: 8mm 6mm 38mm 6mm !important;
          }
          *, *::before, *::after {
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
            color: #000000 !important;
            width: 100% !important;
            height: 100% !important;
            font-smooth: always !important;
            -webkit-font-smoothing: antialiased !important;
            text-rendering: optimizeLegibility !important;
          }
          #printable-statement-sheet {
            position: relative !important;
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            min-width: 100% !important;
            margin: 0 !important;
            padding: 0mm 6mm 0mm 6mm !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
            overflow: visible !important;
          }
          #printable-statement-sheet > div {
            display: block !important;
            overflow: visible !important;
          }
          table {
            display: table !important;
            width: 100% !important;
            border-collapse: collapse !important;
            page-break-inside: auto !important;
          }
          thead {
            display: table-header-group !important;
          }
          tbody {
            display: table-row-group !important;
          }
          tfoot {
            display: table-footer-group !important;
          }
          tfoot tr td {
            position: fixed !important;
            bottom: 0 !important;
            left: 6mm !important;
            right: 6mm !important;
            width: calc(100% - 12mm) !important;
            background: #ffffff !important;
            padding-top: 1mm !important;
            padding-bottom: 1mm !important;
            z-index: 9999 !important;
          }
          tr {
            display: table-row !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          td, th {
            display: table-cell !important;
          }
          thead tr:first-child td {
            padding-top: 3mm !important;
            padding-bottom: 2mm !important;
          }
          .print-summary-footer-block,
          .print-summary-block {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        </style>
      </head>
      <body>
        ${element.outerHTML}
      </body>
    </html>
  `);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
  }, 350);
};

export interface AccountStatementPrintModalProps {
  opened: boolean;
  onClose: () => void;
  accountName: string;
  accountCode?: string;
  accountPhone?: string;
  accountEmail?: string;
  accountAddress?: string;
  startDate: string;
  endDate: string;
  rows: StatementMovementItem[];
  totals: {
    totalDebit: number;
    totalCredit: number;
    finalBalance: number;
    openingBalance?: number;
    previousBalance?: number;
  };
}

export const AccountStatementPrintModal: React.FC<AccountStatementPrintModalProps> = ({
  opened,
  onClose,
  accountName,
  accountCode,
  accountPhone,
  accountEmail,
  accountAddress,
  startDate,
  endDate,
  rows,
  totals,
}) => {
  const { language } = useLanguageStore();
  const [config, setConfig] = useState<any>(DEFAULT_STATEMENT_CONFIG);
  const [loading, setLoading] = useState(false);
  const [printLang, setPrintLang] = useState<LangKey>((language as LangKey) || 'ar');

  useEffect(() => {
    if (language === 'en' || language === 'ar') {
      setPrintLang(language);
    }
  }, [language]);


  useEffect(() => {
    if (opened) {
      setLoading(true);
      fetchPrintTemplate('statement')
        .then((res) => {
          if (res && res.config) {
            setConfig({ ...DEFAULT_STATEMENT_CONFIG, ...res.config });
          }
        })
        .catch(() => {})
        .finally(() => {
          setLoading(false);
        });
    }
  }, [opened]);

  const t = LABELS[printLang];
  const [exporting, setExporting] = useState(false);

  const handlePrint = () => {
    printElementHD('printable-statement-sheet', printLang);
  };

  const handleExportPdf = async () => {
    const element = document.getElementById('printable-statement-sheet');
    if (!element) return;
    setExporting(true);
    try {
      // Collect all stylesheets from the page (these already include <style> and <link> tags)
      const styleSheets = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map((s) => s.outerHTML)
        .join('\n');

      // Custom print overrides
      const customPrintStyles = `
        @page {
          size: A4 portrait;
          margin: 8mm 6mm 36mm 6mm !important;
        }
        body { font-family: 'IBM Plex Sans Arabic', 'Tajawal', 'Cairo', sans-serif !important; }
        #printable-statement-sheet {
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 0 2mm !important;
          box-shadow: none !important;
          border: none !important;
          background: #ffffff !important;
        }
        table {
          display: table !important;
          width: 100% !important;
          border-collapse: collapse !important;
          page-break-inside: auto !important;
        }
        thead {
          display: table-header-group !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        thead tr {
          display: table-row !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        thead tr:first-child td {
          padding-top: 4mm !important;
          padding-bottom: 2mm !important;
        }
        tbody {
          display: table-row-group !important;
        }
        tfoot {
          display: table-footer-group !important;
        }
        tfoot tr td {
          position: fixed !important;
          bottom: 3mm !important;
          left: 4mm !important;
          right: 4mm !important;
          width: calc(100% - 8mm) !important;
          background: #ffffff !important;
          padding-top: 2px !important;
          padding-bottom: 2px !important;
          z-index: 9999 !important;
        }
        tr {
          display: table-row !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        td, th {
          display: table-cell !important;
        }
        .print-summary-block {
          margin-top: 6px !important;
          margin-bottom: 14px !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        .printable-footer-bar {
          margin-top: 10px !important;
        }
        .print-summary-footer-block {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        .no-print { display: none !important; }
        #statement-printable-header { display: none !important; }
      `;

      const inlineCss = Array.from(document.querySelectorAll('style'))
        .map((s) => s.textContent || '')
        .join('\n');

      // Extract printable header element HTML for native Puppeteer repeating header
      const headerElem = document.getElementById('statement-printable-header');
      const headerHtml = headerElem ? `
        <style>
          ${inlineCss}
          *, *::before, *::after { box-sizing: border-box !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { font-family: 'IBM Plex Sans Arabic', 'Tajawal', sans-serif !important; margin: 0 !important; background: #ffffff !important; }
        </style>
        <div dir="${printLang === 'en' ? 'ltr' : 'rtl'}" style="width: 100%; font-family: 'IBM Plex Sans Arabic', 'Tajawal', sans-serif; background: #ffffff;">
          ${headerElem.outerHTML}
        </div>
      ` : undefined;
      const headerHeightMm = config.headerHeight ? Math.max(Math.round(config.headerHeight * 0.265 + 6), 40) : 48;

      // Build standalone HTML string
      const html = `
        ${styleSheets}
        <style>
          ${customPrintStyles}
        </style>
        ${element.outerHTML}
      `;

      const filename = `statement_${accountCode || 'report'}_${new Date().toISOString().split('T')[0]}.pdf`;
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/pdf/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          html,
          headerHtml,
          lang: printLang,
          format: 'A4',
          marginTop: `${headerHeightMm}mm`,
          marginBottom: '20mm',
          filename,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      // Direct download without opening new tab
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = filename;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      // Clean up blob URL after delay
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err: any) {
      console.error('PDF export failed:', err);
      // Fallback to browser print
      handlePrint();
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="xl"
      title={
        <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm">
          <IconFileText size={18} className="text-emerald-600" />
          <span>{t.previewTitle}</span>
        </div>
      }
      styles={{ body: { padding: '1rem' } }}
    >
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 5mm !important; }
          body, html { background: #ffffff !important; color: #000000 !important; margin: 0 !important; padding: 0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; font-smooth: always !important; -webkit-font-smoothing: antialiased !important; }
          .no-print, header, nav, aside, footer, button, select, input, .mantine-Modal-header, .mantine-Modal-close, .mantine-Overlay-root { display: none !important; }
          .mantine-Modal-content { box-shadow: none !important; border: none !important; padding: 0 !important; margin: 0 !important; max-width: 100% !important; width: 100% !important; background: transparent !important; }
          #printable-statement-sheet { position: relative !important; display: block !important; width: 100% !important; max-width: 210mm !important; min-width: 0 !important; margin: 0 auto !important; padding: 4mm !important; box-shadow: none !important; border: none !important; background: #ffffff !important; transform: none !important; zoom: 1 !important; }
          * { box-shadow: none !important; text-shadow: none !important; }
        }
      `}</style>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 space-y-3">
          <Loader color="emerald" size="md" />
          <span className="text-xs font-bold text-slate-600">{t.loadingTemplate}</span>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200 no-print">
            <div className="flex items-center gap-2">
              <Badge color="emerald" size="md" variant="filled">
                {t.approvedTemplate}
              </Badge>
              <span className="text-xs font-bold text-slate-700">
                {t.accountShort}: <strong className="text-slate-900">{accountCode ? `${accountCode} — ` : ''}{accountName}</strong>
              </span>
            </div>

            <Group gap="xs">
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-0.5">
                <IconLanguage size={15} className="text-blue-600" />
                <SegmentedControl
                  size="xs"
                  value={printLang}
                  onChange={(v) => setPrintLang(v as LangKey)}
                  data={[
                    { label: 'عربي', value: 'ar' },
                    { label: 'English', value: 'en' },
                  ]}
                  styles={{ root: { backgroundColor: 'transparent' } }}
                />
              </div>
              <Button
                size="xs"
                color="indigo"
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
                {t.printBtn}
              </Button>
              <Button size="xs" variant="subtle" color="gray" onClick={onClose}>
                {t.closeBtn}
              </Button>
            </Group>
          </div>

          <div className="bg-slate-100/50 p-2 rounded-xl border border-slate-200 overflow-x-auto flex justify-center print:bg-white print:p-0 print:border-none print:shadow-none print:m-0">
            <PrintableAccountStatementSheet
              accountName={accountName}
              accountCode={accountCode}
              startDate={startDate}
              endDate={endDate}
              rows={rows}
              totals={totals}
              config={config}
              lang={printLang}
            />
          </div>
        </div>
      )}
    </Modal>
  );
};

export interface AccountStatementQuickExportModalProps {
  opened: boolean;
  onClose: () => void;
  accountName: string;
  accountCode?: string;
  accountPhone?: string;
  accountEmail?: string;
  accountAddress?: string;
  startDate: string;
  endDate: string;
  rows: StatementMovementItem[];
  totals: {
    totalDebit: number;
    totalCredit: number;
    finalBalance: number;
    openingBalance?: number;
    previousBalance?: number;
  };
  onOpenAdvancedPreview?: () => void;
}

export const AccountStatementQuickExportModal: React.FC<AccountStatementQuickExportModalProps> = ({
  opened,
  onClose,
  accountName,
  accountCode,
  accountPhone,
  accountEmail,
  accountAddress,
  startDate,
  endDate,
  rows,
  totals,
  onOpenAdvancedPreview,
}) => {
  const { language } = useLanguageStore();
  const [lang, setLang] = useState<LangKey>((language as LangKey) || 'ar');
  const [downloading, setDownloading] = useState(false);
  const [config, setConfig] = useState<any>(DEFAULT_STATEMENT_CONFIG);

  useEffect(() => {
    if (language === 'en' || language === 'ar') {
      setLang(language);
    }
  }, [language]);

  const isEn = lang === 'en';


  // ── Brevo Email Tracking & Progress States ──
  const [isTrackingSending, setIsTrackingSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<'sending' | 'completed' | 'failed'>('sending');
  const [stats, setStats] = useState({
    total: 1,
    sent: 0,
    pending: 1,
    failed: 0,
    skipped: 0,
  });

  useEffect(() => {
    if (!opened) return;
    setIsTrackingSending(false);
    setSendStatus('sending');
    setStats({ total: 1, sent: 0, pending: 1, failed: 0, skipped: 0 });

    fetchPrintTemplate('statement')
      .then((res) => {
        if (res && res.config) {
          setConfig({ ...DEFAULT_STATEMENT_CONFIG, ...res.config });
        }
      })
      .catch(() => {
        // fallback to default
      });
  }, [opened]);

  const exportDirectPdfFile = async () => {
    const printableElement = document.getElementById('printable-statement-sheet');
    if (!printableElement) throw new Error('NO_ELEMENT');

    const canvas = await html2canvas(printableElement, {
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

    const filename = `كشف_حساب_${accountCode || accountName}_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(filename);
    showSuccessNotification('تم التحميل', 'تم تصدير وحفظ كشف الحساب بصيغة PDF مباشرة');
    onClose();
  };

  const handleDownloadPdfDirect = async () => {
    setDownloading(true);
    try {
      const token = localStorage.getItem('token');
      const templateRows = rows.map(r => ({
        ...r,
        passengers: r.passengersDetail?.map(p => {
          const rawType = (p.ticketType || 'ADT').toUpperCase();
          const isChild = rawType === 'CHD' || rawType === 'CHILD' || rawType === 'INF' || rawType === 'INFANT';
          const isInfant = rawType === 'INF' || rawType === 'INFANT';
          const displayType = isInfant ? 'INF' : isChild ? 'CHD' : 'ADT';
          return {
            fullName: p.name || '',
            type: displayType,
            typeClass: isInfant ? 'pax-type-inf' : isChild ? 'pax-type-chd' : 'pax-type-adt',
            isChild,
          };
        }) || [],
      }));

      try {
        const res = await fetch(`${API_BASE_URL}/pdf/statement`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            accountName,
            accountCode,
            accountPhone,
            accountEmail,
            accountAddress,
            startDate,
            endDate,
            rows: templateRows,
            totals,
            lang,
            settings: {
              ...config,
              templatePreset: config.templatePreset || 'classic',
              companyNameAr: config.companyName || config.companyNameAr,
              companyNameEn: config.companyNameEn || config.companyName,
              subtitleAr: config.subtitle || config.subtitleAr,
              subtitleEn: config.subtitleEn || config.subtitle,
              addressAr: config.address || config.addressAr,
              addressEn: config.addressEn || config.address,
              footerTextAr: config.footerText || config.footerTextAr,
              footerTextEn: config.footerTextEn || config.footerText,
            },
          }),
        });

        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const filename = `كشف_حساب_${accountCode || accountName}_${new Date().toISOString().split('T')[0]}.pdf`;
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 60000);
          showSuccessNotification('تم التحميل', 'تم تصدير كشف الحساب بصيغة PDF بنجاح');
          onClose();
          return;
        }
      } catch (err) {
        console.warn('Backend PDF endpoint error, using direct client-side PDF download:', err);
      }

      // Direct client-side high-resolution PDF download (Direct file save, zero print dialogs!)
      await exportDirectPdfFile();
    } catch (e) {
      console.error(e);
      showErrorNotification('خطأ في التصدير', 'تعذر تصدير ملف PDF، يرجى المحاولة لاحقاً');
    } finally {
      setDownloading(false);
    }
  };

  const handleShareWhatsApp = () => {
    const isEn = lang === 'en';
    const text = isEn
      ? `📄 *Account Statement Summary*\n👤 Account: ${accountCode ? `${accountCode} - ` : ''}${accountName}\n📅 Period: ${startDate} to ${endDate}\n➕ Total Debit: ${totals.totalDebit.toLocaleString()} IQD\n➖ Total Credit: ${totals.totalCredit.toLocaleString()} IQD\n💰 Net Balance: ${totals.finalBalance.toLocaleString()} IQD`
      : `📄 *ملخص كشف الحساب المالي*\n👤 الحساب: ${accountCode ? `${accountCode} - ` : ''}${accountName}\n📅 الفترة: من ${startDate} إلى ${endDate}\n➕ إجمالي المدين: ${totals.totalDebit.toLocaleString()} د.ع\n➖ إجمالي الدائن: ${totals.totalCredit.toLocaleString()} د.ع\n💰 صافي الرصيد النهائي: ${totals.finalBalance.toLocaleString()} د.ع`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  // ── Brevo Direct Statement & PDF Email Sender with Live Progress Tracking ──
  const handleStartBrevoSending = async () => {
    setIsTrackingSending(true);
    setSendStatus('sending');
    setStats({ total: 1, sent: 0, pending: 1, failed: 0, skipped: 0 });

    try {
      const targetEmail = (accountEmail && accountEmail.trim()) ? accountEmail.trim() : 'alsaady.rrr123r@gmail.com';
      let pdfBase64: string | undefined = undefined;

      try {
        const token = localStorage.getItem('token');
        const templateRows = rows.map(r => ({
          ...r,
          passengers: r.passengersDetail?.map(p => {
            const rawType = (p.ticketType || 'ADT').toUpperCase();
            const isChild = rawType === 'CHD' || rawType === 'CHILD' || rawType === 'INF' || rawType === 'INFANT';
            const isInfant = rawType === 'INF' || rawType === 'INFANT';
            const displayType = isInfant ? 'INF' : isChild ? 'CHD' : 'ADT';
            return {
              fullName: p.name || '',
              type: displayType,
              typeClass: isInfant ? 'pax-type-inf' : isChild ? 'pax-type-chd' : 'pax-type-adt',
              isChild,
            };
          }) || [],
        }));

        const res = await fetch(`${API_BASE_URL}/pdf/statement`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            accountName,
            accountCode,
            accountPhone,
            accountEmail: targetEmail,
            accountAddress,
            startDate,
            endDate,
            rows: templateRows,
            totals,
            lang,
            settings: {
              ...config,
              templatePreset: config.templatePreset || 'classic',
              companyNameAr: config.companyName || config.companyNameAr,
              companyNameEn: config.companyNameEn || config.companyName,
              subtitleAr: config.subtitle || config.subtitleAr,
              subtitleEn: config.subtitleEn || config.subtitle,
              addressAr: config.address || config.addressAr,
              addressEn: config.addressEn || config.address,
              footerTextAr: config.footerText || config.footerTextAr,
              footerTextEn: config.footerTextEn || config.footerText,
            },
          }),
        });

        if (res.ok) {
          const blob = await res.blob();
          const base64Promise = new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const resStr = reader.result as string;
              resolve(resStr.split(',')[1] || resStr);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          pdfBase64 = await base64Promise;
        }
      } catch (pdfErr) {
        console.warn('PDF generation error:', pdfErr);
      }

      await apiRequest('/api/email/send-statement', {
        method: 'POST',
        body: JSON.stringify({
          recipientEmail: targetEmail,
          recipientName: accountName,
          accountName: accountName,
          currency: 'IQD',
          currentBalance: totals.finalBalance,
          fromDate: startDate,
          toDate: endDate,
          subject: `كشف حساب مالي رسمي — ${accountCode ? `${accountCode} - ` : ''}${accountName}`,
          customMessage: 'مرحباً شريكنا، تجدون برفقه كشف الحساب المالي. لطفاً تسديد ما بذمتكم من متعلقات.',
          pdfBase64: pdfBase64,
        }),
      });

      setSendStatus('completed');
      setStats({ total: 1, sent: 1, pending: 0, failed: 0, skipped: 0 });
      showSuccessNotification('اكتمل الإرسال', `تم إرسال كشف الحساب بنجاح إلى: ${targetEmail}`);
    } catch (err: any) {
      console.error('Failed to send statement email:', err);
      setSendStatus('failed');
      setStats({ total: 1, sent: 0, pending: 0, failed: 1, skipped: 0 });
      showErrorNotification('فشل الإرسال', err.message || 'حدث خطأ أثناء إرسال البريد الإلكتروني');
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={() => {
        setIsTrackingSending(false);
        onClose();
      }}
      size={isTrackingSending ? 'lg' : 'md'}
      centered
      radius="lg"
      withCloseButton={false}
      styles={{
        content: {
          background: 'linear-gradient(to bottom, #ffffff, #f8fafc)',
          border: '1px solid #e2e8f0',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        },
      }}
    >
      {isTrackingSending ? (
        /* ── Real-time Progress Tracking Modal View ── */
        <div className="p-4 space-y-4 text-slate-900 font-sans" dir={isEn ? 'ltr' : 'rtl'}>
          {/* Header */}
          <div className="flex items-center justify-between pb-1">
            <div>
              <h3 className="font-extrabold text-base text-slate-900 leading-tight">
                {isEn ? 'Sending Account Statement' : 'إرسال كشوفات الحساب'}
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5" dir="ltr">
                {isEn ? `Period: ${startDate} → ${endDate}` : `الفترة: ${startDate} إلى ${endDate}`}
              </p>
            </div>
            <button
              onClick={() => {
                setIsTrackingSending(false);
                onClose();
              }}
              className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
            >
              <IconX size={18} />
            </button>
          </div>

          {/* Progress bar and counter */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600">
              <span>{stats.sent + stats.failed} / {stats.total}</span>
              <span className={sendStatus === 'completed' ? 'text-emerald-700' : sendStatus === 'failed' ? 'text-rose-700' : 'text-orange-600'}>
                {sendStatus === 'completed'
                  ? (isEn ? 'Completed' : 'اكتمل')
                  : sendStatus === 'failed'
                  ? (isEn ? 'Sending Failed' : 'فشل الإرسال')
                  : (isEn ? 'Sending in progress...' : 'جاري الإرسال...')}
              </span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  sendStatus === 'failed' ? 'bg-rose-500' : 'bg-orange-500'
                }`}
                style={{ width: sendStatus === 'completed' ? '100%' : sendStatus === 'failed' ? '100%' : '50%' }}
              />
            </div>
          </div>

          {/* Status Details Card */}
          <div className="bg-slate-50/70 border border-slate-200/90 rounded-xl p-4 space-y-4">
            {/* Status Title */}
            <div className="flex items-center justify-end gap-1.5">
              {sendStatus === 'completed' && (
                <div className="flex items-center gap-1.5 text-emerald-700 font-extrabold text-sm">
                  <span>{isEn ? 'Sending Completed Successfully' : 'اكتمل الإرسال بنجاح'}</span>
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <IconCheck size={14} />
                  </div>
                </div>
              )}
              {sendStatus === 'sending' && (
                <div className="flex items-center gap-2 text-orange-600 font-bold text-sm">
                  <span>{isEn ? 'Sending statement via Brevo...' : 'جاري إرسال كشف الحساب عبر Brevo...'}</span>
                  <Loader size={14} color="orange" />
                </div>
              )}
              {sendStatus === 'failed' && (
                <div className="flex items-center gap-1.5 text-rose-700 font-extrabold text-sm">
                  <span>{isEn ? 'Sending Failed' : 'فشل الإرسال'}</span>
                  <IconAlertCircle size={16} className="text-rose-600" />
                </div>
              )}
            </div>

            {/* 4 Stats Columns */}
            <div className="grid grid-cols-4 gap-2 text-center pt-1 border-t border-slate-200/60">
              <div>
                <span className="text-xs text-slate-500 font-medium block">{isEn ? 'Sent' : 'أُرسلت'}</span>
                <span className="text-base font-extrabold text-emerald-600 block mt-1">{stats.sent}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 font-medium block">{isEn ? 'Pending' : 'قيد الانتظار'}</span>
                <span className="text-base font-extrabold text-slate-700 block mt-1">{stats.pending}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 font-medium block">{isEn ? 'Failed' : 'فشلت'}</span>
                <span className={`text-base font-extrabold block mt-1 ${stats.failed > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                  {stats.failed}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 font-medium block">{isEn ? 'Skipped' : 'تم تخطيها'}</span>
                <span className="text-base font-extrabold text-slate-700 block mt-1">{stats.skipped}</span>
              </div>
            </div>
          </div>

          {/* Background note */}
          <div className="flex items-center gap-1.5 text-slate-500 text-xs">
            <IconAlertTriangle size={15} className="shrink-0 text-slate-400" />
            <span>{isEn ? 'Sending continues in the background — you can close safely.' : 'يستمر الإرسال في الخلفية — يمكنك الإغلاق والعودة لاحقاً.'}</span>
          </div>

          {/* Footer Action */}
          <div className="flex justify-end pt-2">
            <button
              onClick={() => {
                setIsTrackingSending(false);
                onClose();
              }}
              className="px-6 py-1.5 border border-orange-500 text-orange-600 hover:bg-orange-50 active:scale-95 rounded-lg text-xs font-extrabold transition-all cursor-pointer bg-white"
            >
              {isEn ? 'Close' : 'إغلاق'}
            </button>
          </div>
        </div>
      ) : (
        /* ── Standard Quick Export Menu View (Redesigned) ── */
        <div className="p-3 space-y-4 text-slate-900 font-sans" dir={isEn ? 'ltr' : 'rtl'}>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                <IconFileTypePdf size={24} />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900 leading-tight">
                  {isEn ? 'Export & Share Statement' : 'تصدير ومشاركة كشف الحساب'}
                </h3>
                <p className="text-xs font-bold text-slate-500 mt-0.5">
                  {accountCode ? `${accountCode} — ` : ''}{accountName}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
            >
              <IconX size={16} />
            </button>
          </div>

          {/* Account Summary Mini Card */}
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between text-xs font-sans">
            <div className="space-y-0.5">
              <span className="text-[10.5px] font-bold text-slate-400 block">
                {isEn ? 'Closing Balance' : 'صافي الرصيد الختامي'}
              </span>
              <span className={`font-mono font-black text-sm ${totals.finalBalance >= 0 ? 'text-rose-700' : 'text-emerald-700'}`} dir="ltr">
                {totals.finalBalance < 0 ? `- ${Math.abs(totals.finalBalance).toLocaleString()} IQD` : `${totals.finalBalance.toLocaleString()} IQD`}
              </span>
            </div>
            <div className="text-end font-mono text-[11px] font-bold text-slate-500 space-y-0.5" dir="ltr">
              <span className="text-[10px] font-bold text-slate-400 block font-sans">{isEn ? 'Period' : 'الفترة'}</span>
              <span>{startDate} ➔ {endDate}</span>
            </div>
          </div>

          {/* Language Selection Pills */}
          <div className="bg-slate-100/90 p-1.5 rounded-2xl flex items-center justify-between border border-slate-200">
            <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5 px-2">
              <IconLanguage size={16} className="text-[#F45A0A]" />
              {isEn ? 'Statement Language:' : 'لغة كشف الحساب:'}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setLang('ar')}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                  lang === 'ar'
                    ? 'bg-[#F45A0A] text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                🇸🇦 العربية
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                  lang === 'en'
                    ? 'bg-[#F45A0A] text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                🇬🇧 English
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-1">
            {/* Primary Action Button: Direct PDF Download */}
            <button
              type="button"
              onClick={handleDownloadPdfDirect}
              disabled={downloading}
              className="w-full h-12 rounded-2xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-extrabold text-xs shadow-md shadow-orange-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer hover:shadow-lg active:scale-98 disabled:opacity-50"
            >
              {downloading ? (
                <>
                  <Loader size={18} color="white" />
                  <span>{isEn ? 'Generating PDF Document...' : 'جاري إنشاء ملف PDF...'}</span>
                </>
              ) : (
                <>
                  <IconDownload size={18} />
                  <span>{isEn ? 'Download Statement (Direct PDF)' : 'تحميل كشف الحساب المالي (PDF مباشر)'}</span>
                </>
              )}
            </button>

            {/* 2 Side-by-Side Action Cards (WhatsApp & Email) */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* WhatsApp Share */}
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="p-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-950 transition-all text-start cursor-pointer shadow-2xs flex items-center gap-2.5 group active:scale-98"
              >
                <div className="w-9 h-9 rounded-xl bg-white border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-2xs shrink-0 group-hover:scale-105 transition-transform">
                  <IconBrandWhatsapp size={20} />
                </div>
                <div className="min-w-0">
                  <span className="font-extrabold text-xs block truncate text-emerald-900">
                    {isEn ? 'WhatsApp' : 'واتساب'}
                  </span>
                  <span className="text-[10px] text-emerald-700 block truncate font-medium">
                    {isEn ? 'Send Summary' : 'إرسال الملخص'}
                  </span>
                </div>
              </button>

              {/* Email Share via Brevo */}
              <button
                type="button"
                onClick={handleStartBrevoSending}
                className="p-2.5 rounded-2xl border border-sky-200 bg-sky-50/60 hover:bg-sky-100/80 text-sky-950 transition-all text-start cursor-pointer shadow-2xs flex items-center gap-2.5 group active:scale-98"
              >
                <div className="w-9 h-9 rounded-xl bg-white border border-sky-200 flex items-center justify-center text-sky-600 shadow-2xs shrink-0 group-hover:scale-105 transition-transform">
                  <IconMail size={20} />
                </div>
                <div className="min-w-0">
                  <span className="font-extrabold text-xs block truncate text-sky-900">
                    {isEn ? 'Email' : 'إيميل'}
                  </span>
                  <span className="text-[10px] text-sky-700 block truncate font-medium">
                    {isEn ? 'Send PDF' : 'إرسال PDF'}
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Option for Advanced Preview */}
          {onOpenAdvancedPreview && (
            <div className="pt-2 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAdvancedPreview();
                }}
                className="text-xs font-bold text-slate-500 hover:text-[#F45A0A] hover:underline flex items-center justify-center gap-1.5 mx-auto transition-colors cursor-pointer py-1"
              >
                <IconPrinter size={15} />
                <span>{isEn ? 'Advanced Preview & Customize Template' : 'المعاينة المتقدمة وتخصيص نموذج الطباعة'}</span>
              </button>
            </div>
          )}
        </div>
      )}



        {/* Offscreen Sheet Container for PDF Generator HTML capturing */}
        <div style={{ position: 'fixed', left: '-9999px', top: '-9999px', width: '780px', pointerEvents: 'none', opacity: 0 }}>
          <div id="quick-export-sheet-wrapper">
            <PrintableAccountStatementSheet
              accountName={accountName}
              accountCode={accountCode}
              accountPhone={accountPhone}
              accountEmail={accountEmail}
              accountAddress={accountAddress}
              startDate={startDate}
              endDate={endDate}
              rows={rows}
              totals={totals}
              config={config}
              lang={lang}
            />
          </div>
        </div>
    </Modal>
  );
};
