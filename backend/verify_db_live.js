const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('===============================================================');
  console.log('🔍 DIRECT SUPABASE DATABASE VERIFICATION TEST');
  console.log('===============================================================');

  // Query specific accounts shown in the user screenshot to prove 100% exact match
  const sampleCodes = ['1413', '2414', '243', '4122', '125', '24118', '24117', '4131', '1823', '111', '331', '1813', '1424'];
  
  const dbRows = await prisma.account.findMany({
    where: { code: { in: sampleCodes } },
    select: { id: true, code: true, nameAr: true, nameEn: true, type: true, category: true, parentId: true, companyId: true }
  });

  console.log(`\nFound ${dbRows.length} matching rows directly in Supabase table 'accounts':\n`);
  dbRows.forEach((r, idx) => {
    console.log(`${idx + 1}. ID: ${r.id.substring(0, 8)}... | Code: [${r.code}] | Name: ${r.nameAr} (${r.nameEn}) | Type: ${r.type}`);
  });

  const totalCount = await prisma.account.count();
  console.log(`\n📊 Total accounts currently stored in Supabase PostgreSQL: ${totalCount} records.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
