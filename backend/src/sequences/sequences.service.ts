import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SequenceConfigDto {
  docType: string;
  prefix: string;
  branchCode?: string;
  includeYear?: boolean;
  nextNumber?: number;
  padding?: number;
  separator?: string;
}

/**
 * أنواع المستندات المرقَّمة وبادئاتها الافتراضية.
 *
 * «الكروبات» نوع واحد لا نوعان: كان في الواجهة مفتاحان — groups وgroupFare —
 * ببادئة GRP نفسها وعدّادين منفصلين، فيتسابقان على الأرقام. وُحِّدا هنا في
 * groups، ويُقبل groupFare اسماً قديماً يُترجم إليه.
 */
const DEFAULTS: Array<{ docType: string; prefix: string; nameAr: string }> = [
  { docType: 'tickets', prefix: 'TKT', nameAr: 'فواتير تذاكر الطيران' },
  { docType: 'visas', prefix: 'VISA', nameAr: 'فواتير الفيزا والمعاملات' },
  { docType: 'groups', prefix: 'GRP', nameAr: 'فواتير الكروبات' },
  { docType: 'refunds', prefix: 'RFD', nameAr: 'فواتير الاسترجاع' },
  { docType: 'changes', prefix: 'CHG', nameAr: 'فواتير التغيير وإعادة الإصدار' },
  { docType: 'hotels', prefix: 'HTL', nameAr: 'حجوزات الفنادق' },
  { docType: 'baggage', prefix: 'WGT', nameAr: 'مبيعات الوزن الإضافي' },
  { docType: 'receiptVouchers', prefix: 'RV', nameAr: 'سندات القبض' },
  { docType: 'paymentVouchers', prefix: 'PV', nameAr: 'سندات الدفع' },
  // المصاريف تُحفظ سندات دفع، لكن ترقيمها مستقلّ كي لا يتداخل مع سندات الدفع العادية.
  { docType: 'expenses', prefix: 'EXP', nameAr: 'سندات المصاريف' },
  { docType: 'journalEntries', prefix: 'JV', nameAr: 'قيود اليومية' },
  { docType: 'exchange', prefix: 'FX', nameAr: 'عمليات الصرافة' },
];

/** الأسماء القديمة التي ما زالت الواجهة قد ترسلها. */
const ALIASES: Record<string, string> = { groupFare: 'groups', groupfare: 'groups' };

export const canonicalDocType = (docType: string) => {
  const key = String(docType || '').trim();
  return ALIASES[key] || key;
};

@Injectable()
export class SequencesService {
  private readonly logger = new Logger(SequencesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * تسلسلات الشركة، مُنشأةً عند أول طلب.
   *
   * ولا تبدأ من الصفر: تُقرأ أعلى الأرقام المستعملة فعلاً في التذاكر والسندات
   * فيبدأ العدّاد بعدها — وإلا لأعاد الترقيم أرقاماً موجودة، ولفشل أول حفظ على
   * قيد التفرّد.
   */
  async list(companyId: string, branchCode = '') {
    const existing = await this.prisma.documentSequence.findMany({
      where: { companyId, branchId: null },
      orderBy: { docType: 'asc' },
    });

    const have = new Set(existing.map((s) => s.docType));
    const missing = DEFAULTS.filter((d) => !have.has(d.docType));

    if (missing.length) {
      const seeded = await this.seedStartingPoints(companyId);
      for (const d of missing) {
        await this.prisma.documentSequence
          .create({
            data: {
              companyId,
              branchId: null,
              docType: d.docType,
              prefix: d.prefix,
              branchCode,
              includeYear: true,
              year: new Date().getFullYear(),
              nextNumber: seeded[d.docType] || 1001,
              padding: 5,
              separator: '-',
            },
          })
          .catch(() => undefined);
      }
      return this.prisma.documentSequence.findMany({
        where: { companyId, branchId: null },
        orderBy: { docType: 'asc' },
      });
    }

    return existing;
  }

  /** أعلى رقم مستعمل لكل نوع، ليبدأ العدّاد بعده لا فوقه. */
  private async seedStartingPoints(companyId: string): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    const tail = (value?: string | null) => {
      const m = String(value || '').match(/(\d+)\s*$/);
      return m ? parseInt(m[1], 10) : 0;
    };
    const bump = (key: string, n: number) => {
      if (n > 0) out[key] = Math.max(out[key] || 0, n + 1);
    };

    try {
      const tickets = await this.prisma.ticket.findMany({
        where: { companyId },
        select: { invoiceNumber: true, tripType: true },
      });
      tickets.forEach((t) => {
        const trip = String(t.tripType || '').toUpperCase();
        const key =
          trip === 'VISA'
            ? 'visas'
            : trip.startsWith('GROUP')
            ? 'groups'
            : trip === 'HOTEL'
            ? 'hotels'
            : trip === 'BAGGAGE'
            ? 'baggage'
            : trip === 'REISSUE' || trip === 'CHANGE'
            ? 'changes'
            : 'tickets';
        bump(key, tail(t.invoiceNumber));
      });

      const [rv, pv, je] = await Promise.all([
        this.prisma.receiptVoucher.findMany({ where: { companyId }, select: { voucherNumber: true } }),
        this.prisma.paymentVoucher.findMany({ where: { companyId }, select: { voucherNumber: true } }),
        this.prisma.journalEntry.findMany({ where: { companyId }, select: { entryNumber: true } }),
      ]);
      rv.forEach((v) => bump('receiptVouchers', tail(v.voucherNumber)));
      pv.forEach((v) => {
        const n = tail(v.voucherNumber);
        // المصاريف وسندات الدفع تتشاركان جدولاً واحداً، فيبدأ عدّاداهما فوق أعلى ما فيه.
        bump('paymentVouchers', n);
        bump('expenses', n);
      });
      je.forEach((v) => bump('journalEntries', tail(v.entryNumber)));
    } catch (err: any) {
      this.logger.warn(`Sequence seeding scan failed: ${err?.message || err}`);
    }

    return out;
  }

  async save(companyId: string, configs: SequenceConfigDto[]) {
    for (const c of configs || []) {
      const docType = canonicalDocType(c.docType);
      if (!docType) continue;
      await this.prisma.documentSequence.upsert({
        where: { companyId_branchId_docType: { companyId, branchId: null as any, docType } },
        create: {
          companyId,
          branchId: null,
          docType,
          prefix: c.prefix || docType.slice(0, 3).toUpperCase(),
          branchCode: c.branchCode || '',
          includeYear: c.includeYear !== false,
          year: new Date().getFullYear(),
          nextNumber: Number(c.nextNumber) > 0 ? Number(c.nextNumber) : 1001,
          padding: Number(c.padding) > 0 ? Number(c.padding) : 5,
          separator: c.separator || '-',
        },
        update: {
          prefix: c.prefix,
          branchCode: c.branchCode || '',
          includeYear: c.includeYear !== false,
          ...(Number(c.nextNumber) > 0 ? { nextNumber: Number(c.nextNumber) } : {}),
          ...(Number(c.padding) > 0 ? { padding: Number(c.padding) } : {}),
          separator: c.separator || '-',
        },
      });
    }
    return this.list(companyId);
  }

  /**
   * تخصيص الرقم التالي — ذرّياً.
   *
   * الزيادة والقراءة في عبارة SQL واحدة، فلا تقع بينهما لحظةٌ يقرأ فيها طلبٌ
   * آخر الرقمَ نفسه. وهذا هو الفرق الجوهري عن العدّاد الذي كان في المتصفّح.
   *
   * والسنة تُقارَن عند كل تخصيص: إن دخلت سنة جديدة عاد العدّاد إلى 1001 من
   * تلقائه، فلا يمتدّ ترقيم 2026 في 2027.
   */
  async allocate(companyId: string, docTypeRaw: string, branchCode?: string) {
    const docType = canonicalDocType(docTypeRaw);
    const year = new Date().getFullYear();

    await this.list(companyId, branchCode || '');

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ prefix: string; branchCode: string; includeYear: boolean; separator: string; padding: number; allocated: number }>
    >(
      `UPDATE document_sequences
          SET "nextNumber" = CASE WHEN "includeYear" AND COALESCE(year, $3) <> $3 THEN 1002 ELSE "nextNumber" + 1 END,
              year = $3,
              "branchCode" = COALESCE(NULLIF($4, ''), "branchCode"),
              "updatedAt" = NOW()
        WHERE "companyId" = $1 AND "branchId" IS NULL AND "docType" = $2
        RETURNING prefix,
                  "branchCode",
                  "includeYear",
                  separator,
                  padding,
                  CASE WHEN "includeYear" AND COALESCE(year, $3) <> $3 THEN 1001 ELSE "nextNumber" - 1 END AS allocated`,
      companyId,
      docType,
      year,
      branchCode || '',
    );

    const row = rows?.[0];
    if (!row) {
      // نوعٌ غير معرَّف: يُرقَّم بالوقت بدل أن يفشل الحفظ.
      return { docType, number: `${docType.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}` };
    }

    const parts: string[] = [];
    if (row.branchCode) parts.push(String(row.branchCode).toUpperCase());
    if (row.prefix) parts.push(String(row.prefix).toUpperCase());
    if (row.includeYear) parts.push(String(year));
    parts.push(String(row.allocated).padStart(row.padding || 5, '0'));

    return { docType, number: parts.join(row.separator || '-') };
  }

  /**
   * معاينة الرقم التالي — بلا حرق.
   *
   * كانت النوافذ تستدعي التخصيص الذرّي عند الفتح لتعرض الرقم، فمن فتح نافذةً
   * وألغاها استهلك رقماً — وهذا مصدر الفجوات التي بدت خربطةً في الترقيم.
   * المعاينة تقرأ ولا تزيد؛ والرقم الحقيقي يُخصَّص عند الحفظ وحده.
   */
  async peek(companyId: string, docTypeRaw: string, branchCode?: string) {
    const docType = canonicalDocType(docTypeRaw);
    const year = new Date().getFullYear();
    await this.list(companyId, branchCode || '');
    const row = await this.prisma.documentSequence.findFirst({
      where: { companyId, branchId: null, docType },
    });
    if (!row) return { docType, number: '' };
    const next = row.includeYear && (row.year ?? year) !== year ? 1001 : row.nextNumber;
    const parts: string[] = [];
    const bc = branchCode || row.branchCode;
    if (bc) parts.push(String(bc).toUpperCase());
    if (row.prefix) parts.push(String(row.prefix).toUpperCase());
    if (row.includeYear) parts.push(String(year));
    parts.push(String(next).padStart(row.padding || 5, '0'));
    return { docType, number: parts.join(row.separator || '-') };
  }

  /**
   * إصلاح العدّادات: كلٌّ يقف فوق أعلى رقم مستعمل فعلاً في بياناته.
   *
   * تُستدعى بعد عبثٍ بالعدّادات — تصفيرٌ اصطدم بأرقام محفوظة، أو أرقامٌ حُرقت
   * اختباراً — فتُعاد كل التسلسلات إلى الحقيقة: ما لا بيانات له يعود إلى 1001،
   * وما له بيانات يكمل من بعدها.
   */
  async repair(companyId: string) {
    const seeded = await this.seedStartingPoints(companyId);
    const rows = await this.prisma.documentSequence.findMany({ where: { companyId, branchId: null } });
    const year = new Date().getFullYear();
    const report: Array<{ docType: string; from: number; to: number }> = [];
    for (const row of rows) {
      const to = seeded[row.docType] || 1001;
      await this.prisma.documentSequence.update({
        where: { id: row.id },
        data: { nextNumber: to, year },
      });
      report.push({ docType: row.docType, from: row.nextNumber, to });
    }
    return { repaired: report.length, report };
  }
}
