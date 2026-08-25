import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IsString, IsOptional } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  permissions?: string; // JSON stringified permissions array

  @IsOptional()
  @IsString()
  allowedBranches?: string;
}

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  permissions?: string;

  @IsOptional()
  @IsString()
  allowedBranches?: string;
}

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.role.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { users: true, employees: true } },
      },
    });
  }

  async findOne(id: string, companyId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, companyId },
      include: {
        _count: { select: { users: true, employees: true } },
      },
    });
    if (!role) {
      throw new NotFoundException('مجموعة الصلاحيات غير موجودة');
    }
    return role;
  }

  async create(companyId: string, dto: CreateRoleDto) {
    return this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description,
        permissions: dto.permissions || '[]',
        allowedBranches: dto.allowedBranches || 'جميع الفروع',
        companyId,
      },
    });
  }

  async update(id: string, companyId: string, dto: UpdateRoleDto) {
    await this.findOne(id, companyId);
    return this.prisma.role.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.permissions !== undefined && { permissions: dto.permissions }),
        ...(dto.allowedBranches !== undefined && { allowedBranches: dto.allowedBranches }),
      },
    });
  }

  async delete(id: string, companyId: string) {
    await this.findOne(id, companyId);
    return this.prisma.role.delete({ where: { id } });
  }
}
