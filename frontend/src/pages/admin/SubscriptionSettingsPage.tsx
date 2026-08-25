import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Progress,
  RingProgress,
  Skeleton,
  Table,
} from '@mantine/core';
import {
  IconBuildingStore,
  IconCalendarDue,
  IconCheck,
  IconClock,
  IconCoins,
  IconCreditCard,
  IconReceipt2,
  IconRefresh,
  IconSend,
  IconShieldCheck,
  IconSparkles,
  IconUsers,
  IconX,
} from '@tabler/icons-react';
import { tenantsApi } from '../../api/tenants';
import { useLanguageStore } from '../../store/useLanguageStore';

type UsageMeter = {
  current?: number;
  limit?: number;
  isUnlimited?: boolean;
};

const getPercent = (meter?: UsageMeter, isRoot?: boolean) => {
  if (isRoot || meter?.isUnlimited) return 100;
  const limit = Number(meter?.limit || 0);
  if (limit <= 0) return 0;
  return Math.min(100, Math.round((Number(meter?.current || 0) / limit) * 100));
};

const getRemaining = (meter?: UsageMeter) =>
  Math.max(0, Number(meter?.limit || 0) - Number(meter?.current || 0));

const getTone = (percent: number) => {
  if (percent >= 90) return { color: 'red', text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' };
  if (percent >= 70) return { color: 'orange', text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' };
  return { color: 'teal', text: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200' };
};

export const SubscriptionSettingsPage: React.FC = () => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  const { data: tenant, isLoading: loadingTenant, refetch: refetchTenant } = useQuery({
    queryKey: ['current-tenant-details'],
    queryFn: tenantsApi.getCurrentTenant,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const { data: usage, isLoading: loadingUsage, refetch: refetchUsage } = useQuery({
    queryKey: ['current-tenant-usage'],
    queryFn: tenantsApi.getCurrentTenantUsage,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const isRoot = tenant?.isRoot === true;
  const sub = tenant?.activeSubscription;
  const plan = sub?.planVersion?.plan;
  const features = sub?.planVersion?.features || [];
  const effectiveUsage = usage || tenant?.usage;
  const hasData = Boolean(tenant || effectiveUsage);
  const isLoading = !hasData && (loadingTenant || loadingUsage);

  const planName = isRoot
    ? (isAr ? 'مالك المنصة' : 'Platform Owner')
    : isAr
    ? plan?.nameAr || tenant?.planName || 'الباقة الحالية'
    : plan?.nameEn || plan?.nameAr || tenant?.planName || 'Current Plan';

  const planPrice = plan?.priceMonthlyCents ? `$${(plan.priceMonthlyCents / 100).toLocaleString('en-US')}` : '—';
  const nextBillingDate = sub?.currentPeriodEnd || sub?.expiresAt || tenant?.subscriptionExpiresAt;
  const activeFeaturesCount = features.filter((f: any) => isRoot || f.isEnabled).length;

  const usageCards = useMemo(() => {
    const branches = effectiveUsage?.branches;
    const users = effectiveUsage?.users;
    const emails = effectiveUsage?.emailsDaily;

    return [
      {
        key: 'branches',
        icon: IconBuildingStore,
        label: isAr ? 'الفروع المستخدمة' : 'Branches',
        sub: isAr ? 'الفروع والكيانات التشغيلية' : 'Operational branches',
        meter: branches,
        unit: isAr ? 'فرع' : 'branches',
      },
      {
        key: 'users',
        icon: IconUsers,
        label: isAr ? 'المستخدمون النشطون' : 'Active Users',
        sub: isAr ? 'حسابات الموظفين والمدراء' : 'Team seats',
        meter: users,
        unit: isAr ? 'مستخدم' : 'users',
      },
      {
        key: 'emails',
        icon: IconSend,
        label: isAr ? 'رسائل البريد اليومية' : 'Daily Emails',
        sub: 'Brevo Transactional SMTP',
        meter: emails,
        unit: isAr ? 'رسالة' : 'emails',
      },
    ];
  }, [effectiveUsage, isAr]);

  const refreshAll = () => {
    refetchTenant();
    refetchUsage();
  };

  return (
    <div 
      className="w-full max-w-[1600px] mx-auto px-4 md:px-6 py-5 space-y-5 pb-14 select-none" 
      dir={direction}
      style={{ fontFamily: isAr ? "'IBM Plex Sans Arabic', system-ui, sans-serif" : "'IBM Plex Sans', system-ui, sans-serif" }}
    >
      <div className="rounded-[28px] border border-slate-200 bg-white shadow-2xs overflow-hidden">
        {/* Top Page Header */}
        <div className="px-5 md:px-6 py-5 bg-gradient-to-l from-orange-50/60 via-white to-slate-50 border-b border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#FFF3E8] border border-orange-200 text-[#F45A0A] flex items-center justify-center shadow-2xs shrink-0">
                <IconCoins size={25} strokeWidth={2.2} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl md:text-2xl font-black text-slate-950 leading-tight">
                    {isAr ? 'الاشتراك والاستهلاك' : 'Subscription & Usage'}
                  </h1>
                  <Badge color="orange" variant="light" radius="xl" className="font-black">
                    {planName}
                  </Badge>
                </div>
                <p className="text-xs md:text-sm text-slate-500 font-bold mt-1">
                  {isRoot
                    ? isAr
                      ? 'وصول كامل إلى المنصة دون باقة أو قيود تشغيلية أو فوترة.'
                      : 'Full platform access without a plan, operational limits, or billing.'
                    : isAr
                      ? 'متابعة حدود الباقة، استهلاك الفريق، المزايا المتاحة، وسجل المدفوعات من مكان واحد.'
                      : 'Monitor plan limits, team usage, enabled features, and billing history in one place.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="default"
                leftSection={<IconRefresh size={15} />}
                onClick={refreshAll}
                loading={loadingTenant || loadingUsage}
                className="h-10 px-4 rounded-xl font-bold border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                {isAr ? 'تحديث' : 'Refresh'}
              </Button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="p-5 grid grid-cols-1 lg:grid-cols-4 gap-4">
            <Skeleton height={190} radius="xl" />
            <Skeleton height={190} radius="xl" />
            <Skeleton height={190} radius="xl" />
            <Skeleton height={190} radius="xl" />
          </div>
        ) : (
          <div className="p-5 md:p-6 space-y-5">
            <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_1.95fr] gap-5">
              {/* Clean White & Brand Orange Plan Summary Card */}
              <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-orange-50/20 to-amber-50/20 p-5 shadow-2xs relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#F45A0A] via-amber-400 to-teal-400" />
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-[11px] text-slate-500 font-black block">
                      {isRoot
                        ? isAr ? 'نوع الحساب' : 'Account Type'
                        : isAr ? 'الباقة الحالية' : 'Current Plan'}
                    </span>
                    <h2 className="text-2xl font-black text-slate-950 mt-1">{planName}</h2>
                    <p className="text-xs text-slate-600 font-bold mt-2 leading-6">
                      {isRoot
                        ? isAr ? 'صلاحيات منصة كاملة بدون حدود تشغيلية.' : 'Full platform access without tenant limits.'
                        : isAr ? 'حدود تشغيلية مفعلة حسب الباقة الحالية.' : 'Operational limits are applied by the current plan.'}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-[#FFF3E8] border border-orange-200 text-[#F45A0A] flex items-center justify-center shrink-0">
                    <IconShieldCheck size={24} strokeWidth={2.2} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-6">
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                    <span className="text-[10px] text-slate-500 font-black block">
                      {isRoot
                        ? isAr ? 'الفوترة' : 'Billing'
                        : isAr ? 'السعر الشهري' : 'Monthly Price'}
                    </span>
                    <span className={`font-black text-slate-950 mt-1 block ${isRoot ? 'text-sm' : 'font-mono text-xl tabular-nums'}`}>
                      {isRoot ? (isAr ? 'غير خاضع للفوترة' : 'Not billable') : planPrice}
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                    <span className="text-[10px] text-slate-500 font-black block">
                      {isAr ? 'الفاتورة القادمة' : 'Next Billing'}
                    </span>
                    <span className="font-mono font-black text-sm text-slate-950 mt-2 block tabular-nums">
                      {nextBillingDate ? new Date(nextBillingDate).toLocaleDateString('en-US') : '—'}
                    </span>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-200 flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-600 flex items-center gap-1.5">
                    <IconCalendarDue size={15} className="text-[#F45A0A]" />
                    {isAr ? 'حالة الاشتراك:' : 'Subscription Status:'}
                  </span>
                  <Badge color={sub?.status === 'ACTIVE' || tenant?.subscriptionStatus === 'ACTIVE' || isRoot ? 'teal' : 'orange'} variant="filled" className="font-black">
                    {isRoot ? (isAr ? 'نشط دائم' : 'Always Active') : sub?.status || tenant?.subscriptionStatus || 'ACTIVE'}
                  </Badge>
                </div>
              </div>

              {/* Usage Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {usageCards.map((item) => {
                  const Icon = item.icon;
                  const percent = getPercent(item.meter, isRoot);
                  const tone = getTone(percent);
                  const unlimited = isRoot || item.meter?.isUnlimited;
                  return (
                    <div key={item.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-10 h-10 rounded-xl ${tone.bg} ${tone.text} border ${tone.border} flex items-center justify-center`}>
                            <Icon size={20} strokeWidth={2.2} />
                          </div>
                          <div>
                            <span className="font-black text-slate-950 text-sm block">{item.label}</span>
                            <span className="font-bold text-slate-500 text-[11px] block mt-0.5">{item.sub}</span>
                          </div>
                        </div>
                        <RingProgress
                          size={66}
                          thickness={7}
                          roundCaps
                          sections={[{ value: percent, color: unlimited ? 'teal' : tone.color }]}
                          label={
                            <span className="font-mono font-black text-[11px] text-slate-900 block text-center tabular-nums">
                              {unlimited ? '∞' : `${percent}%`}
                            </span>
                          }
                        />
                      </div>

                      <div className="mt-4">
                        <div className="flex items-end justify-between gap-2">
                          <span className="font-mono font-black text-2xl text-slate-950 tabular-nums">
                            {item.meter?.current ?? 0}
                            <span className="text-slate-400 font-bold text-base"> / {unlimited ? '∞' : item.meter?.limit ?? 0}</span>
                          </span>
                        </div>
                        <Progress value={percent} color={unlimited ? 'teal' : tone.color} size="sm" radius="xl" mt="sm" />
                        <div className="mt-3 flex items-center justify-between text-[11px] font-bold">
                          <span className="text-slate-500">{isAr ? 'المتبقي' : 'Remaining'}</span>
                          <span className={`font-mono font-black ${unlimited ? 'text-teal-700' : tone.text}`}>
                            {unlimited ? (isAr ? 'غير محدود' : 'Unlimited') : `${getRemaining(item.meter).toLocaleString('en-US')} ${item.unit}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-5">
              {/* Plan Features */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h3 className="font-black text-slate-950 text-sm flex items-center gap-2">
                    <IconSparkles size={18} className="text-[#F45A0A]" />
                    {isRoot
                      ? isAr ? 'صلاحيات المنصة' : 'Platform Access'
                      : isAr ? 'المزايا المتاحة في الباقة' : 'Enabled Plan Features'}
                  </h3>
                  <Badge color="orange" variant="light" radius="xl" className="font-mono font-black tabular-nums">
                    {isRoot ? (isAr ? 'الكل' : 'ALL') : `${activeFeaturesCount} / ${features.length || 0}`}
                  </Badge>
                </div>

                {isRoot ? (
                  <div className="rounded-xl border border-teal-200 bg-teal-50 p-6 text-center">
                    <IconCheck size={22} stroke={3} className="mx-auto text-teal-700 mb-2" />
                    <div className="text-sm font-black text-teal-900">
                      {isAr ? 'جميع مزايا المنصة متاحة' : 'All platform features are available'}
                    </div>
                    <div className="text-xs font-bold text-teal-700 mt-1">
                      {isAr ? 'لا تطبق حدود الباقات على مالك المنصة.' : 'Plan limits do not apply to the platform owner.'}
                    </div>
                  </div>
                ) : features.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs font-bold text-slate-500">
                    {isAr ? 'لا توجد مزايا معرفة لهذه الباقة حالياً.' : 'No features are defined for this plan yet.'}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {features.map((f: any) => {
                      const enabled = isRoot || f.isEnabled;
                      return (
                        <div
                          key={f.id || f.featureCode || f.code}
                          className={`h-12 rounded-xl border px-3 flex items-center gap-2.5 ${
                            enabled
                              ? 'bg-slate-50/70 border-slate-200 text-slate-900'
                              : 'bg-white border-slate-100 text-slate-400'
                          }`}
                        >
                          <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                            enabled ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-slate-50 text-slate-400 border border-slate-200'
                          }`}>
                            {enabled ? <IconCheck size={14} stroke={3} /> : <IconX size={14} stroke={3} />}
                          </span>
                          <span className={`text-xs font-extrabold truncate ${enabled ? '' : 'line-through'}`}>
                            {isAr ? f.nameAr : (f.nameEn || f.nameAr)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Usage Health */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                <h3 className="font-black text-slate-950 text-sm flex items-center gap-2 mb-4">
                  <IconClock size={18} className="text-blue-600" />
                  {isAr ? 'ملخص الاستهلاك' : 'Usage Health'}
                </h3>
                <div className="space-y-3">
                  {usageCards.map((item) => {
                    const percent = getPercent(item.meter, isRoot);
                    const tone = getTone(percent);
                    return (
                      <div key={`health-${item.key}`} className="rounded-xl border border-slate-200 p-3 bg-slate-50/50">
                        <div className="flex items-center justify-between text-xs font-bold mb-2">
                          <span className="text-slate-700">{item.label}</span>
                          <span className={`font-mono font-black tabular-nums ${tone.text}`}>
                            {isRoot || item.meter?.isUnlimited ? '∞' : `${percent}%`}
                          </span>
                        </div>
                        <Progress value={percent} color={isRoot || item.meter?.isUnlimited ? 'teal' : tone.color} size="sm" radius="xl" />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Billing & Payment History */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="font-black text-slate-950 text-sm flex items-center gap-2">
                  <IconReceipt2 size={18} className="text-[#F45A0A]" />
                  {isRoot
                    ? isAr ? 'حالة الفوترة' : 'Billing Status'
                    : isAr ? 'سجل عمليات الدفع والفواتير' : 'Billing & Payment History'}
                </h3>
                <Badge color="gray" variant="light" radius="xl" className="font-mono font-black tabular-nums">
                  {(sub?.payments || []).length}
                </Badge>
              </div>

              {sub?.payments && sub.payments.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <Table className="text-xs">
                    <Table.Thead className="bg-slate-50">
                      <Table.Tr>
                        <Table.Th className="p-3">{isAr ? 'رقم الإيصال' : 'Receipt #'}</Table.Th>
                        <Table.Th className="p-3">{isAr ? 'المبلغ' : 'Amount'}</Table.Th>
                        <Table.Th className="p-3">{isAr ? 'طريقة الدفع' : 'Method'}</Table.Th>
                        <Table.Th className="p-3">{isAr ? 'تاريخ الدفع' : 'Date'}</Table.Th>
                        <Table.Th className="p-3">{isAr ? 'الحالة' : 'Status'}</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {sub.payments.map((p: any) => (
                        <Table.Tr key={p.id}>
                          <Table.Td className="p-3 font-mono font-black tabular-nums">{p.receiptNumber || p.id.slice(0, 8)}</Table.Td>
                          <Table.Td className="p-3 font-mono font-black text-slate-950 tabular-nums">${(p.amountCents / 100).toLocaleString('en-US')}</Table.Td>
                          <Table.Td className="p-3 font-bold text-slate-700">
                            <span className="inline-flex items-center gap-1.5">
                              <IconCreditCard size={14} className="text-slate-400" />
                              {p.paymentMethod || 'MASTERCARD'}
                            </span>
                          </Table.Td>
                          <Table.Td className="p-3 font-mono tabular-nums">{new Date(p.createdAt).toLocaleDateString('en-US')}</Table.Td>
                          <Table.Td className="p-3">
                            <Badge size="xs" color={p.status === 'COMPLETED' ? 'teal' : p.status === 'FAILED' ? 'red' : 'orange'} variant="light" className="font-bold">
                              {p.status}
                            </Badge>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs font-bold text-slate-500">
                  {isRoot
                    ? isAr ? 'مالك المنصة غير خاضع للفواتير أو المدفوعات.' : 'The platform owner is not subject to billing or payments.'
                    : isAr ? 'لا يوجد سجل دفع محفوظ لهذه الباقة.' : 'No payment history is available for this subscription.'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionSettingsPage;
