import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackDto, ResolveFeedbackDto } from './feedback.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async createFeedback(dto: CreateFeedbackDto, user?: any, tenantId?: string) {
    let finalTenantId = tenantId || user?.tenantId || user?.companyId;
    let tenantName: string | undefined = dto.tenantName;

    if (!tenantName) {
      const company = await this.prisma.company.findFirst({
        where: {
          OR: [
            ...(user?.companyId ? [{ id: user.companyId }] : []),
            ...(finalTenantId ? [{ tenantId: finalTenantId }] : []),
          ],
        },
        select: { name: true },
      });
      tenantName = company?.name;
    }

    if (!tenantName && finalTenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: finalTenantId },
        select: { name: true },
      });
      tenantName = tenant?.name;
    }

    if (!tenantName) {
      tenantName = user?.companyName || user?.tenantName || 'علاء الدين';
    }

    const userName = dto.userName || user?.name || user?.email?.split('@')[0] || 'مستخدم النظام';
    const userEmail = dto.userEmail || user?.email;
    const userPhone = dto.userPhone || user?.phone;
    const userId = user?.id || user?.userId || user?.sub;

    return await this.prisma.systemFeedback.create({
      data: {
        tenantId: finalTenantId || undefined,
        companyId: user?.companyId || undefined,
        userId: userId || undefined,
        userName,
        userEmail,
        userPhone,
        tenantName,
        type: dto.type || 'BUG',
        severity: dto.severity || 'MEDIUM',
        title: dto.title,
        description: dto.description,
        screenshotUrl: dto.screenshotUrl,
        pageUrl: dto.pageUrl,
        status: 'OPEN',
      },
    });
  }

  async getMyFeedbacks(
    userId?: string,
    tenantId?: string,
    userEmail?: string,
    userName?: string,
    companyName?: string,
    tenantName?: string,
  ) {
    const filters: any[] = [];
    if (userId) filters.push({ userId });
    if (tenantId) filters.push({ tenantId });
    if (userEmail) filters.push({ userEmail: { equals: userEmail, mode: 'insensitive' } });
    if (userName) filters.push({ userName: { equals: userName, mode: 'insensitive' } });
    if (companyName) filters.push({ tenantName: { contains: companyName, mode: 'insensitive' } });
    if (tenantName) filters.push({ tenantName: { contains: tenantName, mode: 'insensitive' } });

    // Also include default company name match
    filters.push({ tenantName: { contains: 'علاء الدين', mode: 'insensitive' } });

    return await this.prisma.systemFeedback.findMany({
      where: filters.length > 0 ? { OR: filters } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getAllFeedbacks(query: {
    status?: string;
    type?: string;
    severity?: string;
    search?: string;
  }) {
    const { status, type, severity, search } = query;
    const where: any = {};

    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (type && type !== 'ALL') {
      where.type = type;
    }
    if (severity && severity !== 'ALL') {
      where.severity = severity;
    }
    if (search) {
      const s = search.trim();
      where.OR = [
        { title: { contains: s, mode: 'insensitive' } },
        { description: { contains: s, mode: 'insensitive' } },
        { userName: { contains: s, mode: 'insensitive' } },
        { userEmail: { contains: s, mode: 'insensitive' } },
        { tenantName: { contains: s, mode: 'insensitive' } },
      ];
    }

    return await this.prisma.systemFeedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            phone: true,
          },
        },
      },
    });
  }

  async getFeedbackById(id: string) {
    const feedback = await this.prisma.systemFeedback.findUnique({
      where: { id },
      include: {
        tenant: true,
      },
    });
    if (!feedback) {
      throw new NotFoundException('البلاغ غير موجود');
    }
    return feedback;
  }

  async updateStatus(id: string, status: string) {
    await this.getFeedbackById(id);
    return await this.prisma.systemFeedback.update({
      where: { id },
      data: { status },
    });
  }

  async resolveFeedback(id: string, dto: ResolveFeedbackDto, resolverUser?: any) {
    const feedback = await this.getFeedbackById(id);

    const updated = await this.prisma.systemFeedback.update({
      where: { id },
      data: {
        status: dto.status || 'RESOLVED',
        adminReply: dto.adminReply,
        resolvedAt: new Date(),
        resolvedById: resolverUser?.id || resolverUser?.userId,
      },
    });

    /**
     * The reply goes to whoever raised the ticket — and to nobody else.
     *
     * Older tickets were stored without a userId (it is only captured when the
     * reporter was signed in and the token carried an id), so the reporter is looked
     * up by the email on the ticket as well. Without one of the two there is no
     * person to notify, and the reply is NOT broadcast to the company instead: a
     * support answer is addressed to one employee, and sending it to all of their
     * colleagues is both noise and a small disclosure.
     */
    const recipientId = feedback.userId || (await this.findReporterId(feedback));

    if (recipientId) {
      await this.notificationsService.create({
        tenantId: feedback.tenantId || undefined,
        userId: recipientId,
        title: `تم حل المشكلة / الملاحظة: ${feedback.title.substring(0, 35)}...`,
        message: dto.adminReply || 'قام فريق الدعم الفني بمعالجة البلاغ الخاص بك بنجاح.',
        type: 'FEEDBACK_RESOLVED',
        severity: 'SUCCESS',
        link: '/help-center',
      });
    } else {
      this.logger.warn(
        `Feedback ${id} resolved but no user could be matched (userId and userEmail both unusable) — nobody was notified.`,
      );
    }

    // Reported back so the screen can say the reply landed nowhere, rather than
    // showing a success that silently notified no one.
    return { ...updated, notifiedUserId: recipientId || null };
  }

  /**
   * Matches a ticket to a real user account by the email it was filed with.
   *
   * Email is the only identifier a ticket reliably carries, and it is compared
   * case-insensitively because people type their own address both ways.
   */
  private async findReporterId(feedback: {
    userEmail?: string | null;
    companyId?: string | null;
  }): Promise<string | null> {
    const email = String(feedback.userEmail || '').trim();
    if (!email) return null;
    try {
      const user = await this.prisma.user.findFirst({
        where: {
          email: { equals: email, mode: 'insensitive' },
          ...(feedback.companyId ? { companyId: feedback.companyId } : {}),
        },
        select: { id: true },
      });
      return user?.id || null;
    } catch (err: any) {
      this.logger.warn(`Reporter lookup failed for ${email}: ${err?.message || err}`);
      return null;
    }
  }

  async deleteFeedback(id: string) {
    await this.getFeedbackById(id);
    return await this.prisma.systemFeedback.delete({
      where: { id },
    });
  }
}
