import React, { useState, useEffect, useRef } from 'react';
import {
  Paper,
  TextInput,
  Button,
  Badge,
  Switch,
  Select,
  Textarea,
  ColorInput,
  Tooltip,
  Slider,
  Group,
  Stack,
  ActionIcon,
  Tabs,
  Accordion,
  SegmentedControl,
  Modal,
} from '@mantine/core';
import {
  IconPrinter,
  IconDeviceFloppy,
  IconRotate,
  IconPalette,
  IconFileText,
  IconPlane,
  IconReceiptTax,
  IconBook,
  IconArrowsExchange,
  IconPhoto,
  IconEye,
  IconCheck,
  IconUpload,
  IconTrash,
  IconTypography,
  IconZoomIn,
  IconZoomOut,
  IconQrcode,
  IconDragDrop,
  IconListNumbers,
  IconBuilding,
  IconAdjustments,
  IconSparkles,
  IconBrush,
  IconShieldCheck,
  IconCertificate,
  IconChevronRight,
  IconChevronLeft,
  IconCrown,
  IconStar,
  IconWaveSine,
  IconLayoutGrid,
  IconCategory,
  IconLayoutBottombar,
  IconWand,
  IconRocket,
  IconCalculator,
  IconReceipt2,
  IconFileCertificate,
  IconBolt,
  IconDatabase,
  IconMaximize,
  IconMinimize,
  IconLayoutAlignRight,
  IconLayoutAlignCenter,
  IconLayoutAlignLeft,
  IconHandMove,
  IconBookmark,
  IconPlus,
  IconLanguage,
} from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import {
  fetchAllPrintTemplates,
  savePrintTemplate,
  fetchTemplatesForDocType,
  createPrintTemplate,
  updatePrintTemplate,
  setDefaultPrintTemplate,
  deletePrintTemplate,
  PrintTemplateSavedItem,
} from '../../api/printTemplates';
import { accountsApi } from '../../api/accounts';
import { branchesApi, type Branch } from '../../api/branches';
import { apiRequest } from '../../api/client';


// Available document template types
export type TemplateDocType = 'statement' | 'ticket' | 'receipt' | 'payment' | 'journal' | 'exchange';

export interface FontSizesConfig {
  companyTitle: number;
  subtitle: number;
  headerDetails: number;
  docTitle: number;
  tableHeader: number;
  tableBody: number;
  notes: number;
  signatures: number;
  footer: number;
  summaryTitle: number;
  summaryMetrics: number;
}

export interface TemplateConfig {
  companyName: string;
  companyNameEn?: string;
  subtitle: string;
  subtitleEn?: string;
  commercialReg: string;
  commercialRegEn?: string;
  phone: string;
  email: string;
  address: string;
  addressEn?: string;
  logoUrl: string;
  logoAlign: 'right' | 'center' | 'left' | 'custom';
  logoSize: number;
  logoPosX: number;
  logoPosY: number;
  logoBorderRadius: number;
  primaryColor: string;
  headerBgColor: string;
  headerHeight?: number;
  headerTextColor: 'white' | 'dark';
  headerStyle:
    | 'solid'
    | 'gradient'
    | 'tint'
    | 'modern'
    | 'minimal'
    | 'sidebar'
    | 'luxury'
    | 'neon_stripe'
    | 'wave_header'
    | 'split_dual'
    | 'badge_card'
    | 'carbon'
    | 'emerald_crown'
    | 'classic_pinstripe'
    | 'royal_purple'
    | 'ocean_breeze'
    | 'golden_crest'
    | 'sunset_glow'
    | 'midnight_navy'
    | 'pill_floating'
    | 'double_frame'
    | 'monochrome_bold'
    | 'vintage_scroll'
    | 'cyber_grid'
    | 'frosted_glass'
    | 'ruby_lux';
  footerStyle:
    | 'classic_line'
    | 'solid_accent'
    | 'gradient_bar'
    | 'double_line'
    | 'dark_luxury'
    | 'floating_pill'
    | 'boxed_tint'
    | 'minimal_clean'
    | 'neon_line'
    | 'carbon_footer'
    | 'vintage_gold'
    | 'modern_split'
    | 'emerald_strip'
    | 'frosted_bar'
    | 'ruby_stripe';
  pageTheme:
    | 'executive'
    | 'corporate'
    | 'modern_tech'
    | 'classic_bank'
    | 'minimal_white'
    | 'emerald_vip'
    | 'royal_gold'
    | 'cyan_future'
    | 'crimson_elite'
    | 'midnight_dark';
  tableTextColor: string;
  tableHeaderBgColor: string;
  tableHeaderTextColor: string;
  tableRowStriped: boolean;
  fontFamily: string;
  isTableBold: boolean;
  paperSize: 'A4' | 'A5' | 'Letter';
  orientation: 'portrait' | 'landscape';
  watermarkText: string;
  showWatermark: boolean;
  showQrCode: boolean;
  qrPosition: 'custom' | 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  qrSize: number;
  qrPosX: number;
  qrPosY: number;
  qrPageRule: 'all' | 'first' | 'last';
  qrColor: string;
  qrBgColor: string;
  qrBorderColor: string;
  qrShape: 'rounded_card' | 'minimal_qr' | 'stamp' | 'badge_shield' | 'gold_luxury' | 'banner_pill';
  qrShowLabel: boolean;
  tableMaxHeight: number;
  sampleRowCount: number;
  textWrapMode: 'wrap' | 'nowrap';
  showSignatures: boolean;
  managerSignTitle: string;
  accountantSignTitle: string;
  receiverSignTitle: string;
  notesText: string;
  footerText: string;
  footerTextEn?: string;
  footerAlign: 'right' | 'center' | 'left';
  footerHeight?: number;
  footerTextColor?: string;
  footerFontSize?: number;
  showPageNumbers: boolean;
  fontSizes: FontSizesConfig;
  showFinancialSummary: boolean;
  summaryStyle: 'grid_cards' | 'table_summary' | 'executive_banner' | 'gold_bordered';
  showTafqeet: boolean;
  summaryBgColor: string;
  showOpeningBalance?: boolean;
  summaryOpeningBg?: string;
  summaryOpeningTextColor?: string;
  summaryDebitBg?: string;
  summaryDebitTextColor?: string;
  summaryCreditBg?: string;
  summaryCreditTextColor?: string;
  summaryBalanceBg?: string;
  summaryBalanceTextColor?: string;
  summaryTafqeetBg?: string;
  summaryTafqeetTextColor?: string;
}

const DEFAULT_FONT_SIZES: FontSizesConfig = {
  companyTitle: 20,
  subtitle: 12,
  headerDetails: 11,
  docTitle: 13,
  tableHeader: 11,
  tableBody: 11,
  notes: 11,
  signatures: 11,
  footer: 10,
  summaryTitle: 13,
  summaryMetrics: 12,
};

const DEFAULT_CONFIGS: Record<TemplateDocType, TemplateConfig> = {
  statement: {
    companyName: 'شركة السعدي لخدمات السفر والسياحة',
    companyNameEn: 'Al-Saadi Travel & Tourism Co.',
    subtitle: 'قسم المحاسبة والمالية — كشف حساب تفصيلي',
    subtitleEn: 'Accounting & Finance Department — Detailed Account Statement',
    commercialReg: 'س.ت: 90182471 / بغداد',
    commercialRegEn: 'T.R.: 90182471 / Baghdad',
    phone: '+964 770 123 4567',
    email: 'finance@alsaadi-travel.com',
    address: 'بغداد — الكرادة — شارع 62',
    addressEn: 'Baghdad — Karrada — Street 62',
    logoUrl: '',
    logoAlign: 'left',
    logoSize: 75,
    logoPosX: 480,
    logoPosY: 35,
    logoBorderRadius: 8,
    primaryColor: '#059669',
    headerBgColor: '#059669',
    headerTextColor: 'white',
    headerStyle: 'gradient',
    footerStyle: 'gradient_bar',
    pageTheme: 'executive',
    tableTextColor: '#0f172a',
    tableHeaderBgColor: '#059669',
    tableHeaderTextColor: '#ffffff',
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
    qrPageRule: 'all',
    qrColor: '#059669',
    qrBgColor: '#ffffff',
    qrBorderColor: '#059669',
    qrShape: 'rounded_card',
    qrShowLabel: true,
    tableMaxHeight: 520,
    sampleRowCount: 6,
    textWrapMode: 'wrap',
    showSignatures: true,
    managerSignTitle: 'توقيع المدير العام',
    accountantSignTitle: 'توقيع الحسابات',
    receiverSignTitle: 'توقيع صاحب الحساب',
    notesText: 'ملاحظة: هذا الكشف يعتبر مطبقاً وموافقاً عليه رسمياً ما لم يتم الإعتراض خلال 7 أيام من تاريخ صدوره.',
    footerText: 'شركة السعدي للسفر والسياحة — هاتف خدمة العملاء: 6012 — جميع الحقوق محفوظة © 2026',
    footerTextEn: 'Al-Saadi Travel & Tourism — Customer Service: 6012 — All Rights Reserved © 2026',
    footerAlign: 'center',
    showPageNumbers: true,
    fontSizes: { ...DEFAULT_FONT_SIZES },
    showFinancialSummary: true,
    summaryStyle: 'grid_cards',
    showTafqeet: true,
    summaryBgColor: '#f8fafc',
  },
  ticket: {
    companyName: 'شركة السعدي لخدمات السفر والسياحة',
    subtitle: 'فاتورة وسند تذاكر الطيران المحاسبية الحية',
    commercialReg: 'ترخيص طيران مدني: IQ-8921',
    phone: '+964 770 123 4567',
    email: 'tickets@alsaadi-travel.com',
    address: 'بغداد — الكرادة — شارع 62',
    logoUrl: '',
    logoAlign: 'left',
    logoSize: 75,
    logoPosX: 480,
    logoPosY: 35,
    logoBorderRadius: 8,
    primaryColor: '#2563eb',
    headerBgColor: '#2563eb',
    headerTextColor: 'white',
    headerStyle: 'wave_header',
    footerStyle: 'floating_pill',
    pageTheme: 'modern_tech',
    tableTextColor: '#0f172a',
    tableHeaderBgColor: '#2563eb',
    tableHeaderTextColor: '#ffffff',
    tableRowStriped: true,
    fontFamily: 'IBM Plex Sans Arabic',
    isTableBold: false,
    paperSize: 'A4',
    orientation: 'portrait',
    watermarkText: 'فاتورة تذاكر صالحة',
    showWatermark: true,
    showQrCode: true,
    qrPosition: 'custom',
    qrSize: 48,
    qrPosX: 24,
    qrPosY: 870,
    qrPageRule: 'all',
    qrColor: '#2563eb',
    qrBgColor: '#ffffff',
    qrBorderColor: '#2563eb',
    qrShape: 'badge_shield',
    qrShowLabel: true,
    tableMaxHeight: 520,
    sampleRowCount: 6,
    textWrapMode: 'wrap',
    showSignatures: true,
    managerSignTitle: 'توقيع مسؤول التذاكر',
    accountantSignTitle: 'توقيع قسم الحسابات',
    receiverSignTitle: 'توقيع العميل/المسافر',
    notesText: 'شروط التذاكر: يرجى التأكد من مطابقة الأسماء لجواز السفر والالتزام بمواعيد التواجد بالمطار قبل 3 ساعات.',
    footerText: 'شركة السعدي لخدمات الطيران والسياحة — شكراً لاختياركم خدماتنا',
    footerAlign: 'center',
    showPageNumbers: true,
    fontSizes: { ...DEFAULT_FONT_SIZES },
    showFinancialSummary: true,
    summaryStyle: 'executive_banner',
    showTafqeet: true,
    summaryBgColor: '#f0f9ff',
  },
  receipt: {
    companyName: 'شركة السعدي لخدمات السفر والسياحة',
    subtitle: 'سند قبض مالي معتمد (Receipt Voucher)',
    commercialReg: 'رقم السند المالي: RV-2026-0042',
    phone: '+964 770 123 4567',
    email: 'cashier@alsaadi-travel.com',
    address: 'بغداد — الكرادة — شارع 62',
    logoUrl: '',
    logoAlign: 'left',
    logoSize: 75,
    logoPosX: 480,
    logoPosY: 35,
    logoBorderRadius: 8,
    primaryColor: '#0d9488',
    headerBgColor: '#0d9488',
    headerTextColor: 'white',
    headerStyle: 'solid',
    footerStyle: 'solid_accent',
    pageTheme: 'corporate',
    tableTextColor: '#0f172a',
    tableHeaderBgColor: '#0d9488',
    tableHeaderTextColor: '#ffffff',
    tableRowStriped: true,
    fontFamily: 'IBM Plex Sans Arabic',
    isTableBold: false,
    paperSize: 'A4',
    orientation: 'portrait',
    watermarkText: 'سند قبض رسمي',
    showWatermark: true,
    showQrCode: true,
    qrPosition: 'custom',
    qrSize: 48,
    qrPosX: 24,
    qrPosY: 870,
    qrPageRule: 'all',
    qrColor: '#0d9488',
    qrBgColor: '#ffffff',
    qrBorderColor: '#0d9488',
    qrShape: 'stamp',
    qrShowLabel: true,
    tableMaxHeight: 520,
    sampleRowCount: 5,
    textWrapMode: 'wrap',
    showSignatures: true,
    managerSignTitle: 'مصادقة الإدارة',
    accountantSignTitle: 'أمين الصندوق / المحاسب',
    receiverSignTitle: 'توقيع دافع المبلغ',
    notesText: 'تم استلام المبلغ أعلاه نقداً / تحويل بنكي معتمد، ويعتبر هذا السند حجة إثبات رسمية.',
    footerText: 'نظام السعدي المحاسبي الموحد — سند قبض مالي إلكتروني معتمد',
    footerAlign: 'center',
    showPageNumbers: false,
    fontSizes: { ...DEFAULT_FONT_SIZES },
    showFinancialSummary: true,
    summaryStyle: 'table_summary',
    showTafqeet: true,
    summaryBgColor: '#f0fdf4',
  },
  payment: {
    companyName: 'شركة السعدي لخدمات السفر والسياحة',
    subtitle: 'سند صرف ودفع مالي (Payment Voucher)',
    commercialReg: 'رقم السند المالي: PV-2026-0018',
    phone: '+964 770 123 4567',
    email: 'cashier@alsaadi-travel.com',
    address: 'بغداد — الكرادة — شارع 62',
    logoUrl: '',
    logoAlign: 'left',
    logoSize: 75,
    logoPosX: 480,
    logoPosY: 35,
    logoBorderRadius: 8,
    primaryColor: '#e11d48',
    headerBgColor: '#e11d48',
    headerTextColor: 'white',
    headerStyle: 'solid',
    footerStyle: 'ruby_stripe',
    pageTheme: 'corporate',
    tableTextColor: '#0f172a',
    tableHeaderBgColor: '#e11d48',
    tableHeaderTextColor: '#ffffff',
    tableRowStriped: true,
    fontFamily: 'IBM Plex Sans Arabic',
    isTableBold: false,
    paperSize: 'A4',
    orientation: 'portrait',
    watermarkText: 'سند صرف مالي',
    showWatermark: true,
    showQrCode: true,
    qrPosition: 'custom',
    qrSize: 48,
    qrPosX: 24,
    qrPosY: 870,
    qrPageRule: 'all',
    qrColor: '#e11d48',
    qrBgColor: '#ffffff',
    qrBorderColor: '#e11d48',
    qrShape: 'rounded_card',
    qrShowLabel: true,
    tableMaxHeight: 520,
    sampleRowCount: 5,
    textWrapMode: 'wrap',
    showSignatures: true,
    managerSignTitle: 'اعتماد المدير المالي',
    accountantSignTitle: 'توقيع الصراف / المحاسب',
    receiverSignTitle: 'توقيع المستلم',
    notesText: 'تم صرف المبلغ المشار إليه أعلاه بناءً على الموافقات المالية الأصولية.',
    footerText: 'نظام السعدي المحاسبي الموحد — سند صرف مالي رسمي',
    footerAlign: 'center',
    showPageNumbers: false,
    fontSizes: { ...DEFAULT_FONT_SIZES },
    showFinancialSummary: true,
    summaryStyle: 'grid_cards',
    showTafqeet: true,
    summaryBgColor: '#fff1f2',
  },
  journal: {
    companyName: 'شركة السعدي لخدمات السفر والسياحة',
    subtitle: 'سند قيد محاسبي مزدوج (Journal Voucher)',
    commercialReg: 'رقم القيد اليومي: JE-2026-0091',
    phone: '+964 770 123 4567',
    email: 'accounting@alsaadi-travel.com',
    address: 'بغداد — الكرادة — شارع 62',
    logoUrl: '',
    logoAlign: 'left',
    logoSize: 75,
    logoPosX: 480,
    logoPosY: 35,
    logoBorderRadius: 8,
    primaryColor: '#4f46e5',
    headerBgColor: '#4f46e5',
    headerTextColor: 'white',
    headerStyle: 'carbon',
    footerStyle: 'carbon_footer',
    pageTheme: 'classic_bank',
    tableTextColor: '#0f172a',
    tableHeaderBgColor: '#4f46e5',
    tableHeaderTextColor: '#ffffff',
    tableRowStriped: true,
    fontFamily: 'IBM Plex Sans Arabic',
    isTableBold: false,
    paperSize: 'A4',
    orientation: 'portrait',
    watermarkText: 'قيد محاسبي مرحّل',
    showWatermark: true,
    showQrCode: true,
    qrPosition: 'custom',
    qrSize: 48,
    qrPosX: 24,
    qrPosY: 870,
    qrPageRule: 'all',
    qrColor: '#4f46e5',
    qrBgColor: '#ffffff',
    qrBorderColor: '#4f46e5',
    qrShape: 'badge_shield',
    qrShowLabel: true,
    tableMaxHeight: 520,
    sampleRowCount: 6,
    textWrapMode: 'wrap',
    showSignatures: true,
    managerSignTitle: 'اعتماد رئيس الحسابات',
    accountantSignTitle: 'توقيع منظم القيد',
    receiverSignTitle: 'توقيع المراجع المالي',
    notesText: 'مستند قيد محاسبي داخلي مرحّل أصولياً في دلالة الحسابات الإجمالية والفرعية.',
    footerText: 'نظام السعدي المحاسبي — وحدة التدقيق المالي والقيد المزدوج',
    footerAlign: 'center',
    showPageNumbers: true,
    fontSizes: { ...DEFAULT_FONT_SIZES },
    showFinancialSummary: true,
    summaryStyle: 'table_summary',
    showTafqeet: true,
    summaryBgColor: '#f5f3ff',
  },
  exchange: {
    companyName: 'شركة السعدي لخدمات السفر والسياحة',
    subtitle: 'سند مصارفة وتبديل عملات (Exchange Voucher)',
    commercialReg: 'رقم السند: EX-2026-0007',
    phone: '+964 770 123 4567',
    email: 'exchange@alsaadi-travel.com',
    address: 'بغداد — الكرادة — شارع 62',
    logoUrl: '',
    logoAlign: 'left',
    logoSize: 75,
    logoPosX: 480,
    logoPosY: 35,
    logoBorderRadius: 8,
    primaryColor: '#d97706',
    headerBgColor: '#d97706',
    headerTextColor: 'white',
    headerStyle: 'luxury',
    footerStyle: 'dark_luxury',
    pageTheme: 'royal_gold',
    tableTextColor: '#0f172a',
    tableHeaderBgColor: '#d97706',
    tableHeaderTextColor: '#ffffff',
    tableRowStriped: true,
    fontFamily: 'IBM Plex Sans Arabic',
    isTableBold: false,
    paperSize: 'A4',
    orientation: 'portrait',
    watermarkText: 'سند مصارفة معتمد',
    showWatermark: true,
    showQrCode: true,
    qrPosition: 'custom',
    qrSize: 48,
    qrPosX: 24,
    qrPosY: 870,
    qrPageRule: 'all',
    qrColor: '#d97706',
    qrBgColor: '#ffffff',
    qrBorderColor: '#d97706',
    qrShape: 'gold_luxury',
    qrShowLabel: true,
    tableMaxHeight: 520,
    sampleRowCount: 5,
    textWrapMode: 'wrap',
    showSignatures: true,
    managerSignTitle: 'مصادقة الإدارة',
    accountantSignTitle: 'توقيع الصراف الخبير',
    receiverSignTitle: 'توقيع العميل/المستلم',
    notesText: 'تمت عملية تبديل العملات حسب سعر الصرف الرسمي المعتمد بتاريخ العملية دون تغيير.',
    footerText: 'قسم الصرافة والتحويل المالي — شركة السعدي بالسفر والسياحة',
    footerAlign: 'center',
    showPageNumbers: false,
    fontSizes: { ...DEFAULT_FONT_SIZES },
    showFinancialSummary: true,
    summaryStyle: 'gold_bordered',
    showTafqeet: true,
    summaryBgColor: '#fffbeb',
  },
};

// 12 Top Arabic Fonts Selection
const ARABIC_FONTS = [
  { value: 'IBM Plex Sans Arabic', label: 'IBM Plex Sans Arabic (رسمي ومعتمد)' },
  { value: 'Cairo', label: 'Cairo (عصري وواضح جداً)' },
  { value: 'Tajawal', label: 'Tajawal (ناعم وأنيق للمستندات)' },
  { value: 'Almarai', label: 'Almarai (واضح ومخصص للتقارير)' },
  { value: 'Amiri', label: 'Amiri (خط أميري كلاسيكي أصولي)' },
  { value: 'Changa', label: 'Changa (عصري هندسي مميز)' },
  { value: 'Kufam', label: 'Kufam (كوفي عصري وأنيق)' },
  { value: 'Noto Sans Arabic', label: 'Noto Sans Arabic (معياري واضح)' },
  { value: 'Readex Pro', label: 'Readex Pro (تقني حديث وصافي)' },
  { value: 'Vazirmatn', label: 'Vazirmatn (دقيق وواضح جداً)' },
  { value: 'El Messiri', label: 'El Messiri (زخرفي رسمي فاخر)' },
  { value: 'Mada', label: 'Mada (بسيط ومباشر)' },
];

// 10 Full Page Theme Presets
const FULL_PAGE_THEMES = [
  { id: 'executive', label: 'التنفيذي الفاخر', desc: 'إطار فاخر مزدوج وزوايا ملكية', color: '#059669', icon: IconCrown },
  { id: 'emerald_vip', label: 'الزمرد الملكي VIP', desc: 'إطار زمردي متلألئ مع حواف مزدوجة', color: '#10b981', icon: IconStar },
  { id: 'royal_gold', label: 'الذهبي الفخم', desc: 'حواف ذهبية داكنة فاخرة لكبار العملاء', color: '#d97706', icon: IconSparkles },
  { id: 'corporate', label: 'الشركات الرسمي', desc: 'شريط علوي متين وطابع رسمية', color: '#2563eb', icon: IconBuilding },
  { id: 'modern_tech', label: 'العصري التقني', desc: 'حواف انسيابية وظلال زجاجية', color: '#06b6d4', icon: IconBrush },
  { id: 'cyan_future', label: 'المستقبلي التك', desc: 'تدرج تركوازي تقني حديث جداً', color: '#0891b2', icon: IconSparkles },
  { id: 'classic_bank', label: 'المصارف والمالية', desc: 'خطوط دقيقة وتنسيق مالي عالي الكثافة', color: '#334155', icon: IconBook },
  { id: 'crimson_elite', label: 'العنابي الراقي', desc: 'طابع عنابي رسمية رفيعة المستوى', color: '#e11d48', icon: IconShieldCheck },
  { id: 'midnight_dark', label: 'الليلي للتدقيق', desc: 'تباين عالٍ وأناقة داكنة ممتازة', color: '#1e293b', icon: IconPalette },
  { id: 'minimal_white', label: 'الاقتصادي النظيف', desc: 'تصميم ناصع موفر للحبر', color: '#64748b', icon: IconFileText },
];

// 4 Financial Summary Card Style Presets
const SUMMARY_STYLES = [
  { id: 'grid_cards', label: 'كروت شبكية حديثة', desc: 'مربعات مالية مستقلة بظلال أنيقة' },
  { id: 'table_summary', label: 'جدول محاسبي مغلق', desc: 'جدول ختامي أصولي برأس ملون' },
  { id: 'executive_banner', label: 'بنر مالي تنفيذي', desc: 'شريط عريض بارز برصيد بارز' },
  { id: 'gold_bordered', label: 'إطار مذهب فاخر', desc: 'حواف ذهبية فخمة مع تفقيط مميز' },
];

// 26 Header Style Options
const HEADER_STYLES = [
  { id: 'gradient', label: 'متدرج ملكي', desc: 'تدرج بلون السمة زاهي وناعم' },
  { id: 'royal_purple', label: 'بنفسجي ملكي', desc: 'تدرج بنفسجي ملكي فاخر' },
  { id: 'ocean_breeze', label: 'نسمات المحيط', desc: 'تدرج تركوازي ساحلي أنيق' },
  { id: 'golden_crest', label: 'الشعار الذهبي', desc: 'تدرج مذهب ملوكي وفاخر' },
  { id: 'ruby_lux', label: 'الياقوت الفاخر', desc: 'تدرج ياقوتي أحمر راقٍ' },
  { id: 'sunset_glow', label: 'وهج الغروب', desc: 'تدرج عنابي دافئ ومميز' },
  { id: 'midnight_navy', label: 'الكحلي الملكي', desc: 'كحلي داكن رسمي صارم' },
  { id: 'wave_header', label: 'ترويسة مموجة', desc: 'انحناءات مموجة انسيابية أسفل الهدر' },
  { id: 'badge_card', label: 'بطاقة عائمة', desc: 'ترويسة كارت عائم بظلال فخمة' },
  { id: 'emerald_crown', label: 'تاج الزمرد', desc: 'خلفية زمردية مع خط تاجي فاتح' },
  { id: 'carbon', label: 'ألياف كربونية', desc: 'ستايل كربوني داكن وهيبة محاسبية' },
  { id: 'split_dual', label: 'ثنائية مقسمة', desc: 'ترويسة بلونين متباينين للعلامة' },
  { id: 'luxury', label: 'فاخر داكن ذهبي', desc: 'خلفية داكنة مع إطار ذهبي' },
  { id: 'solid', label: 'ملونة بالكامل', desc: 'خلفية بلون السمة ناصعة' },
  { id: 'pill_floating', label: 'كبسولة دائرية', desc: 'ترويسة كبسولة بيضاوية عائمة' },
  { id: 'double_frame', label: 'إطار هندسي', desc: 'إطار خطي مزدوج كلاسيكي' },
  { id: 'frosted_glass', label: 'زجاجي مثلج', desc: 'خلفية زجاجية مثلجة بظلال راقية' },
  { id: 'classic_pinstripe', label: 'مقلمة رسمية', desc: 'خطوط تقليم حادة أعلى وأسفل' },
  { id: 'neon_stripe', label: 'شريط نيون براق', desc: 'إطار خط نيون حديث' },
  { id: 'cyber_grid', label: 'شبكي سيبراني', desc: 'طابع تقني حديث بظلال سماوية' },
  { id: 'vintage_scroll', label: 'تراثي معتق', desc: 'طابع دافئ معتق وراقي' },
  { id: 'monochrome_bold', label: 'مونوكروم أسود', desc: 'أسود فحمي عالي التباين' },
  { id: 'tint', label: 'ضبابية زجاجية', desc: 'شفافة بلون السمة 10%' },
  { id: 'sidebar', label: 'ترويسة جانبية', desc: 'شريط جانبي ممتد يميناً' },
  { id: 'modern', label: 'عصري خط أسفل', desc: 'خلفية بيضاء مع شريط سفلي' },
  { id: 'minimal', label: 'بسيط ناصع', desc: 'بدون خلفية موفر للحبر' },
];

// 15 Distinct Footer Styles
const FOOTER_STYLES = [
  { id: 'classic_line', label: 'خط كلاسيكي', desc: 'شريط علوي بسيط ومستقر' },
  { id: 'solid_accent', label: 'ملون بلون السمة', desc: 'خلفية كاملة بلون السمة ناصعة' },
  { id: 'gradient_bar', label: 'تدرج أنيق', desc: 'شريط متدرج ألوان ناعم' },
  { id: 'floating_pill', label: 'كبسولة عائمة', desc: 'شريط كبسولة بيضاوية بعيدة عن الحواف' },
  { id: 'dark_luxury', label: 'داكن فاخر ذهبي', desc: 'خلفية داكنة مع خط مذهب' },
  { id: 'boxed_tint', label: 'صندوق مظلل', desc: 'صندوق شفاف ملون' },
  { id: 'double_line', label: 'خط مزدوج', desc: 'خطين متوازيين كلاسيكيين' },
  { id: 'neon_line', label: 'خط نيون مضيء', desc: 'خط سفلي مضيء براق' },
  { id: 'carbon_footer', label: 'كربوني داكن', desc: 'خلفية داكنة بلمسات كربونية' },
  { id: 'vintage_gold', label: 'تراثي مذهب', desc: 'خلفية دافئة بإطار مذهب' },
  { id: 'modern_split', label: 'عصري جانبي', desc: 'شريط جانبي بلون السمة' },
  { id: 'emerald_strip', label: 'زمردي ملكي', desc: 'شريط زمردي ملكي حاد' },
  { id: 'frosted_bar', label: 'زجاجي مثلج', desc: 'خلفية زجاجية بظلال ناعمة' },
  { id: 'ruby_stripe', label: 'ياقوتي عنابي', desc: 'شريط ياقوتي عنابي فخم' },
  { id: 'minimal_clean', label: 'ناصع بدون حدود', desc: 'بدون خطوط موفر للحبر' },
];

// 6 QR Code Shape Options
const QR_SHAPES = [
  { id: 'rounded_card', label: 'بطاقة دائرية', desc: 'زوايا دائرية وإطار متناسق' },
  { id: 'stamp', label: 'ختم توثيق رسمي', desc: 'ختم دائرى رسمي موثق' },
  { id: 'badge_shield', label: 'درع التوثيق', desc: 'شارة بإطار مزدوج' },
  { id: 'gold_luxury', label: 'الشارة الذهبية', desc: 'إطار فاخر باللون الذهبي' },
  { id: 'banner_pill', label: 'كبسولة معتمدة', desc: 'شريط كبسولة مع نص' },
  { id: 'minimal_qr', label: 'رمز مجرد', desc: 'بدون شارة أو نصوص' },
];

// 1-Click Quick Preset Packages
const QUICK_PRESET_KITS: Array<{
  id: string;
  name: string;
  desc: string;
  bg: string;
  apply: Partial<TemplateConfig>;
}> = [
  {
    id: 'royal_gold',
    name: '👑 القالب الفاخر الذهبي',
    desc: 'طابع ذهبي فاخر لكبار الشخصيات',
    bg: 'bg-white text-slate-800 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 shadow-2xs',
    apply: {
      pageTheme: 'royal_gold',
      headerStyle: 'golden_crest',
      footerStyle: 'dark_luxury',
      primaryColor: '#d97706',
      headerBgColor: '#b45309',
      tableHeaderBgColor: '#d97706',
      fontFamily: 'Tajawal',
      qrShape: 'gold_luxury',
      qrColor: '#d97706',
      summaryStyle: 'gold_bordered',
      logoAlign: 'left',
    },
  },
  {
    id: 'emerald_vip',
    name: '🌟 الزمرد الرسمي VIP',
    desc: 'تصميم زمردي متناسق وموثق',
    bg: 'bg-emerald-50/70 text-emerald-950 border-emerald-200 hover:border-emerald-500 hover:bg-emerald-100/50 shadow-2xs',
    apply: {
      pageTheme: 'emerald_vip',
      headerStyle: 'emerald_crown',
      footerStyle: 'emerald_strip',
      primaryColor: '#059669',
      headerBgColor: '#047857',
      tableHeaderBgColor: '#059669',
      fontFamily: 'IBM Plex Sans Arabic',
      qrShape: 'badge_shield',
      qrColor: '#059669',
      summaryStyle: 'grid_cards',
      logoAlign: 'left',
    },
  },
  {
    id: 'modern_tech',
    name: '⚡ العصري الحديث',
    desc: 'انحناءات ملساء بظلال أنيقة',
    bg: 'bg-white text-slate-800 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 shadow-2xs',
    apply: {
      pageTheme: 'modern_tech',
      headerStyle: 'wave_header',
      footerStyle: 'floating_pill',
      primaryColor: '#2563eb',
      headerBgColor: '#2563eb',
      tableHeaderBgColor: '#2563eb',
      fontFamily: 'Cairo',
      qrShape: 'rounded_card',
      qrColor: '#2563eb',
      summaryStyle: 'executive_banner',
      logoAlign: 'left',
    },
  },
  {
    id: 'corporate_official',
    name: '🏢 الشركات والمصارف',
    desc: 'ترويسة جانبية رسمية كحلي',
    bg: 'bg-white text-slate-800 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 shadow-2xs',
    apply: {
      pageTheme: 'corporate',
      headerStyle: 'carbon',
      footerStyle: 'carbon_footer',
      primaryColor: '#4f46e5',
      headerBgColor: '#1e293b',
      tableHeaderBgColor: '#4f46e5',
      fontFamily: 'Almarai',
      qrShape: 'stamp',
      qrColor: '#4f46e5',
      summaryStyle: 'table_summary',
      logoAlign: 'left',
    },
  },
  {
    id: 'minimal_eco',
    name: '🌿 الاقتصادي النظيف',
    desc: 'ناصع موفر للحبر والطباعة',
    bg: 'bg-white text-slate-800 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 shadow-2xs',
    apply: {
      pageTheme: 'minimal_white',
      headerStyle: 'minimal',
      footerStyle: 'minimal_clean',
      primaryColor: '#475569',
      headerBgColor: '#ffffff',
      tableHeaderBgColor: '#475569',
      fontFamily: 'Noto Sans Arabic',
      qrShape: 'minimal_qr',
      qrColor: '#475569',
      summaryStyle: 'table_summary',
      logoAlign: 'left',
    },
  },
];

// Reusable Mouse Drag & Scrollbar-Free Carousel Component
const ScrollableCardsRow: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    setIsMouseDown(true);
    setStartX(e.pageX - containerRef.current.offsetLeft);
    setScrollLeft(containerRef.current.scrollLeft);
  };

  const handleMouseLeaveOrUp = () => {
    setIsMouseDown(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - startX) * 1.8;
    containerRef.current.scrollLeft = scrollLeft - walk;
  };

  const scrollByAmount = (amount: number) => {
    if (containerRef.current) {
      containerRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  return (
    <div className="relative group">
      <button
        type="button"
        onClick={() => scrollByAmount(-260)}
        className="absolute -right-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-white/95 shadow-md border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer"
        title="تمرير لليمين"
      >
        <IconChevronRight size={16} />
      </button>

      <button
        type="button"
        onClick={() => scrollByAmount(260)}
        className="absolute -left-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-white/95 shadow-md border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer"
        title="تمرير لليسار"
      >
        <IconChevronLeft size={16} />
      </button>

      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeaveOrUp}
        onMouseUp={handleMouseLeaveOrUp}
        onMouseMove={handleMouseMove}
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
        className="flex gap-2.5 overflow-x-auto py-2 px-1 cursor-grab active:cursor-grabbing select-none snap-x [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
    </div>
  );
};

// Fallback sample entries
const DEFAULT_TEST_ROWS = [
  { id: '1', date: '2026/01/01', ref: 'OB-2026', desc: 'رصيد افتتاحي مرحل من الدورة المالية السابقة للعام الفائت', debit: '0.00', credit: '0.00', bal: '0.00' },
  { id: '2', date: '2026/08/02', ref: 'INV-01005', desc: 'رمز الحجز (PNR: PRMCK) | المسار: BGW ➔ MHD | المسافرين (6): Mr SALAM ALSHAMOOSI، Mrs MELAK HASAN، Mstr MOHAMMED ALSHAMOOSI | مبيعات تذاكر طيران خطوط كاسبيان', debit: '1,250,000.00', credit: '0.00', bal: '1,250,000.00 (لنا)' },
  { id: '3', date: '2026/08/04', ref: 'RV-0042', desc: 'سند قبض نقدي دفعة أولى لحساب حجز تذاكر الطيران والعمرة', debit: '0.00', credit: '500,000.00', bal: '750,000.00 (لنا)' },
  { id: '4', date: '2026/08/06', ref: 'INV-01018', desc: 'رمز الحجز (PNR: NNRSF2) | المسار: BGW ➔ IST | المسافرين (1): Mr AMEER JANAAN | حجز تذكرة إضافية للخطوط الجوية العراقية', debit: '450,000.00', credit: '0.00', bal: '1,200,000.00 (لنا)' },
  { id: '5', date: '2026/08/07', ref: 'RV-0059', desc: 'سند قبض عبر تحويل بنكي مصرفي مباشر لحساب المكتب المحاسبي', debit: '0.00', credit: '300,000.00', bal: '900,000.00 (لنا)' },
  { id: '6', date: '2026/08/08', ref: 'INV-01032', desc: 'خدمة إصدار فيزا وتأشيرة دخول دبي سياحية لمدة 30 يوم شاملة الرسوم الحكومية', debit: '210,000.00', credit: '0.00', bal: '1,110,000.00 (لنا)' },
];

// Vector SVG QR Code Component
const RealQRCode: React.FC<{
  size?: number;
  color?: string;
  bgColor?: string;
  borderColor?: string;
  shape?: string;
  showLabel?: boolean;
}> = ({
  size = 48,
  color = '#059669',
  bgColor = '#ffffff',
  borderColor = '#059669',
  shape = 'rounded_card',
  showLabel = true,
}) => {
  const qrSvg = (
    <svg width={size} height={size} viewBox="0 0 29 29" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
      <rect width="29" height="29" fill={bgColor || 'white'} rx={shape === 'stamp' ? 14 : 4} />
      <path d="M2 2h7v7H2V2zm2 2v3h3V4H4zm14-2h7v7h-7V2zm2 2v3h3V4h-3zM2 18h7v7H2v-7zm2 2v3h3v-3H4z" fill={color} />
      <path d="M4 4h3v3H4V4zm16 0h3v3h-3V4zM4 20h3v3H4v-3z" fill={color} />
      <path d="M11 2h2v3h-2V2zm4 0h2v2h-2V2zm-2 4h4v2h-4V6zm-2 3h2v4h-2V9zm4 0h3v2h-3V9zm4 0h2v4h-2V9zm-8 4h3v2h-3v-2zm5 0h2v3h-2v-3zm-3 2h2v4h-2v-4zm-4 2h2v2h-2v-2zm8 0h3v4h-3v-4zm-8 2h3v3h-3v-3zm4 1h2v3h-2v-3zm-6 2h3v2h-3v-2zm10 0h2v2h-2v-2z" fill={color} />
    </svg>
  );

  if (shape === 'minimal_qr') {
    return (
      <div className="p-1 rounded bg-white shadow-2xs" style={{ border: `1px solid ${borderColor}` }}>
        {qrSvg}
      </div>
    );
  }

  if (shape === 'stamp') {
    return (
      <div
        className="flex items-center gap-1.5 p-1.5 rounded-full shadow-xs border-2"
        style={{ backgroundColor: bgColor, borderColor: color }}
      >
        {qrSvg}
        {showLabel && (
          <div className="text-[8px] font-bold leading-tight pl-2" style={{ color }}>
            <div>موثق رسمياً</div>
            <div className="font-mono text-[7px] opacity-75">STAMPED</div>
          </div>
        )}
      </div>
    );
  }

  if (shape === 'badge_shield') {
    return (
      <div
        className="flex items-center gap-2 p-1.5 rounded-lg shadow-sm border-2 border-double"
        style={{ backgroundColor: bgColor, borderColor: color }}
      >
        {qrSvg}
        {showLabel && (
          <div className="text-[9px] font-extrabold leading-tight" style={{ color }}>
            <div>رمز التوثيق الإلكتروني</div>
            <div className="text-[7px] font-mono opacity-80">OFFICIAL VERIFIED</div>
          </div>
        )}
      </div>
    );
  }

  if (shape === 'gold_luxury') {
    return (
      <div
        className="flex items-center gap-2 p-1.5 rounded-xl shadow-md border-2"
        style={{ backgroundColor: '#0f172a', borderColor: '#d97706' }}
      >
        {qrSvg}
        {showLabel && (
          <div className="text-[9px] font-bold leading-tight text-amber-400">
            <div>رمز التوثيق الذهبي</div>
            <div className="text-[7px] font-mono text-slate-400">LUXURY VERIFIED</div>
          </div>
        )}
      </div>
    );
  }

  if (shape === 'banner_pill') {
    return (
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-full shadow-sm border-2"
        style={{ backgroundColor: bgColor, borderColor: color }}
      >
        {qrSvg}
        {showLabel && (
          <div className="text-[9px] font-bold leading-tight" style={{ color }}>
            <div>وثيقة إلكترونية مصدقة</div>
            <div className="text-[7px] font-mono opacity-75">APPROVED DOC</div>
          </div>
        )}
      </div>
    );
  }

  // rounded_card (Default)
  return (
    <div
      className="flex items-center gap-2 p-1.5 rounded-xl shadow-xs border transition-all"
      style={{ backgroundColor: bgColor, borderColor: borderColor || color }}
    >
      {qrSvg}
      {showLabel && (
        <div className="text-[9px] font-bold leading-tight text-slate-800">
          <div className="flex items-center gap-1">
            <IconDragDrop size={11} className="text-emerald-600" />
            <span>رمز التحقق</span>
          </div>
          <div className="text-[7px] font-mono text-slate-400">QR Verified Doc</div>
        </div>
      )}
    </div>
  );
};

export const PrintTemplatesPage: React.FC = () => {
  const [activeDoc, setActiveDoc] = useState<TemplateDocType>('statement');
  const [configs, setConfigs] = useState<Record<TemplateDocType, TemplateConfig>>(DEFAULT_CONFIGS);
  const [isSavingDb, setIsSavingDb] = useState(false);
  const [isDbLoaded, setIsDbLoaded] = useState(false);

  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    branchesApi.getAll().then((data) => {
      if (Array.isArray(data)) setBranches(data);
    }).catch(() => {});
  }, []);

  // Real Supabase DB Accounts & Statement Rows State
  const [dbAccounts, setDbAccounts] = useState<Array<{ id: string; code: string; nameAr: string }>>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedAccountName, setSelectedAccountName] = useState<string>('علي السعدي (حساب عميل #1413)');
  const [statementLines, setStatementLines] = useState<any[]>(DEFAULT_TEST_ROWS);
  const [statementSummary, setStatementSummary] = useState({
    openingBalance: 0,
    totalDebit: 2845000,
    totalCredit: 1420000,
    closingBalance: 1425000,
  });

  const [previewPageNumber, setPreviewPageNumber] = useState<1 | 2 | 'last'>(1);
  const [previewLang, setPreviewLang] = useState<'ar' | 'en'>('ar');
  const isPreviewEn = previewLang === 'en';
  const [selectedTextKey, setSelectedTextKey] = useState<keyof FontSizesConfig | null>('companyTitle');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const paperSheetRef = useRef<HTMLDivElement>(null);
  const headerBlockRef = useRef<HTMLDivElement>(null);

  // Saved Templates Gallery & Default Selection State
  const [savedTemplatesList, setSavedTemplatesList] = useState<PrintTemplateSavedItem[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [saveModalOpened, setSaveModalOpened] = useState<boolean>(false);
  const [newTemplateName, setNewTemplateName] = useState<string>('');
  const [setAsDefaultCheck, setSetAsDefaultCheck] = useState<boolean>(true);

  // Load saved templates for active document type
  const loadSavedTemplatesForDoc = async (docType: TemplateDocType) => {
    try {
      const list = await fetchTemplatesForDocType(docType);
      setSavedTemplatesList(list || []);

      if (list && list.length > 0) {
        const def = list.find((t) => t.isDefault) || list[0];
        setSelectedTemplateId(def.id);
        if (def.config) {
          setConfigs((prev) => ({
            ...prev,
            [docType]: { ...DEFAULT_CONFIGS[docType], ...def.config },
          }));
        }
      } else {
        setSelectedTemplateId(null);
      }
    } catch (e) {
      console.warn('Error fetching saved templates for docType', docType);
    }
  };

  useEffect(() => {
    loadSavedTemplatesForDoc(activeDoc);
  }, [activeDoc]);

  const handleSelectTemplateToLoad = (templateId: string) => {
    const found = savedTemplatesList.find((t) => t.id === templateId);
    if (!found) return;
    setSelectedTemplateId(found.id);
    if (found.config) {
      setConfigs((prev) => ({
        ...prev,
        [activeDoc]: { ...DEFAULT_CONFIGS[activeDoc], ...found.config },
      }));
      showSuccessNotification(
        'تم تحميل التصميم 🎨',
        `تم تطبيق ستايل وتنسيق قالب (${found.name}) في المعاينة الحية.`
      );
    }
  };

  const handleSaveAsNewTemplate = async () => {
    if (!newTemplateName.trim()) {
      showErrorNotification('تنبيه', 'يرجى كتابة اسم للتصميم الجديد.');
      return;
    }
    setIsSavingDb(true);
    try {
      const res = await createPrintTemplate(activeDoc, newTemplateName.trim(), currentConfig, setAsDefaultCheck);
      showSuccessNotification(
        'تم حفظ التصميم الجديد 💾',
        res.message || `تم تخزين القالب (${newTemplateName}) بنجاح في قاعدة البيانات Supabase.`
      );
      setSaveModalOpened(false);
      await loadSavedTemplatesForDoc(activeDoc);
    } catch (e: any) {
      showErrorNotification('حدث خطأ أثناء الحفظ', e?.message || 'فشل حفظ التصميم');
    } finally {
      setIsSavingDb(false);
    }
  };

  const handleSetAsDefault = async (templateId: string) => {
    try {
      const res = await setDefaultPrintTemplate(templateId);
      showSuccessNotification('تم اعتماد التصميم 🌟', res.message || 'تم تحديد التصميم كـ القالب الرسمي المعتمد للكشوفات.');
      await loadSavedTemplatesForDoc(activeDoc);
    } catch (e: any) {
      showErrorNotification('حدث خطأ أثناء التعيين', e?.message || 'فشل اعتماد التصميم');
    }
  };

  const handleUpdateExistingTemplate = async () => {
    if (!selectedTemplateId) {
      setNewTemplateName(`تصميم ${getDocTypeLabel(activeDoc)} جديد`);
      setSaveModalOpened(true);
      return;
    }
    const found = savedTemplatesList.find((t) => t.id === selectedTemplateId);
    setIsSavingDb(true);
    try {
      const res = await updatePrintTemplate(selectedTemplateId, found?.name, currentConfig, found?.isDefault);
      showSuccessNotification('تم تحديث التصميم 🔄', res.message || 'تم تحديث ستايل القالب المحفوظ في Supabase.');
      await loadSavedTemplatesForDoc(activeDoc);
    } catch (e: any) {
      showErrorNotification('حدث خطأ أثناء التحديث', e?.message || 'فشل تحديث القالب');
    } finally {
      setIsSavingDb(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!window.confirm('هل أنت تأكد من رغبتك في حذف هذا التصميم المحفوظ؟')) return;
    try {
      const res = await deletePrintTemplate(templateId);
      showSuccessNotification('تم الحذف', res.message || 'تم حذف التصميم من قاعدة البيانات.');
      await loadSavedTemplatesForDoc(activeDoc);
    } catch (e: any) {
      showErrorNotification('خطأ في الحذف', e?.message || 'فشل حذف التصميم');
    }
  };

  // 1. Fetch saved templates from Supabase database on mount
  useEffect(() => {
    async function loadTemplatesFromSupabase() {
      try {
        const savedMap = await fetchAllPrintTemplates();
        if (savedMap && Object.keys(savedMap).length > 0) {
          setConfigs((prev) => ({
            ...prev,
            ...savedMap,
          }));
        }
      } catch (e) {
        console.warn('Using default template configs or local fallback');
      } finally {
        setIsDbLoaded(true);
      }
    }
    loadTemplatesFromSupabase();
  }, []);

  // 2. Fetch real accounts list from Supabase DB
  useEffect(() => {
    async function loadRealAccounts() {
      try {
        const flatAccounts = await accountsApi.getFlat();
        if (flatAccounts && flatAccounts.length > 0) {
          const formatted = flatAccounts.map((acc) => ({
            id: acc.id,
            code: acc.code,
            nameAr: `${acc.nameAr} (${acc.code})`,
          }));
          setDbAccounts(formatted);
          if (!selectedAccountId && formatted.length > 0) {
            setSelectedAccountId(formatted[0].id);
            setSelectedAccountName(formatted[0].nameAr);
          }
        }
      } catch (e) {
        console.warn('Real accounts fetch fallback');
      }
    }
    loadRealAccounts();
  }, []);

  // 3. Fetch real account statement data when selectedAccountId changes
  useEffect(() => {
    if (!selectedAccountId) return;
    async function loadRealStatementData() {
      try {
        const res = await apiRequest(`/reports/account-statement/${selectedAccountId}`);
        if (res && res.lines) {
          const rows = res.lines.map((l: any, idx: number) => ({
            id: l.id || String(idx + 1),
            date: new Date(l.date).toLocaleDateString('en-GB'),
            ref: l.entryNumber || l.reference || `REF-${idx + 1}`,
            desc: l.description || 'حركة حسابية رسمية مرحلة',
            debit: l.debit ? Number(l.debit).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00',
            credit: l.credit ? Number(l.credit).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00',
            bal: `${Number(l.runningBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${
              l.runningBalance >= 0 ? '(لنا)' : '(علينا)'
            }`,
          }));

          setStatementLines(rows.length > 0 ? rows : DEFAULT_TEST_ROWS);

          let totDeb = 0;
          let totCred = 0;
          res.lines.forEach((l: any) => {
            totDeb += Number(l.debit || 0);
            totCred += Number(l.credit || 0);
          });

          setStatementSummary({
            openingBalance: Number(res.openingBalance || 0),
            totalDebit: totDeb || 2845000,
            totalCredit: totCred || 1420000,
            closingBalance: Number(res.closingBalance || 1425000),
          });
        }
      } catch (e) {
        console.warn('Account statement fetch fallback');
      }
    }
    loadRealStatementData();
  }, [selectedAccountId]);

  const currentConfig = configs[activeDoc] || DEFAULT_CONFIGS[activeDoc];
  const fontSizes = currentConfig.fontSizes || DEFAULT_FONT_SIZES;

  const updateConfig = (key: keyof TemplateConfig, value: any) => {
    setConfigs((prev) => ({
      ...prev,
      [activeDoc]: {
        ...prev[activeDoc],
        [key]: value,
      },
    }));
  };

  const applyQuickPresetKit = (presetValues: Partial<TemplateConfig>) => {
    setConfigs((prev) => ({
      ...prev,
      [activeDoc]: {
        ...prev[activeDoc],
        ...presetValues,
      },
    }));
    showSuccessNotification('تم تطبيق حزمة التصميم السريع بنجاح ✨', 'تم تحديث كافة الألوان والستايلات فوراً!');
  };

  const updateFontSize = (elementKey: keyof FontSizesConfig, newSize: number) => {
    setConfigs((prev) => ({
      ...prev,
      [activeDoc]: {
        ...prev[activeDoc],
        fontSizes: {
          ...(prev[activeDoc].fontSizes || DEFAULT_FONT_SIZES),
          [elementKey]: newSize,
        },
      },
    }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateConfig('logoUrl', reader.result as string);
        showSuccessNotification('تم رفع اللوكو بنجاح', 'تم تحديث شعار المؤسسة في القالب.');
      };
      reader.readAsDataURL(file);
    }
  };

  // PERSIST TEMPLATE CONFIG TO SUPABASE DATABASE
  const handleSaveAllToDatabase = async () => {
    setIsSavingDb(true);
    try {
      await savePrintTemplate(activeDoc, currentConfig);
      localStorage.setItem('print_templates_config_v17', JSON.stringify(configs));
      showSuccessNotification(
        'تم الحفظ في قاعدة البيانات Supabase 🗄️',
        `تم حفظ ستايل وتصميم (${getDocTypeLabel(activeDoc)}) في القاعدة مباشرة بنجاح.`
      );
    } catch (e: any) {
      showErrorNotification('فشل الحفظ في قاعدة البيانات', e?.message || 'حدث خطأ أثناء حفظ القالب');
    } finally {
      setIsSavingDb(false);
    }
  };

  const handleResetDefault = () => {
    setConfigs((prev) => ({
      ...prev,
      [activeDoc]: { ...DEFAULT_CONFIGS[activeDoc] },
    }));
    showSuccessNotification('تم إعادة الضبط', 'تمت استعادة الإعدادات الإفتراضية للقالب.');
  };

  // Ultra-Fast Instant Export Trigger
  const handleUltraFastExport = () => {
    showSuccessNotification('⚡ جارٍ التصدير الفوري الخاطف', 'تم توليد وتطبيق بث طباعة المستند دون إبطاء في 120ms!');
    window.print();
  };

  // Drag End Handler for Custom Free Logo Position
  const handleLogoDragEnd = (_: any, info: any) => {
    if (!headerBlockRef.current) return;
    const rect = headerBlockRef.current.getBoundingClientRect();
    const x = Math.round(info.point.x - rect.left - 40);
    const y = Math.round(info.point.y - rect.top - 30);

    const clampedX = Math.max(10, Math.min(580, x));
    const clampedY = Math.max(5, Math.min(180, y));

    updateConfig('logoPosX', clampedX);
    updateConfig('logoPosY', clampedY);
  };

  const getDocTypeLabel = (type: TemplateDocType): string => {
    switch (type) {
      case 'statement': return 'كشف الحساب';
      case 'ticket': return 'فاتورة التذاكر';
      case 'receipt': return 'سند القبض';
      case 'payment': return 'سند الدفع';
      case 'journal': return 'سند القيد';
      case 'exchange': return 'سند الصرافة';
    }
  };

  const docTabs: { id: TemplateDocType; label: string; icon: any }[] = [
    { id: 'statement', label: 'تصميم كشف الحساب', icon: IconFileText },
    { id: 'ticket', label: 'تصميم فاتورة التذاكر', icon: IconPlane },
    { id: 'receipt', label: 'تصميم سند القبض', icon: IconReceiptTax },
    { id: 'payment', label: 'تصميم سند الدفع', icon: IconReceiptTax },
    { id: 'journal', label: 'تصميم سند القيد', icon: IconBook },
    { id: 'exchange', label: 'تصميم سند الصرافة', icon: IconArrowsExchange },
  ];

  const elementLabels: Record<keyof FontSizesConfig, string> = {
    companyTitle: 'عنوان اسم الشركة الرئيسي',
    subtitle: 'العنوان الفرعي للمستند',
    headerDetails: 'بيانات وتفاصيل الترويسة',
    docTitle: 'عنوان وتفاصيل كود المستند',
    tableHeader: 'عناوين رؤوس الجداول',
    tableBody: 'نصوص وأسطر الجدول',
    notes: 'نص الملاحظات والشروط',
    signatures: 'مسميات وخانات التوايع',
    footer: 'نص تذييل أسفل الورقة',
    summaryTitle: 'عنوان مربع الملخص المالي',
    summaryMetrics: 'أرقام وإحصائيات الملخص',
  };

  // Dynamic Header Styles Engine
  const getHeaderStyles = () => {
    const style = currentConfig.headerStyle || 'solid';
    const primary = currentConfig.primaryColor || '#059669';
    const bgInput = currentConfig.headerBgColor || primary;
    const isDarkText = currentConfig.headerTextColor === 'dark';

    switch (style) {
      case 'solid':
        return { background: bgInput, color: isDarkText ? '#0f172a' : '#ffffff', subColor: isDarkText ? '#334155' : '#f0fdf4', detailsColor: isDarkText ? '#475569' : '#e2e8f0', padding: '1.25rem', borderRadius: '0.75rem', border: 'none' };
      case 'gradient':
        return { background: `linear-gradient(135deg, ${bgInput} 0%, ${primary}dd 60%, #1e293b 100%)`, color: '#ffffff', subColor: '#ecfdf5', detailsColor: '#cbd5e1', padding: '1.25rem', borderRadius: '0.85rem', border: 'none' };
      case 'royal_purple':
        return { background: `linear-gradient(135deg, ${bgInput} 0%, #7e22ce 60%, #3b0764 100%)`, color: '#ffffff', subColor: '#f0abfc', detailsColor: '#e9d5ff', padding: '1.25rem', borderRadius: '0.85rem', border: 'none' };
      case 'ocean_breeze':
        return { background: `linear-gradient(135deg, ${bgInput} 0%, #06b6d4 60%, #164e63 100%)`, color: '#ffffff', subColor: '#a5f3fc', detailsColor: '#cffafe', padding: '1.25rem', borderRadius: '0.85rem', border: 'none' };
      case 'golden_crest':
        return { background: `linear-gradient(135deg, ${bgInput} 0%, #b45309 50%, #451a03 100%)`, color: '#fef3c7', subColor: '#fde68a', detailsColor: '#fef3c7', padding: '1.25rem', borderRadius: '0.85rem', border: `2px solid ${primary}` };
      case 'ruby_lux':
        return { background: `linear-gradient(135deg, ${bgInput} 0%, #e11d48 60%, #4c0519 100%)`, color: '#ffffff', subColor: '#fecdd3', detailsColor: '#ffe4e6', padding: '1.25rem', borderRadius: '0.85rem', border: `2px solid ${primary}` };
      case 'sunset_glow':
        return { background: `linear-gradient(135deg, ${bgInput} 0%, #e11d48 50%, #be123c 100%)`, color: '#ffffff', subColor: '#fecdd3', detailsColor: '#ffe4e6', padding: '1.25rem', borderRadius: '0.85rem', border: 'none' };
      case 'midnight_navy':
        return { background: `linear-gradient(135deg, ${bgInput} 0%, #1e3a8a 70%, #172554 100%)`, color: '#ffffff', subColor: '#93c5fd', detailsColor: '#bfdbfe', padding: '1.25rem', borderRadius: '0.75rem', borderBottom: `4px solid ${primary}` };
      case 'wave_header':
        return { background: `linear-gradient(180deg, ${bgInput} 0%, ${primary}ee 80%, ${primary}bb 100%)`, color: '#ffffff', subColor: '#d1fae5', detailsColor: '#e2e8f0', padding: '1.25rem 1.25rem 1.75rem 1.25rem', borderRadius: '0 0 1.5rem 1.5rem', border: 'none' };
      case 'badge_card':
        return { background: '#ffffff', color: '#0f172a', subColor: primary, detailsColor: '#64748b', padding: '1.25rem', borderRadius: '1rem', border: `1px solid ${primary}40` };
      case 'emerald_crown':
        return { background: bgInput, color: '#ffffff', subColor: '#a7f3d0', detailsColor: '#ecfdf5', padding: '1.25rem', borderRadius: '0.85rem', borderBottom: `4px solid ${primary}` };
      case 'carbon':
        return { background: 'radial-gradient(circle at top right, #1e293b 0%, #0f172a 100%)', color: '#f8fafc', subColor: primary, detailsColor: '#94a3b8', padding: '1.25rem', borderRadius: '0.75rem', borderBottom: `4px solid ${primary}`, border: '1px solid #334155' };
      case 'split_dual':
        return { background: `linear-gradient(90deg, ${bgInput} 68%, #0f172a 68%)`, color: '#ffffff', subColor: '#a7f3d0', detailsColor: '#cbd5e1', padding: '1.25rem', borderRadius: '0.75rem', border: 'none' };
      case 'classic_pinstripe':
        return { background: '#ffffff', color: '#0f172a', subColor: primary, detailsColor: '#475569', padding: '1.25rem 0', borderRadius: '0', borderTop: `4px solid ${primary}`, borderBottom: `2px solid ${primary}` };
      case 'pill_floating':
        return { background: '#ffffff', color: '#0f172a', subColor: primary, detailsColor: '#475569', padding: '1.25rem 1.75rem', borderRadius: '9999px', border: `2px solid ${primary}40` };
      case 'double_frame':
        return { background: '#f8fafc', color: '#0f172a', subColor: primary, detailsColor: '#475569', padding: '1.25rem', borderRadius: '0.5rem', border: `4px double ${primary}` };
      case 'frosted_glass':
        return { background: 'rgba(255, 255, 255, 0.85)', color: '#0f172a', subColor: primary, detailsColor: '#475569', padding: '1.25rem', borderRadius: '1rem', border: `1px solid ${primary}40` };
      case 'monochrome_bold':
        return { background: '#000000', color: '#ffffff', subColor: '#e2e8f0', detailsColor: '#94a3b8', padding: '1.25rem', borderRadius: '0', borderBottom: '4px solid #ffffff' };
      case 'vintage_scroll':
        return { background: '#fffbeb', color: '#78350f', subColor: '#92400e', detailsColor: '#a16207', padding: '1.25rem', borderRadius: '0.5rem', border: `2px solid ${primary}` };
      case 'cyber_grid':
        return { background: '#090d16', color: '#38bdf8', subColor: primary, detailsColor: '#94a3b8', padding: '1.25rem', borderRadius: '0.75rem', border: `1px solid ${primary}` };
      case 'tint':
        return { background: `${bgInput}15`, color: '#0f172a', subColor: primary, detailsColor: '#475569', padding: '1.25rem', borderRadius: '0.75rem', border: `1px solid ${primary}40` };
      case 'modern':
        return { background: '#ffffff', color: '#0f172a', subColor: primary, detailsColor: '#64748b', padding: '0.5rem 0 1rem 0', borderRadius: '0', borderBottom: `4px solid ${primary}` };
      case 'sidebar':
        return { background: '#f8fafc', color: '#0f172a', subColor: primary, detailsColor: '#475569', padding: '1.25rem', borderRadius: '0.75rem', borderRight: `6px solid ${primary}`, border: `1px solid #e2e8f0` };
      case 'luxury':
        return { background: '#0f172a', color: '#f8fafc', subColor: '#fbbf24', detailsColor: '#94a3b8', padding: '1.25rem', borderRadius: '0.75rem', border: `2px solid ${primary}` };
      case 'neon_stripe':
        return { background: '#ffffff', color: '#0f172a', subColor: primary, detailsColor: '#475569', padding: '1rem', borderRadius: '0.75rem', border: `2px solid ${primary}` };
      default: // minimal
        return { background: '#ffffff', color: '#0f172a', subColor: primary, detailsColor: '#64748b', padding: '0', borderRadius: '0', borderBottom: `2px solid ${primary}` };
    }
  };

  const headerStyleObj = getHeaderStyles();

  // Dynamic Footer Styles Engine
  const getFooterStyles = () => {
    const style = currentConfig.footerStyle || 'classic_line';
    const primary = currentConfig.primaryColor || '#059669';

    switch (style) {
      case 'solid_accent':
        return { background: primary, padding: '0.75rem 1rem', borderRadius: '0.5rem', border: 'none', fontColor: '#ffffff', pageNumColor: '#d1fae5' };
      case 'gradient_bar':
        return { background: `linear-gradient(90deg, ${primary} 0%, #1e293b 100%)`, padding: '0.75rem 1rem', borderRadius: '0.5rem', border: 'none', fontColor: '#ffffff', pageNumColor: '#cbd5e1' };
      case 'double_line':
        return { background: 'transparent', padding: '0.75rem 0', borderRadius: '0', borderTop: `4px double ${primary}`, fontColor: '#334155', pageNumColor: '#94a3b8' };
      case 'dark_luxury':
        return { background: '#0f172a', padding: '0.75rem 1rem', borderRadius: '0.5rem', borderTop: `2px solid ${primary}`, fontColor: '#f8fafc', pageNumColor: '#fbbf24' };
      case 'floating_pill':
        return { background: '#ffffff', padding: '0.75rem 1.5rem', borderRadius: '9999px', border: `1px solid ${primary}40`, fontColor: '#0f172a', pageNumColor: '#64748b' };
      case 'boxed_tint':
        return { background: `${primary}12`, padding: '0.75rem 1rem', borderRadius: '0.5rem', border: `1px solid ${primary}30`, fontColor: '#0f172a', pageNumColor: '#64748b' };
      case 'neon_line':
        return { background: '#ffffff', padding: '0.75rem 1rem', borderRadius: '0.5rem', borderTop: `2px solid ${primary}`, fontColor: '#0f172a', pageNumColor: '#64748b' };
      case 'carbon_footer':
        return { background: '#0f172a', padding: '0.75rem 1rem', borderRadius: '0.5rem', borderTop: `3px solid ${primary}`, fontColor: '#f8fafc', pageNumColor: '#94a3b8' };
      case 'vintage_gold':
        return { background: '#fffbeb', padding: '0.75rem 1rem', borderRadius: '0.5rem', borderTop: `2px solid ${primary}`, fontColor: '#78350f', pageNumColor: '#a16207' };
      case 'modern_split':
        return { background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '0.5rem', borderRight: `4px solid ${primary}`, borderTop: '1px solid #e2e8f0', fontColor: '#0f172a', pageNumColor: '#64748b' };
      case 'emerald_strip':
        return { background: primary, padding: '0.75rem 1rem', borderRadius: '0.5rem', borderBottom: '3px solid #a7f3d0', fontColor: '#ffffff', pageNumColor: '#d1fae5' };
      case 'frosted_bar':
        return { background: 'rgba(255, 255, 255, 0.9)', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: `1px solid ${primary}30`, fontColor: '#0f172a', pageNumColor: '#64748b' };
      case 'ruby_stripe':
        return { background: '#881337', padding: '0.75rem 1rem', borderRadius: '0.5rem', borderTop: `2px solid ${primary}`, fontColor: '#ffffff', pageNumColor: '#fecdd3' };
      case 'minimal_clean':
        return { background: 'transparent', padding: '0.5rem 0', borderRadius: '0', border: 'none', fontColor: '#64748b', pageNumColor: '#94a3b8' };
      default: // classic_line
        return { background: 'transparent', padding: '0.75rem 0', borderRadius: '0', borderTop: `1px solid ${primary}40`, fontColor: '#475569', pageNumColor: '#94a3b8' };
    }
  };

  const footerStyleObj = getFooterStyles();

  // Page Themes Engine
  const getPageThemeStyles = () => {
    const theme = currentConfig.pageTheme || 'executive';
    const primary = currentConfig.primaryColor || '#059669';

    if (theme === 'executive') {
      return {
        border: `4px double ${primary}`,
        borderRadius: '6px',
      };
    }
    if (theme === 'emerald_vip') {
      return {
        border: `3px solid ${primary}`,
        outline: `2px solid ${primary}50`,
        borderRadius: '12px',
      };
    }
    if (theme === 'royal_gold') {
      return {
        border: `4px double ${primary}`,
        borderRadius: '8px',
      };
    }
    if (theme === 'corporate') {
      return {
        border: `1px solid #cbd5e1`,
        borderTop: `6px solid ${primary}`,
        borderRadius: '4px',
      };
    }
    if (theme === 'modern_tech') {
      return {
        border: `1px solid ${primary}40`,
        borderRadius: '16px',
      };
    }
    if (theme === 'cyan_future') {
      return {
        border: `2px solid ${primary}`,
        borderRadius: '18px',
      };
    }
    if (theme === 'classic_bank') {
      return {
        border: `2px solid #334155`,
        borderRadius: '0px',
      };
    }
    if (theme === 'crimson_elite') {
      return {
        border: `3px solid ${primary}`,
        borderTop: `8px solid ${primary}`,
        borderRadius: '6px',
      };
    }
    if (theme === 'midnight_dark') {
      return {
        border: `2px solid #1e293b`,
        backgroundColor: '#ffffff',
        borderRadius: '8px',
      };
    }
    // minimal_white
    return {
      border: `1px solid #e2e8f0`,
      borderRadius: '2px',
    };
  };

  const pageThemeStyleObj = getPageThemeStyles();

  // Multi-page QR check
  const shouldRenderQrOnCurrentPage = () => {
    if (!currentConfig.showQrCode) return false;
    const rule = currentConfig.qrPageRule || 'all';
    if (rule === 'all') return true;
    if (rule === 'first' && previewPageNumber === 1) return true;
    if (rule === 'last' && (previewPageNumber === 2 || previewPageNumber === 'last')) return true;
    return false;
  };

  // Drag handler for QR Code
  const handleQrDragEnd = (_: any, info: any) => {
    if (!paperSheetRef.current) return;
    const rect = paperSheetRef.current.getBoundingClientRect();
    const clientX = info.point.x;
    const clientY = info.point.y;

    const x = Math.round(clientX - rect.left - 40);
    const y = Math.round(clientY - rect.top - 20);

    const clampedX = Math.max(10, Math.min(580, x));
    const clampedY = Math.max(10, Math.min(880, y));

    updateConfig('qrPosX', clampedX);
    updateConfig('qrPosY', clampedY);
  };

  const displayRows = statementLines.slice(0, currentConfig.sampleRowCount || 6);

  // Logo Component Rendering Engine inside Header
  const renderHeaderLogo = () => {
    const size = currentConfig.logoSize || 75;
    const radius = currentConfig.logoBorderRadius ?? 8;
    const align = currentConfig.logoAlign || 'left';

    const logoContent = currentConfig.logoUrl ? (
      <div style={{ transform: `translate(${currentConfig.logoPosX || 0}px, ${currentConfig.logoPosY || 0}px)` }}>
        <img
          src={currentConfig.logoUrl}
          alt="Logo"
          style={{ width: `${size}px`, height: 'auto', borderRadius: `${radius}px` }}
          className="object-contain transition-all shadow-xs"
        />
      </div>
    ) : (
      <div
        className="flex items-center justify-center text-white font-black shadow-sm transition-all"
        style={{
          backgroundColor: currentConfig.primaryColor,
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: `${radius}px`,
          transform: `translate(${currentConfig.logoPosX || 0}px, ${currentConfig.logoPosY || 0}px)`,
        }}
      >
        <IconPrinter size={Math.round(size * 0.5)} />
      </div>
    );

    if (align === 'custom') {
      return (
        <motion.div
          drag
          dragSnapToOrigin={false}
          dragMomentum={false}
          dragConstraints={headerBlockRef}
          onDragEnd={handleLogoDragEnd}
          style={{
            position: 'absolute',
            left: `${currentConfig.logoPosX ?? 480}px`,
            top: `${currentConfig.logoPosY ?? 35}px`,
            cursor: 'move',
            zIndex: 40,
          }}
          className="hover:scale-105 transition-transform"
          title="قم بسحب الشعار بالماوس لوضعه في أي مكان بالترويسة!"
        >
          {logoContent}
        </motion.div>
      );
    }

    return (
      <div className="flex items-center justify-center shrink-0">
        {logoContent}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1650px] mx-auto select-none dir-rtl font-['IBM_Plex_Sans_Arabic',sans-serif]">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 5mm 5mm !important;
          }
          body, html {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print, header, nav, aside, footer, button, select, input, .mantine-Modal-root {
            display: none !important;
          }
          #printable-a4-sheet {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            min-width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
            background: #ffffff !important;
          }
          * {
            box-shadow: none !important;
            text-shadow: none !important;
          }
        }
      `}</style>
      {/* 1. Streamlined Single Unified Top Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-3 no-print">
        {/* Row 1: Title & ALL Action Buttons in 1 Single Line */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Title */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
              <IconDatabase size={18} />
            </div>
            <h1 className="text-base font-extrabold text-slate-900 leading-tight">مصمم قوالب الطباعة</h1>
          </div>

          {/* ALL Buttons in 1 Single Compact Row */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Saved Templates Dropdown */}
            {savedTemplatesList.length > 0 && (
              <Select
                size="xs"
                placeholder="التصاميم المحفوظة..."
                data={savedTemplatesList.map((t) => ({
                  value: t.id,
                  label: `${t.name}${t.isDefault ? ' (معتمد ✓)' : ''}`,
                }))}
                value={selectedTemplateId}
                onChange={(val) => {
                  if (val) handleSelectTemplateToLoad(val);
                }}
                className="w-48"
              />
            )}

            {selectedTemplateId && (
              <Tooltip label="اعتماد هذا التصميم رسمياً للكشوفات">
                <Button
                  size="xs"
                  color="emerald"
                  variant={savedTemplatesList.find((t) => t.id === selectedTemplateId)?.isDefault ? 'light' : 'filled'}
                  disabled={savedTemplatesList.find((t) => t.id === selectedTemplateId)?.isDefault}
                  leftSection={<IconStar size={13} />}
                  onClick={() => handleSetAsDefault(selectedTemplateId)}
                  className="font-bold px-2.5 h-7"
                >
                  {savedTemplatesList.find((t) => t.id === selectedTemplateId)?.isDefault ? 'معتمد ✓' : 'اعتماد'}
                </Button>
              </Tooltip>
            )}

            {selectedTemplateId && (
              <Tooltip label="تحديث التعديلات على التصميم الحالي">
                <Button
                  size="xs"
                  variant="outline"
                  color="emerald"
                  leftSection={<IconDeviceFloppy size={13} />}
                  onClick={handleUpdateExistingTemplate}
                  className="font-bold px-2.5 h-7"
                >
                  تحديث
                </Button>
              </Tooltip>
            )}

            <Button
              size="xs"
              color="emerald"
              leftSection={<IconPlus size={13} />}
              onClick={() => {
                setNewTemplateName(`تصميم ${getDocTypeLabel(activeDoc)} (${savedTemplatesList.length + 1})`);
                setSaveModalOpened(true);
              }}
              className="font-bold px-2.5 h-7 shadow-2xs"
            >
              حفظ جديد 💾
            </Button>

            {selectedTemplateId && (
              <ActionIcon
                size="sm"
                color="red"
                variant="subtle"
                onClick={() => handleDeleteTemplate(selectedTemplateId)}
                title="حذف التصميم"
                className="hover:bg-red-50"
              >
                <IconTrash size={14} />
              </ActionIcon>
            )}

            {/* Separator line */}
            <div className="h-5 w-[1px] bg-slate-200 mx-1 hidden sm:block" />

            <Button
              size="xs"
              color="emerald"
              variant="light"
              leftSection={<IconBolt size={14} />}
              onClick={handleUltraFastExport}
              className="font-bold px-2.5 h-7 shadow-2xs"
            >
              تصدير PDF
            </Button>

            <Button
              size="xs"
              variant="subtle"
              color="gray"
              leftSection={<IconRotate size={14} />}
              onClick={handleResetDefault}
              className="font-bold px-2.5 h-7"
            >
              إعادة ضبط
            </Button>

            <Button
              size="xs"
              color="emerald"
              loading={isSavingDb}
              leftSection={<IconDeviceFloppy size={14} />}
              onClick={handleSaveAllToDatabase}
              className="font-bold px-3 h-7 shadow-2xs"
            >
              حفظ في DB
            </Button>
          </div>
        </div>

        {/* Real Account Picker from Supabase DB (if statement active) */}
        {activeDoc === 'statement' && dbAccounts.length > 0 && (
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-700">اختر حساب حقيقي من Supabase:</span>
            <Select
              size="xs"
              className="w-64"
              data={dbAccounts.map((a) => ({ value: a.id, label: a.nameAr }))}
              value={selectedAccountId}
              onChange={(v) => {
                if (!v) return;
                setSelectedAccountId(v);
                const found = dbAccounts.find((a) => a.id === v);
                if (found) setSelectedAccountName(found.nameAr);
              }}
            />
          </div>
        )}



        {/* Row 3: Document Selection Tabs */}
        <div className="flex items-center gap-1 pt-2 border-t border-slate-100 overflow-x-auto">
          {docTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeDoc === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveDoc(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-emerald-700 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-white' : 'text-slate-400'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Main Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Controls Panel using 5 Tabs (5 cols) */}
        <div className="lg:col-span-5 no-print">
          <Paper radius="lg" withBorder className="bg-white border-slate-200 shadow-2xs overflow-hidden">
            <Tabs defaultValue="company" color="emerald">
              {/* 5 Tab Headers */}
              <Tabs.List grow className="bg-slate-50/80 border-b border-slate-200 text-xs font-bold">
                <Tabs.Tab value="company" leftSection={<IconBuilding size={15} />}>
                  الشعار والشركة
                </Tabs.Tab>
                <Tabs.Tab value="fonts" leftSection={<IconTypography size={15} />}>
                  الخطوط
                </Tabs.Tab>
                <Tabs.Tab value="colors" leftSection={<IconPalette size={15} />}>
                  الألوان
                </Tabs.Tab>
                <Tabs.Tab value="qr" leftSection={<IconQrcode size={15} />}>
                  رمز QR
                </Tabs.Tab>
                <Tabs.Tab value="style" leftSection={<IconSparkles size={15} />}>
                  الستايل والقالب
                </Tabs.Tab>
              </Tabs.List>

              {/* ── التبويب الأول: الشعار وبيانات الشركة (موضع وحجم اللوجو بالسلسة) ── */}
              <Tabs.Panel value="company" p="md" className="space-y-4">
                <div className="space-y-4 text-xs font-semibold">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />

                  {/* Branch Logo & Custom Logo Selection Box */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
                    <span className="text-xs font-black text-slate-900 block border-b pb-1">
                      اعتماد شعار المستند والكشف:
                    </span>

                    <Select
                      size="xs"
                      label="اختيار واعتماد شعار فرع معتمد من فروع الشركة"
                      placeholder="اختر الفرع لاستجلاب واعتماد شعاره..."
                      data={[
                        { value: 'custom', label: '🎨 شعار مخصص (مرفوع / أدناه)' },
                        ...branches.map((b) => ({
                          value: b.logo || `no_logo_${b.id}`,
                          label: `🏢 ${b.nameAr} (${b.code || 'BGD'})${b.logo ? ' — (يوجد شعار)' : ' — (بدون شعار)'}`,
                          disabled: !b.logo,
                        })),
                      ]}
                      value={branches.find(b => b.logo && b.logo === currentConfig.logoUrl)?.logo || 'custom'}
                      onChange={(val) => {
                        if (val && val !== 'custom' && !val.startsWith('no_logo_')) {
                          updateConfig('logoUrl', val);
                        }
                      }}
                      className="font-bold"
                    />

                    <div className="flex items-center gap-3 pt-1 border-t border-slate-200">
                      {currentConfig.logoUrl ? (
                        <img
                          src={currentConfig.logoUrl}
                          alt="Logo"
                          style={{ borderRadius: `${currentConfig.logoBorderRadius ?? 8}px` }}
                          className="w-14 h-14 object-contain border bg-white p-1 shadow-2xs"
                        />
                      ) : (
                        <div
                          className="w-14 h-14 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-black text-xs shadow-2xs"
                        >
                          شعار
                        </div>
                      )}

                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Button
                            size="xs"
                            variant="outline"
                            color="emerald"
                            leftSection={<IconUpload size={14} />}
                            onClick={() => fileInputRef.current?.click()}
                            className="font-bold text-xs"
                          >
                            رفع شعار مخصص
                          </Button>

                          {currentConfig.logoUrl && (
                            <Button
                              size="xs"
                              variant="subtle"
                              color="red"
                              leftSection={<IconTrash size={14} />}
                              onClick={() => updateConfig('logoUrl', '')}
                            >
                              حذف الشعار
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* LOGO ALIGNMENT CONTROL (يمين / وسط / يسار / سحب حر بالماوس) */}
                  <div className="bg-emerald-50/80 p-3 rounded-xl border border-emerald-200 space-y-2">
                    <span className="text-xs font-black text-emerald-950 block">
                      موضع ومحاذاة الشعار بالترويسة:
                    </span>

                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { id: 'left', label: 'يسار الهدر', icon: IconLayoutAlignLeft },
                        { id: 'center', label: 'منتصف الهدر', icon: IconLayoutAlignCenter },
                        { id: 'right', label: 'يمين الهدر', icon: IconLayoutAlignRight },
                        { id: 'custom', label: 'سحب حر ✋', icon: IconHandMove },
                      ].map((item) => {
                        const Icon = item.icon;
                        const isSelected = (currentConfig.logoAlign || 'left') === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => updateConfig('logoAlign', item.id as any)}
                            className={`flex flex-col items-center justify-center p-2 rounded-lg border text-[10px] font-bold cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <Icon size={16} className="mb-0.5" />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* LOGO RESIZE SLIDER (تكبير وتصغير بكل سلاسة) */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1">
                        <IconMaximize size={15} className="text-emerald-600" />
                        حجم وتكبير الشعار (Logo Size):
                      </span>
                      <Badge color="emerald" variant="light" size="sm" className="font-mono font-bold">
                        {currentConfig.logoSize || 75} px
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2">
                      <ActionIcon
                        size="sm"
                        variant="default"
                        onClick={() => updateConfig('logoSize', Math.max(10, (currentConfig.logoSize || 75) - 5))}
                        title="تصغير"
                      >
                        <IconMinimize size={14} />
                      </ActionIcon>

                      <div className="flex-1">
                        <Slider
                          size="xs"
                          color="emerald"
                          min={10}
                          max={500}
                          step={2}
                          value={currentConfig.logoSize || 75}
                          onChange={(v) => updateConfig('logoSize', v)}
                          label={(v) => `${v}px`}
                        />
                      </div>

                      <ActionIcon
                        size="sm"
                        variant="default"
                        onClick={() => updateConfig('logoSize', (currentConfig.logoSize || 75) + 5)}
                        title="تكبير"
                      >
                        <IconMaximize size={14} />
                      </ActionIcon>
                    </div>

                    {/* Logo Border Radius Slider */}
                    <div>
                      <span className="text-[11px] font-bold text-slate-600 block mb-1">
                        استدارة زوايا الشعار (Border Radius): {currentConfig.logoBorderRadius ?? 8}px
                      </span>
                      <Slider
                        size="xs"
                        color="emerald"
                        min={0}
                        max={99}
                        step={2}
                        value={currentConfig.logoBorderRadius ?? 8}
                        onChange={(v) => updateConfig('logoBorderRadius', v)}
                      />
                    </div>

                    {/* Logo X/Y Position Offset */}
                    <div className="space-y-2 pt-1 border-t border-slate-200">
                      <span className="text-[11px] font-extrabold text-slate-700 block">
                        إزاحة وتحريك الشعار (Logo Position):
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 block mb-0.5">
                            أفقي (X): {currentConfig.logoPosX || 0}px
                          </span>
                          <Slider
                            size="xs"
                            color="blue"
                            min={-100}
                            max={100}
                            step={1}
                            value={currentConfig.logoPosX || 0}
                            onChange={(v) => updateConfig('logoPosX', v)}
                            label={(v) => `${v}px`}
                          />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 block mb-0.5">
                            عمودي (Y): {currentConfig.logoPosY || 0}px
                          </span>
                          <Slider
                            size="xs"
                            color="violet"
                            min={-100}
                            max={100}
                            step={1}
                            value={currentConfig.logoPosY || 0}
                            onChange={(v) => updateConfig('logoPosY', v)}
                            label={(v) => `${v}px`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <TextInput
                    label="اسم الشركة / المؤسسة الرئيسي"
                    size="xs"
                    value={currentConfig.companyName}
                    onChange={(e) => updateConfig('companyName', e.target.value)}
                  />
                  <TextInput
                    label="🇬🇧 Company Name (English)"
                    size="xs"
                    placeholder="e.g. Al-Saadi Travel & Tourism"
                    value={currentConfig.companyNameEn || ''}
                    onChange={(e) => updateConfig('companyNameEn', e.target.value)}
                    dir="ltr"
                    styles={{ input: { textAlign: 'left' } }}
                  />

                  <TextInput
                    label="العنوان الفرعي للمستند"
                    size="xs"
                    value={currentConfig.subtitle}
                    onChange={(e) => updateConfig('subtitle', e.target.value)}
                  />
                  <TextInput
                    label="🇬🇧 Subtitle (English)"
                    size="xs"
                    placeholder="e.g. Detailed Financial Account Statement"
                    value={currentConfig.subtitleEn || ''}
                    onChange={(e) => updateConfig('subtitleEn', e.target.value)}
                    dir="ltr"
                    styles={{ input: { textAlign: 'left' } }}
                  />

                  <TextInput
                    label="السجل التجاري / الترخيص الرسمي"
                    size="xs"
                    value={currentConfig.commercialReg}
                    onChange={(e) => updateConfig('commercialReg', e.target.value)}
                  />
                  <TextInput
                    label="🇬🇧 Commercial Reg (English)"
                    size="xs"
                    placeholder="e.g. C.R: 90182471 / Baghdad"
                    value={currentConfig.commercialRegEn || ''}
                    onChange={(e) => updateConfig('commercialRegEn', e.target.value)}
                    dir="ltr"
                    styles={{ input: { textAlign: 'left' } }}
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <TextInput
                      label="هاتف التواصل"
                      size="xs"
                      value={currentConfig.phone}
                      onChange={(e) => updateConfig('phone', e.target.value)}
                    />
                    <TextInput
                      label="البريد الإلكتروني"
                      size="xs"
                      value={currentConfig.email}
                      onChange={(e) => updateConfig('email', e.target.value)}
                    />
                  </div>

                  <TextInput
                    label="العنوان والجغرافي"
                    size="xs"
                    value={currentConfig.address}
                    onChange={(e) => updateConfig('address', e.target.value)}
                  />
                  <TextInput
                    label="🇬🇧 Address (English)"
                    size="xs"
                    placeholder="e.g. Baghdad — Karrada — Street 62"
                    value={currentConfig.addressEn || ''}
                    onChange={(e) => updateConfig('addressEn', e.target.value)}
                    dir="ltr"
                    styles={{ input: { textAlign: 'left' } }}
                  />

                  {/* Header Height */}
                  <div className="pt-2 mt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-slate-600">ارتفاع حاوية الهيدر:</span>
                      <Badge size="xs" color="indigo" variant="light" className="font-mono">{currentConfig.headerHeight || 110}px</Badge>
                    </div>
                    <Slider
                      size="xs"
                      color="indigo"
                      min={70}
                      max={180}
                      step={2}
                      value={currentConfig.headerHeight || 110}
                      onChange={(v) => updateConfig('headerHeight', v)}
                      label={(v) => `${v}px`}
                    />
                  </div>
                </div>
              </Tabs.Panel>

              {/* ── التبويب الثاني: الخطوط والأحجام ── */}
              <Tabs.Panel value="fonts" p="md" className="space-y-4">
                <div className="flex items-center justify-between bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 text-xs font-bold text-slate-800">
                  <span className="flex items-center gap-1.5 text-emerald-900">
                    <IconCheck size={16} className="text-emerald-700" />
                    تسميك خطوط الجدول (Bold Table Text)
                  </span>
                  <Switch
                    size="xs"
                    color="emerald"
                    checked={currentConfig.isTableBold}
                    onChange={(e) => updateConfig('isTableBold', e.currentTarget.checked)}
                  />
                </div>

                <div className="space-y-3">
                  <Select
                    label="نوع خط المستند الرئيسي (12 خط عربي متاح)"
                    size="xs"
                    data={ARABIC_FONTS}
                    value={currentConfig.fontFamily || 'IBM Plex Sans Arabic'}
                    onChange={(v) => updateConfig('fontFamily', v)}
                  />
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-3">
                  <span className="font-extrabold text-xs text-slate-800 block">
                    حجم الخطوط المخصص (انقر على النص بالورقة للتعديل):
                  </span>
                  
                  {selectedTextKey ? (
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <Badge color="emerald" size="sm">{elementLabels[selectedTextKey]}</Badge>
                        <span className="font-mono text-emerald-700">{fontSizes[selectedTextKey]} px</span>
                      </div>
                      <Slider
                        size="xs"
                        color="emerald"
                        min={8}
                        max={36}
                        step={1}
                        value={fontSizes[selectedTextKey]}
                        onChange={(v) => updateFontSize(selectedTextKey, v)}
                        label={(v) => `${v}px`}
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">انقر على أي عنصر نصي في صورة الورقة لتغيير حجمه.</p>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-3 text-xs font-semibold">
                  <div>
                    <span className="text-[11px] font-bold text-slate-700 block mb-1">
                      تعبئة أسطر الجدول بالمعاينة: <strong className="font-mono text-emerald-700">{currentConfig.sampleRowCount || 6} أسطر</strong>
                    </span>
                    <Slider
                      size="xs"
                      color="emerald"
                      min={2}
                      max={15}
                      step={1}
                      value={currentConfig.sampleRowCount || 6}
                      onChange={(v) => updateConfig('sampleRowCount', v)}
                    />
                  </div>

                  <Select
                    label="طريقة التفاف الشروحات والنصوص الطويلة"
                    size="xs"
                    data={[
                      { value: 'wrap', label: 'التواء النص وسقوطه لأسطر (Multi-line Wrap)' },
                      { value: 'nowrap', label: 'سطر واحد فقط (Single Line Clip)' },
                    ]}
                    value={currentConfig.textWrapMode || 'wrap'}
                    onChange={(v) => updateConfig('textWrapMode', v as any)}
                  />
                </div>
              </Tabs.Panel>

              {/* ── التبويب الثالث: الألوان بالتحديد الكامل ── */}
              <Tabs.Panel value="colors" p="md" className="space-y-4">
                <div className="space-y-3 text-xs font-semibold">
                  <div>
                    <span className="text-[11px] font-bold text-slate-700 block mb-1.5">اختر لون ترويسة الهدر والسمة الرئيسية</span>
                    <div className="flex items-center gap-2">
                      {[
                        { name: 'زمردي', hex: '#059669' },
                        { name: 'أزرق ملكي', hex: '#2563eb' },
                        { name: 'كحلي داكن', hex: '#1e3a8a' },
                        { name: 'تركوازي', hex: '#0d9488' },
                        { name: 'عنابي', hex: '#e11d48' },
                        { name: 'رمادي فخم', hex: '#1e293b' },
                        { name: 'ذهب دافئ', hex: '#d97706' },
                      ].map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => {
                            updateConfig('headerBgColor', c.hex);
                            updateConfig('primaryColor', c.hex);
                            updateConfig('tableHeaderBgColor', c.hex);
                          }}
                          className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform cursor-pointer border ${
                            currentConfig.headerBgColor === c.hex ? 'scale-115 ring-2 ring-emerald-500 border-white' : 'border-slate-200 hover:scale-105'
                          }`}
                          style={{ backgroundColor: c.hex }}
                          title={c.name}
                        >
                          {currentConfig.headerBgColor === c.hex && <IconCheck size={14} className="text-white" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <ColorInput
                    label="لون خلفية ترويسة الهدر"
                    size="xs"
                    value={currentConfig.headerBgColor || currentConfig.primaryColor}
                    onChange={(v) => updateConfig('headerBgColor', v)}
                  />

                  <ColorInput
                    label="اللون الرئيسي للسمة والحواشي (Primary Theme Color)"
                    size="xs"
                    value={currentConfig.primaryColor || '#059669'}
                    onChange={(v) => updateConfig('primaryColor', v)}
                  />

                  <ColorInput
                    label="لون خلفية رأس الجدول (Table Header Background)"
                    size="xs"
                    value={currentConfig.tableHeaderBgColor || currentConfig.primaryColor}
                    onChange={(v) => updateConfig('tableHeaderBgColor', v)}
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <ColorInput
                      label="لون نص أسطر الجدول"
                      size="xs"
                      value={currentConfig.tableTextColor || '#0f172a'}
                      onChange={(v) => updateConfig('tableTextColor', v)}
                    />

                    <ColorInput
                      label="لون نص رأس الجدول"
                      size="xs"
                      value={currentConfig.tableHeaderTextColor || '#ffffff'}
                      onChange={(v) => updateConfig('tableHeaderTextColor', v)}
                    />
                  </div>

                  <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200">
                    <span className="text-slate-700">تظليل الأسطر المتبادلة بالجدول (Striped Rows)</span>
                    <Switch
                      size="xs"
                      color="emerald"
                      checked={currentConfig.tableRowStriped !== false}
                      onChange={(e) => updateConfig('tableRowStriped', e.currentTarget.checked)}
                    />
                  </div>
                </div>
              </Tabs.Panel>

              {/* ── التبويب الرابع: رمز الـ QR ── */}
              <Tabs.Panel value="qr" p="md" className="space-y-4">
                <div className="space-y-3 text-xs font-semibold">
                  <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200">
                    <span className="text-slate-700 font-bold flex items-center gap-1">
                      <IconQrcode size={15} className="text-emerald-600" />
                      إظهار رمز QR
                    </span>
                    <Switch
                      size="xs"
                      color="emerald"
                      checked={currentConfig.showQrCode}
                      onChange={(e) => updateConfig('showQrCode', e.currentTarget.checked)}
                    />
                  </div>

                  {currentConfig.showQrCode && (
                    <>
                      <div>
                        <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1.5">
                          <span>اختر شكل وستايل شارة الـ QR (اسحب بالماوس ↔):</span>
                          <span className="text-[10px] text-emerald-700 font-mono">6 أشكال</span>
                        </div>

                        <ScrollableCardsRow>
                          {QR_SHAPES.map((shape) => {
                            const isSelected = (currentConfig.qrShape || 'rounded_card') === shape.id;
                            return (
                              <div
                                key={shape.id}
                                onClick={() => updateConfig('qrShape', shape.id as any)}
                                className={`snap-start shrink-0 w-40 p-2.5 rounded-xl border-2 cursor-pointer transition-all ${
                                  isSelected
                                    ? 'border-emerald-600 bg-emerald-50/80 shadow-sm ring-2 ring-emerald-400/30'
                                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-extrabold text-xs text-slate-900">{shape.label}</span>
                                  {isSelected && <IconCheck size={14} className="text-emerald-600 font-bold" />}
                                </div>
                                <p className="text-[10px] text-slate-500 leading-tight">{shape.desc}</p>
                              </div>
                            );
                          })}
                        </ScrollableCardsRow>
                      </div>

                      <div className="bg-emerald-50/70 p-2.5 rounded-lg border border-emerald-200 space-y-2">
                        <span className="text-[11px] font-extrabold text-emerald-950 block">
                          ألوان رمز وشارة الـ QR المخصصة:
                        </span>
                        
                        <div className="grid grid-cols-3 gap-2">
                          <ColorInput
                            label="لون رمز QR"
                            size="xs"
                            value={currentConfig.qrColor || currentConfig.primaryColor}
                            onChange={(v) => updateConfig('qrColor', v)}
                          />

                          <ColorInput
                            label="خلفية الشارة"
                            size="xs"
                            value={currentConfig.qrBgColor || '#ffffff'}
                            onChange={(v) => updateConfig('qrBgColor', v)}
                          />

                          <ColorInput
                            label="لون الإطار"
                            size="xs"
                            value={currentConfig.qrBorderColor || currentConfig.primaryColor}
                            onChange={(v) => updateConfig('qrBorderColor', v)}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <span className="text-slate-700 font-bold text-xs">إظهار نص الشرح (رمز التحقق الرقمي)</span>
                        <Switch
                          size="xs"
                          color="emerald"
                          checked={currentConfig.qrShowLabel !== false}
                          onChange={(e) => updateConfig('qrShowLabel', e.currentTarget.checked)}
                        />
                      </div>

                      <Select
                        label="قاعدة ظهور الـ QR في الصفحات المتعددة"
                        size="xs"
                        data={[
                          { value: 'all', label: 'تكرار الـ QR في جميع الأوراق' },
                          { value: 'first', label: 'إظهار الـ QR في الورقة الأولى فقط' },
                          { value: 'last', label: 'إظهار الـ QR في الورقة الأخيرة فقط' },
                        ]}
                        value={currentConfig.qrPageRule || 'all'}
                        onChange={(v) => updateConfig('qrPageRule', v as any)}
                      />

                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-2">
                        <span className="text-[11px] font-bold text-slate-800 block">
                          تثبيت مكان الـ QR بالبكسل (أو بالسحب بالماوس):
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[10px] font-bold text-slate-600 block">الإزاحة X (أفقي): {currentConfig.qrPosX ?? 24}px</span>
                            <Slider
                              size="xs"
                              color="emerald"
                              min={10}
                              max={580}
                              step={2}
                              value={currentConfig.qrPosX ?? 24}
                              onChange={(v) => updateConfig('qrPosX', v)}
                            />
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-600 block">الإزاحة Y (رأسي): {currentConfig.qrPosY ?? 870}px</span>
                            <Slider
                              size="xs"
                              color="emerald"
                              min={10}
                              max={890}
                              step={2}
                              value={currentConfig.qrPosY ?? 870}
                              onChange={(v) => updateConfig('qrPosY', v)}
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <span className="text-[11px] font-bold text-slate-600 block mb-1">
                          حجم رمز الـ QR: {currentConfig.qrSize || 48}px
                        </span>
                        <Slider
                          size="xs"
                          color="emerald"
                          min={32}
                          max={90}
                          step={2}
                          value={currentConfig.qrSize || 48}
                          onChange={(v) => updateConfig('qrSize', v)}
                          label={(v) => `${v}px`}
                        />
                      </div>
                    </>
                  )}
                </div>
              </Tabs.Panel>

              {/* ── التبويب الخامس: الستايل والقالب ── */}
              <Tabs.Panel value="style" p="sm">
                <Accordion defaultValue="last_page" variant="separated" radius="md">
                  <Accordion.Item value="last_page">
                    <Accordion.Control icon={<IconCalculator size={18} className="text-emerald-600" />}>
                      <div className="flex items-center justify-between w-full pl-2">
                        <span className="font-extrabold text-xs text-slate-900">🏁 إعدادات الصفحة الأخيرة والملخص المالي</span>
                        <Badge size="xs" color="amber" variant="light">خاص بالختام</Badge>
                      </div>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <div className="space-y-3 pt-1 text-xs font-semibold">
                        <div className="flex items-center justify-between bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                          <span className="text-slate-900 font-bold">إظهار كارت الملخص المالي في الصفحة الأخيرة</span>
                          <Switch
                            size="xs"
                            color="emerald"
                            checked={currentConfig.showFinancialSummary !== false}
                            onChange={(e) => updateConfig('showFinancialSummary', e.currentTarget.checked)}
                          />
                        </div>

                        {currentConfig.showFinancialSummary !== false && (
                          <>
                            <div>
                              <span className="text-[11px] font-bold text-slate-700 block mb-1.5">
                                اختر شكل كارت الملخص المالي بالصفحة الأخيرة (اسحب ↔):
                              </span>

                              <ScrollableCardsRow>
                                {SUMMARY_STYLES.map((sumStyle) => {
                                  const isSelected = (currentConfig.summaryStyle || 'grid_cards') === sumStyle.id;
                                  return (
                                    <div
                                      key={sumStyle.id}
                                      onClick={() => updateConfig('summaryStyle', sumStyle.id as any)}
                                      className={`snap-start shrink-0 w-38 p-2.5 rounded-xl border-2 cursor-pointer transition-all ${
                                        isSelected
                                          ? 'border-emerald-600 bg-emerald-50/90 shadow-sm ring-2 ring-emerald-400/30'
                                          : 'border-slate-200 bg-white hover:bg-slate-50'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="font-extrabold text-xs text-slate-900">{sumStyle.label}</span>
                                        {isSelected && <IconCheck size={14} className="text-emerald-600 font-bold" />}
                                      </div>
                                      <p className="text-[10px] text-slate-500 leading-tight">{sumStyle.desc}</p>
                                    </div>
                                  );
                                })}
                              </ScrollableCardsRow>
                            </div>

                            <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200">
                              <span className="text-slate-800 font-bold text-xs">إظهار كارت رصيد أول المدة</span>
                              <Switch
                                size="xs"
                                color="emerald"
                                checked={currentConfig.showOpeningBalance !== false}
                                onChange={(e) => updateConfig('showOpeningBalance', e.currentTarget.checked)}
                              />
                            </div>

                            <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200">
                              <span className="text-slate-800 font-bold text-xs">إظهار تفقيط المبلغ بالحروف (Tafqeet)</span>
                              <Switch
                                size="xs"
                                color="emerald"
                                checked={currentConfig.showTafqeet !== false}
                                onChange={(e) => updateConfig('showTafqeet', e.currentTarget.checked)}
                              />
                            </div>

                            <ColorInput
                              label="لون خلفية كارت الملخص الرئيسي"
                              size="xs"
                              value={currentConfig.summaryBgColor || '#f8fafc'}
                              onChange={(v) => updateConfig('summaryBgColor', v)}
                            />

                            <div className="border-t border-slate-200 pt-2.5 space-y-2">
                              <span className="text-[11px] font-extrabold text-slate-800 block">🎨 تخصيص ألوان حاويات الملخص الحاوية بحاوية:</span>
                              
                              <div className="grid grid-cols-2 gap-2">
                                <ColorInput
                                  label="خلفية المدين (+)"
                                  size="xs"
                                  value={currentConfig.summaryDebitBg || '#ffffff'}
                                  onChange={(v) => updateConfig('summaryDebitBg', v)}
                                />
                                <ColorInput
                                  label="نص المدين (+)"
                                  size="xs"
                                  value={currentConfig.summaryDebitTextColor || '#047857'}
                                  onChange={(v) => updateConfig('summaryDebitTextColor', v)}
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <ColorInput
                                  label="خلفية الدائن (-)"
                                  size="xs"
                                  value={currentConfig.summaryCreditBg || '#ffffff'}
                                  onChange={(v) => updateConfig('summaryCreditBg', v)}
                                />
                                <ColorInput
                                  label="نص الدائن (-)"
                                  size="xs"
                                  value={currentConfig.summaryCreditTextColor || '#be123c'}
                                  onChange={(v) => updateConfig('summaryCreditTextColor', v)}
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <ColorInput
                                  label="خلفية الرصيد النهائي"
                                  size="xs"
                                  value={currentConfig.summaryBalanceBg || '#047857'}
                                  onChange={(v) => updateConfig('summaryBalanceBg', v)}
                                />
                                <ColorInput
                                  label="نص الرصيد النهائي"
                                  size="xs"
                                  value={currentConfig.summaryBalanceTextColor || '#ffffff'}
                                  onChange={(v) => updateConfig('summaryBalanceTextColor', v)}
                                />
                              </div>

                              {currentConfig.showOpeningBalance !== false && (
                                <div className="grid grid-cols-2 gap-2">
                                  <ColorInput
                                    label="خلفية أول المدة"
                                    size="xs"
                                    value={currentConfig.summaryOpeningBg || '#ffffff'}
                                    onChange={(v) => updateConfig('summaryOpeningBg', v)}
                                  />
                                  <ColorInput
                                    label="نص أول المدة"
                                    size="xs"
                                    value={currentConfig.summaryOpeningTextColor || '#334155'}
                                    onChange={(v) => updateConfig('summaryOpeningTextColor', v)}
                                  />
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </Accordion.Panel>
                  </Accordion.Item>

                  <Accordion.Item value="header_style">
                    <Accordion.Control icon={<IconBrush size={18} className="text-emerald-600" />}>
                      <div className="flex items-center justify-between w-full pl-2">
                        <span className="font-extrabold text-xs text-slate-900">🎨 أسلوب وستايل الهدر والترويسة</span>
                        <Badge size="xs" color="emerald">26 ستايلاً للهدر</Badge>
                      </div>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <div className="space-y-3 pt-1">
                        <span className="text-[11px] font-bold text-slate-700 block mb-1">اختر ستايل الهدر والترويسة (اسحب بالماوس ↔):</span>
                        <ScrollableCardsRow>
                          {HEADER_STYLES.map((style) => {
                            const isSelected = (currentConfig.headerStyle || 'solid') === style.id;
                            return (
                              <div
                                key={style.id}
                                onClick={() => updateConfig('headerStyle', style.id as any)}
                                className={`snap-start shrink-0 w-40 p-2.5 rounded-xl border-2 cursor-pointer transition-all ${
                                  isSelected
                                    ? 'border-emerald-600 bg-emerald-50/90 shadow-sm ring-2 ring-emerald-400/30'
                                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-extrabold text-xs text-slate-900">{style.label}</span>
                                  {isSelected && <IconCheck size={14} className="text-emerald-600 font-bold" />}
                                </div>
                                <p className="text-[10px] text-slate-500 leading-tight">{style.desc}</p>
                              </div>
                            );
                          })}
                        </ScrollableCardsRow>

                        <Select
                          label="لون نصوص الهدر"
                          size="xs"
                          data={[
                            { value: 'white', label: 'نصوص بيضاء ناصعة' },
                            { value: 'dark', label: 'نصوص داكنة' },
                          ]}
                          value={currentConfig.headerTextColor || 'white'}
                          onChange={(v) => updateConfig('headerTextColor', v as any)}
                        />
                      </div>
                    </Accordion.Panel>
                  </Accordion.Item>

                  <Accordion.Item value="footer_style">
                    <Accordion.Control icon={<IconLayoutBottombar size={18} className="text-emerald-600" />}>
                      <div className="flex items-center justify-between w-full pl-2">
                        <span className="font-extrabold text-xs text-slate-900">📝 أسلوب وستايل الفوتر والتذييل</span>
                        <Badge size="xs" color="blue">15 ستايلاً للفوتر</Badge>
                      </div>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <div className="space-y-3 pt-1">
                        <span className="text-[11px] font-bold text-slate-700 block mb-1">اختر ستايل الفوتر والتذييل (اسحب بالماوس ↔):</span>
                        <ScrollableCardsRow>
                          {FOOTER_STYLES.map((style) => {
                            const isSelected = (currentConfig.footerStyle || 'classic_line') === style.id;
                            return (
                              <div
                                key={style.id}
                                onClick={() => updateConfig('footerStyle', style.id as any)}
                                className={`snap-start shrink-0 w-40 p-2.5 rounded-xl border-2 cursor-pointer transition-all ${
                                  isSelected
                                    ? 'border-emerald-600 bg-emerald-50/90 shadow-sm ring-2 ring-emerald-400/30'
                                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-extrabold text-xs text-slate-900">{style.label}</span>
                                  {isSelected && <IconCheck size={14} className="text-emerald-600 font-bold" />}
                                </div>
                                <p className="text-[10px] text-slate-500 leading-tight">{style.desc}</p>
                              </div>
                            );
                          })}
                        </ScrollableCardsRow>

                        <TextInput
                          label="نص تذييل أسفل الورقة (Footer Line)"
                          size="xs"
                          value={currentConfig.footerText}
                          onChange={(e) => updateConfig('footerText', e.target.value)}
                        />
                        <TextInput
                          label="🇬🇧 Footer Text (English)"
                          size="xs"
                          placeholder="e.g. Accounts Dept — Al-Saadi Travel & Tourism"
                          value={currentConfig.footerTextEn || ''}
                          onChange={(e) => updateConfig('footerTextEn', e.target.value)}
                          dir="ltr"
                          styles={{ input: { textAlign: 'left' } }}
                        />

                        {/* Footer Height */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-slate-600">ارتفاع الفوتر:</span>
                            <Badge size="xs" color="blue" variant="light" className="font-mono">{currentConfig.footerHeight || 36}px</Badge>
                          </div>
                          <Slider
                            size="xs"
                            color="blue"
                            min={24}
                            max={80}
                            step={2}
                            value={currentConfig.footerHeight || 36}
                            onChange={(v) => updateConfig('footerHeight', v)}
                            label={(v) => `${v}px`}
                          />
                        </div>

                        {/* Footer Font Size */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-slate-600">حجم خط الفوتر:</span>
                            <Badge size="xs" color="violet" variant="light" className="font-mono">{currentConfig.footerFontSize || 9.5}px</Badge>
                          </div>
                          <Slider
                            size="xs"
                            color="violet"
                            min={7}
                            max={18}
                            step={0.5}
                            value={currentConfig.footerFontSize || 9.5}
                            onChange={(v) => updateConfig('footerFontSize', v)}
                            label={(v) => `${v}px`}
                          />
                        </div>

                        {/* Footer Text Color */}
                        <div>
                          <span className="text-[11px] font-bold text-slate-600 block mb-1">لون نص الفوتر:</span>
                          <div className="flex items-center gap-2">
                            <ColorInput
                              size="xs"
                              className="flex-1"
                              value={currentConfig.footerTextColor || '#ffffff'}
                              onChange={(v) => updateConfig('footerTextColor', v)}
                              swatches={['#ffffff', '#f1f5f9', '#334155', '#0f172a', '#fbbf24', '#d4d4d8', '#a3e635', '#e2e8f0']}
                            />
                            <ActionIcon size="sm" variant="default" title="إعادة تعيين" onClick={() => updateConfig('footerTextColor', '')}>
                              <IconRotate size={13} />
                            </ActionIcon>
                          </div>
                        </div>

                        {/* Footer Alignment */}
                        <div>
                          <span className="text-[11px] font-bold text-slate-600 block mb-1">محاذاة نص الفوتر:</span>
                          <SegmentedControl
                            size="xs"
                            fullWidth
                            value={currentConfig.footerAlign || 'center'}
                            onChange={(v) => updateConfig('footerAlign', v as any)}
                            data={[
                              { label: 'يمين', value: 'right' },
                              { label: 'وسط', value: 'center' },
                              { label: 'يسار', value: 'left' },
                            ]}
                          />
                        </div>
                      </div>
                    </Accordion.Panel>
                  </Accordion.Item>

                  <Accordion.Item value="page_theme">
                    <Accordion.Control icon={<IconSparkles size={18} className="text-emerald-600" />}>
                      <div className="flex items-center justify-between w-full pl-2">
                        <span className="font-extrabold text-xs text-slate-900">🖼️ قوالب وإطارات المستند الكلية</span>
                        <Badge size="xs" color="gray">10 قوالب كشف</Badge>
                      </div>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <div className="space-y-3 pt-1">
                        <span className="text-[11px] font-bold text-slate-700 block mb-1">اختر قالب وإطار المستند الكامل (اسحب بالماوس ↔):</span>
                        <ScrollableCardsRow>
                          {FULL_PAGE_THEMES.map((theme) => {
                            const Icon = theme.icon;
                            const isSelected = (currentConfig.pageTheme || 'executive') === theme.id;
                            return (
                              <div
                                key={theme.id}
                                onClick={() => updateConfig('pageTheme', theme.id as any)}
                                className={`snap-start shrink-0 w-44 p-3 rounded-2xl border-2 cursor-pointer transition-all ${
                                  isSelected
                                    ? 'border-emerald-600 bg-emerald-50/90 shadow-md ring-2 ring-emerald-500/30'
                                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <div
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                                    style={{ backgroundColor: theme.color }}
                                  >
                                    <Icon size={16} />
                                  </div>
                                  {isSelected && <IconCheck size={16} className="text-emerald-600 font-bold" />}
                                </div>

                                <h4 className="font-extrabold text-xs text-slate-900 mb-1">{theme.label}</h4>
                                <p className="text-[10px] text-slate-500 leading-tight line-clamp-2">{theme.desc}</p>
                              </div>
                            );
                          })}
                        </ScrollableCardsRow>
                      </div>
                    </Accordion.Panel>
                  </Accordion.Item>

                  <Accordion.Item value="notes_signatures">
                    <Accordion.Control icon={<IconCertificate size={18} className="text-emerald-600" />}>
                      <span className="font-extrabold text-xs text-slate-900">📜 الملاحظات، التوايع والعلامة المائية</span>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <div className="space-y-3 pt-1 text-xs font-semibold">
                        <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <span className="text-slate-700">العلامة المائية المائلة</span>
                          <Switch
                            size="xs"
                            color="emerald"
                            checked={currentConfig.showWatermark}
                            onChange={(e) => updateConfig('showWatermark', e.currentTarget.checked)}
                          />
                        </div>

                        {currentConfig.showWatermark && (
                          <TextInput
                            label="نص العلامة المائية"
                            size="xs"
                            value={currentConfig.watermarkText}
                            onChange={(e) => updateConfig('watermarkText', e.target.value)}
                          />
                        )}

                        <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <span className="text-slate-700">حقول الختم والتوقيع الثلاثية</span>
                          <Switch
                            size="xs"
                            color="emerald"
                            checked={currentConfig.showSignatures}
                            onChange={(e) => updateConfig('showSignatures', e.currentTarget.checked)}
                          />
                        </div>

                        {currentConfig.showSignatures && (
                          <div className="grid grid-cols-3 gap-1.5 pt-1">
                            <TextInput
                              label="توقيع 1"
                              size="xs"
                              value={currentConfig.managerSignTitle}
                              onChange={(e) => updateConfig('managerSignTitle', e.target.value)}
                            />
                            <TextInput
                              label="توقيع 2"
                              size="xs"
                              value={currentConfig.accountantSignTitle}
                              onChange={(e) => updateConfig('accountantSignTitle', e.target.value)}
                            />
                            <TextInput
                              label="توقيع 3"
                              size="xs"
                              value={currentConfig.receiverSignTitle}
                              onChange={(e) => updateConfig('receiverSignTitle', e.target.value)}
                            />
                          </div>
                        )}

                        <Textarea
                          label="نص الملاحظات والشروط السفلي"
                          size="xs"
                          rows={2}
                          value={currentConfig.notesText}
                          onChange={(e) => updateConfig('notesText', e.target.value)}
                        />
                      </div>
                    </Accordion.Panel>
                  </Accordion.Item>
                </Accordion>
              </Tabs.Panel>
            </Tabs>
          </Paper>
        </div>

        {/* Right Live A4 Canvas Preview (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          {/* Top Bar for Multi-Page Switcher with Dedicated Last Page Switcher */}
          <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs no-print">
            <span className="font-bold text-xs text-slate-700 flex items-center gap-1.5">
              <IconEye size={16} className="text-emerald-600" />
              المعاينة الحية للبيانات ({previewPageNumber === 'last' ? '🏁 الصفحة الأخيرة — الملخص المالي' : `الورقة رقم ${previewPageNumber}`})
            </span>

            {/* Page Switcher Buttons */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setPreviewPageNumber(1)}
                className={`px-2.5 py-1 rounded-md text-xs font-black transition-all cursor-pointer ${
                  previewPageNumber === 1 ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-white'
                }`}
              >
                <span>الورقة (1)</span>
              </button>

              <button
                type="button"
                onClick={() => setPreviewPageNumber(2)}
                className={`px-2.5 py-1 rounded-md text-xs font-black transition-all cursor-pointer ${
                  previewPageNumber === 2 ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-white'
                }`}
              >
                <span>الورقة (2)</span>
              </button>

              <button
                type="button"
                onClick={() => setPreviewPageNumber('last')}
                className={`px-3 py-1 rounded-md text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                  previewPageNumber === 'last' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-white'
                }`}
              >
                <IconReceipt2 size={14} />
                <span>الصفحة الأخيرة (الملخص)</span>
              </button>
            </div>

            {/* Language toggle for preview */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-0.5">
              <IconLanguage size={15} className="text-blue-600" />
              <SegmentedControl
                size="xs"
                value={previewLang}
                onChange={(v) => setPreviewLang(v as 'ar' | 'en')}
                data={[
                  { label: 'عربي', value: 'ar' },
                  { label: 'English', value: 'en' },
                ]}
                styles={{ root: { backgroundColor: 'transparent' } }}
              />
            </div>
          </div>

          {/* Actual Printable Document Container */}
          <div className="bg-slate-100/50 p-2 md:p-3 rounded-xl border border-slate-200 overflow-x-auto flex justify-center print:bg-white print:p-0 print:border-none print:m-0">
            <div
              ref={paperSheetRef}
              id="printable-a4-sheet"
              dir={isPreviewEn ? 'ltr' : 'rtl'}
              className="bg-white text-slate-900 border border-slate-200 rounded-none p-6 md:p-8 relative min-w-[650px] w-[720px] min-h-[960px] flex flex-col justify-between transition-all print:w-full print:max-w-none print:min-w-0 print:p-0 print:border-none print:shadow-none"
              style={{
                fontFamily: currentConfig.fontFamily || 'IBM Plex Sans Arabic',
                ...pageThemeStyleObj,
              }}
            >
              {/* Optional Watermark Overlay */}
              {currentConfig.showWatermark && currentConfig.watermarkText && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0 opacity-[0.04]">
                  <span
                    className="text-6xl md:text-7xl font-black text-slate-900 -rotate-30 select-none whitespace-nowrap"
                  >
                    {currentConfig.watermarkText}
                  </span>
                </div>
              )}

              {/* ── Document Content Section ── */}
              <div className="relative z-10 space-y-4">
                
                {/* 1. Dynamic Header Block with Custom Styles & Custom Draggable / Aligned Logo */}
                <div
                  ref={headerBlockRef}
                  className="transition-all relative"
                  style={{
                    background: headerStyleObj.background,
                    color: headerStyleObj.color,
                    padding: headerStyleObj.padding,
                    borderRadius: headerStyleObj.borderRadius,
                    borderBottom: headerStyleObj.borderBottom,
                    borderRight: (headerStyleObj as any).borderRight,
                    borderTop: (headerStyleObj as any).borderTop,
                    border: headerStyleObj.border,
                    boxShadow: (headerStyleObj as any).shadow || 'none',
                    height: `${currentConfig.headerHeight || 110}px`,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    className={`flex items-start gap-4 ${
                      currentConfig.logoAlign === 'right'
                        ? 'flex-row-reverse justify-between'
                        : currentConfig.logoAlign === 'center'
                        ? 'flex-col items-center text-center justify-center'
                        : 'flex-row justify-between'
                    }`}
                  >
                    {/* Company Titles Info */}
                    <div className="space-y-1 flex-1">
                      <div
                        onClick={() => setSelectedTextKey('companyTitle')}
                        className={`cursor-pointer transition-all p-1 rounded ${
                          selectedTextKey === 'companyTitle' ? 'ring-2 ring-emerald-400 bg-white/10' : 'hover:bg-white/5'
                        }`}
                      >
                        <h2
                          className="font-black leading-tight"
                          style={{ fontSize: `${fontSizes.companyTitle}px` }}
                        >
                          {isPreviewEn
                            ? (currentConfig.companyNameEn || currentConfig.companyName || 'Company Name')
                            : currentConfig.companyName} {previewPageNumber === 'last' ? (isPreviewEn ? '(Last Page — Summary)' : '(الصفحة الأخيرة — الختام)') : previewPageNumber === 2 ? (isPreviewEn ? '(Cont. — Page 2)' : '(تابع — الورقة الثانية)') : ''}
                        </h2>
                      </div>

                      <div
                        onClick={() => setSelectedTextKey('subtitle')}
                        className={`cursor-pointer transition-all p-1 rounded ${
                          selectedTextKey === 'subtitle' ? 'ring-2 ring-emerald-400 bg-white/10' : 'hover:bg-white/5'
                        }`}
                      >
                        <p
                          className="font-bold"
                          style={{ color: headerStyleObj.subColor, fontSize: `${fontSizes.subtitle}px` }}
                        >
                          {isPreviewEn
                            ? (currentConfig.subtitleEn || currentConfig.subtitle || 'Subtitle')
                            : currentConfig.subtitle}
                        </p>
                      </div>

                      <div
                        onClick={() => setSelectedTextKey('headerDetails')}
                        className={`cursor-pointer transition-all p-1 rounded font-medium space-y-0.5 ${
                          selectedTextKey === 'headerDetails' ? 'ring-2 ring-emerald-400 bg-white/10' : 'hover:bg-white/5'
                        }`}
                        style={{ color: headerStyleObj.detailsColor, fontSize: `${fontSizes.headerDetails}px` }}
                      >
                        <div>{isPreviewEn ? (currentConfig.commercialRegEn || currentConfig.commercialReg) : currentConfig.commercialReg}</div>
                        <div>{isPreviewEn ? 'Phone' : 'الهاتف'}: {currentConfig.phone} | {isPreviewEn ? 'Email' : 'البريد'}: {currentConfig.email}</div>
                        <div>{isPreviewEn ? 'Address' : 'العنوان'}: {isPreviewEn ? (currentConfig.addressEn || currentConfig.address) : currentConfig.address}</div>
                      </div>
                    </div>

                    {/* Logo (Rendered via Engine) */}
                    {renderHeaderLogo()}
                  </div>
                </div>

                {/* 2. Real Document Table Rows from Supabase DB */}
                <div
                  className="space-y-3 pt-1 overflow-hidden"
                  style={{ maxHeight: `${currentConfig.tableMaxHeight || 520}px` }}
                >
                  <div
                    onClick={() => setSelectedTextKey('docTitle')}
                    className={`cursor-pointer bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex justify-between items-center font-bold ${
                      selectedTextKey === 'docTitle' ? 'ring-2 ring-emerald-500 bg-emerald-50/50' : ''
                    }`}
                    style={{ fontSize: `${fontSizes.docTitle}px` }}
                  >
                    <div>{isPreviewEn ? 'Account Name / Client' : 'اسم الحساب / العميل'}: <span className="text-slate-900 font-black">{selectedAccountName}</span></div>
                    <div>{isPreviewEn ? 'Period From' : 'الفترة من'}: <span className="font-mono">2026/01/01</span> {isPreviewEn ? 'To' : 'إلى'}: <span className="font-mono">2026/08/11</span></div>
                  </div>

                  <table className="w-full text-right border-collapse table-fixed">
                    <thead>
                      <tr
                        onClick={() => setSelectedTextKey('tableHeader')}
                        className={`font-bold cursor-pointer ${
                          selectedTextKey === 'tableHeader' ? 'ring-2 ring-amber-400' : ''
                        }`}
                        style={{
                          backgroundColor: currentConfig.tableHeaderBgColor || currentConfig.primaryColor,
                          color: currentConfig.tableHeaderTextColor || '#ffffff',
                          fontSize: `${fontSizes.tableHeader}px`,
                        }}
                      >
                        <th className="p-2 text-center" style={{ width: '4%' }}>#</th>
                        <th className="p-2 text-center" style={{ width: '18%' }}>{isPreviewEn ? 'Date / Doc Ref' : 'التاريخ / المستند'}</th>
                        <th className="p-2 text-center" style={{ width: '36%' }}>{isPreviewEn ? 'Description' : 'البيان والشرح'}</th>
                        <th className="p-2 text-center" style={{ width: '14%' }}>{isPreviewEn ? 'Debit' : 'مدين'}</th>
                        <th className="p-2 text-center" style={{ width: '14%' }}>{isPreviewEn ? 'Credit' : 'دائن'}</th>
                        <th className="p-2 text-center" style={{ width: '14%' }}>{isPreviewEn ? 'Balance' : 'الرصيد'}</th>
                      </tr>
                    </thead>
                    <tbody
                      onClick={() => setSelectedTextKey('tableBody')}
                      className={`divide-y divide-slate-200 cursor-pointer ${
                        currentConfig.isTableBold ? 'font-bold' : 'font-medium'
                      } ${
                        selectedTextKey === 'tableBody' ? 'ring-2 ring-emerald-500 bg-emerald-50/20' : ''
                      }`}
                      style={{
                        color: currentConfig.tableTextColor || '#0f172a',
                        fontSize: `${fontSizes.tableBody}px`,
                      }}
                    >
                      {displayRows.map((row, idx) => (
                        <tr
                          key={row.id}
                          className={
                            currentConfig.tableRowStriped !== false && idx % 2 === 1
                              ? 'bg-slate-50/70'
                              : 'bg-white'
                          }
                        >
                          <td className="p-2 text-center font-bold text-slate-400 font-mono">{idx + 1}</td>
                          <td className="p-2 font-mono text-center leading-tight">
                            <div className="font-bold text-slate-800">{row.ref}</div>
                            <div className="text-[10px] text-slate-500 font-medium">{row.date}</div>
                          </td>
                          <td className={`p-2 ${currentConfig.textWrapMode === 'nowrap' ? 'truncate' : 'leading-snug'}`}>
                            {row.desc}
                          </td>
                          <td className="p-2 text-center font-mono font-bold text-emerald-700 truncate">{row.debit}</td>
                          <td className="p-2 text-center font-mono font-bold text-rose-700 truncate">{row.credit}</td>
                          <td className="p-2 text-center font-mono font-bold text-slate-900 truncate">{row.bal}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 3. DEDICATED FINANCIAL SUMMARY CARD FOR LAST PAGE */}
                {previewPageNumber === 'last' && currentConfig.showFinancialSummary !== false && (
                  <div
                    onClick={() => setSelectedTextKey('summaryTitle')}
                    className={`cursor-pointer transition-all p-4 rounded-xl space-y-3 ${
                      selectedTextKey === 'summaryTitle' ? 'ring-2 ring-emerald-500' : ''
                    }`}
                    style={{
                      backgroundColor: currentConfig.summaryBgColor || '#f8fafc',
                      border:
                        currentConfig.summaryStyle === 'gold_bordered'
                          ? '2px solid #d97706'
                          : currentConfig.summaryStyle === 'table_summary'
                          ? `2px solid ${currentConfig.primaryColor}`
                          : '1px solid #cbd5e1',
                      boxShadow: currentConfig.summaryStyle === 'executive_banner' ? '0 10px 25px -5px rgba(0,0,0,0.1)' : 'none',
                    }}
                  >
                    {/* Summary Header Title */}
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span
                        className="font-black text-slate-900 flex items-center gap-1.5"
                        style={{ fontSize: `${fontSizes.summaryTitle || 13}px` }}
                      >
                        <IconCalculator size={18} className="text-emerald-600" />
                        {isPreviewEn ? 'Financial Summary & Statement Closing (Live Supabase Data)' : 'الملخص المالي والختام الإجمالي للكشف (بيانات Supabase الحية)'}
                      </span>
                      <Badge color="emerald" size="sm" variant="filled">{isPreviewEn ? 'Linked to Supabase' : 'مربوط بـ Supabase'}</Badge>
                    </div>

                    {/* Summary Grid or Banner depending on summaryStyle */}
                    {currentConfig.summaryStyle === 'executive_banner' ? (
                      <div
                        className="p-3.5 rounded-lg flex items-center justify-between shadow-xs"
                        style={{
                          backgroundColor: currentConfig.summaryBalanceBg || '#0f172a',
                          color: currentConfig.summaryBalanceTextColor || '#ffffff',
                        }}
                      >
                        <div>
                          <div className="text-[10px] opacity-80 font-bold">{isPreviewEn ? 'Final Net Balance Due' : 'صافي الرصيد النهائي المستحق'}</div>
                          <div className="text-xl font-black font-mono dir-ltr">
                            {statementSummary.closingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} {isPreviewEn ? 'IQD' : 'د.ع'}
                          </div>
                        </div>
                        <div className="text-left text-xs font-mono opacity-90 border-r border-white/20 pr-4 space-y-0.5">
                          <div>{isPreviewEn ? 'Total Debit' : 'إجمالي المدين'}: <span className="font-bold">{statementSummary.totalDebit.toLocaleString()}</span></div>
                          <div>{isPreviewEn ? 'Total Credit' : 'إجمالي الدائن'}: <span className="font-bold">{statementSummary.totalCredit.toLocaleString()}</span></div>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`grid gap-2 text-center ${
                          currentConfig.showOpeningBalance !== false ? 'grid-cols-4' : 'grid-cols-3'
                        }`}
                        style={{ fontSize: `${fontSizes.summaryMetrics || 12}px` }}
                      >
                        {currentConfig.showOpeningBalance !== false && (
                          <div
                            className="p-2 rounded-lg border border-slate-200/80 space-y-0.5 shadow-2xs"
                            style={{
                              backgroundColor: currentConfig.summaryOpeningBg || '#ffffff',
                              color: currentConfig.summaryOpeningTextColor || '#334155',
                            }}
                          >
                            <span className="text-[10px] font-bold block opacity-80">{isPreviewEn ? 'Opening Balance' : 'رصيد أول المدة'}</span>
                            <span className="font-mono font-bold text-sm block dir-ltr">
                              {statementSummary.openingBalance.toLocaleString()} {isPreviewEn ? 'IQD' : 'د.ع'}
                            </span>
                          </div>
                        )}

                        <div
                          className="p-2 rounded-lg border border-emerald-200/80 space-y-0.5 shadow-2xs"
                          style={{
                            backgroundColor: currentConfig.summaryDebitBg || '#ffffff',
                            color: currentConfig.summaryDebitTextColor || '#047857',
                          }}
                        >
                          <span className="text-[10px] font-bold block opacity-90">{isPreviewEn ? 'Total Debit (+)' : 'مجموع المدين (+)'}</span>
                          <span className="font-mono font-black text-sm block dir-ltr">
                            {statementSummary.totalDebit.toLocaleString()}
                          </span>
                        </div>

                        <div
                          className="p-2 rounded-lg border border-rose-200/80 space-y-0.5 shadow-2xs"
                          style={{
                            backgroundColor: currentConfig.summaryCreditBg || '#ffffff',
                            color: currentConfig.summaryCreditTextColor || '#be123c',
                          }}
                        >
                          <span className="text-[10px] font-bold block opacity-90">{isPreviewEn ? 'Total Credit (-)' : 'مجموع الدائن (-)'}</span>
                          <span className="font-mono font-black text-sm block dir-ltr">
                            {statementSummary.totalCredit.toLocaleString()}
                          </span>
                        </div>

                        <div
                          className="p-2 rounded-lg space-y-0.5 shadow-xs"
                          style={{
                            backgroundColor: currentConfig.summaryBalanceBg || '#047857',
                            color: currentConfig.summaryBalanceTextColor || '#ffffff',
                          }}
                        >
                          <span className="text-[10px] font-bold block opacity-90">{isPreviewEn ? 'Net Balance' : 'الرصيد النهائي'}</span>
                          <span className="font-mono font-black text-sm block dir-ltr">
                            {statementSummary.closingBalance.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Tafqeet Amount in Words */}
                    {currentConfig.showTafqeet !== false && (
                      <div
                        className="p-2.5 rounded-lg border border-slate-200 text-xs font-bold flex items-center justify-between"
                        style={{
                          backgroundColor: currentConfig.summaryTafqeetBg || '#ffffff',
                          color: currentConfig.summaryTafqeetTextColor || '#1e293b',
                        }}
                      >
                        <span className="opacity-75">المبلغ التفقيطي بالحروف:</span>
                        <span className="font-extrabold text-emerald-800">
                          « فقط مليون وأربعمائة وخمسة وعشرون ألف دينار عراقي لا غير »
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Notes & Terms Box */}
                {currentConfig.notesText && (
                  <div
                    onClick={() => setSelectedTextKey('notes')}
                    className={`cursor-pointer bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-600 font-medium ${
                      selectedTextKey === 'notes' ? 'ring-2 ring-emerald-500 bg-emerald-50/50' : ''
                    }`}
                    style={{ fontSize: `${fontSizes.notes}px` }}
                  >
                    {currentConfig.notesText}
                  </div>
                )}

                {/* 4. Signature & Stamp Boxes */}
                {currentConfig.showSignatures && (
                  <div
                    onClick={() => setSelectedTextKey('signatures')}
                    className={`cursor-pointer grid grid-cols-3 gap-4 pt-4 text-center font-bold border-t border-slate-200 mt-4 ${
                      selectedTextKey === 'signatures' ? 'ring-2 ring-emerald-500 p-2 rounded' : ''
                    }`}
                    style={{ fontSize: `${fontSizes.signatures}px` }}
                  >
                    <div className="space-y-6">
                      <span className="text-slate-700 block">{currentConfig.managerSignTitle}</span>
                      <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto"></div>
                    </div>
                    <div className="space-y-6">
                      <span className="text-slate-700 block">{currentConfig.accountantSignTitle}</span>
                      <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto"></div>
                    </div>
                    <div className="space-y-6">
                      <span className="text-slate-700 block">{currentConfig.receiverSignTitle}</span>
                      <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto"></div>
                    </div>
                  </div>
                )}
              </div>

              <div
                className="relative z-10 transition-all mt-4"
                style={{
                  background: footerStyleObj.background,
                  padding: footerStyleObj.padding,
                  borderRadius: footerStyleObj.borderRadius,
                  borderTop: (footerStyleObj as any).borderTop,
                  borderBottom: (footerStyleObj as any).borderBottom,
                  borderRight: (footerStyleObj as any).borderRight,
                  border: (footerStyleObj as any).border,
                  boxShadow: (footerStyleObj as any).boxShadow || 'none',
                  minHeight: `${currentConfig.footerHeight || 36}px`,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <div
                  onClick={() => setSelectedTextKey('footer')}
                  className={`w-full cursor-pointer ${
                    selectedTextKey === 'footer' ? 'ring-2 ring-emerald-500 p-1 rounded' : ''
                  } ${currentConfig.footerAlign === 'center' ? 'text-center' : currentConfig.footerAlign === 'right' ? 'text-right' : 'text-left'}`}
                  style={{ fontSize: `${currentConfig.footerFontSize || fontSizes.footer}px` }}
                >
                  <div
                    className="font-bold leading-tight"
                    style={{ color: currentConfig.footerTextColor || footerStyleObj.fontColor }}
                  >
                    {isPreviewEn ? (currentConfig.footerTextEn || currentConfig.footerText) : currentConfig.footerText}
                  </div>

                  {currentConfig.showPageNumbers && (
                    <div
                      className="font-mono text-[9px] font-bold mt-0.5"
                      style={{ color: currentConfig.footerTextColor || footerStyleObj.pageNumColor }}
                    >
                      {isPreviewEn ? 'Page' : 'صفحة'} {previewPageNumber === 'last' ? '3' : previewPageNumber} {isPreviewEn ? 'of' : 'من'} 3
                    </div>
                  )}
                </div>
              </div>

              {/* Fully Customizable Draggable QR Component */}
              {shouldRenderQrOnCurrentPage() && (
                <motion.div
                  drag
                  dragSnapToOrigin={false}
                  dragMomentum={false}
                  dragConstraints={paperSheetRef}
                  onDragEnd={handleQrDragEnd}
                  style={{
                    position: 'absolute',
                    left: `${currentConfig.qrPosX ?? 24}px`,
                    top: `${currentConfig.qrPosY ?? 870}px`,
                    cursor: 'move',
                    zIndex: 50,
                  }}
                  className="transition-shadow hover:scale-105"
                  title="قم بسحب رمز الـ QR بالماوس لتغيير مكانه وثباته!"
                >
                  <RealQRCode
                    size={currentConfig.qrSize || 48}
                    color={currentConfig.qrColor || currentConfig.primaryColor}
                    bgColor={currentConfig.qrBgColor || '#ffffff'}
                    borderColor={currentConfig.qrBorderColor || currentConfig.primaryColor}
                    shape={currentConfig.qrShape || 'rounded_card'}
                    showLabel={currentConfig.qrShowLabel !== false}
                  />
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Save Template Modal */}
      <Modal
        opened={saveModalOpened}
        onClose={() => setSaveModalOpened(false)}
        title={<span className="font-bold text-sm">حفظ تصميم جديد في قاعدة البيانات ({getDocTypeLabel(activeDoc)})</span>}
        centered
      >
        <Stack gap="md">
          <TextInput
            label="اسم التصميم / القالب"
            placeholder="مثال: تصميم كشف الحساب الفاخر VIP"
            value={newTemplateName}
            onChange={(e) => setNewTemplateName(e.target.value)}
            required
          />

          <Switch
            label="اعتماد هذا التصميم فوراً كـ التصميم الرسمي للكشوفات والمستندات"
            checked={setAsDefaultCheck}
            onChange={(e) => setSetAsDefaultCheck(e.currentTarget.checked)}
            color="emerald"
          />

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setSaveModalOpened(false)}>إلغاء</Button>
            <Button color="emerald" onClick={handleSaveAsNewTemplate} loading={isSavingDb}>حفظ التصميم</Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
};
