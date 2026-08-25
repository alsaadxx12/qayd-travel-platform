import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CustomersSuppliersService } from './customers-suppliers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('العملاء والموردون وشركات الطيران')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('partners')
export class CustomersSuppliersController {
  constructor(private readonly service: CustomersSuppliersService) {}

  @Get('customers')
  @ApiOperation({ summary: 'قائمة العملاء' })
  async getCustomers(@Req() req: any) {
    return this.service.getCustomers(req.user.companyId);
  }

  @Get('suppliers')
  @ApiOperation({ summary: 'قائمة الموردين وشركات الطيران' })
  async getSuppliers(@Req() req: any) {
    return this.service.getSuppliers(req.user.companyId);
  }

  @Post('customers')
  @ApiOperation({ summary: 'إضافة عميل جديد وتوليد حسابه المحاسبي' })
  async createCustomer(
    @Req() req: any,
    @Body() data: { code: string; nameAr: string; nameEn?: string; phone?: string; email?: string; address?: string },
  ) {
    return this.service.createCustomer(req.user.companyId, data);
  }

  @Post('suppliers')
  @ApiOperation({ summary: 'إضافة مورد أو شركة طيران جديدة وتوليد حسابها المحاسبي' })
  async createSupplier(
    @Req() req: any,
    @Body() data: { code: string; nameAr: string; nameEn?: string; isAirline?: boolean; phone?: string; email?: string; address?: string },
  ) {
    return this.service.createSupplier(req.user.companyId, data);
  }
}
