import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.account.findMany({
    where: {
      OR: [
        { code: { startsWith: '134' } },
        { code: { startsWith: '232146' } },
        { code: { startsWith: '18' } },
      ],
    },
    orderBy: { code: 'asc' },
    select: {
      id: true,
      code: true,
      nameAr: true,
      isParent: true,
      parentId: true,
      currency: true,
      companyId: true,
    },
  });

  console.log('Found accounts:', accounts.length);
  for (const a of accounts) {
    console.log(`[${a.code}] ${a.nameAr} | isParent=${a.isParent} | parentId=${a.parentId} | curr=${a.currency} | comp=${a.companyId}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
