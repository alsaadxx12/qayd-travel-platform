const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.account.findMany({
    where: {
      OR: [
        { code: { contains: '1413' } },
        { nameAr: { contains: 'علي السعدي' } },
        { nameAr: { contains: 'سستم فلاي' } },
        { nameAr: { contains: 'فلاي' } },
      ],
    },
    include: {
      journalLines: true,
    },
  });

  console.log('--- MATCHING ACCOUNTS ---');
  console.log(JSON.stringify(accounts, null, 2));

  const totalJournalLines = await prisma.journalEntryLine.count();
  console.log('--- TOTAL JOURNAL ENTRY LINES IN DB ---', totalJournalLines);

  const journalEntries = await prisma.journalEntry.findMany({
    take: 5,
    include: { lines: true },
  });
  console.log('--- SAMPLE JOURNAL ENTRIES ---');
  console.log(JSON.stringify(journalEntries, null, 2));

  const tickets = await prisma.ticket.findMany({
    take: 5,
  });
  console.log('--- SAMPLE TICKETS (count: ' + tickets.length + ') ---');
  console.log(JSON.stringify(tickets, null, 2));

  const receiptVouchers = await prisma.receiptVoucher.findMany({
    take: 5,
  });
  console.log('--- SAMPLE RECEIPT VOUCHERS ---');
  console.log(JSON.stringify(receiptVouchers, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
