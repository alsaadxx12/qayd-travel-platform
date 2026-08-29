/**
 * In-app network profiler.
 *
 * Every call that goes through `apiRequest` reports its timing here, so slowness can
 * be read off real usage instead of guessed at from a screenshot of DevTools. The
 * export is written to be pasted straight into a bug report.
 *
 * Cost is deliberately near zero: one object push per request into a capped ring
 * buffer, no timers, no observers, no work at all until the panel is opened.
 */

/** A request is called slow past this many milliseconds. */
export const SLOW_THRESHOLD_MS = 500;

/** Anything past this is called out separately — it is not just slow, it is broken-feeling. */
export const CRITICAL_THRESHOLD_MS = 1500;

/** Ring buffer size. ~800 samples is several minutes of heavy use and stays tiny in memory. */
const MAX_SAMPLES = 800;

const STORAGE_KEY = 'qayd_perf_samples_v1';

export interface PerfSample {
  /** HTTP method */
  method: string;
  /** Endpoint path, with the query string kept — filters are often the reason a call is slow. */
  endpoint: string;
  /** The app route the user was on when the call fired. */
  route: string;
  /** Wall-clock duration in ms. */
  ms: number;
  /** True when served from the client cache and never touched the network. */
  cached: boolean;
  /** False when the request threw or returned a non-2xx. */
  ok: boolean;
  /** Error text, when the call failed. */
  error?: string;
  /** Epoch ms. */
  at: number;
}

export interface EndpointStat {
  key: string;
  method: string;
  endpoint: string;
  calls: number;
  networkCalls: number;
  cacheHits: number;
  failures: number;
  slow: number;
  avg: number;
  p50: number;
  p95: number;
  max: number;
  total: number;
  routes: string[];
}

type Listener = () => void;

class PerfMonitor {
  private samples: PerfSample[] = [];
  private listeners = new Set<Listener>();
  private enabled = true;

  constructor() {
    // Each page load / reload starts a clean session — old accumulated data
    // was confusing because numbers kept growing across reloads.
    // We no longer restore from sessionStorage; the monitor only shows
    // what happened since the *current* page load.
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage can be unavailable (private mode); profiling is optional */
    }
  }

  isEnabled() {
    return this.enabled;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    this.emit();
  }

  record(sample: PerfSample) {
    if (!this.enabled) return;
    this.samples.push(sample);
    if (this.samples.length > MAX_SAMPLES) {
      this.samples.splice(0, this.samples.length - MAX_SAMPLES);
    }
    this.persist();
    this.emit();
  }

  getSamples(): PerfSample[] {
    return this.samples;
  }

  clear() {
    this.samples = [];
    this.persist();
    this.emit();
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    // Notifying is cheap, but the panel is usually closed and nobody is listening.
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch {
        /* a broken listener must not break request recording */
      }
    });
  }

  private persistTimer: number | null = null;
  private persist() {
    // Batched: writing to sessionStorage on every single request would itself
    // become a measurable cost on a busy screen.
    if (this.persistTimer !== null) return;
    this.persistTimer = window.setTimeout(() => {
      this.persistTimer = null;
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.samples.slice(-MAX_SAMPLES)));
      } catch {
        /* quota or private mode — losing history is acceptable */
      }
    }, 1000);
  }

  // ── Aggregation ───────────────────────────────────────────────────────────

  /** Per-endpoint statistics, worst first. Cache hits are excluded from timings. */
  getEndpointStats(): EndpointStat[] {
    const groups = new Map<string, PerfSample[]>();
    for (const s of this.samples) {
      const key = `${s.method} ${stripVolatileIds(s.endpoint)}`;
      const list = groups.get(key);
      if (list) list.push(s);
      else groups.set(key, [s]);
    }

    const stats: EndpointStat[] = [];
    groups.forEach((list, key) => {
      const network = list.filter((s) => !s.cached);
      const times = network.map((s) => s.ms).sort((a, b) => a - b);
      const total = times.reduce((sum, t) => sum + t, 0);
      stats.push({
        key,
        method: list[0].method,
        endpoint: stripVolatileIds(list[0].endpoint),
        calls: list.length,
        networkCalls: network.length,
        cacheHits: list.length - network.length,
        failures: list.filter((s) => !s.ok).length,
        slow: network.filter((s) => s.ms >= SLOW_THRESHOLD_MS).length,
        avg: times.length ? Math.round(total / times.length) : 0,
        p50: percentile(times, 50),
        p95: percentile(times, 95),
        max: times.length ? times[times.length - 1] : 0,
        total: Math.round(total),
        routes: Array.from(new Set(list.map((s) => s.route))).slice(0, 6),
      });
    });

    // Ranked by total time spent, because ten 600ms calls hurt more than one 1.5s call.
    return stats.sort((a, b) => b.total - a.total);
  }

  /** Per-route roll-up: which screens are actually slow to open. */
  getRouteStats() {
    const groups = new Map<string, PerfSample[]>();
    for (const s of this.samples) {
      const list = groups.get(s.route);
      if (list) list.push(s);
      else groups.set(s.route, [s]);
    }
    return Array.from(groups.entries())
      .map(([route, list]) => {
        const network = list.filter((s) => !s.cached);
        const total = network.reduce((sum, s) => sum + s.ms, 0);
        return {
          route,
          calls: list.length,
          networkCalls: network.length,
          slow: network.filter((s) => s.ms >= SLOW_THRESHOLD_MS).length,
          total: Math.round(total),
          max: network.length ? Math.max(...network.map((s) => s.ms)) : 0,
        };
      })
      .sort((a, b) => b.total - a.total);
  }

  getSummary() {
    const network = this.samples.filter((s) => !s.cached);
    const slow = network.filter((s) => s.ms >= SLOW_THRESHOLD_MS);
    const critical = network.filter((s) => s.ms >= CRITICAL_THRESHOLD_MS);
    const times = network.map((s) => s.ms).sort((a, b) => a - b);
    return {
      total: this.samples.length,
      networkCalls: network.length,
      cacheHits: this.samples.length - network.length,
      slowCount: slow.length,
      criticalCount: critical.length,
      failures: this.samples.filter((s) => !s.ok).length,
      avg: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0,
      p95: percentile(times, 95),
      max: times.length ? times[times.length - 1] : 0,
      since: this.samples.length ? this.samples[0].at : Date.now(),
    };
  }

  /** Markdown report, sized to paste into a message without truncation. */
  toMarkdown(): string {
    const s = this.getSummary();
    const endpoints = this.getEndpointStats();
    const routes = this.getRouteStats();
    const worst = [...this.samples]
      .filter((x) => !x.cached)
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 15);

    const lines: string[] = [];
    lines.push('# تقرير أداء الشبكة — QAYD');
    lines.push('');
    lines.push(`- وقت التقرير: ${new Date().toISOString()}`);
    lines.push(`- فترة القياس: ${fmtDuration(Date.now() - s.since)}`);
    lines.push(`- عنوان الـ API: ${apiBase()}`);
    lines.push(`- حد البطء المعتمد: ${SLOW_THRESHOLD_MS}ms`);
    lines.push(`- المتصفح: ${navigator.userAgent}`);
    lines.push('');
    lines.push('## الملخص');
    lines.push('');
    lines.push('| المؤشر | القيمة |');
    lines.push('|---|---|');
    lines.push(`| إجمالي النداءات | ${s.total} |`);
    lines.push(`| نداءات فعلية للشبكة | ${s.networkCalls} |`);
    lines.push(`| مخدومة من الكاش | ${s.cacheHits} |`);
    lines.push(`| بطيئة (≥ ${SLOW_THRESHOLD_MS}ms) | **${s.slowCount}** |`);
    lines.push(`| حرجة (≥ ${CRITICAL_THRESHOLD_MS}ms) | **${s.criticalCount}** |`);
    lines.push(`| فاشلة | ${s.failures} |`);
    lines.push(`| المتوسط | ${s.avg}ms |`);
    lines.push(`| p95 | ${s.p95}ms |`);
    lines.push(`| الأبطأ | ${s.max}ms |`);
    lines.push('');
    lines.push('## النداءات مرتبة بإجمالي الزمن المستهلك');
    lines.push('');
    lines.push('| النداء | مرات | شبكة | كاش | بطيء | متوسط | p95 | الأقصى | الإجمالي |');
    lines.push('|---|---|---|---|---|---|---|---|---|');
    for (const e of endpoints.slice(0, 40)) {
      lines.push(
        `| \`${e.key}\` | ${e.calls} | ${e.networkCalls} | ${e.cacheHits} | ${e.slow} | ${e.avg}ms | ${e.p95}ms | ${e.max}ms | ${e.total}ms |`,
      );
    }
    lines.push('');
    lines.push('## الصفحات');
    lines.push('');
    lines.push('| الصفحة | نداءات | بطيئة | الأبطأ | إجمالي الانتظار |');
    lines.push('|---|---|---|---|---|');
    for (const r of routes.slice(0, 25)) {
      lines.push(`| \`${r.route}\` | ${r.calls} | ${r.slow} | ${r.max}ms | ${r.total}ms |`);
    }
    lines.push('');
    lines.push('## أبطأ ١٥ نداءً فردياً');
    lines.push('');
    lines.push('| الزمن | النداء | الصفحة | الحالة |');
    lines.push('|---|---|---|---|');
    for (const w of worst) {
      lines.push(
        `| **${w.ms}ms** | \`${w.method} ${w.endpoint}\` | \`${w.route}\` | ${w.ok ? 'ناجح' : `فشل: ${w.error || 'غير معروف'}`} |`,
      );
    }
    lines.push('');
    return lines.join('\n');
  }

  toJSON(): string {
    return JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        apiBase: apiBase(),
        slowThresholdMs: SLOW_THRESHOLD_MS,
        userAgent: navigator.userAgent,
        summary: this.getSummary(),
        endpoints: this.getEndpointStats(),
        routes: this.getRouteStats(),
        samples: this.samples,
      },
      null,
      2,
    );
  }
}

// ── helpers ────────────────────────────────────────────────────────────────

function apiBase(): string {
  // Must mirror API_BASE_URL in api/client.ts. Falling back to
  // window.location.origin was wrong and made the report name the site host rather
  // than the API host — exactly the detail needed to diagnose where time goes.
  try {
    const env = (import.meta as any).env || {};
    if (env.VITE_API_URL) return env.VITE_API_URL;
    if (env.VITE_API_BASE_URL) return env.VITE_API_BASE_URL;
    return env.DEV
      ? `${window.location.origin}/api (dev proxy)`
      : 'https://qayd-api-r04m.onrender.com/api (default)';
  } catch {
    return 'unknown';
  }
}

/**
 * `/receipt-vouchers/8f3a-...` and `/receipt-vouchers/1c9b-...` are the same endpoint.
 * Collapsing ids keeps the grouping meaningful instead of one row per record.
 */
function stripVolatileIds(endpoint: string): string {
  return endpoint
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d{4,}/g, '/:id');
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.ceil((p / 100) * sortedAsc.length) - 1);
  return sortedAsc[Math.max(0, idx)];
}

export function fmtDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m} دقيقة ${Math.round(s % 60)} ثانية`;
}

export const perfMonitor = new PerfMonitor();
