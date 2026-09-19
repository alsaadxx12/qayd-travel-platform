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

  @IsOptional()
  @IsString()
  trustedDeviceId?: string;

  @IsOptional()
  @IsString()
  deviceModel?: string;

  @IsOptional()
  @IsString()
  devicePlatform?: string;

  @IsOptional()
  @IsString()
  deviceAttestationType?: string;

  @IsOptional()
  baseSalary?: number;

  @IsOptional()
  salaryStructure?: any;
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

  @IsOptional()
  @IsString()
  trustedDeviceId?: string;

  @IsOptional()
  @IsString()
  deviceModel?: string;

  @IsOptional()
  @IsString()
  devicePlatform?: string;

  @IsOptional()
  @IsString()
  deviceAttestationType?: string;

  @IsOptional()
  baseSalary?: number;

  @IsOptional()
  salaryStructure?: any;
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
        baseSalary: dto.baseSalary !== undefined ? dto.baseSalary : 0,
        salaryStructure: dto.salaryStructure !== undefined ? dto.salaryStructure : {},
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
        ...(dto.trustedDeviceId !== undefined && { trustedDeviceId: dto.trustedDeviceId }),
        ...(dto.deviceModel !== undefined && { deviceModel: dto.deviceModel }),
        ...(dto.devicePlatform !== undefined && { devicePlatform: dto.devicePlatform }),
        ...(dto.deviceAttestationType !== undefined && { deviceAttestationType: dto.deviceAttestationType }),
        ...(dto.baseSalary !== undefined && { baseSalary: dto.baseSalary }),
        ...(dto.salaryStructure !== undefined && { salaryStructure: dto.salaryStructure }),
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

  async bindDevice(id: string, companyId: string, dto: {
    trustedDeviceId: string;
    deviceModel: string;
    devicePlatform: string;
    deviceAttestationType: string;
    deviceAttestationKey?: string;
  }) {
    const employee = await this.findOne(id, companyId);
    return this.prisma.employee.update({
      where: { id: employee.id },
      data: {
        trustedDeviceId: dto.trustedDeviceId,
        deviceModel: dto.deviceModel,
        devicePlatform: dto.devicePlatform,
        deviceBoundAt: new Date(),
        deviceAttestationType: dto.deviceAttestationType,
        deviceAttestationKey: dto.deviceAttestationKey,
      },
    });
  }

  async unbindDevice(id: string, companyId: string) {
    const employee = await this.findOne(id, companyId);
    return this.prisma.employee.update({
      where: { id: employee.id },
      data: {
        trustedDeviceId: null,
        deviceModel: null,
        devicePlatform: null,
        deviceBoundAt: null,
        deviceAttestationType: null,
        deviceAttestationKey: null,
      },
    });
  }

  async updateSalaryStructure(id: string, companyId: string, salaryStructure: any, baseSalary?: number) {
    const cleanId = id.replace(/^(emp_|usr_)/, '');

    // 1. Try finding in Employee
    const employee = await this.prisma.employee.findFirst({
      where: { id: cleanId, companyId },
    });

    if (employee) {
      const updated = await this.prisma.employee.update({
        where: { id: employee.id },
        data: {
          salaryStructure: salaryStructure || {},
          ...(baseSalary !== undefined && { baseSalary }),
        },
      });

      // Keep user in sync if linked
      if (employee.email || employee.username) {
        const matchingUser = await this.prisma.user.findFirst({
          where: {
            companyId,
            OR: [
              ...(employee.email ? [{ email: employee.email }] : []),
              ...(employee.username ? [{ email: employee.username }] : []),
              { name: employee.fullName },
            ],
          },
        });
        if (matchingUser) {
          await this.prisma.user.update({
            where: { id: matchingUser.id },
            data: {
              salaryStructure: salaryStructure || {},
              ...(baseSalary !== undefined && { baseSalary }),
            },
          }).catch(() => {});
        }
      }

      return { success: true, type: 'EMPLOYEE', id: employee.id, updated };
    }

    // 2. Try finding in User
    const user = await this.prisma.user.findFirst({
      where: { id: cleanId, companyId },
    });

    if (user) {
      const updated = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          salaryStructure: salaryStructure || {},
          ...(baseSalary !== undefined && { baseSalary }),
        },
      });

      // Keep employee in sync if linked
      const matchingEmployee = await this.prisma.employee.findFirst({
        where: {
          companyId,
          OR: [
            { email: user.email },
            { fullName: user.name },
          ],
        },
      });
      if (matchingEmployee) {
        await this.prisma.employee.update({
          where: { id: matchingEmployee.id },
          data: {
            salaryStructure: salaryStructure || {},
            ...(baseSalary !== undefined && { baseSalary }),
          },
        }).catch(() => {});
      }

      return { success: true, type: 'USER', id: user.id, updated };
    }

    throw new NotFoundException('الموظف أو المستخدم غير موجود في هذه الشركة');
  }

  async batchUpdateSalaryStructures(companyId: string, structures: Record<string, any>) {
    if (!structures || typeof structures !== 'object') {
      throw new BadRequestException('بيانات هياكل الرواتب غير صالحة');
    }

    const results: any[] = [];
    for (const [key, val] of Object.entries(structures)) {
      if (!val) continue;
      const struct = val.structure || val;
      const baseSalary = val.nominalSalary ?? struct?.nominalSalary;
      try {
        const res = await this.updateSalaryStructure(key, companyId, struct, baseSalary);
        results.push(res);
      } catch (e: any) {
        // Continue on individual failure
      }
    }

    return { success: true, count: results.length };
  }
}

