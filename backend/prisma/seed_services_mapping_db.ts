import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findFirst();
  if (!company) return;

  const accounts = await prisma.account.findMany({ where: { companyId: company.id } });
  const codeMap = new Map<string, string>();
  accounts.forEach((a) => codeMap.set(a.code, a.id));

  const mappingConfig = {
    receiptVouchersDefaultAccountId: '',
    paymentVouchersDefaultAccountId: '',
    expensesParentAccountId: codeMap.get('3') || '',
    purchasesCostAccountId: codeMap.get('34') || '',
    flightRevenueAccountId: codeMap.get('4111') || '',
    flightCostAccountId: codeMap.get('341') || '',
    visaRevenueAccountId: codeMap.get('4112') || '',
    visaCostAccountId: codeMap.get('343') || '',
    hotelRevenueAccountId: codeMap.get('4113') || '',
    hotelCostAccountId: codeMap.get('344') || '',
    groupRevenueAccountId: codeMap.get('4105') || '',
    groupCostAccountId: codeMap.get('345') || '',
    reissueRevenueAccountId: codeMap.get('4114') || '',
    reissueCostAccountId: codeMap.get('342') || '',
    refundsAccountId: codeMap.get('4108') || '',
  };

  const existingTemplate = await prisma.printTemplate.findFirst({
    where: { docType: 'services_accounts_mapping', companyId: company.id },
  });

  if (existingTemplate) {
    await prisma.printTemplate.update({
      where: { id: existingTemplate.id },
      data: {
        config: JSON.stringify(mappingConfig),
        name: 'ربط حسابات الخدمات والسندات الافتراضية',
      },
    });
  } else {
    await prisma.printTemplate.create({
      data: {
        docType: 'services_accounts_mapping',
        name: 'ربط حسابات الخدمات والسندات الافتراضية',
        config: JSON.stringify(mappingConfig),
        companyId: company.id,
        tenantId: company.tenantId,
      },
    });
  }

  console.log('🎉 Successfully saved services_accounts_mapping into Database!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
