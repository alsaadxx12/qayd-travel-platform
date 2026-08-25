const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clean() {
  const company = await prisma.company.findFirst();
  const old26Accounts = await prisma.account.findMany({
    where: {
      companyId: company.id,
      code: { startsWith: '26' }
    },
    include: {
      journalLines: true,
      children: true,
    }
  });

  console.log('Found old 26* accounts:', old26Accounts.length);
  for (const acc of old26Accounts) {
    if (acc.journalLines.length === 0 && acc.children.length === 0) {
      await prisma.account.delete({ where: { id: acc.id } });
      console.log(`Deleted unused legacy account [${acc.code}] ${acc.nameAr}`);
    }
  }
}

clean().catch(console.error).finally(() => prisma.$disconnect());
