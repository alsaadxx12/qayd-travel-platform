import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrintTemplatesService } from './print-templates.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('إعدادات وقوالب الطباعة (Print Templates)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('print-templates')
export class PrintTemplatesController {
  constructor(private readonly printTemplatesService: PrintTemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'جلب كافة قوالب الطباعة المحفوظة للشركة من قاعدة البيانات Supabase' })
  async getAllTemplates(@Req() req: any) {
    return this.printTemplatesService.getAllTemplates(req.user.companyId);
  }

  @Get('doc/:docType')
  @ApiOperation({ summary: 'جلب قائمة التصاميم المحفوظات الكاملة لنوع مستند معين' })
  async getTemplatesByDocType(@Param('docType') docType: string, @Req() req: any) {
    return this.printTemplatesService.getTemplatesByDocType(req.user.companyId, docType);
  }

  @Get(':docType')
  @ApiOperation({ summary: 'جلب التصميم المعتمد الفعال لمستند معين من Supabase' })
  async getTemplate(@Param('docType') docType: string, @Req() req: any) {
    return this.printTemplatesService.getTemplate(req.user.companyId, docType);
  }

  @Post()
  @ApiOperation({ summary: 'حفظ وحفظ تصميم مخصص جديد باسم محدد في Supabase' })
  async createTemplate(@Body() body: any, @Req() req: any) {
    return this.printTemplatesService.createTemplate(
      req.user.companyId,
      body.docType,
      body.name,
      body.config,
      body.isDefault,
    );
  }

  @Put(':id')
  @ApiOperation({ summary: 'تحديث تصميم مخصص موجود في Supabase' })
  async updateTemplate(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.printTemplatesService.updateTemplate(
      req.user.companyId,
      id,
      body.name,
      body.config,
      body.isDefault,
    );
  }

  @Post(':id/set-default')
  @ApiOperation({ summary: 'اعتماد تصميم محدد كـ تصميم رسمي مفعّل للكشوفات' })
  async setDefaultTemplate(@Param('id') id: string, @Req() req: any) {
    return this.printTemplatesService.setDefaultTemplate(req.user.companyId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'حذف تصميم محفوظ من Supabase' })
  async deleteTemplate(@Param('id') id: string, @Req() req: any) {
    return this.printTemplatesService.deleteTemplate(req.user.companyId, id);
  }

  @Post(':docType')
  @ApiOperation({ summary: 'حفظ وتحديث القالب المعتمد الحالي في Supabase (توافق سابق)' })
  async saveTemplate(@Param('docType') docType: string, @Body() body: any, @Req() req: any) {
    return this.printTemplatesService.saveTemplate(req.user.companyId, docType, body.config || body, body.name);
  }
}

