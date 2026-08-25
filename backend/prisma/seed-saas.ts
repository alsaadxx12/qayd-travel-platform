import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting SaaS Multi-Tenant Migration & Seeding...');

  // 1. Ensure Root Master Tenant exists
  const ROOT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
  let rootTenant = await prisma.tenant.findUnique({
    where: { id: ROOT_TENANT_ID },
  });

  if (!rootTenant) {
    rootTenant = await prisma.tenant.create({
      data: {
        id: ROOT_TENANT_ID,
        name: 'مؤسسة قسطاس المركزية',
        legalName: 'شركة قسطاس للأنظمة المالية والسياحية المحدودة',
        slug: 'qistas-prime',
        phone: '+964 770 000 0000',
        email: 'admin@qistas.iq',
        address: 'شارع الرشيد، بغداد، العراق',
        city: 'بغداد',
        country: 'العراق',
        timezone: 'Asia/Baghdad',
        baseCurrency: 'IQD',
        status: 'ACTIVE',
        isRoot: true,
      },
    });
    console.log(`✅ Root Master Tenant created: ${rootTenant.name} (${rootTenant.id})`);
  } else {
    console.log(`ℹ️ Root Master Tenant already exists: ${rootTenant.name}`);
  }

  // 2. Link all existing records to Root Tenant where tenantId is null
  const updates = await Promise.all([
    prisma.company.updateMany({ where: { tenantId: null }, data: { tenantId: rootTenant.id } }),
    prisma.branch.updateMany({ where: { tenantId: null }, data: { tenantId: rootTenant.id } }),
    prisma.account.updateMany({ where: { tenantId: null }, data: { tenantId: rootTenant.id } }),
    prisma.fiscalYear.updateMany({ where: { tenantId: null }, data: { tenantId: rootTenant.id } }),
    prisma.fiscalPeriod.updateMany({ where: { tenantId: null }, data: { tenantId: rootTenant.id } }),
    prisma.journalEntry.updateMany({ where: { tenantId: null }, data: { tenantId: rootTenant.id } }),
    prisma.receiptVoucher.updateMany({ where: { tenantId: null }, data: { tenantId: rootTenant.id } }),
    prisma.paymentVoucher.updateMany({ where: { tenantId: null }, data: { tenantId: rootTenant.id } }),
    prisma.cashbox.updateMany({ where: { tenantId: null }, data: { tenantId: rootTenant.id } }),
    prisma.bank.updateMany({ where: { tenantId: null }, data: { tenantId: rootTenant.id } }),
    prisma.customer.updateMany({ where: { tenantId: null }, data: { tenantId: rootTenant.id } }),
    prisma.supplier.updateMany({ where: { tenantId: null }, data: { tenantId: rootTenant.id } }),
    prisma.auditLog.updateMany({ where: { tenantId: null }, data: { tenantId: rootTenant.id } }),
    prisma.balanceAuditLog.updateMany({ where: { tenantId: null }, data: { tenantId: rootTenant.id } }),
    prisma.attachment.updateMany({ where: { tenantId: null }, data: { tenantId: rootTenant.id } }),
    prisma.airline.updateMany({ where: { tenantId: null }, data: { tenantId: rootTenant.id } }),
    prisma.department.updateMany({ where: { tenantId: null }, data: { tenantId: rootTenant.id } }),
    prisma.employee.updateMany({ where: { tenantId: null }, data: { tenantId: rootTenant.id } }),
    prisma.ticket.updateMany({ where: { tenantId: null }, data: { tenantId: rootTenant.id } }),
    prisma.printTemplate.updateMany({ where: { tenantId: null }, data: { tenantId: rootTenant.id } }),
  ]);

  console.log(`✅ Data migration completed: Linked existing rows across all 20 business tables to Root Tenant.`);

  // 3. Ensure all existing users have a TenantMembership
  const allUsers = await prisma.user.findMany();
  for (const user of allUsers) {
    const existingMembership = await prisma.tenantMembership.findUnique({
      where: {
        tenantId_userId: {
          tenantId: rootTenant.id,
          userId: user.id,
        },
      },
    });

    if (!existingMembership) {
      await prisma.tenantMembership.create({
        data: {
          tenantId: rootTenant.id,
          userId: user.id,
          role: 'OWNER',
          isPrimary: true,
          isActive: true,
        },
      });
      console.log(`✅ Added membership for user: ${user.name} (${user.email}) -> Root Tenant`);
    }
  }

  // 4. Seed SaaS Plans ($0 Trial, $99, $199, $799)
  const plansData = [
    {
      code: 'FREE_TRIAL',
      nameAr: 'الفترة التجريبية المجانية (14 يوماً)',
      nameEn: 'Free Trial (14 Days)',
      description: 'تجربة شاملة لكافة مزايا النظام والفروع والخدمات بدون أي قيود، مجاناً لمدة 14 يوماً.',
      sortOrder: 0,
      priceMonthlyCents: 0, // $0.00 Free Trial
      isRecommended: false,
      limits: [
        { limitCode: 'MAX_BRANCHES', nameAr: 'عدد الفروع المسموحة', limitValue: -1, unit: 'غير محدود' },
        { limitCode: 'MAX_USERS', nameAr: 'عدد المستخدمين المسموحين', limitValue: -1, unit: 'غير محدود' },
        { limitCode: 'EMAIL_DAILY', nameAr: 'رسائل البريد اليومية', limitValue: 300, unit: 'رسالة/يوم' },
        { limitCode: 'EMAIL_MONTHLY', nameAr: 'رسائل البريد الشهرية', limitValue: -1, unit: 'حسب سعة المزود' },
        { limitCode: 'STORAGE_MB', nameAr: 'مساحة التخزين السحابي', limitValue: 25600, unit: 'ميجابايت' },
      ],
      features: [
        { featureCode: 'ACCOUNTS_JOURNALS', nameAr: 'دليل الحسابات والقيود اليومية', isEnabled: true },
        { featureCode: 'VOUCHERS_CASH_BANK', nameAr: 'سندات القبض والصرف وإدارة الصناديق', isEnabled: true },
        { featureCode: 'TICKETS_BASIC', nameAr: 'إصدار تذاكر الطيران والمسافرين', isEnabled: true },
        { featureCode: 'FINANCIAL_REPORTS_BASIC', nameAr: 'التقارير المالية الأساسية وميزان المراجعة', isEnabled: true },
        { featureCode: 'EMAIL_STATEMENTS', nameAr: 'إرسال كشوفات الحساب عبر البريد', isEnabled: true },
        { featureCode: 'FISCAL_YEARS_BASIC', nameAr: 'إدارة السنوات المالية والتدوير الأساسي', isEnabled: true },
        { featureCode: 'EXTERNAL_CLEARINGS', nameAr: 'التصفيات والمقاصات الخارجية (بورصات ومكاتب)', isEnabled: true },
        { featureCode: 'BRANCH_COMPARISON', nameAr: 'المقارنة المالية بين الفروع', isEnabled: true },
        { featureCode: 'AUDIT_LOGS_EXTENDED', nameAr: 'سجل التدقيق والرقابة المتقدم', isEnabled: true },
        { featureCode: 'CUSTOM_TEMPLATES', nameAr: 'تخصيص قوالب الطباعة والهوية', isEnabled: true },
        { featureCode: 'SUB_CASHBOXES_SETTLEMENT', nameAr: 'مطابقة وتسوية الصناديق الفرعية', isEnabled: true },
        { featureCode: 'VIP_PRIORITY_SUPPORT', nameAr: 'أولوية قصوى للدعم الفني المباشر', isEnabled: true },
      ],
    },
    {
      code: 'BASIC',
      nameAr: 'الباقة الأساسية',
      nameEn: 'Basic Plan',
      description: 'مثالية للمكاتب الفردية والشركات الناشئة التي تحتاج إدارة محاسبية وسياحية مبسطة.',
      sortOrder: 1,
      priceMonthlyCents: 19900, // $199.00
      isRecommended: true,
      limits: [
        { limitCode: 'MAX_BRANCHES', nameAr: 'عدد الفروع المسموحة', limitValue: 1, unit: 'فرع' },
        { limitCode: 'MAX_USERS', nameAr: 'عدد المستخدمين المسموحين', limitValue: 3, unit: 'مستخدم' },
        { limitCode: 'EMAIL_DAILY', nameAr: 'رسائل البريد اليومية', limitValue: 100, unit: 'رسالة/يوم' },
        { limitCode: 'EMAIL_MONTHLY', nameAr: 'رسائل البريد الشهرية', limitValue: 1500, unit: 'رسالة/شهر' },
        { limitCode: 'STORAGE_MB', nameAr: 'مساحة التخزين السحابي', limitValue: 1024, unit: 'ميجابايت' },
      ],
      features: [
        { featureCode: 'ACCOUNTS_JOURNALS', nameAr: 'دليل الحسابات والقيود اليومية', isEnabled: true },
        { featureCode: 'VOUCHERS_CASH_BANK', nameAr: 'سندات القبض والصرف وإدارة الصناديق', isEnabled: true },
        { featureCode: 'TICKETS_BASIC', nameAr: 'إصدار تذاكر الطيران والمسافرين', isEnabled: true },
        { featureCode: 'FINANCIAL_REPORTS_BASIC', nameAr: 'التقارير المالية الأساسية وميزان المراجعة', isEnabled: true },
        { featureCode: 'EMAIL_STATEMENTS', nameAr: 'إرسال كشوفات الحساب عبر البريد', isEnabled: true },
        { featureCode: 'FISCAL_YEARS_BASIC', nameAr: 'إدارة السنوات المالية والتدوير الأساسي', isEnabled: true },
        { featureCode: 'EXTERNAL_CLEARINGS', nameAr: 'التصفيات والمقاصات الخارجية (بورصات ومكاتب)', isEnabled: false },
        { featureCode: 'BRANCH_COMPARISON', nameAr: 'المقارنة المالية بين الفروع', isEnabled: false },
        { featureCode: 'AUDIT_LOGS_EXTENDED', nameAr: 'سجل التدقيق والرقابة المتقدم', isEnabled: false },
      ],
    },
    {
      code: 'PRO',
      nameAr: 'الباقة الاحترافية',
      nameEn: 'Professional Plan',
      description: 'الخيار الأفضل للشركات المتوسطة والوكالات المتنامية التي تمتلك فروعاً ومقاصات خارجية.',
      sortOrder: 2,
      priceMonthlyCents: 19900, // $199.00
      isRecommended: true,
      limits: [
        { limitCode: 'MAX_BRANCHES', nameAr: 'عدد الفروع المسموحة', limitValue: -1, unit: 'غير محدود' },
        { limitCode: 'MAX_USERS', nameAr: 'عدد المستخدمين المسموحين', limitValue: 10, unit: 'مستخدم' },
        { limitCode: 'EMAIL_DAILY', nameAr: 'رسائل البريد اليومية', limitValue: 200, unit: 'رسالة/يوم' },
        { limitCode: 'EMAIL_MONTHLY', nameAr: 'رسائل البريد الشهرية', limitValue: 6000, unit: 'رسالة/شهر' },
        { limitCode: 'STORAGE_MB', nameAr: 'مساحة التخزين السحابي', limitValue: 5120, unit: 'ميجابايت' },
      ],
      features: [
        { featureCode: 'ACCOUNTS_JOURNALS', nameAr: 'دليل الحسابات والقيود اليومية', isEnabled: true },
        { featureCode: 'VOUCHERS_CASH_BANK', nameAr: 'سندات القبض والصرف وإدارة الصناديق', isEnabled: true },
        { featureCode: 'TICKETS_BASIC', nameAr: 'إصدار تذاكر الطيران والمسافرين', isEnabled: true },
        { featureCode: 'FINANCIAL_REPORTS_BASIC', nameAr: 'التقارير المالية الأساسية وميزان المراجعة', isEnabled: true },
        { featureCode: 'EMAIL_STATEMENTS', nameAr: 'إرسال كشوفات الحساب عبر البريد', isEnabled: true },
        { featureCode: 'FISCAL_YEARS_BASIC', nameAr: 'إدارة السنوات المالية والتدوير الأساسي', isEnabled: true },
        { featureCode: 'EXTERNAL_CLEARINGS', nameAr: 'التصفيات والمقاصات الخارجية (بورصات ومكاتب)', isEnabled: true },
        { featureCode: 'BRANCH_COMPARISON', nameAr: 'المقارنة المالية بين الفروع', isEnabled: true },
        { featureCode: 'AUDIT_LOGS_EXTENDED', nameAr: 'سجل التدقيق والرقابة المتقدم', isEnabled: true },
        { featureCode: 'CUSTOM_TEMPLATES', nameAr: 'تخصيص قوالب الطباعة والهوية', isEnabled: true },
        { featureCode: 'SUB_CASHBOXES_SETTLEMENT', nameAr: 'مطابقة وتسوية الصناديق الفرعية', isEnabled: true },
      ],
    },
    {
      code: 'ENTERPRISE',
      nameAr: 'الباقة الشاملة',
      nameEn: 'Enterprise Plan',
      description: 'حل متكامل ومخصص لكبرى الشركات والشبكات السياحية مع دعم فني VIP وسجل رقابة مفتوح.',
      sortOrder: 3,
      priceMonthlyCents: 79900, // $799.00
      isRecommended: false,
      limits: [
        { limitCode: 'MAX_BRANCHES', nameAr: 'عدد الفروع المسموحة', limitValue: -1, unit: 'غير محدود' },
        { limitCode: 'MAX_USERS', nameAr: 'عدد المستخدمين المسموحين', limitValue: -1, unit: 'غير محدود' },
        { limitCode: 'EMAIL_DAILY', nameAr: 'رسائل البريد اليومية', limitValue: 300, unit: 'رسالة/يوم' },
        { limitCode: 'EMAIL_MONTHLY', nameAr: 'رسائل البريد الشهرية', limitValue: -1, unit: 'حسب سعة المزود' },
        { limitCode: 'STORAGE_MB', nameAr: 'مساحة التخزين السحابي', limitValue: 25600, unit: 'ميجابايت' },
      ],
      features: [
        { featureCode: 'ACCOUNTS_JOURNALS', nameAr: 'دليل الحسابات والقيود اليومية', isEnabled: true },
        { featureCode: 'VOUCHERS_CASH_BANK', nameAr: 'سندات القبض والصرف وإدارة الصناديق', isEnabled: true },
        { featureCode: 'TICKETS_BASIC', nameAr: 'إصدار تذاكر الطيران والمسافرين', isEnabled: true },
        { featureCode: 'FINANCIAL_REPORTS_BASIC', nameAr: 'التقارير المالية الأساسية وميزان المراجعة', isEnabled: true },
        { featureCode: 'EMAIL_STATEMENTS', nameAr: 'إرسال كشوفات الحساب عبر البريد', isEnabled: true },
        { featureCode: 'FISCAL_YEARS_BASIC', nameAr: 'إدارة السنوات المالية والتدوير الأساسي', isEnabled: true },
        { featureCode: 'EXTERNAL_CLEARINGS', nameAr: 'التصفيات والمقاصات الخارجية (بورصات ومكاتب)', isEnabled: true },
        { featureCode: 'BRANCH_COMPARISON', nameAr: 'المقارنة المالية بين الفروع', isEnabled: true },
        { featureCode: 'AUDIT_LOGS_EXTENDED', nameAr: 'سجل التدقيق والرقابة المتقدم', isEnabled: true },
        { featureCode: 'CUSTOM_TEMPLATES', nameAr: 'تخصيص قوالب الطباعة والهوية', isEnabled: true },
        { featureCode: 'SUB_CASHBOXES_SETTLEMENT', nameAr: 'مطابقة وتسوية الصناديق الفرعية', isEnabled: true },
        { featureCode: 'VIP_PRIORITY_SUPPORT', nameAr: 'أولوية قصوى للدعم الفني المباشر', isEnabled: true },
        { featureCode: 'API_INTEGRATIONS', nameAr: 'الربط البرمجي وواجهات API', isEnabled: true },
        { featureCode: 'UNLIMITED_AUDIT_TRAIL', nameAr: 'حفظ سجل التدقيق غير المحدود', isEnabled: true },
      ],
    },
  ];

  let enterprisePlanVersionId = '';

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

    if (p.code === 'ENTERPRISE') {
      enterprisePlanVersionId = version.id;
    }

    // Upsert Limits
    for (const lim of p.limits) {
      await prisma.planLimit.upsert({
        where: {
          planVersionId_limitCode: {
            planVersionId: version.id,
            limitCode: lim.limitCode,
          },
        },
        update: {
          nameAr: lim.nameAr,
          limitValue: lim.limitValue,
          unit: lim.unit,
        },
        create: {
          planVersionId: version.id,
          limitCode: lim.limitCode,
          nameAr: lim.nameAr,
          limitValue: lim.limitValue,
          unit: lim.unit,
        },
      });
    }

    // Upsert Features
    for (const feat of p.features) {
      await prisma.planFeature.upsert({
        where: {
          planVersionId_featureCode: {
            planVersionId: version.id,
            featureCode: feat.featureCode,
          },
        },
        update: {
          nameAr: feat.nameAr,
          isEnabled: feat.isEnabled,
        },
        create: {
          planVersionId: version.id,
          featureCode: feat.featureCode,
          nameAr: feat.nameAr,
          isEnabled: feat.isEnabled,
        },
      });
    }

    console.log(`✅ Seeded Plan: ${p.nameAr} ($${p.priceMonthlyCents / 100}/mo) with ${p.features.length} features and ${p.limits.length} limits.`);
  }

  // 5. Ensure Root Tenant has an active ENTERPRISE Subscription
  const existingSub = await prisma.tenantSubscription.findFirst({
    where: { tenantId: rootTenant.id },
  });

  if (!existingSub && enterprisePlanVersionId) {
    const now = new Date();
    const nextYear = new Date();
    nextYear.setFullYear(now.getFullYear() + 10); // Active 10-year root license

    await prisma.tenantSubscription.create({
      data: {
        tenantId: rootTenant.id,
        planVersionId: enterprisePlanVersionId,
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        lockedPriceCents: 79900,
        currency: 'USD',
        startedAt: now,
        currentPeriodStart: now,
        currentPeriodEnd: nextYear,
      },
    });
    console.log(`✅ Root Tenant subscribed to ENTERPRISE plan.`);
  }

  console.log('🎉 SaaS Multi-Tenant Migration & Seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during SaaS migration & seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
