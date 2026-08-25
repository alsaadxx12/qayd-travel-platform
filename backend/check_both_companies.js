const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const companies = await prisma.company.findMany();
  console.log('Companies in DB:', companies);

  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, companyId: true }
  });
  console.log('Users in DB:', users);

  for (const c of companies) {
    const accs = await prisma.account.findMany({ where: { companyId: c.id } });
    console.log(`\n=== Company ${c.id} (${c.name}) has ${accs.length} accounts ===`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
