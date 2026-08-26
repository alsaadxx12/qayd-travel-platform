import { PrismaClient, AccountType, AccountCategory } from '@prisma/client';

const prisma = new PrismaClient();

interface AccountDefinition {
  code: string;
  nameAr: string;
  nameEn?: string;
  level: number;
  isParent: boolean;
  parentCode?: string;
}

const EXPENSES_TREE: AccountDefinition[] = [
  // Level 1: Root
  { code: '3', nameAr: 'الاستخدامات (المصروفات)', nameEn: 'Expenses & Uses', level: 1, isParent: true },

  // Level 2: 31 - تكاليف العاملين
  { code: '31', nameAr: 'تكاليف العاملين', nameEn: 'Employee Costs', level: 2, isParent: true, parentCode: '3' },
  // Level 3 & 4 under 31
  { code: '311', nameAr: 'الرواتب والأجور', level: 3, isParent: true, parentCode: '31' },
  { code: '3111', nameAr: 'الرواتب الأساسية', level: 4, isParent: false, parentCode: '311' },
  { code: '3112', nameAr: 'أجور العاملين المؤقتين', level: 4, isParent: false, parentCode: '311' },
  { code: '3113', nameAr: 'أجور العمل الإضافي', level: 4, isParent: false, parentCode: '311' },

  { code: '312', nameAr: 'المخصصات والمنافع', level: 3, isParent: true, parentCode: '31' },
  { code: '3121', nameAr: 'مخصصات النقل', level: 4, isParent: false, parentCode: '312' },
  { code: '3122', nameAr: 'مخصصات الطعام', level: 4, isParent: false, parentCode: '312' },
  { code: '3123', nameAr: 'مخصصات الهاتف', level: 4, isParent: false, parentCode: '312' },

  { code: '313', nameAr: 'المكافآت والعمولات', level: 3, isParent: true, parentCode: '31' },
  { code: '3131', nameAr: 'مكافآت الأداء', level: 4, isParent: false, parentCode: '313' },
  { code: '3132', nameAr: 'عمولات مبيعات الموظفين', level: 4, isParent: false, parentCode: '313' },

  { code: '314', nameAr: 'الضمان والتقاعد', level: 3, isParent: true, parentCode: '31' },
  { code: '3141', nameAr: 'مساهمة الشركة في الضمان والتقاعد', level: 4, isParent: false, parentCode: '314' },

  { code: '315', nameAr: 'التدريب والتوظيف', level: 3, isParent: true, parentCode: '31' },
  { code: '3151', nameAr: 'مصروفات التدريب', level: 4, isParent: false, parentCode: '315' },
  { code: '3152', nameAr: 'مصروفات التوظيف', level: 4, isParent: false, parentCode: '315' },

  { code: '319', nameAr: 'مصروفات عاملين أخرى', level: 3, isParent: true, parentCode: '31' },
  { code: '3199', nameAr: 'مصروفات متنوعة للعاملين', level: 4, isParent: false, parentCode: '319' },

  // Level 2: 32 - المستلزمات السلعية
  { code: '32', nameAr: 'المستلزمات السلعية', nameEn: 'Material Supplies', level: 2, isParent: true, parentCode: '3' },
  // Level 3 & 4 under 32
  { code: '321', nameAr: 'القرطاسية والمطبوعات', level: 3, isParent: true, parentCode: '32' },
  { code: '3211', nameAr: 'قرطاسية مكتبية', level: 4, isParent: false, parentCode: '321' },
  { code: '3212', nameAr: 'أحبار وطابعات', level: 4, isParent: false, parentCode: '321' },
  { code: '3213', nameAr: 'دفاتر ووصولات ونماذج', level: 4, isParent: false, parentCode: '321' },
  { code: '3214', nameAr: 'بطاقات عمل ومطبوعات', level: 4, isParent: false, parentCode: '321' },

  { code: '322', nameAr: 'مستلزمات الحاسوب والمكتب', level: 3, isParent: true, parentCode: '32' },
  { code: '3221', nameAr: 'ملحقات حاسوب صغيرة', level: 4, isParent: false, parentCode: '322' },
  { code: '3222', nameAr: 'أدوات مكتبية منخفضة القيمة', level: 4, isParent: false, parentCode: '322' },

  { code: '323', nameAr: 'الوقود والمحروقات', level: 3, isParent: true, parentCode: '32' },
  { code: '3231', nameAr: 'وقود السيارات', level: 4, isParent: false, parentCode: '323' },
  { code: '3232', nameAr: 'وقود المولدات', level: 4, isParent: false, parentCode: '323' },

  { code: '324', nameAr: 'الضيافة والمشروبات', level: 3, isParent: true, parentCode: '32' },
  { code: '3241', nameAr: 'ضيافة يومية', level: 4, isParent: false, parentCode: '324' },
  { code: '3242', nameAr: 'ضيافة الاجتماعات والعملاء', level: 4, isParent: false, parentCode: '324' },

  { code: '325', nameAr: 'مواد التنظيف والتعقيم', level: 3, isParent: true, parentCode: '32' },
  { code: '3251', nameAr: 'مواد تنظيف ومستهلكات صحية', level: 4, isParent: false, parentCode: '325' },

  { code: '326', nameAr: 'قطع الغيار والأدوات الصغيرة', level: 3, isParent: true, parentCode: '32' },
  { code: '3261', nameAr: 'قطع غيار وأدوات منخفضة القيمة', level: 4, isParent: false, parentCode: '326' },

  { code: '329', nameAr: 'مستلزمات سلعية أخرى', level: 3, isParent: true, parentCode: '32' },
  { code: '3299', nameAr: 'مستلزمات متنوعة', level: 4, isParent: false, parentCode: '329' },

  // Level 2: 33 - المستلزمات والخدمات
  { code: '33', nameAr: 'المستلزمات والخدمات', nameEn: 'Services & Utilities', level: 2, isParent: true, parentCode: '3' },
  // Level 3 & 4 under 33
  { code: '331', nameAr: 'الصيانة والإصلاحات', level: 3, isParent: true, parentCode: '33' },
  { code: '3311', nameAr: 'صيانة المباني والمكاتب', level: 4, isParent: false, parentCode: '331' },
  { code: '3312', nameAr: 'صيانة الحاسبات والطابعات', level: 4, isParent: false, parentCode: '331' },
  { code: '3313', nameAr: 'صيانة التكييف والكهرباء', level: 4, isParent: false, parentCode: '331' },
  { code: '3314', nameAr: 'صيانة السيارات', level: 4, isParent: false, parentCode: '331' },
  { code: '3315', nameAr: 'خدمات صيانة ونظافة دورية', level: 4, isParent: false, parentCode: '331' },

  { code: '332', nameAr: 'الإنترنت والاتصالات', level: 3, isParent: true, parentCode: '33' },
  { code: '3321', nameAr: 'اشتراكات الإنترنت', level: 4, isParent: false, parentCode: '332' },
  { code: '3322', nameAr: 'الهاتف والموبايل', level: 4, isParent: false, parentCode: '332' },
  { code: '3323', nameAr: 'رسائل SMS وWhatsApp', level: 4, isParent: false, parentCode: '332' },
  { code: '3324', nameAr: 'خدمات البريد الإلكتروني', level: 4, isParent: false, parentCode: '332' },

  { code: '333', nameAr: 'الماء والكهرباء والطاقة', level: 3, isParent: true, parentCode: '33' },
  { code: '3331', nameAr: 'الكهرباء', level: 4, isParent: false, parentCode: '333' },
  { code: '3332', nameAr: 'الماء', level: 4, isParent: false, parentCode: '333' },
  { code: '3333', nameAr: 'اشتراك المولد', level: 4, isParent: false, parentCode: '333' },

  { code: '334', nameAr: 'الخدمات المهنية والاستشارية', level: 3, isParent: true, parentCode: '33' },
  { code: '3341', nameAr: 'خدمات محاسبية وتدقيق', level: 4, isParent: false, parentCode: '334' },
  { code: '3342', nameAr: 'خدمات قانونية', level: 4, isParent: false, parentCode: '334' },
  { code: '3343', nameAr: 'دعم فني وتقني', level: 4, isParent: false, parentCode: '334' },
  { code: '3344', nameAr: 'خدمات استشارية', level: 4, isParent: false, parentCode: '334' },

  { code: '335', nameAr: 'الدعاية والتسويق', level: 3, isParent: true, parentCode: '33' },
  { code: '3351', nameAr: 'إعلانات مواقع التواصل', level: 4, isParent: false, parentCode: '335' },
  { code: '3352', nameAr: 'التصميم وصناعة المحتوى', level: 4, isParent: false, parentCode: '335' },
  { code: '3353', nameAr: 'المطبوعات الإعلانية', level: 4, isParent: false, parentCode: '335' },
  { code: '3354', nameAr: 'الرعاية والإعلانات الخارجية', level: 4, isParent: false, parentCode: '335' },

  { code: '336', nameAr: 'النقل والسفر والبريد', level: 3, isParent: true, parentCode: '33' },
  { code: '3361', nameAr: 'البريد والتوصيل', level: 4, isParent: false, parentCode: '336' },
  { code: '3362', nameAr: 'نقل الموظفين', level: 4, isParent: false, parentCode: '336' },
  { code: '3363', nameAr: 'سفر وإقامة مهمات العمل', level: 4, isParent: false, parentCode: '336' },

  { code: '337', nameAr: 'العمولات البنكية ووسائل الدفع', level: 3, isParent: true, parentCode: '33' },
  { code: '3371', nameAr: 'عمولات المصارف', level: 4, isParent: false, parentCode: '337' },
  { code: '3372', nameAr: 'أجور التحويلات المالية', level: 4, isParent: false, parentCode: '337' },
  { code: '3373', nameAr: 'عمولات بوابات الدفع', level: 4, isParent: false, parentCode: '337' },
  { code: '3374', nameAr: 'عمولات بطاقات الدفع', level: 4, isParent: false, parentCode: '337' },

  { code: '338', nameAr: 'البرامج والخدمات السحابية', level: 3, isParent: true, parentCode: '33' },
  { code: '3381', nameAr: 'اشتراكات أنظمة الحجز', level: 4, isParent: false, parentCode: '338' },
  { code: '3382', nameAr: 'اشتراكات البرامج المحاسبية', level: 4, isParent: false, parentCode: '338' },
  { code: '3383', nameAr: 'الاستضافة وقواعد البيانات', level: 4, isParent: false, parentCode: '338' },
  { code: '3384', nameAr: 'النطاق وشهادة الحماية', level: 4, isParent: false, parentCode: '338' },
  { code: '3385', nameAr: 'برامج الحماية والمكتب', level: 4, isParent: false, parentCode: '338' },
  { code: '3386', nameAr: 'خدمات API والذكاء الاصطناعي', level: 4, isParent: false, parentCode: '338' },

  { code: '339', nameAr: 'خدمات أخرى', level: 3, isParent: true, parentCode: '33' },
  { code: '3391', nameAr: 'عقود التنظيف', level: 4, isParent: false, parentCode: '339' },
  { code: '3392', nameAr: 'خدمات الحماية والحراسة', level: 4, isParent: false, parentCode: '339' },
  { code: '3399', nameAr: 'خدمات متنوعة', level: 4, isParent: false, parentCode: '339' },

  // Level 2: 34 - كلفة الخدمات المشتراة بغرض البيع
  { code: '34', nameAr: 'كلفة الخدمات المشتراة بغرض البيع', nameEn: 'Cost of Services Sold', level: 2, isParent: true, parentCode: '3' },
  // Level 3 & 4 under 34
  { code: '341', nameAr: 'كلفة تذاكر الطيران', level: 3, isParent: true, parentCode: '34' },
  { code: '3411', nameAr: 'كلفة التذاكر الداخلية', level: 4, isParent: false, parentCode: '341' },
  { code: '3412', nameAr: 'كلفة التذاكر الدولية', level: 4, isParent: false, parentCode: '341' },

  { code: '342', nameAr: 'كلفة تغيير وإعادة إصدار التذاكر', level: 3, isParent: false, parentCode: '34' },
  { code: '343', nameAr: 'كلفة خدمات التأشيرات', level: 3, isParent: false, parentCode: '34' },
  { code: '344', nameAr: 'كلفة الحجوزات الفندقية', level: 3, isParent: false, parentCode: '34' },
  { code: '345', nameAr: 'كلفة الكروبات والبرامج السياحية', level: 3, isParent: false, parentCode: '34' },
  { code: '346', nameAr: 'كلفة النقل السياحي', level: 3, isParent: false, parentCode: '34' },
  { code: '347', nameAr: 'كلفة التأمين على السفر', level: 3, isParent: false, parentCode: '34' },
  { code: '348', nameAr: 'رسوم GDS والحجز والإصدار', level: 3, isParent: false, parentCode: '34' },
  { code: '349', nameAr: 'عمولات الوكلاء والمسوقين', level: 3, isParent: false, parentCode: '34' },

  // Level 2: 35 - المصروفات التشغيلية والتحويلية
  { code: '35', nameAr: 'المصروفات التشغيلية والتحويلية', nameEn: 'Operating & Transfer Expenses', level: 2, isParent: true, parentCode: '3' },
  // Level 3 & 4 under 35
  { code: '351', nameAr: 'الضرائب والرسوم', level: 3, isParent: true, parentCode: '35' },
  { code: '3511', nameAr: 'رسوم الرخص والإجازات', level: 4, isParent: false, parentCode: '351' },
  { code: '3512', nameAr: 'رسوم البلدية والغرف التجارية', level: 4, isParent: false, parentCode: '351' },
  { code: '3513', nameAr: 'رسوم وطوابع حكومية', level: 4, isParent: false, parentCode: '351' },

  { code: '352', nameAr: 'مصروفات الاندثار', level: 3, isParent: true, parentCode: '35' },
  { code: '3521', nameAr: 'اندثار الأثاث', level: 4, isParent: false, parentCode: '352' },
  { code: '3522', nameAr: 'اندثار الحاسبات والأجهزة', level: 4, isParent: false, parentCode: '352' },
  { code: '3523', nameAr: 'اندثار السيارات', level: 4, isParent: false, parentCode: '352' },
  { code: '3524', nameAr: 'اندثار تحسينات المكاتب', level: 4, isParent: false, parentCode: '352' },

  { code: '353', nameAr: 'الإيجارات', level: 3, isParent: true, parentCode: '35' },
  { code: '3531', nameAr: 'إيجار الفروع والمكاتب', level: 4, isParent: false, parentCode: '353' },
  { code: '3532', nameAr: 'إيجار المخازن والمواقف', level: 4, isParent: false, parentCode: '353' },
  { code: '3533', nameAr: 'إيجار الأجهزة والمعدات', level: 4, isParent: false, parentCode: '353' },

  { code: '354', nameAr: 'التأمين', level: 3, isParent: true, parentCode: '35' },
  { code: '3541', nameAr: 'تأمين المكاتب', level: 4, isParent: false, parentCode: '354' },
  { code: '3542', nameAr: 'تأمين السيارات', level: 4, isParent: false, parentCode: '354' },
  { code: '3543', nameAr: 'تأمين الموظفين', level: 4, isParent: false, parentCode: '354' },

  { code: '355', nameAr: 'المصروفات التمويلية', level: 3, isParent: true, parentCode: '35' },
  { code: '3551', nameAr: 'فوائد القروض', level: 4, isParent: false, parentCode: '355' },
  { code: '3552', nameAr: 'غرامات التأخير التمويلية', level: 4, isParent: false, parentCode: '355' },

  { code: '356', nameAr: 'خسائر فروقات العملة', level: 3, isParent: true, parentCode: '35' },
  { code: '3561', nameAr: 'خسائر فروقات عملة محققة', level: 4, isParent: false, parentCode: '356' },
  { code: '3562', nameAr: 'خسائر فروقات عملة غير محققة', level: 4, isParent: false, parentCode: '356' },

  { code: '357', nameAr: 'الاشتراكات والعضويات', level: 3, isParent: true, parentCode: '35' },
  { code: '3571', nameAr: 'اشتراكات الهيئات السياحية', level: 4, isParent: false, parentCode: '357' },
  { code: '3572', nameAr: 'عضويات واعتمادات مهنية', level: 4, isParent: false, parentCode: '357' },

  { code: '359', nameAr: 'المصروفات النثرية', level: 3, isParent: true, parentCode: '35' },
  { code: '3591', nameAr: 'فروقات وعجز الصندوق', level: 4, isParent: false, parentCode: '359' },
  { code: '3599', nameAr: 'نثرية عامة', level: 4, isParent: false, parentCode: '359' },

  // Level 2: 36 - المصروفات والخسائر غير التشغيلية
  { code: '36', nameAr: 'المصروفات والخسائر غير التشغيلية', nameEn: 'Non-Operating Expenses & Losses', level: 2, isParent: true, parentCode: '3' },
  // Level 3 & 4 under 36
  { code: '361', nameAr: 'التبرعات والمساعدات', level: 3, isParent: false, parentCode: '36' },

  { code: '362', nameAr: 'التعويضات والغرامات', level: 3, isParent: true, parentCode: '36' },
  { code: '3621', nameAr: 'تعويضات العملاء', level: 4, isParent: false, parentCode: '362' },
  { code: '3622', nameAr: 'غرامات حكومية', level: 4, isParent: false, parentCode: '362' },
  { code: '3623', nameAr: 'غرامات تعاقدية', level: 4, isParent: false, parentCode: '362' },

  { code: '363', nameAr: 'الديون المعدومة وخسائر الائتمان', level: 3, isParent: true, parentCode: '36' },
  { code: '3631', nameAr: 'ديون معدومة', level: 4, isParent: false, parentCode: '363' },
  { code: '3632', nameAr: 'مخصص خسائر ائتمانية', level: 4, isParent: false, parentCode: '363' },

  { code: '364', nameAr: 'خسائر بيع أو استبعاد الموجودات', level: 3, isParent: false, parentCode: '36' },
  { code: '365', nameAr: 'مصروفات سنوات سابقة', level: 3, isParent: false, parentCode: '36' },
  { code: '366', nameAr: 'خسائر السرقة والتلف', level: 3, isParent: false, parentCode: '36' },
  { code: '367', nameAr: 'مصروف ضريبة الدخل', level: 3, isParent: false, parentCode: '36' },
  { code: '369', nameAr: 'مصروفات غير تشغيلية أخرى', level: 3, isParent: false, parentCode: '36' },
];

async function seedExpensesForTenantAndCompany(tenantId: string | null, companyId: string) {
  console.log(`\n======================================================`);
  console.log(`Processing Tenant: ${tenantId || 'GLOBAL'} | Company: ${companyId}`);
  console.log(`======================================================`);

  const codeToIdMap = new Map<string, string>();

  // Fetch existing accounts for this tenant/company
  const existingAccounts = await prisma.account.findMany({
    where: {
      companyId,
      ...(tenantId ? { tenantId } : {}),
    },
  });

  existingAccounts.forEach((acc) => {
    codeToIdMap.set(acc.code, acc.id);
  });

  // Sort definitions by level to ensure parents exist before children
  const sortedDefs = [...EXPENSES_TREE].sort((a, b) => a.level - b.level);

  let createdCount = 0;
  let updatedCount = 0;

  for (const def of sortedDefs) {
    const parentId = def.parentCode ? codeToIdMap.get(def.parentCode) || null : null;
    const existingId = codeToIdMap.get(def.code);

    if (existingId) {
      const updated = await prisma.account.update({
        where: { id: existingId },
        data: {
          nameAr: def.nameAr,
          nameEn: def.nameEn || undefined,
          type: AccountType.EXPENSE,
          category: AccountCategory.GENERAL,
          isParent: def.isParent,
          level: def.level,
          parentId: parentId || undefined,
        },
      });
      codeToIdMap.set(def.code, updated.id);
      updatedCount++;
    } else {
      const created = await prisma.account.create({
        data: {
          code: def.code,
          nameAr: def.nameAr,
          nameEn: def.nameEn || null,
          type: AccountType.EXPENSE,
          category: AccountCategory.GENERAL,
          isParent: def.isParent,
          level: def.level,
          parentId,
          companyId,
          tenantId,
          balance: 0,
          currency: 'MULTI',
          isSystem: true,
          branchScope: 'ALL_BRANCHES',
        },
      });
      codeToIdMap.set(def.code, created.id);
      createdCount++;
    }
  }

  console.log(`Done: Created ${createdCount}, Updated ${updatedCount} accounts in Database.`);
}

async function main() {
  console.log('🚀 Starting Chart of Accounts Expense Tree Database Seeding...');

  const companies = await prisma.company.findMany();
  console.log(`Found ${companies.length} companies.`);

  if (companies.length === 0) {
    const defaultCompany = await prisma.company.create({
      data: {
        code: 'COMP-01',
        name: 'الشركة الافتراضية',
      },
    });
    companies.push(defaultCompany);
  }

  for (const comp of companies) {
    await seedExpensesForTenantAndCompany(comp.tenantId, comp.id);
  }

  const tenants = await prisma.tenant.findMany();
  for (const tenant of tenants) {
    const hasCompany = companies.some((c) => c.tenantId === tenant.id);
    if (!hasCompany) {
      const newComp = await prisma.company.create({
        data: {
          code: `COMP-${tenant.id.slice(0, 6)}`,
          name: tenant.name,
          tenantId: tenant.id,
        },
      });
      await seedExpensesForTenantAndCompany(tenant.id, newComp.id);
    }
  }

  console.log('\n🎉 ALL EXPENSE ACCOUNTS HAVE BEEN SEEDED DIRECTLY INTO THE DATABASE!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
