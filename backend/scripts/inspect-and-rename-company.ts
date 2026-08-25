import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const branches = await prisma.branch.findMany();
  console.log('Branches:', branches.map(b => ({ id: b.id, nameAr: b.nameAr, nameEn: b.nameEn })));

  for (const b of branches) {
    if (b.nameAr?.includes('الفرسان') || b.nameEn?.includes('الفرسان')) {
      await prisma.branch.update({
        where: { id: b.id },
        data: {
          nameAr: b.nameAr.replace(/شركة الفرسان/g, 'مؤسسة قسطاس'),
          nameEn: b.nameEn?.replace(/Al-Forsan/g, 'Qistas'),
        },
      });
      console.log(`Updated branch ${b.id}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
