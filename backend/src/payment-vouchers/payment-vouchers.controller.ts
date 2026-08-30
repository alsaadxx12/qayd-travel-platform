import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentVouchersService, CreatePaymentVoucherDto } from './payment-vouchers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('سندات الدفع (Payment Vouchers)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payment-vouchers')
export class PaymentVouchersController {
  constructor(private readonly paymentVouchersService: PaymentVouchersService) {}

  @Get()
  @ApiOperation({ summary: 'قائمة سندات الدفع' })
  async findAll(@Req() req: any, @Query('limit') limit?: string) {
    const parsed = Number(limit);
    return this.paymentVouchersService.findAll(req.user.companyId, Number.isFinite(parsed) ? parsed : undefined);
  }

  // Literal paths must be declared before ':id', or they are captured as an id.
  @Get('split-backfill')
  @ApiOperation({
    summary:
      'فحص سندات الدفع القديمة التي يحمل بيانها تقسيماً لم يُرحَّل إلى القيد. تقرير فقط ما لم يُمرَّر apply=1',
  })
  async backfillSplits(@Req() req: any, @Query('apply') apply?: string) {
    return this.paymentVouchersService.backfillLegacySplits(
      req.user.companyId,
      apply === '1' || apply === 'true',
    );
  }

  @Get('refresh-descriptions')
  @ApiOperation({
    summary:
      'إعادة كتابة بيان سطور القيد للسندات القديمة بتفصيل كامل يظهر في كشف الحساب. لا يمسّ أي مبلغ أو رصيد. تقرير فقط ما لم يُمرَّر apply=1',
  })
  async refreshDescriptions(@Req() req: any, @Query('apply') apply?: string) {
    return this.paymentVouchersService.refreshLineDescriptions(
      req.user.companyId,
      apply === '1' || apply === 'true',
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'تفاصيل سند دفع محدد مع القيد المحاسبي المرتبط' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.paymentVouchersService.findOne(id, req.user.companyId);
  }

  @Post()
  @ApiOperation({ summary: 'إنشاء سند دفع جديد وتوليد القيد وتحديث الأرصدة تلقائياً' })
  async create(@Req() req: any, @Body() dto: CreatePaymentVoucherDto) {
    return this.paymentVouchersService.create(req.user.companyId, req.user.userId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'تعديل سند دفع وتحديث القيد والأرصدة المحاسبية' })
  async update(@Param('id') id: string, @Req() req: any, @Body() dto: any) {
    return this.paymentVouchersService.update(id, req.user.companyId, req.user.userId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'حذف سند دفع مع القيد المحاسبي المرتبط به' })
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.paymentVouchersService.remove(id, req.user.companyId);
  }
}
