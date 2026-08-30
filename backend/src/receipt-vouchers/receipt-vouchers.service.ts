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
  parseLegacySplitMarker,
  VOUCHER_SPLIT_MARKER,
} from '../vouchers/voucher-splits';

export class CreateReceiptVoucherDto {
  @ApiPropertyOptional({ example: '2026-08-03', description: 'تاريخ السند' })
  @IsString()
  @IsOptional()
  date?: string;

  @ApiProperty({ example: 5000, description: 'مبلغ سند القبض' })
  @IsNumber()
  amount: number;

  @ApiProperty({ description: 'معرف الحساب الدائن (مثل حساب العميل)' })
  @IsString()
  @IsNotEmpty()
  accountId: string;

  @ApiProperty({ description: 'معرف حساب الصندوق أو البنك (المدين)' })
  @IsString()
  @IsNotEmpty()
  cashboxOrBankAccountId: string;

  @ApiPropertyOptional({ description: 'معرف العميل' })
  @IsString()
  @IsOptional()
  customerId?: string;

  @ApiPropertyOptional({ example: 'CHQ-9001', description: 'رقم الشيك أو التحويل' })
  @IsString()
  @IsOptional()
  reference?: string;

  @ApiProperty({ example: 'دفعة سداد حساب تذاكر طيران', description: 'البيان والتفاصيل' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ example: 'IQD', description: 'عملة السند' })
  @IsString()
  @IsOptional()
  currency?: string;

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
      'توزيع المبلغ على حسابات متعددة. كل عنصر { accountId, amount }. الحساب المقابل يستوعب الباقي تلقائياً.',
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
export class ReceiptVouchersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Applies a set of signed balance changes. A positive delta increments.
   * Accounts that no longer exist are skipped rather than aborting the whole entry.
   */
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

  /** Balance effect of a fresh posting: cashbox debited, each leg credited. */
  private postingDeltas(legs: PostingLeg[], cashboxAccountId: string, amount: number) {
    const deltas = new Map<string, number>();
    deltas.set(cashboxAccountId, (deltas.get(cashboxAccountId) ?? 0) + amount);
    for (const leg of legs) {
      deltas.set(leg.accountId, (deltas.get(leg.accountId) ?? 0) - leg.amount);
    }
    return deltas;
  }

  /** Every split target must be a real account of this company. */
  private async validateSplitAccounts(companyId: string, legs: PostingLeg[]) {
    const ids = Array.from(new Set(legs.map((l) => l.accountId)));
    if (ids.length === 0) return;
    const found = await this.prisma.account.findMany({
      where: { id: { in: ids }, companyId },
      select: { id: true },
    });
    const known = new Set(found.map((a) => a.id));
    const missing = ids.filter((id) => !known.has(id));
    if (missing.length > 0) {
      throw new BadRequestException('أحد حسابات التقسيم لا ينتمي إلى الشركة الحالية');
    }
  }

  private async validateReferences(
    companyId: string,
    accountId: string,
    cashboxOrBankAccountId: string,
    customerId?: string | null,
  ) {
    const [account, cashboxAccount, customer] = await Promise.all([
      this.prisma.account.findFirst({ where: { id: accountId, companyId }, select: { id: true } }),
      this.prisma.account.findFirst({ where: { id: cashboxOrBankAccountId, companyId }, select: { id: true } }),
      customerId
        ? this.prisma.customer.findFirst({ where: { id: customerId, companyId }, select: { id: true } })
        : Promise.resolve(null),
    ]);

    if (!account) throw new BadRequestException('حساب الطرف المحدد لا ينتمي إلى الشركة الحالية');
    if (!cashboxAccount) throw new BadRequestException('حساب الصندوق أو البنك لا ينتمي إلى الشركة الحالية');
    if (customerId && !customer) throw new BadRequestException('العميل المحدد لا ينتمي إلى الشركة الحالية');
  }

  /**
   * List view. It once did `include: { journalEntry: true }` with no `take`, pulling
   * every voucher ever written together with its whole entry object — the single
   * biggest cost on the vouchers page.
   *
   * The entry's LINES are still needed, because the split columns are read from the
   * ledger rather than from a marker in the description. Only three tiny numeric
   * columns are selected, and the row count is capped, so this is a fraction of what
   * the old include cost.
   */
  async findAll(companyId: string, requestedLimit?: number) {
    const take = Math.min(Math.max(Number(requestedLimit) || 150, 1), 300);
    const rows = await this.prisma.receiptVoucher.findMany({
      where: { companyId },
      select: {
        id: true,
        voucherNumber: true,
        date: true,
        amount: true,
        accountId: true,
        cashboxOrBankAccountId: true,
        customerId: true,
        reference: true,
        description: true,
        status: true,
        createdAt: true,
        account: { select: { id: true, code: true, nameAr: true } },
        cashboxOrBankAccount: { select: { id: true, code: true, nameAr: true } },
        customer: { select: { id: true, code: true, nameAr: true } },
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

    // Same derivation as findOne: the split is whatever the entry credited, minus
    // the primary account's remainder leg. One source of truth for both views.
    return rows.map((row: any) => {
      const legs = splitsFromJournalLines(
        row.journalEntry?.lines ?? [],
        row.cashboxOrBankAccountId,
        'RECEIPT',
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
          amount: leg.amount,
        })),
      };
    });
  }

  async findOne(id: string, companyId: string) {
    const voucher = await this.prisma.receiptVoucher.findFirst({
      where: { id, companyId },
      include: {
        account: { select: { id: true, code: true, nameAr: true } },
        cashboxOrBankAccount: { select: { id: true, code: true, nameAr: true } },
        customer: { select: { id: true, code: true, nameAr: true } },
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
    if (!voucher) throw new NotFoundException('سند القبض غير موجود');

    // The split is not stored beside the voucher — it IS the entry's credit lines.
    // Reading it back from there keeps one source of truth and cannot drift.
    const legs = splitsFromJournalLines(
      voucher.journalEntry?.lines ?? [],
      voucher.cashboxOrBankAccountId,
      'RECEIPT',
    );
    const byId = new Map(
      (voucher.journalEntry?.lines ?? []).map((l: any) => [l.accountId, l.account?.nameAr || '']),
    );
    // The primary account's leg is the REMAINDER, which the editor derives itself.
    // Returning it would have it loaded back as a custom split and counted twice,
    // driving the remainder to zero — the same double-count this design avoids.
    return {
      ...voucher,
      splitAccounts: legs
        .filter((leg) => leg.accountId !== voucher.accountId)
        .map((leg) => ({
          accountId: leg.accountId,
          accountName: byId.get(leg.accountId) || '',
          amount: leg.amount,
        })),
    };
  }

  async create(companyId: string, userId: string, dto: CreateReceiptVoucherDto) {
    const amount = Number(dto.amount);
    if (!amount || amount <= 0) {
      throw new BadRequestException('مبلغ سند القبض يجب أن يكون أكبر من الصفر');
    }
    await this.validateReferences(companyId, dto.accountId, dto.cashboxOrBankAccountId, dto.customerId);

    // The split is a real distribution of the credit side. `normalizeVoucherSplits`
    // guarantees the legs sum to the amount, with the primary account taking the
    // remainder — so with no split this is the original single-line posting.
    const legs = normalizeVoucherSplits(dto.splitAccounts, amount, dto.accountId);
    await this.validateSplitAccounts(companyId, legs);

    const year = new Date().getFullYear();
    let voucherNumber: string;
    if (dto.voucherNumber && dto.voucherNumber.trim()) {
      voucherNumber = dto.voucherNumber.trim();
    } else {
      const count = await this.prisma.receiptVoucher.count({ where: { companyId } });
      voucherNumber = `RV-${year}-${String(count + 1).padStart(4, '0')}`;
    }
    const jvNumber = `JV-${voucherNumber}`;

    return this.prisma.$transaction(async (tx) => {
      const journalEntry = await tx.journalEntry.create({
        data: {
          entryNumber: jvNumber,
          date: dto.date ? new Date(dto.date) : new Date(),
          reference: dto.reference || voucherNumber,
          description: `سند قبض رقم ${voucherNumber}: ${dto.description}`,
          status: 'POSTED',
          totalDebit: new Prisma.Decimal(amount),
          totalCredit: new Prisma.Decimal(amount),
          companyId,
          createdById: userId,
          postedById: userId,
          lines: {
            create: buildVoucherLines(
              legs,
              dto.cashboxOrBankAccountId,
              amount,
              'RECEIPT',
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

      const voucher = await tx.receiptVoucher.create({
        data: {
          voucherNumber,
          date: dto.date ? new Date(dto.date) : new Date(),
          amount: new Prisma.Decimal(amount),
          accountId: dto.accountId,
          cashboxOrBankAccountId: dto.cashboxOrBankAccountId,
          customerId: dto.customerId || null,
          reference: dto.reference || null,
          description: dto.description,
          status: 'POSTED',
          journalEntryId: journalEntry.id,
          companyId,
          createdById: userId,
        },
      });

      // One decrement per credited account, so a split moves each account's balance
      // by its own share rather than dumping the whole amount on one of them.
      await this.applyBalanceDeltas(
        tx,
        this.postingDeltas(legs, dto.cashboxOrBankAccountId, amount),
      );

      await tx.auditLog.create({
        data: {
          action: 'CREATE_RECEIPT_VOUCHER',
          entity: 'ReceiptVoucher',
          entityId: voucher.id,
          details: JSON.stringify({ voucherNumber, amount, customerId: dto.customerId }),
          userId,
          companyId,
        },
      });

      return voucher;
    });
  }

  /**
   * Vouchers created before the split became a real posting still carry it only as a
   * `[[VOUCHER_SPLIT:...]]` marker in the description, while their journal entry has
   * a single counter line for the full amount. Those splits therefore never show up
   * in the split account's statement — the line simply is not there.
   *
   * This finds them and, only when `apply` is true, re-posts them: the old lines are
   * reversed from themselves and the entry is rewritten with one line per account.
   * It reports first by design — nothing touches the ledger on a dry run.
   */
  async backfillLegacySplits(companyId: string, apply = false) {
    const candidates = await this.prisma.receiptVoucher.findMany({
      where: { companyId, description: { contains: VOUCHER_SPLIT_MARKER } },
      include: { journalEntry: { include: { lines: true } } },
      orderBy: [{ date: 'desc' }],
      take: 500,
    });

    const pending: any[] = [];
    const skipped: any[] = [];

    for (const voucher of candidates) {
      const amount = Number(voucher.amount) || 0;
      const { splits } = parseLegacySplitMarker(voucher.description);
      if (splits.length === 0) continue;

      // Already posted with a split? Then there is nothing to do.
      const postedLegs = splitsFromJournalLines(
        voucher.journalEntry?.lines ?? [],
        voucher.cashboxOrBankAccountId,
        'RECEIPT',
      ).filter((leg) => leg.accountId !== voucher.accountId);
      if (postedLegs.length > 0) continue;

      let legs;
      try {
        legs = normalizeVoucherSplits(splits, amount, voucher.accountId);
        await this.validateSplitAccounts(companyId, legs);
      } catch (err: any) {
        skipped.push({
          voucherNumber: voucher.voucherNumber,
          amount,
          reason: err?.message || 'تعذّر تفسير التقسيم',
        });
        continue;
      }

      pending.push({
        id: voucher.id,
        voucherNumber: voucher.voucherNumber,
        date: voucher.date,
        amount,
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
        const legs = normalizeVoucherSplits(
          parseLegacySplitMarker(voucher.description).splits,
          Number(voucher.amount) || 0,
          voucher.accountId,
        );
        const amount = Number(voucher.amount) || 0;

        await this.prisma.$transaction(async (tx) => {
          await this.applyBalanceDeltas(tx, this.reverseDeltas(voucher.journalEntry?.lines ?? []));
          await this.applyBalanceDeltas(
            tx,
            this.postingDeltas(legs, voucher.cashboxOrBankAccountId, amount),
          );

          if (voucher.journalEntryId) {
            await tx.journalEntryLine.deleteMany({
              where: { journalEntryId: voucher.journalEntryId },
            });
            await tx.journalEntry.update({
              where: { id: voucher.journalEntryId },
              data: {
                totalDebit: new Prisma.Decimal(amount),
                totalCredit: new Prisma.Decimal(amount),
                lines: {
                  create: buildVoucherLines(
                    legs,
                    voucher.cashboxOrBankAccountId,
                    amount,
                    'RECEIPT',
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
        });

        reposted.push(voucher.voucherNumber);
      } catch (err: any) {
        failed.push({ voucherNumber: item.voucherNumber, reason: err?.message || 'خطأ' });
      }
    }

    return { applied: true, repostedCount: reposted.length, reposted, failed, skipped };
  }

  async remove(id: string, companyId: string) {
    const voucher = await this.prisma.receiptVoucher.findFirst({
      where: { id, companyId },
      include: { journalEntry: { include: { lines: true } } },
    });

    if (!voucher) throw new NotFoundException('سند القبض غير موجود');

    return this.prisma.$transaction(async (tx) => {
      // Undo exactly what was posted. Reversing from the voucher's own accountId
      // would only ever touch one account, which silently corrupts the balances of
      // a split entry that credited several.
      await this.applyBalanceDeltas(tx, this.reverseDeltas(voucher.journalEntry?.lines ?? []));

      const jId = voucher.journalEntryId;
      const deleted = await tx.receiptVoucher.delete({ where: { id } });

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
        throw new BadRequestException('مبلغ سند القبض يجب أن يكون أكبر من الصفر');
      }

      const voucher = await this.prisma.receiptVoucher.findFirst({
        where: { id, companyId },
        include: { journalEntry: { include: { lines: true } } },
      });

      if (!voucher) throw new NotFoundException('سند القبض غير موجود');

      const newCashboxId = dto.cashboxOrBankAccountId || voucher.cashboxOrBankAccountId;
      const newAccountId = dto.accountId || voucher.accountId;
      const newCustomerId = dto.customerId !== undefined ? (dto.customerId || null) : voucher.customerId;
      await this.validateReferences(companyId, newAccountId, newCashboxId, newCustomerId);

    // Same guarantee as create: the legs always sum to the amount.
    const legs = normalizeVoucherSplits(dto.splitAccounts, amount, newAccountId);
    await this.validateSplitAccounts(companyId, legs);

    return this.prisma.$transaction(async (tx) => {
      // 1. Undo the previous posting from its OWN lines. The old code reversed using
      //    the voucher's scalar accountId, which describes a single account and
      //    therefore cannot undo an entry that credited several — it would leave the
      //    extra accounts permanently skewed.
      await this.applyBalanceDeltas(tx, this.reverseDeltas(voucher.journalEntry?.lines ?? []));

      // 2. Apply the new posting.
      await this.applyBalanceDeltas(tx, this.postingDeltas(legs, newCashboxId, amount));

      // 3. Rewrite the entry's lines to match.
      if (voucher.journalEntryId) {
        await tx.journalEntryLine.deleteMany({ where: { journalEntryId: voucher.journalEntryId } });
        await tx.journalEntry.update({
          where: { id: voucher.journalEntryId },
          data: {
            date: dto.date ? new Date(dto.date) : voucher.date,
            description: `سند قبض رقم ${voucher.voucherNumber}: ${dto.description || voucher.description}`,
            totalDebit: new Prisma.Decimal(amount),
            totalCredit: new Prisma.Decimal(amount),
            lines: {
              create: buildVoucherLines(
                legs,
                newCashboxId,
                amount,
                'RECEIPT',
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
      const updatedVoucher = await tx.receiptVoucher.update({
        where: { id },
        data: {
          amount: new Prisma.Decimal(amount),
          date: dto.date ? new Date(dto.date) : voucher.date,
          accountId: newAccountId,
          cashboxOrBankAccountId: newCashboxId,
          customerId: newCustomerId,
          reference: dto.reference !== undefined ? dto.reference : voucher.reference,
          description: dto.description || voucher.description,
        },
      });

      return updatedVoucher;
    });
    } catch (err) {
      console.error('Error in ReceiptVouchersService.update:', err);
      throw err;
    }
  }
}
