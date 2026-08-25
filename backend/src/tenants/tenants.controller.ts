import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import {
  TenantsService,
  CreateTenantDto,
  UpdateTenantDto,
  UpdateOwnerPermissionsDto,
  UpdateDatabaseProviderSettingsDto,
  UpdateTenantDatabaseQuotaDto,
} from './tenants.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantStatus } from '@prisma/client';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getAllTenants(
    @Query('search') search?: string,
    @Query('status') status?: TenantStatus,
  ) {
    return this.tenantsService.getAllTenants(search, status);
  }

  @Get('current')
  @UseGuards(JwtAuthGuard)
  async getCurrentTenant(@Request() req: any) {
    const tenantId = req.user?.tenantId || req.user?.company?.tenantId;
    return this.tenantsService.getTenantById(
      tenantId,
      req.user?.companyId,
      req.user?.userId || req.user?.id || req.user?.sub,
    );
  }

  @Get('current/usage')
  @UseGuards(JwtAuthGuard)
  async getCurrentTenantUsage(@Request() req: any) {
    const tenantId = req.user?.tenantId || req.user?.company?.tenantId;
    return this.tenantsService.getTenantUsage(
      tenantId,
      req.user?.companyId,
      req.user?.userId || req.user?.id || req.user?.sub,
    );
  }

  @Get('database-usage')
  @UseGuards(JwtAuthGuard)
  async getDatabaseUsage(@Request() req: any) {
    return this.tenantsService.getAllTenantDatabaseUsage({
      tenantId: req.user?.tenantId || req.user?.company?.tenantId,
      companyId: req.user?.companyId,
      userId: req.user?.userId || req.user?.id || req.user?.sub,
    });
  }

  @Post('database-usage/measure')
  @UseGuards(JwtAuthGuard)
  async measureDatabaseUsage(@Request() req: any) {
    return this.tenantsService.measureAllTenantDatabaseUsage({
      tenantId: req.user?.tenantId || req.user?.company?.tenantId,
      companyId: req.user?.companyId,
      userId: req.user?.userId || req.user?.id || req.user?.sub,
    });
  }

  @Put('database-provider-settings')
  @UseGuards(JwtAuthGuard)
  async updateDatabaseProviderSettings(
    @Request() req: any,
    @Body() dto: UpdateDatabaseProviderSettingsDto,
  ) {
    return this.tenantsService.updateDatabaseProviderSettings(
      {
        tenantId: req.user?.tenantId || req.user?.company?.tenantId,
        companyId: req.user?.companyId,
        userId: req.user?.userId || req.user?.id || req.user?.sub,
      },
      dto,
    );
  }

  @Put(':id/database-quota')
  @UseGuards(JwtAuthGuard)
  async updateTenantDatabaseQuota(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: UpdateTenantDatabaseQuotaDto,
  ) {
    return this.tenantsService.updateTenantDatabaseQuota(
      id,
      {
        tenantId: req.user?.tenantId || req.user?.company?.tenantId,
        companyId: req.user?.companyId,
        userId: req.user?.userId || req.user?.id || req.user?.sub,
      },
      dto,
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getTenantById(@Param('id') id: string) {
    return this.tenantsService.getTenantById(id);
  }

  @Get(':id/usage')
  @UseGuards(JwtAuthGuard)
  async getTenantUsage(@Param('id') id: string) {
    return this.tenantsService.getTenantUsage(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async createTenant(@Body() dto: CreateTenantDto) {
    return this.tenantsService.createTenant(dto);
  }

  @Post('onboarding')
  async publicOnboarding(@Body() dto: CreateTenantDto) {
    return this.tenantsService.createTenant(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async updateTenant(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.updateTenant(id, dto);
  }

  @Post(':id/suspend')
  @UseGuards(JwtAuthGuard)
  async suspendTenant(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.tenantsService.suspendTenant(id, reason);
  }

  @Post(':id/reactivate')
  @UseGuards(JwtAuthGuard)
  async reactivateTenant(@Param('id') id: string) {
    return this.tenantsService.reactivateTenant(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteTenant(@Param('id') id: string, @Request() req: any) {
    return this.tenantsService.deleteTenant(id, {
      tenantId: req.user?.tenantId || req.user?.company?.tenantId,
      companyId: req.user?.companyId,
      userId: req.user?.userId || req.user?.id || req.user?.sub,
    });
  }

  @Put(':id/owner-permissions')
  @UseGuards(JwtAuthGuard)
  async updateOwnerPermissions(
    @Param('id') id: string,
    @Body() dto: UpdateOwnerPermissionsDto,
  ) {
    return this.tenantsService.updateOwnerPermissions(id, dto.customPermissions, dto.allowedBranchIds);
  }

  @Post(':id/impersonate')
  @UseGuards(JwtAuthGuard)
  async impersonateTenantOwner(@Param('id') id: string) {
    return this.tenantsService.impersonateTenantOwner(id);
  }
}
