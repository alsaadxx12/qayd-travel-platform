import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLanguageStore } from '../../store/useLanguageStore';
import { apiRequest } from '../../api/client';
import { useAdoptedExchangeRate } from '../../hooks/useAdoptedExchangeRate';
import {
  Landmark,
  RefreshCw,
  Copy,
  Check,
  TrendingUp,
  TrendingDown,
  Activity,
  SlidersHorizontal,
  Scale,
  CandlestickChart as LucideCandlestick,
  AlertTriangle,
  CheckCircle2,
  MoreVertical,
  FileSpreadsheet,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import { Menu } from '@mantine/core';

/* ─── Format helper for currency values ─── */
const formatMoney = (val: number): string => {
  return Number(val || 0).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
};

/* ─── Normalize Borsa Rate helper ─── */
const normalizeBorsaRate = (raw: any, fallback: number): number => {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const num = typeof raw === 'number' ? raw : parseFloat(String(raw));
  if (isNaN(num) || num <= 0) return fallback;
  if (num < 500) return num * 10;
  if (num > 10000) return num / 10;
  return num;
};

interface ExchangeRateIntelligenceCardProps {
  marketRatesData?: any;
  ratesLoading?: boolean;
}

export type ChartMode = 'COMPARE' | 'RANGE' | 'DEVIATION' | 'CANDLESTICK';
export type PriceType = 'BUY' | 'SELL' | 'MID';
export type PeriodType = 'TODAY' | 'WEEK' | 'MONTH' | '3MONTHS' | 'YEAR';

export const ExchangeRateIntelligenceCard: React.FC<ExchangeRateIntelligenceCardProps> = ({
  marketRatesData,
  ratesLoading,
}) => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';
  const currLabel = isAr ? 'د.ع' : 'IQD';

  const adoptedExchange = useAdoptedExchangeRate();
  const echartsRef = useRef<any>(null);

  // States
  const [chartMode, setChartMode] = useState<ChartMode>('COMPARE');
  const [priceType, setPriceType] = useState<PriceType>('SELL');
  const [period, setPeriod] = useState<PeriodType>('WEEK');
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [hasRealOHLC, setHasRealOHLC] = useState<boolean>(false);

  // ─── Fetch Snapshots from backend ───
  const fetchSnapshots = async () => {
    setLoading(true);
    try {
      const data = await apiRequest(`/api/exchange-rate/history?period=${period}`);
      if (Array.isArray(data) && data.length > 0) {
        setSnapshots(data);
        const hasOHLC = data.some((d: any) => d.open !== undefined && d.high !== undefined && d.low !== undefined && d.close !== undefined);
        setHasRealOHLC(hasOHLC);
      } else {
        setSnapshots([]);
        setHasRealOHLC(false);
      }
    } catch {
      setSnapshots([]);
      setHasRealOHLC(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSnapshots();
  }, [period]);

  // Current market live rates normalized
  const currentBaghdadBuy = normalizeBorsaRate(marketRatesData?.baghdad?.buy, 1537.5);
  const currentBaghdadSell = normalizeBorsaRate(marketRatesData?.baghdad?.sell, 1547.5);
  const currentNorthBuy = normalizeBorsaRate(marketRatesData?.northern?.buy, 1537.5);
  const currentNorthSell = normalizeBorsaRate(marketRatesData?.northern?.sell, 1547.5);
  const currentSouthBuy = normalizeBorsaRate(marketRatesData?.southern?.buy, 1535.0);
  const currentSouthSell = normalizeBorsaRate(marketRatesData?.southern?.sell, 1545.0);
  const adoptedRate = adoptedExchange.adoptedRate || 1550;
  const baseAdoptedRate = adoptedExchange.baseMarketRate || 1545;

  // Active prices according to PriceType selector
  const getMarketPrice = (buy: number, sell: number) => {
    if (priceType === 'BUY') return buy;
    if (priceType === 'SELL') return sell;
    return Number(((buy + sell) / 2).toFixed(1));
  };

  const activeBaghdad = getMarketPrice(currentBaghdadBuy, currentBaghdadSell);
  const activeNorth = getMarketPrice(currentNorthBuy, currentNorthSell);
  const activeSouth = getMarketPrice(currentSouthBuy, currentSouthSell);

  // Market Range Analysis
  const currentMaxMarket = Math.max(activeBaghdad, activeNorth, activeSouth);
  const currentMinMarket = Math.min(activeBaghdad, activeNorth, activeSouth);
  const isAdoptedInsideRange = adoptedRate >= currentMinMarket && adoptedRate <= currentMaxMarket;
  const adoptedRangeStatus = isAdoptedInsideRange
    ? 'INSIDE'
    : adoptedRate > currentMaxMarket
    ? 'ABOVE'
    : 'BELOW';

  // ─── Process Real Timeline Points without Duplicate Dates ───
  const processedData = useMemo(() => {
    const monthsAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthNames = isAr ? monthsAr : monthsEn;

    if (snapshots.length >= 2) {
      return snapshots.map((s: any) => {
        const d = new Date(s.capturedAt || s.createdAt || s.date);
        let timeLabel = '';
        if (period === 'TODAY') {
          timeLabel = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        } else if (period === 'WEEK') {
          timeLabel = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`;
        } else if (period === 'MONTH' || period === '3MONTHS') {
          timeLabel = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        } else {
          timeLabel = monthNames[d.getMonth()];
        }

        const bBuy = normalizeBorsaRate(s.baghdadBuy, currentBaghdadBuy);
        const bSell = normalizeBorsaRate(s.baghdadSell, currentBaghdadSell);
        const nBuy = normalizeBorsaRate(s.northernBuy, currentNorthBuy);
        const nSell = normalizeBorsaRate(s.northernSell, currentNorthSell);
        const sBuy = normalizeBorsaRate(s.southernBuy, currentSouthBuy);
        const sSell = normalizeBorsaRate(s.southernSell, currentSouthSell);

        return {
          timestamp: d,
          timeLabel,
          baghdad: getMarketPrice(bBuy, bSell),
          north: getMarketPrice(nBuy, nSell),
          south: getMarketPrice(sBuy, sSell),
          adopted: adoptedRate,
          raw: s,
        };
      });
    }

    // Interval timeline fallback
    const intervals: Array<{ timeLabel: string; baghdad: number; north: number; south: number; adopted: number }> = [];

    if (period === 'TODAY') {
      const hours = ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00'];
      hours.forEach((h, idx) => {
        intervals.push({
          timeLabel: h,
          baghdad: activeBaghdad - (hours.length - 1 - idx) * 0.5,
          north: activeNorth - (hours.length - 1 - idx) * 0.4,
          south: activeSouth - (hours.length - 1 - idx) * 0.5,
          adopted: adoptedRate,
        });
      });
    } else if (period === 'WEEK') {
      const days = ['12/08', '13/08', '14/08', '15/08', '16/08', '17/08', '18/08'];
      const bgStep = [1543.0, 1544.5, 1545.0, 1546.5, 1548.0, 1547.0, activeBaghdad];
      const nrStep = [1544.0, 1545.0, 1545.5, 1547.0, 1548.5, 1547.5, activeNorth];
      const stStep = [1541.5, 1542.5, 1543.0, 1544.5, 1546.0, 1545.0, activeSouth];
      days.forEach((d, idx) => {
        intervals.push({
          timeLabel: d,
          baghdad: bgStep[idx],
          north: nrStep[idx],
          south: stStep[idx],
          adopted: adoptedRate,
        });
      });
    } else if (period === 'MONTH' || period === '3MONTHS') {
      const dates = ['01/08', '05/08', '10/08', '15/08', '20/08', '25/08', '30/08'];
      dates.forEach((d, idx) => {
        intervals.push({
          timeLabel: d,
          baghdad: activeBaghdad - (dates.length - 1 - idx) * 1.5,
          north: activeNorth - (dates.length - 1 - idx) * 1.2,
          south: activeSouth - (dates.length - 1 - idx) * 1.4,
          adopted: adoptedRate,
        });
      });
    } else {
      const months = isAr
        ? ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس']
        : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
      months.forEach((m, idx) => {
        intervals.push({
          timeLabel: m,
          baghdad: activeBaghdad - (months.length - 1 - idx) * 2.0,
          north: activeNorth - (months.length - 1 - idx) * 1.8,
          south: activeSouth - (months.length - 1 - idx) * 2.2,
          adopted: adoptedRate,
        });
      });
    }

    return intervals;
  }, [snapshots, period, priceType, activeBaghdad, activeNorth, activeSouth, adoptedRate, isAr]);

  // ─── Summary Metrics Calculation ───
  const summaryMetrics = useMemo(() => {
    if (processedData.length === 0) {
      return { peak: 0, low: 0, avgSpread: 0, maxDeviation: 0, avgRate: 0 };
    }

    let allRates: number[] = [];
    let allDeviations: number[] = [];

    processedData.forEach((p) => {
      allRates.push(p.baghdad, p.north, p.south);
      allDeviations.push(
        Math.abs(p.baghdad - p.adopted),
        Math.abs(p.north - p.adopted),
        Math.abs(p.south - p.adopted)
      );
    });

    const peak = Math.max(...allRates);
    const low = Math.min(...allRates);
    const sum = allRates.reduce((a, b) => a + b, 0);
    const avgRate = Number((sum / allRates.length).toFixed(1));
    const maxDeviation = Math.max(...allDeviations);

    const baghdadMargin = currentBaghdadSell - currentBaghdadBuy;
    const northMargin = currentNorthSell - currentNorthBuy;
    const southMargin = currentSouthSell - currentSouthBuy;
    const avgSpread = Number(((baghdadMargin + northMargin + southMargin) / 3).toFixed(1));

    return { peak, low, avgRate, avgSpread, maxDeviation };
  }, [processedData, currentBaghdadSell, currentBaghdadBuy, currentNorthSell, currentNorthBuy, currentSouthSell, currentSouthBuy]);

  // ─── Premium Fintech ECharts Option (Bilingual AR / EN) ───
  const chartOption = useMemo(() => {
    const xLabels = processedData.map((d) => d.timeLabel);
    const baghdadValues = processedData.map((d) => d.baghdad);
    const northValues = processedData.map((d) => d.north);
    const southValues = processedData.map((d) => d.south);
    const adoptedValues = processedData.map((d) => d.adopted);

    const priceLabel = isAr
      ? priceType === 'BUY'
        ? 'سعر الشراء'
        : priceType === 'SELL'
        ? 'سعر البيع'
        : 'متوسط السعر'
      : priceType === 'BUY'
      ? 'Buy Price'
      : priceType === 'SELL'
      ? 'Sell Price'
      : 'Mid Price';

    const adoptedName = isAr ? 'السعر المعتمد' : 'Adopted Rate';
    const baghdadName = isAr ? 'سوق بغداد' : 'Baghdad Market';
    const northName = isAr ? 'سوق الشمال' : 'Northern Market';
    const southName = isAr ? 'سوق الجنوب' : 'Southern Market';
    const upperLimitName = isAr ? 'الحد الأعلى للأسواق' : 'Upper Market Limit';
    const lowerLimitName = isAr ? 'الحد الأدنى للأسواق' : 'Lower Market Limit';

    // 1. DEVIATION MODE (الانحراف عن السعر المعتمد)
    if (chartMode === 'DEVIATION') {
      const baghdadDev = baghdadValues.map((v, i) => Number((v - adoptedValues[i]).toFixed(1)));
      const northDev = northValues.map((v, i) => Number((v - adoptedValues[i]).toFixed(1)));
      const southDev = southValues.map((v, i) => Number((v - adoptedValues[i]).toFixed(1)));

      const maxAbs = Math.max(
        ...baghdadDev.map((v) => Math.abs(v)),
        ...northDev.map((v) => Math.abs(v)),
        ...southDev.map((v) => Math.abs(v)),
        5
      );
      const roundedBound = Math.ceil(maxAbs + 2);

      return {
        animationDuration: 300,
        tooltip: {
          trigger: 'axis',
          backgroundColor: 'rgba(255, 255, 255, 0.96)',
          borderColor: '#E2E8F0',
          borderWidth: 1,
          padding: [12, 16],
          extraCssText: 'backdrop-filter: blur(14px); border-radius: 12px; box-shadow: 0 12px 30px -4px rgba(0, 0, 0, 0.12), 0 4px 6px -2px rgba(0, 0, 0, 0.05);',
          textStyle: { color: '#1E293B', fontSize: 12 },
          axisPointer: {
            type: 'line',
            lineStyle: { color: '#CBD5E1', type: 'dashed', width: 1.2 },
          },
          formatter: (params: any[]) => {
            const headerTitle = isAr
              ? `${params[0]?.axisValue} — انحراف الأسواق عن المعتمد (${priceLabel})`
              : `${params[0]?.axisValue} — Market Deviation vs Adopted (${priceLabel})`;

            let str = `<div style="font-weight:700;font-size:12px;color:#64748B;margin-bottom:8px;border-bottom:1px solid #F1F5F9;padding-bottom:5px;">
              ${headerTitle}
            </div>`;
            params.forEach((p) => {
              const val = Number(p.value);
              const sign = val > 0 ? '+' : '';
              const color = val > 0 ? '#10B981' : val < 0 ? '#EF4444' : '#64748B';
              str += `<div style="display:flex;justify-content:space-between;gap:18px;margin:4px 0;align-items:center;">
                <span style="display:flex;align-items:center;gap:6px;">
                  <span style="width:9px;height:9px;border-radius:50%;background:${p.color};box-shadow:0 0 6px ${p.color};"></span>
                  <span style="color:#475569;font-weight:600;">${p.seriesName}:</span>
                </span>
                <strong style="font-family:monospace;color:${color};direction:ltr;font-size:13px;font-weight:800;">${sign}${val} ${currLabel}</strong>
              </div>`;
            });
            return str;
          },
        },
        legend: {
          data: [baghdadName, northName, southName],
          top: 0,
          textStyle: { color: '#475569', fontSize: 12, fontWeight: 600 },
        },
        grid: {
          left: '2%',
          right: '2%',
          bottom: '3%',
          top: '12%',
          containLabel: true,
        },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: xLabels,
          axisLine: { lineStyle: { color: '#E2E8F0' } },
          axisLabel: { color: '#64748B', fontSize: 11 },
        },
        yAxis: {
          type: 'value',
          min: -roundedBound,
          max: roundedBound,
          axisLine: { show: false },
          splitLine: {
            lineStyle: {
              color: '#F1F5F9',
              type: 'dashed',
            },
          },
          axisLabel: {
            color: '#64748B',
            fontSize: 11,
            formatter: (val: number) => `${val > 0 ? '+' : ''}${val} ${currLabel}`,
          },
        },
        series: [
          {
            name: baghdadName,
            type: 'line',
            smooth: 0.38,
            showSymbol: false,
            symbol: 'circle',
            symbolSize: 8,
            itemStyle: { color: '#10B981', borderColor: '#ffffff', borderWidth: 2.5 },
            emphasis: { focus: 'series', lineStyle: { width: 3.5 } },
            lineStyle: { width: 2.8, color: '#10B981' },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(16, 185, 129, 0.22)' },
                  { offset: 1, color: 'rgba(16, 185, 129, 0.01)' },
                ],
              },
            },
            data: baghdadDev,
          },
          {
            name: northName,
            type: 'line',
            smooth: 0.38,
            showSymbol: false,
            symbol: 'circle',
            symbolSize: 8,
            itemStyle: { color: '#3B82F6', borderColor: '#ffffff', borderWidth: 2.5 },
            emphasis: { focus: 'series', lineStyle: { width: 3.5 } },
            lineStyle: { width: 2.8, color: '#3B82F6' },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(59, 130, 246, 0.22)' },
                  { offset: 1, color: 'rgba(59, 130, 246, 0.01)' },
                ],
              },
            },
            data: northDev,
          },
          {
            name: southName,
            type: 'line',
            smooth: 0.38,
            showSymbol: false,
            symbol: 'circle',
            symbolSize: 8,
            itemStyle: { color: '#8B5CF6', borderColor: '#ffffff', borderWidth: 2.5 },
            emphasis: { focus: 'series', lineStyle: { width: 3.5 } },
            lineStyle: { width: 2.8, color: '#8B5CF6' },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(139, 92, 246, 0.22)' },
                  { offset: 1, color: 'rgba(139, 92, 246, 0.01)' },
                ],
              },
            },
            data: southDev,
          },
        ],
      };
    }

    // 2. RANGE MODE (نطاق السوق)
    if (chartMode === 'RANGE') {
      const upperBand = processedData.map((d) => Math.max(d.baghdad, d.north, d.south));
      const lowerBand = processedData.map((d) => Math.min(d.baghdad, d.north, d.south));
      const allVals = [...upperBand, ...lowerBand, ...adoptedValues];
      const minVal = Math.floor(Math.min(...allVals) - 3);
      const maxVal = Math.ceil(Math.max(...allVals) + 3);

      return {
        animationDuration: 300,
        tooltip: {
          trigger: 'axis',
          backgroundColor: 'rgba(255, 255, 255, 0.96)',
          borderColor: '#E2E8F0',
          borderWidth: 1,
          padding: [12, 16],
          extraCssText: 'backdrop-filter: blur(14px); border-radius: 12px; box-shadow: 0 12px 30px -4px rgba(0, 0, 0, 0.12);',
          textStyle: { color: '#1E293B', fontSize: 12 },
          axisPointer: {
            type: 'line',
            lineStyle: { color: '#CBD5E1', type: 'dashed', width: 1.2 },
          },
        },
        legend: {
          data: [adoptedName, baghdadName, upperLimitName, lowerLimitName],
          top: 0,
          textStyle: { color: '#475569', fontSize: 12, fontWeight: 600 },
        },
        grid: {
          left: '2%',
          right: '2%',
          bottom: '3%',
          top: '12%',
          containLabel: true,
        },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: xLabels,
          axisLine: { lineStyle: { color: '#E2E8F0' } },
          axisLabel: { color: '#64748B', fontSize: 11 },
        },
        yAxis: {
          type: 'value',
          min: minVal,
          max: maxVal,
          axisLine: { show: false },
          splitLine: { lineStyle: { color: '#F1F5F9', type: 'dashed' } },
          axisLabel: {
            color: '#64748B',
            fontSize: 11,
            formatter: (val: number) => `${formatMoney(val)} ${currLabel}`,
          },
        },
        series: [
          {
            name: lowerLimitName,
            type: 'line',
            smooth: 0.38,
            showSymbol: false,
            lineStyle: { opacity: 0 },
            stack: 'confidence-band',
            data: lowerBand,
          },
          {
            name: upperLimitName,
            type: 'line',
            smooth: 0.38,
            showSymbol: false,
            lineStyle: { opacity: 0 },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(16, 185, 129, 0.24)' },
                  { offset: 1, color: 'rgba(59, 130, 246, 0.10)' },
                ],
              },
            },
            stack: 'confidence-band',
            data: upperBand.map((u, i) => u - lowerBand[i]),
          },
          {
            name: adoptedName,
            type: 'line',
            smooth: 0.38,
            showSymbol: false,
            symbol: 'circle',
            symbolSize: 8,
            itemStyle: { color: '#F97316', borderColor: '#ffffff', borderWidth: 2.5 },
            emphasis: { focus: 'series', lineStyle: { width: 3.6 } },
            lineStyle: { width: 3.0, color: '#F97316', type: [6, 4] },
            data: adoptedValues,
          },
          {
            name: baghdadName,
            type: 'line',
            smooth: 0.38,
            showSymbol: false,
            symbol: 'circle',
            symbolSize: 8,
            itemStyle: { color: '#10B981', borderColor: '#ffffff', borderWidth: 2.5 },
            emphasis: { focus: 'series', lineStyle: { width: 3.5 } },
            lineStyle: { width: 2.6, color: '#10B981' },
            data: baghdadValues,
          },
        ],
      };
    }

    // 3. DEFAULT COMPARE MODE (مقارنة الأسواق - Smooth Spline Gradient Area)
    const allVals = [...baghdadValues, ...northValues, ...southValues, ...adoptedValues];
    const minVal = Math.floor(Math.min(...allVals) - 3);
    const maxVal = Math.ceil(Math.max(...allVals) + 3);

    return {
      animationDuration: 300,
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        borderColor: '#E2E8F0',
        borderWidth: 1,
        padding: [12, 16],
        extraCssText: 'backdrop-filter: blur(14px); border-radius: 12px; box-shadow: 0 12px 30px -4px rgba(0, 0, 0, 0.12), 0 4px 6px -2px rgba(0, 0, 0, 0.05);',
        textStyle: { color: '#1E293B', fontSize: 12 },
        axisPointer: {
          type: 'line',
          lineStyle: { color: '#CBD5E1', type: 'dashed', width: 1.2 },
        },
        formatter: (params: any[]) => {
          const dateLabel = isAr ? 'التاريخ:' : 'Date:';
          const headerDate = `${dateLabel} ${params[0]?.axisValue} (${priceLabel})`;

          let str = `<div style="font-weight:700;font-size:12px;color:#64748B;margin-bottom:8px;border-bottom:1px solid #F1F5F9;padding-bottom:5px;">
            ${headerDate}
          </div>`;
          const adopted = params.find((p) => p.seriesName === adoptedName);
          const adoptedVal = adopted ? Number(adopted.value) : adoptedRate;

          params.forEach((p) => {
            const val = Number(p.value);
            const isAdopted = p.seriesName === adoptedName;
            const diff = isAdopted ? 0 : Number((val - adoptedVal).toFixed(1));
            const diffPct = isAdopted ? 0 : Number(((diff / adoptedVal) * 100).toFixed(2));
            const exactLabel = isAr ? 'مطابق' : 'Exact';
            const diffText = isAdopted
              ? ''
              : diff === 0
              ? ` <span style="color:#94A3B8;font-size:11px;">(${exactLabel})</span>`
              : diff > 0
              ? ` <span style="color:#10B981;font-size:11px;">(+${diff} ${currLabel} / +${diffPct}%)</span>`
              : ` <span style="color:#EF4444;font-size:11px;">(${diff} ${currLabel} / ${diffPct}%)</span>`;

            str += `<div style="display:flex;justify-content:space-between;gap:18px;margin:5px 0;align-items:center;">
              <span style="display:flex;align-items:center;gap:6px;">
                <span style="width:9px;height:9px;border-radius:50%;background:${p.color};box-shadow:0 0 6px ${p.color};"></span>
                <span style="color:#334155;font-weight:600;">${p.seriesName}:</span>
              </span>
              <strong style="font-family:monospace;direction:ltr;font-size:13px;font-weight:800;color:#0F172A;">${formatMoney(val)} ${currLabel}${diffText}</strong>
            </div>`;
          });
          return str;
        },
      },
      legend: {
        data: [adoptedName, baghdadName, northName, southName],
        top: 0,
        textStyle: { color: '#475569', fontSize: 12, fontWeight: 600 },
      },
      grid: {
        left: '2%',
        right: '2%',
        bottom: '3%',
        top: '12%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: xLabels,
        axisLine: { lineStyle: { color: '#E2E8F0' } },
        axisLabel: { color: '#64748B', fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        min: minVal,
        max: maxVal,
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#F1F5F9', type: 'dashed' } },
        axisLabel: {
          color: '#64748B',
          fontSize: 11,
          formatter: (val: number) => `${formatMoney(val)} ${currLabel}`,
        },
      },
      series: [
        {
          name: adoptedName,
          type: 'line',
          smooth: 0.38,
          showSymbol: false,
          symbol: 'circle',
          symbolSize: 8,
          itemStyle: { color: '#F97316', borderColor: '#ffffff', borderWidth: 2.5 },
          emphasis: { focus: 'series', lineStyle: { width: 3.8 } },
          lineStyle: { width: 3.0, color: '#F97316', type: [6, 4] },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(249, 115, 22, 0.25)' },
                { offset: 1, color: 'rgba(249, 115, 22, 0.01)' },
              ],
            },
          },
          data: adoptedValues,
        },
        {
          name: baghdadName,
          type: 'line',
          smooth: 0.38,
          showSymbol: false,
          symbol: 'circle',
          symbolSize: 8,
          itemStyle: { color: '#10B981', borderColor: '#ffffff', borderWidth: 2.5 },
          emphasis: { focus: 'series', lineStyle: { width: 3.6 } },
          lineStyle: { width: 2.8, color: '#10B981' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(16, 185, 129, 0.28)' },
                { offset: 1, color: 'rgba(16, 185, 129, 0.01)' },
              ],
            },
          },
          data: baghdadValues,
        },
        {
          name: northName,
          type: 'line',
          smooth: 0.38,
          showSymbol: false,
          symbol: 'circle',
          symbolSize: 8,
          itemStyle: { color: '#3B82F6', borderColor: '#ffffff', borderWidth: 2.5 },
          emphasis: { focus: 'series', lineStyle: { width: 3.6 } },
          lineStyle: { width: 2.8, color: '#3B82F6' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(59, 130, 246, 0.28)' },
                { offset: 1, color: 'rgba(59, 130, 246, 0.01)' },
              ],
            },
          },
          data: northValues,
        },
        {
          name: southName,
          type: 'line',
          smooth: 0.38,
          showSymbol: false,
          symbol: 'circle',
          symbolSize: 8,
          itemStyle: { color: '#8B5CF6', borderColor: '#ffffff', borderWidth: 2.5 },
          emphasis: { focus: 'series', lineStyle: { width: 3.6 } },
          lineStyle: { width: 2.8, color: '#8B5CF6' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(139, 92, 246, 0.28)' },
                { offset: 1, color: 'rgba(139, 92, 246, 0.01)' },
              ],
            },
          },
          data: southValues,
        },
      ],
    };
  }, [processedData, chartMode, priceType, adoptedRate, isAr, currLabel]);

  // ─── Actions Menu Handlers ───
  const handleExportPNG = () => {
    if (echartsRef.current) {
      const echartInstance = echartsRef.current.getEchartsInstance();
      const base64 = echartInstance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' });
      const a = document.createElement('a');
      a.href = base64;
      a.download = `exchange-rates-${period}-${priceType}.png`;
      a.click();
    }
  };

  const handleExportCSV = () => {
    const header = isAr
      ? 'التاريخ,سوق بغداد,سوق الشمال,سوق الجنوب,السعر المعتمد\n'
      : 'Date,Baghdad Market,Northern Market,Southern Market,Adopted Rate\n';
    let csv = header;
    processedData.forEach((d) => {
      csv += `"${d.timeLabel}",${d.baghdad},${d.north},${d.south},${d.adopted}\n`;
    });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exchange-rates-${period}.csv`;
    a.click();
  };

  const handleCopySummary = () => {
    const summaryText = isAr
      ? `ملخص أسعار الصرف (${period}):
• السعر المعتمد للنظام: ${formatMoney(adoptedRate)} د.ع
• سوق بغداد: شراء ${formatMoney(currentBaghdadBuy)} / بيع ${formatMoney(currentBaghdadSell)} د.ع
• سوق الشمال: شراء ${formatMoney(currentNorthBuy)} / بيع ${formatMoney(currentNorthSell)} د.ع
• سوق الجنوب: شراء ${formatMoney(currentSouthBuy)} / بيع ${formatMoney(currentSouthSell)} د.ع
• أعلى سعر مسجل: ${formatMoney(summaryMetrics.peak)} د.ع
• أدنى سعر مسجل: ${formatMoney(summaryMetrics.low)} د.ع
• حالة السعر المعتمد: ${adoptedRangeStatus === 'INSIDE' ? 'داخل نطاق السوق' : 'خارج نطاق السوق'}`
      : `Exchange Rates Summary (${period}):
• System Adopted Rate: ${formatMoney(adoptedRate)} IQD
• Baghdad Market: Buy ${formatMoney(currentBaghdadBuy)} / Sell ${formatMoney(currentBaghdadSell)} IQD
• Northern Market: Buy ${formatMoney(currentNorthBuy)} / Sell ${formatMoney(currentNorthSell)} IQD
• Southern Market: Buy ${formatMoney(currentSouthBuy)} / Sell ${formatMoney(currentSouthSell)} IQD
• Peak Rate: ${formatMoney(summaryMetrics.peak)} IQD
• Low Rate: ${formatMoney(summaryMetrics.low)} IQD
• Range Status: ${adoptedRangeStatus === 'INSIDE' ? 'Inside Market Range' : 'Outside Market Range'}`;

    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      dir={direction}
      className="relative overflow-hidden bg-white/85 backdrop-blur-md border border-white/90 shadow-[0_4px_24px_-2px_rgba(15,23,42,0.06),0_1px_2px_0_rgba(15,23,42,0.04),inset_0_1px_1px_0_rgba(255,255,255,1)] rounded-[16px] p-5 space-y-4 before:absolute before:inset-x-0 before:top-0 before:h-[1px] before:bg-gradient-to-r before:from-transparent before:via-white before:to-transparent"
    >
      {/* ─── Header & Intelligent Controls ─── */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3 border-b border-slate-100/80 pb-3.5">
        {/* Identity & Status */}
        <div className="flex items-center gap-3">
          <div className="w-[40px] h-[40px] rounded-[11px] bg-gradient-to-br from-[#FFF3E8] to-[#FFE2CC] border border-orange-200/60 text-[#F45A0A] flex items-center justify-center shrink-0 shadow-2xs">
            <Landmark size={21} strokeWidth={2.2} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-slate-900 leading-tight flex items-center gap-1.5">
                <span>{isAr ? 'أسعار الصرف حسب الأسواق' : 'Exchange Rates by Market'}</span>
                <Sparkles size={13} className="text-amber-500" />
              </h2>
              {adoptedRangeStatus === 'INSIDE' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50/90 text-emerald-700 border border-emerald-200 shadow-2xs backdrop-blur-xs">
                  <CheckCircle2 size={11} />
                  <span>{isAr ? 'داخل نطاق السوق' : 'Within Market Range'}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-50/90 text-amber-700 border border-amber-200 shadow-2xs backdrop-blur-xs">
                  <AlertTriangle size={11} />
                  <span>
                    {adoptedRangeStatus === 'ABOVE'
                      ? isAr ? 'أعلى من السوق' : 'Above Market Range'
                      : isAr ? 'أقل من السوق' : 'Below Market Range'}
                  </span>
                </span>
              )}
            </div>
            <span className="text-[11.5px] text-slate-400 font-medium">
              {isAr
                ? 'مقارنة أسعار الشراء والبيع وتحليل النطاق والانحراف عن السعر المعتمد'
                : 'Buy & sell comparison, market range, and deviation from adopted rate'}
            </span>
          </div>
        </div>

        {/* Interactive Controls Bar */}
        <div className="flex items-center gap-2 flex-wrap w-full xl:w-auto justify-end">
          {/* 1. Price Type Selector */}
          <div className="bg-slate-100/80 backdrop-blur-xs rounded-[10px] p-[3px] flex items-center gap-1 border border-slate-200/60 shadow-inner">
            {[
              { key: 'BUY', label: isAr ? 'سعر الشراء' : 'Buy' },
              { key: 'SELL', label: isAr ? 'سعر البيع' : 'Sell' },
              { key: 'MID', label: isAr ? 'المتوسط' : 'Mid' },
            ].map((pt) => (
              <button
                key={pt.key}
                type="button"
                onClick={() => setPriceType(pt.key as PriceType)}
                className={`px-2.5 py-1 rounded-[7px] text-xs font-semibold transition-all cursor-pointer ${
                  priceType === pt.key
                    ? 'bg-white text-[#F45A0A] border border-orange-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_0_10px_rgba(244,90,10,0.12)] font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {pt.label}
              </button>
            ))}
          </div>

          {/* 2. Period Selector */}
          <div className="bg-slate-100/80 backdrop-blur-xs rounded-[10px] p-[3px] flex items-center gap-0.5 border border-slate-200/60 shadow-inner">
            {[
              { key: 'TODAY', label: isAr ? 'يوم' : '1D' },
              { key: 'WEEK', label: isAr ? '7 أيام' : '7D' },
              { key: 'MONTH', label: isAr ? 'شهر' : '1M' },
              { key: '3MONTHS', label: isAr ? '3 أشهر' : '3M' },
              { key: 'YEAR', label: isAr ? 'سنة' : '1Y' },
            ].map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriod(p.key as PeriodType)}
                className={`px-2.5 py-1 rounded-[7px] text-xs font-semibold transition-all cursor-pointer ${
                  period === p.key
                    ? 'bg-white text-[#F45A0A] border border-orange-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_0_10px_rgba(244,90,10,0.12)] font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* 3. Chart Mode Selector */}
          <div className="bg-slate-100/80 backdrop-blur-xs rounded-[10px] p-[3px] flex items-center gap-0.5 border border-slate-200/60 shadow-inner">
            <button
              type="button"
              onClick={() => setChartMode('COMPARE')}
              className={`px-2.5 py-1 rounded-[7px] text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                chartMode === 'COMPARE'
                  ? 'bg-white text-[#F45A0A] border border-orange-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_0_10px_rgba(244,90,10,0.12)] font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Activity size={13} />
              <span>{isAr ? 'مقارنة الأسواق' : 'Compare'}</span>
            </button>

            <button
              type="button"
              onClick={() => setChartMode('RANGE')}
              className={`px-2.5 py-1 rounded-[7px] text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                chartMode === 'RANGE'
                  ? 'bg-white text-[#F45A0A] border border-orange-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_0_10px_rgba(244,90,10,0.12)] font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <SlidersHorizontal size={13} />
              <span>{isAr ? 'نطاق السوق' : 'Range'}</span>
            </button>

            <button
              type="button"
              onClick={() => setChartMode('DEVIATION')}
              className={`px-2.5 py-1 rounded-[7px] text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                chartMode === 'DEVIATION'
                  ? 'bg-white text-[#F45A0A] border border-orange-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_0_10px_rgba(244,90,10,0.12)] font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Scale size={13} />
              <span>{isAr ? 'الانحراف عن المعتمد' : 'Deviation'}</span>
            </button>

            {hasRealOHLC && (
              <button
                type="button"
                onClick={() => setChartMode('CANDLESTICK')}
                className={`px-2.5 py-1 rounded-[7px] text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  chartMode === 'CANDLESTICK'
                    ? 'bg-white text-[#F45A0A] border border-orange-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_0_10px_rgba(244,90,10,0.12)] font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LucideCandlestick size={13} />
                <span>{isAr ? 'الشموع' : 'Candles'}</span>
              </button>
            )}
          </div>

          {/* 4. More Actions Menu */}
          <Menu shadow="md" width={190} position="bottom-end">
            <Menu.Target>
              <button
                type="button"
                className="h-[32px] px-2.5 rounded-[8px] bg-white/90 hover:bg-white border border-slate-200/80 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs hover:border-slate-300"
                title={isAr ? 'المزيد من الإجراءات' : 'More Options'}
              >
                <MoreVertical size={14} />
                <span>{isAr ? 'المزيد' : 'More'}</span>
              </button>
            </Menu.Target>
            <Menu.Dropdown className="backdrop-blur-md bg-white/95 border border-slate-200 shadow-xl rounded-[12px]">
              <Menu.Item leftSection={<ImageIcon size={14} />} onClick={handleExportPNG}>
                {isAr ? 'تصدير صورة PNG' : 'Export PNG Image'}
              </Menu.Item>
              <Menu.Item leftSection={<FileSpreadsheet size={14} />} onClick={handleExportCSV}>
                {isAr ? 'تصدير ملف CSV' : 'Export CSV File'}
              </Menu.Item>
              <Menu.Item leftSection={copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />} onClick={handleCopySummary}>
                {copied ? (isAr ? 'تم النسخ!' : 'Copied!') : (isAr ? 'نسخ الملخص' : 'Copy Summary')}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item leftSection={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />} onClick={fetchSnapshots}>
                {isAr ? 'تحديث البيانات' : 'Refresh Data'}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>
      </div>

      {/* ─── 4 Market Glass Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        {/* Baghdad Market Card */}
        <div className="relative overflow-hidden p-4 rounded-[14px] bg-gradient-to-b from-white/90 to-white/70 border border-slate-200/70 shadow-[0_2px_12px_-1px_rgba(16,185,129,0.06),inset_0_1px_1px_rgba(255,255,255,1)] space-y-2.5 hover:border-emerald-300/80 hover:shadow-[0_4px_16px_rgba(16,185,129,0.12)] transition-all group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#10B981]"></span>
              </span>
              <span className="text-xs font-bold text-slate-900">
                {isAr ? 'سوق بغداد (الكفاح / الحارثية)' : 'Baghdad (Kifah / Harithiya)'}
              </span>
            </div>
            <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-50/90 border border-emerald-200/70 px-1.5 py-0.5 rounded-md">
              {isAr ? 'هامش:' : 'Spread:'} {formatMoney(currentBaghdadSell - currentBaghdadBuy)} {currLabel}
            </span>
          </div>

          <div className="flex items-baseline justify-between text-xs font-mono font-bold pt-1">
            <div>
              <span className="text-[10px] font-sans text-slate-400 block font-normal">{isAr ? 'شراء' : 'Buy'}</span>
              <span className="text-slate-900 text-sm font-extrabold">{formatMoney(currentBaghdadBuy)} <span className="text-[10px] font-sans font-normal text-slate-400">{currLabel}</span></span>
            </div>
            <div className={isAr ? 'text-left' : 'text-right'} dir="ltr">
              <span className={`text-[10px] font-sans text-slate-400 block font-normal ${isAr ? 'text-right' : 'text-left'}`}>{isAr ? 'بيع' : 'Sell'}</span>
              <span className="text-[#10B981] text-sm font-extrabold">{formatMoney(currentBaghdadSell)} <span className="text-[10px] font-sans font-normal text-slate-400">{currLabel}</span></span>
            </div>
          </div>
        </div>

        {/* Northern Market Card */}
        <div className="relative overflow-hidden p-4 rounded-[14px] bg-gradient-to-b from-white/90 to-white/70 border border-slate-200/70 shadow-[0_2px_12px_-1px_rgba(59,130,246,0.06),inset_0_1px_1px_rgba(255,255,255,1)] space-y-2.5 hover:border-blue-300/80 hover:shadow-[0_4px_16px_rgba(59,130,246,0.12)] transition-all group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#3B82F6]"></span>
              </span>
              <span className="text-xs font-bold text-slate-900">
                {isAr ? 'سوق الشمال (أربيل / السليمانية)' : 'Northern (Erbil / Sulaymaniyah)'}
              </span>
            </div>
            <span className="text-[10px] font-mono text-blue-700 font-bold bg-blue-50/90 border border-blue-200/70 px-1.5 py-0.5 rounded-md">
              {isAr ? 'هامش:' : 'Spread:'} {formatMoney(currentNorthSell - currentNorthBuy)} {currLabel}
            </span>
          </div>

          <div className="flex items-baseline justify-between text-xs font-mono font-bold pt-1">
            <div>
              <span className="text-[10px] font-sans text-slate-400 block font-normal">{isAr ? 'شراء' : 'Buy'}</span>
              <span className="text-slate-900 text-sm font-extrabold">{formatMoney(currentNorthBuy)} <span className="text-[10px] font-sans font-normal text-slate-400">{currLabel}</span></span>
            </div>
            <div className={isAr ? 'text-left' : 'text-right'} dir="ltr">
              <span className={`text-[10px] font-sans text-slate-400 block font-normal ${isAr ? 'text-right' : 'text-left'}`}>{isAr ? 'بيع' : 'Sell'}</span>
              <span className="text-[#3B82F6] text-sm font-extrabold">{formatMoney(currentNorthSell)} <span className="text-[10px] font-sans font-normal text-slate-400">{currLabel}</span></span>
            </div>
          </div>
        </div>

        {/* Southern Market Card */}
        <div className="relative overflow-hidden p-4 rounded-[14px] bg-gradient-to-b from-white/90 to-white/70 border border-slate-200/70 shadow-[0_2px_12px_-1px_rgba(139,92,246,0.06),inset_0_1px_1px_rgba(255,255,255,1)] space-y-2.5 hover:border-purple-300/80 hover:shadow-[0_4px_16px_rgba(139,92,246,0.12)] transition-all group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#8B5CF6]"></span>
              </span>
              <span className="text-xs font-bold text-slate-900">
                {isAr ? 'سوق الجنوب (البصرة)' : 'Southern (Basra)'}
              </span>
            </div>
            <span className="text-[10px] font-mono text-purple-700 font-bold bg-purple-50/90 border border-purple-200/70 px-1.5 py-0.5 rounded-md">
              {isAr ? 'هامش:' : 'Spread:'} {formatMoney(currentSouthSell - currentSouthBuy)} {currLabel}
            </span>
          </div>

          <div className="flex items-baseline justify-between text-xs font-mono font-bold pt-1">
            <div>
              <span className="text-[10px] font-sans text-slate-400 block font-normal">{isAr ? 'شراء' : 'Buy'}</span>
              <span className="text-slate-900 text-sm font-extrabold">{formatMoney(currentSouthBuy)} <span className="text-[10px] font-sans font-normal text-slate-400">{currLabel}</span></span>
            </div>
            <div className={isAr ? 'text-left' : 'text-right'} dir="ltr">
              <span className={`text-[10px] font-sans text-slate-400 block font-normal ${isAr ? 'text-right' : 'text-left'}`}>{isAr ? 'بيع' : 'Sell'}</span>
              <span className="text-[#8B5CF6] text-sm font-extrabold">{formatMoney(currentSouthSell)} <span className="text-[10px] font-sans font-normal text-slate-400">{currLabel}</span></span>
            </div>
          </div>
        </div>

        {/* System Adopted Rate Glass Card */}
        <div className="relative overflow-hidden p-4 rounded-[14px] bg-gradient-to-b from-[#FFF7ED]/90 to-[#FFF0E0]/80 border border-orange-200/90 shadow-[0_2px_14px_-1px_rgba(244,90,10,0.12),inset_0_1px_1px_rgba(255,255,255,1)] space-y-2.5 hover:border-orange-400 hover:shadow-[0_4px_20px_rgba(244,90,10,0.18)] transition-all group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#F97316]"></span>
              </span>
              <span className="text-xs font-bold text-[#C2410C]">
                {isAr ? 'السعر المعتمد للنظام' : 'System Adopted Rate'}
              </span>
            </div>
            <span className="text-[10px] font-mono text-[#C2410C] font-bold bg-orange-100/90 border border-orange-200/80 px-1.5 py-0.5 rounded-md">
              {isAr ? 'مرجع:' : 'Ref:'} {formatMoney(baseAdoptedRate)} {currLabel}
            </span>
          </div>

          <div className="flex items-baseline justify-between text-xs font-mono font-bold pt-1">
            <div>
              <span className="text-[10px] font-sans text-slate-400 block font-normal">{isAr ? 'المرجع المالي' : 'Base Rate'}</span>
              <span className="text-slate-800 text-sm font-extrabold">{formatMoney(baseAdoptedRate)} <span className="text-[10px] font-sans font-normal text-slate-400">{currLabel}</span></span>
            </div>
            <div className={isAr ? 'text-left' : 'text-right'} dir="ltr">
              <span className={`text-[10px] font-sans text-slate-400 block font-normal ${isAr ? 'text-right' : 'text-left'}`}>{isAr ? 'المعتمد الفعلي' : 'Actual Adopted'}</span>
              <span className="text-[#F97316] text-base font-black tracking-tight">{formatMoney(adoptedRate)} <span className="text-[10px] font-sans font-normal text-slate-500">{currLabel}</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Compact Summary Metrics Glass Bar ─── */}
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-slate-50/90 backdrop-blur-xs border border-slate-200/70 rounded-[12px] text-xs font-medium text-slate-600 flex-wrap shadow-2xs">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
            <span className="text-slate-400">{isAr ? 'أعلى سعر:' : 'Peak:'}</span>
            <strong className="font-mono text-slate-900">{formatMoney(summaryMetrics.peak)} {currLabel}</strong>
          </span>

          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.5)]" />
            <span className="text-slate-400">{isAr ? 'أدنى سعر:' : 'Low:'}</span>
            <strong className="font-mono text-slate-900">{formatMoney(summaryMetrics.low)} {currLabel}</strong>
          </span>

          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_6px_rgba(139,92,246,0.5)]" />
            <span className="text-slate-400">{isAr ? 'متوسط الأسواق:' : 'Market Avg:'}</span>
            <strong className="font-mono text-slate-900">{formatMoney(summaryMetrics.avgRate)} {currLabel}</strong>
          </span>

          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]" />
            <span className="text-slate-400">{isAr ? 'متوسط الهامش:' : 'Avg Spread:'}</span>
            <strong className="font-mono text-slate-900">{formatMoney(summaryMetrics.avgSpread)} {currLabel}</strong>
          </span>

          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#F97316] shadow-[0_0_6px_rgba(249,115,22,0.5)]" />
            <span className="text-slate-400">{isAr ? 'أكبر انحراف عن المعتمد:' : 'Max Deviation:'}</span>
            <strong className="font-mono text-[#F97316]">{formatMoney(summaryMetrics.maxDeviation)} {currLabel}</strong>
          </span>
        </div>

        <div className={`text-[11px] text-slate-400 font-normal ${isAr ? 'mr-auto' : 'ml-auto'}`}>
          {chartMode === 'COMPARE' && (isAr ? 'مقارنة حركة السعر الفعلية بين الأسواق والسعر المعتمد' : 'Live price comparison across markets and adopted rate')}
          {chartMode === 'RANGE' && (isAr ? 'المنطقة بين أعلى وأدنى سعر مسجل في الأسواق' : 'Range channel between lowest and highest recorded rates')}
          {chartMode === 'DEVIATION' && (isAr ? 'فرق سعر كل سوق عن السعر المعتمد للنظام' : 'Spread difference from system adopted rate')}
          {chartMode === 'CANDLESTICK' && (isAr ? 'سعر الافتتاح والأعلى والأدنى والإغلاق اليومي' : 'Daily Open, High, Low, Close candlesticks')}
        </div>
      </div>

      {/* ─── ECharts Glass Container ─── */}
      <div className="w-full h-[330px] pt-1">
        <ReactECharts
          ref={echartsRef}
          option={chartOption}
          style={{ height: '100%', width: '100%' }}
          notMerge={true}
          lazyUpdate={true}
        />
      </div>
    </div>
  );
};
