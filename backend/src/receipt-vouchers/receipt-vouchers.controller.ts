import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReceiptVouchersService, CreateReceiptVoucherDto } from './receipt-vouchers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('سندات القبض (Receipt Vouchers)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('receipt-vouchers')
export class ReceiptVouchersController {
  constructor(private readonly receiptVouchersService: ReceiptVouchersService) {}

  @Get()
  @ApiOperation({ summary: 'قائمة سندات القبض' })
  async findAll(@Req() req: any) {
    return this.receiptVouchersService.findAll(req.user.companyId);
  }

  // Declared before ':id' so the literal path is not captured as a voucher id.
  @Get('split-backfill')
  @ApiOperation({
    summary:
      'فحص السندات القديمة التي يحمل بيانها تقسيماً لم يُرحَّل إلى القيد. تقرير فقط ما لم يُمرَّر apply=1',
  })
  async backfillSplits(@Req() req: any, @Query('apply') apply?: string) {
    return this.receiptVouchersService.backfillLegacySplits(
      req.user.companyId,
      apply === '1' || apply === 'true',
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'تفاصيل سند قبض محدد مع القيد المرتبط' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.receiptVouchersService.findOne(id, req.user.companyId);
  }

  @Post()
  @ApiOperation({ summary: 'إنشاء سند قبض جديد وتوليد القيد وتحديث رصيد الصندوق/العميل تلقائياً' })
  async create(@Req() req: any, @Body() dto: CreateReceiptVoucherDto) {
    return this.receiptVouchersService.create(req.user.companyId, req.user.userId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'تعديل سند قبض وتحديث القيد والأرصدة المحاسبية' })
  async update(@Param('id') id: string, @Req() req: any, @Body() dto: any) {
    return this.receiptVouchersService.update(id, req.user.companyId, req.user.userId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'حذف سند قبض مع القيد المحاسبي المرتبط به' })
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.receiptVouchersService.remove(id, req.user.companyId);
  }
}
