const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const branches = await prisma.branch.findMany();
  console.log('Branches in system:');
  branches.forEach(b => console.log(`- [${b.code}] ${b.nameAr} (${b.id}) isMain=${b.isMain}`));

  const tickets = await prisma.ticket.findMany({ include: { passengers: true } });
  console.log(`\nFound ${tickets.length} tickets/visas in database:`);

  const mainBranch = branches.find(b => b.isMain && b.companyId === 'default-company-id') || branches[0];

  for (const t of tickets) {
    let targetBranch = null;
    if (t.invoiceNumber) {
      if (t.invoiceNumber.startsWith('KAB')) {
        targetBranch = branches.find(b => b.code === 'KAB');
      } else if (t.invoiceNumber.startsWith('NJF')) {
        targetBranch = branches.find(b => b.code === 'NJF');
      } else if (t.invoiceNumber.startsWith('BR-01')) {
        targetBranch = branches.find(b => b.code === 'BR-01' || b.code === 'NJF' || b.code === 'KAB');
      }
    }
    if (!targetBranch) {
      targetBranch = mainBranch;
    }

    if (targetBranch) {
      await prisma.ticket.update({
        where: { id: t.id },
        data: { branchId: targetBranch.id }
      });
      console.log(`- ${t.invoiceNumber} (${t.tripType || 'TKT'}) -> Assigned to branch: ${targetBranch.nameAr} [${targetBranch.code}]`);
    }
  }

  // Also check journal entries / vouchers / accounts
  const entries = await prisma.journalEntry.findMany({ select: { id: true, entryNumber: true, branchId: true } });
  console.log(`\nFound ${entries.length} journal entries.`);
  for (const e of entries) {
    if (!e.branchId && mainBranch) {
      await prisma.journalEntry.update({
        where: { id: e.id },
        data: { branchId: mainBranch.id }
      });
    }
  }

  console.log('\nBranch associations successfully updated!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
