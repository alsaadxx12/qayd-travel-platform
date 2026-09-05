import React, { useState, useMemo, useEffect } from 'react';
import {
  Building2,
  Plus,
  Search,
  RefreshCw,
  Edit,
  Trash2,
  Calendar,
  DollarSign,
  TrendingUp,
  ReceiptText,
  Banknote,
  Eye,
  FileSpreadsheet,
  X,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Filter,
  Columns,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Check,
  EyeOff,
  User,
  GripVertical,
  Settings2,
  SlidersHorizontal,
  ArrowLeft,
  ArrowRight,
  UserCheck,
  UserPlus,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { Modal, Tooltip } from '@mantine/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HotelBookingEditorWorkspace } from '../../components/hotels/HotelBookingEditorWorkspace';
import { hotelsApi, HotelBookingItem } from '../../api/hotels';
import { SegmentedDatePicker } from '../../components/ui/SegmentedDatePicker';
import { CurrencySegmentedControl } from '../../components/ui/CurrencySegmentedControl';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { archiveHotel } from '../../utils/deletedRecordsArchive';
import { useLanguageStore } from '../../store/useLanguageStore';
import { useAuthStore } from '../../store/useAuthStore';

export interface HotelTableColumnConfig {
  id: string;
  labelAr: string;
  labelEn: string;
  visible: boolean;
  width: number; // width in pixels
  minWidth: number;
  align?: 'left' | 'center' | 'right';
}

const DEFAULT_COLUMNS: HotelTableColumnConfig[] = [
  { id: 'index', labelAr: '#', labelEn: '#', visible: true, width: 50, minWidth: 40, align: 'center' },
  { id: 'invoiceNumber', labelAr: 'رقم الحجز', labelEn: 'Booking No', visible: true, width: 175, minWidth: 140, align: 'center' },
  { id: 'hotelAndGuest', labelAr: 'اسم الفندق والنزيل', labelEn: 'Hotel & Guest', visible: true, width: 230, minWidth: 170, align: 'center' },
  { id: 'customerName', labelAr: 'العميل / الحساب', labelEn: 'Customer Account', visible: true, width: 175, minWidth: 140, align: 'center' },
  { id: 'supplierName', labelAr: 'المورد / المزود', labelEn: 'Supplier', visible: true, width: 160, minWidth: 130, align: 'center' },
  { id: 'dates', labelAr: 'الدخول والخروج والإقامة', labelEn: 'Stay & Dates', visible: true, width: 230, minWidth: 180, align: 'center' },
  { id: 'cost', labelAr: 'التكلفة', labelEn: 'Cost', visible: true, width: 135, minWidth: 100, align: 'center' },
  { id: 'sale', labelAr: 'المبيعات', labelEn: 'Sales', visible: true, width: 135, minWidth: 100, align: 'center' },
  { id: 'profit', labelAr: 'الربح الصافي', labelEn: 'Net Profit', visible: true, width: 135, minWidth: 100, align: 'center' },
  { id: 'currency', labelAr: 'العملة', labelEn: 'Cur', visible: true, width: 85, minWidth: 70, align: 'center' },
  { id: 'employees', labelAr: 'موظف الإدخال / الإصدار', labelEn: 'Staff / Employees', visible: true, width: 175, minWidth: 140, align: 'center' },
  { id: 'audit', labelAr: 'تدقيق', labelEn: 'Audit', visible: true, width: 100, minWidth: 80, align: 'center' },
  { id: 'actions', labelAr: 'دخول', labelEn: 'Open', visible: true, width: 60, minWidth: 50, align: 'center' },
];

export const HotelsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('ALL');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [quickDatePreset, setQuickDatePreset] = useState<string>('THIS_YEAR');

  // Columns Visibility, Width & Reordering State
  const [columns, setColumns] = useState<HotelTableColumnConfig[]>(() => {
    try {
      const saved = localStorage.getItem('hotel_table_columns_v8');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge with default to guarantee new columns exist
          return DEFAULT_COLUMNS.map((def) => {
            const found = parsed.find((p: any) => p.id === def.id);
            return found
              ? {
                  ...def,
                  visible: found.visible !== undefined ? found.visible : def.visible,
                  width: found.width || def.width,
                  align: 'center',
                }
              : def;
          });
        }
      }
    } catch (e) {
      console.warn('Failed to load column configs from localStorage:', e);
    }
    return DEFAULT_COLUMNS;
  });

  const [isColumnsModalOpen, setIsColumnsModalOpen] = useState(false);
  const [draggedColIndex, setDraggedColIndex] = useState<number | null>(null);
  const [dragOverColIndex, setDragOverColIndex] = useState<number | null>(null);

  // Toggle column visibility
  const handleToggleColumn = (id: string) => {
    setColumns((prev) => {
      const updated = prev.map((col) =>
        col.id === id ? { ...col, visible: !col.visible } : col
      );
      localStorage.setItem('hotel_table_columns_v7', JSON.stringify(updated));
      return updated;
    });
  };

  // Change column width in px
  const handleUpdateColumnWidth = (id: string, width: number) => {
    setColumns((prev) => {
      const updated = prev.map((col) =>
        col.id === id ? { ...col, width: Math.max(col.minWidth, width) } : col
      );
      localStorage.setItem('hotel_table_columns_v7', JSON.stringify(updated));
      return updated;
    });
  };

  // Move column order
  const handleMoveColumn = (index: number, moveDir: 'UP' | 'DOWN') => {
    setColumns((prev) => {
      const targetIndex = moveDir === 'UP' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      localStorage.setItem('hotel_table_columns_v7', JSON.stringify(next));
      return next;
    });
  };

  // Reset to default column settings
  const handleResetColumns = () => {
    setColumns(DEFAULT_COLUMNS);
    localStorage.removeItem('hotel_table_columns_v7');
    showSuccessNotification(
      isAr ? 'تمت استعادة الأعمدة' : 'Columns Reset',
      isAr ? 'تمت استعادة العرض والترتيب الافتراضي للأعمدة بنجاح.' : 'Columns restored to default.'
    );
  };

  // Header Drag & Drop handlers
  const handleHeaderDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedColIndex(index);
  };

  const handleHeaderDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColIndex !== index) {
      setDragOverColIndex(index);
    }
  };

  const handleHeaderDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedColIndex === null || draggedColIndex === dropIndex) {
      setDraggedColIndex(null);
      setDragOverColIndex(null);
      return;
    }

    setColumns((prev) => {
      // Find the items in visible columns
      const visibleCols = prev.filter((c) => c.visible);
      const draggedCol = visibleCols[draggedColIndex];
      const dropCol = visibleCols[dropIndex];

      if (!draggedCol || !dropCol) return prev;

      const fromRealIndex = prev.findIndex((c) => c.id === draggedCol.id);
      const toRealIndex = prev.findIndex((c) => c.id === dropCol.id);

      const next = [...prev];
      const [removed] = next.splice(fromRealIndex, 1);
      next.splice(toRealIndex, 0, removed);

      localStorage.setItem('hotel_table_columns_v7', JSON.stringify(next));
      return next;
    });

    setDraggedColIndex(null);
    setDragOverColIndex(null);
  };

  const handleHeaderDragEnd = () => {
    setDraggedColIndex(null);
    setDragOverColIndex(null);
  };

  // Workspace / Editor State
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<HotelBookingItem | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Fetch Hotel Bookings from Real API / Supabase
  const {
    data: hotelBookings = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['hotels'],
    queryFn: () => hotelsApi.getAll(),
    staleTime: 60 * 1000,
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => hotelsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotels'] });
      showSuccessNotification(
        isAr ? 'تم الحذف' : 'Deleted',
        isAr ? 'تم حذف الحجز الفندقي بنجاح.' : 'Hotel booking deleted successfully.'
      );
    },
    onError: (err: any) => {
      showErrorNotification(
        isAr ? 'خطأ' : 'Error',
        err.message || 'Error deleting hotel booking'
      );
    },
  });

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; booking: HotelBookingItem } | null>(null);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  // Handle Quick Date Presets
  const handleQuickPreset = (preset: string) => {
    setQuickDatePreset(preset);
    const now = new Date();

    if (preset === 'TODAY') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      setStartDate(start);
      setEndDate(end);
    } else if (preset === 'THIS_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      setStartDate(start);
      setEndDate(end);
    } else if (preset === 'THIS_YEAR') {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      setStartDate(start);
      setEndDate(end);
    } else if (preset === 'ALL') {
      setStartDate(null);
      setEndDate(null);
    }
  };

  // Filter Bookings
  const filteredBookings = useMemo(() => {
    return hotelBookings.filter((b) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNumber = b.invoiceNumber?.toLowerCase().includes(q);
        const matchHotel = b.hotelName?.toLowerCase().includes(q);
        const matchCustomer = b.customerName?.toLowerCase().includes(q);
        const matchGuest = b.primaryGuestName?.toLowerCase().includes(q) || b.rooms?.some((r) =>
          r.guestNames?.some((g) => g?.toLowerCase().includes(q))
        );
        const matchSupplier = b.supplierName?.toLowerCase().includes(q);
        const matchCity = b.city?.toLowerCase().includes(q);
        const matchIssuer = b.issuerEmployee?.toLowerCase().includes(q);
        const matchCreator = b.creatorEmployee?.toLowerCase().includes(q);
        if (!matchNumber && !matchHotel && !matchCustomer && !matchGuest && !matchSupplier && !matchCity && !matchIssuer && !matchCreator) {
          return false;
        }
      }

      // Currency
      if (selectedCurrency !== 'ALL' && b.currency !== selectedCurrency) {
        return false;
      }

      // Date Range
      if (startDate && new Date(b.issueDate) < startDate) {
        return false;
      }
      if (endDate && new Date(b.issueDate) > endDate) {
        return false;
      }

      return true;
    });
  }, [hotelBookings, searchQuery, selectedCurrency, startDate, endDate]);

  // Financial KPIs Calculations (Strict English Monospace Digits)
  const kpis = useMemo(() => {
    let totalSalesUSD = 0;
    let totalSalesIQD = 0;
    let totalCostUSD = 0;
    let totalCostIQD = 0;
    let totalProfitUSD = 0;
    let totalProfitIQD = 0;

    filteredBookings.forEach((b) => {
      const sale = Number(b.totalSale || 0);
      const cost = Number(b.totalCost || 0);
      const profit = Number(b.netProfit || (sale - cost));

      if (b.currency === 'USD') {
        totalSalesUSD += sale;
        totalCostUSD += cost;
        totalProfitUSD += profit;
      } else {
        totalSalesIQD += sale;
        totalCostIQD += cost;
        totalProfitIQD += profit;
      }
    });

    return {
      totalBookings: filteredBookings.length,
      totalSalesUSD,
      totalSalesIQD,
      totalCostUSD,
      totalCostIQD,
      totalProfitUSD,
      totalProfitIQD,
    };
  }, [filteredBookings]);

  // Active Visible Columns
  const visibleColumns = useMemo(() => {
    return columns.filter((c) => c.visible);
  }, [columns]);

  // Paginated Data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredBookings.slice(startIndex, startIndex + pageSize);
  }, [filteredBookings, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredBookings.length / pageSize) || 1;

  // Format short date avoiding timezone rollback
  const formatDateShort = (d?: string | Date | null) => {
    if (!d) return '-';
    if (typeof d === 'string') {
      const clean = d.includes('T') ? d.split('T')[0] : d;
      if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
    }
    try {
      const dateObj = typeof d === 'string' ? new Date(d) : d;
      if (!dateObj || isNaN(dateObj.getTime())) return String(d);
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return String(d);
    }
  };

  // Export to Excel / CSV
  const handleExportExcel = () => {
    if (filteredBookings.length === 0) {
      showErrorNotification(
        isAr ? 'تنبيه' : 'Warning',
        isAr ? 'لا توجد سجلات لتصديرها.' : 'No records to export.'
      );
      return;
    }

    const headers = [
      'InvoiceNumber',
      'IssueDate',
      'HotelName',
      'City',
      'CustomerAccount',
      'GuestName',
      'GuestPhone',
      'Supplier',
      'CheckIn',
      'CheckOut',
      'Nights',
      'RoomsCount',
      'TotalCost',
      'TotalSale',
      'NetProfit',
      'Currency',
      'CreatorEmployee',
      'IssuerEmployee',
      'Status',
    ];

    const rows = filteredBookings.map((b) => [
      `"${b.invoiceNumber || ''}"`,
      `"${formatDateShort(b.issueDate)}"`,
      `"${b.hotelName || ''}"`,
      `"${b.city || ''}"`,
      `"${b.customerName || ''}"`,
      `"${b.primaryGuestName || b.rooms?.[0]?.guestNames?.[0] || b.customerName || ''}"`,
      `"${b.customerPhone || ''}"`,
      `"${b.supplierName || ''}"`,
      `"${formatDateShort(b.checkInDate)}"`,
      `"${formatDateShort(b.checkOutDate)}"`,
      b.nights || 1,
      b.rooms?.length || 1,
      b.totalCost || 0,
      b.totalSale || 0,
      b.netProfit || 0,
      `"${b.currency || 'USD'}"`,
      `"${b.creatorEmployee || b.issuerEmployee || 'علي جعفر محمود'}"`,
      `"${b.issuerEmployee || 'علي جعفر محمود'}"`,
      `"${b.status || 'CONFIRMED'}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `hotel_bookings_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccessNotification(
      isAr ? 'تم التصدير' : 'Exported',
      isAr ? 'تم تصدير سجلات الفنادق بنجاح.' : 'Hotel records exported successfully.'
    );
  };

  return (
    <div
      className="w-full max-w-[1760px] mx-auto px-4 sm:px-6 py-5 select-none space-y-4 min-h-screen"
      dir={direction}
      style={{ fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif" }}
    >
      {/* ════════════════════════════════════════════════════════════════════
          1. UNIFIED PAGE HEADER (84–88px Height matching Tickets Page)
         ════════════════════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white rounded-[14px] border border-[#E5E7EB] px-5 py-4 min-h-[86px] shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="w-[38px] h-[38px] rounded-[10px] bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center font-bold shadow-2xs shrink-0">
            <Building2 size={21} strokeWidth={1.85} />
          </div>
          <div>
            <h1 className="font-bold text-[20px] text-[#111827] leading-tight">
              {isAr ? 'حجوزات الفنادق' : 'Hotel Bookings'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* New Hotel Booking Button */}
          <button
            type="button"
            onClick={() => {
              setSelectedBooking(null);
              setIsWorkspaceOpen(true);
            }}
            className="h-[44px] px-5 rounded-[9px] bg-[#F45A0A] hover:bg-[#DD4F05] active:scale-[0.98] text-white font-semibold text-[13.5px] shadow-xs flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus size={17} strokeWidth={2.4} />
            <span>{isAr ? '+ إصدار حجز فندقي جديد' : '+ New Hotel Booking'}</span>
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          2. FOUR FINANCIAL KPI METRIC CARDS (Exact Tickets Theme & 116px Height)
         ════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Bookings */}
        <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-4 shadow-2xs flex flex-col justify-between h-[116px] hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-slate-800">
              {isAr ? 'الحجوزات' : 'Bookings'}
            </span>
            <div className="w-[38px] h-[38px] rounded-[10px] bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center shrink-0 shadow-2xs">
              <Building2 size={20} strokeWidth={1.85} />
            </div>
          </div>

          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-medium text-slate-500">{isAr ? 'العدد:' : 'Count:'}</span>
            <span
              className="text-[20px] font-bold font-mono text-[#111827] tabular-nums leading-tight"
              style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
            >
              {kpis.totalBookings} <span className="text-xs text-slate-400 font-semibold">{isAr ? 'حجز' : 'records'}</span>
            </span>
          </div>
        </div>

        {/* Card 2: Total Sales */}
        <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-4 shadow-2xs flex flex-col justify-between h-[116px] hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-slate-800">
              {isAr ? 'المبيعات' : 'Sales'}
            </span>
            <div className="w-[36px] h-[36px] rounded-[10px] bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center shrink-0">
              <ReceiptText size={18} strokeWidth={1.85} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 items-baseline">
            <div className="flex items-baseline gap-1" dir="ltr">
              <span
                className="text-[17px] font-bold font-mono text-[#111827] tabular-nums leading-tight"
                style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
              >
                ${kpis.totalSalesUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-baseline gap-1" dir="ltr">
              <span
                className="text-[16px] font-bold font-mono text-[#111827] tabular-nums leading-tight"
                style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
              >
                {kpis.totalSalesIQD.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400 font-bold font-mono">{isAr ? 'د.ع' : 'IQD'}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Total Cost */}
        <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-4 shadow-2xs flex flex-col justify-between h-[116px] hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-slate-800">
              {isAr ? 'المشتريات' : 'Cost'}
            </span>
            <div className="w-[36px] h-[36px] rounded-[10px] bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center shrink-0">
              <Banknote size={18} strokeWidth={1.85} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 items-baseline">
            <div className="flex items-baseline gap-1" dir="ltr">
              <span
                className="text-[17px] font-bold font-mono text-[#111827] tabular-nums leading-tight"
                style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
              >
                ${kpis.totalCostUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-baseline gap-1" dir="ltr">
              <span
                className="text-[16px] font-bold font-mono text-[#111827] tabular-nums leading-tight"
                style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
              >
                {kpis.totalCostIQD.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400 font-bold font-mono">{isAr ? 'د.ع' : 'IQD'}</span>
            </div>
          </div>
        </div>

        {/* Card 4: Net Profit */}
        <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-4 shadow-2xs flex flex-col justify-between h-[116px] hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-slate-800">
              {isAr ? 'الربح الصافي' : 'Net Profit'}
            </span>
            <div className="w-[36px] h-[36px] rounded-[10px] bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center shrink-0">
              <TrendingUp size={18} strokeWidth={1.85} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 items-baseline">
            <div className="flex items-baseline gap-1" dir="ltr">
              <span
                className="text-[17px] font-bold font-mono text-[#111827] tabular-nums leading-tight"
                style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
              >
                ${kpis.totalProfitUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-baseline gap-1" dir="ltr">
              <span
                className="text-[16px] font-bold font-mono text-[#111827] tabular-nums leading-tight"
                style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
              >
                {kpis.totalProfitIQD.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400 font-bold font-mono">{isAr ? 'د.ع' : 'IQD'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          3. UNIFIED FILTER TOOLBAR (Exact Height h-[48px] Matching Tickets Page)
         ════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white p-3 sm:p-3.5 rounded-[14px] border border-[#E5E7EB] shadow-2xs flex items-center justify-between gap-3 flex-wrap">
        {/* Search Input */}
        <div className="relative min-w-[240px] max-w-[340px] flex-1">
          <Search size={16} className={`absolute ${direction === 'rtl' ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 text-slate-400`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isAr ? 'بحث برقم الحجز، الفندق، النزيل، المورد، الموظف...' : 'Search booking #, hotel, guest, supplier...'}
            className={`w-full h-[48px] ${direction === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} rounded-[14px] border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-[#F45A0A] text-xs font-bold text-slate-900 shadow-2xs transition-all`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className={`absolute ${direction === 'rtl' ? 'left-3.5' : 'right-3.5'} top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer`}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Date Filters & Presets */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Quick Date Presets */}
          <div className="h-[48px] p-1 bg-slate-100 border border-slate-200 rounded-[14px] hidden xl:flex items-center gap-1 shadow-2xs">
            {[
              { id: 'ALL', labelAr: 'الكل', labelEn: 'All' },
              { id: 'THIS_YEAR', labelAr: 'السنة', labelEn: 'Year' },
              { id: 'THIS_MONTH', labelAr: 'الشهر', labelEn: 'Month' },
              { id: 'TODAY', labelAr: 'اليوم', labelEn: 'Today' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleQuickPreset(p.id)}
                className={`h-full px-3 rounded-[10px] text-xs font-bold transition-all cursor-pointer ${
                  quickDatePreset === p.id ? 'bg-[#F45A0A] text-white font-black shadow-2xs' : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                {isAr ? p.labelAr : p.labelEn}
              </button>
            ))}
          </div>

          {/* From Date */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black text-slate-700 shrink-0 select-none">{isAr ? 'من:' : 'From:'}</span>
            <div className="w-[220px]">
              <SegmentedDatePicker
                placeholder={isAr ? 'من تاريخ' : 'From Date'}
                value={startDate}
                onChange={(d) => {
                  setStartDate(d);
                  setQuickDatePreset('CUSTOM');
                }}
                clearable={true}
              />
            </div>
          </div>

          {/* To Date */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black text-slate-700 shrink-0 select-none">{isAr ? 'إلى:' : 'To:'}</span>
            <div className="w-[220px]">
              <SegmentedDatePicker
                placeholder={isAr ? 'إلى تاريخ' : 'To Date'}
                value={endDate}
                onChange={(d) => {
                  setEndDate(d);
                  setQuickDatePreset('CUSTOM');
                }}
                clearable={true}
              />
            </div>
          </div>
        </div>

        {/* Currency Control */}
        <div className="flex items-center gap-2">
          <CurrencySegmentedControl
            value={selectedCurrency}
            onChange={(val) => setSelectedCurrency(val)}
            showAllOption={true}
            showLabel={false}
            height="h-[48px]"
          />
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          4. MODERN DATA TABLE GRID (WITH DRAG-AND-DROP REORDERING & SETTINGS)
         ════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-[14px] border border-[#E5E7EB] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700 h-[44px]">
                {visibleColumns.map((col, idx) => {
                  let alignClass = 'text-start';
                  if (col.align === 'center') alignClass = 'text-center';
                  else if (col.align === 'right') alignClass = 'text-end';

                  const isDraggingOver = dragOverColIndex === idx;

                  return (
                    <th
                      key={col.id}
                      draggable={true}
                      onDragStart={(e) => handleHeaderDragStart(e, idx)}
                      onDragOver={(e) => handleHeaderDragOver(e, idx)}
                      onDrop={(e) => handleHeaderDrop(e, idx)}
                      onDragEnd={handleHeaderDragEnd}
                      style={{ width: `${col.width}px`, minWidth: `${col.minWidth}px` }}
                      className={`py-2.5 px-3 border-l border-slate-200 ${alignClass} whitespace-nowrap select-none font-bold text-slate-700 cursor-grab active:cursor-grabbing transition-all ${
                        isDraggingOver ? 'bg-orange-100/70 border-r-2 border-r-[#F45A0A]' : 'hover:bg-slate-100/60'
                      }`}
                      title={isAr ? 'اسحب لإعادة ترتيب هذا العمود' : 'Drag to reorder column'}
                    >
                      <div className={`flex items-center gap-1.5 ${col.align === 'center' ? 'justify-center' : 'justify-between'}`}>
                        <span className="whitespace-nowrap">{isAr ? col.labelAr : col.labelEn}</span>
                        {col.id === 'actions' ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsColumnsModalOpen(true);
                            }}
                            className="p-1 rounded-md text-slate-400 hover:text-[#F45A0A] hover:bg-orange-50 transition-colors cursor-pointer"
                            title={isAr ? 'إعدادات وعرض الأعمدة' : 'Column Settings'}
                          >
                            <Settings2 size={13} />
                          </button>
                        ) : (
                          <GripVertical size={12} className="text-slate-300 opacity-0 group-hover:opacity-100" />
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="py-12 text-center text-slate-500 font-bold whitespace-nowrap">
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw size={24} className="animate-spin text-[#F45A0A]" />
                      <span>{isAr ? 'جارٍ تحميل سجلات الفنادق...' : 'Loading hotel bookings...'}</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="py-12 text-center text-slate-500 font-bold whitespace-nowrap">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#F45A0A] flex items-center justify-center">
                        <Building2 size={24} />
                      </div>
                      <span className="text-sm font-black text-slate-800">
                        {isAr ? 'لا توجد حجوزات فندقية مطابقة للبحث أو الفلتر' : 'No hotel bookings found'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((b, idx) => {
                  const rowIndex = (currentPage - 1) * pageSize + idx + 1;
                  return (
                    <tr
                      key={b.id}
                      onClick={() => {
                        setSelectedBooking(b);
                        setIsWorkspaceOpen(true);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContextMenu({ x: e.clientX, y: e.clientY, booking: b });
                      }}
                      className={`cursor-pointer transition-colors ${
                        idx % 2 === 0 ? 'bg-white hover:bg-orange-50/40' : 'bg-slate-50/40 hover:bg-orange-50/50'
                      }`}
                    >
                      {visibleColumns.map((col) => {
                        switch (col.id) {
                          case 'index':
                            return (
                              <td
                                key={col.id}
                                className="py-3 px-2 border-l border-slate-200 text-center font-mono font-bold text-slate-400 whitespace-nowrap"
                                style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
                              >
                                {rowIndex}
                              </td>
                            );

                          case 'invoiceNumber':
                            return (
                              <td
                                key={col.id}
                                className="py-3 px-3 border-l border-slate-200 font-mono font-black text-[#F45A0A] whitespace-nowrap text-center"
                                style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
                              >
                                {b.invoiceNumber}
                              </td>
                            );

                          case 'hotelAndGuest': {
                            const guestName = b.primaryGuestName || b.rooms?.[0]?.guestNames?.[0] || b.customerName;
                            return (
                              <td key={col.id} className="py-2.5 px-3 border-l border-slate-200 text-center whitespace-nowrap">
                                <div className="font-black text-slate-950 text-xs leading-tight whitespace-nowrap">{b.hotelName}</div>
                                <div className="text-[11px] text-slate-800 font-bold flex items-center justify-center gap-1.5 mt-0.5 whitespace-nowrap">
                                  <User size={12} className="text-[#F45A0A] shrink-0" />
                                  <span className="font-extrabold">{guestName}</span>
                                  {b.city && <span className="text-[10.5px] text-slate-500 font-bold">• {b.city}</span>}
                                </div>
                              </td>
                            );
                          }

                          case 'customerName':
                            return (
                              <td key={col.id} className="py-3 px-3 border-l border-slate-200 text-center whitespace-nowrap">
                                <div className="font-black text-slate-950 text-xs leading-tight whitespace-nowrap">
                                  {b.customerName || (isAr ? 'عميل نقدي' : 'Cash Client')}
                                </div>
                                {b.customerAgent && (
                                  <div className="text-[10.5px] text-slate-600 font-bold mt-0.5 whitespace-nowrap">
                                    {isAr ? 'الموكل:' : 'Agent:'} {b.customerAgent}
                                  </div>
                                )}
                              </td>
                            );

                          case 'supplierName':
                            return (
                              <td key={col.id} className="py-3 px-3 border-l border-slate-200 text-center whitespace-nowrap">
                                <span className="font-black text-slate-900 text-xs whitespace-nowrap">
                                  {b.supplierName || 'شركة الفنادق العامة'}
                                </span>
                              </td>
                            );

                          case 'dates':
                            return (
                              <td key={col.id} className="py-2.5 px-3 border-l border-slate-200 text-center whitespace-nowrap">
                                <div
                                  className="text-[11.5px] font-mono font-black text-slate-950 whitespace-nowrap"
                                  style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
                                  dir="ltr"
                                >
                                  {formatDateShort(b.checkInDate)} ➔ {formatDateShort(b.checkOutDate)}
                                </div>
                                <div className="mt-0.5 flex items-center justify-center gap-1.5">
                                  <span
                                    className="px-2.5 py-0.5 rounded-md bg-orange-50 border border-orange-200 text-[#F45A0A] font-black text-[10.5px] font-mono whitespace-nowrap"
                                    style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
                                  >
                                    {b.rooms?.length || 1} {isAr ? 'غرف' : 'Rooms'} • {b.nights || 1} {isAr ? 'ليالٍ' : 'Nights'}
                                  </span>
                                </div>
                              </td>
                            );

                          case 'cost':
                            return (
                              <td
                                key={col.id}
                                className="py-3 px-3 border-l border-slate-200 text-center font-mono font-black text-rose-700 text-xs tabular-nums whitespace-nowrap"
                                style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
                              >
                                {Number(b.totalCost).toLocaleString('en-US')}
                              </td>
                            );

                          case 'sale':
                            return (
                              <td
                                key={col.id}
                                className="py-3 px-3 border-l border-slate-200 text-center font-mono font-black text-emerald-700 text-xs tabular-nums whitespace-nowrap"
                                style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
                              >
                                {Number(b.totalSale).toLocaleString('en-US')}
                              </td>
                            );

                          case 'profit':
                            return (
                              <td
                                key={col.id}
                                className="py-3 px-3 border-l border-slate-200 text-center font-mono font-black text-blue-700 text-xs tabular-nums whitespace-nowrap"
                                style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
                              >
                                {Number(b.netProfit).toLocaleString('en-US')}
                              </td>
                            );

                          case 'currency':
                            return (
                              <td key={col.id} className="py-3 px-2 border-l border-slate-200 text-center whitespace-nowrap">
                                <span
                                  className={`font-mono font-black text-[11px] px-2 py-0.5 rounded whitespace-nowrap ${
                                    b.currency === 'USD'
                                      ? 'bg-amber-50 text-amber-900 border border-amber-300 font-extrabold'
                                      : 'bg-slate-100 text-slate-900 font-extrabold'
                                  }`}
                                >
                                  {b.currency}
                                </span>
                              </td>
                            );

                          case 'employees': {
                            const issuer = b.issuerEmployee || 'علي جعفر محمود';
                            const creator = b.creatorEmployee || b.issuerEmployee || 'علي جعفر محمود';
                            const isSame = issuer === creator;

                            return (
                              <td key={col.id} className="py-2.5 px-3 border-l border-slate-200 text-center whitespace-nowrap">
                                {isSame ? (
                                  <div className="flex flex-col items-center justify-center whitespace-nowrap">
                                    <div className="flex items-center gap-1.5 font-black text-slate-950 text-xs whitespace-nowrap">
                                      <UserCheck size={13} className="text-[#F45A0A] shrink-0" />
                                      <span>{issuer}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-bold mt-0.5 whitespace-nowrap">
                                      {isAr ? 'إدخال وإصدار' : 'Created & Issued'}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-0.5 flex flex-col items-center justify-center whitespace-nowrap">
                                    <div className="flex items-center gap-1 text-slate-950 font-black text-xs whitespace-nowrap">
                                      <UserCheck size={12} className="text-[#F45A0A] shrink-0" />
                                      <span>{issuer}</span>
                                      <span className="text-[9.5px] text-orange-600 font-bold">({isAr ? 'إصدار' : 'Issuer'})</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-slate-700 font-bold text-[11px] whitespace-nowrap">
                                      <UserPlus size={11} className="text-slate-400 shrink-0" />
                                      <span>{creator}</span>
                                      <span className="text-[9.5px] text-slate-500 font-bold">({isAr ? 'إدخال' : 'Creator'})</span>
                                    </div>
                                  </div>
                                )}
                              </td>
                            );
                          }

                          case 'audit':
                            return (
                              <td key={col.id} className="py-3 px-2 border-l border-slate-200 text-center whitespace-nowrap">
                                <span
                                  className={`text-[10.5px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap inline-flex items-center justify-center gap-1 ${
                                    b.status === 'CONFIRMED'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                                  }`}
                                >
                                  {b.status === 'CONFIRMED' ? (
                                    <>
                                      <CheckCircle2 size={11} className="text-emerald-600" />
                                      <span>{isAr ? 'مدقق' : 'Audited'}</span>
                                    </>
                                  ) : (
                                    <>
                                      <Clock size={11} className="text-amber-600" />
                                      <span>{isAr ? 'قيد التدقيق' : 'Pending'}</span>
                                    </>
                                  )}
                                </span>
                              </td>
                            );

                          case 'actions':
                            return (
                              <td key={col.id} className="py-3 px-2 text-center whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedBooking(b);
                                    setIsWorkspaceOpen(true);
                                  }}
                                  className="w-8 h-8 rounded-xl bg-orange-50 hover:bg-[#F45A0A] text-[#F45A0A] hover:text-white transition-all flex items-center justify-center shadow-2xs mx-auto cursor-pointer group"
                                  title={isAr ? 'دخول للفاتورة / عرض وتعديل' : 'Open Invoice Workspace'}
                                >
                                  <ArrowLeft
                                    size={15}
                                    className={`transition-transform ${
                                      direction === 'rtl'
                                        ? 'group-hover:-translate-x-0.5'
                                        : 'rotate-180 group-hover:translate-x-0.5'
                                    }`}
                                  />
                                </button>
                              </td>
                            );

                          default:
                            return null;
                        }
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── 5. PAGINATION FOOTER ── */}
        <div className="h-[46px] px-4 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 whitespace-nowrap">
          <div className="flex items-center gap-2">
            <span>{isAr ? 'إجمالي السجلات:' : 'Total Records:'}</span>
            <span
              className="font-bold font-mono text-slate-900 tabular-nums"
              style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
            >
              {filteredBookings.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500">
              {isAr ? `الصفحة ${currentPage} من ${totalPages}` : `Page ${currentPage} of ${totalPages}`}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight size={14} className={direction === 'rtl' ? '' : 'rotate-180'} />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft size={14} className={direction === 'rtl' ? '' : 'rotate-180'} />
              </button>
            </div>
          </div>

        {/* ✨ RIGHT-CLICK CONTEXT MENU ✨ */}
        {contextMenu && (
          <div
            className="fixed z-[9999] bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 min-w-[200px] animate-in fade-in zoom-in-95 duration-150"
            style={{
              top: Math.min(contextMenu.y, window.innerHeight - 200),
              left: Math.min(contextMenu.x, window.innerWidth - 220),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-3.5 py-2 border-b border-slate-100">
              <span className="text-[11px] font-bold text-slate-400">{isAr ? 'إجراءات الحجز' : 'Booking Actions'}</span>
              <span className="block text-xs font-bold text-slate-900 font-mono mt-0.5" dir="ltr">{contextMenu.booking.invoiceNumber}</span>
            </div>

            {/* Open Invoice */}
            <button
              type="button"
              onClick={() => {
                setSelectedBooking(contextMenu.booking);
                setIsWorkspaceOpen(true);
                setContextMenu(null);
              }}
              className="w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer text-start"
            >
              <Eye size={15} className="text-[#F45A0A]" />
              <span>{isAr ? 'فتح الفاتورة' : 'Open Invoice'}</span>
            </button>

            {/* Divider */}
            <div className="border-t border-slate-100 my-1" />

            {/* Delete / Archive */}
            <button
              type="button"
              onClick={() => {
                if (window.confirm(isAr ? `هل تريد حذف الحجز ${contextMenu.booking.invoiceNumber}؟` : `Delete booking ${contextMenu.booking.invoiceNumber}?`)) {
                  archiveHotel(contextMenu.booking);
                  deleteMutation.mutate(contextMenu.booking.id);
                }
                setContextMenu(null);
              }}
              className="w-full px-3.5 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors cursor-pointer text-start"
            >
              <Trash2 size={15} />
              <span>{isAr ? 'حذف الحجز' : 'Delete Booking'}</span>
            </button>
          </div>
        )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          6. COLUMNS CUSTOMIZATION & WIDTH CONTROL MODAL
         ════════════════════════════════════════════════════════════════════ */}
      <Modal
        opened={isColumnsModalOpen}
        onClose={() => setIsColumnsModalOpen(false)}
        title={
          <div className="flex items-center gap-2 font-black text-slate-900 text-sm sm:text-base">
            <div className="w-7 h-7 rounded-lg bg-orange-50 text-[#F45A0A] flex items-center justify-center">
              <Settings2 size={16} />
            </div>
            <span>{isAr ? 'إعدادات وتحريك وعرض أعمدة الجدول' : 'Column Widths & Visibility'}</span>
          </div>
        }
        centered
        size="lg"
        radius="lg"
        overlayProps={{ backgroundOpacity: 0.35, blur: 2 }}
        dir={direction}
      >
        <div className="space-y-4 pt-1" style={{ fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif" }}>
          <p className="text-xs text-slate-500 font-medium">
            {isAr
              ? 'تحكم في إظهار أو إخفاء أي عمود، تحديد العرض بالبكسل، وإعادة ترتيب موقع الأعمدة في الجدول.'
              : 'Toggle visibility, adjust width in pixels, and reorder columns.'}
          </p>

          {/* Columns List */}
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {columns.map((col, idx) => (
              <div
                key={col.id}
                className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-all ${
                  col.visible
                    ? 'bg-white border-slate-200 shadow-2xs'
                    : 'bg-slate-50 border-dashed border-slate-200 opacity-60'
                }`}
              >
                {/* Column Toggle & Label */}
                <label className="flex items-center gap-2.5 cursor-pointer select-none min-w-[150px]">
                  <input
                    type="checkbox"
                    checked={col.visible}
                    onChange={() => handleToggleColumn(col.id)}
                    className="w-4 h-4 rounded border-slate-300 text-[#F45A0A] focus:ring-[#F45A0A] cursor-pointer"
                  />
                  <span className={`text-xs font-bold ${col.visible ? 'text-slate-900' : 'text-slate-400'}`}>
                    {isAr ? col.labelAr : col.labelEn}
                  </span>
                </label>

                {/* Width Controller (Input in px) */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500">{isAr ? 'العرض:' : 'Width:'}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={col.width}
                      min={col.minWidth}
                      max={600}
                      step={10}
                      onChange={(e) => handleUpdateColumnWidth(col.id, Number(e.target.value))}
                      className="w-18 h-8 px-2 text-center text-xs font-bold text-slate-900 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-[#F45A0A] font-mono"
                      dir="ltr"
                    />
                    <span className="text-[10px] text-slate-400 font-mono">px</span>
                  </div>
                </div>

                {/* Move Arrows (Reordering) */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleMoveColumn(idx, 'UP')}
                    disabled={idx === 0}
                    className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-600 disabled:opacity-30 cursor-pointer"
                    title={isAr ? 'تحريك للأعلى / لليمين' : 'Move Up'}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveColumn(idx, 'DOWN')}
                    disabled={idx === columns.length - 1}
                    className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-600 disabled:opacity-30 cursor-pointer"
                    title={isAr ? 'تحريك للأسفل / لليسار' : 'Move Down'}
                  >
                    <ArrowDown size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleResetColumns}
              className="h-9 px-3 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw size={14} />
              <span>{isAr ? 'استعادة الافتراضي' : 'Reset Defaults'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsColumnsModalOpen(false)}
              className="h-9 px-5 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Check size={15} />
              <span>{isAr ? 'تم وحفظ' : 'Done & Save'}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* ════════════════════════════════════════════════════════════════════
          7. HOTEL BOOKING EDITOR WORKSPACE (Full-Screen Modular Workspace)
         ════════════════════════════════════════════════════════════════════ */}
      <HotelBookingEditorWorkspace
        opened={isWorkspaceOpen}
        onClose={() => {
          setIsWorkspaceOpen(false);
          setSelectedBooking(null);
        }}
        initialData={selectedBooking}
        onSuccess={() => {
          refetch();
          setIsWorkspaceOpen(false);
          setSelectedBooking(null);
        }}
      />
    </div>
  );
};
