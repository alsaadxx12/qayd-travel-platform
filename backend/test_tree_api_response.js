const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { AccountsService } = require('./dist/accounts/accounts.service');

async function main() {
  const service = new AccountsService(prisma);
  const user = await prisma.user.findFirst({ where: { email: 'alsaady.rrr123rt@gmail.com' } });
  console.log('User companyId:', user.companyId);

  const tree = await service.getTree(user.companyId);
  console.log('Tree Roots count:', tree.length);
  tree.forEach(r => {
    console.log(`Root [${r.code}] ${r.nameAr} | isGroup: ${r.isGroup} | isParent: ${r.isParent} | children: ${r.children.length}`);
    r.children.forEach(c => {
      console.log(`  ├── [${c.code}] ${c.nameAr} | isGroup: ${c.isGroup} | children: ${c.children.length}`);
    });
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
