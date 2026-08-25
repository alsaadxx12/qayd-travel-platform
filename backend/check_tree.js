const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.account.findMany({
    where: { code: { startsWith: '183' } },
    select: { id: true, code: true, nameAr: true, parentId: true, level: true },
    orderBy: { code: 'asc' },
  });
  
  // Get parent names
  const parentIds = [...new Set(accounts.map(a => a.parentId).filter(Boolean))];
  const parents = await prisma.account.findMany({
    where: { id: { in: parentIds } },
    select: { id: true, code: true, nameAr: true },
  });
  const parentMap = {};
  parents.forEach(p => { parentMap[p.id] = `${p.code} ${p.nameAr}`; });

  console.log('\n=== Accounts starting with 183 ===');
  accounts.forEach(a => {
    const parentLabel = a.parentId ? (parentMap[a.parentId] || a.parentId) : 'ROOT';
    console.log(`  ${a.code} | ${a.nameAr} | parent: ${parentLabel} | level: ${a.level}`);
  });
  
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
