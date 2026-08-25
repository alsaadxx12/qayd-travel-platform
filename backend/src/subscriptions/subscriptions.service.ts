import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantStatus, PaymentStatus, BillingCycle } from '@prisma/client';

import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, IsArray } from 'class-validator';

export class UpdatePlanDto {
  @IsString()
  @IsOptional()
  nameAr?: string;

  @IsString()
  @IsOptional()
  nameEn?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  priceMonthlyCents?: number;

  @IsBoolean()
  @IsOptional()
  isRecommended?: boolean;

  @IsArray()
  @IsOptional()
  limits?: Array<{ limitCode: string; nameAr: string; limitValue: number; unit?: string }>;

  @IsArray()
  @IsOptional()
  features?: Array<{ featureCode: string; nameAr: string; category?: string; isEnabled: boolean }>;
}

export class RecordPaymentDto {
  @IsNumber()
  @IsNotEmpty()
  amountCents: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsString()
  @IsOptional()
  transactionRef?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsNumber()
  @IsOptional()
  monthsToAdd?: number;
}

@Injectable()
export class SubscriptionsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Public Plans for Pricing Page & Onboarding
   */
  async getPublicPlans() {
    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        versions: {
          where: { isActive: true },
          orderBy: { versionNumber: 'desc' },
          take: 1,
          include: {
            features: true,
            limits: true,
          },
        },
      },
    });

    return plans.map((p) => {
      const v = p.versions[0];
      return {
        id: p.id,
        code: p.code,
        nameAr: p.nameAr,
        nameEn: p.nameEn,
        description: p.description,
        sortOrder: p.sortOrder,
        versionId: v?.id,
        priceMonthly: v ? v.priceMonthlyCents / 100 : 0,
        priceMonthlyCents: v?.priceMonthlyCents || 0,
        currency: v?.currency || 'USD',
        isRecommended: v?.isRecommended || false,
        features: v?.features || [],
        limits: v?.limits || [],
      };
    });
  }

  /**
   * Admin Plans View
   */
  async getAllPlansAdmin() {
    return this.prisma.plan.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          include: {
            features: true,
            limits: true,
            _count: { select: { subscriptions: true } },
          },
        },
      },
    });
  }

  /**
   * Update Plan & create new version if price or limits changed
   */
  async updatePlan(planId: string, dto: UpdatePlanDto) {
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      include: {
        versions: {
          where: { isActive: true },
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    });

    if (!plan) throw new NotFoundException('الباقة غير موجودة');

    // Update Plan base info
    await this.prisma.plan.update({
      where: { id: planId },
      data: {
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        description: dto.description,
      },
    });

    const currentVersion = plan.versions[0];

    // If price or limits changed, create a new active version
    const priceChanged = dto.priceMonthlyCents !== undefined && dto.priceMonthlyCents !== currentVersion?.priceMonthlyCents;
    const isRecommendedChanged = dto.isRecommended !== undefined && dto.isRecommended !== currentVersion?.isRecommended;

    if (currentVersion && (priceChanged || isRecommendedChanged || dto.limits || dto.features)) {
      const newVersionNumber = currentVersion.versionNumber + 1;

      // Deactivate old version
      await this.prisma.planVersion.update({
        where: { id: currentVersion.id },
        data: { isActive: false, effectiveTo: new Date() },
      });

      // Create new version
      const newVersion = await this.prisma.planVersion.create({
        data: {
          planId: plan.id,
          versionNumber: newVersionNumber,
          priceMonthlyCents: dto.priceMonthlyCents ?? currentVersion.priceMonthlyCents,
          currency: currentVersion.currency,
          isRecommended: dto.isRecommended ?? currentVersion.isRecommended,
          isActive: true,
        },
      });

      // Seed limits
      if (dto.limits) {
        for (const lim of dto.limits) {
          await this.prisma.planLimit.create({
            data: {
              planVersionId: newVersion.id,
              limitCode: lim.limitCode,
              nameAr: lim.nameAr,
              limitValue: lim.limitValue,
              unit: lim.unit,
            },
          });
        }
      }

      // Seed features
      if (dto.features) {
        for (const feat of dto.features) {
          await this.prisma.planFeature.create({
            data: {
              planVersionId: newVersion.id,
              featureCode: feat.featureCode,
              nameAr: feat.nameAr,
              category: feat.category || 'ACCOUNTING',
              isEnabled: feat.isEnabled,
            },
          });
        }
      }

      return { success: true, planId: plan.id, newVersionId: newVersion.id };
    }

    return { success: true, planId: plan.id };
  }

  /**
   * Fast toggle of a single feature without version bump overhead
   */
  async togglePlanFeature(planId: string, featureCode: string, isEnabled: boolean) {
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      include: {
        versions: {
          where: { isActive: true },
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    });

    if (!plan || !plan.versions[0]) throw new NotFoundException('الباقة غير موجودة');

    const version = plan.versions[0];

    const updated = await this.prisma.planFeature.upsert({
      where: {
        planVersionId_featureCode: {
          planVersionId: version.id,
          featureCode,
        },
      },
      update: {
        isEnabled,
      },
      create: {
        planVersionId: version.id,
        featureCode,
        nameAr: featureCode,
        isEnabled,
      },
    });

    return { success: true, feature: updated };
  }

  /**
   * Add a new feature globally across all plan versions
   */
  async createFeature(dto: { featureCode: string; nameAr: string; category: string; defaultEnabled?: boolean }) {
    const activeVersions = await this.prisma.planVersion.findMany({
      where: { isActive: true },
    });

    const featureCode = dto.featureCode.trim().toUpperCase().replace(/\s+/g, '_');

    for (const v of activeVersions) {
      await this.prisma.planFeature.upsert({
        where: {
          planVersionId_featureCode: {
            planVersionId: v.id,
            featureCode,
          },
        },
        update: {
          nameAr: dto.nameAr,
          category: dto.category || 'ACCOUNTING',
        },
        create: {
          planVersionId: v.id,
          featureCode,
          nameAr: dto.nameAr,
          category: dto.category || 'ACCOUNTING',
          isEnabled: dto.defaultEnabled ?? false,
        },
      });
    }

    return { success: true, featureCode };
  }

  /**
   * Update feature details (name, category) across all plan versions
   */
  async updateFeature(featureCode: string, dto: { nameAr?: string; category?: string }) {
    await this.prisma.planFeature.updateMany({
      where: { featureCode },
      data: {
        nameAr: dto.nameAr,
        category: dto.category,
      },
    });

    return { success: true, featureCode };
  }

  /**
   * Permanently delete a feature from all plan versions and comparison tables
   */
  async deleteFeature(featureCode: string) {
    await this.prisma.planFeature.deleteMany({
      where: { featureCode },
    });

    return { success: true, featureCode };
  }

  /**
   * Get Tenant Subscription Details
   */
  async getTenantSubscription(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { isRoot: true },
    });
    if (tenant?.isRoot) {
      throw new BadRequestException('مالك المنصة يعمل بلا باقة وبلا حدود');
    }

    const sub = await this.prisma.tenantSubscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        planVersion: {
          include: {
            plan: true,
            features: true,
            limits: true,
          },
        },
        payments: {
          orderBy: { paidAt: 'desc' },
          take: 10,
        },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!sub) throw new NotFoundException('لا يوجد اشتراك نشط لهذه المؤسسة');

    return sub;
  }

  /**
   * Change Plan (Upgrade / Downgrade)
   */
  async changePlan(tenantId: string, newPlanCode: string, adminUserId?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('المؤسسة غير موجودة');
    if (tenant.isRoot) throw new BadRequestException('مالك المنصة لا يخضع للباقات أو الفوترة');

    const newPlan = await this.prisma.plan.findUnique({
      where: { code: newPlanCode },
      include: {
        versions: {
          where: { isActive: true },
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    });

    if (!newPlan || !newPlan.versions[0]) {
      throw new BadRequestException('الباقة الجديدة غير متوفرة');
    }

    const newVersion = newPlan.versions[0];
    const currentSub = await this.prisma.tenantSubscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    if (!currentSub) throw new NotFoundException('الاشتراك الحالي غير موجود');

    return await this.prisma.$transaction(async (tx) => {
      const updatedSub = await tx.tenantSubscription.update({
        where: { id: currentSub.id },
        data: {
          planVersionId: newVersion.id,
          lockedPriceCents: newVersion.priceMonthlyCents,
          status: 'ACTIVE',
        },
      });

      await tx.subscriptionEvent.create({
        data: {
          subscriptionId: currentSub.id,
          eventType: 'UPGRADED',
          details: JSON.stringify({
            fromPlan: currentSub.planVersionId,
            toPlan: newPlanCode,
            newPriceMonthly: newVersion.priceMonthlyCents / 100,
          }),
          performedById: adminUserId,
        },
      });

      return updatedSub;
    });
  }

  /**
   * Renew Subscription & Record Payment
   */
  async renewSubscription(tenantId: string, dto: RecordPaymentDto, adminUserId?: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { isRoot: true },
    });
    if (tenant?.isRoot) throw new BadRequestException('مالك المنصة لا يخضع للتجديد أو الفوترة');

    const currentSub = await this.prisma.tenantSubscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    if (!currentSub) throw new NotFoundException('الاشتراك غير موجود');

    const monthsToAdd = dto.monthsToAdd || 1;
    const currentEnd = new Date(currentSub.currentPeriodEnd);
    const newEnd = new Date(Math.max(currentEnd.getTime(), Date.now()));
    newEnd.setMonth(newEnd.getMonth() + monthsToAdd);

    return await this.prisma.$transaction(async (tx) => {
      // 1. Update subscription period
      const updatedSub = await tx.tenantSubscription.update({
        where: { id: currentSub.id },
        data: {
          currentPeriodEnd: newEnd,
          status: 'ACTIVE',
        },
      });

      // 2. Record Payment
      await tx.subscriptionPayment.create({
        data: {
          subscriptionId: currentSub.id,
          tenantId,
          amountCents: dto.amountCents,
          currency: dto.currency || 'USD',
          status: 'COMPLETED',
          paymentMethod: dto.paymentMethod || 'MANUAL_ADMIN',
          transactionRef: dto.transactionRef,
          notes: dto.notes,
          receivedById: adminUserId,
        },
      });

      // 3. Log event
      await tx.subscriptionEvent.create({
        data: {
          subscriptionId: currentSub.id,
          eventType: 'RENEWED',
          details: JSON.stringify({
            monthsAdded: monthsToAdd,
            amount: dto.amountCents / 100,
            newExpiry: newEnd.toISOString(),
          }),
          performedById: adminUserId,
        },
      });

      // 4. Ensure tenant status is ACTIVE
      await tx.tenant.update({
        where: { id: tenantId },
        data: { status: 'ACTIVE' },
      });

      return updatedSub;
    });
  }

  /**
   * Suspend Subscription
   */
  async suspendSubscription(tenantId: string, reason: string, adminUserId?: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { isRoot: true },
    });
    if (tenant?.isRoot) throw new BadRequestException('لا يمكن تعليق اشتراك مالك المنصة');

    const currentSub = await this.prisma.tenantSubscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    if (!currentSub) throw new NotFoundException('الاشتراك غير موجود');

    return await this.prisma.$transaction(async (tx) => {
      const updated = await tx.tenantSubscription.update({
        where: { id: currentSub.id },
        data: {
          status: 'SUSPENDED',
          cancellationReason: reason,
        },
      });

      await tx.tenant.update({
        where: { id: tenantId },
        data: { status: 'SUSPENDED' },
      });

      await tx.subscriptionEvent.create({
        data: {
          subscriptionId: currentSub.id,
          eventType: 'SUSPENDED',
          details: JSON.stringify({ reason }),
          performedById: adminUserId,
        },
      });

      return updated;
    });
  }

  /**
   * Reactivate Subscription
   */
  async reactivateSubscription(tenantId: string, adminUserId?: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { isRoot: true },
    });
    if (tenant?.isRoot) throw new BadRequestException('مالك المنصة يعمل دائماً بلا حدود');

    const currentSub = await this.prisma.tenantSubscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    if (!currentSub) throw new NotFoundException('الاشتراك غير موجود');

    return await this.prisma.$transaction(async (tx) => {
      const updated = await tx.tenantSubscription.update({
        where: { id: currentSub.id },
        data: {
          status: 'ACTIVE',
          cancellationReason: null,
        },
      });

      await tx.tenant.update({
        where: { id: tenantId },
        data: { status: 'ACTIVE' },
      });

      await tx.subscriptionEvent.create({
        data: {
          subscriptionId: currentSub.id,
          eventType: 'REACTIVATED',
          performedById: adminUserId,
        },
      });

      return updated;
    });
  }

  /**
   * Central Atomic Limit Validator
   */
  async checkLimit(tenantId: string, limitCode: string, currentCount: number) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { isRoot: true },
    });
    if (tenant?.isRoot) return true;

    const sub = await this.prisma.tenantSubscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        planVersion: {
          include: { limits: true },
        },
      },
    });

    if (!sub || sub.status === 'SUSPENDED' || sub.status === 'CANCELLED') {
      throw new ForbiddenException('الاشتراك معلق أو غير نشط. يرجى تجديد الاشتراك للمتابعة.');
    }

    const limit = sub.planVersion.limits.find((l) => l.limitCode === limitCode);
    if (!limit) return true;

    // -1 = Unlimited
    if (limit.limitValue === -1) return true;

    if (currentCount >= limit.limitValue) {
      throw new ForbiddenException(
        `وصلت المؤسسة إلى الحد الأقصى المسموح (${limit.limitValue} ${limit.unit || ''}) في باقتك الحالية (${limit.nameAr}). يرجى ترقية الباقة لزيادة الحد.`
      );
    }

    return true;
  }

  /**
   * Get all subscriptions and payment history for all companies
   */
  async getAllSubscriptionsHistory() {
    const payments = await this.prisma.subscriptionPayment.findMany({
      where: { tenant: { isRoot: false } },
      orderBy: { paidAt: 'desc' },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            email: true,
            phone: true,
            status: true,
            isRoot: true,
          },
        },
        subscription: {
          include: {
            planVersion: {
              include: {
                plan: true,
              },
            },
          },
        },
      },
    });

    return payments.map((p) => ({
      id: p.id,
      paymentId: p.id,
      subscriptionId: p.subscriptionId,
      tenantId: p.tenantId,
      tenant: p.tenant,
      planVersion: p.subscription?.planVersion || null,
      plan: p.subscription?.planVersion?.plan || null,
      planName: p.subscription?.planVersion?.plan?.nameAr || p.subscription?.planVersion?.plan?.code || 'باقة مخصصة',
      amount: p.amountCents / 100,
      amountCents: p.amountCents,
      currency: p.currency || 'USD',
      status: p.status,
      paymentMethod: p.paymentMethod || 'MASTERCARD',
      transactionRef: p.transactionRef,
      receiptUrl: p.receiptUrl,
      notes: p.notes,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
      startDate: p.subscription?.currentPeriodStart,
      endDate: p.subscription?.currentPeriodEnd,
      periodStart: p.subscription?.currentPeriodStart,
      periodEnd: p.subscription?.currentPeriodEnd,
    }));
  }

  async updatePayment(id: string, dto: { amountCents?: number; currency?: string; paymentMethod?: string; transactionRef?: string; notes?: string; status?: string; paidAt?: string }) {
    if (id.startsWith('sub-init-')) {
      const subId = id.replace('sub-init-', '');
      const sub = await this.prisma.tenantSubscription.findUnique({ where: { id: subId } });
      if (!sub) throw new NotFoundException('الاشتراك غير موجود');
      const payment = await this.prisma.subscriptionPayment.create({
        data: {
          subscriptionId: sub.id,
          tenantId: sub.tenantId,
          amountCents: dto.amountCents !== undefined ? dto.amountCents : sub.lockedPriceCents,
          currency: dto.currency || sub.currency || 'USD',
          status: (dto.status as any) || 'COMPLETED',
          paymentMethod: dto.paymentMethod || 'MANUAL_ADMIN',
          transactionRef: dto.transactionRef,
          notes: dto.notes,
          paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
        },
      });
      return payment;
    }

    const payment = await this.prisma.subscriptionPayment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('الدفعة غير موجودة');

    const updateData: any = {};
    if (dto.amountCents !== undefined) updateData.amountCents = dto.amountCents;
    if (dto.currency) updateData.currency = dto.currency;
    if (dto.paymentMethod) updateData.paymentMethod = dto.paymentMethod;
    if (dto.transactionRef !== undefined) updateData.transactionRef = dto.transactionRef;
    if (dto.notes !== undefined) updateData.notes = dto.notes;
    if (dto.status) updateData.status = dto.status as any;
    if (dto.paidAt) updateData.paidAt = new Date(dto.paidAt);

    return this.prisma.subscriptionPayment.update({
      where: { id },
      data: updateData,
    });
  }

  async cancelPayment(id: string, reason?: string, adminUserId?: string) {
    if (id.startsWith('sub-init-')) {
      return { success: true };
    }
    const payment = await this.prisma.subscriptionPayment.findUnique({
      where: { id },
      include: { subscription: true },
    });
    if (!payment) throw new NotFoundException('الدفعة غير موجودة');

    return await this.prisma.$transaction(async (tx) => {
      const updated = await tx.subscriptionPayment.update({
        where: { id },
        data: {
          status: 'REFUNDED',
          notes: JSON.stringify({
            ...(payment.notes ? (payment.notes.startsWith('{') ? JSON.parse(payment.notes) : { originalNotes: payment.notes }) : {}),
            cancellationReason: reason || 'تم إلغاء الدفعة واستردادها من قبل مسؤول النظام',
            cancelledAt: new Date().toISOString(),
          }),
        },
      });

      await tx.subscriptionEvent.create({
        data: {
          subscriptionId: payment.subscriptionId,
          eventType: 'CANCELLED',
          details: JSON.stringify({
            paymentId: id,
            amount: payment.amountCents / 100,
            reason: reason || 'تم إلغاء الدفعة',
          }),
          performedById: adminUserId,
        },
      });

      return updated;
    });
  }

  async deletePayment(id: string) {
    if (id.startsWith('sub-init-')) {
      return { success: true };
    }
    const payment = await this.prisma.subscriptionPayment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('الدفعة غير موجودة');
    return this.prisma.subscriptionPayment.delete({ where: { id } });
  }

  async createManualPayment(dto: {
    tenantId: string;
    amountCents: number;
    currency?: string;
    monthsToAdd?: number;
    paymentMethod?: string;
    transactionRef?: string;
    notes?: string;
    paidAt?: string;
  }, adminUserId?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: dto.tenantId } });
    if (!tenant) throw new NotFoundException('المؤسسة غير موجودة');
    if (tenant.isRoot) throw new BadRequestException('مالك المنصة لا يخضع للباقات أو المدفوعات');

    let sub = await this.prisma.tenantSubscription.findFirst({
      where: { tenantId: dto.tenantId },
      orderBy: { createdAt: 'desc' },
    });

    if (!sub) {
      const defaultPlan = await this.prisma.planVersion.findFirst({
        where: { isActive: true },
        orderBy: { versionNumber: 'desc' },
      });
      if (!defaultPlan) throw new BadRequestException('لا توجد باقة نشطة');

      const now = new Date();
      const end = new Date();
      end.setMonth(end.getMonth() + (dto.monthsToAdd || 1));

      sub = await this.prisma.tenantSubscription.create({
        data: {
          tenantId: dto.tenantId,
          planVersionId: defaultPlan.id,
          status: 'ACTIVE',
          billingCycle: 'MONTHLY',
          lockedPriceCents: dto.amountCents,
          currency: dto.currency || 'USD',
          startedAt: now,
          currentPeriodStart: now,
          currentPeriodEnd: end,
        },
      });
    } else if (dto.monthsToAdd && dto.monthsToAdd > 0) {
      const currentEnd = new Date(sub.currentPeriodEnd);
      const newEnd = new Date(Math.max(currentEnd.getTime(), Date.now()));
      newEnd.setMonth(newEnd.getMonth() + dto.monthsToAdd);

      await this.prisma.tenantSubscription.update({
        where: { id: sub.id },
        data: {
          currentPeriodEnd: newEnd,
          status: 'ACTIVE',
        },
      });
    }

    const paymentDate = dto.paidAt ? new Date(dto.paidAt) : new Date();

    const payment = await this.prisma.subscriptionPayment.create({
      data: {
        subscriptionId: sub.id,
        tenantId: dto.tenantId,
        amountCents: dto.amountCents,
        currency: dto.currency || 'USD',
        status: 'COMPLETED',
        paymentMethod: dto.paymentMethod || 'MANUAL_ADMIN',
        transactionRef: dto.transactionRef || `MANUAL-${Date.now()}`,
        notes: dto.notes,
        receivedById: adminUserId,
        paidAt: paymentDate,
      },
    });

    return payment;
  }

  /**
   * Get Payment Methods Configuration (stored in root tenant or default)
   */
  async getPaymentMethods() {
    const rootTenant = await this.prisma.tenant.findFirst({
      where: { isRoot: true },
    });

    const defaultMethods = {
      mastercard: {
        enabled: true,
        cardHolder: 'AZIZ KHAMEES SADEQ',
        cardNumber: '5826553934',
        fullCardNumber: '5826553934',
        bankName: 'مصرف الرافدين - RAFIDAIN BANK',
        iban: 'IQ24TBII0000123456789012',
        expiryDate: '12/28',
        cardType: 'Qi Card Mastercard Debit',
        badgeColor: '#10B981',
        instructions: 'يرجى تحويل قيمة الاشتراك إلى رقم الحساب / البطاقة وإرسال صورة الإشعار أو رقم المعاملة.',
      },
      qiCard: {
        enabled: true,
        accountNumber: '5826553934',
        accountName: 'AZIZ KHAMEES SADEQ',
        instructions: 'تحويل مباشر عبر تطبيق خدماتي / كي كارد إلى رقم الحساب.',
      },
      zainCash: {
        enabled: true,
        phoneNumber: '07800003901',
        walletName: 'محفظة زين كاش التجارية',
        instructions: 'يرجى التحويل المباشر إلى رقم المحفظة وكتابة اسم شركتك في الملاحظات.',
      },
      fib: {
        enabled: true,
        iban: 'IQ88FIBB0000998877665544',
        accountName: 'First Iraqi Bank (FIB)',
        instructions: 'تحويل فوري عبر تطبيق FIB المصرفي.',
      },
    };

    if (!rootTenant || !rootTenant.customSettings) {
      return defaultMethods;
    }

    try {
      const parsed = JSON.parse(rootTenant.customSettings);
      return parsed.paymentMethods || defaultMethods;
    } catch {
      return defaultMethods;
    }
  }

  /**
   * Update Payment Methods Configuration
   */
  async updatePaymentMethods(methods: any) {
    const rootTenant = await this.prisma.tenant.findFirst({
      where: { isRoot: true },
    });

    if (!rootTenant) throw new NotFoundException('الحساب المركزي للمنصة غير موجود');

    let currentSettings: any = {};
    if (rootTenant.customSettings) {
      try {
        currentSettings = JSON.parse(rootTenant.customSettings);
      } catch {}
    }

    currentSettings.paymentMethods = methods;

    await this.prisma.tenant.update({
      where: { id: rootTenant.id },
      data: {
        customSettings: JSON.stringify(currentSettings),
      },
    });

    return { success: true, paymentMethods: methods };
  }

  /**
   * Submit Checkout / Upgrade Request by a Tenant (Supports receipt attachments and pending verification)
   */
  async submitCheckout(
    tenantId: string,
    dto: {
      planCode: string;
      billingCycle?: BillingCycle;
      paymentMethod: string;
      transactionRef?: string;
      notes?: string;
      receiptUrls?: string[];
      amountCents: number;
    },
    userId?: string
  ) {
    let targetTenantId = tenantId;
    let tenant = targetTenantId && targetTenantId !== 'default-company-id'
      ? await this.prisma.tenant.findUnique({ where: { id: targetTenantId } })
      : null;

    if (!tenant) {
      tenant = (await this.prisma.tenant.findFirst({ where: { isRoot: false } })) || (await this.prisma.tenant.findFirst());
      if (tenant) targetTenantId = tenant.id;
    }

    if (!tenant || !targetTenantId) throw new NotFoundException('المؤسسة غير موجودة');
    if (tenant.isRoot) throw new BadRequestException('مالك المنصة لا يخضع للباقات أو المدفوعات');

    const plan = await this.prisma.plan.findUnique({
      where: { code: dto.planCode },
      include: {
        versions: {
          where: { isActive: true },
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    });
    if (!plan || !plan.versions[0]) throw new NotFoundException('الباقة غير موجودة');

    const version = plan.versions[0];
    const isFreeTrial = dto.planCode === 'FREE_TRIAL';

    // Find current subscription
    let currentSub = await this.prisma.tenantSubscription.findFirst({
      where: { tenantId: targetTenantId },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    const durationMonths = dto.planCode === 'PRO' || dto.planCode === 'ENTERPRISE' ? 3 : 1;
    const nextPeriodEnd = new Date(now);
    if (isFreeTrial) {
      nextPeriodEnd.setDate(nextPeriodEnd.getDate() + 14);
    } else {
      nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + durationMonths);
    }

    return await this.prisma.$transaction(async (tx) => {
      let subId = currentSub?.id;

      if (!currentSub) {
        const created = await tx.tenantSubscription.create({
          data: {
            tenantId: targetTenantId,
            planVersionId: version.id,
            status: isFreeTrial ? 'ACTIVE' : (tenant.status === 'ACTIVE' ? 'ACTIVE' : 'TRIAL'),
            billingCycle: dto.billingCycle || 'MONTHLY',
            lockedPriceCents: dto.amountCents,
            currentPeriodStart: now,
            currentPeriodEnd: nextPeriodEnd,
          },
        });
        subId = created.id;
      }

      // If Free Trial, activate immediately
      if (isFreeTrial) {
        await tx.tenantSubscription.update({
          where: { id: subId! },
          data: {
            planVersionId: version.id,
            status: 'ACTIVE',
            currentPeriodStart: now,
            currentPeriodEnd: nextPeriodEnd,
          },
        });
        await tx.tenant.update({
          where: { id: targetTenantId },
          data: { status: 'ACTIVE' },
        });
        return { success: true, subscriptionId: subId, activatedImmediately: true };
      }

      // Paid Plan: Create payment record with status PENDING for admin verification
      const receiptStr = dto.receiptUrls && dto.receiptUrls.length > 0 ? JSON.stringify(dto.receiptUrls) : null;
      const payment = await tx.subscriptionPayment.create({
        data: {
          subscriptionId: subId!,
          tenantId: targetTenantId,
          amountCents: dto.amountCents,
          currency: 'USD',
          status: 'PENDING',
          paymentMethod: dto.paymentMethod || 'MASTERCARD',
          transactionRef: dto.transactionRef,
          receiptUrl: receiptStr,
          notes: JSON.stringify({
            requestedPlanCode: dto.planCode,
            requestedPlanName: plan.nameAr,
            customerNotes: dto.notes,
          }),
          receivedById: userId,
        },
      });

      // Record event
      await tx.subscriptionEvent.create({
        data: {
          subscriptionId: subId!,
          eventType: 'RENEWAL_REQUEST_SUBMITTED',
          details: `تم إرسال طلب تجديد/ترقية إلى ${plan.nameAr} بقيمة $${dto.amountCents / 100} بانتظار التحقق من الإشعار`,
          performedById: userId,
        },
      });

      return { success: true, subscriptionId: subId, paymentId: payment.id, pendingVerification: true };
    });
  }

  /**
   * Get All Pending Renewal Requests
   */
  async getPendingRenewals() {
    return this.prisma.subscriptionPayment.findMany({
      where: { status: 'PENDING', tenant: { isRoot: false } },
      orderBy: { createdAt: 'desc' },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            email: true,
            phone: true,
            status: true,
          },
        },
        subscription: {
          include: {
            planVersion: {
              include: { plan: true },
            },
          },
        },
      },
    });
  }

  /**
   * Approve Renewal Request after verifying receipt and funds
   */
  async approveRenewal(paymentId: string, adminUserId?: string) {
    const payment = await this.prisma.subscriptionPayment.findUnique({
      where: { id: paymentId },
      include: {
        subscription: true,
        tenant: true,
      },
    });

    if (!payment) throw new NotFoundException('طلب الدفع غير موجود');
    if (payment.tenant.isRoot) throw new BadRequestException('مالك المنصة لا يخضع للباقات أو المدفوعات');
    if (payment.status === 'COMPLETED') throw new BadRequestException('تم اعتماد هذا الدفع مسبقاً');

    let requestedPlanCode = 'PRO';
    if (payment.notes) {
      try {
        const parsed = JSON.parse(payment.notes);
        if (parsed.requestedPlanCode) requestedPlanCode = parsed.requestedPlanCode;
      } catch {}
    }

    const plan = await this.prisma.plan.findUnique({
      where: { code: requestedPlanCode },
      include: {
        versions: {
          where: { isActive: true },
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    });

    const version = plan?.versions[0];
    const now = new Date();
    const durationMonths = requestedPlanCode === 'PRO' || requestedPlanCode === 'ENTERPRISE' ? 3 : 1;
    const nextPeriodEnd = new Date(now);
    nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + durationMonths);

    return await this.prisma.$transaction(async (tx) => {
      // 1. Mark payment as completed
      const updatedPayment = await tx.subscriptionPayment.update({
        where: { id: paymentId },
        data: {
          status: 'COMPLETED',
          paidAt: now,
          receivedById: adminUserId,
        },
      });

      // 2. Activate subscription and extend period
      await tx.tenantSubscription.update({
        where: { id: payment.subscriptionId },
        data: {
          planVersionId: version ? version.id : undefined,
          status: 'ACTIVE',
          cancellationReason: null,
          lockedPriceCents: payment.amountCents,
          currentPeriodStart: now,
          currentPeriodEnd: nextPeriodEnd,
        },
      });

      // 3. Unlock and activate tenant account
      await tx.tenant.update({
        where: { id: payment.tenantId },
        data: { status: 'ACTIVE' },
      });

      // 4. Log audit event
      await tx.subscriptionEvent.create({
        data: {
          subscriptionId: payment.subscriptionId,
          eventType: 'PAYMENT_VERIFIED_ACTIVATED',
          details: `تم تأكيد استلام المبلغ $${payment.amountCents / 100} وتفعيل باقة ${plan?.nameAr || requestedPlanCode} حتى ${nextPeriodEnd.toLocaleDateString('ar-IQ')}`,
          performedById: adminUserId,
        },
      });

      return { success: true, payment: updatedPayment, nextPeriodEnd };
    });
  }

  /**
   * Reject Renewal Request
   */
  async rejectRenewal(paymentId: string, reason?: string, adminUserId?: string) {
    const payment = await this.prisma.subscriptionPayment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) throw new NotFoundException('طلب الدفع غير موجود');

    return await this.prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.subscriptionPayment.update({
        where: { id: paymentId },
        data: {
          status: 'FAILED',
          notes: JSON.stringify({
            ...(payment.notes ? JSON.parse(payment.notes) : {}),
            rejectionReason: reason || 'لم يتم تأكيد استلام المبلغ في الحساب المصرفي',
            rejectedAt: new Date().toISOString(),
          }),
        },
      });

      await tx.subscriptionEvent.create({
        data: {
          subscriptionId: payment.subscriptionId,
          eventType: 'RENEWAL_REJECTED',
          details: `تم رفض إشعار التحويل: ${reason || 'لم يتم تأكيد استلام المبلغ'}`,
          performedById: adminUserId,
        },
      });

      return { success: true, payment: updatedPayment };
    });
  }
}
