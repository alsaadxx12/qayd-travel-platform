const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findFirst();
  console.log('COMPANY ID:', company.id);
  
  const rootAccounts = await prisma.account.findMany({
    where: { companyId: company.id, parentId: null }
  });
  console.log('ROOT ACCOUNTS (parentId: null):');
  rootAccounts.forEach(r => console.log(`- [${r.code}] ${r.nameAr}`));

  const allAccs = await prisma.account.findMany({
    where: { companyId: company.id }
  });
  console.log('\nALL ACCOUNTS IN COMPANY:', allAccs.length);
  allAccs.forEach(a => {
    console.log(`code: ${a.code}, name: ${a.nameAr}, parentId: ${a.parentId}, isParent: ${a.isParent}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
