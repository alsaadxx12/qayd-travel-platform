import { Body, Controller, ForbiddenException, Get, Headers, HttpCode, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SaveWhatsAppSettingsDto, SendStatementDto, SendTestDto, SendTextDto, WhatsAppService } from './whatsapp.service';

@ApiTags('whatsapp')
@Controller('whatsapp')
@UseGuards(JwtAuthGuard)
export class WhatsAppController {
  constructor(private readonly svc: WhatsAppService) {}

  @Get('settings')
  @ApiOperation({ summary: 'إعدادات ربط واتساب السحابي (الأسرار مقنَّعة)' })
  getSettings(@Req() req: any) {
    return this.svc.getSettings(req.user.companyId);
  }

  @Post('settings')
  @ApiOperation({ summary: 'حفظ بيانات الربط من حساب Meta' })
  saveSettings(@Req() req: any, @Body() dto: SaveWhatsAppSettingsDto) {
    return this.svc.saveSettings(req.user.companyId, dto);
  }

  @Get('status')
  @ApiOperation({ summary: 'حالة الرقم والحساب من Meta مباشرة' })
  getStatus(@Req() req: any) {
    return this.svc.getStatus(req.user.companyId);
  }

  @Post('test')
  @ApiOperation({ summary: 'إرسال رسالة تجريبية (قالب hello_world أو نص)' })
  sendTest(@Req() req: any, @Body() dto: SendTestDto) {
    return this.svc.sendTest(req.user.companyId, dto);
  }

  @Post('send')
  @ApiOperation({ summary: 'إرسال نصّ حر (داخل نافذة 24 ساعة)' })
  sendText(@Req() req: any, @Body() dto: SendTextDto) {
    return this.svc.sendPlainText(req.user.companyId, dto);
  }

  @Post('send-statement')
  @ApiOperation({ summary: 'إرسال كشف حساب PDF (أو ملخّصه نصاً) إلى رقم العميل' })
  sendStatement(@Req() req: any, @Body() dto: SendStatementDto) {
    return this.svc.sendStatement(req.user.companyId, dto);
  }
}

/**
 * نقطة الـWebhook عامة بلا حارس: Meta هي من تناديها. التحقق الأول بكلمة التحقق،
 * والأحداث اللاحقة بتوقيع سرّ التطبيق.
 */
@ApiTags('whatsapp')
@Controller('whatsapp/webhook')
export class WhatsAppWebhookController {
  constructor(private readonly svc: WhatsAppService) {}

  @Get()
  async verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const ok = await this.svc.verifyWebhook(mode, token, challenge);
    if (ok === null) throw new ForbiddenException('كلمة التحقق لا تطابق أي شركة.');
    return ok;
  }

  @Post()
  @HttpCode(200)
  receive(@Req() req: RawBodyRequest<any>, @Body() body: any, @Headers('x-hub-signature-256') signature?: string) {
    return this.svc.handleWebhook(body, req.rawBody, signature);
  }
}
