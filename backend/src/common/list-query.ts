export function parseListLimit(
  raw: string | number | undefined,
  fallback = 150,
  max = 300,
): number {
  const n = raw === undefined || raw === '' ? fallback : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.trunc(n), max);
}

export function parseOptionalDate(raw?: string): Date | undefined {
  if (!raw) return undefined;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}
