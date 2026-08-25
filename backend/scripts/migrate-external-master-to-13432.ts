import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting External Master Migration to 13432 (Assets/Debits)...');

  const companies = await prisma.company.findMany();

  for (const company of companies) {
    console.log(`Processing company: ${company.name} (${company.id})`);

    // 1. Find or create 1343 (بطاقات ومحافظ الدفع الإلكتروني)
    let parent1343 = await prisma.account.findFirst({
      where: { code: '1343', companyId: company.id },
    });

    if (!parent1343) {
      const root134 = await prisma.account.findFirst({
        where: { code: '134', companyId: company.id },
      });
      parent1343 = await prisma.account.create({
        data: {
          code: '1343',
          nameAr: 'بطاقات ومحافظ الدفع الإلكتروني (MasterCard / Wallets)',
          nameEn: 'Electronic Payment Cards and Wallets',
          type: 'ASSET',
          category: 'BANK',
          isParent: true,
          parentId: root134?.id || null,
          currency: 'MULTI',
          companyId: company.id,
        },
      });
    }

    // 2. Ensure 13432 (بطاقات Master وحسابات التسوية الخارجية)
    let acc13432 = await prisma.account.findFirst({
      where: { code: '13432', companyId: company.id },
    });

    if (!acc13432) {
      acc13432 = await prisma.account.create({
        data: {
          code: '13432',
          nameAr: 'بطاقات Master وحسابات التسوية الخارجية',
          nameEn: 'External Master Cards and Settlement Accounts',
          type: 'ASSET',
          category: 'BANK',
          isParent: true,
          parentId: parent1343.id,
          currency: 'MULTI',
          companyId: company.id,
        },
      });
      console.log(`Created parent 13432 under 1343 for ${company.name}`);
    } else {
      await prisma.account.update({
        where: { id: acc13432.id },
        data: {
          nameAr: 'بطاقات Master وحسابات التسوية الخارجية',
          nameEn: 'External Master Cards and Settlement Accounts',
          type: 'ASSET',
          category: 'BANK',
          isParent: true,
          parentId: parent1343.id,
          currency: 'MULTI',
        },
      });
    }

    // 3. Find leaf accounts starting with 232146 or matching external master
    const oldLeaves = await prisma.account.findMany({
      where: {
        companyId: company.id,
        isParent: false,
        OR: [
          { code: { startsWith: '232146' } },
          { nameAr: { contains: 'ماستر 2' } },
          { nameAr: { contains: 'Master 2' } },
          { nameAr: { contains: 'ماستر خارجي' } },
          { nameAr: { contains: 'Master خارجي' } },
        ],
      },
    });

    let index = 1;
    for (const leaf of oldLeaves) {
      const newCode = `13432${String(index).padStart(2, '0')}`;
      index++;

      await prisma.account.update({
        where: { id: leaf.id },
        data: {
          code: newCode,
          parentId: acc13432.id,
          type: 'ASSET',
          category: 'BANK',
          currency: 'MULTI',
        },
      });
      console.log(`Updated leaf ${leaf.nameAr} to code ${newCode} under parent 13432`);
    }

    // 4. Delete old parent 232146 if it exists
    await prisma.account.deleteMany({
      where: { code: '232146', companyId: company.id },
    }).catch(() => {});
  }

  console.log('✅ External Master Migration to 13432 Completed Successfully!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
