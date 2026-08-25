import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VouchersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string, requestedLimit?: number) {
    const take = requestedLimit && requestedLimit > 0
      ? Math.min(Math.trunc(requestedLimit), 200)
      : undefined;

    const [receipts, payments] = await Promise.all([
      this.prisma.receiptVoucher.findMany({
        where: { companyId },
        include: {
          account: { select: { id: true, code: true, nameAr: true } },
          cashboxOrBankAccount: { select: { id: true, code: true, nameAr: true } },
          customer: { select: { id: true, code: true, nameAr: true } },
          createdBy: { select: { id: true, name: true } },
          journalEntry: { select: { id: true, entryNumber: true, status: true } },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        ...(take ? { take } : {}),
      }),
      this.prisma.paymentVoucher.findMany({
        where: { companyId },
        include: {
          account: { select: { id: true, code: true, nameAr: true } },
          cashboxOrBankAccount: { select: { id: true, code: true, nameAr: true } },
          supplier: { select: { id: true, code: true, nameAr: true } },
          createdBy: { select: { id: true, name: true } },
          journalEntry: { select: { id: true, entryNumber: true, status: true } },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        ...(take ? { take } : {}),
      }),
    ]);

    const combined = [
      ...receipts.map((voucher) => ({
        ...voucher,
        amount: Number(voucher.amount),
        type: 'RECEIPT',
        voucherType: 'RECEIPT',
        number: voucher.voucherNumber,
        currency: 'IQD',
        accountName: voucher.account.nameAr,
        accountCode: voucher.account.code,
        partnerName: voucher.customer?.nameAr || voucher.account.nameAr,
      })),
      ...payments.map((voucher) => ({
        ...voucher,
        amount: Number(voucher.amount),
        type: 'PAYMENT',
        voucherType: 'PAYMENT',
        number: voucher.voucherNumber,
        currency: 'IQD',
        accountName: voucher.account.nameAr,
        accountCode: voucher.account.code,
        partnerName: voucher.supplier?.nameAr || voucher.account.nameAr,
      })),
    ].sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());

    return take ? combined.slice(0, take) : combined;
  }
}
