import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccountType, AccountCategory } from '@prisma/client';

@Injectable()
export class CustomersSuppliersService {
  constructor(private prisma: PrismaService) {}

  async getCustomers(companyId: string) {
    // 1. Fetch from Customer table (active only)
    const customers = await this.prisma.customer.findMany({
      where: { companyId, isActive: true },
      include: { account: true },
      orderBy: { nameAr: 'asc' },
    });

    const seenAccountIds = new Set<string>();
    const seenCodes = new Set<string>();
    const result: any[] = [];

    customers.forEach((c) => {
      if (c.account?.overduePolicy === 'BLOCK') return;
      seenAccountIds.add(c.accountId);
      seenCodes.add(c.code);
      result.push({
        id: c.id,
        code: c.code,
        nameAr: c.nameAr,
        nameEn: c.nameEn,
        phone: c.phone,
        email: c.email,
        accountId: c.accountId,
        source: 'customer' as const,
      });
    });

    // 2. Also fetch active non-parent leaf accounts with CUSTOMER category or customer prefix
    const customerAccounts = await this.prisma.account.findMany({
      where: {
        companyId,
        category: AccountCategory.CUSTOMER,
        isParent: false,
        overduePolicy: { not: 'BLOCK' },
      },
      orderBy: { nameAr: 'asc' },
    });

    const genericHeadings = ['مدينون', 'عملاء', 'قطاع عام', 'قطاع خاص', 'قطاع مختلط', 'قطاع تعاوني'];

    customerAccounts.forEach((a) => {
      if (seenAccountIds.has(a.id) || seenCodes.has(a.code)) return;
      const name = (a.nameAr || '').trim();
      if (genericHeadings.some((h) => name === h)) return;

      seenAccountIds.add(a.id);
      seenCodes.add(a.code);
      result.push({
        id: a.id,
        code: a.code,
        nameAr: a.nameAr,
        nameEn: a.nameEn,
        phone: a.phone || null,
        email: a.email || null,
        accountId: a.id,
        source: 'account' as const,
      });
    });

    return result;
  }

  async getSuppliers(companyId: string) {
    // 1. Fetch from Supplier table (active only)
    const suppliers = await this.prisma.supplier.findMany({
      where: { companyId, isActive: true },
      include: { account: true },
      orderBy: { nameAr: 'asc' },
    });

    const seenAccountIds = new Set<string>();
    const seenCodes = new Set<string>();
    const result: any[] = [];

    suppliers.forEach((s) => {
      if (s.account?.overduePolicy === 'BLOCK') return;
      seenAccountIds.add(s.accountId);
      seenCodes.add(s.code);
      result.push({
        id: s.id,
        code: s.code,
        nameAr: s.nameAr,
        nameEn: s.nameEn,
        isAirline: s.isAirline,
        phone: s.phone,
        email: s.email,
        accountId: s.accountId,
        source: 'supplier' as const,
      });
    });

    // 2. Also fetch active non-parent leaf accounts with SUPPLIER category or supplier prefix
    const supplierAccounts = await this.prisma.account.findMany({
      where: {
        companyId,
        category: AccountCategory.SUPPLIER,
        isParent: false,
        overduePolicy: { not: 'BLOCK' },
      },
      orderBy: { nameAr: 'asc' },
    });

    const genericHeadings = [
      'دائنون',
      'موردون',
      'دائنون قطاع',
      'موردو التذاكر',
      'موردو الفنادق',
      'شركات طيران',
      'قطاع عام',
      'قطاع خاص',
      'قطاع مختلط',
      'قطاع تعاوني',
    ];

    supplierAccounts.forEach((a) => {
      if (seenAccountIds.has(a.id) || seenCodes.has(a.code)) return;
      const name = (a.nameAr || '').trim();
      if (genericHeadings.some((h) => name === h)) return;

      seenAccountIds.add(a.id);
      seenCodes.add(a.code);
      result.push({
        id: a.id,
        code: a.code,
        nameAr: a.nameAr,
        nameEn: a.nameEn,
        isAirline: false,
        phone: a.phone || null,
        email: a.email || null,
        accountId: a.id,
        source: 'account' as const,
      });
    });

    return result;
  }

  async createCustomer(
    companyId: string,
    data: { code: string; nameAr: string; nameEn?: string; phone?: string; email?: string; address?: string },
  ) {
    const existing = await this.prisma.customer.findUnique({
      where: { companyId_code: { companyId, code: data.code } },
    });
    if (existing) throw new BadRequestException(`كود العميل (${data.code}) مستخدم مسبقاً`);

    const parentCategory = await this.prisma.account.findFirst({
      where: { companyId, code: '1120' },
    });

    return this.prisma.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: {
          code: `1121-${data.code}`,
          nameAr: `حساب عميل: ${data.nameAr}`,
          nameEn: data.nameEn ? `Customer: ${data.nameEn}` : `Customer: ${data.nameAr}`,
          type: AccountType.ASSET,
          category: AccountCategory.CUSTOMER,
          isParent: false,
          parentId: parentCategory?.id || null,
          level: 4,
          companyId,
        },
      });

      return tx.customer.create({
        data: {
          code: data.code,
          nameAr: data.nameAr,
          nameEn: data.nameEn || data.nameAr,
          phone: data.phone || null,
          email: data.email || null,
          address: data.address || null,
          accountId: account.id,
          companyId,
        },
        include: { account: true },
      });
    });
  }

  async createSupplier(
    companyId: string,
    data: { code: string; nameAr: string; nameEn?: string; isAirline?: boolean; phone?: string; email?: string; address?: string },
  ) {
    const existing = await this.prisma.supplier.findUnique({
      where: { companyId_code: { companyId, code: data.code } },
    });
    if (existing) throw new BadRequestException(`كود المورد (${data.code}) مستخدم مسبقاً`);

    const parentCategory = await this.prisma.account.findFirst({
      where: { companyId, code: '2110' },
    });

    return this.prisma.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: {
          code: `2111-${data.code}`,
          nameAr: data.isAirline ? `شركة طيران: ${data.nameAr}` : `حساب مورد: ${data.nameAr}`,
          nameEn: data.nameEn ? `Supplier: ${data.nameEn}` : `Supplier: ${data.nameAr}`,
          type: AccountType.LIABILITY,
          category: AccountCategory.SUPPLIER,
          isParent: false,
          parentId: parentCategory?.id || null,
          level: 4,
          companyId,
        },
      });

      return tx.supplier.create({
        data: {
          code: data.code,
          nameAr: data.nameAr,
          nameEn: data.nameEn || data.nameAr,
          isAirline: data.isAirline || false,
          phone: data.phone || null,
          email: data.email || null,
          address: data.address || null,
          accountId: account.id,
          companyId,
        },
        include: { account: true },
      });
    });
  }
}
