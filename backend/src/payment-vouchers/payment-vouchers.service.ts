import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { IsNotEmpty, IsString, IsNumber, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SplitInput,
  PostingLeg,
  normalizeVoucherSplits,
  balanceDeltasFromLines,
  splitsFromJournalLines,
  buildVoucherLines,
  buildEntryDescription,
  parseLegacySplitMarker,
  VoucherLineContext,
  VOUCHER_SPLIT_MARKER,
} from '../vouchers/voucher-splits';

export class CreatePaymentVoucherDto {
  @ApiPropertyOptional({ example: '2026-08-03', description: 'تاريخ السند' })
  @IsString()
  @IsOptional()
  date?: string;

  @ApiProperty({ example: 3500, description: 'مبلغ سند الدفع' })
  @IsNumber()
  amount: number;

  @ApiProperty({ description: 'معرف الحساب المدين (مثل حساب المورد/شركة الطيران)' })
  @IsString()
  @IsNotEmpty()
  accountId: string;

  @ApiProperty({ description: 'معرف حساب الصندوق أو البنك (الدائن)' })
  @IsString()
  @IsNotEmpty()
  cashboxOrBankAccountId: string;

  @ApiPropertyOptional({ description: 'معرف المورد أو شركة الطيران' })
  @IsString()
  @IsOptional()
  supplierId?: string;

  @ApiPropertyOptional({ example: 'TR-88102', description: 'رقم التحويل البنكي أو المرجع' })
  @IsString()
  @IsOptional()
  reference?: string;

  @ApiProperty({ example: 'سداد مستحقات تذاكر الخطوط السعودية', description: 'البيان والتفاصيل' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ example: 'IQD', description: 'عملة السند' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ example: 1550, description: 'سعر صرف الدولار المستخدم عند الترحيل' })
  @IsNumber()
  @IsOptional()
  exchangeRate?: number;

  @ApiPropertyOptional({ description: 'طريقة التسديد' })
  @IsString()
  @IsOptional()
  paymentMethodId?: string;

  @ApiPropertyOptional({ description: 'عدد المرفقات والوصولات' })
  @IsNumber()
  @IsOptional()
  slipsCount?: number;

  @ApiPropertyOptional({ description: 'حالة السند' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    description:
      'توزيع المبلغ على حسابات متعددة. كل عنصر { accountId, amount } بعملة السند. الحساب المقابل يستوعب الباقي.',
    type: [Object],
  })
  @IsArray()
  @IsOptional()
  splitAccounts?: SplitInput[];

  @ApiPropertyOptional({ description: 'رقم السند من الفرونتند' })
  @IsString()
  @IsOptional()
  voucherNumber?: string;
}

@Injectable()
export class PaymentVouchersService {
  constructor(private prisma: PrismaService) {}

  // Vouchers store the entered currency; ledgers and balances stay in the base currency (IQD).
  /** The ledger is kept in dinars; foreign-currency vouchers are converted into it. */
  private readonly BASE_CURRENCY = 'IQD';

  private normalizeCurrency(currency?: string | null): string {
    const normalized = String(currency || 'IQD').trim().toUpperCase();
    return normalized === 'USD' || normalized === '$' ? 'USD' : 'IQD';
  }

  private resolveRate(currency: string, rate?: number | null): number {
    if (currency !== 'USD') return 1;
    const parsed = Number(rate);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new BadRequestException('سعر الصرف مطلوب وصحيح عند تسجيل سند بالدولار');
    }
    return parsed;
  }

  private async applyBalanceDeltas(tx: any, deltas: Map<string, number>) {
    for (const [accountId, delta] of deltas) {
      if (!delta) continue;
      const exists = await tx.account.findUnique({ where: { id: accountId }, select: { id: true } });
      if (!exists) continue;
      await tx.account.update({
        where: { id: accountId },
        data:
          delta > 0
            ? { balance: { increment: new Prisma.Decimal(delta) } }
            : { balance: { decrement: new Prisma.Decimal(-delta) } },
      });
    }
  }

  /** Exact inverse of whatever the stored lines did to balances. */
  private reverseDeltas(lines: Array<{ accountId: string | null; debit: any; credit: any }>) {
    const reversed = new Map<string, number>();
    balanceDeltasFromLines(lines).forEach((delta, accountId) => reversed.set(accountId, -delta));
    return reversed;
  }

  /** Payment is the mirror of receipt: the cashbox is credited, each leg debited. */
  private postingDeltas(legs: PostingLeg[], cashboxAccountId: string, baseAmount: number) {
    const deltas = new Map<string, number>();
    deltas.set(cashboxAccountId, (deltas.get(cashboxAccountId) ?? 0) - baseAmount);
    for (const leg of legs) {
      deltas.set(leg.accountId, (deltas.get(leg.accountId) ?? 0) + leg.amount);
    }
    return deltas;
  }

  /**
   * Split amounts arrive in the voucher's currency, but the ledger is posted in the
   * base currency — so they are scaled by the same rate before the legs are built,
   * otherwise a USD split would silently post its face value as dinars.
   */
  private resolveLegs(
    splits: SplitInput[] | undefined,
    baseAmount: number,
    exchangeRate: number,
    primaryAccountId: string,
  ): PostingLeg[] {
    const rate = Number(exchangeRate) || 1;
    const scaled = (splits ?? []).map((s) => ({
      ...s,
      amount: (Number(s?.amount) || 0) * rate,
    }));
    return normalizeVoucherSplits(scaled, baseAmount, primaryAccountId);
  }

  /**
   * Validates the split targets and returns their display names in the same pass —
   * the names are what make a journal line readable in an account statement, and
   * fetching them separately would cost another round trip.
   */
  private async validateSplitAccounts(
    companyId: string,
    legs: PostingLeg[],
    extraIds: Array<string | null | undefined> = [],
  ): Promise<Map<string, string>> {
    const legIds = Array.from(new Set(legs.map((l) => l.accountId)));
    const allIds = Array.from(
      new Set([...legIds, ...extraIds.filter((id): id is string => Boolean(id))]),
    );
    if (allIds.length === 0) return new Map();

    const found = await this.prisma.account.findMany({
      where: { id: { in: allIds }, companyId },
      select: { id: true, nameAr: true },
    });
    const names = new Map<string, string>(
      found.map((a): [string, string] => [a.id, a.nameAr]),
    );
    if (legIds.some((id) => !names.has(id))) {
      throw new BadRequestException('أحد حسابات التقسيم لا ينتمي إلى الشركة الحالية');
    }
    return names;
  }

  /** Legacy markers must never reach the stored description — they are noise now. */
  private cleanDescription(description?: string | null): string {
    return parseLegacySplitMarker(description).cleanDescription;
  }

  private async validateReferences(
    companyId: string,
    accountId: string,
    cashboxOrBankAccountId: string,
    supplierId?: string | null,
  ) {
    // One round trip for both accounts keeps voucher saving fast on a remote database.
    const [accounts, supplier] = await Promise.all([
      this.prisma.account.findMany({
        where: { companyId, id: { in: [accountId, cashboxOrBankAccountId] } },
        select: { id: true },
      }),
      supplierId
        ? this.prisma.supplier.findFirst({
            where: { id: supplierId, companyId },
            select: { id: true, nameAr: true },
          })
        : Promise.resolve(null),
    ]);

    const foundIds = new Set(accounts.map((item) => item.id));
    if (!foundIds.has(accountId)) throw new BadRequestException('حساب الطرف المحدد لا ينتمي إلى الشركة الحالية');
    if (!foundIds.has(cashboxOrBankAccountId)) throw new BadRequestException('حساب الصندوق أو البنك لا ينتمي إلى الشركة الحالية');
    if (supplierId && !supplier) throw new BadRequestException('المورد المحدد لا ينتمي إلى الشركة الحالية');

    // The payee's name is already loaded here, so it is returned rather than
    // re-queried when the line descriptions are written.
    return supplier?.nameAr || null;
  }

  /**
   * The entry's lines are selected because the split columns in the list are read
   * from the ledger, not from a marker in the description. Three tiny numeric
   * columns on a capped row count — a fraction of the old full-entry include.
   */
  async findAll(companyId: string, requestedLimit?: number) {
    const take = Math.min(Math.max(Number(requestedLimit) || 150, 1), 300);
    const rows = await this.prisma.paymentVoucher.findMany({
      where: { companyId },
      select: {
        id: true,
        voucherNumber: true,
        date: true,
        amount: true,
        currency: true,
        exchangeRate: true,
        accountId: true,
        cashboxOrBankAccountId: true,
        supplierId: true,
        reference: true,
        description: true,
        status: true,
        createdAt: true,
        account: { select: { id: true, code: true, nameAr: true, nameEn: true, type: true, isParent: true } },
        cashboxOrBankAccount: { select: { id: true, code: true, nameAr: true } },
        createdBy: { select: { id: true, name: true } },
        journalEntry: {
          select: {
            lines: {
              select: {
                accountId: true,
                debit: true,
                credit: true,
                account: { select: { nameAr: true } },
              },
            },
          },
        },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take,
    });

    return rows.map((row: any) => {
      const rate = Number(row.exchangeRate) || 1;
      const legs = splitsFromJournalLines(
        row.journalEntry?.lines ?? [],
        row.cashboxOrBankAccountId,
        'PAYMENT',
      ).filter((leg) => leg.accountId !== row.accountId);

      const names = new Map(
        (row.journalEntry?.lines ?? []).map((l: any) => [l.accountId, l.account?.nameAr || '']),
      );
      const { journalEntry: _entry, ...rest } = row;
      return {
        ...rest,
        splitAccounts: legs.map((leg) => ({
          accountId: leg.accountId,
          accountName: names.get(leg.accountId) || '',
          // Voucher currency, so the list shows the figure the user typed.
          amount: leg.amount / rate,
        })),
      };
    });
  }

  async findOne(id: string, companyId: string) {
    const voucher = await this.prisma.paymentVoucher.findFirst({
      where: { id, companyId },
      include: {
        account: { select: { id: true, code: true, nameAr: true, nameEn: true, type: true } },
        cashboxOrBankAccount: { select: { id: true, code: true, nameAr: true } },
        supplier: { select: { id: true, code: true, nameAr: true, isAirline: true } },
        createdBy: { select: { id: true, name: true } },
        journalEntry: {
          include: {
            lines: {
              include: { account: { select: { id: true, code: true, nameAr: true } } },
            },
          },
        },
      },
    });
    if (!voucher) throw new NotFoundException('سند الدفع غير موجود');

    // Read the split back out of the entry's debit lines — the ledger is the record.
    const rate = Number(voucher.exchangeRate) || 1;
    const legs = splitsFromJournalLines(
      voucher.journalEntry?.lines ?? [],
      voucher.cashboxOrBankAccountId,
      'PAYMENT',
    );
    const byId = new Map(
      (voucher.journalEntry?.lines ?? []).map((l: any) => [l.accountId, l.account?.nameAr || '']),
    );
    // The primary account's leg is the derived remainder; the editor recomputes it.
    // Handing it back would have it re-counted as a custom split.
    return {
      ...voucher,
      splitAccounts: legs
        .filter((leg) => leg.accountId !== voucher.accountId)
        .map((leg) => ({
          accountId: leg.accountId,
          accountName: byId.get(leg.accountId) || '',
          // Returned in the voucher's currency, matching what the editor sends.
          amount: leg.amount / rate,
        })),
    };
  }

  async create(companyId: string, userId: string, dto: CreatePaymentVoucherDto) {
    const amount = Number(dto.amount);
    if (!amount || amount <= 0) {
      throw new BadRequestException('مبلغ سند الدفع يجب أن يكون أكبر من الصفر');
    }
    const currency = this.normalizeCurrency(dto.currency);
    const exchangeRate = this.resolveRate(currency, dto.exchangeRate);
    const baseAmount = amount * exchangeRate;
    const note = this.cleanDescription(dto.description);
    const partyName = await this.validateReferences(
      companyId,
      dto.accountId,
      dto.cashboxOrBankAccountId,
      dto.supplierId,
    );

    const legs = this.resolveLegs(dto.splitAccounts, baseAmount, exchangeRate, dto.accountId);
    const accountNames = await this.validateSplitAccounts(companyId, legs, [
      dto.cashboxOrBankAccountId,
      dto.accountId,
    ]);

    const year = new Date().getFullYear();
    let voucherNumber: string;
    if (dto.voucherNumber && dto.voucherNumber.trim()) {
      voucherNumber = dto.voucherNumber.trim();
    } else {
      const count = await this.prisma.paymentVoucher.count({ where: { companyId } });
      voucherNumber = `PV-${year}-${String(count + 1).padStart(4, '0')}`;
    }
    const jvNumber = `JV-${voucherNumber}`;

    // The ledger holds base-currency figures, so the lines describe themselves in
    // that currency and name the original amount and rate alongside it.
    const ctx: VoucherLineContext = {
      kind: 'PAYMENT',
      voucherNumber,
      totalAmount: baseAmount,
      currency: this.BASE_CURRENCY,
      cashboxAccountId: dto.cashboxOrBankAccountId,
      primaryAccountId: dto.accountId,
      accountNames,
      partyName,
      note,
      originalAmount: amount,
      originalCurrency: currency,
      exchangeRate,
    };

    return this.prisma.$transaction(async (tx) => {
      const journalEntry = await tx.journalEntry.create({
        data: {
          entryNumber: jvNumber,
          date: dto.date ? new Date(dto.date) : new Date(),
          reference: dto.reference || voucherNumber,
          description: buildEntryDescription(legs, ctx),
          status: 'POSTED',
          totalDebit: new Prisma.Decimal(baseAmount),
          totalCredit: new Prisma.Decimal(baseAmount),
          companyId,
          createdById: userId,
          postedById: userId,
          lines: {
            create: buildVoucherLines(legs, ctx).map((line) => ({
              accountId: line.accountId,
              debit: new Prisma.Decimal(line.debit),
              credit: new Prisma.Decimal(line.credit),
              description: line.description,
            })),
          },
        },
      });

      const voucher = await tx.paymentVoucher.create({
        data: {
          voucherNumber,
          date: dto.date ? new Date(dto.date) : new Date(),
          amount: new Prisma.Decimal(amount),
          currency,
          exchangeRate: new Prisma.Decimal(exchangeRate),
          accountId: dto.accountId,
          cashboxOrBankAccountId: dto.cashboxOrBankAccountId,
          supplierId: dto.supplierId || null,
          reference: dto.reference || null,
          description: note,
          status: 'POSTED',
          journalEntryId: journalEntry.id,
          companyId,
          createdById: userId,
        },
      });

      await this.applyBalanceDeltas(
        tx,
        this.postingDeltas(legs, dto.cashboxOrBankAccountId, baseAmount),
      );

      await tx.auditLog.create({
        data: {
          action: 'CREATE_PAYMENT_VOUCHER',
          entity: 'PaymentVoucher',
          entityId: voucher.id,
          details: JSON.stringify({ voucherNumber, amount, supplierId: dto.supplierId }),
          userId,
          companyId,
        },
      });

      return voucher;
    });
  }

  async remove(id: string, companyId: string) {
    const voucher = await this.prisma.paymentVoucher.findFirst({
      where: { id, companyId },
      include: { journalEntry: { include: { lines: true } } },
    });

    if (!voucher) throw new NotFoundException('سند الدفع غير موجود');

    return this.prisma.$transaction(async (tx) => {
      // Undo exactly what was posted, line by line — the only reversal that stays
      // correct when the entry debited several accounts instead of one. The lines
      // already carry base-currency figures, so no rate is reapplied here.
      await this.applyBalanceDeltas(tx, this.reverseDeltas(voucher.journalEntry?.lines ?? []));

      const jId = voucher.journalEntryId;
      const deleted = await tx.paymentVoucher.delete({ where: { id } });

      if (jId) {
        await tx.journalEntryLine.deleteMany({ where: { journalEntryId: jId } }).catch(() => {});
        await tx.journalEntry.delete({ where: { id: jId } }).catch(() => {});
      }

      return deleted;
    });
  }

  /**
   * The mirror of the receipt-side backfill. Payment vouchers written before the split
   * became a real posting still carry it only as a `[[VOUCHER_SPLIT:...]]` marker while
   * their entry debits one account for the whole amount — so the split accounts show
   * nothing in their statements and their balances are short by their share.
   *
   * Legacy marker amounts are in the voucher's own currency, so they go through
   * `resolveLegs` and are scaled by the stored rate before anything is posted.
   * It reports first; the ledger is only touched when `apply` is true.
   */
  async backfillLegacySplits(companyId: string, apply = false) {
    const candidates = await this.prisma.paymentVoucher.findMany({
      where: { companyId, description: { contains: VOUCHER_SPLIT_MARKER } },
      include: {
        journalEntry: { include: { lines: true } },
        supplier: { select: { nameAr: true } },
      },
      orderBy: [{ date: 'desc' }],
      take: 500,
    });

    const pending: any[] = [];
    const skipped: any[] = [];

    for (const voucher of candidates) {
      const { splits } = parseLegacySplitMarker(voucher.description);
      if (splits.length === 0) continue;

      // Already posted as a split? Then there is nothing to repair.
      const postedLegs = splitsFromJournalLines(
        voucher.journalEntry?.lines ?? [],
        voucher.cashboxOrBankAccountId,
        'PAYMENT',
      ).filter((leg) => leg.accountId !== voucher.accountId);
      if (postedLegs.length > 0) continue;

      const exchangeRate = Number(voucher.exchangeRate) || 1;
      const baseAmount = (Number(voucher.amount) || 0) * exchangeRate;

      let legs;
      try {
        legs = this.resolveLegs(splits, baseAmount, exchangeRate, voucher.accountId);
        await this.validateSplitAccounts(companyId, legs, [
          voucher.cashboxOrBankAccountId,
          voucher.accountId,
        ]);
      } catch (err: any) {
        skipped.push({
          voucherNumber: voucher.voucherNumber,
          amount: Number(voucher.amount) || 0,
          reason: err?.message || 'تعذّر تفسير التقسيم',
        });
        continue;
      }

      pending.push({
        id: voucher.id,
        voucherNumber: voucher.voucherNumber,
        date: voucher.date,
        amount: Number(voucher.amount) || 0,
        currency: voucher.currency,
        baseAmount,
        currentLines: voucher.journalEntry?.lines?.length ?? 0,
        newLines: legs.length + 1,
        distribution: legs.map((leg) => ({ accountId: leg.accountId, amount: leg.amount })),
      });
    }

    if (!apply) {
      return {
        applied: false,
        note: 'تقرير فقط — لم يُعدَّل أي قيد. أعد الطلب مع apply=1 للتنفيذ.',
        needsReposting: pending.length,
        skipped,
        vouchers: pending,
      };
    }

    const reposted: string[] = [];
    const failed: any[] = [];

    for (const item of pending) {
      try {
        const voucher = candidates.find((v) => v.id === item.id)!;
        const parsed = parseLegacySplitMarker(voucher.description);
        const exchangeRate = Number(voucher.exchangeRate) || 1;
        const baseAmount = (Number(voucher.amount) || 0) * exchangeRate;
        const legs = this.resolveLegs(parsed.splits, baseAmount, exchangeRate, voucher.accountId);
        const accountNames = await this.validateSplitAccounts(companyId, legs, [
          voucher.cashboxOrBankAccountId,
          voucher.accountId,
        ]);

        const ctx: VoucherLineContext = {
          kind: 'PAYMENT',
          voucherNumber: voucher.voucherNumber,
          totalAmount: baseAmount,
          currency: this.BASE_CURRENCY,
          cashboxAccountId: voucher.cashboxOrBankAccountId,
          primaryAccountId: voucher.accountId,
          accountNames,
          partyName: voucher.supplier?.nameAr || null,
          note: parsed.cleanDescription,
          originalAmount: Number(voucher.amount) || 0,
          originalCurrency: voucher.currency,
          exchangeRate,
        };

        await this.prisma.$transaction(async (tx) => {
          await this.applyBalanceDeltas(tx, this.reverseDeltas(voucher.journalEntry?.lines ?? []));
          await this.applyBalanceDeltas(
            tx,
            this.postingDeltas(legs, voucher.cashboxOrBankAccountId, baseAmount),
          );

          if (voucher.journalEntryId) {
            await tx.journalEntryLine.deleteMany({
              where: { journalEntryId: voucher.journalEntryId },
            });
            await tx.journalEntry.update({
              where: { id: voucher.journalEntryId },
              data: {
                description: buildEntryDescription(legs, ctx),
                totalDebit: new Prisma.Decimal(baseAmount),
                totalCredit: new Prisma.Decimal(baseAmount),
                lines: {
                  create: buildVoucherLines(legs, ctx).map((line) => ({
                    accountId: line.accountId,
                    debit: new Prisma.Decimal(line.debit),
                    credit: new Prisma.Decimal(line.credit),
                    description: line.description,
                  })),
                },
              },
            });
          }

          // The marker has done its job now that the split is in the ledger.
          await tx.paymentVoucher.update({
            where: { id: voucher.id },
            data: { description: parsed.cleanDescription },
          });
        });

        reposted.push(voucher.voucherNumber);
      } catch (err: any) {
        failed.push({ voucherNumber: item.voucherNumber, reason: err?.message || 'خطأ' });
      }
    }

    return { applied: true, repostedCount: reposted.length, reposted, failed, skipped };
  }

  /**
   * Vouchers posted before the lines learned to describe themselves still carry the
   * old generic text — and a journal line's description is the ONLY thing an account
   * statement shows, so those statements read "صرف إلى حساب" and nothing more.
   *
   * This rewrites that text from the lines that are already posted. It reads the
   * distribution out of the ledger rather than re-deriving it, and writes back only
   * `description` — no debit, no credit, no balance is touched, so it cannot change
   * a single figure. It reports first; nothing is written unless `apply` is true.
   */
  async refreshLineDescriptions(companyId: string, apply = false, take = 500) {
    const vouchers = await this.prisma.paymentVoucher.findMany({
      where: { companyId, journalEntryId: { not: null } },
      include: {
        journalEntry: { include: { lines: true } },
        supplier: { select: { nameAr: true } },
      },
      orderBy: [{ date: 'desc' }],
      take,
    });

    // One query for every account name in the batch, instead of one per voucher.
    const accountIds = new Set<string>();
    for (const voucher of vouchers) {
      for (const line of voucher.journalEntry?.lines ?? []) {
        if (line.accountId) accountIds.add(line.accountId);
      }
    }
    const accounts = accountIds.size
      ? await this.prisma.account.findMany({
          where: { id: { in: Array.from(accountIds) }, companyId },
          select: { id: true, nameAr: true },
        })
      : [];
    const accountNames = new Map<string, string>(
      accounts.map((a): [string, string] => [a.id, a.nameAr]),
    );

    const planned: any[] = [];
    const skipped: any[] = [];

    for (const voucher of vouchers) {
      const lines = voucher.journalEntry?.lines ?? [];
      if (lines.length === 0) continue;

      const legs = splitsFromJournalLines(lines, voucher.cashboxOrBankAccountId, 'PAYMENT');
      if (legs.length === 0) continue;

      // A leg sharing the cashbox account would make the by-account mapping below
      // ambiguous. That entry is left exactly as it is rather than guessed at.
      if (legs.some((leg) => leg.accountId === voucher.cashboxOrBankAccountId)) {
        skipped.push({ voucherNumber: voucher.voucherNumber, reason: 'الصندوق يظهر كطرف مقابل أيضاً' });
        continue;
      }

      const parsed = parseLegacySplitMarker(voucher.description);
      const ctx: VoucherLineContext = {
        kind: 'PAYMENT',
        voucherNumber: voucher.voucherNumber,
        totalAmount: legs.reduce((sum, leg) => sum + leg.amount, 0),
        currency: this.BASE_CURRENCY,
        cashboxAccountId: voucher.cashboxOrBankAccountId,
        primaryAccountId: voucher.accountId,
        accountNames,
        partyName: voucher.supplier?.nameAr || null,
        note: parsed.cleanDescription,
        originalAmount: Number(voucher.amount) || 0,
        originalCurrency: voucher.currency,
        exchangeRate: Number(voucher.exchangeRate) || 1,
      };

      const rebuilt = new Map<string, string>(
        buildVoucherLines(legs, ctx).map((line): [string, string] => [line.accountId, line.description]),
      );

      const lineUpdates: Array<{ id: string; description: string }> = [];
      for (const line of lines) {
        if (!line.accountId) continue;
        const next = rebuilt.get(line.accountId);
        if (!next || next === line.description) continue;
        lineUpdates.push({ id: line.id, description: next });
      }

      const entryDescription = buildEntryDescription(legs, ctx);
      const entryChanged =
        !!voucher.journalEntryId && voucher.journalEntry?.description !== entryDescription;
      const voucherDescriptionChanged = parsed.cleanDescription !== (voucher.description || '');

      if (lineUpdates.length === 0 && !entryChanged && !voucherDescriptionChanged) continue;

      planned.push({
        id: voucher.id,
        journalEntryId: voucher.journalEntryId,
        voucherNumber: voucher.voucherNumber,
        entryDescription,
        cleanDescription: parsed.cleanDescription,
        entryChanged,
        voucherDescriptionChanged,
        lineUpdates,
        sample: lineUpdates[0]?.description,
      });
    }

    if (!apply) {
      return {
        applied: false,
        note: 'تقرير فقط — لم يُعدَّل أي وصف. أعد الطلب مع apply=1 للتنفيذ. الأرصدة والمبالغ لا تتغيّر إطلاقاً.',
        vouchersToUpdate: planned.length,
        linesToUpdate: planned.reduce((sum, item) => sum + item.lineUpdates.length, 0),
        skipped,
        preview: planned.slice(0, 20).map((item) => ({
          voucherNumber: item.voucherNumber,
          entryDescription: item.entryDescription,
          sample: item.sample,
        })),
      };
    }

    const updated: string[] = [];
    const failed: any[] = [];
    for (const item of planned) {
      try {
        await this.prisma.$transaction(async (tx) => {
          for (const update of item.lineUpdates) {
            await tx.journalEntryLine.update({
              where: { id: update.id },
              data: { description: update.description },
            });
          }
          if (item.entryChanged && item.journalEntryId) {
            await tx.journalEntry.update({
              where: { id: item.journalEntryId },
              data: { description: item.entryDescription },
            });
          }
          if (item.voucherDescriptionChanged) {
            await tx.paymentVoucher.update({
              where: { id: item.id },
              data: { description: item.cleanDescription },
            });
          }
        });
        updated.push(item.voucherNumber);
      } catch (err: any) {
        failed.push({ voucherNumber: item.voucherNumber, reason: err?.message || 'خطأ' });
      }
    }

    return { applied: true, updatedCount: updated.length, updated, failed, skipped };
  }

  async update(id: string, companyId: string, userId: string, dto: any) {
    try {
      const amount = Number(dto.amount);
      if (!amount || amount <= 0) {
        throw new BadRequestException('مبلغ سند الدفع يجب أن يكون أكبر من الصفر');
      }

      const voucher = await this.prisma.paymentVoucher.findFirst({

        where: { id, companyId },
        include: { journalEntry: { include: { lines: true } } },
      });

      if (!voucher) throw new NotFoundException('سند الدفع غير موجود');

      const newAccountId = dto.accountId || voucher.accountId;
      const newCashboxId = dto.cashboxOrBankAccountId || voucher.cashboxOrBankAccountId;
      const newSupplierId = dto.supplierId !== undefined ? (dto.supplierId || null) : voucher.supplierId;
      const currency = this.normalizeCurrency(dto.currency ?? voucher.currency);
      const exchangeRate = this.resolveRate(
        currency,
        dto.exchangeRate ?? Number(voucher.exchangeRate) ?? 1,
      );
      const baseAmount = amount * exchangeRate;
      const note = this.cleanDescription(dto.description ?? voucher.description);
      const partyName = await this.validateReferences(
        companyId,
        newAccountId,
        newCashboxId,
        newSupplierId,
      );

    const legs = this.resolveLegs(dto.splitAccounts, baseAmount, exchangeRate, newAccountId);
    const accountNames = await this.validateSplitAccounts(companyId, legs, [
      newCashboxId,
      newAccountId,
    ]);
    const ctx: VoucherLineContext = {
      kind: 'PAYMENT',
      voucherNumber: voucher.voucherNumber,
      totalAmount: baseAmount,
      currency: this.BASE_CURRENCY,
      cashboxAccountId: newCashboxId,
      primaryAccountId: newAccountId,
      accountNames,
      partyName,
      note,
      originalAmount: amount,
      originalCurrency: currency,
      exchangeRate,
    };

    return this.prisma.$transaction(async (tx) => {
      // 1. Undo the previous posting from its own lines, not from the voucher's
      //    single accountId — that field cannot describe an entry that debited
      //    several accounts, and reversing by it leaves the others skewed forever.
      await this.applyBalanceDeltas(tx, this.reverseDeltas(voucher.journalEntry?.lines ?? []));

      // 2. Apply the new posting.
      await this.applyBalanceDeltas(tx, this.postingDeltas(legs, newCashboxId, baseAmount));

      // 3. Rewrite the entry's lines to match.
      if (voucher.journalEntryId) {
        await tx.journalEntryLine.deleteMany({ where: { journalEntryId: voucher.journalEntryId } });
        await tx.journalEntry.update({
          where: { id: voucher.journalEntryId },
          data: {
            date: dto.date ? new Date(dto.date) : voucher.date,
            description: buildEntryDescription(legs, ctx),
            totalDebit: new Prisma.Decimal(baseAmount),
            totalCredit: new Prisma.Decimal(baseAmount),
            lines: {
              create: buildVoucherLines(legs, ctx).map((line) => ({
                accountId: line.accountId,
                debit: new Prisma.Decimal(line.debit),
                credit: new Prisma.Decimal(line.credit),
                description: line.description,
              })),
            },
          },
        });
      }

      // 4. Update Voucher
      const updatedVoucher = await tx.paymentVoucher.update({
        where: { id },
        data: {
          amount: new Prisma.Decimal(amount),
          currency,
          exchangeRate: new Prisma.Decimal(exchangeRate),
          date: dto.date ? new Date(dto.date) : voucher.date,
          accountId: newAccountId,
          cashboxOrBankAccountId: newCashboxId,
          supplierId: newSupplierId,
          reference: dto.reference !== undefined ? dto.reference : voucher.reference,
          description: note,
        },
      });

      return updatedVoucher;
    });
    } catch (err) {
      console.error('Error in PaymentVouchersService.update:', err);
      throw err;
    }
  }
}
