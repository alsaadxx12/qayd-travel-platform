import { ticketsApi, type TicketData } from './tickets';
import { allocateDocumentNumber } from '../utils/sequenceUtils';

export interface HotelRoomLine {
  id: string;
  roomType: 'SINGLE' | 'DOUBLE' | 'TRIPLE' | 'QUAD' | 'SUITE' | 'DELUXE';
  roomTypeName: string;
  roomsCount: number;
  nights: number;
  adoptNightsMultiplier: boolean;
  costPrice: number;
  salePrice: number;
  guestNames: string[];
  notes?: string;
}

export interface HotelBookingItem {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  hotelName: string;
  hotelAddress?: string;
  city?: string;
  country?: string;
  customerName: string;
  customerPhone?: string;
  customerAgent?: string;
  primaryGuestName?: string;
  customerId?: string;
  customerAccountId?: string;
  supplierName: string;
  supplierId?: string;
  supplierAccountId?: string;
  salesCashboxId?: string;
  salesCashboxName?: string;
  purchaseCashboxId?: string;
  purchaseCashboxName?: string;
  paymentType: string;
  currency: string;
  exchangeRate: number;
  rooms: HotelRoomLine[];
  voucherRef?: string;
  supplierRef?: string;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  discountAmount: number;
  totalCost: number;
  totalSale: number;
  netProfit: number;
  notes?: string;
  issuerEmployee: string;
  creatorEmployee?: string;
  status: 'CONFIRMED' | 'DRAFT' | 'CANCELLED';
  createdAt?: string;
  updatedAt?: string;
}

/*
 * حجوزات الفنادق تُحفظ تذاكرَ موسومة HOTEL.
 *
 * كانت هذه الدوال ترمي «غير مربوطة بقاعدة البيانات»، فتعرض الشاشةُ نموذجاً كاملاً
 * ولا يبقى منه شيء. صارت تكتب في جدول التذاكر — الرقم والتواريخ والعميل والمورد
 * والمبالغ والربح أعمدةً حقيقية تصل الكشوف والقيود والتقارير من المسار نفسه الذي
 * تسلكه كل خدمة — وتفاصيلُ الغرف والفندق، وهي بنيةٌ لا عمود لها، تُحفظ كتلةً
 * معلَّمة داخل الملاحظات وتُفكّ عند القراءة، وملاحظةُ المستخدم تبقى خارجها.
 *
 * المقايضة معلنة كسابقاتها: تفاصيل الغرف قابلة للحفظ والعرض لا للاستعلام. حين
 * يُطلب تقرير «كم ليلة بعنا في أيلول» تصير أعمدةً في القاعدة.
 */
const OPEN = '<<<HOTEL_BOOKING:';
const CLOSE = ':HOTEL_BOOKING>>>';

const encode = (userNotes: string | undefined, extras: Record<string, any>): string => {
  const clean = String(userNotes || '').trim();
  return `${clean}${clean ? '\n' : ''}${OPEN}${JSON.stringify(extras)}${CLOSE}`;
};

const decode = (notes?: string | null): { userNotes: string; extras: Record<string, any> } => {
  const raw = String(notes || '');
  const start = raw.indexOf(OPEN);
  if (start === -1) return { userNotes: raw.trim(), extras: {} };
  const end = raw.indexOf(CLOSE, start);
  if (end === -1) return { userNotes: raw.trim(), extras: {} };
  let extras: Record<string, any> = {};
  try {
    extras = JSON.parse(raw.slice(start + OPEN.length, end)) || {};
  } catch {
    extras = {};
  }
  return { userNotes: (raw.slice(0, start) + raw.slice(end + CLOSE.length)).trim(), extras };
};

const STATUS_TO_TICKET: Record<string, string> = { CONFIRMED: 'POSTED', DRAFT: 'DRAFT', CANCELLED: 'CANCELLED' };
const STATUS_FROM_TICKET: Record<string, HotelBookingItem['status']> = {
  POSTED: 'CONFIRMED',
  DRAFT: 'DRAFT',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'CANCELLED',
};

const toTicketPayload = (b: Partial<HotelBookingItem>, invoiceNumber: string): Partial<TicketData> => ({
  invoiceNumber,
  issueDate: b.issueDate || new Date().toISOString().slice(0, 10),
  travelDate: b.checkInDate || null,
  returnDate: b.checkOutDate || null,
  tripType: 'HOTEL',
  customerName: b.customerName || '',
  customerId: b.customerId || null,
  customerAccountId: b.customerAccountId || null,
  supplierAccount: b.supplierId || b.supplierAccountId || b.supplierName || null,
  supplierAccountName: b.supplierName || null,
  supplierId: b.supplierId || null,
  supplierAccountId: b.supplierAccountId || null,
  cashboxAccountId: b.salesCashboxId || null,
  paymentType: b.paymentType === 'آجل' || b.paymentType === 'CREDIT' ? 'CREDIT' : 'DEBIT',
  currency: b.currency || 'IQD',
  exchangeRate: Number(b.exchangeRate) || 1,
  airline: b.hotelName || null,
  route: [b.city, b.country].filter(Boolean).join(' - ') || null,
  employeeName: b.issuerEmployee || undefined,
  entryEmployee: b.creatorEmployee || undefined,
  totalBuy: Number(b.totalCost) || 0,
  netBuy: Number(b.totalCost) || 0,
  totalSell: Number(b.totalSale) || 0,
  netSell: Number(b.totalSale) || 0,
  profit: Number(b.netProfit) || 0,
  status: STATUS_TO_TICKET[b.status || 'CONFIRMED'] || 'POSTED',
  notes: encode(b.notes, {
    hotelName: b.hotelName,
    hotelAddress: b.hotelAddress,
    city: b.city,
    country: b.country,
    checkInDate: b.checkInDate,
    checkOutDate: b.checkOutDate,
    nights: b.nights,
    customerPhone: b.customerPhone,
    customerAgent: b.customerAgent,
    primaryGuestName: b.primaryGuestName,
    salesCashboxId: b.salesCashboxId,
    salesCashboxName: b.salesCashboxName,
    purchaseCashboxId: b.purchaseCashboxId,
    purchaseCashboxName: b.purchaseCashboxName,
    rooms: b.rooms || [],
    discountType: b.discountType,
    discountValue: b.discountValue,
    discountAmount: b.discountAmount,
    voucherRef: b.voucherRef,
    supplierRef: b.supplierRef,
    paymentType: b.paymentType,
  }),
  // النزيل الأساسي سطرُ التذكرة، فيظهر في الكشف باسمه ومبلغَي الحجز.
  passengers: [
    {
      name: b.primaryGuestName || b.customerName || 'نزيل',
      ticketType: 'ADULT',
      fareBuy: Number(b.totalCost) || 0,
      fareSell: Number(b.totalSale) || 0,
    },
  ],
});

const fromTicket = (t: TicketData): HotelBookingItem => {
  const { userNotes, extras } = decode(t.notes);
  return {
    id: String(t.id),
    invoiceNumber: t.invoiceNumber || '',
    issueDate: String(t.issueDate || '').slice(0, 10),
    checkInDate: extras.checkInDate || String(t.travelDate || '').slice(0, 10),
    checkOutDate: extras.checkOutDate || String(t.returnDate || '').slice(0, 10),
    nights: Number(extras.nights) || 1,
    hotelName: extras.hotelName || t.airline || '',
    hotelAddress: extras.hotelAddress || '',
    city: extras.city || '',
    country: extras.country || '',
    customerName: t.customerName || '',
    customerPhone: extras.customerPhone || '',
    customerAgent: extras.customerAgent || '',
    primaryGuestName: extras.primaryGuestName || t.passengers?.[0]?.name || '',
    customerId: t.customerId || undefined,
    customerAccountId: t.customerAccountId || undefined,
    supplierName: t.supplierAccountName || '',
    supplierId: t.supplierId || undefined,
    supplierAccountId: t.supplierAccountId || undefined,
    salesCashboxId: extras.salesCashboxId || (t as any).cashboxAccountId || undefined,
    salesCashboxName: extras.salesCashboxName || undefined,
    purchaseCashboxId: extras.purchaseCashboxId || undefined,
    purchaseCashboxName: extras.purchaseCashboxName || undefined,
    paymentType: extras.paymentType || (t.paymentType === 'CREDIT' ? 'آجل' : 'نقدي'),
    currency: t.currency || 'IQD',
    exchangeRate: Number(t.exchangeRate) || 1,
    rooms: Array.isArray(extras.rooms) ? extras.rooms : [],
    voucherRef: extras.voucherRef || undefined,
    supplierRef: extras.supplierRef || undefined,
    discountType: extras.discountType || 'FIXED',
    discountValue: Number(extras.discountValue) || 0,
    discountAmount: Number(extras.discountAmount) || 0,
    totalCost: Number(t.netBuy ?? t.totalBuy) || 0,
    totalSale: Number(t.netSell ?? t.totalSell) || 0,
    netProfit: Number(t.profit) || 0,
    notes: userNotes,
    issuerEmployee: t.employeeName || '',
    creatorEmployee: t.entryEmployee || undefined,
    status: STATUS_FROM_TICKET[String(t.status || 'POSTED').toUpperCase()] || 'CONFIRMED',
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
};

export const hotelsApi = {
  getAll: async (): Promise<HotelBookingItem[]> => {
    const all = await ticketsApi.getAll({ limit: 300 });
    return (Array.isArray(all) ? all : [])
      .filter((t: any) => String(t.tripType || '').toUpperCase() === 'HOTEL')
      .map(fromTicket);
  },

  create: async (payload: Partial<HotelBookingItem>): Promise<HotelBookingItem> => {
    const invoiceNumber = payload.invoiceNumber || (await allocateDocumentNumber('hotels'));
    const saved = await ticketsApi.create(toTicketPayload(payload, invoiceNumber) as any);
    return fromTicket(saved);
  },

  update: async (id: string, payload: Partial<HotelBookingItem>): Promise<HotelBookingItem> => {
    const invoiceNumber = payload.invoiceNumber || (await allocateDocumentNumber('hotels'));
    const saved = await ticketsApi.update(id, toTicketPayload(payload, invoiceNumber) as any);
    return fromTicket(saved);
  },

  delete: async (id: string): Promise<boolean> => {
    await ticketsApi.delete(id);
    return true;
  },
};
