const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const legacyCodes = ['1000', '2000', '3000', '4000', '5000'];
  for (const code of legacyCodes) {
    const accs = await prisma.account.findMany({ where: { code } });
    for (const acc of accs) {
      await prisma.account.delete({ where: { id: acc.id } });
      console.log(`Deleted legacy root [${acc.code}] for company ${acc.companyId}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
