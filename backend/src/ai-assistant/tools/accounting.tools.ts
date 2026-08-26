import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportsService } from '../../reports/reports.service';
import { AccountsService } from '../../accounts/accounts.service';
import { AiRequestContext, AiTool, AiToolResult, AiToolProvider } from '../types/ai-tool.types';
import { capForModel, resolvePeriod, round2, toNumber } from './tool-utils';

/**
 * Ledger-facing tools. Everything routes through ReportsService/AccountsService so
 * the numbers the Copilot quotes are identical to the numbers on the report pages.
 */
@Injectable()
export class AccountingTools implements AiToolProvider {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
    private readonly accounts: AccountsService,
  ) {}

  getTools(): AiTool[] {
    return [
      {
        name: 'getAccountBalance',
        description:
          'اجلب الرصيد الحالي لحساب محدد بالدينار والدولار مع إجمالي المدين والدائن. يتطلب accountId من searchEntity. Get the current balance of a specific account.',
        parameters: {
          type: 'object',
          properties: {
            accountId: { type: 'string', description: 'معرّف الحساب من searchEntity' },
          },
          required: ['accountId'],
          additionalProperties: false,
        },
        requiredPermissions: ['accounts.viewBalances', 'accounts.view', 'partners.viewBalances', 'debts.view'],
        sensitivity: 'read',
        handler: (args, ctx) => this.getAccountBalance(args, ctx),
      },
      {
        name: 'getAccountStatement',
        description:
          'كشف حساب تفصيلي بالحركات والرصيد الجاري خلال فترة. استخدمها لأسئلة «آخر الحركات» و«كشف الحساب». Detailed account statement with running balance.',
        parameters: {
          type: 'object',
          properties: {
            accountId: { type: 'string' },
            period: { type: 'string', enum: ['TODAY', 'WEEK', 'MONTH', 'LAST_MONTH', 'QUARTER', 'YEAR', 'FISCAL_YEAR'] },
            startDate: { type: 'string', description: 'YYYY-MM-DD' },
            endDate: { type: 'string', description: 'YYYY-MM-DD' },
            limit: { type: 'number', description: 'أقصى عدد حركات تُعرض (افتراضي 50)' },
          },
          required: ['accountId'],
          additionalProperties: false,
        },
        requiredPermissions: ['reports.statement.view', 'accounts.viewBalances', 'debts.view'],
        sensitivity: 'read',
        handler: (args, ctx) => this.getAccountStatement(args, ctx),
      },
      {
        name: 'analyzeAccountBalance',
        description:
          'حلّل سبب رصيد حساب: من أين جاءت الحركات (تذاكر، سندات قبض، سندات دفع، قيود يدوية) وأين قد تكون المشكلة. استخدمها لأسئلة «لماذا الرصيد كذا» أو «لماذا صار الحساب دائن» أو «هل يوجد خطأ». Explain why an account balance is what it is.',
        parameters: {
          type: 'object',
          properties: { accountId: { type: 'string' } },
          required: ['accountId'],
          additionalProperties: false,
        },
        requiredPermissions: ['reports.statement.view', 'accounts.viewBalances', 'debts.view'],
        sensitivity: 'read',
        handler: (args, ctx) => this.analyzeAccountBalance(args, ctx),
      },
      {
        name: 'getReceivables',
        description:
          'الذمم المدينة: المبالغ المستحقة لنا على العملاء، مرتبة تنازليًا. استخدمها لأسئلة «من مدين لنا» و«الذمم المستحقة». Accounts receivable ranked by amount.',
        parameters: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'عدد الحسابات المعروضة (افتراضي 10)' },
            minAmount: { type: 'number', description: 'تجاهل الأرصدة الأقل من هذا المبلغ' },
          },
          additionalProperties: false,
        },
        requiredPermissions: ['debts.view', 'partners.viewBalances'],
        sensitivity: 'read',
        handler: (args, ctx) => this.getDebts(args, ctx, 'receivable'),
      },
      {
        name: 'getPayables',
        description:
          'الذمم الدائنة: المبالغ المستحقة علينا للموردين وشركات الطيران. استخدمها لأسئلة «شكد علينا» و«كم مستحق للمورد». Accounts payable ranked by amount.',
        parameters: {
          type: 'object',
          properties: {
            limit: { type: 'number' },
            minAmount: { type: 'number' },
          },
          additionalProperties: false,
        },
        requiredPermissions: ['debts.view', 'partners.viewBalances'],
        sensitivity: 'read',
        handler: (args, ctx) => this.getDebts(args, ctx, 'payable'),
      },
      {
        name: 'getTrialBalance',
        description: 'ميزان المراجعة: إجمالي المدين والدائن لكل حساب والتحقق من التوازن. Trial balance.',
        parameters: {
          type: 'object',
          properties: { onlyUnbalanced: { type: 'boolean' }, limit: { type: 'number' } },
          additionalProperties: false,
        },
        requiredPermissions: ['financials.trialBalance'],
        sensitivity: 'read',
        handler: (args, ctx) => this.getTrialBalance(args, ctx),
      },
      {
        name: 'getIncomeStatement',
        description: 'قائمة الدخل: الإيرادات والمصروفات وصافي الربح المحاسبي. Income statement.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
        requiredPermissions: ['financials.incomeStatement'],
        sensitivity: 'read',
        handler: (_args, ctx) => this.getIncomeStatement(ctx),
      },
      {
        name: 'getBalanceSheet',
        description: 'الميزانية العمومية: الأصول والخصوم وحقوق الملكية. Balance sheet.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
        requiredPermissions: ['financials.balanceSheet'],
        sensitivity: 'read',
        handler: (_args, ctx) => this.getBalanceSheet(ctx),
      },
      {
        name: 'listAccounts',
        description:
          'اعرض حسابات شجرة الحسابات حسب النوع أو التصنيف. Useful to explore the chart of accounts.',
        parameters: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] },
            category: { type: 'string', enum: ['GENERAL', 'CASH', 'BANK', 'CUSTOMER', 'SUPPLIER'] },
            limit: { type: 'number' },
          },
          additionalProperties: false,
        },
        requiredPermissions: ['accounts.view'],
        sensitivity: 'read',
        handler: (args, ctx) => this.listAccounts(args, ctx),
      },
    ];
  }

  private async loadAccount(ctx: AiRequestContext, accountId: string) {
    const id = String(accountId || '').trim();
    if (!id) return null;
    const direct = await this.prisma.account.findFirst({
      where: { id, companyId: ctx.companyId },
      select: {
        id: true,
        code: true,
        nameAr: true,
        nameEn: true,
        type: true,
        category: true,
        currency: true,
        isParent: true,
      },
    });
    if (direct) return direct;

    const linked = await this.prisma.customer.findFirst({
      where: { companyId: ctx.companyId, OR: [{ id }, { accountId: id }] },
      select: { accountId: true },
    }) || await this.prisma.supplier.findFirst({
      where: { companyId: ctx.companyId, OR: [{ id }, { accountId: id }] },
      select: { accountId: true },
    });
    if (!linked?.accountId) return null;
    return this.prisma.account.findFirst({
      where: { id: linked.accountId, companyId: ctx.companyId },
      select: {
        id: true,
        code: true,
        nameAr: true,
        nameEn: true,
        type: true,
        category: true,
        currency: true,
        isParent: true,
      },
    });
  }

  private async getAccountBalance(args: any, ctx: AiRequestContext): Promise<AiToolResult> {
    const account =
      (await this.loadAccount(ctx, args.accountId)) ||
      (await this.loadAccount(ctx, args.entityId));
    if (!account) {
      return {
        ok: false,
        data: { found: false, message: 'حدد العميل أو الحساب أولاً ثم اطلب الرصيد.' },
        note: 'لم يُحدد حساب. اختر العميل من القائمة ثم اطلب رصيده.',
      };
    }

    const detail: any = await this.accounts.findOne(account.id, ctx.companyId);

    const balanceIQD = round2(detail?.balanceIQD ?? detail?.balance);
    const balanceUSD = round2(detail?.balanceUSD);
    const debitIQD = round2(detail?.debitIQD);
    const creditIQD = round2(detail?.creditIQD);
    const debitUSD = round2(detail?.debitUSD);
    const creditUSD = round2(detail?.creditUSD);

    const lastMovement = await this.prisma.journalEntryLine.findFirst({
      where: { accountId: account.id, journalEntry: { status: 'POSTED', companyId: ctx.companyId } },
      orderBy: { journalEntry: { date: 'desc' } },
      select: { journalEntry: { select: { date: true, description: true, entryNumber: true } } },
    });

    const state = balanceIQD > 0 || balanceUSD > 0 ? 'مدين' : balanceIQD < 0 || balanceUSD < 0 ? 'دائن' : 'متوازن';

    return {
      ok: true,
      data: {
        account: { id: account.id, code: account.code, name: account.nameAr, type: account.type },
        balanceIQD,
        balanceUSD,
        debitIQD,
        creditIQD,
        debitUSD,
        creditUSD,
        state,
        lastMovementDate: lastMovement?.journalEntry?.date ?? null,
      },
      ui: [
        {
          type: 'account_card',
          payload: {
            id: account.id,
            code: account.code,
            name: account.nameAr,
            nameEn: account.nameEn,
            type: account.type,
            category: account.category,
            balanceIQD,
            balanceUSD,
            debitIQD,
            creditIQD,
            debitUSD,
            creditUSD,
            state,
            lastMovementDate: lastMovement?.journalEntry?.date ?? null,
            lastMovementLabel: lastMovement?.journalEntry?.description ?? null,
          },
        },
      ],
      suggestions: ['كشف PDF', 'أرسل الكشف بالإيميل', 'كشف الحساب', 'لماذا هذا الرصيد؟'],
    };
  }

  private async getAccountStatement(args: any, ctx: AiRequestContext): Promise<AiToolResult> {
    const account =
      (await this.loadAccount(ctx, args.accountId)) ||
      (await this.loadAccount(ctx, args.entityId));
    if (!account) {
      return {
        ok: false,
        data: { found: false, message: 'حدد العميل أو الحساب أولاً ثم اطلب كشف الحساب.' },
        note: 'لم يُحدد حساب. اختر العميل من القائمة ثم اطلب الكشف.',
      };
    }

    const period = resolvePeriod(args, ctx);
    const statement: any = await this.reports.getAccountStatement(
      ctx.companyId,
      account.id,
      period.startDate,
      period.endDate,
    );

    const limit = Math.min(Number(args.limit) || 50, 200);
    const allLines = Array.isArray(statement?.lines) ? statement.lines : [];
    // Newest first is what people mean by "آخر الحركات".
    const ordered = [...allLines].reverse().slice(0, limit);
    const capped = capForModel(ordered, 12);

    return {
      ok: true,
      data: {
        account: { id: account.id, code: account.code, name: account.nameAr },
        period: period.label,
        startDate: period.startDate,
        endDate: period.endDate,
        openingBalance: round2(statement?.openingBalance),
        closingBalance: round2(statement?.closingBalance),
        totalMovements: allLines.length,
        shown: capped.rows.length,
        movements: capped.rows.map((l: any) => ({
          date: l.date,
          entryNumber: l.entryNumber,
          description: l.description,
          debit: round2(l.debit),
          credit: round2(l.credit),
          runningBalance: round2(l.runningBalance),
        })),
      },
      ui: [
        {
          type: 'kpi',
          payload: {
            title: `كشف حساب ${account.nameAr} — ${period.label}`,
            items: [
              { label: 'الرصيد الافتتاحي', value: round2(statement?.openingBalance) },
              { label: 'إجمالي المدين', value: round2(allLines.reduce((s: number, l: any) => s + toNumber(l.debit), 0)) },
              { label: 'إجمالي الدائن', value: round2(allLines.reduce((s: number, l: any) => s + toNumber(l.credit), 0)) },
              { label: 'الرصيد الحالي', value: round2(statement?.closingBalance), emphasis: true },
            ],
          },
        },
        {
          type: 'table',
          payload: {
            title: 'الحركات',
            columns: [
              { key: 'date', label: 'التاريخ', type: 'date' },
              { key: 'entryNumber', label: 'القيد' },
              { key: 'description', label: 'البيان' },
              { key: 'debit', label: 'مدين', type: 'money' },
              { key: 'credit', label: 'دائن', type: 'money' },
              { key: 'runningBalance', label: 'الرصيد', type: 'money' },
            ],
            rows: ordered.map((l: any) => ({
              date: l.date,
              entryNumber: l.entryNumber,
              description: l.description,
              debit: round2(l.debit),
              credit: round2(l.credit),
              runningBalance: round2(l.runningBalance),
            })),
            totalCount: allLines.length,
          },
        },
      ],
      suggestions: ['كشف PDF', 'أرسل الكشف بالإيميل', 'لماذا هذا الرصيد؟'],
    };
  }

  private async analyzeAccountBalance(args: any, ctx: AiRequestContext): Promise<AiToolResult> {
    const account = await this.loadAccount(ctx, args.accountId);
    if (!account) {
      return { ok: false, data: { found: false, message: 'الحساب غير موجود ضمن هذه الشركة' } };
    }

    const trace: any = await this.reports.getDebtAmountTrace(ctx.companyId, account.id);

    const movements = Array.isArray(trace?.movements) ? trace.movements : [];
    const bySource = movements.reduce((acc: Record<string, { count: number; debit: number; credit: number }>, m: any) => {
      const key = m.kind || m.source || 'أخرى';
      acc[key] = acc[key] || { count: 0, debit: 0, credit: 0 };
      acc[key].count += 1;
      acc[key].debit += toNumber(m.debit);
      acc[key].credit += toNumber(m.credit);
      return acc;
    }, {});

    const breakdown = Object.entries(bySource).map(([source, v]: any) => ({
      source,
      count: v.count,
      debit: round2(v.debit),
      credit: round2(v.credit),
      net: round2(v.debit - v.credit),
    }));

    const largest = [...movements]
      .sort((a: any, b: any) => Math.abs(toNumber(b.signedAmount)) - Math.abs(toNumber(a.signedAmount)))
      .slice(0, 5)
      .map((m: any) => ({
        date: m.date,
        description: m.source || m.kind,
        amount: round2(m.signedAmount),
        currency: m.currency,
      }));

    return {
      ok: true,
      data: {
        account: { id: account.id, code: account.code, name: account.nameAr, type: account.type },
        summaries: (trace?.summaries || []).map((s: any) => ({
          currency: s.currency,
          debit: round2(s.debit),
          credit: round2(s.credit),
          balance: round2(s.balance),
          movements: s.movements,
        })),
        counts: trace?.counts,
        breakdownBySource: breakdown,
        largestMovements: largest,
        integrity: trace?.integrity,
        instruction:
          'اشرح للمستخدم من أين تكوّن الرصيد بالاعتماد على breakdownBySource وsummaries، وإذا كان integrity يشير إلى تعارض فبيّن ذلك. لا تخترع أرقامًا غير موجودة هنا.',
      },
      ui: [
        {
          type: 'table',
          payload: {
            title: `تحليل مصادر حركات ${account.nameAr}`,
            columns: [
              { key: 'source', label: 'المصدر' },
              { key: 'count', label: 'عدد الحركات' },
              { key: 'debit', label: 'مدين', type: 'money' },
              { key: 'credit', label: 'دائن', type: 'money' },
              { key: 'net', label: 'الصافي', type: 'money' },
            ],
            rows: breakdown,
          },
        },
      ],
      suggestions: ['اعرض أكبر الحركات', 'كشف الحساب كاملًا'],
    };
  }

  private async getDebts(args: any, ctx: AiRequestContext, kind: 'receivable' | 'payable'): Promise<AiToolResult> {
    const report: any = await this.reports.getDebtsReport(ctx.companyId);
    const limit = Math.min(Number(args.limit) || 10, 50);
    const minAmount = Number(args.minAmount) || 0;

    const rows = (report?.rows || [])
      .filter((r: any) => r.debtType === kind)
      .map((r: any) => ({
        accountId: r.id,
        code: r.code,
        name: r.nameAr || r.nameEn,
        balanceIQD: round2(r.endingBalanceIQD),
        balanceUSD: round2(r.endingBalanceUSD),
        absTotal: Math.abs(toNumber(r.endingBalanceIQD)) + Math.abs(toNumber(r.endingBalanceUSD)) * 1500,
        label: r.debtLabel,
      }))
      .filter((r: any) => Math.abs(r.balanceIQD) >= minAmount || Math.abs(r.balanceUSD) >= minAmount)
      .sort((a: any, b: any) => b.absTotal - a.absTotal);

    if (!rows.length) {
      return {
        ok: true,
        data: {
          found: false,
          message: kind === 'receivable' ? 'لا توجد ذمم مدينة مسجلة' : 'لا توجد ذمم دائنة مسجلة',
        },
      };
    }

    const top = rows.slice(0, limit).map(({ absTotal, ...rest }: any) => rest);
    const totalIQD = round2(rows.reduce((s: number, r: any) => s + r.balanceIQD, 0));
    const totalUSD = round2(rows.reduce((s: number, r: any) => s + r.balanceUSD, 0));

    return {
      ok: true,
      data: {
        kind: kind === 'receivable' ? 'ذمم مدينة (لنا)' : 'ذمم دائنة (علينا)',
        accountsCount: rows.length,
        totalIQD,
        totalUSD,
        top,
      },
      ui: [
        {
          type: 'kpi',
          payload: {
            title: kind === 'receivable' ? 'إجمالي الذمم المدينة' : 'إجمالي الذمم الدائنة',
            items: [
              { label: 'عدد الحسابات', value: rows.length, type: 'count' },
              { label: 'الإجمالي بالدينار', value: totalIQD },
              { label: 'الإجمالي بالدولار', value: totalUSD, currency: 'USD' },
            ],
          },
        },
        {
          type: 'table',
          payload: {
            title: kind === 'receivable' ? 'أكبر الحسابات المدينة' : 'أكبر الحسابات الدائنة',
            columns: [
              { key: 'code', label: 'الرمز' },
              { key: 'name', label: 'الحساب' },
              { key: 'balanceIQD', label: 'الرصيد (د.ع)', type: 'money' },
              { key: 'balanceUSD', label: 'الرصيد ($)', type: 'money', currency: 'USD' },
            ],
            rows: top,
            action: { entity: 'account', idKey: 'accountId' },
            totalCount: rows.length,
          },
        },
      ],
      suggestions: ['تحليل أكبر حساب', 'كشف حساب لأحدها'],
    };
  }

  private async getTrialBalance(args: any, ctx: AiRequestContext): Promise<AiToolResult> {
    const tb: any = await this.reports.getTrialBalance(ctx.companyId);
    const limit = Math.min(Number(args.limit) || 20, 60);

    const accounts = (tb?.accounts || [])
      .filter((a: any) => toNumber(a.totalDebit) !== 0 || toNumber(a.totalCredit) !== 0)
      .sort((a: any, b: any) => Math.abs(toNumber(b.netBalance)) - Math.abs(toNumber(a.netBalance)));

    const rows = accounts.slice(0, limit).map((a: any) => ({
      code: a.code,
      name: a.nameAr,
      type: a.type,
      debit: round2(a.totalDebit),
      credit: round2(a.totalCredit),
      balance: round2(a.netBalance),
    }));

    return {
      ok: true,
      data: {
        grandTotalDebit: round2(tb?.grandTotalDebit),
        grandTotalCredit: round2(tb?.grandTotalCredit),
        isBalanced: tb?.isBalanced,
        difference: round2(toNumber(tb?.grandTotalDebit) - toNumber(tb?.grandTotalCredit)),
        activeAccounts: accounts.length,
        top: rows.slice(0, 12),
      },
      ui: [
        {
          type: 'kpi',
          payload: {
            title: 'ميزان المراجعة',
            items: [
              { label: 'إجمالي المدين', value: round2(tb?.grandTotalDebit) },
              { label: 'إجمالي الدائن', value: round2(tb?.grandTotalCredit) },
              {
                label: 'الحالة',
                value: tb?.isBalanced ? 'متوازن' : 'غير متوازن',
                type: 'text',
                emphasis: true,
              },
            ],
          },
        },
        {
          type: 'table',
          payload: {
            title: 'أكبر الحسابات حركةً',
            columns: [
              { key: 'code', label: 'الرمز' },
              { key: 'name', label: 'الحساب' },
              { key: 'debit', label: 'مدين', type: 'money' },
              { key: 'credit', label: 'دائن', type: 'money' },
              { key: 'balance', label: 'الرصيد', type: 'money' },
            ],
            rows,
            totalCount: accounts.length,
          },
        },
      ],
    };
  }

  private async getIncomeStatement(ctx: AiRequestContext): Promise<AiToolResult> {
    const is: any = await this.reports.getIncomeStatement(ctx.companyId);
    return {
      ok: true,
      data: {
        totalRevenues: round2(is?.totalRevenues),
        totalExpenses: round2(is?.totalExpenses),
        netProfit: round2(is?.netProfit),
        topRevenues: (is?.revenues || []).slice(0, 8).map((r: any) => ({ code: r.code, name: r.nameAr, amount: round2(r.amount) })),
        topExpenses: (is?.expenses || []).slice(0, 8).map((r: any) => ({ code: r.code, name: r.nameAr, amount: round2(r.amount) })),
      },
      ui: [
        {
          type: 'kpi',
          payload: {
            title: 'قائمة الدخل',
            items: [
              { label: 'الإيرادات', value: round2(is?.totalRevenues) },
              { label: 'المصروفات', value: round2(is?.totalExpenses) },
              { label: 'صافي الربح', value: round2(is?.netProfit), emphasis: true },
            ],
          },
        },
      ],
    };
  }

  private async getBalanceSheet(ctx: AiRequestContext): Promise<AiToolResult> {
    const bs: any = await this.reports.getBalanceSheet(ctx.companyId);
    return {
      ok: true,
      data: {
        totalAssets: round2(bs?.totalAssets),
        totalLiabilities: round2(bs?.totalLiabilities),
        totalEquity: round2(bs?.totalEquity),
        netProfitCurrentPeriod: round2(bs?.netProfitCurrentPeriod),
        isBalanced: bs?.isBalanced,
      },
      ui: [
        {
          type: 'kpi',
          payload: {
            title: 'الميزانية العمومية',
            items: [
              { label: 'الأصول', value: round2(bs?.totalAssets) },
              { label: 'الخصوم', value: round2(bs?.totalLiabilities) },
              { label: 'حقوق الملكية', value: round2(bs?.totalEquity) },
              { label: 'الحالة', value: bs?.isBalanced ? 'متوازنة' : 'غير متوازنة', type: 'text' },
            ],
          },
        },
      ],
    };
  }

  private async listAccounts(args: any, ctx: AiRequestContext): Promise<AiToolResult> {
    const limit = Math.min(Number(args.limit) || 25, 100);
    const rows = await this.prisma.account.findMany({
      where: {
        companyId: ctx.companyId,
        ...(args.type ? { type: args.type } : {}),
        ...(args.category ? { category: args.category } : {}),
      },
      select: {
        id: true,
        code: true,
        nameAr: true,
        type: true,
        category: true,
        isParent: true,
        currency: true,
      },
      orderBy: { code: 'asc' },
      take: limit,
    });

    return {
      ok: true,
      data: { count: rows.length, accounts: rows },
      ui: [
        {
          type: 'table',
          payload: {
            title: 'الحسابات',
            columns: [
              { key: 'code', label: 'الرمز' },
              { key: 'nameAr', label: 'الاسم' },
              { key: 'type', label: 'النوع' },
              { key: 'category', label: 'التصنيف' },
            ],
            rows,
            action: { entity: 'account', idKey: 'id' },
            totalCount: rows.length,
          },
        },
      ],
    };
  }
}
