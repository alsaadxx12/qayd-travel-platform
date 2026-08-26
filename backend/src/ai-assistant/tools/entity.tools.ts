import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiRequestContext, AiTool, AiToolResult, AiToolProvider } from '../types/ai-tool.types';
import { capForModel, looseMatch, normalizeArabic } from './tool-utils';

type EntityKind = 'account' | 'customer' | 'supplier' | 'airline' | 'employee' | 'branch' | 'passenger';

interface EntityHit {
  kind: EntityKind;
  id: string;
  label: string;
  code?: string | null;
  accountId?: string | null;
  extra?: Record<string, any>;
}

const KIND_LABELS: Record<EntityKind, string> = {
  account: 'حساب',
  customer: 'عميل',
  supplier: 'مورد',
  airline: 'شركة طيران',
  employee: 'موظف',
  branch: 'فرع',
  passenger: 'مسافر',
};

/**
 * Resolves a free-text name into a concrete system entity.
 *
 * A name like "علي السعدي" could be a customer, a supplier, an employee or a
 * GL account, so nothing is assumed: every entity type is searched and the model
 * is told to ask the user when more than one plausible match comes back.
 */
@Injectable()
export class EntityTools implements AiToolProvider {
  constructor(private readonly prisma: PrismaService) {}

  getTools(): AiTool[] {
    return [
      {
        name: 'searchEntity',
        description:
          'ابحث عن أي كيان في النظام بالاسم أو الرمز (عميل، مورد، شركة، شركة طيران، موظف، فرع، حساب محاسبي، مسافر). استخدمها أولًا كلما ذكر المستخدم اسم شخص أو شركة، بما في ذلك «من هو» و«سلف» و«رصيد فلان». الاسم الدقيق searchEntity وليس searchPartners. Search any system entity by name or code before calling tools that need an id.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'الاسم أو الرمز المراد البحث عنه' },
            kinds: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['account', 'customer', 'supplier', 'airline', 'employee', 'branch', 'passenger'],
              },
              description: 'حصر البحث بأنواع معينة. اتركها فارغة للبحث في كل الأنواع.',
            },
          },
          required: ['query'],
          additionalProperties: false,
        },
        requiredPermissions: [],
        sensitivity: 'read',
        handler: (args, ctx) => this.searchEntity(args, ctx),
      },
      {
        name: 'listBranches',
        description: 'اعرض فروع الشركة المتاحة للمستخدم مع معرّفاتها. List branches the user may access.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
        requiredPermissions: [],
        sensitivity: 'read',
        handler: (_args, ctx) => this.listBranches(ctx),
      },
    ];
  }

  async lookup(query: string, ctx: AiRequestContext, kinds?: EntityKind[]): Promise<AiToolResult> {
    return this.searchEntity({ query, kinds }, ctx);
  }

  private async searchEntity(args: any, ctx: AiRequestContext): Promise<AiToolResult> {
    const query = (args.query || args.name || args.q || '').trim();
    if (!query) {
      return { ok: false, data: { found: false, message: 'لم يتم تحديد نص للبحث' } };
    }

    const kinds: EntityKind[] = Array.isArray(args.kinds) && args.kinds.length
      ? args.kinds
      : ['account', 'customer', 'supplier', 'airline', 'employee', 'branch', 'passenger'];

    const hits: EntityHit[] = [];
    const contains = { contains: query, mode: 'insensitive' as const };

    await Promise.all([
      kinds.includes('customer') ? this.findCustomers(ctx, contains, hits) : null,
      kinds.includes('supplier') ? this.findSuppliers(ctx, contains, hits) : null,
      kinds.includes('account') ? this.findAccounts(ctx, contains, hits) : null,
      kinds.includes('airline') ? this.findAirlines(ctx, contains, hits) : null,
      kinds.includes('employee') ? this.findEmployees(ctx, contains, hits) : null,
      kinds.includes('branch') ? this.findBranches(ctx, contains, hits) : null,
      kinds.includes('passenger') ? this.findPassengers(ctx, contains, hits) : null,
    ]);

    // Prisma `contains` misses Arabic spelling variants, so widen with a normalised pass.
    const scored = hits
      .map((h) => ({
        hit: h,
        score: this.score(h, query),
      }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);

    const uniqueByKindId: EntityHit[] = [];
    const seen = new Set<string>();
    for (const s of scored) {
      const key = `${s.hit.kind}:${s.hit.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      uniqueByKindId.push(s.hit);
    }

    const deduped = this.collapseLinkedHits(uniqueByKindId);

    if (!deduped.length) {
      return {
        ok: false,
        data: { found: false, query, message: `لم أجد أي كيان مطابق لـ "${query}"` },
        note: 'لا نتائج',
      };
    }

    const capped = capForModel(deduped, 12);

    if (deduped.length === 1) {
      const match = deduped[0];
      return {
        ok: true,
        data: { found: true, exact: true, match },
        ui: [
          {
            type: 'entity_card',
            payload: {
              id: match.id,
              kind: match.kind,
              kindLabel: KIND_LABELS[match.kind],
              label: match.label,
              accountId: match.accountId,
              phone: match.extra?.phone,
            },
          },
        ],
        suggestions: ['كشف PDF', 'أرسل الكشف بالإيميل', 'رصيده', 'كشف الحساب'],
        note: `تم العثور على «${match.label}»`,
      };
    }

    return {
      ok: true,
      data: {
        found: true,
        exact: false,
        count: deduped.length,
        matches: capped.rows.map((h) => ({
          id: h.id,
          kind: h.kind,
          label: h.label,
          accountId: h.accountId,
        })),
        instruction:
          'لا تبحث من جديد. اطلب من المستخدم اختيار صف واحد فقط، ثم اسأله ماذا يريد بخصوص هذا الاختيار.',
      },
      ui: [
        {
          type: 'disambiguation',
          payload: {
            query,
            options: capped.rows.map((h) => ({
              id: h.id,
              kind: h.kind,
              kindLabel: KIND_LABELS[h.kind],
              label: h.label,
              accountId: h.accountId,
              subtitle: h.extra?.phone || undefined,
            })),
          },
        },
      ],
      suggestions: ['كشف PDF', 'أرسل الكشف بالإيميل'],
      note: `${deduped.length} نتيجة مطابقة`,
    };
  }

  private score(hit: EntityHit, query: string): number {
    const label = normalizeArabic(hit.label);
    const q = normalizeArabic(query);
    if (!q) return 0;
    if (label === q) return 100;
    if (hit.code && normalizeArabic(hit.code) === q) return 95;
    if (label.startsWith(q)) return 80;
    if (label.includes(q)) return 60;
    if (looseMatch(hit.label, query)) return 40;
    return 0;
  }

  /**
   * A customer/supplier and its GL account are one financial identity.
   * Asking the user to pick «عميل» vs «حساب» for the same code is noise.
   */
  private collapseLinkedHits(hits: EntityHit[]): EntityHit[] {
    const rank: Record<EntityKind, number> = {
      customer: 1,
      supplier: 2,
      employee: 3,
      airline: 4,
      account: 5,
      branch: 6,
      passenger: 7,
    };

    const groups: EntityHit[][] = [];
    const assigned = new Set<string>();

    const sameLedger = (a: EntityHit, b: EntityHit) => {
      if (a.kind === 'account' && b.accountId && b.accountId === a.id) return true;
      if (b.kind === 'account' && a.accountId && a.accountId === b.id) return true;
      if (a.accountId && b.accountId && a.accountId === b.accountId) return true;
      if (
        a.code &&
        b.code &&
        normalizeArabic(a.code) === normalizeArabic(b.code) &&
        (a.kind === 'account' || b.kind === 'account') &&
        ['customer', 'supplier', 'employee', 'account'].includes(a.kind) &&
        ['customer', 'supplier', 'employee', 'account'].includes(b.kind)
      ) {
        return true;
      }
      return false;
    };

    for (const hit of hits) {
      const key = `${hit.kind}:${hit.id}`;
      if (assigned.has(key)) continue;
      const group = [hit];
      assigned.add(key);
      for (const other of hits) {
        const otherKey = `${other.kind}:${other.id}`;
        if (assigned.has(otherKey)) continue;
        if (group.some((g) => sameLedger(g, other))) {
          group.push(other);
          assigned.add(otherKey);
        }
      }
      groups.push(group);
    }

    return groups.map((group) => {
      const ordered = [...group].sort((a, b) => rank[a.kind] - rank[b.kind]);
      const primary: EntityHit = { ...ordered[0], extra: { ...(ordered[0].extra || {}) } };
      const account = group.find((h) => h.kind === 'account');
      if (account) {
        primary.accountId = account.id;
        primary.code = primary.code || account.code;
      } else if (!primary.accountId) {
        const withAcct = group.find((h) => h.accountId);
        if (withAcct) primary.accountId = withAcct.accountId;
      }
      primary.extra = {
        ...primary.extra,
        linkedKinds: [...new Set(group.map((h) => h.kind))],
      };
      return primary;
    });
  }

  private async findCustomers(ctx: AiRequestContext, contains: any, out: EntityHit[]) {
    const rows = await this.prisma.customer.findMany({
      where: {
        companyId: ctx.companyId,
        isActive: true,
        OR: [{ nameAr: contains }, { nameEn: contains }, { code: contains }, { phone: contains }],
      },
      select: { id: true, code: true, nameAr: true, nameEn: true, accountId: true, phone: true, email: true },
      take: 20,
    });
    for (const r of rows) {
      out.push({
        kind: 'customer',
        id: r.id,
        label: r.nameAr || r.nameEn || r.code,
        code: r.code,
        accountId: r.accountId,
        extra: { phone: r.phone, email: r.email },
      });
    }
  }

  private async findSuppliers(ctx: AiRequestContext, contains: any, out: EntityHit[]) {
    const rows = await this.prisma.supplier.findMany({
      where: {
        companyId: ctx.companyId,
        isActive: true,
        OR: [{ nameAr: contains }, { nameEn: contains }, { code: contains }, { phone: contains }],
      },
      select: { id: true, code: true, nameAr: true, nameEn: true, accountId: true, isAirline: true, phone: true, email: true },
      take: 20,
    });
    for (const r of rows) {
      out.push({
        kind: 'supplier',
        id: r.id,
        label: r.nameAr || r.nameEn || r.code,
        code: r.code,
        accountId: r.accountId,
        extra: { isAirline: r.isAirline, phone: r.phone, email: r.email },
      });
    }
  }

  private async findAccounts(ctx: AiRequestContext, contains: any, out: EntityHit[]) {
    const rows = await this.prisma.account.findMany({
      where: {
        companyId: ctx.companyId,
        OR: [{ nameAr: contains }, { nameEn: contains }, { code: contains }],
      },
      select: {
        id: true,
        code: true,
        nameAr: true,
        nameEn: true,
        type: true,
        category: true,
        isParent: true,
        currency: true,
      },
      take: 25,
    });
    for (const r of rows) {
      out.push({
        kind: 'account',
        id: r.id,
        label: r.nameAr || r.nameEn || r.code,
        code: r.code,
        accountId: r.id,
        extra: { type: r.type, category: r.category, isParent: r.isParent, currency: r.currency },
      });
    }
  }

  private async findAirlines(ctx: AiRequestContext, contains: any, out: EntityHit[]) {
    const rows = await this.prisma.airline.findMany({
      where: {
        companyId: ctx.companyId,
        OR: [{ nameAr: contains }, { nameEn: contains }, { code: contains }],
      },
      select: { id: true, code: true, nameAr: true, nameEn: true },
      take: 15,
    });
    for (const r of rows) {
      out.push({ kind: 'airline', id: r.id, label: r.nameAr || r.nameEn || r.code || '', code: r.code });
    }
  }

  private async findEmployees(ctx: AiRequestContext, contains: any, out: EntityHit[]) {
    const rows = await this.prisma.employee.findMany({
      where: {
        companyId: ctx.companyId,
        OR: [{ fullName: contains }, { username: contains }, { phone: contains }],
      },
      select: {
        id: true,
        fullName: true,
        jobTitle: true,
        branchId: true,
        branchName: true,
        departmentName: true,
      },
      take: 15,
    });
    for (const r of rows) {
      out.push({
        kind: 'employee',
        id: r.id,
        label: r.fullName,
        extra: { jobTitle: r.jobTitle, branchId: r.branchId, branchName: r.branchName, department: r.departmentName },
      });
    }
  }

  private async findBranches(ctx: AiRequestContext, contains: any, out: EntityHit[]) {
    const rows = await this.prisma.branch.findMany({
      where: {
        companyId: ctx.companyId,
        OR: [{ nameAr: contains }, { nameEn: contains }, { code: contains }, { city: contains }],
      },
      select: { id: true, code: true, nameAr: true, nameEn: true, city: true, isMain: true },
      take: 15,
    });
    for (const r of rows) {
      if (!ctx.canAccessAllBranches && ctx.branchAccessResolved && !ctx.allowedBranchIds.includes(r.id)) {
        continue;
      }
      out.push({
        kind: 'branch',
        id: r.id,
        label: r.nameAr || r.nameEn || r.code,
        code: r.code,
        extra: { city: r.city, isMain: r.isMain },
      });
    }
  }

  private async findPassengers(ctx: AiRequestContext, contains: any, out: EntityHit[]) {
    const rows = await this.prisma.ticketPassenger.findMany({
      where: {
        ticket: { companyId: ctx.companyId },
        OR: [{ name: contains }, { ticketNumber: contains }, { documentNumber: contains }, { pnr: contains }],
      },
      select: {
        id: true,
        name: true,
        pnr: true,
        ticketNumber: true,
        ticket: { select: { id: true, invoiceNumber: true } },
      },
      take: 15,
    });
    for (const r of rows) {
      out.push({
        kind: 'passenger',
        id: r.id,
        label: r.name,
        code: r.ticketNumber,
        extra: { pnr: r.pnr, ticketId: r.ticket?.id, invoiceNumber: r.ticket?.invoiceNumber },
      });
    }
  }

  private async listBranches(ctx: AiRequestContext): Promise<AiToolResult> {
    const rows = await this.prisma.branch.findMany({
      where: { companyId: ctx.companyId },
      select: { id: true, code: true, nameAr: true, city: true, isMain: true, status: true },
      orderBy: [{ isMain: 'desc' }, { code: 'asc' }],
    });

    const visible = ctx.canAccessAllBranches || !ctx.branchAccessResolved
      ? rows
      : rows.filter((b) => ctx.allowedBranchIds.includes(b.id));

    return {
      ok: true,
      data: { count: visible.length, branches: visible },
    };
  }
}
