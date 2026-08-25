const fs = require('fs');
const path = require('path');

if (!process.env.DATABASE_URL) {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const separator = line.indexOf('=');
      if (separator < 1) continue;
      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const [counts] = await prisma.$queryRawUnsafe(`
    SELECT
      (SELECT COUNT(*)::int FROM "departments" d
        WHERE d."branch_id" IS NULL OR NOT EXISTS (SELECT 1 FROM "branches" b WHERE b.id = d."branch_id")) AS "departmentsWithoutBranch",
      (SELECT COUNT(*)::int FROM "employees" e
        WHERE e."branch_id" IS NULL OR NOT EXISTS (SELECT 1 FROM "branches" b WHERE b.id = e."branch_id")) AS "employeesWithoutBranch",
      (SELECT COUNT(*)::int FROM "employees" e
        WHERE e."department_id" IS NULL OR NOT EXISTS (SELECT 1 FROM "departments" d WHERE d.id = e."department_id")) AS "employeesWithoutDepartment",
      (SELECT COUNT(*)::int FROM "receipt_vouchers" v
        WHERE NOT EXISTS (SELECT 1 FROM "accounts" a WHERE a.id = v."cashboxOrBankAccountId")) AS "invalidReceiptCashboxAccounts",
      (SELECT COUNT(*)::int FROM "payment_vouchers" v
        WHERE NOT EXISTS (SELECT 1 FROM "accounts" a WHERE a.id = v."cashboxOrBankAccountId")) AS "invalidPaymentCashboxAccounts",
      (SELECT COUNT(*)::int FROM "tickets" t
        WHERE t."branchId" IS NULL OR NOT EXISTS (SELECT 1 FROM "branches" b WHERE b.id = t."branchId")) AS "ticketsWithoutBranch",
      (SELECT COUNT(*)::int FROM "tickets" t
        WHERE COALESCE(t."netSell", 0) > 0
          AND UPPER(COALESCE(t."paymentType", '')) IN ('CREDIT', 'آجل')
          AND t."customer_account_id" IS NULL) AS "postedCreditTicketsWithoutCustomerAccount",
      (SELECT COUNT(*)::int FROM "tickets" t
        WHERE COALESCE(t."netBuy", 0) > 0 AND t."supplier_account_id" IS NULL) AS "ticketsWithoutSupplierAccount",
      (SELECT COUNT(*)::int FROM "tickets" t
        WHERE COALESCE(t."netSell", 0) > 0
          AND UPPER(COALESCE(t."paymentType", '')) IN ('DEBIT', 'CASH', 'نقدي')
          AND t."cashbox_account_id" IS NULL) AS "cashTicketsWithoutCashboxAccount",
      (SELECT COUNT(*)::int FROM "tickets" t
        WHERE t."tripType" IS DISTINCT FROM 'VISA'
          AND t."tripType" IS DISTINCT FROM 'REFUND'
          AND t.status IS DISTINCT FROM 'REFUNDED'
          AND NULLIF(BTRIM(t.airline), '') IS NOT NULL
          AND t."airline_id" IS NULL) AS "ticketsWithoutAirline",
      (SELECT COUNT(*)::int FROM pg_constraint
        WHERE conname = ANY(ARRAY[
          'receipt_vouchers_cashboxOrBankAccountId_fkey',
          'payment_vouchers_cashboxOrBankAccountId_fkey',
          'departments_branch_id_fkey',
          'employees_branch_id_fkey',
          'employees_department_id_fkey',
          'tickets_customer_id_fkey',
          'tickets_customer_account_id_fkey',
          'tickets_supplier_id_fkey',
          'tickets_supplier_account_id_fkey',
          'tickets_airline_id_fkey',
          'tickets_cashbox_account_id_fkey',
          'tickets_branchId_fkey'
        ])) AS "installedForeignKeys",
      (
        (SELECT COUNT(*) FROM "departments" d JOIN "branches" b ON b.id = d."branch_id" WHERE b."companyId" <> d."companyId") +
        (SELECT COUNT(*) FROM "employees" e JOIN "branches" b ON b.id = e."branch_id" WHERE b."companyId" <> e."companyId") +
        (SELECT COUNT(*) FROM "employees" e JOIN "departments" d ON d.id = e."department_id" WHERE d."companyId" <> e."companyId") +
        (SELECT COUNT(*) FROM "tickets" t JOIN "accounts" a ON a.id = t."customer_account_id" WHERE a."companyId" <> t."companyId") +
        (SELECT COUNT(*) FROM "tickets" t JOIN "accounts" a ON a.id = t."supplier_account_id" WHERE a."companyId" <> t."companyId") +
        (SELECT COUNT(*) FROM "tickets" t JOIN "accounts" a ON a.id = t."cashbox_account_id" WHERE a."companyId" <> t."companyId") +
        (SELECT COUNT(*) FROM "receipt_vouchers" v JOIN "accounts" a ON a.id = v."cashboxOrBankAccountId" WHERE a."companyId" <> v."companyId") +
        (SELECT COUNT(*) FROM "payment_vouchers" v JOIN "accounts" a ON a.id = v."cashboxOrBankAccountId" WHERE a."companyId" <> v."companyId")
      )::int AS "crossCompanyRelations"
  `);

  console.log(JSON.stringify(counts, null, 2));

  if (process.argv.includes('--details')) {
    const [employees, customerTickets, supplierTickets, airlineTickets] = await Promise.all([
      prisma.$queryRawUnsafe(`
        SELECT e.id, e."companyId", e."departmentName", e."branch_id" AS "branchId"
        FROM "employees" e
        WHERE e."department_id" IS NULL
        ORDER BY e."createdAt" ASC
      `),
      prisma.$queryRawUnsafe(`
        SELECT t.id, t."companyId", t."invoiceNumber", t."customerName"
        FROM "tickets" t
        WHERE COALESCE(t."netSell", 0) > 0
          AND UPPER(COALESCE(t."paymentType", '')) IN ('CREDIT', 'آجل')
          AND t."customer_account_id" IS NULL
      `),
      prisma.$queryRawUnsafe(`
        SELECT t.id, t."companyId", t."invoiceNumber", t."supplierAccount", t."supplierAccountName"
        FROM "tickets" t
        WHERE COALESCE(t."netBuy", 0) > 0 AND t."supplier_account_id" IS NULL
      `),
      prisma.$queryRawUnsafe(`
        SELECT t.id, t."companyId", t."invoiceNumber", t.airline
        FROM "tickets" t
        WHERE t."tripType" IS DISTINCT FROM 'VISA'
          AND t."tripType" IS DISTINCT FROM 'REFUND'
          AND t.status IS DISTINCT FROM 'REFUNDED'
          AND NULLIF(BTRIM(t.airline), '') IS NOT NULL
          AND t."airline_id" IS NULL
      `),
    ]);
    console.log(JSON.stringify({ employees, customerTickets, supplierTickets, airlineTickets }, null, 2));
  }

  if (process.argv.includes('--candidates')) {
    const [departments, accounts, customers, suppliers, airlines] = await Promise.all([
      prisma.$queryRawUnsafe(`SELECT id, name, code, "branch_id" AS "branchId" FROM "departments" WHERE "companyId" = '7e9d5993-09e3-4bb3-b693-bc8e8aa18c44' ORDER BY name`),
      prisma.$queryRawUnsafe(`SELECT id, code, "nameAr", category FROM "accounts" WHERE "companyId" = 'default-company-id' AND ("nameAr" ILIKE '%سستم%' OR "nameAr" ILIKE '%فلاي%' OR "nameAr" ILIKE '%ماستر%' OR "nameAr" ILIKE '%اصدار%') ORDER BY code`),
      prisma.$queryRawUnsafe(`SELECT id, code, "nameAr", "accountId" FROM "customers" WHERE "companyId" = 'default-company-id' ORDER BY "nameAr"`),
      prisma.$queryRawUnsafe(`SELECT id, code, "nameAr", "accountId" FROM "suppliers" WHERE "companyId" = 'default-company-id' ORDER BY "nameAr"`),
      prisma.$queryRawUnsafe(`SELECT id, code, "nameAr", "nameEn" FROM "airlines" WHERE "companyId" = 'default-company-id' ORDER BY "nameAr"`),
    ]);
    console.log(JSON.stringify({ departments, accounts, customers, suppliers, airlines }, null, 2));
  }
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
