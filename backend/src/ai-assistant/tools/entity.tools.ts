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
    let query = (args.query || args.name || args.q || '').trim();
    if (!query) {
      return { ok: false, data: { found: false, message: '\u0644\u0645 \u064a\u062a\u0645 \u062a\u062d\u062f\u064a\u062f \u0646\u0635 \u0644\u0644\u0628\u062d\u062b' } };
    }

    // Strip common financial action prefixes that are NOT part of entity names
    // Multi-pass: handles stacked prefixes like "صدّر كشف سلف علي السعدي"
    const originalQuery = query;
    const PREFIX_RE = /^(\u0635\u062f\u0651?\u0631|\u062d\u0645\u0651?\u0644|\u0646\u0632\u0651?\u0644|\u0623\u0631\u0633\u0644|\u0627\u0631\u0633\u0644|\u062a\u0635\u062f\u064a\u0631|\u062a\u062d\u0645\u064a\u0644|\u062a\u0646\u0632\u064a\u0644|\u0633\u0644\u0641|\u0631\u0635\u064a\u062f|\u0643\u0634\u0641|\u062d\u0633\u0627\u0628|\u0630\u0645\u0629|\u0630\u0645\u0645|\u0643\u0634\u0641 \u062d\u0633\u0627\u0628)\s+/i;
    const PREP_RE = /^(\u0644\u062d\u0633\u0627\u0628|\u0639\u0646|\u0625\u0644\u0649|\u0627\u0644\u0649|\u0644|\u0639\u0644\u0649|\u0625\u0644\u0649|\u0625\u0644)\s+/i;
    for (let i = 0; i < 5 && (PREFIX_RE.test(query) || PREP_RE.test(query)); i++) {
      query = query.replace(PREFIX_RE, '').replace(PREP_RE, '').trim();
    }
    if (!query) {
      return { ok: false, data: { found: false, message: '\u0644\u0645 \u064a\u062a\u0645 \u062a\u062d\u062f\u064a\u062f \u0646\u0635 \u0644\u0644\u0628\u062d\u062b' } };
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

    // If prefixes were stripped, also search with the original query so that
    // accounts whose names contain stripped prefixes (e.g. "سلف علي السعدي")
    // are still found.
    if (originalQuery !== query) {
      const origContains = { contains: originalQuery, mode: 'insensitive' as const };
      const existingIds = new Set(hits.map((h) => `${h.kind}:${h.id}`));
      const origHits: EntityHit[] = [];
      await Promise.all([
        kinds.includes('customer') ? this.findCustomers(ctx, origContains, origHits) : null,
        kinds.includes('supplier') ? this.findSuppliers(ctx, origContains, origHits) : null,
        kinds.includes('account') ? this.findAccounts(ctx, origContains, origHits) : null,
        kinds.includes('airline') ? this.findAirlines(ctx, origContains, origHits) : null,
        kinds.includes('employee') ? this.findEmployees(ctx, origContains, origHits) : null,
        kinds.includes('branch') ? this.findBranches(ctx, origContains, origHits) : null,
        kinds.includes('passenger') ? this.findPassengers(ctx, origContains, origHits) : null,
      ]);
      for (const h of origHits) {
        if (!existingIds.has(`${h.kind}:${h.id}`)) {
          hits.push(h);
        }
      }
    }

    // Prisma `contains` misses Arabic spelling variants, so widen with a normalised pass.
    // Score against both the stripped and original query, using the higher score,
    // so hits like "سلف علي السعدي" are not dropped when scored against stripped "علي السعدي".
    const scored = hits
      .map((h) => ({
        hit: h,
        score: Math.max(this.score(h, query), originalQuery !== query ? this.score(h, originalQuery) : 0),
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
        data: { found: false, query, message: `\u0644\u0645 \u0623\u062c\u062f \u0623\u064a \u0643\u064a\u0627\u0646 \u0645\u0637\u0627\u0628\u0642 \u0644\u0640 "${query}"` },
        note: '\u0644\u0627 \u0646\u062a\u0627\u0626\u062c',
      };
    }

    // Re-score deduped hits for auto-selection logic
    const dedupedScored = deduped.map((h) => ({ hit: h, score: Math.max(this.score(h, query), originalQuery !== query ? this.score(h, originalQuery) : 0) }));
    dedupedScored.sort((a, b) => b.score - a.score);

    const bestScore = dedupedScored[0]?.score || 0;
    const secondScore = dedupedScored[1]?.score || 0;

    // Auto-select if: only 1 result, OR best match is exact (100), OR best is clearly ahead (20+ gap)
    const autoSelect = deduped.length === 1 || bestScore === 100 || (bestScore - secondScore >= 20);

    if (autoSelect) {
      const match = dedupedScored[0].hit;
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
        suggestions: ['\u0643\u0634\u0641 PDF', '\u0623\u0631\u0633\u0644 \u0627\u0644\u0643\u0634\u0641 \u0628\u0627\u0644\u0625\u064a\u0645\u064a\u0644', '\u0631\u0635\u064a\u062f\u0647', '\u0643\u0634\u0641 \u0627\u0644\u062d\u0633\u0627\u0628'],
        note: `\u062a\u0645 \u0627\u0644\u0639\u062b\u0648\u0631 \u0639\u0644\u0649 \u00ab${match.label}\u00bb`,
      };
    }

    const capped = capForModel(deduped, 12);

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
          '\u0644\u0627 \u062a\u0628\u062d\u062b \u0645\u0646 \u062c\u062f\u064a\u062f. \u0627\u0637\u0644\u0628 \u0645\u0646 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645 \u0627\u062e\u062a\u064a\u0627\u0631 \u0635\u0641 \u0648\u0627\u062d\u062f \u0641\u0642\u0637\u060c \u062b\u0645 \u0646\u0641\u0651\u0630 \u0637\u0644\u0628\u0647 \u0627\u0644\u0623\u0635\u0644\u064a \u0645\u0628\u0627\u0634\u0631\u0629 \u0628\u062f\u0648\u0646 \u0633\u0624\u0627\u0644.',
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
      suggestions: ['\u0643\u0634\u0641 PDF', '\u0623\u0631\u0633\u0644 \u0627\u0644\u0643\u0634\u0641 \u0628\u0627\u0644\u0625\u064a\u0645\u064a\u0644'],
      note: `${deduped.length} \u0646\u062a\u064a\u062c\u0629 \u0645\u0637\u0627\u0628\u0642\u0629`,
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
