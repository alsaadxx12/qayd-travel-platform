import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiRequestContext } from '../types/ai-tool.types';

export type LearnedKind = 'rule' | 'alias' | 'preference' | 'correction';

/**
 * Persistent company memory for the Copilot.
 *
 * This is not model fine-tuning. Live balances still come from tools.
 * What gets stored: naming aliases, operating conventions, and explicit user rules.
 */
@Injectable()
export class LearningService {
  private readonly logger = new Logger(LearningService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listActive(companyId: string, userId?: string) {
    return this.prisma.aiLearnedFact.findMany({
      where: {
        companyId,
        isActive: true,
        OR: userId ? [{ userId: null }, { userId }] : [{ userId: null }],
      },
      orderBy: { updatedAt: 'desc' },
      take: 40,
    });
  }

  async remember(params: {
    ctx: AiRequestContext;
    kind: LearnedKind;
    title: string;
    content: string;
    entityKind?: string;
    entityId?: string;
    source?: string;
    companyWide?: boolean;
  }) {
    const title = (params.title || '').trim().slice(0, 120);
    const content = (params.content || '').trim().slice(0, 500);
    if (!title || !content) {
      return { ok: false as const, message: 'لا يوجد نص كافٍ للحفظ' };
    }

    if (this.looksLikeStaleNumber(content)) {
      return {
        ok: false as const,
        message: 'لا أحفظ أرقامًا مالية متغيرة. أحفظ الأسماء والقواعد وتفضيلات العمل فقط.',
      };
    }

    const existing = await this.prisma.aiLearnedFact.findFirst({
      where: {
        companyId: params.ctx.companyId,
        isActive: true,
        kind: params.kind,
        title,
      },
    });

    const data = {
      tenantId: params.ctx.tenantId,
      companyId: params.ctx.companyId,
      userId: params.companyWide ? null : params.ctx.userId,
      kind: params.kind,
      title,
      content,
      entityKind: params.entityKind,
      entityId: params.entityId,
      source: params.source || 'user',
      isActive: true,
    };

    const row = existing
      ? await this.prisma.aiLearnedFact.update({ where: { id: existing.id }, data })
      : await this.prisma.aiLearnedFact.create({ data });

    return { ok: true as const, fact: row };
  }

  async rememberAlias(ctx: AiRequestContext, label: string, kind: string, id: string, extra?: string) {
    try {
      await this.remember({
        ctx,
        kind: 'alias',
        title: label,
        content: extra || `${kind}:${id}`,
        entityKind: kind,
        entityId: id,
        source: 'auto',
        companyWide: true,
      });
    } catch (err: any) {
      this.logger.warn(`Failed to remember alias: ${err.message}`);
    }
  }

  async forget(companyId: string, idOrTitle: string) {
    const row = await this.prisma.aiLearnedFact.findFirst({
      where: {
        companyId,
        isActive: true,
        OR: [{ id: idOrTitle }, { title: { contains: idOrTitle, mode: 'insensitive' } }],
      },
    });
    if (!row) return { ok: false as const, message: 'لم أجد معلومة محفوظة مطابقة' };
    await this.prisma.aiLearnedFact.update({ where: { id: row.id }, data: { isActive: false } });
    return { ok: true as const, title: row.title };
  }

  async formatForPrompt(companyId: string, userId?: string): Promise<string> {
    const facts = await this.listActive(companyId, userId);
    if (!facts.length) return '';
    const lines = facts.slice(0, 25).map((f, i) => `${i + 1}. [${f.kind}] ${f.title}: ${f.content}`);
    return `ما تعلّمه المستشار عن هذه الشركة (اعتمد عليه لفهم الأسماء والعادات، ولا تستخدمه كأرقام مالية):\n${lines.join('\n')}`;
  }

  private looksLikeStaleNumber(content: string) {
    return /(?:رصيد|مبيعات|أرباح|ارباح|علينا|لنا).{0,20}\d{4,}/.test(content);
  }
}
