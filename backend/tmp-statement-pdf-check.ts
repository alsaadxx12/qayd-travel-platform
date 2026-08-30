import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { StatementPdfService } from './src/pdf/statement-pdf.service';
import { PrismaService } from './src/prisma/prisma.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const statementPdf = app.get(StatementPdfService);

  const company = await prisma.company.findFirst({ select: { id: true, name: true } });
  if (!company) {
    console.log('NO_COMPANY');
    await app.close();
    return;
  }
  console.log('COMPANY:', company.id, company.name);

  try {
    const generated = await statementPdf.generate(company.id, {
      accountName: 'حساب تجريبي',
      accountCode: '1101',
      accountPhone: '07700000000',
      accountEmail: 'test@example.com',
      accountAddress: 'بغداد',
      startDate: '01/01/2026',
      endDate: '31/12/2026',
      rows: [
        {
          rowNumber: 1,
          date: '01/08/2026',
          docRef: 'JV-1',
          statement: 'حركة تجريبية',
          debit: 1000,
          credit: 0,
          runningBalance: 1000,
        },
      ],
      totals: {
        totalDebit: 1000,
        totalCredit: 0,
        finalBalance: 1000,
        openingBalance: 0,
        previousBalance: 0,
      },
      lang: 'ar',
    } as any);

    const head = generated.buffer.subarray(0, 5).toString('latin1');
    console.log('PDF_OK bytes=', generated.buffer.length, 'head=', head, 'name=', generated.downloadName);
  } catch (err: any) {
    console.log('PDF_FAILED:', err?.constructor?.name, err?.message);
    console.log(err?.stack);
  }

  await app.close();
  process.exit(0);
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
