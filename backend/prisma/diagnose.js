const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      company: true,
      role: true,
      memberships: {
        include: {
          tenant: true,
        },
      },
    },
  });
  console.log('COUNT USERS:', users.length);
  for (const u of users) {
    console.log(JSON.stringify({
      id: u.id,
      email: u.email,
      name: u.name,
      plainPassword: u.plainPassword,
      passwordHashPrefix: u.password.substring(0, 15),
      company: u.company?.name,
      role: u.role?.name,
      memberships: u.memberships.map((m) => ({
        tenant: m.tenant?.name,
        role: m.role,
      })),
    }, null, 2));
  }

  const tenants = await prisma.tenant.findMany({
    include: {
      subscriptions: true,
    },
  });
  console.log('COUNT TENANTS:', tenants.length);
  for (const t of tenants) {
    console.log(JSON.stringify({
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status,
    }, null, 2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
