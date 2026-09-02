import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Tooltip,
  Radio,
  Checkbox,
  Select,
  Modal,
  SegmentedControl,
  Switch,
  Menu,
  ActionIcon,
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
  MoreVertical,
} from 'lucide-react';
import { ticketsApi, type TicketData } from '../../api/tickets';
import { airlinesApi, type AirlineItem } from '../../api/airlines';
import { partnersApi } from '../../api/partners';
import { accountsApi } from '../../api/accounts';
import { employeesApi, type Employee } from '../../api/employees';
import { SearchableCombobox, ComboboxOption } from '../ui/SearchableCombobox';
import { SegmentedDatePicker } from '../ui/SegmentedDatePicker';
import { InvoiceAuditLogModal } from '../tickets/InvoiceAuditLogModal';
import { TicketAttachmentsSection, type AttachmentItem } from '../tickets/TicketAttachmentsSection';
import { showSuccessNotification, showErrorNotification, showInfoNotification } from '../../utils/notifications';
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
  sellRefund: number;
  airlineRefund: number;
  companyRefund: number;
  airlinePenalty?: number;
  agencyRetention?: number;
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
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Refund Type: Full Refund (100% no penalty) vs Refund with Penalty
  const [refundType, setRefundType] = useState<'FULL' | 'WITH_PENALTY'>('WITH_PENALTY');

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
      sellRefund: 0,
      airlineRefund: 0,
      companyRefund: 0,
      airlinePenalty: 0,
      agencyRetention: 0,
    },
  ]);

  // Bulk Apply Amounts to All Selected Passengers
  const [bulkAirlineRefund, setBulkAirlineRefund] = useState<string>('');
  const [bulkCompanyRefund, setBulkCompanyRefund] = useState<string>('');
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

  // ── Financial Calculation Logic (Clear & Intuitive) ──
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

  // 2. Total Airline Refund & Total Company Refund
  const totalAirlineRefund = useMemo(
    () => activePassengers.reduce((sum, p) => sum + (Number(p.airlineRefund !== undefined ? p.airlineRefund : p.buyRefund) || 0), 0),
    [activePassengers]
  );
  const totalCompanyRefund = useMemo(
    () => activePassengers.reduce((sum, p) => sum + (Number(p.companyRefund !== undefined ? p.companyRefund : p.sellRefund) || 0), 0),
    [activePassengers]
  );

  // 3. Profit = Airline Refund - Company Refund (الربح هو الفرق بين استرجاع الطيران واسترجاع الشركة)
  const totalRealizedProfit = useMemo(() => {
    return totalAirlineRefund - totalCompanyRefund;
  }, [totalAirlineRefund, totalCompanyRefund]);

  // 4. Net Refund Paid to Customer = Company Refund
  const totalNetRefundToCustomer = useMemo(
    () => totalCompanyRefund,
    [totalCompanyRefund]
  );

  // 5. Net Refund Recovered from Supplier = Airline Refund (if supplier refunded)
  const totalNetBuyReturn = useMemo(
    () => (isSupplierRefunded ? totalAirlineRefund : 0),
    [isSupplierRefunded, totalAirlineRefund]
  );

  // Backward compatibility
  const totalAirlinePenalty = useMemo(
    () => Math.max(0, totalBuyRefund - totalAirlineRefund),
    [totalBuyRefund, totalAirlineRefund]
  );
  const totalAgencyRetention = useMemo(
    () => totalRealizedProfit,
    [totalRealizedProfit]
  );

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
              const origBuy = Math.abs(p.fareBuy || 0);
              const origSell = Math.abs(p.fareSell || 0);
              const airlinePen = (p.tax1 !== undefined && p.tax1 !== null && p.tax1 > 0) ? p.tax1 : fallbackAirlinePenalty;
              const agencyRet = (p.charge !== undefined && p.charge !== null && p.charge > 0) ? p.charge : fallbackAgencyRetention;
              const airlineRef = Math.max(0, origBuy - airlinePen);
              const companyRef = Math.max(0, origSell - airlinePen - agencyRet);
              return {
                id: p.id || `p-${idx}-${Date.now()}`,
                selected: true,
                name: p.name || '',
                type: normalizePassengerType(p.ticketType || (p as any).type || (p as any).passengerType),
                ticketNumber: p.ticketNumber || (p as any).documentNumber || (p as any).eTicketNumber || '',
                pnr: p.pnr || initialData.pnr || '',
                buyRefund: origBuy,
                sellRefund: origSell,
                airlineRefund: airlineRef,
                companyRefund: companyRef,
                airlinePenalty: airlinePen,
                agencyRetention: agencyRet,
              };
            })
          );
        } else {
          const origBuy = Math.abs(initialData.totalBuy || 0);
          const origSell = Math.abs(initialData.totalSell || 0);
          setPassengers([
            {
              id: `p-${Date.now()}`,
              selected: true,
              name: initialData.customerName || '',
              type: 'ADULT',
              ticketNumber: initialData.invoiceNumber || '',
              pnr: initialData.pnr || '',
              buyRefund: origBuy,
              sellRefund: origSell,
              airlineRefund: origBuy,
              companyRefund: origSell,
              airlinePenalty: 0,
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
            sellRefund: 0,
            airlineRefund: 0,
            companyRefund: 0,
            airlinePenalty: 0,
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
      employeesApi.getAll().then((data) => setEmployees(data || [])).catch(() => {});
      
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
        paxToPopulate.map((p: any, idx: number) => {
          const buyAmt = Math.abs(p.fareBuy || (t.totalBuy || 0) / (t.passengers?.length || 1) || 0);
          const sellAmt = Math.abs(p.fareSell || (t.totalSell || 0) / (t.passengers?.length || 1) || 0);
          return {
            id: p.id || `p-${idx}-${Date.now()}`,
            selected: true,
            name: p.name || '',
            type: normalizePassengerType(p.ticketType || (p as any).type || (p as any).passengerType),
            ticketNumber: p.ticketNumber || (p as any).documentNumber || (p as any).eTicketNumber || t.invoiceNumber || '',
            pnr: p.pnr || t.pnr || '',
            buyRefund: buyAmt,
            sellRefund: sellAmt,
            airlineRefund: buyAmt,
            companyRefund: sellAmt,
            airlinePenalty: 0,
            agencyRetention: 0,
          };
        })
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
          sellRefund: origSell,
          airlineRefund: origBuy,
          companyRefund: origSell,
          airlinePenalty: 0,
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

  // Bulk Apply Airline & Company Refund Amounts
  const handleApplyBulkAmounts = () => {
    const airlineRefVal = parseCleanNumber(bulkAirlineRefund);
    const companyRefVal = parseCleanNumber(bulkCompanyRefund);

    if (airlineRefVal === 0 && companyRefVal === 0) {
      showErrorNotification(
        isAr ? 'تنبيه' : 'Alert',
        isAr ? 'يرجى إدخال مبلغ استرجاع الطيران أو استرجاع الشركة لتطبيقه.' : 'Please enter airline or company refund amount.'
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
    const airlineRefVal = parseCleanNumber(bulkAirlineRefund);
    const companyRefVal = parseCleanNumber(bulkCompanyRefund);

    setPassengers((prev) =>
      prev.map((p) => {
        if (!p.selected) return p;
        const isChildOrInfant = p.type === 'CHILD' || p.type === 'INFANT';
        if (!includeChildren && isChildOrInfant) return p;

        return {
          ...p,
          airlineRefund: airlineRefVal > 0 ? airlineRefVal : p.airlineRefund,
          companyRefund: companyRefVal > 0 ? companyRefVal : p.companyRefund,
        };
      })
    );

    setChildWarningModalOpen(false);
    showSuccessNotification(
      isAr ? 'تم تطبيق المبالغ' : 'Applied',
      includeChildren
        ? (isAr ? 'تم تطبيق مبالغ الاسترجاع المحددة على جميع المسافرين المختارين بنجاح.' : 'Applied refund amounts to all selected passengers.')
        : (isAr ? 'تم تطبيق المبالغ على المسافرين البالغين فقط واستثناء الأطفال.' : 'Applied refund amounts to adults only.')
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

  // Employee options for Combobox
  const employeeOptions: ComboboxOption[] = useMemo(() => {
    return employees.map((e) => {
      const label = e.fullName || e.username || (e as any).name || '';
      return {
        value: label,
        label: label,
        subtitle: e.jobTitle || e.departmentName || undefined,
      };
    });
  }, [employees]);

  // Handle Refund Type Change (Full vs With Penalty)
  const handleRefundTypeChange = (type: 'FULL' | 'WITH_PENALTY') => {
    setRefundType(type);
    if (type === 'FULL') {
      setPassengers((prev) =>
        prev.map((p) => ({
          ...p,
          airlineRefund: p.buyRefund,
          companyRefund: p.sellRefund,
          airlinePenalty: 0,
          agencyRetention: 0,
        }))
      );
      setBulkAirlineRefund('');
      setBulkCompanyRefund('');
    }
  };

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
        sellRefund: 0,
        airlineRefund: 0,
        companyRefund: 0,
        airlinePenalty: 0,
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
    if (totalCompanyRefund < 0) {
      showErrorNotification(isAr ? 'مبلغ الاسترجاع غير صحيح' : 'Invalid refund amount', isAr ? 'يجب أن يكون المبلغ المسترجع للعميل أكبر من أو يساوي صفر.' : 'The customer refund must be valid.');
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
        totalSell: -Math.abs(totalCompanyRefund),
        totalBuy: isSupplierRefunded ? -Math.abs(totalAirlineRefund) : 0,
        netSell: -Math.abs(totalNetRefundToCustomer),
        netBuy: isSupplierRefunded ? -Math.abs(totalNetBuyReturn) : 0,
        profit: totalRealizedProfit,
        transferImage: attachments[0]?.url || undefined,
        notes: `[استرجاع ${activePassengers.length} مسافر] استرجاع طيران: ${totalAirlineRefund} ${currency} | استرجاع شركة: ${totalCompanyRefund} ${currency} | ربح: ${totalRealizedProfit} ${currency} | ${notes || ''}`,
        reference: originalReference,
        status: 'REFUNDED',
        passengers: activePassengers.map((p) => ({
          name: p.name.trim(),
          ticketType: p.type || 'ADULT',
          ticketNumber: p.ticketNumber || undefined,
          pnr: p.pnr || pnr || undefined,
          fareBuy: -Math.abs(p.airlineRefund !== undefined ? p.airlineRefund : p.buyRefund),
          fareSell: -Math.abs(p.companyRefund !== undefined ? p.companyRefund : p.sellRefund),
          tax1: Math.max(0, (p.buyRefund || 0) - (p.airlineRefund || 0)),
          charge: (p.airlineRefund || 0) - (p.companyRefund || 0),
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
      {/* ── 1. Top Global Command Bar (Clean 56px/60px Height) ── */}
      <header className="min-h-[56px] sm:h-[60px] bg-white border-b border-[#E5E7EB] px-4 sm:px-6 flex items-center justify-between shrink-0 shadow-2xs z-20 font-sans">
        
        {/* Leading Side: Close, Icon, Title, Badge */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          <Tooltip label={isAr ? 'إغلاق ومغادرة' : 'Close Workspace'} position="bottom" withArrow>
            <button
              type="button"
              onClick={onClose}
              className="w-8.5 h-8.5 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            >
              {direction === 'rtl' ? <ArrowRight size={18} /> : <ArrowLeft size={18} />}
            </button>
          </Tooltip>

          <div className="w-8.5 h-8.5 rounded-lg bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center font-bold shrink-0">
            <RotateCcw size={18} strokeWidth={2.2} />
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-bold text-[15px] sm:text-[18px] text-[#111827] leading-tight truncate">
              {isAr ? 'فاتورة استرجاع تذكرة' : 'Ticket Refund Invoice'}
            </h2>
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono font-bold text-[11px] sm:text-xs border border-slate-200 shrink-0 select-all" dir="ltr">
              {refundNumber || 'REF-NEW'}
            </span>
          </div>
        </div>

        {/* Trailing Side: 3-Dots Action Menu (Matching Ticket Invoice Workspace) */}
        <div className="flex items-center gap-2 shrink-0">
          <Menu position="bottom-end" shadow="sm" radius="md">
            <Menu.Target>
              <ActionIcon variant="default" size="md" radius="md" className="border-slate-200 text-slate-600 h-8.5 w-8.5 cursor-pointer hover:bg-slate-50">
                <MoreVertical size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown className="p-1 text-xs font-medium" dir={direction}>
              <Menu.Item
                leftSection={<History size={14} className="text-blue-600" />}
                onClick={() => setAuditLogOpen(true)}
              >
                {isAr ? 'سجل التدقيق والتعديلات' : 'Audit Trail History'}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>

      </header>

      {/* ── 2. Scrollable Workspace Body Canvas ── */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden p-3.5 sm:p-5 md:p-6 max-w-[1760px] mx-auto w-full pb-28 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* ── 2-COLUMN MAIN LAYOUT (Fluid Stack on Mobile, 360px Sticky Sidebar on Desktop) ── */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
          
          {/* ── MAIN LEADING COLUMN ── */}
          <div className="space-y-4 min-w-0">
            
            {/* ── A. Fast Ticket Lookup Bar / Mode Switcher ── */}
            <div className="p-4 bg-white rounded-[14px] border border-[#E5E7EB] shadow-2xs space-y-3 font-sans">
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
                    className={`w-full h-[44px] ${direction === 'rtl' ? 'pr-11 pl-3.5' : 'pl-11 pr-3.5'} rounded-[10px] bg-[#FFFDF9] border border-[#FED7AA] text-[13px] text-[#111827] placeholder-[#9CA3AF] outline-none hover:border-[#F45A0A] focus:border-2 focus:border-[#F45A0A] transition-colors`}
                  />

                  {filteredSearchTickets.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white rounded-[14px] shadow-xl border border-slate-200 overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto">
                      {filteredSearchTickets.map((t) => (
                        <button
                          key={t.id || t.invoiceNumber}
                          type="button"
                          onClick={() => handleSelectTicket(t)}
                          className="w-full p-3.5 text-right hover:bg-[#FFF3E8]/80 transition-colors flex items-center justify-between text-xs cursor-pointer"
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
                <div className="p-3 rounded-[10px] bg-[#FFF3E8]/70 border border-[#FED7AA] text-xs flex items-center justify-between flex-wrap gap-2 text-slate-800 font-medium">
                  <div className="flex items-center gap-2.5">
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

            {/* ── B. Main Metadata Form Grid ── */}
            <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-4 sm:p-5 shadow-2xs space-y-4 font-sans">
              {/* Header with Title, Refund Type Switcher, and Currency */}
              <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center font-bold text-xs shrink-0">
                    <Plane size={16} />
                  </div>
                  <div>
                    <h3 className="font-bold text-[15px] text-[#111827] leading-tight">
                      {isAr ? 'بيانات التذكرة ونوع الاسترجاع' : 'Ticket & Refund Details'}
                    </h3>
                    <span className="text-[11px] text-[#6B7280]">
                      {isAr ? 'حدد نوع الاسترجاع، التواريخ، وموظف العملية' : 'Refund type, dates, and issuing staff'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Refund Type Switcher (استرجاع كامل vs استرجاع بغرامة) */}
                  <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-[10px] border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-600 px-1">
                      {isAr ? 'نوع الاسترجاع:' : 'Type:'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRefundTypeChange('FULL')}
                      className={`h-[30px] px-3 rounded-[7px] text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                        refundType === 'FULL'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-200/70'
                      }`}
                    >
                      <Check size={13} strokeWidth={2.4} />
                      <span>{isAr ? 'استرجاع كامل (100%)' : 'Full Refund (100%)'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRefundTypeChange('WITH_PENALTY')}
                      className={`h-[30px] px-3 rounded-[7px] text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                        refundType === 'WITH_PENALTY'
                          ? 'bg-[#F45A0A] text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-200/70'
                      }`}
                    >
                      <Coins size={13} />
                      <span>{isAr ? 'استرجاع بغرامة' : 'With Penalty'}</span>
                    </button>
                  </div>

                  {/* Currency Switcher */}
                  <div className="h-[36px] p-0.5 rounded-[9px] bg-slate-100 border border-slate-200 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setCurrency('IQD');
                        setExchangeRate(1);
                      }}
                      className={`h-full px-2.5 rounded-[7px] text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
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
                      className={`h-full px-2.5 rounded-[7px] text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                        currency === 'USD'
                          ? 'bg-[#F45A0A] text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-200/60'
                      }`}
                    >
                      <span>$ USD</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {/* Refund Date with SegmentedDatePicker */}
                <div>
                  <label className="text-[12px] font-semibold text-[#334155] block mb-1">
                    {isAr ? 'تاريخ الاسترجاع' : 'Refund Date'}
                  </label>
                  <SegmentedDatePicker
                    value={issueDate}
                    onChange={(d) => d && setIssueDate(d)}
                  />
                </div>

                {/* Airline Selector */}
                <div>
                  <label className="text-[12px] font-semibold text-[#334155] block mb-1">
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
                  <label className="text-[12px] font-semibold text-[#334155] block mb-1">
                    {isAr ? 'كود الحجز PNR *' : 'PNR Code *'}
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    placeholder="e.g. PRMCK"
                    value={pnr}
                    onChange={(e) => setPnr(e.target.value.toUpperCase())}
                    style={{ fontFamily: "'JetBrains Mono', 'Consolas', 'Roboto', monospace" }}
                    className="w-full h-[40px] px-3.5 rounded-[9px] bg-[#FAFAFA] border border-[#E5E7EB] text-[13px] font-mono font-bold text-[#111827] uppercase outline-none hover:border-[#D1D5DB] focus:border-2 focus:border-[#F45A0A] transition-colors"
                  />
                </div>

                {/* Customer Account */}
                <div>
                  <label className="text-[12px] font-semibold text-[#334155] block mb-1">
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
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="text-[12px] font-semibold text-[#334155]">
                      {isAr ? 'المورد / جهة الإصدار' : 'Supplier Account'}
                    </label>
                    <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5">
                      <span className={`text-[10px] font-extrabold ${isSupplierRefunded ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {isSupplierRefunded ? (isAr ? 'أرجع المورد' : 'Refunded') : (isAr ? 'لم يرجع' : 'Not refunded')}
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

                {/* Issuer Employee: Compact Dropdown */}
                <div>
                  <label className="text-[12px] font-semibold text-[#334155] block mb-1">
                    {isAr ? 'موظف الاسترجاع *' : 'Refund Employee *'}
                  </label>
                  <div className="w-full max-w-[240px]">
                    <SearchableCombobox
                      options={employeeOptions}
                      value={employeeName}
                      onChange={(val) => setEmployeeName(val || '')}
                      placeholder={isAr ? 'اختر موظف الاسترجاع' : 'Select employee'}
                      allowCustomValue
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ── C. Dedicated Multi-Passenger Refund Table (Simple, Clear & Intuitive) ── */}
            <div className="bg-white rounded-[14px] border border-[#E5E7EB] shadow-2xs overflow-hidden font-sans">
              
              {/* Table Top Header with Clean Bulk Quick-Apply Bar */}
              <div className="p-3.5 bg-[#F8FAFC] border-b border-[#E5E7EB] flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-[9px] bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center font-bold shrink-0">
                    <Users size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-[14px] text-[#111827]">
                      {isAr ? 'تحديد المسافرين واحتساب الفروقات والخصومات' : 'Passenger Refunds & Deductions'}
                    </h3>
                    <p className="text-[11.5px] text-slate-500">
                      {refundType === 'FULL'
                        ? (isAr ? 'استرجاع كامل: تم تصفير كافة الخصومات تلقائياً.' : 'Full refund: all deductions zeroed out.')
                        : (isAr ? 'أدخل غرامة الطيران أو استقطاع الشركة لتحديث صافي المبلغ للعميل فورياً.' : 'Enter airline penalties or company retention.')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Add Passenger Button */}
                  <button
                    type="button"
                    onClick={handleAddPassenger}
                    className="h-[36px] px-3.5 rounded-[9px] bg-white border border-[#FED7AA] hover:bg-[#FFF3E8] text-[#F45A0A] font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  >
                    <Plus size={14} strokeWidth={2.4} />
                    <span>{isAr ? 'إضافة مسافر' : 'Add Passenger'}</span>
                  </button>

                  {/* Clean Quick Bulk Applicator (Only active if WITH_PENALTY) */}
                  {refundType === 'WITH_PENALTY' && (
                    <div className="flex items-center gap-2 flex-wrap bg-white p-1 rounded-[10px] border border-slate-200 shadow-2xs">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700 px-1">
                        <Sparkles size={14} className="text-[#F45A0A]" />
                        <span>{isAr ? `تطبيق موحد (${activePassengers.length}):` : `Bulk Apply:`}</span>
                      </div>

                      {/* Bulk Airline Refund */}
                      <div className="flex items-center gap-1.5 bg-[#FFF5F5] border border-rose-200 px-2 py-0.5 rounded-[7px]">
                        <span className="text-[11px] font-bold text-rose-700">{isAr ? 'استرجاع الطيران:' : 'Airline Refund:'}</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          dir="ltr"
                          placeholder="0"
                          value={bulkAirlineRefund}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
                            const clean = raw.replace(/[٠-٩]/g, (d) => arabicDigits.indexOf(d).toString()).replace(/[^0-9]/g, '');
                            setBulkAirlineRefund(clean);
                          }}
                          style={{ fontFamily: "'JetBrains Mono', 'Consolas', 'Roboto', monospace" }}
                          className="w-28 h-[26px] px-2 text-center bg-white border border-rose-200 rounded font-mono font-bold text-xs text-rose-800 outline-none"
                        />
                      </div>

                      {/* Bulk Company Refund */}
                      <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-[7px]">
                        <span className="text-[11px] font-bold text-emerald-800">{isAr ? 'استرجاع الشركة:' : 'Company Refund:'}</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          dir="ltr"
                          placeholder="0"
                          value={bulkCompanyRefund}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
                            const clean = raw.replace(/[٠-٩]/g, (d) => arabicDigits.indexOf(d).toString()).replace(/[^0-9]/g, '');
                            setBulkCompanyRefund(clean);
                          }}
                          style={{ fontFamily: "'JetBrains Mono', 'Consolas', 'Roboto', monospace" }}
                          className="w-28 h-[26px] px-2 text-center bg-white border border-emerald-200 rounded font-mono font-bold text-xs text-emerald-800 outline-none"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleApplyBulkAmounts}
                        className="h-[28px] px-3 rounded-[7px] bg-slate-800 hover:bg-black text-white font-bold text-[11px] transition-colors cursor-pointer shadow-2xs"
                      >
                        {isAr ? 'تطبيق' : 'Apply'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Table Body */}
              <div className="overflow-x-auto">
                <table className={`w-full text-${direction === 'rtl' ? 'right' : 'left'} border-collapse text-xs`}>
                  <thead>
                    <tr className="bg-[#F8FAFC] border-b border-[#E5E7EB] text-[#475569] font-bold select-none h-[42px]">
                      <th className="p-2.5 text-center w-10">
                        <Checkbox
                          checked={passengers.length > 0 && passengers.every((p) => p.selected)}
                          indeterminate={passengers.some((p) => p.selected) && !passengers.every((p) => p.selected)}
                          onChange={(e) => {
                            const val = e.currentTarget.checked;
                            setPassengers((prev) => prev.map((p) => ({ ...p, selected: val })));
                          }}
                          color="orange"
                          size="xs"
                        />
                      </th>
                      <th className="p-2.5 whitespace-nowrap">{isAr ? 'اسم المسافر والنوع' : 'Passenger & Type'}</th>
                      <th className="p-2.5 whitespace-nowrap">{isAr ? 'رقم التذكرة / PNR' : 'Ticket / PNR'}</th>
                      <th className="p-2.5 whitespace-nowrap text-left">{isAr ? 'مسترجع الشراء (الأساس)' : 'Buy Refund'}</th>
                      <th className="p-2.5 whitespace-nowrap text-left">{isAr ? 'مسترجع البيع (الأساس)' : 'Sell Refund'}</th>
                      <th className="p-2.5 whitespace-nowrap text-left text-rose-700 bg-rose-50/40">{isAr ? 'استرجاع الطيران' : 'Airline Refund'}</th>
                      <th className="p-2.5 whitespace-nowrap text-left text-emerald-800 bg-emerald-50/40">{isAr ? 'استرجاع الشركة (العميل)' : 'Company Refund'}</th>
                      <th className="p-2.5 whitespace-nowrap text-left text-[#F45A0A]">{isAr ? 'الصافي للعميل' : 'Net to Customer'}</th>
                      <th className="p-2.5 whitespace-nowrap text-left text-emerald-700">{isAr ? 'الربح المحقق' : 'Profit'}</th>
                      <th className="p-2.5 text-center w-10">{isAr ? 'حذف' : 'Del'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {passengers.map((p, idx) => {
                      const pAirlineRef = p.airlineRefund !== undefined ? p.airlineRefund : p.buyRefund;
                      const pCompanyRef = p.companyRefund !== undefined ? p.companyRefund : p.sellRefund;
                      const netSell = pCompanyRef;
                      const profit = pAirlineRef - pCompanyRef;

                      return (
                        <tr
                          key={p.id}
                          className={`transition-colors ${
                            p.selected ? 'bg-white hover:bg-orange-50/30' : 'bg-slate-50/60 opacity-60'
                          }`}
                        >
                          {/* Selection Checkbox */}
                          <td className="p-2.5 text-center">
                            <Checkbox
                              checked={p.selected}
                              onChange={(e) => updatePassenger(p.id, 'selected', e.currentTarget.checked)}
                              color="orange"
                              size="xs"
                            />
                          </td>

                          {/* Passenger Name & Type */}
                          <td className="p-2.5">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder={isAr ? 'اسم المسافر...' : 'Passenger name...'}
                                value={p.name}
                                onChange={(e) => updatePassenger(p.id, 'name', e.target.value)}
                                className="h-[36px] px-2.5 rounded-[8px] bg-[#FAFAFA] border border-[#E5E7EB] text-xs font-semibold text-slate-900 outline-none hover:border-slate-300 focus:border-2 focus:border-[#F45A0A] w-full min-w-[140px]"
                              />
                              <Select
                                value={p.type || 'ADULT'}
                                onChange={(val) => updatePassenger(p.id, 'type', val || 'ADULT')}
                                data={[
                                  { value: 'ADULT', label: isAr ? 'بالغ' : 'Adult' },
                                  { value: 'CHILD', label: isAr ? 'طفل' : 'Child' },
                                  { value: 'INFANT', label: isAr ? 'رضيع' : 'Infant' },
                                ]}
                                size="xs"
                                className="w-20 shrink-0"
                                comboboxProps={{ withinPortal: true, zIndex: 9999 }}
                              />
                            </div>
                          </td>

                          {/* Ticket Number & PNR */}
                          <td className="p-2.5">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                dir="ltr"
                                placeholder="Ticket #"
                                value={p.ticketNumber}
                                onChange={(e) => updatePassenger(p.id, 'ticketNumber', e.target.value)}
                                style={{ fontFamily: "'JetBrains Mono', 'Consolas', 'Roboto', monospace" }}
                                className="h-[36px] px-2 rounded-[8px] bg-[#FAFAFA] border border-[#E5E7EB] text-xs font-mono font-bold text-slate-800 outline-none w-28"
                              />
                              <input
                                type="text"
                                dir="ltr"
                                placeholder="PNR"
                                value={p.pnr || ''}
                                onChange={(e) => updatePassenger(p.id, 'pnr', e.target.value.toUpperCase())}
                                style={{ fontFamily: "'JetBrains Mono', 'Consolas', 'Roboto', monospace" }}
                                className="h-[36px] px-1.5 text-center uppercase rounded-[8px] bg-[#FAFAFA] border border-[#E5E7EB] text-xs font-mono font-bold text-slate-800 outline-none w-16"
                              />
                            </div>
                          </td>

                          {/* Buy Refund (Cost from Supplier) */}
                          <td className="p-2.5 text-left">
                            <input
                              type="text"
                              inputMode="numeric"
                              dir="ltr"
                              value={p.buyRefund ? p.buyRefund.toLocaleString('en-US') : ''}
                              onChange={(e) => updatePassenger(p.id, 'buyRefund', parseCleanNumber(e.target.value))}
                              style={{ fontFamily: "'JetBrains Mono', 'Consolas', 'Roboto', monospace" }}
                              className="w-24 h-[36px] px-2.5 rounded-[8px] border border-slate-200 text-xs font-mono font-bold text-slate-900 text-left outline-none hover:border-slate-400 focus:border-2 focus:border-[#F45A0A] bg-white"
                            />
                          </td>

                          {/* Sell Refund (Original Sell Price) */}
                          <td className="p-2.5 text-left">
                            <input
                              type="text"
                              inputMode="numeric"
                              dir="ltr"
                              value={p.sellRefund ? p.sellRefund.toLocaleString('en-US') : ''}
                              onChange={(e) => updatePassenger(p.id, 'sellRefund', parseCleanNumber(e.target.value))}
                              style={{ fontFamily: "'JetBrains Mono', 'Consolas', 'Roboto', monospace" }}
                              className="w-24 h-[36px] px-2.5 rounded-[8px] border border-slate-200 text-xs font-mono font-bold text-slate-900 text-left outline-none hover:border-slate-400 focus:border-2 focus:border-[#F45A0A] bg-white"
                            />
                          </td>

                          {/* Airline Refund (What Airline Returns) */}
                          <td className="p-2.5 text-left bg-rose-50/20">
                            <input
                              type="text"
                              inputMode="numeric"
                              dir="ltr"
                              disabled={refundType === 'FULL'}
                              placeholder="0"
                              value={p.airlineRefund !== undefined ? (p.airlineRefund ? p.airlineRefund.toLocaleString('en-US') : '0') : (p.buyRefund ? p.buyRefund.toLocaleString('en-US') : '0')}
                              onChange={(e) => updatePassenger(p.id, 'airlineRefund', parseCleanNumber(e.target.value))}
                              style={{ fontFamily: "'JetBrains Mono', 'Consolas', 'Roboto', monospace" }}
                              className={`w-32 h-[36px] px-2.5 rounded-[8px] border border-rose-200 text-xs font-mono font-bold text-rose-800 text-left outline-none hover:border-rose-400 focus:border-2 focus:border-rose-500 bg-rose-50/40 ${
                                refundType === 'FULL' ? 'opacity-50 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400' : ''
                              }`}
                            />
                          </td>

                          {/* Company Refund to Customer */}
                          <td className="p-2.5 text-left bg-emerald-50/20">
                            <input
                              type="text"
                              inputMode="numeric"
                              dir="ltr"
                              disabled={refundType === 'FULL'}
                              placeholder="0"
                              value={p.companyRefund !== undefined ? (p.companyRefund ? p.companyRefund.toLocaleString('en-US') : '0') : (p.sellRefund ? p.sellRefund.toLocaleString('en-US') : '0')}
                              onChange={(e) => updatePassenger(p.id, 'companyRefund', parseCleanNumber(e.target.value))}
                              style={{ fontFamily: "'JetBrains Mono', 'Consolas', 'Roboto', monospace" }}
                              className={`w-32 h-[36px] px-2.5 rounded-[8px] border border-emerald-200 text-xs font-mono font-bold text-emerald-800 text-left outline-none hover:border-emerald-400 focus:border-2 focus:border-emerald-500 bg-emerald-50/40 ${
                                refundType === 'FULL' ? 'opacity-50 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400' : ''
                              }`}
                            />
                          </td>

                          {/* Net Customer */}
                          <td className="p-2.5 text-left font-mono font-black text-[#F45A0A] text-[13px] tabular-nums" dir="ltr">
                            {formatNumberEnglish(netSell)}
                          </td>

                          {/* Profit = Airline Refund - Company Refund */}
                          <td className="p-2.5 text-left font-mono font-bold text-[#078B61] text-[13px] tabular-nums" dir="ltr">
                            {profit > 0 ? `+${formatNumberEnglish(profit)}` : formatNumberEnglish(profit)}
                          </td>

                          {/* Delete */}
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemovePassenger(p.id)}
                              className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center mx-auto transition-colors cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer Count */}
              <div className="p-2.5 bg-[#F8FAFC] border-t border-[#E5E7EB] flex items-center justify-between">
                <span className="text-[11.5px] font-bold text-slate-600">
                  {isAr ? `إجمالي المسافرين المحددين للاسترجاع: ${activePassengers.length} من أصل ${passengers.length}` : `Selected for refund: ${activePassengers.length} of ${passengers.length}`}
                </span>
              </div>
            </div>

            {/* ── E. Remarks & Notes Section (Clean Full-Width Box) ── */}
            <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-4 sm:p-5 space-y-3 shadow-2xs font-sans">
              <h3 className="font-bold text-[13.5px] text-[#111827] flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <Receipt size={16} className="text-[#F45A0A]" />
                <span>{isAr ? 'ملاحظات وتفاصيل الاسترجاع' : 'Refund Remarks & Notes'}</span>
              </h3>

              <div className="space-y-3">
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={isAr ? 'أسباب الاسترجاع، تفاصيل التذكرة، توجيهات...' : 'Refund reason, policy notes...'}
                  className="w-full p-2.5 rounded-[8px] bg-[#FAFAFA] border border-[#E5E7EB] text-xs font-medium text-[#111827] outline-none hover:border-[#D1D5DB] focus:border-2 focus:border-[#F45A0A] transition-colors"
                />

                <div className="p-2.5 rounded-[8px] bg-[#F8FAFC] border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2">
                  <ShieldCheck size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    {isAr
                      ? 'سيقوم النظام بتوليد قيد اليومية المزدوج، وتحديث أرصدة العملاء والموردين تلقائياً.'
                      : 'Automatic double-entry journal vouchers will be generated and account balances updated instantly.'}
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* ── STICKY SIDEBAR (360px) - Match Ticket Invoice Style ── */}
          <div className="xl:sticky xl:top-0 space-y-4 font-sans">
            <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-4 sm:p-5 space-y-4">
              
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center font-bold shrink-0">
                    <TrendingUp size={16} strokeWidth={2} />
                  </div>
                  <div>
                    <h4 className="font-bold text-[15px] text-[#111827] leading-tight">
                      {isAr ? 'الملخص المالي للاسترجاع' : 'Financial Summary'}
                    </h4>
                    <span className="text-[11px] text-[#6B7280]">
                      {isAr ? 'الصافي والأرباح والغرامات' : 'Net refund, profit & penalties'}
                    </span>
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono font-bold text-[11px]">
                  {currency}
                </span>
              </div>

              {/* KPI Breakdown List */}
              <div className="space-y-2.5">
                {/* 1. Airline Refund (What Supplier/Airline returns) */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[12px] font-semibold text-slate-700">
                    {isAr ? 'استرجاع الطيران (المورد)' : 'Airline Refund (Supplier)'}
                  </span>
                  <span className="font-mono font-bold text-slate-900 text-sm tabular-nums" dir="ltr">
                    {formatNumberEnglish(isSupplierRefunded ? totalAirlineRefund : 0)} <span className="text-[10px] text-slate-400 font-sans">{currency}</span>
                  </span>
                </div>

                {/* 2. Company Refund to Customer */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100">
                  <span className="text-[12px] font-semibold text-emerald-800">
                    {isAr ? 'استرجاع الشركة (للعميل)' : 'Company Refund (Customer)'}
                  </span>
                  <span className="font-mono font-bold text-emerald-800 text-sm tabular-nums" dir="ltr">
                    {formatNumberEnglish(totalCompanyRefund)} <span className="text-[10px] text-emerald-500 font-sans">{currency}</span>
                  </span>
                </div>

                {/* 3. Realized Profit (Difference between Airline and Company Refund) */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[12px] font-bold text-emerald-900">
                    {isAr ? 'صافي ربح الاسترجاع (+)' : 'Realized Profit (+)'}
                  </span>
                  <span className="font-mono font-black text-emerald-700 text-sm tabular-nums" dir="ltr">
                    {totalRealizedProfit > 0 ? `+${formatNumberEnglish(totalRealizedProfit)}` : formatNumberEnglish(totalRealizedProfit)} <span className="text-[10px] text-emerald-600 font-sans">{currency}</span>
                  </span>
                </div>

                {/* Divider */}
                <div className="border-t border-dashed border-slate-200 my-1" />

                {/* 4. Net Refund to Customer (Prominent Big Hero Card) */}
                <div className="p-3.5 rounded-xl bg-[#FFF3E8] border border-[#FFD8B2] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#F45A0A]">
                      {isAr ? 'الصافي المستحق للعميل' : 'Net Paid to Customer'}
                    </span>
                    <span className="text-[10.5px] font-mono text-orange-600 font-bold">
                      ({activePassengers.length} {isAr ? 'مسافر' : 'pax'})
                    </span>
                  </div>
                  <div className="text-2xl font-black font-mono text-[#F45A0A] tabular-nums" dir="ltr">
                    {formatNumberEnglish(totalCompanyRefund)} <span className="text-xs font-sans font-bold text-[#F45A0A]">{currency}</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {isAr
                      ? `استرجاع الطيران (${formatNumberEnglish(totalAirlineRefund)}) - ربح الوكالة (${formatNumberEnglish(totalRealizedProfit)})`
                      : `Airline Refund (${formatNumberEnglish(totalAirlineRefund)}) - Profit (${formatNumberEnglish(totalRealizedProfit)})`}
                  </div>
                </div>

                {/* 5. Net from Supplier */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                  <span className="text-slate-500 font-medium">
                    {isAr ? 'صافي الاسترداد من المورد:' : 'Net from supplier:'}
                  </span>
                  <span className="font-mono font-bold text-slate-800 tabular-nums" dir="ltr">
                    {formatNumberEnglish(totalNetBuyReturn)} {currency}
                  </span>
                </div>
              </div>

              {/* Action Buttons in Sidebar */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSaveRefund}
                  className="w-full h-[44px] rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] active:scale-[0.98] text-white font-bold text-[13.5px] shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Check size={18} strokeWidth={2.4} />
                  <span>{isAr ? 'حفظ وترحيل الاسترجاع' : 'Save & Post Refund'}</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full h-[38px] rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                >
                  {isAr ? 'إلغاء ومغادرة' : 'Cancel'}
                </button>
              </div>

            </div>
          </div>

        </div>

      </div>

      {/* ── 3. Bottom Slim Sticky Bar ── */}
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
              <span className="text-slate-400 font-sans">{isAr ? 'استرجاع الطيران: ' : 'Airline: '}</span>
              <span className="font-bold text-slate-800">{formatNumberEnglish(isSupplierRefunded ? totalAirlineRefund : 0)}</span>
            </div>
            <div>
              <span className="text-slate-400 font-sans">{isAr ? 'استرجاع الشركة: ' : 'Company: '}</span>
              <span className="font-bold text-slate-800">{formatNumberEnglish(totalCompanyRefund)}</span>
            </div>
            <div>
              <span className="text-slate-400 font-sans">{isAr ? 'الربح المحقق: ' : 'Profit: '}</span>
              <span className="font-bold text-emerald-700">{totalRealizedProfit > 0 ? `+${formatNumberEnglish(totalRealizedProfit)}` : formatNumberEnglish(totalRealizedProfit)}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-orange-50 border border-orange-200">
            <span className="text-[#F45A0A] font-bold font-sans text-xs">{isAr ? 'الصافي للعميل: ' : 'Net Customer: '}</span>
            <span className="font-black font-mono text-sm text-[#F45A0A]" dir="ltr">
              {formatNumberEnglish(totalCompanyRefund)} <span className="text-[11px] font-sans font-bold">{currency}</span>
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
