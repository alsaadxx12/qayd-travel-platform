import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateLogos() {
  console.log('🔄 Starting migration of existing Base64/SVG text logos to Supabase Bucket "ata"...');

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running logo migration.');
  }
  const bucketName = 'ata';

  const airlines = await prisma.airline.findMany({
    where: {
      logo: {
        startsWith: 'data:image',
      },
    },
  });

  console.log(`Found ${airlines.length} airline(s) with text/base64 logo data.`);

  let updatedCount = 0;

  for (const airline of airlines) {
    if (!airline.logo || !airline.logo.startsWith('data:image')) continue;

    try {
      const base64Data = airline.logo;
      const commaIdx = base64Data.indexOf(',');
      if (commaIdx === -1) continue;

      const header = base64Data.substring(0, commaIdx);
      const base64Body = base64Data.substring(commaIdx + 1);

      let mimeType = 'image/png';
      let extension = 'png';

      const mimeMatch = header.match(/^data:(image\/[a-zA-Z0-9\+\-\.]+);/);
      if (mimeMatch) {
        mimeType = mimeMatch[1];
        if (mimeType.includes('svg')) extension = 'svg';
        else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) extension = 'jpg';
        else if (mimeType.includes('webp')) extension = 'webp';
        else if (mimeType.includes('gif')) extension = 'gif';
        else if (mimeType.includes('png')) extension = 'png';
      }

      const buffer = Buffer.from(base64Body, 'base64');
      const safeName = (airline.nameAr || 'airline').replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `airlines/logo_${safeName}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${extension}`;
      const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucketName}/${fileName}`;

      console.log(`Uploading logo for "${airline.nameAr}" to Supabase bucket "ata"...`);

      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
          'Content-Type': mimeType,
          'x-upsert': 'true',
        },
        body: buffer,
      });

      if (res.ok) {
        const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${fileName}`;
        await prisma.airline.update({
          where: { id: airline.id },
          data: { logo: publicUrl },
        });
        console.log(`✅ Success for "${airline.nameAr}": ${publicUrl}`);
        updatedCount++;
      } else {
        const errText = await res.text();
        console.error(`❌ Upload failed for "${airline.nameAr}":`, res.status, errText);
      }
    } catch (err) {
      console.error(`❌ Error migrating logo for "${airline.nameAr}":`, err);
    }
  }

  console.log(`🎉 Migration finished! Total ${updatedCount} airline logos uploaded to Supabase Bucket "ata" and database updated.`);
  await prisma.$disconnect();
}

migrateLogos();
