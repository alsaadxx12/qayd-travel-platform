import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  Title,
  Switch,
  Alert,
  Menu,
  ActionIcon,
  Loader,
  Tooltip,
  Skeleton,
  Drawer,
  Progress,
} from '@mantine/core';
import {
  IconBuildingStore,
  IconUsers,
  IconCoins,
  IconSparkles,
  IconSearch,
  IconDotsVertical,
  IconRefresh,
  IconPlayerPause,
  IconPlayerPlay,
  IconEdit,
  IconCheck,
  IconMinus,
  IconAlertCircle,
  IconCash,
  IconSend,
  IconTrash,
  IconTable,
  IconCrown,
  IconReceipt,
  IconPhoto,
  IconEye,
  IconChecklist,
  IconCircleCheck,
  IconCircleX,
  IconPlus,
  IconCreditCard,
  IconHistory,
  IconRocket,
  IconGift,
  IconMail,
  IconShieldCheck,
  IconLock,
  IconEyeCheck,
  IconLogin,
  IconDatabase,
  IconFileTypeXls,
  IconPrinter,
} from '@tabler/icons-react';
import ReactECharts from 'echarts-for-react';
import { tenantsApi, TenantDatabaseUsageItem, TenantSummary } from '../../api/tenants';
import { subscriptionsApi, AdminPlan, PublicPlan } from '../../api/subscriptions';
import { PERMISSION_REGISTRY } from '../../config/permissionRegistry';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { useAuthStore } from '../../store/useAuthStore';
import { PricingPage } from '../PricingPage';
import { MastercardPreviewCard } from '../../components/pricing/MastercardPreviewCard';

const CATEGORY_TITLES: Record<string, string> = {
  ACCOUNTING: '1. المحاسبة والعمليات المالية',
  TRAVEL: '2. السياحة وتذاكر الطيران',
  BRANCHES: '3. الفروع والتعدد المحاسبي',
  SECURITY: '4. الصلاحيات والأمان والرقابة',
  REPORTS: '5. التقارير والتحليلات المالية',
  STORAGE: '6. التخزين والنسخ الاحتياطي',
  INTEGRATIONS: '7. الربط البرمجي والدعم الفني',
};

const CATEGORY_ORDER = ['ACCOUNTING', 'TRAVEL', 'BRANCHES', 'SECURITY', 'REPORTS', 'STORAGE', 'INTEGRATIONS'];

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes)) return '—';
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;
  const precision = value >= 100 || unitIndex === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
};

const formatMoneyCents = (cents: number, currency: string) => {
  const amount = cents / 100;
  if (currency === 'IQD') {
    return `${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} د.ع`;
  }
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const bytesToMB = (bytes: number | null | undefined) =>
  bytes === null || bytes === undefined ? null : Math.round((bytes / 1024 ** 2) * 100) / 100;

const usageStatusMeta: Record<
  TenantDatabaseUsageItem['usageStatus'],
  { label: string; color: string; className: string }
> = {
  UNLIMITED: { label: 'بلا حدود', color: 'dark', className: 'text-slate-700 bg-slate-100 border-slate-200' },
  UNCONFIGURED: { label: 'الحصة غير محددة', color: 'gray', className: 'text-slate-600 bg-slate-50 border-slate-200' },
  NORMAL: { label: 'طبيعي', color: 'teal', className: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  WATCH: { label: 'يحتاج متابعة', color: 'yellow', className: 'text-amber-700 bg-amber-50 border-amber-200' },
  NEAR_LIMIT: { label: 'قريب من الحد', color: 'orange', className: 'text-orange-700 bg-orange-50 border-orange-200' },
  CRITICAL: { label: 'حرج', color: 'red', className: 'text-rose-700 bg-rose-50 border-rose-200' },
  OVER_LIMIT: { label: 'متجاوز للحصة', color: 'red', className: 'text-red-700 bg-red-50 border-red-200' },
};

const forecastLabel = (date: string | null, status: string) => {
  if (date) return new Date(date).toLocaleDateString('en-GB');
  if (status === 'STABLE') return 'الاستخدام مستقر';
  if (status === 'UNAVAILABLE') return 'القياس غير متاح';
  if (status === 'CAPACITY_NOT_CONFIGURED') return 'السعة غير مسجلة';
  return 'بانتظار سجل كافٍ';
};

// Semi-Circle Gauge Chart Component
const SemiCircleGauge: React.FC<{
  percent: number;
  color?: string;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
}> = ({ percent = 0, color = '#F45A0A', size = 76, strokeWidth = 8, label, sublabel }) => {
  const clamped = Math.min(100, Math.max(0, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center justify-center select-none shrink-0">
      <svg width={size} height={size / 2 + strokeWidth + 2} className="overflow-visible">
        <path
          d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
          fill="none"
          stroke="#F1F5F9"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <path
          d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="text-center -mt-3 leading-tight">
        <span className="text-[11px] font-black font-mono text-slate-800 tabular-nums block">
          {label !== undefined ? label : `${clamped.toFixed(1)}%`}
        </span>
        {sublabel && (
          <span className="text-[8.5px] font-bold text-slate-400 block -mt-0.5 font-mono">{sublabel}</span>
        )}
      </div>
    </div>
  );
};

export const SaasAdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<string>('tenants');
  const [searchQuery, setSearchQuery] = useState('');
  const [databaseUsageSearch, setDatabaseUsageSearch] = useState('');
  const [databaseProviderModalOpened, setDatabaseProviderModalOpened] = useState(false);
  const [databaseProviderName, setDatabaseProviderName] = useState('Supabase');
  const [databasePlanName, setDatabasePlanName] = useState('');
  const [databaseCapacityGB, setDatabaseCapacityGB] = useState<number | string>('');
  const [storageCapacityGB, setStorageCapacityGB] = useState<number | string>('');
  const [egressCapacityGB, setEgressCapacityGB] = useState<number | string>('');
  const [databaseInvoiceAmount, setDatabaseInvoiceAmount] = useState<number | string>('');
  const [databasePaidAmount, setDatabasePaidAmount] = useState<number | string>('');
  const [databaseBillingCurrency, setDatabaseBillingCurrency] = useState<'USD' | 'IQD'>('USD');
  const [databaseBillingStart, setDatabaseBillingStart] = useState('');
  const [databaseBillingEnd, setDatabaseBillingEnd] = useState('');
  const [selectedDatabaseTenant, setSelectedDatabaseTenant] = useState<TenantDatabaseUsageItem | null>(null);
  const [tenantDatabaseQuotaGB, setTenantDatabaseQuotaGB] = useState<number | string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [publishSuccess, setPublishSuccess] = useState(false);

  // Modals - Tenants Management
  const [selectedTenant, setSelectedTenant] = useState<TenantSummary | null>(null);
  const [changePlanModalOpened, setChangePlanModalOpened] = useState(false);
  const [renewModalOpened, setRenewModalOpened] = useState(false);
  const [suspendModalOpened, setSuspendModalOpened] = useState(false);
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [tenantToDelete, setTenantToDelete] = useState<TenantSummary | null>(null);

  // Form states - Tenants Management
  const [newPlanCode, setNewPlanCode] = useState('PRO');
  const [renewMonths, setRenewMonths] = useState(1);
  const [paymentAmount, setPaymentAmount] = useState(199);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [suspendReason, setSuspendReason] = useState('');

  // Modals - Features & Pricing Management
  const [addFeatureModalOpened, setAddFeatureModalOpened] = useState(false);
  const [newFeatureName, setNewFeatureName] = useState('');
  const [newFeatureCode, setNewFeatureCode] = useState('');
  const [newFeatureCategory, setNewFeatureCategory] = useState<string>('ACCOUNTING');
  const [newFeatureDefaultEnabled, setNewFeatureDefaultEnabled] = useState(false);

  const [editFeatureModalOpened, setEditFeatureModalOpened] = useState(false);
  const [selectedFeatureToEdit, setSelectedFeatureToEdit] = useState<{ code: string; nameAr: string; category: string } | null>(null);
  const [editFeatureName, setEditFeatureName] = useState('');
  const [editFeatureCategory, setEditFeatureCategory] = useState<string>('ACCOUNTING');

  const [previewImageModalOpened, setPreviewImageModalOpened] = useState(false);
  const [selectedReceiptImage, setSelectedReceiptImage] = useState<string>('');

  const [rejectModalOpened, setRejectModalOpened] = useState(false);
  const [selectedPaymentToReject, setSelectedPaymentToReject] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [editPlanModalOpened, setEditPlanModalOpened] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<AdminPlan | null>(null);
  const [editNameAr, setEditNameAr] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriceMonthly, setEditPriceMonthly] = useState(99);
  const [editIsRecommended, setEditIsRecommended] = useState(false);
  const [editMaxBranches, setEditMaxBranches] = useState(1);
  const [editMaxUsers, setEditMaxUsers] = useState(5);
  const [editEmailDaily, setEditEmailDaily] = useState(50);

  // Payment Methods Configuration State
  const [masterEnabled, setMasterEnabled] = useState(true);
  const [masterCardHolder, setMasterCardHolder] = useState('AZIZ KHAMEES SEDEQ');
  const [masterCardNumber, setMasterCardNumber] = useState('5826553934');
  const [masterBankName, setMasterBankName] = useState('مصرف الرافدين');
  const [masterExpiryDate, setMasterExpiryDate] = useState('12/28');
  const [masterCardType, setMasterCardType] = useState('Qi Card Mastercard');
  const [masterInstructions, setMasterInstructions] = useState('يرجى تحويل قيمة الاشتراك إلى رقم الحساب / البطاقة وإرسال صورة الإشعار أو رقم المعاملة.');

  const [qiEnabled, setQiEnabled] = useState(true);
  const [qiAccountNumber, setQiAccountNumber] = useState('5826553934');
  const [qiAccountName, setQiAccountName] = useState('AZIZ KHAMEES SEDEQ');
  const [qiInstructions, setQiInstructions] = useState('تحويل مباشر عبر تطبيق خدماتي / كي كارد إلى رقم الحساب.');

  const [zainEnabled, setZainEnabled] = useState(true);
  const [zainPhoneNumber, setZainPhoneNumber] = useState('07800003901');
  const [zainWalletName, setZainWalletName] = useState('محفظة زين كاش التجارية');
  const [zainInstructions, setZainInstructions] = useState('يرجى التحويل المباشر إلى رقم المحفظة وكتابة اسم شركتك في الملاحظات.');

  const [fibEnabled, setFibEnabled] = useState(true);
  const [fibIban, setFibIban] = useState('IQ88FIBB0000998877665544');
  const [fibAccountName, setFibAccountName] = useState('First Iraqi Bank (FIB)');
  const [fibInstructions, setFibInstructions] = useState('تحويل فوري عبر تطبيق FIB المصرفي.');

  // Subscription History Search & Filter
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('ALL');

  // Subscription Payment Management State
  const [editPaymentModalOpened, setEditPaymentModalOpened] = useState(false);
  const [selectedPaymentToEdit, setSelectedPaymentToEdit] = useState<any>(null);
  const [editPaymentForm, setEditPaymentForm] = useState({
    amount: 99,
    currency: 'USD',
    paymentMethod: 'MASTERCARD',
    transactionRef: '',
    notes: '',
    status: 'COMPLETED',
    paidAt: '',
  });

  const [cancelPaymentModalOpened, setCancelPaymentModalOpened] = useState(false);
  const [selectedPaymentToCancel, setSelectedPaymentToCancel] = useState<any>(null);
  const [cancelPaymentReason, setCancelPaymentReason] = useState('');

  const [createPaymentModalOpened, setCreatePaymentModalOpened] = useState(false);
  const [createPaymentForm, setCreatePaymentForm] = useState({
    tenantId: '',
    amount: 99,
    currency: 'USD',
    monthsToAdd: 1,
    paymentMethod: 'MASTERCARD',
    transactionRef: '',
    notes: '',
    paidAt: new Date().toISOString().split('T')[0],
  });

  // Tenant Owner Roles & Permissions Management State (Platform Admin)
  const [ownerPermissionsModalOpened, setOwnerPermissionsModalOpened] = useState(false);
  const [selectedTenantForOwnerPerms, setSelectedTenantForOwnerPerms] = useState<TenantSummary | null>(null);
  const [ownerCustomPermissions, setOwnerCustomPermissions] = useState<string[]>(['*']);
  const [ownerPermsSearch, setOwnerPermsSearch] = useState('');
  const [ownerPermCategory, setOwnerPermCategory] = useState<string>('الكل');
  const [ownerRolesSearchQuery, setOwnerRolesSearchQuery] = useState('');

  // 0. Current Tenant Access Guard
  const { data: currentTenant, isLoading: loadingCurrentTenant } = useQuery({
    queryKey: ['current-tenant'],
    queryFn: () => tenantsApi.getCurrentTenant(),
  });

  // 1. Fetch Tenants
  const { data: tenants = [], isLoading: loadingTenants } = useQuery({
    queryKey: ['saas-admin-tenants'],
    queryFn: () => tenantsApi.getAllTenants(),
    enabled: currentTenant?.isRoot === true,
  });

  const {
    data: databaseUsage,
    isLoading: loadingDatabaseUsage,
    isError: databaseUsageFailed,
    error: databaseUsageError,
  } = useQuery({
    queryKey: ['saas-admin-database-usage'],
    queryFn: () => tenantsApi.getDatabaseUsage(),
    enabled: currentTenant?.isRoot === true && activeTab === 'database_usage',
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  useEffect(() => {
    if (!databaseUsage) return;

    setDatabaseProviderName(databaseUsage.database.provider || 'Supabase');
    setDatabasePlanName(databaseUsage.database.planName || '');
    setDatabaseCapacityGB(
      databaseUsage.database.capacityIsExact && databaseUsage.database.capacityBytes
        ? databaseUsage.database.capacityBytes / 1024 ** 3
        : '',
    );
    setStorageCapacityGB(
      databaseUsage.resources.storage.capacityBytes
        ? databaseUsage.resources.storage.capacityBytes / 1024 ** 3
        : '',
    );
    setEgressCapacityGB(
      databaseUsage.resources.egress.capacityBytes
        ? databaseUsage.resources.egress.capacityBytes / 1024 ** 3
        : '',
    );

    const billing = databaseUsage.database.billing;
    setDatabaseInvoiceAmount(billing ? billing.invoiceAmountCents / 100 : '');
    setDatabasePaidAmount(billing ? billing.paidAmountCents / 100 : '');
    setDatabaseBillingCurrency(billing?.currency === 'IQD' ? 'IQD' : 'USD');
    setDatabaseBillingStart(billing?.billingPeriodStart?.slice(0, 10) || '');
    setDatabaseBillingEnd(billing?.billingPeriodEnd?.slice(0, 10) || '');
  }, [databaseUsage]);

  // 2. Fetch Admin Plans
  const { data: adminPlans = [], isLoading: loadingPlans } = useQuery({
    queryKey: ['saas-admin-plans'],
    queryFn: subscriptionsApi.getAllPlansAdmin,
    enabled: currentTenant?.isRoot === true,
  });

  // 3. Fetch Subscription History
  const { data: subscriptionsHistory = [], isLoading: loadingHistory } = useQuery({
    queryKey: ['admin-subscriptions-history'],
    queryFn: subscriptionsApi.getAllSubscriptionsHistory,
    enabled: currentTenant?.isRoot === true,
  });

  // 4. Fetch Pending Renewal Requests
  const { data: pendingRenewals = [], isLoading: loadingPending } = useQuery({
    queryKey: ['pending-renewals'],
    queryFn: subscriptionsApi.getPendingRenewals,
    enabled: currentTenant?.isRoot === true,
  });

  // 5. Fetch Payment Methods
  const { data: paymentMethodsData = {} } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: subscriptionsApi.getPaymentMethods,
    enabled: currentTenant?.isRoot === true,
  });

  // Load fetched payment methods into state
  useEffect(() => {
    if (paymentMethodsData.mastercard) {
      const m = paymentMethodsData.mastercard;
      setMasterEnabled(m.enabled !== false);
      setMasterCardHolder(m.cardHolder || 'AZIZ KHAMEES SEDEQ');
      const rawNum = m.cardNumber || m.fullCardNumber || '';
      setMasterCardNumber(rawNum.includes('•') || !rawNum ? '5826553934' : rawNum);
      setMasterBankName(m.bankName || 'مصرف الرافدين');
      setMasterExpiryDate(m.expiryDate || '12/28');
      setMasterCardType(m.cardType || 'Qi Card Mastercard');
      setMasterInstructions(m.instructions || 'يرجى تحويل قيمة الاشتراك إلى رقم الحساب / البطاقة وإرسال صورة الإشعار أو رقم المعاملة.');
    }
    if (paymentMethodsData.qiCard) {
      setQiEnabled(paymentMethodsData.qiCard.enabled !== false);
      setQiAccountNumber(paymentMethodsData.qiCard.accountNumber || '5826553934');
      setQiAccountName(paymentMethodsData.qiCard.accountName || 'AZIZ KHAMEES SEDEQ');
      setQiInstructions(paymentMethodsData.qiCard.instructions || '');
    }
    if (paymentMethodsData.zainCash) {
      setZainEnabled(paymentMethodsData.zainCash.enabled !== false);
      setZainPhoneNumber(paymentMethodsData.zainCash.phoneNumber || '07800003901');
      setZainWalletName(paymentMethodsData.zainCash.walletName || 'محفظة زين كاش التجارية');
      setZainInstructions(paymentMethodsData.zainCash.instructions || '');
    }
    if (paymentMethodsData.fib) {
      setFibEnabled(paymentMethodsData.fib.enabled !== false);
      setFibIban(paymentMethodsData.fib.iban || 'IQ88FIBB0000998877665544');
      setFibAccountName(paymentMethodsData.fib.accountName || 'First Iraqi Bank (FIB)');
      setFibInstructions(paymentMethodsData.fib.instructions || '');
    }
  }, [paymentMethodsData]);

  // Local optimistic state for feature toggles: { [planId]: { [featureCode]: boolean } }
  const [localFeatureState, setLocalFeatureState] = useState<Record<string, Record<string, boolean>>>({});

  useEffect(() => {
    if (adminPlans.length > 0) {
      const stateMap: Record<string, Record<string, boolean>> = {};
      adminPlans.forEach((p) => {
        const v = p.versions.find((ver) => ver.isActive) || p.versions[0];
        if (v) {
          stateMap[p.id] = {};
          v.features?.forEach((f) => {
            stateMap[p.id][f.featureCode] = f.isEnabled;
          });
        }
      });
      setLocalFeatureState(stateMap);
    }
  }, [adminPlans]);

  // Mutations - Tenant
  const changePlanMutation = useMutation({
    mutationFn: ({ tenantId, planCode }: { tenantId: string; planCode: string }) =>
      subscriptionsApi.changePlan(tenantId, planCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-admin-tenants'] });
      setChangePlanModalOpened(false);
    },
  });

  const updateDatabaseProviderMutation = useMutation({
    mutationFn: () => tenantsApi.updateDatabaseProviderSettings({
      providerName: databaseProviderName.trim(),
      planName: databasePlanName.trim(),
      capacityBytes: Math.round(Number(databaseCapacityGB) * 1024 ** 3),
      storageCapacityBytes: Math.round(Number(storageCapacityGB) * 1024 ** 3),
      egressCapacityBytes: Math.round(Number(egressCapacityGB) * 1024 ** 3),
      invoiceAmountCents: Math.round(Number(databaseInvoiceAmount) * 100),
      paidAmountCents: Math.round(Number(databasePaidAmount) * 100),
      currency: databaseBillingCurrency,
      billingPeriodStart: new Date(`${databaseBillingStart}T00:00:00.000Z`).toISOString(),
      billingPeriodEnd: new Date(`${databaseBillingEnd}T23:59:59.999Z`).toISOString(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-admin-database-usage'] });
      setDatabaseProviderModalOpened(false);
      showSuccessNotification('تم الحفظ', 'تم حفظ سعة قاعدة البيانات وبيانات فاتورة المزود');
    },
    onError: (error: any) => {
      showErrorNotification('تعذر الحفظ', error?.message || 'تعذر حفظ بيانات مزود قاعدة البيانات');
    },
  });

  const measureDatabaseUsageMutation = useMutation({
    mutationFn: tenantsApi.measureDatabaseUsage,
    onSuccess: (data) => {
      queryClient.setQueryData(['saas-admin-database-usage'], data);
      showSuccessNotification('اكتمل القياس', 'تم حفظ القياس الجديد في سجل الاستخدام');
    },
    onError: (error: any) => {
      showErrorNotification('تعذر القياس', error?.message || 'تعذر إكمال قياس موارد المنصة');
    },
  });

  const updateTenantQuotaMutation = useMutation({
    mutationFn: ({ tenantId, quotaBytes }: { tenantId: string; quotaBytes: number | null }) =>
      tenantsApi.updateTenantDatabaseQuota(tenantId, quotaBytes),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['saas-admin-database-usage'] });
      setSelectedDatabaseTenant(null);
      showSuccessNotification('تم تحديث الحصة', 'تم حفظ حد المؤسسة وتسجيل العملية في سجل التدقيق');
    },
    onError: (error: any) => {
      showErrorNotification('تعذر تحديث الحصة', error?.message || 'تعذر حفظ حد المؤسسة');
    },
  });

  const renewMutation = useMutation({
    mutationFn: ({
      tenantId,
      data,
    }: {
      tenantId: string;
      data: { amountCents: number; monthsToAdd: number; notes: string };
    }) => subscriptionsApi.renewSubscription(tenantId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-admin-tenants'] });
      setRenewModalOpened(false);
    },
  });

  const suspendMutation = useMutation({
    mutationFn: ({ tenantId, reason }: { tenantId: string; reason: string }) =>
      tenantsApi.suspendTenant(tenantId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-admin-tenants'] });
      setSuspendModalOpened(false);
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (tenantId: string) => tenantsApi.reactivateTenant(tenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-admin-tenants'] });
    },
  });

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteTenantMutation = useMutation({
    mutationFn: (tenantId: string) => tenantsApi.deleteTenant(tenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-admin-tenants'] });
      setDeleteModalOpened(false);
      setTenantToDelete(null);
      setDeleteError(null);
    },
    onError: (err: any) => {
      setDeleteError(err?.message || 'تعذر حذف المؤسسة. قد تكون المؤسسة المركزية للنظام أو مرتبطة ببيانات أساسية.');
    },
  });

  // Mutations - Pricing & Plans
  const updatePlanMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      subscriptionsApi.updatePlan(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-admin-plans'] });
      queryClient.invalidateQueries({ queryKey: ['public-plans'] });
      setEditPlanModalOpened(false);
    },
  });

  const updatePaymentMethodsMutation = useMutation({
    mutationFn: (methods: any) => subscriptionsApi.updatePaymentMethods(methods),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
      setPublishSuccess(true);
      setTimeout(() => setPublishSuccess(false), 3000);
    },
  });

  const approveRenewalMutation = useMutation({
    mutationFn: (paymentId: string) => subscriptionsApi.approveRenewal(paymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-renewals'] });
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions-history'] });
      queryClient.invalidateQueries({ queryKey: ['saas-admin-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['current-tenant'] });
      setPublishSuccess(true);
      setTimeout(() => setPublishSuccess(false), 3000);
    },
  });

  const rejectRenewalMutation = useMutation({
    mutationFn: ({ paymentId, reason }: { paymentId: string; reason: string }) =>
      subscriptionsApi.rejectRenewal(paymentId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-renewals'] });
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions-history'] });
      setRejectModalOpened(false);
    },
  });

  const createFeatureMutation = useMutation({
    mutationFn: (data: { featureCode: string; nameAr: string; category: string; defaultEnabled?: boolean }) =>
      subscriptionsApi.createFeature(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-admin-plans'] });
      queryClient.invalidateQueries({ queryKey: ['public-plans'] });
      setAddFeatureModalOpened(false);
      setNewFeatureName('');
      setNewFeatureCode('');
      setPublishSuccess(true);
      setTimeout(() => setPublishSuccess(false), 3000);
    },
  });

  const updateFeatureMutation = useMutation({
    mutationFn: ({ code, data }: { code: string; data: { nameAr?: string; category?: string } }) =>
      subscriptionsApi.updateFeature(code, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-admin-plans'] });
      queryClient.invalidateQueries({ queryKey: ['public-plans'] });
      setEditFeatureModalOpened(false);
      setSelectedFeatureToEdit(null);
      setPublishSuccess(true);
      setTimeout(() => setPublishSuccess(false), 3000);
    },
  });

    // Payment Management Mutations
  const updatePaymentMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => subscriptionsApi.updatePayment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions-history'] });
      queryClient.invalidateQueries({ queryKey: ['saas-admin-tenants'] });
      setEditPaymentModalOpened(false);
      showSuccessNotification('تم التعديل', 'تم تحديث بيانات الدفعة ومبلغها بنجاح');
    },
    onError: (err: any) => {
      showErrorNotification('خطأ', err?.message || 'فشل في تعديل الدفعة');
    },
  });

  const cancelPaymentMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => subscriptionsApi.cancelPayment(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions-history'] });
      queryClient.invalidateQueries({ queryKey: ['saas-admin-tenants'] });
      setCancelPaymentModalOpened(false);
      showSuccessNotification('تم إلغاء الدفعة', 'تم إلغاء الدفعة وتغيير حالتها إلى مستردة بنجاح');
    },
    onError: (err: any) => {
      showErrorNotification('خطأ', err?.message || 'فشل في إلغاء الدفعة');
    },
  });

  const deletePaymentMutation = useMutation({
    mutationFn: (id: string) => subscriptionsApi.deletePayment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions-history'] });
      queryClient.invalidateQueries({ queryKey: ['saas-admin-tenants'] });
      showSuccessNotification('تم الحذف', 'تم حذف سجل الدفعة بنجاح');
    },
    onError: (err: any) => {
      showErrorNotification('خطأ', err?.message || 'فشل في حذف الدفعة');
    },
  });

  const createManualPaymentMutation = useMutation({
    mutationFn: (data: any) => subscriptionsApi.createManualPayment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions-history'] });
      queryClient.invalidateQueries({ queryKey: ['saas-admin-tenants'] });
      setCreatePaymentModalOpened(false);
      showSuccessNotification('تم تسجيل الدفعة', 'تم تسجيل واستلام الدفعة الجديدة للمؤسسة بنجاح');
    },
    onError: (err: any) => {
      showErrorNotification('خطأ', err?.message || 'فشل في تسجيل الدفعة');
    },
  });

  const deleteFeatureMutation = useMutation({
    mutationFn: (code: string) => subscriptionsApi.deleteFeature(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-admin-plans'] });
      queryClient.invalidateQueries({ queryKey: ['public-plans'] });
      setPublishSuccess(true);
      setTimeout(() => setPublishSuccess(false), 3000);
    },
  });

  const handleToggleFeature = async (plan: AdminPlan, featureCode: string) => {
    const planId = plan.id;
    const currentVal = localFeatureState[planId]?.[featureCode] ?? false;
    const nextVal = !currentVal;

    setLocalFeatureState((prev) => ({
      ...prev,
      [planId]: {
        ...(prev[planId] || {}),
        [featureCode]: nextVal,
      },
    }));

    try {
      await subscriptionsApi.togglePlanFeature(planId, featureCode, nextVal);
      queryClient.invalidateQueries({ queryKey: ['public-plans'] });
    } catch (e) {
      setLocalFeatureState((prev) => ({
        ...prev,
        [planId]: {
          ...(prev[planId] || {}),
          [featureCode]: currentVal,
        },
      }));
    }
  };

  const handleSavePaymentMethods = () => {
    updatePaymentMethodsMutation.mutate({
      mastercard: {
        enabled: masterEnabled,
        cardHolder: masterCardHolder,
        cardNumber: masterCardNumber,
        fullCardNumber: masterCardNumber,
        bankName: masterBankName,
        expiryDate: masterExpiryDate,
        cardType: masterCardType,
        instructions: masterInstructions,
      },
      qiCard: {
        enabled: qiEnabled,
        accountNumber: qiAccountNumber,
        accountName: qiAccountName,
        instructions: qiInstructions,
      },
      zainCash: {
        enabled: zainEnabled,
        phoneNumber: zainPhoneNumber,
        walletName: zainWalletName,
        instructions: zainInstructions,
      },
      fib: {
        enabled: fibEnabled,
        iban: fibIban,
        accountName: fibAccountName,
        instructions: fibInstructions,
      },
    });
  };

  const handleOpenEditPlan = (p: AdminPlan) => {
    setSelectedPlan(p);
    const activeVer = p.versions.find((v) => v.isActive) || p.versions[0];
    setEditNameAr(p.nameAr);
    setEditDescription(p.description || '');
    setEditPriceMonthly(activeVer ? activeVer.priceMonthlyCents / 100 : 0);
    setEditIsRecommended(activeVer?.isRecommended || false);

    const limitsMap: Record<string, number> = {};
    activeVer?.limits.forEach((l) => {
      limitsMap[l.limitCode] = l.limitValue;
    });

    setEditMaxBranches(limitsMap['MAX_BRANCHES'] ?? 1);
    setEditMaxUsers(limitsMap['MAX_USERS'] ?? 5);
    setEditEmailDaily(limitsMap['EMAIL_DAILY'] ?? 50);
    setEditPlanModalOpened(true);
  };

  const handleSavePlan = () => {
    if (!selectedPlan) return;
    const activeVer = selectedPlan.versions.find((v) => v.isActive) || selectedPlan.versions[0];

    const updatedLimits = [
      { limitCode: 'MAX_BRANCHES', nameAr: 'عدد الفروع المسموحة', limitValue: editMaxBranches, unit: 'فرع' },
      { limitCode: 'MAX_USERS', nameAr: 'عدد المستخدمين المسموحين', limitValue: editMaxUsers, unit: 'مستخدم' },
      { limitCode: 'EMAIL_DAILY', nameAr: 'رسائل البريد اليومية', limitValue: editEmailDaily, unit: 'رسالة/يوم' },
    ];

    updatePlanMutation.mutate({
      id: selectedPlan.id,
      payload: {
        nameAr: editNameAr,
        description: editDescription,
        priceMonthlyCents: editPriceMonthly * 100,
        isRecommended: editIsRecommended,
        limits: updatedLimits,
        features: activeVer?.features || [],
      },
    });
  };

  // Owner Permissions Mutation & Preset Handlers
  const updateOwnerPermissionsMutation = useMutation({
    mutationFn: ({ tenantId, customPermissions }: { tenantId: string; customPermissions: string[] }) =>
      tenantsApi.updateOwnerPermissions(tenantId, { customPermissions }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-admin-tenants'] });
      setOwnerPermissionsModalOpened(false);
      showSuccessNotification('تم الحفظ', 'تم تحديث مصفوفة صلاحيات مالك الشركة بنجاح.');
    },
    onError: (err: any) => {
      showErrorNotification('خطأ', err?.message || 'تعذر تحديث صلاحيات مالك الشركة');
    },
  });

  const { startImpersonation } = useAuthStore();

  const impersonateMutation = useMutation({
    mutationFn: (tenantId: string) => tenantsApi.impersonateTenantOwner(tenantId),
    onSuccess: (data) => {
      startImpersonation(data.user, data.accessToken, data.user.impersonatedTenant);
      queryClient.clear();
      showSuccessNotification(
        'تم الدخول بنجاح',
        `أنت تتصفح النظام الآن بصفة مالك الشركة: ${data.user.impersonatedTenant?.name || data.user.companyName} لفحص ومطابقة الصلاحيات الحية.`
      );
      navigate('/dashboard');
    },
    onError: (err: any) => {
      showErrorNotification('خطأ في المحاكاة', err?.message || 'تعذر الدخول بصفة مالك الشركة');
    },
  });

  const handleOpenOwnerPermissionsModal = (tenant: TenantSummary) => {
    setSelectedTenantForOwnerPerms(tenant);
    const existing = (tenant as any).ownerPermissions || ['*'];
    setOwnerCustomPermissions(existing);
    setOwnerPermsSearch('');
    setOwnerPermCategory('الكل');
    setOwnerPermissionsModalOpened(true);
  };

  const handleApplyOwnerPreset = (preset: 'FULL' | 'FINANCIAL' | 'OPERATIONS' | 'EMPTY') => {
    if (preset === 'FULL') {
      setOwnerCustomPermissions(['*']);
    } else if (preset === 'FINANCIAL') {
      const financialCodes: string[] = [];
      PERMISSION_REGISTRY.filter((m) => m.category === 'الحسابات' || m.category === 'التقارير' || m.id === 'generalLedger').forEach((m) => {
        m.permissions.forEach((p) => financialCodes.push(p.code));
      });
      setOwnerCustomPermissions(financialCodes);
    } else if (preset === 'OPERATIONS') {
      const opsCodes: string[] = [];
      PERMISSION_REGISTRY.filter((m) => m.category === 'العمليات والخدمات' || m.id === 'tickets' || m.id === 'visas' || m.id === 'hotels').forEach((m) => {
        m.permissions.forEach((p) => opsCodes.push(p.code));
      });
      setOwnerCustomPermissions(opsCodes);
    } else {
      setOwnerCustomPermissions([]);
    }
  };

  const handleToggleOwnerPermission = (code: string) => {
    const isWildcard = ownerCustomPermissions.includes('*');
    if (isWildcard) {
      const allCodes = PERMISSION_REGISTRY.flatMap((m) => m.permissions.map((p) => p.code));
      setOwnerCustomPermissions(allCodes.filter((c) => c !== code));
      return;
    }

    if (ownerCustomPermissions.includes(code)) {
      setOwnerCustomPermissions(ownerCustomPermissions.filter((c) => c !== code));
    } else {
      setOwnerCustomPermissions([...ownerCustomPermissions, code]);
    }
  };

  // Group features by category
  const allFeaturesGrouped = useMemo(() => {
    const featureMap = new Map<string, { code: string; nameAr: string; category: string }>();
    adminPlans.forEach((p) => {
      const v = p.versions.find((ver) => ver.isActive) || p.versions[0];
      v?.features?.forEach((f) => {
        if (!featureMap.has(f.featureCode)) {
          featureMap.set(f.featureCode, {
            code: f.featureCode,
            nameAr: f.nameAr,
            category: f.category || 'ACCOUNTING',
          });
        }
      });
    });
    return Array.from(featureMap.values());
  }, [adminPlans]);

  const trialPlan = adminPlans.find((p) => p.code === 'FREE_TRIAL');
  const basicPlan = adminPlans.find((p) => p.code === 'BASIC');
  const proPlan = adminPlans.find((p) => p.code === 'PRO');
  const enterprisePlan = adminPlans.find((p) => p.code === 'ENTERPRISE');

  // KPI Calculations (Excluding Root Platform Master Tenant)
  const nonRootTenants = useMemo(() => {
    return (tenants || []).filter((t) => !t.isRoot);
  }, [tenants]);

  const totalTenants = nonRootTenants.length;
  const subscribedTenants = nonRootTenants.filter((t) => t.status !== 'SUSPENDED');
  const activeTenants = nonRootTenants.filter(
    (t) => t.status === 'ACTIVE' || t.subscriptionStatus === 'ACTIVE',
  ).length;

  const collectedRevenueUSD = nonRootTenants.reduce(
    (sum, tenant) => sum + (tenant.collectedPaymentsThisMonth?.USD || 0),
    0,
  );
  const collectedRevenueIQD = nonRootTenants.reduce(
    (sum, tenant) => sum + (tenant.collectedPaymentsThisMonth?.IQD || 0),
    0,
  );

  const totalUsers = nonRootTenants.reduce((s, t) => s + (t.stats?.usersCount || 0), 0);
  const totalBranches = nonRootTenants.reduce((s, t) => s + (t.stats?.branchesCount || 0), 0);

  // Platform Root Owner Reference
  const platformOwnerTenant = (tenants || []).find((tenant) => tenant.isRoot);

  // Filtered Tenants (Subscribers Only)
  const filteredTenants = useMemo(() => {
    return nonRootTenants.filter((t) => {
      const matchesSearch =
        !searchQuery ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.email && t.email.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [nonRootTenants, searchQuery, statusFilter]);

  const filteredDatabaseUsage = useMemo(() => {
    const normalizedSearch = databaseUsageSearch.trim().toLowerCase();
    if (!normalizedSearch) return databaseUsage?.tenants || [];

    return (databaseUsage?.tenants || []).filter((item) =>
      item.tenantName.toLowerCase().includes(normalizedSearch) ||
      item.tenantSlug.toLowerCase().includes(normalizedSearch) ||
      item.owner?.name.toLowerCase().includes(normalizedSearch) ||
      item.owner?.email.toLowerCase().includes(normalizedSearch),
    );
  }, [databaseUsage, databaseUsageSearch]);

  const usageGrowthChartOption = useMemo(() => {
    const monthly = new Map<string, { label: string; databaseMB: number | null; storageMB: number | null }>();
    for (const snapshot of databaseUsage?.history || []) {
      const date = new Date(snapshot.measuredAt);
      const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
      monthly.set(key, {
        label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        databaseMB: bytesToMB(snapshot.databasePhysicalBytes),
        storageMB: bytesToMB(snapshot.storageBytes),
      });
    }
    const points = [...monthly.values()].slice(-12);
    return {
      animationDuration: 450,
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0f172a',
        borderWidth: 0,
        textStyle: { color: '#fff', fontFamily: 'inherit', fontSize: 11 },
        valueFormatter: (value: number) => `${Number(value).toLocaleString('en-US')} MB`,
      },
      legend: { data: ['PostgreSQL', 'Storage'], top: 0, textStyle: { fontFamily: 'inherit', fontSize: 10 } },
      grid: { top: 42, right: 16, left: 52, bottom: 30, containLabel: false },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: points.map((point) => point.label),
        axisLine: { lineStyle: { color: '#dbe3ee' } },
        axisTick: { show: false },
        axisLabel: { color: '#64748b', fontSize: 10, fontFamily: 'inherit' },
      },
      yAxis: {
        type: 'value',
        name: 'MB',
        nameTextStyle: { color: '#94a3b8', fontSize: 10 },
        splitLine: { lineStyle: { color: '#eef2f7', type: 'dashed' } },
        axisLabel: { color: '#64748b', fontSize: 10 },
      },
      series: [
        {
          name: 'PostgreSQL',
          type: 'line',
          smooth: 0.28,
          symbolSize: 7,
          data: points.map((point) => point.databaseMB),
          lineStyle: { width: 3, color: '#f45a0a' },
          itemStyle: { color: '#f45a0a' },
          areaStyle: { color: 'rgba(244,90,10,0.10)' },
          connectNulls: false,
        },
        {
          name: 'Storage',
          type: 'line',
          smooth: 0.28,
          symbolSize: 7,
          data: points.map((point) => point.storageMB),
          lineStyle: { width: 2.5, color: '#2563eb' },
          itemStyle: { color: '#2563eb' },
          areaStyle: { color: 'rgba(37,99,235,0.08)' },
          connectNulls: false,
        },
      ],
    };
  }, [databaseUsage]);

  const usageDistributionChartOption = useMemo(() => {
    const items = [...(databaseUsage?.tenants || [])]
      .sort((a, b) => (b.databaseBytes + b.attachmentBytes) - (a.databaseBytes + a.attachmentBytes))
      .slice(0, 8);
    return {
      animationDuration: 450,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#0f172a',
        borderWidth: 0,
        textStyle: { color: '#fff', fontFamily: 'inherit', fontSize: 11 },
        valueFormatter: (value: number) => `${Number(value).toLocaleString('en-US')} MB`,
      },
      legend: { data: ['بيانات PostgreSQL', 'المرفقات المسجلة'], top: 0, textStyle: { fontFamily: 'inherit', fontSize: 10 } },
      grid: { top: 42, right: 90, left: 18, bottom: 24 },
      xAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#eef2f7', type: 'dashed' } },
        axisLabel: { color: '#64748b', fontSize: 10 },
      },
      yAxis: {
        type: 'category',
        inverse: true,
        data: items.map((item) => item.tenantName),
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: { color: '#334155', fontSize: 10, width: 76, overflow: 'truncate' },
      },
      series: [
        {
          name: 'بيانات PostgreSQL',
          type: 'bar',
          stack: 'usage',
          barWidth: 16,
          data: items.map((item) => bytesToMB(item.databaseBytes)),
          itemStyle: { color: '#f45a0a', borderRadius: [0, 4, 4, 0] },
        },
        {
          name: 'المرفقات المسجلة',
          type: 'bar',
          stack: 'usage',
          barWidth: 16,
          data: items.map((item) => bytesToMB(item.attachmentBytes)),
          itemStyle: { color: '#2563eb', borderRadius: [4, 0, 0, 4] },
        },
      ],
    };
  }, [databaseUsage]);

  const exportDatabaseUsageExcel = async () => {
    if (!databaseUsage) return;
    const XLSX = await import('xlsx');
    const workbook = XLSX.utils.book_new();
    const summaryRows = [
      { البيان: 'وقت القياس', القيمة: new Date(databaseUsage.measuredAt).toLocaleDateString('en-GB') + ' ' + new Date(databaseUsage.measuredAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) },
      { البيان: 'PostgreSQL المستخدم', القيمة: formatBytes(databaseUsage.resources.database.usedBytes || 0) },
      { البيان: 'سعة PostgreSQL', القيمة: formatBytes(databaseUsage.resources.database.capacityBytes || 0) },
      { البيان: 'Storage المستخدم', القيمة: databaseUsage.resources.storage.usedBytes === null ? 'غير متاح' : formatBytes(databaseUsage.resources.storage.usedBytes) },
      { البيان: 'سعة Storage', القيمة: databaseUsage.resources.storage.capacityBytes ? formatBytes(databaseUsage.resources.storage.capacityBytes) : 'غير مسجلة' },
      { البيان: 'Egress المستخدم', القيمة: databaseUsage.resources.egress.usedBytes === null ? 'غير متاح' : formatBytes(databaseUsage.resources.egress.usedBytes) },
      { البيان: 'سعة Egress', القيمة: databaseUsage.resources.egress.capacityBytes ? formatBytes(databaseUsage.resources.egress.capacityBytes) : 'غير مسجلة' },
      { البيان: 'حالة Supabase Management API', القيمة: databaseUsage.providerIntegration?.connected ? 'متصل' : 'غير متصل' },
      { البيان: 'مشروع Supabase', القيمة: databaseUsage.providerIntegration?.projectName || 'غير متاح' },
      { البيان: 'طلبات API خلال 24 ساعة', القيمة: databaseUsage.providerIntegration?.apiRequests?.total ?? 'غير متاح' },
      { البيان: 'طلبات Realtime خلال 24 ساعة', القيمة: databaseUsage.resources.realtime.usage ?? 'غير متاح' },
      { البيان: 'Edge Functions المنشورة', القيمة: databaseUsage.resources.edgeFunctions.usage ?? 'غير متاح' },
    ];
    const tenantRows = databaseUsage.tenants.map((item) => ({
      المؤسسة: item.tenantName,
      المسؤول: item.owner?.name || '',
      الباقة: item.billing.planName,
      'بيانات PostgreSQL': item.databaseBytes,
      السجلات: item.recordCount,
      المرفقات: item.attachmentBytes,
      'الحصة الداخلية': item.databaseQuotaBytes ?? '',
      'نسبة الحصة': item.quotaUsagePercent ?? '',
      'النمو هذا الشهر': item.monthlyGrowthBytes ?? '',
      'التكلفة التقديرية': item.estimatedProviderCostCents / 100,
      العملة: item.costCurrency,
      الحالة: usageStatusMeta[item.usageStatus].label,
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), 'ملخص الموارد');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(tenantRows), 'المؤسسات');
    XLSX.writeFile(workbook, `platform-usage-${databaseUsage.measuredAt.slice(0, 10)}.xlsx`);
  };

  // Filtered History & Payments
  const filteredHistory = useMemo(() => {
    return (subscriptionsHistory || []).filter((item: any) => {
      const q = historySearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.tenant?.name?.toLowerCase().includes(q) ||
        item.tenant?.slug?.toLowerCase().includes(q) ||
        item.planName?.toLowerCase().includes(q) ||
        item.transactionRef?.toLowerCase().includes(q) ||
        item.paymentMethod?.toLowerCase().includes(q) ||
        (typeof item.notes === 'string' && item.notes.toLowerCase().includes(q));

      const matchesStatus = historyStatusFilter === 'ALL' || item.status === historyStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [subscriptionsHistory, historySearch, historyStatusFilter]);

  // History Revenue & Stats
  const historyStats = useMemo(() => {
    let totalRevenueUSD = 0;
    let totalRevenueIQD = 0;
    let completedCount = 0;
    let pendingCount = 0;
    let cancelledCount = 0;

    (subscriptionsHistory || []).forEach((item: any) => {
      const amount = Number(item.amount) || (Number(item.amountCents) / 100) || 0;
      if (item.status === 'COMPLETED') {
        if (String(item.currency || 'USD').toUpperCase() === 'IQD') {
          totalRevenueIQD += amount;
        } else {
          totalRevenueUSD += amount;
        }
        completedCount++;
      } else if (item.status === 'PENDING') {
        pendingCount++;
      } else if (item.status === 'REFUNDED' || item.status === 'FAILED' || item.status === 'CANCELLED') {
        cancelledCount++;
      }
    });

    return {
      totalRevenueUSD,
      totalRevenueIQD,
      completedCount,
      pendingCount,
      cancelledCount,
      totalCount: (subscriptionsHistory || []).length,
    };
  }, [subscriptionsHistory]);

  const usageRevenueUsdCents = databaseUsage?.profitability.subscriptionRevenueByCurrency
    .find((item) => item.currency === 'USD')?.amountCents ?? null;
  const usageNetProfitUsdCents = databaseUsage?.profitability.netProfitByCurrency
    .find((item) => item.currency === 'USD')?.amountCents ?? null;
  const usageProfitMargin = usageRevenueUsdCents && usageNetProfitUsdCents !== null
    ? Math.max(-100, Math.min(100, Math.round((usageNetProfitUsdCents / usageRevenueUsdCents) * 100)))
    : 0;

  const getPlanIcon = (code: string) => {
    switch (code) {
      case 'FREE_TRIAL':
        return <IconGift size={22} className="text-[#F45A0A]" />;
      case 'BASIC':
        return <IconBuildingStore size={22} className="text-[#F45A0A]" />;
      case 'PRO':
        return <IconRocket size={22} className="text-[#F45A0A]" />;
      case 'ENTERPRISE':
        return <IconCrown size={22} className="text-[#F45A0A]" />;
      default:
        return <IconBuildingStore size={22} className="text-[#F45A0A]" />;
    }
  };

  const navTabs = [
    { id: 'tenants', label: 'المؤسسات والشركات', icon: IconBuildingStore, count: totalTenants },
    { id: 'database_usage', label: 'استخدام قاعدة البيانات', icon: IconDatabase, count: totalTenants },
    { id: 'pending', label: 'طلبات التجديد', icon: IconReceipt, badge: pendingRenewals.length },
    { id: 'matrix', label: 'مصفوفة المزايا', icon: IconTable },
    { id: 'plans', label: 'الباقات والأسعار', icon: IconSparkles },
    { id: 'history', label: 'سجل الاشتراكات', icon: IconHistory },
    { id: 'payments', label: 'طرق الدفع', icon: IconCreditCard },
    { id: 'preview', label: 'معاينة الأسعار', icon: IconEye },
  ];

  if (!loadingCurrentTenant && currentTenant && !currentTenant.isRoot) {
    return (
      <div className="p-8 text-center max-w-md mx-auto bg-white rounded-2xl border border-red-200 mt-12 shadow-xs" dir="rtl">
        <IconAlertCircle size={48} className="text-red-500 mx-auto mb-3" />
        <h3 className="font-black text-base text-slate-900 mb-1">غير مصرح بالوصول</h3>
        <p className="text-xs text-slate-500 leading-relaxed mb-4">
          لوحة إدارة المنصة المركزية مخصصة حصراً لإدارة المنصة السحابية الرئيسية ولا يمكن للمشتركين الوصول إليها.
        </p>
        <Button size="xs" color="orange" onClick={() => window.location.href = '/dashboard'} className="bg-[#F45A0A] font-bold">
          العودة للوحة التحكم
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 px-3 py-2 font-sans text-slate-800 select-none" dir="rtl">
      {/* ── 3. LUXURY SEGMENTED TAB NAVIGATION BAR ── */}
      <div className="bg-slate-100/90 p-1 rounded-2xl border border-slate-200/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar shadow-2xs select-none h-[46px]">
        {navTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                outline: 'none',
                border: 'none',
              }}
              className={`relative h-[36px] px-3.5 rounded-xl font-bold text-xs flex items-center gap-2 whitespace-nowrap select-none transition-colors duration-150 border-none outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 cursor-pointer ${
                isActive
                  ? 'bg-[#F45A0A] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Icon size={16} strokeWidth={isActive ? 2.2 : 1.8} className="shrink-0" />
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10.5px] font-mono font-bold leading-none ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {tab.count}
                </span>
              )}
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10.5px] font-mono font-bold leading-none ${
                    isActive ? 'bg-white text-[#F45A0A]' : 'bg-[#F45A0A] text-white'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          TAB 1: TENANTS DATA TABLE
         ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'tenants' && (
        <div className="space-y-3.5">
          {/* Search & Filter Toolbar */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-2xs flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
              <div className="relative flex-1 max-w-[340px]">
                <TextInput
                  size="xs"
                  placeholder="بحث باسم المؤسسة، الرمز، مالك الشركة، أو البريد..."
                  leftSection={<IconSearch size={14} className="text-slate-400" />}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.currentTarget.value)}
                  className="w-full"
                  styles={{
                    input: {
                      height: '38px',
                      borderRadius: '10px',
                      borderColor: '#E2E8F0',
                      fontSize: '12px',
                    },
                  }}
                />
              </div>

              <Select
                size="xs"
                value={statusFilter}
                onChange={(val) => setStatusFilter(val || 'ALL')}
                data={[
                  { value: 'ALL', label: 'جميع الحالات' },
                  { value: 'ACTIVE', label: 'نشط (Active)' },
                  { value: 'SUSPENDED', label: 'معلق (Suspended)' },
                  { value: 'TRIAL', label: 'تجريبي (Trial)' },
                ]}
                className="w-[160px]"
                styles={{
                  input: {
                    height: '38px',
                    borderRadius: '10px',
                    borderColor: '#E2E8F0',
                    fontSize: '12px',
                    fontWeight: 700,
                  },
                }}
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-black font-mono text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200/60">
                {filteredTenants.length} من {totalTenants} شركة مشتركة
              </span>
            </div>
          </div>

          {/* Unified Tenants & Owner Roles Table */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-slate-200/80 text-[12px] font-black text-slate-700">
                    <th className="px-4 py-3.5 whitespace-nowrap text-center w-12">#</th>
                    <th className="px-4 py-3.5 whitespace-nowrap">المؤسسة / الشركة</th>
                    <th className="px-4 py-3.5 whitespace-nowrap">مالك الشركة المسجل</th>
                    <th className="px-4 py-3.5 whitespace-nowrap">الباقة والترخيص</th>
                    <th className="px-4 py-3.5 whitespace-nowrap">صلاحيات المالك</th>
                    <th className="px-4 py-3.5 whitespace-nowrap">المستخدمين / الفروع</th>
                    <th className="px-4 py-3.5 whitespace-nowrap">نهاية الدورة</th>
                    <th className="px-4 py-3.5 whitespace-nowrap text-center">الحالة</th>
                    <th className="px-4 py-3.5 whitespace-nowrap text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {loadingTenants ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-slate-400">
                        <Loader size="sm" color="orange" className="mx-auto" />
                        <span className="block text-xs mt-2 font-bold">جاري تحميل بيانات المؤسسات...</span>
                      </td>
                    </tr>
                  ) : filteredTenants.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-slate-400 font-bold">
                        لا توجد مؤسسات أو شركات مطابقة
                      </td>
                    </tr>
                  ) : (
                    filteredTenants.map((t, idx) => {
                      const ownerCustomPerms: string[] = (t as any).ownerPermissions || ['*'];
                      const isWildcard = ownerCustomPerms.includes('*');

                      return (
                        <tr key={t.id} className="hover:bg-orange-50/30 transition-colors">
                          {/* Index */}
                          <td className="px-4 py-3 text-center font-mono font-bold text-slate-400 text-[11px]">
                            {idx + 1}
                          </td>

                          {/* Tenant & Slug */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#F45A0A] font-black flex items-center justify-center shrink-0 border border-orange-100 text-xs shadow-2xs">
                                {t.name?.charAt(0) || '🏢'}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                  <span>{t.name}</span>
                                </div>
                                <span className="text-[11px] text-slate-400 font-mono">
                                  {t.slug} • {t.city || 'العراق'}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Owner */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="font-bold text-slate-900 text-xs">
                              {t.owner?.name || 'المدير العام'}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {t.owner?.email || t.email || '—'} {t.owner?.phone ? `• ${t.owner.phone}` : ''}
                            </div>
                          </td>

                          {/* Plan */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                t.currentPlanCode === 'ENTERPRISE'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : t.currentPlanCode === 'PRO'
                                  ? 'bg-orange-50 text-[#F45A0A] border-orange-200'
                                  : 'bg-blue-50 text-blue-700 border-blue-200'
                              }`}>
                                {t.currentPlan}
                              </span>
                              <span className="block font-mono font-bold text-slate-700 text-[11px] mt-0.5">
                                ${t.currentPriceMonthly || 0}/شهر
                              </span>
                            </div>
                          </td>

                          {/* Owner Permissions Level */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {isWildcard ? (
                                <Badge color="teal" variant="filled" className="font-bold text-[10.5px]">
                                  صلاحيات شاملة (*)
                                </Badge>
                              ) : (
                                <Badge color="blue" variant="light" className="font-mono font-bold text-[10.5px] tabular-nums">
                                  {ownerCustomPerms.length} صلاحية مخصصة
                                </Badge>
                              )}
                              <Tooltip label="تخصيص مصفوفة الصلاحيات لمالك الشركة">
                                <ActionIcon
                                  size="xs"
                                  variant="light"
                                  color="orange"
                                  onClick={() => handleOpenOwnerPermissionsModal(t)}
                                  className="cursor-pointer"
                                >
                                  <IconShieldCheck size={13} />
                                </ActionIcon>
                              </Tooltip>
                            </div>
                          </td>

                          {/* Users / Branches */}
                          <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-700 text-xs">
                            <span className="font-bold text-slate-900">{t.stats?.usersCount || 1}</span> مستخدم • <span className="font-bold text-slate-900">{t.stats?.branchesCount || 1}</span> فرع
                          </td>

                          {/* Period End */}
                          <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-600 text-xs tabular-nums">
                            {t.currentPeriodEnd ? new Date(t.currentPeriodEnd).toLocaleDateString('en-GB') : '—'}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                              t.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : t.status === 'SUSPENDED'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${t.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                              <span>{t.status === 'ACTIVE' ? 'نشط' : t.status === 'SUSPENDED' ? 'معلق' : t.status}</span>
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Preview / Impersonate Owner */}
                              <Tooltip label="معاينة ودخول بوضع مالك الشركة" position="top">
                                <Button
                                  size="xs"
                                  variant="light"
                                  color="orange"
                                  leftSection={<IconEyeCheck size={13} />}
                                  loading={impersonateMutation.isPending && impersonateMutation.variables === t.id}
                                  onClick={() => impersonateMutation.mutate(t.id)}
                                  className="font-bold rounded-lg h-7 px-2.5 text-[11px] text-[#F45A0A] bg-orange-50 hover:bg-orange-100 border border-orange-200 shadow-2xs"
                                >
                                  معاينة
                                </Button>
                              </Tooltip>

                              {/* Menu for further actions */}
                              <Menu shadow="md" width={200} position="bottom-end" radius="md">
                                <Menu.Target>
                                  <ActionIcon
                                    size="sm"
                                    variant="subtle"
                                    color="gray"
                                    className="hover:text-slate-900 cursor-pointer"
                                  >
                                    <IconDotsVertical size={15} />
                                  </ActionIcon>
                                </Menu.Target>

                                <Menu.Dropdown className="text-xs font-bold p-1 space-y-0.5">
                                  <Menu.Item
                                    leftSection={<IconShieldCheck size={14} className="text-blue-600" />}
                                    onClick={() => handleOpenOwnerPermissionsModal(t)}
                                  >
                                    تخصيص صلاحيات المالك
                                  </Menu.Item>

                                  <Menu.Item
                                    leftSection={<IconSparkles size={14} className="text-[#F45A0A]" />}
                                    onClick={() => {
                                      setSelectedTenant(t);
                                      setNewPlanCode(t.currentPlanCode === 'BASIC' ? 'PRO' : t.currentPlanCode === 'PRO' ? 'ENTERPRISE' : 'PRO');
                                      setChangePlanModalOpened(true);
                                    }}
                                  >
                                    تغيير / ترقية الباقة
                                  </Menu.Item>

                                  <Menu.Item
                                    leftSection={<IconCash size={14} className="text-emerald-600" />}
                                    onClick={() => {
                                      setSelectedTenant(t);
                                      setPaymentAmount(t.currentPriceMonthly || 99);
                                      setRenewModalOpened(true);
                                    }}
                                  >
                                    تجديد وتسجيل دفعة
                                  </Menu.Item>

                                  {t.status === 'ACTIVE' ? (
                                    <Menu.Item
                                      color="orange"
                                      leftSection={<IconPlayerPause size={14} />}
                                      onClick={() => {
                                        setSelectedTenant(t);
                                        setSuspendModalOpened(true);
                                      }}
                                    >
                                      إيقاف / تعليق المؤسسة
                                    </Menu.Item>
                                  ) : (
                                    <Menu.Item
                                      color="emerald"
                                      leftSection={<IconPlayerPlay size={14} />}
                                      onClick={() => reactivateMutation.mutate(t.id)}
                                    >
                                      إعادة تفعيل المؤسسة
                                    </Menu.Item>
                                  )}

                                  <Menu.Divider />
                                  <Menu.Item
                                    color="red"
                                    leftSection={<IconTrash size={14} />}
                                    onClick={() => {
                                      setTenantToDelete(t);
                                      setDeleteModalOpened(true);
                                    }}
                                  >
                                    حذف المؤسسة نهائياً
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
          </div>
        </div>
      )}

      {activeTab === 'database_usage' && (
        <div className="space-y-3.5">
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-orange-50 text-[#F45A0A] border border-orange-200 flex items-center justify-center shrink-0">
                <IconDatabase size={21} strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-black text-slate-900">استخدام قاعدة البيانات حسب مسؤول الشركة</h2>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5 leading-relaxed">
                  قياس مباشر لحجم السجلات الفعلية داخل PostgreSQL. تظهر المرفقات منفصلة لأنها قد تكون مخزنة خارج قاعدة البيانات.
                </p>
                {databaseUsage?.providerIntegration?.connected && (
                  <p className="text-[10px] text-emerald-700 font-bold mt-1">
                    Supabase Management API متصل • {databaseUsage.providerIntegration.projectName || 'المشروع الحالي'} • آخر قياس {new Date(databaseUsage.providerIntegration.measuredAt).toLocaleDateString('en-GB') + ' ' + new Date(databaseUsage.providerIntegration.measuredAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Tooltip label="تصدير تقرير الاستخدام إلى Excel">
                <ActionIcon
                  size="lg"
                  variant="default"
                  onClick={exportDatabaseUsageExcel}
                  disabled={!databaseUsage}
                  aria-label="تصدير Excel"
                >
                  <IconFileTypeXls size={18} className="text-emerald-600" />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="فتح نافذة الطباعة أو الحفظ بصيغة PDF">
                <ActionIcon
                  size="lg"
                  variant="default"
                  onClick={() => window.print()}
                  disabled={!databaseUsage}
                  aria-label="طباعة أو PDF"
                >
                  <IconPrinter size={18} className="text-slate-600" />
                </ActionIcon>
              </Tooltip>
              <Button
                size="xs"
                variant="default"
                leftSection={<IconEdit size={14} />}
                onClick={() => setDatabaseProviderModalOpened(true)}
                className="font-bold text-xs rounded-lg h-9"
              >
                إعداد السعة والفاتورة
              </Button>
              <Button
                size="xs"
                variant="default"
                leftSection={<IconRefresh size={14} className={measureDatabaseUsageMutation.isPending ? 'animate-spin' : ''} />}
                loading={measureDatabaseUsageMutation.isPending}
                onClick={() => measureDatabaseUsageMutation.mutate()}
                className="font-bold text-xs rounded-lg h-9"
              >
                إعادة القياس
              </Button>
            </div>
          </div>

          {loadingDatabaseUsage ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-3">
              {[0, 1, 2, 3, 4, 5].map((item) => (
                <div key={item} className="bg-white border border-slate-200 rounded-lg p-4 h-[104px]">
                  <Skeleton height={12} width="45%" radius="sm" />
                  <Skeleton height={24} width="65%" radius="sm" mt={18} />
                  <Skeleton height={9} width="80%" radius="sm" mt={10} />
                </div>
              ))}
            </div>
          ) : databaseUsageFailed ? (
            <Alert
              color="red"
              variant="light"
              radius="md"
              icon={<IconAlertCircle size={18} />}
              title="تعذر قياس استخدام قاعدة البيانات"
              className="text-xs font-bold"
            >
              {databaseUsageError instanceof Error ? databaseUsageError.message : 'حدث خطأ أثناء قراءة بيانات PostgreSQL.'}
            </Alert>
          ) : databaseUsage ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-3">
                {/* 1. Database Usage */}
                <div className="bg-white border border-orange-200/90 rounded-2xl p-4 shadow-2xs flex flex-col justify-between min-h-[145px]">
                  <div className="flex items-center justify-between text-slate-500 pb-1 border-b border-slate-100">
                    <span className="text-xs font-black text-slate-900">إجمالي قاعدة البيانات</span>
                    <div className="w-7 h-7 rounded-lg bg-orange-50 text-[#F45A0A] flex items-center justify-center">
                      <IconDatabase size={15} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-black font-mono text-slate-900 tabular-nums truncate" dir="ltr">
                        {databaseUsage.resources.database.usedBytes === null
                          ? 'غير متاح'
                          : formatBytes(databaseUsage.resources.database.usedBytes)}
                        {databaseUsage.resources.database.capacityBytes && (
                          <span className="text-[10px] text-slate-400 block font-normal">
                            من {formatBytes(databaseUsage.resources.database.capacityBytes)}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-orange-600 block mt-1 truncate">
                        {databaseUsage.resources.database.usagePercent === null
                          ? 'حالة السعة غير متاحة'
                          : `${databaseUsage.resources.database.usagePercent.toFixed(2)}% مستخدم`}
                      </span>
                    </div>
                    <SemiCircleGauge
                      percent={databaseUsage.resources.database.usagePercent || 0}
                      color="#F45A0A"
                      size={72}
                      strokeWidth={7}
                    />
                  </div>
                </div>

                {/* 2. Files Storage */}
                <div className="bg-white border border-blue-200/80 rounded-2xl p-4 shadow-2xs flex flex-col justify-between min-h-[145px]">
                  <div className="flex items-center justify-between text-slate-500 pb-1 border-b border-slate-100">
                    <span className="text-xs font-black text-slate-900">إجمالي الملفات</span>
                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <IconPhoto size={15} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-black font-mono text-slate-900 tabular-nums truncate" dir="ltr">
                        {databaseUsage.resources.storage.usedBytes === null
                          ? 'غير متاح'
                          : formatBytes(databaseUsage.resources.storage.usedBytes)}
                        {databaseUsage.resources.storage.capacityBytes && (
                          <span className="text-[10px] text-slate-400 block font-normal">
                            من {formatBytes(databaseUsage.resources.storage.capacityBytes)}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-blue-600 block mt-1 truncate">
                        {databaseUsage.resources.storage.objectCount || 0} ملف مسجل
                      </span>
                    </div>
                    <SemiCircleGauge
                      percent={databaseUsage.resources.storage.usagePercent || 0}
                      color="#2563EB"
                      size={72}
                      strokeWidth={7}
                    />
                  </div>
                </div>

                {/* 3. Bandwidth / Egress */}
                <div className="bg-white border border-purple-200/80 rounded-2xl p-4 shadow-2xs flex flex-col justify-between min-h-[145px]">
                  <div className="flex items-center justify-between text-slate-500 pb-1 border-b border-slate-100">
                    <span className="text-xs font-black text-slate-900">نقل البيانات (Egress)</span>
                    <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                      <IconSend size={15} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-black font-mono text-slate-900 tabular-nums truncate" dir="ltr">
                        {databaseUsage.resources.egress.usedBytes === null
                          ? 'غير متاح'
                          : formatBytes(databaseUsage.resources.egress.usedBytes)}
                        {databaseUsage.resources.egress.capacityBytes && (
                          <span className="text-[10px] text-slate-400 block font-normal">
                            من {formatBytes(databaseUsage.resources.egress.capacityBytes)}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-purple-600 block mt-1 truncate">
                        Supabase لا يتيح Egress الفوتري عبر API العام
                      </span>
                    </div>
                    <SemiCircleGauge
                      percent={databaseUsage.resources.egress.usagePercent || 0}
                      color="#7C3AED"
                      size={72}
                      strokeWidth={7}
                    />
                  </div>
                </div>

                {/* 4. Expected Cost */}
                <div className="bg-white border border-amber-200/80 rounded-2xl p-4 shadow-2xs flex flex-col justify-between min-h-[145px]">
                  <div className="flex items-center justify-between text-slate-500 pb-1 border-b border-slate-100">
                    <span className="text-xs font-black text-slate-900">التكلفة المتوقعة</span>
                    <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                      <IconCreditCard size={15} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-black font-mono text-slate-900 tabular-nums truncate" dir="ltr">
                        {databaseUsage.database.billing
                          ? formatMoneyCents(databaseUsage.database.billing.invoiceAmountCents, databaseUsage.database.billing.currency)
                          : 'غير مسجلة'}
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 block mt-1 truncate">
                        المدفوع: {databaseUsage.database.billing ? formatMoneyCents(databaseUsage.database.billing.paidAmountCents, databaseUsage.database.billing.currency) : 'غير مسجل'}
                      </span>
                    </div>
                    <SemiCircleGauge
                      percent={databaseUsage.database.billing && databaseUsage.database.billing.invoiceAmountCents > 0
                        ? Math.min(100, Math.round((databaseUsage.database.billing.paidAmountCents / databaseUsage.database.billing.invoiceAmountCents) * 100))
                        : 0}
                      color="#F59E0B"
                      size={72}
                      strokeWidth={7}
                      label={databaseUsage.database.billing && databaseUsage.database.billing.invoiceAmountCents > 0
                        ? formatMoneyCents(databaseUsage.database.billing.invoiceAmountCents, databaseUsage.database.billing.currency)
                        : '—'}
                    />
                  </div>
                </div>

                {/* 5. Subscription Revenue */}
                <div className="bg-white border border-emerald-200/80 rounded-2xl p-4 shadow-2xs flex flex-col justify-between min-h-[150px]">
                  <div className="flex items-center justify-between text-slate-500 pb-1 border-b border-slate-100">
                    <span className="text-xs font-black text-slate-900">إيرادات الاشتراكات</span>
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <IconReceipt size={15} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-black font-mono text-emerald-600 tabular-nums truncate" dir="ltr">
                        {databaseUsage.profitability.subscriptionRevenueByCurrency.length
                          ? databaseUsage.profitability.subscriptionRevenueByCurrency
                              .map((item) => formatMoneyCents(item.amountCents, item.currency))
                              .join(' + ')
                          : '$0.00'}
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 block mt-1 truncate">
                        مدفوعات مسددة ومكتملة
                      </span>
                    </div>
                    <SemiCircleGauge
                      percent={historyStats.totalRevenueUSD > 0 ? 100 : 0}
                      color="#10B981"
                      size={72}
                      strokeWidth={7}
                      label={`$${historyStats.totalRevenueUSD.toFixed(0)}`}
                    />
                  </div>
                </div>

                {/* 6. Net Profit / Margin */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col justify-between min-h-[150px]">
                  <div className="flex items-center justify-between text-slate-500 pb-1 border-b border-slate-100">
                    <span className="text-xs font-black text-slate-900">صافي ربح المنصة</span>
                    <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                      <IconCoins size={15} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-black font-mono text-slate-900 tabular-nums truncate" dir="ltr">
                        {databaseUsage.profitability.netProfitByCurrency.length
                          ? databaseUsage.profitability.netProfitByCurrency
                              .map((item) => formatMoneyCents(item.amountCents, item.currency))
                              .join(' + ')
                          : 'غير محسوب'}
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 block mt-1 truncate">
                        الإيراد − تكلفة الخادم
                      </span>
                    </div>
                    <SemiCircleGauge
                      percent={Math.abs(usageProfitMargin)}
                      color={(usageNetProfitUsdCents ?? 0) >= 0 ? '#10B981' : '#E11D48'}
                      size={72}
                      strokeWidth={7}
                      label={usageNetProfitUsdCents === null ? '—' : formatMoneyCents(usageNetProfitUsdCents, 'USD')}
                    />
                  </div>
                </div>
              </div><div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 flex items-center gap-x-6 gap-y-2 flex-wrap text-[11px] text-slate-600 font-medium">
                <span>بيانات الشركات: <strong className="font-mono text-slate-900" dir="ltr">{formatBytes(databaseUsage.totals.databaseBytes)}</strong></span>
                <span>السجلات: <strong className="font-mono text-slate-900">{databaseUsage.totals.recordCount.toLocaleString('en-US')}</strong></span>
                <span>المرفقات: <strong className="font-mono text-slate-900" dir="ltr">{formatBytes(databaseUsage.totals.attachmentBytes)}</strong></span>
                <span>آخر قياس: <strong className="text-slate-900">{new Date(databaseUsage.measuredAt).toLocaleDateString('en-GB') + ' ' + new Date(databaseUsage.measuredAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</strong></span>
              </div>

              {databaseUsage.alerts.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {databaseUsage.alerts.map((alert) => (
                    <div
                      key={`${alert.resource}-${alert.threshold}`}
                      className={`border rounded-lg px-3.5 py-2.5 flex items-center gap-2 text-[11px] font-bold ${
                        alert.level === 'CRITICAL'
                          ? 'bg-rose-50 border-rose-200 text-rose-700'
                          : alert.level === 'WARNING'
                            ? 'bg-orange-50 border-orange-200 text-orange-700'
                            : 'bg-amber-50 border-amber-200 text-amber-700'
                      }`}
                    >
                      <IconAlertCircle size={16} />
                      <span>{alert.message}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                <section className="bg-white border border-slate-200 rounded-lg p-4 min-h-[340px]">
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="text-sm font-black text-slate-900">نمو الاستخدام خلال 12 شهراً</h3>
                      <p className="text-[10.5px] text-slate-500 mt-0.5">آخر قياس فعلي لكل شهر، دون إنشاء نقاط تاريخية افتراضية</p>
                    </div>
                    <Badge size="sm" variant="light" color="orange">{databaseUsage.history.length} قياس</Badge>
                  </div>
                  <ReactECharts option={usageGrowthChartOption} style={{ height: 270, width: '100%' }} notMerge lazyUpdate />
                  {databaseUsage.history.length < 2 && (
                    <div className="text-center text-[10.5px] text-amber-700 font-bold -mt-4">
                      يبدأ الاتجاه والتوقع بعد توفر قياسين يفصل بينهما ست ساعات على الأقل.
                    </div>
                  )}
                </section>

                <section className="bg-white border border-slate-200 rounded-lg p-4 min-h-[340px]">
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="text-sm font-black text-slate-900">توزيع الاستخدام حسب المؤسسات</h3>
                      <p className="text-[10.5px] text-slate-500 mt-0.5">PostgreSQL والمرفقات منفصلان، ومرتبان من الأعلى استهلاكاً</p>
                    </div>
                    <Badge size="sm" variant="light" color="blue">أكبر {Math.min(databaseUsage.tenants.length, 8)}</Badge>
                  </div>
                  <ReactECharts option={usageDistributionChartOption} style={{ height: 270, width: '100%' }} notMerge lazyUpdate />
                </section>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap">
                <TextInput
                  size="xs"
                  placeholder="بحث باسم الشركة أو المسؤول أو البريد..."
                  leftSection={<IconSearch size={14} className="text-slate-400" />}
                  value={databaseUsageSearch}
                  onChange={(event) => setDatabaseUsageSearch(event.currentTarget.value)}
                  className="w-full max-w-[380px]"
                  styles={{ input: { height: '38px', borderRadius: '8px', fontSize: '12px' } }}
                />
                <span className="text-[11px] font-bold text-slate-500">
                  الفهارس والمساحة المشتركة للنظام لا تنسب إلى شركة بعينها.
                </span>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse min-w-[1320px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[12px] font-black text-slate-700">
                        <th className="px-4 py-3.5 whitespace-nowrap">المؤسسة</th>
                        <th className="px-4 py-3.5 whitespace-nowrap">الباقة</th>
                        <th className="px-4 py-3.5 whitespace-nowrap">بيانات PostgreSQL</th>
                        <th className="px-4 py-3.5 whitespace-nowrap">نسبة الحصة</th>
                        <th className="px-4 py-3.5 whitespace-nowrap">النمو هذا الشهر</th>
                        <th className="px-4 py-3.5 whitespace-nowrap">التكلفة التقديرية</th>
                        <th className="px-4 py-3.5 whitespace-nowrap">حالة الاستخدام</th>
                        <th className="px-4 py-3.5 whitespace-nowrap">آخر قياس</th>
                        <th className="px-4 py-3.5 whitespace-nowrap">التفاصيل</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredDatabaseUsage.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="text-center py-12 text-slate-400 font-bold">
                            لا توجد شركات مطابقة للبحث
                          </td>
                        </tr>
                      ) : (
                        filteredDatabaseUsage.map((item) => (
                          <tr key={item.tenantId} className="hover:bg-orange-50/30 transition-colors">
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#F45A0A] border border-orange-100 flex items-center justify-center font-black shrink-0">
                                  {item.tenantName.charAt(0)}
                                </div>
                                <div>
                                  <div className="font-black text-slate-900 flex items-center gap-1.5">
                                    {item.tenantName}
                                    {item.isRoot && <Badge size="xs" color="dark" variant="filled">الرئيسية</Badge>}
                                  </div>
                                  <div className="text-[10.5px] text-slate-400">
                                    {item.owner?.name || 'مسؤول غير مسجل'} • <span className="font-mono">{item.tenantSlug}</span>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <div className="font-black text-slate-900">{item.billing.planName}</div>
                              <div className="text-[10px] text-slate-500">{item.isRoot ? 'غير خاضع للفوترة' : item.billing.status}</div>
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <div className="font-black text-[13px] text-slate-900 font-mono tabular-nums" dir="ltr">
                                {formatBytes(item.databaseBytes)}
                              </div>
                              <div className="text-[10px] text-slate-500">{item.recordCount.toLocaleString('en-US')} سجل</div>
                            </td>
                            <td className="px-4 py-3.5 min-w-[180px]">
                              {item.usageStatus === 'UNLIMITED' ? (
                                <div className="text-[11px] font-black text-slate-600">بلا حدود</div>
                              ) : item.databaseQuotaBytes && item.quotaUsagePercent !== null ? (
                                <div>
                                  <div className="flex items-center justify-between gap-2 text-[10.5px] font-bold mb-1.5">
                                    <span>{item.quotaUsagePercent.toFixed(2)}%</span>
                                    <span className="font-mono text-slate-500" dir="ltr">{formatBytes(item.databaseBytes)} / {formatBytes(item.databaseQuotaBytes)}</span>
                                  </div>
                                  <Progress
                                    value={Math.min(item.quotaUsagePercent, 100)}
                                    color={item.quotaUsagePercent >= 95 ? 'red' : item.quotaUsagePercent >= 85 ? 'orange' : item.quotaUsagePercent >= 70 ? 'yellow' : 'teal'}
                                    size="sm"
                                    radius="xl"
                                  />
                                </div>
                              ) : (
                                <div className="text-[11px] font-bold text-slate-400">لم تُحدد حصة داخلية</div>
                              )}
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              {item.monthlyGrowthBytes === null ? (
                                <span className="text-[11px] font-bold text-slate-400">بانتظار قياس سابق</span>
                              ) : (
                                <>
                                  <div className={`font-black font-mono ${item.monthlyGrowthBytes > 0 ? 'text-amber-700' : 'text-emerald-700'}`} dir="ltr">
                                    {item.monthlyGrowthBytes > 0 ? '+' : ''}{formatBytes(item.monthlyGrowthBytes)}
                                  </div>
                                  <div className="text-[10px] text-slate-500">{item.monthlyGrowthPercent === null ? '—' : `${item.monthlyGrowthPercent > 0 ? '+' : ''}${item.monthlyGrowthPercent}%`}</div>
                                </>
                              )}
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <div className="font-black font-mono text-slate-900" dir="ltr">
                                {databaseUsage.profitability.providerCost
                                  ? formatMoneyCents(item.estimatedProviderCostCents, item.costCurrency)
                                  : 'غير محسوبة'}
                              </div>
                              <div className="text-[10px] text-slate-500">حسب حصة البيانات المنطقية</div>
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span className={`inline-flex px-2.5 py-1 rounded-md border text-[10.5px] font-black ${usageStatusMeta[item.usageStatus].className}`}>
                                {usageStatusMeta[item.usageStatus].label}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <div className="font-bold text-slate-800">{new Date(databaseUsage.measuredAt).toLocaleDateString('en-GB')}</div>
                              <div className="text-[10px] text-slate-500">{new Date(databaseUsage.measuredAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <Button
                                size="compact-xs"
                                variant="light"
                                color="orange"
                                onClick={() => {
                                  setSelectedDatabaseTenant(item);
                                  setTenantDatabaseQuotaGB(item.databaseQuotaBytes ? item.databaseQuotaBytes / 1024 ** 3 : '');
                                }}
                                className="font-black"
                              >
                                التفاصيل
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <section className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">سجل القياسات</h3>
                    <p className="text-[10.5px] text-slate-500 mt-0.5">الوقت، نتيجة القياس، والمستخدم الذي نفّذه</p>
                  </div>
                  <Badge size="sm" variant="light" color="gray">آخر {Math.min(databaseUsage.measurementLog.length, 50)}</Badge>
                </div>
                {databaseUsage.measurementLog.length ? (
                  <div className="overflow-x-auto mt-2">
                    <table className="w-full min-w-[660px] text-[11px] text-right">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-3 py-2">وقت القياس</th>
                          <th className="px-3 py-2">الحالة</th>
                          <th className="px-3 py-2">المنفذ</th>
                          <th className="px-3 py-2">التفاصيل</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {databaseUsage.measurementLog.slice(0, 10).map((entry) => (
                          <tr key={entry.id}>
                            <td className="px-3 py-2.5 font-mono">{new Date(entry.measuredAt).toLocaleDateString('en-GB') + ' ' + new Date(entry.measuredAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</td>
                            <td className="px-3 py-2.5">
                              <Badge size="xs" color={entry.status === 'SUCCESS' ? 'teal' : 'red'} variant="light">
                                {entry.status === 'SUCCESS' ? 'ناجح' : 'فشل'}
                              </Badge>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="font-bold text-slate-800">{entry.measuredBy?.name || 'النظام'}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{entry.measuredBy?.email || '—'}</div>
                            </td>
                            <td className="px-3 py-2.5 text-slate-500">{entry.error || 'اكتمل قياس PostgreSQL وStorage المتاح'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-7 text-[11px] text-slate-400 font-bold">اضغط إعادة القياس لإنشاء أول سجل</div>
                )}
              </section>

              <Drawer
                opened={Boolean(selectedDatabaseTenant)}
                onClose={() => setSelectedDatabaseTenant(null)}
                position="left"
                size="xl"
                title={
                  <div>
                    <div className="text-sm font-black text-slate-900">تفاصيل استهلاك المؤسسة</div>
                    <div className="text-[10.5px] text-slate-500 mt-0.5">{selectedDatabaseTenant?.tenantName}</div>
                  </div>
                }
                overlayProps={{ backgroundOpacity: 0.35, blur: 2 }}
                padding="lg"
                radius="md"
                dir="rtl"
              >
                {selectedDatabaseTenant && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                      {[
                        { label: 'بيانات PostgreSQL', value: formatBytes(selectedDatabaseTenant.databaseBytes) },
                        { label: 'المرفقات المسجلة', value: formatBytes(selectedDatabaseTenant.attachmentBytes) },
                        { label: 'السجلات', value: selectedDatabaseTenant.recordCount.toLocaleString('en-US') },
                        { label: 'المستخدمون المفعّلون', value: selectedDatabaseTenant.activeUserCount.toLocaleString('en-US') },
                      ].map((metric) => (
                        <div key={metric.label} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                          <div className="text-[10px] font-bold text-slate-500">{metric.label}</div>
                          <div className="text-sm font-black text-slate-900 font-mono mt-1" dir="ltr">{metric.value}</div>
                        </div>
                      ))}
                    </div>

                    <section>
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                        <h4 className="text-xs font-black text-slate-900">أكبر 10 جداول استهلاكاً</h4>
                        <span className="text-[10px] text-slate-500">الفهرس تقديري لأن الفهارس مشتركة داخل الجدول</span>
                      </div>
                      <div className="overflow-x-auto mt-2">
                        <table className="w-full min-w-[580px] text-[11px] text-right">
                          <thead className="text-slate-500 bg-slate-50">
                            <tr>
                              <th className="px-3 py-2">الجدول</th>
                              <th className="px-3 py-2">البيانات</th>
                              <th className="px-3 py-2">الفهرس التقديري</th>
                              <th className="px-3 py-2">السجلات</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {selectedDatabaseTenant.largestTables.length ? selectedDatabaseTenant.largestTables.map((table) => (
                              <tr key={table.tableName}>
                                <td className="px-3 py-2 font-mono font-bold text-slate-800">{table.tableName}</td>
                                <td className="px-3 py-2 font-mono" dir="ltr">{formatBytes(table.bytes)}</td>
                                <td className="px-3 py-2 font-mono" dir="ltr">{table.estimatedIndexBytes === null ? 'غير متاح' : formatBytes(table.estimatedIndexBytes)}</td>
                                <td className="px-3 py-2 font-mono">{table.records.toLocaleString('en-US')}</td>
                              </tr>
                            )) : (
                              <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-400 font-bold">لا توجد جداول منسوبة للمؤسسة</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>

                    <section>
                      <h4 className="text-xs font-black text-slate-900 pb-2 border-b border-slate-200">الملفات حسب النوع</h4>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mt-2">
                        {(['PDF', 'IMAGES', 'DOCUMENTS', 'OTHER'] as const).map((type) => {
                          const item = selectedDatabaseTenant.attachmentTypes.find((entry) => entry.fileType === type);
                          const labels = { PDF: 'PDF', IMAGES: 'صور', DOCUMENTS: 'مستندات', OTHER: 'أخرى' };
                          return (
                            <div key={type} className="border-b-2 border-slate-200 px-2 py-2.5">
                              <div className="text-[10px] font-bold text-slate-500">{labels[type]}</div>
                              <div className="text-sm font-black text-slate-900 font-mono mt-1" dir="ltr">{item ? formatBytes(item.fileBytes) : '0 B'}</div>
                              <div className="text-[10px] text-slate-400">{item?.fileCount || 0} ملف</div>
                            </div>
                          );
                        })}
                      </div>
                    </section>

                    <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="border border-slate-200 rounded-lg p-3.5">
                        <h4 className="text-xs font-black text-slate-900 mb-3">الفوترة والربحية</h4>
                        <div className="space-y-2 text-[11px]">
                          <div className="flex justify-between"><span className="text-slate-500">الباقة</span><strong>{selectedDatabaseTenant.billing.planName}</strong></div>
                          <div className="flex justify-between"><span className="text-slate-500">المدفوع المكتمل</span><strong dir="ltr">{formatMoneyCents(selectedDatabaseTenant.billing.paidCents, selectedDatabaseTenant.billing.currency)}</strong></div>
                          <div className="flex justify-between"><span className="text-slate-500">المتأخر</span><strong className="text-rose-600" dir="ltr">{formatMoneyCents(selectedDatabaseTenant.billing.amountDueCents, selectedDatabaseTenant.billing.currency)}</strong></div>
                          <div className="flex justify-between"><span className="text-slate-500">تكلفة المزود التقديرية</span><strong dir="ltr">{formatMoneyCents(selectedDatabaseTenant.estimatedProviderCostCents, selectedDatabaseTenant.costCurrency)}</strong></div>
                        </div>
                      </div>
                      <div className="border border-slate-200 rounded-lg p-3.5">
                        <h4 className="text-xs font-black text-slate-900 mb-3">موارد المشروع المشتركة</h4>
                        <div className="space-y-2 text-[11px] text-slate-600">
                          <div className="flex justify-between"><span>Egress الفوتري</span><strong>غير متاح من API</strong></div>
                          <div className="flex justify-between"><span>Realtime خلال 24 ساعة</span><strong dir="ltr">{databaseUsage.resources.realtime.usage === null ? 'غير متاح' : `${databaseUsage.resources.realtime.usage} طلب`}</strong></div>
                          <div className="flex justify-between"><span>Edge Functions المنشورة</span><strong dir="ltr">{databaseUsage.resources.edgeFunctions.usage === null ? 'غير متاح' : databaseUsage.resources.edgeFunctions.usage}</strong></div>
                          <div className="flex justify-between"><span>إجمالي طلبات API خلال 24 ساعة</span><strong dir="ltr">{databaseUsage.providerIntegration?.apiRequests?.total ?? 'غير متاح'}</strong></div>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-3">هذه الأرقام مشتركة لكل المؤسسات داخل مشروع Supabase وليست منسوبة إلى مؤسسة بعينها.</p>
                      </div>
                    </section>

                    <section>
                      <h4 className="text-xs font-black text-slate-900 pb-2 border-b border-slate-200">سجل الاستخدام الشهري</h4>
                      <div className="mt-2 space-y-1.5 max-h-[190px] overflow-y-auto">
                        {databaseUsage.history.slice().reverse().map((snapshot) => {
                          const tenantPoint = snapshot.tenantUsage.find((entry) => entry.tenantId === selectedDatabaseTenant.tenantId);
                          return (
                            <div key={snapshot.id} className="flex items-center justify-between gap-3 px-2 py-2 border-b border-slate-100 text-[11px]">
                              <span className="text-slate-500">{new Date(snapshot.measuredAt).toLocaleDateString('en-GB') + ' ' + new Date(snapshot.measuredAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</span>
                              <span className="font-mono font-black" dir="ltr">{tenantPoint ? formatBytes(tenantPoint.databaseBytes) : 'غير متاح'}</span>
                            </div>
                          );
                        })}
                      </div>
                    </section>

                    {!selectedDatabaseTenant.isRoot && (
                      <section className="border-t border-slate-200 pt-4">
                        <h4 className="text-xs font-black text-slate-900 mb-2">الحصة الداخلية للمؤسسة</h4>
                        <div className="flex items-end gap-2">
                          <NumberInput
                            label="حد PostgreSQL الداخلي (GB)"
                            placeholder="مثال: 1"
                            min={0.001}
                            decimalScale={3}
                            value={tenantDatabaseQuotaGB}
                            onChange={setTenantDatabaseQuotaGB}
                            className="flex-1"
                            styles={{ label: { fontSize: '11px', fontWeight: 700 }, input: { borderRadius: 8 } }}
                          />
                          <Button
                            color="orange"
                            size="sm"
                            loading={updateTenantQuotaMutation.isPending}
                            disabled={Number(tenantDatabaseQuotaGB) <= 0}
                            onClick={() => updateTenantQuotaMutation.mutate({
                              tenantId: selectedDatabaseTenant.tenantId,
                              quotaBytes: Math.round(Number(tenantDatabaseQuotaGB) * 1024 ** 3),
                            })}
                            className="font-black"
                          >
                            حفظ الحصة
                          </Button>
                          {selectedDatabaseTenant.databaseQuotaBytes && (
                            <Button
                              variant="default"
                              size="sm"
                              loading={updateTenantQuotaMutation.isPending}
                              onClick={() => updateTenantQuotaMutation.mutate({ tenantId: selectedDatabaseTenant.tenantId, quotaBytes: null })}
                              className="font-bold"
                            >
                              إزالة الحد
                            </Button>
                          )}
                        </div>
                      </section>
                    )}
                  </div>
                )}
              </Drawer>

              <Modal
                opened={databaseProviderModalOpened}
                onClose={() => setDatabaseProviderModalOpened(false)}
                title={
                  <div>
                    <div className="font-black text-sm text-slate-900">سعات وفاتورة مزود البنية السحابية</div>
                    <div className="text-[10px] text-slate-500 font-medium mt-0.5">PostgreSQL وStorage وEgress مسجلة كموارد مستقلة</div>
                  </div>
                }
                centered
                size="lg"
                radius="md"
                dir="rtl"
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <TextInput
                      label="مزود البنية السحابية"
                      placeholder="Supabase"
                      value={databaseProviderName}
                      onChange={(event) => setDatabaseProviderName(event.currentTarget.value)}
                      required
                      styles={{ label: { fontSize: '11px', fontWeight: 700 }, input: { borderRadius: '8px' } }}
                    />
                    <TextInput
                      label="اسم الباقة الحالية"
                      placeholder="اسم الباقة كما في الفاتورة"
                      value={databasePlanName}
                      onChange={(event) => setDatabasePlanName(event.currentTarget.value)}
                      required
                      styles={{ label: { fontSize: '11px', fontWeight: 700 }, input: { borderRadius: '8px' } }}
                    />
                    <NumberInput
                      label="سعة PostgreSQL (GB)"
                      placeholder="0"
                      min={0.001}
                      decimalScale={3}
                      value={databaseCapacityGB}
                      onChange={setDatabaseCapacityGB}
                      required
                      styles={{ label: { fontSize: '11px', fontWeight: 700 }, input: { borderRadius: '8px' } }}
                    />
                    <NumberInput
                      label="سعة الملفات Storage (GB)"
                      placeholder="100"
                      min={0.001}
                      decimalScale={3}
                      value={storageCapacityGB}
                      onChange={setStorageCapacityGB}
                      required
                      styles={{ label: { fontSize: '11px', fontWeight: 700 }, input: { borderRadius: '8px' } }}
                    />
                    <NumberInput
                      label="سعة نقل البيانات Egress (GB/شهر)"
                      placeholder="250"
                      min={0.001}
                      decimalScale={3}
                      value={egressCapacityGB}
                      onChange={setEgressCapacityGB}
                      required
                      styles={{ label: { fontSize: '11px', fontWeight: 700 }, input: { borderRadius: '8px' } }}
                    />
                    <Select
                      label="عملة الفاتورة"
                      data={[{ value: 'USD', label: 'USD دولار' }, { value: 'IQD', label: 'IQD دينار عراقي' }]}
                      value={databaseBillingCurrency}
                      onChange={(value) => setDatabaseBillingCurrency(value === 'IQD' ? 'IQD' : 'USD')}
                      allowDeselect={false}
                      styles={{ label: { fontSize: '11px', fontWeight: 700 }, input: { borderRadius: '8px' } }}
                    />
                    <NumberInput
                      label="قيمة فاتورة الدورة"
                      placeholder="0.00"
                      min={0}
                      decimalScale={2}
                      value={databaseInvoiceAmount}
                      onChange={setDatabaseInvoiceAmount}
                      required
                      styles={{ label: { fontSize: '11px', fontWeight: 700 }, input: { borderRadius: '8px' } }}
                    />
                    <NumberInput
                      label="المبلغ المدفوع من الفاتورة"
                      placeholder="0.00"
                      min={0}
                      decimalScale={2}
                      value={databasePaidAmount}
                      onChange={setDatabasePaidAmount}
                      required
                      styles={{ label: { fontSize: '11px', fontWeight: 700 }, input: { borderRadius: '8px' } }}
                    />
                    <TextInput
                      type="date"
                      label="بداية دورة الفاتورة"
                      value={databaseBillingStart}
                      onInput={(event) => setDatabaseBillingStart(event.currentTarget.value)}
                      required
                      styles={{ label: { fontSize: '11px', fontWeight: 700 }, input: { borderRadius: '8px' } }}
                    />
                    <TextInput
                      type="date"
                      label="نهاية دورة الفاتورة"
                      value={databaseBillingEnd}
                      onInput={(event) => setDatabaseBillingEnd(event.currentTarget.value)}
                      required
                      styles={{ label: { fontSize: '11px', fontWeight: 700 }, input: { borderRadius: '8px' } }}
                    />
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-3 flex items-center justify-between gap-3">
                    <span className="text-xs font-bold text-slate-600">المبلغ المطلوب تسديده</span>
                    <span className="text-base font-black font-mono text-rose-600" dir="ltr">
                      {formatMoneyCents(
                        Math.max((Number(databaseInvoiceAmount) || 0) - (Number(databasePaidAmount) || 0), 0) * 100,
                        databaseBillingCurrency,
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button variant="default" size="xs" onClick={() => setDatabaseProviderModalOpened(false)} className="font-bold rounded-lg">
                      إلغاء
                    </Button>
                    <Button
                      color="orange"
                      size="xs"
                      loading={updateDatabaseProviderMutation.isPending}
                      disabled={
                        !databaseProviderName.trim() ||
                        !databasePlanName.trim() ||
                        Number(databaseCapacityGB) <= 0 ||
                        Number(storageCapacityGB) <= 0 ||
                        Number(egressCapacityGB) <= 0 ||
                        Number(databaseInvoiceAmount) < 0 ||
                        Number(databasePaidAmount) < 0 ||
                        Number(databasePaidAmount) > Number(databaseInvoiceAmount) ||
                        !databaseBillingStart ||
                        !databaseBillingEnd ||
                        databaseBillingEnd <= databaseBillingStart
                      }
                      onClick={() => updateDatabaseProviderMutation.mutate()}
                      className="font-bold bg-[#F45A0A] rounded-lg"
                    >
                      حفظ البيانات الفعلية
                    </Button>
                  </div>
                </div>
              </Modal>
            </>
          ) : null}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TAB: TENANT OWNER ROLES & PERMISSIONS GOVERNANCE (Platform Admin)
         ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                  <IconReceipt className="text-[#F45A0A]" size={20} />
                  <span>طلبات تجديد وترقية الباقات الواردة من الشركات</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  تحقق من إيصالات التحويل والمبالغ المستلمة؛ تفعيل الباقة يفتح النظام فورياً للشركة وموظفيها.
                </p>
              </div>
            </div>

            {loadingPending ? (
              <div className="space-y-3">
                <Skeleton height={70} radius="xl" />
                <Skeleton height={70} radius="xl" />
              </div>
            ) : pendingRenewals.length === 0 ? (
              <div className="p-12 text-center bg-slate-50/70 rounded-2xl border border-slate-200/80 space-y-2">
                <IconCircleCheck size={44} className="text-emerald-500 mx-auto" />
                <h4 className="font-black text-slate-800 text-sm">لا توجد طلبات تجديد معلقة حالياً</h4>
                <p className="text-xs text-slate-400">
                  كافة الحسابات والتحويلات المالية مفعلة ومحدثة بالكامل.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {pendingRenewals.map((item: any) => {
                  let requestedInfo: any = {};
                  let receipts: string[] = [];

                  if (item.notes) {
                    try {
                      requestedInfo = JSON.parse(item.notes);
                    } catch {}
                  }

                  if (item.receiptUrl) {
                    try {
                      receipts = JSON.parse(item.receiptUrl);
                    } catch {
                      receipts = [item.receiptUrl];
                    }
                  }

                  return (
                    <Card
                      key={item.id}
                      className="p-5 rounded-2xl bg-white border-2 border-orange-200 shadow-2xs hover:border-orange-400 transition-all"
                    >
                      <div className="flex items-start justify-between flex-wrap gap-4">
                        {/* Company & Request Details */}
                        <div className="space-y-2 flex-1 min-w-[280px]">
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-base text-slate-900">{item.tenant?.name || 'مؤسسة'}</h4>
                            <Badge color="orange" variant="filled" size="xs" className="font-bold">
                              طلب تجديد معلق
                            </Badge>
                          </div>

                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                            <span>كود المؤسسة: <strong className="font-mono text-slate-700">{item.tenant?.slug}</strong></span>
                            {item.tenant?.phone && <span>الهاتف: <strong className="font-mono text-slate-700">{item.tenant?.phone}</strong></span>}
                            {item.tenant?.email && <span>البريد: <strong className="font-mono text-slate-700">{item.tenant?.email}</strong></span>}
                          </div>

                          {/* Plan and Amount Requested */}
                          <div className="p-3.5 rounded-xl bg-orange-50/60 border border-orange-200/80 inline-flex items-center gap-4 flex-wrap">
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold block">الباقة المطلوبة</span>
                              <span className="font-black text-xs text-orange-950">
                                {requestedInfo.requestedPlanName || requestedInfo.requestedPlanCode || 'باقة'}
                              </span>
                            </div>

                            <div className="h-6 w-[1px] bg-orange-200" />

                            <div>
                              <span className="text-[10px] text-slate-400 font-bold block">المبلغ المحول</span>
                              <span className="font-mono font-black text-sm text-slate-900">${item.amountCents / 100} USD</span>
                            </div>

                            <div className="h-6 w-[1px] bg-orange-200" />

                            <div>
                              <span className="text-[10px] text-slate-400 font-bold block">قناة الدفع</span>
                              <span className="font-bold text-xs text-slate-800">{item.paymentMethod}</span>
                            </div>

                            <div className="h-6 w-[1px] bg-orange-200" />

                            <div>
                              <span className="text-[10px] text-slate-400 font-bold block">رقم المعاملة / الإشعار</span>
                              <span className="font-mono font-bold text-xs text-slate-900">{item.transactionRef || '—'}</span>
                            </div>
                          </div>

                          {requestedInfo.customerNotes && (
                            <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                              <strong>ملاحظات العميل:</strong> {requestedInfo.customerNotes}
                            </p>
                          )}
                        </div>

                        {/* Receipts Thumbnails Gallery */}
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-black text-slate-700 block flex items-center gap-1">
                            <IconPhoto size={14} className="text-[#F45A0A]" />
                            <span>إيصالات التحويل المرفقة ({receipts.length}):</span>
                          </span>

                          {receipts.length === 0 ? (
                            <span className="text-xs text-slate-400">لا يوجد إيصال مرفق</span>
                          ) : (
                            <div className="flex items-center gap-2 flex-wrap">
                              {receipts.map((imgUrl, idx) => (
                                <div
                                  key={idx}
                                  onClick={() => {
                                    setSelectedReceiptImage(imgUrl);
                                    setPreviewImageModalOpened(true);
                                  }}
                                  className="w-16 h-16 rounded-xl border-2 border-orange-300 overflow-hidden cursor-pointer hover:scale-105 hover:border-orange-500 transition-all shadow-2xs group relative"
                                >
                                  <img src={imgUrl} alt={`Receipt ${idx + 1}`} className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                                    <IconEye size={16} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Approval & Rejection Actions */}
                        <div className="flex flex-col gap-2 min-w-[170px] self-center">
                          <Button
                            color="teal"
                            size="xs"
                            leftSection={<IconCheck size={14} />}
                            loading={approveRenewalMutation.isPending}
                            onClick={() => approveRenewalMutation.mutate(item.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 font-bold rounded-xl h-9 shadow-xs"
                          >
                            تأكيد واستلام وتفعيل الباقة
                          </Button>

                          <Button
                            color="red"
                            variant="light"
                            size="xs"
                            leftSection={<IconCircleX size={14} />}
                            onClick={() => {
                              setSelectedPaymentToReject(item.id);
                              setRejectModalOpened(true);
                            }}
                            className="font-bold rounded-xl"
                          >
                            رفض الإشعار
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TAB 3: COMPARISON MATRIX & TERMS
         ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'matrix' && (
        <div className="space-y-4">
          <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                  <IconChecklist className="text-[#F45A0A]" size={20} />
                  <span>مصفوفة التحكم المباشر بجميع المزايا والشروط</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  انقر على أي خيار لتفعيله (✓) أو تعطيله (—) فورياً؛ أو أضف ميزة جديدة أو عدلها أو احذفها نهائياً.
                </p>
              </div>

              <Button
                size="xs"
                color="orange"
                leftSection={<IconPlus size={14} />}
                onClick={() => {
                  setNewFeatureName('');
                  setNewFeatureCode('');
                  setNewFeatureCategory('ACCOUNTING');
                  setNewFeatureDefaultEnabled(false);
                  setAddFeatureModalOpened(true);
                }}
                className="bg-[#F45A0A] hover:bg-orange-600 font-bold rounded-xl shadow-xs"
              >
                + إضافة ميزة جديدة للمصفوفة
              </Button>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto border border-slate-200/90 rounded-2xl">
              <Table className="text-xs text-right border-collapse">
                <Table.Thead className="bg-slate-50/90 text-slate-800 font-black border-b border-slate-200/90">
                  <Table.Tr className="divide-x divide-x-reverse divide-slate-200">
                    <Table.Th className="w-[32%] p-3.5 text-slate-900">الميزة / الخاصية</Table.Th>
                    <Table.Th className="text-center p-3 w-[17%]">
                      <span className="block font-black text-slate-900">الفترة التجريبية</span>
                      <span className="text-[10px] font-mono text-slate-500 font-normal">$0 / 14 يوماً</span>
                    </Table.Th>
                    <Table.Th className="text-center p-3 w-[17%]">
                      <span className="block font-black text-slate-900">الباقة الأساسية</span>
                      <span className="text-[10px] font-mono text-slate-500 font-normal">
                        ${(basicPlan?.versions[0]?.priceMonthlyCents || 9900) / 100} / شهرياً
                      </span>
                    </Table.Th>
                    <Table.Th className="text-center p-3 w-[17%] bg-orange-50/60">
                      <span className="block font-black text-orange-950">الباقة الاحترافية</span>
                      <span className="text-[10px] font-mono text-orange-700 font-bold">
                        ${(proPlan?.versions[0]?.priceMonthlyCents || 19900) / 100} / 3 أشهر
                      </span>
                    </Table.Th>
                    <Table.Th className="text-center p-3 w-[17%]">
                      <span className="block font-black text-slate-900">الباقة الشاملة</span>
                      <span className="text-[10px] font-mono text-slate-500 font-normal">
                        ${(enterprisePlan?.versions[0]?.priceMonthlyCents || 79900) / 100} / 3 أشهر
                      </span>
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>

                <Table.Tbody className="divide-y divide-slate-100">
                  {CATEGORY_ORDER.map((catKey) => {
                    const catFeatures = allFeaturesGrouped.filter((f) => f.category === catKey);
                    if (catFeatures.length === 0) return null;

                    return (
                      <React.Fragment key={catKey}>
                        <Table.Tr className="bg-slate-100/90">
                          <Table.Td colSpan={5} className="py-2.5 px-4 font-black text-xs text-slate-900">
                            {CATEGORY_TITLES[catKey] || catKey}
                          </Table.Td>
                        </Table.Tr>

                        {catFeatures.map((feat) => {
                          const isTrial = trialPlan ? (localFeatureState[trialPlan.id]?.[feat.code] ?? false) : false;
                          const isBasic = basicPlan ? (localFeatureState[basicPlan.id]?.[feat.code] ?? false) : false;
                          const isPro = proPlan ? (localFeatureState[proPlan.id]?.[feat.code] ?? false) : false;
                          const isEnterprise = enterprisePlan ? (localFeatureState[enterprisePlan.id]?.[feat.code] ?? false) : false;

                          return (
                            <Table.Tr key={feat.code} className="hover:bg-slate-50/70 divide-x divide-x-reverse divide-slate-100 group">
                              <Table.Td className="py-2.5 px-4 font-bold text-slate-800">
                                <div className="flex items-center justify-between gap-2">
                                  <div>
                                    <div className="text-slate-900 font-bold">{feat.nameAr}</div>
                                    <span className="text-[9.5px] font-mono text-slate-400 font-normal">{feat.code}</span>
                                  </div>
                                  <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100">
                                    <Tooltip label="تعديل اسم أو تصنيف الميزة" position="top" withArrow>
                                      <ActionIcon
                                        size="xs"
                                        variant="subtle"
                                        color="blue"
                                        onClick={() => {
                                          setSelectedFeatureToEdit(feat);
                                          setEditFeatureName(feat.nameAr);
                                          setEditFeatureCategory(feat.category || 'ACCOUNTING');
                                          setEditFeatureModalOpened(true);
                                        }}
                                      >
                                        <IconEdit size={14} />
                                      </ActionIcon>
                                    </Tooltip>
                                    <Tooltip label="حذف الميزة نهائياً من كافة الباقات" position="top" withArrow>
                                      <ActionIcon
                                        size="xs"
                                        variant="subtle"
                                        color="red"
                                        onClick={() => {
                                          if (window.confirm(`هل أنت متأكد من حذف الميزة "${feat.nameAr}" نهائياً من كافة الباقات وجدول المقارنة؟`)) {
                                            deleteFeatureMutation.mutate(feat.code);
                                          }
                                        }}
                                      >
                                        <IconTrash size={14} />
                                      </ActionIcon>
                                    </Tooltip>
                                  </div>
                                </div>
                              </Table.Td>

                              <Table.Td className="text-center py-2">
                                <button
                                  type="button"
                                  onClick={() => trialPlan && handleToggleFeature(trialPlan, feat.code)}
                                  className={`w-7 h-7 rounded-lg transition-colors flex items-center justify-center mx-auto cursor-pointer border ${
                                    isTrial
                                      ? 'bg-emerald-500 text-white border-emerald-600 shadow-2xs'
                                      : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'
                                  }`}
                                >
                                  {isTrial ? <IconCheck size={14} stroke={3} /> : <IconMinus size={13} stroke={2.5} />}
                                </button>
                              </Table.Td>

                              <Table.Td className="text-center py-2">
                                <button
                                  type="button"
                                  onClick={() => basicPlan && handleToggleFeature(basicPlan, feat.code)}
                                  className={`w-7 h-7 rounded-lg transition-colors flex items-center justify-center mx-auto cursor-pointer border ${
                                    isBasic
                                      ? 'bg-emerald-500 text-white border-emerald-600 shadow-2xs'
                                      : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'
                                  }`}
                                >
                                  {isBasic ? <IconCheck size={14} stroke={3} /> : <IconMinus size={13} stroke={2.5} />}
                                </button>
                              </Table.Td>

                              <Table.Td className="text-center py-2 bg-orange-50/40">
                                <button
                                  type="button"
                                  onClick={() => proPlan && handleToggleFeature(proPlan, feat.code)}
                                  className={`w-7 h-7 rounded-lg transition-colors flex items-center justify-center mx-auto cursor-pointer border ${
                                    isPro
                                      ? 'bg-[#F45A0A] text-white border-orange-600 shadow-2xs'
                                      : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'
                                  }`}
                                >
                                  {isPro ? <IconCheck size={14} stroke={3} /> : <IconMinus size={13} stroke={2.5} />}
                                </button>
                              </Table.Td>

                              <Table.Td className="text-center py-2">
                                <button
                                  type="button"
                                  onClick={() => enterprisePlan && handleToggleFeature(enterprisePlan, feat.code)}
                                  className={`w-7 h-7 rounded-lg transition-colors flex items-center justify-center mx-auto cursor-pointer border ${
                                    isEnterprise
                                      ? 'bg-emerald-500 text-white border-emerald-600 shadow-2xs'
                                      : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'
                                  }`}
                                >
                                  {isEnterprise ? <IconCheck size={14} stroke={3} /> : <IconMinus size={13} stroke={2.5} />}
                                </button>
                              </Table.Td>
                            </Table.Tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TAB 4: PLANS & PRICING CARDS (Ultra-Modern Redesign)
         ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'plans' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {adminPlans.map((p) => {
            const activeVer = p.versions.find((v) => v.isActive) || p.versions[0];
            const price = activeVer ? activeVer.priceMonthlyCents / 100 : 0;
            const isEnterprise = p.code === 'ENTERPRISE';
            const isPro = p.code === 'PRO';

            return (
              <div
                key={p.id}
                className={`bg-white rounded-2xl p-6 border shadow-2xs hover:shadow-md transition-all flex flex-col justify-between relative ${
                  isPro
                    ? 'border-2 border-[#F45A0A] bg-orange-50/10'
                    : 'border-slate-200/90 hover:border-[#F45A0A]/40'
                }`}
              >
                {/* Header Badge */}
                {activeVer?.isRecommended && (
                  <div className="absolute -top-3 right-6 bg-[#F45A0A] text-white text-[10.5px] font-black px-3 py-0.5 rounded-full shadow-2xs">
                    الأكثر طلباً واختياراً
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
                        {getPlanIcon(p.code)}
                      </div>
                      <div>
                        <h4 className="text-[17px] font-black text-slate-900 leading-tight">{p.nameAr}</h4>
                        <span className="text-[11px] text-slate-400 font-mono font-medium">{p.code}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 min-h-[38px] leading-relaxed font-medium">
                    {p.description || 'باقة متكاملة للمؤسسات والشركات السياحية'}
                  </p>

                  <div className="py-3 px-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-baseline justify-between">
                    <span className="font-mono text-[28px] font-black text-slate-900 tabular-nums">
                      ${price}
                    </span>
                    <span className="text-xs text-slate-600 font-bold">
                      {isEnterprise ? ' / 3 أشهر' : isPro ? ' / 3 أشهر' : ' / شهرياً'}
                    </span>
                  </div>

                  {/* Limits Section */}
                  <div className="space-y-2 text-xs pt-1">
                    <span className="text-[11px] font-bold text-slate-400 block">الحدود التشغيلية للباقة:</span>
                    {activeVer?.limits.map((l) => (
                      <div key={l.limitCode} className="flex justify-between items-center py-1 border-b border-slate-100 text-slate-700">
                        <span className="flex items-center gap-1.5">
                          {l.limitCode === 'MAX_BRANCHES' && <IconBuildingStore size={14} className="text-slate-400" />}
                          {l.limitCode === 'MAX_USERS' && <IconUsers size={14} className="text-slate-400" />}
                          {l.limitCode === 'EMAIL_DAILY' && <IconMail size={14} className="text-slate-400" />}
                          <span>{l.nameAr}:</span>
                        </span>
                        <strong className="font-mono font-bold text-slate-900 tabular-nums">
                          {l.limitValue === 999999 ? 'غير محدود' : l.limitValue} {l.unit}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  size="xs"
                  color="orange"
                  variant={isPro ? 'filled' : 'light'}
                  leftSection={<IconEdit size={14} />}
                  onClick={() => handleOpenEditPlan(p)}
                  className={`w-full mt-5 font-bold rounded-xl h-10 shadow-xs cursor-pointer ${
                    isPro ? 'bg-[#F45A0A] hover:bg-orange-600 text-white' : ''
                  }`}
                >
                  تعديل السعر والحدود
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* ───
          TAB 5: SUBSCRIPTION HISTORY & PAYMENTS LOG
         ─── */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* 1. Revenue & Payment KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Total Collected Revenue */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 block mb-1">إجمالي الإيرادات المحصلة</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-emerald-600 font-mono tracking-tight tabular-nums">
                    ${historyStats.totalRevenueUSD.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs font-bold text-slate-400 font-mono">USD</span>
                </div>
                <span className="text-[10.5px] text-slate-500 font-mono mt-0.5 block">
                  {historyStats.totalRevenueIQD.toLocaleString('en-US', { maximumFractionDigits: 0 })} IQD محصل فعلياً
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                <IconCash size={22} />
              </div>
            </div>

            {/* Completed Payments */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 block mb-1">الدفعات الناجحة والمكتملة</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-slate-900 font-mono tabular-nums">
                    {historyStats.completedCount}
                  </span>
                  <span className="text-xs text-slate-400">دفعة مسددة</span>
                </div>
                <span className="text-[10.5px] text-emerald-600 font-bold mt-0.5 block">
                  جاهزة ومحسوبة في الإيراد
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                <IconCircleCheck size={22} />
              </div>
            </div>

            {/* Pending Approvals */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 block mb-1">دفعات قيد المراجعة</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-amber-600 font-mono tabular-nums">
                    {historyStats.pendingCount}
                  </span>
                  <span className="text-xs text-slate-400">طلب معلق</span>
                </div>
                <span className="text-[10.5px] text-amber-600 font-bold mt-0.5 block">
                  تنتظر التحقق والاعتماد
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
                <IconHistory size={22} />
              </div>
            </div>

            {/* Cancelled / Refunded */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 block mb-1">دفعات ملغاة / مستردة</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-rose-600 font-mono tabular-nums">
                    {historyStats.cancelledCount}
                  </span>
                  <span className="text-xs text-slate-400">دفعة</span>
                </div>
                <span className="text-[10.5px] text-rose-600 font-bold mt-0.5 block">
                  تم إلغاؤها واستبعادها
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
                <IconCircleX size={22} />
              </div>
            </div>
          </div>

          {/* 2. Main History / Payments Log Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
            {/* Header, Search, Filters & Action Button */}
            <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-3 flex-wrap flex-1">
                {/* Search */}
                <div className="w-80">
                  <TextInput
                    size="xs"
                    placeholder="بحث باسم المؤسسة، رقم المرجع، الباقة، أو الملاحظات..."
                    leftSection={<IconSearch size={14} className="text-slate-400" />}
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.currentTarget.value)}
                    styles={{
                      input: { height: '38px', borderRadius: '10px' },
                    }}
                  />
                </div>

                {/* Status Filter */}
                <Select
                  size="xs"
                  value={historyStatusFilter}
                  onChange={(val) => setHistoryStatusFilter(val || 'ALL')}
                  data={[
                    { value: 'ALL', label: 'جميع الحالات' },
                    { value: 'COMPLETED', label: 'مكتملة ومسددة (COMPLETED)' },
                    { value: 'PENDING', label: 'قيد المراجعة (PENDING)' },
                    { value: 'REFUNDED', label: 'ملغاة / مستردة (REFUNDED)' },
                    { value: 'FAILED', label: 'فاشلة (FAILED)' },
                  ]}
                  className="w-56"
                  styles={{
                    input: { height: '38px', borderRadius: '10px' },
                  }}
                />
              </div>

              {/* Add Manual Payment Button */}
              <Button
                size="xs"
                color="orange"
                leftSection={<IconPlus size={14} />}
                onClick={() => {
                  setCreatePaymentForm({
                    tenantId: subscribedTenants[0]?.id || '',
                    amount: 99,
                    currency: 'USD',
                    monthsToAdd: 1,
                    paymentMethod: 'MASTERCARD',
                    transactionRef: `MANUAL-${Date.now().toString().slice(-6)}`,
                    notes: 'تسجيل دفعة يدوية',
                    paidAt: new Date().toISOString().split('T')[0],
                  });
                  setCreatePaymentModalOpened(true);
                }}
                className="bg-[#F45A0A] font-bold h-[38px] rounded-xl hover:bg-[#e04f08] shadow-sm"
              >
                تسجيل دفعة يدوية جديدة
              </Button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-slate-200/90 rounded-2xl">
              <table className="w-full text-right border-collapse text-xs">
                <thead className="bg-[#F8FAFC] font-bold text-slate-700 border-b border-slate-200/90 text-[12px]">
                  <tr>
                    <th className="p-3.5 text-center w-12">#</th>
                    <th className="p-3.5">المؤسسة / الشركة</th>
                    <th className="p-3.5">الباقة</th>
                    <th className="p-3.5 text-center">المبلغ المسدد</th>
                    <th className="p-3.5">طريقة الدفع والمرجع</th>
                    <th className="p-3.5 text-center">تاريخ الدفعة</th>
                    <th className="p-3.5 text-center">فترة الاشتراك</th>
                    <th className="p-3.5 text-center">الحالة</th>
                    <th className="p-3.5 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingHistory ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-slate-400">
                        <Loader size="sm" className="mx-auto" />
                        <span className="block text-xs mt-2 font-bold">جاري تحميل سجل الاشتراكات والدفعات...</span>
                      </td>
                    </tr>
                  ) : filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-slate-400 font-bold">
                        لا توجد دفعات أو سجلات اشتراكات مطابقة
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((item: any, idx: number) => {
                      const isCompleted = item.status === 'COMPLETED';
                      const isPending = item.status === 'PENDING';
                      const isCancelled = item.status === 'REFUNDED' || item.status === 'CANCELLED' || item.status === 'FAILED';
                      const amount = Number(item.amount) || (Number(item.amountCents) / 100) || 0;

                      return (
                        <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                          {/* # */}
                          <td className="p-3.5 text-center font-mono text-slate-400 font-bold text-[11px]">
                            {idx + 1}
                          </td>

                          {/* Tenant / Company */}
                          <td className="p-3.5 font-bold text-slate-900">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-orange-50 text-[#F45A0A] font-black flex items-center justify-center shrink-0 border border-orange-100 text-xs">
                                {item.tenant?.name?.charAt(0) || 'ش'}
                              </div>
                              <div>
                                <span className="text-xs font-bold text-slate-900 block">{item.tenant?.name || 'مؤسسة غير معروفة'}</span>
                                <span className="text-[10px] text-slate-400 font-mono block">{item.tenant?.slug || item.tenant?.email}</span>
                              </div>
                            </div>
                          </td>

                          {/* Plan */}
                          <td className="p-3.5">
                            <Badge size="xs" variant="light" color="orange" className="font-bold">
                              {item.planName || item.plan?.nameAr || 'باقة المنصة'}
                            </Badge>
                          </td>

                          {/* Amount */}
                          <td className="p-3.5 text-center font-mono font-black tabular-nums text-xs">
                            <span className={isCancelled ? 'line-through text-slate-400' : isCompleted ? 'text-emerald-700 text-[13px]' : 'text-slate-900 text-[13px]'}>
                              {String(item.currency || 'USD').toUpperCase() === 'IQD'
                                ? `${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })} د.ع`
                                : `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            </span>
                            <span className="text-[10px] text-slate-400 font-normal ms-1">{item.currency || 'USD'}</span>
                          </td>

                          {/* Payment Method & Ref */}
                          <td className="p-3.5 font-mono text-xs">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Badge size="xs" variant="outline" color={item.paymentMethod?.includes('QI') ? 'teal' : item.paymentMethod?.includes('ZAIN') ? 'violet' : 'blue'}>
                                {item.paymentMethod || 'Mastercard'}
                              </Badge>
                              {item.transactionRef && (
                                <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                  {item.transactionRef}
                                </span>
                              )}
                              {item.receiptUrl && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedReceiptImage(item.receiptUrl);
                                    setPreviewImageModalOpened(true);
                                  }}
                                  className="text-[10.5px] text-[#F45A0A] hover:underline font-bold"
                                >
                                  عرض الإيصال
                                </button>
                              )}
                            </div>
                            {item.notes && typeof item.notes === 'string' && (
                              <span className="text-[10.5px] text-slate-400 block font-sans truncate max-w-[200px] mt-0.5" title={item.notes}>
                                {item.notes.startsWith('{') ? 'بيانات تفصيلية' : item.notes}
                              </span>
                            )}
                          </td>

                          {/* Date */}
                          <td className="p-3.5 text-center font-mono text-slate-600 text-xs">
                            {item.paidAt ? new Date(item.paidAt).toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—'}
                          </td>

                          {/* Period */}
                          <td className="p-3.5 text-center font-mono text-slate-500 text-[11px]">
                            {item.periodEnd ? (
                              <span className="bg-slate-50 px-2 py-1 rounded border border-slate-200">
                                حتى {new Date(item.periodEnd).toLocaleDateString('en-GB')}
                              </span>
                            ) : '—'}
                          </td>

                          {/* Status */}
                          <td className="p-3.5 text-center">
                            <Badge
                              size="xs"
                              color={isCompleted ? 'emerald' : isPending ? 'orange' : 'red'}
                              className="font-bold"
                            >
                              {isCompleted ? 'مكتملة ومسددة' : isPending ? 'قيد المراجعة' : item.status === 'REFUNDED' ? 'ملغاة / مستردة' : item.status || 'ملغاة'}
                            </Badge>
                          </td>

                          {/* Actions */}
                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {/* Edit Button */}
                              <Tooltip label="تعديل الدفعة والمبلغ" position="top">
                                <ActionIcon
                                  size="sm"
                                  variant="light"
                                  color="blue"
                                  onClick={() => {
                                    setSelectedPaymentToEdit(item);
                                    setEditPaymentForm({
                                      amount: amount,
                                      currency: item.currency || 'USD',
                                      paymentMethod: item.paymentMethod || 'MASTERCARD',
                                      transactionRef: item.transactionRef || '',
                                      notes: typeof item.notes === 'string' ? item.notes : '',
                                      status: item.status || 'COMPLETED',
                                      paidAt: item.paidAt ? new Date(item.paidAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                                    });
                                    setEditPaymentModalOpened(true);
                                  }}
                                  className="cursor-pointer"
                                >
                                  <IconEdit size={14} />
                                </ActionIcon>
                              </Tooltip>

                              {/* Cancel / Refund Button */}
                              {!isCancelled && (
                                <Tooltip label="إلغاء الدفعة واستردادها" position="top">
                                  <ActionIcon
                                    size="sm"
                                    variant="light"
                                    color="orange"
                                    onClick={() => {
                                      setSelectedPaymentToCancel(item);
                                      setCancelPaymentReason('');
                                      setCancelPaymentModalOpened(true);
                                    }}
                                    className="cursor-pointer"
                                  >
                                    <IconRefresh size={14} />
                                  </ActionIcon>
                                </Tooltip>
                              )}

                              {/* Delete Button */}
                              <Tooltip label="حذف السجل" position="top">
                                <ActionIcon
                                  size="sm"
                                  variant="light"
                                  color="red"
                                  onClick={() => {
                                    if (window.confirm(`هل أنت متأكد من حذف سجل الدفعة للمؤسسة ${item.tenant?.name || ''}؟`)) {
                                      deletePaymentMutation.mutate(item.paymentId || item.id);
                                    }
                                  }}
                                  className="cursor-pointer"
                                >
                                  <IconTrash size={14} />
                                </ActionIcon>
                              </Tooltip>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TAB 6: PAYMENT METHODS & MASTERCARD
         ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'payments' && (
        <div className="space-y-4">
          <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                  <IconCreditCard className="text-[#F45A0A]" size={20} />
                  <span>تخصيص قنوات الدفع والماستركارد لاستلام الاشتراكات</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  تظهر هذه البيانات مباشرة للشركات عند اختيار الترقية أو تجديد الاشتراك.
                </p>
              </div>

              <Button
                size="xs"
                color="orange"
                leftSection={<IconCheck size={14} />}
                loading={updatePaymentMethodsMutation.isPending}
                onClick={handleSavePaymentMethods}
                className="bg-[#F45A0A] hover:bg-orange-600 font-bold rounded-xl shadow-xs"
              >
                حفظ بيانات طرق الدفع
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Form Settings */}
              <div className="lg:col-span-7 space-y-4">
                <Card className="p-4 rounded-xl border border-orange-200 bg-orange-50/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs text-slate-900 flex items-center gap-1.5">
                      <IconCreditCard size={16} className="text-[#F45A0A]" />
                      بطاقة ماستركارد / كي كارد الرئيسية
                    </span>
                    <Switch checked={masterEnabled} onChange={(e) => setMasterEnabled(e.currentTarget.checked)} color="orange" />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <TextInput label="اسم حامل البطاقة" value={masterCardHolder} onChange={(e) => setMasterCardHolder(e.currentTarget.value)} />
                    <TextInput label="رقم البطاقة / الحساب" value={masterCardNumber} onChange={(e) => setMasterCardNumber(e.currentTarget.value)} />
                    <TextInput label="اسم المصرف" value={masterBankName} onChange={(e) => setMasterBankName(e.currentTarget.value)} />
                    <TextInput label="تاريخ الانتهاء" value={masterExpiryDate} onChange={(e) => setMasterExpiryDate(e.currentTarget.value)} />
                  </div>
                  <Textarea label="تعليمات الدفع المرافقة" value={masterInstructions} onChange={(e) => setMasterInstructions(e.currentTarget.value)} rows={2} />
                </Card>

                {/* ZainCash & FIB */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Card className="p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">زين كاش (ZainCash)</span>
                      <Switch checked={zainEnabled} onChange={(e) => setZainEnabled(e.currentTarget.checked)} color="orange" />
                    </div>
                    <TextInput size="xs" label="رقم المحفظة" value={zainPhoneNumber} onChange={(e) => setZainPhoneNumber(e.currentTarget.value)} />
                    <TextInput size="xs" label="اسم المحفظة" value={zainWalletName} onChange={(e) => setZainWalletName(e.currentTarget.value)} />
                  </Card>

                  <Card className="p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">المصرف العراقي الأول (FIB)</span>
                      <Switch checked={fibEnabled} onChange={(e) => setFibEnabled(e.currentTarget.checked)} color="orange" />
                    </div>
                    <TextInput size="xs" label="رقم الآيبان (IBAN)" value={fibIban} onChange={(e) => setFibIban(e.currentTarget.value)} />
                    <TextInput size="xs" label="اسم الحساب" value={fibAccountName} onChange={(e) => setFibAccountName(e.currentTarget.value)} />
                  </Card>
                </div>
              </div>

              {/* Live Card Preview */}
              <div className="lg:col-span-5 flex flex-col items-center justify-center p-4 bg-slate-50/70 rounded-2xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-500 mb-3 block">معاينة بطاقة الدفع كما يراها العميل:</span>
                <MastercardPreviewCard
                  cardHolder={masterCardHolder}
                  cardNumber={masterCardNumber}
                  bankName={masterBankName}
                  expiryDate={masterExpiryDate}
                  cardType={masterCardType}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TAB 7: LIVE PRICING PAGE PREVIEW
         ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'preview' && (
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
          <PricingPage />
        </div>
      )}

      {/* ─── MODAL: EDIT PAYMENT & AMOUNT ─── */}
      <Modal
        opened={editPaymentModalOpened}
        onClose={() => setEditPaymentModalOpened(false)}
        title={<span className="font-black text-sm text-slate-900">تعديل بيانات الدفعة والمبلغ المستلم</span>}
        centered
        radius="lg"
      >
        <div className="space-y-3.5 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[11px] text-slate-400 font-bold block">المؤسسة:</span>
            <span className="text-xs font-black text-slate-900">{selectedPaymentToEdit?.tenant?.name || 'مؤسسة غير معروفة'}</span>
          </div>

          <NumberInput
            label="المبلغ المستلم ($ USD)"
            value={editPaymentForm.amount}
            onChange={(val) => setEditPaymentForm((prev) => ({ ...prev, amount: Number(val) || 0 }))}
            min={0}
            step={1}
            size="xs"
            styles={{ input: { fontFamily: 'monospace', fontWeight: 'bold' } }}
          />

          <Select
            label="طريقة الدفع"
            value={editPaymentForm.paymentMethod}
            onChange={(val) => setEditPaymentForm((prev) => ({ ...prev, paymentMethod: val || 'MASTERCARD' }))}
            data={[
              { value: 'MASTERCARD', label: 'Mastercard / Visa Card' },
              { value: 'QI_CARD', label: 'Qi Card (ماستر كارد الرافدين)' },
              { value: 'ZAIN_CASH', label: 'ZainCash (زين كاش)' },
              { value: 'BANK_TRANSFER', label: 'تحويل بنكي / صرافة' },
              { value: 'CASH', label: 'نقدي (Cash)' },
              { value: 'MANUAL_ADMIN', label: 'تسجيل يدوي بواسطة الإدارة' },
            ]}
            size="xs"
          />

          <TextInput
            label="رقم المرجع / المعاملة (Transaction Ref)"
            value={editPaymentForm.transactionRef}
            onChange={(e) => setEditPaymentForm((prev) => ({ ...prev, transactionRef: e.target.value }))}
            placeholder="مثال: TXN-998822 أو رقم الحوالة"
            size="xs"
            styles={{ input: { fontFamily: 'monospace' } }}
          />

          <TextInput
            label="تاريخ الدفعة"
            type="date"
            value={editPaymentForm.paidAt}
            onChange={(e) => setEditPaymentForm((prev) => ({ ...prev, paidAt: e.target.value }))}
            size="xs"
          />

          <Select
            label="حالة الدفعة"
            value={editPaymentForm.status}
            onChange={(val) => setEditPaymentForm((prev) => ({ ...prev, status: val || 'COMPLETED' }))}
            data={[
              { value: 'COMPLETED', label: 'مكتملة ومسددة (COMPLETED)' },
              { value: 'PENDING', label: 'قيد المراجعة (PENDING)' },
              { value: 'REFUNDED', label: 'ملغاة / مستردة (REFUNDED)' },
              { value: 'FAILED', label: 'فاشلة (FAILED)' },
            ]}
            size="xs"
          />

          <Textarea
            label="ملاحظات الدفعة"
            value={editPaymentForm.notes}
            onChange={(e) => setEditPaymentForm((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="أدخل أي تفاصيل أو ملاحظات إضافية حول الدفعة..."
            rows={2}
            size="xs"
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button size="xs" variant="default" onClick={() => setEditPaymentModalOpened(false)}>إلغاء</Button>
            <Button
              size="xs"
              color="orange"
              loading={updatePaymentMutation.isPending}
              onClick={() => {
                if (selectedPaymentToEdit) {
                  updatePaymentMutation.mutate({
                    id: selectedPaymentToEdit.paymentId || selectedPaymentToEdit.id,
                    data: {
                      amountCents: Math.round(editPaymentForm.amount * 100),
                      currency: editPaymentForm.currency,
                      paymentMethod: editPaymentForm.paymentMethod,
                      transactionRef: editPaymentForm.transactionRef,
                      notes: editPaymentForm.notes,
                      status: editPaymentForm.status,
                      paidAt: editPaymentForm.paidAt,
                    },
                  });
                }
              }}
              className="bg-[#F45A0A] font-bold"
            >
              حفظ التعديلات
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── MODAL: CANCEL / REFUND PAYMENT ─── */}
      <Modal
        opened={cancelPaymentModalOpened}
        onClose={() => setCancelPaymentModalOpened(false)}
        title={<span className="font-black text-sm text-rose-600">إلغاء دفعة الاشتراك واستردادها</span>}
        centered
        radius="lg"
      >
        <div className="space-y-3.5 text-xs">
          <p className="text-slate-600 font-medium">
            هل أنت متأكد من رغبتك في إلغاء الدفعة بمبلغ{' '}
            <strong className="text-rose-600 font-mono text-sm">${selectedPaymentToCancel?.amount || 0}</strong> الخاصة بمؤسسة{' '}
            <strong className="text-slate-900">{selectedPaymentToCancel?.tenant?.name}</strong>؟
            سيتم استبعاد هذا المبلغ من إجمالي الإيرادات المحصلة.
          </p>

          <Textarea
            label="سبب الإلغاء (اختياري)"
            value={cancelPaymentReason}
            onChange={(e) => setCancelPaymentReason(e.target.value)}
            placeholder="مثال: تم استرداد المبلغ للعميل، أو تم التحويل عن طريق الخطأ..."
            rows={3}
            size="xs"
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button size="xs" variant="default" onClick={() => setCancelPaymentModalOpened(false)}>تراجع</Button>
            <Button
              size="xs"
              color="red"
              loading={cancelPaymentMutation.isPending}
              onClick={() => {
                if (selectedPaymentToCancel) {
                  cancelPaymentMutation.mutate({
                    id: selectedPaymentToCancel.paymentId || selectedPaymentToCancel.id,
                    reason: cancelPaymentReason,
                  });
                }
              }}
              className="bg-rose-600 font-bold"
            >
              تأكيد إلغاء الدفعة
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── MODAL: CREATE MANUAL PAYMENT ─── */}
      <Modal
        opened={createPaymentModalOpened}
        onClose={() => setCreatePaymentModalOpened(false)}
        title={<span className="font-black text-sm text-slate-900">تسجيل واستلام دفعة اشتراك جديدة</span>}
        centered
        radius="lg"
      >
        <div className="space-y-3.5 text-xs">
          <Select
            label="المؤسسة / الشركة"
            value={createPaymentForm.tenantId}
            onChange={(val) => setCreatePaymentForm((prev) => ({ ...prev, tenantId: val || '' }))}
            data={subscribedTenants.map((t: any) => ({
              value: t.id,
              label: `${t.name} (${t.slug})`,
            }))}
            searchable
            placeholder="اختر المؤسسة..."
            size="xs"
            required
          />

          <div className="grid grid-cols-2 gap-2.5">
            <NumberInput
              label="المبلغ المسدد ($ USD)"
              value={createPaymentForm.amount}
              onChange={(val) => setCreatePaymentForm((prev) => ({ ...prev, amount: Number(val) || 0 }))}
              min={0}
              step={1}
              size="xs"
              styles={{ input: { fontFamily: 'monospace', fontWeight: 'bold' } }}
              required
            />

            <NumberInput
              label="عدد الأشهر المضافة للتجديد"
              value={createPaymentForm.monthsToAdd}
              onChange={(val) => setCreatePaymentForm((prev) => ({ ...prev, monthsToAdd: Number(val) || 1 }))}
              min={1}
              max={36}
              size="xs"
              styles={{ input: { fontFamily: 'monospace' } }}
            />
          </div>

          <Select
            label="طريقة الدفع"
            value={createPaymentForm.paymentMethod}
            onChange={(val) => setCreatePaymentForm((prev) => ({ ...prev, paymentMethod: val || 'MASTERCARD' }))}
            data={[
              { value: 'MASTERCARD', label: 'Mastercard / Visa Card' },
              { value: 'QI_CARD', label: 'Qi Card (ماستر كارد الرافدين)' },
              { value: 'ZAIN_CASH', label: 'ZainCash (زين كاش)' },
              { value: 'BANK_TRANSFER', label: 'تحويل بنكي / صرافة' },
              { value: 'CASH', label: 'نقدي (Cash)' },
              { value: 'MANUAL_ADMIN', label: 'تسجيل يدوي بواسطة الإدارة' },
            ]}
            size="xs"
          />

          <TextInput
            label="رقم المرجع / الحوالة"
            value={createPaymentForm.transactionRef}
            onChange={(e) => setCreatePaymentForm((prev) => ({ ...prev, transactionRef: e.target.value }))}
            placeholder="مثال: TXN-123456"
            size="xs"
            styles={{ input: { fontFamily: 'monospace' } }}
          />

          <TextInput
            label="تاريخ الاستلام"
            type="date"
            value={createPaymentForm.paidAt}
            onChange={(e) => setCreatePaymentForm((prev) => ({ ...prev, paidAt: e.target.value }))}
            size="xs"
          />

          <Textarea
            label="ملاحظات"
            value={createPaymentForm.notes}
            onChange={(e) => setCreatePaymentForm((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="أدخل أي ملاحظات حول الدفعة..."
            rows={2}
            size="xs"
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button size="xs" variant="default" onClick={() => setCreatePaymentModalOpened(false)}>إلغاء</Button>
            <Button
              size="xs"
              color="orange"
              loading={createManualPaymentMutation.isPending}
              onClick={() => {
                if (!createPaymentForm.tenantId) {
                  showErrorNotification('تنبيه', 'يرجى اختيار المؤسسة');
                  return;
                }
                createManualPaymentMutation.mutate({
                  tenantId: createPaymentForm.tenantId,
                  amountCents: Math.round(createPaymentForm.amount * 100),
                  currency: createPaymentForm.currency,
                  monthsToAdd: createPaymentForm.monthsToAdd,
                  paymentMethod: createPaymentForm.paymentMethod,
                  transactionRef: createPaymentForm.transactionRef,
                  notes: createPaymentForm.notes,
                  paidAt: createPaymentForm.paidAt,
                });
              }}
              className="bg-[#F45A0A] font-bold"
            >
              تسجيل وحفظ الدفعة
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: CHANGE PLAN ── */}
      <Modal
        opened={changePlanModalOpened}
        onClose={() => setChangePlanModalOpened(false)}
        title={<span className="font-black text-sm text-slate-900">تغيير باقة المؤسسة: {selectedTenant?.name}</span>}
        centered
        radius="lg"
      >
        <div className="space-y-4 text-xs">
          <Select
            label="اختر الباقة الجديدة"
            value={newPlanCode}
            onChange={(val) => setNewPlanCode(val || 'PRO')}
            data={[
              { value: 'BASIC', label: 'الباقة الأساسية ($99/شهر)' },
              { value: 'PRO', label: 'الباقة الاحترافية ($199/شهر)' },
              { value: 'ENTERPRISE', label: 'الباقة الشاملة ($799/شهر)' },
            ]}
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button size="xs" variant="default" onClick={() => setChangePlanModalOpened(false)}>إلغاء</Button>
            <Button
              size="xs"
              color="orange"
              loading={changePlanMutation.isPending}
              onClick={() => selectedTenant && changePlanMutation.mutate({ tenantId: selectedTenant.id, planCode: newPlanCode })}
              className="bg-[#F45A0A] font-bold"
            >
              تأكيد تغيير الباقة
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: RENEW & PAYMENT ── */}
      <Modal
        opened={renewModalOpened}
        onClose={() => setRenewModalOpened(false)}
        title={<span className="font-black text-sm text-slate-900">تجديد وتسجيل دفعة: {selectedTenant?.name}</span>}
        centered
        radius="lg"
      >
        <div className="space-y-3.5 text-xs">
          <NumberInput
            label="المبلغ المستلم ($ USD)"
            value={paymentAmount}
            onChange={(val) => setPaymentAmount(Number(val) || 0)}
            min={0}
          />
          <NumberInput
            label="عدد الأشهر المضافة للتجديد"
            value={renewMonths}
            onChange={(val) => setRenewMonths(Number(val) || 1)}
            min={1}
            max={36}
          />
          <Textarea
            label="ملاحظات الدفعة / رقم المعاملة"
            value={paymentNotes}
            onChange={(e) => setPaymentNotes(e.currentTarget.value)}
            placeholder="مثال: تحويل ماستركارد رقم 12345"
            rows={2}
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button size="xs" variant="default" onClick={() => setRenewModalOpened(false)}>إلغاء</Button>
            <Button
              size="xs"
              color="orange"
              loading={renewMutation.isPending}
              onClick={() =>
                selectedTenant &&
                renewMutation.mutate({
                  tenantId: selectedTenant.id,
                  data: {
                    amountCents: paymentAmount * 100,
                    monthsToAdd: renewMonths,
                    notes: paymentNotes,
                  },
                })
              }
              className="bg-[#F45A0A] font-bold"
            >
              تسجيل الدفعة وتجديد الاشتراك
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: SUSPEND TENANT ── */}
      <Modal
        opened={suspendModalOpened}
        onClose={() => setSuspendModalOpened(false)}
        title={<span className="font-black text-sm text-red-600">إيقاف / تعليق حساب المؤسسة: {selectedTenant?.name}</span>}
        centered
        radius="lg"
      >
        <div className="space-y-3 text-xs">
          <p className="text-slate-500">
            سيؤدي تعليق المؤسسة إلى حظر تسجيل الدخول لكافة موظفيها ومدرائها حتى يتم إعادة التفعيل.
          </p>
          <Textarea
            label="سبب التعليق"
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.currentTarget.value)}
            placeholder="مثال: انتهاء صلاحية الاشتراك وتأخر الدفعة"
            rows={3}
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button size="xs" variant="default" onClick={() => setSuspendModalOpened(false)}>إلغاء</Button>
            <Button
              size="xs"
              color="red"
              loading={suspendMutation.isPending}
              onClick={() => selectedTenant && suspendMutation.mutate({ tenantId: selectedTenant.id, reason: suspendReason })}
              className="bg-red-600 font-bold"
            >
              تأكيد الإيقاف
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: DELETE TENANT ── */}
      <Modal
        opened={deleteModalOpened}
        onClose={() => { setDeleteModalOpened(false); setDeleteError(null); }}
        title={<span className="font-black text-sm text-red-600">حذف المؤسسة نهائياً</span>}
        centered
        radius="lg"
      >
        <div className="space-y-3 text-xs">
          <p className="text-slate-600 font-medium">
            هل أنت متأكد من رغبتك في حذف مؤسسة <strong className="text-slate-900">{tenantToDelete?.name}</strong>؟
            هذا الإجراء سيحذف كافة بيانات المؤسسة ومستخدميها.
          </p>

          {deleteError && (
            <Alert color="red" title="خطأ أثناء الحذف">
              {deleteError}
            </Alert>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button size="xs" variant="default" onClick={() => setDeleteModalOpened(false)}>إلغاء</Button>
            <Button
              size="xs"
              color="red"
              loading={deleteTenantMutation.isPending}
              onClick={() => tenantToDelete && deleteTenantMutation.mutate(tenantToDelete.id)}
              className="bg-red-600 font-bold"
            >
              حذف نهائي
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: ADD FEATURE ── */}
      <Modal
        opened={addFeatureModalOpened}
        onClose={() => setAddFeatureModalOpened(false)}
        title={<span className="font-black text-sm text-slate-900">إضافة ميزة جديدة لمصفوفة الباقات</span>}
        centered
        radius="lg"
      >
        <div className="space-y-3.5 text-xs">
          <TextInput
            label="اسم الميزة باللغة العربية"
            placeholder="مثال: تصدير القيود إلى Excel و PDF"
            value={newFeatureName}
            onChange={(e) => {
              setNewFeatureName(e.currentTarget.value);
              if (!newFeatureCode) {
                setNewFeatureCode(e.currentTarget.value.trim().toUpperCase().replace(/\s+/g, '_').slice(0, 25));
              }
            }}
          />
          <TextInput
            label="رمز الميزة البرمجي (Unique Code)"
            placeholder="مثال: EXPORT_JOURNALS_PDF"
            value={newFeatureCode}
            onChange={(e) => setNewFeatureCode(e.currentTarget.value.toUpperCase().replace(/\s+/g, '_'))}
          />
          <Select
            label="التصنيف / القسم"
            value={newFeatureCategory}
            onChange={(val) => setNewFeatureCategory(val || 'ACCOUNTING')}
            data={CATEGORY_ORDER.map((k) => ({ value: k, label: CATEGORY_TITLES[k] }))}
          />
          <Switch
            label="تفعيل الميزة تلقائياً في الباقات الجديدة"
            checked={newFeatureDefaultEnabled}
            onChange={(e) => setNewFeatureDefaultEnabled(e.currentTarget.checked)}
            color="orange"
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button size="xs" variant="default" onClick={() => setAddFeatureModalOpened(false)}>إلغاء</Button>
            <Button
              size="xs"
              color="orange"
              loading={createFeatureMutation.isPending}
              onClick={() => {
                if (!newFeatureName.trim() || !newFeatureCode.trim()) return;
                createFeatureMutation.mutate({
                  featureCode: newFeatureCode,
                  nameAr: newFeatureName,
                  category: newFeatureCategory,
                  defaultEnabled: newFeatureDefaultEnabled,
                });
              }}
              className="bg-[#F45A0A] font-bold"
            >
              حفظ الميزة في المصفوفة
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: EDIT FEATURE ── */}
      <Modal
        opened={editFeatureModalOpened}
        onClose={() => setEditFeatureModalOpened(false)}
        title={<span className="font-black text-sm text-slate-900">تعديل الميزة: {selectedFeatureToEdit?.code}</span>}
        centered
        radius="lg"
      >
        <div className="space-y-3.5 text-xs">
          <TextInput
            label="اسم الميزة بالعربية"
            value={editFeatureName}
            onChange={(e) => setEditFeatureName(e.currentTarget.value)}
          />
          <Select
            label="التصنيف"
            value={editFeatureCategory}
            onChange={(val) => setEditFeatureCategory(val || 'ACCOUNTING')}
            data={CATEGORY_ORDER.map((k) => ({ value: k, label: CATEGORY_TITLES[k] }))}
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button size="xs" variant="default" onClick={() => setEditFeatureModalOpened(false)}>إلغاء</Button>
            <Button
              size="xs"
              color="orange"
              loading={updateFeatureMutation.isPending}
              onClick={() => {
                if (!selectedFeatureToEdit) return;
                updateFeatureMutation.mutate({
                  code: selectedFeatureToEdit.code,
                  data: { nameAr: editFeatureName, category: editFeatureCategory },
                });
              }}
              className="bg-[#F45A0A] font-bold"
            >
              حفظ التعديلات
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: EDIT PLAN ── */}
      <Modal
        opened={editPlanModalOpened}
        onClose={() => setEditPlanModalOpened(false)}
        title={<span className="font-black text-sm text-slate-900">تعديل الباقة: {selectedPlan?.nameAr}</span>}
        centered
        radius="lg"
      >
        <div className="space-y-3.5 text-xs">
          <TextInput label="اسم الباقة بالعربية" value={editNameAr} onChange={(e) => setEditNameAr(e.currentTarget.value)} />
          <Textarea label="وصف الباقة" value={editDescription} onChange={(e) => setEditDescription(e.currentTarget.value)} rows={2} />
          <NumberInput
            label="السعر بالدولار ($)"
            value={editPriceMonthly}
            onChange={(val) => setEditPriceMonthly(Number(val) || 0)}
            min={0}
          />
          <Switch
            label="تعيين كباقة مميزة / الأكثر طلباً"
            checked={editIsRecommended}
            onChange={(e) => setEditIsRecommended(e.currentTarget.checked)}
            color="orange"
          />

          <div className="border-t border-slate-100 pt-2 space-y-2">
            <span className="font-bold text-slate-700 block">الحدود التشغيلية للباقة:</span>
            <div className="grid grid-cols-3 gap-2">
              <NumberInput label="الفروع" value={editMaxBranches} onChange={(v) => setEditMaxBranches(Number(v) || 1)} min={1} />
              <NumberInput label="المستخدمين" value={editMaxUsers} onChange={(v) => setEditMaxUsers(Number(v) || 1)} min={1} />
              <NumberInput label="البريد/يوم" value={editEmailDaily} onChange={(v) => setEditEmailDaily(Number(v) || 10)} min={1} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button size="xs" variant="default" onClick={() => setEditPlanModalOpened(false)}>إلغاء</Button>
            <Button
              size="xs"
              color="orange"
              loading={updatePlanMutation.isPending}
              onClick={handleSavePlan}
              className="bg-[#F45A0A] font-bold"
            >
              حفظ تغييرات الباقة
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: PREVIEW RECEIPT IMAGE ── */}
      <Modal
        opened={previewImageModalOpened}
        onClose={() => setPreviewImageModalOpened(false)}
        title={<span className="font-black text-sm text-slate-900">معاينة إشعار / إيصال التحويل البنكي</span>}
        centered
        size="lg"
        radius="lg"
      >
        <div className="text-center space-y-3">
          <img src={selectedReceiptImage} alt="Receipt Preview" className="max-h-[70vh] mx-auto rounded-xl shadow-md object-contain border border-slate-200" />
          <Button size="xs" variant="default" onClick={() => setPreviewImageModalOpened(false)}>
            إغلاق المعاينة
          </Button>
        </div>
      </Modal>

      {/* ── MODAL: REJECT RENEWAL ── */}
      <Modal
        opened={rejectModalOpened}
        onClose={() => setRejectModalOpened(false)}
        title={<span className="font-black text-sm text-red-600">رفض إشعار التحويل والتجديد</span>}
        centered
        radius="lg"
      >
        <div className="space-y-3 text-xs">
          <p className="text-slate-500">
            يرجى توضيح سبب رفض الإشعار ليتم إعلام مسؤول المؤسسة به لتصحيح الدفعة أو إعادة إرسال الإشعار الصحيح.
          </p>
          <Textarea
            label="سبب الرفض"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.currentTarget.value)}
            placeholder="مثال: رقم الإشعار غير مطابق أو لم يتم استلام المبلغ في الحساب المصرفي"
            rows={3}
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button size="xs" variant="default" onClick={() => setRejectModalOpened(false)}>إلغاء</Button>
            <Button
              size="xs"
              color="red"
              loading={rejectRenewalMutation.isPending}
              onClick={() => selectedPaymentToReject && rejectRenewalMutation.mutate({ paymentId: selectedPaymentToReject, reason: rejectReason })}
              className="bg-red-600 font-bold"
            >
              تأكيد الرفض
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: CUSTOMIZE TENANT OWNER PERMISSIONS ── */}
      <Modal
        opened={ownerPermissionsModalOpened}
        onClose={() => setOwnerPermissionsModalOpened(false)}
        title={
          <div className="flex items-center gap-3 text-slate-900 font-black text-sm">
            <div className="w-10 h-10 rounded-2xl bg-[#FFF3E8] text-[#F45A0A] border border-orange-200 flex items-center justify-center font-black shrink-0">
              <IconShieldCheck size={22} strokeWidth={2.2} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-950">
                تخصيص صلاحيات مالك الشركة: {selectedTenantForOwnerPerms?.name}
              </h3>
              <span className="text-xs text-slate-500 font-bold">
                المالك المسجل: {selectedTenantForOwnerPerms?.owner?.name || 'المدير العام'} ({selectedTenantForOwnerPerms?.owner?.email || selectedTenantForOwnerPerms?.email || '—'})
              </span>
            </div>
          </div>
        }
        centered
        size="850px"
        radius="20px"
        padding="xl"
      >
        <div className="space-y-4 text-xs font-sans">
          {/* Quick Presets Buttons */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <span className="font-black text-slate-900 text-xs block">تطبيق قوالب الصلاحيات الجاهزة:</span>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="xs"
                variant={ownerCustomPermissions.includes('*') ? 'filled' : 'light'}
                color="orange"
                leftSection={<IconShieldCheck size={14} />}
                onClick={() => handleApplyOwnerPreset('FULL')}
                className="font-bold rounded-xl"
              >
                المالك الشامل (*)
              </Button>
              <Button
                size="xs"
                variant="light"
                color="blue"
                leftSection={<IconCoins size={14} />}
                onClick={() => handleApplyOwnerPreset('FINANCIAL')}
                className="font-bold rounded-xl"
              >
                شريك مالي ورقابي
              </Button>
              <Button
                size="xs"
                variant="light"
                color="teal"
                leftSection={<IconRocket size={14} />}
                onClick={() => handleApplyOwnerPreset('OPERATIONS')}
                className="font-bold rounded-xl"
              >
                مدير تشغيلي وسياحي
              </Button>
              <Button
                size="xs"
                variant="subtle"
                color="gray"
                onClick={() => handleApplyOwnerPreset('EMPTY')}
                className="font-bold rounded-xl mr-auto"
              >
                إلغاء التحديد
              </Button>
            </div>
          </div>

          {/* Search and Category Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 flex-1">
              {['الكل', 'الرئيسية', 'العمليات والخدمات', 'الحسابات', 'التقارير', 'الإدارة والرقابة'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setOwnerPermCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black shrink-0 cursor-pointer transition-all ${
                    ownerPermCategory === cat
                      ? 'bg-[#F45A0A] text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="min-w-[200px]">
              <TextInput
                placeholder="بحث في الصلاحيات..."
                size="xs"
                value={ownerPermsSearch}
                onChange={(e) => setOwnerPermsSearch(e.target.value)}
                leftSection={<IconSearch size={14} className="text-slate-400" />}
              />
            </div>
          </div>

          {/* Granular Permissions Matrix Switches */}
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {PERMISSION_REGISTRY
              .filter((mod) => {
                const matchCat = ownerPermCategory === 'الكل' || mod.category === ownerPermCategory;
                const matchSearch =
                  !ownerPermsSearch.trim() ||
                  mod.title.includes(ownerPermsSearch) ||
                  mod.permissions.some((p) => p.label.includes(ownerPermsSearch) || p.code.includes(ownerPermsSearch));
                return matchCat && matchSearch;
              })
              .map((mod) => {
                return (
                  <div key={mod.id} className="p-3 bg-white border border-slate-200 rounded-2xl space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <span className="font-black text-slate-900 text-xs flex items-center gap-2">
                        <span>{mod.title}</span>
                        <span className="text-[10px] font-mono text-slate-400">({mod.route})</span>
                      </span>
                      <Badge size="xs" color="orange" variant="light" className="font-mono">
                        {mod.permissions.filter((p) => ownerCustomPermissions.includes('*') || ownerCustomPermissions.includes(p.code)).length}/{mod.permissions.length}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {mod.permissions.map((perm) => {
                        const isGranted = ownerCustomPermissions.includes('*') || ownerCustomPermissions.includes(perm.code);
                        return (
                          <div
                            key={perm.code}
                            onClick={() => handleToggleOwnerPermission(perm.code)}
                            className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                              isGranted
                                ? 'bg-[#FFF3E8]/50 border-orange-300'
                                : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/70'
                            }`}
                          >
                            <Switch
                              size="xs"
                              color="orange"
                              checked={isGranted}
                              onChange={() => handleToggleOwnerPermission(perm.code)}
                              className="mt-0.5 shrink-0"
                            />
                            <div className="flex-1 space-y-0.5 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold text-slate-900 text-xs truncate">{perm.label}</span>
                                <Badge size="xs" variant="light" color="gray" className="text-[9px] font-mono shrink-0">
                                  {perm.actionType}
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                                <span className="truncate">{perm.code}</span>
                                {perm.isSensitive && (
                                  <span className="text-rose-600 font-sans font-bold flex items-center gap-0.5 shrink-0">
                                    <IconLock size={10} /> حساسة
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 font-mono font-bold">
                {ownerCustomPermissions.includes('*')
                  ? 'ممنوح كافة صلاحيات النظام (*)'
                  : `${ownerCustomPermissions.length} صلاحية محددة`}
              </span>

              {selectedTenantForOwnerPerms && (
                <Button
                  size="xs"
                  variant="light"
                  color="orange"
                  leftSection={<IconEyeCheck size={14} />}
                  loading={impersonateMutation.isPending}
                  onClick={() => impersonateMutation.mutate(selectedTenantForOwnerPerms.id)}
                  className="font-bold rounded-xl h-8 text-[#F45A0A] bg-[#FFF3E8] hover:bg-orange-100 border border-orange-200 shadow-2xs"
                >
                  دخول بوضع المالك للفحص المباشر
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button size="xs" variant="default" onClick={() => setOwnerPermissionsModalOpened(false)}>
                إلغاء
              </Button>
              <Button
                size="xs"
                loading={updateOwnerPermissionsMutation.isPending}
                onClick={() =>
                  selectedTenantForOwnerPerms &&
                  updateOwnerPermissionsMutation.mutate({
                    tenantId: selectedTenantForOwnerPerms.id,
                    customPermissions: ownerCustomPermissions,
                  })
                }
                className="bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-bold rounded-xl h-9 px-4 shadow-xs"
              >
                حفظ صلاحيات المالك
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SaasAdminDashboardPage;
