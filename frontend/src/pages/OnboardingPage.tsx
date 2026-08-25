import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  Group,
  PasswordInput,
  Progress,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  Alert,
} from '@mantine/core';
import {
  IconBuildingStore,
  IconCheck,
  IconArrowLeft,
  IconArrowRight,
  IconSparkles,
  IconUser,
  IconMail,
  IconPhone,
  IconLock,
  IconFileCertificate,
  IconAlertCircle,
  IconGift,
  IconCrown,
  IconBuildingSkyscraper,
  IconRocket,
} from '@tabler/icons-react';
import { subscriptionsApi, PublicPlan } from '../api/subscriptions';
import { tenantsApi, CreateTenantPayload } from '../api/tenants';

export const OnboardingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [activeStep, setActiveStep] = useState(1);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successData, setSuccessData] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState<CreateTenantPayload>({
    name: '',
    legalName: '',
    slug: '',
    phone: '',
    email: '',
    address: '',
    city: 'بغداد',
    country: 'العراق',
    baseCurrency: 'IQD',
    planCode: (searchParams.get('plan') as any) || 'FREE_TRIAL',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: '',
    ownerPhone: '',
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['public-plans'],
    queryFn: subscriptionsApi.getPublicPlans,
  });

  useEffect(() => {
    const planParam = searchParams.get('plan');
    if (planParam && ['FREE_TRIAL', 'BASIC', 'PRO', 'ENTERPRISE'].includes(planParam)) {
      setFormData((prev) => ({ ...prev, planCode: planParam as any }));
    }
  }, [searchParams]);

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    const generatedSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    setFormData((prev) => ({
      ...prev,
      name,
      slug: prev.slug || generatedSlug || `org-${Date.now().toString().slice(-4)}`,
    }));
  };

  const handleNextStep = () => {
    setErrorMessage('');
    if (activeStep === 1) {
      if (!formData.name.trim()) {
        setErrorMessage('يرجى إدخال الاسم التجاري للمؤسسة');
        return;
      }
      if (!formData.slug.trim()) {
        setErrorMessage('يرجى إدخال الرمز التعريفي (Slug)');
        return;
      }
      setActiveStep(2);
    } else if (activeStep === 2) {
      if (!formData.ownerName.trim()) {
        setErrorMessage('يرجى إدخال اسم المسؤول / المالك');
        return;
      }
      if (!formData.ownerEmail.trim() || !formData.ownerEmail.includes('@')) {
        setErrorMessage('يرجى إدخال بريد إلكتروني صحيح');
        return;
      }
      if (!formData.ownerPassword || formData.ownerPassword.length < 6) {
        setErrorMessage('كلمة المرور يجب أن لا تقل عن 6 خانات');
        return;
      }
      setActiveStep(3);
    }
  };

  const handleFinalSubmit = async () => {
    setLoadingSubmit(true);
    setErrorMessage('');
    try {
      const payload: CreateTenantPayload = {
        name: formData.name.trim(),
        legalName: formData.legalName?.trim() || undefined,
        slug: formData.slug.trim(),
        phone: formData.phone?.trim() || undefined,
        email: formData.email?.trim() || undefined,
        address: formData.address?.trim() || undefined,
        city: formData.city?.trim() || 'بغداد',
        country: formData.country?.trim() || 'العراق',
        baseCurrency: 'IQD',
        planCode: formData.planCode || 'FREE_TRIAL',
        ownerName: formData.ownerName.trim(),
        ownerEmail: formData.ownerEmail.trim(),
        ownerPassword: formData.ownerPassword,
        ownerPhone: formData.ownerPhone?.trim() || undefined,
      };

      const res = await tenantsApi.publicOnboarding(payload);
      setSuccessData(res);
      setActiveStep(4);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || err.message || 'تعذر إنشاء حساب المؤسسة');
    } finally {
      setLoadingSubmit(false);
    }
  };

  const selectedPlan = plans.find((p) => p.code === formData.planCode) || {
    nameAr: formData.planCode === 'BASIC' ? 'الباقة الأساسية' : formData.planCode === 'PRO' ? 'الباقة الاحترافية' : formData.planCode === 'ENTERPRISE' ? 'الباقة الشاملة' : 'الفترة التجريبية المجانية',
    priceMonthly: formData.planCode === 'BASIC' ? 199 : formData.planCode === 'PRO' ? 199 : formData.planCode === 'ENTERPRISE' ? 799 : 0,
    code: formData.planCode,
  };

  const planOptions = [
    { value: 'FREE_TRIAL', label: 'الفترة التجريبية المجانية (14 يوماً) — $0' },
    { value: 'BASIC', label: 'الباقة الأساسية ($199 / شهرياً)' },
    { value: 'PRO', label: 'الباقة الاحترافية ($199 / شهرياً)' },
    { value: 'ENTERPRISE', label: 'الباقة الشاملة ($799 / كل 3 أشهر)' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-orange-50/20 to-slate-50 py-8 px-4 sm:px-6 lg:px-8 font-sans" dir="rtl">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-bold shadow-2xs">
            <IconSparkles size={14} className="text-orange-600" />
            <span>معالج تهيئة المؤسسة المشتركة الجديدة</span>
          </div>
          <Title order={2} className="text-2xl sm:text-3xl font-black text-slate-900">
            انضم إلى منصة قسطاس للأنظمة المالية والسياحية
          </Title>
          <Text className="text-xs text-slate-500 max-w-lg mx-auto">
            خطوات بسيطة لتهيئة فروعك، شجرة حساباتك، ونظامك المحاسبي المتكامل خلال دقيقة واحدة.
          </Text>
        </div>

        {/* Selected Plan Bar with Quick Change Option */}
        {activeStep <= 3 && (
          <div className="p-3 rounded-2xl bg-white border border-orange-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                {formData.planCode === 'BASIC' ? (
                  <IconBuildingStore size={18} />
                ) : formData.planCode === 'PRO' ? (
                  <IconCrown size={18} />
                ) : formData.planCode === 'ENTERPRISE' ? (
                  <IconBuildingSkyscraper size={18} />
                ) : (
                  <IconGift size={18} />
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 font-bold">الباقة المختارة:</span>
                  <span className="text-xs font-black text-slate-900">{selectedPlan.nameAr}</span>
                  <Badge size="xs" color="orange" variant="light" className="font-bold font-mono">
                    {formData.planCode === 'FREE_TRIAL' ? '$0' : formData.planCode === 'ENTERPRISE' ? '$799 / 3 أشهر' : `$${selectedPlan.priceMonthly}/شهر`}
                  </Badge>
                </div>
                <span className="text-[10.5px] text-slate-500">
                  {formData.planCode === 'FREE_TRIAL' ? '14 يوماً مجاناً مع كامل الصلاحيات' : 'يمكنك الترقية وتغيير الباقة في أي وقت'}
                </span>
              </div>
            </div>

            <div className="min-w-[220px]">
              <Select
                size="xs"
                value={formData.planCode}
                data={planOptions}
                onChange={(val) => setFormData({ ...formData, planCode: (val as any) || 'FREE_TRIAL' })}
                label=""
                placeholder="تغيير نوع الباقة..."
                className="font-bold text-xs"
              />
            </div>
          </div>
        )}

        {/* Wizard Progress - 3 Clean Steps */}
        {activeStep <= 3 && (
          <Card className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2 px-1">
              <span className={activeStep >= 1 ? 'text-orange-600 font-black' : ''}>1. بيانات المؤسسة</span>
              <span className={activeStep >= 2 ? 'text-orange-600 font-black' : ''}>2. حساب المالك المسؤول</span>
              <span className={activeStep >= 3 ? 'text-orange-600 font-black' : ''}>3. التأكيد والتفعيل</span>
            </div>
            <Progress value={(activeStep / 3) * 100} color="orange" size="sm" radius="xl" />
          </Card>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <Alert color="red" title="تنبيه" icon={<IconAlertCircle size={18} />}>
            {errorMessage}
          </Alert>
        )}

        {/* ── STEP 1: ORGANIZATION INFO ── */}
        {activeStep === 1 && (
          <Card className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-2.5">
              <h3 className="font-black text-sm sm:text-base text-slate-900 flex items-center gap-2">
                <IconBuildingStore size={18} className="text-orange-600" />
                <span>الخطوة 1: المعلومات الأساسية للمؤسسة / الوكالة</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">أدخل البيانات الرسمية لمنشأتك التجارية أو وكالتك السياحية.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <TextInput
                size="sm"
                label="الاسم التجاري للمؤسسة"
                placeholder="مثال: شركة النجوم للسياحة والسفر"
                value={formData.name}
                onChange={(e) => handleNameChange(e.currentTarget.value)}
                withAsterisk
                required
              />

              <TextInput
                size="sm"
                label="الاسم القانوني المسجل (اختياري)"
                placeholder="مثال: شركة النجوم للخدمات السياحية المحدودة"
                value={formData.legalName}
                onChange={(e) => setFormData({ ...formData, legalName: e.currentTarget.value })}
              />

              <TextInput
                size="sm"
                label="الرمز التعريفي للنظام (Slug)"
                placeholder="alnojoom-travel"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.currentTarget.value })}
                description="يستخدم في رابط المنصة والتعريف الفريد"
                withAsterisk
                required
              />

              <Select
                size="sm"
                label="المدينة والمحافظة"
                data={['بغداد', 'النجف الأشرف', 'أربيل', 'البصرة', 'كربلاء المقدسة', 'السليمانية', 'الموصل', 'بابل', 'أخرى']}
                value={formData.city}
                onChange={(val) => setFormData({ ...formData, city: val || 'بغداد' })}
              />

              <TextInput
                size="sm"
                label="رقم هاتف المؤسسة"
                placeholder="+964 770 000 0000"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.currentTarget.value })}
              />

              <TextInput
                size="sm"
                label="العنوان والموقع"
                placeholder="مثال: شارع الكرادة، بغداد"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.currentTarget.value })}
              />
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <Button color="orange" rightSection={<IconArrowLeft size={16} />} onClick={handleNextStep} className="bg-orange-500 font-bold">
                المتابعة إلى حساب المالك
              </Button>
            </div>
          </Card>
        )}

        {/* ── STEP 2: OWNER ACCOUNT (Redesigned & Balanced) ── */}
        {activeStep === 2 && (
          <Card className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-2.5">
              <h3 className="font-black text-sm sm:text-base text-slate-900 flex items-center gap-2">
                <IconUser size={18} className="text-orange-600" />
                <span>الخطوة 2: إعداد حساب المالك / المدير المسؤول</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">ستستخدم هذه البيانات لتسجيل الدخول وإدارة حساب المؤسسة بصلاحيات المدير العام.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <TextInput
                size="sm"
                label="اسم المدير / المسؤول"
                placeholder="مثال: علي جعفر محمود"
                leftSection={<IconUser size={16} className="text-orange-600" />}
                value={formData.ownerName}
                onChange={(e) => setFormData({ ...formData, ownerName: e.currentTarget.value })}
                withAsterisk
                required
              />

              <TextInput
                size="sm"
                label="البريد الإلكتروني للدخول"
                placeholder="owner@agency.com"
                leftSection={<IconMail size={16} className="text-orange-600" />}
                value={formData.ownerEmail}
                onChange={(e) => setFormData({ ...formData, ownerEmail: e.currentTarget.value })}
                withAsterisk
                required
              />

              <TextInput
                size="sm"
                label="رقم الهاتف المباشر"
                placeholder="+964 770 000 0000"
                leftSection={<IconPhone size={16} className="text-orange-600" />}
                value={formData.ownerPhone}
                onChange={(e) => setFormData({ ...formData, ownerPhone: e.currentTarget.value })}
              />

              <PasswordInput
                size="sm"
                label="كلمة المرور"
                placeholder="لا تقل عن 6 خانات"
                leftSection={<IconLock size={16} className="text-orange-600" />}
                value={formData.ownerPassword}
                onChange={(e) => setFormData({ ...formData, ownerPassword: e.currentTarget.value })}
                withAsterisk
                required
              />
            </div>

            <div className="flex justify-between pt-3 border-t border-slate-100">
              <Button variant="default" leftSection={<IconArrowRight size={16} />} onClick={() => setActiveStep(1)}>
                السابق
              </Button>
              <Button color="orange" rightSection={<IconArrowLeft size={16} />} onClick={handleNextStep} className="bg-orange-500 font-bold">
                المتابعة إلى تأكيد التفعيل
              </Button>
            </div>
          </Card>
        )}

        {/* ── STEP 3: REVIEW & PROVISIONING ── */}
        {activeStep === 3 && (
          <Card className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-2.5">
              <h3 className="font-black text-sm sm:text-base text-slate-900 flex items-center gap-2">
                <IconFileCertificate size={18} className="text-emerald-600" />
                <span>الخطوة 3: مراجعة البيانات وتأكيد التفعيل</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">سيقوم النظام بإنشاء المؤسسة، الفرع الرئيسي، وشجرة الحسابات فوراً.</p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 space-y-2 text-xs">
              <div className="flex justify-between border-b border-slate-200/70 pb-1.5">
                <span className="text-slate-500 font-bold">المؤسسة والرمز:</span>
                <span className="font-black text-slate-900">{formData.name} ({formData.slug})</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/70 pb-1.5">
                <span className="text-slate-500 font-bold">الباقة المختارة:</span>
                <span className="font-black text-orange-600">
                  {selectedPlan.nameAr} ({formData.planCode === 'FREE_TRIAL' ? '$0 - تجربة 14 يوماً' : formData.planCode === 'ENTERPRISE' ? '$799 / 3 أشهر' : `$${selectedPlan.priceMonthly}/شهر`})
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200/70 pb-1.5">
                <span className="text-slate-500 font-bold">المدير المسؤول:</span>
                <span className="font-bold text-slate-900">{formData.ownerName} ({formData.ownerEmail})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">المدينة والعملات:</span>
                <span className="font-bold text-slate-800">{formData.city} • متعدد العملات (IQD / USD)</span>
              </div>
            </div>

            <div className="flex justify-between pt-3 border-t border-slate-100">
              <Button variant="default" leftSection={<IconArrowRight size={16} />} onClick={() => setActiveStep(2)}>
                السابق
              </Button>
              <Button
                color="orange"
                loading={loadingSubmit}
                rightSection={<IconCheck size={16} />}
                onClick={handleFinalSubmit}
                className="bg-orange-500 font-black shadow-sm"
              >
                تأكيد وبدء الاستخدام الآن
              </Button>
            </div>
          </Card>
        )}

        {/* ── STEP 4: SUCCESS LAUNCH ── */}
        {activeStep === 4 && (
          <Card className="p-8 rounded-3xl bg-white border border-emerald-200 shadow-md text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
              <IconCheck size={32} stroke={3} />
            </div>

            <div className="space-y-1">
              <Title order={3} className="text-xl font-black text-emerald-950">
                تهانينا! تم إنشاء وتفعيل حساب مؤسستك بنجاح
              </Title>
              <Text className="text-xs text-slate-600 max-w-md mx-auto">
                تم تهيئة الفرع الرئيسي، دليل الحسابات السحابي، وحساب المدير العام بنجاح.
              </Text>
            </div>

            <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100 max-w-md mx-auto text-xs text-right space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">اسم المؤسسة:</span>
                <span className="font-bold text-slate-900">{formData.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">البريد الإلكتروني:</span>
                <span className="font-mono text-slate-900">{formData.ownerEmail}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">الباقة:</span>
                <span className="font-bold text-emerald-700">{selectedPlan.nameAr}</span>
              </div>
            </div>

            <div className="pt-2">
              <Button
                size="md"
                color="orange"
                onClick={() => navigate('/login')}
                className="bg-orange-500 font-black px-8 rounded-xl shadow-xs"
              >
                الانتقال إلى صفحة تسجيل الدخول
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default OnboardingPage;
