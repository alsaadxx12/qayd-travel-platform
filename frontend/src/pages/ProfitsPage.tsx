import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Modal, Menu } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import {
  Banknote,
  ReceiptText,
  RotateCcw,
  TrendingUp,
  RefreshCw,
  FileSpreadsheet,
  Building,
  UserCheck,
  UsersRound,
  FileText,
  ArrowRight,
  BarChart3,
  Scale,
  Sparkles,
  Layers,
  Check,
  Coins,
  ChevronDown
} from 'lucide-react';
import { ticketsApi } from '../api/tickets';
import { accountsApi } from '../api/accounts';
import { branchesApi, type Branch } from '../api/branches';
import { partnersApi } from '../api/partners';
import { apiRequest } from '../api/client';
import { CurrencySegmentedControl } from '../components/ui/CurrencySegmentedControl';
import { showSuccessNotification, showErrorNotification } from '../utils/notifications';
import { useLanguageStore } from '../store/useLanguageStore';

// ─── Financial Single Source-of-Truth ViewModel ───
interface FinancialViewModel {
  grossRevenueIQD: number;
  grossRevenueUSD: number;
  salesReturnsIQD: number;
  salesReturnsUSD: number;
  refundServiceRevenueIQD: number;
  refundServiceRevenueUSD: number;
  netOperatingRevenueIQD: number;
  netOperatingRevenueUSD: number;
  grossDirectCostIQD: number;
  grossDirectCostUSD: number;
  purchaseReturnsIQD: number;
  purchaseReturnsUSD: number;
  netDirectCostIQD: number;
  netDirectCostUSD: number;
  grossProfitIQD: number;
  grossProfitUSD: number;
  operatingExpensesIQD: number;
  operatingExpensesUSD: number;
  netProfitIQD: number;
  netProfitUSD: number;
  profitMarginIQD: number;
  profitMarginUSD: number;
  breakdown: Record<string, {
    titleAr: string;
    titleEn: string;
    count: number;
    salesIQD: number;
    costIQD: number;
    profitIQD: number;
    salesUSD: number;
    costUSD: number;
    profitUSD: number;
  }>;
}

export const ProfitsPage: React.FC = () => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';
  const navigate = useNavigate();

  // Filters State
  const [currency, setCurrency] = useState<'IQD' | 'USD' | 'ALL'>('ALL');
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => {
    return localStorage.getItem('active_branch_id') || 'ALL';
  });
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>('ALL');
  const [quickPreset, setQuickPreset] = useState<string>('YEAR');
  const [startDate, setStartDate] = useState<Date | null>(() => {
    const y = new Date().getFullYear();
    return new Date(y, 0, 1);
  });
  const [endDate, setEndDate] = useState<Date | null>(() => new Date());

  // Visual Aggregation
  const [chartAggregation, setChartAggregation] = useState<'daily' | 'monthly' | 'yearly'>('monthly');
  const [partiesSubTab, setPartiesSubTab] = useState<'customers' | 'suppliers'>('customers');

  // Real Database States
  const [loading, setLoading] = useState<boolean>(true);
  const [rawTickets, setRawTickets] = useState<any[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [expenseTransactions, setExpenseTransactions] = useState<any[]>([]);

  // Partners Profit Distribution Modal
  const [distributeModalOpen, setDistributeModalOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<string>('');
  const [distributeAmountIQD, setDistributeAmountIQD] = useState<number>(0);
  const [distributeAmountUSD, setDistributeAmountUSD] = useState<number>(0);
  const [distributeNotes, setDistributeNotes] = useState<string>('');
  const [isDistributing, setIsDistributing] = useState(false);

  const selectedBranchName =
    selectedBranchId === 'ALL'
      ? (isAr ? 'جميع الفروع' : 'All Branches')
      : (branches.find((b) => b.id === selectedBranchId)?.nameAr || (isAr ? 'الفرع المحدد' : 'Selected Branch'));

  // ─── Fetch All Business Data from Real Database ───
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [ticketsRes, branchesRes, accountsRes, custRes, suppRes, vouchersRes] = await Promise.all([
        ticketsApi.getAll().catch(() => []),
        branchesApi.getAll().catch(() => []),
        accountsApi.getFlat().catch(() => []),
        partnersApi.getCustomers().catch(() => []),
        partnersApi.getSuppliers().catch(() => []),
        apiRequest('/api/vouchers').catch(() => []),
      ]);

      const tList = Array.isArray(ticketsRes) ? ticketsRes : (ticketsRes as any)?.data || [];
      const bList = Array.isArray(branchesRes) ? branchesRes : [];
      const aList = Array.isArray(accountsRes) ? accountsRes : (accountsRes as any)?.data || [];
      const cList = Array.isArray(custRes) ? custRes : [];
      const sList = Array.isArray(suppRes) ? suppRes : [];
      const vList = Array.isArray(vouchersRes) ? vouchersRes : (vouchersRes as any)?.data || [];

      setRawTickets(tList);
      setBranches(bList);
      setAccounts(aList);
      setPartners([...cList, ...sList]);

      // Extract Payment / Expense Vouchers
      const expenses = vList
        .filter((v: any) => v.type === 'PAYMENT' || v.category === 'EXPENSE' || v.voucherType === 'PAYMENT')
        .map((v: any) => ({
          id: v.id || v.voucherNumber,
          date: v.date || v.createdAt,
          ref: v.voucherNumber || v.number || v.id,
          accountName: v.partnerName || v.expenseAccountName || v.accountName || (isAr ? 'مصروف عام' : 'Expense'),
          accountCode: v.accountCode || '32',
          description: v.notes || v.description || (isAr ? 'سند صرف مصروفات' : 'Payment voucher'),
          amountIQD: (v.currency || 'IQD').toUpperCase().includes('IQD') ? Number(v.amount || v.total || 0) : 0,
          amountUSD: (v.currency || '').toUpperCase().includes('USD') || (v.currency || '').includes('$') ? Number(v.amount || v.total || 0) : 0,
        }));
      setExpenseTransactions(expenses);
    } catch (err) {
      console.error('Failed to load profitability data:', err);
    } finally {
      setLoading(false);
    }
  }, [isAr]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Quick Preset Change
  const handleQuickPresetChange = (preset: string) => {
    setQuickPreset(preset);
    const now = new Date();
    const y = now.getFullYear();

    if (preset === 'YEAR') {
      setStartDate(new Date(y, 0, 1));
      setEndDate(new Date(y, 11, 31, 23, 59, 59));
    } else if (preset === 'MONTH') {
      setStartDate(new Date(y, now.getMonth(), 1));
      setEndDate(new Date(y, now.getMonth() + 1, 0, 23, 59, 59));
    } else if (preset === 'TODAY') {
      setStartDate(new Date(y, now.getMonth(), now.getDate()));
      setEndDate(new Date(y, now.getMonth(), now.getDate(), 23, 59, 59));
    } else if (preset === 'ALL') {
      setStartDate(null);
      setEndDate(null);
    }
  };

  const handleResetFilters = () => {
    setQuickPreset('YEAR');
    handleQuickPresetChange('YEAR');
    setCurrency('ALL');
    setSelectedBranchId('ALL');
    setServiceTypeFilter('ALL');
  };

  // Customer Name Resolver
  const resolveCustomerName = useCallback((t: any): string => {
    const raw = t.customerName;
    const isUUID = raw && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);
    
    if (raw && !isUUID && raw.trim() !== '') {
      return raw;
    }
    
    const targetId = raw || t.customerId || t.customerAccountId;
    if (targetId) {
      const acc = accounts.find((a) => a.id === targetId || a.code === targetId);
      if (acc && acc.nameAr) return acc.nameAr;
      const part = partners.find((p) => p.id === targetId || p.accountId === targetId);
      if (part && (part.nameAr || part.name || part.companyName)) return part.nameAr || part.name || part.companyName;
    }

    return isAr ? 'عميل غير معرّف' : 'Unidentified Customer';
  }, [accounts, partners, isAr]);

  // Filtered Tickets by Date & Branch & Service
  const dateFilteredTickets = useMemo(() => {
    return rawTickets.filter((t: any) => {
      if (selectedBranchId !== 'ALL' && t.branchId && t.branchId !== selectedBranchId) {
        return false;
      }
      if (startDate || endDate) {
        const tDate = new Date(t.issueDate || t.createdAt || t.date);
        if (startDate && tDate < startDate) return false;
        if (endDate && tDate > new Date(endDate.getTime() + 86400000)) return false;
      }
      if (serviceTypeFilter !== 'ALL') {
        const rawType = ((t as any).serviceType || (t as any).flightType || t.tripType || '').toUpperCase();
        if (serviceTypeFilter === 'REFUNDS' && !rawType.includes('REFUND') && t.status !== 'REFUNDED' && !String(t.invoiceNumber || '').startsWith('REF-')) return false;
        if (serviceTypeFilter === 'VISAS' && !rawType.includes('VISA') && !t.airline?.includes('VISA')) return false;
        if (serviceTypeFilter === 'TICKETS' && (rawType.includes('REFUND') || rawType.includes('VISA') || t.status === 'REFUNDED' || String(t.invoiceNumber || '').startsWith('REF-'))) return false;
      }
      return true;
    });
  }, [rawTickets, selectedBranchId, startDate, endDate, serviceTypeFilter]);

  // ─── SINGLE SOURCE OF TRUTH: FINANCIAL VIEW MODEL ───
  const vm = useMemo<FinancialViewModel>(() => {
    let salesIQD = 0;
    let salesUSD = 0;
    let costIQD = 0;
    let costUSD = 0;

    let refundsSalesIQD = 0;
    let refundsSalesUSD = 0;
    let refundsCostIQD = 0;
    let refundsCostUSD = 0;
    let refundsProfitIQD = 0;
    let refundsProfitUSD = 0;

    const breakdown: FinancialViewModel['breakdown'] = {
      FLIGHT_TICKETS: { titleAr: 'تذاكر الطيران', titleEn: 'Flight Tickets', count: 0, salesIQD: 0, costIQD: 0, profitIQD: 0, salesUSD: 0, costUSD: 0, profitUSD: 0 },
      VISAS: { titleAr: 'الفيزا والتأشيرات', titleEn: 'Visas & Permits', count: 0, salesIQD: 0, costIQD: 0, profitIQD: 0, salesUSD: 0, costUSD: 0, profitUSD: 0 },
      HOTELS: { titleAr: 'حجوزات الفنادق والإقامة', titleEn: 'Hotels', count: 0, salesIQD: 0, costIQD: 0, profitIQD: 0, salesUSD: 0, costUSD: 0, profitUSD: 0 },
      GROUPS: { titleAr: 'البرامج السياحية والكروبات', titleEn: 'Group Tours', count: 0, salesIQD: 0, costIQD: 0, profitIQD: 0, salesUSD: 0, costUSD: 0, profitUSD: 0 },
      REISSUES: { titleAr: 'تغيير وتعديل التذاكر', titleEn: 'Reissues', count: 0, salesIQD: 0, costIQD: 0, profitIQD: 0, salesUSD: 0, costUSD: 0, profitUSD: 0 },
      REFUNDS: { titleAr: 'استرجاع التذاكر والعمولات', titleEn: 'Refunds', count: 0, salesIQD: 0, costIQD: 0, profitIQD: 0, salesUSD: 0, costUSD: 0, profitUSD: 0 },
      OTHER: { titleAr: 'خدمات سياحية أخرى', titleEn: 'Other Services', count: 0, salesIQD: 0, costIQD: 0, profitIQD: 0, salesUSD: 0, costUSD: 0, profitUSD: 0 },
    };

    dateFilteredTickets.forEach((t: any) => {
      const isUSD = (t.currency || '').toUpperCase().includes('USD') || (t.currency || '').includes('$');
      const isRef = t.tripType === 'REFUND' || t.status === 'REFUNDED' || String(t.invoiceNumber || '').startsWith('REF-');
      const rawType = ((t as any).serviceType || (t as any).flightType || t.tripType || t.airline || '').toUpperCase();

      const sell = Math.abs(Number(t.totalSell || t.totals?.totalSell || t.netSell || 0));
      const buy = Math.abs(Number(t.totalBuy || t.totals?.totalBuy || t.netBuy || 0));
      const prf = Number(t.profit !== undefined && t.profit !== null ? t.profit : (sell - buy));

      if (isRef) {
        const airlinePenalty =
          t.passengers && t.passengers.some((p: any) => p.tax1 && p.tax1 > 0)
            ? t.passengers.reduce((sum: number, p: any) => sum + (p.tax1 || 0), 0)
            : Number(t.tax1 || 0);

        const agencyRetention = Number(t.profit !== undefined && t.profit !== null ? t.profit : prf);

        const netRefundCustomer = sell > 0 && (airlinePenalty > 0 || agencyRetention > 0)
          ? Math.max(0, sell - airlinePenalty - agencyRetention)
          : sell;

        const netRefundSupplier = buy > 0 && airlinePenalty > 0
          ? Math.max(0, buy - airlinePenalty)
          : buy;

        if (isUSD) {
          refundsSalesUSD += netRefundCustomer;
          refundsCostUSD += netRefundSupplier;
          refundsProfitUSD += agencyRetention;
        } else {
          refundsSalesIQD += netRefundCustomer;
          refundsCostIQD += netRefundSupplier;
          refundsProfitIQD += agencyRetention;
        }
      } else {
        if (isUSD) {
          salesUSD += sell;
          costUSD += buy;
        } else {
          salesIQD += sell;
          costIQD += buy;
        }
      }

      let key = 'FLIGHT_TICKETS';
      if (isRef || rawType.includes('REFUND') || rawType.includes('استرجاع')) key = 'REFUNDS';
      else if (rawType.includes('VISA') || rawType.includes('فيزا') || String(t.invoiceNumber || '').startsWith('VISA-')) key = 'VISAS';
      else if (rawType.includes('HOTEL') || rawType.includes('فندق')) key = 'HOTELS';
      else if (rawType.includes('GROUP') || rawType.includes('كروب')) key = 'GROUPS';
      else if (rawType.includes('REISSUE') || rawType.includes('تعديل')) key = 'REISSUES';
      else if ((t as any).serviceType === 'OTHER') key = 'OTHER';

      const cat = breakdown[key] || breakdown['FLIGHT_TICKETS'];
      cat.count++;
      if (isUSD) {
        cat.salesUSD += sell;
        cat.costUSD += buy;
        cat.profitUSD += prf;
      } else {
        cat.salesIQD += sell;
        cat.costIQD += buy;
        cat.profitIQD += prf;
      }
    });

    let operatingExpensesIQD = 0;
    let operatingExpensesUSD = 0;
    expenseTransactions.forEach((e) => {
      operatingExpensesIQD += e.amountIQD;
      operatingExpensesUSD += e.amountUSD;
    });

    const netOperatingRevenueIQD = salesIQD - refundsSalesIQD + refundsProfitIQD;
    const netOperatingRevenueUSD = salesUSD - refundsSalesUSD + refundsProfitUSD;

    const netDirectCostIQD = costIQD - refundsCostIQD;
    const netDirectCostUSD = costUSD - refundsCostUSD;

    const grossProfitIQD = netOperatingRevenueIQD - netDirectCostIQD;
    const grossProfitUSD = netOperatingRevenueUSD - netDirectCostUSD;

    const netProfitIQD = grossProfitIQD - operatingExpensesIQD;
    const netProfitUSD = grossProfitUSD - operatingExpensesUSD;

    const profitMarginIQD = netOperatingRevenueIQD > 0 ? (grossProfitIQD / netOperatingRevenueIQD) * 100 : 0;
    const profitMarginUSD = netOperatingRevenueUSD > 0 ? (grossProfitUSD / netOperatingRevenueUSD) * 100 : 0;

    return {
      grossRevenueIQD: salesIQD,
      grossRevenueUSD: salesUSD,
      salesReturnsIQD: refundsSalesIQD,
      salesReturnsUSD: refundsSalesUSD,
      refundServiceRevenueIQD: refundsProfitIQD,
      refundServiceRevenueUSD: refundsProfitUSD,
      netOperatingRevenueIQD,
      netOperatingRevenueUSD,
      grossDirectCostIQD: costIQD,
      grossDirectCostUSD: costUSD,
      purchaseReturnsIQD: refundsCostIQD,
      purchaseReturnsUSD: refundsCostUSD,
      netDirectCostIQD,
      netDirectCostUSD,
      grossProfitIQD,
      grossProfitUSD,
      operatingExpensesIQD,
      operatingExpensesUSD,
      netProfitIQD,
      netProfitUSD,
      profitMarginIQD,
      profitMarginUSD,
      breakdown,
    };
  }, [dateFilteredTickets, expenseTransactions]);

  const fmtNum = (valIQD: number, valUSD: number) => {
    if (currency === 'USD') return `$${valUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (currency === 'IQD') return `${valIQD.toLocaleString()}`;
    if (valUSD !== 0 && valIQD !== 0) return `${valIQD.toLocaleString()} | $${valUSD.toLocaleString()}`;
    return valUSD !== 0 ? `$${valUSD.toLocaleString()}` : `${valIQD.toLocaleString()}`;
  };

  // Grouped Customer Profits
  const customerProfits = useMemo(() => {
    const map = new Map<string, any>();
    dateFilteredTickets.forEach((t: any) => {
      const name = resolveCustomerName(t);
      const isUSD = (t.currency || '').toUpperCase().includes('USD') || (t.currency || '').includes('$');
      const isRef = t.tripType === 'REFUND' || t.status === 'REFUNDED' || String(t.invoiceNumber || '').startsWith('REF-');
      const sell = Math.abs(Number(t.totalSell || t.netSell || 0));
      const buy = Math.abs(Number(t.totalBuy || t.netBuy || 0));
      const profit = Number(t.profit !== undefined && t.profit !== null ? t.profit : (sell - buy));

      if (!map.has(name)) {
        map.set(name, { customerName: name, count: 0, salesIQD: 0, costIQD: 0, profitIQD: 0, salesUSD: 0, costUSD: 0, profitUSD: 0 });
      }
      const item = map.get(name)!;
      item.count += 1;
      if (isUSD) {
        if (!isRef) { item.salesUSD += sell; item.costUSD += buy; }
        item.profitUSD += profit;
      } else {
        if (!isRef) { item.salesIQD += sell; item.costIQD += buy; }
        item.profitIQD += profit;
      }
    });
    return Array.from(map.values()).sort((a, b) => (b.profitUSD * 1500 + b.profitIQD) - (a.profitUSD * 1500 + a.profitIQD));
  }, [dateFilteredTickets, resolveCustomerName]);

  // Grouped Supplier Profits
  const supplierProfits = useMemo(() => {
    const map = new Map<string, any>();
    dateFilteredTickets.forEach((t: any) => {
      const name = t.supplierAccountName || t.airline || 'المورد الرئيسي';
      const isUSD = (t.currency || '').toUpperCase().includes('USD') || (t.currency || '').includes('$');
      const isRef = t.tripType === 'REFUND' || t.status === 'REFUNDED' || String(t.invoiceNumber || '').startsWith('REF-');
      const sell = Math.abs(Number(t.totalSell || t.netSell || 0));
      const buy = Math.abs(Number(t.totalBuy || t.netBuy || 0));
      const profit = Number(t.profit !== undefined && t.profit !== null ? t.profit : (sell - buy));

      if (!map.has(name)) {
        map.set(name, { supplierName: name, count: 0, salesIQD: 0, costIQD: 0, profitIQD: 0, salesUSD: 0, costUSD: 0, profitUSD: 0 });
      }
      const item = map.get(name)!;
      item.count += 1;
      if (isUSD) {
        if (!isRef) { item.salesUSD += sell; item.costUSD += buy; }
        item.profitUSD += profit;
      } else {
        if (!isRef) { item.salesIQD += sell; item.costIQD += buy; }
        item.profitIQD += profit;
      }
    });
    return Array.from(map.values()).sort((a, b) => (b.profitUSD * 1500 + b.profitIQD) - (a.profitUSD * 1500 + a.profitIQD));
  }, [dateFilteredTickets]);

  const partnerAccounts = useMemo(() => {
    return accounts.filter((a) => {
      const code = a.code || '';
      return (code.startsWith('264') || code.startsWith('261') || (a.nameAr || '').includes('شريك') || (a.nameAr || '').includes('جاري الشركاء')) && !a.isParent;
    });
  }, [accounts]);

  const handleDistributeProfit = async () => {
    if (!selectedPartner) {
      showErrorNotification(isAr ? 'خطأ' : 'Error', isAr ? 'يرجى اختيار حساب الشريك' : 'Select partner account');
      return;
    }
    if (distributeAmountIQD <= 0 && distributeAmountUSD <= 0) {
      showErrorNotification(isAr ? 'خطأ' : 'Error', isAr ? 'يرجى إدخال مبلغ توزيع صالح بالدينار أو الدولار' : 'Enter a valid amount');
      return;
    }
    setIsDistributing(true);
    try {
      const isUSD = distributeAmountUSD > 0;
      const amount = isUSD ? distributeAmountUSD : distributeAmountIQD;
      const curr = isUSD ? 'USD' : 'IQD';
      const dividendsAcc = accounts.find((a) => a.code === '2643' || a.nameAr?.includes('أرباح مقترح توزيعها') || a.code === '264') || { id: selectedPartner };

      await apiRequest('/api/journal-entries', {
        method: 'POST',
        body: JSON.stringify({
          date: new Date().toISOString(),
          description: distributeNotes || `قيد استحقاق وتوزيع أرباح إلى حساب الشريك (${curr})`,
          currency: curr,
          lines: [
            { accountId: dividendsAcc.id, debit: amount, credit: 0, description: `استحقاق أرباح - توزيع دوري` },
            { accountId: selectedPartner, debit: 0, credit: amount, description: `إيداع حصة الأرباح في جاري الشريك` },
          ],
        }),
      });
      showSuccessNotification(isAr ? 'تم بنجاح' : 'Success', isAr ? 'تم تسجيل وترحيل قيد توزيع الأرباح للشريك بنجاح' : 'Profit distributed successfully');
      setDistributeModalOpen(false);
      setDistributeAmountIQD(0);
      setDistributeAmountUSD(0);
      setDistributeNotes('');
      fetchAllData();
    } catch (err: any) {
      showErrorNotification(isAr ? 'تعذر التوزيع' : 'Failed', err.message || 'Error creating distribution');
    } finally {
      setIsDistributing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FB] p-4 md:p-6 space-y-5 text-slate-900 select-none" dir={direction}>
      {/* ══════════════════════════════════════════════════════════════
          1. CLEAN REFINED PAGE HEADER
         ══════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
              {isAr ? 'لوحة تحليل الربحية' : 'Profitability Analytics'}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-orange-50 text-[#F45A0A] border border-orange-200">
              2026
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-500 font-medium mt-1">
            {isAr ? 'مؤشرات الأداء المالي، تسوية الإيرادات والتكاليف، وهيكل الأرباح التشغيلية للأطراف والخدمات' : 'Executive financial KPIs, revenue/cost reconciliation & profitability insights'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Navigate to Official Statement */}
          <button
            type="button"
            onClick={() => navigate('/income-statement')}
            className="h-[40px] px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <FileText size={15} className="text-orange-400" />
            <span>{isAr ? 'عرض القائمة المالية الرسمية' : 'Official Statement'}</span>
            <ArrowRight size={14} className={isAr ? 'rotate-180' : ''} />
          </button>

          {/* Export Excel */}
          <button
            type="button"
            onClick={() => showSuccessNotification(isAr ? 'تصدير' : 'Export', isAr ? 'جاري تصدير بيانات تحليل الربحية...' : 'Exporting...')}
            className="h-[40px] px-3.5 rounded-xl bg-white border border-[#DDE4ED] hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileSpreadsheet size={16} className="text-emerald-600" />
            <span>Excel</span>
          </button>

          {/* Refresh */}
          <button
            type="button"
            onClick={fetchAllData}
            disabled={loading}
            className="h-[40px] px-3 rounded-xl bg-white border border-[#DDE4ED] hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
            title={isAr ? 'تحديث البيانات' : 'Refresh'}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-[#F45A0A]' : 'text-slate-600'} />
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          2. UNIFIED FILTER TOOLBAR
         ══════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-[#DDE4ED] p-3.5 shadow-2xs flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 flex-wrap flex-1">
          {/* Elegant Custom Branch Selector */}
          <Menu shadow="md" width={220} position="bottom-start" radius="14px">
            <Menu.Target>
              <button
                type="button"
                className="h-[38px] px-3 rounded-xl bg-[#F6F8FB] border border-[#DDE4ED] hover:bg-slate-100 text-slate-800 font-bold text-xs flex items-center justify-between gap-2.5 transition-colors cursor-pointer min-w-[190px]"
              >
                <div className="flex items-center gap-2 truncate">
                  <Building size={15} className="text-slate-400 shrink-0" />
                  <span className="truncate">{selectedBranchName}</span>
                </div>
                <ChevronDown size={14} className="text-slate-400 shrink-0" />
              </button>
            </Menu.Target>

            <Menu.Dropdown className="p-1.5 shadow-xl border border-slate-200 rounded-2xl bg-white text-xs z-50">
              <Menu.Item
                onClick={() => setSelectedBranchId('ALL')}
                className={`rounded-lg font-bold py-2 ${selectedBranchId === 'ALL' ? 'bg-orange-50 text-[#F45A0A]' : 'text-slate-700'}`}
                rightSection={selectedBranchId === 'ALL' ? <Check size={14} className="text-[#F45A0A]" /> : undefined}
              >
                {isAr ? 'جميع الفروع' : 'All Branches'}
              </Menu.Item>
              {branches.map((b) => (
                <Menu.Item
                  key={b.id}
                  onClick={() => setSelectedBranchId(b.id)}
                  className={`rounded-lg font-bold py-2 ${selectedBranchId === b.id ? 'bg-orange-50 text-[#F45A0A]' : 'text-slate-700'}`}
                  rightSection={selectedBranchId === b.id ? <Check size={14} className="text-[#F45A0A]" /> : undefined}
                >
                  {isAr ? b.nameAr : b.nameEn || b.nameAr}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>

          <div className="h-5 w-[1px] bg-slate-200 hidden sm:block" />

          {/* Period Presets */}
          <div className="flex items-center gap-1 bg-[#F6F8FB] border border-[#DDE4ED] rounded-xl p-1">
            {[
              { id: 'YEAR', label: isAr ? 'هذا العام' : 'Year' },
              { id: 'MONTH', label: isAr ? 'هذا الشهر' : 'Month' },
              { id: 'TODAY', label: isAr ? 'اليوم' : 'Today' },
              { id: 'ALL', label: isAr ? 'الكل' : 'All' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleQuickPresetChange(p.id)}
                className={`h-[32px] px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  quickPreset === p.id
                    ? 'bg-white text-[#F45A0A] shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Currency Segmented */}
          <CurrencySegmentedControl
            value={currency}
            onChange={(val) => setCurrency(val)}
            showLabel={false}
            showAllOption={true}
            height="h-[38px]"
          />

          {/* Service Type Filter */}
          <div className="relative min-w-[165px]">
            <select
              value={serviceTypeFilter}
              onChange={(e) => setServiceTypeFilter(e.target.value)}
              className="w-full h-[38px] pr-3 pl-7 rounded-xl bg-[#F6F8FB] border border-[#DDE4ED] text-slate-800 font-bold text-xs focus:outline-none focus:border-[#F45A0A] cursor-pointer appearance-none truncate"
            >
              <option value="ALL">{isAr ? 'كافة الخدمات والأنشطة' : 'All Services'}</option>
              <option value="TICKETS">{isAr ? 'تذاكر طيران فقط' : 'Flight Tickets'}</option>
              <option value="VISAS">{isAr ? 'تأشيرات وفيز فقط' : 'Visas'}</option>
              <option value="REFUNDS">{isAr ? 'استرجاعات فقط' : 'Refunds'}</option>
            </select>
            <ChevronDown size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetFilters}
            className="h-[38px] px-3 rounded-xl bg-[#F6F8FB] hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
          >
            {isAr ? 'إعادة تعيين' : 'Reset'}
          </button>
          <button
            type="button"
            onClick={fetchAllData}
            className="h-[38px] px-4 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
          >
            {isAr ? 'تطبيق' : 'Apply'}
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          3. FOUR FINANCIAL METRIC KPI CARDS
         ══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Gross Sales */}
        <div className="bg-white border border-[#DDE4ED] border-t-4 border-t-blue-500 rounded-2xl p-4 shadow-2xs flex flex-col justify-between hover:shadow-xs transition-all">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-700 block">{isAr ? 'إجمالي المبيعات' : 'Gross Sales'}</span>
              <span className="text-[10.5px] text-slate-400 font-medium">النشاط الجاري (Class 4)</span>
            </div>
            <div className="w-[34px] h-[34px] rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Banknote size={18} />
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="text-xl md:text-2xl font-black text-slate-950 font-mono tabular-nums leading-tight">
              {fmtNum(vm.grossRevenueIQD, vm.grossRevenueUSD)} {currency === 'IQD' && <span className="text-xs font-bold text-slate-500">د.ع</span>}
            </div>
            <div className="text-[11px] text-slate-500 font-medium flex items-center justify-between border-t border-slate-100 pt-1.5">
              <span>مردودات: <strong className="text-rose-600 font-mono">({fmtNum(vm.salesReturnsIQD, vm.salesReturnsUSD)})</strong></span>
              <span className="text-emerald-700 font-mono font-bold">+{fmtNum(vm.refundServiceRevenueIQD, vm.refundServiceRevenueUSD)}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Net Operating Revenue */}
        <div className="bg-white border border-[#DDE4ED] border-t-4 border-t-indigo-500 rounded-2xl p-4 shadow-2xs flex flex-col justify-between hover:shadow-xs transition-all">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-700 block">{isAr ? 'صافي إيراد النشاط' : 'Net Operating Revenue'}</span>
              <span className="text-[10.5px] text-slate-400 font-medium">الإيراد المعتمد (411 - 412 + 4112)</span>
            </div>
            <div className="w-[34px] h-[34px] rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <ReceiptText size={18} />
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="text-xl md:text-2xl font-black text-slate-950 font-mono tabular-nums leading-tight">
              {fmtNum(vm.netOperatingRevenueIQD, vm.netOperatingRevenueUSD)} {currency === 'IQD' && <span className="text-xs font-bold text-slate-500">د.ع</span>}
            </div>
            <div className="text-[11px] text-slate-500 font-medium border-t border-slate-100 pt-1.5">
              <span>صافي المقبوض بعد تسوية المردودات</span>
            </div>
          </div>
        </div>

        {/* Card 3: Net Direct Cost */}
        <div className="bg-white border border-[#DDE4ED] border-t-4 border-t-amber-500 rounded-2xl p-4 shadow-2xs flex flex-col justify-between hover:shadow-xs transition-all">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-700 block">{isAr ? 'صافي التكلفة المباشرة' : 'Net Direct Cost'}</span>
              <span className="text-[10.5px] text-slate-400 font-medium">كلفة المبيعات (311 - 312)</span>
            </div>
            <div className="w-[34px] h-[34px] rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <RotateCcw size={18} />
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="text-xl md:text-2xl font-black text-slate-950 font-mono tabular-nums leading-tight">
              {fmtNum(vm.netDirectCostIQD, vm.netDirectCostUSD)} {currency === 'IQD' && <span className="text-xs font-bold text-slate-500">د.ع</span>}
            </div>
            <div className="text-[11px] text-slate-500 font-medium flex items-center justify-between border-t border-slate-100 pt-1.5">
              <span>التكلفة: <strong className="font-mono text-slate-700">{fmtNum(vm.grossDirectCostIQD, vm.grossDirectCostUSD)}</strong></span>
              <span>المسترد: <strong className="text-rose-600 font-mono">({fmtNum(vm.purchaseReturnsIQD, vm.purchaseReturnsUSD)})</strong></span>
            </div>
          </div>
        </div>

        {/* Card 4: Net Profit */}
        <div className="bg-white border border-[#DDE4ED] border-t-4 border-t-emerald-500 rounded-2xl p-4 shadow-2xs flex flex-col justify-between hover:shadow-xs transition-all">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-700">{isAr ? 'صافي الربح المعتمد' : 'Net Profit'}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-50 text-emerald-700 rounded border border-emerald-200">
                  {vm.profitMarginIQD.toFixed(1)}% هامش
                </span>
              </div>
              <span className="text-[10.5px] text-slate-400 font-medium">الفائض التشغيلي الشامل</span>
            </div>
            <div className="w-[34px] h-[34px] rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="text-xl md:text-2xl font-black text-emerald-600 font-mono tabular-nums leading-tight">
              +{fmtNum(vm.netProfitIQD, vm.netProfitUSD)} {currency === 'IQD' && <span className="text-xs font-bold text-emerald-600">د.ع</span>}
            </div>
            <div className="text-[11px] text-slate-500 font-medium border-t border-slate-100 pt-1.5">
              <span>صافي الإيراد - صافي التكلفة المباشرة</span>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          4 & 5. VISUAL CHARTS (65% Combo Chart & 35% Waterfall Profit Bridge)
         ══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* 65% Column: Interactive Combo Chart */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-[#DDE4ED] p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 size={18} className="text-[#F45A0A]" />
              <h3 className="font-bold text-slate-900 text-sm">
                {isAr ? 'المخطط المركب للإيرادات، التكاليف وصافي الأرباح' : 'Revenue, Costs & Profit Combo Chart'}
              </h3>
            </div>

            {/* Aggregation Toggle */}
            <div className="flex items-center gap-1 bg-[#F6F8FB] border border-[#DDE4ED] rounded-lg p-0.5 text-xs font-bold">
              {[
                { id: 'daily', label: isAr ? 'يومي' : 'Daily' },
                { id: 'monthly', label: isAr ? 'شهري' : 'Monthly' },
                { id: 'yearly', label: isAr ? 'سنوي' : 'Yearly' },
              ].map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setChartAggregation(a.id as any)}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    chartAggregation === a.id ? 'bg-white text-[#F45A0A] shadow-2xs font-black' : 'text-slate-500'
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* SVG Combo Chart */}
          <div className="w-full h-64 relative flex items-end justify-between px-6 pt-6 pb-2">
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-40 px-4 py-6">
              <div className="border-b border-dashed border-slate-300 w-full" />
              <div className="border-b border-dashed border-slate-300 w-full" />
              <div className="border-b border-dashed border-slate-300 w-full" />
              <div className="border-b border-dashed border-slate-300 w-full" />
            </div>

            {[
              { label: isAr ? 'تذاكر الطيران' : 'Flights', rev: vm.breakdown.FLIGHT_TICKETS.salesIQD, cost: vm.breakdown.FLIGHT_TICKETS.costIQD, profit: vm.breakdown.FLIGHT_TICKETS.profitIQD },
              { label: isAr ? 'الفيزا والتأشيرات' : 'Visas', rev: vm.breakdown.VISAS.salesIQD, cost: vm.breakdown.VISAS.costIQD, profit: vm.breakdown.VISAS.profitIQD },
              { label: isAr ? 'الفنادق والإقامة' : 'Hotels', rev: vm.breakdown.HOTELS.salesIQD, cost: vm.breakdown.HOTELS.costIQD, profit: vm.breakdown.HOTELS.profitIQD },
              { label: isAr ? 'الاسترجاعات' : 'Refunds', rev: vm.refundServiceRevenueIQD, cost: 0, profit: vm.refundServiceRevenueIQD },
              { label: isAr ? 'الإجمالي الصافي' : 'Net Total', rev: vm.netOperatingRevenueIQD, cost: vm.netDirectCostIQD, profit: vm.netProfitIQD },
            ].map((col, idx) => {
              const maxVal = Math.max(vm.grossRevenueIQD, 1);
              const revHeight = Math.min(100, Math.max(8, (col.rev / maxVal) * 100));
              const costHeight = Math.min(100, Math.max(6, (col.cost / maxVal) * 100));
              const profitHeight = Math.min(100, Math.max(5, (col.profit / maxVal) * 100));

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 z-10 group">
                  <div className="w-full flex items-end justify-center gap-1.5 h-44">
                    <div
                      style={{ height: `${revHeight}%` }}
                      className="w-4 sm:w-6 bg-blue-500 rounded-t-md transition-all group-hover:bg-blue-600 relative"
                      title={`إيراد: ${col.rev.toLocaleString()} د.ع`}
                    />
                    <div
                      style={{ height: `${costHeight}%` }}
                      className="w-4 sm:w-6 bg-amber-500 rounded-t-md transition-all group-hover:bg-amber-600 relative"
                      title={`تكلفة: ${col.cost.toLocaleString()} د.ع`}
                    />
                    <div
                      style={{ height: `${profitHeight}%` }}
                      className="w-4 sm:w-6 bg-emerald-500 rounded-t-md transition-all group-hover:bg-emerald-600 relative"
                      title={`صافي ربح: ${col.profit.toLocaleString()} د.ع`}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 text-center truncate max-w-[80px]">
                    {col.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 pt-2 border-t border-slate-100 text-xs font-bold text-slate-600">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-blue-500" />
              <span>{isAr ? 'الإيراد والمبيعات' : 'Revenue'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-amber-500" />
              <span>{isAr ? 'التكلفة المباشرة' : 'Direct Cost'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-emerald-500" />
              <span>{isAr ? 'صافي الربح' : 'Net Profit'}</span>
            </div>
          </div>
        </div>

        {/* 35% Column: Waterfall Profit Bridge */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-[#DDE4ED] p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Scale size={18} className="text-[#F45A0A]" />
            <h3 className="font-bold text-slate-900 text-sm">
              {isAr ? 'مخطط شلال الأرباح (Waterfall Bridge)' : 'Waterfall Profit Bridge'}
            </h3>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50/70 border border-blue-100">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="font-bold text-slate-800">إجمالي المبيعات</span>
              </div>
              <span className="font-mono font-bold text-blue-900">+{vm.grossRevenueIQD.toLocaleString()} د.ع</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-rose-50/70 border border-rose-100">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="font-medium text-slate-800">المسترد للعملاء (مردودات)</span>
              </div>
              <span className="font-mono font-bold text-rose-600">({vm.salesReturnsIQD.toLocaleString()} د.ع)</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/60 border border-emerald-100">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="font-medium text-slate-800">عمولات استرجاع وتعديل</span>
              </div>
              <span className="font-mono font-bold text-emerald-700">+{vm.refundServiceRevenueIQD.toLocaleString()} د.ع</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-100 border border-slate-200">
              <span className="font-bold text-slate-900">صافي إيراد النشاط الجاري</span>
              <span className="font-mono font-black text-slate-900">{vm.netOperatingRevenueIQD.toLocaleString()} د.ع</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50/70 border border-amber-100">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="font-medium text-slate-800">صافي التكلفة المباشرة</span>
              </div>
              <span className="font-mono font-bold text-amber-800">({vm.netDirectCostIQD.toLocaleString()} د.ع)</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
              <span className="font-medium text-slate-600">المصروفات التشغيلية (32)</span>
              <span className="font-mono font-bold text-slate-700">({vm.operatingExpensesIQD.toLocaleString()} د.ع)</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 border-2 border-emerald-300 font-black text-emerald-950">
              <span className="text-xs">صافي الربح المعتمد:</span>
              <span className="font-mono text-sm">+{vm.netProfitIQD.toLocaleString()} د.ع</span>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          6. TWO ANALYTICAL SECTIONS (Services & Parties Profitability)
         ══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Section A: Service Profitability Breakdown */}
        <div className="bg-white rounded-2xl border border-[#DDE4ED] p-5 shadow-2xs space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <Layers size={17} className="text-[#F45A0A]" />
              <h3 className="font-bold text-slate-900 text-sm">{isAr ? 'ربحية الخدمات والأنشطة' : 'Service Profitability'}</h3>
            </div>
            <span className="text-xs text-slate-400 font-medium">مبيعات وهامش كل خدمة</span>
          </div>

          <div className="space-y-3">
            {Object.entries(vm.breakdown).map(([key, item]) => {
              const margin = item.salesIQD > 0 ? ((item.profitIQD / item.salesIQD) * 100).toFixed(1) : '0.0';
              const share = vm.netOperatingRevenueIQD > 0 ? Math.round((item.salesIQD / vm.netOperatingRevenueIQD) * 100) : 0;
              return (
                <div key={key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{item.titleAr} ({item.count})</span>
                    <span className="font-mono font-black text-emerald-600">+{item.profitIQD.toLocaleString()} د.ع ({margin}%)</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
                    <div style={{ width: `${Math.min(100, Math.max(4, share))}%` }} className="bg-[#F45A0A] rounded-full" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section B: Top Customers & Suppliers Profitability */}
        <div className="bg-white rounded-2xl border border-[#DDE4ED] p-5 shadow-2xs space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <UsersRound size={17} className="text-[#F45A0A]" />
              <h3 className="font-bold text-slate-900 text-sm">{isAr ? 'أرباح الأطراف والشركاء' : 'Parties Profitability'}</h3>
            </div>

            <div className="flex items-center gap-1 bg-[#F6F8FB] border border-[#DDE4ED] rounded-lg p-0.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setPartiesSubTab('customers')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  partiesSubTab === 'customers' ? 'bg-white text-[#F45A0A] shadow-2xs font-black' : 'text-slate-500'
                }`}
              >
                {isAr ? 'أفضل العملاء' : 'Customers'}
              </button>
              <button
                type="button"
                onClick={() => setPartiesSubTab('suppliers')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  partiesSubTab === 'suppliers' ? 'bg-white text-[#F45A0A] shadow-2xs font-black' : 'text-slate-500'
                }`}
              >
                {isAr ? 'أفضل الموردين' : 'Suppliers'}
              </button>
            </div>
          </div>

          <div className="space-y-2.5 max-h-60 overflow-y-auto">
            {partiesSubTab === 'customers' ? (
              customerProfits.slice(0, 5).map((c: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-[#F6F8FB] border border-[#DDE4ED] text-xs">
                  <div>
                    <div className="font-bold text-slate-900">{c.customerName}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{c.count} عملية</div>
                  </div>
                  <div className="text-left font-mono">
                    <div className="font-black text-emerald-600">+{c.profitIQD.toLocaleString()} د.ع</div>
                    <div className="text-[11px] text-slate-500">{c.salesIQD.toLocaleString()} د.ع</div>
                  </div>
                </div>
              ))
            ) : (
              supplierProfits.slice(0, 5).map((s: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-[#F6F8FB] border border-[#DDE4ED] text-xs">
                  <div>
                    <div className="font-bold text-slate-900">{s.supplierName}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{s.count} عملية</div>
                  </div>
                  <div className="text-left font-mono">
                    <div className="font-black text-emerald-600">+{s.profitIQD.toLocaleString()} د.ع</div>
                    <div className="text-[11px] text-slate-500">{s.costIQD.toLocaleString()} د.ع</div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-600 font-medium">توزيع الأرباح لحسابات الشركاء:</span>
            <button
              type="button"
              onClick={() => setDistributeModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-[#F45A0A] font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Sparkles size={14} />
              <span>{isAr ? 'تسجيل قيد توزيع أرباح' : 'Distribute Profits'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          MODAL: PARTNER PROFIT DISTRIBUTION
         ══════════════════════════════════════════════════════════════ */}
      <Modal
        opened={distributeModalOpen}
        onClose={() => setDistributeModalOpen(false)}
        title={
          <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm">
            <Coins size={18} className="text-[#F45A0A]" />
            <span>{isAr ? 'تسجيل قيد استحقاق وتوزيع أرباح للشركاء' : 'Partner Profit Distribution'}</span>
          </div>
        }
        centered
        size="md"
        radius="14px"
      >
        <div className="space-y-3.5 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">{isAr ? 'حساب الشريك المستفيد' : 'Partner Account'}</label>
            <select
              value={selectedPartner}
              onChange={(e) => setSelectedPartner(e.target.value)}
              className="w-full h-[40px] px-3 rounded-xl bg-[#F6F8FB] border border-[#DDE4ED] text-xs font-bold focus:outline-none focus:border-[#F45A0A] cursor-pointer"
            >
              <option value="">{isAr ? 'اختر الشريك من الدليل المحاسبي' : 'Select Partner'}</option>
              {partnerAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.nameAr} ({a.code})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-bold text-slate-700 block mb-1">{isAr ? 'مبلغ التوزيع بالدينار (IQD)' : 'Amount in IQD'}</label>
              <input
                type="number"
                value={distributeAmountIQD || ''}
                onChange={(e) => setDistributeAmountIQD(Number(e.target.value) || 0)}
                placeholder="0"
                className="w-full h-[40px] px-3 rounded-xl bg-[#F6F8FB] border border-[#DDE4ED] text-xs font-mono font-bold focus:outline-none focus:border-[#F45A0A]"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">{isAr ? 'مبلغ التوزيع بالدولار ($)' : 'Amount in USD'}</label>
              <input
                type="number"
                value={distributeAmountUSD || ''}
                onChange={(e) => setDistributeAmountUSD(Number(e.target.value) || 0)}
                placeholder="0"
                className="w-full h-[40px] px-3 rounded-xl bg-[#F6F8FB] border border-[#DDE4ED] text-xs font-mono font-bold focus:outline-none focus:border-[#F45A0A]"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">{isAr ? 'البيان والملاحظات' : 'Notes'}</label>
            <input
              type="text"
              placeholder={isAr ? 'مثال: دفعة أرباح الربع السنوي الأول 2026' : 'e.g. Q1 2026 Profit Dividend'}
              value={distributeNotes}
              onChange={(e) => setDistributeNotes(e.target.value)}
              className="w-full h-[40px] px-3 rounded-xl bg-[#F6F8FB] border border-[#DDE4ED] text-xs font-bold focus:outline-none focus:border-[#F45A0A]"
            />
          </div>

          <div className="bg-orange-50 p-3 rounded-xl border border-orange-200 text-orange-950 text-[11px] font-medium leading-relaxed">
            💡 {isAr
              ? 'سيقوم النظام تلقائياً بإنشاء وترحيل قيد محاسبي مزدوج: مدين حساب (أرباح مقترح توزيعها / الأرباح المدورة) ودائن حساب (جاري الشريك المختار).'
              : 'The system will automatically generate a double-entry journal entry debiting Dividends / Retained Earnings and crediting Partner Current Account.'}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={() => setDistributeModalOpen(false)}
              className="h-[38px] px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              disabled={isDistributing}
              onClick={handleDistributeProfit}
              className="h-[38px] px-5 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Check size={15} />
              <span>{isDistributing ? (isAr ? 'جاري الترحيل...' : 'Posting...') : (isAr ? 'ترحيل وتثبيت القيد' : 'Post Entry')}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ProfitsPage;
