import React from 'react';
import { CopilotCardShell, formatMoney } from './blockUtils.tsx';

export const KpiBlock: React.FC<{ payload: any }> = ({ payload }) => {
  const items: any[] = payload.items || [];
  return (
    <CopilotCardShell>
      {payload.title && (
        <div className="px-3 py-2 text-[12px] font-bold text-slate-800 border-b border-slate-100 bg-slate-50/80">
          {payload.title}
        </div>
      )}
      <div className={`grid gap-2 p-3 ${items.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {items.map((item, i) => (
          <div
            key={i}
            className={`rounded-xl px-3 py-2.5 border ${
              item.emphasis ? 'bg-orange-50 border-orange-100' : 'bg-slate-50 border-slate-100'
            }`}
          >
            <div className="text-[11px] text-slate-500 mb-1">{item.label}</div>
            <div
              dir="ltr"
              className={`text-[16px] leading-tight font-extrabold tabular-nums ${
                item.emphasis ? 'text-[#F45A0A]' : 'text-slate-900'
              }`}
            >
              {item.type === 'text' || item.type === 'count'
                ? item.value
                : formatMoney(item.value, item.currency === 'USD' ? 'USD' : undefined)}
            </div>
          </div>
        ))}
      </div>
    </CopilotCardShell>
  );
};
