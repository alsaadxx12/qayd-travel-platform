import React, { useState, useEffect } from 'react';
import { IconBrain } from '@tabler/icons-react';
import { CopilotPanel } from './CopilotPanel';
import { useLanguageStore } from '../../store/useLanguageStore';
import { AI_AVATAR, AI_NAME_AR } from './persona';

export const CopilotRoot: React.FC = () => {
  const [opened, setOpened] = useState(false);
  const [showBrain, setShowBrain] = useState(false);
  const { language } = useLanguageStore();
  const isArabic = language === 'ar';

  useEffect(() => {
    if (opened) return;
    const interval = setInterval(() => {
      setShowBrain((prev) => !prev);
    }, 4000);
    return () => clearInterval(interval);
  }, [opened]);

  return (
    <>
      {!opened && (
        <div
          className={`fixed z-[70] bottom-6 ${
            isArabic ? 'left-6' : 'right-6'
          } group select-none`}
        >
          {/* Soft ambient warm glow behind button */}
          <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-[#F45A0A]/30 to-[#FB923C]/20 blur-md pointer-events-none group-hover:scale-115 transition-transform duration-300" />

          {/* Borderless button with smooth crossfade morphing */}
          <button
            type="button"
            onClick={() => setOpened(true)}
            className="relative w-14 h-14 rounded-full shadow-lg shadow-orange-500/20 hover:shadow-2xl hover:shadow-orange-500/35 hover:scale-108 active:scale-95 transition-all duration-300 focus:outline-none cursor-pointer flex items-center justify-center overflow-hidden bg-white"
            title={AI_NAME_AR}
            aria-label={AI_NAME_AR}
          >
            {/* Layer 1: Einstein Avatar with smooth dissolve & subtle scale */}
            <div
              className={`absolute inset-0 w-full h-full transition-all duration-700 ease-in-out ${
                showBrain ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100 scale-100'
              }`}
            >
              <img
                src={AI_AVATAR}
                alt={AI_NAME_AR}
                draggable={false}
                className="w-full h-full object-cover select-none"
              />
            </div>

            {/* Layer 2: Glowing Brain Icon in Brand Orange Theme with smooth dissolve */}
            <div
              className={`absolute inset-0 w-full h-full bg-gradient-to-br from-[#F45A0A] via-[#EA580C] to-[#DD4F05] flex items-center justify-center transition-all duration-700 ease-in-out ${
                showBrain ? 'opacity-100 scale-100' : 'opacity-0 scale-110 pointer-events-none'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center">
                <IconBrain size={20} className="text-white drop-shadow-xs" stroke={2.2} />
              </div>
            </div>
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
