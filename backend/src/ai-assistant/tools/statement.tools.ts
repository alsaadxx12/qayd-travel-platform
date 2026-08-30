import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportsService } from '../../reports/reports.service';
import { EmailService } from '../../email/email.service';
import { StatementPdfService } from '../../pdf/statement-pdf.service';
import { StatementRow } from '../../pdf/template.service';
import { AiRequestContext, AiTool, AiToolResult, AiToolProvider, AiUiBlock } from '../types/ai-tool.types';
import { resolvePeriod, round2, toNumber } from './tool-utils';
import { EntityTools } from './entity.tools';
import { StatementArtifactService } from '../core/statement-artifact.service';

const EMAIL_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

function formatEnGb(value: Date | string | null | undefined): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-GB');
}

function mapPassengerType(raw?: string | null): 'ADT' | 'CHD' | 'INF' {
  const u = (raw || '').toUpperCase();
  if (u === 'CHD' || u === 'CHILD') return 'CHD';
  if (u === 'INF' || u === 'INFANT') return 'INF';
  return 'ADT';
}

function isValidEmail(value?: string | null): value is string {
  if (!value) return false;
  return EMAIL_RE.test(value.trim());
}

/**
 * Official statement PDF + Brevo email, using the same print template and
 * send-statement service as the reports page (تصدير كشف PDF / إرسال الكشف).
 */
@Injectable()
export class StatementTools implements AiToolProvider {
  private readonly logger = new Logger(StatementTools.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
    private readonly entityTools: EntityTools,
    private readonly statementPdf: StatementPdfService,
    private readonly email: EmailService,
    private readonly artifacts: StatementArtifactService,
  ) {}

  getTools(): AiTool[] {
    return [
      {
        name: 'exportAccountStatementPdf',
        description:
          'صدّر كشف حساب PDF بنفس قالب الطباعة المعتمد (تصدير كشف PDF). استخدمها بعد اختيار العميل/الشركة أو عند طلب «كشف PDF». Export the official account statement PDF using the saved print template.',
        parameters: {
          type: 'object',
          properties: {
            accountId: { type: 'string', description: 'معرّف الحساب من searchEntity أو اختيار المستخدم' },
            entityId: { type: 'string', description: 'معرّف العميل أو المورد إن لم يكن accountId هو حساب دفتر' },
            kind: { type: 'string', description: 'customer أو supplier أو account' },
            query: { type: 'string', description: 'اسم العميل أو الشركة إن لم يتوفر accountId' },
            period: { type: 'string', enum: ['TODAY', 'WEEK', 'MONTH', 'LAST_MONTH', 'QUARTER', 'YEAR', 'FISCAL_YEAR'] },
            startDate: { type: 'string', description: 'YYYY-MM-DD' },
            endDate: { type: 'string', description: 'YYYY-MM-DD' },
          },
          additionalProperties: false,
        },
        requiredPermissions: ['reports.statement.print', 'reports.statement.view'],
        sensitivity: 'read',
        handler: (args, ctx) => this.exportPdf(args, ctx),
      },
      {
        name: 'emailAccountStatement',
        description:
          'أرسل كشف الحساب الرسمي كملف PDF مرفق فقط عبر Brevo. لا تضع أرصدة أو حركات أو ملخصاً في نص الرسالة. لا ترسل قبل موافقة المستخدم (confirm=true).',
        parameters: {
          type: 'object',
          properties: {
            accountId: { type: 'string' },
            entityId: { type: 'string' },
            kind: { type: 'string' },
            query: { type: 'string', description: 'اسم العميل أو الشركة إن لم يتوفر accountId' },
            recipientEmail: { type: 'string', description: 'بريد المستلم إن لم يكن محفوظاً على العميل' },
            confirm: { type: 'boolean', description: 'true فقط بعد أن يؤكد المستخدم الإرسال' },
            period: { type: 'string', enum: ['TODAY', 'WEEK', 'MONTH', 'LAST_MONTH', 'QUARTER', 'YEAR', 'FISCAL_YEAR'] },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
          },
          additionalProperties: false,
        },
        requiredPermissions: ['reports.statement.sendEmail', 'reports.statement.print', 'reports.statement.view'],
        sensitivity: 'write',
        handler: (args, ctx) => this.emailStatement(args, ctx),
      },
    ];
  }

  private async exportPdf(args: any, ctx: AiRequestContext): Promise<AiToolResult> {
    const resolved = await this.resolveAccount(args, ctx);
    if (!resolved.ok) return resolved.result;

    try {
      const built = await this.buildOfficialStatement(resolved.accountId, args, ctx);
      const generated = await this.statementPdf.generate(ctx.companyId, built.pdf);
      const artifactId = this.artifacts.put({
        buffer: generated.buffer,
        companyId: ctx.companyId,
        userId: ctx.userId,
        filename: generated.downloadName,
      });

      return {
        ok: true,
        data: {
          account: { id: built.account.id, name: built.account.nameAr },
          period: built.period.label,
          startDate: built.period.startDate,
          endDate: built.period.endDate,
          movements: built.lineCount,
          closingBalance: round2(built.closingBalance),
          filename: generated.downloadName,
          artifactId,
        },
        ui: [
          this.kpiBlock(built),
          {
            type: 'pdf_file',
            payload: {
              artifactId,
              filename: generated.downloadName,
              accountName: built.account.nameAr,
              period: built.period.label,
              sizeBytes: generated.buffer.length,
              closingBalance: round2(built.closingBalance),
            },
          },
        ],
        suggestions: ['أرسل الكشف بالإيميل', 'كشف الحساب', 'رصيده'],
        note: `تم تجهيز كشف PDF لـ «${built.account.nameAr}» بنفس قالب الطباعة المعتمد.`,
      };
    } catch (err: any) {
      const errMsg = err?.message || '';
      const message = errMsg.includes('Chrome') || errMsg.includes('Chromium') || errMsg.includes('browser')
        ? 'محرك PDF السحابي غير متوفر حالياً على هذا الخادم. يرجى استخدام زر الطباعة المباشر من واجهة كشف الحساب.'
        : err?.message || 'تعذر توليد كشف PDF';
      return {
        ok: false,
        data: { message },
        note: message,
      };
    }
  }

  private async emailStatement(args: any, ctx: AiRequestContext): Promise<AiToolResult> {
    const resolved = await this.resolveAccount(args, ctx);
    if (!resolved.ok) return resolved.result;

    let built: Awaited<ReturnType<StatementTools['buildOfficialStatement']>>;
    try {
      built = await this.buildOfficialStatement(resolved.accountId, args, ctx);
    } catch (err: any) {
      return {
        ok: false,
        data: { sent: false, message: err?.message || 'تعذر تجهيز كشف الحساب للإرسال' },
        note: err?.message || 'تعذر تجهيز كشف الحساب للإرسال. تحقق من اختيار العميل ثم أعد المحاولة.',
      };
    }
    const typedEmail = typeof args.recipientEmail === 'string' ? args.recipientEmail.trim() : '';
    const recipientEmail = isValidEmail(typedEmail) ? typedEmail : built.contact.email || '';
    const recipientName = built.contact.name || built.account.nameAr;
    const confirm = args.confirm === true;

    if (!isValidEmail(recipientEmail)) {
      return {
        ok: true,
        data: {
          sent: false,
          needsRecipientEmail: true,
          account: { id: built.account.id, name: built.account.nameAr },
          period: built.period.label,
          closingBalance: round2(built.closingBalance),
        },
        ui: [
          this.kpiBlock(built),
          {
            type: 'email_confirm',
            payload: {
              accountId: built.account.id,
              accountName: built.account.nameAr,
              kind: resolved.kind,
              entityId: resolved.entityId,
              recipientEmail: '',
              recipientName,
              period: built.period.label,
              closingBalance: round2(built.closingBalance),
              needsRecipientEmail: true,
            },
          },
        ],
        suggestions: [],
        note: `لا يوجد بريد محفوظ لـ «${built.account.nameAr}». أدخل الإيميل ثم أكّد الإرسال.`,
      };
    }

    // Auto-send: when the email comes from the saved entity record (not manually
    // typed by the user), skip the confirmation step and send immediately.
    // If the user explicitly typed a recipientEmail, still confirm to guard
    // against typos.
    const emailFromRecord = !isValidEmail(typedEmail) && isValidEmail(built.contact.email);
    if (!confirm && !emailFromRecord) {
      return {
        ok: true,
        data: {
          sent: false,
          needsConfirmation: true,
          recipientEmail,
          account: { id: built.account.id, name: built.account.nameAr },
          period: built.period.label,
          closingBalance: round2(built.closingBalance),
        },
        ui: [
          this.kpiBlock(built),
          {
            type: 'email_confirm',
            payload: {
              accountId: built.account.id,
              accountName: built.account.nameAr,
              kind: resolved.kind,
              entityId: resolved.entityId,
              recipientEmail,
              recipientName,
              period: built.period.label,
              closingBalance: round2(built.closingBalance),
              needsRecipientEmail: false,
            },
          },
        ],
        suggestions: ['نعم أرسل الكشف', 'كشف PDF'],
        note: `جاهز لإرسال كشف «${built.account.nameAr}» إلى ${recipientEmail}. أكّد الإرسال.`,
      };
    }

    /**
     * The statement is rendered and mailed by the BROWSER, not here.
     *
     * Two reasons, and the second is the stronger one. A server-side PDF needs a
     * headless browser that a deployment may not have — but even where it does, the
     * server renders its own Handlebars template, a different document from the sheet
     * the accountant approves on the statement screen. Sending a customer a statement
     * that does not look like the one the staff exported is a defect regardless of
     * whether Chromium is installed.
     *
     * So the tool hands over the data and the front-end draws the same component the
     * statement page prints, turns it into a PDF the same way, and posts it to the same
     * email endpoint. One document, one code path, no browser on the server.
     */
    return {
      ok: true,
      data: {
        sent: false,
        handedToClient: true,
        recipientEmail,
        account: { id: built.account.id, name: built.account.nameAr },
        period: built.period.label,
      },
      ui: [
        {
          type: 'statement_email_client',
          payload: {
            accountName: built.account.nameAr,
            accountCode: built.account.code || undefined,
            accountPhone: built.contact?.phone || undefined,
            accountEmail: built.contact?.email || undefined,
            accountAddress: built.contact?.address || undefined,
            recipientEmail,
            recipientName,
            startDate: built.pdf.startDate,
            endDate: built.pdf.endDate,
            periodLabel: built.period.label,
            rows: built.pdf.rows,
            totals: built.pdf.totals,
          },
        },
      ],
      suggestions: ['كشف PDF', 'رصيده'],
      note: `جارٍ توليد كشف «${built.account.nameAr}» وإرساله إلى ${recipientEmail}.`,
    };
  }

  private async lookupLedgerAccount(
    companyId: string,
    id: string,
  ): Promise<{ accountId: string; kind: string; entityId: string } | null> {
    const trimmed = String(id || '').trim();
    if (!trimmed) return null;

    const [account, customer, supplier] = await Promise.all([
      this.prisma.account.findFirst({ where: { id: trimmed, companyId }, select: { id: true } }),
      this.prisma.customer.findFirst({
        where: { companyId, OR: [{ id: trimmed }, { accountId: trimmed }] },
        select: { id: true, accountId: true },
      }),
      this.prisma.supplier.findFirst({
        where: { companyId, OR: [{ id: trimmed }, { accountId: trimmed }] },
        select: { id: true, accountId: true },
      }),
    ]);

    if (customer) return { accountId: customer.accountId, kind: 'customer', entityId: customer.id };
    if (supplier) return { accountId: supplier.accountId, kind: 'supplier', entityId: supplier.id };
    if (account) return { accountId: account.id, kind: 'account', entityId: account.id };
    return null;
  }

  private async resolveAccount(
    args: any,
    ctx: AiRequestContext,
  ): Promise<
    | { ok: true; accountId: string; kind: string; entityId: string }
    | { ok: false; result: AiToolResult }
  > {
    const candidates = [String(args.accountId || '').trim(), String(args.entityId || '').trim()].filter(Boolean);

    for (const item of [...(ctx.memory || [])].reverse()) {
      if (item.kind !== 'account' && item.kind !== 'customer' && item.kind !== 'supplier') continue;
      const extraId = String(item.extra?.accountId || '').trim();
      if (extraId) candidates.push(extraId);
      if (item.id) candidates.push(item.id);
    }

    const seen = new Set<string>();
    for (const id of candidates) {
      if (seen.has(id)) continue;
      seen.add(id);
      const hit = await this.lookupLedgerAccount(ctx.companyId, id);
      if (hit) return { ok: true, ...hit };
    }

    const query = String(args.query || '').trim();

    // Also try the label from the last selected memory entity as a search query
    const memoryLabel = [...(ctx.memory || [])].reverse()
      .find((m) => m.kind === 'account' || m.kind === 'customer' || m.kind === 'supplier')?.label || '';

    const effectiveQuery = query && !/^(pdf|email|\u0627\u0644\u0625\u064a\u0645\u064a\u0644|\u0627\u0644\u0627\u064a\u0645\u064a\u0644|\u0628\u0627\u0644\u0625\u064a\u0645\u064a\u0644|\u0628\u0627\u0644\u0627\u064a\u0645\u064a\u0644|\u0643\u0634\u0641|\u0627\u0631\u0633\u0644)$/i.test(query) ? query : memoryLabel;

    if (!effectiveQuery) {
      return {
        ok: false,
        result: {
          ok: false,
          data: {
            found: false,
            message: '\u062d\u062f\u062f \u0627\u0644\u0639\u0645\u064a\u0644 \u0623\u0648 \u0627\u0644\u0634\u0631\u0643\u0629 \u0623\u0648\u0644\u0627\u064b \u0645\u0646 \u0627\u0644\u0642\u0627\u0626\u0645\u0629\u060c \u062b\u0645 \u0627\u0637\u0644\u0628 \u0643\u0634\u0641 PDF \u0623\u0648 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0643\u0634\u0641 \u0628\u0627\u0644\u0625\u064a\u0645\u064a\u0644.',
          },
          note: '\u0644\u0645 \u064a\u064f\u062d\u062f\u062f \u062d\u0633\u0627\u0628 \u0644\u0644\u0643\u0634\u0641. \u0627\u062e\u062a\u0631 \u0627\u0644\u0639\u0645\u064a\u0644 \u0645\u0646 \u0646\u062a\u0627\u0626\u062c \u0627\u0644\u0628\u062d\u062b \u062b\u0645 \u0623\u0639\u062f \u0627\u0644\u0645\u062d\u0627\u0648\u0644\u0629.',
        },
      };
    }

    const searched = await this.entityTools.lookup(effectiveQuery, ctx, ['customer', 'supplier', 'account']);
    if (!searched.ok || !searched.data?.found) {
      return {
        ok: false,
        result: {
          ...searched,
          note: searched.note || searched.data?.message || 'لم أجد عميلاً أو شركة مطابقة لإصدار الكشف.',
        },
      };
    }
    if (searched.data.exact && searched.data.match?.accountId) {
      return {
        ok: true,
        accountId: String(searched.data.match.accountId),
        kind: String(searched.data.match.kind || 'account'),
        entityId: String(searched.data.match.id),
      };
    }
    if (searched.data.exact && searched.data.match?.kind === 'account' && searched.data.match?.id) {
      return {
        ok: true,
        accountId: String(searched.data.match.id),
        kind: 'account',
        entityId: String(searched.data.match.id),
      };
    }
    if (searched.data.exact && searched.data.match?.id) {
      const hit = await this.lookupLedgerAccount(ctx.companyId, String(searched.data.match.id));
      if (hit) return { ok: true, ...hit };
    }
    return {
      ok: false,
      result: {
        ...searched,
        note: searched.note || 'عدة نتائج مطابقة. اختر عميلاً واحداً ثم اطلب الكشف.',
        suggestions: searched.suggestions || ['اختر الشركة ثم أرسل الكشف'],
      },
    };
  }

  private async buildOfficialStatement(accountId: string, args: any, ctx: AiRequestContext) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, companyId: ctx.companyId },
      select: {
        id: true,
        code: true,
        nameAr: true,
        nameEn: true,
        phone: true,
        email: true,
        address: true,
      },
    });
    if (!account) {
      throw new Error('الحساب غير موجود ضمن هذه الشركة');
    }

    const period = resolvePeriod(args, ctx);
    const statement: any = await this.reports.getAccountStatement(
      ctx.companyId,
      account.id,
      period.startDate,
      period.endDate,
    );
    const contact = await this.loadContact(ctx.companyId, account);
    const lines = Array.isArray(statement?.lines) ? statement.lines : [];
    const ticketMap = await this.loadTicketsForLines(ctx.companyId, lines);
    const rows = this.toPdfRows(lines, statement?.openingBalance, ticketMap, ctx.locale);
    const totalDebit = round2(lines.reduce((s: number, l: any) => s + toNumber(l.debit), 0));
    const totalCredit = round2(lines.reduce((s: number, l: any) => s + toNumber(l.credit), 0));
    const opening = round2(statement?.openingBalance);
    const closing = round2(statement?.closingBalance);

    return {
      account,
      contact,
      period,
      lineCount: lines.length,
      closingBalance: closing,
      pdf: {
        accountName: account.nameAr,
        accountCode: account.code,
        accountPhone: contact.phone || account.phone || '',
        accountEmail: contact.email || account.email || '',
        accountAddress: contact.address || account.address || '',
        startDate: formatEnGb(period.startDate),
        endDate: formatEnGb(period.endDate),
        rows,
        totals: {
          totalDebit,
          totalCredit,
          finalBalance: closing,
          openingBalance: opening,
          previousBalance: opening,
        },
        lang: ctx.locale === 'en' ? ('en' as const) : ('ar' as const),
      },
    };
  }

  private async loadContact(companyId: string, account: { id: string; phone: string | null; email: string | null; address: string | null; nameAr: string }) {
    const [customer, supplier] = await Promise.all([
      this.prisma.customer.findFirst({
        where: { companyId, accountId: account.id },
        select: { nameAr: true, phone: true, email: true, address: true },
      }),
      this.prisma.supplier.findFirst({
        where: { companyId, accountId: account.id },
        select: { nameAr: true, phone: true, email: true, address: true },
      }),
    ]);
    const row = customer || supplier;
    return {
      name: row?.nameAr || account.nameAr,
      phone: row?.phone || account.phone || '',
      email: (row?.email || account.email || '').trim(),
      address: row?.address || account.address || '',
    };
  }

  private async loadTicketsForLines(companyId: string, lines: any[]) {
    const ids = [
      ...new Set(
        lines
          .filter((l) => String(l.sourceType || '').toUpperCase() === 'TICKET' && l.sourceId)
          .map((l) => String(l.sourceId)),
      ),
    ];
    if (!ids.length) return new Map<string, any>();
    const tickets = await this.prisma.ticket.findMany({
      where: { companyId, id: { in: ids } },
      select: {
        id: true,
        pnr: true,
        route: true,
        invoiceNumber: true,
        passengers: { select: { name: true, ticketType: true } },
      },
    });
    return new Map(tickets.map((t) => [t.id, t]));
  }

  private toPdfRows(
    lines: any[],
    openingBalance: number,
    ticketMap: Map<string, any>,
    locale: 'ar' | 'en',
  ): StatementRow[] {
    const rows: StatementRow[] = [];
    let number = 1;
    const opening = round2(openingBalance);
    if (opening) {
      const debit = opening > 0 ? opening : 0;
      const credit = opening < 0 ? Math.abs(opening) : 0;
      rows.push({
        rowNumber: number++,
        date: '',
        docRef: 'OPENING',
        statement: locale === 'en' ? 'Opening balance' : 'الرصيد الافتتاحي',
        debit,
        credit,
        runningBalance: opening,
      });
    }

    for (const line of lines) {
      const ticket = line.sourceId ? ticketMap.get(String(line.sourceId)) : null;
      const passengers = (ticket?.passengers || []).map((p: { name: string; ticketType: string }) => {
        const type = mapPassengerType(p.ticketType);
        return {
          fullName: p.name || '',
          type,
          typeClass: type === 'INF' ? 'pax-type-inf' : type === 'CHD' ? 'pax-type-chd' : 'pax-type-adt',
          isChild: type !== 'ADT',
        };
      });
      rows.push({
        rowNumber: number++,
        date: formatEnGb(line.date),
        docRef: line.entryNumber || line.reference || '',
        pnr: ticket?.pnr || '',
        route: ticket?.route || '',
        statement: line.description || (locale === 'en' ? 'Posted movement' : 'حركة مرحّلة'),
        debit: round2(line.debit),
        credit: round2(line.credit),
        runningBalance: round2(line.runningBalance),
        passengers,
      });
    }
    return rows;
  }

  private kpiBlock(built: {
    account: { nameAr: string };
    period: { label: string };
    closingBalance: number;
    lineCount: number;
  }): AiUiBlock {
    return {
      type: 'kpi',
      payload: {
        title: `كشف ${built.account.nameAr} — ${built.period.label}`,
        items: [
          { label: 'الحركات', value: built.lineCount, type: 'count' },
          { label: 'الرصيد', value: round2(built.closingBalance), emphasis: true },
        ],
      },
    };
  }
}
