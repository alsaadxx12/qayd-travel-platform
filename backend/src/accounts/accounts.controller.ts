import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AccountsService, CreateAccountDto, UpdateAccountDto, ImportTreeDto } from './accounts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccountType, AccountCategory } from '@prisma/client';

@ApiTags('شجرة الحسابات')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get('balances/verify')
  @ApiOperation({
    summary: 'مقارنة أرصدة الحسابات بين الحساب المجمّع (SQL) والحساب القديم (مسح السطور) للتحقق قبل الاعتماد',
  })
  async verifyBalances(@Req() req: any, @Query('tolerance') tolerance?: string) {
    const tol = Number(tolerance);
    return this.accountsService.verifyBalanceAggregation(
      req.user.companyId,
      Number.isFinite(tol) && tol >= 0 ? tol : 0.01,
    );
  }

  @Get('tree')
  @ApiOperation({ summary: 'جلب شجرة الحسابات الهرمية كاملة' })
  async getTree(@Req() req: any, @Query('lite') lite?: string) {
    return this.accountsService.getTree(req.user.companyId, lite === '1' || lite === 'true');
  }

  @Get()
  @ApiOperation({ summary: 'قائمة الحسابات مسطحة مع تصفية النوع والفئة' })
  async findAll(
    @Req() req: any,
    @Query('type') type?: AccountType,
    @Query('category') category?: AccountCategory,
    @Query('includeTrend') includeTrend?: string,
    @Query('lite') lite?: string,
  ) {
    return this.accountsService.findAll(
      req.user.companyId,
      type,
      category,
      includeTrend === 'true',
      lite === '1' || lite === 'true',
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'تفاصيل حساب محاسبي محدد' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.accountsService.findOne(id, req.user.companyId);
  }

  @Post()
  @ApiOperation({ summary: 'إضافة حساب جديد في شجرة الحسابات' })
  async create(@Req() req: any, @Body() dto: CreateAccountDto) {
    return this.accountsService.create(req.user.companyId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'تعديل بيانات حساب محاسبي قائم' })
  async update(@Param('id') id: string, @Req() req: any, @Body() dto: UpdateAccountDto) {
    return this.accountsService.update(id, req.user.companyId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'حذف حساب محاسبي' })
  async delete(@Param('id') id: string, @Req() req: any) {
    return this.accountsService.delete(id, req.user.companyId);
  }
  @Post('import-tree')
  @ApiOperation({ summary: 'استيراد شجرة الحسابات بالكامل دفعة واحدة مع خيار مسح الشجرة الحالية' })
  async importTree(@Req() req: any, @Body() dto: ImportTreeDto) {
    return this.accountsService.importTree(req.user.companyId, dto.accounts || [], dto.wipeExisting ?? true);
  }

  @Delete('wipe-all')
  @ApiOperation({ summary: 'مسح شجرة الحسابات بالكامل للشركة' })
  async wipeAll(@Req() req: any) {
    return this.accountsService.wipeAll(req.user.companyId);
  }
}
