import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  Skeleton,
  Title,
  Alert,
  Modal,
} from '@mantine/core';
import {
  IconCheck,
  IconMinus,
  IconSparkles,
  IconArrowLeft,
  IconArrowRight,
  IconBuildingStore,
  IconMail,
  IconUsers,
  IconAlertCircle,
  IconRocket,
  IconCrown,
  IconBuildingSkyscraper,
  IconGift,
  IconTable,
  IconBuildingCommunity,
  IconLock,
  IconLogin,
  IconUserPlus,
  IconRefresh,
} from '@tabler/icons-react';
import { useAuthStore } from '../store/useAuthStore';
import { subscriptionsApi, PublicPlan } from '../api/subscriptions';
import { tenantsApi } from '../api/tenants';
import { PricingComparisonTable } from '../components/pricing/PricingComparisonTable';
import { SubscriptionCheckoutModal } from '../components/pricing/SubscriptionCheckoutModal';
import { FeedbackFloatingDrawer } from '../components/feedback/FeedbackFloatingDrawer';

// ── Animated Counter Hook ──
const useCountUp = (target: number, duration = 1200) => {
  const [count, setCount] = useState(0);
  const hasAnimated = useRef(false);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (hasAnimated.current || target <= 0) {
      setCount(target);
      return;
    }
    hasAnimated.current = true;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(Math.round(eased * target));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return count;
};

export const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token } = useAuthStore();
  const isAuthenticated = !!token && !!user;

  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const isAr = lang === 'ar';

  // Fetch Current Tenant Subscription to highlight active plan
  const { data: currentTenant } = useQuery({
    queryKey: ['current-tenant'],
    queryFn: () => tenantsApi.getCurrentTenant(),
    enabled: isAuthenticated,
  });

  const currentPlanCode = currentTenant?.subscription?.planVersion?.plan?.code || (isAuthenticated ? 'FREE_TRIAL' : null);

  const [checkoutModalOpened, setCheckoutModalOpened] = useState(false);
  const [selectedCheckoutPlan, setSelectedCheckoutPlan] = useState<PublicPlan | null>(null);

  // Authentication Enforcement: If unauthenticated, prompt or redirect to login
  useEffect(() => {
    if (!isAuthenticated) {
      // Store redirect target if needed
    }
  }, [isAuthenticated]);

  const {
    data: plans = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['public-plans'],
    queryFn: subscriptionsApi.getPublicPlans,
  });

  const sortOrderMap: Record<string, number> = {
    FREE_TRIAL: 1,
    BASIC: 2,
    PRO: 3,
    ENTERPRISE: 4,
  };

  const orderedPlans = [...plans].sort((a, b) => {
    const orderA = sortOrderMap[a.code] ?? 99;
    const orderB = sortOrderMap[b.code] ?? 99;
    return orderA - orderB;
  });

  // Top curated features per plan (Bilingual)
  const getCuratedFeatures = (code: string) => {
    if (isAr) {
      switch (code) {
        case 'FREE_TRIAL':
          return [
            { text: 'دليل الحسابات والقيود اليومية', included: true },
            { text: 'سندات القبض والدفع والصرافة', included: true },
            { text: 'إدارة الصناديق والحسابات البنكية', included: true },
            { text: 'تذاكر الطيران والمسافرين', included: true },
            { text: 'كشوفات الحساب وتصدير PDF/Excel', included: true },
            { text: 'إدارة السنوات المالية والتدوير', included: true },
            { text: 'تعدد الفروع والربط البرمجي API', included: false },
          ];
        case 'BASIC':
          return [
            { text: 'دليل الحسابات الشجري والقيود المحاسبية', included: true },
            { text: 'سندات القبض والصرف وحركات الصندوق', included: true },
            { text: 'إدارة العملاء والموردين وكشوف الحساب', included: true },
            { text: 'إدارة تذاكر الطيران والحجوزات الأساسية', included: true },
            { text: 'إقفال السنة المالية والتدوير المحاسبي', included: true },
            { text: 'النسخ الاحتياطي السحابي اليومي', included: true },
            { text: 'الفروع المتعددة والصلاحيات المتقدمة', included: false },
          ];
        case 'PRO':
          return [
            { text: 'كل مزايا الباقة الأساسية بالكامل', included: true },
            { text: 'تعدد الفروع المفتوح ومراكز التكلفة', included: true },
            { text: 'نظام الصلاحيات المتقدم والأدوار', included: true },
            { text: 'تقارير الأرباح والخسائر وميزان المراجعة', included: true },
            { text: 'محرك تسعير التذاكر وعمولات الشركات', included: true },
            { text: 'تصدير التقارير بتصاميم مخصصة PDF/Excel', included: true },
            { text: 'دعم فني متميز ذو أولوية عالية', included: true },
          ];
        case 'ENTERPRISE':
          return [
            { text: 'كل المزايا والخصائص بدون أي قيود (∞)', included: true },
            { text: 'فروع ومستخدمين وعمليات غير محدودة', included: true },
            { text: 'سجل تدقيق أمني متقدم لكافة العمليات', included: true },
            { text: 'ربط برمجي كامل وتكامل API مخصص', included: true },
            { text: 'نسخ احتياطي فوري وسيرفرات مخصصة', included: true },
            { text: 'مدير حساب مالي وتقني خاص 24/7', included: true },
            { text: 'تخصيص نماذج الفواتير والسندات بالكامل', included: true },
          ];
        default:
          return [];
      }
    } else {
      switch (code) {
        case 'FREE_TRIAL':
          return [
            { text: 'Chart of Accounts & Journal Entries', included: true },
            { text: 'Receipt, Payment & Exchange Vouchers', included: true },
            { text: 'Cashboxes & Bank Accounts Management', included: true },
            { text: 'Flight Tickets & Passenger Operations', included: true },
            { text: 'Account Statements & PDF/Excel Export', included: true },
            { text: 'Fiscal Year Management & Year-End Closing', included: true },
            { text: 'Multi-Branch & Dedicated REST API', included: false },
          ];
        case 'BASIC':
          return [
            { text: 'Full Tree COA & Standard Journal Entries', included: true },
            { text: 'Receipt/Payment Vouchers & Cash Flow', included: true },
            { text: 'Customers & Suppliers Account Statements', included: true },
            { text: 'Core Flight Tickets & Reservation Ledger', included: true },
            { text: 'Fiscal Year Closing & Balance Forwarding', included: true },
            { text: 'Daily Automated Cloud Backups', included: true },
            { text: 'Multi-Branch & Granular Role Permissions', included: false },
          ];
        case 'PRO':
          return [
            { text: 'All Basic Plan Features Included', included: true },
            { text: 'Unlimited Branch Creation & Cost Centers', included: true },
            { text: 'Granular Role-Based Access Control (RBAC)', included: true },
            { text: 'Income Statements, Balance Sheets & Trial Balances', included: true },
            { text: 'Ticket Pricing Engine & Agency Commissions', included: true },
            { text: 'Custom Branded PDF/Excel Export Engine', included: true },
            { text: 'Priority VIP Technical & Accounting Support', included: true },
          ];
        case 'ENTERPRISE':
          return [
            { text: 'All Features Unlocked with Zero Limits (∞)', included: true },
            { text: 'Unlimited Branches, Users & Transactions', included: true },
            { text: 'Enterprise Audit Trail & Comprehensive Logs', included: true },
            { text: 'Full REST API Integration & Webhooks', included: true },
            { text: 'Real-time High-Availability Cloud Backups', included: true },
            { text: 'Dedicated 24/7 Financial Account Manager', included: true },
            { text: 'Fully Custom Print Templates & Invoice Designs', included: true },
          ];
        default:
          return [];
      }
    }
  };

  const getPlanIcon = (code: string) => {
    switch (code) {
      case 'FREE_TRIAL':
        return <IconGift size={20} className="text-[#F45A0A]" />;
      case 'BASIC':
        return <IconBuildingStore size={20} className="text-[#F45A0A]" />;
      case 'PRO':
        return <IconRocket size={20} className="text-[#F45A0A]" />;
      case 'ENTERPRISE':
        return <IconCrown size={20} className="text-[#F45A0A]" />;
      default:
        return <IconBuildingSkyscraper size={20} className="text-[#F45A0A]" />;
    }
  };

  const getPlanName = (plan: PublicPlan) => {
    if (isAr) return plan.nameAr;
    switch (plan.code) {
      case 'FREE_TRIAL':
        return 'Free Trial';
      case 'BASIC':
        return 'Basic Plan';
      case 'PRO':
        return 'Professional Plan';
      case 'ENTERPRISE':
        return 'Enterprise Plan';
      default:
        return plan.nameAr;
    }
  };

  const getPlanDescription = (plan: PublicPlan) => {
    if (isAr) return plan.description;
    switch (plan.code) {
      case 'FREE_TRIAL':
        return 'Explore all features freely for 14 days with zero risk.';
      case 'BASIC':
        return 'Perfect for individual accountants and single-branch businesses.';
      case 'PRO':
        return 'Best choice for growing travel agencies and multi-branch companies.';
      case 'ENTERPRISE':
        return 'High-performance solution for large airline networks and corporations.';
      default:
        return plan.description;
    }
  };

  const handleSelectPlan = (plan: PublicPlan) => {
    if (!isAuthenticated) {
      if (plan.code === 'FREE_TRIAL') {
        navigate('/onboarding');
      } else {
        navigate('/login?redirect=/pricing');
      }
      return;
    }

    if (plan.code === 'FREE_TRIAL') {
      navigate('/onboarding');
    } else {
      setSelectedCheckoutPlan(plan);
      setCheckoutModalOpened(true);
    }
  };

  const scrollToComparison = () => {
    document.getElementById('comparison-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div
      className="min-h-screen bg-slate-50/60 font-sans transition-all"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* ── TOP GLOBAL NAVBAR (Language Switcher & User Account) ── */}
      <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 sm:px-8 py-3 mb-6 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* 1. Language Switcher (Dynamic AR / EN Labels) */}
          <div className="inline-flex items-center p-0.5 rounded-full bg-slate-100 border border-slate-200/80 shadow-2xs">
            <button
              type="button"
              onClick={() => setLang('ar')}
              className={`px-3.5 py-1 text-xs font-black rounded-full transition-all cursor-pointer ${
                isAr ? 'bg-orange-500 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isAr ? 'العربية (AR)' : 'Arabic (AR)'}
            </button>
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`px-3.5 py-1 text-xs font-black rounded-full transition-all cursor-pointer ${
                !isAr ? 'bg-orange-500 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              English (EN)
            </button>
          </div>

          {/* 2. User Account Pill or Login Button */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
                <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-700 font-black text-xs flex items-center justify-center border border-orange-200 shrink-0">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="hidden sm:block text-right">
                  <span className="font-black text-xs text-slate-900 block leading-tight">
                    {user?.name || user?.email || (isAr ? 'المستخدم' : 'User')}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium block">
                    {currentTenant?.name || (user?.companyName && !user.companyName.includes('قسطاس') && !user.companyName.includes('الفرسان') ? user.companyName : (isAr ? 'شركة الروضتين للسياحة والسفر' : 'Al-Rawdhatain Travel'))}
                  </span>
                </div>
                <Button
                  size="xs"
                  variant="light"
                  color="orange"
                  onClick={() => navigate('/dashboard')}
                  className="text-xs font-bold rounded-xl px-2.5 h-7 mr-1"
                >
                  {isAr ? 'لوحة التحكم' : 'Dashboard'}
                </Button>
              </div>
            ) : (
              <Button
                size="xs"
                color="orange"
                onClick={() => navigate('/login?redirect=/pricing')}
                className="bg-orange-500 hover:bg-orange-600 font-bold rounded-xl shadow-xs"
              >
                {isAr ? 'تسجيل الدخول' : 'Sign In'}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* ── Mandatory Login Modal Barrier for Unauthenticated Users ── */}
      {!isAuthenticated && (
        <Modal
          opened={!isAuthenticated}
          onClose={() => navigate('/login')}
          withCloseButton={false}
          closeOnClickOutside={false}
          closeOnEscape={false}
          centered
          size="md"
          radius="2xl"
          overlayProps={{
            backgroundOpacity: 0.7,
            blur: 8,
          }}
        >
          <div className="text-center p-4 space-y-4 font-sans" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="w-14 h-14 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mx-auto shadow-sm ring-8 ring-orange-50">
              <IconLock size={28} />
            </div>

            <div>
              <h3 className="text-base font-black text-slate-900 leading-tight">
                {isAr ? 'تسجيل الدخول مطلوب لعرض الباقات والاشتراك' : 'Authentication Required to Access Pricing'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {isAr
                  ? 'يرجى تسجيل الدخول بحساب مؤسستك لترقية وتجديد الاشتراك، أو أنشئ حساباً جديداً لبدء الفترة التجريبية المجانية (14 يوماً).'
                  : 'Please sign in with your business account to upgrade your subscription, or register a new account to start your 14-day free trial.'}
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <Button
                fullWidth
                color="orange"
                size="sm"
                leftSection={<IconLogin size={16} />}
                onClick={() => navigate('/login?redirect=/pricing')}
                className="bg-orange-500 hover:bg-orange-600 font-black rounded-xl h-10 shadow-xs"
              >
                {isAr ? 'تسجيل الدخول بحسابي الحالي' : 'Sign In with Existing Account'}
              </Button>

              <Button
                fullWidth
                variant="light"
                color="teal"
                size="sm"
                leftSection={<IconUserPlus size={16} />}
                onClick={() => navigate('/onboarding')}
                className="font-bold rounded-xl h-10"
              >
                {isAr ? '✨ إنشاء حساب وبدء التجربة المجانية (14 يوماً)' : '✨ Start Free 14-Day Trial'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── 1. Page Header (Clean, Minimalist, No Repetitive Boxes) ── */}
      <div className="max-w-4xl mx-auto mb-8 px-4 text-center space-y-2">
        <Title order={1} className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          {isAr
            ? 'اختر الباقة المناسبة لحجم ونمو أعمالك المحاسبية والسياحية'
            : 'Choose the Ideal Plan for Your Accounting & Travel Business'}
        </Title>

        <p className="text-xs text-slate-500 font-medium max-w-xl mx-auto">
          {isAr
            ? 'جميع المشتركين الجدد يحصلون على فترة تجريبية مجانية لمدة 14 يوماً بدون بطاقة ائتمان.'
            : 'All new subscribers get a 14-day free trial with zero upfront credit card.'}
        </p>

        <div className="pt-1.5">
          <Button
            size="xs"
            variant="subtle"
            color="orange"
            leftSection={<IconTable size={14} />}
            onClick={scrollToComparison}
            className="text-xs font-bold text-orange-600 hover:bg-orange-50 rounded-xl"
          >
            {isAr ? 'عرض جدول المقارنة الكامل ↓' : 'View Full Comparison Table ↓'}
          </Button>
        </div>
      </div>

      {/* ── 2. Pricing Cards Grid (Unified Luxury White Cards) ── */}
      <div className="max-w-7xl mx-auto pt-6 pb-2 overflow-visible">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="p-4 rounded-3xl border border-slate-200 bg-white">
                <Skeleton height={24} width="50%" mb="xs" />
                <Skeleton height={40} mb="sm" />
                <div className="space-y-1.5 mb-4">
                  <Skeleton height={12} />
                  <Skeleton height={12} />
                  <Skeleton height={12} />
                  <Skeleton height={12} />
                </div>
                <Skeleton height={36} mt="md" radius="md" />
              </Card>
            ))}
          </div>
        ) : isError ? (
          <div className="max-w-md mx-auto">
            <Alert color="red" title={isAr ? 'خطأ في تحميل خطط الأسعار' : 'Error Loading Plans'} icon={<IconAlertCircle size={18} />}>
              {(error as Error)?.message || (isAr ? 'تعذر الاتصال بقاعدة البيانات.' : 'Failed to load plans.')}
              <Button size="xs" color="red" variant="light" className="mt-3" onClick={() => refetch()}>
                {isAr ? 'إعادة المحاولة' : 'Retry'}
              </Button>
            </Alert>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch overflow-visible">
            {orderedPlans.map((plan: PublicPlan) => (
              <PricingCard
                key={plan.id}
                plan={plan}
                isAr={isAr}
                isAuthenticated={isAuthenticated}
                currentPlanCode={currentPlanCode}
                getPlanIcon={getPlanIcon}
                getPlanName={getPlanName}
                getPlanDescription={getPlanDescription}
                getCuratedFeatures={getCuratedFeatures}
                onSelectPlan={handleSelectPlan}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── 3. Full Comparison Table Section ── */}
      <div id="comparison-section" className="max-w-7xl mx-auto pt-6">
        <PricingComparisonTable plans={orderedPlans} onSelectPlan={(code) => {
          const plan = orderedPlans.find((p) => p.code === code);
          if (plan) handleSelectPlan(plan);
        }} lang={lang} />
      </div>

      {/* ── 4. Checkout / Payment Modal ── */}
      <SubscriptionCheckoutModal
        opened={checkoutModalOpened}
        onClose={() => setCheckoutModalOpened(false)}
        selectedPlan={selectedCheckoutPlan}
      />

      {/* Floating Feedback Drawer */}
      <FeedbackFloatingDrawer />
    </div>
  );
};

// ── PricingCard Sub-Component ──
interface PricingCardProps {
  plan: PublicPlan;
  isAr: boolean;
  isAuthenticated: boolean;
  currentPlanCode: string | null;
  getPlanIcon: (code: string) => React.ReactNode;
  getPlanName: (plan: PublicPlan) => string;
  getPlanDescription: (plan: PublicPlan) => string | undefined;
  getCuratedFeatures: (code: string) => { text: string; included: boolean }[];
  onSelectPlan: (plan: PublicPlan) => void;
}

const PricingCard: React.FC<PricingCardProps> = ({
  plan,
  isAr,
  isAuthenticated,
  currentPlanCode,
  getPlanIcon,
  getPlanName,
  getPlanDescription,
  getCuratedFeatures,
  onSelectPlan,
}) => {
  const isPro = plan.isRecommended || plan.code === 'PRO';
  const isTrial = plan.code === 'FREE_TRIAL';
  const isBasic = plan.code === 'BASIC';
  const isEnterprise = plan.code === 'ENTERPRISE';
  const isCurrentPlan = isAuthenticated && currentPlanCode === plan.code;

  // Price
  const rawPrice = isTrial ? 0 : (plan.priceMonthly || 0);
  const animatedPrice = useCountUp(rawPrice);
  const cycleLabel = isTrial
    ? isAr ? '/ 14 يوماً' : '/ 14 days'
    : (isPro || isEnterprise)
    ? isAr ? '/ كل 3 أشهر' : '/ 3 months'
    : isAr ? '/ شهرياً' : '/ month';

  // Limits
  const branchesLimit = plan.limits?.find((l) => l.limitCode === 'MAX_BRANCHES')?.limitValue;
  const branchesText =
    branchesLimit === -1
      ? isAr ? 'غير محدود' : '∞'
      : branchesLimit !== undefined
      ? `${branchesLimit}`
      : isTrial || isBasic ? '1' : '∞';

  const usersLimit = plan.limits?.find((l) => l.limitCode === 'MAX_USERS')?.limitValue;
  const usersText =
    usersLimit === -1
      ? isAr ? 'غير محدود' : '∞'
      : usersLimit !== undefined
      ? `${usersLimit}`
      : isTrial ? '2' : isBasic ? '3' : isPro ? '15' : '∞';

  const emailsLimit = plan.limits?.find((l) => l.limitCode === 'EMAIL_DAILY')?.limitValue;
  const emailsText =
    emailsLimit === -1
      ? '∞'
      : emailsLimit !== undefined
      ? `${emailsLimit}`
      : isTrial ? '5' : isBasic ? '150' : isPro ? '300' : '∞';

  const features = getCuratedFeatures(plan.code);

  // Card border style
  const cardBorder = isCurrentPlan
    ? isTrial
      ? 'border border-slate-200/80 shadow-sm bg-emerald-50/20'
      : 'border-2 border-emerald-500 shadow-xl ring-4 ring-emerald-500/10'
    : isPro
    ? 'border-2 border-[#F45A0A] shadow-xl ring-4 ring-[#F45A0A]/8'
    : 'border border-slate-200/80 shadow-sm hover:border-[#F45A0A]/40 hover:shadow-lg';

  return (
    <div className="relative pt-5 flex flex-col h-full">
      {/* Floating Badge */}
      {isCurrentPlan && !isTrial ? (
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-30 whitespace-nowrap">
          <div className="bg-emerald-600 text-white text-[11px] font-black px-5 py-1.5 rounded-xl shadow-lg shadow-emerald-600/25 flex items-center gap-1.5 border-2 border-white">
            <IconCheck size={13} stroke={3} />
            <span>{isAr ? 'باقتك الحالية المفعلة' : 'Current Active Plan'}</span>
          </div>
        </div>
      ) : isPro && !isCurrentPlan ? (
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-30 whitespace-nowrap">
          <div className="bg-[#F45A0A] text-white text-[11px] font-black px-5 py-1.5 rounded-xl shadow-lg shadow-[#F45A0A]/25 flex items-center gap-1.5 border-2 border-white">
            <IconSparkles size={12} />
            <span>{isAr ? 'الأكثر طلباً ★' : 'Most Popular ★'}</span>
          </div>
        </div>
      ) : isCurrentPlan && isTrial ? (
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-30 whitespace-nowrap">
          <div className="bg-slate-600 text-white text-[11px] font-black px-5 py-1.5 rounded-xl shadow-lg shadow-slate-600/20 flex items-center gap-1.5 border-2 border-white">
            <IconCheck size={13} stroke={3} />
            <span>{isAr ? 'مفعّلة حالياً' : 'Active'}</span>
          </div>
        </div>
      ) : null}

      <div className={`relative flex flex-col justify-between rounded-2xl transition-all duration-300 bg-white h-full ${cardBorder}`}>
        {/* ─── Header ─── */}
        <div>
          <div className="px-6 pt-6 pb-3">
            <div className="flex items-center gap-3 mb-2.5">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isCurrentPlan && !isTrial
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                    : 'bg-orange-50 border border-orange-100'
                }`}
              >
                {getPlanIcon(plan.code)}
              </div>
              <div>
                <h3 className="font-black text-[15px] text-slate-900 leading-tight">
                  {getPlanName(plan)}
                </h3>
                <span className="text-[9.5px] font-mono text-slate-400 block mt-0.5">
                  {plan.code}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed min-h-[28px]">
              {getPlanDescription(plan)}
            </p>
          </div>

          {/* ─── Price ─── */}
          <div className="mx-5 mb-3.5">
            <div className="py-3.5 text-center">
              <div className="flex items-baseline justify-center gap-1.5">
                <span className={`font-mono text-[32px] font-black tabular-nums lining-nums leading-none ${
                  isCurrentPlan && !isTrial ? 'text-emerald-700' : 'text-slate-900'
                }`}>
                  ${animatedPrice}
                </span>
                <span className="text-[11px] text-slate-400 font-bold">{cycleLabel}</span>
              </div>
            </div>
          </div>

          {/* ─── Limits (Inline Text Row) ─── */}
          <div className="mx-5 mb-3 flex items-center justify-center gap-4 text-center">
            <div>
              <span className="text-[9px] text-slate-400 font-bold block">{isAr ? 'الفروع' : 'Branches'}</span>
              <span className="text-[12px] font-black text-slate-800 font-mono tabular-nums">{branchesText}</span>
            </div>
            <div className="w-px h-6 bg-slate-200" />
            <div>
              <span className="text-[9px] text-slate-400 font-bold block">{isAr ? 'المستخدمين' : 'Users'}</span>
              <span className="text-[12px] font-black text-slate-800 font-mono tabular-nums">{usersText}</span>
            </div>
            <div className="w-px h-6 bg-slate-200" />
            <div>
              <span className="text-[9px] text-slate-400 font-bold block">{isAr ? 'البريد' : 'Emails'}</span>
              <span className="text-[12px] font-black text-slate-800 font-mono tabular-nums">{emailsText}</span>
            </div>
          </div>

          {/* ─── Divider ─── */}
          <div className="mx-5 mb-3 border-t border-slate-100" />

          {/* ─── Features (Simple Text) ─── */}
          <div className="mx-5 mb-5 space-y-1.5">
            <span className="text-[10px] font-black tracking-wider uppercase block text-slate-400 mb-1">
              {isAr ? 'أهم المزايا:' : 'Key Features:'}
            </span>
            {features.filter(f => f.included).map((feat, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <IconCheck size={12} stroke={3} className="text-emerald-500 shrink-0" />
                <span className="text-[11px] text-slate-600 font-medium leading-snug">
                  {feat.text}
                </span>
              </div>
            ))}
            {features.filter(f => !f.included).map((feat, idx) => (
              <div key={`x-${idx}`} className="flex items-center gap-2 opacity-40">
                <IconMinus size={11} stroke={2} className="text-slate-400 shrink-0" />
                <span className="text-[10.5px] text-slate-400 line-through leading-snug">
                  {feat.text}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ─── CTA Button ─── */}
        <div className="px-5 pb-5">
          <Button
            fullWidth
            size="md"
            color={isCurrentPlan ? 'teal' : 'orange'}
            variant={isCurrentPlan ? 'light' : 'filled'}
            onClick={() => onSelectPlan(plan)}
            rightSection={
              isCurrentPlan ? (
                <IconRefresh size={16} />
              ) : isTrial ? (
                <IconSparkles size={16} />
              ) : isAr ? (
                <IconArrowLeft size={16} />
              ) : (
                <IconArrowRight size={16} />
              )
            }
            className={`font-black text-[13px] rounded-xl h-11 shadow-sm transition-all ${
              isCurrentPlan
                ? 'border border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100'
                : 'bg-[#F45A0A] hover:bg-orange-600 shadow-[#F45A0A]/20 text-white'
            }`}
          >
            {isCurrentPlan
              ? isAr ? 'تجديد باقتك الحالية' : 'Renew Current Plan'
              : isTrial
              ? isAr ? 'بدء الفترة التجريبية' : 'Start Free Trial'
              : isAr ? `الترقية إلى ${getPlanName(plan)}` : `Upgrade to ${getPlanName(plan)}`}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
