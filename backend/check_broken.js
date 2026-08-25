const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findFirst();
  const roots = await prisma.account.findMany({
    where: { companyId: company.id, parentId: null }
  });
  console.log('COMPANY ROOTS:');
  roots.forEach(r => console.log(`[${r.code}] id: ${r.id} - ${r.nameAr}`));

  const allAccounts = await prisma.account.findMany({
    where: { companyId: company.id }
  });
  const idMap = new Map(allAccounts.map(a => [a.id, a]));
  const brokenParents = allAccounts.filter(a => a.parentId && !idMap.has(a.parentId));
  console.log('\nBROKEN PARENTS COUNT:', brokenParents.length);
  brokenParents.forEach(b => {
    console.log(`[${b.code}] ${b.nameAr} has parentId ${b.parentId} which DOES NOT EXIST in this company!`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
