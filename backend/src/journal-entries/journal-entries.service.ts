import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EntryStatus, Prisma } from '@prisma/client';
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

  @ApiPropertyOptional({ example: true, description: 'ترحيل القيد فوراً' })
  @IsBoolean()
  @IsOptional()
  postImmediately?: boolean;

  @IsOptional()
  @IsString()
  entryNumber?: string;
}

@Injectable()
export class JournalEntriesService {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string, status?: EntryStatus, search?: string, accountId?: string) {
    return this.prisma.journalEntry.findMany({
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
            account: { select: { id: true, code: true, nameAr: true, type: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
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

    let totalDebit = 0;
    let totalCredit = 0;

    dto.lines.forEach((line, index) => {
      const debit = Number(line.debit) || 0;
      const credit = Number(line.credit) || 0;
      if (debit < 0 || credit < 0) {
        throw new BadRequestException(`السطر رقم ${index + 1}: المبالغ يجب أن تكون موجبة`);
      }
      if (debit === 0 && credit === 0) {
        throw new BadRequestException(`السطر رقم ${index + 1}: يجب إدخال مبلغ مدين أو دائن`);
      }
      totalDebit += debit;
      totalCredit += credit;
    });

    const diff = Math.abs(totalDebit - totalCredit);
    if (diff > 0.001) {
      throw new BadRequestException(`القيد غير متوازن: المدين (${totalDebit}) لا يساوي الدائن (${totalCredit})، الفارق = ${diff}`);
    }

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
          companyId,
          fiscalYearId: fiscalYear?.id || null,
          fiscalPeriodId: period?.id || null,
          createdById: userId,
          postedById: dto.postImmediately ? userId : null,
          lines: {
            create: dto.lines.map((line) => ({
              accountId: line.accountId,
              debit: new Prisma.Decimal(line.debit || 0),
              credit: new Prisma.Decimal(line.credit || 0),
              description: line.description || dto.description,
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
          details: JSON.stringify({ entryNumber, totalDebit, totalCredit, status: entry.status }),
          userId,
          companyId,
        },
      });

      if (dto.postImmediately) {
        for (const line of dto.lines) {
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

        const totalDebit = dto.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
        const totalCredit = dto.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);

        await tx.journalEntry.update({
          where: { id },
          data: {
            ...(dto.description ? { description: dto.description } : {}),
            ...(dto.date ? { date: new Date(dto.date) } : {}),
            ...(dto.reference ? { reference: dto.reference } : {}),
            totalDebit: new Prisma.Decimal(totalDebit),
            totalCredit: new Prisma.Decimal(totalCredit),
            lines: {
              create: dto.lines.map((l) => ({
                accountId: l.accountId,
                debit: new Prisma.Decimal(l.debit || 0),
                credit: new Prisma.Decimal(l.credit || 0),
                description: l.description || dto.description || '',
                costCenter: l.costCenter || null,
              })),
            },
          },
        });

        if (entry.status === 'POSTED') {
          for (const line of dto.lines) {
            if (line.accountId) {
              const debit = Number(line.debit) || 0;
              const credit = Number(line.credit) || 0;
              const delta = debit - credit;
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
