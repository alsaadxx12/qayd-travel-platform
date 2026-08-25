import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, FiscalYearStatus } from '@prisma/client';
import {
  CreateFiscalYearDto,
  UpdateFiscalYearDto,
  ExecuteClosingDto,
  ReopenFiscalYearDto,
  RecloseFiscalYearDto,
  RecalculateCascadingDto,
} from './dto/fiscal-years.dto';
import * as crypto from 'crypto';

@Injectable()
export class FiscalYearsService {
  private readonly logger = new Logger(FiscalYearsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async resolveCompanyId(companyId?: string): Promise<string> {
    if (companyId && companyId !== 'default-company-id') {
      const existing = await this.prisma.company.findUnique({ where: { id: companyId } });
      if (existing) return existing.id;
    }

    const defaultCompany = await this.prisma.company.findFirst({
      where: { isDefault: true },
      orderBy: { createdAt: 'asc' },
    });
    if (defaultCompany) return defaultCompany.id;

    const anyCompany = await this.prisma.company.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    if (anyCompany) return anyCompany.id;

    const created = await this.prisma.company.create({
      data: {
        name: 'شركة الفرسان للسياحة والسفر',
        code: 'TRAVEL01',
        currency: 'IQD',
        isDefault: true,
      },
    });
    return created.id;
  }

  // 1. Get all fiscal years for a company with metrics
  async getYears(companyId: string) {
    const validCompanyId = await this.resolveCompanyId(companyId);

    // Auto-seed default fiscal years if company has none
    const count = await this.prisma.fiscalYear.count({ where: { companyId: validCompanyId } });
    if (count === 0) {
      await this.seedDefaultFiscalYears(validCompanyId);
    }

    const years = await this.prisma.fiscalYear.findMany({
      where: { companyId: validCompanyId },
      include: {
        periods: {
          orderBy: { periodNumber: 'asc' },
        },
        _count: {
          select: {
            journalEntries: true,
            balanceAuditLogs: true,
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    return years.map((y) => {
      const openPeriods = y.periods.filter((p) => p.status === 'OPEN').length;
      const closedPeriods = y.periods.filter((p) => p.status === 'CLOSED').length;
      return {
        ...y,
        totalPeriods: y.periods.length,
        openPeriods,
        closedPeriods,
      };
    });
  }

  // 2. Get a single fiscal year
  async getYear(id: string, companyId: string) {
    const validCompanyId = await this.resolveCompanyId(companyId);
    const year = await this.prisma.fiscalYear.findFirst({
      where: { id, companyId: validCompanyId },
      include: {
        periods: { orderBy: { periodNumber: 'asc' } },
        _count: {
          select: {
            journalEntries: true,
            balanceAuditLogs: true,
          },
        },
      },
    });
    if (!year) throw new NotFoundException('السنة المالية غير موجودة');
    return year;
  }

  // 3. Create a new fiscal year
  async createYear(dto: CreateFiscalYearDto, companyId: string, userId: string) {
    const validCompanyId = await this.resolveCompanyId(companyId);
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);

    if (start >= end) {
      throw new BadRequestException('تاريخ بداية السنة المالية يجب أن يكون قبل تاريخ نهايتها.');
    }

    // Check duplicate name
    const existingName = await this.prisma.fiscalYear.findFirst({
      where: { companyId: validCompanyId, name: dto.name.trim() },
    });
    if (existingName) {
      throw new BadRequestException(`السنة المالية (${dto.name}) مسجلة مسبقاً في هذه الشركة.`);
    }

    // Check overlapping dates
    const overlapping = await this.prisma.fiscalYear.findFirst({
      where: {
        companyId: validCompanyId,
        OR: [
          { startDate: { lte: end }, endDate: { gte: start } },
        ],
      },
    });
    if (overlapping) {
      throw new BadRequestException(
        `تاريخ السنة المالية يتعارض مع السنة المالية (${overlapping.name}) من ${overlapping.startDate.toISOString().split('T')[0]} إلى ${overlapping.endDate.toISOString().split('T')[0]}`
      );
    }

    const isCurrent = dto.isCurrent ?? false;

    return this.prisma.$transaction(async (tx) => {
      if (isCurrent) {
        await tx.fiscalYear.updateMany({
          where: { companyId: validCompanyId },
          data: { isCurrent: false },
        });
      }

      const year = await tx.fiscalYear.create({
        data: {
          companyId: validCompanyId,
          name: dto.name.trim(),
          startDate: start,
          endDate: end,
          status: 'OPEN',
          baseCurrency: dto.baseCurrency || 'IQD',
          isCurrent,
          createdById: userId,
          previousYearId: dto.previousYearId || null,
          notes: dto.notes || null,
        },
      });

      // Generate 12 monthly fiscal periods if requested
      if (dto.createMonthlyPeriods !== false) {
        const periodsData: Prisma.FiscalPeriodCreateManyInput[] = [];
        const monthNames = [
          'يناير (شهر 1)', 'فبراير (شهر 2)', 'مارس (شهر 3)', 'أبريل (شهر 4)',
          'مايو (شهر 5)', 'يونيو (شهر 6)', 'يوليو (شهر 7)', 'أغسطس (شهر 8)',
          'سبتمبر (شهر 9)', 'أكتوبر (شهر 10)', 'نوفمبر (شهر 11)', 'ديسمبر (شهر 12)'
        ];

        for (let m = 0; m < 12; m++) {
          const pStart = new Date(Date.UTC(start.getFullYear(), m, 1));
          const pEnd = new Date(Date.UTC(start.getFullYear(), m + 1, 0, 23, 59, 59, 999));
          periodsData.push({
            companyId: validCompanyId,
            fiscalYearId: year.id,
            name: `${monthNames[m]} - ${year.name}`,
            periodNumber: m + 1,
            startDate: pStart,
            endDate: pEnd,
            status: 'OPEN',
          });
        }

        await tx.fiscalPeriod.createMany({ data: periodsData });
      }

      await tx.auditLog.create({
        data: {
          action: 'CREATE_FISCAL_YEAR',
          entity: 'FiscalYear',
          entityId: year.id,
          details: JSON.stringify({ name: year.name, startDate: year.startDate, endDate: year.endDate }),
          userId,
          companyId: validCompanyId,
        },
      });

      return year;
    });
  }

  // 4. Set Active Fiscal Year for the current user
  async setActiveYear(userId: string, yearId: string, companyId: string) {
    const validCompanyId = await this.resolveCompanyId(companyId);
    const year = await this.prisma.fiscalYear.findFirst({
      where: { id: yearId, companyId: validCompanyId },
    });
    if (!year) throw new NotFoundException('السنة المالية غير موجودة.');

    await this.prisma.user.updateMany({
      where: { id: userId },
      data: { activeFiscalYearId: year.id },
    });

    return {
      success: true,
      activeFiscalYear: year,
    };
  }

  // 5. Get Active Fiscal Year for a user
  async getActiveYear(userId: string, companyId: string) {
    const validCompanyId = await this.resolveCompanyId(companyId);
    let activeYear: any = null;

    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { activeFiscalYearId: true },
      });

      if (user?.activeFiscalYearId) {
        activeYear = await this.prisma.fiscalYear.findFirst({
          where: { id: user.activeFiscalYearId, companyId: validCompanyId },
          include: { periods: true },
        });
      }
    }

    if (!activeYear) {
      activeYear = await this.prisma.fiscalYear.findFirst({
        where: { companyId: validCompanyId, isCurrent: true },
        include: { periods: true },
      });
    }

    if (!activeYear) {
      activeYear = await this.prisma.fiscalYear.findFirst({
        where: { companyId: validCompanyId },
        orderBy: { startDate: 'desc' },
        include: { periods: true },
      });
    }

    if (!activeYear) {
      await this.seedDefaultFiscalYears(validCompanyId);
      activeYear = await this.prisma.fiscalYear.findFirst({
        where: { companyId: validCompanyId, isCurrent: true },
        include: { periods: true },
      });
    }

    return activeYear;
  }

  // 6. Pre-check year before closing
  async preCheckYearClosing(yearId: string, companyId: string) {
    const validCompanyId = await this.resolveCompanyId(companyId);
    const year = await this.getYear(yearId, validCompanyId);

    // 1. Total Debit vs Total Credit Balance
    const postedLines = await this.prisma.journalEntryLine.findMany({
      where: {
        journalEntry: {
          companyId: validCompanyId,
          fiscalYearId: year.id,
          status: 'POSTED',
        },
      },
      select: { debit: true, credit: true },
    });

    let totalDebit = 0;
    let totalCredit = 0;
    postedLines.forEach((l) => {
      totalDebit += Number(l.debit);
      totalCredit += Number(l.credit);
    });

    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
    const balanceDiff = Math.abs(totalDebit - totalCredit);

    // 2. Draft (unposted) entries
    const draftCount = await this.prisma.journalEntry.count({
      where: {
        companyId: validCompanyId,
        fiscalYearId: year.id,
        status: 'DRAFT',
      },
    });

    // 3. Open Periods count
    const openPeriods = await this.prisma.fiscalPeriod.count({
      where: { fiscalYearId: year.id, status: 'OPEN' },
    });

    // 4. Retained earnings / Year Result accounts in Chart of Accounts
    const equityAccounts = await this.prisma.account.findMany({
      where: {
        companyId: validCompanyId,
        type: 'EQUITY',
        isParent: false,
      },
      select: { id: true, code: true, nameAr: true, balance: true },
    });

    // 5. Check if next fiscal year exists
    const nextYears = await this.prisma.fiscalYear.findMany({
      where: {
        companyId: validCompanyId,
        startDate: { gte: year.endDate },
      },
      orderBy: { startDate: 'asc' },
    });

    const canClose = isBalanced && draftCount === 0;

    return {
      fiscalYear: {
        id: year.id,
        name: year.name,
        startDate: year.startDate,
        endDate: year.endDate,
        status: year.status,
      },
      isBalanced,
      totalDebit,
      totalCredit,
      balanceDiff,
      draftEntriesCount: draftCount,
      openPeriodsCount: openPeriods,
      equityAccounts,
      availableNextYears: nextYears,
      canClose,
      warnings: [
        ...(draftCount > 0 ? [`يوجد عدد (${draftCount}) قيود بحالة مسودة (غير مرحلة) في هذه السنة.`] : []),
        ...(!isBalanced ? [`ميزان المراجعة غير متوازن بفارق (${balanceDiff.toFixed(2)}).`] : []),
        ...(nextYears.length === 0 ? ['لا توجد سنة مالية جديدة مسجلة لتدوير الأرصدة إليها. يرجى إنشاء سنة جديدة أولاً.'] : []),
        ...(equityAccounts.length === 0 ? ['لم يتم العثور على حساب أرباح محتجزة أو حقوق ملكية لإقفال نتيجة العام.'] : []),
      ],
    };
  }

  // 7. Preview Year Closing & Rollover
  async previewYearClosing(yearId: string, targetYearId: string, retainedEarningsAccountId: string, companyId: string) {
    const validCompanyId = await this.resolveCompanyId(companyId);
    const year = await this.getYear(yearId, validCompanyId);
    const targetYear = await this.getYear(targetYearId, validCompanyId);

    // Auto-link any journal entries within year range that had null fiscalYearId
    await this.prisma.journalEntry.updateMany({
      where: {
        companyId: validCompanyId,
        fiscalYearId: null,
        date: { gte: year.startDate, lte: year.endDate },
      },
      data: { fiscalYearId: year.id },
    });

    // Get all accounts (both parent and leaf) with their posted lines in this fiscal year
    const accounts = await this.prisma.account.findMany({
      where: { companyId: validCompanyId },
      include: {
        journalLines: {
          where: {
            journalEntry: {
              companyId: validCompanyId,
              status: 'POSTED',
              OR: [
                { fiscalYearId: year.id },
                {
                  date: { gte: year.startDate, lte: year.endDate },
                },
              ],
            },
          },
        },
      },
      orderBy: { code: 'asc' },
    });

    let totalRevenues = 0;
    let totalExpenses = 0;

    const closingLinesPreview: Array<{
      accountId: string;
      accountCode: string;
      accountName: string;
      type: string;
      balance: number;
      action: 'DEBIT' | 'CREDIT';
      amount: number;
    }> = [];

    const openingLinesPreview: Array<{
      accountId: string;
      accountCode: string;
      accountName: string;
      type: string;
      closingBalance: number;
      debit: number;
      credit: number;
    }> = [];

    const allAccounts: Array<{
      accountId: string;
      accountCode: string;
      accountName: string;
      type: string;
      typeLabelAr: string;
      currency: string;
      balance: number;
      balanceIQD: number;
      balanceUSD: number;
      debit: number;
      credit: number;
      isParent: boolean;
      level: number;
      isExternalClearing: boolean;
      clearingCategory?: string;
      action: 'ROLLOVER' | 'CLOSE_TO_RETAINED' | 'ZERO' | 'PARENT_HEADING';
      actionLabelAr: string;
    }> = [];

    let totalRevenuesIQD = 0;
    let totalRevenuesUSD = 0;
    let totalExpensesIQD = 0;
    let totalExpensesUSD = 0;

    for (const acc of accounts) {
      let accDebit = 0;
      let accCredit = 0;
      let accDebitUSD = 0;
      let accCreditUSD = 0;

      acc.journalLines.forEach((l) => {
        const d = Number(l.debit);
        const c = Number(l.credit);
        if (l.costCenter === 'USD' || acc.currency === 'USD') {
          accDebitUSD += d;
          accCreditUSD += c;
        } else {
          accDebit += d;
          accCredit += c;
        }
      });

      const netLineBalance = accDebit - accCredit;
      const netLineBalanceUSD = accDebitUSD - accCreditUSD;

      // Extract multi-currency metadata from notes if available
      let multiData: any = null;
      const rawNotes = acc.address || '';
      if (typeof rawNotes === 'string' && rawNotes.includes('{') && rawNotes.includes('}')) {
        try {
          multiData = JSON.parse(rawNotes.substring(rawNotes.indexOf('{'), rawNotes.lastIndexOf('}') + 1));
        } catch (e) {}
      }

      const isExternalClearing = acc.code.startsWith('91') || acc.code.startsWith('9') || (acc.category as string) === 'CLEARING';
      let clearingCat = '';
      if (acc.code.startsWith('911')) clearingCat = 'BOURSE';
      else if (acc.code.startsWith('912')) clearingCat = 'OFFICE';
      else if (acc.code.startsWith('913')) clearingCat = 'SUSPENSE';

      const curr = acc.currency || (acc.nameAr.includes('USD') || acc.nameAr.includes('دولار') ? 'USD' : 'IQD');

      let balIQD = netLineBalance;
      let balUSD = netLineBalanceUSD;

      if (multiData) {
        if (multiData.iqd !== undefined) balIQD = Number(multiData.iqd);
        if (multiData.usd !== undefined) balUSD = Number(multiData.usd);
      } else if (curr === 'USD' && balUSD === 0 && Number(acc.balance) !== 0) {
        balUSD = Number(acc.balance);
      } else if (curr === 'IQD' && balIQD === 0 && Number(acc.balance) !== 0) {
        balIQD = Number(acc.balance);
      }

      const primaryBalance = curr === 'USD' ? (balUSD !== 0 ? balUSD : Number(acc.balance)) : (balIQD !== 0 ? balIQD : Number(acc.balance));

      if (acc.type === 'REVENUE') {
        const revBalance = accCredit - accDebit;
        const revBalanceUSD = accCreditUSD - accDebitUSD;
        totalRevenuesIQD += revBalance;
        totalRevenuesUSD += (curr === 'USD' ? primaryBalance : revBalanceUSD);

        if (!acc.isParent && Math.abs(primaryBalance) > 0.001) {
          closingLinesPreview.push({
            accountId: acc.id,
            accountCode: acc.code,
            accountName: acc.nameAr,
            type: acc.type,
            balance: primaryBalance,
            action: primaryBalance < 0 ? 'DEBIT' : 'CREDIT',
            amount: Math.abs(primaryBalance),
          });
        }
        allAccounts.push({
          accountId: acc.id,
          accountCode: acc.code,
          accountName: acc.nameAr,
          type: acc.type,
          typeLabelAr: acc.isParent ? 'إيرادات (رئيسي)' : isExternalClearing ? 'تصفية خارجية' : 'إيرادات',
          currency: curr,
          balance: primaryBalance,
          balanceIQD: balIQD,
          balanceUSD: balUSD,
          debit: accDebit + accDebitUSD,
          credit: accCredit + accCreditUSD,
          isParent: acc.isParent,
          level: acc.level || 1,
          isExternalClearing,
          clearingCategory: clearingCat,
          action: acc.isParent ? 'PARENT_HEADING' : 'CLOSE_TO_RETAINED',
          actionLabelAr: acc.isParent ? 'حساب رئيسي (تجميعي)' : 'إقفال وتصفير في الأرباح المحتجزة',
        });
      } else if (acc.type === 'EXPENSE') {
        const expBalance = accDebit - accCredit;
        const expBalanceUSD = accDebitUSD - accCreditUSD;
        totalExpensesIQD += expBalance;
        totalExpensesUSD += (curr === 'USD' ? primaryBalance : expBalanceUSD);

        if (!acc.isParent && Math.abs(primaryBalance) > 0.001) {
          closingLinesPreview.push({
            accountId: acc.id,
            accountCode: acc.code,
            accountName: acc.nameAr,
            type: acc.type,
            balance: primaryBalance,
            action: primaryBalance > 0 ? 'CREDIT' : 'DEBIT',
            amount: Math.abs(primaryBalance),
          });
        }
        allAccounts.push({
          accountId: acc.id,
          accountCode: acc.code,
          accountName: acc.nameAr,
          type: acc.type,
          typeLabelAr: acc.isParent ? 'مصروفات (رئيسي)' : isExternalClearing ? 'تصفية خارجية' : 'مصروفات وتكاليف',
          currency: curr,
          balance: primaryBalance,
          balanceIQD: balIQD,
          balanceUSD: balUSD,
          debit: accDebit + accDebitUSD,
          credit: accCredit + accCreditUSD,
          isParent: acc.isParent,
          level: acc.level || 1,
          isExternalClearing,
          clearingCategory: clearingCat,
          action: acc.isParent ? 'PARENT_HEADING' : 'CLOSE_TO_RETAINED',
          actionLabelAr: acc.isParent ? 'حساب رئيسي (تجميعي)' : 'إقفال وتصفير من الأرباح المحتجزة',
        });
      } else {
        // Balance sheet accounts: ASSET, LIABILITY, EQUITY & External Clearings
        const typeLabelMap: Record<string, string> = {
          ASSET: isExternalClearing ? (clearingCat === 'BOURSE' ? 'تصفية خارجية (بورصة)' : clearingCat === 'OFFICE' ? 'تصفية خارجية (مكتب)' : 'تصفية خارجية (معلق)') : 'أصول وموجودات',
          LIABILITY: 'خصوم والتزامات',
          EQUITY: 'حقوق ملكية ورأس مال',
        };

        if (!acc.isParent && Math.abs(primaryBalance) > 0.001) {
          openingLinesPreview.push({
            accountId: acc.id,
            accountCode: acc.code,
            accountName: acc.nameAr,
            type: acc.type,
            closingBalance: primaryBalance,
            debit: primaryBalance > 0 ? primaryBalance : 0,
            credit: primaryBalance < 0 ? Math.abs(primaryBalance) : 0,
          });
        }

        allAccounts.push({
          accountId: acc.id,
          accountCode: acc.code,
          accountName: acc.nameAr,
          type: acc.type,
          typeLabelAr: acc.isParent ? `${typeLabelMap[acc.type] || 'ميزانية'} (رئيسي)` : (typeLabelMap[acc.type] || (isExternalClearing ? 'تصفية ومقاصة خارجية' : 'ميزانية عمومية')),
          currency: curr,
          balance: primaryBalance,
          balanceIQD: balIQD,
          balanceUSD: balUSD,
          debit: primaryBalance > 0 ? primaryBalance : accDebit,
          credit: primaryBalance < 0 ? Math.abs(primaryBalance) : accCredit,
          isParent: acc.isParent,
          level: acc.level || 1,
          isExternalClearing,
          clearingCategory: clearingCat,
          action: acc.isParent ? 'PARENT_HEADING' : 'ROLLOVER',
          actionLabelAr: acc.isParent ? 'حساب رئيسي (تجميعي)' : isExternalClearing ? 'تدوير رصيد التصفية والمقاصة' : 'تدوير كرصيد افتتاحي للسنة الجديدة',
        });
      }
    }

    const netProfitOrLossIQD = totalRevenuesIQD - totalExpensesIQD;
    const netProfitOrLossUSD = totalRevenuesUSD - totalExpensesUSD;
    const netProfitOrLoss = netProfitOrLossIQD;

    let retainedAccount = retainedEarningsAccountId
      ? await this.prisma.account.findUnique({
          where: { id: retainedEarningsAccountId },
        })
      : null;

    if (!retainedAccount) {
      retainedAccount = await this.prisma.account.findFirst({
        where: {
          companyId: validCompanyId,
          OR: [
            { code: '2631' },
            { code: '263' },
            { code: { startsWith: '26' } },
            { type: 'EQUITY' },
          ],
        },
        orderBy: { code: 'asc' },
      });
    }

    return {
      sourceYear: { id: year.id, name: year.name },
      targetYear: { id: targetYear.id, name: targetYear.name, startDate: targetYear.startDate },
      totalRevenues: totalRevenuesIQD,
      totalExpenses: totalExpensesIQD,
      netProfitOrLoss: netProfitOrLossIQD,
      isProfit: netProfitOrLossIQD >= 0,
      totalRevenuesIQD,
      totalRevenuesUSD,
      totalExpensesIQD,
      totalExpensesUSD,
      netProfitOrLossIQD,
      netProfitOrLossUSD,
      retainedEarningsAccount: retainedAccount
        ? { id: retainedAccount.id, code: retainedAccount.code, nameAr: retainedAccount.nameAr }
        : null,
      closingLinesPreview,
      openingLinesPreview,
      allAccounts,
    };
  }

  // 8. Execute Year Closing & Rollover
  async executeYearClosing(dto: ExecuteClosingDto, companyId: string, userId: string) {
    const validCompanyId = await this.resolveCompanyId(companyId);
    const year = await this.getYear(dto.fiscalYearId, validCompanyId);
    const targetYear = await this.getYear(dto.targetFiscalYearId, validCompanyId);

    if (year.status === 'CLOSED') {
      throw new BadRequestException('السنة المالية مقفلة بالفعل.');
    }

    let retainedAccountId = dto.retainedEarningsAccountId;
    if (!retainedAccountId) {
      const defRet = await this.prisma.account.findFirst({
        where: {
          companyId: validCompanyId,
          OR: [
            { code: '2631' },
            { code: '263' },
            { code: { startsWith: '26' } },
            { type: 'EQUITY' },
          ],
        },
        orderBy: { code: 'asc' },
      });
      retainedAccountId = defRet?.id || '';
    }

    const preview = await this.previewYearClosing(
      dto.fiscalYearId,
      dto.targetFiscalYearId,
      dto.retainedEarningsAccountId,
      validCompanyId
    );

    const closingDate = dto.closingDate ? new Date(dto.closingDate) : year.endDate;
    const openingDate = targetYear.startDate;

    return this.prisma.$transaction(async (tx) => {
      // 1. Create Closing Journal Entry for P&L accounts in source year
      const closingCount = await tx.journalEntry.count({ where: { companyId: validCompanyId } });
      const closingEntryNumber = `JV-CLOSE-${year.name}-${String(closingCount + 1).padStart(3, '0')}`;

      const closingLinesData: Prisma.JournalEntryLineCreateWithoutJournalEntryInput[] = [];
      let totalClosingDebit = 0;
      let totalClosingCredit = 0;

      for (const line of preview.closingLinesPreview) {
        const isDebit = line.action === 'DEBIT';
        const debitVal = isDebit ? line.amount : 0;
        const creditVal = !isDebit ? line.amount : 0;
        totalClosingDebit += debitVal;
        totalClosingCredit += creditVal;

        closingLinesData.push({
          account: { connect: { id: line.accountId } },
          debit: new Prisma.Decimal(debitVal),
          credit: new Prisma.Decimal(creditVal),
          description: `إقفال حساب ${line.accountName} للسنة المالية ${year.name}`,
        });
      }

      // Add Retained Earnings line to balance closing entry
      if (Math.abs(preview.netProfitOrLoss) > 0.001) {
        const isProfit = preview.netProfitOrLoss > 0;
        const profitDebit = isProfit ? 0 : Math.abs(preview.netProfitOrLoss);
        const profitCredit = isProfit ? preview.netProfitOrLoss : 0;
        totalClosingDebit += profitDebit;
        totalClosingCredit += profitCredit;

        closingLinesData.push({
          account: { connect: { id: dto.retainedEarningsAccountId } },
          debit: new Prisma.Decimal(profitDebit),
          credit: new Prisma.Decimal(profitCredit),
          description: `ترحيل صافي ${isProfit ? 'أرباح' : 'خسائر'} السنة المالية ${year.name} إلى الأرباح المحتجزة`,
        });
      }

      const closingEntry = await tx.journalEntry.create({
        data: {
          companyId: validCompanyId,
          entryNumber: closingEntryNumber,
          date: closingDate,
          fiscalYearId: year.id,
          reference: `CLOSING-${year.name}`,
          description: `قيد الإقفال السنوي الشامل للسنة المالية ${year.name}`,
          status: 'POSTED',
          isClosing: true,
          isSystemGenerated: true,
          sourceType: 'CLOSING_ROLLOVER',
          createdById: userId,
          postedById: userId,
          totalDebit: new Prisma.Decimal(totalClosingDebit),
          totalCredit: new Prisma.Decimal(totalClosingCredit),
          lines: { create: closingLinesData },
        },
      });

      // 2. Create Opening Journal Entry in target year
      const openingCount = await tx.journalEntry.count({ where: { companyId: validCompanyId } });
      const openingEntryNumber = `JV-OPEN-${targetYear.name}-${String(openingCount + 1).padStart(3, '0')}`;

      const openingLinesData: Prisma.JournalEntryLineCreateWithoutJournalEntryInput[] = [];
      let totalOpeningDebit = 0;
      let totalOpeningCredit = 0;

      for (const line of preview.openingLinesPreview) {
        totalOpeningDebit += line.debit;
        totalOpeningCredit += line.credit;

        const accDetails = preview.allAccounts?.find(a => a.accountId === line.accountId);
        const curr = accDetails?.currency || 'IQD';

        openingLinesData.push({
          account: { connect: { id: line.accountId } },
          debit: new Prisma.Decimal(line.debit),
          credit: new Prisma.Decimal(line.credit),
          costCenter: curr === 'USD' ? 'USD' : undefined,
          description: `رصيد افتتاحي مدور (${curr}) من السنة المالية ${year.name} - ${line.accountName}`,
        });
      }

      // Add net profit/loss into retained earnings in opening entry if not already in equity balance
      if (retainedAccountId && Math.abs(preview.netProfitOrLoss) > 0.001) {
        const isProfit = preview.netProfitOrLoss > 0;
        const netDebit = isProfit ? 0 : Math.abs(preview.netProfitOrLoss);
        const netCredit = isProfit ? preview.netProfitOrLoss : 0;
        totalOpeningDebit += netDebit;
        totalOpeningCredit += netCredit;

        openingLinesData.push({
          account: { connect: { id: retainedAccountId } },
          debit: new Prisma.Decimal(netDebit),
          credit: new Prisma.Decimal(netCredit),
          description: `رصيد مدور لـ ${isProfit ? 'أرباح' : 'خسائر'} السنة المالية ${year.name}`,
        });
      }

      const openingEntry = await tx.journalEntry.create({
        data: {
          companyId: validCompanyId,
          entryNumber: openingEntryNumber,
          date: openingDate,
          fiscalYearId: targetYear.id,
          reference: `OPENING-${targetYear.name}`,
          description: `القيد الافتتاحي المدور للسنة المالية ${targetYear.name} من السنة ${year.name}`,
          status: 'POSTED',
          isOpening: true,
          isSystemGenerated: true,
          sourceType: 'OPENING_ROLLOVER',
          createdById: userId,
          postedById: userId,
          totalDebit: new Prisma.Decimal(totalOpeningDebit),
          totalCredit: new Prisma.Decimal(totalOpeningCredit),
          lines: { create: openingLinesData },
        },
      });

      // 3. Update source year status and linkage
      await tx.fiscalYear.update({
        where: { id: year.id },
        data: {
          status: 'CLOSED',
          closedById: userId,
          closedAt: new Date(),
          closingEntryId: closingEntry.id,
          openingEntryId: openingEntry.id,
          nextYearId: targetYear.id,
          isCurrent: false,
        },
      });

      // 4. Update target year status
      await tx.fiscalYear.update({
        where: { id: targetYear.id },
        data: {
          status: 'OPEN',
          isCurrent: true,
          previousYearId: year.id,
        },
      });

      // 5. Close all periods of the closed year
      await tx.fiscalPeriod.updateMany({
        where: { fiscalYearId: year.id },
        data: { status: 'CLOSED' },
      });

      // 6. Audit Log
      await tx.auditLog.create({
        data: {
          action: 'EXECUTE_YEAR_CLOSING',
          entity: 'FiscalYear',
          entityId: year.id,
          details: JSON.stringify({
            sourceYear: year.name,
            targetYear: targetYear.name,
            netProfitOrLoss: preview.netProfitOrLoss,
            closingEntryId: closingEntry.id,
            openingEntryId: openingEntry.id,
          }),
          userId,
          companyId,
        },
      });

      return {
        success: true,
        sourceYear: year.name,
        targetYear: targetYear.name,
        closingEntryNumber: closingEntry.entryNumber,
        openingEntryNumber: openingEntry.entryNumber,
        netProfitOrLoss: preview.netProfitOrLoss,
      };
    });
  }

  // 9. Reopen a previously closed fiscal year
  async reopenYear(yearId: string, dto: ReopenFiscalYearDto, companyId: string, userId: string) {
    const validCompanyId = await this.resolveCompanyId(companyId);
    const year = await this.getYear(yearId, validCompanyId);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!dto.reason || !dto.reason.trim()) {
      throw new BadRequestException('سبب إعادة فتح السنة المالية إلزامي ولا يمكن تركه فارغاً.');
    }

    const reopenSessionId = crypto.randomUUID();

    // Snapshot of current balances before modification
    const accounts = await this.prisma.account.findMany({
      where: { companyId: validCompanyId, isParent: false },
      include: {
        journalLines: {
          where: {
            journalEntry: {
              companyId: validCompanyId,
              fiscalYearId: year.id,
              status: 'POSTED',
            },
          },
        },
      },
    });

    const auditLogsData: Prisma.BalanceAuditLogCreateManyInput[] = [];

    for (const acc of accounts) {
      let d = 0;
      let c = 0;
      acc.journalLines.forEach((l) => {
        d += Number(l.debit);
        c += Number(l.credit);
      });
      const bal = d - c;

      auditLogsData.push({
        companyId: validCompanyId,
        fiscalYearId: year.id,
        reopenSessionId,
        accountId: acc.id,
        accountCode: acc.code,
        accountName: acc.nameAr,
        currency: acc.currency || 'IQD',
        documentType: 'FiscalYear',
        documentNumber: year.name,
        actionType: 'REOPEN_SNAPSHOT',
        userId,
        userName: user?.name || 'مستخدم النظام',
        reason: dto.reason.trim(),
        beforeDebit: new Prisma.Decimal(d),
        afterDebit: new Prisma.Decimal(d),
        beforeCredit: new Prisma.Decimal(c),
        afterCredit: new Prisma.Decimal(c),
        beforeBalance: new Prisma.Decimal(bal),
        afterBalance: new Prisma.Decimal(bal),
        balanceDiff: new Prisma.Decimal(0),
        checksum: crypto.createHash('sha256').update(`${year.id}-${acc.id}-${bal}-${reopenSessionId}`).digest('hex'),
      });
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.fiscalYear.update({
        where: { id: year.id },
        data: {
          status: 'REOPENED',
          reopenedById: userId,
          reopenedAt: new Date(),
          reopenReason: dto.reason.trim(),
        },
      });

      // Set reopened periods to OPEN
      await tx.fiscalPeriod.updateMany({
        where: { fiscalYearId: year.id },
        data: { status: 'OPEN' },
      });

      // Insert snapshot logs
      if (auditLogsData.length > 0) {
        await tx.balanceAuditLog.createMany({ data: auditLogsData });
      }

      await tx.auditLog.create({
        data: {
          action: 'REOPEN_FISCAL_YEAR',
          entity: 'FiscalYear',
          entityId: year.id,
          details: JSON.stringify({ name: year.name, reason: dto.reason, reopenSessionId }),
          userId,
          companyId: validCompanyId,
        },
      });

      return {
        success: true,
        year: year.name,
        status: 'REOPENED',
        reopenSessionId,
      };
    });
  }

  // 10. Recalculate Cascading Balances to Next Years
  async recalculateCascadingBalances(yearId: string, companyId: string, userId: string, dto?: RecalculateCascadingDto) {
    const validCompanyId = await this.resolveCompanyId(companyId);
    const year = await this.getYear(yearId, validCompanyId);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    // Find all chronologically subsequent years
    const nextYears = await this.prisma.fiscalYear.findMany({
      where: {
        companyId: validCompanyId,
        startDate: { gte: year.endDate },
      },
      orderBy: { startDate: 'asc' },
    });

    if (nextYears.length === 0) {
      return {
        success: true,
        message: 'لا توجد سنوات تالية متأثرة لإعادة الاحتساب.',
        affectedYears: [],
      };
    }

    const affectedYearNames: string[] = [];
    const auditLogs: Prisma.BalanceAuditLogCreateManyInput[] = [];

    await this.prisma.$transaction(async (tx) => {
      let currentSourceYear: { id: string; name: string } = year;

      for (const nextYear of nextYears) {
        affectedYearNames.push(nextYear.name);

        // Calculate closing balance of source year
        const accounts = await tx.account.findMany({
          where: { companyId: validCompanyId, isParent: false },
          include: {
            journalLines: {
              where: {
                journalEntry: {
                  companyId: validCompanyId,
                  fiscalYearId: currentSourceYear.id,
                  status: 'POSTED',
                  isClosing: false, // before closing entry
                },
              },
            },
          },
        });

        // Find existing opening entry in nextYear
        let openingEntry = await tx.journalEntry.findFirst({
          where: {
            companyId: validCompanyId,
            fiscalYearId: nextYear.id,
            isOpening: true,
          },
          include: { lines: true },
        });

        if (openingEntry) {
          // Delete old lines and recreate with new balances
          await tx.journalEntryLine.deleteMany({
            where: { journalEntryId: openingEntry.id },
          });

          const newLinesData: Prisma.JournalEntryLineCreateWithoutJournalEntryInput[] = [];
          let totalD = 0;
          let totalC = 0;

          for (const acc of accounts) {
            let d = 0;
            let c = 0;
            acc.journalLines.forEach((l) => {
              d += Number(l.debit);
              c += Number(l.credit);
            });
            const net = d - c;

            if (acc.type !== 'REVENUE' && acc.type !== 'EXPENSE' && Math.abs(net) > 0.001) {
              const lineDebit = net > 0 ? net : 0;
              const lineCredit = net < 0 ? Math.abs(net) : 0;
              totalD += lineDebit;
              totalC += lineCredit;

              newLinesData.push({
                account: { connect: { id: acc.id } },
                debit: new Prisma.Decimal(lineDebit),
                credit: new Prisma.Decimal(lineCredit),
                description: `رصيد افتتاحي محدث بعد تعديل السنة ${currentSourceYear.name} - ${acc.nameAr}`,
              });

              auditLogs.push({
                companyId: validCompanyId,
                fiscalYearId: currentSourceYear.id,
                accountId: acc.id,
                accountCode: acc.code,
                accountName: acc.nameAr,
                documentType: 'CascadingRecalculation',
                documentNumber: nextYear.name,
                actionType: 'CASCADING_RECALC',
                userId,
                userName: user?.name || 'مستخدم النظام',
                reason: dto?.reason || `تحديث القيد الافتتاحي للسنة ${nextYear.name} نتيجة تعديلات السنة ${currentSourceYear.name}`,
                beforeDebit: new Prisma.Decimal(0),
                afterDebit: new Prisma.Decimal(lineDebit),
                beforeCredit: new Prisma.Decimal(0),
                afterCredit: new Prisma.Decimal(lineCredit),
                beforeBalance: new Prisma.Decimal(0),
                afterBalance: new Prisma.Decimal(net),
                balanceDiff: new Prisma.Decimal(net),
                affectedNextYears: JSON.stringify([nextYear.id]),
              });
            }
          }

          await tx.journalEntry.update({
            where: { id: openingEntry.id },
            data: {
              totalDebit: new Prisma.Decimal(totalD),
              totalCredit: new Prisma.Decimal(totalC),
              lines: { create: newLinesData },
            },
          });
        }

        currentSourceYear = nextYear;
      }

      if (auditLogs.length > 0) {
        await tx.balanceAuditLog.createMany({ data: auditLogs });
      }
    });

    return {
      success: true,
      message: `تمت إعادة احتساب الأرصدة وتحديث القيود الافتتاحية للسنوات (${affectedYearNames.join('، ')}) بنجاح.`,
      affectedYears: affectedYearNames,
    };
  }

  // 11. Re-close a reopened fiscal year
  async recloseYear(yearId: string, dto: RecloseFiscalYearDto, companyId: string, userId: string) {
    const validCompanyId = await this.resolveCompanyId(companyId);
    const year = await this.getYear(yearId, validCompanyId);
    if (year.status !== 'REOPENED') {
      throw new BadRequestException('السنة المالية ليست في حالة معاد فتحها.');
    }

    // Cascade recalculate first
    await this.recalculateCascadingBalances(yearId, validCompanyId, userId, { reason: dto.reason });

    return this.prisma.$transaction(async (tx) => {
      await tx.fiscalYear.update({
        where: { id: year.id },
        data: {
          status: 'CLOSED',
          closedById: userId,
          closedAt: new Date(),
        },
      });

      // Close all periods
      await tx.fiscalPeriod.updateMany({
        where: { fiscalYearId: year.id },
        data: { status: 'CLOSED' },
      });

      await tx.auditLog.create({
        data: {
          action: 'RECLOSE_FISCAL_YEAR',
          entity: 'FiscalYear',
          entityId: year.id,
          details: JSON.stringify({ name: year.name, reason: dto.reason }),
          userId,
          companyId: validCompanyId,
        },
      });

      return {
        success: true,
        year: year.name,
        status: 'CLOSED',
      };
    });
  }

  // 12. Get Balance Audit Logs with filters
  async getBalanceAuditLogs(yearId: string, companyId: string, query?: { accountId?: string; actionType?: string }) {
    const validCompanyId = await this.resolveCompanyId(companyId);
    const where: Prisma.BalanceAuditLogWhereInput = {
      companyId: validCompanyId,
      fiscalYearId: yearId,
    };

    if (query?.accountId) where.accountId = query.accountId;
    if (query?.actionType) where.actionType = query.actionType;

    return this.prisma.balanceAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  // 13. Delete a Fiscal Year (with complete automatic rollback of previous year closing)
  async deleteYear(id: string, companyId: string, userId?: string) {
    const validCompanyId = await this.resolveCompanyId(companyId);
    const year = await this.getYear(id, validCompanyId);

    return this.prisma.$transaction(async (tx) => {
      // 1. Find if any previous fiscal year was closed into this year (e.g., 2026 was closed into 2027)
      const previousYears = await tx.fiscalYear.findMany({
        where: {
          companyId: validCompanyId,
          OR: [
            { nextYearId: id },
            { id: year.previousYearId || undefined },
          ],
        },
      });

      for (const prevYear of previousYears) {
        // Delete the closing journal entry generated during the rollover of prevYear
        if (prevYear.closingEntryId) {
          await tx.journalEntryLine.deleteMany({
            where: { journalEntryId: prevYear.closingEntryId },
          });
          await tx.journalEntry.deleteMany({
            where: { id: prevYear.closingEntryId },
          });
        }

        // Delete any closing journal entries matching JV-CLOSE for prevYear
        const jvClosingEntries = await tx.journalEntry.findMany({
          where: {
            companyId: validCompanyId,
            fiscalYearId: prevYear.id,
            isClosing: true,
          },
        });
        for (const jv of jvClosingEntries) {
          await tx.journalEntryLine.deleteMany({ where: { journalEntryId: jv.id } });
          await tx.journalEntry.delete({ where: { id: jv.id } });
        }

        // Revert prevYear back to OPEN state with full periods reopened
        await tx.fiscalYear.update({
          where: { id: prevYear.id },
          data: {
            status: 'OPEN',
            closedById: null,
            closedAt: null,
            closingEntryId: null,
            nextYearId: null,
            isCurrent: true,
          },
        });

        // Reopen all periods of the previous year
        await tx.fiscalPeriod.updateMany({
          where: { fiscalYearId: prevYear.id },
          data: { status: 'OPEN' },
        });
      }

      // 2. Delete opening and closing journal entries of the year being deleted
      if (year.openingEntryId) {
        await tx.journalEntryLine.deleteMany({
          where: { journalEntryId: year.openingEntryId },
        });
        await tx.journalEntry.deleteMany({
          where: { id: year.openingEntryId },
        });
      }

      const systemEntries = await tx.journalEntry.findMany({
        where: {
          companyId: validCompanyId,
          fiscalYearId: id,
          isSystemGenerated: true,
        },
      });
      for (const se of systemEntries) {
        await tx.journalEntryLine.deleteMany({ where: { journalEntryId: se.id } });
        await tx.journalEntry.delete({ where: { id: se.id } });
      }

      // Unlink regular user journal entries from this fiscal year
      await tx.journalEntry.updateMany({
        where: { fiscalYearId: id },
        data: { fiscalYearId: null },
      });

      // 3. Delete balance audit logs for this year
      await tx.balanceAuditLog.deleteMany({
        where: { fiscalYearId: id },
      });

      // 4. Delete periods
      await tx.fiscalPeriod.deleteMany({
        where: { fiscalYearId: id },
      });

      // 5. Unlink users activeFiscalYearId and point to restored previous year if available
      const fallbackYear = previousYears[0];
      await tx.user.updateMany({
        where: { activeFiscalYearId: id },
        data: { activeFiscalYearId: fallbackYear ? fallbackYear.id : null },
      });

      // 6. Delete the fiscal year itself
      await tx.fiscalYear.delete({
        where: { id },
      });

      return {
        success: true,
        message: previousYears.length > 0
          ? `تم حذف السنة المالية (${year.name}) وإلغاء الإقفال بالكامل، وعادت السنة السابقة (${previousYears.map(p => p.name).join('، ')}) مفتوحة ونشطة كأن التدوير لم يحدث!`
          : `تم حذف السنة المالية (${year.name}) بنجاح.`,
      };
    });
  }

  // Helper: Seed Default Fiscal Years if none exist
  private async seedDefaultFiscalYears(companyId: string) {
    const yearsToCreate = [
      {
        name: '2025',
        startDate: new Date('2025-01-01T00:00:00Z'),
        endDate: new Date('2025-12-31T23:59:59.999Z'),
        status: FiscalYearStatus.CLOSED,
        isCurrent: false,
      },
      {
        name: '2026',
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-12-31T23:59:59.999Z'),
        status: FiscalYearStatus.OPEN,
        isCurrent: true,
      },
    ];

    for (const y of yearsToCreate) {
      const year = await this.prisma.fiscalYear.create({
        data: {
          companyId,
          name: y.name,
          startDate: y.startDate,
          endDate: y.endDate,
          status: y.status,
          isCurrent: y.isCurrent,
          createdById: 'system',
        },
      });

      // Create 12 monthly periods
      const periodsData: Prisma.FiscalPeriodCreateManyInput[] = [];
      for (let m = 0; m < 12; m++) {
        const pStart = new Date(Date.UTC(y.startDate.getFullYear(), m, 1));
        const pEnd = new Date(Date.UTC(y.startDate.getFullYear(), m + 1, 0, 23, 59, 59, 999));
        periodsData.push({
          companyId,
          fiscalYearId: year.id,
          name: `شهر ${m + 1} - ${year.name}`,
          periodNumber: m + 1,
          startDate: pStart,
          endDate: pEnd,
          status: y.status === FiscalYearStatus.CLOSED ? 'CLOSED' : 'OPEN',
        });
      }
      await this.prisma.fiscalPeriod.createMany({ data: periodsData });
    }
  }
}
