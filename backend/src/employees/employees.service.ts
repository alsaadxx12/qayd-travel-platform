import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateEmployeeDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  branchName?: string;

  @IsOptional()
  @IsString()
  departmentName?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  assignedCashbox?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsBoolean()
  hasUserAccount?: boolean;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsBoolean()
  isHead?: boolean;

  @IsOptional()
  @IsString()
  permissionGroupId?: string;
}

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  branchName?: string;

  @IsOptional()
  @IsString()
  departmentName?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  assignedCashbox?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsBoolean()
  hasUserAccount?: boolean;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsBoolean()
  isHead?: boolean;

  @IsOptional()
  @IsString()
  permissionGroupId?: string;
}

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveOrganization(
    companyId: string,
    dto: Pick<CreateEmployeeDto, 'branchId' | 'branchName' | 'departmentId' | 'departmentName'>,
    current?: { branchId: string | null; branchName: string; departmentId: string | null; departmentName: string },
  ) {
    const branchHint = dto.branchId || dto.branchName || current?.branchId || current?.branchName;
    const branch = branchHint
      ? await this.prisma.branch.findFirst({
          where: { companyId, OR: [{ id: branchHint }, { code: branchHint }, { nameAr: branchHint }, { nameEn: branchHint }] },
          select: { id: true, nameAr: true },
        })
      : await this.prisma.branch.findFirst({
          where: { companyId },
          orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }],
          select: { id: true, nameAr: true },
        });

    if (!branch) throw new BadRequestException('يجب إنشاء فرع صالح قبل إضافة الموظف');

    const departmentHint = dto.departmentId || dto.departmentName || current?.departmentId || current?.departmentName;
    const department = departmentHint
      ? await this.prisma.department.findFirst({
          where: {
            companyId,
            OR: [{ id: departmentHint }, { code: departmentHint }, { name: departmentHint }],
          },
          select: { id: true, name: true, branchId: true },
        })
      : await this.prisma.department.findFirst({
          where: { companyId, branchId: branch.id },
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true, branchId: true },
        });

    if (!department) throw new BadRequestException('يجب تحديد قسم صالح للموظف');
    if (department.branchId && department.branchId !== branch.id) {
      throw new BadRequestException('القسم المحدد لا يتبع الفرع المختار');
    }

    return {
      branchId: branch.id,
      branchName: branch.nameAr,
      departmentId: department.id,
      departmentName: department.name,
    };
  }

  async findAll(companyId: string) {
    return this.prisma.employee.findMany({
      where: { companyId },
      include: {
        branch: { select: { id: true, code: true, nameAr: true } },
        department: { select: { id: true, code: true, name: true, branchId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, companyId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, companyId },
      include: {
        branch: { select: { id: true, code: true, nameAr: true } },
        department: { select: { id: true, code: true, name: true, branchId: true } },
      },
    });
    if (!employee) {
      throw new NotFoundException(`الموظف غير موجود`);
    }
    return employee;
  }

  async create(companyId: string, dto: CreateEmployeeDto) {
    // Check Tenant User/Employee Limit
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

        const maxUsersLimit = activeSub?.planVersion?.limits.find((l: any) => l.limitCode === 'MAX_USERS')?.limitValue ?? 5;
        if (maxUsersLimit !== -1) {
          const currentCount = await this.prisma.employee.count({ where: { companyId } });
          if (currentCount >= maxUsersLimit) {
            throw new BadRequestException(
              `لقد بلغت الحد الأقصى للمستخدمين والموظفين المسموحين (${maxUsersLimit} مستخدم) في باقتك الحالية. يرجى ترقية الباقة لإنشاء حسابات إضافية.`
            );
          }
        }
      }
    }

    const fullName = dto.fullName || 'موظف جديد';
    const organization = await this.resolveOrganization(companyId, dto);

    const employee = await this.prisma.employee.create({
      data: {
        ...organization,
        fullName,
        jobTitle: dto.jobTitle || 'موظف',
        phone: dto.phone,
        email: dto.email,
        assignedCashbox: dto.assignedCashbox || 'الصندوق الرئيسي - SAR',
        status: dto.status || 'نشط',
        hasUserAccount: dto.hasUserAccount || false,
        username: dto.username,
        permissionGroupId: dto.permissionGroupId || null,
        companyId,
      },
    });

    if (dto.hasUserAccount) {
      const emailToUse = dto.username || dto.email || `${fullName.trim().replace(/\s+/g, '.').toLowerCase()}@travel.com`;
      const rawPassword = dto.password || '12345678';
      const hashedPassword = await bcrypt.hash(rawPassword, 10);
      
      const existingUser = await this.prisma.user.findFirst({
        where: { email: emailToUse },
      });

      if (!existingUser) {
        await this.prisma.user.create({
          data: {
            email: emailToUse,
            password: hashedPassword,
            name: fullName,
            phone: dto.phone,
            companyId,
            roleId: dto.permissionGroupId || null,
          },
        });
      } else {
        // Update roleId if permissionGroupId is provided
        if (dto.permissionGroupId) {
          await this.prisma.user.update({
            where: { id: existingUser.id },
            data: { roleId: dto.permissionGroupId },
          });
        }
      }
    }

    return employee;
  }

  async update(id: string, companyId: string, dto: UpdateEmployeeDto) {
    const existing = await this.findOne(id, companyId);
    const organization = await this.resolveOrganization(companyId, dto, existing);
    
    const updated = await this.prisma.employee.update({
      where: { id },
      data: {
        ...organization,
        ...(dto.fullName && { fullName: dto.fullName }),
        ...(dto.jobTitle !== undefined && { jobTitle: dto.jobTitle }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.assignedCashbox !== undefined && { assignedCashbox: dto.assignedCashbox }),
        ...(dto.status && { status: dto.status }),
        ...(dto.hasUserAccount !== undefined && { hasUserAccount: dto.hasUserAccount }),
        ...(dto.username !== undefined && { username: dto.username }),
        ...(dto.permissionGroupId !== undefined && { permissionGroupId: dto.permissionGroupId || null }),
      },
    });

    if (dto.hasUserAccount) {
      const emailToUse = dto.username || dto.email || `${updated.fullName.trim().replace(/\s+/g, '.').toLowerCase()}@travel.com`;
      const rawPassword = dto.password || '12345678';
      const hashedPassword = await bcrypt.hash(rawPassword, 10);
      
      const existingUser = await this.prisma.user.findFirst({
        where: { email: emailToUse },
      });

      if (existingUser) {
        await this.prisma.user.update({
          where: { id: existingUser.id },
          data: {
            name: updated.fullName,
            phone: updated.phone,
            ...(dto.password && { password: hashedPassword }),
            ...(dto.permissionGroupId !== undefined && { roleId: dto.permissionGroupId || null }),
          },
        });
      } else {
        await this.prisma.user.create({
          data: {
            email: emailToUse,
            password: hashedPassword,
            name: updated.fullName,
            phone: updated.phone,
            companyId,
          },
        });
      }
    }

    return updated;
  }

  async delete(id: string, companyId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        companyId,
        OR: [
          { id },
          { fullName: id },
        ],
      },
    });

    if (!employee) {
      await this.prisma.employee.deleteMany({
        where: { id },
      }).catch(() => {});
      return { success: true };
    }

    return this.prisma.employee.delete({
      where: { id: employee.id },
    });
  }

}
