import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiPropertyOptional({ description: 'رقم السند من الفرونتند' })
  @IsString()
  @IsOptional()
  voucherNumber?: string;
}

@Injectable()
export class ReceiptVouchersService {
  constructor(private prisma: PrismaService) {}

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
   * List view only. It used to `include: { journalEntry: true }` with no `take`,
   * so every receipt voucher ever written came back with its whole journal entry
   * attached — the single biggest cost on the vouchers page. The list needs none
   * of that; `findOne` still returns the full record with its entry and lines.
   */
  async findAll(companyId: string, requestedLimit?: number) {
    const take = Math.min(Math.max(Number(requestedLimit) || 150, 1), 300);
    return this.prisma.receiptVoucher.findMany({
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
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take,
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
    return voucher;
  }

  async create(companyId: string, userId: string, dto: CreateReceiptVoucherDto) {
    const amount = Number(dto.amount);
    if (!amount || amount <= 0) {
      throw new BadRequestException('مبلغ سند القبض يجب أن يكون أكبر من الصفر');
    }
    await this.validateReferences(companyId, dto.accountId, dto.cashboxOrBankAccountId, dto.customerId);

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
            create: [
              {
                accountId: dto.cashboxOrBankAccountId,
                debit: new Prisma.Decimal(amount),
                credit: new Prisma.Decimal(0),
                description: `قبض مبلغ في الصندوق/البنك - سند ${voucherNumber}`,
              },
              {
                accountId: dto.accountId,
                debit: new Prisma.Decimal(0),
                credit: new Prisma.Decimal(amount),
                description: `سداد/قبض من حساب - سند ${voucherNumber}`,
              },
            ],
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

      await tx.account.update({
        where: { id: dto.cashboxOrBankAccountId },
        data: { balance: { increment: new Prisma.Decimal(amount) } },
      });

      await tx.account.update({
        where: { id: dto.accountId },
        data: { balance: { decrement: new Prisma.Decimal(amount) } },
      });

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

  async remove(id: string, companyId: string) {
    const voucher = await this.prisma.receiptVoucher.findFirst({
      where: { id, companyId },
    });

    if (!voucher) throw new NotFoundException('سند القبض غير موجود');

    return this.prisma.$transaction(async (tx) => {
      const amount = Number(voucher.amount) || 0;

      // Revert account balances
      if (voucher.cashboxOrBankAccountId) {
        const accExists = await tx.account.findUnique({ where: { id: voucher.cashboxOrBankAccountId } });
        if (accExists) {
          await tx.account.update({
            where: { id: voucher.cashboxOrBankAccountId },
            data: { balance: { decrement: new Prisma.Decimal(amount) } },
          });
        }
      }

      if (voucher.accountId) {
        const accExists = await tx.account.findUnique({ where: { id: voucher.accountId } });
        if (accExists) {
          await tx.account.update({
            where: { id: voucher.accountId },
            data: { balance: { increment: new Prisma.Decimal(amount) } },
          });
        }
      }

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

    return this.prisma.$transaction(async (tx) => {
      const oldAmount = Number(voucher.amount) || 0;
      const oldCashboxId = voucher.cashboxOrBankAccountId;
      const oldAccountId = voucher.accountId;

      // 1. Revert old balances
      if (oldCashboxId) {
        const accExists = await tx.account.findUnique({ where: { id: oldCashboxId } });
        if (accExists) {
          await tx.account.update({
            where: { id: oldCashboxId },
            data: { balance: { decrement: new Prisma.Decimal(oldAmount) } },
          });
        }
      }
      if (oldAccountId) {
        const accExists = await tx.account.findUnique({ where: { id: oldAccountId } });
        if (accExists) {
          await tx.account.update({
            where: { id: oldAccountId },
            data: { balance: { increment: new Prisma.Decimal(oldAmount) } },
          });
        }
      }

      // 2. Apply new balances
      const newCashboxExists = await tx.account.findUnique({ where: { id: newCashboxId } });
      if (newCashboxExists) {
        await tx.account.update({
          where: { id: newCashboxId },
          data: { balance: { increment: new Prisma.Decimal(amount) } },
        });
      }

      const newAccountExists = await tx.account.findUnique({ where: { id: newAccountId } });
      if (newAccountExists) {
        await tx.account.update({
          where: { id: newAccountId },
          data: { balance: { decrement: new Prisma.Decimal(amount) } },
        });
      }

      // 3. Update Journal Entry and Lines
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
              create: [
                {
                  accountId: newCashboxId,
                  debit: new Prisma.Decimal(amount),
                  credit: new Prisma.Decimal(0),
                  description: `قبض مبلغ في الصندوق/البنك - سند ${voucher.voucherNumber}`,
                },
                {
                  accountId: newAccountId,
                  debit: new Prisma.Decimal(0),
                  credit: new Prisma.Decimal(amount),
                  description: `سداد/قبض من حساب - سند ${voucher.voucherNumber}`,
                },
              ],
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
