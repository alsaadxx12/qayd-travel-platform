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
 */

export interface VoucherSheetConfig {
  // ── Layout & density ──
  voucherPaperSize?: 'A4' | 'A5' | 'THERMAL80';
  density?: 'comfortable' | 'normal' | 'compact';
  marginMm?: number;
  copiesPerPage?: 1 | 2;

  // ── Header & logo ──
  voucherHeaderStyle?: 'band' | 'rule' | 'plain';
  logoPosition?: 'start' | 'center' | 'end';
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
  companyName?: string;
  companyNameEn?: string;
  subtitle?: string;
  subtitleEn?: string;
  showAddress?: boolean;
  showPhone?: boolean;
  showEmail?: boolean;
  showCommercialReg?: boolean;
  address?: string;
  phone?: string;
  email?: string;
  commercialReg?: string;

  // ── Fields: which appear, and in what order ──
  fieldOrder?: string[];
  hiddenFields?: string[];

  // ── Signatures, stamp, footer ──
  signatureTitles?: string[];
  /** التسميتان القديمتان — تُستعملان حين لا يُضبط signatureTitles. */
  payerSignTitle?: string;
  receiverSignTitle?: string;
  showSignatures?: boolean;
  showStamp?: boolean;
  stampPosition?: 'start' | 'center' | 'end';
  stampText?: string;
  footerText?: string;
  thankYouText?: string;
  showWatermark?: boolean;
  watermarkText?: string;

  // ── Ink ──
  primaryColor?: string;
  fontFamily?: string;
  showQrCode?: boolean;
}

/** Every field the voucher can show, in the order an accountant reads them. */
export const VOUCHER_FIELDS: Array<{ key: string; label: string; labelEn: string }> = [
  { key: 'party', label: 'استلمنا من السيد / السادة', labelEn: 'Received from' },
  { key: 'amountWords', label: 'المبلغ كتابةً', labelEn: 'Amount in words' },
  { key: 'reason', label: 'وذلك عن', labelEn: 'Being for' },
  { key: 'split', label: 'تقسيم المبلغ', labelEn: 'Allocation' },
  { key: 'paymentMethod', label: 'طريقة الاستلام', labelEn: 'Method' },
  { key: 'cashbox', label: 'الصندوق / الحساب المالي', labelEn: 'Cashbox' },
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

  const hidden = new Set(config.hiddenFields || []);
  const order = config.fieldOrder?.length ? config.fieldOrder : VOUCHER_FIELDS.map((f) => f.key);
  const fieldByKey = new Map(VOUCHER_FIELDS.map((f) => [f.key, f]));

  const currency = voucher.currency || 'IQD';
  const amountText = `${money(voucher.amount)} ${currency}`;
  const dateText = formatVoucherDate(voucher.date);
  const timeText = formatVoucherTime(voucher);

  /** سطر بيانات الاتصال — بالترتيب، وبلا خانات فارغة تترك نقاطاً معلّقة. */
  const contactLine = isThermal
    ? []
    : [
        config.showAddress !== false ? config.address : '',
        config.showPhone !== false ? config.phone : '',
        config.showEmail !== false ? config.email : '',
        config.showCommercialReg ? config.commercialReg : '',
      ]
        .map((v) => String(v || '').trim())
        .filter(Boolean);

  const values: Record<string, string> = {
    party: voucher.receivedFromOrPaidTo || voucher.accountName || '',
    amountWords: tafqeetArabic(voucher.amount || 0),
    reason: voucher.description || '',
    split:
      voucher.splitAccounts?.length
        ? voucher.splitAccounts
            .map((s) => `${s.accountName}: ${money(Number(s.amount) || 0)}`)
            .join('  ·  ')
        : voucher.splitDescription || '',
    paymentMethod: voucher.customCategory || '',
    cashbox: voucher.cashboxName || '',
    reference: voucher.reference || '',
    notes: voucher.costCenter || '',
  };

  const rows = order
    .filter((key) => !hidden.has(key) && fieldByKey.has(key))
    // An empty field on a printed voucher is a blank line with a label and nothing
    // after it, which reads as missing data rather than as absent data.
    .filter((key) => String(values[key] || '').trim().length > 0)
    .map((key) => ({ ...fieldByKey.get(key)!, value: values[key] }));

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
  ).filter((t) => String(t || '').trim().length > 0);

  const align =
    config.logoPosition === 'center'
      ? 'justify-center text-center'
      : config.logoPosition === 'end'
        ? 'justify-end'
        : 'justify-between';

  return (
    <div
      id="printable-voucher-sheet"
      dir={isEn ? 'ltr' : 'rtl'}
      className="bg-white text-slate-900 relative mx-auto"
      style={{
        width: paper.width,
        minHeight: paper.minHeight || undefined,
        padding: `${margin}mm`,
        fontFamily: `'${config.fontFamily || 'IBM Plex Sans Arabic'}', 'Tajawal', Arial, sans-serif`,
        fontSize: `${d.base}px`,
        lineHeight: 1.7,
      }}
    >
      {/* The watermark sits under the content at an opacity that survives printing
          without competing with it — a stamp, not a background. */}
      {config.showWatermark && config.watermarkText && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
          style={{ zIndex: 0 }}
          aria-hidden="true"
        >
          <span
            style={{
              transform: 'rotate(-24deg)',
              fontSize: isThermal ? 34 : 76,
              fontWeight: 900,
              color: ink,
              opacity: 0.055,
              whiteSpace: 'nowrap',
            }}
          >
            {config.watermarkText}
          </span>
        </div>
      )}

      <div className="relative" style={{ zIndex: 1 }}>
        {/* ── Header ── */}
        <header
          className={
            config.voucherHeaderStyle === 'band'
              ? 'px-3 py-2.5 rounded-md'
              : config.voucherHeaderStyle === 'plain'
                ? 'pb-2'
                : 'pb-2.5 border-b-2'
          }
          style={
            config.voucherHeaderStyle === 'band'
              ? { backgroundColor: ink, color: '#fff' }
              : config.voucherHeaderStyle === 'rule'
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
          <div className={`flex items-center gap-3 ${align}`}>
            {config.logoUrl && (
              <img
                src={config.logoUrl}
                alt=""
                className="shrink-0"
                style={{ height: config.logoHeight || 44, maxWidth: config.logoWidth || 180, objectFit: 'contain' }}
              />
            )}
            <div className="min-w-0">
              <div
                className="font-black leading-tight truncate"
                style={{ fontSize: isThermal ? 13 : 17 }}
              >
                {(isEn ? config.companyNameEn : config.companyName) || config.companyName || ''}
              </div>
              {(isEn ? config.subtitleEn : config.subtitle) && (
                <div className="opacity-80 truncate" style={{ fontSize: d.label }}>
                  {isEn ? config.subtitleEn : config.subtitle}
                </div>
              )}
            </div>
          </div>

          {contactLine.length > 0 && (
            <div
              className={`mt-1.5 opacity-75 flex flex-wrap gap-x-2 gap-y-0.5 ${align}`}
              style={{ fontSize: d.label }}
            >
              {contactLine.map((part, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span aria-hidden="true" className="opacity-50">·</span>}
                  <span dir={/[A-Za-z0-9@+]/.test(part[0] || '') ? 'ltr' : undefined}>{part}</span>
                </React.Fragment>
              ))}
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
        <div className="mt-4 flex items-end justify-between gap-x-4 gap-y-1 flex-wrap">
          <h1
            className="font-black tracking-tight shrink-0 whitespace-nowrap"
            style={{ fontSize: isThermal ? 15 : 21, color: ink }}
          >
            {isEn
              ? isReceipt ? 'RECEIPT VOUCHER' : 'PAYMENT VOUCHER'
              : isReceipt ? 'سند قبض' : 'سند دفع'}
          </h1>
          {/*
            رقم السند والتاريخ والوقت في سطر واحد لا تنكسر أجزاؤه.

            في التصميم السابق كانت هذه الثلاثة في صندوق ضيّق، فينقسم رقم مثل
            KAB-RV-2026-01029 على سطرين ويصطدم التاريخ بالوقت. هنا لكلّ منها
            whitespace-nowrap، والسطر كلّه يلتفّ إلى سطر تالٍ عند الضيق بدل أن
            تُقسَّم القيم نفسها — فالرقم المكسور لا يُقرأ ولا يُبحث عنه.
          */}
          <div className="flex items-center gap-4 flex-wrap justify-end" style={{ fontSize: d.label }}>
            <span className="whitespace-nowrap">
              <span className="opacity-60">{isEn ? 'No.' : 'رقم السند'}: </span>
              <span className="font-mono font-black" dir="ltr">{voucher.voucherNumber}</span>
            </span>
            <span className="whitespace-nowrap">
              <span className="opacity-60">{isEn ? 'Date' : 'التاريخ'}: </span>
              <span className="font-mono font-bold" dir="ltr">{dateText}</span>
            </span>
            {timeText && (
              <span className="whitespace-nowrap">
                <span className="opacity-60">{isEn ? 'Time' : 'الوقت'}: </span>
                <span className="font-mono font-bold" dir="ltr">{timeText}</span>
              </span>
            )}
          </div>
        </div>

        {/* ── The amount ──
            The one thing every reader wants, given the weight to match. It is stated
            once numerically and once in words; the words are the legal control. */}
        <div
          className="mt-3 flex items-baseline justify-between gap-4 border-y py-3"
          style={{ borderColor: '#CBD5E1' }}
        >
          <span className="font-bold opacity-70" style={{ fontSize: d.label }}>
            {isEn ? 'Amount' : 'المبلغ'}
          </span>
          <span
            className="font-mono font-black tabular-nums lining-nums"
            style={{ fontSize: isThermal ? 15 : 30, color: ink, whiteSpace: 'nowrap' }}
            dir="ltr"
          >
            {amountText}
          </span>
        </div>

        {/* ── Fields ──
            A label column and a value column, aligned, with a hairline between rows.
            No card, no fill: the eye follows one vertical edge down the page. */}
        <dl className={`mt-3 ${d.gap}`}>
          {rows.map((row) => (
            <div
              key={row.key}
              className={`grid gap-3 border-b ${d.row}`}
              style={{
                gridTemplateColumns: isThermal ? '1fr' : '150px 1fr',
                borderColor: '#E2E8F0',
              }}
            >
              <dt className="font-bold opacity-65" style={{ fontSize: d.label }}>
                {isEn ? row.labelEn : row.label}
              </dt>
              <dd className="font-semibold break-words">{row.value}</dd>
            </div>
          ))}
        </dl>

        {config.thankYouText && (
          <p className="mt-4 text-center opacity-70" style={{ fontSize: d.label }}>
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
            {config.showStamp && config.stampPosition === 'start' && <StampBox config={config} d={d} />}

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
              {signatures.map((title, i) => (
                <div key={i} className="text-center">
                  <div className="h-10" />
                  <div className="border-t" style={{ borderColor: '#94A3B8' }} />
                  <div className="mt-1 font-bold opacity-75" style={{ fontSize: d.label }}>
                    {title}
                  </div>
                </div>
              ))}
            </div>

            {config.showStamp && config.stampPosition !== 'start' && <StampBox config={config} d={d} />}

            {config.showQrCode && showQrArea && (
              <div className="text-center shrink-0">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="" style={{ width: 62, height: 62 }} />
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
                    style={{ width: 62, height: 62, borderColor: '#94A3B8', fontSize: 7, lineHeight: 1.3 }}
                  >
                    <span className="opacity-60 px-1">{isEn ? 'QR' : 'رمز الكشف'}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {config.footerText && (
          <footer
            className="mt-6 pt-2 border-t text-center opacity-60"
            style={{ borderColor: '#E2E8F0', fontSize: d.label }}
          >
            {config.footerText}
          </footer>
        )}
      </div>
    </div>
  );
};

/** A dotted square, because a real stamp is placed by hand and needs the room. */
const StampBox: React.FC<{ config: VoucherSheetConfig; d: { label: number } }> = ({ config, d }) => (
  <div
    className="shrink-0 flex items-center justify-center rounded-md"
    style={{ width: 96, height: 96, border: '1.5px dashed #CBD5E1' }}
  >
    <span className="opacity-45 font-bold" style={{ fontSize: d.label }}>
      {config.stampText || 'الختم'}
    </span>
  </div>
);

export default FormalVoucherSheet;
