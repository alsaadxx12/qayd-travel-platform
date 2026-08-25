import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SmartParserService, ParsedTicketDataDto } from './smart-parser.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('smart-parser')
@UseGuards(JwtAuthGuard)
export class SmartParserController {
  constructor(private readonly smartParserService: SmartParserService) {}

  @Post('parse-ticket')
  @UseInterceptors(FileInterceptor('ticketFile'))
  async parseTicket(
    @UploadedFile() file?: any,
    @Body('textContent') textContent?: string,
  ): Promise<ParsedTicketDataDto> {
    const fileBuffer = file?.buffer || Buffer.from(textContent || '', 'utf-8');
    const mimetype = file?.mimetype || 'text/plain';
    return this.smartParserService.parseTicketFile(fileBuffer, mimetype, textContent);
  }
}
