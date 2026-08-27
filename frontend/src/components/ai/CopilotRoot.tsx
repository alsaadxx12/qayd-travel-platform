import React, { useState } from 'react';
import { CopilotPanel } from './CopilotPanel';
import { useLanguageStore } from '../../store/useLanguageStore';
import { AI_AVATAR, AI_NAME_AR } from './persona';

export const CopilotRoot: React.FC = () => {
  const [opened, setOpened] = useState(false);
  const { language } = useLanguageStore();
  const isArabic = language === 'ar';

  return (
    <>
      {!opened && (
        <div
          className={`fixed z-[70] bottom-6 ${
            isArabic ? 'left-6' : 'right-6'
          } group select-none`}
        >
          {/* Pulsing warm glow aura behind the trigger */}
          <div className="absolute -inset-2.5 rounded-full copilot-trigger-glow pointer-events-none" />

          {/* Rotating loading-style gradient ring around Einstein */}
          <div className="absolute -inset-1.5 rounded-full copilot-trigger-ring pointer-events-none" />

          <button
            type="button"
            onClick={() => setOpened(true)}
            className="relative w-16 h-16 rounded-full overflow-hidden bg-white p-[2px] shadow-[0_8px_25px_-4px_rgba(244,90,10,0.4)] hover:shadow-[0_12px_32px_-2px_rgba(244,90,10,0.6)] group-hover:scale-105 active:scale-95 transition-all duration-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200 cursor-pointer"
            title={AI_NAME_AR}
            aria-label={AI_NAME_AR}
          >
            {/* White ring container for crisp avatar display */}
            <div className="w-full h-full rounded-full overflow-hidden bg-white ring-2 ring-white">
              <img
                src={AI_AVATAR}
                alt={AI_NAME_AR}
                draggable={false}
                className="w-full h-full object-cover select-none group-hover:scale-110 transition-transform duration-300"
              />
            </div>
            {/* Live active dot indicator */}
            <span className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white shadow-xs" />
          </button>
        </div>
      )}
      {opened && (
        <>
          <div className="fixed inset-0 z-[75] bg-slate-900/15 backdrop-blur-[1px]" onClick={() => setOpened(false)} />
          <CopilotPanel opened={opened} onClose={() => setOpened(false)} />
        </>
      )}
    </>
  );
};
