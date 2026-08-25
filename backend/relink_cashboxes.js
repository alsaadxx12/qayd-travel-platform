const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const companyId = 'd2c3297a-e40a-4096-8fcf-b7170a44832c';
  
  // Find new 1811 cashbox account
  const mainCashAccount = await prisma.account.findFirst({
    where: { companyId, code: '1811' }
  });

  // Re-link cashboxes
  const cashboxes = await prisma.cashbox.findMany({ where: { companyId } });
  for (const cb of cashboxes) {
    if (mainCashAccount) {
      await prisma.cashbox.update({
        where: { id: cb.id },
        data: { accountId: mainCashAccount.id }
      });
      console.log(`Re-linked cashbox ${cb.name} to [1811]`);
    }
  }

  // Find bank accounts
  const mainBankAcc = await prisma.account.findFirst({
    where: { companyId, code: '1821' }
  });
  const banks = await prisma.bankAccount.findMany({ where: { companyId } });
  for (const b of banks) {
    if (mainBankAcc) {
      await prisma.bankAccount.update({
        where: { id: b.id },
        data: { accountId: mainBankAcc.id }
      });
      console.log(`Re-linked bank ${b.bankName} to [1821]`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
