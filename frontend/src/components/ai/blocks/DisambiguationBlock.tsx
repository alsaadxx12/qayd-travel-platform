import React from 'react';
import { CopilotCardShell } from './blockUtils.tsx';

export const DisambiguationBlock: React.FC<{
  payload: any;
  onPrompt?: (text: string) => void;
}> = ({ payload, onPrompt }) => {
  const options: any[] = payload.options || [];
  return (
    <CopilotCardShell>
      <div className="px-3 py-2 text-[12px] font-bold text-slate-700 border-b border-slate-100">
        يوجد أكثر من نتيجة لـ «{payload.query}» — اختر المقصود
      </div>
      <div className="divide-y divide-slate-100">
        {options.map((opt) => (
          <button
            key={`${opt.kind}-${opt.id}`}
            type="button"
            onClick={() =>
              onPrompt?.(
                `اخترت: ${opt.kindLabel || opt.kind} «${opt.label}»\n[[entity:${opt.kind}:${opt.id}:${opt.accountId || ''}]]`,
              )
            }
            className="w-full text-right px-3 py-2 hover:bg-orange-50 transition-colors"
          >
            <div className="text-[12px] font-bold text-slate-800">{opt.label}</div>
            <div className="text-[10px] text-slate-500">
              {opt.kindLabel}
              {opt.subtitle ? ` · ${opt.subtitle}` : ''}
            </div>
          </button>
        ))}
      </div>
    </CopilotCardShell>
  );
};
