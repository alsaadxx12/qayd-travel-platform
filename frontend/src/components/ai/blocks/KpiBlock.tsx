import React from 'react';
import { CopilotCardShell, CopilotCardHeader, formatMoney } from './blockUtils.tsx';

export const KpiBlock: React.FC<{ payload: any }> = ({ payload }) => {
  const items: any[] = payload.items || [];
  return (
    <CopilotCardShell>
      {payload.title && <CopilotCardHeader accent>{payload.title}</CopilotCardHeader>}
      <div className={`grid gap-2 p-2.5 ${items.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {items.map((item, i) => (
          <div
            key={i}
            className={`relative rounded-xl px-3 py-2.5 border overflow-hidden ${
              item.emphasis ? 'bg-[#FFF3E8] border-orange-100' : 'bg-slate-50/80 border-slate-100'
            }`}
          >
            {item.emphasis && <span className="absolute inset-y-0 end-0 w-[3px] bg-[#F45A0A]" />}
            <div className="text-[10.5px] font-semibold text-slate-500 mb-1 truncate">{item.label}</div>
            <div
              dir="ltr"
              className={`text-[17px] leading-none font-extrabold font-mono tabular-nums lining-nums text-right ${
                item.emphasis ? 'text-[#DD4F05]' : 'text-slate-900'
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
