import React from 'react';
import { CopilotCardShell } from './blockUtils.tsx';

export const EntityCardBlock: React.FC<{
  payload: any;
  onPrompt?: (text: string) => void;
}> = ({ payload, onPrompt }) => {
  const token = `[[entity:${payload.kind}:${payload.id}:${payload.accountId || ''}]]`;
  const pick = `اخترت: ${payload.kindLabel || payload.kind} «${payload.label}»\n${token}`;
  const actions = [
    { label: 'الرصيد', prompt: `رصيده\n${token}` },
    { label: 'كشف PDF', prompt: `كشف PDF\n${token}` },
    { label: 'أرسل بالإيميل', prompt: `أرسل الكشف بالإيميل\n${token}` },
  ];

  return (
    <CopilotCardShell>
      <button
        type="button"
        onClick={() => onPrompt?.(pick)}
        className="w-full text-right px-3.5 py-3 hover:bg-[#FFF7F0] transition-colors focus:outline-none focus-visible:bg-[#FFF3E8]"
      >
        <div className="text-[13px] font-bold text-slate-900 truncate">{payload.label}</div>
        <div className="text-[10.5px] text-slate-400 truncate">
          {payload.kindLabel}
          {payload.phone ? ` · ` : ''}
          {payload.phone ? (
            <span dir="ltr" className="font-mono tabular-nums">
              {payload.phone}
            </span>
          ) : null}
        </div>
      </button>
      {onPrompt ? (
        <div className="flex gap-1.5 px-3 pb-3 flex-wrap">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => onPrompt(a.prompt)}
              className="h-[27px] px-2.5 rounded-lg bg-white border border-orange-200 text-[10.5px] text-[#C2410C] font-bold hover:bg-[#FFF3E8] hover:border-[#F45A0A] transition-colors"
            >
              {a.label}
            </button>
          ))}
        </div>
      ) : null}
    </CopilotCardShell>
  );
};
