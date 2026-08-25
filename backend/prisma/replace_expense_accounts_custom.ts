import { PrismaClient, AccountType, AccountCategory } from '@prisma/client';

const prisma = new PrismaClient();

const CUSTOM_EXPENSES = [
  'مصاريف أثاث',
  'مصاريف أرصدة وماستر كارد',
  'مصاريف المولدة',
  'مصاريف ماء وكهرباء',
  'مصاريف إعلان',
  'مصاريف إيفاد وسفر',
  'مصاريف تكسيات',
  'مصاريف عمولات حوالات',
  'مصاريف أخرى',
  'مصاريف بشار نجف',
  'مصاريف المطبخ',
  'مصاريف تسويق',
  'مصاريف ضرائب سياحة',
  'مصاريف قبرص 2',
  'مصاريف بيت الجادرية',
  'مصاريف إيجار الشركة',
  'مصاريف ضيافة',
  'مصاريف هدايا',
  'مصاريف أمانات',
  'مصاريف قرطاسية',
  'مصاريف صيانة وشراء الإلكترونيات',
  'مصاريف إنترنت',
  'مصاريف المحامي والقضايا',
  'مصاريف شراء الأنظمة والاشتراكات',
  'مصاريف المؤتمرات',
  'مصاريف أرض الهايبر',
  'مصاريف خسائر الشركة',
  'مصاريف الأيتام والصدقات',
  'مصاريف فرع المنصور',
  'مصاريف ورواتب مندوبي تركيا',
  'مصاريف مندوبي سوريا',
  'مصاريف طباعة هويات',
  'مصاريف شراء كارتات',
  'مصاريف نظام فلاي الجديد',
  'مصاريف مطابقة حسابات السلك وي',
  'مصاريف شقة كربلاء',
  'مصاريف الضمان الاجتماعي',
  'مصاريف الحملة الإعلانية (أنفال)',
  'مصاريف الموقع الجديد',
];

async function main() {
  console.log('🚀 Replacing all expense accounts with custom 39 accounts in Database...');

  const companies = await prisma.company.findMany();

  for (const comp of companies) {
    console.log(`Processing company: ${comp.name} (${comp.id})`);

    // 1. Find or create Root 3: الاستخدامات (المصروفات)
    let root3 = await prisma.account.findFirst({
      where: {
        companyId: comp.id,
        code: '3',
      },
    });

    if (!root3) {
      root3 = await prisma.account.create({
        data: {
          code: '3',
          nameAr: 'الاستخدامات (المصروفات)',
          type: AccountType.EXPENSE,
          category: AccountCategory.GENERAL,
          isParent: true,
          level: 1,
          companyId: comp.id,
          tenantId: comp.tenantId,
          currency: 'IQD',
          balance: 0,
        },
      });
    }

    // 2. Delete all existing level 2, 3, 4, 5 accounts under code '3' or type EXPENSE (except root 3 and 34 cost of goods)
    await prisma.account.deleteMany({
      where: {
        companyId: comp.id,
        code: { startsWith: '3' },
        NOT: [
          { code: '3' },
          { code: '34' },
          { code: '341' },
          { code: '3411' },
          { code: '3412' },
          { code: '342' },
          { code: '343' },
          { code: '344' },
          { code: '345' },
          { code: '346' },
          { code: '347' },
          { code: '348' },
          { code: '349' },
        ],
      },
    });

    // Also delete any other standalone old EXPENSE accounts that are not in 3 or 34
    await prisma.account.deleteMany({
      where: {
        companyId: comp.id,
        type: AccountType.EXPENSE,
        NOT: [
          { code: '3' },
          { code: { startsWith: '34' } },
        ],
      },
    });

    console.log('Deleted old expense accounts.');

    // 3. Insert the 39 custom expense accounts
    for (let i = 0; i < CUSTOM_EXPENSES.length; i++) {
      const codeNum = 301 + i;
      const code = String(codeNum);
      const nameAr = CUSTOM_EXPENSES[i];

      await prisma.account.create({
        data: {
          code,
          nameAr,
          type: AccountType.EXPENSE,
          category: AccountCategory.GENERAL,
          isParent: false,
          level: 2,
          parentId: root3.id,
          companyId: comp.id,
          tenantId: comp.tenantId,
          balance: 0,
          currency: 'IQD',
          isSystem: true,
          branchScope: 'ALL_BRANCHES',
        },
      });
    }

    console.log(`Created ${CUSTOM_EXPENSES.length} custom expense accounts for company ${comp.name}.`);
  }

  console.log('🎉 ALL 39 CUSTOM EXPENSE ACCOUNTS REPLACED SUCCESSFULLY IN THE DATABASE!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
