import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FiscalYearsService } from './fiscal-years.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CreateFiscalYearDto,
  ExecuteClosingDto,
  ReopenFiscalYearDto,
  RecloseFiscalYearDto,
  RecalculateCascadingDto,
  SetActiveFiscalYearDto,
} from './dto/fiscal-years.dto';

@Controller('fiscal-years')
@UseGuards(JwtAuthGuard)
export class FiscalYearsController {
  constructor(private readonly fiscalYearsService: FiscalYearsService) {}

  @Get()
  async getYears(@Request() req: any) {
    const companyId = req.user.companyId;
    return this.fiscalYearsService.getYears(companyId);
  }

  @Get('active')
  async getActiveYear(@Request() req: any) {
    const companyId = req.user.companyId;
    const userId = req.user.id || req.user.userId;
    return this.fiscalYearsService.getActiveYear(userId, companyId);
  }

  @Post('active')
  async setActiveYear(@Body() dto: SetActiveFiscalYearDto, @Request() req: any) {
    const companyId = req.user.companyId;
    const userId = req.user.id || req.user.userId;
    return this.fiscalYearsService.setActiveYear(userId, dto.fiscalYearId, companyId);
  }

  @Get(':id')
  async getYear(@Param('id') id: string, @Request() req: any) {
    const companyId = req.user.companyId;
    return this.fiscalYearsService.getYear(id, companyId);
  }

  @Post()
  async createYear(@Body() dto: CreateFiscalYearDto, @Request() req: any) {
    const companyId = req.user.companyId;
    const userId = req.user.id || req.user.userId;
    return this.fiscalYearsService.createYear(dto, companyId, userId);
  }

  @Get(':id/pre-check')
  async preCheckClosing(@Param('id') id: string, @Request() req: any) {
    const companyId = req.user.companyId;
    return this.fiscalYearsService.preCheckYearClosing(id, companyId);
  }

  @Post('preview-closing')
  async previewClosing(
    @Body() dto: { fiscalYearId: string; targetFiscalYearId: string; retainedEarningsAccountId: string },
    @Request() req: any
  ) {
    const companyId = req.user.companyId;
    return this.fiscalYearsService.previewYearClosing(
      dto.fiscalYearId,
      dto.targetFiscalYearId,
      dto.retainedEarningsAccountId,
      companyId
    );
  }

  @Post('execute-closing')
  async executeClosing(@Body() dto: ExecuteClosingDto, @Request() req: any) {
    const companyId = req.user.companyId;
    const userId = req.user.id || req.user.userId;
    return this.fiscalYearsService.executeYearClosing(dto, companyId, userId);
  }

  @Post(':id/reopen')
  async reopenYear(@Param('id') id: string, @Body() dto: ReopenFiscalYearDto, @Request() req: any) {
    const companyId = req.user.companyId;
    const userId = req.user.id || req.user.userId;
    return this.fiscalYearsService.reopenYear(id, dto, companyId, userId);
  }

  @Post(':id/recalculate')
  async recalculateCascading(@Param('id') id: string, @Body() dto: RecalculateCascadingDto, @Request() req: any) {
    const companyId = req.user.companyId;
    const userId = req.user.id || req.user.userId;
    return this.fiscalYearsService.recalculateCascadingBalances(id, companyId, userId, dto);
  }

  @Post(':id/reclose')
  async recloseYear(@Param('id') id: string, @Body() dto: RecloseFiscalYearDto, @Request() req: any) {
    const companyId = req.user.companyId;
    const userId = req.user.id || req.user.userId;
    return this.fiscalYearsService.recloseYear(id, dto, companyId, userId);
  }

  @Get(':id/audit-logs')
  async getBalanceAuditLogs(
    @Param('id') id: string,
    @Query('accountId') accountId: string,
    @Query('actionType') actionType: string,
    @Request() req: any
  ) {
    const companyId = req.user.companyId;
    return this.fiscalYearsService.getBalanceAuditLogs(id, companyId, { accountId, actionType });
  }

  @Delete(':id')
  async deleteYear(@Param('id') id: string, @Request() req: any) {
    const companyId = req.user.companyId;
    const userId = req.user.id || req.user.userId;
    return this.fiscalYearsService.deleteYear(id, companyId, userId);
  }
}
