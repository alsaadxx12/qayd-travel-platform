import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditLogsService {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string, entity?: string, entityId?: string) {
    const where: any = { companyId };
    if (entity) where.entity = entity;
    if (entityId) where.entityId = entityId;

    return this.prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async createLog(data: {
    companyId: string;
    action: string;
    entity: string;
    entityId?: string;
    details?: string;
    userId?: string;
    ipAddress?: string;
  }) {
    return this.prisma.auditLog.create({
      data: {
        companyId: data.companyId,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        details: data.details,
        userId: data.userId,
        ipAddress: data.ipAddress,
      },
    });
  }
}
