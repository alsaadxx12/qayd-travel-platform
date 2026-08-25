import { Controller, Post, Body, Res, Req, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { PdfService, PdfGenerateOptions } from './pdf.service';
import { TemplateService } from './template.service';
import type { StatementPdfData } from './template.service';
import { IsString, IsOptional, IsBoolean, IsIn, IsArray, IsNumber, ValidateNested, IsObject } from 'class-validator';
import { PrintTemplatesService } from '../print-templates/print-templates.service';

class GeneratePdfDto {
  @IsString()
  html: string;

  @IsOptional()
  @IsIn(['ar', 'en'])
  lang?: 'ar' | 'en';

  @IsOptional()
  @IsIn(['A4', 'Letter'])
  format?: 'A4' | 'Letter';

  @IsOptional()
  @IsBoolean()
  landscape?: boolean;

  @IsOptional()
  @IsString()
  marginTop?: string;

  @IsOptional()
  @IsString()
  marginBottom?: string;

  @IsOptional()
  @IsString()
  marginLeft?: string;

  @IsOptional()
  @IsString()
  marginRight?: string;

  @IsOptional()
  @IsString()
  headerHtml?: string;

  @IsOptional()
  @IsString()
  footerHtml?: string;

  @IsOptional()
  @IsString()
  filename?: string;
}

@Controller('pdf')
export class PdfController {
  constructor(
    private readonly pdfService: PdfService,
    private readonly templateService: TemplateService,
    private readonly printTemplatesService: PrintTemplatesService,
  ) {}

  @Post('generate')
  async generatePdf(
    @Body() body: GeneratePdfDto,
    @Res() res: any,
  ) {
    if (!body.html || body.html.trim().length === 0) {
      throw new HttpException('HTML content is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const options: PdfGenerateOptions = {
        html: body.html,
        lang: body.lang || 'ar',
        format: body.format || 'A4',
        landscape: body.landscape || false,
        marginTop: body.marginTop,
        marginBottom: body.marginBottom,
        marginLeft: body.marginLeft,
        marginRight: body.marginRight,
        headerHtml: body.headerHtml,
        footerHtml: body.footerHtml,
      };

      const pdfBuffer = await this.pdfService.generatePdf(options);

      const filename = body.filename || `statement_${Date.now()}.pdf`;
      const safeFilename = `statement_${Date.now()}.pdf`;
      const encodedFilename = encodeURIComponent(filename);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`);
      res.setHeader('Content-Length', pdfBuffer.length.toString());
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

      return res.status(200).send(pdfBuffer);
    } catch (error: any) {
      console.error('PdfController Error:', error);
      if (!res.headersSent) {
        return res.status(500).json({
          statusCode: 500,
          message: `PDF generation failed: ${error?.message || error}`,
        });
      }
    }
  }

  /**
   * NEW: Template-based PDF generation.
   * Merges DB saved print template configuration with incoming settings.
   */
  @Post('statement')
  async generateStatement(
    @Body() body: StatementPdfData,
    @Req() req: any,
    @Res() res: any,
  ) {
    try {
      let savedConfig = {};
      const companyId = req.user?.companyId || (body as any).companyId || 'default';
      try {
        const dbTemplate = await this.printTemplatesService.getTemplate(companyId, 'statement');
        if (dbTemplate && dbTemplate.config) {
          savedConfig = dbTemplate.config;
        }
      } catch (e) {
        console.warn('Failed to fetch print template from DB, using fallback:', e);
      }

      const mergedSettings = {
        ...savedConfig,
        ...(body.settings || {}),
      };

      const updatedBody = {
        ...body,
        settings: mergedSettings,
      };

      // 1. Render HTML from Handlebars template with merged settings
      const html = this.templateService.renderStatementHtml(updatedBody);

      // 2. Generate PDF from complete HTML
      const pdfBuffer = await this.pdfService.generateFromHtml(html);

      // 3. Build safe filename
      const safeName = `statement_${Date.now()}.pdf`;
      const arabicName = `كشف_حساب_${body.accountCode || body.accountName}_${body.startDate}.pdf`;
      const encodedName = encodeURIComponent(arabicName);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${safeName}"; filename*=UTF-8''${encodedName}`);
      res.setHeader('Content-Length', pdfBuffer.length.toString());
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

      return res.status(200).send(pdfBuffer);
    } catch (error: any) {
      console.error('PdfController Statement Error:', error);
      if (!res.headersSent) {
        return res.status(500).json({
          statusCode: 500,
          message: `Statement PDF generation failed: ${error?.message || error}`,
        });
      }
    }
  }
}
