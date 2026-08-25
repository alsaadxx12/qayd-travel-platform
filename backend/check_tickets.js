const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const tickets = await prisma.ticket.findMany({ include: { passengers: true } });
  console.log(JSON.stringify(tickets.map(x => ({
    id: x.id,
    invoiceNumber: x.invoiceNumber,
    airline: x.airline,
    tripType: x.tripType,
    flightType: x.flightType,
    serviceType: x.serviceType,
    totalSell: x.totalSell,
    totalBuy: x.totalBuy,
    profit: x.profit,
    status: x.status,
    currency: x.currency,
    passengers: x.passengers?.map(p => ({ name: p.name, fareSell: p.fareSell, fareBuy: p.fareBuy, isRefunded: p.isRefunded }))
  })), null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
