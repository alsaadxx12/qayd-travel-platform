import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { IsOptional, IsString, IsBoolean, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/swagger';

// ── DTOs ──

export class PassengerDto {
  @IsString()
  name: string;

  @IsOptional() @IsString()
  ticketType?: string;

  @IsOptional() @IsString()
  ticketNumber?: string;

  @IsOptional() @IsString()
  documentNumber?: string;

  @IsOptional() @IsString()
  pnr?: string;

  @IsOptional() @IsString()
  orderNumber?: string;

  @IsOptional() @IsString()
  passportNumber?: string;

  @IsOptional() @IsString()
  visaType?: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsString()
  id?: string;

  @IsOptional() @IsString()
  batchId?: string;

  @IsOptional() @IsNumber()
  fareBuy?: number;

  @IsOptional() @IsNumber()
  fareSell?: number;

  @IsOptional() @IsNumber()
  tax1?: number;

  @IsOptional() @IsNumber()
  tax2?: number;

  @IsOptional() @IsNumber()
  charge?: number;

  @IsOptional() @IsNumber()
  percentage?: number;

  @IsOptional() @IsString()
  status?: string;

  @IsOptional() @IsString()
  ticketId?: string;

  @IsOptional() @IsBoolean()
  isAudited?: boolean;

  @IsOptional() @IsString()
  auditNote?: string;

  @IsOptional()
  createdAt?: any;

  @IsOptional()
  updatedAt?: any;
}

export class CreateTicketDto {
  @IsString()
  invoiceNumber: string;

  @IsOptional() @IsString()
  issueDate?: string;

  @IsOptional() @IsString()
  entryDate?: string;

  @IsOptional() @IsString()
  travelDate?: string;

  @IsOptional() @IsString()
  returnDate?: string;

  @IsOptional() @IsString()
  customerName?: string;

  @IsOptional() @IsString()
  customerId?: string;

  @IsOptional() @IsString()
  customerAccountId?: string;

  @IsOptional() @IsString()
  employeeName?: string;

  @IsOptional() @IsString()
  entryEmployee?: string;

  @IsOptional() @IsString()
  modifiedByEmployee?: string;

  @IsOptional() @IsString()
  cashbox?: string;

  @IsOptional() @IsString()
  currency?: string;

  @IsOptional() @IsNumber()
  exchangeRate?: number;

  @IsOptional() @IsString()
  paymentType?: string;

  @IsOptional() @IsString()
  supplierAccount?: string;

  @IsOptional() @IsString()
  supplierId?: string;

  @IsOptional() @IsString()
  supplierAccountId?: string;

  @IsOptional() @IsString()
  supplierAccountName?: string;

  @IsOptional() @IsString()
  tripType?: string;

  @IsOptional() @IsString()
  airline?: string;

  @IsOptional() @IsString()
  airlineId?: string;

  @IsOptional() @IsString()
  travelClass?: string;

  @IsOptional() @IsString()
  pnr?: string;

  @IsOptional() @IsString()
  route?: string;

  @IsOptional() @IsString()
  discountType?: string;

  @IsOptional() @IsNumber()
  discountValue?: number;

  @IsOptional() @IsNumber()
  discountAmount?: number;

  @IsOptional() @IsNumber()
  totalSell?: number;

  @IsOptional() @IsNumber()
  totalBuy?: number;

  @IsOptional() @IsNumber()
  netSell?: number;

  @IsOptional() @IsNumber()
  netBuy?: number;

  @IsOptional() @IsNumber()
  profit?: number;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsString()
  agentName?: string;

  @IsOptional() @IsString()
  reference?: string;

  @IsOptional() @IsString()
  status?: string; // DRAFT, POSTED, APPROVED, CANCELLED

  @IsOptional() @IsString()
  branchId?: string;

  @IsOptional() @IsString()
  paymentMethod?: string;

  @IsOptional() @IsString()
  receivingCashbox?: string;

  @IsOptional() @IsString()
  cashboxAccountId?: string;

  @IsOptional() @IsString()
  transferImage?: string;

  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PassengerDto)
  passengers?: PassengerDto[];
}

export class UpdateTicketDto extends PartialType(CreateTicketDto) {
  @IsOptional() @IsBoolean()
  isAudited?: boolean;

  @IsOptional() @IsString()
  auditedBy?: string;
}

// ── Service ──

@Injectable()
export class TicketsService {
  private ticketsCache = new Map<string, { data: any[]; timestamp: number }>();
  private readonly CACHE_TTL = 60000; // 60s TTL

  public invalidateCache(companyId: string) {
    for (const key of this.ticketsCache.keys()) {
      if (key.startsWith(companyId)) {
        this.ticketsCache.delete(key);
      }
    }
  }

  constructor(private prisma: PrismaService) {}

  private async resolveTicketRelations(
    companyId: string,
    dto: Record<string, any>,
    options: { allowBranchFallback?: boolean } = {},
  ) {
    const customerHint = dto.customerName?.trim();
    const supplierHint = dto.supplierAccount?.trim();
    const supplierNameHint = dto.supplierAccountName?.trim();
    const airlineHint = dto.airline?.trim();
    const cashboxHint = dto.cashboxAccountId || dto.receivingCashbox || dto.cashbox;
    const branchHint = dto.branchId?.trim();

    const [customer, explicitCustomerAccount, supplier, explicitSupplierAccount, airline, explicitCashboxAccount, resolvedBranch] = await Promise.all([
      dto.customerId || customerHint
        ? this.prisma.customer.findFirst({
            where: {
              companyId,
              OR: [
                ...(dto.customerId ? [{ id: dto.customerId }] : []),
                ...(customerHint ? [{ id: customerHint }, { code: customerHint }, { nameAr: customerHint }, { nameEn: customerHint }] : []),
              ],
            },
            select: { id: true, accountId: true, nameAr: true },
          })
        : Promise.resolve(null),
      dto.customerAccountId
        ? this.prisma.account.findFirst({ where: { id: dto.customerAccountId, companyId }, select: { id: true } })
        : Promise.resolve(null),
      dto.supplierId || supplierHint || supplierNameHint
        ? this.prisma.supplier.findFirst({
            where: {
              companyId,
              OR: [
                ...(dto.supplierId ? [{ id: dto.supplierId }] : []),
                ...(supplierHint ? [{ id: supplierHint }, { code: supplierHint }, { nameAr: supplierHint }, { nameEn: supplierHint }] : []),
                ...(supplierNameHint ? [{ code: supplierNameHint }, { nameAr: supplierNameHint }, { nameEn: supplierNameHint }] : []),
              ],
            },
            select: { id: true, accountId: true, nameAr: true },
          })
        : Promise.resolve(null),
      dto.supplierAccountId
        ? this.prisma.account.findFirst({ where: { id: dto.supplierAccountId, companyId }, select: { id: true } })
        : Promise.resolve(null),
      dto.airlineId || airlineHint
        ? this.prisma.airline.findFirst({
            where: {
              companyId,
              OR: [
                ...(dto.airlineId ? [{ id: dto.airlineId }] : []),
                ...(airlineHint ? [{ id: airlineHint }, { code: airlineHint }, { nameAr: airlineHint }, { nameEn: airlineHint }] : []),
              ],
            },
            select: { id: true, nameAr: true },
          })
        : Promise.resolve(null),
      cashboxHint
        ? this.prisma.account.findFirst({ where: { id: cashboxHint, companyId }, select: { id: true } })
        : Promise.resolve(null),
      branchHint
        ? this.prisma.branch.findFirst({
            where: { companyId, OR: [{ id: branchHint }, { code: branchHint }, { nameAr: branchHint }, { nameEn: branchHint }] },
            select: { id: true },
          })
        : this.prisma.branch.findFirst({
            where: { companyId },
            orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }],
            select: { id: true },
          }),
    ]);

    let branch = resolvedBranch;
    if (!branch && branchHint && options.allowBranchFallback) {
      branch = await this.prisma.branch.findFirst({
        where: { companyId },
        orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }],
        select: { id: true },
      });
    }

    if (dto.customerId && !customer) throw new BadRequestException('العميل المحدد غير موجود في الشركة الحالية');
    if (dto.customerAccountId && !explicitCustomerAccount) throw new BadRequestException('حساب العميل المحدد غير صالح');
    if (dto.supplierId && !supplier) throw new BadRequestException('المورد المحدد غير موجود في الشركة الحالية');
    if (dto.supplierAccountId && !explicitSupplierAccount) throw new BadRequestException('حساب المورد المحدد غير صالح');
    if (dto.airlineId && !airline) throw new BadRequestException('شركة الطيران المحددة غير موجودة في الشركة الحالية');
    if (dto.cashboxAccountId && !explicitCashboxAccount) throw new BadRequestException('حساب الصندوق أو البنك المحدد غير صالح');
    if (dto.branchId && !branch) throw new BadRequestException('الفرع المحدد غير موجود في الشركة الحالية');

    const customerAccount = explicitCustomerAccount || (customer?.accountId ? { id: customer.accountId } : null) ||
      (customerHint ? await this.prisma.account.findFirst({
        where: { companyId, OR: [{ id: customerHint }, { code: customerHint }, { nameAr: customerHint }] },
        select: { id: true },
      }) : null);

    const supplierAccount = explicitSupplierAccount || (supplier?.accountId ? { id: supplier.accountId } : null) ||
      ((supplierHint || supplierNameHint) ? await this.prisma.account.findFirst({
        where: {
          companyId,
          OR: [
            ...(supplierHint ? [{ id: supplierHint }, { code: supplierHint }, { nameAr: supplierHint }] : []),
            ...(supplierNameHint ? [{ code: supplierNameHint }, { nameAr: supplierNameHint }] : []),
          ],
        },
        select: { id: true },
      }) : null);

    let cashboxAccount = explicitCashboxAccount;
    if (!cashboxAccount && cashboxHint) {
      const cashbox = await this.prisma.cashbox.findFirst({
        where: { companyId, OR: [{ id: cashboxHint }, { code: cashboxHint }, { nameAr: cashboxHint }, { accountId: cashboxHint }] },
        select: { accountId: true },
      });
      cashboxAccount = cashbox?.accountId ? { id: cashbox.accountId } : null;
    }

    return {
      customerId: customer?.id || null,
      customerAccountId: customerAccount?.id || null,
      supplierId: supplier?.id || null,
      supplierAccountId: supplierAccount?.id || null,
      airlineId: airline?.id || null,
      cashboxAccountId: cashboxAccount?.id || null,
      branchId: branch?.id || null,
    };
  }

  private assertPostingRelations(
    dto: Record<string, any>,
    relations: Awaited<ReturnType<TicketsService['resolveTicketRelations']>>,
    totals: { netSell: number; netBuy: number },
  ) {
    const status = (dto.status || 'POSTED').toString().toUpperCase();
    if (status !== 'POSTED' && status !== 'APPROVED' && status !== 'REFUNDED') return;

    const paymentType = (dto.paymentType || '').toString().toUpperCase();
    const isCash = ['DEBIT', 'CASH', 'CASH_HAND', 'MASTER_CARD'].includes(paymentType) || dto.paymentType === 'نقدي';
    const isVisa = dto.tripType === 'VISA';
    const isRefund = dto.tripType === 'REFUND' || status === 'REFUNDED';
    const netSellAmount = Math.abs(totals.netSell);
    const netBuyAmount = Math.abs(totals.netBuy);

    if (netSellAmount > 0 && !isCash && !relations.customerAccountId) {
      throw new BadRequestException('لا يمكن ترحيل البيع الآجل من دون ربط حساب العميل');
    }
    if (netBuyAmount > 0 && !relations.supplierAccountId) {
      throw new BadRequestException('لا يمكن ترحيل تكلفة العملية من دون ربط حساب المورد');
    }
    if (netSellAmount > 0 && isCash && !relations.cashboxAccountId) {
      throw new BadRequestException('لا يمكن ترحيل البيع النقدي من دون ربط حساب الصندوق أو البنك');
    }
    if (!isVisa && !isRefund && !relations.airlineId) {
      throw new BadRequestException('لا يمكن ترحيل التذكرة من دون ربط شركة الطيران');
    }
    if (!relations.branchId) {
      throw new BadRequestException('لا يمكن ترحيل العملية من دون ربطها بفرع مسجل');
    }
  }

  private async buildBranchScopeWhere(companyId: string, branchId?: string) {
    if (!branchId || branchId === 'ALL') {
      return null;
    }

    const matchingBranches = await this.prisma.branch.findMany({
      where: {
        companyId,
        OR: [
          { isMain: true },
          { id: branchId },
          { code: branchId },
          { nameAr: branchId },
          { nameEn: branchId },
        ],
      },
      select: { id: true, code: true, nameAr: true, nameEn: true, isMain: true },
    });

    const requestedBranch = matchingBranches.find((branch) =>
      branch.id === branchId
      || branch.code === branchId
      || branch.nameAr === branchId
      || branch.nameEn === branchId,
    );
    const mainBranch = matchingBranches.find((branch) => branch.isMain);

    const resolvedBranchId = requestedBranch?.id || branchId;

    if (mainBranch && resolvedBranchId === mainBranch.id) {
      return {
        OR: [
          { branchId: resolvedBranchId },
          { branchId: null },
        ],
      };
    }

    return { OR: [{ branchId: resolvedBranchId }] };
  }

  async findFlights(companyId: string, branchId?: string) {
    const cacheKey = `${companyId}:${branchId || 'ALL'}:FLIGHTS`;
    const cached = this.ticketsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    const branchScope = await this.buildBranchScopeWhere(companyId, branchId);
    const whereClause: Prisma.TicketWhereInput = {
      companyId,
      AND: [
        ...(branchScope ? [branchScope] : []),
        {
          OR: [
            { tripType: null },
            { tripType: { not: 'VISA' } },
          ],
        },
        {
          NOT: {
            OR: [
              { invoiceNumber: { contains: 'VISA', mode: 'insensitive' } },
              { pnr: { contains: 'فيزا' } },
              { pnr: { contains: 'VISA', mode: 'insensitive' } },
              { airline: { contains: 'فيزا' } },
              { airline: { contains: 'VISA', mode: 'insensitive' } },
            ],
          },
        },
      ],
    };

    const data = await this.prisma.ticket.findMany({
      where: whereClause,
      relationLoadStrategy: 'join',
      include: {
        passengers: true,
        customer: { select: { id: true, code: true, nameAr: true, accountId: true } },
        supplier: { select: { id: true, code: true, nameAr: true, accountId: true } },
        airlineRef: { select: { id: true, code: true, nameAr: true, nameEn: true, logo: true } },
        cashboxAccount: { select: { id: true, code: true, nameAr: true } },
        branch: { select: { id: true, code: true, nameAr: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    this.ticketsCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  async findAll(companyId: string, branchId?: string) {
    const cacheKey = `${companyId}:${branchId || 'ALL'}`;
    const cached = this.ticketsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    const whereClause: any = { companyId };
    if (branchId && branchId !== 'ALL') {
      const mainBranch = await this.prisma.branch.findFirst({
        where: { companyId, isMain: true },
      });
      if (mainBranch && branchId === mainBranch.id) {
        whereClause.OR = [
          { branchId: branchId },
          { branchId: null },
        ];
      } else {
        whereClause.OR = [
          { branchId: branchId },
        ];
      }
    }

    const data = await this.prisma.ticket.findMany({
      where: whereClause,
      include: {
        passengers: true,
        customer: { select: { id: true, code: true, nameAr: true, accountId: true } },
        supplier: { select: { id: true, code: true, nameAr: true, accountId: true } },
        airlineRef: { select: { id: true, code: true, nameAr: true, nameEn: true, logo: true } },
        cashboxAccount: { select: { id: true, code: true, nameAr: true } },
        branch: { select: { id: true, code: true, nameAr: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    this.ticketsCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  async findVisas(companyId: string, branchId?: string) {
    const cacheKey = `${companyId}:${branchId || 'ALL'}:VISAS`;
    const cached = this.ticketsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    const branchScope = await this.buildBranchScopeWhere(companyId, branchId);
    const canonicalWhereClause: Prisma.TicketWhereInput = {
      companyId,
      AND: [
        ...(branchScope ? [branchScope] : []),
        {
          OR: [
            { tripType: 'VISA' },
            {
              AND: [
                { status: 'REFUNDED' },
                {
                  OR: [
                    { invoiceNumber: { contains: 'VISA', mode: 'insensitive' } },
                    { reference: { contains: 'VISA', mode: 'insensitive' } },
                    { airline: { contains: 'VISA', mode: 'insensitive' } },
                    { airline: { contains: 'فيزا' } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const visaListSelect = {
      id: true,
      invoiceNumber: true,
      issueDate: true,
      travelDate: true,
      returnDate: true,
      customerName: true,
      customerId: true,
      customerAccountId: true,
      employeeName: true,
      entryEmployee: true,
      modifiedByEmployee: true,
      cashbox: true,
      currency: true,
      exchangeRate: true,
      paymentType: true,
      supplierAccount: true,
      supplierAccountName: true,
      supplierId: true,
      supplierAccountId: true,
      tripType: true,
      airline: true,
      airlineId: true,
      travelClass: true,
      pnr: true,
      route: true,
      discountType: true,
      discountValue: true,
      discountAmount: true,
      totalSell: true,
      totalBuy: true,
      netSell: true,
      netBuy: true,
      profit: true,
      notes: true,
      agentName: true,
      reference: true,
      status: true,
      paymentMethod: true,
      receivingCashbox: true,
      cashboxAccountId: true,
      isAudited: true,
      auditedBy: true,
      auditedAt: true,
      branchId: true,
      companyId: true,
      createdAt: true,
      updatedAt: true,
      passengers: true,
      customer: { select: { id: true, code: true, nameAr: true, accountId: true } },
      supplier: { select: { id: true, code: true, nameAr: true, accountId: true } },
      airlineRef: { select: { id: true, code: true, nameAr: true, nameEn: true, logo: true } },
      cashboxAccount: { select: { id: true, code: true, nameAr: true } },
      branch: { select: { id: true, code: true, nameAr: true } },
    } satisfies Prisma.TicketSelect;

    let data = await this.prisma.ticket.findMany({
      where: canonicalWhereClause,
      relationLoadStrategy: 'join',
      select: visaListSelect,
      orderBy: { createdAt: 'desc' },
    });

    // Preserve compatibility with databases created before VISA became a canonical trip type.
    if (data.length === 0) {
      data = await this.prisma.ticket.findMany({
        where: {
          companyId,
          AND: [
            ...(branchScope ? [branchScope] : []),
            {
              OR: [
                { invoiceNumber: { contains: 'VISA', mode: 'insensitive' } },
                { pnr: { contains: 'فيزا' } },
                { pnr: { contains: 'VISA', mode: 'insensitive' } },
                { airline: { contains: 'فيزا' } },
                { airline: { contains: 'VISA', mode: 'insensitive' } },
              ],
            },
          ],
        },
        relationLoadStrategy: 'join',
        select: visaListSelect,
        orderBy: { createdAt: 'desc' },
      });
    }

    this.ticketsCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  async findOne(id: string, companyId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        companyId,
        OR: [
          { id },
          { invoiceNumber: id },
        ],
      },
      include: {
        passengers: true,
        customer: { select: { id: true, code: true, nameAr: true, accountId: true } },
        supplier: { select: { id: true, code: true, nameAr: true, accountId: true } },
        airlineRef: { select: { id: true, code: true, nameAr: true, nameEn: true, logo: true } },
        cashboxAccount: { select: { id: true, code: true, nameAr: true } },
        branch: { select: { id: true, code: true, nameAr: true } },
      },
    });
    if (!ticket) throw new NotFoundException('التذكرة غير موجودة');
    return ticket;
  }

  async getDashboardSummary(companyId: string, filters: {
    branchId?: string;
    datePreset?: string;
    dateFrom?: string;
    dateTo?: string;
    operationType?: string;
    currency?: string;
  }) {
    const now = new Date();
    let filterStartDate: Date | null = null;

    if (filters.datePreset === 'TODAY') {
      filterStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (filters.datePreset === 'WEEK') {
      filterStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (filters.datePreset === 'MONTH') {
      filterStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (filters.datePreset === '3MONTHS') {
      filterStartDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    } else if (filters.datePreset === 'YEAR') {
      filterStartDate = new Date(now.getFullYear(), 0, 1);
    } else if (filters.datePreset === 'CUSTOM' && filters.dateFrom) {
      filterStartDate = new Date(filters.dateFrom);
    }

    const whereClause: any = { companyId };

    if (filters.branchId && filters.branchId !== 'ALL') {
      const [requestedBranch, mainBranch] = await Promise.all([
        this.prisma.branch.findFirst({
          where: {
            companyId,
            OR: [
              { id: filters.branchId },
              { code: filters.branchId },
              { nameAr: filters.branchId },
              { nameEn: filters.branchId },
            ],
          },
          select: { id: true },
        }),
        this.prisma.branch.findFirst({
          where: { companyId, isMain: true },
          select: { id: true },
        }),
      ]);

      const resolvedBranchId = requestedBranch?.id || filters.branchId;
      whereClause.OR = mainBranch && resolvedBranchId === mainBranch.id
        ? [{ branchId: resolvedBranchId }, { branchId: null }]
        : [{ branchId: resolvedBranchId }];
    }

    if (filterStartDate) {
      whereClause.issueDate = { gte: filterStartDate };
      if (filters.datePreset === 'CUSTOM' && filters.dateTo) {
        const end = new Date(filters.dateTo);
        end.setDate(end.getDate() + 1);
        whereClause.issueDate.lte = end;
      }
    }

    const tickets = await this.prisma.ticket.findMany({
      where: whereClause,
      select: {
        issueDate: true,
        createdAt: true,
        currency: true,
        tripType: true,
        status: true,
        invoiceNumber: true,
        totalSell: true,
        totalBuy: true,
        profit: true,
        isAudited: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const voucherDateWhere: any = {};
    if (filterStartDate) {
      voucherDateWhere.gte = filterStartDate;
      if (filters.datePreset === 'CUSTOM' && filters.dateTo) {
        const end = new Date(filters.dateTo);
        end.setDate(end.getDate() + 1);
        voucherDateWhere.lte = end;
      }
    }

    const [receiptTotals, paymentTotals] = await Promise.all([
      this.prisma.receiptVoucher.aggregate({
        where: {
          companyId,
          status: 'POSTED',
          ...(Object.keys(voucherDateWhere).length > 0 ? { date: voucherDateWhere } : {}),
        },
        _sum: { amount: true },
      }),
      this.prisma.paymentVoucher.aggregate({
        where: {
          companyId,
          status: 'POSTED',
          ...(Object.keys(voucherDateWhere).length > 0 ? { date: voucherDateWhere } : {}),
        },
        _sum: { amount: true },
      }),
    ]);

    const operationType = filters.operationType || 'ALL';
    const opFiltered = tickets.filter((t) => {
      const isRef = t.tripType === 'REFUND' || t.status === 'REFUNDED' || String(t.invoiceNumber || '').startsWith('REF-');
      if (operationType === 'ALL') return true;
      if (operationType === 'REFUNDS') return isRef;
      if (operationType === 'TICKETS') return !isRef && t.tripType !== 'VISA' && t.tripType !== 'HOTEL' && t.tripType !== 'GROUP';
      if (operationType === 'VISAS') return t.tripType === 'VISA' || String(t.invoiceNumber || '').startsWith('VISA-');
      if (operationType === 'GROUPS') return t.tripType === 'GROUP';
      if (operationType === 'HOTELS') return t.tripType === 'HOTEL';
      return true;
    });

    let audited = 0;
    let pending = 0;
    let unaudited = 0;
    let regTicketsCount = 0;
    let regSalesIQD = 0;
    let regSalesUSD = 0;
    let regCostIQD = 0;
    let regCostUSD = 0;
    let regProfitIQD = 0;
    let regProfitUSD = 0;
    let refTicketsCount = 0;
    let refSalesIQD = 0;
    let refSalesUSD = 0;
    let refCostIQD = 0;
    let refCostUSD = 0;
    let refProfitIQD = 0;
    let refProfitUSD = 0;

    opFiltered.forEach((t) => {
      const isUSD = (t.currency || '').toUpperCase().includes('USD') || (t.currency || '').includes('$');
      const isRef = t.tripType === 'REFUND' || t.status === 'REFUNDED' || String(t.invoiceNumber || '').startsWith('REF-');
      const sell = Number(t.totalSell || 0);
      const buy = Number(t.totalBuy || 0);
      const profit = Number(t.profit ?? (sell - buy));

      if (isRef) {
        refTicketsCount++;
        if (isUSD) {
          refSalesUSD += Math.abs(sell);
          refCostUSD += Math.abs(buy);
          refProfitUSD += profit;
        } else {
          refSalesIQD += Math.abs(sell);
          refCostIQD += Math.abs(buy);
          refProfitIQD += profit;
        }
      } else {
        regTicketsCount++;
        if (isUSD) {
          regSalesUSD += sell;
          regCostUSD += buy;
          regProfitUSD += profit;
        } else {
          regSalesIQD += sell;
          regCostIQD += buy;
          regProfitIQD += profit;
        }
      }

      if (t.isAudited) audited++;
      else if (t.status === 'UNDER_REVIEW') pending++;
      else unaudited++;
    });

    const daysCount = filters.datePreset === 'TODAY' ? 1 : filters.datePreset === 'WEEK' ? 7 : filters.datePreset === '3MONTHS' ? 90 : filters.datePreset === 'YEAR' ? 365 : 30;
    const trendPoints: Array<{ date: string; sales: number; purchases: number; profit: number }> = [];
    const trendMap = new Map<string, { sales: number; purchases: number }>();

    tickets.forEach((t) => {
      const td = new Date(t.createdAt || t.issueDate);
      const key = `${td.getFullYear()}-${String(td.getMonth() + 1).padStart(2, '0')}-${String(td.getDate()).padStart(2, '0')}`;
      const existing = trendMap.get(key) || { sales: 0, purchases: 0 };
      const isTicketUSD = (t.currency || '').toUpperCase().includes('USD') || (t.currency || '').includes('$');
      existing.sales += filters.currency === 'USD' ? (isTicketUSD ? Number(t.totalSell || 0) : 0) : Number(t.totalSell || 0);
      existing.purchases += filters.currency === 'USD' ? (isTicketUSD ? Number(t.totalBuy || 0) : 0) : Number(t.totalBuy || 0);
      trendMap.set(key, existing);
    });

    for (let i = Math.min(daysCount, 30); i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const totals = trendMap.get(key) || { sales: 0, purchases: 0 };
      trendPoints.push({
        date: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
        sales: totals.sales,
        purchases: totals.purchases,
        profit: totals.sales - totals.purchases,
      });
    }

    return {
      kpis: {
        salesIQD: regSalesIQD,
        salesUSD: regSalesUSD,
        buyCostIQD: regCostIQD,
        buyCostUSD: regCostUSD,
        netProfitIQD: regProfitIQD + refProfitIQD,
        netProfitUSD: regProfitUSD + refProfitUSD,
        refundsIQD: refSalesIQD,
        refundsUSD: refSalesUSD,
        auditedCount: audited,
        pendingAuditCount: pending,
        unauditedCount: unaudited,
        receiptsIQD: Number(receiptTotals._sum.amount || 0),
        receiptsUSD: 0,
        paymentsIQD: Number(paymentTotals._sum.amount || 0),
        paymentsUSD: 0,
      },
      servicesData: {
        tickets: { count: regTicketsCount, salesIQD: regSalesIQD, salesUSD: regSalesUSD, costIQD: regCostIQD, costUSD: regCostUSD, profitIQD: regProfitIQD, profitUSD: regProfitUSD },
        refunds: { count: refTicketsCount, salesIQD: refSalesIQD, salesUSD: refSalesUSD, costIQD: refCostIQD, costUSD: refCostUSD, profitIQD: refProfitIQD, profitUSD: refProfitUSD },
        groups: { count: 0, salesIQD: 0, salesUSD: 0, costIQD: 0, costUSD: 0, profitIQD: 0, profitUSD: 0 },
        visas: { count: 0, salesIQD: 0, salesUSD: 0, costIQD: 0, costUSD: 0, profitIQD: 0, profitUSD: 0 },
        hotels: { count: 0, salesIQD: 0, salesUSD: 0, costIQD: 0, costUSD: 0, profitIQD: 0, profitUSD: 0 },
      },
      trendChartData: trendPoints,
    };
  }

  async create(companyId: string, dto: CreateTicketDto, userId?: string, activeBranchId?: string) {
    const { passengers, issueDate, entryDate, travelDate, returnDate, ...rest } = dto;
    const relations = await this.resolveTicketRelations(
      companyId,
      {
        ...rest,
        branchId: rest.branchId || activeBranchId,
      },
      { allowBranchFallback: !rest.branchId && Boolean(activeBranchId) },
    );

    // Server-side recalculation of totals from passenger lines to guarantee database accuracy
    const isRefund = rest.tripType === 'REFUND' || rest.status === 'REFUNDED';
    let computedTotalBuy = 0;
    let computedTotalSell = 0;
    let netBuy = 0;
    let netSell = 0;
    let profit = 0;
    const discountAmount = rest.discountAmount || 0;

    if (isRefund) {
      computedTotalBuy = rest.totalBuy ?? 0;
      computedTotalSell = rest.totalSell ?? 0;
      netBuy = rest.netBuy ?? computedTotalBuy;
      netSell = rest.netSell ?? computedTotalSell;
      profit = rest.profit ?? (netSell - netBuy);
    } else {
      if (passengers && passengers.length > 0) {
        for (const p of passengers) {
          const pBuy = (p.fareBuy || 0) + (p.tax1 || 0) + (p.tax2 || 0) + (p.charge || 0);
          const pSell = (p.fareSell || 0) + (p.tax1 || 0) + (p.tax2 || 0) + (p.charge || 0);
          computedTotalBuy += pBuy;
          computedTotalSell += pSell;
        }
      } else {
        computedTotalBuy = rest.totalBuy || 0;
        computedTotalSell = rest.totalSell || 0;
      }

      netSell = computedTotalSell - discountAmount;
      netBuy = computedTotalBuy;
      profit = netSell - netBuy;
    }

    this.assertPostingRelations(rest, relations, { netSell, netBuy });

    const created = await this.prisma.ticket.create({
      data: {
        invoiceNumber: rest.invoiceNumber,
        customerName: rest.customerName,
        customerId: relations.customerId,
        customerAccountId: relations.customerAccountId,
        employeeName: rest.employeeName,
        entryEmployee: rest.entryEmployee,
        modifiedByEmployee: rest.modifiedByEmployee,
        cashbox: rest.cashbox,
        currency: rest.currency || 'IQD',
        exchangeRate: rest.exchangeRate ?? 1,
        paymentType: rest.paymentType,
        supplierAccount: rest.supplierAccount,
        supplierAccountName: rest.supplierAccountName,
        supplierId: relations.supplierId,
        supplierAccountId: relations.supplierAccountId,
        tripType: rest.tripType,
        airline: rest.airline,
        airlineId: relations.airlineId,
        travelClass: rest.travelClass,
        pnr: rest.pnr,
        route: rest.route,
        discountType: rest.discountType,
        discountValue: rest.discountValue ?? 0,
        discountAmount,
        totalBuy: computedTotalBuy,
        totalSell: computedTotalSell,
        netBuy,
        netSell,
        profit,
        notes: rest.notes,
        agentName: rest.agentName,
        reference: rest.reference,
        status: rest.status || 'POSTED',
        paymentMethod: rest.paymentMethod,
        receivingCashbox: rest.receivingCashbox,
        cashboxAccountId: relations.cashboxAccountId,
        transferImage: rest.transferImage,
        branchId: relations.branchId,
        issueDate: issueDate ? new Date(issueDate) : new Date(),
        travelDate: travelDate ? new Date(travelDate) : null,
        returnDate: returnDate ? new Date(returnDate) : null,
        companyId,
        passengers: passengers && passengers.length > 0
          ? {
              create: passengers.map((p) => ({
                name: p.name || 'مسافر',
                ticketType: p.ticketType || 'ADULT',
                ticketNumber: p.ticketNumber || p.passportNumber,
                documentNumber: p.documentNumber || p.passportNumber,
                pnr: p.pnr,
                fareBuy: p.fareBuy || 0,
                fareSell: p.fareSell || 0,
                tax1: p.tax1 || 0,
                tax2: p.tax2 || 0,
                charge: p.charge || 0,
                percentage: p.percentage || 0,
                status: p.status || 'باقي',
              })),
            }
          : undefined,
      },
      include: { passengers: true },
    });

    if (isRefund) {
      try {
        await this.syncTicketJournalEntry(created, companyId, userId);
      } catch (error) {
        await this.prisma.ticket.delete({ where: { id: created.id } }).catch(() => null);
        throw error;
      }
    } else {
      this.syncTicketJournalEntry(created, companyId, userId).catch((err) => {
        console.warn('Failed to sync ticket journal entry on create:', err?.message);
      });
    }

    this.invalidateCache(companyId);
    return created;
  }

  async update(id: string, companyId: string, dto: UpdateTicketDto, userId?: string, activeBranchId?: string) {
    const existing = await this.findOne(id, companyId);
    const { passengers, issueDate, entryDate, travelDate, returnDate, ...rest } = dto;
    const relations = await this.resolveTicketRelations(
      companyId,
      {
        ...existing,
        ...rest,
        branchId: rest.branchId ?? existing.branchId ?? activeBranchId,
        customerId: rest.customerId ?? (rest.customerName !== undefined ? undefined : existing.customerId),
        customerAccountId: rest.customerAccountId ?? (rest.customerName !== undefined ? undefined : existing.customerAccountId),
        supplierId: rest.supplierId ?? (
          rest.supplierAccount !== undefined || rest.supplierAccountName !== undefined ? undefined : existing.supplierId
        ),
        supplierAccountId: rest.supplierAccountId ?? (
          rest.supplierAccount !== undefined || rest.supplierAccountName !== undefined ? undefined : existing.supplierAccountId
        ),
        airlineId: rest.airlineId ?? (rest.airline !== undefined ? undefined : existing.airlineId),
        cashboxAccountId: rest.cashboxAccountId ?? (
          rest.receivingCashbox !== undefined || rest.cashbox !== undefined ? undefined : existing.cashboxAccountId
        ),
      },
      { allowBranchFallback: rest.branchId === undefined && !existing.branchId && Boolean(activeBranchId) },
    );

    // Server-side recalculation of totals
    const isRefund = rest.tripType === 'REFUND' || existing.tripType === 'REFUND' || rest.status === 'REFUNDED' || existing.status === 'REFUNDED';
    let computedTotalBuy = 0;
    let computedTotalSell = 0;
    let netBuy = 0;
    let netSell = 0;
    let profit = 0;
    const discountAmount = rest.discountAmount ?? existing.discountAmount ?? 0;

    if (isRefund) {
      computedTotalBuy = rest.totalBuy ?? existing.totalBuy;
      computedTotalSell = rest.totalSell ?? existing.totalSell;
      netBuy = rest.netBuy ?? existing.netBuy;
      netSell = rest.netSell ?? existing.netSell;
      profit = rest.profit ?? existing.profit;
    } else {
      if (passengers && passengers.length > 0) {
        for (const p of passengers) {
          const pBuy = (p.fareBuy || 0) + (p.tax1 || 0) + (p.tax2 || 0) + (p.charge || 0);
          const pSell = (p.fareSell || 0) + (p.tax1 || 0) + (p.tax2 || 0) + (p.charge || 0);
          computedTotalBuy += pBuy;
          computedTotalSell += pSell;
        }
      } else {
        computedTotalBuy = rest.totalBuy ?? existing.totalBuy;
        computedTotalSell = rest.totalSell ?? existing.totalSell;
      }

      netSell = computedTotalSell - discountAmount;
      netBuy = computedTotalBuy;
      profit = netSell - netBuy;
    }

    this.assertPostingRelations({ ...existing, ...rest }, relations, { netSell, netBuy });

    // Delete old passengers and recreate
    if (passengers) {
      await this.prisma.ticketPassenger.deleteMany({ where: { ticketId: existing.id } });
    }

    const updated = await this.prisma.ticket.update({
      where: { id: existing.id },
      data: {
        ...(rest.invoiceNumber && { invoiceNumber: rest.invoiceNumber }),
        ...(rest.customerName !== undefined && { customerName: rest.customerName }),
        customerId: relations.customerId,
        customerAccountId: relations.customerAccountId,
        ...(rest.employeeName !== undefined && { employeeName: rest.employeeName }),
        ...(rest.entryEmployee !== undefined && { entryEmployee: rest.entryEmployee }),
        ...(rest.modifiedByEmployee !== undefined && { modifiedByEmployee: rest.modifiedByEmployee }),
        ...(rest.cashbox !== undefined && { cashbox: rest.cashbox }),
        ...(rest.currency !== undefined && { currency: rest.currency }),
        ...(rest.exchangeRate !== undefined && { exchangeRate: rest.exchangeRate }),
        ...(rest.paymentType !== undefined && { paymentType: rest.paymentType }),
        ...(rest.supplierAccount !== undefined && { supplierAccount: rest.supplierAccount }),
        ...(rest.supplierAccountName !== undefined && { supplierAccountName: rest.supplierAccountName }),
        supplierId: relations.supplierId,
        supplierAccountId: relations.supplierAccountId,
        ...(rest.tripType !== undefined && { tripType: rest.tripType }),
        ...(rest.airline !== undefined && { airline: rest.airline }),
        airlineId: relations.airlineId,
        ...(rest.travelClass !== undefined && { travelClass: rest.travelClass }),
        ...(rest.pnr !== undefined && { pnr: rest.pnr }),
        ...(rest.route !== undefined && { route: rest.route }),
        ...(rest.discountType !== undefined && { discountType: rest.discountType }),
        ...(rest.discountValue !== undefined && { discountValue: rest.discountValue }),
        discountAmount,
        totalBuy: computedTotalBuy,
        totalSell: computedTotalSell,
        netBuy,
        netSell,
        profit,
        ...(rest.notes !== undefined && { notes: rest.notes }),
        ...(rest.agentName !== undefined && { agentName: rest.agentName }),
        ...(rest.reference !== undefined && { reference: rest.reference }),
        ...(rest.status !== undefined && { status: rest.status }),
        ...(rest.paymentMethod !== undefined && { paymentMethod: rest.paymentMethod }),
        ...(rest.receivingCashbox !== undefined && { receivingCashbox: rest.receivingCashbox }),
        cashboxAccountId: relations.cashboxAccountId,
        branchId: relations.branchId,
        ...(rest.transferImage !== undefined && { transferImage: rest.transferImage }),
        ...(rest.isAudited !== undefined && {
          isAudited: rest.isAudited,
          auditedBy: rest.isAudited ? (rest.auditedBy || existing.auditedBy) : null,
          auditedAt: rest.isAudited ? (existing.auditedAt || new Date()) : null,
        }),
        ...(issueDate && { issueDate: new Date(issueDate) }),
        ...(travelDate !== undefined && { travelDate: travelDate ? new Date(travelDate) : null }),
        ...(returnDate !== undefined && { returnDate: returnDate ? new Date(returnDate) : null }),
        ...(passengers && {
          passengers: {
            create: passengers.map((p) => ({
              name: p.name || 'مسافر',
              ticketType: p.ticketType || 'ADULT',
              ticketNumber: p.ticketNumber || p.passportNumber,
              documentNumber: p.documentNumber || p.passportNumber,
              pnr: p.pnr,
              fareBuy: p.fareBuy || 0,
              fareSell: p.fareSell || 0,
              tax1: p.tax1 || 0,
              tax2: p.tax2 || 0,
              charge: p.charge || 0,
              percentage: p.percentage || 0,
              status: p.status || 'باقي',
            })),
          },
        }),
      },
      include: { passengers: true },
    });

    if (isRefund) {
      await this.syncTicketJournalEntry(updated, companyId, userId);
    } else {
      this.syncTicketJournalEntry(updated, companyId, userId).catch((err) => {
        console.warn('Failed to sync ticket journal entry on update:', err?.message);
      });
    }

    this.invalidateCache(companyId);
    return updated;
  }

  async toggleAudit(id: string, companyId: string, auditedBy: string) {
    const ticket = await this.findOne(id, companyId);
    const updated = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        isAudited: !ticket.isAudited,
        auditedBy: !ticket.isAudited ? auditedBy : null,
        auditedAt: !ticket.isAudited ? new Date() : null,
      },
      include: { passengers: true },
    });
    this.invalidateCache(companyId);
    return updated;
  }

  async cancelTicket(id: string, companyId: string, cancelReason?: string) {
    const ticket = await this.findOne(id, companyId);
    const updated = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: 'CANCELLED',
        notes: cancelReason ? `${ticket.notes ? ticket.notes + '\n' : ''}[سبب الإلغاء]: ${cancelReason}` : ticket.notes,
      },
      include: { passengers: true },
    });

    // Remove journal entry when cancelled
    await this.prisma.journalEntry.deleteMany({
      where: {
        companyId,
        reference: ticket.invoiceNumber,
      },
    }).catch(() => null);

    this.invalidateCache(companyId);
    return updated;
  }

  async remove(id: string, companyId: string) {
    const ticket = await this.findOne(id, companyId);
    await this.prisma.journalEntry.deleteMany({
      where: {
        companyId,
        reference: ticket.invoiceNumber,
      },
    }).catch(() => null);

    this.invalidateCache(companyId);
    return this.prisma.ticket.delete({ where: { id: ticket.id } });
  }

  async getStats(companyId: string) {
    const tickets = await this.prisma.ticket.findMany({
      where: { companyId },
      select: { totalSell: true, totalBuy: true, profit: true, passengers: { select: { id: true } } },
    });
    const count = tickets.length;
    const totalSales = tickets.reduce((s, t) => s + t.totalSell, 0);
    const totalCost = tickets.reduce((s, t) => s + t.totalBuy, 0);
    const totalProfit = tickets.reduce((s, t) => s + t.profit, 0);
    const totalPassengers = tickets.reduce((s, t) => s + t.passengers.length, 0);
    return { count, totalSales, totalCost, totalProfit, totalPassengers };
  }

  async syncTicketJournalEntry(ticket: any, companyId: string, userId?: string) {
    if (!ticket) return;

    const status = String(ticket.status || '').toUpperCase();
    const isRefund = ticket.tripType === 'REFUND' || status === 'REFUNDED' || String(ticket.invoiceNumber || '').startsWith('REF-');
    if (status !== 'POSTED' && !isRefund) {
      await this.prisma.journalEntry.deleteMany({
        where: {
          companyId,
          reference: ticket.invoiceNumber,
        },
      });
      return;
    }

    const rawNetSell = Number(ticket.netSell ?? ticket.totalSell ?? 0);
    const rawNetBuy = Number(ticket.netBuy ?? ticket.totalBuy ?? 0);
    const netSell = isRefund ? Math.abs(rawNetSell) : rawNetSell;
    const netBuy = isRefund ? Math.abs(rawNetBuy) : rawNetBuy;
    const profit = Number(ticket.profit ?? (netSell - netBuy));

    if (netSell <= 0 && netBuy <= 0) return;

    // 1. Resolve effective user ID & accounts concurrently in parallel
    const rawCustomer = ticket.customerName?.trim();
    const rawSupplier = ticket.supplierAccount?.trim();
    const rawSupplierName = ticket.supplierAccountName?.trim();
    const paymentType = (ticket.paymentType || '').toString().toUpperCase();
    const isCash = ['DEBIT', 'CASH', 'CASH_HAND', 'MASTER_CARD'].includes(paymentType) || ticket.paymentType === 'نقدي';
    const targetCb = isCash ? (ticket.receivingCashbox || ticket.cashbox || ticket.paymentMethod) : null;
    const isVisa = ticket.tripType === 'VISA'
      || String(ticket.invoiceNumber || '').toUpperCase().includes('VISA')
      || String(ticket.reference || '').toUpperCase().includes('VISA')
      || String(ticket.airline || '').toUpperCase().includes('VISA');

    const [userRecord, custAccountResult, suppAccountResult, cbAccountResult, revRecord] = await Promise.all([
      // User ID
      userId ? Promise.resolve({ id: userId }) : this.prisma.user.findFirst({ where: { companyId } }),
      // Customer Account
      (async () => {
        if (ticket.customerAccountId) return ticket.customerAccountId;
        if (!rawCustomer) return null;
        const cust = await this.prisma.customer.findFirst({
          where: { companyId, OR: [{ id: rawCustomer }, { nameAr: rawCustomer }, { nameEn: rawCustomer }, { code: rawCustomer }] },
        });
        if (cust?.accountId) return cust.accountId;
        const acc = await this.prisma.account.findFirst({
          where: { companyId, OR: [{ id: rawCustomer }, { nameAr: rawCustomer }, { code: rawCustomer }] },
        });
        return acc?.id || null;
      })(),
      // Supplier Account
      (async () => {
        if (ticket.supplierAccountId) return ticket.supplierAccountId;
        if (!rawSupplier && !rawSupplierName) return null;
        const supp = await this.prisma.supplier.findFirst({
          where: {
            companyId,
            OR: [
              ...(rawSupplier ? [{ id: rawSupplier }, { code: rawSupplier }, { nameAr: rawSupplier }] : []),
              ...(rawSupplierName ? [{ nameAr: rawSupplierName }, { nameEn: rawSupplierName }] : []),
            ],
          },
        });
        if (supp?.accountId) return supp.accountId;
        const acc = await this.prisma.account.findFirst({
          where: {
            companyId,
            OR: [
              ...(rawSupplier ? [{ id: rawSupplier }, { code: rawSupplier }, { nameAr: rawSupplier }] : []),
              ...(rawSupplierName ? [{ nameAr: rawSupplierName }] : []),
            ],
          },
        });
        return acc?.id || null;
      })(),
      // Cashbox Account
      (async () => {
        if (ticket.cashboxAccountId) return ticket.cashboxAccountId;
        if (!targetCb) return null;
        const cb = await this.prisma.cashbox.findFirst({
          where: { companyId, OR: [{ id: targetCb }, { code: targetCb }, { nameAr: targetCb }, { accountId: targetCb }] },
        });
        if (cb?.accountId) return cb.accountId;
        const acc = await this.prisma.account.findFirst({
          where: { companyId, OR: [{ id: targetCb }, { code: targetCb }, { nameAr: targetCb }] },
        });
        return acc?.id || null;
      })(),
      // Revenue Account
      (async () => {
        const preferred = await this.prisma.account.findFirst({
          where: {
            companyId,
            code: { in: isVisa ? ['4131', '413'] : ['4111', '411'] },
          },
          orderBy: { code: 'desc' },
        });
        return preferred || this.prisma.account.findFirst({ where: { companyId, type: 'REVENUE' } });
      })(),
    ]);

    const createdById = userRecord?.id || userId;
    if (!createdById) return;

    let customerAccountId = custAccountResult;
    if (!customerAccountId) {
      const defCust = await this.prisma.account.findFirst({
        where: { companyId, OR: [{ code: '141' }, { code: '14' }, { category: 'CUSTOMER' }] },
      });
      customerAccountId = defCust?.id || null;
    }

    let supplierAccountId = suppAccountResult;
    if (!supplierAccountId) {
      const defSupp = await this.prisma.account.findFirst({
        where: { companyId, OR: [{ code: '261' }, { code: '26' }, { category: 'SUPPLIER' }] },
      });
      supplierAccountId = defSupp?.id || null;
    }

    let cashboxAccountId = cbAccountResult;
    if (isCash && !cashboxAccountId) {
      const defCb = await this.prisma.account.findFirst({
        where: { companyId, OR: [{ code: '1811' }, { code: '181' }, { category: 'CASH' }] },
      });
      cashboxAccountId = defCb?.id || null;
    }

    const revenueAccountId = revRecord?.id || null;
    const resolvedCustomerName = ticket.customerName?.trim() || '';

    // 6. Build lines
    const lines: Array<{ accountId: string; debit: Prisma.Decimal; credit: Prisma.Decimal; description: string }> = [];

    const isDirectDebit = isCash && cashboxAccountId;
    const debitAccountId = isDirectDebit ? cashboxAccountId : customerAccountId;

    if (isRefund) {
      const settlementAccountId = isCash ? cashboxAccountId : customerAccountId;
      const revenueReversal = netSell - netBuy;

      if (!settlementAccountId && netSell > 0) {
        throw new BadRequestException('تعذر ترحيل الاسترجاع من دون حساب العميل أو حساب الصرف');
      }
      if (!supplierAccountId && netBuy > 0) {
        throw new BadRequestException('تعذر ترحيل الاسترجاع من دون حساب المورد المسترجع منه');
      }
      if (!revenueAccountId && Math.abs(revenueReversal) > 0.0001) {
        throw new BadRequestException('تعذر ترحيل الاسترجاع لعدم وجود حساب إيراد مناسب لعكس العملية');
      }

      if (supplierAccountId && netBuy > 0) {
        lines.push({
          accountId: supplierAccountId,
          debit: new Prisma.Decimal(netBuy),
          credit: new Prisma.Decimal(0),
          description: `مبلغ مستلم من المورد عن الاسترجاع - ${ticket.invoiceNumber}`,
        });
      }

      if (revenueAccountId && revenueReversal > 0) {
        lines.push({
          accountId: revenueAccountId,
          debit: new Prisma.Decimal(revenueReversal),
          credit: new Prisma.Decimal(0),
          description: `عكس إيراد عملية مسترجعة - ${ticket.invoiceNumber}`,
        });
      } else if (revenueAccountId && revenueReversal < 0) {
        lines.push({
          accountId: revenueAccountId,
          debit: new Prisma.Decimal(0),
          credit: new Prisma.Decimal(Math.abs(revenueReversal)),
          description: `فرق تسوية استرجاع لصالح الشركة - ${ticket.invoiceNumber}`,
        });
      }

      if (settlementAccountId && netSell > 0) {
        lines.push({
          accountId: settlementAccountId,
          debit: new Prisma.Decimal(0),
          credit: new Prisma.Decimal(netSell),
          description: isCash
            ? `مبلغ معاد للعميل من الصندوق أو البنك - ${ticket.invoiceNumber}`
            : `تخفيض رصيد العميل عن الاسترجاع - ${ticket.invoiceNumber} (${resolvedCustomerName})`,
        });
      }
    } else {
      if (isCash && customerAccountId && cashboxAccountId && customerAccountId !== cashboxAccountId) {
        // 1. Invoice Sales Entry (Customer is Debited)
        lines.push({
          accountId: customerAccountId,
          debit: new Prisma.Decimal(netSell),
          credit: new Prisma.Decimal(0),
          description: `قيمة مبيعات تذكرة/تأشيرة - ${ticket.invoiceNumber} (${resolvedCustomerName})`,
        });

        // 2. Cash Receipt Settlement Entry (Cashbox is Debited, Customer is Credited)
        lines.push({
          accountId: cashboxAccountId,
          debit: new Prisma.Decimal(netSell),
          credit: new Prisma.Decimal(0),
          description: `مقبوضات مبيعات تذكرة نقدية باليد - ${ticket.invoiceNumber} (${resolvedCustomerName})`,
        });

        lines.push({
          accountId: customerAccountId,
          debit: new Prisma.Decimal(0),
          credit: new Prisma.Decimal(netSell),
          description: `سداد فوري لمبيعات تذكرة نقدية باليد - ${ticket.invoiceNumber} (${resolvedCustomerName})`,
        });
      } else {
        if (debitAccountId && netSell > 0) {
          lines.push({
            accountId: debitAccountId,
            debit: new Prisma.Decimal(netSell),
            credit: new Prisma.Decimal(0),
            description: isCash
              ? `مقبوضات مبيعات تذكرة/تأشيرة نقدية - ${ticket.invoiceNumber} (${resolvedCustomerName})`
              : `قيمة مبيعات تذكرة/تأشيرة آجل - ${ticket.invoiceNumber} (${resolvedCustomerName})`,
          });
        }
      }

      if (supplierAccountId && netBuy > 0) {
        lines.push({
          accountId: supplierAccountId,
          debit: new Prisma.Decimal(0),
          credit: new Prisma.Decimal(netBuy),
          description: `استحقاق مزود التذاكر/التأشيرات - ${ticket.invoiceNumber} (${ticket.supplierAccountName || ''})`,
        });
      }

      if (revenueAccountId && profit > 0) {
        lines.push({
          accountId: revenueAccountId,
          debit: new Prisma.Decimal(0),
          credit: new Prisma.Decimal(profit),
          description: `أرباح مبيعات التذاكر/التأشيرات - ${ticket.invoiceNumber}`,
        });
      } else if (revenueAccountId && profit < 0) {
        lines.push({
          accountId: revenueAccountId,
          debit: new Prisma.Decimal(Math.abs(profit)),
          credit: new Prisma.Decimal(0),
          description: `خسائر/فروقات مبيعات تذاكر - ${ticket.invoiceNumber}`,
        });
      }
    }

    // Delete existing
    await this.prisma.journalEntry.deleteMany({
      where: {
        companyId,
        reference: ticket.invoiceNumber,
      },
    });

    if (lines.length >= 2) {
      const totalDeb = lines.reduce((s, l) => s + Number(l.debit), 0);
      const totalCred = lines.reduce((s, l) => s + Number(l.credit), 0);
      if (Math.abs(totalDeb - totalCred) > 0.0001) {
        throw new BadRequestException(`قيد العملية غير متوازن: المدين ${totalDeb} والدائن ${totalCred}`);
      }
      const entryNumber = `${isRefund ? 'JV-REF' : 'JV-TKT'}-${ticket.invoiceNumber}`;

      await this.prisma.journalEntry.create({
        data: {
          entryNumber,
          reference: ticket.invoiceNumber,
          date: ticket.issueDate ? new Date(ticket.issueDate) : new Date(),
          description: isRefund
            ? `قيد استرجاع رقم ${ticket.invoiceNumber}: ${resolvedCustomerName} / ${ticket.reference || ''}`
            : `قيد فاتورة مبيعات رقم ${ticket.invoiceNumber}: ${resolvedCustomerName} / ${ticket.airline || ticket.pnr || ''}`,
          status: 'POSTED',
          totalDebit: new Prisma.Decimal(totalDeb),
          totalCredit: new Prisma.Decimal(totalCred),
          companyId,
          createdById,
          postedById: createdById,
          sourceType: isVisa ? 'VISA' : 'TICKET',
          sourceId: ticket.id,
          lines: {
            create: lines,
          },
        },
      });
    }
  }

  async syncAllCompanyTickets(companyId: string) {
    try {
      const tickets = await this.prisma.ticket.findMany({
        where: { companyId, status: { in: ['POSTED', 'REFUNDED'] } },
      });
      for (const t of tickets) {
        await this.syncTicketJournalEntry(t, companyId).catch(() => null);
      }
    } catch (e) {
      // ignore
    }
  }
}
