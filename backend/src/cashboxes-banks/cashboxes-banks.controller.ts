import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CashboxesBanksService } from './cashboxes-banks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('الصناديق والبنوك (Cashboxes & Banks)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cashboxes-banks')
export class CashboxesBanksController {
  constructor(private readonly service: CashboxesBanksService) {}

  @Get('cashboxes')
  @ApiOperation({ summary: 'قائمة الصناديق وحساباتها المرتبطة' })
  async getCashboxes(@Req() req: any) {
    return this.service.getCashboxes(req.user.companyId);
  }

  @Get('summary')
  @ApiOperation({ summary: 'قائمة موحدة وسريعة للصناديق والبنوك والماستر مع الأرصدة الفعلية' })
  async getSummary(@Req() req: any) {
    return this.service.getSummary(req.user.companyId);
  }

  @Get('banks')
  @ApiOperation({ summary: 'قائمة البنوك وحساباتها البنكية المرتبطة' })
  async getBanks(@Req() req: any) {
    return this.service.getBanks(req.user.companyId);
  }

  @Post('cashboxes')
  @ApiOperation({ summary: 'إضافة صندوق جديد وتوليد الحساب المحاسبي تلقائياً' })
  async createCashbox(@Req() req: any, @Body() data: { code: string; nameAr: string; nameEn?: string }) {
    return this.service.createCashbox(req.user.companyId, data);
  }

  @Post('banks')
  @ApiOperation({ summary: 'إضافة حساب بنكي جديد وتوليد الحساب المحاسبي تلقائياً' })
  async createBank(
    @Req() req: any,
    @Body() data: { code: string; nameAr: string; nameEn?: string; accountNumber?: string; iban?: string },
  ) {
    return this.service.createBank(req.user.companyId, data);
  }

  @Post('settle-voucher')
  @ApiOperation({ summary: 'تحصيل أو إلغاء تحصيل سند مالي وتوريده إلى الصندوق الرئيسي' })
  async settleVoucher(
    @Req() req: any,
    @Body() dto: { voucherId: string; voucherNumber?: string; isSettled: boolean; destinationBoxId?: string },
  ) {
    return this.service.settleVoucher(req.user.companyId, req.user.userId, dto);
  }

  @Post('settle-batch')
  @ApiOperation({ summary: 'تحصيل وتوريد مجموعة وصولات وسندات دفعة واحدة' })
  async settleBatch(
    @Req() req: any,
    @Body() dto: { voucherIds: string[]; sourceBoxId?: string; destinationBoxId?: string },
  ) {
    return this.service.settleBatchVouchers(req.user.companyId, req.user.userId, dto);
  }
}
