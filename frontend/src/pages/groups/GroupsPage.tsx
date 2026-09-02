import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Users,
  Plus,
  RefreshCw,
  Search,
  Plane,
  Coins,
  TrendingUp,
  Calendar,
  Edit,
  Trash2,
  Copy,
  Layers,
  Sparkles,
  Building2,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Armchair,
  Filter,
  Receipt,
  Eye,
  ExternalLink,
} from 'lucide-react';
import { Loader, Modal, Tooltip, SegmentedControl, Badge } from '@mantine/core';
import { AccountingGrid, AccountingColumnDef, AccountingActionMenuItem } from '../../components/common/AccountingGrid';
import { GroupFareEditorWorkspace } from '../../components/tickets/GroupFareEditorWorkspace';
import { GroupDesignWorkspace } from '../../components/groups/GroupDesignWorkspace';
import { matchesSearchTokens } from '../../components/ui/SearchableCombobox';
import { ticketsApi, TicketData } from '../../api/tickets';
import { showSuccessNotification, showErrorNotification, showInfoNotification } from '../../utils/notifications';
import { useLanguageStore } from '../../store/useLanguageStore';

const GROUP_TRIP_TYPE = 'GROUP_FARE';

const formatEnglishNumber = (num: number, decimals = 0): string => {
  if (isNaN(num) || num === null || num === undefined) return '0';
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export const GroupsPage: React.FC = () => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  const [rows, setRows] = useState<TicketData[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'POSTED' | 'DRAFT'>('ALL');
  const [currencyFilter, setCurrencyFilter] = useState<'ALL' | 'IQD' | 'USD'>('ALL');

  // Workspaces State
  const [groupFareWorkspaceOpen, setGroupFareWorkspaceOpen] = useState(false);
  const [groupDesignWorkspaceOpen, setGroupDesignWorkspaceOpen] = useState(false);
  const [editing, setEditing] = useState<TicketData | null>(null);
  const [opening, setOpening] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TicketData | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await ticketsApi.getAll({ limit: 300 });
      const list = (Array.isArray(all) ? all : []).filter(
        (t: any) => String(t.tripType || '').toUpperCase() === GROUP_TRIP_TYPE,
      );
      setRows(list);
    } catch (err: any) {
      showErrorNotification(
        isAr ? 'تعذّر جلب الكروبات' : 'Could not load groups',
        err?.message || (isAr ? 'فشل الاتصال بالخادم' : 'Request failed'),
      );
    } finally {
      setLoading(false);
    }
  }, [isAr]);

  useEffect(() => {
    load();
  }, [load]);

  // Filtered rows by search, status, and currency
  const filtered = useMemo(() => {
    return rows.filter((t: any) => {
      // Status filter
      if (statusFilter === 'POSTED' && String(t.status || '').toUpperCase() !== 'POSTED') return false;
      if (statusFilter === 'DRAFT' && String(t.status || '').toUpperCase() === 'POSTED') return false;

      // Currency filter
      if (currencyFilter !== 'ALL' && (t.currency || 'IQD') !== currencyFilter) return false;

      // Text Search
      if (search.trim()) {
        const matches = matchesSearchTokens(
          [
            t.invoiceNumber,
            t.pnr,
            t.customerName,
            t.supplierAccountName,
            t.airline,
            t.route,
            t.employeeName,
            t.notes,
          ]
            .filter(Boolean)
            .join(' '),
          search,
        );
        if (!matches) return false;
      }

      return true;
    });
  }, [rows, search, statusFilter, currencyFilter]);

  // High-level KPI Totals
  const totals = useMemo(() => {
    let count = filtered.length;
    let postedCount = 0;
    let draftCount = 0;
    let seats = 0;

    let sellUSD = 0;
    let sellIQD = 0;
    let buyUSD = 0;
    let buyIQD = 0;
    let profitUSD = 0;
    let profitIQD = 0;

    filtered.forEach((t: any) => {
      const isPosted = String(t.status || '').toUpperCase() === 'POSTED';
      if (isPosted) postedCount++;
      else draftCount++;

      // Seat / passenger count
      const pCount = (t.passengers || []).length || Number(t.paxCount || 0) || 1;
      seats += pCount;

      const curr = t.currency === 'USD' ? 'USD' : 'IQD';
      const tSell = Number(t.netSell ?? t.totalSell ?? 0);
      const tBuy = Number(t.netBuy ?? t.totalBuy ?? 0);
      const tProfit = Number(t.profit ?? (tSell - tBuy));

      if (curr === 'USD') {
        sellUSD += tSell;
        buyUSD += tBuy;
        profitUSD += tProfit;
      } else {
        sellIQD += tSell;
        buyIQD += tBuy;
        profitIQD += tProfit;
      }
    });

    const avgSeatsPerGroup = count > 0 ? Math.round((seats / count) * 10) / 10 : 0;
    const profitMargin = (sellUSD + sellIQD) > 0 ? Math.round(((profitUSD + profitIQD) / (sellUSD + sellIQD)) * 100) : 0;

    return {
      count,
      postedCount,
      draftCount,
      seats,
      avgSeatsPerGroup,
      sellUSD,
      sellIQD,
      buyUSD,
      buyIQD,
      profitUSD,
      profitIQD,
      profitMargin,
    };
  }, [filtered]);

  // Open Group Fare Editor
  const openFareEditor = async (row?: TicketData) => {
    if (!row) {
      setEditing(null);
      setGroupFareWorkspaceOpen(true);
      return;
    }
    setOpening(true);
    try {
      const full = await ticketsApi.getOne(row.id as string).catch(() => row);
      setEditing(full || row);
      setGroupFareWorkspaceOpen(true);
    } finally {
      setOpening(false);
    }
  };

  // Open Tour Package Designer
  const openDesignEditor = async (row?: TicketData) => {
    if (!row) {
      setEditing(null);
      setGroupDesignWorkspaceOpen(true);
      return;
    }
    setOpening(true);
    try {
      const full = await ticketsApi.getOne(row.id as string).catch(() => row);
      setEditing(full || row);
      setGroupDesignWorkspaceOpen(true);
    } finally {
      setOpening(false);
    }
  };

  // Copy PNR helper
  const handleCopyText = (text: string, label: string) => {
    if (!text || text === '—') return;
    navigator.clipboard.writeText(text);
    showSuccessNotification(
      isAr ? 'تم النسخ' : 'Copied',
      isAr ? `تم نسخ ${label} (${text}) بنجاح.` : `Copied ${label} (${text}) to clipboard.`,
    );
  };

  // Confirm Delete
  const confirmDelete = async () => {
    if (!deleteTarget?.id) return;
    const removed = deleteTarget;
    setDeleting(true);
    setRows((prev) => prev.filter((t) => t.id !== removed.id));
    setDeleteTarget(null);
    try {
      await ticketsApi.delete(removed.id as string);
      showSuccessNotification(
        isAr ? 'تم الحذف' : 'Deleted',
        isAr ? `حُذف الكروب ${removed.invoiceNumber || ''} وقيده المحاسبي بنجاح.` : `Group ${removed.invoiceNumber || ''} deleted successfully.`,
      );
    } catch (err: any) {
      setRows((prev) => (prev.some((t) => t.id === removed.id) ? prev : [removed, ...prev]));
      showErrorNotification(
        isAr ? 'تعذّر الحذف' : 'Delete failed',
        err?.message || (isAr ? 'لم يُحذف الكروب' : 'The group was not deleted'),
      );
    } finally {
      setDeleting(false);
    }
  };

  // Accounting Grid Column Definitions
  const columnDefs: AccountingColumnDef[] = useMemo(
    () => [
      {
        field: 'invoiceNumber',
        headerText: isAr ? 'رقم الكروب والـ PNR' : 'Group No. & PNR',
        width: 'w-44',
        isPinned: true,
        render: (r) => (
          <div className="flex items-center gap-2 py-0.5">
            <div className="w-8 h-8 rounded-lg bg-[#FFF3E8] border border-[#FED7AA] text-[#F45A0A] flex items-center justify-center shrink-0 font-bold">
              <Layers size={15} />
            </div>
            <div className="leading-tight min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-black text-[12px] text-slate-900 select-all" dir="ltr">
                  {r.invoiceNumber || '—'}
                </span>
                {r.pnr && (
                  <Tooltip label={isAr ? 'نسخ PNR' : 'Copy PNR'} withArrow position="top">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyText(r.pnr, 'PNR');
                      }}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-orange-100 hover:text-[#F45A0A] text-slate-700 font-mono font-bold text-[10.5px] border border-slate-200 transition-colors cursor-pointer"
                      dir="ltr"
                    >
                      {r.pnr}
                    </button>
                  </Tooltip>
                )}
              </div>
              <span className="text-[10.5px] font-mono text-slate-400 block mt-0.5" dir="ltr">
                {r.issueDate ? new Date(r.issueDate).toLocaleDateString('en-GB') : ''}
              </span>
            </div>
          </div>
        ),
      },
      {
        field: 'customerName',
        headerText: isAr ? 'المستفيد (العميل)' : 'Beneficiary / Customer',
        isWide: true,
        render: (r) => (
          <div className="flex items-center gap-2 py-0.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center shrink-0 font-bold text-xs">
              {(r.customerName || 'ع')[0]}
            </div>
            <div className="leading-tight min-w-0">
              <span className="font-bold text-[12.5px] text-slate-900 block truncate">
                {r.customerName || (isAr ? '— بلا عميل —' : '— No Customer —')}
              </span>
              {r.supplierAccountName && (
                <span className="text-[10.5px] font-medium text-slate-500 block truncate mt-0.5">
                  <span className="text-slate-400">{isAr ? 'المورد: ' : 'Supplier: '}</span>
                  {r.supplierAccountName}
                </span>
              )}
            </div>
          </div>
        ),
      },
      {
        field: 'route',
        headerText: isAr ? 'المسار وشركة الطيران' : 'Route & Airline',
        width: 'w-48',
        render: (r) => (
          <div className="leading-tight min-w-0 py-0.5">
            <div className="flex items-center gap-1.5">
              <Plane size={13} className="text-[#F45A0A] shrink-0 rotate-45" />
              <span className="font-mono font-black text-[12px] text-slate-800 uppercase truncate" dir="ltr">
                {r.route || '—'}
              </span>
            </div>
            {r.airline && (
              <span className="text-[11px] font-semibold text-slate-500 block truncate mt-0.5">
                {r.airline}
              </span>
            )}
          </div>
        ),
      },
      {
        field: 'travelDate',
        headerText: isAr ? 'تاريخ السفر' : 'Travel Date',
        width: 'w-32',
        align: 'center',
        render: (r) =>
          r.travelDate ? (
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 font-mono font-bold text-[11px] text-slate-800" dir="ltr">
              <Calendar size={12} className="text-slate-500" />
              <span>{new Date(r.travelDate as any).toLocaleDateString('en-GB')}</span>
            </div>
          ) : (
            <span className="text-slate-300 font-mono">—</span>
          ),
      },
      {
        field: 'seats',
        headerText: isAr ? 'المقاعد' : 'Seats',
        width: 'w-24',
        align: 'center',
        render: (r) => {
          const seats = (r.passengers || []).length || Number((r as any).paxCount || 0) || 1;
          return (
            <span className="inline-flex items-center gap-1.5 text-[11.5px] font-mono font-black bg-orange-50 text-[#F45A0A] border border-orange-200 rounded-lg px-2.5 py-1">
              <Armchair size={13} className="text-[#F45A0A]" />
              <span>{seats}</span>
              <span className="text-[10px] font-sans font-semibold">{isAr ? 'مقعد' : 'pax'}</span>
            </span>
          );
        },
      },
      {
        field: 'netSell',
        headerText: isAr ? 'المبيعات' : 'Sales (Sell)',
        width: 'w-36',
        align: 'left',
        isMonetary: true,
        render: (r) => {
          const val = Number(r.netSell ?? r.totalSell ?? 0);
          const curr = r.currency === 'USD' ? '$' : (isAr ? 'د.ع' : 'IQD');
          return (
            <div className="leading-tight py-0.5" dir="ltr">
              <span className="font-mono font-black text-[13px] text-slate-900 block tabular-nums">
                {r.currency === 'USD' ? `$${formatEnglishNumber(val, 2)}` : `${formatEnglishNumber(val)} ${curr}`}
              </span>
            </div>
          );
        },
      },
      {
        field: 'profit',
        headerText: isAr ? 'صافي الربح' : 'Net Profit',
        width: 'w-36',
        align: 'left',
        isMonetary: true,
        render: (r) => {
          const p = Number(r.profit ?? 0);
          const curr = r.currency === 'USD' ? '$' : (isAr ? 'د.ع' : 'IQD');
          const isPos = p > 0;
          const isNeg = p < 0;

          return (
            <div className="leading-tight py-0.5" dir="ltr">
              <span
                className={`font-mono font-black text-[13px] block tabular-nums ${
                  isPos ? 'text-[#078B61]' : isNeg ? 'text-red-600' : 'text-slate-600'
                }`}
              >
                {isPos ? '+' : ''}
                {r.currency === 'USD' ? `${p < 0 ? '-' : ''}$${formatEnglishNumber(Math.abs(p), 2)}` : `${formatEnglishNumber(p)} ${curr}`}
              </span>
            </div>
          );
        },
      },
      {
        field: 'status',
        headerText: isAr ? 'الحالة' : 'Status',
        width: 'w-24',
        align: 'center',
        render: (r) => {
          const posted = String(r.status || '').toUpperCase() === 'POSTED';
          return (
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full border shadow-2xs ${
                posted
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              {posted ? <CheckCircle2 size={11} /> : <Clock size={11} />}
              <span>{posted ? (isAr ? 'مرحَّل' : 'Posted') : isAr ? 'مسودة' : 'Draft'}</span>
            </span>
          );
        },
      },
    ],
    [isAr],
  );

  // Accounting Grid Action Menu
  const actionMenuItems: AccountingActionMenuItem[] = useMemo(
    () => [
      {
        label: isAr ? 'تعديل كروب فير' : 'Edit Group Fare',
        icon: Edit,
        description: isAr ? 'يفتح مساحة عمل حجز الكروب وتوزيع الـ PNRs' : 'Edit group fare and PNR lines',
        onClick: (row: any) => openFareEditor(row),
      },
      {
        label: isAr ? 'تصميم حزمة الكروب (سياحي)' : 'Design Tour Package',
        icon: Sparkles,
        description: isAr ? 'يفتح مصمم حزم البرامج والخدمات السياحية' : 'Tour package components designer',
        onClick: (row: any) => openDesignEditor(row),
      },
      {
        label: isAr ? 'حذف الكروب' : 'Delete Group',
        icon: Trash2,
        color: 'red',
        description: isAr ? 'يحذف الكروب وقيده المحاسبي المزدوج نهائياً' : 'Permanently remove group and journal entry',
        onClick: (row: any) => setDeleteTarget(row),
      },
    ],
    [isAr],
  );

  return (
    <div
      className="w-full max-w-[1760px] mx-auto px-3 sm:px-6 py-3 sm:py-5 select-none font-sans space-y-3.5 bg-[#F7F8FA] min-h-screen"
      dir={direction}
      style={{ fontFamily: language === 'ar' ? "'IBM Plex Sans Arabic', system-ui, sans-serif" : "'IBM Plex Sans', system-ui, sans-serif" }}
    >
      {/* ── 1. TOP HEADER HERO BANNER ── */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-3.5 sm:p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          
          {/* Page Identity & Badge */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#FFF3E8] border border-[#FED7AA] text-[#F45A0A] flex items-center justify-center shadow-2xs shrink-0">
              <Layers size={22} strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-base sm:text-lg text-[#111827] leading-tight">
                  {isAr ? 'تذاكر الكروبات (حجز جماعي)' : 'Group Fares & Charters'}
                </h1>
                <Badge
                  color="orange"
                  variant="light"
                  size="sm"
                  className="font-mono font-bold"
                  dir="ltr"
                >
                  {formatEnglishNumber(totals.count)} {isAr ? 'كروب' : 'groups'}
                </Badge>
              </div>
              <p className="text-[11.5px] text-[#6B7280] font-medium mt-0.5">
                {isAr
                  ? 'إدارة حجوزات المجموعات السياحية والـ PNRs، المقاعد، والموردين وصافي أرباح الرحلات'
                  : 'Manage group bookings, multi-PNR seat allocations, suppliers and flight profits'}
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2.5 flex-wrap">
            
            {/* Search Input with quick clear */}
            <div className="relative">
              <Search
                size={15}
                className="absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                style={{ insetInlineStart: 10 }}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isAr ? 'ابحث برقم الكروب، PNR، أو المستفيد...' : 'Search by group #, PNR, customer...'}
                className="h-[38px] w-60 sm:w-72 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] text-[12px] font-bold text-slate-900 outline-none hover:border-slate-300 focus:border-2 focus:border-[#F45A0A] focus:bg-white transition-all shadow-2xs"
                style={{ paddingInlineStart: 32, paddingInlineEnd: search ? 30 : 10 }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                  style={{ insetInlineEnd: 10 }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Status Segmented Control */}
            <SegmentedControl
              size="sm"
              radius="md"
              value={statusFilter}
              onChange={(val) => setStatusFilter(val as any)}
              data={[
                { value: 'ALL', label: isAr ? 'الكل' : 'All' },
                { value: 'POSTED', label: isAr ? 'مرحَّل' : 'Posted' },
                { value: 'DRAFT', label: isAr ? 'مسودات' : 'Drafts' },
              ]}
              className="bg-[#F1F5F9] border border-slate-200"
            />

            {/* Currency Filter */}
            <SegmentedControl
              size="sm"
              radius="md"
              value={currencyFilter}
              onChange={(val) => setCurrencyFilter(val as any)}
              data={[
                { value: 'ALL', label: isAr ? 'كافة العملات' : 'All Currencies' },
                { value: 'IQD', label: 'IQD' },
                { value: 'USD', label: 'USD' },
              ]}
              className="bg-[#F1F5F9] border border-slate-200"
            />

            {/* Refresh Button */}
            <Tooltip label={isAr ? 'تحديث السجلات' : 'Refresh'} withArrow position="bottom">
              <button
                type="button"
                onClick={load}
                disabled={loading}
                className="h-[38px] w-[38px] rounded-xl border border-[#E5E7EB] bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 cursor-pointer transition-colors flex items-center justify-center shadow-2xs disabled:opacity-50"
              >
                <RefreshCw size={15} className={loading ? 'animate-spin text-[#F45A0A]' : ''} />
              </button>
            </Tooltip>

            {/* New Group Button (Primary Brand Action) */}
            <button
              type="button"
              onClick={() => openFareEditor()}
              className="h-[38px] px-4 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] active:scale-[0.98] text-white font-black text-xs cursor-pointer transition-all flex items-center gap-1.5 shadow-xs"
            >
              <Plus size={16} strokeWidth={2.4} />
              <span>{isAr ? 'كروب فير جديد' : 'New Group Fare'}</span>
            </button>

          </div>
        </div>
      </div>

      {/* ── 2. KPI METRIC SUMMARY CARDS (Brand Pure White & Soft Accents) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-sans">
        
        {/* Card 1: Total Groups */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 shadow-2xs flex flex-col justify-between hover:border-orange-200 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-bold text-[#6B7280]">
              {isAr ? 'عدد الكروبات الإجمالي' : 'Total Groups'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#FFF3E8] border border-[#FED7AA] text-[#F45A0A] flex items-center justify-center shrink-0">
              <Users size={16} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black font-mono text-[#111827] tabular-nums" dir="ltr">
              {formatEnglishNumber(totals.count)}
            </div>
            <div className="flex items-center gap-2 mt-1 text-[11px] font-semibold text-slate-500">
              <span className="text-emerald-700 font-bold">✓ {totals.postedCount} {isAr ? 'مرحَّل' : 'posted'}</span>
              <span className="text-slate-300">•</span>
              <span className="text-amber-700 font-bold">⏱ {totals.draftCount} {isAr ? 'مسودة' : 'draft'}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Total Seats / Passengers */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 shadow-2xs flex flex-col justify-between hover:border-indigo-200 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-bold text-[#6B7280]">
              {isAr ? 'إجمالي المقاعد / المسافرين' : 'Total Seats & Pax'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0">
              <Armchair size={16} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black font-mono text-indigo-950 tabular-nums" dir="ltr">
              {formatEnglishNumber(totals.seats)} <span className="text-xs font-sans font-bold text-slate-500">{isAr ? 'مقعد' : 'seats'}</span>
            </div>
            <div className="mt-1 text-[11px] font-semibold text-slate-500">
              {isAr
                ? `متوسط المقاعد: ${totals.avgSeatsPerGroup} لكل حجز`
                : `Avg seats: ${totals.avgSeatsPerGroup} / group`}
            </div>
          </div>
        </div>

        {/* Card 3: Total Sales */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 shadow-2xs flex flex-col justify-between hover:border-sky-200 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-bold text-[#6B7280]">
              {isAr ? 'إجمالي المبيعات' : 'Total Sales (Revenue)'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center shrink-0">
              <Coins size={16} />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-baseline justify-between font-mono" dir="ltr">
              <span className="text-[11px] font-sans font-bold text-slate-500">$ USD:</span>
              <span className="font-black text-slate-900 text-base tabular-nums">
                ${formatEnglishNumber(totals.sellUSD, 2)}
              </span>
            </div>
            <div className="flex items-baseline justify-between font-mono" dir="ltr">
              <span className="text-[11px] font-sans font-bold text-slate-500">{isAr ? 'د.ع IQD:' : 'IQD:'}</span>
              <span className="font-black text-slate-900 text-base tabular-nums">
                {formatEnglishNumber(totals.sellIQD)} <span className="text-[10px] font-sans font-semibold text-slate-500">{isAr ? 'د.ع' : 'IQD'}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Net Realized Profit */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 shadow-2xs flex flex-col justify-between hover:border-emerald-200 transition-all">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] font-bold text-[#6B7280]">
                {isAr ? 'صافي الأرباح المحققة' : 'Net Realized Profit'}
              </span>
              {totals.profitMargin > 0 && (
                <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                  {totals.profitMargin}%
                </span>
              )}
            </div>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-baseline justify-between font-mono text-[#078B61]" dir="ltr">
              <span className="text-[11px] font-sans font-bold text-emerald-800">$ USD:</span>
              <span className="font-black text-base tabular-nums">
                {totals.profitUSD >= 0 ? '+' : ''}${formatEnglishNumber(totals.profitUSD, 2)}
              </span>
            </div>
            <div className="flex items-baseline justify-between font-mono text-[#078B61]" dir="ltr">
              <span className="text-[11px] font-sans font-bold text-emerald-800">{isAr ? 'د.ع IQD:' : 'IQD:'}</span>
              <span className="font-black text-base tabular-nums">
                {totals.profitIQD >= 0 ? '+' : ''}{formatEnglishNumber(totals.profitIQD)} <span className="text-[10px] font-sans font-semibold">{isAr ? 'د.ع' : 'IQD'}</span>
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* ── 3. MAIN DATA GRID ── */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden shadow-2xs">
        <AccountingGrid
          gridKey="group_fares_grid_v2"
          data={filtered}
          columnDefs={columnDefs}
          loading={loading}
          actionMenuItems={actionMenuItems}
          onRowDoubleClick={(row: any) => openFareEditor(row)}
          onRefresh={load}
          emptyMessage={
            isAr
              ? 'لا توجد كروبات مسجّلة حالياً — اضغط على «كروب فير جديد» لإضافة أول حجز جماعي.'
              : 'No group fares registered yet — click "New Group Fare" to add your first booking.'
          }
        />
      </div>

      {/* ── 4. Loading Overlay ── */}
      {opening && (
        <div className="fixed inset-0 z-9997 bg-slate-900/20 backdrop-blur-[2px] flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 px-6 py-4 flex items-center gap-3 text-sm font-bold text-slate-800">
            <Loader size="sm" color="orange" />
            <span>{isAr ? 'جارٍ فتح مساحة عمل الكروب بكامل تفاصيلها...' : 'Opening group workspace...'}</span>
          </div>
        </div>
      )}

      {/* ── 5. Workspaces ── */}
      <GroupFareEditorWorkspace
        opened={groupFareWorkspaceOpen}
        initialData={editing}
        onClose={() => {
          setGroupFareWorkspaceOpen(false);
          setEditing(null);
        }}
        onSuccess={() => {
          setGroupFareWorkspaceOpen(false);
          setEditing(null);
          load();
        }}
      />

      <GroupDesignWorkspace
        opened={groupDesignWorkspaceOpen}
        initialData={editing}
        onClose={() => {
          setGroupDesignWorkspaceOpen(false);
          setEditing(null);
        }}
        onSuccess={() => {
          setGroupDesignWorkspaceOpen(false);
          setEditing(null);
          load();
        }}
      />

      {/* ── 6. Delete Confirmation Modal ── */}
      <Modal
        opened={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        centered
        radius="lg"
        withCloseButton={false}
        overlayProps={{ backgroundOpacity: 0.35, blur: 2 }}
      >
        <div className="space-y-3 font-sans" dir={direction}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
              <Trash2 size={20} />
            </div>
            <div>
              <div className="text-sm font-black text-slate-900">
                {isAr ? 'تأكيد حذف الكروب نهائياً' : 'Delete Group Booking'}
              </div>
              <div className="text-xs text-slate-500 leading-relaxed mt-0.5">
                {isAr
                  ? 'سيتم حذف سجل الكروب وقيده المحاسبي وسجلات المسافرين المرافقة له نهائياً ولا يمكن التراجع.'
                  : 'The group record, its double-entry journal entry, and passengers will be permanently deleted.'}
              </div>
            </div>
          </div>

          {deleteTarget && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1.5 font-sans">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500 font-bold">{isAr ? 'رقم الكروب:' : 'Group #:'}</span>
                <span className="font-mono font-black text-slate-900" dir="ltr">
                  {deleteTarget.invoiceNumber}
                </span>
              </div>
              {deleteTarget.pnr && (
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 font-bold">PNR:</span>
                  <span className="font-mono font-bold text-[#F45A0A]" dir="ltr">
                    {deleteTarget.pnr}
                  </span>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <span className="text-slate-500 font-bold">{isAr ? 'المستفيد / العميل:' : 'Customer:'}</span>
                <span className="font-black text-slate-900">{deleteTarget.customerName || '—'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500 font-bold">{isAr ? 'إجمالي المبيعات:' : 'Total Sales:'}</span>
                <span className="font-mono font-black text-slate-900" dir="ltr">
                  {formatEnglishNumber(Number(deleteTarget.netSell ?? deleteTarget.totalSell ?? 0))} {deleteTarget.currency || 'IQD'}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer disabled:opacity-50"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={confirmDelete}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white text-xs font-black cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
            >
              <Trash2 size={14} />
              <span>{isAr ? 'حذف نهائي' : 'Delete'}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default GroupsPage;
