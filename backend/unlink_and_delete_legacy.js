const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const companyId = 'd2c3297a-e40a-4096-8fcf-b7170a44832c';
  
  // 1. Unlink parentId for all legacy accounts
  const legacyCodes = ['1000', '1100', '1200', '1110', '1120', '1130', '1140', '1150', '2000', '2100', '2200', '3000', '3100', '4000', '4100', '4200', '5000', '5100', '5200'];
  
  await prisma.account.updateMany({
    where: { companyId, code: { in: legacyCodes } },
    data: { parentId: null }
  });

  // 2. Delete all legacy accounts
  for (const code of legacyCodes) {
    const accs = await prisma.account.findMany({ where: { companyId, code } });
    for (const a of accs) {
      try {
        await prisma.account.delete({ where: { id: a.id } });
        console.log(`Deleted [${code}]`);
      } catch (e) {
        console.log(`Could not delete [${code}]:`, e.message);
      }
    }
  }

  // Check remaining roots
  const roots = await prisma.account.findMany({ where: { companyId, parentId: null } });
  console.log('\nFINAL ROOTS IN TRAVEL COMPANY:');
  roots.forEach(r => console.log(`[${r.code}] ${r.nameAr}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
