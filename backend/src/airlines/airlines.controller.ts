import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AirlinesService, CreateAirlineDto, UpdateAirlineDto } from './airlines.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('إدارة شركات الطيران')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('airlines')
export class AirlinesController {
  constructor(private readonly airlinesService: AirlinesService) {}

  @Get()
  @ApiOperation({ summary: 'قائمة شركات الطيران المتاحة' })
  async findAll(@Req() req: any) {
    return this.airlinesService.findAll(req.user.companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'تفاصيل شركة طيران' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.airlinesService.findOne(id, req.user.companyId);
  }

  @Post()
  @ApiOperation({ summary: 'إضافة شركة طيران جديدة' })
  async create(@Req() req: any, @Body() dto: CreateAirlineDto) {
    return this.airlinesService.create(req.user.companyId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'تعديل شركة طيران وصورتها' })
  async update(@Param('id') id: string, @Req() req: any, @Body() dto: UpdateAirlineDto) {
    return this.airlinesService.update(id, req.user.companyId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'حذف شركة طيران' })
  async delete(@Param('id') id: string, @Req() req: any) {
    return this.airlinesService.delete(id, req.user.companyId);
  }
}
