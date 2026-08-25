import React from 'react';
import {
  IconArrowUpRight,
  IconArrowDownRight,
  IconMinus,
  IconBuildingBank,
} from '@tabler/icons-react';

export interface MarketRateProps {
  title: string;
  subtitle?: string;
  buyRate: number;
  sellRate: number;
  changeStatus?: 'UP' | 'DOWN' | 'STABLE';
  changeAmount?: number;
  updatedAt?: string;
  accentColor?: string;
  isAdopted?: boolean;
}

export const MarketRateCard: React.FC<MarketRateProps> = ({
  title,
  subtitle,
  buyRate,
  sellRate,
  changeStatus = 'STABLE',
  changeAmount = 0,
  updatedAt,
  isAdopted = false,
}) => {
  const isUp = changeStatus === 'UP';
  const isDown = changeStatus === 'DOWN';

  return (
    <div className="bg-white border border-[#E5E7EB] hover:border-orange-200 rounded-[14px] p-5 shadow-xs flex flex-col justify-between transition-all duration-150 relative overflow-hidden group">
      {/* Top indicator tag */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-orange-50 text-orange-600 border border-orange-100 flex items-center justify-center shrink-0">
            <IconBuildingBank size={15} />
          </div>
          <div>
            <h3 className="text-[14px] font-black text-slate-800 leading-tight">
              {title}
            </h3>
            {subtitle && (
              <span className="text-[11px] text-slate-400 font-medium block">
                {subtitle}
              </span>
            )}
          </div>
        </div>

        {/* Change Badge */}
        <div
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border font-mono ${
            isUp
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : isDown
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : 'bg-slate-50 text-slate-600 border-slate-200'
          }`}
          dir="ltr"
        >
          {isUp && <IconArrowUpRight size={13} className="shrink-0" />}
          {isDown && <IconArrowDownRight size={13} className="shrink-0" />}
          {!isUp && !isDown && <IconMinus size={12} className="shrink-0" />}
          <span>
            {changeAmount > 0 ? `+${changeAmount.toFixed(1)}` : changeAmount < 0 ? `${changeAmount.toFixed(1)}` : '0.0'}
          </span>
        </div>
      </div>

      {/* Main Prices Area: Equal Heights & Prominent Numbers */}
      <div className="grid grid-cols-2 gap-3 my-4">
        {/* Buy Rate */}
        <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3 text-right">
          <span className="text-[11px] font-bold text-slate-500 block mb-1">
            سعر الشراء (Buy)
          </span>
          <div className="text-[26px] md:text-[28px] font-mono font-black text-slate-900 leading-none tabular-nums tracking-tight">
            {buyRate.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          </div>
          <span className="text-[10.5px] text-slate-400 font-medium block mt-1">
            لكل 100 دولار
          </span>
        </div>

        {/* Sell Rate */}
        <div className="bg-orange-50/40 border border-orange-100/70 rounded-xl p-3 text-right">
          <span className="text-[11px] font-bold text-orange-950 block mb-1">
            سعر البيع (Sell)
          </span>
          <div className="text-[26px] md:text-[28px] font-mono font-black text-orange-600 leading-none tabular-nums tracking-tight">
            {sellRate.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          </div>
          <span className="text-[10.5px] text-orange-400/80 font-medium block mt-1">
            لكل 100 دولار
          </span>
        </div>
      </div>

      {/* Footer info: Last Updated & Status */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
        <span>الحالة: {isAdopted ? 'السعر المعتمد للنظام' : 'سعر السوق المباشر'}</span>
        {updatedAt && (
          <span className="font-mono text-slate-500" dir="ltr">
            {updatedAt}
          </span>
        )}
      </div>
    </div>
  );
};
