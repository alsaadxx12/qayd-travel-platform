/**
 * الخدمات البسيطة: تغيير التذاكر، حجوزات الفنادق، بيع الوزن.
 *
 * الثلاث تسأل الأسئلة نفسها — من العميل، ومن المورد، وبكم اشترينا وبكم بعنا،
 * وأين استُلم المال — ويفترق كلٌّ منها في حقلين أو ثلاثة فقط: التغيير يحتاج
 * التذكرة الأصلية والغرامة، والفندق يحتاج الليالي والغرف، والوزن يحتاج الكيلوات.
 *
 * فبدل ثلاث شاشات متشابهة تُكتب ثلاث مرات وتُصان ثلاث مرات، تُوصف كل خدمة هنا
 * بحقولها الخاصة وتشترك في الباقي.
 */

export type ServiceKindId = 'CHANGE' | 'HOTEL' | 'BAGGAGE';

export interface ExtraFieldDef {
  key: string;
  ar: string;
  en: string;
  type: 'text' | 'number' | 'date';
  placeholder?: string;
  /** عرض الحقل ضمن شبكة من عمودين. */
  wide?: boolean;
}

export interface ServiceKindDef {
  id: ServiceKindId;
  /** tripType المحفوظ في جدول التذاكر — به تُقرأ الخدمة في الكشوف والتقارير. */
  tripType: string;
  /** مفتاح التسلسل في إعدادات الترقيم. */
  sequenceKey: string;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  /** وحدة الكمّية: مقعد، ليلة، كيلو… */
  quantityAr: string;
  quantityEn: string;
  accent: string;
  extraFields: ExtraFieldDef[];
}

export const SERVICE_KINDS: Record<ServiceKindId, ServiceKindDef> = {
  CHANGE: {
    id: 'CHANGE',
    tripType: 'REISSUE',
    sequenceKey: 'changes',
    titleAr: 'تغيير التذاكر',
    titleEn: 'Ticket Changes',
    subtitleAr: 'إعادة إصدار وتغيير المواعيد — فرق السعر وغرامة التغيير',
    subtitleEn: 'Reissues and date changes — fare difference and change penalty',
    quantityAr: 'عدد التذاكر',
    quantityEn: 'Tickets',
    accent: 'amber',
    extraFields: [
      { key: 'originalTicket', ar: 'رقم التذكرة الأصلية', en: 'Original ticket', type: 'text', placeholder: '057-2300832814' },
      { key: 'pnr', ar: 'رمز الحجز PNR', en: 'PNR', type: 'text', placeholder: 'HWG83L' },
      { key: 'newTravelDate', ar: 'الموعد الجديد', en: 'New travel date', type: 'date' },
      { key: 'penalty', ar: 'غرامة التغيير', en: 'Change penalty', type: 'number' },
    ],
  },
  HOTEL: {
    id: 'HOTEL',
    tripType: 'HOTEL',
    sequenceKey: 'hotels',
    titleAr: 'حجوزات الفنادق',
    titleEn: 'Hotel Bookings',
    subtitleAr: 'الفندق والمدينة وليالي الإقامة وأسعار الغرف',
    subtitleEn: 'Hotel, city, nights and room rates',
    quantityAr: 'عدد الغرف',
    quantityEn: 'Rooms',
    accent: 'violet',
    extraFields: [
      { key: 'hotelName', ar: 'اسم الفندق', en: 'Hotel name', type: 'text', wide: true },
      { key: 'city', ar: 'المدينة', en: 'City', type: 'text' },
      { key: 'checkIn', ar: 'تاريخ الدخول', en: 'Check-in', type: 'date' },
      { key: 'checkOut', ar: 'تاريخ الخروج', en: 'Check-out', type: 'date' },
      { key: 'nights', ar: 'عدد الليالي', en: 'Nights', type: 'number' },
    ],
  },
  BAGGAGE: {
    id: 'BAGGAGE',
    tripType: 'BAGGAGE',
    sequenceKey: 'baggage',
    titleAr: 'بيع الوزن',
    titleEn: 'Excess Baggage',
    subtitleAr: 'الوزن الإضافي المباع للمسافرين — الكيلوات وسعرها',
    subtitleEn: 'Excess baggage sold to travellers — kilos and their price',
    quantityAr: 'عدد الكيلوات',
    quantityEn: 'Kilos',
    accent: 'sky',
    extraFields: [
      { key: 'pnr', ar: 'رمز الحجز PNR', en: 'PNR', type: 'text', placeholder: 'HWG83L' },
      { key: 'ticketNumber', ar: 'رقم التذكرة', en: 'Ticket number', type: 'text' },
      { key: 'flightDate', ar: 'تاريخ الرحلة', en: 'Flight date', type: 'date' },
      { key: 'pricePerKg', ar: 'سعر الكيلو', en: 'Price per kilo', type: 'number' },
    ],
  },
};

/*
 * الحقول الخاصة تُحفظ في كتلة معلَّمة داخل الملاحظات.
 *
 * جدول التذاكر لا يحمل عموداً لاسم الفندق ولا لعدد الكيلوات، وإضافة عمودٍ لكل
 * حقل في كل خدمة يُثقل الجدول بما لا يُستعلَم عنه. فتُكتب هنا كما تُكتب مكوّنات
 * الكروب، ويبقى نصّ المستخدم خارج الكتلة سليماً.
 *
 * المقايضة مصرَّح بها: هذه الحقول ليست قابلة للاستعلام في التقارير. حين تُطلب
 * تقارير عليها — «كم كيلو بعنا هذا الشهر» — تصير أعمدة في القاعدة.
 */
const OPEN = '<<<SERVICE:';
const CLOSE = ':SERVICE>>>';

export const encodeServiceExtras = (userNotes: string, extras: Record<string, any>): string => {
  const clean = String(userNotes || '').trim();
  const payload = JSON.stringify(extras || {});
  return `${clean}${clean ? '\n' : ''}${OPEN}${payload}${CLOSE}`;
};

export const decodeServiceExtras = (notes?: string | null) => {
  const raw = String(notes || '');
  const start = raw.indexOf(OPEN);
  if (start === -1) return { userNotes: raw.trim(), extras: {} as Record<string, any> };
  const end = raw.indexOf(CLOSE, start);
  if (end === -1) return { userNotes: raw.trim(), extras: {} as Record<string, any> };
  let extras: Record<string, any> = {};
  try {
    extras = JSON.parse(raw.slice(start + OPEN.length, end)) || {};
  } catch {
    extras = {};
  }
  return { userNotes: (raw.slice(0, start) + raw.slice(end + CLOSE.length)).trim(), extras };
};
