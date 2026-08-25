const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const branches = await prisma.branch.findMany();
  console.log('Branches:', branches);

  const allTickets = await prisma.ticket.findMany({
    select: {
      id: true,
      invoiceNumber: true,
      tripType: true,
      branchId: true,
      companyId: true,
      totalSell: true,
      totalBuy: true,
      airline: true,
    },
  });
  console.log('All Invoices/Tickets/Visas in DB:');
  console.table(allTickets);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
