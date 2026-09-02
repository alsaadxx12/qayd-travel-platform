import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  IconUsersGroup,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconPlaneTilt,
  IconArmchair,
  IconCoins,
  IconTrendingUp,
  IconCalendarEvent,
  IconEdit,
  IconTrash,
} from '@tabler/icons-react';
import { Loader, Modal } from '@mantine/core';
import { AccountingGrid, AccountingColumnDef, AccountingActionMenuItem } from '../../components/common/AccountingGrid';
import { GroupDesignWorkspace } from '../../components/groups/GroupDesignWorkspace';
import { matchesSearchTokens } from '../../components/ui/SearchableCombobox';
import { ticketsApi, TicketData } from '../../api/tickets';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { useLanguageStore } from '../../store/useLanguageStore';

/**
 * الكروبات هي تذاكر من نوع GROUP_FARE.
 *
 * لا جدول مستقل لها في القاعدة: مساحة عمل الكروب تحفظها تذكرةً موسومة بـ
 * tripType = 'GROUP_FARE'، فتُقرأ من هنا بالوسم نفسه. وهذا يبقيها في كشوف
 * الحسابات والتقارير مع بقية التذاكر بلا مسارٍ ثانٍ للبيانات.
 */
const GROUP_TRIP_TYPE = 'GROUP_FARE';

const money = (value: number, currency = 'IQD') =>
  `${Number(value || 0).toLocaleString('en-US')} ${currency === 'USD' ? '$' : 'IQD'}`;

const StatCard: React.FC<{
  label: string;
  value: string;
  hint?: string;
  icon: any;
  stripe: string;
  tone: string;
}> = ({ label, value, hint, icon: Icon, stripe, tone }) => (
  <div className="relative bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
    <div className={`absolute inset-x-0 top-0 h-1 ${stripe}`} />
    <div className="p-3.5 pt-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <span className="text-[11px] font-bold text-slate-500 block">{label}</span>
        <span className="text-lg font-black text-slate-900 block mt-0.5 font-mono truncate" dir="ltr">
          {value}
        </span>
        {hint && <span className="text-[10.5px] font-bold text-slate-400 block mt-0.5">{hint}</span>}
      </div>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${tone}`}>
        <Icon size={17} />
      </div>
    </div>
  </div>
);

export const GroupsPage: React.FC = () => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  const [rows, setRows] = useState<TicketData[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
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

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    return rows.filter((t: any) =>
      matchesSearchTokens(
        [t.invoiceNumber, t.customerName, t.supplierAccountName, t.airline, t.route, t.notes]
          .filter(Boolean)
          .join(' '),
        search,
      ),
    );
  }, [rows, search]);

  const totals = useMemo(() => {
    let seats = 0;
    let sell = 0;
    let profit = 0;
    filtered.forEach((t: any) => {
      seats += (t.passengers || []).length || Number(t.paxCount || 0);
      sell += Number(t.netSell ?? t.totalSell ?? 0);
      profit += Number(t.profit ?? 0);
    });
    return { count: filtered.length, seats, sell, profit };
  }, [filtered]);

  const openEditor = async (row?: TicketData) => {
    if (!row) {
      setEditing(null);
      setWorkspaceOpen(true);
      return;
    }
    setOpening(true);
    try {
      // النسخة الكاملة فيها المسافرون وتفاصيل الشراء، ونسخة القائمة مختصرة.
      const full = await ticketsApi.getOne(row.id as string).catch(() => row);
      setEditing(full || row);
      setWorkspaceOpen(true);
    } finally {
      setOpening(false);
    }
  };

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
        isAr ? `حُذف الكروب ${removed.invoiceNumber || ''} وقيده معه.` : `Group ${removed.invoiceNumber || ''} deleted.`,
      );
    } catch (err: any) {
      // ما فشل حذفه يعود إلى مكانه بدل أن تكذب الشاشة.
      setRows((prev) => (prev.some((t) => t.id === removed.id) ? prev : [removed, ...prev]));
      showErrorNotification(
        isAr ? 'تعذّر الحذف' : 'Delete failed',
        err?.message || (isAr ? 'لم يُحذف الكروب' : 'The group was not deleted'),
      );
    } finally {
      setDeleting(false);
    }
  };

  const columnDefs: AccountingColumnDef[] = useMemo(
    () => [
      {
        field: 'invoiceNumber',
        headerText: isAr ? 'رقم الكروب' : 'Group No.',
        width: 'w-36',
        isPinned: true,
        render: (r) => (
          <div className="leading-tight">
            <span className="font-mono font-black text-[11.5px] text-slate-900 block" dir="ltr">
              {r.invoiceNumber || '—'}
            </span>
            <span className="text-[10px] font-bold text-slate-400 font-mono" dir="ltr">
              {r.issueDate ? new Date(r.issueDate).toLocaleDateString('en-GB') : ''}
            </span>
          </div>
        ),
      },
      {
        field: 'customerName',
        headerText: isAr ? 'المستفيد' : 'Beneficiary',
        isWide: true,
        render: (r) => (
          <div className="leading-tight min-w-0">
            <span className="font-bold text-[12px] text-slate-900 block truncate">
              {r.customerName || (isAr ? '— بلا عميل —' : '— no customer —')}
            </span>
            {r.supplierAccountName && (
              <span className="text-[10.5px] font-bold text-slate-500 block truncate">
                {isAr ? 'المورد: ' : 'Supplier: '}
                {r.supplierAccountName}
              </span>
            )}
          </div>
        ),
      },
      {
        field: 'route',
        headerText: isAr ? 'المسار وشركة الطيران' : 'Route & airline',
        width: 'w-44',
        render: (r) => (
          <div className="leading-tight min-w-0">
            <span className="font-mono font-bold text-[11.5px] text-slate-800 block truncate" dir="ltr">
              {r.route || '—'}
            </span>
            {r.airline && (
              <span className="text-[10.5px] font-bold text-slate-500 block truncate">{r.airline}</span>
            )}
          </div>
        ),
      },
      {
        field: 'travelDate',
        headerText: isAr ? 'تاريخ السفر' : 'Travel date',
        width: 'w-28',
        align: 'center',
        render: (r) =>
          r.travelDate ? (
            <span className="font-mono font-bold text-[11.5px] text-slate-800" dir="ltr">
              {new Date(r.travelDate as any).toLocaleDateString('en-GB')}
            </span>
          ) : (
            <span className="text-slate-300">—</span>
          ),
      },
      {
        field: 'seats',
        headerText: isAr ? 'المقاعد' : 'Seats',
        width: 'w-20',
        align: 'center',
        render: (r) => {
          const seats = (r.passengers || []).length || Number((r as any).paxCount || 0);
          return (
            <span className="inline-flex items-center gap-1 text-[11px] font-black bg-indigo-50 text-indigo-900 border border-indigo-200 rounded-md px-1.5 py-0.5">
              <IconArmchair size={11} className="text-indigo-600" />
              {seats || '—'}
            </span>
          );
        },
      },
      {
        field: 'netSell',
        headerText: isAr ? 'المبيعات' : 'Sales',
        width: 'w-32',
        align: 'left',
        isMonetary: true,
        render: (r) => (
          <span className="font-mono font-black text-[12px] text-slate-900" dir="ltr">
            {money(Number(r.netSell ?? r.totalSell ?? 0), r.currency)}
          </span>
        ),
      },
      {
        field: 'profit',
        headerText: isAr ? 'الربح' : 'Profit',
        width: 'w-32',
        align: 'left',
        isMonetary: true,
        render: (r) => {
          const p = Number(r.profit ?? 0);
          return (
            <span
              className={`font-mono font-black text-[12px] ${
                p > 0 ? 'text-[#078B61]' : p < 0 ? 'text-red-600' : 'text-slate-500'
              }`}
              dir="ltr"
            >
              {p >= 0 ? `+${money(p, r.currency)}` : money(p, r.currency)}
            </span>
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
              className={`text-[10.5px] font-black px-2 py-0.5 rounded-full border ${
                posted
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              {posted ? (isAr ? 'مرحَّل' : 'Posted') : isAr ? 'مسودة' : 'Draft'}
            </span>
          );
        },
      },
    ],
    [isAr],
  );

  const actionMenuItems: AccountingActionMenuItem[] = useMemo(
    () => [
      {
        label: isAr ? 'تعديل' : 'Edit',
        icon: IconEdit,
        description: isAr ? 'يفتح الكروب بكامل بياناته' : 'Opens the group with all its data',
        onClick: (row: any) => openEditor(row),
      },
      {
        label: isAr ? 'حذف' : 'Delete',
        icon: IconTrash,
        color: 'red',
        description: isAr ? 'يحذف الكروب وقيده معاً' : 'Removes the group and its journal entry',
        onClick: (row: any) => setDeleteTarget(row),
      },
    ],
    [isAr],
  );

  return (
    <div
      className="w-full max-w-[1760px] mx-auto px-4 sm:px-6 py-4 space-y-4 font-sans select-none"
      dir={direction}
    >
      {/* ── الترويسة ── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#F45A0A] to-[#f59e0b] text-white flex items-center justify-center shadow-sm shrink-0">
              <IconUsersGroup size={22} />
            </div>
            <div>
              <h1 className="font-black text-base text-slate-900 leading-tight">
                {isAr ? 'تذاكر الكروبات' : 'Group Fares'}
              </h1>
              <p className="text-[11.5px] text-slate-500 font-bold mt-0.5">
                {isAr
                  ? 'رحلات المجموعات: المقاعد والمورد والمستفيد وأسعار الكروب وأرباحه'
                  : 'Group trips: seats, supplier, beneficiary, group pricing and profit'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <IconSearch
                size={15}
                className="absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                style={{ insetInlineStart: 10 }}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isAr ? 'ابحث برقم الكروب أو المستفيد أو المسار…' : 'Search by number, beneficiary or route…'}
                className="h-9 w-64 rounded-xl border border-slate-200 bg-white text-[12px] font-bold text-slate-900 outline-none focus:border-[#F45A0A] focus:ring-2 focus:ring-orange-100 transition-all"
                style={{ paddingInlineStart: 32, paddingInlineEnd: 10 }}
              />
            </div>

            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <IconRefresh size={14} className={loading ? 'animate-spin' : ''} />
              {isAr ? 'تحديث' : 'Refresh'}
            </button>

            <button
              type="button"
              onClick={() => openEditor()}
              className="h-9 px-4 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white text-xs font-black cursor-pointer transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <IconPlus size={15} />
              {isAr ? 'كروب جديد' : 'New group'}
            </button>
          </div>
        </div>
      </div>

      {/* ── البطاقات ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label={isAr ? 'عدد الكروبات' : 'Groups'}
          value={String(totals.count)}
          hint={search.trim() ? (isAr ? 'ضمن نتائج البحث' : 'within search results') : undefined}
          icon={IconPlaneTilt}
          stripe="bg-[#F45A0A]"
          tone="bg-orange-50 border-orange-200 text-[#F45A0A]"
        />
        <StatCard
          label={isAr ? 'إجمالي المقاعد' : 'Total seats'}
          value={String(totals.seats)}
          icon={IconArmchair}
          stripe="bg-indigo-500"
          tone="bg-indigo-50 border-indigo-200 text-indigo-600"
        />
        <StatCard
          label={isAr ? 'إجمالي المبيعات' : 'Total sales'}
          value={money(totals.sell)}
          icon={IconCoins}
          stripe="bg-sky-500"
          tone="bg-sky-50 border-sky-200 text-sky-600"
        />
        <StatCard
          label={isAr ? 'إجمالي الربح' : 'Total profit'}
          value={money(totals.profit)}
          icon={IconTrendingUp}
          stripe="bg-emerald-500"
          tone="bg-emerald-50 border-emerald-200 text-emerald-600"
        />
      </div>

      {/* ── السجل ── */}
      <AccountingGrid
        gridKey="group_fares_grid"
        data={filtered}
        columnDefs={columnDefs}
        loading={loading}
        actionMenuItems={actionMenuItems}
        onRowDoubleClick={(row: any) => openEditor(row)}
        onRefresh={load}
        emptyMessage={
          isAr
            ? 'لا كروب مسجَّل بعد — ابدأ بـ«كروب جديد»'
            : 'No group fares yet — start with "New group"'
        }
      />

      {opening && (
        <div className="fixed inset-0 z-9997 bg-slate-900/20 backdrop-blur-[2px] flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 px-5 py-4 flex items-center gap-3 text-sm font-bold text-slate-700">
            <Loader size="sm" color="orange" />
            <span>{isAr ? 'جارٍ فتح الكروب بكامل بياناته…' : 'Loading the group…'}</span>
          </div>
        </div>
      )}

      <GroupDesignWorkspace
        opened={workspaceOpen}
        initialData={editing}
        onClose={() => {
          setWorkspaceOpen(false);
          setEditing(null);
        }}
        onSuccess={() => {
          setWorkspaceOpen(false);
          setEditing(null);
          load();
        }}
      />

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
              <IconTrash size={19} />
            </div>
            <div>
              <div className="text-sm font-black text-slate-900">
                {isAr ? 'حذف الكروب نهائياً' : 'Delete this group'}
              </div>
              <div className="text-xs text-slate-500 leading-relaxed mt-0.5">
                {isAr
                  ? 'يُحذف الكروب وقيده المحاسبي معاً، ولا يمكن التراجع.'
                  : 'The group and its journal entry are removed together. This cannot be undone.'}
              </div>
            </div>
          </div>

          {deleteTarget && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs space-y-1">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500 font-bold">{isAr ? 'رقم الكروب:' : 'Group:'}</span>
                <span className="font-mono font-black text-slate-900" dir="ltr">
                  {deleteTarget.invoiceNumber}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500 font-bold">{isAr ? 'المستفيد:' : 'Beneficiary:'}</span>
                <span className="font-black text-slate-900">{deleteTarget.customerName || '—'}</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
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
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <IconTrash size={14} />
              {isAr ? 'حذف نهائي' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default GroupsPage;
