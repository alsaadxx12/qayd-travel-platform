const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.account.findMany({
    where: { OR: [{ type: 'REVENUE' }, { type: 'EXPENSE' }] },
    select: { id: true, code: true, nameAr: true, type: true },
  });
  console.log('REVENUE & EXPENSE ACCOUNTS:', accounts);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
