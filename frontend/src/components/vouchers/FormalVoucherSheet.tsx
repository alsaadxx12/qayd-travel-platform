import React from 'react';
import { tafqeetArabic } from '../reports/AccountStatementPrintModal';
import type { VoucherPrintItem } from './VoucherPrintModal';

/**
 * The formal accounting layout for a receipt or payment voucher.
 *
 * The design brief was «رسمي محاسبي هادئ», and the discipline behind that is not
 * decoration — it is hierarchy. A voucher is read by three people in three different
 * ways: the payer glances for the amount, the accountant scans for the account and the
 * reference, and an auditor later reads every line. So the amount is the largest thing
 * on the page and the only place a second colour appears; everything else is set in one
 * ink on white, separated by space and rules rather than by boxes.
 *
 * That is also why the previous version was hard to read despite being prettier: every
 * field sat in its own tinted, rounded, bordered card, which gave twenty pieces of
 * information the same visual weight. Removing the boxes IS the redesign.
 *
 * It prints in one ink beside black if the company wants, survives a photocopier
 * (no light-on-light text), and reads correctly at A5 and on an 80mm roll.
 *
 * ── مبدأ هذا الملف ──
 *
 * لا قيمة بصرية مكتوبة في الكود إلا وهي قيمة افتراضية لمفتاح في القالب. كل لون وكل
 * حجم وكل مسافة وكل شكل يمرّ عبر `config`. القاعدة العملية: إن رأى المستخدم شيئاً في
 * الورقة المطبوعة ولم يجد ما يغيّره في إعدادات القالب، فذلك عيب في هذا الملف لا نقص
 * في الإعدادات. وما يلي مكتوب على هذا الأساس.
 */

export interface VoucherSheetConfig {
  // ── Layout & density ──
  voucherPaperSize?: 'A4' | 'A5' | 'THERMAL80';
  density?: 'comfortable' | 'normal' | 'compact';
  marginMm?: number;
  copiesPerPage?: 1 | 2;
  /** تسميات النسخ حين تُطبع نسختان في صفحة — الأصل والصورة. */
  copyLabels?: string[];

  // ── Header & logo ──
  voucherHeaderStyle?: 'band' | 'rule' | 'plain' | 'frame';
  /**
   * جهة الشعار في الترويسة — البداية أو النهاية أو سطرٌ مستقلّ فوق الاسم.
   *
   * كان هذا المفتاح يضبط توزيع الصفّ كلّه لا موضع الشعار، فلم يكن في النظام سبيل
   * إلى نقل الشعار وحده إلى الجهة الأخرى: كان يُرسم أولاً دائماً. والآن يضبط ترتيب
   * الشعار، ومحاذاة الاسم مفتاحٌ مستقلّ إلى جانبه.
   */
  logoPosition?: 'start' | 'center' | 'end';
  /**
   * موضع اسم الشركة — منسوباً إلى الشعار لا إلى حافة الورقة.
   *
   * «مقابل الشعار» و«ملاصق له» يبقيان صحيحين مهما نُقل الشعار، بينما «يمين/يسار»
   * المطلقان ينقلبان معناهما عند نقله: من اختار الاسم في الطرف المقابل ثم نقل
   * الشعار إلى الجهة الأخرى كان يجد الاثنين ملتصقين. والقيمتان المطلقتان مقبولتان
   * أيضاً لأن تصاميم حُفظت بهما قبل هذا التمييز.
   */
  headerTextAlign?: 'opposite' | 'beside' | 'center' | 'start' | 'end';
  /** محاذاة سطر العنوان والهاتف والبريد أسفل الترويسة. */
  contactAlign?: 'start' | 'center' | 'end';
  logoUrl?: string;
  /**
   * أسماء الحقول هنا هي نفسها المحفوظة في تصميم الطباعة — لا مرادفات لها.
   *
   * كانت الورقة تقرأ companyNameAr و companySubtitle و logoSize، ولا يكتب النظام
   * أياً منها؛ فكانت الترويسة تخرج بلا اسم شركة ولا شعار مهما ضبط المستخدم
   * الإعدادات. المفاتيح الحقيقية هي companyName / companyNameEn و subtitle /
   * subtitleEn و logoHeight — وهذه هي المستعملة الآن.
   */
  logoHeight?: number;
  logoWidth?: number;
  logoBorderRadius?: number;
  companyName?: string;
  companyNameEn?: string;
  /**
   * وصف الشركة تحت اسمها — مُطفأ ما لم يُطلب صراحةً.
   *
   * كان يُطبع نصّ افتراضي («شركة البرمجيات والحلول المالية المتقدمة») ولا حقل له في
   * أي شاشة، فلا سبيل إلى تغييره ولا إلى إزالته. والافتراض الآن ألّا يُطبع: سطرٌ لا
   * يملك المستخدم أمره أسوأ من سطرٍ ناقص، والترويسة تكتفي باسم الشركة ما لم يختر
   * صاحبها غير ذلك.
   */
  showSubtitle?: boolean;
  subtitle?: string;
  subtitleEn?: string;
  showAddress?: boolean;
  showPhone?: boolean;
  showEmail?: boolean;
  showWebsite?: boolean;
  showCommercialReg?: boolean;
  showTaxNumber?: boolean;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  commercialReg?: string;
  taxNumber?: string;

  // ── Document meta (number / date / time) ──
  metaStyle?: 'inline' | 'box';

  // ── The amount ──
  amountStyle?: 'rule' | 'panel' | 'accent';
  /**
   * محاذاة المبلغ داخل خانته: في الوسط (الافتراضي) أو في الطرف مقابل تسميته.
   *
   * التوسيط يجعل المبلغ — أهم رقم على الورقة — على محور الصفحة نفسه حيث تقع عين
   * القارئ أولاً، بدل أن يعتمد موقعه على اتجاه اللغة.
   */
  amountAlign?: 'center' | 'edge';
  showTafqeet?: boolean;
  /** موضع التفقيط: تحت المبلغ مباشرةً (الأتقن محاسبياً) أو كحقل ضمن الجدول. */
  tafqeetPlacement?: 'underAmount' | 'field';

  // ── Fields: which appear, how, and in what order ──
  fieldOrder?: string[];
  hiddenFields?: string[];
  /**
   * تسميات الحقول كما يريدها صاحب النظام — تعلو التسميات الافتراضية.
   *
   * المفتاح مفتاح الحقل والقيمة نصّ التسمية؛ والفارغ يعني «التسمية الافتراضية».
   * تُطبَّق في اللغتين سواء: من كتب تسميته بنفسه فهي تسميته.
   */
  fieldLabels?: Record<string, string>;
  fieldStyle?: 'lines' | 'grid' | 'zebra' | 'table';
  /** عرض عمود التسميات بالبكسل — يتّسع للعبارات الطويلة دون كسرها. */
  labelWidth?: number;
  /** خلفية عمود التسميات في شكل «جدول البيانات» — وإلا خلفية الحقول العامة فالمشتقّة من الحبر. */
  fieldLabelBg?: string;
  /** لون خلفية الحقول وحدودها — مفتاحا تبويب «الألوان» القديمان، يسريان على الجدول أيضاً. */
  fieldBgColor?: string;
  fieldBorderColor?: string;
  /** حشوة الصف العمودية بالبكسل — تعلو كثافة الأسطر حين تُضبط. */
  fieldRowPadding?: number;
  /**
   * شكل «تقسيم المبلغ»: جدول بسيط (الافتراضي)، أو قيد محاسبي، أو سطر واحد.
   *
   * الجدول يعرض الحسابات المقسّم عليها ومبلغ كلٍّ منها وسطر مجموع — بلا طرفي
   * قيد. والقيد يبقى خياراً لمن يريد الحركة كما تُقيَّد في الدفتر: الصندوق
   * مديناً والحسابات دائنةً في القبض، ومعكوساً في الدفع.
   */
  splitStyle?: 'inline' | 'table' | 'entry';
  /**
   * تسمية سطر الباقي في جدول التقسيم.
   *
   * الباقي يستقرّ على حساب الطرف، لكن طباعة اسم الشخص هناك تكرارٌ لما في سطر
   * «استلمنا من» أعلاه — فالسطر يحمل تسميةً محايدة («جهة») يغيّرها صاحب النظام
   * كما يشاء من الإعدادات.
   */
  splitRemainderLabel?: string;
  /**
   * حقول تُطبع ولو كانت فارغة — سطرٌ للكتابة اليدوية.
   *
   * القاعدة العامة أن الحقل الفارغ لا يُطبع كي لا يُقرأ نقصاً في البيانات، لكن
   * «الملاحظات» بالذات تقليدها الورقي معكوس: تُترك مساحة يكتب فيها المستلم بيده.
   * فافتراضها هنا أن تُطبع فارغة، ومن لا يريدها أطفأها من قائمة الحقول.
   */
  printEmptyFields?: string[];

  // ── Signatures, stamp, notes, footer ──
  signatureTitles?: string[];
  /** التسميتان القديمتان — تُستعملان حين لا يُضبط signatureTitles. */
  payerSignTitle?: string;
  receiverSignTitle?: string;
  showSignatures?: boolean;
  signatureStyle?: 'line' | 'box';
  /** ارتفاع مساحة التوقيع بالبكسل — المساحة البيضاء التي يوقَّع فيها فعلاً. */
  signatureHeight?: number;
  showStamp?: boolean;
  stampPosition?: 'start' | 'center' | 'end';
  stampText?: string;
  stampSize?: number;
  notesText?: string;
  footerText?: string;
  footerAlign?: 'start' | 'center' | 'end';
  thankYouText?: string;
  showWatermark?: boolean;
  watermarkText?: string;
  watermarkColor?: string;
  watermarkOpacity?: number;
  watermarkAngle?: number;
  watermarkSize?: number;

  /**
   * أين يُطبع سطر العنوان والهاتف والبريد: تحت الترويسة أو في التذييل.
   *
   * في التذييل تخفّ الترويسة إلى الهوية وحدها (شعار واسم)، وتنزل بيانات الاتصال
   * إلى أسفل الورقة فوق سطر الحقوق — وهو تقليد المطبوعات الرسمية.
   */
  contactPlacement?: 'header' | 'footer';

  // ── Ink & type ──
  primaryColor?: string;
  borderColor?: string;
  /** لون النصوص الأساسية (قيم الحقول والمتن). */
  textColor?: string;
  /** لون تسميات الحقول («استلمنا من…»، «وذلك عن…»). */
  labelColor?: string;
  /** لون نص التذييل وبيانات الاتصال فيه. */
  footerTextColor?: string;
  amountTextColor?: string;
  tafqeetTextColor?: string;
  fontFamily?: string;
  /**
   * تكبير كل نصوص الورقة دفعة واحدة — نسبة مئوية و100 هي الأصل.
   *
   * يضرب كل مقاس محسوب، فتكبر الورقة كلها متناسبةً بدل أن يطارد المستخدم ستة
   * أشرطة منفصلة ليحافظ على التراتب نفسه.
   */
  fontScale?: number;
  /**
   * نمط كل نص على حدة — المفتاح من VOUCHER_TEXT_ELEMENTS.
   *
   * كل خاصية اختيارية، وما لم يُضبط يبقى على مظهره الموروث (ألوان القالب العامة
   * والمقاسات والأوزان الافتراضية). فالقاعدة: الضبط العام أولاً، وهذا فوقه لمن
   * أراد لعنوان السند لوناً ولرقم المبلغ وزناً ولعبارة الشكر ميلاً.
   */
  textStyles?: Record<string, VoucherTextStyle>;
  fontSizes?: {
    companyTitle?: number;
    subtitle?: number;
    docTitle?: number;
    body?: number;
    label?: number;
    amount?: number;
  };
  showQrCode?: boolean;
  qrSize?: number;
}

/** ما يُضبط لنصٍّ بعينه: لونه ومقاسه ووزنه ومحاذاته وميله. */
export interface VoucherTextStyle {
  color?: string;
  size?: number;
  weight?: 'normal' | 'semibold' | 'bold' | 'black';
  align?: 'start' | 'center' | 'end';
  italic?: boolean;
}

/** كل نص في الورقة يمكن تخصيصه — بالترتيب الذي يلقاه القارئ من أعلى الورقة. */
export const VOUCHER_TEXT_ELEMENTS: Array<{ key: string; label: string; labelEn: string }> = [
  { key: 'company', label: 'اسم الشركة', labelEn: 'Company name' },
  { key: 'subtitle', label: 'وصف الشركة', labelEn: 'Company tagline' },
  { key: 'docTitle', label: 'عنوان السند (سند قبض)', labelEn: 'Document title' },
  { key: 'meta', label: 'رقم السند والتاريخ والوقت', labelEn: 'Number & date' },
  { key: 'amount', label: 'رقم المبلغ', labelEn: 'Amount figure' },
  { key: 'tafqeet', label: 'التفقيط (المبلغ كتابةً)', labelEn: 'Amount in words' },
  { key: 'fieldLabel', label: 'تسميات الحقول', labelEn: 'Field labels' },
  { key: 'fieldValue', label: 'قيم الحقول', labelEn: 'Field values' },
  { key: 'thankYou', label: 'عبارة الشكر', labelEn: 'Thank-you line' },
  { key: 'signature', label: 'مسميات التواقيع', labelEn: 'Signature titles' },
  { key: 'notes', label: 'الشرط القانوني', labelEn: 'Legal note' },
  { key: 'footer', label: 'التذييل وبيانات الاتصال', labelEn: 'Footer & contact' },
];

const WEIGHTS: Record<string, number> = { normal: 500, semibold: 600, bold: 700, black: 900 };

/** Every field the voucher can show, in the order an accountant reads them. */
export const VOUCHER_FIELDS: Array<{ key: string; label: string; labelEn: string }> = [
  { key: 'party', label: 'استلمنا من السيد / السادة', labelEn: 'Received from' },
  { key: 'amountWords', label: 'المبلغ كتابةً', labelEn: 'Amount in words' },
  { key: 'reason', label: 'وذلك عن', labelEn: 'Being for' },
  { key: 'split', label: 'تقسيم المبلغ', labelEn: 'Allocation' },
  { key: 'paymentMethod', label: 'طريقة الاستلام', labelEn: 'Method' },
  /* «الصندوق / الحساب المالي» أُزيل بطلب صاحب النظام — معلومة داخلية لا يحتاجها
     الطرف المقابل على وصله. حذفه من هذه القائمة يكفي: أي fieldOrder محفوظ قديماً
     ما زال يذكره يُرشَّح تلقائياً لأن الصف لا يُرسم إلا لمفتاح معروف هنا. */
  { key: 'reference', label: 'المرجع', labelEn: 'Reference' },
  { key: 'notes', label: 'ملاحظات', labelEn: 'Notes' },
];

const DENSITY = {
  comfortable: { row: 'py-2.5', gap: 'space-y-2.5', base: 12, label: 10.5 },
  normal: { row: 'py-2', gap: 'space-y-2', base: 11, label: 10 },
  compact: { row: 'py-1.5', gap: 'space-y-1.5', base: 10, label: 9 },
};

const PAPER = {
  A4: { width: 780, minHeight: 1050 },
  A5: { width: 560, minHeight: 760 },
  THERMAL80: { width: 302, minHeight: 0 },
};

/**
 * لون الحبر بشفافية — لتخفيف اللون الرئيسي بدل إدخال رمادي غريب عنه.
 *
 * الخلفيات والأطر المشتقّة من لون الشركة تبقى منسجمة معه مهما غُيّر، بينما الرمادي
 * الثابت كان يصطدم بأي لون دافئ ويجعل الورقة تبدو مركّبة من تصميمين.
 */
const tint = (hex: string, alpha: number): string => {
  const raw = String(hex || '').trim().replace(/^#/, '');
  // الصيغة المختصرة (#0af) واردة في تصاميم محفوظة قديماً، وردّها إلى الافتراضي كان
  // سيقلب أطر الورقة إلى أزرق غريب عن لون الشركة دون سبب ظاهر.
  const full = /^[0-9a-f]{3}$/i.test(raw) ? raw.split('').map((c) => c + c).join('') : raw;
  if (!/^[0-9a-f]{6}$/i.test(full)) return `rgba(15, 61, 110, ${alpha})`;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

/**
 * التاريخ كما يُقرأ لا كما يُخزَّن.
 *
 * كان السند يطبع «2026-08-30T00:00:00.000Z» حرفياً، لأن القيمة تصل من الخادم طابعاً
 * زمنياً كاملاً بتوقيت UTC وكانت تُعرض بلا معالجة. ونأخذ الجزء النصّي مباشرة بدل
 * `new Date(...)` عمداً: التحويل عبر كائن التاريخ يُزيح اليوم يوماً كاملاً لأي مستخدم
 * شرق غرينتش أو غربها حين يكون الوقت منتصف الليل — وهو ما يجعل سنداً حُرّر يوم 30
 * يُطبع بتاريخ 29.
 */
const formatVoucherDate = (value?: string): string => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString().slice(0, 10);
};

/**
 * الوقت — ولا شيء حين لا وقت.
 *
 * منتصف الليل بالضبط في طابع UTC ليس وقت إصدار، بل هو ما يبقى حين يُحفظ التاريخ
 * وحده. طباعة «12:00 AM» في تلك الحالة تُقدّم معلومة مخترَعة على أنها موثّقة، فيُحذف
 * السطر بدلاً من ذلك.
 */
const formatVoucherTime = (voucher: { time?: string; date?: string }): string => {
  const explicit = String(voucher.time || '').trim();
  if (explicit) return explicit;
  const m = String(voucher.date || '').match(/T(\d{2}):(\d{2})/);
  if (!m) return '';
  if (m[1] === '00' && m[2] === '00') return '';
  return `${m[1]}:${m[2]}`;
};

const money = (value: number) =>
  Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const FormalVoucherSheet: React.FC<{
  voucher: VoucherPrintItem;
  config?: VoucherSheetConfig;
  lang?: 'ar' | 'en';
  qrDataUrl?: string | null;
  /**
   * Reserve and outline the QR area even when there is no code yet.
   *
   * Passed by the design screen and by nothing else: a printed voucher whose code
   * failed to load should print without one, not with an empty box where a customer
   * expects something to scan.
   */
  qrPlaceholder?: boolean;
}> = ({ voucher, config = {}, lang = 'ar', qrDataUrl, qrPlaceholder = false }) => {
  const isEn = lang === 'en';
  const showQrArea = Boolean(qrDataUrl) || qrPlaceholder;
  const isReceipt = voucher.type === 'RECEIPT';
  const ink = config.primaryColor || '#0F3D6E';
  const paper = PAPER[config.voucherPaperSize || 'A4'];
  const isThermal = (config.voucherPaperSize || 'A4') === 'THERMAL80';
  const d = DENSITY[config.density || 'normal'];
  const margin = config.marginMm ?? (isThermal ? 4 : 14);

  /**
   * مقاسات الخط: ما يختاره المستخدم أولاً، ثم مقاس الكثافة.
   *
   * كانت الأحجام أرقاماً مكتوبة في الكود (17 للاسم و21 للعنوان و30 للمبلغ)، بينما
   * في «إعدادات الطباعة» أشرطةُ تحكّم بهذه الأحجام بالضبط — تُحفظ في القالب ولا
   * تصل إلى الورقة. ومقاس الحرارة يبقى مشتقّاً لا مضبوطاً: 80mm لا يحتمل 30px مهما
   * طُلب، فيؤخذ الأصغر بين ما اختير وما يتّسع له العرض.
   */
  const fs = config.fontSizes || {};
  const cap = (value: number, thermalMax: number) => (isThermal ? Math.min(value, thermalMax) : value);
  /** معامل التكبير الشامل — يُطبَّق بعد اختيار المقاس وقبل سقف الحرارة. */
  const scale = Math.min(2, Math.max(0.6, (config.fontScale || 100) / 100));
  const sz = (v: number) => Math.round(v * scale * 10) / 10;
  const t = {
    base: sz(fs.body || d.base),
    label: sz(fs.label || d.label),
    company: cap(sz(fs.companyTitle || 17), 13),
    subtitle: sz(fs.subtitle || d.label),
    docTitle: cap(sz(fs.docTitle || 21), 15),
    amount: cap(sz(fs.amount || 30), 15),
  };

  /**
   * نمط النص الواحد فوق مظهره الموروث.
   *
   * يُبنى كائن style لا أكثر: الخاصية غير المضبوطة تبقى undefined فتحكمها فئات
   * التنسيق الافتراضية كما كانت — فلا يتغيّر شكل أي سند محفوظ لم يخصّص شيئاً.
   * والمقاس المخصَّص يمرّ في معامل التكبير الشامل مثل بقية المقاسات.
   */
  const ts = config.textStyles || {};
  /**
   * سلسلة مفاتيح لا مفتاح واحد: العام أولاً ثم الأخص، والخاصية المضبوطة في الأخص
   * تغلب — هكذا يضبط المستخدم «قيم الحقول» جملةً ثم يفرد «تقسيم المبلغ» وحده
   * بلون آخر دون أن يفقد بقية الضبط العام.
   */
  const pickStyle = (key: string | string[]): VoucherTextStyle => {
    const keys = Array.isArray(key) ? key : [key];
    const merged: VoucherTextStyle = {};
    for (const k of keys) {
      const layer = ts[k];
      if (!layer) continue;
      for (const prop of ['color', 'size', 'weight', 'align', 'italic'] as const) {
        if (layer[prop] !== undefined && layer[prop] !== '' && layer[prop] !== 0) {
          (merged as any)[prop] = layer[prop];
        }
      }
    }
    return merged;
  };
  const styleOf = (
    key: string | string[],
    fallbackSize: number,
    fallbackColor?: string
  ): React.CSSProperties => {
    const s = pickStyle(key);
    return {
      fontSize: s.size ? sz(s.size) : fallbackSize,
      color: s.color || fallbackColor || undefined,
      fontWeight: s.weight ? WEIGHTS[s.weight] : undefined,
      textAlign: s.align ? (s.align as React.CSSProperties['textAlign']) : undefined,
      fontStyle: s.italic ? 'italic' : undefined,
    };
  };

  const rule = config.borderColor || tint(ink, 0.22);
  const softRule = config.borderColor || tint(ink, 0.13);
  const amountColor = config.amountTextColor || ink;
  const tafqeetColor = config.tafqeetTextColor || ink;
  const labelWidth = config.labelWidth || 150;
  const sigHeight = config.signatureHeight || 44;
  /**
   * رمز الكشف بحجم خانة التوقيع ما لم يُضبط بنفسه.
   *
   * الخانتان تقعان في صفٍّ واحد، وفرق الحجم بينهما كان يجعل الرمز يبدو ملحقاً لا
   * ركناً. ربطُ افتراضه بارتفاع التوقيع يُبقيهما متساويين حتى لو رفع المستخدم
   * ارتفاع التوقيع ونسي الرمز.
   */
  const qrSize = config.qrSize || sigHeight + 22;

  const hidden = new Set(config.hiddenFields || []);
  const order = config.fieldOrder?.length ? config.fieldOrder : VOUCHER_FIELDS.map((f) => f.key);
  const fieldByKey = new Map(VOUCHER_FIELDS.map((f) => [f.key, f]));

  const currency = voucher.currency || 'IQD';
  const amountText = `${money(voucher.amount)} ${currency}`;
  const dateText = formatVoucherDate(voucher.date);
  const timeText = formatVoucherTime(voucher);

  /**
   * التفقيط: يُطاع مفتاحه، ويُوضع حيث يُقرأ.
   *
   * مفتاح «إظهار التفقيط» كان موجوداً في الإعدادات منذ البداية وكان هذا التخطيط
   * يتجاهله تماماً — يطبع المبلغ كتابةً في كل الأحوال. وموضعه الافتراضي الآن تحت
   * المبلغ رقماً لا في وسط جدول الحقول، لأنه ضبطٌ للمبلغ لا حقلٌ مستقلّ عنه؛ ومن
   * أراد الصيغة القديمة فـ tafqeetPlacement = 'field'.
   */
  const showTafqeet = config.showTafqeet !== false;
  const tafqeetUnderAmount = showTafqeet && (config.tafqeetPlacement || 'underAmount') === 'underAmount';
  const tafqeetText = tafqeetArabic(voucher.amount || 0);

  /** سطر بيانات الاتصال — بالترتيب، وبلا خانات فارغة تترك نقاطاً معلّقة. */
  const contactLine = isThermal
    ? []
    : [
        config.showAddress !== false ? config.address : '',
        config.showPhone !== false ? config.phone : '',
        config.showEmail !== false ? config.email : '',
        config.showWebsite !== false ? config.website : '',
        config.showCommercialReg ? config.commercialReg : '',
        config.showTaxNumber ? config.taxNumber : '',
      ]
        .map((v) => String(v || '').trim())
        .filter(Boolean);

  const values: Record<string, string> = {
    party: voucher.receivedFromOrPaidTo || voucher.accountName || '',
    amountWords: tafqeetText,
    reason: voucher.description || '',
    split:
      voucher.splitAccounts?.length
        ? voucher.splitAccounts
            .map((s) => `${s.accountName}: ${money(Number(s.amount) || 0)}`)
            .join('  ·  ')
        : voucher.splitDescription || '',
    paymentMethod: voucher.customCategory || '',
    reference: voucher.reference || '',
    notes: voucher.costCenter || '',
  };

  const rows = order
    .filter((key) => !hidden.has(key) && fieldByKey.has(key))
    // التفقيط لا يُطبع مرتين: إن كان تحت المبلغ فلا يعود حقلاً، وإن أُطفئ فلا يُطبع.
    .filter((key) => (key === 'amountWords' ? showTafqeet && !tafqeetUnderAmount : true))
    // An empty field on a printed voucher is a blank line with a label and nothing
    // after it, which reads as missing data rather than as absent data — except the
    // fields explicitly asked to print blank as a hand-writing space.
    .filter(
      (key) =>
        String(values[key] || '').trim().length > 0 ||
        (key === 'split' && (config.splitStyle || 'table') !== 'inline') ||
        (config.printEmptyFields || ['notes']).includes(key)
    )
    .map((key) => ({ ...fieldByKey.get(key)!, value: values[key] }));

  /**
   * القيد المحاسبي لتقسيم المبلغ.
   *
   * في سند القبض يدخل المال إلى الصندوق فهو المدين، والحسابات المقسّم عليها
   * (أو الطرف نفسه إن لم يوجد تقسيم) دائنة؛ وفي سند الدفع ينعكس الطرفان.
   * والمجموعان متساويان بالضرورة — فيُطبع سطر المجموع توكيداً يقرؤه المدقّق.
   */
  const splitStyle = config.splitStyle || 'table';
  const splitAsGrid = splitStyle === 'table' || splitStyle === 'entry';
  const entryRows = (() => {
    if (!splitAsGrid) return [];
    const total = Number(voucher.amount) || 0;
    const counter = voucher.splitAccounts?.length
      ? voucher.splitAccounts.map((sp) => ({
          name: sp.accountName,
          amount: Number(sp.amount) || 0,
        }))
      : [{ name: values.party || (isEn ? 'Account' : 'الحساب'), amount: total }];
    /**
     * الباقي يعود إلى حساب الطرف — حتى يساوي المجموعُ المبلغَ المستلم دائماً.
     *
     * النظام يخزّن في التقسيم الأجزاء المقتطعة وحدها (فلاي: 50,000 من قبضٍ
     * قدره 190,000)، وما بقي يستقرّ على حساب الطرف ضمناً دون سطر يذكره. جدولٌ
     * مجموعه أقل من مبلغ السند يقرؤه المدقّق خطأً محاسبياً لا اصطلاح تخزين،
     * فيُدرج الباقي صراحةً باسم الطرف ويُطابق المجموعُ المبلغَ بالبناء.
     */
    const allocated = counter.reduce((a, c) => a + c.amount, 0);
    const remainder = total - allocated;
    if (voucher.splitAccounts?.length && remainder > 0.005) {
      counter.push({
        name: (config.splitRemainderLabel || '').trim() || (isEn ? 'Other' : 'جهة'),
        amount: remainder,
      });
    }
    if (splitStyle === 'table') {
      /* جدول بسيط: الحسابات المقسّم عليها ومبلغ كلٍّ منها — بلا طرفي قيد. */
      return counter.map((c) => ({ name: c.name, debit: c.amount, credit: 0 }));
    }
    const cashboxName = voucher.cashboxName || (isEn ? 'Cashbox' : 'الصندوق');
    return isReceipt
      ? [
          { name: cashboxName, debit: total, credit: 0 },
          ...counter.map((c) => ({ name: c.name, debit: 0, credit: c.amount })),
        ]
      : [
          ...counter.map((c) => ({ name: c.name, debit: c.amount, credit: 0 })),
          { name: cashboxName, debit: 0, credit: total },
        ];
  })();

  /**
   * التواقيع: الجديد أولاً، ثم التسميتان اللتان يحفظهما التصميم القديم.
   *
   * فبدون هذا الاحتياط، أي شركة سبق أن غيّرت «توقيع الدافع» و«توقيع المستلم» من
   * إعدادات الطباعة كانت ستراهما يعودان إلى الصيغة الافتراضية عند التحوّل إلى
   * التخطيط الرسمي — وهو ما يبدو كضياع للإعداد لا كتغيير للتصميم.
   */
  const signatures = (
    config.showSignatures === false
      ? []
      : config.signatureTitles?.length
        ? config.signatureTitles
        : [
            config.payerSignTitle || (isReceipt ? 'توقيع الدافع / المسلِّم' : 'توقيع المحاسب / الآمر بالصرف'),
            config.receiverSignTitle || (isReceipt ? 'توقيع المستلم / المحاسب' : 'توقيع المستلم'),
          ]
  ).filter((title) => String(title || '').trim().length > 0);

  const hasLogo = Boolean(config.logoUrl);
  const logoPosition = config.logoPosition || 'start';

  /**
   * محاذاة الاسم: ما يختاره المستخدم، وإلّا ما كانت عليه الورقة قبل وجود المفتاح.
   *
   * الترويسة كانت `justify-between`: شعارٌ في طرف واسمٌ في الطرف المقابل حين يوجد
   * شعار، واسمٌ في البداية حين لا يوجد — وهو ما يعطيه «مقابل الشعار» بالضبط في
   * الحالتين، فلا تتبدّل ترويسة أحدٍ لمجرّد أن المفتاح صار موجوداً.
   */
  const nameAlign = config.headerTextAlign || 'opposite';

  /**
   * سطر بيانات الاتصال لا يُوزَّع على الطرفين — يتبع الترويسة دون أن يتمدّد.
   *
   * كان يرث `justify-between` من صفّ الهوية، فتتباعد أربع قيم قصيرة على عرض الورقة
   * كلّه وتتعلّق النقاط الفاصلة في الفراغ بين كل قيمتين — يقرأها الناظر كأربعة أعمدة
   * لا كسطر واحد. والتوزيع منطقي لصفّ الهوية (شعار في طرف واسم في طرف)، وغير منطقي
   * لقائمة متتابعة.
   */
  const contactInFooter = (config.contactPlacement || 'footer') === 'footer';

  const contactJustify =
    config.contactAlign === 'center'
      ? 'justify-center text-center'
      : config.contactAlign === 'end'
        ? 'justify-end'
        : 'justify-start';

  const textAlignClass = (() => {
    if (nameAlign === 'center') return 'text-center';
    // القيمتان المطلقتان تُطاعان كما هما — تصاميم حُفظت بهما قبل أن يصير الموضع منسوباً.
    if (nameAlign === 'start') return 'text-start';
    if (nameAlign === 'end') return 'text-end';
    // بلا شعار لا مقابل ولا ملاصق: الاسم من بداية السطر.
    if (!hasLogo) return 'text-start';
    const besideLogo = nameAlign === 'beside';
    const sitsAtStart = logoPosition === 'end' ? besideLogo === false : besideLogo === true;
    return sitsAtStart ? 'text-start' : 'text-end';
  })();

  const headerStyle = config.voucherHeaderStyle || 'rule';
  const onBand = headerStyle === 'band';
  const metaStyle = config.metaStyle || 'inline';
  const amountStyle = config.amountStyle || 'rule';
  const fieldStyle = config.fieldStyle || 'lines';
  const footerAlign =
    config.footerAlign === 'start' ? 'text-start' : config.footerAlign === 'end' ? 'text-end' : 'text-center';

  const metaItems = [
    { label: isEn ? 'No.' : 'رقم السند', value: voucher.voucherNumber, strong: true },
    { label: isEn ? 'Date' : 'التاريخ', value: dateText, strong: false },
    ...(timeText ? [{ label: isEn ? 'Time' : 'الوقت', value: timeText, strong: false }] : []),
  ].filter((m) => String(m.value || '').trim().length > 0);

  /**
   * جسد السند — مفصولٌ عن الورقة كي تُطبع منه نسختان في صفحة واحدة.
   *
   * `copiesPerPage` مفتاحٌ معلَن في القالب منذ البداية ولم يكن ينفّذ شيئاً؛ وطباعة
   * «الأصل» و«صورة العميل» على ورقة واحدة هي الطريقة التي تعمل بها دفاتر السندات
   * فعلاً، فبقاؤه معطّلاً كان يعني أن على المحاسب أن يطبع مرتين ويقصّ يدوياً.
   */
  const body = (copyLabel?: string) => (
    <>
      {/* ── Header ── */}
      <header
        className={
          onBand
            ? 'px-3 py-2.5 rounded-md'
            : headerStyle === 'plain'
              ? 'pb-2'
              : headerStyle === 'frame'
                ? 'p-2.5 rounded-md border'
                : 'pb-2.5 border-b-2'
        }
        style={
          onBand
            ? { backgroundColor: ink, color: '#fff' }
            : headerStyle === 'frame'
              ? { borderColor: rule }
              : headerStyle === 'rule'
                ? { borderColor: ink }
                : undefined
        }
      >
        {/*
          الترويسة سطران لا ثلاثة أعمدة.

          كانت بيانات الاتصال عموداً منفصلاً في الطرف المقابل للاسم، فينفتح بينهما
          فراغ كبير في وسط الترويسة ويبدو السطران غير مرتبطين. الآن: سطر للهوية
          (الشعار والاسم والوصف)، وتحته سطر واحد يجمع العنوان والهاتف والبريد
          والسجل مفصولةً بنقاط — أهدأ للعين، ويحترم مفاتيح الإظهار كما هي.
        */}
        {/*
          الشعار والاسم عنصران مستقلّان يُرتَّبان، لا عنصر واحد ثابت الترتيب.

          الشعار في «الوسط» يأخذ سطراً لنفسه فوق الاسم — لا يُحشر في صفّ الاسم، لأن
          توسيط عنصرين في صفّ واحد يترك الاسم مزاحاً عن مركز الورقة بمقدار نصف عرض
          الشعار، وهو انزياح تراه العين ولا تعرف سببه.
        */}
        {logoPosition === 'center' ? (
          <>
            {hasLogo && (
              <div className="flex justify-center mb-2">
                <HeaderLogo config={config} />
              </div>
            )}
            <div className={`min-w-0 ${textAlignClass}`}>
              <HeaderTitle
                config={config}
                isEn={isEn}
                nameStyle={styleOf('company', t.company)}
                subStyle={styleOf('subtitle', t.subtitle)}
              />
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3">
            {hasLogo && logoPosition === 'start' && <HeaderLogo config={config} />}
            <div className={`min-w-0 flex-1 ${textAlignClass}`}>
              <HeaderTitle
                config={config}
                isEn={isEn}
                nameStyle={styleOf('company', t.company)}
                subStyle={styleOf('subtitle', t.subtitle)}
              />
            </div>
            {hasLogo && logoPosition === 'end' && <HeaderLogo config={config} />}
          </div>
        )}

        {contactInFooter || contactLine.length === 0 ? null : (
          <div
            className={`mt-1.5 opacity-75 flex flex-wrap items-center gap-x-2 gap-y-0.5 ${contactJustify}`}
            style={{ fontSize: t.label }}
          >
            <ContactParts parts={contactLine} />
          </div>
        )}
      </header>

      {/* ── Title + identity strip ──
          The document type, its number and its date are what an auditor looks for
          first, so they sit together on one line directly under the letterhead. */}
      {/*
          العنوان لا ينكسر أبداً.

          «سند قبض» كان يُطبع على سطرين — «سند» ثم «قبض» — لأن العنوان وشريط الأرقام
          يتقاسمان صفاً واحداً، فإذا طال رقم السند ضُغط العنوان حتى انكسر. الآن
          العنوان shrink-0 وبلا كسر، والشريط هو الذي يلتفّ عند الضيق.
      */}
      <div className="mt-4 flex items-end justify-between gap-x-4 gap-y-2 flex-wrap">
        <div className="shrink-0">
          <h1
            className="font-black tracking-tight whitespace-nowrap"
            style={styleOf('docTitle', t.docTitle, ink)}
          >
            {isEn
              ? isReceipt ? 'RECEIPT VOUCHER' : 'PAYMENT VOUCHER'
              : isReceipt ? 'سند قبض' : 'سند دفع'}
          </h1>
          {copyLabel && (
            <div className="mt-0.5 font-bold opacity-55" style={{ fontSize: t.label }}>
              {copyLabel}
            </div>
          )}
        </div>

        {/*
          رقم السند والتاريخ والوقت في سطر واحد لا تنكسر أجزاؤه.

          في التصميم السابق كانت هذه الثلاثة في صندوق ضيّق، فينقسم رقم مثل
          KAB-RV-2026-01029 على سطرين ويصطدم التاريخ بالوقت. هنا لكلّ منها
          whitespace-nowrap، والسطر كلّه يلتفّ إلى سطر تالٍ عند الضيق بدل أن
          تُقسَّم القيم نفسها — فالرقم المكسور لا يُقرأ ولا يُبحث عنه.

          و«الصندوق» عاد خياراً لا قاعدة: metaStyle = 'box' يرسم جدولاً صغيراً
          للتدقيق، وهو الشكل المألوف في دفاتر السندات — لكنه لا يضغط القيم لأن كل
          صف فيه سطر مستقلّ.
        */}
        {metaStyle === 'box' && !isThermal ? (
          <div className="shrink-0 border rounded-md overflow-hidden" style={{ borderColor: rule }}>
            {metaItems.map((m, i) => (
              <div
                key={m.label}
                className="flex items-center gap-2 px-2.5 py-1"
                style={{ ...styleOf('meta', t.label), borderTop: i > 0 ? `1px solid ${softRule}` : undefined }}
              >
                <span className="opacity-60 whitespace-nowrap">{m.label}</span>
                <span
                  className={`font-mono ${m.strong ? 'font-black' : 'font-bold'} ms-auto whitespace-nowrap`}
                  dir="ltr"
                >
                  {m.value}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div
            className="flex items-center gap-4 flex-wrap justify-end"
            style={styleOf('meta', t.label)}
          >
            {metaItems.map((m) => (
              <span key={m.label} className="whitespace-nowrap">
                <span className="opacity-60">{m.label}: </span>
                <span className={`font-mono ${m.strong ? 'font-black' : 'font-bold'}`} dir="ltr">
                  {m.value}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── The amount ──
          The one thing every reader wants, given the weight to match. It is stated
          once numerically and once in words; the words are the legal control. */}
      <div
        className={
          amountStyle === 'panel'
            ? 'mt-3 rounded-md px-3 py-2.5'
            : amountStyle === 'accent'
              ? 'mt-3 py-2.5 ps-3'
              : 'mt-3 border-y py-3'
        }
        style={
          amountStyle === 'panel'
            ? { backgroundColor: tint(ink, 0.06), border: `1px solid ${softRule}` }
            : amountStyle === 'accent'
              ? { borderInlineStart: `3px solid ${ink}`, backgroundColor: tint(ink, 0.04) }
              : { borderColor: rule }
        }
      >
        {/* المبلغ في وسط خانته (الافتراضي): على محور الصفحة حيث تقع العين أولاً،
            والتسمية فوقه صغيرة. و«الطرف» يُبقي الشكل القديم: تسمية في جهة ورقم في
            الجهة المقابلة. */}
        {(config.amountAlign || 'center') === 'center' ? (
          <div className="text-center">
            <div className="font-bold opacity-70" style={{ fontSize: t.label }}>
              {isEn ? 'Amount' : 'المبلغ'}
            </div>
            <div
              className="font-mono font-black tabular-nums lining-nums"
              style={{ ...styleOf('amount', t.amount, amountColor), whiteSpace: 'nowrap' }}
              dir="ltr"
            >
              {amountText}
            </div>
          </div>
        ) : (
          <div className="flex items-baseline justify-between gap-4">
            <span className="font-bold opacity-70" style={{ fontSize: t.label }}>
              {isEn ? 'Amount' : 'المبلغ'}
            </span>
            <span
              className="font-mono font-black tabular-nums lining-nums"
              style={{ ...styleOf('amount', t.amount, amountColor), whiteSpace: 'nowrap' }}
              dir="ltr"
            >
              {amountText}
            </span>
          </div>
        )}

        {tafqeetUnderAmount && tafqeetText && (
          <div
            className={`mt-1.5 pt-1.5 flex items-baseline gap-2 border-t ${
              (config.amountAlign || 'center') === 'center' ? 'justify-center flex-wrap text-center' : ''
            }`}
            style={{ borderColor: softRule, fontSize: t.label }}
          >
            <span className="opacity-60 shrink-0">{isEn ? 'In words' : 'وقدره كتابةً'}</span>
            <span className="font-bold break-words" style={styleOf('tafqeet', t.label, tafqeetColor)}>
              {tafqeetText}
            </span>
          </div>
        )}
      </div>

      {/* ── Fields ──
          A label column and a value column, aligned, with a hairline between rows.
          No card, no fill: the eye follows one vertical edge down the page.

          والأشكال الثلاثة ليست زينة: «الخطوط» أهدأ للسندات القصيرة، و«الشبكة» تُلزم
          كل قيمة بخانة مغلقة حين يُدقَّق السند ورقياً، و«المتناوب» يفيد حين تكثر
          الحقول فيصعب تتبّع الصف الواحد بالعين. */}
      <dl
        className={fieldStyle === 'lines' ? `mt-3 ${d.gap}` : 'mt-3'}
        style={
          fieldStyle === 'table'
            ? {
                border: `1.5px solid ${config.fieldBorderColor || rule}`,
                borderRadius: 6,
                overflow: 'hidden',
              }
            : undefined
        }
      >
        {rows.map((row, i) => {
          const labelText =
            (config.fieldLabels?.[row.key] || '').trim() || (isEn ? row.labelEn : row.label);
          const labelStyle = styleOf(['fieldLabel', `fieldLabel:${row.key}`], t.label, config.labelColor);
          const valueStyle = styleOf(['fieldValue', `fieldValue:${row.key}`], t.base);
          const mutedLabel = !(
            config.labelColor || pickStyle(['fieldLabel', `fieldLabel:${row.key}`]).color
          );
          const blank = String(row.value || '').trim().length === 0;
          const padY = config.fieldRowPadding;
          /* «تقسيم المبلغ» جدولاً — بسيطاً أو بطرفي قيد — مكان النص المسطور. */
          const valueNode =
            row.key === 'split' && splitAsGrid ? (
              <SplitEntryTable
                rows={entryRows}
                mode={splitStyle === 'entry' ? 'entry' : 'table'}
                isEn={isEn}
                labelSize={t.label}
                border={config.fieldBorderColor || softRule}
                headBg={config.fieldLabelBg || config.fieldBgColor || tint(ink, 0.05)}
              />
            ) : blank ? (
              <BlankLine />
            ) : (
              row.value
            );

          if (fieldStyle === 'table') {
            /* جدول بيانات مغلق: خانة تسمية مصبوغة وخانة قيمة، بفواصل كاملة —
               الشكل الذي تُدقَّق به السندات الورقية خانةً خانة. */
            return (
              <div
                key={row.key}
                className="grid"
                style={{
                  gridTemplateColumns: isThermal ? '1fr' : `${labelWidth}px 1fr`,
                  borderTop: i > 0 ? `1px solid ${config.fieldBorderColor || softRule}` : undefined,
                }}
              >
                <dt
                  className={`font-bold ${mutedLabel ? 'opacity-80' : ''}`}
                  style={{
                    ...labelStyle,
                    paddingTop: padY ?? 8,
                    paddingBottom: padY ?? 8,
                    paddingInline: 10,
                    backgroundColor: config.fieldLabelBg || config.fieldBgColor || tint(ink, 0.05),
                    borderInlineEnd: isThermal
                      ? undefined
                      : `1px solid ${config.fieldBorderColor || softRule}`,
                  }}
                >
                  {labelText}
                </dt>
                <dd
                  className="font-semibold break-words flex items-center"
                  style={{
                    ...valueStyle,
                    paddingTop: padY ?? 8,
                    paddingBottom: padY ?? 8,
                    paddingInline: 10,
                  }}
                >
                  {valueNode}
                </dd>
              </div>
            );
          }

          return (
            <div
              key={row.key}
              className={`grid gap-3 ${padY !== undefined ? '' : d.row} ${
                fieldStyle === 'grid' || fieldStyle === 'zebra' ? 'px-2' : ''
              }`}
              style={{
                gridTemplateColumns: isThermal ? '1fr' : `${labelWidth}px 1fr`,
                borderBottom: `1px solid ${softRule}`,
                borderInline: fieldStyle === 'grid' ? `1px solid ${softRule}` : undefined,
                borderTop: fieldStyle === 'grid' && i === 0 ? `1px solid ${softRule}` : undefined,
                backgroundColor: fieldStyle === 'zebra' && i % 2 === 1 ? tint(ink, 0.04) : undefined,
                paddingTop: padY,
                paddingBottom: padY,
              }}
            >
              {/* لون التسميات من القالب؛ وبدونه تُخفَّف بالشفافية كما كانت. */}
              <dt className={`font-bold ${mutedLabel ? 'opacity-65' : ''}`} style={labelStyle}>
                {labelText}
              </dt>
              <dd className="font-semibold break-words" style={valueStyle}>
                {valueNode}
              </dd>
            </div>
          );
        })}
      </dl>

      {/*
        الملاحظات — نصّ القالب لا نصّ السند.

        `notesText` يُكتب في إعدادات الطباعة («تم استلام المبلغ أعلاه نقداً… ويعتبر
        هذا السند حجة إثبات رسمية») ويُحفظ في القالب، ولم يكن يُطبع أبداً. وهو شرطٌ
        قانوني على الورقة لا تعليق داخلي، فمكانه فوق التواقيع مباشرةً — يُقرأ قبل
        أن يُوقَّع.
      */}
      {config.notesText && (
        <div
          className={`mt-3 rounded-md px-2.5 py-2 ${ts.notes?.color ? '' : 'opacity-80'}`}
          style={{
            ...styleOf('notes', t.label),
            border: `1px solid ${softRule}`,
            backgroundColor: tint(ink, 0.03),
          }}
        >
          {config.notesText}
        </div>
      )}

      {/*
        هنا ينتهي متن السند ويبدأ ذيله — والفراغ بينهما هو الذي يتمدّد.

        كانت التواقيع تلي آخر حقل مباشرةً ويتمدّد الفراغ بعدها، فيقع التذييل في قاع
        الورقة والتواقيع معلّقة في منتصفها وبينهما بياض طويل بلا معنى. والصواب
        محاسبياً أن عبارة الشكر والتواقيع والختم والتذييل كتلة ختامية واحدة ترسو
        معاً في أسفل الورقة، والبياض — إن كان — فبين الحقول والذيل حيث يُقرأ فاصلاً
        لا نسياناً.
      */}
      <div className="grow" style={{ minHeight: 16 }} aria-hidden="true" />

      {config.thankYouText && (
        <p
          className={`mt-4 text-center shrink-0 ${ts.thankYou?.color ? '' : 'opacity-70'}`}
          style={styleOf('thankYou', t.label)}
        >
          {config.thankYouText}
        </p>
      )}

      {/* ── Signatures and stamp ── */}
      {(signatures.length > 0 || config.showStamp || (config.showQrCode && showQrArea)) && (
        <div
          className={
            isThermal
              ? 'mt-6 flex flex-col items-center gap-4'
              : 'mt-8 flex items-end justify-between gap-6 flex-wrap'
          }
        >
          {config.showStamp && config.stampPosition === 'start' && (
            <StampBox config={config} labelSize={t.label} rule={rule} />
          )}

          {/* على ورق الحرارة يُطبع كل توقيع تحت الآخر: عرض 80mm لا يتّسع لعمودين،
              فتتكسّر التسمية على ثلاثة أسطر وتصير أعرض من الخط الذي تحتها. */}
          <div
            className={isThermal ? 'w-full space-y-4' : 'flex-1 grid gap-6'}
            style={
              isThermal
                ? undefined
                : { gridTemplateColumns: `repeat(${Math.max(1, signatures.length)}, minmax(0, 1fr))` }
            }
          >
            {signatures.map((title, i) =>
              config.signatureStyle === 'box' ? (
                <div key={i} className="rounded-md overflow-hidden" style={{ border: `1px solid ${rule}` }}>
                  <div
                    className={`px-2 py-1 font-bold text-center ${ts.signature?.color ? '' : 'opacity-75'}`}
                    style={{
                      ...styleOf('signature', t.label),
                      backgroundColor: tint(ink, 0.05),
                      borderBottom: `1px solid ${softRule}`,
                    }}
                  >
                    {title}
                  </div>
                  <div style={{ height: sigHeight }} />
                </div>
              ) : (
                <div key={i} className="text-center">
                  <div style={{ height: sigHeight }} />
                  <div className="border-t" style={{ borderColor: rule }} />
                  <div
                    className={`mt-1 font-bold ${ts.signature?.color ? '' : 'opacity-75'}`}
                    style={styleOf('signature', t.label)}
                  >
                    {title}
                  </div>
                </div>
              )
            )}
          </div>

          {config.showStamp && config.stampPosition !== 'start' && (
            <StampBox config={config} labelSize={t.label} rule={rule} />
          )}

          {config.showQrCode && showQrArea && (
            <div className="text-center shrink-0">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="" style={{ width: qrSize, height: qrSize }} />
              ) : (
                /**
                 * Placeholder — only ever drawn in the design preview.
                 *
                 * The real code is issued per counter-party by the server, so there is
                 * none to draw while someone is choosing colours. Without this the
                 * «إظهار QR» switch looked broken: it was doing exactly what it says,
                 * but the space it governs stayed empty either way. It is deliberately
                 * an empty outline rather than a fake pattern, so nobody mistakes it
                 * for a code that can be scanned.
                 */
                <div
                  className="flex items-center justify-center border border-dashed"
                  style={{ width: qrSize, height: qrSize, borderColor: rule, fontSize: 7, lineHeight: 1.3 }}
                >
                  <span className="opacity-60 px-1">{isEn ? 'QR' : 'رمز الكشف'}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/*
        التذييل: بيانات الاتصال أولاً (إن نزلت إليه) ثم سطر الحقوق.

        نزولُها إلى هنا يخفّف الترويسة إلى الهوية وحدها — شعار واسم — وهو تقليد
        المطبوعات الرسمية. ويُرسم التذييل ما دام فيه أحدهما، لا نصُّ الحقوق وحده.
      */}
      {(config.footerText || (contactInFooter && contactLine.length > 0)) && (
        <footer
          className={`mt-6 pt-2 border-t shrink-0 ${footerAlign} ${
            config.footerTextColor || ts.footer?.color ? '' : 'opacity-60'
          }`}
          style={{ ...styleOf('footer', t.label, config.footerTextColor), borderColor: softRule }}
        >
          {contactInFooter && contactLine.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5">
              <ContactParts parts={contactLine} />
            </div>
          )}
          {config.footerText && <div className={contactInFooter && contactLine.length > 0 ? 'mt-1' : ''}>{config.footerText}</div>}
        </footer>
      )}
    </>
  );

  const twoUp = config.copiesPerPage === 2 && !isThermal;
  const copyLabels = config.copyLabels?.length
    ? config.copyLabels
    : isEn
      ? ['Original', 'Copy']
      : ['النسخة الأصلية', 'نسخة العميل'];

  return (
    <div
      dir={isEn ? 'ltr' : 'rtl'}
      className="bg-white relative mx-auto flex flex-col"
      style={{
        width: paper.width,
        minHeight: paper.minHeight || undefined,
        padding: `${margin}mm`,
        fontFamily: `'${config.fontFamily || 'IBM Plex Sans Arabic'}', 'Tajawal', Arial, sans-serif`,
        fontSize: `${t.base}px`,
        lineHeight: 1.7,
        // لون المتن كله من القالب — العناوين والمبلغ والتسميات تكسوه بألوانها فوقه.
        color: config.textColor || '#0f172a',
      }}
    >
      {/* The watermark sits under the content at an opacity that survives printing
          without competing with it — a stamp, not a background. */}
      {config.showWatermark && config.watermarkText && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden"
          style={{ zIndex: 0 }}
          aria-hidden="true"
        >
          <span
            style={{
              transform: `rotate(${config.watermarkAngle ?? -24}deg)`,
              fontSize: config.watermarkSize || (isThermal ? 34 : 76),
              fontWeight: 900,
              color: config.watermarkColor || ink,
              opacity: config.watermarkOpacity ?? 0.055,
              whiteSpace: 'nowrap',
            }}
          >
            {config.watermarkText}
          </span>
        </div>
      )}

      {/*
        الورقة عمودٌ يملأ ارتفاعها، والتذييل في قاعه.

        كان التذييل يلي آخر عنصر قبله بمسافة ثابتة، فيقع في منتصف الورقة حين يكون
        السند قصيراً وعند حافتها حين يطول — أي يتحرّك بحسب عدد الحقول المعبّأة، وهو
        آخر ما ينبغي أن يتحرّك في مستند رسمي. الآن كل نسخة عمودٌ مرن، والفاصل قبل
        التذييل هو ما يتمدّد، فيثبت التذييل في أسفل الورقة دائماً.

        وعلى ورق الحرارة لا ارتفاع للورقة أصلاً (لفّة مستمرة)، فلا شيء يتمدّد
        والتذييل يتبع آخر سطر — وهو الصواب هناك.
      */}
      <div className="relative flex-1 flex flex-col" style={{ zIndex: 1 }}>
        {twoUp ? (
          <>
            <div className="flex-1 flex flex-col">{body(copyLabels[0])}</div>
            {/* خط القصّ — نقطي وواضح، فالنسختان تُفصلان بمقصّ لا بالتخمين. */}
            <div
              className="my-6 border-t border-dashed shrink-0"
              style={{ borderColor: rule }}
              aria-hidden="true"
            />
            <div className="flex-1 flex flex-col">{body(copyLabels[1])}</div>
          </>
        ) : (
          body()
        )}
      </div>
    </div>
  );
};

/**
 * جدول التقسيم — بشكليه.
 *
 * «جدول»: عمودان، الحساب ومبلغه، وسطر مجموع. و«قيد»: ثلاثة أعمدة بمدين ودائن
 * وسطر مجموع متوازن. البنية واحدة والفرق أعمدة فقط، فهما مكوّن واحد لا اثنان.
 */
const SplitEntryTable: React.FC<{
  rows: Array<{ name: string; debit: number; credit: number }>;
  mode: 'table' | 'entry';
  isEn: boolean;
  labelSize: number;
  border: string;
  headBg: string;
}> = ({ rows, mode, isEn, labelSize, border, headBg }) => {
  const totalDebit = rows.reduce((a, r) => a + r.debit, 0);
  const totalCredit = rows.reduce((a, r) => a + r.credit, 0);
  const cell: React.CSSProperties = { padding: '3px 8px', border: `1px solid ${border}` };
  const num: React.CSSProperties = { ...cell, textAlign: 'center', whiteSpace: 'nowrap' };
  const isEntry = mode === 'entry';
  return (
    <table
      className="w-full font-semibold"
      style={{ borderCollapse: 'collapse', fontSize: labelSize }}
    >
      <thead>
        <tr className="font-bold" style={{ backgroundColor: headBg }}>
          <th style={{ ...cell, textAlign: 'start' }}>{isEn ? 'Party' : 'الجهة'}</th>
          {isEntry ? (
            <>
              <th style={num}>{isEn ? 'Debit' : 'مدين'}</th>
              <th style={num}>{isEn ? 'Credit' : 'دائن'}</th>
            </>
          ) : (
            <th style={num}>{isEn ? 'Amount' : 'المبلغ'}</th>
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td style={{ ...cell, textAlign: 'start' }}>{r.name}</td>
            {isEntry ? (
              <>
                <td className="font-mono" dir="ltr" style={num}>
                  {r.debit ? money(r.debit) : '—'}
                </td>
                <td className="font-mono" dir="ltr" style={num}>
                  {r.credit ? money(r.credit) : '—'}
                </td>
              </>
            ) : (
              <td className="font-mono" dir="ltr" style={num}>
                {money(r.debit)}
              </td>
            )}
          </tr>
        ))}
        <tr className="font-bold" style={{ backgroundColor: headBg }}>
          <td style={{ ...cell, textAlign: 'start' }}>{isEn ? 'Total' : 'المجموع'}</td>
          {isEntry ? (
            <>
              <td className="font-mono" dir="ltr" style={num}>
                {money(totalDebit)}
              </td>
              <td className="font-mono" dir="ltr" style={num}>
                {money(totalCredit)}
              </td>
            </>
          ) : (
            <td className="font-mono" dir="ltr" style={num}>
              {money(totalDebit)}
            </td>
          )}
        </tr>
      </tbody>
    </table>
  );
};

/** فراغ صامت حيث يُطبع حقل فارغ عمداً — مساحة كتابة بلا أي خط يشغلها. */
const BlankLine: React.FC = () => (
  <span aria-hidden="true" className="block w-full" style={{ height: '1em' }} />
);

/** قيم سطر الاتصال مفصولةً بنقاط — تُرسم في الترويسة أو في التذييل سواء. */
const ContactParts: React.FC<{ parts: string[] }> = ({ parts }) => (
  <>
    {parts.map((part, i) => (
      <React.Fragment key={i}>
        {i > 0 && <span aria-hidden="true" className="opacity-50">·</span>}
        <span dir={/[A-Za-z0-9@+]/.test(part[0] || '') ? 'ltr' : undefined}>{part}</span>
      </React.Fragment>
    ))}
  </>
);

/** الشعار بمقاساته من القالب — مرسوماً في أي من مواضع الترويسة الثلاثة. */
const HeaderLogo: React.FC<{ config: VoucherSheetConfig }> = ({ config }) => (
  <img
    src={config.logoUrl}
    alt=""
    className="shrink-0"
    style={{
      height: config.logoHeight || 44,
      maxWidth: config.logoWidth || 180,
      objectFit: 'contain',
      borderRadius: config.logoBorderRadius || 0,
    }}
  />
);

/** اسم الشركة، ووصفها تحته إن طُلب صراحةً — كلٌّ بنمطه من القالب. */
const HeaderTitle: React.FC<{
  config: VoucherSheetConfig;
  isEn: boolean;
  nameStyle: React.CSSProperties;
  subStyle: React.CSSProperties;
}> = ({ config, isEn, nameStyle, subStyle }) => {
  const subtitle = isEn ? config.subtitleEn : config.subtitle;
  return (
    <>
      <div className="font-black leading-tight truncate" style={nameStyle}>
        {(isEn ? config.companyNameEn : config.companyName) || config.companyName || ''}
      </div>
      {config.showSubtitle === true && subtitle && (
        <div
          className={`truncate ${(subStyle as any).color ? '' : 'opacity-80'}`}
          style={subStyle}
        >
          {subtitle}
        </div>
      )}
    </>
  );
};

/** A dotted square, because a real stamp is placed by hand and needs the room. */
const StampBox: React.FC<{ config: VoucherSheetConfig; labelSize: number; rule: string }> = ({
  config,
  labelSize,
  rule,
}) => {
  const size = config.stampSize || 96;
  return (
    <div
      className="shrink-0 flex items-center justify-center rounded-md"
      style={{ width: size, height: size, border: `1.5px dashed ${rule}` }}
    >
      <span className="opacity-45 font-bold" style={{ fontSize: labelSize }}>
        {config.stampText || 'الختم'}
      </span>
    </div>
  );
};

export default FormalVoucherSheet;
