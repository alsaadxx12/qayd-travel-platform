import React, { useState, useMemo, useEffect } from 'react';
import {
  Trash2, RotateCcw, Search, X, ArrowRight,
  Plane, FileText, Users, Building2, Receipt, Clock,
  ChevronLeft, ChevronRight, Archive, Filter,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguageStore } from '../../store/useLanguageStore';
import { getDeletedRecords, removeFromArchive, clearArchive, DeletedRecord } from '../../utils/deletedRecordsArchive';
import { ticketsApi } from '../../api/tickets';
import { hotelsApi } from '../../api/hotels';
import { SegmentedDatePicker } from '../../components/ui/SegmentedDatePicker';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';

const TYPE_ICONS: Record<string, React.ElementType> = {
  ticket: Plane, visa: FileText, group: Users, hotel: Building2,
  receipt_voucher: Receipt, payment_voucher: Receipt, journal_entry: FileText,
};
const TYPE_COLORS: Record<string, string> = {
  ticket: 'bg-sky-50 text-sky-600 border-sky-100',
  visa: 'bg-teal-50 text-teal-600 border-teal-100',
  group: 'bg-violet-50 text-violet-600 border-violet-100',
  hotel: 'bg-orange-50 text-[#F45A0A] border-orange-100',
  receipt_voucher: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  payment_voucher: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  journal_entry: 'bg-slate-100 text-slate-600 border-slate-200',
};
const TYPE_DOT: Record<string, string> = {
  ticket: 'bg-sky-500', visa: 'bg-teal-500', group: 'bg-violet-500',
  hotel: 'bg-orange-500', receipt_voucher: 'bg-emerald-500',
  payment_voucher: 'bg-indigo-500', journal_entry: 'bg-slate-500',
};

function fmtMoney(n: number) {
  if (!n && n !== 0) return '0';
  return Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function timeAgo(d: string, isAr: boolean) {
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000), h = Math.floor(m / 60), dy = Math.floor(h / 24);
  if (m < 1) return isAr ? '\u0627\u0644\u0622\u0646' : 'Just now';
  if (m < 60) return isAr ? `\u0645\u0646\u0630 ${m} \u062f\u0642\u064a\u0642\u0629` : `${m}m ago`;
  if (h < 24) return isAr ? `\u0645\u0646\u0630 ${h} \u0633\u0627\u0639\u0629` : `${h}h ago`;
  if (dy < 7) return isAr ? `\u0645\u0646\u0630 ${dy} \u064a\u0648\u0645` : `${dy}d ago`;
  return new Date(d).toLocaleDateString('en-GB');
}

function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function monthStart() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; }

const ALL_TYPES = [
  { key: 'ticket', ar: '\u062a\u0630\u0627\u0643\u0631', en: 'Tickets', icon: Plane },
  { key: 'visa', ar: '\u0641\u064a\u0632\u0627', en: 'Visas', icon: FileText },
  { key: 'group', ar: '\u0643\u0631\u0648\u0628\u0627\u062a', en: 'Groups', icon: Users },
  { key: 'hotel', ar: '\u0641\u0646\u0627\u062f\u0642', en: 'Hotels', icon: Building2 },
  { key: 'receipt_voucher', ar: '\u0633\u0646\u062f\u0627\u062a \u0642\u0628\u0636', en: 'Receipts', icon: Receipt },
  { key: 'payment_voucher', ar: '\u0633\u0646\u062f\u0627\u062a \u062f\u0641\u0639', en: 'Payments', icon: Receipt },
];

export const DeletedRecordsPage: React.FC = () => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';
  const navigate = useNavigate();

  const [records, setRecords] = useState<DeletedRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [dateFrom, setDateFrom] = useState(monthStart());
  const [dateTo, setDateTo] = useState(today());
  const pageSize = 15;

  useEffect(() => { setRecords(getDeletedRecords()); }, []);

  // Filtered
  const filteredRecords = useMemo(() => {
    let list = records;
    if (activeFilter !== 'all') list = list.filter((r) => r.type === activeFilter);
    if (dateFrom) { const f = new Date(dateFrom); f.setHours(0,0,0,0); list = list.filter((r) => new Date(r.deletedAt) >= f); }
    if (dateTo) { const t = new Date(dateTo); t.setHours(23,59,59,999); list = list.filter((r) => new Date(r.deletedAt) <= t); }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((r) =>
        (r.number||'').toLowerCase().includes(q) || (r.description||'').toLowerCase().includes(q) ||
        (r.typeLabel.ar||'').includes(q) || (r.typeLabel.en||'').toLowerCase().includes(q)
      );
    }
    return list;
  }, [records, activeFilter, searchQuery, dateFrom, dateTo]);

  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const typeCounts = useMemo(() => { const c: Record<string,number> = {}; records.forEach(r => { c[r.type]=(c[r.type]||0)+1; }); return c; }, [records]);

  const handleRestore = async (record: DeletedRecord) => {
    setRestoringId(record.id);
    try {
      const data = record.originalData;
      if (record.type === 'ticket') await ticketsApi.create(data);
      else if (record.type === 'hotel') await hotelsApi.create(data);
      removeFromArchive(record.id);
      setRecords(getDeletedRecords());
      showSuccessNotification(isAr ? '\u062a\u0645 \u0627\u0644\u0627\u0633\u062a\u0631\u062c\u0627\u0639' : 'Restored', `${record.typeLabel[isAr?'ar':'en']}: ${record.number}`);
    } catch (err: any) {
      showErrorNotification(isAr ? '\u062e\u0637\u0623' : 'Error', err?.message || '');
    } finally { setRestoringId(null); }
  };

  const handlePermanentDelete = (record: DeletedRecord) => {
    if (window.confirm(isAr ? `\u062d\u0630\u0641 \u0646\u0647\u0627\u0626\u064a \u0644\u0640 ${record.number}\u061f` : `Permanently delete ${record.number}?`)) {
      removeFromArchive(record.id); setRecords(getDeletedRecords());
    }
  };

  const handleClearAll = () => {
    if (window.confirm(isAr ? '\u062d\u0630\u0641 \u062c\u0645\u064a\u0639 \u0627\u0644\u0633\u062c\u0644\u0627\u062a \u0646\u0647\u0627\u0626\u064a\u0627\u064b\u061f' : 'Clear all deleted records?')) {
      clearArchive(); setRecords([]);
    }
  };

  return (
    <div className="space-y-3 w-full select-none" dir={direction}>

      {/* ━━━━ 1. HEADER CARD (Title + Back) ━━━━ */}
      <div className="bg-white rounded-[14px] border border-[#E5E7EB] shadow-2xs overflow-hidden">
        <div className="h-[56px] px-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="h-9 w-9 rounded-xl bg-[#FAFAFA] hover:bg-slate-100 border border-[#E5E7EB] text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
              title={isAr ? '\u0631\u062c\u0648\u0639' : 'Back'}
            >
              <ArrowRight size={16} className={direction === 'ltr' ? 'rotate-180' : ''} />
            </button>
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 text-white flex items-center justify-center shadow-sm">
              <Archive size={17} />
            </div>
            <div>
              <h1 className="text-[15px] font-black text-slate-900 leading-tight">
                {isAr ? '\u0633\u062c\u0644 \u0627\u0644\u0645\u062d\u0630\u0648\u0641\u0627\u062a' : 'Deleted Records'}
              </h1>
              <span className="text-[11px] text-[#9CA3AF]">
                {isAr ? '\u0627\u0633\u062a\u0639\u0631\u0627\u0636 \u0648\u0627\u0633\u062a\u0631\u062c\u0627\u0639 \u0627\u0644\u0633\u062c\u0644\u0627\u062a \u0627\u0644\u0645\u062d\u0630\u0648\u0641\u0629' : 'Browse & restore deleted records'}
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-slate-400 font-bold">{isAr ? '\u0625\u062c\u0645\u0627\u0644\u064a' : 'Total'}</span>
              <span className="text-[16px] font-black text-slate-900 font-mono tabular-nums">{records.length}</span>
            </div>
            <div className="w-px h-7 bg-slate-200" />
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-slate-400 font-bold">{isAr ? '\u0645\u0639\u0631\u0648\u0636' : 'Showing'}</span>
              <span className="text-[16px] font-black text-[#F45A0A] font-mono tabular-nums">{filteredRecords.length}</span>
            </div>
            {records.length > 0 && (
              <>
                <div className="w-px h-7 bg-slate-200" />
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="h-9 px-3.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-rose-100"
                >
                  <Trash2 size={13} />
                  <span>{isAr ? '\u0645\u0633\u062d \u0627\u0644\u0643\u0644' : 'Clear All'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ━━━━ 2. FILTER BAR (Search + Date Range + Type Filters) ━━━━ */}
      <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-3.5 shadow-2xs">
        <div className="flex items-center justify-between gap-3.5 flex-wrap">

          {/* Search Input (Right side in RTL) */}
          <div className="relative min-w-[220px] max-w-[320px] flex-1">
            <Search size={16} className={`absolute ${direction === 'rtl' ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 text-slate-400`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder={isAr ? '\u0628\u062d\u062b \u0628\u0627\u0644\u0631\u0642\u0645 \u0623\u0648 \u0627\u0644\u0627\u0633\u0645...' : 'Search by number or name...'}
              className={`w-full h-[44px] ${direction === 'rtl' ? 'pr-10 pl-3.5' : 'pl-10 pr-3.5'} rounded-[10px] bg-[#FAFAFA] border border-[#E5E7EB] text-[13.5px] text-[#111827] placeholder-[#9CA3AF] outline-none hover:bg-white hover:border-[#D1D5DB] focus:bg-white focus:border-2 focus:border-[#F45A0A] transition-colors`}
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')} className={`absolute ${direction === 'rtl' ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer`}>
                <X size={14} />
              </button>
            )}
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-3.5 flex-wrap">
            <div className="flex items-center gap-2" dir="ltr">
              <span className="text-xs font-bold text-slate-600 shrink-0 select-none">{isAr ? 'من:' : 'From:'}</span>
              <div className="w-[245px]">
                <SegmentedDatePicker value={dateFrom ? new Date(dateFrom) : null} onChange={(d) => { setDateFrom(d ? d.toISOString().split('T')[0] : ''); setCurrentPage(1); }} clearable={true} placeholder="—" />
              </div>
            </div>
            <div className="flex items-center gap-2" dir="ltr">
              <span className="text-xs font-bold text-slate-600 shrink-0 select-none">{isAr ? 'إلى:' : 'To:'}</span>
              <div className="w-[245px]">
                <SegmentedDatePicker value={dateTo ? new Date(dateTo) : null} onChange={(d) => { setDateTo(d ? d.toISOString().split('T')[0] : ''); setCurrentPage(1); }} clearable={true} placeholder="—" />
              </div>
            </div>
          </div>

          {/* Type Filter Dropdown / Chips */}
          <div className="flex items-center gap-1.5">
            <Filter size={13} className="text-slate-400" />
            <button
              type="button"
              onClick={() => { setActiveFilter('all'); setCurrentPage(1); }}
              className={`h-[34px] px-3 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                activeFilter === 'all'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white text-slate-500 border-[#E5E7EB] hover:bg-slate-50'
              }`}
            >
              {isAr ? '\u0627\u0644\u0643\u0644' : 'All'} <span className={`ms-1 text-[10px] font-mono ${activeFilter === 'all' ? 'text-slate-400' : 'text-slate-300'}`}>{records.length}</span>
            </button>
            {ALL_TYPES.map((t) => {
              const count = typeCounts[t.key] || 0;
              if (count === 0) return null;
              const TIcon = t.icon;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => { setActiveFilter(t.key); setCurrentPage(1); }}
                  className={`h-[34px] px-2.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer border flex items-center gap-1 ${
                    activeFilter === t.key
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-white text-slate-500 border-[#E5E7EB] hover:bg-slate-50'
                  }`}
                >
                  <TIcon size={12} />
                  <span>{isAr ? t.ar : t.en}</span>
                  <span className={`text-[10px] font-mono ${activeFilter === t.key ? 'text-slate-400' : 'text-slate-300'}`}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ━━━━ 3. DATA TABLE CARD ━━━━ */}
      {filteredRecords.length === 0 ? (
        <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-16 shadow-2xs flex flex-col items-center justify-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-300 flex items-center justify-center">
            <Trash2 size={26} />
          </div>
          <span className="text-sm font-bold text-slate-700">
            {isAr ? '\u0644\u0627 \u062a\u0648\u062c\u062f \u0633\u062c\u0644\u0627\u062a \u0645\u062d\u0630\u0648\u0641\u0629' : 'No deleted records'}
          </span>
          <span className="text-[11px] text-slate-400 text-center max-w-[320px]">
            {isAr
              ? '\u0639\u0646\u062f \u062d\u0630\u0641 \u0623\u064a \u062a\u0630\u0643\u0631\u0629 \u0623\u0648 \u0641\u064a\u0632\u0627 \u0623\u0648 \u062d\u062c\u0632 \u0641\u0646\u062f\u0642 \u0623\u0648 \u0633\u0646\u062f \u0633\u062a\u0638\u0647\u0631 \u0647\u0646\u0627 \u0648\u064a\u0645\u0643\u0646\u0643 \u0627\u0633\u062a\u0631\u062c\u0627\u0639\u0647\u0627'
              : 'Deleted tickets, visas, hotel bookings, and vouchers will appear here'}
          </span>
        </div>
      ) : (
        <div className="bg-white rounded-[14px] border border-[#E5E7EB] shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className={`w-full text-${direction === 'rtl' ? 'right' : 'left'} border-collapse text-[13px]`}>
              {/* Table Header */}
              <thead>
                <tr className="h-[48px] bg-[#F8FAFC] border-b border-[#E5E7EB] text-[#475569] font-semibold text-[12.5px]">
                  <th className="px-3.5 py-2 whitespace-nowrap text-center w-12">#</th>
                  <th className="px-3.5 py-2 whitespace-nowrap">{isAr ? '\u0631\u0642\u0645 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629' : 'Invoice No.'}</th>
                  <th className="px-3.5 py-2 whitespace-nowrap">{isAr ? '\u0627\u0644\u0648\u0635\u0641' : 'Description'}</th>
                  <th className="px-3.5 py-2 whitespace-nowrap text-center">{isAr ? '\u0627\u0644\u0646\u0648\u0639' : 'Type'}</th>
                  <th className="px-3.5 py-2 whitespace-nowrap text-center">{isAr ? '\u0627\u0644\u0645\u0628\u0644\u063a' : 'Amount'}</th>
                  <th className="px-3.5 py-2 whitespace-nowrap text-center">{isAr ? '\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u062d\u0630\u0641' : 'Deleted At'}</th>
                  <th className="px-3.5 py-2 whitespace-nowrap text-center">{isAr ? '\u0627\u0644\u0625\u062c\u0631\u0627\u0621\u0627\u062a' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRecords.map((record, idx) => {
                  const Icon = TYPE_ICONS[record.type] || FileText;
                  const colors = TYPE_COLORS[record.type] || '';
                  const dot = TYPE_DOT[record.type] || 'bg-slate-500';
                  const isRestoring = restoringId === record.id;
                  const rowNum = (currentPage - 1) * pageSize + idx + 1;

                  return (
                    <tr
                      key={record.id + record.deletedAt}
                      className={`h-[52px] transition-colors ${
                        idx % 2 === 0 ? 'bg-white hover:bg-orange-50/30' : 'bg-[#FAFAFA] hover:bg-orange-50/30'
                      }`}
                    >
                      {/* # */}
                      <td className="px-3.5 py-2 text-center font-mono font-bold text-[12px] text-slate-300 tabular-nums">
                        {rowNum}
                      </td>

                      {/* Invoice Number */}
                      <td className="px-3.5 py-2">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${colors}`}>
                            <Icon size={14} />
                          </div>
                          <span className="text-[12.5px] font-black text-slate-900 font-mono" dir="ltr">
                            {record.number || '\u2014'}
                          </span>
                        </div>
                      </td>

                      {/* Description */}
                      <td className="px-3.5 py-2">
                        <span className="text-[12px] text-slate-600 truncate block max-w-[250px]">
                          {record.description || '\u2014'}
                        </span>
                      </td>

                      {/* Type Badge */}
                      <td className="px-3.5 py-2 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${colors}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                          {isAr ? record.typeLabel.ar : record.typeLabel.en}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="px-3.5 py-2 text-center">
                        {record.amount ? (
                          <span className="text-[12px] font-bold font-mono text-slate-800 tabular-nums">
                            {fmtMoney(record.amount)} <span className="text-[10px] text-slate-400">{record.currency}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-300">\u2014</span>
                        )}
                      </td>

                      {/* Deleted At */}
                      <td className="px-3.5 py-2 text-center">
                        <span className="text-[11px] text-slate-500 flex items-center gap-1 justify-center">
                          <Clock size={11} className="text-slate-300" />
                          {timeAgo(record.deletedAt, isAr)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-3.5 py-2 text-center">
                        <div className="flex items-center gap-1.5 justify-center">
                          <button
                            type="button"
                            onClick={() => handleRestore(record)}
                            disabled={isRestoring}
                            className="h-8 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer border border-emerald-100 disabled:opacity-50"
                          >
                            <RotateCcw size={12} className={isRestoring ? 'animate-spin' : ''} />
                            <span>{isAr ? '\u0627\u0633\u062a\u0631\u062c\u0627\u0639' : 'Restore'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePermanentDelete(record)}
                            className="h-8 w-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-500 flex items-center justify-center transition-all cursor-pointer border border-rose-100"
                            title={isAr ? '\u062d\u0630\u0641 \u0646\u0647\u0627\u0626\u064a' : 'Delete permanently'}
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Pagination Footer ── */}
          <div className="h-[46px] px-4 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 whitespace-nowrap">
            <div className="flex items-center gap-2">
              <span>{isAr ? '\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0633\u062c\u0644\u0627\u062a:' : 'Total Records:'}</span>
              <span className="font-bold font-mono text-slate-900 tabular-nums">{filteredRecords.length}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center disabled:opacity-25 cursor-pointer hover:bg-slate-50 transition-colors"
              >
                {direction === 'rtl' ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
              </button>
              <span className="font-mono font-bold text-slate-900 tabular-nums px-1.5">{currentPage} / {totalPages}</span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center disabled:opacity-25 cursor-pointer hover:bg-slate-50 transition-colors"
              >
                {direction === 'rtl' ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
