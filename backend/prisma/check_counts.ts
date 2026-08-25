import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const jl = await prisma.journalEntryLine.count();
  const je = await prisma.journalEntry.count();
  const cb = await prisma.cashbox.count();
  const bk = await prisma.bank.count();
  const cu = await prisma.customer.count();
  const su = await prisma.supplier.count();
  const rv = await prisma.receiptVoucher.count();
  const pv = await prisma.paymentVoucher.count();
  const tk = await prisma.ticket.count();

  console.log({
    journalEntries: je,
    journalEntryLines: jl,
    cashboxes: cb,
    banks: bk,
    customers: cu,
    suppliers: su,
    receiptVouchers: rv,
    paymentVouchers: pv,
    tickets: tk,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
