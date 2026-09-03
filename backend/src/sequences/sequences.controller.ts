import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SequencesService, type SequenceConfigDto } from './sequences.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('تسلسل ترقيم المستندات (Document Sequences)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sequences')
export class SequencesController {
  constructor(private readonly sequences: SequencesService) {}

  @Get()
  @ApiOperation({ summary: 'تسلسلات ترقيم المستندات المحفوظة للشركة' })
  async list(@Req() req: any, @Query('branchCode') branchCode?: string) {
    return this.sequences.list(req.user.companyId, branchCode || '');
  }

  @Put()
  @ApiOperation({ summary: 'حفظ إعدادات الترقيم' })
  async save(@Req() req: any, @Body() body: { configs: SequenceConfigDto[] }) {
    return this.sequences.save(req.user.companyId, body?.configs || []);
  }

  @Post(':docType/next')
  @ApiOperation({ summary: 'تخصيص الرقم التالي لنوع مستند — ذرّياً' })
  async next(@Req() req: any, @Param('docType') docType: string, @Body() body?: { branchCode?: string }) {
    return this.sequences.allocate(req.user.companyId, docType, body?.branchCode);
  }
}
