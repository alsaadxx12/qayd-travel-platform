const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Adding columns to accounts table in Supabase DB...');
  await prisma.$executeRawUnsafe(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS payment_days INTEGER;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS payment_mode TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS overdue_policy TEXT;`);
  console.log('Columns added successfully to accounts table!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
