import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateAirlineDto {
  @IsString()
  @IsNotEmpty()
  nameAr: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @IsString()
  logo?: string;
}

export class UpdateAirlineDto {
  @IsOptional()
  @IsString()
  nameAr?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @IsString()
  logo?: string;
}

@Injectable()
export class AirlinesService {
  constructor(private readonly prisma: PrismaService) {}

  private async uploadLogoToSupabaseBucket(base64Data?: string): Promise<string | null> {
    if (!base64Data) return null;
    if (base64Data.startsWith('http://') || base64Data.startsWith('https://')) {
      return base64Data;
    }
    if (!base64Data.startsWith('data:image')) {
      return base64Data;
    }

    try {
      const supabaseUrl = process.env.SUPABASE_URL || 'https://mgsgslrjbbjwkhhmdype.supabase.co';
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
      const bucketName = process.env.SUPABASE_BUCKET || 'ata';

      if (!supabaseUrl || !serviceKey) {
        return base64Data;
      }

      const commaIdx = base64Data.indexOf(',');
      if (commaIdx === -1) return base64Data;

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
      const fileName = `airlines/logo_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${extension}`;
      const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucketName}/${fileName}`;

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
        console.log(`✅ Image uploaded successfully to Supabase Storage Bucket "${bucketName}":`, publicUrl);
        return publicUrl;
      } else {
        const errText = await res.text();
        console.warn(`⚠️ Supabase bucket upload response (${bucketName}):`, errText);
        return base64Data;
      }
    } catch (err) {
      console.error('Error uploading image to Supabase storage bucket:', err);
      return base64Data;
    }
  }

  async ensureDefaultAirlines(companyId: string) {
    const count = await this.prisma.airline.count({ where: { companyId } });
    if (count > 0) return;

    const initialAirlines = [
      { nameAr: 'الخطوط الجوية العراقية', code: 'IA' },
      { nameAr: 'طيران قشم (Qeshm Air)', code: 'QB' },
      { nameAr: 'آفا إيرلاينز (Ava Airlines)', code: 'AXV' },
      { nameAr: 'كاسبيان إيرلاين', code: 'CPN' },
      { nameAr: 'طيران معراج (Meraj Airlines)', code: 'JI' },
      { nameAr: 'طيران سبهران (Sepehran Airlines)', code: 'IS' },
      { nameAr: 'نسيم إير (Naseem Air)', code: 'NAS' },
      { nameAr: 'إيران إيرتور (Iran Airtour)', code: 'B9' },
      { nameAr: 'طيران تابان (Taban Air)', code: 'TBN' },
      { nameAr: 'إيران إير (Iran Air)', code: 'IR' },
      { nameAr: 'ماهان إير (Mahan Air)', code: 'W5' },
      { nameAr: 'آسمان إيرلاينز (Aseman Airlines)', code: 'EP' },
      { nameAr: 'كيش إير (Kish Air)', code: 'Y9' },
      { nameAr: 'پارس إير (Pars Air)', code: 'PRZ' },
      { nameAr: 'أور إيرلاين (Ur Airline)', code: 'UD' },
      { nameAr: 'طيران زاكروس (Zagros Airlines)', code: 'ZV' },
      { nameAr: 'فلاي بغداد', code: 'IF' },
      { nameAr: 'الخطوط التركية', code: 'TK' },
      { nameAr: 'طيران بيغاسوس', code: 'PC' },
      { nameAr: 'طيران الإمارات', code: 'EK' },
      { nameAr: 'طيران الشرق الأوسط', code: 'ME' },
      { nameAr: 'الخطوط القطرية', code: 'QR' },
      { nameAr: 'فلاي دبي', code: 'FZ' },
      { nameAr: 'العربية للطيران', code: 'G9' },
      { nameAr: 'طيران ناس', code: 'XY' },
      { nameAr: 'الملكية الأردنية', code: 'RJ' },
      { nameAr: 'مصر للطيران', code: 'MS' },
      { nameAr: 'الخطوط الكويتية', code: 'KU' },
      { nameAr: 'طيران الخليج', code: 'GF' },
      { nameAr: 'الطيران العماني', code: 'WY' },
      { nameAr: 'الخطوط السعودية', code: 'SV' },
    ];

    for (const a of initialAirlines) {
      await this.prisma.airline.upsert({
        where: { companyId_nameAr: { companyId, nameAr: a.nameAr } },
        update: {},
        create: {
          companyId,
          nameAr: a.nameAr,
          code: a.code,
        },
      });
    }
  }

  async findAll(companyId: string) {
    await this.ensureDefaultAirlines(companyId);
    return this.prisma.airline.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, companyId: string) {
    const airline = await this.prisma.airline.findFirst({
      where: { id, companyId },
    });
    if (!airline) throw new NotFoundException('شركة الطيران غير موجودة');
    return airline;
  }

  async create(companyId: string, dto: CreateAirlineDto) {
    const existing = await this.prisma.airline.findFirst({
      where: { companyId, nameAr: dto.nameAr.trim() },
    });
    if (existing) {
      throw new BadRequestException(`شركة الطيران "${dto.nameAr}" موجودة بالفعل`);
    }

    const logoUrl = dto.logo ? await this.uploadLogoToSupabaseBucket(dto.logo) : null;

    return this.prisma.airline.create({
      data: {
        companyId,
        nameAr: dto.nameAr.trim(),
        code: dto.code ? dto.code.trim() : null,
        nameEn: dto.nameEn ? dto.nameEn.trim() : null,
        logo: logoUrl,
      },
    });
  }

  async update(id: string, companyId: string, dto: UpdateAirlineDto) {
    const airline = await this.findOne(id, companyId);

    if (dto.nameAr && dto.nameAr.trim() !== airline.nameAr) {
      const duplicate = await this.prisma.airline.findFirst({
        where: { companyId, nameAr: dto.nameAr.trim(), id: { not: id } },
      });
      if (duplicate) {
        throw new BadRequestException(`اسم شركة الطيران "${dto.nameAr}" مستخدم بالفعل`);
      }
    }

    const logoUrl = dto.logo !== undefined
      ? (dto.logo ? await this.uploadLogoToSupabaseBucket(dto.logo) : null)
      : undefined;

    return this.prisma.airline.update({
      where: { id },
      data: {
        ...(dto.nameAr && { nameAr: dto.nameAr.trim() }),
        ...(dto.code !== undefined && { code: dto.code ? dto.code.trim() : null }),
        ...(dto.nameEn !== undefined && { nameEn: dto.nameEn ? dto.nameEn.trim() : null }),
        ...(logoUrl !== undefined && { logo: logoUrl }),
      },
    });
  }

  async delete(id: string, companyId: string) {
    await this.findOne(id, companyId);
    return this.prisma.airline.delete({
      where: { id },
    });
  }
}
