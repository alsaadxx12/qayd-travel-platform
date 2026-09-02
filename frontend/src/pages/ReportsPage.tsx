import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { AccountingGrid, AccountingColumnDef, AccountingActionMenuItem } from '../components/common/AccountingGrid';
import { AccountingDateRangePicker } from '../components/common/date/AccountingDateRangePicker';
import {
  Paper,
  Badge,
  Drawer,
  Tabs,
  Switch,
  Tooltip,
  Menu,
} from '@mantine/core';
import {
  IconSearch,
  IconEye,
  IconFileText,
  IconReceipt,
  IconCreditCard,
  IconNotebook,
  IconArrowsExchange,
  IconReportMoney,
  IconPlane,
  IconId,
  IconUsers,
  IconReceiptRefund,
  IconReplace,
  IconBuilding,
  IconFilter,
  IconX,
  IconChevronDown,
  IconScale,
  IconHistory,
  IconPrinter,
  IconFileTypePdf,
  IconFileSpreadsheet,
  IconDotsVertical,
  IconRefresh,
  IconCopy,
  IconUser,
  IconUserCheck,
  IconLock,
  IconRoute,
  IconWallet,
  IconArrowUpRight,
  IconArrowDownLeft,
  IconAdjustmentsHorizontal,
  IconTicket,
  IconPlus,
  IconEdit,
} from '@tabler/icons-react';
import * as XLSX from 'xlsx';
import { showSuccessNotification, showErrorNotification } from '../utils/notifications';
import {
  AccountStatementPrintModal,
  AccountStatementQuickExportModal,
} from '../components/reports/AccountStatementPrintModal';
import { FinancialVoucherForm } from '../components/vouchers/FinancialVoucherForm';
import { TicketInvoiceEditorWorkspace } from '../components/tickets/TicketInvoiceEditorWorkspace';
import { ticketsApi } from '../api/tickets';
import { useLanguageStore } from '../store/useLanguageStore';

// Helper: format date as YYYY-MM-DD
const formatDate = (d: Date) => d.toISOString().split('T')[0];
// The statement opens on the running fiscal year; anything older is summarised into a
// carried-forward line, so the closing balance still matches the account.
const fiscalYearStart = () => `${new Date().getFullYear()}-01-01`;
const fiscalYearEnd = () => `${new Date().getFullYear()}-12-31`;

// Statement movements are ordered by when they were entered into the system, not by
// the document date, so anything recorded now is always the last row of the ledger.
const compareByEntryOrder = (a: any, b: any) => {
  const timeOf = (m: any) => {
    const entered = new Date(m?.entryDate || m?.date || 0).getTime();
    return Number.isNaN(entered) ? 0 : entered;
  };
  const diff = timeOf(a) - timeOf(b);
  if (diff !== 0) return diff;
  const numA = String(a.voucherNumber || a.entryNumber || a.id || '');
  const numB = String(b.voucherNumber || b.entryNumber || b.id || '');
  return numA.localeCompare(numB, undefined, { numeric: true });
};

// The stored timestamps are UTC midnight, so reading the calendar day off the raw
// string keeps a document dated 01/08 from sliding into 31/07 on the local clock.
const toDayKey = (value?: any): string => {
  if (!value) return '';
  if (typeof value === 'string') {
    const direct = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (direct) return `${direct[1]}-${direct[2]}-${direct[3]}`;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return formatDate(new Date(d.getTime() - d.getTimezoneOffset() * 60000));
};

// Helper: Extract concise IATA airport codes
const formatRouteCodesOnly = (rawRoute?: string): string => {
  if (!rawRoute) return '';
  const matches = rawRoute.match(/\b[A-Za-z]{3}\b/g);
  if (matches && matches.length >= 2) {
    const codes: string[] = [];
    matches.forEach((m) => {
      const upper = m.toUpperCase();
      if (codes[codes.length - 1] !== upper) {
        codes.push(upper);
      }
    });
    if (codes.length >= 2) return codes.join(' ➔ ');
  }
  if (matches && matches.length === 1) return matches[0].toUpperCase();
  return rawRoute
    .replace(/\(.*?\)/g, '')
    .split(/[-–—→>]/)
    .map((s) => s.trim().substring(0, 3).toUpperCase())
    .filter(Boolean)
    .join(' ➔ ');
};

export const ReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  // ── Filter categories with Bilingual labels ──
  const MOVEMENT_FILTERS = useMemo(
    () => [
      { key: 'receipt', label: isAr ? 'القبض' : 'Receipts', icon: IconReceipt, color: '#059669' },
      { key: 'payment', label: isAr ? 'الدفع' : 'Payments', icon: IconCreditCard, color: '#dc2626' },
      { key: 'journal', label: isAr ? 'القيد' : 'Journals', icon: IconNotebook, color: '#2563eb' },
      { key: 'exchange', label: isAr ? 'الصرافة' : 'Exchange / FX', icon: IconArrowsExchange, color: '#7c3aed' },
      { key: 'expense', label: isAr ? 'المصاريف' : 'Expenses', icon: IconReportMoney, color: '#ea580c' },
    ],
    [isAr]
  );

  const BALANCE_FILTERS = useMemo(
    () => [
      { key: 'openingBalance', label: isAr ? 'الرصيد الافتتاحي' : 'Opening Balance', icon: IconScale, color: '#92400e' },
      { key: 'previousBalance', label: isAr ? 'رصيد سابق' : 'Previous Balance', icon: IconHistory, color: '#78350f' },
    ],
    [isAr]
  );

  const SERVICE_FILTERS = useMemo(
    () => [
      { key: 'tickets', label: isAr ? 'التذاكر' : 'Tickets', icon: IconPlane, color: '#0891b2' },
      { key: 'visa', label: isAr ? 'الفيزا' : 'Visas', icon: IconId, color: '#4f46e5' },
      { key: 'groups', label: isAr ? 'الكروبات' : 'Groups', icon: IconUsers, color: '#0d9488' },
      { key: 'refunds', label: isAr ? 'الاسترجاعات' : 'Refunds', icon: IconReceiptRefund, color: '#e11d48' },
      { key: 'changes', label: isAr ? 'التغييرات' : 'Reissues', icon: IconReplace, color: '#ca8a04' },
      { key: 'hotels', label: isAr ? 'الفنادق' : 'Hotels', icon: IconBuilding, color: '#7c3aed' },
    ],
    [isAr]
  );

  // ── Core State ──
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [accountSearch, setAccountSearch] = useState('');
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [startDate, setStartDate] = useState(fiscalYearStart());
  const [endDate, setEndDate] = useState(fiscalYearEnd());
  const [currency, setCurrency] = useState<string>('ALL');

  // Auto-Select Account from URL Params
  useEffect(() => {
    const paramAccId = searchParams.get('accountId') || (location.state as any)?.accountId;
    const paramCurrency = searchParams.get('currency') || (location.state as any)?.currency || 'ALL';

    if (paramAccId) {
      setSelectedAccountId(paramAccId);
      setCurrency(paramCurrency || 'ALL');
    }
  }, [location.state, searchParams]);

  // Sync Search Input box text
  useEffect(() => {
    if (selectedAccountId && accounts.length > 0) {
      const matched = accounts.find((a) => a.id === selectedAccountId || a.code === selectedAccountId);
      if (matched) {
        setAccountSearch(isAr ? matched.nameAr : (matched.nameEn || matched.nameAr));
      }
    }
  }, [selectedAccountId, accounts, isAr]);

  const [statementMovements, setStatementMovements] = useState<any[]>([]);
  const [selectedMovement, setSelectedMovement] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [innerSearch, setInnerSearch] = useState('');
  const [filtersVisible, setFiltersVisible] = useState(true);
  const [printModalOpened, setPrintModalOpened] = useState(false);
  const [quickExportModalOpened, setQuickExportModalOpened] = useState(false);
  const [voucherModalOpened, setVoucherModalOpened] = useState(false);
  const [voucherModalType, setVoucherModalType] = useState<'RECEIPT' | 'PAYMENT' | 'EXCHANGE' | 'JOURNAL'>('RECEIPT');
  const [editVoucherId, setEditVoucherId] = useState<string | undefined>(undefined);
  const [ticketModalOpened, setTicketModalOpened] = useState(false);
  const [editingTicketData, setEditingTicketData] = useState<any | null>(null);
  // ── Sidebar Toggle Filters ──
  const [activeFilters, setActiveFilters] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    [
      { key: 'receipt' },
      { key: 'payment' },
      { key: 'journal' },
      { key: 'exchange' },
      { key: 'expense' },
      { key: 'tickets' },
      { key: 'visa' },
      { key: 'groups' },
      { key: 'refunds' },
      { key: 'changes' },
      { key: 'hotels' },
      { key: 'openingBalance' },
      { key: 'previousBalance' },
    ].forEach((f) => {
      init[f.key] = true;
    });
    return init;
  });

  const toggleFilter = useCallback((key: string) => {
    setActiveFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const toggleAllMovements = useCallback((on: boolean) => {
    setActiveFilters((prev) => {
      const next = { ...prev };
      ['receipt', 'payment', 'journal', 'exchange', 'expense'].forEach((k) => {
        next[k] = on;
      });
      return next;
    });
  }, []);

  const toggleAllServices = useCallback((on: boolean) => {
    setActiveFilters((prev) => {
      const next = { ...prev };
      ['tickets', 'visa', 'groups', 'refunds', 'changes', 'hotels'].forEach((k) => {
        next[k] = on;
      });
      return next;
    });
  }, []);

  // ── Load accounts from DB ──
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const accs = await apiRequest('/api/accounts');
        setAccounts(accs || []);
      } catch (err) {
        console.error('Error loading accounts:', err);
      }
    };
    fetchAccounts();
  }, []);

  // ── Filtered account list for search ──
  const filteredAccounts = useMemo(() => {
    if (!accountSearch.trim()) return accounts.filter((a) => !a.isGroup);
    const q = accountSearch.trim().toLowerCase();
    return accounts.filter(
      (a) =>
        !a.isGroup &&
        ((a.nameAr || '').toLowerCase().includes(q) ||
          (a.code || '').includes(q) ||
          (a.nameEn || '').toLowerCase().includes(q))
    );
  }, [accounts, accountSearch]);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === selectedAccountId),
    [accounts, selectedAccountId]
  );

  // Categorize movement by docType / voucherType
  const categorizeMovement = useCallback((m: any): string => {
    const vt = (m.voucherType || '').toUpperCase();
    if (vt === 'TICKET' || vt === 'FLIGHT') return 'tickets';
    if (vt === 'VISA') return 'visa';
    if (vt === 'GROUP') return 'groups';
    if (vt === 'REFUND') return 'refunds';
    if (vt === 'REISSUE') return 'changes';
    if (vt === 'HOTEL') return 'hotels';
    if (vt === 'EXCHANGE' || vt === 'FX') return 'exchange';
    if (vt === 'EXPENSE') return 'expense';
    if (vt === 'RECEIPT') return 'receipt';
    if (vt === 'PAYMENT') return 'payment';

    const dt = (m.docType || '').toLowerCase();
    if (dt.includes('تذكر') || dt.includes('طيران') || dt.includes('ticket')) return 'tickets';
    if (dt.includes('فيزا') || dt.includes('visa')) return 'visa';
    if (dt.includes('كروب') || dt.includes('group')) return 'groups';
    if (dt.includes('استرجاع') || dt.includes('refund')) return 'refunds';
    if (dt.includes('تغيير') || dt.includes('change')) return 'changes';
    if (dt.includes('فندق') || dt.includes('hotel')) return 'hotels';
    if (dt.includes('قبض') || dt.includes('receipt')) return 'receipt';
    if (dt.includes('دفع') || dt.includes('payment')) return 'payment';
    if (dt.includes('صرافة') || dt.includes('exchange')) return 'exchange';
    if (dt.includes('مصاريف') || dt.includes('expense')) return 'expense';

    const desc = `${m.description || ''} ${m.accountingDescription || ''}`.toLowerCase();
    if (desc.includes('تذكر') || desc.includes('طيران') || desc.includes('ticket')) return 'tickets';
    if (desc.includes('فيزا') || desc.includes('visa')) return 'visa';
    if (desc.includes('كروب') || desc.includes('group')) return 'groups';
    if (desc.includes('استرجاع') || desc.includes('refund')) return 'refunds';
    if (desc.includes('تغيير') || desc.includes('change')) return 'changes';
    if (desc.includes('فندق') || desc.includes('hotel')) return 'hotels';
    if (desc.includes('صراف') || desc.includes('تحويل عملة') || desc.includes('exchange') || desc.includes(' fx ')) return 'exchange';
    if (desc.includes('مصروف') || desc.includes('مصاريف') || desc.includes('expense')) return 'expense';
    return 'journal';
  }, []);

  // Selected period boundaries, compared on calendar days so the picker's optional
  // time part never trims a whole document out of the range.
  const rangeStartDay = useMemo(() => toDayKey(startDate), [startDate]);
  const rangeEndDay = useMemo(() => toDayKey(endDate), [endDate]);

  const movementDayKey = useCallback((m: any) => toDayKey(m?.date || m?.entryDate), []);

  const isWithinRange = useCallback(
    (m: any) => {
      const day = movementDayKey(m);
      if (!day) return true;
      if (rangeStartDay && day < rangeStartDay) return false;
      if (rangeEndDay && day > rangeEndDay) return false;
      return true;
    },
    [movementDayKey, rangeStartDay, rangeEndDay]
  );

  const isBeforeRange = useCallback(
    (m: any) => {
      const day = movementDayKey(m);
      return !!(day && rangeStartDay && day < rangeStartDay);
    },
    [movementDayKey, rangeStartDay]
  );

  const matchesTextSearch = useCallback(
    (m: any) => {
      const q = innerSearch.trim().toLowerCase();
      if (!q) return true;
      const passengers = [
        ...(Array.isArray(m.passengersList) ? m.passengersList : []),
        ...(Array.isArray(m.passengersDetail)
          ? m.passengersDetail.map((p: any) => `${p?.name || ''} ${p?.ticketNumber || ''}`)
          : []),
      ];
      return [
        m.description,
        m.accountingDescription,
        m.docType,
        m.entryNumber,
        m.voucherNumber,
        m.reference,
        m.pnr,
        m.airline,
        m.route,
        m.entryUser,
        m.user,
        ...passengers,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    },
    [innerSearch]
  );

  const resetAllFilters = useCallback(() => {
    setActiveFilters((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        next[k] = true;
      });
      return next;
    });
    setInnerSearch('');
    setCurrency('ALL');
  }, []);

  // Real-Time Data Fetching (Zero Stale Delay)
  const fetchBaseData = useCallback(async (_force = false) => {
    const [entries, tickets, customers] = await Promise.all([
      apiRequest('/api/journal-entries').catch(() => []),
      apiRequest('/api/tickets').catch(() => []),
      apiRequest('/api/partners/customers').catch(() => []),
    ]);
    return [entries, tickets, customers];
  }, []);

  useEffect(() => {
    fetchBaseData(false);
  }, [fetchBaseData]);

  // ── Fetch Statement (with Clean Refresh) ──
  const handleFetchStatement = useCallback(
    async (forceRefresh = false) => {
      if (!selectedAccountId) return;
      setLoading(true);
      setHasSearched(true);
      try {
        if (forceRefresh) {
          const freshAccs = await apiRequest('/api/accounts').catch(() => []);
          if (Array.isArray(freshAccs) && freshAccs.length > 0) {
            setAccounts(freshAccs);
          }
        }

        const [entries, tickets, customers] = await fetchBaseData(forceRefresh);

        const targetAcc = accounts.find((a) => a.id === selectedAccountId);
        const targetAccId = selectedAccountId;
        const targetAccName = targetAcc?.nameAr ? targetAcc.nameAr.trim().toLowerCase() : '';
        const targetAccCode = targetAcc?.code ? targetAcc.code.trim().toLowerCase() : '';

        const rawLines: any[] = [];
        const processedVoucherNumbers = new Set<string>();

        // 1. Process Journal Entries
        if (Array.isArray(entries)) {
          entries.forEach((e: any) => {
            if (e.status !== 'POSTED') return;
            if (!Array.isArray(e.lines)) return;

            // Skip opening journal entries to prevent double-counting with account opening balances
            const isOpeningEntry =
              (e.reference && (e.reference.startsWith('OPENING') || e.reference.startsWith('OPEN-'))) ||
              (e.entryNumber && (e.entryNumber.startsWith('OPENING') || e.entryNumber.startsWith('OPEN-'))) ||
              e.sourceType === 'OPENING' ||
              e.voucherType === 'OPENING' ||
              (e.description && (e.description.includes('رصيد افتتاحي') || e.description.includes('قيد افتتاحي')));

            if (isOpeningEntry) {
              return;
            }

            let hasTargetAcc = false;
            e.lines.forEach((l: any) => {
              if (l.accountId === targetAccId) {
                hasTargetAcc = true;
                const lineDesc = (l.description || e.description || '').toLowerCase();
                const rawLineCurr = (l.currency || e.currency || '').toString().toUpperCase();
                const isUSD =
                  rawLineCurr.includes('USD') ||
                  rawLineCurr.includes('$') ||
                  lineDesc.includes('دولار') ||
                  lineDesc.includes('usd') ||
                  lineDesc.includes('$');

                rawLines.push({
                  id: `${e.id}_${l.id}`,
                  date: e.date,
                  entryDate: e.createdAt || e.date,
                  entryNumber: e.entryNumber,
                  docType: e.voucherNumber
                    ? e.voucherType === 'RECEIPT'
                      ? (isAr ? 'سند قبض' : 'Receipt Voucher')
                      : e.voucherType === 'PAYMENT'
                      ? (isAr ? 'سند دفع' : 'Payment Voucher')
                      : (isAr ? 'قيد يومية' : 'Journal Entry')
                    : (isAr ? 'قيد يومية' : 'Journal Entry'),
                  voucherNumber: e.voucherNumber || '-',
                  reference: e.reference || '-',
                  description: e.voucherDescription || l.description || e.description,
                  accountingDescription: l.description || e.description,
                  debit: Number(l.debit || 0),
                  credit: Number(l.credit || 0),
                  costCenter: e.costCenter || (isAr ? 'الفرع الرئيسي' : 'Main Branch'),
                  entryUser: e.createdBy?.name || (isAr ? 'مدير النظام' : 'System Admin'),
                  user: e.createdBy?.name || (isAr ? 'مدير النظام' : 'System Admin'),
                  currency: isUSD ? 'USD' : 'IQD',
                  status: e.status,
                  voucherType: e.voucherType || '',
                  journalEntryId: e.id,
                  voucherId: e.voucherId || e.receiptVouchers?.[0]?.id || e.paymentVouchers?.[0]?.id || null,
                  rawEntry: e,
                });
              }
            });

            if (hasTargetAcc) {
              const processedKeys = [
                e.reference,
                e.voucherNumber,
                e.entryNumber,
              ].filter(Boolean);
              processedKeys.forEach((key: string) => processedVoucherNumbers.add(key.toLowerCase()));
            }
          });
        }

        // 2. Process Tickets
        if (Array.isArray(tickets)) {
          tickets.forEach((t: any) => {
            const ticketStatus = (t.status || 'POSTED').toString().toUpperCase();
            if (!['POSTED', 'REFUNDED'].includes(ticketStatus)) return;

            const invNum = (t.invoiceNumber || t.id || '').toLowerCase();
            if (invNum && processedVoucherNumbers.has(invNum)) return;

            const custName = (t.customerName || '').trim().toLowerCase();
            const suppAcc = (t.supplierAccount || '').trim().toLowerCase();
            const suppAccName = (t.supplierAccountName || '').trim().toLowerCase();

            const foundCust = (customers || []).find((c: any) => c.id === t.customerName || c.code === t.customerName || c.nameAr === t.customerName);
            const resolvedCustName = foundCust ? (foundCust.nameAr || foundCust.nameEn || custName).trim().toLowerCase() : custName;

            const isCustomerMatch =
              targetAccId === (t as any).customerAccountId ||
              (foundCust && (targetAccId === foundCust.accountId || (foundCust.code && targetAccCode && foundCust.code === targetAccCode))) ||
              (targetAccName && (
                custName.includes(targetAccName) || targetAccName.includes(custName) ||
                resolvedCustName.includes(targetAccName) || targetAccName.includes(resolvedCustName)
              )) ||
              (targetAccCode && (custName.includes(targetAccCode) || resolvedCustName.includes(targetAccCode)));

            const isSupplierMatch =
              targetAccId === t.supplierAccount ||
              targetAccId === (t as any).supplierId ||
              (targetAccCode && suppAcc && suppAcc === targetAccCode) ||
              (targetAccName && suppAccName && (suppAccName.includes(targetAccName) || targetAccName.includes(suppAccName))) ||
              (targetAccName && suppAcc && suppAcc.includes(targetAccName));

            const paymentType = (t.paymentType || 'DEBIT').toString().toUpperCase();
            const isCash = paymentType === 'DEBIT' || paymentType === 'CASH' || t.paymentType === 'نقدي';
            const effectiveCb =
              t.paymentMethod && t.paymentMethod.trim() && t.paymentMethod.trim() !== 'CASH_HAND'
                ? t.paymentMethod.trim()
                : t.receivingCashbox && t.receivingCashbox.trim()
                ? t.receivingCashbox.trim()
                : t.cashbox && t.cashbox.trim()
                ? t.cashbox.trim()
                : null;

            let isCashboxMatch = false;
            if (isCash && effectiveCb) {
              const cbClean = effectiveCb.toLowerCase();
              isCashboxMatch =
                targetAccId === effectiveCb ||
                (targetAccCode && targetAccCode === cbClean) ||
                (targetAccName &&
                  (targetAccName === cbClean ||
                    targetAccName.includes(cbClean) ||
                    cbClean.includes(targetAccName)));
            }

            const passDetails = (t.passengers || []).map((p: any) => ({
              name: p.name || p.passenger || 'مسافر',
              ticketNumber: p.ticketNumber || p.documentNumber || '',
              ticketType: p.ticketType || p.type || 'ADULT',
            }));
            const pList = (t.passengers || []).map((p: any) => p.name || p.passenger).filter(Boolean);

            const rawCurr = (t.currency || 'IQD').toString().toUpperCase();
            const ticketCurr = rawCurr.includes('USD') || rawCurr.includes('$') ? 'USD' : 'IQD';
            /*
             * اسم الحركة من نوع خدمتها لا من كونها تذكرة.
             *
             * كانت كل حركة تُسمّى «تذكرة طيران» ولو كانت تأشيرة أو حجز فندق، فلا
             * يفرّق قارئ الكشف بين خدماتنا. والاسترجاع يُكتب «Refund» بالإنجليزية
             * في اللغتين بطلب صاحب النظام، ليبقى مميّزاً بلمحة عين.
             */
            const tripKind = String(t.tripType || '').toUpperCase();
            const isRefundRow =
              tripKind === 'REFUND' ||
              String(t.status || '').toUpperCase() === 'REFUNDED' ||
              String(t.invoiceNumber || '').startsWith('REF-');
            const serviceLabel = (amount: number): string => {
              if (isRefundRow || amount < 0) return 'Refund';
              if (tripKind === 'VISA') return isAr ? 'مبيعات تأشيرات' : 'Visa Sales';
              if (tripKind === 'HOTEL') return isAr ? 'حجوزات فنادق' : 'Hotel Booking';
              if (tripKind === 'GROUP') return isAr ? 'حجوزات جماعية' : 'Group Booking';
              return isAr ? 'مبيعات تذاكر' : 'Ticket Sales';
            };

            const cleanRoute = (t.fullRouteText || t.route || '').replace(/^—$/, '');
            const issuerEmp = t.employeeName || t.issuerName || t.createdByName || (isAr ? 'موظف الإصدار' : 'Issuing Staff');
            const entryEmp = t.entryEmployee || t.employeeName || issuerEmp;

            if (isCustomerMatch) {
              const sellAmt = Number(t.netSell || t.totalSell || 0);
              const debit = Math.max(sellAmt, 0);
              const credit = Math.max(-sellAmt, 0);
              rawLines.push({
                id: `ticket_cust_${t.id}`,
                date: t.issueDate || t.createdAt,
                entryDate: t.createdAt || t.issueDate,
                entryNumber: t.invoiceNumber || t.id,
                docType: serviceLabel(sellAmt),
                voucherNumber: t.invoiceNumber || '-',
                reference: t.pnr || t.reference || '-',
                pnr: t.pnr || t.reference || '-',
                airline: t.airline || '',
                route: cleanRoute,
                passengersList: pList,
                passengersDetail: passDetails,
                description: t.notes || (isAr ? `فاتورة تذاكر - ${t.airline || ''} (${t.pnr || ''})` : `Ticket Invoice - ${t.airline || ''} (${t.pnr || ''})`),
                debit,
                credit,
                costCenter: isAr ? 'قسم الطيران' : 'Aviation Dept',
                entryUser: entryEmp,
                user: issuerEmp,
                currency: ticketCurr,
                status: t.isAudited ? 'AUDITED' : 'ACTIVE',
                voucherType: 'TICKET',
                ticketRaw: t,
              });

              if (isCash && sellAmt > 0) {
                rawLines.push({
                  id: `ticket_cust_cash_receipt_${t.id}`,
                  date: t.issueDate || t.createdAt,
                  entryDate: t.createdAt || t.issueDate,
                  entryNumber: t.invoiceNumber || t.id,
                  docType: isAr ? 'سداد نقدي فوري' : 'Cash Settlement',
                  voucherNumber: t.invoiceNumber || '-',
                  reference: t.pnr || t.reference || '-',
                  pnr: t.pnr || t.reference || '-',
                  airline: t.airline || '',
                  route: cleanRoute,
                  passengersList: pList,
                  passengersDetail: passDetails,
                  description: isAr ? `مقبوضات نقدية باليد عن تذكرة ${t.pnr || ''}` : `Cash payment received for ticket ${t.pnr || ''}`,
                  debit: 0,
                  credit: sellAmt,
                  costCenter: isAr ? 'قسم الطيران' : 'Aviation Dept',
                  entryUser: entryEmp,
                  user: issuerEmp,
                  currency: ticketCurr,
                  status: t.isAudited ? 'AUDITED' : 'ACTIVE',
                  voucherType: 'RECEIPT',
                  ticketRaw: t,
                });
              }
            }

            if (isCashboxMatch) {
              const sellAmt = Number(t.totalSell || t.netSell || 0);
              rawLines.push({
                id: `ticket_cashbox_${t.id}`,
                date: t.issueDate || t.createdAt,
                entryDate: t.createdAt || t.issueDate,
                entryNumber: t.invoiceNumber || t.id,
                docType: `${serviceLabel(1)}${isAr ? ' (نقدي)' : ' (Cash)'}`,
                voucherNumber: t.invoiceNumber || '-',
                reference: t.pnr || t.reference || '-',
                pnr: t.pnr || t.reference || '-',
                airline: t.airline || '',
                route: cleanRoute,
                passengersList: pList,
                passengersDetail: passDetails,
                description: isAr
                  ? `مقبوضات مبيعات تذكرة نقدية - ${t.customerName || ''} (${t.pnr || ''})`
                  : `Cash Ticket Sale Proceeds - ${t.customerName || ''} (${t.pnr || ''})`,
                debit: sellAmt,
                credit: 0,
                costCenter: isAr ? 'قسم الطيران' : 'Aviation Dept',
                entryUser: entryEmp,
                user: issuerEmp,
                currency: ticketCurr,
                status: t.isAudited ? 'AUDITED' : 'ACTIVE',
                voucherType: 'TICKET',
                ticketRaw: t,
              });
            }

            if (isSupplierMatch) {
              const buyAmt = Number(t.netBuy || t.totalBuy || 0);
              const debit = Math.max(-buyAmt, 0);
              const credit = Math.max(buyAmt, 0);
              rawLines.push({
                id: `ticket_supp_${t.id}`,
                date: t.issueDate || t.createdAt,
                entryDate: t.createdAt || t.issueDate,
                entryNumber: t.invoiceNumber || t.id,
                docType: buyAmt < 0 ? 'Refund' : serviceLabel(buyAmt),
                voucherNumber: t.invoiceNumber || '-',
                reference: t.pnr || t.reference || '-',
                pnr: t.pnr || t.reference || '-',
                airline: t.airline || '',
                route: cleanRoute,
                passengersList: pList,
                passengersDetail: passDetails,
                description: t.notes || '',
                debit,
                credit,
                costCenter: isAr ? 'قسم الطيران' : 'Aviation Dept',
                entryUser: entryEmp,
                user: issuerEmp,
                currency: ticketCurr,
                status: t.isAudited ? 'AUDITED' : 'ACTIVE',
                voucherType: 'TICKET',
                ticketRaw: t,
              });
            }
          });
        }

        rawLines.sort(compareByEntryOrder);

        setStatementMovements(rawLines);

        if (forceRefresh) {
          showSuccessNotification(
            isAr ? 'تم تحديث الكشف' : 'Statement Refreshed',
            isAr ? 'تمت إعادة جلب وتحديث كافة الحركات المالية بنجاح' : 'Financial transactions reloaded successfully'
          );
        }
      } catch (err: any) {
        console.error('Error fetching account statement:', err);
        showErrorNotification(isAr ? 'خطأ في التحديث' : 'Refresh Error', err.message || (isAr ? 'تعذر جلب البيانات' : 'Failed to fetch'));
      } finally {
        setLoading(false);
      }
    },
    [selectedAccountId, accounts, fetchBaseData, isAr]
  );

  useEffect(() => {
    if (selectedAccountId) {
      handleFetchStatement(false);
    }
  }, [selectedAccountId, handleFetchStatement]);

  // ── Calculated Rows with Running Balance ──
  const {
    calculatedRows,
    totalDebit,
    totalCredit,
    closingBalance,
    balanceIQD,
    balanceUSD,
    totalDebitIQD,
    totalCreditIQD,
    totalDebitUSD,
    totalCreditUSD,
    openingBalIQD,
    openingBalUSD,
  } = useMemo(() => {
    let runningBalanceIQD = 0;
    let runningBalanceUSD = 0;
    let sumDebitIQD = 0;
    let sumCreditIQD = 0;
    let sumDebitUSD = 0;
    let sumCreditUSD = 0;

    const selectedAcc = accounts.find((a) => a.id === selectedAccountId);
    const accOpeningBalIQD = Number(selectedAcc?.openingAmountIQD ?? selectedAcc?.openingBalance ?? selectedAcc?.initialBalance ?? 0);
    const accOpeningBalUSD = Number(selectedAcc?.openingAmountUSD ?? 0);
    const accPrevBalIQD = Number(selectedAcc?.previousBalance || 0);
    const accPrevBalUSD = Number(selectedAcc?.previousBalanceUSD || 0);

    const isOpeningActive = !!activeFilters['openingBalance'];
    const isPrevActive = !!activeFilters['previousBalance'];

    // Type / currency / text filters first, then the period, so movements dated before
    // the selected range can still be rolled into a carried-forward balance.
    const inScope = statementMovements.filter((m) => {
      const cat = categorizeMovement(m);
      if (cat !== 'openingBalance' && cat !== 'previousBalance' && !activeFilters[cat]) return false;

      if (currency !== 'ALL' && currency !== 'كلاهما') {
        const itemCurr = (m.currency || 'IQD').toUpperCase();
        const isItemUSD = itemCurr.includes('USD') || itemCurr.includes('$');
        if (currency === 'USD' && !isItemUSD) return false;
        if (currency === 'IQD' && isItemUSD) return false;
      }

      return matchesTextSearch(m);
    });

    const filtered = inScope.filter(isWithinRange);
    const beforeRange = inScope.filter(isBeforeRange);

    const sortedFiltered = [...filtered].sort(compareByEntryOrder);

    const rows: any[] = [];
    const isOpeningCredit = (selectedAcc as any)?.openingNature === 'CREDIT';

    if (isOpeningActive && (currency === 'ALL' || currency === 'IQD' || currency === 'كلاهما') && accOpeningBalIQD > 0) {
      const deb = isOpeningCredit ? 0 : accOpeningBalIQD;
      const cred = isOpeningCredit ? accOpeningBalIQD : 0;
      const netIQD = isOpeningCredit ? -accOpeningBalIQD : accOpeningBalIQD;
      runningBalanceIQD += netIQD;
      sumDebitIQD += deb;
      sumCreditIQD += cred;
      rows.push({
        id: 'opening_balance_iqd_row',
        date: startDate || new Date().toISOString(),
        entryNumber: '000',
        docType: isAr ? 'رصيد افتتاحي' : 'Opening Balance',
        voucherNumber: 'OPEN-IQD',
        description: isAr ? 'الرصيد الافتتاحي' : 'Opening Balance',
        debit: deb,
        credit: cred,
        runningBalance: runningBalanceIQD,
        balanceNature: runningBalanceIQD >= 0 ? (isAr ? 'مدين' : 'Debit') : (isAr ? 'دائن' : 'Credit'),
        voucherType: 'OPENING',
        isBalanceRow: true,
        currency: 'IQD',
      });
    }

    if (isOpeningActive && (currency === 'ALL' || currency === 'USD' || currency === 'كلاهما') && accOpeningBalUSD > 0) {
      const deb = isOpeningCredit ? 0 : accOpeningBalUSD;
      const cred = isOpeningCredit ? accOpeningBalUSD : 0;
      const netUSD = isOpeningCredit ? -accOpeningBalUSD : accOpeningBalUSD;
      runningBalanceUSD += netUSD;
      sumDebitUSD += deb;
      sumCreditUSD += cred;
      rows.push({
        id: 'opening_balance_usd_row',
        date: startDate || new Date().toISOString(),
        entryNumber: '000-$',
        docType: isAr ? 'رصيد افتتاحي' : 'Opening Balance',
        voucherNumber: 'OPEN-USD',
        description: isAr ? 'الرصيد الافتتاحي' : 'Opening Balance',
        debit: deb,
        credit: cred,
        runningBalance: runningBalanceUSD,
        balanceNature: runningBalanceUSD >= 0 ? (isAr ? 'مدين' : 'Debit') : (isAr ? 'دائن' : 'Credit'),
        voucherType: 'OPENING',
        isBalanceRow: true,
        currency: 'USD',
      });
    }

    // Only add previous carried balance if not already represented by opening balance
    const isDistinctPrevIQD = accPrevBalIQD !== 0 && (!isOpeningActive || accOpeningBalIQD === 0 || accPrevBalIQD !== (isOpeningCredit ? -accOpeningBalIQD : accOpeningBalIQD));
    if (isPrevActive && isDistinctPrevIQD && (currency === 'ALL' || currency === 'IQD' || currency === 'كلاهما')) {
      const deb = accPrevBalIQD >= 0 ? accPrevBalIQD : 0;
      const cred = accPrevBalIQD < 0 ? Math.abs(accPrevBalIQD) : 0;
      runningBalanceIQD += accPrevBalIQD;
      sumDebitIQD += deb;
      sumCreditIQD += cred;
      rows.push({
        id: 'previous_balance_iqd_row',
        date: startDate || new Date().toISOString(),
        entryNumber: '000-P',
        docType: isAr ? 'رصيد سابق' : 'Previous Balance',
        voucherNumber: 'PREV-IQD',
        description: isAr ? 'الرصيد السابق' : 'Previous Balance',
        debit: deb,
        credit: cred,
        runningBalance: runningBalanceIQD,
        balanceNature: runningBalanceIQD >= 0 ? (isAr ? 'مدين' : 'Debit') : (isAr ? 'دائن' : 'Credit'),
        voucherType: 'PREVIOUS',
        isBalanceRow: true,
        currency: 'IQD',
      });
    }

    const isDistinctPrevUSD = accPrevBalUSD !== 0 && (!isOpeningActive || accOpeningBalUSD === 0 || accPrevBalUSD !== (isOpeningCredit ? -accOpeningBalUSD : accOpeningBalUSD));
    if (isPrevActive && isDistinctPrevUSD && (currency === 'ALL' || currency === 'USD' || currency === 'كلاهما')) {
      const deb = accPrevBalUSD >= 0 ? accPrevBalUSD : 0;
      const cred = accPrevBalUSD < 0 ? Math.abs(accPrevBalUSD) : 0;
      runningBalanceUSD += accPrevBalUSD;
      sumDebitUSD += deb;
      sumCreditUSD += cred;
      rows.push({
        id: 'previous_balance_usd_row',
        date: startDate || new Date().toISOString(),
        entryNumber: '000-P$',
        docType: isAr ? 'رصيد سابق' : 'Previous Balance',
        voucherNumber: 'PREV-USD',
        description: isAr ? 'الرصيد السابق' : 'Previous Balance',
        debit: deb,
        credit: cred,
        runningBalance: runningBalanceUSD,
        balanceNature: runningBalanceUSD >= 0 ? (isAr ? 'مدين' : 'Debit') : (isAr ? 'دائن' : 'Credit'),
        voucherType: 'PREVIOUS',
        isBalanceRow: true,
        currency: 'USD',
      });
    }

    // Movements older than the selected period are summarised into one carried-forward
    // line per currency, so the running balance of the period still ends on the truth.
    const carried = { IQD: { debit: 0, credit: 0, count: 0 }, USD: { debit: 0, credit: 0, count: 0 } };
    beforeRange.forEach((m) => {
      const itemCurr = (m.currency || 'IQD').toUpperCase();
      const bucket = itemCurr.includes('USD') || itemCurr.includes('$') ? carried.USD : carried.IQD;
      bucket.debit += Number(m.debit || 0);
      bucket.credit += Number(m.credit || 0);
      bucket.count += 1;
    });

    (['IQD', 'USD'] as const).forEach((curr) => {
      const bucket = carried[curr];
      if (!bucket.count) return;
      const net = bucket.debit - bucket.credit;
      if (curr === 'USD') {
        sumDebitUSD += bucket.debit;
        sumCreditUSD += bucket.credit;
        runningBalanceUSD += net;
      } else {
        sumDebitIQD += bucket.debit;
        sumCreditIQD += bucket.credit;
        runningBalanceIQD += net;
      }
      const running = curr === 'USD' ? runningBalanceUSD : runningBalanceIQD;
      rows.push({
        id: `carried_forward_${curr.toLowerCase()}_row`,
        date: startDate || new Date().toISOString(),
        entryNumber: curr === 'USD' ? '000-C$' : '000-C',
        docType: isAr ? 'رصيد مدوّر' : 'Carried Forward',
        voucherNumber: `FWD-${curr}`,
        description: isAr
          ? `مدوّر ما قبل ${rangeStartDay || ''} (${bucket.count} حركة)`
          : `Carried forward before ${rangeStartDay || ''} (${bucket.count} movements)`,
        debit: bucket.debit,
        credit: bucket.credit,
        runningBalance: running,
        balanceNature: running >= 0 ? (isAr ? 'مدين' : 'Debit') : (isAr ? 'دائن' : 'Credit'),
        voucherType: 'PREVIOUS',
        isBalanceRow: true,
        currency: curr,
      });
    });

    sortedFiltered.forEach((m) => {
      const itemCurr = (m.currency || 'IQD').toUpperCase();
      const isUSD = itemCurr.includes('USD') || itemCurr.includes('$');
      const deb = Number(m.debit || 0);
      const cred = Number(m.credit || 0);

      let itemRunningBalance = 0;

      if (isUSD) {
        sumDebitUSD += deb;
        sumCreditUSD += cred;
        runningBalanceUSD += deb - cred;
        itemRunningBalance = runningBalanceUSD;
      } else {
        sumDebitIQD += deb;
        sumCreditIQD += cred;
        runningBalanceIQD += deb - cred;
        itemRunningBalance = runningBalanceIQD;
      }

      rows.push({
        ...m,
        category: categorizeMovement(m),
        runningBalance: itemRunningBalance,
        balanceNature: itemRunningBalance >= 0 ? (isAr ? 'مدين' : 'Debit') : (isAr ? 'دائن' : 'Credit'),
        currency: isUSD ? 'USD' : 'IQD',
      });
    });

    const balIQD = sumDebitIQD - sumCreditIQD;
    const balUSD = sumDebitUSD - sumCreditUSD;

    return {
      calculatedRows: rows,
      totalDebitIQD: sumDebitIQD,
      totalCreditIQD: sumCreditIQD,
      totalDebitUSD: sumDebitUSD,
      totalCreditUSD: sumCreditUSD,
      totalDebit: currency === 'USD' ? sumDebitUSD : sumDebitIQD,
      totalCredit: currency === 'USD' ? sumCreditUSD : sumCreditIQD,
      closingBalance: currency === 'USD' ? balUSD : balIQD,
      balanceIQD: balIQD,
      balanceUSD: balUSD,
      openingBalIQD: accOpeningBalIQD,
      openingBalUSD: accOpeningBalUSD,
    };
  }, [
    statementMovements,
    activeFilters,
    currency,
    matchesTextSearch,
    categorizeMovement,
    isWithinRange,
    isBeforeRange,
    rangeStartDay,
    accounts,
    selectedAccountId,
    startDate,
    isAr,
  ]);

  // The printed sheet reads its own field names, so every movement is translated into
  // one: the details column must carry the source document and its own البيان.
  const printRows = useMemo(() => {
    return calculatedRows.map((r, idx) => {
      const voucherNo = r.voucherNumber && r.voucherNumber !== '-' ? r.voucherNumber : '';
      const docRef = voucherNo || r.entryNumber || '';
      const reference = r.reference && r.reference !== '-' ? r.reference : '';
      const vt = String(r.voucherType || '').toUpperCase();
      const typeCode =
        vt === 'TICKET' || vt === 'FLIGHT'
          ? 'DT-ISSUE'
          : vt === 'RECEIPT'
          ? 'RV-RCPT'
          : vt === 'PAYMENT'
          ? 'PV-PAY'
          : vt === 'OPENING'
          ? 'OPEN-BAL'
          : vt === 'PREVIOUS'
          ? 'PREV-BAL'
          : 'GL-ENTRY';

      const docLabel = [r.docType, reference && reference !== docRef ? `Ref: ${reference}` : '']
        .filter(Boolean)
        .join(' · ');

      return {
        ...r,
        rowNumber: idx + 1,
        docRef,
        docLabel,
        typeCode,
        statement: r.description || r.accountingDescription || '',
        passengersDetail: Array.isArray(r.passengersDetail) ? r.passengersDetail : undefined,
      };
    });
  }, [calculatedRows]);

  const handleExportExcel = useCallback(() => {
    if (!calculatedRows || calculatedRows.length === 0) return;
    const exportData = calculatedRows.map((r) => ({
      [isAr ? 'التاريخ' : 'Date']: new Date(r.date).toLocaleDateString('en-GB'),
      [isAr ? 'رقم القيد' : 'Entry #']: r.entryNumber,
      [isAr ? 'نوع المستند' : 'Doc Type']: r.docType,
      [isAr ? 'رقم السند' : 'Voucher #']: r.voucherNumber,
      [isAr ? 'البيان' : 'Description']: r.description,
      [isAr ? 'مدين' : 'Debit']: r.debit,
      [isAr ? 'دائن' : 'Credit']: r.credit,
      [isAr ? 'الرصيد المتراكم' : 'Running Balance']: r.runningBalance,
      [isAr ? 'طبيعة الرصيد' : 'Nature']: r.balanceNature,
      [isAr ? 'المستخدم' : 'User']: r.user,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isAr ? 'كشف_حساب' : 'Statement');
    XLSX.writeFile(wb, `Account_Statement_${selectedAccount?.code || ''}_${new Date().toISOString().split('T')[0]}.xlsx`);
  }, [calculatedRows, selectedAccount, isAr]);

  const selectAccount = useCallback(
    (acc: any) => {
      setSelectedAccountId(acc.id);
      setAccountSearch(isAr ? acc.nameAr : (acc.nameEn || acc.nameAr));
      setShowAccountDropdown(false);
    },
    [isAr]
  );

  // ── Column Definitions (Enhanced Styling & Clear Badges) ──
  const columnDefs: AccountingColumnDef[] = useMemo(
    () => [
      {
        field: 'date',
        headerText: isAr ? 'التاريخ' : 'Date',
        width: 'w-24',
        isPinned: true,
        render: (r) => (
          <div className="flex items-center gap-1.5 font-mono font-bold text-slate-800 text-xs" dir="ltr">
            <span>{new Date(r.date).toLocaleDateString('en-GB')}</span>
          </div>
        ),
      },
      {
        field: 'voucherNumber',
        headerText: isAr ? 'المستند / نوعه' : 'Doc / Type',
        width: 'w-36',
        align: 'center',
        render: (r) => {
          const dt = (r.docType || '').toLowerCase();
          const isTicket = dt.includes('تذكرة') || dt.includes('ticket');
          const isReceipt = dt.includes('قبض') || dt.includes('receipt');
          const isPayment = dt.includes('دفع') || dt.includes('payment');
          const isOpening = dt.includes('افتتاحي') || dt.includes('opening');
          const isPrevious = dt.includes('سابق') || dt.includes('previous');

          const badgeColor = isTicket
            ? 'bg-sky-50 text-sky-800 border-sky-200'
            : isReceipt
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : isPayment
            ? 'bg-rose-50 text-rose-800 border-rose-200'
            : isOpening
            ? 'bg-amber-50 text-amber-900 border-amber-200'
            : isPrevious
            ? 'bg-slate-100 text-slate-800 border-slate-200'
            : 'bg-blue-50 text-blue-800 border-blue-200';

          return (
            <div className="flex flex-col items-center justify-center gap-1 py-1">
              <div className="flex items-center gap-1">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shadow-2xs ${badgeColor}`}>
                  {r.docType}
                </span>
                {r.status === 'AUDITED' && (
                  <Tooltip label={isAr ? 'حركة مدققة ومقفلة' : 'Audited & Locked'} withArrow>
                    <span className="inline-flex items-center justify-center bg-amber-50 border border-amber-200 p-0.5 rounded-full text-amber-600">
                      <IconLock size={10} />
                    </span>
                  </Tooltip>
                )}
              </div>
              <span className="font-mono font-bold text-slate-600 text-[11px] bg-slate-100/90 px-1.5 py-0.2 rounded border border-slate-200/80 tracking-tight" dir="ltr">
                {r.voucherNumber}
              </span>
            </div>
          );
        },
      },
      {
        field: 'description',
        headerText: isAr ? 'البيان وشرح الحركة' : 'Statement & Flight Details',
        isWide: true,
        render: (r) => {
          if (r.voucherType === 'TICKET' || r.docType?.includes('تذكرة') || r.docType?.includes('Ticket')) {
            const pDetails: Array<{ name: string; ticketNumber?: string; ticketType?: string }> = r.passengersDetail || [];
            const pnrVal = r.pnr || r.reference || '';
            const routeClean = formatRouteCodesOnly(r.route);

            return (
              <div className="py-1 space-y-1.5 text-slate-900 text-xs">
                {/* Line 1: PNR Badge, Route Badge, Pax Badge */}
                <div className="flex items-center gap-2 font-bold flex-wrap">
                  <span className="inline-flex items-center gap-1 bg-slate-900 text-white px-2 py-0.5 rounded-md text-[11px] font-mono shadow-2xs">
                    <span>PNR: {pnrVal || '-'}</span>
                    {pnrVal && pnrVal !== '-' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(pnrVal);
                        }}
                        title={isAr ? 'نسخ الـ PNR' : 'Copy PNR'}
                        className="hover:bg-slate-700 p-0.5 rounded cursor-pointer transition-colors text-white"
                      >
                        <IconCopy size={10} />
                      </button>
                    )}
                  </span>

                  {routeClean && (
                    <span className="flex items-center gap-1 font-mono font-bold text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-[11px]">
                      <IconRoute size={12} className="text-emerald-700 shrink-0" />
                      <span>{routeClean}</span>
                    </span>
                  )}

                  {pDetails.length > 0 && (
                    <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-900 border border-indigo-200 px-2 py-0.5 rounded-md text-[10.5px] font-bold">
                      <IconUsers size={11} className="text-indigo-600 shrink-0" />
                      <span>{isAr ? 'العدد' : 'Pax'}</span>
                      <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[9.5px] font-bold flex items-center justify-center font-mono">
                        {pDetails.length}
                      </span>
                    </span>
                  )}
                </div>

                {/* Line 2+: Clean Horizontal Passenger Line Items */}
                {pDetails.length > 0 && (
                  <div className="space-y-1 font-mono text-[11.5px]">
                    {pDetails.map((pass, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-slate-800 font-bold leading-tight flex-wrap bg-slate-50/80 px-2 py-0.5 rounded-md border border-slate-200/60">
                        <IconUser size={12} className="text-indigo-500 shrink-0" />
                        <span className="text-slate-900 font-mono font-bold">{pass.name.trim()}</span>
                        {pass.ticketType && (
                          <span className="text-[9.5px] font-bold text-indigo-700 bg-indigo-100/70 px-1 py-0.2 rounded">
                            {pass.ticketType}
                          </span>
                        )}
                        {pass.ticketNumber && (
                          <span className="text-[10px] font-bold text-slate-600 bg-white px-1.5 py-0.2 rounded border border-slate-200">
                            #{pass.ticketNumber}
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const copyText = `${pass.name.trim()}${pass.ticketNumber ? ` - ${pass.ticketNumber}` : ''}`;
                            navigator.clipboard.writeText(copyText);
                          }}
                          title={isAr ? 'نسخ اسم المسافر' : 'Copy Passenger Name'}
                          className="hover:bg-slate-200 p-0.5 rounded text-slate-400 hover:text-slate-800 cursor-pointer transition-colors ms-auto"
                        >
                          <IconCopy size={10} />

                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <div
              className="whitespace-pre-line text-xs leading-relaxed py-1 font-bold text-slate-900"
              title={r.accountingDescription && r.accountingDescription !== r.description ? r.accountingDescription : undefined}
            >
              {r.description}
            </div>
          );
        },
      },
      {
        field: 'debit',
        headerText: `${isAr ? 'مدين (+)' : 'Debit (+)'} (${currency})`,
        width: 'w-32',
        align: 'left',
        isMonetary: true,
        render: (r) => {
          const itemCurr = (r.currency || 'IQD').toUpperCase();
          const sym = itemCurr.includes('USD') || itemCurr.includes('$') ? '$' : 'IQD';
          return r.debit > 0 ? (
            <div className="flex items-center gap-1 font-black tabular-nums text-rose-700 text-[12.5px] justify-end font-mono" dir="ltr">
              <span>{r.debit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              <span className="text-[9.5px] font-bold text-rose-700 bg-rose-50 px-1 py-0.2 rounded border border-rose-200">{sym}</span>
            </div>
          ) : (
            <span className="text-slate-300 text-center block w-full">—</span>
          );
        },
      },
      {
        field: 'credit',
        headerText: `${isAr ? 'دائن (-)' : 'Credit (-)'} (${currency})`,
        width: 'w-32',
        align: 'left',
        isMonetary: true,
        render: (r) => {
          const itemCurr = (r.currency || 'IQD').toUpperCase();
          const sym = itemCurr.includes('USD') || itemCurr.includes('$') ? '$' : 'IQD';
          return r.credit > 0 ? (
            <div className="flex items-center gap-1 font-black tabular-nums text-emerald-700 text-[12.5px] justify-end font-mono" dir="ltr">
              <span>{r.credit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              <span className="text-[9.5px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">{sym}</span>
            </div>
          ) : (
            <span className="text-slate-300 text-center block w-full">—</span>
          );
        },
      },
      {
        field: 'runningBalance',
        headerText: isAr ? 'الرصيد المتراكم' : 'Running Balance',
        width: 'w-36',
        align: 'left',
        isPinned: true,
        isMonetary: true,
        render: (r) => {
          // If viewing ALL currencies together, do not calculate/show mixed running balance
          if (currency === 'ALL' || currency === 'كلاهما') {
            return (
              <div className="flex items-center justify-center w-full py-1 text-slate-300 font-mono text-sm">
                <span title={isAr ? 'اختر عملة محددة (دينار أو دولار) لاحتساب الرصيد التراكمي' : 'Select a single currency to view cumulative running balance'}>—</span>
              </div>
            );
          }

          const val = Number(r.runningBalance || 0);
          const itemCurr = (r.currency || 'IQD').toUpperCase();
          const sym = itemCurr.includes('USD') || itemCurr.includes('$') ? '$' : 'IQD';
          const isNegative = val < 0; // Credit / له

          return (
            <div className="flex flex-col items-end justify-center gap-0.5 py-0.5" dir="ltr">
              <div className={`flex items-center gap-1 font-black tabular-nums text-[12.5px] font-mono ${isNegative ? 'text-emerald-700' : 'text-rose-700'}`}>
                <span>{isNegative ? `- ${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : val.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                <span className="text-[9.5px] font-bold text-slate-500 bg-slate-100 px-1 py-0.2 rounded border border-slate-200">{sym}</span>
              </div>
              <span className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded ${isNegative ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                {isNegative ? (isAr ? 'رصيد / دائن (له)' : 'Credit (Payable)') : (isAr ? 'طلب / مدين (عليه)' : 'Debit (Claim)')}
              </span>
            </div>
          );
        },
      },
      {
        field: 'entryUser',
        headerText: isAr ? 'موظف الإدخال' : 'Entry User',
        width: 'w-28',
        align: 'center',
        render: (r) => (
          <div className="flex items-center gap-1.5 justify-center text-slate-800 font-semibold text-[11.5px] truncate">
            <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[9.5px] font-bold">
              <IconUser size={11} />
            </div>
            <span className="truncate">{r.entryUser || r.user || (isAr ? 'النظام' : 'System')}</span>
          </div>
        ),
      },
      {
        field: 'user',
        headerText: isAr ? 'موظف الإصدار' : 'Issuing Agent',
        width: 'w-28',
        align: 'center',
        render: (r) => (
          <div className="flex items-center gap-1.5 justify-center text-slate-800 font-semibold text-[11.5px] truncate">
            <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center text-[9.5px] font-bold">
              <IconUserCheck size={11} />
            </div>
            <span className="truncate">{r.user}</span>
          </div>
        ),
      },

    ],
    [currency, isAr]
  );

  const handleOpenDocument = useCallback(async (row: any) => {
    if (!row) return;

    const dt = String(row.docType || '').toLowerCase();
    const isTicket =
      row.voucherType === 'TICKET' ||
      dt.includes('تذكرة') ||
      dt.includes('ticket') ||
      dt.includes('تأشيرة') ||
      dt.includes('visa');

    if (isTicket) {
      if (row.ticketRaw) {
        setEditingTicketData(row.ticketRaw);
        setTicketModalOpened(true);
        return;
      }
      const ticketId = row.ticketId || (row.id ? String(row.id).replace('ticket_cust_', '').replace('ticket_supp_', '').replace('ticket_cashbox_', '').replace('ticket_cust_cash_receipt_', '') : null);
      if (ticketId) {
        try {
          const fetched = await ticketsApi.getOne(ticketId);
          if (fetched) {
            setEditingTicketData(fetched);
            setTicketModalOpened(true);
            return;
          }
        } catch (e) {
          console.warn('Could not fetch ticket details:', e);
        }
      }
      if (row.ticketRaw || row.ticket) {
        setEditingTicketData(row.ticketRaw || row.ticket);
        setTicketModalOpened(true);
        return;
      }
    }

    // It's a financial voucher or journal entry
    let vType: 'RECEIPT' | 'PAYMENT' | 'EXCHANGE' | 'JOURNAL' = 'JOURNAL';
    const vNum = String(row.voucherNumber || row.entryNumber || '').toUpperCase();

    if (row.voucherType === 'RECEIPT' || dt.includes('قبض') || dt.includes('receipt') || vNum.includes('RV')) {
      vType = 'RECEIPT';
    } else if (row.voucherType === 'PAYMENT' || dt.includes('دفع') || dt.includes('صرف') || dt.includes('payment') || vNum.includes('PV')) {
      vType = 'PAYMENT';
    } else if (row.voucherType === 'EXCHANGE' || dt.includes('صرافة') || dt.includes('exchange')) {
      vType = 'EXCHANGE';
    }

    // Identify voucher ID or journal entry ID
    const vId = row.voucherId || row.journalEntryId || (row.id ? String(row.id).split('_')[0] : undefined);

    setVoucherModalType(vType);
    setEditVoucherId(vId);
    setVoucherModalOpened(true);
  }, []);

  const actionMenuItems: AccountingActionMenuItem[] = useMemo(
    () => [
      {
        label: isAr ? 'معاينة / تعديل المستند' : 'Edit / View Document',
        icon: IconEdit,
        onClick: (row: any) => {
          handleOpenDocument(row);
        },
      },
      {
        label: isAr ? 'عرض تفاصيل المستند' : 'View Document Details',
        icon: IconEye,
        onClick: (row: any) => {
          setSelectedMovement(row);
          setDrawerOpen(true);
        },
      },
      {
        label: isAr ? 'طباعة الحركة' : 'Print Transaction',
        icon: IconPrinter,
        onClick: () => window.print(),
      },
    ],
    [handleOpenDocument, isAr]
  );

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1750px] mx-auto w-full select-none font-sans" dir={direction}>
      {/* ── 1. SUMMARY KPI FINANCIAL CARDS (TOP SECTION) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 no-print">
        {/* Card 1: Account Header & Opening */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">{isAr ? 'الحساب ورصيد البداية' : 'Account & Opening'}</span>
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#F45A0A] border border-orange-100 flex items-center justify-center font-bold">
              <IconWallet size={16} />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-base font-black text-slate-900 truncate">
              {selectedAccount ? (isAr ? selectedAccount.nameAr : (selectedAccount.nameEn || selectedAccount.nameAr)) : (isAr ? 'لم يتم اختيار حساب' : 'No Account Selected')}
            </div>
            <div className="text-xs font-mono font-bold text-slate-500 mt-1 flex items-center gap-1.5" dir="ltr">
              {selectedAccount ? (
                <>
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">
                    {selectedAccount.code}
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-600 font-semibold">{isAr ? 'افتتاحي:' : 'Op:'}</span>
                  <span className="font-black text-slate-800">{(openingBalIQD || 0).toLocaleString()} IQD</span>
                </>
              ) : (
                <span className="text-slate-400 font-sans text-xs">{isAr ? 'اختر حساباً للبدء' : 'Select an account to begin'}</span>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Total Debits (عليك / طلب) */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">{isAr ? 'إجمالي المدين (طلب +)' : 'Total Debits (+)'}</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center font-bold">
              <IconArrowDownLeft size={16} />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-rose-700 font-mono tracking-tight tabular-nums" dir="ltr">
              {(totalDebitIQD || 0).toLocaleString()}{' '}
              <span className="text-xs font-sans font-bold text-slate-500">IQD</span>
            </div>
            {totalDebitUSD !== 0 && (
              <div className="text-xs font-bold text-rose-600 font-mono mt-0.5 tabular-nums" dir="ltr">
                ${(totalDebitUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Total Credits (لك / مدفوع) */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">{isAr ? 'إجمالي الدائن (مدفوع -)' : 'Total Credits (-)'}</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center font-bold">
              <IconArrowUpRight size={16} />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-emerald-700 font-mono tracking-tight tabular-nums" dir="ltr">
              {(totalCreditIQD || 0).toLocaleString()}{' '}
              <span className="text-xs font-sans font-bold text-slate-500">IQD</span>
            </div>
            {totalCreditUSD !== 0 && (
              <div className="text-xs font-bold text-emerald-600 font-mono mt-0.5 tabular-nums" dir="ltr">
                ${(totalCreditUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            )}
          </div>
        </div>

        {/* Card 4: Net Balance & Dynamic Status */}
        <div className={`p-4.5 rounded-2xl border shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between ${
          balanceIQD === 0 && selectedAccount
            ? 'bg-slate-50 border-slate-200'
            : balanceIQD > 0
              ? 'bg-gradient-to-br from-white via-rose-50/20 to-rose-50/40 border-rose-200/80'
              : 'bg-gradient-to-br from-white via-emerald-50/20 to-emerald-50/40 border-emerald-200/80'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">{isAr ? 'صافي الرصيد الختامي' : 'Net Closing Balance'}</span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border ${
                !selectedAccount
                  ? 'bg-slate-100 text-slate-500 border-slate-200'
                  : balanceIQD === 0
                    ? 'bg-slate-100 text-slate-700 border-slate-300'
                    : balanceIQD > 0
                      ? 'bg-rose-100/80 text-rose-800 border-rose-300'
                      : 'bg-emerald-100/80 text-emerald-800 border-emerald-300'
              }`}
            >
              {!selectedAccount
                ? (isAr ? 'غير محدد' : 'Unset')
                : balanceIQD === 0
                  ? (isAr ? 'خالص الرصيد ⚖️' : 'Settled ⚖️')
                  : balanceIQD > 0
                    ? (isAr ? 'المطلوب منك (مدين 🔴)' : 'Debit (Claim 🔴)')
                    : (isAr ? 'الرصيد لك (دائن 🟢)' : 'Credit (Payable 🟢)')}
            </span>
          </div>
          <div className="mt-2.5">
            <div className={`text-2xl sm:text-3xl font-black font-mono tracking-tight tabular-nums ${
              !selectedAccount ? 'text-slate-400' : balanceIQD >= 0 ? 'text-rose-700' : 'text-emerald-700'
            }`} dir="ltr">
              {Math.abs(balanceIQD || 0).toLocaleString()}{' '}
              <span className="text-xs font-sans font-bold text-slate-500">IQD</span>
            </div>
            {balanceUSD !== 0 && (
              <div className={`text-xs font-bold font-mono mt-0.5 tabular-nums ${balanceUSD >= 0 ? 'text-rose-600' : 'text-emerald-600'}`} dir="ltr">
                ${Math.abs(balanceUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. MODERN CONTROL TOOLBAR (UNIFIED & CLEAN) ── */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs no-print flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Left Side: Account Search + Date Range */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
          {/* Account Search Combobox */}
          <div className="flex-1 min-w-[260px] max-w-md relative">
            <div className="relative">
              <IconSearch size={16} className="absolute top-1/2 -translate-y-1/2 start-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={accountSearch}
                onChange={(e) => {
                  setAccountSearch(e.target.value);
                  setShowAccountDropdown(true);
                  if (!e.target.value) setSelectedAccountId('');
                }}
                onFocus={() => setShowAccountDropdown(true)}
                onBlur={() => setTimeout(() => setShowAccountDropdown(false), 220)}
                placeholder={isAr ? 'ابحث عن الحساب بالاسم أو الرمز...' : 'Search account by name or code...'}
                className="w-full h-11 ps-10 pe-9 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white focus:bg-white focus:border-[#F45A0A] focus:ring-3 focus:ring-[#F45A0A]/10 text-xs font-bold text-slate-900 placeholder:text-slate-400 outline-none transition-all shadow-2xs"
              />
              {accountSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setAccountSearch('');
                    setSelectedAccountId('');
                    setStatementMovements([]);
                    setHasSearched(false);
                  }}
                  className="absolute top-1/2 -translate-y-1/2 end-3 text-slate-400 hover:text-red-500 cursor-pointer transition-colors"
                >
                  <IconX size={15} />
                </button>
              )}
            </div>

            {/* Dropdown Popup */}
            {showAccountDropdown && filteredAccounts.length > 0 && (
              <div className="absolute z-50 top-full start-0 end-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-72 overflow-y-auto divide-y divide-slate-100 font-sans">
                {filteredAccounts.slice(0, 35).map((acc) => (
                  <button
                    key={acc.id}
                    onMouseDown={() => selectAccount(acc)}
                    className={`w-full text-start px-3.5 py-2.5 text-xs hover:bg-orange-50 transition-colors cursor-pointer flex items-center justify-between ${
                      selectedAccountId === acc.id ? 'bg-orange-50/90 text-[#C2410C]' : 'text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]" dir="ltr">
                        {acc.code}
                      </span>
                      <span className="font-bold truncate">{isAr ? acc.nameAr : (acc.nameEn || acc.nameAr)}</span>
                    </div>
                    <Badge size="xs" color="gray" variant="light" className="shrink-0 font-semibold">
                      {acc.type}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Date Range Picker */}
          <div className="shrink-0">
            <AccountingDateRangePicker
              withTime={false}
              startDate={startDate}
              endDate={endDate}
              onChange={(start, end) => {
                setStartDate(start);
                setEndDate(end);
              }}
            />
          </div>
        </div>

        {/* Right Side: Currency, Actions, Print, Filter Toggle */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => handleFetchStatement(true)}
            disabled={!selectedAccountId || loading}
            className="h-11 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
            title={isAr ? 'تحديث الكشف من الخادم' : 'Refresh Statement'}
          >
            <IconRefresh size={16} className={loading ? 'animate-spin text-[#F45A0A]' : 'text-slate-500'} />
            <span className="hidden sm:inline">{isAr ? 'تحديث' : 'Refresh'}</span>
          </button>

          {/* Actions & Export Menu */}
          <Menu position="bottom-end" shadow="xl" width={190} radius="md">
            <Menu.Target>
              <button
                type="button"
                className="h-11 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <IconDotsVertical size={16} className="text-slate-500" />
                <span>{isAr ? 'الإجراءات والتصدير' : 'Actions & Export'}</span>
                <IconChevronDown size={12} className="text-slate-400" />
              </button>
            </Menu.Target>
            <Menu.Dropdown className="text-xs p-1.5 space-y-1 font-sans" dir={direction}>
              <Menu.Item
                leftSection={<IconFileSpreadsheet size={15} className="text-emerald-600" />}
                onClick={handleExportExcel}
                disabled={!calculatedRows || calculatedRows.length === 0}
                className="font-bold text-slate-700"
              >
                {isAr ? 'تصدير Excel (XLSX)' : 'Export Excel'}
              </Menu.Item>
              <Menu.Item
                leftSection={<IconFileTypePdf size={15} className="text-red-600 font-bold" />}
                onClick={() => setQuickExportModalOpened(true)}
                disabled={!selectedAccountId}
                className="font-bold text-slate-700"
              >
                {isAr ? 'تصدير كشف PDF سريع' : 'Quick PDF Export'}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                leftSection={<IconPrinter size={15} className="text-blue-600" />}
                onClick={() => setPrintModalOpened(true)}
                disabled={!selectedAccountId}
                className="font-bold text-slate-700"
              >
                {isAr ? 'طباعة الكشف الرسمي HD' : 'Print Statement Sheet'}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>

          {/* New Financial Voucher Button with Menu */}
          <Menu position="bottom-end" shadow="xl" width={200} radius="md">
            <Menu.Target>
              <button
                type="button"
                className="h-11 px-4 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-black text-xs shadow-md shadow-orange-500/20 transition-all flex items-center gap-2 cursor-pointer hover:shadow-lg active:scale-98"
              >
                <IconPlus size={16} stroke={2.5} />
                <span>{isAr ? 'إضافة سند مالي' : 'New Voucher'}</span>
                <IconChevronDown size={12} className="text-white/80" />
              </button>
            </Menu.Target>
            <Menu.Dropdown className="text-xs p-1.5 space-y-1 font-sans" dir={direction}>
              <Menu.Item
                leftSection={<IconArrowDownLeft size={15} className="text-emerald-600" />}
                onClick={() => {
                  setVoucherModalType('RECEIPT');
                  setVoucherModalOpened(true);
                }}
                className="font-bold text-slate-700"
              >
                {isAr ? 'سند قبض مالي' : 'Receipt Voucher'}
              </Menu.Item>
              <Menu.Item
                leftSection={<IconArrowUpRight size={15} className="text-rose-600" />}
                onClick={() => {
                  setVoucherModalType('PAYMENT');
                  setVoucherModalOpened(true);
                }}
                className="font-bold text-slate-700"
              >
                {isAr ? 'سند دفع وصرف' : 'Payment Voucher'}
              </Menu.Item>
              <Menu.Item
                leftSection={<IconArrowsExchange size={15} className="text-amber-600" />}
                onClick={() => {
                  setVoucherModalType('EXCHANGE');
                  setVoucherModalOpened(true);
                }}
                className="font-bold text-slate-700"
              >
                {isAr ? 'سند صرافة وتحويل' : 'FX Transfer Voucher'}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                leftSection={<IconFileText size={15} className="text-orange-600" />}
                onClick={() => {
                  setVoucherModalType('JOURNAL');
                  setVoucherModalOpened(true);
                }}
                className="font-bold text-slate-700"
              >
                {isAr ? 'سند قيد محاسبي' : 'Journal Voucher'}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>

          {/* Direct Print Button */}
          <button
            type="button"
            onClick={() => setPrintModalOpened(true)}
            disabled={!selectedAccountId}
            className="h-11 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer hover:shadow-sm disabled:opacity-50"
          >
            <IconPrinter size={16} className="text-slate-500" />
            <span>{isAr ? 'طباعة الكشف' : 'Print Statement'}</span>
          </button>

          {/* Toggle Sidebar Filter Button */}
          <button
            type="button"
            onClick={() => setFiltersVisible(!filtersVisible)}
            className={`h-11 px-3 rounded-xl border transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs ${
              filtersVisible
                ? 'bg-orange-50/80 border-orange-200 text-[#F45A0A] font-bold'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold'
            }`}
            title={isAr ? 'إظهار/إخفاء الفلاتر الجانبية' : 'Toggle Filters Sidebar'}
          >
            <IconFilter size={16} />
            <span className="text-xs">{isAr ? 'الفلاتر' : 'Filters'}</span>
          </button>
        </div>
      </div>

      {/* ── 3. MAIN WORKSPACE (Collapsible Sidebar Filters + Transactions Grid) ── */}
      <div className="flex items-start gap-3.5 w-full">
        {/* Collapsible Sidebar Filter Panel */}
        {filtersVisible && (
          <div className="w-64 bg-white rounded-2xl border border-slate-200/90 shadow-xs p-3.5 space-y-3.5 shrink-0 no-print">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2 font-black text-xs text-slate-900">
                <IconAdjustmentsHorizontal size={16} className="text-[#F45A0A]" />
                <span>{isAr ? 'فلاتر الكشف' : 'Statement Filters'}</span>
              </div>
              <span className="text-[10.5px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                {calculatedRows.length} {isAr ? 'حركة' : 'items'}
              </span>
            </div>

            {/* Active Period + Reset */}
            <div className="flex items-center justify-between gap-2 -mt-1.5">
              <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 truncate" dir="ltr">
                {rangeStartDay || '—'} ➔ {rangeEndDay || '—'}
              </span>
              <button
                type="button"
                onClick={resetAllFilters}
                className="text-[10.5px] font-bold text-[#F45A0A] hover:underline cursor-pointer shrink-0"
                title={isAr ? 'إرجاع كل الفلاتر للوضع الافتراضي' : 'Reset all filters'}
              >
                {isAr ? 'تصفير الفلاتر' : 'Reset'}
              </button>
            </div>

            {/* Filter Tabs (Movements vs Services) */}
            <Tabs defaultValue="movements" color="orange" radius="md">
              <Tabs.List grow className="mb-2 font-bold text-xs">
                <Tabs.Tab value="movements">{isAr ? 'الحركات' : 'Movements'}</Tabs.Tab>
                <Tabs.Tab value="services">{isAr ? 'الخدمات' : 'Services'}</Tabs.Tab>
              </Tabs.List>

              {/* Panel 1: Movements */}
              <Tabs.Panel value="movements" className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px] px-1 mb-1">
                  <span className="text-slate-400 font-bold">{isAr ? 'التحكم السريع' : 'Quick Toggle'}</span>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => toggleAllMovements(true)} className="text-[11px] text-emerald-600 hover:underline font-bold cursor-pointer">
                      {isAr ? 'تشغيل' : 'All'}
                    </button>
                    <span className="text-slate-300">|</span>
                    <button type="button" onClick={() => toggleAllMovements(false)} className="text-[11px] text-rose-500 hover:underline font-bold cursor-pointer">
                      {isAr ? 'إطفاء' : 'None'}
                    </button>
                  </div>
                </div>

                {MOVEMENT_FILTERS.map((f) => (
                  <div
                    key={f.key}
                    onClick={() => toggleFilter(f.key)}
                    className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                      activeFilters[f.key] ? 'bg-white border-slate-200 shadow-2xs' : 'bg-slate-50 border-transparent opacity-40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${f.color}15`, color: f.color }}>
                        <f.icon size={13} />
                      </div>
                      <span className="font-bold text-slate-800 text-xs">{f.label}</span>
                    </div>
                    <Switch size="xs" color="orange" checked={activeFilters[f.key]} onChange={() => toggleFilter(f.key)} />
                  </div>
                ))}

                {/* Balance Rollup Filters */}
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 px-1 block">{isAr ? 'الأرصدة المرحّلة' : 'Carried Balances'}</span>
                  {BALANCE_FILTERS.map((f) => (
                    <div
                      key={f.key}
                      onClick={() => toggleFilter(f.key)}
                      className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                        activeFilters[f.key] ? 'bg-white border-slate-200 shadow-2xs' : 'bg-slate-50 border-transparent opacity-40'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${f.color}15`, color: f.color }}>
                          <f.icon size={13} />
                        </div>
                        <span className="font-bold text-slate-800 text-xs">{f.label}</span>
                      </div>
                      <Switch size="xs" color="orange" checked={activeFilters[f.key]} onChange={() => toggleFilter(f.key)} />
                    </div>
                  ))}
                </div>
              </Tabs.Panel>

              {/* Panel 2: Services */}
              <Tabs.Panel value="services" className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px] px-1 mb-1">
                  <span className="text-slate-400 font-bold">{isAr ? 'التحكم السريع' : 'Quick Toggle'}</span>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => toggleAllServices(true)} className="text-[11px] text-emerald-600 hover:underline font-bold cursor-pointer">
                      {isAr ? 'تشغيل' : 'All'}
                    </button>
                    <span className="text-slate-300">|</span>
                    <button type="button" onClick={() => toggleAllServices(false)} className="text-[11px] text-rose-500 hover:underline font-bold cursor-pointer">
                      {isAr ? 'إطفاء' : 'None'}
                    </button>
                  </div>
                </div>

                {SERVICE_FILTERS.map((f) => (
                  <div
                    key={f.key}
                    onClick={() => toggleFilter(f.key)}
                    className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                      activeFilters[f.key] ? 'bg-white border-slate-200 shadow-2xs' : 'bg-slate-50 border-transparent opacity-40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${f.color}15`, color: f.color }}>
                        <f.icon size={13} />
                      </div>
                      <span className="font-bold text-slate-800 text-xs">{f.label}</span>
                    </div>
                    <Switch size="xs" color="orange" checked={activeFilters[f.key]} onChange={() => toggleFilter(f.key)} />
                  </div>
                ))}
              </Tabs.Panel>
            </Tabs>

            {/* Inner Statement Text Search */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-[10.5px] font-bold text-slate-400 mb-1">
                {isAr ? 'بحث نصي داخل الكشف' : 'Search Within Ledger'}
              </label>
              <div className="relative">
                <IconSearch size={13} className="absolute top-1/2 -translate-y-1/2 start-2.5 text-slate-400" />
                <input
                  type="text"
                  value={innerSearch}
                  onChange={(e) => setInnerSearch(e.target.value)}
                  placeholder={isAr ? 'رقم السند، PNR، البيان...' : 'Voucher #, PNR, Memo...'}
                  className="w-full h-8 ps-8 pe-7 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 placeholder:text-slate-400 outline-none focus:bg-white focus:border-[#F45A0A]"
                />
                {innerSearch && (
                  <button type="button" onClick={() => setInnerSearch('')} className="absolute top-1/2 -translate-y-1/2 end-2 text-slate-400 hover:text-slate-700 cursor-pointer">
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Currency Selector */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-[10.5px] font-bold text-slate-400 mb-1">
                {isAr ? 'عرض العملة' : 'Currency Filter'}
              </label>
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
                {['ALL', 'IQD', 'USD'].map((c) => {
                  const isActive = currency === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCurrency(c)}
                      className={`py-1 rounded-lg transition-all cursor-pointer ${
                        isActive ? 'bg-[#F45A0A] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                      }`}
                    >
                      {c === 'ALL' ? (isAr ? 'الكل' : 'ALL') : c === 'USD' ? '$ USD' : 'IQD'}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Transactions Accounting Grid */}
        <div className="flex-1 min-w-0">
          {!selectedAccountId && !hasSearched ? (
            <div className="text-center py-20 px-6 space-y-5 bg-white rounded-2xl border border-slate-200/90 shadow-xs">
              <div className="mx-auto w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center pointer-events-none">
                <img
                  src="/illustrations/organizing-papers.svg"
                  alt="Account Statement"
                  className="w-full h-full object-contain drop-shadow-sm transition-transform hover:scale-105"
                />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="font-black text-xl text-slate-900 tracking-tight">
                  {isAr ? 'اختر حساباً لعرض كشف الحساب المالي' : 'Select an Account to View Statement'}
                </h3>
                <p className="text-xs font-bold text-slate-500 leading-relaxed">
                  {isAr
                    ? 'قم بالبحث عن الحساب المحاسبي من الشريط العلوي واختياره لعرض الحركات المالية والمطابقات تلقائياً.'
                    : 'Search and select an account from the top toolbar to automatically load the financial ledger.'}
                </p>
              </div>
            </div>
          ) : (
            <AccountingGrid
              gridKey="statement_accounting_grid"
              data={calculatedRows}
              columnDefs={columnDefs}
              loading={loading}
              onRefresh={() => handleFetchStatement(true)}
              actionMenuItems={actionMenuItems}
              onRowDoubleClick={handleOpenDocument}
              hideHeaderCard={true}
              hideFooter={false}
              customFooterSummary={
                selectedAccount && hasSearched ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs w-full py-2 px-3 bg-slate-50 border-t border-slate-200 font-sans" dir={direction}>
                    <div className="flex items-center gap-3 text-xs">
                      <div className="bg-white border border-slate-200 px-3 py-1 rounded-xl shadow-2xs">
                        <span className="text-[10px] text-slate-400 font-bold block">{isAr ? 'الحساب' : 'Account'}</span>
                        <span className="font-bold text-slate-900">
                          {selectedAccount.code} — {isAr ? selectedAccount.nameAr : (selectedAccount.nameEn || selectedAccount.nameAr)}
                        </span>
                      </div>
                      <div className="bg-white border border-slate-200 px-3 py-1 rounded-xl shadow-2xs">
                        <span className="text-[10px] text-slate-400 font-bold block">{isAr ? 'عدد الحركات' : 'Movements Count'}</span>
                        <span className="font-bold font-mono text-[#F45A0A]">{calculatedRows.length}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                      {/* IQD Currency Block */}
                      {(currency === 'ALL' || currency === 'IQD' || currency === 'كلاهما' || totalDebitIQD > 0 || totalCreditIQD > 0) && (
                        <div className="bg-white border border-slate-200/90 px-3 py-1.5 rounded-xl shadow-2xs text-xs flex items-center gap-2 font-sans">
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                            {isAr ? 'دينار (د.ع)' : 'IQD'}
                          </span>
                          <span className="text-slate-400 font-bold text-[11px]">{isAr ? 'مدين:' : 'Deb:'}</span>
                          <span className="font-bold text-rose-700 font-mono" dir="ltr">{(totalDebitIQD || 0).toLocaleString()}</span>
                          <span className="text-slate-300">|</span>
                          <span className="text-slate-400 font-bold text-[11px]">{isAr ? 'دائن:' : 'Cred:'}</span>
                          <span className="font-bold text-emerald-700 font-mono" dir="ltr">{(totalCreditIQD || 0).toLocaleString()}</span>
                          <span className="text-slate-300">|</span>
                          <span className="font-bold text-slate-800 text-[11px]">{isAr ? 'الصافي:' : 'Net:'}</span>
                          <span
                            className={`font-black font-mono px-1.5 py-0.5 rounded text-[11px] ${
                              balanceIQD >= 0
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                            dir="ltr"
                          >
                            {Math.abs(balanceIQD || 0).toLocaleString()} {isAr ? (balanceIQD >= 0 ? '(طلب عليه)' : '(رصيد له)') : (balanceIQD >= 0 ? 'Dr' : 'Cr')}
                          </span>
                        </div>
                      )}

                      {/* USD Currency Block */}
                      {(currency === 'ALL' || currency === 'USD' || currency === 'كلاهما' || totalDebitUSD > 0 || totalCreditUSD > 0) && (
                        <div className="bg-white border border-slate-200/90 px-3 py-1.5 rounded-xl shadow-2xs text-xs flex items-center gap-2 font-sans">
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {isAr ? 'دولار ($)' : 'USD'}
                          </span>
                          <span className="text-slate-400 font-bold text-[11px]">{isAr ? 'مدين:' : 'Deb:'}</span>
                          <span className="font-bold text-rose-700 font-mono" dir="ltr">${(totalDebitUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                          <span className="text-slate-300">|</span>
                          <span className="text-slate-400 font-bold text-[11px]">{isAr ? 'دائن:' : 'Cred:'}</span>
                          <span className="font-bold text-emerald-700 font-mono" dir="ltr">${(totalCreditUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                          <span className="text-slate-300">|</span>
                          <span className="font-bold text-slate-800 text-[11px]">{isAr ? 'الصافي:' : 'Net:'}</span>
                          <span
                            className={`font-black font-mono px-1.5 py-0.5 rounded text-[11px] ${
                              balanceUSD >= 0
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                            dir="ltr"
                          >
                            ${Math.abs(balanceUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} {isAr ? (balanceUSD >= 0 ? '(طلب عليه)' : '(رصيد له)') : (balanceUSD >= 0 ? 'Dr' : 'Cr')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null
              }
            />
          )}
        </div>
      </div>

      {/* ── 4. MOVEMENT DETAILS DRAWER ── */}
      <Drawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={
          <div className="flex items-center gap-2 font-bold text-slate-900 text-sm" dir={direction}>
            <IconFileText size={18} className="text-[#F45A0A]" />
            <span>{isAr ? 'تفاصيل الحركة المالية والمستند' : 'Transaction & Document Details'}</span>
          </div>
        }
        position={direction === 'rtl' ? 'left' : 'right'}
        size="md"
        radius="lg"
      >
        {selectedMovement && (
          <div className="space-y-4 text-xs font-sans" dir={direction}>
            <div className="p-4 bg-orange-50/60 border border-orange-200 rounded-xl space-y-1.5">
              <span className="text-[11px] text-[#C2410C] font-bold block">{isAr ? 'المستند ونوعه' : 'Document Type'}</span>
              <div className="text-base font-black text-slate-900 font-mono">
                {selectedMovement.docType} — #{selectedMovement.voucherNumber || selectedMovement.entryNumber}
              </div>
              <div className="text-xs text-slate-500 font-mono">
                {new Date(selectedMovement.date).toLocaleDateString('en-GB')}
                {selectedMovement.entryDate && (
                  <span className="ms-2">
                    {isAr ? 'إدخال:' : 'Entered:'}{' '}
                    {new Date(selectedMovement.entryDate).toLocaleDateString('en-GB')}{' '}
                    {new Date(selectedMovement.entryDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2.5">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <span className="text-slate-500 font-medium">{isAr ? 'البيان وشرح الحركة:' : 'Description:'}</span>
                <span className="font-bold text-slate-900">{selectedMovement.description || '—'}</span>
              </div>
              {selectedMovement.accountingDescription && selectedMovement.accountingDescription !== selectedMovement.description && (
                <div className="flex justify-between items-start gap-3 border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-medium shrink-0">{isAr ? 'الشرح المحاسبي:' : 'Ledger note:'}</span>
                  <span className="text-slate-700 text-end">{selectedMovement.accountingDescription}</span>
                </div>
              )}
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <span className="text-slate-500 font-medium">{isAr ? 'المبلغ المدين:' : 'Debit Amount:'}</span>
                <span className="font-mono font-bold text-rose-700" dir="ltr">{Number(selectedMovement.debit || 0).toLocaleString()} {selectedMovement.currency}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <span className="text-slate-500 font-medium">{isAr ? 'المبلغ الدائن:' : 'Credit Amount:'}</span>
                <span className="font-mono font-bold text-emerald-700" dir="ltr">{Number(selectedMovement.credit || 0).toLocaleString()} {selectedMovement.currency}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <span className="text-slate-500 font-medium">{isAr ? 'الرصيد المتراكم:' : 'Running Balance:'}</span>
                <span className="font-mono font-black text-slate-900" dir="ltr">{Number(selectedMovement.runningBalance || 0).toLocaleString()} {selectedMovement.currency}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">{isAr ? 'المستخدم المسؤول:' : 'Logged User:'}</span>
                <span className="font-bold text-slate-800">{selectedMovement.entryUser || selectedMovement.user || '—'}</span>
              </div>
            </div>

            {/* Edit / View Document Action */}
            <button
              type="button"
              onClick={() => {
                setDrawerOpen(false);
                handleOpenDocument(selectedMovement);
              }}
              className="w-full mt-3 py-2.5 px-4 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-colors"
            >
              <IconEdit size={16} />
              <span>{isAr ? 'فتح وتعديل المستند' : 'Open & Edit Document'}</span>
            </button>
          </div>
        )}
      </Drawer>

      {/* ── 5. PRINT & EXPORT MODALS ── */}
      {selectedAccount && (
        <>
          <AccountStatementPrintModal
            opened={printModalOpened}
            onClose={() => setPrintModalOpened(false)}
            accountName={isAr ? selectedAccount.nameAr : (selectedAccount.nameEn || selectedAccount.nameAr)}
            accountId={selectedAccount.id}
            accountCode={selectedAccount.code}
            accountPhone={selectedAccount.phone}
            accountEmail={selectedAccount.email}
            accountAddress={selectedAccount.address}
            startDate={rangeStartDay}
            endDate={rangeEndDay}
            rows={printRows}
            totals={{
              totalDebit,
              totalCredit,
              finalBalance: closingBalance,
              openingBalance: openingBalIQD,
              previousBalance: 0,
            }}
          />

          <AccountStatementQuickExportModal
            opened={quickExportModalOpened}
            onClose={() => setQuickExportModalOpened(false)}
            onOpenAdvancedPreview={() => setPrintModalOpened(true)}
            accountName={isAr ? selectedAccount.nameAr : (selectedAccount.nameEn || selectedAccount.nameAr)}
            accountId={selectedAccount.id}
            accountCode={selectedAccount.code}
            accountPhone={selectedAccount.phone}
            accountEmail={selectedAccount.email}
            accountAddress={selectedAccount.address}
            startDate={rangeStartDay}
            endDate={rangeEndDay}
            rows={printRows}
            totals={{
              totalDebit,
              totalCredit,
              finalBalance: closingBalance,
              openingBalance: openingBalIQD,
              previousBalance: 0,
            }}
          />
        </>
      )}

      {/* ── Financial Voucher Form Modal (Create / Edit) ── */}
      <FinancialVoucherForm
        opened={voucherModalOpened}
        onClose={() => {
          setVoucherModalOpened(false);
          setEditVoucherId(undefined);
        }}
        onSuccess={() => {
          setVoucherModalOpened(false);
          setEditVoucherId(undefined);
          handleFetchStatement(true);
        }}
        initialType={voucherModalType}
        initialVoucherType={voucherModalType}
        initialVoucherId={editVoucherId}
      />

      {/* ── Ticket Invoice Editor Workspace Modal (Create / Edit) ── */}
      <TicketInvoiceEditorWorkspace
        opened={ticketModalOpened}
        initialData={editingTicketData}
        onClose={() => {
          setTicketModalOpened(false);
          setEditingTicketData(null);
        }}
        onSuccess={() => {
          setTicketModalOpened(false);
          setEditingTicketData(null);
          handleFetchStatement(true);
        }}
      />
    </div>
  );
};

export default ReportsPage;
