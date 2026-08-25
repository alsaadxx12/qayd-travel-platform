import { Module } from '@nestjs/common';
import { SmartParserController } from './smart-parser.controller';
import { SmartParserService } from './smart-parser.service';

@Module({
  controllers: [SmartParserController],
  providers: [SmartParserService],
  exports: [SmartParserService],
})
export class SmartParserModule {}
