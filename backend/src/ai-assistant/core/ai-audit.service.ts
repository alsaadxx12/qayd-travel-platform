import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiRequestContext } from '../types/ai-tool.types';

@Injectable()
export class AiAuditService {
  private readonly logger = new Logger(AiAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logTool(params: {
    ctx: AiRequestContext;
    conversationId?: string;
    question: string;
    toolName: string;
    toolArgs: any;
    resultSummary?: string;
    mutatedData?: boolean;
    status: 'ok' | 'denied' | 'error';
    durationMs?: number;
  }) {
    try {
      await this.prisma.aiActionLog.create({
        data: {
          tenantId: params.ctx.tenantId,
          companyId: params.ctx.companyId,
          userId: params.ctx.userId,
          conversationId: params.conversationId,
          question: (params.question || '').slice(0, 2000),
          toolName: params.toolName,
          toolArgs: JSON.stringify(params.toolArgs || {}).slice(0, 4000),
          resultSummary: (params.resultSummary || '').slice(0, 2000),
          mutatedData: params.mutatedData === true,
          status: params.status,
          durationMs: params.durationMs,
          ipAddress: params.ctx.ipAddress,
        },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to write AI action log: ${err.message}`);
    }
  }
}
