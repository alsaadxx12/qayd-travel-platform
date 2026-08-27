import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiRequestContext } from '../types/ai-tool.types';

export interface SystemModuleInfo {
  key: string;
  title: string;
  route: string;
  permission: string;
  summary: string;
}

/**
 * Dynamic knowledge layer: what the system can do and what actually exists in
 * this tenant's data. The module map describes code structure (routes/permissions),
 * while the rest is read live from the database and cached briefly.
 */
@Injectable()
export class SystemKnowledgeService {
  private readonly logger = new Logger(SystemKnowledgeService.name);
  private readonly cache = new Map<string, { at: number; value: any }>();
  private readonly ttlMs = 60_000;

  constructor(private readonly prisma: PrismaService) {}

  private static readonly MODULES: SystemModuleInfo[] = [
    { key: 'dashboard', title: 'لوحة التحكم', route: '/dashboard', permission: 'dashboard.view', summary: 'مؤشرات المبيعات والأرباح والحركة اليومية' },
    { key: 'tickets', title: 'التذاكر', route: '/tickets', permission: 'tickets.view', summary: 'فواتير تذاكر الطيران، المسافرون، PNR، البيع والتكلفة والربح' },
    { key: 'visas', title: 'التأشيرات', route: '/visas', permission: 'visas.view', summary: 'معاملات التأشيرات (مخزنة كتذاكر بنوع رحلة VISA)' },
    { key: 'hotels', title: 'الحجوزات الفندقية', route: '/hotels', permission: 'hotels.view', summary: 'الحجوزات الفندقية (مخزنة كتذاكر بنوع رحلة HOTEL)' },
    { key: 'groups', title: 'المجموعات', route: '/groups', permission: 'groups.view', summary: 'حجوزات المجموعات السياحية' },
    { key: 'refunds', title: 'الاسترجاعات', route: '/refunds', permission: 'refunds.view', summary: 'استرجاع التذاكر واحتساب الخصومات' },
    { key: 'reissues', title: 'التغييرات', route: '/reissues', permission: 'reissues.view', summary: 'إعادة إصدار وتغيير التذاكر' },
    { key: 'accounts', title: 'شجرة الحسابات', route: '/accounts', permission: 'accounts.view', summary: 'الدليل المحاسبي الهرمي، أنواع الحسابات، الأرصدة الافتتاحية' },
    { key: 'journal_entries', title: 'القيود اليومية', route: '/journal-entries', permission: 'journal.view', summary: 'القيود المحاسبية المدينة والدائنة وترحيلها وعكسها' },
    { key: 'vouchers', title: 'السندات', route: '/vouchers', permission: 'vouchers.view', summary: 'سندات القبض والدفع وربطها بالقيود' },
    { key: 'cashboxes_banks', title: 'الصناديق والبنوك', route: '/cashboxes-banks', permission: 'cashboxes.view', summary: 'أرصدة الصناديق النقدية والحسابات البنكية' },
    { key: 'sub_cashboxes', title: 'تسوية الصناديق الفرعية', route: '/sub-cashboxes-settlement', permission: 'subCashboxes.view', summary: 'تسوية سندات الصناديق الفرعية إلى الصندوق الرئيسي' },
    { key: 'partners', title: 'العملاء والموردون', route: '/partners', permission: 'partners.view', summary: 'العملاء والموردون وشركات الطيران وحساباتهم' },
    { key: 'external_clearings', title: 'المقاصات الخارجية', route: '/external-clearings', permission: 'clearings.view', summary: 'حسابات المقاصة الخارجية ومطابقتها' },
    { key: 'profits', title: 'الأرباح', route: '/profits', permission: 'profits.view', summary: 'تحليل الأرباح الشامل حسب الفرع والفترة والخدمة' },
    { key: 'debts_report', title: 'الذمم', route: '/debts-report', permission: 'debts.view', summary: 'أرصدة العملاء والموردين المدينة والدائنة بالدينار والدولار' },
    { key: 'reports', title: 'كشف الحساب', route: '/reports', permission: 'reports.statement.view', summary: 'كشف حساب تفصيلي بالحركات والرصيد الجاري' },
    { key: 'financial_reports', title: 'التقارير المالية', route: '/financial-reports', permission: 'financials.trialBalance', summary: 'ميزان المراجعة وقائمة الدخل والميزانية العمومية' },
    { key: 'fiscal_years', title: 'السنوات المالية', route: '/fiscal-years', permission: 'fiscal.view', summary: 'فتح وإقفال وإعادة فتح السنوات المالية' },
    { key: 'branches_structure', title: 'الفروع والموظفون', route: '/branches-structure', permission: 'branches.view', summary: 'هيكل الفروع والأقسام والموظفين' },
    { key: 'permission_groups', title: 'مجموعات الصلاحيات', route: '/permission-groups', permission: 'roles.view', summary: 'الأدوار والصلاحيات ونطاق الفروع' },
    { key: 'audit_logs', title: 'سجل العمليات', route: '/audit-logs', permission: 'settings.view', summary: 'سجل تدقيق لعمليات النظام' },
  ];

  getModules(ctx: AiRequestContext, hasPermission: (code: string) => boolean): SystemModuleInfo[] {
    return SystemKnowledgeService.MODULES.filter((m) => hasPermission(m.permission));
  }

  /** Live facts about this company's data, used to ground the model. */
  async getLiveFacts(companyId: string) {
    const cached = this.cache.get(companyId);
    if (cached && Date.now() - cached.at < this.ttlMs) return cached.value;

    const value = await this.loadLiveFacts(companyId);
    this.cache.set(companyId, { at: Date.now(), value });
    return value;
  }

  private async loadLiveFacts(companyId: string) {
    try {
      const [branches, rootAccounts, currencies, tripTypes, counts] = await Promise.all([
        this.prisma.branch.findMany({
          where: { companyId },
          select: { id: true, code: true, nameAr: true, isMain: true, status: true },
          orderBy: { isMain: 'desc' },
          take: 40,
        }),
        this.prisma.account.findMany({
          where: { companyId, level: 1 },
          select: { code: true, nameAr: true, type: true },
          orderBy: { code: 'asc' },
          take: 20,
        }),
        this.prisma.account
          .groupBy({ by: ['currency'], where: { companyId }, _count: { _all: true } })
          .catch(() => [] as any[]),
        this.prisma.ticket
          .groupBy({ by: ['tripType'], where: { companyId }, _count: { _all: true } })
          .catch(() => [] as any[]),
        Promise.all([
          this.prisma.account.count({ where: { companyId } }),
          this.prisma.ticket.count({ where: { companyId } }),
          this.prisma.customer.count({ where: { companyId } }),
          this.prisma.supplier.count({ where: { companyId } }),
        ]),
      ]);

      return {
        branches,
        rootAccounts,
        currencies: currencies.map((c: any) => c.currency).filter(Boolean),
        tripTypes: tripTypes.map((t: any) => t.tripType).filter(Boolean),
        totals: {
          accounts: counts[0],
          tickets: counts[1],
          customers: counts[2],
          suppliers: counts[3],
        },
      };
    } catch (err: any) {
      this.logger.warn(`Failed to load live system facts: ${err.message}`);
      return { branches: [], rootAccounts: [], currencies: [], tripTypes: [], totals: {} };
    }
  }

  async describe(ctx: AiRequestContext, hasPermission: (code: string) => boolean): Promise<string> {
    const facts = await this.getLiveFacts(ctx.companyId);
    const modules = this.getModules(ctx, hasPermission);

    const lines: string[] = [];
    lines.push('وحدات النظام المتاحة لهذا المستخدم:');
    lines.push(modules.map((m) => `- ${m.title} (${m.route}): ${m.summary}`).join('\n'));

    if (facts.branches?.length) {
      lines.push(
        `\nالفروع الموجودة فعليًا: ${facts.branches
          .map((b: any) => `${b.nameAr} [id=${b.id}${b.isMain ? ', رئيسي' : ''}]`)
          .join('، ')}`,
      );
    }

    if (facts.rootAccounts?.length) {
      lines.push(
        `\nجذور شجرة الحسابات: ${facts.rootAccounts
          .map((a: any) => `${a.code} ${a.nameAr} (${a.type})`)
          .join('، ')}`,
      );
    }

    if (facts.currencies?.length) {
      lines.push(`\nالعملات المستخدمة في الحسابات: ${facts.currencies.join('، ')}`);
    }

    if (facts.tripTypes?.length) {
      lines.push(`\nأنواع الخدمات الموجودة في التذاكر: ${facts.tripTypes.join('، ')}`);
    }

    lines.push(
      `\nملاحظات هيكلية مهمة: التأشيرات والفنادق والمجموعات والاسترجاعات كلها مخزنة في جدول التذاكر (tickets) ويميزها الحقل tripType. «تذكرة غير مسددة» تعني بيع آجل (paymentType = CREDIT أو آجل) وليس حالة المسافر «باقي» التي تعني عدم التسعير.`,
    );

    return lines.join('\n');
  }

  /** Quick prompts shown on the empty state, filtered by permission. */
  getQuickPrompts(hasPermission: (code: string) => boolean) {
    const all = [
      { text: 'كم مبيعاتنا اليوم؟', permission: 'dashboard.view', icon: 'sales' },
      { text: 'كم أرباح اليوم؟', permission: 'profits.view', icon: 'profit' },
      { text: 'اعرض التذاكر غير المسددة', permission: 'tickets.view', icon: 'ticket' },
      { text: 'من أكثر شركة مدينة لنا؟', permission: 'debts.view', icon: 'debt' },
      { text: 'أرصدة الصناديق والبنوك', permission: 'cashboxes.viewBalances', icon: 'cash' },
      { text: 'الذمم المستحقة على العملاء', permission: 'debts.view', icon: 'debt' },
      { text: 'قارن مبيعات هذا الشهر بالشهر السابق', permission: 'profits.view', icon: 'compare' },
      { text: 'كشف PDF لعميل', permission: 'reports.statement.print', icon: 'report' },
      { text: 'ابحث عن حجز برقم PNR', permission: 'tickets.view', icon: 'search' },
      { text: 'اعرض القيود غير المتوازنة', permission: 'journal.view', icon: 'report' },
      { text: 'سندات المصروف بالدولار', permission: 'vouchers.view', icon: 'voucher' },
    ];
    return all.filter((p) => hasPermission(p.permission)).slice(0, 7);
  }

  /** Fetch real customer/supplier names for voice recognition accuracy */
  async getEntityNames(companyId: string): Promise<string[]> {
    const cacheKey = `entity_names:${companyId}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.at < this.ttlMs * 5) return cached.value;

    const [customers, suppliers] = await Promise.all([
      this.prisma.customer.findMany({
        where: { companyId },
        select: { nameAr: true },
        take: 200,
      }),
      this.prisma.supplier.findMany({
        where: { companyId },
        select: { nameAr: true },
        take: 200,
      }),
    ]);

    const names = [
      ...customers.map((c) => c.nameAr),
      ...suppliers.map((s) => s.nameAr),
    ].filter(Boolean);

    this.cache.set(cacheKey, { at: Date.now(), value: names });
    return names;
  }
}
