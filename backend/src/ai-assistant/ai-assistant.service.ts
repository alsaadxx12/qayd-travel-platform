import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AIAssistantService {
  private readonly logger = new Logger(AIAssistantService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Fetch complete real database context with custom learned rules
   */
  async getLiveFinancialContext(tenantId?: string, clientAdoptedRate?: number) {
    const snapshots = await this.prisma.exchangeRateSnapshot.findMany({
      take: 10,
      orderBy: { capturedAt: 'desc' },
    });

    const latestSnap = snapshots[0];
    const baghdadSell = latestSnap?.baghdadSell || 1547.5;
    const baghdadBuy = latestSnap?.baghdadBuy || 1545.0;
    const northernSell = latestSnap?.northernSell || 1545.0;
    const southernSell = latestSnap?.southernSell || 1540.0;

    let tenantInfo: any = null;
    let companyId = tenantId;
    let learnedRules: string[] = [];

    if (tenantId) {
      tenantInfo = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          subscriptions: {
            where: { status: 'ACTIVE' },
            include: {
              planVersion: {
                include: {
                  plan: true,
                  features: true,
                  limits: true,
                },
              },
            },
          },
        },
      });
      if (tenantInfo?.companyId) {
        companyId = tenantInfo.companyId;
      }
      if (tenantInfo?.customSettings) {
        try {
          const parsed = JSON.parse(tenantInfo.customSettings);
          if (Array.isArray(parsed.aiLearnedRules)) {
            learnedRules = parsed.aiLearnedRules;
          }
        } catch {}
      }
    }

    let adoptedRate = clientAdoptedRate || 1552.5;

    if (!clientAdoptedRate) {
      const rateTemplate = await this.prisma.printTemplate.findFirst({
        where: {
          docType: 'exchange_rate_settings',
          OR: [
            ...(companyId ? [{ companyId }] : []),
            ...(tenantId ? [{ companyId: tenantId }] : []),
            { companyId: 'default-company-id' },
          ],
        },
        orderBy: { updatedAt: 'desc' },
      });

      if (rateTemplate?.config) {
        try {
          const cfg = JSON.parse(rateTemplate.config);
          if (cfg.mode === 'FIXED') {
            adoptedRate = Number(cfg.fixedRate || 1530);
          } else {
            let baseMarket = baghdadSell;
            if (cfg.baseMarketSource === 'BAGHDAD_BUY') baseMarket = baghdadBuy;
            else if (cfg.baseMarketSource === 'NORTHERN_SELL') baseMarket = northernSell;
            else if (cfg.baseMarketSource === 'SOUTHERN_SELL') baseMarket = southernSell;
            else if (cfg.baseMarketSource === 'AVERAGE') {
              baseMarket = Number(((baghdadSell + northernSell + southernSell) / 3).toFixed(1));
            }

            const marginVal =
              cfg.marginUnit === 'PER_100_USD'
                ? Number(cfg.marginAmount || 0) / 100
                : Number(cfg.marginAmount || 0);

            adoptedRate = Number((baseMarket + marginVal).toFixed(1));
          }
        } catch (e: any) {
          this.logger.warn(`Failed to parse exchange_rate_settings: ${e.message}`);
        }
      }
    }

    const currentMargin = Number((adoptedRate - baghdadSell).toFixed(1));
    const isMarginSafe = currentMargin >= 3.0 && currentMargin <= 15.0;

    const allPlans = await this.prisma.plan.findMany({
      where: { isActive: true },
      include: {
        versions: {
          where: { isActive: true },
          include: {
            features: true,
            limits: true,
          },
        },
      },
    });

    const activeSub = tenantInfo?.subscriptions?.[0];
    const planName = activeSub?.planVersion?.plan?.nameAr || 'الفترة التجريبية';
    const planCode = activeSub?.planVersion?.plan?.code || 'FREE_TRIAL';

    return {
      adoptedRate,
      baghdadSell,
      baghdadBuy,
      northernSell,
      southernSell,
      currentMargin,
      isMarginSafe,
      tenantName: tenantInfo?.name || 'علاء الدين',
      planName,
      planCode,
      currency: tenantInfo?.baseCurrency || 'IQD',
      learnedRules,
      allPlans: allPlans.map((p) => {
        const v = p.versions[0];
        const monthlyPrice = v ? v.priceMonthlyCents / 100 : 0;
        return {
          code: p.code,
          nameAr: p.nameAr,
          priceMonthly: monthlyPrice,
          priceYearly: Math.round(monthlyPrice * 10),
          features: v?.features?.map((f) => f.nameAr || f.featureCode) || [],
          limits: v?.limits?.map((l) => `${l.nameAr || l.limitCode}: ${l.limitValue === -1 ? 'غير محدود' : l.limitValue}`) || [],
        };
      }),
    };
  }

}
