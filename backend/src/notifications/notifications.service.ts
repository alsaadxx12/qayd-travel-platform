import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateNotificationDto {
  tenantId?: string;
  userId?: string;
  title: string;
  message: string;
  type?: string; // FEEDBACK_RESOLVED, SYSTEM, ACCOUNTING, SUBSCRIPTION, ALERT
  severity?: string; // INFO, SUCCESS, WARNING, DANGER
  link?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async getMyNotifications(userId?: string, tenantId?: string) {
    // Return all notifications where target is this user or this tenant and not deleted
    return await this.prisma.appNotification.findMany({
      where: {
        isDeleted: false,
        OR: [
          ...(userId ? [{ userId }] : []),
          ...(tenantId ? [{ tenantId }] : []),
          { userId: null, tenantId: null }, // Global notifications
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getUnreadCount(userId?: string, tenantId?: string) {
    return await this.prisma.appNotification.count({
      where: {
        isDeleted: false,
        isRead: false,
        OR: [
          ...(userId ? [{ userId }] : []),
          ...(tenantId ? [{ tenantId }] : []),
          { userId: null, tenantId: null },
        ],
      },
    });
  }

  async create(dto: CreateNotificationDto) {
    return await this.prisma.appNotification.create({
      data: {
        tenantId: dto.tenantId,
        userId: dto.userId,
        title: dto.title,
        message: dto.message,
        type: dto.type || 'SYSTEM',
        severity: dto.severity || 'INFO',
        link: dto.link,
      },
    });
  }

  async markAsRead(id: string) {
    return await this.prisma.appNotification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId?: string, tenantId?: string) {
    return await this.prisma.appNotification.updateMany({
      where: {
        isDeleted: false,
        isRead: false,
        OR: [
          ...(userId ? [{ userId }] : []),
          ...(tenantId ? [{ tenantId }] : []),
          { userId: null, tenantId: null },
        ],
      },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async deleteNotification(id: string) {
    // Mark as deleted so it never appears again
    return await this.prisma.appNotification.update({
      where: { id },
      data: { isDeleted: true },
    });
  }

  async clearAll(userId?: string, tenantId?: string) {
    return await this.prisma.appNotification.updateMany({
      where: {
        isDeleted: false,
        OR: [
          ...(userId ? [{ userId }] : []),
          ...(tenantId ? [{ tenantId }] : []),
          { userId: null, tenantId: null },
        ],
      },
      data: { isDeleted: true },
    });
  }
}
