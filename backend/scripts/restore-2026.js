const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function restore() {
  console.log('Restoring 2026 to original OPEN state...');
  const y2026 = await prisma.fiscalYear.findFirst({ where: { name: '2026' } });
  if (!y2026) {
    console.log('Year 2026 not found');
    return;
  }

  // Delete closing journal entries
  const closingEntries = await prisma.journalEntry.findMany({
    where: { fiscalYearId: y2026.id, isClosing: true },
  });
  for (const ce of closingEntries) {
    await prisma.journalEntryLine.deleteMany({ where: { journalEntryId: ce.id } });
    await prisma.journalEntry.delete({ where: { id: ce.id } });
  }

  // Delete audit logs
  await prisma.balanceAuditLog.deleteMany({ where: { fiscalYearId: y2026.id } });

  // Update 2026 to OPEN
  await prisma.fiscalYear.update({
    where: { id: y2026.id },
    data: {
      status: 'OPEN',
      isCurrent: true,
      closedById: null,
      closedAt: null,
      reopenedById: null,
      reopenedAt: null,
      reopenReason: null,
      closingEntryId: null,
      openingEntryId: null,
      nextYearId: null,
    },
  });

  // Reopen all 12 periods
  await prisma.fiscalPeriod.updateMany({
    where: { fiscalYearId: y2026.id },
    data: { status: 'OPEN' },
  });

  // Set active user year to 2026
  await prisma.user.updateMany({
    data: { activeFiscalYearId: y2026.id },
  });

  console.log('✅ Successfully restored 2026 to full OPEN state with 12 open periods!');
}

restore()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
