const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findFirst();
  const accounts = await prisma.account.findMany({
    where: { companyId: company.id },
    orderBy: { code: 'asc' }
  });

  console.log('Total accounts for company:', accounts.length);
  const byCode = new Map(accounts.map(a => [a.code, a]));
  
  const rootCodes = ['1', '2', '3', '4'];
  rootCodes.forEach(c => {
    const root = byCode.get(c);
    console.log(`Root [${c}]:`, root ? `${root.nameAr} (id: ${root.id}, parentId: ${root.parentId})` : 'MISSING!');
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
