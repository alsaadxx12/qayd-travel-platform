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

    // التكلفة الفعلية = مجموع Final Buy وحده — ما اشتُري فعلاً لا ما خُطِّط له.
    // كان يُحتسب المتوقَّع (Expected) تكلفةً فعلية فيظهر ربحٌ سالبٌ وهمي قبل أي
    // شراء؛ والمالك يريد الفصل: المتوقَّع للتخطيط، والنهائي وحده للحقيقة.
    const buy = services.reduce(
      (a: number, sv: any) => a + (sv.finalBuy !== null && sv.finalBuy !== undefined ? dec(sv.finalBuy) : 0),
      0,
    );
    const plannedBuy = services.reduce((a: number, sv: any) => a + dec(sv.expectedBuy), 0);

    const globalBuy = (group.charges || [])
      .filter((c: any) => c.chargeType === 'GLOBAL_PURCHASE')
      .reduce((a: number, c: any) => a + dec(c.amount), 0);
    const expenses = (group.charges || [])
      .filter((c: any) => c.chargeType === 'EXPENSE')
      .reduce((a: number, c: any) => a + dec(c.amount), 0);
    const actualCost = buy + globalBuy + expenses;
    const plannedCost = plannedBuy + globalBuy + expenses;

    // عدد المستفيدين في هذا الكروب
    const beneficiariesSet = new Set<string>();
    passengers.forEach((p: any) => {
      const bKey = p.customerAccountId || (p.customerName || '').trim().toLowerCase();
      if (bKey) beneficiariesSet.add(bKey);
    });
    const beneficiariesCount = beneficiariesSet.size || (passengers.length > 0 ? 1 : 0);

    // سعر شراء الباقة أو المقعد الفردي من نظام الأسعار الفعّال
    const activePs = (group.priceSystems || []).find((s: any) => s.active !== false) || (group.priceSystems || [])[0];
    const unitBuyPrice = activePs?.items?.length
      ? activePs.items.reduce((a: number, it: any) => a + dec(it.expectedBuy), 0)
      : (passengers[0]?.services ? passengers[0].services.reduce((a: number, sv: any) => a + dec(sv.expectedBuy), 0) : 0);

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
      plannedCost,
      actualCost,
      buy,
      globalBuy,
      expenses,
      plannedProfit: sales - plannedCost,
      actualProfit: sales - actualCost,
      beneficiariesCount,
      unitBuyPrice,
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

    const userIds = Array.from(new Set(groups.map((g) => g.createdById).filter(Boolean))) as string[];
    const users = userIds.length > 0
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true },
        })
      : [];
    const userMap = new Map<string, string>(users.map((u) => [u.id, u.name || 'مدير النظام']));

    return groups.map((g) => ({ 
      ...g, 
      createdByName: (g.createdById && userMap.get(g.createdById)) || 'مدير النظام',
      summary: this.computeSummary(g) 
    }));
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

    const user = g.createdById
      ? await this.prisma.user.findUnique({ where: { id: g.createdById }, select: { name: true } })
      : null;

    return {
      ...g,
      createdByName: user?.name || 'مدير النظام',
      priceSystems,
      charges,
      passengers,
      summary: this.computeSummary({ ...g, priceSystems, charges, passengers }),
    };
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
        currency: dto.currency || 'IQD',
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

      // انتشار التخطيط إلى المسافرين الحاليين على هذا النظام: تُحدَّث التكلفة
      // المتوقّعة (وعملتها) لكل خدمةٍ بحسب بندها، والمورّد الافتراضي حيث لا مورّد
      // بعد — دون أي مساسٍ بالشراء الفعلي (Final Buy) أو أسعار البيع الفردية.
      const paxIds = (
        await tx.groupPassenger.findMany({
          where: { groupId, priceSystemId: id, state: { not: 'CANCELLED' } },
          select: { id: true },
        })
      ).map((p) => p.id);
      if (paxIds.length) {
        for (const it of items) {
          const kind = String(it.kind).toUpperCase();
          await tx.groupPassengerService.updateMany({
            where: { passengerId: { in: paxIds }, kind },
            data: { expectedBuy: new Prisma.Decimal(dec(it.expectedBuy)), currency: it.currency || data.currency },
          });
          if (it.supplierName || it.supplierAccountId) {
            await tx.groupPassengerService.updateMany({
              where: { passengerId: { in: paxIds }, kind, supplierName: null },
              data: { supplierName: it.supplierName || null, supplierAccountId: it.supplierAccountId || null },
            });
          }
        }
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

  /**
   * قيدُ المسافر في دفتر الأستاذ — به يظهر الكروب في كشوف الحسابات.
   *
   * لكل مسافرٍ قيدٌ واحد مفتاحه المرجعي `GRP-{paxId}`، يُحذف ويُعاد بناؤه عند كل
   * تغيير (كالتذاكر تماماً) فلا يتكرّر. توزيعُه:
   *   مدين: حساب العميل بسعر البيع  → يظهر ديناً عليه في كشفه.
   *   دائن: كلُّ مورّدٍ بـ Final Buy لخدمته → يظهر لنا عليه في كشف المورّد.
   *   دائن: الإيراد بالباقي (سعر البيع − مجموع المشتريات المعروفة).
   * والنقدي يُسوّى فوراً: مدين الصندوق ودائن العميل بسعر البيع، فيصفو كشفه.
   * المسافر الملغى لا قيد له.
   */
  private async syncPassengerLedger(companyId: string, groupId: string, paxId: string, userId?: string) {
    const reference = `GRP-${paxId}`;
    // يُحذف القيد القديم دائماً؛ ثم يُعاد بناؤه إن كان المسافر فعّالاً.
    await this.prisma.journalEntry.deleteMany({ where: { companyId, reference } });

    const [group, pax] = await Promise.all([
      this.prisma.tourGroup.findFirst({ where: { id: groupId, companyId }, select: { groupName: true, currency: true } }),
      this.prisma.groupPassenger.findFirst({ where: { id: paxId, groupId }, include: { services: true } }),
    ]);
    if (!group || !pax || pax.state === 'CANCELLED') return;

    const salePrice = dec(pax.salePrice);
    if (salePrice <= 0 && (pax.services || []).every((s) => dec(s.finalBuy) <= 0)) return;

    // createdById مفتاحٌ أجنبي إلزامي: userId قد يكون مستخدم التطوير الوهمي الذي
    // لا صفَّ له، فيُتحقَّق منه ويُستبدل بأول مستخدمٍ حقيقي في الشركة عند اللزوم.
    let createdById: string | null = null;
    if (userId) {
      const u = await this.prisma.user.findFirst({ where: { id: userId }, select: { id: true } });
      createdById = u?.id || null;
    }
    if (!createdById) {
      const anyUser = await this.prisma.user.findFirst({ where: { companyId }, select: { id: true } });
      createdById = anyUser?.id || null;
    }
    if (!createdById) return; // بلا مستخدمٍ حقيقي لا يمكن كتابة القيد
    const custName = pax.customerName || pax.passengerName || '';

    // الحسابات: عميل المسافر، ومورّدو خدماته، والإيراد، والصندوق للنقدي.
    const customerAccountId =
      pax.customerAccountId ||
      (await this.prisma.account.findFirst({ where: { companyId, OR: [{ code: '141' }, { code: '14' }, { category: 'CUSTOMER' as any }] }, select: { id: true } }))?.id ||
      null;
    const revenue =
      (await this.prisma.account.findFirst({ where: { companyId, code: { in: ['4111', '411'] } }, orderBy: { code: 'desc' }, select: { id: true } })) ||
      (await this.prisma.account.findFirst({ where: { companyId, type: 'REVENUE' as any }, select: { id: true } }));
    const revenueAccountId = revenue?.id || null;

    const isCash = pax.payType === 'CASH' || pax.payType === 'MASTER';
    const cashboxAccountId = isCash
      ? pax.paymentAccountId ||
        (await this.prisma.account.findFirst({ where: { companyId, OR: [{ code: '1811' }, { code: '181' }, { category: 'CASH' as any }] }, select: { id: true } }))?.id ||
        null
      : null;

    if (!customerAccountId) return; // بلا حساب عميل لا معنى للقيد

    const lines: any[] = [];
    // مدين العميل بسعر البيع كاملاً.
    lines.push({
      accountId: customerAccountId,
      debit: new Prisma.Decimal(salePrice),
      credit: new Prisma.Decimal(0),
      description: `مبيعات كروب ${group.groupName} — ${pax.passengerName} (${custName})`,
    });

    // دائن كل مورّدٍ بحصّته (Final Buy) — يجمع المتكرر لتفادي أسطر متناثرة.
    const bySupplier = new Map<string, number>();
    let knownBuy = 0;
    for (const sv of pax.services || []) {
      const fb = dec(sv.finalBuy);
      if (fb > 0 && sv.supplierAccountId) {
        bySupplier.set(sv.supplierAccountId, (bySupplier.get(sv.supplierAccountId) || 0) + fb);
        knownBuy += fb;
      }
    }
    for (const [accId, amt] of bySupplier) {
      lines.push({
        accountId: accId,
        debit: new Prisma.Decimal(0),
        credit: new Prisma.Decimal(amt),
        description: `استحقاق مورّد كروب ${group.groupName} — ${pax.passengerName}`,
      });
    }

    // دائن الإيراد بالباقي (سعر البيع − المشتريات المعروفة). قد يكون سالباً فيُقيَّد مديناً.
    const revenueShare = salePrice - knownBuy;
    if (revenueAccountId && Math.abs(revenueShare) > 0.0001) {
      lines.push(
        revenueShare > 0
          ? { accountId: revenueAccountId, debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(revenueShare), description: `إيراد كروب ${group.groupName} — ${pax.passengerName}` }
          : { accountId: revenueAccountId, debit: new Prisma.Decimal(Math.abs(revenueShare)), credit: new Prisma.Decimal(0), description: `فرق تكلفة كروب ${group.groupName} — ${pax.passengerName}` },
      );
    }

    // النقدي: تسويةٌ فورية تُصفّي كشف العميل (مدين صندوق / دائن عميل).
    const collected = Math.min(dec(pax.collectedAmount), salePrice);
    if (isCash && cashboxAccountId && collected > 0) {
      lines.push({ accountId: cashboxAccountId, debit: new Prisma.Decimal(collected), credit: new Prisma.Decimal(0), description: `تحصيل نقدي كروب ${group.groupName} — ${pax.passengerName}` });
      lines.push({ accountId: customerAccountId, debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(collected), description: `سداد نقدي كروب ${group.groupName} — ${pax.passengerName}` });
    }

    const totalDeb = lines.reduce((s, l) => s + Number(l.debit), 0);
    const totalCred = lines.reduce((s, l) => s + Number(l.credit), 0);
    if (lines.length < 2 || Math.abs(totalDeb - totalCred) > 0.01) return; // لا نكتب قيداً غير متوازن

    await this.prisma.journalEntry.create({
      data: {
        entryNumber: `JV-GRP-${paxId.slice(0, 8)}`,
        reference,
        date: new Date(),
        description: `قيد مسافر كروب ${group.groupName}: ${pax.passengerName} (${custName})`,
        status: 'POSTED',
        totalDebit: new Prisma.Decimal(totalDeb),
        totalCredit: new Prisma.Decimal(totalCred),
        companyId,
        createdById,
        postedById: createdById,
        sourceType: 'GROUP',
        sourceId: paxId,
        lines: { create: lines },
      },
    }).catch(() => undefined);
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

    let agentName = dto.agent ? String(dto.agent).trim() : '';
    if (!agentName && userId) {
      const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
      agentName = u?.name || '';
    }

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
          agent: agentName || null,
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
            // الشراء الفعلي يبقى فارغاً حتى يُشترى فعلاً — لا يُنسَخ من المتوقَّع،
            // وإلا وُلد كل مسافرٍ بتكلفةٍ وهمية تُظهر ربحاً سالباً قبل أي شراء.
            finalBuy: null,
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
    await this.syncPassengerLedger(companyId, groupId, passengerId, userId);
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

    let updateAgent = dto.agent !== undefined ? (dto.agent ? String(dto.agent).trim() : null) : undefined;
    if ((updateAgent === undefined || !updateAgent) && userId && !pax.agent) {
      const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
      if (u?.name) updateAgent = u.name;
    }

    await this.prisma.groupPassenger.update({
      where: { id: paxId },
      data: {
        ...(dto.customerName !== undefined && { customerName: dto.customerName }),
        ...(dto.customerId !== undefined && { customerId: dto.customerId || null }),
        ...(dto.customerAccountId !== undefined && { customerAccountId: dto.customerAccountId || null }),
        ...(dto.priceSystemId !== undefined && { priceSystemId: dto.priceSystemId || null }),
        ...(dto.passengerName !== undefined && { passengerName: dto.passengerName }),
        ...(dto.passport !== undefined && { passport: dto.passport }),
        ...(updateAgent !== undefined && { agent: updateAgent }),
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

    await this.syncPassengerLedger(companyId, groupId, paxId, userId);
    if (changes.length) {
      return this.auditAndFetch(companyId, userId, 'GROUP_PASSENGER_UPDATE', groupId, { passengerId: paxId, changes });
    }
    return this.getOne(companyId, groupId);
  }

  /** حذفٌ نهائي للمسافر: يزيل خدماته وقيده معاً. */
  async removePassenger(companyId: string, groupId: string, paxId: string, userId?: string) {
    await this.assertGroup(companyId, groupId);
    const pax = await this.prisma.groupPassenger.findFirst({ where: { id: paxId, groupId }, select: { passengerName: true } });
    if (!pax) throw new NotFoundException('المسافر غير موجود');
    await this.prisma.journalEntry.deleteMany({ where: { companyId, reference: `GRP-${paxId}` } });
    await this.prisma.groupPassenger.delete({ where: { id: paxId } });
    return this.auditAndFetch(companyId, userId, 'GROUP_PASSENGER_DELETE', groupId, { passengerId: paxId, passengerName: pax.passengerName });
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

    await this.syncPassengerLedger(companyId, groupId, svc.passengerId, userId);
    if (changes.length) {
      return this.auditAndFetch(companyId, userId, 'GROUP_SERVICE_UPDATE', groupId, { serviceId, kind: svc.kind, changes });
    }
    return this.getOne(companyId, groupId);
  }
}
