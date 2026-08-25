import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Modal, Menu, Tooltip } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  Scale,
  Printer,
  FileSpreadsheet,
  Building,
  RefreshCw,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  FileText,
  Calendar,
  ChevronDown,
  Check,
  MoreHorizontal,
  ExternalLink,
  Search,
  ArrowLeft,
  Info,
  Layers,
  ArrowUpRight,
  Plus,
  Sparkles,
  Receipt,
  Coins,
  Wallet,
  PlusCircle,
  X,
  FolderPlus,
  ListFilter,
  SlidersHorizontal,
  BookmarkPlus
} from 'lucide-react';
import { ticketsApi } from '../api/tickets';
import { hotelsApi } from '../api/hotels';
import { accountsApi } from '../api/accounts';
import { type AccountNode } from '../components/common/AccountingTreeGrid';
import { journalEntriesApi } from '../api/journalEntries';
import { branchesApi, type Branch } from '../api/branches';
import { apiRequest } from '../api/client';
import { CurrencySegmentedControl } from '../components/ui/CurrencySegmentedControl';
import { SearchableCombobox, type ComboboxOption } from '../components/ui/SearchableCombobox';
import { SmartAccountWizardModal } from '../components/accounts/SmartAccountWizardModal';
import { showSuccessNotification } from '../utils/notifications';
import { useLanguageStore } from '../store/useLanguageStore';

export interface CustomIncludedAccount {
  accountId: string;
  section: 'OPERATING_REVENUE' | 'DIRECT_COST' | 'INCIDENTAL_REVENUE' | 'OPERATING_EXPENSE';
}

export interface StatementAccountRowItem {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  amountIQD: number;
  amountUSD: number;
  section: 'OPERATING_REVENUE' | 'DIRECT_COST' | 'INCIDENTAL_REVENUE' | 'OPERATING_EXPENSE';
  isCustomPinned?: boolean;
  linesCount: number;
  lines: DrilldownItem[];
}

interface FinancialViewModel {
  grossRevenueIQD: number;
  grossRevenueUSD: number;
  salesReturnsIQD: number;
  salesReturnsUSD: number;
  refundServiceRevenueIQD: number;
  refundServiceRevenueUSD: number;
  netOperatingRevenueIQD: number;
  netOperatingRevenueUSD: number;
  customOperatingRevenues: StatementAccountRowItem[];
  grossDirectCostIQD: number;
  grossDirectCostUSD: number;
  purchaseReturnsIQD: number;
  purchaseReturnsUSD: number;
  netDirectCostIQD: number;
  netDirectCostUSD: number;
  customDirectCosts: StatementAccountRowItem[];
  grossProfitIQD: number;
  grossProfitUSD: number;
  totalIncidentalRevenuesIQD: number;
  totalIncidentalRevenuesUSD: number;
  incidentalBreakdown: StatementAccountRowItem[];
  operatingExpensesIQD: number;
  operatingExpensesUSD: number;
  detailedOperatingExpenses: StatementAccountRowItem[];
  netProfitIQD: number;
  netProfitUSD: number;
  profitMarginIQD: number;
  profitMarginUSD: number;
  breakdown: Record<string, {
    titleAr: string;
    titleEn: string;
    count: number;
    salesIQD: number;
    costIQD: number;
    profitIQD: number;
    salesUSD: number;
    costUSD: number;
    profitUSD: number;
  }>;
}

interface DrilldownItem {
  id: string;
  refNumber: string;
  date: string;
  partnerName: string;
  serviceType: string;
  amountIQD: number;
  amountUSD: number;
  currency: string;
  status?: string;
  passengerOrNotes?: string;
}

interface DrilldownModalState {
  code: string;
  title: string;
  amountIQD: number;
  amountUSD: number;
  explanation: string;
  targetRoute?: string;
  targetRouteLabel?: string;
  items: DrilldownItem[];
}

export const IncomeStatementPage: React.FC = () => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';
  const navigate = useNavigate();

  const [currency, setCurrency] = useState<'IQD' | 'USD' | 'ALL'>('ALL');
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => {
    return localStorage.getItem('active_branch_id') || 'ALL';
  });

  const [quickPreset, setQuickPreset] = useState<string>('YEAR');
  const [startDate, setStartDate] = useState<Date | null>(() => {
    const y = new Date().getFullYear();
    return new Date(y, 0, 1);
  });
  const [endDate, setEndDate] = useState<Date | null>(() => new Date());

  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Drilldown State
  const [drilldownModalOpen, setDrilldownModalOpen] = useState(false);
  const [drilldownData, setDrilldownData] = useState<DrilldownModalState | null>(null);
  const [drilldownSearchQuery, setDrilldownSearchQuery] = useState('');

  // Account Creation Wizard Modal State
  const [wizardModalOpen, setWizardModalOpen] = useState(false);

  // Include Existing Account from Tree Modal State
  const [includeAccountModalOpen, setIncludeAccountModalOpen] = useState(false);
  const [targetSectionForInclude, setTargetSectionForInclude] = useState<'OPERATING_REVENUE' | 'DIRECT_COST' | 'INCIDENTAL_REVENUE' | 'OPERATING_EXPENSE'>('INCIDENTAL_REVENUE');
  const [selectedAccountIdToInclude, setSelectedAccountIdToInclude] = useState<string>('');

  // Pinned/Custom Included Accounts from Chart of Accounts
  const [customIncludedAccounts, setCustomIncludedAccounts] = useState<CustomIncludedAccount[]>(() => {
    try {
      const saved = localStorage.getItem('income_statement_custom_accounts_v2');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [rawTickets, setRawTickets] = useState<any[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [allAccounts, setAllAccounts] = useState<AccountNode[]>([]);
  const [allJournalEntries, setAllJournalEntries] = useState<any[]>([]);
  const [expenseTransactions, setExpenseTransactions] = useState<any[]>([]);

  const statementContainerRef = useRef<HTMLDivElement>(null);

  const handleIncludeAccount = (accountId: string, section: CustomIncludedAccount['section']) => {
    if (!accountId) return;
    setCustomIncludedAccounts((prev) => {
      const filtered = prev.filter((item) => item.accountId !== accountId);
      const updated = [...filtered, { accountId, section }];
      localStorage.setItem('income_statement_custom_accounts_v2', JSON.stringify(updated));
      return updated;
    });
    setSelectedAccountIdToInclude('');
    setIncludeAccountModalOpen(false);
    showSuccessNotification(
      isAr ? 'تم تضمين الحساب في قائمة الدخل' : 'Account Included in Statement',
      isAr ? 'أصبح الحساب معروضاً ومحسوباً ضمن القسم المختار في التقرير.' : 'The account is now included and calculated in the selected section.'
    );
  };

  const handleRemoveCustomAccount = (accountId: string) => {
    setCustomIncludedAccounts((prev) => {
      const updated = prev.filter((item) => item.accountId !== accountId);
      localStorage.setItem('income_statement_custom_accounts_v2', JSON.stringify(updated));
      return updated;
    });
    showSuccessNotification(
      isAr ? 'تم إزالة الحساب من القائمة' : 'Account Removed',
      isAr ? 'تم إلغاء تثبيت الحساب من هذا القسم بنجاح.' : 'The account has been unpinned from this section.'
    );
  };

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [ticketsRes, hotelsRes, branchesRes, accountsRes, journalEntriesRes, vouchersRes] = await Promise.all([
        ticketsApi.getAll().catch(() => []),
        hotelsApi.getAll().catch(() => []),
        branchesApi.getAll().catch(() => []),
        accountsApi.getFlat().catch(() => []),
        journalEntriesApi.getAll().catch(() => []),
        apiRequest('/api/vouchers').catch(() => []),
      ]);

      const tList = Array.isArray(ticketsRes) ? ticketsRes : (ticketsRes as any)?.data || [];
      const hList = Array.isArray(hotelsRes) ? hotelsRes : (hotelsRes as any)?.data || [];
      const bList = Array.isArray(branchesRes) ? branchesRes : [];
      const accList = Array.isArray(accountsRes) ? accountsRes : [];
      const jeList = Array.isArray(journalEntriesRes) ? journalEntriesRes : (journalEntriesRes as any)?.data || [];
      const vList = Array.isArray(vouchersRes) ? vouchersRes : (vouchersRes as any)?.data || [];

      // Convert hotel bookings into standardized operational records
      const hotelItems = hList.map((h: any) => ({
        id: h.id || `htl-${h.invoiceNumber || Date.now()}`,
        invoiceNumber: h.invoiceNumber || 'HTL-2026',
        serviceType: 'HOTEL',
        tripType: 'HOTEL',
        flightType: 'HOTEL',
        airline: h.hotelName || (isAr ? 'حجز فندق' : 'Hotel Booking'),
        hotelName: h.hotelName,
        customerName: h.customerName || (isAr ? 'عميل حجز فندقي' : 'Hotel Client'),
        clientName: h.customerName,
        supplierName: h.supplierName || (isAr ? 'مورد فندق' : 'Hotel Supplier'),
        city: h.city || '',
        country: h.country || '',
        totalSell: Math.abs(Number(h.totalSale || h.totalSell || 0)),
        totalBuy: Math.abs(Number(h.totalCost || h.totalBuy || 0)),
        profit: Number(h.netProfit || h.profit || ((Number(h.totalSale || 0) - Number(h.totalCost || 0)))),
        currency: (h.currency || 'USD').toUpperCase().includes('USD') || (h.currency || '').includes('$') ? 'USD' : 'IQD',
        status: h.status || 'CONFIRMED',
        issueDate: h.issueDate || h.createdAt || new Date().toISOString().split('T')[0],
        createdAt: h.createdAt || h.issueDate,
        branchId: h.branchId,
        notes: h.notes,
      }));

      // Combine standard tickets and hotel booking invoices
      const combinedTickets = [...tList, ...hotelItems];

      setRawTickets(combinedTickets);
      setBranches(bList);
      setAllAccounts(accList);
      setAllJournalEntries(jeList);

      const expenses = vList
        .filter((v: any) => v.type === 'PAYMENT' || v.category === 'EXPENSE' || v.voucherType === 'PAYMENT')
        .map((v: any) => ({
          id: v.id || v.voucherNumber,
          date: v.date || v.createdAt,
          ref: v.voucherNumber || v.number || v.id,
          accountName: v.partnerName || v.expenseAccountName || v.accountName || (isAr ? 'مصروف عام' : 'Expense'),
          accountCode: v.accountCode || '32',
          description: v.notes || v.description || (isAr ? 'سند صرف مصروفات' : 'Payment voucher'),
          amountIQD: (v.currency || 'IQD').toUpperCase().includes('IQD') ? Number(v.amount || v.total || 0) : 0,
          amountUSD: (v.currency || '').toUpperCase().includes('USD') || (v.currency || '').includes('$') ? Number(v.amount || v.total || 0) : 0,
        }));
      setExpenseTransactions(expenses);
    } catch (err) {
      console.error('Failed to load income statement data:', err);
    } finally {
      setLoading(false);
    }
  }, [isAr]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleQuickPresetChange = (preset: string) => {
    setQuickPreset(preset);
    const now = new Date();
    const y = now.getFullYear();

    if (preset === 'YEAR') {
      setStartDate(new Date(y, 0, 1));
      setEndDate(new Date(y, 11, 31, 23, 59, 59));
    } else if (preset === 'MONTH') {
      setStartDate(new Date(y, now.getMonth(), 1));
      setEndDate(new Date(y, now.getMonth() + 1, 0, 23, 59, 59));
    } else if (preset === 'TODAY') {
      setStartDate(new Date(y, now.getMonth(), now.getDate()));
      setEndDate(new Date(y, now.getMonth(), now.getDate(), 23, 59, 59));
    } else if (preset === 'ALL') {
      setStartDate(null);
      setEndDate(null);
    }
  };

  const dateFilteredTickets = useMemo(() => {
    return rawTickets.filter((t: any) => {
      if (selectedBranchId !== 'ALL' && t.branchId && t.branchId !== selectedBranchId) {
        return false;
      }
      if (startDate || endDate) {
        const tDate = new Date(t.issueDate || t.createdAt || t.date);
        if (startDate && tDate < startDate) return false;
        if (endDate && tDate > new Date(endDate.getTime() + 86400000)) return false;
      }
      return true;
    });
  }, [rawTickets, selectedBranchId, startDate, endDate]);

  const dateFilteredJournalEntries = useMemo(() => {
    return allJournalEntries.filter((j: any) => {
      if (selectedBranchId !== 'ALL' && j.branchId && j.branchId !== selectedBranchId) {
        return false;
      }
      if (startDate || endDate) {
        const jDate = new Date(j.date || j.createdAt);
        if (startDate && jDate < startDate) return false;
        if (endDate && jDate > new Date(endDate.getTime() + 86400000)) return false;
      }
      return j.status === 'POSTED' || !j.status;
    });
  }, [allJournalEntries, selectedBranchId, startDate, endDate]);

  const isRefundTicket = useCallback((t: any) => {
    const inv = String(t.invoiceNumber || '').toUpperCase();
    const serv = String((t as any).serviceType || '').toUpperCase();
    const trip = String(t.tripType || '').toUpperCase();
    const status = String(t.status || '').toUpperCase();
    return (
      trip === 'REFUND' ||
      status === 'REFUNDED' ||
      inv.includes('REF') ||
      serv.includes('REFUND') ||
      serv.includes('استرجاع')
    );
  }, []);

  const isVisaTicket = useCallback((t: any) => {
    const inv = String(t.invoiceNumber || '').toUpperCase();
    const serv = String((t as any).serviceType || '').toUpperCase();
    const flt = String((t as any).flightType || '').toUpperCase();
    const air = String(t.airline || '').toUpperCase();
    const trip = String(t.tripType || '').toUpperCase();
    const notes = String(t.notes || '').toUpperCase();

    return (
      inv.includes('VISA') ||
      serv.includes('VISA') ||
      serv.includes('فيزا') ||
      serv.includes('تأشيرة') ||
      flt.includes('VISA') ||
      trip.includes('VISA') ||
      air.includes('VISA') ||
      air.includes('فيزا') ||
      notes.includes('فيزا') ||
      notes.includes('VISA')
    );
  }, []);

  const isHotelTicket = useCallback((t: any) => {
    const inv = String(t.invoiceNumber || '').toUpperCase();
    const serv = String((t as any).serviceType || '').toUpperCase();
    const flt = String((t as any).flightType || '').toUpperCase();
    const air = String(t.airline || '').toUpperCase();
    const trip = String(t.tripType || '').toUpperCase();
    const notes = String(t.notes || '').toUpperCase();
    const hotel = String((t as any).hotelName || (t as any).hotel || '').toUpperCase();

    return (
      trip === 'HOTEL' ||
      inv.includes('HTL') ||
      inv.includes('HOTEL') ||
      serv.includes('HOTEL') ||
      serv.includes('فندق') ||
      serv.includes('فنادق') ||
      serv.includes('إقامة') ||
      serv.includes('اقامة') ||
      flt.includes('HOTEL') ||
      air.includes('HOTEL') ||
      air.includes('فندق') ||
      air.includes('فنادق') ||
      notes.includes('فندق') ||
      notes.includes('HOTEL') ||
      hotel.length > 0
    );
  }, []);

  const isGroupTicket = useCallback((t: any) => {
    const inv = String(t.invoiceNumber || '').toUpperCase();
    const serv = String((t as any).serviceType || '').toUpperCase();
    const trip = String(t.tripType || '').toUpperCase();
    const notes = String(t.notes || '').toUpperCase();

    return (
      trip === 'GROUP' ||
      inv.includes('GRP') ||
      inv.includes('GROUP') ||
      serv.includes('GROUP') ||
      serv.includes('كروب') ||
      serv.includes('مجموع') ||
      notes.includes('كروب') ||
      notes.includes('GROUP')
    );
  }, []);

  const isFlightTicket = useCallback((t: any) => {
    return !isRefundTicket(t) && !isVisaTicket(t) && !isHotelTicket(t) && !isGroupTicket(t);
  }, [isRefundTicket, isVisaTicket, isHotelTicket, isGroupTicket]);

  const getTicketRefundBreakdown = useCallback((t: any) => {
    const isUSD = (t.currency || '').toUpperCase().includes('USD') || (t.currency || '').includes('$');
    const sell = Math.abs(Number(t.totalSell || t.totals?.totalSell || t.netSell || 0));
    const buy = Math.abs(Number(t.totalBuy || t.totals?.totalBuy || t.netBuy || 0));
    const prf = Number(t.profit !== undefined && t.profit !== null ? t.profit : (sell - buy));

    const airlinePenalty =
      t.passengers && Array.isArray(t.passengers) && t.passengers.some((p: any) => p.tax1 && p.tax1 > 0)
        ? t.passengers.reduce((sum: number, p: any) => sum + (Number(p.tax1) || 0), 0)
        : Number(t.tax1 || 0);

    const agencyRetention = Number(t.profit !== undefined && t.profit !== null ? t.profit : prf);

    const netRefundCustomer = sell > 0 && (airlinePenalty > 0 || agencyRetention > 0)
      ? Math.max(0, sell - airlinePenalty - agencyRetention)
      : sell;

    const netRefundSupplier = buy > 0 && airlinePenalty > 0
      ? Math.max(0, buy - airlinePenalty)
      : buy;

    return {
      isUSD,
      sell,
      buy,
      prf,
      airlinePenalty,
      agencyRetention,
      netRefundCustomer,
      netRefundSupplier,
    };
  }, []);

  const vm = useMemo<FinancialViewModel>(() => {
    let salesIQD = 0;
    let salesUSD = 0;
    let costIQD = 0;
    let costUSD = 0;

    let refundsSalesIQD = 0;
    let refundsSalesUSD = 0;
    let refundsCostIQD = 0;
    let refundsCostUSD = 0;
    let refundsProfitIQD = 0;
    let refundsProfitUSD = 0;

    const breakdown: FinancialViewModel['breakdown'] = {
      FLIGHT_TICKETS: { titleAr: 'تذاكر الطيران', titleEn: 'Flight Tickets', count: 0, salesIQD: 0, costIQD: 0, profitIQD: 0, salesUSD: 0, costUSD: 0, profitUSD: 0 },
      VISAS: { titleAr: 'الفيزا والتأشيرات', titleEn: 'Visas & Permits', count: 0, salesIQD: 0, costIQD: 0, profitIQD: 0, salesUSD: 0, costUSD: 0, profitUSD: 0 },
      HOTELS: { titleAr: 'حجوزات الفنادق والإقامة', titleEn: 'Hotels', count: 0, salesIQD: 0, costIQD: 0, profitIQD: 0, salesUSD: 0, costUSD: 0, profitUSD: 0 },
      GROUPS: { titleAr: 'البرامج السياحية والكروبات', titleEn: 'Group Tours', count: 0, salesIQD: 0, costIQD: 0, profitIQD: 0, salesUSD: 0, costUSD: 0, profitUSD: 0 },
      REISSUES: { titleAr: 'تغيير وتعديل التذاكر', titleEn: 'Reissues', count: 0, salesIQD: 0, costIQD: 0, profitIQD: 0, salesUSD: 0, costUSD: 0, profitUSD: 0 },
      REFUNDS: { titleAr: 'استرجاع التذاكر والعمولات', titleEn: 'Refunds', count: 0, salesIQD: 0, costIQD: 0, profitIQD: 0, salesUSD: 0, costUSD: 0, profitUSD: 0 },
      OTHER: { titleAr: 'خدمات سياحية أخرى', titleEn: 'Other Services', count: 0, salesIQD: 0, costIQD: 0, profitIQD: 0, salesUSD: 0, costUSD: 0, profitUSD: 0 },
    };

    dateFilteredTickets.forEach((t: any) => {
      const isRef = isRefundTicket(t);
      const isVisa = isVisaTicket(t);
      const isHotel = isHotelTicket(t);
      const isGroup = isGroupTicket(t);

      if (isRef) {
        const ref = getTicketRefundBreakdown(t);
        if (ref.isUSD) {
          refundsSalesUSD += ref.netRefundCustomer;
          refundsCostUSD += ref.netRefundSupplier;
          refundsProfitUSD += ref.agencyRetention;
        } else {
          refundsSalesIQD += ref.netRefundCustomer;
          refundsCostIQD += ref.netRefundSupplier;
          refundsProfitIQD += ref.agencyRetention;
        }
      } else {
        const isUSD = (t.currency || '').toUpperCase().includes('USD') || (t.currency || '').includes('$');
        const sell = Math.abs(Number(t.totalSell || t.totals?.totalSell || t.netSell || 0));
        const buy = Math.abs(Number(t.totalBuy || t.totals?.totalBuy || t.netBuy || 0));
        if (isUSD) {
          salesUSD += sell;
          costUSD += buy;
        } else {
          salesIQD += sell;
          costIQD += buy;
        }
      }

      let key = 'FLIGHT_TICKETS';
      if (isRef) key = 'REFUNDS';
      else if (isVisa) key = 'VISAS';
      else if (isHotel) key = 'HOTELS';
      else if (isGroup) key = 'GROUPS';

      const cat = breakdown[key] || breakdown['FLIGHT_TICKETS'];
      cat.count++;
      const isUSD = (t.currency || '').toUpperCase().includes('USD') || (t.currency || '').includes('$');
      const sell = Math.abs(Number(t.totalSell || t.totals?.totalSell || t.netSell || 0));
      const buy = Math.abs(Number(t.totalBuy || t.totals?.totalBuy || t.netBuy || 0));
      const prf = Number(t.profit !== undefined && t.profit !== null ? t.profit : (sell - buy));

      if (isUSD) {
        cat.salesUSD += sell;
        cat.costUSD += buy;
        cat.profitUSD += prf;
      } else {
        cat.salesIQD += sell;
        cat.costIQD += buy;
        cat.profitIQD += prf;
      }
    });

    // Helper to calculate movement of any account from journal entries and balances
    const calculateAccountMovement = (acc: AccountNode, isRevenueType: boolean, section: StatementAccountRowItem['section'], isPinned: boolean = false): StatementAccountRowItem => {
      let accIQD = 0;
      let accUSD = 0;
      const lines: DrilldownItem[] = [];

      dateFilteredJournalEntries.forEach((je: any) => {
        (je.lines || []).forEach((line: any) => {
          if (line.accountId === acc.id || String(line.accountCode) === String(acc.code)) {
            const lineCurr = String(line.currency || je.currency || 'IQD').toUpperCase();
            const isUSD = lineCurr.includes('USD') || lineCurr.includes('$');
            const debit = Number(line.debit || 0);
            const credit = Number(line.credit || 0);
            // If revenue, credit increases revenue. If cost/expense, debit increases cost.
            const net = isRevenueType ? (credit - debit) : (debit - credit);

            if (isUSD) {
              accUSD += net;
            } else {
              accIQD += net;
            }

            lines.push({
              id: line.id || je.id,
              refNumber: je.entryNumber || je.reference || 'JV',
              date: je.date || je.createdAt || '-',
              partnerName: line.description || je.narration || acc.nameAr,
              serviceType: acc.nameAr || (isAr ? 'حركة قيد' : 'Journal Entry'),
              amountIQD: isUSD ? 0 : net,
              amountUSD: isUSD ? net : 0,
              currency: isUSD ? 'USD' : 'IQD',
              status: 'POSTED',
              passengerOrNotes: line.description || je.narration || acc.nameAr,
            });
          }
        });
      });

      if (accIQD === 0 && accUSD === 0 && (acc.balanceIQD || acc.balanceUSD)) {
        accIQD = Number(acc.balanceIQD || 0);
        accUSD = Number(acc.balanceUSD || 0);
      }

      return {
        id: acc.id,
        code: acc.code,
        nameAr: acc.nameAr,
        nameEn: acc.nameEn,
        amountIQD: accIQD,
        amountUSD: accUSD,
        section,
        isCustomPinned: isPinned,
        linesCount: lines.length,
        lines,
      };
    };

    // 1. Custom Operating Revenues (Section I)
    const customOperatingRevenues: StatementAccountRowItem[] = [];
    customIncludedAccounts
      .filter((c) => c.section === 'OPERATING_REVENUE')
      .forEach((c) => {
        const acc = allAccounts.find((a) => a.id === c.accountId);
        if (acc) {
          customOperatingRevenues.push(calculateAccountMovement(acc, true, 'OPERATING_REVENUE', true));
        }
      });

    // 2. Custom Direct Costs (Section II)
    const customDirectCosts: StatementAccountRowItem[] = [];
    customIncludedAccounts
      .filter((c) => c.section === 'DIRECT_COST')
      .forEach((c) => {
        const acc = allAccounts.find((a) => a.id === c.accountId);
        if (acc) {
          customDirectCosts.push(calculateAccountMovement(acc, false, 'DIRECT_COST', true));
        }
      });

    // 3. Incidental & Other Revenues (Section IV: Class 42 / 43 / 48 / 49 + Custom Pinned)
    const incidentalAccounts = allAccounts.filter((a: any) => 
      a.type === 'REVENUE' && 
      !a.isGroup && 
      !(a as any).isParent &&
      !String(a.code).startsWith('4111') &&
      !String(a.code).startsWith('4112') &&
      !String(a.code).startsWith('4113') &&
      !String(a.code).startsWith('4114') &&
      !String(a.code).startsWith('4115') &&
      !String(a.code).startsWith('412')
    );

    const incidentalBreakdown: StatementAccountRowItem[] = [];
    const processedIncidentalIds = new Set<string>();

    incidentalAccounts.forEach((acc) => {
      processedIncidentalIds.add(acc.id);
      const isPinned = customIncludedAccounts.some((c) => c.accountId === acc.id && c.section === 'INCIDENTAL_REVENUE');
      incidentalBreakdown.push(calculateAccountMovement(acc, true, 'INCIDENTAL_REVENUE', isPinned));
    });

    // Also include any explicitly pinned accounts not in Class 4 (e.g. custom equity/gain accounts)
    customIncludedAccounts
      .filter((c) => c.section === 'INCIDENTAL_REVENUE' && !processedIncidentalIds.has(c.accountId))
      .forEach((c) => {
        const acc = allAccounts.find((a) => a.id === c.accountId);
        if (acc) {
          incidentalBreakdown.push(calculateAccountMovement(acc, true, 'INCIDENTAL_REVENUE', true));
        }
      });

    let totalIncidentalRevenuesIQD = 0;
    let totalIncidentalRevenuesUSD = 0;
    incidentalBreakdown.forEach((item) => {
      totalIncidentalRevenuesIQD += item.amountIQD;
      totalIncidentalRevenuesUSD += item.amountUSD;
    });

    // 4. Detailed Operating Expenses (Section V: Vouchers + Class 32/33/37/38 + Custom Pinned)
    const detailedOperatingExpenses: StatementAccountRowItem[] = [];
    const expenseAccounts = allAccounts.filter((a: any) => 
      a.type === 'EXPENSE' && 
      !a.isGroup && 
      !(a as any).isParent &&
      !String(a.code).startsWith('311') && 
      !String(a.code).startsWith('312')
    );

    const processedExpenseIds = new Set<string>();
    expenseAccounts.forEach((acc) => {
      processedExpenseIds.add(acc.id);
      const isPinned = customIncludedAccounts.some((c) => c.accountId === acc.id && c.section === 'OPERATING_EXPENSE');
      const item = calculateAccountMovement(acc, false, 'OPERATING_EXPENSE', isPinned);
      if (item.amountIQD !== 0 || item.amountUSD !== 0 || isPinned) {
        detailedOperatingExpenses.push(item);
      }
    });

    customIncludedAccounts
      .filter((c) => c.section === 'OPERATING_EXPENSE' && !processedExpenseIds.has(c.accountId))
      .forEach((c) => {
        const acc = allAccounts.find((a) => a.id === c.accountId);
        if (acc) {
          detailedOperatingExpenses.push(calculateAccountMovement(acc, false, 'OPERATING_EXPENSE', true));
        }
      });

    let operatingExpensesIQD = 0;
    let operatingExpensesUSD = 0;
    if (detailedOperatingExpenses.length > 0) {
      detailedOperatingExpenses.forEach((e) => {
        operatingExpensesIQD += e.amountIQD;
        operatingExpensesUSD += e.amountUSD;
      });
    } else {
      expenseTransactions.forEach((e) => {
        operatingExpensesIQD += e.amountIQD;
        operatingExpensesUSD += e.amountUSD;
      });
    }

    const customRevenuesSumIQD = customOperatingRevenues.reduce((s, a) => s + a.amountIQD, 0);
    const customRevenuesSumUSD = customOperatingRevenues.reduce((s, a) => s + a.amountUSD, 0);

    const customCostsSumIQD = customDirectCosts.reduce((s, a) => s + a.amountIQD, 0);
    const customCostsSumUSD = customDirectCosts.reduce((s, a) => s + a.amountUSD, 0);

    const totalGrossRevenueIQD = salesIQD + customRevenuesSumIQD;
    const totalGrossRevenueUSD = salesUSD + customRevenuesSumUSD;

    const netOperatingRevenueIQD = totalGrossRevenueIQD - refundsSalesIQD + refundsProfitIQD;
    const netOperatingRevenueUSD = totalGrossRevenueUSD - refundsSalesUSD + refundsProfitUSD;

    const totalGrossDirectCostIQD = costIQD + customCostsSumIQD;
    const totalGrossDirectCostUSD = costUSD + customCostsSumUSD;

    const netDirectCostIQD = totalGrossDirectCostIQD - refundsCostIQD;
    const netDirectCostUSD = totalGrossDirectCostUSD - refundsCostUSD;

    const grossProfitIQD = netOperatingRevenueIQD - netDirectCostIQD;
    const grossProfitUSD = netOperatingRevenueUSD - netDirectCostUSD;

    const netProfitIQD = grossProfitIQD + totalIncidentalRevenuesIQD - operatingExpensesIQD;
    const netProfitUSD = grossProfitUSD + totalIncidentalRevenuesUSD - operatingExpensesUSD;

    const profitMarginIQD = netOperatingRevenueIQD > 0 ? (grossProfitIQD / netOperatingRevenueIQD) * 100 : 0;
    const profitMarginUSD = netOperatingRevenueUSD > 0 ? (grossProfitUSD / netOperatingRevenueUSD) * 100 : 0;

    return {
      grossRevenueIQD: totalGrossRevenueIQD,
      grossRevenueUSD: totalGrossRevenueUSD,
      salesReturnsIQD: refundsSalesIQD,
      salesReturnsUSD: refundsSalesUSD,
      refundServiceRevenueIQD: refundsProfitIQD,
      refundServiceRevenueUSD: refundsProfitUSD,
      netOperatingRevenueIQD,
      netOperatingRevenueUSD,
      customOperatingRevenues,
      grossDirectCostIQD: totalGrossDirectCostIQD,
      grossDirectCostUSD: totalGrossDirectCostUSD,
      purchaseReturnsIQD: refundsCostIQD,
      purchaseReturnsUSD: refundsCostUSD,
      netDirectCostIQD,
      netDirectCostUSD,
      customDirectCosts,
      grossProfitIQD,
      grossProfitUSD,
      totalIncidentalRevenuesIQD,
      totalIncidentalRevenuesUSD,
      incidentalBreakdown,
      operatingExpensesIQD,
      operatingExpensesUSD,
      detailedOperatingExpenses,
      netProfitIQD,
      netProfitUSD,
      profitMarginIQD,
      profitMarginUSD,
      breakdown,
    };
  }, [dateFilteredTickets, dateFilteredJournalEntries, allAccounts, customIncludedAccounts, expenseTransactions, getTicketRefundBreakdown, isRefundTicket, isVisaTicket, isHotelTicket, isGroupTicket, isAr]);

  const fmtNum = (valIQD: number, valUSD: number) => {
    if (currency === 'USD') return `$${valUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (currency === 'IQD') return `${valIQD.toLocaleString()}`;
    if (valUSD !== 0 && valIQD !== 0) return `${valIQD.toLocaleString()} | $${valUSD.toLocaleString()}`;
    return valUSD !== 0 ? `$${valUSD.toLocaleString()}` : `${valIQD.toLocaleString()}`;
  };

  const selectedBranchName =
    selectedBranchId === 'ALL'
      ? (isAr ? 'كافة الفروع' : 'All Branches')
      : (branches.find((b) => b.id === selectedBranchId)?.nameAr || (isAr ? 'الفرع المحدد' : 'Selected Branch'));

  const openAuditDrilldown = useCallback((lineKey: string) => {
    setDrilldownSearchQuery('');

    if (lineKey === '4111') {
      const items: DrilldownItem[] = dateFilteredTickets
        .filter((t: any) => isFlightTicket(t))
        .map((t: any) => {
          const isUSD = (t.currency || '').toUpperCase().includes('USD') || (t.currency || '').includes('$');
          const sell = Math.abs(Number(t.totalSell || t.totals?.totalSell || t.netSell || 0));
          return {
            id: t.id || t.invoiceNumber || Math.random().toString(),
            refNumber: t.invoiceNumber || t.ticketNumber || t.pnr || 'TKT',
            date: t.issueDate || t.createdAt || t.date || '-',
            partnerName: t.customerName || t.clientName || (isAr ? 'عميل نقدي' : 'Cash Client'),
            serviceType: isAr ? 'تذاكر طيران' : 'Flight Tickets',
            amountIQD: isUSD ? 0 : sell,
            amountUSD: isUSD ? sell : 0,
            currency: isUSD ? 'USD' : 'IQD',
            status: t.status || 'ISSUED',
            passengerOrNotes: t.passengerName || t.airline || t.pnr,
          };
        });

      setDrilldownData({
        code: '4111',
        title: isAr ? 'إيرادات مبيعات تذاكر الطيران الصادرة' : 'Flight Tickets Sales Revenues',
        amountIQD: vm.breakdown.FLIGHT_TICKETS.salesIQD,
        amountUSD: vm.breakdown.FLIGHT_TICKETS.salesUSD,
        explanation: isAr 
          ? 'يمثل هذا المبلغ إجمالي فواتير مبيعات تذاكر الطيران المصدرة للعملاء والشركات خلال الفترة المحددة، قبل خصم التكاليف أو المردودات.'
          : 'Total revenue from issued flight ticket invoices to clients and corporate accounts during the period, before deducting costs or returns.',
        targetRoute: '/tickets',
        targetRouteLabel: isAr ? 'الانتقال إلى سجل تذاكر الطيران' : 'Go to Flight Tickets',
        items,
      });
    } else if (lineKey === '4113') {
      const items: DrilldownItem[] = dateFilteredTickets
        .filter((t: any) => isVisaTicket(t))
        .map((t: any) => {
          const isUSD = (t.currency || '').toUpperCase().includes('USD') || (t.currency || '').includes('$');
          const sell = Math.abs(Number(t.totalSell || t.totals?.totalSell || t.netSell || 0));
          return {
            id: t.id || t.invoiceNumber || Math.random().toString(),
            refNumber: t.invoiceNumber || 'VISA',
            date: t.issueDate || t.createdAt || t.date || '-',
            partnerName: t.customerName || t.clientName || (isAr ? 'عميل تأشيرة' : 'Visa Client'),
            serviceType: isAr ? 'فيزا وتأشيرات' : 'Visas & Permits',
            amountIQD: isUSD ? 0 : sell,
            amountUSD: isUSD ? sell : 0,
            currency: isUSD ? 'USD' : 'IQD',
            status: t.status || 'ISSUED',
            passengerOrNotes: t.passengerName || t.country || t.visaType,
          };
        });

      setDrilldownData({
        code: '4113',
        title: isAr ? 'إيرادات خدمات إصدار الفيزا والتأشيرات' : 'Visas & Entry Permits Revenues',
        amountIQD: vm.breakdown.VISAS.salesIQD,
        amountUSD: vm.breakdown.VISAS.salesUSD,
        explanation: isAr
          ? 'يمثل هذا المبلغ إجمالي إيرادات إصدار وتخليص الفيزا وتأشيرات الدخول السياحية والتجارية للعملاء خلال الفترة.'
          : 'Total revenue from processing and issuing tourist and commercial visas for clients during the specified period.',
        targetRoute: '/visas',
        targetRouteLabel: isAr ? 'الانتقال إلى سجل الفيزا والتأشيرات' : 'Go to Visas & Permits',
        items,
      });
    } else if (lineKey === '4114') {
      const items: DrilldownItem[] = dateFilteredTickets
        .filter((t: any) => isHotelTicket(t))
        .map((t: any) => {
          const isUSD = (t.currency || '').toUpperCase().includes('USD') || (t.currency || '').includes('$');
          const sell = Math.abs(Number(t.totalSell || t.totals?.totalSell || t.netSell || 0));
          return {
            id: t.id || t.invoiceNumber || Math.random().toString(),
            refNumber: t.invoiceNumber || 'HOTEL',
            date: t.issueDate || t.createdAt || t.date || '-',
            partnerName: t.customerName || t.clientName || (isAr ? 'عميل فندق' : 'Hotel Client'),
            serviceType: isAr ? 'حجوزات فنادق' : 'Hotel Bookings',
            amountIQD: isUSD ? 0 : sell,
            amountUSD: isUSD ? sell : 0,
            currency: isUSD ? 'USD' : 'IQD',
            status: t.status || 'CONFIRMED',
            passengerOrNotes: t.hotelName || t.destination || t.city || t.notes,
          };
        });

      setDrilldownData({
        code: '4114',
        title: isAr ? 'إيرادات خدمات وحجوزات الفنادق والإقامة' : 'Hotel Bookings & Accommodation Revenues',
        amountIQD: vm.breakdown.HOTELS.salesIQD,
        amountUSD: vm.breakdown.HOTELS.salesUSD,
        explanation: isAr
          ? 'يمثل هذا المبلغ إجمالي فواتير مبيعات وحجوزات الفنادق والإقامة السياحية المصدرة للعملاء خلال الفترة المحددة.'
          : 'Total revenue from hotel reservations and accommodation packages issued to clients during the specified period.',
        targetRoute: '/hotels',
        targetRouteLabel: isAr ? 'الانتقال إلى سجل حجوزات الفنادق' : 'Go to Hotel Bookings',
        items,
      });
    } else if (lineKey === '4115') {
      const items: DrilldownItem[] = dateFilteredTickets
        .filter((t: any) => isGroupTicket(t))
        .map((t: any) => {
          const isUSD = (t.currency || '').toUpperCase().includes('USD') || (t.currency || '').includes('$');
          const sell = Math.abs(Number(t.totalSell || t.totals?.totalSell || t.netSell || 0));
          return {
            id: t.id || t.invoiceNumber || Math.random().toString(),
            refNumber: t.invoiceNumber || 'GROUP',
            date: t.issueDate || t.createdAt || t.date || '-',
            partnerName: t.customerName || t.clientName || (isAr ? 'عميل برنامج سياحي' : 'Tour Client'),
            serviceType: isAr ? 'برامج ومجموعات سياحية' : 'Group Tours',
            amountIQD: isUSD ? 0 : sell,
            amountUSD: isUSD ? sell : 0,
            currency: isUSD ? 'USD' : 'IQD',
            status: t.status || 'CONFIRMED',
            passengerOrNotes: t.groupName || t.programName || t.destination || t.notes,
          };
        });

      setDrilldownData({
        code: '4115',
        title: isAr ? 'إيرادات البرامج والمجموعات السياحية (الكروبات)' : 'Group Tours & Packages Revenues',
        amountIQD: vm.breakdown.GROUPS.salesIQD,
        amountUSD: vm.breakdown.GROUPS.salesUSD,
        explanation: isAr
          ? 'يمثل هذا المبلغ إجمالي إيرادات الرحلات المنظمة والبرامج السياحية الجماعية المباعة للعملاء خلال الفترة.'
          : 'Total revenue from organized group tour packages and leisure programs sold to clients during the period.',
        targetRoute: '/groups',
        targetRouteLabel: isAr ? 'الانتقال إلى سجل المجموعات والكروبات' : 'Go to Group Tours',
        items,
      });
    } else if (lineKey === '411') {
      const items: DrilldownItem[] = dateFilteredTickets
        .filter((t: any) => !isRefundTicket(t))
        .map((t: any) => {
          const isUSD = (t.currency || '').toUpperCase().includes('USD') || (t.currency || '').includes('$');
          const sell = Math.abs(Number(t.totalSell || t.totals?.totalSell || t.netSell || 0));
          const isVisa = isVisaTicket(t);
          const isHotel = isHotelTicket(t);
          const isGroup = isGroupTicket(t);
          const servName = isVisa
            ? (isAr ? 'فيزا وتأشيرات' : 'Visas')
            : isHotel
            ? (isAr ? 'حجوزات فنادق' : 'Hotels')
            : isGroup
            ? (isAr ? 'برامج سياحية' : 'Groups')
            : (isAr ? 'تذاكر طيران' : 'Flight Tickets');

          return {
            id: t.id || t.invoiceNumber || Math.random().toString(),
            refNumber: t.invoiceNumber || (isVisa ? 'VISA' : isHotel ? 'HOTEL' : isGroup ? 'GROUP' : 'TKT'),
            date: t.issueDate || t.createdAt || t.date || '-',
            partnerName: t.customerName || t.clientName || (isAr ? 'عميل' : 'Client'),
            serviceType: servName,
            amountIQD: isUSD ? 0 : sell,
            amountUSD: isUSD ? sell : 0,
            currency: isUSD ? 'USD' : 'IQD',
            status: t.status || 'ISSUED',
            passengerOrNotes: t.passengerName || t.airline || t.visaType || t.hotelName,
          };
        });

      setDrilldownData({
        code: '411',
        title: isAr ? 'إجمالي مبيعات وخدمات النشاط الجاري' : 'Gross Operating Activity Revenues',
        amountIQD: vm.grossRevenueIQD,
        amountUSD: vm.grossRevenueUSD,
        explanation: isAr
          ? 'حاصل جمع كافة مبيعات وإيرادات النشاط الجاري التشغيلي (تذاكر الطيران 4111 + الفيزا 4113 + الفنادق 4114 + الكروبات 4115).'
          : 'Sum of all core operational sales revenues (Tickets 4111 + Visas 4113 + Hotels 4114 + Groups 4115).',
        targetRoute: '/tickets',
        targetRouteLabel: isAr ? 'الانتقال إلى سجل العمليات' : 'Go to Operations Records',
        items,
      });
    } else if (lineKey === '412') {
      const items: DrilldownItem[] = dateFilteredTickets
        .filter((t: any) => isRefundTicket(t))
        .map((t: any) => {
          const ref = getTicketRefundBreakdown(t);
          return {
            id: t.id || t.invoiceNumber || Math.random().toString(),
            refNumber: t.invoiceNumber || 'REF',
            date: t.issueDate || t.createdAt || t.date || '-',
            partnerName: t.customerName || (isAr ? 'عميل مسترجع' : 'Refund Client'),
            serviceType: isAr ? 'استرجاع تذاكر' : 'Ticket Refund',
            amountIQD: ref.isUSD ? 0 : ref.netRefundCustomer,
            amountUSD: ref.isUSD ? ref.netRefundCustomer : 0,
            currency: ref.isUSD ? 'USD' : 'IQD',
            status: 'REFUNDED',
            passengerOrNotes: ref.airlinePenalty > 0 || ref.agencyRetention > 0
              ? (isAr 
                  ? `غرامة الطيران: ${ref.airlinePenalty.toLocaleString()} | استقطاع الشركة: ${ref.agencyRetention.toLocaleString()}`
                  : `Airline Fee: ${ref.airlinePenalty.toLocaleString()} | Agency Retention: ${ref.agencyRetention.toLocaleString()}`)
              : t.passengerName || t.ticketNumber,
          };
        });

      setDrilldownData({
        code: '412',
        title: isAr ? 'مردودات مبيعات التذاكر المستردة للعملاء' : 'Customer Sales Returns & Refunds',
        amountIQD: vm.salesReturnsIQD,
        amountUSD: vm.salesReturnsUSD,
        explanation: isAr
          ? 'المبالغ الصافية المعادة والمقيدة في حسابات العملاء عن التذاكر والخدمات الملغاة بعد خصم غرامات الإلغاء وعمولات الاسترجاع.'
          : 'Net refunded amounts credited to customer accounts for cancelled tickets after deducting airline penalties and agency retention fees.',
        targetRoute: '/refunds',
        targetRouteLabel: isAr ? 'الانتقال إلى شاشة استرجاع التذاكر' : 'Go to Ticket Refunds',
        items,
      });
    } else if (lineKey === '4112') {
      const items: DrilldownItem[] = dateFilteredTickets
        .filter((t: any) => isRefundTicket(t))
        .map((t: any) => {
          const ref = getTicketRefundBreakdown(t);
          return {
            id: t.id || t.invoiceNumber || Math.random().toString(),
            refNumber: t.invoiceNumber || 'REF-FEE',
            date: t.issueDate || t.createdAt || t.date || '-',
            partnerName: t.customerName || (isAr ? 'استقطاع استرجاع' : 'Refund Retention'),
            serviceType: isAr ? 'عمولة استرجاع' : 'Refund Commission',
            amountIQD: ref.isUSD ? 0 : ref.agencyRetention,
            amountUSD: ref.isUSD ? ref.agencyRetention : 0,
            currency: ref.isUSD ? 'USD' : 'IQD',
            status: 'PROFIT',
            passengerOrNotes: isAr ? 'أتعاب وعمولة استرجاع محتجزة' : 'Retained agency refund commission',
          };
        });

      setDrilldownData({
        code: '4112 / 432',
        title: isAr ? 'عمولات واستقطاعات استرجاع وتعديل التذاكر (إيراد الاسترجاع)' : 'Refund & Reissue Commissions Revenue',
        amountIQD: vm.refundServiceRevenueIQD,
        amountUSD: vm.refundServiceRevenueUSD,
        explanation: isAr
          ? 'إيرادات العمولات ورسوم الخدمات الإدارية المحتجزة لصالح الشركة عن عمليات إلغاء واسترجاع وتعديل التذاكر.'
          : 'Administrative commissions and service fees retained in favor of the company on cancellation, refund, and reissue operations.',
        targetRoute: '/refunds',
        targetRouteLabel: isAr ? 'الانتقال إلى شاشة استرجاع التذاكر' : 'Go to Ticket Refunds',
        items,
      });
    } else if (lineKey === '4') {
      setDrilldownData({
        code: isAr ? 'دليل 4' : 'Code 4',
        title: isAr ? 'صافي إيرادات النشاط الجاري' : 'Net Operating Revenues',
        amountIQD: vm.netOperatingRevenueIQD,
        amountUSD: vm.netOperatingRevenueUSD,
        explanation: isAr
          ? `معادلة صافي الإيراد التشغيلي: إجمالي المبيعات (${vm.grossRevenueIQD.toLocaleString()} د.ع) - مردودات العملاء (${vm.salesReturnsIQD.toLocaleString()} د.ع) + عمولات الاسترجاع (${vm.refundServiceRevenueIQD.toLocaleString()} د.ع) = ${vm.netOperatingRevenueIQD.toLocaleString()} د.ع.`
          : `Net operating revenue formula: Gross Sales (${vm.grossRevenueIQD.toLocaleString()}) - Returns (${vm.salesReturnsIQD.toLocaleString()}) + Commissions (${vm.refundServiceRevenueIQD.toLocaleString()}) = ${vm.netOperatingRevenueIQD.toLocaleString()}.`,
        targetRoute: '/profits',
        targetRouteLabel: isAr ? 'الانتقال إلى لوحة تحليل الربحية' : 'Go to Profitability Dashboard',
        items: [],
      });
    } else if (lineKey === '3111') {
      const items: DrilldownItem[] = dateFilteredTickets
        .filter((t: any) => isFlightTicket(t))
        .map((t: any) => {
          const isUSD = (t.currency || '').toUpperCase().includes('USD') || (t.currency || '').includes('$');
          const buy = Math.abs(Number(t.totalBuy || t.totals?.totalBuy || t.netBuy || 0));
          return {
            id: t.id || t.invoiceNumber || Math.random().toString(),
            refNumber: t.invoiceNumber || t.ticketNumber || 'TKT-COST',
            date: t.issueDate || t.createdAt || t.date || '-',
            partnerName: t.supplierName || t.airline || (isAr ? 'مورد التذاكر' : 'Ticket Supplier'),
            serviceType: isAr ? 'كلفة شراء تذاكر طيران' : 'Flight Ticket Cost',
            amountIQD: isUSD ? 0 : buy,
            amountUSD: isUSD ? buy : 0,
            currency: isUSD ? 'USD' : 'IQD',
            status: 'PAYABLE',
            passengerOrNotes: t.airline || t.pnr,
          };
        });

      setDrilldownData({
        code: '3111',
        title: isAr ? 'كلفة شراء تذاكر الطيران من خطوط الطيران والمنصات' : 'Cost of Flight Tickets Purchased',
        amountIQD: vm.breakdown.FLIGHT_TICKETS.costIQD,
        amountUSD: vm.breakdown.FLIGHT_TICKETS.costUSD,
        explanation: isAr
          ? 'الكلفة المباشرة المستحقة لخطوط الطيران وموردي الجملة والمنصات عن تذاكر الطيران المصدرة.'
          : 'Direct costs payable to airlines, consolidators, and GDS platforms for issued flight tickets.',
        targetRoute: '/tickets',
        targetRouteLabel: isAr ? 'الانتقال إلى سجل تذاكر الطيران' : 'Go to Flight Tickets',
        items,
      });
    } else if (lineKey === '3113') {
      const items: DrilldownItem[] = dateFilteredTickets
        .filter((t: any) => isVisaTicket(t))
        .map((t: any) => {
          const isUSD = (t.currency || '').toUpperCase().includes('USD') || (t.currency || '').includes('$');
          const buy = Math.abs(Number(t.totalBuy || t.totals?.totalBuy || t.netBuy || 0));
          return {
            id: t.id || t.invoiceNumber || Math.random().toString(),
            refNumber: t.invoiceNumber || 'VISA-COST',
            date: t.issueDate || t.createdAt || t.date || '-',
            partnerName: t.supplierName || (isAr ? 'سفارة / مورد تأشيرة' : 'Embassy / Visa Supplier'),
            serviceType: isAr ? 'كلفة فيزا وتأشيرات' : 'Visa Costs',
            amountIQD: isUSD ? 0 : buy,
            amountUSD: isUSD ? buy : 0,
            currency: isUSD ? 'USD' : 'IQD',
            status: 'PAYABLE',
            passengerOrNotes: t.country || t.visaType,
          };
        });

      setDrilldownData({
        code: '3113',
        title: isAr ? 'كلفة إصدار الفيزا والتأشيرات المباشرة' : 'Direct Cost of Visas & Permits',
        amountIQD: vm.breakdown.VISAS.costIQD,
        amountUSD: vm.breakdown.VISAS.costUSD,
        explanation: isAr
          ? 'تكاليف ومصاريف شراء وتوريد الفيزا وتأشيرات الدخول من الموردين والسفارات والمنصات.'
          : 'Direct procurement and processing costs for visas and entry permits.',
        targetRoute: '/visas',
        targetRouteLabel: isAr ? 'الانتقال إلى سجل الفيزا والتأشيرات' : 'Go to Visas & Permits',
        items,
      });
    } else if (lineKey === '3114') {
      const items: DrilldownItem[] = dateFilteredTickets
        .filter((t: any) => isHotelTicket(t))
        .map((t: any) => {
          const isUSD = (t.currency || '').toUpperCase().includes('USD') || (t.currency || '').includes('$');
          const buy = Math.abs(Number(t.totalBuy || t.totals?.totalBuy || t.netBuy || 0));
          return {
            id: t.id || t.invoiceNumber || Math.random().toString(),
            refNumber: t.invoiceNumber || 'HOTEL-COST',
            date: t.issueDate || t.createdAt || t.date || '-',
            partnerName: t.supplierName || (isAr ? 'مورد الفندق' : 'Hotel Supplier'),
            serviceType: isAr ? 'كلفة حجز فندقي' : 'Hotel Direct Cost',
            amountIQD: isUSD ? 0 : buy,
            amountUSD: isUSD ? buy : 0,
            currency: isUSD ? 'USD' : 'IQD',
            status: 'PAYABLE',
            passengerOrNotes: t.hotelName || t.destination || t.city,
          };
        });

      setDrilldownData({
        code: '3114',
        title: isAr ? 'كلفة حجوزات الفنادق والإقامة المباشرة' : 'Direct Cost of Hotel Bookings',
        amountIQD: vm.breakdown.HOTELS.costIQD,
        amountUSD: vm.breakdown.HOTELS.costUSD,
        explanation: isAr
          ? 'الكلفة المباشرة المستحقة لموردي ومنصات الفنادق والإقامة السياحية عن الحجوزات المصدرة.'
          : 'Direct costs payable to hotel suppliers and reservation platforms for booked accommodation.',
        targetRoute: '/hotels',
        targetRouteLabel: isAr ? 'الانتقال إلى سجل حجوزات الفنادق' : 'Go to Hotel Bookings',
        items,
      });
    } else if (lineKey === '3115') {
      const items: DrilldownItem[] = dateFilteredTickets
        .filter((t: any) => isGroupTicket(t))
        .map((t: any) => {
          const isUSD = (t.currency || '').toUpperCase().includes('USD') || (t.currency || '').includes('$');
          const buy = Math.abs(Number(t.totalBuy || t.totals?.totalBuy || t.netBuy || 0));
          return {
            id: t.id || t.invoiceNumber || Math.random().toString(),
            refNumber: t.invoiceNumber || 'GROUP-COST',
            date: t.issueDate || t.createdAt || t.date || '-',
            partnerName: t.supplierName || (isAr ? 'مورد البرنامج السياحي' : 'Tour Operator'),
            serviceType: isAr ? 'كلفة برامج سياحية' : 'Group Tour Cost',
            amountIQD: isUSD ? 0 : buy,
            amountUSD: isUSD ? buy : 0,
            currency: isUSD ? 'USD' : 'IQD',
            status: 'PAYABLE',
            passengerOrNotes: t.groupName || t.programName || t.destination,
          };
        });

      setDrilldownData({
        code: '3115',
        title: isAr ? 'كلفة البرامج والمجموعات السياحية المباشرة' : 'Direct Cost of Group Tours',
        amountIQD: vm.breakdown.GROUPS.costIQD,
        amountUSD: vm.breakdown.GROUPS.costUSD,
        explanation: isAr
          ? 'الكلفة المباشرة للرحلات والبرامج الجماعية المستحقة لمنظمي الرحلات والشركات السياحية الشريكة.'
          : 'Direct costs payable to tour operators and service providers for organized group packages.',
        targetRoute: '/groups',
        targetRouteLabel: isAr ? 'الانتقال إلى سجل المجموعات والكروبات' : 'Go to Group Tours',
        items,
      });
    } else if (lineKey === '312') {
      const items: DrilldownItem[] = dateFilteredTickets
        .filter((t: any) => isRefundTicket(t))
        .map((t: any) => {
          const ref = getTicketRefundBreakdown(t);
          return {
            id: t.id || t.invoiceNumber || Math.random().toString(),
            refNumber: t.invoiceNumber || 'REF-COST',
            date: t.issueDate || t.createdAt || t.date || '-',
            partnerName: t.supplierName || t.airline || (isAr ? 'مورد التذاكر' : 'Supplier'),
            serviceType: isAr ? 'استرداد تكلفة تذاكر' : 'Ticket Cost Refund',
            amountIQD: ref.isUSD ? 0 : ref.netRefundSupplier,
            amountUSD: ref.isUSD ? ref.netRefundSupplier : 0,
            currency: ref.isUSD ? 'USD' : 'IQD',
            status: 'REFUNDED',
            passengerOrNotes: isAr ? 'مردود التكلفة من المورد' : 'Supplier cost refund',
          };
        });

      setDrilldownData({
        code: '312',
        title: isAr ? 'مردودات واستردادات التكلفة من الموردين وخطوط الطيران' : 'Purchase Returns & Supplier Refunds',
        amountIQD: vm.purchaseReturnsIQD,
        amountUSD: vm.purchaseReturnsUSD,
        explanation: isAr
          ? 'المبالغ والتكاليف المسترجعة من خطوط الطيران والموردين لصالح الشركة عن التذاكر الملغاة.'
          : 'Cost amounts recovered and credited by airlines and suppliers for cancelled tickets.',
        targetRoute: '/refunds',
        targetRouteLabel: isAr ? 'الانتقال إلى شاشة استرجاع التذاكر' : 'Go to Ticket Refunds',
        items,
      });
    } else if (lineKey === '3') {
      setDrilldownData({
        code: isAr ? 'دليل 3' : 'Code 3',
        title: isAr ? 'صافي كلفة النشاط الجاري المباشرة' : 'Net Direct Operating Costs',
        amountIQD: vm.netDirectCostIQD,
        amountUSD: vm.netDirectCostUSD,
        explanation: isAr
          ? `معادلة صافي الكلفة المباشرة: إجمالي كلفة المشتريات (${vm.grossDirectCostIQD.toLocaleString()} د.ع) - مردودات الموردين (${vm.purchaseReturnsIQD.toLocaleString()} د.ع) = ${vm.netDirectCostIQD.toLocaleString()} د.ع.`
          : `Net direct cost formula: Gross Purchases (${vm.grossDirectCostIQD.toLocaleString()}) - Supplier Returns (${vm.purchaseReturnsIQD.toLocaleString()}) = ${vm.netDirectCostIQD.toLocaleString()}.`,
        targetRoute: '/tickets',
        targetRouteLabel: isAr ? 'الانتقال إلى العمليات' : 'Go to Operations',
        items: [],
      });
    } else if (lineKey === 'INCIDENTAL_TOTAL') {
      const allIncidentalItems: DrilldownItem[] = [];
      vm.incidentalBreakdown.forEach((acc) => {
        allIncidentalItems.push(...acc.lines);
      });

      setDrilldownData({
        code: '42 / 43 / 48 / 49',
        title: isAr ? 'إجمالي الإيرادات والأرباح العرضية والمتنوعة' : 'Total Incidental & Other Revenues',
        amountIQD: vm.totalIncidentalRevenuesIQD,
        amountUSD: vm.totalIncidentalRevenuesUSD,
        explanation: isAr
          ? 'يمثل هذا المبلغ إجمالي الأرباح والإيرادات غير التشغيلية والعرضية مثل عمولات وحوافز شركات الطيران، أرباح فروقات أسعار الصرف، وأي إيرادات متنوعة.'
          : 'Total incidental and non-operating revenues such as airline overrides, forex conversion gains, and miscellaneous revenues.',
        targetRoute: '/journal-entries',
        targetRouteLabel: isAr ? 'الانتقال إلى قيود اليومية' : 'Go to Journal Entries',
        items: allIncidentalItems,
      });
    } else if (
      vm.customOperatingRevenues.some((acc) => acc.code === lineKey || acc.id === lineKey) ||
      vm.customDirectCosts.some((acc) => acc.code === lineKey || acc.id === lineKey) ||
      vm.incidentalBreakdown.some((acc) => acc.code === lineKey || acc.id === lineKey) ||
      vm.detailedOperatingExpenses.some((acc) => acc.code === lineKey || acc.id === lineKey)
    ) {
      const targetAcc =
        vm.customOperatingRevenues.find((acc) => acc.code === lineKey || acc.id === lineKey) ||
        vm.customDirectCosts.find((acc) => acc.code === lineKey || acc.id === lineKey) ||
        vm.incidentalBreakdown.find((acc) => acc.code === lineKey || acc.id === lineKey) ||
        vm.detailedOperatingExpenses.find((acc) => acc.code === lineKey || acc.id === lineKey);

      if (targetAcc) {
        setDrilldownData({
          code: targetAcc.code,
          title: targetAcc.nameAr || targetAcc.code,
          amountIQD: targetAcc.amountIQD,
          amountUSD: targetAcc.amountUSD,
          explanation: isAr
            ? `كشف الحركات والقيود والسندات المسجلة على الحساب (${targetAcc.code} - ${targetAcc.nameAr}) خلال الفترة المحددة.`
            : `Transactions and journal entries posted to account (${targetAcc.code} - ${targetAcc.nameAr}) during the selected period.`,
          targetRoute: `/account-statement/${targetAcc.id}`,
          targetRouteLabel: isAr ? 'عرض كشف الحساب التفصيلي' : 'View Account Statement',
          items: targetAcc.lines,
        });
      }
    } else if (lineKey === 'OPERATING_EXPENSES') {
      const items: DrilldownItem[] = expenseTransactions.map((e) => ({
        id: e.id || Math.random().toString(),
        refNumber: e.ref || 'EXP',
        date: e.date || '-',
        partnerName: e.accountName || (isAr ? 'مصروف' : 'Expense'),
        serviceType: e.accountCode || (isAr ? 'مصاريف عمومية' : 'Expenses'),
        amountIQD: e.amountIQD,
        amountUSD: e.amountUSD,
        currency: e.amountUSD > 0 ? 'USD' : 'IQD',
        status: 'PAID',
        passengerOrNotes: e.description || e.accountName,
      }));

      setDrilldownData({
        code: '31 / 32 / 33 / 38',
        title: isAr ? 'المصروفات والخدمات الإدارية والتشغيلية والعمومية' : 'Operating & Administrative Expenses',
        amountIQD: vm.operatingExpensesIQD,
        amountUSD: vm.operatingExpensesUSD,
        explanation: isAr
          ? 'المصروفات الإدارية والتشغيلية المدفوعة خلال الفترة بما يشمل الرواتب، الإيجارات، الكهرباء، الاتصالات، ونفقات المكاتب.'
          : 'Administrative and operational expenses paid during the period including staff salaries, rents, utilities, and office expenses.',
        targetRoute: '/vouchers',
        targetRouteLabel: isAr ? 'الانتقال إلى سندات الصرف' : 'Go to Payment Vouchers',
        items,
      });
    } else if (lineKey === 'GROSS_PROFIT') {
      setDrilldownData({
        code: isAr ? 'مجمل الربح' : 'Gross Profit',
        title: isAr ? 'ثالثاً: مجمل الربح التشغيلي التجاري' : 'III. Gross Operating Profit',
        amountIQD: vm.grossProfitIQD,
        amountUSD: vm.grossProfitUSD,
        explanation: isAr
          ? `معادلة مجمل الربح التشغيلي: صافي إيرادات النشاط الجاري (${vm.netOperatingRevenueIQD.toLocaleString()} د.ع) - صافي كلفة النشاط الجاري (${vm.netDirectCostIQD.toLocaleString()} د.ع) = ${vm.grossProfitIQD.toLocaleString()} د.ع بهامش ربح (${vm.profitMarginIQD.toFixed(1)}%).`
          : `Gross operating profit formula: Net Operating Revenues (${vm.netOperatingRevenueIQD.toLocaleString()}) - Net Direct Costs (${vm.netDirectCostIQD.toLocaleString()}) = ${vm.grossProfitIQD.toLocaleString()} (Margin: ${vm.profitMarginIQD.toFixed(1)}%).`,
        targetRoute: '/profits',
        targetRouteLabel: isAr ? 'الانتقال إلى لوحة تحليل الربحية' : 'Go to Profitability Dashboard',
        items: [],
      });
    } else if (lineKey === 'NET_PROFIT') {
      setDrilldownData({
        code: isAr ? 'صافي نهائي' : 'Final Net',
        title: isAr ? 'سادساً: صافي الربح الحقيقي الشامل المعتمد' : 'VI. Certified Comprehensive Net Profit',
        amountIQD: vm.netProfitIQD,
        amountUSD: vm.netProfitUSD,
        explanation: isAr
          ? `معادلة صافي الربح الشامل المعتمد: مجمل الربح التشغيلي (${vm.grossProfitIQD.toLocaleString()} د.ع) + الإيرادات والأرباح العرضية (${vm.totalIncidentalRevenuesIQD.toLocaleString()} د.ع) - المصروفات الإدارية والتشغيلية (${vm.operatingExpensesIQD.toLocaleString()} د.ع) = ${vm.netProfitIQD.toLocaleString()} د.ع.`
          : `Certified Net Profit Formula: Gross Operating Profit (${vm.grossProfitIQD.toLocaleString()}) + Incidental Revenues (${vm.totalIncidentalRevenuesIQD.toLocaleString()}) - Operating Expenses (${vm.operatingExpensesIQD.toLocaleString()}) = ${vm.netProfitIQD.toLocaleString()}.`,
        targetRoute: '/profits',
        targetRouteLabel: isAr ? 'الانتقال إلى لوحة تحليل الربحية' : 'Go to Profitability Dashboard',
        items: [],
      });
    }

    setDrilldownModalOpen(true);
  }, [dateFilteredTickets, expenseTransactions, getTicketRefundBreakdown, isAr, isFlightTicket, isHotelTicket, isGroupTicket, isRefundTicket, isVisaTicket, vm]);

  const filteredDrilldownItems = useMemo(() => {
    if (!drilldownData || !drilldownData.items) return [];
    if (!drilldownSearchQuery.trim()) return drilldownData.items;
    const q = drilldownSearchQuery.toLowerCase();
    return drilldownData.items.filter((item) =>
      item.refNumber.toLowerCase().includes(q) ||
      item.partnerName.toLowerCase().includes(q) ||
      item.serviceType.toLowerCase().includes(q) ||
      (item.passengerOrNotes && item.passengerOrNotes.toLowerCase().includes(q))
    );
  }, [drilldownData, drilldownSearchQuery]);

  const exportToExcel = useCallback(() => {
    try {
      const periodStr = endDate ? endDate.toLocaleDateString('en-CA') : '2026-12-31';
      
      // Build Sheet Data with Explicit Types & Formatting
      const data: (string | number | { v: string | number; t?: string; z?: string; s?: any })[][] = [
        [{ v: isAr ? 'قائمة الدخل وحساب الأرباح والخسائر' : 'Statement of Income & Profit / Loss', t: 's' }, '', '', ''],
        [{ v: isAr ? `شركة الروضتين للسياحة والسفر — ${selectedBranchName}` : `Al-Rawdatain for Tourism & Travel — ${selectedBranchName}`, t: 's' }, '', '', ''],
        [{ v: isAr ? `عن الفترة المنتهية في: ${periodStr}` : `For the period ended: ${periodStr}`, t: 's' }, '', '', ''],
        [{ v: isAr ? `الأساس: الاستحقاق المحاسبي | العملة: ${currency}` : `Basis: Accrual Accounting | Currency: ${currency}`, t: 's' }, '', '', ''],
        ['', '', '', ''],
        [
          { v: isAr ? 'البيان المحاسبي' : 'Account & Description', t: 's' },
          { v: isAr ? 'رقم الدليل' : 'Code', t: 's' },
          { v: isAr ? 'المبلغ (دينار عراقي IQD)' : 'Amount (IQD)', t: 's' },
          { v: isAr ? 'المبلغ (دولار USD)' : 'Amount (USD $)', t: 's' },
        ],
        // ── 1. Operating Revenues
        [{ v: isAr ? 'أولاً: إيرادات النشاط الجاري' : 'I. Operating Revenues', t: 's' }, '', '', ''],
        [
          { v: isAr ? '  إيرادات مبيعات تذاكر الطيران الصادرة' : '  Flight Tickets Sales Revenue', t: 's' },
          { v: '4111', t: 's' },
          { v: vm.breakdown.FLIGHT_TICKETS.salesIQD, t: 'n', z: '#,##0' },
          { v: vm.breakdown.FLIGHT_TICKETS.salesUSD, t: 'n', z: '#,##0' }
        ],
        [
          { v: isAr ? '  إيرادات خدمات إصدار الفيزا والتأشيرات' : '  Visas & Permits Issuance Revenue', t: 's' },
          { v: '4113', t: 's' },
          { v: vm.breakdown.VISAS.salesIQD, t: 'n', z: '#,##0' },
          { v: vm.breakdown.VISAS.salesUSD, t: 'n', z: '#,##0' }
        ],
        [
          { v: isAr ? '  إيرادات خدمات وحجوزات الفنادق والإقامة' : '  Hotel Bookings & Accommodation Revenue', t: 's' },
          { v: '4114', t: 's' },
          { v: vm.breakdown.HOTELS.salesIQD, t: 'n', z: '#,##0' },
          { v: vm.breakdown.HOTELS.salesUSD, t: 'n', z: '#,##0' }
        ],
        [
          { v: isAr ? '  إيرادات البرامج والمجموعات السياحية (الكروبات)' : '  Group Tours & Packages Revenue', t: 's' },
          { v: '4115', t: 's' },
          { v: vm.breakdown.GROUPS.salesIQD, t: 'n', z: '#,##0' },
          { v: vm.breakdown.GROUPS.salesUSD, t: 'n', z: '#,##0' }
        ],
        [
          { v: isAr ? 'إجمالي مبيعات وخدمات النشاط الجاري' : 'Gross Operating Revenues', t: 's' },
          { v: '411', t: 's' },
          { v: vm.grossRevenueIQD, t: 'n', z: '#,##0' },
          { v: vm.grossRevenueUSD, t: 'n', z: '#,##0' }
        ],
        [
          { v: isAr ? '  (مردودات مبيعات التذاكر المستردة للعملاء)' : '  (Customer Sales Returns & Refunds)', t: 's' },
          { v: '412', t: 's' },
          { v: -vm.salesReturnsIQD, t: 'n', z: '[Red](#,##0);[Red](#,##0);"-"' },
          { v: -vm.salesReturnsUSD, t: 'n', z: '[Red](#,##0);[Red](#,##0);"-"' }
        ],
        [
          { v: isAr ? '  عمولات واستقطاعات استرجاع وتعديل التذاكر' : '  Refund & Reissue Commissions Revenue', t: 's' },
          { v: '4112 / 432', t: 's' },
          { v: vm.refundServiceRevenueIQD, t: 'n', z: '#,##0' },
          { v: vm.refundServiceRevenueUSD, t: 'n', z: '#,##0' }
        ],
        [
          { v: isAr ? 'صافي إيرادات النشاط الجاري (411 - 412 + 4112)' : 'Net Operating Revenues (411 - 412 + 4112)', t: 's' },
          { v: '4', t: 's' },
          { v: vm.netOperatingRevenueIQD, t: 'n', z: '#,##0' },
          { v: vm.netOperatingRevenueUSD, t: 'n', z: '#,##0' }
        ],
        ['', '', '', ''],
        // ── 2. Direct Costs
        [{ v: isAr ? 'ثانياً: تكاليف واستخدامات النشاط الجاري المباشرة' : 'II. Direct Operating Costs', t: 's' }, '', '', ''],
        [
          { v: isAr ? '  كلفة شراء تذاكر الطيران من خطوط الطيران والمنصات' : '  Cost of Flight Tickets Purchased', t: 's' },
          { v: '3111', t: 's' },
          { v: vm.breakdown.FLIGHT_TICKETS.costIQD, t: 'n', z: '#,##0' },
          { v: vm.breakdown.FLIGHT_TICKETS.costUSD, t: 'n', z: '#,##0' }
        ],
        [
          { v: isAr ? '  كلفة إصدار الفيزا والتأشيرات المباشرة' : '  Direct Cost of Visas & Permits', t: 's' },
          { v: '3113', t: 's' },
          { v: vm.breakdown.VISAS.costIQD, t: 'n', z: '#,##0' },
          { v: vm.breakdown.VISAS.costUSD, t: 'n', z: '#,##0' }
        ],
        [
          { v: isAr ? '  كلفة حجوزات الفنادق والإقامة المباشرة' : '  Direct Cost of Hotel Bookings', t: 's' },
          { v: '3114', t: 's' },
          { v: vm.breakdown.HOTELS.costIQD, t: 'n', z: '#,##0' },
          { v: vm.breakdown.HOTELS.costUSD, t: 'n', z: '#,##0' }
        ],
        [
          { v: isAr ? '  كلفة البرامج والمجموعات السياحية المباشرة' : '  Direct Cost of Group Tours', t: 's' },
          { v: '3115', t: 's' },
          { v: vm.breakdown.GROUPS.costIQD, t: 'n', z: '#,##0' },
          { v: vm.breakdown.GROUPS.costUSD, t: 'n', z: '#,##0' }
        ],
        [
          { v: isAr ? 'إجمالي كلفة مشتريات النشاط الجاري' : 'Gross Direct Operating Costs', t: 's' },
          { v: '311', t: 's' },
          { v: vm.grossDirectCostIQD, t: 'n', z: '#,##0' },
          { v: vm.grossDirectCostUSD, t: 'n', z: '#,##0' }
        ],
        [
          { v: isAr ? '  (مردودات واستردادات التكلفة من الموردين وخطوط الطيران)' : '  (Purchase Returns & Supplier Refunds)', t: 's' },
          { v: '312', t: 's' },
          { v: -vm.purchaseReturnsIQD, t: 'n', z: '[Red](#,##0);[Red](#,##0);"-"' },
          { v: -vm.purchaseReturnsUSD, t: 'n', z: '[Red](#,##0);[Red](#,##0);"-"' }
        ],
        [
          { v: isAr ? 'صافي كلفة النشاط الجاري المباشرة (311 - 312)' : 'Net Direct Operating Costs (311 - 312)', t: 's' },
          { v: '3', t: 's' },
          { v: vm.netDirectCostIQD, t: 'n', z: '#,##0' },
          { v: vm.netDirectCostUSD, t: 'n', z: '#,##0' }
        ],
        ['', '', '', ''],
        // ── 3. Gross Profit
        [
          { v: isAr ? 'ثالثاً: مجمل الربح التشغيلي التجاري' : 'III. Gross Operating Profit', t: 's' },
          { v: `${vm.profitMarginIQD.toFixed(1)}%`, t: 's' },
          { v: vm.grossProfitIQD, t: 'n', z: '#,##0' },
          { v: vm.grossProfitUSD, t: 'n', z: '#,##0' }
        ],
        ['', '', '', ''],
        // ── 4. Incidental & Other Revenues
        [{ v: isAr ? 'رابعاً: الإيرادات والأرباح العرضية والمتنوعة (42 / 43 / 48 / 49)' : 'IV. Incidental & Other Revenues (42 / 43 / 48 / 49)', t: 's' }, '', '', ''],
        ...vm.incidentalBreakdown
          .filter((acc) => acc.amountIQD !== 0 || acc.amountUSD !== 0)
          .map((acc) => [
            { v: `  ${acc.nameAr}`, t: 's' },
            { v: acc.code, t: 's' },
            { v: acc.amountIQD, t: 'n', z: '#,##0' },
            { v: acc.amountUSD, t: 'n', z: '#,##0' }
          ]),
        [
          { v: isAr ? 'إجمالي الإيرادات والأرباح العرضية والأخرى' : 'Total Incidental & Other Revenues', t: 's' },
          { v: '42/43/48/49', t: 's' },
          { v: vm.totalIncidentalRevenuesIQD, t: 'n', z: '#,##0' },
          { v: vm.totalIncidentalRevenuesUSD, t: 'n', z: '#,##0' }
        ],
        ['', '', '', ''],
        // ── 5. Operating Expenses
        [{ v: isAr ? 'خامساً: المصروفات والخدمات الإدارية والعمومية (311 / 32 / 33 / 38)' : 'V. Operating & Administrative Expenses (311 / 32 / 33 / 38)', t: 's' }, '', '', ''],
        [
          { v: isAr ? '  المصروفات الإدارية والتشغيلية وسندات الصرف والرواتب' : '  Administrative, Operating Expenses & Salaries', t: 's' },
          { v: '32/33/38', t: 's' },
          { v: -vm.operatingExpensesIQD, t: 'n', z: '[Red](#,##0);[Red](#,##0);"-"' },
          { v: -vm.operatingExpensesUSD, t: 'n', z: '[Red](#,##0);[Red](#,##0);"-"' }
        ],
        ['', '', '', ''],
        // ── 6. Certified Comprehensive Net Profit
        [
          { v: isAr ? 'سادساً: صافي الربح الحقيقي الشامل المعتمد' : 'VI. Certified Comprehensive Net Profit', t: 's' },
          { v: isAr ? 'صافي نهائي' : 'Final Net', t: 's' },
          { v: vm.netProfitIQD, t: 'n', z: '#,##0' },
          { v: vm.netProfitUSD, t: 'n', z: '#,##0' }
        ],
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(data);

      // Merge Title Rows A1:D1, A2:D2, A3:D3, A4:D4
      worksheet['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: 3 } },
      ];

      // Set Generous Professional Column Widths
      worksheet['!cols'] = [
        { wch: 52 }, // Account description
        { wch: 16 }, // Code
        { wch: 24 }, // Amount IQD
        { wch: 22 }, // Amount USD
      ];

      // Format all cells in the sheet for formatting
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:D30');
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = worksheet[cellAddress];
          if (!cell) continue;

          // Apply number format if numeric
          if (cell.t === 'n' && !cell.z) {
            cell.z = '#,##0';
          }
        }
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, isAr ? 'قائمة الدخل' : 'Income Statement');

      const fileName = `Income_Statement_${periodStr}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      showSuccessNotification(
        isAr ? 'تم تصدير Excel بنجاح' : 'Excel Export Complete',
        isAr ? `تم حفظ الملف: ${fileName}` : `File saved: ${fileName}`
      );
    } catch (err) {
      console.error('Failed to export Excel:', err);
    }
  }, [currency, endDate, isAr, selectedBranchName, vm]);

  const accountComboboxOptions: ComboboxOption[] = useMemo(() => {
    return allAccounts
      .filter((a) => !(a as any).isGroup && !(a as any).isParent)
      .map((a) => {
        const typeLabel =
          a.type === 'REVENUE'
            ? (isAr ? 'إيرادات' : 'Revenue')
            : a.type === 'EXPENSE'
            ? (isAr ? 'مصروفات' : 'Expense')
            : a.type === 'ASSET'
            ? (isAr ? 'أصول' : 'Asset')
            : a.type === 'LIABILITY'
            ? (isAr ? 'خصوم' : 'Liability')
            : (isAr ? 'حقوق ملكية' : 'Equity');

        return {
          value: a.id,
          label: a.nameAr,
          code: a.code,
          name: a.nameAr,
          nameAr: a.nameAr,
          nameEn: a.nameEn,
          subLabel: `${a.code} • ${typeLabel}`,
        };
      });
  }, [allAccounts, isAr]);

  const renderIncomeStatementDocument = () => (
    <div 
      ref={statementContainerRef}
      className={`w-full max-w-4xl mx-auto bg-white rounded-xl border border-slate-300 p-5 sm:p-6 space-y-3.5 text-slate-900 shadow-sm transition-all ${isFullscreen ? 'fixed inset-0 z-50 overflow-y-auto p-8' : ''}`}
      style={{ 
        fontFamily: isAr ? "'IBM Plex Sans Arabic', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" : "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : 'none',
        transformOrigin: 'top center'
      }}
    >
      {/* ── Compact Document Header ── */}
      <div className="border-b border-slate-900 pb-3">
        <div className="grid grid-cols-3 items-center w-full">
          <div className={`${isAr ? 'text-right' : 'text-left'} space-y-0.5`}>
            <div className="text-sm font-bold text-slate-950">{isAr ? 'شركة الروضتين للسياحة والسفر' : 'Al-Rawdatain for Tourism & Travel'}</div>
            <div className="text-[11px] text-slate-600">{isAr ? 'المركز:' : 'Branch:'} <span className="font-bold text-slate-900">{selectedBranchName}</span></div>
          </div>

          <div className="text-center space-y-0.5">
            <h2 className="text-base font-black text-slate-950">
              {isAr ? 'قائمة الدخل وحساب الأرباح والخسائر' : 'Statement of Income & Profit / Loss'}
            </h2>
            <div className="text-[11px] text-slate-700 font-bold">
              {isAr ? 'عن الفترة المنتهية في' : 'For the period ended'}{' '}
              <span className="font-mono font-black text-slate-950">{endDate ? endDate.toLocaleDateString('en-CA') : '2026-12-31'}</span>
            </div>
          </div>

          <div className={`${isAr ? 'text-left' : 'text-right'} space-y-0.5 text-[11px] text-slate-700`}>
            <div>{isAr ? 'المرجع:' : 'Ref:'} <strong className="text-slate-950 font-bold">PL-2026-FY</strong></div>
            <div>{isAr ? 'الأساس:' : 'Basis:'} <strong className="text-slate-950 font-bold">{isAr ? 'الاستحقاق المحاسبي' : 'Accrual Accounting'}</strong></div>
            <div>{isAr ? 'العملة:' : 'Currency:'} <strong className="text-slate-950 font-bold">{currency === 'USD' ? (isAr ? 'دولار ($)' : 'USD ($)') : currency === 'IQD' ? (isAr ? 'دينار (د.ع)' : 'IQD') : (isAr ? 'دينار / دولار' : 'IQD / USD')}</strong></div>
          </div>
        </div>
      </div>

      {/* ── Pure Bilingual Accounting Table with Drill-down Action Points ── */}
      <div className="border border-slate-300 rounded-lg overflow-hidden text-[12px] bg-white">
        <div className="grid grid-cols-12 bg-slate-100 border-b border-slate-300 text-slate-950 font-black py-2 px-3 text-[12.5px]">
          <div className="col-span-7 font-black">{isAr ? 'البيان المحاسبي' : 'Account & Description'}</div>
          <div className="col-span-2 text-center font-black">{isAr ? 'رقم الدليل' : 'Code'}</div>
          <div className={`col-span-3 ${isAr ? 'text-left' : 'text-right'} font-mono font-black`}>{isAr ? `المبلغ (${currency === 'USD' ? 'دولار' : currency === 'IQD' ? 'دينار' : 'الكل'})` : `Amount (${currency})`}</div>
        </div>

        <div className="divide-y divide-slate-200">
          {/* 1. Operating Revenue (White) */}
          <div className="bg-white px-3 py-1.5 font-black text-slate-950 flex justify-between items-center text-[12px] group">
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-950">{isAr ? 'أولاً: إيرادات النشاط الجاري' : 'I. Operating Revenues'}</span>
              <button
                type="button"
                onClick={() => openAuditDrilldown('411')}
                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-[#F45A0A] p-0.5 rounded transition-all cursor-pointer"
                title={isAr ? 'كشف مسار إجمالي الإيرادات' : 'Audit Trail of Gross Revenues'}
              >
                <Layers size={13} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setTargetSectionForInclude('OPERATING_REVENUE');
                  setSelectedAccountIdToInclude('');
                  setIncludeAccountModalOpen(true);
                }}
                className="h-6 px-2 bg-orange-50 hover:bg-orange-100 text-[#F45A0A] border border-orange-200 rounded-lg text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                title={isAr ? 'تضمين حساب إيراد من شجرة الحسابات' : 'Include revenue account from chart'}
              >
                <BookmarkPlus size={12} />
                <span>{isAr ? '+ تضمين حساب من الشجرة' : '+ Include Account'}</span>
              </button>
              <span className="font-black text-slate-700 font-mono text-[11.5px]">{isAr ? 'إيرادات الخدمات السياحية' : 'Tourism Services Revenue'}</span>
            </div>
          </div>

          <div className="grid grid-cols-12 px-3 py-1.5 items-center bg-white group hover:bg-orange-50/30 transition-colors">
            <div className="col-span-7 pr-1 flex items-center justify-between">
              <span className="font-bold text-slate-950">{isAr ? 'إيرادات مبيعات تذاكر الطيران الصادرة' : 'Flight Tickets Sales Revenue'}</span>
              <button
                type="button"
                onClick={() => openAuditDrilldown('4111')}
                className="opacity-0 group-hover:opacity-100 bg-orange-50 hover:bg-orange-100 text-[#F45A0A] px-1.5 py-0.5 rounded text-[10.5px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                title={isAr ? 'كشف مسار وتفاصيل فواتير تذاكر الطيران' : 'Audit Trail of Flight Tickets'}
              >
                <Layers size={11} />
                <span>{isAr ? 'مسار المبلغ' : 'Audit Trail'}</span>
              </button>
            </div>
            <div className="col-span-2 text-center font-mono font-black text-slate-800">4111</div>
            <div className={`col-span-3 ${isAr ? 'text-left' : 'text-right'} font-mono font-black text-slate-950 tabular-nums`}>
              {fmtNum(vm.breakdown.FLIGHT_TICKETS.salesIQD, vm.breakdown.FLIGHT_TICKETS.salesUSD)}
            </div>
          </div>

          <div className="grid grid-cols-12 px-3 py-1.5 items-center bg-white group hover:bg-orange-50/30 transition-colors">
            <div className="col-span-7 pr-1 flex items-center justify-between">
              <span className="font-bold text-slate-950">{isAr ? 'إيرادات خدمات إصدار الفيزا والتأشيرات' : 'Visas & Permits Issuance Revenue'}</span>
              <button
                type="button"
                onClick={() => openAuditDrilldown('4113')}
                className="opacity-0 group-hover:opacity-100 bg-orange-50 hover:bg-orange-100 text-[#F45A0A] px-1.5 py-0.5 rounded text-[10.5px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                title={isAr ? 'كشف مسار وتفاصيل إيرادات الفيزا' : 'Audit Trail of Visas'}
              >
                <Layers size={11} />
                <span>{isAr ? 'مسار المبلغ' : 'Audit Trail'}</span>
              </button>
            </div>
            <div className="col-span-2 text-center font-mono font-black text-slate-800">4113</div>
            <div className={`col-span-3 ${isAr ? 'text-left' : 'text-right'} font-mono font-black text-slate-950 tabular-nums`}>
              {fmtNum(vm.breakdown.VISAS.salesIQD, vm.breakdown.VISAS.salesUSD)}
            </div>
          </div>

          <div className="grid grid-cols-12 px-3 py-1.5 items-center bg-white group hover:bg-orange-50/30 transition-colors">
            <div className="col-span-7 pr-1 flex items-center justify-between">
              <span className="font-bold text-slate-950">{isAr ? 'إيرادات خدمات وحجوزات الفنادق والإقامة' : 'Hotel Bookings & Accommodation Revenue'}</span>
              <button
                type="button"
                onClick={() => openAuditDrilldown('4114')}
                className="opacity-0 group-hover:opacity-100 bg-orange-50 hover:bg-orange-100 text-[#F45A0A] px-1.5 py-0.5 rounded text-[10.5px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                title={isAr ? 'كشف مسار وتفاصيل إيرادات الفنادق' : 'Audit Trail of Hotel Revenues'}
              >
                <Layers size={11} />
                <span>{isAr ? 'مسار المبلغ' : 'Audit Trail'}</span>
              </button>
            </div>
            <div className="col-span-2 text-center font-mono font-black text-slate-800">4114</div>
            <div className={`col-span-3 ${isAr ? 'text-left' : 'text-right'} font-mono font-black text-slate-950 tabular-nums`}>
              {fmtNum(vm.breakdown.HOTELS.salesIQD, vm.breakdown.HOTELS.salesUSD)}
            </div>
          </div>

          <div className="grid grid-cols-12 px-3 py-1.5 items-center bg-white group hover:bg-orange-50/30 transition-colors">
            <div className="col-span-7 pr-1 flex items-center justify-between">
              <span className="font-bold text-slate-950">{isAr ? 'إيرادات البرامج والمجموعات السياحية (الكروبات)' : 'Group Tours & Packages Revenue'}</span>
              <button
                type="button"
                onClick={() => openAuditDrilldown('4115')}
                className="opacity-0 group-hover:opacity-100 bg-orange-50 hover:bg-orange-100 text-[#F45A0A] px-1.5 py-0.5 rounded text-[10.5px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                title={isAr ? 'كشف مسار وتفاصيل إيرادات الكروبات' : 'Audit Trail of Group Tours'}
              >
                <Layers size={11} />
                <span>{isAr ? 'مسار المبلغ' : 'Audit Trail'}</span>
              </button>
            </div>
            <div className="col-span-2 text-center font-mono font-black text-slate-800">4115</div>
            <div className={`col-span-3 ${isAr ? 'text-left' : 'text-right'} font-mono font-black text-slate-950 tabular-nums`}>
              {fmtNum(vm.breakdown.GROUPS.salesIQD, vm.breakdown.GROUPS.salesUSD)}
            </div>
          </div>

          {/* Custom Included Operating Revenues from Tree */}
          {vm.customOperatingRevenues.map((acc) => (
            <div
              key={acc.id}
              className="grid grid-cols-12 px-3 py-1.5 items-center bg-orange-50/20 group hover:bg-orange-50/40 transition-colors border-l-2 border-orange-400"
            >
              <div className="col-span-7 pr-1 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-950">{isAr ? acc.nameAr : (acc.nameEn || acc.nameAr)}</span>
                  <span className="text-[9.5px] bg-orange-100 text-orange-800 px-1.5 py-0.2 rounded font-bold">
                    {isAr ? 'مخصص' : 'Custom'}
                  </span>
                  {acc.linesCount > 0 && (
                    <span className="text-[9.5px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono font-bold">
                      {acc.linesCount} {isAr ? 'حركة' : 'txns'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openAuditDrilldown(acc.code)}
                    className="opacity-0 group-hover:opacity-100 bg-orange-50 hover:bg-orange-100 text-[#F45A0A] px-1.5 py-0.5 rounded text-[10.5px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Layers size={11} />
                    <span>{isAr ? 'مسار المبلغ' : 'Audit Trail'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveCustomAccount(acc.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 p-0.5 rounded transition-all cursor-pointer"
                    title={isAr ? 'إلغاء تضمين الحساب' : 'Unpin'}
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
              <div className="col-span-2 text-center font-mono font-black text-slate-800">{acc.code}</div>
              <div className={`col-span-3 ${isAr ? 'text-left' : 'text-right'} font-mono font-black text-slate-950 tabular-nums`}>
                {fmtNum(acc.amountIQD, acc.amountUSD)}
              </div>
            </div>
          ))}

          <div className="grid grid-cols-12 px-3 py-1.5 bg-white font-black text-slate-950 items-center border-t border-slate-200 group hover:bg-orange-50/30 transition-colors">
            <div className="col-span-7 pr-1 flex items-center justify-between">
              <span className="font-black text-slate-950">{isAr ? 'إجمالي مبيعات وخدمات النشاط الجاري' : 'Gross Operating Revenues'}</span>
              <button
                type="button"
                onClick={() => openAuditDrilldown('411')}
                className="opacity-0 group-hover:opacity-100 bg-orange-50 hover:bg-orange-100 text-[#F45A0A] px-1.5 py-0.5 rounded text-[10.5px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                title={isAr ? 'كشف مسار وتفاصيل إجمالي المبيعات' : 'Audit Trail of Gross Sales'}
              >
                <Layers size={11} />
                <span>{isAr ? 'مسار المبلغ' : 'Audit Trail'}</span>
              </button>
            </div>
            <div className="col-span-2 text-center font-mono font-black text-slate-800">411</div>
            <div className={`col-span-3 ${isAr ? 'text-left' : 'text-right'} font-mono font-black text-slate-950 tabular-nums`}>
              {fmtNum(vm.grossRevenueIQD, vm.grossRevenueUSD)}
            </div>
          </div>

          <div className="grid grid-cols-12 px-3 py-1.5 items-center bg-white group hover:bg-rose-50/40 transition-colors">
            <div className="col-span-7 pr-1 flex items-center justify-between">
              <span className="font-bold text-slate-950">{isAr ? 'مردودات مبيعات التذاكر المستردة للعملاء' : 'Customer Sales Returns & Refunds'}</span>
              <button
                type="button"
                onClick={() => openAuditDrilldown('412')}
                className="opacity-0 group-hover:opacity-100 bg-rose-50 hover:bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded text-[10.5px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                title={isAr ? 'كشف مسار تذاكر المردودات المسترجعة' : 'Audit Trail of Sales Returns'}
              >
                <Layers size={11} />
                <span>{isAr ? 'مسار المبلغ' : 'Audit Trail'}</span>
              </button>
            </div>
            <div className="col-span-2 text-center font-mono font-black text-slate-800">412</div>
            <div className={`col-span-3 ${isAr ? 'text-left' : 'text-right'} font-mono font-black text-rose-600 tabular-nums`}>
              ({fmtNum(vm.salesReturnsIQD, vm.salesReturnsUSD)})
            </div>
          </div>

          <div className="grid grid-cols-12 px-3 py-1.5 items-center bg-white group hover:bg-orange-50/30 transition-colors">
            <div className="col-span-7 pr-1 flex items-center justify-between">
              <span className="font-bold text-slate-950">{isAr ? 'عمولات واستقطاعات استرجاع وتعديل التذاكر (إيراد الاسترجاع)' : 'Refund & Reissue Commissions Revenue'}</span>
              <button
                type="button"
                onClick={() => openAuditDrilldown('4112')}
                className="opacity-0 group-hover:opacity-100 bg-orange-50 hover:bg-orange-100 text-[#F45A0A] px-1.5 py-0.5 rounded text-[10.5px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                title={isAr ? 'كشف مسار عمولات واستقطاعات الاسترجاع' : 'Audit Trail of Refund Commissions'}
              >
                <Layers size={11} />
                <span>{isAr ? 'مسار المبلغ' : 'Audit Trail'}</span>
              </button>
            </div>
            <div className="col-span-2 text-center font-mono font-black text-slate-800">4112 / 432</div>
            <div className={`col-span-3 ${isAr ? 'text-left' : 'text-right'} font-mono font-black text-slate-950 tabular-nums`}>
              {fmtNum(vm.refundServiceRevenueIQD, vm.refundServiceRevenueUSD)}
            </div>
          </div>

          {/* Important Net Total (Grey) */}
          <div className="grid grid-cols-12 px-3 py-2 bg-slate-100 font-black text-slate-950 items-center border-t border-b border-slate-300 group hover:bg-slate-200/80 transition-colors">
            <div className="col-span-7 flex items-center justify-between">
              <span className="text-[13px] font-black text-slate-950">{isAr ? 'صافي إيرادات النشاط الجاري (411 - 412 + 4112)' : 'Net Operating Revenues (411 - 412 + 4112)'}</span>
              <button
                type="button"
                onClick={() => openAuditDrilldown('4')}
                className="opacity-0 group-hover:opacity-100 bg-white border border-slate-300 text-slate-800 px-1.5 py-0.5 rounded text-[10.5px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                title={isAr ? 'كشف معادلة ومسار صافي الإيراد' : 'Audit Trail of Net Revenue Formula'}
              >
                <Layers size={11} />
                <span>{isAr ? 'معادلة المسار' : 'Formula'}</span>
              </button>
            </div>
            <div className="col-span-2 text-center font-mono font-black text-slate-800">4</div>
            <div className={`col-span-3 ${isAr ? 'text-left' : 'text-right'} font-mono font-black text-slate-950 text-[13.5px] tabular-nums`}>
              {fmtNum(vm.netOperatingRevenueIQD, vm.netOperatingRevenueUSD)}
            </div>
          </div>

          {/* 2. Direct Costs (White) */}
          <div className="bg-white px-3 py-1.5 font-black text-slate-950 flex justify-between items-center text-[12px] group">
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-950">{isAr ? 'ثانياً: تكاليف واستخدامات النشاط الجاري المباشرة' : 'II. Direct Operating Costs'}</span>
              <button
                type="button"
                onClick={() => openAuditDrilldown('311')}
                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-[#F45A0A] p-0.5 rounded transition-all cursor-pointer"
                title={isAr ? 'كشف مسار التكاليف' : 'Audit Trail of Direct Costs'}
              >
                <Layers size={13} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setTargetSectionForInclude('DIRECT_COST');
                  setSelectedAccountIdToInclude('');
                  setIncludeAccountModalOpen(true);
                }}
                className="h-6 px-2 bg-orange-50 hover:bg-orange-100 text-[#F45A0A] border border-orange-200 rounded-lg text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                title={isAr ? 'تضمين حساب تكلفة من شجرة الحسابات' : 'Include cost account from chart'}
              >
                <BookmarkPlus size={12} />
                <span>{isAr ? '+ تضمين حساب من الشجرة' : '+ Include Account'}</span>
              </button>
              <span className="font-black text-slate-700 font-mono text-[11.5px]">{isAr ? 'كلفة المشتريات المباشرة' : 'Direct Purchase Costs'}</span>
            </div>
          </div>

          <div className="grid grid-cols-12 px-3 py-1.5 items-center bg-white group hover:bg-orange-50/30 transition-colors">
            <div className="col-span-7 pr-1 flex items-center justify-between">
              <span className="font-bold text-slate-950">{isAr ? 'كلفة شراء تذاكر الطيران من خطوط الطيران والمنصات' : 'Cost of Flight Tickets Purchased'}</span>
              <button
                type="button"
                onClick={() => openAuditDrilldown('3111')}
                className="opacity-0 group-hover:opacity-100 bg-orange-50 hover:bg-orange-100 text-[#F45A0A] px-1.5 py-0.5 rounded text-[10.5px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                title={isAr ? 'كشف مسار وتفاصيل تكلفة شراء التذاكر' : 'Audit Trail of Flight Costs'}
              >
                <Layers size={11} />
                <span>{isAr ? 'مسار المبلغ' : 'Audit Trail'}</span>
              </button>
            </div>
            <div className="col-span-2 text-center font-mono font-black text-slate-800">3111</div>
            <div className={`col-span-3 ${isAr ? 'text-left' : 'text-right'} font-mono font-black text-slate-950 tabular-nums`}>
              {fmtNum(vm.breakdown.FLIGHT_TICKETS.costIQD, vm.breakdown.FLIGHT_TICKETS.costUSD)}
            </div>
          </div>

          <div className="grid grid-cols-12 px-3 py-1.5 items-center bg-white group hover:bg-orange-50/30 transition-colors">
            <div className="col-span-7 pr-1 flex items-center justify-between">
              <span className="font-bold text-slate-950">{isAr ? 'كلفة إصدار الفيزا والتأشيرات المباشرة' : 'Direct Cost of Visas & Permits'}</span>
              <button
                type="button"
                onClick={() => openAuditDrilldown('3113')}
                className="opacity-0 group-hover:opacity-100 bg-orange-50 hover:bg-orange-100 text-[#F45A0A] px-1.5 py-0.5 rounded text-[10.5px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                title={isAr ? 'كشف مسار تكاليف الفيزا والتأشيرات' : 'Audit Trail of Visa Costs'}
              >
                <Layers size={11} />
                <span>{isAr ? 'مسار المبلغ' : 'Audit Trail'}</span>
              </button>
            </div>
            <div className="col-span-2 text-center font-mono font-black text-slate-800">3113</div>
            <div className={`col-span-3 ${isAr ? 'text-left' : 'text-right'} font-mono font-black text-slate-950 tabular-nums`}>
              {fmtNum(vm.breakdown.VISAS.costIQD, vm.breakdown.VISAS.costUSD)}
            </div>
          </div>

          <div className="grid grid-cols-12 px-3 py-1.5 items-center bg-white group hover:bg-orange-50/30 transition-colors">
            <div className="col-span-7 pr-1 flex items-center justify-between">
              <span className="font-bold text-slate-950">{isAr ? 'كلفة حجوزات الفنادق والإقامة المباشرة' : 'Direct Cost of Hotel Bookings'}</span>
              <button
                type="button"
                onClick={() => openAuditDrilldown('3114')}
                className="opacity-0 group-hover:opacity-100 bg-orange-50 hover:bg-orange-100 text-[#F45A0A] px-1.5 py-0.5 rounded text-[10.5px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                title={isAr ? 'كشف مسار تكاليف الفنادق' : 'Audit Trail of Hotel Costs'}
              >
                <Layers size={11} />
                <span>{isAr ? 'مسار المبلغ' : 'Audit Trail'}</span>
              </button>
            </div>
            <div className="col-span-2 text-center font-mono font-black text-slate-800">3114</div>
            <div className={`col-span-3 ${isAr ? 'text-left' : 'text-right'} font-mono font-black text-slate-950 tabular-nums`}>
              {fmtNum(vm.breakdown.HOTELS.costIQD, vm.breakdown.HOTELS.costUSD)}
            </div>
          </div>

          <div className="grid grid-cols-12 px-3 py-1.5 items-center bg-white group hover:bg-orange-50/30 transition-colors">
            <div className="col-span-7 pr-1 flex items-center justify-between">
              <span className="font-bold text-slate-950">{isAr ? 'كلفة البرامج والمجموعات السياحية المباشرة' : 'Direct Cost of Group Tours'}</span>
              <button
                type="button"
                onClick={() => openAuditDrilldown('3115')}
                className="opacity-0 group-hover:opacity-100 bg-orange-50 hover:bg-orange-100 text-[#F45A0A] px-1.5 py-0.5 rounded text-[10.5px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                title={isAr ? 'كشف مسار تكاليف البرامج السياحية' : 'Audit Trail of Group Tour Costs'}
              >
                <Layers size={11} />
                <span>{isAr ? 'مسار المبلغ' : 'Audit Trail'}</span>
              </button>
            </div>
            <div className="col-span-2 text-center font-mono font-black text-slate-800">3115</div>
            <div className={`col-span-3 ${isAr ? 'text-left' : 'text-right'} font-mono font-black text-slate-950 tabular-nums`}>
              {fmtNum(vm.breakdown.GROUPS.costIQD, vm.breakdown.GROUPS.costUSD)}
            </div>
          </div>

          {/* Custom Included Direct Costs from Tree */}
          {vm.customDirectCosts.map((acc) => (
            <div
              key={acc.id}
              className="grid grid-cols-12 px-3 py-1.5 items-center bg-orange-50/20 group hover:bg-orange-50/40 transition-colors border-l-2 border-orange-400"
            >
              <div className="col-span-7 pr-1 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-950">{isAr ? acc.nameAr : (acc.nameEn || acc.nameAr)}</span>
                  <span className="text-[9.5px] bg-orange-100 text-orange-800 px-1.5 py-0.2 rounded font-bold">
                    {isAr ? 'مخصص' : 'Custom'}
                  </span>
                  {acc.linesCount > 0 && (
                    <span className="text-[9.5px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono font-bold">
                      {acc.linesCount} {isAr ? 'حركة' : 'txns'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openAuditDrilldown(acc.code)}
                    className="opacity-0 group-hover:opacity-100 bg-orange-50 hover:bg-orange-100 text-[#F45A0A] px-1.5 py-0.5 rounded text-[10.5px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Layers size={11} />
                    <span>{isAr ? 'مسار المبلغ' : 'Audit Trail'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveCustomAccount(acc.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 p-0.5 rounded transition-all cursor-pointer"
                    title={isAr ? 'إلغاء تضمين الحساب' : 'Unpin'}
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
              <div className="col-span-2 text-center font-mono font-black text-slate-800">{acc.code}</div>
              <div className={`col-span-3 ${isAr ? 'text-left' : 'text-right'} font-mono font-black text-slate-950 tabular-nums`}>
                {fmtNum(acc.amountIQD, acc.amountUSD)}
              </div>
            </div>
          ))}

          <div className="grid grid-cols-12 px-3 py-1.5 bg-white font-black text-slate-950 items-center border-t border-slate-200 group hover:bg-orange-50/30 transition-colors">
            <div className="col-span-7 pr-1 flex items-center justify-between">
              <span className="font-black text-slate-950">{isAr ? 'إجمالي كلفة مشتريات النشاط الجاري' : 'Gross Direct Operating Costs'}</span>
              <button
                type="button"
                onClick={() => openAuditDrilldown('311')}
                className="opacity-0 group-hover:opacity-100 bg-orange-50 hover:bg-orange-100 text-[#F45A0A] px-1.5 py-0.5 rounded text-[10.5px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                title={isAr ? 'كشف مسار إجمالي المشتريات' : 'Audit Trail of Gross Costs'}
              >
                <Layers size={11} />
                <span>{isAr ? 'مسار المبلغ' : 'Audit Trail'}</span>
              </button>
            </div>
            <div className="col-span-2 text-center font-mono font-black text-slate-800">311</div>
            <div className={`col-span-3 ${isAr ? 'text-left' : 'text-right'} font-mono font-black text-slate-950 tabular-nums`}>
              {fmtNum(vm.grossDirectCostIQD, vm.grossDirectCostUSD)}
            </div>
          </div>

          <div className="grid grid-cols-12 px-3 py-1.5 items-center bg-white group hover:bg-rose-50/40 transition-colors">
            <div className="col-span-7 pr-1 flex items-center justify-between">
              <span className="font-bold text-slate-950">{isAr ? 'مردودات واستردادات التكلفة من الموردين وخطوط الطيران' : 'Purchase Returns & Supplier Refunds'}</span>
              <button
                type="button"
                onClick={() => openAuditDrilldown('312')}
                className="opacity-0 group-hover:opacity-100 bg-rose-50 hover:bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded text-[10.5px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                title={isAr ? 'كشف مسار استردادات التكلفة من الموردين' : 'Audit Trail of Supplier Refunds'}
              >
                <Layers size={11} />
                <span>{isAr ? 'مسار المبلغ' : 'Audit Trail'}</span>
              </button>
            </div>
            <div className="col-span-2 text-center font-mono font-black text-slate-800">312</div>
            <div className={`col-span-3 ${isAr ? 'text-left' : 'text-right'} font-mono font-black text-rose-600 tabular-nums`}>
              ({fmtNum(vm.purchaseReturnsIQD, vm.purchaseReturnsUSD)})
            </div>
          </div>

          {/* Important Net Total (Grey) */}
          <div className="grid grid-cols-12 px-3 py-2 bg-slate-100 font-black text-slate-950 items-center border-t border-b border-slate-300 group hover:bg-slate-200/80 transition-colors">
            <div className="col-span-7 flex items-center justify-between">
              <span className="text-[13px] font-black text-slate-950">{isAr ? 'صافي كلفة النشاط الجاري المباشرة (311 - 312)' : 'Net Direct Operating Costs (311 - 312)'}</span>
              <button
                type="button"
                onClick={() => openAuditDrilldown('3')}
                className="opacity-0 group-hover:opacity-100 bg-white border border-slate-300 text-slate-800 px-1.5 py-0.5 rounded text-[10.5px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                title={isAr ? 'كشف معادلة ومسار صافي الكلفة' : 'Audit Trail of Net Cost Formula'}
              >
                <Layers size={11} />
                <span>{isAr ? 'معادلة المسار' : 'Formula'}</span>
              </button>
            </div>
            <div className="col-span-2 text-center font-mono font-black text-slate-800">3</div>
            <div className={`col-span-3 ${isAr ? 'text-left' : 'text-right'} font-mono font-black text-slate-950 text-[13.5px] tabular-nums`}>
              {fmtNum(vm.netDirectCostIQD, vm.netDirectCostUSD)}
            </div>
          </div>

          {/* 3. Gross Profit (Grey) */}
          <div className="grid grid-cols-12 px-3 py-2 bg-slate-100 font-black text-slate-950 items-center border-t border-b border-slate-900 text-[13px] group hover:bg-slate-200/80 transition-colors">
            <div className="col-span-7 flex items-center justify-between">
              <span className="font-black text-slate-950">{isAr ? 'ثالثاً: مجمل الربح التشغيلي التجاري' : 'III. Gross Operating Profit'}</span>
              <button
                type="button"
                onClick={() => openAuditDrilldown('GROSS_PROFIT')}
                className="opacity-0 group-hover:opacity-100 bg-white border border-slate-300 text-slate-800 px-1.5 py-0.5 rounded text-[10.5px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                title={isAr ? 'كشف مسار وحساب مجمل الربح' : 'Audit Trail of Gross Profit'}
              >
                <Layers size={11} />
                <span>{isAr ? 'معادلة المسار' : 'Formula'}</span>
              </button>
            </div>
            <div className="col-span-2 text-center font-mono font-black text-slate-800 text-[11.5px]">
              {vm.profitMarginIQD.toFixed(1)}% {isAr ? 'هامش' : 'Margin'}
            </div>
            <div className={`col-span-3 ${isAr ? 'text-left' : 'text-right'} font-mono font-black text-slate-950 text-[14px] tabular-nums`}>
              {fmtNum(vm.grossProfitIQD, vm.grossProfitUSD)}
            </div>
          </div>

          {/* 4. Incidental & Other Revenues (Class 42 / 43 / 48 / 49) */}
          <div className="bg-white px-3 py-1.5 font-black text-slate-950 flex justify-between items-center text-[12px] border-t border-slate-300 group">
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-950">
                {isAr ? 'رابعاً: الإيرادات والأرباح العرضية والمتنوعة' : 'IV. Incidental & Other Revenues'}
              </span>
              <button
                type="button"
                onClick={() => openAuditDrilldown('INCIDENTAL_TOTAL')}
                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-[#F45A0A] p-0.5 rounded transition-all cursor-pointer"
                title={isAr ? 'كشف مسار الإيرادات العرضية' : 'Audit Trail of Incidental Revenues'}
              >
                <Layers size={13} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setTargetSectionForInclude('INCIDENTAL_REVENUE');
                  setSelectedAccountIdToInclude('');
                  setIncludeAccountModalOpen(true);
                }}
                className="h-6 px-2 bg-orange-50 hover:bg-orange-100 text-[#F45A0A] border border-orange-200 rounded-lg text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                title={isAr ? 'تضمين حساب إيراد من شجرة الحسابات' : 'Include revenue account from chart'}
              >
                <BookmarkPlus size={12} />
                <span>{isAr ? '+ تضمين حساب من الشجرة' : '+ Include Account'}</span>
              </button>
              <button
                type="button"
                onClick={() => setWizardModalOpen(true)}
                className="h-6 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                title={isAr ? 'إنشاء وإضافة حساب إيراد جديد إلى دليل الحسابات' : 'Create New Revenue Account in Chart'}
              >
                <Plus size={12} />
                <span>{isAr ? '+ إضافة حساب إيراد' : '+ Add Revenue Account'}</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/journal-entries?action=new')}
                className="h-6 px-2 bg-orange-50 hover:bg-orange-100 text-[#F45A0A] border border-orange-200 rounded-lg text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                title={isAr ? 'تسجيل قيد يومية لإيراد أو ربح عرضي' : 'Record Incidental Revenue Entry'}
              >
                <Coins size={12} />
                <span>{isAr ? '+ قيد إيراد عرضي' : '+ Incidental Entry'}</span>
              </button>
              <span className="font-black text-slate-700 font-mono text-[11.5px] mr-1">{isAr ? 'حسابات 42 / 43 / 48 / 49' : 'Codes 42/43/48/49'}</span>
            </div>
          </div>

          {/* Dynamic Incidental Accounts Listing */}
          {vm.incidentalBreakdown.length > 0 ? (
            vm.incidentalBreakdown
              .filter((acc) => acc.amountIQD !== 0 || acc.amountUSD !== 0 || acc.isCustomPinned || ['4231', '4234', '4241', '435', '4821', '492'].includes(acc.code))
              .map((acc) => (
                <div
                  key={acc.id || acc.code}
                  className="grid grid-cols-12 px-3 py-1.5 items-center bg-white group hover:bg-emerald-50/30 transition-colors"
                >
                  <div className="col-span-7 pr-1 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-950">{isAr ? acc.nameAr : (acc.nameEn || acc.nameAr)}</span>
                      {acc.isCustomPinned && (
                        <span className="text-[9.5px] bg-orange-100 text-orange-800 px-1.5 py-0.2 rounded font-bold">
                          {isAr ? 'مخصص' : 'Custom'}
                        </span>
                      )}
                      {acc.linesCount > 0 && (
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono font-bold">
                          {acc.linesCount} {isAr ? 'حركة' : 'txns'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openAuditDrilldown(acc.code)}
                        className="opacity-0 group-hover:opacity-100 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[10.5px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                        title={isAr ? 'كشف تفاصيل وحركات الحساب' : 'Audit Trail of Account'}
                      >
                        <Layers size={11} />
                        <span>{isAr ? 'مسار المبلغ' : 'Audit Trail'}</span>
                      </button>
                      {acc.isCustomPinned && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomAccount(acc.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 p-0.5 rounded transition-all cursor-pointer"
                          title={isAr ? 'إلغاء تضمين الحساب' : 'Unpin'}
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="col-span-2 text-center font-mono font-black text-slate-800">{acc.code}</div>
                  <div className={`col-span-3 ${isAr ? 'text-left' : 'text-right'} font-mono font-black text-slate-950 tabular-nums`}>
                    {fmtNum(acc.amountIQD, acc.amountUSD)}
                  </div>
                </div>
              ))
          ) : (
            <div className="px-4 py-2 bg-white text-xs text-slate-500 italic">
              {isAr ? 'لا توجد حركات إيرادات عرضية مسجلة في هذه الفترة' : 'No incidental revenue transactions recorded in this period'}
            </div>
          )}

          {/* Incidental Revenues Total Row */}
          <div className="grid grid-cols-12 px-3 py-2 bg-slate-100 font-black text-slate-950 items-center border-t border-b border-slate-300 group hover:bg-slate-200/80 transition-colors">
            <div className="col-span-7 flex items-center justify-between">
              <span className="text-[13px] font-black text-slate-950">
                {isAr ? 'إجمالي الإيرادات والأرباح العرضية والأخرى (42 + 43 + 48 + 49)' : 'Total Incidental & Other Revenues (42 + 43 + 48 + 49)'}
              </span>
              <button
                type="button"
                onClick={() => openAuditDrilldown('INCIDENTAL_TOTAL')}
                className="opacity-0 group-hover:opacity-100 bg-white border border-slate-300 text-slate-800 px-1.5 py-0.5 rounded text-[10.5px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                title={isAr ? 'كشف تفاصيل الإيرادات العرضية' : 'Audit Trail of Incidental Revenues'}
              >
                <Layers size={11} />
                <span>{isAr ? 'معادلة المسار' : 'Formula'}</span>
              </button>
            </div>
            <div className="col-span-2 text-center font-mono font-black text-slate-800">42/43/48/49</div>
            <div className={`col-span-3 ${isAr ? 'text-left' : 'text-right'} font-mono font-black text-emerald-700 text-[13.5px] tabular-nums`}>
              +{fmtNum(vm.totalIncidentalRevenuesIQD, vm.totalIncidentalRevenuesUSD)}
            </div>
          </div>

          {/* 5. Operating & Administrative Expenses */}
          <div className="bg-white px-3 py-1.5 font-black text-slate-950 flex justify-between items-center text-[12px] group">
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-950">
                {isAr ? 'خامساً: المصروفات والخدمات الإدارية والعمومية' : 'V. Operating & Administrative Expenses'}
              </span>
              <button
                type="button"
                onClick={() => openAuditDrilldown('OPERATING_EXPENSES')}
                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-[#F45A0A] p-0.5 rounded transition-all cursor-pointer"
                title={isAr ? 'كشف مسار المصروفات الإدارية' : 'Audit Trail of Operating Expenses'}
              >
                <Layers size={13} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setTargetSectionForInclude('OPERATING_EXPENSE');
                  setSelectedAccountIdToInclude('');
                  setIncludeAccountModalOpen(true);
                }}
                className="h-6 px-2 bg-orange-50 hover:bg-orange-100 text-[#F45A0A] border border-orange-200 rounded-lg text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                title={isAr ? 'تضمين حساب مصروف من شجرة الحسابات' : 'Include expense account from chart'}
              >
                <BookmarkPlus size={12} />
                <span>{isAr ? '+ تضمين حساب من الشجرة' : '+ Include Account'}</span>
              </button>
              <span className="font-black text-slate-700 font-mono text-[11.5px]">{isAr ? 'نفقات ورواتب وتشغيل' : 'Salaries & Operations'}</span>
            </div>
          </div>

          {vm.detailedOperatingExpenses.length > 0 ? (
            vm.detailedOperatingExpenses.map((acc) => (
              <div
                key={acc.id || acc.code}
                className="grid grid-cols-12 px-3 py-1.5 items-center bg-white group hover:bg-rose-50/30 transition-colors"
              >
                <div className="col-span-7 pr-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-950">{isAr ? acc.nameAr : (acc.nameEn || acc.nameAr)}</span>
                    {acc.isCustomPinned && (
                      <span className="text-[9.5px] bg-orange-100 text-orange-800 px-1.5 py-0.2 rounded font-bold">
                        {isAr ? 'مخصص' : 'Custom'}
                      </span>
                    )}
                    {acc.linesCount > 0 && (
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono font-bold">
                        {acc.linesCount} {isAr ? 'حركة' : 'txns'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openAuditDrilldown(acc.code)}
                      className="opacity-0 group-hover:opacity-100 bg-rose-50 hover:bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded text-[10.5px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                      title={isAr ? 'كشف تفاصيل المصروف' : 'Audit Trail of Expense'}
                    >
                      <Layers size={11} />
                      <span>{isAr ? 'مسار المبلغ' : 'Audit Trail'}</span>
                    </button>
                    {acc.isCustomPinned && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomAccount(acc.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 p-0.5 rounded transition-all cursor-pointer"
                        title={isAr ? 'إلغاء تضمين الحساب' : 'Unpin'}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="col-span-2 text-center font-mono font-black text-slate-800">{acc.code}</div>
                <div className={`col-span-3 ${isAr ? 'text-left' : 'text-right'} font-mono font-black text-rose-600 tabular-nums`}>
                  ({fmtNum(acc.amountIQD, acc.amountUSD)})
                </div>
              </div>
            ))
          ) : (
            <div className="grid grid-cols-12 px-3 py-1.5 items-center bg-white group hover:bg-rose-50/30 transition-colors">
              <div className="col-span-7 pr-1 flex items-center justify-between">
                <span className="font-bold text-slate-950">
                  {isAr ? 'المصروفات الإدارية والتشغيلية وسندات الصرف والرواتب' : 'Administrative, Operational Expenses & Salaries'}
                </span>
                <button
                  type="button"
                  onClick={() => openAuditDrilldown('OPERATING_EXPENSES')}
                  className="opacity-0 group-hover:opacity-100 bg-rose-50 hover:bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded text-[10.5px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                  title={isAr ? 'كشف مسار تفاصيل المصروفات' : 'Audit Trail of Expenses'}
                >
                  <Layers size={11} />
                  <span>{isAr ? 'مسار المبلغ' : 'Audit Trail'}</span>
                </button>
              </div>
              <div className="col-span-2 text-center font-mono font-black text-slate-800">32/33/38</div>
              <div className={`col-span-3 ${isAr ? 'text-left' : 'text-right'} font-mono font-black text-rose-600 tabular-nums`}>
                ({fmtNum(vm.operatingExpensesIQD, vm.operatingExpensesUSD)})
              </div>
            </div>
          )}

          {/* 6. Certified Comprehensive Net Profit (Final) */}
          <div className="grid grid-cols-12 px-3 py-2.5 bg-slate-100 text-slate-950 font-black items-center border-t-2 border-b-4 border-double border-slate-900 group hover:bg-slate-200/80 transition-colors">
            <div className="col-span-7 space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[13.5px] font-black text-slate-950">
                  {isAr ? 'سادساً: صافي الربح الحقيقي الشامل المعتمد' : 'VI. Certified Comprehensive Net Profit'}
                </span>
                <button
                  type="button"
                  onClick={() => openAuditDrilldown('NET_PROFIT')}
                  className="opacity-0 group-hover:opacity-100 bg-slate-900 text-white px-2 py-0.5 rounded text-[10.5px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                  title={isAr ? 'كشف مسار صافي الربح النهائي' : 'Audit Trail of Net Profit'}
                >
                  <Layers size={11} />
                  <span>{isAr ? 'مسار الصافي النهائي' : 'Audit Trail'}</span>
                </button>
              </div>
              <div className="text-[10.5px] text-slate-700 font-bold">
                {isAr 
                  ? 'المبلغ النهائي القابل للتحويل إلى حساب الأرباح المدورة (262) وتوزيعات الشركاء (2643) = (مجمل الربح + الإيرادات العرضية - المصروفات)' 
                  : 'Final amount transferable to Retained Earnings (262) & Partner Distributions (2643) = (Gross Profit + Incidental Revenues - Expenses)'}
              </div>
            </div>
            <div className="col-span-2 text-center font-mono font-black text-slate-800 text-xs">
              {isAr ? 'صافي نهائي' : 'Final Net'}
            </div>
            <div className={`col-span-3 ${isAr ? 'text-left' : 'text-right'} font-mono font-black text-slate-950 text-[15px] tabular-nums`}>
              {fmtNum(vm.netProfitIQD, vm.netProfitUSD)}
            </div>
          </div>
        </div>
      </div>

      {/* ── Compact Signatures ── */}
      <div className="grid grid-cols-3 gap-4 pt-3 border-t border-slate-900 text-center text-[11px] font-bold text-slate-800">
        <div className="space-y-2">
          <span>{isAr ? 'المحاسب المسؤول / المنظم' : 'Authorized Accountant / Preparer'}</span>
          <div className="border-b border-dashed border-slate-300 w-28 mx-auto" />
        </div>
        <div className="space-y-2">
          <span>{isAr ? 'مدير الحسابات والرقابة المالية' : 'Financial Controller / Chief Accountant'}</span>
          <div className="border-b border-dashed border-slate-300 w-28 mx-auto" />
        </div>
        <div className="space-y-2">
          <span>{isAr ? 'المدير العام / مجلس الشركاء' : 'General Manager / Board of Directors'}</span>
          <div className="border-b border-dashed border-slate-300 w-28 mx-auto" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F6F8FB] p-3 sm:p-4 space-y-3.5 text-slate-900 select-none" dir={direction}>
      {/* ── Full-Width Spacious Single-Row Toolbar ── */}
      <div className="w-full flex items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-slate-300 shadow-2xs">
        {/* Left Side: Filtering & Dates */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Branch Selector */}
          <Menu shadow="md" width={220} position="bottom-start" radius="12px">
            <Menu.Target>
              <button
                type="button"
                className="h-[36px] px-3 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-800 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shrink-0"
              >
                <Building size={15} className="text-[#F45A0A]" />
                <span className="max-w-[130px] truncate">{selectedBranchName}</span>
                <ChevronDown size={13} className="text-slate-400" />
              </button>
            </Menu.Target>
            <Menu.Dropdown className="p-1">
              <Menu.Item
                onClick={() => {
                  setSelectedBranchId('ALL');
                  localStorage.setItem('active_branch_id', 'ALL');
                }}
                className={`text-xs font-bold rounded-lg ${selectedBranchId === 'ALL' ? 'bg-orange-50 text-[#F45A0A]' : 'text-slate-700'}`}
              >
                {isAr ? 'كافة الفروع والمراكز' : 'All Branches'}
              </Menu.Item>
              <Menu.Divider />
              {branches.map((b) => (
                <Menu.Item
                  key={b.id}
                  onClick={() => {
                    setSelectedBranchId(b.id);
                    localStorage.setItem('active_branch_id', b.id);
                  }}
                  className={`text-xs font-bold rounded-lg ${selectedBranchId === b.id ? 'bg-orange-50 text-[#F45A0A]' : 'text-slate-700'}`}
                >
                  {isAr ? b.nameAr : (b.nameEn || b.nameAr)}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>

          {/* Currency Toggle */}
          <div className="h-[36px] p-1 bg-slate-100 border border-slate-200 rounded-xl flex items-center shrink-0">
            {(['ALL', 'IQD', 'USD'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                className={`h-full px-2.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  currency === c ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                {c === 'ALL' ? (isAr ? 'الكل' : 'ALL') : c === 'IQD' ? 'IQD' : '$ USD'}
              </button>
            ))}
          </div>

          {/* Quick Presets */}
          <div className="h-[36px] p-1 bg-slate-100 border border-slate-200 rounded-xl hidden md:flex items-center shrink-0">
            {[
              { id: 'YEAR', labelAr: 'السنة', labelEn: 'Year' },
              { id: 'MONTH', labelAr: 'الشهر', labelEn: 'Month' },
              { id: 'TODAY', labelAr: 'اليوم', labelEn: 'Today' },
              { id: 'ALL', labelAr: 'الكل', labelEn: 'All' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleQuickPresetChange(p.id)}
                className={`h-full px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  quickPreset === p.id ? 'bg-white text-[#F45A0A] font-black shadow-2xs' : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                {isAr ? p.labelAr : p.labelEn}
              </button>
            ))}
          </div>

          {/* Date Range Inputs */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2 h-[36px] shrink-0">
            <DatePickerInput
              value={startDate}
              onChange={(d: any) => {
                setStartDate(d ? new Date(d) : null);
                setQuickPreset('CUSTOM');
              }}
              placeholder={isAr ? 'من تاريخ' : 'From Date'}
              size="xs"
              radius="md"
              className="w-28 text-xs font-bold"
              styles={{
                input: { border: 'none', backgroundColor: 'transparent', height: '28px', fontSize: '11px', fontWeight: 'bold' }
              }}
            />
            <span className="text-slate-300 font-bold">-</span>
            <DatePickerInput
              value={endDate}
              onChange={(d: any) => {
                setEndDate(d ? new Date(d) : null);
                setQuickPreset('CUSTOM');
              }}
              placeholder={isAr ? 'إلى تاريخ' : 'To Date'}
              size="xs"
              radius="md"
              className="w-28 text-xs font-bold"
              styles={{
                input: { border: 'none', backgroundColor: 'transparent', height: '28px', fontSize: '11px', fontWeight: 'bold' }
              }}
            />
          </div>
        </div>

        {/* Right Side: Actions & Viewport */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Refresh */}
          <button
            type="button"
            onClick={fetchAllData}
            disabled={loading}
            className="h-[36px] w-[36px] rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold flex items-center justify-center cursor-pointer transition-all disabled:opacity-50"
            title={isAr ? 'تحديث البيانات' : 'Refresh'}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-[#F45A0A]' : 'text-slate-500'} />
          </button>

          {/* Zoom Controls */}
          <div className="h-[36px] px-1.5 bg-slate-50 border border-slate-200 rounded-xl hidden lg:flex items-center">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(70, z - 10))}
              className="p-1.5 hover:bg-slate-200/60 rounded-lg text-slate-700 cursor-pointer"
              title={isAr ? 'تصغير' : 'Zoom Out'}
            >
              <ZoomOut size={13} />
            </button>
            <span className="px-1.5 font-mono font-bold text-[11px] text-slate-800">{zoomLevel}%</span>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(140, z + 10))}
              className="p-1.5 hover:bg-slate-200/60 rounded-lg text-slate-700 cursor-pointer"
              title={isAr ? 'تكبير' : 'Zoom In'}
            >
              <ZoomIn size={13} />
            </button>
          </div>

          {/* Fullscreen Mode */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="h-[36px] w-[36px] rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold flex items-center justify-center cursor-pointer transition-all"
            title={isFullscreen ? (isAr ? 'إنهاء ملء الشاشة' : 'Exit Fullscreen') : (isAr ? 'وضع ملء الشاشة' : 'Fullscreen')}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          {/* Direct PDF / Print */}
          <button
            type="button"
            onClick={() => window.print()}
            className="h-[36px] px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
          >
            <Printer size={14} className="text-orange-400" />
            <span>{isAr ? 'طباعة / PDF' : 'PDF / Print'}</span>
          </button>

          {/* Export Excel */}
          <button
            type="button"
            onClick={exportToExcel}
            className="h-[36px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
          >
            <FileSpreadsheet size={14} />
            <span>Excel</span>
          </button>
        </div>
      </div>

      <div className="flex justify-center w-full">
        {renderIncomeStatementDocument()}
      </div>

      <Modal
        opened={drilldownModalOpen}
        onClose={() => setDrilldownModalOpen(false)}
        title={
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-100 text-[#F45A0A] flex items-center justify-center font-black shrink-0">
              <Layers size={17} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-950">
                {isAr ? `مسار وتفاصيل تشكل المبلغ — ${drilldownData?.title}` : `Audit Trail & Details — ${drilldownData?.title}`}
              </h3>
              <span className="text-[11px] text-slate-500 font-bold font-mono">
                {isAr ? 'رقم الحساب / الدليل:' : 'Account Code:'} {drilldownData?.code}
              </span>
            </div>
          </div>
        }
        size="880px"
        radius="16px"
        dir={direction}
        centered
        padding="lg"
      >
        {drilldownData && (
          <div className="space-y-3.5 text-xs font-sans">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
              <div className="flex items-center gap-3 shrink-0">
                <div>
                  <span className="text-[10.5px] font-bold text-slate-500 block">{isAr ? 'المبلغ المعتمد بالقائمة' : 'Adopted Amount in Statement'}</span>
                  <span className="font-mono font-black text-base text-slate-950 tabular-nums">
                    {fmtNum(drilldownData.amountIQD, drilldownData.amountUSD)}
                  </span>
                </div>
                <div className="h-8 w-px bg-slate-200 hidden sm:block" />
              </div>

              <div className="flex-1 text-[11.5px] text-slate-700 font-medium leading-relaxed">
                {drilldownData.explanation}
              </div>

              <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white text-slate-800 border border-slate-200 shrink-0 whitespace-nowrap shadow-2xs self-start sm:self-center">
                {drilldownData.items.length > 0 
                  ? (isAr ? `${drilldownData.items.length} عملية مساهمة` : `${drilldownData.items.length} transactions`) 
                  : (isAr ? 'حساب تجميعي' : 'Formula Summary')}
              </span>
            </div>

            {drilldownData.items.length > 0 && (
              <div className="relative">
                <input
                  type="text"
                  value={drilldownSearchQuery}
                  onChange={(e) => setDrilldownSearchQuery(e.target.value)}
                  placeholder={isAr ? 'بحث سريع برقم السند / الفاتورة، العميل، المورد، أو البيان...' : 'Search by reference, partner, service, or notes...'}
                  className="w-full h-[36px] pr-9 pl-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold focus:outline-none focus:border-[#F45A0A] focus:bg-white transition-all text-slate-900 placeholder:text-slate-400 placeholder:font-medium"
                />
                <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            )}

            {drilldownData.items.length > 0 ? (
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[360px] overflow-y-auto overflow-x-auto date-picker-scroll">
                <table className="w-full text-right border-collapse text-[11.5px]">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200 z-10 whitespace-nowrap">
                    <tr>
                      <th className={`py-2.5 px-3 whitespace-nowrap ${isAr ? 'text-right' : 'text-left'}`}>{isAr ? 'رقم السند / المرجع' : 'Ref / Invoice No'}</th>
                      <th className={`py-2.5 px-3 whitespace-nowrap ${isAr ? 'text-right' : 'text-left'}`}>{isAr ? 'التاريخ' : 'Date'}</th>
                      <th className={`py-2.5 px-3 whitespace-nowrap ${isAr ? 'text-right' : 'text-left'}`}>{isAr ? 'الطرف / العميل / المورد' : 'Client / Supplier'}</th>
                      <th className={`py-2.5 px-3 whitespace-nowrap min-w-[200px] ${isAr ? 'text-right' : 'text-left'}`}>{isAr ? 'الخدمة والبيان' : 'Service & Details'}</th>
                      <th className={`py-2.5 px-3 whitespace-nowrap ${isAr ? 'text-left' : 'text-right'}`}>{isAr ? 'المبلغ المعتمد' : 'Adopted Amount'}</th>
                      <th className="py-2.5 px-3 whitespace-nowrap text-center">{isAr ? 'الحالة' : 'Status'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white font-medium text-slate-800">
                    {filteredDrilldownItems.map((item) => {
                      const isVisa = item.serviceType.includes('فيزا') || item.serviceType.toLowerCase().includes('visa') || item.refNumber.toUpperCase().includes('VISA');
                      const isRef = item.serviceType.includes('استرجاع') || item.serviceType.toLowerCase().includes('refund') || item.refNumber.toUpperCase().includes('REF');
                      const targetPath = isVisa ? '/visas' : isRef ? '/refunds' : '/tickets';
                      const targetTitle = isVisa 
                        ? (isAr ? 'فتح في شاشة الفيزا والتأشيرات' : 'Open in Visas & Permits') 
                        : isRef 
                        ? (isAr ? 'فتح في شاشة الاسترجاعات' : 'Open in Refunds') 
                        : (isAr ? 'فتح في شاشة تذاكر الطيران' : 'Open in Flight Tickets');

                      return (
                        <tr key={item.id} className="hover:bg-orange-50/20 transition-colors group">
                          <td className="py-2 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                              <span className="font-mono font-bold text-slate-950">{item.refNumber}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setDrilldownModalOpen(false);
                                  navigate(targetPath);
                                }}
                                title={targetTitle}
                                className="opacity-0 group-hover:opacity-100 text-[#F45A0A] hover:bg-orange-100 p-0.5 rounded cursor-pointer transition-all flex items-center gap-0.5 text-[10px] font-bold shrink-0"
                              >
                                <ExternalLink size={12} />
                                <span>{isAr ? 'عرض' : 'View'}</span>
                              </button>
                            </div>
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-600 whitespace-nowrap">{item.date.split('T')[0]}</td>
                          <td className="py-2 px-3 font-bold text-slate-950 whitespace-nowrap">{item.partnerName}</td>
                          <td className="py-2 px-3 text-slate-700 min-w-[200px]">
                            <span className="font-medium text-[11px] leading-tight block">{item.passengerOrNotes || item.serviceType}</span>
                          </td>
                          <td className={`py-2 px-3 ${isAr ? 'text-left' : 'text-right'} font-mono font-black text-slate-950 tabular-nums whitespace-nowrap`}>
                            {item.currency === 'USD' ? `$${item.amountUSD.toLocaleString()}` : `${item.amountIQD.toLocaleString()} ${isAr ? 'د.ع' : 'IQD'}`}
                          </td>
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 inline-block">
                              {item.status || (isAr ? 'معتمد' : 'POSTED')}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredDrilldownItems.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500 font-bold">
                          لا توجد عمليات تطابق البحث المدخل
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-5 text-center text-slate-600 bg-slate-50 rounded-xl border border-slate-200">
                <p className="font-bold text-slate-800">هذا البند مركب من المعادلة المحاسبية الموضحة أعلاه</p>
                <p className="text-[11px] mt-1 text-slate-500">
                  يمكنك مراجعة مسار كل بند تفصيلي من بنوده المكونة له من خلال أزرار «مسار المبلغ» الخاصة به.
                </p>
              </div>
            )}

            {/* 4. Action & Navigation Footer */}
            <div className="flex items-center justify-between pt-2.5 border-t border-slate-200 gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setDrilldownModalOpen(false)}
                className="h-[36px] px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                إغلاق
              </button>

              <div className="flex items-center gap-2 flex-wrap">
                {drilldownData.code === '411' || drilldownData.code === '311' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setDrilldownModalOpen(false);
                        navigate('/tickets');
                      }}
                      className="h-[36px] px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                    >
                      <span>الانتقال إلى تذاكر الطيران</span>
                      <ArrowLeft size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDrilldownModalOpen(false);
                        navigate('/visas');
                      }}
                      className="h-[36px] px-3.5 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                    >
                      <span>الانتقال إلى الفيزا والتأشيرات</span>
                      <ArrowLeft size={13} />
                    </button>
                  </>
                ) : drilldownData.targetRoute ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDrilldownModalOpen(false);
                      navigate(drilldownData.targetRoute!);
                    }}
                    className="h-[36px] px-4 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-bold text-xs flex items-center gap-2 shadow-2xs transition-all cursor-pointer"
                  >
                    <span>{drilldownData.targetRouteLabel || 'الانتقال إلى شاشة العمليات'}</span>
                    <ArrowLeft size={14} />
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal for Including / Selecting Any Account from the Tree */}
      <Modal
        opened={includeAccountModalOpen}
        onClose={() => setIncludeAccountModalOpen(false)}
        title={
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFF3E8] text-[#F45A0A] border border-orange-200 flex items-center justify-center font-black shadow-2xs shrink-0">
              <BookmarkPlus size={20} strokeWidth={2.2} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-950">
                {isAr ? 'تضمين حساب من شجرة الحسابات في قائمة الدخل' : 'Include Account from Chart of Accounts'}
              </h3>
              <span className="text-xs text-slate-500 font-bold">
                {isAr ? 'اختر القسم المحاسبي والحساب ليتم إدراجه واحتسابه فوراً في القائمة' : 'Select a statement section and account to display and calculate in the report'}
              </span>
            </div>
          </div>
        }
        size="820px"
        radius="20px"
        dir={direction}
        centered
        padding="xl"
        styles={{
          content: { overflow: 'visible' },
          body: { overflow: 'visible', paddingBottom: '24px' },
        }}
      >
        <div
          className="space-y-4.5 text-xs select-none"
          style={{ fontFamily: isAr ? "'IBM Plex Sans Arabic', system-ui, sans-serif" : "'IBM Plex Sans', system-ui, sans-serif" }}
        >
          {/* Target Section Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-black text-slate-800">
              {isAr ? '1. اختر القسم المحاسبي المستهدف في القائمة:' : '1. Select Target Statement Section:'}
            </label>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {/* Section 1: Operating Revenue */}
              <button
                type="button"
                onClick={() => setTargetSectionForInclude('OPERATING_REVENUE')}
                className={`p-3 rounded-xl border text-start transition-all cursor-pointer flex flex-col justify-between ${
                  targetSectionForInclude === 'OPERATING_REVENUE'
                    ? 'border-[#F45A0A] bg-orange-50/70 shadow-2xs ring-1 ring-[#F45A0A]'
                    : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded ${
                    targetSectionForInclude === 'OPERATING_REVENUE' ? 'bg-orange-200/80 text-[#F45A0A]' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}>
                    41
                  </span>
                  {targetSectionForInclude === 'OPERATING_REVENUE' && (
                    <span className="w-2 h-2 rounded-full bg-[#F45A0A]" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-black text-slate-900 leading-tight">
                    {isAr ? 'أولاً: إيرادات' : 'I. Revenues'}
                  </div>
                  <div className="text-[10.5px] text-slate-500 font-bold mt-0.5">
                    {isAr ? 'النشاط الجاري' : 'Operating'}
                  </div>
                </div>
              </button>

              {/* Section 2: Direct Costs */}
              <button
                type="button"
                onClick={() => setTargetSectionForInclude('DIRECT_COST')}
                className={`p-3 rounded-xl border text-start transition-all cursor-pointer flex flex-col justify-between ${
                  targetSectionForInclude === 'DIRECT_COST'
                    ? 'border-[#F45A0A] bg-orange-50/70 shadow-2xs ring-1 ring-[#F45A0A]'
                    : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded ${
                    targetSectionForInclude === 'DIRECT_COST' ? 'bg-orange-200/80 text-[#F45A0A]' : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}>
                    31
                  </span>
                  {targetSectionForInclude === 'DIRECT_COST' && (
                    <span className="w-2 h-2 rounded-full bg-[#F45A0A]" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-black text-slate-900 leading-tight">
                    {isAr ? 'ثانياً: تكاليف' : 'II. Costs'}
                  </div>
                  <div className="text-[10.5px] text-slate-500 font-bold mt-0.5">
                    {isAr ? 'النشاط المباشرة' : 'Direct Activity'}
                  </div>
                </div>
              </button>

              {/* Section 3: Incidental Revenue */}
              <button
                type="button"
                onClick={() => setTargetSectionForInclude('INCIDENTAL_REVENUE')}
                className={`p-3 rounded-xl border text-start transition-all cursor-pointer flex flex-col justify-between ${
                  targetSectionForInclude === 'INCIDENTAL_REVENUE'
                    ? 'border-[#F45A0A] bg-orange-50/70 shadow-2xs ring-1 ring-[#F45A0A]'
                    : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded ${
                    targetSectionForInclude === 'INCIDENTAL_REVENUE' ? 'bg-orange-200/80 text-[#F45A0A]' : 'bg-teal-50 text-teal-700 border border-teal-200'
                  }`}>
                    42/43/48
                  </span>
                  {targetSectionForInclude === 'INCIDENTAL_REVENUE' && (
                    <span className="w-2 h-2 rounded-full bg-[#F45A0A]" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-black text-slate-900 leading-tight">
                    {isAr ? 'رابعاً: إيرادات' : 'IV. Incidental'}
                  </div>
                  <div className="text-[10.5px] text-slate-500 font-bold mt-0.5">
                    {isAr ? 'عرضية وأرباح' : 'Other Revenues'}
                  </div>
                </div>
              </button>

              {/* Section 4: Operating Expenses */}
              <button
                type="button"
                onClick={() => setTargetSectionForInclude('OPERATING_EXPENSE')}
                className={`p-3 rounded-xl border text-start transition-all cursor-pointer flex flex-col justify-between ${
                  targetSectionForInclude === 'OPERATING_EXPENSE'
                    ? 'border-[#F45A0A] bg-orange-50/70 shadow-2xs ring-1 ring-[#F45A0A]'
                    : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded ${
                    targetSectionForInclude === 'OPERATING_EXPENSE' ? 'bg-orange-200/80 text-[#F45A0A]' : 'bg-purple-50 text-purple-700 border border-purple-200'
                  }`}>
                    32/33/38
                  </span>
                  {targetSectionForInclude === 'OPERATING_EXPENSE' && (
                    <span className="w-2 h-2 rounded-full bg-[#F45A0A]" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-black text-slate-900 leading-tight">
                    {isAr ? 'خامساً: مصروفات' : 'V. Expenses'}
                  </div>
                  <div className="text-[10.5px] text-slate-500 font-bold mt-0.5">
                    {isAr ? 'إدارية وتشغيلية' : 'Operating'}
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Searchable Account Picker with Enterprise Custom Option Layout */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-800">
              {isAr ? '2. اختر الحساب من شجرة الحسابات:' : '2. Select Account from Chart:'}
            </label>
            <SearchableCombobox
              options={accountComboboxOptions}
              value={selectedAccountIdToInclude}
              onChange={(val) => setSelectedAccountIdToInclude(val)}
              placeholder={isAr ? 'ابحث برقم الدليل أو اسم الحساب في الشجرة...' : 'Search by code or account name...'}
              className="w-full"
              renderOption={(opt, isSelected) => {
                const acc = allAccounts.find((a) => a.id === opt.value);
                const typeLabel =
                  acc?.type === 'REVENUE'
                    ? (isAr ? 'إيرادات' : 'Revenue')
                    : acc?.type === 'EXPENSE'
                    ? (isAr ? 'مصروفات' : 'Expense')
                    : acc?.type === 'ASSET'
                    ? (isAr ? 'أصول' : 'Asset')
                    : acc?.type === 'LIABILITY'
                    ? (isAr ? 'خصوم' : 'Liability')
                    : (isAr ? 'حقوق ملكية' : 'Equity');

                const typeColor =
                  acc?.type === 'REVENUE'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : acc?.type === 'EXPENSE'
                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                    : 'bg-slate-100 text-slate-700 border-slate-200';

                return (
                  <div className="flex items-center justify-between w-full py-1 gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono font-black text-xs px-2 py-0.5 rounded-md bg-orange-50 text-[#F45A0A] border border-orange-200/80 shrink-0">
                        {opt.code}
                      </span>
                      <span className="font-black text-slate-900 text-xs truncate">{opt.label}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${typeColor}`}>
                        {typeLabel}
                      </span>
                    </div>
                  </div>
                );
              }}
            />
          </div>

          {/* Selected Account Info & Preview Card */}
          {selectedAccountIdToInclude && (() => {
            const acc = allAccounts.find((a) => a.id === selectedAccountIdToInclude);
            if (!acc) return null;
            return (
              <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-xs px-2.5 py-1 bg-orange-100 text-[#F45A0A] rounded-lg border border-orange-200">
                      {acc.code}
                    </span>
                    <span className="font-black text-slate-950 text-sm">{acc.nameAr}</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-50 text-blue-700 border border-blue-200">
                    {acc.type}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-500 font-bold block">{isAr ? 'القسم المختار للإدراج:' : 'Target Section:'}</span>
                    <span className="font-black text-[#F45A0A] text-xs">
                      {targetSectionForInclude === 'OPERATING_REVENUE' && (isAr ? 'أولاً: إيرادات النشاط الجاري (41)' : 'Operating Revenues')}
                      {targetSectionForInclude === 'DIRECT_COST' && (isAr ? 'ثانياً: تكاليف النشاط المباشرة (31)' : 'Direct Costs')}
                      {targetSectionForInclude === 'INCIDENTAL_REVENUE' && (isAr ? 'رابعاً: إيرادات عرضية وأرباح (42/43/48)' : 'Incidental Revenues')}
                      {targetSectionForInclude === 'OPERATING_EXPENSE' && (isAr ? 'خامساً: مصروفات إدارية وتشغيلية (32/33)' : 'Operating Expenses')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold block">{isAr ? 'الرصيد الدفتري الحالي:' : 'Book Balance:'}</span>
                    <span className="font-mono font-black text-slate-900 text-xs">
                      {fmtNum(acc.balanceIQD || 0, acc.balanceUSD || 0)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIncludeAccountModalOpen(false)}
              className="h-10 px-5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs transition-colors cursor-pointer"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              disabled={!selectedAccountIdToInclude}
              onClick={() => handleIncludeAccount(selectedAccountIdToInclude, targetSectionForInclude)}
              className="h-10 px-6 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] disabled:opacity-50 text-white font-black text-xs flex items-center gap-2 shadow-xs hover:shadow-md transition-all cursor-pointer"
            >
              <BookmarkPlus size={16} strokeWidth={2.5} />
              <span>{isAr ? 'تضمين الحساب في القائمة' : 'Include in Statement'}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Smart Account Wizard Modal for adding new revenue or expense accounts directly */}
      <SmartAccountWizardModal
        opened={wizardModalOpen}
        onClose={() => setWizardModalOpen(false)}
        onSuccess={() => {
          setWizardModalOpen(false);
          fetchAllData();
        }}
        mode="CREATE"
      />
    </div>
  );
};

export default IncomeStatementPage;
