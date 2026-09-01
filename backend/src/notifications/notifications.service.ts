import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MicroCache } from '../common/micro-cache';

export interface CreateNotificationDto {
  tenantId?: string;
  userId?: string;
  title: string;
  message: string;
  type?: string; // FEEDBACK_RESOLVED, SYSTEM, ACCOUNTING, SUBSCRIPTION, ALERT
  severity?: string; // INFO, SUCCESS, WARNING, DANGER
  link?: string;
}

/**
 * Whose notification is whose.
 *
 * A row carries a userId when it is addressed to ONE person and a tenantId to say
 * which company it belongs to — and a personal notification carries both. The
 * queries below used to treat any tenant match as «mine», so a reply written for one
 * employee was handed to every colleague in the company, the admin who wrote it
 * included. That is why resolving a support ticket notified the resolver instead of
 * the person who raised it.
 *
 * The rule now: a notification with a userId belongs to that user alone. A tenant
 * row counts as everyone's only when it names no user — a real broadcast.
 */
@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  /**
   * القائمة والعدّاد يُستطلعان دورياً من كل جلسة مفتوحة، وكلاهما كان رحلة
   * كاملة إلى قاعدة بيانات بعيدة (1.1s في فاحص الأداء). خمس عشرة ثانية خبيئة
   * تحت مهلة استطلاع الواجهة (30s)، وأي كتابة — إنشاء، قراءة، حذف — تُسقطها
   * فيصل الجديد في الاستطلاع التالي مباشرة.
   */
  private readonly cache = new MicroCache(15_000);

  async getMyNotifications(userId?: string, tenantId?: string) {
    return this.cache.wrap(`list|${userId || ''}|${tenantId || ''}`, () =>
      this.getMyNotificationsUncached(userId, tenantId),
    );
  }

  private async getMyNotificationsUncached(userId?: string, tenantId?: string) {
    // Return all notifications where target is this user or this tenant and not deleted
    return await this.prisma.appNotification.findMany({
      where: {
        isDeleted: false,
        OR: [
          ...(userId ? [{ userId }] : []),
          // Tenant notifications are BROADCASTS, so only the ones addressed to
          // nobody in particular belong to everybody. See the note above.
          ...(tenantId ? [{ tenantId, userId: null }] : []),
          { userId: null, tenantId: null }, // Global notifications
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getUnreadCount(userId?: string, tenantId?: string) {
    return this.cache.wrap(`count|${userId || ''}|${tenantId || ''}`, () =>
      this.getUnreadCountUncached(userId, tenantId),
    );
  }

  private async getUnreadCountUncached(userId?: string, tenantId?: string) {
    return await this.prisma.appNotification.count({
      where: {
        isDeleted: false,
        isRead: false,
        OR: [
          ...(userId ? [{ userId }] : []),
          // Tenant notifications are BROADCASTS, so only the ones addressed to
          // nobody in particular belong to everybody. See the note above.
          ...(tenantId ? [{ tenantId, userId: null }] : []),
          { userId: null, tenantId: null },
        ],
      },
    });
  }

  async create(dto: CreateNotificationDto) {
    this.cache.invalidate();
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
    this.cache.invalidate();
    return await this.prisma.appNotification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId?: string, tenantId?: string) {
    this.cache.invalidate();
    return await this.prisma.appNotification.updateMany({
      where: {
        isDeleted: false,
        isRead: false,
        OR: [
          ...(userId ? [{ userId }] : []),
          // Tenant notifications are BROADCASTS, so only the ones addressed to
          // nobody in particular belong to everybody. See the note above.
          ...(tenantId ? [{ tenantId, userId: null }] : []),
          { userId: null, tenantId: null },
        ],
      },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async deleteNotification(id: string) {
    this.cache.invalidate();
    // Mark as deleted so it never appears again
    return await this.prisma.appNotification.update({
      where: { id },
      data: { isDeleted: true },
    });
  }

  async clearAll(userId?: string, tenantId?: string) {
    this.cache.invalidate();
    return await this.prisma.appNotification.updateMany({
      where: {
        isDeleted: false,
        OR: [
          ...(userId ? [{ userId }] : []),
          // Tenant notifications are BROADCASTS, so only the ones addressed to
          // nobody in particular belong to everybody. See the note above.
          ...(tenantId ? [{ tenantId, userId: null }] : []),
          { userId: null, tenantId: null },
        ],
      },
      data: { isDeleted: true },
    });
  }
}
