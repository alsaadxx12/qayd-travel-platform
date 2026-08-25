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
}
