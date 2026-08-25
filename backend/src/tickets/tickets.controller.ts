import { Controller, Get, Post, Patch, Delete, Body, Param, Req, Query, Headers, UseGuards } from '@nestjs/common';
import { TicketsService, CreateTicketDto, UpdateTicketDto } from './tickets.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  findAll(
    @Req() req: any,
    @Query('branchId') queryBranchId?: string,
    @Headers('x-branch-id') headerBranchId?: string,
  ) {
    const branchId = queryBranchId || headerBranchId;
    return this.ticketsService.findAll(req.user.companyId, branchId);
  }

  @Get('flights')
  findFlights(
    @Req() req: any,
    @Query('branchId') queryBranchId?: string,
    @Headers('x-branch-id') headerBranchId?: string,
  ) {
    const branchId = queryBranchId || headerBranchId;
    return this.ticketsService.findFlights(req.user.companyId, branchId);
  }

  @Get('stats')
  getStats(@Req() req: any) {
    return this.ticketsService.getStats(req.user.companyId);
  }

  @Get('dashboard-summary')
  getDashboardSummary(
    @Req() req: any,
    @Query('branchId') queryBranchId?: string,
    @Headers('x-branch-id') headerBranchId?: string,
    @Query('datePreset') datePreset?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('operationType') operationType?: string,
    @Query('currency') currency?: string,
  ) {
    const branchId = queryBranchId || headerBranchId;
    return this.ticketsService.getDashboardSummary(req.user.companyId, {
      branchId,
      datePreset,
      dateFrom,
      dateTo,
      operationType,
      currency,
    });
  }

  @Get('visas')
  findVisas(
    @Req() req: any,
    @Query('branchId') queryBranchId?: string,
    @Headers('x-branch-id') headerBranchId?: string,
  ) {
    const branchId = queryBranchId || headerBranchId;
    return this.ticketsService.findVisas(req.user.companyId, branchId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.ticketsService.findOne(id, req.user.companyId);
  }

  @Post()
  create(@Body() dto: CreateTicketDto, @Req() req: any, @Headers('x-branch-id') branchId?: string) {
    return this.ticketsService.create(req.user.companyId, dto, req.user?.id || req.user?.sub, branchId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTicketDto,
    @Req() req: any,
    @Headers('x-branch-id') branchId?: string,
  ) {
    return this.ticketsService.update(id, req.user.companyId, dto, req.user?.id || req.user?.sub, branchId);
  }

  @Patch(':id/audit')
  toggleAudit(@Param('id') id: string, @Req() req: any) {
    return this.ticketsService.toggleAudit(id, req.user.companyId, req.user.name || req.user.email);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Body('reason') reason: string, @Req() req: any) {
    return this.ticketsService.cancelTicket(id, req.user.companyId, reason);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.ticketsService.remove(id, req.user.companyId);
  }
}
