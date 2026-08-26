import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Request,
  Res,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AIAssistantService } from './ai-assistant.service';
import {
  ChatRequestDto,
  CreateConversationDto,
  MessageFeedbackDto,
  ImportSessionDto,
  SetAiCreditGrantDto,
} from './ai-assistant.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiOrchestratorService } from './core/ai-orchestrator.service';
import { ConversationService } from './core/conversation.service';
import { SystemKnowledgeService } from './core/system-knowledge.service';
import { AiPermissionService } from './core/ai-permission.service';
import { ContextBuilderService } from './core/context-builder.service';
import { AiBillingService } from './core/ai-billing.service';
import { LlmProviderService } from './core/llm-provider.service';
import { StatementArtifactService } from './core/statement-artifact.service';

/** SSE keep-alive interval; must stay well under the client's idle watchdog. */
const HEARTBEAT_MS = 10_000;

@ApiTags('المستشار الذكي (AI Copilot)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai-assistant')
export class AIAssistantController {
  constructor(
    private readonly aiService: AIAssistantService,
    private readonly orchestrator: AiOrchestratorService,
    private readonly conversations: ConversationService,
    private readonly knowledge: SystemKnowledgeService,
    private readonly permissions: AiPermissionService,
    private readonly contextBuilder: ContextBuilderService,
    private readonly billing: AiBillingService,
    private readonly llm: LlmProviderService,
    private readonly statementArtifacts: StatementArtifactService,
  ) {}

  @Post('chat')
  @ApiOperation({ summary: 'محادثة المستشار الذكي (غير متدفقة — عقد متوافق)' })
  async chat(@Body() dto: ChatRequestDto, @Request() req: any) {
    const result = await this.orchestrator.runToCompletion({
      dto,
      user: req.user,
      branchHeader: req.headers['x-branch-id'],
      ipAddress: req.ip,
    });
    const tenantId = req.user?.tenantId || req.user?.companyId;
    const financialContext = await this.aiService.getLiveFinancialContext(tenantId);
    return {
      reply: result.reply,
      financialContext,
      modelUsed: result.model,
      conversationId: result.conversationId,
      messageId: result.messageId,
      uiBlocks: result.uiBlocks,
      suggestions: result.suggestions,
      toolsUsed: result.toolsUsed,
    };
  }

  @Post('chat/stream')
  @ApiOperation({ summary: 'محادثة المستشار الذكي عبر SSE' })
  async chatStream(@Body() dto: ChatRequestDto, @Request() req: any, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    // A long tool run must not be cut by the default socket timeout.
    if (typeof (res as any).setTimeout === 'function') (res as any).setTimeout(0);
    if (typeof req?.socket?.setTimeout === 'function') req.socket.setTimeout(0);
    if (typeof (res as any).flushHeaders === 'function') (res as any).flushHeaders();

    let closed = false;
    req.on('close', () => {
      closed = true;
    });

    const write = (event: any) => {
      if (closed || res.writableEnded) return;
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      if (typeof (res as any).flush === 'function') (res as any).flush();
    };

    // Keep-alive comment frames stop proxies (and the browser) from treating a
    // slow tool as a dead connection. SSE ignores lines starting with ':'.
    const heartbeat = setInterval(() => {
      if (closed || res.writableEnded) return;
      res.write(': ping\n\n');
      if (typeof (res as any).flush === 'function') (res as any).flush();
    }, HEARTBEAT_MS);

    write({ type: 'status', message: 'متصل' });

    let finished = false;
    try {
      for await (const event of this.orchestrator.run({
        dto,
        user: req.user,
        branchHeader: req.headers['x-branch-id'],
        ipAddress: req.ip,
      })) {
        if (closed) break;
        if (event.type === 'done' || event.type === 'error') finished = true;
        write(event);
      }
      // The client waits for a terminal frame; never leave the stream open-ended.
      if (!finished && !closed) {
        write({
          type: 'error',
          message: 'انتهت الجلسة دون إكمال الرد. أعد إرسال الطلب.',
        });
      }
    } catch (err: any) {
      write({ type: 'error', message: err?.message || 'فشل المستشار الذكي' });
    } finally {
      clearInterval(heartbeat);
      if (!res.writableEnded) res.end();
    }
  }

  @Get('statement-pdf/:artifactId')
  @ApiOperation({ summary: 'تنزيل كشف حساب PDF الذي ولّده المستشار الذكي' })
  async downloadStatementPdf(
    @Param('artifactId') artifactId: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const item = this.statementArtifacts.getOwned(
      artifactId,
      req.user.companyId,
      req.user.userId || req.user.id,
    );
    const encoded = encodeURIComponent(item.filename);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="statement.pdf"; filename*=UTF-8''${encoded}`);
    res.setHeader('Content-Length', item.buffer.length.toString());
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(item.buffer);
  }

  @Get('ping')
  @ApiOperation({ summary: 'فحص جاهزية المستشار الذكي' })
  ping() {
    return { ok: true, ts: Date.now() };
  }

  @Get('billing')
  @ApiOperation({ summary: 'رصيد وكيل الذكاء (OpenAI) المتوفر والمتبقي' })
  async getBilling(@Query('live') live?: string) {
    const snapshot = await this.billing.getSnapshot(live === '1' || live === 'true');
    if (snapshot.connected) this.llm.clearHold('openai');
    return snapshot;
  }

  @Post('billing/grant')
  @ApiOperation({ summary: 'تعيين الرصيد المتوفر لوكيل الذكاء بعد الشحن' })
  async setBillingGrant(@Body() dto: SetAiCreditGrantDto) {
    return this.billing.setGrantUsd(dto.grantUsd);
  }

  @Get('financial-brief')
  @ApiOperation({ summary: 'ملخص مالي حي لأسعار الصرف والباقة الحالية' })
  async getFinancialBrief(@Request() req: any) {
    const tenantId = req.user?.tenantId || req.user?.companyId;
    return await this.aiService.getLiveFinancialContext(tenantId);
  }

  @Get('quick-prompts')
  @ApiOperation({ summary: 'اقتراحات البداية حسب صلاحيات المستخدم' })
  async quickPrompts(@Request() req: any) {
    const ctx = await this.contextBuilder.build({ user: req.user, branchHeader: req.headers['x-branch-id'] });
    return this.knowledge.getQuickPrompts((code) => this.permissions.hasPermission(ctx, code));
  }

  @Get('conversations')
  @ApiOperation({ summary: 'قائمة محادثات المستخدم' })
  async listConversations(@Request() req: any) {
    return this.conversations.list(req.user.companyId, req.user.userId);
  }

  @Post('conversations')
  @ApiOperation({ summary: 'إنشاء محادثة جديدة' })
  async createConversation(@Body() dto: CreateConversationDto, @Request() req: any) {
    return this.conversations.create({
      companyId: req.user.companyId,
      userId: req.user.userId,
      tenantId: req.user.tenantId,
      title: dto.title,
    });
  }

  @Post('conversations/import')
  @ApiOperation({ summary: 'استيراد جلسة محادثة من المتصفح' })
  async importConversation(@Body() dto: ImportSessionDto, @Request() req: any) {
    const conv = await this.conversations.create({
      companyId: req.user.companyId,
      userId: req.user.userId,
      tenantId: req.user.tenantId,
      title: dto.title || 'محادثة مستوردة',
    });
    for (const m of dto.messages || []) {
      if (!m.content && !m.imageBase64) continue;
      await this.conversations.addMessage({
        conversationId: conv.id,
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content || '',
        imageBase64: m.imageBase64,
      });
    }
    return conv;
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'تفاصيل محادثة مع الرسائل' })
  async getConversation(@Param('id') id: string, @Request() req: any) {
    const conv = await this.conversations.getOwned(id, req.user.companyId, req.user.userId);
    return {
      ...conv,
      messages: conv.messages.map((m) => ({
        ...m,
        toolCalls: m.toolCalls ? JSON.parse(m.toolCalls) : null,
        uiBlocks: m.uiBlocks ? JSON.parse(m.uiBlocks) : null,
        imageBase64: undefined,
      })),
    };
  }

  @Delete('conversations/:id')
  @ApiOperation({ summary: 'حذف محادثة' })
  async deleteConversation(@Param('id') id: string, @Request() req: any) {
    return this.conversations.softDelete(id, req.user.companyId, req.user.userId);
  }

  @Post('messages/:id/feedback')
  @ApiOperation({ summary: 'تقييم إجابة المستشار' })
  async feedback(@Param('id') id: string, @Body() dto: MessageFeedbackDto, @Request() req: any) {
    return this.conversations.setFeedback(id, req.user.companyId, req.user.userId, dto.feedback);
  }
}
