import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccountsService } from '../accounts/accounts.service';
import { AccountType, AccountCategory, Prisma } from '@prisma/client';

@Injectable()
export class CashboxesBanksService {
  constructor(
    private prisma: PrismaService,
    private accountsService: AccountsService,
  ) {}

  private async getAccountBalances(companyId: string, accountIds: string[]) {
    const balances = new Map<string, { debitIQD: number; creditIQD: number; debitUSD: number; creditUSD: number }>();
    for (const id of accountIds) {
      balances.set(id, { debitIQD: 0, creditIQD: 0, debitUSD: 0, creditUSD: 0 });
    }

    if (accountIds.length === 0) {
      return balances;
    }

    const rows = await this.prisma.$queryRaw<Array<{
      accountId: string;
      debitIQD: Prisma.Decimal | number | null;
      creditIQD: Prisma.Decimal | number | null;
      debitUSD: Prisma.Decimal | number | null;
      creditUSD: Prisma.Decimal | number | null;
    }>>(Prisma.sql`
      SELECT
        l."accountId" AS "accountId",
        COALESCE(SUM(
          CASE
            WHEN UPPER(COALESCE(a.currency, '')) LIKE '%USD%'
              OR UPPER(COALESCE(l.description, '') || ' ' || COALESCE(j.description, '') || ' ' || COALESCE(j.reference, '')) LIKE '%USD%'
              OR COALESCE(l.description, '') || ' ' || COALESCE(j.description, '') || ' ' || COALESCE(j.reference, '') LIKE '%$%'
              OR COALESCE(l.description, '') || ' ' || COALESCE(j.description, '') || ' ' || COALESCE(j.reference, '') LIKE '%دولار%'
            THEN 0
            ELSE l.debit
          END
        ), 0) AS "debitIQD",
        COALESCE(SUM(
          CASE
            WHEN UPPER(COALESCE(a.currency, '')) LIKE '%USD%'
              OR UPPER(COALESCE(l.description, '') || ' ' || COALESCE(j.description, '') || ' ' || COALESCE(j.reference, '')) LIKE '%USD%'
              OR COALESCE(l.description, '') || ' ' || COALESCE(j.description, '') || ' ' || COALESCE(j.reference, '') LIKE '%$%'
              OR COALESCE(l.description, '') || ' ' || COALESCE(j.description, '') || ' ' || COALESCE(j.reference, '') LIKE '%دولار%'
            THEN 0
            ELSE l.credit
          END
        ), 0) AS "creditIQD",
        COALESCE(SUM(
          CASE
            WHEN UPPER(COALESCE(a.currency, '')) LIKE '%USD%'
              OR UPPER(COALESCE(l.description, '') || ' ' || COALESCE(j.description, '') || ' ' || COALESCE(j.reference, '')) LIKE '%USD%'
              OR COALESCE(l.description, '') || ' ' || COALESCE(j.description, '') || ' ' || COALESCE(j.reference, '') LIKE '%$%'
              OR COALESCE(l.description, '') || ' ' || COALESCE(j.description, '') || ' ' || COALESCE(j.reference, '') LIKE '%دولار%'
            THEN l.debit
            ELSE 0
          END
        ), 0) AS "debitUSD",
        COALESCE(SUM(
          CASE
            WHEN UPPER(COALESCE(a.currency, '')) LIKE '%USD%'
              OR UPPER(COALESCE(l.description, '') || ' ' || COALESCE(j.description, '') || ' ' || COALESCE(j.reference, '')) LIKE '%USD%'
              OR COALESCE(l.description, '') || ' ' || COALESCE(j.description, '') || ' ' || COALESCE(j.reference, '') LIKE '%$%'
              OR COALESCE(l.description, '') || ' ' || COALESCE(j.description, '') || ' ' || COALESCE(j.reference, '') LIKE '%دولار%'
            THEN l.credit
            ELSE 0
          END
        ), 0) AS "creditUSD"
      FROM journal_entry_lines l
      JOIN journal_entries j ON j.id = l."journalEntryId"
      JOIN accounts a ON a.id = l."accountId"
      WHERE l."accountId" IN (${Prisma.join(accountIds)})
        AND j."companyId" = ${companyId}
        AND j.status = 'POSTED'
      GROUP BY l."accountId"
    `);

    for (const row of rows) {
      balances.set(row.accountId, {
        debitIQD: Number(row.debitIQD || 0),
        creditIQD: Number(row.creditIQD || 0),
        debitUSD: Number(row.debitUSD || 0),
        creditUSD: Number(row.creditUSD || 0),
      });
    }

    return balances;
  }

  /**
   * الصناديق والبنوك وطرق الدفع: ما هو مسجَّل، لا ما يشبه الاسم.
   *
   * كانت هذه الدالة تجمع الحسابات بتخمين البادئات والأسماء — «كل ما يبدأ بـ2614»
   * و«كل اسم فيه ماستر أو كاش أو صندوق» — فظهرت في الصفحة 411 بطاقة، منها 363
   * حساب مجهِّز (2614 = مجهزون قطاع خاص) لا علاقة لها ببطاقات الدفع، وعشرات
   * حسابات عملاء تنتهي أسماؤها بكلمة «كاش».
   *
   * الآن لا تُعرض إلا الأشياء المسجَّلة صراحةً:
   *   • صفوف جدولَي Cashbox وBank،
   *   • الحسابات المصنَّفة CASH أو BANK في شجرة الحسابات،
   *   • والحسابات المرتبطة بطريقة دفع مفعّلة في إعدادات «ربط طرق الدفع بالصناديق».
   *
   * فبطاقة «ماستر كارد وكيل» تظهر لأنها طريقة دفع معرَّفة، وأخواتها الستّ اللواتي
   * يحملن كلمة «ماستر» في أسمائهنّ ولم يُعرَّفن لا تظهرن — وهذا هو الفرق بين
   * سجلٍّ محاسبي وبحثٍ بالاسم.
   */
  async getSummary(companyId: string) {
    const [cashboxes, banks, categorised, mappingTemplate] = await Promise.all([
      this.prisma.cashbox.findMany({
        where: { companyId },
        include: { account: true },
        orderBy: { code: 'asc' },
      }),
      this.prisma.bank.findMany({
        where: { companyId },
        include: { account: true },
        orderBy: { code: 'asc' },
      }),
      this.prisma.account.findMany({
        where: {
          companyId,
          isParent: false,
          category: { in: [AccountCategory.CASH, AccountCategory.BANK] },
        },
        orderBy: { code: 'asc' },
      }),
      this.prisma.printTemplate.findFirst({
        where: { companyId, docType: 'payment_methods_mapping' },
      }),
    ]);

    /*
     * حساب التبويب لا يُعرض بطاقةً؛ شجرةُ الحسابات نفسها تسمّيه «حساب أب» ولا
     * تُرحّل عليه، فتتبعها هذه الصفحة بالراية ذاتها كي لا تختلف الشاشتان.
     */
    const leafAccounts = categorised;

    // طرق الدفع المعرَّفة والمفعّلة وحدها، وما ارتبط منها بحسابٍ حقيقي.
    const methodTypeByAccount = new Map<string, 'MASTER' | 'CASHBOX' | 'BANK'>();
    try {
      const raw = (mappingTemplate as any)?.config;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const mappings: any[] = Array.isArray(parsed?.mappings) ? parsed.mappings : [];
      for (const m of mappings) {
        if (m?.isActive === false) continue;
        const target = String(m?.targetAccountId || '').trim();
        // القيم الرمزية مثل EMPLOYEE_ASSIGNED ليست حساباً، فلا بطاقة لها.
        if (!target || !/^[0-9a-f-]{20,}$/i.test(target)) continue;
        const type = String(m?.type || '').toUpperCase();
        methodTypeByAccount.set(
          target,
          type === 'BANK' ? 'BANK' : type === 'CASH' ? 'CASHBOX' : 'MASTER',
        );
      }
    } catch {
      /* إعدادٌ تالف لا يُسقط الصفحة: تُعرض الصناديق المصنَّفة وحدها */
    }

    const methodAccounts = methodTypeByAccount.size
      ? await this.prisma.account.findMany({
          where: { companyId, id: { in: Array.from(methodTypeByAccount.keys()) } },
          orderBy: { code: 'asc' },
        })
      : [];

    const allAccountIds = Array.from(
      new Set(
        [
          ...cashboxes.map((c) => c.accountId || c.account?.id),
          ...banks.map((b) => b.accountId || b.account?.id),
          ...leafAccounts.map((a) => a.id),
          ...methodAccounts.map((a) => a.id),
        ].filter(Boolean),
      ),
    ) as string[];

    const balances = await this.getAccountBalances(companyId, allAccountIds);
    const map = new Map<string, any>();

    const buildItem = (
      entity: any,
      account: any,
      itemType: 'CASHBOX' | 'BANK' | 'MASTER',
      source: string,
    ) => {
      const accId = entity.accountId || account?.id;
      const code = entity.code || account?.code;
      const balance = accId ? balances.get(accId) : undefined;
      const netIQD = (balance?.debitIQD || 0) - (balance?.creditIQD || 0);
      const netUSD = (balance?.debitUSD || 0) - (balance?.creditUSD || 0);

      return {
        id: entity.id || accId,
        code,
        nameAr: entity.nameAr || account?.nameAr,
        nameEn: entity.nameEn || account?.nameEn,
        bankName: entity.bankName,
        accountNumber: entity.accountNumber,
        iban: entity.iban,
        accountId: accId,
        itemType,
        /** من أين جاءت البطاقة: سجل الصناديق، أو تصنيف الشجرة، أو طريقة دفع معرَّفة. */
        source,
        balance: netIQD !== 0 ? netIQD : netUSD,
        balanceIQD: netIQD,
        balanceUSD: netUSD,
        currency: account?.currency || (netUSD !== 0 ? 'USD' : 'IQD'),
        trendData: [],
        account,
      };
    };

    for (const c of cashboxes) {
      const key = c.account?.code || c.code;
      if (key) map.set(key, buildItem(c, c.account, 'CASHBOX', 'CASHBOX_REGISTRY'));
    }

    for (const b of banks) {
      const key = b.account?.code || b.code;
      if (key && !map.has(key)) map.set(key, buildItem(b, b.account, 'BANK', 'BANK_REGISTRY'));
    }

    for (const a of leafAccounts) {
      if (map.has(a.code)) continue;
      map.set(
        a.code,
        buildItem(a, a, a.category === AccountCategory.BANK ? 'BANK' : 'CASHBOX', 'ACCOUNT_CATEGORY'),
      );
    }

    for (const a of methodAccounts) {
      if (map.has(a.code)) continue;
      map.set(a.code, buildItem(a, a, methodTypeByAccount.get(a.id) || 'MASTER', 'PAYMENT_METHOD'));
    }

    return Array.from(map.values());
  }

  async getCashboxes(companyId: string) {
    const cashboxes = await this.prisma.cashbox.findMany({
      where: { companyId },
      include: { account: true },
      orderBy: { code: 'asc' },
    });

    const cashAccounts = await this.prisma.account.findMany({
      where: {
        companyId,
        AND: [
          { isParent: false },
          {
            OR: [
              { category: AccountCategory.CASH },
              { code: { startsWith: '1341' } },
              { code: { startsWith: '1343' } },
              { code: { startsWith: '134213' } },
              { code: { startsWith: '232146' } },
              { code: { startsWith: '2614' } },
              { code: { startsWith: '1111' } },
              { code: { startsWith: '181' } },
              { code: { startsWith: '183' } },
              { nameAr: { contains: 'ماستر' } },
              { nameAr: { contains: 'Master' } },
              { nameAr: { contains: 'صندوق' } },
              { nameAr: { contains: 'قاصة' } },
              { nameAr: { contains: 'كاش' } },
            ],
          },
        ],
      },
      orderBy: { code: 'asc' },
    });

    const allAccountIds = Array.from(new Set([
      ...cashboxes.map(c => c.accountId || c.account?.id).filter(Boolean),
      ...cashAccounts.map(a => a.id),
    ])) as string[];

    const balances = await this.getAccountBalances(companyId, allAccountIds);

    const map = new Map<string, any>();
    for (const c of cashboxes) {
      const codeKey = c.account?.code || c.code;
      const accId = c.accountId || c.account?.id;
      const b = accId ? balances.get(accId) : { debitIQD: 0, creditIQD: 0, debitUSD: 0, creditUSD: 0 };
      const netIQD = (b?.debitIQD || 0) - (b?.creditIQD || 0);
      const netUSD = (b?.debitUSD || 0) - (b?.creditUSD || 0);

      map.set(codeKey, {
        id: c.id,
        code: c.code || c.account?.code,
        nameAr: c.nameAr || c.account?.nameAr,
        nameEn: c.nameEn || c.account?.nameEn,
        accountId: accId,
        balance: netIQD !== 0 ? netIQD : netUSD,
        balanceIQD: netIQD,
        balanceUSD: netUSD,
        currency: c.account?.currency || (netUSD !== 0 ? 'USD' : 'IQD'),
        trendData: [],
        account: c.account,
      });
    }

    for (const a of cashAccounts) {
      if (!map.has(a.code)) {
        const b = balances.get(a.id) || { debitIQD: 0, creditIQD: 0, debitUSD: 0, creditUSD: 0 };
        const netIQD = (b?.debitIQD || 0) - (b?.creditIQD || 0);
        const netUSD = (b?.debitUSD || 0) - (b?.creditUSD || 0);

        map.set(a.code, {
          id: a.id,
          code: a.code,
          nameAr: a.nameAr,
          nameEn: a.nameEn,
          accountId: a.id,
          balance: netIQD !== 0 ? netIQD : netUSD,
          balanceIQD: netIQD,
          balanceUSD: netUSD,
          currency: a.currency || (netUSD !== 0 ? 'USD' : 'IQD'),
          trendData: [],
          account: a,
        });
      }
    }

    return Array.from(map.values());
  }

  async getBanks(companyId: string) {
    const banks = await this.prisma.bank.findMany({
      where: { companyId },
      include: { account: true },
      orderBy: { code: 'asc' },
    });

    const bankAccounts = await this.prisma.account.findMany({
      where: {
        companyId,
        AND: [
          { isParent: false },
          {
            OR: [
              { category: AccountCategory.BANK },
              { code: { startsWith: '1342' } },
              { code: { startsWith: '1343' } },
              { code: { startsWith: '232146' } },
              { code: { startsWith: '2614' } },
              { code: { startsWith: '1112' } },
              { code: { startsWith: '182' } },
              { nameAr: { contains: 'مصرف' } },
              { nameAr: { contains: 'بنك' } },
              { nameAr: { contains: 'Bank' } },
            ],
          },
        ],
      },
      orderBy: { code: 'asc' },
    });

    const allAccountIds = Array.from(new Set([
      ...banks.map(b => b.accountId || b.account?.id).filter(Boolean),
      ...bankAccounts.map(a => a.id),
    ])) as string[];

    const balances = await this.getAccountBalances(companyId, allAccountIds);

    const map = new Map<string, any>();
    for (const b of banks) {
      const codeKey = b.account?.code || b.code;
      const accId = b.accountId || b.account?.id;
      const bal = accId ? balances.get(accId) : { debitIQD: 0, creditIQD: 0, debitUSD: 0, creditUSD: 0 };
      const netIQD = (bal?.debitIQD || 0) - (bal?.creditIQD || 0);
      const netUSD = (bal?.debitUSD || 0) - (bal?.creditUSD || 0);

      map.set(codeKey, {
        id: b.id,
        code: b.code || b.account?.code,
        nameAr: b.nameAr || b.account?.nameAr,
        nameEn: b.nameEn || b.account?.nameEn,
        bankName: (b as any).bankName,
        accountNumber: b.accountNumber,
        iban: b.iban,
        accountId: accId,
        balance: netIQD !== 0 ? netIQD : netUSD,
        balanceIQD: netIQD,
        balanceUSD: netUSD,
        currency: b.account?.currency || (netUSD !== 0 ? 'USD' : 'IQD'),
        trendData: [],
        account: b.account,
      });
    }

    for (const a of bankAccounts) {
      if (!map.has(a.code)) {
        const bal = balances.get(a.id) || { debitIQD: 0, creditIQD: 0, debitUSD: 0, creditUSD: 0 };
        const netIQD = (bal?.debitIQD || 0) - (bal?.creditIQD || 0);
        const netUSD = (bal?.debitUSD || 0) - (bal?.creditUSD || 0);

        map.set(a.code, {
          id: a.id,
          code: a.code,
          nameAr: a.nameAr,
          nameEn: a.nameEn,
          accountId: a.id,
          balance: netIQD !== 0 ? netIQD : netUSD,
          balanceIQD: netIQD,
          balanceUSD: netUSD,
          currency: a.currency || (netUSD !== 0 ? 'USD' : 'IQD'),
          trendData: [],
          account: a,
        });
      }
    }

    return Array.from(map.values());
  }

  async createCashbox(companyId: string, data: { code: string; nameAr: string; nameEn?: string }) {
    const existing = await this.prisma.cashbox.findUnique({
      where: { companyId_code: { companyId, code: data.code } },
    });
    if (existing) throw new BadRequestException(`كود الصندوق (${data.code}) مستخدم مسبقاً`);

    // Find cash category parent account
    const parentCategory = await this.prisma.account.findFirst({
      where: { companyId, code: '1110' },
    });

    return this.prisma.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: {
          code: `1111-${data.code}`,
          nameAr: `صندوق: ${data.nameAr}`,
          nameEn: data.nameEn ? `Cash: ${data.nameEn}` : `Cash: ${data.nameAr}`,
          type: AccountType.ASSET,
          category: AccountCategory.CASH,
          isParent: false,
          parentId: parentCategory?.id || null,
          level: 4,
          companyId,
        },
      });

      return tx.cashbox.create({
        data: {
          code: data.code,
          nameAr: data.nameAr,
          nameEn: data.nameEn || data.nameAr,
          accountId: account.id,
          companyId,
        },
        include: { account: true },
      });
    });
  }

  async createBank(companyId: string, data: { code: string; nameAr: string; nameEn?: string; accountNumber?: string; iban?: string }) {
    const existing = await this.prisma.bank.findUnique({
      where: { companyId_code: { companyId, code: data.code } },
    });
    if (existing) throw new BadRequestException(`كود البنك (${data.code}) مستخدم مسبقاً`);

    const parentCategory = await this.prisma.account.findFirst({
      where: { companyId, code: '1110' },
    });

    return this.prisma.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: {
          code: `1112-${data.code}`,
          nameAr: `بنك: ${data.nameAr}`,
          nameEn: data.nameEn ? `Bank: ${data.nameEn}` : `Bank: ${data.nameAr}`,
          type: AccountType.ASSET,
          category: AccountCategory.BANK,
          isParent: false,
          parentId: parentCategory?.id || null,
          level: 4,
          companyId,
        },
      });

      return tx.bank.create({
        data: {
          code: data.code,
          nameAr: data.nameAr,
          nameEn: data.nameEn || data.nameAr,
          accountNumber: data.accountNumber || null,
          iban: data.iban || null,
          accountId: account.id,
          companyId,
        },
        include: { account: true },
      });
    });
  }

  /**
   * صندوق الشركة الرئيسي — بحثٌ متينٌ لا قائمةُ أكوادٍ ثابتة.
   *
   * كان يُبحث عنه بأكواد محفوظة في الكود (13411، 11011) واسمٍ مفرد «صندوق حسابات
   * الشركة»؛ فحين اختلف الترقيم في شركةٍ (قاصتها 181021 باسم «صندوق حسابات
   * الشركات القاصة») لم يُوجد، فيسقط التحصيل كلّه بخطأ 404 غامض. الآن يُطابَق
   * الجذر المشترك «حسابات الشرك» (يشمل الشركة والشركات) و«القاصة»، مع بقاء
   * الأكواد القديمة أولاً — فأي شجرةٍ معقولة تُصيب صندوقها الرئيسي.
   */
  private async resolveMainCashbox(companyId?: string) {
    const scope = companyId ? { companyId } : {};
    const byCode = await this.prisma.account.findFirst({
      where: { ...scope, isParent: false, code: { in: ['13411', '1341101', '11011', '181021'] } },
    });
    if (byCode) return byCode;

    const byName = await this.prisma.account.findFirst({
      where: {
        ...scope,
        isParent: false,
        OR: [
          { nameAr: { contains: 'حسابات الشرك' } },
          { nameAr: { contains: 'القاصة' } },
          { nameAr: { contains: 'الصندوق الرئيسي' } },
        ],
      },
      orderBy: { code: 'asc' },
    });
    return byName;
  }

  async settleVoucher(
    companyId: string,
    userId: string,
    dto: { voucherId: string; voucherNumber?: string; isSettled: boolean; destinationBoxId?: string },
  ) {
    const { voucherId, isSettled } = dto;

    // القاصة الوجهة: ما يختاره المستخدم إن حُدِّد، وإلا القاصة الرئيسية المستنتَجة.
    const mainBoxAcc = dto.destinationBoxId
      ? await this.prisma.account.findUnique({ where: { id: dto.destinationBoxId } })
      : await this.resolveMainCashbox(companyId);
    if (!mainBoxAcc) {
      throw new NotFoundException(
        'تعذّر تحديد صندوق الشركة الرئيسي في شجرة الحسابات. عيّنه من إعدادات النظام (الحساب المخصص للقاصة الرئيسية) ثم أعد المحاولة.',
      );
    }

    // Find the voucher in ReceiptVoucher or PaymentVoucher
    const [receipt, payment] = await Promise.all([
      this.prisma.receiptVoucher.findUnique({
        where: { id: voucherId },
        include: { account: true },
      }),
      this.prisma.paymentVoucher.findUnique({
        where: { id: voucherId },
        include: { account: true },
      }),
    ]);

    const voucher = receipt || payment;
    const isReceipt = Boolean(receipt);

    if (!voucher) {
      throw new NotFoundException('السند المالي غير موجود');
    }

    const subBoxId = voucher.cashboxOrBankAccountId;
    if (!subBoxId || subBoxId === mainBoxAcc.id) {
      return { success: true, message: 'لا يتطلب توريد لأنه على الصندوق الرئيسي مباشرة' };
    }

    const subBoxAcc = await this.prisma.account.findUnique({ where: { id: subBoxId } });
    const partyName = voucher.account?.nameAr || 'الطرف المقابل';
    const amount = Number(voucher.amount) || 0;
    const ref = `CLR-${voucher.voucherNumber || dto.voucherNumber}`;

    if (isSettled) {
      // Check if already settled
      const existing = await this.prisma.journalEntry.findFirst({
        where: { reference: ref },
      });
      if (existing) {
        return { success: true, message: 'السند محصل مسبقاً', entryNumber: existing.entryNumber };
      }

      // Create Clearance Journal Entry in transaction
      return this.prisma.$transaction(async (tx) => {
        const year = new Date().getFullYear();
        const count = await tx.journalEntry.count();
        const entryNumber = `JV-${year}-${String(count + 1).padStart(4, '0')}`;

        const debitAccId = isReceipt ? mainBoxAcc.id : subBoxId;
        const creditAccId = isReceipt ? subBoxId : mainBoxAcc.id;

        const je = await tx.journalEntry.create({
          data: {
            entryNumber,
            date: new Date(),
            reference: ref,
            description: `تحصيل وتوريد ${isReceipt ? 'سند قبض' : 'سند دفع'} [${voucher.voucherNumber}] (${partyName}) بمبلغ ${amount.toLocaleString()} د.ع من [${subBoxAcc?.nameAr || 'الصندوق الفرعي'}] إلى [${mainBoxAcc.nameAr}]`,
            status: 'POSTED',
            totalDebit: new Prisma.Decimal(amount),
            totalCredit: new Prisma.Decimal(amount),
            companyId: voucher.companyId || companyId || 'default-company-id',
            createdById: userId || 'fa622c30-024a-4281-83a9-ed31dd84d47a',
            postedById: userId || 'fa622c30-024a-4281-83a9-ed31dd84d47a',
            lines: {
              create: [
                {
                  accountId: debitAccId,
                  debit: new Prisma.Decimal(amount),
                  credit: new Prisma.Decimal(0),
                  description: `استلام تحصيل نقدية في قاصة الشركة الرئيسية - سند ${voucher.voucherNumber} (${partyName})`,
                },
                {
                  accountId: creditAccId,
                  debit: new Prisma.Decimal(0),
                  credit: new Prisma.Decimal(amount),
                  description: `توريد نقدية من الصندوق الفرعي (${subBoxAcc?.nameAr || 'الفرعي'}) - سند ${voucher.voucherNumber} (${partyName})`,
                },
              ],
            },
          },
        });

        // Update balances: Main Box increases (+amount), Sub Box decreases (-amount)
        if (isReceipt) {
          await tx.account.update({
            where: { id: mainBoxAcc.id },
            data: { balance: { increment: new Prisma.Decimal(amount) } },
          });
          await tx.account.update({
            where: { id: subBoxId },
            data: { balance: { decrement: new Prisma.Decimal(amount) } },
          });
        } else {
          await tx.account.update({
            where: { id: subBoxId },
            data: { balance: { increment: new Prisma.Decimal(amount) } },
          });
          await tx.account.update({
            where: { id: mainBoxAcc.id },
            data: { balance: { decrement: new Prisma.Decimal(amount) } },
          });
        }

        return { success: true, isSettled: true, entryNumber: je.entryNumber };
      });
    } else {
      // Revert settlement
      const existingEntries = await this.prisma.journalEntry.findMany({
        where: { reference: ref },
        include: { lines: true },
      });

      if (existingEntries.length === 0) {
        return { success: true, isSettled: false };
      }

      return this.prisma.$transaction(async (tx) => {
        for (const e of existingEntries) {
          for (const line of e.lines) {
            const deb = Number(line.debit) || 0;
            const cred = Number(line.credit) || 0;
            const chg = deb - cred;
            await tx.account.update({
              where: { id: line.accountId },
              data: { balance: { decrement: new Prisma.Decimal(chg) } },
            }).catch(() => {});
          }

          await tx.journalEntryLine.deleteMany({ where: { journalEntryId: e.id } });
          await tx.journalEntry.delete({ where: { id: e.id } });
        }
        return { success: true, isSettled: false };
      });
    }
  }

  async settleBatchVouchers(
    companyId: string,
    userId: string,
    dto: { voucherIds: string[]; sourceBoxId?: string; destinationBoxId?: string },
  ) {
    const results: any[] = [];
    for (const vId of dto.voucherIds) {
      const res = await this.settleVoucher(companyId, userId, {
        voucherId: vId,
        isSettled: true,
        destinationBoxId: dto.destinationBoxId,
      });
      results.push(res);
    }
    return { success: true, count: results.length };
  }
}
