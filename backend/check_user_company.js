const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: { company: true }
  });
  console.log('USERS IN DB:');
  users.forEach(u => {
    console.log(`User: ${u.email} | name: ${u.name} | companyId: ${u.companyId} | companyName: ${u.company.name}`);
  });

  const companies = await prisma.company.findMany();
  console.log('\nCOMPANIES IN DB:');
  companies.forEach(c => {
    console.log(`Company ID: ${c.id} | Code: ${c.code} | Name: ${c.name}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
