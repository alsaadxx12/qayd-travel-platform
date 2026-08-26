import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Tooltip,
  Radio,
  Checkbox,
  Select,
  Modal,
  SegmentedControl,
  Switch,
} from '@mantine/core';
import {
  RotateCcw,
  Search,
  Check,
  X,
  Plus,
  Edit3,
  History,
  Trash2,
  Users,
  User,
  Plane,
  Sparkles,
  ShieldCheck,
  Coins,
  Receipt,
  ArrowRight,
  ArrowLeft,
  TrendingUp,
  CreditCard,
  Building2,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { ticketsApi, type TicketData } from '../../api/tickets';
import { airlinesApi, type AirlineItem } from '../../api/airlines';
import { partnersApi } from '../../api/partners';
import { accountsApi } from '../../api/accounts';
import { SearchableCombobox, ComboboxOption } from '../ui/SearchableCombobox';
import { SegmentedDatePicker } from '../ui/SegmentedDatePicker';
import { InvoiceAuditLogModal } from '../tickets/InvoiceAuditLogModal';
import { TicketAttachmentsSection, type AttachmentItem } from '../tickets/TicketAttachmentsSection';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { useLanguageStore } from '../../store/useLanguageStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useAdoptedExchangeRate } from '../../hooks/useAdoptedExchangeRate';
import { getNextSequenceNumber } from '../../utils/sequenceUtils';

export interface RefundPassengerLine {
  id: string;
  selected: boolean;
  name: string;
  type?: 'ADULT' | 'CHILD' | 'INFANT' | string;
  ticketNumber: string;
  pnr?: string;
  buyRefund: number;
  airlinePenalty: number;
  sellRefund: number;
  agencyRetention: number;
}

interface TicketRefundEditorWorkspaceProps {
  opened: boolean;
  onClose: () => void;
  initialData?: TicketData | null;
  onSuccess?: () => void;
  initialManualMode?: boolean;
}

// English / Western numeral formatting helper
const formatNumberEnglish = (num: number): string => {
  if (isNaN(num) || num === null || num === undefined) return '0';
  return num.toLocaleString('en-US');
};

// Clean number parse helper (converts any Eastern Arabic digits to English and strips commas)
const parseCleanNumber = (val: string | number): number => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  let clean = String(val).replace(/[٠-٩]/g, (d) => arabicDigits.indexOf(d).toString());
  clean = clean.replace(/,/g, '').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

// Normalize Passenger Type (Adult / Child / Infant) from any raw string
const normalizePassengerType = (raw?: string): 'ADULT' | 'CHILD' | 'INFANT' => {
  if (!raw) return 'ADULT';
  const str = String(raw).trim().toUpperCase();
  if (str === 'CHILD' || str === 'CHD' || str.includes('طفل') || str.includes('أطفال')) return 'CHILD';
  if (str === 'INFANT' || str === 'INF' || str.includes('رضيع') || str.includes('رضع')) return 'INFANT';
  return 'ADULT';
};

export const TicketRefundEditorWorkspace: React.FC<TicketRefundEditorWorkspaceProps> = ({
  opened,
  onClose,
  initialData,
  onSuccess,
  initialManualMode = false,
}) => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';
  const { user } = useAuthStore();
  const adoptedEx = useAdoptedExchangeRate();

  // Audit Log Modal State
  const [auditLogOpen, setAuditLogOpen] = useState(false);

  // Refund Mode: From Issued Ticket vs. Manual / New Direct Refund
  const [refundMode, setRefundMode] = useState<'FROM_TICKET' | 'MANUAL'>(initialManualMode ? 'MANUAL' : 'FROM_TICKET');

  // Search & Auto-fill from Existing Tickets
  const [searchQuery, setSearchQuery] = useState('');
  const [availableTickets, setAvailableTickets] = useState<TicketData[]>([]);
  const [selectedOriginalTicket, setSelectedOriginalTicket] = useState<TicketData | null>(null);

  // Reference Datasets
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [cashboxes, setCashboxes] = useState<any[]>([]);
  const [airlinesList, setAirlinesList] = useState<AirlineItem[]>([]);

  // Workspace Form State
  const [refundNumber, setRefundNumber] = useState<string>('');
  const [issueDate, setIssueDate] = useState<Date>(new Date());
  const [travelDate, setTravelDate] = useState<Date | null>(null);
  const [currency, setCurrency] = useState<string>('IQD');
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [pnr, setPnr] = useState<string>('');
  const [ticketNumber, setTicketNumber] = useState<string>('');
  const [airline, setAirline] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [supplierAccount, setSupplierAccount] = useState<string>('');
  const [supplierAccountName, setSupplierAccountName] = useState<string>('');
  const [route, setRoute] = useState<string>('');

  // Multi-Passenger Refund List
  const [passengers, setPassengers] = useState<RefundPassengerLine[]>([
    {
      id: `p-${Date.now()}`,
      selected: true,
      name: '',
      type: 'ADULT',
      ticketNumber: '',
      pnr: '',
      buyRefund: 0,
      airlinePenalty: 0,
      sellRefund: 0,
      agencyRetention: 0,
    },
  ]);

  // Bulk Apply Penalties to All Selected Passengers
  const [bulkAirlinePenalty, setBulkAirlinePenalty] = useState<string>('');
  const [bulkAgencyRetention, setBulkAgencyRetention] = useState<string>('');
  const [childWarningModalOpen, setChildWarningModalOpen] = useState<boolean>(false);
  const [isSupplierRefunded, setIsSupplierRefunded] = useState<boolean>(true);

  // Settlement & Attachments Info
  const [paymentType, setPaymentType] = useState<string>('CASH_HAND');
  const [cashboxId, setCashboxId] = useState<string>('');
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [bankAccountId, setBankAccountId] = useState<string>('');
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [paperReceiptNumber, setPaperReceiptNumber] = useState<string>('');
  const [employeeName, setEmployeeName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Helper to resolve clean human-readable customer name from UUID/ID
  const resolveCustomerDisplay = useCallback((raw?: string) => {
    if (!raw) return '';
    const found = customers.find((c) => c.id === raw || c.nameAr === raw || c.name === raw);
    return found ? (found.nameAr || found.name || raw) : raw;
  }, [customers]);

  // ── Financial Calculation Logic (Clear & Simple) ──
  const activePassengers = useMemo(() => passengers.filter((p) => p.selected), [passengers]);

  // 1. Total Original Sell & Buy
  const totalSellRefund = useMemo(
    () => activePassengers.reduce((sum, p) => sum + (Number(p.sellRefund) || 0), 0),
    [activePassengers]
  );
  const totalBuyRefund = useMemo(
    () => activePassengers.reduce((sum, p) => sum + (Number(p.buyRefund) || 0), 0),
    [activePassengers]
  );

  // 2. Penalties & Retention
  const totalAirlinePenalty = useMemo(
    () => activePassengers.reduce((sum, p) => sum + (Number(p.airlinePenalty) || 0), 0),
    [activePassengers]
  );
  const totalAgencyRetention = useMemo(
    () => activePassengers.reduce((sum, p) => sum + (Number(p.agencyRetention) || 0), 0),
    [activePassengers]
  );

  // 3. Net Refund Paid Back to Customer = Sell - Airline Penalty - Agency Retention
  const totalNetRefundToCustomer = useMemo(
    () => Math.max(0, totalSellRefund - totalAirlinePenalty - totalAgencyRetention),
    [totalSellRefund, totalAirlinePenalty, totalAgencyRetention]
  );

  // 4. Net Refund Recovered from Supplier = Buy - Airline Penalty (or 0 if supplier did not refund)
  const totalNetBuyReturn = useMemo(
    () => (isSupplierRefunded ? Math.max(0, totalBuyRefund - totalAirlinePenalty) : 0),
    [isSupplierRefunded, totalBuyRefund, totalAirlinePenalty]
  );

  // 5. Agency Profit from Refund = Agency Retention Fee
  const totalRealizedProfit = useMemo(() => {
    return totalAgencyRetention;
  }, [totalAgencyRetention]);

  // Load Base Datasets
  useEffect(() => {
    if (opened) {
      if (initialData) {
        const isExistingRefund = initialData.tripType === 'REFUND' || String(initialData.invoiceNumber || '').startsWith('REF-');
        setRefundNumber(isExistingRefund ? (initialData.invoiceNumber || '') : getNextSequenceNumber('refunds'));
        if (!isExistingRefund) {
          setSelectedOriginalTicket(initialData);
        }
        setIssueDate(initialData.issueDate ? new Date(initialData.issueDate) : new Date());
        setPnr(initialData.pnr || '');
        setCustomerName(resolveCustomerDisplay(initialData.customerName) || initialData.customerName || '');
        const initialSupplierName = initialData.supplierAccountName || initialData.supplier?.nameAr || (initialData as any).supplierNameDisplay || '';
        const initialSupplierValue = initialData.supplierAccountId || initialData.supplier?.accountId || initialData.supplierAccount || initialData.supplierId || initialSupplierName;
        setSupplierAccount(initialSupplierValue);
        setSupplierAccountName(initialSupplierName);
        setRoute(initialData.route || '');
        setCurrency(initialData.currency || 'IQD');
        setExchangeRate(initialData.exchangeRate || 1);
        setEmployeeName(initialData.employeeName || user?.name || '');
        setNotes(initialData.notes || '');
        setAirline(initialData.airline || '');

        const rawPaxList = (initialData as any).detailedPassengers || initialData.passengers || [];
        // Only load passengers who have NOT been refunded yet if creating a new refund
        const candidatePassengers = isExistingRefund
          ? rawPaxList
          : rawPaxList.filter((p: any) => !p.isRefunded && p.status !== 'REFUNDED' && p.status !== 'مسترجع');

        const activePaxToLoad = candidatePassengers.length > 0 ? candidatePassengers : rawPaxList;

        if (activePaxToLoad && activePaxToLoad.length > 0) {
          const paxCount = activePaxToLoad.length;
          let fallbackAirlinePenalty = 0;
          let fallbackAgencyRetention = 0;
          if (initialData.notes) {
            const penaltyMatch = initialData.notes.match(/غرامة طيران:\s*([0-9.]+)/);
            const retentionMatch = initialData.notes.match(/استقطاع شركة:\s*([0-9.]+)/);
            if (penaltyMatch) fallbackAirlinePenalty = (parseFloat(penaltyMatch[1]) || 0) / paxCount;
            if (retentionMatch) fallbackAgencyRetention = (parseFloat(retentionMatch[1]) || 0) / paxCount;
          }

          setPassengers(
            activePaxToLoad.map((p: any, idx: number) => {
              const airlinePen = (p.tax1 !== undefined && p.tax1 !== null && p.tax1 > 0) ? p.tax1 : fallbackAirlinePenalty;
              const agencyRet = (p.charge !== undefined && p.charge !== null && p.charge > 0) ? p.charge : fallbackAgencyRetention;
              return {
                id: p.id || `p-${idx}-${Date.now()}`,
                selected: true,
                name: p.name || '',
                type: normalizePassengerType(p.ticketType || (p as any).type || (p as any).passengerType),
                ticketNumber: p.ticketNumber || (p as any).documentNumber || (p as any).eTicketNumber || '',
                pnr: p.pnr || initialData.pnr || '',
                buyRefund: Math.abs(p.fareBuy || 0),
                airlinePenalty: airlinePen,
                sellRefund: Math.abs(p.fareSell || 0),
                agencyRetention: agencyRet,
              };
            })
          );
        } else {
          setPassengers([
            {
              id: `p-${Date.now()}`,
              selected: true,
              name: initialData.customerName || '',
              type: 'ADULT',
              ticketNumber: initialData.invoiceNumber || '',
              pnr: initialData.pnr || '',
              buyRefund: Math.abs(initialData.totalBuy || 0),
              airlinePenalty: 0,
              sellRefund: Math.abs(initialData.totalSell || 0),
              agencyRetention: 0,
            },
          ]);
        }
      } else {
        setRefundNumber(getNextSequenceNumber('refunds'));
        setEmployeeName(user?.name || '');
        setPassengers([
          {
            id: `p-${Date.now()}`,
            selected: true,
            name: '',
            type: 'ADULT',
            ticketNumber: '',
            pnr: '',
            buyRefund: 0,
            airlinePenalty: 0,
            sellRefund: 0,
            agencyRetention: 0,
          },
        ]);
        setSelectedOriginalTicket(null);
        setAirline('');
      }

      // Fetch fresh options
      ticketsApi.getAll().then((data) => setAvailableTickets(data || [])).catch(() => {});
      partnersApi.getCustomers().then((data) => setCustomers(data || [])).catch(() => {});
      partnersApi.getSuppliers().then((data) => setSuppliers(data || [])).catch(() => {});
      airlinesApi.getAll().then((data) => setAirlinesList(data || [])).catch(() => {});
      
      accountsApi.getFlat('ASSET', 'CASH').then((data) => {
        const boxList = data || [];
        setCashboxes(boxList);
        
        // Auto-select logged in employee's assigned cashbox
        const userCashboxId =
          (user as any)?.defaultCashboxId ||
          (user as any)?.cashboxId ||
          (user as any)?.cashboxAccountId ||
          localStorage.getItem('userDefaultCashbox');
        
        const matched =
          boxList.find((b: any) => b.id === userCashboxId || b.code === userCashboxId) ||
          boxList.find((b: any) => user?.name && (b.nameAr?.includes(user.name) || b.name?.includes(user.name))) ||
          boxList.find((b: any) => b.nameAr?.includes('صندوق') || b.name?.toLowerCase().includes('cash')) ||
          boxList[0];

        if (matched) {
          setCashboxId(matched.id || matched.code);
        }
      }).catch(() => {});

      accountsApi.getFlat('ASSET', 'BANK').then((data) => {
        const bankList = data || [];
        setBankAccounts(bankList);
        if (bankList.length > 0) {
          setBankAccountId(bankList[0].id || bankList[0].code);
        }
      }).catch(() => {});
    }
  }, [opened, initialData, user, resolveCustomerDisplay]);

  useEffect(() => {
    if (!supplierAccount || suppliers.length === 0) return;

    const matchedSupplier = suppliers.find((supplier) =>
      [
        supplier.id,
        supplier.accountId,
        supplier.account?.id,
        supplier.code,
        supplier.nameAr,
        supplier.nameEn,
        supplier.name,
      ].filter(Boolean).includes(supplierAccount)
    );

    if (!matchedSupplier) return;

    const normalizedAccount = matchedSupplier.accountId || matchedSupplier.account?.id || matchedSupplier.id;
    const normalizedName = matchedSupplier.nameAr || matchedSupplier.nameEn || matchedSupplier.name || matchedSupplier.code;

    if (normalizedAccount && normalizedAccount !== supplierAccount) {
      setSupplierAccount(normalizedAccount);
    }
    if (normalizedName && normalizedName !== supplierAccountName) {
      setSupplierAccountName(normalizedName);
    }
  }, [supplierAccount, supplierAccountName, suppliers]);

  // Handle Select from Fast Lookup
  const handleSelectTicket = (t: TicketData) => {
    setSelectedOriginalTicket(t);
    setPnr(t.pnr || '');
    setTicketNumber(t.invoiceNumber || t.passengers?.[0]?.ticketNumber || '');
    setAirline(t.airline || '');
    setCurrency((t.currency as any) === 'USD' ? 'USD' : 'IQD');
    setExchangeRate(t.exchangeRate || 1);
    setRoute(t.route || '');
    
    // Resolve clean customer name
    const resolvedCust = resolveCustomerDisplay(t.customerName || (t as any).customerId);
    setCustomerName(resolvedCust);
    
    const selectedSupplierName = t.supplierAccountName || t.supplier?.nameAr || (t as any).supplierNameDisplay || '';
    const selectedSupplierValue = t.supplierAccountId || t.supplier?.accountId || t.supplierAccount || t.supplierId || selectedSupplierName;
    setSupplierAccount(selectedSupplierValue);
    setSupplierAccountName(selectedSupplierName);

    // Populate only non-refunded passengers from the original ticket
    const rawList = (t as any).detailedPassengers || t.passengers || [];
    const unrefundedList = rawList.filter((p: any) => !p.isRefunded && p.status !== 'REFUNDED' && p.status !== 'مسترجع');
    const paxToPopulate = unrefundedList.length > 0 ? unrefundedList : rawList;

    if (paxToPopulate && paxToPopulate.length > 0) {
      setPassengers(
        paxToPopulate.map((p: any, idx: number) => ({
          id: p.id || `p-${idx}-${Date.now()}`,
          selected: true,
          name: p.name || '',
          type: normalizePassengerType(p.ticketType || (p as any).type || (p as any).passengerType),
          ticketNumber: p.ticketNumber || (p as any).documentNumber || (p as any).eTicketNumber || t.invoiceNumber || '',
          pnr: p.pnr || t.pnr || '',
          buyRefund: Math.abs(p.fareBuy || (t.totalBuy || 0) / (t.passengers?.length || 1) || 0),
          airlinePenalty: 0,
          sellRefund: Math.abs(p.fareSell || (t.totalSell || 0) / (t.passengers?.length || 1) || 0),
          agencyRetention: 0,
        }))
      );
    } else {
      const origSell = Math.abs(t.totalSell || t.netSell || 0);
      const origBuy = Math.abs(t.totalBuy || t.netBuy || 0);
      setPassengers([
        {
          id: `p-${Date.now()}`,
          selected: true,
          name: resolvedCust || 'مسافر',
          type: 'ADULT',
          ticketNumber: t.invoiceNumber || '',
          pnr: t.pnr || '',
          buyRefund: origBuy,
          airlinePenalty: 0,
          sellRefund: origSell,
          agencyRetention: 0,
        },
      ]);
    }

    setSearchQuery('');
  };

  // Filtered search list
  const filteredSearchTickets = useMemo(() => {
    if (!searchQuery || searchQuery.trim().length < 2) return [];
    const q = searchQuery.toLowerCase().trim();
    return availableTickets.filter(
      (t) =>
        t.invoiceNumber?.toLowerCase().includes(q) ||
        t.pnr?.toLowerCase().includes(q) ||
        t.customerName?.toLowerCase().includes(q) ||
        t.passengers?.some((p) => p.name?.toLowerCase().includes(q) || p.ticketNumber?.toLowerCase().includes(q))
    ).slice(0, 6);
  }, [searchQuery, availableTickets]);

  // Identify any selected child / infant passengers
  const selectedChildren = useMemo(
    () => passengers.filter((p) => p.selected && (p.type === 'CHILD' || p.type === 'INFANT')),
    [passengers]
  );

  // Bulk Apply Penalty & Retention with Child Protection Warning
  const handleApplyBulkPenalty = () => {
    const penaltyVal = parseCleanNumber(bulkAirlinePenalty);
    const retentionVal = parseCleanNumber(bulkAgencyRetention);

    if (penaltyVal === 0 && retentionVal === 0) {
      showErrorNotification(
        isAr ? 'تنبيه' : 'Alert',
        isAr ? 'يرجى إدخال مبلغ غرامة الطيران أو استقطاع الشركة لتطبيقه.' : 'Please enter airline penalty or agency retention.'
      );
      return;
    }

    if (selectedChildren.length > 0) {
      setChildWarningModalOpen(true);
    } else {
      executeBulkApply(true);
    }
  };

  const executeBulkApply = (includeChildren: boolean) => {
    const penaltyVal = parseCleanNumber(bulkAirlinePenalty);
    const retentionVal = parseCleanNumber(bulkAgencyRetention);

    setPassengers((prev) =>
      prev.map((p) => {
        if (!p.selected) return p;
        const isChildOrInfant = p.type === 'CHILD' || p.type === 'INFANT';
        if (!includeChildren && isChildOrInfant) return p;

        return {
          ...p,
          airlinePenalty: penaltyVal >= 0 ? penaltyVal : p.airlinePenalty,
          agencyRetention: retentionVal >= 0 ? retentionVal : p.agencyRetention,
        };
      })
    );

    setChildWarningModalOpen(false);
    showSuccessNotification(
      isAr ? 'تم تطبيق المبالغ' : 'Applied',
      includeChildren
        ? (isAr ? 'تم تطبيق المبالغ المحددة على جميع المسافرين المختارين بنجاح.' : 'Applied penalties to all selected passengers.')
        : (isAr ? 'تم تطبيق المبالغ على المسافرين البالغين فقط واستثناء الأطفال.' : 'Applied penalties to adults only.')
    );
  };

  // Update specific passenger field
  const updatePassenger = (id: string, field: keyof RefundPassengerLine, val: any) => {
    setPassengers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: val } : p))
    );
  };

  // Airline options for Combobox
  const airlineOptions: ComboboxOption[] = useMemo(() => {
    return airlinesList.map((a) => {
      const label = a.nameAr || a.nameEn || a.id;
      return {
        value: label,
        label: label,
        subtitle: a.code || undefined,
      };
    });
  }, [airlinesList]);

  // Customer options for Combobox
  const customerOptions: ComboboxOption[] = useMemo(() => {
    return customers.map((c) => {
      const label = c.nameAr || c.name || c.id || (isAr ? 'عميل' : 'Customer');
      return {
        value: label,
        label: label,
        subtitle: c.code || undefined,
      };
    });
  }, [customers, isAr]);

  // Supplier options for Combobox
  const supplierOptions: ComboboxOption[] = useMemo(() => {
    return suppliers.map((s) => {
      const label = s.nameAr || s.name || s.id || (isAr ? 'مورد' : 'Supplier');
      return {
        value: s.accountId || s.account?.id || s.id,
        label: label,
        subtitle: s.code || undefined,
      };
    });
  }, [suppliers, isAr]);

  // Add a new manual passenger line
  const handleAddPassenger = () => {
    setPassengers((prev) => [
      ...prev,
      {
        id: `p-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        selected: true,
        name: '',
        type: 'ADULT',
        ticketNumber: '',
        pnr: pnr || '',
        buyRefund: 0,
        airlinePenalty: 0,
        sellRefund: 0,
        agencyRetention: 0,
      },
    ]);
  };

  // Remove Passenger Line
  const handleRemovePassenger = (id: string) => {
    if (passengers.length <= 1) {
      showErrorNotification(isAr ? 'تنبيه' : 'Alert', isAr ? 'يجب أن يحتوي السند على مسافر واحد على الأقل.' : 'At least one passenger required.');
      return;
    }
    setPassengers((prev) => prev.filter((p) => p.id !== id));
  };

  // Save & Post Refund Document
  const handleSaveRefund = async () => {
    if (activePassengers.length === 0) {
      showErrorNotification(isAr ? 'تنبيه' : 'Alert', isAr ? 'يرجى تحديد مسافر واحد على الأقل للاسترجاع.' : 'Select at least one passenger.');
      return;
    }

    if (!refundNumber.trim() || Number.isNaN(issueDate.getTime())) {
      showErrorNotification(isAr ? 'بيانات السند غير مكتملة' : 'Incomplete voucher', isAr ? 'تحقق من رقم سند الاسترجاع وتاريخه.' : 'Check the refund number and date.');
      return;
    }
    if (activePassengers.some((passenger) => !passenger.name.trim())) {
      showErrorNotification(isAr ? 'اسم المسافر مطلوب' : 'Passenger name required', isAr ? 'أدخل اسم كل مسافر محدد للاسترجاع.' : 'Enter a name for every selected passenger.');
      return;
    }
    if (totalSellRefund <= 0 || totalNetRefundToCustomer <= 0) {
      showErrorNotification(isAr ? 'مبلغ الاسترجاع غير صحيح' : 'Invalid refund amount', isAr ? 'يجب أن يكون المبلغ المسترجع للعميل أكبر من صفر.' : 'The customer refund must be greater than zero.');
      return;
    }
    if (totalAirlinePenalty + totalAgencyRetention > totalSellRefund) {
      showErrorNotification(isAr ? 'الاستقطاعات تتجاوز المبلغ' : 'Deductions exceed refund', isAr ? 'مجموع غرامة الطيران ورسوم الشركة لا يجوز أن يتجاوز مسترجع البيع.' : 'Airline penalty and agency retention cannot exceed the sales refund.');
      return;
    }
    if (isSupplierRefunded && totalAirlinePenalty > totalBuyRefund) {
      showErrorNotification(isAr ? 'غرامة المورد غير صحيحة' : 'Invalid supplier penalty', isAr ? 'غرامة الطيران لا يجوز أن تتجاوز مسترجع الشراء من المورد.' : 'The airline penalty cannot exceed the supplier refund.');
      return;
    }
    if (!employeeName.trim()) {
      showErrorNotification(isAr ? 'الموظف مطلوب' : 'Employee required', isAr ? 'حدد موظف الإدخال والاعتماد.' : 'Select the issuing employee.');
      return;
    }
    if (currency === 'USD' && (!Number.isFinite(exchangeRate) || exchangeRate <= 0)) {
      showErrorNotification(isAr ? 'سعر الصرف غير صحيح' : 'Invalid exchange rate', isAr ? 'يجب أن يكون سعر الصرف أكبر من صفر.' : 'Exchange rate must be greater than zero.');
      return;
    }

    const settlementAccountId = paymentType === 'CASH_HAND' ? cashboxId : paymentType === 'MASTER_CARD' ? bankAccountId : '';
    if (paymentType !== 'ON_ACCOUNT' && !settlementAccountId) {
      showErrorNotification(isAr ? 'حساب الصرف مطلوب' : 'Settlement account required', isAr ? 'اختر الصندوق أو الحساب البنكي الذي سيُصرف منه المبلغ.' : 'Select the cashbox or bank account used for the refund.');
      return;
    }
    if (paymentType === 'ON_ACCOUNT' && !customerName.trim()) {
      showErrorNotification(isAr ? 'حساب العميل مطلوب' : 'Customer account required', isAr ? 'اختر العميل عند تسجيل الاسترجاع على الحساب.' : 'Select the customer for an on-account refund.');
      return;
    }
    if (isSupplierRefunded && totalNetBuyReturn > 0 && !supplierAccount.trim() && !supplierAccountName.trim()) {
      showErrorNotification(isAr ? 'حساب المورد مطلوب' : 'Supplier account required', isAr ? 'اختر المورد الذي أعاد مبلغ الاسترجاع.' : 'Select the supplier that returned the refund.');
      return;
    }

    const sourceTicket = selectedOriginalTicket || initialData;
    const matchedCustomer = customers.find((customer) =>
      [customer.id, customer.code, customer.nameAr, customer.nameEn, customer.name].includes(customerName),
    );
    const matchedSupplier = suppliers.find((supplier) =>
      [supplier.id, supplier.accountId, supplier.account?.id, supplier.code, supplier.nameAr, supplier.nameEn, supplier.name].includes(supplierAccount)
      || [supplier.nameAr, supplier.nameEn, supplier.name].includes(supplierAccountName),
    );
    const originalReference = (initialData as any)?.originalInvoiceNumber
      || selectedOriginalTicket?.invoiceNumber
      || (String(initialData?.invoiceNumber || '').startsWith('REF-') ? initialData?.reference : initialData?.invoiceNumber)
      || paperReceiptNumber
      || undefined;

    setSubmitting(true);
    try {
      const payload: any = {
        invoiceNumber: refundNumber,
        issueDate: issueDate.toISOString(),
        travelDate: travelDate ? travelDate.toISOString() : null,
        pnr: pnr || activePassengers[0]?.pnr || undefined,
        customerName: customerName.trim() || activePassengers[0].name.trim(),
        customerId: sourceTicket?.customerId || matchedCustomer?.id || undefined,
        customerAccountId: sourceTicket?.customerAccountId || sourceTicket?.customer?.accountId || matchedCustomer?.accountId || matchedCustomer?.account?.id || undefined,
        employeeName: employeeName.trim(),
        entryEmployee: user?.name || employeeName.trim(),
        cashbox: settlementAccountId || null,
        cashboxAccountId: settlementAccountId || null,
        currency,
        exchangeRate,
        paymentType,
        supplierAccount,
        supplierAccountName,
        supplierId: sourceTicket?.supplierId || sourceTicket?.supplier?.id || matchedSupplier?.id || undefined,
        supplierAccountId: sourceTicket?.supplierAccountId || sourceTicket?.supplier?.accountId || matchedSupplier?.accountId || matchedSupplier?.account?.id || undefined,
        tripType: 'REFUND',
        airline: airline || selectedOriginalTicket?.airline || undefined,
        route,
        totalSell: -Math.abs(totalSellRefund),
        totalBuy: isSupplierRefunded ? -Math.abs(totalBuyRefund) : 0,
        netSell: -Math.abs(totalNetRefundToCustomer),
        netBuy: isSupplierRefunded ? -Math.abs(totalNetBuyReturn) : 0,
        profit: totalRealizedProfit,
        transferImage: attachments[0]?.url || undefined,
        notes: `[استرجاع ${activePassengers.length} مسافر] غرامة طيران: ${totalAirlinePenalty} ${currency} | استقطاع شركة: ${totalAgencyRetention} ${currency} | ${notes || ''}`,
        reference: originalReference,
        status: 'REFUNDED',
        passengers: activePassengers.map((p) => ({
          name: p.name.trim(),
          ticketType: p.type || 'ADULT',
          ticketNumber: p.ticketNumber || undefined,
          pnr: p.pnr || pnr || undefined,
          fareBuy: -Math.abs(p.buyRefund),
          fareSell: -Math.abs(p.sellRefund),
          tax1: Number(p.airlinePenalty) || 0,
          charge: Number(p.agencyRetention) || 0,
          status: 'مسترجع',
        })),
      };

      const existingRefundId = initialData?.id;
      const isExistingRefund = Boolean(existingRefundId) && (initialData?.tripType === 'REFUND' || String(initialData?.invoiceNumber || '').startsWith('REF-'));
      if (isExistingRefund && existingRefundId) {
        await ticketsApi.update(existingRefundId, payload);
      } else {
        await ticketsApi.create(payload);
      }

      showSuccessNotification(
        isAr ? 'تم حفظ وترحيل الاسترجاع' : 'Refund Saved & Posted',
        isAr
          ? `تم حفظ وترحيل مستند الاسترجاع ${refundNumber} لعدد (${activePassengers.length}) مسافرين بنجاح.`
          : `Refund voucher ${refundNumber} saved and posted successfully.`
      );

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      showErrorNotification(
        isAr ? 'فشل حفظ الاسترجاع' : 'Refund Failed',
        err?.message || (isAr ? 'حدث خطأ أثناء حفظ قيد الاسترجاع' : 'Error saving refund')
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!opened) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#F7F8FA] flex flex-col h-screen w-screen overflow-hidden font-sans select-none"
      dir={direction}
      style={{ fontFamily: language === 'ar' ? "'IBM Plex Sans Arabic', system-ui, sans-serif" : "'IBM Plex Sans', system-ui, sans-serif" }}
    >
      {/* ── 1. Top Global Command Bar (Clean 64px Height) ── */}
      <div className="h-[64px] bg-white border-b border-[#E5E7EB] px-6 flex items-center justify-between shrink-0 shadow-2xs">
        
        {/* Left / Start: Close & Title & Audit Log Button */}
        <div className="flex items-center gap-4">
          <Tooltip label={isAr ? 'إغلاق ومغادرة' : 'Close Workspace'} position="bottom" withArrow>
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-[10px] flex items-center justify-center text-slate-500 hover:bg-[#F1F5F9] hover:text-slate-900 transition-colors cursor-pointer"
            >
              {direction === 'rtl' ? <ArrowRight size={20} /> : <ArrowLeft size={20} />}
            </button>
          </Tooltip>

          <div className="h-6 w-px bg-slate-200" />

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[10px] bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center font-bold shadow-2xs">
              <RotateCcw size={21} strokeWidth={2} />
            </div>
            <div>
              <span className="font-bold text-[17px] text-[#111827]">
                {isAr ? 'فاتورة استرجاع تذكرة' : 'Ticket Refund Invoice'}
              </span>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-200" />

          {/* Audit History Log Button */}
          <button
            type="button"
            onClick={() => setAuditLogOpen(true)}
            className="h-[40px] px-3.5 rounded-[9px] bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#334155] font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            <History size={16} className="text-blue-600" />
            <span>{isAr ? 'سجل التعديلات' : 'Audit Log'}</span>
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={onClose}
            className="h-[44px] px-5 rounded-[9px] bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#334155] font-semibold text-[13.5px] transition-colors cursor-pointer"
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>

          <button
            type="button"
            disabled={submitting}
            onClick={handleSaveRefund}
            className="h-[44px] px-6 rounded-[9px] bg-[#F45A0A] hover:bg-[#DD4F05] active:scale-[0.98] text-white font-semibold text-[13.5px] shadow-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <Check size={18} strokeWidth={2.4} />
            <span>{isAr ? 'حفظ وترحيل الاسترجاع' : 'Save & Post Refund'}</span>
          </button>
        </div>

      </div>

      {/* ── 2. Scrollable Workspace Body Canvas ── */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden p-5 md:p-6 space-y-5 max-w-[1720px] mx-auto w-full pb-48 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        
        {/* ── A. Fast Ticket Lookup Bar / Mode Switcher ── */}
        <div className="p-4 bg-white rounded-[14px] border border-[#E5E7EB] shadow-2xs space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center">
                <Sparkles size={16} />
              </div>
              <span className="text-[13px] font-bold text-[#111827]">
                {isAr ? 'نوع وطريقة إنشاء الاسترجاع' : 'Refund Creation Mode'}
              </span>
            </div>

            {/* Mode Switcher */}
            <SegmentedControl
              value={refundMode}
              onChange={(val) => setRefundMode(val as any)}
              data={[
                { label: isAr ? 'استرجاع من تذكرة مسجلة 🎫' : 'From Issued Ticket', value: 'FROM_TICKET' },
                { label: isAr ? 'نيو ريفاوند (استرجاع يدوي مباشر) ✍️' : 'New Direct Refund', value: 'MANUAL' },
              ]}
              radius="md"
              size="xs"
              styles={{
                root: { backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' },
                label: { fontWeight: 700, fontSize: '11.5px', padding: '5px 12px' },
              }}
            />
          </div>

          {refundMode === 'FROM_TICKET' ? (
            <div className="relative">
              <Search size={17} className={`absolute ${direction === 'rtl' ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 text-[#F45A0A]`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isAr ? 'اكتب رقم التذكرة، كود الحجز PNR، اسم المسافر أو العميل لاستدعاء التذكرة فورياً...' : 'Search by ticket #, PNR, passenger or customer name...'}
                className={`w-full h-[46px] ${direction === 'rtl' ? 'pr-11 pl-3.5' : 'pl-11 pr-3.5'} rounded-[10px] bg-[#FFFDF9] border border-[#FED7AA] text-[13.5px] text-[#111827] placeholder-[#9CA3AF] outline-none hover:border-[#F45A0A] focus:border-2 focus:border-[#F45A0A] transition-colors`}
              />

              {filteredSearchTickets.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white rounded-[14px] shadow-xl border border-slate-200 overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {filteredSearchTickets.map((t) => (
                    <button
                      key={t.id || t.invoiceNumber}
                      type="button"
                      onClick={() => handleSelectTicket(t)}
                      className="w-full p-4 text-right hover:bg-[#FFF3E8]/80 transition-colors flex items-center justify-between text-xs cursor-pointer"
                    >
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-2 text-[13px]">
                          <span>{t.invoiceNumber}</span>
                          {t.pnr && <span className="px-2 py-0.5 rounded bg-orange-100 text-[#F45A0A] font-mono text-xs font-bold">{t.pnr}</span>}
                        </div>
                        <div className="text-slate-500 mt-1 font-medium text-xs">
                          {t.passengers?.map((p) => `${p.name} (${p.ticketType || 'بالغ'})`).join(', ') || resolveCustomerDisplay(t.customerName)} • {t.airline || 'طيران'} • {t.route || 'مسار الرحلة'}
                        </div>
                      </div>

                      <div className="text-left font-mono" dir="ltr">
                        <div className="font-bold text-slate-900 text-sm">
                          {formatNumberEnglish(t.totalSell || 0)} {t.currency || 'IQD'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Buy: {formatNumberEnglish(t.totalBuy || 0)} {t.currency || 'IQD'}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-[10px] text-xs text-amber-900 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Edit3 size={16} className="text-[#F45A0A] shrink-0" />
                <span className="font-semibold">
                  {isAr
                    ? 'وضع الاسترجاع اليدوي المباشر (نيو ريفاوند): يمكنك إدخال التذكرة غير المسجلة مسبقاً، وتحديد العميل والمورد والمبالغ، وإضافة مسافرين بحرية.'
                    : 'Direct/Manual refund mode: create a refund for non-issued tickets and add passengers freely.'}
                </span>
              </div>
            </div>
          )}

          {selectedOriginalTicket && refundMode === 'FROM_TICKET' && (
            <div className="p-3.5 rounded-[10px] bg-[#FFF3E8]/70 border border-[#FED7AA] text-xs flex items-center justify-between flex-wrap gap-2 text-slate-800 font-medium">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>التذكرة الأصلية: <b className="font-mono font-bold text-slate-900">{selectedOriginalTicket.invoiceNumber}</b></span>
                <span>• المسار: <b className="font-mono font-bold text-slate-900">{selectedOriginalTicket.route || '—'}</b></span>
                <span>• المسافرون: <b className="font-bold text-slate-900">{selectedOriginalTicket.passengers?.length || 1} مسافر</b></span>
              </div>
              <div className="text-[#F45A0A] font-bold text-xs">
                ✓ تم جلب بيانات ومسافري التذكرة بالكامل
              </div>
            </div>
          )}
        </div>

        {/* ── B. Main Metadata Form Grid (Spacious 44px Inputs with Currency) ── */}
        <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-5 shadow-2xs space-y-4">
          <h3 className="font-bold text-[14px] text-[#111827] flex items-center gap-2 border-b border-slate-100 pb-3">
            <Plane size={18} className="text-[#F45A0A]" />
            <span>{isAr ? 'بيانات التذكرة والحسابات' : 'Ticket Details & Accounts'}</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Refund Date with SegmentedDatePicker */}
            <div>
              <label className="text-[12.5px] font-semibold text-[#334155] block mb-1.5">
                {isAr ? 'تاريخ الاسترجاع' : 'Refund Date'}
              </label>
              <SegmentedDatePicker
                value={issueDate}
                onChange={(d) => d && setIssueDate(d)}
              />
            </div>

            {/* Airline Selector */}
            <div>
              <label className="text-[12.5px] font-semibold text-[#334155] block mb-1.5">
                {isAr ? 'شركة الطيران' : 'Airline'}
              </label>
              <SearchableCombobox
                options={airlineOptions}
                value={airline}
                onChange={setAirline}
                placeholder={isAr ? 'اختر أو اكتب شركة الطيران' : 'Select airline'}
              />
            </div>

            {/* PNR Code */}
            <div>
              <label className="text-[12.5px] font-semibold text-[#334155] block mb-1.5">
                {isAr ? 'كود الحجز PNR *' : 'PNR Code *'}
              </label>
              <input
                type="text"
                dir="ltr"
                placeholder="e.g. PRMCK"
                value={pnr}
                onChange={(e) => setPnr(e.target.value.toUpperCase())}
                style={{ fontFamily: "'JetBrains Mono', 'Consolas', 'Roboto', monospace" }}
                className="w-full h-[44px] px-3.5 rounded-[10px] bg-[#FAFAFA] border border-[#E5E7EB] text-[13.5px] font-mono font-bold text-[#111827] uppercase outline-none hover:border-[#D1D5DB] focus:border-2 focus:border-[#F45A0A] transition-colors"
              />
            </div>

            {/* Currency Selection Field (44px Height) */}
            <div>
              <label className="text-[12.5px] font-semibold text-[#334155] block mb-1.5">
                {isAr ? 'العملة' : 'Currency'}
              </label>
              <div className="h-[44px] p-1 rounded-[10px] bg-[#FAFAFA] border border-[#E5E7EB] flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setCurrency('IQD');
                    setExchangeRate(1);
                  }}
                  className={`flex-1 h-full rounded-[7px] text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    currency === 'IQD'
                      ? 'bg-[#F45A0A] text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-200/60'
                  }`}
                >
                  <span>د.ع IQD</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCurrency('USD');
                    setExchangeRate(adoptedEx.adoptedRate || 1550);
                  }}
                  className={`flex-1 h-full rounded-[7px] text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    currency === 'USD'
                      ? 'bg-[#F45A0A] text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-200/60'
                  }`}
                >
                  <span>$ USD</span>
                </button>
              </div>
            </div>

            {/* Customer Account */}
            <div>
              <label className="text-[12.5px] font-semibold text-[#334155] block mb-1.5">
                {isAr ? 'العميل / الحساب' : 'Customer Account'}
              </label>
              <SearchableCombobox
                options={customerOptions}
                value={customerName}
                onChange={setCustomerName}
                placeholder={isAr ? 'اختر العميل' : 'Select customer'}
              />
            </div>

            {/* Supplier Account */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="text-[12.5px] font-semibold text-[#334155]">
                  {isAr ? 'المورد / جهة الإصدار' : 'Supplier Account'}
                </label>
                <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5">
                  <span className={`text-[10.5px] font-extrabold ${isSupplierRefunded ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {isSupplierRefunded
                      ? (isAr ? 'أرجع المورد' : 'Supplier refunded')
                      : (isAr ? 'لم يرجع المورد' : 'Not refunded')}
                  </span>
                  <Switch
                    checked={isSupplierRefunded}
                    onChange={(event) => setIsSupplierRefunded(event.currentTarget.checked)}
                    color="teal"
                    size="xs"
                  />
                </div>
              </div>
              <SearchableCombobox
                options={supplierOptions}
                value={supplierAccount}
                onChange={(val) => {
                  setSupplierAccount(val);
                  if (!val) {
                    setSupplierAccountName('');
                    return;
                  }
                  const found = suppliers.find((s) =>
                    [s.id, s.accountId, s.account?.id, s.code, s.nameAr, s.nameEn, s.name].includes(val)
                  );
                  setSupplierAccountName(found ? (found.nameAr || found.nameEn || found.name || found.code) : '');
                }}
                placeholder={isAr ? 'اختر المورد' : 'Select supplier'}
              />
            </div>

            {/* Issuer Employee */}
            <div className="lg:col-span-2">
              <label className="text-[12.5px] font-semibold text-[#334155] block mb-1.5">
                {isAr ? 'موظف الإدخال والاعتماد' : 'Issuer / Created By'}
              </label>
              <input
                type="text"
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
                className="w-full h-[44px] px-3.5 rounded-[10px] bg-[#FAFAFA] border border-[#E5E7EB] text-[13.5px] font-semibold text-[#111827] outline-none hover:border-[#D1D5DB] focus:border-2 focus:border-[#F45A0A] transition-colors"
              />
            </div>

          </div>
        </div>

        {/* ── C. Dedicated Multi-Passenger Refund Table (Simple, Clear & Intuitive) ── */}
        <div className="bg-white rounded-[14px] border border-[#E5E7EB] shadow-2xs overflow-hidden">
          
          {/* Table Top Header with Clean Bulk Quick-Apply Bar */}
          <div className="p-4 bg-[#F8FAFC] border-b border-[#E5E7EB] flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[10px] bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center font-bold shrink-0">
                <Users size={20} />
              </div>
              <div>
                <h3 className="font-bold text-[14.5px] text-[#111827]">
                  {isAr ? 'تحديد المسافرين واحتساب الفروقات والخصومات' : 'Passenger Refunds & Deductions'}
                </h3>
                <p className="text-[12px] text-slate-500 mt-0.5">
                  {isAr
                    ? 'حدد المسافرين المسترجعين، وأدخل غرامة الطيران أو استقطاع الشركة لتحديث صافي المبلغ للعميل فورياً'
                    : 'Select refunded passengers and enter airline penalties or company retention'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Add Passenger Button */}
              <button
                type="button"
                onClick={handleAddPassenger}
                className="h-[38px] px-3.5 rounded-[9px] bg-white border border-[#FED7AA] hover:bg-[#FFF3E8] text-[#F45A0A] font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <Plus size={15} strokeWidth={2.4} />
                <span>{isAr ? 'إضافة مسافر' : 'Add Passenger'}</span>
              </button>

              {/* Clean Quick Bulk Applicator */}
              <div className="flex items-center gap-2 flex-wrap bg-white p-1.5 rounded-[12px] border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-1 text-xs font-bold text-slate-700 px-1">
                  <Sparkles size={15} className="text-[#F45A0A]" />
                  <span>{isAr ? `تطبيق موحد (${activePassengers.length}):` : `Bulk Apply (${activePassengers.length}):`}</span>
                </div>

                {/* Bulk Airline Penalty */}
                <div className="flex items-center gap-1 bg-[#FFF5F5] border border-rose-200 px-2.5 py-1 rounded-[8px]">
                  <span className="text-xs font-bold text-rose-700">{isAr ? 'غرامة طيران:' : 'Penalty:'}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    placeholder="0"
                    value={bulkAirlinePenalty}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
                      const clean = raw.replace(/[٠-٩]/g, (d) => arabicDigits.indexOf(d).toString()).replace(/[^0-9]/g, '');
                      setBulkAirlinePenalty(clean ? Number(clean).toLocaleString('en-US') : '');
                    }}
                    style={{ fontFamily: "'JetBrains Mono', 'Consolas', 'Roboto', monospace" }}
                    className="w-24 h-[28px] bg-transparent text-sm font-mono font-bold text-rose-700 text-left outline-none"
                  />
                </div>

                {/* Bulk Agency Retention */}
                <div className="flex items-center gap-1 bg-[#FFFBEB] border border-amber-200 px-2.5 py-1 rounded-[8px]">
                  <span className="text-xs font-bold text-amber-800">{isAr ? 'استقطاع شركة:' : 'Retention:'}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    placeholder="0"
                    value={bulkAgencyRetention}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
                      const clean = raw.replace(/[٠-٩]/g, (d) => arabicDigits.indexOf(d).toString()).replace(/[^0-9]/g, '');
                      setBulkAgencyRetention(clean ? Number(clean).toLocaleString('en-US') : '');
                    }}
                    style={{ fontFamily: "'JetBrains Mono', 'Consolas', 'Roboto', monospace" }}
                    className="w-24 h-[28px] bg-transparent text-sm font-mono font-bold text-amber-800 text-left outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleApplyBulkPenalty}
                  className="h-[34px] px-4 rounded-[8px] bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <Check size={14} strokeWidth={2.4} />
                  <span>{isAr ? 'تطبيق' : 'Apply'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Clean Streamlined Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] text-slate-700 font-bold border-b border-[#E5E7EB] h-[46px] select-none text-[12.5px]">
                  <th className="p-3 text-center w-12">
                    <Checkbox
                      checked={passengers.length > 0 && passengers.every((p) => p.selected)}
                      indeterminate={passengers.some((p) => p.selected) && !passengers.every((p) => p.selected)}
                      onChange={(e) => {
                        const checked = e.currentTarget.checked;
                        setPassengers((prev) => prev.map((p) => ({ ...p, selected: checked })));
                      }}
                    />
                  </th>
                  <th className="p-3 w-10 text-center">#</th>
                  <th className="p-3 min-w-[170px]">{isAr ? 'اسم المسافر *' : 'Passenger Name *'}</th>
                  <th className="p-3 min-w-[110px]">{isAr ? 'نوع المسافر' : 'Pax Type'}</th>
                  <th className="p-3 min-w-[140px]">{isAr ? 'رقم التذكرة' : 'Ticket Number'}</th>
                  <th className="p-3 min-w-[130px] font-mono text-left">{isAr ? 'مبلغ الشراء' : 'Buy Refund'}</th>
                  <th className="p-3 min-w-[130px] font-mono text-left text-rose-700">{isAr ? 'غرامة الطيران (-)' : 'Airline Penalty (-)'}</th>
                  <th className="p-3 min-w-[130px] font-mono text-left text-slate-800">{isAr ? 'صافي المورد' : 'Net Supplier'}</th>
                  <th className="p-3 min-w-[130px] font-mono text-left">{isAr ? 'مبلغ المبيع' : 'Sell Refund'}</th>
                  <th className="p-3 min-w-[130px] font-mono text-left text-amber-800">{isAr ? 'استقطاع الشركة (-)' : 'Agency Retention (-)'}</th>
                  <th className="p-3 min-w-[140px] font-mono text-left text-[#F45A0A]">{isAr ? 'الصافي للعميل' : 'Net Customer'}</th>
                  <th className="p-3 min-w-[120px] font-mono text-left text-[#078B61]">{isAr ? 'صافي الربح' : 'Profit'}</th>
                  <th className="p-3 text-center w-12">{isAr ? 'حذف' : 'Del'}</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {passengers.map((p, index) => {
                  const netBuy = Math.max(0, (Number(p.buyRefund) || 0) - (Number(p.airlinePenalty) || 0));
                  const netSell = Math.max(0, (Number(p.sellRefund) || 0) - (Number(p.airlinePenalty) || 0) - (Number(p.agencyRetention) || 0));
                  const profit = Number(p.agencyRetention) || 0;

                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors ${p.selected ? 'bg-white hover:bg-[#FFF8F3]' : 'bg-slate-50/70 opacity-60 hover:opacity-100'}`}
                    >
                      {/* Checkbox */}
                      <td className="p-3 text-center">
                        <Checkbox
                          checked={p.selected}
                          onChange={(e) => updatePassenger(p.id, 'selected', e.currentTarget.checked)}
                        />
                      </td>

                      {/* Index */}
                      <td className="p-3 text-center font-mono font-bold text-slate-400 text-xs">
                        {index + 1}
                      </td>

                      {/* Passenger Name */}
                      <td className="p-2.5">
                        <input
                          type="text"
                          value={p.name}
                          onChange={(e) => updatePassenger(p.id, 'name', e.target.value)}
                          placeholder={isAr ? 'اسم المسافر' : 'Passenger Name'}
                          className="w-full h-[40px] px-3 rounded-[8px] border border-slate-200 text-[13px] font-bold text-[#111827] outline-none focus:border-[#F45A0A]"
                        />
                      </td>

                      {/* Passenger Type (Mantine Select) */}
                      <td className="p-2.5">
                        <Select
                          size="sm"
                          radius="md"
                          value={p.type || 'ADULT'}
                          onChange={(val) => updatePassenger(p.id, 'type', val || 'ADULT')}
                          data={[
                            { value: 'ADULT', label: isAr ? 'بالغ' : 'Adult' },
                            { value: 'CHILD', label: isAr ? 'طفل' : 'Child' },
                            { value: 'INFANT', label: isAr ? 'رضيع' : 'Infant' },
                          ]}
                          comboboxProps={{ withinPortal: true, zIndex: 9999, transitionProps: { duration: 150, transition: 'pop' } }}
                          styles={{
                            input: {
                              height: 40,
                              fontSize: 12.5,
                              fontWeight: 700,
                              borderRadius: 8,
                              borderColor: '#E2E8F0',
                              backgroundColor: '#FAFAFA',
                              width: '100%',
                            },
                          }}
                        />
                      </td>

                      {/* Ticket # */}
                      <td className="p-2.5">
                        <input
                          type="text"
                          dir="ltr"
                          value={p.ticketNumber}
                          onChange={(e) => updatePassenger(p.id, 'ticketNumber', e.target.value)}
                          placeholder={isAr ? 'رقم التذكرة' : 'Ticket number'}
                          style={{ fontFamily: "'JetBrains Mono', 'Consolas', 'Roboto', monospace" }}
                          className="w-full h-[40px] px-3 rounded-[8px] border border-slate-200 text-xs font-mono font-bold text-[#111827] outline-none focus:border-[#F45A0A]"
                        />
                      </td>

                      {/* Buy Refund (Original from Ticket - Read Only) */}
                      <td className="p-2.5">
                        <div
                          className="w-full h-[40px] px-3 rounded-[8px] bg-[#F8FAFC] border border-slate-200 text-sm font-mono font-bold text-slate-800 flex items-center justify-start tabular-nums select-none"
                          dir="ltr"
                          style={{ fontFamily: "'JetBrains Mono', 'Consolas', 'Roboto', monospace" }}
                          title={isAr ? 'مبلغ الشراء الأصلي من التذكرة (غير قابل للتعديل)' : 'Original Buy Amount'}
                        >
                          {formatNumberEnglish(p.buyRefund)}
                        </div>
                      </td>

                      {/* Airline Penalty (Editable) */}
                      <td className="p-2.5">
                        <input
                          type="text"
                          inputMode="numeric"
                          dir="ltr"
                          placeholder="0"
                          value={p.airlinePenalty ? p.airlinePenalty.toLocaleString('en-US') : ''}
                          onChange={(e) => updatePassenger(p.id, 'airlinePenalty', parseCleanNumber(e.target.value))}
                          style={{ fontFamily: "'JetBrains Mono', 'Consolas', 'Roboto', monospace" }}
                          className="w-full h-[40px] px-3 rounded-[8px] border border-rose-200 text-sm font-mono font-bold text-rose-700 text-left outline-none hover:border-rose-400 focus:border-2 focus:border-rose-500 bg-rose-50/20"
                        />
                      </td>

                      {/* Net Supplier */}
                      <td className="p-3 text-left font-mono font-bold text-slate-800 text-sm tabular-nums" dir="ltr" style={{ fontFamily: "'JetBrains Mono', 'Consolas', 'Roboto', monospace" }}>
                        {formatNumberEnglish(netBuy)}
                      </td>

                      {/* Sell Refund (Original from Ticket - Read Only) */}
                      <td className="p-2.5">
                        <div
                          className="w-full h-[40px] px-3 rounded-[8px] bg-[#F8FAFC] border border-slate-200 text-sm font-mono font-bold text-slate-800 flex items-center justify-start tabular-nums select-none"
                          dir="ltr"
                          style={{ fontFamily: "'JetBrains Mono', 'Consolas', 'Roboto', monospace" }}
                          title={isAr ? 'مبلغ المبيع الأصلي من التذكرة (غير قابل للتعديل)' : 'Original Sell Amount'}
                        >
                          {formatNumberEnglish(p.sellRefund)}
                        </div>
                      </td>

                      {/* Agency Retention (Editable) */}
                      <td className="p-2.5">
                        <input
                          type="text"
                          inputMode="numeric"
                          dir="ltr"
                          placeholder="0"
                          value={p.agencyRetention ? p.agencyRetention.toLocaleString('en-US') : ''}
                          onChange={(e) => updatePassenger(p.id, 'agencyRetention', parseCleanNumber(e.target.value))}
                          style={{ fontFamily: "'JetBrains Mono', 'Consolas', 'Roboto', monospace" }}
                          className="w-full h-[40px] px-3 rounded-[8px] border border-amber-200 text-sm font-mono font-bold text-amber-800 text-left outline-none hover:border-amber-400 focus:border-2 focus:border-amber-500 bg-amber-50/20"
                        />
                      </td>

                      {/* Net Customer */}
                      <td className="p-3 text-left font-mono font-extrabold text-[#F45A0A] text-sm tabular-nums" dir="ltr" style={{ fontFamily: "'JetBrains Mono', 'Consolas', 'Roboto', monospace" }}>
                        {formatNumberEnglish(netSell)}
                      </td>

                      {/* Profit */}
                      <td className="p-3 text-left font-mono font-extrabold text-[#078B61] text-sm tabular-nums" dir="ltr" style={{ fontFamily: "'JetBrains Mono', 'Consolas', 'Roboto', monospace" }}>
                        {profit > 0 ? `+${formatNumberEnglish(profit)}` : formatNumberEnglish(profit)}
                      </td>

                      {/* Delete */}
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemovePassenger(p.id)}
                          className="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center mx-auto transition-colors cursor-pointer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer Count */}
          <div className="p-3 bg-[#F8FAFC] border-t border-[#E5E7EB] flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">
              {isAr ? `إجمالي المسافرين المحددين للاسترجاع: ${activePassengers.length} من أصل ${passengers.length}` : `Selected for refund: ${activePassengers.length} of ${passengers.length}`}
            </span>
          </div>
        </div>

        {/* ── D. Crystal Clear Financial Summary Cards ── */}
        <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-5 shadow-2xs space-y-4">
          <h3 className="font-bold text-[14px] text-[#111827] flex items-center gap-2 border-b border-slate-100 pb-3">
            <TrendingUp size={18} className="text-[#F45A0A]" />
            <span>{isAr ? 'ملخص مبالغ الاسترجاع الإجمالية' : 'Refund Financial Summary'}</span>
          </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* 1. Buy Refund (From Supplier) */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[11.5px] font-bold text-slate-500 block mb-1">
                {isAr ? 'مسترجع الشراء (من المورد)' : 'Gross Buy Refund'}
              </span>
              <span className="text-lg font-black font-mono text-slate-900 tabular-nums block" dir="ltr">
                {formatNumberEnglish(isSupplierRefunded ? totalBuyRefund : 0)} <span className="text-xs font-sans font-bold text-slate-400">{currency}</span>
              </span>
              <span className={`text-[10px] font-bold block mt-1 ${isSupplierRefunded ? 'text-emerald-700' : 'text-rose-600'}`}>
                {isSupplierRefunded ? (isAr ? '✓ المورد أرجع المبلغ' : '✓ Supplier Refunded') : (isAr ? '✗ لم يرجع المورد (0)' : '✗ No Supplier Return')}
              </span>
            </div>

            {/* 2. Airline Penalty */}
            <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200">
              <span className="text-[11.5px] font-bold text-rose-700 block mb-1">
                {isAr ? 'غرامات الطيران (-)' : 'Airline Penalties (-)'}
              </span>
              <span className="text-lg font-black font-mono text-rose-700 tabular-nums block" dir="ltr">
                -{formatNumberEnglish(totalAirlinePenalty)} <span className="text-xs font-sans font-bold text-rose-400">{currency}</span>
              </span>
              <span className="text-[10px] text-rose-600 font-bold block mt-1">
                {isAr ? `صافي من المورد: ${formatNumberEnglish(totalNetBuyReturn)}` : `Net from supplier: ${formatNumberEnglish(totalNetBuyReturn)}`}
              </span>
            </div>

            {/* 3. Agency Retention Fee / Profit */}
            <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200">
              <span className="text-[11.5px] font-bold text-emerald-800 block mb-1">
                {isAr ? 'رسوم وربح الوكالة (+)' : 'Agency Retention Fee (+)'}
              </span>
              <span className="text-lg font-black font-mono text-emerald-700 tabular-nums block" dir="ltr">
                +{formatNumberEnglish(totalAgencyRetention)} <span className="text-xs font-sans font-bold text-emerald-500">{currency}</span>
              </span>
              <span className="text-[10px] text-emerald-600 font-bold block mt-1">
                {isAr ? 'ربح صافي للشركة من الاسترجاع' : 'Agency Net Realized Profit'}
              </span>
            </div>

            {/* 4. Net Refund to Customer */}
            <div className="p-3.5 rounded-xl bg-[#FFF3E8] border border-[#FFD8B2]">
              <span className="text-[11.5px] font-bold text-[#F45A0A] block mb-1">
                {isAr ? 'الصافي المستحق للعميل' : 'Net Paid to Customer'}
              </span>
              <span className="text-xl font-black font-mono text-[#F45A0A] tabular-nums block" dir="ltr">
                {formatNumberEnglish(totalNetRefundToCustomer)} <span className="text-xs font-sans font-bold text-[#F45A0A]">{currency}</span>
              </span>
              <span className="text-[10px] text-slate-500 font-bold block mt-1">
                {isAr ? `(مسترجع البيع ${formatNumberEnglish(totalSellRefund)} - الخصومات)` : `(Sell ${formatNumberEnglish(totalSellRefund)} - Deductions)`}
              </span>
            </div>
          </div>
        </div>

        {/* ── E. Settlement & Attachments Section ── */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          
          {/* Payment Mode Box */}
          <div className="md:col-span-6 bg-white rounded-[14px] border border-[#E5E7EB] p-5 space-y-4 shadow-2xs">
            <h3 className="font-bold text-[14px] text-[#111827] flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <Coins size={18} className="text-[#F45A0A]" />
              <span>{isAr ? 'طريقة التسوية وصرف المبلغ' : 'Settlement Mode'}</span>
            </h3>

            <div className="flex items-center gap-5 flex-wrap">
              <Radio
                checked={paymentType === 'CASH_HAND'}
                onChange={() => setPaymentType('CASH_HAND')}
                label={isAr ? 'نقدي (صرف من الصندوق)' : 'Cash Refund'}
                className="font-bold text-xs"
              />
              <Radio
                checked={paymentType === 'MASTER_CARD'}
                onChange={() => setPaymentType('MASTER_CARD')}
                label={isAr ? 'ماستركارد / دفع إلكتروني' : 'Mastercard / Electronic'}
                className="font-bold text-xs"
              />
              <Radio
                checked={paymentType === 'ON_ACCOUNT'}
                onChange={() => setPaymentType('ON_ACCOUNT')}
                label={isAr ? 'قيد آجل في حساب العميل' : 'Credit on Account'}
                className="font-bold text-xs"
              />
            </div>

            {paymentType === 'CASH_HAND' && (
              <div>
                <label className="text-[12.5px] font-semibold text-[#334155] block mb-1.5 flex items-center justify-between">
                  <span>{isAr ? 'الصندوق المنفذ للصرف' : 'Cashbox'}</span>
                  <span className="text-[11px] font-bold text-emerald-600">✓ تم تحديد صندوق الموظف تلقائياً</span>
                </label>
                <Select
                  value={cashboxId}
                  onChange={(val) => val && setCashboxId(val)}
                  data={cashboxes.map((c) => ({
                    value: c.id || c.code,
                    label: c.nameAr || c.name || 'الصندوق الرئيسي',
                  }))}
                  comboboxProps={{ withinPortal: true, zIndex: 9999 }}
                  styles={{
                    input: {
                      height: 44,
                      fontSize: 13.5,
                      fontWeight: 600,
                      borderRadius: 10,
                      borderColor: '#E5E7EB',
                      backgroundColor: '#FAFAFA',
                    },
                  }}
                />
              </div>
            )}

            {paymentType === 'MASTER_CARD' && (
              <div>
                <label className="text-[12.5px] font-semibold text-[#334155] block mb-1.5">
                  {isAr ? 'حساب الماستركارد / البنك المنفذ للصرف' : 'Mastercard / Bank Account'}
                </label>
                <Select
                  value={bankAccountId}
                  onChange={(val) => val && setBankAccountId(val)}
                  data={bankAccounts.map((b) => ({
                    value: b.id || b.code,
                    label: b.nameAr || b.name || 'حساب الماستر كارد',
                  }))}
                  comboboxProps={{ withinPortal: true, zIndex: 9999 }}
                  styles={{
                    input: {
                      height: 44,
                      fontSize: 13.5,
                      fontWeight: 600,
                      borderRadius: 10,
                      borderColor: '#E5E7EB',
                      backgroundColor: '#FAFAFA',
                    },
                  }}
                />
              </div>
            )}

            <div>
              <label className="text-[12.5px] font-semibold text-[#334155] block mb-1.5">
                {isAr ? 'رقم الوصل الورقي / مرجع التحويل' : 'Receipt / Transfer Reference #'}
              </label>
              <input
                type="text"
                dir="ltr"
                placeholder="e.g. 10245 / TX-99218"
                value={paperReceiptNumber}
                onChange={(e) => setPaperReceiptNumber(e.target.value)}
                style={{ fontFamily: "'JetBrains Mono', 'Consolas', 'Roboto', monospace" }}
                className="w-full h-[44px] px-3.5 rounded-[10px] bg-[#FAFAFA] border border-[#E5E7EB] text-[13.5px] font-mono font-bold text-[#111827] outline-none hover:border-[#D1D5DB] focus:border-2 focus:border-[#F45A0A] transition-colors"
              />
            </div>
          </div>

          {/* Remarks & Attachments */}
          <div className="md:col-span-6 bg-white rounded-[14px] border border-[#E5E7EB] p-5 space-y-3.5 shadow-2xs">
            <h3 className="font-bold text-[14px] text-[#111827] flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <Receipt size={18} className="text-[#F45A0A]" />
              <span>{isAr ? 'الملاحظات والوصل المرفق' : 'Remarks & Receipt Attachment'}</span>
            </h3>

            {/* Attachments Section */}
            <div>
              <TicketAttachmentsSection
                attachments={attachments}
                onChange={setAttachments}
              />
            </div>

            <div>
              <label className="text-[12.5px] font-semibold text-[#334155] block mb-1.5">
                {isAr ? 'ملاحظات وتفاصيل الاسترجاع' : 'Refund Remarks & Notes'}
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={isAr ? 'أسباب الاسترجاع، تفاصيل التذكرة، توجيهات...' : 'Refund reason, policy notes...'}
                className="w-full p-3 rounded-[10px] bg-[#FAFAFA] border border-[#E5E7EB] text-[13px] font-medium text-[#111827] outline-none hover:border-[#D1D5DB] focus:border-2 focus:border-[#F45A0A] transition-colors"
              />
            </div>

            <div className="p-3 rounded-[10px] bg-[#F8FAFC] border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
              <ShieldCheck size={18} className="text-emerald-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                {isAr
                  ? 'سيقوم النظام بتوليد قيد اليومية المزدوج، وتحديث أرصدة العملاء والموردين والصناديق تلقائياً.'
                  : 'Automatic double-entry journal vouchers will be generated and account balances updated instantly.'}
              </p>
            </div>
          </div>

        </div>

        {/* Bottom clearance spacer */}
        <div className="h-20 shrink-0 select-none" />

      </div>

      {/* ── 3. Bottom Slim Sticky Bar (Compact Height & Sleek Layout) ── */}
            {/* 🔹 3. White Modern Sticky Bottom Bar with Real-time KPIs 🔹 */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md text-slate-900 border-t border-slate-200 px-6 py-2.5 z-50 flex items-center justify-between flex-wrap gap-4 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] font-sans text-xs">
        {/* Left / Leading Stats */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[11.5px] font-bold text-slate-500">{isAr ? 'رقم السند:' : 'Voucher #:'}</span>
            <span className="px-2.5 py-0.5 rounded-lg bg-[#FFF3E8] border border-orange-200 text-[#F45A0A] font-mono font-bold text-xs tracking-wider select-all" dir="ltr">
              {refundNumber}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          {/* Quick KPI stats */}
          <div className="hidden lg:flex items-center gap-4 font-mono text-xs" dir="ltr">
            <div>
              <span className="text-slate-400 font-sans">{isAr ? 'مسترجع الشراء: ' : 'Buy: '}</span>
              <span className="font-bold text-slate-800">{formatNumberEnglish(isSupplierRefunded ? totalBuyRefund : 0)}</span>
            </div>
            <div>
              <span className="text-slate-400 font-sans">{isAr ? 'غرامة الطيران: ' : 'Penalty: '}</span>
              <span className="font-bold text-rose-600">{formatNumberEnglish(totalAirlinePenalty)}</span>
            </div>
            <div>
              <span className="text-slate-400 font-sans">{isAr ? 'مسترجع البيع: ' : 'Sell: '}</span>
              <span className="font-bold text-slate-800">{formatNumberEnglish(totalSellRefund)}</span>
            </div>
            <div>
              <span className="text-slate-400 font-sans">{isAr ? 'رسوم الوكالة: ' : 'Fee: '}</span>
              <span className="font-bold text-emerald-700">+{formatNumberEnglish(totalAgencyRetention)}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-orange-50 border border-orange-200">
            <span className="text-[#F45A0A] font-bold font-sans text-xs">{isAr ? 'الصافي للعميل: ' : 'Net Customer: '}</span>
            <span className="font-black font-mono text-sm text-[#F45A0A]" dir="ltr">
              {formatNumberEnglish(totalNetRefundToCustomer)} <span className="text-[11px] font-sans font-bold">{currency}</span>
            </span>
          </div>
        </div>

        {/* Right / Actions */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="h-[38px] px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>

          <button
            type="button"
            disabled={submitting}
            onClick={handleSaveRefund}
            className="h-[38px] px-5 rounded-xl bg-[#F45A0A] hover:bg-orange-600 active:scale-[0.98] text-white font-black text-xs shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <Check size={16} strokeWidth={2.4} />
            <span>{isAr ? 'حفظ وترحيل الاسترجاع' : 'Save & Post Refund'}</span>
          </button>
        </div>
      </footer>
    </div>
  );
};

export default TicketRefundEditorWorkspace;
