import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FULL_FEATURES_BY_CATEGORY = [
  // ── 1. المحاسبة والعمليات المالية ──
  { category: 'ACCOUNTING', categoryName: 'المحاسبة والعمليات المالية', code: 'CHART_OF_ACCOUNTS', nameAr: 'دليل الحسابات وشجرة القيود اليومية', trial: true, basic: true, pro: true, enterprise: true },
  { category: 'ACCOUNTING', categoryName: 'المحاسبة والعمليات المالية', code: 'VOUCHERS_PAY_RECEIPT', nameAr: 'سندات القبض والدفع والصرافة والقيد', trial: true, basic: true, pro: true, enterprise: true },
  { category: 'ACCOUNTING', categoryName: 'المحاسبة والعمليات المالية', code: 'CASHBOXES_BANKS', nameAr: 'إدارة الصناديق النقدية والحسابات البنكية', trial: true, basic: true, pro: true, enterprise: true },
  { category: 'ACCOUNTING', categoryName: 'المحاسبة والعمليات المالية', code: 'CUSTOMERS_SUPPLIERS', nameAr: 'إدارة العملاء والشركات والموردين', trial: true, basic: true, pro: true, enterprise: true },
  { category: 'ACCOUNTING', categoryName: 'المحاسبة والعمليات المالية', code: 'MULTI_CURRENCY_RATES', nameAr: 'تعدد العملات وأسعار الصرف اليومية', trial: true, basic: true, pro: true, enterprise: true },
  { category: 'ACCOUNTING', categoryName: 'المحاسبة والعمليات المالية', code: 'ACCOUNT_STATEMENTS_EXPORT', nameAr: 'كشوفات الحساب وتصدير PDF وExcel', trial: true, basic: true, pro: true, enterprise: true },
  { category: 'ACCOUNTING', categoryName: 'المحاسبة والعمليات المالية', code: 'COST_CENTERS', nameAr: 'مراكز التكلفة والمشاريع والأقسام', trial: false, basic: false, pro: true, enterprise: true },
  { category: 'ACCOUNTING', categoryName: 'المحاسبة والعمليات المالية', code: 'EXTERNAL_CLEARINGS', nameAr: 'التصفيات والمقاصات الخارجية (بورصات ومكاتب)', trial: true, basic: false, pro: true, enterprise: true },
  { category: 'ACCOUNTING', categoryName: 'المحاسبة والعمليات المالية', code: 'SUB_CASHBOXES_SETTLEMENT', nameAr: 'مطابقة وتسوية الصناديق الفرعية', trial: true, basic: false, pro: true, enterprise: true },

  // ── 2. السياحة وتذاكر الطيران ──
  { category: 'TRAVEL', categoryName: 'السياحة وتذاكر الطيران', code: 'FLIGHT_TICKETS_PASSENGERS', nameAr: 'إصدار تذاكر الطيران وإدارة المسافرين', trial: true, basic: true, pro: true, enterprise: true },
  { category: 'TRAVEL', categoryName: 'السياحة وتذاكر الطيران', code: 'VISAS_HOTELS_GROUPS', nameAr: 'حجوزات التأشيرات والفنادق والمجموعات السياحية', trial: true, basic: true, pro: true, enterprise: true },
  { category: 'TRAVEL', categoryName: 'السياحة وتذاكر الطيران', code: 'REFUNDS_REISSUES', nameAr: 'استرجاع وتعديل وتغيير مسار التذاكر', trial: true, basic: true, pro: true, enterprise: true },
  { category: 'TRAVEL', categoryName: 'السياحة وتذاكر الطيران', code: 'TOURISM_PROFIT_REPORTS', nameAr: 'تقارير أرباح وعمولات السياحة والتذاكر', trial: true, basic: true, pro: true, enterprise: true },

  // ── 3. الفروع والتعدد المحاسبي ──
  { category: 'BRANCHES', categoryName: 'الفروع والتعدد المحاسبي', code: 'MULTI_BRANCHES_MGMT', nameAr: 'إدارة متعددة الفروع كاملة', trial: false, basic: false, pro: true, enterprise: true },
  { category: 'BRANCHES', categoryName: 'الفروع والتعدد المحاسبي', code: 'BRANCH_TRANSFERS', nameAr: 'نقل العمليات والأرصدة بين الفروع', trial: false, basic: false, pro: true, enterprise: true },
  { category: 'BRANCHES', categoryName: 'الفروع والتعدد المحاسبي', code: 'BRANCH_REPORTS_COMBINED', nameAr: 'تقارير منفصلة ومجمعة للفروع', trial: false, basic: false, pro: true, enterprise: true },
  { category: 'BRANCHES', categoryName: 'الفروع والتعدد المحاسبي', code: 'BRANCH_COMPARISONS', nameAr: 'المقارنة المالية ومطابقة أرصدة الفروع', trial: false, basic: false, pro: true, enterprise: true },
  { category: 'BRANCHES', categoryName: 'الفروع والتعدد المحاسبي', code: 'CONSOLIDATED_STATEMENTS', nameAr: 'قوائم مالية موحدة للشركات والكيانات', trial: false, basic: false, pro: false, enterprise: true },

  // ── 4. الصلاحيات والأمان والرقابة ──
  { category: 'SECURITY', categoryName: 'الصلاحيات والأمان والرقابة', code: 'BASIC_USER_ROLES', nameAr: 'صلاحيات المستخدمين ومجموعات العمل الأساسية', trial: true, basic: true, pro: true, enterprise: true },
  { category: 'SECURITY', categoryName: 'الصلاحيات والأمان والرقابة', code: 'ADVANCED_BRANCH_ROLES', nameAr: 'صلاحيات متقدمة حسب الفرع والقسم والإجراء', trial: false, basic: false, pro: true, enterprise: true },
  { category: 'SECURITY', categoryName: 'الصلاحيات والأمان والرقابة', code: 'APPROVAL_CYCLES', nameAr: 'دورات الموافقة والاعتماد على السندات', trial: false, basic: false, pro: true, enterprise: true },
  { category: 'SECURITY', categoryName: 'الصلاحيات والأمان والرقابة', code: 'ADVANCED_AUDIT_LOG', nameAr: 'سجل تدقيق متقدم (من أنشأ وعدّل واعتمد)', trial: false, basic: false, pro: true, enterprise: true },
  { category: 'SECURITY', categoryName: 'الصلاحيات والأمان والرقابة', code: 'REOPEN_FISCAL_YEAR', nameAr: 'إعادة فتح سنة مالية مقفلة بصلاحية خاصة', trial: false, basic: false, pro: true, enterprise: true },
  { category: 'SECURITY', categoryName: 'الصلاحيات والأمان والرقابة', code: 'PREV_YEAR_BALANCE_TRACK', nameAr: 'تسجيل التغييرات على أرصدة السنوات السابقة', trial: false, basic: false, pro: true, enterprise: true },
  { category: 'SECURITY', categoryName: 'الصلاحيات والأمان والرقابة', code: 'IP_WHITELIST_RESTRICT', nameAr: 'قيود الوصول حسب عنوان IP', trial: false, basic: false, pro: false, enterprise: true },
  { category: 'SECURITY', categoryName: 'الصلاحيات والأمان والرقابة', code: 'SSO_CUSTOM_DOMAIN', nameAr: 'تسجيل الدخول الموحد SSO والنطاق المخصص', trial: false, basic: false, pro: false, enterprise: true },

  // ── 5. التقارير والتحليلات المالية ──
  { category: 'REPORTS', categoryName: 'التقارير والتحليلات المالية', code: 'FINANCIAL_REPORTS_BASIC', nameAr: 'التقارير المالية الأساسية وميزان المراجعة', trial: true, basic: true, pro: true, enterprise: true },
  { category: 'REPORTS', categoryName: 'التقارير والتحليلات المالية', code: 'INCOME_BALANCE_SHEET', nameAr: 'قائمة الدخل والأرباح والميزانية العمومية', trial: true, basic: true, pro: true, enterprise: true },
  { category: 'REPORTS', categoryName: 'التقارير والتحليلات المالية', code: 'ADVANCED_CUSTOM_REPORTS', nameAr: 'التقارير المالية المتقدمة والمخصصة', trial: false, basic: false, pro: true, enterprise: true },
  { category: 'REPORTS', categoryName: 'التقارير والتحليلات المالية', code: 'SCHEDULED_EMAIL_REPORTS', nameAr: 'جدولة وإرسال التقارير بالبريد آلياً', trial: false, basic: false, pro: true, enterprise: true },
  { category: 'REPORTS', categoryName: 'التقارير والتحليلات المالية', code: 'EXECUTIVE_DASHBOARDS', nameAr: 'لوحات متابعة متقدمة للإدارة', trial: false, basic: false, pro: true, enterprise: true },

  // ── 6. التخزين والنسخ الاحتياطي ──
  { category: 'STORAGE', categoryName: 'التخزين والنسخ الاحتياطي', code: 'DAILY_AUTO_BACKUP', nameAr: 'نسخ احتياطي يومي تلقائي', trial: true, basic: true, pro: true, enterprise: true },
  { category: 'STORAGE', categoryName: 'التخزين والنسخ الاحتياطي', code: 'ATTACHMENTS_RECEIPTS', nameAr: 'إرفاق المستندات والصور بالعمليات', trial: false, basic: false, pro: true, enterprise: true },
  { category: 'STORAGE', categoryName: 'التخزين والنسخ الاحتياطي', code: 'CUSTOM_BRANDING_PRINT', nameAr: 'تخصيص الشعار والألوان وبيانات الطباعة', trial: false, basic: false, pro: true, enterprise: true },

  // ── 7. الربط البرمجي والدعم الفني ──
  { category: 'INTEGRATIONS', categoryName: 'الربط البرمجي والدعم الفني', code: 'API_WEBHOOKS', nameAr: 'الربط البرمجي الكامل API & Webhooks', trial: false, basic: false, pro: false, enterprise: true },
  { category: 'INTEGRATIONS', categoryName: 'الربط البرمجي والدعم الفني', code: 'EMAIL_SUPPORT', nameAr: 'دعم فني عبر البريد الإلكتروني', trial: true, basic: true, pro: true, enterprise: true },
  { category: 'INTEGRATIONS', categoryName: 'الربط البرمجي والدعم الفني', code: 'PRIORITY_SUPPORT', nameAr: 'دعم فني ذو أولوية أثناء ساعات العمل', trial: false, basic: false, pro: true, enterprise: true },
  { category: 'INTEGRATIONS', categoryName: 'الربط البرمجي والدعم الفني', code: 'SLA_CRITICAL_SUPPORT', nameAr: 'اتفاقية مستوى الخدمة SLA ومعالجة حرجة', trial: false, basic: false, pro: false, enterprise: true },
  { category: 'INTEGRATIONS', categoryName: 'الربط البرمجي والدعم الفني', code: 'DEDICATED_ACCOUNT_MGR', nameAr: 'مدير حساب مخصص والمساعدة في ترحيل البيانات', trial: false, basic: false, pro: false, enterprise: true },
];

async function syncAllFeatures() {
  console.log('🔄 Syncing full comparison features across all 4 plans in DB...');

  const plans = await prisma.plan.findMany({
    include: {
      versions: {
        where: { isActive: true },
        orderBy: { versionNumber: 'desc' },
        take: 1,
      },
    },
  });

  for (const plan of plans) {
    const version = plan.versions[0];
    if (!version) continue;

    console.log(`\n📌 Plan: ${plan.code} (${plan.nameAr}) - Version: ${version.id}`);

    for (const feat of FULL_FEATURES_BY_CATEGORY) {
      let isEnabled = false;
      if (plan.code === 'FREE_TRIAL') isEnabled = feat.trial;
      else if (plan.code === 'BASIC') isEnabled = feat.basic;
      else if (plan.code === 'PRO') isEnabled = feat.pro;
      else if (plan.code === 'ENTERPRISE') isEnabled = feat.enterprise;

      await prisma.planFeature.upsert({
        where: {
          planVersionId_featureCode: {
            planVersionId: version.id,
            featureCode: feat.code,
          },
        },
        update: {
          nameAr: feat.nameAr,
          category: feat.category,
          isEnabled,
        },
        create: {
          planVersionId: version.id,
          featureCode: feat.code,
          nameAr: feat.nameAr,
          category: feat.category,
          isEnabled,
        },
      });
    }
  }

  console.log('✅ Successfully unified all comparison features in PostgreSQL!');
}

syncAllFeatures()
  .catch((e) => {
    console.error('❌ Error syncing features:', e);
  })
  .finally(() => prisma.$disconnect());
