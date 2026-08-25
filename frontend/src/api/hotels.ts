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

export const hotelsApi = {
  getAll: async (): Promise<HotelBookingItem[]> => [],

  create: async (_payload: Partial<HotelBookingItem>): Promise<HotelBookingItem> => {
    throw new Error('خدمة حجوزات الفنادق غير مربوطة بقاعدة البيانات بعد، لذلك لن يتم حفظ بيانات محلية غير معتمدة.');
  },

  update: async (_id: string, _payload: Partial<HotelBookingItem>): Promise<HotelBookingItem> => {
    throw new Error('خدمة حجوزات الفنادق غير مربوطة بقاعدة البيانات بعد، لذلك لن يتم تعديل بيانات محلية غير معتمدة.');
  },

  delete: async (_id: string): Promise<boolean> => {
    throw new Error('خدمة حجوزات الفنادق غير مربوطة بقاعدة البيانات بعد، لذلك لن يتم حذف سجلات محلية.');
  },
};
