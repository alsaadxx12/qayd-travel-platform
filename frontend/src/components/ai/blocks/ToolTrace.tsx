import React from 'react';
import { IconCheck, IconMinus } from '@tabler/icons-react';
import { AI_AVATAR, AI_NAME_AR, AI_THINKING_AR, AI_THINKING_EN } from '../persona';

/**
 * A running log of what the Copilot actually did. A tool that simply matched
 * nothing is NOT an error — it gets a neutral dash, not an alarming red dot.
 */
export const ToolTrace: React.FC<{
  tools: Array<{ name: string; label: string; status: 'running' | 'ok' | 'error' }>;
}> = ({ tools }) => {
  if (!tools.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mb-1.5">
      {tools.map((t, i) => {
        const running = t.status === 'running';
        const ok = t.status === 'ok';
        return (
          <span
            key={`${t.name}-${i}`}
            className={`inline-flex items-center gap-1.5 h-[24px] ps-2 pe-2.5 rounded-full text-[10.5px] font-semibold border ${
              running
                ? 'bg-[#FFF3E8] border-orange-200 text-[#C2410C]'
                : ok
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                  : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}
          >
            {running ? (
              <span className="w-3 h-3 rounded-full border-[1.5px] border-[#F45A0A] border-t-transparent animate-spin" />
            ) : ok ? (
              <IconCheck size={12} stroke={3} />
            ) : (
              <IconMinus size={12} stroke={3} />
            )}
            <span className="truncate max-w-[13rem]">{t.label || t.name}</span>
          </span>
        );
      })}
    </div>
  );
};

export const SkeletonBlock: React.FC<{ isArabic?: boolean }> = ({ isArabic = true }) => (
  <div className="flex items-center gap-2.5 py-0.5">
    <span className="shrink-0 w-9 h-9 rounded-full overflow-hidden bg-white ring-1 ring-slate-200 shadow-sm">
      <img
        src={AI_AVATAR}
        alt={AI_NAME_AR}
        draggable={false}
        className="w-full h-full object-cover select-none"
      />
    </span>
    <span className="copilot-typing flex items-center gap-1">
      <span />
      <span />
      <span />
    </span>
    <span className="text-[11.5px] font-semibold text-slate-500 whitespace-nowrap">
      {isArabic ? AI_THINKING_AR : AI_THINKING_EN}
    </span>
  </div>
);
