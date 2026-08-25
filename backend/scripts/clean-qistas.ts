import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Inspect Tenants
  const tenants = await prisma.tenant.findMany();
  console.log('Tenants:', tenants.map(t => ({ id: t.id, name: t.name, slug: t.slug })));

  // 2. Inspect Companies
  const companies = await prisma.company.findMany();
  console.log('Companies:', companies.map(c => ({ id: c.id, name: c.name })));

  // 3. Inspect Branches
  const branches = await prisma.branch.findMany();
  console.log('Branches:', branches.map(b => ({ id: b.id, nameAr: b.nameAr, nameEn: b.nameEn })));

  // 4. Update tenant name
  for (const t of tenants) {
    if (t.name.includes('قسطاس') || t.slug.includes('qistas')) {
      await prisma.tenant.update({
        where: { id: t.id },
        data: {
          name: 'شركة الروضتين للسياحة والسفر',
          slug: 'al-rawdhatain',
        },
      });
      console.log(`Updated Tenant ${t.id} to شركة الروضتين للسياحة والسفر`);
    }
  }

  // 5. Update companies
  for (const c of companies) {
    if (c.name.includes('قسطاس')) {
      await prisma.company.update({
        where: { id: c.id },
        data: {
          name: 'شركة الروضتين للسياحة والسفر',
        },
      });
      console.log(`Updated Company ${c.id} to شركة الروضتين للسياحة والسفر`);
    }
  }

  // 6. Update branches
  for (const b of branches) {
    if (b.nameAr?.includes('قسطاس')) {
      await prisma.branch.update({
        where: { id: b.id },
        data: {
          nameAr: b.nameAr.replace(/مؤسسة قسطاس/g, 'شركة الروضتين'),
        },
      });
    }
  }

  console.log('Done cleaning Qistas mentions!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
