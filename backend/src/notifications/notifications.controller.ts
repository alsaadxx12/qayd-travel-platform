import { Controller, Get, Put, Delete, Param, Request, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getMyNotifications(@Request() req: any) {
    const userId = req.user?.id || req.user?.userId;
    const tenantId = req.user?.tenantId || req.user?.companyId;
    return await this.notificationsService.getMyNotifications(userId, tenantId);
  }

  @Get('unread-count')
  async getUnreadCount(@Request() req: any) {
    const userId = req.user?.id || req.user?.userId;
    const tenantId = req.user?.tenantId || req.user?.companyId;
    const count = await this.notificationsService.getUnreadCount(userId, tenantId);
    return { unreadCount: count };
  }

  @Put(':id/read')
  async markAsRead(@Param('id') id: string) {
    return await this.notificationsService.markAsRead(id);
  }

  @Put('read-all')
  async markAllAsRead(@Request() req: any) {
    const userId = req.user?.id || req.user?.userId;
    const tenantId = req.user?.tenantId || req.user?.companyId;
    return await this.notificationsService.markAllAsRead(userId, tenantId);
  }

  @Delete(':id')
  async deleteNotification(@Param('id') id: string) {
    return await this.notificationsService.deleteNotification(id);
  }

  @Delete('clear/all')
  async clearAll(@Request() req: any) {
    const userId = req.user?.id || req.user?.userId;
    const tenantId = req.user?.tenantId || req.user?.companyId;
    return await this.notificationsService.clearAll(userId, tenantId);
  }
}
