import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Modal,
  Textarea,
  Tooltip,
  Switch,
} from '@mantine/core';
import {
  Building2,
  Save,
  ArrowRight,
  User,
  Plus,
  Trash2,
  Phone,
  BedDouble,
  Users,
  MapPin,
  Building,
  Settings,
  Check,
  History,
  CreditCard,
  Paperclip,
  FileSpreadsheet,
  UserCheck,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SearchableCombobox } from '../ui/SearchableCombobox';
import { SegmentedDatePicker } from '../ui/SegmentedDatePicker';
import { HotelFinancialSummary } from './HotelFinancialSummary';
import { InvoiceAuditLogModal } from '../tickets/InvoiceAuditLogModal';
import { TicketAttachmentsSection, AttachmentItem } from '../tickets/TicketAttachmentsSection';
import { partnersApi, Customer, Supplier } from '../../api/partners';
import { accountsApi } from '../../api/accounts';
import { employeesApi } from '../../api/employees';
import { hotelsApi, HotelBookingItem, HotelRoomLine } from '../../api/hotels';
import { fetchPrintTemplate } from '../../api/printTemplates';
import { WORLD_CITIES, WorldCity } from '../../data/worldCities';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { getNextSequenceNumber } from '../../utils/sequenceUtils';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguageStore } from '../../store/useLanguageStore';
import { useAdoptedExchangeRate } from '../../hooks/useAdoptedExchangeRate';

interface HotelBookingEditorWorkspaceProps {
  opened: boolean;
  onClose: () => void;
  initialData?: HotelBookingItem | null;
  onSuccess?: (savedBooking: HotelBookingItem) => void;
}

const ROOM_TYPES = [
  { value: 'SINGLE', label: 'مفردة (Single Room)' },
  { value: 'DOUBLE', label: 'مزدوجة (Double Room)' },
  { value: 'TRIPLE', label: 'ثلاثية (Triple Room)' },
  { value: 'QUAD', label: 'رباعية (Quad Room)' },
  { value: 'SUITE', label: 'جناح فندقي (Suite)' },
  { value: 'DELUXE', label: 'ديلوكس فاخر (Deluxe Room)' },
];

const DEFAULTS_STORAGE_KEY = 'hotel_booking_user_defaults';

// Convert any Eastern Arabic digits to English digits
const toEnglishDigits = (val: string | number) => {
  return String(val ?? '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
};

// Safe Local Date Parser avoiding timezone/UTC midnight shifts
const parseLocalDate = (dateStr?: string | Date | null): Date => {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  const str = String(dateStr).trim();
  const clean = str.includes('T') ? str.split('T')[0] : str;
  const parts = clean.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m, d, 12, 0, 0); // midday avoids any timezone rollback
    }
  }
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

// Safe Local Date to YYYY-MM-DD formatter without UTC conversion offset
const formatLocalDateToYMD = (d?: Date | string | null): string => {
  if (!d) return '';
  if (typeof d === 'string') {
    const clean = d.includes('T') ? d.split('T')[0] : d;
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  }
  const date = typeof d === 'string' ? parseLocalDate(d) : d;
  if (!date || isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const HotelBookingEditorWorkspace: React.FC<HotelBookingEditorWorkspaceProps> = ({
  opened,
  onClose,
  initialData,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const adoptedEx = useAdoptedExchangeRate();
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  // Modals State
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [auditLogOpen, setAuditLogOpen] = useState(false);

  // User Default Settings State
  const [defaultCurrency, setDefaultCurrency] = useState('USD');
  const [defaultPaymentType, setDefaultPaymentType] = useState('كاش باليد (نقدي)');
  const [defaultCity, setDefaultCity] = useState('دبي');
  const [defaultCountry, setDefaultCountry] = useState('الإمارات');
  const [defaultSalesCashboxId, setDefaultSalesCashboxId] = useState('');
  const [defaultPurchaseCashboxId, setDefaultPurchaseCashboxId] = useState('');

  // Booking Main Info
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [issueDate, setIssueDate] = useState<Date>(new Date());
  const [checkInDate, setCheckInDate] = useState<Date>(new Date());
  const [checkOutDate, setCheckOutDate] = useState<Date>(() => new Date(Date.now() + 86400000));
  const [nights, setNights] = useState<number>(1);
  const [hotelName, setHotelName] = useState<string>('');
  const [hotelAddress, setHotelAddress] = useState<string>('');
  const [city, setCity] = useState<string>('دبي');
  const [country, setCountry] = useState<string>('الإمارات');

  // Customer & Sales State (CARD 1: Customer Card)
  const [customerName, setCustomerName] = useState<string>('عميل نقدي عام');
  const [customerId, setCustomerId] = useState<string>('');
  const [customerAccountId, setCustomerAccountId] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerAgent, setCustomerAgent] = useState<string>('');
  const [primaryGuestName, setPrimaryGuestName] = useState<string>('');

  // Supplier & Provider State (CARD 2: Hotel & Supplier Card)
  const [supplierName, setSupplierName] = useState<string>('');
  const [supplierId, setSupplierId] = useState<string>('');
  const [supplierAccountId, setSupplierAccountId] = useState<string>('');

  // Payment & Settlement State (CARD 4: Payment & Attachments)
  const [paymentTerm, setPaymentTerm] = useState<'نقدي' | 'آجل'>('نقدي');
  const [paymentType, setPaymentType] = useState<string>('كاش باليد (نقدي)');
  const [salesCashboxId, setSalesCashboxId] = useState<string>('');
  const [salesCashboxName, setSalesCashboxName] = useState<string>('');
  const [purchaseCashboxId, setPurchaseCashboxId] = useState<string>('');
  const [purchaseCashboxName, setPurchaseCashboxName] = useState<string>('');
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);

  // Currency & Details
  const [currency, setCurrency] = useState<string>('USD');
  const [exchangeRate, setExchangeRate] = useState<number>(1547.5);
  const [issuerEmployee, setIssuerEmployee] = useState<string>(user?.name || 'علي جعفر محمود');
  const [notes, setNotes] = useState<string>('');
  const [status, setStatus] = useState<'CONFIRMED' | 'DRAFT' | 'CANCELLED'>('CONFIRMED');

  // Multiplier switch
  const [adoptNightsMultiplier, setAdoptNightsMultiplier] = useState<boolean>(true);

  // Rooms List (CARD 3)
  const [rooms, setRooms] = useState<HotelRoomLine[]>([
    {
      id: 'room-1',
      roomType: 'DOUBLE',
      roomTypeName: 'مزدوجة (Double Room)',
      roomsCount: 1,
      nights: 1,
      adoptNightsMultiplier: true,
      costPrice: 0,
      salePrice: 0,
      guestNames: [''],
      notes: '',
    },
  ]);

  // Quick Room Adder Form State
  const [newRoomType, setNewRoomType] = useState<string>('DOUBLE');
  const [newRoomsCount, setNewRoomsCount] = useState<string>('1');
  const [newCostPrice, setNewCostPrice] = useState<string>('');
  const [newSalePrice, setNewSalePrice] = useState<string>('');
  const [newGuestName, setNewGuestName] = useState<string>('');

  // DB Lists
  const [customersList, setCustomersList] = useState<Customer[]>([]);
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);
  const [accountsList, setAccountsList] = useState<any[]>([]);
  const [cashboxAccounts, setCashboxAccounts] = useState<any[]>([]);
  const [employeesList, setEmployeesList] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch Payment Methods Configuration from System Settings
  const { data: paymentMethodsConfig } = useQuery({
    queryKey: ['system-settings-payment-methods'],
    queryFn: async () => {
      try {
        const res = await fetchPrintTemplate('payment_methods_mapping');
        if (res && res.config && Array.isArray(res.config.mappings) && res.config.mappings.length > 0) {
          return res.config.mappings.filter((m: any) => m.isActive !== false);
        }
      } catch (e) {
        console.warn('Failed to fetch payment_methods_mapping from settings:', e);
      }
      return null;
    },
    staleTime: 2 * 60 * 1000,
  });

  // Real Payment Options from Settings
  const realPaymentOptions = useMemo(() => {
    if (paymentMethodsConfig && paymentMethodsConfig.length > 0) {
      return paymentMethodsConfig.map((m: any) => ({
        value: m.nameAr || m.code || m.id,
        label: isAr ? (m.nameAr || m.name) : (m.nameEn || m.name || m.nameAr),
        accountCode: m.accountCode || m.code,
      }));
    }
    return [
      { value: 'كاش باليد (نقدي)', label: isAr ? 'كاش باليد (نقدي)' : 'Cash in Hand' },
      { value: 'حساب آجل (ذمم)', label: isAr ? 'حساب آجل (ذمم)' : 'Credit (Receivables)' },
      { value: 'ماستر كارد / إلكتروني', label: isAr ? 'ماستر كارد / إلكتروني' : 'MasterCard / POS' },
      { value: 'تحويل بنكي / حوالة', label: isAr ? 'تحويل بنكي / حوالة' : 'Bank Transfer' },
      { value: 'زين كاش', label: isAr ? 'زين كاش' : 'Zain Cash' },
      { value: 'سويتش / كي كارد', label: isAr ? 'سويتش / كي كارد' : 'QiCard / Switch' },
    ];
  }, [paymentMethodsConfig, isAr]);

  // Employee Options from DB
  const employeeOptions = useMemo(() => {
    if (employeesList && employeesList.length > 0) {
      return employeesList.map((emp: any) => ({
        value: emp.nameAr || emp.name || emp.nameEn,
        label: isAr ? (emp.nameAr || emp.name || emp.nameEn) : (emp.nameEn || emp.name || emp.nameAr),
      }));
    }
    const current = user?.name || 'علي جعفر محمود';
    return [{ value: current, label: current }];
  }, [employeesList, isAr, user?.name]);

  // Load User Defaults
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DEFAULTS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.defaultCurrency) setDefaultCurrency(parsed.defaultCurrency);
        if (parsed.defaultPaymentType) setDefaultPaymentType(parsed.defaultPaymentType);
        if (parsed.defaultCity) setDefaultCity(parsed.defaultCity);
        if (parsed.defaultCountry) setDefaultCountry(parsed.defaultCountry);
        if (parsed.defaultSalesCashboxId) setDefaultSalesCashboxId(parsed.defaultSalesCashboxId);
        if (parsed.defaultPurchaseCashboxId) setDefaultPurchaseCashboxId(parsed.defaultPurchaseCashboxId);
      }
    } catch {}
  }, []);

  // Save User Defaults
  const handleSaveUserDefaults = () => {
    const config = {
      defaultCurrency,
      defaultPaymentType,
      defaultCity,
      defaultCountry,
      defaultSalesCashboxId,
      defaultPurchaseCashboxId,
    };
    localStorage.setItem(DEFAULTS_STORAGE_KEY, JSON.stringify(config));
    showSuccessNotification(isAr ? 'تم الحفظ' : 'Saved', isAr ? 'تم حفظ الإعدادات الافتراضية للنافذة بنجاح.' : 'Defaults saved successfully.');
    setSettingsModalOpen(false);
  };

  // Auto-calculate nights between check-in and check-out
  useEffect(() => {
    if (checkInDate && checkOutDate) {
      const diffTime = checkOutDate.getTime() - checkInDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const calculatedNights = Math.max(1, diffDays);
      setNights(calculatedNights);
      setRooms((prev) =>
        prev.map((r) => (r.adoptNightsMultiplier ? { ...r, nights: calculatedNights } : r))
      );
    }
  }, [checkInDate, checkOutDate]);

  // Load Real Data from Supabase / API
  useEffect(() => {
    partnersApi.getCustomers().then((data) => {
      if (Array.isArray(data)) setCustomersList(data);
    }).catch(() => {});

    partnersApi.getSuppliers().then((data) => {
      if (Array.isArray(data)) setSuppliersList(data);
    }).catch(() => {});

    accountsApi.getFlat().then((data) => {
      if (Array.isArray(data)) {
        setAccountsList(data);
        const cashboxes = data.filter((a) =>
          a.code?.startsWith('18') ||
          a.nameAr?.includes('صندوق') ||
          a.nameAr?.includes('كاش') ||
          a.nameAr?.includes('ماستر') ||
          a.nameAr?.includes('بنك')
        );
        setCashboxAccounts(cashboxes);
        if (cashboxes.length > 0) {
          if (!salesCashboxId) {
            setSalesCashboxId(defaultSalesCashboxId || cashboxes[0].id);
            setSalesCashboxName(cashboxes[0].nameAr);
          }
          if (!purchaseCashboxId) {
            setPurchaseCashboxId(defaultPurchaseCashboxId || cashboxes[0].id);
            setPurchaseCashboxName(cashboxes[0].nameAr);
          }
        }
      }
    }).catch(() => {});

    employeesApi.getAll().then((data) => {
      if (Array.isArray(data)) setEmployeesList(data);
    }).catch(() => {});
  }, [defaultSalesCashboxId, defaultPurchaseCashboxId]);

  // Reset form to blank new voucher
  const handleNewBooking = useCallback(() => {
    const generated = getNextSequenceNumber('hotels');
    setInvoiceNumber(generated);
    setIssueDate(new Date());
    setCheckInDate(new Date());
    setCheckOutDate(new Date(Date.now() + 86400000));
    setNights(1);
    setHotelName('');
    setHotelAddress('');
    setCity(defaultCity || 'دبي');
    setCountry(defaultCountry || 'الإمارات');
    setCustomerName('عميل نقدي عام');
    setCustomerId('');
    setCustomerAccountId('');
    setCustomerPhone('');
    setCustomerAgent('');
    setPrimaryGuestName('');
    setSupplierName('');
    setSupplierId('');
    setSupplierAccountId('');
    setPaymentType(defaultPaymentType || 'كاش باليد (نقدي)');
    setCurrency(defaultCurrency || 'USD');
    setExchangeRate(adoptedEx?.adoptedRate || 1547.5);
    setAttachments([]);
    setRooms([
      {
        id: 'room-1',
        roomType: 'DOUBLE',
        roomTypeName: 'مزدوجة (Double Room)',
        roomsCount: 1,
        nights: 1,
        adoptNightsMultiplier: true,
        costPrice: 0,
        salePrice: 0,
        guestNames: [''],
      },
    ]);
    setNotes('');
    setIssuerEmployee(user?.name || 'علي جعفر محمود');
    setStatus('CONFIRMED');
  }, [defaultCity, defaultCountry, defaultPaymentType, defaultCurrency, adoptedEx?.adoptedRate, user?.name]);

  // Initialize or Reset Booking Data
  useEffect(() => {
    if (initialData) {
      setInvoiceNumber(initialData.invoiceNumber || '');
      setIssueDate(initialData.issueDate ? parseLocalDate(initialData.issueDate) : new Date());
      setCheckInDate(initialData.checkInDate ? parseLocalDate(initialData.checkInDate) : new Date());
      setCheckOutDate(initialData.checkOutDate ? parseLocalDate(initialData.checkOutDate) : new Date(Date.now() + 86400000));
      setNights(initialData.nights || 1);
      setHotelName(initialData.hotelName || '');
      setHotelAddress(initialData.hotelAddress || '');
      setCity(initialData.city || 'دبي');
      setCountry(initialData.country || 'الإمارات');
      setCustomerName(initialData.customerName || 'عميل نقدي عام');
      setCustomerId(initialData.customerId || '');
      setCustomerAccountId(initialData.customerAccountId || '');
      setCustomerPhone(initialData.customerPhone || '');
      setCustomerAgent(initialData.customerAgent || '');
      setPrimaryGuestName(initialData.primaryGuestName || initialData.rooms?.[0]?.guestNames?.[0] || '');
      setSupplierName(initialData.supplierName || '');
      setSupplierId(initialData.supplierId || '');
      setSupplierAccountId(initialData.supplierAccountId || '');
      setSalesCashboxId(initialData.salesCashboxId || '');
      setSalesCashboxName(initialData.salesCashboxName || '');
      setPurchaseCashboxId(initialData.purchaseCashboxId || '');
      setPurchaseCashboxName(initialData.purchaseCashboxName || '');
      setPaymentType(initialData.paymentType || 'كاش باليد (نقدي)');
      setCurrency(initialData.currency || 'USD');
      setExchangeRate(initialData.exchangeRate || 1547.5);
      setRooms(initialData.rooms && initialData.rooms.length > 0 ? initialData.rooms : [
        {
          id: 'room-1',
          roomType: 'DOUBLE',
          roomTypeName: 'مزدوجة (Double Room)',
          roomsCount: 1,
          nights: initialData.nights || 1,
          adoptNightsMultiplier: true,
          costPrice: 0,
          salePrice: 0,
          guestNames: [''],
        }
      ]);
      setNotes(initialData.notes || '');
      setIssuerEmployee(initialData.issuerEmployee || user?.name || 'علي جعفر محمود');
      setStatus(initialData.status || 'CONFIRMED');
    } else {
      handleNewBooking();
    }
  }, [initialData, opened, handleNewBooking, user?.name]);

  // Financial Calculations (Strict English / en-US Numbers)
  const calculatedFinancials = useMemo(() => {
    let rawTotalCost = 0;
    let rawTotalSale = 0;

    rooms.forEach((room) => {
      const roomNights = room.adoptNightsMultiplier ? (room.nights || nights || 1) : 1;
      const count = room.roomsCount || 1;
      rawTotalCost += (Number(room.costPrice) || 0) * count * roomNights;
      rawTotalSale += (Number(room.salePrice) || 0) * count * roomNights;
    });

    const netSale = rawTotalSale;
    const netCost = rawTotalCost;
    const netProfit = netSale - netCost;
    const profitMargin = netSale > 0 ? (netProfit / netSale) * 100 : 0;

    return {
      rawTotalCost,
      rawTotalSale,
      netSale,
      netCost,
      netProfit,
      profitMargin,
    };
  }, [rooms, nights]);

  // Add Room Line
  const handleAddRoom = () => {
    const selectedObj = ROOM_TYPES.find((r) => r.value === newRoomType) || ROOM_TYPES[1];
    const parsedCount = Math.max(1, Number(toEnglishDigits(newRoomsCount)) || 1);
    const parsedCost = Number(toEnglishDigits(newCostPrice)) || 0;
    const parsedSale = Number(toEnglishDigits(newSalePrice)) || 0;

    const newRoom: HotelRoomLine = {
      id: `room-${Date.now()}`,
      roomType: newRoomType as any,
      roomTypeName: selectedObj.label,
      roomsCount: parsedCount,
      nights: adoptNightsMultiplier ? nights : 1,
      adoptNightsMultiplier,
      costPrice: parsedCost,
      salePrice: parsedSale,
      guestNames: newGuestName ? [newGuestName] : [''],
      notes: '',
    };

    setRooms((prev) => [...prev, newRoom]);
    setNewGuestName('');
    setNewCostPrice('');
    setNewSalePrice('');
    setNewRoomsCount('1');
  };

  // Remove Room Line
  const handleRemoveRoom = (id: string) => {
    setRooms((prev) => prev.filter((r) => r.id !== id));
  };

  // Update Room Line
  const handleUpdateRoom = (id: string, field: keyof HotelRoomLine, val: any) => {
    setRooms((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: val } : r))
    );
  };

  // Save Booking
  const handleSaveBooking = async () => {
    if (!hotelName.trim()) {
      showErrorNotification(isAr ? 'تنبيه' : 'Warning', isAr ? 'يرجى إدخال اسم الفندق والإقامة.' : 'Please enter hotel name.');
      return;
    }
    if (!customerName.trim()) {
      showErrorNotification(isAr ? 'تنبيه' : 'Warning', isAr ? 'يرجى تحديد اسم العميل أو الشركة.' : 'Please select customer.');
      return;
    }

    setIsSaving(true);
    try {
      const payload: Partial<HotelBookingItem> = {
        id: initialData?.id,
        invoiceNumber,
        issueDate: formatLocalDateToYMD(issueDate),
        checkInDate: formatLocalDateToYMD(checkInDate),
        checkOutDate: formatLocalDateToYMD(checkOutDate),
        nights,
        hotelName,
        hotelAddress,
        city,
        country,
        customerName,
        customerId,
        customerAccountId,
        customerPhone,
        customerAgent,
        primaryGuestName: primaryGuestName || rooms[0]?.guestNames?.[0] || '',
        supplierName: supplierName || 'شركة الفنادق العامة',
        supplierId,
        supplierAccountId,
        salesCashboxId,
        salesCashboxName,
        purchaseCashboxId,
        purchaseCashboxName,
        paymentType,
        currency,
        exchangeRate: Number(toEnglishDigits(exchangeRate)) || 1547.5,
        rooms,
        discountType: 'FIXED',
        discountValue: 0,
        discountAmount: 0,
        totalCost: calculatedFinancials.netCost,
        totalSale: calculatedFinancials.netSale,
        netProfit: calculatedFinancials.netProfit,
        notes,
        issuerEmployee: issuerEmployee || user?.name || 'علي جعفر محمود',
        creatorEmployee: initialData?.creatorEmployee || user?.name || 'علي جعفر محمود',
        status,
      };

      let saved: HotelBookingItem;
      if (initialData?.id) {
        saved = await hotelsApi.update(initialData.id, payload);
        showSuccessNotification(isAr ? 'تم تعديل الحجز الفندقي' : 'Booking Updated', isAr ? `تم تحديث الحجز الفندقي رقم [${invoiceNumber}] بنجاح.` : `Hotel booking [${invoiceNumber}] updated successfully.`);
      } else {
        saved = await hotelsApi.create(payload);
        showSuccessNotification(isAr ? 'تم اعتماد الحجز الفندقي' : 'Booking Created', isAr ? `تم إنشاء وحفظ الفاتورة الفندقية رقم [${invoiceNumber}] بنجاح.` : `Hotel booking [${invoiceNumber}] created successfully.`);
      }

      queryClient.invalidateQueries({ queryKey: ['hotels'] });
      if (onSuccess) onSuccess(saved);
      onClose();
    } catch (err: any) {
      showErrorNotification(isAr ? 'خطأ في الحفظ' : 'Save Error', err.message || 'Error saving hotel booking.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!opened) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#F8FAFC] flex flex-col justify-between overflow-y-auto no-print select-none"
      dir={direction}
      style={{ fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif" }}
    >
      <div className="bg-[#F8FAFC] min-h-screen flex flex-col justify-between">
        {/* ════════════════════════════════════════════════════════════════════
            1. TOP BAR (Header: Back, Title, Audit Log, Defaults Settings)
           ════════════════════════════════════════════════════════════════════ */}
        <header className="sticky top-0 z-30 h-[58px] bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shadow-2xs shrink-0">
          {/* Leading Side: Back Button & Title */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowRight size={16} className={direction === 'rtl' ? '' : 'rotate-180'} />
              <span>{isAr ? 'رجوع للقائمة' : 'Back to List'}</span>
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-8.5 h-8.5 rounded-xl bg-orange-50 text-[#F45A0A] flex items-center justify-center font-bold shadow-2xs">
                <Building2 size={19} />
              </div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-slate-950 text-sm sm:text-base leading-tight">
                  {initialData
                    ? (isAr ? 'تعديل الحجز الفندقي' : 'Edit Hotel Booking')
                    : (isAr ? 'إصدار حجز وفاتورة فندقية جديدة' : 'New Hotel Booking Invoice')}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {status === 'CONFIRMED' ? (isAr ? 'مؤكد' : 'Confirmed') : (isAr ? 'مسودة' : 'Draft')}
                </span>
              </div>
            </div>
          </div>

          {/* Trailing Side: Audit Log & Settings */}
          <div className="flex items-center gap-2">
            {/* Audit Log Button */}
            <Tooltip label={isAr ? 'سجل العمليات والتعديلات' : 'Audit History Log'} withArrow>
              <button
                type="button"
                onClick={() => setAuditLogOpen(true)}
                className="h-9 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <History size={15} />
                <span>{isAr ? 'سجل التعديلات' : 'Audit Log'}</span>
              </button>
            </Tooltip>

            {/* Window Defaults Settings Button */}
            <Tooltip label={isAr ? 'تخصيص الإعدادات الافتراضية للنافذة' : 'Window User Defaults'} withArrow>
              <button
                type="button"
                onClick={() => setSettingsModalOpen(true)}
                className="h-9 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-orange-50 hover:text-[#F45A0A] text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <Settings size={15} />
                <span>{isAr ? 'إعدادات النافذة' : 'Window Settings'}</span>
              </button>
            </Tooltip>
          </div>
        </header>

        {/* ════════════════════════════════════════════════════════════════════
            2. STEP INDICATOR BAR (Matching Exact Ticket Design in Screenshot 1)
           ════════════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] m-3 sm:m-5 mb-0 p-3 px-6 shadow-2xs">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            {/* Step 1: Customer & Invoice Info */}
            <div className="flex items-center gap-2 text-slate-900">
              <div className="w-7 h-7 rounded-full bg-[#F45A0A] text-white font-bold text-xs flex items-center justify-center shadow-2xs">
                1
              </div>
              <span className="text-xs font-semibold text-slate-900">
                {isAr ? 'معلومات الفاتورة والعميل' : 'Invoice & Customer'}
              </span>
            </div>

            <div className="flex-1 h-[1.5px] bg-orange-200 mx-4"></div>

            {/* Step 2: Rooms & Guests */}
            <div className="flex items-center gap-2 text-slate-900">
              <div className="w-7 h-7 rounded-full bg-[#F45A0A] text-white font-bold text-xs flex items-center justify-center shadow-2xs">
                2
              </div>
              <span className="text-xs font-semibold text-slate-900">
                {isAr ? 'الغرف والنزلاء والأسعار' : 'Rooms & Guests'}
              </span>
            </div>

            <div
              className={`flex-1 h-[1.5px] mx-4 ${
                paymentType === 'كاش باليد (نقدي)' || paymentType === 'CASH' || attachments.length > 0
                  ? 'bg-emerald-300'
                  : 'bg-slate-200'
              }`}
            ></div>

            {/* Step 3: Attachments & Review */}
            {paymentType === 'كاش باليد (نقدي)' || paymentType === 'CASH' || attachments.length > 0 ? (
              <div className="flex items-center gap-2 text-emerald-700">
                <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-300 font-bold text-xs flex items-center justify-center shadow-2xs">
                  ✓
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-emerald-800 leading-tight">
                    {isAr ? 'المرفقات والمراجعة' : 'Attachments & Review'}
                  </span>
                  <span className="text-[10px] text-emerald-700 font-medium leading-none">
                    {isAr ? 'مكتملة تلقائياً (كاش باليد)' : 'Auto-completed (Cash)'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-500">
                <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center">
                  3
                </div>
                <span className="text-xs font-medium text-slate-500">
                  {isAr ? 'المرفقات والتسوية' : 'Attachments & Review'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            3. MAIN TWO-COLUMN WORKSPACE BODY (Form on Right + Sticky Summary on Left)
           ════════════════════════════════════════════════════════════════════ */}
        <main className="flex-1 p-3 sm:p-5 w-full">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
            
            {/* ─────────────────────────────────────────────────────────────
                RIGHT AREA (8 Cols): SEPARATED CARDS (Customer, Hotel/Supplier, Rooms Table, Payment/Attachments, Notes)
               ───────────────────────────────────────────────────────────── */}
            <div className="xl:col-span-8 space-y-4">
              
              {/* ════════════════════════════════════════════════════════════
                  ROW 1: SIDE-BY-SIDE CARDS (CARD 1: CUSTOMER & CARD 2: HOTEL/SUPPLIER)
                 ════════════════════════════════════════════════════════════ */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                
                {/* ── CARD 1: بيانات العميل والجهة الحاجزة ── */}
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#F45A0A] text-white font-black text-xs flex items-center justify-center shadow-2xs">
                          1
                        </div>
                        <div>
                          <h2 className="font-bold text-sm sm:text-[15px] text-slate-900 leading-tight">
                            {isAr ? 'بيانات العميل والجهة الحاجزة' : 'Customer & Client Information'}
                          </h2>
                          <span className="text-[11px] text-slate-500 font-medium">
                            {isAr ? 'حدد العميل المحجوز له، رقم الهاتف، والموكل الضامن' : 'Customer name, phone, and representative'}
                          </span>
                        </div>
                      </div>

                      {/* Currency & Rate */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <div className="h-[38px] flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 gap-0.5">
                          <button
                            type="button"
                            onClick={() => setCurrency('USD')}
                            className={`px-3 h-full rounded-lg text-xs font-black transition-all cursor-pointer ${
                              currency === 'USD' ? 'bg-[#F45A0A] text-white shadow-2xs' : 'text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            USD
                          </button>
                          <button
                            type="button"
                            onClick={() => setCurrency('IQD')}
                            className={`px-3 h-full rounded-lg text-xs font-black transition-all cursor-pointer ${
                              currency === 'IQD' ? 'bg-[#F45A0A] text-white shadow-2xs' : 'text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            IQD
                          </button>
                        </div>

                        {currency === 'USD' && (
                          <div className="flex items-center gap-1 bg-amber-50/70 border border-amber-200 px-2.5 py-0.5 rounded-xl text-xs h-[38px]">
                            <span className="text-[10.5px] font-bold text-amber-900">{isAr ? 'سعر الصرف:' : 'Rate:'}</span>
                            <input
                              type="text"
                              value={exchangeRate}
                              onChange={(e) => setExchangeRate(Number(toEnglishDigits(e.target.value)))}
                              className="w-16 h-[26px] text-center font-bold text-xs text-slate-900 border border-amber-300 rounded-lg bg-white focus:outline-none focus:border-[#F45A0A] font-mono tabular-nums"
                              style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
                              dir="ltr"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* 1. Customer Select (Account) */}
                      <div>
                        <label className="block font-bold text-slate-700 text-xs mb-1">
                          {isAr ? 'العميل / الحساب المحجوز له *' : 'Customer / Account *'}
                        </label>
                        <SearchableCombobox
                          options={customersList.map((c) => ({
                            value: c.id,
                            label: c.nameAr,
                            accountCode: c.code,
                          }))}
                          value={customerId}
                          displayValue={customerName}
                          onChange={(val: string) => {
                            setCustomerId(val);
                            const found = customersList.find((c) => c.id === val);
                            if (found) {
                              setCustomerName(found.nameAr);
                              if (found.phone) setCustomerPhone(found.phone);
                            }
                          }}
                          placeholder={isAr ? 'ابحث عن العميل أو الشركة...' : 'Search customer account...'}
                          className="h-[48px]"
                        />
                      </div>

                      {/* 2. Customer Phone */}
                      <div>
                        <label className="block font-bold text-slate-700 text-xs mb-1 flex items-center gap-1">
                          <Phone size={12} className="text-[#F45A0A]" />
                          <span>{isAr ? 'هاتف العميل' : 'Customer Phone'}</span>
                        </label>
                        <input
                          type="text"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(toEnglishDigits(e.target.value))}
                          placeholder="0770XXXXXXX"
                          dir="ltr"
                          style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
                          className="w-full h-[48px] px-3.5 rounded-[14px] border border-slate-200 bg-slate-50 focus:bg-white text-xs font-bold text-slate-900 focus:outline-none focus:border-[#F45A0A] font-mono tabular-nums"
                        />
                      </div>

                      {/* 3. Customer Agent / Representative */}
                      <div>
                        <label className="block font-bold text-slate-700 text-xs mb-1 flex items-center gap-1">
                          <User size={12} className="text-slate-400" />
                          <span>{isAr ? 'اسم الموكل / الضامن (إن وجد)' : 'Representative / Broker'}</span>
                        </label>
                        <input
                          type="text"
                          value={customerAgent}
                          onChange={(e) => setCustomerAgent(e.target.value)}
                          placeholder={isAr ? 'اسم الموكل أو وسيط الحجز...' : 'Representative name...'}
                          className="w-full h-[48px] px-3.5 rounded-[14px] border border-slate-200 bg-slate-50 focus:bg-white text-xs font-bold text-slate-900 focus:outline-none focus:border-[#F45A0A]"
                        />
                      </div>

                      {/* 4. Issue Date */}
                      <div>
                        <label className="block font-bold text-slate-700 text-xs mb-1">
                          {isAr ? 'تاريخ الإصدار *' : 'Issue Date *'}
                        </label>
                        <div className="h-[48px]">
                          <SegmentedDatePicker
                            value={issueDate}
                            onChange={(d) => d && setIssueDate(d)}
                            placeholder={isAr ? 'تاريخ الإصدار' : 'Issue Date'}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── CARD 2: بيانات الفندق والمورد وتواريخ الإقامة ── */}
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                      <div className="w-8 h-8 rounded-full bg-[#F45A0A] text-white font-black text-xs flex items-center justify-center shadow-2xs">
                        2
                      </div>
                      <div>
                        <h2 className="font-bold text-sm sm:text-[15px] text-slate-900 leading-tight">
                          {isAr ? 'بيانات الفندق والمورد وتواريخ الإقامة' : 'Hotel, Supplier & Stay Dates'}
                        </h2>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {isAr ? 'حدد الفندق، الوجهة، المورد، وتواريخ الدخول والخروج' : 'Specify hotel name, destination, supplier, and dates'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* 1. Supplier Select */}
                      <div className="sm:col-span-2">
                        <label className="block font-bold text-slate-700 text-xs mb-1">
                          {isAr ? 'حساب المورد / شركة الفنادق *' : 'Supplier / Hotel Provider *'}
                        </label>
                        <SearchableCombobox
                          options={suppliersList.map((s) => ({
                            value: s.id,
                            label: s.nameAr,
                            accountCode: s.code,
                          }))}
                          value={supplierId}
                          displayValue={supplierName}
                          onChange={(val: string) => {
                            setSupplierId(val);
                            const found = suppliersList.find((s) => s.id === val);
                            if (found) setSupplierName(found.nameAr);
                          }}
                          placeholder={isAr ? 'اختر المورد...' : 'Search supplier...'}
                          className="h-[48px]"
                        />
                      </div>

                      {/* 2. Hotel Name */}
                      <div>
                        <label className="block font-bold text-slate-700 text-xs mb-1 flex items-center gap-1">
                          <Building2 size={12} className="text-[#F45A0A]" />
                          <span>{isAr ? 'اسم الفندق والإقامة *' : 'Hotel Name *'}</span>
                        </label>
                        <input
                          type="text"
                          value={hotelName}
                          onChange={(e) => setHotelName(e.target.value)}
                          placeholder={isAr ? 'مثال: فندق العنوان دبي مول...' : 'e.g. Address Dubai Mall...'}
                          className="w-full h-[48px] px-3.5 rounded-[14px] border border-slate-200 bg-slate-50 focus:bg-white text-xs font-bold text-slate-900 focus:outline-none focus:border-[#F45A0A]"
                        />
                      </div>

                      {/* 3. Destination / City (Searchable World Cities Library) */}
                      <div>
                        <label className="block font-bold text-slate-700 text-xs mb-1 flex items-center gap-1">
                          <MapPin size={12} className="text-[#F45A0A]" />
                          <span>{isAr ? 'المدينة / الوجهة (مكتبة المدن العالمية) *' : 'City / Destination (World Cities) *'}</span>
                        </label>
                        <SearchableCombobox
                          options={WORLD_CITIES.map((c) => ({
                            value: isAr ? c.cityAr : c.cityEn,
                            label: isAr ? `${c.cityAr} (${c.countryAr})` : `${c.cityEn} (${c.countryEn})`,
                            subLabel: isAr ? c.countryAr : c.countryEn,
                          }))}
                          value={city}
                          onChange={(val: string) => {
                            setCity(val);
                            const found = WORLD_CITIES.find(
                              (c) =>
                                c.cityAr === val ||
                                c.cityEn.toLowerCase() === val.toLowerCase() ||
                                `${c.cityAr} (${c.countryAr})` === val ||
                                `${c.cityEn} (${c.countryEn})` === val
                            );
                            if (found) {
                              setCountry(isAr ? found.countryAr : found.countryEn);
                            }
                          }}
                          placeholder={isAr ? 'ابحث عن المدينة (دبي، إسطنبول، مكة...)' : 'Search city (Dubai, Istanbul, Mecca...)'}
                          allowCustomValue={true}
                          className="h-[48px]"
                        />
                      </div>

                      {/* Check-In Date */}
                      <div>
                        <label className="block font-bold text-slate-700 text-xs mb-1">
                          {isAr ? 'تاريخ الدخول (Check-in) *' : 'Check-in Date *'}
                        </label>
                        <div className="h-[48px]">
                          <SegmentedDatePicker
                            value={checkInDate}
                            onChange={(d) => d && setCheckInDate(d)}
                            placeholder={isAr ? 'تاريخ الدخول' : 'Check-in Date'}
                          />
                        </div>
                      </div>

                      {/* Check-Out Date */}
                      <div>
                        <label className="block font-bold text-slate-700 text-xs mb-1">
                          {isAr ? 'تاريخ الخروج (Check-out) *' : 'Check-out Date *'}
                        </label>
                        <div className="h-[48px]">
                          <SegmentedDatePicker
                            value={checkOutDate}
                            onChange={(d) => d && setCheckOutDate(d)}
                            placeholder={isAr ? 'تاريخ الخروج' : 'Check-out Date'}
                          />
                        </div>
                      </div>

                      {/* Nights Counter Badge */}
                      <div className="sm:col-span-2">
                        <div className="h-[48px] px-3.5 rounded-[14px] border border-orange-200 bg-orange-50/50 flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700">{isAr ? 'إجمالي عدد الليالي المحسوبة:' : 'Calculated Duration:'}</span>
                          <span
                            className="font-black text-sm text-[#F45A0A] font-mono tabular-nums"
                            style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
                            dir="ltr"
                          >
                            {nights} {isAr ? 'Nights' : 'Nights'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ════════════════════════════════════════════════════════════
                  CARD 3: تفاصيل الغرف والنزلاء والأسعار (STRUCTURED ROOMS TABLE)
                 ════════════════════════════════════════════════════════════ */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#F45A0A] text-white font-black text-xs flex items-center justify-center shadow-2xs">
                      3
                    </div>
                    <div>
                      <h2 className="font-bold text-sm sm:text-[15px] text-slate-900 leading-tight">
                        {isAr ? 'تفاصيل الغرف والنزلاء والأسعار' : 'Rooms, Guests & Rates'}
                      </h2>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {isAr ? 'أضف الغرف وحدد أسعار الشراء والبيع وأسماء النزلاء' : 'Add rooms, buy/sell prices, and guest names'}
                      </span>
                    </div>
                  </div>

                  {/* Reliable Switch Toggle for Adopt Nights Multiplier */}
                  <div className="bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 flex items-center gap-3 select-none">
                    <span className="text-xs font-bold text-slate-800">
                      {isAr ? 'اعتماد سعر عدد الليالي' : 'Multiply by Nights'}
                    </span>
                    <Switch
                      color="orange"
                      size="md"
                      checked={adoptNightsMultiplier}
                      onChange={(e) => {
                        const checked = e.currentTarget.checked;
                        setAdoptNightsMultiplier(checked);
                        setRooms((prev) => prev.map((r) => ({ ...r, adoptNightsMultiplier: checked })));
                      }}
                      styles={{
                        track: {
                          cursor: 'pointer',
                          backgroundColor: adoptNightsMultiplier ? '#F45A0A' : '#CBD5E1',
                        },
                      }}
                    />
                  </div>
                </div>

                {/* Quick Add Room Form Bar (Strict English Numbers) */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <span className="text-[11px] font-bold text-slate-700 block mb-1">
                        {isAr ? 'نوع الغرفة' : 'Room Type'}
                      </span>
                      <SearchableCombobox
                        options={ROOM_TYPES}
                        value={newRoomType}
                        onChange={(val: string) => setNewRoomType(val)}
                        placeholder={isAr ? 'نوع الغرفة' : 'Room Type'}
                        className="h-[48px]"
                      />
                    </div>

                    <div>
                      <span className="text-[11px] font-bold text-slate-700 block mb-1">
                        {isAr ? 'عدد الغرف' : 'Rooms Count'}
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={newRoomsCount}
                        onChange={(e) => setNewRoomsCount(toEnglishDigits(e.target.value))}
                        dir="ltr"
                        style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
                        className="w-full h-[48px] px-3 rounded-[14px] border border-slate-200 bg-white font-mono font-black text-xs text-center tabular-nums"
                      />
                    </div>

                    <div>
                      <span className="text-[11px] font-bold text-rose-700 block mb-1">
                        {isAr ? 'سعر الشراء / التكلفة' : 'Buy Price / Cost'}
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={newCostPrice}
                        onChange={(e) => setNewCostPrice(toEnglishDigits(e.target.value))}
                        placeholder="0.00"
                        dir="ltr"
                        style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
                        className="w-full h-[48px] px-3.5 rounded-[14px] border border-slate-300 bg-white font-mono font-black text-xs text-rose-800 text-left tabular-nums"
                      />
                    </div>

                    <div>
                      <span className="text-[11px] font-bold text-emerald-700 block mb-1">
                        {isAr ? 'سعر المبيع / العميل' : 'Sell Price / Sale'}
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={newSalePrice}
                        onChange={(e) => setNewSalePrice(toEnglishDigits(e.target.value))}
                        placeholder="0.00"
                        dir="ltr"
                        style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
                        className="w-full h-[48px] px-3.5 rounded-[14px] border border-slate-300 bg-white font-mono font-black text-xs text-emerald-800 text-left tabular-nums"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 pt-1">
                    <input
                      type="text"
                      value={newGuestName}
                      onChange={(e) => setNewGuestName(e.target.value)}
                      placeholder={isAr ? 'اسم النزيل / المسافر الرئيسي في هذه الغرفة...' : 'Main guest name for this room...'}
                      className="flex-1 h-[48px] px-3.5 rounded-[14px] border border-slate-200 bg-white font-bold text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAddRoom}
                      className="h-[48px] px-6 rounded-[14px] bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-bold text-xs flex items-center gap-2 shrink-0 cursor-pointer shadow-2xs"
                    >
                      <Plus size={16} />
                      <span>{isAr ? 'إضافة غرفة' : 'Add Room'}</span>
                    </button>
                  </div>
                </div>

                {/* Structured Clean Table for Rooms */}
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                  <table className="w-full text-right text-xs border-collapse" dir={direction}>
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                        <th className="p-3 text-center w-10">#</th>
                        <th className="p-3">{isAr ? 'نوع الغرفة' : 'Room Type'}</th>
                        <th className="p-3 text-center">{isAr ? 'العدد' : 'Qty'}</th>
                        <th className="p-3 text-center">{isAr ? 'الليالي' : 'Nights'}</th>
                        <th className="p-3">{isAr ? 'اسم النزيل / المسافر' : 'Guest Name'}</th>
                        <th className="p-3 text-center text-rose-700">{isAr ? 'سعر الشراء' : 'Buy Price'}</th>
                        <th className="p-3 text-center text-rose-800 font-black">{isAr ? 'إجمالي الشراء' : 'Total Buy'}</th>
                        <th className="p-3 text-center text-emerald-700">{isAr ? 'سعر البيع' : 'Sell Price'}</th>
                        <th className="p-3 text-center text-emerald-800 font-black">{isAr ? 'إجمالي البيع' : 'Total Sell'}</th>
                        <th className="p-3 text-center text-[#F45A0A] font-black">{isAr ? 'الربح' : 'Profit'}</th>
                        <th className="p-3 text-center w-12">{isAr ? 'حذف' : 'Del'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rooms.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="p-6 text-center text-slate-400 font-medium">
                            {isAr ? 'لم يتم إضافة أي غرف حتى الآن. استخدم النموذج أعلاه للإضافة.' : 'No rooms added yet. Use form above to add.'}
                          </td>
                        </tr>
                      ) : (
                        rooms.map((room, idx) => {
                          const roomNights = room.adoptNightsMultiplier ? (room.nights || nights || 1) : 1;
                          const subCost = (Number(room.costPrice) || 0) * (room.roomsCount || 1) * roomNights;
                          const subSale = (Number(room.salePrice) || 0) * (room.roomsCount || 1) * roomNights;
                          const subProfit = subSale - subCost;

                          return (
                            <tr key={room.id} className="hover:bg-orange-50/30 transition-colors">
                              <td className="p-3 text-center font-mono font-black text-slate-400" dir="ltr">
                                {idx + 1}
                              </td>
                              <td className="p-3 font-bold text-slate-900">
                                {room.roomTypeName}
                              </td>
                              <td className="p-3 text-center font-mono font-black text-slate-800" dir="ltr">
                                {room.roomsCount}
                              </td>
                              <td className="p-3 text-center font-mono font-bold text-slate-600" dir="ltr">
                                {roomNights}
                              </td>
                              <td className="p-3">
                                <input
                                  type="text"
                                  value={room.guestNames?.[0] || ''}
                                  onChange={(e) => handleUpdateRoom(room.id, 'guestNames', [e.target.value])}
                                  placeholder={isAr ? 'اسم النزيل...' : 'Guest name...'}
                                  className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white text-xs font-bold text-slate-800"
                                />
                              </td>
                              <td className="p-3 text-center font-mono font-bold text-rose-700" dir="ltr">
                                {Number(room.costPrice || 0).toLocaleString('en-US')}
                              </td>
                              <td className="p-3 text-center font-mono font-black text-rose-800" dir="ltr">
                                {subCost.toLocaleString('en-US')}
                              </td>
                              <td className="p-3 text-center font-mono font-bold text-emerald-700" dir="ltr">
                                {Number(room.salePrice || 0).toLocaleString('en-US')}
                              </td>
                              <td className="p-3 text-center font-mono font-black text-emerald-800" dir="ltr">
                                {subSale.toLocaleString('en-US')}
                              </td>
                              <td className="p-3 text-center font-mono font-black text-[#F45A0A]" dir="ltr">
                                {subProfit.toLocaleString('en-US')}
                              </td>
                              <td className="p-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRoom(room.id)}
                                  className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg transition-colors cursor-pointer"
                                  title={isAr ? 'حذف الغرفة' : 'Delete'}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ════════════════════════════════════════════════════════════
                  CARD 4: طرق الدفع والتسوية والمرفقات (REAL PAYMENT METHODS & ATTACHMENTS)
                 ════════════════════════════════════════════════════════════ */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-full bg-[#F45A0A] text-white font-black text-xs flex items-center justify-center shadow-2xs">
                    4
                  </div>
                  <div>
                    <h2 className="font-bold text-sm sm:text-[15px] text-slate-900 leading-tight">
                      {isAr ? 'طرق الدفع والتسوية والمرفقات' : 'Payment Methods & Attachments'}
                    </h2>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {isAr ? 'طريقة الدفع الحقيقية، صناديق القبض والدفع، ومرفقات الإيصالات' : 'Real payment methods, cashboxes, and receipt attachments'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                  {/* Payment Term (نوع السداد) */}
                  <div className={paymentTerm === 'نقدي' ? 'sm:col-span-1' : 'sm:col-span-1 md:col-span-2'}>
                    <label className="block font-bold text-slate-700 text-xs mb-1">
                      {isAr ? 'نوع السداد' : 'Payment Term'}
                    </label>
                    <SearchableCombobox
                      options={[
                        { value: 'نقدي', label: isAr ? 'نقدي (تحصيل فوري)' : 'Cash (Immediate)' },
                        { value: 'آجل', label: isAr ? 'آجل (ذمة العميل)' : 'Credit (On Account)' },
                      ]}
                      value={paymentTerm}
                      onChange={(val: string) => {
                        const next = (val as any) || 'نقدي';
                        setPaymentTerm(next);
                        if (next === 'آجل') {
                          setSalesCashboxId('');
                          setSalesCashboxName('');
                        }
                      }}
                      placeholder={isAr ? 'نوع السداد' : 'Payment Term'}
                      className="h-[48px]"
                    />
                  </div>

                  {paymentTerm === 'نقدي' && (
                    <>
                      {/* Real Payment Method Select from Settings */}
                      <div className="sm:col-span-1">
                        <label className="block font-bold text-slate-700 text-xs mb-1">
                          {isAr ? 'طريقة الاستلام (من الإعدادات) *' : 'Receiving Method *'}
                        </label>
                        <SearchableCombobox
                          options={realPaymentOptions}
                          value={paymentType}
                          onChange={(val: string) => setPaymentType(val)}
                          placeholder={isAr ? 'طريقة الاستلام' : 'Receiving Method'}
                          className="h-[48px]"
                        />
                      </div>

                      {/* Sales Cashbox */}
                      <div className="sm:col-span-1">
                        <label className="block font-bold text-slate-700 text-xs mb-1">
                          {isAr ? 'صندوق تحصيل المبيعات' : 'Sales Cashbox'}
                        </label>
                        <SearchableCombobox
                          options={cashboxAccounts.map((c) => ({
                            value: c.id,
                            label: c.nameAr,
                            accountCode: c.code,
                          }))}
                          value={salesCashboxId}
                          onChange={(val: string) => {
                            setSalesCashboxId(val);
                            const found = cashboxAccounts.find((c) => c.id === val);
                            if (found) setSalesCashboxName(found.nameAr);
                          }}
                          placeholder={isAr ? 'صندوق المبيعات...' : 'Sales cashbox...'}
                          className="h-[48px]"
                        />
                      </div>
                    </>
                  )}

                  {/* Issuing Staff (Compact Dropdown) */}
                  <div className={paymentTerm === 'نقدي' ? 'sm:col-span-1' : 'sm:col-span-1 md:col-span-2'}>
                    <label className="block font-bold text-slate-700 text-xs mb-1 flex items-center gap-1">
                      <UserCheck size={13} className="text-[#F45A0A]" />
                      <span>{isAr ? 'موظف الإصدار المسؤول' : 'Issuing Staff'}</span>
                    </label>
                    <SearchableCombobox
                      options={employeeOptions}
                      value={issuerEmployee}
                      onChange={(val: string) => setIssuerEmployee(val)}
                      placeholder={isAr ? 'اختر الموظف...' : 'Issuing employee...'}
                      className="h-[48px]"
                    />
                  </div>
                </div>

                {/* File Attachments Section for Payment Receipts */}
                <div className="pt-2 border-t border-slate-100">
                  <span className="block font-bold text-slate-800 text-xs mb-2 flex items-center gap-1.5">
                    <Paperclip size={14} className="text-[#F45A0A]" />
                    <span>{isAr ? 'إرفاق وصل الدفع / الإيصالات والمستندات' : 'Attach Payment Receipts & Vouchers'}</span>
                  </span>
                  <TicketAttachmentsSection
                    attachments={attachments}
                    onChange={(updated) => setAttachments(updated)}
                  />
                </div>
              </div>

              {/* ════════════════════════════════════════════════════════════
                  CARD 5: الملاحظات والشروط
                 ════════════════════════════════════════════════════════════ */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
                <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-full bg-[#F45A0A] text-white font-black text-xs flex items-center justify-center shadow-2xs">
                    5
                  </div>
                  <div>
                    <h2 className="font-bold text-sm sm:text-[15px] text-slate-900 leading-tight">
                      {isAr ? 'شروط وملاحظات الحجز الفندقي' : 'Hotel Terms & Booking Remarks'}
                    </h2>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {isAr ? 'اكتب أية شروط خاصة بسياسة الفندق، وجبات الإفطار، ووقت الوصول' : 'Enter cancellation policy, breakfast, check-in instructions'}
                    </span>
                  </div>
                </div>

                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={isAr ? 'اكتب أية شروط خاصة بالفندق وسياسة الإلغاء وتعديل التواريخ...' : 'Enter hotel terms, cancellation policy, and notes...'}
                  rows={3}
                  size="xs"
                  styles={{
                    input: {
                      borderRadius: '12px',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      padding: '12px',
                    },
                  }}
                />
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                LEFT AREA (4 Cols / 380px Width): STICKY FINANCIAL SUMMARY
               ───────────────────────────────────────────────────────────── */}
            <div className="xl:col-span-4 xl:sticky xl:top-20">
              <HotelFinancialSummary
                invoiceNumber={invoiceNumber}
                status={status}
                hotelName={hotelName}
                city={city}
                checkInDate={checkInDate}
                checkOutDate={checkOutDate}
                nights={nights}
                roomsCount={rooms.length}
                guestsCount={rooms.reduce((acc, r) => acc + (r.guestNames?.length || 1), 0)}
                totalCost={calculatedFinancials.netCost}
                totalSale={calculatedFinancials.netSale}
                netProfit={calculatedFinancials.netProfit}
                profitMargin={calculatedFinancials.profitMargin}
                currency={currency}
                exchangeRate={exchangeRate}
                paymentType={paymentType}
                customerName={customerName}
                supplierName={supplierName}
                salesCashboxName={salesCashboxName}
                purchaseCashboxName={purchaseCashboxName}
              />
            </div>
          </div>
        </main>

        {/* ════════════════════════════════════════════════════════════════════
            4. FIXED BOTTOM ACTION BAR
           ════════════════════════════════════════════════════════════════════ */}
        <footer className="sticky bottom-0 z-30 h-[62px] bg-white border-t border-slate-200 px-4 sm:px-6 flex items-center justify-between shadow-lg shrink-0">
          {/* Right: Booking Number & Sequence + New Booking */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-100/90 border border-slate-200 px-3 py-1.5 rounded-xl">
              <span className="text-xs font-bold text-slate-600">{isAr ? 'رقم الفاتورة:' : 'Invoice No:'}</span>
              <span
                className="font-black text-sm text-[#F45A0A] font-mono tabular-nums"
                style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
                dir="ltr"
              >
                {invoiceNumber}
              </span>
            </div>

            <Tooltip label={isAr ? 'تفريغ الحقول وبدء حجز فندقي جديد' : 'New blank booking'} withArrow>
              <button
                type="button"
                onClick={handleNewBooking}
                className="h-9 px-3.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-[#F45A0A] font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus size={14} />
                <span>{isAr ? 'سند جديد' : 'New Booking'}</span>
              </button>
            </Tooltip>
          </div>

          {/* Left: Cancel & Save Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="h-[42px] px-5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>

            <button
              type="button"
              onClick={handleSaveBooking}
              disabled={isSaving}
              className="h-[42px] px-6 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              <Save size={16} />
              <span>{isSaving ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : (isAr ? 'حفظ واعتماد الحجز' : 'Save & Confirm')}</span>
            </button>
          </div>
        </footer>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          5. WINDOW USER DEFAULTS SETTINGS MODAL
         ════════════════════════════════════════════════════════════════════ */}
      <Modal
        opened={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        title={
          <div className="flex items-center gap-2 text-slate-950 font-black text-sm">
            <div className="w-7 h-7 rounded-lg bg-orange-50 text-[#F45A0A] flex items-center justify-center">
              <Settings size={16} />
            </div>
            <span>{isAr ? 'تخصيص الإعدادات الافتراضية لحجوزات الفنادق' : 'Hotel Booking Default Preferences'}</span>
          </div>
        }
        size="md"
        centered
        radius="16px"
      >
        <div className="space-y-3.5 text-xs select-none" dir={direction}>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-600 font-medium">
            {isAr
              ? 'حدد الخيارات الافتراضية المفضلة ليتم اعتمادها وتعبئتها تلقائياً عند فتح نافذة الحجز الفندقي الجديد:'
              : 'Configure default selections to be automatically applied when opening a new hotel booking:'}
          </div>

          <div className="space-y-3">
            {/* Default Currency */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-1.5 shadow-2xs">
              <label className="block font-bold text-slate-800 text-xs">
                {isAr ? 'العملة الافتراضية:' : 'Default Currency:'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDefaultCurrency('USD')}
                  className={`h-9 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center border ${
                    defaultCurrency === 'USD'
                      ? 'bg-orange-50 border-[#F45A0A] text-[#F45A0A] font-black'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  USD ($) - {isAr ? 'دولار' : 'Dollar'}
                </button>
                <button
                  type="button"
                  onClick={() => setDefaultCurrency('IQD')}
                  className={`h-9 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center border ${
                    defaultCurrency === 'IQD'
                      ? 'bg-orange-50 border-[#F45A0A] text-[#F45A0A] font-black'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  IQD (د.ع) - {isAr ? 'دينار' : 'Dinar'}
                </button>
              </div>
            </div>

            {/* Default Payment Type */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-1.5 shadow-2xs">
              <label className="block font-bold text-slate-800 text-xs">
                {isAr ? 'طريقة الدفع الافتراضية:' : 'Default Payment Type:'}
              </label>
              <SearchableCombobox
                options={realPaymentOptions}
                value={defaultPaymentType}
                onChange={(val: string) => setDefaultPaymentType(val)}
                placeholder={isAr ? 'طريقة الدفع' : 'Payment Type'}
                className="h-[42px]"
              />
            </div>

            {/* Default City & Country */}
            <div className="space-y-2 bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
              <div>
                <label className="block font-bold text-slate-800 text-xs mb-1">
                  {isAr ? 'المدينة الافتراضية (مكتبة المدن العالمية):' : 'Default City (World Cities):'}
                </label>
                <SearchableCombobox
                  options={WORLD_CITIES.map((c) => ({
                    value: isAr ? c.cityAr : c.cityEn,
                    label: isAr ? `${c.cityAr} (${c.countryAr})` : `${c.cityEn} (${c.countryEn})`,
                    subLabel: isAr ? c.countryAr : c.countryEn,
                  }))}
                  value={defaultCity}
                  onChange={(val: string) => {
                    setDefaultCity(val);
                    const found = WORLD_CITIES.find(
                      (c) =>
                        c.cityAr === val ||
                        c.cityEn.toLowerCase() === val.toLowerCase() ||
                        `${c.cityAr} (${c.countryAr})` === val ||
                        `${c.cityEn} (${c.countryEn})` === val
                    );
                    if (found) {
                      setDefaultCountry(isAr ? found.countryAr : found.countryEn);
                    }
                  }}
                  placeholder={isAr ? 'اختر المدينة الافتراضية...' : 'Select default city...'}
                  allowCustomValue={true}
                  className="h-[42px]"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-800 text-xs mb-1">
                  {isAr ? 'الدولة الافتراضية:' : 'Default Country:'}
                </label>
                <input
                  type="text"
                  value={defaultCountry}
                  onChange={(e) => setDefaultCountry(e.target.value)}
                  className="w-full h-[40px] px-3 rounded-xl border border-slate-200 bg-slate-50 font-bold text-xs"
                />
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setSettingsModalOpen(false)}
              className="h-9 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleSaveUserDefaults}
              className="h-9 px-5 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Check size={15} />
              <span>{isAr ? 'حفظ الإعدادات' : 'Save Defaults'}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* ════════════════════════════════════════════════════════════════════
          6. INVOICE AUDIT LOG MODAL (سجل التعديلات)
         ════════════════════════════════════════════════════════════════════ */}
      <InvoiceAuditLogModal
        opened={auditLogOpen}
        onClose={() => setAuditLogOpen(false)}
        ticketNumber={invoiceNumber}
        customerName={customerName}
      />
    </div>
  );
};
