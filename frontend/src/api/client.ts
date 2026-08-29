export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? '/api' : 'https://qayd-api-r04m.onrender.com/api');

interface CacheEntry {
  data: any;
  timestamp: number;
}

const apiCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<any>>();

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
];

/** Near-static data is worth holding for minutes, not seconds. */
const STABLE_TTL = 5 * 60 * 1000;

function pathOfKey(key: string): string {
  // key is `${method}:${endpoint}:${branchId}` and endpoints never contain ':'
  return key.split(':')[1] || '';
}

function isStablePath(path: string): boolean {
  return STABLE_PREFIXES.some((p) => path.startsWith(p));
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
    const ttl = options.ttl ?? (isStablePath(cleanEndpoint) ? STABLE_TTL : DEFAULT_TTL);
    if (cached && Date.now() - cached.timestamp < ttl) {
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
      }

      return data;
    } catch (error: any) {
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
