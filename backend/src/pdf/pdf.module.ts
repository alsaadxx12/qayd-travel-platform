import { Module } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { PdfController } from './pdf.controller';
import { TemplateService } from './template.service';
import { StatementPdfService } from './statement-pdf.service';
import { PrintTemplatesModule } from '../print-templates/print-templates.module';
import { StatementPortalModule } from '../statement-portal/statement-portal.module';

@Module({
  imports: [PrintTemplatesModule, StatementPortalModule],
  controllers: [PdfController],
  providers: [PdfService, TemplateService, StatementPdfService],
  exports: [PdfService, TemplateService, StatementPdfService],
})
export class PdfModule {}
