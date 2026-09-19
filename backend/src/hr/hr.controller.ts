import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HrService } from './hr.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CreateSalaryDto,
  UpdateSalaryDto,
  CreateAttendanceDto,
  UpdateAttendanceDto,
  CreateLeaveDto,
  UpdateLeaveStatusDto,
  SetLeaveBalanceDto,
  BatchSetLeaveBalancesDto,
  AwardPointsDto,
  CreateCompetitionDto,
  UpdateCompetitionDto,
} from './hr.dto';

@ApiTags('إدارة الموارد البشرية والموظفين (HR)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hr')
export class HrController {
  constructor(private readonly hrService: HrService) {}

  // ── Overall Stats ──
  @Get('stats')
  @ApiOperation({ summary: 'إحصائيات الموظفين والحضور للمتجر واللوحة' })
  async getHrStats(@Req() req: any) {
    return this.hrService.getHrStats(req.user.companyId);
  }

  // ── Salaries ──
  @Get('salaries')
  @ApiOperation({ summary: 'قائمة مسيرات الرواتب' })
  async getSalaries(
    @Req() req: any,
    @Query('month') month?: string,
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: string,
  ) {
    return this.hrService.getSalaries(req.user.companyId, month, employeeId, status);
  }

  @Post('salaries')
  @ApiOperation({ summary: 'إصدار مسير راتب جديد لموظف' })
  async createSalary(@Req() req: any, @Body() dto: CreateSalaryDto) {
    return this.hrService.createSalary(req.user.companyId, dto);
  }

  @Patch('salaries/:id')
  @ApiOperation({ summary: 'تعديل مسير راتب أو صرفه' })
  async updateSalary(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateSalaryDto,
  ) {
    return this.hrService.updateSalary(req.user.companyId, id, dto);
  }

  @Delete('salaries/:id')
  @ApiOperation({ summary: 'حذف مسير راتب' })
  async deleteSalary(@Req() req: any, @Param('id') id: string) {
    return this.hrService.deleteSalary(req.user.companyId, id);
  }

  // ── Attendance ──
  @Get('attendance')
  @ApiOperation({ summary: 'سجل الحضور والانصراف' })
  async getAttendance(
    @Req() req: any,
    @Query('date') date?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.hrService.getAttendance(req.user.companyId, date, employeeId);
  }

  @Post('attendance')
  @ApiOperation({ summary: 'تسجيل حركة حضور وانصراف لموظف' })
  async recordAttendance(@Req() req: any, @Body() dto: CreateAttendanceDto) {
    return this.hrService.recordAttendance(req.user.companyId, dto);
  }

  @Patch('attendance/:id')
  @ApiOperation({ summary: 'تعديل سجل حضور' })
  async updateAttendance(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateAttendanceDto,
  ) {
    return this.hrService.updateAttendance(req.user.companyId, id, dto);
  }

  @Delete('attendance/:id')
  @ApiOperation({ summary: 'حذف سجل حضور' })
  async deleteAttendance(@Req() req: any, @Param('id') id: string) {
    return this.hrService.deleteAttendance(req.user.companyId, id);
  }

  // ── Leaves ──
  @Get('leaves')
  @ApiOperation({ summary: 'قائمة طلبات الإجازات' })
  async getLeaves(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('employeeId') employeeId?: string,
    @Query('leaveType') leaveType?: string,
  ) {
    return this.hrService.getLeaves(req.user.companyId, status, employeeId, leaveType);
  }

  @Get('leaves/balances')
  @ApiOperation({ summary: 'أرصدة إجازات الموظفين' })
  async getLeaveBalances(
    @Req() req: any,
    @Query('year') year?: number,
    @Query('leaveType') leaveType?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.hrService.getLeaveBalances(req.user.companyId, year, leaveType, employeeId);
  }

  @Post('leaves/balances')
  @ApiOperation({ summary: 'تعيين أو تعديل رصيد إجازات موظف' })
  async setLeaveBalance(@Req() req: any, @Body() dto: SetLeaveBalanceDto) {
    return this.hrService.setLeaveBalance(req.user.companyId, dto);
  }

  @Post('leaves/balances/batch')
  @ApiOperation({ summary: 'تعيين رصيد إجازات موحد لمجموعة موظفين' })
  async batchSetLeaveBalances(@Req() req: any, @Body() dto: BatchSetLeaveBalancesDto) {
    return this.hrService.batchSetLeaveBalances(req.user.companyId, dto);
  }

  @Post('leaves')
  @ApiOperation({ summary: 'تقديم طلب إجازة جديد' })
  async createLeave(@Req() req: any, @Body() dto: CreateLeaveDto) {
    return this.hrService.createLeave(req.user.companyId, dto);
  }

  @Patch('leaves/:id/status')
  @ApiOperation({ summary: 'اعتماد أو رفض طلب إجازة' })
  async updateLeaveStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateLeaveStatusDto,
  ) {
    const approvedBy = req.user?.fullName || req.user?.username || 'المشرف';
    return this.hrService.updateLeaveStatus(req.user.companyId, id, dto, approvedBy);
  }

  @Delete('leaves/:id')
  @ApiOperation({ summary: 'حذف طلب إجازة' })
  async deleteLeave(@Req() req: any, @Param('id') id: string) {
    return this.hrService.deleteLeave(req.user.companyId, id);
  }

  // ── Points ──
  @Get('points/summary')
  @ApiOperation({ summary: 'لوحة شرف النقاط وترتيب الموظفين' })
  async getPointsSummary(@Req() req: any) {
    return this.hrService.getPointsSummary(req.user.companyId);
  }

  @Get('points/logs')
  @ApiOperation({ summary: 'سجل حركات منح وخصم النقاط' })
  async getPointsLogs(
    @Req() req: any,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.hrService.getPointsLogs(req.user.companyId, employeeId);
  }

  @Post('points/award')
  @ApiOperation({ summary: 'منح أو خصم نقاط لموظف' })
  async awardPoints(@Req() req: any, @Body() dto: AwardPointsDto) {
    const awardedBy = req.user?.fullName || req.user?.username || 'الإدارة';
    return this.hrService.awardPoints(req.user.companyId, dto, awardedBy);
  }

  @Delete('points/logs/:id')
  @ApiOperation({ summary: 'حذف حركة نقطة' })
  async deletePointLog(@Req() req: any, @Param('id') id: string) {
    return this.hrService.deletePointLog(req.user.companyId, id);
  }

  @Get('points/rules')
  @ApiOperation({ summary: 'جلب قواعد واحتساب نقاط الحضور والتأخير والإضافي' })
  async getPointsRules(@Req() req: any) {
    return this.hrService.getPointsRules(req.user.companyId);
  }

  @Post('points/rules')
  @ApiOperation({ summary: 'حفظ وتحديث قواعد واحتساب نقاط الحضور والتأخير والإضافي' })
  async savePointsRules(@Req() req: any, @Body() body: any) {
    return this.hrService.savePointsRules(req.user.companyId, body);
  }

  // ── Competitions ──
  @Get('competitions')
  @ApiOperation({ summary: 'قائمة مسابقات وتحديات الموظفين' })
  async getCompetitions(
    @Req() req: any,
    @Query('status') status?: string,
  ) {
    return this.hrService.getCompetitions(req.user.companyId, status);
  }

  @Post('competitions')
  @ApiOperation({ summary: 'إطلاق مسابقة وتحدي جديد' })
  async createCompetition(@Req() req: any, @Body() dto: CreateCompetitionDto) {
    return this.hrService.createCompetition(req.user.companyId, dto);
  }

  @Patch('competitions/:id')
  @ApiOperation({ summary: 'تحديث مسابقة أو تتويج الفائز' })
  async updateCompetition(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateCompetitionDto,
  ) {
    return this.hrService.updateCompetition(req.user.companyId, id, dto);
  }

  @Delete('competitions/:id')
  @ApiOperation({ summary: 'حذف مسابقة' })
  async deleteCompetition(@Req() req: any, @Param('id') id: string) {
    return this.hrService.deleteCompetition(req.user.companyId, id);
  }
}
