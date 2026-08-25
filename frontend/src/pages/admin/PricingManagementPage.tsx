import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Tabs,
  Card,
  Button,
  Badge,
  Modal,
  TextInput,
  NumberInput,
  Textarea,
  Switch,
  Table,
  Group,
  Stack,
  Skeleton,
  SegmentedControl,
  ActionIcon,
  Tooltip,
  Alert,
  Select,
} from '@mantine/core';
import {
  IconEdit,
  IconCheck,
  IconMinus,
  IconAdjustments,
  IconTable,
  IconPalette,
  IconBuildingStore,
  IconRefresh,
  IconEye,
  IconChecklist,
  IconCreditCard,
  IconHistory,
  IconSend,
  IconSparkles,
  IconCopy,
  IconCash,
  IconArrowRight,
  IconUsers,
  IconAlertCircle,
  IconReceipt,
  IconPhoto,
  IconCircleCheck,
  IconCircleX,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { subscriptionsApi, AdminPlan, PublicPlan } from '../../api/subscriptions';
import { PricingPage } from '../PricingPage';
import { MastercardPreviewCard } from '../../components/pricing/MastercardPreviewCard';
import { useLanguageStore } from '../../store/useLanguageStore';

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

export const PricingManagementPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  const [activeTab, setActiveTab] = useState<string | null>('matrix');
  const [publishSuccess, setPublishSuccess] = useState(false);

  // Add Feature Modal State
  const [addFeatureModalOpened, setAddFeatureModalOpened] = useState(false);
  const [newFeatureName, setNewFeatureName] = useState('');
  const [newFeatureCode, setNewFeatureCode] = useState('');
  const [newFeatureCategory, setNewFeatureCategory] = useState<string>('ACCOUNTING');
  const [newFeatureDefaultEnabled, setNewFeatureDefaultEnabled] = useState(false);

  // Edit Feature Modal State
  const [editFeatureModalOpened, setEditFeatureModalOpened] = useState(false);
  const [selectedFeatureToEdit, setSelectedFeatureToEdit] = useState<{ code: string; nameAr: string; category: string } | null>(null);
  const [editFeatureName, setEditFeatureName] = useState('');
  const [editFeatureCategory, setEditFeatureCategory] = useState<string>('ACCOUNTING');

  // Modal State for Image Preview (Enlarge Receipt)
  const [previewImageModalOpened, setPreviewImageModalOpened] = useState(false);
  const [selectedReceiptImage, setSelectedReceiptImage] = useState<string>('');

  // Reject Renewal Modal State
  const [rejectModalOpened, setRejectModalOpened] = useState(false);
  const [selectedPaymentToReject, setSelectedPaymentToReject] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Edit Plan Modal state
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

  // Theme Accent State for Preview
  const [themeAccent, setThemeAccent] = useState<'orange' | 'emerald' | 'blue' | 'indigo' | 'slate'>('orange');

  // 1. Fetch Admin Plans
  const { data: adminPlans = [], isLoading } = useQuery({
    queryKey: ['admin-plans'],
    queryFn: subscriptionsApi.getAllPlansAdmin,
  });

  // 2. Fetch Subscription History
  const { data: subscriptionsHistory = [], isLoading: loadingHistory } = useQuery({
    queryKey: ['admin-subscriptions-history'],
    queryFn: subscriptionsApi.getAllSubscriptionsHistory,
  });

  // 3. Fetch Pending Renewal Requests
  const { data: pendingRenewals = [], isLoading: loadingPending } = useQuery({
    queryKey: ['pending-renewals'],
    queryFn: subscriptionsApi.getPendingRenewals,
  });

  // 4. Fetch Payment Methods
  const { data: paymentMethodsData = {} } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: subscriptionsApi.getPaymentMethods,
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

  // Local optimistic state for instant zero-lag checkboxes: { [planId]: { [featureCode]: boolean } }
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

  // Mutations
  const updatePlanMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      subscriptionsApi.updatePlan(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
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

  // Feature CRUD Mutations
  const createFeatureMutation = useMutation({
    mutationFn: (data: { featureCode: string; nameAr: string; category: string; defaultEnabled?: boolean }) =>
      subscriptionsApi.createFeature(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
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
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
      queryClient.invalidateQueries({ queryKey: ['public-plans'] });
      setEditFeatureModalOpened(false);
      setSelectedFeatureToEdit(null);
      setPublishSuccess(true);
      setTimeout(() => setPublishSuccess(false), 3000);
    },
  });

  const deleteFeatureMutation = useMutation({
    mutationFn: (code: string) => subscriptionsApi.deleteFeature(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
      queryClient.invalidateQueries({ queryKey: ['public-plans'] });
      setPublishSuccess(true);
      setTimeout(() => setPublishSuccess(false), 3000);
    },
  });

  const handleOpenEditFeature = (feat: { code: string; nameAr: string; category: string }) => {
    setSelectedFeatureToEdit(feat);
    setEditFeatureName(feat.nameAr);
    setEditFeatureCategory(feat.category || 'ACCOUNTING');
    setEditFeatureModalOpened(true);
  };

  const handleDeleteFeature = (featCode: string, featName: string) => {
    if (window.confirm(`هل أنت متأكد من حذف الميزة "${featName}" نهائياً من كافة الباقات وجدول المقارنة؟`)) {
      deleteFeatureMutation.mutate(featCode);
    }
  };

  const handleOpenEdit = (p: AdminPlan) => {
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

  // Instant feature toggle with Optimistic UI update
  const handleToggleFeature = async (plan: AdminPlan, featureCode: string) => {
    const planId = plan.id;
    const currentVal = localFeatureState[planId]?.[featureCode] ?? false;
    const nextVal = !currentVal;

    // 1. Instant 0ms local state update
    setLocalFeatureState((prev) => ({
      ...prev,
      [planId]: {
        ...(prev[planId] || {}),
        [featureCode]: nextVal,
      },
    }));

    // 2. Fire fast background update to server
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

  // Handle Save Payment Methods
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

  // Publish / Apply All Changes Button
  const handlePublishAllChanges = () => {
    queryClient.invalidateQueries({ queryKey: ['public-plans'] });
    queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
    queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
    queryClient.invalidateQueries({ queryKey: ['pending-renewals'] });
    setPublishSuccess(true);
    setTimeout(() => setPublishSuccess(false), 3000);
  };

  // Build unique features list grouped by category
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

  // Order plans: FREE_TRIAL, BASIC, PRO, ENTERPRISE
  const trialPlan = adminPlans.find((p) => p.code === 'FREE_TRIAL');
  const basicPlan = adminPlans.find((p) => p.code === 'BASIC');
  const proPlan = adminPlans.find((p) => p.code === 'PRO');
  const enterprisePlan = adminPlans.find((p) => p.code === 'ENTERPRISE');

  // Filtered History
  const filteredHistory = subscriptionsHistory.filter((sub: any) => {
    const matchesSearch =
      !historySearch ||
      sub.tenant?.name?.toLowerCase().includes(historySearch.toLowerCase()) ||
      sub.tenant?.slug?.toLowerCase().includes(historySearch.toLowerCase()) ||
      sub.planVersion?.plan?.nameAr?.toLowerCase().includes(historySearch.toLowerCase());

    const matchesStatus = historyStatusFilter === 'ALL' || sub.status === historyStatusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 md:p-8 max-w-[1700px] mx-auto space-y-6 pb-16 font-sans" dir={direction}>
      {/* ── Header with Apply / Publish Button ── */}
      <div className="flex items-center justify-between flex-wrap gap-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <IconAdjustments className="text-orange-600" size={26} />
            <span>{isAr ? 'إدارة وتخصيص باقات التسعير والتحقق من التجديدات' : 'Pricing Plans & Renewal Verification Management'}</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {isAr
              ? 'التحقق من إشعارات وإيصالات التحويل، تفعيل الباقات، تخصيص الأسعار، وإدارة طرق الدفع الفعالة.'
              : 'Verify transfer receipts, toggle plan features, customize monthly pricing, and configure active payment methods.'}
          </p>
        </div>

        <Group>
          {publishSuccess && (
            <Badge color="teal" variant="filled" size="sm" className="font-bold">
              {isAr ? '✓ تم تطبيق الإجراء بنجاح' : '✓ Changes Applied Successfully'}
            </Badge>
          )}

          <Button
            size="xs"
            color="orange"
            leftSection={<IconSparkles size={14} />}
            onClick={handlePublishAllChanges}
            className="bg-orange-500 hover:bg-orange-600 font-black shadow-xs rounded-xl"
          >
            {isAr ? 'تطبيق التغييرات على صفحة الأسعار' : 'Apply Changes to Pricing Page'}
          </Button>

          <Button
            size="xs"
            variant="default"
            leftSection={<IconRefresh size={14} />}
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
              queryClient.invalidateQueries({ queryKey: ['public-plans'] });
              queryClient.invalidateQueries({ queryKey: ['admin-subscriptions-history'] });
              queryClient.invalidateQueries({ queryKey: ['pending-renewals'] });
              queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
            }}
            className="rounded-xl"
          >
            {isAr ? 'تحديث' : 'Refresh'}
          </Button>
        </Group>
      </div>

      {/* ── Main Modern Segmented Pill Tabs ── */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap gap-2">
        {/* TAB 1: PENDING RENEWAL VERIFICATION */}
        <button
          type="button"
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'pending'
              ? 'bg-[#FFF3E8] text-[#F45A0A] border border-[#FED7AA] shadow-2xs'
              : 'bg-slate-50/80 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60'
          }`}
        >
          <IconReceipt size={16} className={activeTab === 'pending' ? 'text-[#F45A0A]' : 'text-slate-500'} />
          <span>{isAr ? 'طلبات التجديد والتحقق من الدفع' : 'Renewal Requests & Receipts'}</span>
          {pendingRenewals.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white animate-pulse">
              {pendingRenewals.length}
            </span>
          )}
        </button>

        {/* TAB 2: COMPARISON MATRIX */}
        <button
          type="button"
          onClick={() => setActiveTab('matrix')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'matrix'
              ? 'bg-[#FFF3E8] text-[#F45A0A] border border-[#FED7AA] shadow-2xs'
              : 'bg-slate-50/80 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60'
          }`}
        >
          <IconTable size={16} className={activeTab === 'matrix' ? 'text-[#F45A0A]' : 'text-slate-500'} />
          <span>{isAr ? 'جدول ومصفوفة المقارنة' : 'Comparison Matrix & Features'}</span>
        </button>

        {/* TAB 3: PLANS & PRICING */}
        <button
          type="button"
          onClick={() => setActiveTab('plans')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'plans'
              ? 'bg-[#FFF3E8] text-[#F45A0A] border border-[#FED7AA] shadow-2xs'
              : 'bg-slate-50/80 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60'
          }`}
        >
          <IconBuildingStore size={16} className={activeTab === 'plans' ? 'text-[#F45A0A]' : 'text-slate-500'} />
          <span>{isAr ? 'بطاقات الباقات والأسعار (4)' : 'Plans & Pricing Cards (4)'}</span>
        </button>

        {/* TAB 4: HISTORY */}
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'bg-[#FFF3E8] text-[#F45A0A] border border-[#FED7AA] shadow-2xs'
              : 'bg-slate-50/80 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60'
          }`}
        >
          <IconHistory size={16} className={activeTab === 'history' ? 'text-[#F45A0A]' : 'text-slate-500'} />
          <span>
            {isAr
              ? `سجل الاشتراكات ودفعات الشركات (${subscriptionsHistory.length})`
              : `Subscriptions & Payment History (${subscriptionsHistory.length})`}
          </span>
        </button>

        {/* TAB 5: PAYMENT METHODS */}
        <button
          type="button"
          onClick={() => setActiveTab('payments')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'payments'
              ? 'bg-[#FFF3E8] text-[#F45A0A] border border-[#FED7AA] shadow-2xs'
              : 'bg-slate-50/80 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60'
          }`}
        >
          <IconCreditCard size={16} className={activeTab === 'payments' ? 'text-[#F45A0A]' : 'text-slate-500'} />
          <span>{isAr ? 'طرق الدفع وتصميم الماستر' : 'Payment Methods & Cards'}</span>
        </button>

        {/* TAB 6: LIVE PREVIEW */}
        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'preview'
              ? 'bg-[#FFF3E8] text-[#F45A0A] border border-[#FED7AA] shadow-2xs'
              : 'bg-slate-50/80 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60'
          }`}
        >
          <IconEye size={16} className={activeTab === 'preview' ? 'text-[#F45A0A]' : 'text-slate-500'} />
          <span>{isAr ? 'المعاينة الحية لصفحة الأسعار' : 'Live Pricing Preview'}</span>
        </button>
      </div>

      <Tabs value={activeTab} onChange={setActiveTab} color="orange" className="space-y-4">

        {/* ════════════════════════════════════════════════════════════════════════
            TAB 1: PENDING RENEWAL VERIFICATION & RECEIPTS APPROVAL
           ════════════════════════════════════════════════════════════════════════ */}
        <Tabs.Panel value="pending" className="space-y-4">
          <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                  <IconReceipt className="text-orange-600" size={18} />
                  <span>طلبات تجديد وترقية الباقات الواردة من الشركات</span>
                </h3>
                <p className="text-xs text-slate-500">
                  تحقق من إيصالات التحويل والمبالغ المستلمة في حسابك المصرفي؛ تفعيل الباقة يفتح النظام فورياً للشركة وموظفيها.
                </p>
              </div>
            </div>

            {loadingPending ? (
              <div className="space-y-3">
                <Skeleton height={60} radius="xl" />
                <Skeleton height={60} radius="xl" />
              </div>
            ) : pendingRenewals.length === 0 ? (
              <div className="p-12 text-center bg-slate-50 rounded-3xl border border-slate-200/80 space-y-2">
                <IconCircleCheck size={40} className="text-emerald-500 mx-auto" />
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
                      className="p-5 rounded-3xl bg-white border-2 border-orange-200 shadow-sm hover:border-orange-400 transition-all"
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
                          <div className="p-3 rounded-2xl bg-orange-50/60 border border-orange-200/80 inline-flex items-center gap-4 flex-wrap">
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
                            <IconPhoto size={14} className="text-orange-600" />
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
                                  className="w-16 h-16 rounded-xl border-2 border-orange-300 overflow-hidden cursor-pointer hover:scale-105 hover:border-orange-500 transition-all shadow-xs group relative"
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
        </Tabs.Panel>

        {/* ════════════════════════════════════════════════════════════════════════
            TAB 2: COMPARISON MATRIX & FEATURES MANAGER
           ════════════════════════════════════════════════════════════════════════ */}
        <Tabs.Panel value="matrix" className="space-y-4">
          <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                  <IconChecklist className="text-orange-600" size={18} />
                  <span>مصفوفة التحكم المباشر بجميع المزايا</span>
                </h3>
                <p className="text-xs text-slate-500">
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
                className="bg-orange-500 hover:bg-orange-600 font-bold rounded-xl shadow-xs"
              >
                + إضافة ميزة جديدة للمصفوفة
              </Button>
            </div>

            {/* Unified Matrix Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <Table className="text-xs text-right border-collapse">
                <Table.Thead className="bg-slate-50/90 text-slate-800 font-black border-b border-slate-200">
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
                              <Table.Td className="py-2 px-4 font-bold text-slate-800">
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
                                        onClick={() => handleOpenEditFeature(feat)}
                                      >
                                        <IconEdit size={14} />
                                      </ActionIcon>
                                    </Tooltip>
                                    <Tooltip label="حذف الميزة نهائياً من كافة الباقات" position="top" withArrow>
                                      <ActionIcon
                                        size="xs"
                                        variant="subtle"
                                        color="red"
                                        onClick={() => handleDeleteFeature(feat.code, feat.nameAr)}
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

                              <Table.Td className="text-center py-2 bg-orange-50/30">
                                <button
                                  type="button"
                                  onClick={() => proPlan && handleToggleFeature(proPlan, feat.code)}
                                  className={`w-7 h-7 rounded-lg transition-colors flex items-center justify-center mx-auto cursor-pointer border ${
                                    isPro
                                      ? 'bg-orange-500 text-white border-orange-600 shadow-2xs'
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
        </Tabs.Panel>

        {/* ════════════════════════════════════════════════════════════════════════
            TAB 3: PLANS & PRICING MANAGER
           ════════════════════════════════════════════════════════════════════════ */}
        <Tabs.Panel value="plans" className="space-y-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="p-4 rounded-3xl border border-slate-200">
                  <Skeleton height={20} width="60%" mb="xs" />
                  <Skeleton height={35} mb="sm" />
                  <Skeleton height={60} />
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {adminPlans.map((p) => {
                const activeVer = p.versions.find((v) => v.isActive) || p.versions[0];
                const isPro = p.code === 'PRO';
                const isTrial = p.code === 'FREE_TRIAL';
                const isEnterprise = p.code === 'ENTERPRISE';

                return (
                  <Card
                    key={p.id}
                    className={`p-5 rounded-3xl flex flex-col justify-between ${
                      isPro ? 'bg-white border-2 border-orange-500 shadow-md' : 'bg-white border border-slate-200 shadow-2xs'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Badge
                          size="xs"
                          color={isPro ? 'orange' : isTrial ? 'teal' : 'slate'}
                          variant="light"
                          className="font-bold"
                        >
                          {p.code}
                        </Badge>
                        {activeVer?.isRecommended && (
                          <Badge size="xs" color="orange" variant="filled" className="font-black text-[9.5px]">
                            الأكثر طلباً
                          </Badge>
                        )}
                      </div>

                      <h3 className="font-black text-base text-slate-900 leading-tight">{p.nameAr}</h3>
                      <p className="text-[11px] text-slate-500 leading-relaxed mt-1 min-h-[34px]">
                        {p.description}
                      </p>

                      <div className="py-2 px-3 rounded-2xl bg-slate-50 border border-slate-100 my-3 text-center">
                        <span className="font-mono font-black text-2xl text-slate-900">
                          ${(activeVer?.priceMonthlyCents || 0) / 100}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 block">
                          {isTrial ? 'مجاناً 14 يوماً' : isEnterprise || isPro ? 'كل 3 أشهر' : 'شهرياً'}
                        </span>
                      </div>

                      <div className="space-y-1 text-xs border-t border-slate-100 pt-2 mb-4">
                        <span className="text-[10px] font-black text-slate-400 uppercase">الحدود المطبقة:</span>
                        {activeVer?.limits.map((lim) => (
                          <div key={lim.id} className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500">{lim.nameAr}:</span>
                            <span className="font-mono font-bold text-slate-800">
                              {lim.limitValue === -1 ? 'غير محدود' : `${lim.limitValue} ${lim.unit || ''}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button
                      fullWidth
                      size="xs"
                      variant="light"
                      color="orange"
                      leftSection={<IconEdit size={14} />}
                      onClick={() => handleOpenEdit(p)}
                      className="font-bold rounded-xl"
                    >
                      تعديل السعر والحدود
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </Tabs.Panel>

        {/* ════════════════════════════════════════════════════════════════════════
            TAB 4: SUBSCRIPTIONS & PAYMENTS HISTORY LOG
           ════════════════════════════════════════════════════════════════════════ */}
        <Tabs.Panel value="history" className="space-y-4">
          <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                  <IconHistory className="text-orange-600" size={18} />
                  <span>سجل اشتراكات ودفعات الشركات</span>
                </h3>
                <p className="text-xs text-slate-500">
                  عرض تفصيلي لجميع الشركات المشتركة، الباقات الحالية، تواريخ الانتهاء، وسجل الدفعات والتحويلات المالية.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <TextInput
                  size="xs"
                  placeholder="بحث باسم الشركة أو الباقة..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.currentTarget.value)}
                  className="w-64"
                  radius="md"
                />
                <Select
                  size="xs"
                  value={historyStatusFilter}
                  onChange={(val) => setHistoryStatusFilter(val || 'ALL')}
                  data={[
                    { value: 'ALL', label: 'جميع الحالات' },
                    { value: 'ACTIVE', label: 'اشتراك نشط' },
                    { value: 'SUSPENDED', label: 'معلق' },
                    { value: 'CANCELLED', label: 'ملغي' },
                  ]}
                  radius="md"
                />
              </div>
            </div>

            {loadingHistory ? (
              <div className="space-y-2">
                <Skeleton height={40} />
                <Skeleton height={40} />
                <Skeleton height={40} />
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                لا توجد سجلات اشتراكات مطابقة للبحث.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <Table striped highlightOnHover className="text-xs text-right">
                  <Table.Thead className="bg-slate-50 text-slate-800 font-bold">
                    <Table.Tr>
                      <Table.Th>المؤسسة / الشركة</Table.Th>
                      <Table.Th>الباقة الحالية</Table.Th>
                      <Table.Th>الحالة</Table.Th>
                      <Table.Th>دورة الفاتورة</Table.Th>
                      <Table.Th>تاريخ البدء</Table.Th>
                      <Table.Th>تاريخ الانتهاء</Table.Th>
                      <Table.Th>إجمالي الدفعات المسجلة</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filteredHistory.map((sub: any) => {
                      const totalPaid = sub.payments?.reduce((s: number, p: any) => s + (p.amountCents || 0), 0) || 0;
                      return (
                        <Table.Tr key={sub.id}>
                          <Table.Td className="font-bold text-slate-900">
                            <div>{sub.tenant?.name || 'مؤسسة غير معروفة'}</div>
                            <span className="text-[10px] text-slate-400 font-mono font-normal">
                              {sub.tenant?.slug} {sub.tenant?.email ? `• ${sub.tenant?.email}` : ''}
                            </span>
                          </Table.Td>

                          <Table.Td>
                            <Badge color="orange" variant="light" size="xs" className="font-bold">
                              {sub.planVersion?.plan?.nameAr || 'باقة'}
                            </Badge>
                          </Table.Td>

                          <Table.Td>
                            <Badge
                              color={sub.status === 'ACTIVE' ? 'teal' : sub.status === 'SUSPENDED' ? 'red' : 'gray'}
                              variant="filled"
                              size="xs"
                              className="font-bold"
                            >
                              {sub.status === 'ACTIVE' ? 'نشط' : sub.status === 'SUSPENDED' ? 'معلق' : 'ملغي'}
                            </Badge>
                          </Table.Td>

                          <Table.Td className="font-medium text-slate-600">
                            {sub.billingCycle === 'QUARTERLY' ? 'كل 3 أشهر' : 'شهري'}
                          </Table.Td>

                          <Table.Td className="font-mono text-slate-600 text-[11px]">
                            {sub.startedAt ? new Date(sub.startedAt).toLocaleDateString('ar-IQ') : '—'}
                          </Table.Td>

                          <Table.Td className="font-mono text-slate-600 text-[11px]">
                            {sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString('ar-IQ') : '—'}
                          </Table.Td>

                          <Table.Td>
                            <div className="font-mono font-black text-slate-900">
                              ${totalPaid / 100}
                            </div>
                            <span className="text-[9.5px] text-slate-400">
                              {sub.payments?.length || 0} دفعة
                            </span>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </div>
            )}
          </div>
        </Tabs.Panel>

        {/* ════════════════════════════════════════════════════════════════════════
            TAB 5: PAYMENT METHODS & MASTERCARD DESIGNER
           ════════════════════════════════════════════════════════════════════════ */}
        <Tabs.Panel value="payments" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Column: Form Editor */}
            <div className="lg:col-span-7 p-5 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-4">
              <div>
                <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                  <IconCreditCard className="text-orange-600" size={18} />
                  <span>تخصيص وتفعيل طرق الدفع المتاحة للشركات</span>
                </h3>
                <p className="text-xs text-slate-500">
                  فعل أو عطّل أي طريقة دفع، وحدد بيانات الحسابات المصرفية التي تظهر في نافذة الشراء والتجديد.
                </p>
              </div>

              {/* Mastercard Form */}
              <div className={`p-4 rounded-2xl border transition-all ${
                masterEnabled ? 'bg-slate-50 border-emerald-300 shadow-2xs' : 'bg-slate-100/70 border-slate-200 opacity-60'
              } space-y-3`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IconCreditCard size={18} className={masterEnabled ? 'text-emerald-600' : 'text-slate-400'} />
                    <span className="font-black text-slate-900 text-xs">بطاقة الماستر كارد (Qi Card Mastercard)</span>
                    <Badge color={masterEnabled ? 'teal' : 'gray'} variant="light" size="xs" className="font-bold">
                      {masterEnabled ? 'مفعلة وتظهر للعملاء' : 'معطلة'}
                    </Badge>
                  </div>
                  <Switch
                    label={masterEnabled ? 'تشغيل' : 'إيقاف'}
                    checked={masterEnabled}
                    onChange={(e) => setMasterEnabled(e.currentTarget.checked)}
                    color="teal"
                    size="sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <TextInput
                    label="اسم حامل البطاقة / المستفيد"
                    value={masterCardHolder}
                    onChange={(e) => setMasterCardHolder(e.target.value)}
                    radius="md"
                    disabled={!masterEnabled}
                  />
                  <TextInput
                    label="رقم الحساب / رقم البطاقة (ظاهر للعملاء)"
                    value={masterCardNumber}
                    onChange={(e) => setMasterCardNumber(e.target.value)}
                    radius="md"
                    dir="ltr"
                    disabled={!masterEnabled}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <TextInput
                    label="اسم المصرف / البنك"
                    value={masterBankName}
                    onChange={(e) => setMasterBankName(e.target.value)}
                    radius="md"
                    disabled={!masterEnabled}
                  />
                  <TextInput
                    label="تاريخ الانتهاء"
                    value={masterExpiryDate}
                    onChange={(e) => setMasterExpiryDate(e.target.value)}
                    radius="md"
                    placeholder="12/28"
                    dir="ltr"
                    disabled={!masterEnabled}
                  />
                  <TextInput
                    label="نوع البطاقة"
                    value={masterCardType}
                    onChange={(e) => setMasterCardType(e.target.value)}
                    radius="md"
                    disabled={!masterEnabled}
                  />
                </div>

                <Textarea
                  label="تعليمات التحويل للعميل"
                  value={masterInstructions}
                  onChange={(e) => setMasterInstructions(e.target.value)}
                  rows={2}
                  radius="md"
                  disabled={!masterEnabled}
                />
              </div>

              {/* Other Payment Methods (QiCard, ZainCash, FIB) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* QiCard */}
                <div className={`p-3.5 rounded-2xl border space-y-2 transition-all ${
                  qiEnabled ? 'bg-amber-50/50 border-amber-300 shadow-2xs' : 'bg-slate-100/70 border-slate-200 opacity-60'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-black text-xs text-amber-950 block">كي كارد (QiCard)</span>
                      <Badge color={qiEnabled ? 'yellow' : 'gray'} variant="light" size="xs" className="font-bold text-[9px] mt-0.5">
                        {qiEnabled ? 'مفعلة' : 'معطلة'}
                      </Badge>
                    </div>
                    <Switch
                      checked={qiEnabled}
                      onChange={(e) => setQiEnabled(e.currentTarget.checked)}
                      color="orange"
                      size="xs"
                    />
                  </div>
                  <TextInput
                    label="رقم الحساب"
                    size="xs"
                    value={qiAccountNumber}
                    onChange={(e) => setQiAccountNumber(e.target.value)}
                    radius="md"
                    disabled={!qiEnabled}
                  />
                  <TextInput
                    label="اسم الحساب"
                    size="xs"
                    value={qiAccountName}
                    onChange={(e) => setQiAccountName(e.target.value)}
                    radius="md"
                    disabled={!qiEnabled}
                  />
                </div>

                {/* ZainCash */}
                <div className={`p-3.5 rounded-2xl border space-y-2 transition-all ${
                  zainEnabled ? 'bg-rose-50/50 border-rose-300 shadow-2xs' : 'bg-slate-100/70 border-slate-200 opacity-60'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-black text-xs text-rose-950 block">زين كاش (ZainCash)</span>
                      <Badge color={zainEnabled ? 'red' : 'gray'} variant="light" size="xs" className="font-bold text-[9px] mt-0.5">
                        {zainEnabled ? 'مفعلة' : 'معطلة'}
                      </Badge>
                    </div>
                    <Switch
                      checked={zainEnabled}
                      onChange={(e) => setZainEnabled(e.currentTarget.checked)}
                      color="orange"
                      size="xs"
                    />
                  </div>
                  <TextInput
                    label="رقم المحفظة"
                    size="xs"
                    value={zainPhoneNumber}
                    onChange={(e) => setZainPhoneNumber(e.target.value)}
                    radius="md"
                    disabled={!zainEnabled}
                  />
                  <TextInput
                    label="اسم المحفظة"
                    size="xs"
                    value={zainWalletName}
                    onChange={(e) => setZainWalletName(e.target.value)}
                    radius="md"
                    disabled={!zainEnabled}
                  />
                </div>

                {/* FIB */}
                <div className={`p-3.5 rounded-2xl border space-y-2 transition-all ${
                  fibEnabled ? 'bg-blue-50/50 border-blue-300 shadow-2xs' : 'bg-slate-100/70 border-slate-200 opacity-60'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-black text-xs text-blue-950 block">مصرف FIB</span>
                      <Badge color={fibEnabled ? 'blue' : 'gray'} variant="light" size="xs" className="font-bold text-[9px] mt-0.5">
                        {fibEnabled ? 'مفعلة' : 'معطلة'}
                      </Badge>
                    </div>
                    <Switch
                      checked={fibEnabled}
                      onChange={(e) => setFibEnabled(e.currentTarget.checked)}
                      color="orange"
                      size="xs"
                    />
                  </div>
                  <TextInput
                    label="رقم IBAN"
                    size="xs"
                    value={fibIban}
                    onChange={(e) => setFibIban(e.target.value)}
                    radius="md"
                    disabled={!fibEnabled}
                  />
                  <TextInput
                    label="اسم الحساب"
                    size="xs"
                    value={fibAccountName}
                    onChange={(e) => setFibAccountName(e.target.value)}
                    radius="md"
                    disabled={!fibEnabled}
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button
                  size="xs"
                  color="orange"
                  loading={updatePaymentMethodsMutation.isPending}
                  onClick={handleSavePaymentMethods}
                  className="bg-orange-500 hover:bg-orange-600 font-bold rounded-xl"
                >
                  حفظ إعدادات طرق الدفع في قاعدة البيانات
                </Button>
              </div>
            </div>

            {/* Right Column: Visual Qi Mastercard Live Preview Widget */}
            <div className="lg:col-span-5 p-5 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-4">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <IconPalette className="text-orange-600" size={18} />
                <span>المعاينة الحية لبطاقة الماستر كارد</span>
              </h3>
              <p className="text-xs text-slate-500">
                هكذا تظهر بطاقة الماستر كارد التفاعلية للشركات والمشتركين مع زر النسخ الفوري.
              </p>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                <MastercardPreviewCard
                  cardHolder={masterCardHolder}
                  cardNumber={masterCardNumber}
                  bankName={masterBankName}
                  expiryDate={masterExpiryDate}
                  cardType={masterCardType}
                  instructions={masterInstructions}
                />
              </div>
            </div>
          </div>
        </Tabs.Panel>

        {/* ════════════════════════════════════════════════════════════════════════
            TAB 6: LIVE PREVIEW & THEME CUSTOMIZER
           ════════════════════════════════════════════════════════════════════════ */}
        <Tabs.Panel value="preview" className="space-y-4">
          <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <IconPalette size={20} className="text-orange-600" />
              <div>
                <h4 className="font-black text-xs text-slate-800">معاينة وتخصيص ثيم الألوان</h4>
                <p className="text-[10px] text-slate-500">مظهر صفحة الأسعار وجدول المقارنة كما يراها العملاء مباشرة</p>
              </div>
            </div>

            <SegmentedControl
              value={themeAccent}
              onChange={(val) => setThemeAccent(val as any)}
              data={[
                { label: 'البرتقالي (الافتراضي)', value: 'orange' },
                { label: 'الزمردي (الأخضر)', value: 'emerald' },
                { label: 'الأزرق النيلي', value: 'blue' },
                { label: 'البنفسجي', value: 'indigo' },
              ]}
              color="orange"
              size="xs"
              radius="xl"
              className="font-bold text-xs"
            />
          </div>

          <div className="rounded-3xl border-2 border-slate-200 p-2 bg-slate-50 overflow-hidden shadow-inner">
            <PricingPage />
          </div>
        </Tabs.Panel>
      </Tabs>

      {/* ── MODAL: ENLARGE RECEIPT IMAGE ── */}
      <Modal
        opened={previewImageModalOpened}
        onClose={() => setPreviewImageModalOpened(false)}
        title={<span className="font-black text-xs text-slate-900">معاينة وصل التحويل بالحجم الكامل</span>}
        centered
        radius="2xl"
        size="xl"
      >
        <div className="p-2 text-center">
          <img
            src={selectedReceiptImage}
            alt="Full Receipt"
            className="max-h-[80vh] w-auto mx-auto rounded-xl shadow-lg border border-slate-200"
          />
        </div>
      </Modal>

      {/* ── MODAL: REJECT RENEWAL ── */}
      <Modal
        opened={rejectModalOpened}
        onClose={() => setRejectModalOpened(false)}
        title={<span className="font-black text-sm text-red-600">رفض إشعار التحويل</span>}
        centered
        radius="2xl"
      >
        <div className="space-y-3 text-xs" dir="rtl">
          <Textarea
            label="سبب الرفض (سيظهر للعميل)"
            placeholder="مثال: لم يتم العثور على المبلغ في الحساب المصرفي أو رقم الإشعار غير صحيح..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            radius="md"
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button size="xs" variant="default" onClick={() => setRejectModalOpened(false)}>
              إلغاء
            </Button>
            <Button
              size="xs"
              color="red"
              loading={rejectRenewalMutation.isPending}
              onClick={() => {
                if (selectedPaymentToReject) {
                  rejectRenewalMutation.mutate({
                    paymentId: selectedPaymentToReject,
                    reason: rejectReason,
                  });
                }
              }}
              className="font-bold rounded-xl"
            >
              تأكيد الرفض
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: EDIT PLAN ── */}
      <Modal
        opened={editPlanModalOpened}
        onClose={() => setEditPlanModalOpened(false)}
        title={
          <span className="font-black text-sm text-slate-900">
            تعديل باقة: {selectedPlan?.nameAr} ({selectedPlan?.code})
          </span>
        }
        centered
        radius="xl"
        size="lg"
      >
        <div className="space-y-4 text-xs font-sans" dir="rtl">
          <TextInput
            label="اسم الباقة (عربي)"
            value={editNameAr}
            onChange={(e) => setEditNameAr(e.target.value)}
            radius="md"
          />

          <Textarea
            label="وصف الباقة"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            rows={2}
            radius="md"
          />

          <div className="grid grid-cols-2 gap-3">
            <NumberInput
              label="السعر بالدولار ($)"
              value={editPriceMonthly}
              onChange={(v) => setEditPriceMonthly(Number(v) || 0)}
              min={0}
              radius="md"
            />

            <div className="pt-6">
              <Switch
                label="شارة (الأكثر طلباً وموصى بها)"
                checked={editIsRecommended}
                onChange={(e) => setEditIsRecommended(e.currentTarget.checked)}
                color="orange"
                size="sm"
              />
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <span className="font-black text-slate-800 text-xs block">الحدود التشغيلية للباقة:</span>
            <div className="grid grid-cols-3 gap-2">
              <NumberInput
                label="الفروع (-1 = مفتوح)"
                value={editMaxBranches}
                onChange={(v) => setEditMaxBranches(Number(v))}
                radius="md"
              />
              <NumberInput
                label="المستخدمين (-1 = مفتوح)"
                value={editMaxUsers}
                onChange={(v) => setEditMaxUsers(Number(v))}
                radius="md"
              />
              <NumberInput
                label="بريد اليوم (-1 = مفتوح)"
                value={editEmailDaily}
                onChange={(v) => setEditEmailDaily(Number(v))}
                radius="md"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button size="xs" variant="default" onClick={() => setEditPlanModalOpened(false)}>
              إلغاء
            </Button>
            <Button
              size="xs"
              color="orange"
              loading={updatePlanMutation.isPending}
              onClick={handleSavePlan}
              className="bg-orange-500 hover:bg-orange-600 font-bold"
            >
              حفظ التغييرات في قاعدة البيانات
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── 5. Add New Feature Modal ── */}
      <Modal
        opened={addFeatureModalOpened}
        onClose={() => setAddFeatureModalOpened(false)}
        title={
          <span className="font-black text-sm text-slate-900 flex items-center gap-2">
            <IconPlus size={16} className="text-orange-600" />
            <span>إضافة ميزة جديدة للمصفوفة وجدول المقارنة</span>
          </span>
        }
        centered
        radius="2xl"
        size="md"
      >
        <div className="space-y-4 text-xs font-sans" dir="rtl">
          <TextInput
            label="اسم الميزة (باللغة العربية)"
            placeholder="مثال: نظام الفوترة الإلكترونية والربط الضريبي"
            value={newFeatureName}
            onChange={(e) => {
              setNewFeatureName(e.target.value);
              if (!newFeatureCode) {
                // Auto generate rough code
                const rough = e.target.value
                  .trim()
                  .toUpperCase()
                  .replace(/[\s\-_]+/g, '_');
              }
            }}
            required
            radius="md"
          />

          <TextInput
            label="كود الميزة البرمجي (بالإنجليزية Unique Code)"
            placeholder="مثال: E_INVOICING_INTEGRATION"
            value={newFeatureCode}
            onChange={(e) => setNewFeatureCode(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
            required
            radius="md"
          />

          <Select
            label="تصنيف وقسم الميزة في جدول المقارنة"
            value={newFeatureCategory}
            onChange={(val) => setNewFeatureCategory(val || 'ACCOUNTING')}
            data={[
              { value: 'ACCOUNTING', label: '1. المحاسبة والعمليات المالية' },
              { value: 'TRAVEL', label: '2. السياحة وتذاكر الطيران' },
              { value: 'BRANCHES', label: '3. الفروع والتعدد المحاسبي' },
              { value: 'SECURITY', label: '4. الصلاحيات والأمان والرقابة' },
              { value: 'REPORTS', label: '5. التقارير والتحليلات المالية' },
              { value: 'STORAGE', label: '6. التخزين والنسخ الاحتياطي' },
              { value: 'INTEGRATIONS', label: '7. الربط البرمجي والدعم الفني' },
            ]}
            radius="md"
          />

          <div className="pt-2">
            <Switch
              label="تفعيل الميزة افتراضياً لجميع الباقات"
              checked={newFeatureDefaultEnabled}
              onChange={(e) => setNewFeatureDefaultEnabled(e.currentTarget.checked)}
              color="orange"
              size="sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button size="xs" variant="default" onClick={() => setAddFeatureModalOpened(false)}>
              إلغاء
            </Button>
            <Button
              size="xs"
              color="orange"
              loading={createFeatureMutation.isPending}
              disabled={!newFeatureName.trim() || !newFeatureCode.trim()}
              onClick={() => {
                createFeatureMutation.mutate({
                  nameAr: newFeatureName.trim(),
                  featureCode: newFeatureCode.trim(),
                  category: newFeatureCategory,
                  defaultEnabled: newFeatureDefaultEnabled,
                });
              }}
              className="bg-orange-500 hover:bg-orange-600 font-bold rounded-xl text-white shadow-xs"
            >
              إضافة الميزة للمصفوفة
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── 6. Edit Feature Modal ── */}
      <Modal
        opened={editFeatureModalOpened}
        onClose={() => setEditFeatureModalOpened(false)}
        title={
          <span className="font-black text-sm text-slate-900 flex items-center gap-2">
            <IconEdit size={16} className="text-orange-600" />
            <span>تعديل الميزة: {selectedFeatureToEdit?.code}</span>
          </span>
        }
        centered
        radius="2xl"
        size="md"
      >
        <div className="space-y-4 text-xs font-sans" dir="rtl">
          <TextInput
            label="اسم الميزة (عربي)"
            value={editFeatureName}
            onChange={(e) => setEditFeatureName(e.target.value)}
            required
            radius="md"
          />

          <Select
            label="تصنيف وقسم الميزة"
            value={editFeatureCategory}
            onChange={(val) => setEditFeatureCategory(val || 'ACCOUNTING')}
            data={[
              { value: 'ACCOUNTING', label: '1. المحاسبة والعمليات المالية' },
              { value: 'TRAVEL', label: '2. السياحة وتذاكر الطيران' },
              { value: 'BRANCHES', label: '3. الفروع والتعدد المحاسبي' },
              { value: 'SECURITY', label: '4. الصلاحيات والأمان والرقابة' },
              { value: 'REPORTS', label: '5. التقارير والتحليلات المالية' },
              { value: 'STORAGE', label: '6. التخزين والنسخ الاحتياطي' },
              { value: 'INTEGRATIONS', label: '7. الربط البرمجي والدعم الفني' },
            ]}
            radius="md"
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button size="xs" variant="default" onClick={() => setEditFeatureModalOpened(false)}>
              إلغاء
            </Button>
            <Button
              size="xs"
              color="orange"
              loading={updateFeatureMutation.isPending}
              disabled={!editFeatureName.trim()}
              onClick={() => {
                if (selectedFeatureToEdit) {
                  updateFeatureMutation.mutate({
                    code: selectedFeatureToEdit.code,
                    data: {
                      nameAr: editFeatureName.trim(),
                      category: editFeatureCategory,
                    },
                  });
                }
              }}
              className="bg-orange-500 hover:bg-orange-600 font-bold rounded-xl text-white shadow-xs"
            >
              حفظ التعديلات
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PricingManagementPage;
