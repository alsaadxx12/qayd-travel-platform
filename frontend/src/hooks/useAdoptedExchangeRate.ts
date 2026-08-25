import { useState, useEffect, useCallback, useMemo } from 'react';
import { useExchangeRate, formatRateSimple, type ExchangeRateData } from './useExchangeRate';
import { fetchPrintTemplate, savePrintTemplate } from '../api/printTemplates';

export interface ExchangeRateConfig {
  mode: 'MARKET_PLUS_MARGIN' | 'FIXED';
  baseMarketSource: 'BAGHDAD_SELL' | 'BAGHDAD_BUY' | 'NORTHERN_SELL' | 'SOUTHERN_SELL' | 'AVERAGE';
  marginAmount: number; // e.g. 10 IQD per $1 or 1000 IQD per $100
  marginUnit: 'PER_1_USD' | 'PER_100_USD';
  fixedRate: number; // e.g. 1540
  notes?: string;
}

export const DEFAULT_EXCHANGE_CONFIG: ExchangeRateConfig = {
  mode: 'MARKET_PLUS_MARGIN',
  baseMarketSource: 'BAGHDAD_SELL',
  marginAmount: 10, // +10 IQD per 1 USD (+1,000 IQD per $100)
  marginUnit: 'PER_1_USD',
  fixedRate: 1530,
  notes: 'سعر الصرف المعتمد للنظام مع هامش إضافي على سعر السوق',
};

// Global singleton config across all components
let globalAdoptedConfig: ExchangeRateConfig = DEFAULT_EXCHANGE_CONFIG;
let isConfigLoadedFromDB = false;

// Global event listener key for cross-component instant synchronization
const EXCHANGE_CONFIG_EVENT = 'adopted_exchange_config_updated';

export function notifyExchangeConfigUpdated() {
  window.dispatchEvent(new CustomEvent(EXCHANGE_CONFIG_EVENT));
}

export function useAdoptedExchangeRate() {
  const { data: marketData, loading: marketLoading, error: marketError, refresh: refreshMarket } = useExchangeRate();
  const [config, setConfig] = useState<ExchangeRateConfig>(() => globalAdoptedConfig);
  const [loadingConfig, setLoadingConfig] = useState<boolean>(() => !isConfigLoadedFromDB);
  const [savingConfig, setSavingConfig] = useState<boolean>(false);

  const loadConfigFromDB = useCallback(async (force = false) => {
    if (!force && isConfigLoadedFromDB) {
      setConfig(globalAdoptedConfig);
      setLoadingConfig(false);
      return;
    }

    try {
      if (!isConfigLoadedFromDB) setLoadingConfig(true);
      const res = await fetchPrintTemplate('exchange_rate_settings');
      if (res && res.config && res.config.mode) {
        const merged = {
          ...DEFAULT_EXCHANGE_CONFIG,
          ...res.config,
        };
        globalAdoptedConfig = merged;
        isConfigLoadedFromDB = true;
        setConfig(merged);
      }
    } catch (err) {
      console.error('Error fetching exchange rate settings:', err);
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  useEffect(() => {
    loadConfigFromDB();

    const handleSync = () => {
      loadConfigFromDB(true);
    };

    window.addEventListener(EXCHANGE_CONFIG_EVENT, handleSync);
    return () => window.removeEventListener(EXCHANGE_CONFIG_EVENT, handleSync);
  }, [loadConfigFromDB]);

  const saveConfig = useCallback(async (newConfig: ExchangeRateConfig) => {
    setSavingConfig(true);
    try {
      await savePrintTemplate('exchange_rate_settings', newConfig, 'إعدادات سعر الصرف المعتمد');
      setConfig(newConfig);
      notifyExchangeConfigUpdated();
      return true;
    } catch (err) {
      console.error('Error saving exchange rate settings:', err);
      throw err;
    } finally {
      setSavingConfig(false);
    }
  }, []);

  // Compute Base Market Rate (per 1 USD)
  const baseMarketRate = useMemo(() => {
    if (!marketData) return 1500;

    switch (config.baseMarketSource) {
      case 'BAGHDAD_SELL':
        return parseFloat(marketData.baghdad?.sell || '1500');
      case 'BAGHDAD_BUY':
        return parseFloat(marketData.baghdad?.buy || '1500');
      case 'NORTHERN_SELL':
        return parseFloat(marketData.northern?.sell || '1500');
      case 'SOUTHERN_SELL':
        return parseFloat(marketData.southern?.sell || '1500');
      case 'AVERAGE': {
        const sells = [marketData.baghdad, marketData.northern, marketData.southern]
          .filter(Boolean)
          .map((r: any) => parseFloat(r.sell));
        return sells.length ? Math.round(sells.reduce((a, b) => a + b, 0) / sells.length) : 1500;
      }
      default:
        return parseFloat(marketData.baghdad?.sell || '1500');
    }
  }, [marketData, config.baseMarketSource]);

  // Compute Margin per 1 USD
  const marginPerUSD = useMemo(() => {
    if (config.mode !== 'MARKET_PLUS_MARGIN') return 0;
    if (config.marginUnit === 'PER_100_USD') {
      return Number(config.marginAmount || 0) / 100;
    }
    return Number(config.marginAmount || 0);
  }, [config.mode, config.marginAmount, config.marginUnit]);

  // Compute Final Adopted Rate per 1 USD
  const adoptedRate = useMemo(() => {
    if (config.mode === 'FIXED') {
      return Number(config.fixedRate || 1530);
    }
    return baseMarketRate + marginPerUSD;
  }, [config.mode, config.fixedRate, baseMarketRate, marginPerUSD]);

  // Format Helper for 100 USD (e.g. 154,500 د.ع)
  const adoptedRatePer100 = useMemo(() => {
    return adoptedRate * 100;
  }, [adoptedRate]);

  return {
    adoptedRate, // e.g. 1545 (IQD per 1 USD)
    adoptedRatePer100, // e.g. 154500 (IQD per 100 USD)
    baseMarketRate, // e.g. 1535 (IQD per 1 USD from Market)
    marginPerUSD, // e.g. 10 (IQD margin per 1 USD)
    config,
    marketData,
    loading: loadingConfig || marketLoading,
    savingConfig,
    saveConfig,
    refreshMarket,
    reloadConfig: loadConfigFromDB,
  };
}
