import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const companies = await prisma.company.findMany();

  for (const c of companies) {
    // 1. Ensure root 2 (الالتزامات وحقوق الملكية) / 26 (حقوق الملكية)
    let parent26 = await prisma.account.findFirst({
      where: {
        companyId: c.id,
        OR: [{ code: '26' }, { code: '2' }],
      },
    });

    // 2. Ensure 264 - حساب العمليات الجارية للشركاء
    let acc264 = await prisma.account.findFirst({
      where: { code: '264', companyId: c.id },
    });

    if (!acc264) {
      acc264 = await prisma.account.create({
        data: {
          code: '264',
          nameAr: 'حساب العمليات الجارية للشركاء (توزيع أرباح وخسائر)',
          nameEn: 'Partners Current and Operations Account',
          type: 'EQUITY',
          category: 'GENERAL',
          isParent: true,
          parentId: parent26?.id || null,
          currency: 'MULTI',
          companyId: c.id,
        },
      });
      console.log(`Created account 264 for company ${c.name}`);
    }

    // 3. Create sample leaf under 264: 2641 - جاري الشركاء
    let acc2641 = await prisma.account.findFirst({
      where: { code: '2641', companyId: c.id },
    });
    if (!acc2641) {
      await prisma.account.create({
        data: {
          code: '2641',
          nameAr: 'جاري الشركاء والمالكين',
          nameEn: 'Partners Current Accounts',
          type: 'EQUITY',
          category: 'GENERAL',
          isParent: false,
          parentId: acc264.id,
          currency: 'MULTI',
          companyId: c.id,
        },
      });
      console.log(`Created account 2641 for company ${c.name}`);
    }
  }

  console.log('✅ Partners account 264 created successfully!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
