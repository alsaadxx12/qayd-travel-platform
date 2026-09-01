import { randomUUID } from 'crypto';
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MicroCache } from '../common/micro-cache';
import { AccountType, AccountCategory, Prisma } from '@prisma/client';
import { IsNotEmpty, IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ImportTreeDto {
  @ApiProperty({ description: 'قائمة الحسابات المستوردة', type: [Object] })
  @IsNotEmpty()
  accounts: any[];

  @ApiPropertyOptional({ description: 'مسح الشجرة الحالية قبل الاستيراد', default: true })
  @IsOptional()
  wipeExisting?: boolean;
}

export class CreateAccountDto {
  @ApiProperty({ example: '1811', description: 'كود الحساب' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'صندوق الفرع الرئيسي', description: 'اسم الحساب بالعربية' })
  @IsString()
  @IsNotEmpty()
  nameAr: string;

  @ApiPropertyOptional({ example: 'Main Branch Cashbox', description: 'اسم الحساب بالإنجليزية' })
  @IsString()
  @IsOptional()
  nameEn?: string;

  @ApiProperty({ enum: AccountType, example: AccountType.ASSET, description: 'نوع الحساب (أصول، التزامات، إلخ)' })
  @IsEnum(AccountType)
  type: AccountType;

  @ApiPropertyOptional({ enum: AccountCategory, example: AccountCategory.CASH })
  @IsEnum(AccountCategory)
  @IsOptional()
  category?: AccountCategory;

  @ApiPropertyOptional({ description: 'معرف الحساب الأب (إن وجد)' })
  @IsString()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({ example: 'MULTI', description: 'عملة الحساب. كل الحسابات تدعم الدينار والدولار (MULTI).' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ example: 'ALL_BRANCHES', description: 'نطاق الفروع' })
  @IsString()
  @IsOptional()
  branchScope?: string;

  @ApiPropertyOptional({ description: 'معرفات الفروع المحددة' })
  @IsOptional()
  branchIds?: string[];

  @ApiPropertyOptional({ example: '07701234567', description: 'رقم الهاتف' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'ali@example.com', description: 'البريد الإلكتروني' })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: 'بغداد - الكرادة', description: 'العنوان' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ example: 'أحمد علي', description: 'الشخص المسؤول' })
  @IsString()
  @IsOptional()
  contactPerson?: string;

  @ApiPropertyOptional({ example: 5000000, description: 'حد الائتمان بالدينار IQD' })
  @IsOptional()
  creditLimit?: number;

  @ApiPropertyOptional({ example: 3500, description: 'حد الائتمان بالدولار USD' })
  @IsOptional()
  creditLimitUSD?: number;

  @ApiPropertyOptional({ example: 30, description: 'مدة السداد' })
  @IsOptional()
  paymentDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  paymentMode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  overduePolicy?: string;

  @ApiPropertyOptional({ example: 'CUSTOMER', description: 'طبيعة المعاملة (CUSTOMER / SUPPLIER / BOTH / GENERAL)' })
  @IsOptional()
  accountRole?: string;

  @ApiPropertyOptional({ example: false, description: 'منع التعامل نهائياً مع الحساب' })
  @IsOptional()
  isBlocked?: boolean;

  @ApiPropertyOptional({ example: 0, description: 'الرصيد الافتتاحي بالدينار' })
  @IsOptional()
  openingAmountIQD?: number;

  @ApiPropertyOptional({ example: 0, description: 'الرصيد الافتتاحي بالدولار' })
  @IsOptional()
  openingAmountUSD?: number;

  @ApiPropertyOptional({ example: 'DEBIT', description: 'طبيعة الرصيد الافتتاحي' })
  @IsOptional()
  openingNature?: string;

  @ApiPropertyOptional({ example: '2026/01/01', description: 'تاريخ الرصيد الافتتاحي' })
  @IsOptional()
  openingDate?: string;

  @ApiPropertyOptional({ example: 'رصيد مرحل', description: 'ملاحظات الرصيد الافتتاحي' })
  @IsOptional()
  openingNotes?: string;
}

export class UpdateAccountDto {
  @ApiPropertyOptional({ example: '1811', description: 'كود الحساب' })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({ example: 'صندوق الفرع الرئيسي', description: 'اسم الحساب بالعربية' })
  @IsString()
  @IsOptional()
  nameAr?: string;

  @ApiPropertyOptional({ example: 'Main Cashbox', description: 'اسم الحساب بالإنجليزية' })
  @IsString()
  @IsOptional()
  nameEn?: string;

  @ApiPropertyOptional({ enum: AccountType })
  @IsEnum(AccountType)
  @IsOptional()
  type?: AccountType;

  @ApiPropertyOptional({ enum: AccountCategory })
  @IsEnum(AccountCategory)
  @IsOptional()
  category?: AccountCategory;

  @ApiPropertyOptional({ example: 'CUSTOMER', description: 'طبيعة المعاملة (CUSTOMER / SUPPLIER / BOTH / GENERAL)' })
  @IsOptional()
  accountRole?: string;

  @ApiPropertyOptional({ example: false, description: 'منع التعامل نهائياً مع الحساب' })
  @IsOptional()
  isBlocked?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({ example: 'IQD' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ example: 'ALL_BRANCHES' })
  @IsString()
  @IsOptional()
  branchScope?: string;

  @ApiPropertyOptional()
  @IsOptional()
  branchIds?: string[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  contactPerson?: string;

  @ApiPropertyOptional({ example: 5000000, description: 'حد الائتمان بالدينار IQD' })
  @IsOptional()
  creditLimit?: number;

  @ApiPropertyOptional({ example: 3500, description: 'حد الائتمان بالدولار USD' })
  @IsOptional()
  creditLimitUSD?: number;

  @ApiPropertyOptional({ example: 30, description: 'مدة السداد' })
  @IsOptional()
  paymentDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  paymentMode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  overduePolicy?: string;

  @ApiPropertyOptional({ example: 0, description: 'الرصيد الافتتاحي بالدينار' })
  @IsOptional()
  openingAmountIQD?: number;

  @ApiPropertyOptional({ example: 0, description: 'الرصيد الافتتاحي بالدولار' })
  @IsOptional()
  openingAmountUSD?: number;

  @ApiPropertyOptional({ example: 'DEBIT', description: 'طبيعة الرصيد الافتتاحي' })
  @IsOptional()
  openingNature?: string;

  @ApiPropertyOptional({ example: '2026/01/01', description: 'تاريخ الرصيد الافتتاحي' })
  @IsOptional()
  openingDate?: string;

  @ApiPropertyOptional({ example: 'رصيد مرحل', description: 'ملاحظات الرصيد الافتتاحي' })
  @IsOptional()
  openingNotes?: string;
}

@Injectable()
export class AccountsService {
  private treeCache = new MicroCache(5 * 60_000, 2000, { refreshAhead: true });
  private flatCache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_TTL = 60000;

  public invalidateCache(companyId?: string) {
    if (companyId) this.seededCompanies.delete(companyId);
    else this.seededCompanies.clear();
    this.treeCache.invalidate(companyId ? `${companyId}:` : undefined);
    if (companyId) {
      for (const key of this.flatCache.keys()) {
        if (key.startsWith(companyId)) this.flatCache.delete(key);
      }
    } else {
      this.flatCache.clear();
    }
  }

  constructor(private prisma: PrismaService) {}

  private resolveAccountCurrency(_value?: string | null): string {
    return 'MULTI';
  }


  // ── Journal-line balance aggregation ────────────────────────────────────────
  //
  // `findAll` used to load EVERY posted journal line in the company into memory
  // just to sum debit/credit per account. On a company with a real ticket history
  // that is tens of thousands of rows on every cold-cache call.
  //
  // The sums are now done by Postgres. The one thing that cannot be pushed down
  // naively is the currency split, which is decided by looking for text markers in
  // the line and its entry. That test is defined once, below, and used by both the
  // aggregate path and the row-scan path kept for verification.

  private static readonly USD_TEXT_MARKS = ['USD', 'دولار'];

  /** Mirrors the JS test: upper-cased(line.description + entry.description + entry.reference) contains USD / دولار / $ */
  private usdLineWhere(companyId: string): Prisma.JournalEntryLineWhereInput {
    const lineOr: Prisma.JournalEntryLineWhereInput[] = [
      ...AccountsService.USD_TEXT_MARKS.map((m) => ({
        description: { contains: m, mode: 'insensitive' as const },
      })),
      { description: { contains: '$' } },
    ];

    const entryOr: Prisma.JournalEntryWhereInput[] = [
      ...AccountsService.USD_TEXT_MARKS.map((m) => ({
        description: { contains: m, mode: 'insensitive' as const },
      })),
      ...AccountsService.USD_TEXT_MARKS.map((m) => ({
        reference: { contains: m, mode: 'insensitive' as const },
      })),
      { description: { contains: '$' } },
      { reference: { contains: '$' } },
    ];

    return {
      journalEntry: { companyId, status: 'POSTED' },
      OR: [...lineOr, { journalEntry: { OR: entryOr } }],
    };
  }

  /**
   * Two grouped queries: the grand total per account, and the USD subset.
   * IQD is derived as (total - USD) rather than by a negated text match, because
   * `NOT (description ILIKE ...)` is NULL in SQL when description is NULL, which
   * would silently drop those lines from BOTH buckets. description is nullable, so
   * that mistake would quietly understate balances.
   */
  private async computeLineTotalsAggregated(companyId: string) {
    const [totals, usdTotals] = await Promise.all([
      this.prisma.journalEntryLine.groupBy({
        by: ['accountId'],
        where: { journalEntry: { companyId, status: 'POSTED' } },
        _sum: { debit: true, credit: true },
      }),
      this.prisma.journalEntryLine.groupBy({
        by: ['accountId'],
        where: this.usdLineWhere(companyId),
        _sum: { debit: true, credit: true },
      }),
    ]);

    const map = new Map<string, { debitUSD: number; creditUSD: number; debitIQD: number; creditIQD: number }>();

    totals.forEach((row) => {
      if (!row.accountId) return;
      map.set(row.accountId, {
        debitUSD: 0,
        creditUSD: 0,
        debitIQD: Number(row._sum.debit || 0),
        creditIQD: Number(row._sum.credit || 0),
      });
    });

    usdTotals.forEach((row) => {
      if (!row.accountId) return;
      const cur = map.get(row.accountId) || { debitUSD: 0, creditUSD: 0, debitIQD: 0, creditIQD: 0 };
      const d = Number(row._sum.debit || 0);
      const c = Number(row._sum.credit || 0);
      cur.debitUSD = d;
      cur.creditUSD = c;
      cur.debitIQD -= d;
      cur.creditIQD -= c;
      map.set(row.accountId, cur);
    });

    return map;
  }

  /** The original row-by-row computation. Retained solely so the aggregate can be checked against it. */
  private async computeLineTotalsByScan(companyId: string) {
    const journalLines = await this.prisma.journalEntryLine.findMany({
      where: { journalEntry: { companyId, status: 'POSTED' } },
      select: {
        accountId: true,
        debit: true,
        credit: true,
        description: true,
        journalEntry: { select: { description: true, reference: true } },
      },
    });

    const map = new Map<string, { debitUSD: number; creditUSD: number; debitIQD: number; creditIQD: number }>();
    journalLines.forEach((l) => {
      if (!l.accountId) return;
      const fullText = `${l.description || ''} ${(l as any).journalEntry?.description || ''} ${(l as any).journalEntry?.reference || ''}`.toUpperCase();
      const isUSD =
        fullText.includes('USD') ||
        fullText.includes('$') ||
        fullText.includes('دولار') ||
        fullText.includes('OPENING-USD-');
      let cur = map.get(l.accountId);
      if (!cur) {
        cur = { debitUSD: 0, creditUSD: 0, debitIQD: 0, creditIQD: 0 };
        map.set(l.accountId, cur);
      }
      if (isUSD) {
        cur.debitUSD += Number(l.debit || 0);
        cur.creditUSD += Number(l.credit || 0);
      } else {
        cur.debitIQD += Number(l.debit || 0);
        cur.creditIQD += Number(l.credit || 0);
      }
    });
    return map;
  }

  /**
   * Runs both paths on the live data and reports every account whose numbers differ
   * by more than `tolerance`. Intended to be called once against real data before
   * trusting the fast path.
   */
  async verifyBalanceAggregation(companyId: string, tolerance = 0.01) {
    const startedAt = Date.now();
    const scanStart = Date.now();
    const scan = await this.computeLineTotalsByScan(companyId);
    const scanMs = Date.now() - scanStart;

    const aggStart = Date.now();
    const agg = await this.computeLineTotalsAggregated(companyId);
    const aggMs = Date.now() - aggStart;

    const accountIds = new Set<string>([...scan.keys(), ...agg.keys()]);
    const zero = { debitUSD: 0, creditUSD: 0, debitIQD: 0, creditIQD: 0 };
    const fields: Array<keyof typeof zero> = ['debitIQD', 'creditIQD', 'debitUSD', 'creditUSD'];

    const mismatches: any[] = [];
    accountIds.forEach((id) => {
      const a = scan.get(id) || zero;
      const b = agg.get(id) || zero;
      const diffs: Record<string, { scan: number; aggregate: number; diff: number }> = {};
      fields.forEach((f) => {
        const d = Math.abs(a[f] - b[f]);
        if (d > tolerance) diffs[f] = { scan: a[f], aggregate: b[f], diff: a[f] - b[f] };
      });
      if (Object.keys(diffs).length > 0) mismatches.push({ accountId: id, ...diffs });
    });

    const codes = new Map<string, string>();
    if (mismatches.length > 0) {
      const rows = await this.prisma.account.findMany({
        where: { id: { in: mismatches.slice(0, 50).map((m) => m.accountId) } },
        select: { id: true, code: true, nameAr: true },
      });
      rows.forEach((r) => codes.set(r.id, `${r.code} - ${r.nameAr}`));
    }

    return {
      ok: mismatches.length === 0,
      tolerance,
      accountsCompared: accountIds.size,
      mismatchCount: mismatches.length,
      timing: { scanMs, aggregateMs: aggMs, totalMs: Date.now() - startedAt },
      mismatches: mismatches.slice(0, 50).map((m) => ({ ...m, account: codes.get(m.accountId) || m.accountId })),
    };
  }

  /**
   * Seeding guard. This ran on EVERY /accounts request and cost two sequential
   * queries before the real one — `company.findUnique` then `account.count` — for a
   * branch that fires once in a company's lifetime. On the hosted database that was
   * most of why `/accounts?lite=1` measured 2.4s.
   *
   * Once a company is known to have accounts, the check is skipped for the life of
   * the process. Deleting every account of a company would need a restart (or a call
   * to `invalidateCache`) before the seed would run again — an acceptable trade for
   * removing two round trips from a hot path.
   */
  private seededCompanies = new Set<string>();

  private async ensureDefaultAccounts(companyId: string) {
    if (this.seededCompanies.has(companyId)) return;

    let company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      try {
        company = await this.prisma.company.create({
          data: {
            id: companyId,
            name: 'شركة الفرسان للسياحة والسفر',
            code: 'COMP-001',
            currency: 'IQD',
            isDefault: true,
          },
        });
      } catch (e) {
        company = await this.prisma.company.findFirst();
        if (!company) {
          company = await this.prisma.company.create({
            data: {
              name: 'شركة الفرسان للسياحة والسفر',
              code: `COMP-${Date.now()}`,
              currency: 'IQD',
              isDefault: true,
            },
          });
        }
      }
    }

    const targetCompanyId = company.id;

    // Check count: if accounts already exist for this company, DO NOT RE-SEED OR OVERWRITE DELETIONS!
    const count = await this.prisma.account.count({ where: { companyId: targetCompanyId } });
    if (count > 0) {
      this.seededCompanies.add(companyId);
      this.seededCompanies.add(targetCompanyId);
      return;
    }

    // Full Official Unified Iraqi Accounting System Seed (الدليل المحاسبي الموحد العراقي الشامل لشركات السياحة)
    const defaults = [
      // ================= 1. الموجودات (Assets) =================
      { code: '1', nameAr: 'الموجودات (Assets)', nameEn: 'Assets', type: AccountType.ASSET, category: AccountCategory.GENERAL, level: 1, isParent: true, parentCode: null },
      
      // 11 الموجودات الثابتة
      { code: '11', nameAr: 'الموجودات الثابتة', nameEn: 'Fixed Assets', type: AccountType.ASSET, category: AccountCategory.GENERAL, level: 2, isParent: true, parentCode: '1' },
      { code: '111', nameAr: 'الأراضي والعقارات', nameEn: 'Land & Real Estate', type: AccountType.ASSET, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '11' },
      { code: '112', nameAr: 'المباني والإنشاءات', nameEn: 'Buildings', type: AccountType.ASSET, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '11' },
      { code: '113', nameAr: 'الآلات والمعدات وأجهزة الحاسوب', nameEn: 'Computers & Equipment', type: AccountType.ASSET, category: AccountCategory.GENERAL, level: 3, isParent: true, parentCode: '11' },
      { code: '1131', nameAr: 'أجهزة الحاسوب والسيرفرات', nameEn: 'Computers & Servers', type: AccountType.ASSET, category: AccountCategory.GENERAL, level: 4, isParent: false, parentCode: '113' },
      { code: '1132', nameAr: 'أجهزة التكييف والأثاث المكتبي', nameEn: 'Air Conditioners & Office Furniture', type: AccountType.ASSET, category: AccountCategory.GENERAL, level: 4, isParent: false, parentCode: '113' },
      { code: '114', nameAr: 'وسائط النقل والمواصلات', nameEn: 'Vehicles & Buses', type: AccountType.ASSET, category: AccountCategory.GENERAL, level: 3, isParent: true, parentCode: '11' },

      { code: '14', nameAr: 'المدينون (العملاء والذمم المدينة)', nameEn: 'Debtors & Receivables', type: AccountType.ASSET, category: AccountCategory.CUSTOMER, level: 2, isParent: true, parentCode: '1' },
      { code: '141', nameAr: 'عملاء تذاكر الأفراد', nameEn: 'Individual Ticket Clients', type: AccountType.ASSET, category: AccountCategory.CUSTOMER, level: 3, isParent: true, parentCode: '14' },
      { code: '142', nameAr: 'عملاء الشركات والقطاع الخاص', nameEn: 'Corporate Clients', type: AccountType.ASSET, category: AccountCategory.CUSTOMER, level: 3, isParent: true, parentCode: '14' },
      { code: '143', nameAr: 'مكاتب وشركات السياحة B2B', nameEn: 'Travel Agencies (B2B)', type: AccountType.ASSET, category: AccountCategory.CUSTOMER, level: 3, isParent: true, parentCode: '14' },
      { code: '144', nameAr: 'ذمم مدينة أخرى وسلف الموظفين', nameEn: 'Other Receivables & Advances', type: AccountType.ASSET, category: AccountCategory.CUSTOMER, level: 3, isParent: true, parentCode: '14' },
      { code: '1441', nameAr: 'سلف الموظفين المؤقتة', nameEn: 'Employee Temporary Advances', type: AccountType.ASSET, category: AccountCategory.CUSTOMER, level: 4, isParent: false, parentCode: '144' },

      { code: '18', nameAr: 'النقود والأرصدة', nameEn: 'Cash & Balances', type: AccountType.ASSET, category: AccountCategory.CASH, level: 2, isParent: true, parentCode: '1' },
      { code: '181', nameAr: 'الصناديق النقدية', nameEn: 'Cashboxes', type: AccountType.ASSET, category: AccountCategory.CASH, level: 3, isParent: true, parentCode: '18' },
      { code: '1811', nameAr: 'الصندوق الرئيسي', nameEn: 'Main Cashbox', type: AccountType.ASSET, category: AccountCategory.CASH, level: 4, isParent: false, parentCode: '181' },
      { code: '1812', nameAr: 'صندوق فرعي', nameEn: 'Secondary Cashbox', type: AccountType.ASSET, category: AccountCategory.CASH, level: 4, isParent: false, parentCode: '181' },
      { code: '182', nameAr: 'الحسابات البنكية', nameEn: 'Bank Accounts', type: AccountType.ASSET, category: AccountCategory.BANK, level: 3, isParent: true, parentCode: '18' },
      { code: '1821', nameAr: 'الحساب البنكي الرئيسي', nameEn: 'Main Bank Account', type: AccountType.ASSET, category: AccountCategory.BANK, level: 4, isParent: false, parentCode: '182' },
      { code: '183', nameAr: 'الحسابات والمحافظ الإلكترونية', nameEn: 'Electronic Accounts & Wallets', type: AccountType.ASSET, category: AccountCategory.CASH, level: 3, isParent: true, parentCode: '18' },
      { code: '1831', nameAr: 'المحافظ الإلكترونية (ZainCash / QiCard)', nameEn: 'E-Wallets', type: AccountType.ASSET, category: AccountCategory.CASH, level: 4, isParent: false, parentCode: '183' },

      { code: '2', nameAr: 'المطلوبات ورأس المال (Liabilities & Capital)', nameEn: 'Liabilities & Equity', type: AccountType.LIABILITY, category: AccountCategory.GENERAL, level: 1, isParent: true, parentCode: null },
      { code: '21', nameAr: 'رأس المال والمشاركات', nameEn: 'Capital & Reserves', type: AccountType.EQUITY, category: AccountCategory.GENERAL, level: 2, isParent: true, parentCode: '2' },
      { code: '211', nameAr: 'رأس المال مدفوع', nameEn: 'Paid-in Capital', type: AccountType.EQUITY, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '21' },
      { code: '212', nameAr: 'الاحتياطيات والأرباح المدورة', nameEn: 'Retained Earnings & Reserves', type: AccountType.EQUITY, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '21' },
      { code: '26', nameAr: 'الدائنون (الموردون وشركات الطيران)', nameEn: 'Creditors & Payables', type: AccountType.LIABILITY, category: AccountCategory.SUPPLIER, level: 2, isParent: true, parentCode: '2' },
      { code: '261', nameAr: 'شركات ومزودو تذاكر الطيران (Airlines)', nameEn: 'Airlines Payables', type: AccountType.LIABILITY, category: AccountCategory.SUPPLIER, level: 3, isParent: true, parentCode: '26' },
      { code: '262', nameAr: 'متعهدو الفنادق والبرامج السياحية', nameEn: 'Hotels & Tour Operators', type: AccountType.LIABILITY, category: AccountCategory.SUPPLIER, level: 3, isParent: true, parentCode: '26' },
      { code: '263', nameAr: 'مكاتب ومزودو الفيز والتأشيرات', nameEn: 'Visa Processing Suppliers', type: AccountType.LIABILITY, category: AccountCategory.SUPPLIER, level: 3, isParent: true, parentCode: '26' },
      { code: '266', nameAr: 'حسابات دائنة أخرى وأمانات', nameEn: 'Other Payables & Client Deposits', type: AccountType.LIABILITY, category: AccountCategory.SUPPLIER, level: 3, isParent: true, parentCode: '26' },
      { code: '2661', nameAr: 'أمانات وودائع العملاء المقبوضة مقدمًا', nameEn: 'Client Advance Deposits', type: AccountType.LIABILITY, category: AccountCategory.SUPPLIER, level: 4, isParent: false, parentCode: '266' },

      { code: '3', nameAr: 'الاستخدامات (التكاليف والمصروفات)', nameEn: 'Expenses & Costs', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 1, isParent: true, parentCode: null },
      { code: '33', nameAr: 'تكاليف الخدمات والنشاط السياحي', nameEn: 'Cost of Tourism Services', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 2, isParent: true, parentCode: '3' },
      { code: '331', nameAr: 'تكلفة تذاكر الطيران (Flight Tickets)', nameEn: 'Flight Tickets Cost', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 3, isParent: true, parentCode: '33' },
      { code: '3311', nameAr: 'تكلفة تذاكر الطيران المنتظم (BSP/IATA)', nameEn: 'Scheduled Flights Cost', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 4, isParent: false, parentCode: '331' },
      { code: '3312', nameAr: 'تكلفة تذاكر الطيران العارض (Charter)', nameEn: 'Charter Flights Cost', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 4, isParent: false, parentCode: '331' },
      { code: '332', nameAr: 'تكلفة الفنادق والبرامج السياحية', nameEn: 'Hotels & Tour Packages Cost', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 3, isParent: true, parentCode: '33' },
      { code: '3321', nameAr: 'تكلفة حجز الفنادق والإقامة', nameEn: 'Hotel Booking Cost', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 4, isParent: false, parentCode: '332' },
      { code: '3322', nameAr: 'تكلفة النقل والمزارات والبرامج', nameEn: 'Transportation & Sightseeing Cost', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 4, isParent: false, parentCode: '332' },
      { code: '333', nameAr: 'تكلفة التأشيرات والفيز', nameEn: 'Visa Processing Cost', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 3, isParent: true, parentCode: '33' },
      { code: '3331', nameAr: 'تكلفة إصدار التأشيرات والفيز', nameEn: 'Visa Issuance Cost', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 4, isParent: false, parentCode: '333' },
      { code: '37', nameAr: 'المصروفات الإدارية والعمومية', nameEn: 'General & Admin Expenses', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 2, isParent: true, parentCode: '3' },

      { code: '4', nameAr: 'الموارد (الإيرادات)', nameEn: 'Revenues', type: AccountType.REVENUE, category: AccountCategory.GENERAL, level: 1, isParent: true, parentCode: null },
      { code: '41', nameAr: 'إيرادات النشاط السياحي والسفر', nameEn: 'Tourism Activity Revenues', type: AccountType.REVENUE, category: AccountCategory.GENERAL, level: 2, isParent: true, parentCode: '4' },
      { code: '411', nameAr: 'إيرادات مبيعات تذاكر الطيران', nameEn: 'Flight Ticket Sales Revenue', type: AccountType.REVENUE, category: AccountCategory.GENERAL, level: 3, isParent: true, parentCode: '41' },
      { code: '4111', nameAr: 'إيرادات تذاكر الأفراد', nameEn: 'Individual Ticket Sales', type: AccountType.REVENUE, category: AccountCategory.GENERAL, level: 4, isParent: false, parentCode: '411' },
      { code: '4112', nameAr: 'إيرادات تذاكر الشركات B2B', nameEn: 'Corporate Ticket Sales', type: AccountType.REVENUE, category: AccountCategory.GENERAL, level: 4, isParent: false, parentCode: '411' },
      { code: '412', nameAr: 'إيرادات البرامج الفندقية والقروبات', nameEn: 'Hotels & Packages Revenue', type: AccountType.REVENUE, category: AccountCategory.GENERAL, level: 3, isParent: true, parentCode: '41' },
      { code: '4122', nameAr: 'إيرادات الرحلات والبرامج السياحية الكاملة', nameEn: 'Tour Packages Revenue', type: AccountType.REVENUE, category: AccountCategory.GENERAL, level: 4, isParent: false, parentCode: '412' },
      { code: '413', nameAr: 'إيرادات الفيز والتأشيرات', nameEn: 'Visa Revenue', type: AccountType.REVENUE, category: AccountCategory.GENERAL, level: 3, isParent: true, parentCode: '41' },
      { code: '4131', nameAr: 'إيرادات إصدار الفيز والتأشيرات', nameEn: 'Visa Issuance Revenue', type: AccountType.REVENUE, category: AccountCategory.GENERAL, level: 4, isParent: false, parentCode: '413' },
      { code: '414', nameAr: 'العمولات والأرباح التحويلية', nameEn: 'Commissions & Incentives', type: AccountType.REVENUE, category: AccountCategory.GENERAL, level: 3, isParent: true, parentCode: '41' },
      { code: '4141', nameAr: 'عمولات ومكافآت شركات الطيران', nameEn: 'Airline Commission & Bonus', type: AccountType.REVENUE, category: AccountCategory.GENERAL, level: 4, isParent: false, parentCode: '414' },
      { code: '4142', nameAr: 'أرباح فروقات العملة والتداولات', nameEn: 'FX Exchange Revenue', type: AccountType.REVENUE, category: AccountCategory.GENERAL, level: 4, isParent: false, parentCode: '414' },
    ];

    const codeToIdMap = new Map<string, string>();

    for (const acc of defaults) {
      const parentId = acc.parentCode ? codeToIdMap.get(acc.parentCode) : null;
      
      const existing = await this.prisma.account.findUnique({
        where: { companyId_code: { companyId: targetCompanyId, code: acc.code } },
      });

      let accId: string;
      if (existing) {
        const updated = await this.prisma.account.update({
          where: { id: existing.id },
          data: {
            nameAr: acc.nameAr,
            nameEn: acc.nameEn,
            type: acc.type,
            category: acc.category,
            level: acc.level,
            isParent: acc.isParent,
            parentId,
          },
        });
        accId = updated.id;
      } else {
        const created = await this.prisma.account.create({
          data: {
            code: acc.code,
            nameAr: acc.nameAr,
            nameEn: acc.nameEn,
            type: acc.type,
            category: acc.category,
            level: acc.level,
            isParent: acc.isParent,
            parentId,
            companyId: targetCompanyId,
            currency: this.resolveAccountCurrency(),
          },
        });
        accId = created.id;
      }

      codeToIdMap.set(acc.code, accId);
    }

    // Seeded now, so later requests skip the two-query guard entirely.
    this.seededCompanies.add(companyId);
    this.seededCompanies.add(targetCompanyId);
  }

  async getTree(companyId: string, lite = false) {
    const cacheKey = lite ? `${companyId}:lite` : `${companyId}:full`;
    return this.treeCache.wrap(cacheKey, () => this.getTreeUncached(companyId, lite));
  }

  private async getTreeUncached(companyId: string, lite = false) {
    let accounts = await this.prisma.account.findMany({
      where: { companyId },
      orderBy: { code: 'asc' },
    });

    if (accounts.length === 0) {
      await this.ensureDefaultAccounts(companyId);
      accounts = await this.prisma.account.findMany({
        where: { companyId },
        orderBy: { code: 'asc' },
      });
    }

    type TotalsRow = {
      accountId: string;
      currency: string;
      debit: Prisma.Decimal | number | null;
      credit: Prisma.Decimal | number | null;
    };
    type OpeningRow = {
      accountId: string;
      reference: string | null;
      description: string | null;
      date: Date;
      debit: Prisma.Decimal | number | null;
      credit: Prisma.Decimal | number | null;
    };

    let journalLineTotals: TotalsRow[] = [];
    let openingRows: OpeningRow[] = [];

    if (!lite) {
      [journalLineTotals, openingRows] = await Promise.all([
        this.prisma.$queryRaw<TotalsRow[]>(Prisma.sql`
          SELECT
            l."accountId" AS "accountId",
            CASE
              WHEN e.reference LIKE 'OPENING-USD-%' THEN 'USD'
              WHEN l.description ILIKE '%USD%' OR e.reference ILIKE '%USD%' THEN 'USD'
              ELSE 'IQD'
            END AS currency,
            SUM(l.debit) AS debit,
            SUM(l.credit) AS credit
          FROM journal_entry_lines l
          INNER JOIN journal_entries e ON e.id = l."journalEntryId"
          WHERE e."companyId" = ${companyId}
            AND e.status = 'POSTED'
          GROUP BY 1, 2
        `),
        this.prisma.$queryRaw<OpeningRow[]>(Prisma.sql`
          SELECT
            l."accountId" AS "accountId",
            e.reference,
            e.description,
            e.date,
            l.debit,
            l.credit
          FROM journal_entries e
          INNER JOIN journal_entry_lines l ON l."journalEntryId" = e.id
          WHERE e.status = 'POSTED'
            AND (e."companyId" = ${companyId} OR e."companyId" = 'default-company-id')
            AND (
              e.reference LIKE 'OPENING-%'
              OR e.reference LIKE 'OPEN-%'
              OR e.description LIKE '%رصيد افتتاحي%'
            )
        `),
      ]);
    }

    const openingMap = new Map<string, { amountIQD: number; amountUSD: number; nature: string; date: any; notes: string }>();
    openingRows.forEach((l) => {
      const entryText = `${l.reference || ''} ${l.description || ''}`.toUpperCase();
      const isEntryUSD = entryText.includes('USD') || entryText.includes('$') || (l.reference || '').startsWith('OPENING-USD-');
      const code = (l.reference || '').replace('OPENING-USD-', '').replace('OPENING-IQD-', '').replace('OPENING-', '').replace('OPEN-', '');
      if (!l.accountId) return;
      const isUSD = isEntryUSD;
      const isDeb = Number(l.debit || 0) > 0;
      const amt = isDeb ? Number(l.debit || 0) : Number(l.credit || 0);
      let data = openingMap.get(l.accountId);
      if (!data) {
        data = {
          amountIQD: 0,
          amountUSD: 0,
          nature: isDeb ? 'DEBIT' : 'CREDIT',
          date: l.date,
          notes: l.description || '',
        };
        openingMap.set(l.accountId, data);
        if (code) openingMap.set(code, data);
      }
      if (isUSD) {
        data.amountUSD = amt;
      } else {
        data.amountIQD = amt;
      }
      data.nature = isDeb ? 'DEBIT' : 'CREDIT';
    });

    const totalsByAccId = new Map<string, { debitIQD: number; creditIQD: number; debitUSD: number; creditUSD: number }>();
    const getOrInitTotals = (id: string) => {
      let t = totalsByAccId.get(id);
      if (!t) {
        t = { debitIQD: 0, creditIQD: 0, debitUSD: 0, creditUSD: 0 };
        totalsByAccId.set(id, t);
      }
      return t;
    };

    // A) Journal Lines - already grouped by database to avoid loading every ledger line.
    journalLineTotals.forEach((l) => {
      if (!l.accountId) return;
      const t = getOrInitTotals(l.accountId);
      if (l.currency === 'USD') {
        t.debitUSD += Number(l.debit || 0);
        t.creditUSD += Number(l.credit || 0);
      } else {
        t.debitIQD += Number(l.debit || 0);
        t.creditIQD += Number(l.credit || 0);
      }
    });

    const accountDataMap = new Map<string, any>();

    accounts.forEach((acc) => {
      const totals = totalsByAccId.get(acc.id) || { debitIQD: 0, creditIQD: 0, debitUSD: 0, creditUSD: 0 };
      const isDebitNature = acc.type === AccountType.ASSET || acc.type === AccountType.EXPENSE;
      const op = openingMap.get(acc.id) || openingMap.get(acc.code);
      let openingAmountIQD = op?.amountIQD || 0;
      let openingAmountUSD = op?.amountUSD || 0;

      if (acc.address && acc.address.startsWith('{')) {
        try {
          const parsed = JSON.parse(acc.address);
          if (parsed.usd && !openingAmountUSD) {
            openingAmountUSD = Number(parsed.usd || 0);
          }
          if (parsed.iqd && !openingAmountIQD) {
            openingAmountIQD = Number(parsed.iqd || 0);
          }
        } catch (e) {}
      }

      const openingBalance = (op?.nature === 'CREDIT' ? -openingAmountIQD : openingAmountIQD);
      const effDebitUSD = totals.debitUSD + (totals.debitUSD === 0 && totals.creditUSD === 0 && openingAmountUSD > 0 ? openingAmountUSD : 0);
      const effDebitIQD = totals.debitIQD + (totals.debitIQD === 0 && totals.creditIQD === 0 && openingAmountIQD > 0 ? openingAmountIQD : 0);

      const isCustActive = acc.category === AccountCategory.CUSTOMER;
      const isSuppActive = acc.category === AccountCategory.SUPPLIER;

      let derivedRole: 'CUSTOMER' | 'SUPPLIER' | 'BOTH' | 'GENERAL' = 'GENERAL';
      if (isCustActive && isSuppActive) {
        derivedRole = 'BOTH';
      } else if (isCustActive || acc.category === AccountCategory.CUSTOMER) {
        derivedRole = 'CUSTOMER';
      } else if (isSuppActive || acc.category === AccountCategory.SUPPLIER) {
        derivedRole = 'SUPPLIER';
      }

      const isAccountBlocked = Boolean(
        acc.overduePolicy === 'BLOCK' && (acc as any).paymentMode === 'BLOCKED'
      );

      accountDataMap.set(acc.id, {
        id: acc.id,
        code: acc.code,
        nameAr: acc.nameAr,
        nameEn: acc.nameEn,
        type: acc.type,
        category: acc.category,
        accountRole: derivedRole,
        isBlocked: isAccountBlocked,
        isParent: acc.isParent,
        isGroup: acc.isParent,
        nature: isDebitNature ? 'DEBIT' : 'CREDIT',
        parentId: acc.parentId,
        level: acc.level,
        isSystem: acc.isSystem,
        currency: this.resolveAccountCurrency(acc.currency),
        branchScope: acc.branchScope,
        branchIds: acc.branchIds,
        phone: acc.phone,
        email: acc.email,
        address: acc.address,
        contactPerson: acc.contactPerson,
        creditLimit: acc.creditLimit,
        creditLimitUSD: acc.creditLimitUSD,
        paymentDays: (acc as any).paymentDays || null,
        paymentMode: (acc as any).paymentMode || null,
        overduePolicy: (acc as any).overduePolicy || null,
        openingAmountIQD,
        openingAmountUSD,
        openingBalance,
        openingNature: op?.nature || 'BOTH',
        openingDate: op?.date || null,
        openingNotes: op?.notes || '',
        debitIQD: effDebitIQD,
        creditIQD: totals.creditIQD,
        balanceIQD: effDebitIQD - totals.creditIQD,
        debitUSD: effDebitUSD,
        creditUSD: totals.creditUSD,
        balanceUSD: effDebitUSD - totals.creditUSD,
        debit: effDebitIQD,
        credit: totals.creditIQD,
        balance: effDebitIQD - totals.creditIQD,
        children: [],
      });
    });

    const tree: any[] = [];
    accounts.forEach((acc) => {
      const item = accountDataMap.get(acc.id);
      if (acc.parentId && accountDataMap.has(acc.parentId)) {
        accountDataMap.get(acc.parentId).children.push(item);
      } else {
        tree.push(item);
      }
    });

    // Aggregate child balances up the tree recursively for BOTH currencies
    function aggregateNode(node: any) {
      let totalDebitIQD = node.debitIQD;
      let totalCreditIQD = node.creditIQD;
      let totalDebitUSD = node.debitUSD;
      let totalCreditUSD = node.creditUSD;

      if (node.children && node.children.length > 0) {
        node.children.forEach((child: any) => {
          const childTotals = aggregateNode(child);
          totalDebitIQD += childTotals.debitIQD;
          totalCreditIQD += childTotals.creditIQD;
          totalDebitUSD += childTotals.debitUSD;
          totalCreditUSD += childTotals.creditUSD;
        });
      }

      node.debitIQD = totalDebitIQD;
      node.creditIQD = totalCreditIQD;
      node.balanceIQD = totalDebitIQD - totalCreditIQD;

      node.debitUSD = totalDebitUSD;
      node.creditUSD = totalCreditUSD;
      node.balanceUSD = totalDebitUSD - totalCreditUSD;

      node.debit = totalDebitIQD;
      node.credit = totalCreditIQD;
      node.balance = totalDebitIQD - totalCreditIQD;

      return {
        debitIQD: totalDebitIQD,
        creditIQD: totalCreditIQD,
        debitUSD: totalDebitUSD,
        creditUSD: totalCreditUSD,
      };
    }

    tree.forEach(aggregateNode);
    return tree;
  }

  async findAll(
    companyId: string,
    type?: AccountType,
    category?: AccountCategory,
    includeTrend = false,
    lite = false,
  ) {
    const cacheKey = `${companyId}:${type || ''}:${category || ''}:${includeTrend}:${lite ? 'lite' : 'full'}`;
    const cached = this.flatCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    await this.ensureDefaultAccounts(companyId);

    if (lite) {
      const liteAccounts = await this.prisma.account.findMany({
        where: {
          companyId,
          ...(type ? { type } : {}),
          ...(category ? { category } : {}),
        },
        select: {
          id: true,
          code: true,
          nameAr: true,
          nameEn: true,
          type: true,
          category: true,
          parentId: true,
          isParent: true,
        },
        orderBy: { code: 'asc' },
      });
      this.flatCache.set(cacheKey, { data: liteAccounts, timestamp: Date.now() });
      return liteAccounts;
    }

    const [accounts, jlMap, openingEntries] = await Promise.all([
      this.prisma.account.findMany({
        where: {
          companyId,
          ...(type ? { type } : {}),
          ...(category ? { category } : {}),
        },
        orderBy: { code: 'asc' },
        include: {
          parent: {
            select: { id: true, code: true, nameAr: true },
          },
        },
      }),
      // Summed by Postgres instead of by loading every posted line into Node.
      this.computeLineTotalsAggregated(companyId),
      this.prisma.journalEntry.findMany({
        where: {
          companyId,
          AND: [
            {
              OR: [
                { reference: { startsWith: 'OPENING-' } },
                { reference: { startsWith: 'OPEN-' } },
                { description: { contains: 'رصيد افتتاحي' } },
              ],
            },
          ],
          status: 'POSTED',
        },
        include: { lines: true },
      }),
    ]);

    // 1. Index Opening Entries
    const openingMap = new Map<string, { amountIQD: number; amountUSD: number; nature: string; date: any; notes: string }>();
    openingEntries.forEach((e) => {
      const entryText = `${e.reference || ''} ${e.description || ''}`.toUpperCase();
      const isEntryUSD = entryText.includes('USD') || entryText.includes('$') || (e.reference || '').startsWith('OPENING-USD-');
      const code = (e.reference || '').replace('OPENING-USD-', '').replace('OPENING-IQD-', '').replace('OPENING-', '').replace('OPEN-', '');
      e.lines.forEach((l) => {
        if (l.accountId) {
          const lineText = `${l.description || ''} ${entryText}`.toUpperCase();
          const isUSD = isEntryUSD || lineText.includes('USD') || lineText.includes('$');
          const isDeb = Number(l.debit || 0) > 0;
          const amt = isDeb ? Number(l.debit || 0) : Number(l.credit || 0);
          let data = openingMap.get(l.accountId);
          if (!data) {
            data = {
              amountIQD: 0,
              amountUSD: 0,
              nature: isDeb ? 'DEBIT' : 'CREDIT',
              date: e.date,
              notes: e.description,
            };
            openingMap.set(l.accountId, data);
            if (code) openingMap.set(code, data);
          }
          if (isUSD) {
            data.amountUSD = amt;
          } else {
            data.amountIQD = amt;
          }
          data.nature = isDeb ? 'DEBIT' : 'CREDIT';
        }
      });
    });

    // 2. Journal-line totals already arrive keyed by accountId.
    const result = accounts.map((acc) => {
      const jl = jlMap.get(acc.id) || { debitUSD: 0, creditUSD: 0, debitIQD: 0, creditIQD: 0 };

      let debitIQD = jl.debitIQD;
      let creditIQD = jl.creditIQD;
      let debitUSD = jl.debitUSD;
      let creditUSD = jl.creditUSD;

      const op = openingMap.get(acc.id) || openingMap.get(acc.code);
      const openingAmountIQD = op?.amountIQD || 0;
      const openingAmountUSD = op?.amountUSD || 0;
      const openingBalance = (op?.nature === 'CREDIT' ? -openingAmountIQD : openingAmountIQD);

      return {
        ...acc,
        openingAmountIQD,
        openingAmountUSD,
        openingBalance,
        openingNature: op?.nature || 'BOTH',
        openingDate: op?.date || null,
        openingNotes: op?.notes || '',
        debitIQD,
        creditIQD,
        balanceIQD: debitIQD - creditIQD,
        debitUSD,
        creditUSD,
        balanceUSD: debitUSD - creditUSD,
        debit: debitIQD,
        credit: creditIQD,
        balance: debitIQD - creditIQD,
        trendData: [],
      };
    });

    this.flatCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  }

  private compute7DayTrend(
    acc: any,
    tickets: any[],
    journalLines: any[],
    receipts: any[],
    payments: any[],
  ) {
    const daysOfWeekAr = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
    const accNameNorm = acc.nameAr ? acc.nameAr.trim().toLowerCase() : '';
    const now = new Date();
    const points: { day: string; dateStr: string; val: number }[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayName = daysOfWeekAr[d.getDay()];
      const endOfDayStr = d.toISOString().split('T')[0] + 'T23:59:59.999Z';
      const endOfDay = new Date(endOfDayStr);

      let debitIQD = 0, creditIQD = 0;
      let debitUSD = 0, creditUSD = 0;

      // 1. Journal Lines up to endOfDay
      journalLines.forEach((l) => {
        if (l.accountId !== acc.id) return;
        const lDate = new Date(l.journalEntry?.date || l.createdAt || 0);
        if (lDate <= endOfDay) {
          const isUSD = (l.journalEntry?.currency || '').toUpperCase().includes('USD');
          if (isUSD) {
            debitUSD += Number(l.debit || 0);
            creditUSD += Number(l.credit || 0);
          } else {
            debitIQD += Number(l.debit || 0);
            creditIQD += Number(l.credit || 0);
          }
        }
      });

      // 2. Tickets up to endOfDay
      tickets.forEach((t) => {
        const tDate = new Date(t.issueDate || t.createdAt || 0);
        if (tDate <= endOfDay) {
          const isUSD = (t.currency || '').toUpperCase().includes('USD') || (t.currency || '').includes('$');
          const custNorm = (t.customerName || '').trim().toLowerCase();
          const isCash = t.paymentType === 'DEBIT' || t.paymentType === 'نقدي' || !t.paymentType;
          const totalSell = Number(t.netSell || t.totalSell || 0);
          const totalBuy = Number(t.netBuy || t.totalBuy || 0);

          // Customer Account:
          if (
            !isCash &&
            (t.customerAccountId === acc.id ||
              (custNorm &&
                (custNorm === accNameNorm ||
                  custNorm.includes(accNameNorm) ||
                  accNameNorm.includes(custNorm))))
          ) {
            if (isUSD) {
              debitUSD += totalSell;
              if (isCash) creditUSD += totalSell;
            } else {
              debitIQD += totalSell;
              if (isCash) creditIQD += totalSell;
            }
          }

          // Cashbox / Master / Payment Method Account:
          if (isCash) {
            const effectiveCb = (t.paymentMethod && t.paymentMethod.trim() && t.paymentMethod.trim() !== 'CASH_HAND')
              ? t.paymentMethod.trim()
              : (t.receivingCashbox && t.receivingCashbox.trim())
              ? t.receivingCashbox.trim()
              : (t.cashbox && t.cashbox.trim())
              ? t.cashbox.trim()
              : null;

            if (t.cashboxAccountId || effectiveCb) {
              const cbClean = (effectiveCb || '').toLowerCase();
              const isMatch = t.cashboxAccountId === acc.id ||
                acc.id === effectiveCb ||
                acc.code === effectiveCb ||
                (accNameNorm && (
                  accNameNorm === cbClean ||
                  accNameNorm.includes(cbClean) ||
                  cbClean.includes(accNameNorm)
                ));

              if (isMatch) {
                if (isUSD) debitUSD += totalSell;
                else debitIQD += totalSell;
              }
            }
          }

          // Supplier Account:
          const suppNorm = (t.supplierAccountName || '').trim().toLowerCase();
          if (
            t.supplierAccountId === acc.id ||
            t.supplierAccount === acc.id ||
            (suppNorm &&
              (suppNorm === accNameNorm ||
                suppNorm.includes(accNameNorm) ||
                accNameNorm.includes(suppNorm)))
          ) {
            if (isUSD) creditUSD += totalBuy;
            else creditIQD += totalBuy;
          }
        }
      });

      // 3. Receipt Vouchers up to endOfDay
      receipts.forEach((r) => {
        const rDate = new Date(r.voucherDate || r.createdAt || 0);
        if (rDate <= endOfDay) {
          if (r.accountId === acc.id) creditIQD += Number(r.amount || 0);
          if (r.cashboxOrBankAccountId === acc.id) debitIQD += Number(r.amount || 0);
        }
      });

      // 4. Payment Vouchers up to endOfDay
      payments.forEach((p) => {
        const pDate = new Date(p.voucherDate || p.createdAt || 0);
        if (pDate <= endOfDay) {
          if (p.accountId === acc.id) debitIQD += Number(p.amount || 0);
          if (p.cashboxOrBankAccountId === acc.id) creditIQD += Number(p.amount || 0);
        }
      });

      const isUSD = (acc.currency || '').toUpperCase().includes('USD');
      const bal = isUSD ? (debitUSD - creditUSD) : (debitIQD - creditIQD);

      points.push({
        day: dayName,
        dateStr: d.toISOString().split('T')[0],
        val: Math.max(0, bal),
      });
    }

    return points;
  }

  async findOne(id: string, companyId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id, companyId },
      include: {
        parent: true,
        children: true,
        customer: true,
        supplier: true,
      },
    });
    if (!account) throw new NotFoundException('الحساب المحاسبي غير موجود');

    const opEntries = await this.prisma.journalEntry.findMany({
      where: {
        companyId,
        reference: {
          in: [
            `OPENING-${account.code}`,
            `OPENING-IQD-${account.code}`,
            `OPENING-USD-${account.code}`,
          ],
        },
        status: 'POSTED',
      },
      include: { lines: true },
    });

    let openingAmountIQD = 0;
    let openingAmountUSD = 0;
    let openingNature = 'BOTH';
    let openingDate: any = null;
    let openingNotes = '';

    opEntries.forEach((opEntry) => {
      const isUSD = opEntry.reference?.startsWith('OPENING-USD-') || (opEntry.description && opEntry.description.includes('(USD)'));
      const line = opEntry.lines.find((l) => l.accountId === account.id);
      if (line) {
        const isDeb = Number(line.debit || 0) > 0;
        const amt = isDeb ? Number(line.debit || 0) : Number(line.credit || 0);
        if (isUSD) {
          openingAmountUSD = amt;
        } else {
          openingAmountIQD = amt;
        }
        openingNature = isDeb ? 'DEBIT' : 'CREDIT';
        openingDate = opEntry.date;
        openingNotes = opEntry.description.replace(' (USD)', '');
      }
    });

    const isCustActive = Boolean((account as any).customer && (account as any).customer.isActive !== false);
    const isSuppActive = Boolean((account as any).supplier && (account as any).supplier.isActive !== false);

    let derivedRole: 'CUSTOMER' | 'SUPPLIER' | 'BOTH' | 'GENERAL' = 'GENERAL';
    if (isCustActive && isSuppActive) {
      derivedRole = 'BOTH';
    } else if (isCustActive || account.category === AccountCategory.CUSTOMER) {
      derivedRole = 'CUSTOMER';
    } else if (isSuppActive || account.category === AccountCategory.SUPPLIER) {
      derivedRole = 'SUPPLIER';
    }

    const isAccountBlocked = Boolean(
      account.overduePolicy === 'BLOCK' && (account as any).paymentMode === 'BLOCKED' ||
      ((account as any).customer && !(account as any).customer.isActive && !isSuppActive) ||
      ((account as any).supplier && !(account as any).supplier.isActive && !isCustActive)
    );

    return {
      ...account,
      currency: this.resolveAccountCurrency(account.currency),
      accountRole: derivedRole,
      isBlocked: isAccountBlocked,
      openingAmountIQD,
      openingAmountUSD,
      openingBalance: openingNature === 'CREDIT' ? -openingAmountIQD : openingAmountIQD,
      openingNature,
      openingDate,
      openingNotes,
    };
  }

  async create(companyId: string, dto: CreateAccountDto) {
    await this.validateOpeningBalanceInput(companyId, dto);

    const existing = await this.prisma.account.findUnique({
      where: { companyId_code: { companyId, code: dto.code } },
    });
    if (existing) {
      throw new BadRequestException(`رمز الحساب (${dto.code}) مستخدم بالفعل`);
    }

    let level = 1;

    if (dto.parentId) {
      const parent = await this.prisma.account.findFirst({
        where: { id: dto.parentId, companyId },
      });
      if (!parent) throw new BadRequestException('الحساب الأب غير موجود');
      level = parent.level + 1;

      await this.prisma.account.update({
        where: { id: parent.id },
        data: { isParent: true },
      });
    }

    const effectiveCategory = dto.accountRole === 'CUSTOMER' ? AccountCategory.CUSTOMER
      : dto.accountRole === 'SUPPLIER' ? AccountCategory.SUPPLIER
      : dto.category || AccountCategory.GENERAL;
    const effectiveOverduePolicy = dto.isBlocked ? 'BLOCK' : dto.overduePolicy || 'BLOCK';

    const account = await this.prisma.account.create({
      data: {
        code: dto.code,
        nameAr: dto.nameAr,
        nameEn: dto.nameEn || dto.nameAr,
        type: dto.type,
        category: effectiveCategory,
        isParent: false,
        parentId: dto.parentId || null,
        level,
        companyId,
        currency: this.resolveAccountCurrency(dto.currency),
        branchScope: dto.branchScope || 'ALL_BRANCHES',
        branchIds: dto.branchIds || [],
        phone: dto.phone || null,
        email: dto.email || null,
        address: dto.address || null,
        contactPerson: dto.contactPerson || null,
        creditLimit: dto.creditLimit !== undefined && dto.creditLimit !== null ? Number(dto.creditLimit) : null,
        creditLimitUSD: dto.creditLimitUSD !== undefined && dto.creditLimitUSD !== null ? Number(dto.creditLimitUSD) : null,
        paymentDays: dto.paymentDays !== undefined && dto.paymentDays !== null ? Number(dto.paymentDays) : null,
        paymentMode: dto.paymentMode || 'CASH_ONLY',
        overduePolicy: effectiveOverduePolicy,
      },
    });

    await this.syncCustomerSupplierRole(companyId, account, dto.accountRole, dto.isBlocked);

    if (dto.openingAmountIQD !== undefined || dto.openingAmountUSD !== undefined) {
      await this.processOpeningBalance(companyId, account, {
        openingAmountIQD: dto.openingAmountIQD,
        openingAmountUSD: dto.openingAmountUSD,
        openingNature: dto.openingNature,
        openingDate: dto.openingDate,
        openingNotes: dto.openingNotes,
      });
    }

    this.invalidateCache(companyId);
    return account;
  }

  async update(id: string, companyId: string, dto: UpdateAccountDto) {
    await this.validateOpeningBalanceInput(companyId, dto);

    const account = await this.prisma.account.findFirst({
      where: { id, companyId },
    });
    if (!account) throw new NotFoundException('الحساب المحاسبي غير موجود');

    if (dto.code && dto.code !== account.code) {
      const existing = await this.prisma.account.findUnique({
        where: { companyId_code: { companyId, code: dto.code } },
      });
      if (existing) {
        throw new BadRequestException(`رمز الحساب (${dto.code}) مستخدم بالفعل`);
      }
    }

    let level = account.level;
    let newParentId = account.parentId;

    if (dto.parentId !== undefined && dto.parentId !== account.parentId) {
      if (dto.parentId) {
        const parent = await this.prisma.account.findFirst({
          where: { id: dto.parentId, companyId },
        });
        if (!parent) throw new BadRequestException('الحساب الأب المحدد غير موجود');
        level = parent.level + 1;
        newParentId = parent.id;

        await this.prisma.account.update({
          where: { id: parent.id },
          data: { isParent: true },
        });
      } else {
        level = 1;
        newParentId = null;
      }

      if (account.parentId) {
        const siblingsCount = await this.prisma.account.count({
          where: { parentId: account.parentId, NOT: { id } },
        });
        if (siblingsCount === 0) {
          await this.prisma.account.update({
            where: { id: account.parentId },
            data: { isParent: false },
          });
        }
      }
    }

    const effectiveCategory = dto.accountRole === 'CUSTOMER' ? AccountCategory.CUSTOMER
      : dto.accountRole === 'SUPPLIER' ? AccountCategory.SUPPLIER
      : dto.category !== undefined ? dto.category : undefined;
    const effectiveOverduePolicy = dto.isBlocked ? 'BLOCK' : dto.overduePolicy !== undefined ? dto.overduePolicy : undefined;

    const updatedAccount = await this.prisma.account.update({
      where: { id },
      data: {
        ...(dto.code ? { code: dto.code } : {}),
        ...(dto.nameAr ? { nameAr: dto.nameAr } : {}),
        ...(dto.nameEn !== undefined ? { nameEn: dto.nameEn } : {}),
        ...(dto.type ? { type: dto.type } : {}),
        ...(effectiveCategory ? { category: effectiveCategory } : {}),
        currency: this.resolveAccountCurrency(dto.currency),
        ...(dto.branchScope ? { branchScope: dto.branchScope } : {}),
        ...(dto.branchIds ? { branchIds: dto.branchIds } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.contactPerson !== undefined ? { contactPerson: dto.contactPerson } : {}),
        ...(dto.creditLimit !== undefined ? { creditLimit: dto.creditLimit !== null && dto.creditLimit !== undefined ? Number(dto.creditLimit) : null } : {}),
        ...(dto.creditLimitUSD !== undefined ? { creditLimitUSD: dto.creditLimitUSD !== null && dto.creditLimitUSD !== undefined ? Number(dto.creditLimitUSD) : null } : {}),
        ...(dto.paymentDays !== undefined ? { paymentDays: dto.paymentDays !== null && dto.paymentDays !== undefined ? Number(dto.paymentDays) : null } : {}),
        ...(dto.paymentMode !== undefined ? { paymentMode: dto.paymentMode } : {}),
        ...(effectiveOverduePolicy !== undefined ? { overduePolicy: effectiveOverduePolicy } : {}),
        level,
        parentId: newParentId,
      },
    });

    await this.syncCustomerSupplierRole(companyId, updatedAccount, dto.accountRole, dto.isBlocked);

    if (dto.openingAmountIQD !== undefined || dto.openingAmountUSD !== undefined) {
      await this.processOpeningBalance(companyId, updatedAccount, {
        openingAmountIQD: dto.openingAmountIQD,
        openingAmountUSD: dto.openingAmountUSD,
        openingNature: dto.openingNature,
        openingDate: dto.openingDate,
        openingNotes: dto.openingNotes,
      });
    }

    this.invalidateCache(companyId);
    return updatedAccount;
  }

  private async syncCustomerSupplierRole(
    companyId: string,
    account: { id: string; code: string; nameAr: string; nameEn?: string | null; phone?: string | null; email?: string | null; address?: string | null },
    role?: string,
    isBlocked?: boolean
  ) {
    if (!role && isBlocked === undefined) return;

    const shouldBeCustomer = role === 'CUSTOMER' || role === 'BOTH';
    const shouldBeSupplier = role === 'SUPPLIER' || role === 'BOTH';
    const activeStatus = isBlocked ? false : true;

    // 1. Handle Customer record
    if (shouldBeCustomer) {
      const existingCust = await this.prisma.customer.findFirst({
        where: { accountId: account.id, companyId },
      });
      if (existingCust) {
        await this.prisma.customer.update({
          where: { id: existingCust.id },
          data: {
            nameAr: account.nameAr,
            nameEn: account.nameEn || account.nameAr,
            isActive: activeStatus,
          },
        });
      } else {
        await this.prisma.customer.create({
          data: {
            code: account.code,
            nameAr: account.nameAr,
            nameEn: account.nameEn || account.nameAr,
            phone: account.phone || null,
            email: account.email || null,
            address: account.address || null,
            accountId: account.id,
            companyId,
            isActive: activeStatus,
          },
        });
      }
    } else if (role === 'SUPPLIER' || role === 'GENERAL') {
      await this.prisma.customer.updateMany({
        where: { accountId: account.id, companyId },
        data: { isActive: false },
      });
    }

    // 2. Handle Supplier record
    if (shouldBeSupplier) {
      const existingSupp = await this.prisma.supplier.findFirst({
        where: { accountId: account.id, companyId },
      });
      if (existingSupp) {
        await this.prisma.supplier.update({
          where: { id: existingSupp.id },
          data: {
            nameAr: account.nameAr,
            nameEn: account.nameEn || account.nameAr,
            isActive: activeStatus,
          },
        });
      } else {
        await this.prisma.supplier.create({
          data: {
            code: account.code,
            nameAr: account.nameAr,
            nameEn: account.nameEn || account.nameAr,
            phone: account.phone || null,
            email: account.email || null,
            address: account.address || null,
            accountId: account.id,
            companyId,
            isActive: activeStatus,
          },
        });
      }
    } else if (role === 'CUSTOMER' || role === 'GENERAL') {
      await this.prisma.supplier.updateMany({
        where: { accountId: account.id, companyId },
        data: { isActive: false },
      });
    }

    // If explicitly blocked
    if (isBlocked) {
      await this.prisma.customer.updateMany({
        where: { accountId: account.id, companyId },
        data: { isActive: false },
      });
      await this.prisma.supplier.updateMany({
        where: { accountId: account.id, companyId },
        data: { isActive: false },
      });
    }
  }

  private async validateOpeningBalanceInput(
    companyId: string,
    dto: Pick<CreateAccountDto, 'openingAmountIQD' | 'openingAmountUSD' | 'openingDate'>,
  ) {
    if (dto.openingAmountIQD === undefined && dto.openingAmountUSD === undefined) return;

    const amountIQD = Number(dto.openingAmountIQD || 0);
    const amountUSD = Number(dto.openingAmountUSD || 0);
    if (!Number.isFinite(amountIQD) || !Number.isFinite(amountUSD) || amountIQD < 0 || amountUSD < 0) {
      throw new BadRequestException('مبالغ الرصيد الافتتاحي يجب أن تكون أرقاماً غير سالبة');
    }

    if (amountIQD === 0 && amountUSD === 0) return;
    if (!dto.openingDate || Number.isNaN(new Date(dto.openingDate).getTime())) {
      throw new BadRequestException('تاريخ صحيح مطلوب عند إدخال رصيد افتتاحي');
    }

    const balancingAccount = await this.prisma.account.findFirst({
      where: {
        companyId,
        OR: [{ code: '264' }, { code: '2611' }, { code: '261' }, { code: '211' }, { code: '212' }],
      },
      select: { id: true },
    });
    if (!balancingAccount) {
      throw new BadRequestException('لا يمكن ترحيل الرصيد الافتتاحي قبل إعداد حساب موازنة الأرصدة الافتتاحية');
    }
  }

  private async processOpeningBalance(
    companyId: string,
    account: any,
    dto: {
      openingAmountIQD?: number;
      openingAmountUSD?: number;
      openingNature?: string;
      openingDate?: string;
      openingNotes?: string;
    },
  ) {
    const amountIQD = Number(dto.openingAmountIQD || 0);
    const amountUSD = Number(dto.openingAmountUSD || 0);
    const refIQD = `OPENING-IQD-${account.code}`;
    const refUSD = `OPENING-USD-${account.code}`;
    const legacyRef = `OPENING-${account.code}`;

    let balancingAcc = await this.prisma.account.findFirst({
      where: {
        companyId,
        OR: [{ code: '264' }, { code: '2611' }, { code: '261' }, { code: '211' }, { code: '212' }],
      },
    });

    const isDebit = dto.openingNature === 'CREDIT'
      ? false
      : dto.openingNature === 'DEBIT'
      ? true
      : (account.type === AccountType.ASSET || account.type === AccountType.EXPENSE);

    const parsedDate = dto.openingDate ? new Date(dto.openingDate) : new Date();
    const baseDesc = dto.openingNotes || `رصيد افتتاحي مدور - ${account.nameAr}`;

    const user = await this.prisma.user.findFirst({ where: { companyId } }) ||
      await this.prisma.user.findFirst();
    const createdById = user?.id || companyId;

    // 1. Find ALL existing opening entries for this account (by line accountId OR reference)
    const allExistingOpeningEntries = await this.prisma.journalEntry.findMany({
      where: {
        companyId,
        OR: [
          { reference: { in: [refIQD, refUSD, legacyRef] } },
          {
            lines: { some: { accountId: account.id } },
            reference: { startsWith: 'OPENING-' },
          },
        ],
      },
      include: { lines: true },
    });

    const existingIQDEntries = allExistingOpeningEntries.filter((e) => {
      const isUSD = e.reference?.startsWith('OPENING-USD-') || (e.description && e.description.includes('(USD)'));
      return !isUSD;
    });

    const existingUSDEntries = allExistingOpeningEntries.filter((e) => {
      const isUSD = e.reference?.startsWith('OPENING-USD-') || (e.description && e.description.includes('(USD)'));
      return isUSD;
    });

    // 2. Handle IQD Opening Balance
    if (amountIQD > 0 && balancingAcc) {
      if (existingIQDEntries.length > 0) {
        const mainEntry = existingIQDEntries[0];
        // Clean duplicates if any
        for (let i = 1; i < existingIQDEntries.length; i++) {
          await this.prisma.journalEntryLine.deleteMany({ where: { journalEntryId: existingIQDEntries[i].id } });
          await this.prisma.journalEntry.delete({ where: { id: existingIQDEntries[i].id } });
        }
        await this.prisma.journalEntryLine.deleteMany({ where: { journalEntryId: mainEntry.id } });
        await this.prisma.journalEntry.update({
          where: { id: mainEntry.id },
          data: {
            date: parsedDate,
            description: baseDesc,
            totalDebit: amountIQD,
            totalCredit: amountIQD,
            reference: refIQD,
            lines: {
              create: [
                {
                  accountId: account.id,
                  debit: isDebit ? amountIQD : 0,
                  credit: isDebit ? 0 : amountIQD,
                  description: baseDesc,
                },
                {
                  accountId: balancingAcc.id,
                  debit: isDebit ? 0 : amountIQD,
                  credit: isDebit ? amountIQD : 0,
                  description: `توازن رصيد افتتاحي - ${account.nameAr}`,
                },
              ],
            },
          },
        });
      } else {
        const entryCount = await this.prisma.journalEntry.count({ where: { companyId } });
        await this.prisma.journalEntry.create({
          data: {
            entryNumber: `OPN-IQD-${account.code}-${entryCount + 1}`,
            reference: refIQD,
            date: parsedDate,
            description: baseDesc,
            status: 'POSTED',
            companyId,
            createdById,
            totalDebit: amountIQD,
            totalCredit: amountIQD,
            lines: {
              create: [
                {
                  accountId: account.id,
                  debit: isDebit ? amountIQD : 0,
                  credit: isDebit ? 0 : amountIQD,
                  description: baseDesc,
                },
                {
                  accountId: balancingAcc.id,
                  debit: isDebit ? 0 : amountIQD,
                  credit: isDebit ? amountIQD : 0,
                  description: `توازن رصيد افتتاحي - ${account.nameAr}`,
                },
              ],
            },
          },
        });
      }
    } else {
      // Amount is 0 -> Delete all existing IQD opening entries for this account
      for (const e of existingIQDEntries) {
        await this.prisma.journalEntryLine.deleteMany({ where: { journalEntryId: e.id } });
        await this.prisma.journalEntry.delete({ where: { id: e.id } });
      }
    }

    // 3. Handle USD Opening Balance
    if (amountUSD > 0 && balancingAcc) {
      const descUSD = `${baseDesc} (USD)`;
      if (existingUSDEntries.length > 0) {
        const mainEntry = existingUSDEntries[0];
        // Clean duplicates if any
        for (let i = 1; i < existingUSDEntries.length; i++) {
          await this.prisma.journalEntryLine.deleteMany({ where: { journalEntryId: existingUSDEntries[i].id } });
          await this.prisma.journalEntry.delete({ where: { id: existingUSDEntries[i].id } });
        }
        await this.prisma.journalEntryLine.deleteMany({ where: { journalEntryId: mainEntry.id } });
        await this.prisma.journalEntry.update({
          where: { id: mainEntry.id },
          data: {
            date: parsedDate,
            description: descUSD,
            totalDebit: amountUSD,
            totalCredit: amountUSD,
            reference: refUSD,
            lines: {
              create: [
                {
                  accountId: account.id,
                  debit: isDebit ? amountUSD : 0,
                  credit: isDebit ? 0 : amountUSD,
                  description: descUSD,
                  costCenter: 'USD',
                },
                {
                  accountId: balancingAcc.id,
                  debit: isDebit ? 0 : amountUSD,
                  credit: isDebit ? amountUSD : 0,
                  description: `توازن رصيد افتتاحي - ${account.nameAr} (USD)`,
                  costCenter: 'USD',
                },
              ],
            },
          },
        });
      } else {
        const entryCount = await this.prisma.journalEntry.count({ where: { companyId } });
        await this.prisma.journalEntry.create({
          data: {
            entryNumber: `OPN-USD-${account.code}-${entryCount + 1}`,
            reference: refUSD,
            date: parsedDate,
            description: descUSD,
            status: 'POSTED',
            companyId,
            createdById,
            totalDebit: amountUSD,
            totalCredit: amountUSD,
            lines: {
              create: [
                {
                  accountId: account.id,
                  debit: isDebit ? amountUSD : 0,
                  credit: isDebit ? 0 : amountUSD,
                  description: descUSD,
                  costCenter: 'USD',
                },
                {
                  accountId: balancingAcc.id,
                  debit: isDebit ? 0 : amountUSD,
                  credit: isDebit ? amountUSD : 0,
                  description: `توازن رصيد افتتاحي - ${account.nameAr} (USD)`,
                  costCenter: 'USD',
                },
              ],
            },
          },
        });
      }
    } else {
      // Amount is 0 -> Delete all existing USD opening entries for this account
      for (const e of existingUSDEntries) {
        await this.prisma.journalEntryLine.deleteMany({ where: { journalEntryId: e.id } });
        await this.prisma.journalEntry.delete({ where: { id: e.id } });
      }
    }
  }

  async delete(id: string, companyId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id, companyId },
      include: {
        children: true,
        journalLines: {
          include: {
            journalEntry: true,
          },
        },
      },
    });

    if (!account) throw new NotFoundException('الحساب المحاسبي غير موجود');

    if (account.children.length > 0) {
      throw new BadRequestException('لا يمكن حذف حساب يحتوي على حسابات فرعية. قم بحذف الحسابات الفرعية أولاً.');
    }

    // Clean up any journal entry lines / opening entries directly tied to this account
    if (account.journalLines && account.journalLines.length > 0) {
      const entryIds = Array.from(new Set(account.journalLines.map((l) => l.journalEntryId).filter(Boolean)));
      for (const entryId of entryIds) {
        const entry = await this.prisma.journalEntry.findUnique({
          where: { id: entryId },
          include: { lines: true },
        });
        if (entry) {
          const isOpeningOrSingle =
            entry.reference?.startsWith('OPEN') ||
            entry.reference?.startsWith('OPN') ||
            entry.description?.includes('رصيد افتتاحي') ||
            entry.lines.every((l) => l.accountId === id || l.accountId === account.parentId);
          if (isOpeningOrSingle) {
            await this.prisma.journalEntryLine.deleteMany({ where: { journalEntryId: entryId } });
            await this.prisma.journalEntry.delete({ where: { id: entryId } });
          } else {
            await this.prisma.journalEntryLine.deleteMany({ where: { accountId: id, journalEntryId: entryId } });
          }
        }
      }
    }

    // Clean up any vouchers referencing this account if present
    try {
      await this.prisma.receiptVoucher.deleteMany({
        where: { OR: [{ accountId: id }, { cashboxOrBankAccountId: id }] },
      });
      await this.prisma.paymentVoucher.deleteMany({
        where: { OR: [{ accountId: id }, { cashboxOrBankAccountId: id }] },
      });
    } catch (e) {}

    const deleted = await this.prisma.account.delete({
      where: { id },
    });

    if (account.parentId) {
      const remainingSiblings = await this.prisma.account.count({
        where: { parentId: account.parentId },
      });
      if (remainingSiblings === 0) {
        await this.prisma.account.update({
          where: { id: account.parentId },
          data: { isParent: false },
        });
      }
    }

    this.invalidateCache(companyId);
    return deleted;
  }
  async wipeAll(companyId: string) {
    // Clear dependent tables
    await this.prisma.customer.deleteMany({ where: { companyId } });
    await this.prisma.supplier.deleteMany({ where: { companyId } });
    await this.prisma.ticket.deleteMany({ where: { companyId } });
    await this.prisma.receiptVoucher.deleteMany({ where: { companyId } });
    await this.prisma.paymentVoucher.deleteMany({ where: { companyId } });
    await this.prisma.journalEntryLine.deleteMany({ where: { account: { companyId } } });
    await this.prisma.journalEntry.deleteMany({ where: { companyId } });
    await this.prisma.cashbox.deleteMany({ where: { companyId } });
    await this.prisma.bank.deleteMany({ where: { companyId } });
    const deleted = await this.prisma.account.deleteMany({ where: { companyId } });
    this.invalidateCache(companyId);
    return { success: true, count: deleted.count };
  }

        async importTree(companyId: string, accountsList: any[], wipeExisting: boolean = true) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('الشركة غير موجودة');

    if (wipeExisting) {
      await this.wipeAll(companyId);
    }

    // Sort accounts by level (1 -> maxLevel)
    const sorted = [...accountsList].sort((a, b) => (Number(a.level) || 1) - (Number(b.level) || 1));
    const codeToIdMap = new Map<string, string>();

    // Pre-assign UUID for each unique code so children can reference parents
    for (const item of sorted) {
      const code = String(item.code).trim();
      if (!codeToIdMap.has(code)) {
        codeToIdMap.set(code, randomUUID());
      }
    }

    if (!wipeExisting) {
      const existing = await this.prisma.account.findMany({ where: { companyId } });
      existing.forEach((a) => codeToIdMap.set(a.code, a.id));
    }

    let inserted = 0;
    let withBalances = 0;
    const maxLevel = Math.max(...sorted.map((s) => Number(s.level) || 1), 1);

    // Insert level-by-level in bulk chunks
    for (let currentLvl = 1; currentLvl <= maxLevel; currentLvl++) {
      const levelAccounts = sorted.filter((s) => (Number(s.level) || 1) === currentLvl);
      if (levelAccounts.length === 0) continue;

      const batchData: any[] = [];
      const seenInBatch = new Set<string>();

      for (const item of levelAccounts) {
        const code = String(item.code).trim();
        if (seenInBatch.has(code)) continue;
        seenInBatch.add(code);

        const id = codeToIdMap.get(code) || randomUUID();
        const parentId = item.parentCode ? codeToIdMap.get(String(item.parentCode).trim()) || null : null;
        const nameAr = String(item.nameAr || item.name || '').trim();
        const nameEn = item.nameEn ? String(item.nameEn).trim() : null;
        const level = Number(item.level) || currentLvl;
        const isParent = Boolean(item.isParent);

        let type = (item.type in AccountType ? item.type : AccountType.ASSET) as AccountType;
        const c0 = code[0];
        if (!item.type) {
          if (c0 === '1') type = AccountType.ASSET;
          else if (c0 === '2') type = code.startsWith('21') || code.startsWith('22') ? AccountType.EQUITY : AccountType.LIABILITY;
          else if (c0 === '3') type = AccountType.EXPENSE;
          else if (c0 === '4') type = AccountType.REVENUE;
        }

        let category = (item.category in AccountCategory ? item.category : AccountCategory.GENERAL) as AccountCategory;
        if (!item.category) {
          if (code.startsWith('181') || code.startsWith('121') || nameAr.includes('صندوق') || nameAr.includes('قاصة') || nameAr.includes('بورصة')) category = AccountCategory.CASH;
          else if (code.startsWith('182') || code.startsWith('122') || nameAr.includes('مصرف') || nameAr.includes('بنك')) category = AccountCategory.BANK;
          else if (code.startsWith('161') || nameAr.includes('مدينون') || (item.parentCode && String(item.parentCode).startsWith('161'))) category = AccountCategory.CUSTOMER;
          else if (code.startsWith('261') || nameAr.includes('دائنون') || (item.parentCode && String(item.parentCode).startsWith('261'))) category = AccountCategory.SUPPLIER;
        }

        const currency = this.resolveAccountCurrency(item.currency || item.defaultCurrency);

        const openingAmountIQD = Math.abs(Number(item.openingAmountIQD || item.balanceIQD || 0));
        const openingAmountUSD = Math.abs(Number(item.openingAmountUSD || item.balanceUSD || 0));

        if (openingAmountIQD > 0 || openingAmountUSD > 0) {
          withBalances++;
        }

        batchData.push({
          id,
          code,
          nameAr,
          nameEn,
          type,
          category,
          isParent,
          level,
          parentId,
          companyId,
          tenantId: company.tenantId,
          balance: Number(openingAmountIQD || openingAmountUSD || 0),
          currency,
          isSystem: level <= 2,
          branchScope: 'ALL_BRANCHES',
          phone: item.phone ? String(item.phone) : null,
          email: item.email ? String(item.email) : null,
          address: item.address ? String(item.address) : null,
          contactPerson: item.contactPerson ? String(item.contactPerson) : null,
          creditLimit: item.creditLimit !== undefined && item.creditLimit !== null ? Number(item.creditLimit) : null,
          creditLimitUSD: item.creditLimitUSD !== undefined && item.creditLimitUSD !== null ? Number(item.creditLimitUSD) : null,
          paymentDays: item.paymentDays !== undefined && item.paymentDays !== null ? Number(item.paymentDays) : null,
          paymentMode: item.paymentMode ? String(item.paymentMode) : null,
          overduePolicy: item.overduePolicy ? String(item.overduePolicy) : null,
        });
      }

      if (batchData.length > 0) {
        const res = await this.prisma.account.createMany({
          data: batchData,
          skipDuplicates: true,
        });
        inserted += res.count;
      }
    }

    // Auto-create Customer and Supplier entities in bulk
    let custCreated = 0;
    let suppCreated = 0;
    const customersToCreate: any[] = [];
    const suppliersToCreate: any[] = [];
    const seenCustCode = new Set<string>();
    const seenSuppCode = new Set<string>();

    for (const item of sorted) {
      const code = String(item.code).trim();
      const accId = codeToIdMap.get(code);
      if (!accId || item.isParent) continue;

      const isCustomer = item.category === AccountCategory.CUSTOMER || code.startsWith('1614') || String(item.cardType || '').includes('عميل');
      const isSupplier = item.category === AccountCategory.SUPPLIER || code.startsWith('2614') || code.startsWith('261') || String(item.cardType || '').includes('مورد');

      if (isCustomer && !seenCustCode.has(code)) {
        seenCustCode.add(code);
        customersToCreate.push({
          code,
          nameAr: String(item.nameAr || item.name),
          nameEn: item.nameEn ? String(item.nameEn) : null,
          phone: item.phone ? String(item.phone) : null,
          email: item.email ? String(item.email) : null,
          address: item.address ? String(item.address) : null,
          accountId: accId,
          companyId,
          tenantId: company.tenantId,
          isActive: true,
        });
      } else if (isSupplier && !seenSuppCode.has(code)) {
        seenSuppCode.add(code);
        suppliersToCreate.push({
          code,
          nameAr: String(item.nameAr || item.name),
          nameEn: item.nameEn ? String(item.nameEn) : null,
          phone: item.phone ? String(item.phone) : null,
          email: item.email ? String(item.email) : null,
          address: item.address ? String(item.address) : null,
          accountId: accId,
          companyId,
          tenantId: company.tenantId,
          isActive: true,
          isAirline: String(item.nameAr || item.name).includes('طيران') || String(item.nameAr || item.name).includes('Airlines'),
        });
      }
    }

    if (customersToCreate.length > 0) {
      const cRes = await this.prisma.customer.createMany({ data: customersToCreate, skipDuplicates: true });
      custCreated = cRes.count;
    }
    if (suppliersToCreate.length > 0) {
      const sRes = await this.prisma.supplier.createMany({ data: suppliersToCreate, skipDuplicates: true });
      suppCreated = sRes.count;
    }

    this.invalidateCache(companyId);
    return {
      success: true,
      totalInserted: inserted,
      totalUpdated: 0,
      totalWithBalances: withBalances,
      customersCreated: custCreated,
      suppliersCreated: suppCreated,
    };
  }
}