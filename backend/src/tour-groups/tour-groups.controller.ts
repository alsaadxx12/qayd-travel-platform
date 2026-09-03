import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TourGroupsService } from './tour-groups.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('نظام الكروبات (Tour Groups)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tour-groups')
export class TourGroupsController {
  constructor(private readonly svc: TourGroupsService) {}

  @Get()
  @ApiOperation({ summary: 'كل الكروبات مع ملخّص كلٍّ منها' })
  list(@Req() req: any) {
    return this.svc.list(req.user.companyId);
  }

  @Post()
  @ApiOperation({ summary: 'إنشاء كروب' })
  create(@Req() req: any, @Body() dto: any) {
    return this.svc.create(req.user.companyId, dto, req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'ملف الكروب كاملاً: الأنظمة والمشتريات والمسافرون والملخّص' })
  getOne(@Req() req: any, @Param('id') id: string) {
    return this.svc.getOne(req.user.companyId, id);
  }

  @Put(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.svc.update(req.user.companyId, id, dto, req.user.id);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.svc.remove(req.user.companyId, id, req.user.id);
  }

  @Post(':id/price-systems')
  @ApiOperation({ summary: 'إنشاء أو تعديل نظام أسعار ببنوده (Auto Purchases)' })
  savePriceSystem(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.svc.savePriceSystem(req.user.companyId, id, dto, req.user.id);
  }

  @Delete(':id/price-systems/:psId')
  removePriceSystem(@Req() req: any, @Param('id') id: string, @Param('psId') psId: string) {
    return this.svc.removePriceSystem(req.user.companyId, id, psId, req.user.id);
  }

  @Post(':id/charges')
  @ApiOperation({ summary: 'إضافة شراء عام أو مصروف' })
  addCharge(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.svc.addCharge(req.user.companyId, id, dto, req.user.id);
  }

  @Delete(':id/charges/:chargeId')
  removeCharge(@Req() req: any, @Param('id') id: string, @Param('chargeId') chargeId: string) {
    return this.svc.removeCharge(req.user.companyId, id, chargeId, req.user.id);
  }

  @Post(':id/passengers')
  @ApiOperation({ summary: 'بيع مقعد: مسافرٌ تُستنسخ له خدمات نظامه Not Complete — معاملة واحدة' })
  addPassenger(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.svc.addPassenger(req.user.companyId, id, dto, req.user.id);
  }

  @Put(':id/passengers/:paxId')
  updatePassenger(@Req() req: any, @Param('id') id: string, @Param('paxId') paxId: string, @Body() dto: any) {
    return this.svc.updatePassenger(req.user.companyId, id, paxId, dto, req.user.id);
  }

  @Put(':id/services/:serviceId')
  @ApiOperation({ summary: 'تحديث خدمة مسافر — Final Buy يقلبها Complete ويُدوَّن التغيير' })
  updateService(@Req() req: any, @Param('id') id: string, @Param('serviceId') serviceId: string, @Body() dto: any) {
    return this.svc.updateService(req.user.companyId, id, serviceId, dto, req.user.id);
  }
}
