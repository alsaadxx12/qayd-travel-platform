import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { EmailService, SendEmailDto, SendStatementEmailDto, UpdateSenderConfigDto } from './email.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('email')
@UseGuards(JwtAuthGuard)
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Get('account-info')
  async getAccountInfo() {
    return this.emailService.getAccountInfo();
  }

  @Get('sender-config')
  async getSenderConfig() {
    return this.emailService.getSenderConfig();
  }

  @Post('sender-config')
  async updateSenderConfig(@Body() dto: UpdateSenderConfigDto) {
    return this.emailService.updateSenderConfig(dto);
  }

  @Post('send')
  async sendEmail(@Body() dto: SendEmailDto) {
    return this.emailService.sendEmail(dto);
  }

  @Post('send-statement')
  async sendStatement(@Body() dto: SendStatementEmailDto) {
    return this.emailService.sendStatementEmail(dto);
  }
}
