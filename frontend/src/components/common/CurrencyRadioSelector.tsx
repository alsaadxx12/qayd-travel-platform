import React from 'react';

interface CurrencyRadioSelectorProps {
  value: string;
  onChange: (currency: string) => void;
  currencies?: { code: string; label: string }[];
}

const defaultCurrencies = [
  { code: 'IQD', label: 'IQD (دينار عراقي)' },
  { code: 'USD', label: 'USD (دولار أمريكي)' },
];

export const CurrencyRadioSelector: React.FC<CurrencyRadioSelectorProps> = ({
  value = 'IQD',
  onChange,
  currencies = defaultCurrencies,
}) => {
  return (
    <div className="space-y-1 text-xs select-none">
      <label className="block font-bold text-slate-800">اختيار العملة المالية</label>
      <div className="flex items-center gap-2 p-1 bg-slate-100 border border-slate-300 rounded-md">
        {currencies.map((c) => {
          const isSelected = value === c.code;
          return (
            <label
              key={c.code}
              className={`flex-1 h-[36px] px-4 rounded flex items-center justify-center gap-2 cursor-pointer transition-all border font-bold text-xs ${
                isSelected
                  ? 'bg-orange-600 text-white border-orange-700 shadow-2xs font-extrabold'
                  : 'bg-white text-slate-700 hover:bg-slate-200/80 border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="currency_radio"
                value={c.code}
                checked={isSelected}
                onChange={() => onChange(c.code)}
                className="w-4 h-4 accent-orange-600 cursor-pointer"
              />
              <span>{c.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
};
