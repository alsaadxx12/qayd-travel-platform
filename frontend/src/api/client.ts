import { perfMonitor } from '../utils/perfMonitor';

export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? '/api' : 'https://qayd-travel-platform-production.up.railway.app/api');

interface CacheEntry {
  data: any;
  timestamp: number;
}

const apiCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<any>>();

/** Where near-static responses are kept so a page reload does not refetch them. */
const PERSIST_KEY = 'qayd_api_cache_v1';

// Cache TTL in ms (30 seconds default for GET, keeps UI blazing fast while staying fresh)
const DEFAULT_TTL = 30000;

/**
 * Endpoints that ordinary day-to-day writes cannot affect. Saving a voucher has no
 * bearing on the tenant's subscription or on the fiscal-year list, yet every write
 * used to clear the whole cache and force those to be fetched again — and on the
 * hosted API they cost 1.6-1.9s each. They are only evicted when a write actually
 * targets the same area, or when clearApiCache() is called on login/logout.
 */
const STABLE_PREFIXES = [
  '/tenants/current',
  '/fiscal-years',
  '/print-templates',
  '/employees',
  '/roles',
  '/branches',
  '/permission-groups',
  '/subscriptions/plans',
  '/accounts',
];

/** Near-static data is worth holding for minutes, not seconds. */
const STABLE_TTL = 5 * 60 * 1000;

/**
 * Per-endpoint TTLs, longest prefix wins.
 *
 * `/exchange-rate` is the interesting one: the backend caches the upstream rate for
 * 60 seconds, so asking more often than that CANNOT return anything new — it only
 * buys a round trip. Matching the client TTL to the server's is not a guess about
 * freshness, it is the exact point past which a request is provably pointless.
 */
const TTL_OVERRIDES: Array<[string, number]> = [
  ['/exchange-rate/history', STABLE_TTL], // historical series; does not move
  ['/exchange-rate', 60 * 1000], // mirrors the server's own upstream cache
  ['/notifications', 30 * 1000], // notifications don't need sub-30s freshness
  ['/receipt-vouchers', 30 * 1000], // voucher lists are stable within a session
  ['/payment-vouchers', 30 * 1000],
  ['/journal-entries', 30 * 1000],
];

function ttlFor(path: string): number {
  for (const [prefix, ttl] of TTL_OVERRIDES) {
    if (path.startsWith(prefix)) return ttl;
  }
  return isStablePath(path) ? STABLE_TTL : DEFAULT_TTL;
}

function currentRoute(): string {
  try {
    return window.location.pathname || '/';
  } catch {
    return '/';
  }
}

function pathOfKey(key: string): string {
  // key is `${method}:${endpoint}:${branchId}` and endpoints never contain ':'
  return key.split(':')[1] || '';
}

function isStablePath(path: string): boolean {
  return STABLE_PREFIXES.some((p) => path.startsWith(p));
}

/**
 * Restores only STABLE_PREFIXES entries, and only those still inside their TTL.
 * Volatile data is never persisted — it must be re-read on a fresh load.
 */
function hydratePersistedCache() {
  try {
    const raw = sessionStorage.getItem(PERSIST_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, CacheEntry>;
    const now = Date.now();
    for (const [key, entry] of Object.entries(parsed)) {
      if (!entry || typeof entry.timestamp !== 'number') continue;
      if (now - entry.timestamp >= STABLE_TTL) continue;
      if (!isStablePath(pathOfKey(key))) continue;
      apiCache.set(key, entry);
    }
  } catch {
    /* private mode or corrupt payload — start cold */
  }
}

let persistTimer: number | null = null;
function schedulePersist() {
  if (persistTimer !== null) return;
  persistTimer = window.setTimeout(() => {
    persistTimer = null;
    try {
      const out: Record<string, CacheEntry> = {};
      for (const [key, entry] of apiCache) {
        if (isStablePath(pathOfKey(key))) out[key] = entry;
      }
      sessionStorage.setItem(PERSIST_KEY, JSON.stringify(out));
    } catch {
      /* quota exceeded — the in-memory cache still works */
    }
  }, 800);
}

export function invalidateApiCache(prefix?: string) {
  if (!prefix) {
    apiCache.clear();
    return;
  }
  for (const key of apiCache.keys()) {
    if (key.includes(prefix)) {
      apiCache.delete(key);
    }
  }
}

/** Full wipe — use on sign-in, sign-out and branch switching. */
export function clearApiCache() {
  apiCache.clear();
  inFlightRequests.clear();
  try {
    sessionStorage.removeItem(PERSIST_KEY);
  } catch {
    /* nothing to do */
  }
}

/** Drops volatile entries but keeps near-static ones the write cannot have changed. */
function invalidateAfterMutation(mutatedPath: string) {
  const hitsStable = STABLE_PREFIXES.filter((p) => mutatedPath.startsWith(p));
  for (const key of apiCache.keys()) {
    const path = pathOfKey(key);
    if (!isStablePath(path) || hitsStable.some((p) => path.startsWith(p))) {
      apiCache.delete(key);
    }
  }
}

// Warm the cache from the previous page load before the first request goes out.
hydratePersistedCache();

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit & {
    noCache?: boolean;
    ttl?: number;
    timeoutMs?: number;
    skipBranchContext?: boolean;
  } = {},
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const token = localStorage.getItem('token');

  // Strip leading /api if present to prevent double /api/api
  const cleanEndpoint = endpoint.startsWith('/api/')
    ? endpoint.slice(4)
    : endpoint.startsWith('/')
    ? endpoint
    : `/${endpoint}`;

  const activeBranchId =
    localStorage.getItem('active_branch_id') ||
    localStorage.getItem('activeBranchId') ||
    '';

  const cacheKey = `${method}:${cleanEndpoint}:${activeBranchId}`;

  // Scoped invalidation, now that we know which path is being written to.
  if (method !== 'GET') {
    invalidateAfterMutation(cleanEndpoint);
  }

  // Check memory cache for GET requests
  if (method === 'GET' && !options.noCache) {
    const cached = apiCache.get(cacheKey);
    const ttl = options.ttl ?? ttlFor(cleanEndpoint);
    if (cached && Date.now() - cached.timestamp < ttl) {
      perfMonitor.record({
        method,
        endpoint: cleanEndpoint,
        route: currentRoute(),
        ms: 0,
        cached: true,
        ok: true,
        at: Date.now(),
      });
      return cached.data;
    }

    // Deduplicate in-flight requests (share promise)
    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey)!;
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (activeBranchId && !options.skipBranchContext) {
    headers['x-branch-id'] = activeBranchId;
  }

  const fetchPromise = (async () => {
    const {
      noCache: _noCache,
      ttl: _ttl,
      timeoutMs = 30000,
      skipBranchContext: _skipBranchContext,
      ...requestOptions
    } = options;
    const startedAt = performance.now();
    const timeoutController = requestOptions.signal ? null : new AbortController();
    const timeoutId = timeoutController
      ? window.setTimeout(() => timeoutController.abort(), timeoutMs)
      : null;

    try {
      const response = await fetch(`${API_BASE_URL}${cleanEndpoint}`, {
        ...requestOptions,
        headers,
        signal: requestOptions.signal || timeoutController?.signal,
      });

      if (!response.ok) {
        let errorMessage = 'حدث خطأ في الاتصال بالخادم';
        try {
          const errorData = await response.json();
          if (Array.isArray(errorData.message)) {
            errorMessage = errorData.message.join(' | ');
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          // Ignore json parse error
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (method === 'GET' && !options.noCache) {
        apiCache.set(cacheKey, { data, timestamp: Date.now() });
        if (isStablePath(cleanEndpoint)) schedulePersist();
      }

      perfMonitor.record({
        method,
        endpoint: cleanEndpoint,
        route: currentRoute(),
        ms: Math.round(performance.now() - startedAt),
        cached: false,
        ok: true,
        at: Date.now(),
      });

      return data;
    } catch (error: any) {
      perfMonitor.record({
        method,
        endpoint: cleanEndpoint,
        route: currentRoute(),
        ms: Math.round(performance.now() - startedAt),
        cached: false,
        ok: false,
        error: String(error?.message || error?.name || 'error'),
        at: Date.now(),
      });
      if (error?.name === 'AbortError') {
        throw new Error('استغرق الخادم وقتاً طويلاً دون استجابة. تحقق من اتصال قاعدة البيانات.');
      }
      if (error instanceof TypeError) {
        throw new Error('الخادم الخلفي غير متصل. تحقق من تشغيله واتصاله بقاعدة البيانات.');
      }
      throw error;
    } finally {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      inFlightRequests.delete(cacheKey);
    }
  })();

  if (method === 'GET' && !options.noCache) {
    inFlightRequests.set(cacheKey, fetchPromise);
  }

  return fetchPromise;
}
