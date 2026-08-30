import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from '../reports/reports.service';
import { StatementPdfService } from '../pdf/statement-pdf.service';
import { StatementQrService } from './statement-qr.service';

/**
 * The customer-facing statement portal.
 *
 * A QR printed on a statement or a receipt carries ONE opaque token and nothing else —
 * no company id, no account id, no customer id. Everything is resolved from that token
 * on the server, so a printed page can never be edited into somebody else's statement,
 * and a leaked token opens exactly one account and can be revoked on its own.
 *
 * Holding the paper is not enough. The token only earns the right to be ASKED a
 * question — the last four digits of the phone on file — and only a correct answer
 * mints a short-lived session that can read the statement. That is what stops a photo
 * of a receipt, forwarded around a WhatsApp group, from being a financial disclosure.
 *
 * The four digits are compared against the customer's CURRENT phone, never a copy: when
 * the agency changes the phone, yesterday's answer stops working the same second.
 */

/** How long a verified visitor stays signed in before answering again. */
const PORTAL_SESSION_MINUTES = 30;
/** Wrong answers allowed before the token stops answering at all. */
const MAX_FAILED_ATTEMPTS = 5;
/** How long a token stays locked once the limit is reached. */
const LOCKOUT_MINUTES = 15;

export interface PortalSessionPayload {
  scope: 'statement-portal';
  tokenId: string;
  companyId: string;
  accountId: string;
}

@Injectable()
export class StatementPortalService {
  private readonly logger = new Logger(StatementPortalService.name);

  constructor(
    private prisma: PrismaService,
    private reports: ReportsService,
    private jwt: JwtService,
    private statementPdf: StatementPdfService,
    private qr: StatementQrService,
  ) {}

  /**
   * Turns "the table is not there" into a sentence that names the fix.
   *
   * This feature adds a table of its own. Until the migration runs, every call that
   * touches it fails deep inside Prisma and surfaces as a bare 500 — which looks like a
   * bug in the feature rather than a step that has not been taken. Prisma's own codes
   * say exactly which case it is, so they are translated instead of swallowed.
   */
  private translateSchemaError(err: any): never {
    const code = err?.code;
    const message = String(err?.message || '');
    const missingTable =
      code === 'P2021' || /statement_access_tokens.*does not exist|relation .* does not exist/i.test(message);
    const missingColumn = code === 'P2022' || /column .* does not exist/i.test(message);

    if (missingTable || missingColumn) {
      this.logger.error(`Statement portal schema is not migrated: ${message}`);
      throw new BadRequestException(
        'جدول الباركود غير موجود في قاعدة البيانات بعد. نفّذ في مجلد backend الأمر: npx prisma db push (أو الصق ملف prisma/sql/2026-08-31-statement-portal.sql في Supabase) ثم أعد نشر الخادم.',
      );
    }
    throw err;
  }

  /**
   * A secret of its own, derived from the app's but not equal to it. A portal session
   * therefore cannot be presented to the main API as a staff token, and a staff token
   * cannot be presented here — even though both are JWTs and both travel in the same
   * kind of header.
   */
  private portalSecret(): string {
    const base = process.env.JWT_SECRET || 'super-secret-accounting-key-2026';
    return createHash('sha256').update(`${base}::statement-portal`).digest('hex');
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Staff side: issuing and revoking
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Issues — or returns — the key for one customer or supplier.
   *
   * Re-issuing by default would invalidate every statement and receipt already in the
   * customer's hands, so an existing live key is returned as-is. `regenerate` is the
   * explicit way to burn the old paper, for when a customer says their code leaked.
   */
  async issue(
    companyId: string,
    userId: string,
    input: {
      accountId?: string;
      customerId?: string;
      supplierId?: string;
      regenerate?: boolean;
      label?: string;
    },
  ) {
    const { customerId, supplierId } = input;
    if (customerId && supplierId) {
      throw new BadRequestException('الباركود يخصّ طرفاً واحداً: عميلاً أو مورداً، لا الاثنين');
    }

    /**
     * A barcode belongs to an ACCOUNT — that is whose statement it opens. A customer or
     * a supplier is just the most common way of naming one.
     *
     * Requiring a customer or supplier was too narrow: most rows in a chart of accounts
     * are neither. Staff advances, partner accounts and internal ledgers all have
     * statements worth sending, and issuing for them failed with «حدّد العميل أو المورد»
     * even though the account was named perfectly well.
     */
    let party: { id?: string; nameAr: string; phone: string | null; accountId: string } | null = null;

    if (customerId) {
      party = await this.prisma.customer.findFirst({
        where: { id: customerId, companyId },
        select: { id: true, nameAr: true, phone: true, accountId: true },
      });
      if (!party) throw new NotFoundException('العميل المحدد لا ينتمي إلى الشركة الحالية');
    } else if (supplierId) {
      party = await this.prisma.supplier.findFirst({
        where: { id: supplierId, companyId },
        select: { id: true, nameAr: true, phone: true, accountId: true },
      });
      if (!party) throw new NotFoundException('المورد المحدد لا ينتمي إلى الشركة الحالية');
    } else if (input.accountId) {
      const account = await this.prisma.account.findFirst({
        where: { id: input.accountId, companyId },
        // The phone matters as much as the name: an account carries its own contact
        // details, and ignoring them was what made «لا يوجد رقم هاتف» appear for
        // accounts that plainly had one on their own record.
        select: { id: true, nameAr: true, phone: true },
      });
      if (!account) throw new NotFoundException('الحساب المحدد لا ينتمي إلى الشركة الحالية');

      // A customer or supplier may still stand behind the account. Finding it matters:
      // their phone is read live at verification, so it keeps working after an edit,
      // while a number typed here is only a copy.
      const [linkedCustomer, linkedSupplier] = await Promise.all([
        this.prisma.customer.findFirst({
          where: { accountId: account.id, companyId },
          select: { id: true, nameAr: true, phone: true, accountId: true },
        }),
        this.prisma.supplier.findFirst({
          where: { accountId: account.id, companyId },
          select: { id: true, nameAr: true, phone: true, accountId: true },
        }),
      ]);
      party = linkedCustomer || linkedSupplier || {
        nameAr: account.nameAr,
        phone: account.phone,
        accountId: account.id,
      };
      if (linkedCustomer) input = { ...input, customerId: linkedCustomer.id };
      else if (linkedSupplier) input = { ...input, supplierId: linkedSupplier.id };
    } else {
      throw new BadRequestException('حدّد الحساب أو العميل أو المورد الذي تريد إصدار الباركود له');
    }

    if (!party.accountId) {
      throw new BadRequestException('لا يوجد حساب محاسبي مرتبط بهذا الطرف، فلا كشف يمكن عرضه');
    }

    /**
     * No phone, no barcode — and the fix belongs in the account, not here.
     *
     * A number typed into this screen would be a second copy that drifts the moment
     * someone corrects the real one. The account already has a phone field; pointing
     * there keeps one number, read live at every verification.
     */
    if (!this.digitsOf(party.phone).length) {
      throw new BadRequestException(
        'لا يوجد رقم هاتف لهذا الحساب. أضف رقم الهاتف من شجرة الحسابات (تعديل الحساب ← الهاتف) ثم أعد الإصدار.',
      );
    }

    const existing = await this.prisma.statementAccessToken
      .findFirst({
        where: { companyId, accountId: party.accountId, revokedAt: null },
        orderBy: { createdAt: 'desc' },
      })
      .catch((err) => this.translateSchemaError(err));

    if (existing && !input.regenerate) {
      return await this.describeIssued(existing, party);
    }

    if (existing && input.regenerate) {
      await this.prisma.statementAccessToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() },
      });
    }

    const created = await this.prisma.statementAccessToken
      .create({
        data: {
          token: randomBytes(32).toString('base64url'),
          companyId,
          accountId: party.accountId,
          customerId: input.customerId || null,
          supplierId: input.supplierId || null,
          label: input.label || party.nameAr,
          createdById: userId,
        },
      })
      .catch((err) => this.translateSchemaError(err));

    await this.prisma.auditLog.create({
      data: {
        action: input.regenerate ? 'REGENERATE_STATEMENT_QR' : 'ISSUE_STATEMENT_QR',
        entity: 'StatementAccessToken',
        entityId: created.id,
        details: JSON.stringify({ customerId, supplierId, accountId: party.accountId }),
        userId,
        companyId,
      },
    });

    return await this.describeIssued(created, party);
  }

  private async describeIssued(
    row: { id: string; token: string; viewCount: number; lastViewedAt: Date | null; createdAt: Date },
    party: { nameAr: string; phone: string | null },
  ) {
    return {
      id: row.id,
      token: row.token,
      url: this.qr.portalUrl(row.token),
      // Lets the staff screen explain an absent barcode instead of showing a blank box.
      portalConfigured: this.qr.isConfigured(),
      qrDataUrl: await this.qr.dataUrl(row.token),
      holderName: party.nameAr,
      // The staff screen must be able to say WHY a customer cannot get in.
      canVerify: Boolean(this.digitsOf(party.phone).length >= 4),
      phoneHint: this.phoneHint(party.phone),
      viewCount: row.viewCount,
      lastViewedAt: row.lastViewedAt,
      createdAt: row.createdAt,
    };
  }

  async list(companyId: string) {
    const rows = await this.prisma.statementAccessToken
      .findMany({
        where: { companyId, revokedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 500,
      })
      .catch((err) => this.translateSchemaError(err));

    const customerIds = rows.map((r) => r.customerId).filter((id): id is string => Boolean(id));
    const supplierIds = rows.map((r) => r.supplierId).filter((id): id is string => Boolean(id));
    // Accounts are fetched too, so a token that belongs to a bare ledger account shows
    // its verification number in the list instead of a dash.
    const accountIds = Array.from(new Set(rows.map((r) => r.accountId).filter(Boolean)));

    const [customers, suppliers, accounts] = await Promise.all([
      customerIds.length
        ? this.prisma.customer.findMany({
            where: { id: { in: customerIds } },
            select: { id: true, nameAr: true, phone: true },
          })
        : Promise.resolve([]),
      supplierIds.length
        ? this.prisma.supplier.findMany({
            where: { id: { in: supplierIds } },
            select: { id: true, nameAr: true, phone: true },
          })
        : Promise.resolve([]),
      accountIds.length
        ? this.prisma.account.findMany({
            where: { id: { in: accountIds } },
            select: { id: true, nameAr: true, phone: true },
          })
        : Promise.resolve([]),
    ]);

    const byId = new Map<string, { nameAr: string; phone: string | null }>();
    for (const c of customers) byId.set(c.id, c);
    for (const s of suppliers) byId.set(s.id, s);
    const byAccount = new Map<string, { nameAr: string; phone: string | null }>();
    for (const a of accounts) byAccount.set(a.id, a);

    return Promise.all(
      rows.map(async (row) => {
        // Same order the verification uses: party first, then the account, then the
        // number typed when the barcode was issued.
        const party = byId.get(row.customerId || row.supplierId || '') ||
          byAccount.get(row.accountId) || {
            nameAr: row.label || '',
            phone: null,
          };
        return {
          ...(await this.describeIssued(row, party)),
          customerId: row.customerId,
          supplierId: row.supplierId,
          lockedUntil: row.lockedUntil,
        };
      }),
    );
  }

  async revoke(id: string, companyId: string, userId: string) {
    const row = await this.prisma.statementAccessToken.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundException('الباركود غير موجود');

    await this.prisma.statementAccessToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
    await this.prisma.auditLog.create({
      data: {
        action: 'REVOKE_STATEMENT_QR',
        entity: 'StatementAccessToken',
        entityId: id,
        details: JSON.stringify({ customerId: row.customerId, supplierId: row.supplierId }),
        userId,
        companyId,
      },
    });

    return { revoked: true };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Public side: what an unauthenticated visitor can reach
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Loads a live token, or refuses.
   *
   * Revoked, expired and unknown tokens all fail the same way, so a probe cannot learn
   * whether a code ever existed.
   */
  private async liveToken(token: string) {
    const row = token
      ? await this.prisma.statementAccessToken.findUnique({ where: { token } })
      : null;
    if (!row || row.revokedAt) throw new NotFoundException('هذا الباركود غير صالح');
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
      throw new NotFoundException('هذا الباركود غير صالح');
    }
    return row;
  }

  private digitsOf(phone: string | null | undefined): string {
    return String(phone || '').replace(/\D/g, '');
  }

  /** `07xx xxx xx46` — enough to recognise your own number, useless to anyone else. */
  private phoneHint(phone: string | null | undefined): string | null {
    const digits = this.digitsOf(phone);
    if (digits.length < 4) return null;
    return `${'•'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
  }

  /**
   * The number the visitor must match.
   *
   * A linked customer or supplier's CURRENT phone always wins, so changing it in the
   * system changes the answer the same second. The number stored on the token is only
   * for accounts that have no party behind them, and is used only when there is nothing
   * live to compare against.
   */
  private verificationPhone(party: { phone: string | null } | null): string {
    return this.digitsOf(party?.phone);
  }

  /**
   * Who the barcode belongs to, and the number to check against — read live every time.
   *
   * The account is the fallback rather than nothing at all: a ledger account holds its
   * own name and phone, and for the many accounts with no customer or supplier behind
   * them that record IS the contact. Reading it here means a phone corrected in the
   * account screen takes effect immediately, exactly as it does for a customer.
   */
  private async partyOf(row: {
    customerId: string | null;
    supplierId: string | null;
    accountId?: string | null;
  }) {
    if (row.customerId) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: row.customerId },
        select: { nameAr: true, phone: true },
      });
      if (customer) return customer;
    }
    if (row.supplierId) {
      const supplier = await this.prisma.supplier.findUnique({
        where: { id: row.supplierId },
        select: { nameAr: true, phone: true },
      });
      if (supplier) return supplier;
    }
    if (row.accountId) {
      return this.prisma.account.findUnique({
        where: { id: row.accountId },
        select: { nameAr: true, phone: true },
      });
    }
    return null;
  }

  /**
   * What the page may show BEFORE anyone proves anything: the agency's name and the
   * holder's name — both already printed on the paper the visitor is holding — plus a
   * masked hint of the phone. No amount, no balance, no transaction.
   */
  async describe(token: string) {
    const row = await this.liveToken(token);
    const [party, company] = await Promise.all([
      this.partyOf(row),
      this.prisma.company.findUnique({
        where: { id: row.companyId },
        select: { name: true },
      }),
    ]);

    const locked = row.lockedUntil && row.lockedUntil.getTime() > Date.now();
    const digits = this.verificationPhone(party);
    return {
      companyName: company?.name || '',
      holderName: party?.nameAr || row.label || '',
      phoneHint: this.phoneHint(digits),
      // Fail closed: with no number to ask about there is no question, so there is no
      // way in. The staff screen flags these so they can be fixed.
      canVerify: digits.length >= 4,
      locked: Boolean(locked),
      lockedUntil: locked ? row.lockedUntil : null,
    };
  }

  /**
   * Checks the four digits and, on success, mints the session that may read the
   * statement.
   *
   * Four digits is ten thousand guesses, which a script finishes in seconds — so the
   * counter, not the digits, is what actually provides the security. Five wrong
   * answers and the token stops answering for fifteen minutes, which turns those
   * seconds into weeks.
   */
  async verify(token: string, last4: string) {
    const row = await this.liveToken(token);

    if (row.lockedUntil && row.lockedUntil.getTime() > Date.now()) {
      const minutes = Math.ceil((row.lockedUntil.getTime() - Date.now()) / 60000);
      throw new ForbiddenException(`تم إيقاف المحاولات مؤقتاً. أعد المحاولة بعد ${minutes} دقيقة.`);
    }

    const party = await this.partyOf(row);
    const digits = this.verificationPhone(party);
    const supplied = this.digitsOf(last4);

    if (digits.length < 4) {
      throw new ForbiddenException(
        'لا يوجد رقم هاتف مسجَّل لهذا الحساب، لذلك لا يمكن فتح الكشف. يرجى مراجعة الوكالة.',
      );
    }

    if (supplied.length !== 4 || supplied !== digits.slice(-4)) {
      const failed = row.failedAttempts + 1;
      const reached = failed >= MAX_FAILED_ATTEMPTS;
      await this.prisma.statementAccessToken.update({
        where: { id: row.id },
        data: {
          failedAttempts: reached ? 0 : failed,
          lockedUntil: reached ? new Date(Date.now() + LOCKOUT_MINUTES * 60000) : row.lockedUntil,
        },
      });
      if (reached) {
        this.logger.warn(`Statement portal lockout on token ${row.id} after ${failed} failures`);
        throw new ForbiddenException(
          `أُوقفت المحاولات لمدة ${LOCKOUT_MINUTES} دقيقة بعد عدة إجابات خاطئة.`,
        );
      }
      throw new ForbiddenException(
        `الأرقام غير صحيحة. المحاولات المتبقية: ${MAX_FAILED_ATTEMPTS - failed}`,
      );
    }

    await this.prisma.statementAccessToken.update({
      where: { id: row.id },
      data: {
        failedAttempts: 0,
        lockedUntil: null,
        viewCount: { increment: 1 },
        lastViewedAt: new Date(),
      },
    });

    const payload: PortalSessionPayload = {
      scope: 'statement-portal',
      tokenId: row.id,
      companyId: row.companyId,
      accountId: row.accountId,
    };
    const session = this.jwt.sign(payload, {
      secret: this.portalSecret(),
      expiresIn: `${PORTAL_SESSION_MINUTES}m`,
    });

    return { session, expiresInMinutes: PORTAL_SESSION_MINUTES };
  }

  /**
   * The statement as a file the customer's phone can save.
   *
   * A PDF needs a headless browser, which a hosted server may simply not have. Rather
   * than fail the visit over that, the HTML the PDF would have been printed from is
   * returned instead — it is the same document, and a phone opens it perfectly well.
   * The caller sets the file name and content type from `kind`.
   */
  async statementFile(
    session: string,
    startDate?: string,
    endDate?: string,
  ): Promise<{ kind: 'pdf' | 'html'; buffer: Buffer; filename: string; reason?: string }> {
    const data = await this.statement(session, startDate, endDate);

    const rows = (data.lines || []).map((line: any, index: number) => ({
      rowNumber: index + 1,
      date: String(line.date || '').slice(0, 10),
      docRef: line.entryNumber || '',
      statement: line.description || '',
      debit: Number(line.debit) || 0,
      credit: Number(line.credit) || 0,
      balance: Number(line.runningBalance) || 0,
    }));

    const body: any = {
      accountName: data.holderName || data.account?.nameAr || '',
      accountCode: data.account?.code || '',
      accountId: (data.account as any)?.id,
      startDate: String(data.startDate || '').slice(0, 10),
      endDate: String(data.endDate || '').slice(0, 10),
      rows,
      totals: {
        totalDebit: (data as any).totalDebit ?? rows.reduce((sum, r) => sum + (Number(r.debit) || 0), 0),
        totalCredit: (data as any).totalCredit ?? rows.reduce((sum, r) => sum + (Number(r.credit) || 0), 0),
        finalBalance: Number(data.closingBalance) || 0,
        openingBalance: Number(data.openingBalance) || 0,
        previousBalance: Number(data.openingBalance) || 0,
      },
      lang: 'ar' as const,
    };

    const payload = this.readSession(session);
    try {
      const generated = await this.statementPdf.generate(payload.companyId, body);
      return { kind: 'pdf', buffer: generated.buffer, filename: generated.downloadName };
    } catch (err: any) {
      const reason = err?.message || 'PDF unavailable';
      this.logger.warn(`Portal PDF unavailable, serving HTML instead: ${reason}`);
      const rendered = await this.statementPdf.renderHtml(payload.companyId, body);
      return {
        kind: 'html',
        buffer: Buffer.from(rendered.html, 'utf-8'),
        filename: `${rendered.baseName}.html`,
        reason,
      };
    }
  }

  /** Verifies a portal session and refuses anything that is not one. */
  private readSession(session: string): PortalSessionPayload {
    try {
      const payload = this.jwt.verify<PortalSessionPayload>(session, {
        secret: this.portalSecret(),
      });
      if (payload?.scope !== 'statement-portal') throw new Error('wrong scope');
      return payload;
    } catch {
      throw new ForbiddenException('انتهت الجلسة. أعد مسح الباركود.');
    }
  }

  /**
   * The statement itself. The account is taken from the SESSION, never from the
   * request — a visitor cannot ask for an account other than the one their token
   * opens, however they craft the call.
   */
  async statement(session: string, startDate?: string, endDate?: string) {
    const payload = this.readSession(session);

    // Re-checked on every read, not just at sign-in: revoking a code must lock out a
    // visitor who is already looking at the page.
    const row = await this.prisma.statementAccessToken.findUnique({
      where: { id: payload.tokenId },
    });
    if (!row || row.revokedAt || (row.expiresAt && row.expiresAt.getTime() < Date.now())) {
      throw new ForbiddenException('لم يعد هذا الباركود صالحاً.');
    }

    const [statement, company, party] = await Promise.all([
      this.reports.getAccountStatement(payload.companyId, payload.accountId, startDate, endDate),
      this.prisma.company.findUnique({
        where: { id: payload.companyId },
        select: { name: true, phone: true, address: true },
      }),
      this.partyOf(row),
    ]);

    return {
      company,
      holderName: party?.nameAr || row.label || '',
      ...statement,
    };
  }
}
