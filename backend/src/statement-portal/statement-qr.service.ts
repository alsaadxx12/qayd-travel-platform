import { Injectable, Logger } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Building the statement barcode, and nothing else.
 *
 * It lives apart from the portal service on purpose. The PDF templates need a barcode,
 * and the portal needs the PDF — so if both lived in one provider the two modules would
 * import each other. This has one dependency (the database) and is imported by both,
 * which breaks the cycle instead of papering over it with forwardRef.
 */
@Injectable()
export class StatementQrService {
  private readonly logger = new Logger(StatementQrService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * The address printed inside the QR — absolute URL to the statement portal.
   */
  portalUrl(token: string): string {
    const base = (
      process.env.PORTAL_BASE_URL ||
      process.env.APP_BASE_URL ||
      process.env.FRONTEND_URL ||
      'https://qayd-travel-platform.alsaady-rrr123r.workers.dev'
    )
      .trim()
      .replace(/\/+$/, '');
    return `${base}/s/${token}`;
  }

  /** Whether a barcode can be produced at all in this deployment. */
  isConfigured(): boolean {
    return true;
  }

  /**
   * Drawn on the server rather than in the browser, because the statement PDF is
   * rendered server-side from a Handlebars template and a picture that exists only in
   * a browser cannot go into it. One place to draw it means the code on paper and the
   * code on screen come from the same lines.
   *
   * Error-correction level M survives a stamp, a fold or a coffee ring across roughly
   * 15% of the square, which is what a receipt actually goes through.
   */
  async dataUrl(token: string): Promise<string | null> {
    const url = this.portalUrl(token);
    if (!url) return null;
    try {
      return await QRCode.toDataURL(url, {
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
  async forAccount(
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

    return this.dataUrl(row.token);
  }
}
