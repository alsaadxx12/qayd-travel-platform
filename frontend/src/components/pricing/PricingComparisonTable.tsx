import React from 'react';
import { Table, Badge } from '@mantine/core';
import { IconCheck, IconMinus, IconSparkles } from '@tabler/icons-react';
import { PublicPlan } from '../../api/subscriptions';

interface PricingComparisonTableProps {
  plans: PublicPlan[];
  onSelectPlan?: (planCode: string) => void;
  lang?: 'ar' | 'en';
}

const CATEGORY_TITLES_AR: Record<string, string> = {
  ACCOUNTING: '2. المحاسبة والعمليات المالية',
  TRAVEL: '3. السياحة وتذاكر الطيران',
  BRANCHES: '4. الفروع والتعدد المحاسبي',
  SECURITY: '5. الصلاحيات والأمان والرقابة',
  REPORTS: '6. التقارير والتحليلات المالية',
  STORAGE: '7. التخزين والنسخ الاحتياطي',
  INTEGRATIONS: '8. الربط البرمجي والدعم الفني',
};

const CATEGORY_TITLES_EN: Record<string, string> = {
  ACCOUNTING: '2. Accounting & Financial Operations',
  TRAVEL: '3. Travel, Tourism & Flight Tickets',
  BRANCHES: '4. Multi-Branch & Multi-Entity Management',
  SECURITY: '5. Permissions, Security & Audit Trail',
  REPORTS: '6. Financial Reports & Analytics',
  STORAGE: '7. Cloud Storage & Automated Backups',
  INTEGRATIONS: '8. API Integrations & Dedicated Support',
};

const CATEGORY_ORDER = ['ACCOUNTING', 'TRAVEL', 'BRANCHES', 'SECURITY', 'REPORTS', 'STORAGE', 'INTEGRATIONS'];

export const PricingComparisonTable: React.FC<PricingComparisonTableProps> = ({
  plans,
  onSelectPlan,
  lang = 'ar',
}) => {
  const isAr = lang === 'ar';
  const categoryTitles = isAr ? CATEGORY_TITLES_AR : CATEGORY_TITLES_EN;

  const trialPlan = plans.find((p) => p.code === 'FREE_TRIAL');
  const basicPlan = plans.find((p) => p.code === 'BASIC');
  const proPlan = plans.find((p) => p.code === 'PRO');
  const enterprisePlan = plans.find((p) => p.code === 'ENTERPRISE');

  // Dynamic limits helper with full bilingual unit translation
  const getLimitText = (plan: PublicPlan | undefined, limitCode: string, fallbackAr: string, fallbackEn: string) => {
    if (!plan) return isAr ? fallbackAr : fallbackEn;
    const lim = plan.limits?.find((l) => l.limitCode === limitCode);
    if (!lim) return isAr ? fallbackAr : fallbackEn;
    if (lim.limitValue === -1) return isAr ? 'غير محدود' : 'Unlimited';

    if (isAr) {
      return `${lim.limitValue} ${lim.unit || ''}`.trim();
    } else {
      let unitEn = '';
      if (limitCode === 'MAX_BRANCHES') {
        unitEn = lim.limitValue === 1 ? 'Branch' : 'Branches';
      } else if (limitCode === 'MAX_USERS') {
        unitEn = lim.limitValue === 1 ? 'User' : 'Users';
      } else if (limitCode === 'EMAIL_DAILY') {
        unitEn = lim.limitValue === 1 ? 'Email/Day' : 'Emails/Day';
      } else {
        unitEn = lim.unit || '';
      }
      return `${lim.limitValue} ${unitEn}`.trim();
    }
  };

  // Build dynamic feature list by category
  const featureMap = new Map<string, { code: string; nameAr: string; nameEn?: string; category: string }>();

  // Collect all unique features in order
  plans.forEach((p) => {
    p.features?.forEach((f) => {
      if (!featureMap.has(f.featureCode)) {
        featureMap.set(f.featureCode, {
          code: f.featureCode,
          nameAr: f.nameAr,
          nameEn: f.nameEn || f.featureCode.replace(/_/g, ' ').toLowerCase(),
          category: f.category || 'ACCOUNTING',
        });
      }
    });
  });

  const allFeatures = Array.from(featureMap.values());

  const renderCellContent = (value: string | boolean) => {
    if (typeof value === 'string') {
      return <span className="font-bold text-slate-800 text-[11px] font-sans">{value}</span>;
    }
    if (value === true) {
      return (
        <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-2xs">
          <IconCheck size={12} stroke={3} />
        </div>
      );
    }
    return (
      <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
        <IconMinus size={12} stroke={2.5} />
      </div>
    );
  };

  return (
    <div className="mt-10 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden font-sans" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Table Header Banner */}
      <div className="p-5 sm:p-6 bg-slate-900 text-white text-center space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold border border-orange-500/30">
          <IconSparkles size={13} />
          <span>{isAr ? 'المقارنة الشاملة والمفصلة' : 'Comprehensive Feature Comparison'}</span>
        </div>
        <h3 className="text-lg sm:text-xl font-black text-white">
          {isAr ? 'جدول مقارنة جميع المزايا والحدود بين الباقات' : 'Complete Plan Features & Limits Breakdown'}
        </h3>
        <p className="text-xs text-slate-400 max-w-xl mx-auto">
          {isAr
            ? 'نظرة تفصيلية دقيقة على سعة كل باقة، الصلاحيات، التقارير، والقدرات التشغيلية المطبقة برمجياً.'
            : 'Detailed inspection of capacities, permissions, reports, and cloud quotas enforced in code.'}
        </p>
      </div>

      <div className="overflow-x-auto">
        <Table className={`text-xs ${isAr ? 'text-right' : 'text-left'} border-collapse`}>
          {/* Header Row: Plan Names & Prices */}
          <Table.Thead className="bg-slate-50/90 border-b border-slate-200">
            <Table.Tr className={`divide-x ${isAr ? 'divide-x-reverse' : ''} divide-slate-200`}>
              <Table.Th className="p-4 w-[28%] text-slate-900 font-black text-xs">
                {isAr ? 'الميزة / الخاصية' : 'Feature / Limit'}
              </Table.Th>

              {/* Free Trial */}
              <Table.Th className="p-3 w-[18%] text-center">
                <div className="font-black text-slate-900 text-xs">{isAr ? 'الفترة التجريبية' : 'Free Trial'}</div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">{isAr ? '$0 / 14 يوماً' : '$0 / 14 Days'}</div>
              </Table.Th>

              {/* Basic */}
              <Table.Th className="p-3 w-[18%] text-center">
                <div className="font-black text-slate-900 text-xs">{isAr ? 'الباقة الأساسية' : 'Basic Plan'}</div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">${basicPlan?.priceMonthly || 99} {isAr ? '/ شهرياً' : '/ month'}</div>
              </Table.Th>

              {/* Pro */}
              <Table.Th className="p-3 w-[18%] text-center bg-orange-50/40 relative">
                <div className="flex items-center justify-center gap-1">
                  <span className="font-black text-orange-950 text-xs">{isAr ? 'الباقة الاحترافية' : 'Professional Plan'}</span>
                  <Badge size="xs" color="orange" variant="filled" className="text-[8.5px] font-black px-1.5 py-0">
                    {isAr ? 'الأكثر اختياراً' : 'Most Popular'}
                  </Badge>
                </div>
                <div className="text-[10px] text-orange-700 font-mono font-bold mt-0.5">
                  ${proPlan?.priceMonthly || 199} {isAr ? '/ كل 3 أشهر' : '/ 3 months'}
                </div>
              </Table.Th>

              {/* Enterprise */}
              <Table.Th className="p-3 w-[18%] text-center">
                <div className="font-black text-slate-900 text-xs">{isAr ? 'الباقة الشاملة' : 'Enterprise Plan'}</div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                  ${enterprisePlan?.priceMonthly || 799} {isAr ? '/ كل 3 أشهر' : '/ 3 months'}
                </div>
              </Table.Th>
            </Table.Tr>
          </Table.Thead>

          <Table.Tbody className="divide-y divide-slate-100">
            {/* ── 1. Operational Limits ── */}
            <Table.Tr className="bg-slate-100/80">
              <Table.Td colSpan={5} className="py-2.5 px-4 font-black text-xs text-slate-900">
                {isAr ? '1. الحدود والسعة التشغيلية' : '1. Operational Capacity & Limits'}
              </Table.Td>
            </Table.Tr>

            <Table.Tr className={`hover:bg-slate-50/50 divide-x ${isAr ? 'divide-x-reverse' : ''} divide-slate-100`}>
              <Table.Td className="py-2.5 px-4 font-medium text-slate-700">{isAr ? 'عدد الفروع المسموحة' : 'Allowed Branches'}</Table.Td>
              <Table.Td className="text-center py-2.5">{renderCellContent(getLimitText(trialPlan, 'MAX_BRANCHES', '1 فرع', '1 Branch'))}</Table.Td>
              <Table.Td className="text-center py-2.5">{renderCellContent(getLimitText(basicPlan, 'MAX_BRANCHES', '1 فرع', '1 Branch'))}</Table.Td>
              <Table.Td className="text-center py-2.5 bg-orange-50/20">{renderCellContent(getLimitText(proPlan, 'MAX_BRANCHES', 'فروع مفتوحة (غير محدود)', 'Unlimited Branches'))}</Table.Td>
              <Table.Td className="text-center py-2.5">{renderCellContent(getLimitText(enterprisePlan, 'MAX_BRANCHES', 'غير محدود', 'Unlimited'))}</Table.Td>
            </Table.Tr>

            <Table.Tr className={`hover:bg-slate-50/50 divide-x ${isAr ? 'divide-x-reverse' : ''} divide-slate-100`}>
              <Table.Td className="py-2.5 px-4 font-medium text-slate-700">{isAr ? 'عدد المستخدمين النشطين' : 'Active Users'}</Table.Td>
              <Table.Td className="text-center py-2.5">{renderCellContent(getLimitText(trialPlan, 'MAX_USERS', '3 مستخدمين', '3 Users'))}</Table.Td>
              <Table.Td className="text-center py-2.5">{renderCellContent(getLimitText(basicPlan, 'MAX_USERS', '5 مستخدمين', '5 Users'))}</Table.Td>
              <Table.Td className="text-center py-2.5 bg-orange-50/20">{renderCellContent(getLimitText(proPlan, 'MAX_USERS', '25 مستخدماً', '25 Users'))}</Table.Td>
              <Table.Td className="text-center py-2.5">{renderCellContent(getLimitText(enterprisePlan, 'MAX_USERS', 'غير محدود', 'Unlimited'))}</Table.Td>
            </Table.Tr>

            <Table.Tr className={`hover:bg-slate-50/50 divide-x ${isAr ? 'divide-x-reverse' : ''} divide-slate-100`}>
              <Table.Td className="py-2.5 px-4 font-medium text-slate-700">{isAr ? 'رسائل البريد الإلكتروني' : 'Daily Emails'}</Table.Td>
              <Table.Td className="text-center py-2.5">{renderCellContent(getLimitText(trialPlan, 'EMAIL_DAILY', '15 رسالة', '15 Emails/day'))}</Table.Td>
              <Table.Td className="text-center py-2.5">{renderCellContent(getLimitText(basicPlan, 'EMAIL_DAILY', '50 رسالة / يوم', '50 Emails/day'))}</Table.Td>
              <Table.Td className="text-center py-2.5 bg-orange-50/20">{renderCellContent(getLimitText(proPlan, 'EMAIL_DAILY', '100 رسالة / يوم', '100 Emails/day'))}</Table.Td>
              <Table.Td className="text-center py-2.5">{renderCellContent(getLimitText(enterprisePlan, 'EMAIL_DAILY', 'مفتوحة (غير محدود)', 'Unlimited'))}</Table.Td>
            </Table.Tr>

            {/* ── 2 to 8. Categories & Features (Dynamically from DB) ── */}
            {CATEGORY_ORDER.map((catKey) => {
              const catFeatures = allFeatures.filter((f) => f.category === catKey);
              if (catFeatures.length === 0) return null;

              return (
                <React.Fragment key={catKey}>
                  <Table.Tr className="bg-slate-100/80">
                    <Table.Td colSpan={5} className="py-2.5 px-4 font-black text-xs text-slate-900">
                      {categoryTitles[catKey] || catKey}
                    </Table.Td>
                  </Table.Tr>

                  {catFeatures.map((feat) => {
                    const isTrial = trialPlan?.features?.find((f) => f.featureCode === feat.code)?.isEnabled ?? false;
                    const isBasic = basicPlan?.features?.find((f) => f.featureCode === feat.code)?.isEnabled ?? false;
                    const isPro = proPlan?.features?.find((f) => f.featureCode === feat.code)?.isEnabled ?? false;
                    const isEnterprise = enterprisePlan?.features?.find((f) => f.featureCode === feat.code)?.isEnabled ?? true;

                    return (
                      <Table.Tr key={feat.code} className={`hover:bg-slate-50/50 divide-x ${isAr ? 'divide-x-reverse' : ''} divide-slate-100`}>
                        <Table.Td className="py-2.5 px-4 font-medium text-slate-700">
                          {isAr ? feat.nameAr : (feat.nameEn || feat.nameAr)}
                        </Table.Td>
                        <Table.Td className="text-center py-2.5">{renderCellContent(isTrial)}</Table.Td>
                        <Table.Td className="text-center py-2.5">{renderCellContent(isBasic)}</Table.Td>
                        <Table.Td className="text-center py-2.5 bg-orange-50/20">{renderCellContent(isPro)}</Table.Td>
                        <Table.Td className="text-center py-2.5">{renderCellContent(isEnterprise)}</Table.Td>
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
  );
};

export default PricingComparisonTable;
