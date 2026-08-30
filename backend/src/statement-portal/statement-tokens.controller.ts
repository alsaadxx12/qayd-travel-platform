import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StatementPortalService } from './statement-portal.service';
import { StatementQrService } from './statement-qr.service';

/** The staff side: issuing, listing and revoking customer barcodes. Guarded normally. */
@ApiTags('باركود كشف الحساب (Statement QR)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('statement-tokens')
export class StatementTokensController {
  constructor(
    private readonly portal: StatementPortalService,
    private readonly qr: StatementQrService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'الباركودات الفعّالة في الشركة مع عدد مرات الاطلاع' })
  async list(@Req() req: any) {
    return this.portal.list(req.user.companyId);
  }

  /**
   * The barcode picture for one account, for printing onto a receipt.
   *
   * Declared before any ':id' route would be, and it never issues — it returns null for
   * an account with no barcode, so printing a voucher cannot create access to a
   * statement as a side effect.
   */
  @Get('qr')
  @ApiOperation({ summary: 'صورة باركود حساب معيّن للطباعة على الوصل. تعيد null إن لم يُصدر بعد.' })
  async qrForAccount(
    @Req() req: any,
    @Query('accountId') accountId?: string,
    @Query('accountCode') accountCode?: string,
  ) {
    const qrDataUrl = await this.qr.forAccount(req.user.companyId, accountId, accountCode);
    return { qrDataUrl };
  }

  @Post()
  @ApiOperation({
    summary:
      'إصدار باركود لعميل أو مورد. يعيد الباركود القائم إن وُجد، إلا مع regenerate=true فيُبطل القديم.',
  })
  async issue(
    @Req() req: any,
    @Body() body: { customerId?: string; supplierId?: string; regenerate?: boolean; label?: string },
  ) {
    return this.portal.issue(req.user.companyId, req.user.userId, body || {});
  }

  @Delete(':id')
  @ApiOperation({ summary: 'إبطال الباركود فوراً — كل ورقة تحمله تتوقف عن العمل' })
  async revoke(@Param('id') id: string, @Req() req: any) {
    return this.portal.revoke(id, req.user.companyId, req.user.userId);
  }
}
