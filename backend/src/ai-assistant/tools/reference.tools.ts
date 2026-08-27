import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiPermissionService } from '../core/ai-permission.service';
import { AiRequestContext, AiTool, AiToolResult, AiToolProvider } from '../types/ai-tool.types';
import { round2 } from './tool-utils';

type RefKind = 'ticket' | 'visa' | 'hotel' | 'refund' | 'group' | 'passenger' | 'receipt' | 'payment' | 'journal' | 'account';

const KIND_LABEL: Record<RefKind, string> = {
  ticket: 'تذكرة',
  visa: 'تأشيرة',
  hotel: 'حجز فندقي',
  refund: 'استرجاع',
  group: 'مجموعة',
  passenger: 'مسافر',
  receipt: 'سند قبض',
  payment: 'سند صرف',
  journal: 'قيد يومية',
  account: 'حساب',
};

function tripKind(tripType?: string | null): RefKind {
  const t = String(tripType || '').toUpperCase();
  if (t === 'VISA') return 'visa';
  if (t === 'HOTEL') return 'hotel';
  if (t === 'REFUND') return 'refund';
  if (t === 'GROUP') return 'group';
  return 'ticket';
}

interface RefHit {
  kind: RefKind;
  kindLabel: string;
  id: string;
  code: string;
  matchedField: string;
  title: string;
  detail: string;
  date?: string | null;
  amount?: number | null;
}

/**
 * One lookup for every reference code in the system.
 *
 * A user who pastes "PRMCK" or "0762300332188" or "LR4429416" does not know — and
 * should not have to say — whether that is a PNR, a ticket number or a passport.
 * Guessing the type from the shape of the string is unreliable (passport numbers and
 * PNRs overlap), so every code-bearing column is searched at once and the answer
 * says what was found and where.
 */
@Injectable()
export class ReferenceTools implements AiToolProvider {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: AiPermissionService,
  ) {}

  getTools(): AiTool[] {
    return [
      {
        name: 'findByReference',
        description:
          'ابحث برمز أو رقم واحد في كل عمليات وخدمات النظام دفعةً واحدة: PNR، رقم التذكرة، رقم الجواز أو الوثيقة، رقم الفاتورة، رقم السند، رقم القيد، رمز الحساب، وأي مرجع. ' +
          'استخدمها فوراً إذا أرسل المستخدم رمزاً أو رقماً وحده بلا سؤال (مثل PRMCK أو 0762300332188 أو LR4429416)، أو قال «دور على»، «شنو هذا الرقم»، «ابحث عن هذا الرمز». ' +
          'Universal reference lookup across tickets, visas, hotels, refunds, passengers, vouchers, journal entries and accounts.',
        parameters: {
          type: 'object',
          properties: {
            code: { type: 'string', description: 'الرمز أو الرقم كما أرسله المستخدم' },
          },
          required: ['code'],
          additionalProperties: false,
        },
        requiredPermissions: [],
        sensitivity: 'read',
        handler: (args, ctx) => this.findByReference(args, ctx),
      },
    ];
  }

  private async findByReference(args: any, ctx: AiRequestContext): Promise<AiToolResult> {
    const code = String(args?.code || '').trim();
    if (code.length < 2) {
      return { ok: false, data: { found: false, message: 'أرسل الرمز أو الرقم المراد البحث عنه' } };
    }

    const companyId = ctx.companyId;
    const like = { contains: code, mode: 'insensitive' as const };
    const branchIds = this.permissions.visibleBranchIds(ctx);
    const branchWhere = branchIds ? { branchId: { in: branchIds } } : {};

    const [tickets, passengers, receipts, payments, journals, accounts] = await Promise.all([
      this.prisma.ticket.findMany({
        where: {
          companyId,
          ...branchWhere,
          OR: [{ invoiceNumber: like }, { pnr: like }, { reference: like }],
        },
        select: {
          id: true, invoiceNumber: true, pnr: true, reference: true, tripType: true, route: true,
          customerName: true, issueDate: true, totalSell: true, currency: true,
        },
        orderBy: { issueDate: 'desc' },
        take: 8,
      }),
      this.prisma.ticketPassenger.findMany({
        where: {
          // TicketPassenger carries no companyId of its own — it is scoped through
          // its parent ticket. Missing this join would read other tenants' passengers.
          ticket: { companyId, ...branchWhere },
          OR: [{ ticketNumber: like }, { documentNumber: like }, { pnr: like }],
        },
        select: {
          id: true, name: true, ticketNumber: true, documentNumber: true, pnr: true, status: true,
          ticket: {
            select: { id: true, invoiceNumber: true, tripType: true, route: true, issueDate: true, customerName: true },
          },
        },
        take: 8,
      }),
      this.prisma.receiptVoucher.findMany({
        where: { companyId, OR: [{ voucherNumber: like }, { reference: like }] },
        select: { id: true, voucherNumber: true, reference: true, amount: true, date: true, description: true },
        orderBy: { date: 'desc' },
        take: 5,
      }),
      this.prisma.paymentVoucher.findMany({
        where: { companyId, OR: [{ voucherNumber: like }, { reference: like }] },
        select: { id: true, voucherNumber: true, reference: true, amount: true, currency: true, date: true, description: true },
        orderBy: { date: 'desc' },
        take: 5,
      }),
      this.prisma.journalEntry.findMany({
        where: { companyId, OR: [{ entryNumber: like }, { reference: like }] },
        select: { id: true, entryNumber: true, reference: true, description: true, date: true, totalDebit: true, status: true },
        orderBy: { date: 'desc' },
        take: 5,
      }),
      this.prisma.account.findMany({
        where: { companyId, code: like },
        select: { id: true, code: true, nameAr: true },
        take: 5,
      }),
    ]);

    const hits: RefHit[] = [];
    const day = (d: any) => (d ? new Date(d).toLocaleDateString('en-GB') : null);

    for (const t of tickets) {
      const kind = tripKind(t.tripType);
      hits.push({
        kind,
        kindLabel: KIND_LABEL[kind],
        id: t.id,
        code: t.invoiceNumber,
        matchedField: t.pnr && t.pnr.toLowerCase().includes(code.toLowerCase()) ? 'PNR' : 'رقم الفاتورة',
        title: t.customerName || t.invoiceNumber,
        detail: [t.route, t.pnr ? `PNR ${t.pnr}` : ''].filter(Boolean).join(' · '),
        date: day(t.issueDate),
        amount: round2(t.totalSell),
      });
    }

    for (const p of passengers) {
      const kind = tripKind(p.ticket?.tripType);
      const matched = p.documentNumber && p.documentNumber.toLowerCase().includes(code.toLowerCase())
        ? 'رقم الجواز/الوثيقة'
        : p.ticketNumber && p.ticketNumber.toLowerCase().includes(code.toLowerCase())
          ? 'رقم التذكرة'
          : 'PNR';
      hits.push({
        kind: 'passenger',
        kindLabel: `${KIND_LABEL.passenger} · ${KIND_LABEL[kind]}`,
        id: p.ticket?.id || p.id,
        code: p.ticketNumber || p.documentNumber || p.pnr || '',
        matchedField: matched,
        title: p.name,
        detail: [p.ticket?.invoiceNumber, p.ticket?.route, p.status].filter(Boolean).join(' · '),
        date: day(p.ticket?.issueDate),
        amount: null,
      });
    }

    for (const v of receipts) {
      hits.push({
        kind: 'receipt', kindLabel: KIND_LABEL.receipt, id: v.id, code: v.voucherNumber,
        matchedField: 'رقم السند', title: v.description || v.voucherNumber,
        detail: v.reference || '', date: day(v.date), amount: round2(v.amount),
      });
    }
    for (const v of payments) {
      hits.push({
        kind: 'payment', kindLabel: KIND_LABEL.payment, id: v.id, code: v.voucherNumber,
        matchedField: 'رقم السند', title: v.description || v.voucherNumber,
        detail: [v.reference, v.currency].filter(Boolean).join(' · '), date: day(v.date), amount: round2(v.amount),
      });
    }
    for (const j of journals) {
      hits.push({
        kind: 'journal', kindLabel: KIND_LABEL.journal, id: j.id, code: j.entryNumber,
        matchedField: 'رقم القيد', title: j.description || j.entryNumber,
        detail: [j.reference, j.status].filter(Boolean).join(' · '), date: day(j.date), amount: round2(j.totalDebit),
      });
    }
    for (const a of accounts) {
      hits.push({
        kind: 'account', kindLabel: KIND_LABEL.account, id: a.id, code: a.code,
        matchedField: 'رمز الحساب', title: a.nameAr, detail: '', date: null, amount: null,
      });
    }

    if (!hits.length) {
      return {
        ok: false,
        data: { found: false, code, message: `لم أجد «${code}» في التذاكر أو التأشيرات أو الفنادق أو الاسترجاع أو السندات أو القيود أو الحسابات.` },
        note: `لم أجد «${code}» في أي عملية مسجّلة.`,
        suggestions: ['ابحث بالاسم بدل الرمز', 'تحقق من الفرع'],
      };
    }

    return {
      ok: true,
      data: {
        found: true,
        code,
        count: hits.length,
        matches: hits.slice(0, 12).map((h) => ({
          type: h.kindLabel, code: h.code, matchedField: h.matchedField,
          title: h.title, detail: h.detail, date: h.date, amount: h.amount,
        })),
      },
      ui: [
        {
          type: 'table',
          payload: {
            title: `نتائج البحث عن «${code}»`,
            columns: [
              { key: 'type', label: 'النوع' },
              { key: 'code', label: 'الرقم' },
              { key: 'title', label: 'التفاصيل' },
              { key: 'matchedField', label: 'تطابق في' },
              { key: 'date', label: 'التاريخ' },
            ],
            rows: hits.slice(0, 12).map((h) => ({
              type: h.kindLabel,
              code: h.code || '—',
              title: [h.title, h.detail].filter(Boolean).join(' — '),
              matchedField: h.matchedField,
              date: h.date || '—',
            })),
            totalCount: hits.length,
          },
        },
      ],
      suggestions: hits.length === 1 ? ['تفاصيل العملية', 'كشف حساب العميل'] : ['اعرض التفاصيل'],
      note: `وجدت ${hits.length} نتيجة مرتبطة بـ «${code}».`,
    };
  }
}
