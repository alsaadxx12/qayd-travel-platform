import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Tooltip, Menu, Modal, Popover } from '@mantine/core';
import { Lottie } from 'lottie-react';
import aiSpiderAnimation from '../../assets/animations/ai-spider.json';

import {
  PlaneTakeoff,
  Plus,
  Edit3,
  History,
  Copy,
  UsersRound,
  MoreVertical,
  Image as ImageIcon,
  TrendingUp,
  Banknote,
  ReceiptText,
  Search,
  Filter,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  BadgeCheck,
  Clock3,
  ShieldAlert,
  ShieldCheck,
  ListFilter,
  Plane,
  Layers,
  Users,
  Check,
  RotateCcw,
  Trash2,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { TicketInvoiceEditorWorkspace } from '../../components/tickets/TicketInvoiceEditorWorkspace';
import { GroupFareEditorWorkspace } from '../../components/tickets/GroupFareEditorWorkspace';
import { GroupFileWorkspace } from '../../components/groups/GroupFileWorkspace';
import { TicketRefundEditorWorkspace } from '../../components/refunds/TicketRefundEditorWorkspace';
import { InvoiceAuditLogModal } from '../../components/tickets/InvoiceAuditLogModal';
import { SmartTicketImportModal, ParsedTicketData } from '../../components/tickets/SmartTicketImportModal';
import { SegmentedDatePicker } from '../../components/ui/SegmentedDatePicker';
import { SearchableCombobox, ComboboxOption } from '../../components/ui/SearchableCombobox';
import { CurrencySegmentedControl } from '../../components/ui/CurrencySegmentedControl';
import { airlinesApi, type AirlineItem } from '../../api/airlines';
import { ticketsApi, type TicketData } from '../../api/tickets';
import { showSuccessNotification, showErrorNotification, showInfoNotification } from '../../utils/notifications';
import { archiveTicket } from '../../utils/deletedRecordsArchive';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguageStore } from '../../store/useLanguageStore';
import { useAiPageContext } from '../../hooks/useAiPageContext';

// Global in-memory cache for instant zero-latency loading (0ms)
let globalTicketsMemoryCache: any[] | null = null;
let globalAirlinesMemoryCache: AirlineItem[] | null = null;

// Format short date YYYY-MM-DD
const formatDateShort = (val: any) => {
  if (!val || val === '—') return '—';
  const str = String(val).trim();
  if (str.includes('T')) return str.split('T')[0];
  if (str.includes(' ')) return str.split(' ')[0];
  if (str.length >= 10) return str.substring(0, 10);
  return str;
};

// Resolve clean employee name
const resolveEmployeeName = (val: any, fallback = 'غير محدد') => {
  if (!val) return fallback;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || trimmed === '—') return fallback;
    if (trimmed.startsWith('emp-') || /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(trimmed)) return fallback;
    return trimmed;
  }
  if (typeof val === 'object') {
    return val.name || val.nameAr || val.label || val.username || fallback;
  }
  return fallback;
};

// Resolve clean supplier name
const getCleanSupplierName = (data: any, suppsList: any[] = [], accsList: any[] = []) => {
  const isUuid = (v?: string) => v && (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(v) || v.includes('0a5e') || v.includes('oa5e'));

  const relatedSupplierName = data.supplier?.nameAr || data.supplier?.nameEn;
  if (relatedSupplierName) return relatedSupplierName;

  const rawName = data.supplierAccountName;
  if (rawName && !isUuid(rawName)) {
    return rawName.replace(/^حساب مورد:\s*/, '').replace(/^مورد شركة\s*/, '');
  }

  const suppVal = data.supplierAccount || rawName || data.supplierId;
  if (suppVal && isUuid(suppVal)) {
    const foundSupp = suppsList.find((s: any) => s.id === suppVal || s.accountId === suppVal || s.code === suppVal);
    if (foundSupp) return (foundSupp.nameAr || foundSupp.name || foundSupp.label).replace(/^حساب مورد:\s*/, '').replace(/^مورد شركة\s*/, '');

    const foundAcc = accsList.find((a: any) => a.id === suppVal || a.code === suppVal);
    if (foundAcc) return (foundAcc.nameAr || foundAcc.name || foundAcc.label).replace(/^حساب مورد:\s*/, '').replace(/^مورد شركة\s*/, '');
  }

  return 'غير محدد';
};

// Clean payment method label
const resolvePaymentLabel = (rawMethod?: string, rawType?: string, lang = 'ar') => {
  const str = (rawType || rawMethod || '').toUpperCase();
  if (str.includes('DEBIT') || str.includes('CASH') || str.includes('نقد') || str.includes('صندوق')) {
    return lang === 'ar' ? 'نقدي' : 'Cash';
  }
  if (str.includes('CREDIT') || str.includes('آجل') || str.includes('اجل') || str.includes('دين')) {
    return lang === 'ar' ? 'آجل' : 'Credit';
  }
  if (str.includes('PARTIAL') || str.includes('جزئي')) {
    return lang === 'ar' ? 'جزئي' : 'Partial';
  }
  return lang === 'ar' ? 'غير محدد' : 'Not specified';
};

// Map DB Ticket to Master Row
const convertDbTicketToLocal = (t: TicketData): any => ({
  ...t,
  id: t.id || t.invoiceNumber,
  invoiceNumber: t.invoiceNumber,
  issueDate: t.issueDate || (t as any).date || (t as any).createdAt,
  date: t.issueDate || (t as any).date || (t as any).createdAt,
  createdAt: (t as any).createdAt || t.issueDate,
  passengers: (t.passengers || []).map((p) => ({
    ...p,
    passenger: p.name,
    name: p.name,
  })),
  lines: (t.passengers || []).map((p) => ({
    ...p,
    passenger: p.name,
    name: p.name,
  })),
  totals: {
    totalSell: t.totalSell || 0,
    totalBuy: t.totalBuy || 0,
    netSell: t.netSell || 0,
    netBuy: t.netBuy || 0,
    profit: t.profit || 0,
    discountAmount: t.discountAmount || 0,
  },
  isAudited: t.isAudited || false,
  updatedAt: t.updatedAt,
});

const mapInvoicesToMasterRows = (
  savedInvoices: any[],
  airlines: AirlineItem[] = [],
  supps: any[] = [],
  accs: any[] = [],
  custs: any[] = [],
  refundTickets: any[] = []
) => {
  return savedInvoices.map((data, invoiceIdx) => {
    const passengers = data.passengers || data.lines || [];
    const passCount = Number(data._count?.passengers ?? passengers.length);
    const firstPassenger = passengers[0]?.name || passengers[0]?.passenger || '—';

    const totalBuy = data.totals?.totalBuy || passengers.reduce((s: number, p: any) => s + (p.fareBuy || 0) + (p.tax1 || 0) + (p.tax2 || 0) + (p.charge || 0), 0);
    const totalSell = data.totals?.totalSell || passengers.reduce((s: number, p: any) => s + (p.fareSell || 0) + (p.tax1 || 0) + (p.tax2 || 0) + (p.charge || 0), 0);
    const profit = data.totals?.profit ?? (totalSell - totalBuy);

    const supplierName = getCleanSupplierName(data, supps, accs);
    const isUuidAirline = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(data.airline || '') || (data.airline || '').includes('0a5e') || (data.airline || '').includes('oa5e');

    let airlineName = data.airlineRef?.nameAr || data.airlineRef?.nameEn || data.airline;
    if (isUuidAirline) {
      const found = airlines.find((a) => a.id === data.airline || a.code === data.airline);
      airlineName = data.airlineRef?.nameAr || data.airlineRef?.nameEn || found?.nameAr || 'غير محدد';
    }

    // Resolve Customer Name if stored as UUID or code
    const rawCustomer = data.customer?.nameAr || data.customer?.nameEn || data.customerName || '';
    let customerName = rawCustomer;
    if (rawCustomer) {
      const foundCust = custs.find((c: any) => c.id === rawCustomer || c.code === rawCustomer || c.nameAr === rawCustomer || c.nameEn === rawCustomer);
      if (foundCust) {
        customerName = foundCust.nameAr || foundCust.nameEn || foundCust.code || rawCustomer;
      }
    }
    if (!customerName) customerName = 'غير محدد';

    const employeeName = resolveEmployeeName(data.employeeName || data.issuerName || data.createdByName);

    let routeDisplay = data.fullRouteText || data.route || '';
    if (!routeDisplay || routeDisplay === '—') {
      const from = data.fromAirport || data.origin || '';
      const to = data.toAirport || data.destination || '';
      routeDisplay = from && to ? `${from} → ${to}` : '—';
    }

    // Match Refunds targeting this ticket or its passengers
    const ticketInvoiceNum = data.invoiceNumber || data.number;
    const ticketPnr = (data.pnr || '').trim().toUpperCase();

    const matchedRefunds = refundTickets.filter((r: any) => {
      const refNum = (r.reference || '').trim();
      const rPnr = (r.pnr || '').trim().toUpperCase();
      if (refNum && (refNum === ticketInvoiceNum || refNum === data.id)) return true;
      if (rPnr && ticketPnr && rPnr !== '—' && rPnr === ticketPnr) return true;
      return false;
    });

    const refundedTicketNumbers = new Set<string>();
    const refundedPassengerNames = new Set<string>();
    matchedRefunds.forEach((r: any) => {
      (r.passengers || []).forEach((p: any) => {
        if (p.ticketNumber) refundedTicketNumbers.add(p.ticketNumber.trim().toUpperCase());
        if (p.name) refundedPassengerNames.add(p.name.trim().toUpperCase());
      });
    });

    const detailedPassengers = passengers.map((p: any) => {
      const cleanName = (p.name || p.passenger || '')
        .replace(/\b(ADULT\s*P|ADULT|ADT|CHILD\s*P|CHILD|CHD|INFANT|INF|MR|MRS|MS|MSTR)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      const displayName = cleanName || p.name || p.passenger || 'مسافر';
      const pTicketNum = String(p.ticketNumber || '').trim();
      const pName = displayName.trim().toUpperCase();
      const ticketDigits = pTicketNum.replace(/\D/g, '');
      const displayTicket =
        ticketDigits.length === 13 ? `${ticketDigits.slice(0, 3)}-${ticketDigits.slice(3)}` : pTicketNum;

      const isRefunded =
        (pTicketNum && refundedTicketNumbers.has(pTicketNum.toUpperCase())) ||
        (ticketDigits && refundedTicketNumbers.has(ticketDigits)) ||
        (pName && refundedPassengerNames.has(pName)) ||
        p.status === 'مسترجع' ||
        p.status === 'REFUNDED' ||
        (matchedRefunds.length > 0 && passCount === 1);

      return {
        ...p,
        displayName,
        ticketNumber: displayTicket,
        ticketType: p.ticketType || p.type || 'ADULT',
        isRefunded: Boolean(isRefunded),
      };
    });

    const refundedCount = detailedPassengers.filter((p: any) => p.isRefunded).length;
    let refundStatus: 'NONE' | 'PARTIAL' | 'FULL' = 'NONE';
    if (refundedCount > 0) {
      refundStatus = refundedCount >= passCount ? 'FULL' : 'PARTIAL';
    }

    const resolvedDate = formatDateShort(data.issueDate || data.date || data.createdAt || data.travelDate);

    return {
      id: data.id || `TK-AUTO-${invoiceIdx}`,
      number: data.invoiceNumber || data.number || '—',
      pnr: data.pnr || '—',
      date: resolvedDate,
      issueDate: resolvedDate,
      createdAt: data.createdAt,
      travelDate: formatDateShort(data.travelDate),
      airline: airlineName || '—',
      rawAirlineId: data.airline,
      route: routeDisplay,
      customer: customerName,
      supplier: supplierName,
      supplierAccount: data.supplierAccount || data.supplierId,
      passengersCount: passCount,
      firstPassenger: firstPassenger,
      allPassengerNames: passengers.map((p: any) => p.name || p.passenger).filter(Boolean),
      detailedPassengers,
      refundStatus,
      refundedCount,
      rawPaymentMethod: data.paymentMethod,
      rawPaymentType: data.paymentType,
      transferImage: data.transferImage || data.receiptImage || data.paymentProof,
      totalBuy: totalBuy,
      totalSell: totalSell,
      profit: profit,
      currency: (data.currency || 'IQD').toUpperCase(),
      employeeName: employeeName,
      isAudited: Boolean(data.isAudited),
      status: data.status || 'POSTED',
      rawInvoice: data,
    };
  });
};

export const TicketsPage: React.FC = () => {
  const { t, language, direction } = useLanguageStore();

  // Modals State
  const [modalOpen, setModalOpen] = useState(false);
  const [groupFareWorkspaceOpen, setGroupFareWorkspaceOpen] = useState(false);
  const [groupFareEditingTicket, setGroupFareEditingTicket] = useState<any>(null);
  // زر «كروب فير» يفتح النافذة الواحدة لملف الكروب الجديد؛ محرّر الكروب فير القديم يبقى لتعديل فواتيره القائمة.
  const [groupFileOpen, setGroupFileOpen] = useState(false);
  const [smartImportModalOpen, setSmartImportModalOpen] = useState(false);
  const [selectedTicketFile, setSelectedTicketFile] = useState<File | null>(null);
  const [editingTicketData, setEditingTicketData] = useState<any>(null);
  const [auditLogOpen, setAuditLogOpen] = useState(false);
  const [selectedTicketForAudit, setSelectedTicketForAudit] = useState<any>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [selectedReceiptTicket, setSelectedReceiptTicket] = useState<any>(null);
  const [copiedTicketId, setCopiedTicketId] = useState<string | null>(null);
  const lottieRef = useRef<any>(null);
  const ticketFileInputRef = useRef<HTMLInputElement | null>(null);

  // Handle direct file pick from file explorer dialog
  const handleTicketFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedTicketFile(file);
      setSmartImportModalOpen(true);
    }
    e.target.value = '';
  };

  // Global Ctrl+V Screenshot Paste on Tickets Page
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.indexOf('image') !== -1 || item.type === 'application/pdf') {
          const blob = item.getAsFile();
          if (blob) {
            e.preventDefault();
            const pastedFile = new File([blob], `ticket-screenshot-${Date.now()}.${item.type.includes('png') ? 'png' : 'jpg'}`, {
              type: blob.type || 'image/jpeg',
            });
            setSelectedTicketFile(pastedFile);
            setSmartImportModalOpen(true);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, []);

  // Handle Smart AI Ticket Import to prepare and open in TicketInvoiceEditorWorkspace
  const handleSmartImport = useCallback((parsed: ParsedTicketData) => {
    const formattedData = {
      pnr: parsed.pnr || '',
      airline: parsed.airline || '',
      customerName: '',
      customer: '',
      supplierAccount: '',
      supplierAccountName: '',
      supplierId: '',
      route: parsed.routeFrom && parsed.routeTo
        ? (parsed.tripType === 'ROUND_TRIP' ? `${parsed.routeFrom} - ${parsed.routeTo} - ${parsed.routeFrom}` : `${parsed.routeFrom} - ${parsed.routeTo}`)
        : '',
      travelDate: parsed.travelDate || new Date().toISOString(),
      issueDate: parsed.issueDate || new Date().toISOString(),
      flightNumber: parsed.flightNumber || '',
      currency: parsed.currency || 'IQD',
      notes: [
        parsed.flightNumber ? `Flight: ${parsed.flightNumber}` : '',
        parsed.travelClass ? `Class: ${parsed.travelClass}` : '',
        parsed.baggage ? `Baggage: ${parsed.baggage}` : '',
        parsed.bookingRef ? `Ref: ${parsed.bookingRef}` : '',
      ].filter(Boolean).join(' | '),
      passengers: (parsed.passengers || []).map((p, idx) => ({
        id: `p-ai-${Date.now()}-${idx}`,
        name: p.name || '',
        ticketType: p.ticketType || 'ADULT',
        ticketNumber: p.ticketNumber || '',
        documentNumber: p.documentNumber || '',
        pnr: parsed.pnr || '',
        fareBuy: p.fareBuy || null,
        fareSell: p.fareSell || null,
        tax1: p.tax1 || 0,
        tax2: p.tax2 || 0,
        charge: p.charge || 0,
      })),
    };
    setEditingTicketData(formattedData);
    setModalOpen(true);
  }, []);

  // Helper to check whether a ticket record belongs to Group Fare
  const isGroupFareTicket = useCallback((ticketRowOrRaw: any): boolean => {
    if (!ticketRowOrRaw) return false;
    const raw = ticketRowOrRaw.rawInvoice || ticketRowOrRaw;
    const invNum = String(raw.invoiceNumber || raw.number || ticketRowOrRaw.invoiceNumber || ticketRowOrRaw.number || '').toUpperCase();
    const tripType = String(raw.tripType || ticketRowOrRaw.tripType || '').toUpperCase();
    const ticketType = String(raw.ticketType || ticketRowOrRaw.ticketType || '').toUpperCase();

    return (
      tripType === 'GROUP_FARE' ||
      tripType.includes('GROUP') ||
      ticketType === 'GROUP_FARE' ||
      invNum.includes('-GRP-') ||
      invNum.startsWith('GRP-')
    );
  }, []);

  // Smart editor opener: opens GroupFareEditorWorkspace for group fare invoices, and TicketInvoiceEditorWorkspace for normal tickets
  const handleOpenTicketEditor = useCallback((ticketRowOrRaw: any) => {
    const raw = ticketRowOrRaw?.rawInvoice || ticketRowOrRaw;
    if (!raw) return;
    if (isGroupFareTicket(ticketRowOrRaw)) {
      setGroupFareEditingTicket(raw);
      setGroupFareWorkspaceOpen(true);
    } else {
      setEditingTicketData(raw);
      setModalOpen(true);
    }
  }, [isGroupFareTicket]);

  // Context Menu & Deletion States
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; ticket: any } | null>(null);
  const [refundWorkspaceOpen, setRefundWorkspaceOpen] = useState(false);
  const [ticketForRefund, setTicketForRefund] = useState<any>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [ticketToDelete, setTicketToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const openTicket = editingTicketData || selectedReceiptTicket || contextMenu?.ticket || ticketForRefund;
  useAiPageContext({
    route: '/tickets',
    entity: openTicket ? 'ticket' : undefined,
    recordId: openTicket?.id,
    label: openTicket?.invoiceNumber || openTicket?.pnr || openTicket?.number,
  });

  // Close context menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    if (contextMenu) {
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [contextMenu]);

  // Handle right click on ticket row
  const handleRowContextMenu = (e: React.MouseEvent, tRow: any) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 220;
    const menuHeight = 250;
    const x = e.clientX + menuWidth > window.innerWidth ? window.innerWidth - menuWidth - 10 : e.clientX;
    const y = e.clientY + menuHeight > window.innerHeight ? window.innerHeight - menuHeight - 10 : e.clientY;
    setContextMenu({ x, y, ticket: tRow });
  };

  // Handle Delete Ticket
  const handleDeleteTicket = async () => {
    if (!ticketToDelete) return;
    try {
      setIsDeleting(true);
      const ticketId = ticketToDelete.id || ticketToDelete.rawInvoice?.id || ticketToDelete.number;
      archiveTicket(ticketToDelete.rawInvoice || ticketToDelete);
      await ticketsApi.delete(ticketId);

      setTickets((prev) => prev.filter((t) => (t.id || t.number) !== (ticketToDelete.id || ticketToDelete.number)));
      if (globalTicketsMemoryCache) {
        globalTicketsMemoryCache = globalTicketsMemoryCache.filter(
          (t: any) => (t.id || t.invoiceNumber || t.number) !== (ticketToDelete.id || ticketToDelete.number)
        );
      }

      showSuccessNotification(
        language === 'ar' ? 'تم حذف التذكرة بنجاح' : 'Ticket deleted successfully',
        `${ticketToDelete.number || ticketToDelete.pnr}`
      );
      setDeleteModalOpen(false);
      setTicketToDelete(null);
      reloadTicketsFromApi(false);
    } catch (err: any) {
      showErrorNotification(
        language === 'ar' ? 'فشل حذف التذكرة' : 'Failed to delete ticket',
        err?.message || ''
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // Reuse only in-memory data while navigating inside the SPA. A browser reload
  // waits for the authoritative response instead of presenting persisted totals.
  const initialTickets = useMemo(() => {
    if (globalTicketsMemoryCache && globalTicketsMemoryCache.length > 0) {
      return globalTicketsMemoryCache;
    }
    return [];
  }, []);

  // Data Sources State
  const [dbAirlines, setDbAirlines] = useState<AirlineItem[]>(() => {
    if (globalAirlinesMemoryCache && globalAirlinesMemoryCache.length > 0) return globalAirlinesMemoryCache;
    try {
      const s = localStorage.getItem('cached_airlines_v2');
      if (s) {
        const p = JSON.parse(s);
        if (Array.isArray(p)) {
          globalAirlinesMemoryCache = p;
          return p;
        }
      }
    } catch (e) {}
    return [];
  });

  const [tickets, setTickets] = useState<any[]>(initialTickets);
  const [ticketsLoading, setTicketsLoading] = useState<boolean>(() => !(globalTicketsMemoryCache && globalTicketsMemoryCache.length > 0));

  // Filter States
  // View Mode: Summary (Aggregated Invoices) vs Detailed (Passenger-level)
  const [viewMode, setViewMode] = useState<'aggregated' | 'detailed'>('aggregated');
  const [searchQuery, setSearchQuery] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState<string>('ALL'); // ALL, IQD, USD
  const [statusFilter, setStatusFilter] = useState<string>('ALL'); // ALL, DRAFT, POSTED, AUDITED, CANCELLED
  const [auditFilter, setAuditFilter] = useState<'ALL' | 'AUDITED' | 'UNAUDITED'>('ALL');
  const [dateFrom, setDateFrom] = useState<Date | null>(() => {
    const start = new Date();
    start.setDate(start.getDate() - 14);
    start.setHours(0, 0, 0, 0);
    return start;
  });
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [airlineFilter, setAirlineFilter] = useState<string>('');
  const [supplierFilter, setSupplierFilter] = useState<string>('');
  const [customerFilter, setCustomerFilter] = useState<string>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Permissions
  const user = useAuthStore((s) => s.user);

  const hasPermission = useCallback(
    (code: string) => {
      if (!user) return false;
      if (user.permissions?.includes('*')) return true;
      return user.permissions?.includes(code) ?? false;
    },
    [user],
  );

  const canEdit = useMemo(() => hasPermission('tickets.update'), [hasPermission]);
  const canAudit = useMemo(() => hasPermission('tickets.audit'), [hasPermission]);
  const canViewProfits = useMemo(() => hasPermission('reports.view_profits') || hasPermission('tickets.view_profit') || true, [hasPermission]);

  // Load the authoritative ticket list first; reference data is non-blocking.
  const isFetchingRef = React.useRef(false);

  const dateFromKey = dateFrom
    ? `${dateFrom.getFullYear()}-${dateFrom.getMonth()}-${dateFrom.getDate()}`
    : '';
  const dateToKey = dateTo
    ? `${dateTo.getFullYear()}-${dateTo.getMonth()}-${dateTo.getDate()}`
    : '';

  const reloadTicketsFromApi = useCallback(async (clearExisting = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    const hasRows = Boolean(globalTicketsMemoryCache && globalTicketsMemoryCache.length > 0);
    if (!hasRows) setTicketsLoading(true);

    try {
      const ticketData = await ticketsApi.getFlights({
        limit: 25,
        dateFrom: dateFrom
          ? new Date(dateFrom.getFullYear(), dateFrom.getMonth(), dateFrom.getDate()).toISOString()
          : undefined,
      });
      const dbTickets = Array.isArray(ticketData) ? ticketData : [];

      const mapped = mapInvoicesToMasterRows(
        dbTickets.map(convertDbTicketToLocal),
        globalAirlinesMemoryCache || [],
        [],
        [],
        [],
        [],
      );
      globalTicketsMemoryCache = mapped;
      setTickets(mapped);

      // Airline logos and filter options are useful but must not delay financial data.
      if (!globalAirlinesMemoryCache) {
        void airlinesApi.getAll()
          .then((airData) => {
            const airlines = Array.isArray(airData) ? airData : [];
            globalAirlinesMemoryCache = airlines;
            setDbAirlines(airlines);
            try {
              localStorage.setItem('cached_airlines_v2', JSON.stringify(airlines));
            } catch (e) {}
          })
          .catch(() => {});
      }
    } catch (err: any) {
      showErrorNotification(language === 'ar' ? 'خطأ في جلب البيانات' : 'Error fetching data', err?.message || 'Failed to update tickets list');
    } finally {
      isFetchingRef.current = false;
      setTicketsLoading(false);
    }
  }, [language, dateFromKey, dateToKey]);

  useEffect(() => {
    reloadTicketsFromApi(false);

    const handleBranchChange = () => {
      reloadTicketsFromApi(true);
    };

    window.addEventListener('active-branch-changed', handleBranchChange);
    return () => {
      window.removeEventListener('active-branch-changed', handleBranchChange);
    };
  }, [reloadTicketsFromApi]);

  // Copy PNR helper
  const handleCopyPnr = (pnrCode?: string) => {
    if (!pnrCode || pnrCode === '—') {
      showInfoNotification(
        language === 'ar' ? 'لا يوجد PNR' : 'No PNR',
        language === 'ar' ? 'لا يوجد كود PNR مسجل لهذه التذكرة' : 'No PNR code for this ticket',
      );
      return;
    }
    navigator.clipboard.writeText(pnrCode);
    setCopiedTicketId(pnrCode);
    setTimeout(() => setCopiedTicketId(null), 2000);
    showInfoNotification(
      language === 'ar' ? 'تم النسخ' : 'Copied',
      language === 'ar' ? `تم نسخ كود PNR (${pnrCode}) إلى الحافظة` : `PNR (${pnrCode}) copied to clipboard`,
    );
  };

  // Copy Invoice Number helper
  const handleCopyInvoiceNumber = (num: string) => {
    navigator.clipboard.writeText(num);
    setCopiedTicketId(num);
    setTimeout(() => setCopiedTicketId(null), 2000);
    showInfoNotification(
      language === 'ar' ? 'تم النسخ' : 'Copied',
      language === 'ar' ? `تم نسخ رقم الفاتورة (${num}) إلى الحافظة` : `Invoice # (${num}) copied to clipboard`,
    );
  };

  // Toggle single ticket audit status (BadgeCheck / ShieldAlert)
  const toggleTicketAudit = async (invoiceId: string, audited: boolean) => {
    if (!canAudit) {
      showErrorNotification(language === 'ar' ? 'لا تملك صلاحية!' : 'Permission Denied', language === 'ar' ? 'ليس لديك صلاحية تدقيق الفواتير.' : 'You do not have audit permissions.');
      return;
    }
    try {
      const ticket = tickets.find((t) => t.id === invoiceId || t.number === invoiceId);
      const dbId = ticket?.rawInvoice?.id || ticket?.id;
      const invoiceDisplayNum = ticket?.number || ticket?.invoiceNumber || invoiceId;
      if (!dbId) return;

      setTickets((prev) =>
        prev.map((t) => ((t.id === invoiceId || t.number === invoiceId) ? { ...t, isAudited: audited } : t)),
      );

      await ticketsApi.toggleAudit(dbId);

      showSuccessNotification(
        language === 'ar' ? 'التدقيق المالي' : 'Financial Audit',
        audited
          ? (language === 'ar' ? `تم تدقيق واعتماد الفاتورة (${invoiceDisplayNum}) بنجاح.` : `Invoice (${invoiceDisplayNum}) successfully audited and approved.`)
          : (language === 'ar' ? `تمت إعادة الفاتورة (${invoiceDisplayNum}) إلى حالة غير مدققة.` : `Invoice (${invoiceDisplayNum}) marked as unaudited.`),
      );
    } catch (e: any) {
      setTickets((prev) =>
        prev.map((t) => ((t.id === invoiceId || t.number === invoiceId) ? { ...t, isAudited: !audited } : t)),
      );
      showErrorNotification(language === 'ar' ? 'خطأ' : 'Error', e.message || 'Failed to toggle audit status');
    }
  };

  // Find Airline Object for logos
  const findAirlineObj = useCallback(
    (airlineNameOrId?: string): AirlineItem | null => {
      if (!airlineNameOrId || airlineNameOrId === '—') return null;
      const cleanStr = (s?: string) => (s || '').trim().toLowerCase().replace(/\s+/g, '');
      const targetStr = cleanStr(airlineNameOrId);
      const upperCode = (airlineNameOrId || '').trim().toUpperCase();

      return (
        dbAirlines.find((a) => {
          if (!a) return false;
          if (a.id === airlineNameOrId) return true;
          if (a.nameAr && cleanStr(a.nameAr) === targetStr) return true;
          if (a.code && a.code.toUpperCase() === upperCode) return true;
          if (a.nameEn && cleanStr(a.nameEn) === targetStr) return true;
          if (a.nameAr && targetStr && (targetStr.includes(cleanStr(a.nameAr)) || cleanStr(a.nameAr).includes(targetStr))) return true;
          return false;
        }) || null
      );
    },
    [dbAirlines],
  );

  // Shorten route helper
  const formatShortRoute = (route: string) => {
    if (!route || route === '—') return '—';
    const parts = route.split('→').map((part) => {
      const iataMatch = part.match(/\b([A-Z]{3})\b/);
      if (iataMatch) return iataMatch[1];
      const cleaned = part.replace(/\(.*?\)/g, '').trim();
      const firstWord = cleaned.split(/[\s-]/)[0];
      return firstWord ? firstWord.substring(0, 10) : part.trim();
    });
    if (parts.length >= 2) {
      return parts.join(' ✈ ');
    }
    return route.length > 22 ? route.substring(0, 20) + '...' : route;
  };

  // ─── Filtered Tickets Logic ───
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      // 1. Currency Filter
      const curr = (t.currency || 'IQD').toUpperCase();
      const isIQD = curr.includes('IQD') || curr.includes('د.ع');
      const isUSD = curr.includes('USD') || curr.includes('$');

      if (currencyFilter === 'IQD' && !isIQD) return false;
      if (currencyFilter === 'USD' && !isUSD) return false;

      // 2. Audit Status Filter
      if (auditFilter === 'AUDITED' && !t.isAudited) return false;
      if (auditFilter === 'UNAUDITED' && t.isAudited) return false;

      // 3. Invoice Status Filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'AUDITED' && !t.isAudited) return false;
        if (statusFilter !== 'AUDITED' && t.status !== statusFilter) return false;
      }

      // 4. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const numMatch = (t.number || '').toLowerCase().includes(q);
        const pnrMatch = (t.pnr || '').toLowerCase().includes(q);
        const custMatch = (t.customer || '').toLowerCase().includes(q);
        const suppMatch = (t.supplier || '').toLowerCase().includes(q);
        const airMatch = (t.airline || '').toLowerCase().includes(q);
        const empMatch = (t.employeeName || '').toLowerCase().includes(q);
        const passMatch = (t.allPassengerNames || []).some((name: string) => name.toLowerCase().includes(q));

        if (!numMatch && !pnrMatch && !custMatch && !suppMatch && !airMatch && !empMatch && !passMatch) {
          return false;
        }
      }

      // 5. Date Range Filter
      if (dateFrom && t.date) {
        const start = new Date(dateFrom.getFullYear(), dateFrom.getMonth(), dateFrom.getDate());
        const tDate = new Date(t.date);
        if (!isNaN(tDate.getTime()) && tDate < start) {
          return false;
        }
      }
      if (dateTo && t.date) {
        const end = new Date(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate(), 23, 59, 59, 999);
        const tDate = new Date(t.date);
        if (!isNaN(tDate.getTime()) && tDate > end) {
          return false;
        }
      }

      // 6. Airline Filter
      if (airlineFilter && t.airline !== airlineFilter && t.rawAirlineId !== airlineFilter) {
        return false;
      }

      // 7. Supplier Filter
      if (supplierFilter && t.supplier !== supplierFilter && t.supplierAccount !== supplierFilter) {
        return false;
      }

      // 8. Customer Filter
      if (customerFilter && t.customer !== customerFilter) {
        return false;
      }

      return true;
    });
  }, [
    tickets,
    currencyFilter,
    auditFilter,
    statusFilter,
    searchQuery,
    dateFrom,
    dateTo,
    airlineFilter,
    supplierFilter,
    customerFilter,
  ]);

  // ─── Analytical KPI Metrics (Strict Separation by Currency) ───
  const kpis = useMemo(() => {
    let totalSellIQD = 0;
    let totalSellUSD = 0;
    let totalBuyIQD = 0;
    let totalBuyUSD = 0;
    let totalProfitIQD = 0;
    let totalProfitUSD = 0;
    let auditedCount = 0;
    let pendingAuditCount = 0;
    let unauditedCount = 0;
    let totalPassengers = 0;

    filteredTickets.forEach((t) => {
      const isUSD = (t.currency || '').toUpperCase().includes('USD') || (t.currency || '').includes('$');
      const sell = Number(t.totalSell || 0);
      const buy = Number(t.totalBuy || 0);
      const profit = Number(t.profit ?? (sell - buy));
      const passengers = Number(t.passengersCount || 1);

      totalPassengers += passengers;
      if (t.isAudited) {
        auditedCount++;
      } else {
        unauditedCount++;
      }

      if (isUSD) {
        totalSellUSD += sell;
        totalBuyUSD += buy;
        totalProfitUSD += profit;
      } else {
        totalSellIQD += sell;
        totalBuyIQD += buy;
        totalProfitIQD += profit;
      }
    });

    return {
      totalSellIQD,
      totalSellUSD,
      totalBuyIQD,
      totalBuyUSD,
      totalProfitIQD,
      totalProfitUSD,
      auditedCount,
      pendingAuditCount,
      unauditedCount,
      totalTickets: filteredTickets.length,
      totalPassengers,
    };
  }, [filteredTickets]);

  // Detailed Passenger-Level Flattened Items
  const detailedTicketItems = useMemo(() => {
    const list: any[] = [];
    filteredTickets.forEach((tRow: any) => {
      const raw = tRow.rawInvoice || tRow;
      const passengersList =
        Array.isArray(tRow.detailedPassengers) && tRow.detailedPassengers.length > 0
          ? tRow.detailedPassengers
          : raw.passengers && Array.isArray(raw.passengers) && raw.passengers.length > 0
          ? raw.passengers
          : [
              {
                id: `p-${tRow.id}-0`,
                name: raw.passengerName || tRow.passengerName || '—',
                ticketType: 'ADULT',
                ticketNumber: raw.ticketNumber || tRow.ticketNumber || '',
                fareBuy: raw.fareBuy ?? tRow.totalBuy ?? 0,
                fareSell: raw.fareSell ?? tRow.totalSell ?? 0,
              },
            ];

      passengersList.forEach((p: any, pIdx: number) => {
        const passBuy = p.fareBuy !== null && p.fareBuy !== undefined ? Number(p.fareBuy) : (Number(tRow.totalBuy || 0) / (passengersList.length || 1));
        const passSell = p.fareSell !== null && p.fareSell !== undefined ? Number(p.fareSell) : (Number(tRow.totalSell || 0) / (passengersList.length || 1));
        const passProfit = passSell - passBuy;
        const passName = p.name || raw.passengerName || tRow.passengerName || '—';
        const passDoc = p.ticketNumber || tRow.ticketNumber || '—';
        const passType = p.ticketType || 'ADULT';

        list.push({
          rowId: `${tRow.id}-${p.id || pIdx}`,
          ticketId: tRow.id,
          passengerIndex: pIdx + 1,
          passengersCount: passengersList.length,
          passengerName: passName,
          ticketNumber: passDoc,
          ticketType: passType,
          fareBuy: passBuy,
          fareSell: passSell,
          profit: passProfit,
          invoiceNumber: tRow.number || raw.invoiceNumber || '—',
          pnr: p.pnr || raw.pnr || tRow.pnr || '—',
          airline: tRow.airline || raw.airline || '—',
          airlineLogo: tRow.airlineLogo || raw.airlineLogo,
          rawAirlineId: tRow.rawAirlineId || raw.airlineId,
          supplier: tRow.supplier || raw.supplierAccountName || raw.supplierName || '—',
          customer: tRow.customer || raw.customerName || '—',
          currency: tRow.currency || raw.currency || 'IQD',
          paymentType: tRow.paymentType || raw.paymentType || 'نقدي',
          rawPaymentMethod: tRow.rawPaymentMethod || raw.paymentMethod,
          rawPaymentType: tRow.rawPaymentType || raw.paymentType,
          issueDate: tRow.issueDate || tRow.date || formatDateShort(raw.issueDate || raw.date || raw.createdAt),
          date: tRow.date || tRow.issueDate || formatDateShort(raw.date || raw.issueDate || raw.createdAt),
          employeeName: tRow.employeeName || raw.employeeName || '—',
          isAudited: tRow.isAudited ?? raw.isAudited,
          status: tRow.status || raw.status,
          rawInvoice: raw,
        });
      });
    });
    return list;
  }, [filteredTickets]);

  // Pagination Slice based on viewMode
  const currentTotalItems = viewMode === 'aggregated' ? filteredTickets.length : detailedTicketItems.length;
  const totalPages = Math.ceil(currentTotalItems / pageSize) || 1;

  const paginatedTickets = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTickets.slice(start, start + pageSize);
  }, [filteredTickets, currentPage, pageSize]);

  const paginatedDetailedTickets = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return detailedTicketItems.slice(start, start + pageSize);
  }, [detailedTicketItems, currentPage, pageSize]);

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (currencyFilter !== 'ALL') count++;
    if (auditFilter !== 'ALL') count++;
    if (statusFilter !== 'ALL') count++;
    if (searchQuery.trim()) count++;
    if (dateFrom) count++;
    if (dateTo) count++;
    if (airlineFilter) count++;
    if (supplierFilter) count++;
    if (customerFilter) count++;
    return count;
  }, [
    currencyFilter,
    auditFilter,
    statusFilter,
    searchQuery,
    dateFrom,
    dateTo,
    airlineFilter,
    supplierFilter,
    customerFilter,
  ]);

  const clearAllFilters = () => {
    setSearchQuery('');
    setCurrencyFilter('ALL');
    setAuditFilter('ALL');
    setStatusFilter('ALL');
    setDateFrom(new Date(new Date().getFullYear(), 0, 1));
    setDateTo(new Date());
    setAirlineFilter('');
    setSupplierFilter('');
    setCustomerFilter('');
    setCurrentPage(1);
  };

  const handleTicketSaved = () => {
    reloadTicketsFromApi();
    setModalOpen(false);
    setEditingTicketData(null);
  };

  // Formatted Combobox Options for Advanced Filters
  const airlineOptions: ComboboxOption[] = useMemo(() => {
    return dbAirlines.map((a) => ({
      value: a.nameAr || a.nameEn || a.code || a.id || '',
      label: a.nameAr || a.nameEn || a.code || a.id || '',
      code: a.code,
      nameAr: a.nameAr,
      logo: a.logo,
    }));
  }, [dbAirlines]);

  return (
    <div
      className={`w-full max-w-[1760px] mx-auto px-3 sm:px-6 py-3 sm:py-5 select-none font-sans space-y-3 sm:space-y-4 bg-[#F7F8FA] min-h-screen text-${direction === 'rtl' ? 'right' : 'left'}`}
      dir={direction}
      style={{ fontFamily: language === 'ar' ? "'IBM Plex Sans Arabic', system-ui, sans-serif" : "'IBM Plex Sans', system-ui, sans-serif" }}
    >
      {/* ── 1. KPI CARDS + LOTTIE ANIMATION (Responsive compact flex/grid) ── */}
      <div className="flex flex-col xl:flex-row gap-2 sm:gap-2.5 items-stretch">
        {/* KPI Cards */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-2.5">
          {/* Card 1: Total Sales */}
          <div className="bg-white border border-[#E5E7EB] rounded-[12px] px-3.5 py-2 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[11.5px] font-bold text-slate-800">{t('tickets.totalSales')}</span>
              <div className="w-[26px] h-[26px] rounded-[7px] bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center shrink-0">
                <Banknote size={14} strokeWidth={1.85} />
              </div>
            </div>
            <div>
              {ticketsLoading ? (
                <div className="grid grid-cols-2 gap-2 animate-pulse">
                  <div className="space-y-1">
                    <div className="h-2 w-10 bg-slate-200/70 rounded" />
                    <div className="h-3.5 w-16 bg-slate-200/70 rounded" />
                  </div>
                  <div className="space-y-1">
                    <div className="h-2 w-10 bg-slate-200/70 rounded" />
                    <div className="h-3.5 w-20 bg-slate-200/70 rounded" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 items-baseline">
                  <div className="flex items-baseline gap-1" dir="ltr">
                    <span className="text-[14px] sm:text-[15px] font-black font-mono text-[#111827] tabular-nums leading-tight">
                      ${kpis.totalSellUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1" dir="ltr">
                    <span className="text-[13px] sm:text-[14px] font-black font-mono text-[#111827] tabular-nums leading-tight">
                      {kpis.totalSellIQD.toLocaleString()}
                    </span>
                    <span className="text-[9.5px] font-mono font-bold text-slate-400">{language === 'ar' ? 'د.ع' : 'IQD'}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Total Buy Cost */}
          <div className="bg-white border border-[#E5E7EB] rounded-[12px] px-3.5 py-2 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[11.5px] font-bold text-slate-800">{t('tickets.totalCost')}</span>
              <div className="w-[26px] h-[26px] rounded-[7px] bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center shrink-0">
                <ReceiptText size={14} strokeWidth={1.85} />
              </div>
            </div>
            <div>
              {ticketsLoading ? (
                <div className="grid grid-cols-2 gap-2 animate-pulse">
                  <div className="space-y-1">
                    <div className="h-2 w-10 bg-slate-200/70 rounded" />
                    <div className="h-3.5 w-16 bg-slate-200/70 rounded" />
                  </div>
                  <div className="space-y-1">
                    <div className="h-2 w-10 bg-slate-200/70 rounded" />
                    <div className="h-3.5 w-20 bg-slate-200/70 rounded" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 items-baseline">
                  <div className="flex items-baseline gap-1" dir="ltr">
                    <span className="text-[14px] sm:text-[15px] font-black font-mono text-[#111827] tabular-nums leading-tight">
                      ${kpis.totalBuyUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1" dir="ltr">
                    <span className="text-[13px] sm:text-[14px] font-black font-mono text-[#111827] tabular-nums leading-tight">
                      {kpis.totalBuyIQD.toLocaleString()}
                    </span>
                    <span className="text-[9.5px] font-mono font-bold text-slate-400">{language === 'ar' ? 'د.ع' : 'IQD'}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Net Profit */}
          <div className="bg-white border border-[#E5E7EB] rounded-[12px] px-3.5 py-2 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-all sm:col-span-2 md:col-span-1">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[11.5px] font-bold text-slate-800">{t('tickets.netProfit')}</span>
              <div className="w-[26px] h-[26px] rounded-[7px] bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center shrink-0">
                <TrendingUp size={14} strokeWidth={1.85} />
              </div>
            </div>
            <div>
              {ticketsLoading ? (
                <div className="grid grid-cols-2 gap-2 animate-pulse">
                  <div className="space-y-1">
                    <div className="h-2 w-10 bg-slate-200/70 rounded" />
                    <div className="h-3.5 w-16 bg-slate-200/70 rounded" />
                  </div>
                  <div className="space-y-1">
                    <div className="h-2 w-10 bg-slate-200/70 rounded" />
                    <div className="h-3.5 w-20 bg-slate-200/70 rounded" />
                  </div>
                </div>
              ) : canViewProfits ? (
                <div className="grid grid-cols-2 gap-2 items-baseline">
                  <div className="flex items-baseline gap-1" dir="ltr">
                    <span className={`text-[14px] sm:text-[15px] font-black font-mono tabular-nums leading-tight ${kpis.totalProfitUSD > 0 ? 'text-[#078B61]' : kpis.totalProfitUSD < 0 ? 'text-[#DC2626]' : 'text-slate-800'}`}>
                      {kpis.totalProfitUSD > 0 ? `+$${kpis.totalProfitUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : kpis.totalProfitUSD < 0 ? `-$${Math.abs(kpis.totalProfitUSD).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : `$0.00`}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1" dir="ltr">
                    <span className={`text-[13px] sm:text-[14px] font-black font-mono tabular-nums leading-tight ${kpis.totalProfitIQD > 0 ? 'text-[#078B61]' : kpis.totalProfitIQD < 0 ? 'text-[#DC2626]' : 'text-slate-800'}`}>
                      {kpis.totalProfitIQD > 0 ? `+${kpis.totalProfitIQD.toLocaleString()}` : kpis.totalProfitIQD < 0 ? `-${Math.abs(kpis.totalProfitIQD).toLocaleString()}` : `0`}
                    </span>
                    <span className="text-[9.5px] font-mono font-bold text-slate-400">{language === 'ar' ? 'د.ع' : 'IQD'}</span>
                  </div>
                </div>
              ) : (
                <span className="text-[12px] text-slate-400 font-mono">{t('tickets.unauthorized')}</span>
              )}
            </div>
          </div>
        </div>

        {/* Hidden File Input for Direct AI Ticket Upload */}
        <input
          type="file"
          ref={ticketFileInputRef}
          accept="application/pdf,image/*,.txt,.doc,.docx"
          onChange={handleTicketFileSelected}
          className="hidden"
        />

        {/* Lottie Animation — Compact (left side in RTL, click directly opens file chooser dialog) */}
        <div
          onClick={() => {
            ticketFileInputRef.current?.click();
          }}
          className="relative hidden xl:flex flex-col w-[110px] shrink-0 bg-white border border-[#E5E7EB] hover:border-[#F45A0A] rounded-[12px] shadow-2xs items-center justify-center overflow-hidden px-1.5 py-1 cursor-pointer group transition-all"
          onMouseEnter={() => lottieRef.current?.play()}
          onMouseLeave={() => {
            lottieRef.current?.stop();
          }}
          title={language === 'ar' ? '📸 انقر مباشرة لاختيار ملف التذكرة أو الصق لقطة الشاشة (Ctrl+V)' : '📸 Click directly to select ticket file or paste screenshot (Ctrl+V)'}
        >
          <div className="w-[36px] h-[36px] flex items-center justify-center -mt-1">
            <Lottie
              lottieRef={lottieRef}
              src={aiSpiderAnimation}
              loop={true}
              autoplay={false}
              className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-110"
            />
          </div>

          {/* Floating Action Badge */}
          <div className="w-full flex items-center justify-center gap-1 bg-white/95 group-hover:bg-[#FFF3E8] border border-slate-200 group-hover:border-[#F45A0A]/30 py-0.5 px-1 rounded-[6px] text-[9px] font-bold text-slate-700 group-hover:text-[#F45A0A] transition-all shadow-2xs backdrop-blur-xs mt-0.5">
            <Sparkles size={10} className="text-[#F45A0A] shrink-0" />
            <span className="truncate">{language === 'ar' ? 'تذكرة (AI)' : 'AI Ticket'}</span>
          </div>
        </div>
      </div>

      {/* ── 2. FILTERS BAR ── */}
      <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-2.5 sm:px-4 sm:py-3 shadow-2xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 sm:gap-3">
          {/* Right Group: Search + Dates */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap flex-1">
            {/* Search Input */}
            <div className="relative w-full sm:w-auto flex-1 min-w-[180px] sm:max-w-[280px]">
              <Search size={16} className={`absolute ${direction === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-400`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={t('filters.searchPlaceholder')}
                className={`w-full h-[38px] ${direction === 'rtl' ? 'pr-9 pl-3' : 'pl-9 pr-3'} rounded-[10px] bg-[#FAFAFA] border border-[#E5E7EB] text-[13px] text-[#111827] placeholder-[#9CA3AF] outline-none hover:bg-white hover:border-[#D1D5DB] focus:bg-white focus:border-2 focus:border-[#F45A0A] transition-colors`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className={`absolute ${direction === 'rtl' ? 'left-2.5' : 'right-2.5'} top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer`}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Date Pickers Container */}
            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
              {/* Date From */}
              <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
                <span className="text-[11px] font-bold text-slate-700 shrink-0 select-none bg-slate-100 px-2 py-1 rounded-md">{language === 'ar' ? 'من' : 'From'}</span>
                <div className="w-full sm:w-[170px] md:w-[190px]">
                  <SegmentedDatePicker
                    placeholder={language === 'ar' ? 'من تاريخ' : 'From Date'}
                    value={dateFrom}
                    onChange={(d) => {
                      setDateFrom(d);
                      setCurrentPage(1);
                    }}
                    clearable={true}
                  />
                </div>
              </div>

              {/* Date To */}
              <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
                <span className="text-[11px] font-bold text-slate-700 shrink-0 select-none bg-slate-100 px-2 py-1 rounded-md">{language === 'ar' ? 'إلى' : 'To'}</span>
                <div className="w-full sm:w-[170px] md:w-[190px]">
                  <SegmentedDatePicker
                    placeholder={language === 'ar' ? 'إلى تاريخ' : 'To Date'}
                    value={dateTo}
                    onChange={(d) => {
                      setDateTo(d);
                      setCurrentPage(1);
                    }}
                    clearable={true}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Left Group: Currency + Action Buttons */}
          <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap sm:flex-nowrap pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
            {/* Currency Switcher */}
            <div className="shrink-0">
              <CurrencySegmentedControl
                value={currencyFilter}
                onChange={(val) => {
                  setCurrencyFilter(val);
                  setCurrentPage(1);
                }}
                showAllOption={true}
                showLabel={false}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-1 sm:flex-initial">
              {/* Group Fare Button */}
              <button
                type="button"
                onClick={() => setGroupFileOpen(true)}
                className="flex-1 sm:flex-initial h-[38px] px-3.5 sm:px-4 rounded-[9px] bg-white border border-[#FED7AA] hover:bg-[#FFF3E8] text-[#F45A0A] font-bold text-[12.5px] sm:text-[13px] shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
              >
                <Layers size={16} strokeWidth={2.2} />
                <span>{language === 'ar' ? 'كروب فير' : 'Group Fare'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingTicketData(null);
                  setModalOpen(true);
                }}
                className="flex-1 sm:flex-initial h-[38px] px-3.5 sm:px-4 rounded-[9px] bg-[#F45A0A] hover:bg-[#DD4F05] active:scale-[0.98] text-white font-semibold text-[12.5px] sm:text-[13px] shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
              >
                <Plus size={15} strokeWidth={2.4} />
                <span>{t('tickets.newInvoice')}</span>
              </button>

              <button
                type="button"
                onClick={() => reloadTicketsFromApi(false)}
                disabled={ticketsLoading}
                className="h-[38px] px-2.5 sm:px-3 rounded-[9px] bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#334155] font-semibold text-[13px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                title={t('tickets.refresh')}
              >
                <RefreshCw size={14} className={ticketsLoading ? 'animate-spin text-[#F45A0A]' : 'text-[#64748B]'} />
                <span className="hidden sm:inline">{t('tickets.refresh')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. DATA TABLE / MOBILE CARDS CONTAINER ── */}
      <div className="bg-white rounded-[14px] border border-[#E5E7EB] shadow-2xs overflow-hidden">
        
        {/* DESKTOP / TABLET VIEW (TABLE) */}
        <div className="hidden md:block overflow-x-auto">
          <table className={`w-full text-${direction === 'rtl' ? 'right' : 'left'} border-collapse text-[13px]`}>
            {/* Table Sticky Header (48px) */}
            <thead>
              <tr className="h-[48px] bg-[#F8FAFC] border-b border-[#E5E7EB] text-[#475569] font-semibold text-[12.5px]">
                <th className="px-3.5 py-2 whitespace-nowrap text-center w-12">{t('table.index')}</th>
                {viewMode === 'aggregated' ? (
                  <>
                    <th className="px-3.5 py-2 whitespace-nowrap">{t('table.invoiceNumber')}</th>
                    <th className="px-3.5 py-2 whitespace-nowrap">{t('table.passengers')}</th>
                    <th className="px-3.5 py-2 whitespace-nowrap">{t('table.airlinePnr')}</th>
                    <th className="px-3.5 py-2 whitespace-nowrap">{t('table.supplier')}</th>
                    <th className="px-3.5 py-2 whitespace-nowrap">{t('table.buyTotal')}</th>
                    <th className="px-3.5 py-2 whitespace-nowrap">{t('table.customer')}</th>
                    <th className="px-3.5 py-2 whitespace-nowrap">{t('table.sellTotal')}</th>
                  </>
                ) : (
                  <>
                    <th className="px-3.5 py-2 whitespace-nowrap">{language === 'ar' ? 'رقم التذكرة الإلكترونية' : 'E-Ticket Number'}</th>
                    <th className="px-3.5 py-2 whitespace-nowrap">{language === 'ar' ? 'اسم المسافر والنوع' : 'Passenger & Type'}</th>
                    <th className="px-3.5 py-2 whitespace-nowrap">{language === 'ar' ? 'الفاتورة و PNR' : 'Invoice & PNR'}</th>
                    <th className="px-3.5 py-2 whitespace-nowrap">{language === 'ar' ? 'شركة الطيران' : 'Airline'}</th>
                    <th className="px-3.5 py-2 whitespace-nowrap">{t('table.supplier')}</th>
                    <th className="px-3.5 py-2 whitespace-nowrap">{language === 'ar' ? 'شراء الفرد' : 'Buy Fare'}</th>
                    <th className="px-3.5 py-2 whitespace-nowrap">{t('table.customer')}</th>
                    <th className="px-3.5 py-2 whitespace-nowrap">{language === 'ar' ? 'بيع الفرد' : 'Sell Fare'}</th>
                  </>
                )}
                <th className="px-3.5 py-2 whitespace-nowrap">{t('table.profit')}</th>
                <th className="px-3.5 py-2 whitespace-nowrap">{t('table.paymentMethod')}</th>
                <th className="px-3.5 py-2 whitespace-nowrap">{t('table.dateEmployee')}</th>
                <th className="px-3.5 py-2 whitespace-nowrap text-center">{t('table.audit')}</th>
                <th className="px-3.5 py-2 whitespace-nowrap text-center w-12 text-[#475569] font-semibold">{t('table.entry')}</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-[#F1F5F9]">
              {viewMode === 'aggregated' ? (
                paginatedTickets.map((tRow, idx) => {
                  const isUSD = (tRow.currency || '').toUpperCase().includes('USD') || (tRow.currency || '').includes('$');
                  const airlineObj = findAirlineObj(tRow.rawAirlineId || tRow.airline);
                  const isProfitPositive = Number(tRow.profit) > 0;
                  const isProfitNegative = Number(tRow.profit) < 0;
                  const paymentLabel = resolvePaymentLabel(tRow.rawPaymentMethod, tRow.rawPaymentType, language);

                  return (
                    <tr
                      key={tRow.id || idx}
                      className="h-[66px] hover:bg-[#FFFDFC] transition-colors group cursor-pointer select-none"
                      onClick={() => {
                        handleOpenTicketEditor(tRow);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        handleRowContextMenu(e, tRow);
                      }}
                    >
                      {/* Index */}
                      <td className="px-3.5 py-3 text-center text-slate-400 text-xs font-mono">
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>

                      {/* Invoice Number */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-900 text-[13px] group-hover:text-[#F45A0A] transition-colors">
                              {tRow.number}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(tRow.number);
                                showSuccessNotification(
                                  language === 'ar' ? 'تم النسخ' : 'Copied',
                                  language === 'ar' ? 'تم نسخ رقم الفاتورة' : 'Invoice number copied'
                                );
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-600 cursor-pointer"
                              title={t('actions.copy')}
                            >
                              <Copy size={13} />
                            </button>
                          </div>
                          {tRow.status === 'REFUNDED' && (
                            <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-md">
                              <RotateCcw size={10} />
                              {language === 'ar' ? 'مسترجع بالكامل' : 'Fully Refunded'}
                            </span>
                          )}
                          {tRow.status === 'PARTIALLY_REFUNDED' && (
                            <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">
                              <RotateCcw size={10} />
                              {language === 'ar' ? 'مسترجع جزئياً' : 'Partially Refunded'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Passengers */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-slate-700 text-xs bg-slate-100/90 px-2 py-1 rounded-md border border-slate-200/60 font-bold">
                            {tRow.passengersCount} {language === 'ar' ? 'مسافر' : 'Pax'}
                          </span>
                        </div>
                      </td>

                      {/* Airline & PNR */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {airlineObj?.logo ? (
                            <img
                              src={airlineObj.logo}
                              alt={tRow.airline}
                              className="w-7 h-7 rounded-lg object-contain bg-slate-50 border border-slate-200/60 p-0.5 shrink-0"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-lg bg-orange-50 text-[#F45A0A] flex items-center justify-center font-bold text-xs shrink-0 border border-orange-100">
                              <Plane size={14} />
                            </div>
                          )}
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800 text-xs truncate max-w-[130px]">
                              {tRow.airline}
                            </span>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                              <span className="text-slate-500 font-bold">{tRow.route}</span>
                              {tRow.pnr && (
                                <>
                                  <span>•</span>
                                  <span className="font-bold text-[#F45A0A] bg-orange-50/80 px-1 rounded">
                                    {tRow.pnr}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Supplier */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <span className="font-bold text-slate-800 text-xs truncate block max-w-[120px]">
                          {tRow.supplier}
                        </span>
                      </td>

                      {/* Buy Total */}
                      <td className="px-3.5 py-3 whitespace-nowrap font-mono font-bold text-slate-800 tabular-nums">
                        {isUSD
                          ? `$${Number(tRow.totalBuy).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                          : `${Number(tRow.totalBuy).toLocaleString()} د.ع`}
                      </td>

                      {/* Customer */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <span className="font-bold text-slate-800 text-xs truncate block max-w-[120px]">
                          {tRow.customer}
                        </span>
                      </td>

                      {/* Sell Total */}
                      <td className="px-3.5 py-3 whitespace-nowrap font-mono font-black text-slate-900 tabular-nums text-[13.5px]">
                        {isUSD
                          ? `$${Number(tRow.totalSell).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                          : `${Number(tRow.totalSell).toLocaleString()} د.ع`}
                      </td>

                      {/* Profit */}
                      <td className="px-3.5 py-3 whitespace-nowrap font-mono font-black tabular-nums">
                        {canViewProfits ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                              isProfitPositive
                                ? 'text-[#078B61] bg-emerald-50 border border-emerald-200/60'
                                : isProfitNegative
                                ? 'text-[#DC2626] bg-rose-50 border border-rose-200/60'
                                : 'text-slate-600 bg-slate-100 border border-slate-200'
                            }`}
                          >
                            {isProfitPositive ? '+' : ''}
                            {isUSD
                              ? `$${Number(tRow.profit).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                              : `${Number(tRow.profit).toLocaleString()} د.ع`}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-mono">••••</span>
                        )}
                      </td>

                      {/* Payment Method */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                            tRow.rawPaymentType === 'CREDIT' || tRow.paymentType === 'آجل'
                              ? 'bg-amber-50 text-amber-700 border-amber-200/60'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                          }`}
                        >
                          {paymentLabel}
                        </span>
                      </td>

                      {/* Date & Employee */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <div className="flex flex-col text-[11px] leading-tight gap-0.5">
                          <span className="font-mono text-slate-800 font-bold text-[12px] tracking-tight">
                            {tRow.issueDate || tRow.date || formatDateShort(tRow.createdAt) || '—'}
                          </span>
                          <span className="text-slate-500 font-medium text-[11px]">
                            {tRow.employeeName || '—'}
                          </span>
                        </div>
                      </td>

                      {/* Audit */}
                      <td className="px-3.5 py-3 whitespace-nowrap text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTicketAudit(tRow.id || tRow.rawInvoice?.id || tRow.rawInvoice?.invoiceNumber, !tRow.isAudited);
                          }}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                            tRow.isAudited
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 hover:bg-emerald-100'
                              : 'bg-amber-50 text-amber-700 border border-amber-200/60 hover:bg-amber-100'
                          }`}
                        >
                          {tRow.isAudited ? (
                            <>
                              <BadgeCheck size={13} />
                              <span>{t('status.audited')}</span>
                            </>
                          ) : (
                            <>
                              <Clock3 size={13} />
                              <span>{t('status.unaudited')}</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Entry Button */}
                      <td className="px-3.5 py-3 whitespace-nowrap text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenTicketEditor(tRow);
                          }}
                          className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 hover:bg-orange-50 hover:text-[#F45A0A] flex items-center justify-center transition-colors cursor-pointer mx-auto"
                        >
                          <ChevronLeft size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                /* Detailed Passenger-Level Rows */
                paginatedDetailedTickets.map((dRow, idx) => {
                  const isUSD = (dRow.currency || '').toUpperCase().includes('USD') || (dRow.currency || '').includes('$');
                  const airlineObj = findAirlineObj(dRow.rawAirlineId || dRow.airline);
                  const isProfitPositive = Number(dRow.profit) > 0;
                  const isProfitNegative = Number(dRow.profit) < 0;
                  const paymentLabel = resolvePaymentLabel(dRow.rawPaymentMethod, dRow.rawPaymentType, language);

                  return (
                    <tr
                      key={dRow.rowId || idx}
                      className="h-[64px] hover:bg-orange-50/20 transition-colors group cursor-pointer select-none"
                      onClick={() => {
                        handleOpenTicketEditor(dRow);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        handleRowContextMenu(e, dRow);
                      }}
                    >
                      {/* Index */}
                      <td className="px-3.5 py-3 text-center text-slate-400 text-xs font-mono">
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>

                      {/* E-Ticket Number */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-black text-slate-900 text-[12.5px] group-hover:text-[#F45A0A] transition-colors">
                            {dRow.ticketNumber}
                          </span>
                          {dRow.ticketNumber && dRow.ticketNumber !== '—' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(dRow.ticketNumber);
                                showSuccessNotification(
                                  language === 'ar' ? 'تم النسخ' : 'Copied',
                                  language === 'ar' ? 'تم نسخ رقم التذكرة' : 'Ticket number copied'
                                );
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-600 cursor-pointer"
                              title={t('actions.copy')}
                            >
                              <Copy size={12} />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Passenger Name & Type */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-orange-50 text-[#F45A0A] font-black text-[10px] flex items-center justify-center border border-orange-100 shrink-0">
                            {dRow.passengerIndex}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 text-xs block">
                              {dRow.passengerName}
                            </span>
                            <span className="inline-block text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 font-mono">
                              {dRow.ticketType === 'CHILD' ? (language === 'ar' ? 'طفل' : 'Child') : dRow.ticketType === 'INFANT' ? (language === 'ar' ? 'رضيع' : 'Infant') : (language === 'ar' ? 'بالغ' : 'Adult')}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Invoice No & PNR */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <div className="flex flex-col text-xs font-mono">
                          <span className="font-bold text-slate-700 text-[11px]">{dRow.invoiceNumber}</span>
                          <span className="text-[#F45A0A] font-bold text-[10.5px] bg-orange-50/90 px-1 rounded w-fit mt-0.5">
                            {dRow.pnr}
                          </span>
                        </div>
                      </td>

                      {/* Airline */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {airlineObj?.logo ? (
                            <img src={airlineObj.logo} alt={dRow.airline} className="w-5 h-5 object-contain rounded shrink-0" onError={(e) => (e.currentTarget.style.display = 'none')} />
                          ) : (
                            <Plane size={13} className="text-[#F45A0A]" />
                          )}
                          <span className="font-bold text-slate-800 text-xs truncate max-w-[110px]">
                            {dRow.airline}
                          </span>
                        </div>
                      </td>

                      {/* Supplier */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <span className="font-bold text-slate-800 text-xs truncate block max-w-[110px]">
                          {dRow.supplier}
                        </span>
                      </td>

                      {/* Buy Fare */}
                      <td className="px-3.5 py-3 whitespace-nowrap font-mono font-bold text-slate-800 tabular-nums text-xs">
                        {isUSD
                          ? `$${Number(dRow.fareBuy).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                          : `${Number(dRow.fareBuy).toLocaleString()} د.ع`}
                      </td>

                      {/* Customer */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <span className="font-bold text-slate-800 text-xs truncate block max-w-[110px]">
                          {dRow.customer}
                        </span>
                      </td>

                      {/* Sell Fare */}
                      <td className="px-3.5 py-3 whitespace-nowrap font-mono font-black text-slate-900 tabular-nums text-xs">
                        {isUSD
                          ? `$${Number(dRow.fareSell).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                          : `${Number(dRow.fareSell).toLocaleString()} د.ع`}
                      </td>

                      {/* Net Profit */}
                      <td className="px-3.5 py-3 whitespace-nowrap font-mono font-black tabular-nums">
                        {canViewProfits ? (
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-bold ${
                              isProfitPositive
                                ? 'text-[#078B61] bg-emerald-50 border border-emerald-200/60'
                                : isProfitNegative
                                ? 'text-[#DC2626] bg-rose-50 border border-rose-200/60'
                                : 'text-slate-600 bg-slate-100 border border-slate-200'
                            }`}
                          >
                            {isProfitPositive ? '+' : ''}
                            {isUSD
                              ? `$${Number(dRow.profit).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                              : `${Number(dRow.profit).toLocaleString()} د.ع`}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-mono">••••</span>
                        )}
                      </td>

                      {/* Payment Method */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold border ${
                            dRow.rawPaymentType === 'CREDIT' || dRow.paymentType === 'آجل'
                              ? 'bg-amber-50 text-amber-700 border-amber-200/60'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                          }`}
                        >
                          {paymentLabel}
                        </span>
                      </td>

                      {/* Date & Employee */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <div className="flex flex-col text-[10.5px] leading-tight gap-0.5">
                          <span className="font-mono text-slate-800 font-bold text-[11.5px] tracking-tight">
                            {dRow.issueDate || dRow.date || formatDateShort(dRow.createdAt) || '—'}
                          </span>
                          <span className="text-slate-500 font-medium text-[10.5px]">
                            {dRow.employeeName || '—'}
                          </span>
                        </div>
                      </td>

                      {/* Audit */}
                      <td className="px-3.5 py-3 whitespace-nowrap text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTicketAudit(dRow.ticketId || dRow.rawInvoice?.id || dRow.rawInvoice?.invoiceNumber, !dRow.isAudited);
                          }}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10.5px] font-bold transition-all cursor-pointer ${
                            dRow.isAudited
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 hover:bg-emerald-100'
                              : 'bg-amber-50 text-amber-700 border border-amber-200/60 hover:bg-amber-100'
                          }`}
                        >
                          {dRow.isAudited ? (
                            <>
                              <BadgeCheck size={12} />
                              <span>{t('status.audited')}</span>
                            </>
                          ) : (
                            <>
                              <Clock3 size={12} />
                              <span>{t('status.unaudited')}</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Entry Button */}
                      <td className="px-3.5 py-3 whitespace-nowrap text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenTicketEditor(dRow);
                          }}
                          className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 hover:bg-orange-50 hover:text-[#F45A0A] flex items-center justify-center transition-colors cursor-pointer mx-auto"
                        >
                          <ChevronLeft size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE / SMALL WINDOW VIEW (RESPONSIVE CARDS) */}
        <div className="block md:hidden divide-y divide-slate-100 p-2 sm:p-3 space-y-2.5">
          {filteredTickets.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              {language === 'ar' ? 'لا توجد فواتير تذاكر مطابقة' : 'No matching ticket invoices'}
            </div>
          ) : viewMode === 'aggregated' ? (
            paginatedTickets.map((tRow, idx) => {
              const isUSD = (tRow.currency || '').toUpperCase().includes('USD') || (tRow.currency || '').includes('$');
              const airlineObj = findAirlineObj(tRow.rawAirlineId || tRow.airline);
              const isProfitPositive = Number(tRow.profit) > 0;
              const isProfitNegative = Number(tRow.profit) < 0;
              const paymentLabel = resolvePaymentLabel(tRow.rawPaymentMethod, tRow.rawPaymentType, language);

              return (
                <div
                  key={tRow.id || idx}
                  onClick={() => {
                    handleOpenTicketEditor(tRow);
                  }}
                  className="bg-white border border-slate-200/90 hover:border-[#F45A0A]/40 rounded-xl p-3 shadow-2xs space-y-2.5 active:bg-orange-50/10 cursor-pointer transition-all"
                >
                  {/* Top Header: Invoice No + Status/Audit + Passenger Count */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-black text-slate-900 text-xs">
                        {tRow.number}
                      </span>
                      <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                        {tRow.passengersCount} {language === 'ar' ? 'مسافر' : 'Pax'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTicketAudit(tRow.id || tRow.rawInvoice?.id || tRow.rawInvoice?.invoiceNumber, !tRow.isAudited);
                        }}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                          tRow.isAudited
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {tRow.isAudited ? <BadgeCheck size={11} /> : <Clock3 size={11} />}
                        <span>{tRow.isAudited ? t('status.audited') : t('status.unaudited')}</span>
                      </button>
                    </div>
                  </div>

                  {/* Middle Row: Airline + Route + PNR */}
                  <div className="flex items-center justify-between gap-2 bg-slate-50/80 p-2 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-2 min-w-0">
                      {airlineObj?.logo ? (
                        <img src={airlineObj.logo} alt={tRow.airline} className="w-5 h-5 object-contain rounded shrink-0" onError={(e) => ((e.target as HTMLElement).style.display = 'none')} />
                      ) : (
                        <Plane size={13} className="text-[#F45A0A] shrink-0" />
                      )}
                      <span className="font-bold text-slate-800 text-xs truncate">
                        {tRow.airline}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10.5px] font-mono shrink-0">
                      <span className="text-slate-600 font-bold">{tRow.route}</span>
                      {tRow.pnr && (
                        <span className="font-bold text-[#F45A0A] bg-orange-50 px-1 rounded border border-orange-200/60">
                          {tRow.pnr}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Customer and Supplier */}
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-[9.5px] text-slate-400 font-medium block">{t('table.customer')}</span>
                      <span className="font-bold text-slate-800 truncate block">{tRow.customer}</span>
                    </div>
                    <div>
                      <span className="text-[9.5px] text-slate-400 font-medium block">{t('table.supplier')}</span>
                      <span className="font-bold text-slate-800 truncate block">{tRow.supplier}</span>
                    </div>
                  </div>

                  {/* Financial Values Grid (Sell, Buy, Profit) */}
                  <div className="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-slate-100 text-center">
                    <div className="p-1.5 bg-slate-50 rounded-lg">
                      <span className="text-[9px] text-slate-400 font-bold block">{t('table.sellTotal')}</span>
                      <span className="font-black font-mono text-slate-900 text-xs tabular-nums block">
                        {isUSD ? `$${Number(tRow.totalSell).toLocaleString('en-US')}` : Number(tRow.totalSell).toLocaleString()}
                      </span>
                    </div>
                    <div className="p-1.5 bg-slate-50 rounded-lg">
                      <span className="text-[9px] text-slate-400 font-bold block">{t('table.buyTotal')}</span>
                      <span className="font-bold font-mono text-slate-700 text-xs tabular-nums block">
                        {isUSD ? `$${Number(tRow.totalBuy).toLocaleString('en-US')}` : Number(tRow.totalBuy).toLocaleString()}
                      </span>
                    </div>
                    <div className="p-1.5 bg-slate-50 rounded-lg">
                      <span className="text-[9px] text-slate-400 font-bold block">{t('table.profit')}</span>
                      {canViewProfits ? (
                        <span className={`font-black font-mono text-xs tabular-nums block ${isProfitPositive ? 'text-[#078B61]' : isProfitNegative ? 'text-[#DC2626]' : 'text-slate-600'}`}>
                          {isProfitPositive ? '+' : ''}{isUSD ? `$${Number(tRow.profit).toLocaleString('en-US')}` : Number(tRow.profit).toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-slate-300 font-mono text-xs">••••</span>
                      )}
                    </div>
                  </div>

                  {/* Footer Row: Date & Payment Method */}
                  <div className="flex items-center justify-between text-[10.5px] text-slate-500 pt-1">
                    <span className="font-mono font-medium">
                      📅 {tRow.issueDate || tRow.date || formatDateShort(tRow.createdAt) || '—'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                      {paymentLabel}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            paginatedDetailedTickets.map((dRow, idx) => {
              const isUSD = (dRow.currency || '').toUpperCase().includes('USD') || (dRow.currency || '').includes('$');
              const isProfitPositive = Number(dRow.profit) > 0;
              const isProfitNegative = Number(dRow.profit) < 0;

              return (
                <div
                  key={dRow.rowId || idx}
                  onClick={() => {
                    handleOpenTicketEditor(dRow);
                  }}
                  className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs space-y-2 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-slate-900 text-xs">{dRow.ticketNumber}</span>
                    <span className="font-mono text-[10px] font-bold text-slate-500">{dRow.invoiceNumber}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                    <span>👤 {dRow.passengerName}</span>
                    <span className="text-slate-400 font-normal">({dRow.ticketType})</span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 font-mono">
                    <span className="text-slate-600">بيع: {isUSD ? `$${dRow.fareSell}` : dRow.fareSell}</span>
                    <span className="text-slate-600">شراء: {isUSD ? `$${dRow.fareBuy}` : dRow.fareBuy}</span>
                    {canViewProfits && (
                      <span className={`font-bold ${isProfitPositive ? 'text-emerald-700' : isProfitNegative ? 'text-rose-700' : 'text-slate-500'}`}>
                        ربح: {isUSD ? `$${dRow.profit}` : dRow.profit}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── 5. TOTALS FOOTER BAR ── */}
        <div className="bg-[#F8FAFC] border-t border-[#E5E7EB] p-2.5 sm:px-5 sm:py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-4 text-xs font-sans">
          <div className="flex items-center gap-3 text-slate-600 font-semibold flex-wrap">
            <span>{t('totals.matching')} <strong className="font-mono text-slate-900 font-bold">{filteredTickets.length}</strong> {t('totals.invoices')}</span>
            <span>•</span>
            <span>{t('totals.passengers')} <strong className="font-mono text-slate-900 font-bold">{kpis.totalPassengers}</strong></span>
          </div>

          <div className="flex items-center gap-3 sm:gap-6 flex-wrap w-full sm:w-auto justify-between sm:justify-end">
            {/* Total Buy */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium text-[11px]">{t('tickets.totalCost')}:</span>
              <div className="font-mono font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                {(currencyFilter === 'ALL' || currencyFilter === 'USD') && (
                  <span>${kpis.totalBuyUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                )}
                {(currencyFilter === 'ALL' || currencyFilter === 'IQD') && (
                  <span>{kpis.totalBuyIQD.toLocaleString()} {language === 'ar' ? 'د.ع' : 'IQD'}</span>
                )}
              </div>
            </div>

            {/* Total Sell */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium text-[11px]">{t('tickets.totalSales')}:</span>
              <div className="font-mono font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                {(currencyFilter === 'ALL' || currencyFilter === 'USD') && (
                  <span>${kpis.totalSellUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                )}
                {(currencyFilter === 'ALL' || currencyFilter === 'IQD') && (
                  <span>{kpis.totalSellIQD.toLocaleString()} {language === 'ar' ? 'د.ع' : 'IQD'}</span>
                )}
              </div>
            </div>

            {/* Net Profit */}
            {canViewProfits && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-medium text-[11px]">{t('tickets.netProfit')}:</span>
                <div className="font-mono font-bold text-[#078B61] flex items-center gap-1.5 text-xs">
                  {(currencyFilter === 'ALL' || currencyFilter === 'USD') && (
                    <span>{kpis.totalProfitUSD >= 0 ? '+' : ''}${kpis.totalProfitUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  )}
                  {(currencyFilter === 'ALL' || currencyFilter === 'IQD') && (
                    <span>{kpis.totalProfitIQD >= 0 ? '+' : ''}{kpis.totalProfitIQD.toLocaleString()} {language === 'ar' ? 'د.ع' : 'IQD'}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── 6. PAGINATION BAR ── */}
        <div className="bg-white p-2.5 sm:px-5 sm:py-3 border-t border-[#E5E7EB] flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4 text-xs font-sans">
          {/* Showing range */}
          <div className="text-slate-500 font-medium text-[11px] sm:text-xs text-center sm:text-start">
            {t('pagination.showing')} {filteredTickets.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, filteredTickets.length)} {t('pagination.of')} {filteredTickets.length} {t('totals.invoices')}
          </div>

          {/* Page Buttons and Size Selector */}
          <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
            {/* Page Size Selector */}
            <div className="flex items-center gap-1 text-slate-500 text-[11px]">
              <span>{t('pagination.pageSize')}</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-8 px-2 rounded-lg bg-[#FAFAFA] border border-[#E5E7EB] text-xs font-bold text-slate-700 outline-none cursor-pointer"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {/* Pagination Navigator */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#E5E7EB] bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title={language === 'ar' ? 'الصفحة السابقة' : 'Previous page'}
              >
                {direction === 'rtl' ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>

              <span className="px-2.5 text-xs font-mono font-bold text-slate-800">
                {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage >= totalPages}
                className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#E5E7EB] bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title={language === 'ar' ? 'الصفحة التالية' : 'Next page'}
              >
                {direction === 'rtl' ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 7. WORKSPACE & DIALOG MODALS ── */}
      <TicketRefundEditorWorkspace
        opened={refundWorkspaceOpen}
        initialData={ticketForRefund}
        onClose={() => {
          setRefundWorkspaceOpen(false);
          setTicketForRefund(null);
        }}
        onSuccess={() => {
          setRefundWorkspaceOpen(false);
          setTicketForRefund(null);
          reloadTicketsFromApi(false);
        }}
      />

      <TicketInvoiceEditorWorkspace
        opened={modalOpen}
        initialData={editingTicketData}
        onClose={() => {
          setModalOpen(false);
          setEditingTicketData(null);
        }}
        onSuccess={handleTicketSaved}
      />

      <GroupFareEditorWorkspace
        opened={groupFareWorkspaceOpen}
        initialData={groupFareEditingTicket}
        onClose={() => {
          setGroupFareWorkspaceOpen(false);
          setGroupFareEditingTicket(null);
        }}
        onSuccess={() => {
          setGroupFareWorkspaceOpen(false);
          setGroupFareEditingTicket(null);
          reloadTicketsFromApi(false);
        }}
      />

      <GroupFileWorkspace opened={groupFileOpen} groupId={null} onClose={() => setGroupFileOpen(false)} />

      <SmartTicketImportModal
        opened={smartImportModalOpen}
        initialFile={selectedTicketFile}
        onClose={() => {
          setSmartImportModalOpen(false);
          setSelectedTicketFile(null);
        }}
        onImport={handleSmartImport}
      />

      <InvoiceAuditLogModal
        opened={auditLogOpen}
        onClose={() => setAuditLogOpen(false)}
        ticketNumber={selectedTicketForAudit?.number || 'TK-2026-90812'}
        pnr={selectedTicketForAudit?.pnr || 'HX92KL'}
        customerName={selectedTicketForAudit?.customer || 'شركة السفر السريع'}
      />

      {/* Payment Receipt Modal */}
      <Modal
        opened={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        title={
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <ImageIcon size={18} className="text-[#F45A0A]" />
            <span>{language === 'ar' ? 'إيصال / صورة حوالة الدفع الإلكتروني' : 'Payment Transfer Receipt'}</span>
          </div>
        }
        size="md"
        centered
        radius="lg"
      >
        {selectedReceiptTicket && (
          <div className={`flex flex-col items-center gap-3 p-1 text-${direction === 'rtl' ? 'right' : 'left'}`}>
            <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-400 block text-[10.5px]">{t('table.invoiceNumber')}:</span>
                <span className="text-slate-900 font-bold font-mono">{selectedReceiptTicket.number}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10.5px]">{t('table.customer')}:</span>
                <span className="text-slate-900 font-bold truncate block">{selectedReceiptTicket.customer}</span>
              </div>
            </div>

            {selectedReceiptTicket.transferImage ? (
              <div className="relative flex items-center justify-center min-h-[200px] w-full bg-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                <img
                  src={selectedReceiptTicket.transferImage}
                  alt="Receipt"
                  className="max-h-[60vh] max-w-full rounded-lg object-contain"
                />
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                {language === 'ar' ? 'لا توجد صورة إيصال مرفقة' : 'No receipt image attached'}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Context Menu Backdrop & Floating Panel */}
      {contextMenu && (
        <>
          {/* Full-screen invisible backdrop to capture outside clicks / right clicks */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 99998 }}
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu(null);
            }}
          />

          {/* Floating Context Menu */}
          <div
            style={{
              position: 'fixed',
              zIndex: 99999,
              top: `${contextMenu.y}px`,
              left: `${contextMenu.x}px`,
            }}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl py-1.5 min-w-[230px] text-xs font-medium divide-y divide-slate-100 select-none animate-in fade-in zoom-in-95 duration-100"
            dir={direction}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
          {/* Header Info */}
          <div className="px-3.5 py-2 flex items-center justify-between text-slate-400 font-mono text-[11px]">
            <span className="font-bold text-slate-800 font-sans truncate max-w-[130px]">
              {contextMenu.ticket.customer || contextMenu.ticket.number}
            </span>
            <span className="font-bold text-[#F45A0A]">{contextMenu.ticket.pnr || ''}</span>
          </div>

          {/* Primary Actions */}
          <div className="py-1">
            <button
              type="button"
              onClick={() => {
                handleOpenTicketEditor(contextMenu.ticket);
                setContextMenu(null);
              }}
              className="w-full px-3.5 py-2 text-slate-700 hover:bg-orange-50 hover:text-[#F45A0A] flex items-center gap-2.5 transition-colors cursor-pointer text-start font-medium"
            >
              <Edit3 size={15} className="text-[#F45A0A]" />
              <span>
                {language === 'ar'
                  ? isGroupFareTicket(contextMenu.ticket)
                    ? 'تعديل فاتورة كروب فير'
                    : 'تعديل فاتورة التذاكر'
                  : 'Edit Invoice'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                const tRow = contextMenu.ticket;
                if (tRow.refundStatus === 'FULL') {
                  showInfoNotification(
                    language === 'ar' ? 'التذكرة مسترجعة بالكامل' : 'Already Fully Refunded',
                    language === 'ar'
                      ? `جميع المسافرين (${tRow.passengersCount}) في هذه الفاتورة تم استرجاعهم مسبقاً.`
                      : `All ${tRow.passengersCount} passengers in this invoice are already refunded.`
                  );
                  setContextMenu(null);
                  return;
                }

                // Extract ONLY unrefunded passengers (e.g. 2 out of 6)
                const allPax = tRow.detailedPassengers || tRow.passengers || tRow.rawInvoice?.passengers || [];
                const unrefundedPax = allPax.filter((p: any) => !p.isRefunded && p.status !== 'REFUNDED' && p.status !== 'مسترجع');
                const finalPaxToRefund = unrefundedPax.length > 0 ? unrefundedPax : allPax;

                const targetData: any = {
                  ...(tRow.rawInvoice || {}),
                  id: undefined, // Create new refund document
                  invoiceNumber: undefined,
                  originalInvoiceNumber: tRow.number || tRow.invoiceNumber,
                  reference: tRow.number || tRow.invoiceNumber,
                  pnr: tRow.pnr,
                  customerName: tRow.customer,
                  supplierAccount: tRow.supplierAccount || tRow.rawInvoice?.supplierAccount,
                  supplierAccountName: tRow.supplier || tRow.rawInvoice?.supplierAccountName,
                  airline: tRow.rawAirlineId || tRow.airline,
                  route: tRow.route,
                  currency: tRow.currency,
                  detailedPassengers: finalPaxToRefund,
                  passengers: finalPaxToRefund.map((p: any) => ({
                    name: p.name || p.displayName || '',
                    type: p.ticketType || p.type || 'ADULT',
                    ticketNumber: p.ticketNumber || '',
                    pnr: p.pnr || tRow.pnr || '',
                    fareBuy: Math.abs(p.fareBuy || 0),
                    fareSell: Math.abs(p.fareSell || 0),
                    tax1: p.tax1 || 0,
                    tax2: p.tax2 || 0,
                    charge: p.charge || 0,
                    isRefunded: false,
                    status: 'Active',
                  })),
                };

                setTicketForRefund(targetData);
                setRefundWorkspaceOpen(true);
                setContextMenu(null);
              }}
              className="w-full px-3.5 py-2 text-slate-700 hover:bg-amber-50 hover:text-amber-800 flex items-center gap-2.5 transition-colors cursor-pointer text-start font-medium"
            >
              <RotateCcw size={15} className="text-amber-600" />
              <span>{language === 'ar' ? 'عمل استرجاع' : 'Refund Ticket'}</span>
            </button>

            {contextMenu.ticket.transferImage && (
            <button
              type="button"
              onClick={() => {
                setSelectedReceiptTicket(contextMenu.ticket);
                setReceiptModalOpen(true);
                setContextMenu(null);
              }}
              className="w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer text-start"
            >
              <ImageIcon size={15} className="text-emerald-600" />
              <span className="flex-1">{language === 'ar' ? 'عرض إيصال التحويل' : 'View Transfer Receipt'}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </button>
            )}

            <button
              type="button"
              onClick={() => {
                setSelectedTicketForAudit(contextMenu.ticket);
                setAuditLogOpen(true);
                setContextMenu(null);
              }}
              className="w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer text-start"
            >
              <History size={15} className="text-slate-500" />
              <span>{language === 'ar' ? 'سجل التدقيق والتعديلات' : 'Audit History'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const pnrVal = contextMenu.ticket.pnr || contextMenu.ticket.rawInvoice?.pnr || '';
                handleCopyPnr(pnrVal);
                setContextMenu(null);
              }}
              className="w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer text-start font-mono font-bold"
            >
              <Copy size={15} className="text-[#F45A0A]" />
              <span>{language === 'ar' ? 'نسخ PNR' : 'Copy PNR'}</span>
            </button>
          </div>

          {/* Destructive Action */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => {
                setTicketToDelete(contextMenu.ticket);
                setDeleteModalOpen(true);
                setContextMenu(null);
              }}
              className="w-full px-3.5 py-2 text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors cursor-pointer text-start font-bold"
            >
              <Trash2 size={15} className="text-red-500" />
              <span>{language === 'ar' ? 'حذف التذكرة' : 'Delete Ticket'}</span>
            </button>
          </div>
        </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteModalOpen}
        onClose={() => {
          if (!isDeleting) {
            setDeleteModalOpen(false);
            setTicketToDelete(null);
          }
        }}
        title={
          <div className="flex items-center gap-2 text-red-600 font-bold text-sm">
            <AlertTriangle size={18} />
            <span>{language === 'ar' ? 'تأكيد حذف التذكرة' : 'Confirm Ticket Deletion'}</span>
          </div>
        }
        size="sm"
        centered
        radius="lg"
      >
        {ticketToDelete && (
          <div className={`space-y-4 text-${direction === 'rtl' ? 'right' : 'left'}`}>
            <div className="p-3 bg-red-50/70 border border-red-200/80 rounded-xl space-y-1.5 text-xs">
              <p className="text-slate-700 font-medium leading-relaxed">
                {language === 'ar'
                  ? 'هل أنت متأكد من رغبتك في حذف هذه التذكرة نهائياً؟ سيتم إلغاء الفاتورة وحذف بيانات المسافرين المرتبطة بها.'
                  : 'Are you sure you want to permanently delete this ticket? The invoice and related passenger records will be removed.'}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 text-xs">
              <div className="flex justify-between items-center border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500">{t('table.invoiceNumber')}:</span>
                <span className="font-mono font-bold text-slate-900">{ticketToDelete.number}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500">PNR:</span>
                <span className="font-mono font-bold text-[#F45A0A]">{ticketToDelete.pnr}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500">{t('table.customer')}:</span>
                <span className="font-bold text-slate-800">{ticketToDelete.customer}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{t('table.sellTotal')}:</span>
                <span className="font-mono font-bold text-slate-900">
                  {ticketToDelete.currency?.includes('USD')
                    ? `$${Number(ticketToDelete.totalSell || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                    : `${Number(ticketToDelete.totalSell || 0).toLocaleString()} ${language === 'ar' ? 'د.ع' : 'IQD'}`}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setDeleteModalOpen(false);
                  setTicketToDelete(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteTicket}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                {isDeleting ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  <Trash2 size={13} />
                )}
                <span>{language === 'ar' ? 'حذف نهائي' : 'Delete'}</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TicketsPage;
