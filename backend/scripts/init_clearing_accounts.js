const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const companies = await prisma.company.findMany();
  for (const company of companies) {
    const root9 = await prisma.account.upsert({
      where: { companyId_code: { companyId: company.id, code: '9' } },
      update: {},
      create: {
        companyId: company.id,
        code: '9',
        nameAr: 'الحسابات النظامية والتصفيات الخارجية',
        type: 'LIABILITY',
        isParent: true,
        level: 1,
        isSystem: true,
        currency: 'IQD',
      },
    });

    const sub91 = await prisma.account.upsert({
      where: { companyId_code: { companyId: company.id, code: '91' } },
      update: {},
      create: {
        companyId: company.id,
        code: '91',
        nameAr: 'حسابات التصفيات والمطابقات الخارجية',
        type: 'LIABILITY',
        isParent: true,
        parentId: root9.id,
        level: 2,
        isSystem: true,
        currency: 'IQD',
      },
    });

    const sub911 = await prisma.account.upsert({
      where: { companyId_code: { companyId: company.id, code: '911' } },
      update: {},
      create: {
        companyId: company.id,
        code: '911',
        nameAr: 'حسابات تصفية البورصة وتداول السيولة',
        type: 'LIABILITY',
        isParent: true,
        parentId: sub91.id,
        level: 3,
        isSystem: true,
        currency: 'USD',
      },
    });

    const sub912 = await prisma.account.upsert({
      where: { companyId_code: { companyId: company.id, code: '912' } },
      update: {},
      create: {
        companyId: company.id,
        code: '912',
        nameAr: 'حسابات تصفية المكاتب والشركات الوسيطة',
        type: 'LIABILITY',
        isParent: true,
        parentId: sub91.id,
        level: 3,
        isSystem: true,
        currency: 'USD',
      },
    });

    const sub913 = await prisma.account.upsert({
      where: { companyId_code: { companyId: company.id, code: '913' } },
      update: {},
      create: {
        companyId: company.id,
        code: '913',
        nameAr: 'حسابات مقاصة العمليات المعلقة',
        type: 'LIABILITY',
        isParent: true,
        parentId: sub91.id,
        level: 3,
        isSystem: true,
        currency: 'IQD',
      },
    });

    console.log(`Initialized Clearing Roots for company ${company.name} (${company.id})`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
