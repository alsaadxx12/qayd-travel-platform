import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, AccountCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parseLegacySplitMarker } from '../vouchers/voucher-splits';

@Injectable()
export class ReportsService {
  private debtsCache = new Map<string, { data: unknown; timestamp: number }>();
  private readonly DEBTS_CACHE_TTL = 30_000;

  constructor(private prisma: PrismaService) {}

  async getDebtsReport(companyId: string) {
    const cached = this.debtsCache.get(companyId);
    if (cached && Date.now() - cached.timestamp < this.DEBTS_CACHE_TTL) {
      return cached.data;
    }

    const accounts = await this.prisma.account.findMany({
      where: {
        companyId,
        isParent: false,
        category: { in: [AccountCategory.CUSTOMER, AccountCategory.SUPPLIER] },
      },
      select: {
        id: true,
        code: true,
        nameAr: true,
        nameEn: true,
        category: true,
        type: true,
        currency: true,
        phone: true,
        email: true,
        address: true,
        customer: {
          select: {
            phone: true,
            email: true,
            address: true,
          },
        },
        supplier: {
          select: {
            phone: true,
            email: true,
            address: true,
          },
        },
      },
      orderBy: { code: 'asc' },
    });

    type TotalsRow = {
      accountId: string;
      currency: string;
      debit: Prisma.Decimal | number | null;
      credit: Prisma.Decimal | number | null;
    };

    let totals: TotalsRow[] = [];
    if (accounts.length > 0) {
      totals = await this.prisma.$queryRaw<TotalsRow[]>(Prisma.sql`
        SELECT
          l."accountId" AS "accountId",
          CASE
            WHEN e.reference LIKE 'OPENING-USD-%' THEN 'USD'
            WHEN l.description ILIKE '%USD%' OR e.reference ILIKE '%USD%' OR e.description ILIKE '%USD%' THEN 'USD'
            ELSE 'IQD'
          END AS currency,
          SUM(l.debit) AS debit,
          SUM(l.credit) AS credit
        FROM journal_entry_lines l
        INNER JOIN journal_entries e ON e.id = l."journalEntryId"
        WHERE e."companyId" = ${companyId}
          AND e.status = 'POSTED'
          AND l."accountId" IN (${Prisma.join(accounts.map((account) => account.id))})
        GROUP BY 1, 2
      `);
    }

    const totalsByAccount = new Map<string, { debitUSD: number; creditUSD: number; debitIQD: number; creditIQD: number }>();
    const ensureTotals = (id: string) => {
      let current = totalsByAccount.get(id);
      if (!current) {
        current = { debitUSD: 0, creditUSD: 0, debitIQD: 0, creditIQD: 0 };
        totalsByAccount.set(id, current);
      }
      return current;
    };

    totals.forEach((row) => {
      const bucket = ensureTotals(row.accountId);
      const debit = Number(row.debit || 0);
      const credit = Number(row.credit || 0);
      if ((row.currency || '').toUpperCase() === 'USD') {
        bucket.debitUSD += debit;
        bucket.creditUSD += credit;
      } else {
        bucket.debitIQD += debit;
        bucket.creditIQD += credit;
      }
    });

    const rows = accounts.map((account) => {
      const bucket = totalsByAccount.get(account.id) || {
        debitUSD: 0,
        creditUSD: 0,
        debitIQD: 0,
        creditIQD: 0,
      };
      const endingBalanceUSD = bucket.debitUSD - bucket.creditUSD;
      const endingBalanceIQD = bucket.debitIQD - bucket.creditIQD;
      const accCurrStr = (account.currency || '').toString().toUpperCase();
      const isExplicitIQD = accCurrStr.includes('IQD') || accCurrStr.includes('د.ع');
      const hasIQDBal = Math.abs(endingBalanceIQD) > 0.01;
      const accountCurrency: 'USD' | 'IQD' = hasIQDBal || isExplicitIQD ? 'IQD' : 'USD';

      let debtType: 'receivable' | 'payable' | 'zero' = 'zero';
      let debtLabel = 'متعادل';
      if (endingBalanceIQD > 0.01 || endingBalanceUSD > 0.01) {
        debtType = 'receivable';
        debtLabel = 'ديون لنا (مدين)';
      } else if (endingBalanceIQD < -0.01 || endingBalanceUSD < -0.01) {
        debtType = 'payable';
        debtLabel = 'ديون علينا (دائن)';
      }

      return {
        id: account.id,
        code: account.code || '—',
        nameAr: account.nameAr || 'حساب بدون اسم',
        nameEn: account.nameEn,
        category: account.category,
        type: account.type,
        debitUSD: bucket.debitUSD,
        creditUSD: bucket.creditUSD,
        endingBalanceUSD,
        debitIQD: bucket.debitIQD,
        creditIQD: bucket.creditIQD,
        endingBalanceIQD,
        totalDebit: bucket.debitIQD || bucket.debitUSD,
        totalCredit: bucket.creditIQD || bucket.creditUSD,
        endingBalance: endingBalanceIQD !== 0 ? endingBalanceIQD : endingBalanceUSD,
        debtType,
        debtLabel,
        accountCurrency,
        phone: account.phone || account.customer?.phone || account.supplier?.phone || null,
        email: account.email || account.customer?.email || account.supplier?.email || null,
        address: account.address || account.customer?.address || account.supplier?.address || null,
      };
    });

    const payload = { rows, generatedAt: new Date().toISOString() };
    this.debtsCache.set(companyId, { data: payload, timestamp: Date.now() });
    return payload;
  }


  private inferTraceCurrency(
    accountCurrency?: string | null,
    sourceCurrency?: string | null,
    ...textParts: Array<string | null | undefined>
  ) {
    const normalize = (value?: string | null) => (value || '').trim().toUpperCase();
    const source = normalize(sourceCurrency);
    if (source.includes('USD') || source.includes('$') || source.includes('دولار')) {
      return { currency: 'USD', confidence: 'SOURCE' as const };
    }
    if (source.includes('IQD') || source.includes('د.ع') || source.includes('دينار')) {
      return { currency: 'IQD', confidence: 'SOURCE' as const };
    }

    const text = normalize(textParts.filter(Boolean).join(' '));
    if (text.includes('USD') || text.includes('$') || text.includes('دولار')) {
      return { currency: 'USD', confidence: 'REFERENCE_INFERENCE' as const };
    }
    if (text.includes('IQD') || text.includes('د.ع') || text.includes('دينار')) {
      return { currency: 'IQD', confidence: 'REFERENCE_INFERENCE' as const };
    }

    const account = normalize(accountCurrency);
    return {
      currency: account.includes('USD') || account.includes('$') ? 'USD' : 'IQD',
      confidence: 'ACCOUNT_DEFAULT' as const,
    };
  }

  private resolveServiceTraceType(ticket: any, sourceType?: string | null) {
    const text = [
      sourceType,
      ticket?.tripType,
      ticket?.invoiceNumber,
      ticket?.reference,
      ticket?.airline,
      ticket?.notes,
    ]
      .filter(Boolean)
      .join(' ')
      .toUpperCase();

    if (ticket?.status === 'REFUNDED' || text.includes('REFUND') || text.includes('استرجاع')) {
      return { type: 'REFUND', label: 'استرجاع خدمة' };
    }
    if (text.includes('VISA') || text.includes('فيزا') || text.includes('تأشير')) {
      return { type: 'VISA', label: 'خدمة تأشيرة' };
    }
    if (text.includes('HOTEL') || text.includes('فندق') || text.includes('إقامة') || text.includes('اقامة')) {
      return { type: 'HOTEL', label: 'حجز فندق' };
    }
    if (text.includes('GROUP') || text.includes('كروب') || text.includes('برنامج') || text.includes('سياحي')) {
      return { type: 'GROUP', label: 'برنامج سياحي' };
    }
    if (text.includes('REISSUE') || text.includes('تغيير') || text.includes('إعادة إصدار')) {
      return { type: 'REISSUE', label: 'تغيير تذكرة' };
    }
    return { type: 'TICKET', label: 'تذكرة طيران' };
  }

  async getDebtAmountTrace(companyId: string, accountId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, companyId },
      include: {
        customer: { select: { id: true, nameAr: true, code: true } },
        supplier: { select: { id: true, nameAr: true, code: true } },
      },
    });
    if (!account) throw new NotFoundException('الحساب غير موجود');

    const targetLines = await this.prisma.journalEntryLine.findMany({
      where: {
        accountId,
        journalEntry: {
          companyId,
          status: 'POSTED',
        },
      },
      include: {
        journalEntry: {
          include: {
            lines: {
              include: {
                account: {
                  select: { id: true, code: true, nameAr: true, nameEn: true, currency: true },
                },
              },
            },
            receiptVouchers: {
              select: {
                id: true,
                voucherNumber: true,
                date: true,
                amount: true,
                reference: true,
                description: true,
                cashboxOrBankAccount: { select: { id: true, code: true, nameAr: true } },
              },
            },
            paymentVouchers: {
              select: {
                id: true,
                voucherNumber: true,
                date: true,
                amount: true,
                reference: true,
                description: true,
                cashboxOrBankAccount: { select: { id: true, code: true, nameAr: true } },
              },
            },
          },
        },
      },
      orderBy: [
        { journalEntry: { date: 'asc' } },
        { createdAt: 'asc' },
      ],
    });

    const groupedEntries = new Map<string, { entry: any; lines: any[] }>();
    for (const line of targetLines) {
      const existing = groupedEntries.get(line.journalEntryId);
      if (existing) existing.lines.push(line);
      else groupedEntries.set(line.journalEntryId, { entry: line.journalEntry, lines: [line] });
    }

    const sourceIds = new Set<string>();
    const references = new Set<string>();
    for (const { entry } of groupedEntries.values()) {
      if (entry.sourceId && ['TICKET', 'VISA'].includes(String(entry.sourceType || '').toUpperCase())) {
        sourceIds.add(entry.sourceId);
      }
      if (entry.reference) references.add(String(entry.reference));
    }

    const ticketLookupFilters: any[] = [];
    if (sourceIds.size) ticketLookupFilters.push({ id: { in: Array.from(sourceIds) } });
    if (references.size) ticketLookupFilters.push({ invoiceNumber: { in: Array.from(references) } });
    ticketLookupFilters.push({ customerAccountId: accountId }, { supplierAccountId: accountId });
    if (account.customer?.id) ticketLookupFilters.push({ customerId: account.customer.id });
    if (account.supplier?.id) ticketLookupFilters.push({ supplierId: account.supplier.id });

    const tickets = await this.prisma.ticket.findMany({
      where: {
        companyId,
        status: { in: ['POSTED', 'REFUNDED'] },
        OR: ticketLookupFilters,
      },
      include: {
        passengers: {
          select: { id: true, name: true, ticketNumber: true, pnr: true },
        },
      },
    });

    const ticketsById = new Map(tickets.map((ticket) => [ticket.id, ticket]));
    const ticketsByInvoice = new Map(
      tickets.map((ticket) => [String(ticket.invoiceNumber || '').trim().toLowerCase(), ticket]),
    );
    const journalTicketIds = new Set<string>();
    const journalReferences = new Set<string>();
    const rawMovements: any[] = [];

    for (const { entry, lines } of groupedEntries.values()) {
      const debit = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
      const credit = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
      const signedAmount = debit - credit;
      const normalizedReference = String(entry.reference || '').trim().toLowerCase();

      const ticket =
        (entry.sourceId ? ticketsById.get(entry.sourceId) : undefined) ||
        (normalizedReference ? ticketsByInvoice.get(normalizedReference) : undefined);
      if (ticket) journalTicketIds.add(ticket.id);
      if (normalizedReference) journalReferences.add(normalizedReference);

      const receiptVoucher = entry.receiptVouchers?.[0];
      const paymentVoucher = entry.paymentVouchers?.[0];
      const sourceType = String(entry.sourceType || '').toUpperCase();
      const referenceUpper = String(entry.reference || '').toUpperCase();
      const isOpening = entry.isOpening || sourceType.includes('OPENING') || referenceUpper.startsWith('OPEN');
      const isReversal = entry.isReversed || sourceType.includes('REVERS') || referenceUpper.startsWith('REV-');

      let kind = 'MANUAL_JOURNAL';
      let source: any = {
        id: entry.id,
        type: 'JOURNAL',
        label: 'قيد محاسبي',
        number: entry.entryNumber,
      };
      let sourceConfidence = 'EXACT_RELATION';
      let sourceCurrency: string | null = null;

      if (receiptVoucher) {
        kind = 'RECEIPT_VOUCHER';
        source = {
          id: receiptVoucher.id,
          type: 'RECEIPT_VOUCHER',
          label: 'سند قبض',
          number: receiptVoucher.voucherNumber,
          reference: receiptVoucher.reference,
          cashboxOrBank: receiptVoucher.cashboxOrBankAccount,
        };
      } else if (paymentVoucher) {
        kind = 'PAYMENT_VOUCHER';
        source = {
          id: paymentVoucher.id,
          type: 'PAYMENT_VOUCHER',
          label: 'سند صرف',
          number: paymentVoucher.voucherNumber,
          reference: paymentVoucher.reference,
          cashboxOrBank: paymentVoucher.cashboxOrBankAccount,
        };
      } else if (ticket) {
        const serviceType = this.resolveServiceTraceType(ticket, entry.sourceType);
        kind = 'SERVICE';
        sourceCurrency = ticket.currency;
        sourceConfidence = entry.sourceId === ticket.id ? 'EXACT_SOURCE_ID' : 'REFERENCE_FALLBACK';
        source = {
          id: ticket.id,
          type: serviceType.type,
          label: serviceType.label,
          number: ticket.invoiceNumber,
          invoiceNumber: ticket.invoiceNumber,
          pnr: ticket.pnr,
          route: ticket.route,
          tripType: ticket.tripType,
          status: ticket.status,
          passengers: ticket.passengers,
        };
      } else if (isOpening) {
        kind = 'OPENING';
        source = {
          id: entry.id,
          type: 'OPENING',
          label: 'رصيد افتتاحي',
          number: entry.reference || entry.entryNumber,
        };
      } else if (isReversal) {
        kind = 'REVERSAL';
        source = {
          id: entry.id,
          type: 'REVERSAL',
          label: 'قيد عكسي',
          number: entry.reference || entry.entryNumber,
        };
      }

      const inferredCurrency = this.inferTraceCurrency(
        account.currency,
        sourceCurrency,
        entry.reference,
        entry.description,
        ...lines.map((line) => line.description),
      );

      const counterpartAccounts = Array.from(
        entry.lines
          .filter((line: any) => line.accountId !== accountId)
          .reduce((map: Map<string, any>, line: any) => {
            const existing = map.get(line.accountId) || {
              id: line.account.id,
              code: line.account.code,
              nameAr: line.account.nameAr,
              nameEn: line.account.nameEn,
              debit: 0,
              credit: 0,
            };
            existing.debit += Number(line.debit || 0);
            existing.credit += Number(line.credit || 0);
            map.set(line.accountId, existing);
            return map;
          }, new Map<string, any>())
          .values(),
      );

      rawMovements.push({
        traceId: `JE:${entry.id}:ACCOUNT:${accountId}`,
        date: entry.date,
        createdAt: entry.createdAt,
        kind,
        direction: signedAmount >= 0 ? 'DEBIT' : 'CREDIT',
        amount: Math.abs(signedAmount),
        signedAmount,
        debit,
        credit,
        currency: inferredCurrency.currency,
        currencyConfidence: inferredCurrency.confidence,
        description: lines.map((line) => line.description).filter(Boolean).join(' — ') || entry.description,
        source,
        sourceConfidence,
        journal: {
          id: entry.id,
          entryNumber: entry.entryNumber,
          reference: entry.reference,
          description: entry.description,
          status: entry.status,
        },
        counterpartAccounts,
        path: [
          { role: 'SOURCE', id: source.id, label: source.label, number: source.number },
          { role: 'JOURNAL', id: entry.id, label: 'القيد المرحّل', number: entry.entryNumber },
          { role: 'ACCOUNT', id: account.id, label: account.nameAr, number: account.code },
          ...counterpartAccounts.map((counterpart: any) => ({
            role: 'COUNTERPART',
            id: counterpart.id,
            label: counterpart.nameAr,
            number: counterpart.code,
          })),
        ],
      });
    }

    // Legacy service records can briefly exist before their accounting entry is synchronized.
    // Include them transparently and mark them as unposted-source fallbacks instead of hiding the origin.
    const normalizedAccountName = account.nameAr.trim().toLowerCase();
    for (const ticket of tickets) {
      const normalizedInvoice = String(ticket.invoiceNumber || '').trim().toLowerCase();
      if (journalTicketIds.has(ticket.id) || journalReferences.has(normalizedInvoice)) continue;

      const customerMatch =
        ticket.customerAccountId === accountId ||
        (!!account.customer?.id && ticket.customerId === account.customer.id) ||
        String(ticket.customerName || '').trim().toLowerCase() === normalizedAccountName;
      const supplierMatch =
        ticket.supplierAccountId === accountId ||
        (!!account.supplier?.id && ticket.supplierId === account.supplier.id) ||
        String(ticket.supplierAccountName || '').trim().toLowerCase() === normalizedAccountName;

      const serviceType = this.resolveServiceTraceType(ticket, null);
      const inferredCurrency = this.inferTraceCurrency(account.currency, ticket.currency);
      const sellAmount = Number(ticket.netSell ?? ticket.totalSell ?? 0);
      const buyAmount = Number(ticket.netBuy ?? ticket.totalBuy ?? 0);
      const paymentType = String(ticket.paymentType || '').toUpperCase();
      const isCash =
        ticket.paymentMethod === 'CASH_HAND' ||
        paymentType === 'DEBIT' ||
        paymentType === 'CASH' ||
        ticket.paymentType === 'نقدي';
      const customerDebtMatch = customerMatch && !(isCash && sellAmount > 0);
      if (!customerDebtMatch && !supplierMatch) continue;

      const debit = customerDebtMatch ? Math.max(sellAmount, 0) : Math.max(-buyAmount, 0);
      const credit = customerDebtMatch ? Math.max(-sellAmount, 0) : Math.max(buyAmount, 0);
      const signedAmount = debit - credit;

      rawMovements.push({
        traceId: `SERVICE:${ticket.id}:ACCOUNT:${accountId}`,
        date: ticket.issueDate || ticket.createdAt,
        createdAt: ticket.createdAt,
        kind: 'SERVICE',
        direction: signedAmount >= 0 ? 'DEBIT' : 'CREDIT',
        amount: Math.abs(signedAmount),
        signedAmount,
        debit,
        credit,
        currency: inferredCurrency.currency,
        currencyConfidence: inferredCurrency.confidence,
        description: `${serviceType.label} — ${ticket.invoiceNumber}`,
        source: {
          id: ticket.id,
          type: serviceType.type,
          label: serviceType.label,
          number: ticket.invoiceNumber,
          invoiceNumber: ticket.invoiceNumber,
          pnr: ticket.pnr,
          route: ticket.route,
          tripType: ticket.tripType,
          status: ticket.status,
          passengers: ticket.passengers,
        },
        sourceConfidence: 'LEGACY_RECORD',
        journal: null,
        counterpartAccounts: [],
        path: [
          { role: 'SOURCE', id: ticket.id, label: serviceType.label, number: ticket.invoiceNumber },
          { role: 'ACCOUNT', id: account.id, label: account.nameAr, number: account.code },
        ],
      });
    }

    rawMovements.sort((a, b) => {
      const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      const createdDiff = new Date(a.createdAt || a.date).getTime() - new Date(b.createdAt || b.date).getTime();
      if (createdDiff !== 0) return createdDiff;
      return String(a.traceId).localeCompare(String(b.traceId));
    });

    const runningByCurrency: Record<string, number> = {};
    const summaries: Record<string, { currency: string; debit: number; credit: number; balance: number; movements: number }> = {};
    const movements = rawMovements.map((movement, index) => {
      const currency = movement.currency;
      const balanceBefore = runningByCurrency[currency] || 0;
      const runningBalance = balanceBefore + movement.signedAmount;
      runningByCurrency[currency] = runningBalance;
      const summary = summaries[currency] || { currency, debit: 0, credit: 0, balance: 0, movements: 0 };
      summary.debit += movement.debit;
      summary.credit += movement.credit;
      summary.balance = runningBalance;
      summary.movements += 1;
      summaries[currency] = summary;
      return { ...movement, sequence: index + 1, balanceBefore, runningBalance };
    });

    const warnings: string[] = [];
    if (movements.some((movement) => movement.currencyConfidence === 'ACCOUNT_DEFAULT')) {
      warnings.push('عملة بعض القيود غير محفوظة على مستوى السطر؛ استُخدمت عملة الحساب كمرجع.');
    }
    if (movements.some((movement) => movement.sourceConfidence === 'REFERENCE_FALLBACK')) {
      warnings.push('تم ربط بعض الخدمات بالقيد من خلال رقم الفاتورة لعدم توفر معرف المصدر في القيود القديمة.');
    }
    if (movements.some((movement) => movement.sourceConfidence === 'LEGACY_RECORD')) {
      warnings.push('توجد خدمات لم يُنشأ لها قيد مرحّل بعد؛ عُرضت كمصادر معلّقة بوضوح.');
    }

    return {
      account: {
        id: account.id,
        code: account.code,
        nameAr: account.nameAr,
        nameEn: account.nameEn,
        type: account.type,
        category: account.category,
        currency: account.currency,
      },
      generatedAt: new Date(),
      summaries: Object.values(summaries),
      counts: {
        total: movements.length,
        services: movements.filter((movement) => movement.kind === 'SERVICE').length,
        vouchers: movements.filter((movement) => ['RECEIPT_VOUCHER', 'PAYMENT_VOUCHER'].includes(movement.kind)).length,
        journals: movements.filter((movement) => !['SERVICE', 'RECEIPT_VOUCHER', 'PAYMENT_VOUCHER'].includes(movement.kind)).length,
      },
      movements,
      integrity: {
        basis: 'POSTED_LEDGER_WITH_LEGACY_SERVICE_FALLBACK',
        warnings,
        allocationNotice: 'يعرض المسار مصدر كل حركة المثبتة؛ لا ينسب سند تسوية إلى فاتورة بعينها ما لم يوجد ربط محاسبي صريح.',
      },
    };
  }

  async getAccountStatement(companyId: string, accountId: string, startDate?: string, endDate?: string) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, companyId },
      include: {
        customer: {
          select: {
            phone: true,
            email: true,
            address: true,
          },
        },
        supplier: {
          select: {
            phone: true,
            email: true,
            address: true,
          },
        },
      },
    });
    if (!account) throw new NotFoundException('الحساب غير موجود');

    const start = startDate ? new Date(startDate) : new Date('2026-01-01');
    const end = endDate ? new Date(endDate) : new Date('2026-12-31T23:59:59');

    // Posted lines before startDate for Opening Balance
    const previousLines = await this.prisma.journalEntryLine.findMany({
      where: {
        accountId,
        journalEntry: {
          companyId,
          status: 'POSTED',
          date: { lt: start },
        },
      },
    });

    let openingBalance = 0;
    previousLines.forEach((l) => {
      openingBalance += Number(l.debit) - Number(l.credit);
    });

    // Lines within date range
    const lines = await this.prisma.journalEntryLine.findMany({
      where: {
        accountId,
        journalEntry: {
          companyId,
          status: 'POSTED',
          date: { gte: start, lte: end },
        },
      },
      include: {
        journalEntry: {
          select: {
            id: true,
            entryNumber: true,
            date: true,
            createdAt: true,
            reference: true,
            description: true,
            sourceType: true,
            sourceId: true,
            receiptVouchers: { select: { voucherNumber: true, description: true } },
            paymentVouchers: { select: { voucherNumber: true, description: true } },
          },
        },
      },
      // Ordered by when the movement was entered, not by the document date, so a
      // newly recorded movement always lands at the end of the statement.
      orderBy: [{ journalEntry: { createdAt: 'asc' } }, { createdAt: 'asc' }],
    });

    /*
     * تفاصيل الخدمة تُجلب دفعةً واحدة لا سطراً سطراً.
     *
     * كشف الحساب كان يعرض وصف القيد وحده، فلا يعرف القارئ أهي تذكرة أم تأشيرة أم
     * فندق أم استرجاع، ولا يرى المسافر ولا خط السير ولا رقم الحجز. تُجمع معرّفات
     * المصادر ثم تُقرأ تذاكرها باستعلام واحد، فتُسمّى كل حركة باسم خدمتها وتُرفق
     * تفاصيلها — على الشاشة وفي الكشف المطبوع سواء.
     */
    const SERVICE_TYPES = ['TICKET', 'VISA', 'HOTEL', 'REFUND'];
    const serviceSourceIds = Array.from(
      new Set(
        lines
          .filter((l) => SERVICE_TYPES.includes(String(l.journalEntry.sourceType || '')))
          .map((l) => l.journalEntry.sourceId)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    const serviceTickets = serviceSourceIds.length
      ? await this.prisma.ticket.findMany({
          where: { id: { in: serviceSourceIds } },
          select: {
            id: true,
            invoiceNumber: true,
            tripType: true,
            status: true,
            pnr: true,
            airline: true,
            route: true,
            issueDate: true,
            travelDate: true,
            passengers: { select: { name: true, ticketNumber: true, ticketType: true } },
          },
        }).catch(() => [])
      : [];
    const ticketById = new Map(serviceTickets.map((t: any) => [t.id, t]));

    /** اسم الخدمة كما يُقرأ في الكشف — والاسترجاع بالإنجليزية «Refund» بطلب صاحب النظام. */
    const serviceLabelOf = (sourceType?: string | null): string | null => {
      switch (String(sourceType || '')) {
        case 'TICKET':
          return 'مبيعات تذاكر';
        case 'VISA':
          return 'مبيعات تأشيرات';
        case 'HOTEL':
          return 'حجوزات فنادق';
        case 'REFUND':
          return 'Refund';
        default:
          return null;
      }
    };

    let runningBalance = openingBalance;
    const formattedLines = lines.map((l) => {
      const debit = Number(l.debit);
      const credit = Number(l.credit);
      runningBalance += debit - credit;

      const voucher =
        l.journalEntry.receiptVouchers[0] || l.journalEntry.paymentVouchers[0] || null;
      const voucherType = l.journalEntry.receiptVouchers.length
        ? 'RECEIPT'
        : l.journalEntry.paymentVouchers.length
        ? 'PAYMENT'
        : '';

      const srcType = String(l.journalEntry.sourceType || '');
      const ticket: any = l.journalEntry.sourceId ? ticketById.get(l.journalEntry.sourceId) : null;
      // الاسترجاع قد يُسجَّل على تذكرة حالتها REFUNDED دون أن يكون نوع القيد REFUND.
      const isRefundRow =
        srcType === 'REFUND' || ticket?.tripType === 'REFUND' || ticket?.status === 'REFUNDED';
      const effectiveServiceType = isRefundRow
        ? 'REFUND'
        : SERVICE_TYPES.includes(srcType)
        ? srcType
        : ticket?.tripType === 'HOTEL'
        ? 'HOTEL'
        : ticket?.tripType === 'VISA'
        ? 'VISA'
        : srcType;

      const serviceDetails = ticket
        ? [
            ticket.invoiceNumber ? `فاتورة ${ticket.invoiceNumber}` : '',
            ticket.pnr ? `PNR ${ticket.pnr}` : '',
            ticket.airline || '',
            ticket.route || '',
            (ticket.passengers || [])
              .map((pax: any) => pax.name)
              .filter(Boolean)
              .slice(0, 4)
              .join('، '),
          ]
            .map((part: string) => String(part || '').trim())
            .filter(Boolean)
            .join(' · ')
        : '';

      return {
        id: l.id,
        date: l.journalEntry.date,
        entryDate: l.journalEntry.createdAt,
        entryNumber: l.journalEntry.entryNumber,
        voucherNumber: voucher?.voucherNumber || null,
        voucherType,
        serviceType: effectiveServiceType || null,
        serviceLabel: serviceLabelOf(effectiveServiceType),
        serviceDetails: serviceDetails || null,
        passengers: ticket?.passengers?.map((x: any) => x.name).filter(Boolean) || [],
        reference: l.journalEntry.reference,
        description:
          (voucher ? parseLegacySplitMarker(voucher.description).cleanDescription : '') ||
          l.description ||
          l.journalEntry.description,
        sourceType: l.journalEntry.sourceType,
        sourceId: l.journalEntry.sourceId,
        debit,
        credit,
        runningBalance,
      };
    });

    return {
      account: {
        id: account.id,
        code: account.code,
        nameAr: account.nameAr,
        nameEn: account.nameEn,
        type: account.type,
        phone: account.phone || account.customer?.phone || account.supplier?.phone || null,
        email: account.email || account.customer?.email || account.supplier?.email || null,
        address: account.address || account.customer?.address || account.supplier?.address || null,
      },
      startDate: start,
      endDate: end,
      openingBalance,
      closingBalance: runningBalance,
      lines: formattedLines,
    };
  }

  async getTrialBalance(companyId: string) {
    const accounts = await this.prisma.account.findMany({
      where: { companyId },
      include: {
        journalLines: {
          where: { journalEntry: { status: 'POSTED' } },
        },
      },
      orderBy: { code: 'asc' },
    });

    let grandTotalDebit = 0;
    let grandTotalCredit = 0;

    const report = accounts.map((acc) => {
      let totalDebit = 0;
      let totalCredit = 0;

      acc.journalLines.forEach((l) => {
        totalDebit += Number(l.debit);
        totalCredit += Number(l.credit);
      });

      const netBalance = totalDebit - totalCredit;

      grandTotalDebit += totalDebit;
      grandTotalCredit += totalCredit;

      return {
        id: acc.id,
        code: acc.code,
        nameAr: acc.nameAr,
        type: acc.type,
        isParent: acc.isParent,
        level: acc.level,
        totalDebit,
        totalCredit,
        netBalance,
      };
    });

    return {
      grandTotalDebit,
      grandTotalCredit,
      isBalanced: Math.abs(grandTotalDebit - grandTotalCredit) < 0.01,
      accounts: report,
    };
  }

  async getIncomeStatement(companyId: string) {
    const revenueAccounts = await this.prisma.account.findMany({
      where: { companyId, type: 'REVENUE', isParent: false },
      include: {
        journalLines: { where: { journalEntry: { status: 'POSTED' } } },
      },
    });

    const expenseAccounts = await this.prisma.account.findMany({
      where: { companyId, type: 'EXPENSE', isParent: false },
      include: {
        journalLines: { where: { journalEntry: { status: 'POSTED' } } },
      },
    });

    let totalRevenues = 0;
    const revenues = revenueAccounts.map((acc) => {
      let amount = 0;
      acc.journalLines.forEach((l) => {
        amount += Number(l.credit) - Number(l.debit);
      });
      totalRevenues += amount;
      return { id: acc.id, code: acc.code, nameAr: acc.nameAr, amount };
    });

    let totalExpenses = 0;
    const expenses = expenseAccounts.map((acc) => {
      let amount = 0;
      acc.journalLines.forEach((l) => {
        amount += Number(l.debit) - Number(l.credit);
      });
      totalExpenses += amount;
      return { id: acc.id, code: acc.code, nameAr: acc.nameAr, amount };
    });

    const netProfit = totalRevenues - totalExpenses;

    return {
      totalRevenues,
      totalExpenses,
      netProfit,
      revenues,
      expenses,
    };
  }

  async getBalanceSheet(companyId: string) {
    const assetAccounts = await this.prisma.account.findMany({
      where: { companyId, type: 'ASSET', isParent: false },
      include: { journalLines: { where: { journalEntry: { status: 'POSTED' } } } },
    });

    const liabilityAccounts = await this.prisma.account.findMany({
      where: { companyId, type: 'LIABILITY', isParent: false },
      include: { journalLines: { where: { journalEntry: { status: 'POSTED' } } } },
    });

    const equityAccounts = await this.prisma.account.findMany({
      where: { companyId, type: 'EQUITY', isParent: false },
      include: { journalLines: { where: { journalEntry: { status: 'POSTED' } } } },
    });

    let totalAssets = 0;
    const assets = assetAccounts.map((acc) => {
      let balance = 0;
      acc.journalLines.forEach((l) => (balance += Number(l.debit) - Number(l.credit)));
      totalAssets += balance;
      return { id: acc.id, code: acc.code, nameAr: acc.nameAr, balance };
    });

    let totalLiabilities = 0;
    const liabilities = liabilityAccounts.map((acc) => {
      let balance = 0;
      acc.journalLines.forEach((l) => (balance += Number(l.credit) - Number(l.debit)));
      totalLiabilities += balance;
      return { id: acc.id, code: acc.code, nameAr: acc.nameAr, balance };
    });

    let totalEquity = 0;
    const equity = equityAccounts.map((acc) => {
      let balance = 0;
      acc.journalLines.forEach((l) => (balance += Number(l.credit) - Number(l.debit)));
      totalEquity += balance;
      return { id: acc.id, code: acc.code, nameAr: acc.nameAr, balance };
    });

    // Add Income Statement Net Profit to Equity
    const income = await this.getIncomeStatement(companyId);
    totalEquity += income.netProfit;

    return {
      totalAssets,
      totalLiabilities,
      totalEquity,
      isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
      assets,
      liabilities,
      equity,
      netProfitCurrentPeriod: income.netProfit,
    };
  }

  async getComprehensiveProfits(companyId: string, branchId?: string, startDate?: string, endDate?: string) {
    let start: Date | undefined;
    let end: Date | undefined;

    if (startDate) {
      start = new Date(startDate.includes('T') ? startDate : `${startDate}T00:00:00.000Z`);
    }
    if (endDate) {
      end = new Date(endDate.includes('T') ? endDate : `${endDate}T23:59:59.999Z`);
    }

    const ticketDateFilter = start || end ? {
      OR: [
        {
          issueDate: {
            ...(start ? { gte: start } : {}),
            ...(end ? { lte: end } : {}),
          },
        },
        {
          createdAt: {
            ...(start ? { gte: start } : {}),
            ...(end ? { lte: end } : {}),
          },
        },
      ],
    } : {};

    const branchFilter = branchId && branchId !== 'ALL' ? { branchId } : {};

    const [tickets, revenueAccounts, expenseAccounts, journalLines, paymentVouchers] = await Promise.all([
      this.prisma.ticket.findMany({
        where: {
          companyId,
          status: { not: 'CANCELLED' },
          ...branchFilter,
          ...ticketDateFilter,
        },
        include: { passengers: true },
        orderBy: { issueDate: 'desc' },
      }),
      this.prisma.account.findMany({
        where: { companyId, type: 'REVENUE' },
        orderBy: { code: 'asc' },
      }),
      this.prisma.account.findMany({
        where: { companyId, type: 'EXPENSE' },
        orderBy: { code: 'asc' },
      }),
      this.prisma.journalEntryLine.findMany({
        where: {
          journalEntry: {
            companyId,
            status: 'POSTED',
            ...branchFilter,
            ...(start || end ? {
              date: {
                ...(start ? { gte: start } : {}),
                ...(end ? { lte: end } : {}),
              },
            } : {}),
          },
        },
        include: {
          journalEntry: true,
          account: true,
        },
        orderBy: { journalEntry: { date: 'desc' } },
      }),
      this.prisma.paymentVoucher.findMany({
        where: {
          companyId,
          status: 'POSTED',
          ...branchFilter,
          ...(start || end ? {
            date: {
              ...(start ? { gte: start } : {}),
              ...(end ? { lte: end } : {}),
            },
          } : {}),
        },
        orderBy: { date: 'desc' },
      }),
    ]);

    // 1. Calculate Services & Tickets Gross Profits
    let servicesSalesIQD = 0, servicesCostIQD = 0, servicesProfitIQD = 0;
    let servicesSalesUSD = 0, servicesCostUSD = 0, servicesProfitUSD = 0;
    let refundsSalesIQD = 0, refundsCostIQD = 0, refundsProfitIQD = 0;
    let refundsSalesUSD = 0, refundsCostUSD = 0, refundsProfitUSD = 0;

    const servicesBreakdown: Record<string, {
      titleAr: string;
      count: number;
      salesIQD: number;
      costIQD: number;
      profitIQD: number;
      salesUSD: number;
      costUSD: number;
      profitUSD: number;
    }> = {
      FLIGHT_TICKETS: { titleAr: 'تذاكر الطيران', count: 0, salesIQD: 0, costIQD: 0, profitIQD: 0, salesUSD: 0, costUSD: 0, profitUSD: 0 },
      VISAS: { titleAr: 'الفيزا والتأشيرات', count: 0, salesIQD: 0, costIQD: 0, profitIQD: 0, salesUSD: 0, costUSD: 0, profitUSD: 0 },
      HOTELS: { titleAr: 'حجوزات الفنادق والإقامة', count: 0, salesIQD: 0, costIQD: 0, profitIQD: 0, salesUSD: 0, costUSD: 0, profitUSD: 0 },
      GROUPS: { titleAr: 'البرامج السياحية والكروبات', count: 0, salesIQD: 0, costIQD: 0, profitIQD: 0, salesUSD: 0, costUSD: 0, profitUSD: 0 },
      REISSUES: { titleAr: 'تغيير وإعادة إصدار التذاكر', count: 0, salesIQD: 0, costIQD: 0, profitIQD: 0, salesUSD: 0, costUSD: 0, profitUSD: 0 },
      REFUNDS: { titleAr: 'استرجاع التذاكر والعمولات', count: 0, salesIQD: 0, costIQD: 0, profitIQD: 0, salesUSD: 0, costUSD: 0, profitUSD: 0 },
      OTHER: { titleAr: 'خدمات سياحية أخرى', count: 0, salesIQD: 0, costIQD: 0, profitIQD: 0, salesUSD: 0, costUSD: 0, profitUSD: 0 },
    };

    tickets.forEach((t) => {
      const isUSD = (t.currency || '').toUpperCase().includes('USD') || (t.currency || '').includes('$');
      const isRef = t.tripType === 'REFUND' || t.status === 'REFUNDED' || String(t.invoiceNumber || '').startsWith('REF-');
      const rawType = ((t as any).serviceType || (t as any).flightType || t.tripType || t.travelClass || (t as any).notes || '').toUpperCase();

      const sell = Math.abs(Number(t.totalSell || (t as any).totals?.totalSell || 0));
      const buy = Math.abs(Number(t.totalBuy || (t as any).totals?.totalBuy || 0));
      const prf = Number(t.profit !== undefined && t.profit !== null ? t.profit : (sell - buy));

      if (isRef) {
        if (isUSD) {
          refundsSalesUSD += sell;
          refundsCostUSD += buy;
          refundsProfitUSD += prf;
          servicesProfitUSD += prf;
        } else {
          refundsSalesIQD += sell;
          refundsCostIQD += buy;
          refundsProfitIQD += prf;
          servicesProfitIQD += prf;
        }
      } else {
        if (isUSD) {
          servicesSalesUSD += sell;
          servicesCostUSD += buy;
          servicesProfitUSD += prf;
        } else {
          servicesSalesIQD += sell;
          servicesCostIQD += buy;
          servicesProfitIQD += prf;
        }
      }

      // Categorize
      let key = 'FLIGHT_TICKETS';
      if (isRef || rawType.includes('REFUND') || rawType.includes('استرجاع') || rawType.includes('إلغاء')) key = 'REFUNDS';
      else if (rawType.includes('VISA') || rawType.includes('فيزا') || rawType.includes('تأشير')) key = 'VISAS';
      else if (rawType.includes('HOTEL') || rawType.includes('فندق') || rawType.includes('إقامة') || rawType.includes('اقامة')) key = 'HOTELS';
      else if (rawType.includes('GROUP') || rawType.includes('كروب') || rawType.includes('برنامج') || rawType.includes('سياحي')) key = 'GROUPS';
      else if (rawType.includes('REISSUE') || rawType.includes('تغيير') || rawType.includes('تعديل') || rawType.includes('إعادة إصدار')) key = 'REISSUES';
      else if ((t as any).serviceType === 'OTHER' || (t as any).serviceType === 'أخرى') key = 'OTHER';
      else key = 'FLIGHT_TICKETS';

      const group = servicesBreakdown[key] || servicesBreakdown['FLIGHT_TICKETS'];
      group.count += 1;
      if (isUSD) {
        group.salesUSD += sell;
        group.costUSD += buy;
        group.profitUSD += prf;
      } else {
        group.salesIQD += sell;
        group.costIQD += buy;
        group.profitIQD += prf;
      }
    });

    // 2. Incidental & Other Revenues (Class 4)
    let otherRevenuesIQD = 0, otherRevenuesUSD = 0;
    const incidentalRevenuesList: any[] = [];

    revenueAccounts.forEach((acc) => {
      let accIQD = 0, accUSD = 0;
      const matchingLines = journalLines.filter((l) => l.accountId === acc.id);
      matchingLines.forEach((l) => {
        const lineCurr = ((l as any).currency || (l as any).journalEntry?.currency || '').toUpperCase();
        const isUSD = lineCurr.includes('USD') || lineCurr.includes('$');
        const net = Number(l.credit || 0) - Number(l.debit || 0);
        if (isUSD) accUSD += net;
        else accIQD += net;
      });

      if (accIQD !== 0 || accUSD !== 0) {
        otherRevenuesIQD += accIQD;
        otherRevenuesUSD += accUSD;
        incidentalRevenuesList.push({
          id: acc.id,
          code: acc.code,
          nameAr: acc.nameAr,
          amountIQD: accIQD,
          amountUSD: accUSD,
        });
      }
    });

    // 3. Categorized Expenses Deductions (Class 3 + Salaries + Rents + GDS)
    const expenseCategories: Record<string, {
      categoryKey: string;
      titleAr: string;
      totalIQD: number;
      totalUSD: number;
      accounts: any[];
    }> = {
      SALARIES: { categoryKey: 'SALARIES', titleAr: 'الرواتب والأجور ومكافآت الكادر', totalIQD: 0, totalUSD: 0, accounts: [] },
      RENTS: { categoryKey: 'RENTS', titleAr: 'إيجارات المكاتب ومقرات الفروع', totalIQD: 0, totalUSD: 0, accounts: [] },
      GDS_SYSTEMS: { categoryKey: 'GDS_SYSTEMS', titleAr: 'اشتراكات أنظمة الطيران والـ GDS والبرمجيات', totalIQD: 0, totalUSD: 0, accounts: [] },
      UTILITIES: { categoryKey: 'UTILITIES', titleAr: 'الكهرباء والماء والإنترنت والاتصالات', totalIQD: 0, totalUSD: 0, accounts: [] },
      MARKETING: { categoryKey: 'MARKETING', titleAr: 'التسويق والإعلانات والترويج', totalIQD: 0, totalUSD: 0, accounts: [] },
      BANK_FEES: { categoryKey: 'BANK_FEES', titleAr: 'العمولات المصرفية ورسوم بوابات الدفع', totalIQD: 0, totalUSD: 0, accounts: [] },
      HOSPITALITY_MAINT: { categoryKey: 'HOSPITALITY_MAINT', titleAr: 'الضيافة والنظافة والصيانة والتجهيزات', totalIQD: 0, totalUSD: 0, accounts: [] },
      GENERAL_SUNDRY: { categoryKey: 'GENERAL_SUNDRY', titleAr: 'المصاريف الإدارية والعمومية الأخرى', totalIQD: 0, totalUSD: 0, accounts: [] },
    };

    let totalExpensesIQD = 0, totalExpensesUSD = 0;
    const allExpenseTransactions: any[] = [];

    expenseAccounts.forEach((acc) => {
      let accIQD = 0, accUSD = 0;
      const matchingLines = journalLines.filter((l) => l.accountId === acc.id);
      matchingLines.forEach((l) => {
        const lineCurr = ((l as any).currency || (l as any).journalEntry?.currency || '').toUpperCase();
        const isUSD = lineCurr.includes('USD') || lineCurr.includes('$');
        const net = Number(l.debit || 0) - Number(l.credit || 0);
        if (isUSD) accUSD += net;
        else accIQD += net;

        allExpenseTransactions.push({
          id: l.id,
          date: l.journalEntry?.date,
          accountCode: acc.code,
          accountName: acc.nameAr,
          description: l.description || l.journalEntry?.description || '',
          amountIQD: isUSD ? 0 : net,
          amountUSD: isUSD ? net : 0,
          source: 'JOURNAL_ENTRY',
          ref: l.journalEntry?.entryNumber || l.journalEntry?.reference,
        });
      });

      if (accIQD !== 0 || accUSD !== 0) {
        totalExpensesIQD += accIQD;
        totalExpensesUSD += accUSD;

        const code = acc.code || '';
        let catKey = 'GENERAL_SUNDRY';
        if (code.startsWith('31') || acc.nameAr.includes('رواتب') || acc.nameAr.includes('أجور') || acc.nameAr.includes('مكافآت')) {
          catKey = 'SALARIES';
        } else if (code.startsWith('321') || acc.nameAr.includes('إيجار') || acc.nameAr.includes('ايجار')) {
          catKey = 'RENTS';
        } else if (code.startsWith('3319') || acc.nameAr.includes('GDS') || acc.nameAr.includes('أماديوس') || acc.nameAr.includes('سيبر') || acc.nameAr.includes('اشتراك')) {
          catKey = 'GDS_SYSTEMS';
        } else if (code.startsWith('322') || acc.nameAr.includes('كهرباء') || acc.nameAr.includes('إنترنت') || acc.nameAr.includes('اتصالات') || acc.nameAr.includes('هاتف')) {
          catKey = 'UTILITIES';
        } else if (code.startsWith('324') || acc.nameAr.includes('إعلان') || acc.nameAr.includes('دعاية') || acc.nameAr.includes('تسويق')) {
          catKey = 'MARKETING';
        } else if (code.startsWith('34') || acc.nameAr.includes('عمولة بنكية') || acc.nameAr.includes('رسوم مصرفية') || acc.nameAr.includes('ماستر')) {
          catKey = 'BANK_FEES';
        } else if (code.startsWith('325') || acc.nameAr.includes('ضيافة') || acc.nameAr.includes('نظافة') || acc.nameAr.includes('صيانة')) {
          catKey = 'HOSPITALITY_MAINT';
        }

        const cat = expenseCategories[catKey] || expenseCategories['GENERAL_SUNDRY'];
        cat.totalIQD += accIQD;
        cat.totalUSD += accUSD;
        cat.accounts.push({
          id: acc.id,
          code: acc.code,
          nameAr: acc.nameAr,
          amountIQD: accIQD,
          amountUSD: accUSD,
        });
      }
    });

    // 4. Net Final Financial Results
    const totalGrossIncomeIQD = servicesProfitIQD + otherRevenuesIQD;
    const totalGrossIncomeUSD = servicesProfitUSD + otherRevenuesUSD;

    const netProfitIQD = totalGrossIncomeIQD - totalExpensesIQD;
    const netProfitUSD = totalGrossIncomeUSD - totalExpensesUSD;

    const profitMarginIQD = servicesSalesIQD > 0 ? (netProfitIQD / servicesSalesIQD) * 100 : 0;
    const profitMarginUSD = servicesSalesUSD > 0 ? (netProfitUSD / servicesSalesUSD) * 100 : 0;

    return {
      summary: {
        servicesSalesIQD,
        servicesCostIQD,
        servicesProfitIQD,
        servicesSalesUSD,
        servicesCostUSD,
        servicesProfitUSD,
        refundsSalesIQD,
        refundsSalesUSD,
        refundsProfitIQD,
        refundsProfitUSD,
        otherRevenuesIQD,
        otherRevenuesUSD,
        totalGrossIncomeIQD,
        totalGrossIncomeUSD,
        totalExpensesIQD,
        totalExpensesUSD,
        netProfitIQD,
        netProfitUSD,
        profitMarginIQD,
        profitMarginUSD,
        ticketsCount: tickets.length,
      },
      servicesBreakdown: Object.values(servicesBreakdown),
      incidentalRevenues: incidentalRevenuesList,
      expenseCategories: Object.values(expenseCategories),
      expenseTransactions: allExpenseTransactions,
      tickets,
    };
  }

  /**
   * أرباح الموظفين: يجمع ربح المستندات على موظّف الإصدار، ويقسمه بين الموظف
   * والشركة وفق هامش الربح المحفوظ لكل موظف (وإلا الهامش الافتراضي). الهوامش
   * تُخزَّن كإعدادٍ باسم employee_profit_margins في مخزن القوالب.
   */
  async getEmployeeProfits(companyId: string, branchId?: string, startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate.includes('T') ? startDate : `${startDate}T00:00:00.000Z`) : undefined;
    const end = endDate ? new Date(endDate.includes('T') ? endDate : `${endDate}T23:59:59.999Z`) : undefined;
    const dateFilter = start || end
      ? { OR: [
          { issueDate: { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } },
          { createdAt: { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } },
        ] }
      : {};
    const branchFilter = branchId && branchId !== 'ALL' ? { branchId } : {};

    const [tickets, marginRow] = await Promise.all([
      this.prisma.ticket.findMany({
        where: { companyId, status: { not: 'CANCELLED' }, ...branchFilter, ...dateFilter },
        select: { employeeName: true, profit: true, netSell: true, totalSell: true, netBuy: true, totalBuy: true, tripType: true },
      }),
      this.prisma.printTemplate.findFirst({ where: { companyId, docType: 'employee_profit_margins' } }),
    ]);

    let marginByName: Record<string, number> = {};
    let defaultEmployeeMargin = 0;
    try {
      const cfg = JSON.parse(marginRow?.config || '{}');
      marginByName = cfg.employees || {};
      defaultEmployeeMargin = Number(cfg.defaultEmployeeMargin) || 0;
    } catch {
      /* إعداد غائب أو تالف — تُستعمل القيم الافتراضية */
    }

    const norm = (s: string | null | undefined) => String(s || '').trim();
    const map = new Map<string, { employeeName: string; docCount: number; totalSales: number; totalBuy: number; totalProfit: number }>();
    for (const t of tickets) {
      const name = norm(t.employeeName) || 'غير محدّد';
      const row = map.get(name) || { employeeName: name, docCount: 0, totalSales: 0, totalBuy: 0, totalProfit: 0 };
      row.docCount += 1;
      row.totalSales += Number(t.netSell ?? t.totalSell) || 0;
      row.totalBuy += Number(t.netBuy ?? t.totalBuy) || 0;
      row.totalProfit += Number(t.profit) || 0;
      map.set(name, row);
    }

    const rows = Array.from(map.values())
      .map((r) => {
        const raw = marginByName[r.employeeName];
        const employeeMargin = Math.max(0, Math.min(100, raw !== undefined && raw !== null ? Number(raw) : defaultEmployeeMargin));
        const employeeShare = (r.totalProfit * employeeMargin) / 100;
        return {
          ...r,
          employeeMargin,
          companyMargin: 100 - employeeMargin,
          employeeShare,
          companyShare: r.totalProfit - employeeShare,
        };
      })
      .sort((a, b) => b.totalProfit - a.totalProfit);

    const totals = rows.reduce(
      (acc, r) => ({
        docCount: acc.docCount + r.docCount,
        totalSales: acc.totalSales + r.totalSales,
        totalBuy: acc.totalBuy + r.totalBuy,
        totalProfit: acc.totalProfit + r.totalProfit,
        employeeShare: acc.employeeShare + r.employeeShare,
        companyShare: acc.companyShare + r.companyShare,
      }),
      { docCount: 0, totalSales: 0, totalBuy: 0, totalProfit: 0, employeeShare: 0, companyShare: 0 },
    );

    return { rows, totals, defaultEmployeeMargin };
  }
}
