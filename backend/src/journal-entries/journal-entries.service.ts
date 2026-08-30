import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EntryStatus, Prisma } from '@prisma/client';
import { parseListLimit } from '../common/list-query';
import { parseLegacySplitMarker } from '../vouchers/voucher-splits';
import { IsNotEmpty, IsString, IsArray, ValidateNested, IsNumber, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class JournalLineDto {
  @ApiProperty({ description: 'معرف الحساب المحاسبي' })
  @IsString()
  @IsNotEmpty()
  accountId: string;

  @ApiProperty({ example: 1000, description: 'المبلغ المدين' })
  @IsNumber()
  debit: number;

  @ApiProperty({ example: 0, description: 'المبلغ الدائن' })
  @IsNumber()
  credit: number;

  @ApiPropertyOptional({ description: 'شرح السطر' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'مركز التكلفة' })
  @IsString()
  @IsOptional()
  costCenter?: string;
}

export class CreateJournalEntryDto {
  @ApiPropertyOptional({ example: '2026-08-03', description: 'تاريخ القيد' })
  @IsString()
  @IsOptional()
  date?: string;

  @ApiPropertyOptional({ example: 'INV-90021', description: 'رقم المرجع' })
  @IsString()
  @IsOptional()
  reference?: string;

  @ApiProperty({ example: 'إثبات مبيعات تذاكر طيران للخطوط السعودية', description: 'البيان الرئيسي للقيد' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ type: [JournalLineDto], description: 'سطور القيد (مدين ودائن)' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines: JournalLineDto[];

  @ApiPropertyOptional({ example: 'USD', description: 'عملة القيد كما كتبها المستخدم' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ example: 1550, description: 'سعر الصرف المعتمد لهذا القيد' })
  @IsNumber()
  @IsOptional()
  exchangeRate?: number;

  @ApiPropertyOptional({ example: true, description: 'ترحيل القيد فوراً' })
  @IsBoolean()
  @IsOptional()
  postImmediately?: boolean;

  @IsOptional()
  @IsString()
  entryNumber?: string;
}

/** The ledger's own currency. Every stored debit and credit is in it. */
const BASE_CURRENCY = 'IQD';

interface NormalizedLine {
  accountId: string;
  /** In the ledger's currency — this is what is stored and what moves balances. */
  debit: number;
  credit: number;
  /** What the user typed, in the entry's currency. Null when no conversion happened. */
  debitOriginal: number | null;
  creditOriginal: number | null;
  description?: string;
  costCenter?: string;
}

@Injectable()
export class JournalEntriesService {
  constructor(private prisma: PrismaService) {}

  /**
   * A journal entry may be written in a foreign currency, but the ledger is kept in
   * one currency — account balances, the trial balance and every report read `debit`
   * and `credit` directly and have no way to ask what currency a row is in. So the
   * conversion happens once, here, at the edge: the stored amounts are always in the
   * ledger's currency, while the entry keeps the currency and the rate it was written
   * with and each line keeps the original figure. Nothing downstream has to know.
   *
   * Before this existed, choosing USD changed a label and nothing else: 500 dollars
   * were posted as 500 dinars.
   */
  private normalizeLines(
    lines: Array<{ accountId: string; debit: number; credit: number; description?: string; costCenter?: string }>,
    currencyInput?: string | null,
    rateInput?: number | null,
  ): { currency: string; exchangeRate: number; lines: NormalizedLine[] } {
    const currency = String(currencyInput || BASE_CURRENCY).trim().toUpperCase() === 'USD' ? 'USD' : BASE_CURRENCY;
    let exchangeRate = 1;

    if (currency !== BASE_CURRENCY) {
      exchangeRate = Number(rateInput);
      if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
        throw new BadRequestException('سعر الصرف مطلوب وصحيح عند تسجيل قيد بعملة أجنبية');
      }
    }

    const round2 = (value: number) => Math.round(value * 100) / 100;
    const converted: NormalizedLine[] = lines.map((line) => {
      const debit = Number(line.debit) || 0;
      const credit = Number(line.credit) || 0;
      const isForeign = currency !== BASE_CURRENCY;
      return {
        accountId: line.accountId,
        debit: isForeign ? round2(debit * exchangeRate) : debit,
        credit: isForeign ? round2(credit * exchangeRate) : credit,
        debitOriginal: isForeign ? debit : null,
        creditOriginal: isForeign ? credit : null,
        description: line.description,
        costCenter: line.costCenter,
      };
    });

    // Rounding each side independently can leave a residue of a fraction, which would
    // post an entry that does not balance. It is pushed onto the largest line of the
    // short side, so the totals are exactly equal rather than nearly so.
    const sum = (pick: (l: NormalizedLine) => number) => converted.reduce((total, l) => total + pick(l), 0);
    const residue = round2(sum((l) => l.debit) - sum((l) => l.credit));
    if (residue !== 0) {
      const side: 'debit' | 'credit' = residue > 0 ? 'credit' : 'debit';
      const target = converted
        .filter((l) => l[side] > 0)
        .sort((a, b) => b[side] - a[side])[0];
      if (target) target[side] = round2(target[side] + Math.abs(residue));
    }

    return { currency, exchangeRate, lines: converted };
  }

  /**
   * An account statement shows the line's own description and nothing else, so a
   * converted line has to say what it was before conversion — otherwise the reader
   * sees 775,000 dinars against a voucher that says 500 dollars and cannot reconcile
   * the two.
   */
  private lineDescription(
    line: NormalizedLine,
    entryDescription: string,
    currency: string,
    exchangeRate: number,
  ): string {
    const base = (line.description || entryDescription || '').trim();
    if (currency === BASE_CURRENCY) return base;

    const original = (line.debitOriginal || 0) || (line.creditOriginal || 0);
    const money = (value: number) =>
      Number(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    const note = `(أصل المبلغ ${money(original)} ${currency} × ${money(exchangeRate)})`;
    return base ? `${base} ${note}` : note;
  }

  async findAll(companyId: string, status?: EntryStatus, search?: string, accountId?: string, limit?: string) {
    const take = parseListLimit(limit, 150, 300);
    const entries = await this.prisma.journalEntry.findMany({
      where: {
        companyId,
        ...(status ? { status } : {}),
        ...(search
          ? {
              OR: [
                { entryNumber: { contains: search } },
                { description: { contains: search } },
                { reference: { contains: search } },
              ],
            }
          : {}),
        ...(accountId
          ? {
              lines: {
                some: { accountId },
              },
            }
          : {}),
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        postedBy: { select: { id: true, name: true } },
        lines: {
          include: {
            account: { select: { id: true, nameAr: true, type: true } },
          },
        },
        receiptVouchers: { select: { id: true, voucherNumber: true, description: true, date: true } },
        paymentVouchers: { select: { id: true, voucherNumber: true, description: true, date: true } },
      },
      orderBy: { createdAt: 'desc' },
      take,
    });

    // A statement line must read like the voucher it came from, so the voucher's own
    // البيان travels with the entry instead of only the generated ledger sentence.
    return entries.map((entry) => {
      const voucher = entry.receiptVouchers[0] || entry.paymentVouchers[0] || null;
      const voucherType = entry.receiptVouchers.length
        ? 'RECEIPT'
        : entry.paymentVouchers.length
        ? 'PAYMENT'
        : '';

      return {
        ...entry,
        voucherId: voucher?.id || null,
        voucherNumber: voucher?.voucherNumber || null,
        voucherType,
        voucherDescription: voucher
          ? parseLegacySplitMarker(voucher.description).cleanDescription || null
          : null,
      };
    });
  }

  async findOne(id: string, companyId?: string) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: {
        id,
        ...(companyId ? { companyId } : {}),
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        postedBy: { select: { id: true, name: true } },
        lines: {
          include: {
            account: { select: { id: true, code: true, nameAr: true, type: true } },
          },
        },
      },
    }) || await this.prisma.journalEntry.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
        postedBy: { select: { id: true, name: true } },
        lines: {
          include: {
            account: { select: { id: true, code: true, nameAr: true, type: true } },
          },
        },
      },
    });

    if (!entry) throw new NotFoundException('القيد اليومي غير موجود');
    return entry;
  }

  async create(companyId: string, userId: string, dto: CreateJournalEntryDto) {
    if (!dto.lines || dto.lines.length < 2) {
      throw new BadRequestException('القيد يجب أن يحتوي على طرفين (سطرين) على الأقل (مدين ودائن)');
    }

    // The balance is checked on the figures the user actually typed, so the error
    // names the same numbers that are on their screen.
    let enteredDebit = 0;
    let enteredCredit = 0;

    dto.lines.forEach((line, index) => {
      const debit = Number(line.debit) || 0;
      const credit = Number(line.credit) || 0;
      if (debit < 0 || credit < 0) {
        throw new BadRequestException(`السطر رقم ${index + 1}: المبالغ يجب أن تكون موجبة`);
      }
      if (debit === 0 && credit === 0) {
        throw new BadRequestException(`السطر رقم ${index + 1}: يجب إدخال مبلغ مدين أو دائن`);
      }
      enteredDebit += debit;
      enteredCredit += credit;
    });

    const diff = Math.abs(enteredDebit - enteredCredit);
    if (diff > 0.001) {
      throw new BadRequestException(`القيد غير متوازن: المدين (${enteredDebit}) لا يساوي الدائن (${enteredCredit})، الفارق = ${diff}`);
    }

    const { currency, exchangeRate, lines: postedLines } = this.normalizeLines(
      dto.lines,
      dto.currency,
      dto.exchangeRate,
    );
    const totalDebit = postedLines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = postedLines.reduce((sum, l) => sum + l.credit, 0);

    const entryDate = dto.date ? new Date(dto.date) : new Date();
    const year = entryDate.getFullYear();
    let entryNumber: string;
    if (dto.entryNumber && dto.entryNumber.trim()) {
      entryNumber = dto.entryNumber.trim();
    } else {
      const count = await this.prisma.journalEntry.count({
        where: { companyId },
      });
      entryNumber = `JV-${year}-${String(count + 1).padStart(4, '0')}`;
    }

    // Resolve matching FiscalYear
    const fiscalYear = await this.prisma.fiscalYear.findFirst({
      where: {
        companyId,
        startDate: { lte: entryDate },
        endDate: { gte: entryDate },
      },
    });

    if (fiscalYear && (fiscalYear.status === 'CLOSED' || fiscalYear.status === 'SOFT_CLOSED')) {
      throw new BadRequestException(
        `لا يمكن إنشاء أو ترحيل قيود داخل سنة مالية مقفلة (${fiscalYear.name}). يرجى إعادة فتح السنة أولاً إذا كانت لديك الصلاحية.`
      );
    }

    // Resolve matching FiscalPeriod
    const period = await this.prisma.fiscalPeriod.findFirst({
      where: {
        companyId,
        ...(fiscalYear ? { fiscalYearId: fiscalYear.id } : {}),
        startDate: { lte: entryDate },
        endDate: { gte: entryDate },
      },
    });

    if (period && period.status !== 'OPEN') {
      throw new BadRequestException(
        `لا يمكن إنشاء أو ترحيل قيود داخل فترة محاسبية مقفلة (${period.name}).`
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          entryNumber,
          date: entryDate,
          reference: dto.reference || null,
          description: dto.description,
          status: dto.postImmediately ? 'POSTED' : 'DRAFT',
          totalDebit: new Prisma.Decimal(totalDebit),
          totalCredit: new Prisma.Decimal(totalCredit),
          currency,
          exchangeRate: new Prisma.Decimal(exchangeRate),
          companyId,
          fiscalYearId: fiscalYear?.id || null,
          fiscalPeriodId: period?.id || null,
          createdById: userId,
          postedById: dto.postImmediately ? userId : null,
          lines: {
            create: postedLines.map((line) => ({
              accountId: line.accountId,
              debit: new Prisma.Decimal(line.debit),
              credit: new Prisma.Decimal(line.credit),
              debitOriginal: line.debitOriginal === null ? null : new Prisma.Decimal(line.debitOriginal),
              creditOriginal: line.creditOriginal === null ? null : new Prisma.Decimal(line.creditOriginal),
              description: this.lineDescription(line, dto.description, currency, exchangeRate),
              costCenter: line.costCenter || null,
            })),
          },
        },
        include: { lines: true },
      });

      await tx.auditLog.create({
        data: {
          action: dto.postImmediately ? 'CREATE_AND_POST_JOURNAL_ENTRY' : 'CREATE_JOURNAL_ENTRY',
          entity: 'JournalEntry',
          entityId: entry.id,
          details: JSON.stringify({ entryNumber, totalDebit, totalCredit, currency, exchangeRate, status: entry.status }),
          userId,
          companyId,
        },
      });

      if (dto.postImmediately) {
        // Balances move by the CONVERTED amounts. Using the typed ones here would
        // put dollars into a dinar balance.
        for (const line of postedLines) {
          if (line.accountId) {
            const balanceChange = line.debit - line.credit;

            const accExists = await tx.account.findUnique({ where: { id: line.accountId } });
            if (accExists) {
              await tx.account.update({
                where: { id: line.accountId },
                data: {
                  balance: {
                    increment: new Prisma.Decimal(balanceChange),
                  },
                },
              });
            }
          }
        }
      }

      return entry;
    });
  }

  async post(id: string, companyId: string, userId: string) {
    const entry = await this.findOne(id, companyId);
    if (entry.status === 'POSTED') {
      throw new BadRequestException('القيد مرحّل بالفعل');
    }
    if (entry.status === 'CANCELLED') {
      throw new BadRequestException('لا يمكن ترحيل قيد ملغى');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.journalEntry.update({
        where: { id },
        data: {
          status: 'POSTED',
          postedById: userId,
        },
      });

      for (const line of entry.lines) {
        if (line.accountId) {
          const debit = Number(line.debit) || 0;
          const credit = Number(line.credit) || 0;
          const balanceChange = debit - credit;

          const accExists = await tx.account.findUnique({ where: { id: line.accountId } });
          if (accExists) {
            await tx.account.update({
              where: { id: line.accountId },
              data: {
                balance: {
                  increment: new Prisma.Decimal(balanceChange),
                },
              },
            });
          }
        }
      }

      await tx.auditLog.create({
        data: {
          action: 'POST_JOURNAL_ENTRY',
          entity: 'JournalEntry',
          entityId: id,
          details: JSON.stringify({ entryNumber: entry.entryNumber }),
          userId,
          companyId,
        },
      });

      return updated;
    });
  }

  async cancel(id: string, companyId: string, userId: string, reason?: string) {
    const entry = await this.findOne(id, companyId);
    if (entry.status === 'CANCELLED') {
      throw new BadRequestException('القيد ملغى بالفعل');
    }

    return this.prisma.$transaction(async (tx) => {
      if (entry.status === 'POSTED') {
        for (const line of entry.lines) {
          if (line.accountId) {
            const debit = Number(line.debit) || 0;
            const credit = Number(line.credit) || 0;
            const balanceReversal = -(debit - credit);

            const accExists = await tx.account.findUnique({ where: { id: line.accountId } });
            if (accExists) {
              await tx.account.update({
                where: { id: line.accountId },
                data: {
                  balance: {
                    increment: new Prisma.Decimal(balanceReversal),
                  },
                },
              });
            }
          }
        }
      }

      const updated = await tx.journalEntry.update({
        where: { id },
        data: {
          status: 'CANCELLED',
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'CANCEL_JOURNAL_ENTRY',
          entity: 'JournalEntry',
          entityId: id,
          details: JSON.stringify({ entryNumber: entry.entryNumber, reason }),
          userId,
          companyId,
        },
      });

      return updated;
    });
  }

  async reverse(id: string, companyId: string, userId: string, reason: string) {
    const original = await this.findOne(id, companyId);
    if (original.status !== 'POSTED') {
      throw new BadRequestException('لا يمكن عكس قيد غير مرحّل');
    }

    const year = new Date().getFullYear();
    const count = await this.prisma.journalEntry.count({
      where: { companyId },
    });
    const entryNumber = `JV-${year}-${String(count + 1).padStart(4, '0')}`;

    return this.prisma.$transaction(async (tx) => {
      const reversedEntry = await tx.journalEntry.create({
        data: {
          entryNumber,
          date: new Date(),
          reference: `REV-${original.entryNumber}`,
          description: `عكس القيد رقم ${original.entryNumber}: ${reason}`,
          status: 'POSTED',
          totalDebit: original.totalCredit,
          totalCredit: original.totalDebit,
          companyId,
          fiscalPeriodId: original.fiscalPeriodId,
          createdById: userId,
          postedById: userId,
          lines: {
            create: original.lines.map((line) => ({
              accountId: line.accountId,
              debit: line.credit,
              credit: line.debit,
              description: `عكس: ${line.description}`,
              costCenter: line.costCenter,
            })),
          },
        },
        include: { lines: true },
      });

      for (const line of original.lines) {
        if (line.accountId) {
          const debit = Number(line.credit) || 0;
          const credit = Number(line.debit) || 0;
          const balanceChange = debit - credit;

          const accExists = await tx.account.findUnique({ where: { id: line.accountId } });
          if (accExists) {
            await tx.account.update({
              where: { id: line.accountId },
              data: {
                balance: {
                  increment: new Prisma.Decimal(balanceChange),
                },
              },
            });
          }
        }
      }

      await tx.auditLog.create({
        data: {
          action: 'REVERSE_JOURNAL_ENTRY',
          entity: 'JournalEntry',
          entityId: reversedEntry.id,
          details: JSON.stringify({ originalNumber: original.entryNumber, reversedNumber: entryNumber, reason }),
          userId,
          companyId,
        },
      });

      return reversedEntry;
    });
  }

  async delete(id: string, companyId?: string, userId?: string) {
    const entry =
      (await this.prisma.journalEntry.findFirst({
        where: {
          id,
          ...(companyId ? { companyId } : {}),
        },
        include: { lines: true },
      })) ||
      (await this.prisma.journalEntry.findUnique({
        where: { id },
        include: { lines: true },
      }));

    if (!entry) throw new NotFoundException('القيد اليومي غير موجود');

    return this.prisma.$transaction(async (tx) => {
      // Revert balances if posted
      if (entry.status === 'POSTED') {
        for (const line of entry.lines) {
          if (line.accountId) {
            const debit = Number(line.debit) || 0;
            const credit = Number(line.credit) || 0;
            const delta = credit - debit;
            const accExists = await tx.account.findUnique({ where: { id: line.accountId } });
            if (accExists) {
              await tx.account.update({
                where: { id: line.accountId },
                data: {
                  balance: {
                    increment: new Prisma.Decimal(delta),
                  },
                },
              });
            }
          }
        }
      }

      // Delete associated vouchers so they don't remain stuck in the system
      try {
        await tx.receiptVoucher.deleteMany({ where: { journalEntryId: id } });
      } catch {}
      try {
        await tx.paymentVoucher.deleteMany({ where: { journalEntryId: id } });
      } catch {}

      // Delete lines first, then entry
      await tx.journalEntryLine.deleteMany({ where: { journalEntryId: id } });
      const deleted = await tx.journalEntry.delete({ where: { id } });

      if (userId) {
        try {
          await (tx as any).auditLog.create({
            data: {
              action: 'DELETE_JOURNAL_ENTRY',
              entity: 'JournalEntry',
              entityId: id,
              details: JSON.stringify({ entryNumber: entry.entryNumber, description: entry.description }),
              userId,
              companyId: companyId || entry.companyId || '',
            },
          });
        } catch (auditErr) {
          // Non-blocking audit log
        }
      }

      return deleted;
    });
  }

  async update(
    id: string,
    companyId: string = '',
    dto: {
      description?: string;
      date?: string;
      reference?: string;
      lines?: Array<{ accountId: string; debit: number; credit: number; description?: string; costCenter?: string }>;
      currency?: string;
      exchangeRate?: number;
    } = {}
  ) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: {
        id,
        ...(companyId ? { companyId } : {}),
      },
      include: { lines: true },
    }) || await this.prisma.journalEntry.findUnique({
      where: { id },
      include: { lines: true },
    });

    if (!entry) throw new NotFoundException('القيد اليومي غير موجود');

    return this.prisma.$transaction(async (tx) => {
      // If new lines are provided, revert old lines balances, replace lines, and apply new balances
      if (dto.lines && Array.isArray(dto.lines) && dto.lines.length > 0) {
        if (entry.status === 'POSTED') {
          for (const line of entry.lines) {
            if (line.accountId) {
              const debit = Number(line.debit) || 0;
              const credit = Number(line.credit) || 0;
              const delta = credit - debit;
              const accExists = await tx.account.findUnique({ where: { id: line.accountId } });
              if (accExists) {
                await tx.account.update({
                  where: { id: line.accountId },
                  data: { balance: { increment: new Prisma.Decimal(delta) } },
                });
              }
            }
          }
        }

        await tx.journalEntryLine.deleteMany({ where: { journalEntryId: id } });

        // The same conversion as create. An edit that fell back to the raw figures
        // would quietly undo the conversion the entry was created with.
        const { currency, exchangeRate, lines: postedLines } = this.normalizeLines(
          dto.lines,
          dto.currency ?? entry.currency,
          dto.exchangeRate ?? Number(entry.exchangeRate),
        );
        const totalDebit = postedLines.reduce((sum, l) => sum + l.debit, 0);
        const totalCredit = postedLines.reduce((sum, l) => sum + l.credit, 0);

        await tx.journalEntry.update({
          where: { id },
          data: {
            ...(dto.description ? { description: dto.description } : {}),
            ...(dto.date ? { date: new Date(dto.date) } : {}),
            ...(dto.reference ? { reference: dto.reference } : {}),
            totalDebit: new Prisma.Decimal(totalDebit),
            totalCredit: new Prisma.Decimal(totalCredit),
            currency,
            exchangeRate: new Prisma.Decimal(exchangeRate),
            lines: {
              create: postedLines.map((l) => ({
                accountId: l.accountId,
                debit: new Prisma.Decimal(l.debit),
                credit: new Prisma.Decimal(l.credit),
                debitOriginal: l.debitOriginal === null ? null : new Prisma.Decimal(l.debitOriginal),
                creditOriginal: l.creditOriginal === null ? null : new Prisma.Decimal(l.creditOriginal),
                description: this.lineDescription(l, dto.description || '', currency, exchangeRate),
                costCenter: l.costCenter || null,
              })),
            },
          },
        });

        if (entry.status === 'POSTED') {
          // Converted amounts again — the reversal above already used the stored
          // lines, which are likewise in the ledger's currency.
          for (const line of postedLines) {
            if (line.accountId) {
              const delta = line.debit - line.credit;
              const accExists = await tx.account.findUnique({ where: { id: line.accountId } });
              if (accExists) {
                await tx.account.update({
                  where: { id: line.accountId },
                  data: { balance: { increment: new Prisma.Decimal(delta) } },
                });
              }
            }
          }
        }

        return tx.journalEntry.findUnique({
          where: { id },
          include: { lines: true },
        });
      } else {
        return tx.journalEntry.update({
          where: { id },
          data: {
            ...(dto.description ? { description: dto.description } : {}),
            ...(dto.date ? { date: new Date(dto.date) } : {}),
            ...(dto.reference ? { reference: dto.reference } : {}),
          },
          include: { lines: true },
        });
      }
    });
  }
}
