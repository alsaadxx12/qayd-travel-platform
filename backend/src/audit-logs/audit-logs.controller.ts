import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuditLogsService } from './audit-logs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('سجل المراجعة والعمليات (Audit Logs)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly service: AuditLogsService) {}

  @Get()
  @ApiOperation({ summary: 'استعراض سجل جميع التغييرات والعمليات المالية والمستخدم المنفذ' })
  async findAll(
    @Req() req: any,
    @Query('entity') entity?: string,
    @Query('entityId') entityId?: string,
  ) {
    return this.service.findAll(req.user.companyId, entity, entityId);
  }
}
