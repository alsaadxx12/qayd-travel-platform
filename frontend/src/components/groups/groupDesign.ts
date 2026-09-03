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
  /** تاريخ الإصدار أو الحجز للمكوّن. */
  issueDate?: string;
  /** الكلفة كما أُدخلت. */
  cost: number;
  /** عملة كلفة المكوّن */
  currency?: 'IQD' | 'USD';
  /** هل الكلفة للمجموعة كلّها أم للمقعد الواحد؟ */
  perSeat: boolean;
  /** تفعيل أو تعطيل المكوّن */
  active?: boolean;
  note?: string;
}

export interface GroupTemplate {
  id: string;
  name: string;
  seats: number;
  currency: 'IQD' | 'USD';
  seatPrice: number;
  components: GroupComponent[];
}

export interface GroupCustomer {
  id: string;
  name: string;
  passport?: string;
  voucher?: string;
  fCode?: string;
  state?: string; // MR / MRS
  agent?: string;
  templateId?: string;
  templateName?: string;
  /** نقدي أو آجل. */
  payType: 'CASH' | 'CREDIT';
  sale: number;
  boxCash?: string;
  date?: string;
  notes?: string;
}

export type GroupSourcingType = 'READY_PACKAGE' | 'CUSTOM_ASSEMBLED' | 'FLIGHT_ONLY';

export interface GroupDesign {
  groupName: string;
  groupType: string;
  sourcingType?: GroupSourcingType;
  country: string;
  routeFrom: string;
  routeTo: string;
  travelDate: string;
  returnDate?: string;
  buyDate: string;
  seats: number;
  currency: 'IQD' | 'USD';
  /** سعر بيع المقعد المقترح — يُملأ به كل عميل جديد ثم يُعدَّل عند الحاجة. */
  seatPrice: number;
  /** المورد المباشر وسعر شراء الكروب الإجمالي في حال كان الكروب جاهزاً من مورد */
  supplierName?: string;
  supplierAccountId?: string;
  packageTotalCost?: number;
  packageCostPerSeat?: number;
  active: boolean;
  notes: string;
  templates: GroupTemplate[];
  components: GroupComponent[];
  customers: GroupCustomer[];
}

export const COMPONENT_KINDS: Array<{ kind: GroupComponentKind; ar: string; en: string }> = [
  { kind: 'TICKET', ar: 'تذكرة طيران', en: 'Flight Ticket' },
  { kind: 'HOTEL', ar: 'حجز فندق', en: 'Hotel Booking' },
  { kind: 'VISA', ar: 'تأشيرة فيزا', en: 'Visa' },
  { kind: 'INSURANCE', ar: 'تأمين سفر', en: 'Insurance' },
  { kind: 'TRANSPORT', ar: 'نقل وباصات', en: 'Transport' },
  { kind: 'GUIDE', ar: 'مرشد سياحي', en: 'Tour Guide' },
  { kind: 'PACKAGE', ar: 'باقة سياحية', en: 'Package' },
  { kind: 'EXPENSE', ar: 'مصروف عام', en: 'Global Expense' },
];

export const kindLabel = (kind: GroupComponentKind, isAr: boolean) =>
  COMPONENT_KINDS.find((k) => k.kind === kind)?.[isAr ? 'ar' : 'en'] || kind;

export const createDefaultTemplate = (seats = 1, currency: 'IQD' | 'USD' = 'USD', seatPrice = 0): GroupTemplate => ({
  id: `tpl-${Date.now()}`,
  name: 'قالب الأسعار الرئيسي (Standard)',
  seats,
  currency,
  seatPrice,
  components: [],
});

export const emptyDesign = (): GroupDesign => {
  const defaultTpl = createDefaultTemplate(1, 'USD', 0);
  return {
    groupName: '',
    groupType: 'FULL',
    sourcingType: 'READY_PACKAGE',
    country: 'العراق',
    routeFrom: '',
    routeTo: '',
    travelDate: '',
    returnDate: '',
    buyDate: new Date().toISOString().slice(0, 10),
    seats: 1,
    currency: 'USD',
    seatPrice: 0,
    supplierName: '',
    supplierAccountId: '',
    packageTotalCost: 0,
    packageCostPerSeat: 0,
    active: true,
    notes: '',
    templates: [defaultTpl],
    components: [],
    customers: [],
  };
};

/**
 * حساب تكاليف وأرباح القالب الفردي.
 */
export const computeTemplateTotals = (tpl: GroupTemplate) => {
  const seats = Math.max(1, Number(tpl.seats) || 1);
  let autoBuy = 0;
  let globalBuy = 0;
  let globalExpenses = 0;

  (tpl.components || []).forEach((c) => {
    const cost = Number(c.cost) || 0;
    if (c.kind === 'EXPENSE') {
      globalExpenses += cost;
    } else if (c.perSeat) {
      autoBuy += cost * seats;
    } else {
      globalBuy += cost;
    }
  });

  const totalCost = autoBuy + globalBuy + globalExpenses;
  const costPerSeat = Math.round((totalCost / seats) * 100) / 100;
  const totalSale = (Number(tpl.seatPrice) || 0) * seats;
  const profitPerSeat = (Number(tpl.seatPrice) || 0) - costPerSeat;
  const totalProfit = totalSale - totalCost;

  return {
    seats,
    autoBuy,
    globalBuy,
    globalExpenses,
    totalCost,
    costPerSeat,
    seatPrice: Number(tpl.seatPrice) || 0,
    totalSale,
    profitPerSeat,
    totalProfit,
  };
};

/**
 * ما يُحسب من التصميم لجميع القوالب والمستفيدين.
 */
export const computeGroupTotals = (design: GroupDesign) => {
  // Ensure templates exist
  const templates = design.templates && design.templates.length > 0
    ? design.templates
    : [
        {
          id: 'tpl-fallback',
          name: 'القالب الرئيسي',
          seats: design.seats || 1,
          currency: design.currency || 'USD',
          seatPrice: design.seatPrice || 0,
          components: design.components || [],
        },
      ];

  let sumSeats = 0;
  let sumBuy = 0;
  let sumExpenses = 0;
  let sumCost = 0;
  let sumExpectedSale = 0;

  templates.forEach((tpl) => {
    const tplTotals = computeTemplateTotals(tpl);
    sumSeats += tplTotals.seats;
    sumBuy += tplTotals.autoBuy + tplTotals.globalBuy;
    sumExpenses += tplTotals.globalExpenses;
    sumCost += tplTotals.totalCost;
    sumExpectedSale += tplTotals.totalSale;
  });

  const soldSeats = (design.customers || []).length;
  const effectiveSeats = Math.max(soldSeats, Number(design.seats) || 0, sumSeats, 1);
  const costPerSeat = Math.round((sumCost / effectiveSeats) * 100) / 100;
  const salesTotal = (design.customers || []).reduce((sum, c) => sum + (Number(c.sale) || 0), 0);

  return {
    seats: effectiveSeats,
    soldSeats,
    remainingSeats: Math.max(0, effectiveSeats - soldSeats),
    costPerSeat,
    costTotal: sumCost,
    sumBuy,
    sumExpenses,
    sumCost,
    sumExpectedSale,
    soldCost: costPerSeat * soldSeats,
    salesTotal,
    expectedSales: sumExpectedSale,
    profitPerSeat: (Number(design.seatPrice) || 0) - costPerSeat,
    realisedProfit: salesTotal - costPerSeat * soldSeats,
    expectedProfit: sumExpectedSale - sumCost,
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
    templates: design.templates,
    components: design.components,
    customers: design.customers,
    groupType: design.groupType,
    sourcingType: design.sourcingType || 'READY_PACKAGE',
    country: design.country,
    seatPrice: design.seatPrice,
    supplierName: design.supplierName,
    supplierAccountId: design.supplierAccountId,
    packageTotalCost: design.packageTotalCost,
    packageCostPerSeat: design.packageCostPerSeat,
    returnDate: design.returnDate,
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

  const restoredTemplates: GroupTemplate[] = Array.isArray(payload?.templates) && payload.templates.length > 0
    ? payload.templates
    : [
        {
          id: 'tpl-default',
          name: 'قالب الأسعار الرئيسي',
          seats: Math.max(seats, 1),
          currency: (String(ticket.currency || 'USD').toUpperCase() === 'IQD' ? 'IQD' : 'USD') as 'IQD' | 'USD',
          seatPrice: Number(payload?.seatPrice) || 0,
          components: Array.isArray(payload?.components) ? payload.components : [],
        },
      ];

  return {
    ...base,
    groupName: (ticket as any).groupName || ticket.reference || ticket.invoiceNumber || '',
    groupType: payload?.groupType || base.groupType,
    sourcingType: payload?.sourcingType || (payload?.components?.length > 0 ? 'CUSTOM_ASSEMBLED' : 'READY_PACKAGE'),
    country: payload?.country || base.country,
    routeFrom: routeParts[0] || '',
    routeTo: routeParts[1] || '',
    travelDate: ticket.travelDate ? String(ticket.travelDate).slice(0, 10) : '',
    returnDate: payload?.returnDate || (ticket.returnDate ? String(ticket.returnDate).slice(0, 10) : ''),
    buyDate: payload?.buyDate || (ticket.issueDate ? String(ticket.issueDate).slice(0, 10) : base.buyDate),
    seats: Math.max(seats, Number(payload?.customers?.length) || 1),
    currency: (String(ticket.currency || 'USD').toUpperCase() === 'IQD' ? 'IQD' : 'USD') as 'IQD' | 'USD',
    seatPrice: Number(payload?.seatPrice) || 0,
    supplierName: payload?.supplierName || ticket.supplierAccountName || '',
    supplierAccountId: payload?.supplierAccountId || ticket.supplierAccountId || '',
    packageTotalCost: Number(payload?.packageTotalCost ?? (payload?.packageCostPerSeat ? (payload.packageCostPerSeat * (payload.seats || 1)) : 0)),
    packageCostPerSeat: Number(payload?.packageCostPerSeat) || 0,
    active: payload?.active !== false,
    notes: userNotes,
    templates: restoredTemplates,
    components: Array.isArray(payload?.components) ? payload.components : (restoredTemplates[0]?.components || []),
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
