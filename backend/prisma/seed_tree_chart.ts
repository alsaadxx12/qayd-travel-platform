import { PrismaClient, AccountType, AccountCategory } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface ParsedAccount {
  code: string;
  name: string;
  parentCode: string | null;
  level: number;
  isParent: boolean;
  type: AccountType;
  category: AccountCategory;
}

function parseChartFile(filePath: string): ParsedAccount[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);

  const rawList: { indent: number; code: string; name: string; parentCode: string | null; level: number }[] = [];
  const stack: { indent: number; code: string }[] = [];

  const pattern = /^(\s*)(?:[└├]─\s*)?(\d+)\s*-\s*(.+)$/;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trimEnd();
    if (!rawLine.trim()) continue;

    const m = rawLine.match(pattern);
    if (!m) continue;

    const indentSpaces = m[1].length;
    const code = m[2].trim();
    const name = m[3].trim();

    while (stack.length > 0 && stack[stack.length - 1].indent >= indentSpaces) {
      stack.pop();
    }

    const parentCode = stack.length > 0 ? stack[stack.length - 1].code : null;
    const level = stack.length + 1;

    rawList.push({ indent: indentSpaces, code, name, parentCode, level });
    stack.push({ indent: indentSpaces, code });
  }

  // Determine isParent
  const parentCodeSet = new Set<string>();
  rawList.forEach((a) => {
    if (a.parentCode) parentCodeSet.add(a.parentCode);
  });

  const parsedList: ParsedAccount[] = rawList.map((a) => {
    const isParent = parentCodeSet.has(a.code);

    // Determine AccountType
    let type: AccountType = AccountType.ASSET;
    const c0 = a.code[0];
    if (c0 === '1') {
      type = AccountType.ASSET;
    } else if (c0 === '2') {
      if (a.code.startsWith('21') || a.code.startsWith('22')) {
        type = AccountType.EQUITY;
      } else {
        type = AccountType.LIABILITY;
      }
    } else if (c0 === '3') {
      type = AccountType.EXPENSE;
    } else if (c0 === '4') {
      type = AccountType.REVENUE;
    }

    // Determine AccountCategory
    let category: AccountCategory = AccountCategory.GENERAL;
    if (a.code.startsWith('181') || a.code.startsWith('121') || a.name.includes('صندوق') || a.name.includes('قاصة') || a.name.includes('بورصة')) {
      category = AccountCategory.CASH;
    } else if (a.code.startsWith('182') || a.code.startsWith('122') || a.name.includes('مصرف') || a.name.includes('بنك')) {
      category = AccountCategory.BANK;
    } else if (a.code.startsWith('161') || a.name.includes('مدينون') || (a.parentCode && a.parentCode.startsWith('161'))) {
      category = AccountCategory.CUSTOMER;
    } else if (a.code.startsWith('261') || a.name.includes('دائنون') || (a.parentCode && a.parentCode.startsWith('261'))) {
      category = AccountCategory.SUPPLIER;
    }

    return {
      code: a.code,
      name: a.name,
      parentCode: a.parentCode,
      level: a.level,
      isParent,
      type,
      category,
    };
  });

  return parsedList;
}

async function main() {
  console.log('🚀 Loading and parsing chart of accounts tree file...');

  const candidatePaths = [
    path.join('C:', 'Users', 'Medinat AlElm', '.gemini', 'antigravity-ide', 'scratch', 'chart_of_accounts_tree.txt'),
    path.join('C:', 'Users', 'Medinat AlElm', 'Downloads', 'chart_of_accounts_tree.txt'),
  ];

  let filePath = '';
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      filePath = p;
      break;
    }
  }

  if (!filePath) {
    throw new Error('chart_of_accounts_tree.txt not found in Downloads or scratch!');
  }

  const parsedAccounts = parseChartFile(filePath);
  console.log(`Parsed ${parsedAccounts.length} accounts from ${filePath}`);

  const companies = await prisma.company.findMany();
  console.log(`Found ${companies.length} companies in DB.`);

  for (const company of companies) {
    console.log(`\n========================================`);
    console.log(`Processing Company: ${company.name} (${company.id})`);

    // 1. Delete dependent dummy records
    console.log('Clearing dependent tables...');
    await prisma.customer.deleteMany({ where: { companyId: company.id } });
    await prisma.supplier.deleteMany({ where: { companyId: company.id } });
    await prisma.ticket.deleteMany({ where: { companyId: company.id } });
    await prisma.receiptVoucher.deleteMany({ where: { companyId: company.id } });
    await prisma.paymentVoucher.deleteMany({ where: { companyId: company.id } });
    await prisma.journalEntryLine.deleteMany({ where: { account: { companyId: company.id } } });
    await prisma.journalEntry.deleteMany({ where: { companyId: company.id } });
    await prisma.cashbox.deleteMany({ where: { companyId: company.id } });
    await prisma.bank.deleteMany({ where: { companyId: company.id } });

    // 2. Delete existing accounts
    console.log('Clearing old accounts from DB...');
    await prisma.account.deleteMany({
      where: { companyId: company.id },
    });

    console.log('Old accounts cleared. Inserting new tree accounts level-by-level...');

    // Group accounts by level (1, 2, 3, 4, 5, 6...)
    const maxLevel = Math.max(...parsedAccounts.map((a) => a.level));
    const codeToIdMap = new Map<string, string>();

    let totalInserted = 0;

    for (let lvl = 1; lvl <= maxLevel; lvl++) {
      const levelAccounts = parsedAccounts.filter((a) => a.level === lvl);
      console.log(`Inserting Level ${lvl} (${levelAccounts.length} accounts)...`);

      // Batch insert in chunks of 50
      for (const item of levelAccounts) {
        const parentId = item.parentCode ? codeToIdMap.get(item.parentCode) || null : null;

        const created = await prisma.account.create({
          data: {
            code: item.code,
            nameAr: item.name,
            type: item.type,
            category: item.category,
            isParent: item.isParent,
            level: item.level,
            parentId: parentId,
            companyId: company.id,
            tenantId: company.tenantId,
            balance: 0,
            currency: 'IQD',
            isSystem: item.level <= 2,
            branchScope: 'ALL_BRANCHES',
          },
        });

        codeToIdMap.set(item.code, created.id);
        totalInserted++;
      }
    }

    console.log(`🎉 Successfully inserted ${totalInserted} accounts for ${company.name}!`);

    // 3. Populate Customers & Suppliers from leaf accounts in 1614 and 2614
    console.log('Populating Customers and Suppliers entities...');
    let custCount = 0;
    let suppCount = 0;

    for (const item of parsedAccounts) {
      const accId = codeToIdMap.get(item.code);
      if (!accId || item.isParent) continue;

      if (item.category === AccountCategory.CUSTOMER || item.code.startsWith('1614')) {
        await prisma.customer.create({
          data: {
            code: item.code,
            nameAr: item.name,
            accountId: accId,
            companyId: company.id,
            tenantId: company.tenantId,
            isActive: true,
          },
        });
        custCount++;
      } else if (item.category === AccountCategory.SUPPLIER || item.code.startsWith('2614') || item.code.startsWith('261')) {
        await prisma.supplier.create({
          data: {
            code: item.code,
            nameAr: item.name,
            accountId: accId,
            companyId: company.id,
            tenantId: company.tenantId,
            isActive: true,
            isAirline: item.name.includes('طيران') || item.name.includes('أجنحة') || item.name.includes('Airlines'),
          },
        });
        suppCount++;
      }
    }

    console.log(`Created ${custCount} Customers and ${suppCount} Suppliers in DB.`);
  }

  console.log('\n========================================');
  console.log('🎉 ALL ACCOUNTS TREE SUCCESSFULLY POPULATED IN DATABASE!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
