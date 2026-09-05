import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader, Menu, Modal, Select, Autocomplete } from '@mantine/core';
import {
  X,
  Users,
  Plus,
  Trash2,
  Lock,
  Unlock,
  Ticket,
  Building2,
  FileCheck2,
  ShieldCheck,
  Bus,
  UserCheck,
  Package,
  Coins,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  Ban,
  Calendar,
  MapPin,
  TrendingUp,
  Banknote,
  DollarSign,
  User,
  Search,
  UploadCloud,
  Eye,
  FileText,
  Receipt,
  Folder,
  FolderPlus,
  UserPlus,
  ArrowRight,
  MoreVertical,
  Edit2,
  History,
  Save,
  CheckCheck,
  ArrowRightLeft,
  Filter,
  SlidersHorizontal,
  Check,
  Sparkles,
} from 'lucide-react';
import { SearchableCombobox } from '../ui/SearchableCombobox';
import { SegmentedDatePicker } from '../ui/SegmentedDatePicker';
import { AccountFinderModal, type AccountFinderResult } from '../common/AccountFinderModal';
import { AccountSearchField, type AccountPick } from './AccountSearchField';
import { InvoiceAuditLogModal } from '../tickets/InvoiceAuditLogModal';
import { partnersApi } from '../../api/partners';
import { accountsApi } from '../../api/accounts';
import { employeesApi } from '../../api/employees';
import { useAuthStore } from '../../store/useAuthStore';
import { WORLD_CITIES } from '../../data/worldCities';
import {
  tourGroupsApi,
  type TourGroup,
  type GroupPassenger,
  type GroupPassengerService,
  type GroupPriceSystem,
} from '../../api/tourGroups';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { useLanguageStore } from '../../store/useLanguageStore';

/**
 * النافذة الواحدة لملف الكروب السياحي
 * - بحث متقدم عن المورد (SearchableCombobox)
 * - إلغاء كلمة "متوقع" نهائياً واستبدالها بـ "سعر الشراء"
 * - نوافذ عريضة بانحناء أنيق (rounded-2xl) وخالية من البيانات التوضيحية الزائدة
 * - إلغاء المقاعد بالكامل
 */

const KIND_META: Record<string, { ar: string; icon: any; color: string }> = {
  TICKET: { ar: 'طيران', icon: Ticket, color: 'text-sky-600 bg-sky-50 border-sky-200' },
  HOTEL: { ar: 'فندق', icon: Building2, color: 'text-violet-600 bg-violet-50 border-violet-200' },
  VISA: { ar: 'فيزا', icon: FileCheck2, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  INSURANCE: { ar: 'تأمين', icon: ShieldCheck, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  TRANSPORT: { ar: 'نقل', icon: Bus, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  GUIDE: { ar: 'مرشد', icon: UserCheck, color: 'text-teal-600 bg-teal-50 border-teal-200' },
  PACKAGE: { ar: 'باكج', icon: Package, color: 'text-orange-600 bg-orange-50 border-orange-200' },
  FULL_PACKAGE: { ar: 'بكج كامل', icon: Package, color: 'text-orange-700 bg-orange-100 border-orange-300' },
};

const fmt = (n: number) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const money = (v: number, c = 'USD') => `${fmt(v)} ${c === 'USD' ? '$' : 'IQD'}`;
const num = (raw: any) => Number(String(raw ?? '').replace(/,/g, '')) || 0;

const inputClass =
  'w-full h-[46px] px-3.5 rounded-[11px] border border-[#E5E7EB] bg-[#FAFAFA] hover:bg-white hover:border-[#D1D5DB] focus:bg-white text-xs font-bold text-slate-900 focus:outline-none focus:border-2 focus:border-[#F45A0A] transition-colors duration-150';

const Field: React.FC<{
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ label, action, children, className = '' }) => (
  <div className={className}>
    <div className="flex items-center justify-between gap-2 mb-1 min-h-[20px]">
      <label className="text-xs font-bold text-slate-700 block leading-[20px]">{label}</label>
      {action}
    </div>
    {children}
  </div>
);

/* ── الملخّص المالي والتشغيلي: 4 بطاقات بدون مقاعد ── */
const SummaryBlock: React.FC<{ g: TourGroup; isAr: boolean }> = ({ g, isAr }) => {
  const s = g.summary;
  const C = g.currency;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
      {/* 1. إجمالي المسافرين */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500">{isAr ? 'المسافرون' : 'Passengers'}</span>
          <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#F45A0A] flex items-center justify-center border border-orange-100">
            <Users size={16} />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-black text-slate-900 font-mono tracking-tight" dir="ltr">
            {g.passengers.length}
          </div>
          <div className="flex items-center justify-between text-[11px] font-bold mt-1">
            <span className="text-emerald-700 font-mono">
              {s.complete} {isAr ? 'مكتمل' : 'Complete'}
            </span>
            <span className="text-amber-700 font-mono">
              {s.notComplete} {isAr ? 'معلّق' : 'Pending'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. المبيعات والتحصيل */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500">{isAr ? 'المبيعات والتحصيل' : 'Sales'}</span>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <Coins size={16} />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-black text-slate-900 font-mono tracking-tight" dir="ltr">
            {money(s.sales, C)}
          </div>
          <div className="flex items-center justify-between text-[11px] font-bold mt-1">
            <span className="text-emerald-700 font-mono" dir="ltr">
              {isAr ? 'محصل:' : 'Paid:'} {money(s.collected, C)}
            </span>
          </div>
        </div>
      </div>

      {/* 3. التكلفة الفعلية والمقدرة للكروب */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500">{isAr ? 'التكلفة الإجمالية' : 'Total Cost'}</span>
          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200">
            <Receipt size={16} />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-black text-slate-900 font-mono tracking-tight" dir="ltr">
            {money(s.actualCost > 0 || (s.buy + s.globalBuy + s.expenses > 0) ? s.actualCost : s.plannedCost, C)}
          </div>
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mt-1 font-mono" dir="ltr">
            <span>{isAr ? 'شراء:' : 'Buy:'} {money(s.buy + s.globalBuy > 0 ? s.buy + s.globalBuy : Math.max(0, s.plannedCost - s.expenses), C)}</span>
            <span>{isAr ? 'مصاريف:' : 'Exp:'} {money(s.expenses, C)}</span>
          </div>
        </div>
      </div>

      {/* 4. الذمم المتبقية */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500">{isAr ? 'الذمم المتبقية' : 'Outstanding'}</span>
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
            <Banknote size={16} />
          </div>
        </div>
        <div className="mt-2">
          <div className={`text-2xl font-black font-mono tracking-tight ${s.outstanding > 0 ? 'text-amber-700' : 'text-slate-400'}`} dir="ltr">
            {money(s.outstanding, C)}
          </div>
          <div className="text-[11px] font-bold text-slate-400 mt-1">
            {s.outstanding > 0 ? (isAr ? 'مستحق على العملاء' : 'Pending payment') : (isAr ? 'لا توجد ذمم' : 'No dues')}
          </div>
        </div>
      </div>

      {/* 5. صافي الأرباح */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500">{isAr ? 'صافي الربح' : 'Net Profit'}</span>
          <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#F45A0A] flex items-center justify-center border border-orange-100">
            <TrendingUp size={16} />
          </div>
        </div>
        <div className="mt-2">
          {(() => {
            const hasActual = s.actualCost > 0 || (s.buy + s.globalBuy + s.expenses > 0);
            const profitVal = hasActual ? s.actualProfit : s.plannedProfit;
            return (
              <>
                <div
                  className={`text-2xl font-black font-mono tracking-tight ${
                    profitVal >= 0 ? 'text-[#F45A0A]' : 'text-rose-600'
                  }`}
                  dir="ltr"
                >
                  {money(profitVal, C)}
                </div>
                <div className="text-[11px] font-bold text-slate-500 mt-1">
                  {isAr ? (hasActual ? 'الربح الفعلي' : 'الربح المحسوب') : (hasActual ? 'Actual profit' : 'Calculated profit')}
                </div>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

interface Props {
  opened: boolean;
  groupId: string | null;
  onClose: () => void;
  onChanged?: () => void;
}

export const GroupFileWorkspace: React.FC<Props> = ({ opened, groupId, onClose, onChanged }) => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  const [g, setG] = useState<TourGroup | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [openPax, setOpenPax] = useState<string | null>(null);
  const [paxModal, setPaxModal] = useState<{
    open: boolean;
    initialCustomer?: { name: string; id?: string | null; accountId?: string | null; agent?: string } | null;
    editingPassenger?: GroupPassenger | null;
  }>({ open: false, initialCustomer: null, editingPassenger: null });
  const [beneficiaryModalOpen, setBeneficiaryModalOpen] = useState(false);
  const [activeBeneficiaries, setActiveBeneficiaries] = useState<
    Array<{ name: string; accountId?: string | null; id?: string | null }>
  >([]);
  const [expandedBeneficiaries, setExpandedBeneficiaries] = useState<Record<string, boolean>>({});
  const [psModal, setPsModal] = useState<Partial<GroupPriceSystem> | null>(null);
  const [chargeModal, setChargeModal] = useState<'GLOBAL_PURCHASE' | 'EXPENSE' | null>(null);
  // الإشعارات المنبثقة معطَّلة في النظام كلّه، فأخطاء الحفظ كانت تختفي بصمت
  const [errorMsg, setErrorMsg] = useState('');
  const [editGroupModalOpen, setEditGroupModalOpen] = useState(false);
  const [deleteGroupConfirmOpen, setDeleteGroupConfirmOpen] = useState(false);
  const [auditLogOpen, setAuditLogOpen] = useState(false);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const currentUserName = user?.name || (user as any)?.username || (isAr ? 'مدير النظام' : 'System Admin');

  const [editGroupData, setEditGroupData] = useState({
    groupName: '',
    country: '',
    travelDate: '',
    groupType: 'FULL',
    currency: 'IQD',
    notes: '',
    agent: '',
  });

  useEffect(() => {
    if (g) {
      const extractedAgent =
        (g as any).agent ||
        (g.notes?.startsWith('AGENT:') ? g.notes.replace('AGENT:', '').trim() : '') ||
        g.passengers?.find((p) => p.agent)?.agent ||
        currentUserName ||
        '';
      setEditGroupData({
        groupName: g.groupName || '',
        country: g.country || '',
        travelDate: g.travelDate ? String(g.travelDate).split('T')[0] : '',
        groupType: g.groupType || 'FULL',
        currency: g.currency || 'IQD',
        notes: g.notes?.startsWith('AGENT:') ? '' : (g.notes || ''),
        agent: extractedAgent,
      });
    }
  }, [g, currentUserName]);

  // قفل إعادة الدخول: حالة busy تصل الشاشة متأخرةً عن النقرة الثانية، أما
  // المرجع فيقفل فوراً — نقرتان أثناء بطء الشبكة كانتا تحفظان النظام مرتين.
  const busyRef = useRef(false);
  const run = useCallback(
    async (op: () => Promise<TourGroup>, okMsg?: string) => {
      if (busyRef.current) return null;
      busyRef.current = true;
      setBusy(true);
      setErrorMsg('');
      try {
        const next = await op();
        setG(next);
        onChanged?.();
        if (okMsg) showSuccessNotification(isAr ? 'تم' : 'Done', okMsg);
        return next;
      } catch (err: any) {
        setErrorMsg(err?.message || (isAr ? 'تعذّر حفظ العملية' : 'Operation failed'));
        showErrorNotification(isAr ? 'تعذّر التنفيذ' : 'Failed', err?.message || '');
        return null;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [isAr, onChanged],
  );

  const [employeesList, setEmployeesList] = useState<any[]>([]);

  useEffect(() => {
    if (!opened) return;
    setOpenPax(null);
    partnersApi
      .getSuppliers()
      .then((d: any) => setSuppliers(Array.isArray(d) ? d : d?.data || []))
      .catch(() => undefined);

    employeesApi
      .getAll()
      .then((res: any) => setEmployeesList(Array.isArray(res) ? res : res?.data || []))
      .catch(() => setEmployeesList([]));

    if (groupId) {
      setLoading(true);
      tourGroupsApi
        .getOne(groupId)
        .then(setG)
        .catch((e) => showErrorNotification(isAr ? 'تعذّر فتح الملف' : 'Open failed', e?.message || ''))
        .finally(() => setLoading(false));
    } else {
      setG(null);
    }
  }, [opened, groupId, isAr]);

  const employeeOptions = useMemo(
    () =>
      employeesList.map((e: any) => ({
        value: e.fullName || e.name || e.id,
        label: e.fullName || e.name || e.username || '',
      })),
    [employeesList],
  );

  const customerOptions = useMemo(
    () =>
      customers.map((c: any) => ({
        value: c.nameAr || c.name || c.id,
        label: c.nameAr || c.name || '',
        code: c.code,
      })),
    [customers],
  );

  const supplierOptions = useMemo(
    () =>
      suppliers.map((s: any) => ({
        value: s.nameAr || s.name || s.id,
        label: s.nameAr || s.name || '',
        code: s.code,
      })),
    [suppliers],
  );

  const beneficiaryGroups = useMemo(() => {
    if (!g) return [];
    const map = new Map<
      string,
      {
        key: string;
        name: string;
        accountId: string | null;
        customerId: string | null;
        passengers: GroupPassenger[];
        totalSale: number;
        totalPaid: number;
        totalDue: number;
        totalCost: number;
        totalProfit: number;
        totalActualCost: number;
        totalPlannedCost: number;
      }
    >();

    // 1. أضف المستفيدين النشطين المفتوحين يدوياً حتى تظهر ملفاتهم حتى لو لم يُضف إليها مسافر بعد
    for (const b of activeBeneficiaries) {
      const key = b.accountId ? `acc_${b.accountId}` : `name_${b.name.trim().toLowerCase()}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          name: b.name,
          accountId: b.accountId || null,
          customerId: b.id || null,
          passengers: [],
          totalSale: 0,
          totalPaid: 0,
          totalDue: 0,
          totalCost: 0,
          totalProfit: 0,
          totalActualCost: 0,
          totalPlannedCost: 0,
        });
      }
    }

    // 2. جمّع المسافرين الحاليين في ملفات المستفيدين
    for (const p of g.passengers || []) {
      const trimmedName = (p.customerName || '').trim();
      const accountId = p.customerAccountId || null;
      const key = accountId ? `acc_${accountId}` : trimmedName ? `name_${trimmedName.toLowerCase()}` : '__general__';
      const displayName = trimmedName || (isAr ? 'بدون مستفيد (عام)' : 'General');

      let entry = map.get(key);
      if (!entry) {
        entry = {
          key,
          name: displayName,
          accountId,
          customerId: p.customerId || null,
          passengers: [],
          totalSale: 0,
          totalPaid: 0,
          totalDue: 0,
          totalCost: 0,
          totalProfit: 0,
          totalActualCost: 0,
          totalPlannedCost: 0,
        };
        map.set(key, entry);
      } else if (trimmedName && entry.name === (isAr ? 'بدون مستفيد (عام)' : 'General')) {
        entry.name = trimmedName;
      }

      entry.passengers.push(p);
      const sale = Number(p.salePrice) || 0;
      const paid = p.payType === 'CASH' ? sale : (Number(p.collectedAmount) || 0);

      // احتساب تكلفة هذا المسافر (شراء فعلي إن وجد، أو تكلفة البكج/الخدمة المتوقعة)
      let paxActualBuy = 0;
      let paxPlannedBuy = 0;
      let paxCost = 0;

      if (Array.isArray(p.services) && p.services.length > 0) {
        for (const sv of p.services) {
          const fb = (sv.finalBuy !== null && sv.finalBuy !== undefined && Number(sv.finalBuy) > 0) ? Number(sv.finalBuy) : 0;
          const eb = Number(sv.expectedBuy) || 0;
          paxActualBuy += fb;
          paxPlannedBuy += eb;
          paxCost += (fb > 0 ? fb : eb);
        }
      } else if (p.priceSystemId && Array.isArray(g.priceSystems)) {
        const ps = g.priceSystems.find((s) => s.id === p.priceSystemId);
        if (ps && Array.isArray(ps.items)) {
          for (const it of ps.items) {
            const eb = Number(it.expectedBuy) || 0;
            paxPlannedBuy += eb;
            paxCost += eb;
          }
        }
      }

      entry.totalSale += sale;
      entry.totalPaid += paid;
      entry.totalDue += sale - paid;
      entry.totalCost += paxCost;
      entry.totalActualCost += paxActualBuy;
      entry.totalPlannedCost += paxPlannedBuy;
      entry.totalProfit += (sale - paxCost);
    }

    return Array.from(map.values());
  }, [g, activeBeneficiaries, isAr]);

  if (!opened) return null;

  /* ── إنشاء كروب جديد: تصميم قياسي ── */
  if (!g && !loading) {
    return (
      <NewGroupModal
        opened={opened}
        direction={direction}
        isAr={isAr}
        currentUserName={currentUserName}
        employeeOptions={employeeOptions}
        onClose={onClose}
        onCreated={(created) => {
          setG(created);
          onChanged?.();
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[9998] bg-[#F8FAFC] flex flex-col font-sans" dir={direction}>
      {/* ── 1. الترويسة ── */}
      <div className="bg-white border-b border-slate-200 shadow-2xs shrink-0">
        <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200/80 text-[#F45A0A] flex items-center justify-center shrink-0">
              <Users size={20} strokeWidth={2.4} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-black text-sm sm:text-base text-slate-900 truncate">{g?.groupName || '…'}</h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-orange-50 text-[#F45A0A] border border-orange-200/70 font-mono" dir="ltr">
                  {g?.currency || 'USD'}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-500 mt-0.5 flex items-center gap-2">
                <span className="inline-flex items-center gap-1">
                  <MapPin size={12} className="text-[#F45A0A]" />
                  <span>{g?.country || '—'}</span>
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1 font-mono" dir="ltr">
                  <Calendar size={12} className="text-slate-400" />
                  <span>{g?.travelDate ? new Date(g.travelDate).toLocaleDateString('en-GB') : (isAr ? 'بلا تاريخ سفر' : 'no date')}</span>
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1.5 bg-slate-50 px-2.5 py-0.5 rounded-md border border-slate-200 text-[11px]">
                  <User size={11} className="text-slate-400" />
                  <span className="text-slate-500 font-sans">{isAr ? 'مدخل البيانات:' : 'Entry:'}</span>
                  <span className="text-slate-800 font-bold">{g?.createdByName || currentUserName}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 bg-orange-50/80 px-2.5 py-0.5 rounded-md border border-orange-200 text-[#F45A0A] text-[11px]">
                  <UserCheck size={11} className="text-[#F45A0A]" />
                  <span className="text-orange-600 font-sans">{isAr ? 'موظف الإصدار:' : 'Issuer:'}</span>
                  <span className="font-bold">
                    {(g as any)?.agent ||
                      (g?.notes?.startsWith('AGENT:') ? g.notes.replace('AGENT:', '').trim() : '') ||
                      g?.passengers?.find((p) => p.agent)?.agent ||
                      g?.createdByName ||
                      currentUserName}
                  </span>
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {g && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(
                    () => tourGroupsApi.update(g.id, { openSale: !g.openSale }),
                    g.openSale ? (isAr ? 'أُغلق البيع' : 'Sale closed') : isAr ? 'فُتح البيع' : 'Sale opened',
                  )
                }
                className={`h-[38px] px-3.5 rounded-xl text-xs font-black cursor-pointer flex items-center gap-1.5 border transition-all shadow-2xs ${
                  g.openSale
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                    : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                }`}
              >
                {g.openSale ? <Unlock size={14} /> : <Lock size={14} />}
                <span>{g.openSale ? (isAr ? 'البيع مفتوح' : 'Sale Open') : isAr ? 'البيع مقفل' : 'Sale Closed'}</span>
              </button>
            )}
            {g && (
              <Menu shadow="md" width={190} position={direction === 'rtl' ? 'bottom-start' : 'bottom-end'}>
                <Menu.Target>
                  <button
                    type="button"
                    title={isAr ? 'إجراءات الكروب' : 'Group actions'}
                    className="h-[38px] w-[38px] rounded-xl border border-slate-200 bg-white hover:bg-orange-50 hover:border-orange-200 hover:text-[#F45A0A] text-slate-600 flex items-center justify-center cursor-pointer transition-all shadow-2xs"
                  >
                    <MoreVertical size={18} />
                  </button>
                </Menu.Target>
                <Menu.Dropdown className="!rounded-xl !p-1.5 !border !border-slate-200 shadow-xl font-sans" dir={direction}>
                  <Menu.Item
                    leftSection={<Edit2 size={15} className="text-[#F45A0A]" />}
                    onClick={() => setEditGroupModalOpen(true)}
                    className="!text-xs !font-bold !text-slate-800 !py-2 hover:!bg-orange-50/70"
                  >
                    {isAr ? 'تعديل الكروب' : 'Edit Group'}
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<History size={15} className="text-blue-600" />}
                    onClick={() => setAuditLogOpen(true)}
                    className="!text-xs !font-bold !text-slate-800 !py-2 hover:!bg-blue-50/70"
                  >
                    {isAr ? 'سجل التعديلات' : 'Audit Log'}
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item
                    color="red"
                    leftSection={<Trash2 size={15} className="text-rose-600" />}
                    onClick={() => setDeleteGroupConfirmOpen(true)}
                    className="!text-xs !font-bold !text-rose-600 !py-2 hover:!bg-rose-50"
                  >
                    {isAr ? 'حذف الكروب' : 'Delete Group'}
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            )}
            <button
              type="button"
              onClick={onClose}
              className="h-[38px] w-[38px] rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 flex items-center justify-center cursor-pointer transition-colors shadow-2xs"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. جسم الملف ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 py-4 pb-20 space-y-4">
          {loading || !g ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-xs font-bold text-slate-500">
              <Loader size="sm" color="orange" />
              <span>{isAr ? 'جارٍ تحميل ملف الكروب…' : 'Loading tour group…'}</span>
            </div>
          ) : (
            <>
              {/* ١) الملخّص المالي والتشغيلي */}
              <SummaryBlock g={g} isAr={isAr} />

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                {/* ٢) أنظمة الأسعار */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Coins size={16} className="text-[#F45A0A]" />
                      <h3 className="font-black text-xs sm:text-sm text-slate-900">
                        {isAr ? 'أنظمة الأسعار' : 'Price Systems'}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-slate-100 text-slate-700 font-mono">
                        {g.priceSystems.length}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPsModal({ name: '', currency: g.currency, salePrice: 0, items: [] })}
                      className="h-8 px-3 rounded-lg bg-[#F45A0A] hover:bg-[#DD4F05] text-white text-xs font-black cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <Plus size={14} />
                      <span>{isAr ? 'نظام جديد' : 'New'}</span>
                    </button>
                  </div>

                  {g.priceSystems.length === 0 ? (
                    <div className="py-8 text-center space-y-1">
                      <p className="text-xs font-black text-slate-600">
                        {isAr ? 'لا يوجد نظام أسعار' : 'No price systems'}
                      </p>
                      <p className="text-[11px] font-bold text-slate-400">
                        {isAr ? 'أضف نظام أسعار لتحديد سعر البيع وبنود الخدمات التلقائية.' : 'Add price systems to define sales pricing.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {g.priceSystems.map((ps) => (
                        <div key={ps.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2 hover:bg-slate-50 transition-colors">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-xs text-slate-900">{ps.name}</span>
                              <span className="text-xs font-mono font-black text-slate-900 bg-white border border-slate-200 rounded-md px-2 py-0.5" dir="ltr">
                                {money(ps.salePrice, ps.currency)}
                              </span>
                              {!ps.active && (
                                <span className="text-[10px] font-bold bg-slate-200 text-slate-600 rounded px-1.5 py-0.5">
                                  {isAr ? 'معطَّل' : 'inactive'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setPsModal({ ...ps, items: ps.items.map((i) => ({ ...i })) })}
                                className="h-7 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-[#F45A0A] hover:bg-orange-50 cursor-pointer"
                              >
                                {isAr ? 'تعديل' : 'Edit'}
                              </button>
                              <button
                                type="button"
                                onClick={() => run(() => tourGroupsApi.removePriceSystem(g.id, ps.id))}
                                className="h-7 w-7 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:border-rose-300 flex items-center justify-center cursor-pointer"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {ps.items.map((it, i) => {
                              const meta = KIND_META[it.kind] || KIND_META.PACKAGE;
                              const Icon = meta.icon;
                              return (
                                <span
                                  key={i}
                                  className={`inline-flex items-center gap-1 text-[11px] font-bold border rounded-lg px-2 py-1 ${meta.color}`}
                                >
                                  <Icon size={12} />
                                  <span>{isAr ? meta.ar : it.kind}</span>
                                  <span className="font-mono text-slate-900 font-black" dir="ltr">
                                    {money(it.expectedBuy, it.currency || ps.currency)}
                                  </span>
                                  {it.supplierName && <span className="text-slate-600">({it.supplierName})</span>}
                                </span>
                              );
                            })}
                            {ps.items.length === 0 && (
                              <span className="text-[11px] font-bold text-slate-400">
                                {isAr ? 'بلا بنود خدمات' : 'No service items'}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ٣) المشتريات والمصاريف */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Banknote size={16} className="text-[#F45A0A]" />
                      <h3 className="font-black text-xs sm:text-sm text-slate-900">
                        {isAr ? 'المصاريف والمشتريات' : 'Purchases & Expenses'}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-slate-100 text-slate-700 font-mono">
                        {g.charges.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setChargeModal('GLOBAL_PURCHASE')}
                        className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:border-[#F45A0A] hover:text-[#F45A0A] cursor-pointer shadow-2xs"
                      >
                        + {isAr ? 'شراء عام' : 'Purchase'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setChargeModal('EXPENSE')}
                        className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:border-rose-400 hover:text-rose-600 cursor-pointer shadow-2xs"
                      >
                        + {isAr ? 'مصروف' : 'Expense'}
                      </button>
                    </div>
                  </div>

                  {g.charges.length === 0 ? (
                    <div className="py-8 text-center space-y-1">
                      <p className="text-xs font-black text-slate-600">
                        {isAr ? 'لا توجد مصاريف عامة' : 'No global charges'}
                      </p>
                      <p className="text-[11px] font-bold text-slate-400">
                        {isAr ? 'أضف مصاريف الدعاية أو استئجار الباصات والتكاليف المشتركة.' : 'Add bus rental, marketing, or general tour expenses.'}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {g.charges.map((c) => (
                        <div key={c.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`text-[10.5px] font-black rounded-md px-2 py-0.5 border shrink-0 ${
                                c.chargeType === 'EXPENSE'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-sky-50 text-sky-800 border-sky-200'
                              }`}
                            >
                              {c.chargeType === 'EXPENSE' ? (isAr ? 'مصروف' : 'EXP') : isAr ? 'شراء' : 'BUY'}
                            </span>
                            <span className="font-black text-slate-900 truncate">{c.category}</span>
                            {c.supplierName && <span className="text-slate-500 truncate">({c.supplierName})</span>}
                          </div>
                          <div className="flex items-center gap-2.5 shrink-0">
                            <span className="font-mono font-black text-slate-900" dir="ltr">
                              {money(c.amount, c.currency)}
                            </span>
                            <button
                              type="button"
                              onClick={() => run(() => tourGroupsApi.removeCharge(g.id, c.id))}
                              className="h-7 w-7 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-300 flex items-center justify-center cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ٤) المسافرون وخدماتهم */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-[#F45A0A]" />
                    <h3 className="font-black text-xs sm:text-sm text-slate-900">
                      {isAr ? 'المسافرون' : 'Passengers'}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-orange-50 text-[#F45A0A] border border-orange-200/70 font-mono" dir="ltr">
                      {g.passengers.length} {isAr ? 'مسافراً' : 'pax'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {!g.openSale && (
                      <button
                        type="button"
                        onClick={() =>
                          run(
                            () => tourGroupsApi.update(g.id, { openSale: true }),
                            isAr ? 'فُتح البيع — يمكنك الآن إضافة المسافرين' : 'Sale opened',
                          )
                        }
                        className="h-8 px-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-[11.5px] font-black cursor-pointer flex items-center gap-1.5 hover:bg-emerald-100"
                        title={isAr ? 'البيع مقفل — افتحه لإضافة المسافرين' : 'Open the sale first'}
                      >
                        <Unlock size={13} />
                        <span>{isAr ? 'افتح البيع' : 'Open sale'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={!g.passengers || g.passengers.length === 0}
                      onClick={() => setAuditModalOpen(true)}
                      title={!g.passengers || g.passengers.length === 0 ? (isAr ? 'لا يوجد مسافرون لتدقيقهم' : 'No passengers to audit') : ''}
                      className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-orange-50/70 hover:border-orange-300 disabled:bg-slate-100 disabled:border-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-slate-700 hover:text-[#F45A0A] text-xs font-black cursor-pointer flex items-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <CheckCheck size={14} className="text-[#F45A0A]" />
                      <span>{isAr ? 'تدقيق المسافرين والأسعار' : 'Audit Passengers'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={!g.openSale}
                      onClick={() => setBeneficiaryModalOpen(true)}
                      title={!g.openSale ? (isAr ? 'البيع مقفل — افتح البيع أولاً' : 'Sale is closed — open it first') : ''}
                      className="h-8 px-3 rounded-lg border border-orange-200 bg-orange-50 hover:bg-orange-100 disabled:bg-slate-100 disabled:border-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-[#F45A0A] text-xs font-black cursor-pointer flex items-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <FolderPlus size={14} />
                      <span>{isAr ? 'إضافة مستفيد جديد' : 'New Beneficiary'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={!g.openSale}
                      onClick={() => setPaxModal({ open: true, initialCustomer: null })}
                      title={!g.openSale ? (isAr ? 'البيع مقفل — افتح البيع أولاً' : 'Sale is closed — open it first') : ''}
                      className="h-8 px-3.5 rounded-lg bg-[#F45A0A] hover:bg-[#DD4F05] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-xs font-black cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    >
                      <UserPlus size={14} />
                      <span>{isAr ? 'إضافة مسافر' : 'Add Passenger'}</span>
                    </button>
                  </div>
                </div>

                {beneficiaryGroups.length === 0 ? (
                  <div className="py-12 text-center space-y-2.5">
                    <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#F45A0A] mx-auto flex items-center justify-center">
                      <Users size={22} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-black text-slate-700">
                        {isAr ? 'لا يوجد مسافرون أو ملفات مستفيدين مسجلة بعد' : 'No passengers or beneficiary files yet'}
                      </p>
                      <p className="text-xs font-bold text-slate-400 max-w-md mx-auto">
                        {isAr
                          ? 'يمكنك إضافة ملف مستفيد مستقل لكل جهة أو شركة والبدء بإضافة مسافريها، أو إضافة مسافرين مباشرة.'
                          : 'Create a beneficiary file for each customer/company, or add passengers directly.'}
                      </p>
                    </div>
                    {g.openSale && (
                      <div className="flex items-center justify-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setBeneficiaryModalOpen(true)}
                          className="h-8 px-3.5 rounded-xl border border-orange-200 bg-orange-50 text-[#F45A0A] text-xs font-black hover:bg-orange-100 flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <FolderPlus size={14} />
                          <span>{isAr ? 'إضافة مستفيد جديد' : 'New Beneficiary'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaxModal({ open: true, initialCustomer: null })}
                          className="h-8 px-3.5 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <UserPlus size={14} />
                          <span>{isAr ? 'إضافة مسافر' : 'Add Passenger'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {beneficiaryGroups.map((bg) => {
                      const isExpanded = expandedBeneficiaries[bg.key] !== false;
                      return (
                        <div
                          key={bg.key}
                          className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs transition-all hover:border-orange-200"
                        >
                          {/* شريط ترويسة ملف المستفيد */}
                          <div className="p-3 sm:p-3.5 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200/60 text-[#F45A0A] flex items-center justify-center shrink-0">
                                <Folder size={16} />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-black text-xs sm:text-sm text-slate-900 truncate">
                                    {bg.name}
                                  </span>
                                  <span className="text-[11px] font-black font-mono px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700 shrink-0">
                                    {bg.passengers.length} {isAr ? 'مسافر' : 'pax'}
                                  </span>
                                </div>
                                {bg.accountId && (
                                  <span className="text-[10px] font-bold text-slate-400 block truncate">
                                    {isAr ? 'حساب مالي مسجل' : 'Linked Account'}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* مؤشرات مالية وأزرار ملف المستفيد: التكلفة علينا، على المستفيد، الربح، والمحصل */}
                            <div className="flex items-center flex-wrap gap-2">
                              {/* ١. التكلفة علينا */}
                              <div
                                className="flex items-center gap-1.5 text-xs font-bold bg-white px-2.5 py-1 rounded-lg border border-slate-200 font-mono tabular-nums shadow-2xs"
                                title={isAr ? `التكلفة علينا (فعلي: ${money(bg.totalActualCost, g.currency)} | متوقع: ${money(bg.totalPlannedCost, g.currency)})` : 'Cost to us'}
                              >
                                <span className="text-slate-400 font-sans text-[11px] font-bold">
                                  {isAr ? 'التكلفة علينا:' : 'Our Cost:'}
                                </span>
                                <span className="text-slate-800 font-black">
                                  {money(bg.totalCost, g.currency)}
                                </span>
                              </div>

                              {/* ٢. على المستفيد (إجمالي المبيعات) */}
                              <div className="flex items-center gap-1.5 text-xs font-bold bg-white px-2.5 py-1 rounded-lg border border-slate-200 font-mono tabular-nums shadow-2xs">
                                <span className="text-slate-400 font-sans text-[11px] font-bold">
                                  {isAr ? 'على المستفيد:' : 'Beneficiary:'}
                                </span>
                                <span className="text-slate-900 font-black">
                                  {money(bg.totalSale, g.currency)}
                                </span>
                              </div>

                              {/* ٣. صافي الربح */}
                              <div
                                className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg border font-mono tabular-nums shadow-2xs ${
                                  bg.totalProfit >= 0
                                    ? 'bg-orange-50 text-[#F45A0A] border-orange-200/80'
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}
                              >
                                <TrendingUp size={13} className={bg.totalProfit >= 0 ? 'text-[#F45A0A]' : 'text-rose-600'} />
                                <span className="font-sans text-[11px] font-bold">
                                  {isAr ? 'الربح:' : 'Profit:'}
                                </span>
                                <span className="font-black">
                                  {money(bg.totalProfit, g.currency)}
                                </span>
                              </div>

                              {/* ٤. المحصل */}
                              <div className="flex items-center gap-1.5 text-xs font-bold bg-white px-2.5 py-1 rounded-lg border border-slate-200 font-mono tabular-nums shadow-2xs">
                                <span className="text-slate-400 font-sans text-[11px] font-bold">
                                  {isAr ? 'المحصل:' : 'Paid:'}
                                </span>
                                <span className="text-emerald-700 font-black">
                                  {money(bg.totalPaid, g.currency)}
                                </span>
                              </div>

                              {/* ٥. المتبقي إن وجد */}
                              {bg.totalDue > 0 && (
                                <div className="flex items-center gap-1.5 text-xs font-bold bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 font-mono tabular-nums shadow-2xs">
                                  <span className="text-rose-500 font-sans text-[11px] font-bold">
                                    {isAr ? 'المتبقي:' : 'Due:'}
                                  </span>
                                  <span className="text-rose-700 font-black">
                                    {money(bg.totalDue, g.currency)}
                                  </span>
                                </div>
                              )}

                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedBeneficiaries((prev) => ({
                                    ...prev,
                                    [bg.key]: isExpanded ? false : true,
                                  }))
                                }
                                className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 flex items-center justify-center cursor-pointer"
                                title={isExpanded ? (isAr ? 'طي' : 'Collapse') : (isAr ? 'توسيع' : 'Expand')}
                              >
                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>
                            </div>
                          </div>

                          {/* قائمة المسافرين التابعين لهذا المستفيد */}
                          {isExpanded && (
                            <div className="p-3 bg-white space-y-2">
                              {bg.passengers.length === 0 ? (
                                <div className="py-5 text-center space-y-1 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                                  <p className="text-xs font-black text-slate-600">
                                    {isAr ? 'لا يوجد مسافرون مسجلون لهذا المستفيد بعد' : 'No passengers under this file yet'}
                                  </p>
                                  <p className="text-[11px] font-bold text-slate-400">
                                    {isAr ? 'اضغط على «إضافة مسافر لهذا المستفيد» لتسجيل المسافرين' : 'Click "Add Traveler" above to start'}
                                  </p>
                                </div>
                              ) : (
                                <PassengerTable
                                  g={g}
                                  passengers={bg.passengers}
                                  isAr={isAr}
                                  supplierOptions={supplierOptions}
                                  run={run}
                                  onEditPax={(pax) => {
                                    setPaxModal({
                                      open: true,
                                      initialCustomer: {
                                        name: bg.name,
                                        accountId: bg.accountId,
                                        id: bg.customerId,
                                        agent: pax.agent || undefined,
                                      },
                                      editingPassenger: pax,
                                    });
                                  }}
                                />
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── النوافذ الفرعية ── */}
      {g && psModal && (
        <PriceSystemModal
          isAr={isAr}
          direction={direction}
          draft={psModal}
          busy={busy}
          groupCurrency={g.currency}
          supplierOptions={supplierOptions}
          currentUserName={currentUserName}
          employeeOptions={employeeOptions}
          onClose={() => setPsModal(null)}
          onSave={async (dto) => {
            const ok = await run(() => tourGroupsApi.savePriceSystem(g.id, dto), isAr ? 'حُفظ نظام الأسعار' : 'Saved');
            if (ok) setPsModal(null);
          }}
        />
      )}

      {g && chargeModal && (
        <ChargeModal
          isAr={isAr}
          direction={direction}
          chargeType={chargeModal}
          busy={busy}
          currency={g.currency}
          supplierOptions={supplierOptions}
          onClose={() => setChargeModal(null)}
          onSave={async (dto) => {
            const ok = await run(() => tourGroupsApi.addCharge(g.id, dto));
            if (ok) setChargeModal(null);
          }}
        />
      )}

      {g && beneficiaryModalOpen && (
        <NewBeneficiaryModal
          isAr={isAr}
          direction={direction}
          currentUserName={currentUserName}
          employeeOptions={employeeOptions}
          onClose={() => setBeneficiaryModalOpen(false)}
          onSelect={(b) => {
            setActiveBeneficiaries((prev) => {
              const key = b.accountId ? `acc_${b.accountId}` : `name_${b.name.trim().toLowerCase()}`;
              const exists = prev.some(
                (item) => (item.accountId ? `acc_${item.accountId}` : `name_${item.name.trim().toLowerCase()}`) === key,
              );
              return exists ? prev : [...prev, b];
            });
            setBeneficiaryModalOpen(false);
            // افتح مباشرة نافذة إضافة مسافر لهذا المستفيد الجديد
            setPaxModal({
              open: true,
              initialCustomer: b,
            });
          }}
        />
      )}

      {g && paxModal.open && (
        <PassengerModal
          isAr={isAr}
          direction={direction}
          g={g}
          busy={busy}
          errorMsg={errorMsg}
          customerOptions={customerOptions}
          initialCustomer={paxModal.initialCustomer}
          editingPassenger={paxModal.editingPassenger}
          currentUserName={currentUserName}
          employeeOptions={employeeOptions}
          onClose={() => {
            setErrorMsg('');
            setPaxModal({ open: false, initialCustomer: null, editingPassenger: null });
          }}
          onSave={async (dto) => {
            if (paxModal.editingPassenger) {
              const ok = await run(
                () => tourGroupsApi.updatePassenger(g.id, paxModal.editingPassenger!.id, dto),
                isAr ? 'تم تعديل بيانات المسافر بنجاح' : 'Passenger updated',
              );
              return !!ok;
            }
            const ok = await run(
              () => tourGroupsApi.addPassenger(g.id, dto),
              isAr ? 'أُضيف المسافر بنجاح' : 'Passenger added',
            );
            return !!ok;
          }}
        />
      )}

      {/* ── نافذة تعديل بيانات الكروب ── */}
      {g && editGroupModalOpen && (
        <Modal
          opened={editGroupModalOpen}
          onClose={() => setEditGroupModalOpen(false)}
          centered
          size={580}
          withCloseButton={false}
          zIndex={10050}
          classNames={{
            content: '!rounded-2xl border border-slate-200 shadow-2xl !overflow-visible',
            body: '!p-5',
          }}
        >
          <div className="space-y-3.5 font-sans" dir={direction}>
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200/80 text-[#F45A0A] flex items-center justify-center">
                  <Edit2 size={16} strokeWidth={2.4} />
                </div>
                <h3 className="font-black text-sm sm:text-base text-slate-900">
                  {isAr ? 'تعديل بيانات الكروب' : 'Edit Tour Group'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditGroupModalOpen(false)}
                className="w-8 h-8 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* شريط علوي: مدخل البيانات وموظف الإصدار */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl bg-slate-50/90 border border-slate-200 p-3 text-xs">
              {/* مدخل البيانات */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                  <User size={12} className="text-slate-400" />
                  <span>{isAr ? 'مدخل البيانات (تلقائي)' : 'Data Entry (Auto)'}</span>
                </label>
                <div className="h-[38px] px-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between shadow-2xs font-sans">
                  <span className="font-bold text-slate-800 text-xs truncate">
                    {g.createdByName || currentUserName}
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                    {isAr ? 'المستخدم الحالي' : 'Current User'}
                  </span>
                </div>
              </div>

              {/* موظف الإصدار / المصدر - قابل للتعديل */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[#F45A0A]">
                    <UserCheck size={12} className="text-[#F45A0A]" />
                    <span>{isAr ? 'موظف الإصدار / المصدر' : 'Issuing Employee / Issuer'}</span>
                  </span>
                  <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100">
                    {isAr ? 'تلقائي وقابل للتعديل' : 'Auto / Editable'}
                  </span>
                </label>
                <SearchableCombobox
                  value={editGroupData.agent}
                  onChange={(val) => setEditGroupData({ ...editGroupData, agent: val || '' })}
                  options={employeeOptions || []}
                  placeholder={isAr ? 'اختر أو اكتب موظف الإصدار...' : 'Select or type issuer...'}
                  allowCustomValue
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* اسم الكروب */}
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {isAr ? 'اسم الكروب *' : 'Group Name *'}
                </label>
                <input
                  value={editGroupData.groupName}
                  onChange={(e) => setEditGroupData({ ...editGroupData, groupName: e.target.value })}
                  className={inputClass}
                  placeholder={isAr ? 'اسم الكروب' : 'Group Name'}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {isAr ? 'النوع' : 'Type'}
                </label>
                <SearchableCombobox
                  value={editGroupData.groupType}
                  onChange={(val) => setEditGroupData({ ...editGroupData, groupType: val || 'FULL' })}
                  options={[
                    { value: 'FULL', label: isAr ? 'شامل' : 'Full' },
                    { value: 'AIR', label: isAr ? 'طيران' : 'Air' },
                    { value: 'LAND', label: isAr ? 'بري' : 'Land' },
                  ]}
                  clearable={false}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                  <MapPin size={12} className="text-[#F45A0A]" />
                  <span>{isAr ? 'الوجهة' : 'Destination'}</span>
                </label>
                <SearchableCombobox
                  options={WORLD_CITIES.map((c) => ({
                    value: isAr ? c.cityAr : c.cityEn,
                    label: isAr ? `${c.cityAr} (${c.countryAr})` : `${c.cityEn} (${c.countryEn})`,
                    subLabel: isAr ? c.countryAr : c.countryEn,
                  }))}
                  value={editGroupData.country}
                  onChange={(val: string) => setEditGroupData({ ...editGroupData, country: val || '' })}
                  placeholder={isAr ? 'الوجهة' : 'Destination'}
                  allowCustomValue
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {isAr ? 'تاريخ السفر' : 'Travel Date'}
                </label>
                <SegmentedDatePicker
                  value={editGroupData.travelDate ? new Date(editGroupData.travelDate) : null}
                  onChange={(dt) => setEditGroupData({ ...editGroupData, travelDate: dt ? dt.toISOString().split('T')[0] : '' })}
                  clearable={false}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {isAr ? 'العملة' : 'Currency'}
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditGroupData({ ...editGroupData, currency: 'IQD' })}
                    className={`flex-1 h-[44px] rounded-xl font-black text-xs border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      editGroupData.currency === 'IQD'
                        ? 'bg-[#F45A0A] text-white border-[#F45A0A] shadow-2xs'
                        : 'bg-[#FAFAFA] border-[#E5E7EB] text-slate-700 hover:bg-white'
                    }`}
                  >
                    <Coins size={15} />
                    <span>IQD (د.ع)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditGroupData({ ...editGroupData, currency: 'USD' })}
                    className={`flex-1 h-[44px] rounded-xl font-black text-xs border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      editGroupData.currency === 'USD'
                        ? 'bg-[#F45A0A] text-white border-[#F45A0A] shadow-2xs'
                        : 'bg-[#FAFAFA] border-[#E5E7EB] text-slate-700 hover:bg-white'
                    }`}
                  >
                    <DollarSign size={15} />
                    <span>USD ($)</span>
                  </button>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {isAr ? 'ملاحظات' : 'Notes'}
                </label>
                <input
                  value={editGroupData.notes}
                  onChange={(e) => setEditGroupData({ ...editGroupData, notes: e.target.value })}
                  className={inputClass}
                  placeholder={isAr ? 'ملاحظات إضافية...' : 'Additional notes...'}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditGroupModalOpen(false)}
                className="h-[40px] px-5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={busy || !editGroupData.groupName.trim()}
                onClick={async () => {
                  const ok = await run(
                    () =>
                      tourGroupsApi.update(g.id, {
                        groupName: editGroupData.groupName.trim(),
                        country: editGroupData.country,
                        groupType: editGroupData.groupType,
                        currency: editGroupData.currency,
                        agent: editGroupData.agent?.trim() || undefined,
                        notes: editGroupData.notes || (editGroupData.agent?.trim() ? `AGENT:${editGroupData.agent.trim()}` : undefined),
                        travelDate: editGroupData.travelDate ? new Date(editGroupData.travelDate).toISOString() : undefined,
                      }),
                    isAr ? 'تم تعديل بيانات الكروب بنجاح' : 'Group updated',
                  );
                  if (ok) setEditGroupModalOpen(false);
                }}
                className="h-[40px] px-6 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-black cursor-pointer flex items-center gap-2 shadow-2xs"
              >
                {busy ? <Loader size={14} color="white" /> : <Save size={15} />}
                <span>{isAr ? 'حفظ التعديلات' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── نافذة تأكيد حذف الكروب ── */}
      {g && deleteGroupConfirmOpen && (
        <Modal
          opened={deleteGroupConfirmOpen}
          onClose={() => setDeleteGroupConfirmOpen(false)}
          centered
          size={440}
          withCloseButton={false}
          zIndex={10050}
          classNames={{
            content: '!rounded-2xl border border-rose-200 shadow-2xl',
            body: '!p-5',
          }}
        >
          <div className="space-y-4 font-sans text-center" dir={direction}>
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900 mb-1">
                {isAr ? 'حذف الكروب السياحي' : 'Delete Tour Group'}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {isAr
                  ? `هل أنت متأكد من رغبتك في حذف الكروب «${g.groupName}»؟ سيتم حذف كافة المسافرين والبيانات التابعة له نهائياً.`
                  : `Are you sure you want to delete tour group "${g.groupName}"? All travelers and services will be permanently deleted.`}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteGroupConfirmOpen(false)}
                className="h-[40px] px-5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {isAr ? 'تراجع' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  try {
                    await tourGroupsApi.remove(g.id);
                    showSuccessNotification(isAr ? 'تم الحذف' : 'Deleted', isAr ? 'تم حذف الكروب بنجاح' : 'Group deleted');
                    setDeleteGroupConfirmOpen(false);
                    onChanged?.();
                    onClose();
                  } catch (e: any) {
                    showErrorNotification(isAr ? 'تعذّر الحذف' : 'Delete failed', e?.message || '');
                  }
                }}
                className="h-[40px] px-6 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-black cursor-pointer shadow-2xs"
              >
                {isAr ? 'تأكيد الحذف' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── نافذة سجل التعديلات ── */}
      {g && auditLogOpen && (
        <InvoiceAuditLogModal
          opened={auditLogOpen}
          onClose={() => setAuditLogOpen(false)}
          ticketNumber={g.groupName}
          customerName={g.createdByName || (isAr ? 'مدير النظام' : 'Admin')}
          initialLogs={
            g.createdAt
              ? [
                  {
                    id: `created_${g.id}`,
                    timestamp: g.createdAt,
                    userName: g.createdByName || (isAr ? 'مدير النظام' : 'System Admin'),
                    action: 'CREATE',
                    actionTitle: isAr ? 'إنشاء ملف الكروب السياحي' : 'Create tour group file',
                    notes: `${isAr ? 'تم إنشاء ملف الكروب' : 'Created group file'}: ${g.groupName} (${g.country || ''})`,
                  },
                ]
              : undefined
          }
        />
      )}

      {/* ── نافذة تدقيق وتأكيد المسافرين والأسعار ── */}
      {g && auditModalOpen && (
        <AuditPassengersModal
          opened={auditModalOpen}
          onClose={() => setAuditModalOpen(false)}
          g={g}
          isAr={isAr}
          direction={direction}
          beneficiaryGroups={beneficiaryGroups}
          onEditPax={(p) => {
            setAuditModalOpen(false);
            setPaxModal({
              open: true,
              initialCustomer: null,
              editingPassenger: p,
            });
          }}
          onUpdated={async () => {
            try {
              const fresh = await tourGroupsApi.getOne(g.id);
              setG(fresh);
              onChanged?.();
            } catch {
              // ignore
            }
          }}
        />
      )}
    </div>
  );
};

/* ── جدول المسافرين: سطر واحد لكل مسافر، لا أسطر فرعية، كليك يمين للتعديل ── */
const PassengerTable: React.FC<{
  g: TourGroup;
  passengers: GroupPassenger[];
  isAr: boolean;
  supplierOptions: Array<{ value: string; label: string; code?: string }>;
  run: (op: () => Promise<TourGroup>, ok?: string) => Promise<TourGroup | null>;
  onEditPax: (p: GroupPassenger) => void;
}> = ({ g, passengers, isAr, run, onEditPax }) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const th = 'px-3 py-2.5 text-[11px] font-black text-slate-600 whitespace-nowrap select-none';
  const td = 'px-3 py-2 text-[12px] whitespace-nowrap';

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
      <table className="w-full border-collapse text-start">
        <thead>
          <tr className="bg-slate-50/80 border-b border-slate-200 text-start">
            <th className={`${th} w-10 text-center`}>#</th>
            <th className={`${th} text-start`}>{isAr ? 'المسافر' : 'Passenger'}</th>
            <th className={`${th} text-start`}>{isAr ? 'الخدمة / البكج' : 'Package / Service'}</th>
            <th className={`${th} text-start`}>{isAr ? 'المورد' : 'Supplier'}</th>
            <th className={`${th} text-center`}>{isAr ? 'الحالة' : 'Status'}</th>
            <th className={`${th} text-end`}>{isAr ? 'سعر الشراء' : 'Buy Cost'}</th>
            <th className={`${th} text-end`}>{isAr ? 'سعر البيع' : 'Sale Price'}</th>
            <th className={`${th} text-end`}>{isAr ? 'المحصّل' : 'Collected'}</th>
            <th className={`${th} text-end`}>{isAr ? 'المتبقي' : 'Due'}</th>
            <th className={`${th} text-end`}>{isAr ? 'الربح' : 'Profit'}</th>
            <th className={`${th} text-start`}>{isAr ? 'موظف الإصدار' : 'Issuer'}</th>
            <th className={`${th} text-center w-24`}>{isAr ? 'إجراءات' : 'Actions'}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {passengers.map((p, idx) => {
            const cancelled = p.state === 'CANCELLED';
            const done = p.services.length > 0 && p.services.every((s) => s.status === 'COMPLETE');
            const sale = Number(p.salePrice) || 0;
            const paid = Number(p.collectedAmount) || 0;
            const due = sale - paid;

            let cost = 0;
            if (Array.isArray(p.services) && p.services.length > 0) {
              for (const sv of p.services) {
                const fb = (sv.finalBuy !== null && sv.finalBuy !== undefined && Number(sv.finalBuy) > 0) ? Number(sv.finalBuy) : 0;
                const eb = Number(sv.expectedBuy) || 0;
                cost += (fb > 0 ? fb : eb);
              }
            } else if (p.priceSystemId && Array.isArray(g.priceSystems)) {
              const ps = g.priceSystems.find((s) => s.id === p.priceSystemId);
              if (ps && Array.isArray(ps.items)) {
                for (const it of ps.items) {
                  cost += Number(it.expectedBuy) || 0;
                }
              }
            }
            const profit = sale - cost;

            let serviceName = '';
            if (p.priceSystemId && g.priceSystems) {
              const ps = g.priceSystems.find((s) => s.id === p.priceSystemId);
              if (ps) serviceName = ps.name;
            }
            if (!serviceName && Array.isArray(p.services) && p.services.length > 0) {
              serviceName = p.services.map((s) => (s as any).description || (KIND_META[s.kind]?.ar || s.kind)).filter(Boolean).join(' + ');
            }
            if (!serviceName) {
              serviceName = isAr ? 'بكج كامل' : 'Full Package';
            }

            let supplierName = '';
            if (Array.isArray(p.services) && p.services.length > 0) {
              supplierName = p.services.map((s) => s.supplierName).filter(Boolean).join(', ');
            }
            if (!supplierName && p.priceSystemId && g.priceSystems) {
              const ps = g.priceSystems.find((s) => s.id === p.priceSystemId);
              if (ps && ps.items) {
                supplierName = ps.items.map((it: any) => it.supplierName).filter(Boolean).join(', ');
              }
            }

            return (
              <tr
                key={p.id}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onEditPax(p);
                }}
                onDoubleClick={() => onEditPax(p)}
                title={isAr ? 'انقر بالزر الأيمن أو مرتين لتعديل بيانات المسافر' : 'Right-click or double-click to edit passenger'}
                className={`transition-colors hover:bg-orange-50/50 cursor-pointer select-none group ${
                  cancelled ? 'opacity-50 bg-slate-50/60' : ''
                }`}
              >
                <td className={`${td} text-center font-mono text-[11px] font-bold text-slate-400`}>
                  {idx + 1}
                </td>
                <td className={`${td} text-start`}>
                  <div className="flex items-center gap-2 min-w-0">
                    {cancelled ? (
                      <Ban size={14} className="text-slate-400 shrink-0" />
                    ) : done ? (
                      <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    ) : (
                      <Clock size={14} className="text-amber-500 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <span className="font-black text-slate-900 truncate block group-hover:text-[#F45A0A] transition-colors">
                        {p.passengerName}
                      </span>
                      {p.passport && (
                        <span className="text-[10px] font-mono font-bold text-slate-400 block truncate" dir="ltr">
                          {p.passport}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className={`${td} text-start`}>
                  <span className="font-bold text-slate-800 text-[11.5px] truncate block max-w-[160px]" title={serviceName}>
                    {serviceName}
                  </span>
                </td>
                <td className={`${td} text-start`}>
                  <span className="font-bold text-slate-600 text-[11px] truncate block max-w-[130px]" title={supplierName || '—'}>
                    {supplierName || '—'}
                  </span>
                </td>
                <td className={`${td} text-center`}>
                  <span
                    className={`text-[10px] font-black rounded-md px-2 py-0.5 border inline-block ${
                      cancelled
                        ? 'bg-slate-100 text-slate-500 border-slate-200'
                        : done
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {cancelled ? (isAr ? 'ملغى' : 'Cancelled') : done ? (isAr ? 'مكتمل' : 'Complete') : (isAr ? 'معلّق' : 'Pending')}
                  </span>
                </td>
                <td className={`${td} text-end font-mono font-bold text-slate-700 tabular-nums`} dir="ltr">
                  {cost > 0 ? money(cost, p.currency || g.currency) : '—'}
                </td>
                <td className={`${td} text-end font-mono font-black text-slate-900 tabular-nums`} dir="ltr">
                  {money(sale, p.currency || g.currency)}
                </td>
                <td className={`${td} text-end font-mono font-black text-emerald-700 tabular-nums`} dir="ltr">
                  {money(paid, p.currency || g.currency)}
                </td>
                <td className={`${td} text-end font-mono font-black tabular-nums ${due > 0 ? 'text-rose-600' : 'text-slate-400'}`} dir="ltr">
                  {due > 0 ? money(due, p.currency || g.currency) : '—'}
                </td>
                <td className={`${td} text-end font-mono font-black tabular-nums ${profit >= 0 ? 'text-slate-900' : 'text-rose-600'}`} dir="ltr">
                  {money(profit, p.currency || g.currency)}
                </td>
                <td className={`${td} text-start`}>
                  {p.agent || g.createdByName ? (
                    <span className="text-[10.5px] font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200/80 inline-block truncate max-w-[120px]" title={p.agent || g.createdByName}>
                      {p.agent || g.createdByName}
                    </span>
                  ) : (
                    <span className="text-slate-400 text-[11px]">—</span>
                  )}
                </td>
                <td className={`${td} text-center`} onClick={(e) => e.stopPropagation()}>
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onEditPax(p)}
                      title={isAr ? 'تعديل بيانات المسافر (أو كليك يمين)' : 'Edit passenger (or right-click)'}
                      className="w-7 h-7 rounded-lg text-[#F45A0A] hover:bg-orange-50 border border-transparent hover:border-orange-200 inline-flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <Edit2 size={13} />
                    </button>
                    {!cancelled ? (
                      <button
                        type="button"
                        onClick={() => run(() => tourGroupsApi.updatePassenger(g.id, p.id, { state: 'CANCELLED' }), isAr ? 'أُلغي الحجز' : 'Cancelled')}
                        title={isAr ? 'إلغاء الحجز' : 'Cancel'}
                        className="w-7 h-7 rounded-lg text-amber-500 hover:bg-amber-50 border border-transparent hover:border-amber-200 inline-flex items-center justify-center cursor-pointer transition-colors"
                      >
                        <Ban size={13} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => run(() => tourGroupsApi.updatePassenger(g.id, p.id, { state: 'RESERVED' }), isAr ? 'تم تفعيل الحجز' : 'Restored')}
                        title={isAr ? 'استعادة الحجز' : 'Restore'}
                        className="w-7 h-7 rounded-lg text-emerald-600 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 inline-flex items-center justify-center cursor-pointer transition-colors"
                      >
                        <CheckCircle2 size={13} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(p.id)}
                      title={isAr ? 'حذف نهائي' : 'Delete'}
                      className="w-7 h-7 rounded-lg text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-200 inline-flex items-center justify-center cursor-pointer transition-colors"
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

      {confirmDeleteId && (
        <Modal opened onClose={() => setConfirmDeleteId(null)} centered radius="lg" withCloseButton={false} zIndex={11200}>
          <div className="space-y-3 font-sans" dir={isAr ? 'rtl' : 'ltr'}>
            <p className="font-black text-sm text-slate-900">{isAr ? 'حذف المسافر؟' : 'Delete passenger?'}</p>
            <p className="text-xs font-bold text-slate-600 leading-relaxed">
              {isAr ? 'سيُحذف المسافر بكل خدماته وقيده المحاسبي نهائياً. للاحتفاظ بالسجل استخدم «إلغاء الحجز».' : 'The passenger, its services and ledger entry will be permanently removed.'}
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button type="button" onClick={() => setConfirmDeleteId(null)} className="h-9 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer">{isAr ? 'إلغاء' : 'Cancel'}</button>
              <button
                type="button"
                onClick={async () => {
                  const ok = await run(() => tourGroupsApi.removePassenger(g.id, confirmDeleteId), isAr ? 'حُذف المسافر' : 'Deleted');
                  if (ok) setConfirmDeleteId(null);
                }}
                className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black cursor-pointer"
              >
                {isAr ? 'حذف نهائي' : 'Delete'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

const PassengerRow: React.FC<{
  g: TourGroup;
  p: GroupPassenger;
  isAr: boolean;
  supplierOptions: Array<{ value: string; label: string; code?: string }>;
  open: boolean;
  toggle: () => void;
  run: (op: () => Promise<TourGroup>, ok?: string) => Promise<TourGroup | null>;
}> = ({ g, p, isAr, supplierOptions, open, toggle, run }) => {
  const done = p.services.length > 0 && p.services.every((s) => s.status === 'COMPLETE');
  const cancelled = p.state === 'CANCELLED';
  const outstanding = Number(p.salePrice) - Number(p.collectedAmount);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // احتساب تكلفة المسافر الفردي وربحه
  let paxCost = 0;
  if (Array.isArray(p.services) && p.services.length > 0) {
    for (const sv of p.services) {
      const fb = (sv.finalBuy !== null && sv.finalBuy !== undefined && Number(sv.finalBuy) > 0) ? Number(sv.finalBuy) : 0;
      const eb = Number(sv.expectedBuy) || 0;
      paxCost += (fb > 0 ? fb : eb);
    }
  } else if (p.priceSystemId && Array.isArray(g.priceSystems)) {
    const ps = g.priceSystems.find((s) => s.id === p.priceSystemId);
    if (ps && Array.isArray(ps.items)) {
      for (const it of ps.items) {
        paxCost += Number(it.expectedBuy) || 0;
      }
    }
  }
  const paxProfit = Number(p.salePrice || 0) - paxCost;

  return (
    <div
      className={`rounded-xl border transition-all ${
        cancelled
          ? 'border-slate-200 bg-slate-50/60 opacity-60'
          : done
          ? 'border-emerald-200 bg-white'
          : 'border-slate-200 bg-white'
      }`}
    >
      <div
        onClick={toggle}
        className="w-full flex items-center justify-between gap-3 p-3 cursor-pointer text-start select-none hover:bg-slate-50/50 rounded-xl"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {cancelled ? (
            <Ban size={16} className="text-slate-400 shrink-0" />
          ) : done ? (
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          ) : (
            <Clock size={16} className="text-amber-600 shrink-0" />
          )}
          <span className="font-black text-xs sm:text-sm text-slate-900 truncate">{p.passengerName}</span>
          {p.customerName && p.customerName !== p.passengerName && (
            <span className="text-[11px] font-bold text-slate-500 truncate">({p.customerName})</span>
          )}
          <span
            className={`text-[10px] font-black rounded-md px-2 py-0.5 border shrink-0 ${
              cancelled
                ? 'bg-slate-100 text-slate-500 border-slate-200'
                : done
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            {cancelled ? (isAr ? 'ملغى' : 'Cancelled') : done ? (isAr ? 'مكتمل' : 'Complete') : (isAr ? 'معلّق' : 'Pending')}
          </span>
          {p.agent && (
            <span className="text-[10px] font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded border border-orange-200 shrink-0 truncate max-w-[120px]">
              <span className="text-[9px] text-orange-400 font-sans me-0.5">{isAr ? 'مصدّر:' : 'Issuer:'}</span>
              {p.agent}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 text-xs font-mono font-black flex-wrap" dir="ltr">
          {/* التكلفة علينا */}
          <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[11px]" title={isAr ? 'التكلفة علينا' : 'Cost'}>
            <span className="text-[10px] text-slate-400 font-sans me-1">{isAr ? 'ت:' : 'C:'}</span>
            {money(paxCost, p.currency)}
          </span>

          {/* على المستفيد (البيع) مع زر تعديل سريع */}
          <span
            className="text-slate-900 bg-slate-50 hover:bg-orange-50 hover:border-orange-300 px-2 py-0.5 rounded border border-slate-200 text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
            title={isAr ? 'سعر البيع — افتح لتعديل السعر' : 'Sale Price — Open to edit'}
          >
            <span className="text-[10px] text-slate-400 font-sans me-0.5">{isAr ? 'ب:' : 'S:'}</span>
            <span>{money(p.salePrice, p.currency)}</span>
            <Edit2 size={10} className="text-slate-400" />
          </span>

          {/* ربح المسافر */}
          <span
            className={`px-2 py-0.5 rounded border text-[11px] ${
              paxProfit >= 0
                ? 'text-[#F45A0A] bg-orange-50/80 border-orange-200/80'
                : 'text-rose-600 bg-rose-50 border-rose-200'
            }`}
            title={isAr ? 'ربح المسافر' : 'Profit'}
          >
            <span className="text-[10px] opacity-70 font-sans me-1">{isAr ? 'ر:' : 'P:'}</span>
            {money(paxProfit, p.currency)}
          </span>

          {outstanding > 0 && !cancelled ? (
            <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-[11px]">
              -{money(outstanding, p.currency)}
            </span>
          ) : (
            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
              {isAr ? 'مدفوع' : 'Paid'}
            </span>
          )}
          {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-100 p-3 space-y-2 bg-slate-50/40">
          <div className="space-y-1.5">
            {p.services.map((sv) => (
              <ServiceLine key={sv.id} g={g} sv={sv} isAr={isAr} supplierOptions={supplierOptions} run={run} disabled={cancelled} />
            ))}
          </div>

          {p.services.length === 0 && (
            <p className="text-xs font-bold text-slate-400 py-1">
              {isAr ? 'لا توجد خدمات لهذا المسافر' : 'No services'}
            </p>
          )}

          {!cancelled && (
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/80 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-600">{isAr ? 'تحصيل:' : 'Collect:'}</span>
                <CollectBox g={g} p={p} isAr={isAr} run={run} />
                <PassengerPriceEdit g={g} p={p} isAr={isAr} run={run} />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    run(
                      () => tourGroupsApi.updatePassenger(g.id, p.id, { state: 'CANCELLED' }),
                      isAr ? 'أُلغي المسافر' : 'Cancelled',
                    )
                  }
                  className="h-8 px-3 rounded-lg border border-amber-200 bg-white text-amber-700 text-xs font-bold hover:bg-amber-50 cursor-pointer shadow-2xs"
                >
                  {isAr ? 'إلغاء الحجز' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  title={isAr ? 'حذف المسافر نهائياً' : 'Delete permanently'}
                  className="h-8 w-8 rounded-lg border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer shadow-2xs"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )}
          {cancelled && (
            <div className="flex items-center justify-end pt-2 border-t border-slate-200/80">
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="h-8 px-3 rounded-lg border border-rose-200 bg-white text-rose-600 text-xs font-bold hover:bg-rose-50 cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 size={13} /> {isAr ? 'حذف نهائي' : 'Delete'}
              </button>
            </div>
          )}
        </div>
      )}

      {confirmDelete && (
        <Modal opened onClose={() => setConfirmDelete(false)} centered radius="lg" withCloseButton={false} zIndex={11200}>
          <div className="space-y-3 font-sans" dir={isAr ? 'rtl' : 'ltr'}>
            <p className="font-black text-sm text-slate-900">{isAr ? 'حذف المسافر؟' : 'Delete passenger?'}</p>
            <p className="text-xs font-bold text-slate-600 leading-relaxed">
              {isAr
                ? `سيُحذف «${p.passengerName}» بكل خدماته وقيده المحاسبي نهائياً. للاحتفاظ بالسجل استخدم «إلغاء الحجز» بدلاً من الحذف.`
                : `"${p.passengerName}" and its services and ledger entry will be permanently removed.`}
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button type="button" onClick={() => setConfirmDelete(false)} className="h-9 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer">
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const ok = await run(() => tourGroupsApi.removePassenger(g.id, p.id), isAr ? 'حُذف المسافر' : 'Deleted');
                  if (ok) setConfirmDelete(false);
                }}
                className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black cursor-pointer"
              >
                {isAr ? 'حذف نهائي' : 'Delete'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

/* ── تعديل سعر بيع المسافر بسرعة ── */
const PassengerPriceEdit: React.FC<{
  g: TourGroup;
  p: GroupPassenger;
  isAr: boolean;
  run: (op: () => Promise<TourGroup>, ok?: string) => Promise<TourGroup | null>;
}> = ({ g, p, isAr, run }) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(p.salePrice ?? ''));
  useEffect(() => setVal(String(p.salePrice ?? '')), [p.salePrice]);
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="h-8 px-2.5 rounded-lg border border-orange-200 bg-orange-50 hover:bg-orange-100 text-[#F45A0A] text-[11px] font-black cursor-pointer flex items-center gap-1 shadow-2xs transition-colors"
        title={isAr ? 'تعديل سعر البيع' : 'Edit sale price'}
      >
        <Edit2 size={12} />
        <span>{isAr ? 'تعديل سعر المبيع' : 'Edit price'}</span>
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        dir="ltr"
        className="h-8 w-24 px-2 rounded-lg border border-slate-300 text-[11px] font-mono font-black text-end outline-none focus:border-[#F45A0A]"
      />
      <button
        type="button"
        onClick={async () => {
          const num = Number(String(val).replace(/,/g, '')) || 0;
          const ok = await run(() => tourGroupsApi.updatePassenger(g.id, p.id, { salePrice: num }), isAr ? 'حُدّث السعر' : 'Updated');
          if (ok) setEditing(false);
        }}
        className="h-8 px-2.5 rounded-lg bg-[#F45A0A] text-white text-[11px] font-black cursor-pointer"
      >
        {isAr ? 'حفظ' : 'Save'}
      </button>
      <button type="button" onClick={() => setEditing(false)} className="h-8 px-2 rounded-lg border border-slate-200 text-slate-500 text-[11px] font-bold cursor-pointer">
        {isAr ? 'إلغاء' : 'Cancel'}
      </button>
    </div>
  );
};

/* ── سطر الخدمة مع بحث متقدم عن المورد وسعر الشراء ── */
const ServiceLine: React.FC<{
  g: TourGroup;
  sv: GroupPassengerService;
  isAr: boolean;
  supplierOptions: Array<{ value: string; label: string; code?: string }>;
  disabled?: boolean;
  run: (op: () => Promise<TourGroup>, ok?: string) => Promise<TourGroup | null>;
}> = ({ g, sv, isAr, supplierOptions, disabled, run }) => {
  const meta = KIND_META[sv.kind] || KIND_META.PACKAGE;
  const Icon = meta.icon;
  const [supplier, setSupplier] = useState(sv.supplierName || '');

  useEffect(() => {
    setSupplier(sv.supplierName || '');
  }, [sv.supplierName]);

  const dirty = supplier !== (sv.supplierName || '');
  const complete = sv.status === 'COMPLETE';
  const buyCost = Number(sv.finalBuy ?? sv.expectedBuy ?? 0);

  return (
    <div
      className={`grid grid-cols-[minmax(110px,auto)_1fr_auto_auto] items-center gap-2 rounded-xl p-2 border ${
        complete ? 'bg-emerald-50/40 border-emerald-200' : 'bg-white border-slate-200'
      }`}
    >
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 shrink-0">
        <Icon size={14} className={complete ? 'text-emerald-600' : 'text-[#F45A0A]'} />
        <span>{isAr ? meta.ar : sv.kind}</span>
      </span>

      <div className="min-w-0">
        <SearchableCombobox
          value={supplier}
          onChange={(val) => setSupplier(val || '')}
          options={supplierOptions}
          placeholder={isAr ? 'اختر المورد...' : 'Supplier...'}
          allowCustomValue
          disabled={disabled}
        />
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span
          className="text-xs font-mono font-black text-slate-800 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 shrink-0 tabular-nums"
          dir="ltr"
          title={isAr ? 'سعر الشراء' : 'Buy Price'}
        >
          <span className="text-[10px] text-slate-400 font-sans me-1">{isAr ? 'شراء:' : 'Cost:'}</span>
          {money(buyCost, sv.currency || g.currency)}
        </span>
      </div>

      {dirty ? (
        <button
          type="button"
          onClick={() =>
            run(
              () =>
                tourGroupsApi.updateService(g.id, sv.id, {
                  supplierName: supplier,
                }),
              undefined,
            )
          }
          className="h-9 px-3.5 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white text-xs font-black cursor-pointer shadow-2xs"
        >
          {isAr ? 'حفظ' : 'Save'}
        </button>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            run(
              () =>
                tourGroupsApi.updateService(g.id, sv.id, {
                  status: complete ? 'NOT_COMPLETE' : 'COMPLETE',
                }),
              undefined,
            )
          }
          className={`text-[10.5px] font-black rounded-md px-2.5 py-1.5 border cursor-pointer transition-colors ${
            complete
              ? 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200'
              : 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200'
          }`}
          title={isAr ? 'انقر لتبديل حالة الخدمة' : 'Toggle status'}
        >
          {complete ? (isAr ? 'مكتمل' : 'Complete') : (isAr ? 'معلّق' : 'Pending')}
        </button>
      )}
    </div>
  );
};

/* ── تحصيل الدفعة ── */
const CollectBox: React.FC<{
  g: TourGroup;
  p: GroupPassenger;
  isAr: boolean;
  run: (op: () => Promise<TourGroup>, ok?: string) => Promise<TourGroup | null>;
}> = ({ g, p, isAr, run }) => {
  const [val, setVal] = useState('');
  const outstanding = Number(p.salePrice) - Number(p.collectedAmount);
  if (outstanding <= 0)
    return <span className="text-xs font-black text-emerald-700">{isAr ? 'محصَّل بالكامل' : 'Paid'}</span>;

  return (
    <div className="flex items-center gap-1.5">
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        dir="ltr"
        placeholder={String(outstanding)}
        className="h-8 w-24 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-mono font-black text-end outline-none focus:border-[#F45A0A]"
      />
      <button
        type="button"
        onClick={() => {
          const add = num(val) || outstanding;
          run(
            () => tourGroupsApi.updatePassenger(g.id, p.id, { collectedAmount: Number(p.collectedAmount) + add }),
            isAr ? 'سُجّل التحصيل' : 'Collected',
          );
          setVal('');
        }}
        className="h-8 px-3 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-black hover:bg-emerald-100 cursor-pointer shadow-2xs"
      >
        {isAr ? 'تحصيل' : 'Collect'}
      </button>
    </div>
  );
};

/* ── نافذة نظام الأسعار: إمكانية تعديل سعر المبيع وموظف الإصدار ومدخل البيانات ── */
const PriceSystemModal: React.FC<{
  isAr: boolean;
  direction: string;
  draft: Partial<GroupPriceSystem>;
  groupCurrency: string;
  supplierOptions: Array<{ value: string; label: string; code?: string }>;
  currentUserName?: string;
  employeeOptions?: Array<{ value: string; label: string }>;
  onClose: () => void;
  onSave: (dto: any) => void;
  busy?: boolean;
}> = ({ isAr, direction, draft, groupCurrency, supplierOptions, currentUserName, employeeOptions, onClose, onSave, busy }) => {
  const [supplierFinderIndex, setSupplierFinderIndex] = useState<number | null>(null);

  const [d, setD] = useState<any>(() => {
    const defaultItems =
      draft?.items && draft.items.length > 0
        ? draft.items.map((it: any) => ({
            ...it,
            kind: it.kind === 'PACKAGE' ? 'FULL_PACKAGE' : it.kind,
          }))
        : [{ kind: 'TICKET', supplierName: '', expectedBuy: '', currency: groupCurrency }];
    return {
      currency: groupCurrency,
      seats: 9999,
      ...draft,
      items: defaultItems,
    };
  });

  const cleanSupplierNames = useMemo(() => {
    const names = (supplierOptions || [])
      .map((s) => (s.label || s.value || '').trim())
      .filter(Boolean);
    return Array.from(new Set(names));
  }, [supplierOptions]);

  const patchItem = (i: number, ch: any) =>
    setD((prev: any) => ({
      ...prev,
      items: prev.items.map((it: any, j: number) => (j === i ? { ...it, ...ch } : it)),
    }));

  const formatWithCommas = (val: any) => {
    if (val === '' || val === null || val === undefined) return '';
    const str = String(val).replace(/,/g, '');
    const parts = str.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  const KIND_SELECT_OPTIONS = [
    { value: 'TICKET', label: isAr ? 'طيران' : 'Ticket' },
    { value: 'HOTEL', label: isAr ? 'فندق' : 'Hotel' },
    { value: 'VISA', label: isAr ? 'فيزا' : 'Visa' },
    { value: 'TRANSPORT', label: isAr ? 'نقل' : 'Transport' },
    { value: 'INSURANCE', label: isAr ? 'تأمين' : 'Insurance' },
    { value: 'GUIDE', label: isAr ? 'مرشد' : 'Guide' },
    { value: 'FULL_PACKAGE', label: isAr ? 'بكج كامل' : 'Full Package' },
  ];

  const addItem = (kind = 'TICKET') => {
    setD((prev: any) => ({
      ...prev,
      items: [
        ...(prev.items || []),
        {
          kind,
          supplierName: '',
          expectedBuy: '',
          currency: prev.currency || groupCurrency,
        },
      ],
    }));
  };

  const totals = useMemo(() => {
    let usd = 0;
    let iqd = 0;
    (d.items || []).forEach((it: any) => {
      const curr = it.currency || d.currency || 'USD';
      const val = Number(String(it.expectedBuy || 0).replace(/,/g, '')) || 0;
      if (curr === 'IQD') iqd += val;
      else usd += val;
    });
    return { usd, iqd };
  }, [d.items, d.currency]);

  return (
    <Modal
      opened
      onClose={onClose}
      centered
      size={880}
      withCloseButton={false}
      zIndex={10050}
      classNames={{
        content: '!rounded-2xl border border-slate-200 shadow-2xl !overflow-visible',
        body: '!p-5 !overflow-visible',
      }}
    >
      <div className="flex flex-col h-[560px] font-sans select-none" dir={direction}>
        {/* الترويسة المقتضبة */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#F45A0A] flex items-center justify-center">
              <Coins size={16} />
            </div>
            <h3 className="font-black text-sm text-slate-900">
              {d.id ? (isAr ? 'تعديل نظام الأسعار' : 'Edit Price System') : isAr ? 'نظام أسعار جديد' : 'New Price System'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* بيانات النظام وسعر البيع ومسؤول الإصدار */}
        <div className="shrink-0 pt-3 space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Field label={isAr ? 'اسم النظام *' : 'System Name *'}>
              <input
                value={d.name || ''}
                onChange={(e) => setD({ ...d, name: e.target.value })}
                className={inputClass}
                placeholder={isAr ? 'مثال: بكج شامل، أو VIP' : 'e.g. Full Package'}
                autoFocus
              />
            </Field>

            <Field label={isAr ? 'سعر البيع للمسافر *' : 'Sale Price *'}>
              <div className="flex items-center gap-1.5">
                <input
                  value={formatWithCommas(d.salePrice ?? '')}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/,/g, '').replace(/[^0-9.]/g, '');
                    const parts = raw.split('.');
                    const clean = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : raw;
                    setD({ ...d, salePrice: clean });
                  }}
                  dir="ltr"
                  placeholder="0"
                  className={`${inputClass} font-mono font-black text-end text-sm`}
                />
                <button
                  type="button"
                  onClick={() => {
                    const nextCur = (d.currency || groupCurrency) === 'USD' ? 'IQD' : 'USD';
                    setD({ ...d, currency: nextCur });
                  }}
                  className="h-[46px] px-3.5 rounded-[11px] font-mono font-black text-xs bg-orange-50 hover:bg-orange-100 text-[#F45A0A] border border-orange-200 flex items-center shrink-0 cursor-pointer shadow-2xs"
                  title={isAr ? 'انقر لتبديل العملة' : 'Toggle Currency'}
                >
                  {d.currency || groupCurrency}
                </button>
              </div>
            </Field>
          </div>
        </div>

        {/* بنود الخدمات المضمنة */}
        <div className="shrink-0 pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-800">
              {isAr ? 'بنود الخدمات المضمنة:' : 'Included Services:'}
            </span>
            <button
              type="button"
              onClick={() => addItem('TICKET')}
              className="h-8 px-3 rounded-xl border border-orange-200 bg-orange-50 text-[#F45A0A] text-xs font-black cursor-pointer flex items-center gap-1.5 hover:bg-orange-100 transition-colors shadow-2xs"
            >
              <Plus size={14} />
              <span>{isAr ? 'إضافة بند خدمة' : 'Add Item'}</span>
            </button>
          </div>

          {d.items && d.items.length > 0 && (
            <div className="grid grid-cols-[130px_1fr_210px_36px] gap-2.5 px-2 text-[11px] font-bold text-slate-500">
              <span>{isAr ? 'اختيار البند' : 'Select Item'}</span>
              <span>{isAr ? 'المورد' : 'Supplier'}</span>
              <span className="text-end">{isAr ? 'سعر الشراء والعملة' : 'Buy Price & Currency'}</span>
              <span></span>
            </div>
          )}
        </div>

        {/* منطقة البنود: ارتفاع مرن وتمرير داخلي يحافظ على ثبات حجم النافذة كلياً */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 py-2 pr-1 [scrollbar-width:thin]">
          {(d.items || []).map((it: any, i: number) => (
            <div
              key={i}
              style={{ zIndex: (d.items?.length || 10) - i, position: 'relative' }}
              className="grid grid-cols-[130px_1fr_210px_auto] items-center gap-2.5 bg-slate-50/70 border border-slate-200 rounded-xl p-2 hover:bg-slate-50 transition-colors"
            >
              {/* اختيار البند عبر Portal */}
              <div className="min-w-0">
                <Select
                  value={it.kind || 'TICKET'}
                  onChange={(val) => patchItem(i, { kind: val || 'TICKET' })}
                  data={KIND_SELECT_OPTIONS}
                  comboboxProps={{
                    withinPortal: true,
                    zIndex: 10070,
                    shadow: 'xl',
                  }}
                  allowDeselect={false}
                  classNames={{
                    input:
                      '!h-[44px] !rounded-[10px] !border-[#E5E7EB] !bg-white !text-xs !font-bold !text-slate-900 focus:!border-2 focus:!border-[#F45A0A] !shadow-none',
                    dropdown: '!rounded-[12px] !border-[#E5E7EB] !shadow-2xl !p-1.5',
                    option:
                      '!text-xs !font-bold !rounded-[8px] !py-2.5 hover:!bg-orange-50 hover:!text-[#F45A0A] data-[checked=true]:!bg-orange-50 data-[checked=true]:!text-[#F45A0A]',
                  }}
                />
              </div>

              {/* المورد مع إمكانية الكتابة والبحث + زر البحث المتقدم بأيقونة فقط */}
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="flex-1 min-w-0">
                  <Autocomplete
                    value={it.supplierName || ''}
                    onChange={(val) => patchItem(i, { supplierName: val })}
                    data={cleanSupplierNames}
                    comboboxProps={{
                      withinPortal: true,
                      zIndex: 10070,
                      shadow: 'xl',
                    }}
                    placeholder={isAr ? 'اختر أو اكتب اسم المورد' : 'Supplier'}
                    classNames={{
                      input:
                        '!h-[44px] !rounded-[10px] !border-[#E5E7EB] !bg-white !text-xs !font-bold !text-slate-900 focus:!border-2 focus:!border-[#F45A0A] !shadow-none',
                      dropdown: '!rounded-[12px] !border-[#E5E7EB] !shadow-2xl !p-1.5',
                      option:
                        '!text-xs !font-bold !rounded-[8px] !py-2 hover:!bg-orange-50 hover:!text-[#F45A0A]',
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setSupplierFinderIndex(i)}
                  className="h-[44px] w-[44px] rounded-[10px] border border-orange-200 bg-orange-50 hover:bg-orange-100 text-[#F45A0A] flex items-center justify-center shrink-0 cursor-pointer transition-colors shadow-2xs"
                  title={isAr ? 'البحث المتقدم عن المورد' : 'Advanced Supplier Search'}
                >
                  <Search size={16} />
                </button>
              </div>

              {/* سعر الشراء مع الفواصل وإمكانية تغيير العملة باللون البرتقالي وبدون تسمية عربية */}
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="flex-1 flex items-center h-[44px] min-w-0 rounded-[10px] border border-[#E5E7EB] bg-white px-2.5 focus-within:border-2 focus-within:border-[#F45A0A] transition-colors">
                  <input
                    value={formatWithCommas(it.expectedBuy ?? '')}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/,/g, '').replace(/[^0-9.]/g, '');
                      const parts = raw.split('.');
                      const clean = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : raw;
                      patchItem(i, { expectedBuy: clean });
                    }}
                    dir="ltr"
                    placeholder="0"
                    className="w-full bg-transparent font-mono font-black text-xs text-slate-900 outline-none text-end tabular-nums"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const cur = (it.currency || d.currency || 'USD') === 'USD' ? 'IQD' : 'USD';
                    patchItem(i, { currency: cur });
                  }}
                  className="h-[44px] px-3.5 rounded-[10px] text-xs font-black font-mono flex items-center justify-center border border-orange-200 bg-orange-50 hover:bg-orange-100 text-[#F45A0A] transition-all cursor-pointer select-none shrink-0 shadow-2xs"
                  title={isAr ? 'انقر للتبديل بين USD و IQD' : 'Toggle USD / IQD'}
                >
                  {(it.currency || d.currency || 'USD') === 'USD' ? 'USD' : 'IQD'}
                </button>
              </div>

              {/* زر الحذف */}
              <button
                type="button"
                onClick={() => setD({ ...d, items: d.items.filter((_: any, j: number) => j !== i) })}
                className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:border-rose-300 flex items-center justify-center cursor-pointer transition-colors shadow-2xs shrink-0"
                title={isAr ? 'حذف البند' : 'Remove item'}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}

          {d.items.length === 0 && (
            <div className="h-full min-h-[140px] flex items-center justify-center border-2 border-dashed border-slate-200 rounded-xl">
              <p className="text-xs font-bold text-slate-400">
                {isAr ? 'لا توجد خدمات مضافة بعد' : 'No service items added yet'}
              </p>
            </div>
          )}
        </div>

        {/* الشريط السفلي الثابت - محاذاة ثابتة لا تتغير إطلاقاً */}
        <div className="shrink-0 pt-3 border-t border-slate-100 space-y-2.5">
          <div className="flex items-center justify-between px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <span className="font-bold text-slate-600">
              {isAr ? 'إجمالي سعر الشراء:' : 'Total Cost:'}
            </span>
            <div className="flex items-center gap-2 font-mono font-black text-xs" dir="ltr">
              {totals.usd > 0 && (
                <span className="text-[#F45A0A] bg-orange-50 px-2.5 py-1 rounded-lg border border-orange-200">
                  {totals.usd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USD
                </span>
              )}
              {totals.iqd > 0 && (
                <span className="text-[#F45A0A] bg-orange-50 px-2.5 py-1 rounded-lg border border-orange-200">
                  {totals.iqd.toLocaleString('en-US')} IQD
                </span>
              )}
              {totals.usd === 0 && totals.iqd === 0 && (
                <span className="text-slate-500">0 {d.currency || groupCurrency}</span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="h-[40px] px-5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              disabled={busy || !d.name?.trim()}
              onClick={() =>
                onSave({
                  ...d,
                  salePrice: Number(String(d.salePrice || 0).replace(/,/g, '')) || 0,
                  seats: 9999,
                  items: (d.items || []).map((it: any) => ({
                    ...it,
                    expectedBuy: Number(String(it.expectedBuy || 0).replace(/,/g, '')) || 0,
                    currency: it.currency || d.currency || groupCurrency,
                  })),
                })
              }
              className="h-[40px] px-6 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-black cursor-pointer shadow-2xs flex items-center gap-2"
            >
              {busy && <Loader size={13} color="white" />}
              {busy ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : isAr ? 'حفظ نظام الأسعار' : 'Save System'}
            </button>
          </div>
        </div>

        {/* نافذة البحث المتقدم عن المورد */}
        <AccountFinderModal
          opened={supplierFinderIndex !== null}
          initialQuery={supplierFinderIndex !== null ? d.items[supplierFinderIndex]?.supplierName || '' : ''}
          initialScope="SUPPLIER"
          title={isAr ? 'البحث المتقدم عن المورد' : 'Advanced Search: Supplier'}
          zIndex={11000}
          onClose={() => setSupplierFinderIndex(null)}
          onSelect={(account: AccountFinderResult) => {
            if (supplierFinderIndex !== null) {
              patchItem(supplierFinderIndex, {
                supplierName: account.name,
                supplierAccountId: account.id,
              });
            }
            setSupplierFinderIndex(null);
          }}
        />
      </div>
    </Modal>
  );
};

/* ── نافذة إضافة شراء عام أو مصروف: بحث متقدم عن المورد ── */
const ChargeModal: React.FC<{
  isAr: boolean;
  direction: string;
  chargeType: 'GLOBAL_PURCHASE' | 'EXPENSE';
  currency: string;
  supplierOptions: Array<{ value: string; label: string; code?: string }>;
  onClose: () => void;
  onSave: (dto: any) => void;
  busy?: boolean;
}> = ({ isAr, direction, chargeType, currency, supplierOptions, onClose, onSave, busy }) => {
  const [d, setD] = useState<any>({ chargeType, currency, category: '', amount: 0, supplierName: '' });
  const [accountFinder, setAccountFinder] = useState<{ open: boolean; query: string }>({
    open: false,
    query: '',
  });
  const isExp = chargeType === 'EXPENSE';
  const presets = isExp
    ? ['دعاية وإعلان', 'عمولات سياحية', 'ضيافة وإدارة', 'أخرى']
    : ['استئجار باصات', 'حجوزات فندقية', 'نقل عام', 'أخرى'];

  return (
    <Modal
      opened
      onClose={onClose}
      centered
      size={580}
      withCloseButton={false}
      zIndex={10050}
      classNames={{
        content: '!rounded-2xl border border-slate-200 shadow-2xl !overflow-visible',
        body: '!p-5',
      }}
    >
      <div className="space-y-3.5 font-sans" dir={direction}>
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#F45A0A] flex items-center justify-center">
              <Banknote size={16} />
            </div>
            <h3 className="font-black text-sm text-slate-900">
              {isExp ? (isAr ? 'تسجيل مصروف عام' : 'Add Expense') : isAr ? 'تسجيل شراء عام' : 'Add Purchase'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        <Field label={isAr ? 'التصنيف *' : 'Category *'}>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {presets.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setD({ ...d, category: c })}
                className={`text-xs font-bold rounded-lg px-2.5 py-1 border cursor-pointer transition-all ${
                  d.category === c
                    ? 'bg-[#F45A0A] text-white border-[#F45A0A]'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <input
            value={d.category}
            onChange={(e) => setD({ ...d, category: e.target.value })}
            className={inputClass}
            placeholder={isAr ? 'التصنيف' : 'Category'}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <Field label={isAr ? 'المبلغ *' : 'Amount *'}>
            <input
              value={d.amount || ''}
              onChange={(e) => setD({ ...d, amount: num(e.target.value) })}
              dir="ltr"
              className={`${inputClass} font-mono text-end`}
              placeholder="0.00"
            />
          </Field>
          <Field
            label={isAr ? 'المورد / الجهة المستلمة' : 'Supplier'}
            action={
              <button
                type="button"
                onClick={() => setAccountFinder({ open: true, query: d.supplierName || '' })}
                className="h-[20px] px-1.5 text-[10.5px] font-bold text-[#F45A0A] hover:text-[#dd4f05] flex items-center gap-1 cursor-pointer bg-orange-50 hover:bg-orange-100 rounded border border-orange-200 transition-colors"
                title={isAr ? 'البحث المتقدم في كل الحسابات' : 'Advanced Account Search'}
              >
                <Search size={11} />
                <span>{isAr ? 'بحث متقدم' : 'Search'}</span>
              </button>
            }
          >
            <SearchableCombobox
              value={d.supplierName || ''}
              onChange={(val) => setD({ ...d, supplierName: val || '' })}
              options={supplierOptions}
              placeholder={isAr ? 'اختر أو ابحث عن المورد' : 'Supplier'}
              allowCustomValue
            />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="h-[40px] px-5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={busy || !d.amount || d.amount <= 0}
            onClick={() => onSave(d)}
            className="h-[40px] px-6 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-black cursor-pointer shadow-2xs flex items-center gap-2"
          >
            {busy && <Loader size={13} color="white" />}
            {busy ? (isAr ? 'جارٍ الإضافة…' : 'Adding…') : isAr ? 'إضافة' : 'Add'}
          </button>
        </div>

        <AccountFinderModal
          opened={accountFinder.open}
          initialQuery={accountFinder.query}
          initialScope="SUPPLIER"
          title={isAr ? 'البحث المتقدم عن المورد' : 'Advanced Search: Supplier'}
          zIndex={11000}
          onClose={() => setAccountFinder({ open: false, query: '' })}
          onSelect={(account: AccountFinderResult) => {
            setD((prev: any) => ({
              ...prev,
              supplierName: account.name,
              supplierAccountId: account.id,
            }));
            setAccountFinder({ open: false, query: '' });
          }}
        />
      </div>
    </Modal>
  );
};

/* ── نافذة إضافة ملف مستفيد جديد: مع إظهار مدخل البيانات وموظف الإصدار ── */
const NewBeneficiaryModal: React.FC<{
  isAr: boolean;
  direction: string;
  currentUserName?: string;
  employeeOptions?: Array<{ value: string; label: string }>;
  onClose: () => void;
  onSelect: (beneficiary: { name: string; accountId: string | null; id?: string | null; agent?: string }) => void;
}> = ({ isAr, direction, currentUserName, employeeOptions, onClose, onSelect }) => {
  const [selectedAccount, setSelectedAccount] = useState<{ id: string | null; name: string }>({
    id: null,
    name: '',
  });
  const [issuerEmployee, setIssuerEmployee] = useState<string>(currentUserName || '');
  const [accountFinder, setAccountFinder] = useState<{ open: boolean; query: string }>({
    open: false,
    query: '',
  });

  const handleConfirm = () => {
    if (!selectedAccount.name.trim()) return;
    onSelect({
      name: selectedAccount.name.trim(),
      accountId: selectedAccount.id,
      agent: issuerEmployee || undefined,
    });
  };

  return (
    <Modal
      opened
      onClose={onClose}
      centered
      size={500}
      withCloseButton={false}
      zIndex={10060}
      classNames={{
        content: '!rounded-2xl border border-slate-200 shadow-2xl !overflow-visible',
        body: '!p-5',
      }}
    >
      <div className="space-y-4 font-sans" dir={direction}>
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#F45A0A] flex items-center justify-center">
              <FolderPlus size={16} />
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-900">
                {isAr ? 'إضافة ملف مستفيد جديد' : 'New Beneficiary File'}
              </h3>
              <p className="text-[11px] font-bold text-slate-400">
                {isAr ? 'اختر العميل أو الحساب لتخصيص ملف حجز خاص به وإضافة مسافريه' : 'Select client for booking file'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* تنويه مدخل البيانات */}
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-bold">{isAr ? 'مدخل البيانات:' : 'Data Entry:'}</span>
            <span className="font-black text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 font-sans">
              {currentUserName || (isAr ? 'مدير النظام' : 'System Admin')}
            </span>
          </div>
        </div>

        <Field
          label={isAr ? 'اسم المستفيد / العميل / الحساب *' : 'Beneficiary / Client Account *'}
          action={
            <button
              type="button"
              onClick={() => setAccountFinder({ open: true, query: selectedAccount.name || '' })}
              className="h-[20px] px-1.5 text-[10.5px] font-bold text-[#F45A0A] hover:text-[#dd4f05] flex items-center gap-1 cursor-pointer bg-orange-50 hover:bg-orange-100 rounded border border-orange-200 transition-colors"
              title={isAr ? 'البحث المتقدم في كل الحسابات' : 'Advanced Account Search'}
            >
              <Search size={11} />
              <span>{isAr ? 'بحث متقدم' : 'Search'}</span>
            </button>
          }
        >
          <AccountSearchField
            value={selectedAccount.name}
            direction={direction}
            inputClass={inputClass}
            placeholder={isAr ? 'اكتب اسم العميل أو المستفيد…' : 'Type client name…'}
            onPick={(pick: AccountPick) => {
              setSelectedAccount({
                id: pick.id,
                name: pick.name,
              });
            }}
          />
        </Field>

        <Field label={isAr ? 'موظف الإصدار / المصدر' : 'Issuing Employee / Issuer'}>
          <SearchableCombobox
            value={issuerEmployee}
            onChange={(val) => setIssuerEmployee(val || '')}
            options={employeeOptions || []}
            placeholder={isAr ? 'اختر موظف الإصدار...' : 'Select issuing employee...'}
            allowCustomValue
          />
        </Field>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="h-[40px] px-5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={!selectedAccount.name.trim()}
            onClick={handleConfirm}
            className="h-[40px] px-6 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-black cursor-pointer shadow-2xs flex items-center gap-1.5"
          >
            <FolderPlus size={14} />
            <span>{isAr ? 'إنشاء الملف والبدء بإضافة المسافرين' : 'Create & Add Passengers'}</span>
          </button>
        </div>
      </div>

      {accountFinder.open && (
        <AccountFinderModal
          opened={accountFinder.open}
          initialQuery={accountFinder.query}
          initialScope="CUSTOMER"
          title={isAr ? 'البحث المتقدم عن العميل / المستفيد' : 'Advanced Search: Customer'}
          zIndex={11000}
          onClose={() => setAccountFinder({ open: false, query: '' })}
          onSelect={(account: AccountFinderResult) => {
            setSelectedAccount({
              id: account.id,
              name: account.name,
            });
            setAccountFinder({ open: false, query: '' });
          }}
        />
      )}
    </Modal>
  );
};

/* ── نافذة إضافة مسافر جديد ── */
const PassengerModal: React.FC<{
  isAr: boolean;
  direction: string;
  g: TourGroup;
  customerOptions: any[];
  initialCustomer?: { name: string; id?: string | null; accountId?: string | null; agent?: string } | null;
  editingPassenger?: GroupPassenger | null;
  currentUserName?: string;
  employeeOptions?: Array<{ value: string; label: string }>;
  onClose: () => void;
  onSave: (dto: any) => Promise<boolean>;
  busy?: boolean;
  errorMsg?: string;
}> = ({
  isAr,
  direction,
  g,
  customerOptions,
  initialCustomer,
  editingPassenger,
  currentUserName,
  employeeOptions,
  onClose,
  onSave,
  busy,
  errorMsg,
}) => {
  const isEditing = !!editingPassenger;
  const activeSystems = g.priceSystems.filter((s) => s.active);
  const user = useAuthStore((s) => s.user);
  const currentUserAgent = currentUserName || user?.name || (user as any)?.fullName || (user as any)?.username || (isAr ? 'مدير النظام' : 'System Admin');
  const passengerInputRef = useRef<HTMLInputElement>(null);
  const [addedCount, setAddedCount] = useState(0);
  const [lastAddedName, setLastAddedName] = useState('');

  const [d, setD] = useState<any>(() => {
    if (editingPassenger) {
      return {
        priceSystemId: editingPassenger.priceSystemId || activeSystems[0]?.id || '',
        passengerName: editingPassenger.passengerName || '',
        customerName: editingPassenger.customerName || '',
        customerId: editingPassenger.customerId || null,
        customerAccountId: (editingPassenger as any).customerAccountId || null,
        passport: editingPassenger.passport || '',
        agent: editingPassenger.agent || currentUserAgent,
        payType: editingPassenger.payType || 'CASH',
        paymentMethod: (editingPassenger as any).paymentMethod || 'CASH_HAND',
        paymentAccountId: editingPassenger.paymentAccountId || null,
        voucherNumber: editingPassenger.voucherNumber || '',
        currency: editingPassenger.currency || g.currency || 'IQD',
        salePrice: editingPassenger.salePrice !== undefined ? Number(editingPassenger.salePrice) : (activeSystems[0] ? Number(activeSystems[0].salePrice) : 0),
      };
    }
    return {
      priceSystemId: activeSystems[0]?.id || '',
      passengerName: '',
      customerName: initialCustomer?.name || '',
      customerId: initialCustomer?.id || null,
      customerAccountId: initialCustomer?.accountId || null,
      passport: '',
      agent: (initialCustomer as any)?.agent || currentUserAgent,
      payType: 'CASH',
      paymentMethod: 'CASH_HAND',
      paymentAccountId: null,
      voucherNumber: '',
      currency: activeSystems[0]?.currency || g.currency || 'IQD',
      salePrice: activeSystems[0] ? Number(activeSystems[0].salePrice) : 0,
    };
  });

  useEffect(() => {
    if (editingPassenger) {
      setD({
        priceSystemId: editingPassenger.priceSystemId || activeSystems[0]?.id || '',
        passengerName: editingPassenger.passengerName || '',
        customerName: editingPassenger.customerName || '',
        customerId: editingPassenger.customerId || null,
        customerAccountId: (editingPassenger as any).customerAccountId || null,
        passport: editingPassenger.passport || '',
        agent: editingPassenger.agent || currentUserAgent,
        payType: editingPassenger.payType || 'CASH',
        paymentMethod: (editingPassenger as any).paymentMethod || 'CASH_HAND',
        paymentAccountId: editingPassenger.paymentAccountId || null,
        voucherNumber: editingPassenger.voucherNumber || '',
        currency: editingPassenger.currency || g.currency || 'IQD',
        salePrice: editingPassenger.salePrice !== undefined ? Number(editingPassenger.salePrice) : (activeSystems[0] ? Number(activeSystems[0].salePrice) : 0),
      });
    } else if (initialCustomer) {
      setD((prev: any) => ({
        ...prev,
        customerName: initialCustomer.name || '',
        customerAccountId: initialCustomer.accountId || null,
        customerId: initialCustomer.id || null,
        agent: (initialCustomer as any)?.agent || prev.agent || currentUserAgent,
      }));
    }
  }, [editingPassenger, initialCustomer, currentUserAgent]);

  const [paymentAccounts, setPaymentAccounts] = useState<any[]>([]);
  const [employeesList, setEmployeesList] = useState<any[]>([]);
  const [transferImage, setTransferImage] = useState<string | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [accountFinder, setAccountFinder] = useState<{ open: boolean; query: string }>({
    open: false,
    query: '',
  });

  useEffect(() => {
    accountsApi
      .getFlat(undefined, undefined, true)
      .then((res: any) => {
        const list = Array.isArray(res) ? res : res?.data || [];
        setPaymentAccounts(list);
      })
      .catch(() => setPaymentAccounts([]));

    employeesApi
      .getAll()
      .then((res: any) => {
        const list = Array.isArray(res) ? res : res?.data || [];
        setEmployeesList(list);
      })
      .catch(() => setEmployeesList([]));
  }, []);

  const formatWithCommas = (val: any) => {
    if (val === '' || val === null || val === undefined) return '';
    const str = String(val).replace(/,/g, '');
    const parts = str.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  const cashAccounts = useMemo(() => {
    const list = paymentAccounts.filter((a) => {
      if (a.isGroup || a.isParent) return false;
      const cat = (a.category || '').toUpperCase();
      const type = (a.type || a.accountType || '').toUpperCase();
      const code = String(a.code || '');
      const name = `${a.nameAr || ''} ${a.nameEn || ''} ${a.name || ''}`.toLowerCase();
      // استثناء حسابات الماستر والبطاقات الإلكترونية من الصناديق النقدية
      if (
        name.includes('ماستر') ||
        name.includes('master') ||
        name.includes('بطاقة') ||
        name.includes('visa') ||
        name.includes('فيزا')
      ) {
        return false;
      }
      return (
        cat === 'CASH' ||
        type === 'CASH' ||
        type === 'TREASURY' ||
        code.startsWith('181') ||
        code.startsWith('101') ||
        name.includes('صندوق') ||
        name.includes('خزينة') ||
        name.includes('cash')
      );
    });
    return list.map((a) => ({
      value: a.id,
      label: isAr ? (a.nameAr || a.name || a.nameEn || a.id) : (a.nameEn || a.nameAr || a.name || a.id),
      code: a.code,
    }));
  }, [paymentAccounts, isAr]);

  const masterAccounts = useMemo(() => {
    const list = paymentAccounts.filter((a) => {
      if (a.isGroup || a.isParent) return false;
      const cat = (a.category || '').toUpperCase();
      const type = (a.type || a.accountType || '').toUpperCase();
      const code = String(a.code || '');
      const name = `${a.nameAr || ''} ${a.nameEn || ''} ${a.name || ''}`.toLowerCase();
      return (
        name.includes('ماستر') ||
        name.includes('master') ||
        name.includes('بطاقة') ||
        name.includes('فيزا') ||
        name.includes('visa') ||
        name.includes('كي كارد') ||
        name.includes('qi') ||
        name.includes('زين كاش') ||
        name.includes('zain') ||
        cat === 'BANK' ||
        type === 'BANK' ||
        code.startsWith('102') ||
        code.startsWith('111')
      );
    });
    return list.map((a) => ({
      value: a.id,
      label: isAr ? (a.nameAr || a.name || a.nameEn || a.id) : (a.nameEn || a.nameAr || a.name || a.id),
      code: a.code,
    }));
  }, [paymentAccounts, isAr]);

  const currentEmployee = useMemo(() => {
    if (!user) return null;
    const uName = String(user.name || '').trim().toLowerCase();
    const uEmail = String(user.email || '').trim().toLowerCase();
    const uUsername = String((user as any)?.username || '').trim().toLowerCase();
    return (
      employeesList.find((e: any) => {
        if (e.id === user.id || e.userId === user.id) return true;
        const names = [e.fullName, e.name, e.username, e.email, e.user?.name, e.user?.username];
        return names.some((n) => {
          if (!n) return false;
          const s = String(n).trim().toLowerCase();
          return (uName && s === uName) || (uUsername && s === uUsername) || (uEmail && s === uEmail);
        });
      }) || null
    );
  }, [employeesList, user]);

  const matchedEmployeeCashbox = useMemo(() => {
    if (cashAccounts.length === 0) return null;
    const assigned = String(
      currentEmployee?.assignedCashbox ||
        (currentEmployee as any)?.assignedCashboxId ||
        (currentEmployee as any)?.cashboxId ||
        (currentEmployee as any)?.cashboxAccountId ||
        '',
    ).trim();

    if (assigned) {
      const hint = assigned.toLowerCase();
      const found = cashAccounts.find((c) => {
        const val = String(c.value || '').toLowerCase();
        const code = String((c as any).code || '').toLowerCase();
        const label = String(c.label || '').toLowerCase();
        return val === hint || code === hint || label === hint || label.includes(hint);
      });
      if (found) return found;
    }

    const empName = currentEmployee?.fullName || currentEmployee?.name || user?.name || '';
    if (empName) {
      const firstName = empName.split(' ')[0].toLowerCase();
      const foundByName = cashAccounts.find((c) => {
        const label = (c.label || '').toLowerCase();
        return label.includes(empName.toLowerCase()) || (firstName.length >= 3 && label.includes(firstName));
      });
      if (foundByName) return foundByName;
    }

    return cashAccounts[0] || null;
  }, [cashAccounts, currentEmployee, user]);

  const defaultMasterAccount = useMemo(() => {
    const foundMaster = masterAccounts.find(
      (m) => m.label.toLowerCase().includes('ماستر') || m.label.toLowerCase().includes('master'),
    );
    return foundMaster || masterAccounts[0] || null;
  }, [masterAccounts]);

  const issuerComboboxOptions = useMemo(() => {
    const list =
      employeeOptions && employeeOptions.length > 0
        ? [...employeeOptions]
        : employeesList.map((e: any) => ({
            value: e.fullName || e.name || e.id,
            label: e.fullName || e.name || e.username || '',
          }));
    if (currentUserAgent && !list.some((o) => o.value === currentUserAgent || o.label === currentUserAgent)) {
      list.unshift({ value: currentUserAgent, label: currentUserAgent });
    }
    return list;
  }, [employeeOptions, employeesList, currentUserAgent]);

  useEffect(() => {
    if (d.payType === 'CASH') {
      if (d.paymentMethod === 'MASTER') {
        if (defaultMasterAccount && (!d.paymentAccountId || cashAccounts.some((c) => c.value === d.paymentAccountId))) {
          setD((prev: any) => ({ ...prev, paymentAccountId: defaultMasterAccount.value }));
        }
      } else {
        if (matchedEmployeeCashbox && (!d.paymentAccountId || masterAccounts.some((m) => m.value === d.paymentAccountId))) {
          setD((prev: any) => ({ ...prev, paymentAccountId: matchedEmployeeCashbox.value }));
        }
      }
    }
  }, [d.payType, d.paymentMethod, matchedEmployeeCashbox, defaultMasterAccount, cashAccounts, masterAccounts]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showErrorNotification(
        isAr ? 'حجم الملف كبير' : 'File too large',
        isAr ? 'أقصى حجم مسموح 5 ميجابايت' : 'Max size is 5MB',
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setTransferImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (busy || !d.passengerName.trim() || !d.priceSystemId) return;
    const nameToAdd = d.passengerName.trim();
    const resolvedAgent = String(d.agent || currentUserAgent || '').trim();
    const ok = await onSave({
      ...d,
      passengerName: nameToAdd,
      agent: resolvedAgent,
      salePrice: Number(String(d.salePrice || 0).replace(/,/g, '')) || 0,
      currency: d.currency || g.currency || 'IQD',
      transferImage: transferImage || null,
    });
    if (ok) {
      if (isEditing) {
        onClose();
      } else {
        setAddedCount((c) => c + 1);
        setLastAddedName(nameToAdd);
        setD((prev: any) => ({
          ...prev,
          passengerName: '',
          passport: '',
        }));
        setTransferImage(null);
        setTimeout(() => {
          passengerInputRef.current?.focus();
        }, 60);
      }
    }
  };

  return (
    <Modal
      opened
      onClose={onClose}
      centered
      size={620}
      withCloseButton={false}
      zIndex={10050}
      classNames={{
        content: '!rounded-2xl border border-slate-200 shadow-2xl !overflow-visible',
        body: '!p-5',
      }}
    >
      <div className="space-y-3.5 font-sans" dir={direction}>
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#F45A0A] flex items-center justify-center">
              <User size={16} />
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-900">
                {isEditing ? (isAr ? 'تعديل بيانات المسافر' : 'Edit Passenger') : (isAr ? 'إضافة مسافر' : 'Add Passenger')}
              </h3>
              {!isEditing && addedCount > 0 && (
                <p className="text-[10.5px] font-bold text-emerald-600">
                  {isAr ? `أُضيف ${addedCount} مسافرين في هذه الجلسة` : `${addedCount} passengers added`}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer"
            title={isAr ? 'إغلاق النافذة' : 'Close'}
          >
            <X size={15} />
          </button>
        </div>

        {initialCustomer?.name && (
          <div className="rounded-xl border border-orange-200 bg-orange-50/60 px-3.5 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Folder size={15} className="text-[#F45A0A]" />
              <span className="text-xs font-bold text-slate-700">
                {isAr ? 'ملف المستفيد المحجوز له:' : 'Beneficiary Booking File:'}
              </span>
              <span className="text-xs font-black text-[#F45A0A]">
                {initialCustomer.name}
              </span>
            </div>
            <span className="text-[10.5px] font-bold text-slate-500 font-mono">
              {isAr ? 'ملف مستفيد محدد' : 'Locked File'}
            </span>
          </div>
        )}

        {lastAddedName && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span className="text-xs font-black text-emerald-800 truncate">
                {isAr
                  ? `تم حفظ المسافر «${lastAddedName}» بنجاح! يمكنك إدخال المسافر التالي مباشرةً.`
                  : `Passenger "${lastAddedName}" saved! You can add next traveler directly.`}
              </span>
            </div>
            <span className="text-[11px] font-black text-emerald-700 font-mono bg-emerald-100 px-2 py-0.5 rounded-md shrink-0">
              {isAr ? `المضافين: ${addedCount}` : `Added: ${addedCount}`}
            </span>
          </div>
        )}

        {errorMsg && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-bold text-rose-700">
            {errorMsg}
          </div>
        )}

        {/* بيانات مدخل البيانات وموظف الإصدار: مدخل البيانات ثابت، موظف الإصدار يتغير بالكومبوبوكس */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-bold">{isAr ? 'مدخل البيانات:' : 'Data Entry:'}</span>
            <span className="font-black text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 font-sans" title={isAr ? 'مدخل البيانات محدد تلقائياً ولا يمكن تغييره' : 'Fixed entry user'}>
              {editingPassenger ? ((editingPassenger as any).createdByName || editingPassenger.agent || currentUserAgent) : currentUserAgent}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#F45A0A] font-bold shrink-0">{isAr ? 'موظف الإصدار / المصدر:' : 'Issuer:'}</span>
            <span className="font-black text-slate-800 truncate">
              {d.agent || currentUserAgent || (isAr ? 'لم يُحدد' : 'Not set')}
            </span>
          </div>
        </div>

        <Field label={isAr ? 'نظام الأسعار *' : 'Price System *'}>
          <SearchableCombobox
            value={d.priceSystemId}
            onChange={(val) => {
              const sel = g.priceSystems.find((s) => s.id === val);
              setD({
                ...d,
                priceSystemId: val,
                salePrice: sel ? Number(sel.salePrice) : d.salePrice,
                currency: sel?.currency || d.currency || g.currency || 'USD',
              });
            }}
            options={activeSystems.map((s) => ({
              value: s.id,
              label: Number(s.salePrice) > 0 ? `${s.name} — ${money(s.salePrice, s.currency)}` : s.name,
            }))}
            placeholder=""
          />
        </Field>

        {/* تكلفة الخدمات المتوقّعة للنظام المختار — تُنشأ للمسافر تلقائياً (تخطيط، لا شراء فعلي بعد) */}
        {(() => {
          const sel = g.priceSystems.find((s) => s.id === d.priceSystemId);
          const items = sel?.items || [];
          if (!items.length) return null;
          const total = items.reduce((a: number, it: any) => a + (Number(String(it.expectedBuy).replace(/,/g, '')) || 0), 0);
          return (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100/70 border-b border-slate-200">
                <span className="text-[11px] font-black text-slate-600">{isAr ? 'التكلفة المتوقّعة للخدمات' : 'Expected service cost'}</span>
                <span className="text-[10px] font-bold text-slate-400">{isAr ? 'تُنشأ تلقائياً — تُدخَل تكلفتها الفعلية لاحقاً' : 'auto-created, actual cost set later'}</span>
              </div>
              <div className="divide-y divide-slate-100">
                {items.map((it: any, i: number) => {
                  const meta = KIND_META[it.kind] || KIND_META.PACKAGE;
                  const Icon = meta.icon;
                  return (
                    <div key={i} className="flex items-center justify-between gap-2 px-3 py-1.5 text-[11.5px]">
                      <span className="inline-flex items-center gap-1.5 font-bold text-slate-700">
                        <Icon size={12} className="text-[#F45A0A]" />
                        {isAr ? meta.ar : it.kind}
                        {it.supplierName && <span className="text-slate-400 font-normal">· {it.supplierName}</span>}
                      </span>
                      <span className="font-mono font-black text-slate-600" dir="ltr">{money(it.expectedBuy, it.currency || sel?.currency)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between px-3 py-1.5 bg-orange-50/60 border-t border-orange-100">
                <span className="text-[11px] font-black text-[#F45A0A]">{isAr ? 'إجمالي التكلفة المتوقّعة' : 'Total expected cost'}</span>
                <span className="text-[12px] font-mono font-black text-[#F45A0A]" dir="ltr">{money(total, sel?.currency)}</span>
              </div>
            </div>
          );
        })()}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <Field label={isAr ? 'اسم المسافر *' : 'Passenger *'}>
            <input
              ref={passengerInputRef}
              value={d.passengerName}
              onChange={(e) => setD({ ...d, passengerName: e.target.value })}
              className={inputClass}
              placeholder=""
              autoFocus
            />
          </Field>
          <Field
            label={isAr ? 'العميل / الحساب' : 'Customer'}
            action={
              <button
                type="button"
                onClick={() => setAccountFinder({ open: true, query: d.customerName || '' })}
                className="h-[20px] px-1.5 text-[10.5px] font-bold text-[#F45A0A] hover:text-[#dd4f05] flex items-center gap-1 cursor-pointer bg-orange-50 hover:bg-orange-100 rounded border border-orange-200 transition-colors"
                title={isAr ? 'البحث المتقدم في كل الحسابات' : 'Advanced Account Search'}
              >
                <Search size={11} />
                <span>{isAr ? 'بحث متقدم' : 'Search'}</span>
              </button>
            }
          >
            <AccountSearchField
              value={d.customerName}
              direction={direction}
              inputClass={inputClass}
              onPick={(pick: AccountPick) =>
                setD({
                  ...d,
                  customerName: pick.name,
                  customerId: null,
                  customerAccountId: pick.id,
                })
              }
            />
          </Field>
          <Field label={isAr ? 'الجواز' : 'Passport'}>
            <input
              value={d.passport}
              onChange={(e) => setD({ ...d, passport: e.target.value })}
              dir="ltr"
              className={`${inputClass} font-mono`}
              placeholder=""
            />
          </Field>
          <Field label={isAr ? 'موظف الإصدار / المصدر *' : 'Issuing Employee / Issuer *'}>
            <SearchableCombobox
              value={d.agent || currentUserAgent}
              onChange={(val) => setD({ ...d, agent: val || currentUserAgent })}
              options={issuerComboboxOptions}
              placeholder={isAr ? 'اختر موظف الإصدار...' : 'Select issuing employee...'}
              allowCustomValue
            />
          </Field>

          <Field label={isAr ? 'سعر البيع *' : 'Sale Price *'}>
            <div className="flex items-center gap-1.5">
              <div className="flex-1 flex items-center h-[46px] rounded-[11px] border border-[#E5E7EB] bg-[#FAFAFA] hover:bg-white hover:border-[#D1D5DB] focus-within:bg-white focus-within:border-2 focus-within:border-[#F45A0A] px-3.5 transition-colors">
                <input
                  value={formatWithCommas(d.salePrice ?? '')}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/,/g, '').replace(/[^0-9.]/g, '');
                    const parts = raw.split('.');
                    const clean = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : raw;
                    setD({ ...d, salePrice: clean });
                  }}
                  dir="ltr"
                  placeholder="0"
                  className="w-full bg-transparent font-mono font-black text-xs text-slate-900 outline-none text-end tabular-nums"
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  setD({
                    ...d,
                    currency: (d.currency || g.currency || 'USD') === 'USD' ? 'IQD' : 'USD',
                  })
                }
                className="h-[46px] px-3.5 rounded-[11px] text-xs font-black font-mono flex items-center justify-center border border-orange-200 bg-orange-50 hover:bg-orange-100 text-[#F45A0A] transition-all cursor-pointer select-none shrink-0 shadow-2xs"
                title={isAr ? 'انقر للتبديل بين USD و IQD' : 'Toggle USD / IQD'}
              >
                {(d.currency || g.currency || 'USD') === 'USD' ? 'USD' : 'IQD'}
              </button>
            </div>
          </Field>

          <Field label={isAr ? 'نوع السداد *' : 'Payment Term *'}>
            <SearchableCombobox
              value={d.payType}
              onChange={(v) => {
                const nextPayType = v || 'CASH';
                setD((prev: any) => ({
                  ...prev,
                  payType: nextPayType,
                  paymentAccountId:
                    nextPayType === 'CASH'
                      ? prev.paymentMethod === 'MASTER'
                        ? defaultMasterAccount?.value
                        : matchedEmployeeCashbox?.value
                      : null,
                }));
              }}
              options={[
                { value: 'CASH', label: isAr ? 'نقدي' : 'Cash' },
                { value: 'CREDIT', label: isAr ? 'آجل' : 'Credit' },
              ]}
              clearable={false}
            />
          </Field>
        </div>

        {d.payType === 'CASH' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Field label={isAr ? 'طريقة السداد' : 'Receiving Method'}>
              <SearchableCombobox
                value={d.paymentMethod || 'CASH_HAND'}
                onChange={(val) => {
                  const nextMethod = val || 'CASH_HAND';
                  const nextAccountId =
                    nextMethod === 'MASTER' ? defaultMasterAccount?.value : matchedEmployeeCashbox?.value;
                  setD((prev: any) => ({
                    ...prev,
                    paymentMethod: nextMethod,
                    paymentAccountId: nextAccountId || null,
                  }));
                }}
                options={[
                  { value: 'CASH_HAND', label: isAr ? 'كاش (نقداً)' : 'Cash' },
                  { value: 'MASTER', label: isAr ? 'ماستر (دفع إلكتروني)' : 'Master / Card' },
                ]}
                clearable={false}
              />
            </Field>

            <Field
              label={
                d.paymentMethod === 'MASTER'
                  ? (isAr ? 'حساب الماستر / البنك المستلم' : 'Master Account')
                  : (isAr ? 'صندوق الاستلام (المرتبط بالموظف)' : 'Receiving Cashbox')
              }
            >
              <SearchableCombobox
                value={d.paymentAccountId || ''}
                onChange={(v) => setD((prev: any) => ({ ...prev, paymentAccountId: v }))}
                options={d.paymentMethod === 'MASTER' ? masterAccounts : cashAccounts}
                placeholder={
                  d.paymentMethod === 'MASTER'
                    ? (isAr ? 'اختر حساب الماستر' : 'Select Master')
                    : (isAr ? 'اختر الصندوق المستلم' : 'Select Cashbox')
                }
                allowCustomValue
              />
            </Field>
          </div>
        )}

        {d.payType === 'CASH' && d.paymentMethod === 'MASTER' && (
          <div className="rounded-xl border border-orange-200/80 bg-orange-50/25 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <FileCheck2 size={15} className="text-[#F45A0A]" />
                <span>{isAr ? 'إرفاق وصل تسديد الماستر' : 'Master Payment Receipt'}</span>
              </label>
              {transferImage && (
                <button
                  type="button"
                  onClick={() => setTransferImage(null)}
                  className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 size={12} />
                  <span>{isAr ? 'حذف الوصل' : 'Remove'}</span>
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileUpload}
              className="hidden"
            />

            {!transferImage ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-orange-200 hover:border-[#F45A0A] bg-white hover:bg-orange-50/40 rounded-xl p-3.5 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all text-center group"
              >
                <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#F45A0A] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <UploadCloud size={16} />
                </div>
                <p className="text-xs font-bold text-slate-700">
                  {isAr ? 'اضغط لرفع صورة إشعار أو وصل تسديد الماستر' : 'Upload payment receipt'}
                </p>
                <p className="text-[10px] text-slate-400 font-mono">
                  PNG, JPG, WEBP, PDF (max 5MB)
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-between p-2.5 bg-white border border-orange-200 rounded-xl">
                <div className="flex items-center gap-2.5 min-w-0">
                  {transferImage.startsWith('data:application/pdf') ? (
                    <div className="w-9 h-9 rounded-lg bg-orange-100 text-[#F45A0A] flex items-center justify-center shrink-0">
                      <FileText size={18} />
                    </div>
                  ) : (
                    <img
                      src={transferImage}
                      alt="receipt"
                      className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0 cursor-pointer hover:opacity-90"
                      onClick={() => setPreviewModalOpen(true)}
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-900 truncate">
                      {isAr ? 'تم إرفاق وصل السداد' : 'Receipt attached'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setPreviewModalOpen(true)}
                      className="text-[11px] font-bold text-[#F45A0A] hover:underline cursor-pointer flex items-center gap-1 mt-0.5"
                    >
                      <Eye size={12} />
                      <span>{isAr ? 'معاينة الوصل' : 'View receipt'}</span>
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-7 px-2.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer shrink-0"
                >
                  {isAr ? 'تغيير' : 'Change'}
                </button>
              </div>
            )}

            <Field label={isAr ? 'رقم الوصل / الإشعار' : 'Voucher / Receipt #'}>
              <input
                value={d.voucherNumber || ''}
                onChange={(e) => setD({ ...d, voucherNumber: e.target.value })}
                className={inputClass}
                placeholder={isAr ? 'رقم الإشعار أو المعاملة (اختياري)' : 'Reference / Voucher #'}
              />
            </Field>
          </div>
        )}

        <div className="flex items-center justify-between gap-2.5 pt-3 border-t border-slate-100 flex-wrap">
          <div className="flex items-center gap-2">
            {addedCount > 0 && (
              <span className="text-xs font-black text-emerald-700 font-mono bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                {isAr ? `أُضيف ${addedCount} مسافر` : `${addedCount} passengers added`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-[40px] px-5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              {addedCount > 0 ? (isAr ? 'إنهاء وإغلاق' : 'Done & Close') : (isAr ? 'إلغاء' : 'Cancel')}
            </button>
            <button
              type="button"
              disabled={busy || !d.passengerName.trim() || !d.priceSystemId}
              onClick={handleSave}
              className="h-[40px] px-6 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-black cursor-pointer shadow-2xs flex items-center gap-1.5"
            >
              {busy ? (
                <>
                  <Loader size={13} color="white" />
                  <span>{isAr ? 'جارٍ الحفظ…' : 'Saving…'}</span>
                </>
              ) : isEditing ? (
                <>
                  <Save size={14} />
                  <span>{isAr ? 'حفظ التعديلات' : 'Save Changes'}</span>
                </>
              ) : (
                <>
                  <UserPlus size={14} />
                  <span>{isAr ? 'حفظ وإضافة مسافر آخر' : 'Save & Add Next'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* معاينة صورة الوصل المرفق */}
        {previewModalOpen && transferImage && (
          <Modal
            opened={previewModalOpen}
            onClose={() => setPreviewModalOpen(false)}
            centered
            size={560}
            title={<span className="font-black text-sm">{isAr ? 'معاينة وصل السداد' : 'Receipt Preview'}</span>}
            zIndex={11500}
            classNames={{ content: '!rounded-2xl' }}
          >
            <div className="p-2 flex justify-center bg-slate-50 rounded-xl">
              {transferImage.startsWith('data:application/pdf') ? (
                <iframe src={transferImage} className="w-full h-[450px] rounded-lg border" title="receipt" />
              ) : (
                <img src={transferImage} alt="Receipt Preview" className="max-h-[500px] rounded-lg object-contain" />
              )}
            </div>
          </Modal>
        )}

        <AccountFinderModal
          opened={accountFinder.open}
          initialQuery={accountFinder.query}
          initialScope="CUSTOMER"
          title={isAr ? 'البحث المتقدم عن العميل / الحساب' : 'Advanced Search: Customer Account'}
          zIndex={11000}
          onClose={() => setAccountFinder({ open: false, query: '' })}
          onSelect={(account: AccountFinderResult) => {
            setD((prev: any) => ({
              ...prev,
              customerName: account.name,
              customerId: account.id,
              customerAccountId: account.id,
            }));
            setAccountFinder({ open: false, query: '' });
          }}
        />
      </div>
    </Modal>
  );
};

/* ── نافذة إنشاء كروب جديد: مقتضبة، أنيقة، بدون نصوص مطولة ── */
export const NewGroupModal: React.FC<{
  opened: boolean;
  direction: string;
  isAr: boolean;
  currentUserName?: string;
  employeeOptions?: Array<{ value: string; label: string }>;
  onClose: () => void;
  onCreated: (g: TourGroup) => void;
}> = ({ opened, direction, isAr, currentUserName, employeeOptions, onClose, onCreated }) => {
  const defaultAgent = currentUserName || (isAr ? 'مدير النظام' : 'System Admin');
  const [d, setD] = useState<any>({
    groupName: '',
    groupType: 'FULL',
    country: '',
    travelDate: new Date(),
    buyDate: new Date(),
    currency: 'IQD',
    agent: defaultAgent,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentUserName && (!d.agent || d.agent === 'مدير النظام' || d.agent === 'System Admin')) {
      setD((prev: any) => ({ ...prev, agent: currentUserName }));
    }
  }, [currentUserName]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      size={580}
      withCloseButton={false}
      zIndex={10050}
      classNames={{
        content: '!rounded-2xl border border-slate-200 shadow-2xl !overflow-visible',
        body: '!p-5',
      }}
    >
      <div className="space-y-3.5 font-sans" dir={direction}>
        {/* الترويسة المقتضبة */}
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200/80 text-[#F45A0A] flex items-center justify-center">
              <Users size={18} strokeWidth={2.4} />
            </div>
            <h3 className="font-black text-sm sm:text-base text-slate-900">
              {isAr ? 'كروب سياحي جديد' : 'New Tour Group'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* شريط علوي: مدخل البيانات وموظف الإصدار */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl bg-slate-50/90 border border-slate-200 p-3 text-xs">
          {/* مدخل البيانات */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
              <User size={12} className="text-slate-400" />
              <span>{isAr ? 'مدخل البيانات (تلقائي)' : 'Data Entry (Auto)'}</span>
            </label>
            <div className="h-[38px] px-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between shadow-2xs font-sans">
              <span className="font-bold text-slate-800 text-xs truncate">
                {currentUserName || (isAr ? 'مدير النظام' : 'System Admin')}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                {isAr ? 'المستخدم الحالي' : 'Current User'}
              </span>
            </div>
          </div>

          {/* موظف الإصدار / المصدر - افتراضياً نفس المستخدم وقابل للتعديل */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1 text-[#F45A0A]">
                <UserCheck size={12} className="text-[#F45A0A]" />
                <span>{isAr ? 'موظف الإصدار / المصدر' : 'Issuing Employee / Issuer'}</span>
              </span>
              <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100">
                {isAr ? 'تلقائي وقابل للتعديل' : 'Auto / Editable'}
              </span>
            </label>
            <SearchableCombobox
              value={d.agent}
              onChange={(val) => setD({ ...d, agent: val || '' })}
              options={employeeOptions || []}
              placeholder={isAr ? 'اختر أو اكتب موظف الإصدار...' : 'Select or type issuer...'}
              allowCustomValue
            />
          </div>
        </div>

        {/* الحقول المقتضبة */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* اسم الكروب */}
          <div className="sm:col-span-2">
            <label className="text-xs font-bold text-slate-700 block mb-1">
              {isAr ? 'اسم الكروب *' : 'Group Name *'}
            </label>
            <input
              value={d.groupName}
              onChange={(e) => setD({ ...d, groupName: e.target.value })}
              className={inputClass}
              placeholder={isAr ? 'اسم الكروب' : 'Group Name'}
            />
          </div>

          {/* نوع الكروب */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              {isAr ? 'النوع' : 'Type'}
            </label>
            <SearchableCombobox
              value={d.groupType}
              onChange={(val) => setD({ ...d, groupType: val })}
              options={[
                { value: 'FULL', label: isAr ? 'شامل' : 'Full' },
                { value: 'AIR', label: isAr ? 'طيران' : 'Air' },
                { value: 'LAND', label: isAr ? 'بري' : 'Land' },
              ]}
              clearable={false}
            />
          </div>

          {/* الوجهة */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
              <MapPin size={12} className="text-[#F45A0A]" />
              <span>{isAr ? 'الوجهة' : 'Destination'}</span>
            </label>
            <SearchableCombobox
              options={WORLD_CITIES.map((c) => ({
                value: isAr ? c.cityAr : c.cityEn,
                label: isAr ? `${c.cityAr} (${c.countryAr})` : `${c.cityEn} (${c.countryEn})`,
                subLabel: isAr ? c.countryAr : c.countryEn,
              }))}
              value={d.country}
              onChange={(val: string) => setD({ ...d, country: val })}
              placeholder={isAr ? 'الوجهة' : 'Destination'}
              allowCustomValue
            />
          </div>

          {/* تاريخ الشراء */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              {isAr ? 'تاريخ الشراء' : 'Purchase Date'}
            </label>
            <SegmentedDatePicker
              value={d.buyDate}
              onChange={(dt) => dt && setD({ ...d, buyDate: dt })}
              clearable={false}
            />
          </div>

          {/* تاريخ السفر */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              {isAr ? 'تاريخ السفر' : 'Travel Date'}
            </label>
            <SegmentedDatePicker
              value={d.travelDate}
              onChange={(dt) => dt && setD({ ...d, travelDate: dt })}
              clearable={false}
            />
          </div>

          {/* العملة */}
          <div className="sm:col-span-2">
            <label className="text-xs font-bold text-slate-700 block mb-1">
              {isAr ? 'العملة' : 'Currency'}
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setD({ ...d, currency: 'USD' })}
                className={`flex-1 h-[46px] rounded-[11px] font-black text-xs border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  d.currency === 'USD'
                    ? 'bg-[#F45A0A] text-white border-[#F45A0A] shadow-2xs'
                    : 'bg-[#FAFAFA] border-[#E5E7EB] text-slate-700 hover:bg-white'
                }`}
              >
                <DollarSign size={15} />
                <span>USD ($)</span>
              </button>
              <button
                type="button"
                onClick={() => setD({ ...d, currency: 'IQD' })}
                className={`flex-1 h-[46px] rounded-[11px] font-black text-xs border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  d.currency === 'IQD'
                    ? 'bg-[#F45A0A] text-white border-[#F45A0A] shadow-2xs'
                    : 'bg-[#FAFAFA] border-[#E5E7EB] text-slate-700 hover:bg-white'
                }`}
              >
                <Coins size={15} />
                <span>IQD (د.ع)</span>
              </button>
            </div>
          </div>
        </div>

        {/* الأزرار السفلية */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="h-[40px] px-5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={saving || !d.groupName.trim()}
            onClick={async () => {
              setSaving(true);
              try {
                const created = await tourGroupsApi.create({
                  groupName: d.groupName.trim(),
                  groupType: d.groupType,
                  country: d.country,
                  travelDate: d.travelDate ? new Date(d.travelDate).toISOString() : undefined,
                  buyDate: d.buyDate ? new Date(d.buyDate).toISOString() : undefined,
                  currency: d.currency,
                  agent: d.agent?.trim() || undefined,
                  notes: d.agent?.trim() ? `AGENT:${d.agent.trim()}` : undefined,
                } as any);
                showSuccessNotification(isAr ? 'أُنشئ الكروب' : 'Created', created.groupName);
                onCreated(created);
              } catch (e: any) {
                showErrorNotification(isAr ? 'تعذّر الإنشاء' : 'Failed', e?.message || '');
              } finally {
                setSaving(false);
              }
            }}
            className="h-[40px] px-6 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-black cursor-pointer flex items-center gap-2 shadow-2xs"
          >
            {saving ? <Loader size={14} color="white" /> : <Coins size={15} />}
            <span>{isAr ? 'إنشاء الكروب' : 'Create'}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};

/* ── نافذة تدقيق المسافرين والأسعار: نافذة ثابتة الحجم، كروت بيضاء، أيقونة مسافر، بحث وفلترة، وجدول قابل للتخصيص والتعديل ── */
interface AuditRowState {
  id: string;
  passengerName: string;
  passport: string;
  customerName: string;
  customerId: string | null;
  customerAccountId: string | null;
  salePrice: number | string;
  currency: string;
  state: string;
  agent?: string;
  originalPax: GroupPassenger;
  isSaving?: boolean;
}

const AuditPassengersModal: React.FC<{
  opened: boolean;
  onClose: () => void;
  g: TourGroup;
  isAr: boolean;
  direction: 'rtl' | 'ltr';
  beneficiaryGroups: Array<{
    key: string;
    name: string;
    accountId: string | null;
    customerId: string | null;
    passengers: GroupPassenger[];
  }>;
  onEditPax: (p: GroupPassenger) => void;
  onUpdated: () => Promise<void>;
}> = ({ opened, onClose, g, isAr, direction, beneficiaryGroups, onEditPax, onUpdated }) => {
  const [rows, setRows] = useState<AuditRowState[]>([]);
  const priceInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // حقول البحث والفلترة
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBeneficiaryFilter, setSelectedBeneficiaryFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'PENDING' | 'CONFIRMED' | 'CANCELLED'>('ALL');
  const [batchConfirming, setBatchConfirming] = useState(false);

  // تخصيص الأعمدة الظاهرة في الجدول
  const [visibleColumns, setVisibleColumns] = useState({
    passport: true,
    beneficiary: true,
    salePrice: true,
    status: true,
    agent: false,
    actions: true,
  });

  const beneficiaryOptions = useMemo(() => {
    return beneficiaryGroups
      .map((bg) => ({
        value: bg.name,
        label: bg.name,
        accountId: bg.accountId,
        customerId: bg.customerId,
      }))
      .filter((b) => b.value && b.value !== (isAr ? 'بدون مستفيد (عام)' : 'General'));
  }, [beneficiaryGroups, isAr]);

  useEffect(() => {
    if (g?.passengers) {
      setRows(
        g.passengers.map((p) => ({
          id: p.id,
          passengerName: p.passengerName,
          passport: p.passport || '',
          customerName: p.customerName || '',
          customerId: p.customerId || null,
          customerAccountId: p.customerAccountId || null,
          salePrice: p.salePrice !== undefined && p.salePrice !== null ? Number(p.salePrice) : 0,
          currency: p.currency || g.currency || 'USD',
          state: p.state || 'RESERVED',
          agent: p.agent || g.createdByName || '',
          originalPax: p,
          isSaving: false,
        })),
      );
    }
  }, [g]);

  // إحصائيات المستفيدين وتوزيع المسافرين عليهم
  const beneficiaryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of rows) {
      const name = r.customerName?.trim() || (isAr ? 'بدون مستفيد (عام)' : 'General');
      counts[name] = (counts[name] || 0) + 1;
    }
    return counts;
  }, [rows, isAr]);

  const uniqueBeneficiaries = useMemo(() => {
    return Object.keys(beneficiaryCounts);
  }, [beneficiaryCounts]);

  const updateRowById = (id: string, patch: Partial<AuditRowState>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  // ترشيح وتصفية الأسطر حسب البحث والمستفيد والحالة
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      // 1. البحث بالاسم أو رقم الجواز
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = (r.passengerName || '').toLowerCase().includes(q);
        const matchPassport = (r.passport || '').toLowerCase().includes(q);
        if (!matchName && !matchPassport) return false;
      }
      // 2. الفلترة حسب المستفيد المحدد
      if (selectedBeneficiaryFilter !== 'ALL') {
        const rowBen = r.customerName?.trim() || (isAr ? 'بدون مستفيد (عام)' : 'General');
        if (rowBen !== selectedBeneficiaryFilter) return false;
      }
      // 3. الفلترة حسب الحالة
      if (selectedStatusFilter !== 'ALL') {
        if (selectedStatusFilter === 'CONFIRMED' && r.state !== 'CONFIRMED') return false;
        if (selectedStatusFilter === 'PENDING' && (r.state === 'CONFIRMED' || r.state === 'CANCELLED')) return false;
        if (selectedStatusFilter === 'CANCELLED' && r.state !== 'CANCELLED') return false;
      }
      return true;
    });
  }, [rows, searchQuery, selectedBeneficiaryFilter, selectedStatusFilter, isAr]);

  const advanceToNextRow = (currentId: string) => {
    const currentIdx = filteredRows.findIndex((r) => r.id === currentId);
    if (currentIdx >= 0 && currentIdx + 1 < filteredRows.length) {
      const nextId = filteredRows[currentIdx + 1].id;
      setTimeout(() => {
        const nextInput = priceInputRefs.current[nextId];
        if (nextInput) {
          nextInput.focus();
          nextInput.select();
        }
      }, 60);
    }
  };

  const handleSaveRow = async (row: AuditRowState) => {
    if (!row || row.isSaving) return;
    updateRowById(row.id, { isSaving: true });
    try {
      const cleanPrice = Number(String(row.salePrice).replace(/,/g, '')) || 0;
      await tourGroupsApi.updatePassenger(g.id, row.id, {
        passengerName: row.passengerName.trim(),
        passport: row.passport.trim(),
        salePrice: cleanPrice,
        customerName: row.customerName,
        customerId: row.customerId,
        customerAccountId: row.customerAccountId,
      });
      showSuccessNotification(
        isAr ? 'تم الحفظ' : 'Saved',
        isAr ? `تم حفظ بيانات «${row.passengerName}» بنجاح.` : `Passenger "${row.passengerName}" updated.`,
      );
      updateRowById(row.id, { isSaving: false, salePrice: cleanPrice });
      await onUpdated();
      advanceToNextRow(row.id);
    } catch (e: any) {
      updateRowById(row.id, { isSaving: false });
      showErrorNotification(isAr ? 'تعذّر الحفظ' : 'Save failed', e?.message || '');
    }
  };

  const handleConfirmRow = async (row: AuditRowState) => {
    if (!row || row.isSaving) return;
    updateRowById(row.id, { isSaving: true });
    try {
      const cleanPrice = Number(String(row.salePrice).replace(/,/g, '')) || 0;
      await tourGroupsApi.updatePassenger(g.id, row.id, {
        passengerName: row.passengerName.trim(),
        passport: row.passport.trim(),
        salePrice: cleanPrice,
        state: 'CONFIRMED',
        customerName: row.customerName,
        customerId: row.customerId,
        customerAccountId: row.customerAccountId,
      });
      showSuccessNotification(
        isAr ? 'تم اعتماد السعر' : 'Price Confirmed',
        isAr ? `تم تأكيد واعتماد سعر المسافر «${row.passengerName}» بنجاح.` : `Confirmed price for "${row.passengerName}".`,
      );
      updateRowById(row.id, { isSaving: false, state: 'CONFIRMED', salePrice: cleanPrice });
      await onUpdated();
      advanceToNextRow(row.id);
    } catch (e: any) {
      updateRowById(row.id, { isSaving: false });
      showErrorNotification(isAr ? 'تعذّر الاعتماد' : 'Confirmation failed', e?.message || '');
    }
  };

  const handleBeneficiaryChange = async (rowId: string, newName: string) => {
    const matched = beneficiaryOptions.find((b) => b.value === newName);
    const newAccountId = matched?.accountId || null;
    const newCustomerId = matched?.customerId || null;
    updateRowById(rowId, {
      customerName: newName,
      customerAccountId: newAccountId,
      customerId: newCustomerId,
    });
    const row = rows.find((r) => r.id === rowId);
    if (row) {
      try {
        await tourGroupsApi.updatePassenger(g.id, row.id, {
          customerName: newName,
          customerId: newCustomerId,
          customerAccountId: newAccountId,
        });
        showSuccessNotification(
          isAr ? 'تم تغيير المستفيد' : 'Beneficiary Changed',
          isAr ? `تم تعيين «${newName}» للمسافر «${row.passengerName}».` : `Assigned "${newName}" to traveler.`,
        );
        await onUpdated();
      } catch (e: any) {
        showErrorNotification(isAr ? 'تعذّر التغيير' : 'Failed', e?.message || '');
      }
    }
  };

  const handleBatchConfirm = async () => {
    const pending = filteredRows.filter((r) => r.state !== 'CONFIRMED');
    if (pending.length === 0) return;
    setBatchConfirming(true);
    try {
      for (const row of pending) {
        const cleanPrice = Number(String(row.salePrice).replace(/,/g, '')) || 0;
        await tourGroupsApi.updatePassenger(g.id, row.id, {
          passengerName: row.passengerName.trim(),
          passport: row.passport.trim(),
          salePrice: cleanPrice,
          state: 'CONFIRMED',
          customerName: row.customerName,
          customerId: row.customerId,
          customerAccountId: row.customerAccountId,
        });
      }
      setRows((prev) =>
        prev.map((r) => (pending.some((p) => p.id === r.id) ? { ...r, state: 'CONFIRMED' } : r)),
      );
      showSuccessNotification(
        isAr ? 'تم الاعتماد الجماعي' : 'Batch Confirmed',
        isAr ? `تم اعتماد أسعار ${pending.length} مسافر بنجاح.` : `Confirmed prices for ${pending.length} passengers.`,
      );
      await onUpdated();
    } catch (e: any) {
      showErrorNotification(isAr ? 'تعذّر الاعتماد الجماعي' : 'Batch failed', e?.message || '');
    } finally {
      setBatchConfirming(false);
    }
  };

  const totalPassengers = rows.length;
  const confirmedCount = rows.filter((r) => r.state === 'CONFIRMED').length;
  const pendingCount = totalPassengers - confirmedCount;
  const totalSales = rows.reduce((acc, r) => acc + (Number(String(r.salePrice).replace(/,/g, '')) || 0), 0);

  const th = 'px-3 py-2.5 text-[11px] font-black text-slate-600 whitespace-nowrap select-none';
  const td = 'px-3 py-2 text-[12px] whitespace-nowrap';

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="1420px"
      centered
      radius="xl"
      padding="lg"
      withCloseButton
      dir={direction}
      zIndex={10040}
      styles={{
        content: {
          height: '92vh',
          maxHeight: '920px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        },
        header: {
          padding: '14px 20px',
          borderBottom: '1px solid #E2E8F0',
          backgroundColor: '#FFFFFF',
          flexShrink: 0,
        },
        body: {
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          padding: '16px 20px',
          backgroundColor: '#FAFAFA',
        },
      }}
      title={
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 text-[#F45A0A] flex items-center justify-center shrink-0 shadow-2xs">
            <CheckCheck size={22} strokeWidth={2.4} />
          </div>
          <div>
            <h3 className="font-black text-sm sm:text-base text-slate-900 flex items-center gap-2">
              <span>{isAr ? 'تدقيق أسعار ومستفيدي المسافرين' : 'Audit Passengers & Pricing'}</span>
              <span className="text-xs font-mono font-black px-2.5 py-0.5 rounded-full bg-orange-50 text-[#F45A0A] border border-orange-200 tabular-nums">
                {totalPassengers} {isAr ? 'مسافر' : 'passengers'}
              </span>
            </h3>
            <p className="text-[11px] font-bold text-slate-500 mt-0.5">
              {isAr
                ? 'مراجعة وتعديل أسعار البيع، بيانات المسافر والجواز، نقل المسافرين بين المستفيدين، واعتماد الأسعار'
                : 'Review & edit sale prices, passenger details, move travelers between beneficiaries, and confirm pricing.'}
            </p>
          </div>
        </div>
      }
    >
      <div className="flex flex-col h-full space-y-3 font-sans overflow-hidden" dir={direction}>
        {/* ── 1. بطاقات الإحصائيات الموحدة باللون الأبيض الصافي (Pure White Cards) ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          {/* كارت 1: إجمالي المسافرين */}
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 block mb-1">
                {isAr ? 'إجمالي المسافرين' : 'Total Passengers'}
              </span>
              <span className="text-2xl font-black font-mono text-slate-900 tabular-nums">
                {totalPassengers}
              </span>
            </div>
            <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 flex items-center justify-center shrink-0">
              <Users size={17} strokeWidth={2.2} />
            </div>
          </div>

          {/* كارت 2: الأسعار المعتمدة */}
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 block mb-1">
                {isAr ? 'الأسعار المعتمدة' : 'Confirmed Prices'}
              </span>
              <span className="text-2xl font-black font-mono text-emerald-700 tabular-nums">
                {confirmedCount}
              </span>
            </div>
            <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 size={17} strokeWidth={2.2} />
            </div>
          </div>

          {/* كارت 3: قيد التدقيق / معلق */}
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 block mb-1">
                {isAr ? 'قيد التدقيق / معلّق' : 'Pending Review'}
              </span>
              <span className="text-2xl font-black font-mono text-amber-600 tabular-nums">
                {pendingCount}
              </span>
            </div>
            <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 text-amber-600 flex items-center justify-center shrink-0">
              <Clock size={17} strokeWidth={2.2} />
            </div>
          </div>

          {/* كارت 4: إجمالي مبيعات الكروب */}
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 block mb-1">
                {isAr ? 'إجمالي مبيعات الكروب' : 'Total Group Sales'}
              </span>
              <span className="text-2xl font-black font-mono text-[#F45A0A] tabular-nums" dir="ltr">
                {totalSales.toLocaleString('en-US')} {g.currency || 'USD'}
              </span>
            </div>
            <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 text-[#F45A0A] flex items-center justify-center shrink-0">
              <Coins size={17} strokeWidth={2.2} />
            </div>
          </div>
        </div>

        {/* ── 2. شريط البحث والفلترة حسب المستفيد وتخصيص الأعمدة ── */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2.5 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* حقل البحث بالاسم أو الجواز */}
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search
                size={15}
                className="text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none"
              />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isAr ? 'بحث باسم المسافر أو رقم الجواز...' : 'Search traveler name or passport...'}
                className="w-full h-9 ps-9 pe-8 text-xs font-bold text-slate-800 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-[#F45A0A] rounded-xl outline-none transition-all placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* فلترة المستفيدين وقائمة الحالات وأزرار التخصيص */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* اختيار المستفيد للفلترة */}
              <div className="w-48 sm:w-56">
                <Select
                  size="xs"
                  radius="md"
                  placeholder={isAr ? 'تصفية حسب المستفيد...' : 'Filter beneficiary...'}
                  value={selectedBeneficiaryFilter}
                  onChange={(val) => setSelectedBeneficiaryFilter(val || 'ALL')}
                  data={[
                    { value: 'ALL', label: isAr ? `كل المستفيدين (${totalPassengers})` : `All Beneficiaries (${totalPassengers})` },
                    ...uniqueBeneficiaries.map((b) => ({
                      value: b,
                      label: `${b} (${beneficiaryCounts[b] || 0})`,
                    })),
                  ]}
                  leftSection={<Building2 size={13} className="text-slate-400" />}
                />
              </div>

              {/* تبويبات الحالة السريعة */}
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setSelectedStatusFilter('ALL')}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    selectedStatusFilter === 'ALL'
                      ? 'bg-white text-slate-900 shadow-2xs font-black'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {isAr ? 'الكل' : 'All'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStatusFilter('PENDING')}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    selectedStatusFilter === 'PENDING'
                      ? 'bg-white text-amber-700 shadow-2xs font-black'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {isAr ? 'معلّق' : 'Pending'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStatusFilter('CONFIRMED')}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    selectedStatusFilter === 'CONFIRMED'
                      ? 'bg-white text-emerald-700 shadow-2xs font-black'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {isAr ? 'معتمد' : 'Confirmed'}
                </button>
              </div>

              {/* تخصيص الأعمدة الظاهرة */}
              <Menu shadow="md" width={200} position="bottom-end">
                <Menu.Target>
                  <button
                    type="button"
                    className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-black cursor-pointer inline-flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <SlidersHorizontal size={13} className="text-slate-500" />
                    <span>{isAr ? 'تخصيص الأعمدة' : 'Columns'}</span>
                  </button>
                </Menu.Target>
                <Menu.Dropdown dir={direction}>
                  <Menu.Label className="text-[11px] font-black">{isAr ? 'إظهار / إخفاء الأعمدة' : 'Toggle Columns'}</Menu.Label>
                  <Menu.Item
                    onClick={() => setVisibleColumns((c) => ({ ...c, passport: !c.passport }))}
                    leftSection={visibleColumns.passport ? <Check size={14} className="text-emerald-600" /> : <span className="w-3.5" />}
                  >
                    {isAr ? 'رقم الجواز' : 'Passport'}
                  </Menu.Item>
                  <Menu.Item
                    onClick={() => setVisibleColumns((c) => ({ ...c, beneficiary: !c.beneficiary }))}
                    leftSection={visibleColumns.beneficiary ? <Check size={14} className="text-emerald-600" /> : <span className="w-3.5" />}
                  >
                    {isAr ? 'المستفيد التابع له' : 'Beneficiary'}
                  </Menu.Item>
                  <Menu.Item
                    onClick={() => setVisibleColumns((c) => ({ ...c, salePrice: !c.salePrice }))}
                    leftSection={visibleColumns.salePrice ? <Check size={14} className="text-emerald-600" /> : <span className="w-3.5" />}
                  >
                    {isAr ? 'سعر البيع' : 'Sale Price'}
                  </Menu.Item>
                  <Menu.Item
                    onClick={() => setVisibleColumns((c) => ({ ...c, status: !c.status }))}
                    leftSection={visibleColumns.status ? <Check size={14} className="text-emerald-600" /> : <span className="w-3.5" />}
                  >
                    {isAr ? 'حالة السعر' : 'Price Status'}
                  </Menu.Item>
                  <Menu.Item
                    onClick={() => setVisibleColumns((c) => ({ ...c, agent: !c.agent }))}
                    leftSection={visibleColumns.agent ? <Check size={14} className="text-emerald-600" /> : <span className="w-3.5" />}
                  >
                    {isAr ? 'موظف الإصدار' : 'Issuer / Agent'}
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>

              {/* زر اعتماد جميع المعروضين بنقرة واحدة */}
              <button
                type="button"
                disabled={batchConfirming || filteredRows.filter((r) => r.state !== 'CONFIRMED').length === 0}
                onClick={handleBatchConfirm}
                className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-black cursor-pointer inline-flex items-center gap-1.5 transition-colors shadow-2xs"
                title={isAr ? 'اعتماد جميع الأسعار المعلقة المعروضة حالياً' : 'Batch confirm all visible pending'}
              >
                {batchConfirming ? <Loader size={12} color="white" /> : <CheckCheck size={14} />}
                <span>{isAr ? 'اعتماد الكل' : 'Confirm All'}</span>
              </button>
            </div>
          </div>

          {/* ── شريط وسوم المستفيدين السريعة: تبيّن كل مسافرين إلى أي مستفيدين يتبعون ── */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-1 border-t border-slate-100 pb-0.5 text-[11px]">
            <span className="font-bold text-slate-400 shrink-0 flex items-center gap-1">
              <Building2 size={12} />
              <span>{isAr ? 'المستفيدون:' : 'Beneficiaries:'}</span>
            </span>
            <button
              type="button"
              onClick={() => setSelectedBeneficiaryFilter('ALL')}
              className={`px-2 py-0.5 rounded-md font-bold transition-colors cursor-pointer shrink-0 border ${
                selectedBeneficiaryFilter === 'ALL'
                  ? 'bg-orange-50 border-orange-200 text-[#F45A0A] font-black'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {isAr ? 'الكل' : 'All'} ({totalPassengers})
            </button>
            {uniqueBeneficiaries.map((bName) => {
              const count = beneficiaryCounts[bName] || 0;
              const isSelected = selectedBeneficiaryFilter === bName;
              return (
                <button
                  key={bName}
                  type="button"
                  onClick={() => setSelectedBeneficiaryFilter(isSelected ? 'ALL' : bName)}
                  className={`px-2 py-0.5 rounded-md font-bold transition-colors cursor-pointer shrink-0 border flex items-center gap-1 ${
                    isSelected
                      ? 'bg-orange-50 border-orange-300 text-[#F45A0A] font-black shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{bName}</span>
                  <span className="font-mono text-[10px] px-1 py-0.2 rounded bg-slate-100 text-slate-600 tabular-nums">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 3. جدول تدقيق المسافرين القابل للتخصيص والتعديل ── */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
          <table className="w-full border-collapse text-start">
            <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-xs z-10 border-b border-slate-200">
              <tr className="text-start">
                <th className={`${th} w-10 text-center`}>#</th>
                <th className={`${th} text-start`}>{isAr ? 'اسم المسافر' : 'Passenger Name'}</th>
                {visibleColumns.passport && (
                  <th className={`${th} text-start w-36`}>{isAr ? 'رقم الجواز' : 'Passport'}</th>
                )}
                {visibleColumns.beneficiary && (
                  <th className={`${th} text-start w-64`}>{isAr ? 'المستفيد التابع له (ملف الحساب)' : 'Assigned Beneficiary'}</th>
                )}
                {visibleColumns.salePrice && (
                  <th className={`${th} text-center w-40`}>{isAr ? 'سعر البيع' : 'Sale Price'}</th>
                )}
                {visibleColumns.status && (
                  <th className={`${th} text-center w-28`}>{isAr ? 'حالة السعر' : 'Price Status'}</th>
                )}
                {visibleColumns.agent && (
                  <th className={`${th} text-start w-32`}>{isAr ? 'موظف الإصدار' : 'Issuer'}</th>
                )}
                {visibleColumns.actions && (
                  <th className={`${th} text-center w-48`}>{isAr ? 'إجراءات التدقيق' : 'Audit Actions'}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-bold text-xs">
                    {isAr ? 'لا توجد نتائج تطابق خيارات البحث والفلترة' : 'No passengers match the current search/filters'}
                  </td>
                </tr>
              ) : (
                filteredRows.map((r, idx) => {
                  const isConfirmed = r.state === 'CONFIRMED';
                  const isCancelled = r.state === 'CANCELLED';
                  return (
                    <tr
                      key={r.id}
                      className={`transition-colors hover:bg-orange-50/20 ${
                        isCancelled ? 'opacity-50 bg-slate-50' : isConfirmed ? 'bg-emerald-50/15' : ''
                      }`}
                    >
                      {/* # الترقيم */}
                      <td className={`${td} text-center font-mono text-[11px] font-bold text-slate-400`}>
                        {idx + 1}
                      </td>

                      {/* المسافر مع أيقونة مسافر أنيقة وحقل قابل للتعديل المباشر */}
                      <td className={`${td} text-start`}>
                        <div className="flex items-center gap-2 min-w-0">
                          {/* أيقونة المسافر المخصصة (Passenger Icon) */}
                          <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#F45A0A] flex items-center justify-center shrink-0 border border-orange-200/70 shadow-2xs">
                            <User size={15} strokeWidth={2.4} />
                          </div>
                          {/* حقل اسم المسافر قابل للتعديل */}
                          <div className="min-w-0 flex-1">
                            <input
                              value={r.passengerName}
                              onChange={(e) => updateRowById(r.id, { passengerName: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveRow(r);
                                }
                              }}
                              className="w-full h-[32px] px-2 font-black text-xs text-slate-900 bg-transparent hover:bg-slate-50 focus:bg-white focus:border-[#F45A0A] border border-transparent focus:border rounded-lg outline-none transition-colors"
                              placeholder={isAr ? 'اسم المسافر...' : 'Passenger name...'}
                            />
                          </div>
                        </div>
                      </td>

                      {/* رقم الجواز - قابل للتعديل */}
                      {visibleColumns.passport && (
                        <td className={`${td} text-start`}>
                          <input
                            value={r.passport}
                            onChange={(e) => updateRowById(r.id, { passport: e.target.value.toUpperCase() })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSaveRow(r);
                              }
                            }}
                            dir="ltr"
                            className="w-full max-w-[120px] h-[32px] px-2 font-mono font-bold text-xs text-slate-700 bg-transparent hover:bg-slate-50 focus:bg-white focus:border-[#F45A0A] border border-transparent focus:border rounded-lg outline-none transition-colors text-start"
                            placeholder="A00000000"
                          />
                        </td>
                      )}

                      {/* المستفيد التابع له - يبيّن المستفيد بوضوح مع إمكانية النقل */}
                      {visibleColumns.beneficiary && (
                        <td className={`${td} text-start`}>
                          <div className="w-56 sm:w-64">
                            <SearchableCombobox
                              value={r.customerName}
                              onChange={(val) => handleBeneficiaryChange(r.id, val || '')}
                              options={beneficiaryOptions}
                              placeholder={isAr ? 'اختر المستفيد...' : 'Select Beneficiary...'}
                              allowCustomValue
                            />
                          </div>
                        </td>
                      )}

                      {/* سعر البيع - حقل قابل للتعديل مع دعم Enter السريع */}
                      {visibleColumns.salePrice && (
                        <td className={`${td} text-center`}>
                          <div className="inline-flex items-center gap-1.5 justify-center">
                            <input
                              ref={(el) => {
                                priceInputRefs.current[r.id] = el;
                              }}
                              value={r.salePrice}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/[^0-9.]/g, '');
                                updateRowById(r.id, { salePrice: raw });
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveRow(r);
                                }
                              }}
                              dir="ltr"
                              className="w-28 h-[34px] px-2 text-center font-mono font-black text-xs rounded-lg border border-slate-200 bg-white focus:bg-orange-50/20 focus:border-2 focus:border-[#F45A0A] outline-none shadow-2xs tabular-nums text-slate-900 transition-colors"
                              placeholder="0"
                            />
                            <span className="font-mono font-bold text-[11px] text-slate-400">
                              {r.currency}
                            </span>
                          </div>
                        </td>
                      )}

                      {/* حالة السعر */}
                      {visibleColumns.status && (
                        <td className={`${td} text-center`}>
                          <span
                            className={`text-[10.5px] font-black px-2.5 py-1 rounded-md border inline-flex items-center gap-1 ${
                              isCancelled
                                ? 'bg-slate-100 text-slate-600 border-slate-200'
                                : isConfirmed
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {isConfirmed ? (
                              <>
                                <CheckCircle2 size={12} className="text-emerald-600" />
                                <span>{isAr ? 'معتمد' : 'Confirmed'}</span>
                              </>
                            ) : isCancelled ? (
                              <span>{isAr ? 'ملغى' : 'Cancelled'}</span>
                            ) : (
                              <>
                                <Clock size={12} className="text-amber-600" />
                                <span>{isAr ? 'معلّق' : 'Pending'}</span>
                              </>
                            )}
                          </span>
                        </td>
                      )}

                      {/* موظف الإصدار */}
                      {visibleColumns.agent && (
                        <td className={`${td} text-start`}>
                          <span className="text-[11px] font-bold text-slate-600 truncate block max-w-[120px]" title={r.agent}>
                            {r.agent || '—'}
                          </span>
                        </td>
                      )}

                      {/* الإجراءات: اعتماد، حفظ، وتعديل كامل */}
                      {visibleColumns.actions && (
                        <td className={`${td} text-center`} onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex items-center gap-1.5">
                            {/* زر اعتماد وتأكيد السعر */}
                            <button
                              type="button"
                              disabled={r.isSaving || isConfirmed}
                              onClick={() => handleConfirmRow(r)}
                              title={isAr ? 'اعتماد وتأكيد السعر والانتقال للتالي' : 'Confirm price & advance'}
                              className="h-7 px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 disabled:opacity-50 text-emerald-800 text-[11px] font-black cursor-pointer flex items-center gap-1 transition-colors shadow-2xs"
                            >
                              <CheckCheck size={12} className="text-emerald-700" />
                              <span>{isAr ? 'اعتماد' : 'Confirm'}</span>
                            </button>

                            {/* زر حفظ التعديلات */}
                            <button
                              type="button"
                              disabled={r.isSaving}
                              onClick={() => handleSaveRow(r)}
                              title={isAr ? 'حفظ السعر والمستفيد وبيانات المسافر' : 'Save row changes'}
                              className="h-7 px-2.5 rounded-lg bg-orange-50 hover:bg-orange-100 border border-orange-200 disabled:opacity-50 text-[#F45A0A] text-[11px] font-black cursor-pointer flex items-center gap-1 transition-colors shadow-2xs"
                            >
                              {r.isSaving ? <Loader size={11} color="orange" /> : <Save size={12} />}
                              <span>{isAr ? 'حفظ' : 'Save'}</span>
                            </button>

                            {/* زر تعديل المسافر بالكامل في نافذة مخصصة */}
                            <button
                              type="button"
                              onClick={() => onEditPax(r.originalPax)}
                              title={isAr ? 'تعديل كافة بيانات وخدمات المسافر التفصيلية' : 'Edit passenger full details'}
                              className="w-7 h-7 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 inline-flex items-center justify-center cursor-pointer transition-colors shadow-2xs"
                            >
                              <Edit2 size={12} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── 4. الشريط السفلي للنافذة ── */}
        <div className="pt-2.5 border-t border-slate-200 flex items-center justify-between shrink-0 bg-white px-2 py-1.5 rounded-xl">
          <div className="flex items-center gap-3 text-xs text-slate-500 font-bold">
            <span>
              {isAr
                ? `عرض ${filteredRows.length} من أصل ${totalPassengers} مسافر`
                : `Showing ${filteredRows.length} of ${totalPassengers} passengers`}
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-400 font-normal">
              {isAr
                ? '💡 اضغط Enter في حقل السعر للحفظ والانتقال المباشر للسطر التالي'
                : '💡 Press Enter on price input to save and move to next row'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-6 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
            >
              {isAr ? 'إغلاق النافذة' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default GroupFileWorkspace;
