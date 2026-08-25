const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findFirst();
  const accounts = await prisma.account.findMany({
    where: { companyId: company.id },
    orderBy: { code: 'asc' }
  });

  const accountDataMap = new Map();
  accounts.forEach(acc => {
    accountDataMap.set(acc.id, {
      id: acc.id,
      code: acc.code,
      nameAr: acc.nameAr,
      parentId: acc.parentId,
      isParent: acc.isParent,
      children: []
    });
  });

  const tree = [];
  accounts.forEach(acc => {
    const item = accountDataMap.get(acc.id);
    if (acc.parentId && accountDataMap.has(acc.parentId)) {
      accountDataMap.get(acc.parentId).children.push(item);
    } else {
      tree.push(item);
    }
  });

  console.log('TREE ROOTS COUNT:', tree.length);
  tree.forEach(r => {
    console.log(`Root [${r.code}] ${r.nameAr} - children count: ${r.children.length}`);
    r.children.forEach(c => {
      console.log(`   ├── [${c.code}] ${c.nameAr} - children count: ${c.children.length}`);
      c.children.forEach(gc => {
        console.log(`   │      ├── [${gc.code}] ${gc.nameAr}`);
      });
    });
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
