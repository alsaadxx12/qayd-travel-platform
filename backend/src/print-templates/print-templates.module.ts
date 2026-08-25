import { Module } from '@nestjs/common';
import { PrintTemplatesService } from './print-templates.service';
import { PrintTemplatesController } from './print-templates.controller';

@Module({
  controllers: [PrintTemplatesController],
  providers: [PrintTemplatesService],
  exports: [PrintTemplatesService],
})
export class PrintTemplatesModule {}
