import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedEnterpriseSaasPlans() {
  console.log('🚀 Seeding/Updating Enterprise SaaS Subscription Plans in DB...');

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
        { limitCode: 'EMAIL_DAILY', nameAr: 'رسائل البريد اليومية', limitValue: 30, unit: 'رسالة/يوم' },
        { limitCode: 'EMAIL_MONTHLY', nameAr: 'إجمالي رسائل التجربة', limitValue: 300, unit: 'رسالة' },
        { limitCode: 'STORAGE_MB', nameAr: 'مساحة التخزين السحابي', limitValue: 1024, unit: 'ميجابايت (1 GB)' },
        { limitCode: 'BACKUP_RETENTION_DAYS', nameAr: 'فترة حفظ البيانات بعد الانتهاء', limitValue: 30, unit: 'يوم' },
      ],
      features: [
        // Accounting
        { featureCode: 'CHART_OF_ACCOUNTS', nameAr: 'دليل الحسابات المتكامل', category: 'ACCOUNTING', isEnabled: true },
        { featureCode: 'JOURNAL_ENTRIES', nameAr: 'القيود اليومية والترحيل', category: 'ACCOUNTING', isEnabled: true },
        { featureCode: 'VOUCHERS', nameAr: 'سندات القبض والدفع والصرافة والقيد', category: 'ACCOUNTING', isEnabled: true },
        { featureCode: 'CASHBOXES_BANKS', nameAr: 'إدارة الصناديق والحسابات البنكية', category: 'ACCOUNTING', isEnabled: true },
        { featureCode: 'CUSTOMERS_SUPPLIERS', nameAr: 'إدارة العملاء والموردين والشركات', category: 'ACCOUNTING', isEnabled: true },
        { featureCode: 'CURRENCIES_RATES', nameAr: 'تعدد العملات وأسعار الصرف اليومية', category: 'ACCOUNTING', isEnabled: true },
        { featureCode: 'FINANCIAL_REPORTS', nameAr: 'التقارير المالية وميزان المراجعة والأرباح', category: 'REPORTS', isEnabled: true },
        { featureCode: 'ACCOUNT_STATEMENTS', nameAr: 'كشوفات الحساب التفصيلية والتصدير', category: 'REPORTS', isEnabled: true },
        { featureCode: 'FISCAL_YEARS_BASIC', nameAr: 'إدارة وتدوير السنوات المالية', category: 'ACCOUNTING', isEnabled: true },
        // Tourism
        { featureCode: 'FLIGHT_TICKETS', nameAr: 'تذاكر الطيران والمسافرين', category: 'TRAVEL', isEnabled: true },
        { featureCode: 'VISAS_HOTELS_GROUPS', nameAr: 'التأشيرات والفنادق والمجموعات السياحية', category: 'TRAVEL', isEnabled: true },
        { featureCode: 'REFUNDS_REISSUES', nameAr: 'استرجاع وتعديل التذاكر', category: 'TRAVEL', isEnabled: true },
        // Pro & Enterprise Features (Disabled)
        { featureCode: 'MULTI_BRANCHES', nameAr: 'تعدد الفروع والربط المركزي', category: 'BRANCHES', isEnabled: false },
        { featureCode: 'BRANCH_TRANSFERS', nameAr: 'نقل العمليات والأرصدة بين الفروع', category: 'BRANCHES', isEnabled: false },
        { featureCode: 'CONSOLIDATED_REPORTS', nameAr: 'التقارير المجمعة للفروع', category: 'REPORTS', isEnabled: false },
        { featureCode: 'ADVANCED_PERMISSIONS', nameAr: 'صلاحيات متقدمة حسب الفرع والإجراء', category: 'SECURITY', isEnabled: false },
        { featureCode: 'APPROVAL_WORKFLOWS', nameAr: 'دورات الاعتماد والموافقة متعددة المراحل', category: 'SECURITY', isEnabled: false },
        { featureCode: 'ADVANCED_AUDIT_LOG', nameAr: 'سجل التدقيق والرقابة المتقدم الشامل', category: 'SECURITY', isEnabled: false },
        { featureCode: 'COST_CENTERS', nameAr: 'مراكز التكلفة والمشاريع', category: 'ACCOUNTING', isEnabled: false },
        { featureCode: 'SCHEDULED_REPORTS', nameAr: 'جدولة وإرسال التقارير آلياً', category: 'REPORTS', isEnabled: false },
        { featureCode: 'API_WEBHOOKS', nameAr: 'الربط البرمجي الكامل API & Webhooks', category: 'INTEGRATIONS', isEnabled: false },
        { featureCode: 'SSO_CUSTOM_DOMAIN', nameAr: 'تسجيل الدخول الموحد SSO والنطاق المخصص', category: 'INTEGRATIONS', isEnabled: false },
      ],
    },
    {
      code: 'BASIC',
      nameAr: 'الباقة الأساسية',
      nameEn: 'Basic Plan',
      description: 'مناسبة للمكاتب والشركات الصغيرة التي تحتاج نظاماً محاسبياً وسياحياً متكاملاً.',
      sortOrder: 2,
      priceMonthlyCents: 9900, // $99.00
      isRecommended: false,
      limits: [
        { limitCode: 'MAX_COMPANIES', nameAr: 'عدد الشركات', limitValue: 1, unit: 'شركة' },
        { limitCode: 'MAX_BRANCHES', nameAr: 'عدد الفروع المسموحة', limitValue: 1, unit: 'فرع' },
        { limitCode: 'MAX_USERS', nameAr: 'عدد المستخدمين المسموحين', limitValue: 5, unit: 'مستخدم' },
        { limitCode: 'EMAIL_DAILY', nameAr: 'رسائل البريد اليومية', limitValue: 100, unit: 'رسالة/يوم' },
        { limitCode: 'EMAIL_MONTHLY', nameAr: 'رسائل البريد الشهرية', limitValue: 3000, unit: 'رسالة/شهر' },
        { limitCode: 'STORAGE_MB', nameAr: 'مساحة التخزين السحابي', limitValue: 5120, unit: 'ميجابايت (5 GB)' },
        { limitCode: 'BACKUP_RETENTION_DAYS', nameAr: 'الاحتفاظ بالنسخ الاحتياطية', limitValue: 30, unit: 'يوم' },
      ],
      features: [
        // Accounting
        { featureCode: 'CHART_OF_ACCOUNTS', nameAr: 'دليل الحسابات والقيود اليومية', category: 'ACCOUNTING', isEnabled: true },
        { featureCode: 'JOURNAL_ENTRIES', nameAr: 'القيود المحاسبية الآلية واليدوية', category: 'ACCOUNTING', isEnabled: true },
        { featureCode: 'VOUCHERS', nameAr: 'سندات القبض والدفع والصرافة والقيد', category: 'ACCOUNTING', isEnabled: true },
        { featureCode: 'CASHBOXES_BANKS', nameAr: 'إدارة الصناديق والحسابات البنكية', category: 'ACCOUNTING', isEnabled: true },
        { featureCode: 'CUSTOMERS_SUPPLIERS', nameAr: 'إدارة العملاء والموردين والشركات', category: 'ACCOUNTING', isEnabled: true },
        { featureCode: 'CURRENCIES_RATES', nameAr: 'تعدد العملات وأسعار الصرف اليومية', category: 'ACCOUNTING', isEnabled: true },
        { featureCode: 'FINANCIAL_REPORTS', nameAr: 'التقارير المالية الأساسية وميزان المراجعة', category: 'REPORTS', isEnabled: true },
        { featureCode: 'ACCOUNT_STATEMENTS', nameAr: 'كشوفات الحساب وتصدير PDF وExcel', category: 'REPORTS', isEnabled: true },
        { featureCode: 'FISCAL_YEARS_BASIC', nameAr: 'إدارة السنوات المالية والتدوير', category: 'ACCOUNTING', isEnabled: true },
        // Tourism
        { featureCode: 'FLIGHT_TICKETS', nameAr: 'تذاكر الطيران والمسافرين', category: 'TRAVEL', isEnabled: true },
        { featureCode: 'VISAS_HOTELS_GROUPS', nameAr: 'التأشيرات والفنادق والمجموعات السياحية', category: 'TRAVEL', isEnabled: true },
        { featureCode: 'REFUNDS_REISSUES', nameAr: 'استرجاع وتعديل التذاكر', category: 'TRAVEL', isEnabled: true },
        // Pro & Enterprise Features (Disabled)
        { featureCode: 'MULTI_BRANCHES', nameAr: 'تعدد الفروع والربط المالي', category: 'BRANCHES', isEnabled: false },
        { featureCode: 'BRANCH_TRANSFERS', nameAr: 'نقل العمليات والأرصدة بين الفروع', category: 'BRANCHES', isEnabled: false },
        { featureCode: 'CONSOLIDATED_REPORTS', nameAr: 'التقارير المجمعة للفروع', category: 'REPORTS', isEnabled: false },
        { featureCode: 'ADVANCED_PERMISSIONS', nameAr: 'صلاحيات متقدمة حسب الفرع والإجراء', category: 'SECURITY', isEnabled: false },
        { featureCode: 'APPROVAL_WORKFLOWS', nameAr: 'دورات الاعتماد والموافقة', category: 'SECURITY', isEnabled: false },
        { featureCode: 'ADVANCED_AUDIT_LOG', nameAr: 'سجل التدقيق المتقدم', category: 'SECURITY', isEnabled: false },
        { featureCode: 'COST_CENTERS', nameAr: 'مراكز التكلفة والمشاريع', category: 'ACCOUNTING', isEnabled: false },
        { featureCode: 'SCHEDULED_REPORTS', nameAr: 'جدولة وإرسال التقارير بالبريد', category: 'REPORTS', isEnabled: false },
        { featureCode: 'API_WEBHOOKS', nameAr: 'الربط البرمجي الكامل API', category: 'INTEGRATIONS', isEnabled: false },
        { featureCode: 'SSO_CUSTOM_DOMAIN', nameAr: 'النطاق المخصص وSSO', category: 'INTEGRATIONS', isEnabled: false },
      ],
    },
    {
      code: 'PRO',
      nameAr: 'الباقة الاحترافية',
      nameEn: 'Professional Plan',
      description: 'الخيار الأفضل للشركات المتوسطة والوكالات المتنامية ذات الفروع المتعددة والمقاصات الخارجية.',
      sortOrder: 3,
      priceMonthlyCents: 19900, // $199.00
      isRecommended: true, // "الأكثر اختياراً"
      limits: [
        { limitCode: 'MAX_COMPANIES', nameAr: 'عدد الشركات', limitValue: 1, unit: 'شركة' },
        { limitCode: 'MAX_BRANCHES', nameAr: 'عدد الفروع المسموحة', limitValue: -1, unit: 'فروع مفتوحة (استخدام عادل)' },
        { limitCode: 'MAX_USERS', nameAr: 'عدد المستخدمين المسموحين', limitValue: 25, unit: 'مستخدم' },
        { limitCode: 'EMAIL_DAILY', nameAr: 'رسائل البريد اليومية', limitValue: 200, unit: 'رسالة/يوم' },
        { limitCode: 'EMAIL_MONTHLY', nameAr: 'رسائل البريد الشهرية', limitValue: 6000, unit: 'رسالة/شهر' },
        { limitCode: 'STORAGE_MB', nameAr: 'مساحة التخزين السحابي', limitValue: 25600, unit: 'ميجابايت (25 GB)' },
        { limitCode: 'BACKUP_RETENTION_DAYS', nameAr: 'الاحتفاظ بالنسخ الاحتياطية', limitValue: 90, unit: 'يوم' },
      ],
      features: [
        // Accounting & Multi-branch
        { featureCode: 'CHART_OF_ACCOUNTS', nameAr: 'دليل الحسابات والقيود اليومية', category: 'ACCOUNTING', isEnabled: true },
        { featureCode: 'JOURNAL_ENTRIES', nameAr: 'القيود المحاسبية الآلية واليدوية', category: 'ACCOUNTING', isEnabled: true },
        { featureCode: 'VOUCHERS', nameAr: 'سندات القبض والدفع والصرافة والقيد', category: 'ACCOUNTING', isEnabled: true },
        { featureCode: 'CASHBOXES_BANKS', nameAr: 'إدارة الصناديق والحسابات البنكية', category: 'ACCOUNTING', isEnabled: true },
        { featureCode: 'CUSTOMERS_SUPPLIERS', nameAr: 'إدارة العملاء والموردين والشركات', category: 'ACCOUNTING', isEnabled: true },
        { featureCode: 'CURRENCIES_RATES', nameAr: 'تعدد العملات وأسعار الصرف اليومية', category: 'ACCOUNTING', isEnabled: true },
        { featureCode: 'FINANCIAL_REPORTS', nameAr: 'التقارير المالية الأساسية والمتقدمة', category: 'REPORTS', isEnabled: true },
        { featureCode: 'ACCOUNT_STATEMENTS', nameAr: 'كشوفات الحساب وتصدير PDF وExcel', category: 'REPORTS', isEnabled: true },
        { featureCode: 'FISCAL_YEARS_BASIC', nameAr: 'إدارة السنوات المالية وإعادة الفتح بصلاحية', category: 'ACCOUNTING', isEnabled: true },
        { featureCode: 'MULTI_BRANCHES', nameAr: 'إدارة متعددة الفروع كاملة', category: 'BRANCHES', isEnabled: true },
        { featureCode: 'BRANCH_TRANSFERS', nameAr: 'نقل العمليات والأرصدة بين الفروع', category: 'BRANCHES', isEnabled: true },
        { featureCode: 'CONSOLIDATED_REPORTS', nameAr: 'تقارير منفصلة ومجمعة للفروع', category: 'REPORTS', isEnabled: true },
        { featureCode: 'ADVANCED_PERMISSIONS', nameAr: 'صلاحيات متقدمة حسب الفرع والقسم والإجراء', category: 'SECURITY', isEnabled: true },
        { featureCode: 'APPROVAL_WORKFLOWS', nameAr: 'دورات الموافقة على السندات والعمليات', category: 'SECURITY', isEnabled: true },
        { featureCode: 'ADVANCED_AUDIT_LOG', nameAr: 'سجل تدقيق متقدم لمعرفة من أنشأ وعدّل واعتمد', category: 'SECURITY', isEnabled: true },
        { featureCode: 'COST_CENTERS', nameAr: 'مراكز التكلفة والمشاريع والأقسام', category: 'ACCOUNTING', isEnabled: true },
        { featureCode: 'SCHEDULED_REPORTS', nameAr: 'جدولة وإرسال التقارير بالبريد آلياً', category: 'REPORTS', isEnabled: true },
        { featureCode: 'EXTERNAL_CLEARINGS', nameAr: 'التصفيات والمقاصات الخارجية (بورصات ومكاتب)', category: 'ACCOUNTING', isEnabled: true },
        { featureCode: 'CUSTOM_TEMPLATES', nameAr: 'تخصيص الشعار والألوان وقوالب الطباعة', category: 'ACCOUNTING', isEnabled: true },
        { featureCode: 'ATTACHMENTS', nameAr: 'إرفاق المستندات بالعمليات والسندات', category: 'ACCOUNTING', isEnabled: true },
        // Tourism
        { featureCode: 'FLIGHT_TICKETS', nameAr: 'تذاكر الطيران والمسافرين', category: 'TRAVEL', isEnabled: true },
        { featureCode: 'VISAS_HOTELS_GROUPS', nameAr: 'التأشيرات والفنادق والمجموعات السياحية', category: 'TRAVEL', isEnabled: true },
        { featureCode: 'REFUNDS_REISSUES', nameAr: 'استرجاع وتعديل التذاكر', category: 'TRAVEL', isEnabled: true },
        // Enterprise Only Features (Disabled)
        { featureCode: 'API_WEBHOOKS', nameAr: 'الربط البرمجي المفتوح API وWebhooks', category: 'INTEGRATIONS', isEnabled: false },
        { featureCode: 'SSO_CUSTOM_DOMAIN', nameAr: 'تسجيل الدخول الموحد SSO والنطاق المخصص', category: 'INTEGRATIONS', isEnabled: false },
        { featureCode: 'DEDICATED_ACCOUNT_MANAGER', nameAr: 'مدير حساب مخصص واتفاقية SLA', category: 'SUPPORT', isEnabled: false },
      ],
    },
    {
      code: 'ENTERPRISE',
      nameAr: 'الباقة الشاملة',
      nameEn: 'Enterprise Plan',
      description: 'حل متكامل ومخصص لكبرى الشركات والشبكات السياحية مع دعم فني عالي الأولوية وربط تقني شامل.',
      sortOrder: 4,
      priceMonthlyCents: 79900, // $799 every 3 months
      isRecommended: false,
      limits: [
        { limitCode: 'MAX_COMPANIES', nameAr: 'عدد الشركات والكيانات', limitValue: -1, unit: 'متعدد الشركات' },
        { limitCode: 'MAX_BRANCHES', nameAr: 'عدد الفروع المسموحة', limitValue: -1, unit: 'غير محدود (استخدام عادل)' },
        { limitCode: 'MAX_USERS', nameAr: 'عدد المستخدمين المسموحين', limitValue: -1, unit: 'غير محدود (استخدام عادل)' },
        { limitCode: 'EMAIL_DAILY', nameAr: 'رسائل البريد اليومية', limitValue: 1000, unit: 'رسالة/يوم' },
        { limitCode: 'EMAIL_MONTHLY', nameAr: 'رسائل البريد الشهرية', limitValue: 25000, unit: 'رسالة/شهر' },
        { limitCode: 'STORAGE_MB', nameAr: 'مساحة التخزين السحابي', limitValue: 102400, unit: 'ميجابايت (100 GB)' },
        { limitCode: 'BACKUP_RETENTION_DAYS', nameAr: 'الاحتفاظ بالنسخ الاحتياطية', limitValue: 365, unit: 'يوم (سنة كاملة)' },
      ],
      features: [
        // All Pro features
        { featureCode: 'CHART_OF_ACCOUNTS', nameAr: 'دليل الحسابات والقيود اليومية', category: 'ACCOUNTING', isEnabled: true },
        { featureCode: 'JOURNAL_ENTRIES', nameAr: 'القيود المحاسبية الآلية واليدوية', category: 'ACCOUNTING', isEnabled: true },
        { featureCode: 'VOUCHERS', nameAr: 'سندات القبض والدفع والصرافة والقيد', category: 'ACCOUNTING', isEnabled: true },
        { featureCode: 'CASHBOXES_BANKS', nameAr: 'إدارة الصناديق والحسابات البنكية', category: 'ACCOUNTING', isEnabled: true },
        { featureCode: 'CUSTOMERS_SUPPLIERS', nameAr: 'إدارة العملاء والموردين والشركات', category: 'ACCOUNTING', isEnabled: true },
        { featureCode: 'CURRENCIES_RATES', nameAr: 'تعدد العملات وأسعار الصرف اليومية', category: 'ACCOUNTING', isEnabled: true },
        { featureCode: 'FINANCIAL_REPORTS', nameAr: 'التقارير المالية الأساسية والمتقدمة', category: 'REPORTS', isEnabled: true },
        { featureCode: 'ACCOUNT_STATEMENTS', nameAr: 'كشوفات الحساب وتصدير PDF وExcel', category: 'REPORTS', isEnabled: true },
        { featureCode: 'FISCAL_YEARS_BASIC', nameAr: 'إدارة السنوات المالية والتدوير', category: 'ACCOUNTING', isEnabled: true },
        { featureCode: 'MULTI_BRANCHES', nameAr: 'إدارة متعددة الفروع والكيانات', category: 'BRANCHES', isEnabled: true },
        { featureCode: 'MULTI_COMPANIES', nameAr: 'إدارة عدة شركات وكيانات وقوائم مالية موحدة', category: 'BRANCHES', isEnabled: true },
        { featureCode: 'BRANCH_TRANSFERS', nameAr: 'نقل العمليات والأرصدة بين الفروع', category: 'BRANCHES', isEnabled: true },
        { featureCode: 'CONSOLIDATED_REPORTS', nameAr: 'تقارير منفصلة ومجمعة للفروع والشركات', category: 'REPORTS', isEnabled: true },
        { featureCode: 'ADVANCED_PERMISSIONS', nameAr: 'صلاحيات متقدمة ومجموعات مستخدمين مخصصة', category: 'SECURITY', isEnabled: true },
        { featureCode: 'APPROVAL_WORKFLOWS', nameAr: 'دورات الموافقة على السندات والعمليات', category: 'SECURITY', isEnabled: true },
        { featureCode: 'ADVANCED_AUDIT_LOG', nameAr: 'سجل تدقيق شامل وغير قابل للتلاعب', category: 'SECURITY', isEnabled: true },
        { featureCode: 'COST_CENTERS', nameAr: 'مراكز التكلفة والمشاريع والأقسام', category: 'ACCOUNTING', isEnabled: true },
        { featureCode: 'SCHEDULED_REPORTS', nameAr: 'جدولة وإرسال التقارير بالبريد آلياً', category: 'REPORTS', isEnabled: true },
        { featureCode: 'EXTERNAL_CLEARINGS', nameAr: 'التصفيات والمقاصات الخارجية (بورصات ومكاتب)', category: 'ACCOUNTING', isEnabled: true },
        { featureCode: 'CUSTOM_TEMPLATES', nameAr: 'تخصيص كامل للهوية والشعار وقوالب الطباعة', category: 'ACCOUNTING', isEnabled: true },
        { featureCode: 'ATTACHMENTS', nameAr: 'إرفاق المستندات بالعمليات بدون قيود تخزين عادية', category: 'ACCOUNTING', isEnabled: true },
        // Enterprise Specialized Features
        { featureCode: 'API_WEBHOOKS', nameAr: 'API كامل وWebhooks لربط الأنظمة الخارجية', category: 'INTEGRATIONS', isEnabled: true },
        { featureCode: 'SSO_CUSTOM_DOMAIN', nameAr: 'تسجيل الدخول الموحد SSO والنطاق المخصص', category: 'INTEGRATIONS', isEnabled: true },
        { featureCode: 'ADVANCED_SECURITY_IP', nameAr: 'إعدادات أمان متقدمة وقيود وصول حسب IP', category: 'SECURITY', isEnabled: true },
        { featureCode: 'DEDICATED_ACCOUNT_MANAGER', nameAr: 'مدير حساب مخصص ودعم فني عالي الأولوية', category: 'SUPPORT', isEnabled: true },
        { featureCode: 'SLA_AGREEMENT', nameAr: 'اتفاقية مستوى خدمة SLA مع معالجة حرجة', category: 'SUPPORT', isEnabled: true },
        { featureCode: 'DATA_MIGRATION_TRAINING', nameAr: 'المساعدة في ترحيل البيانات وتدريب الفريق', category: 'SUPPORT', isEnabled: true },
        // Tourism
        { featureCode: 'FLIGHT_TICKETS', nameAr: 'تذاكر الطيران والمسافرين', category: 'TRAVEL', isEnabled: true },
        { featureCode: 'VISAS_HOTELS_GROUPS', nameAr: 'التأشيرات والفنادق والمجموعات السياحية', category: 'TRAVEL', isEnabled: true },
        { featureCode: 'REFUNDS_REISSUES', nameAr: 'استرجاع وتعديل التذاكر', category: 'TRAVEL', isEnabled: true },
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

    console.log(`✅ Plan ${p.code} (${p.nameAr}): Synced version, ${p.limits.length} limits, and ${p.features.length} features.`);
  }

  console.log('🎉 Enterprise SaaS Subscription Plans DB sync completed successfully!');
}

if (require.main === module) {
  seedEnterpriseSaasPlans()
    .catch((err) => {
      console.error('Error seeding plans:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
