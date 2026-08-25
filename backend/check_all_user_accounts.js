const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  for (const u of users) {
    console.log(`User: ${u.email} | companyId: ${u.companyId}`);
    const accs = await prisma.account.findMany({ where: { companyId: u.companyId } });
    const roots = accs.filter(a => a.parentId === null);
    console.log(` -> Total accounts: ${accs.length} | Roots: ${roots.map(r => `[${r.code}] ${r.nameAr}`).join(', ')}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
