import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { apiRequest, invalidateApiCache } from '../api/client';
import { showSuccessNotification, showErrorNotification } from '../utils/notifications';
import { AccountingGrid, AccountingColumnDef, AccountingActionMenuItem } from '../components/common/AccountingGrid';
import { FinancialVoucherForm } from '../components/vouchers/FinancialVoucherForm';
import {
  Button,
  Badge,
  Drawer,
  Modal,
  ActionIcon,
  Tooltip,
  Textarea,
  Loader,
  Paper,
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
  IconCash,
  IconCalendar,
  IconHash,
  IconClipboardCheck,
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

const fmtMoney = (val: number | string | undefined): string => {
  const n = Number(val || 0);
  if (n === 0) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/* ─────── Status Helpers ─────── */
const statusMap: Record<string, { label: string; color: string }> = {
  POSTED: { label: 'مرحّل', color: 'emerald' },
  DRAFT: { label: 'مسودة', color: 'yellow' },
  REVERSED: { label: 'معكوس', color: 'red' },
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

export const JournalEntriesPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<any[]>([]);
  const [accountsMap, setAccountsMap] = useState<Record<string, string>>({});

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
  const [auditLoading, setAuditLoading] = useState(false);

  /* ─────── Data Fetching ─────── */
  const fetchEntries = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) setLoading(true);
    try {
      const noCacheOpt = forceRefresh ? { noCache: true } : {};
      const [data, accounts] = await Promise.all([
        apiRequest('/api/journal-entries?limit=150', noCacheOpt),
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
        let sourceType: 'RECEIPT' | 'PAYMENT' | 'JOURNAL' = 'JOURNAL';
        const ref = entry.reference || '';
        if (ref.includes('RV-') || ref.includes('قبض') || entry.sourceType === 'RECEIPT') sourceType = 'RECEIPT';
        else if (ref.includes('PV-') || ref.includes('دفع') || entry.sourceType === 'PAYMENT') sourceType = 'PAYMENT';

        // Detect currency
        const desc = entry.description || '';
        let currency = 'IQD';
        if (desc.includes('$') || desc.includes('USD') || desc.includes('دولار')) currency = 'USD';

        return {
          ...entry,
          _idx: idx + 1,
          dateFormatted: formatDateEn(entry.date || entry.createdAt),
          totalDebit,
          totalCredit,
          debitAccountName,
          creditAccountName,
          cashboxName,
          sourceType,
          currency,
          userName: entry.createdBy?.name || entry.createdBy?.fullName || entry.createdBy?.email || '—',
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

  /* ─────── Post Entry ─────── */
  const handlePostEntry = async (id: string) => {
    try {
      await apiRequest(`/api/journal-entries/${id}/post`, { method: 'POST' });
      showSuccessNotification('تم الترحيل', 'تم ترحيل القيد وتحديث أرصدة الحسابات بنجاح.');
      fetchEntries(true);
    } catch (err: any) {
      showErrorNotification('خطأ في الترحيل', err.message || 'حدث خطأ أثناء ترحيل القيد');
    }
  };

  /* ─────── Reverse Entry ─────── */
  const handleReverseEntry = async () => {
    if (!selectedEntry) return;
    try {
      await apiRequest(`/api/journal-entries/${selectedEntry.id}/reverse`, {
        method: 'POST',
        body: JSON.stringify({ reason: reverseReason }),
      });
      showSuccessNotification('تم العكس', `تم إنشاء قيد عكسي للقيد ${selectedEntry.entryNumber} بنجاح.`);
      setReverseModalOpen(false);
      setReverseReason('');
      setDrawerOpen(false);
      fetchEntries(true);
    } catch (err: any) {
      showErrorNotification('خطأ في العكس', err.message || 'حدث خطأ أثناء عكس القيد');
    }
  };

  /* ─────── Delete Entry ─────── */
  const handleDeleteEntry = async () => {
    if (!entryToDelete) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/journal-entries/${entryToDelete.id}`, { method: 'DELETE' });
      showSuccessNotification(
        'تم الحذف بنجاح',
        `تم حذف القيد رقم [${entryToDelete.entryNumber}] وإلغاء تأثيره على أرصدة الحسابات.`
      );
      // Optimistic local removal
      setEntries((prev) => prev.filter((e) => e.id !== entryToDelete.id));
      setDeleteConfirmOpen(false);
      setEntryToDelete(null);
    } catch (err: any) {
      showErrorNotification('خطأ في الحذف', err.message || 'تعذر حذف القيد');
    } finally {
      setDeleting(false);
    }
  };

  /* ─────── Edit Entry ─────── */
  const handleOpenEdit = (entry: any) => {
    // If entry has a source voucher, open the voucher form for editing
    if (entry.sourceVoucherId) {
      setEditVoucherId(entry.sourceVoucherId);
      setEditVoucherType(entry.sourceType === 'PAYMENT' ? 'PAYMENT' : 'RECEIPT');
      setEditModalOpen(true);
    } else {
      // For pure journal entries, open directly as JOURNAL
      setEditVoucherId(entry.id);
      setEditVoucherType('JOURNAL');
      setEditModalOpen(true);
    }
  };

  const handleVoucherSaved = (savedItem?: any) => {
    if (!savedItem) {
      setEditModalOpen(false);
      setEditVoucherId(undefined);
      return;
    }

    // Handle temp ID replacement from background API response
    if (savedItem._replaceTemp) {
      const tempId = savedItem._replaceTemp;
      setEntries((prev) =>
        prev.map((e) =>
          e.id === tempId
            ? { ...e, id: savedItem.id, entryNumber: savedItem.entryNumber || e.entryNumber }
            : e
        )
      );
      return;
    }

    // Handle temp ID removal on API error
    if (savedItem._removeTemp) {
      const tempId = savedItem._removeTemp;
      setEntries((prev) => prev.filter((e) => e.id !== tempId));
      return;
    }

    if (savedItem.id) {
      const isJV = savedItem.voucherType === 'JOURNAL' || savedItem.sourceType === 'JOURNAL';
      const firstDebit = savedItem.lines?.find((l: any) => Number(l.debit) > 0) || savedItem.lines?.[0];
      const firstCredit = savedItem.lines?.find((l: any) => Number(l.credit) > 0) || savedItem.lines?.[1];
      const aMap = accountsMap;
      const dName = aMap[firstDebit?.accountId] || firstDebit?.accountName || 'حساب مدين';
      const cName = aMap[firstCredit?.accountId] || firstCredit?.accountName || 'حساب دائن';

      const totalDebit = Number(savedItem.totalDebit || savedItem.amount || 0);
      const totalCredit = Number(savedItem.totalCredit || totalDebit);

      const optimisticEntry = {
        id: savedItem.id,
        entryNumber: savedItem.entryNumber || savedItem.voucherNumber || 'JV-NEW',
        dateFormatted: savedItem.date ? String(savedItem.date).split('T')[0] : formatDateEn(new Date()),
        description: savedItem.description || (isJV ? 'سند قيد محاسبي' : 'سند مالي'),
        totalDebit,
        totalCredit,
        debitAccountName: dName,
        creditAccountName: cName,
        cashboxName: dName,
        sourceType: (isJV ? 'JOURNAL' : savedItem.voucherType || 'JOURNAL') as 'RECEIPT' | 'PAYMENT' | 'JOURNAL',
        currency: savedItem.currency || 'IQD',
        userName: savedItem.userName || 'علي جعفر محمود',
        status: 'POSTED',
        createdAt: new Date().toISOString(),
        lines: savedItem.lines,
      };

      setEntries((prev) => {
        const exists = prev.some((e) => e.id === savedItem.id);
        if (exists) {
          return prev.map((e) => (e.id === savedItem.id ? { ...e, ...optimisticEntry } : e));
        }
        return [optimisticEntry, ...prev];
      });
    }

    setEditModalOpen(false);
    setEditVoucherId(undefined);
  };

  /* ─────── Audit Log ─────── */
  const buildAuditLog = (entry: any): AuditLogEntry[] => {
    const logs: AuditLogEntry[] = [];

    // Creation event
    logs.push({
      id: 'create',
      action: 'CREATE',
      actionLabel: 'إنشاء القيد المحاسبي',
      userName: entry.userName || '—',
      timestamp: entry.createdAt || entry.date,
      details: `تم إنشاء القيد المحاسبي برقم [${entry.entryNumber}] بقيمة ${fmtMoney(entry.totalDebit)} ${entry.currency}.`,
      icon: 'create',
    });

    // Posting event
    if (entry.status === 'POSTED') {
      logs.push({
        id: 'post',
        action: 'POST',
        actionLabel: 'ترحيل القيد للحسابات',
        userName: entry.userName || '—',
        timestamp: entry.updatedAt || entry.createdAt,
        details: 'تم ترحيل القيد تلقائياً وتحديث أرصدة الحسابات المالية.',
        icon: 'post',
      });
    }

    // Edit event if updated
    if (entry.updatedAt && entry.updatedAt !== entry.createdAt) {
      logs.push({
        id: 'update',
        action: 'UPDATE',
        actionLabel: 'تعديل بيانات القيد',
        userName: entry.updatedBy?.name || entry.updatedBy?.fullName || entry.userName || '—',
        timestamp: entry.updatedAt,
        details: 'تم تعديل بيانات القيد المحاسبي.',
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

  /* ─────── Summary Stats ─────── */
  const stats = useMemo(() => {
    const totalDebit = entries.reduce((s, e) => s + Number(e.totalDebit || 0), 0);
    const totalCredit = entries.reduce((s, e) => s + Number(e.totalCredit || e.totalDebit || 0), 0);
    const posted = entries.filter(e => e.status === 'POSTED').length;
    const draft = entries.filter(e => e.status === 'DRAFT').length;
    const reversed = entries.filter(e => e.status === 'REVERSED').length;
    return { totalDebit, totalCredit, posted, draft, reversed, total: entries.length };
  }, [entries]);

  /* ─────── Column Definitions ─────── */
  const columnDefs: AccountingColumnDef[] = [
    {
      field: 'entryNumber',
      headerText: 'رقم ونوع القيد',
      width: 'w-44',
      isPinned: true,
      render: (r) => (
        <div className="flex items-center gap-1.5 font-mono">
          <Badge
            size="xs"
            color={r.sourceType === 'RECEIPT' ? 'emerald' : r.sourceType === 'PAYMENT' ? 'red' : 'blue'}
            variant="light"
            className="shrink-0 font-bold px-1.5"
          >
            {r.sourceType === 'RECEIPT' ? 'سند قبض' : r.sourceType === 'PAYMENT' ? 'سند دفع' : 'سند قيد'}
          </Badge>
          <span className="font-black text-slate-900 tabular-nums text-xs">{r.entryNumber}</span>
        </div>
      ),
    },
    {
      field: 'dateFormatted',
      headerText: 'تاريخ القيد',
      width: 'w-28',
      align: 'center',
      render: (r) => (
        <span className="font-mono font-bold text-slate-700 text-xs tabular-nums text-center block">
          {r.dateFormatted}
        </span>
      ),
    },
    {
      field: 'parties',
      headerText: 'أطراف القيد المحاسبي (مدين ⬅ دائن)',
      width: 'w-64',
      render: (r) => (
        <div className="flex flex-col gap-0.5 max-w-[260px] py-0.5">
          <div className="flex items-center gap-1.5 truncate">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-[10px] font-bold text-slate-500 shrink-0">من:</span>
            <span className="font-bold text-emerald-950 truncate text-xs">{r.debitAccountName || '—'}</span>
          </div>
          <div className="flex items-center gap-1.5 truncate">
            <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
            <span className="text-[10px] font-bold text-slate-500 shrink-0">إلى:</span>
            <span className="font-bold text-rose-950 truncate text-xs">{r.creditAccountName || '—'}</span>
          </div>
        </div>
      ),
    },
    {
      field: 'amount',
      headerText: 'المبلغ والعملة',
      width: 'w-36',
      align: 'left',
      isMonetary: true,
      render: (r) => {
        const amt = Number(r.totalDebit) || Number(r.totalCredit) || 0;
        return (
          <div className="flex items-center justify-between gap-1.5 w-full">
            <Badge size="xs" color={r.currency === 'USD' ? 'blue' : 'orange'} variant="light" className="font-mono font-bold shrink-0">
              {r.currency === 'USD' ? '$' : 'د.ع'}
            </Badge>
            <span className="font-black tabular-nums font-mono text-xs text-slate-900 text-left">
              {fmtMoney(amt)}
            </span>
          </div>
        );
      },
    },
    {
      field: 'description',
      headerText: 'البيان وشرح القيد المحاسبي',
      isWide: true,
      render: (r) => (
        <span className="truncate block max-w-[380px] text-slate-700 text-xs font-medium" title={r.description}>
          {r.description || '—'}
        </span>
      ),
    },
    {
      field: 'userName',
      headerText: 'المنشئ / الموظف',
      width: 'w-36',
      render: (r) => (
        <div className="flex items-center gap-1.5 text-slate-700 text-xs truncate">
          <IconUser size={13} className="text-slate-400 shrink-0" />
          <span className="truncate font-medium">{r.userName}</span>
        </div>
      ),
    },
    {
      field: 'actions',
      headerText: 'الإجراءات',
      width: 'w-36',
      align: 'center',
      isPinned: true,
      render: (r) => (
        <div className="flex items-center justify-center gap-0.5">
          <Tooltip label="معاينة أطراف القيد" withArrow position="top">
            <ActionIcon size="sm" variant="subtle" color="blue" onClick={(e) => { e.stopPropagation(); setSelectedEntry(r); setDrawerOpen(true); }}>
              <IconEye size={15} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="تعديل القيد" withArrow position="top">
            <ActionIcon size="sm" variant="subtle" color="orange" onClick={(e) => { e.stopPropagation(); handleOpenEdit(r); }}>
              <IconEdit size={15} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="طباعة القيد" withArrow position="top">
            <ActionIcon size="sm" variant="subtle" color="gray" onClick={(e) => { e.stopPropagation(); setSelectedEntry(r); setTimeout(() => window.print(), 200); }}>
              <IconPrinter size={15} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="سجل التدقيق" withArrow position="top">
            <ActionIcon size="sm" variant="subtle" color="violet" onClick={(e) => { e.stopPropagation(); handleOpenAuditLog(r); }}>
              <IconHistory size={15} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="حذف القيد" withArrow position="top">
            <ActionIcon size="sm" variant="subtle" color="red" onClick={(e) => { e.stopPropagation(); setEntryToDelete(r); setDeleteConfirmOpen(true); }}>
              <IconTrash size={15} />
            </ActionIcon>
          </Tooltip>
        </div>
      ),
    },
  ];

  /* ─────── Action Menu Items ─────── */
  const actionMenuItems: AccountingActionMenuItem[] = [
    {
      label: 'معاينة أطراف القيد',
      icon: IconEye,
      onClick: (row) => { setSelectedEntry(row); setDrawerOpen(true); },
    },
    {
      label: 'تعديل القيد المحاسبي',
      icon: IconEdit,
      onClick: (row) => handleOpenEdit(row),
    },
    {
      label: 'ترحيل القيد',
      icon: IconCheck,
      color: 'emerald',
      hidden: (row) => row.status !== 'DRAFT',
      onClick: (row) => handlePostEntry(row.id),
    },
    {
      label: 'عكس القيد المحاسبي',
      icon: IconArrowBackUp,
      color: 'red',
      hidden: (row) => row.status !== 'POSTED',
      onClick: (row) => { setSelectedEntry(row); setReverseModalOpen(true); },
    },
    {
      label: 'سجل التدقيق والتغييرات',
      icon: IconHistory,
      onClick: (row) => handleOpenAuditLog(row),
    },
    {
      label: 'طباعة القيد الرسمي',
      icon: IconPrinter,
      onClick: (row) => { setSelectedEntry(row); setTimeout(() => window.print(), 200); },
    },
    {
      label: 'حذف القيد والحركة المحاسبية',
      icon: IconTrash,
      color: 'red',
      onClick: (row) => { setEntryToDelete(row); setDeleteConfirmOpen(true); },
    },
  ];

  /* ─────── Audit Icon Selector ─────── */
  const getAuditIcon = (icon: string) => {
    const map: Record<string, { bg: string; fg: string; Icon: any }> = {
      create: { bg: 'bg-blue-100', fg: 'text-blue-600', Icon: IconPlus },
      edit: { bg: 'bg-orange-100', fg: 'text-orange-600', Icon: IconEdit },
      post: { bg: 'bg-emerald-100', fg: 'text-emerald-600', Icon: IconClipboardCheck },
      reverse: { bg: 'bg-red-100', fg: 'text-red-600', Icon: IconArrowBackUp },
      delete: { bg: 'bg-red-100', fg: 'text-red-600', Icon: IconTrash },
      status: { bg: 'bg-violet-100', fg: 'text-violet-600', Icon: IconHistory },
    };
    return map[icon] || map.status;
  };

  /* ═════════════════════════════════════════════ RENDER ═════════════════════════════════════════════ */
  return (
    <div className="space-y-3 w-full select-none" dir="rtl">
      {/* ═══ Header ═══ */}
      <div className="flex justify-between items-center no-print">
        <div className="flex items-center gap-2.5">
          <IconFileInvoice size={22} className="text-blue-600" />
          <div>
            <h1 className="font-black text-sm text-slate-900 leading-tight">دفتر القيود اليومية المحاسبية</h1>
            <p className="text-[11px] text-slate-500 font-medium">Journal Entries — إدارة ومعاينة كافة القيود والحركات المحاسبية</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="xs"
            color="blue"
            leftSection={<IconPlus size={14} />}
            onClick={() => { setEditVoucherId(undefined); setEditVoucherType('JOURNAL'); setEditModalOpen(true); }}
            className="font-bold shadow-2xs"
          >
            + قيد محاسبي جديد
          </Button>
        </div>
      </div>



      {/* ═══ Main Accounting Grid ═══ */}
      <AccountingGrid
        gridKey="jv_accounting_grid_v2"
        title="دفتر القيود اليومية المحاسبية (Journal Entries)"
        data={entries}
        columnDefs={columnDefs}
        loading={loading}
        onRefresh={() => fetchEntries(true)}
        actionMenuItems={actionMenuItems}
        hideSelectionBanner={true}
        onRowDoubleClick={(row) => { setSelectedEntry(row); setDrawerOpen(true); }}
      />

      {/* ═══ Financial Voucher Form Modal (Edit / Create) ═══ */}
      <FinancialVoucherForm
        opened={editModalOpen}
        onClose={() => { setEditModalOpen(false); setEditVoucherId(undefined); }}
        onSuccess={handleVoucherSaved}
        initialVoucherType={editVoucherType}
        initialVoucherId={editVoucherId}
      />

      {/* ═══ Enhanced Entry Detail Drawer ═══ */}
      <Drawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={
          <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
            <IconFileInvoice size={18} className="text-blue-600" />
            <span>معاينة تفاصيل القيد المحاسبي</span>
          </div>
        }
        position="left"
        size="lg"
      >
        {selectedEntry && (
          <div className="space-y-4 text-xs" dir="rtl">
            {/* Header Card */}
            <div className="p-3 bg-gradient-to-l from-slate-50 to-blue-50/40 border border-slate-200 rounded-lg flex justify-between items-center">
              <div>
                <span className="text-[10px] text-slate-500 font-bold block">رقم ونوع القيد</span>
                <div className="text-sm font-black text-slate-900 font-mono tabular-nums">
                  {selectedEntry.entryNumber}
                </div>
                <span className="text-[11px] text-slate-500 font-medium">{selectedEntry.dateFormatted}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  size="sm"
                  color={selectedEntry.sourceType === 'RECEIPT' ? 'emerald' : selectedEntry.sourceType === 'PAYMENT' ? 'red' : 'blue'}
                  className="font-bold"
                >
                  {selectedEntry.sourceType === 'RECEIPT' ? 'سند قبض' : selectedEntry.sourceType === 'PAYMENT' ? 'سند دفع' : 'قيد يومية'}
                </Badge>
                <Badge color={(statusMap[selectedEntry.status] || {}).color || 'gray'} size="sm" className="font-bold">
                  {(statusMap[selectedEntry.status] || {}).label || selectedEntry.status}
                </Badge>
              </div>
            </div>

            {/* Financial Details */}
            <div className="p-3 border border-slate-200 rounded-lg space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-2.5 text-center">
                  <div className="text-[10px] text-emerald-700 font-bold mb-0.5">المدين (Debit)</div>
                  <div className="font-black text-lg text-emerald-800 font-mono tabular-nums">{fmtMoney(selectedEntry.totalDebit)}</div>
                </div>
                <div className="bg-rose-50/60 border border-rose-200 rounded-lg p-2.5 text-center">
                  <div className="text-[10px] text-rose-700 font-bold mb-0.5">الدائن (Credit)</div>
                  <div className="font-black text-lg text-rose-800 font-mono tabular-nums">{fmtMoney(selectedEntry.totalCredit)}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500 block text-[10px] font-bold">المرجع / الشيك</span>
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
                  <span className="text-slate-500 block text-[10px] font-bold">الصندوق المستلم</span>
                  <span className="font-bold text-slate-800">{selectedEntry.cashboxName}</span>
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
                <span className="text-slate-500 block text-[10px] font-bold">البيان المحاسبي</span>
                <p className="text-slate-800 leading-relaxed bg-slate-50 p-2 rounded border border-slate-200 text-[11px]">
                  {selectedEntry.description || '—'}
                </p>
              </div>
            </div>

            {/* Entry Lines (Debit & Credit) */}
            <div>
              <span className="font-bold text-xs text-slate-900 block mb-1.5">سطور أطراف القيد المحاسبي:</span>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 font-bold text-[11px]">
                      <th className="py-2 px-2.5 border-l border-slate-200">كود ورقم الحساب</th>
                      <th className="py-2 px-2.5 border-l border-slate-200 text-emerald-800">المدين (Debit)</th>
                      <th className="py-2 px-2.5 border-l border-slate-200 text-rose-800">الدائن (Credit)</th>
                      <th className="py-2 px-2.5">البيان الفرعي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedEntry.lines?.map((line: any, idx: number) => (
                      <tr key={line.id || idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-2.5 font-bold text-slate-800 border-l border-slate-100">
                          {line.account?.code || '—'} — {line.account?.nameAr || accountsMap[line.accountId] || '—'}
                        </td>
                        <td className="py-2 px-2.5 border-l border-slate-100 font-mono tabular-nums font-bold text-emerald-800">
                          {Number(line.debit) > 0 ? fmtMoney(line.debit) : '—'}
                        </td>
                        <td className="py-2 px-2.5 border-l border-slate-100 font-mono tabular-nums font-bold text-rose-800">
                          {Number(line.credit) > 0 ? fmtMoney(line.credit) : '—'}
                        </td>
                        <td className="py-2 px-2.5 text-slate-600">{line.description || '—'}</td>
                      </tr>
                    ))}
                    {/* Totals Row */}
                    <tr className="bg-slate-50 border-t-2 border-slate-300 font-black">
                      <td className="py-2 px-2.5 border-l border-slate-200 text-slate-900">المجموع</td>
                      <td className="py-2 px-2.5 border-l border-slate-200 font-mono tabular-nums text-emerald-900">{fmtMoney(selectedEntry.totalDebit)}</td>
                      <td className="py-2 px-2.5 border-l border-slate-200 font-mono tabular-nums text-rose-900">{fmtMoney(selectedEntry.totalCredit)}</td>
                      <td className="py-2 px-2.5" />
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 pt-1">
              {selectedEntry.status === 'DRAFT' && (
                <Button size="xs" color="emerald" leftSection={<IconCheck size={14} />} onClick={() => handlePostEntry(selectedEntry.id)}>
                  ترحيل القيد
                </Button>
              )}
              {selectedEntry.status === 'POSTED' && (
                <Button size="xs" color="red" variant="light" leftSection={<IconArrowBackUp size={14} />} onClick={() => setReverseModalOpen(true)}>
                  عكس القيد
                </Button>
              )}
              <Button size="xs" variant="outline" color="orange" leftSection={<IconEdit size={14} />} onClick={() => handleOpenEdit(selectedEntry)}>
                تعديل
              </Button>
              <Button size="xs" variant="outline" color="gray" leftSection={<IconPrinter size={14} />} onClick={() => window.print()}>
                طباعة
              </Button>
              <Button size="xs" variant="outline" color="violet" leftSection={<IconHistory size={14} />} onClick={() => handleOpenAuditLog(selectedEntry)}>
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
          <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
            <IconHistory size={18} className="text-violet-600" />
            <span>سجل التدقيق والتتبع — {selectedEntry?.entryNumber}</span>
          </div>
        }
        position="left"
        size="md"
      >
        <div className="space-y-3 text-xs" dir="rtl">
          {/* Entry Info Header */}
          {selectedEntry && (
            <div className="p-3 bg-violet-50/50 border border-violet-200 rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-black text-sm text-slate-900 font-mono tabular-nums">{selectedEntry.entryNumber}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{selectedEntry.description?.substring(0, 60) || '—'}</div>
                </div>
                <Badge color={(statusMap[selectedEntry.status] || {}).color || 'gray'} size="sm" className="font-bold">
                  {(statusMap[selectedEntry.status] || {}).label || selectedEntry.status}
                </Badge>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="space-y-0">
            {auditLogs.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <IconHistory size={32} className="mx-auto mb-2 opacity-40" />
                <span className="font-bold block">لا يوجد سجل تدقيق لهذا القيد</span>
              </div>
            ) : (
              auditLogs.map((log, idx) => {
                const iconConfig = getAuditIcon(log.icon);
                const IconComp = iconConfig.Icon;
                return (
                  <div key={log.id} className="flex gap-3 relative">
                    {/* Timeline Line */}
                    {idx < auditLogs.length - 1 && (
                      <div className="absolute right-[15px] top-[36px] w-0.5 bg-slate-200" style={{ height: 'calc(100% - 12px)' }} />
                    )}
                    {/* Icon */}
                    <div className={`w-8 h-8 ${iconConfig.bg} rounded-full flex items-center justify-center shrink-0 relative z-10 border border-white shadow-sm`}>
                      <IconComp size={14} className={iconConfig.fg} />
                    </div>
                    {/* Content */}
                    <div className="flex-1 pb-4">
                      <div className="bg-white border border-slate-200 rounded-lg p-3 hover:shadow-xs transition-shadow">
                        <div className="flex justify-between items-start mb-1.5">
                          <span className="font-black text-slate-900 text-[12px]">{log.actionLabel}</span>
                          <span className="text-[10px] text-slate-400 font-mono tabular-nums shrink-0 mr-2" dir="ltr">
                            {formatDateTimeEn(log.timestamp)}
                          </span>
                        </div>
                        {/* Status Change */}
                        {log.fromStatus && log.toStatus && (
                          <div className="flex items-center gap-1.5 mb-1.5 text-[11px]">
                            <Badge size="xs" color="gray" variant="light" className="font-bold">{log.fromStatus}</Badge>
                            <IconArrowRight size={12} className="text-slate-400" />
                            <Badge
                              size="xs"
                              color={log.toStatus === 'مرحّل' ? 'emerald' : log.toStatus === 'معكوس' ? 'red' : 'yellow'}
                              variant="light"
                              className="font-bold"
                            >
                              {log.toStatus}
                            </Badge>
                          </div>
                        )}
                        {/* Details */}
                        {log.details && (
                          <p className="text-[11px] text-slate-600 leading-relaxed">{log.details}</p>
                        )}
                        {/* User */}
                        <div className="flex items-center gap-1 mt-1.5 text-slate-500">
                          <IconUser size={11} className="text-slate-400" />
                          <span className="font-medium text-[10px]">بواسطة: {log.userName}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Drawer>

      {/* ═══ Reverse Entry Modal ═══ */}
      <Modal
        opened={reverseModalOpen}
        onClose={() => setReverseModalOpen(false)}
        title={
          <div className="flex items-center gap-2 font-bold text-sm text-red-600">
            <IconArrowBackUp size={18} />
            <span>عكس قيد محاسبي (Reversing Entry)</span>
          </div>
        }
        size="md"
        centered
      >
        <div className="space-y-3 text-xs" dir="rtl">
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-950 space-y-1">
            <p className="font-bold">سيتم إنشاء قيد عكسي جديد لإلغاء تأثير القيد:</p>
            <p className="font-mono font-black text-sm">{selectedEntry?.entryNumber}</p>
            <p className="text-[11px] text-red-700">المبلغ: {fmtMoney(selectedEntry?.totalDebit)} — سيتم تحديث أرصدة الحسابات تلقائياً.</p>
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
        radius="md"
      >
        <div className="space-y-3.5 text-xs" dir="rtl">
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-950 space-y-1">
            <p className="font-bold">هل أنت متأكد من رغبتك في حذف هذا القيد نهائياً؟</p>
            <p className="text-[11px] text-red-700">
              سيتم حذف القيد وإلغاء تأثيره على أرصدة الحسابات المتأثرة بالكامل.
            </p>
          </div>

          {entryToDelete && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">رقم القيد:</span>
                <span className="font-mono font-black text-slate-900">{entryToDelete.entryNumber}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">المدين:</span>
                <span className="font-mono font-black text-emerald-800">{fmtMoney(entryToDelete.totalDebit)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">الدائن:</span>
                <span className="font-mono font-black text-rose-800">{fmtMoney(entryToDelete.totalCredit)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">الصندوق المستلم:</span>
                <span className="font-bold text-slate-800">{entryToDelete.cashboxName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">موظف الإدخال:</span>
                <span className="font-bold text-slate-800">{entryToDelete.userName}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold block mb-0.5">البيان:</span>
                <p className="text-slate-700 bg-white p-2 rounded border border-slate-200 text-[11px]">
                  {entryToDelete.description || '—'}
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
