import { Injectable, Logger } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { TemplateService, StatementPdfData, TemplateSettings } from './template.service';
import { PrintTemplatesService } from '../print-templates/print-templates.service';

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
  ) {}

  /**
   * Official statement PDF: saved `statement` print template + Handlebars layout.
   * Same path as POST /pdf/statement used by تصدير كشف PDF.
   */
  async generate(companyId: string, body: StatementPdfData): Promise<GeneratedStatementPdf> {
    const savedConfig = await this.loadSavedSettings(companyId);
    const merged: StatementPdfData = {
      ...body,
      settings: this.normalizeSettings({
        ...savedConfig,
        ...(body.settings || {}),
      }),
    };

    const html = this.templateService.renderStatementHtml(merged);
    const buffer = await this.pdfService.generateFromHtml(html);
    // The period stamp arrives as 01/01/2026; slashes are not legal in a file name.
    const stamp = (merged.startDate || new Date().toISOString().slice(0, 10)).replace(/[\\/:*?"<>|]+/g, '-');
    const safeAccount = (merged.accountName || 'account').replace(/[\\/:*?"<>|]+/g, '-').trim();
    const downloadName = `كشف_حساب_${safeAccount}_${stamp}.pdf`;

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
