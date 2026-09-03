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
  IconTrendingDown,
  IconFileInvoice,
} from '@tabler/icons-react';
import { Luggage } from 'lucide-react';
import { AccountingGrid, AccountingColumnDef, AccountingActionMenuItem } from '../common/AccountingGrid';
import { AccountingDateRangePicker } from '../common/date/AccountingDateRangePicker';
import { matchesSearchTokens } from '../ui/SearchableCombobox';
import { ServiceInvoiceWorkspace } from './ServiceInvoiceWorkspace';
import { BaggageInvoiceModal } from '../baggage/BaggageInvoiceModal';
import { SERVICE_KINDS, type ServiceKindId } from './serviceKinds';
import { ticketsApi, type TicketData } from '../../api/tickets';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { useLanguageStore } from '../../store/useLanguageStore';

const formatNum = (v: number) =>
  Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });

const StatCard: React.FC<{
  label: string;
  value: string;
  subValue?: string;
}> = ({ label, value, subValue }) => (
  /*
   * بطاقة بهوية النظام وحدها: أبيض وبرتقالي، بلا أيقونات ولا ألوانٍ لكل بطاقة.
   * الشريط العلوي البرتقالي هو التوقيع، والارتفاع الأكبر يمنح الرقم مقامه.
   */
  <div className="relative bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden px-5 py-6 min-h-[118px] flex flex-col justify-center">
    <div className="absolute top-0 inset-x-0 h-1 bg-[#F45A0A]" />
    <span className="text-[12px] font-bold text-slate-500 block truncate">{label}</span>
    <span className="text-2xl font-black text-slate-900 block mt-1.5 font-mono tracking-tight truncate" dir="ltr">
      {value}
    </span>
    {subValue && (
      <span className="text-[11px] font-bold text-[#F45A0A]/70 block mt-1 truncate">{subValue}</span>
    )}
  </div>
);

/**
 * سجل خدمة: مبيعات الوزن الإضافي والخدمات الأخرى.
 */
export const ServiceListPage: React.FC<{ kind: ServiceKindId }> = ({ kind }) => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';
  const def = SERVICE_KINDS[kind];

  const [rows, setRows] = useState<TicketData[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  
  // Date Range Filters (تقويم وتاريخ بنفس حقول النظام)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

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

  // تصفية السجلات حسب البحث والنطاق الزمني
  const filtered = useMemo(() => {
    return rows.filter((t: any) => {
      // فلترة التاريخ
      if (startDate) {
        const rowDate = new Date(t.issueDate || t.createdAt).getTime();
        if (rowDate < new Date(startDate).getTime()) return false;
      }
      if (endDate) {
        const rowDate = new Date(t.issueDate || t.createdAt).getTime();
        if (rowDate > new Date(endDate).getTime() + 86400000) return false;
      }

      // فلترة البحث
      if (search.trim()) {
        const matches = matchesSearchTokens(
          [t.invoiceNumber, t.customerName, t.supplierAccountName, t.pnr, t.notes].filter(Boolean).join(' '),
          search,
        );
        if (!matches) return false;
      }

      return true;
    });
  }, [rows, search, startDate, endDate]);

  // إحصائيات البطاقات: فواتير، تكلفة شراء، إجمالي مبيعات، صافي أرباح
  const totals = useMemo(() => {
    let buy = 0;
    let sell = 0;
    let profit = 0;
    filtered.forEach((t: any) => {
      buy += Number(t.netBuy ?? t.totalBuy ?? 0);
      sell += Number(t.netSell ?? t.totalSell ?? 0);
      profit += Number(t.profit ?? 0);
    });
    return {
      count: filtered.length,
      buy,
      sell,
      profit,
    };
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

  // ════════════════════════════════════════════════════════════════
  // أعمدة الجدول حسب طلب المستخدم الدقيق:
  // رقم الفاتورة | المورد | العملة | مبلغ الشراء | العميل | مبلغ البيع | الفرق (الربح)
  // ════════════════════════════════════════════════════════════════
  const columnDefs: AccountingColumnDef[] = useMemo(
    () => [
      // 1. رقم الفاتورة
      {
        field: 'invoiceNumber',
        headerText: isAr ? 'رقم الفاتورة' : 'Invoice No',
        width: 'w-44',
        isPinned: true,
        render: (r) => (
          <div className="leading-tight">
            <span className="font-mono font-black text-[12px] text-slate-900 block" dir="ltr">
              {r.invoiceNumber || '—'}
            </span>
            <span className="text-[10px] font-bold text-slate-400 font-mono block mt-0.5" dir="ltr">
              {r.issueDate ? new Date(r.issueDate).toLocaleDateString('en-GB') : ''}
              {r.pnr && (
                <span className="ms-1.5 px-1 py-0.2 rounded bg-orange-50 text-[#F45A0A] border border-orange-200 text-[9.5px]">
                  PNR: {r.pnr}
                </span>
              )}
            </span>
          </div>
        ),
      },

      // 2. المورد
      {
        field: 'supplierAccountName',
        headerText: isAr ? 'المورد' : 'Supplier',
        isWide: true,
        render: (r) => (
          <div className="leading-tight min-w-0">
            <span className="font-bold text-[12px] text-slate-800 block truncate">
              {r.supplierAccountName || '—'}
            </span>
          </div>
        ),
      },

      // 3. العملة (قبل حقول المبالغ مباشرة كما طلب المستخدم)
      {
        field: 'currency',
        headerText: isAr ? 'العملة' : 'Currency',
        width: 'w-24',
        align: 'center',
        render: (r) => {
          const curr = String(r.currency || 'USD').toUpperCase();
          return (
            <span className={`inline-flex items-center justify-center font-mono font-extrabold text-[11px] px-2 py-0.5 rounded border ${
              curr === 'USD'
                ? 'bg-slate-100 border-slate-300 text-slate-800'
                : 'bg-orange-50 border-orange-200 text-[#F45A0A]'
            }`}>
              {curr}
            </span>
          );
        },
      },

      // 4. مبلغ الشراء
      {
        field: 'netBuy',
        headerText: isAr ? 'مبلغ الشراء' : 'Buy Amount',
        width: 'w-32',
        align: 'left',
        isMonetary: true,
        render: (r) => (
          <span className="font-mono font-extrabold text-[12.5px] text-slate-800" dir="ltr">
            {formatNum(Number(r.netBuy ?? r.totalBuy ?? 0))}
          </span>
        ),
      },

      // 5. العميل
      {
        field: 'customerName',
        headerText: isAr ? 'العميل' : 'Customer',
        isWide: true,
        render: (r) => (
          <div className="leading-tight min-w-0">
            <span className="font-black text-[12px] text-slate-900 block truncate">
              {r.customerName || '—'}
            </span>
          </div>
        ),
      },

      // 6. مبلغ البيع
      {
        field: 'netSell',
        headerText: isAr ? 'مبلغ البيع' : 'Sell Amount',
        width: 'w-32',
        align: 'left',
        isMonetary: true,
        render: (r) => (
          <span className="font-mono font-black text-[12.5px] text-slate-900" dir="ltr">
            {formatNum(Number(r.netSell ?? r.totalSell ?? 0))}
          </span>
        ),
      },

      // 7. الفرق / الربح
      {
        field: 'profit',
        headerText: isAr ? 'الفرق (الربح)' : 'Profit',
        width: 'w-32',
        align: 'left',
        isMonetary: true,
        render: (r) => {
          const p = Number(r.profit ?? 0);
          return (
            <span
              className={`font-mono font-black text-[12.5px] ${
                p >= 0 ? 'text-[#078B61]' : 'text-rose-600'
              }`}
              dir="ltr"
            >
              {p >= 0 ? `+${formatNum(p)}` : formatNum(p)}
            </span>
          );
        },
      },
    ],
    [isAr],
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
      
      {/* ── 1. Header Toolbar (أيقونة حقيبة السفر ونفس لون القائمة الجانبية + تقويم النظام بدون زر إجراءات) ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Right side: Icon & Title (نفس أيقونة ولون السايدبار بالضبط) */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-orange-50 border border-orange-200/80 text-[#F45A0A] flex items-center justify-center shrink-0">
              {kind === 'BAGGAGE' ? <Luggage size={22} /> : <IconFileInvoice size={22} />}
            </div>
            <div>
              <h1 className="font-black text-base text-slate-900 leading-tight">
                {isAr ? def.titleAr : def.titleEn}
              </h1>
              <p className="text-[11.5px] text-slate-500 font-bold mt-0.5">
                {isAr ? def.subtitleAr : def.subtitleEn}
              </p>
            </div>
          </div>

          {/* Left side: Search + Date Range (تقويم النظام) + Refresh + New */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative">
              <IconSearch
                size={15}
                className="absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                style={{ insetInlineStart: 10 }}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isAr ? 'بحث برقم الفاتورة أو العميل أو المورد…' : 'Search…'}
                className="h-9 w-64 rounded-xl border border-slate-200 bg-white text-[12px] font-bold outline-none hover:border-slate-300 focus:border-[#F45A0A] transition-all"
                style={{ paddingInlineStart: 32, paddingInlineEnd: 10 }}
              />
            </div>

            {/* Date Range Picker (نفس تقويم النظام المعتمد) */}
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

            {/* Refresh */}
            <button
              type="button"
              onClick={load}
              disabled={loading}
              title={isAr ? 'تحديث البيانات' : 'Refresh'}
              className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer flex items-center gap-1.5 disabled:opacity-50 transition-colors shadow-2xs"
            >
              <IconRefresh size={14} className={loading ? 'animate-spin' : ''} />
              <span>{isAr ? 'تحديث' : 'Refresh'}</span>
            </button>

            {/* New Invoice */}
            <button
              type="button"
              onClick={() => openEditor()}
              className="h-9 px-4 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white text-xs font-black cursor-pointer flex items-center gap-1.5 shadow-xs transition-all active:scale-[0.98]"
            >
              <IconPlus size={15} />
              <span>{isAr ? 'إصدار جديد' : 'New'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. Stat Cards (تصميم نقي موحد حسب النظام: فواتير | تكلفة الشراء | إجمالي المبيعات | صافي الربح) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: عدد الفواتير */}
        <StatCard
          label={isAr ? 'عدد فواتير الوزن' : 'Total Invoices'}
          value={formatNum(totals.count)}
          subValue={isAr ? 'فاتورة مسجلة' : 'Recorded'}
        />

        {/* Card 2: تكلفة الشراء (بدل بطاقة عدد الكيلوات تماماً كما طلب المستخدم) */}
        <StatCard
          label={isAr ? 'تكلفة الشراء (الموردين)' : 'Total Buy Cost'}
          value={formatNum(totals.buy)}
          subValue={isAr ? 'إجمالي كلفة الشراء' : 'Total Cost'}
        />

        {/* Card 3: إجمالي المبيعات */}
        <StatCard
          label={isAr ? 'إجمالي المبيعات' : 'Total Sales'}
          value={formatNum(totals.sell)}
          subValue={isAr ? 'المطلوب من العملاء' : 'Total revenue'}
        />

        {/* Card 4: صافي الأرباح */}
        <StatCard
          label={isAr ? 'صافي أرباح الوزن' : 'Net Profit'}
          value={`+${formatNum(totals.profit)}`}
          subValue={isAr ? 'فرق البيع والشراء' : 'Profit difference'}
        />
      </div>

      {/* ── 3. AccountingGrid (إخفاء شريط الإجراءات والبحث المكرر للحصول على جدول فائق النقاء) ── */}
      <AccountingGrid
        gridKey={`service_${kind}_grid`}
        data={filtered}
        columnDefs={columnDefs}
        loading={loading}
        actionMenuItems={actionMenuItems}
        hideHeaderCard={true}
        hideActionsButton={true}
        onRowDoubleClick={(row: any) => openEditor(row)}
        onRefresh={load}
        emptyMessage={isAr ? `لا توجد فواتير بعد — ابدأ بـ«إصدار جديد»` : 'No invoices yet'}
      />

      {/* Loading Modal */}
      {opening && (
        <div className="fixed inset-0 z-[9997] bg-slate-900/20 backdrop-blur-[2px] flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 px-5 py-4 flex items-center gap-3 text-sm font-bold text-slate-700">
            <Loader size="sm" color="orange" />
            <span>{isAr ? 'جارٍ الفتح…' : 'Loading…'}</span>
          </div>
        </div>
      )}

      {/* Baggage Editor Modal */}
      {kind === 'BAGGAGE' ? (
        <BaggageInvoiceModal
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
      ) : (
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
      )}

      {/* Delete Confirmation Modal */}
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
