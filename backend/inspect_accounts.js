const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.account.findMany({
    orderBy: { code: 'asc' }
  });
  console.log('TOTAL ACCOUNTS IN DB:', accounts.length);
  accounts.forEach(a => {
    console.log(`[${a.code}] (level ${a.level}) ${a.nameAr} | parent: ${a.parentId || 'ROOT'} | isParent: ${a.isParent}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
