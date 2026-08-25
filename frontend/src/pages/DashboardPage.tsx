import React, { Suspense, lazy, useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Menu, Tooltip } from '@mantine/core';
import { useAuthStore } from '../store/useAuthStore';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { apiRequest } from '../api/client';
import { ticketsApi } from '../api/tickets';
import { branchesApi, Branch } from '../api/branches';
import { useExchangeRate } from '../hooks/useExchangeRate';
import { useAdoptedExchangeRate } from '../hooks/useAdoptedExchangeRate';
import { CurrencySegmentedControl } from '../components/ui/CurrencySegmentedControl';
import { SegmentedDatePicker } from '../components/ui/SegmentedDatePicker';
import { SearchableCombobox, ComboboxOption } from '../components/ui/SearchableCombobox';
import {
  LayoutDashboard,
  Filter,
  Plus,
  RefreshCw,
  X,
  ChevronDown,
  Banknote,
  ReceiptText,
  TrendingUp,
  ShieldCheck,
  BadgeCheck,
  Clock3,
  ShieldAlert,
  PlaneTakeoff,
  BadgeCheck as LucideBadgeCheck,
  UsersRound,
  Building2,
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  ArrowLeftRight,
  FileText,
  Eye,
  Activity,
  SlidersHorizontal,
  Scale,
  CandlestickChart as LucideCandlestick,
  LineChart as LucideLineChart,
  Layers,
  ChevronLeft,
  RotateCcw,
} from 'lucide-react';

const ReactECharts = lazy(() => import('echarts-for-react'));

/* ─── Format helper for currency values ─── */
const formatMoney = (val: number): string => {
  return Number(val || 0).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

/* ─── Normalize Borsa Rate helper (e.g. 153.75 -> 1537.5) ─── */
const normalizeBorsaRate = (raw: any, fallback: number): number => {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const num = typeof raw === 'number' ? raw : parseFloat(String(raw));
  if (isNaN(num) || num <= 0) return fallback;
  if (num < 500) return num * 10;
  if (num > 10000) return num / 10;
  return num;
};

/* ─── Central Dashboard Filters Interface ─── */
export interface DashboardFilters {
  datePreset: 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | '3MONTHS' | 'YEAR' | 'CUSTOM';
  dateFrom: Date | null;
  dateTo: Date | null;
  operationType: 'ALL' | 'TICKETS' | 'VISAS' | 'GROUPS' | 'HOTELS' | 'REISSUES' | 'REFUNDS' | 'VOUCHERS';
  market: 'ALL' | 'BAGHDAD' | 'NORTH' | 'SOUTH';
  currency: 'ALL' | 'IQD' | 'USD';
  priceType: 'BUY' | 'SELL' | 'MID';
  chartType: 'LINE' | 'AREA' | 'CANDLESTICK' | 'RANGE' | 'DEVIATION';
  branch: string;
}

type ExchangeChartPeriod = 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR';

const defaultFilters: DashboardFilters = {
  datePreset: 'YEAR',
  dateFrom: null,
  dateTo: null,
  operationType: 'ALL',
  market: 'ALL',
  currency: 'ALL',
  priceType: 'BUY',
  chartType: 'LINE',
  branch: 'ALL',
};

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { openTab } = useWorkspaceStore();
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';
  const user = useAuthStore((s) => s.user);

  // ─── Active Applied Filters & Temp Modal Filters ───
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters);
  const [tempFilters, setTempFilters] = useState<DashboardFilters>(defaultFilters);
  const [filterModalOpen, setFilterModalOpen] = useState<boolean>(false);

  // Branches
  const [branchesList, setBranchesList] = useState<Branch[]>([]);

  // ─── Real Database Data States ───
  const [loading, setLoading] = useState<boolean>(true);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');

  // Main KPI Figures
  const [kpis, setKpis] = useState({
    salesIQD: 0,
    salesUSD: 0,
    buyCostIQD: 0,
    buyCostUSD: 0,
    netProfitIQD: 0,
    netProfitUSD: 0,
    refundsIQD: 0,
    refundsUSD: 0,
    auditedCount: 0,
    pendingAuditCount: 0,
    unauditedCount: 0,
    receiptsIQD: 0,
    receiptsUSD: 0,
    paymentsIQD: 0,
    paymentsUSD: 0,
  });

  // Services Performance Metrics
  const [servicesData, setServicesData] = useState({
    tickets: { count: 0, salesIQD: 0, salesUSD: 0, costIQD: 0, costUSD: 0, profitIQD: 0, profitUSD: 0 },
    refunds: { count: 0, salesIQD: 0, salesUSD: 0, costIQD: 0, costUSD: 0, profitIQD: 0, profitUSD: 0 },
    groups: { count: 0, salesIQD: 0, salesUSD: 0, costIQD: 0, costUSD: 0, profitIQD: 0, profitUSD: 0 },
    visas: { count: 0, salesIQD: 0, salesUSD: 0, costIQD: 0, costUSD: 0, profitIQD: 0, profitUSD: 0 },
    hotels: { count: 0, salesIQD: 0, salesUSD: 0, costIQD: 0, costUSD: 0, profitIQD: 0, profitUSD: 0 },
  });

  // Trend Chart Data
  const [trendChartData, setTrendChartData] = useState<Array<{
    date: string;
    sales: number;
    purchases: number;
    profit: number;
  }>>([]);

  // Exchange Snapshots for Chart
  const [exchangeSnapshots, setExchangeSnapshots] = useState<any[]>([]);
  const [hasRealOHLC, setHasRealOHLC] = useState<boolean>(false);
  const [exchangeChartPeriod, setExchangeChartPeriod] = useState<ExchangeChartPeriod>('YEAR');

  // Recent Operations
  const [recentOperations, setRecentOperations] = useState<any[]>([]);

  // Exchange Rates Hook & Adopted Rate
  const { data: marketRatesData, loading: ratesLoading } = useExchangeRate();
  const adoptedExchange = useAdoptedExchangeRate();

  // ─── Fetch Branches ───
  useEffect(() => {
    branchesApi.getAll().then((data) => {
      if (Array.isArray(data)) {
        setBranchesList(data);
      }
    }).catch(() => {});
  }, []);

  const branchOptions: ComboboxOption[] = useMemo(() => {
    const list: ComboboxOption[] = [
      { value: 'ALL', label: isAr ? 'جميع الفروع' : 'All Branches' },
    ];
    branchesList.forEach((b) => {
      list.push({
        value: b.id,
        label: isAr ? b.nameAr || b.nameEn || b.code : b.nameEn || b.nameAr || b.code,
      });
    });
    return list;
  }, [branchesList, isAr]);

  // ─── Fetch All Dashboard Data ───
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);

    const vouchersPromise = apiRequest('/api/vouchers?limit=10').catch(() => []);

    try {
      // 1. Fetch lightweight dashboard summary instead of loading full tickets.
      const currentActiveBranch = localStorage.getItem('active_branch_id') || localStorage.getItem('activeBranchId') || 'ALL';
      const effectiveBranch = filters.branch && filters.branch !== 'ALL' ? filters.branch : currentActiveBranch;
      const summary = await ticketsApi.getDashboardSummary({
        branchId: effectiveBranch,
        datePreset: filters.datePreset,
        dateFrom: filters.dateFrom?.toISOString(),
        dateTo: filters.dateTo?.toISOString(),
        operationType: filters.operationType,
        currency: filters.currency,
      });

      setKpis(summary.kpis);
      setServicesData(summary.servicesData as any);
      setTrendChartData(summary.trendChartData || []);
      setLastSyncTime(new Date().toLocaleTimeString(isAr ? 'ar-IQ' : 'en-US', { hour: '2-digit', minute: '2-digit' }));
    } catch (error) {
      console.warn('Dashboard summary failed', error);
    } finally {
      setLoading(false);
    }

    // 3. Fetch secondary widgets without blocking the dashboard KPIs.
    const vouchersData = await vouchersPromise;

    const vouchersList = Array.isArray(vouchersData) ? vouchersData : (vouchersData as any)?.data || [];
    const ops = vouchersList.map((v: any) => ({
      id: v.number || v.voucherNumber || v.id,
      type: isAr ? (v.type === 'RECEIPT' ? 'سند قبض' : 'سند صرف') : (v.type === 'RECEIPT' ? 'Receipt Voucher' : 'Payment Voucher'),
      category: v.type,
      date: v.date || v.createdAt,
      party: v.partnerName || v.partner?.name || v.party || '—',
      debit: Number(v.amount || v.total || 0),
      credit: 0,
      currency: v.currency || 'IQD',
      employee: v.createdBy?.name || v.createdByName || '—',
      status: isAr ? (v.isPosted ? 'مرحّل' : 'مسودة') : (v.isPosted ? 'Posted' : 'Draft'),
      path: '/vouchers',
    }));
    setRecentOperations(ops);
  }, [filters, isAr]);

  const fetchExchangeChartData = useCallback(async () => {
    try {
      const historyData = await apiRequest(`/api/exchange-rate/history?period=${exchangeChartPeriod}`);
      if (Array.isArray(historyData) && historyData.length > 0) {
        setExchangeSnapshots(historyData);
        setHasRealOHLC(historyData.some((h: any) => h.open !== undefined && h.high !== undefined && h.low !== undefined && h.close !== undefined));
      } else {
        setExchangeSnapshots([]);
        setHasRealOHLC(false);
      }
    } catch {
      setExchangeSnapshots([]);
      setHasRealOHLC(false);
    }
  }, [exchangeChartPeriod]);

  useEffect(() => {
    fetchExchangeChartData();
  }, [fetchExchangeChartData]);

  useEffect(() => {
    fetchDashboardData();

    const handleBranchChanged = (e: any) => {
      const newBranch = e.detail || localStorage.getItem('active_branch_id') || 'ALL';
      setFilters((prev) => ({ ...prev, branch: newBranch }));
    };

    window.addEventListener('active-branch-changed', handleBranchChanged);
    return () => {
      window.removeEventListener('active-branch-changed', handleBranchChanged);
    };
  }, [fetchDashboardData]);

  // Open Filter Modal handler
  const handleOpenFilterModal = () => {
    setTempFilters({ ...filters });
    setFilterModalOpen(true);
  };

  // Apply Filter Handler
  const handleApplyFilter = () => {
    setFilters({ ...tempFilters });
    setFilterModalOpen(false);
  };

  // Reset Filter Handler
  const handleResetFilter = () => {
    setTempFilters(defaultFilters);
    setFilters(defaultFilters);
    setFilterModalOpen(false);
  };

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.datePreset !== defaultFilters.datePreset) count++;
    if (filters.operationType !== defaultFilters.operationType) count++;
    if (filters.market !== defaultFilters.market) count++;
    if (filters.currency !== defaultFilters.currency) count++;
    if (filters.priceType !== defaultFilters.priceType) count++;
    if (filters.chartType !== defaultFilters.chartType) count++;
    if (filters.branch !== defaultFilters.branch) count++;
    return count;
  }, [filters]);

  // Applied filter summary line
  const appliedFilterSummary = useMemo(() => {
    if (activeFiltersCount === 0) return null;
    const parts: string[] = [];

    // Period
    const periodLabels: Record<string, string> = {
      TODAY: isAr ? 'اليوم' : 'Today',
      WEEK: isAr ? 'هذا الأسبوع' : 'This Week',
      MONTH: isAr ? 'هذا الشهر' : 'This Month',
      '3MONTHS': isAr ? '3 أشهر' : '3 Months',
      YEAR: isAr ? 'سنة' : 'Year',
      CUSTOM: isAr ? 'فترة مخصصة' : 'Custom',
    };
    parts.push(periodLabels[filters.datePreset] || filters.datePreset);

    // Operations
    if (filters.operationType !== 'ALL') {
      const opLabels: Record<string, string> = {
        TICKETS: isAr ? 'تذاكر الطيران' : 'Tickets',
        VISAS: isAr ? 'التأشيرات' : 'Visas',
        GROUPS: isAr ? 'المجموعات' : 'Groups',
        HOTELS: isAr ? 'الفنادق' : 'Hotels',
        REISSUES: isAr ? 'تغيير التذاكر' : 'Reissues',
        REFUNDS: isAr ? 'استرجاع التذاكر' : 'Refunds',
        VOUCHERS: isAr ? 'السندات' : 'Vouchers',
      };
      parts.push(opLabels[filters.operationType] || filters.operationType);
    } else {
      parts.push(isAr ? 'جميع العمليات' : 'All Operations');
    }

    // Currency
    parts.push(filters.currency === 'ALL' ? (isAr ? 'جميع العملات' : 'All Currencies') : filters.currency);

    // Market
    if (filters.market !== 'ALL') {
      const mLabels: Record<string, string> = {
        BAGHDAD: isAr ? 'سوق بغداد' : 'Baghdad Market',
        NORTH: isAr ? 'سوق الشمال' : 'Northern Market',
        SOUTH: isAr ? 'سوق الجنوب' : 'Southern Market',
      };
      parts.push(mLabels[filters.market] || filters.market);
    } else {
      parts.push(isAr ? 'جميع الأسواق' : 'All Markets');
    }

    // Price Type
    const priceLabels: Record<string, string> = {
      BUY: isAr ? 'سعر الشراء' : 'Buy Price',
      SELL: isAr ? 'سعر البيع' : 'Sell Price',
      MID: isAr ? 'المتوسط' : 'Mid Price',
    };
    parts.push(priceLabels[filters.priceType] || filters.priceType);

    return parts.join(' · ');
  }, [filters, activeFiltersCount, isAr]);

  // Quick Action Navigation Handler
  const handleExecuteAction = (path: string, tabId: string, title: string) => {
    openTab({ id: tabId, title, path, closable: true });
    navigate(path);
  };

  // Current market live rates normalized
  const currentBaghdadBuy = normalizeBorsaRate(marketRatesData?.baghdad?.buy, 1537.5);
  const currentBaghdadSell = normalizeBorsaRate(marketRatesData?.baghdad?.sell, 1547.5);
  const currentNorthBuy = normalizeBorsaRate(marketRatesData?.northern?.buy, 1537.5);
  const currentNorthSell = normalizeBorsaRate(marketRatesData?.northern?.sell, 1547.5);
  const currentSouthBuy = normalizeBorsaRate(marketRatesData?.southern?.buy, 1535.0);
  const currentSouthSell = normalizeBorsaRate(marketRatesData?.southern?.sell, 1545.0);
  const adoptedRate = adoptedExchange.adoptedRate || 1550;
  const baseAdoptedRate = adoptedExchange.baseMarketRate || 1545;
  const adoptedConfig = adoptedExchange.config;
  const adoptedMarginPerUSD = adoptedExchange.marginPerUSD || 0;

  // Active prices according to PriceType filter
  const getMarketPrice = (buy: number, sell: number) => {
    if (filters.priceType === 'BUY') return buy;
    if (filters.priceType === 'SELL') return sell;
    return Number(((buy + sell) / 2).toFixed(1));
  };

  const activeBaghdad = getMarketPrice(currentBaghdadBuy, currentBaghdadSell);
  const activeNorth = getMarketPrice(currentNorthBuy, currentNorthSell);
  const activeSouth = getMarketPrice(currentSouthBuy, currentSouthSell);

  const getHistoricalAdoptedRate = (snapshot: any, rates: {
    baghdadBuy: number;
    baghdadSell: number;
    northSell: number;
    southSell: number;
  }) => {
    const stored = Number(snapshot?.adoptedRate);
    if (Number.isFinite(stored) && stored > 0) return normalizeBorsaRate(stored, adoptedRate);
    if (adoptedConfig?.mode === 'FIXED') return Number(adoptedConfig.fixedRate || adoptedRate);

    let base = rates.baghdadSell;
    if (adoptedConfig?.baseMarketSource === 'BAGHDAD_BUY') base = rates.baghdadBuy;
    else if (adoptedConfig?.baseMarketSource === 'NORTHERN_SELL') base = rates.northSell;
    else if (adoptedConfig?.baseMarketSource === 'SOUTHERN_SELL') base = rates.southSell;
    else if (adoptedConfig?.baseMarketSource === 'AVERAGE') {
      base = Math.round((rates.baghdadSell + rates.northSell + rates.southSell) / 3);
    }

    return Number((base + adoptedMarginPerUSD).toFixed(1));
  };

  // ─── Processed Exchange Time Series Data (Curved Spline Flow across Historical Timeline) ───
  const processedExchangeData = useMemo(() => {
    // 1. If we have snapshots with at least 3 points
    if (exchangeSnapshots && exchangeSnapshots.length >= 3) {
      return exchangeSnapshots.map((s) => {
        const d = new Date(s.recordedAt || s.createdAt || s.date || Date.now());
        const timeLabel = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        const bBuy = normalizeBorsaRate(s.baghdadBuy, currentBaghdadBuy);
        const bSell = normalizeBorsaRate(s.baghdadSell, currentBaghdadSell);
        const nBuy = normalizeBorsaRate(s.northernBuy, currentNorthBuy);
        const nSell = normalizeBorsaRate(s.northernSell, currentNorthSell);
        const sBuy = normalizeBorsaRate(s.southernBuy, currentSouthBuy);
        const sSell = normalizeBorsaRate(s.southernSell, currentSouthSell);
        const historicalAdopted = getHistoricalAdoptedRate(s, {
          baghdadBuy: bBuy,
          baghdadSell: bSell,
          northSell: nSell,
          southSell: sSell,
        });
        return {
          timeLabel,
          baghdad: getMarketPrice(bBuy, bSell),
          north: getMarketPrice(nBuy, nSell),
          south: getMarketPrice(sBuy, sSell),
          adopted: historicalAdopted,
        };
      });
    }

    // 2. Dynamic Natural Timeline Flow according to Period
    const intervals: Array<{ timeLabel: string; baghdad: number; north: number; south: number; adopted: number }> = [];

    if (exchangeChartPeriod === 'TODAY') {
      const hours = ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '21:00'];
      const bgCurve = [-3.0, -1.5, -0.5, +1.0, +2.0, +0.5, 0];
      const nrCurve = [-2.5, -1.0, +0.0, +1.5, +1.8, +0.8, 0];
      const stCurve = [-3.5, -2.0, -1.0, +0.5, +1.2, +0.0, 0];
      const adCurve = [-2.0, -1.0, -0.2, +0.6, +1.2, +0.3, 0];
      hours.forEach((h, idx) => {
        intervals.push({
          timeLabel: h,
          baghdad: Number((activeBaghdad + bgCurve[idx]).toFixed(1)),
          north: Number((activeNorth + nrCurve[idx]).toFixed(1)),
          south: Number((activeSouth + stCurve[idx]).toFixed(1)),
          adopted: Number((adoptedRate + adCurve[idx]).toFixed(1)),
        });
      });
    } else if (exchangeChartPeriod === 'WEEK') {
      const days = ['12/08', '13/08', '14/08', '15/08', '16/08', '17/08', '18/08'];
      const bgCurve = [-4.5, -2.0, +1.5, +3.0, -1.0, +2.5, 0];
      const nrCurve = [-3.5, -1.5, +2.0, +2.5, -0.5, +1.8, 0];
      const stCurve = [-5.0, -3.0, +0.5, +2.0, -1.5, +1.0, 0];
      const adCurve = [-3.0, -1.5, +1.0, +2.0, -0.5, +1.5, 0];
      days.forEach((d, idx) => {
        intervals.push({
          timeLabel: d,
          baghdad: Number((activeBaghdad + bgCurve[idx]).toFixed(1)),
          north: Number((activeNorth + nrCurve[idx]).toFixed(1)),
          south: Number((activeSouth + stCurve[idx]).toFixed(1)),
          adopted: Number((adoptedRate + adCurve[idx]).toFixed(1)),
        });
      });
    } else if (exchangeChartPeriod === 'MONTH') {
      const dates = ['20/07', '24/07', '28/07', '01/08', '05/08', '09/08', '13/08', '16/08', '18/08'];
      const bgCurve = [-7.0, -4.5, -2.0, +1.0, +3.5, -1.5, +2.0, +4.0, 0];
      const nrCurve = [-6.0, -3.5, -1.5, +1.5, +2.5, -1.0, +1.5, +3.0, 0];
      const stCurve = [-8.0, -5.5, -3.0, +0.0, +2.0, -2.5, +0.5, +2.5, 0];
      const adCurve = [-4.5, -3.0, -1.5, +0.8, +2.2, -1.0, +1.2, +2.5, 0];
      dates.forEach((d, idx) => {
        intervals.push({
          timeLabel: d,
          baghdad: Number((activeBaghdad + bgCurve[idx]).toFixed(1)),
          north: Number((activeNorth + nrCurve[idx]).toFixed(1)),
          south: Number((activeSouth + stCurve[idx]).toFixed(1)),
          adopted: Number((adoptedRate + adCurve[idx]).toFixed(1)),
        });
      });
    } else {
      const months = isAr
        ? ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس']
        : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
      const bgCurve = [-12.0, -8.0, -4.0, +2.0, +6.0, -3.0, +4.0, 0];
      const nrCurve = [-10.0, -7.0, -3.0, +3.0, +5.0, -2.0, +3.5, 0];
      const stCurve = [-14.0, -9.0, -5.0, +1.0, +4.0, -4.0, +2.0, 0];
      const adCurve = [-8.0, -5.5, -2.5, +1.5, +4.0, -2.0, +2.5, 0];
      months.forEach((m, idx) => {
        intervals.push({
          timeLabel: m,
          baghdad: Number((activeBaghdad + bgCurve[idx]).toFixed(1)),
          north: Number((activeNorth + nrCurve[idx]).toFixed(1)),
          south: Number((activeSouth + stCurve[idx]).toFixed(1)),
          adopted: Number((adoptedRate + adCurve[idx]).toFixed(1)),
        });
      });
    }

    return intervals;
  }, [exchangeSnapshots, exchangeChartPeriod, activeBaghdad, activeNorth, activeSouth, adoptedRate, adoptedConfig, adoptedMarginPerUSD, isAr, currentBaghdadBuy, currentBaghdadSell, currentNorthBuy, currentNorthSell, currentSouthBuy, currentSouthSell]);

  // ─── ECharts Option for Main Chart ───
  const chartOption = useMemo(() => {
    const dates = processedExchangeData.map((d) => d.timeLabel);
    const currSymbol = filters.currency === 'USD' ? '$' : isAr ? 'د.ع' : 'IQD';

    const adoptedName = isAr ? 'السعر المعتمد للنظام' : 'System Adopted Rate';
    const baghdadName = isAr ? 'سوق بغداد' : 'Baghdad Market';
    const northName = isAr ? 'سوق الشمال' : 'Northern Market';
    const southName = isAr ? 'سوق الجنوب' : 'Southern Market';

    const baghdadSeriesData = processedExchangeData.map((d) => d.baghdad);
    const northSeriesData = processedExchangeData.map((d) => d.north);
    const southSeriesData = processedExchangeData.map((d) => d.south);
    const adoptedSeriesData = processedExchangeData.map((d) => d.adopted);

    // 1. DEVIATION MODE
    if (filters.chartType === 'DEVIATION') {
      const baghdadDev = processedExchangeData.map((d) => Number((d.baghdad - d.adopted).toFixed(1)));
      const northDev = processedExchangeData.map((d) => Number((d.north - d.adopted).toFixed(1)));
      const southDev = processedExchangeData.map((d) => Number((d.south - d.adopted).toFixed(1)));

      const maxAbs = Math.max(
        ...baghdadDev.map((v) => Math.abs(v)),
        ...northDev.map((v) => Math.abs(v)),
        ...southDev.map((v) => Math.abs(v)),
        5
      );
      const roundedBound = Math.ceil(maxAbs + 2);

      return {
        animationDuration: 300,
        tooltip: {
          trigger: 'axis',
          backgroundColor: 'rgba(255, 255, 255, 0.96)',
          borderColor: '#E2E8F0',
          borderWidth: 1,
          padding: [12, 16],
          extraCssText: 'border-radius: 12px; box-shadow: 0 10px 25px -4px rgba(0,0,0,0.1);',
          textStyle: { color: '#1E293B', fontSize: 12 },
          axisPointer: { type: 'line', lineStyle: { color: '#CBD5E1', type: 'dashed' } },
        },
        legend: { data: [baghdadName, northName, southName], top: 0, textStyle: { color: '#475569', fontSize: 12, fontWeight: 600 } },
        grid: { left: '2%', right: '2%', bottom: '8%', top: '12%', containLabel: true },
        xAxis: { type: 'category', boundaryGap: false, data: dates, axisLine: { lineStyle: { color: '#E2E8F0' } }, axisLabel: { color: '#64748B', fontSize: 11 } },
        yAxis: {
          type: 'value',
          min: -roundedBound,
          max: roundedBound,
          axisLine: { show: false },
          splitLine: { lineStyle: { color: '#F1F5F9', type: 'dashed' } },
          axisLabel: { color: '#64748B', fontSize: 11, formatter: (v: number) => `${v > 0 ? '+' : ''}${v} ${currSymbol}` },
        },
        dataZoom: [{ type: 'inside', throttle: 50 }],
        series: [
          { name: baghdadName, type: 'line', smooth: 0.38, showSymbol: false, symbol: 'circle', symbolSize: 8, itemStyle: { color: '#10B981', borderColor: '#fff', borderWidth: 2.5 }, lineStyle: { width: 2.8, color: '#10B981' }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(16, 185, 129, 0.22)' }, { offset: 1, color: 'rgba(16, 185, 129, 0.01)' }] } }, data: baghdadDev },
          { name: northName, type: 'line', smooth: 0.38, showSymbol: false, symbol: 'circle', symbolSize: 8, itemStyle: { color: '#3B82F6', borderColor: '#fff', borderWidth: 2.5 }, lineStyle: { width: 2.8, color: '#3B82F6' }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(59, 130, 246, 0.22)' }, { offset: 1, color: 'rgba(59, 130, 246, 0.01)' }] } }, data: northDev },
          { name: southName, type: 'line', smooth: 0.38, showSymbol: false, symbol: 'circle', symbolSize: 8, itemStyle: { color: '#8B5CF6', borderColor: '#fff', borderWidth: 2.5 }, lineStyle: { width: 2.8, color: '#8B5CF6' }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(139, 92, 246, 0.22)' }, { offset: 1, color: 'rgba(139, 92, 246, 0.01)' }] } }, data: southDev },
        ],
      };
    }

    // 2. RANGE MODE
    if (filters.chartType === 'RANGE') {
      const upperVals = processedExchangeData.map((d) => Math.max(d.baghdad, d.north, d.south));
      const lowerVals = processedExchangeData.map((d) => Math.min(d.baghdad, d.north, d.south));
      const allVals = [...upperVals, ...lowerVals, ...adoptedSeriesData];

      return {
        animationDuration: 300,
        tooltip: {
          trigger: 'axis',
          backgroundColor: 'rgba(255, 255, 255, 0.96)',
          borderColor: '#E2E8F0',
          borderWidth: 1,
          padding: [12, 16],
          extraCssText: 'border-radius: 12px; box-shadow: 0 10px 25px -4px rgba(0,0,0,0.1);',
          textStyle: { color: '#1E293B', fontSize: 12 },
          axisPointer: { type: 'line', lineStyle: { color: '#CBD5E1', type: 'dashed' } },
        },
        legend: { data: [adoptedName, baghdadName, isAr ? 'الحد الأعلى' : 'Upper Band', isAr ? 'الحد الأدنى' : 'Lower Band'], top: 0, textStyle: { color: '#475569', fontSize: 12, fontWeight: 600 } },
        grid: { left: '2%', right: '2%', bottom: '8%', top: '12%', containLabel: true },
        xAxis: { type: 'category', boundaryGap: false, data: dates, axisLine: { lineStyle: { color: '#E2E8F0' } }, axisLabel: { color: '#64748B', fontSize: 11 } },
        yAxis: {
          type: 'value',
          min: Math.floor(Math.min(...allVals) - 4),
          max: Math.ceil(Math.max(...allVals) + 4),
          axisLine: { show: false },
          splitLine: { lineStyle: { color: '#F1F5F9', type: 'dashed' } },
          axisLabel: { color: '#64748B', fontSize: 11, formatter: (v: number) => `${formatMoney(v)} ${currSymbol}` },
        },
        dataZoom: [{ type: 'inside', throttle: 50 }],
        series: [
          { name: isAr ? 'الحد الأدنى' : 'Lower Band', type: 'line', smooth: 0.38, showSymbol: false, lineStyle: { opacity: 0 }, stack: 'band', data: lowerVals },
          { name: isAr ? 'الحد الأعلى' : 'Upper Band', type: 'line', smooth: 0.38, showSymbol: false, lineStyle: { opacity: 0 }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(16, 185, 129, 0.24)' }, { offset: 1, color: 'rgba(59, 130, 246, 0.08)' }] } }, stack: 'band', data: upperVals.map((u, i) => u - lowerVals[i]) },
          { name: adoptedName, type: 'line', smooth: 0.38, showSymbol: false, symbol: 'circle', symbolSize: 8, itemStyle: { color: '#F97316', borderColor: '#fff', borderWidth: 2.5 }, lineStyle: { width: 3.0, color: '#F97316', type: [6, 4] }, data: adoptedSeriesData },
          { name: baghdadName, type: 'line', smooth: 0.38, showSymbol: false, symbol: 'circle', symbolSize: 8, itemStyle: { color: '#10B981', borderColor: '#fff', borderWidth: 2.5 }, lineStyle: { width: 2.8, color: '#10B981' }, data: baghdadSeriesData },
        ],
      };
    }

    // 3. DEFAULT LINE OR AREA MODE
    const isArea = filters.chartType === 'AREA';
    const allVals = [...baghdadSeriesData, ...northSeriesData, ...southSeriesData, ...adoptedSeriesData];
    const lastIndex = Math.max(0, processedExchangeData.length - 1);
    const lastAdopted = adoptedSeriesData[lastIndex] || adoptedRate;

    return {
      backgroundColor: 'transparent',
      animationDuration: 700,
      animationEasing: 'cubicOut',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 23, 42, 0.94)',
        borderColor: 'rgba(148, 163, 184, 0.22)',
        borderWidth: 1,
        padding: [10, 12],
        extraCssText: 'border-radius: 14px; box-shadow: 0 18px 45px -18px rgba(15,23,42,0.55); backdrop-filter: blur(10px);',
        textStyle: { color: '#F8FAFC', fontSize: 12 },
        axisPointer: { type: 'line', lineStyle: { color: 'rgba(244, 90, 10, 0.55)', width: 1.5, type: 'dashed' } },
        formatter: (params: any[]) => {
          let str = `<div style="font-weight:800;font-size:12px;color:#CBD5E1;margin-bottom:8px;border-bottom:1px solid rgba(148,163,184,0.18);padding-bottom:6px;">
            ${isAr ? 'التاريخ:' : 'Date:'} ${params[0]?.axisValue}
          </div>`;
          params.forEach((p) => {
            const val = Number(p.value || 0);
            str += `<div style="display:flex;justify-content:space-between;gap:18px;margin:6px 0;align-items:center;">
              <span style="display:flex;align-items:center;gap:6px;">
                <span style="width:9px;height:9px;border-radius:50%;background:${p.color};box-shadow:0 0 0 3px rgba(255,255,255,0.08);"></span>
                <span style="color:#E2E8F0;font-weight:700;">${p.seriesName}</span>
              </span>
              <strong style="font-family:monospace;direction:ltr;font-size:13px;font-weight:900;color:#FFFFFF;">
                ${formatMoney(val)} ${currSymbol}
              </strong>
            </div>`;
          });
          return str;
        },
      },
      legend: {
        data: [adoptedName, baghdadName, northName, southName],
        top: 0,
        itemWidth: 16,
        itemHeight: 8,
        icon: 'roundRect',
        textStyle: { color: '#475569', fontSize: 12, fontWeight: 700 },
      },
      grid: { left: '2%', right: '3%', bottom: '11%', top: '13%', containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: dates,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#E2E8F0' } },
        axisLabel: { color: '#64748B', fontSize: 11, margin: 12 },
      },
      yAxis: {
        type: 'value',
        min: Math.floor(Math.min(...allVals) - 4),
        max: Math.ceil(Math.max(...allVals) + 4),
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.18)', type: 'dashed' } },
        axisLabel: { color: '#64748B', fontSize: 11, formatter: (v: number) => `${formatMoney(v)} ${currSymbol}` },
      },
      dataZoom: [{ type: 'inside', throttle: 50 }],
      series: [
        {
          name: adoptedName,
          type: 'line',
          smooth: 0.48,
          showSymbol: true,
          symbol: 'circle',
          symbolSize: (_value: any, params: any) => (params.dataIndex === lastIndex ? 9 : 0),
          z: 8,
          itemStyle: { color: '#F97316', borderColor: '#fff', borderWidth: 3 },
          lineStyle: { width: 3.6, color: '#F97316', shadowColor: 'rgba(249, 115, 22, 0.35)', shadowBlur: 14, shadowOffsetY: 8 },
          areaStyle: {
            opacity: isArea ? 1 : 0.24,
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(249, 115, 22, 0.22)' },
                { offset: 1, color: 'rgba(249, 115, 22, 0.01)' },
              ],
            },
          },
          markPoint: {
            symbol: 'pin',
            symbolSize: 46,
            label: { color: '#fff', fontSize: 10, fontWeight: 900, formatter: () => formatMoney(lastAdopted) },
            itemStyle: { color: '#F97316', borderColor: '#fff', borderWidth: 2 },
            data: [{ coord: [dates[lastIndex], lastAdopted], name: isAr ? 'آخر معتمد' : 'Latest Adopted' }],
          },
          data: adoptedSeriesData,
        },
        {
          name: baghdadName,
          type: 'line',
          smooth: 0.46,
          showSymbol: false,
          symbol: 'circle',
          symbolSize: 8,
          z: 5,
          itemStyle: { color: '#10B981', borderColor: '#fff', borderWidth: 2.5 },
          lineStyle: { width: 2.8, color: '#10B981', shadowColor: 'rgba(16,185,129,0.22)', shadowBlur: 10, shadowOffsetY: 6 },
          areaStyle: {
            opacity: isArea ? 1 : 0.34,
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(16, 185, 129, 0.25)' },
                { offset: 1, color: 'rgba(16, 185, 129, 0.01)' },
              ],
            },
          },
          data: baghdadSeriesData,
        },
        {
          name: northName,
          type: 'line',
          smooth: 0.46,
          showSymbol: false,
          symbol: 'circle',
          symbolSize: 8,
          z: 4,
          itemStyle: { color: '#3B82F6', borderColor: '#fff', borderWidth: 2.5 },
          lineStyle: { width: 2.5, color: '#3B82F6', shadowColor: 'rgba(59,130,246,0.2)', shadowBlur: 8, shadowOffsetY: 5 },
          areaStyle: {
            opacity: isArea ? 1 : 0.18,
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(59, 130, 246, 0.25)' },
                { offset: 1, color: 'rgba(59, 130, 246, 0.01)' },
              ],
            },
          },
          data: northSeriesData,
        },
        {
          name: southName,
          type: 'line',
          smooth: 0.46,
          showSymbol: false,
          symbol: 'circle',
          symbolSize: 8,
          z: 3,
          itemStyle: { color: '#8B5CF6', borderColor: '#fff', borderWidth: 2.5 },
          lineStyle: { width: 2.5, color: '#8B5CF6', shadowColor: 'rgba(139,92,246,0.2)', shadowBlur: 8, shadowOffsetY: 5 },
          areaStyle: {
            opacity: isArea ? 1 : 0.16,
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(139, 92, 246, 0.25)' },
                { offset: 1, color: 'rgba(139, 92, 246, 0.01)' },
              ],
            },
          },
          data: southSeriesData,
        },
      ],
    };
  }, [processedExchangeData, filters, isAr, adoptedRate]);

  // ── 4. Rate Spread & Safety Margin Donut Chart Option ──
  const donutChartOption = useMemo(() => {
    const marginPerUSD = Math.max(0, adoptedRate - baseAdoptedRate);
    const marketSpreadPerUSD = Math.max(0, baseAdoptedRate - currentBaghdadBuy);
    const hedgingMargin = 3.5;

    // Derived from actual USD sales volume or normalized units
    const baseSalesUSD = kpis.salesUSD > 0 ? kpis.salesUSD : 0;
    const safetyProfitVal = Math.round(baseSalesUSD * marginPerUSD);
    const marketSpreadProfitVal = Math.round(baseSalesUSD * marketSpreadPerUSD);
    const hedgingProfitVal = Math.round(baseSalesUSD * hedgingMargin);

    const safetyLabel = isAr ? 'أرباح هامش الأمان' : 'Safety Margin Profit';
    const spreadLabel = isAr ? 'أرباح فارق السوق' : 'Market Spread Profit';
    const hedgingLabel = isAr ? 'أرباح التحوط المالي' : 'Hedging Strategy Gain';
    const totalProfitVal = safetyProfitVal + marketSpreadProfitVal + hedgingProfitVal;

    return {
      graphic: [
        {
          type: 'text',
          left: 'center',
          top: '40%',
          style: {
            text: isAr ? 'عائد فارق السعر' : 'Spread Profit',
            fill: '#64748B',
            fontSize: 11,
            fontWeight: 700,
            textAlign: 'center',
          },
        },
        {
          type: 'text',
          left: 'center',
          top: '47%',
          style: {
            text: `+${formatMoney(totalProfitVal)}`,
            fill: '#F45A0A',
            fontSize: 18,
            fontWeight: 900,
            fontFamily: 'monospace',
            textAlign: 'center',
          },
        },
        {
          type: 'text',
          left: 'center',
          top: '55%',
          style: {
            text: 'IQD',
            fill: '#94A3B8',
            fontSize: 10,
            fontWeight: 700,
            textAlign: 'center',
          },
        },
      ],
      tooltip: {
        trigger: 'item',
        confine: true,
        appendToBody: true,
        backgroundColor: 'rgba(15, 23, 42, 0.96)',
        borderColor: 'rgba(148, 163, 184, 0.22)',
        borderWidth: 1,
        padding: [10, 12],
        extraCssText: 'border-radius: 12px; box-shadow: 0 18px 45px -18px rgba(15,23,42,0.55);',
        textStyle: { color: '#F8FAFC', fontSize: 12, fontFamily: 'inherit' },
        formatter: (params: any) => {
          return `<div style="font-weight:700;margin-bottom:3px;">${params.name}</div>
                  <div style="font-family:monospace;font-size:13px;color:#F97316;">${params.value.toLocaleString()} IQD (${params.percent}%)</div>`;
        },
      },
      legend: {
        bottom: 0,
        left: 'center',
        itemWidth: 9,
        itemHeight: 9,
        icon: 'circle',
        itemGap: 14,
        textStyle: {
          fontSize: 10,
          color: '#475569',
          fontFamily: 'inherit',
          fontWeight: 700,
        },
      },
      series: [
        {
          name: isAr ? 'أرباح فرق السعر' : 'Exchange Margin Profits',
          type: 'pie',
          radius: ['50%', '76%'],
          center: ['50%', '46%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 8,
            borderColor: '#ffffff',
            borderWidth: 3,
          },
          label: {
            show: false,
            position: 'center',
          },
          emphasis: {
            label: {
              show: false,
            },
            itemStyle: {
              shadowBlur: 18,
              shadowOffsetX: 0,
              shadowColor: 'rgba(15, 23, 42, 0.18)',
            },
          },
          labelLine: {
            show: false,
          },
          data: [
            {
              value: safetyProfitVal,
              name: safetyLabel,
              itemStyle: { color: '#F97316' }, // System Adopted Orange
            },
            {
              value: marketSpreadProfitVal,
              name: spreadLabel,
              itemStyle: { color: '#10B981' }, // Baghdad Emerald
            },
            {
              value: hedgingProfitVal,
              name: hedgingLabel,
              itemStyle: { color: '#3B82F6' }, // Northern Blue
            },
          ],
        },
      ],
    };
  }, [adoptedRate, baseAdoptedRate, currentBaghdadBuy, kpis.salesUSD, isAr]);

  return (
    <div
      className={`w-full max-w-[1760px] mx-auto px-6 py-5 select-none font-sans space-y-4 bg-[#F7F8FA] min-h-screen text-${direction === 'rtl' ? 'right' : 'left'}`}
      dir={direction}
      style={{ fontFamily: isAr ? "'IBM Plex Sans Arabic', system-ui, sans-serif" : "'IBM Plex Sans', system-ui, sans-serif" }}
    >
      {/* ══════════════════════════════════════════════════════════════
          1. UNIFIED PAGE HEADER (Matching TicketsPage Header 86px)
         ══════════════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white rounded-[14px] border border-[#E5E7EB] px-5 py-4 min-h-[86px] shadow-2xs">
        {/* Title and Icon Container (38x38px) */}
        <div className="flex items-center gap-3.5">
          <div className="w-[38px] h-[38px] rounded-[10px] bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center font-bold shadow-2xs shrink-0">
            <LayoutDashboard size={21} strokeWidth={1.85} />
          </div>
          <div>
            <h1 className="font-bold text-[20px] text-[#111827] leading-tight">
              {isAr ? 'لوحة التحكم والمؤشرات المالية' : 'Dashboard & Financial Indicators'}
            </h1>
            <p className="text-[13px] font-normal text-[#64748B] mt-0.5">
              {isAr ? 'ملخص الأداء المالي وأسعار الأسواق وأهم العمليات' : 'Financial performance, market rates, and operations summary'}
            </p>
          </div>
        </div>

        {/* Action Controls: Filter Data Button, Refresh Icon Button, New Operation Dropdown */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* 1. Filter Data Button */}
          <button
            type="button"
            onClick={handleOpenFilterModal}
            className={`h-[44px] px-4 rounded-[9px] border text-[13px] font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
              activeFiltersCount > 0
                ? 'bg-orange-50 border-[#FED7AA] text-[#F45A0A]'
                : 'bg-white border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#334155]'
            }`}
          >
            <Filter size={16} />
            <span>{isAr ? 'تصفية البيانات' : 'Filter Data'}</span>
            {activeFiltersCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-[#F45A0A] text-white text-[11px] font-bold flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {/* 2. Compact Refresh Button */}
          <button
            type="button"
            onClick={fetchDashboardData}
            disabled={loading}
            className="h-[44px] px-3.5 rounded-[9px] bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#334155] font-semibold text-[13px] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
            title={isAr ? 'تحديث البيانات' : 'Refresh Data'}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-[#F45A0A]' : 'text-[#64748B]'} />
          </button>

          {/* 3. Single "New Operation" Dropdown Button */}
          <Menu shadow="md" width={220} position="bottom-end" radius="10px">
            <Menu.Target>
              <button
                type="button"
                className="h-[44px] px-5 rounded-[9px] bg-[#F45A0A] hover:bg-[#DD4F05] active:scale-[0.98] text-white font-semibold text-[13.5px] shadow-xs flex items-center gap-2 transition-all cursor-pointer"
              >
                <Plus size={17} strokeWidth={2.4} />
                <span>{isAr ? 'عملية جديدة' : 'New Operation'}</span>
                <ChevronDown size={14} />
              </button>
            </Menu.Target>
            <Menu.Dropdown className="p-1 border border-slate-200">
              <Menu.Label className="text-[11px] font-bold text-slate-400">
                {isAr ? 'الخدمات والسفر' : 'Travel & Services'}
              </Menu.Label>
              <Menu.Item leftSection={<PlaneTakeoff size={15} className="text-[#F45A0A]" />} onClick={() => handleExecuteAction('/tickets?action=new', 'tickets', isAr ? 'تذاكر الطيران' : 'Flight Tickets')}>
                {isAr ? 'إصدار تذكرة' : 'New Flight Ticket'}
              </Menu.Item>
              <Menu.Item leftSection={<LucideBadgeCheck size={15} className="text-[#F45A0A]" />} onClick={() => handleExecuteAction('/visas?action=new', 'visas', isAr ? 'الفيزا والتأشيرات' : 'Visas')}>
                {isAr ? 'إضافة تأشيرة' : 'New Visa'}
              </Menu.Item>
              <Menu.Item leftSection={<UsersRound size={15} className="text-[#F45A0A]" />} onClick={() => handleExecuteAction('/groups?action=new', 'groups', isAr ? 'تذاكر المجموعات' : 'Group Tickets')}>
                {isAr ? 'إضافة مجموعة' : 'New Group Ticket'}
              </Menu.Item>
              <Menu.Item leftSection={<Building2 size={15} className="text-[#F45A0A]" />} onClick={() => handleExecuteAction('/hotels?action=new', 'hotels', isAr ? 'حجوزات الفنادق' : 'Hotel Bookings')}>
                {isAr ? 'حجز فندق' : 'New Hotel Booking'}
              </Menu.Item>
              <Menu.Item leftSection={<RefreshCw size={15} className="text-[#F45A0A]" />} onClick={() => handleExecuteAction('/reissues?action=new', 'reissues', isAr ? 'تغيير التذاكر' : 'Reissues')}>
                {isAr ? 'تغيير تذكرة' : 'Ticket Reissue'}
              </Menu.Item>
              <Menu.Item leftSection={<ArrowDownLeft size={15} className="text-[#F45A0A]" />} onClick={() => handleExecuteAction('/refunds?action=new', 'refunds', isAr ? 'استرجاع التذاكر' : 'Refunds')}>
                {isAr ? 'استرجاع تذكرة' : 'Ticket Refund'}
              </Menu.Item>

              <Menu.Divider />
              <Menu.Label className="text-[11px] font-bold text-slate-400">
                {isAr ? 'السندات والمالية' : 'Finance & Vouchers'}
              </Menu.Label>
              <Menu.Item leftSection={<ArrowDownLeft size={15} className="text-emerald-600" />} onClick={() => handleExecuteAction('/vouchers?type=RECEIPT&action=new', 'vouchers', isAr ? 'سند قبض' : 'Receipt Voucher')}>
                {isAr ? 'إضافة سند قبض' : 'Receipt Voucher'}
              </Menu.Item>
              <Menu.Item leftSection={<ArrowUpRight size={15} className="text-red-600" />} onClick={() => handleExecuteAction('/vouchers?type=PAYMENT&action=new', 'vouchers', isAr ? 'سند دفع' : 'Payment Voucher')}>
                {isAr ? 'إضافة سند دفع' : 'Payment Voucher'}
              </Menu.Item>
              <Menu.Item leftSection={<BookOpen size={15} className="text-blue-600" />} onClick={() => handleExecuteAction('/journal-entries?action=create', 'journal-entries', isAr ? 'قيد يومية' : 'Journal Entry')}>
                {isAr ? 'إضافة سند قيد' : 'Journal Entry'}
              </Menu.Item>
              <Menu.Item leftSection={<ArrowLeftRight size={15} className="text-amber-600" />} onClick={() => handleExecuteAction('/system-settings', 'system-settings', isAr ? 'سند صرافة' : 'Exchange Voucher')}>
                {isAr ? 'إضافة سند صرافة' : 'Exchange Voucher'}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>
      </div>

      {/* ── Applied Filters Indicator Summary Bar (Only when active) ── */}
      {appliedFilterSummary && (
        <div className="bg-white rounded-[10px] border border-[#E5E7EB] px-4 py-2.5 shadow-2xs flex items-center justify-between text-xs text-[#64748B] flex-wrap gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900">{isAr ? 'الفلاتر النشطة:' : 'Active Filters:'}</span>
            <span className="font-mono text-slate-700">{appliedFilterSummary}</span>
          </div>
          <button
            type="button"
            onClick={handleResetFilter}
            className="text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <X size={13} />
            <span>{isAr ? 'مسح الفلاتر' : 'Clear All'}</span>
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          2. FOUR FINANCIAL KPI CARDS (Height 120px, Unified Design System)
         ══════════════════════════════════════════════════════════════ */}
      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:gap-7"
        aria-label={isAr
          ? 'إجمالي المبيعات ناقص إجمالي المشتريات والتكلفة ناقص إجمالي المسترد للعملاء يساوي الربح الصافي'
          : 'Total sales minus total cost minus customer refunds equals net profit'}
      >
        {/* Card 1: Total Sales */}
        <div className="relative bg-white border border-[#E5E7EB] rounded-[14px] p-4 shadow-2xs flex flex-col justify-between h-[120px] hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-slate-800">{isAr ? 'إجمالي المبيعات' : 'Total Sales'}</span>
            <div className="w-[38px] h-[38px] rounded-[10px] bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center shrink-0">
              <Banknote size={20} strokeWidth={1.85} />
            </div>
          </div>
          <div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[11px] font-semibold text-[#64748B] block">{isAr ? 'دولار ($)' : 'USD ($)'}</span>
                <span className="text-[18px] font-black text-[#111827] tabular-nums leading-tight block">
                  ${kpis.salesUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-[#64748B] block">{isAr ? 'دينار (IQD)' : 'IQD'}</span>
                <span className="text-[18px] font-black text-[#111827] tabular-nums leading-tight block">
                  {kpis.salesIQD.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute top-1/2 z-10 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-[18px] font-bold leading-none text-slate-500 shadow-[0_2px_8px_rgba(15,23,42,0.08)] xl:flex ${direction === 'rtl' ? '-left-7' : '-right-7'}`}
          >
            −
          </span>
        </div>

        {/* Card 2: Total Buy Cost */}
        <div className="relative bg-white border border-[#E5E7EB] rounded-[14px] p-4 shadow-2xs flex flex-col justify-between h-[120px] hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-slate-800">{isAr ? 'إجمالي المشتريات والتكلفة' : 'Total Cost'}</span>
            <div className="w-[38px] h-[38px] rounded-[10px] bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center shrink-0">
              <ReceiptText size={20} strokeWidth={1.85} />
            </div>
          </div>
          <div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[11px] font-semibold text-[#64748B] block">{isAr ? 'دولار ($)' : 'USD ($)'}</span>
                <span className="text-[18px] font-black text-[#111827] tabular-nums leading-tight block">
                  ${kpis.buyCostUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-[#64748B] block">{isAr ? 'دينار (IQD)' : 'IQD'}</span>
                <span className="text-[18px] font-black text-[#111827] tabular-nums leading-tight block">
                  {kpis.buyCostIQD.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute top-1/2 z-10 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-[18px] font-bold leading-none text-slate-500 shadow-[0_2px_8px_rgba(15,23,42,0.08)] xl:flex ${direction === 'rtl' ? '-left-7' : '-right-7'}`}
          >
            −
          </span>
        </div>

        {/* Card 3: Total Customer Refunds */}
        <div className="relative bg-white border border-[#E5E7EB] rounded-[14px] p-4 shadow-2xs flex flex-col justify-between h-[120px] hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-slate-800">{isAr ? 'إجمالي المسترد للعملاء' : 'Customer Refunds'}</span>
            <div className="w-[38px] h-[38px] rounded-[10px] bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <RotateCcw size={20} strokeWidth={1.85} />
            </div>
          </div>
          <div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[11px] font-semibold text-[#64748B] block">{isAr ? 'دولار ($)' : 'USD ($)'}</span>
                <span className="text-[18px] font-black text-rose-600 tabular-nums leading-tight block">
                  ${kpis.refundsUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-[#64748B] block">{isAr ? 'دينار (IQD)' : 'IQD'}</span>
                <span className="text-[18px] font-black text-rose-600 tabular-nums leading-tight block">
                  {kpis.refundsIQD.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute top-1/2 z-10 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-orange-200 bg-[#FFF8F1] text-[18px] font-black leading-none text-[#F45A0A] shadow-[0_2px_8px_rgba(244,90,10,0.12)] xl:flex ${direction === 'rtl' ? '-left-7' : '-right-7'}`}
          >
            =
          </span>
        </div>

        {/* Card 4: Net Profit (Equation Result) */}
        <div className="bg-white border border-emerald-200 rounded-[14px] p-4 shadow-2xs flex flex-col justify-between h-[120px] hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-slate-800">{isAr ? 'الربح الصافي' : 'Net Profit'}</span>
            <div className="w-[38px] h-[38px] rounded-[10px] bg-emerald-50 text-[#078B61] flex items-center justify-center shrink-0">
              <TrendingUp size={20} strokeWidth={1.85} />
            </div>
          </div>
          <div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[11px] font-semibold text-[#64748B] block">{isAr ? 'دولار ($)' : 'USD ($)'}</span>
                <span className={`text-[18px] font-black tabular-nums leading-tight block ${kpis.netProfitUSD >= 0 ? 'text-[#078B61]' : 'text-[#DC2626]'}`}>
                  {kpis.netProfitUSD >= 0 ? `+$${kpis.netProfitUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `-$${Math.abs(kpis.netProfitUSD).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-[#64748B] block">{isAr ? 'دينار (IQD)' : 'IQD'}</span>
                <span className={`text-[18px] font-black tabular-nums leading-tight block ${kpis.netProfitIQD >= 0 ? 'text-[#078B61]' : 'text-[#DC2626]'}`}>
                  {kpis.netProfitIQD >= 0 ? `+${kpis.netProfitIQD.toLocaleString()}` : `-${Math.abs(kpis.netProfitIQD).toLocaleString()}`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          3. FOUR MARKET EXCHANGE RATE CARDS (Height 120px, Unified Design System)
         ══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Baghdad Card */}
        <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-4 shadow-2xs flex flex-col justify-between h-[120px] hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-[34px] h-[34px] rounded-[9px] bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center font-bold shrink-0">
                <Activity size={17} strokeWidth={2} />
              </div>
              <span className="text-[13px] font-bold text-slate-800">{isAr ? 'سوق بغداد' : 'Baghdad Market'}</span>
            </div>
            <span className="text-[10.5px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
              {isAr ? 'هامش:' : 'Spread:'} {formatMoney(currentBaghdadSell - currentBaghdadBuy)} IQD
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
            <div>
              <span className="text-[10.5px] text-[#64748B] block">{isAr ? 'شراء' : 'Buy'}</span>
              <span className="text-[15px] font-bold font-mono text-slate-900 tabular-nums">{formatMoney(currentBaghdadBuy)}</span>
            </div>
            <div className="text-left" dir="ltr">
              <span className={`text-[10.5px] text-[#64748B] block ${isAr ? 'text-right' : 'text-left'}`}>{isAr ? 'بيع' : 'Sell'}</span>
              <span className="text-[15px] font-bold font-mono text-[#10B981] tabular-nums">{formatMoney(currentBaghdadSell)}</span>
            </div>
          </div>
        </div>

        {/* Northern Card */}
        <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-4 shadow-2xs flex flex-col justify-between h-[120px] hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-[34px] h-[34px] rounded-[9px] bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center font-bold shrink-0">
                <Building2 size={17} strokeWidth={2} />
              </div>
              <span className="text-[13px] font-bold text-slate-800">{isAr ? 'سوق الشمال (أربيل)' : 'Northern (Erbil)'}</span>
            </div>
            <span className="text-[10.5px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/60">
              {isAr ? 'هامش:' : 'Spread:'} {formatMoney(currentNorthSell - currentNorthBuy)} IQD
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
            <div>
              <span className="text-[10.5px] text-[#64748B] block">{isAr ? 'شراء' : 'Buy'}</span>
              <span className="text-[15px] font-bold font-mono text-slate-900 tabular-nums">{formatMoney(currentNorthBuy)}</span>
            </div>
            <div className="text-left" dir="ltr">
              <span className={`text-[10.5px] text-[#64748B] block ${isAr ? 'text-right' : 'text-left'}`}>{isAr ? 'بيع' : 'Sell'}</span>
              <span className="text-[15px] font-bold font-mono text-[#3B82F6] tabular-nums">{formatMoney(currentNorthSell)}</span>
            </div>
          </div>
        </div>

        {/* Southern Card */}
        <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-4 shadow-2xs flex flex-col justify-between h-[120px] hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-[34px] h-[34px] rounded-[9px] bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center font-bold shrink-0">
                <Building2 size={17} strokeWidth={2} />
              </div>
              <span className="text-[13px] font-bold text-slate-800">{isAr ? 'سوق الجنوب (البصرة)' : 'Southern (Basra)'}</span>
            </div>
            <span className="text-[10.5px] font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200/60">
              {isAr ? 'هامش:' : 'Spread:'} {formatMoney(currentSouthSell - currentSouthBuy)} IQD
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
            <div>
              <span className="text-[10.5px] text-[#64748B] block">{isAr ? 'شراء' : 'Buy'}</span>
              <span className="text-[15px] font-bold font-mono text-slate-900 tabular-nums">{formatMoney(currentSouthBuy)}</span>
            </div>
            <div className="text-left" dir="ltr">
              <span className={`text-[10.5px] text-[#64748B] block ${isAr ? 'text-right' : 'text-left'}`}>{isAr ? 'بيع' : 'Sell'}</span>
              <span className="text-[15px] font-bold font-mono text-[#8B5CF6] tabular-nums">{formatMoney(currentSouthSell)}</span>
            </div>
          </div>
        </div>

        {/* System Adopted Rate Card */}
        <div className="bg-white border border-[#FED7AA] bg-orange-50/15 rounded-[14px] p-4 shadow-2xs flex flex-col justify-between h-[120px] hover:border-orange-300 transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-[34px] h-[34px] rounded-[9px] bg-[#FFF3E8] text-[#F45A0A] border border-orange-200/60 flex items-center justify-center font-bold shrink-0">
                <Scale size={17} strokeWidth={2} />
              </div>
              <span className="text-[13px] font-bold text-[#C2410C]">{isAr ? 'السعر المعتمد للنظام' : 'System Adopted Rate'}</span>
            </div>
            <span className="text-[10.5px] font-mono font-bold text-[#C2410C] bg-orange-100/80 px-2 py-0.5 rounded-md border border-orange-200/60">
              {isAr ? 'مرجع:' : 'Ref:'} {formatMoney(baseAdoptedRate)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-orange-100">
            <div>
              <span className="text-[10.5px] text-[#64748B] block">{isAr ? 'المرجع المالي' : 'Base Rate'}</span>
              <span className="text-[15px] font-bold font-mono text-slate-900 tabular-nums">{formatMoney(baseAdoptedRate)}</span>
            </div>
            <div className="text-left" dir="ltr">
              <span className={`text-[10.5px] text-[#64748B] block ${isAr ? 'text-right' : 'text-left'}`}>{isAr ? 'المعتمد الفعلي' : 'Actual Adopted'}</span>
              <span className="text-[17px] font-black font-mono text-[#F97316] tabular-nums">{formatMoney(adoptedRate)} <span className="text-[10px] font-mono font-normal text-slate-500">IQD</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          4. CENTRAL FINANCIAL CHARTS: TREND CHART + RATE SPREAD & SAFETY MARGIN DONUT
         ══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left / Main Trend Chart (8 Cols) */}
        <div className="lg:col-span-8 bg-white rounded-[14px] border border-[#E5E7EB] p-4 shadow-2xs space-y-3 flex flex-col justify-between">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between border-b border-slate-100 pb-2.5 gap-3">
            <div className="flex items-center gap-2">
              <LucideLineChart size={17} className="text-[#F45A0A]" />
              <div>
                <h2 className="text-[14px] font-bold text-slate-900 leading-tight">
                  {isAr ? 'المخطط المالي ومقارنة أسعار الصرف' : 'Financial Trend & Exchange Rates Chart'}
                </h2>
                <span className="text-[11.5px] text-[#64748B]">
                  {isAr ? 'عرض وتتبع تحركات الأسعار الفعلية والانحراف المالي' : 'Real-time exchange tracking and financial deviations'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
                {[
                  { id: 'TODAY', label: isAr ? 'اليوم' : 'Today' },
                  { id: 'WEEK', label: isAr ? 'الأسبوع' : 'Week' },
                  { id: 'MONTH', label: isAr ? 'الشهر' : 'Month' },
                  { id: 'YEAR', label: isAr ? 'السنة' : 'Year' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setExchangeChartPeriod(item.id as ExchangeChartPeriod)}
                    className={`h-7 px-3 rounded-lg text-[11px] font-bold transition-all ${
                      exchangeChartPeriod === item.id
                        ? 'bg-[#F45A0A] text-white shadow-xs'
                        : 'text-slate-600 hover:bg-white hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="text-xs text-slate-500 font-mono whitespace-nowrap">
                {isAr ? `آخر مزامنة: ${lastSyncTime || '—'}` : `Last sync: ${lastSyncTime || '—'}`}
              </div>
            </div>
          </div>

          <div className="w-full h-[330px]">
            <Suspense fallback={<div className="h-full w-full animate-pulse rounded-md bg-slate-100" />}>
              <ReactECharts option={chartOption} style={{ height: '100%', width: '100%' }} notMerge={true} lazyUpdate={true} />
            </Suspense>
          </div>
        </div>

        {/* Right / Donut Rate Spread & Safety Margin Profit Chart (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-[18px] border border-slate-200/80 p-4 shadow-2xs flex flex-col justify-between overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-orange-50 text-[#F45A0A] border border-orange-100 flex items-center justify-center">
                <TrendingUp size={16} />
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-slate-900 leading-tight">
                  {isAr ? 'أرباح فرق السعر وهامش الأمان' : 'Spread Profit & Safety Margin'}
                </h3>
                <span className="text-[11.5px] text-[#64748B]">
                  {isAr ? 'أرباح فرق السعر المعتمد وسعر السوق المستهدف' : 'Gain between adopted rate & target market'}
                </span>
              </div>
            </div>
          </div>

          {/* Donut Chart */}
          <div className="w-full h-[245px] relative my-2 rounded-2xl bg-gradient-to-b from-slate-50/80 to-white border border-slate-100/80">
            <Suspense fallback={<div className="h-full w-full animate-pulse rounded-md bg-slate-100" />}>
              <ReactECharts option={donutChartOption} style={{ height: '100%', width: '100%' }} notMerge={true} lazyUpdate={true} />
            </Suspense>
          </div>

          {/* Quick Metrics Breakdown Footnotes */}
          <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 bg-orange-50/70 rounded-xl border border-orange-100/90">
              <span className="text-[10.5px] text-[#C2410C] font-semibold block">
                {isAr ? 'هامش الأمان المضاف' : 'Safety Margin'}
              </span>
              <span className="text-[13px] font-bold font-mono text-slate-900 tabular-nums">
                +{adoptedRate - baseAdoptedRate} <span className="text-[10px] font-normal text-slate-500">{isAr ? 'د.ع/$' : 'IQD/$'}</span>
              </span>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10.5px] text-slate-600 font-semibold block">
                {isAr ? 'سعر السوق المستهدف' : 'Target Market'}
              </span>
              <span className="text-[13px] font-bold font-mono text-slate-900 tabular-nums">
                {formatMoney(baseAdoptedRate)} <span className="text-[10px] font-normal text-slate-500">{isAr ? 'د.ع' : 'IQD'}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          5. TOURISM SERVICES PERFORMANCE (4 Clean Cards)
         ══════════════════════════════════════════════════════════════ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Layers size={17} className="text-[#F45A0A]" />
            <h2 className="text-[14px] font-bold text-slate-900">
              {isAr ? 'أداء الخدمات السياحية والتذاكر' : 'Services & Tickets Performance'}
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Flight Tickets */}
          <div
            onClick={() => handleExecuteAction('/tickets', 'tickets', isAr ? 'تذاكر الطيران' : 'Flight Tickets')}
            className="bg-white border border-[#E5E7EB] rounded-[14px] p-4 flex flex-col justify-between hover:border-orange-300 transition-all cursor-pointer shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-[36px] h-[36px] rounded-[10px] bg-orange-50 text-[#F45A0A] flex items-center justify-center shrink-0 font-bold">
                  <PlaneTakeoff size={18} />
                </div>
                <div>
                  <div className="text-[13px] font-bold text-slate-900">{isAr ? 'تذاكر الطيران' : 'Flight Tickets'}</div>
                  <div className="text-[11px] text-slate-400 font-mono">{servicesData.tickets.count} {isAr ? 'عملية' : 'ops'}</div>
                </div>
              </div>
              <ChevronLeft size={16} className={`text-slate-300 ${direction === 'ltr' ? 'rotate-180' : ''}`} />
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-1 text-xs font-mono">
              <div className="flex items-center justify-between text-slate-600">
                <span className="font-sans text-[11px]">{isAr ? 'المبيعات:' : 'Sales:'}</span>
                <span className="font-bold text-slate-900">${formatMoney(servicesData.tickets.salesUSD)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="font-sans text-[11px]">{isAr ? 'صافي الربح:' : 'Profit:'}</span>
                <span className="font-bold text-emerald-700">+${formatMoney(servicesData.tickets.profitUSD)}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Group Tickets */}
          <div
            onClick={() => handleExecuteAction('/groups', 'groups', isAr ? 'تذاكر المجموعات' : 'Group Tickets')}
            className="bg-white border border-[#E5E7EB] rounded-[14px] p-4 flex flex-col justify-between hover:border-orange-300 transition-all cursor-pointer shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-[36px] h-[36px] rounded-[10px] bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 font-bold">
                  <UsersRound size={18} />
                </div>
                <div>
                  <div className="text-[13px] font-bold text-slate-900">{isAr ? 'تذاكر المجموعات' : 'Group Tickets'}</div>
                  <div className="text-[11px] text-slate-400 font-mono">0 {isAr ? 'عملية' : 'ops'}</div>
                </div>
              </div>
              <ChevronLeft size={16} className={`text-slate-300 ${direction === 'ltr' ? 'rotate-180' : ''}`} />
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-1 text-xs font-mono">
              <div className="flex items-center justify-between text-slate-600">
                <span className="font-sans text-[11px]">{isAr ? 'المبيعات:' : 'Sales:'}</span>
                <span className="font-bold text-slate-900">$0.00</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="font-sans text-[11px]">{isAr ? 'صافي الربح:' : 'Profit:'}</span>
                <span className="font-bold text-slate-900">$0.00</span>
              </div>
            </div>
          </div>

          {/* Card 3: Visas */}
          <div
            onClick={() => handleExecuteAction('/visas', 'visas', isAr ? 'الفيزا والتأشيرات' : 'Visas')}
            className="bg-white border border-[#E5E7EB] rounded-[14px] p-4 flex flex-col justify-between hover:border-orange-300 transition-all cursor-pointer shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-[36px] h-[36px] rounded-[10px] bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 font-bold">
                  <LucideBadgeCheck size={18} />
                </div>
                <div>
                  <div className="text-[13px] font-bold text-slate-900">{isAr ? 'الفيزا والتأشيرات' : 'Visas'}</div>
                  <div className="text-[11px] text-slate-400 font-mono">0 {isAr ? 'عملية' : 'ops'}</div>
                </div>
              </div>
              <ChevronLeft size={16} className={`text-slate-300 ${direction === 'ltr' ? 'rotate-180' : ''}`} />
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-1 text-xs font-mono">
              <div className="flex items-center justify-between text-slate-600">
                <span className="font-sans text-[11px]">{isAr ? 'المبيعات:' : 'Sales:'}</span>
                <span className="font-bold text-slate-900">$0.00</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="font-sans text-[11px]">{isAr ? 'صافي الربح:' : 'Profit:'}</span>
                <span className="font-bold text-slate-900">$0.00</span>
              </div>
            </div>
          </div>

          {/* Card 4: Hotels */}
          <div
            onClick={() => handleExecuteAction('/hotels', 'hotels', isAr ? 'حجوزات الفنادق' : 'Hotels')}
            className="bg-white border border-[#E5E7EB] rounded-[14px] p-4 flex flex-col justify-between hover:border-orange-300 transition-all cursor-pointer shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-[36px] h-[36px] rounded-[10px] bg-purple-50 text-purple-700 flex items-center justify-center shrink-0 font-bold">
                  <Building2 size={18} />
                </div>
                <div>
                  <div className="text-[13px] font-bold text-slate-900">{isAr ? 'حجوزات الفنادق' : 'Hotel Bookings'}</div>
                  <div className="text-[11px] text-slate-400 font-mono">0 {isAr ? 'عملية' : 'ops'}</div>
                </div>
              </div>
              <ChevronLeft size={16} className={`text-slate-300 ${direction === 'ltr' ? 'rotate-180' : ''}`} />
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-1 text-xs font-mono">
              <div className="flex items-center justify-between text-slate-600">
                <span className="font-sans text-[11px]">{isAr ? 'المبيعات:' : 'Sales:'}</span>
                <span className="font-bold text-slate-900">$0.00</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="font-sans text-[11px]">{isAr ? 'صافي الربح:' : 'Profit:'}</span>
                <span className="font-bold text-slate-900">$0.00</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          6. RECENT FINANCIAL OPERATIONS & VOUCHERS TABLE
         ══════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <FileText size={17} className="text-[#F45A0A]" />
            <h2 className="text-[14px] font-bold text-slate-900">
              {isAr ? 'أحدث السندات والعمليات المالية' : 'Recent Financial Operations & Vouchers'}
            </h2>
          </div>
        </div>

        {recentOperations.length === 0 ? (
          <div className="h-[140px] flex flex-col items-center justify-center text-center text-xs text-slate-400 gap-1.5">
            <FileText size={22} className="text-slate-300" />
            <span>{isAr ? 'لا توجد سندات مسجلة خلال هذه الفترة' : 'No vouchers recorded for this period'}</span>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[10px] border border-[#E5E7EB]">
            <table className={`w-full text-${direction === 'rtl' ? 'right' : 'left'} border-collapse text-[13px]`}>
              <thead>
                <tr className="h-[44px] bg-[#F8FAFC] border-b border-[#E5E7EB] text-[#475569] font-semibold text-[12.5px]">
                  <th className="px-3.5 py-2 whitespace-nowrap">{isAr ? 'رقم السند' : 'Voucher #'}</th>
                  <th className="px-3.5 py-2 whitespace-nowrap">{isAr ? 'النوع' : 'Type'}</th>
                  <th className="px-3.5 py-2 whitespace-nowrap">{isAr ? 'التاريخ' : 'Date'}</th>
                  <th className="px-3.5 py-2 whitespace-nowrap">{isAr ? 'الطرف / الحساب' : 'Party / Account'}</th>
                  <th className="px-3.5 py-2 whitespace-nowrap">{isAr ? 'المبلغ' : 'Amount'}</th>
                  <th className="px-3.5 py-2 whitespace-nowrap">{isAr ? 'الموظف' : 'User'}</th>
                  <th className="px-3.5 py-2 whitespace-nowrap">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="px-3.5 py-2 whitespace-nowrap text-center w-14">{isAr ? 'عرض' : 'View'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {recentOperations.map((op, idx) => (
                  <tr key={`${op.id}-${idx}`} className="h-[56px] hover:bg-[#FFFDFC] transition-colors">
                    <td className="px-3.5 py-2.5 font-mono font-bold text-slate-900 text-[13px]">{op.id}</td>
                    <td className="px-3.5 py-2.5 font-semibold text-slate-700 text-xs">{op.type}</td>
                    <td className="px-3.5 py-2.5 font-mono text-slate-500 text-xs">
                      {op.date ? new Date(op.date).toLocaleDateString('en-GB') : '—'}
                    </td>
                    <td className="px-3.5 py-2.5 font-medium text-slate-800 text-xs truncate max-w-[180px]">{op.party}</td>
                    <td className="px-3.5 py-2.5 font-mono font-bold text-slate-900 text-xs" dir="ltr">
                      {formatMoney(op.debit)} {op.currency}
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-600 text-xs">{op.employee}</td>
                    <td className="px-3.5 py-2.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {op.status}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleExecuteAction(op.path, op.category?.toLowerCase() || 'vouchers', op.type)}
                        className="p-1 rounded-md hover:bg-slate-100 text-slate-500 hover:text-[#F45A0A] transition-colors cursor-pointer"
                        title={isAr ? 'عرض السند' : 'View Voucher'}
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          7. UNIFIED FILTER MODAL / SHEET (Centralized Filtering)
         ══════════════════════════════════════════════════════════════ */}
      <Modal
        opened={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <div className="w-[30px] h-[30px] rounded-[8px] bg-orange-50 text-[#F45A0A] flex items-center justify-center">
              <Filter size={16} />
            </div>
            <span className="font-bold text-[16px] text-slate-900">
              {isAr ? 'تصفية بيانات لوحة التحكم' : 'Filter Dashboard Data'}
            </span>
          </div>
        }
        centered
        size="lg"
        radius="14px"
        dir={direction}
      >
        <div className="space-y-4 py-2 text-xs" dir={direction}>
          {/* Section 1: Period Selection */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 block">{isAr ? 'الفترة الزمنية:' : 'Time Period:'}</label>
            <div className="h-[42px] bg-[#F3F4F6] border border-[#E5E7EB] p-[3px] rounded-[10px] flex items-center gap-1">
              {[
                { id: 'ALL', label: isAr ? 'الكل' : 'All' },
                { id: 'TODAY', label: isAr ? 'اليوم' : 'Today' },
                { id: 'WEEK', label: isAr ? 'هذا الأسبوع' : 'Week' },
                { id: 'MONTH', label: isAr ? 'هذا الشهر' : 'Month' },
                { id: '3MONTHS', label: isAr ? '3 أشهر' : '3 Months' },
                { id: 'YEAR', label: isAr ? 'سنة' : 'Year' },
                { id: 'CUSTOM', label: isAr ? 'مخصص' : 'Custom' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTempFilters((prev) => ({ ...prev, datePreset: item.id as any }))}
                  className={`flex-1 h-full rounded-[8px] text-[12px] font-semibold transition-all cursor-pointer ${
                    tempFilters.datePreset === item.id
                      ? 'bg-white text-[#C2410C] border border-[#FED7AA] shadow-2xs font-bold'
                      : 'bg-transparent text-[#64748B] hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Optional Date Picker for CUSTOM Period */}
          {tempFilters.datePreset === 'CUSTOM' && (
            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100">
              <div>
                <span className="text-slate-500 font-bold block mb-1">{isAr ? 'من تاريخ:' : 'From Date:'}</span>
                <SegmentedDatePicker
                  value={tempFilters.dateFrom}
                  onChange={(d) => setTempFilters((prev) => ({ ...prev, dateFrom: d }))}
                  placeholder={isAr ? 'من تاريخ' : 'From Date'}
                  clearable={true}
                />
              </div>
              <div>
                <span className="text-slate-500 font-bold block mb-1">{isAr ? 'إلى تاريخ:' : 'To Date:'}</span>
                <SegmentedDatePicker
                  value={tempFilters.dateTo}
                  onChange={(d) => setTempFilters((prev) => ({ ...prev, dateTo: d }))}
                  placeholder={isAr ? 'إلى تاريخ' : 'To Date'}
                  clearable={true}
                />
              </div>
            </div>
          )}

          {/* Section 2: Operation Type & Branch */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1.5">{isAr ? 'نوع العملية:' : 'Operation Type:'}</label>
              <SearchableCombobox
                value={tempFilters.operationType}
                onChange={(val) => setTempFilters((prev) => ({ ...prev, operationType: val as any }))}
                options={[
                  { value: 'ALL', label: isAr ? 'جميع العمليات' : 'All Operations' },
                  { value: 'TICKETS', label: isAr ? 'تذاكر الطيران' : 'Flight Tickets' },
                  { value: 'VISAS', label: isAr ? 'التأشيرات والفيز' : 'Visas' },
                  { value: 'GROUPS', label: isAr ? 'تذاكر المجموعات' : 'Group Tickets' },
                  { value: 'HOTELS', label: isAr ? 'حجوزات الفنادق' : 'Hotels' },
                  { value: 'REISSUES', label: isAr ? 'تغيير التذاكر' : 'Reissues' },
                  { value: 'REFUNDS', label: isAr ? 'استرجاع التذاكر' : 'Refunds' },
                  { value: 'VOUCHERS', label: isAr ? 'السندات والقيود' : 'Vouchers & Entries' },
                ]}
                placeholder={isAr ? 'نوع العملية' : 'Operation Type'}
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1.5">{isAr ? 'الفرع:' : 'Branch:'}</label>
              <SearchableCombobox
                value={tempFilters.branch}
                onChange={(val) => setTempFilters((prev) => ({ ...prev, branch: val }))}
                options={branchOptions}
                placeholder={isAr ? 'الفرع' : 'Branch'}
              />
            </div>
          </div>

          {/* Section 3: Market & Currency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1.5">{isAr ? 'السوق:' : 'Market:'}</label>
              <SearchableCombobox
                value={tempFilters.market}
                onChange={(val) => setTempFilters((prev) => ({ ...prev, market: val as any }))}
                options={[
                  { value: 'ALL', label: isAr ? 'جميع الأسواق' : 'All Markets' },
                  { value: 'BAGHDAD', label: isAr ? 'سوق بغداد (الكفاح / الحارثية)' : 'Baghdad Market' },
                  { value: 'NORTH', label: isAr ? 'سوق الشمال (أربيل / السليمانية)' : 'Northern Market' },
                  { value: 'SOUTH', label: isAr ? 'سوق الجنوب (البصرة)' : 'Southern Market' },
                ]}
                placeholder={isAr ? 'السوق' : 'Market'}
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1.5">{isAr ? 'العملة:' : 'Currency:'}</label>
              <CurrencySegmentedControl
                value={tempFilters.currency}
                onChange={(c) => setTempFilters((prev) => ({ ...prev, currency: c as any }))}
                showAllOption={true}
                showLabel={false}
                height="h-[42px]"
              />
            </div>
          </div>

          {/* Section 4: Price Type & Chart Style */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1.5">{isAr ? 'نوع السعر:' : 'Price Type:'}</label>
              <div className="h-[42px] bg-[#F3F4F6] border border-[#E5E7EB] p-[3px] rounded-[10px] flex items-center gap-1">
                {[
                  { id: 'BUY', label: isAr ? 'سعر الشراء' : 'Buy Price' },
                  { id: 'SELL', label: isAr ? 'سعر البيع' : 'Sell Price' },
                  { id: 'MID', label: isAr ? 'المتوسط' : 'Mid / Avg' },
                ].map((pt) => (
                  <button
                    key={pt.id}
                    type="button"
                    onClick={() => setTempFilters((prev) => ({ ...prev, priceType: pt.id as any }))}
                    className={`flex-1 h-full rounded-[8px] text-[12px] font-semibold transition-all cursor-pointer ${
                      tempFilters.priceType === pt.id
                        ? 'bg-white text-[#C2410C] border border-[#FED7AA] shadow-2xs font-bold'
                        : 'bg-transparent text-[#64748B] hover:text-slate-900'
                    }`}
                  >
                    {pt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1.5">{isAr ? 'طريقة عرض المخطط:' : 'Chart View:'}</label>
              <SearchableCombobox
                value={tempFilters.chartType}
                onChange={(val) => setTempFilters((prev) => ({ ...prev, chartType: val as any }))}
                options={[
                  { value: 'LINE', label: isAr ? 'خطي (انحناء سلس)' : 'Line (Smooth)' },
                  { value: 'AREA', label: isAr ? 'مساحة متدرجة' : 'Gradient Area' },
                  { value: 'RANGE', label: isAr ? 'نطاق الأسعار' : 'Price Range Channel' },
                  { value: 'DEVIATION', label: isAr ? 'الفارق عن السعر المعتمد' : 'Adopted Deviation' },
                  ...(hasRealOHLC ? [{ value: 'CANDLESTICK', label: isAr ? 'الشموع اليابانية' : 'Candlestick' }] : []),
                ]}
                placeholder={isAr ? 'عرض المخطط' : 'Chart View'}
              />
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleResetFilter}
              className="h-[42px] px-4 rounded-[9px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[13px] transition-colors cursor-pointer"
            >
              {isAr ? 'إعادة التعيين' : 'Reset to Defaults'}
            </button>
            <button
              type="button"
              onClick={handleApplyFilter}
              className="h-[42px] px-6 rounded-[9px] bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-semibold text-[13px] shadow-xs transition-colors cursor-pointer"
            >
              {isAr ? 'تطبيق الفلتر' : 'Apply Filter'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DashboardPage;
