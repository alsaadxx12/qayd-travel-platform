import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const companies = await prisma.company.findMany();

  for (const c of companies) {
    console.log(`Auditing & Aligning core accounts for company: ${c.name} (${c.id})`);

    // 1. رأس المال: Ensure 2611 or 211 is named 'رأس المال المدفوع'
    const capAcc = await prisma.account.findFirst({
      where: {
        companyId: c.id,
        OR: [{ code: '2611' }, { code: '261' }, { code: '211' }],
      },
    });
    if (capAcc) {
      await prisma.account.update({
        where: { id: capAcc.id },
        data: { nameAr: 'رأس المال المدفوع', type: 'EQUITY' },
      });
      console.log(`Fixed Capital Account ${capAcc.code} -> رأس المال المدفوع`);
    }

    // 2. حساب أب الشركاء: Ensure 264 / 212 is 'حساب العمليات الجارية للشركاء (أرباح وخسائر)'
    const partAcc = await prisma.account.findFirst({
      where: {
        companyId: c.id,
        OR: [{ code: '264' }, { code: '212' }],
      },
    });
    if (partAcc) {
      await prisma.account.update({
        where: { id: partAcc.id },
        data: { nameAr: 'حساب العمليات الجارية للشركاء (توزيع أرباح وخسائر)', type: 'EQUITY', isParent: true },
      });
      console.log(`Fixed Partners Account ${partAcc.code} -> حساب العمليات الجارية للشركاء`);
    }

    // 3. حساب أب العملاء: 13214 - مدينون قطاع خاص (عملاء التذاكر والسياحة)
    const custParent = await prisma.account.findFirst({
      where: { companyId: c.id, code: '13214' },
    });
    if (custParent) {
      await prisma.account.update({
        where: { id: custParent.id },
        data: { nameAr: 'مدينون قطاع خاص (عملاء التذاكر والسياحة)', isParent: true },
      });
      console.log(`Fixed Customer Parent Account 13214`);
    }

    // 4. حساب أب الموردين: 23214 - دائنون قطاع خاص (موردو الخدمات السياحية والتذاكر)
    const suppParent = await prisma.account.findFirst({
      where: { companyId: c.id, code: '23214' },
    });
    if (suppParent) {
      await prisma.account.update({
        where: { id: suppParent.id },
        data: { nameAr: 'دائنون قطاع خاص (موردو الخدمات السياحية والتذاكر)', isParent: true },
      });
      console.log(`Fixed Supplier Parent Account 23214`);
    }

    // 5. حساب أب العمولات: 423 - عمولات وخدمات مبيعات التذاكر والطيران
    const commParent = await prisma.account.findFirst({
      where: { companyId: c.id, code: '423' },
    });
    if (commParent) {
      await prisma.account.update({
        where: { id: commParent.id },
        data: { nameAr: 'عمولات وخدمات مبيعات التذاكر والطيران', isParent: true },
      });
      console.log(`Fixed Commission Parent Account 423`);
    }

    // 6. حساب أب الإيرادات الأخرى: 49 - الإيرادات والمكاسب الأخرى
    const othRev = await prisma.account.findFirst({
      where: { companyId: c.id, code: '49' },
    });
    if (othRev) {
      await prisma.account.update({
        where: { id: othRev.id },
        data: { nameAr: 'الإيرادات والمكاسب الأخرى', isParent: true },
      });
      console.log(`Fixed Other Revenues Account 49`);
    }
  }

  console.log('✅ Accounts audit and alignment completed!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
