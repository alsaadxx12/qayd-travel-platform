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
          {/* Soft subtle glow behind button */}
          <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-[#F45A0A]/35 to-[#FB923C]/20 blur-md pointer-events-none group-hover:scale-110 transition-transform duration-300" />

          {/* Slim Precision Button with integrated rotating border */}
          <button
            type="button"
            onClick={() => setOpened(true)}
            className="relative w-14 h-14 rounded-full p-[2px] overflow-hidden shadow-md shadow-orange-500/20 hover:shadow-xl hover:shadow-orange-500/35 hover:scale-105 active:scale-95 transition-all duration-300 focus:outline-none focus-visible:ring-3 focus-visible:ring-orange-300 cursor-pointer flex items-center justify-center bg-white"
            title={AI_NAME_AR}
            aria-label={AI_NAME_AR}
          >
            {/* Seamless rotating gradient border with zero gap */}
            <div className="absolute -inset-[100%] copilot-spin-gradient pointer-events-none" />

            {/* Inner avatar container */}
            <div className="relative w-full h-full rounded-full overflow-hidden bg-white p-[1px]">
              <img
                src={AI_AVATAR}
                alt={AI_NAME_AR}
                draggable={false}
                className="w-full h-full object-cover rounded-full select-none group-hover:scale-110 transition-transform duration-300"
              />
            </div>

            {/* Subtle live status dot */}
            <span className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white shadow-xs z-10" />
          </button>
        </div>
      )}
      {opened && (
        <div
          className="fixed inset-0 z-[75] bg-slate-900/15 backdrop-blur-[1px]"
          onClick={() => setOpened(false)}
        />
      )}
      <div className={opened ? 'contents' : 'hidden'}>
        <CopilotPanel opened={opened} onClose={() => setOpened(false)} />
      </div>
    </>
  );
};
