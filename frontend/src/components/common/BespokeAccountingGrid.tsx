import React, { useState, useMemo } from 'react';
import {
  Paper,
  TextInput,
  Select,
  Button,
  ActionIcon,
  Menu,
  Badge,
  Tooltip,
} from '@mantine/core';
import {
  IconSearch,
  IconRefresh,
  IconPrinter,
  IconFileSpreadsheet,
  IconDotsVertical,
  IconFilterOff,
  IconEye,
  IconEdit,
  IconCheck,
  IconArrowBackUp,
  IconChevronRight,
  IconChevronLeft,
} from '@tabler/icons-react';
import * as XLSX from 'xlsx';

export interface BespokeColumnDef {
  field: string;
  headerText: string;
  width?: string;
  isPinned?: boolean;
  align?: 'right' | 'left' | 'center';
  isMonetary?: boolean;
  isWide?: boolean;
  render?: (row: any) => React.ReactNode;
}

export interface GridActionMenuItem {
  label: string;
  icon?: any;
  color?: string;
  onClick: (row: any) => void;
  hidden?: (row: any) => boolean;
}

interface BespokeAccountingGridProps {
  data: any[];
  columnDefs: BespokeColumnDef[];
  title?: string;
  loading?: boolean;
  onRefresh?: () => void;
  actionMenuItems?: GridActionMenuItem[];
  onRowDoubleClick?: (row: any) => void;
  typeFilterOptions?: { label: string; value: string }[];
  statusFilterOptions?: { label: string; value: string }[];
}

export const BespokeAccountingGrid: React.FC<BespokeAccountingGridProps> = ({
  data = [],
  columnDefs,
  title,
  loading = false,
  onRefresh,
  actionMenuItems = [],
  onRowDoubleClick,
  typeFilterOptions = [
    { label: 'جميع الأنواع', value: 'ALL' },
    { label: 'سندات القبض (Receipts)', value: 'RECEIPT' },
    { label: 'سندات الدفع (Payments)', value: 'PAYMENT' },
  ],
  statusFilterOptions = [
    { label: 'جميع الحالات', value: 'ALL' },
    { label: 'مكتمـل / مرحّل', value: 'POSTED' },
    { label: 'مسـودة', value: 'DRAFT' },
  ],
}) => {
  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | null>('ALL');
  const [statusFilter, setStatusFilter] = useState<string | null>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<string>('25');
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  // Filter Data
  const filteredData = useMemo(() => {
    if (!data) return [];
    return data.filter((row) => {
      // Type Filter
      if (typeFilter && typeFilter !== 'ALL') {
        if (row.type && row.type !== typeFilter) return false;
      }
      // Status Filter
      if (statusFilter && statusFilter !== 'ALL') {
        if (row.status && row.status !== statusFilter) return false;
      }
      // Date Filter
      if (startDate) {
        const rowDate = new Date(row.date || row.createdAt).getTime();
        if (rowDate < new Date(startDate).getTime()) return false;
      }
      if (endDate) {
        const rowDate = new Date(row.date || row.createdAt).getTime();
        if (rowDate > new Date(endDate).getTime() + 86400000) return false;
      }
      // Search Query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const str = JSON.stringify(row).toLowerCase();
        if (!str.includes(q)) return false;
      }
      return true;
    });
  }, [data, typeFilter, statusFilter, startDate, endDate, searchQuery]);

  // Paginated Data
  const pSize = Number(pageSize);
  const totalPages = Math.ceil(filteredData.length / pSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pSize;
    return filteredData.slice(start, start + pSize);
  }, [filteredData, currentPage, pSize]);

  // Calculations for Footer Summary Bar
  const totalReceipts = useMemo(() => {
    return filteredData
      .filter((r) => r.type === 'RECEIPT' || Number(r.debit) > 0)
      .reduce((s, r) => s + Number(r.amount || r.debit || r.totalDebit || 0), 0);
  }, [filteredData]);

  const totalPayments = useMemo(() => {
    return filteredData
      .filter((r) => r.type === 'PAYMENT' || Number(r.credit) > 0)
      .reduce((s, r) => s + Number(r.amount || r.credit || r.totalCredit || 0), 0);
  }, [filteredData]);

  const netMovement = totalReceipts - totalPayments;

  const handleClearFilters = () => {
    setSearchQuery('');
    setTypeFilter('ALL');
    setStatusFilter('ALL');
    setStartDate('');
    setEndDate('');
  };

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      filteredData.map((r) => ({
        'رقم السند': r.voucherNumber,
        'النوع': r.type === 'RECEIPT' ? 'قبض' : 'دفع',
        'التاريخ': new Date(r.date).toLocaleDateString('ar-SA'),
        'الصندوق/البنك': r.cashboxName,
        'الطرف': r.partnerName,
        'الحساب المقابل': r.accountName,
        'البيان': r.description,
        'المبلغ': r.amount,
        'المستخدم': r.userName,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'السندات المالية');
    XLSX.writeFile(wb, `${title || 'السندات_المالية'}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-2 w-full select-none">
      {/* 1. Primary Upper Filter Bar (خارج الجدول بالكامل) */}
      <Paper p="xs" radius="sm" withBorder className="bg-white space-y-2 no-print shadow-2xs">
        {/* Row 1: Title, Search, Primary Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {title && <span className="font-extrabold text-xs text-slate-900">{title}</span>}
            <TextInput
              placeholder="بحث شامل في كافة السجلات (رقم، بيان، طرف)..."
              size="xs"
              className="w-72"
              leftSection={<IconSearch size={14} />}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Button size="xs" variant="outline" color="gray" leftSection={<IconFileSpreadsheet size={14} />} onClick={handleExportExcel}>
              تصدير Excel
            </Button>
            <Button size="xs" variant="outline" color="gray" leftSection={<IconPrinter size={14} />} onClick={() => window.print()}>
              طباعة
            </Button>
            {onRefresh && (
              <ActionIcon variant="light" color="gray" onClick={onRefresh} title="تحديث البيانات">
                <IconRefresh size={14} />
              </ActionIcon>
            )}
          </div>
        </div>

        {/* Row 2: Secondary Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 text-xs">
          {typeFilterOptions.length > 0 && (
            <Select
              size="xs"
              className="w-40"
              data={typeFilterOptions}
              value={typeFilter}
              onChange={(val) => {
                setTypeFilter(val);
                setCurrentPage(1);
              }}
              placeholder="نوع السند"
            />
          )}

          {statusFilterOptions.length > 0 && (
            <Select
              size="xs"
              className="w-36"
              data={statusFilterOptions}
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val);
                setCurrentPage(1);
              }}
              placeholder="حالة القيد"
            />
          )}

          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-500 font-bold">من:</span>
            <TextInput type="date" size="xs" className="w-32" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <span className="text-[11px] text-slate-500 font-bold">إلى:</span>
            <TextInput type="date" size="xs" className="w-32" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>

          {(searchQuery || typeFilter !== 'ALL' || statusFilter !== 'ALL' || startDate || endDate) && (
            <Button size="xs" variant="subtle" color="red" leftSection={<IconFilterOff size={13} />} onClick={handleClearFilters}>
              مسح الفلاتر
            </Button>
          )}
        </div>
      </Paper>

      {/* 2. Custom Bespoke Accounting Table (Fits Row Count, 32px Row Height, 36px Header) */}
      <Paper radius="sm" withBorder className="bg-white overflow-hidden shadow-2xs border-slate-300">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-xs text-right border-collapse">
            {/* Header */}
            <thead>
              <tr className="bg-slate-100 border-b-2 border-orange-600 text-slate-900 font-extrabold h-[36px]">
                {columnDefs.map((col, idx) => (
                  <th
                    key={idx}
                    className={`py-1.5 px-2 border-l border-slate-300 ${
                      col.align === 'left' ? 'text-left' : col.align === 'center' ? 'text-center' : 'text-right'
                    } ${col.isWide ? 'w-auto' : col.width || 'w-auto'}`}
                  >
                    {col.headerText}
                  </th>
                ))}
                {actionMenuItems.length > 0 && (
                  <th className="py-1.5 px-2 border-l border-slate-300 text-center w-16">الإجراءات</th>
                )}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={columnDefs.length + 1} className="py-10 text-center text-slate-500 font-bold">
                    جاري تحميل البيانات المحاسبية...
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={columnDefs.length + 1} className="py-10 text-center text-slate-500 font-bold">
                    لا توجد سجلات مطابقة للفلاتر.
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, rIdx) => {
                  const isSelected = selectedRowId === row.id;
                  const isEven = rIdx % 2 === 0;

                  return (
                    <tr
                      key={row.id || rIdx}
                      onClick={() => setSelectedRowId(row.id)}
                      onDoubleClick={() => onRowDoubleClick && onRowDoubleClick(row)}
                      className={`h-[32px] transition-colors cursor-pointer border-b border-slate-200 ${
                        isSelected
                          ? 'bg-orange-100/90 text-orange-950 font-bold'
                          : isEven
                          ? 'bg-white hover:bg-orange-50/50'
                          : 'bg-slate-50/80 hover:bg-orange-50/50'
                      }`}
                    >
                      {columnDefs.map((col, cIdx) => {
                        const cellVal = row[col.field];
                        return (
                          <td
                            key={cIdx}
                            className={`py-1 px-2 border-l border-slate-200 ${
                              col.align === 'left' ? 'text-left' : col.align === 'center' ? 'text-center' : 'text-right'
                            } ${col.isMonetary ? 'tabular-nums font-bold' : ''}`}
                          >
                            {col.render ? col.render(row) : cellVal || '-'}
                          </td>
                        );
                      })}

                      {/* Single 3-Dots Action Menu */}
                      {actionMenuItems.length > 0 && (
                        <td className="py-1 px-2 border-l border-slate-200 text-center">
                          <Menu shadow="md" width={180} position="bottom-start" zIndex={1000}>
                            <Menu.Target>
                              <ActionIcon size="xs" variant="subtle" color="gray" className="cursor-pointer">
                                <IconDotsVertical size={15} />
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              {actionMenuItems.map((item, mIdx) => {
                                if (item.hidden && item.hidden(row)) return null;
                                const Icon = item.icon || IconEye;
                                return (
                                  <Menu.Item
                                    key={mIdx}
                                    color={item.color || 'dark'}
                                    leftSection={<Icon size={14} />}
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Paper>

      {/* 3. Single Footer Summary & Pagination Bar (شريط سفلي واحد فقط) */}
      <Paper p="xs" radius="sm" withBorder className="bg-white flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-slate-900 border-slate-300 shadow-2xs">
        {/* Left: Financial Totals Summary */}
        <div className="flex items-center gap-4">
          <span>عدد السجلات: <strong className="text-orange-800 tabular-nums">{filteredData.length}</strong></span>
          <span className="h-3 w-[1px] bg-slate-300"></span>

          <span>إجمالي المقبوضات: <strong className="text-orange-800 tabular-nums">{totalReceipts.toLocaleString('en-US', { minimumFractionDigits: 2 })} SAR</strong></span>
          <span className="h-3 w-[1px] bg-slate-300"></span>

          <span>إجمالي المدفوعات: <strong className="text-rose-800 tabular-nums">{totalPayments.toLocaleString('en-US', { minimumFractionDigits: 2 })} SAR</strong></span>
          <span className="h-3 w-[1px] bg-slate-300"></span>

          <span>صافي الحركة: <strong className={`tabular-nums ${netMovement >= 0 ? 'text-orange-800' : 'text-rose-800'}`}>{netMovement.toLocaleString('en-US', { minimumFractionDigits: 2 })} SAR</strong></span>
        </div>

        {/* Right: Pagination & Page Size Control */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-normal">صفوف لكل صفحة:</span>
            <Select
              size="xs"
              className="w-20"
              data={['25', '50', '100']}
              value={pageSize}
              onChange={(val) => {
                setPageSize(val || '25');
                setCurrentPage(1);
              }}
            />
          </div>

          <span className="text-slate-600 font-mono text-[11px]">
            {currentPage} من {totalPages} صفحة
          </span>

          <div className="flex items-center gap-1">
            <ActionIcon
              size="xs"
              variant="default"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <IconChevronRight size={14} />
            </ActionIcon>
            <ActionIcon
              size="xs"
              variant="default"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              <IconChevronLeft size={14} />
            </ActionIcon>
          </div>
        </div>
      </Paper>
    </div>
  );
};
