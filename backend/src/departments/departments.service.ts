import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IsOptional, IsString } from 'class-validator';

export class CreateDepartmentDto {
  @IsOptional() @IsString()
  branchId?: string;

  @IsOptional() @IsString()
  branchName?: string;

  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsOptional() @IsString()
  headName?: string;

  @IsOptional() @IsString()
  description?: string;
}

export class UpdateDepartmentDto {
  @IsOptional() @IsString()
  branchId?: string;

  @IsOptional() @IsString()
  branchName?: string;

  @IsOptional() @IsString()
  code?: string;

  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsString()
  headName?: string;

  @IsOptional() @IsString()
  description?: string;
}

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  private async resolveBranch(companyId: string, branchId?: string, branchName?: string) {
    const hint = branchId || branchName;
    if (!hint) throw new BadRequestException('يجب تحديد الفرع المرتبط بالقسم');

    const branch = await this.prisma.branch.findFirst({
      where: {
        companyId,
        OR: [{ id: hint }, { code: hint }, { nameAr: hint }, { nameEn: hint }],
      },
      select: { id: true, nameAr: true },
    });
    if (!branch) throw new BadRequestException('الفرع المحدد غير موجود في الشركة الحالية');
    return branch;
  }

  async findAll(companyId: string) {
    return this.prisma.department.findMany({
      where: { companyId },
      include: { branch: { select: { id: true, code: true, nameAr: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string, companyId: string) {
    const dep = await this.prisma.department.findFirst({
      where: { id, companyId },
      include: { branch: { select: { id: true, code: true, nameAr: true } } },
    });
    if (!dep) throw new NotFoundException('القسم غير موجود');
    return dep;
  }

  async create(companyId: string, dto: CreateDepartmentDto) {
    const branch = await this.resolveBranch(companyId, dto.branchId, dto.branchName);
    return this.prisma.department.create({
      data: {
        code: dto.code,
        name: dto.name,
        headName: dto.headName,
        description: dto.description,
        branchId: branch.id,
        branchName: branch.nameAr,
        companyId,
      },
      include: { branch: { select: { id: true, code: true, nameAr: true } } },
    });
  }

  async update(id: string, companyId: string, dto: UpdateDepartmentDto) {
    const existing = await this.findOne(id, companyId);
    const branch = await this.resolveBranch(
      companyId,
      dto.branchId ?? existing.branchId ?? undefined,
      dto.branchName ?? existing.branchName,
    );
    return this.prisma.department.update({
      where: { id },
      data: {
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.headName !== undefined && { headName: dto.headName }),
        ...(dto.description !== undefined && { description: dto.description }),
        branchId: branch.id,
        branchName: branch.nameAr,
      },
      include: { branch: { select: { id: true, code: true, nameAr: true } } },
    });
  }

  async remove(id: string, companyId: string) {
    await this.findOne(id, companyId);
    return this.prisma.department.delete({ where: { id } });
  }
}
