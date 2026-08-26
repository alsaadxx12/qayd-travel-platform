import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  async findAll(companyId: string, requestedLimit?: number) {
    const take = Math.min(Math.max(Number(requestedLimit) || 150, 1), 300);
    return this.prisma.paymentVoucher.findMany({
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
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take,
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
    return voucher;
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
            create: [
              {
                accountId: dto.accountId,
                debit: new Prisma.Decimal(baseAmount),
                credit: new Prisma.Decimal(0),
                description: `سداد إلى حساب - سند ${voucherNumber}`,
              },
              {
                accountId: dto.cashboxOrBankAccountId,
                debit: new Prisma.Decimal(0),
                credit: new Prisma.Decimal(baseAmount),
                description: `صرف مبلغ من الصندوق/البنك - سند ${voucherNumber}`,
              },
            ],
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

      await tx.account.update({
        where: { id: dto.accountId },
        data: { balance: { increment: new Prisma.Decimal(baseAmount) } },
      });

      await tx.account.update({
        where: { id: dto.cashboxOrBankAccountId },
        data: { balance: { decrement: new Prisma.Decimal(baseAmount) } },
      });

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
    });

    if (!voucher) throw new NotFoundException('سند الدفع غير موجود');

    return this.prisma.$transaction(async (tx) => {
      // Balances were posted in the base currency, so revert with the same rate.
      const amount = (Number(voucher.amount) || 0) * (Number(voucher.exchangeRate) || 1);

      // Revert account balances
      if (voucher.accountId) {
        const accExists = await tx.account.findUnique({ where: { id: voucher.accountId } });
        if (accExists) {
          await tx.account.update({
            where: { id: voucher.accountId },
            data: { balance: { decrement: new Prisma.Decimal(amount) } },
          });
        }
      }

      if (voucher.cashboxOrBankAccountId) {
        const accExists = await tx.account.findUnique({ where: { id: voucher.cashboxOrBankAccountId } });
        if (accExists) {
          await tx.account.update({
            where: { id: voucher.cashboxOrBankAccountId },
            data: { balance: { increment: new Prisma.Decimal(amount) } },
          });
        }
      }

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

    return this.prisma.$transaction(async (tx) => {
      const oldAmount = (Number(voucher.amount) || 0) * (Number(voucher.exchangeRate) || 1);
      const oldAccountId = voucher.accountId;
      const oldCashboxId = voucher.cashboxOrBankAccountId;

      // 1. Revert old balances
      if (oldAccountId) {
        const accExists = await tx.account.findUnique({ where: { id: oldAccountId } });
        if (accExists) {
          await tx.account.update({
            where: { id: oldAccountId },
            data: { balance: { decrement: new Prisma.Decimal(oldAmount) } },
          });
        }
      }
      if (oldCashboxId) {
        const accExists = await tx.account.findUnique({ where: { id: oldCashboxId } });
        if (accExists) {
          await tx.account.update({
            where: { id: oldCashboxId },
            data: { balance: { increment: new Prisma.Decimal(oldAmount) } },
          });
        }
      }

      // 2. Apply new balances
      const newAccountExists = await tx.account.findUnique({ where: { id: newAccountId } });
      if (newAccountExists) {
        await tx.account.update({
          where: { id: newAccountId },
          data: { balance: { increment: new Prisma.Decimal(baseAmount) } },
        });
      }

      const newCashboxExists = await tx.account.findUnique({ where: { id: newCashboxId } });
      if (newCashboxExists) {
        await tx.account.update({
          where: { id: newCashboxId },
          data: { balance: { decrement: new Prisma.Decimal(baseAmount) } },
        });
      }

      // 3. Update Journal Entry and Lines
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
              create: [
                {
                  accountId: newAccountId,
                  debit: new Prisma.Decimal(baseAmount),
                  credit: new Prisma.Decimal(0),
                  description: `سداد/صرف إلى حساب - سند ${voucher.voucherNumber}`,
                },
                {
                  accountId: newCashboxId,
                  debit: new Prisma.Decimal(0),
                  credit: new Prisma.Decimal(baseAmount),
                  description: `صرف مبلغ من الصندوق/البنك - سند ${voucher.voucherNumber}`,
                },
              ],
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
