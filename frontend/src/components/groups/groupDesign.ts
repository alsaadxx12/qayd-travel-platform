import type { TicketData } from '../../api/tickets';

/**
 * نموذج الكروب، مختصراً من سبع نوافذ إلى ثلاثة مفاهيم.
 *
 * النظام القديم يوزّع الكروب على سبع شاشات: «تصميم الكروب» ثم «قالب الأسعار» ثم
 * «المشتريات» ثم «الباكج» ثم «البيع»… وهي في الحقيقة ثلاثة أشياء لا أكثر:
 *
 *   ١) الكروب نفسه   — اسمه ومساره وتاريخه.
 *   ٢) كلفة المقعد   — ممّ يتركّب: تذكرة، فندق، فيزا، تأمين، نقل، مرشد، باكج،
 *                       ومصاريف عامة. ولكل مكوّن مورده وكلفته.
 *   ٣) بيع المقاعد   — من أخذها، وبكم، وكيف دفع.
 *
 * فتُبنى الشاشة على هذه الثلاثة في خطوتين: الأولى (١+٢) لأنهما تصميم الكروب،
 * والثانية (٣) لأنها بيعُه.
 */

export type GroupComponentKind =
  | 'TICKET'
  | 'HOTEL'
  | 'VISA'
  | 'INSURANCE'
  | 'TRANSPORT'
  | 'GUIDE'
  | 'PACKAGE'
  | 'EXPENSE';

export interface GroupComponent {
  id: string;
  kind: GroupComponentKind;
  supplierName: string;
  /** معرّف حساب المورد في الشجرة، إن اختير من البحث. */
  supplierAccountId?: string;
  /** الكلفة كما أُدخلت. */
  cost: number;
  /** هل الكلفة للمجموعة كلّها أم للمقعد الواحد؟ */
  perSeat: boolean;
  note?: string;
}

export interface GroupCustomer {
  id: string;
  name: string;
  agent?: string;
  /** نقدي أو آجل. */
  payType: 'CASH' | 'CREDIT';
  sale: number;
  cashbox?: string;
  notes?: string;
}

export interface GroupDesign {
  groupName: string;
  groupType: string;
  country: string;
  routeFrom: string;
  routeTo: string;
  travelDate: string;
  buyDate: string;
  seats: number;
  currency: 'IQD' | 'USD';
  /** سعر بيع المقعد المقترح — يُملأ به كل عميل جديد ثم يُعدَّل عند الحاجة. */
  seatPrice: number;
  active: boolean;
  notes: string;
  components: GroupComponent[];
  customers: GroupCustomer[];
}

export const COMPONENT_KINDS: Array<{ kind: GroupComponentKind; ar: string; en: string }> = [
  { kind: 'TICKET', ar: 'تذكرة', en: 'Ticket' },
  { kind: 'HOTEL', ar: 'فندق', en: 'Hotel' },
  { kind: 'VISA', ar: 'تأشيرة', en: 'Visa' },
  { kind: 'INSURANCE', ar: 'تأمين', en: 'Insurance' },
  { kind: 'TRANSPORT', ar: 'نقل', en: 'Transport' },
  { kind: 'GUIDE', ar: 'مرشد', en: 'Guide' },
  { kind: 'PACKAGE', ar: 'باكج', en: 'Package' },
  { kind: 'EXPENSE', ar: 'مصروف عام', en: 'Expense' },
];

export const kindLabel = (kind: GroupComponentKind, isAr: boolean) =>
  COMPONENT_KINDS.find((k) => k.kind === kind)?.[isAr ? 'ar' : 'en'] || kind;

export const emptyDesign = (): GroupDesign => ({
  groupName: '',
  groupType: 'FULL',
  country: 'العراق',
  routeFrom: '',
  routeTo: '',
  travelDate: '',
  buyDate: new Date().toISOString().slice(0, 10),
  seats: 1,
  currency: 'IQD',
  seatPrice: 0,
  active: true,
  notes: '',
  components: [],
  customers: [],
});

/**
 * ما يُحسب من التصميم.
 *
 * المكوّن إمّا للمقعد أو للمجموعة، فيُوحَّد إلى كلفة المقعد قبل الجمع — وإلا
 * اختلط ثمنُ حافلةٍ واحدة بثمن تذكرةٍ لكل راكب.
 */
export const computeGroupTotals = (design: GroupDesign) => {
  const seats = Math.max(1, Number(design.seats) || 1);

  let costPerSeat = 0;
  let costTotal = 0;
  design.components.forEach((c) => {
    const value = Number(c.cost) || 0;
    if (c.perSeat) {
      costPerSeat += value;
      costTotal += value * seats;
    } else {
      costPerSeat += value / seats;
      costTotal += value;
    }
  });

  const soldSeats = design.customers.length;
  const salesTotal = design.customers.reduce((sum, c) => sum + (Number(c.sale) || 0), 0);
  const expectedSales = (Number(design.seatPrice) || 0) * seats;

  return {
    seats,
    soldSeats,
    remainingSeats: Math.max(0, seats - soldSeats),
    costPerSeat,
    costTotal,
    /** كلفة ما بيع فعلاً — وهي أساس الربح المحقق. */
    soldCost: costPerSeat * soldSeats,
    salesTotal,
    expectedSales,
    profitPerSeat: (Number(design.seatPrice) || 0) - costPerSeat,
    realisedProfit: salesTotal - costPerSeat * soldSeats,
    expectedProfit: expectedSales - costTotal,
  };
};

/*
 * حفظ التصميم مع التذكرة.
 *
 * الكروب يُحفظ تذكرةً موسومة GROUP_FARE، وجدول التذاكر لا يحمل عموداً للمكوّنات.
 * فتُكتب في كتلة معلَّمة داخل الملاحظات — كما تفعل السندات مع تقسيم مبالغها —
 * ويبقى نصّ المستخدم في الملاحظات كما كتبه، خارج الكتلة.
 *
 * المقايضة المصرَّح بها: المكوّنات هكذا ليست حقلاً يُستعلَم عنه في التقارير. حين
 * تُطلب تقارير على مستوى المكوّن يصير لها عمودٌ خاص في القاعدة.
 */
const MARKER_OPEN = '<<<GROUP_DESIGN:';
const MARKER_CLOSE = ':GROUP_DESIGN>>>';

export const encodeDesignIntoNotes = (userNotes: string, design: GroupDesign): string => {
  const payload = {
    components: design.components,
    customers: design.customers,
    groupType: design.groupType,
    country: design.country,
    seatPrice: design.seatPrice,
    active: design.active,
    buyDate: design.buyDate,
  };
  const clean = String(userNotes || '').trim();
  return `${clean}${clean ? '\n' : ''}${MARKER_OPEN}${JSON.stringify(payload)}${MARKER_CLOSE}`;
};

export const decodeNotes = (notes?: string | null) => {
  const raw = String(notes || '');
  const start = raw.indexOf(MARKER_OPEN);
  if (start === -1) return { userNotes: raw.trim(), payload: null as any };
  const end = raw.indexOf(MARKER_CLOSE, start);
  if (end === -1) return { userNotes: raw.trim(), payload: null as any };
  const json = raw.slice(start + MARKER_OPEN.length, end);
  let payload: any = null;
  try {
    payload = JSON.parse(json);
  } catch {
    payload = null;
  }
  return {
    userNotes: (raw.slice(0, start) + raw.slice(end + MARKER_CLOSE.length)).trim(),
    payload,
  };
};

/** قراءة تذكرة كروب محفوظة إلى تصميم قابل للتحرير. */
export const designFromTicket = (ticket?: TicketData | null): GroupDesign => {
  const base = emptyDesign();
  if (!ticket) return base;

  const { userNotes, payload } = decodeNotes(ticket.notes);
  const routeParts = String(ticket.route || '')
    .split(/\s*[-–>]\s*/)
    .filter(Boolean);

  const seats =
    (ticket.passengers || []).length ||
    Number(payload?.customers?.length) ||
    1;

  return {
    ...base,
    groupName: (ticket as any).groupName || ticket.reference || ticket.invoiceNumber || '',
    groupType: payload?.groupType || base.groupType,
    country: payload?.country || base.country,
    routeFrom: routeParts[0] || '',
    routeTo: routeParts[1] || '',
    travelDate: ticket.travelDate ? String(ticket.travelDate).slice(0, 10) : '',
    buyDate: payload?.buyDate || (ticket.issueDate ? String(ticket.issueDate).slice(0, 10) : base.buyDate),
    seats: Math.max(seats, Number(payload?.customers?.length) || 1),
    currency: (String(ticket.currency || 'IQD').toUpperCase() === 'USD' ? 'USD' : 'IQD') as 'IQD' | 'USD',
    seatPrice: Number(payload?.seatPrice) || 0,
    active: payload?.active !== false,
    notes: userNotes,
    components: Array.isArray(payload?.components) ? payload.components : [],
    customers: Array.isArray(payload?.customers)
      ? payload.customers
      : (ticket.passengers || []).map((p: any, i: number) => ({
          id: `c-${i}`,
          name: p.name || '',
          payType: 'CASH' as const,
          sale: Number(p.fareSell) || 0,
        })),
  };
};
