import React, { useRef } from 'react';
import { useLanguageStore } from '../../store/useLanguageStore';

interface CurrencySegmentedControlProps {
  value: string;
  onChange: (value: any) => void;
  disabled?: boolean;
  className?: string;
  showLabel?: boolean;
  showAllOption?: boolean;
  height?: string;
}

export const CurrencySegmentedControl: React.FC<CurrencySegmentedControlProps> = ({
  value = 'ALL',
  onChange,
  disabled = false,
  className = '',
  showLabel = true,
  showAllOption = true,
  height = 'h-[38px]',
}) => {
  const allRef = useRef<HTMLButtonElement>(null);
  const iqdRef = useRef<HTMLButtonElement>(null);
  const usdRef = useRef<HTMLButtonElement>(null);

  const { t, language } = useLanguageStore();

  const isALL = value === 'ALL';
  const isIQD = value === 'IQD';
  const isUSD = value === 'USD';

  return (
    <div className={`flex flex-col select-none font-sans ${className}`}>
      {showLabel && (
        <label className="block text-[12.5px] font-medium text-[#6B7280] mb-[7px]">
          {language === 'ar' ? 'العملة' : 'Currency'}
        </label>
      )}

      {/* ── Outer Container (#F3F4F6, 1px #E5E7EB, Radius 10px, Padding 3px) ── */}
      <div
        role="radiogroup"
        aria-label="Currency Selector"
        className={`${height} ${showAllOption ? 'w-[280px] grid-cols-3' : 'w-[200px] grid-cols-2'} p-[3px] bg-[#F1F5F9] border border-[#E2E8F0] rounded-[11px] grid gap-1 relative ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        {/* Option 1: ALL / All Currencies */}
        {showAllOption && (
          <button
            ref={allRef}
            type="button"
            role="radio"
            aria-checked={isALL}
            tabIndex={isALL ? 0 : -1}
            disabled={disabled}
            onClick={() => !disabled && onChange('ALL')}
            className={`h-full rounded-[8px] flex items-center justify-center gap-1 text-xs transition-all duration-150 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#F45A0A]/40 ${
              isALL
                ? 'bg-[#F45A0A] text-white font-bold shadow-xs border border-[#EA580C]'
                : 'bg-transparent text-slate-600 font-semibold border border-transparent hover:bg-white/80 hover:text-slate-900'
            }`}
          >
            <span className="text-[12px]">{language === 'ar' ? 'كافة العملات' : 'All Currencies'}</span>
          </button>
        )}

        {/* Option 2: IQD (English Only) */}
        <button
          ref={iqdRef}
          type="button"
          role="radio"
          aria-checked={isIQD}
          tabIndex={isIQD ? 0 : -1}
          disabled={disabled}
          onClick={() => !disabled && onChange('IQD')}
          className={`h-full rounded-[8px] flex items-center justify-center gap-1.5 text-xs transition-all duration-150 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#F45A0A]/40 ${
            isIQD
              ? 'bg-[#F45A0A] text-white font-bold shadow-xs border border-[#EA580C]'
              : 'bg-transparent text-slate-600 font-semibold border border-transparent hover:bg-white/80 hover:text-slate-900'
          }`}
        >
          <span className="font-mono text-[12px] font-bold tracking-wide" dir="ltr">IQD</span>
        </button>

        {/* Option 3: $ USD */}
        <button
          ref={usdRef}
          type="button"
          role="radio"
          aria-checked={isUSD}
          tabIndex={isUSD ? 0 : -1}
          disabled={disabled}
          onClick={() => !disabled && onChange('USD')}
          className={`h-full rounded-[8px] flex items-center justify-center gap-1.5 text-xs transition-all duration-150 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#F45A0A]/40 ${
            isUSD
              ? 'bg-[#F45A0A] text-white font-bold shadow-xs border border-[#EA580C]'
              : 'bg-transparent text-slate-600 font-semibold border border-transparent hover:bg-white/80 hover:text-slate-900'
          }`}
        >
          <span className="font-mono text-[12px] font-bold tracking-wide" dir="ltr">$ USD</span>
        </button>
      </div>
    </div>
  );
};

export default CurrencySegmentedControl;
