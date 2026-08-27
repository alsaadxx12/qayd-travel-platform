import { Injectable } from '@nestjs/common';
import { ReportsService } from '../../reports/reports.service';
import { CashboxesBanksService } from '../../cashboxes-banks/cashboxes-banks.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AIAssistantService } from '../ai-assistant.service';
import { AiPermissionService } from '../core/ai-permission.service';
import { AiRequestContext, AiTool, AiToolResult, AiToolProvider } from '../types/ai-tool.types';
import { PERIOD_ENUM, resolvePeriod, round2, toNumber } from './tool-utils';

@Injectable()
export class AnalyticsTools implements AiToolProvider {
  constructor(
    private readonly reports: ReportsService,
    private readonly cashboxes: CashboxesBanksService,
    private readonly prisma: PrismaService,
    private readonly permissions: AiPermissionService,
    private readonly aiService: AIAssistantService,
  ) {}

  getTools(): AiTool[] {
    return [
      {
        name: 'getSalesSummary',
        description:
          'ملخص المبيعات والتكلفة والربح خلال فترة وفرع. استخدمها لأسئلة «كم بعنا اليوم» و«مبيعات هذا الشهر». Sales, cost and profit for a period and optional branch.',
        parameters: {
          type: 'object',
          properties: {
            period: { type: 'string', enum: PERIOD_ENUM },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            branchId: { type: 'string', description: 'معرّف الفرع من listBranches أو searchEntity' },
          },
          additionalProperties: false,
        },
        requiredPermissions: ['dashboard.view', 'profits.view', 'tickets.view'],
        sensitivity: 'read',
        handler: (args, ctx) => this.getSalesSummary(args, ctx),
      },
      {
        name: 'getDailyProfit',
        description:
          'أرباح الفترة (خدمات + إيرادات أخرى − مصروفات) بالدينار والدولار. استخدمها لأسئلة «كم أرباح اليوم» و«صافي الربح». Net profit for a period.',
        parameters: {
          type: 'object',
          properties: {
            period: { type: 'string', enum: PERIOD_ENUM },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            branchId: { type: 'string' },
          },
          additionalProperties: false,
        },
        requiredPermissions: ['profits.view', 'tickets.viewProfit', 'dashboard.viewFinancials'],
        sensitivity: 'read',
        handler: (args, ctx) => this.getDailyProfit(args, ctx),
      },
      {
        name: 'getBranchStats',
        description:
          'مؤشرات فرع واحد: المبيعات والتكلفة والربح وعدد العمليات. Branch KPIs for one branch.',
        parameters: {
          type: 'object',
          properties: {
            branchId: { type: 'string' },
            branchName: { type: 'string', description: 'اسم الفرع إذا لم يتوفر المعرّف' },
            period: { type: 'string', enum: PERIOD_ENUM },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
          },
          additionalProperties: false,
        },
        requiredPermissions: ['profits.view', 'dashboard.viewAllBranches', 'tickets.view'],
        sensitivity: 'read',
        handler: (args, ctx) => this.getBranchStats(args, ctx),
      },
      {
        name: 'compareBranches',
        description:
          'قارن مبيعات وربح فرعين أو أكثر خلال نفس الفترة واذكر أيهما أربح ولماذا. Compare two or more branches.',
        parameters: {
          type: 'object',
          properties: {
            branchIds: { type: 'array', items: { type: 'string' } },
            branchNames: { type: 'array', items: { type: 'string' }, description: 'أسماء الفروع إن لم تتوفر المعرّفات' },
            period: { type: 'string', enum: PERIOD_ENUM },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
          },
          additionalProperties: false,
        },
        requiredPermissions: ['profits.view', 'dashboard.viewAllBranches'],
        sensitivity: 'read',
        handler: (args, ctx) => this.compareBranches(args, ctx),
      },
      {
        name: 'getCashboxBalances',
        description:
          'أرصدة الصناديق والبنوك والحسابات الإلكترونية بالدينار والدولار. ALWAYS use this exact name for «أرصدة الصناديق والبنوك». Never invent getCashboxesBanks or names from the /cashboxes-banks route.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
        requiredPermissions: ['cashboxes.viewBalances', 'cashboxes.view'],
        sensitivity: 'read',
        handler: (_args, ctx) => this.getCashboxBalances(ctx),
      },
      {
        name: 'getCurrencyBalances',
        description:
          'تجميع أرصدة الصناديق والبنوك حسب العملة. Currency totals of cash and bank accounts.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
        requiredPermissions: ['cashboxes.viewBalances', 'cashboxes.view'],
        sensitivity: 'read',
        handler: (_args, ctx) => this.getCurrencyBalances(ctx),
      },
      {
        name: 'getFinancialSummary',
        description:
          'ملخص مالي شامل للفترة: مبيعات، تكلفة، ربح، إيرادات أخرى، مصروفات، صافي الربح. Comprehensive financial summary.',
        parameters: {
          type: 'object',
          properties: {
            period: { type: 'string', enum: PERIOD_ENUM },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            branchId: { type: 'string' },
          },
          additionalProperties: false,
        },
        requiredPermissions: ['profits.view', 'financials.incomeStatement', 'dashboard.viewFinancials'],
        sensitivity: 'read',
        handler: (args, ctx) => this.getFinancialSummary(args, ctx),
      },
      {
        name: 'getExchangeRate',
        description:
          'أسعار الصرف الثلاثة (بغداد، أربيل/الشمال، البصرة/الجنوب) والسعر المعتمد في النظام وكيف يُحتسب: السوق المرتبط + هامش الأمان. استخدمها لأسئلة «سعر الصرف»، «السعر المعتمد»، «الهامش»، «ليش السعر هيك»، «فرق السعر». Adopted rate, its market source, the margin, and all three market rates.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
        requiredPermissions: [],
        sensitivity: 'read',
        handler: (_args, ctx) => this.getExchangeRate(ctx),
      },
    ];
  }

  private async resolveBranch(ctx: AiRequestContext, id?: string, name?: string) {
    if (id) {
      const allowed = this.permissions.resolveBranchId(ctx, id);
      const row = await this.prisma.branch.findFirst({
        where: { companyId: ctx.companyId, id: allowed || id },
        select: { id: true, nameAr: true, code: true },
      });
      if (!row) throw new Error('الفرع غير موجود');
      this.permissions.resolveBranchId(ctx, row.id);
      return row;
    }
    if (name) {
      const row = await this.prisma.branch.findFirst({
        where: {
          companyId: ctx.companyId,
          OR: [
            { nameAr: { contains: name, mode: 'insensitive' } },
            { nameEn: { contains: name, mode: 'insensitive' } },
            { code: { contains: name, mode: 'insensitive' } },
          ],
        },
        select: { id: true, nameAr: true, code: true },
      });
      if (!row) throw new Error(`لم أجد فرعًا باسم "${name}"`);
      this.permissions.resolveBranchId(ctx, row.id);
      return row;
    }
    return null;
  }

  private compactSummary(raw: any) {
    const s = raw?.summary || {};
    return {
      ticketsCount: s.ticketsCount || 0,
      salesIQD: round2(s.servicesSalesIQD),
      salesUSD: round2(s.servicesSalesUSD),
      costIQD: round2(s.servicesCostIQD),
      costUSD: round2(s.servicesCostUSD),
      servicesProfitIQD: round2(s.servicesProfitIQD),
      servicesProfitUSD: round2(s.servicesProfitUSD),
      otherRevenuesIQD: round2(s.otherRevenuesIQD),
      otherRevenuesUSD: round2(s.otherRevenuesUSD),
      expensesIQD: round2(s.totalExpensesIQD),
      expensesUSD: round2(s.totalExpensesUSD),
      netProfitIQD: round2(s.netProfitIQD),
      netProfitUSD: round2(s.netProfitUSD),
      profitMarginIQD: round2(s.profitMarginIQD),
      profitMarginUSD: round2(s.profitMarginUSD),
    };
  }

  private async profitsFor(ctx: AiRequestContext, args: any, branchId?: string) {
    const period = resolvePeriod(args, ctx);
    const raw = await this.reports.getComprehensiveProfits(
      ctx.companyId,
      branchId,
      period.startDate,
      period.endDate,
    );
    return { period, summary: this.compactSummary(raw), breakdown: (raw as any)?.servicesBreakdown?.slice?.(0, 8) || [] };
  }

  private async getSalesSummary(args: any, ctx: AiRequestContext): Promise<AiToolResult> {
    const branch = await this.resolveBranch(ctx, args.branchId, args.branchName);
    const { period, summary, breakdown } = await this.profitsFor(ctx, args, branch?.id);

    return {
      ok: true,
      data: { period: period.label, startDate: period.startDate, endDate: period.endDate, branch: branch?.nameAr || 'كل الفروع', ...summary, breakdown },
      ui: [
        {
          type: 'kpi',
          payload: {
            title: `المبيعات — ${period.label}${branch ? ` — ${branch.nameAr}` : ''}`,
            items: [
              { label: 'المبيعات (د.ع)', value: summary.salesIQD },
              { label: 'المبيعات ($)', value: summary.salesUSD, currency: 'USD' },
              { label: 'التكلفة (د.ع)', value: summary.costIQD },
              { label: 'ربح الخدمات (د.ع)', value: summary.servicesProfitIQD, emphasis: true },
              { label: 'عدد العمليات', value: summary.ticketsCount, type: 'count' },
            ],
          },
        },
      ],
      suggestions: ['كم صافي الربح؟', 'قارن بالشهر الماضي', 'حسب الفرع'],
    };
  }

  private async getDailyProfit(args: any, ctx: AiRequestContext): Promise<AiToolResult> {
    const branch = await this.resolveBranch(ctx, args.branchId, args.branchName);
    const { period, summary } = await this.profitsFor(ctx, args, branch?.id);

    return {
      ok: true,
      data: { period: period.label, branch: branch?.nameAr || 'كل الفروع', ...summary },
      ui: [
        {
          type: 'kpi',
          payload: {
            title: `الأرباح — ${period.label}`,
            items: [
              { label: 'ربح الخدمات', value: summary.servicesProfitIQD },
              { label: 'إيرادات أخرى', value: summary.otherRevenuesIQD },
              { label: 'المصروفات', value: summary.expensesIQD },
              { label: 'صافي الربح (د.ع)', value: summary.netProfitIQD, emphasis: true },
              { label: 'صافي الربح ($)', value: summary.netProfitUSD, currency: 'USD' },
            ],
          },
        },
      ],
      suggestions: ['تفصيل المصروفات', 'مقارنة بالفترة السابقة'],
    };
  }

  private async getBranchStats(args: any, ctx: AiRequestContext): Promise<AiToolResult> {
    const branch = await this.resolveBranch(ctx, args.branchId, args.branchName);
    if (!branch) {
      return { ok: false, data: { found: false, message: 'حدد الفرع بالاسم أو المعرّف' } };
    }
    return this.getSalesSummary({ ...args, branchId: branch.id }, ctx);
  }

  private async compareBranches(args: any, ctx: AiRequestContext): Promise<AiToolResult> {
    const period = resolvePeriod(args, ctx);
    let ids: string[] = Array.isArray(args.branchIds) ? args.branchIds.filter(Boolean) : [];
    const names: string[] = Array.isArray(args.branchNames) ? args.branchNames.filter(Boolean) : [];

    if (!ids.length && names.length) {
      const resolved = await Promise.all(names.map((n) => this.resolveBranch(ctx, undefined, n)));
      ids = resolved.filter(Boolean).map((b) => b!.id);
    }

    if (ids.length < 2) {
      const all = await this.prisma.branch.findMany({
        where: { companyId: ctx.companyId },
        select: { id: true, nameAr: true },
        take: 8,
      });
      const visible =
        ctx.canAccessAllBranches || !ctx.branchAccessResolved
          ? all
          : all.filter((b) => ctx.allowedBranchIds.includes(b.id));
      ids = visible.map((b) => b.id);
    }

    if (ids.length < 2) {
      return { ok: false, data: { found: false, message: 'لا يوجد فرعان للمقارنة ضمن صلاحياتك' } };
    }

    for (const id of ids) this.permissions.resolveBranchId(ctx, id);

    const results = await Promise.all(
      ids.map(async (id) => {
        const branch = await this.prisma.branch.findFirst({
          where: { id, companyId: ctx.companyId },
          select: { id: true, nameAr: true, code: true },
        });
        const { summary } = await this.profitsFor(ctx, args, id);
        return { branchId: id, name: branch?.nameAr || id, code: branch?.code, ...summary };
      }),
    );

    const ranked = [...results].sort((a, b) => b.netProfitIQD - a.netProfitIQD);
    const winner = ranked[0];
    const runner = ranked[1];

    return {
      ok: true,
      data: {
        period: period.label,
        winner: winner?.name,
        winnerProfitIQD: winner?.netProfitIQD,
        differenceIQD: round2(toNumber(winner?.netProfitIQD) - toNumber(runner?.netProfitIQD)),
        branches: ranked,
        instruction:
          'اشرح الفرق اعتمادًا على المبيعات والتكلفة وهامش الربح وعدد العمليات. لا تخترع أسبابًا خارج هذه الأرقام.',
      },
      ui: [
        {
          type: 'table',
          payload: {
            title: `مقارنة الفروع — ${period.label}`,
            columns: [
              { key: 'name', label: 'الفرع' },
              { key: 'ticketsCount', label: 'العمليات', type: 'count' },
              { key: 'salesIQD', label: 'المبيعات', type: 'money' },
              { key: 'costIQD', label: 'التكلفة', type: 'money' },
              { key: 'netProfitIQD', label: 'صافي الربح', type: 'money' },
            ],
            rows: ranked,
          },
        },
        {
          type: 'chart',
          payload: {
            title: 'صافي الربح حسب الفرع',
            chartType: 'bar',
            categories: ranked.map((r) => r.name),
            series: [{ name: 'صافي الربح', data: ranked.map((r) => r.netProfitIQD) }],
          },
        },
      ],
      suggestions: ['تفصيل الفرع الأعلى', 'نفس المقارنة للشهر الماضي'],
    };
  }

  private async getCashboxBalances(ctx: AiRequestContext): Promise<AiToolResult> {
    const items: any[] = await this.cashboxes.getSummary(ctx.companyId);
    const rows = items.map((i) => ({
      id: i.id,
      code: i.code,
      name: i.nameAr,
      itemType: i.itemType,
      balanceIQD: round2(i.balanceIQD),
      balanceUSD: round2(i.balanceUSD),
      currency: i.currency,
    }));

    const totalIQD = round2(rows.reduce((s, r) => s + r.balanceIQD, 0));
    const totalUSD = round2(rows.reduce((s, r) => s + r.balanceUSD, 0));

    return {
      ok: true,
      data: { count: rows.length, totalIQD, totalUSD, items: rows.slice(0, 20) },
      ui: [
        {
          type: 'kpi',
          payload: {
            title: 'أرصدة الصناديق والبنوك',
            items: [
              { label: 'الإجمالي (د.ع)', value: totalIQD, emphasis: true },
              { label: 'الإجمالي ($)', value: totalUSD, currency: 'USD' },
              { label: 'عدد الحسابات', value: rows.length, type: 'count' },
            ],
          },
        },
        {
          type: 'table',
          payload: {
            title: 'التفصيل',
            columns: [
              { key: 'code', label: 'الرمز' },
              { key: 'name', label: 'الاسم' },
              { key: 'itemType', label: 'النوع', type: 'badge' },
              { key: 'balanceIQD', label: 'د.ع', type: 'money' },
              { key: 'balanceUSD', label: '$', type: 'money', currency: 'USD' },
            ],
            rows,
            action: { entity: 'account', idKey: 'id' },
          },
        },
      ],
    };
  }

  private async getCurrencyBalances(ctx: AiRequestContext): Promise<AiToolResult> {
    const items: any[] = await this.cashboxes.getSummary(ctx.companyId);
    const byCurrency: Record<string, { IQD: number; USD: number; count: number }> = {};
    for (const i of items) {
      const key = i.itemType || 'OTHER';
      byCurrency[key] = byCurrency[key] || { IQD: 0, USD: 0, count: 0 };
      byCurrency[key].IQD += toNumber(i.balanceIQD);
      byCurrency[key].USD += toNumber(i.balanceUSD);
      byCurrency[key].count += 1;
    }

    const rows = Object.entries(byCurrency).map(([type, v]) => ({
      type,
      balanceIQD: round2(v.IQD),
      balanceUSD: round2(v.USD),
      count: v.count,
    }));

    return {
      ok: true,
      data: {
        totalIQD: round2(rows.reduce((s, r) => s + r.balanceIQD, 0)),
        totalUSD: round2(rows.reduce((s, r) => s + r.balanceUSD, 0)),
        byType: rows,
      },
      ui: [
        {
          type: 'table',
          payload: {
            title: 'الأرصدة حسب النوع والعملة',
            columns: [
              { key: 'type', label: 'النوع' },
              { key: 'count', label: 'العدد' },
              { key: 'balanceIQD', label: 'د.ع', type: 'money' },
              { key: 'balanceUSD', label: '$', type: 'money', currency: 'USD' },
            ],
            rows,
          },
        },
      ],
    };
  }

  private async getFinancialSummary(args: any, ctx: AiRequestContext): Promise<AiToolResult> {
    const branch = await this.resolveBranch(ctx, args.branchId, args.branchName);
    const { period, summary, breakdown } = await this.profitsFor(ctx, args, branch?.id);

    return {
      ok: true,
      data: { period: period.label, branch: branch?.nameAr || 'كل الفروع', ...summary, services: breakdown },
      ui: [
        {
          type: 'kpi',
          payload: {
            title: `الملخص المالي — ${period.label}`,
            items: [
              { label: 'المبيعات', value: summary.salesIQD },
              { label: 'التكلفة', value: summary.costIQD },
              { label: 'ربح الخدمات', value: summary.servicesProfitIQD },
              { label: 'المصروفات', value: summary.expensesIQD },
              { label: 'صافي الربح', value: summary.netProfitIQD, emphasis: true },
            ],
          },
        },
      ],
    };
  }

  /** Arabic label for each configurable market source. */
  private static readonly RATE_SOURCE_LABEL: Record<string, string> = {
    BAGHDAD_SELL: 'بيع بغداد',
    BAGHDAD_BUY: 'شراء بغداد',
    NORTHERN_SELL: 'بيع الشمال (أربيل)',
    SOUTHERN_SELL: 'بيع الجنوب (البصرة)',
    AVERAGE: 'متوسط الأسواق الثلاثة',
    FIXED: 'سعر ثابت مُدخل يدوياً',
  };

  /**
   * The full exchange-rate picture, not just the market prices.
   *
   * The adopted rate is the number the whole system prices with, and it is DERIVED:
   * one chosen market rate plus a safety margin. Users ask "why is the rate this
   * number" far more often than they ask what Baghdad is trading at, so the tool
   * returns the derivation, not only the result.
   */
  private async getExchangeRate(ctx: AiRequestContext): Promise<AiToolResult> {
    const snap = await this.prisma.exchangeRateSnapshot.findFirst({ orderBy: { capturedAt: 'desc' } });
    const brief = await this.aiService.getLiveFinancialContext(ctx.tenantId || ctx.companyId);
    const doctrine: any = (brief as any).rateDoctrine || {};

    const markets = {
      baghdad: { sell: round2(snap?.baghdadSell), buy: round2(snap?.baghdadBuy), label: 'بغداد' },
      erbil: { sell: round2(snap?.northernSell), buy: round2(snap?.northernBuy), label: 'أربيل (الشمال)' },
      basra: { sell: round2(snap?.southernSell), buy: round2(snap?.southernBuy), label: 'البصرة (الجنوب)' },
    };

    const sourceLabel =
      AnalyticsTools.RATE_SOURCE_LABEL[String(doctrine.baseMarketSource)] ||
      String(doctrine.baseMarketSource || 'بيع بغداد');
    const adopted = round2(brief.adoptedRate);
    const marginPerUsd = round2(doctrine.marginPerUsd);
    const isFixed = doctrine.mode === 'FIXED';

    const formula = isFixed
      ? `السعر المعتمد ثابت ومُدخل يدوياً = ${adopted} د.ع/$`
      : `السعر المعتمد = ${sourceLabel} (${round2(doctrine.baseMarketValue)}) + هامش الأمان (${marginPerUsd}) = ${adopted} د.ع/$`;

    return {
      ok: true,
      data: {
        adoptedRate: adopted,
        formula,
        source: { code: doctrine.baseMarketSource || null, label: sourceLabel, value: round2(doctrine.baseMarketValue) },
        margin: {
          perUsd: marginPerUsd,
          amount: round2(doctrine.marginAmount),
          unit: doctrine.marginUnit || 'PER_USD',
          per100Usd: round2(marginPerUsd * 100),
        },
        mode: doctrine.mode || 'MARKET_LINKED',
        configured: doctrine.configured === true,
        markets,
        marginVsBaghdadSell: round2(brief.currentMargin),
        isMarginSafe: brief.isMarginSafe === true,
        capturedAt: snap?.capturedAt || null,
      },
      ui: [
        {
          type: 'kpi',
          payload: {
            title: 'السعر المعتمد وكيف تكوّن',
            items: [
              { label: 'المعتمد', value: adopted, emphasis: true },
              { label: sourceLabel, value: round2(doctrine.baseMarketValue) },
              { label: 'هامش الأمان', value: marginPerUsd },
            ],
          },
        },
        {
          type: 'table',
          payload: {
            title: 'أسعار الأسواق الثلاثة (دينار/دولار)',
            // DataTableBlock reads row[col.key] — columns are objects, rows are keyed
            // objects. Passing plain arrays renders an empty grid of dashes.
            columns: [
              { key: 'market', label: 'السوق' },
              { key: 'sell', label: 'بيع' },
              { key: 'buy', label: 'شراء' },
            ],
            rows: [
              { market: markets.baghdad.label, sell: markets.baghdad.sell, buy: markets.baghdad.buy },
              { market: markets.erbil.label, sell: markets.erbil.sell, buy: markets.erbil.buy },
              { market: markets.basra.label, sell: markets.basra.sell, buy: markets.basra.buy },
            ],
          },
        },
      ],
      suggestions: ['ليش السعر المعتمد هيك؟', 'قارن الأسواق الثلاثة', 'أرباح فرق السعر'],
      note: doctrine.configured
        ? formula
        : `${formula} — تنبيه: لم أجد إعدادات سعر صرف محفوظة لهذه الشركة، فالقيم افتراضية.`,
    };
  }
}
