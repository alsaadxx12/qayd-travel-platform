import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { apiRequest } from '../api/client';
import { showSuccessNotification, showErrorNotification } from '../utils/notifications';
import { FinancialVoucherForm, readVoucherSplits } from '../components/vouchers/FinancialVoucherForm';
import {
  Button,
  Badge,
  Drawer,
  Modal,
  ActionIcon,
  Tooltip,
  Textarea,
  Loader,
  Menu,
} from '@mantine/core';
import {
  IconPlus,
  IconPrinter,
  IconEye,
  IconEdit,
  IconTrash,
  IconUser,
  IconAlertTriangle,
  IconCheck,
  IconArrowBackUp,
  IconFileInvoice,
  IconRefresh,
  IconHistory,
  IconArrowRight,
  IconCalendar,
  IconSearch,
  IconFilter,
  IconScale,
  IconArrowsExchange,
  IconDownload,
  IconDotsVertical,
  IconReceipt,
  IconArrowDownLeft,
  IconArrowUpRight,
  IconTicket,
  IconCoins,
} from '@tabler/icons-react';

/* ─────── Utility Functions ─────── */
const formatDateEn = (dateStr: string | Date | undefined): string => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr).split('T')[0] || '—';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatDateTimeEn = (dateStr: string | Date | undefined): string => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}`;
};

const fmtMoney = (val: number | string | undefined, curr = 'IQD'): string => {
  const n = Number(val || 0);
  if (n === 0) return '0.00';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: curr === 'USD' ? 2 : 2,
    maximumFractionDigits: 2,
  });
};

/* ─────── Status Helpers ─────── */
const statusMap: Record<string, { label: string; color: string; bg: string; text: string; border: string }> = {
  POSTED: { label: 'مرحّل', color: 'emerald', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  DRAFT: { label: 'مسودة', color: 'amber', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  REVERSED: { label: 'معكوس', color: 'red', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
};

/* ─────── Audit Log Entry Interface ─────── */
interface AuditLogEntry {
  id: string;
  action: string;
  actionLabel: string;
  fromStatus?: string;
  toStatus?: string;
  userName: string;
  timestamp: string;
  details?: string;
  icon: 'create' | 'edit' | 'post' | 'reverse' | 'delete' | 'status';
}

type FilterTab = 'ALL' | 'RECEIPT' | 'PAYMENT' | 'JOURNAL' | 'INVOICE' | 'REFUND';

export const JournalEntriesPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<any[]>([]);
  const [accountsMap, setAccountsMap] = useState<Record<string, string>>({});

  // Filter States
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState<'ALL' | 'IQD' | 'USD'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'POSTED' | 'DRAFT' | 'REVERSED'>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Detail Drawer
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Reverse Modal
  const [reverseModalOpen, setReverseModalOpen] = useState(false);
  const [reverseReason, setReverseReason] = useState('');

  // Delete Modal
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Edit Modal (FinancialVoucherForm)
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editVoucherId, setEditVoucherId] = useState<string | undefined>(undefined);
  const [editVoucherType, setEditVoucherType] = useState<'RECEIPT' | 'PAYMENT' | 'JOURNAL'>('JOURNAL');

  // Audit Log Drawer
  const [auditDrawerOpen, setAuditDrawerOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  /* ─────── Data Fetching ─────── */
  const fetchEntries = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) setLoading(true);
    try {
      const noCacheOpt = forceRefresh ? { noCache: true } : {};
      const [data, accounts] = await Promise.all([
        apiRequest('/api/journal-entries?limit=250', noCacheOpt),
        apiRequest('/api/accounts?lite=1', noCacheOpt).catch(() => []),
      ]);

      // Build accounts map for lookups
      const aMap: Record<string, string> = {};
      (accounts || []).forEach((a: any) => {
        aMap[a.id] = a.nameAr || a.nameEn || a.code || a.id;
      });
      setAccountsMap(aMap);

      // Enrich entries with computed fields
      const enriched = (data || []).map((entry: any, idx: number) => {
        const firstDebitLine = entry.lines?.find((l: any) => Number(l.debit) > 0);
        const firstCreditLine = entry.lines?.find((l: any) => Number(l.credit) > 0);
        const debitAccountName = firstDebitLine?.account?.nameAr || aMap[firstDebitLine?.accountId] || '—';
        const creditAccountName = firstCreditLine?.account?.nameAr || aMap[firstCreditLine?.accountId] || '—';
        const cashboxName = debitAccountName;
        const totalDebit = Number(entry.totalDebit || 0);
        const totalCredit = Number(entry.totalCredit || totalDebit);

        // Detect source type from reference or entry data
        let sourceType: 'RECEIPT' | 'PAYMENT' | 'EXPENSE' | 'JOURNAL' | 'INVOICE' | 'REFUND' = 'JOURNAL';
        const ref = String(entry.reference || entry.entryNumber || '');
        const desc = String(entry.description || '');
        const debitName = String(debitAccountName || '');
        const isExp = desc.includes('مصروف') || desc.includes('مصاريف') || debitName.includes('مصاريف') || debitName.includes('مصروف');

        if (ref.includes('RV-') || ref.includes('قبض') || entry.sourceType === 'RECEIPT') sourceType = 'RECEIPT';
        else if (isExp && (ref.includes('PV-') || ref.includes('دفع') || entry.sourceType === 'PAYMENT')) sourceType = 'EXPENSE';
        else if (ref.includes('PV-') || ref.includes('دفع') || entry.sourceType === 'PAYMENT') sourceType = 'PAYMENT';
        else if (ref.includes('TKT-') || ref.includes('VISA-') || ref.includes('تذكرة') || ref.includes('فيزا')) sourceType = 'INVOICE';
        else if (ref.includes('REF-') || ref.includes('استرجاع') || ref.includes('مرتجع')) sourceType = 'REFUND';

        // Detect currency
        let currency = 'IQD';
        if (entry.currency === 'USD' || desc.includes('$') || desc.includes('USD') || desc.includes('دولار')) {
          currency = 'USD';
        }

        const isUSD = currency === 'USD';
        const entryRate = Number(entry.exchangeRate) || 1;
        let displayDebit = totalDebit;
        let displayCredit = totalCredit;

        if (isUSD) {
          const debitsOrig = (entry.lines || [])
            .filter((l: any) => Number(l.debit) > 0)
            .map((l: any) => l.debitOriginal !== null && l.debitOriginal !== undefined ? Number(l.debitOriginal) : (entryRate > 1 ? Number(l.debit) / entryRate : Number(l.debit)));
          const creditsOrig = (entry.lines || [])
            .filter((l: any) => Number(l.credit) > 0)
            .map((l: any) => l.creditOriginal !== null && l.creditOriginal !== undefined ? Number(l.creditOriginal) : (entryRate > 1 ? Number(l.credit) / entryRate : Number(l.credit)));
          
          if (debitsOrig.length > 0) displayDebit = debitsOrig.reduce((a: number, b: number) => a + b, 0);
          if (creditsOrig.length > 0) displayCredit = creditsOrig.reduce((a: number, b: number) => a + b, 0);
        }

        const { cleanDescription } = readVoucherSplits(entry.description);

        return {
          ...entry,
          _idx: idx + 1,
          dateFormatted: formatDateEn(entry.date || entry.createdAt),
          totalDebit: displayDebit,
          totalCredit: displayCredit,
          postedAmountIQD: totalDebit,
          debitAccountName,
          creditAccountName,
          cashboxName,
          sourceType,
          currency,
          exchangeRate: entryRate,
          cleanDescription: cleanDescription || entry.description || '—',
          userName: entry.createdBy?.name || entry.createdBy?.fullName || entry.createdBy?.email || 'علي جعفر محمود',
          sourceVoucherId: entry.receiptVoucherId || entry.paymentVoucherId || null,
        };
      }).sort((a: any, b: any) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());

      setEntries(enriched);
    } catch (err) {
      console.error('Error fetching journal entries:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  /* ─────── Filtered Data ─────── */
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      // Tab filter
      if (activeTab === 'RECEIPT' && e.sourceType !== 'RECEIPT') return false;
      if (activeTab === 'PAYMENT' && e.sourceType !== 'PAYMENT' && e.sourceType !== 'EXPENSE') return false;
      if (activeTab === 'JOURNAL' && e.sourceType !== 'JOURNAL') return false;
      if (activeTab === 'INVOICE' && e.sourceType !== 'INVOICE') return false;
      if (activeTab === 'REFUND' && e.sourceType !== 'REFUND') return false;

      // Status filter
      if (statusFilter !== 'ALL' && e.status !== statusFilter) return false;

      // Currency filter
      if (currencyFilter !== 'ALL' && e.currency !== currencyFilter) return false;

      // Date range filter
      if (startDate && e.dateFormatted < startDate) return false;
      if (endDate && e.dateFormatted > endDate) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const num = String(e.entryNumber || '').toLowerCase();
        const ref = String(e.reference || '').toLowerCase();
        const desc = String(e.cleanDescription || '').toLowerCase();
        const debit = String(e.debitAccountName || '').toLowerCase();
        const credit = String(e.creditAccountName || '').toLowerCase();
        const user = String(e.userName || '').toLowerCase();
        const amt = String(e.totalDebit || '');

        if (
          !num.includes(q) &&
          !ref.includes(q) &&
          !desc.includes(q) &&
          !debit.includes(q) &&
          !credit.includes(q) &&
          !user.includes(q) &&
          !amt.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [entries, activeTab, statusFilter, currencyFilter, startDate, endDate, searchQuery]);

  // Paginated Data
  const totalPages = Math.ceil(filteredEntries.length / pageSize) || 1;
  const pagedEntries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEntries.slice(start, start + pageSize);
  }, [filteredEntries, currentPage, pageSize]);

  /* ─────── Summary Stats ─────── */
  const stats = useMemo(() => {
    let totalDebitIQD = 0;
    let totalDebitUSD = 0;
    let postedCount = 0;
    let draftCount = 0;
    let reversedCount = 0;

    entries.forEach((e) => {
      const amt = Number(e.totalDebit || 0);
      if (e.currency === 'USD') {
        totalDebitUSD += amt;
      } else {
        totalDebitIQD += amt;
      }
      if (e.status === 'POSTED') postedCount++;
      else if (e.status === 'DRAFT') draftCount++;
      else if (e.status === 'REVERSED') reversedCount++;
    });

    return {
      totalDebitIQD,
      totalDebitUSD,
      postedCount,
      draftCount,
      reversedCount,
      totalCount: entries.length,
    };
  }, [entries]);

  /* ─────── Actions ─────── */
  const handlePostEntry = async (id: string) => {
    try {
      await apiRequest(`/api/journal-entries/${id}/post`, { method: 'POST' });
      showSuccessNotification('تم الترحيل بنجاح', 'تم ترحيل القيد وتحديث أرصدة الحسابات المالية.');
      fetchEntries(true);
    } catch (err: any) {
      showErrorNotification('خطأ في الترحيل', err.message || 'حدث خطأ أثناء ترحيل القيد');
    }
  };

  const handleReverseEntry = async () => {
    if (!selectedEntry) return;
    try {
      await apiRequest(`/api/journal-entries/${selectedEntry.id}/reverse`, {
        method: 'POST',
        body: JSON.stringify({ reason: reverseReason }),
      });
      showSuccessNotification('تم العكس بنجاح', `تم إنشاء قيد عكسي للقيد [${selectedEntry.entryNumber}].`);
      setReverseModalOpen(false);
      setReverseReason('');
      setDrawerOpen(false);
      fetchEntries(true);
    } catch (err: any) {
      showErrorNotification('خطأ في العكس', err.message || 'تعذر إنشاء القيد العكسي');
    }
  };

  const handleDeleteEntry = async () => {
    if (!entryToDelete) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/journal-entries/${entryToDelete.id}`, { method: 'DELETE' });
      showSuccessNotification(
        'تم الحذف بنجاح',
        `تم حذف القيد [${entryToDelete.entryNumber}] وإلغاء تأثيره المحاسبي.`
      );
      setEntries((prev) => prev.filter((e) => e.id !== entryToDelete.id));
      setDeleteConfirmOpen(false);
      setEntryToDelete(null);
    } catch (err: any) {
      showErrorNotification('خطأ في الحذف', err.message || 'تعذر حذف القيد');
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenEdit = (entry: any) => {
    if (entry.sourceVoucherId) {
      setEditVoucherId(entry.sourceVoucherId);
      setEditVoucherType(entry.sourceType === 'PAYMENT' ? 'PAYMENT' : 'RECEIPT');
      setEditModalOpen(true);
    } else {
      setEditVoucherId(entry.id);
      setEditVoucherType('JOURNAL');
      setEditModalOpen(true);
    }
  };

  const handleVoucherSaved = () => {
    setEditModalOpen(false);
    setEditVoucherId(undefined);
    fetchEntries(true);
  };

  /* ─────── Audit Log ─────── */
  const buildAuditLog = (entry: any): AuditLogEntry[] => {
    const logs: AuditLogEntry[] = [];
    logs.push({
      id: 'create',
      action: 'CREATE',
      actionLabel: 'إنشاء القيد المحاسبي',
      userName: entry.userName || '—',
      timestamp: entry.createdAt || entry.date,
      details: `تم إنشاء القيد برقم [${entry.entryNumber}] بقيمة ${fmtMoney(entry.totalDebit, entry.currency)} ${entry.currency}.`,
      icon: 'create',
    });

    if (entry.status === 'POSTED') {
      logs.push({
        id: 'post',
        action: 'POST',
        actionLabel: 'ترحيل القيد للحسابات',
        userName: entry.userName || '—',
        timestamp: entry.updatedAt || entry.createdAt,
        details: 'تم ترحيل القيد تلقائياً وتحديث أرصدة الحسابات في ميزان المراجعة.',
        icon: 'post',
      });
    }

    if (entry.updatedAt && entry.updatedAt !== entry.createdAt) {
      logs.push({
        id: 'update',
        action: 'UPDATE',
        actionLabel: 'تعديل بيانات القيد',
        userName: entry.userName || '—',
        timestamp: entry.updatedAt,
        details: 'تم تعديل مبالغ أو بنود القيد المحاسبي.',
        icon: 'edit',
      });
    }

    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  const handleOpenAuditLog = (entry: any) => {
    setSelectedEntry(entry);
    setAuditLogs(buildAuditLog(entry));
    setAuditDrawerOpen(true);
  };

  const renderSourceTypeBadge = (sourceType: string) => {
    switch (sourceType) {
      case 'RECEIPT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
            <IconArrowDownLeft size={11} />
            <span>سند قبض</span>
          </span>
        );
      case 'PAYMENT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[10px] bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
            <IconArrowUpRight size={11} />
            <span>سند صرف</span>
          </span>
        );
      case 'EXPENSE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[10px] bg-orange-50 text-[#F45A0A] border border-orange-200 shrink-0">
            <IconCoins size={11} />
            <span>سند دفع مصروف</span>
          </span>
        );
      case 'INVOICE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[10px] bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
            <IconTicket size={11} />
            <span>فاتورة مبيعات</span>
          </span>
        );
      case 'REFUND':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[10px] bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
            <IconArrowBackUp size={11} />
            <span>مرتجع</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
            <IconScale size={11} />
            <span>قيد يومية</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-3.5 w-full select-none" dir="rtl">
      {/* ═══ Header ═══ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F45A0A] shadow-2xs">
            <IconFileInvoice size={22} />
          </div>
          <div>
            <h1 className="font-extrabold text-base text-slate-900 leading-tight">دفتر القيود اليومية المحاسبية</h1>
            <p className="text-xs text-slate-500 font-medium">
              Journal Entries — سجل الحركات المالية المزدوجة والمرحّلة في دفتر اليومية
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="default"
            leftSection={<IconRefresh size={15} className={loading ? 'animate-spin' : ''} />}
            onClick={() => fetchEntries(true)}
            className="font-bold text-xs border-slate-200 hover:bg-slate-50"
          >
            تحديث
          </Button>

          <Button
            size="sm"
            color="orange"
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              setEditVoucherId(undefined);
              setEditVoucherType('JOURNAL');
              setEditModalOpen(true);
            }}
            className="font-extrabold text-xs bg-[#F45A0A] hover:bg-[#DD4F05] shadow-xs"
          >
            + قيد يومية جديد
          </Button>
        </div>
      </div>

      {/* ═══ Financial Metrics Summary Bar ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {/* Total Debit IQD */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold">
            <span>إجمالي المدين (IQD)</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          </div>
          <div className="mt-1 font-mono font-black text-sm text-emerald-800 tabular-nums lining-nums">
            {stats.totalDebitIQD.toLocaleString('en-US')} <span className="text-[10px] text-emerald-600 font-sans">د.ع</span>
          </div>
        </div>

        {/* Total Debit USD */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold">
            <span>إجمالي المدين (USD)</span>
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
          </div>
          <div className="mt-1 font-mono font-black text-sm text-blue-800 tabular-nums lining-nums">
            ${stats.totalDebitUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>

        {/* Balance Status */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold">
            <span>حالة التوازن المحاسبي</span>
            <IconCheck size={14} className="text-emerald-600" />
          </div>
          <div className="mt-1 flex items-center gap-1.5 font-bold text-xs text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>متوازن 100% (دائن = مدين)</span>
          </div>
        </div>

        {/* Total Entries */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold">
            <span>عدد القيود الكلي</span>
            <IconFileInvoice size={14} className="text-slate-400" />
          </div>
          <div className="mt-1 font-mono font-black text-sm text-slate-900 tabular-nums lining-nums">
            {stats.totalCount} <span className="text-[10px] text-slate-500 font-sans">قيد</span>
          </div>
        </div>

        {/* Posted */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold">
            <span>القيود المرحلة</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          </div>
          <div className="mt-1 font-mono font-black text-sm text-emerald-700 tabular-nums lining-nums">
            {stats.postedCount} <span className="text-[10px] text-slate-500 font-sans">مرحّل</span>
          </div>
        </div>

        {/* Drafts & Reversed */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold">
            <span>المسودات والمعكوسة</span>
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          </div>
          <div className="mt-1 font-mono font-black text-sm text-amber-800 tabular-nums lining-nums">
            {stats.draftCount + stats.reversedCount} <span className="text-[10px] text-slate-500 font-sans">حركة</span>
          </div>
        </div>
      </div>

      {/* ═══ Filter Tabs & Search Controls ═══ */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        {/* Source Type Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-100">
          {[
            { key: 'ALL', label: 'كافة القيود', count: entries.length },
            { key: 'RECEIPT', label: 'سندات القبض', count: entries.filter((e) => e.sourceType === 'RECEIPT').length },
            { key: 'PAYMENT', label: 'سندات الصرف', count: entries.filter((e) => e.sourceType === 'PAYMENT' || e.sourceType === 'EXPENSE').length },
            { key: 'JOURNAL', label: 'قيود اليومية العامة', count: entries.filter((e) => e.sourceType === 'JOURNAL').length },
            { key: 'INVOICE', label: 'فواتير المبيعات', count: entries.filter((e) => e.sourceType === 'INVOICE').length },
            { key: 'REFUND', label: 'المرتجعات', count: entries.filter((e) => e.sourceType === 'REFUND').length },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveTab(tab.key as FilterTab);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all duration-150 flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeTab === tab.key
                  ? 'bg-[#F45A0A] text-white shadow-2xs'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold tabular-nums ${
                  activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search and Filters Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
          {/* Search Input */}
          <div className="md:col-span-5 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="البحث برقم القيد، المرجع، البيان، الحساب، أو المبلغ..."
              className="w-full h-9 ps-9 pe-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#F45A0A] focus:bg-white transition-colors"
            />
            <IconSearch size={15} className="absolute start-3 top-2.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Date Filters */}
          <div className="md:col-span-4 flex items-center gap-1.5">
            <div className="flex items-center gap-1 flex-1">
              <span className="text-[11px] font-bold text-slate-500 shrink-0">من:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-9 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-[#F45A0A]"
              />
            </div>
            <div className="flex items-center gap-1 flex-1">
              <span className="text-[11px] font-bold text-slate-500 shrink-0">إلى:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-9 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-[#F45A0A]"
              />
            </div>
          </div>

          {/* Currency Toggle & Reset */}
          <div className="md:col-span-3 flex items-center gap-2 justify-end">
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs font-bold">
              {(['ALL', 'IQD', 'USD'] as const).map((curr) => (
                <button
                  key={curr}
                  type="button"
                  onClick={() => {
                    setCurrencyFilter(curr);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    currencyFilter === curr ? 'bg-[#F45A0A] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {curr === 'ALL' ? 'الكل' : curr}
                </button>
              ))}
            </div>

            {(searchQuery || startDate || endDate || currencyFilter !== 'ALL' || statusFilter !== 'ALL') && (
              <Button
                size="xs"
                variant="subtle"
                color="red"
                onClick={() => {
                  setSearchQuery('');
                  setStartDate('');
                  setEndDate('');
                  setCurrencyFilter('ALL');
                  setStatusFilter('ALL');
                }}
                className="text-[11px] font-bold"
              >
                مسح
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Main Data Table ═══ */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            {/* Table Header */}
            <thead>
              <tr className="bg-[#F8FAFC] border-b-2 border-slate-200 text-slate-800 font-extrabold text-[11px] h-11 [&_th]:px-3 [&_th]:py-2.5 [&_th]:border-e [&_th]:border-slate-200/80 [&_th]:text-center">
                <th className="w-10 text-slate-500 font-mono">#</th>
                <th className="w-28">نوع القيد</th>
                <th className="w-44">رقم القيد / المرجع</th>
                <th className="w-28 font-mono">التاريخ</th>
                <th className="w-16">العملة</th>
                <th className="min-w-[220px]">المبلغ والطرف المدين (من)</th>
                <th className="min-w-[220px]">المبلغ والطرف الدائن (إلى)</th>
                <th className="min-w-[240px]">البيان والشرح المحاسبي</th>
                <th className="w-20">الحالة</th>
                <th className="w-28">المنشئ</th>
                <th className="w-32">الإجراءات</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-200/80 [&_td]:px-3 [&_td]:py-2.5 [&_td]:border-e [&_td]:border-slate-200/70">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-20 text-center text-slate-500 font-bold bg-white">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Loader size="md" color="orange" />
                      <span className="text-sm font-bold text-slate-700">جارٍ تحميل القيود المحاسبية...</span>
                    </div>
                  </td>
                </tr>
              ) : pagedEntries.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-16 text-center text-slate-400 bg-white">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <IconFileInvoice size={36} className="text-slate-300" />
                      <span className="font-bold text-sm text-slate-600">لا توجد قيود يومية مطابقة للبحث</span>
                      <span className="text-xs text-slate-400">جرّب تغيير خيارات البحث أو التصفية</span>
                    </div>
                  </td>
                </tr>
              ) : (
                pagedEntries.map((row, idx) => {
                  const statusConf = statusMap[row.status] || statusMap.POSTED;
                  return (
                    <tr
                      key={row.id || idx}
                      onClick={() => {
                        setSelectedEntry(row);
                        setDrawerOpen(true);
                      }}
                      className="hover:bg-orange-50/20 transition-colors cursor-pointer group"
                    >
                      {/* 1. Sequence */}
                      <td className="text-center font-mono font-bold text-slate-400 text-[11px] tabular-nums">
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>

                      {/* 2. Source Type */}
                      <td className="text-center">{renderSourceTypeBadge(row.sourceType)}</td>

                      {/* 3. Entry Number */}
                      <td className="text-center font-mono font-extrabold text-slate-900 text-xs tabular-nums">
                        <span className="group-hover:text-[#F45A0A] transition-colors">{row.entryNumber}</span>
                        {row.reference && row.reference !== row.entryNumber && (
                          <span className="block text-[10px] text-slate-400 font-normal truncate max-w-[140px] mx-auto">
                            {row.reference}
                          </span>
                        )}
                      </td>

                      {/* 4. Date */}
                      <td className="text-center font-mono font-bold text-slate-600 text-[11px] tabular-nums">
                        {row.dateFormatted}
                      </td>

                      {/* 5. Currency */}
                      <td className="text-center">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-black ${
                            row.currency === 'USD'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {row.currency === 'USD' ? 'USD' : 'IQD'}
                        </span>
                      </td>

                      {/* 6. Debit Party (من) */}
                      <td>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                            <span className="font-bold text-slate-900 truncate text-xs" title={row.debitAccountName}>
                              {row.debitAccountName}
                            </span>
                          </div>
                          <span className="font-mono font-black text-xs text-emerald-700 tabular-nums lining-nums shrink-0">
                            {fmtMoney(row.totalDebit, row.currency)}
                          </span>
                        </div>
                      </td>

                      {/* 7. Credit Party (إلى) */}
                      <td>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
                            <span className="font-bold text-slate-900 truncate text-xs" title={row.creditAccountName}>
                              {row.creditAccountName}
                            </span>
                          </div>
                          <span className="font-mono font-black text-xs text-rose-700 tabular-nums lining-nums shrink-0">
                            {fmtMoney(row.totalCredit, row.currency)}
                          </span>
                        </div>
                      </td>

                      {/* 8. Description */}
                      <td>
                        <span className="block truncate text-slate-700 text-xs font-medium max-w-[260px]" title={row.cleanDescription}>
                          {row.cleanDescription}
                        </span>
                      </td>

                      {/* 9. Status */}
                      <td className="text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${statusConf.bg} ${statusConf.text} ${statusConf.border}`}
                        >
                          {statusConf.label}
                        </span>
                      </td>

                      {/* 10. User */}
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-1 text-slate-700 text-[11px] font-bold truncate">
                          <IconUser size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate">{row.userName}</span>
                        </div>
                      </td>

                      {/* 11. Actions */}
                      <td className="text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <Tooltip label="معاينة تفاصيل القيد" withArrow position="top">
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              color="blue"
                              onClick={() => {
                                setSelectedEntry(row);
                                setDrawerOpen(true);
                              }}
                            >
                              <IconEye size={15} />
                            </ActionIcon>
                          </Tooltip>

                          <Tooltip label="تعديل القيد" withArrow position="top">
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              color="orange"
                              onClick={() => handleOpenEdit(row)}
                            >
                              <IconEdit size={15} />
                            </ActionIcon>
                          </Tooltip>

                          <Tooltip label="طباعة القيد" withArrow position="top">
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              color="gray"
                              onClick={() => {
                                setSelectedEntry(row);
                                setTimeout(() => window.print(), 200);
                              }}
                            >
                              <IconPrinter size={15} />
                            </ActionIcon>
                          </Tooltip>

                          <Tooltip label="سجل التدقيق" withArrow position="top">
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              color="violet"
                              onClick={() => handleOpenAuditLog(row)}
                            >
                              <IconHistory size={15} />
                            </ActionIcon>
                          </Tooltip>

                          <Tooltip label="حذف القيد" withArrow position="top">
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              color="red"
                              onClick={() => {
                                setEntryToDelete(row);
                                setDeleteConfirmOpen(true);
                              }}
                            >
                              <IconTrash size={15} />
                            </ActionIcon>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Pagination */}
        <div className="p-3 bg-[#F8FAFC] border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-bold text-slate-600">
          <div className="flex items-center gap-2">
            <span>عرض {pagedEntries.length} من أصل {filteredEntries.length} قيد محاسبي</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="h-7 px-2 bg-white border border-slate-200 rounded text-xs font-mono font-bold text-slate-700 focus:outline-none focus:border-[#F45A0A]"
            >
              <option value={15}>15 صف</option>
              <option value={25}>25 صف</option>
              <option value={50}>50 صف</option>
              <option value={100}>100 صف</option>
            </select>
          </div>

          <div className="flex items-center gap-1 font-mono">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
            >
              السابق
            </button>

            <span className="px-2.5 py-1 text-slate-800">
              صفحة {currentPage} من {totalPages}
            </span>

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
            >
              التالي
            </button>
          </div>
        </div>
      </div>

      {/* ═══ Financial Voucher Form Modal (Edit / Create) ═══ */}
      <FinancialVoucherForm
        opened={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setEditVoucherId(undefined);
        }}
        onSuccess={handleVoucherSaved}
        initialVoucherType={editVoucherType}
        initialVoucherId={editVoucherId}
      />

      {/* ═══ Enhanced Entry Detail Drawer ═══ */}
      <Drawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={
          <div className="flex items-center gap-2 font-black text-sm text-slate-900">
            <IconFileInvoice size={18} className="text-[#F45A0A]" />
            <span>معاينة تفاصيل القيد اليومي المزدوج</span>
          </div>
        }
        position="left"
        size="lg"
      >
        {selectedEntry && (
          <div className="space-y-4 text-xs" dir="rtl">
            {/* Header Card */}
            <div className="p-3.5 bg-gradient-to-l from-slate-50 to-orange-50/40 border border-slate-200 rounded-xl flex justify-between items-center">
              <div>
                <span className="text-[10px] text-slate-500 font-bold block">رقم وتاريخ القيد</span>
                <div className="text-sm font-black text-slate-900 font-mono tabular-nums">
                  {selectedEntry.entryNumber}
                </div>
                <span className="text-[11px] text-slate-500 font-medium font-mono">{selectedEntry.dateFormatted}</span>
              </div>
              <div className="flex items-center gap-2">
                {renderSourceTypeBadge(selectedEntry.sourceType)}
                <Badge
                  color={(statusMap[selectedEntry.status] || {}).color || 'gray'}
                  size="sm"
                  className="font-bold"
                >
                  {(statusMap[selectedEntry.status] || {}).label || selectedEntry.status}
                </Badge>
              </div>
            </div>

            {/* Financial Totals */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 text-center">
                <div className="text-[11px] text-emerald-800 font-bold mb-1">المدين الإجمالي (Debit)</div>
                <div className="font-mono font-black text-base text-emerald-900 tabular-nums">
                  {fmtMoney(selectedEntry.totalDebit, selectedEntry.currency)}
                </div>
              </div>
              <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-3 text-center">
                <div className="text-[11px] text-rose-800 font-bold mb-1">الدائن الإجمالي (Credit)</div>
                <div className="font-mono font-black text-base text-rose-900 tabular-nums">
                  {fmtMoney(selectedEntry.totalCredit, selectedEntry.currency)}
                </div>
              </div>
            </div>

            {/* Meta Info */}
            <div className="p-3.5 border border-slate-200 rounded-xl space-y-2.5 bg-white">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500 block text-[10px] font-bold">المرجع</span>
                  <span className="font-mono font-bold text-slate-800">{selectedEntry.reference || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-bold">العملة</span>
                  <Badge size="xs" color={selectedEntry.currency === 'USD' ? 'blue' : 'orange'} variant="light" className="font-mono font-bold">
                    {selectedEntry.currency}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500 block text-[10px] font-bold">الحساب الأساسي</span>
                  <span className="font-bold text-slate-800">{selectedEntry.debitAccountName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-bold">موظف الإدخال</span>
                  <div className="flex items-center gap-1">
                    <IconUser size={12} className="text-slate-400" />
                    <span className="font-bold text-slate-800">{selectedEntry.userName}</span>
                  </div>
                </div>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px] font-bold">البيان والشرح المحاسبي</span>
                <p className="text-slate-800 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs font-medium mt-1">
                  {selectedEntry.cleanDescription || '—'}
                </p>
              </div>
            </div>

            {/* Accounting Lines Table */}
            <div>
              <span className="font-extrabold text-xs text-slate-900 block mb-2">أطراف وسطور القيد في دفتر اليومية:</span>
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 font-extrabold text-[11px]">
                      <th className="py-2.5 px-3 border-l border-slate-200">الحساب المالي</th>
                      <th className="py-2.5 px-3 border-l border-slate-200 text-emerald-800 text-center">المدين (Debit)</th>
                      <th className="py-2.5 px-3 border-l border-slate-200 text-rose-800 text-center">الدائن (Credit)</th>
                      <th className="py-2.5 px-3">البيان الفرعي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedEntry.lines?.map((line: any, idx: number) => (
                      <tr key={line.id || idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3 font-bold text-slate-800 border-l border-slate-100">
                          {line.account?.nameAr || accountsMap[line.accountId] || '—'}
                        </td>
                        <td className="py-2 px-3 border-l border-slate-100 font-mono tabular-nums font-bold text-emerald-800 text-center">
                          {Number(line.debit) > 0 ? fmtMoney(line.debit, selectedEntry.currency) : '—'}
                        </td>
                        <td className="py-2 px-3 border-l border-slate-100 font-mono tabular-nums font-bold text-rose-800 text-center">
                          {Number(line.credit) > 0 ? fmtMoney(line.credit, selectedEntry.currency) : '—'}
                        </td>
                        <td className="py-2 px-3 text-slate-600 font-medium">{line.description || '—'}</td>
                      </tr>
                    ))}
                    {/* Totals Row */}
                    <tr className="bg-slate-50 border-t-2 border-slate-300 font-black">
                      <td className="py-2 px-3 border-l border-slate-200 text-slate-900">المجموع المتوازن</td>
                      <td className="py-2 px-3 border-l border-slate-200 font-mono tabular-nums text-emerald-900 text-center">
                        {fmtMoney(selectedEntry.totalDebit, selectedEntry.currency)}
                      </td>
                      <td className="py-2 px-3 border-l border-slate-200 font-mono tabular-nums text-rose-900 text-center">
                        {fmtMoney(selectedEntry.totalCredit, selectedEntry.currency)}
                      </td>
                      <td className="py-2 px-3 font-bold text-emerald-700 text-center">متطابق 100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
              {selectedEntry.status === 'DRAFT' && (
                <Button
                  size="xs"
                  color="emerald"
                  leftSection={<IconCheck size={14} />}
                  onClick={() => handlePostEntry(selectedEntry.id)}
                  className="font-bold"
                >
                  ترحيل القيد
                </Button>
              )}
              {selectedEntry.status === 'POSTED' && (
                <Button
                  size="xs"
                  color="red"
                  variant="light"
                  leftSection={<IconArrowBackUp size={14} />}
                  onClick={() => setReverseModalOpen(true)}
                  className="font-bold"
                >
                  عكس القيد
                </Button>
              )}
              <Button
                size="xs"
                variant="outline"
                color="orange"
                leftSection={<IconEdit size={14} />}
                onClick={() => handleOpenEdit(selectedEntry)}
                className="font-bold"
              >
                تعديل
              </Button>
              <Button
                size="xs"
                variant="outline"
                color="gray"
                leftSection={<IconPrinter size={14} />}
                onClick={() => window.print()}
                className="font-bold"
              >
                طباعة
              </Button>
              <Button
                size="xs"
                variant="outline"
                color="violet"
                leftSection={<IconHistory size={14} />}
                onClick={() => handleOpenAuditLog(selectedEntry)}
                className="font-bold"
              >
                سجل التدقيق
              </Button>
            </div>
          </div>
        )}
      </Drawer>

      {/* ═══ Audit Log Drawer ═══ */}
      <Drawer
        opened={auditDrawerOpen}
        onClose={() => setAuditDrawerOpen(false)}
        title={
          <div className="flex items-center gap-2 font-black text-sm text-slate-900">
            <IconHistory size={18} className="text-violet-600" />
            <span>سجل التدقيق والتتبع — {selectedEntry?.entryNumber}</span>
          </div>
        }
        position="left"
        size="md"
      >
        <div className="space-y-3 text-xs" dir="rtl">
          {selectedEntry && (
            <div className="p-3 bg-violet-50/60 border border-violet-200 rounded-xl">
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-black text-sm text-slate-900 font-mono tabular-nums">{selectedEntry.entryNumber}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{selectedEntry.cleanDescription?.substring(0, 60) || '—'}</div>
                </div>
                <Badge color={(statusMap[selectedEntry.status] || {}).color || 'gray'} size="sm" className="font-bold">
                  {(statusMap[selectedEntry.status] || {}).label || selectedEntry.status}
                </Badge>
              </div>
            </div>
          )}

          <div className="space-y-0 pt-2">
            {auditLogs.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <IconHistory size={32} className="mx-auto mb-2 opacity-40" />
                <span className="font-bold block">لا يوجد سجل تدقيق لهذا القيد</span>
              </div>
            ) : (
              auditLogs.map((log, idx) => (
                <div key={log.id || idx} className="flex gap-3 relative pb-4">
                  {idx < auditLogs.length - 1 && (
                    <div className="absolute right-[15px] top-[30px] w-0.5 bg-slate-200 h-full" />
                  )}
                  <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center shrink-0 relative z-10 border border-white shadow-2xs font-bold">
                    <IconHistory size={15} />
                  </div>
                  <div className="flex-1 bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-black text-slate-900 text-xs">{log.actionLabel}</span>
                      <span className="text-[10px] text-slate-400 font-mono tabular-nums" dir="ltr">
                        {formatDateTimeEn(log.timestamp)}
                      </span>
                    </div>
                    {log.details && <p className="text-[11px] text-slate-600 leading-relaxed">{log.details}</p>}
                    <div className="flex items-center gap-1 mt-1 text-slate-500 text-[10px] font-medium">
                      <IconUser size={11} className="text-slate-400" />
                      <span>بواسطة: {log.userName}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Drawer>

      {/* ═══ Reverse Entry Modal ═══ */}
      <Modal
        opened={reverseModalOpen}
        onClose={() => setReverseModalOpen(false)}
        title={
          <div className="flex items-center gap-2 font-black text-sm text-red-600">
            <IconArrowBackUp size={18} />
            <span>عكس قيد محاسبي (Reversing Entry)</span>
          </div>
        }
        size="md"
        centered
        radius="lg"
      >
        <div className="space-y-3 text-xs" dir="rtl">
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-950 space-y-1">
            <p className="font-bold">سيتم إنشاء قيد عكسي جديد لإلغاء تأثير القيد:</p>
            <p className="font-mono font-black text-sm">{selectedEntry?.entryNumber}</p>
            <p className="text-[11px] text-red-700">المبلغ: {fmtMoney(selectedEntry?.totalDebit, selectedEntry?.currency)} — سيتم تحديث أرصدة الحسابات تلقائياً.</p>
          </div>
          <Textarea
            label="سبب عكس القيد"
            placeholder="اكتب سبب العكس أو التصحيح..."
            value={reverseReason}
            onChange={(e) => setReverseReason(e.target.value)}
            minRows={2}
          />
          <div className="pt-2 flex justify-end gap-2">
            <Button variant="light" color="gray" onClick={() => setReverseModalOpen(false)} size="xs">
              إلغاء
            </Button>
            <Button color="red" onClick={handleReverseEntry} size="xs" leftSection={<IconArrowBackUp size={14} />} className="font-bold">
              تأكيد عكس القيد
            </Button>
          </div>
        </div>
      </Modal>

      {/* ═══ Delete Confirmation Modal ═══ */}
      <Modal
        opened={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title={
          <div className="flex items-center gap-2 font-black text-sm text-red-600">
            <IconAlertTriangle size={18} />
            <span>تأكيد حذف القيد المحاسبي</span>
          </div>
        }
        size="md"
        centered
        radius="lg"
      >
        <div className="space-y-3.5 text-xs" dir="rtl">
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-950 space-y-1">
            <p className="font-bold">هل أنت متأكد من رغبتك في حذف هذا القيد نهائياً؟</p>
            <p className="text-[11px] text-red-700">
              سيتم حذف القيد وإلغاء تأثيره على أرصدة الحسابات المتأثرة بالكامل.
            </p>
          </div>

          {entryToDelete && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">رقم القيد:</span>
                <span className="font-mono font-black text-slate-900">{entryToDelete.entryNumber}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">المدين:</span>
                <span className="font-mono font-black text-emerald-800">{fmtMoney(entryToDelete.totalDebit, entryToDelete.currency)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">الدائن:</span>
                <span className="font-mono font-black text-rose-800">{fmtMoney(entryToDelete.totalCredit, entryToDelete.currency)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">موظف الإدخال:</span>
                <span className="font-bold text-slate-800">{entryToDelete.userName}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold block mb-0.5">البيان:</span>
                <p className="text-slate-700 bg-white p-2 rounded border border-slate-200 text-[11px]">
                  {entryToDelete.cleanDescription || '—'}
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <Button size="xs" variant="default" onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>
              إلغاء
            </Button>
            <Button
              size="xs"
              color="red"
              loading={deleting}
              leftSection={<IconTrash size={14} />}
              onClick={handleDeleteEntry}
              className="font-bold shadow-2xs"
            >
              تأكيد الحذف النهائي
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
