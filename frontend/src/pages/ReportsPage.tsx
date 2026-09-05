import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { AccountingGrid, AccountingColumnDef, AccountingActionMenuItem } from '../components/common/AccountingGrid';
import { AccountingDateRangePicker } from '../components/common/date/AccountingDateRangePicker';
import {
  Paper,
  Badge,
  Drawer,
  Tabs,
  Switch,
  Tooltip,
  Menu,
  Modal,
  Loader,
} from '@mantine/core';
import {
  IconSearch,
  IconFileText,
  IconReceipt,
  IconCreditCard,
  IconNotebook,
  IconArrowsExchange,
  IconReportMoney,
  IconPlane,
  IconId,
  IconUsers,
  IconReceiptRefund,
  IconReplace,
  IconBuilding,
  IconFilter,
  IconX,
  IconChevronDown,
  IconScale,
  IconHistory,
  IconPrinter,
  IconFileTypePdf,
  IconFileSpreadsheet,
  IconDotsVertical,
  IconRefresh,
  IconCopy,
  IconUser,
  IconUserCheck,
  IconLock,
  IconRoute,
  IconWallet,
  IconArrowUpRight,
  IconArrowDownLeft,
  IconAdjustmentsHorizontal,
  IconTicket,
  IconPlus,
  IconEdit,
  IconTrash,
  IconAlertTriangle,
  IconLink,
  IconCheck,
} from '@tabler/icons-react';
import * as XLSX from 'xlsx';
import { showSuccessNotification, showErrorNotification } from '../utils/notifications';
import {
  AccountStatementPrintModal,
  AccountStatementQuickExportModal,
} from '../components/reports/AccountStatementPrintModal';
import { FinancialVoucherForm } from '../components/vouchers/FinancialVoucherForm';
import { TicketInvoiceEditorWorkspace } from '../components/tickets/TicketInvoiceEditorWorkspace';
// نافذة الفيزا ثقيلة ولا تُفتح إلا حين يكون المستند تأشيرة، فتُحمَّل عند الطلب.
const VisaInvoiceEditorWorkspace = React.lazy(() =>
  import('../components/visas/VisaInvoiceEditorWorkspace').then((m) => ({
    default: m.VisaInvoiceEditorWorkspace,
  }))
);
import { ticketsApi } from '../api/tickets';
import { useLanguageStore } from '../store/useLanguageStore';

// Helper: format date as YYYY-MM-DD
const formatDate = (d: Date) => d.toISOString().split('T')[0];
// The statement opens on the running fiscal year; anything older is summarised into a
// carried-forward line, so the closing balance still matches the account.
const fiscalYearStart = () => `${new Date().getFullYear()}-01-01`;
const fiscalYearEnd = () => `${new Date().getFullYear()}-12-31`;

// Statement movements are ordered by when they were entered into the system, not by
// the document date, so anything recorded now is always the last row of the ledger.
const compareByEntryOrder = (a: any, b: any) => {
  const timeOf = (m: any) => {
    const entered = new Date(m?.entryDate || m?.date || 0).getTime();
    return Number.isNaN(entered) ? 0 : entered;
  };
  const diff = timeOf(a) - timeOf(b);
  if (diff !== 0) return diff;
  const numA = String(a.voucherNumber || a.entryNumber || a.id || '');
  const numB = String(b.voucherNumber || b.entryNumber || b.id || '');
  return numA.localeCompare(numB, undefined, { numeric: true });
};

// The stored timestamps are UTC midnight, so reading the calendar day off the raw
// string keeps a document dated 01/08 from sliding into 31/07 on the local clock.
const toDayKey = (value?: any): string => {
  if (!value) return '';
  if (typeof value === 'string') {
    const direct = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (direct) return `${direct[1]}-${direct[2]}-${direct[3]}`;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return formatDate(new Date(d.getTime() - d.getTimezoneOffset() * 60000));
};

// Helper: Extract concise IATA airport codes
const formatRouteCodesOnly = (rawRoute?: string): string => {
  if (!rawRoute) return '';
  const matches = rawRoute.match(/\b[A-Za-z]{3}\b/g);
  if (matches && matches.length >= 2) {
    const codes: string[] = [];
    matches.forEach((m) => {
      const upper = m.toUpperCase();
      if (codes[codes.length - 1] !== upper) {
        codes.push(upper);
      }
    });
    if (codes.length >= 2) return codes.join(' ➔ ');
  }
  if (matches && matches.length === 1) return matches[0].toUpperCase();
  return rawRoute
    .replace(/\(.*?\)/g, '')
    .split(/[-–—→>]/)
    .map((s) => s.trim().substring(0, 3).toUpperCase())
    .filter(Boolean)
    .join(' ➔ ');
};

/*
 * نوع المستند يُقرأ من الخدمة التي وُلد عنها، لا من نصّ القيد.
 *
 * كان كل قيد ناشئ عن تذكرة يظهر في عمود «المستند ونوعه» باسم «قيد يومية»، فيقرأ
 * صاحبُ الكشف صفَّ تذكرةٍ ولا يعرف أنها تذكرة، ثم يفتحه فتنفتح له نافذة سندٍ لا
 * صلة لها بالمستند. والقيد نفسه يحمل مصدره — sourceType وsourceId — فمنهما
 * يُشتقّ النوع، ومن رقم الفاتورة والقيد حين يكون القيد قديماً بلا مصدر مسجَّل.
 */
export type ServiceKind = 'TICKET' | 'VISA' | 'HOTEL' | 'REISSUE' | 'REFUND' | 'GROUP' | 'BAGGAGE';

const SERVICE_KIND_LABEL: Record<ServiceKind, { ar: string; en: string }> = {
  TICKET: { ar: 'تذاكر', en: 'Tickets' },
  VISA: { ar: 'تأشيرة', en: 'Visa' },
  HOTEL: { ar: 'فندق', en: 'Hotel' },
  REISSUE: { ar: 'تغيير', en: 'Reissue' },
  REFUND: { ar: 'استرجاع', en: 'Refund' },
  GROUP: { ar: 'كروب', en: 'Group' },
  BAGGAGE: { ar: 'وزن', en: 'Baggage' },
};

const SERVICE_SOURCE_TYPES = new Set(['TICKET', 'VISA', 'HOTEL', 'REISSUE', 'REFUND', 'GROUP', 'BAGGAGE']);

const serviceKindLabel = (kind: ServiceKind, isAr: boolean) => {
  const entry = SERVICE_KIND_LABEL[kind] || SERVICE_KIND_LABEL.TICKET;
  return isAr ? entry.ar : entry.en;
};

const resolveServiceKind = (ticket?: any, sourceType?: string, docHint?: string): ServiceKind => {
  const src = String(sourceType || '').toUpperCase();
  const trip = String(ticket?.tripType || '').toUpperCase();
  const status = String(ticket?.status || '').toUpperCase();
  // أرقام الفواتير والقيود تحمل بادئة نوعها (REF- للاسترجاع، REIS-/CHG- للتغيير)،
  // وهي الملاذ حين يسبق القيدُ تسجيلَ نوع المصدر في القاعدة.
  const codes = `${ticket?.invoiceNumber || ''} ${docHint || ''}`.toUpperCase();

  if (src === 'REFUND' || trip === 'REFUND' || status === 'REFUNDED' || /(^|[^A-Z])REF-/.test(codes)) return 'REFUND';
  if (src === 'REISSUE' || trip === 'REISSUE' || trip === 'CHANGE' || /(^|[^A-Z])(REIS|CHG)-/.test(codes)) return 'REISSUE';
  if (src === 'HOTEL' || trip === 'HOTEL') return 'HOTEL';
  if (src === 'BAGGAGE' || trip === 'BAGGAGE') return 'BAGGAGE';
  if (src === 'VISA' || trip === 'VISA') return 'VISA';
  if (src === 'GROUP' || trip === 'GROUP') return 'GROUP';
  return 'TICKET';
};

/*
 * سطر السداد يتبع فاتورته مباشرة، كفرعٍ تحت أصله في الشجرة.
 *
 * بيعُ التذكرة نقداً يُنتج سطرين على حساب العميل: قيمة الفاتورة مديناً، ثم
 * سدادها دائناً. وما دام الكشف يُرتَّب زمنياً فحسب، فقد ينزلق بينهما سطرٌ ثالث
 * — سندٌ في اللحظة نفسها مثلاً — فينقطع السداد عن فاتورته ويقرأ المحاسب رقمين
 * لا يعرف أنهما وجهان لعملية واحدة. هنا يُعاد ترتيب المصفوفة المرتَّبة فيُلحَق
 * كل سداد بأبيه فوراً، ويُترك في موضعه الزمني وحده إن غاب أبوه عن التصفية.
 */
const groupServiceSettlements = (rows: any[]): any[] => {
  const present = new Set(rows.map((r) => r.id));
  const children = new Map<string, any[]>();

  rows.forEach((r) => {
    if (r.parentRowId && present.has(r.parentRowId)) {
      const list = children.get(r.parentRowId) || [];
      list.push(r);
      children.set(r.parentRowId, list);
    }
  });

  if (!children.size) return rows;

  const out: any[] = [];
  rows.forEach((r) => {
    if (r.parentRowId && present.has(r.parentRowId)) return; // يخرج ملحقاً بأبيه
    out.push(r);
    (children.get(r.id) || []).forEach((child) => out.push(child));
  });
  return out;
};

// تفاصيل الرحلة تُنتزع من التذكرة نفسها لتُعرض تحت بيان الحركة في الكشف.
const ticketDetailsOf = (ticket: any) => {
  if (!ticket) return null;
  const passengers = (ticket.passengers || []).map((p: any) => ({
    name: p.name || p.passenger || '',
    ticketNumber: p.ticketNumber || p.documentNumber || '',
    ticketType: p.ticketType || p.type || '',
  })).filter((p: any) => p.name);

  const pnr = ticket.pnr || ticket.reference || '';
  const route = ticket.fullRouteText || ticket.route || '';
  const airline = ticket.airline || '';
  if (!passengers.length && !pnr && !route && !airline) return null;
  return { passengers, pnr, route, airline };
};

/** ما يُكتب في عمود «النوع» بالكشف المطبوع، بالكلمات التي يستعملها المحاسب. */
const SERVICE_TYPE_LABEL_AR: Record<ServiceKind, string> = {
  TICKET: 'تذكرة',
  VISA: 'فيزا',
  HOTEL: 'فنادق',
  REISSUE: 'تغيير',
  REFUND: 'استرجاع',
  GROUP: 'كروب',
  BAGGAGE: 'وزن إضافي',
};

const SERVICE_WORD: Record<ServiceKind, { one: string; many: string }> = {
  TICKET: { one: 'تذكرة', many: 'التذاكر' },
  VISA: { one: 'تأشيرة', many: 'التأشيرات' },
  HOTEL: { one: 'حجز فندق', many: 'حجوزات الفنادق' },
  REISSUE: { one: 'تغيير', many: 'التغييرات' },
  REFUND: { one: 'استرجاع', many: 'الاسترجاعات' },
  GROUP: { one: 'كروب', many: 'الكروبات' },
  BAGGAGE: { one: 'وزن إضافي', many: 'الأوزان الإضافية' },
};

/*
 * البيان يُسمّي الخدمة باسمها، ولا يعيد اسم صاحب الكشف عليه.
 *
 * القيود المولَّدة تكتب «تذكرة/تأشيرة» احتياطاً لأنها لا تعرف أيّهما، فيقرأ
 * صاحبُ تذكرةٍ كلمة تأشيرة لا معنى لها عنده. ونحن نعرف نوع الخدمة من مصدر
 * القيد، فيُستبدل الاحتياط باسمه الصحيح.
 *
 * ويُنزع اسم الحساب من النص لأن الكشف كلّه له: تكراره في كل سطر حشوٌ يزاحم
 * التفاصيل التي تنفع — المسافر والمسار ورقم التذكرة.
 */
const cleanStatementText = (
  text?: string,
  kind?: ServiceKind | null,
  ...accountNames: Array<string | undefined>
): string => {
  let out = String(text || '');

  if (kind && SERVICE_WORD[kind]) {
    out = out
      .split('تذكرة/تأشيرة').join(SERVICE_WORD[kind].one)
      .split('التذاكر/التأشيرات').join(SERVICE_WORD[kind].many)
      .split('تذاكر/تأشيرات').join(SERVICE_WORD[kind].many);
  }

  let removed = false;
  Array.from(new Set(accountNames.map((n) => String(n || '').trim()).filter((n) => n.length >= 3)))
    .sort((a, b) => b.length - a.length)
    .forEach((name) => {
      const wrapped = `(${name})`;
      if (out.includes(wrapped)) {
        out = out.split(wrapped).join('');
        removed = true;
      }
      if (out.includes(name)) {
        out = out.split(name).join('');
        removed = true;
      }
    });

  if (!removed) return out.trim();

  return out
    .replace(/\(\s*\)/g, '')
    .replace(/[-–—]\s*(?=\s|$|\))/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s+([,،.])/g, '$1')
    .trim();
};

/*
 * رقم المستند يُنزع من البيان لأن له عموداً.
 *
 * كان الرقم يُكتب ثلاث مرات في الصف الواحد: تحت التاريخ، وداخل نص البيان، وفي
 * رقم القيد الذي يحويه بدوره. فأُفرد له عمود، ويُحذف من النص هنا مع الشَّرطة
 * التي كانت تسبقه والقوس الفارغ الذي قد يخلّفه — والتنظيف لا يجري إلا إذا حُذف
 * شيء فعلاً، كي لا تُمسّ شَرطةٌ في بيانٍ لا رقم فيه.
 */
const stripDocNumber = (text?: string, ...codes: Array<string | undefined>): string => {
  let out = String(text || '');
  let removed = false;

  Array.from(new Set(codes.map((c) => String(c || '').trim()).filter((c) => c.length >= 4)))
    .sort((a, b) => b.length - a.length) // الأطول أولاً كي لا يُبقي الأقصرُ بقيّةً منه
    .forEach((code) => {
      if (!out.includes(code)) return;
      out = out.split(code).join('');
      removed = true;
    });

  if (!removed) return out.trim();

  return out
    .replace(/[-–—]\s*(?=\s|$|\))/g, ' ')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim();
};

/*
 * أرقام الفواتير والمراجع تبقى كتلة واحدة.
 *
 * المتصفّح يكسر السطر بعد أي شَرطة، فينقسم «KAB-TKT-2026-01001» نصفين ويقرأه
 * القارئ رقمين. وهذه الرموز لاتينية داخل نصٍّ عربي، فتُعزل باتجاهها الخاص
 * أيضاً كي تُرتَّب خاناتها كما كُتبت.
 */
const NoBreakCodes: React.FC<{ text?: string }> = ({ text }) => (
  <>
    {String(text || '')
      .split(/(\s+)/)
      .map((token, i) =>
        /[A-Za-z0-9]/.test(token) && /[-/]/.test(token) ? (
          <span key={i} className="whitespace-nowrap" dir="ltr">
            {token}
          </span>
        ) : (
          <React.Fragment key={i}>{token}</React.Fragment>
        )
      )}
  </>
);

/*
 * شريط تفاصيل الرحلة: الـPNR والمسار والمسافرون تحت بيان الحركة.
 *
 * سطرُ القيد يقول «قيمة مبيعات تذكرة» ولا يقول لمن ولا إلى أين — فيضطر القارئ
 * إلى فتح التذكرة ليعرف. وهذه التفاصيل موجودة في السجل المرتبط أصلاً، فتُعرض
 * حيث تُقرأ.
 */
const CHIP = 'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap shrink-0';

/*
 * قيمة تُنسخ بنقرة.
 *
 * أسماء المسافرين وأرقام تذاكرهم تُنقل إلى نظام شركة الطيران أو إلى محادثة مع
 * العميل، وكتابتها يدوياً بابُ خطأ لا داعي له. فكل قيمة زرٌّ ينسخ نفسه ويُظهر
 * علامة صحّ لحظةً ليعرف الناسخ أن النسخ تمّ.
 */
const CopyValue: React.FC<{ value: string; label?: string; title: string; className?: string }> = ({
  value,
  label,
  title,
  className = '',
}) => {
  const [done, setDone] = React.useState(false);
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value).then(
          () => {
            setDone(true);
            window.setTimeout(() => setDone(false), 1400);
          },
          () => undefined
        );
      }}
      className={`inline-flex items-center gap-1 cursor-pointer hover:bg-black/5 rounded px-0.5 transition-colors whitespace-nowrap ${className}`}
    >
      <span className="whitespace-nowrap">{label ?? value}</span>
      {done ? (
        <IconCheck size={10} className="text-emerald-600 shrink-0" />
      ) : (
        <IconCopy size={10} className="opacity-45 shrink-0" />
      )}
    </button>
  );
};

const TicketDetailStrip: React.FC<{ details: any; isAr: boolean }> = ({ details, isAr }) => {
  if (!details) return null;
  const { passengers = [], pnr, route, airline } = details;
  const routeClean = formatRouteCodesOnly(route);
  if (!passengers.length && !pnr && !routeClean && !airline) return null;

  /*
   * الشرائح لا تلتوي.
   *
   * الاسم اللاتيني ورقم التذكرة كانا ينكسران في منتصفهما داخل عمودٍ ضيّق، فيُقرأ
   * «RAJAA AL / KHALEDI» سطرين و«512- / 2300832814» رقمين. لذلك كل شريحة كتلةٌ
   * لا تُكسر (whitespace-nowrap + shrink-0)، وحين يضيق العمود تنتقل الشريحةُ
   * كاملةً إلى السطر التالي بدل أن ينشقّ ما بداخلها.
   */
  return (
    <div className="space-y-1 pt-0.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        {pnr && (
          <span className={`${CHIP} bg-slate-900 text-white font-mono`} dir="ltr">
            <CopyValue
              value={String(pnr)}
              label={`PNR: ${pnr}`}
              title={isAr ? 'نسخ الـ PNR' : 'Copy PNR'}
              className="hover:bg-white/15 text-white"
            />
          </span>
        )}
        {routeClean && (
          <span className={`${CHIP} font-mono text-emerald-900 bg-emerald-50 border border-emerald-200`} dir="ltr">
            <IconRoute size={11} className="text-emerald-700 shrink-0" />
            {routeClean}
          </span>
        )}
        {airline && (
          <span className={`${CHIP} text-sky-900 bg-sky-50 border border-sky-200`}>
            <IconPlane size={11} className="text-sky-700 shrink-0" />
            {airline}
          </span>
        )}
        {passengers.length > 0 && (
          <span className={`${CHIP} bg-indigo-50 text-indigo-900 border border-indigo-200`}>
            <IconUsers size={11} className="text-indigo-600 shrink-0" />
            {isAr ? 'العدد' : 'Pax'}
            <span className="w-3.5 h-3.5 rounded-full bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center font-mono">
              {passengers.length}
            </span>
          </span>
        )}
      </div>

      {passengers.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {passengers.map((pass: any, idx: number) => (
            <span
              key={idx}
              dir="ltr"
              className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200/70 rounded-md px-1.5 py-0.5 text-[10.5px] font-mono font-bold text-slate-800 whitespace-nowrap shrink-0"
            >
              <IconUser size={10} className="text-indigo-500 shrink-0" />
              <CopyValue
                value={String(pass.name).trim()}
                title={isAr ? 'نسخ اسم المسافر' : 'Copy passenger name'}
                className="text-slate-900"
              />
              {pass.ticketType && (
                <span className="text-[9px] font-bold text-indigo-700 bg-indigo-100/70 px-1 rounded whitespace-nowrap">
                  {pass.ticketType}
                </span>
              )}
              {pass.ticketNumber && (
                <CopyValue
                  value={String(pass.ticketNumber)}
                  label={`#${pass.ticketNumber}`}
                  title={isAr ? 'نسخ رقم التذكرة' : 'Copy ticket number'}
                  className="text-[9.5px] text-slate-600 bg-white rounded border border-slate-200"
                />
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

/*
 * وصلة الشجرة: زاويةٌ مرسومة تربط سطر السداد بالفاتورة التي فوقه.
 * تُبنى بخصائص CSS المنطقية لتنقلب مع اتجاه الصفحة بلا شرطٍ في الشيفرة.
 */
const SettlementBranch: React.FC = () => (
  <div
    aria-hidden
    className="shrink-0"
    style={{
      width: 16,
      height: 12,
      marginTop: 5,
      marginInlineStart: 4,
      borderInlineStart: '2px solid #cbd5e1',
      borderBottom: '2px solid #cbd5e1',
      borderEndStartRadius: 8,
    }}
  />
);

export const ReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  // ── Filter categories with Bilingual labels ──
  const MOVEMENT_FILTERS = useMemo(
    () => [
      { key: 'receipt', label: isAr ? 'القبض' : 'Receipts', icon: IconReceipt, color: '#059669' },
      { key: 'payment', label: isAr ? 'الدفع' : 'Payments', icon: IconCreditCard, color: '#dc2626' },
      { key: 'journal', label: isAr ? 'القيد' : 'Journals', icon: IconNotebook, color: '#2563eb' },
      { key: 'exchange', label: isAr ? 'الصرافة' : 'Exchange / FX', icon: IconArrowsExchange, color: '#7c3aed' },
      { key: 'expense', label: isAr ? 'المصاريف' : 'Expenses', icon: IconReportMoney, color: '#ea580c' },
    ],
    [isAr]
  );

  const BALANCE_FILTERS = useMemo(
    () => [
      { key: 'openingBalance', label: isAr ? 'الرصيد الافتتاحي' : 'Opening Balance', icon: IconScale, color: '#92400e' },
      { key: 'previousBalance', label: isAr ? 'رصيد سابق' : 'Previous Balance', icon: IconHistory, color: '#78350f' },
    ],
    [isAr]
  );

  const SERVICE_FILTERS = useMemo(
    () => [
      { key: 'tickets', label: isAr ? 'التذاكر' : 'Tickets', icon: IconPlane, color: '#0891b2' },
      { key: 'visa', label: isAr ? 'الفيزا' : 'Visas', icon: IconId, color: '#4f46e5' },
      { key: 'groups', label: isAr ? 'الكروبات' : 'Groups', icon: IconUsers, color: '#0d9488' },
      { key: 'refunds', label: isAr ? 'الاسترجاعات' : 'Refunds', icon: IconReceiptRefund, color: '#e11d48' },
      { key: 'changes', label: isAr ? 'التغييرات' : 'Reissues', icon: IconReplace, color: '#ca8a04' },
      { key: 'hotels', label: isAr ? 'الفنادق' : 'Hotels', icon: IconBuilding, color: '#7c3aed' },
    ],
    [isAr]
  );

  // ── Core State ──
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [accountSearch, setAccountSearch] = useState('');
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [startDate, setStartDate] = useState(fiscalYearStart());
  const [endDate, setEndDate] = useState(fiscalYearEnd());
  const [currency, setCurrency] = useState<string>('ALL');

  // Auto-Select Account from URL Params
  useEffect(() => {
    const paramAccId = searchParams.get('accountId') || (location.state as any)?.accountId;
    const paramCurrency = searchParams.get('currency') || (location.state as any)?.currency || 'ALL';

    if (paramAccId) {
      setSelectedAccountId(paramAccId);
      setCurrency(paramCurrency || 'ALL');
    }
  }, [location.state, searchParams]);

  // Sync Search Input box text
  useEffect(() => {
    if (selectedAccountId && accounts.length > 0) {
      const matched = accounts.find((a) => a.id === selectedAccountId || a.code === selectedAccountId);
      if (matched) {
        setAccountSearch(isAr ? matched.nameAr : (matched.nameEn || matched.nameAr));
      }
    }
  }, [selectedAccountId, accounts, isAr]);

  const [statementMovements, setStatementMovements] = useState<any[]>([]);
  const [selectedMovement, setSelectedMovement] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [innerSearch, setInnerSearch] = useState('');
  const [filtersVisible, setFiltersVisible] = useState(true);
  const [printModalOpened, setPrintModalOpened] = useState(false);
  const [quickExportModalOpened, setQuickExportModalOpened] = useState(false);
  const [voucherModalOpened, setVoucherModalOpened] = useState(false);
  const [voucherModalType, setVoucherModalType] = useState<'RECEIPT' | 'PAYMENT' | 'EXCHANGE' | 'JOURNAL'>('RECEIPT');
  const [editVoucherId, setEditVoucherId] = useState<string | undefined>(undefined);
  const [ticketModalOpened, setTicketModalOpened] = useState(false);
  const [editingTicketData, setEditingTicketData] = useState<any | null>(null);
  const [visaModalOpened, setVisaModalOpened] = useState(false);
  const [editingVisaData, setEditingVisaData] = useState<any | null>(null);
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingRow, setDeletingRow] = useState(false);
  // ── Sidebar Toggle Filters ──
  const [activeFilters, setActiveFilters] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    [
      { key: 'receipt' },
      { key: 'payment' },
      { key: 'journal' },
      { key: 'exchange' },
      { key: 'expense' },
      { key: 'tickets' },
      { key: 'visa' },
      { key: 'groups' },
      { key: 'refunds' },
      { key: 'changes' },
      { key: 'hotels' },
      { key: 'openingBalance' },
      { key: 'previousBalance' },
    ].forEach((f) => {
      init[f.key] = true;
    });
    return init;
  });

  const toggleFilter = useCallback((key: string) => {
    setActiveFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const toggleAllMovements = useCallback((on: boolean) => {
    setActiveFilters((prev) => {
      const next = { ...prev };
      ['receipt', 'payment', 'journal', 'exchange', 'expense'].forEach((k) => {
        next[k] = on;
      });
      return next;
    });
  }, []);

  const toggleAllServices = useCallback((on: boolean) => {
    setActiveFilters((prev) => {
      const next = { ...prev };
      ['tickets', 'visa', 'groups', 'refunds', 'changes', 'hotels'].forEach((k) => {
        next[k] = on;
      });
      return next;
    });
  }, []);

  // ── Load accounts from DB ──
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const accs = await apiRequest('/api/accounts');
        setAccounts(accs || []);
      } catch (err) {
        console.error('Error loading accounts:', err);
      }
    };
    fetchAccounts();
  }, []);

  // ── Filtered account list for search ──
  const filteredAccounts = useMemo(() => {
    if (!accountSearch.trim()) return accounts.filter((a) => !a.isGroup);
    const q = accountSearch.trim().toLowerCase();
    return accounts.filter(
      (a) =>
        !a.isGroup &&
        ((a.nameAr || '').toLowerCase().includes(q) ||
          (a.code || '').includes(q) ||
          (a.nameEn || '').toLowerCase().includes(q))
    );
  }, [accounts, accountSearch]);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === selectedAccountId),
    [accounts, selectedAccountId]
  );

  // Categorize movement by docType / voucherType
  const categorizeMovement = useCallback((m: any): string => {
    const vt = (m.voucherType || '').toUpperCase();
    if (vt === 'TICKET' || vt === 'FLIGHT') return 'tickets';
    if (vt === 'VISA') return 'visa';
    if (vt === 'GROUP') return 'groups';
    if (vt === 'REFUND') return 'refunds';
    if (vt === 'REISSUE') return 'changes';
    if (vt === 'HOTEL') return 'hotels';
    if (vt === 'EXCHANGE' || vt === 'FX') return 'exchange';
    if (vt === 'EXPENSE') return 'expense';
    if (vt === 'RECEIPT') return 'receipt';
    if (vt === 'PAYMENT') return 'payment';

    // القيد الناشئ عن خدمة يُصنَّف بخدمته لا بنصّه، فتعمل مفاتيح «الخدمات» عليه.
    const sk = String(m.serviceKind || '').toUpperCase();
    if (sk === 'TICKET') return 'tickets';
    if (sk === 'VISA') return 'visa';
    if (sk === 'GROUP') return 'groups';
    if (sk === 'REFUND') return 'refunds';
    if (sk === 'REISSUE') return 'changes';
    if (sk === 'HOTEL') return 'hotels';

    const dt = (m.docType || '').toLowerCase();
    if (dt.includes('تذكر') || dt.includes('طيران') || dt.includes('ticket')) return 'tickets';
    if (dt.includes('فيزا') || dt.includes('visa')) return 'visa';
    if (dt.includes('كروب') || dt.includes('group')) return 'groups';
    if (dt.includes('استرجاع') || dt.includes('refund')) return 'refunds';
    if (dt.includes('تغيير') || dt.includes('change')) return 'changes';
    if (dt.includes('فندق') || dt.includes('hotel')) return 'hotels';
    if (dt.includes('قبض') || dt.includes('receipt')) return 'receipt';
    if (dt.includes('دفع') || dt.includes('payment')) return 'payment';
    if (dt.includes('صرافة') || dt.includes('exchange')) return 'exchange';
    if (dt.includes('مصاريف') || dt.includes('expense')) return 'expense';

    const desc = `${m.description || ''} ${m.accountingDescription || ''}`.toLowerCase();
    if (desc.includes('تذكر') || desc.includes('طيران') || desc.includes('ticket')) return 'tickets';
    if (desc.includes('فيزا') || desc.includes('visa')) return 'visa';
    if (desc.includes('كروب') || desc.includes('group')) return 'groups';
    if (desc.includes('استرجاع') || desc.includes('refund')) return 'refunds';
    if (desc.includes('تغيير') || desc.includes('change')) return 'changes';
    if (desc.includes('فندق') || desc.includes('hotel')) return 'hotels';
    if (desc.includes('صراف') || desc.includes('تحويل عملة') || desc.includes('exchange') || desc.includes(' fx ')) return 'exchange';
    if (desc.includes('مصروف') || desc.includes('مصاريف') || desc.includes('expense')) return 'expense';
    return 'journal';
  }, []);

  // Selected period boundaries, compared on calendar days so the picker's optional
  // time part never trims a whole document out of the range.
  const rangeStartDay = useMemo(() => toDayKey(startDate), [startDate]);
  const rangeEndDay = useMemo(() => toDayKey(endDate), [endDate]);

  const movementDayKey = useCallback((m: any) => toDayKey(m?.date || m?.entryDate), []);

  const isWithinRange = useCallback(
    (m: any) => {
      const day = movementDayKey(m);
      if (!day) return true;
      if (rangeStartDay && day < rangeStartDay) return false;
      if (rangeEndDay && day > rangeEndDay) return false;
      return true;
    },
    [movementDayKey, rangeStartDay, rangeEndDay]
  );

  const isBeforeRange = useCallback(
    (m: any) => {
      const day = movementDayKey(m);
      return !!(day && rangeStartDay && day < rangeStartDay);
    },
    [movementDayKey, rangeStartDay]
  );

  const matchesTextSearch = useCallback(
    (m: any) => {
      const q = innerSearch.trim().toLowerCase();
      if (!q) return true;
      const passengers = [
        ...(Array.isArray(m.passengersList) ? m.passengersList : []),
        ...(Array.isArray(m.passengersDetail)
          ? m.passengersDetail.map((p: any) => `${p?.name || ''} ${p?.ticketNumber || ''}`)
          : []),
      ];
      return [
        m.description,
        m.accountingDescription,
        m.docType,
        m.entryNumber,
        m.voucherNumber,
        m.docNumber,
        m.reference,
        m.pnr,
        m.airline,
        m.route,
        m.entryUser,
        m.user,
        ...passengers,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    },
    [innerSearch]
  );

  const resetAllFilters = useCallback(() => {
    setActiveFilters((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        next[k] = true;
      });
      return next;
    });
    setInnerSearch('');
    setCurrency('ALL');
  }, []);

  // Real-Time Data Fetching (Zero Stale Delay)
  const fetchBaseData = useCallback(async (_force = false) => {
    const [entries, tickets, customers, groups] = await Promise.all([
      apiRequest('/api/journal-entries').catch(() => []),
      apiRequest('/api/tickets').catch(() => []),
      apiRequest('/api/partners/customers').catch(() => []),
      apiRequest('/api/tour-groups').catch(() => []),
    ]);
    return [entries, tickets, customers, groups];
  }, []);

  useEffect(() => {
    fetchBaseData(false);
  }, [fetchBaseData]);

  // ── Fetch Statement (with Clean Refresh) ──
  const handleFetchStatement = useCallback(
    async (forceRefresh = false) => {
      if (!selectedAccountId) return;
      setLoading(true);
      setHasSearched(true);
      try {
        if (forceRefresh) {
          const freshAccs = await apiRequest('/api/accounts').catch(() => []);
          if (Array.isArray(freshAccs) && freshAccs.length > 0) {
            setAccounts(freshAccs);
          }
        }

        const [entries, tickets, customers, groups] = await fetchBaseData(forceRefresh);

        const targetAcc = accounts.find((a) => a.id === selectedAccountId);
        const targetAccId = selectedAccountId;
        const targetAccName = targetAcc?.nameAr ? targetAcc.nameAr.trim().toLowerCase() : '';
        const targetAccCode = targetAcc?.code ? targetAcc.code.trim().toLowerCase() : '';

        const rawLines: any[] = [];
        const processedVoucherNumbers = new Set<string>();

        // فهرس التذاكر يُبنى مرة واحدة ليُوصل كل قيد بخدمته بلا مسحٍ متكرر للقائمة.
        const ticketList: any[] = Array.isArray(tickets) ? tickets : [];
        const ticketById = new Map<string, any>();
        const ticketByRef = new Map<string, any>();
        ticketList.forEach((t: any) => {
          if (t?.id) ticketById.set(String(t.id), t);
          [t?.invoiceNumber, t?.reference].forEach((key: any) => {
            const k = String(key || '').trim().toLowerCase();
            if (k && !ticketByRef.has(k)) ticketByRef.set(k, t);
          });
        });

        // فهرس الكروبات لتجميع مسافري وحركات الكروب الواحد في سطر واحد بالكشف
        const groupList: any[] = Array.isArray(groups) ? groups : [];
        const groupById = new Map<string, any>();
        const groupByPaxId = new Map<string, any>();
        const groupByName = new Map<string, any>();
        groupList.forEach((g: any) => {
          if (g?.id) groupById.set(String(g.id).toLowerCase(), g);
          if (g?.groupName) groupByName.set(String(g.groupName).trim().toLowerCase(), g);
          (g.passengers || []).forEach((p: any) => {
            if (p?.id) groupByPaxId.set(String(p.id).toLowerCase(), g);
          });
        });

        const groupConsolidated = new Map<string, any>();

        // 1. Process Journal Entries
        if (Array.isArray(entries)) {
          entries.forEach((e: any) => {
            if (e.status !== 'POSTED') return;
            if (!Array.isArray(e.lines)) return;

            // Skip opening journal entries to prevent double-counting with account opening balances
            const isOpeningEntry =
              (e.reference && (e.reference.startsWith('OPENING') || e.reference.startsWith('OPEN-'))) ||
              (e.entryNumber && (e.entryNumber.startsWith('OPENING') || e.entryNumber.startsWith('OPEN-'))) ||
              e.sourceType === 'OPENING' ||
              e.voucherType === 'OPENING' ||
              (e.description && (e.description.includes('رصيد افتتاحي') || e.description.includes('قيد افتتاحي')));

            if (isOpeningEntry) {
              return;
            }

            const srcType = String(e.sourceType || '').toUpperCase();
            const srcTicket =
              (e.sourceId && ticketById.get(String(e.sourceId))) ||
              (e.reference && ticketByRef.get(String(e.reference).trim().toLowerCase())) ||
              null;
            const entryServiceKind: ServiceKind | null =
              srcTicket
                ? resolveServiceKind(srcTicket, srcType, `${e.entryNumber || ''} ${e.reference || ''}`)
                : SERVICE_SOURCE_TYPES.has(srcType)
                ? resolveServiceKind(null, srcType, `${e.entryNumber || ''} ${e.reference || ''}`)
                : null;

            // إذا كان القيد تابعاً لكروب سياحي، يتم تجميعه ليظهر كـ «سطر واحد» شامل لكافة مسافريه
            const isGroupEntry =
              entryServiceKind === 'GROUP' ||
              srcType === 'GROUP' ||
              (e.reference && /^GRP-/i.test(String(e.reference))) ||
              (e.description && e.description.includes('كروب')) ||
              e.lines.some((l: any) => l.description && l.description.includes('كروب'));

            if (isGroupEntry) {
              const accLines = e.lines.filter((l: any) => l.accountId === targetAccId);
              if (accLines.length > 0) {
                let matchedGroup: any = null;
                if (e.sourceId) {
                  matchedGroup = groupByPaxId.get(String(e.sourceId).toLowerCase()) || groupById.get(String(e.sourceId).toLowerCase());
                }
                if (!matchedGroup && e.reference) {
                  const refClean = String(e.reference).replace(/^GRP-/i, '').trim().toLowerCase();
                  matchedGroup = groupByPaxId.get(refClean) || groupById.get(refClean);
                }
                if (!matchedGroup) {
                  const allText = `${e.description || ''} ${accLines.map((l: any) => l.description || '').join(' ')}`.toLowerCase();
                  for (const [name, g] of groupByName.entries()) {
                    if (allText.includes(name)) {
                      matchedGroup = g;
                      break;
                    }
                  }
                }

                let groupName = matchedGroup?.groupName || '';
                if (!groupName) {
                  const m = `${e.description || ''} ${accLines[0]?.description || ''}`.match(/كروب\s+([A-Za-z0-9\-_ ]+?)(?:\s*[:—\-]|\s+ALI|\s*\()/i);
                  groupName = m ? m[1].trim() : (e.reference ? e.reference.replace(/^GRP-/i, '').trim() : (isAr ? 'كروب' : 'Group'));
                }
                const groupKey = matchedGroup?.id || groupName.toLowerCase();

                let agg = groupConsolidated.get(groupKey);
                if (!agg) {
                  agg = {
                    groupKey,
                    groupId: matchedGroup?.id || null,
                    groupName,
                    date: e.date,
                    entryDate: e.createdAt || e.date,
                    entryNumber: e.entryNumber || `GRP-${groupName}`,
                    totalDebit: 0,
                    totalCredit: 0,
                    currency: (accLines[0]?.currency || e.currency || 'IQD').toUpperCase().includes('USD') ? 'USD' : 'IQD',
                    passengers: new Set<string>(),
                    entryUser: e.createdBy?.name || (isAr ? 'مدير النظام' : 'System Admin'),
                    user: e.createdBy?.name || (isAr ? 'مدير النظام' : 'System Admin'),
                    firstEntry: e,
                  };
                  groupConsolidated.set(groupKey, agg);
                }

                if (matchedGroup?.passengers) {
                  matchedGroup.passengers.forEach((p: any) => {
                    const matchAcc =
                      p.customerAccountId === targetAccId ||
                      (targetAccName && (p.customerName || '').toLowerCase().includes(targetAccName));
                    if (matchAcc && p.passengerName) {
                      agg.passengers.add(p.passengerName.trim());
                    }
                  });
                }

                accLines.forEach((l: any) => {
                  agg.totalDebit += Number(l.debit || 0);
                  agg.totalCredit += Number(l.credit || 0);

                  const paxMatch = String(l.description || e.description || '').match(/(?:—|:)\s*([A-Za-z\u0600-\u06FF ]+?)(?:\s*\(|$)/);
                  if (paxMatch && paxMatch[1]) {
                    const cleanP = paxMatch[1].trim();
                    if (cleanP && !cleanP.includes('سداد') && !cleanP.includes('تحصيل') && !cleanP.includes('كروب')) {
                      agg.passengers.add(cleanP);
                    }
                  }
                });

                [e.reference, e.voucherNumber, e.entryNumber].filter(Boolean).forEach((k: string) => {
                  processedVoucherNumbers.add(k.toLowerCase());
                });
                return;
              }
            }

            let hasTargetAcc = false;
            /*
             * القيدُ الواحد قد يمسّ الحساب مرتين: مرةً بقيمة الفاتورة ومرةً بسدادها.
             * والسطر الأول هو الفاتورة دائماً — هكذا يبنيها المُولّد — وما بعده
             * تسويةٌ لها، فيُربط به بدل أن يُقرأ حركةً مستقلة.
             */
            let serviceParentRowId: string | null = null;
            e.lines.forEach((l: any) => {
              if (l.accountId === targetAccId) {
                hasTargetAcc = true;
                const rowId = `${e.id}_${l.id}`;
                /*
                 * رقم المستند يُحسب مرة واحدة عند بناء الصف، فتقرأه الشاشةُ في
                 * عموده والطباعةُ في عمودها، ويُنزع من نص البيان في الاثنين.
                 */
                const rowDocNumber =
                  String(srcTicket?.invoiceNumber || '').trim() ||
                  e.voucherNumber ||
                  e.reference ||
                  e.entryNumber ||
                  '';
                const isSettlementLine = !!entryServiceKind && serviceParentRowId !== null;
                if (entryServiceKind && !serviceParentRowId) serviceParentRowId = rowId;
                const lineDesc = (l.description || e.description || '').toLowerCase();
                const rawLineCurr = (l.currency || e.currency || '').toString().toUpperCase();
                const isUSD =
                  rawLineCurr.includes('USD') ||
                  rawLineCurr.includes('$') ||
                  lineDesc.includes('دولار') ||
                  lineDesc.includes('usd') ||
                  lineDesc.includes('$');

                rawLines.push({
                  id: rowId,
                  parentRowId: isSettlementLine ? serviceParentRowId : null,
                  isServiceSettlement: isSettlementLine,
                  // التفاصيل تُعرض على الفاتورة وحدها؛ تكرارها على سطر سدادها حشو.
                  ticketDetails: isSettlementLine ? null : ticketDetailsOf(srcTicket),
                  date: e.date,
                  entryDate: e.createdAt || e.date,
                  entryNumber: e.entryNumber,
                  docType: entryServiceKind
                    ? serviceKindLabel(entryServiceKind, isAr)
                    : e.voucherNumber
                    ? e.voucherType === 'RECEIPT'
                      ? (isAr ? 'سند قبض' : 'Receipt Voucher')
                      : e.voucherType === 'PAYMENT'
                      ? (isAr ? 'سند دفع' : 'Payment Voucher')
                      : (isAr ? 'قيد يومية' : 'Journal Entry')
                    : (isAr ? 'قيد يومية' : 'Journal Entry'),
                  serviceKind: entryServiceKind,
                  ticketRaw: srcTicket,
                  ticketId: srcTicket?.id || (entryServiceKind ? e.sourceId || null : null),
                  voucherNumber: e.voucherNumber || '-',
                  reference: e.reference || '-',
                  docNumber: rowDocNumber,
                  description: stripDocNumber(
                    cleanStatementText(
                      e.voucherDescription || l.description || e.description,
                      entryServiceKind,
                      targetAcc?.nameAr,
                      targetAcc?.nameEn
                    ),
                    rowDocNumber,
                    e.entryNumber,
                    e.reference
                  ),
                  accountingDescription: stripDocNumber(
                    cleanStatementText(
                      l.description || e.description,
                      entryServiceKind,
                      targetAcc?.nameAr,
                      targetAcc?.nameEn
                    ),
                    rowDocNumber,
                    e.entryNumber,
                    e.reference
                  ),
                  debit: Number(l.debit || 0),
                  credit: Number(l.credit || 0),
                  costCenter: e.costCenter || (isAr ? 'الفرع الرئيسي' : 'Main Branch'),
                  entryUser: e.createdBy?.name || (isAr ? 'مدير النظام' : 'System Admin'),
                  user: e.createdBy?.name || (isAr ? 'مدير النظام' : 'System Admin'),
                  currency: isUSD ? 'USD' : 'IQD',
                  status: e.status,
                  voucherType: e.voucherType || '',
                  journalEntryId: e.id,
                  voucherId: e.voucherId || e.receiptVouchers?.[0]?.id || e.paymentVouchers?.[0]?.id || null,
                  rawEntry: e,
                });
              }
            });

            if (hasTargetAcc) {
              const processedKeys = [
                e.reference,
                e.voucherNumber,
                e.entryNumber,
              ].filter(Boolean);
              processedKeys.forEach((key: string) => processedVoucherNumbers.add(key.toLowerCase()));
            }
          });
        }

        // إضافة الكروبات مجمعة كسطر واحد لكل كروب مع كامل مسافريه ومبالغه
        groupConsolidated.forEach((agg: any) => {
          const paxArray: string[] = Array.from(agg.passengers || []);
          const cleanDocNumber = agg.groupName;

          rawLines.push({
            id: `group_consolidated_${agg.groupKey}`,
            groupId: agg.groupId,
            parentRowId: null,
            isServiceSettlement: false,
            ticketDetails: {
              passengers: paxArray.map((pName: any) => ({ name: String(pName), ticketType: isAr ? 'مسافر' : 'Pax' })),
              route: agg.groupName,
              pnr: agg.groupName,
              airline: '',
            },
            date: agg.date,
            entryDate: agg.entryDate,
            entryNumber: agg.entryNumber,
            docType: isAr ? 'كروب' : 'Group',
            serviceKind: 'GROUP',
            ticketRaw: null,
            ticketId: null,
            voucherNumber: cleanDocNumber,
            reference: cleanDocNumber,
            docNumber: cleanDocNumber,
            description: isAr
              ? `مبيعات كروب ${cleanDocNumber}${paxArray.length > 0 ? ` — ${paxArray.join('، ')}` : ''}`
              : `Tour Group ${cleanDocNumber}${paxArray.length > 0 ? ` — ${paxArray.join(', ')}` : ''}`,
            accountingDescription: isAr ? `مبيعات كروب ${cleanDocNumber}` : `Tour Group ${cleanDocNumber}`,
            debit: agg.totalDebit,
            credit: agg.totalCredit,
            costCenter: isAr ? 'قسم الكروبات السياحية' : 'Tour Groups Dept',
            entryUser: agg.entryUser,
            user: agg.user,
            currency: agg.currency,
            status: 'POSTED',
            voucherType: 'GROUP',
            passengersList: paxArray,
            passengersDetail: paxArray.map((pName: any) => ({ name: String(pName), ticketType: isAr ? 'مسافر' : 'Pax' })),
            journalEntryId: agg.firstEntry?.id,
            rawEntry: agg.firstEntry,
          });
        });

        // 2. Process Tickets
        if (Array.isArray(tickets)) {
          tickets.forEach((t: any) => {
            const ticketStatus = (t.status || 'POSTED').toString().toUpperCase();
            if (!['POSTED', 'REFUNDED'].includes(ticketStatus)) return;

            const invNum = (t.invoiceNumber || t.id || '').toLowerCase();
            if (invNum && processedVoucherNumbers.has(invNum)) return;

            const custName = (t.customerName || '').trim().toLowerCase();
            const suppAcc = (t.supplierAccount || '').trim().toLowerCase();
            const suppAccName = (t.supplierAccountName || '').trim().toLowerCase();

            const foundCust = (customers || []).find((c: any) => c.id === t.customerName || c.code === t.customerName || c.nameAr === t.customerName);
            const resolvedCustName = foundCust ? (foundCust.nameAr || foundCust.nameEn || custName).trim().toLowerCase() : custName;

            const isCustomerMatch =
              targetAccId === (t as any).customerAccountId ||
              (foundCust && (targetAccId === foundCust.accountId || (foundCust.code && targetAccCode && foundCust.code === targetAccCode))) ||
              (targetAccName && (
                custName.includes(targetAccName) || targetAccName.includes(custName) ||
                resolvedCustName.includes(targetAccName) || targetAccName.includes(resolvedCustName)
              )) ||
              (targetAccCode && (custName.includes(targetAccCode) || resolvedCustName.includes(targetAccCode)));

            const isSupplierMatch =
              targetAccId === t.supplierAccount ||
              targetAccId === (t as any).supplierId ||
              (targetAccCode && suppAcc && suppAcc === targetAccCode) ||
              (targetAccName && suppAccName && (suppAccName.includes(targetAccName) || targetAccName.includes(suppAccName))) ||
              (targetAccName && suppAcc && suppAcc.includes(targetAccName));

            const paymentType = (t.paymentType || 'DEBIT').toString().toUpperCase();
            const isCash = paymentType === 'DEBIT' || paymentType === 'CASH' || t.paymentType === 'نقدي';
            const effectiveCb =
              t.paymentMethod && t.paymentMethod.trim() && t.paymentMethod.trim() !== 'CASH_HAND'
                ? t.paymentMethod.trim()
                : t.receivingCashbox && t.receivingCashbox.trim()
                ? t.receivingCashbox.trim()
                : t.cashbox && t.cashbox.trim()
                ? t.cashbox.trim()
                : null;

            let isCashboxMatch = false;
            if (isCash && effectiveCb) {
              const cbClean = effectiveCb.toLowerCase();
              isCashboxMatch =
                targetAccId === effectiveCb ||
                (targetAccCode && targetAccCode === cbClean) ||
                (targetAccName &&
                  (targetAccName === cbClean ||
                    targetAccName.includes(cbClean) ||
                    cbClean.includes(targetAccName)));
            }

            const passDetails = (t.passengers || []).map((p: any) => ({
              name: p.name || p.passenger || 'مسافر',
              ticketNumber: p.ticketNumber || p.documentNumber || '',
              ticketType: p.ticketType || p.type || 'ADULT',
            }));
            const pList = (t.passengers || []).map((p: any) => p.name || p.passenger).filter(Boolean);

            const rawCurr = (t.currency || 'IQD').toString().toUpperCase();
            const ticketCurr = rawCurr.includes('USD') || rawCurr.includes('$') ? 'USD' : 'IQD';
            /*
             * اسم الحركة من نوع خدمتها لا من كونها تذكرة.
             *
             * كانت كل حركة تُسمّى «تذكرة طيران» ولو كانت تأشيرة أو حجز فندق، فلا
             * يفرّق قارئ الكشف بين خدماتنا. والاسترجاع يُكتب «Refund» بالإنجليزية
             * في اللغتين بطلب صاحب النظام، ليبقى مميّزاً بلمحة عين.
             */
            const rowKind = resolveServiceKind(t, undefined, t.invoiceNumber);
            const kindOf = (amount: number): ServiceKind => (amount < 0 ? 'REFUND' : rowKind);
            const serviceLabel = (amount: number): string => serviceKindLabel(kindOf(amount), isAr);

            const cleanRoute = (t.fullRouteText || t.route || '').replace(/^—$/, '');
            const issuerEmp = t.employeeName || t.issuerName || t.createdByName || (isAr ? 'موظف الإصدار' : 'Issuing Staff');
            const entryEmp = t.entryEmployee || t.employeeName || issuerEmp;

            if (isCustomerMatch) {
              const sellAmt = Number(t.netSell || t.totalSell || 0);
              const debit = Math.max(sellAmt, 0);
              const credit = Math.max(-sellAmt, 0);
              rawLines.push({
                id: `ticket_cust_${t.id}`,
                date: t.issueDate || t.createdAt,
                entryDate: t.createdAt || t.issueDate,
                entryNumber: t.invoiceNumber || t.id,
                docType: serviceLabel(sellAmt),
                serviceKind: kindOf(sellAmt),
                ticketId: t.id,
                docNumber: t.invoiceNumber || '',
                ticketDetails: ticketDetailsOf(t),
                voucherNumber: t.invoiceNumber || '-',
                reference: t.pnr || t.reference || '-',
                pnr: t.pnr || t.reference || '-',
                airline: t.airline || '',
                route: cleanRoute,
                passengersList: pList,
                passengersDetail: passDetails,
                description: t.notes || (isAr ? `فاتورة تذاكر - ${t.airline || ''} (${t.pnr || ''})` : `Ticket Invoice - ${t.airline || ''} (${t.pnr || ''})`),
                debit,
                credit,
                costCenter: isAr ? 'قسم الطيران' : 'Aviation Dept',
                entryUser: entryEmp,
                user: issuerEmp,
                currency: ticketCurr,
                status: t.isAudited ? 'AUDITED' : 'ACTIVE',
                voucherType: 'TICKET',
                ticketRaw: t,
              });

              if (isCash && sellAmt > 0) {
                rawLines.push({
                  id: `ticket_cust_cash_receipt_${t.id}`,
                  date: t.issueDate || t.createdAt,
                  entryDate: t.createdAt || t.issueDate,
                  entryNumber: t.invoiceNumber || t.id,
                  docType: isAr ? 'سداد نقدي فوري' : 'Cash Settlement',
                  serviceKind: rowKind,
                  ticketId: t.id,
                  docNumber: t.invoiceNumber || '',
                  parentRowId: `ticket_cust_${t.id}`,
                  isServiceSettlement: true,
                  voucherNumber: t.invoiceNumber || '-',
                  reference: t.pnr || t.reference || '-',
                  pnr: t.pnr || t.reference || '-',
                  airline: t.airline || '',
                  route: cleanRoute,
                  passengersList: pList,
                  passengersDetail: passDetails,
                  description: isAr ? `مقبوضات نقدية باليد عن تذكرة ${t.pnr || ''}` : `Cash payment received for ticket ${t.pnr || ''}`,
                  debit: 0,
                  credit: sellAmt,
                  costCenter: isAr ? 'قسم الطيران' : 'Aviation Dept',
                  entryUser: entryEmp,
                  user: issuerEmp,
                  currency: ticketCurr,
                  status: t.isAudited ? 'AUDITED' : 'ACTIVE',
                  voucherType: 'RECEIPT',
                  ticketRaw: t,
                });
              }
            }

            if (isCashboxMatch) {
              const sellAmt = Number(t.totalSell || t.netSell || 0);
              rawLines.push({
                id: `ticket_cashbox_${t.id}`,
                date: t.issueDate || t.createdAt,
                entryDate: t.createdAt || t.issueDate,
                entryNumber: t.invoiceNumber || t.id,
                docType: `${serviceLabel(1)}${isAr ? ' (نقدي)' : ' (Cash)'}`,
                serviceKind: kindOf(1),
                ticketId: t.id,
                docNumber: t.invoiceNumber || '',
                ticketDetails: ticketDetailsOf(t),
                voucherNumber: t.invoiceNumber || '-',
                reference: t.pnr || t.reference || '-',
                pnr: t.pnr || t.reference || '-',
                airline: t.airline || '',
                route: cleanRoute,
                passengersList: pList,
                passengersDetail: passDetails,
                // اسم الحساب لا يُعاد داخل كشفه؛ الـPNR وحده يكفي للتمييز.
                description: isAr
                  ? cleanStatementText(`مقبوضات مبيعات تذكرة نقدية - ${t.customerName || ''} (${t.pnr || ''})`, rowKind, targetAcc?.nameAr, targetAcc?.nameEn)
                  : `Cash Ticket Sale Proceeds (${t.pnr || ''})`,
                debit: sellAmt,
                credit: 0,
                costCenter: isAr ? 'قسم الطيران' : 'Aviation Dept',
                entryUser: entryEmp,
                user: issuerEmp,
                currency: ticketCurr,
                status: t.isAudited ? 'AUDITED' : 'ACTIVE',
                voucherType: 'TICKET',
                ticketRaw: t,
              });
            }

            if (isSupplierMatch) {
              const buyAmt = Number(t.netBuy || t.totalBuy || 0);
              const debit = Math.max(-buyAmt, 0);
              const credit = Math.max(buyAmt, 0);
              rawLines.push({
                id: `ticket_supp_${t.id}`,
                date: t.issueDate || t.createdAt,
                entryDate: t.createdAt || t.issueDate,
                entryNumber: t.invoiceNumber || t.id,
                docType: serviceLabel(buyAmt),
                serviceKind: kindOf(buyAmt),
                ticketId: t.id,
                docNumber: t.invoiceNumber || '',
                ticketDetails: ticketDetailsOf(t),
                voucherNumber: t.invoiceNumber || '-',
                reference: t.pnr || t.reference || '-',
                pnr: t.pnr || t.reference || '-',
                airline: t.airline || '',
                route: cleanRoute,
                passengersList: pList,
                passengersDetail: passDetails,
                description: t.notes || '',
                debit,
                credit,
                costCenter: isAr ? 'قسم الطيران' : 'Aviation Dept',
                entryUser: entryEmp,
                user: issuerEmp,
                currency: ticketCurr,
                status: t.isAudited ? 'AUDITED' : 'ACTIVE',
                voucherType: 'TICKET',
                ticketRaw: t,
              });
            }
          });
        }

        rawLines.sort(compareByEntryOrder);

        setStatementMovements(groupServiceSettlements(rawLines));

        if (forceRefresh) {
          showSuccessNotification(
            isAr ? 'تم تحديث الكشف' : 'Statement Refreshed',
            isAr ? 'تمت إعادة جلب وتحديث كافة الحركات المالية بنجاح' : 'Financial transactions reloaded successfully'
          );
        }
      } catch (err: any) {
        console.error('Error fetching account statement:', err);
        showErrorNotification(isAr ? 'خطأ في التحديث' : 'Refresh Error', err.message || (isAr ? 'تعذر جلب البيانات' : 'Failed to fetch'));
      } finally {
        setLoading(false);
      }
    },
    [selectedAccountId, accounts, fetchBaseData, isAr]
  );

  useEffect(() => {
    if (selectedAccountId) {
      handleFetchStatement(false);
    }
  }, [selectedAccountId, handleFetchStatement]);

  // ── Calculated Rows with Running Balance ──
  const {
    calculatedRows,
    totalDebit,
    totalCredit,
    closingBalance,
    balanceIQD,
    balanceUSD,
    totalDebitIQD,
    totalCreditIQD,
    totalDebitUSD,
    totalCreditUSD,
    openingBalIQD,
    openingBalUSD,
  } = useMemo(() => {
    let runningBalanceIQD = 0;
    let runningBalanceUSD = 0;
    let sumDebitIQD = 0;
    let sumCreditIQD = 0;
    let sumDebitUSD = 0;
    let sumCreditUSD = 0;

    const selectedAcc = accounts.find((a) => a.id === selectedAccountId);
    const accOpeningBalIQD = Number(selectedAcc?.openingAmountIQD ?? selectedAcc?.openingBalance ?? selectedAcc?.initialBalance ?? 0);
    const accOpeningBalUSD = Number(selectedAcc?.openingAmountUSD ?? 0);
    const accPrevBalIQD = Number(selectedAcc?.previousBalance || 0);
    const accPrevBalUSD = Number(selectedAcc?.previousBalanceUSD || 0);

    const isOpeningActive = !!activeFilters['openingBalance'];
    const isPrevActive = !!activeFilters['previousBalance'];

    // Type / currency / text filters first, then the period, so movements dated before
    // the selected range can still be rolled into a carried-forward balance.
    const inScope = statementMovements.filter((m) => {
      const cat = categorizeMovement(m);
      if (cat !== 'openingBalance' && cat !== 'previousBalance' && !activeFilters[cat]) return false;

      if (currency !== 'ALL' && currency !== 'كلاهما') {
        const itemCurr = (m.currency || 'IQD').toUpperCase();
        const isItemUSD = itemCurr.includes('USD') || itemCurr.includes('$');
        if (currency === 'USD' && !isItemUSD) return false;
        if (currency === 'IQD' && isItemUSD) return false;
      }

      return matchesTextSearch(m);
    });

    const filtered = inScope.filter(isWithinRange);
    const beforeRange = inScope.filter(isBeforeRange);

    const sortedFiltered = groupServiceSettlements([...filtered].sort(compareByEntryOrder));

    const rows: any[] = [];
    const isOpeningCredit = (selectedAcc as any)?.openingNature === 'CREDIT';
    const wantIQD = currency === 'ALL' || currency === 'IQD' || currency === 'كلاهما';
    const wantUSD = currency === 'ALL' || currency === 'USD' || currency === 'كلاهما';

    // الرصيد الافتتاحي يُعرض دائماً ما دام مرشّحه مفعّلاً — حتى وهو صفر، لأنه
    // نقطة بداية الكشف. كان يُحذف عند الصفر فيبدأ الكشف بلا افتتاحية.
    const pushOpening = (curr: 'IQD' | 'USD', amount: number) => {
      const deb = isOpeningCredit ? 0 : amount;
      const cred = isOpeningCredit ? amount : 0;
      const net = isOpeningCredit ? -amount : amount;
      if (curr === 'IQD') {
        runningBalanceIQD += net;
        sumDebitIQD += deb;
        sumCreditIQD += cred;
      } else {
        runningBalanceUSD += net;
        sumDebitUSD += deb;
        sumCreditUSD += cred;
      }
      const running = curr === 'IQD' ? runningBalanceIQD : runningBalanceUSD;
      rows.push({
        id: `opening_balance_${curr.toLowerCase()}_row`,
        date: startDate || new Date().toISOString(),
        entryNumber: curr === 'IQD' ? '000' : '000-$',
        docType: isAr ? 'رصيد افتتاحي' : 'Opening Balance',
        voucherNumber: `OPEN-${curr}`,
        description: isAr ? 'الرصيد الافتتاحي' : 'Opening Balance',
        debit: deb,
        credit: cred,
        runningBalance: running,
        balanceNature: running >= 0 ? (isAr ? 'مدين' : 'Debit') : (isAr ? 'دائن' : 'Credit'),
        voucherType: 'OPENING',
        isBalanceRow: true,
        currency: curr,
      });
    };

    if (isOpeningActive) {
      const showIQD = wantIQD && accOpeningBalIQD !== 0;
      const showUSD = wantUSD && accOpeningBalUSD !== 0;
      if (showIQD) pushOpening('IQD', accOpeningBalIQD);
      if (showUSD) pushOpening('USD', accOpeningBalUSD);
      // كلاهما صفر: سطرٌ افتتاحي واحد صفري بالعملة المناسبة، فلا يختفي.
      if (!showIQD && !showUSD) pushOpening(currency === 'USD' ? 'USD' : 'IQD', 0);
    }

    // الرصيد السابق يُعرض أيضاً دائماً عند تفعيل مرشّحه، حتى وهو صفر — إلا إذا
    // كان مطابقاً تماماً للرصيد الافتتاحي غير الصفري فلا يُكرَّر.
    const pushPrev = (curr: 'IQD' | 'USD', amount: number) => {
      const deb = amount >= 0 ? amount : 0;
      const cred = amount < 0 ? Math.abs(amount) : 0;
      if (curr === 'IQD') {
        runningBalanceIQD += amount;
        sumDebitIQD += deb;
        sumCreditIQD += cred;
      } else {
        runningBalanceUSD += amount;
        sumDebitUSD += deb;
        sumCreditUSD += cred;
      }
      const running = curr === 'IQD' ? runningBalanceIQD : runningBalanceUSD;
      rows.push({
        id: `previous_balance_${curr.toLowerCase()}_row`,
        date: startDate || new Date().toISOString(),
        entryNumber: curr === 'IQD' ? '000-P' : '000-P$',
        docType: isAr ? 'رصيد سابق' : 'Previous Balance',
        voucherNumber: `PREV-${curr}`,
        description: isAr ? 'الرصيد السابق' : 'Previous Balance',
        debit: deb,
        credit: cred,
        runningBalance: running,
        balanceNature: running >= 0 ? (isAr ? 'مدين' : 'Debit') : (isAr ? 'دائن' : 'Credit'),
        voucherType: 'PREVIOUS',
        isBalanceRow: true,
        currency: curr,
      });
    };

    if (isPrevActive) {
      const dupIQD = isOpeningActive && accOpeningBalIQD !== 0 && accPrevBalIQD === (isOpeningCredit ? -accOpeningBalIQD : accOpeningBalIQD);
      const dupUSD = isOpeningActive && accOpeningBalUSD !== 0 && accPrevBalUSD === (isOpeningCredit ? -accOpeningBalUSD : accOpeningBalUSD);
      const showIQD = wantIQD && !dupIQD;
      const showUSD = wantUSD && !dupUSD;
      if (showIQD && accPrevBalIQD !== 0) pushPrev('IQD', accPrevBalIQD);
      if (showUSD && accPrevBalUSD !== 0) pushPrev('USD', accPrevBalUSD);
      // كلاهما صفر (ولم يُكرَّر): سطرٌ سابقٌ واحد صفري كي لا يغيب.
      if (accPrevBalIQD === 0 && accPrevBalUSD === 0 && (showIQD || showUSD)) {
        pushPrev(currency === 'USD' ? 'USD' : 'IQD', 0);
      }
    }

    // Movements older than the selected period are summarised into one carried-forward
    // line per currency, so the running balance of the period still ends on the truth.
    const carried = { IQD: { debit: 0, credit: 0, count: 0 }, USD: { debit: 0, credit: 0, count: 0 } };
    beforeRange.forEach((m) => {
      const itemCurr = (m.currency || 'IQD').toUpperCase();
      const bucket = itemCurr.includes('USD') || itemCurr.includes('$') ? carried.USD : carried.IQD;
      bucket.debit += Number(m.debit || 0);
      bucket.credit += Number(m.credit || 0);
      bucket.count += 1;
    });

    (['IQD', 'USD'] as const).forEach((curr) => {
      const bucket = carried[curr];
      if (!bucket.count) return;
      const net = bucket.debit - bucket.credit;
      if (curr === 'USD') {
        sumDebitUSD += bucket.debit;
        sumCreditUSD += bucket.credit;
        runningBalanceUSD += net;
      } else {
        sumDebitIQD += bucket.debit;
        sumCreditIQD += bucket.credit;
        runningBalanceIQD += net;
      }
      const running = curr === 'USD' ? runningBalanceUSD : runningBalanceIQD;
      rows.push({
        id: `carried_forward_${curr.toLowerCase()}_row`,
        date: startDate || new Date().toISOString(),
        entryNumber: curr === 'USD' ? '000-C$' : '000-C',
        docType: isAr ? 'رصيد مدوّر' : 'Carried Forward',
        voucherNumber: `FWD-${curr}`,
        description: isAr
          ? `مدوّر ما قبل ${rangeStartDay || ''} (${bucket.count} حركة)`
          : `Carried forward before ${rangeStartDay || ''} (${bucket.count} movements)`,
        debit: bucket.debit,
        credit: bucket.credit,
        runningBalance: running,
        balanceNature: running >= 0 ? (isAr ? 'مدين' : 'Debit') : (isAr ? 'دائن' : 'Credit'),
        voucherType: 'PREVIOUS',
        isBalanceRow: true,
        currency: curr,
      });
    });

    sortedFiltered.forEach((m) => {
      const itemCurr = (m.currency || 'IQD').toUpperCase();
      const isUSD = itemCurr.includes('USD') || itemCurr.includes('$');
      const deb = Number(m.debit || 0);
      const cred = Number(m.credit || 0);

      let itemRunningBalance = 0;

      if (isUSD) {
        sumDebitUSD += deb;
        sumCreditUSD += cred;
        runningBalanceUSD += deb - cred;
        itemRunningBalance = runningBalanceUSD;
      } else {
        sumDebitIQD += deb;
        sumCreditIQD += cred;
        runningBalanceIQD += deb - cred;
        itemRunningBalance = runningBalanceIQD;
      }

      rows.push({
        ...m,
        category: categorizeMovement(m),
        runningBalance: itemRunningBalance,
        balanceNature: itemRunningBalance >= 0 ? (isAr ? 'مدين' : 'Debit') : (isAr ? 'دائن' : 'Credit'),
        currency: isUSD ? 'USD' : 'IQD',
      });
    });

    const balIQD = sumDebitIQD - sumCreditIQD;
    const balUSD = sumDebitUSD - sumCreditUSD;

    return {
      calculatedRows: rows,
      totalDebitIQD: sumDebitIQD,
      totalCreditIQD: sumCreditIQD,
      totalDebitUSD: sumDebitUSD,
      totalCreditUSD: sumCreditUSD,
      totalDebit: currency === 'USD' ? sumDebitUSD : sumDebitIQD,
      totalCredit: currency === 'USD' ? sumCreditUSD : sumCreditIQD,
      closingBalance: currency === 'USD' ? balUSD : balIQD,
      balanceIQD: balIQD,
      balanceUSD: balUSD,
      openingBalIQD: accOpeningBalIQD,
      openingBalUSD: accOpeningBalUSD,
    };
  }, [
    statementMovements,
    activeFilters,
    currency,
    matchesTextSearch,
    categorizeMovement,
    isWithinRange,
    isBeforeRange,
    rangeStartDay,
    accounts,
    selectedAccountId,
    startDate,
    isAr,
  ]);

  // The printed sheet reads its own field names, so every movement is translated into
  // one: the details column must carry the source document and its own البيان.
  const printRows = useMemo(() => {
    return calculatedRows.map((r, idx) => {
      const voucherNo = r.voucherNumber && r.voucherNumber !== '-' ? r.voucherNumber : '';
      const docRef = voucherNo || r.entryNumber || '';
      const reference = r.reference && r.reference !== '-' ? r.reference : '';
      /*
        * عمود «النوع» يسمّي المستند بما هو، لا برمزٍ واحد للجميع.
        *
        * كان كل صفٍّ يُكتب GL-ENTRY لأن التصنيف كان يقرأ voucherType وحده، وهو
        * فارغٌ في القيود المولَّدة عن الخدمات. والنوع معروف: من خدمة القيد إن
        * كان ناشئاً عن خدمة، ومن كون السطر تسديداً لفاتورته، وإلا فمن نوع السند.
        */
      const vt = String(r.voucherType || '').toUpperCase();
      const kind = String(r.serviceKind || '').toUpperCase() as ServiceKind;
      const typeCode = r.serviceKind
        ? r.isServiceSettlement
          ? isAr
            ? `تسديد ${SERVICE_WORD[kind]?.one || 'تذكرة'}`
            : `${serviceKindLabel(kind, false)} settlement`
          : isAr
          ? SERVICE_TYPE_LABEL_AR[kind] || 'قيد'
          : serviceKindLabel(kind, false)
        : vt === 'RECEIPT'
        ? (isAr ? 'قبض' : 'Receipt')
        : vt === 'PAYMENT'
        ? (isAr ? 'دفع' : 'Payment')
        : vt === 'EXCHANGE'
        ? (isAr ? 'صرافة' : 'Exchange')
        : vt === 'OPENING'
        ? (isAr ? 'افتتاحي' : 'Opening')
        : vt === 'PREVIOUS'
        ? (isAr ? 'سابق' : 'Previous')
        : (isAr ? 'قيد' : 'Journal');

      const docLabel = [r.docType, reference && reference !== docRef ? `Ref: ${reference}` : '']
        .filter(Boolean)
        .join(' · ');

      /*
       * الكشف المطبوع يقرأ pnr وroute وpassengersDetail من الصف مباشرة، وصفوف
       * القيود تحمل تفاصيلها في ticketDetails — فتُسطَّح هنا ليصل إلى الـPDF ما
       * يظهر على الشاشة نفسه، لا أقل.
       */
      const details = r.ticketDetails;
      const flatPassengers = Array.isArray(r.passengersDetail) && r.passengersDetail.length
        ? r.passengersDetail
        : Array.isArray(details?.passengers) && details.passengers.length
        ? details.passengers
        : undefined;

      /*
       * رقم المستند هو رقم الفاتورة إن كانت الحركة خدمةً، وإلا رقم السند، وإلا
       * المرجع أو رقم القيد — أي الرقم الذي يعود به المحاسب إلى المستند نفسه، لا
       * رقم القيد المولَّد الذي يحوي الفاتورة داخله.
       */
      const invoiceNumber = String(r.ticketRaw?.invoiceNumber || '').trim();
      const docNumber = r.docNumber || invoiceNumber || voucherNo || reference || r.entryNumber || '';

      return {
        ...r,
        rowNumber: idx + 1,
        docRef,
        docNumber,
        docLabel,
        typeCode,
        statement: stripDocNumber(
          r.description || r.accountingDescription || '',
          docNumber,
          r.entryNumber,
          reference,
          invoiceNumber
        ),
        pnr: r.pnr && r.pnr !== '-' ? r.pnr : details?.pnr || undefined,
        route: r.route || details?.route || undefined,
        airline: r.airline || details?.airline || undefined,
        passengersDetail: flatPassengers,
      };
    });
  }, [calculatedRows]);

  const handleExportExcel = useCallback(() => {
    if (!calculatedRows || calculatedRows.length === 0) return;
    const exportData = calculatedRows.map((r) => ({
      [isAr ? 'التاريخ' : 'Date']: new Date(r.date).toLocaleDateString('en-GB'),
      [isAr ? 'رقم القيد' : 'Entry #']: r.entryNumber,
      [isAr ? 'نوع المستند' : 'Doc Type']: r.docType,
      [isAr ? 'رقم السند' : 'Voucher #']: r.voucherNumber,
      [isAr ? 'البيان' : 'Description']: r.description,
      [isAr ? 'مدين' : 'Debit']: r.debit,
      [isAr ? 'دائن' : 'Credit']: r.credit,
      [isAr ? 'الرصيد المتراكم' : 'Running Balance']: r.runningBalance,
      [isAr ? 'طبيعة الرصيد' : 'Nature']: r.balanceNature,
      [isAr ? 'المستخدم' : 'User']: r.user,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isAr ? 'كشف_حساب' : 'Statement');
    XLSX.writeFile(wb, `Account_Statement_${selectedAccount?.code || ''}_${new Date().toISOString().split('T')[0]}.xlsx`);
  }, [calculatedRows, selectedAccount, isAr]);

  const selectAccount = useCallback(
    (acc: any) => {
      setSelectedAccountId(acc.id);
      setAccountSearch(isAr ? acc.nameAr : (acc.nameEn || acc.nameAr));
      setShowAccountDropdown(false);
    },
    [isAr]
  );

  // ── Column Definitions (Enhanced Styling & Clear Badges) ──
  const columnDefs: AccountingColumnDef[] = useMemo(
    () => [
      {
        field: 'date',
        headerText: isAr ? 'التاريخ' : 'Date',
        width: 'w-24',
        isPinned: true,
        render: (r) => (
          <div className="flex items-center gap-1.5 font-mono font-bold text-slate-800 text-xs" dir="ltr">
            <span>{new Date(r.date).toLocaleDateString('en-GB')}</span>
          </div>
        ),
      },
      {
        field: 'voucherNumber',
        headerText: isAr ? 'المستند / نوعه' : 'Doc / Type',
        width: 'w-36',
        align: 'center',
        render: (r) => {
          const dt = (r.docType || '').toLowerCase();
          const sk = String(r.serviceKind || '').toUpperCase();
          const isReceipt = dt.includes('قبض') || dt.includes('receipt');
          const isPayment = dt.includes('دفع') || dt.includes('payment');
          const isOpening = dt.includes('افتتاحي') || dt.includes('opening');
          const isPrevious = dt.includes('سابق') || dt.includes('previous');

          // لكل خدمة لونها، فيُميَّز نوع المستند قبل قراءة اسمه.
          const serviceBadge: Record<string, string> = {
            TICKET: 'bg-sky-50 text-sky-800 border-sky-200',
            VISA: 'bg-indigo-50 text-indigo-800 border-indigo-200',
            HOTEL: 'bg-violet-50 text-violet-800 border-violet-200',
            REISSUE: 'bg-amber-50 text-amber-900 border-amber-200',
            REFUND: 'bg-rose-50 text-rose-800 border-rose-200',
            GROUP: 'bg-teal-50 text-teal-800 border-teal-200',
          };

          const badgeColor = serviceBadge[sk]
            ? serviceBadge[sk]
            : isReceipt
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : isPayment
            ? 'bg-rose-50 text-rose-800 border-rose-200'
            : isOpening
            ? 'bg-amber-50 text-amber-900 border-amber-200'
            : isPrevious
            ? 'bg-slate-100 text-slate-800 border-slate-200'
            : 'bg-blue-50 text-blue-800 border-blue-200';

          return (
            <div className="flex flex-col items-center justify-center gap-1 py-1">
              <div className="flex items-center gap-1">
                {/* شارة النوع هي مدخل التفاصيل، فتبقى قائمة الإجراءات للتعديل والحذف وحدهما. */}
                <button
                  type="button"
                  title={isAr ? 'عرض تفاصيل المستند' : 'View document details'}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedMovement(r);
                    setDrawerOpen(true);
                  }}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shadow-2xs cursor-pointer hover:brightness-95 transition ${badgeColor}`}
                >
                  {r.docType}
                </button>
                {r.status === 'AUDITED' && (
                  <Tooltip label={isAr ? 'حركة مدققة ومقفلة' : 'Audited & Locked'} withArrow>
                    <span className="inline-flex items-center justify-center bg-amber-50 border border-amber-200 p-0.5 rounded-full text-amber-600">
                      <IconLock size={10} />
                    </span>
                  </Tooltip>
                )}
              </div>
              {/* رقم الفاتورة/السند في عموده — فلا يُكرَّر داخل البيان. */}
              <span
                className="font-mono font-bold text-slate-700 text-[10.5px] bg-slate-100/90 px-1.5 py-0.2 rounded border border-slate-200/80 tracking-tight max-w-full truncate"
                dir="ltr"
                title={r.docNumber || r.voucherNumber || ''}
              >
                {r.docNumber || r.voucherNumber}
              </span>
            </div>
          );
        },
      },
      {
        field: 'description',
        headerText: isAr ? 'البيان وشرح الحركة' : 'Statement & Flight Details',
        isWide: true,
        render: (r) => {
          const renderBody = () => {
          if (r.voucherType === 'GROUP' || r.serviceKind === 'GROUP' || r.docType?.includes('كروب') || r.docType?.includes('Group')) {
            const pDetails: Array<{ name: string; ticketNumber?: string; ticketType?: string }> =
              r.passengersDetail && r.passengersDetail.length > 0
                ? r.passengersDetail
                : (r.passengersList || []).map((p: string) => ({ name: p, ticketType: isAr ? 'مسافر' : 'Pax' }));
            const groupName = r.docNumber || r.ticketDetails?.route || r.reference || (isAr ? 'كروب' : 'Group');

            return (
              <div className="py-1 space-y-1.5 text-slate-900 text-xs">
                {/* Line 1: Group Name Badge, Pax Count Badge */}
                <div className="flex items-center gap-2 font-bold flex-wrap">
                  <span className="inline-flex items-center gap-1.5 bg-[#FFF3E8] text-[#F45A0A] border border-orange-200/80 px-2.5 py-0.5 rounded-md text-[11px] font-bold shadow-2xs">
                    <IconUsers size={12} className="text-[#F45A0A]" />
                    <span>{isAr ? `مبيعات كروب: ${groupName}` : `Tour Group: ${groupName}`}</span>
                  </span>

                  {pDetails.length > 0 && (
                    <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-md text-[10.5px] font-bold">
                      <IconUser size={11} className="text-amber-700 shrink-0" />
                      <span>{isAr ? 'العدد' : 'Pax'}</span>
                      <span className="w-4 h-4 rounded-full bg-amber-600 text-white text-[9.5px] font-bold flex items-center justify-center font-mono">
                        {pDetails.length}
                      </span>
                    </span>
                  )}
                </div>

                {/* Line 2: Horizontal Clean Passenger Chips */}
                {pDetails.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11.5px]">
                    {pDetails.map((pass, idx) => (
                      <div
                        key={idx}
                        className="inline-flex items-center gap-1.5 text-slate-800 font-bold bg-slate-50/90 px-2 py-0.5 rounded-md border border-slate-200/80 shadow-2xs"
                      >
                        <IconUser size={12} className="text-amber-600 shrink-0" />
                        <span className="text-slate-900 font-mono font-bold">{pass.name.trim()}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(pass.name.trim());
                          }}
                          title={isAr ? 'نسخ اسم المسافر' : 'Copy Passenger Name'}
                          className="hover:bg-slate-200 p-0.5 rounded text-slate-400 hover:text-slate-800 cursor-pointer transition-colors"
                        >
                          <IconCopy size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          if (r.voucherType === 'TICKET' || r.docType?.includes('تذكرة') || r.docType?.includes('Ticket')) {
            const pDetails: Array<{ name: string; ticketNumber?: string; ticketType?: string }> = r.passengersDetail || [];
            const pnrVal = r.pnr || r.reference || '';
            const routeClean = formatRouteCodesOnly(r.route);

            return (
              <div className="py-1 space-y-1.5 text-slate-900 text-xs">
                {/* Line 1: PNR Badge, Route Badge, Pax Badge */}
                <div className="flex items-center gap-2 font-bold flex-wrap">
                  <span className="inline-flex items-center gap-1 bg-slate-900 text-white px-2 py-0.5 rounded-md text-[11px] font-mono shadow-2xs">
                    <span>PNR: {pnrVal || '-'}</span>
                    {pnrVal && pnrVal !== '-' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(pnrVal);
                        }}
                        title={isAr ? 'نسخ الـ PNR' : 'Copy PNR'}
                        className="hover:bg-slate-700 p-0.5 rounded cursor-pointer transition-colors text-white"
                      >
                        <IconCopy size={10} />
                      </button>
                    )}
                  </span>

                  {routeClean && (
                    <span className="flex items-center gap-1 font-mono font-bold text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-[11px]">
                      <IconRoute size={12} className="text-emerald-700 shrink-0" />
                      <span>{routeClean}</span>
                    </span>
                  )}

                  {pDetails.length > 0 && (
                    <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-900 border border-indigo-200 px-2 py-0.5 rounded-md text-[10.5px] font-bold">
                      <IconUsers size={11} className="text-indigo-600 shrink-0" />
                      <span>{isAr ? 'العدد' : 'Pax'}</span>
                      <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[9.5px] font-bold flex items-center justify-center font-mono">
                        {pDetails.length}
                      </span>
                    </span>
                  )}
                </div>

                {/* Line 2+: Clean Horizontal Passenger Line Items */}
                {pDetails.length > 0 && (
                  <div className="space-y-1 font-mono text-[11.5px]">
                    {pDetails.map((pass, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-slate-800 font-bold leading-tight flex-wrap bg-slate-50/80 px-2 py-0.5 rounded-md border border-slate-200/60">
                        <IconUser size={12} className="text-indigo-500 shrink-0" />
                        <span className="text-slate-900 font-mono font-bold">{pass.name.trim()}</span>
                        {pass.ticketType && (
                          <span className="text-[9.5px] font-bold text-indigo-700 bg-indigo-100/70 px-1 py-0.2 rounded">
                            {pass.ticketType}
                          </span>
                        )}
                        {pass.ticketNumber && (
                          <span className="text-[10px] font-bold text-slate-600 bg-white px-1.5 py-0.2 rounded border border-slate-200">
                            #{pass.ticketNumber}
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const copyText = `${pass.name.trim()}${pass.ticketNumber ? ` - ${pass.ticketNumber}` : ''}`;
                            navigator.clipboard.writeText(copyText);
                          }}
                          title={isAr ? 'نسخ اسم المسافر' : 'Copy Passenger Name'}
                          className="hover:bg-slate-200 p-0.5 rounded text-slate-400 hover:text-slate-800 cursor-pointer transition-colors ms-auto"
                        >
                          <IconCopy size={10} />

                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <div className="py-1 space-y-1">
              <div
                className="whitespace-pre-line text-xs leading-relaxed font-bold text-slate-900"
                title={r.accountingDescription && r.accountingDescription !== r.description ? r.accountingDescription : undefined}
              >
                <NoBreakCodes text={r.description} />
              </div>
              <TicketDetailStrip details={r.ticketDetails} isAr={isAr} />
            </div>
          );
          };

          if (!r.isServiceSettlement) return renderBody();

          // سطر السداد يُعرَض فرعاً تحت فاتورته، موسوماً بما هو، فلا يُقرأ حركةً ثانية.
          return (
            <div className="flex items-start gap-1.5">
              <SettlementBranch />
              <div className="flex-1 min-w-0">
                <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded mb-0.5">
                  <IconLink size={10} />
                  {isAr ? 'تسديد الفاتورة أعلاه' : 'Settles the invoice above'}
                </span>
                {renderBody()}
              </div>
            </div>
          );
        },
      },
      {
        field: 'debit',
        headerText: `${isAr ? 'مدين (+)' : 'Debit (+)'} (${currency})`,
        width: 'w-32',
        align: 'left',
        isMonetary: true,
        render: (r) => {
          const itemCurr = (r.currency || 'IQD').toUpperCase();
          const sym = itemCurr.includes('USD') || itemCurr.includes('$') ? '$' : 'IQD';
          return r.debit > 0 ? (
            <div className="flex items-center gap-1 font-black tabular-nums text-rose-700 text-[12.5px] justify-end font-mono" dir="ltr">
              <span>{r.debit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              <span className="text-[9.5px] font-bold text-rose-700 bg-rose-50 px-1 py-0.2 rounded border border-rose-200">{sym}</span>
            </div>
          ) : (
            <span className="text-slate-300 text-center block w-full">—</span>
          );
        },
      },
      {
        field: 'credit',
        headerText: `${isAr ? 'دائن (-)' : 'Credit (-)'} (${currency})`,
        width: 'w-32',
        align: 'left',
        isMonetary: true,
        render: (r) => {
          const itemCurr = (r.currency || 'IQD').toUpperCase();
          const sym = itemCurr.includes('USD') || itemCurr.includes('$') ? '$' : 'IQD';
          return r.credit > 0 ? (
            <div className="flex items-center gap-1 font-black tabular-nums text-emerald-700 text-[12.5px] justify-end font-mono" dir="ltr">
              <span>{r.credit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              <span className="text-[9.5px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">{sym}</span>
            </div>
          ) : (
            <span className="text-slate-300 text-center block w-full">—</span>
          );
        },
      },
      {
        field: 'runningBalance',
        headerText: isAr ? 'الرصيد المتراكم' : 'Running Balance',
        width: 'w-36',
        align: 'left',
        isPinned: true,
        isMonetary: true,
        render: (r) => {
          // If viewing ALL currencies together, do not calculate/show mixed running balance
          if (currency === 'ALL' || currency === 'كلاهما') {
            return (
              <div className="flex items-center justify-center w-full py-1 text-slate-300 font-mono text-sm">
                <span title={isAr ? 'اختر عملة محددة (دينار أو دولار) لاحتساب الرصيد التراكمي' : 'Select a single currency to view cumulative running balance'}>—</span>
              </div>
            );
          }

          const val = Number(r.runningBalance || 0);
          const itemCurr = (r.currency || 'IQD').toUpperCase();
          const sym = itemCurr.includes('USD') || itemCurr.includes('$') ? '$' : 'IQD';
          const isNegative = val < 0; // Credit / له

          return (
            <div className="flex flex-col items-end justify-center gap-0.5 py-0.5" dir="ltr">
              <div className={`flex items-center gap-1 font-black tabular-nums text-[12.5px] font-mono ${isNegative ? 'text-emerald-700' : 'text-rose-700'}`}>
                <span>{isNegative ? `- ${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : val.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                <span className="text-[9.5px] font-bold text-slate-500 bg-slate-100 px-1 py-0.2 rounded border border-slate-200">{sym}</span>
              </div>
              <span className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded ${isNegative ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                {isNegative ? (isAr ? 'رصيد / دائن (له)' : 'Credit (Payable)') : (isAr ? 'طلب / مدين (عليه)' : 'Debit (Claim)')}
              </span>
            </div>
          );
        },
      },
      {
        field: 'entryUser',
        headerText: isAr ? 'موظف الإدخال' : 'Entry User',
        width: 'w-28',
        align: 'center',
        render: (r) => (
          <div className="flex items-center gap-1.5 justify-center text-slate-800 font-semibold text-[11.5px] truncate">
            <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[9.5px] font-bold">
              <IconUser size={11} />
            </div>
            <span className="truncate">{r.entryUser || r.user || (isAr ? 'النظام' : 'System')}</span>
          </div>
        ),
      },
      {
        field: 'user',
        headerText: isAr ? 'موظف الإصدار' : 'Issuing Agent',
        width: 'w-28',
        align: 'center',
        render: (r) => (
          <div className="flex items-center gap-1.5 justify-center text-slate-800 font-semibold text-[11.5px] truncate">
            <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center text-[9.5px] font-bold">
              <IconUserCheck size={11} />
            </div>
            <span className="truncate">{r.user}</span>
          </div>
        ),
      },

    ],
    [currency, isAr]
  );

  const handleOpenDocument = useCallback(async (row: any) => {
    if (!row) return;

    /*
     * المستند الناشئ عن خدمة يُفتح في محرّر خدمته لا في نافذة سند.
     *
     * ويُعاد جلبه من الخادم بمعرّفه لأن نسخة القائمة مختصرة — بلا مسافرين ولا
     * تفاصيل شراء — والمطلوب أن تُعرض بيانات التذكرة كاملة عند التعديل. وإن
     * تعذّر الجلب نُكمل بالنسخة المتوفرة بدل أن نترك المستخدم أمام لا شيء.
     */
    const serviceKind = String(row.serviceKind || '').toUpperCase();
    if (serviceKind === 'GROUP' || row.groupId || row.voucherType === 'GROUP') {
      if (row.groupId) {
        navigate('/groups', { state: { openGroupId: row.groupId } });
        return;
      }
      navigate('/groups');
      return;
    }

    if (serviceKind) {
      const docId = row.ticketId || row.ticketRaw?.id || null;
      let record: any = row.ticketRaw || row.ticket || null;

      if (docId) {
        setOpeningDocId(String(row.id));
        try {
          record = (await ticketsApi.getOne(docId)) || record;
        } catch {
          /* النسخة المختصرة تكفي لفتح المحرّر حتى لو تعذّر التحديث */
        } finally {
          setOpeningDocId(null);
        }
      }

      if (record) {
        if (serviceKind === 'VISA') {
          setEditingVisaData(record);
          setVisaModalOpened(true);
        } else {
          setEditingTicketData(record);
          setTicketModalOpened(true);
        }
        return;
      }

      showErrorNotification(
        isAr ? 'تعذّر فتح المستند' : 'Could Not Open Document',
        isAr ? 'لم يُعثر على سجل الخدمة المرتبط بهذه الحركة.' : 'The service record linked to this movement was not found.'
      );
      return;
    }

    const dt = String(row.docType || '').toLowerCase();
    const isTicket =
      row.voucherType === 'TICKET' ||
      dt.includes('تذكرة') ||
      dt.includes('ticket') ||
      dt.includes('تأشيرة') ||
      dt.includes('visa');

    if (isTicket) {
      if (row.ticketRaw) {
        setEditingTicketData(row.ticketRaw);
        setTicketModalOpened(true);
        return;
      }
      const ticketId = row.ticketId || (row.id ? String(row.id).replace('ticket_cust_', '').replace('ticket_supp_', '').replace('ticket_cashbox_', '').replace('ticket_cust_cash_receipt_', '') : null);
      if (ticketId) {
        try {
          const fetched = await ticketsApi.getOne(ticketId);
          if (fetched) {
            setEditingTicketData(fetched);
            setTicketModalOpened(true);
            return;
          }
        } catch (e) {
          console.warn('Could not fetch ticket details:', e);
        }
      }
      if (row.ticketRaw || row.ticket) {
        setEditingTicketData(row.ticketRaw || row.ticket);
        setTicketModalOpened(true);
        return;
      }
    }

    // It's a financial voucher or journal entry
    let vType: 'RECEIPT' | 'PAYMENT' | 'EXCHANGE' | 'JOURNAL' = 'JOURNAL';
    const vNum = String(row.voucherNumber || row.entryNumber || '').toUpperCase();

    if (row.voucherType === 'RECEIPT' || dt.includes('قبض') || dt.includes('receipt') || vNum.includes('RV')) {
      vType = 'RECEIPT';
    } else if (row.voucherType === 'PAYMENT' || dt.includes('دفع') || dt.includes('صرف') || dt.includes('payment') || vNum.includes('PV')) {
      vType = 'PAYMENT';
    } else if (row.voucherType === 'EXCHANGE' || dt.includes('صرافة') || dt.includes('exchange')) {
      vType = 'EXCHANGE';
    }

    // Identify voucher ID or journal entry ID
    const vId = row.voucherId || row.journalEntryId || (row.id ? String(row.id).split('_')[0] : undefined);

    setVoucherModalType(vType);
    setEditVoucherId(vId);
    setVoucherModalOpened(true);
  }, [isAr]);

  /*
   * الحذف يُصيب المستند نفسه لا سطرَه.
   *
   * صفوف الكشف مشتقّة: التذكرة الواحدة تُنتج سطر بيعٍ وسطرَ سدادٍ نقدي، والسند
   * يُنتج سطراً لكل حساب. فحذف «الصف» بلا معناه يترك نصف الحركة معلّقاً. لذلك
   * يُحدَّد المستند الأصل — تذكرةً أو سنداً أو قيداً — ويُحذف، وتُرفع معه كل
   * أسطره من الشاشة فوراً؛ وإن ردّ الخادم بخطأ عادت كما كانت.
   */
  const resolveDeleteTarget = useCallback((row: any) => {
    const serviceKind = String(row?.serviceKind || '').toUpperCase();
    const ticketId = serviceKind ? row?.ticketId || row?.ticketRaw?.id || null : null;
    if (ticketId) {
      return {
        endpoint: `/api/tickets/${ticketId}`,
        label: serviceKindLabel(serviceKind as ServiceKind, isAr),
        matches: (m: any) => (m.ticketId || m.ticketRaw?.id || null) === ticketId,
      };
    }

    const vType = String(row?.voucherType || '').toUpperCase();
    if (row?.voucherId && (vType === 'RECEIPT' || vType === 'PAYMENT')) {
      return {
        endpoint: `/api/${vType === 'RECEIPT' ? 'receipt' : 'payment'}-vouchers/${row.voucherId}`,
        label: vType === 'RECEIPT' ? (isAr ? 'سند القبض' : 'the receipt voucher') : (isAr ? 'سند الدفع' : 'the payment voucher'),
        matches: (m: any) => m.voucherId === row.voucherId,
      };
    }

    if (row?.journalEntryId) {
      return {
        endpoint: `/api/journal-entries/${row.journalEntryId}`,
        label: isAr ? 'القيد' : 'the journal entry',
        matches: (m: any) => m.journalEntryId === row.journalEntryId,
      };
    }

    return null;
  }, [isAr]);

  const handleConfirmDelete = useCallback(async () => {
    const row = deleteTarget;
    if (!row) return;

    const target = resolveDeleteTarget(row);
    if (!target) {
      showErrorNotification(
        isAr ? 'تعذّر الحذف' : 'Delete Unavailable',
        isAr ? 'هذه الحركة محسوبة ولا تقابلها مستند قابل للحذف.' : 'This movement is derived and has no deletable document.'
      );
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
      return;
    }

    const snapshot = statementMovements;
    setDeletingRow(true);
    setStatementMovements((prev) => prev.filter((m) => !target.matches(m)));
    setDeleteConfirmOpen(false);
    setDeleteTarget(null);

    try {
      await apiRequest(target.endpoint, { method: 'DELETE' });
      showSuccessNotification(
        isAr ? 'تم الحذف' : 'Deleted',
        isAr ? `تم حذف ${target.label} وكل حركاته من الكشف.` : `Deleted ${target.label} and all of its statement lines.`
      );
    } catch (err: any) {
      setStatementMovements(snapshot);
      showErrorNotification(
        isAr ? 'خطأ في الحذف' : 'Delete Error',
        err?.message || (isAr ? 'تعذّر حذف المستند' : 'Failed to delete the document')
      );
    } finally {
      setDeletingRow(false);
    }
  }, [deleteTarget, resolveDeleteTarget, statementMovements, isAr]);

  // الرصيد الافتتاحي والرصيد السابق سطران محسوبان لا مستندان، فلا يُعدَّلان ولا يُحذفان.
  const isDerivedBalanceRow = useCallback(
    (row: any) => ['OPENING', 'PREVIOUS'].includes(String(row?.voucherType || '').toUpperCase()),
    []
  );

  const actionMenuItems: AccountingActionMenuItem[] = useMemo(
    () => [
      {
        label: isAr ? 'تعديل' : 'Edit',
        icon: IconEdit,
        hidden: isDerivedBalanceRow,
        // سطر السداد ليس مستنداً يُحرَّر، بل أثرٌ لفاتورته — والتعديل يقع عليها هي.
        disabled: (row: any) => !!row?.isServiceSettlement,
        description: (row: any) =>
          row?.isServiceSettlement
            ? isAr
              ? 'التعديل يتم من سطر الفاتورة'
              : 'Edit from the invoice line'
            : isAr
            ? 'يفتح المستند بكامل بياناته'
            : 'Opens the full document',
        onClick: (row: any) => {
          handleOpenDocument(row);
        },
      },
      {
        label: isAr ? 'حذف' : 'Delete',
        icon: IconTrash,
        color: 'red',
        hidden: isDerivedBalanceRow,
        description: isAr ? 'يحذف المستند وكل أسطره' : 'Removes the document and all its lines',
        onClick: (row: any) => {
          setDeleteTarget(row);
          setDeleteConfirmOpen(true);
        },
      },
    ],
    [handleOpenDocument, isDerivedBalanceRow, isAr]
  );

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1750px] mx-auto w-full select-none font-sans" dir={direction}>
      {/* ── 1. SUMMARY KPI FINANCIAL CARDS (TOP SECTION) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 no-print">
        {/* Card 1: Account Header & Opening */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">{isAr ? 'الحساب ورصيد البداية' : 'Account & Opening'}</span>
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#F45A0A] border border-orange-100 flex items-center justify-center font-bold">
              <IconWallet size={16} />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-base font-black text-slate-900 truncate">
              {selectedAccount ? (isAr ? selectedAccount.nameAr : (selectedAccount.nameEn || selectedAccount.nameAr)) : (isAr ? 'لم يتم اختيار حساب' : 'No Account Selected')}
            </div>
            <div className="text-xs font-mono font-bold text-slate-500 mt-1 flex items-center gap-1.5" dir="ltr">
              {selectedAccount ? (
                <>
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">
                    {selectedAccount.code}
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-600 font-semibold">{isAr ? 'افتتاحي:' : 'Op:'}</span>
                  <span className="font-black text-slate-800">{(openingBalIQD || 0).toLocaleString()} IQD</span>
                </>
              ) : (
                <span className="text-slate-400 font-sans text-xs">{isAr ? 'اختر حساباً للبدء' : 'Select an account to begin'}</span>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Total Debits (عليك / طلب) */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">{isAr ? 'إجمالي المدين (طلب +)' : 'Total Debits (+)'}</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center font-bold">
              <IconArrowDownLeft size={16} />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-rose-700 font-mono tracking-tight tabular-nums" dir="ltr">
              {(totalDebitIQD || 0).toLocaleString()}{' '}
              <span className="text-xs font-sans font-bold text-slate-500">IQD</span>
            </div>
            {totalDebitUSD !== 0 && (
              <div className="text-xs font-bold text-rose-600 font-mono mt-0.5 tabular-nums" dir="ltr">
                ${(totalDebitUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Total Credits (لك / مدفوع) */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">{isAr ? 'إجمالي الدائن (مدفوع -)' : 'Total Credits (-)'}</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center font-bold">
              <IconArrowUpRight size={16} />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-emerald-700 font-mono tracking-tight tabular-nums" dir="ltr">
              {(totalCreditIQD || 0).toLocaleString()}{' '}
              <span className="text-xs font-sans font-bold text-slate-500">IQD</span>
            </div>
            {totalCreditUSD !== 0 && (
              <div className="text-xs font-bold text-emerald-600 font-mono mt-0.5 tabular-nums" dir="ltr">
                ${(totalCreditUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            )}
          </div>
        </div>

        {/* Card 4: Net Balance & Dynamic Status */}
        <div className={`p-4.5 rounded-2xl border shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between ${
          balanceIQD === 0 && selectedAccount
            ? 'bg-slate-50 border-slate-200'
            : balanceIQD > 0
              ? 'bg-gradient-to-br from-white via-rose-50/20 to-rose-50/40 border-rose-200/80'
              : 'bg-gradient-to-br from-white via-emerald-50/20 to-emerald-50/40 border-emerald-200/80'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">{isAr ? 'صافي الرصيد الختامي' : 'Net Closing Balance'}</span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border ${
                !selectedAccount
                  ? 'bg-slate-100 text-slate-500 border-slate-200'
                  : balanceIQD === 0
                    ? 'bg-slate-100 text-slate-700 border-slate-300'
                    : balanceIQD > 0
                      ? 'bg-rose-100/80 text-rose-800 border-rose-300'
                      : 'bg-emerald-100/80 text-emerald-800 border-emerald-300'
              }`}
            >
              {!selectedAccount
                ? (isAr ? 'غير محدد' : 'Unset')
                : balanceIQD === 0
                  ? (isAr ? 'خالص الرصيد ⚖️' : 'Settled ⚖️')
                  : balanceIQD > 0
                    ? (isAr ? 'المطلوب منك (مدين 🔴)' : 'Debit (Claim 🔴)')
                    : (isAr ? 'الرصيد لك (دائن 🟢)' : 'Credit (Payable 🟢)')}
            </span>
          </div>
          <div className="mt-2.5">
            <div className={`text-2xl sm:text-3xl font-black font-mono tracking-tight tabular-nums ${
              !selectedAccount ? 'text-slate-400' : balanceIQD >= 0 ? 'text-rose-700' : 'text-emerald-700'
            }`} dir="ltr">
              {Math.abs(balanceIQD || 0).toLocaleString()}{' '}
              <span className="text-xs font-sans font-bold text-slate-500">IQD</span>
            </div>
            {balanceUSD !== 0 && (
              <div className={`text-xs font-bold font-mono mt-0.5 tabular-nums ${balanceUSD >= 0 ? 'text-rose-600' : 'text-emerald-600'}`} dir="ltr">
                ${Math.abs(balanceUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. MODERN CONTROL TOOLBAR (UNIFIED & CLEAN) ── */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs no-print flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Left Side: Account Search + Date Range */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
          {/* Account Search Combobox */}
          <div className="flex-1 min-w-[260px] max-w-md relative">
            <div className="relative">
              <IconSearch size={16} className="absolute top-1/2 -translate-y-1/2 start-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={accountSearch}
                onChange={(e) => {
                  setAccountSearch(e.target.value);
                  setShowAccountDropdown(true);
                  if (!e.target.value) setSelectedAccountId('');
                }}
                onFocus={() => setShowAccountDropdown(true)}
                onBlur={() => setTimeout(() => setShowAccountDropdown(false), 220)}
                placeholder={isAr ? 'ابحث عن الحساب بالاسم أو الرمز...' : 'Search account by name or code...'}
                className="w-full h-11 ps-10 pe-9 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white focus:bg-white focus:border-[#F45A0A] focus:ring-3 focus:ring-[#F45A0A]/10 text-xs font-bold text-slate-900 placeholder:text-slate-400 outline-none transition-all shadow-2xs"
              />
              {accountSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setAccountSearch('');
                    setSelectedAccountId('');
                    setStatementMovements([]);
                    setHasSearched(false);
                  }}
                  className="absolute top-1/2 -translate-y-1/2 end-3 text-slate-400 hover:text-red-500 cursor-pointer transition-colors"
                >
                  <IconX size={15} />
                </button>
              )}
            </div>

            {/* Dropdown Popup */}
            {showAccountDropdown && filteredAccounts.length > 0 && (
              <div className="absolute z-50 top-full start-0 end-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-72 overflow-y-auto divide-y divide-slate-100 font-sans">
                {filteredAccounts.slice(0, 35).map((acc) => (
                  <button
                    key={acc.id}
                    onMouseDown={() => selectAccount(acc)}
                    className={`w-full text-start px-3.5 py-2.5 text-xs hover:bg-orange-50 transition-colors cursor-pointer flex items-center justify-between ${
                      selectedAccountId === acc.id ? 'bg-orange-50/90 text-[#C2410C]' : 'text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]" dir="ltr">
                        {acc.code}
                      </span>
                      <span className="font-bold truncate">{isAr ? acc.nameAr : (acc.nameEn || acc.nameAr)}</span>
                    </div>
                    <Badge size="xs" color="gray" variant="light" className="shrink-0 font-semibold">
                      {acc.type}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Date Range Picker */}
          <div className="shrink-0">
            <AccountingDateRangePicker
              withTime={false}
              startDate={startDate}
              endDate={endDate}
              onChange={(start, end) => {
                setStartDate(start);
                setEndDate(end);
              }}
            />
          </div>
        </div>

        {/* Right Side: Currency, Actions, Print, Filter Toggle */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => handleFetchStatement(true)}
            disabled={!selectedAccountId || loading}
            className="h-11 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
            title={isAr ? 'تحديث الكشف من الخادم' : 'Refresh Statement'}
          >
            <IconRefresh size={16} className={loading ? 'animate-spin text-[#F45A0A]' : 'text-slate-500'} />
            <span className="hidden sm:inline">{isAr ? 'تحديث' : 'Refresh'}</span>
          </button>

          {/* Actions & Export Menu */}
          <Menu position="bottom-end" shadow="xl" width={190} radius="md">
            <Menu.Target>
              <button
                type="button"
                className="h-11 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <IconDotsVertical size={16} className="text-slate-500" />
                <span>{isAr ? 'الإجراءات والتصدير' : 'Actions & Export'}</span>
                <IconChevronDown size={12} className="text-slate-400" />
              </button>
            </Menu.Target>
            <Menu.Dropdown className="text-xs p-1.5 space-y-1 font-sans" dir={direction}>
              <Menu.Item
                leftSection={<IconFileSpreadsheet size={15} className="text-emerald-600" />}
                onClick={handleExportExcel}
                disabled={!calculatedRows || calculatedRows.length === 0}
                className="font-bold text-slate-700"
              >
                {isAr ? 'تصدير Excel (XLSX)' : 'Export Excel'}
              </Menu.Item>
              <Menu.Item
                leftSection={<IconFileTypePdf size={15} className="text-red-600 font-bold" />}
                onClick={() => setQuickExportModalOpened(true)}
                disabled={!selectedAccountId}
                className="font-bold text-slate-700"
              >
                {isAr ? 'تصدير كشف PDF سريع' : 'Quick PDF Export'}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                leftSection={<IconPrinter size={15} className="text-blue-600" />}
                onClick={() => setPrintModalOpened(true)}
                disabled={!selectedAccountId}
                className="font-bold text-slate-700"
              >
                {isAr ? 'طباعة الكشف الرسمي HD' : 'Print Statement Sheet'}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>

          {/* New Financial Voucher Button with Menu */}
          <Menu position="bottom-end" shadow="xl" width={200} radius="md">
            <Menu.Target>
              <button
                type="button"
                className="h-11 px-4 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-black text-xs shadow-md shadow-orange-500/20 transition-all flex items-center gap-2 cursor-pointer hover:shadow-lg active:scale-98"
              >
                <IconPlus size={16} stroke={2.5} />
                <span>{isAr ? 'إضافة سند مالي' : 'New Voucher'}</span>
                <IconChevronDown size={12} className="text-white/80" />
              </button>
            </Menu.Target>
            <Menu.Dropdown className="text-xs p-1.5 space-y-1 font-sans" dir={direction}>
              <Menu.Item
                leftSection={<IconArrowDownLeft size={15} className="text-emerald-600" />}
                onClick={() => {
                  setVoucherModalType('RECEIPT');
                  setVoucherModalOpened(true);
                }}
                className="font-bold text-slate-700"
              >
                {isAr ? 'سند قبض مالي' : 'Receipt Voucher'}
              </Menu.Item>
              <Menu.Item
                leftSection={<IconArrowUpRight size={15} className="text-rose-600" />}
                onClick={() => {
                  setVoucherModalType('PAYMENT');
                  setVoucherModalOpened(true);
                }}
                className="font-bold text-slate-700"
              >
                {isAr ? 'سند دفع وصرف' : 'Payment Voucher'}
              </Menu.Item>
              <Menu.Item
                leftSection={<IconArrowsExchange size={15} className="text-amber-600" />}
                onClick={() => {
                  setVoucherModalType('EXCHANGE');
                  setVoucherModalOpened(true);
                }}
                className="font-bold text-slate-700"
              >
                {isAr ? 'سند صرافة وتحويل' : 'FX Transfer Voucher'}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                leftSection={<IconFileText size={15} className="text-orange-600" />}
                onClick={() => {
                  setVoucherModalType('JOURNAL');
                  setVoucherModalOpened(true);
                }}
                className="font-bold text-slate-700"
              >
                {isAr ? 'سند قيد محاسبي' : 'Journal Voucher'}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>

          {/* Direct Print Button */}
          <button
            type="button"
            onClick={() => setPrintModalOpened(true)}
            disabled={!selectedAccountId}
            className="h-11 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer hover:shadow-sm disabled:opacity-50"
          >
            <IconPrinter size={16} className="text-slate-500" />
            <span>{isAr ? 'طباعة الكشف' : 'Print Statement'}</span>
          </button>

          {/* Toggle Sidebar Filter Button */}
          <button
            type="button"
            onClick={() => setFiltersVisible(!filtersVisible)}
            className={`h-11 px-3 rounded-xl border transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs ${
              filtersVisible
                ? 'bg-orange-50/80 border-orange-200 text-[#F45A0A] font-bold'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold'
            }`}
            title={isAr ? 'إظهار/إخفاء الفلاتر الجانبية' : 'Toggle Filters Sidebar'}
          >
            <IconFilter size={16} />
            <span className="text-xs">{isAr ? 'الفلاتر' : 'Filters'}</span>
          </button>
        </div>
      </div>

      {/* ── 3. MAIN WORKSPACE (Collapsible Sidebar Filters + Transactions Grid) ── */}
      <div className="flex items-start gap-3.5 w-full">
        {/* Collapsible Sidebar Filter Panel */}
        {filtersVisible && (
          <div className="w-64 bg-white rounded-2xl border border-slate-200/90 shadow-xs p-3.5 space-y-3.5 shrink-0 no-print">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2 font-black text-xs text-slate-900">
                <IconAdjustmentsHorizontal size={16} className="text-[#F45A0A]" />
                <span>{isAr ? 'فلاتر الكشف' : 'Statement Filters'}</span>
              </div>
              <span className="text-[10.5px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                {calculatedRows.length} {isAr ? 'حركة' : 'items'}
              </span>
            </div>

            {/* Active Period + Reset */}
            <div className="flex items-center justify-between gap-2 -mt-1.5">
              <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 truncate" dir="ltr">
                {rangeStartDay || '—'} ➔ {rangeEndDay || '—'}
              </span>
              <button
                type="button"
                onClick={resetAllFilters}
                className="text-[10.5px] font-bold text-[#F45A0A] hover:underline cursor-pointer shrink-0"
                title={isAr ? 'إرجاع كل الفلاتر للوضع الافتراضي' : 'Reset all filters'}
              >
                {isAr ? 'تصفير الفلاتر' : 'Reset'}
              </button>
            </div>

            {/* Filter Tabs (Movements vs Services) */}
            <Tabs defaultValue="movements" color="orange" radius="md">
              <Tabs.List grow className="mb-2 font-bold text-xs">
                <Tabs.Tab value="movements">{isAr ? 'الحركات' : 'Movements'}</Tabs.Tab>
                <Tabs.Tab value="services">{isAr ? 'الخدمات' : 'Services'}</Tabs.Tab>
              </Tabs.List>

              {/* Panel 1: Movements */}
              <Tabs.Panel value="movements" className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px] px-1 mb-1">
                  <span className="text-slate-400 font-bold">{isAr ? 'التحكم السريع' : 'Quick Toggle'}</span>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => toggleAllMovements(true)} className="text-[11px] text-emerald-600 hover:underline font-bold cursor-pointer">
                      {isAr ? 'تشغيل' : 'All'}
                    </button>
                    <span className="text-slate-300">|</span>
                    <button type="button" onClick={() => toggleAllMovements(false)} className="text-[11px] text-rose-500 hover:underline font-bold cursor-pointer">
                      {isAr ? 'إطفاء' : 'None'}
                    </button>
                  </div>
                </div>

                {MOVEMENT_FILTERS.map((f) => (
                  <div
                    key={f.key}
                    onClick={() => toggleFilter(f.key)}
                    className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                      activeFilters[f.key] ? 'bg-white border-slate-200 shadow-2xs' : 'bg-slate-50 border-transparent opacity-40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${f.color}15`, color: f.color }}>
                        <f.icon size={13} />
                      </div>
                      <span className="font-bold text-slate-800 text-xs">{f.label}</span>
                    </div>
                    <Switch size="xs" color="orange" checked={activeFilters[f.key]} onChange={() => toggleFilter(f.key)} />
                  </div>
                ))}

                {/* Balance Rollup Filters */}
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 px-1 block">{isAr ? 'الأرصدة المرحّلة' : 'Carried Balances'}</span>
                  {BALANCE_FILTERS.map((f) => (
                    <div
                      key={f.key}
                      onClick={() => toggleFilter(f.key)}
                      className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                        activeFilters[f.key] ? 'bg-white border-slate-200 shadow-2xs' : 'bg-slate-50 border-transparent opacity-40'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${f.color}15`, color: f.color }}>
                          <f.icon size={13} />
                        </div>
                        <span className="font-bold text-slate-800 text-xs">{f.label}</span>
                      </div>
                      <Switch size="xs" color="orange" checked={activeFilters[f.key]} onChange={() => toggleFilter(f.key)} />
                    </div>
                  ))}
                </div>
              </Tabs.Panel>

              {/* Panel 2: Services */}
              <Tabs.Panel value="services" className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px] px-1 mb-1">
                  <span className="text-slate-400 font-bold">{isAr ? 'التحكم السريع' : 'Quick Toggle'}</span>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => toggleAllServices(true)} className="text-[11px] text-emerald-600 hover:underline font-bold cursor-pointer">
                      {isAr ? 'تشغيل' : 'All'}
                    </button>
                    <span className="text-slate-300">|</span>
                    <button type="button" onClick={() => toggleAllServices(false)} className="text-[11px] text-rose-500 hover:underline font-bold cursor-pointer">
                      {isAr ? 'إطفاء' : 'None'}
                    </button>
                  </div>
                </div>

                {SERVICE_FILTERS.map((f) => (
                  <div
                    key={f.key}
                    onClick={() => toggleFilter(f.key)}
                    className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                      activeFilters[f.key] ? 'bg-white border-slate-200 shadow-2xs' : 'bg-slate-50 border-transparent opacity-40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${f.color}15`, color: f.color }}>
                        <f.icon size={13} />
                      </div>
                      <span className="font-bold text-slate-800 text-xs">{f.label}</span>
                    </div>
                    <Switch size="xs" color="orange" checked={activeFilters[f.key]} onChange={() => toggleFilter(f.key)} />
                  </div>
                ))}
              </Tabs.Panel>
            </Tabs>

            {/* Inner Statement Text Search */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-[10.5px] font-bold text-slate-400 mb-1">
                {isAr ? 'بحث نصي داخل الكشف' : 'Search Within Ledger'}
              </label>
              <div className="relative">
                <IconSearch size={13} className="absolute top-1/2 -translate-y-1/2 start-2.5 text-slate-400" />
                <input
                  type="text"
                  value={innerSearch}
                  onChange={(e) => setInnerSearch(e.target.value)}
                  placeholder={isAr ? 'رقم السند، PNR، البيان...' : 'Voucher #, PNR, Memo...'}
                  className="w-full h-8 ps-8 pe-7 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 placeholder:text-slate-400 outline-none focus:bg-white focus:border-[#F45A0A]"
                />
                {innerSearch && (
                  <button type="button" onClick={() => setInnerSearch('')} className="absolute top-1/2 -translate-y-1/2 end-2 text-slate-400 hover:text-slate-700 cursor-pointer">
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Currency Selector */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-[10.5px] font-bold text-slate-400 mb-1">
                {isAr ? 'عرض العملة' : 'Currency Filter'}
              </label>
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
                {['ALL', 'IQD', 'USD'].map((c) => {
                  const isActive = currency === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCurrency(c)}
                      className={`py-1 rounded-lg transition-all cursor-pointer ${
                        isActive ? 'bg-[#F45A0A] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                      }`}
                    >
                      {c === 'ALL' ? (isAr ? 'الكل' : 'ALL') : c === 'USD' ? '$ USD' : 'IQD'}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Transactions Accounting Grid */}
        <div className="flex-1 min-w-0">
          {!selectedAccountId && !hasSearched ? (
            <div className="text-center py-20 px-6 space-y-5 bg-white rounded-2xl border border-slate-200/90 shadow-xs">
              <div className="mx-auto w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center pointer-events-none">
                <img
                  src="/illustrations/organizing-papers.svg"
                  alt="Account Statement"
                  className="w-full h-full object-contain drop-shadow-sm transition-transform hover:scale-105"
                />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="font-black text-xl text-slate-900 tracking-tight">
                  {isAr ? 'اختر حساباً لعرض كشف الحساب المالي' : 'Select an Account to View Statement'}
                </h3>
                <p className="text-xs font-bold text-slate-500 leading-relaxed">
                  {isAr
                    ? 'قم بالبحث عن الحساب المحاسبي من الشريط العلوي واختياره لعرض الحركات المالية والمطابقات تلقائياً.'
                    : 'Search and select an account from the top toolbar to automatically load the financial ledger.'}
                </p>
              </div>
            </div>
          ) : (
            <AccountingGrid
              gridKey="statement_accounting_grid"
              data={calculatedRows}
              columnDefs={columnDefs}
              loading={loading}
              onRefresh={() => handleFetchStatement(true)}
              actionMenuItems={actionMenuItems}
              getRowClassName={(row: any) => (row?.isServiceSettlement ? 'bg-slate-50/60 hover:bg-orange-50/25 border-slate-100' : '')}
              onRowDoubleClick={handleOpenDocument}
              hideHeaderCard={true}
              hideFooter={false}
              customFooterSummary={
                selectedAccount && hasSearched ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs w-full py-2 px-3 bg-slate-50 border-t border-slate-200 font-sans" dir={direction}>
                    <div className="flex items-center gap-3 text-xs">
                      <div className="bg-white border border-slate-200 px-3 py-1 rounded-xl shadow-2xs">
                        <span className="text-[10px] text-slate-400 font-bold block">{isAr ? 'الحساب' : 'Account'}</span>
                        <span className="font-bold text-slate-900">
                          {selectedAccount.code} — {isAr ? selectedAccount.nameAr : (selectedAccount.nameEn || selectedAccount.nameAr)}
                        </span>
                      </div>
                      <div className="bg-white border border-slate-200 px-3 py-1 rounded-xl shadow-2xs">
                        <span className="text-[10px] text-slate-400 font-bold block">{isAr ? 'عدد الحركات' : 'Movements Count'}</span>
                        <span className="font-bold font-mono text-[#F45A0A]">{calculatedRows.length}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                      {/* IQD Currency Block */}
                      {(currency === 'ALL' || currency === 'IQD' || currency === 'كلاهما' || totalDebitIQD > 0 || totalCreditIQD > 0) && (
                        <div className="bg-white border border-slate-200/90 px-3 py-1.5 rounded-xl shadow-2xs text-xs flex items-center gap-2 font-sans">
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                            {isAr ? 'دينار (د.ع)' : 'IQD'}
                          </span>
                          <span className="text-slate-400 font-bold text-[11px]">{isAr ? 'مدين:' : 'Deb:'}</span>
                          <span className="font-bold text-rose-700 font-mono" dir="ltr">{(totalDebitIQD || 0).toLocaleString()}</span>
                          <span className="text-slate-300">|</span>
                          <span className="text-slate-400 font-bold text-[11px]">{isAr ? 'دائن:' : 'Cred:'}</span>
                          <span className="font-bold text-emerald-700 font-mono" dir="ltr">{(totalCreditIQD || 0).toLocaleString()}</span>
                          <span className="text-slate-300">|</span>
                          <span className="font-bold text-slate-800 text-[11px]">{isAr ? 'الصافي:' : 'Net:'}</span>
                          <span
                            className={`font-black font-mono px-1.5 py-0.5 rounded text-[11px] ${
                              balanceIQD >= 0
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                            dir="ltr"
                          >
                            {Math.abs(balanceIQD || 0).toLocaleString()} {isAr ? (balanceIQD >= 0 ? '(طلب عليه)' : '(رصيد له)') : (balanceIQD >= 0 ? 'Dr' : 'Cr')}
                          </span>
                        </div>
                      )}

                      {/* USD Currency Block */}
                      {(currency === 'ALL' || currency === 'USD' || currency === 'كلاهما' || totalDebitUSD > 0 || totalCreditUSD > 0) && (
                        <div className="bg-white border border-slate-200/90 px-3 py-1.5 rounded-xl shadow-2xs text-xs flex items-center gap-2 font-sans">
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {isAr ? 'دولار ($)' : 'USD'}
                          </span>
                          <span className="text-slate-400 font-bold text-[11px]">{isAr ? 'مدين:' : 'Deb:'}</span>
                          <span className="font-bold text-rose-700 font-mono" dir="ltr">${(totalDebitUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                          <span className="text-slate-300">|</span>
                          <span className="text-slate-400 font-bold text-[11px]">{isAr ? 'دائن:' : 'Cred:'}</span>
                          <span className="font-bold text-emerald-700 font-mono" dir="ltr">${(totalCreditUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                          <span className="text-slate-300">|</span>
                          <span className="font-bold text-slate-800 text-[11px]">{isAr ? 'الصافي:' : 'Net:'}</span>
                          <span
                            className={`font-black font-mono px-1.5 py-0.5 rounded text-[11px] ${
                              balanceUSD >= 0
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                            dir="ltr"
                          >
                            ${Math.abs(balanceUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} {isAr ? (balanceUSD >= 0 ? '(طلب عليه)' : '(رصيد له)') : (balanceUSD >= 0 ? 'Dr' : 'Cr')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null
              }
            />
          )}
        </div>
      </div>

      {/* ── 4. MOVEMENT DETAILS DRAWER ── */}
      <Drawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={
          <div className="flex items-center gap-2 font-bold text-slate-900 text-sm" dir={direction}>
            <IconFileText size={18} className="text-[#F45A0A]" />
            <span>{isAr ? 'تفاصيل الحركة المالية والمستند' : 'Transaction & Document Details'}</span>
          </div>
        }
        position={direction === 'rtl' ? 'left' : 'right'}
        size="md"
        radius="lg"
      >
        {selectedMovement && (
          <div className="space-y-4 text-xs font-sans" dir={direction}>
            <div className="p-4 bg-orange-50/60 border border-orange-200 rounded-xl space-y-1.5">
              <span className="text-[11px] text-[#C2410C] font-bold block">{isAr ? 'المستند ونوعه' : 'Document Type'}</span>
              <div className="text-base font-black text-slate-900 font-mono">
                {selectedMovement.docType} — #{selectedMovement.voucherNumber || selectedMovement.entryNumber}
              </div>
              <div className="text-xs text-slate-500 font-mono">
                {new Date(selectedMovement.date).toLocaleDateString('en-GB')}
                {selectedMovement.entryDate && (
                  <span className="ms-2">
                    {isAr ? 'إدخال:' : 'Entered:'}{' '}
                    {new Date(selectedMovement.entryDate).toLocaleDateString('en-GB')}{' '}
                    {new Date(selectedMovement.entryDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2.5">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <span className="text-slate-500 font-medium">{isAr ? 'البيان وشرح الحركة:' : 'Description:'}</span>
                <span className="font-bold text-slate-900">{selectedMovement.description || '—'}</span>
              </div>
              {selectedMovement.accountingDescription && selectedMovement.accountingDescription !== selectedMovement.description && (
                <div className="flex justify-between items-start gap-3 border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-medium shrink-0">{isAr ? 'الشرح المحاسبي:' : 'Ledger note:'}</span>
                  <span className="text-slate-700 text-end">{selectedMovement.accountingDescription}</span>
                </div>
              )}
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <span className="text-slate-500 font-medium">{isAr ? 'المبلغ المدين:' : 'Debit Amount:'}</span>
                <span className="font-mono font-bold text-rose-700" dir="ltr">{Number(selectedMovement.debit || 0).toLocaleString()} {selectedMovement.currency}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <span className="text-slate-500 font-medium">{isAr ? 'المبلغ الدائن:' : 'Credit Amount:'}</span>
                <span className="font-mono font-bold text-emerald-700" dir="ltr">{Number(selectedMovement.credit || 0).toLocaleString()} {selectedMovement.currency}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <span className="text-slate-500 font-medium">{isAr ? 'الرصيد المتراكم:' : 'Running Balance:'}</span>
                <span className="font-mono font-black text-slate-900" dir="ltr">{Number(selectedMovement.runningBalance || 0).toLocaleString()} {selectedMovement.currency}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">{isAr ? 'المستخدم المسؤول:' : 'Logged User:'}</span>
                <span className="font-bold text-slate-800">{selectedMovement.entryUser || selectedMovement.user || '—'}</span>
              </div>
            </div>

            {/* Edit / View Document Action */}
            <button
              type="button"
              onClick={() => {
                setDrawerOpen(false);
                handleOpenDocument(selectedMovement);
              }}
              className="w-full mt-3 py-2.5 px-4 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-colors"
            >
              <IconEdit size={16} />
              <span>{isAr ? 'فتح وتعديل المستند' : 'Open & Edit Document'}</span>
            </button>
          </div>
        )}
      </Drawer>

      {/* ── 5. PRINT & EXPORT MODALS ── */}
      {selectedAccount && (
        <>
          <AccountStatementPrintModal
            opened={printModalOpened}
            onClose={() => setPrintModalOpened(false)}
            accountName={isAr ? selectedAccount.nameAr : (selectedAccount.nameEn || selectedAccount.nameAr)}
            accountId={selectedAccount.id}
            accountCode={selectedAccount.code}
            accountPhone={selectedAccount.phone}
            accountEmail={selectedAccount.email}
            accountAddress={selectedAccount.address}
            startDate={rangeStartDay}
            endDate={rangeEndDay}
            rows={printRows}
            totals={{
              totalDebit,
              totalCredit,
              finalBalance: closingBalance,
              openingBalance: openingBalIQD,
              previousBalance: 0,
            }}
          />

          <AccountStatementQuickExportModal
            opened={quickExportModalOpened}
            onClose={() => setQuickExportModalOpened(false)}
            onOpenAdvancedPreview={() => setPrintModalOpened(true)}
            accountName={isAr ? selectedAccount.nameAr : (selectedAccount.nameEn || selectedAccount.nameAr)}
            accountId={selectedAccount.id}
            accountCode={selectedAccount.code}
            accountPhone={selectedAccount.phone}
            accountEmail={selectedAccount.email}
            accountAddress={selectedAccount.address}
            startDate={rangeStartDay}
            endDate={rangeEndDay}
            rows={printRows}
            totals={{
              totalDebit,
              totalCredit,
              finalBalance: closingBalance,
              openingBalance: openingBalIQD,
              previousBalance: 0,
            }}
          />
        </>
      )}

      {/* ── Financial Voucher Form Modal (Create / Edit) ── */}
      <FinancialVoucherForm
        opened={voucherModalOpened}
        onClose={() => {
          setVoucherModalOpened(false);
          setEditVoucherId(undefined);
        }}
        onSuccess={() => {
          setVoucherModalOpened(false);
          setEditVoucherId(undefined);
          handleFetchStatement(true);
        }}
        initialType={voucherModalType}
        initialVoucherType={voucherModalType}
        initialVoucherId={editVoucherId}
      />

      {/* ── Ticket Invoice Editor Workspace Modal (Create / Edit) ── */}
      <TicketInvoiceEditorWorkspace
        opened={ticketModalOpened}
        initialData={editingTicketData}
        onClose={() => {
          setTicketModalOpened(false);
          setEditingTicketData(null);
        }}
        onSuccess={() => {
          setTicketModalOpened(false);
          setEditingTicketData(null);
          handleFetchStatement(true);
        }}
      />

      {/* ── Visa Invoice Editor Workspace Modal (Edit) ── */}
      {visaModalOpened && (
        <React.Suspense
          fallback={(
            <div className="fixed inset-0 z-[9998] bg-white/95 backdrop-blur-sm flex items-center justify-center">
              <div className="flex items-center gap-3 text-sm font-bold text-slate-700">
                <Loader size="sm" color="orange" />
                <span>{isAr ? 'جارٍ فتح مساحة معاملة التأشيرة...' : 'Opening visa workspace...'}</span>
              </div>
            </div>
          )}
        >
          <VisaInvoiceEditorWorkspace
            opened={visaModalOpened}
            initialData={editingVisaData}
            onClose={() => {
              setVisaModalOpened(false);
              setEditingVisaData(null);
            }}
            onSuccess={() => {
              setVisaModalOpened(false);
              setEditingVisaData(null);
              handleFetchStatement(true);
            }}
          />
        </React.Suspense>
      )}

      {/* ── Opening a service document (fetching the full record) ── */}
      {openingDocId && (
        <div className="fixed inset-0 z-[9997] bg-slate-900/20 backdrop-blur-[2px] flex items-center justify-center no-print">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 px-5 py-4 flex items-center gap-3 text-sm font-bold text-slate-700">
            <Loader size="sm" color="orange" />
            <span>{isAr ? 'جارٍ فتح المستند بكامل بياناته...' : 'Loading the full document...'}</span>
          </div>
        </div>
      )}

      {/* ── Delete Document Confirmation ── */}
      <Modal
        opened={deleteConfirmOpen}
        onClose={() => {
          if (deletingRow) return;
          setDeleteConfirmOpen(false);
          setDeleteTarget(null);
        }}
        centered
        radius="lg"
        withCloseButton={false}
        size="md"
        overlayProps={{ backgroundOpacity: 0.35, blur: 2 }}
      >
        <div className="space-y-4 font-sans" dir={direction}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
              <IconAlertTriangle size={20} />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-black text-slate-900">
                {isAr ? 'حذف المستند نهائياً' : 'Delete this document'}
              </div>
              <div className="text-xs text-slate-500 leading-relaxed">
                {isAr
                  ? 'سيُحذف المستند وقيده المحاسبي معاً، وتختفي كل أسطره من هذا الكشف. لا يمكن التراجع.'
                  : 'The document and its journal entry are removed together, and every line of it disappears from this statement. This cannot be undone.'}
              </div>
            </div>
          </div>

          {deleteTarget && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500 font-medium">{isAr ? 'المستند:' : 'Document:'}</span>
                <span className="font-black text-slate-900">
                  {deleteTarget.docType} — {deleteTarget.voucherNumber && deleteTarget.voucherNumber !== '-' ? deleteTarget.voucherNumber : deleteTarget.entryNumber}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500 font-medium">{isAr ? 'التاريخ:' : 'Date:'}</span>
                <span className="font-mono font-bold text-slate-800" dir="ltr">
                  {new Date(deleteTarget.date).toLocaleDateString('en-GB')}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500 font-medium">{isAr ? 'المبلغ:' : 'Amount:'}</span>
                <span className="font-mono font-black text-slate-900" dir="ltr">
                  {Number(deleteTarget.debit || deleteTarget.credit || 0).toLocaleString()} {deleteTarget.currency}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={deletingRow}
              onClick={() => {
                setDeleteConfirmOpen(false);
                setDeleteTarget(null);
              }}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer transition-colors disabled:opacity-50"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              disabled={deletingRow}
              onClick={handleConfirmDelete}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer transition-colors disabled:opacity-50"
            >
              <IconTrash size={14} />
              <span>{isAr ? 'حذف نهائي' : 'Delete permanently'}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ReportsPage;
