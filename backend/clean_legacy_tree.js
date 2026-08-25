const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const legacyCodes = ['1000', '2000', '3000', '4000', '5000'];
  for (const code of legacyCodes) {
    const parent = await prisma.account.findFirst({
      where: { code, companyId: 'd2c3297a-e40a-4096-8fcf-b7170a44832c' },
      include: { children: true }
    });
    if (parent) {
      console.log(`Parent [${parent.code}] has children:`, parent.children.map(c => `[${c.code}] ${c.nameAr}`));
      // Re-link or delete
      for (const child of parent.children) {
        if (child.code.length === 4 && child.code.startsWith('10') || child.code.startsWith('11') || child.code.startsWith('12') || child.code.startsWith('2') || child.code.startsWith('3') || child.code.startsWith('4') || child.code.startsWith('5')) {
          // Check if child has journal entries
          const entries = await prisma.journalEntryLine.findMany({ where: { accountId: child.id } });
          if (entries.length === 0) {
            await prisma.account.delete({ where: { id: child.id } });
            console.log(`Deleted empty child [${child.code}]`);
          }
        }
      }
      // Now try delete parent
      try {
        await prisma.account.delete({ where: { id: parent.id } });
        console.log(`Deleted parent [${parent.code}]`);
      } catch (e) {
        console.log(`Could not delete parent [${parent.code}]:`, e.message);
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
