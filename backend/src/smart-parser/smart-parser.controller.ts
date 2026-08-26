import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFiles,
  Body,
  UseGuards,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { SmartParserService, ParsedTicketDataDto, ParsedVisaDataDto } from './smart-parser.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('smart-parser')
@UseGuards(JwtAuthGuard)
export class SmartParserController {
  constructor(private readonly smartParserService: SmartParserService) {}

  @Post('parse-ticket')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'ticketFile', maxCount: 1 },
        { name: 'pageImages', maxCount: 4 },
      ],
      { limits: { fileSize: 16 * 1024 * 1024 } },
    ),
  )
  async parseTicket(
    @UploadedFiles()
    files?: { ticketFile?: any[]; pageImages?: any[] },
    @Body('textContent') textContent?: string,
  ): Promise<ParsedTicketDataDto> {
    const ticketFile = files?.ticketFile?.[0];
    const pageImages = (files?.pageImages || []).map((f) => ({
      buffer: f.buffer as Buffer,
      mimetype: f.mimetype || 'image/jpeg',
    }));
    const fileBuffer = ticketFile?.buffer || Buffer.from(textContent || '', 'utf-8');
    const mimetype = ticketFile?.mimetype || 'text/plain';
    return this.smartParserService.parseTicketFile(fileBuffer, mimetype, textContent, pageImages);
  }

  @Post('parse-visa')
  async parseVisa(
    @Body('textContent') textContent?: string,
    @Body('defaultVisaType') defaultVisaType?: string,
    @Body('availableVisaTypes') availableVisaTypes?: string[] | string,
  ): Promise<ParsedVisaDataDto> {
    const types = Array.isArray(availableVisaTypes)
      ? availableVisaTypes
      : String(availableVisaTypes || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
    return this.smartParserService.parseVisaText({
      textContent: textContent || '',
      defaultVisaType,
      availableVisaTypes: types,
    });
  }
}
