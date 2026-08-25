import { PrismaClient, AccountType, AccountCategory } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting accounting seed data for Travel Agency system...');

  const company = await prisma.company.upsert({
    where: { code: 'TRAVEL01' },
    update: {},
    create: {
      name: 'شركة الفرسان للسياحة والسفر',
      code: 'TRAVEL01',
      currency: 'SAR',
      vatNumber: '300012345600003',
      phone: '+966112345678',
      email: 'info@alforsan-travel.com',
      address: 'الرياض - طريق الملك فهد - المملكة العربية السعودية',
      isDefault: true,
    },
  });

  console.log(`✅ Company created/updated: ${company.name} (${company.id})`);

  const adminRole = await prisma.role.create({
    data: {
      name: 'مدير النظام (Admin)',
      description: 'صلاحيات كاملة للتحكم في جميع أجزاء النظام',
      permissions: JSON.stringify(['*']),
      companyId: company.id,
    },
  });

  const accountantRole = await prisma.role.create({
    data: {
      name: 'محاسب (Accountant)',
      description: 'إدخال القيود وسندات القبض والدفع واستخراج التقارير',
      permissions: JSON.stringify([
        'accounts:read',
        'entries:create',
        'entries:read',
        'vouchers:create',
        'vouchers:read',
        'vouchers:post',
        'reports:read',
      ]),
      companyId: company.id,
    },
  });

  const hashedPassword = await bcrypt.hash('admin123', 10);
  const accPassword = await bcrypt.hash('acc123', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@travel.com' },
    update: {},
    create: {
      email: 'admin@travel.com',
      password: hashedPassword,
      name: 'أحمد المحمود (مدير النظام)',
      phone: '+966500000001',
      companyId: company.id,
      roleId: adminRole.id,
    },
  });

  const accountantUser = await prisma.user.upsert({
    where: { email: 'accountant@travel.com' },
    update: {},
    create: {
      email: 'accountant@travel.com',
      password: accPassword,
      name: 'خالد السعيد (محاسب رئيسي)',
      phone: '+966500000002',
      companyId: company.id,
      roleId: accountantRole.id,
    },
  });

  console.log(`✅ Users created: ${adminUser.email}, ${accountantUser.email}`);

  const fiscalPeriod = await prisma.fiscalPeriod.create({
    data: {
      name: 'الفترة المالية 2026',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      status: 'OPEN',
      companyId: company.id,
    },
  });

  console.log(`✅ Fiscal Period created: ${fiscalPeriod.name}`);

  // Chart of Accounts Setup
  const assets = await prisma.account.create({
    data: {
      code: '1000',
      nameAr: 'الأصول',
      nameEn: 'Assets',
      type: AccountType.ASSET,
      isParent: true,
      level: 1,
      isSystem: true,
      companyId: company.id,
    },
  });

  const liabilities = await prisma.account.create({
    data: {
      code: '2000',
      nameAr: 'الالتزامات',
      nameEn: 'Liabilities',
      type: AccountType.LIABILITY,
      isParent: true,
      level: 1,
      isSystem: true,
      companyId: company.id,
    },
  });

  const equity = await prisma.account.create({
    data: {
      code: '3000',
      nameAr: 'حقوق الملكية',
      nameEn: 'Equity',
      type: AccountType.EQUITY,
      isParent: true,
      level: 1,
      isSystem: true,
      companyId: company.id,
    },
  });

  const revenues = await prisma.account.create({
    data: {
      code: '4000',
      nameAr: 'الإيرادات',
      nameEn: 'Revenues',
      type: AccountType.REVENUE,
      isParent: true,
      level: 1,
      isSystem: true,
      companyId: company.id,
    },
  });

  const expenses = await prisma.account.create({
    data: {
      code: '5000',
      nameAr: 'المصروفات',
      nameEn: 'Expenses',
      type: AccountType.EXPENSE,
      isParent: true,
      level: 1,
      isSystem: true,
      companyId: company.id,
    },
  });

  const currentAssets = await prisma.account.create({
    data: {
      code: '1100',
      nameAr: 'الأصول المتداولة',
      nameEn: 'Current Assets',
      type: AccountType.ASSET,
      isParent: true,
      parentId: assets.id,
      level: 2,
      isSystem: true,
      companyId: company.id,
    },
  });

  const cashAndBanksCategory = await prisma.account.create({
    data: {
      code: '1110',
      nameAr: 'الصناديق والبنوك',
      nameEn: 'Cash & Banks',
      type: AccountType.ASSET,
      isParent: true,
      parentId: currentAssets.id,
      level: 3,
      isSystem: true,
      companyId: company.id,
    },
  });

  const mainCashAccount = await prisma.account.create({
    data: {
      code: '1111',
      nameAr: 'الصندوق الرئيسي - SAR',
      nameEn: 'Main Cashbox - SAR',
      type: AccountType.ASSET,
      category: AccountCategory.CASH,
      isParent: false,
      parentId: cashAndBanksCategory.id,
      level: 4,
      balance: 150000.0,
      companyId: company.id,
    },
  });

  const mainBankAccount = await prisma.account.create({
    data: {
      code: '1112',
      nameAr: 'مصرف الراجحي - الحساب الرئيسي',
      nameEn: 'Al Rajhi Bank Main Account',
      type: AccountType.ASSET,
      category: AccountCategory.BANK,
      isParent: false,
      parentId: cashAndBanksCategory.id,
      level: 4,
      balance: 550000.0,
      companyId: company.id,
    },
  });

  const customersCategory = await prisma.account.create({
    data: {
      code: '1120',
      nameAr: 'العملاء (ذمم مدينة)',
      nameEn: 'Customers (Accounts Receivable)',
      type: AccountType.ASSET,
      category: AccountCategory.CUSTOMER,
      isParent: true,
      parentId: currentAssets.id,
      level: 3,
      isSystem: true,
      companyId: company.id,
    },
  });

  const customer1Account = await prisma.account.create({
    data: {
      code: '1121',
      nameAr: 'حساب شركة الأفق للاستشارات',
      nameEn: 'Al Ofoq Consulting Co.',
      type: AccountType.ASSET,
      category: AccountCategory.CUSTOMER,
      isParent: false,
      parentId: customersCategory.id,
      level: 4,
      balance: 12500.0,
      companyId: company.id,
    },
  });

  const currentLiabilities = await prisma.account.create({
    data: {
      code: '2100',
      nameAr: 'الالتزامات المتداولة',
      nameEn: 'Current Liabilities',
      type: AccountType.LIABILITY,
      isParent: true,
      parentId: liabilities.id,
      level: 2,
      isSystem: true,
      companyId: company.id,
    },
  });

  const suppliersCategory = await prisma.account.create({
    data: {
      code: '2110',
      nameAr: 'الموردون وشركات الطيران',
      nameEn: 'Suppliers & Airlines',
      type: AccountType.LIABILITY,
      category: AccountCategory.SUPPLIER,
      isParent: true,
      parentId: currentLiabilities.id,
      level: 3,
      isSystem: true,
      companyId: company.id,
    },
  });

  const saudiaAirlineAccount = await prisma.account.create({
    data: {
      code: '2111',
      nameAr: 'حساب الخطوط الجوية السعودية (Saudia)',
      nameEn: 'Saudi Arabian Airlines Account',
      type: AccountType.LIABILITY,
      category: AccountCategory.SUPPLIER,
      isParent: false,
      parentId: suppliersCategory.id,
      level: 4,
      balance: 45000.0,
      companyId: company.id,
    },
  });

  const flynasAirlineAccount = await prisma.account.create({
    data: {
      code: '2112',
      nameAr: 'حساب طيران ناس (Flynas)',
      nameEn: 'Flynas Airline Account',
      type: AccountType.LIABILITY,
      category: AccountCategory.SUPPLIER,
      isParent: false,
      parentId: suppliersCategory.id,
      level: 4,
      balance: 18000.0,
      companyId: company.id,
    },
  });

  const iataClearingAccount = await prisma.account.create({
    data: {
      code: '2113',
      nameAr: 'حساب التسوية ياتا (IATA BSP Clearing)',
      nameEn: 'IATA BSP Clearing Account',
      type: AccountType.LIABILITY,
      category: AccountCategory.SUPPLIER,
      isParent: false,
      parentId: suppliersCategory.id,
      level: 4,
      balance: 85000.0,
      companyId: company.id,
    },
  });

  await prisma.account.create({
    data: {
      code: '3100',
      nameAr: 'رأس المال المدفوع',
      nameEn: 'Paid-in Capital',
      type: AccountType.EQUITY,
      isParent: false,
      parentId: equity.id,
      level: 2,
      balance: 500000.0,
      companyId: company.id,
    },
  });

  await prisma.account.create({
    data: {
      code: '3200',
      nameAr: 'الأرباح المبقاة',
      nameEn: 'Retained Earnings',
      type: AccountType.EQUITY,
      isParent: false,
      parentId: equity.id,
      level: 2,
      balance: 164500.0,
      companyId: company.id,
    },
  });

  const ticketSalesRevenue = await prisma.account.create({
    data: {
      code: '4100',
      nameAr: 'إيرادات مبيعات تذاكر الطيران',
      nameEn: 'Airline Ticket Sales Revenue',
      type: AccountType.REVENUE,
      isParent: false,
      parentId: revenues.id,
      level: 2,
      balance: 320000.0,
      companyId: company.id,
    },
  });

  await prisma.account.create({
    data: {
      code: '4200',
      nameAr: 'إيرادات البرامج السياحية بالفنادق',
      nameEn: 'Tourism Packages Revenue',
      type: AccountType.REVENUE,
      isParent: false,
      parentId: revenues.id,
      level: 2,
      balance: 180000.0,
      companyId: company.id,
    },
  });

  await prisma.account.create({
    data: {
      code: '4300',
      nameAr: 'إيرادات العمولات والمكافآت',
      nameEn: 'Commissions Revenue',
      type: AccountType.REVENUE,
      isParent: false,
      parentId: revenues.id,
      level: 2,
      balance: 45000.0,
      companyId: company.id,
    },
  });

  await prisma.account.create({
    data: {
      code: '5100',
      nameAr: 'مصروف إيجار المقر',
      nameEn: 'Office Rent Expense',
      type: AccountType.EXPENSE,
      isParent: false,
      parentId: expenses.id,
      level: 2,
      balance: 30000.0,
      companyId: company.id,
    },
  });

  await prisma.account.create({
    data: {
      code: '5200',
      nameAr: 'عمولات ومصاريف تحويلات بنكية',
      nameEn: 'Bank Charges & Fees',
      type: AccountType.EXPENSE,
      isParent: false,
      parentId: expenses.id,
      level: 2,
      balance: 4500.0,
      companyId: company.id,
    },
  });

  console.log('✅ Chart of Accounts initialized successfully!');

  await prisma.cashbox.create({
    data: {
      code: 'CASH01',
      nameAr: 'الصندوق الرئيسي',
      nameEn: 'Main Cashbox',
      accountId: mainCashAccount.id,
      companyId: company.id,
    },
  });

  await prisma.bank.create({
    data: {
      code: 'BANK01',
      nameAr: 'بنك الراجحي - الفرع الرئيسي',
      nameEn: 'Al Rajhi Bank - Main Branch',
      accountNumber: 'SA8080000012345678901234',
      iban: 'SA8080000012345678901234',
      accountId: mainBankAccount.id,
      companyId: company.id,
    },
  });

  const customer = await prisma.customer.create({
    data: {
      code: 'CUST-001',
      nameAr: 'شركة الأفق للاستشارات',
      nameEn: 'Al Ofoq Consulting Co.',
      phone: '+966511112233',
      email: 'finance@alofoq.com',
      address: 'جدة - حي الزهراء',
      accountId: customer1Account.id,
      companyId: company.id,
    },
  });

  await prisma.supplier.create({
    data: {
      code: 'SUP-001',
      nameAr: 'الخطوط الجوية السعودية',
      nameEn: 'Saudi Arabian Airlines (SV)',
      isAirline: true,
      phone: '+966920022222',
      email: 'bsp@saudia.com',
      accountId: saudiaAirlineAccount.id,
      companyId: company.id,
    },
  });

  await prisma.supplier.create({
    data: {
      code: 'SUP-002',
      nameAr: 'طيران ناس',
      nameEn: 'Flynas (XY)',
      isAirline: true,
      phone: '+966920001234',
      email: 'bsp@flynas.com',
      accountId: flynasAirlineAccount.id,
      companyId: company.id,
    },
  });

  console.log(`✅ Cashbox, Bank, Customer, and Suppliers created!`);

  await prisma.journalEntry.create({
    data: {
      entryNumber: 'JV-2026-0001',
      date: new Date('2026-01-15'),
      description: 'قيد افتتاح حسابات التذاكر المستحقة',
      status: 'POSTED',
      totalDebit: 10000.0,
      totalCredit: 10000.0,
      companyId: company.id,
      fiscalPeriodId: fiscalPeriod.id,
      createdById: accountantUser.id,
      postedById: adminUser.id,
      lines: {
        create: [
          {
            accountId: customer1Account.id,
            debit: 10000.0,
            credit: 0,
            description: 'تأكيد حجز تذاكر طيران لوفد الشركة',
          },
          {
            accountId: ticketSalesRevenue.id,
            debit: 0,
            credit: 10000.0,
            description: 'إيرادات مبيعات التذاكر',
          },
        ],
      },
    },
  });

  await prisma.receiptVoucher.create({
    data: {
      voucherNumber: 'RV-2026-0001',
      date: new Date('2026-01-20'),
      amount: 5000.0,
      accountId: customer1Account.id,
      cashboxOrBankAccountId: mainBankAccount.id,
      customerId: customer.id,
      reference: 'CHQ-99021',
      description: 'دفعة سداد من حساب تذاكر السفر عبر تحويل بنكي',
      status: 'POSTED',
      companyId: company.id,
      createdById: accountantUser.id,
    },
  });

  console.log(`🎉 Seed process completed successfully!`);
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
