import { Controller, Post, Get, Body, Request, UseGuards } from '@nestjs/common';
import { AIAssistantService } from './ai-assistant.service';
import { ChatRequestDto } from './ai-assistant.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('ai-assistant')
export class AIAssistantController {
  constructor(private readonly aiService: AIAssistantService) {}

  @Post('chat')
  async chat(@Body() dto: ChatRequestDto, @Request() req: any) {
    const tenantId = req.user?.tenantId || req.user?.companyId;
    return await this.aiService.processChat(dto, tenantId);
  }

  @Get('financial-brief')
  async getFinancialBrief(@Request() req: any) {
    const tenantId = req.user?.tenantId || req.user?.companyId;
    return await this.aiService.getLiveFinancialContext(tenantId);
  }
}
