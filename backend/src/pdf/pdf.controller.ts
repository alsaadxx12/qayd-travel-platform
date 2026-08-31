import { Controller, Get, Post, Body, Res, Req, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PdfService, PdfGenerateOptions } from './pdf.service';
import type { StatementPdfData } from './template.service';
import { StatementPdfService } from './statement-pdf.service';
import { IsString, IsOptional, IsBoolean, IsIn } from 'class-validator';

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
    private readonly statementPdfService: StatementPdfService,
  ) {}

  /**
   * What the PDF engine can actually do on THIS server.
   *
   * A statement failing to render is a fact about the machine, and the only way to
   * learn why used to be reading the logs. This answers it directly: which browser
   * path was configured, whether that path exists, and which binary was found.
   *
   * Guarded, because it reports filesystem paths from the server. Useful to an
   * administrator, and nobody else's business.
   */
  @Get('health')
  @UseGuards(JwtAuthGuard)
  async health() {
    return this.pdfService.browserDiagnostics();
  }

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
  @UseGuards(JwtAuthGuard)
  async generateStatement(
    @Body() body: StatementPdfData,
    @Req() req: any,
    @Res() res: any,
  ) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) {
        throw new HttpException('تعذر تحديد الشركة لتوليد الكشف', HttpStatus.UNAUTHORIZED);
      }
      const generated = await this.statementPdfService.generate(companyId, body);
      const encodedName = encodeURIComponent(generated.downloadName);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${generated.filename}"; filename*=UTF-8''${encodedName}`,
      );
      res.setHeader('Content-Length', generated.buffer.length.toString());
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

      return res.status(200).send(generated.buffer);
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
