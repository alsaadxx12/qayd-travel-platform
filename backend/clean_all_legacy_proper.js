const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function recursiveDelete(accountId) {
  const children = await prisma.account.findMany({ where: { parentId: accountId } });
  for (const c of children) {
    await recursiveDelete(c.id);
  }
  const lines = await prisma.journalEntryLine.count({ where: { accountId } });
  if (lines === 0) {
    await prisma.account.delete({ where: { id: accountId } });
    console.log(`Deleted account ID: ${accountId}`);
  }
}

async function main() {
  const companyId = 'd2c3297a-e40a-4096-8fcf-b7170a44832c';
  
  const mainCash = await prisma.account.findFirst({ where: { companyId, code: '1811' } });
  const mainBank = await prisma.account.findFirst({ where: { companyId, code: '1821' } });

  await prisma.cashbox.updateMany({
    where: { companyId },
    data: { accountId: mainCash.id }
  });

  await prisma.bank.updateMany({
    where: { companyId },
    data: { accountId: mainBank.id }
  });

  const legacyRoots = await prisma.account.findMany({
    where: { companyId, code: { in: ['1000', '2000', '3000', '4000'] } }
  });

  for (const r of legacyRoots) {
    console.log(`Recursively cleaning [${r.code}] ${r.nameAr}`);
    await recursiveDelete(r.id);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
