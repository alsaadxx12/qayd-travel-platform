import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { apiRequest } from '../api/client';
import { showSuccessNotification, showErrorNotification } from '../utils/notifications';
import { FinancialVoucherForm, readVoucherSplits } from '../components/vouchers/FinancialVoucherForm';
import { VoucherPrintModal, type VoucherPrintItem } from '../components/vouchers/VoucherPrintModal';
import { useLanguageStore } from '../store/useLanguageStore';
import { useAiPageContext } from '../hooks/useAiPageContext';
import { SegmentedDatePicker } from '../components/ui/SegmentedDatePicker';
import { CurrencySegmentedControl } from '../components/ui/CurrencySegmentedControl';
import { Modal, Drawer, Menu, Tooltip } from '@mantine/core';
import {
  Receipt,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  FileText,
  Plus,
  Printer,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Eye,
  Edit,
  Trash2,
  Paperclip,
  User,
  AlertTriangle,
  ChevronDown,
  FilterX,
  Wallet,
  TrendingUp,
  TrendingDown,
  Layers,
  X,
  CheckSquare,
  MoreVertical,
  CheckCircle2,
  Calendar,
  Building2
} from 'lucide-react';

type TabType = 'RECEIPT' | 'PAYMENT' | 'JOURNAL' | 'EXCHANGE';

export const VouchersPage: React.FC = () => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  const [activeTab, setActiveTab] = useState<TabType>('RECEIPT');
  const [loading, setLoading] = useState(true);
  const [receiptsList, setReceiptsList] = useState<any[]>([]);
  const [paymentsList, setPaymentsList] = useState<any[]>([]);
  const [journalVouchersList, setJournalVouchersList] = useState<any[]>([]);
  const [accountsList, setAccountsList] = useState<any[]>([]);
  const [customVoucherAccounts, setCustomVoucherAccounts] = useState<any[]>([]);

  // Filtering states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState<'ALL' | 'IQD' | 'USD'>('ALL');
  const [startDate, setStartDate] = useState<Date | null>(() => new Date(new Date().getFullYear(), 0, 1));
  const [endDate, setEndDate] = useState<Date | null>(() => new Date());
  const [quickDatePreset, setQuickDatePreset] = useState<string>('THIS_YEAR');
  const [selectedCashboxFilter, setSelectedCashboxFilter] = useState<string>('ALL');

  // Modal & Drawer states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [modalInitialType, setModalInitialType] = useState<'RECEIPT' | 'PAYMENT' | 'EXCHANGE' | 'JOURNAL'>('RECEIPT');
  const [selectedEditVoucherId, setSelectedEditVoucherId] = useState<string | undefined>(undefined);
  const [selectedVoucher, setSelectedVoucher] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [slipModalOpen, setSlipModalOpen] = useState(false);
  const [selectedSlipVoucher, setSelectedSlipVoucher] = useState<any>(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [voucherToPrint, setVoucherToPrint] = useState<VoucherPrintItem | null>(null);

  const openVoucher = selectedVoucher || selectedSlipVoucher;
  useAiPageContext({
    route: '/vouchers',
    entity: openVoucher ? 'voucher' : undefined,
    recordId: selectedEditVoucherId || openVoucher?.id,
    label: openVoucher?.voucherNumber || openVoucher?.number,
  });

  // Delete Voucher States
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [voucherToDelete, setVoucherToDelete] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Clear selection when tab changes
  useEffect(() => { setSelectedIds(new Set()); }, [activeTab]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === currentGridData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(currentGridData.map((r: any) => r.id)));
    }
  };

  // Ref to accountsMap for name resolution
  const accountsMapRef = React.useRef<Record<string, string>>({});

  const fetchAllData = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) setLoading(true);
    try {
      const noCacheOpt = forceRefresh ? { noCache: true } : {};
      const [receipts, payments, accounts, allJVs, customAccsRes] = await Promise.all([
        apiRequest('/api/receipt-vouchers', noCacheOpt).catch(() => []),
        apiRequest('/api/payment-vouchers', noCacheOpt).catch(() => []),
        // `lite=1` matters a lot: the full endpoint reads EVERY posted journal line in
        // the company to recompute balances. This page only needs id -> name.
        apiRequest('/api/accounts?lite=1', noCacheOpt)
          .catch(() => apiRequest('/api/accounts', noCacheOpt).catch(() => [])),
        apiRequest('/api/journal-entries', noCacheOpt).catch(() => []),
        apiRequest('/api/print-templates/custom_voucher_accounts', noCacheOpt).catch(() => null),
      ]);

      const activeCustomAccounts = (customAccsRes?.config?.accounts || []).filter((a: any) => a.isActive !== false);
      setCustomVoucherAccounts(activeCustomAccounts);

      const accountsMap: Record<string, string> = {};
      (accounts || []).forEach((acc: any) => {
        if (acc.id) {
          accountsMap[acc.id] = acc.nameAr || acc.name || acc.code;
        }
      });
      accountsMapRef.current = accountsMap;
      setAccountsList(accounts || []);

      const formatDateEn = (dateVal: any): string => {
        if (!dateVal) return '';
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return String(dateVal);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      const formattedReceipts = (receipts || []).map((r: any) => {
        const { cleanDescription, splitAccounts: parsedSplits } = readVoucherSplits(r.description);
        const splits = (r.splitAccounts && Array.isArray(r.splitAccounts) && r.splitAccounts.length > 0) ? r.splitAccounts : parsedSplits;
        return {
          ...r,
          type: 'RECEIPT',
          typeLabel: isAr ? 'سند قبض' : 'Receipt Voucher',
          dateFormatted: formatDateEn(r.date || r.createdAt),
          accountName: r.account?.nameAr || accountsMap[r.accountId] || (isAr ? 'حساب عميل/طرف' : 'Client Account'),
          cashboxName: r.cashboxOrBankAccount?.nameAr || accountsMap[r.cashboxOrBankAccountId] || (isAr ? 'الصندوق الرئيسي' : 'Main Cashbox'),
          amount: Number(r.amount || 0),
          currency: r.currency || 'IQD',
          userName: r.createdBy?.name || r.createdBy?.fullName || (isAr ? 'مدير النظام' : 'Administrator'),
          slipsCount: r.slipsCount || 0,
          description: cleanDescription || r.description,
          splitAccounts: splits.length > 0 ? splits : undefined,
          splitDescription: splits.length > 0 ? splits.map((s: any) => `${s.accountName}: ${Number(s.amount).toLocaleString('en-US')}`).join(' | ') : undefined,
        };
      }).sort((a: any, b: any) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());

      const formattedPayments = (payments || []).map((p: any) => {
        const { cleanDescription, splitAccounts: parsedSplits } = readVoucherSplits(p.description);
        const splits = (p.splitAccounts && Array.isArray(p.splitAccounts) && p.splitAccounts.length > 0) ? p.splitAccounts : parsedSplits;
        return {
          ...p,
          type: 'PAYMENT',
          typeLabel: isAr ? 'سند دفع' : 'Payment Voucher',
          dateFormatted: formatDateEn(p.date || p.createdAt),
          accountName: p.supplier?.nameAr || p.account?.nameAr || accountsMap[p.accountId] || (isAr ? 'حساب مورد/طرف' : 'Supplier Account'),
          cashboxName: p.cashboxOrBankAccount?.nameAr || accountsMap[p.cashboxOrBankAccountId] || (isAr ? 'الصندوق الرئيسي' : 'Main Cashbox'),
          amount: Number(p.amount || 0),
          currency: p.currency || 'IQD',
          userName: p.createdBy?.name || p.createdBy?.fullName || (isAr ? 'مدير النظام' : 'Administrator'),
          slipsCount: p.slipsCount || 0,
          description: cleanDescription || p.description,
          splitAccounts: splits.length > 0 ? splits : undefined,
          splitDescription: splits.length > 0 ? splits.map((s: any) => `${s.accountName}: ${Number(s.amount).toLocaleString('en-US')}`).join(' | ') : undefined,
        };
      }).sort((a: any, b: any) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());

      // Filter only user-created manual Journal Vouchers (سندات القيد) and exclude automated invoice entries
      const formattedManualJVs = (allJVs || [])
        .filter((j: any) => {
          const ref = String(j.reference || j.entryNumber || '');
          return (
            ref.includes('JV-') ||
            ref.includes('BR-') ||
            ref.includes('قيد') ||
            j.sourceType === 'JOURNAL' ||
            j.sourceType === 'MANUAL' ||
            (!ref.includes('TKT-') &&
             !ref.includes('INV-') &&
             !ref.includes('VISA-') &&
             !ref.includes('REF-') &&
             !ref.includes('DEP-') &&
             !ref.includes('SAL-'))
          );
        })
        .map((j: any) => {
          const firstDebitLine = j.lines?.find((l: any) => Number(l.debit) > 0);
          const firstCreditLine = j.lines?.find((l: any) => Number(l.credit) > 0);
          return {
            ...j,
            voucherNumber: j.entryNumber || j.reference || j.id,
            type: 'JOURNAL',
            typeLabel: isAr ? 'سند قيد' : 'Journal Voucher',
            dateFormatted: formatDateEn(j.date || j.createdAt),
            accountName: firstCreditLine?.account?.nameAr || accountsMap[firstCreditLine?.accountId] || (isAr ? 'حساب دائن' : 'Credit Account'),
            cashboxName: firstDebitLine?.account?.nameAr || accountsMap[firstDebitLine?.accountId] || (isAr ? 'حساب مدين' : 'Debit Account'),
            amount: Number(j.totalDebit || j.amount || 0),
            currency: j.currency || 'IQD',
            userName: j.createdBy?.name || j.createdBy?.fullName || (isAr ? 'مدير النظام' : 'Administrator'),
            slipsCount: 0,
          };
        })
        .sort((a: any, b: any) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());

      setReceiptsList(formattedReceipts);
      setPaymentsList(formattedPayments);
      setJournalVouchersList(formattedManualJVs);
    } catch (err) {
      console.error('Error fetching vouchers:', err);
    } finally {
      if (!forceRefresh) setLoading(false);
    }
  }, [isAr]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Handle Quick Date Presets
  const handleQuickPreset = (preset: string) => {
    setQuickDatePreset(preset);
    const now = new Date();
    if (preset === 'TODAY') {
      setStartDate(now);
      setEndDate(now);
    } else if (preset === 'THIS_MONTH') {
      setStartDate(new Date(now.getFullYear(), now.getMonth(), 1));
      setEndDate(now);
    } else if (preset === 'THIS_YEAR') {
      setStartDate(new Date(now.getFullYear(), 0, 1));
      setEndDate(now);
    } else {
      setStartDate(null);
      setEndDate(null);
    }
  };

  // Exchange List Filter
  const exchangeList = useMemo(() => {
    const all = [...receiptsList, ...paymentsList];
    return all.filter((v) =>
      v.description?.includes('صرافة') ||
      v.description?.includes('تحويل') ||
      v.description?.includes('بورصة') ||
      v.description?.toLowerCase().includes('exchange') ||
      v.accountName?.includes('صرافة') ||
      v.accountName?.includes('بورصة')
    );
  }, [receiptsList, paymentsList]);

  // Distinct Cashboxes List for dropdown filter
  const cashboxOptions = useMemo(() => {
    const all = [...receiptsList, ...paymentsList];
    const names = new Set<string>();
    all.forEach((v) => {
      if (v.cashboxName) names.add(v.cashboxName);
    });
    return Array.from(names);
  }, [receiptsList, paymentsList]);

  // KPI Calculation
  const kpis = useMemo(() => {
    let totalReceiptsIQD = 0;
    let totalReceiptsUSD = 0;
    receiptsList.forEach((r) => {
      if (r.currency === 'USD') totalReceiptsUSD += Number(r.amount || 0);
      else totalReceiptsIQD += Number(r.amount || 0);
    });

    let totalPaymentsIQD = 0;
    let totalPaymentsUSD = 0;
    paymentsList.forEach((p) => {
      if (p.currency === 'USD') totalPaymentsUSD += Number(p.amount || 0);
      else totalPaymentsIQD += Number(p.amount || 0);
    });

    const netCashFlowIQD = totalReceiptsIQD - totalPaymentsIQD;
    const netCashFlowUSD = totalReceiptsUSD - totalPaymentsUSD;
    const totalVouchersCount = receiptsList.length + paymentsList.length + journalVouchersList.length;

    return {
      totalReceiptsIQD,
      totalReceiptsUSD,
      receiptsCount: receiptsList.length,
      totalPaymentsIQD,
      totalPaymentsUSD,
      paymentsCount: paymentsList.length,
      journalCount: journalVouchersList.length,
      netCashFlowIQD,
      netCashFlowUSD,
      totalVouchersCount,
    };
  }, [receiptsList, paymentsList, journalVouchersList]);

  // Current Grid Data filtered by search, date, cashbox, and currency
  const currentGridData = useMemo(() => {
    let sourceList: any[] = [];
    switch (activeTab) {
      case 'RECEIPT':
        sourceList = receiptsList;
        break;
      case 'PAYMENT':
        sourceList = paymentsList;
        break;
      case 'JOURNAL':
        sourceList = journalVouchersList;
        break;
      case 'EXCHANGE':
        sourceList = exchangeList;
        break;
      default:
        sourceList = receiptsList;
    }

    return sourceList.filter((v) => {
      // 1. Currency filter
      if (selectedCurrency !== 'ALL' && v.currency !== selectedCurrency) {
        return false;
      }

      // 2. Cashbox filter
      if (selectedCashboxFilter !== 'ALL' && v.cashboxName !== selectedCashboxFilter) {
        return false;
      }

      // 3. Date range filter
      if (startDate || endDate) {
        const itemDate = new Date(v.date || v.createdAt);
        if (startDate) {
          const s = new Date(startDate);
          s.setHours(0, 0, 0, 0);
          if (itemDate < s) return false;
        }
        if (endDate) {
          const e = new Date(endDate);
          e.setHours(23, 59, 59, 999);
          if (itemDate > e) return false;
        }
      }

      // 4. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const vNum = String(v.voucherNumber || '').toLowerCase();
        const accName = String(v.accountName || '').toLowerCase();
        const cName = String(v.cashboxName || '').toLowerCase();
        const desc = String(v.description || '').toLowerCase();
        const uName = String(v.userName || '').toLowerCase();
        return (
          vNum.includes(q) ||
          accName.includes(q) ||
          cName.includes(q) ||
          desc.includes(q) ||
          uName.includes(q)
        );
      }

      return true;
    });
  }, [activeTab, receiptsList, paymentsList, journalVouchersList, exchangeList, selectedCurrency, selectedCashboxFilter, startDate, endDate, searchQuery]);

  // Delete Voucher Action
  const handleDeleteVoucher = async () => {
    if (!voucherToDelete) return;
    setDeleting(true);

    const deletedId = voucherToDelete.id;
    const isTemp = typeof deletedId === 'string' && deletedId.startsWith('temp-');

    try {
      if (!isTemp) {
        const endpoint = voucherToDelete.type === 'RECEIPT'
          ? `/api/receipt-vouchers/${deletedId}`
          : voucherToDelete.type === 'PAYMENT'
          ? `/api/payment-vouchers/${deletedId}`
          : `/api/journal-entries/${deletedId}`;

        await apiRequest(endpoint, { method: 'DELETE' });
      }

      showSuccessNotification(
        isAr ? 'تم حذف السند بنجاح' : 'Voucher Deleted',
        isAr ? `تم حذف السند رقم [${voucherToDelete.voucherNumber}] بنجاح.` : `Voucher [${voucherToDelete.voucherNumber}] deleted successfully.`
      );

      if (voucherToDelete.type === 'RECEIPT') {
        setReceiptsList((prev) => prev.filter((v) => v.id !== deletedId));
      } else if (voucherToDelete.type === 'PAYMENT') {
        setPaymentsList((prev) => prev.filter((v) => v.id !== deletedId));
      } else {
        setJournalVouchersList((prev) => prev.filter((v) => v.id !== deletedId));
      }

      setDeleteConfirmOpen(false);
      setVoucherToDelete(null);
    } catch (err: any) {
      showErrorNotification(isAr ? 'خطأ في الحذف' : 'Delete Error', err.message || (isAr ? 'تعذر حذف السند' : 'Failed to delete'));
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenCreateModal = (type: 'RECEIPT' | 'PAYMENT' | 'EXCHANGE' | 'JOURNAL') => {
    setSelectedEditVoucherId(undefined);
    setModalInitialType(type);
    setCreateModalOpen(true);
  };

  const handleOpenEditModal = (voucher: any) => {
    setSelectedEditVoucherId(voucher.id);
    const vType = voucher.type === 'PAYMENT' || voucher.voucherType === 'PAYMENT'
      ? 'PAYMENT'
      : voucher.type === 'JOURNAL' || voucher.voucherType === 'JOURNAL'
      ? 'JOURNAL'
      : 'RECEIPT';
    setModalInitialType(vType);
    setCreateModalOpen(true);
  };

  const handleVoucherSaved = (savedItem?: any) => {
    if (!savedItem) return;
    // The form only calls this after the server has confirmed the write, so a single
    // refresh is both correct and sufficient.
    fetchAllData(true);
  };

  // Export to Excel Function — the library is fetched on demand, not at page load.
  const [exporting, setExporting] = useState(false);

  const exportVouchersToExcel = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const XLSX = await import('xlsx');
      const rows = currentGridData.map((v, i) => ({
        '#': i + 1,
        [isAr ? 'رقم السند' : 'Voucher No']: v.voucherNumber,
        [isAr ? 'النوع' : 'Type']: v.typeLabel,
        [isAr ? 'التاريخ' : 'Date']: v.dateFormatted,
        [isAr ? 'الطرف / الحساب' : 'Party / Account']: v.accountName,
        [isAr ? 'الصندوق / البنك' : 'Cashbox / Bank']: v.cashboxName,
        [isAr ? 'المبلغ' : 'Amount']: Number(v.amount || 0),
        [isAr ? 'العملة' : 'Currency']: v.currency,
        [isAr ? 'البيان' : 'Description']: v.description || '',
        [isAr ? 'المستخدم' : 'Created By']: v.userName || '',
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet['!cols'] = [
        { wch: 6 },
        { wch: 20 },
        { wch: 16 },
        { wch: 14 },
        { wch: 28 },
        { wch: 22 },
        { wch: 18 },
        { wch: 10 },
        { wch: 35 },
        { wch: 20 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, isAr ? 'السندات المالية' : 'Vouchers');
      XLSX.writeFile(workbook, `Financial_Vouchers_${new Date().toISOString().split('T')[0]}.xlsx`);

      showSuccessNotification(
        isAr ? 'تم تصدير الإكسل' : 'Export Complete',
        isAr ? 'تم حفظ سجل السندات بصيغة Excel بنجاح.' : 'Exported successfully.'
      );
    } catch (err: any) {
      console.error('Excel Export Error:', err);
      showErrorNotification(
        isAr ? 'تعذّر التصدير' : 'Export failed',
        err?.message || (isAr ? 'حدث خطأ أثناء إنشاء ملف الإكسل.' : 'Could not build the Excel file.')
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FB] p-3 sm:p-5 space-y-4 text-slate-900 select-none" dir={direction}>
      {/*
        The design deliberately has no visible page title, but a document still needs
        exactly one H1. `sr-only` keeps it out of the layout entirely while screen
        readers and crawlers still see it.
      */}
      <h1 className="sr-only">
        {isAr ? 'السندات المالية — سندات القبض والدفع والقيد والصرافة' : 'Financial Vouchers — Receipts, Payments, Journal & FX'}
      </h1>

      {/* ── 1. KPI Metrics Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Receipts */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs relative overflow-hidden flex flex-col justify-between hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shadow-2xs">
                <ArrowDownLeft size={18} />
              </div>
              <div>
                <span className="text-[11.5px] font-bold text-slate-500 block leading-tight">
                  {isAr ? 'إجمالي المقبوضات' : 'Total Receipts'}
                </span>
                <span className="text-[10px] text-emerald-600 font-bold">
                  {kpis.receiptsCount} {isAr ? 'سند قبض نشط' : 'Active Receipts'}
                </span>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {isAr ? 'وارد' : 'Inflow'}
            </span>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-100 space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-bold text-slate-400">{isAr ? 'بالدينار:' : 'IQD:'}</span>
              <span className="font-mono font-black text-base text-slate-950 tabular-nums">
                {kpis.totalReceiptsIQD.toLocaleString()} <span className="text-[10px] text-slate-400 font-semibold">{isAr ? 'د.ع' : 'IQD'}</span>
              </span>
            </div>
            {kpis.totalReceiptsUSD > 0 && (
              <div className="flex items-baseline justify-between text-blue-700">
                <span className="text-[11px] font-bold text-slate-400">{isAr ? 'بالدولار:' : 'USD:'}</span>
                <span className="font-mono font-black text-xs tabular-nums">
                  ${kpis.totalReceiptsUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Total Payments */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs relative overflow-hidden flex flex-col justify-between hover:border-rose-300 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold shadow-2xs">
                <ArrowUpRight size={18} />
              </div>
              <div>
                <span className="text-[11.5px] font-bold text-slate-500 block leading-tight">
                  {isAr ? 'إجمالي المدفوعات' : 'Total Payments'}
                </span>
                <span className="text-[10px] text-rose-600 font-bold">
                  {kpis.paymentsCount} {isAr ? 'سند صرف نشط' : 'Active Payments'}
                </span>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
              {isAr ? 'صرف' : 'Outflow'}
            </span>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-100 space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-bold text-slate-400">{isAr ? 'بالدينار:' : 'IQD:'}</span>
              <span className="font-mono font-black text-base text-slate-950 tabular-nums">
                {kpis.totalPaymentsIQD.toLocaleString()} <span className="text-[10px] text-slate-400 font-semibold">{isAr ? 'د.ع' : 'IQD'}</span>
              </span>
            </div>
            {kpis.totalPaymentsUSD > 0 && (
              <div className="flex items-baseline justify-between text-blue-700">
                <span className="text-[11px] font-bold text-slate-400">{isAr ? 'بالدولار:' : 'USD:'}</span>
                <span className="font-mono font-black text-xs tabular-nums">
                  ${kpis.totalPaymentsUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Net Cash Flow */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs relative overflow-hidden flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shadow-2xs ${kpis.netCashFlowIQD >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                {kpis.netCashFlowIQD >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
              </div>
              <div>
                <span className="text-[11.5px] font-bold text-slate-500 block leading-tight">
                  {isAr ? 'صافي حركة النقد' : 'Net Cash Flow'}
                </span>
                <span className={`text-[10px] font-bold ${kpis.netCashFlowIQD >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {isAr ? 'الفارق النقدي' : 'Cash Variance'}
                </span>
              </div>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${kpis.netCashFlowIQD >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
              {kpis.netCashFlowIQD >= 0 ? (isAr ? 'فائض' : 'Surplus') : (isAr ? 'عجز' : 'Deficit')}
            </span>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-100 space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-bold text-slate-400">{isAr ? 'بالدينار:' : 'IQD:'}</span>
              <span className={`font-mono font-black text-base tabular-nums ${kpis.netCashFlowIQD >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {kpis.netCashFlowIQD.toLocaleString()} <span className="text-[10px] text-slate-400 font-semibold">{isAr ? 'د.ع' : 'IQD'}</span>
              </span>
            </div>
            {kpis.netCashFlowUSD !== 0 && (
              <div className="flex items-baseline justify-between text-blue-700">
                <span className="text-[11px] font-bold text-slate-400">{isAr ? 'بالدولار:' : 'USD:'}</span>
                <span className="font-mono font-black text-xs tabular-nums">
                  ${kpis.netCashFlowUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Total Financial Vouchers */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs relative overflow-hidden flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-orange-50 text-[#F45A0A] flex items-center justify-center font-bold shadow-2xs">
                <Layers size={18} />
              </div>
              <div>
                <span className="text-[11.5px] font-bold text-slate-500 block leading-tight">
                  {isAr ? 'إجمالي السندات المالية' : 'Total Financial Vouchers'}
                </span>
                <span className="text-[10px] text-slate-600 font-bold">
                  {kpis.totalVouchersCount} {isAr ? 'سند معتمد' : 'Posted Vouchers'}
                </span>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-[#F45A0A] border border-orange-200">
              {isAr ? 'معتمد' : 'Approved'}
            </span>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-100 flex items-baseline justify-between">
            <span className="text-[11px] font-bold text-slate-400">{isAr ? 'إجمالي السجلات:' : 'Total Records:'}</span>
            <span className="font-mono font-black text-base text-slate-950 tabular-nums">
              {kpis.totalVouchersCount} <span className="text-xs text-slate-400 font-semibold">{isAr ? 'سند' : 'vouchers'}</span>
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. Unified Two-Row Toolbar Container (Tabs + Orange Actions on Row 1, Filters on Row 2) ── */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        {/* ROW 1: Voucher Tabs (Right) & Action Buttons (Left) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          {/* Right: Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto p-0.5">
            {/* Receipts Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('RECEIPT')}
              className={`h-[38px] px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'RECEIPT'
                  ? 'bg-[#F45A0A] text-white shadow-2xs font-black'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <ArrowDownLeft size={16} />
              <span>{isAr ? 'سندات القبض' : 'Receipt Vouchers'}</span>
              <span className={`px-2 py-0.5 rounded-full font-mono text-[10.5px] font-black ${activeTab === 'RECEIPT' ? 'bg-[#DD4F05] text-white' : 'bg-slate-100 text-slate-600'}`}>
                {receiptsList.length}
              </span>
            </button>

            {/* Payments Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('PAYMENT')}
              className={`h-[38px] px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'PAYMENT'
                  ? 'bg-[#F45A0A] text-white shadow-2xs font-black'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <ArrowUpRight size={16} />
              <span>{isAr ? 'سندات الدفع والصرف' : 'Payment Vouchers'}</span>
              <span className={`px-2 py-0.5 rounded-full font-mono text-[10.5px] font-black ${activeTab === 'PAYMENT' ? 'bg-[#DD4F05] text-white' : 'bg-slate-100 text-slate-600'}`}>
                {paymentsList.length}
              </span>
            </button>

            {/* Manual Journal Vouchers Tab (سندات القيد) */}
            <button
              type="button"
              onClick={() => setActiveTab('JOURNAL')}
              className={`h-[38px] px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'JOURNAL'
                  ? 'bg-[#F45A0A] text-white shadow-2xs font-black'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <FileText size={16} />
              <span>{isAr ? 'سندات القيد' : 'Journal Vouchers'}</span>
              <span className={`px-2 py-0.5 rounded-full font-mono text-[10.5px] font-black ${activeTab === 'JOURNAL' ? 'bg-[#DD4F05] text-white' : 'bg-slate-100 text-slate-600'}`}>
                {journalVouchersList.length}
              </span>
            </button>

            {/* FX & Transfers Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('EXCHANGE')}
              className={`h-[38px] px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'EXCHANGE'
                  ? 'bg-[#F45A0A] text-white shadow-2xs font-black'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <ArrowLeftRight size={16} />
              <span>{isAr ? 'سندات الصرافة والتحويل' : 'FX & Transfers'}</span>
              <span className={`px-2 py-0.5 rounded-full font-mono text-[10.5px] font-black ${activeTab === 'EXCHANGE' ? 'bg-[#DD4F05] text-white' : 'bg-slate-100 text-slate-600'}`}>
                {exchangeList.length}
              </span>
            </button>
          </div>

          {/* Left: Orange Create Button + Export + Refresh */}
          <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
            {/* Orange Create Button with Dropdown */}
            <Menu shadow="md" width={220} position="bottom-end" radius="12px">
              <Menu.Target>
                <button
                  type="button"
                  className="h-[38px] px-4 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <Plus size={16} className="text-white" />
                  <span>{isAr ? 'إنشاء سند مالي جديد' : 'New Financial Voucher'}</span>
                  <ChevronDown size={13} className="text-white/80" />
                </button>
              </Menu.Target>
              <Menu.Dropdown className="p-1 font-sans text-xs">
                <Menu.Item
                  leftSection={<ArrowDownLeft size={15} className="text-emerald-600" />}
                  onClick={() => handleOpenCreateModal('RECEIPT')}
                  className="font-bold text-slate-800 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg py-2"
                >
                  {isAr ? 'سند قبض نقدي / بنكي' : 'Receipt Voucher (Cash/Bank)'}
                </Menu.Item>
                <Menu.Item
                  leftSection={<ArrowUpRight size={15} className="text-rose-600" />}
                  onClick={() => handleOpenCreateModal('PAYMENT')}
                  className="font-bold text-slate-800 hover:bg-rose-50 hover:text-rose-700 rounded-lg py-2"
                >
                  {isAr ? 'سند دفع وصرف نقدي' : 'Payment Voucher'}
                </Menu.Item>
                <Menu.Item
                  leftSection={<FileText size={15} className="text-orange-600" />}
                  onClick={() => handleOpenCreateModal('JOURNAL')}
                  className="font-bold text-slate-800 hover:bg-orange-50 hover:text-orange-700 rounded-lg py-2"
                >
                  {isAr ? 'سند قيد محاسبي مزدوج' : 'Double-Entry Journal Voucher'}
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  leftSection={<ArrowLeftRight size={15} className="text-amber-600" />}
                  onClick={() => handleOpenCreateModal('EXCHANGE')}
                  className="font-bold text-slate-800 hover:bg-amber-50 hover:text-amber-700 rounded-lg py-2"
                >
                  {isAr ? 'سند صرافة وتحويل عملات' : 'FX & Currency Transfer'}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => fetchAllData(true)}
              disabled={loading}
              className="h-[38px] w-[38px] rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold flex items-center justify-center cursor-pointer transition-all disabled:opacity-50"
              aria-label={isAr ? 'تحديث بيانات السندات' : 'Refresh vouchers'}
              title={isAr ? 'تحديث البيانات' : 'Refresh'}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin text-[#F45A0A]' : 'text-slate-500'} />
            </button>

            {/* Export Excel Button */}
            <button
              type="button"
              onClick={exportVouchersToExcel}
              disabled={exporting}
              aria-label={isAr ? 'تصدير السندات إلى ملف إكسل' : 'Export vouchers to Excel'}
              className="h-[38px] px-3.5 rounded-xl bg-orange-50/80 border border-orange-200 hover:bg-orange-100 text-[#F45A0A] font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all disabled:opacity-60"
            >
              <FileSpreadsheet size={15} />
              <span>{exporting ? (isAr ? 'جارٍ التصدير…' : 'Exporting…') : 'Excel'}</span>
            </button>
          </div>
        </div>

        {/* ROW 2: Search, Date Range, Currency Filter, Cashbox */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* General Search Input */}
          <div className="relative min-w-[240px] max-w-[340px] flex-1">
            <Search size={15} className={`absolute ${direction === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-400`} />
            <input
              type="search"
              id="vouchers-search"
              aria-label={isAr ? 'بحث في السندات المالية' : 'Search financial vouchers'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isAr ? 'بحث برقم السند، الطرف، الصندوق، أو البيان...' : 'Search by voucher #, party, cashbox...'}
              className={`w-full h-[38px] ${direction === 'rtl' ? 'pr-9 pl-4' : 'pl-9 pr-4'} rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-[#F45A0A] text-xs font-bold text-slate-900 transition-all`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label={isAr ? 'مسح نص البحث' : 'Clear search'}
                className={`absolute ${direction === 'rtl' ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer`}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Date Range Filters (From & To using exact SegmentedDatePicker from Tickets Page) */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Quick Date Presets */}
            <div className="h-[38px] p-1 bg-slate-100 border border-slate-200 rounded-xl hidden xl:flex items-center gap-0.5">
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
                  className={`h-full px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    quickDatePreset === p.id ? 'bg-[#F45A0A] text-white font-black shadow-2xs' : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  {isAr ? p.labelAr : p.labelEn}
                </button>
              ))}
            </div>

            {/* From Date with Label */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-slate-700 shrink-0 select-none">{isAr ? 'من:' : 'From:'}</span>
              <div className="w-[240px]">
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

            {/* To Date with Label */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-slate-700 shrink-0 select-none">{isAr ? 'إلى:' : 'To:'}</span>
              <div className="w-[240px]">
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

          {/* Currency Segmented Control (Signature Orange Active) */}
          <div className="flex items-center gap-2">
            <CurrencySegmentedControl
              value={selectedCurrency}
              onChange={(val) => setSelectedCurrency(val)}
              showAllOption={true}
              showLabel={false}
              height="h-[38px]"
            />

            {/* Cashbox Filter */}
            {cashboxOptions.length > 0 && (
              <Menu shadow="md" width={200} position="bottom-start" radius="12px">
                <Menu.Target>
                  <button
                    type="button"
                    aria-label={isAr ? 'تصفية حسب الصندوق أو البنك' : 'Filter by cashbox or bank'}
                    className="h-[38px] px-3 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Wallet size={14} className="text-[#F45A0A]" />
                    <span className="max-w-[100px] truncate">
                      {selectedCashboxFilter === 'ALL' ? (isAr ? 'كافة الصناديق' : 'All Cashboxes') : selectedCashboxFilter}
                    </span>
                    <ChevronDown size={12} className="text-slate-400" />
                  </button>
                </Menu.Target>
                <Menu.Dropdown className="p-1 font-sans text-xs">
                  <Menu.Item
                    onClick={() => setSelectedCashboxFilter('ALL')}
                    className={`font-bold rounded-lg ${selectedCashboxFilter === 'ALL' ? 'bg-orange-50 text-[#F45A0A]' : 'text-slate-700'}`}
                  >
                    {isAr ? 'كافة الصناديق والبنوك' : 'All Cashboxes & Banks'}
                  </Menu.Item>
                  <Menu.Divider />
                  {cashboxOptions.map((cName) => (
                    <Menu.Item
                      key={cName}
                      onClick={() => setSelectedCashboxFilter(cName)}
                      className={`font-bold rounded-lg ${selectedCashboxFilter === cName ? 'bg-orange-50 text-[#F45A0A]' : 'text-slate-700'}`}
                    >
                      {cName}
                    </Menu.Item>
                  ))}
                </Menu.Dropdown>
              </Menu>
            )}

            {/* Reset Filters */}
            {(searchQuery || selectedCurrency !== 'ALL' || selectedCashboxFilter !== 'ALL' || startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCurrency('ALL');
                  setSelectedCashboxFilter('ALL');
                  setStartDate(null);
                  setEndDate(null);
                  setQuickDatePreset('ALL');
                }}
                className="h-[38px] px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs flex items-center gap-1 cursor-pointer transition-all"
                title={isAr ? 'مسح الفلاتر' : 'Clear Filters'}
              >
                <FilterX size={14} />
                <span className="hidden sm:inline">{isAr ? 'مسح' : 'Clear'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 3. Main Vouchers Table ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">

        {/* Bulk Actions Toolbar — fixed height with spacing */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-[#FFF3E8] border-b border-orange-200">
            <CheckSquare size={15} className="text-[#F45A0A]" />
            <span className="text-xs font-bold text-[#F45A0A]">
              {isAr ? `تم تحديد ${selectedIds.size} سند` : `${selectedIds.size} selected`}
            </span>
            <div className="flex items-center gap-1.5 ms-auto">
              <Menu shadow="md" width={180} position="bottom-end" withArrow>
                <Menu.Target>
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-lg bg-[#F45A0A] text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer hover:bg-[#DD4F05] transition-colors shadow-xs"
                  >
                    <span>{isAr ? 'إجراءات' : 'Actions'}</span>
                    <ChevronDown size={12} />
                  </button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item
                    leftSection={<Eye size={14} />}
                    onClick={() => {
                      const first = currentGridData.find((r: any) => selectedIds.has(r.id));
                      if (first) { setSelectedVoucher(first); setDrawerOpen(true); }
                    }}
                  >
                    {isAr ? 'معاينة السند' : 'View Voucher'}
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<Printer size={14} />}
                    onClick={() => {
                      const first = currentGridData.find((r: any) => selectedIds.has(r.id));
                      if (first) {
                        setVoucherToPrint({
                          voucherNumber: first.voucherNumber, type: first.type, date: first.date,
                          amount: first.amount, currency: first.currency, accountName: first.accountName,
                          accountCode: first.accountCode, cashboxName: first.cashboxName,
                          reference: first.reference, description: first.description, user: first.userName,
                          splitAccounts: first.splitAccounts, splitDescription: first.splitDescription,
                          customCategory: first.customCategory,
                        });
                        setPrintModalOpen(true);
                      }
                    }}
                  >
                    {isAr ? 'طباعة' : 'Print'}
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<Edit size={14} />}
                    onClick={() => {
                      const first = currentGridData.find((r: any) => selectedIds.has(r.id));
                      if (first) handleOpenEditModal(first);
                    }}
                  >
                    {isAr ? 'تعديل' : 'Edit'}
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item
                    color="red"
                    leftSection={<Trash2 size={14} />}
                    onClick={() => {
                      const first = currentGridData.find((r: any) => selectedIds.has(r.id));
                      if (first) { setVoucherToDelete(first); setDeleteConfirmOpen(true); }
                    }}
                  >
                    {isAr ? 'حذف' : 'Delete'}
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-slate-800 cursor-pointer transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        <div className="w-full overflow-auto h-[58vh] min-h-[380px] overscroll-contain">
          <table className="w-full text-xs text-start border-collapse font-sans whitespace-nowrap min-w-full border border-slate-200">
            <thead className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-[#F1F5F9] [&_th]:border-b-2 [&_th]:border-slate-300 [&_th]:border-e [&_th]:border-slate-200 [&_th]:text-slate-800 [&_th]:font-extrabold [&_th]:text-[11px] shadow-2xs">
              <tr className="h-[44px]">
                {/* 1. Toggle Selection Header */}
                <th className="py-2.5 px-3 text-center w-12 bg-[#F1F5F9]">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    aria-label={isAr ? 'تحديد كافة السندات' : 'Select All'}
                    className={`relative inline-flex h-[19px] w-[34px] shrink-0 items-center rounded-full transition-colors duration-200 cursor-pointer p-[2px] ${
                      currentGridData.length > 0 && selectedIds.size === currentGridData.length
                        ? 'bg-[#F45A0A]'
                        : 'bg-slate-300 hover:bg-slate-400'
                    }`}
                  >
                    <span
                      className="inline-block h-[15px] w-[15px] rounded-full bg-white shadow-xs transition-transform duration-200 ease-in-out pointer-events-none"
                      style={{
                        transform: (currentGridData.length > 0 && selectedIds.size === currentGridData.length)
                          ? (isAr ? 'translateX(-15px)' : 'translateX(15px)')
                          : 'translateX(0px)',
                      }}
                    />
                  </button>
                </th>

                {/* 2. Sequence # */}
                <th className="py-2.5 px-2 text-center w-9 font-mono text-slate-500">#</th>

                {/* 3. Type */}
                <th className="py-2.5 px-3 text-center w-24">{isAr ? 'نوع السند' : 'Type'}</th>

                {/* 4. Voucher Number */}
                <th className="py-2.5 px-3 text-start w-40">{isAr ? 'رقم السند' : 'Voucher No'}</th>

                {/* 5. Date */}
                <th className="py-2.5 px-3 text-center w-28 font-mono">{isAr ? 'التاريخ' : 'Date'}</th>

                {/* 6. Beneficiary / Counter Account */}
                <th className="py-2.5 px-3 text-start min-w-[170px]">
                  {activeTab === 'RECEIPT'
                    ? (isAr ? 'المستلم منه (الطرف الدائن)' : 'Received From (Credit)')
                    : activeTab === 'PAYMENT'
                    ? (isAr ? 'المدفوع له (الطرف المدين)' : 'Paid To (Debit)')
                    : (isAr ? 'الحساب المقابل / الدائن' : 'Counter / Credit Account')}
                </th>

                {/* 7. Cashbox / Financial Account */}
                <th className="py-2.5 px-3 text-start min-w-[150px]">
                  {activeTab === 'RECEIPT'
                    ? (isAr ? 'صندوق القبض (المدين)' : 'Debit Cashbox')
                    : activeTab === 'PAYMENT'
                    ? (isAr ? 'صندوق الصرف (الدائن)' : 'Credit Cashbox')
                    : (isAr ? 'الصندوق / الحساب المالي' : 'Financial Account')}
                </th>

                {/* 8. Custom Allocation Account (حساب التقسيم المخصص مثل فلاي) */}
                <th className="py-2.5 px-3 text-start min-w-[130px]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#F45A0A]"></span>
                    <span className="font-extrabold text-slate-900">
                      {customVoucherAccounts[0]?.nameAr || (isAr ? 'حساب التقسيم' : 'Split Account')}
                    </span>
                  </div>
                </th>

                {/* 9. Description */}
                <th className="py-2.5 px-3 text-start min-w-[220px]">{isAr ? 'البيان والشرح' : 'Description'}</th>

                {/* 10. Amount */}
                <th className="py-2.5 px-3 text-end w-32 font-mono">{isAr ? 'المبلغ' : 'Amount'}</th>

                {/* 11. Currency */}
                <th className="py-2.5 px-2.5 text-center w-16">{isAr ? 'العملة' : 'Curr.'}</th>

                {/* 12. Status */}
                <th className="py-2.5 px-3 text-center w-20">{isAr ? 'الحالة' : 'Status'}</th>

                {/* 13. Created By */}
                <th className="py-2.5 px-3 text-start w-28">{isAr ? 'المنشئ' : 'Created By'}</th>

                {/* 14. Actions */}
                <th className="py-2.5 px-3 text-center w-28">{isAr ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>

            <tbody className="[&_td]:border-b [&_td]:border-slate-200/90 [&_td]:border-e [&_td]:border-slate-200/80">
              {loading ? (
                <tr>
                  <td colSpan={14} className="py-20 text-center text-slate-500 font-bold bg-white">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <RefreshCw size={26} className="animate-spin text-[#F45A0A]" />
                      <span className="text-sm font-bold text-slate-700">{isAr ? 'جارٍ تحميل السندات المالية...' : 'Loading Vouchers...'}</span>
                    </div>
                  </td>
                </tr>
              ) : currentGridData.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-20 text-center text-slate-500 font-bold bg-white">
                    <div className="flex flex-col items-center justify-center gap-2.5">
                      <div className="w-14 h-14 rounded-2xl bg-orange-50 text-[#F45A0A] flex items-center justify-center border border-orange-100 shadow-2xs">
                        <Receipt size={28} />
                      </div>
                      <span className="text-sm font-black text-slate-800">
                        {isAr ? 'لا توجد سندات مطابقة للبحث' : 'No vouchers found matching criteria'}
                      </span>
                      <span className="text-xs text-slate-400 font-medium max-w-sm">
                        {isAr ? 'أنشئ سنداً جديداً أو عدّل خيارات التاريخ والصناديق أعلاه' : 'Create a new voucher or adjust the filter parameters'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                currentGridData.map((row, idx) => {
                  const isRowSelected = selectedIds.has(row.id);
                  const isReceipt = row.type === 'RECEIPT';
                  const isPayment = row.type === 'PAYMENT';
                  const isJournal = row.type === 'JOURNAL';
                  const primaryCustomAcc = customVoucherAccounts[0];

                  return (
                    <tr
                      key={row.id}
                      onClick={() => {
                        setSelectedVoucher(row);
                        setDrawerOpen(true);
                      }}
                      className={`h-[48px] transition-colors cursor-pointer group ${
                        isRowSelected
                          ? 'bg-[#FFF3E8] border-s-4 border-s-[#F45A0A]'
                          : `${idx % 2 === 0 ? 'bg-white' : 'bg-[#F9FAFB]'} hover:bg-orange-50/30`
                      }`}
                    >
                      {/* 1. Toggle Selection */}
                      <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => toggleSelect(row.id)}
                          aria-label={isAr ? `تحديد السند ${row.voucherNumber}` : `Select voucher ${row.voucherNumber}`}
                          className={`relative inline-flex h-[19px] w-[34px] shrink-0 items-center rounded-full transition-colors duration-200 cursor-pointer p-[2px] ${
                            isRowSelected
                              ? 'bg-[#F45A0A]'
                              : 'bg-slate-300 hover:bg-slate-400'
                          }`}
                        >
                          <span
                            className="inline-block h-[15px] w-[15px] rounded-full bg-white shadow-xs transition-transform duration-200 ease-in-out pointer-events-none"
                            style={{
                              transform: isRowSelected
                                ? (isAr ? 'translateX(-15px)' : 'translateX(15px)')
                                : 'translateX(0px)',
                            }}
                          />
                        </button>
                      </td>

                      {/* 2. Sequence */}
                      <td className="py-2 px-2 text-center font-mono text-slate-400 text-[11px] tabular-nums lining-nums font-bold">
                        {idx + 1}
                      </td>

                      {/* 3. Type Badge */}
                      <td className="py-2 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px] font-black tracking-tight ${
                            isReceipt
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                              : isPayment
                              ? 'bg-rose-50 text-rose-700 border border-rose-200/80'
                              : isJournal
                              ? 'bg-amber-50 text-amber-700 border border-amber-200/80'
                              : 'bg-sky-50 text-sky-700 border border-sky-200/80'
                          }`}
                        >
                          {isReceipt && <ArrowDownLeft size={12} className="shrink-0 text-emerald-600" />}
                          {isPayment && <ArrowUpRight size={12} className="shrink-0 text-rose-600" />}
                          {isJournal && <FileText size={12} className="shrink-0 text-amber-600" />}
                          {!isReceipt && !isPayment && !isJournal && <ArrowLeftRight size={12} className="shrink-0 text-sky-600" />}
                          <span>{row.typeLabel || (isReceipt ? (isAr ? 'سند قبض' : 'Receipt') : isPayment ? (isAr ? 'سند دفع' : 'Payment') : (isAr ? 'سند قيد' : 'Journal'))}</span>
                        </span>
                      </td>

                      {/* 4. Voucher Number & Reference */}
                      <td className="py-2 px-3">
                        <div className="flex flex-col">
                          <span className="font-mono font-black text-slate-900 text-[12px] tabular-nums lining-nums group-hover:text-[#F45A0A] transition-colors">
                            {row.voucherNumber}
                          </span>
                          {row.reference && (
                            <span className="text-[10px] text-slate-400 font-mono tabular-nums truncate max-w-[130px]">
                              {isAr ? 'المرجع:' : 'Ref:'} {row.reference}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 5. Date */}
                      <td className="py-2 px-3 text-center font-mono text-slate-600 text-[11px] font-bold tabular-nums lining-nums">
                        {row.dateFormatted}
                      </td>

                      {/* 6. Beneficiary / Counter Account */}
                      <td className="py-2 px-3 font-bold text-slate-900 truncate max-w-[200px]" title={row.accountName}>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="truncate">{row.accountName}</span>
                          {row.splitAccounts?.length > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-black bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                              {isAr ? 'مقسم' : 'Split'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 7. Cashbox / Financial Account */}
                      <td className="py-2 px-3 truncate max-w-[170px]" title={row.cashboxName}>
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Wallet size={13} className="text-[#F45A0A] shrink-0" />
                          <span className="font-semibold text-slate-800 text-xs truncate">{row.cashboxName}</span>
                        </div>
                      </td>

                      {/* 8. Custom Allocation Account (فلاي / حساب التقسيم) */}
                      <td className="py-2 px-3 text-start">
                        {(() => {
                          const matchedAcc = customVoucherAccounts.find(
                            (ca: any) =>
                              ca.targetAccountId === row.accountId ||
                              row.splitAccounts?.some((s: any) => s.accountId === ca.targetAccountId || s.accountName === ca.nameAr) ||
                              row.customCategory === ca.nameAr ||
                              row.description?.includes(ca.nameAr)
                          );
                          const splitItem = row.splitAccounts?.find(
                            (s: any) => primaryCustomAcc && (s.accountId === primaryCustomAcc.targetAccountId || s.accountName === primaryCustomAcc.nameAr)
                          );

                          if (splitItem && Number(splitItem.amount) > 0) {
                            return (
                              <div className="flex items-center gap-1 font-mono font-black text-slate-900 text-xs tabular-nums">
                                <span className="px-1.5 py-0.5 rounded bg-orange-50 text-[#F45A0A] border border-orange-200 text-[10px] font-sans font-bold">
                                  {primaryCustomAcc?.nameAr}
                                </span>
                                <span>{Number(splitItem.amount).toLocaleString('en-US')}</span>
                              </div>
                            );
                          }
                          if (matchedAcc) {
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-orange-50 text-[#F45A0A] border border-orange-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#F45A0A]"></span>
                                <span>{matchedAcc.nameAr}</span>
                              </span>
                            );
                          }
                          if (row.splitAccounts?.length > 0) {
                            return (
                              <span className="text-slate-700 text-xs font-semibold truncate max-w-[120px] block">
                                {row.splitAccounts.map((s: any) => s.accountName).join(', ')}
                              </span>
                            );
                          }
                          return <span className="text-slate-300 font-mono text-center block">—</span>;
                        })()}
                      </td>

                      {/* 9. Description */}
                      <td className="py-2 px-3 text-slate-600 max-w-[240px] truncate" title={row.description}>
                        <span className="truncate block font-medium text-[11.5px] text-slate-700">
                          {row.description || <span className="text-slate-300">—</span>}
                        </span>
                      </td>

                      {/* 10. Amount */}
                      <td className="py-2 px-3 text-end font-mono font-black tabular-nums lining-nums">
                        <span
                          className={`text-[13px] tracking-tight ${
                            isReceipt
                              ? 'text-emerald-700'
                              : isPayment
                              ? 'text-rose-700'
                              : 'text-slate-950'
                          }`}
                        >
                          {isReceipt && '+'}
                          {isPayment && '-'}
                          {Number(row.amount).toLocaleString('en-US', { minimumFractionDigits: row.currency === 'USD' ? 2 : 0 })}
                        </span>
                      </td>

                      {/* 11. Currency */}
                      <td className="py-2 px-2.5 text-center">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-black ${
                          row.currency === 'USD'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {row.currency === 'USD' ? 'USD' : 'IQD'}
                        </span>
                      </td>

                      {/* 12. Status */}
                      <td className="py-2 px-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={11} className="text-emerald-600 shrink-0" />
                          <span>{isAr ? 'معتمد' : 'Posted'}</span>
                        </span>
                      </td>

                      {/* 13. Created By */}
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <User size={12} className="text-slate-400 shrink-0" />
                          <span className="text-[10.5px] font-medium truncate max-w-[95px]">{row.userName}</span>
                        </div>
                      </td>

                      {/* 14. Action Buttons */}
                      <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          {/* Quick View Button */}
                          <Tooltip label={isAr ? 'معاينة السند' : 'View'} position="top" withArrow>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedVoucher(row);
                                setDrawerOpen(true);
                              }}
                              aria-label={isAr ? 'معاينة السند' : 'View voucher'}
                              className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-200/80 hover:bg-slate-100 text-slate-600 hover:text-[#F45A0A] flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <Eye size={13} />
                            </button>
                          </Tooltip>

                          {/* Quick Print Button */}
                          <Tooltip label={isAr ? 'طباعة السند' : 'Print'} position="top" withArrow>
                            <button
                              type="button"
                              onClick={() => {
                                setVoucherToPrint({
                                  voucherNumber: row.voucherNumber,
                                  type: row.type,
                                  date: row.date,
                                  amount: row.amount,
                                  currency: row.currency,
                                  accountName: row.accountName,
                                  accountCode: row.accountCode,
                                  cashboxName: row.cashboxName,
                                  reference: row.reference,
                                  description: row.description,
                                  user: row.userName,
                                  splitAccounts: row.splitAccounts,
                                  splitDescription: row.splitDescription,
                                  customCategory: row.customCategory,
                                });
                                setPrintModalOpen(true);
                              }}
                              aria-label={isAr ? 'طباعة السند' : 'Print voucher'}
                              className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-200/80 hover:bg-slate-100 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <Printer size={13} />
                            </button>
                          </Tooltip>

                          {/* 3-Dots Dropdown Menu */}
                          <Menu shadow="md" width={160} position="bottom-end" withArrow>
                            <Menu.Target>
                              <button
                                type="button"
                                aria-label={isAr ? 'خيارات إضافية' : 'More options'}
                                className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-200/80 hover:bg-slate-100 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
                              >
                                <MoreVertical size={13} />
                              </button>
                            </Menu.Target>
                            <Menu.Dropdown className="p-1 font-sans text-xs">
                              <Menu.Item
                                leftSection={<Eye size={13} className="text-slate-500" />}
                                onClick={() => {
                                  setSelectedVoucher(row);
                                  setDrawerOpen(true);
                                }}
                                className="font-bold text-slate-800 hover:bg-slate-50 py-1.5"
                              >
                                {isAr ? 'عرض التفاصيل' : 'View Details'}
                              </Menu.Item>
                              <Menu.Item
                                leftSection={<Printer size={13} className="text-slate-500" />}
                                onClick={() => {
                                  setVoucherToPrint({
                                    voucherNumber: row.voucherNumber,
                                    type: row.type,
                                    date: row.date,
                                    amount: row.amount,
                                    currency: row.currency,
                                    accountName: row.accountName,
                                    accountCode: row.accountCode,
                                    cashboxName: row.cashboxName,
                                    reference: row.reference,
                                    description: row.description,
                                    user: row.userName,
                                    splitAccounts: row.splitAccounts,
                                    splitDescription: row.splitDescription,
                                    customCategory: row.customCategory,
                                  });
                                  setPrintModalOpen(true);
                                }}
                                className="font-bold text-slate-800 hover:bg-slate-50 py-1.5"
                              >
                                {isAr ? 'طباعة السند' : 'Print Voucher'}
                              </Menu.Item>
                              <Menu.Item
                                leftSection={<Edit size={13} className="text-blue-600" />}
                                onClick={() => handleOpenEditModal(row)}
                                className="font-bold text-slate-800 hover:bg-blue-50 hover:text-blue-700 py-1.5"
                              >
                                {isAr ? 'تعديل السند' : 'Edit Voucher'}
                              </Menu.Item>
                              <Menu.Divider />
                              <Menu.Item
                                color="red"
                                leftSection={<Trash2 size={13} />}
                                onClick={() => {
                                  setVoucherToDelete(row);
                                  setDeleteConfirmOpen(true);
                                }}
                                className="font-bold py-1.5"
                              >
                                {isAr ? 'حذف السند' : 'Delete Voucher'}
                              </Menu.Item>
                            </Menu.Dropdown>
                          </Menu>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="bg-slate-50/80 border-t border-slate-200 px-4 py-2.5 flex items-center justify-between text-xs font-bold text-slate-700">
          <div className="flex items-center gap-2">
            <span>{isAr ? 'السجلات:' : 'Records:'}</span>
            <span className="font-mono font-black text-slate-950 tabular-nums lining-nums">{currentGridData.length}</span>
          </div>

          <div className="flex items-center gap-4 font-mono font-bold text-slate-800 tabular-nums lining-nums">
            <span>
              IQD{' '}
              <strong className="font-black text-slate-950">
                {currentGridData.filter((x) => x.currency !== 'USD').reduce((sum, x) => sum + Number(x.amount || 0), 0).toLocaleString('en-US')}
              </strong>
            </span>
            <span>
              USD{' '}
              <strong className="font-black text-blue-700">
                {currentGridData.filter((x) => x.currency === 'USD').reduce((sum, x) => sum + Number(x.amount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* ── 4. Enterprise Financial Voucher Form Modal ── */}
      <FinancialVoucherForm
        opened={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setSelectedEditVoucherId(undefined);
        }}
        onSuccess={handleVoucherSaved}
        initialVoucherType={modalInitialType}
        initialVoucherId={selectedEditVoucherId}
      />

      {/* ── 5. Voucher Detail Drawer ── */}
      <Drawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={
          <div className="flex items-center gap-2 font-black text-slate-950 text-sm">
            <Receipt size={17} className="text-[#F45A0A]" />
            <span>{isAr ? 'معاينة تفاصيل السند المالي' : 'Voucher Details'}</span>
          </div>
        }
        position={direction === 'rtl' ? 'left' : 'right'}
        size="lg"
        padding="lg"
      >
        {selectedVoucher && (
          <div className="space-y-4 text-xs font-sans" dir={direction}>
            {/* Header Badge & Number */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center">
              <div>
                <span className="text-[10px] text-slate-500 font-bold block">{isAr ? 'رقم ونوع السند' : 'Voucher No & Type'}</span>
                <div className="text-base font-black text-slate-950 font-mono tabular-nums">
                  {selectedVoucher.voucherNumber}
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-lg text-xs font-black ${
                  selectedVoucher.type === 'RECEIPT'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : selectedVoucher.type === 'PAYMENT'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-orange-50 text-[#F45A0A] border border-orange-200'
                }`}
              >
                {selectedVoucher.typeLabel}
              </span>
            </div>

            {/* Financial Summary Card */}
            <div className="p-4 border border-slate-200 rounded-xl space-y-3 bg-white">
              <div>
                <span className="text-slate-500 block text-[10.5px] font-bold">{isAr ? 'المبلغ والعملة المعتمدة' : 'Adopted Amount & Currency'}</span>
                <div className="font-mono font-black text-xl tabular-nums text-slate-950 mt-0.5">
                  {Number(selectedVoucher.amount).toLocaleString('en-US', { minimumFractionDigits: selectedVoucher.currency === 'USD' ? 2 : 0 })}{' '}
                  <span className="text-xs text-slate-500">{selectedVoucher.currency === 'USD' ? '$' : isAr ? 'د.ع' : 'IQD'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-slate-500 block text-[10px] font-bold">{isAr ? 'تاريخ السند' : 'Date'}</span>
                  <span className="font-mono font-bold text-slate-900">{selectedVoucher.dateFormatted}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-bold">{isAr ? 'المستخدم المنشئ' : 'Created By'}</span>
                  <span className="font-bold text-slate-900">{selectedVoucher.userName}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <span className="text-slate-500 block text-[10px] font-bold">
                  {selectedVoucher.type === 'JOURNAL' ? (isAr ? 'حساب الطرف المدين' : 'Debit Account') : (isAr ? 'الصندوق / الحساب المالي' : 'Cashbox / Bank Account')}
                </span>
                <span className="font-bold text-slate-900">{selectedVoucher.cashboxName}</span>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <span className="text-slate-500 block text-[10px] font-bold">
                  {selectedVoucher.type === 'JOURNAL' ? (isAr ? 'حساب الطرف الدائن' : 'Credit Account') : (isAr ? 'الحساب المقابل (الطرف الثاني)' : 'Counter Party Account')}
                </span>
                <span className="font-bold text-slate-900">{selectedVoucher.accountName || '—'}</span>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <span className="text-slate-500 block text-[10px] font-bold mb-1">{isAr ? 'البيان والشرح المحاسبي' : 'Description'}</span>
                <p className="text-slate-800 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs font-medium">
                  {selectedVoucher.description || (isAr ? 'لا يوجد شرح إضافي' : 'No description')}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              {selectedVoucher.type !== 'JOURNAL' && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSlipVoucher(selectedVoucher);
                    setSlipModalOpen(true);
                  }}
                  className="flex-1 h-[38px] rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Paperclip size={14} className="text-blue-600" />
                  <span>{isAr ? 'معاينة الوصولات' : 'View Slips'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (!selectedVoucher) return;
                  setVoucherToPrint({
                    voucherNumber: selectedVoucher.voucherNumber,
                    type: selectedVoucher.type,
                    date: selectedVoucher.date,
                    amount: selectedVoucher.amount,
                    currency: selectedVoucher.currency,
                    accountName: selectedVoucher.accountName,
                    accountCode: selectedVoucher.accountCode,
                    cashboxName: selectedVoucher.cashboxName,
                    reference: selectedVoucher.reference,
                    description: selectedVoucher.description,
                    user: selectedVoucher.userName,
                    splitAccounts: selectedVoucher.splitAccounts,
                    splitDescription: selectedVoucher.splitDescription,
                    customCategory: selectedVoucher.customCategory,
                  });
                  setPrintModalOpen(true);
                }}
                className="flex-1 h-[38px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <Printer size={14} className="text-orange-400" />
                <span>{isAr ? 'معاينة وطباعة السند' : 'Print Voucher'}</span>
              </button>
            </div>
          </div>
        )}
      </Drawer>

      {/* ── 6. Slip Preview Modal ── */}
      <Modal
        opened={slipModalOpen}
        onClose={() => setSlipModalOpen(false)}
        title={
          <div className="flex items-center gap-2 font-black text-sm text-slate-950">
            <Paperclip size={16} className="text-blue-600" />
            <span>{isAr ? `معاينة وصولات التسديد — سند [${selectedSlipVoucher?.voucherNumber}]` : `Payment Slips — Voucher [${selectedSlipVoucher?.voucherNumber}]`}</span>
          </div>
        }
        size="lg"
        centered
        radius="16px"
      >
        <div className="space-y-3.5 text-xs font-sans" dir={direction}>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center">
            <div>
              <span className="text-slate-500 block text-[10px] font-bold">{isAr ? 'الحساب والمبلغ' : 'Account & Amount'}</span>
              <span className="font-bold text-slate-950 font-mono">
                {selectedSlipVoucher?.accountName} ({Number(selectedSlipVoucher?.amount || 0).toLocaleString()} {selectedSlipVoucher?.currency})
              </span>
            </div>
            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-slate-800 border border-slate-200">
              {isAr ? 'الصندوق:' : 'Method:'} {selectedSlipVoucher?.cashboxName}
            </span>
          </div>

          <div className="border border-slate-200 rounded-xl p-8 bg-slate-50 flex flex-col items-center justify-center text-center space-y-2.5 min-h-[200px]">
            <Paperclip size={40} className="text-blue-500 opacity-60" />
            <span className="font-black text-slate-800 text-sm">
              {isAr ? 'وصول وإشعار الدفع الإلكتروني' : 'Electronic Payment Slip'}
            </span>
            <p className="text-slate-500 text-xs max-w-sm font-medium leading-relaxed">
              {isAr ? 'تم إرفاق إشعار التسديد مع هذا السند المحاسبي بنجاح ومزامنته في سجل السندات.' : 'Payment confirmation receipt is attached and synced with this voucher.'}
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setSlipModalOpen(false)}
              className="h-[36px] px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              {isAr ? 'إغلاق' : 'Close'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── 7. Delete Confirmation Modal ── */}
      <Modal
        opened={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title={
          <div className="flex items-center gap-2 font-black text-sm text-rose-600">
            <AlertTriangle size={18} />
            <span>{isAr ? 'تأكيد حذف السند المالي' : 'Confirm Voucher Deletion'}</span>
          </div>
        }
        size="md"
        centered
        radius="16px"
      >
        <div className="space-y-3.5 text-xs font-sans" dir={direction}>
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-950 space-y-1">
            <p className="font-bold text-rose-900">{isAr ? 'هل أنت متأكد من رغبتك في حذف هذا السند نهائياً؟' : 'Are you sure you want to permanently delete this voucher?'}</p>
            <p className="text-[11px] text-rose-700 font-medium">
              {isAr ? 'سيتم حذف السند وإلغاء القيد المحاسبي المرتبط به بالكامل وتحديث أرصدة الحسابات المتأثرة.' : 'The voucher and associated journal entry will be permanently reversed and account balances updated.'}
            </p>
          </div>

          {voucherToDelete && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">{isAr ? 'رقم ونوع السند:' : 'Voucher:'}</span>
                <span className="font-mono font-black text-slate-950">
                  {voucherToDelete.voucherNumber} ({voucherToDelete.typeLabel})
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">{isAr ? 'المبلغ:' : 'Amount:'}</span>
                <span className="font-mono font-black text-slate-950">
                  {Number(voucherToDelete.amount).toLocaleString()} {voucherToDelete.currency === 'USD' ? '$' : isAr ? 'د.ع' : 'IQD'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">{isAr ? 'الطرف المقابل:' : 'Party:'}</span>
                <span className="font-bold text-slate-800">{voucherToDelete.accountName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">{isAr ? 'الصندوق / البنك:' : 'Cashbox:'}</span>
                <span className="font-bold text-slate-800">{voucherToDelete.cashboxName}</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={deleting}
              className="h-[36px] px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleDeleteVoucher}
              disabled={deleting}
              className="h-[36px] px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            >
              <Trash2 size={14} />
              <span>{deleting ? (isAr ? 'جاري الحذف...' : 'Deleting...') : (isAr ? 'تأكيد الحذف النهائي' : 'Confirm Delete')}</span>
            </button>
          </div>
        </div>
      </Modal>
      {/* ── 8. Modern Voucher Print & Export Modal ── */}
      <VoucherPrintModal
        opened={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        voucher={voucherToPrint}
      />
    </div>
  );
};

export default VouchersPage;
