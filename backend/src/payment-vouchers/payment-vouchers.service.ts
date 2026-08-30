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

  private async validateSplitAccounts(companyId: string, legs: PostingLeg[]) {
    const ids = Array.from(new Set(legs.map((l) => l.accountId)));
    if (ids.length === 0) return;
    const found = await this.prisma.account.findMany({
      where: { id: { in: ids }, companyId },
      select: { id: true },
    });
    const known = new Set(found.map((a) => a.id));
    if (ids.some((id) => !known.has(id))) {
      throw new BadRequestException('أحد حسابات التقسيم لا ينتمي إلى الشركة الحالية');
    }
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
        ? this.prisma.supplier.findFirst({ where: { id: supplierId, companyId }, select: { id: true } })
        : Promise.resolve(null),
    ]);

    const foundIds = new Set(accounts.map((item) => item.id));
    if (!foundIds.has(accountId)) throw new BadRequestException('حساب الطرف المحدد لا ينتمي إلى الشركة الحالية');
    if (!foundIds.has(cashboxOrBankAccountId)) throw new BadRequestException('حساب الصندوق أو البنك لا ينتمي إلى الشركة الحالية');
    if (supplierId && !supplier) throw new BadRequestException('المورد المحدد لا ينتمي إلى الشركة الحالية');
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
    await this.validateReferences(companyId, dto.accountId, dto.cashboxOrBankAccountId, dto.supplierId);

    const legs = this.resolveLegs(dto.splitAccounts, baseAmount, exchangeRate, dto.accountId);
    await this.validateSplitAccounts(companyId, legs);

    const year = new Date().getFullYear();
    let voucherNumber: string;
    if (dto.voucherNumber && dto.voucherNumber.trim()) {
      voucherNumber = dto.voucherNumber.trim();
    } else {
      const count = await this.prisma.paymentVoucher.count({ where: { companyId } });
      voucherNumber = `PV-${year}-${String(count + 1).padStart(4, '0')}`;
    }
    const jvNumber = `JV-${voucherNumber}`;

    return this.prisma.$transaction(async (tx) => {
      const journalEntry = await tx.journalEntry.create({
        data: {
          entryNumber: jvNumber,
          date: dto.date ? new Date(dto.date) : new Date(),
          reference: dto.reference || voucherNumber,
          description: `سند دفع رقم ${voucherNumber}: ${dto.description}`,
          status: 'POSTED',
          totalDebit: new Prisma.Decimal(baseAmount),
          totalCredit: new Prisma.Decimal(baseAmount),
          companyId,
          createdById: userId,
          postedById: userId,
          lines: {
            create: buildVoucherLines(
              legs,
              dto.cashboxOrBankAccountId,
              baseAmount,
              'PAYMENT',
              voucherNumber,
            ).map((line) => ({
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
          description: dto.description,
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
      await this.validateReferences(companyId, newAccountId, newCashboxId, newSupplierId);

    const legs = this.resolveLegs(dto.splitAccounts, baseAmount, exchangeRate, newAccountId);
    await this.validateSplitAccounts(companyId, legs);

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
            description: `سند دفع رقم ${voucher.voucherNumber}: ${dto.description || voucher.description}`,
            totalDebit: new Prisma.Decimal(baseAmount),
            totalCredit: new Prisma.Decimal(baseAmount),
            lines: {
              create: buildVoucherLines(
                legs,
                newCashboxId,
                baseAmount,
                'PAYMENT',
                voucher.voucherNumber,
              ).map((line) => ({
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
          description: dto.description || voucher.description,
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
