import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

/**
 * الكروب ملفٌّ مالي وتشغيلي كامل، لا قائمة مسافرين.
 *
 * المسار: إنشاء الكروب ← أنظمة الأسعار (وبنودها Auto Purchases) ← المشتريات
 * والمصاريف العامة ← فتح البيع ← المسافرون. إضافةُ مسافرٍ معاملةٌ واحدة تُنشئ
 * البيع وتستنسخ بنودَ نظامه خدماتٍ فعلية Not Complete؛ وإدخال المورد والسعر
 * النهائي يقلب الخدمة Complete ويكتب سطرَ تدقيق. والملخّص يُحسب من الجداول
 * بصيغ المالك حرفياً — Expected تخطيطٌ وFinal حقيقةٌ ولا يُخلطان.
 */

const dec = (v: unknown) => Number(v ?? 0) || 0;

const KINDS = new Set(['TICKET', 'HOTEL', 'VISA', 'INSURANCE', 'TRANSPORT', 'GUIDE', 'PACKAGE', 'FULL_PACKAGE']);

@Injectable()
export class TourGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  private async audit(companyId: string, userId: string | undefined, action: string, entityId: string, details: any) {
    await this.prisma.auditLog
      .create({
        data: {
          companyId,
          userId: userId || null,
          action,
          entity: 'TOUR_GROUP',
          entityId,
          details: JSON.stringify(details),
        },
      })
      .catch(() => undefined);
  }

  // ── الملخّص: صيغ المالك حرفياً ──
  computeSummary(group: any) {
    const systems = (group.priceSystems || []).filter((s: any) => s.active !== false);
    const passengers = (group.passengers || []).filter((p: any) => p.state !== 'CANCELLED');
    const services = passengers.flatMap((p: any) => p.services || []);

    const seats = systems.reduce((a: number, s: any) => a + (Number(s.seats) || 0), 0);
    const sold = passengers.length;

    // اكتمال المسافر يُشتق من خدماته: كلها Complete وله خدمة واحدة على الأقل.
    const complete = passengers.filter(
      (p: any) => (p.services || []).length > 0 && (p.services || []).every((sv: any) => sv.status === 'COMPLETE'),
    ).length;

    const sales = passengers.reduce((a: number, p: any) => a + dec(p.salePrice), 0);
    const collected = passengers.reduce((a: number, p: any) => a + dec(p.collectedAmount), 0);

    // Buy = مجموع Final Buy لخدمات المسافرين (الحقيقة وحدها).
    const buy = services.reduce((a: number, sv: any) => a + (sv.finalBuy === null || sv.finalBuy === undefined ? 0 : dec(sv.finalBuy)), 0);
    const plannedBuy = services.reduce((a: number, sv: any) => a + dec(sv.expectedBuy), 0);

    const globalBuy = (group.charges || [])
      .filter((c: any) => c.chargeType === 'GLOBAL_PURCHASE')
      .reduce((a: number, c: any) => a + dec(c.amount), 0);
    const expenses = (group.charges || [])
      .filter((c: any) => c.chargeType === 'EXPENSE')
      .reduce((a: number, c: any) => a + dec(c.amount), 0);

    return {
      seats,
      sold,
      remaining: Math.max(0, seats - sold),
      passengers: sold,
      complete,
      notComplete: sold - complete,
      sales,
      collected,
      outstanding: sales - collected,
      plannedCost: plannedBuy + globalBuy,
      actualCost: buy + globalBuy,
      buy,
      globalBuy,
      expenses,
      plannedProfit: sales - (plannedBuy + globalBuy) - expenses,
      actualProfit: sales - buy - globalBuy - expenses,
    };
  }

  private fullInclude = {
    priceSystems: { include: { items: true } },
    charges: true,
    passengers: { include: { services: true }, orderBy: { createdAt: 'asc' as const } },
  };

  async list(companyId: string) {
    const groups = await this.prisma.tourGroup.findMany({
      where: { companyId },
      include: this.fullInclude,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return groups.map((g) => ({ ...g, summary: this.computeSummary(g) }));
  }

  /**
   * القاعدة بعيدة، فكل جولة إليها تُحسب. الجلب المتشعب كان يسير سطراً سطراً
   * (~6 جولات)؛ هنا تنطلق الفروع الأربعة معاً فيهبط زمن الجدار إلى جولتين.
   */
  async getOne(companyId: string, id: string) {
    const [g, priceSystems, charges, passengers] = await Promise.all([
      this.prisma.tourGroup.findFirst({ where: { id, companyId } }),
      this.prisma.groupPriceSystem.findMany({ where: { groupId: id }, include: { items: true } }),
      this.prisma.groupCharge.findMany({ where: { groupId: id } }),
      this.prisma.groupPassenger.findMany({
        where: { groupId: id },
        include: { services: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    if (!g) throw new NotFoundException('الكروب غير موجود');
    const full = { ...g, priceSystems, charges, passengers };
    return { ...full, summary: this.computeSummary(full) };
  }

  /** تحقق ملكيةٍ خفيف قبل التعديل: استعلام واحد بدل جلب الملف كاملاً. */
  private async assertGroup(companyId: string, id: string) {
    const g = await this.prisma.tourGroup.findFirst({
      where: { id, companyId },
      select: { id: true, openSale: true, currency: true, groupName: true },
    });
    if (!g) throw new NotFoundException('الكروب غير موجود');
    return g;
  }

  /** ختام كل تعديل: سطر التدقيق وجلب الملف المحدَّث ينطلقان معاً لا تعاقباً. */
  private async auditAndFetch(companyId: string, userId: string | undefined, action: string, groupId: string, details: any) {
    const [, full] = await Promise.all([
      this.audit(companyId, userId, action, groupId, details),
      this.getOne(companyId, groupId),
    ]);
    return full;
  }

  async create(companyId: string, dto: any, userId?: string) {
    const group = await this.prisma.tourGroup.create({
      data: {
        companyId,
        branchId: dto.branchId || null,
        groupName: String(dto.groupName || '').trim() || 'كروب بلا اسم',
        groupType: dto.groupType || 'FULL',
        country: dto.country || null,
        buyDate: dto.buyDate ? new Date(dto.buyDate) : new Date(),
        travelDate: dto.travelDate ? new Date(dto.travelDate) : null,
        active: dto.active !== false,
        openSale: Boolean(dto.openSale),
        currency: dto.currency || 'USD',
        exchangeRate: new Prisma.Decimal(dec(dto.exchangeRate) || 1),
        notes: dto.notes || null,
        createdById: userId || null,
      },
    });
    return this.auditAndFetch(companyId, userId, 'GROUP_CREATE', group.id, { groupName: group.groupName });
  }

  async update(companyId: string, id: string, dto: any, userId?: string) {
    await this.assertGroup(companyId, id);
    await this.prisma.tourGroup.update({
      where: { id },
      data: {
        ...(dto.groupName !== undefined && { groupName: String(dto.groupName).trim() }),
        ...(dto.groupType !== undefined && { groupType: dto.groupType }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.buyDate !== undefined && { buyDate: dto.buyDate ? new Date(dto.buyDate) : null }),
        ...(dto.travelDate !== undefined && { travelDate: dto.travelDate ? new Date(dto.travelDate) : null }),
        ...(dto.active !== undefined && { active: Boolean(dto.active) }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.openSale !== undefined && { openSale: Boolean(dto.openSale) }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.exchangeRate !== undefined && { exchangeRate: new Prisma.Decimal(dec(dto.exchangeRate) || 1) }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
    return this.getOne(companyId, id);
  }

  async remove(companyId: string, id: string, userId?: string) {
    const g = await this.assertGroup(companyId, id);
    await this.prisma.tourGroup.delete({ where: { id } });
    await this.audit(companyId, userId, 'GROUP_DELETE', id, { groupName: g.groupName });
    return { deleted: true };
  }

  // ── أنظمة الأسعار ──
  async savePriceSystem(companyId: string, groupId: string, dto: any, userId?: string) {
    await this.assertGroup(companyId, groupId);
    const items: any[] = Array.isArray(dto.items) ? dto.items : [];
    for (const it of items) {
      if (!KINDS.has(String(it.kind || '').toUpperCase())) {
        throw new BadRequestException(`نوع بند غير معروف: ${it.kind}`);
      }
    }

    const data = {
      name: String(dto.name || '').trim() || 'نظام أسعار',
      seats: Math.max(0, Math.round(dec(dto.seats))),
      currency: dto.currency || 'USD',
      salePrice: new Prisma.Decimal(dec(dto.salePrice)),
      active: dto.active !== false,
    };

    const psId: string = await this.prisma.$transaction(async (tx) => {
      let id = dto.id as string | undefined;
      if (id) {
        const existing = await tx.groupPriceSystem.findFirst({ where: { id, groupId } });
        if (!existing) throw new NotFoundException('نظام الأسعار غير موجود');
        await tx.groupPriceSystem.update({ where: { id }, data });
        // البنود تُستبدل كاملةً: القالب وصفٌ حالي لا سجلّ تاريخي.
        await tx.groupTemplateItem.deleteMany({ where: { priceSystemId: id } });
      } else {
        const created = await tx.groupPriceSystem.create({ data: { ...data, groupId } });
        id = created.id;
      }
      if (items.length) {
        await tx.groupTemplateItem.createMany({
          data: items.map((it) => ({
            priceSystemId: id!,
            kind: String(it.kind).toUpperCase(),
            supplierName: it.supplierName || null,
            supplierAccountId: it.supplierAccountId || null,
            expectedBuy: new Prisma.Decimal(dec(it.expectedBuy)),
            currency: it.currency || data.currency,
          })),
        });
      }
      return id!;
    });

    return this.auditAndFetch(companyId, userId, 'GROUP_PRICE_SYSTEM_SAVE', groupId, { priceSystemId: psId, name: data.name });
  }

  async removePriceSystem(companyId: string, groupId: string, psId: string, userId?: string) {
    await this.assertGroup(companyId, groupId);
    const used = await this.prisma.groupPassenger.count({ where: { priceSystemId: psId, state: { not: 'CANCELLED' } } });
    if (used > 0) {
      throw new BadRequestException(`لا يُحذف نظامٌ بيع عليه ${used} مسافراً — عطّله بدل حذفه.`);
    }
    await this.prisma.groupPriceSystem.deleteMany({ where: { id: psId, groupId } });
    return this.auditAndFetch(companyId, userId, 'GROUP_PRICE_SYSTEM_DELETE', groupId, { priceSystemId: psId });
  }

  // ── المشتريات والمصاريف العامة ──
  async addCharge(companyId: string, groupId: string, dto: any, userId?: string) {
    await this.assertGroup(companyId, groupId);
    const chargeType = dto.chargeType === 'EXPENSE' ? 'EXPENSE' : 'GLOBAL_PURCHASE';
    const charge = await this.prisma.groupCharge.create({
      data: {
        groupId,
        chargeType,
        category: String(dto.category || '').trim() || (chargeType === 'EXPENSE' ? 'مصروف' : 'شراء عام'),
        supplierName: dto.supplierName || null,
        supplierAccountId: dto.supplierAccountId || null,
        amount: new Prisma.Decimal(dec(dto.amount)),
        currency: dto.currency || 'USD',
        date: dto.date ? new Date(dto.date) : new Date(),
        notes: dto.notes || null,
      },
    });
    return this.auditAndFetch(companyId, userId, 'GROUP_CHARGE_ADD', groupId, { chargeId: charge.id, chargeType, amount: dec(dto.amount) });
  }

  async removeCharge(companyId: string, groupId: string, chargeId: string, userId?: string) {
    await this.assertGroup(companyId, groupId);
    await this.prisma.groupCharge.deleteMany({ where: { id: chargeId, groupId } });
    return this.auditAndFetch(companyId, userId, 'GROUP_CHARGE_DELETE', groupId, { chargeId });
  }

  // ── المسافرون: البيع الكامل + استنساخ الخدمات في معاملة واحدة ──
  async addPassenger(companyId: string, groupId: string, dto: any, userId?: string) {
    // بوابات البيع تحتاج ثلاث حقائق لا الملف كله — تُجلب معاً في جولة واحدة.
    const [group, systems, sold] = await Promise.all([
      this.assertGroup(companyId, groupId),
      this.prisma.groupPriceSystem.findMany({ where: { groupId }, include: { items: true } }),
      this.prisma.groupPassenger.count({ where: { groupId, state: { not: 'CANCELLED' } } }),
    ]);
    if (!group.openSale) {
      throw new BadRequestException('البيع غير مفتوح لهذا الكروب — فعّل Open Sale أولاً.');
    }

    const ps = dto.priceSystemId
      ? systems.find((s: any) => s.id === dto.priceSystemId)
      : systems.find((s: any) => s.active !== false);
    if (!ps) throw new BadRequestException('اختر نظام أسعارٍ للمسافر — لا نظام فعّالاً في الكروب.');

    const seats = systems.filter((s: any) => s.active !== false).reduce((a: number, s: any) => a + (Number(s.seats) || 0), 0);
    if (seats > 0 && seats - sold <= 0) {
      throw new BadRequestException(`المقاعد نفدت: ${sold} من ${seats} مبيعة.`);
    }

    const salePrice = dto.salePrice !== undefined ? dec(dto.salePrice) : dec(ps.salePrice);
    const payType = dto.payType === 'CREDIT' ? 'CREDIT' : (dto.payType === 'MASTER' ? 'MASTER' : 'CASH');

    const passengerId = await this.prisma.$transaction(async (tx) => {
      const pax = await tx.groupPassenger.create({
        data: {
          groupId,
          priceSystemId: ps.id,
          customerName: String(dto.customerName || '').trim() || String(dto.passengerName || '').trim(),
          customerId: dto.customerId || null,
          customerAccountId: dto.customerAccountId || null,
          passengerName: String(dto.passengerName || '').trim(),
          passport: dto.passport || null,
          agent: dto.agent || null,
          salePrice: new Prisma.Decimal(salePrice),
          currency: dto.currency || ps.currency,
          payType,
          paymentAccountId: dto.paymentAccountId || null,
          // النقدي والماستر يُعدّان محصَّلين فور البيع؛ والآجل ذمّةٌ حتى يُحصَّل.
          collectedAmount: new Prisma.Decimal(payType === 'CASH' || payType === 'MASTER' ? salePrice : dec(dto.collectedAmount)),
          voucherNumber: dto.voucherNumber || null,
          fCode: dto.fCode || null,
          state: dto.state === 'CONFIRMED' ? 'CONFIRMED' : 'RESERVED',
          notes: dto.transferImage
            ? (dto.notes ? `${dto.notes}\n[وصل سداد]: ${dto.transferImage}` : `[وصل سداد]: ${dto.transferImage}`)
            : (dto.notes || null),
        },
      });

      // استنساخ بنود القالب خدماتٍ فعلية — كلها Not Complete حتى يثبت موردها وسعرها.
      const items = (ps.items || []) as any[];
      if (items.length) {
        await tx.groupPassengerService.createMany({
          data: items.map((it) => ({
            passengerId: pax.id,
            kind: it.kind,
            supplierName: it.supplierName || null,
            supplierAccountId: it.supplierAccountId || null,
            expectedBuy: new Prisma.Decimal(dec(it.expectedBuy)),
            currency: it.currency || ps.currency,
            status: 'NOT_COMPLETE',
          })),
        });
      }
      return pax.id;
    });

    await this.audit(companyId, userId, 'GROUP_PASSENGER_ADD', groupId, {
      passengerId,
      passengerName: dto.passengerName,
      priceSystem: ps.name,
      salePrice,
    });
    return this.getOne(companyId, groupId);
  }

  async updatePassenger(companyId: string, groupId: string, paxId: string, dto: any, userId?: string) {
    const [, pax] = await Promise.all([
      this.assertGroup(companyId, groupId),
      this.prisma.groupPassenger.findFirst({ where: { id: paxId, groupId } }),
    ]);
    if (!pax) throw new NotFoundException('المسافر غير موجود');

    const changes: string[] = [];
    if (dto.salePrice !== undefined && dec(dto.salePrice) !== dec(pax.salePrice)) {
      changes.push(`السعر ${dec(pax.salePrice)} → ${dec(dto.salePrice)}`);
    }
    if (dto.state === 'CANCELLED' && pax.state !== 'CANCELLED') changes.push('إلغاء المسافر');

    await this.prisma.groupPassenger.update({
      where: { id: paxId },
      data: {
        ...(dto.customerName !== undefined && { customerName: dto.customerName }),
        ...(dto.passengerName !== undefined && { passengerName: dto.passengerName }),
        ...(dto.passport !== undefined && { passport: dto.passport }),
        ...(dto.agent !== undefined && { agent: dto.agent }),
        ...(dto.salePrice !== undefined && { salePrice: new Prisma.Decimal(dec(dto.salePrice)) }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.payType !== undefined && {
          payType: dto.payType === 'CREDIT' ? 'CREDIT' : (dto.payType === 'MASTER' ? 'MASTER' : 'CASH'),
        }),
        ...(dto.paymentAccountId !== undefined && { paymentAccountId: dto.paymentAccountId }),
        ...(dto.collectedAmount !== undefined && { collectedAmount: new Prisma.Decimal(dec(dto.collectedAmount)) }),
        ...(dto.voucherNumber !== undefined && { voucherNumber: dto.voucherNumber }),
        ...(dto.fCode !== undefined && { fCode: dto.fCode }),
        ...(dto.state !== undefined && { state: dto.state }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });

    if (changes.length) {
      return this.auditAndFetch(companyId, userId, 'GROUP_PASSENGER_UPDATE', groupId, { passengerId: paxId, changes });
    }
    return this.getOne(companyId, groupId);
  }

  // ── خدمة المسافر: المورد + Final Buy تقلبها Complete، وكل تغييرٍ مؤثّر يُدوَّن ──
  async updateService(companyId: string, groupId: string, serviceId: string, dto: any, userId?: string) {
    const [, svc] = await Promise.all([
      this.assertGroup(companyId, groupId),
      this.prisma.groupPassengerService.findFirst({ where: { id: serviceId, passenger: { groupId } } }),
    ]);
    if (!svc) throw new NotFoundException('الخدمة غير موجودة');

    const changes: string[] = [];
    if (dto.supplierName !== undefined && dto.supplierName !== svc.supplierName) {
      changes.push(`المورد: ${svc.supplierName || '—'} → ${dto.supplierName || '—'}`);
    }
    if (dto.finalBuy !== undefined && dec(dto.finalBuy) !== dec(svc.finalBuy)) {
      changes.push(`Final Buy: ${svc.finalBuy === null ? '—' : dec(svc.finalBuy)} → ${dec(dto.finalBuy)}`);
    }
    if (dto.currency !== undefined && dto.currency !== svc.currency) {
      changes.push(`العملة: ${svc.currency} → ${dto.currency}`);
    }

    const finalBuyProvided = dto.finalBuy !== undefined && dto.finalBuy !== null && dto.finalBuy !== '';
    const reopen = dto.status === 'NOT_COMPLETE';

    await this.prisma.groupPassengerService.update({
      where: { id: serviceId },
      data: {
        ...(dto.supplierName !== undefined && { supplierName: dto.supplierName || null }),
        ...(dto.supplierAccountId !== undefined && { supplierAccountId: dto.supplierAccountId || null }),
        ...(dto.expectedBuy !== undefined && { expectedBuy: new Prisma.Decimal(dec(dto.expectedBuy)) }),
        ...(dto.finalBuy !== undefined && {
          finalBuy: finalBuyProvided ? new Prisma.Decimal(dec(dto.finalBuy)) : null,
        }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        status: reopen ? 'NOT_COMPLETE' : finalBuyProvided || svc.finalBuy !== null ? 'COMPLETE' : svc.status,
        completedAt: reopen ? null : finalBuyProvided ? new Date() : svc.completedAt,
      },
    });

    if (changes.length) {
      return this.auditAndFetch(companyId, userId, 'GROUP_SERVICE_UPDATE', groupId, { serviceId, kind: svc.kind, changes });
    }
    return this.getOne(companyId, groupId);
  }
}
