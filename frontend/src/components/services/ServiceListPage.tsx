import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader, Modal } from '@mantine/core';
import {
  IconPlus,
  IconRefresh,
  IconSearch,
  IconEdit,
  IconTrash,
  IconCoins,
  IconTrendingUp,
  IconFileInvoice,
  IconStack2,
} from '@tabler/icons-react';
import { AccountingGrid, AccountingColumnDef, AccountingActionMenuItem } from '../common/AccountingGrid';
import { matchesSearchTokens } from '../ui/SearchableCombobox';
import { ServiceInvoiceWorkspace } from './ServiceInvoiceWorkspace';
import { SERVICE_KINDS, decodeServiceExtras, type ServiceKindId } from './serviceKinds';
import { ticketsApi, type TicketData } from '../../api/tickets';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { useLanguageStore } from '../../store/useLanguageStore';

const money = (v: number, currency = 'IQD') =>
  `${Number(v || 0).toLocaleString('en-US')} ${currency === 'USD' ? '$' : 'IQD'}`;

const StatCard: React.FC<{ label: string; value: string; icon: any; stripe: string; tone: string }> = ({
  label,
  value,
  icon: Icon,
  stripe,
  tone,
}) => (
  <div className="relative bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
    <div className={`absolute inset-x-0 top-0 h-1 ${stripe}`} />
    <div className="p-3.5 pt-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <span className="text-[11px] font-bold text-slate-500 block">{label}</span>
        <span className="text-lg font-black text-slate-900 block mt-0.5 font-mono truncate" dir="ltr">
          {value}
        </span>
      </div>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${tone}`}>
        <Icon size={17} />
      </div>
    </div>
  </div>
);

/**
 * سجل خدمة: التغييرات أو الفنادق أو مبيعات الوزن.
 *
 * صفحة واحدة تخدم الثلاث لأن السجل واحد في بنيته — بحثٌ وأرقامٌ وجدولٌ وإجراءان
 * — ويختلف كلٌّ في وسمه وعناوينه، وهي موصوفة في serviceKinds. وما يُعرض تذاكر
 * موسومة بنوع الخدمة، فما في السجل هو ما في القاعدة لا نسخةٌ منه.
 */
export const ServiceListPage: React.FC<{ kind: ServiceKindId }> = ({ kind }) => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';
  const def = SERVICE_KINDS[kind];

  const [rows, setRows] = useState<TicketData[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<TicketData | null>(null);
  const [opening, setOpening] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TicketData | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await ticketsApi.getAll({ limit: 300 });
      setRows(
        (Array.isArray(all) ? all : []).filter(
          (t: any) => String(t.tripType || '').toUpperCase() === def.tripType,
        ),
      );
    } catch (err: any) {
      showErrorNotification(isAr ? 'تعذّر الجلب' : 'Load failed', err?.message || '');
    } finally {
      setLoading(false);
    }
  }, [def.tripType, isAr]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    return rows.filter((t: any) =>
      matchesSearchTokens(
        [t.invoiceNumber, t.customerName, t.supplierAccountName, t.pnr, t.notes].filter(Boolean).join(' '),
        search,
      ),
    );
  }, [rows, search]);

  const totals = useMemo(() => {
    let units = 0;
    let sell = 0;
    let profit = 0;
    filtered.forEach((t: any) => {
      units += (t.passengers || []).length;
      sell += Number(t.netSell ?? t.totalSell ?? 0);
      profit += Number(t.profit ?? 0);
    });
    return { count: filtered.length, units, sell, profit };
  }, [filtered]);

  const openEditor = async (row?: TicketData) => {
    if (!row) {
      setEditing(null);
      setEditorOpen(true);
      return;
    }
    setOpening(true);
    try {
      const full = await ticketsApi.getOne(row.id as string).catch(() => row);
      setEditing(full || row);
      setEditorOpen(true);
    } finally {
      setOpening(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget?.id) return;
    const removed = deleteTarget;
    setRows((prev) => prev.filter((t) => t.id !== removed.id));
    setDeleteTarget(null);
    try {
      await ticketsApi.delete(removed.id as string);
      showSuccessNotification(isAr ? 'تم الحذف' : 'Deleted', removed.invoiceNumber || '');
    } catch (err: any) {
      setRows((prev) => (prev.some((t) => t.id === removed.id) ? prev : [removed, ...prev]));
      showErrorNotification(isAr ? 'تعذّر الحذف' : 'Delete failed', err?.message || '');
    }
  };

  const columnDefs: AccountingColumnDef[] = useMemo(
    () => [
      {
        field: 'invoiceNumber',
        headerText: isAr ? 'رقم الفاتورة' : 'Invoice',
        width: 'w-40',
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
        headerText: isAr ? 'العميل' : 'Customer',
        isWide: true,
        render: (r) => (
          <div className="leading-tight min-w-0">
            <span className="font-bold text-[12px] text-slate-900 block truncate">{r.customerName || '—'}</span>
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
        field: 'details',
        headerText: isAr ? 'التفاصيل' : 'Details',
        width: 'w-56',
        render: (r) => {
          const { extras } = decodeServiceExtras(r.notes);
          const shown = def.extraFields
            .filter((f) => extras[f.key])
            .slice(0, 3)
            .map((f) => `${isAr ? f.ar : f.en}: ${extras[f.key]}`);
          if (!shown.length) return <span className="text-slate-300">—</span>;
          return (
            <div className="flex flex-wrap gap-1">
              {shown.map((s, i) => (
                <span
                  key={i}
                  className="text-[10px] font-bold bg-slate-50 border border-slate-200 text-slate-700 rounded px-1.5 py-0.5 whitespace-nowrap"
                >
                  {s}
                </span>
              ))}
            </div>
          );
        },
      },
      {
        field: 'units',
        headerText: isAr ? def.quantityAr : def.quantityEn,
        width: 'w-24',
        align: 'center',
        render: (r) => (
          <span className="inline-flex items-center gap-1 text-[11px] font-black bg-indigo-50 text-indigo-900 border border-indigo-200 rounded-md px-1.5 py-0.5">
            {(r.passengers || []).length || '—'}
          </span>
        ),
      },
      {
        field: 'netSell',
        headerText: isAr ? 'البيع' : 'Sale',
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
              className={`font-mono font-black text-[12px] ${p > 0 ? 'text-[#078B61]' : p < 0 ? 'text-red-600' : 'text-slate-500'}`}
              dir="ltr"
            >
              {p >= 0 ? `+${money(p, r.currency)}` : money(p, r.currency)}
            </span>
          );
        },
      },
    ],
    [isAr, def],
  );

  const actionMenuItems: AccountingActionMenuItem[] = useMemo(
    () => [
      { label: isAr ? 'تعديل' : 'Edit', icon: IconEdit, onClick: (row: any) => openEditor(row) },
      { label: isAr ? 'حذف' : 'Delete', icon: IconTrash, color: 'red', onClick: (row: any) => setDeleteTarget(row) },
    ],
    [isAr],
  );

  return (
    <div className="w-full max-w-[1760px] mx-auto px-4 sm:px-6 py-4 space-y-4 font-sans select-none" dir={direction}>
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#F45A0A] to-[#f59e0b] text-white flex items-center justify-center shrink-0">
              <IconFileInvoice size={22} />
            </div>
            <div>
              <h1 className="font-black text-base text-slate-900 leading-tight">{isAr ? def.titleAr : def.titleEn}</h1>
              <p className="text-[11.5px] text-slate-500 font-bold mt-0.5">{isAr ? def.subtitleAr : def.subtitleEn}</p>
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
                placeholder={isAr ? 'ابحث برقم الفاتورة أو العميل…' : 'Search by invoice or customer…'}
                className="h-9 w-60 rounded-xl border border-slate-200 bg-white text-[12px] font-bold outline-none focus:border-[#F45A0A] focus:ring-2 focus:ring-orange-100"
                style={{ paddingInlineStart: 32, paddingInlineEnd: 10 }}
              />
            </div>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <IconRefresh size={14} className={loading ? 'animate-spin' : ''} />
              {isAr ? 'تحديث' : 'Refresh'}
            </button>
            <button
              type="button"
              onClick={() => openEditor()}
              className="h-9 px-4 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white text-xs font-black cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <IconPlus size={15} />
              {isAr ? 'إصدار جديد' : 'New'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label={isAr ? 'عدد الفواتير' : 'Invoices'}
          value={String(totals.count)}
          icon={IconFileInvoice}
          stripe="bg-[#F45A0A]"
          tone="bg-orange-50 border-orange-200 text-[#F45A0A]"
        />
        <StatCard
          label={isAr ? `إجمالي ${def.quantityAr}` : `Total ${def.quantityEn.toLowerCase()}`}
          value={String(totals.units)}
          icon={IconStack2}
          stripe="bg-indigo-500"
          tone="bg-indigo-50 border-indigo-200 text-indigo-600"
        />
        <StatCard
          label={isAr ? 'إجمالي البيع' : 'Total sales'}
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

      <AccountingGrid
        gridKey={`service_${kind}_grid`}
        data={filtered}
        columnDefs={columnDefs}
        loading={loading}
        actionMenuItems={actionMenuItems}
        onRowDoubleClick={(row: any) => openEditor(row)}
        onRefresh={load}
        emptyMessage={isAr ? `لا ${def.titleAr} بعد — ابدأ بـ«إصدار جديد»` : 'Nothing yet'}
      />

      {opening && (
        <div className="fixed inset-0 z-[9997] bg-slate-900/20 backdrop-blur-[2px] flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 px-5 py-4 flex items-center gap-3 text-sm font-bold text-slate-700">
            <Loader size="sm" color="orange" />
            <span>{isAr ? 'جارٍ الفتح…' : 'Loading…'}</span>
          </div>
        </div>
      )}

      <ServiceInvoiceWorkspace
        kind={kind}
        opened={editorOpen}
        initialData={editing}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        onSuccess={() => {
          setEditorOpen(false);
          setEditing(null);
          load();
        }}
      />

      <Modal opened={!!deleteTarget} onClose={() => setDeleteTarget(null)} centered radius="lg" withCloseButton={false}>
        <div className="space-y-3 font-sans" dir={direction}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
              <IconTrash size={19} />
            </div>
            <div>
              <div className="text-sm font-black text-slate-900">{isAr ? 'حذف نهائي' : 'Delete'}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {isAr ? 'تُحذف الفاتورة وقيدها معاً، ولا يمكن التراجع.' : 'The invoice and its journal entry go together.'}
              </div>
              <div className="font-mono font-black text-slate-900 text-xs mt-1.5" dir="ltr">
                {deleteTarget?.invoiceNumber}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
            >
              {isAr ? 'حذف' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ServiceListPage;
