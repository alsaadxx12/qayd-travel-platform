const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const companyId = 'd2c3297a-e40a-4096-8fcf-b7170a44832c';
  const roots = await prisma.account.findMany({
    where: { companyId, parentId: null }
  });
  console.log('Current Roots in Travel Company:');
  for (const r of roots) {
    const count = await prisma.account.count({ where: { parentId: r.id } });
    console.log(`- [${r.code}] ${r.nameAr} (children: ${count})`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
