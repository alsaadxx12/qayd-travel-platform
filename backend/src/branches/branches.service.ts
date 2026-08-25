import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateBranchDto {
  @IsString()
  code: string;

  @IsString()
  nameAr: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsString()
  city: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  phone2?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  email2?: string;

  @IsOptional()
  @IsString()
  logo?: string;

  @IsOptional()
  @IsString()
  managerName?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsString()
  facebook?: string;

  @IsOptional()
  @IsString()
  instagram?: string;

  @IsOptional()
  @IsString()
  telegram?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsBoolean()
  isMain?: boolean;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateBranchDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  nameAr?: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  phone2?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  email2?: string;

  @IsOptional()
  @IsString()
  logo?: string;

  @IsOptional()
  @IsString()
  managerName?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsString()
  facebook?: string;

  @IsOptional()
  @IsString()
  instagram?: string;

  @IsOptional()
  @IsString()
  telegram?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsBoolean()
  isMain?: boolean;

  @IsOptional()
  @IsString()
  status?: string;
}

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefaultBranches(companyId: string) {
    const count = await this.prisma.branch.count({ where: { companyId } });
    if (count > 0) return;

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    await this.prisma.branch.create({
      data: {
        companyId,
        tenantId: company?.tenantId || null,
        code: 'BR-01',
        nameAr: 'الفرع الرئيسي',
        nameEn: 'Main Branch',
        city: 'العراق',
        isMain: true,
        status: 'نشط',
      },
    });
  }

  async findAll(
    companyId: string,
    allowedBranchIds: string[] = [],
    enforceAllowedBranchIds = false,
  ) {
    await this.ensureDefaultBranches(companyId);
    return this.prisma.branch.findMany({
      where: {
        companyId,
        ...(enforceAllowedBranchIds ? { id: { in: allowedBranchIds } } : {}),
      },
      orderBy: { isMain: 'desc' },
    });
  }

  async findLoginOptions(
    companyId: string,
    allowedBranchIds: string[] = [],
    enforceAllowedBranchIds = false,
  ) {
    await this.ensureDefaultBranches(companyId);
    const branches = await this.prisma.branch.findMany({
      where: {
        companyId,
        ...(enforceAllowedBranchIds || allowedBranchIds.length > 0
          ? { id: { in: allowedBranchIds } }
          : {}),
      },
      orderBy: { isMain: 'desc' },
    });

    return branches.filter((branch) => {
      const normalizedStatus = (branch.status || '').trim().toLowerCase();
      return normalizedStatus === 'نشط' || normalizedStatus === 'active' || normalizedStatus === 'enabled';
    });
  }

  async findOne(id: string, companyId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id, companyId },
    });
    if (!branch) throw new NotFoundException('الفرع غير موجود');
    return branch;
  }

  async create(companyId: string, dto: CreateBranchDto) {
    const existing = await this.prisma.branch.findUnique({
      where: { companyId_code: { companyId, code: dto.code } },
    });
    if (existing) {
      throw new BadRequestException(`رمز الفرع (${dto.code}) مستخدم بالفعل`);
    }

    // Check Tenant Branch Limit
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { tenantId: true },
    });

    if (company?.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: company.tenantId },
        select: { isRoot: true },
      });

      if (tenant && !tenant.isRoot) {
        const activeSub = await this.prisma.tenantSubscription.findFirst({
          where: { tenantId: company.tenantId },
          orderBy: { createdAt: 'desc' },
          include: {
            planVersion: {
              include: { limits: true },
            },
          },
        });

        const maxBranchesLimit = activeSub?.planVersion?.limits.find(l => l.limitCode === 'MAX_BRANCHES')?.limitValue ?? 1;
        if (maxBranchesLimit !== -1) {
          const currentCount = await this.prisma.branch.count({ where: { companyId } });
          if (currentCount >= maxBranchesLimit) {
            throw new BadRequestException(
              `لقد بلغت الحد الأقصى للفروع المسموحة (${maxBranchesLimit} فرع) في باقتك الحالية. يرجى ترقية الباقة لإنشاء فروع إضافية.`
            );
          }
        }
      }
    }

    if (dto.isMain) {
      await this.prisma.branch.updateMany({
        where: { companyId },
        data: { isMain: false },
      });
    }

    return this.prisma.branch.create({
      data: {
        code: dto.code,
        nameAr: dto.nameAr,
        nameEn: dto.nameEn || dto.nameAr,
        city: dto.city,
        address: dto.address,
        phone: dto.phone,
        phone2: dto.phone2,
        email: dto.email,
        email2: dto.email2,
        logo: dto.logo,
        managerName: dto.managerName,
        whatsapp: dto.whatsapp,
        facebook: dto.facebook,
        instagram: dto.instagram,
        telegram: dto.telegram,
        website: dto.website,
        isMain: dto.isMain || false,
        status: dto.status || 'نشط',
        companyId,
        tenantId: company?.tenantId || null,
      },
    });
  }

  async update(id: string, companyId: string, dto: UpdateBranchDto) {
    const branch = await this.prisma.branch.findFirst({
      where: { id, companyId },
    });
    if (!branch) throw new NotFoundException('الفرع غير موجود');

    if (dto.code && dto.code !== branch.code) {
      const existing = await this.prisma.branch.findUnique({
        where: { companyId_code: { companyId, code: dto.code } },
      });
      if (existing) {
        throw new BadRequestException(`رمز الفرع (${dto.code}) مستخدم بالفعل`);
      }
    }

    if (dto.isMain) {
      await this.prisma.branch.updateMany({
        where: { companyId, NOT: { id } },
        data: { isMain: false },
      });
    }

    return this.prisma.branch.update({
      where: { id },
      data: dto,
    });
  }

  async delete(id: string, companyId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id, companyId },
    });
    if (!branch) throw new NotFoundException('الفرع غير موجود');
    if (branch.isMain) throw new BadRequestException('لا يمكن حذف المركز الرئيسي للشؤون المالية');

    return this.prisma.branch.delete({ where: { id } });
  }

  async uploadBranchLogo(fileName: string, fileBase64: string): Promise<{ url: string }> {
    const supabaseUrl = process.env.SUPABASE_URL || 'https://mgsgslrjbbjwkhhmdype.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

    const cleanBase64 = fileBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    const uniqueFileName = `${Date.now()}_${(fileName || 'logo.png').replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const uploadUrl = `${supabaseUrl}/storage/v1/object/branch-images/${uniqueFileName}`;

    try {
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'image/png',
          'x-upsert': 'true',
        },
        body: buffer,
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn('Supabase Storage upload response notice:', errText);
      }
    } catch (e) {
      console.error('Error uploading to Supabase Storage branch-images:', e);
    }

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/branch-images/${uniqueFileName}`;
    return { url: publicUrl };
  }
}
