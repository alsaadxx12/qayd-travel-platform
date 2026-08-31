import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { IsNotEmpty, IsString, IsNumber, IsOptional, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SplitInput,
  PostingLeg,
  normalizeVoucherSplits,
  balanceDeltasFromLines,
  splitsFromJournalLines,
  buildVoucherLines,
  parseLegacySplitMarker,
  buildEntryDescription,
  VoucherLineContext,
  VOUCHER_SPLIT_MARKER,
} from '../vouchers/voucher-splits';
import { rethrowVoucherWriteError } from '../vouchers/voucher-write-error';

export class CreateReceiptVoucherDto {
  @ApiPropertyOptional({ example: '2026-08-03', description: 'تاريخ السند' })
  @IsString()
  @IsOptional()
  date?: string;

  @ApiProperty({ example: 5000, description: 'مبلغ سند القبض' })
  @Type(() => Number)
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

  @ApiPropertyOptional({ example: 1550, description: 'سعر الصرف' })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  exchangeRate?: number;

  @ApiPropertyOptional({ description: 'طريقة التسديد' })
  @IsString()
  @IsOptional()
  paymentMethodId?: string;

  @ApiPropertyOptional({ description: 'عدد المرفقات والوصولات' })
  @Type(() => Number)
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
    customerId?: string | null,
  ) {
    const [account, cashboxAccount, customer] = await Promise.all([
      this.prisma.account.findFirst({ where: { id: accountId, companyId }, select: { id: true } }),
      this.prisma.account.findFirst({ where: { id: cashboxOrBankAccountId, companyId }, select: { id: true } }),
      customerId
        ? this.prisma.customer.findFirst({
            where: { id: customerId, companyId },
            select: { id: true, nameAr: true },
          })
        : Promise.resolve(null),
    ]);

    if (!account) throw new BadRequestException('حساب الطرف المحدد لا ينتمي إلى الشركة الحالية');
    if (!cashboxAccount) throw new BadRequestException('حساب الصندوق أو البنك لا ينتمي إلى الشركة الحالية');
    if (customerId && !customer) throw new BadRequestException('العميل المحدد لا ينتمي إلى الشركة الحالية');

    // The payer's name is fetched here anyway, so it is returned rather than
    // re-queried when the line descriptions are written.
    return customer?.nameAr || null;
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
            currency: true,
            exchangeRate: true,
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
        currency: _entry?.currency || 'IQD',
        exchangeRate: _entry?.exchangeRate || 1,
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

  /**
   * Generates or validates a unique voucherNumber and jvNumber for the company.
   * If the requested voucherNumber already exists, it auto-resolves by incrementing
   * the numeric sequence to avoid unique-constraint collisions.
   */
  private async resolveUniqueVoucherNumbers(
    companyId: string,
    requestedVoucherNumber?: string,
  ): Promise<{ voucherNumber: string; jvNumber: string }> {
    const year = new Date().getFullYear();
    let voucherNumber = (requestedVoucherNumber || '').trim();

    if (!voucherNumber) {
      const count = await this.prisma.receiptVoucher.count({ where: { companyId } });
      voucherNumber = `RV-${year}-${String(count + 1).padStart(4, '0')}`;
    }

    // Check if voucherNumber exists in receipt_vouchers
    let existingVoucher = await this.prisma.receiptVoucher.findUnique({
      where: { companyId_voucherNumber: { companyId, voucherNumber } },
    });

    if (existingVoucher) {
      // Auto-increment to find next available sequence
      const prefixMatch = voucherNumber.match(/^(.*?)(\d+)$/);
      if (prefixMatch) {
        const prefix = prefixMatch[1];
        let num = parseInt(prefixMatch[2], 10);
        const padLen = prefixMatch[2].length;
        while (existingVoucher) {
          num++;
          voucherNumber = `${prefix}${String(num).padStart(padLen, '0')}`;
          existingVoucher = await this.prisma.receiptVoucher.findUnique({
            where: { companyId_voucherNumber: { companyId, voucherNumber } },
          });
        }
      } else {
        voucherNumber = `${voucherNumber}-${Date.now().toString().slice(-4)}`;
      }
    }

    let jvNumber = `JV-${voucherNumber}`;
    let existingJv = await this.prisma.journalEntry.findUnique({
      where: { companyId_entryNumber: { companyId, entryNumber: jvNumber } },
    });
    if (existingJv) {
      jvNumber = `JV-${voucherNumber}-${Date.now().toString().slice(-4)}`;
    }

    return { voucherNumber, jvNumber };
  }

  async create(companyId: string, userId: string, dto: CreateReceiptVoucherDto) {
    const amount = Number(dto.amount);
    if (!amount || amount <= 0) {
      throw new BadRequestException('مبلغ سند القبض يجب أن يكون أكبر من الصفر');
    }
    // A legacy marker in the note would end up printed in every statement line.
    const note = this.cleanDescription(dto.description);
    const partyName = await this.validateReferences(
      companyId,
      dto.accountId,
      dto.cashboxOrBankAccountId,
      dto.customerId,
    );

    // The split is a real distribution of the credit side. `normalizeVoucherSplits`
    // guarantees the legs sum to the amount, with the primary account taking the
    // remainder — so with no split this is the original single-line posting.
    const legs = normalizeVoucherSplits(dto.splitAccounts, amount, dto.accountId);
    const accountNames = await this.validateSplitAccounts(companyId, legs, [
      dto.cashboxOrBankAccountId,
      dto.accountId,
    ]);

    const { voucherNumber, jvNumber } = await this.resolveUniqueVoucherNumbers(
      companyId,
      dto.voucherNumber,
    );

    const currency = dto.currency === 'USD' ? 'USD' : 'IQD';
    const exchangeRate = Number(dto.exchangeRate) || 1;

    const ctx: VoucherLineContext = {
      kind: 'RECEIPT',
      voucherNumber,
      totalAmount: amount,
      currency,
      exchangeRate,
      cashboxAccountId: dto.cashboxOrBankAccountId,
      primaryAccountId: dto.accountId,
      accountNames,
      partyName,
      note,
    };

    try {
      return await this.prisma.$transaction(async (tx) => {
        const journalEntry = await tx.journalEntry.create({
          data: {
            entryNumber: jvNumber,
            date: dto.date ? new Date(dto.date) : new Date(),
            reference: dto.reference || voucherNumber,
            description: buildEntryDescription(legs, ctx),
            status: 'POSTED',
            totalDebit: new Prisma.Decimal(amount),
            totalCredit: new Prisma.Decimal(amount),
            currency,
            exchangeRate: new Prisma.Decimal(exchangeRate),
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

        // ReceiptVoucher has no currency/exchangeRate columns (unlike PaymentVoucher).
        // Those live on the journal entry. Passing them here made Prisma reject the
        // write with an inspect dump that the UI showed as the save error.
        const voucher = await tx.receiptVoucher.create({
          data: {
            voucherNumber,
            date: dto.date ? new Date(dto.date) : new Date(),
            amount: new Prisma.Decimal(amount),
            accountId: dto.accountId,
            cashboxOrBankAccountId: dto.cashboxOrBankAccountId,
            customerId: dto.customerId || null,
            reference: dto.reference || null,
            description: note,
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
    } catch (err: any) {
      rethrowVoucherWriteError(err, 'تعذّر إنشاء سند القبض في النظام.');
    }
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
        await this.validateSplitAccounts(companyId, legs, [
          voucher.cashboxOrBankAccountId,
          voucher.accountId,
        ]);
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

        // Re-posting is also the moment to give these old entries the same
        // self-describing lines a new voucher gets, and to drop the marker that
        // was being printed as noise in every statement.
        const parsed = parseLegacySplitMarker(voucher.description);
        const accountNames = await this.validateSplitAccounts(companyId, legs, [
          voucher.cashboxOrBankAccountId,
          voucher.accountId,
        ]);
        const ctx: VoucherLineContext = {
          kind: 'RECEIPT',
          voucherNumber: voucher.voucherNumber,
          totalAmount: amount,
          currency: 'IQD',
          cashboxAccountId: voucher.cashboxOrBankAccountId,
          primaryAccountId: voucher.accountId,
          accountNames,
          note: parsed.cleanDescription,
        };

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
                description: buildEntryDescription(legs, ctx),
                totalDebit: new Prisma.Decimal(amount),
                totalCredit: new Prisma.Decimal(amount),
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

          // The marker has served its purpose now that the split lives in the
          // ledger; leaving it would keep polluting the statement.
          await tx.receiptVoucher.update({
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
   * statement shows, so those statements read "قبض من حساب" and nothing more.
   *
   * This rewrites that text from the lines that are already posted. It reads the
   * distribution out of the ledger rather than re-deriving it, and writes back only
   * `description` — no debit, no credit, no balance is touched, so it cannot change
   * a single figure. It reports first; nothing is written unless `apply` is true.
   */
  async refreshLineDescriptions(companyId: string, apply = false, take = 500) {
    const vouchers = await this.prisma.receiptVoucher.findMany({
      where: { companyId, journalEntryId: { not: null } },
      include: {
        journalEntry: { include: { lines: true } },
        customer: { select: { nameAr: true } },
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

      const legs = splitsFromJournalLines(lines, voucher.cashboxOrBankAccountId, 'RECEIPT');
      if (legs.length === 0) continue;

      // A leg sharing the cashbox account would make the by-account mapping below
      // ambiguous. That entry is left exactly as it is rather than guessed at.
      if (legs.some((leg) => leg.accountId === voucher.cashboxOrBankAccountId)) {
        skipped.push({ voucherNumber: voucher.voucherNumber, reason: 'الصندوق يظهر كطرف مقابل أيضاً' });
        continue;
      }

      const parsed = parseLegacySplitMarker(voucher.description);
      const ctx: VoucherLineContext = {
        kind: 'RECEIPT',
        voucherNumber: voucher.voucherNumber,
        totalAmount: legs.reduce((sum, leg) => sum + leg.amount, 0),
        currency: 'IQD',
        cashboxAccountId: voucher.cashboxOrBankAccountId,
        primaryAccountId: voucher.accountId,
        accountNames,
        partyName: voucher.customer?.nameAr || null,
        note: parsed.cleanDescription,
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
            await tx.receiptVoucher.update({
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
      const partyName = await this.validateReferences(
        companyId,
        newAccountId,
        newCashboxId,
        newCustomerId,
      );
      const note = this.cleanDescription(dto.description ?? voucher.description);

    // Same guarantee as create: the legs always sum to the amount.
    const currency = dto.currency !== undefined ? (dto.currency === 'USD' ? 'USD' : 'IQD') : ((voucher as any).currency || 'IQD');
    const exchangeRate = dto.exchangeRate !== undefined ? Number(dto.exchangeRate) : Number((voucher as any).exchangeRate || 1);

    const legs = normalizeVoucherSplits(dto.splitAccounts, amount, newAccountId);
    const accountNames = await this.validateSplitAccounts(companyId, legs, [
      newCashboxId,
      newAccountId,
    ]);
    const ctx: VoucherLineContext = {
      kind: 'RECEIPT',
      voucherNumber: voucher.voucherNumber,
      totalAmount: amount,
      currency,
      exchangeRate,
      cashboxAccountId: newCashboxId,
      primaryAccountId: newAccountId,
      accountNames,
      partyName,
      note,
    };

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
            description: buildEntryDescription(legs, ctx),
            totalDebit: new Prisma.Decimal(amount),
            totalCredit: new Prisma.Decimal(amount),
            currency,
            exchangeRate: new Prisma.Decimal(exchangeRate),
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
      const updatedVoucher = await tx.receiptVoucher.update({
        where: { id },
        data: {
          amount: new Prisma.Decimal(amount),
          date: dto.date ? new Date(dto.date) : voucher.date,
          accountId: newAccountId,
          cashboxOrBankAccountId: newCashboxId,
          customerId: newCustomerId,
          reference: dto.reference !== undefined ? dto.reference : voucher.reference,
          description: note,
        },
      });

      return updatedVoucher;
    });
    } catch (err) {
      rethrowVoucherWriteError(err, 'تعذّر تعديل سند القبض في النظام.');
    }
  }
}
