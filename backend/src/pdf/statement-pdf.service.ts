import { Injectable, Logger } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { TemplateService, StatementPdfData, TemplateSettings } from './template.service';
import { PrintTemplatesService } from '../print-templates/print-templates.service';
import { StatementQrService } from '../statement-portal/statement-qr.service';

export interface GeneratedStatementPdf {
  buffer: Buffer;
  filename: string;
  downloadName: string;
}

@Injectable()
export class StatementPdfService {
  private readonly logger = new Logger(StatementPdfService.name);

  constructor(
    private readonly pdfService: PdfService,
    private readonly templateService: TemplateService,
    private readonly printTemplatesService: PrintTemplatesService,
    private readonly statementQr: StatementQrService,
  ) {}

  /**
   * The statement as HTML, with the company's saved print template applied.
   *
   * `generate()` prints exactly this and nothing else, so exposing it separately
   * costs nothing — and it is what lets a statement still be delivered when no
   * browser is available to turn it into a PDF. The HTML is the document; the PDF
   * is only one way of carrying it.
   */
  async renderHtml(
    companyId: string,
    body: StatementPdfData,
  ): Promise<{ html: string; baseName: string }> {
    const savedConfig = await this.loadSavedSettings(companyId);
    const settings = this.normalizeSettings({
      ...savedConfig,
      ...(body.settings || {}),
    });

    /**
     * The barcode is fetched only when the template asks for it, so a company that
     * turned the switch off pays nothing for it — and a failure to build the picture
     * degrades to a statement without a code rather than to no statement at all.
     */
    let qrDataUrl: string | null = null;
    if (settings.showQrCode !== false) {
      try {
        qrDataUrl = await this.statementQr.forAccount(
          companyId,
          (body as any).accountId,
          body.accountCode,
          body.accountName,
        );
      } catch (err: any) {
        this.logger.warn(`Statement QR lookup failed: ${err?.message || err}`);
      }
    }

    const merged: StatementPdfData = { ...body, settings, qrDataUrl };

    // The period stamp arrives as 01/01/2026; slashes are not legal in a file name.
    const stamp = (merged.startDate || new Date().toISOString().slice(0, 10)).replace(/[\\/:*?"<>|]+/g, '-');
    const safeAccount = (merged.accountName || 'account').replace(/[\\/:*?"<>|]+/g, '-').trim();

    return {
      html: this.templateService.renderStatementHtml(merged),
      baseName: `كشف_حساب_${safeAccount}_${stamp}`,
    };
  }

  /**
   * Official statement PDF: saved `statement` print template + Handlebars layout.
   * Same path as POST /pdf/statement used by تصدير كشف PDF.
   */
  async generate(companyId: string, body: StatementPdfData): Promise<GeneratedStatementPdf> {
    const { html, baseName } = await this.renderHtml(companyId, body);
    const raw = await this.pdfService.generateFromHtml(html);
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
    const downloadName = `${baseName}.pdf`;

    return {
      buffer,
      filename: `statement_${Date.now()}.pdf`,
      downloadName,
    };
  }

  private async loadSavedSettings(companyId: string): Promise<TemplateSettings> {
    try {
      const dbTemplate = await this.printTemplatesService.getTemplate(companyId, 'statement');
      if (dbTemplate?.config && typeof dbTemplate.config === 'object') {
        return this.normalizeSettings(dbTemplate.config as Record<string, any>);
      }
    } catch (err: any) {
      this.logger.warn(`Failed to load statement print template: ${err?.message || err}`);
    }
    return {};
  }

  private normalizeSettings(raw: Record<string, any>): TemplateSettings {
    const config = raw || {};
    return {
      ...config,
      templatePreset: config.templatePreset || 'classic',
      companyNameAr: config.companyNameAr || config.companyName || '',
      companyNameEn: config.companyNameEn || config.companyName || '',
      subtitleAr: config.subtitleAr || config.subtitle || '',
      subtitleEn: config.subtitleEn || config.subtitle || '',
      addressAr: config.addressAr || config.address || '',
      addressEn: config.addressEn || config.address || '',
      footerTextAr: config.footerTextAr || config.footerText || '',
      footerTextEn: config.footerTextEn || config.footerText || '',
    };
  }
}
