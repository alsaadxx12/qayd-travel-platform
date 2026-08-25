const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const companyId = 'd2c3297a-e40a-4096-8fcf-b7170a44832c';
  // Find all accounts in this company whose code is 1000, 1100, 1200, 2000, 2100, 3000, 4000, 5000 etc (old demo codes ending in 00 or 000)
  const legacyAccounts = await prisma.account.findMany({
    where: {
      companyId,
      code: { in: ['1000', '1100', '1200', '1110', '1120', '1130', '1140', '1150', '2000', '2100', '2200', '3000', '3100', '4000', '4100', '5000', '5100', '5200'] }
    },
    orderBy: { level: 'desc' }, // delete deepest children first
    include: { journalLines: true }
  });

  console.log(`Found ${legacyAccounts.length} legacy accounts to clean up.`);
  
  // Sort by code length descending and level descending
  legacyAccounts.sort((a, b) => b.code.length - a.code.length || b.level - a.level);

  for (const acc of legacyAccounts) {
    if (acc.journalLines.length === 0) {
      try {
        await prisma.account.delete({ where: { id: acc.id } });
        console.log(`Deleted legacy [${acc.code}] ${acc.nameAr}`);
      } catch (e) {
        // Child still points, will delete on subsequent pass
      }
    }
  }

  // Second pass for parents
  for (const acc of legacyAccounts) {
    try {
      await prisma.account.delete({ where: { id: acc.id } });
      console.log(`Deleted legacy parent [${acc.code}] ${acc.nameAr}`);
    } catch (e) {}
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
