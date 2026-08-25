import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting 134 Clean Hierarchy Migration...');

  const companies = await prisma.company.findMany({ select: { id: true, name: true } });

  for (const company of companies) {
    console.log(`Processing company: ${company.name} (${company.id})`);

    // 1. Find root 134 (النقود والأرصدة)
    let root134 = await prisma.account.findFirst({
      where: { code: '134', companyId: company.id },
    });

    if (!root134) {
      const root13 = await prisma.account.findFirst({
        where: { code: '13', companyId: company.id },
      });
      root134 = await prisma.account.create({
        data: {
          code: '134',
          nameAr: 'النقود والأرصدة النقدية',
          nameEn: 'Cash and Cash Equivalents',
          type: 'ASSET',
          category: 'CASH',
          isParent: true,
          parentId: root13?.id || null,
          currency: 'MULTI',
          companyId: company.id,
        },
      });
    }

    // 2. Ensure 1341 (نقدية بالصندوق)
    let acc1341 = await prisma.account.findFirst({
      where: { code: '1341', companyId: company.id },
    });
    if (acc1341) {
      await prisma.account.update({
        where: { id: acc1341.id },
        data: {
          nameAr: 'نقدية بالصندوق (الصناديق النقدية)',
          nameEn: 'Cash in Hand',
          parentId: root134.id,
          currency: 'MULTI',
        },
      });
    } else {
      acc1341 = await prisma.account.create({
        data: {
          code: '1341',
          nameAr: 'نقدية بالصندوق (الصناديق النقدية)',
          nameEn: 'Cash in Hand',
          type: 'ASSET',
          category: 'CASH',
          isParent: true,
          parentId: root134.id,
          currency: 'MULTI',
          companyId: company.id,
        },
      });
    }

    // 13411 (صندوق المركز) & 13412 (صندوق الفروع)
    let acc13411 = await prisma.account.findFirst({
      where: { code: '13411', companyId: company.id, isParent: true },
    });
    if (!acc13411) {
      acc13411 = await prisma.account.findFirst({
        where: { code: '13411', companyId: company.id },
      });
    }
    if (acc13411 && acc13411.isParent) {
      await prisma.account.update({
        where: { id: acc13411.id },
        data: { nameAr: 'نقدية لدى صندوق المركز الرئيسي', parentId: acc1341.id, currency: 'MULTI' },
      });
    }

    let acc13412 = await prisma.account.findFirst({
      where: { code: '13412', companyId: company.id },
    });
    if (!acc13412) {
      acc13412 = await prisma.account.create({
        data: {
          code: '13412',
          nameAr: 'نقدية لدى صندوق الفروع والموظفين',
          nameEn: 'Branch and Staff Cashboxes',
          type: 'ASSET',
          category: 'CASH',
          isParent: true,
          parentId: acc1341.id,
          currency: 'MULTI',
          companyId: company.id,
        },
      });
    } else {
      await prisma.account.update({
        where: { id: acc13412.id },
        data: { nameAr: 'نقدية لدى صندوق الفروع والموظفين', isParent: true, parentId: acc1341.id, currency: 'MULTI' },
      });
    }

    // 3. Ensure 1342 (نقدية لدى المصارف)
    let acc1342 = await prisma.account.findFirst({
      where: { code: '1342', companyId: company.id },
    });
    if (acc1342) {
      await prisma.account.update({
        where: { id: acc1342.id },
        data: {
          nameAr: 'نقدية لدى المصارف (الحسابات المصرفية)',
          nameEn: 'Cash at Banks',
          parentId: root134.id,
          currency: 'MULTI',
        },
      });
    } else {
      acc1342 = await prisma.account.create({
        data: {
          code: '1342',
          nameAr: 'نقدية لدى المصارف (الحسابات المصرفية)',
          nameEn: 'Cash at Banks',
          type: 'ASSET',
          category: 'BANK',
          isParent: true,
          parentId: root134.id,
          currency: 'MULTI',
          companyId: company.id,
        },
      });
    }

    // Ensure 13421 (الحسابات المصرفية الجارية)
    let acc13421 = await prisma.account.findFirst({
      where: { code: '13421', companyId: company.id },
    });
    if (acc13421) {
      await prisma.account.update({
        where: { id: acc13421.id },
        data: {
          nameAr: 'الحسابات المصرفية الجارية',
          nameEn: 'Current Bank Accounts',
          isParent: true,
          parentId: acc1342.id,
          currency: 'MULTI',
        },
      });
    } else {
      acc13421 = await prisma.account.create({
        data: {
          code: '13421',
          nameAr: 'الحسابات المصرفية الجارية',
          nameEn: 'Current Bank Accounts',
          type: 'ASSET',
          category: 'BANK',
          isParent: true,
          parentId: acc1342.id,
          currency: 'MULTI',
          companyId: company.id,
        },
      });
    }

    // 4. Ensure 1343 (بطاقات ومحافظ الدفع الإلكتروني)
    let acc1343 = await prisma.account.findFirst({
      where: { code: '1343', companyId: company.id },
    });
    if (acc1343) {
      await prisma.account.update({
        where: { id: acc1343.id },
        data: {
          nameAr: 'بطاقات ومحافظ الدفع الإلكتروني (MasterCard / Wallets)',
          nameEn: 'Electronic Payment Cards and Wallets',
          isParent: true,
          parentId: root134.id,
          category: 'BANK',
          currency: 'MULTI',
        },
      });
    } else {
      acc1343 = await prisma.account.create({
        data: {
          code: '1343',
          nameAr: 'بطاقات ومحافظ الدفع الإلكتروني (MasterCard / Wallets)',
          nameEn: 'Electronic Payment Cards and Wallets',
          type: 'ASSET',
          category: 'BANK',
          isParent: true,
          parentId: root134.id,
          currency: 'MULTI',
          companyId: company.id,
        },
      });
    }

    // Ensure 13431 (بطاقات Master والمحافظ الداخلية)
    let acc13431 = await prisma.account.findFirst({
      where: { code: '13431', companyId: company.id },
    });
    if (!acc13431) {
      acc13431 = await prisma.account.create({
        data: {
          code: '13431',
          nameAr: 'بطاقات Master والمحافظ الداخلية',
          nameEn: 'Internal Master Cards and Wallets',
          type: 'ASSET',
          category: 'BANK',
          isParent: true,
          parentId: acc1343.id,
          currency: 'MULTI',
          companyId: company.id,
        },
      });
    } else {
      await prisma.account.update({
        where: { id: acc13431.id },
        data: {
          nameAr: 'بطاقات Master والمحافظ الداخلية',
          nameEn: 'Internal Master Cards and Wallets',
          isParent: true,
          parentId: acc1343.id,
          currency: 'MULTI',
        },
      });
    }

    // Move any existing Master leaf account (like ماستر 1) to be under 13431!
    const masterLeaves = await prisma.account.findMany({
      where: {
        companyId: company.id,
        isParent: false,
        OR: [
          { code: { startsWith: '134213' } },
          { code: { startsWith: '13431' } },
          { nameAr: { contains: 'ماستر' } },
          { nameAr: { contains: 'Master' } },
        ],
      },
    });

    for (const mLeaf of masterLeaves) {
      if (mLeaf.code.startsWith('232146')) continue; // skip external suppliers
      await prisma.account.update({
        where: { id: mLeaf.id },
        data: {
          parentId: acc13431.id,
          currency: 'MULTI',
        },
      });
      console.log(`Linked leaf account ${mLeaf.code} - ${mLeaf.nameAr} to parent 13431`);
    }

    // Clean up empty old currency parent accounts (13422, etc.) if not needed
    const old13422 = await prisma.account.findFirst({
      where: { code: '13422', companyId: company.id },
      include: { children: true },
    });
    if (old13422 && old13422.children.length === 0) {
      await prisma.account.delete({ where: { id: old13422.id } });
      console.log('Removed empty old 13422 parent');
    }
  }

  console.log('✅ 134 Clean Hierarchy Migration Completed Successfully!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
