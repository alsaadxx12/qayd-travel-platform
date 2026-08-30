import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from '../reports/reports.service';

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
  ) {}

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

  /** The address printed inside the QR. */
  private portalUrl(token: string): string {
    const base = (process.env.PORTAL_BASE_URL || process.env.APP_BASE_URL || '').replace(/\/+$/, '');
    return `${base}/s/${token}`;
  }

  /**
   * The QR is drawn here rather than in the browser, for one reason: the statement PDF
   * is rendered server-side from a Handlebars template, and a picture that only exists
   * in the browser cannot be put into it. Drawing it in one place means the code on a
   * printed PDF and the code on a screen come from the same lines.
   *
   * Error-correction level M survives a stamp, a fold or a coffee ring across roughly
   * 15% of the square, which is what a receipt actually goes through.
   */
  private async qrDataUrl(token: string): Promise<string | null> {
    try {
      return await QRCode.toDataURL(this.portalUrl(token), {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 320,
        color: { dark: '#0f172a', light: '#ffffff' },
      });
    } catch (err: any) {
      // A missing picture must never take down the page that was going to show it.
      this.logger.warn(`QR generation failed: ${err?.message || err}`);
      return null;
    }
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
    input: { customerId?: string; supplierId?: string; regenerate?: boolean; label?: string },
  ) {
    const { customerId, supplierId } = input;
    if (!customerId && !supplierId) {
      throw new BadRequestException('حدّد العميل أو المورد الذي تريد إصدار الباركود له');
    }
    if (customerId && supplierId) {
      throw new BadRequestException('الباركود يخصّ طرفاً واحداً: عميلاً أو مورداً، لا الاثنين');
    }

    const party = customerId
      ? await this.prisma.customer.findFirst({
          where: { id: customerId, companyId },
          select: { id: true, nameAr: true, phone: true, accountId: true },
        })
      : await this.prisma.supplier.findFirst({
          where: { id: supplierId!, companyId },
          select: { id: true, nameAr: true, phone: true, accountId: true },
        });

    if (!party) throw new NotFoundException('الطرف المحدد لا ينتمي إلى الشركة الحالية');
    if (!party.accountId) {
      throw new BadRequestException('لا يوجد حساب محاسبي مرتبط بهذا الطرف، فلا كشف يمكن عرضه');
    }

    const existing = await this.prisma.statementAccessToken.findFirst({
      where: {
        companyId,
        ...(customerId ? { customerId } : { supplierId }),
        revokedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing && !input.regenerate) {
      return await this.describeIssued(existing, party);
    }

    if (existing && input.regenerate) {
      await this.prisma.statementAccessToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() },
      });
    }

    const created = await this.prisma.statementAccessToken.create({
      data: {
        token: randomBytes(32).toString('base64url'),
        companyId,
        accountId: party.accountId,
        customerId: customerId || null,
        supplierId: supplierId || null,
        label: input.label || party.nameAr,
        createdById: userId,
      },
    });

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
      url: this.portalUrl(row.token),
      qrDataUrl: await this.qrDataUrl(row.token),
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
    const rows = await this.prisma.statementAccessToken.findMany({
      where: { companyId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const customerIds = rows.map((r) => r.customerId).filter((id): id is string => Boolean(id));
    const supplierIds = rows.map((r) => r.supplierId).filter((id): id is string => Boolean(id));

    const [customers, suppliers] = await Promise.all([
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
    ]);

    const byId = new Map<string, { nameAr: string; phone: string | null }>();
    for (const c of customers) byId.set(c.id, c);
    for (const s of suppliers) byId.set(s.id, s);

    return Promise.all(
      rows.map(async (row) => {
        const party = byId.get(row.customerId || row.supplierId || '') || {
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

  /**
   * The barcode for an account's own statement, for printing onto documents.
   *
   * Returns null when no barcode has been issued for that account, rather than issuing
   * one: a printed code is a credential, and printing a statement must never be the act
   * that quietly creates access to it. Issuing stays an explicit decision on the staff
   * screen.
   *
   * The account can be named by id or by code, because the PDF endpoint is called with
   * whichever the calling screen happens to hold.
   */
  async qrForAccount(
    companyId: string,
    accountId?: string | null,
    accountCode?: string | null,
  ): Promise<string | null> {
    let resolvedId = accountId || null;
    if (!resolvedId && accountCode) {
      const account = await this.prisma.account.findFirst({
        where: { companyId, code: String(accountCode) },
        select: { id: true },
      });
      resolvedId = account?.id || null;
    }
    if (!resolvedId) return null;

    const row = await this.prisma.statementAccessToken.findFirst({
      where: { companyId, accountId: resolvedId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { token: true, expiresAt: true },
    });
    if (!row) return null;
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;

    return this.qrDataUrl(row.token);
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

  private async partyOf(row: { customerId: string | null; supplierId: string | null }) {
    if (row.customerId) {
      return this.prisma.customer.findUnique({
        where: { id: row.customerId },
        select: { nameAr: true, phone: true },
      });
    }
    if (row.supplierId) {
      return this.prisma.supplier.findUnique({
        where: { id: row.supplierId },
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
    return {
      companyName: company?.name || '',
      holderName: party?.nameAr || row.label || '',
      phoneHint: this.phoneHint(party?.phone),
      // Fail closed: with no phone on file there is no question to ask, so there is
      // no way in. The staff screen flags these so they can be fixed.
      canVerify: this.digitsOf(party?.phone).length >= 4,
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
    const digits = this.digitsOf(party?.phone);
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
