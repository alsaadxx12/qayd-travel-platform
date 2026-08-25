import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
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
