import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JournalEntriesService, CreateJournalEntryDto } from './journal-entries.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EntryStatus } from '@prisma/client';

@ApiTags('القيود اليومية (Journal Entries)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('journal-entries')
export class JournalEntriesController {
  constructor(private readonly journalEntriesService: JournalEntriesService) {}

  @Get()
  @ApiOperation({ summary: 'قائمة القيود اليومية مع إمكانية التصفية والبحث' })
  async findAll(
    @Req() req: any,
    @Query('status') status?: EntryStatus,
    @Query('search') search?: string,
    @Query('accountId') accountId?: string,
  ) {
    return this.journalEntriesService.findAll(req.user.companyId, status, search, accountId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'تفاصيل قيد يومي محدد مع السطور والمعلومات' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.journalEntriesService.findOne(id, req.user.companyId);
  }

  @Post()
  @ApiOperation({ summary: 'إنشاء قيد يومية جديد مع التحقق المحاسبي الشديد من التوازن' })
  async create(@Req() req: any, @Body() dto: CreateJournalEntryDto) {
    return this.journalEntriesService.create(req.user.companyId, req.user.userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'تعديل بيانات قيد يومي' })
  async update(@Param('id') id: string, @Req() req: any, @Body() dto: any) {
    return this.journalEntriesService.update(id, req.user.companyId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'حذف قيد يومية أو حركة مالية' })
  async delete(@Param('id') id: string, @Req() req: any) {
    return this.journalEntriesService.delete(id, req.user.companyId, req.user.userId);
  }

  @Post(':id/post')
  @ApiOperation({ summary: 'ترحيل القيد اليومي وتحديث أرصدة الحسابات تلقائياً' })
  async post(@Param('id') id: string, @Req() req: any) {
    return this.journalEntriesService.post(id, req.user.companyId, req.user.userId);
  }

  @Post(':id/reverse')
  @ApiOperation({ summary: 'إلغاء وتعديل خطأ بقيد مرحّل عن طريق إنشاء قيد عكسي' })
  async reverse(@Param('id') id: string, @Req() req: any, @Body('reason') reason: string) {
    return this.journalEntriesService.reverse(id, req.user.companyId, req.user.userId, reason || 'تصحيح خطأ قيد');
  }
}
