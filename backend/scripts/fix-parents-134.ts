import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const companies = await prisma.company.findMany();

  for (const c of companies) {
    // 1. Fix 33664 parent to 3366
    const p3366 = await prisma.account.findFirst({ where: { code: '3366', companyId: c.id } });
    if (p3366) {
      await prisma.account.updateMany({
        where: { code: '33664', companyId: c.id },
        data: { parentId: p3366.id },
      });
    }

    // 2. Fix 232154 parent to 23215
    const p23215 = await prisma.account.findFirst({ where: { code: '23215', companyId: c.id } });
    if (p23215) {
      await prisma.account.updateMany({
        where: { code: '232154', companyId: c.id },
        data: { parentId: p23215.id },
      });
    }

    // 3. Fix 13421301 code to 1343101 and parent to 13431
    const p13431 = await prisma.account.findFirst({ where: { code: '13431', companyId: c.id } });
    if (p13431) {
      const oldMaster = await prisma.account.findFirst({
        where: {
          companyId: c.id,
          OR: [{ code: '13421301' }, { code: '1343101' }],
        },
      });
      if (oldMaster) {
        await prisma.account.update({
          where: { id: oldMaster.id },
          data: {
            code: '1343101',
            nameAr: 'ماستر 1 الوكيل',
            nameEn: 'Master 1 Agent',
            parentId: p13431.id,
            category: 'BANK',
            currency: 'MULTI',
          },
        });
        console.log(`Updated Master 1 to 1343101 under parent 13431 in company ${c.name}`);
      }
    }
  }

  console.log('✅ Fix parents completed!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
