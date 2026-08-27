import React, { useState } from 'react';
import { CopilotPanel } from './CopilotPanel';
import { useLanguageStore } from '../../store/useLanguageStore';

export const CopilotRoot: React.FC = () => {
  const [opened, setOpened] = useState(false);
  const { language } = useLanguageStore();
  const isArabic = language === 'ar';

  return (
    <>
      {!opened && (
        <button
          type="button"
          onClick={() => setOpened(true)}
          className={`fixed z-[70] bottom-6 ${isArabic ? 'left-6' : 'right-6'} w-16 h-16 rounded-full overflow-hidden bg-white shadow-[0_6px_18px_-4px_rgba(15,23,42,0.35)] hover:brightness-105 transition-[filter] duration-150 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-200`}
          title="أينشتاين العراق"
          aria-label="أينشتاين العراق"
        >
          {/* The artwork fills the button edge to edge — no padding, no icon box. */}
          <img src="/images/einstein-iraq.png" alt="" draggable={false} className="w-full h-full object-cover select-none" />
        </button>
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
