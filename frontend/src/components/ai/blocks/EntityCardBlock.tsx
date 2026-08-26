import React from 'react';
import { CopilotCardShell } from './blockUtils.tsx';

export const EntityCardBlock: React.FC<{
  payload: any;
  onPrompt?: (text: string) => void;
}> = ({ payload, onPrompt }) => {
  const token = `[[entity:${payload.kind}:${payload.id}:${payload.accountId || ''}]]`;
  const pick = `اخترت: ${payload.kindLabel || payload.kind} «${payload.label}»\n${token}`;
  const actions = [
    { label: 'كشف PDF', prompt: `كشف PDF\n${token}` },
    { label: 'أرسل الكشف بالإيميل', prompt: `أرسل الكشف بالإيميل\n${token}` },
    { label: 'الرصيد', prompt: `رصيده\n${token}` },
  ];

  return (
    <CopilotCardShell>
      <button
        type="button"
        onClick={() => onPrompt?.(pick)}
        className="w-full text-right px-3 py-2.5 border-b border-slate-100 hover:bg-orange-50"
      >
        <div className="text-[13px] font-bold text-slate-800">{payload.label}</div>
        <div className="text-[11px] text-slate-500">
          {payload.kindLabel}
          {payload.phone ? ` · ${payload.phone}` : ''}
        </div>
      </button>
      {onPrompt ? (
        <div className="flex gap-1.5 px-3 py-2.5 flex-wrap">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => onPrompt(a.prompt)}
              className="text-[10px] px-2 py-1 rounded-full bg-orange-50 text-[#F45A0A] font-semibold hover:bg-orange-100"
            >
              {a.label}
            </button>
          ))}
        </div>
      ) : null}
    </CopilotCardShell>
  );
};
