import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BranchesService, CreateBranchDto, UpdateBranchDto } from './branches.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('إدارة الفروع والهيكلة')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  private assertBranchAccess(req: any, branchId: string) {
    if (
      req.user?.branchAccessResolved === true &&
      req.user?.canAccessAllBranches !== true &&
      (!Array.isArray(req.user?.allowedBranchIds) || !req.user.allowedBranchIds.includes(branchId))
    ) {
      throw new ForbiddenException('لا تملك صلاحية الوصول إلى الفرع المحدد');
    }
  }

  @Get()
  @ApiOperation({ summary: 'قائمة فروع الشركة الهيكلية' })
  async findAll(@Req() req: any) {
    return this.branchesService.findAll(
      req.user.companyId,
      Array.isArray(req.user.allowedBranchIds) ? req.user.allowedBranchIds : [],
      req.user.branchAccessResolved === true && req.user.canAccessAllBranches !== true,
    );
  }

  @Get('login-options')
  @ApiOperation({ summary: 'الفروع النشطة والمتاحة للمستخدم عند تسجيل الدخول' })
  async findLoginOptions(@Req() req: any) {
    return this.branchesService.findLoginOptions(
      req.user.companyId,
      Array.isArray(req.user.allowedBranchIds) ? req.user.allowedBranchIds : [],
      req.user.branchAccessResolved === true && req.user.canAccessAllBranches !== true,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'تفاصيل فرع محدد' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    this.assertBranchAccess(req, id);
    return this.branchesService.findOne(id, req.user.companyId);
  }

  @Post()
  @ApiOperation({ summary: 'إضافة فرع جديد للشركة' })
  async create(@Req() req: any, @Body() dto: CreateBranchDto) {
    return this.branchesService.create(req.user.companyId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'تعديل بيانات أو مدير الفرع' })
  async update(@Param('id') id: string, @Req() req: any, @Body() dto: UpdateBranchDto) {
    this.assertBranchAccess(req, id);
    return this.branchesService.update(id, req.user.companyId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'حذف فرع' })
  async delete(@Param('id') id: string, @Req() req: any) {
    this.assertBranchAccess(req, id);
    return this.branchesService.delete(id, req.user.companyId);
  }

  @Post('upload-logo')
  @ApiOperation({ summary: 'رفع شعار الفرع مباشرة إلى Supabase Storage Bucket (branch-images)' })
  async uploadLogo(@Body() body: { fileName: string; fileBase64: string }) {
    return this.branchesService.uploadBranchLogo(body.fileName, body.fileBase64);
  }
}
