import React from 'react';
import { SectionCard } from '../common/SectionCard';
import { SectionHeader } from '../common/SectionHeader';
import {
  IconChartCandle,
  IconBuildingStore,
  IconArrowUpRight,
  IconArrowDownRight,
  IconMinus,
} from '@tabler/icons-react';
import ReactECharts from 'echarts-for-react';

interface ChartCardProps {
  chartOption: any;
  chartPeriod: string;
  onPeriodChange: (period: string) => void;
  chartType: string;
  onTypeChange: (type: string) => void;
  chartSource: 'ALL' | 'ADOPTED' | 'MARKET';
  onSourceChange: (source: 'ALL' | 'ADOPTED' | 'MARKET') => void;
  branchesComparison: Array<{
    name: string;
    code: string;
    buyRate: number;
    sellRate: number;
    diff: number;
    status: 'UP' | 'DOWN' | 'STABLE';
  }>;
}

export const ChartCard: React.FC<ChartCardProps> = ({
  chartOption,
  chartPeriod,
  onPeriodChange,
  chartType,
  onTypeChange,
  chartSource,
  onSourceChange,
  branchesComparison,
}) => {
  return (
    <SectionCard className="mb-6">
      {/* Header with Integrated Controls in One Organized Bar */}
      <SectionHeader
        title="التحليلات ومؤشرات الأسعار"
        description="تتبع حركة تقلبات أسعار الصرف ومقارنة أسعار الفروع المعتمدة"
        icon={<IconChartCandle size={18} />}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {/* Period Selector */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              {[
                { id: '7D', label: '7 أيام' },
                { id: '1M', label: 'شهر' },
                { id: '3M', label: '3 أشهر' },
                { id: '1Y', label: 'سنة' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onPeriodChange(p.id)}
                  className={`h-7 px-2.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    chartPeriod === p.id
                      ? 'bg-white text-orange-600 shadow-2xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Chart Type Selector */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              {[
                { id: 'line', label: 'خطي' },
                { id: 'bar', label: 'أعمدة' },
                { id: 'candlestick', label: 'شموع' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onTypeChange(t.id)}
                  className={`h-7 px-2.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    chartType === t.id
                      ? 'bg-white text-orange-600 shadow-2xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Source Filter */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              {[
                { id: 'ALL', label: 'الكل' },
                { id: 'ADOPTED', label: 'المعتمد' },
                { id: 'MARKET', label: 'الأسواق' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSourceChange(s.id as any)}
                  className={`h-7 px-2.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    chartSource === s.id
                      ? 'bg-white text-orange-600 shadow-2xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {/* 12-Column Grid: 9 Cols Chart + 3 Cols Branch Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Main Chart (9 Columns) */}
        <div className="lg:col-span-9 bg-slate-50/50 border border-slate-200/80 rounded-xl p-3 flex flex-col justify-between">
          <div className="h-[340px] w-full">
            <ReactECharts
              option={chartOption}
              style={{ height: '100%', width: '100%' }}
              notMerge={true}
              lazyUpdate={true}
            />
          </div>
        </div>

        {/* Branch Comparison Card (3 Columns) */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between shadow-2xs">
          <div>
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-1.5 font-black text-[13px] text-slate-800">
                <IconBuildingStore size={16} className="text-orange-600" />
                <span>مقارنة الفروع</span>
              </div>
              <span className="text-[10px] text-slate-400 font-bold bg-slate-100 px-1.5 py-0.5 rounded">
                فروقات الأسعار
              </span>
            </div>

            <div className="space-y-2.5">
              {branchesComparison.map((branch, idx) => {
                const isUp = branch.status === 'UP';
                const isDown = branch.status === 'DOWN';
                return (
                  <div
                    key={idx}
                    className="p-2.5 bg-slate-50/80 border border-slate-100 rounded-lg hover:border-orange-200 transition-all text-right"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[12px] font-bold text-slate-800">
                        {branch.name}
                      </span>
                      <span
                        className={`text-[10.5px] font-mono font-bold flex items-center gap-0.5 ${
                          isUp
                            ? 'text-emerald-700'
                            : isDown
                            ? 'text-rose-700'
                            : 'text-slate-500'
                        }`}
                        dir="ltr"
                      >
                        {isUp && <IconArrowUpRight size={12} />}
                        {isDown && <IconArrowDownRight size={12} />}
                        {!isUp && !isDown && <IconMinus size={11} />}
                        {branch.diff > 0 ? `+${branch.diff}` : branch.diff}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-600 border-t border-slate-200/50 pt-1">
                      <span>
                        شراء:{' '}
                        <strong className="text-slate-900 font-black">
                          {branch.buyRate.toLocaleString()}
                        </strong>
                      </span>
                      <span>
                        بيع:{' '}
                        <strong className="text-orange-600 font-black">
                          {branch.sellRate.toLocaleString()}
                        </strong>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[10.5px] text-slate-400 text-center font-medium">
            يتم تحديث الفروقات آلياً مع أسعار الفروع الرسمية
          </div>
        </div>
      </div>
    </SectionCard>
  );
};
