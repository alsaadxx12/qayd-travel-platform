import React from 'react';
import { IconChevronLeft } from '@tabler/icons-react';
import { CopilotCardShell, CopilotCardHeader } from './blockUtils.tsx';

export const DisambiguationBlock: React.FC<{
  payload: any;
  onPrompt?: (text: string) => void;
}> = ({ payload, onPrompt }) => {
  const options: any[] = payload.options || [];
  return (
    <CopilotCardShell>
      <CopilotCardHeader>أكثر من نتيجة لـ «{payload.query}» — اختر المقصود</CopilotCardHeader>
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
            className="group w-full flex items-center gap-2 text-right px-3.5 py-2.5 hover:bg-[#FFF7F0] transition-colors focus:outline-none focus-visible:bg-[#FFF3E8]"
          >
            <span className="flex-1 min-w-0">
              <span className="block text-[12.5px] font-bold text-slate-800 truncate group-hover:text-[#C2410C]">
                {opt.label}
              </span>
              <span className="block text-[10.5px] text-slate-400 truncate">
                {opt.kindLabel}
                {opt.subtitle ? ` · ${opt.subtitle}` : ''}
              </span>
            </span>
            <IconChevronLeft
              size={15}
              className="shrink-0 text-slate-300 group-hover:text-[#F45A0A] transition-colors"
            />
          </button>
        ))}
      </div>
    </CopilotCardShell>
  );
};
