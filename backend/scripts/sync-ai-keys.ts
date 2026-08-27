import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();

async function main() {
  const openaiApiKey = process.env.OPENAI_API_KEY || '';
  const geminiApiKey = process.env.GEMINI_API_KEY || '';
  const groqApiKey = process.env.GROQ_API_KEY || '';
  const aiModel = process.env.AI_MODEL || 'gpt-5.6-sol';

  console.log('Connecting to database to sync AI configuration...');
  const company = await prisma.company.findFirst();
  const companyId = company?.id || 'default';

  const configJson = JSON.stringify({
    openaiApiKey,
    geminiApiKey,
    groqApiKey,
    aiModel,
  });

  const existing = await prisma.printTemplate.findFirst({
    where: { docType: 'ai_keys_config' },
  });

  if (existing) {
    await prisma.printTemplate.update({
      where: { id: existing.id },
      data: { config: configJson, name: 'AI Keys Config' },
    });
    console.log('Updated existing AI Keys configuration in database!');
  } else {
    await prisma.printTemplate.create({
      data: {
        companyId,
        docType: 'ai_keys_config',
        name: 'AI Keys Config',
        config: configJson,
        isDefault: true,
      },
    });
    console.log('Created new AI Keys configuration in database!');
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
