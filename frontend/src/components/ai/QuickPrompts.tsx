import React from 'react';
import { IconSparkles } from '@tabler/icons-react';

export const QuickPrompts: React.FC<{
  prompts: Array<{ text: string }>;
  onPick: (text: string) => void;
}> = ({ prompts, onPick }) => {
  if (!prompts.length) return null;
  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 mb-2 text-[10.5px] font-bold text-slate-400">
        <IconSparkles size={13} className="text-[#F45A0A]" />
        <span>اسألني عن</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {prompts.map((p) => (
          <button
            key={p.text}
            type="button"
            onClick={() => onPick(p.text)}
            className="h-[30px] px-3 rounded-xl bg-white border border-slate-200 text-[11.5px] text-slate-600 font-semibold hover:border-[#F45A0A] hover:text-[#C2410C] hover:bg-[#FFF7F0] transition-colors"
          >
            {p.text}
          </button>
        ))}
      </div>
    </div>
  );
};
