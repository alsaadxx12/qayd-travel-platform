import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ToolRegistryService } from './tool-registry.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { AiRequestContext, AiToolResult } from '../types/ai-tool.types';
import { baghdadLongAr } from './baghdad-clock';

export interface BriefFinding {
  key: string;
  severity: 'info' | 'attention';
  text: string;
}

export interface DailyBrief {
  date: string;
  findings: BriefFinding[];
  needsAttention: boolean;
}

/** Baghdad hour at which the morning brief is produced. */
const BRIEF_HOUR = Number(process.env.AI_BRIEF_HOUR || 8);
const TICK_MS = 15 * 60 * 1000;

/**
 * Turns the assistant from something you must remember to ask into something that
 * speaks first.
 *
 * Every figure here comes from the SAME tool the chat uses — the brief never
 * reimplements a calculation. If `getReceivables` changes, the brief changes with
 * it, and the two can never disagree in front of an accountant.
 */
@Injectable()
export class DailyBriefService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DailyBriefService.name);
  private timer: NodeJS.Timeout | null = null;
  /** companyId -> yyyy-mm-dd already delivered, so a restart cannot double-send. */
  private lastSent = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ToolRegistryService))
    private readonly tools: ToolRegistryService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    // Same lightweight pattern the exchange-rate capture already uses — no new
    // scheduler dependency, and nothing blocks boot.
    this.timer = setInterval(() => void this.tick().catch(() => undefined), TICK_MS);
    this.logger.log(`Daily brief armed for ${BRIEF_HOUR}:00 Asia/Baghdad`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private baghdadNow(): Date {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Baghdad' }));
  }

  private async tick() {
    const now = this.baghdadNow();
    if (now.getHours() !== BRIEF_HOUR) return;
    const today = now.toISOString().slice(0, 10);

    const companies = await this.prisma.company.findMany({ select: { id: true, tenantId: true } });
    for (const company of companies) {
      if (this.lastSent.get(company.id) === today) continue;
      try {
        await this.deliver(company.id, company.tenantId || undefined, today);
        this.lastSent.set(company.id, today);
      } catch (err: any) {
        this.logger.warn(`Brief failed for company ${company.id}: ${err?.message || err}`);
      }
    }
  }

  private async deliver(companyId: string, tenantId: string | undefined, today: string) {
    const brief = await this.build(companyId, tenantId);
    // Silence is a feature: nothing worth flagging means no notification at all.
    if (!brief.needsAttention) return;

    const body = brief.findings.map((f) => `• ${f.text}`).join('\n');
    await this.notifications.create({
      tenantId,
      title: `خلاصة الصباح — ${baghdadLongAr()}`,
      message: body,
      type: 'ALERT',
    } as any);
    this.logger.log(`Brief delivered to company ${companyId} for ${today}`);
  }

  /** A system context with full read scope — used only for these read-only checks. */
  private systemContext(companyId: string, tenantId?: string): AiRequestContext {
    return {
      userId: 'system-brief',
      userName: 'المستشار',
      companyId,
      tenantId,
      role: 'SYSTEM',
      permissions: ['*'],
      allowedBranchIds: [],
      canAccessAllBranches: true,
      branchAccessResolved: false,
      baseCurrency: 'IQD',
      locale: 'ar',
      memory: [],
    };
  }

  private async run(name: string, args: any, ctx: AiRequestContext): Promise<AiToolResult | null> {
    const tool = this.tools.get(name);
    if (!tool) return null;
    try {
      return await tool.handler(args, ctx);
    } catch (err: any) {
      this.logger.warn(`Brief check "${name}" failed: ${err?.message || err}`);
      return null;
    }
  }

  async build(companyId: string, tenantId?: string): Promise<DailyBrief> {
    const ctx = this.systemContext(companyId, tenantId);
    const findings: BriefFinding[] = [];
    const money = (n: any) => Number(n || 0).toLocaleString('en-US');

    const [unbalanced, fx, unpaid, receivables, payables] = await Promise.all([
      this.run('findUnbalancedJournalEntries', {}, ctx),
      this.run('getExchangeRate', {}, ctx),
      this.run('getUnpaidTickets', { period: 'MONTH' }, ctx),
      this.run('getReceivables', { limit: 1 }, ctx),
      this.run('getPayables', { limit: 1 }, ctx),
    ]);

    if (unbalanced?.ok && unbalanced.data?.found && unbalanced.data.count > 0) {
      findings.push({
        key: 'unbalanced',
        severity: 'attention',
        text: `عدنا ${unbalanced.data.count} قيد مو متوازن — يحتاج مراجعة.`,
      });
    }

    if (fx?.ok && fx.data) {
      const { adoptedRate, marginVsBaghdadSell, isMarginSafe } = fx.data as any;
      if (isMarginSafe === false) {
        findings.push({
          key: 'margin',
          severity: 'attention',
          text: `هامش الأمان طلع برّه الحدّ الآمن: السعر المعتمد ${money(adoptedRate)} والفرق عن بيع بغداد ${money(marginVsBaghdadSell)}.`,
        });
      }
    }

    if (unpaid?.ok && unpaid.data?.found && unpaid.data.count > 0) {
      findings.push({
        key: 'unpaid',
        severity: 'attention',
        text: `${unpaid.data.count} عملية آجلة غير مسدّدة هذا الشهر بمجموع ${money(unpaid.data.totalSell)}.`,
      });
    }

    if (receivables?.ok && receivables.data?.top?.length) {
      const top = receivables.data.top[0];
      findings.push({
        key: 'receivable',
        severity: 'info',
        text: `أكبر مدين النا: ${top.accountName || top.name || '—'} بمبلغ ${money(top.balanceIQD)} د.ع. إجمالي الذمم النا ${money(receivables.data.totalIQD)} د.ع.`,
      });
    }

    if (payables?.ok && payables.data?.top?.length) {
      const top = payables.data.top[0];
      findings.push({
        key: 'payable',
        severity: 'info',
        text: `أكبر مستحق علينا: ${top.accountName || top.name || '—'} بمبلغ ${money(top.balanceIQD)} د.ع.`,
      });
    }

    return {
      date: today(),
      findings,
      // Balances and top debtors are context, not alarms — they alone do not wake anyone.
      needsAttention: findings.some((f) => f.severity === 'attention'),
    };
  }
}

function today(): string {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Baghdad' }))
    .toISOString()
    .slice(0, 10);
}
