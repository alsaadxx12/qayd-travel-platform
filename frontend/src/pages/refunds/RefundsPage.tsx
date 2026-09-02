import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Tooltip,
  Menu,
  Popover,
} from '@mantine/core';
import {
  RotateCcw,
  Plus,
  Search,
  RefreshCw,
  Edit3,
  History,
  Receipt,
  MoreVertical,
  Check,
  X,
  Copy,
  UsersRound,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Trash2,
  Clock3,
  Coins,
  User,
  Building2,
  Plane,
  FileText,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Banknote,
  ReceiptText,
  BadgeCheck,
} from 'lucide-react';
import { ticketsApi, type TicketData } from '../../api/tickets';
import { airlinesApi, type AirlineItem } from '../../api/airlines';
import { partnersApi } from '../../api/partners';
import { accountsApi } from '../../api/accounts';
import { TicketRefundEditorWorkspace } from '../../components/refunds/TicketRefundEditorWorkspace';
import { InvoiceAuditLogModal } from '../../components/tickets/InvoiceAuditLogModal';
import { SegmentedDatePicker } from '../../components/ui/SegmentedDatePicker';
import { CurrencySegmentedControl } from '../../components/ui/CurrencySegmentedControl';
import { useLanguageStore } from '../../store/useLanguageStore';
import { showSuccessNotification, showErrorNotification, showInfoNotification } from '../../utils/notifications';

// Format short date YYYY-MM-DD
const formatDateShort = (val: any) => {
  if (!val || val === '—') return '—';
  const str = String(val).trim();
  if (str.includes('T')) return str.split('T')[0];
  if (str.includes(' ')) return str.split(' ')[0];
  if (str.length >= 10) return str.substring(0, 10);
  return str;
};

// Global cache for instant 0ms switching
let globalRefundsCache: TicketData[] | null = null;
let globalAirlinesCache: AirlineItem[] | null = null;

export const RefundsPage: React.FC = () => {
  const { t, language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  const [refunds, setRefunds] = useState<TicketData[]>(globalRefundsCache || []);
  const [airlines, setAirlines] = useState<AirlineItem[]>(globalAirlinesCache || []);
  const [loading, setLoading] = useState<boolean>(!globalRefundsCache);
  const [workspaceOpen, setWorkspaceOpen] = useState<boolean>(false);
  const [selectedRefundToEdit, setSelectedRefundToEdit] = useState<TicketData | null>(null);
  const [isManualRefundMode, setIsManualRefundMode] = useState<boolean>(false);

  // Audit Log Modal State
  const [auditModalOpened, setAuditModalOpened] = useState<boolean>(false);
  const [selectedTicketForAudit, setSelectedTicketForAudit] = useState<TicketData | null>(null);

  // Helper to match airline object for logo
  const findAirlineObj = useCallback(
    (airlineNameOrId?: string | null): AirlineItem | null => {
      if (!airlineNameOrId || airlineNameOrId === '—') return null;
      const cleanStr = (s?: string) => (s || '').trim().toLowerCase().replace(/\s+/g, '');
      const targetStr = cleanStr(airlineNameOrId);
      const upperCode = (airlineNameOrId || '').trim().toUpperCase();

      return (
        airlines.find((a) => {
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
    [airlines]
  );

  // Filters State matching TicketsPage
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currencyFilter, setCurrencyFilter] = useState<string>('ALL'); // ALL, IQD, USD
  const [auditFilter, setAuditFilter] = useState<'ALL' | 'AUDITED' | 'UNAUDITED'>('ALL');
  const [dateFrom, setDateFrom] = useState<Date | null>(() => new Date(new Date().getFullYear(), 0, 1));
  const [dateTo, setDateTo] = useState<Date | null>(() => new Date());
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Fetch Refunds (Tickets with tripType: 'REFUND' or status: 'REFUNDED')
  const fetchRefunds = useCallback(async () => {
    try {
      setLoading(true);
      const [allTickets, allAirlines] = await Promise.all([
        ticketsApi.getAll(),
        airlinesApi.getAll(),
      ]);

      const filtered = (allTickets || []).filter(
        (t) =>
          t.tripType === 'REFUND' ||
          t.status === 'REFUNDED' ||
          String(t.invoiceNumber || '').startsWith('REF-') ||
          String(t.notes || '').includes('استرجاع')
      );

      globalRefundsCache = filtered;
      globalAirlinesCache = allAirlines;
      setRefunds(filtered);
      setAirlines(allAirlines || []);
    } catch (err: any) {
      console.error('Failed to load refunds:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRefunds();
  }, [fetchRefunds]);

  // Toggle Audit Status
  const toggleRefundAudit = async (ticket: TicketData) => {
    if (!ticket.id) return;
    try {
      const isAuditedNow = !ticket.isAudited;
      setRefunds((prev) =>
        prev.map((t) => (t.id === ticket.id ? { ...t, isAudited: isAuditedNow } : t))
      );

      await ticketsApi.toggleAudit(ticket.id);
      showSuccessNotification(
        isAr ? 'التدقيق المالي' : 'Financial Audit',
        isAuditedNow
          ? (isAr ? `تم تدقيق واعتماد مستند الاسترجاع (${ticket.invoiceNumber}) بنجاح.` : `Refund (${ticket.invoiceNumber}) audited successfully.`)
          : (isAr ? `تمت إعادة المستند (${ticket.invoiceNumber}) إلى حالة المراجعة.` : `Refund (${ticket.invoiceNumber}) set to under review.`)
      );
    } catch (err: any) {
      showErrorNotification(isAr ? 'خطأ' : 'Error', err?.message || 'Failed to toggle audit');
      fetchRefunds();
    }
  };

  // Copy PNR helper
  const handleCopyPnr = (pnrCode?: string | null) => {
    if (!pnrCode || pnrCode === '—') {
      showInfoNotification(
        isAr ? 'لا يوجد PNR' : 'No PNR',
        isAr ? 'لا يوجد كود PNR مسجل لهذا الاسترجاع' : 'No PNR code for this refund'
      );
      return;
    }
    navigator.clipboard.writeText(pnrCode);
    showInfoNotification(
      isAr ? 'تم النسخ' : 'Copied',
      isAr ? `تم نسخ كود PNR (${pnrCode}) إلى الحافظة` : `PNR (${pnrCode}) copied to clipboard`
    );
  };

  // Delete Refund Document
  const handleDeleteRefund = async (ticket: TicketData) => {
    if (!ticket.id) return;
    if (!window.confirm(isAr ? `هل أنت متأكد من حذف مستند الاسترجاع ${ticket.invoiceNumber}؟` : `Delete refund ${ticket.invoiceNumber}?`)) return;
    try {
      await ticketsApi.delete(ticket.id);
      showSuccessNotification(isAr ? 'تم الحذف' : 'Deleted', isAr ? 'تم حذف مستند الاسترجاع بنجاح' : 'Refund deleted successfully');
      fetchRefunds();
    } catch (err: any) {
      showErrorNotification(isAr ? 'خطأ' : 'Error', err?.message || 'Failed to delete');
    }
  };

  // Filtered Refunds
  const filteredRefunds = useMemo(() => {
    return refunds.filter((r) => {
      // Search Match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesInvoice = r.invoiceNumber?.toLowerCase().includes(q);
        const matchesPnr = r.pnr?.toLowerCase().includes(q);
        const matchesCustomer = r.customerName?.toLowerCase().includes(q);
        const matchesSupplier = r.supplierAccountName?.toLowerCase().includes(q);
        const matchesPassenger = r.passengers?.some(
          (p) => p.name?.toLowerCase().includes(q) || p.ticketNumber?.toLowerCase().includes(q)
        );
        if (!matchesInvoice && !matchesPnr && !matchesCustomer && !matchesSupplier && !matchesPassenger) {
          return false;
        }
      }

      // Currency Filter
      if (currencyFilter !== 'ALL') {
        const ticketCurr = (r.currency || 'IQD').toUpperCase();
        if (ticketCurr !== currencyFilter) return false;
      }

      // Audit Filter
      if (auditFilter === 'AUDITED' && !r.isAudited) return false;
      if (auditFilter === 'UNAUDITED' && r.isAudited) return false;

      // Date Range Filter
      if (dateFrom) {
        const ticketDate = r.issueDate ? new Date(r.issueDate) : null;
        if (ticketDate && ticketDate < new Date(dateFrom.setHours(0, 0, 0, 0))) return false;
      }
      if (dateTo) {
        const ticketDate = r.issueDate ? new Date(r.issueDate) : null;
        if (ticketDate && ticketDate > new Date(dateTo.setHours(23, 59, 59, 999))) return false;
      }

      return true;
    });
  }, [refunds, searchQuery, currencyFilter, auditFilter, dateFrom, dateTo]);

  // Paginated Slice
  const totalPages = Math.max(1, Math.ceil(filteredRefunds.length / pageSize));
  const paginatedRefunds = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRefunds.slice(start, start + pageSize);
  }, [filteredRefunds, currentPage, pageSize]);

  // Summary KPIs (Matching TicketsPage KPI structure)
  const kpis = useMemo(() => {
    let totalSellIQD = 0;
    let totalSellUSD = 0;
    let totalBuyIQD = 0;
    let totalBuyUSD = 0;
    let totalProfitIQD = 0;
    let totalProfitUSD = 0;
    let auditedCount = 0;
    let unauditedCount = 0;
    let totalPassengers = 0;

    filteredRefunds.forEach((r) => {
      totalPassengers += r.passengers?.length || 1;
      const isUsd = (r.currency || 'IQD').toUpperCase() === 'USD';
      const sell = Math.abs(r.netSell || r.totalSell || 0);
      const buy = Math.abs(r.netBuy || r.totalBuy || 0);
      const profit = r.profit || (sell - buy);

      if (isUsd) {
        totalSellUSD += sell;
        totalBuyUSD += buy;
        totalProfitUSD += profit;
      } else {
        totalSellIQD += sell;
        totalBuyIQD += buy;
        totalProfitIQD += profit;
      }

      if (r.isAudited) auditedCount++;
      else unauditedCount++;
    });

    return {
      totalSellIQD,
      totalSellUSD,
      totalBuyIQD,
      totalBuyUSD,
      totalProfitIQD,
      totalProfitUSD,
      auditedCount,
      unauditedCount,
      totalPassengers,
      count: filteredRefunds.length,
    };
  }, [filteredRefunds]);

  return (
    <div
      className={`w-full max-w-[1760px] mx-auto px-6 py-5 select-none font-sans space-y-4 bg-[#F7F8FA] min-h-screen text-${direction === 'rtl' ? 'right' : 'left'}`}
      dir={direction}
      style={{ fontFamily: language === 'ar' ? "'IBM Plex Sans Arabic', system-ui, sans-serif" : "'IBM Plex Sans', system-ui, sans-serif" }}
    >
      
      {/* ── 1. UNIFIED PAGE HEADER (Matching TicketsPage: 86px Height) ── */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white rounded-[14px] border border-[#E5E7EB] px-5 py-4 min-h-[86px] shadow-2xs">
        {/* Title and Icon Container (38x38px) */}
        <div className="flex items-center gap-3.5">
          <div className="w-[38px] h-[38px] rounded-[10px] bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center font-bold shadow-2xs shrink-0">
            <RotateCcw size={21} strokeWidth={1.85} />
          </div>
          <div>
            <h1 className="font-bold text-[20px] text-[#111827] leading-tight">
              {isAr ? 'استرجاع التذاكر (Ticket Refunds)' : 'Ticket Refunds Management'}
            </h1>
            <p className="text-[13px] font-normal text-[#64748B] mt-0.5">
              {isAr
                ? 'إدارة فواتير وسندات استرجاع التذاكر واحتساب غرامات الإلغاء وتحديث أرصدة العملاء والموردين فورياً'
                : 'Manage ticket refunds, cancellation penalties, customer credits, and automatic ledger posting'}
            </p>
          </div>
        </div>

        {/* Action Buttons (Matching TicketsPage Button Heights: 44px) */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Button 1: Refund from Issued Ticket */}
          <button
            type="button"
            onClick={() => {
              setSelectedRefundToEdit(null);
              setIsManualRefundMode(false);
              setWorkspaceOpen(true);
            }}
            className="h-[44px] px-5 rounded-[9px] bg-[#F45A0A] hover:bg-[#DD4F05] active:scale-[0.98] text-white font-semibold text-[13.5px] shadow-xs flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus size={17} strokeWidth={2.4} />
            <span>{isAr ? 'استرجاع من تذكرة مسجلة' : 'Refund From Ticket'}</span>
          </button>

          {/* Button 2: New Manual Direct Refund (نيو ريفاوند) */}
          <button
            type="button"
            onClick={() => {
              setSelectedRefundToEdit(null);
              setIsManualRefundMode(true);
              setWorkspaceOpen(true);
            }}
            className="h-[44px] px-4 rounded-[9px] bg-white border-2 border-[#F45A0A] text-[#F45A0A] hover:bg-[#FFF3E8] font-bold text-[13px] flex items-center gap-2 transition-all cursor-pointer shadow-2xs"
          >
            <RotateCcw size={16} strokeWidth={2.2} />
            <span>{isAr ? 'نيو ريفاوند (استرجاع يدوي)' : 'New Direct Refund'}</span>
          </button>

          <button
            type="button"
            onClick={fetchRefunds}
            disabled={loading}
            className="h-[44px] px-4 rounded-[9px] bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#334155] font-semibold text-[13px] flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            title={isAr ? 'تحديث' : 'Refresh'}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-[#F45A0A]' : 'text-[#64748B]'} />
            <span className="hidden sm:inline">{isAr ? 'تحديث' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* ── 2. FOUR KPI ANALYTICAL CARDS (Height 116px, 16px Padding, 2-Column Currency Grid) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total Customer Sell Refunds */}
        <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-4 shadow-2xs flex flex-col justify-between h-[116px]">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-[#64748B]">
              {isAr ? 'الصافي المردود للعملاء' : 'Customer Net Refunds'}
            </span>
            <div className="w-[38px] h-[38px] rounded-[10px] bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center shrink-0">
              <Banknote size={20} strokeWidth={1.85} />
            </div>
          </div>
          <div>
            {loading ? (
              <div className="grid grid-cols-2 gap-2 animate-pulse">
                <div className="h-4 bg-slate-200/70 rounded" />
                <div className="h-4 bg-slate-200/70 rounded" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[11px] font-medium text-[#64748B] block">{isAr ? 'دولار USD' : 'USD'}</span>
                  <span className="text-[18px] font-bold font-mono text-[#111827] tabular-nums leading-tight block">
                    ${kpis.totalSellUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-[#64748B] block">{isAr ? 'دينار عراقي' : 'IQD'}</span>
                  <span className="text-[17px] font-bold font-mono text-[#111827] tabular-nums leading-tight block">
                    {kpis.totalSellIQD.toLocaleString()} <span className="text-[10px] font-sans font-semibold text-[#64748B]">{isAr ? 'د.ع' : 'IQD'}</span>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Total Supplier Buy Recoveries */}
        <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-4 shadow-2xs flex flex-col justify-between h-[116px]">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-[#64748B]">
              {isAr ? 'المسترجع من الموردين' : 'Supplier Recoveries'}
            </span>
            <div className="w-[38px] h-[38px] rounded-[10px] bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center shrink-0">
              <ReceiptText size={20} strokeWidth={1.85} />
            </div>
          </div>
          <div>
            {loading ? (
              <div className="grid grid-cols-2 gap-2 animate-pulse">
                <div className="h-4 bg-slate-200/70 rounded" />
                <div className="h-4 bg-slate-200/70 rounded" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[11px] font-medium text-[#64748B] block">{isAr ? 'دولار USD' : 'USD'}</span>
                  <span className="text-[18px] font-bold font-mono text-[#111827] tabular-nums leading-tight block">
                    ${kpis.totalBuyUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-[#64748B] block">{isAr ? 'دينار عراقي' : 'IQD'}</span>
                  <span className="text-[17px] font-bold font-mono text-[#111827] tabular-nums leading-tight block">
                    {kpis.totalBuyIQD.toLocaleString()} <span className="text-[10px] font-sans font-semibold text-[#64748B]">{isAr ? 'د.ع' : 'IQD'}</span>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Net Realized Agency Refund Profit */}
        <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-4 shadow-2xs flex flex-col justify-between h-[116px]">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-[#64748B]">
              {isAr ? 'صافي أرباح الاسترجاع' : 'Net Refund Profit'}
            </span>
            <div className="w-[38px] h-[38px] rounded-[10px] bg-[#ECFDF5] text-[#078B61] flex items-center justify-center shrink-0">
              <TrendingUp size={20} strokeWidth={1.85} />
            </div>
          </div>
          <div>
            {loading ? (
              <div className="grid grid-cols-2 gap-2 animate-pulse">
                <div className="h-4 bg-slate-200/70 rounded" />
                <div className="h-4 bg-slate-200/70 rounded" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[11px] font-medium text-[#64748B] block">{isAr ? 'دولار USD' : 'USD'}</span>
                  <span className="text-[18px] font-bold font-mono text-[#078B61] tabular-nums leading-tight block">
                    +${kpis.totalProfitUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-[#64748B] block">{isAr ? 'دينار عراقي' : 'IQD'}</span>
                  <span className="text-[17px] font-bold font-mono text-[#078B61] tabular-nums leading-tight block">
                    +{kpis.totalProfitIQD.toLocaleString()} <span className="text-[10px] font-sans font-semibold">{isAr ? 'د.ع' : 'IQD'}</span>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card 4: Financial Audit Status */}
        <div
          onClick={() => {
            setAuditFilter((prev) => (prev === 'ALL' ? 'UNAUDITED' : prev === 'UNAUDITED' ? 'AUDITED' : 'ALL'));
            setCurrentPage(1);
          }}
          className={`bg-white rounded-[14px] p-4 shadow-2xs transition-all cursor-pointer hover:shadow-xs flex flex-col justify-between h-[116px] border ${
            auditFilter !== 'ALL' ? 'border-[#F45A0A] bg-orange-50/20' : 'border-[#E5E7EB]'
          }`}
          title={isAr ? 'تصفية حسب حالة التدقيق' : 'Filter by Audit Status'}
        >
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-[#64748B]">
              {isAr ? 'حالة التدقيق المالي' : 'Financial Audit'}
            </span>
            <div className="w-[38px] h-[38px] rounded-[10px] bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center shrink-0">
              <ShieldCheck size={20} strokeWidth={1.85} />
            </div>
          </div>
          <div>
            {loading ? (
              <div className="grid grid-cols-2 gap-2 animate-pulse">
                <div className="h-6 bg-slate-200/70 rounded" />
                <div className="h-6 bg-slate-200/70 rounded" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1 text-center pt-1 border-t border-slate-100">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-0.5">
                    <BadgeCheck size={11} /> {isAr ? 'مدققة' : 'Audited'}
                  </span>
                  <span className="font-mono font-bold text-[14px] text-emerald-800">{kpis.auditedCount}</span>
                </div>

                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-[#C2410C] font-bold flex items-center gap-0.5">
                    <ShieldAlert size={11} /> {isAr ? 'مراجعة' : 'Review'}
                  </span>
                  <span className="font-mono font-bold text-[14px] text-[#C2410C]">{kpis.unauditedCount}</span>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── 3. STREAMLINED FILTERS BAR (Search + Date Range + Currency matching TicketsPage) ── */}
      <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-3.5 shadow-2xs">
        <div className="flex items-center justify-between gap-3.5 flex-wrap">
          
          {/* General Search Input */}
          <div className="relative min-w-[280px] max-w-[420px] flex-1">
            <Search size={16} className={`absolute ${direction === 'rtl' ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 text-slate-400`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={isAr ? 'ابحث برقم الاسترجاع، PNR، رقم التذكرة، العميل، أو المسافر...' : 'Search refund #, PNR, ticket #, or customer...'}
              className={`w-full h-[44px] ${direction === 'rtl' ? 'pr-10 pl-3.5' : 'pl-10 pr-3.5'} rounded-[10px] bg-[#FAFAFA] border border-[#E5E7EB] text-[13.5px] text-[#111827] placeholder-[#9CA3AF] outline-none hover:bg-white hover:border-[#D1D5DB] focus:bg-white focus:border-2 focus:border-[#F45A0A] transition-colors`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className={`absolute ${direction === 'rtl' ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer`}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Date Range Filters (From & To using SegmentedDatePicker) */}
          <div className="flex items-center gap-3.5 flex-wrap">
            {/* From Date */}
            <div className="flex items-center gap-2" dir="ltr">
              <span className="text-xs font-bold text-slate-600 shrink-0 select-none">{isAr ? 'من:' : 'From:'}</span>
              <div className="w-[245px]">
                <SegmentedDatePicker
                  value={dateFrom || new Date()}
                  onChange={(d) => {
                    setDateFrom(d);
                    setCurrentPage(1);
                  }}
                />
              </div>
            </div>

            {/* To Date */}
            <div className="flex items-center gap-2" dir="ltr">
              <span className="text-xs font-bold text-slate-600 shrink-0 select-none">{isAr ? 'إلى:' : 'To:'}</span>
              <div className="w-[245px]">
                <SegmentedDatePicker
                  value={dateTo || new Date()}
                  onChange={(d) => {
                    setDateTo(d);
                    setCurrentPage(1);
                  }}
                />
              </div>
            </div>

            {/* Currency Filter (CurrencySegmentedControl) */}
            <div className="flex items-center gap-2">
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
          </div>

        </div>
      </div>

      {/* ── 4. Main Refunds Data Table ── */}
      <div className="bg-white rounded-[14px] border border-[#E5E7EB] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right border-collapse">
            <thead>
              <tr className="bg-[#F8FAFC] text-slate-700 font-bold border-b border-[#E5E7EB] h-[46px] select-none text-[12.5px]">
                <th className="p-3 text-center w-10">#</th>
                <th className="p-3 font-extrabold text-[#111827]">{isAr ? 'رقم الفاتورة / الاسترجاع' : 'Refund Voucher #'}</th>
                <th className="p-3 text-center">{isAr ? 'المسافرون' : 'Passengers'}</th>
                <th className="p-3">{isAr ? 'شركة الطيران و PNR' : 'Airline & PNR'}</th>
                <th className="p-3">{isAr ? 'المورد' : 'Supplier'}</th>
                <th className="p-3 text-left font-mono">{isAr ? 'المسترجع من الشراء' : 'Buy Refund'}</th>
                <th className="p-3 text-left font-mono text-rose-600">{isAr ? 'غرامة الطيران (-)' : 'Airline Penalty (-)'}</th>
                <th className="p-3">{isAr ? 'العميل' : 'Customer'}</th>
                <th className="p-3 text-left font-mono text-amber-700">{isAr ? 'استقطاع الشركة (-)' : 'Agency Retention (-)'}</th>
                <th className="p-3 text-left font-mono text-[#F45A0A]">{isAr ? 'الصافي للعميل' : 'Net to Customer'}</th>
                <th className="p-3 text-left font-mono text-[#078B61]">{isAr ? 'صافي الربح' : 'Net Profit'}</th>
                <th className="p-3 text-center">{isAr ? 'طريقة الدفع' : 'Payment'}</th>
                <th className="p-3 text-center">{isAr ? 'التاريخ والموظف' : 'Date & Issuer'}</th>
                <th className="p-3 text-center">{isAr ? 'التدقيق' : 'Audit'}</th>
                <th className="p-3 text-center w-12">{isAr ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={15} className="p-8 text-center text-slate-400 font-bold">
                    <div className="flex items-center justify-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#F45A0A] animate-ping" />
                      <span>{isAr ? 'جاري تحميل مستندات الاسترجاع...' : 'Loading refund records...'}</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedRefunds.length === 0 ? (
                <tr>
                  <td colSpan={15} className="p-12 text-center text-slate-400 space-y-2">
                    <RotateCcw size={38} className="mx-auto text-slate-300 stroke-1" />
                    <div className="font-bold text-sm text-slate-700">
                      {isAr ? 'لا توجد سجلات استرجاع تطابق عوامل التصفية' : 'No refund records found'}
                    </div>
                    <p className="text-xs text-slate-400">
                      {isAr ? 'يمكنك إنشاء طلب استرجاع جديد بالنقر على زر "+ طلب استرجاع جديد"' : 'Click "+ New Ticket Refund" to record a refund.'}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedRefunds.map((r, index) => {
                  const isUsd = (r.currency || 'IQD').toUpperCase() === 'USD';
                  const currLabel = isUsd ? '$' : 'د.ع';
                  const netSell = Math.abs(r.netSell ?? r.totalSell ?? 0);
                  const netBuy = Math.abs(r.netBuy ?? r.totalBuy ?? 0);
                  const totalBuy = Math.abs(r.totalBuy ?? 0);
                  const totalSell = Math.abs(r.totalSell ?? 0);
                  const airlineObj = findAirlineObj(r.airline);

                  const airlinePenalty =
                    r.passengers && r.passengers.some((p) => p.tax1 && p.tax1 > 0)
                      ? r.passengers.reduce((sum, p) => sum + (p.tax1 || 0), 0)
                      : Math.max(0, totalBuy - netBuy);

                  const profit = r.profit !== undefined && r.profit !== null ? r.profit : Math.max(0, totalSell - netSell - airlinePenalty);
                  const agencyRetention = profit;

                  return (
                    <tr key={r.id || r.invoiceNumber} className="hover:bg-[#FFF8F3] transition-colors group h-12">
                      {/* # Index */}
                      <td className="p-3 text-center font-mono font-bold text-slate-400 text-[11px]">
                        {(currentPage - 1) * pageSize + index + 1}
                      </td>

                      {/* Invoice # */}
                      <td className="p-3 font-mono font-extrabold text-[#111827] text-xs">
                        <span
                          onClick={() => {
                            setSelectedRefundToEdit(r);
                            setIsManualRefundMode(false);
                            setWorkspaceOpen(true);
                          }}
                          className="hover:text-[#F45A0A] transition-colors cursor-pointer"
                        >
                          {r.invoiceNumber}
                        </span>
                      </td>

                      {/* Passengers with Popover Preview */}
                      <td className="p-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <Popover position="top" withArrow shadow="md" radius="md">
                          <Popover.Target>
                            <button
                              type="button"
                              className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#F1F5F9] hover:bg-[#FFF3E8] hover:text-[#F45A0A] border border-slate-200/80 inline-flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <UsersRound size={13} className="text-slate-400" />
                              <span>{r.passengers?.length || 1} {isAr ? 'مسافر' : 'pax'}</span>
                            </button>
                          </Popover.Target>
                          <Popover.Dropdown className="p-2 space-y-1.5 min-w-[260px] max-w-[320px] font-sans shadow-lg rounded-xl" dir={direction}>
                            <div className="font-extrabold text-[11.5px] text-slate-700 border-b border-slate-100 pb-1.5 flex items-center justify-between">
                              <span>{isAr ? 'قائمة المسافرين المسترجعين:' : 'Refunded Passengers:'}</span>
                              <span className="text-[10px] bg-orange-50 text-[#F45A0A] border border-orange-200 px-2 py-0.5 rounded-full font-mono font-extrabold">
                                {r.passengers?.length || 1}
                              </span>
                            </div>
                            <div className="space-y-1.5 max-h-56 overflow-y-auto">
                              {(r.passengers && r.passengers.length > 0
                                ? r.passengers
                                : [{ id: 'p1', name: r.customerName || 'مسافر', ticketType: 'ADULT', ticketNumber: r.invoiceNumber, tax1: airlinePenalty, charge: agencyRetention }]
                              ).map((p, pIdx) => (
                                <div
                                  key={p.id || pIdx}
                                  className="p-2 rounded-lg bg-slate-50 hover:bg-orange-50/70 border border-slate-100 transition-all text-xs space-y-1"
                                >
                                  <div className="flex items-center justify-between gap-1.5">
                                    <span className="font-bold text-slate-900 truncate font-mono text-[11.5px]">
                                      {p.name || 'مسافر'}
                                    </span>
                                    <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                                      {p.ticketType === 'CHILD' ? (isAr ? 'طفل' : 'Child') : p.ticketType === 'INFANT' ? (isAr ? 'رضيع' : 'Infant') : (isAr ? 'بالغ' : 'Adult')}
                                    </span>
                                  </div>
                                  {p.ticketNumber && (
                                    <div className="flex items-center justify-between text-[10.5px] text-slate-500 font-mono">
                                      <span>{isAr ? 'تذكرة:' : 'Ticket:'} {p.ticketNumber}</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          navigator.clipboard.writeText(p.ticketNumber || '');
                                        }}
                                        className="text-slate-400 hover:text-[#F45A0A] transition-colors p-0.5"
                                        title={isAr ? 'نسخ رقم التذكرة' : 'Copy Ticket #'}
                                      >
                                        <Copy size={11} />
                                      </button>
                                    </div>
                                  )}
                                  <div className="grid grid-cols-2 gap-1 text-[10.5px] pt-0.5 border-t border-slate-200/60 font-mono">
                                    <div>
                                      <span className="text-slate-400 text-[9.5px]">{isAr ? 'غرامة: ' : 'Pen: '}</span>
                                      <span className="font-bold text-rose-600">{(p.tax1 || 0).toLocaleString()} {currLabel}</span>
                                    </div>
                                    <div className="text-left">
                                      <span className="text-slate-400 text-[9.5px]">{isAr ? 'استقطاع: ' : 'Ret: '}</span>
                                      <span className="font-bold text-amber-700">{(p.charge || 0).toLocaleString()} {currLabel}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </Popover.Dropdown>
                        </Popover>
                      </td>

                      {/* Airline & PNR & Route with Airline Logo */}
                      <td className="p-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {airlineObj?.logo ? (
                            <img
                              src={airlineObj.logo}
                              alt={r.airline || ''}
                              className="w-[28px] h-[28px] rounded-[7px] object-contain shrink-0 border border-slate-100 bg-white"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-[28px] h-[28px] rounded-[7px] bg-orange-50 text-[#F45A0A] flex items-center justify-center shrink-0 font-bold border border-orange-100">
                              <Plane size={14} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 text-xs truncate max-w-[120px]">
                              {airlineObj?.nameAr || r.airline || 'طيران دولي'}
                            </div>
                            <div className="flex items-center gap-1 text-[10.5px] text-slate-500 font-mono">
                              <span className="font-bold text-[#F45A0A]">{r.pnr || '—'}</span>
                              {r.route && (
                                <>
                                  <span>·</span>
                                  <span dir="ltr" className="text-[10px] text-slate-400">{r.route}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Supplier */}
                      <td className="p-3 font-bold text-slate-700 text-xs">
                        {r.supplierAccountName || r.supplierAccount || 'سستم فلاي'}
                      </td>

                      {/* Buy Refund */}
                      <td className="p-3 text-left font-mono font-black text-slate-900 tabular-nums text-xs">
                        {netBuy.toLocaleString()} <span className="text-[10px] font-sans font-normal text-slate-400">{currLabel}</span>
                      </td>

                      {/* Airline Penalty */}
                      <td className="p-3 text-left font-mono font-bold text-rose-600 tabular-nums text-xs">
                        {airlinePenalty.toLocaleString()} <span className="text-[10px] font-sans font-normal text-rose-400">{currLabel}</span>
                      </td>

                      {/* Customer */}
                      <td className="p-3 font-bold text-slate-900 text-xs">
                        {r.customerName || 'شركة السعدي'}
                      </td>

                      {/* Agency Retention */}
                      <td className="p-3 text-left font-mono font-bold text-amber-800 tabular-nums text-xs">
                        {agencyRetention.toLocaleString()} <span className="text-[10px] font-sans font-normal text-amber-600">{currLabel}</span>
                      </td>

                      {/* Net Customer Refund */}
                      <td className="p-3 text-left font-mono font-black text-[#F45A0A] tabular-nums text-xs">
                        {netSell.toLocaleString()} <span className="text-[10px] font-sans font-normal text-slate-400">{currLabel}</span>
                      </td>

                      {/* Realized Profit */}
                      <td className="p-3 text-left font-mono font-black tabular-nums text-xs text-[#078B61]">
                        {profit >= 0 ? `+${profit.toLocaleString()}` : profit.toLocaleString()} <span className="text-[10px] font-sans font-normal text-[#078B61]">{currLabel}</span>
                      </td>

                      {/* Payment Mode */}
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold ${
                          r.paymentType === 'CASH_HAND' || !r.paymentType
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {r.paymentType === 'CASH_HAND' || !r.paymentType ? (isAr ? 'نقدي' : 'Cash') : (isAr ? 'آجل' : 'Credit')}
                        </span>
                      </td>

                      {/* Date & Issuer */}
                      <td className="p-3 text-center text-xs">
                        <div className="font-mono text-slate-600 font-bold text-[11px]">
                          {formatDateShort(r.issueDate)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          {r.employeeName || 'علي جعفر'}
                        </div>
                      </td>

                      {/* Audit Check / Toggle */}
                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => toggleRefundAudit(r)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors cursor-pointer inline-flex items-center gap-1 ${
                            r.isAudited
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                          }`}
                        >
                          {r.isAudited ? <ShieldCheck size={13} /> : <AlertTriangle size={13} />}
                          <span>{r.isAudited ? (isAr ? 'مدقق' : 'Audited') : (isAr ? 'مراجعة' : 'Review')}</span>
                        </button>
                      </td>

                      {/* Actions Menu */}
                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <Menu shadow="md" width={180} position="bottom-end" radius="md">
                          <Menu.Target>
                            <button
                              type="button"
                              className="w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer mx-auto"
                            >
                              <MoreVertical size={16} />
                            </button>
                          </Menu.Target>
                          <Menu.Dropdown dir={direction}>
                            <Menu.Item
                              leftSection={<RotateCcw size={14} className="text-[#F45A0A]" />}
                              onClick={() => {
                                setSelectedRefundToEdit(r);
                                setIsManualRefundMode(false);
                                setWorkspaceOpen(true);
                              }}
                            >
                              {isAr ? 'تعديل / تفاصيل الاسترجاع' : 'Edit / View Refund'}
                            </Menu.Item>
                            <Menu.Item
                              leftSection={<Copy size={14} className="text-[#F45A0A]" />}
                              onClick={() => handleCopyPnr(r.pnr)}
                            >
                              {isAr ? 'نسخ PNR' : 'Copy PNR'}
                            </Menu.Item>
                            <Menu.Item
                              leftSection={<History size={14} className="text-blue-600" />}
                              onClick={() => {
                                setSelectedTicketForAudit(r);
                                setAuditModalOpened(true);
                              }}
                            >
                              {isAr ? 'سجل التدقيق والتعديلات' : 'Audit Trail History'}
                            </Menu.Item>
                            <Menu.Divider />
                            <Menu.Item
                              color="red"
                              leftSection={<Trash2 size={14} />}
                              onClick={() => handleDeleteRefund(r)}
                            >
                              {isAr ? 'حذف قيد الاسترجاع' : 'Delete Refund'}
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── 5. Table Footer & Summary Bar (Exact Match with TicketsPage) ── */}
        <div className="p-4 bg-[#F8FAFC] border-t border-[#E5E7EB] flex items-center justify-between flex-wrap gap-4 text-xs font-bold text-slate-700">
          
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-slate-500">
              {isAr ? `النتائج المطابقة: ${filteredRefunds.length} فاتورة` : `Matched: ${filteredRefunds.length} vouchers`}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500">
              {isAr ? `المسافرون: ${kpis.totalPassengers}` : `Passengers: ${kpis.totalPassengers}`}
            </span>
            <span className="text-slate-300">|</span>
            <span>
              {isAr ? 'إجمالي المبيعات المستردة:' : 'Total Refunds:'}{' '}
              <b className="font-mono text-slate-900 font-black">
                {kpis.totalSellIQD.toLocaleString()} د.ع
              </b>{' '}
              <b className="font-mono text-blue-700 font-black">
                ${kpis.totalSellUSD.toLocaleString()}
              </b>
            </span>
            <span className="text-slate-300">•</span>
            <span>
              {isAr ? 'تكلفة الشراء (الموردين):' : 'Supplier Recovery:'}{' '}
              <b className="font-mono text-slate-900 font-black">
                {kpis.totalBuyIQD.toLocaleString()} د.ع
              </b>{' '}
              <b className="font-mono text-slate-700 font-black">
                ${kpis.totalBuyUSD.toLocaleString()}
              </b>
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-[#078B61]">
              {isAr ? 'صافي الأرباح المحققة:' : 'Net Realized Profit:'}{' '}
              <b className="font-mono font-black text-[#078B61]">
                +{kpis.totalProfitIQD.toLocaleString()} د.ع
              </b>{' '}
              <b className="font-mono font-black text-[#078B61]">
                +${kpis.totalProfitUSD.toLocaleString()}
              </b>
            </span>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-[11px]">
              {isAr ? `عرض ${Math.min(filteredRefunds.length, pageSize)} من أصل ${filteredRefunds.length}` : `Showing ${Math.min(filteredRefunds.length, pageSize)} of ${filteredRefunds.length}`}
            </span>

            <div className="flex items-center gap-1 border border-slate-200 bg-white rounded-lg p-0.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
              >
                {direction === 'rtl' ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
              </button>
              <span className="font-mono text-[11px] px-1.5">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
              >
                {direction === 'rtl' ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* ── 6. Dedicated Full-Screen Refund Workspace ── */}
      <TicketRefundEditorWorkspace
        opened={workspaceOpen}
        onClose={() => setWorkspaceOpen(false)}
        onSuccess={fetchRefunds}
        initialData={selectedRefundToEdit}
        initialManualMode={isManualRefundMode}
      />

      {/* ── 7. Audit Log Modal ── */}
      <InvoiceAuditLogModal
        opened={auditModalOpened}
        onClose={() => setAuditModalOpened(false)}
        ticketNumber={selectedTicketForAudit?.invoiceNumber || ''}
        pnr={selectedTicketForAudit?.pnr || '—'}
        customerName={selectedTicketForAudit?.customerName || 'عميل'}
      />

    </div>
  );
};

export default RefundsPage;
