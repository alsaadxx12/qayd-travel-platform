const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const companyId = 'd2c3297a-e40a-4096-8fcf-b7170a44832c';

  const node14 = await prisma.account.findFirst({ where: { companyId, code: '14' } });
  const node24 = await prisma.account.findFirst({ where: { companyId, code: '24' } });
  const node21 = await prisma.account.findFirst({ where: { companyId, code: '21' } });
  const node41 = await prisma.account.findFirst({ where: { companyId, code: '41' } });

  // 1. Move any children of 1120 to 14 (or move 1120 itself under 14)
  const acc1120 = await prisma.account.findFirst({ where: { companyId, code: '1120' } });
  if (acc1120 && node14) {
    await prisma.account.updateMany({
      where: { companyId, parentId: acc1120.id },
      data: { parentId: node14.id }
    });
    try {
      await prisma.account.delete({ where: { id: acc1120.id } });
      console.log('Deleted 1120 after reparenting children to 14');
    } catch (e) {
      await prisma.account.update({ where: { id: acc1120.id }, data: { parentId: node14.id } });
    }
  }

  // 2. Move any children of 2100 to 24
  const acc2100 = await prisma.account.findFirst({ where: { companyId, code: '2100' } });
  if (acc2100 && node24) {
    await prisma.account.updateMany({
      where: { companyId, parentId: acc2100.id },
      data: { parentId: node24.id }
    });
    try {
      await prisma.account.delete({ where: { id: acc2100.id } });
      console.log('Deleted 2100 after reparenting children to 24');
    } catch (e) {
      await prisma.account.update({ where: { id: acc2100.id }, data: { parentId: node24.id } });
    }
  }

  // 3. Move 3000 to 21
  const acc3000 = await prisma.account.findFirst({ where: { companyId, code: '3000' } });
  if (acc3000 && node21) {
    await prisma.account.updateMany({
      where: { companyId, parentId: acc3000.id },
      data: { parentId: node21.id }
    });
    try {
      await prisma.account.delete({ where: { id: acc3000.id } });
      console.log('Deleted 3000');
    } catch (e) {
      await prisma.account.update({ where: { id: acc3000.id }, data: { parentId: node21.id } });
    }
  }

  // 4. Move 4000 and 4100 to 41
  const acc4000 = await prisma.account.findFirst({ where: { companyId, code: '4000' } });
  if (acc4000 && node41) {
    await prisma.account.updateMany({
      where: { companyId, parentId: acc4000.id },
      data: { parentId: node41.id }
    });
    try {
      await prisma.account.delete({ where: { id: acc4000.id } });
      console.log('Deleted 4000');
    } catch (e) {
      await prisma.account.update({ where: { id: acc4000.id }, data: { parentId: node41.id } });
    }
  }

  const acc4100 = await prisma.account.findFirst({ where: { companyId, code: '4100' } });
  if (acc4100 && node41) {
    await prisma.account.update({ where: { id: acc4100.id }, data: { parentId: node41.id } });
    console.log('Re-parented 4100 under 41');
  }

  // Check Final Roots
  const roots = await prisma.account.findMany({
    where: { companyId, parentId: null },
    orderBy: { code: 'asc' }
  });
  console.log('\n=============================================');
  console.log('CLEAN OFFICIAL ROOTS IN TRAVEL COMPANY:');
  roots.forEach(r => console.log(`[${r.code}] ${r.nameAr}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
