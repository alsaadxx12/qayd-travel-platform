import React from 'react';

export const QuickPrompts: React.FC<{
  prompts: Array<{ text: string }>;
  onPick: (text: string) => void;
}> = ({ prompts, onPick }) => {
  if (!prompts.length) return null;
  return (
    <div className="mb-2">
      <div className="text-[11px] font-bold text-slate-500 mb-1.5">اسألني عن:</div>
      <div className="flex flex-wrap gap-1.5">
        {prompts.map((p) => (
          <button
            key={p.text}
            type="button"
            onClick={() => onPick(p.text)}
            className="text-[11px] px-2.5 py-1.5 rounded-full border border-orange-100 bg-orange-50 text-[#F45A0A] font-semibold hover:bg-orange-100"
          >
            {p.text}
          </button>
        ))}
      </div>
    </div>
  );
};
