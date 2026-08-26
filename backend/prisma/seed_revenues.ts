import { PrismaClient, AccountType, AccountCategory } from '@prisma/client';

const prisma = new PrismaClient();

const REVENUE_ACCOUNTS = [
  { code: '41', nameAr: 'إيرادات النشاط الجاري والخدمات', level: 2, isParent: true, parentCode: '4' },
  { code: '411', nameAr: 'إيرادات خدمات السفر والسياحة', level: 3, isParent: true, parentCode: '41' },
  { code: '4111', nameAr: 'إيرادات وعمولات تذاكر الطيران', level: 4, isParent: false, parentCode: '411' },
  { code: '4112', nameAr: 'إيرادات خدمات التأشيرات', level: 4, isParent: false, parentCode: '411' },
  { code: '4113', nameAr: 'إيرادات وعمولات الحجوزات الفندقية', level: 4, isParent: false, parentCode: '411' },
  { code: '4114', nameAr: 'إيرادات تغيير وإعادة إصدار التذاكر', level: 4, isParent: false, parentCode: '411' },
  { code: '4108', nameAr: 'مردودات المبيعات والخدمات', level: 3, isParent: false, parentCode: '41' },
];

async function main() {
  const companies = await prisma.company.findMany();
  for (const comp of companies) {
    const existing = await prisma.account.findMany({ where: { companyId: comp.id } });
    const codeMap = new Map<string, string>();
    existing.forEach((a) => codeMap.set(a.code, a.id));

    // Ensure root 4 exists
    let root4Id = codeMap.get('4');
    if (!root4Id) {
      const createdRoot = await prisma.account.create({
        data: {
          code: '4',
          nameAr: 'الموارد (الإيرادات)',
          type: AccountType.REVENUE,
          category: AccountCategory.GENERAL,
          isParent: true,
          level: 1,
          companyId: comp.id,
          tenantId: comp.tenantId,
        },
      });
      root4Id = createdRoot.id;
      codeMap.set('4', root4Id);
    }

    for (const def of REVENUE_ACCOUNTS) {
      const parentId = def.parentCode ? codeMap.get(def.parentCode) || null : null;
      const existingId = codeMap.get(def.code);

      if (existingId) {
        const updated = await prisma.account.update({
          where: { id: existingId },
          data: {
            nameAr: def.nameAr,
            type: AccountType.REVENUE,
            isParent: def.isParent,
            level: def.level,
            parentId: parentId || undefined,
          },
        });
        codeMap.set(def.code, updated.id);
      } else {
        const created = await prisma.account.create({
          data: {
            code: def.code,
            nameAr: def.nameAr,
            type: AccountType.REVENUE,
            category: AccountCategory.GENERAL,
            isParent: def.isParent,
            level: def.level,
            parentId,
            companyId: comp.id,
            tenantId: comp.tenantId,
            balance: 0,
            currency: 'MULTI',
            isSystem: true,
            branchScope: 'ALL_BRANCHES',
          },
        });
        codeMap.set(def.code, created.id);
      }
    }
  }

  console.log('🎉 Seeded standard revenue accounts (4111, 4112, 4113, 4114, 4108) successfully into Database!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
