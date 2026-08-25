import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { SubscriptionsService, UpdatePlanDto, RecordPaymentDto } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  /**
   * Public endpoint: Available Plans for pricing page & sign-up
   */
  @Get('plans')
  async getPublicPlans() {
    return this.subscriptionsService.getPublicPlans();
  }

  /**
   * Admin endpoint: Full Plans with all versions and subscriber counts
   */
  @Get('admin/plans')
  @UseGuards(JwtAuthGuard)
  async getAllPlansAdmin() {
    return this.subscriptionsService.getAllPlansAdmin();
  }

  @Put('admin/plans/:id')
  @UseGuards(JwtAuthGuard)
  async updatePlan(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.subscriptionsService.updatePlan(id, dto);
  }

  @Put('admin/plans/:id/features/:featureCode')
  @UseGuards(JwtAuthGuard)
  async togglePlanFeature(
    @Param('id') planId: string,
    @Param('featureCode') featureCode: string,
    @Body('isEnabled') isEnabled: boolean,
  ) {
    return this.subscriptionsService.togglePlanFeature(planId, featureCode, isEnabled);
  }

  @Post('admin/features')
  @UseGuards(JwtAuthGuard)
  async createFeature(@Body() dto: any) {
    return this.subscriptionsService.createFeature(dto);
  }

  @Put('admin/features/:featureCode')
  @UseGuards(JwtAuthGuard)
  async updateFeature(@Param('featureCode') featureCode: string, @Body() dto: any) {
    return this.subscriptionsService.updateFeature(featureCode, dto);
  }

  @Delete('admin/features/:featureCode')
  @UseGuards(JwtAuthGuard)
  async deleteFeature(@Param('featureCode') featureCode: string) {
    return this.subscriptionsService.deleteFeature(featureCode);
  }

  @Get('tenant/:tenantId')
  @UseGuards(JwtAuthGuard)
  async getTenantSubscription(@Param('tenantId') tenantId: string) {
    return this.subscriptionsService.getTenantSubscription(tenantId);
  }

  @Post('tenant/:tenantId/change-plan')
  @UseGuards(JwtAuthGuard)
  async changePlan(
    @Param('tenantId') tenantId: string,
    @Body('planCode') planCode: string,
    @Request() req: any,
  ) {
    return this.subscriptionsService.changePlan(tenantId, planCode, req.user?.userId);
  }

  @Post('tenant/:tenantId/renew')
  @UseGuards(JwtAuthGuard)
  async renewSubscription(
    @Param('tenantId') tenantId: string,
    @Body() dto: RecordPaymentDto,
    @Request() req: any,
  ) {
    return this.subscriptionsService.renewSubscription(tenantId, dto, req.user?.userId);
  }

  @Post('tenant/:tenantId/suspend')
  @UseGuards(JwtAuthGuard)
  async suspendSubscription(
    @Param('tenantId') tenantId: string,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    return this.subscriptionsService.suspendSubscription(tenantId, reason || 'تعليق إداري من مدير المنصة', req.user?.userId);
  }

  @Get('admin/subscriptions-history')
  @UseGuards(JwtAuthGuard)
  async getAllSubscriptionsHistory() {
    return this.subscriptionsService.getAllSubscriptionsHistory();
  }

  @Put('admin/payments/:id')
  @UseGuards(JwtAuthGuard)
  async updatePayment(
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.subscriptionsService.updatePayment(id, dto);
  }

  @Post('admin/payments/:id/cancel')
  @UseGuards(JwtAuthGuard)
  async cancelPayment(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    return this.subscriptionsService.cancelPayment(id, reason, req.user?.userId);
  }

  @Delete('admin/payments/:id')
  @UseGuards(JwtAuthGuard)
  async deletePayment(@Param('id') id: string) {
    return this.subscriptionsService.deletePayment(id);
  }

  @Post('admin/payments/manual')
  @UseGuards(JwtAuthGuard)
  async createManualPayment(
    @Body() dto: any,
    @Request() req: any,
  ) {
    return this.subscriptionsService.createManualPayment(dto, req.user?.userId);
  }

  @Get('payment-methods')
  async getPaymentMethods() {
    return this.subscriptionsService.getPaymentMethods();
  }

  @Put('admin/payment-methods')
  @UseGuards(JwtAuthGuard)
  async updatePaymentMethods(@Body() methods: any) {
    return this.subscriptionsService.updatePaymentMethods(methods);
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  async submitCheckout(@Body() dto: any, @Request() req: any) {
    const tenantId = req.user?.tenantId || req.user?.companyId;
    return this.subscriptionsService.submitCheckout(tenantId, dto, req.user?.userId || req.user?.id);
  }

  @Get('admin/pending-renewals')
  @UseGuards(JwtAuthGuard)
  async getPendingRenewals() {
    return this.subscriptionsService.getPendingRenewals();
  }

  @Post('admin/approve-renewal/:paymentId')
  @UseGuards(JwtAuthGuard)
  async approveRenewal(@Param('paymentId') paymentId: string, @Request() req: any) {
    return this.subscriptionsService.approveRenewal(paymentId, req.user?.userId);
  }

  @Post('admin/reject-renewal/:paymentId')
  @UseGuards(JwtAuthGuard)
  async rejectRenewal(
    @Param('paymentId') paymentId: string,
    @Body('reason') reason: string,
    @Request() req: any
  ) {
    return this.subscriptionsService.rejectRenewal(paymentId, reason, req.user?.userId);
  }

  @Post('tenant/:tenantId/reactivate')
  @UseGuards(JwtAuthGuard)
  async reactivateSubscription(@Param('tenantId') tenantId: string, @Request() req: any) {
    return this.subscriptionsService.reactivateSubscription(tenantId, req.user?.userId);
  }
}
