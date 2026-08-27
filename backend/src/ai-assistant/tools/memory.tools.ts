import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiRequestContext, AiTool, AiToolResult, AiToolProvider } from '../types/ai-tool.types';

const MAX_SNIPPET = 220;

/**
 * Lets the assistant look back at what it and this user already discussed.
 *
 * Conversations were being stored from day one but were reachable only by the user
 * scrolling the history panel — the assistant itself could not see a single word of
 * them. Every new chat started from zero, so the same context had to be re-explained.
 */
@Injectable()
export class MemoryTools implements AiToolProvider {
  constructor(private readonly prisma: PrismaService) {}

  getTools(): AiTool[] {
    return [
      {
        name: 'recallConversations',
        description:
          'ابحث في محادثاتك السابقة مع هذا المستخدم وتذكّر ما دار بينكما. ' +
          'استخدمها عندما يقول: «شنو حچينا عن…»، «تتذكر…»، «قلتلك قبل»، «المرة الماضية»، «شنو اتفقنا»، أو عندما يشير إلى شيء سابق بلا تفاصيل. ' +
          'اتركها بلا كلمة بحث لتعرض آخر المواضيع. Search the assistant\'s own past conversations with this user.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'كلمة أو اسم للبحث عنه في المحادثات السابقة' },
            limit: { type: 'number', description: 'عدد النتائج (افتراضي 8)' },
          },
          additionalProperties: false,
        },
        requiredPermissions: [],
        sensitivity: 'read',
        handler: (args, ctx) => this.recall(args, ctx),
      },
    ];
  }

  private async recall(args: any, ctx: AiRequestContext): Promise<AiToolResult> {
    const query = String(args?.query || '').trim();
    const take = Math.max(1, Math.min(Number(args?.limit) || 8, 20));

    // AiMessage carries no companyId of its own — it is isolated through its
    // conversation. Scoping by user as well keeps one employee's chats private.
    const owner = {
      conversation: { companyId: ctx.companyId, userId: ctx.userId, isDeleted: false },
    };

    if (!query) {
      const conversations = await this.prisma.aiConversation.findMany({
        where: { companyId: ctx.companyId, userId: ctx.userId, isDeleted: false },
        orderBy: { lastMessageAt: 'desc' },
        take,
        select: { id: true, title: true, lastMessageAt: true },
      });
      if (!conversations.length) {
        return { ok: false, data: { found: false, message: 'ما عدنا محادثات سابقة بعد.' }, note: 'لا توجد محادثات سابقة.' };
      }
      return {
        ok: true,
        data: {
          found: true,
          count: conversations.length,
          conversations: conversations.map((c) => ({
            title: c.title,
            when: c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleDateString('en-GB') : null,
          })),
        },
        ui: [
          {
            type: 'table',
            payload: {
              title: 'آخر المواضيع اللي حچينا بيها',
              columns: [
                { key: 'title', label: 'الموضوع' },
                { key: 'when', label: 'التاريخ' },
              ],
              rows: conversations.map((c) => ({
                title: c.title || 'محادثة',
                when: c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleDateString('en-GB') : '—',
              })),
            },
          },
        ],
        note: `عدنا ${conversations.length} موضوع سابق.`,
      };
    }

    const messages = await this.prisma.aiMessage.findMany({
      where: {
        ...owner,
        content: { contains: query, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        role: true,
        content: true,
        createdAt: true,
        conversation: { select: { title: true } },
      },
    });

    if (!messages.length) {
      return {
        ok: false,
        data: { found: false, query, message: `ما لكيت «${query}» بأي محادثة سابقة وياك.` },
        note: `ما لكيت «${query}» بالمحادثات السابقة.`,
      };
    }

    const rows = messages.map((m) => ({
      who: m.role === 'user' ? 'إنت' : 'آني',
      topic: m.conversation?.title || 'محادثة',
      said: (m.content || '').replace(/\s+/g, ' ').trim().slice(0, MAX_SNIPPET),
      when: new Date(m.createdAt).toLocaleDateString('en-GB'),
    }));

    return {
      ok: true,
      data: { found: true, query, count: rows.length, matches: rows },
      ui: [
        {
          type: 'table',
          payload: {
            title: `شنو حچينا عن «${query}»`,
            columns: [
              { key: 'when', label: 'التاريخ' },
              { key: 'who', label: 'مين' },
              { key: 'said', label: 'النص' },
            ],
            rows,
          },
        },
      ],
      note: `لكيت ${rows.length} إشارة لـ «${query}» بمحادثاتنا السابقة.`,
    };
  }
}
