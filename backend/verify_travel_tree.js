const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const companyId = 'd2c3297a-e40a-4096-8fcf-b7170a44832c';
  const accounts = await prisma.account.findMany({
    where: { companyId },
    orderBy: { code: 'asc' }
  });

  const roots = accounts.filter(a => a.parentId === null);
  console.log(`TRAVEL COMPANY ROOTS COUNT: ${roots.length}`);
  roots.forEach(r => {
    const children = accounts.filter(a => a.parentId === r.id);
    console.log(`Root [${r.code}] ${r.nameAr} - children count: ${children.length}`);
    children.forEach(c => {
      const sub = accounts.filter(a => a.parentId === c.id);
      console.log(`   ├── [${c.code}] ${c.nameAr} - children count: ${sub.length}`);
    });
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
