import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiPageContext, AiRequestContext, AiMemoryEntry } from '../types/ai-tool.types';
import { nowContextLine } from './baghdad-clock';

export interface BuildContextInput {
  user: any;
  branchHeader?: string;
  page?: AiPageContext;
  locale?: 'ar' | 'en';
  memory?: AiMemoryEntry[];
  ipAddress?: string;
}

@Injectable()
export class ContextBuilderService {
  private readonly logger = new Logger(ContextBuilderService.name);

  constructor(private readonly prisma: PrismaService) {}

  async build(input: BuildContextInput): Promise<AiRequestContext> {
    const user = input.user || {};
    const companyId = user.companyId;

    const [fiscalYear, company] = await Promise.all([
      this.loadFiscalYear(companyId, user.activeFiscalYearId),
      companyId
        ? this.prisma.company
            .findUnique({ where: { id: companyId }, select: { name: true, currency: true } })
            .catch(() => null)
        : Promise.resolve(null),
    ]);

    const rawBranch = (input.branchHeader || '').trim();
    const activeBranchId = rawBranch && rawBranch.toUpperCase() !== 'ALL' ? rawBranch : undefined;

    return {
      userId: user.userId || user.id,
      userName: user.name,
      companyId,
      companyName: company?.name || user.companyName,
      tenantId: user.tenantId,
      role: user.role,
      permissions: Array.isArray(user.permissions) ? user.permissions : [],
      allowedBranchIds: Array.isArray(user.allowedBranchIds) ? user.allowedBranchIds : [],
      canAccessAllBranches: user.canAccessAllBranches === true,
      branchAccessResolved: user.branchAccessResolved === true,
      activeBranchId,
      fiscalYear,
      baseCurrency: company?.currency || 'IQD',
      locale: input.locale || 'ar',
      page: input.page,
      memory: input.memory || [],
      ipAddress: input.ipAddress,
    };
  }

  private async loadFiscalYear(companyId?: string, preferredId?: string) {
    if (!companyId) return null;
    try {
      const year = preferredId
        ? await this.prisma.fiscalYear.findFirst({ where: { id: preferredId, companyId } })
        : await this.prisma.fiscalYear.findFirst({
            where: { companyId, OR: [{ isCurrent: true }, { status: 'OPEN' }] },
            orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }],
          });

      if (!year) return null;
      return {
        id: year.id,
        name: year.name,
        startDate: year.startDate.toISOString().slice(0, 10),
        endDate: year.endDate.toISOString().slice(0, 10),
        status: year.status,
      };
    } catch (err: any) {
      this.logger.warn(`Failed to resolve fiscal year: ${err.message}`);
      return null;
    }
  }

  /** Human-readable context block injected into the system prompt. */
  describe(ctx: AiRequestContext): string {
    const lines: string[] = [];
    lines.push(`المستخدم الحالي: ${ctx.userName || 'غير معروف'} (${ctx.role || 'مستخدم'})`);
    lines.push(`الشركة: ${ctx.companyName || '-'} | العملة الأساسية: ${ctx.baseCurrency}`);
    lines.push(nowContextLine());
    lines.push(
      'لا تقل إن معرفتك تتوقف في يونيو 2024 أو أي تاريخ تدريب. التاريخ أعلاه هو المرجع. بيانات الشركة والأرصدة حيّة من قاعدة البيانات. للأحداث العامة والأسعار العالمية استخدم searchCurrentInfo.',
    );

    if (ctx.fiscalYear) {
      lines.push(
        `السنة المالية النشطة: ${ctx.fiscalYear.name} (${ctx.fiscalYear.startDate} إلى ${ctx.fiscalYear.endDate}) الحالة: ${ctx.fiscalYear.status}`,
      );
    }

    if (ctx.canAccessAllBranches) {
      lines.push('نطاق الفروع: جميع الفروع');
    } else if (ctx.allowedBranchIds.length) {
      lines.push(`نطاق الفروع المسموحة: ${ctx.allowedBranchIds.length} فرع`);
    }

    if (ctx.activeBranchId) {
      lines.push(`الفرع المفتوح حاليًا: ${ctx.activeBranchId}`);
    }

    if (ctx.page?.route) {
      const parts = [`الصفحة المفتوحة: ${ctx.page.route}`];
      if (ctx.page.entity) parts.push(`نوع السجل: ${ctx.page.entity}`);
      if (ctx.page.recordId) parts.push(`معرّف السجل المفتوح: ${ctx.page.recordId}`);
      if (ctx.page.label) parts.push(`اسم السجل: ${ctx.page.label}`);
      lines.push(parts.join(' | '));
      lines.push(
        'إذا استخدم المستخدم إشارة غامضة مثل «هذه العملية» أو «هذا الحساب» فاعتبرها تشير إلى السجل المفتوح أعلاه.',
      );
    }

    if (ctx.memory?.length) {
      const recent = ctx.memory.slice(-6);
      lines.push(
        `كيانات ذُكرت سابقًا في هذه المحادثة: ${recent
          .map((m) => `${m.label} (${m.kind}:${m.id})`)
          .join('، ')}`,
      );
      lines.push('استخدم هذه الكيانات لفهم الأسئلة المتتابعة دون سؤال المستخدم عن الاسم مجددًا.');
    }

    return lines.join('\n');
  }
}
