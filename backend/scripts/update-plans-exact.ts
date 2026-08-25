import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function updatePlansExact() {
  console.log('🚀 Updating Plans with exact requirements...');

  const plansData = [
    {
      code: 'FREE_TRIAL',
      nameAr: 'الفترة التجريبية المجانية',
      nameEn: 'Free Trial',
      description: '0 دولار لمدة 14 يوماً بدون بطاقة ائتمانية. تجربة الوظائف الأساسية للنظام.',
      sortOrder: 1,
      priceMonthlyCents: 0,
      isRecommended: false,
      limits: [
        { limitCode: 'MAX_COMPANIES', nameAr: 'عدد الشركات', limitValue: 1, unit: 'شركة' },
        { limitCode: 'MAX_BRANCHES', nameAr: 'عدد الفروع المسموحة', limitValue: 1, unit: 'فرع' },
        { limitCode: 'MAX_USERS', nameAr: 'عدد المستخدمين المسموحين', limitValue: 3, unit: 'مستخدم' },
        { limitCode: 'EMAIL_DAILY', nameAr: 'رسائل البريد الإلكتروني', limitValue: 15, unit: '15 رسالة' },
      ],
      features: [
        { featureCode: 'CHART_OF_ACCOUNTS', nameAr: 'دليل الحسابات والقيود اليومية', category: 'ACCOUNTING', isEnabled: true },
        { featureCode: 'VOUCHERS', nameAr: 'سندات القبض والصرف وإدارة الصناديق', category: 'ACCOUNTING', isEnabled: true },
        { featureCode: 'FLIGHT_TICKETS', nameAr: 'إصدار تذاكر الطيران والمسافرين', category: 'TRAVEL', isEnabled: true },
        { featureCode: 'FINANCIAL_REPORTS', nameAr: 'التقارير المالية الأساسية وميزان المراجعة', category: 'REPORTS', isEnabled: true },
        { featureCode: 'ACCOUNT_STATEMENTS', nameAr: 'كشوفات الحساب وتصدير PDF وExcel', category: 'REPORTS', isEnabled: true },
        { featureCode: 'FISCAL_YEARS_BASIC', nameAr: 'إدارة السنوات المالية والتدوير', category: 'ACCOUNTING', isEnabled: true },
      ],
    },
    {
      code: 'BASIC',
      nameAr: 'الباقة الأساسية',
      nameEn: 'Basic Plan',
      description: 'مناسبة للمكاتب والشركات الصغيرة التي تحتاج نظاماً محاسبياً وسياحياً متكاملاً.',
      sortOrder: 2,
      priceMonthlyCents: 9900, // $99.00 / month
      isRecommended: false,
      limits: [
        { limitCode: 'MAX_COMPANIES', nameAr: 'عدد الشركات', limitValue: 1, unit: 'شركة' },
        { limitCode: 'MAX_BRANCHES', nameAr: 'عدد الفروع المسموحة', limitValue: 1, unit: 'فرع' },
        { limitCode: 'MAX_USERS', nameAr: 'عدد المستخدمين المسموحين', limitValue: 5, unit: 'مستخدم' },
        { limitCode: 'EMAIL_DAILY', nameAr: 'رسائل البريد اليومية', limitValue: 50, unit: '50 رسالة/يوم' },
      ],
      features: [
        { featureCode: 'CHART_OF_ACCOUNTS', nameAr: 'دليل الحسابات والقيود اليومية', category: 'ACCOUNTING', isEnabled: true },
        { featureCode: 'VOUCHERS', nameAr: 'سندات القبض والصرف وإدارة الصناديق', category: 'ACCOUNTING', isEnabled: true },
        { featureCode: 'FLIGHT_TICKETS', nameAr: 'إصدار تذاكر الطيران والمسافرين', category: 'TRAVEL', isEnabled: true },
        { featureCode: 'FINANCIAL_REPORTS', nameAr: 'التقارير المالية وميزان المراجعة', category: 'REPORTS', isEnabled: true },
        { featureCode: 'ACCOUNT_STATEMENTS', nameAr: 'كشوفات الحساب وتصدير PDF وExcel', category: 'REPORTS', isEnabled: true },
        { featureCode: 'FISCAL_YEARS_BASIC', nameAr: 'إدارة السنوات المالية والتدوير', category: 'ACCOUNTING', isEnabled: true },
      ],
    },
    {
      code: 'PRO',
      nameAr: 'الباقة الاحترافية',
      nameEn: 'Professional Plan',
      description: 'الخيار الأفضل للشركات المتوسطة والوكالات ذات الفروع المتعددة والمقاصات الخارجية.',
      sortOrder: 3,
      priceMonthlyCents: 19900, // $199.00 every 3 months
      isRecommended: true, // "الأكثر طلباً وموصى بها"
      limits: [
        { limitCode: 'MAX_COMPANIES', nameAr: 'عدد الشركات', limitValue: 2, unit: '2 شركات' },
        { limitCode: 'MAX_BRANCHES', nameAr: 'عدد الفروع المسموحة', limitValue: -1, unit: 'فروع مفتوحة' },
        { limitCode: 'MAX_USERS', nameAr: 'عدد المستخدمين المسموحين', limitValue: 25, unit: 'مستخدم' },
        { limitCode: 'EMAIL_DAILY', nameAr: 'رسائل البريد اليومية', limitValue: 100, unit: '100 رسالة/يوم' },
      ],
      features: [
        { featureCode: 'CHART_OF_ACCOUNTS', nameAr: 'دليل الحسابات والقيود اليومية', category: 'ACCOUNTING', isEnabled: true },
        { featureCode: 'MULTI_BRANCHES', nameAr: 'إدارة متعددة الفروع كاملة', category: 'BRANCHES', isEnabled: true },
        { featureCode: 'BRANCH_TRANSFERS', nameAr: 'نقل العمليات والأرصدة بين الفروع', category: 'BRANCHES', isEnabled: true },
        { featureCode: 'CONSOLIDATED_REPORTS', nameAr: 'تقارير منفصلة ومجمعة للفروع', category: 'REPORTS', isEnabled: true },
        { featureCode: 'ADVANCED_PERMISSIONS', nameAr: 'صلاحيات متقدمة ومجموعات مخصصة', category: 'SECURITY', isEnabled: true },
        { featureCode: 'APPROVAL_WORKFLOWS', nameAr: 'دورات الموافقات وسجل تدقيق متقدم', category: 'SECURITY', isEnabled: true },
        { featureCode: 'COST_CENTERS', nameAr: 'مراكز التكلفة والتصفيات الخارجية', category: 'ACCOUNTING', isEnabled: true },
        { featureCode: 'FLIGHT_TICKETS', nameAr: 'تذاكر الطيران والتأشيرات والفنادق', category: 'TRAVEL', isEnabled: true },
      ],
    },
    {
      code: 'ENTERPRISE',
      nameAr: 'الباقة الشاملة',
      nameEn: 'Enterprise Plan',
      description: 'حل متكامل ومخصص لكبرى الشركات والشبكات السياحية مع ربط برمجي ودعم فني عالي الأولوية.',
      sortOrder: 4,
      priceMonthlyCents: 79900, // $799.00 every 3 months
      isRecommended: false,
      limits: [
        { limitCode: 'MAX_COMPANIES', nameAr: 'عدد الشركات', limitValue: -1, unit: 'متعدد الشركات' },
        { limitCode: 'MAX_BRANCHES', nameAr: 'عدد الفروع المسموحة', limitValue: -1, unit: 'غير محدود' },
        { limitCode: 'MAX_USERS', nameAr: 'عدد المستخدمين المسموحين', limitValue: -1, unit: 'غير محدود' },
        { limitCode: 'EMAIL_DAILY', nameAr: 'رسائل البريد اليومية', limitValue: -1, unit: 'مفتوحة (غير محدود)' },
      ],
      features: [
        { featureCode: 'MULTI_COMPANIES', nameAr: 'إدارة عدة شركات وقوائم مالية موحدة', category: 'BRANCHES', isEnabled: true },
        { featureCode: 'MULTI_BRANCHES', nameAr: 'فروع ومستخدمين غير محدودين', category: 'BRANCHES', isEnabled: true },
        { featureCode: 'API_WEBHOOKS', nameAr: 'API كامل وWebhooks لربط الأنظمة', category: 'INTEGRATIONS', isEnabled: true },
        { featureCode: 'SSO_CUSTOM_DOMAIN', nameAr: 'تسجيل دخول موحد SSO ونطاق مخصص', category: 'INTEGRATIONS', isEnabled: true },
        { featureCode: 'ADVANCED_SECURITY', nameAr: 'سجل تدقيق شامل وقيود أمان متقدمة', category: 'SECURITY', isEnabled: true },
        { featureCode: 'DEDICATED_SUPPORT', nameAr: 'مدير حساب مخصص واتفاقية SLA', category: 'SUPPORT', isEnabled: true },
      ],
    },
  ];

  for (const p of plansData) {
    const plan = await prisma.plan.upsert({
      where: { code: p.code },
      update: {
        nameAr: p.nameAr,
        nameEn: p.nameEn,
        description: p.description,
        sortOrder: p.sortOrder,
      },
      create: {
        code: p.code,
        nameAr: p.nameAr,
        nameEn: p.nameEn,
        description: p.description,
        sortOrder: p.sortOrder,
      },
    });

    let version = await prisma.planVersion.findFirst({
      where: { planId: plan.id, isActive: true },
    });

    if (!version) {
      version = await prisma.planVersion.create({
        data: {
          planId: plan.id,
          versionNumber: 1,
          priceMonthlyCents: p.priceMonthlyCents,
          currency: 'USD',
          isRecommended: p.isRecommended,
          isActive: true,
        },
      });
    } else {
      await prisma.planVersion.update({
        where: { id: version.id },
        data: {
          priceMonthlyCents: p.priceMonthlyCents,
          isRecommended: p.isRecommended,
        },
      });
    }

    // Replace limits
    await prisma.planLimit.deleteMany({ where: { planVersionId: version.id } });
    for (const lim of p.limits) {
      await prisma.planLimit.create({
        data: {
          planVersionId: version.id,
          limitCode: lim.limitCode,
          nameAr: lim.nameAr,
          limitValue: lim.limitValue,
          unit: lim.unit,
        },
      });
    }

    // Replace features
    await prisma.planFeature.deleteMany({ where: { planVersionId: version.id } });
    for (const feat of p.features) {
      await prisma.planFeature.create({
        data: {
          planVersionId: version.id,
          featureCode: feat.featureCode,
          nameAr: feat.nameAr,
          category: feat.category,
          isEnabled: feat.isEnabled,
        },
      });
    }

    console.log(`✅ Plan ${p.code} (${p.nameAr}): Price $${p.priceMonthlyCents / 100}, isRecommended: ${p.isRecommended}`);
  }

  console.log('🎉 Updated plans successfully!');
}

if (require.main === module) {
  updatePlansExact()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
