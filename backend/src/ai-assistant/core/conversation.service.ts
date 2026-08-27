import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiUiBlock } from '../types/ai-tool.types';

@Injectable()
export class ConversationService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, userId: string) {
    return this.prisma.aiConversation.findMany({
      where: { companyId, userId, isDeleted: false },
      orderBy: { lastMessageAt: 'desc' },
      take: 80,
      select: {
        id: true,
        title: true,
        lastMessageAt: true,
        createdAt: true,
        isPinned: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, role: true },
        },
      },
    });
  }

  async create(params: { companyId: string; userId: string; tenantId?: string; title?: string }) {
    return this.prisma.aiConversation.create({
      data: {
        companyId: params.companyId,
        userId: params.userId,
        tenantId: params.tenantId,
        title: params.title || 'محادثة جديدة',
      },
    });
  }

  async getOwnedMeta(id: string, companyId: string, userId: string) {
    const conv = await this.prisma.aiConversation.findFirst({
      where: { id, companyId, userId, isDeleted: false },
      select: { id: true, title: true, companyId: true, userId: true, tenantId: true },
    });
    if (!conv) throw new NotFoundException('المحادثة غير موجودة');
    return conv;
  }

  async getOwned(id: string, companyId: string, userId: string) {
    const conv = await this.prisma.aiConversation.findFirst({
      where: { id, companyId, userId, isDeleted: false },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conv) throw new NotFoundException('المحادثة غير موجودة');
    return conv;
  }

  async softDelete(id: string, companyId: string, userId: string) {
    await this.getOwned(id, companyId, userId);
    await this.prisma.aiConversation.update({
      where: { id },
      data: { isDeleted: true },
    });
    return { ok: true };
  }

  async addMessage(params: {
    conversationId: string;
    role: 'user' | 'assistant' | 'tool';
    content: string;
    toolCalls?: any;
    uiBlocks?: AiUiBlock[];
    imageBase64?: string;
    model?: string;
    latencyMs?: number;
  }) {
    const message = await this.prisma.aiMessage.create({
      data: {
        conversationId: params.conversationId,
        role: params.role,
        content: params.content || '',
        toolCalls: params.toolCalls ? JSON.stringify(params.toolCalls) : null,
        uiBlocks: params.uiBlocks ? JSON.stringify(params.uiBlocks) : null,
        imageBase64: params.imageBase64,
        model: params.model,
        latencyMs: params.latencyMs,
      },
    });

    await this.prisma.aiConversation.update({
      where: { id: params.conversationId },
      data: { lastMessageAt: new Date() },
    });

    return message;
  }

  /**
   * A one-line memory of what this user has been working on lately, injected into
   * the prompt so a brand-new chat does not start as a blank slate.
   */
  async recentTopics(companyId: string, userId: string, take = 5): Promise<string> {
    const rows = await this.prisma.aiConversation.findMany({
      where: { companyId, userId, isDeleted: false, title: { not: 'محادثة جديدة' } },
      orderBy: { lastMessageAt: 'desc' },
      take,
      select: { title: true, lastMessageAt: true },
    });
    if (!rows.length) return '';
    const list = rows
      .map((r) => {
        const when = r.lastMessageAt ? new Date(r.lastMessageAt).toLocaleDateString('en-GB') : '';
        return `- ${r.title}${when ? ` (${when})` : ''}`;
      })
      .join('\n');
    return `مواضيع حچينا بيها مؤخراً مع نفس المستخدم (للسياق فقط — لا تفترض أرقاماً منها، واستخدم recallConversations إذا احتجت التفاصيل):\n${list}`;
  }

  /** How many questions the user has asked in this conversation so far. */
  async countUserMessages(conversationId: string): Promise<number> {
    return this.prisma.aiMessage.count({
      where: { conversationId, role: 'user' },
    });
  }

  async setTitleIfDefault(conversationId: string, firstUserText: string) {
    const conv = await this.prisma.aiConversation.findUnique({ where: { id: conversationId } });
    if (!conv || (conv.title && conv.title !== 'محادثة جديدة')) return;
    const title = (firstUserText || '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'محادثة جديدة';
    await this.prisma.aiConversation.update({
      where: { id: conversationId },
      data: { title },
    });
  }

  async setFeedback(messageId: string, companyId: string, userId: string, feedback: 'up' | 'down') {
    const message = await this.prisma.aiMessage.findFirst({
      where: { id: messageId, conversation: { companyId, userId } },
    });
    if (!message) throw new NotFoundException('الرسالة غير موجودة');
    return this.prisma.aiMessage.update({
      where: { id: messageId },
      data: { feedback },
    });
  }
}
