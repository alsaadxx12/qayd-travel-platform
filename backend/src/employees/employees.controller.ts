import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EmployeesService, CreateEmployeeDto, UpdateEmployeeDto } from './employees.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('إدارة الموظفين والكوادر')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @ApiOperation({ summary: 'قائمة جميع الموظفين في الشركة' })
  async findAll(@Req() req: any) {
    return this.employeesService.findAll(req.user.companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'تفاصيل موظف محدد' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.employeesService.findOne(id, req.user.companyId);
  }

  @Post()
  @ApiOperation({ summary: 'إضافة موظف جديد لحسابات الشركة' })
  async create(@Req() req: any, @Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(req.user.companyId, dto);
  }

  @Post('salary-structures/batch')
  @ApiOperation({ summary: 'حفظ وتحديث هيكل الرواتب والمخصصات لمجموعة موظفين دفعة واحدة' })
  async batchUpdateSalaryStructures(@Req() req: any, @Body() body: { structures: Record<string, any> }) {
    return this.employeesService.batchUpdateSalaryStructures(req.user.companyId, body.structures);
  }

  @Patch(':id/salary-structure')
  @ApiOperation({ summary: 'تحديث هيكل الراتب الاسمي والمخصصات لموظف أو مستخدم' })
  async updateSalaryStructure(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body: { salaryStructure: any; baseSalary?: number },
  ) {
    return this.employeesService.updateSalaryStructure(id, req.user.companyId, body.salaryStructure, body.baseSalary);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'تعديل بيانات الموظف والصندوق وحساب الدخول' })
  async update(@Param('id') id: string, @Req() req: any, @Body() dto: UpdateEmployeeDto) {
    return this.employeesService.update(id, req.user.companyId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'حذف موظف' })
  async delete(@Param('id') id: string, @Req() req: any) {
    return this.employeesService.delete(id, req.user.companyId);
  }

  @Post(':id/bind-device')
  @ApiOperation({ summary: 'ربط وتوثيق جهاز معتمد للموظف (Android Keystore / iOS Secure Enclave)' })
  async bindDevice(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: any,
  ) {
    return this.employeesService.bindDevice(id, req.user.companyId, dto);
  }

  @Post(':id/unbind-device')
  @ApiOperation({ summary: 'فك ارتباط الجهاز المعتمد للموظف والسماح بإعادة الربط' })
  async unbindDevice(@Param('id') id: string, @Req() req: any) {
    return this.employeesService.unbindDevice(id, req.user.companyId);
  }
}
