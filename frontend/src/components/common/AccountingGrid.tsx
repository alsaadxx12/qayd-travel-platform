import React, { useState, useMemo, useEffect } from 'react';
import {
  TextInput,
  Select,
  Button,
  ActionIcon,
  Menu,
  Checkbox,
  Switch,
  Popover,
  Badge,
} from '@mantine/core';
import {
  IconSearch,
  IconRefresh,
  IconPrinter,
  IconFileSpreadsheet,
  IconFileText,
  IconMail,
  IconDotsVertical,
  IconFilterOff,
  IconFilter,
  IconEye,
  IconColumns,
  IconChevronRight,
  IconChevronLeft,
  IconChevronDown,
  IconArrowsSort,
  IconSortAscending,
  IconSortDescending,
  IconGripVertical,
  IconRotate,
  IconReceipt,
} from '@tabler/icons-react';
import * as XLSX from 'xlsx';
import { AccountingDatePicker } from './date/AccountingDatePicker';
import { useLanguageStore } from '../../store/useLanguageStore';

export interface AccountingColumnDef {
  field: string;
  headerText: string;

  width?: string;
  isPinned?: boolean;
  align?: 'right' | 'left' | 'center';
  isMonetary?: boolean;
  isWide?: boolean;
  sortable?: boolean;
  render?: (row: any) => React.ReactNode;
}

export interface AccountingActionMenuItem {
  label: string;
  icon?: any;
  color?: string;
  onClick: (row: any) => void;
  hidden?: (row: any) => boolean;
}

interface AccountingGridProps {
  data: any[];
  columnDefs?: AccountingColumnDef[];
  columns?: any[];
  title?: string;
  gridKey?: string;
  loading?: boolean;
  emptyMessage?: string;
  summaryRows?: any[];
  keyField?: string;
  onRefresh?: () => void;
  actionMenuItems?: AccountingActionMenuItem[];
  onRowDoubleClick?: (row: any) => void;
  renderDetailRow?: (row: any) => React.ReactNode;
  typeFilterOptions?: { label: string; value: string }[];
  statusFilterOptions?: { label: string; value: string }[];
  hideExport?: boolean;
  hidePrint?: boolean;
  hideFilters?: boolean;
  hideDateFilter?: boolean;
  hideSearch?: boolean;
  hideClearFiltersButton?: boolean;
  hideHeaderCard?: boolean;
  hideFooter?: boolean;
  hideSelectionBanner?: boolean;
  hideSelectionCheckbox?: boolean;
  customFooterSummary?: React.ReactNode;
  renderTableSummaryRow?: (visibleColumns: AccountingColumnDef[]) => React.ReactNode;
  onRowContextMenu?: (e: React.MouseEvent, row: any) => void;
  renderSelectedActions?: (selectedRows: any[], clearSelection: () => void) => React.ReactNode;
  onExportExcel?: () => void;
  onOpenBatchStatements?: (selectedIds: string[]) => void;
  onSendEmail?: (selectedIds: string[]) => void;
  customToolbarElements?: React.ReactNode;
  getRowClassName?: (row: any) => string;
}

export const AccountingGrid: React.FC<AccountingGridProps> = ({
  data = [],
  columnDefs: rawColumnDefs,
  columns: altColumns,
  title,
  gridKey = 'default_accounting_grid',
  loading = false,
  emptyMessage,
  summaryRows,
  keyField,
  onRefresh,
  actionMenuItems = [],
  onRowDoubleClick,
  renderDetailRow,
  typeFilterOptions = [],
  statusFilterOptions = [],
  hideExport = false,
  hidePrint = false,
  hideFilters = false,
  hideDateFilter = false,
  hideSearch = false,
  hideClearFiltersButton = false,
  hideHeaderCard = false,
  hideFooter = false,
  hideSelectionBanner = false,
  hideSelectionCheckbox = false,
  customFooterSummary,
  renderTableSummaryRow,
  onRowContextMenu,
  renderSelectedActions,
  onExportExcel,
  onOpenBatchStatements,
  onSendEmail,
  customToolbarElements,
  getRowClassName,
}) => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  const columnDefs: AccountingColumnDef[] = useMemo(() => {

    const cols = rawColumnDefs || altColumns || [];
    return cols.map((c: any) => ({
      ...c,
      field: c.field || c.key || c.id || '',
      headerName: c.headerName || c.header || c.title || c.label || '',
    }));
  }, [rawColumnDefs, altColumns]);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | null>('ALL');
  const [statusFilter, setStatusFilter] = useState<string | null>('ALL');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Column Visibility & Sort State
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Pagination & Selection & Expand State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<string>('25');
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());

  // Column Order State (Drag & Drop)
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`cols_order_${gridKey}`);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return (rawColumnDefs || altColumns || []).map((c: any) => c.field || c.key || c.id || '');
  });

  const [draggedColIndex, setDraggedColIndex] = useState<number | null>(null);
  const [dragOverColIndex, setDragOverColIndex] = useState<number | null>(null);

  // Sync column order when columnDefs change
  useEffect(() => {
    const allFields = columnDefs.map(c => c.field);
    const savedStr = localStorage.getItem(`cols_order_${gridKey}`);
    if (savedStr) {
      try {
        const currentSaved: string[] = JSON.parse(savedStr);
        const ordered = currentSaved.filter(f => allFields.includes(f));
        allFields.forEach(f => {
          if (!ordered.includes(f)) ordered.push(f);
        });
        setColumnOrder(ordered);
        return;
      } catch (e) {}
    }
    setColumnOrder(allFields);
  }, [columnDefs, gridKey]);

  const toggleExpandRow = (id: string) => {
    setExpandedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Load Column Visibility State from LocalStorage
  useEffect(() => {
    const savedHidden = localStorage.getItem(`cols_hidden_${gridKey}`);
    if (savedHidden) {
      try {
        setHiddenCols(new Set(JSON.parse(savedHidden)));
      } catch (e) {}
    }
  }, [gridKey]);

  const toggleColumnVisibility = (field: string) => {
    const next = new Set(hiddenCols);
    if (next.has(field)) next.delete(field);
    else next.add(field);
    setHiddenCols(next);
    localStorage.setItem(`cols_hidden_${gridKey}`, JSON.stringify(Array.from(next)));
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      if (sortDir === 'asc') setSortDir('desc');
      else {
        setSortField(null);
        setSortDir('asc');
      }
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // Drag and Drop Column Reorder Handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedColIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColIndex !== index) {
      setDragOverColIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedColIndex === null || draggedColIndex === dropIndex) {
      setDraggedColIndex(null);
      setDragOverColIndex(null);
      return;
    }

    const newOrderedCols = [...orderedVisibleColumns];
    const [draggedCol] = newOrderedCols.splice(draggedColIndex, 1);
    newOrderedCols.splice(dropIndex, 0, draggedCol);

    const newOrderFields = newOrderedCols.map(c => c.field);
    columnOrder.forEach(f => {
      if (!newOrderFields.includes(f)) newOrderFields.push(f);
    });

    setColumnOrder(newOrderFields);
    localStorage.setItem(`cols_order_${gridKey}`, JSON.stringify(newOrderFields));

    setDraggedColIndex(null);
    setDragOverColIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedColIndex(null);
    setDragOverColIndex(null);
  };

  const handleResetColumns = () => {
    const defaultOrder = columnDefs.map(c => c.field);
    setColumnOrder(defaultOrder);
    setHiddenCols(new Set());
    localStorage.removeItem(`cols_order_${gridKey}`);
    localStorage.removeItem(`cols_hidden_${gridKey}`);
  };

  // Ordered and Visible Columns
  const orderedVisibleColumns = useMemo(() => {
    const colMap = new Map(columnDefs.map(c => [c.field, c]));
    const list: AccountingColumnDef[] = [];
    columnOrder.forEach(field => {
      const col = colMap.get(field);
      if (col && !hiddenCols.has(col.field)) {
        list.push(col);
      }
    });
    return list;
  }, [columnDefs, columnOrder, hiddenCols]);

  // The built-in period defaults to the last month, so it must only clip rows while its
  // own inputs are on screen; otherwise pages that own their date range (account
  // statement) would silently lose everything outside that hidden window.
  const internalDateFilterActive = !hideHeaderCard && !hideDateFilter;

  // Filter Data
  const filteredData = useMemo(() => {
    if (!data) return [];
    let result = data.filter((row) => {
      if (typeFilter && typeFilter !== 'ALL') {
        if (row.type && row.type !== typeFilter) return false;
      }
      if (statusFilter && statusFilter !== 'ALL') {
        if (statusFilter === 'PAID') {
          if (row.paymentType !== 'نقدي' && row.paymentType !== 'CASH' && row.paymentType !== 'PAID') return false;
        } else if (statusFilter === 'UNPAID') {
          if (row.paymentType === 'نقدي' || row.paymentType === 'CASH' || row.paymentType === 'PAID') return false;
        } else if (statusFilter === 'AUDITED') {
          if (!row.isAudited) return false;
        } else if (statusFilter === 'UNAUDITED') {
          if (row.isAudited) return false;
        } else {
          if (row.status && row.status !== statusFilter) return false;
        }
      }
      if (internalDateFilterActive && startDate) {
        const rowDate = new Date(row.date || row.createdAt).getTime();
        if (rowDate < new Date(startDate).getTime()) return false;
      }
      if (internalDateFilterActive && endDate) {
        const rowDate = new Date(row.date || row.createdAt).getTime();
        if (rowDate > new Date(endDate).getTime() + 86400000) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const str = JSON.stringify(row).toLowerCase();
        if (!str.includes(q)) return false;
      }
      return true;
    });

    if (sortField) {
      result = [...result].sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];
        if (valA < valB) return sortDir === 'asc' ? -1 : 1;
        if (valA > valB) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, typeFilter, statusFilter, internalDateFilterActive, startDate, endDate, searchQuery, sortField, sortDir]);

  // Paginated Data
  const pSize = Number(pageSize) || 25;
  const totalPages = Math.ceil(filteredData.length / pSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pSize;
    return filteredData.slice(start, start + pSize);
  }, [filteredData, currentPage, pSize]);

  // Footer Totals Calculation
  const totalReceipts = useMemo(() => {
    return filteredData
      .filter((r) => r.type === 'RECEIPT' || Number(r.debit) > 0)
      .reduce((s, r) => s + Number(r.amount || r.debit || r.totalDebit || 0), 0);
  }, [filteredData]);

  const totalDebitSum = useMemo(() => {
    return filteredData.reduce((s, r) => s + Number(r.totalDebit || r.debit || (r.type === 'RECEIPT' ? r.amount : 0) || 0), 0);
  }, [filteredData]);

  const totalCreditSum = useMemo(() => {
    return filteredData.reduce((s, r) => s + Number(r.totalCredit || r.credit || (r.type === 'PAYMENT' ? r.amount : 0) || 0), 0);
  }, [filteredData]);

  const visibleColumns = useMemo(() => {
    return columnDefs.filter((col) => !hiddenCols.has(col.field));
  }, [columnDefs, hiddenCols]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setTypeFilter('ALL');
    setStatusFilter('ALL');
    setStartDate('');
    setEndDate('');
  };

  const handleExportExcel = () => {
    if (onExportExcel) {
      onExportExcel();
      return;
    }
    const exportData = filteredData.map((row) => {
      const obj: any = {};
      visibleColumns.forEach((col) => {
        let val = row[col.field];
        if (col.field === 'debtType' && row.debtLabel) {
          val = row.debtLabel;
        } else if (col.field === 'endingBalance' && typeof row.endingBalance === 'number') {
          const ending = row.endingBalance;
          val = `${Math.abs(ending).toLocaleString('en-US', { minimumFractionDigits: 2 })} (${ending > 0 ? 'لنا' : ending < 0 ? 'علينا' : 'متعادل'})`;
        }
        obj[col.headerText] = val !== undefined && val !== null ? val : '';
      });
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, title || 'بيانات_محاسبية');
    XLSX.writeFile(wb, `${title || 'Accounting_Export'}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRowIds(new Set(paginatedData.map((r) => r.id)));
    } else {
      setSelectedRowIds(new Set());
    }
  };

  const toggleSelectRow = (id: string) => {
    const next = new Set(selectedRowIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedRowIds(next);
  };

  return (
    <div className={`w-full select-none font-sans ${hideHeaderCard ? '' : 'space-y-4'}`}>
      {/* 1. Unified Search & Filter Toolbar */}
      {!hideHeaderCard && (
        <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-2.5 shadow-xs no-print">

          <div className="flex flex-wrap items-center justify-between gap-2 w-full">
            {/* Right side (RTL Start): Custom Elements, Search, and Filters */}
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
              {title && <div className="font-bold text-xs text-slate-800 shrink-0">{title}</div>}

              {customToolbarElements}

              {!hideSearch && (
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[11px] font-bold text-slate-500 shrink-0">البحث:</span>
                  <TextInput
                    placeholder="بحث..."
                    size="xs"
                    className="w-[140px]"
                    styles={{
                      input: {
                        height: 34,
                        fontSize: 12,
                        paddingInlineStart: 28,
                        paddingInlineEnd: 8,
                        borderRadius: 10,
                        borderColor: '#E5E7EB',
                        backgroundColor: '#FFFFFF',
                      },
                      section: { width: 28 },
                    }}
                    leftSection={<IconSearch size={14} className="text-slate-400" />}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>
              )}

              {/* Secondary Filter Selectors */}
              {!hideFilters && typeFilterOptions.length > 0 && (
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[11px] font-bold text-slate-700 shrink-0">الطرف:</span>
                  <Select
                    size="xs"
                    className="w-36"
                    styles={{
                      input: { height: 34, fontSize: 12, paddingInline: 8 },
                    }}
                    data={typeFilterOptions}
                    value={typeFilter}
                    onChange={(val) => {
                      setTypeFilter(val);
                      setCurrentPage(1);
                    }}
                    placeholder="جميع الأطراف"
                  />
                </div>
              )}

              {!hideFilters && statusFilterOptions.length > 0 && (
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[11px] font-bold text-slate-700 shrink-0">الحالة:</span>
                  <Select
                    size="xs"
                    className="w-28"
                    leftSection={<IconFilter size={13} className="text-slate-400" />}
                    styles={{
                      input: { height: 34, fontSize: 12, paddingInlineStart: 24, paddingInlineEnd: 8 },
                    }}
                    data={statusFilterOptions}
                    value={statusFilter}
                    onChange={(val) => {
                      setStatusFilter(val);
                      setCurrentPage(1);
                    }}
                    placeholder="حالة القيد"
                  />
                </div>
              )}

              {!hideDateFilter && (
                <div className="flex items-center gap-1 bg-slate-50/80 border border-slate-200 rounded-xl p-0.5 px-1.5 shrink-0 h-[34px]">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-500 font-bold shrink-0">من:</span>
                    <div className="w-[105px]">
                      <AccountingDatePicker
                        value={startDate}
                        placeholder="سنة/شهر/يوم"
                        onChange={(d) => setStartDate(d)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-500 font-bold shrink-0">إلى:</span>
                    <div className="w-[105px]">
                      <AccountingDatePicker
                        value={endDate}
                        placeholder="سنة/شهر/يوم"
                        minDate={startDate}
                        onChange={(d) => setEndDate(d)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {!hideClearFiltersButton && !hideFilters && (searchQuery || typeFilter !== 'ALL' || statusFilter !== 'ALL' || startDate || endDate) && (
                <Button
                  size="xs"
                  variant="subtle"
                  color="red"
                  className="h-8 px-2 font-semibold text-xs shrink-0"
                  leftSection={<IconFilterOff size={13} />}
                  onClick={handleClearFilters}
                >
                  {isAr ? 'مسح' : 'Clear'}
                </Button>
              )}
            </div>

            {/* Left side (RTL End): "إجراءات" Dropdown & Refresh Button */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Menu position="bottom-end" shadow="md" width={220} withinPortal={false}>
                <Menu.Target>
                  <Button
                    size="xs"
                    variant="outline"
                    color="gray"
                    className="h-8 px-3 font-bold text-xs border-slate-300 bg-white hover:bg-slate-50 shadow-2xs"
                    leftSection={<IconDotsVertical size={14} />}
                    rightSection={<IconChevronDown size={13} />}
                  >
                    {isAr ? 'إجراءات' : 'Actions'}
                  </Button>
                </Menu.Target>

                <Menu.Dropdown p="xs" className="space-y-1">
                  {onOpenBatchStatements && (
                    <Menu.Item
                      leftSection={<IconFileText size={15} className="text-emerald-600" />}
                      onClick={() => onOpenBatchStatements(Array.from(selectedRowIds))}
                      className="font-bold text-xs"
                    >
                      {selectedRowIds.size > 0
                        ? `سحب الكشوفات المحددة (${selectedRowIds.size})`
                        : 'سحب الكشوفات'}
                    </Menu.Item>
                  )}

                  {onSendEmail && (
                    <Menu.Item
                      leftSection={<IconMail size={15} className="text-indigo-600" />}
                      onClick={() => onSendEmail(Array.from(selectedRowIds))}
                      className="font-bold text-xs"
                    >
                      إرسال عبر الإيميل
                    </Menu.Item>
                  )}

                  {!hideExport && (
                    <Menu.Item
                      leftSection={<IconFileSpreadsheet size={15} className="text-emerald-600" />}
                      onClick={handleExportExcel}
                      className="font-bold text-xs"
                    >
                      تصدير Excel
                    </Menu.Item>
                  )}

                  {!hidePrint && (
                    <Menu.Item
                      leftSection={<IconPrinter size={15} className="text-blue-600" />}
                      onClick={() => window.print()}
                      className="font-bold text-xs"
                    >
                      طباعة التقرير
                    </Menu.Item>
                  )}

                  <Menu.Divider />

                  <Menu.Label className="font-bold text-[11px] text-slate-500 flex items-center justify-between">
                    <span>تحكم الأعمدة</span>
                    <button
                      type="button"
                      onClick={handleResetColumns}
                      className="text-[10px] text-teal-700 hover:text-teal-900 font-bold flex items-center gap-0.5 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200"
                      title="إعادة الترتيب الإفتراضي"
                    >
                      <IconRotate size={10} />
                      إعادة ضبط
                    </button>
                  </Menu.Label>

                  <div className="max-h-48 overflow-y-auto space-y-1 pt-1 px-1">
                    {columnDefs.map((col) => (
                      <Checkbox
                        key={col.field}
                        size="xs"
                        label={col.headerText}
                        checked={!hiddenCols.has(col.field)}
                        onChange={() => toggleColumnVisibility(col.field)}
                        className="cursor-pointer text-xs"
                      />
                    ))}
                  </div>
                </Menu.Dropdown>
              </Menu>

              {onRefresh && (
                <ActionIcon variant="light" color="gray" className="w-8 h-8 rounded-md border border-slate-200" onClick={onRefresh} title="تحديث البيانات">
                  <IconRefresh size={15} />
                </ActionIcon>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. Bulk Selection Actions Bar */}
      {!hideSelectionBanner && selectedRowIds.size > 0 && (
        <div className="bg-orange-50/90 border border-orange-300 rounded-lg px-[14px] py-[10px] shadow-2xs no-print flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-[16px]">
            <Badge color="orange" size="md" variant="filled" className="font-extrabold px-2.5 py-0.5">
              محدد ({selectedRowIds.size} حساب)
            </Badge>
            <span className="text-xs text-slate-700 font-semibold">
              اختر الإجراء المطلوب من قائمة <strong className="text-slate-900 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-300">إجراءات</strong> أعلاه.
            </span>
          </div>

          <div className="flex items-center gap-3">
            {renderSelectedActions && renderSelectedActions(Array.from(selectedRowIds), () => setSelectedRowIds(new Set()))}
            <Button
              size="xs"
              variant="subtle"
              color="gray"
              onClick={() => setSelectedRowIds(new Set())}
              className="font-semibold text-xs px-2.5"
            >
              إلغاء التحديد
            </Button>
          </div>
        </div>
      )}

      {/* 3. Main Accounting Data Table */}
      <div className={`bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden ${hideHeaderCard ? '' : 'mt-2'}`}>
        <div className="overflow-x-auto w-full">

          <table className="w-full text-xs text-right border-collapse font-sans">
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 align-middle h-11">
                {/* Selection Switch Column Header */}
                {!hideSelectionCheckbox && (
                  <th className="w-12 text-center align-middle px-2 py-2.5 border-l border-slate-200/80">
                    <div className="flex items-center justify-center">
                      <Switch
                        size="xs"
                        color="orange"
                        checked={paginatedData.length > 0 && paginatedData.every(r => selectedRowIds.has(r.id))}
                        onChange={(e) => {
                          const next = new Set(selectedRowIds);
                          if (e.currentTarget.checked) {
                            paginatedData.forEach(r => next.add(r.id));
                          } else {
                            paginatedData.forEach(r => next.delete(r.id));
                          }
                          setSelectedRowIds(next);
                        }}
                        className="cursor-pointer"
                        title={isAr ? 'تحديد الكل في هذه الصفحة' : 'Toggle all on this page'}
                      />
                    </div>
                  </th>
                )}

                {/* Index / Serial Column */}
                <th className="w-12 text-center font-mono align-middle font-bold text-slate-500 text-[11px] px-2 py-2.5">
                  #
                </th>

                {/* Visible Column Headers with Drag & Drop */}
                {orderedVisibleColumns.map((col, idx) => {
                  const isDragging = draggedColIndex === idx;
                  const isDragOver = dragOverColIndex === idx;

                  return (
                    <th
                      key={col.field}
                      draggable
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={(e) => handleDrop(e, idx)}
                      onDragEnd={handleDragEnd}
                      onClick={() => col.sortable !== false && handleSort(col.field)}
                      style={{ paddingInline: 14, paddingBlock: 10 }}
                      className={`border-l border-slate-200/80 cursor-pointer select-none transition-all duration-150 relative align-middle font-extrabold text-slate-700 text-[12px] ${
                        col.align === 'left' ? 'text-left' : col.align === 'center' ? 'text-center' : 'text-right'
                      } ${col.isWide ? 'w-auto' : col.width || 'w-auto'} ${
                        isDragging ? 'opacity-40 bg-orange-100' : isDragOver ? 'bg-orange-50 border-r-2 border-r-[#F45A0A]' : 'hover:bg-slate-200/60'
                      }`}
                      title={isAr ? 'انقر للترتيب' : 'Click to sort'}
                    >
                      <div className={`flex items-center gap-1.5 ${col.align === 'left' ? 'justify-start' : col.align === 'center' ? 'justify-center' : 'justify-between'}`}>
                        <span className="truncate whitespace-nowrap">{col.headerText}</span>
                        <div className="shrink-0">
                          {sortField === col.field ? (
                            sortDir === 'asc' ? <IconSortAscending size={14} className="text-[#F45A0A]" /> : <IconSortDescending size={14} className="text-[#F45A0A]" />
                          ) : (
                            <IconArrowsSort size={13} className="text-slate-300 opacity-40 hover:opacity-100" />
                          )}
                        </div>
                      </div>
                    </th>
                  );
                })}

                {/* Action Column Header */}
                {actionMenuItems.length > 0 && (
                  <th className="border-l border-slate-200/80 text-center w-16 align-middle font-extrabold text-slate-700 text-[12px] px-2 py-2.5">
                    {isAr ? 'الإجراءات' : 'Actions'}
                  </th>
                )}
              </tr>
            </thead>


            {/* Table Body */}
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={visibleColumns.length + (actionMenuItems.length > 0 ? 1 : 0) + 1 + (!hideSelectionCheckbox ? 1 : 0)} className="py-20 text-center text-slate-400 font-bold text-xs">
                    {isAr ? 'جاري تحميل البيانات المحاسبية...' : 'Loading accounting data...'}
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + (actionMenuItems.length > 0 ? 1 : 0) + 1 + (!hideSelectionCheckbox ? 1 : 0)} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 text-[#F45A0A] flex items-center justify-center shadow-2xs">
                        <IconReceipt size={22} />
                      </div>
                      <p className="text-[13px] font-bold text-slate-800">{emptyMessage || (isAr ? 'لا توجد سجلات مطابقة للفلاتر' : 'No records match the current filters')}</p>
                      <p className="text-[11px] text-slate-400">{isAr ? 'يمكنك تعديل خيارات البحث أو التصفية لعرض السجلات المطلوبة' : 'You can adjust your search or filter options to view records'}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, rIdx) => {
                  const isSelected = selectedRowIds.has(row.id);
                  const isExpanded = expandedRowIds.has(row.id);
                  const isEven = rIdx % 2 === 0;
                  const rowNum = (currentPage - 1) * pSize + rIdx + 1;


                  const isBalanceHighlight =
                    row.isBalanceRow ||
                    row.voucherType === 'OPENING' ||
                    row.voucherType === 'PREVIOUS' ||
                    (typeof row.id === 'string' && (row.id.includes('opening_balance') || row.id.includes('previous_balance'))) ||
                    (typeof row.docType === 'string' && (row.docType.includes('افتتاحي') || row.docType.includes('سابق') || row.docType.toLowerCase().includes('opening') || row.docType.toLowerCase().includes('previous')));

                  const customRowClass = getRowClassName ? getRowClassName(row) : '';

                  return (
                    <React.Fragment key={row.id || rIdx}>
                      <tr
                        onDoubleClick={() => onRowDoubleClick && onRowDoubleClick(row)}
                        onContextMenu={(e) => {
                          if (onRowContextMenu) {
                            e.preventDefault();
                            onRowContextMenu(e, row);
                          }
                        }}
                        className={`transition-colors align-middle border-b ${
                          isSelected
                            ? 'bg-orange-50/70'
                            : isBalanceHighlight
                            ? 'bg-[#FFFBEB] hover:bg-[#FEF3C7] border-[#FDE68A] text-[#92400E] font-bold'
                            : customRowClass
                            ? customRowClass
                            : isEven
                            ? 'bg-white hover:bg-orange-50/25 border-slate-100'
                            : 'bg-slate-50/40 hover:bg-orange-50/25 border-slate-100'
                        }`}
                        style={{ height: 48 }}
                      >
                        {/* Selection Switch Cell */}
                        {!hideSelectionCheckbox && (
                          <td className="w-12 text-center align-middle px-2 py-2 border-l border-slate-100/80">
                            <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                              <Switch
                                size="xs"
                                color="orange"
                                checked={isSelected}
                                onChange={(e) => {
                                  const next = new Set(selectedRowIds);
                                  if (e.currentTarget.checked) {
                                    next.add(row.id);
                                  } else {
                                    next.delete(row.id);
                                  }
                                  setSelectedRowIds(next);
                                }}
                                className="cursor-pointer"
                              />
                            </div>
                          </td>
                        )}

                        {/* Single Clean Index / Serial Number & Expand Column */}
                        <td className="w-12 text-center align-middle font-mono text-[11px] text-slate-500 font-bold px-2 py-2">
                          <div className="flex items-center justify-center gap-1">
                            {renderDetailRow && (
                              <ActionIcon
                                size="xs"
                                variant="subtle"
                                color={isExpanded ? 'orange' : 'gray'}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpandRow(row.id);
                                }}
                              >
                                {isExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                              </ActionIcon>
                            )}
                            <span className="inline-flex items-center justify-center min-w-[22px] h-5 px-1 rounded-md bg-slate-100/90 text-slate-600 font-mono text-[11px]">
                              {rowNum}
                            </span>
                          </div>
                        </td>

                        {/* Visible Column Data in Custom Drag Order */}
                        {orderedVisibleColumns.map((col, cIdx) => {
                          const cellVal = row[col.field];
                          return (
                            <td
                              key={cIdx}
                              className={`px-3.5 py-2.5 border-l border-slate-100/80 align-middle text-slate-800 text-xs ${
                                col.align === 'left' ? 'text-left' : col.align === 'center' ? 'text-center' : 'text-right'
                              } ${col.isWide ? '' : 'whitespace-nowrap'} ${col.isMonetary ? 'tabular-nums font-mono' : ''}`}
                            >
                              {col.render ? col.render(row) : cellVal || '-'}
                            </td>
                          );
                        })}


                        {/* Actions Menu Column */}
                        {actionMenuItems.length > 0 && (
                          <td className="px-3 py-2.5 border-l border-slate-200 text-center align-middle" onClick={e => e.stopPropagation()}>
                            <Menu shadow="md" width={180} position="bottom-start" zIndex={1000}>
                              <Menu.Target>
                                <ActionIcon size="xs" variant="subtle" color="gray" className="cursor-pointer">
                                  <IconDotsVertical size={15} />
                                </ActionIcon>
                              </Menu.Target>
                              <Menu.Dropdown>
                                  {actionMenuItems.map((item, mIdx) => {
                                    if (item.hidden && item.hidden(row)) return null;
                                    const IconComponent = typeof item.icon === 'function' ? item.icon : null;
                                    const iconElement = React.isValidElement(item.icon)
                                      ? item.icon
                                      : IconComponent
                                      ? <IconComponent size={14} />
                                      : <IconEye size={14} />;

                                    return (
                                      <Menu.Item
                                        key={mIdx}
                                        color={item.color || 'dark'}
                                        leftSection={iconElement}
                                        onClick={() => item.onClick(row)}
                                      >
                                        {item.label}
                                      </Menu.Item>
                                    );
                                  })}
                              </Menu.Dropdown>
                            </Menu>
                          </td>
                        )}
                      </tr>

                      {/* Expandable Detail Sub-Row */}
                      {/* Expand Detail Row */}
                      {isExpanded && renderDetailRow && (
                        <tr key={`${row.id || rIdx}-detail`} className="bg-slate-50">
                          <td colSpan={visibleColumns.length + (actionMenuItems.length > 0 ? 1 : 0) + 1 + (!hideSelectionCheckbox ? 1 : 0)} className="p-4 border-t border-slate-200">
                            {renderDetailRow(row)}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 4. Single Footer Summary & Pagination Bar (Attached to Table) */}
        {!hideFooter && (
          <div className="bg-slate-50/80 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-700 p-2 gap-3">
          {/* Right side: Custom Summary or default totals */}
          {customFooterSummary ? (
            <div className="flex-1 min-w-0">{customFooterSummary}</div>
          ) : (
            <div className="flex items-center flex-wrap gap-4 text-[12.5px]">
              <span style={{ fontWeight: 500 }}>عدد السجلات: <strong className="tabular-nums font-black" style={{ color: '#0369a1' }}>{filteredData.length}</strong></span>
              <span className="w-px bg-slate-200" style={{ height: 20 }}></span>

              <span style={{ fontWeight: 500 }}>مجموع المدين: <strong className="tabular-nums font-mono font-black" style={{ color: '#9f1239' }}>{totalDebitSum.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
              <span className="w-px bg-slate-200" style={{ height: 20 }}></span>

              <span style={{ fontWeight: 500 }}>مجموع الدائن: <strong className="tabular-nums font-mono font-black" style={{ color: '#065f46' }}>{totalCreditSum.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
              <span className="w-px bg-slate-200" style={{ height: 20 }}></span>

              <span style={{ fontWeight: 500 }}>الرصيد الصافي: <strong className={`tabular-nums font-mono font-black`} style={{ color: (totalDebitSum - totalCreditSum) >= 0 ? '#9f1239' : '#065f46' }}>{Math.abs(totalDebitSum - totalCreditSum).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
            </div>
          )}

          {/* Left side: Page Size Select + Pagination Navigation */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-bold text-[11px]">
                {isAr ? 'صفوف لكل صفحة:' : 'Rows per page:'}
              </span>
              <Select
                size="xs"
                className="w-[72px]"
                styles={{ input: { height: 28, fontSize: 11, paddingInline: 6, fontWeight: 700 } }}
                data={['10', '25', '50', '100']}
                value={pageSize}
                onChange={(val) => {
                  setPageSize(val || '25');
                  setCurrentPage(1);
                }}
              />
            </div>

            <span className="font-mono text-slate-600 font-bold text-[11px]">
              {isAr ? `${currentPage} من ${totalPages} صفحة` : `Page ${currentPage} of ${totalPages}`}
            </span>

            <div className="flex items-center gap-1">
              <ActionIcon
                size="xs"
                variant="default"
                className="h-7 w-7 rounded-md"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                {direction === 'rtl' ? <IconChevronRight size={14} /> : <IconChevronLeft size={14} />}
              </ActionIcon>
              <ActionIcon
                size="xs"
                variant="default"
                className="h-7 w-7 rounded-md"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                {direction === 'rtl' ? <IconChevronLeft size={14} /> : <IconChevronRight size={14} />}
              </ActionIcon>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
);
};
