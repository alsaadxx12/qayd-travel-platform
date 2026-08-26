import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JournalEntriesService } from '../../journal-entries/journal-entries.service';
import { AiPermissionService } from '../core/ai-permission.service';
import { AiRequestContext, AiTool, AiToolResult, AiToolProvider } from '../types/ai-tool.types';
import { isCreditTicket, resolvePeriod, round2 } from './tool-utils';

const TICKET_LIST_SELECT = {
  id: true,
  invoiceNumber: true,
  issueDate: true,
  travelDate: true,
  customerName: true,
  currency: true,
  paymentType: true,
  paymentMethod: true,
  tripType: true,
  airline: true,
  pnr: true,
  route: true,
  netSell: true,
  netBuy: true,
  profit: true,
  status: true,
  isAudited: true,
  branchId: true,
  supplierAccountName: true,
  customer: { select: { id: true, nameAr: true } },
  supplier: { select: { id: true, nameAr: true } },
  branch: { select: { id: true, nameAr: true } },
  passengers: { select: { name: true, ticketNumber: true, pnr: true } },
} as const;

/**
 * Operational tools over tickets (which also back visas, hotels, groups and refunds
 * via tripType), vouchers and journal entries.
 *
 * Tickets are queried through Prisma directly rather than TicketsService.findAll
 * because that method has no PNR / payment-type / free-text filters and returns
 * whole pages of rows the model does not need.
 */
@Injectable()
export class OperationsTools implements AiToolProvider {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journalEntries: JournalEntriesService,
    private readonly permissions: AiPermissionService,
  ) {}

  getTools(): AiTool[] {
    return [
      {
        name: 'searchTickets',
        description:
          'ابحث عن التذاكر/الحجوزات بالرقم أو PNR أو اسم المسافر أو العميل أو الفترة. تشمل التذاكر والتأشيرات والفنادق والمجموعات حسب tripType. Search tickets/bookings by PNR, invoice, passenger, customer or period.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'PNR أو رقم الفاتورة أو اسم المسافر أو العميل' },
            tripType: {
              type: 'string',
              description: 'نوع الخدمة: VISA للتأشيرات، HOTEL للفنادق، GROUP للمجموعات، REFUND للاسترجاع',
            },
            paymentStatus: {
              type: 'string',
              enum: ['ALL', 'UNPAID', 'PAID'],
              description: 'UNPAID تعني بيع آجل غير مسدد، PAID تعني نقدي',
            },
            branchId: { type: 'string' },
            period: { type: 'string', enum: ['TODAY', 'YESTERDAY', 'WEEK', 'MONTH', 'LAST_MONTH', 'QUARTER', 'YEAR'] },
            startDate: { type: 'string', description: 'YYYY-MM-DD' },
            endDate: { type: 'string', description: 'YYYY-MM-DD' },
            limit: { type: 'number' },
          },
          additionalProperties: false,
        },
        requiredPermissions: ['tickets.view', 'visas.view', 'hotels.view'],
        sensitivity: 'read',
        handler: (args, ctx) => this.searchTickets(args, ctx),
      },
      {
        name: 'getTicketDetails',
        description:
          'تفاصيل تذكرة أو حجز واحد بالمعرّف أو رقم الفاتورة: المسافرون، المورد، البيع والتكلفة والربح وحالة الدفع. Full details of one ticket/booking.',
        parameters: {
          type: 'object',
          properties: {
            ticketId: { type: 'string', description: 'المعرّف أو رقم الفاتورة' },
          },
          required: ['ticketId'],
          additionalProperties: false,
        },
        requiredPermissions: ['tickets.view', 'visas.view', 'hotels.view'],
        sensitivity: 'read',
        handler: (args, ctx) => this.getTicketDetails(args, ctx),
      },
      {
        name: 'getVisas',
        description:
          'اعرض معاملات التأشيرات (tripType=VISA) خلال فترة أو بالبحث. List visa transactions stored as tickets with tripType VISA.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            period: { type: 'string', enum: ['TODAY', 'YESTERDAY', 'WEEK', 'MONTH', 'LAST_MONTH', 'QUARTER', 'YEAR'] },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            branchId: { type: 'string' },
            limit: { type: 'number' },
          },
          additionalProperties: false,
        },
        requiredPermissions: ['visas.view', 'tickets.view'],
        sensitivity: 'read',
        handler: (args, ctx) => this.searchTickets({ ...args, tripType: 'VISA' }, ctx),
      },
      {
        name: 'getHotelBookings',
        description:
          'اعرض الحجوزات الفندقية (tripType=HOTEL) خلال فترة أو بالبحث. List hotel bookings stored as tickets with tripType HOTEL.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            period: { type: 'string', enum: ['TODAY', 'YESTERDAY', 'WEEK', 'MONTH', 'LAST_MONTH', 'QUARTER', 'YEAR'] },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            branchId: { type: 'string' },
            limit: { type: 'number' },
          },
          additionalProperties: false,
        },
        requiredPermissions: ['hotels.view', 'tickets.view'],
        sensitivity: 'read',
        handler: (args, ctx) => this.searchTickets({ ...args, tripType: 'HOTEL' }, ctx),
      },
      {
        name: 'getUnpaidTickets',
        description:
          'اعرض التذاكر والحجوزات غير المسددة (البيع الآجل) خلال فترة. استخدمها لأسئلة «التذاكر غير المسددة» و«الغير مسددة اليوم». Unpaid (credit) tickets for a period.',
        parameters: {
          type: 'object',
          properties: {
            period: { type: 'string', enum: ['TODAY', 'YESTERDAY', 'WEEK', 'MONTH', 'LAST_MONTH', 'QUARTER', 'YEAR'] },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            branchId: { type: 'string' },
            limit: { type: 'number' },
          },
          additionalProperties: false,
        },
        requiredPermissions: ['tickets.view'],
        sensitivity: 'read',
        handler: (args, ctx) => this.searchTickets({ ...args, paymentStatus: 'UNPAID' }, ctx),
      },
      {
        name: 'searchVouchers',
        description:
          'ابحث في سندات القبض والدفع بالرقم أو الحساب أو الفترة أو العملة. سندات المصروف = PAYMENT. Search receipt and payment vouchers; payment vouchers can be filtered by IQD or USD.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'رقم السند أو اسم الحساب أو المرجع' },
            accountId: { type: 'string', description: 'حصر السندات بحساب معين' },
            voucherType: { type: 'string', enum: ['ALL', 'RECEIPT', 'PAYMENT'] },
            currency: { type: 'string', enum: ['IQD', 'USD'], description: 'عملة سند الدفع فقط' },
            period: { type: 'string', enum: ['TODAY', 'WEEK', 'MONTH', 'LAST_MONTH', 'QUARTER', 'YEAR'] },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            limit: { type: 'number' },
          },
          additionalProperties: false,
        },
        requiredPermissions: ['vouchers.view'],
        sensitivity: 'read',
        handler: (args, ctx) => this.searchVouchers(args, ctx),
      },
      {
        name: 'searchJournalEntries',
        description:
          'ابحث في القيود اليومية بالرقم أو الوصف أو الحساب. Search journal entries by number, description or account.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            accountId: { type: 'string' },
            status: { type: 'string', enum: ['DRAFT', 'POSTED', 'CANCELLED'] },
            limit: { type: 'number' },
          },
          additionalProperties: false,
        },
        requiredPermissions: ['journal.view'],
        sensitivity: 'read',
        handler: (args, ctx) => this.searchJournalEntries(args, ctx),
      },
      {
        name: 'explainJournalEntry',
        description:
          'اشرح قيدًا محاسبيًا: أطرافه المدينة والدائنة وتوازنه ومصدره وهل فيه خلل. استخدمها لأسئلة «اشرح هذه الحركة» و«هل يوجد خطأ في هذا القيد». Explain a journal entry and check it balances.',
        parameters: {
          type: 'object',
          properties: { entryId: { type: 'string', description: 'المعرّف أو رقم القيد' } },
          required: ['entryId'],
          additionalProperties: false,
        },
        requiredPermissions: ['journal.view'],
        sensitivity: 'read',
        handler: (args, ctx) => this.explainJournalEntry(args, ctx),
      },
      {
        name: 'findUnbalancedJournalEntries',
        description:
          'امسح القيود غير المتوازنة (مدين ≠ دائن) دون الحاجة لرقم قيد. استخدمها لـ «القيود غير المتوازنة». Do NOT invent a balanced flag on other tools.',
        parameters: {
          type: 'object',
          properties: { limit: { type: 'number' } },
          additionalProperties: false,
        },
        requiredPermissions: ['journal.view'],
        sensitivity: 'read',
        handler: (args, ctx) => this.findUnbalancedJournalEntries(args, ctx),
      },
      {
        name: 'proposeJournalBalanceFix',
        description:
          'اقترح طرفًا يوازن قيدًا غير متوازن دون ترحيل. يحتاج رقم القيد وحساب الطرف المقترح. Propose a balancing line; does not post.',
        parameters: {
          type: 'object',
          properties: {
            entryId: { type: 'string', description: 'المعرّف أو رقم القيد' },
            accountId: { type: 'string', description: 'حساب الطرف المقترح من searchEntity' },
          },
          required: ['entryId'],
          additionalProperties: false,
        },
        requiredPermissions: ['journal.view'],
        sensitivity: 'read',
        handler: (args, ctx) => this.proposeJournalBalanceFix(args, ctx),
      },
      {
        name: 'applyJournalBalanceFix',
        description:
          'نفّذ موازنة قيد مسودة فقط بعد موافقة المستخدم الصريحة (confirm=true). لا تعدّل قيدًا مرحّلًا. Apply a balancing line to a DRAFT entry after the user confirms.',
        parameters: {
          type: 'object',
          properties: {
            entryId: { type: 'string' },
            accountId: { type: 'string' },
            confirm: { type: 'boolean', description: 'يجب أن تكون true بعد أن يقول المستخدم نفّذ أو تأكيد' },
          },
          required: ['entryId', 'accountId', 'confirm'],
          additionalProperties: false,
        },
        requiredPermissions: ['journal.update', 'journal.create'],
        sensitivity: 'write',
        handler: (args, ctx) => this.applyJournalBalanceFix(args, ctx),
      },
    ];
  }

  private buildBranchFilter(ctx: AiRequestContext, requested?: string) {
    const resolved = this.permissions.resolveBranchId(ctx, requested || ctx.activeBranchId);
    if (resolved) return { branchId: resolved };

    const visible = this.permissions.visibleBranchIds(ctx);
    if (visible && visible.length) {
      return { OR: [{ branchId: { in: visible } }, { branchId: null }] };
    }
    return {};
  }

  private async searchTickets(args: any, ctx: AiRequestContext): Promise<AiToolResult> {
    const limit = Math.min(Number(args.limit) || 25, 100);
    const hasPeriod = Boolean(args.period || (args.startDate && args.endDate));
    const period = hasPeriod ? resolvePeriod(args, ctx) : null;
    const query = (args.query || '').trim();

    const where: any = {
      companyId: ctx.companyId,
      ...this.buildBranchFilter(ctx, args.branchId),
    };

    if (period) {
      where.issueDate = {
        gte: new Date(`${period.startDate}T00:00:00.000Z`),
        lte: new Date(`${period.endDate}T23:59:59.999Z`),
      };
    }

    if (args.tripType) {
      where.tripType = args.tripType;
    }

    if (query) {
      const contains = { contains: query, mode: 'insensitive' as const };
      where.OR = [
        { invoiceNumber: contains },
        { pnr: contains },
        { customerName: contains },
        { route: contains },
        { airline: contains },
        { reference: contains },
        { passengers: { some: { OR: [{ name: contains }, { ticketNumber: contains }, { pnr: contains }] } } },
        { customer: { nameAr: contains } },
      ];
    }

    const rows = await this.prisma.ticket.findMany({
      where,
      select: TICKET_LIST_SELECT,
      orderBy: { issueDate: 'desc' },
      // Payment status is derived in JS, so over-fetch before filtering.
      take: args.paymentStatus && args.paymentStatus !== 'ALL' ? limit * 6 : limit,
    });

    let filtered = rows;
    if (args.paymentStatus === 'UNPAID') {
      filtered = rows.filter((t) => isCreditTicket(t.paymentType));
    } else if (args.paymentStatus === 'PAID') {
      filtered = rows.filter((t) => !isCreditTicket(t.paymentType));
    }
    filtered = filtered.slice(0, limit);

    if (!filtered.length) {
      return {
        ok: true,
        data: {
          found: false,
          message: 'لم أجد أي عملية مطابقة لهذه البيانات',
          filters: { query, tripType: args.tripType, paymentStatus: args.paymentStatus, period: period?.label },
        },
        note: 'لا نتائج',
      };
    }

    const mapped = filtered.map((t) => ({
      id: t.id,
      invoiceNumber: t.invoiceNumber,
      issueDate: t.issueDate,
      customer: t.customer?.nameAr || t.customerName || '-',
      supplier: t.supplier?.nameAr || t.supplierAccountName || '-',
      airline: t.airline,
      pnr: t.pnr || t.passengers?.[0]?.pnr || null,
      route: t.route,
      tripType: t.tripType,
      passenger: t.passengers?.[0]?.name || null,
      passengersCount: t.passengers?.length || 0,
      currency: t.currency,
      sell: round2(t.netSell),
      cost: round2(t.netBuy),
      profit: round2(t.profit),
      paymentType: t.paymentType,
      paymentStatus: isCreditTicket(t.paymentType) ? 'آجل (غير مسدد)' : 'نقدي (مسدد)',
      status: t.status,
      branch: t.branch?.nameAr || null,
    }));

    const totals = {
      count: mapped.length,
      totalSell: round2(mapped.reduce((s, t) => s + t.sell, 0)),
      totalProfit: round2(mapped.reduce((s, t) => s + t.profit, 0)),
    };

    // A single hit is almost always "open this booking", so render the rich card.
    if (mapped.length === 1) {
      const one = mapped[0];
      return {
        ok: true,
        data: { found: true, count: 1, ticket: one },
        ui: [{ type: 'ticket_card', payload: one }],
        suggestions: ['تفاصيل أكثر', 'حركات حساب العميل'],
      };
    }

    return {
      ok: true,
      data: {
        found: true,
        ...totals,
        period: period?.label,
        tickets: mapped.slice(0, 12),
        truncated: mapped.length > 12,
      },
      ui: [
        {
          type: 'table',
          payload: {
            title: period ? `العمليات — ${period.label}` : 'نتائج البحث',
            columns: [
              { key: 'invoiceNumber', label: 'الفاتورة' },
              { key: 'pnr', label: 'PNR' },
              { key: 'customer', label: 'العميل' },
              { key: 'passenger', label: 'المسافر' },
              { key: 'sell', label: 'المبلغ', type: 'money', currencyKey: 'currency' },
              { key: 'paymentStatus', label: 'الحالة', type: 'badge' },
            ],
            rows: mapped,
            action: { entity: 'ticket', idKey: 'id' },
            totalCount: mapped.length,
            footer: totals,
          },
        },
      ],
      suggestions: ['أكبر مبلغ', 'حسب العميل', 'أرباح هذه العمليات'],
    };
  }

  private async getTicketDetails(args: any, ctx: AiRequestContext): Promise<AiToolResult> {
    const key = (args.ticketId || '').trim();
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        companyId: ctx.companyId,
        OR: [{ id: key }, { invoiceNumber: key }, { pnr: key }],
      },
      include: {
        passengers: true,
        customer: { select: { id: true, nameAr: true, accountId: true } },
        supplier: { select: { id: true, nameAr: true, accountId: true } },
        branch: { select: { id: true, nameAr: true } },
        airlineRef: { select: { id: true, nameAr: true } },
      },
    });

    if (!ticket) {
      return {
        ok: false,
        data: { found: false, message: `لم أجد عملية بالمعرّف أو الرقم "${key}"` },
        note: 'لا نتائج',
      };
    }

    const payload = {
      id: ticket.id,
      invoiceNumber: ticket.invoiceNumber,
      issueDate: ticket.issueDate,
      travelDate: ticket.travelDate,
      tripType: ticket.tripType,
      pnr: ticket.pnr || ticket.passengers?.[0]?.pnr || null,
      route: ticket.route,
      airline: ticket.airlineRef?.nameAr || ticket.airline,
      customer: ticket.customer?.nameAr || ticket.customerName || '-',
      customerAccountId: ticket.customer?.accountId || ticket.customerAccountId,
      supplier: ticket.supplier?.nameAr || ticket.supplierAccountName || '-',
      supplierAccountId: ticket.supplier?.accountId || ticket.supplierAccountId,
      branch: ticket.branch?.nameAr || null,
      currency: ticket.currency,
      exchangeRate: ticket.exchangeRate,
      sell: round2(ticket.netSell),
      cost: round2(ticket.netBuy),
      discount: round2(ticket.discountAmount),
      profit: round2(ticket.profit),
      paymentType: ticket.paymentType,
      paymentMethod: ticket.paymentMethod,
      paymentStatus: isCreditTicket(ticket.paymentType) ? 'آجل (غير مسدد)' : 'نقدي (مسدد)',
      status: ticket.status,
      isAudited: ticket.isAudited,
      passengers: ticket.passengers.map((p) => ({
        name: p.name,
        type: p.ticketType,
        ticketNumber: p.ticketNumber,
        pnr: p.pnr,
        fareSell: round2(p.fareSell),
        fareBuy: round2(p.fareBuy),
        status: p.status,
      })),
    };

    return {
      ok: true,
      data: { found: true, ticket: payload },
      ui: [{ type: 'ticket_card', payload }],
      suggestions: ['كشف حساب العميل', 'لماذا هذه العملية غير مدفوعة؟'],
    };
  }

  private async searchVouchers(args: any, ctx: AiRequestContext): Promise<AiToolResult> {
    const limit = Math.min(Number(args.limit) || 20, 100);
    const type = (args.voucherType || 'ALL').toUpperCase();
    const hasPeriod = Boolean(args.period || (args.startDate && args.endDate));
    const period = hasPeriod ? resolvePeriod(args, ctx) : null;
    const query = (args.query || '').trim();

    const dateFilter = period
      ? {
          date: {
            gte: new Date(`${period.startDate}T00:00:00.000Z`),
            lte: new Date(`${period.endDate}T23:59:59.999Z`),
          },
        }
      : {};

    const contains = query ? { contains: query, mode: 'insensitive' as const } : undefined;
    const textFilter = contains
      ? {
          OR: [
            { voucherNumber: contains },
            { description: contains },
            { reference: contains },
            { account: { nameAr: contains } },
          ],
        }
      : {};

    const accountFilter = args.accountId
      ? { OR: [{ accountId: args.accountId }, { cashboxOrBankAccountId: args.accountId }] }
      : {};

    const include = {
      account: { select: { id: true, code: true, nameAr: true } },
      cashboxOrBank: { select: { id: true, nameAr: true } },
    };

    const [receipts, payments] = await Promise.all([
      type === 'PAYMENT' || args.currency
        ? Promise.resolve([])
        : this.prisma.receiptVoucher.findMany({
            where: { companyId: ctx.companyId, ...dateFilter, ...textFilter, ...accountFilter },
            include,
            orderBy: { date: 'desc' },
            take: limit,
          }),
      type === 'RECEIPT'
        ? Promise.resolve([])
        : this.prisma.paymentVoucher.findMany({
            where: {
              companyId: ctx.companyId,
              ...dateFilter,
              ...textFilter,
              ...accountFilter,
              ...(args.currency ? { currency: String(args.currency).toUpperCase() } : {}),
            },
            include,
            orderBy: { date: 'desc' },
            take: limit,
          }),
    ]);

    const rows = [
      ...receipts.map((v: any) => ({
        id: v.id,
        type: 'RECEIPT',
        typeLabel: 'سند قبض',
        number: v.voucherNumber,
        date: v.date,
        amount: round2(v.amount),
        currency: 'IQD',
        account: v.account?.nameAr,
        accountId: v.account?.id,
        counterAccount: v.cashboxOrBank?.nameAr,
        description: v.description,
        status: v.status,
      })),
      ...payments.map((v: any) => ({
        id: v.id,
        type: 'PAYMENT',
        typeLabel: 'سند دفع',
        number: v.voucherNumber,
        date: v.date,
        amount: round2(v.amount),
        currency: v.currency || 'IQD',
        account: v.account?.nameAr,
        accountId: v.account?.id,
        counterAccount: v.cashboxOrBank?.nameAr,
        description: v.description,
        status: v.status,
      })),
    ]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);

    if (!rows.length) {
      return {
        ok: true,
        data: { found: false, message: 'لم أجد سندات مطابقة لهذه البيانات' },
        note: 'لا نتائج',
      };
    }

    return {
      ok: true,
      data: {
        found: true,
        count: rows.length,
        period: period?.label,
        totalReceipts: round2(rows.filter((r) => r.type === 'RECEIPT').reduce((s, r) => s + r.amount, 0)),
        totalPayments: round2(rows.filter((r) => r.type === 'PAYMENT').reduce((s, r) => s + r.amount, 0)),
        vouchers: rows.slice(0, 12),
      },
      ui: [
        {
          type: 'table',
          payload: {
            title: 'السندات',
            columns: [
              { key: 'typeLabel', label: 'النوع', type: 'badge' },
              { key: 'number', label: 'الرقم' },
              { key: 'date', label: 'التاريخ', type: 'date' },
              { key: 'account', label: 'الحساب' },
              { key: 'amount', label: 'المبلغ', type: 'money', currencyKey: 'currency' },
            ],
            rows,
            action: { entity: 'voucher', idKey: 'id' },
            totalCount: rows.length,
          },
        },
      ],
    };
  }

  private async searchJournalEntries(args: any, ctx: AiRequestContext): Promise<AiToolResult> {
    const limit = Math.min(Number(args.limit) || 15, 50);
    const entries: any[] = await this.journalEntries.findAll(
      ctx.companyId,
      args.status,
      args.query,
      args.accountId,
      String(limit),
    );

    if (!entries?.length) {
      return { ok: true, data: { found: false, message: 'لم أجد قيودًا مطابقة' }, note: 'لا نتائج' };
    }

    const rows = entries.slice(0, limit).map((e) => ({
      id: e.id,
      entryNumber: e.entryNumber,
      date: e.date,
      description: e.description,
      status: e.status,
      totalDebit: round2(e.totalDebit),
      totalCredit: round2(e.totalCredit),
      linesCount: e.lines?.length || 0,
    }));

    return {
      ok: true,
      data: { found: true, count: rows.length, entries: rows.slice(0, 12) },
      ui: [
        {
          type: 'table',
          payload: {
            title: 'القيود اليومية',
            columns: [
              { key: 'entryNumber', label: 'رقم القيد' },
              { key: 'date', label: 'التاريخ', type: 'date' },
              { key: 'description', label: 'البيان' },
              { key: 'totalDebit', label: 'مدين', type: 'money' },
              { key: 'totalCredit', label: 'دائن', type: 'money' },
              { key: 'status', label: 'الحالة', type: 'badge' },
            ],
            rows,
            action: { entity: 'journal', idKey: 'id' },
            totalCount: rows.length,
          },
        },
      ],
    };
  }

  private async explainJournalEntry(args: any, ctx: AiRequestContext): Promise<AiToolResult> {
    const key = (args.entryId || '').trim();

    const entry = await this.prisma.journalEntry.findFirst({
      where: { companyId: ctx.companyId, OR: [{ id: key }, { entryNumber: key }] },
      include: {
        lines: { include: { account: { select: { id: true, code: true, nameAr: true, type: true } } } },
      },
    });

    if (!entry) {
      return { ok: false, data: { found: false, message: `لم أجد قيدًا بالرقم "${key}"` }, note: 'لا نتائج' };
    }

    const lines = entry.lines.map((l) => ({
      accountCode: l.account?.code,
      accountName: l.account?.nameAr,
      accountType: l.account?.type,
      debit: round2(l.debit),
      credit: round2(l.credit),
      description: l.description,
    }));

    const totalDebit = round2(lines.reduce((s, l) => s + l.debit, 0));
    const totalCredit = round2(lines.reduce((s, l) => s + l.credit, 0));
    const difference = round2(totalDebit - totalCredit);

    const issues: string[] = [];
    if (Math.abs(difference) > 0.01) issues.push(`القيد غير متوازن بفارق ${difference}`);
    if (!lines.length) issues.push('القيد لا يحتوي أي أطراف');
    if (lines.some((l) => l.debit === 0 && l.credit === 0)) issues.push('يوجد طرف بقيمة صفرية');
    if (lines.some((l) => l.debit > 0 && l.credit > 0)) issues.push('يوجد طرف مدين ودائن في نفس السطر');

    return {
      ok: true,
      data: {
        found: true,
        entry: {
          entryNumber: entry.entryNumber,
          date: entry.date,
          description: entry.description,
          status: entry.status,
          reference: entry.reference,
          sourceType: entry.sourceType,
          isSystemGenerated: entry.isSystemGenerated,
          isReversed: entry.isReversed,
        },
        lines,
        totalDebit,
        totalCredit,
        difference,
        isBalanced: Math.abs(difference) <= 0.01,
        issues,
        instruction:
          'اشرح القيد بلغة محاسبية واضحة: ماذا يمثل كل طرف مدين ودائن ولماذا. إذا كانت issues غير فارغة فنبّه المستخدم إليها. لا تعدّل القيد هنا؛ للموازنة استخدم proposeJournalBalanceFix ثم applyJournalBalanceFix بعد تأكيد المستخدم إن كان DRAFT.',
      },
      ui: [
        {
          type: 'journal_card',
          payload: {
            entryNumber: entry.entryNumber,
            date: entry.date,
            description: entry.description,
            status: entry.status,
            totalDebit,
            totalCredit,
            isBalanced: Math.abs(difference) <= 0.01,
            issues,
            lines,
          },
        },
      ],
    };
  }

  private async findUnbalancedJournalEntries(args: any, ctx: AiRequestContext): Promise<AiToolResult> {
    const limit = Math.min(Number(args.limit) || 40, 80);
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        entryNumber: string;
        date: Date;
        description: string;
        status: string;
        totalDebit: any;
        totalCredit: any;
      }>
    >`
      SELECT id, entry_number AS "entryNumber", date, description, status,
             total_debit AS "totalDebit", total_credit AS "totalCredit"
      FROM journal_entries
      WHERE company_id = ${ctx.companyId}
        AND status <> 'CANCELLED'
        AND ABS(total_debit - total_credit) > 0.009
      ORDER BY date DESC
      LIMIT 80
    `;

    const mapped = (rows || []).slice(0, limit).map((e) => {
      const debit = round2(e.totalDebit);
      const credit = round2(e.totalCredit);
      return {
        id: e.id,
        entryNumber: e.entryNumber,
        date: e.date,
        description: e.description,
        status: e.status,
        totalDebit: debit,
        totalCredit: credit,
        difference: round2(debit - credit),
      };
    });

    if (!mapped.length) {
      return {
        ok: true,
        data: { found: false, count: 0, message: 'لا توجد قيود غير متوازنة في السجلات' },
      };
    }

    return {
      ok: true,
      data: { found: true, count: mapped.length, entries: mapped.slice(0, 20) },
      ui: [
        {
          type: 'table',
          payload: {
            title: 'قيود غير متوازنة',
            columns: [
              { key: 'entryNumber', label: 'رقم القيد' },
              { key: 'date', label: 'التاريخ', type: 'date' },
              { key: 'description', label: 'البيان' },
              { key: 'totalDebit', label: 'مدين', type: 'money' },
              { key: 'totalCredit', label: 'دائن', type: 'money' },
              { key: 'difference', label: 'الفرق', type: 'money' },
              { key: 'status', label: 'الحالة', type: 'badge' },
            ],
            rows: mapped,
            action: { entity: 'journal', idKey: 'id' },
            totalCount: mapped.length,
          },
        },
      ],
      suggestions: mapped[0]?.status === 'DRAFT' ? ['اقترح موازنة أول قيد مسودة'] : ['اشرح أول قيد'],
    };
  }

  private async loadEntry(ctx: AiRequestContext, key: string) {
    return this.prisma.journalEntry.findFirst({
      where: { companyId: ctx.companyId, OR: [{ id: key }, { entryNumber: key }] },
      include: {
        lines: { include: { account: { select: { id: true, code: true, nameAr: true } } } },
      },
    });
  }

  private balancingLine(entry: { lines: Array<{ debit: any; credit: any }> }, accountId: string) {
    const totalDebit = round2(entry.lines.reduce((s, l) => s + Number(l.debit || 0), 0));
    const totalCredit = round2(entry.lines.reduce((s, l) => s + Number(l.credit || 0), 0));
    const difference = round2(totalDebit - totalCredit);
    const amount = round2(Math.abs(difference));
    const side = difference > 0.01 ? 'credit' : difference < -0.01 ? 'debit' : 'none';
    return {
      totalDebit,
      totalCredit,
      difference,
      amount,
      side,
      line:
        side === 'none'
          ? null
          : {
              accountId,
              debit: side === 'debit' ? amount : 0,
              credit: side === 'credit' ? amount : 0,
              description: 'تسوية توازن القيد',
            },
    };
  }

  private async proposeJournalBalanceFix(args: any, ctx: AiRequestContext): Promise<AiToolResult> {
    const key = (args.entryId || '').trim();
    const entry = await this.loadEntry(ctx, key);
    if (!entry) return { ok: false, data: { found: false, message: `لم أجد قيدًا بالرقم "${key}"` } };

    const preview = this.balancingLine(entry, args.accountId || '');
    if (preview.side === 'none') {
      return { ok: true, data: { found: true, isBalanced: true, message: 'القيد متوازن ولا يحتاج تسوية' } };
    }

    if (entry.status === 'POSTED') {
      return {
        ok: true,
        data: {
          found: true,
          isBalanced: false,
          writable: false,
          entryNumber: entry.entryNumber,
          status: entry.status,
          ...preview,
          message:
            'القيد مرحّل. لن أعدّله تلقائيًا. اعكسه من شاشة القيود أو أنشئ قيد تسوية يدويًا بالطرف المقترح.',
        },
      };
    }

    if (!args.accountId) {
      return {
        ok: true,
        data: {
          found: true,
          writable: entry.status === 'DRAFT',
          entryNumber: entry.entryNumber,
          status: entry.status,
          totalDebit: preview.totalDebit,
          totalCredit: preview.totalCredit,
          difference: preview.difference,
          neededSide: preview.side,
          amount: preview.amount,
          message: 'حدد حساب الطرف المقترح عبر searchEntity ثم أعد الاقتراح.',
        },
      };
    }

    const account = await this.prisma.account.findFirst({
      where: { id: args.accountId, companyId: ctx.companyId },
      select: { id: true, code: true, nameAr: true },
    });
    if (!account) return { ok: false, data: { found: false, message: 'الحساب المقترح غير موجود' } };

    return {
      ok: true,
      data: {
        found: true,
        writable: entry.status === 'DRAFT',
        entryNumber: entry.entryNumber,
        status: entry.status,
        account,
        ...preview,
        instruction:
          'اعرض الاقتراح على المستخدم. لا تستدع applyJournalBalanceFix إلا بعد أن يقول نفّذ أو تأكيد.',
      },
      suggestions: entry.status === 'DRAFT' ? ['نفّذ الموازنة على المسودة'] : [],
    };
  }

  private async applyJournalBalanceFix(args: any, ctx: AiRequestContext): Promise<AiToolResult> {
    if (args.confirm !== true) {
      return {
        ok: false,
        data: { applied: false, message: 'لم يتم التنفيذ. يلزم تأكيد صريح من المستخدم (confirm=true).' },
      };
    }

    const key = (args.entryId || '').trim();
    const entry = await this.loadEntry(ctx, key);
    if (!entry) return { ok: false, data: { found: false, message: `لم أجد قيدًا بالرقم "${key}"` } };
    if (entry.status !== 'DRAFT') {
      return {
        ok: false,
        data: {
          applied: false,
          status: entry.status,
          message: 'لا أعدّل قيدًا مرحّلًا أو ملغى. الموازنة التلقائية للمسودات فقط.',
        },
      };
    }

    const preview = this.balancingLine(entry, args.accountId);
    if (!preview.line) {
      return { ok: true, data: { applied: false, message: 'القيد متوازن أصلًا' } };
    }

    const account = await this.prisma.account.findFirst({
      where: { id: args.accountId, companyId: ctx.companyId },
      select: { id: true },
    });
    if (!account) return { ok: false, data: { applied: false, message: 'الحساب غير موجود' } };

    const lines = [
      ...entry.lines.map((l) => ({
        accountId: l.accountId,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        description: l.description || undefined,
      })),
      preview.line,
    ];

    await this.journalEntries.update(entry.id, ctx.companyId, { lines });
    return {
      ok: true,
      data: {
        applied: true,
        entryNumber: entry.entryNumber,
        added: preview.line,
        message: `تمت موازنة المسودة ${entry.entryNumber} بطرف ${preview.side === 'debit' ? 'مدين' : 'دائن'} بمبلغ ${preview.amount}.`,
      },
    };
  }
}
