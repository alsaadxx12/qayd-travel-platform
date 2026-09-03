import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Loader } from '@mantine/core';
import {
  Luggage,
  Save,
  X,
  Plus,
  Trash2,
  Copy,
  Search,
} from 'lucide-react';
import { SearchableCombobox } from '../ui/SearchableCombobox';
import { SegmentedDatePicker } from '../ui/SegmentedDatePicker';
import { AccountFinderModal, type AccountFinderResult } from '../common/AccountFinderModal';
import { ticketsApi, type TicketData } from '../../api/tickets';
import { partnersApi, type Customer, type Supplier } from '../../api/partners';
import { accountsApi } from '../../api/accounts';
import { allocateDocumentNumber } from '../../utils/sequenceUtils';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { useLanguageStore } from '../../store/useLanguageStore';
import { decodeServiceExtras, encodeServiceExtras } from '../services/serviceKinds';

export interface BaggagePassenger {
  id: string;
  name: string;
  passportNumber: string;
  weight: number;
  unit: 'KG' | 'PIECE';
  fareBuy: number;
  fareSell: number;
}

interface Props {
  opened: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialData?: TicketData | null;
}

const formatNumber = (num: number) =>
  Number(num || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });

const parseNumber = (val: any) => {
  const n = Number(String(val ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
};

export const BaggageInvoiceModal: React.FC<Props> = ({
  opened,
  onClose,
  onSuccess,
  initialData,
}) => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  // ── Form State ──
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState<string>(new Date().toISOString().slice(0, 10));
  
  // Beneficiary & Supplier
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerAccountId, setCustomerAccountId] = useState('');

  const [supplierId, setSupplierId] = useState('');
  const [supplierAccountName, setSupplierAccountName] = useState('');
  const [supplierAccountId, setSupplierAccountId] = useState('');

  // PNR only
  const [pnr, setPnr] = useState('');

  // Payment & Currency (Default strictly USD as requested)
  const [currency, setCurrency] = useState<'USD' | 'IQD'>('USD');
  const [paymentType, setPaymentType] = useState<'DEBIT' | 'CREDIT'>('DEBIT');
  const [cashboxAccountId, setCashboxAccountId] = useState('');

  // Advanced Account Finder Modal State
  const [accountFinder, setAccountFinder] = useState<{
    open: boolean;
    query: string;
    scope: 'SUPPLIER' | 'CUSTOMER';
  }>({ open: false, query: '', scope: 'CUSTOMER' });

  // Passengers list (each passenger has their own specific weight and price)
  const [passengers, setPassengers] = useState<BaggagePassenger[]>([
    {
      id: 'pax-1',
      name: '',
      passportNumber: '',
      weight: 20,
      unit: 'KG',
      fareBuy: 0,
      fareSell: 0,
    },
  ]);

  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Dropdown options
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [cashboxes, setCashboxes] = useState<any[]>([]);

  // ── Load Dropdowns ──
  useEffect(() => {
    if (!opened) return;

    partnersApi
      .getCustomers()
      .then((res: any) => setCustomers(Array.isArray(res) ? res : res?.data || []))
      .catch(() => undefined);

    partnersApi
      .getSuppliers()
      .then((res: any) => setSuppliers(Array.isArray(res) ? res : res?.data || []))
      .catch(() => undefined);

    accountsApi
      .getFlat(undefined, undefined, true)
      .then((res: any) => {
        const list = Array.isArray(res) ? res : res?.data || [];
        setCashboxes(list.filter((a: any) => a.category === 'CASH' && !a.isParent));
      })
      .catch(() => undefined);
  }, [opened]);

  // ── Initialize or Reset on Open ──
  useEffect(() => {
    if (!opened) return;

    if (initialData) {
      const { userNotes, extras } = decodeServiceExtras(initialData.notes);
      setInvoiceNumber(initialData.invoiceNumber || '');
      setIssueDate(String(initialData.issueDate || new Date().toISOString()).slice(0, 10));
      setCustomerId(initialData.customerId || '');
      setCustomerName(initialData.customerName || '');
      setCustomerAccountId(initialData.customerAccountId || '');
      setSupplierId(initialData.supplierId || '');
      setSupplierAccountName(initialData.supplierAccountName || '');
      setSupplierAccountId(initialData.supplierAccountId || '');
      setPnr((initialData.pnr || extras.pnr || '').toUpperCase());
      // Default to USD unless strictly specified IQD
      setCurrency(String(initialData.currency || '').toUpperCase() === 'IQD' ? 'IQD' : 'USD');
      setPaymentType(String(initialData.paymentType || 'DEBIT') === 'CREDIT' ? 'CREDIT' : 'DEBIT');
      setCashboxAccountId((initialData as any).cashboxAccountId || '');
      setNotes(userNotes);

      const rawPax = initialData.passengers || [];
      if (rawPax.length > 0) {
        setPassengers(
          rawPax.map((p: any, idx: number) => ({
            id: p.id || `pax-${idx + 1}`,
            name: p.name || '',
            passportNumber: p.documentNumber || p.ticketNumber || '',
            weight: Number(p.charge || 0) || 20,
            unit: 'KG',
            fareBuy: Number(p.fareBuy || 0),
            fareSell: Number(p.fareSell || 0),
          }))
        );
      } else {
        setPassengers([
          {
            id: 'pax-1',
            name: initialData.customerName || '',
            passportNumber: '',
            weight: Number(extras.totalWeight || extras.quantity || 20),
            unit: 'KG',
            fareBuy: Number(initialData.totalBuy || 0),
            fareSell: Number(initialData.totalSell || 0),
          },
        ]);
      }
    } else {
      setInvoiceNumber('');
      allocateDocumentNumber('baggage')
        .then(setInvoiceNumber)
        .catch(() => setInvoiceNumber('WGT-0001'));

      setIssueDate(new Date().toISOString().slice(0, 10));
      setCustomerId('');
      setCustomerName('');
      setCustomerAccountId('');
      setSupplierId('');
      setSupplierAccountName('');
      setSupplierAccountId('');
      setPnr('');
      // Strictly default to USD as requested
      setCurrency('USD');
      setPaymentType('DEBIT');
      setCashboxAccountId('');
      setNotes('');
      setPassengers([
        {
          id: `pax-${Date.now()}`,
          name: '',
          passportNumber: '',
          weight: 20,
          unit: 'KG',
          fareBuy: 0,
          fareSell: 0,
        },
      ]);
    }
  }, [opened, initialData]);

  // Set default cashbox when cashboxes load
  useEffect(() => {
    if (cashboxes.length > 0 && !cashboxAccountId && paymentType === 'DEBIT') {
      setCashboxAccountId(cashboxes[0].id);
    }
  }, [cashboxes, cashboxAccountId, paymentType]);

  // ── Dynamic Totals ──
  const totals = useMemo(() => {
    let sumWeight = 0;
    let sumBuy = 0;
    let sumSell = 0;
    for (const p of passengers) {
      sumWeight += Number(p.weight || 0);
      sumBuy += Number(p.fareBuy || 0);
      sumSell += Number(p.fareSell || 0);
    }
    return {
      totalWeight: sumWeight,
      totalBuy: sumBuy,
      totalSell: sumSell,
      profit: Math.max(0, sumSell - sumBuy),
    };
  }, [passengers]);

  const handleUpdatePassenger = (
    index: number,
    field: keyof BaggagePassenger,
    value: any
  ) => {
    setPassengers((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAddPassenger = () => {
    setPassengers((prev) => [
      ...prev,
      {
        id: `pax-${Date.now()}-${prev.length + 1}`,
        name: '',
        passportNumber: '',
        weight: 20,
        unit: 'KG',
        fareBuy: 0,
        fareSell: 0,
      },
    ]);
  };

  const handleDuplicatePassenger = (index: number) => {
    const target = passengers[index];
    if (!target) return;
    setPassengers((prev) => [
      ...prev,
      {
        ...target,
        id: `pax-${Date.now()}-${prev.length + 1}`,
        name: '',
        passportNumber: '',
      },
    ]);
  };

  const handleRemovePassenger = (index: number) => {
    if (passengers.length <= 1) return;
    setPassengers((prev) => prev.filter((_, idx) => idx !== index));
  };

  // ── Save Baggage Invoice ──
  const handleSave = async () => {
    if (!customerName.trim()) {
      showErrorNotification(
        isAr ? 'المستفيد مطلوب' : 'Beneficiary is required',
        isAr ? 'يرجى تحديد اسم المستفيد' : 'Please select beneficiary'
      );
      return;
    }

    if (!pnr.trim()) {
      showErrorNotification(
        isAr ? 'رمز PNR مطلوب' : 'PNR is required',
        isAr ? 'يرجى إدخال رمز الحجز PNR' : 'Please enter PNR'
      );
      return;
    }

    if (totals.totalSell <= 0) {
      showErrorNotification(
        isAr ? 'سعر البيع مطلوب' : 'Sale price required',
        isAr ? 'يرجى إدخال سعر بيع الوزن للمسافرين' : 'Enter sale price'
      );
      return;
    }

    if (paymentType === 'DEBIT' && !cashboxAccountId && cashboxes.length > 0) {
      showErrorNotification(
        isAr ? 'الصندوق مطلوب' : 'Cashbox required',
        isAr ? 'يرجى تحديد صندوق القبض' : 'Select cashbox'
      );
      return;
    }

    let resolvedCustomerAccountId = customerAccountId;
    let resolvedCustomerId = customerId;
    if (!resolvedCustomerAccountId && customerName) {
      const match = customers.find(
        (c) => c.nameAr === customerName || c.nameEn === customerName || c.id === customerId
      );
      if (match) {
        resolvedCustomerAccountId = match.accountId || match.account?.id || '';
        resolvedCustomerId = match.id;
      }
    }

    let resolvedSupplierAccountId = supplierAccountId;
    let resolvedSupplierId = supplierId;
    if (!resolvedSupplierAccountId && supplierAccountName) {
      const match = suppliers.find(
        (s) => s.nameAr === supplierAccountName || s.nameEn === supplierAccountName || s.id === supplierId
      );
      if (match) {
        resolvedSupplierAccountId = match.accountId || match.account?.id || '';
        resolvedSupplierId = match.id;
      }
    }

    const passengerLines = passengers.map((p, idx) => {
      const pName = p.name.trim() || `${customerName.trim()} (${isAr ? 'مسافر' : 'Pax'} ${idx + 1})`;
      return {
        name: pName,
        ticketType: 'ADULT',
        documentNumber: p.passportNumber.trim() || undefined,
        ticketNumber: p.passportNumber.trim() || undefined,
        pnr: pnr.trim().toUpperCase(),
        fareBuy: Number(p.fareBuy || 0),
        fareSell: Number(p.fareSell || 0),
        charge: Number(p.weight || 0),
        status: 'مؤكد',
      };
    });

    const extrasData = {
      quantity: totals.totalWeight,
      totalWeight: totals.totalWeight,
      pnr: pnr.trim().toUpperCase(),
      serviceType: 'BAGGAGE',
    };

    const payload: any = {
      invoiceNumber: invoiceNumber.trim(),
      issueDate: new Date(issueDate).toISOString(),
      tripType: 'BAGGAGE',
      customerName: customerName.trim(),
      customerId: resolvedCustomerId || undefined,
      customerAccountId: resolvedCustomerAccountId || undefined,
      supplierAccount: supplierAccountName.trim() || undefined,
      supplierAccountName: supplierAccountName.trim() || undefined,
      supplierId: resolvedSupplierId || undefined,
      supplierAccountId: resolvedSupplierAccountId || undefined,
      currency,
      paymentType,
      cashboxAccountId: paymentType === 'DEBIT' ? cashboxAccountId || undefined : undefined,
      receivingCashbox: paymentType === 'DEBIT' ? cashboxAccountId || undefined : undefined,
      pnr: pnr.trim().toUpperCase(),
      totalBuy: totals.totalBuy,
      totalSell: totals.totalSell,
      netBuy: totals.totalBuy,
      netSell: totals.totalSell,
      profit: totals.profit,
      notes: encodeServiceExtras(notes, extrasData),
      status: 'POSTED',
      passengers: passengerLines,
    };

    setSaving(true);
    try {
      if (initialData?.id) {
        await ticketsApi.update(initialData.id, payload);
        showSuccessNotification(
          isAr ? 'تم تعديل فاتورة الوزن بنجاح' : 'Baggage invoice updated',
          `${invoiceNumber} — ${customerName}`
        );
      } else {
        await ticketsApi.create(payload);
        showSuccessNotification(
          isAr ? 'تم حفظ فاتورة الوزن بنجاح' : 'Baggage invoice saved',
          `${invoiceNumber} — ${customerName}`
        );
      }
      onSuccess?.();
      onClose();
    } catch (err: any) {
      showErrorNotification(
        isAr ? 'تعذّر حفظ فاتورة الوزن' : 'Failed to save baggage invoice',
        err?.message || (isAr ? 'حدث خطأ' : 'An error occurred')
      );
    } finally {
      setSaving(false);
    }
  };

  const customerOptions = useMemo(
    () =>
      customers.map((c) => ({
        value: c.nameAr || c.nameEn || c.id,
        label: c.nameAr || c.nameEn || '',
        code: c.code,
      })),
    [customers]
  );

  const supplierOptions = useMemo(
    () =>
      suppliers.map((s) => ({
        value: s.nameAr || s.nameEn || s.id,
        label: s.nameAr || s.nameEn || '',
        code: s.code,
      })),
    [suppliers]
  );

  const cashboxOptions = useMemo(
    () =>
      cashboxes.map((c: any) => ({
        value: c.id,
        label: c.nameAr || c.name || '',
        code: c.code,
      })),
    [cashboxes]
  );

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        size="1150px"
        radius="18px"
        padding={0}
        centered
        withCloseButton={false}
        overlayProps={{ opacity: 0.35, blur: 2 }}
      >
        <div className="bg-white flex flex-col max-h-[90vh] font-sans select-none overflow-hidden rounded-[18px]" dir={direction}>
          
          {/* ══════════════════════════════════════════════════════════════
              1. HEADER (ترويسة مدمجة وبسيطة)
             ══════════════════════════════════════════════════════════════ */}
          <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#F45A0A] flex items-center justify-center shrink-0">
                <Luggage size={18} />
              </div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm text-slate-900 leading-tight">
                  {initialData?.id
                    ? isAr ? 'تعديل فاتورة وزن' : 'Edit Baggage Invoice'
                    : isAr ? 'فاتورة شراء وبيع وزن' : 'Baggage Invoice'}
                </h2>
                <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200" dir="ltr">
                  {invoiceNumber || 'WGT-…'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* ══════════════════════════════════════════════════════════════
              2. BODY (حقول موحدة الارتفاع 46px تماماً لجميع العناصر)
             ══════════════════════════════════════════════════════════════ */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">

            {/* ── CARD 1: الحقول الأساسية والسداد موحدة الارتفاع ── */}
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-3">
              
              {/* Row 1: 4 Main Fields - All 46px Height, Aligned Labels */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Beneficiary */}
                <div>
                  <SearchableCombobox
                    label={isAr ? 'المستفيد / العميل *' : 'Beneficiary *'}
                    labelAction={
                      <button
                        type="button"
                        onClick={() => setAccountFinder({ open: true, query: customerName, scope: 'CUSTOMER' })}
                        className="h-[20px] px-1.5 text-[10.5px] font-bold text-[#F45A0A] hover:text-[#dd4f05] flex items-center gap-1 cursor-pointer bg-orange-50 hover:bg-orange-100 rounded border border-orange-200 transition-colors"
                      >
                        <Search size={11} />
                        <span>{isAr ? 'بحث متقدم' : 'Search'}</span>
                      </button>
                    }
                    value={customerName}
                    onChange={(val) => {
                      setCustomerName(val || '');
                      const match = customers.find((c) => c.nameAr === val || c.nameEn === val);
                      if (match) {
                        setCustomerId(match.id);
                        setCustomerAccountId(match.accountId || match.account?.id || '');
                      }
                    }}
                    options={customerOptions}
                    placeholder={isAr ? 'اختر المستفيد…' : 'Beneficiary…'}
                    allowCustomValue
                  />
                </div>

                {/* Supplier */}
                <div>
                  <SearchableCombobox
                    label={isAr ? 'المورد / شركة الطيران' : 'Supplier / Airline'}
                    labelAction={
                      <button
                        type="button"
                        onClick={() => setAccountFinder({ open: true, query: supplierAccountName, scope: 'SUPPLIER' })}
                        className="h-[20px] px-1.5 text-[10.5px] font-bold text-[#F45A0A] hover:text-[#dd4f05] flex items-center gap-1 cursor-pointer bg-orange-50 hover:bg-orange-100 rounded border border-orange-200 transition-colors"
                      >
                        <Search size={11} />
                        <span>{isAr ? 'بحث متقدم' : 'Search'}</span>
                      </button>
                    }
                    value={supplierAccountName}
                    onChange={(val) => {
                      setSupplierAccountName(val || '');
                      const match = suppliers.find((s) => s.nameAr === val || s.nameEn === val);
                      if (match) {
                        setSupplierId(match.id);
                        setSupplierAccountId(match.accountId || match.account?.id || '');
                      }
                    }}
                    options={supplierOptions}
                    placeholder={isAr ? 'المورد أو شركة الطيران…' : 'Supplier…'}
                    allowCustomValue
                  />
                </div>

                {/* PNR Code - Standard 46px Height & Aligned Label */}
                <div>
                  <div className="flex items-center justify-between gap-2 min-h-[20px] mb-[7px]">
                    <label className="block text-[12.5px] font-medium text-[#6B7280] leading-[20px] truncate">
                      {isAr ? 'رمز الحجز (PNR) *' : 'Booking Reference (PNR) *'}
                    </label>
                  </div>
                  <input
                    type="text"
                    value={pnr}
                    onChange={(e) => setPnr(e.target.value.toUpperCase())}
                    placeholder="e.g. 7XQ9L2"
                    className="w-full h-[46px] px-3.5 rounded-[11px] border border-[#E5E7EB] bg-[#FAFAFA] hover:bg-white hover:border-[#D1D5DB] text-xs font-mono font-bold text-slate-900 outline-none focus:border-2 focus:border-[#F45A0A] focus:bg-white transition-all uppercase text-center"
                    dir="ltr"
                  />
                </div>

                {/* Issue Date */}
                <div>
                  <SegmentedDatePicker
                    label={isAr ? 'تاريخ الإصدار' : 'Issue Date'}
                    value={issueDate}
                    onChange={(_, iso) => setIssueDate(iso ? iso.slice(0, 10) : new Date().toISOString().slice(0, 10))}
                    placeholder={isAr ? 'سنة/شهر/يوم' : 'YYYY/MM/DD'}
                  />
                </div>
              </div>

              {/* Row 2: Financial & Payment Controls - All 46px Height, Aligned Labels */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2.5 border-t border-slate-100">
                {/* Cashbox (if Cash) */}
                <div>
                  {paymentType === 'DEBIT' ? (
                    <SearchableCombobox
                      label={isAr ? 'صندوق القبض *' : 'Receiving Cashbox *'}
                      value={cashboxAccountId}
                      onChange={(val) => setCashboxAccountId(val || '')}
                      options={cashboxOptions}
                      placeholder={isAr ? 'اختر الصندوق…' : 'Cashbox…'}
                    />
                  ) : (
                    <div>
                      <div className="flex items-center justify-between gap-2 min-h-[20px] mb-[7px]">
                        <label className="block text-[12.5px] font-medium text-[#6B7280] leading-[20px] truncate">
                          {isAr ? 'حالة السداد' : 'Payment Status'}
                        </label>
                      </div>
                      <div className="h-[46px] px-3.5 rounded-[11px] border border-slate-200 bg-slate-50 text-slate-600 text-xs font-medium flex items-center">
                        <span>{isAr ? 'يُقيد ديناً على ذمة المستفيد' : 'Debit to beneficiary account'}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Payment Method - Exactly 46px Height */}
                <div>
                  <div className="flex items-center justify-between gap-2 min-h-[20px] mb-[7px]">
                    <label className="block text-[12.5px] font-medium text-[#6B7280] leading-[20px] truncate">
                      {isAr ? 'طريقة السداد' : 'Payment Method'}
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 h-[46px]">
                    <button
                      type="button"
                      onClick={() => setPaymentType('DEBIT')}
                      className={`h-[46px] rounded-[11px] text-xs font-bold transition-all cursor-pointer border flex items-center justify-center ${
                        paymentType === 'DEBIT'
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                          : 'bg-[#FAFAFA] border-[#E5E7EB] text-slate-700 hover:bg-white hover:border-[#D1D5DB]'
                      }`}
                    >
                      {isAr ? 'نقدي' : 'Cash'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentType('CREDIT')}
                      className={`h-[46px] rounded-[11px] text-xs font-bold transition-all cursor-pointer border flex items-center justify-center ${
                        paymentType === 'CREDIT'
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                          : 'bg-[#FAFAFA] border-[#E5E7EB] text-slate-700 hover:bg-white hover:border-[#D1D5DB]'
                      }`}
                    >
                      {isAr ? 'آجل (ذمة)' : 'Credit'}
                    </button>
                  </div>
                </div>

                {/* Currency - Exactly 46px Height, Default USD */}
                <div>
                  <div className="flex items-center justify-between gap-2 min-h-[20px] mb-[7px]">
                    <label className="block text-[12.5px] font-medium text-[#6B7280] leading-[20px] truncate">
                      {isAr ? 'العملة' : 'Currency'}
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 h-[46px]">
                    <button
                      type="button"
                      onClick={() => setCurrency('USD')}
                      className={`h-[46px] rounded-[11px] font-mono text-xs font-bold transition-all cursor-pointer border flex items-center justify-center ${
                        currency === 'USD'
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                          : 'bg-[#FAFAFA] border-[#E5E7EB] text-slate-700 hover:bg-white hover:border-[#D1D5DB]'
                      }`}
                    >
                      ($) USD
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrency('IQD')}
                      className={`h-[46px] rounded-[11px] font-mono text-xs font-bold transition-all cursor-pointer border flex items-center justify-center ${
                        currency === 'IQD'
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                          : 'bg-[#FAFAFA] border-[#E5E7EB] text-slate-700 hover:bg-white hover:border-[#D1D5DB]'
                      }`}
                    >
                      (د.ع) IQD
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* ── CARD 2: جدول المسافرين والأوزان (كل الحقول بارتفاع موحد 38px) ── */}
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-slate-900">
                    {isAr ? 'المسافرين وأوزانهم' : 'Passengers & Weights'}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {passengers.length}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleAddPassenger}
                  className="h-8 px-3 rounded-lg bg-[#F45A0A] hover:bg-[#DD4F05] text-white text-xs font-bold cursor-pointer flex items-center gap-1 transition-colors shadow-2xs"
                >
                  <Plus size={14} />
                  <span>{isAr ? 'إضافة مسافر' : 'Add Passenger'}</span>
                </button>
              </div>

              {/* Table with standard 38px inputs */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-start border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <th className="py-2 px-2.5 w-8 text-center">#</th>
                      <th className="py-2 px-2.5 text-start">{isAr ? 'اسم المسافر *' : 'Passenger Name *'}</th>
                      <th className="py-2 px-2.5 text-start w-36">{isAr ? 'رقم الجواز *' : 'Passport *'}</th>
                      <th className="py-2 px-2.5 text-center w-36">{isAr ? 'الوزن *' : 'Weight *'}</th>
                      <th className="py-2 px-2.5 text-end w-28">{isAr ? 'الشراء' : 'Buy'}</th>
                      <th className="py-2 px-2.5 text-end w-32">{isAr ? 'البيع (المطلوب) *' : 'Sell *'}</th>
                      <th className="py-2 px-2.5 text-end w-24">{isAr ? 'الربح' : 'Profit'}</th>
                      <th className="py-2 px-2 w-14 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {passengers.map((pax, idx) => {
                      const paxProfit = (Number(pax.fareSell) || 0) - (Number(pax.fareBuy) || 0);
                      return (
                        <tr key={pax.id} className="hover:bg-slate-50/60 transition-colors">
                          {/* Index */}
                          <td className="py-2 px-2.5 text-center font-mono font-bold text-slate-400">
                            {idx + 1}
                          </td>

                          {/* Name - 38px */}
                          <td className="py-2 px-2.5">
                            <input
                              type="text"
                              value={pax.name}
                              onChange={(e) => handleUpdatePassenger(idx, 'name', e.target.value)}
                              placeholder={isAr ? 'اسم المسافر…' : 'Passenger name…'}
                              className="w-full h-[38px] px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-900 outline-none hover:border-slate-300 focus:border-[#F45A0A] transition-all"
                            />
                          </td>

                          {/* Passport - 38px */}
                          <td className="py-2 px-2.5">
                            <input
                              type="text"
                              value={pax.passportNumber}
                              onChange={(e) => handleUpdatePassenger(idx, 'passportNumber', e.target.value.toUpperCase())}
                              placeholder="A12345678"
                              className="w-full h-[38px] px-3 rounded-lg border border-slate-200 bg-white text-xs font-mono font-bold text-slate-800 outline-none hover:border-slate-300 focus:border-[#F45A0A] uppercase transition-all"
                              dir="ltr"
                            />
                          </td>

                          {/* Weight & Unit - 38px */}
                          <td className="py-2 px-2.5">
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={pax.weight || ''}
                                onChange={(e) => handleUpdatePassenger(idx, 'weight', parseNumber(e.target.value))}
                                placeholder="20"
                                className="w-full h-[38px] px-2 rounded-lg border border-slate-200 bg-white text-xs font-mono font-bold text-slate-900 outline-none hover:border-slate-300 focus:border-[#F45A0A] text-center transition-all"
                                dir="ltr"
                              />
                              <select
                                value={pax.unit || 'KG'}
                                onChange={(e) => handleUpdatePassenger(idx, 'unit', e.target.value as any)}
                                className="h-[38px] px-2 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-700 outline-none cursor-pointer hover:border-slate-300 focus:border-[#F45A0A] transition-all shrink-0"
                              >
                                <option value="KG">{isAr ? 'كغم' : 'KG'}</option>
                                <option value="PIECE">{isAr ? 'قطعة' : 'Pc'}</option>
                              </select>
                            </div>
                          </td>

                          {/* Buy Price - 38px */}
                          <td className="py-2 px-2.5">
                            <input
                              type="text"
                              value={pax.fareBuy ? formatNumber(pax.fareBuy) : ''}
                              onChange={(e) => handleUpdatePassenger(idx, 'fareBuy', parseNumber(e.target.value))}
                              placeholder="0"
                              className="w-full h-[38px] px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-mono text-slate-700 outline-none hover:border-slate-300 focus:border-[#F45A0A] text-end transition-all"
                              dir="ltr"
                            />
                          </td>

                          {/* Sell Price - 38px */}
                          <td className="py-2 px-2.5">
                            <input
                              type="text"
                              value={pax.fareSell ? formatNumber(pax.fareSell) : ''}
                              onChange={(e) => handleUpdatePassenger(idx, 'fareSell', parseNumber(e.target.value))}
                              placeholder="0"
                              className="w-full h-[38px] px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-mono font-bold text-slate-900 outline-none hover:border-slate-300 focus:border-[#F45A0A] text-end transition-all"
                              dir="ltr"
                            />
                          </td>

                          {/* Profit */}
                          <td className="py-2 px-2.5 text-end font-mono font-bold text-xs h-[38px]" dir="ltr">
                            <span className={paxProfit >= 0 ? 'text-[#078B61]' : 'text-rose-600'}>
                              {paxProfit >= 0 ? `+${formatNumber(paxProfit)}` : formatNumber(paxProfit)}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-2 px-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                title={isAr ? 'تكرار' : 'Duplicate'}
                                onClick={() => handleDuplicatePassenger(idx)}
                                className="w-7 h-7 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
                              >
                                <Copy size={13} />
                              </button>
                              {passengers.length > 1 && (
                                <button
                                  type="button"
                                  title={isAr ? 'حذف' : 'Delete'}
                                  onClick={() => handleRemovePassenger(idx)}
                                  className="w-7 h-7 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer transition-colors"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Total Summary Row */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-4 flex-wrap">
                  <div>
                    <span className="text-slate-500">{isAr ? 'إجمالي الوزن: ' : 'Total Weight: '}</span>
                    <span className="font-mono font-bold text-slate-800" dir="ltr">
                      {formatNumber(totals.totalWeight)} {isAr ? 'كغم' : 'KG'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500">{isAr ? 'إجمالي الشراء: ' : 'Total Buy: '}</span>
                    <span className="font-mono font-bold text-slate-800" dir="ltr">
                      {formatNumber(totals.totalBuy)} {currency === 'USD' ? '$' : 'IQD'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500">{isAr ? 'المطلوب: ' : 'Total Sell: '}</span>
                    <span className="font-mono font-black text-slate-900" dir="ltr">
                      {formatNumber(totals.totalSell)} {currency === 'USD' ? '$' : 'IQD'}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-500">{isAr ? 'الصافي: ' : 'Profit: '}</span>
                  <span className="font-mono font-black text-[#078B61]" dir="ltr">
                    +{formatNumber(totals.profit)} {currency === 'USD' ? '$' : 'IQD'}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Notes ── */}
            <div>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={isAr ? 'ملاحظات (اختياري)…' : 'Notes (optional)…'}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 outline-none hover:border-slate-300 focus:border-[#F45A0A] transition-all"
              />
            </div>

          </div>

          {/* ══════════════════════════════════════════════════════════════
              3. FOOTER
             ══════════════════════════════════════════════════════════════ */}
          <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between shrink-0 bg-white">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">{isAr ? 'المطلوب من المستفيد:' : 'Total Due:'}</span>
              <span className="font-mono font-black text-sm text-slate-900" dir="ltr">
                {formatNumber(totals.totalSell)} {currency === 'USD' ? '$' : 'IQD'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer transition-colors"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="h-9 px-5 rounded-lg bg-[#F45A0A] hover:bg-[#DD4F05] disabled:opacity-60 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-xs transition-all active:scale-[0.98]"
              >
                {saving ? <Loader size={14} color="white" /> : <Save size={14} />}
                <span>{isAr ? 'حفظ الفاتورة والترحيل' : 'Save & Post'}</span>
              </button>
            </div>
          </div>

        </div>
      </Modal>

      {/* ── Advanced Account Finder Modal (كما في التذاكر) ── */}
      <AccountFinderModal
        opened={accountFinder.open}
        initialQuery={accountFinder.query}
        initialScope={accountFinder.scope}
        onClose={() => setAccountFinder((prev) => ({ ...prev, open: false }))}
        onSelect={(account: AccountFinderResult) => {
          if (accountFinder.scope === 'SUPPLIER') {
            setSupplierAccountName(account.name);
            setSupplierAccountId(account.id);
            setSupplierId(account.id);
          } else {
            setCustomerName(account.name);
            setCustomerAccountId(account.id);
            setCustomerId(account.id);
          }
        }}
      />
    </>
  );
};

export default BaggageInvoiceModal;
