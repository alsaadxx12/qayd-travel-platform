import { Injectable, Logger } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { randomBytes } from 'crypto';
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
        width: 500,
        color: { dark: '#000000', light: '#ffffff' },
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
   * Finds the existing active token or auto-issues a live statement access token
   * so that every printed statement always carries a valid, scannable QR code.
   */
  async forAccount(
    companyId: string,
    accountId?: string | null,
    accountCode?: string | null,
    accountName?: string | null,
  ): Promise<string | null> {
    const code = accountCode ? String(accountCode).trim() : '';
    const name = accountName ? String(accountName).trim() : '';
    let resolvedAccountIds: string[] = accountId ? [String(accountId)] : [];

    if (code) {
      const [account, customer, supplier] = await Promise.all([
        this.prisma.account.findFirst({
          where: { companyId, code },
          select: { id: true },
        }),
        this.prisma.customer.findFirst({
          where: { companyId, code },
          select: { id: true, accountId: true },
        }),
        this.prisma.supplier.findFirst({
          where: { companyId, code },
          select: { id: true, accountId: true },
        }),
      ]);
      if (account?.id) resolvedAccountIds.push(account.id);
      if (customer?.accountId) resolvedAccountIds.push(customer.accountId);
      if (customer?.id) resolvedAccountIds.push(customer.id);
      if (supplier?.accountId) resolvedAccountIds.push(supplier.accountId);
      if (supplier?.id) resolvedAccountIds.push(supplier.id);
    }

    if (!resolvedAccountIds.length && name) {
      const [accountByName, customerByName, supplierByName] = await Promise.all([
        this.prisma.account.findFirst({
          where: { companyId, nameAr: name },
          select: { id: true },
        }),
        this.prisma.customer.findFirst({
          where: { companyId, nameAr: name },
          select: { id: true, accountId: true },
        }),
        this.prisma.supplier.findFirst({
          where: { companyId, nameAr: name },
          select: { id: true, accountId: true },
        }),
      ]);
      if (accountByName?.id) resolvedAccountIds.push(accountByName.id);
      if (customerByName?.accountId) resolvedAccountIds.push(customerByName.accountId);
      if (customerByName?.id) resolvedAccountIds.push(customerByName.id);
      if (supplierByName?.accountId) resolvedAccountIds.push(supplierByName.accountId);
      if (supplierByName?.id) resolvedAccountIds.push(supplierByName.id);
    }

    resolvedAccountIds = Array.from(new Set(resolvedAccountIds.filter(Boolean)));
    if (!resolvedAccountIds.length) return null;

    const row = await this.prisma.statementAccessToken.findFirst({
      where: {
        companyId,
        revokedAt: null,
        OR: [
          { accountId: { in: resolvedAccountIds } },
          { customerId: { in: resolvedAccountIds } },
          { supplierId: { in: resolvedAccountIds } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: { token: true, expiresAt: true },
    });

    if (row && (!row.expiresAt || row.expiresAt.getTime() > Date.now())) {
      return this.dataUrl(row.token);
    }

    // Auto-issue an active statement access token so every statement has a valid QR
    const primaryAccountId = resolvedAccountIds.find(id => id.length > 5) || resolvedAccountIds[0];
    if (primaryAccountId) {
      try {
        const account = await this.prisma.account.findFirst({
          where: { id: primaryAccountId, companyId },
          select: { id: true, nameAr: true },
        });

        const [linkedCustomer, linkedSupplier] = await Promise.all([
          this.prisma.customer.findFirst({
            where: { accountId: primaryAccountId, companyId },
            select: { id: true },
          }),
          this.prisma.supplier.findFirst({
            where: { accountId: primaryAccountId, companyId },
            select: { id: true },
          }),
        ]);

        const created = await this.prisma.statementAccessToken.create({
          data: {
            token: randomBytes(32).toString('base64url'),
            companyId,
            accountId: primaryAccountId,
            customerId: linkedCustomer?.id || null,
            supplierId: linkedSupplier?.id || null,
            label: account?.nameAr || name || 'كشف حساب',
            createdById: 'SYSTEM',
          },
        });

        if (created) {
          return this.dataUrl(created.token);
        }
      } catch (err: any) {
        this.logger.warn(`Auto-creating statement QR token error: ${err?.message}`);
      }
    }

    return null;
  }
}
