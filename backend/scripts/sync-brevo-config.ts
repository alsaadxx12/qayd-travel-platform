import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();

async function main() {
  const apiKey = process.env.BREVO_API_KEY || '';
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'acc2.rooda10@gmail.com';
  const senderName = process.env.BREVO_SENDER_NAME || 'Fly4All Accounts';

  console.log('Connecting to database...');
  const company = await prisma.company.findFirst();
  const companyId = company?.id || 'default';

  const configJson = JSON.stringify({
    apiKey,
    senderEmail,
    senderName,
  });

  const existing = await prisma.printTemplate.findFirst({
    where: { docType: 'brevo_sender_config' },
  });

  if (existing) {
    await prisma.printTemplate.update({
      where: { id: existing.id },
      data: { config: configJson, name: 'Brevo Sender Config' },
    });
    console.log('Updated existing Brevo configuration in database!');
  } else {
    await prisma.printTemplate.create({
      data: {
        companyId,
        docType: 'brevo_sender_config',
        name: 'Brevo Sender Config',
        config: configJson,
        isDefault: true,
      },
    });
    console.log('Created new Brevo configuration in database!');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
