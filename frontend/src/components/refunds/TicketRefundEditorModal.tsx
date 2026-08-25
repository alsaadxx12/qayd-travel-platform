import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Button,
  Badge,
  TextInput,
  Textarea,
  Select,
  Radio,
  Group,
  Stack,
  Alert,
  Divider,
} from '@mantine/core';
import {
  IconArrowBackUp,
  IconSearch,
  IconPlane,
  IconBuildingStore,
  IconUser,
  IconCash,
  IconCreditCard,
  IconCheck,
  IconAlertCircle,
  IconReceipt,
  IconCalculator,
  IconInfoCircle,
  IconX,
  IconSparkles,
} from '@tabler/icons-react';
import { ticketsApi, type TicketData } from '../../api/tickets';
import { airlinesApi, type AirlineItem } from '../../api/airlines';
import { partnersApi } from '../../api/partners';
import { accountsApi } from '../../api/accounts';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { useLanguageStore } from '../../store/useLanguageStore';
import { useAuthStore } from '../../store/useAuthStore';

interface TicketRefundEditorModalProps {
  opened: boolean;
  onClose: () => void;
  onSaved: () => void;
  existingRefund?: any | null;
}

export const TicketRefundEditorModal: React.FC<TicketRefundEditorModalProps> = ({
  opened,
  onClose,
  onSaved,
  existingRefund,
}) => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';
  const { user } = useAuthStore();

  // Search & Auto-fill from Existing Tickets
  const [searchQuery, setSearchQuery] = useState('');
  const [availableTickets, setAvailableTickets] = useState<TicketData[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedOriginalTicket, setSelectedOriginalTicket] = useState<TicketData | null>(null);

  // Reference lists
  const [airlines, setAirlines] = useState<AirlineItem[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [cashboxes, setCashboxes] = useState<any[]>([]);

  // Form State
  const [refundNumber, setRefundNumber] = useState('');
  const [issueDate, setIssueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [currency, setCurrency] = useState<'IQD' | 'USD'>('IQD');
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [pnr, setPnr] = useState('');
  const [ticketNumber, setTicketNumber] = useState('');
  const [passengerName, setPassengerName] = useState('');
  const [airlineId, setAirlineId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [route, setRoute] = useState('');
  const [travelDate, setTravelDate] = useState('');

  // Financial Breakdown Values
  const [buyRefundAmount, setBuyRefundAmount] = useState<number>(0);
  const [airlinePenalty, setAirlinePenalty] = useState<number>(0);
  const [sellRefundAmount, setSellRefundAmount] = useState<number>(0);
  const [agencyRetention, setAgencyRetention] = useState<number>(0);

  // Settlement & Account Info
  const [paymentType, setPaymentType] = useState<'CASH_HAND' | 'ON_ACCOUNT'>('CASH_HAND');
  const [cashboxId, setCashboxId] = useState('');
  const [paperReceiptNumber, setPaperReceiptNumber] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Computed Financials
  const netBuyReturn = useMemo(() => Math.max(0, buyRefundAmount - airlinePenalty), [buyRefundAmount, airlinePenalty]);
  const netRefundToCustomer = useMemo(() => Math.max(0, sellRefundAmount - agencyRetention), [sellRefundAmount, agencyRetention]);
  const realizedProfit = useMemo(() => {
    // Realized Profit = What we keep from the customer vs what we lose from the supplier
    // Profit = (SellRefundAmount - NetRefundToCustomer) - (BuyRefundAmount - NetBuyReturn)
    // Effectively: AgencyRetention - AirlinePenalty if balanced, or NetBuyReturn - NetRefundToCustomer
    const customerDeduction = sellRefundAmount - netRefundToCustomer;
    const supplierLoss = buyRefundAmount - netBuyReturn;
    return customerDeduction - supplierLoss;
  }, [sellRefundAmount, netRefundToCustomer, buyRefundAmount, netBuyReturn]);

  // Load initial data
  useEffect(() => {
    if (opened) {
      // Auto-generate refund number
      setRefundNumber(`REF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
      setEmployeeName(user?.name || 'علي جعفر');

      // Fetch base datasets
      ticketsApi.getAll().then((data) => setAvailableTickets(data || [])).catch(() => {});
      airlinesApi.getAll().then((data) => setAirlines(data || [])).catch(() => {});
      partnersApi.getCustomers().then((data) => setCustomers(data || [])).catch(() => {});
      partnersApi.getSuppliers().then((data) => setSuppliers(data || [])).catch(() => {});
      accountsApi.getFlat('ASSET', 'CASH').then((data) => {
        setCashboxes(data || []);
        if (data && data.length > 0 && !cashboxId) {
          setCashboxId(data[0].id || data[0].code);
        }
      }).catch(() => {});
    }
  }, [opened]);

  // Handle Select Ticket from Search
  const handleSelectTicket = (t: TicketData) => {
    setSelectedOriginalTicket(t);
    setPnr(t.pnr || '');
    setTicketNumber(t.invoiceNumber || t.passengers?.[0]?.ticketNumber || '');
    setPassengerName(t.passengers?.[0]?.name || t.customerName || '');
    setCurrency((t.currency as any) === 'USD' ? 'USD' : 'IQD');
    setExchangeRate(t.exchangeRate || 1);
    setRoute(t.route || '');
    setCustomerName(t.customerName || '');
    setSupplierName(t.supplierAccountName || '');
    setSupplierId(t.supplierAccount || '');
    setAirlineId(t.airline || '');

    // Pre-fill refund defaults from original ticket values
    const origSell = t.totalSell || t.netSell || 0;
    const origBuy = t.totalBuy || t.netBuy || 0;
    setSellRefundAmount(origSell);
    setBuyRefundAmount(origBuy);
    setAirlinePenalty(0);
    setAgencyRetention(0);

    setSearchQuery('');
  };

  // Filtered ticket search results
  const filteredSearchTickets = useMemo(() => {
    if (!searchQuery || searchQuery.trim().length < 2) return [];
    const q = searchQuery.toLowerCase().trim();
    return availableTickets.filter(
      (t) =>
        t.invoiceNumber?.toLowerCase().includes(q) ||
        t.pnr?.toLowerCase().includes(q) ||
        t.customerName?.toLowerCase().includes(q) ||
        t.passengers?.some((p) => p.name?.toLowerCase().includes(q) || p.ticketNumber?.toLowerCase().includes(q))
    ).slice(0, 5);
  }, [searchQuery, availableTickets]);

  const handleSubmitRefund = async () => {
    if (!ticketNumber && !pnr && !passengerName) {
      showErrorNotification(
        isAr ? 'بيانات ناقصة' : 'Missing Information',
        isAr ? 'يرجى إدخال رقم التذكرة أو PNR واسم المسافر.' : 'Please provide ticket number, PNR, and passenger name.'
      );
      return;
    }

    if (sellRefundAmount <= 0 && buyRefundAmount <= 0) {
      showErrorNotification(
        isAr ? 'خطأ في المبالغ' : 'Invalid Amounts',
        isAr ? 'يرجى تحديد مبالغ الاسترجاع المستحقة.' : 'Please enter valid refund amounts.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const refundPayload: any = {
        invoiceNumber: refundNumber,
        issueDate: new Date(issueDate).toISOString(),
        travelDate: travelDate ? new Date(travelDate).toISOString() : null,
        pnr,
        customerName: customerName || passengerName,
        employeeName: employeeName || user?.name || 'علي جعفر',
        entryEmployee: user?.name || 'علي جعفر',
        cashbox: paymentType === 'CASH_HAND' ? cashboxId : null,
        currency,
        exchangeRate,
        paymentType,
        supplierAccount: supplierId,
        supplierAccountName: supplierName,
        tripType: 'REFUND',
        airline: airlineId,
        route,
        totalSell: -Math.abs(sellRefundAmount),
        totalBuy: -Math.abs(buyRefundAmount),
        netSell: -Math.abs(netRefundToCustomer),
        netBuy: -Math.abs(netBuyReturn),
        profit: realizedProfit,
        notes: `[استرجاع تذكرة] غرامة الطيران: ${airlinePenalty} ${currency} | استقطاع الشركة: ${agencyRetention} ${currency} | ${notes || ''}`,
        reference: paperReceiptNumber || selectedOriginalTicket?.invoiceNumber || undefined,
        status: 'REFUNDED',
        passengers: [
          {
            name: passengerName || 'مسافر مسترجع',
            ticketNumber: ticketNumber || undefined,
            pnr: pnr || undefined,
            fareBuy: -Math.abs(buyRefundAmount),
            fareSell: -Math.abs(sellRefundAmount),
            status: 'مسترجع',
          },
        ],
      };

      await ticketsApi.create(refundPayload);

      showSuccessNotification(
        isAr ? 'تم استرجاع التذكرة بنجاح' : 'Ticket Refund Created',
        isAr
          ? `تم إنشاء قيد ومستند استرجاع التذكرة رقم ${refundNumber} وتحديث الأرصدة فورياً.`
          : `Refund voucher ${refundNumber} created and posted successfully.`
      );

      onSaved();
      onClose();
    } catch (err: any) {
      showErrorNotification(
        isAr ? 'فشل حفظ الاسترجاع' : 'Refund Failed',
        err?.message || (isAr ? 'حدث خطأ أثناء حفظ قيد الاسترجاع' : 'Error saving refund voucher')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 font-black text-base text-slate-900">
          <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#F45A0A] border border-orange-200 flex items-center justify-center">
            <IconArrowBackUp size={18} />
          </div>
          <span>{isAr ? 'مستند وعملية استرجاع تذكرة (Ticket Refund)' : 'Ticket Refund Voucher'}</span>
        </div>
      }
      size="90%"
      radius="2xl"
      padding="lg"
      styles={{
        header: { borderBottom: '1px solid #E2E8F0', paddingBottom: '14px' },
        body: { paddingTop: '16px' },
      }}
    >
      <div className="space-y-5 font-sans" dir={direction}>

        {/* ── 1. Search Bar for Existing Issued Tickets ── */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-50/60 to-amber-50/40 border border-orange-200/80 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-slate-900 flex items-center gap-1.5">
              <IconSparkles size={16} className="text-[#F45A0A]" />
              <span>{isAr ? 'البحث الذكي في التذاكر الصادرة (Auto-Fill from Existing Tickets)' : 'Fast Lookup from Issued Tickets'}</span>
            </label>
            {selectedOriginalTicket && (
              <Button
                size="compact-xs"
                variant="subtle"
                color="red"
                leftSection={<IconX size={12} />}
                onClick={() => setSelectedOriginalTicket(null)}
                className="text-[11px] font-bold"
              >
                {isAr ? 'إلغاء التحديد وتعبئة يدوية' : 'Clear & Manual Input'}
              </Button>
            )}
          </div>

          <div className="relative">
            <TextInput
              placeholder={isAr ? 'اكتب رقم التذكرة، كود الحجز PNR، اسم المسافر أو العميل...' : 'Type PNR, ticket #, passenger, or customer name...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftSection={<IconSearch size={16} className="text-[#F45A0A]" />}
              className="font-bold text-xs"
              styles={{ input: { backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #FED7AA' } }}
            />

            {filteredSearchTickets.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden divide-y divide-slate-100 max-h-64 overflow-y-auto">
                {filteredSearchTickets.map((t) => (
                  <button
                    key={t.id || t.invoiceNumber}
                    type="button"
                    onClick={() => handleSelectTicket(t)}
                    className="w-full p-3 text-right hover:bg-orange-50/80 transition-colors flex items-center justify-between text-xs cursor-pointer"
                  >
                    <div>
                      <div className="font-black text-slate-900 flex items-center gap-2">
                        <span>{t.invoiceNumber}</span>
                        {t.pnr && <span className="px-2 py-0.5 rounded bg-orange-100 text-[#F45A0A] font-mono text-[10px] font-bold">{t.pnr}</span>}
                      </div>
                      <div className="text-slate-500 mt-0.5">
                        {t.passengers?.[0]?.name || t.customerName} • {t.airline || 'طيران'} • {t.route || 'مسار الرحلة'}
                      </div>
                    </div>

                    <div className="text-left font-mono">
                      <div className="font-black text-slate-900">
                        {t.totalSell?.toLocaleString()} {t.currency || 'IQD'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        شراء: {t.totalBuy?.toLocaleString()} {t.currency || 'IQD'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedOriginalTicket && (
            <div className="p-3 rounded-xl bg-white border border-orange-200 text-xs flex items-center justify-between flex-wrap gap-2 text-slate-700 font-medium">
              <div className="flex items-center gap-2">
                <Badge color="orange" size="sm" variant="filled" className="font-mono font-bold">
                  {selectedOriginalTicket.invoiceNumber}
                </Badge>
                <span>المسافر: <b className="text-slate-900 font-bold">{selectedOriginalTicket.passengers?.[0]?.name || selectedOriginalTicket.customerName}</b></span>
                <span>• المسار: <b className="text-slate-900 font-bold">{selectedOriginalTicket.route || '—'}</b></span>
              </div>
              <div className="text-[#F45A0A] font-bold text-[11px]">
                ✓ تم جلب بيانات التذكرة وقيم الشراء والمبيع تلقائياً
              </div>
            </div>
          )}
        </div>

        {/* ── 2. Two Columns Layout: Ticket Details vs Financial Refund Calculations ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* Column A: Original Ticket & Passenger Info (5 cols) */}
          <div className="lg:col-span-5 p-5 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-2xs">
            <h3 className="font-black text-xs text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
              <IconPlane size={16} className="text-[#F45A0A]" />
              <span>{isAr ? '1. معلومات التذكرة والمسافر' : '1. Ticket & Passenger Details'}</span>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <TextInput
                label={isAr ? 'رقم مستند الاسترجاع' : 'Refund Voucher #'}
                value={refundNumber}
                onChange={(e) => setRefundNumber(e.target.value)}
                className="font-mono font-bold text-xs"
                readOnly
              />
              <TextInput
                label={isAr ? 'تاريخ الاسترجاع' : 'Refund Date'}
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="font-bold text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <TextInput
                label={isAr ? 'كود الحجز (PNR) *' : 'Booking PNR *'}
                placeholder="e.g. PRMCK"
                value={pnr}
                onChange={(e) => setPnr(e.target.value)}
                className="font-mono font-bold text-xs uppercase"
              />
              <TextInput
                label={isAr ? 'رقم التذكرة (Ticket #) *' : 'Ticket Number *'}
                placeholder="e.g. 076-2300332188"
                value={ticketNumber}
                onChange={(e) => setTicketNumber(e.target.value)}
                className="font-mono font-bold text-xs"
              />
            </div>

            <TextInput
              label={isAr ? 'اسم المسافر *' : 'Passenger Name *'}
              placeholder={isAr ? 'مثال: أحمد عبد الله' : 'e.g. John Doe'}
              value={passengerName}
              onChange={(e) => setPassengerName(e.target.value)}
              className="font-bold text-xs"
            />

            <div className="grid grid-cols-2 gap-3">
              <TextInput
                label={isAr ? 'اسم العميل / الوكيل' : 'Customer / Agency'}
                placeholder={isAr ? 'مثال: شركة السعدي' : 'Customer name'}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="font-bold text-xs"
              />
              <TextInput
                label={isAr ? 'المورد / جهة الإصدار' : 'Supplier Account'}
                placeholder={isAr ? 'مثال: سستم فلاي' : 'Supplier name'}
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="font-bold text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <TextInput
                label={isAr ? 'خط السير / الوجهة' : 'Route'}
                placeholder="BGW-MHD-BGW"
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                className="font-mono font-bold text-xs uppercase"
              />
              <TextInput
                label={isAr ? 'تاريخ السفر الأصلي' : 'Travel Date'}
                type="date"
                value={travelDate}
                onChange={(e) => setTravelDate(e.target.value)}
                className="font-bold text-xs"
              />
            </div>
          </div>

          {/* Column B: Financial Calculations & Penalties (7 cols) */}
          <div className="lg:col-span-7 p-5 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-black text-xs text-slate-900 flex items-center gap-2">
                <IconCalculator size={16} className="text-[#F45A0A]" />
                <span>{isAr ? '2. الاحتساب المالي والغرامات والعمولات' : '2. Financial Penalties & Refund Breakdown'}</span>
              </h3>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-500">{isAr ? 'العملة:' : 'Currency:'}</span>
                <Radio.Group value={currency} onChange={(val) => setCurrency(val as any)}>
                  <Group gap="xs">
                    <Radio value="IQD" label="د.ع (IQD)" className="font-bold text-xs" />
                    <Radio value="USD" label="$ (USD)" className="font-bold text-xs" />
                  </Group>
                </Radio.Group>
              </div>
            </div>

            {/* Calculations Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Box 1: Supplier Buy Side */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <IconBuildingStore size={15} className="text-slate-600" />
                  <span>{isAr ? 'طرف الشراء (المورد / شركة الطيران)' : 'Supplier / Airline Recovery'}</span>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    {isAr ? 'مبلغ الشراء المسترد من المورد' : 'Buy Refund Amount'}
                  </label>
                  <TextInput
                    type="number"
                    value={buyRefundAmount}
                    onChange={(e) => setBuyRefundAmount(Number(e.target.value) || 0)}
                    className="font-mono font-black text-sm text-slate-900"
                    rightSection={<span className="text-xs font-bold text-slate-400 font-mono">{currency}</span>}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-rose-700 block mb-1">
                    {isAr ? 'غرامة إلغاء شركة الطيران / المورد (-)' : 'Airline Cancellation Penalty (-)'}
                  </label>
                  <TextInput
                    type="number"
                    value={airlinePenalty}
                    onChange={(e) => setAirlinePenalty(Number(e.target.value) || 0)}
                    className="font-mono font-black text-sm text-rose-600"
                    rightSection={<span className="text-xs font-bold text-rose-400 font-mono">{currency}</span>}
                  />
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-600">{isAr ? 'صافي المسترجع من المورد:' : 'Net Recovered:'}</span>
                  <span className="font-mono font-black text-sm text-slate-900 tabular-nums">
                    {netBuyReturn.toLocaleString()} {currency}
                  </span>
                </div>
              </div>

              {/* Box 2: Customer Sell Side */}
              <div className="p-4 rounded-xl bg-orange-50/40 border border-orange-200 space-y-3">
                <div className="text-xs font-black text-orange-950 flex items-center gap-1.5">
                  <IconUser size={15} className="text-[#F45A0A]" />
                  <span>{isAr ? 'طرف البيع (العميل / المسافر)' : 'Customer / Passenger Return'}</span>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    {isAr ? 'مبلغ بيع التذكرة الأصلي المسترد' : 'Original Sell Refund Amount'}
                  </label>
                  <TextInput
                    type="number"
                    value={sellRefundAmount}
                    onChange={(e) => setSellRefundAmount(Number(e.target.value) || 0)}
                    className="font-mono font-black text-sm text-slate-900"
                    rightSection={<span className="text-xs font-bold text-slate-400 font-mono">{currency}</span>}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-amber-800 block mb-1">
                    {isAr ? 'استقطاع / عمولة الشركة من الإلغاء (-)' : 'Agency Cancellation Fee (-)'}
                  </label>
                  <TextInput
                    type="number"
                    value={agencyRetention}
                    onChange={(e) => setAgencyRetention(Number(e.target.value) || 0)}
                    className="font-mono font-black text-sm text-amber-700"
                    rightSection={<span className="text-xs font-bold text-amber-400 font-mono">{currency}</span>}
                  />
                </div>

                <div className="pt-2 border-t border-orange-200 flex items-center justify-between text-xs">
                  <span className="font-bold text-orange-950">{isAr ? 'الصافي المسلم للعميل:' : 'Net to Customer:'}</span>
                  <span className="font-mono font-black text-sm text-[#F45A0A] tabular-nums">
                    {netRefundToCustomer.toLocaleString()} {currency}
                  </span>
                </div>
              </div>

            </div>

            {/* Bottom KPI Bar: Realized Profit */}
            <div className="p-3.5 rounded-xl bg-slate-900 text-white flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-slate-300">{isAr ? 'صافي الربح / العمولة المحققة للشركة من الاسترجاع:' : 'Realized Agency Refund Profit:'}</span>
              </div>
              <div className="font-mono font-black text-base text-emerald-400 tabular-nums">
                {realizedProfit >= 0 ? `+${realizedProfit.toLocaleString()}` : realizedProfit.toLocaleString()} {currency}
              </div>
            </div>

            {/* ── Settlement Method ── */}
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <h4 className="font-black text-xs text-slate-900">{isAr ? 'طريقة تسوية المبلغ وقيد الاسترجاع:' : 'Refund Settlement & Accounting Mode:'}</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Radio.Group value={paymentType} onChange={(v) => setPaymentType(v as any)}>
                  <Group gap="md">
                    <Radio value="CASH_HAND" label={isAr ? 'نقدي (صرف من الصندوق)' : 'Cash Refund (Cashbox)'} className="font-bold text-xs" />
                    <Radio value="ON_ACCOUNT" label={isAr ? 'قيد آجل في حساب العميل' : 'Credit on Customer Account'} className="font-bold text-xs" />
                  </Group>
                </Radio.Group>

                {paymentType === 'CASH_HAND' && (
                  <Select
                    placeholder={isAr ? 'اختر الصندوق المنفذ' : 'Select Cashbox'}
                    value={cashboxId}
                    onChange={(val) => val && setCashboxId(val)}
                    data={cashboxes.map((c) => ({
                      value: c.id || c.accountId,
                      label: c.nameAr || c.name || 'الصندوق الرئيسي',
                    }))}
                    className="font-bold text-xs"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <TextInput
                  label={isAr ? 'رقم الوصل الورقي / المرجع' : 'Paper Receipt #'}
                  placeholder="e.g. 10245"
                  value={paperReceiptNumber}
                  onChange={(e) => setPaperReceiptNumber(e.target.value)}
                  className="font-mono font-bold text-xs"
                />
                <TextInput
                  label={isAr ? 'موظف الإدخال والاعتماد' : 'Issued / Created By'}
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  className="font-bold text-xs"
                />
              </div>

              <Textarea
                label={isAr ? 'ملاحظات وتفاصيل الاسترجاع' : 'Notes / Remarks'}
                placeholder={isAr ? 'أسباب الاسترجاع، تفاصيل التذكرة...' : 'Refund reason and remarks...'}
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="font-medium text-xs"
              />
            </div>

          </div>

        </div>

        {/* ── 3. Footer Action Buttons ── */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-between flex-wrap gap-3">
          <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
            <IconInfoCircle size={15} className="text-slate-400" />
            <span>{isAr ? 'سيتم إنشاء قيد استرجاع محاسبي آلي لتعديل أرصدة المورد والعميل والصندوق فور الحفظ.' : 'Auto-generates balanced ledger entries for supplier, customer, and cashbox.'}</span>
          </div>

          <Group justify="flex-end">
            <Button variant="default" onClick={onClose} disabled={submitting} className="rounded-xl font-bold">
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              color="orange"
              loading={submitting}
              leftSection={<IconCheck size={16} />}
              onClick={handleSubmitRefund}
              className="bg-[#F45A0A] hover:bg-[#d94806] rounded-xl font-black px-6 shadow-xs"
            >
              {isAr ? 'حفظ وترحيل سند الاسترجاع' : 'Save & Post Refund Voucher'}
            </Button>
          </Group>
        </div>

      </div>
    </Modal>
  );
};

export default TicketRefundEditorModal;
