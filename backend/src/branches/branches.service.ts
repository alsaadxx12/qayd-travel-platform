import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MicroCache } from '../common/micro-cache';
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

  /**
   * قائمتا الفروع تُطلبان في كل تحميل صفحة ولا تتغيّران إلا بكتابة صريحة،
   * وكل طلب كان يدفع رحلة كاملة إلى قاعدة البيانات البعيدة (~550-990ms في
   * فاحص الأداء). الخبيئة 60 ثانية وتسقط كلها عند أي إنشاء أو تعديل أو حذف.
   */
  private readonly listCache = new MicroCache(5 * 60_000, 2000, { refreshAhead: true });

  async findAll(
    companyId: string,
    allowedBranchIds: string[] = [],
    enforceAllowedBranchIds = false,
  ) {
    return this.listCache.wrap(
      `all|${companyId}|${enforceAllowedBranchIds}|${[...allowedBranchIds].sort().join(',')}`,
      () => this.findAllUncached(companyId, allowedBranchIds, enforceAllowedBranchIds),
    );
  }

  private async findAllUncached(
    companyId: string,
    allowedBranchIds: string[] = [],
    enforceAllowedBranchIds = false,
  ) {
    const query = () =>
      this.prisma.branch.findMany({
        where: {
          companyId,
          ...(enforceAllowedBranchIds ? { id: { in: allowedBranchIds } } : {}),
        },
        orderBy: { isMain: 'desc' },
      });

    const branches = await query();
    if (branches.length > 0) return branches;

    // Empty result: either the company genuinely has none (seed it) or the filter
    // excluded them all (seeding is a no-op and we return the same empty list).
    await this.ensureDefaultBranches(companyId);
    return query();
  }

  async findLoginOptions(
    companyId: string,
    allowedBranchIds: string[] = [],
    enforceAllowedBranchIds = false,
  ) {
    return this.listCache.wrap(
      `login|${companyId}|${enforceAllowedBranchIds}|${[...allowedBranchIds].sort().join(',')}`,
      () => this.findLoginOptionsUncached(companyId, allowedBranchIds, enforceAllowedBranchIds),
    );
  }

  private async findLoginOptionsUncached(
    companyId: string,
    allowedBranchIds: string[] = [],
    enforceAllowedBranchIds = false,
  ) {
    const query = () =>
      this.prisma.branch.findMany({
        where: {
          companyId,
          ...(enforceAllowedBranchIds || allowedBranchIds.length > 0
            ? { id: { in: allowedBranchIds } }
            : {}),
        },
        orderBy: { isMain: 'desc' },
      });

    let branches = await query();
    if (branches.length === 0) {
      await this.ensureDefaultBranches(companyId);
      branches = await query();
    }

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
    this.listCache.invalidate();
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
    this.listCache.invalidate();
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
    this.listCache.invalidate();
    const branch = await this.prisma.branch.findFirst({
      where: { id, companyId },
    });
    if (!branch) throw new NotFoundException('الفرع غير موجود');
    if (branch.isMain) throw new BadRequestException('لا يمكن حذف المركز الرئيسي للشؤون المالية');

    return this.prisma.branch.delete({ where: { id } });
  }

  async uploadBranchLogo(fileName: string, fileBase64: string): Promise<{ url: string }> {
    const supabaseUrl = (
      process.env.SUPABASE_URL || 'https://mgsgslrjbbjwkhhmdype.supabase.co'
    ).replace(/\/$/, '');
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nc2dzbHJqYmJqd2toaG1keXBlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTc3NTUyNCwiZXhwIjoyMTAxMzUxNTI0fQ.4_ecB84KM3dMVWzSYF-XPN9LmFTA6tY0Ne4mAeAm8Go';

    let mimeType = 'image/png';
    const commaIdx = fileBase64.indexOf(',');
    let cleanBase64 = fileBase64;
    if (commaIdx !== -1) {
      const header = fileBase64.substring(0, commaIdx);
      cleanBase64 = fileBase64.substring(commaIdx + 1);
      const mimeMatch = header.match(/^data:(image\/[a-zA-Z0-9+.-]+);/);
      if (mimeMatch) {
        mimeType = mimeMatch[1];
      }
    } else {
      cleanBase64 = fileBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
    }

    const buffer = Buffer.from(cleanBase64, 'base64');
    const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
    const safeName = (fileName || `logo.${ext}`).replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueFileName = `${Date.now()}_${safeName}`;
    const uploadUrl = `${supabaseUrl}/storage/v1/object/branch-images/${uniqueFileName}`;

    try {
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
          'Content-Type': mimeType,
          'x-upsert': 'true',
        },
        body: buffer,
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error('Supabase Storage upload error:', errText);
        throw new BadRequestException(`فشل حفظ الشعار في Supabase Storage: ${errText}`);
      }
    } catch (e: any) {
      console.error('Error uploading to Supabase Storage branch-images:', e);
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException(`خطأ أثناء الاتصال بمزود التخزين: ${e?.message || e}`);
    }

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/branch-images/${uniqueFileName}`;
    return { url: publicUrl };
  }
}
