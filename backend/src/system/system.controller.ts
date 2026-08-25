import { Controller, Get, Post, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SystemService } from './system.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('إعدادات ومعلومات النظام وقاعدة البيانات')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('system')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get('database-info')
  @ApiOperation({ summary: 'عرض تفاصيل وإحصائيات واستخدام قاعدة بيانات Supabase' })
  async getDatabaseInfo(@Req() req: any) {
    return this.systemService.getDatabaseInfo(req.user?.companyId);
  }

  @Post('optimize-database')
  @ApiOperation({ summary: 'تحسين الفهارس وتحديث إحصائيات الجداول' })
  async optimizeDatabase() {
    return this.systemService.runVacuumAnalyze();
  }
}
