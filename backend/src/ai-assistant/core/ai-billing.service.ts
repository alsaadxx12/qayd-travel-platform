import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_AI_MODEL } from '../../common/openai-models';

const PLATFORM_TENANT = '00000000-0000-0000-0000-000000000001';
const ALLOCATED_METRIC = 'OPENAI_ALLOCATED_CENTS';
const LEGACY_GRANT_METRIC = 'OPENAI_GRANT_CENTS';
const USED_METRIC = 'OPENAI_USED_MICROUSD';
const MICRO_PER_USD = 1_000_000;
const DEFAULT_ALLOCATED_USD = 10;

export type AiBillingStatus = 'ok' | 'no_credits' | 'unconfigured' | 'error';
export type AiBillingSource = 'openai_admin' | 'manual' | 'unknown';

export interface AiBillingSnapshot {
  configured: boolean;
  connected: boolean;
  adminConfigured: boolean;
  status: AiBillingStatus;
  model: string;
  provider: 'openai';
  source: AiBillingSource;
  allocatedUsd: number;
  grantUsd: number;
  usedUsd: number;
  usedTodayUsd: number;
  usedMonthUsd: number;
  remainingUsd: number;
  usagePercent: number;
  remainingKnown: boolean;
  costsLagging: boolean;
  message: string;
  lastCheckedAt: string;
}

@Injectable()
export class AiBillingService {
  private readonly logger = new Logger(AiBillingService.name);
  private probeCache: { at: number; snapshot: Partial<AiBillingSnapshot> } | null = null;
  private costsCache: { at: number; todayUsd: number; monthUsd: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private async getOpenAiKey(): Promise<string> {
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()) {
      return process.env.OPENAI_API_KEY.trim();
    }
    try {
      const record = await this.prisma.printTemplate.findFirst({
        where: { docType: 'ai_keys_config' },
        orderBy: { updatedAt: 'desc' },
      });
      if (record && record.config) {
        const parsed = typeof record.config === 'string' ? JSON.parse(record.config) : record.config;
        if (parsed.openaiApiKey || parsed.openAiKey || parsed.apiKey) {
          return String(parsed.openaiApiKey || parsed.openAiKey || parsed.apiKey).trim();
        }
      }
    } catch (err) {
      this.logger.warn(`Could not load db openai key: ${err}`);
    }
    return '';
  }

  async getSnapshot(live = false): Promise<AiBillingSnapshot> {
    const key = await this.getOpenAiKey();
    const configured = Boolean(key);
    const adminConfigured = Boolean(process.env.OPENAI_ADMIN_KEY?.trim());
    const model = process.env.AI_MODEL || DEFAULT_AI_MODEL;

    const [allocatedUsd, localUsed, costs, probe] = await Promise.all([
      this.readAllocatedUsd(),
      this.readUsedUsd(),
      this.fetchOpenAiCosts(),
      !configured
        ? Promise.resolve({ connected: false, status: 'unconfigured' as AiBillingStatus, message: 'لم يُضبط مفتاح OpenAI' })
        : live
          ? this.probeOpenAi()
          : Promise.resolve(
              this.readProbeCache() || {
                connected: true,
                status: 'ok' as AiBillingStatus,
                message: 'مفتاح OpenAI مضبوط',
              },
            ),
    ]);

    const openaiMonth = costs?.monthUsd ?? 0;
    const openaiToday = costs?.todayUsd ?? 0;
    const costsLagging = Boolean(adminConfigured && openaiMonth <= 0 && localUsed > 0);
    const usedMonthUsd = openaiMonth > 0 ? openaiMonth : localUsed;
    const usedTodayUsd = openaiToday > 0 ? openaiToday : costsLagging ? localUsed : 0;
    const remainingUsd = roundUsd(Math.max(0, allocatedUsd - usedMonthUsd));
    const usagePercent = allocatedUsd > 0 ? roundUsd((usedMonthUsd / allocatedUsd) * 100) : 0;

    return {
      configured,
      connected: probe.connected,
      adminConfigured,
      status: probe.connected ? (allocatedUsd > 0 && remainingUsd <= 0 ? 'no_credits' : 'ok') : probe.status,
      model,
      provider: 'openai',
      source: adminConfigured ? 'openai_admin' : allocatedUsd > 0 ? 'manual' : 'unknown',
      allocatedUsd: roundUsd(allocatedUsd),
      grantUsd: roundUsd(allocatedUsd),
      usedUsd: roundUsd(usedMonthUsd),
      usedTodayUsd: roundUsd(usedTodayUsd),
      usedMonthUsd: roundUsd(usedMonthUsd),
      remainingUsd,
      usagePercent,
      remainingKnown: allocatedUsd > 0,
      costsLagging,
      message: adminConfigured
        ? 'الرصيد المخصص من النظام، والاستهلاك من OpenAI Costs API'
        : probe.message,
      lastCheckedAt: new Date().toISOString(),
    };
  }

  async setGrantUsd(grantUsd: number) {
    const cents = Math.round(Math.max(0, Number(grantUsd) || 0) * 100);
    await this.upsertCounter(ALLOCATED_METRIC, 'GLOBAL', cents);
    this.costsCache = null;
    return this.getSnapshot();
  }

  async recordOpenAiUsage(params: {
    promptTokens?: number;
    completionTokens?: number;
    cachedTokens?: number;
  }) {
    const inputRate = Number(process.env.OPENAI_PRICE_INPUT_PER_MILLION || 2);
    const outputRate = Number(process.env.OPENAI_PRICE_OUTPUT_PER_MILLION || 8);
    const cachedRate = Number(process.env.OPENAI_PRICE_CACHED_PER_MILLION || 0.5);

    const cached = Math.max(0, params.cachedTokens || 0);
    const prompt = Math.max(0, (params.promptTokens || 0) - cached);
    const completion = Math.max(0, params.completionTokens || 0);

    const usd =
      (prompt / 1_000_000) * inputRate +
      (cached / 1_000_000) * cachedRate +
      (completion / 1_000_000) * outputRate;
    const micro = Math.max(1, Math.round(usd * MICRO_PER_USD));

    try {
      await this.prisma.usageCounter.upsert({
        where: {
          tenantId_metric_periodKey: {
            tenantId: PLATFORM_TENANT,
            metric: USED_METRIC,
            periodKey: monthKey(),
          },
        },
        update: { currentValue: { increment: micro } },
        create: {
          tenantId: PLATFORM_TENANT,
          metric: USED_METRIC,
          periodKey: monthKey(),
          currentValue: micro,
        },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to record OpenAI usage: ${err.message}`);
    }
  }

  private async readAllocatedUsd() {
    const allocated = await this.readCounter(ALLOCATED_METRIC, 'GLOBAL');
    if (allocated != null && allocated > 0) return allocated / 100;

    const legacy = await this.readCounter(LEGACY_GRANT_METRIC, 'GLOBAL');
    if (legacy != null && legacy > 0) {
      await this.upsertCounter(ALLOCATED_METRIC, 'GLOBAL', legacy);
      return legacy / 100;
    }

    const envGrant = Number(process.env.OPENAI_CREDIT_GRANT_USD || DEFAULT_ALLOCATED_USD);
    const usd = Number.isFinite(envGrant) && envGrant > 0 ? envGrant : DEFAULT_ALLOCATED_USD;
    await this.upsertCounter(ALLOCATED_METRIC, 'GLOBAL', Math.round(usd * 100)).catch(() => undefined);
    return usd;
  }

  private async fetchOpenAiCosts(): Promise<{ todayUsd: number; monthUsd: number } | null> {
    const adminKey = process.env.OPENAI_ADMIN_KEY?.trim();
    if (!adminKey) return null;
    if (this.costsCache && Date.now() - this.costsCache.at < 60_000) {
      return { todayUsd: this.costsCache.todayUsd, monthUsd: this.costsCache.monthUsd };
    }

    try {
      const now = Math.floor(Date.now() / 1000) + 60;
      const [monthUsd, todayUsd] = await Promise.all([
        this.sumCosts(adminKey, monthStartUnix(), now),
        this.sumCosts(adminKey, dayStartUnix(), now),
      ]);
      this.costsCache = { at: Date.now(), todayUsd, monthUsd };
      return { todayUsd, monthUsd };
    } catch (err: any) {
      this.logger.warn(`OpenAI Costs API failed: ${err.message}`);
      return this.costsCache ? { todayUsd: this.costsCache.todayUsd, monthUsd: this.costsCache.monthUsd } : null;
    }
  }

  private async sumCosts(adminKey: string, start: number, end: number) {
    let page: string | undefined;
    let total = 0;
    for (let i = 0; i < 12; i++) {
      const qs = new URLSearchParams({
        start_time: String(start),
        end_time: String(end),
        limit: '31',
      });
      if (page) qs.set('page', page);
      const res = await this.adminGet(adminKey, `https://api.openai.com/v1/organization/costs?${qs.toString()}`);
      if (!res.ok) {
        if (i === 0) this.logger.warn(`OpenAI Costs API ${res.status}`);
        break;
      }
      for (const bucket of res.json?.data || []) {
        const rows = bucket.results || [];
        if (rows.length) {
          for (const row of rows) total += Number(row.amount?.value ?? row.amount ?? 0);
        } else if (bucket.amount != null) {
          total += Number(bucket.amount?.value ?? bucket.amount ?? 0);
        }
      }
      if (!res.json?.has_more || !res.json?.next_page) break;
      page = res.json.next_page;
    }
    return total;
  }

  private async adminGet(adminKey: string, url: string) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${adminKey}` } });
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, json };
  }

  private async readUsedUsd() {
    const micro = (await this.readCounter(USED_METRIC, monthKey())) || 0;
    return micro / MICRO_PER_USD;
  }

  private async readCounter(metric: string, periodKey: string) {
    try {
      const row = await this.prisma.usageCounter.findUnique({
        where: {
          tenantId_metric_periodKey: {
            tenantId: PLATFORM_TENANT,
            metric,
            periodKey,
          },
        },
      });
      return row?.currentValue ?? null;
    } catch {
      return null;
    }
  }

  private async upsertCounter(metric: string, periodKey: string, value: number) {
    await this.prisma.usageCounter.upsert({
      where: {
        tenantId_metric_periodKey: {
          tenantId: PLATFORM_TENANT,
          metric,
          periodKey,
        },
      },
      update: { currentValue: value },
      create: {
        tenantId: PLATFORM_TENANT,
        metric,
        periodKey,
        currentValue: value,
      },
    });
  }

  private readProbeCache() {
    if (!this.probeCache || Date.now() - this.probeCache.at > 10 * 60_000) return null;
    return {
      connected: this.probeCache.snapshot.connected === true,
      status: (this.probeCache.snapshot.status as AiBillingStatus) || 'ok',
      message: this.probeCache.snapshot.message || '',
    };
  }

  private async probeOpenAi(): Promise<{
    connected: boolean;
    status: AiBillingStatus;
    message: string;
  }> {
    if (this.probeCache && Date.now() - this.probeCache.at < 45_000) {
      return {
        connected: this.probeCache.snapshot.connected === true,
        status: (this.probeCache.snapshot.status as AiBillingStatus) || 'error',
        message: this.probeCache.snapshot.message || '',
      };
    }

    const key = await this.getOpenAiKey();
    if (!key) {
      return { connected: false, status: 'unconfigured', message: 'لم يُضبط مفتاح OpenAI' };
    }

    try {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (res.ok) {
        const result = { connected: true, status: 'ok' as const, message: 'متصل ونشط' };
        this.probeCache = { at: Date.now(), snapshot: result };
        return result;
      }

      const body = await res.text();
      const noCredits = res.status === 429 && /no credits remaining|insufficient_quota|exceeded your current quota/i.test(body);
      const result = {
        connected: false,
        status: (noCredits ? 'no_credits' : 'error') as AiBillingStatus,
        message: noCredits ? 'لا يوجد رصيد متبقٍ في حساب OpenAI' : `فشل الاتصال (${res.status})`,
      };
      this.probeCache = { at: Date.now(), snapshot: result };
      return result;
    } catch (err: any) {
      return { connected: false, status: 'error', message: err.message || 'تعذر الاتصال بـ OpenAI' };
    }
  }
}

function monthKey(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthStartUnix(d = new Date()) {
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000);
}

function dayStartUnix(d = new Date()) {
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000);
}

function roundUsd(n: number) {
  return Math.round((Number(n) || 0) * 1e6) / 1e6;
}
