import { Controller, Get, Query, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('التقارير المحاسبية (Accounting Reports)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('debts')
  @ApiOperation({ summary: 'تقرير الديون والذمم للعملاء والموردين مع أرصدة الدينار والدولار' })
  async getDebtsReport(@Req() req: any) {
    return this.reportsService.getDebtsReport(req.user.companyId);
  }

  @Get('account-statement/:accountId')
  @ApiOperation({ summary: 'كشف حساب تفصيلي مع الرصيد الافتتاحي والرصيد التراكمي' })
  async getAccountStatement(
    @Param('accountId') accountId: string,
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getAccountStatement(req.user.companyId, accountId, startDate, endDate);
  }

  @Get('debts/:accountId/amount-trace')
  @ApiOperation({ summary: 'تتبع مصدر وحركة مبلغ المديونية من المستند إلى القيد والحسابات المقابلة' })
  async getDebtAmountTrace(
    @Param('accountId') accountId: string,
    @Req() req: any,
  ) {
    return this.reportsService.getDebtAmountTrace(req.user.companyId, accountId);
  }

  @Get('trial-balance')
  @ApiOperation({ summary: 'ميزان المراجعة لجميع الحسابات مع التحقق من توازن إجمالي المدين والدائن' })
  async getTrialBalance(@Req() req: any) {
    return this.reportsService.getTrialBalance(req.user.companyId);
  }

  @Get('income-statement')
  @ApiOperation({ summary: 'قائمة الدخل (الأرباح والخسائر) لإيرادات تذاكر الطيران والمصاريف' })
  async getIncomeStatement(@Req() req: any) {
    return this.reportsService.getIncomeStatement(req.user.companyId);
  }

  @Get('comprehensive-profits')
  @ApiOperation({ summary: 'تحليل شامل لجميع أرباح الخدمات التشغيلية والمكاسب العرضية وخصم المصاريف والرواتب' })
  async getComprehensiveProfits(
    @Req() req: any,
    @Query('branchId') branchId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getComprehensiveProfits(req.user.companyId, branchId, startDate, endDate);
  }

  @Get('balance-sheet')
  @ApiOperation({ summary: 'الميزانية العمومية (الأصول = الالتزامات + حقوق الملكية)' })
  async getBalanceSheet(@Req() req: any) {
    return this.reportsService.getBalanceSheet(req.user.companyId);
  }
}
