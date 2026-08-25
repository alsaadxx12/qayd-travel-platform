const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$queryRawUnsafe(`
    SELECT 
      current_database() as db_name, 
      current_user as db_user, 
      inet_server_addr() as server_ip,
      inet_server_port() as server_port,
      version() as db_version;
  `);
  console.log('=== DATABASE CONNECTION DETAILS ===');
  console.log(result);

  // Parse DATABASE_URL from env if available (masked password)
  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl) {
    try {
      const u = new URL(dbUrl);
      console.log('Host:', u.host);
      console.log('Port:', u.port);
      console.log('Database Path:', u.pathname.replace('/', ''));
      console.log('User:', u.username);
    } catch (e) {
      console.log('DATABASE_URL is set.');
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
