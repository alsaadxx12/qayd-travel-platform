import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Users,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Armchair,
  CheckCircle2,
  Clock,
  Coins,
  TrendingUp,
  Lock,
  Unlock,
  FolderOpen,
  LayoutGrid,
  List,
  MapPin,
  Calendar,
  DollarSign,
  Filter,
  ArrowUpRight,
  Check,
  Receipt,
  User,
} from 'lucide-react';
import { Loader, Modal, Tooltip } from '@mantine/core';
import { GroupFileWorkspace } from '../../components/groups/GroupFileWorkspace';
import { matchesSearchTokens } from '../../components/ui/SearchableCombobox';
import { tourGroupsApi, type TourGroup } from '../../api/tourGroups';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { useLanguageStore } from '../../store/useLanguageStore';

const fmt = (n: number) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const money = (n: number, c: string) => `${fmt(n)} ${c === 'USD' ? '$' : 'IQD'}`;

const getBeneficiariesCount = (g: TourGroup) => {
  if (g.summary?.beneficiariesCount !== undefined && g.summary.beneficiariesCount > 0) {
    return g.summary.beneficiariesCount;
  }
  const set = new Set<string>();
  (g.passengers || []).forEach((p) => {
    const k = p.customerAccountId || (p.customerName || '').trim().toLowerCase();
    if (k) set.add(k);
  });
  return set.size || (g.passengers?.length > 0 ? 1 : 0);
};

const getUnitBuyPrice = (g: TourGroup) => {
  if (g.summary?.unitBuyPrice !== undefined && g.summary.unitBuyPrice > 0) return g.summary.unitBuyPrice;
  const activePs = g.priceSystems?.find((ps) => ps.active !== false) || g.priceSystems?.[0];
  if (activePs?.items && activePs.items.length > 0) {
    return activePs.items.reduce((acc, it) => acc + Number(it.expectedBuy || 0), 0);
  }
  return 0;
};

const getTotalBuyCost = (g: TourGroup) => {
  const s = g.summary;
  if (s?.actualCost && s.actualCost > 0) return s.actualCost;
  if (s?.plannedCost && s.plannedCost > 0) return s.plannedCost;
  const unit = getUnitBuyPrice(g);
  return unit * (g.passengers?.length || 0);
};

const getProfit = (g: TourGroup) => {
  const totalBuy = getTotalBuyCost(g);
  return Number(g.summary?.sales || 0) - totalBuy;
};

export const GroupsPage: React.FC = () => {
  const location = useLocation();
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  const [rows, setRows] = useState<TourGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');
  const [currencyFilter, setCurrencyFilter] = useState<'ALL' | 'USD' | 'IQD'>('ALL');
  const [viewMode, setViewMode] = useState<'CARDS' | 'TABLE'>('TABLE');

  const [fileOpen, setFileOpen] = useState(false);
  const [fileGroupId, setFileGroupId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TourGroup | null>(null);
  const [deleting, setDeleting] = useState(false);

  // فتح ملف الكروب تلقائياً عند التوجيه من كشف الحساب
  useEffect(() => {
    const openId = (location.state as any)?.openGroupId;
    if (openId) {
      setFileGroupId(openId);
      setFileOpen(true);
    }
  }, [location.state]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await tourGroupsApi.list();
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      showErrorNotification(isAr ? 'تعذّر جلب الكروبات' : 'Load failed', e?.message || '');
    } finally {
      setLoading(false);
    }
  }, [isAr]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    let result = rows;

    // Status filter
    if (statusFilter === 'OPEN') {
      result = result.filter((g) => g.openSale);
    } else if (statusFilter === 'CLOSED') {
      result = result.filter((g) => !g.openSale);
    }

    // Currency filter
    if (currencyFilter !== 'ALL') {
      result = result.filter((g) => g.currency === currencyFilter);
    }

    // Search query
    const q = search.trim();
    if (q) {
      result = result.filter((g) =>
        matchesSearchTokens(q, [g.groupName, g.country || '', ...g.passengers.map((p) => p.passengerName)].join(' ')),
      );
    }

    return result;
  }, [rows, search, statusFilter, currencyFilter]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (a, g) => ({
          groups: a.groups + 1,
          sold: a.sold + g.summary.sold,
          seats: a.seats + g.summary.seats,
          sales: a.sales + g.summary.sales,
          collected: a.collected + (g.summary.collected || 0),
          cost: a.cost + (g.summary.actualCost || 0),
          outstanding: a.outstanding + g.summary.outstanding,
          profit: a.profit + g.summary.actualProfit,
        }),
        { groups: 0, sold: 0, seats: 0, sales: 0, collected: 0, cost: 0, outstanding: 0, profit: 0 },
      ),
    [rows],
  );

  const openCount = useMemo(() => rows.filter((g) => g.openSale).length, [rows]);
  const closedCount = useMemo(() => rows.filter((g) => !g.openSale).length, [rows]);

  const openFile = (id: string | null) => {
    setFileGroupId(id);
    setFileOpen(true);
  };

  return (
    <div className="min-h-full bg-[#F8FAFC] font-sans pb-10" dir={direction}>
      <div className="max-w-[1540px] mx-auto w-full px-4 sm:px-6 py-4 space-y-4">
        
        {/* ── 1. الترويسة الرئيسية للنظام ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-orange-50 border border-orange-200/80 text-[#F45A0A] flex items-center justify-center shadow-2xs shrink-0">
              <Users size={22} strokeWidth={2.4} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="font-black text-base sm:text-lg text-slate-900 leading-none">
                  {isAr ? 'تذاكر الكروبات والسياحة' : 'Tour Groups & Travel'}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-orange-50 text-[#F45A0A] border border-orange-200/70 font-mono" dir="ltr">
                  {rows.length}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-500 mt-1">
                {isAr
                  ? 'إدارة الكروبات السياحية والمسافرين والمتابعة المالية'
                  : 'Manage tour groups, passengers and financial tracking'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Tooltip label={isAr ? 'تحديث البيانات' : 'Refresh'}>
              <button
                type="button"
                onClick={() => load()}
                className="h-[38px] w-[38px] rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-[#F45A0A] hover:border-orange-300 hover:bg-orange-50/40 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              </button>
            </Tooltip>
            <button
              type="button"
              onClick={() => openFile(null)}
              className="h-[38px] px-4 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] active:scale-[0.98] text-white font-black text-xs shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>{isAr ? 'إنشاء كروب جديد' : 'New Tour Group'}</span>
            </button>
          </div>
        </div>

        {/* ── 2. بطاقات المؤشرات المالية والتشغيلية (KPIs) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* بطاقة 1: الكروبات */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-col justify-between hover:border-orange-200 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">{isAr ? 'الكروبات' : 'Groups'}</span>
              <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#F45A0A] flex items-center justify-center border border-orange-100">
                <Users size={16} />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-black text-slate-900 font-mono tracking-tight" dir="ltr">
                {totals.groups}
              </div>
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mt-1">
                <span>{isAr ? 'المسافرون' : 'Pax'}</span>
                <span className="font-mono text-[#F45A0A] font-black" dir="ltr">
                  {totals.sold}
                </span>
              </div>
            </div>
          </div>

          {/* بطاقة 2: المبيعات */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-col justify-between hover:border-orange-200 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">{isAr ? 'المبيعات' : 'Sales'}</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                <Coins size={16} />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-black text-slate-900 font-mono tracking-tight" dir="ltr">
                ${fmt(totals.sales)}
              </div>
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mt-1">
                <span>{isAr ? 'المحصّل' : 'Collected'}</span>
                <span className="font-mono text-emerald-700 font-black" dir="ltr">
                  ${fmt(totals.collected)}
                </span>
              </div>
            </div>
          </div>

          {/* بطاقة 3: التكلفة الفعلية */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-col justify-between hover:border-orange-200 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">{isAr ? 'التكلفة الفعلية' : 'Actual Cost'}</span>
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200">
                <Receipt size={16} />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-black text-slate-900 font-mono tracking-tight" dir="ltr">
                ${fmt(totals.cost)}
              </div>
              <div className="text-[11px] font-bold text-slate-500 mt-1">
                {isAr ? 'إجمالي تكاليف الكروبات' : 'Total group costs'}
              </div>
            </div>
          </div>

          {/* بطاقة 4: الذمم غير المحصلة */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-col justify-between hover:border-orange-200 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">{isAr ? 'الذمم' : 'Outstanding'}</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                <Clock size={16} />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-black text-amber-700 font-mono tracking-tight" dir="ltr">
                ${fmt(totals.outstanding)}
              </div>
              <div className="text-[11px] font-bold text-amber-700/80 mt-1">
                {isAr ? 'قيد التحصيل' : 'Pending'}
              </div>
            </div>
          </div>

          {/* بطاقة 5: صافي الربح الفعلي */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-col justify-between hover:border-orange-200 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">{isAr ? 'صافي الربح' : 'Net Profit'}</span>
              <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#F45A0A] flex items-center justify-center border border-orange-100">
                <TrendingUp size={16} />
              </div>
            </div>
            <div className="mt-2">
              <div
                className={`text-2xl font-black font-mono tracking-tight ${
                  totals.profit >= 0 ? 'text-[#F45A0A]' : 'text-rose-600'
                }`}
                dir="ltr"
              >
                ${fmt(totals.profit)}
              </div>
              <div className="text-[11px] font-bold text-slate-500 mt-1">
                {isAr ? 'الربح الفعلي' : 'Actual profit'}
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. شريط أدوات البحث والتصفية والعرض ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 flex-1 min-w-[260px]">
            {/* حقل البحث */}
            <div className="relative flex-1 max-w-[420px]">
              <Search
                size={15}
                className={`absolute top-1/2 -translate-y-1/2 text-slate-400 ${
                  direction === 'rtl' ? 'right-3' : 'left-3'
                }`}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isAr ? 'بحث باسم الكروب، الوجهة، أو اسم مسافر…' : 'Search group, destination, or passenger…'}
                className={`w-full h-[38px] rounded-xl bg-slate-50 focus:bg-white border border-slate-200 text-xs font-bold text-slate-900 outline-none focus:border-[#F45A0A] focus:ring-1 focus:ring-orange-100 transition-all ${
                  direction === 'rtl' ? 'pr-9 pl-3' : 'pl-9 pr-3'
                }`}
              />
            </div>

            {/* فلتر حالة البيع */}
            <div className="flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200/80 text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  statusFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isAr ? `الكل (${rows.length})` : `All (${rows.length})`}
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('OPEN')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'OPEN'
                    ? 'bg-emerald-500 text-white shadow-2xs'
                    : 'text-emerald-700 hover:text-emerald-900'
                }`}
              >
                <Unlock size={12} />
                <span>{isAr ? `مفتوح (${openCount})` : `Open (${openCount})`}</span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('CLOSED')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'CLOSED'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-amber-700 hover:text-amber-900'
                }`}
              >
                <Lock size={12} />
                <span>{isAr ? `مقفل (${closedCount})` : `Closed (${closedCount})`}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* تبديل طريقة العرض */}
            <div className="flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200/80">
              <button
                type="button"
                onClick={() => setViewMode('CARDS')}
                title={isAr ? 'عرض البطاقات' : 'Cards view'}
                className={`h-[30px] px-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'CARDS'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <LayoutGrid size={14} />
                <span className="hidden sm:inline">{isAr ? 'بطاقات' : 'Cards'}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('TABLE')}
                title={isAr ? 'عرض الجدول' : 'Table view'}
                className={`h-[30px] px-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'TABLE'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <List size={14} />
                <span className="hidden sm:inline">{isAr ? 'جدول' : 'Table'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── 4. المحتوى: تحميل، فارغ، أو قائمة البيانات ── */}
        {loading && rows.length === 0 ? (
          <div className="py-24 bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center gap-3 text-xs font-bold text-slate-500">
            <Loader size="sm" color="orange" />
            <span>{isAr ? 'جارٍ تحميل ملفات الكروبات والسياحة…' : 'Loading tour groups…'}</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 bg-white rounded-xl border border-slate-200 text-center space-y-2.5 p-6">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#F45A0A] mx-auto flex items-center justify-center border border-orange-200/70">
              <Users size={24} />
            </div>
            <p className="text-sm font-black text-slate-800">
              {isAr ? 'لا توجد كروبات سياحية مطابقة' : 'No tour groups found'}
            </p>
            <p className="text-xs font-bold text-slate-400 max-w-md mx-auto">
              {isAr
                ? 'يمكنك إنشاء كروب جديد، ضبط المقاعد وأنظمة الأسعار والخدمات، وفتح البيع للمسافرين.'
                : 'Create a new group file, configure seat allocation, price systems, and start selling.'}
            </p>
            <button
              type="button"
              onClick={() => openFile(null)}
              className="mt-2 h-[36px] px-4 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Plus size={15} strokeWidth={2.4} />
              <span>{isAr ? 'إنشاء كروب الآن' : 'Create Group Now'}</span>
            </button>
          </div>
        ) : viewMode === 'TABLE' ? (
          /* ── عرض الجدول المحاسبي المنظم ── */
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse" dir={direction}>
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-700 font-bold">
                    <th className="py-3 px-3 text-center w-10">#</th>
                    <th className="py-3 px-3.5">{isAr ? 'اسم الكروب' : 'Group Name'}</th>
                    <th className="py-3 px-3">{isAr ? 'الوجهة' : 'Destination'}</th>
                    <th className="py-3 px-3 text-center">{isAr ? 'سعر الشراء' : 'Buy Price'}</th>
                    <th className="py-3 px-3 text-center">{isAr ? 'إجمالي الشراء' : 'Total Buy'}</th>
                    <th className="py-3 px-3 text-center">{isAr ? 'إجمالي المبيعات' : 'Total Sales'}</th>
                    <th className="py-3 px-3 text-center">{isAr ? 'الربح' : 'Profit'}</th>
                    <th className="py-3 px-3 text-center">{isAr ? 'المسافرون' : 'Pax'}</th>
                    <th className="py-3 px-3 text-center">{isAr ? 'المستفيدين' : 'Beneficiaries'}</th>
                    <th className="py-3 px-3 text-center">{isAr ? 'من أنشأ الكروب' : 'Created By'}</th>
                    <th className="py-3 px-3 text-center">{isAr ? 'حالة البيع' : 'Sale Status'}</th>
                    <th className="py-3 px-3 text-center w-20">{isAr ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold">
                  {filtered.map((g, idx) => {
                    const s = g.summary;
                    const unitBuy = getUnitBuyPrice(g);
                    const totalBuy = getTotalBuyCost(g);
                    const profit = getProfit(g);
                    const beneficiaries = getBeneficiariesCount(g);
                    const createdBy = g.createdByName || (isAr ? 'مدير النظام' : 'System Admin');

                    return (
                      <tr
                        key={g.id}
                        onClick={() => openFile(g.id)}
                        className="hover:bg-orange-50/30 transition-colors cursor-pointer group"
                      >
                        <td className="py-3 px-3 text-center text-slate-400 font-mono" dir="ltr">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3.5">
                          <span className="font-black text-slate-900 group-hover:text-[#F45A0A] transition-colors block truncate max-w-[200px]" title={g.groupName}>
                            {g.groupName}
                          </span>
                          {g.travelDate && (
                            <span className="text-[10px] text-slate-400 font-mono block mt-0.5" dir="ltr">
                              {new Date(g.travelDate).toLocaleDateString('en-GB')}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={12} className="text-[#F45A0A] shrink-0" />
                            <span className="truncate max-w-[120px]">{g.country || '—'}</span>
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-black text-slate-700 bg-slate-50/50" dir="ltr">
                          {money(unitBuy, g.currency)}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-black text-slate-900" dir="ltr">
                          {money(totalBuy, g.currency)}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-black text-slate-900" dir="ltr">
                          {money(s.sales, g.currency)}
                        </td>
                        <td
                          className={`py-3 px-3 text-center font-mono font-black ${
                            profit >= 0 ? 'text-[#F45A0A]' : 'text-rose-600'
                          }`}
                          dir="ltr"
                        >
                          {money(profit, g.currency)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="font-mono font-black text-slate-900 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200" dir="ltr">
                            {g.passengers.length}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="font-mono font-black text-[#F45A0A] px-2 py-0.5 rounded-full bg-orange-50 border border-orange-200" dir="ltr">
                            {beneficiaries}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100/80 px-2 py-0.5 rounded-md">
                            <User size={11} className="text-slate-500" />
                            <span className="truncate max-w-[110px]">{createdBy}</span>
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 text-[10.5px] font-black rounded-lg px-2 py-0.5 border ${
                              g.openSale
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {g.openSale ? <Unlock size={11} /> : <Lock size={11} />}
                            <span>{g.openSale ? (isAr ? 'مفتوح' : 'Open') : (isAr ? 'مقفل' : 'Closed')}</span>
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openFile(g.id);
                              }}
                              title={isAr ? 'فتح ملف الكروب' : 'Open group'}
                              className="h-7 w-7 rounded-lg border border-slate-200 bg-white hover:border-[#F45A0A] hover:text-[#F45A0A] text-slate-500 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                            >
                              <FolderOpen size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(g);
                              }}
                              title={isAr ? 'حذف' : 'Delete'}
                              className="h-7 w-7 rounded-lg border border-slate-200 bg-white hover:border-rose-300 hover:text-rose-600 text-slate-400 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ── عرض البطاقات الحديثة ── */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {filtered.map((g) => {
              const s = g.summary;
              const fillPct = s.seats > 0 ? Math.min(100, Math.round((s.sold / s.seats) * 100)) : 0;
              return (
                <div
                  key={g.id}
                  onClick={() => openFile(g.id)}
                  className="group bg-white rounded-xl border border-slate-200 shadow-2xs hover:shadow-md hover:border-orange-300 transition-all cursor-pointer p-4 space-y-3.5 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* رأس البطاقة: الاسم، الوجهة، وحالة البيع */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-black text-sm text-slate-900 group-hover:text-[#F45A0A] transition-colors truncate">
                            {g.groupName}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mt-1">
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={12} className="text-[#F45A0A]" />
                            <span>{g.country || '—'}</span>
                          </span>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1 font-mono" dir="ltr">
                            <Calendar size={12} className="text-slate-400" />
                            <span>{g.travelDate ? new Date(g.travelDate).toLocaleDateString('en-GB') : (isAr ? 'بلا تاريخ' : 'No date')}</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-black rounded-lg px-2 py-0.5 border ${
                            g.openSale
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {g.openSale ? <Unlock size={11} /> : <Lock size={11} />}
                          <span>{g.openSale ? (isAr ? 'البيع مفتوح' : 'Open') : isAr ? 'مقفل' : 'Closed'}</span>
                        </span>
                      </div>
                    </div>

                    {/* مؤشر المقاعد والطاقة الاستيعابية */}
                    <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="inline-flex items-center gap-1.5 text-slate-700">
                          <Armchair size={13} className="text-[#F45A0A]" />
                          <span>{isAr ? 'المقاعد المبيعة:' : 'Sold Seats:'}</span>
                        </span>
                        <div className="flex items-center gap-1.5 font-mono" dir="ltr">
                          <span className="font-black text-slate-900">{s.sold}</span>
                          <span className="text-slate-400">/</span>
                          <span className="text-slate-600 font-bold">{s.seats}</span>
                          <span className="text-[10px] text-[#F45A0A] font-bold">({fillPct}%)</span>
                        </div>
                      </div>

                      {/* شريط التقدم */}
                      <div className="h-2 rounded-full bg-slate-200/70 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#F45A0A] to-[#f59e0b] transition-all"
                          style={{ width: `${fillPct}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10.5px] font-bold text-slate-500">
                        <span>{s.remaining > 0 ? `${s.remaining} ${isAr ? 'مقعداً شاغراً' : 'seats left'}` : (isAr ? 'المقاعد مكتملة بالكامل' : 'Fully booked')}</span>
                        {s.notComplete > 0 && (
                          <span className="text-amber-700 flex items-center gap-1">
                            <Clock size={11} />
                            <span>{s.notComplete} {isAr ? 'معلّق' : 'pending'}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* المربعات المالية الرباعية */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-2">
                        <span className="text-[10px] font-bold text-slate-500 block mb-0.5">{isAr ? 'المبيعات' : 'Sales'}</span>
                        <span className="text-xs font-mono font-black text-slate-900 block" dir="ltr">
                          {money(s.sales, g.currency)}
                        </span>
                      </div>
                      <div className="rounded-xl bg-emerald-50/50 border border-emerald-200/60 p-2">
                        <span className="text-[10px] font-bold text-emerald-800 block mb-0.5">{isAr ? 'المحصَّل' : 'Collected'}</span>
                        <span className="text-xs font-mono font-black text-emerald-700 block" dir="ltr">
                          {money(s.collected, g.currency)}
                        </span>
                      </div>
                      <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-2">
                        <span className="text-[10px] font-bold text-slate-500 block mb-0.5">{isAr ? 'التكلفة الفعلية' : 'Actual Cost'}</span>
                        <span className="text-xs font-mono font-black text-slate-800 block" dir="ltr">
                          {money(s.actualCost, g.currency)}
                        </span>
                      </div>
                      <div className="rounded-xl bg-orange-50/40 border border-orange-200/60 p-2">
                        <span className="text-[10px] font-bold text-orange-800 block mb-0.5">{isAr ? 'الربح' : 'Profit'}</span>
                        <span
                          className={`text-xs font-mono font-black block ${
                            s.actualProfit >= 0 ? 'text-[#F45A0A]' : 'text-rose-600'
                          }`}
                          dir="ltr"
                        >
                          {money(s.actualProfit, g.currency)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* الجزء السفلي وأزرار الإجراءات */}
                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[11px] font-bold text-slate-400">
                      {s.passengers} {isAr ? 'مسافراً مسجلاً' : 'registered passengers'}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(g);
                        }}
                        title={isAr ? 'حذف الكروب' : 'Delete'}
                        className="h-8 w-8 rounded-lg border border-slate-200 bg-white hover:border-rose-300 hover:text-rose-600 text-slate-400 flex items-center justify-center transition-all cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openFile(g.id);
                        }}
                        className="h-8 px-3 rounded-lg bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                      >
                        <FolderOpen size={13} />
                        <span>{isAr ? 'فتح الملف' : 'Open'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 5. النافذة الواحدة لإدارة ملف الكروب ── */}
      <GroupFileWorkspace
        opened={fileOpen}
        groupId={fileGroupId}
        onClose={() => {
          setFileOpen(false);
          setFileGroupId(null);
          load(true);
        }}
        onChanged={() => load(true)}
      />

      {/* ── 6. مودال تأكيد الحذف ── */}
      <Modal
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        centered
        radius="lg"
        withCloseButton={false}
        zIndex={10050}
      >
        {deleteTarget && (
          <div className="space-y-3 font-sans p-1" dir={direction}>
            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
              <Trash2 size={20} />
            </div>
            <p className="font-black text-sm text-slate-900">{isAr ? 'حذف الكروب السياحي؟' : 'Delete Tour Group?'}</p>
            <p className="text-xs font-bold text-slate-600 leading-relaxed">
              {isAr
                ? `سيتم حذف الكروب «${deleteTarget.groupName}» نهائياً بما يتضمن أنظمته ومسافريه وخدماتهم المسجلة (${deleteTarget.summary.passengers} مسافراً). هل أنت متأكد؟`
                : `Are you sure you want to delete "${deleteTarget.groupName}" and all associated passenger files?`}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="h-9 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await tourGroupsApi.remove(deleteTarget.id);
                    showSuccessNotification(isAr ? 'تم الحذف' : 'Deleted', deleteTarget.groupName);
                    setDeleteTarget(null);
                    load(true);
                  } catch (e: any) {
                    showErrorNotification(isAr ? 'تعذّر الحذف' : 'Failed', e?.message || '');
                  } finally {
                    setDeleting(false);
                  }
                }}
                className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-black cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                {deleting && <Loader size={12} color="white" />}
                <span>{isAr ? 'تأكيد الحذف' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default GroupsPage;
