import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../api/client';

/**
 * Exchange rate data from iraqborsa.com API
 * b = Baghdad, n = Northern, s = Southern
 * sell = معروض (asking), buy = مطلوب (bid)
 * psell/pbuy = previous sell/buy
 * sp/bp = sell/buy percentage change
 * sd/bd = sell/buy difference
 */
export interface ExchangeRegion {
  sell: string;
  buy: string;
  psell: string;
  pbuy: string;
  sp: number;
  bp: number;
  sd: number;
  bd: number;
}

export interface ExchangeRateData {
  baghdad: ExchangeRegion;
  northern: ExchangeRegion;
  southern: ExchangeRegion;
  lastUpdated: Date;
}

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Global singleton cache across all components
let globalExchangeData: ExchangeRateData | null = null;
let lastFetchTimestamp = 0;
const subscribers = new Set<(data: ExchangeRateData) => void>();

/**
 * Format raw rate (e.g. "1525" → "1,525.000")
 */
export function formatRate(raw: string): string {
  const num = parseFloat(raw) / 10;
  return num.toLocaleString('en-US', { minimumFractionDigits: 3 });
}

/**
 * Format raw rate to full number (e.g. "1525" → "1,525")
 */
export function formatRateSimple(raw: string | number): string {
  if (raw === undefined || raw === null || raw === '') return '—';
  const num = typeof raw === 'number' ? raw : parseFloat(String(raw));
  if (isNaN(num)) return '—';
  return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

export function useExchangeRate() {
  const [data, setData] = useState<ExchangeRateData | null>(() => globalExchangeData);
  const [loading, setLoading] = useState<boolean>(() => !globalExchangeData);
  const [error, setError] = useState<string | null>(null);

  const fetchRate = useCallback(async (force = false) => {
    // If we have recent data and not forced, reuse immediately
    if (!force && globalExchangeData && Date.now() - lastFetchTimestamp < REFRESH_INTERVAL) {
      setData(globalExchangeData);
      setLoading(false);
      return;
    }

    try {
      if (!globalExchangeData) setLoading(true);
      setError(null);
      const json = await apiRequest('/api/exchange-rate', { ttl: REFRESH_INTERVAL });
      const newData: ExchangeRateData = {
        baghdad: json.b,
        northern: json.n,
        southern: json.s,
        lastUpdated: new Date(),
      };
      globalExchangeData = newData;
      lastFetchTimestamp = Date.now();
      setData(newData);
      subscribers.forEach(cb => cb(newData));
    } catch (err: any) {
      setError(err.message || 'فشل في جلب سعر الصرف');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleUpdate = (updated: ExchangeRateData) => setData(updated);
    subscribers.add(handleUpdate);

    fetchRate();
    const iv = setInterval(() => fetchRate(true), REFRESH_INTERVAL);

    return () => {
      subscribers.delete(handleUpdate);
      clearInterval(iv);
    };
  }, [fetchRate]);

  return { data, loading, error, refresh: () => fetchRate(true) };
}
