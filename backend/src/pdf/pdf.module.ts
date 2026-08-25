import { Module } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { PdfController } from './pdf.controller';
import { TemplateService } from './template.service';
import { PrintTemplatesModule } from '../print-templates/print-templates.module';

@Module({
  imports: [PrintTemplatesModule],
  controllers: [PdfController],
  providers: [PdfService, TemplateService],
  exports: [PdfService, TemplateService],
})
export class PdfModule {}
