import React, { useState } from 'react';
import { IconRobot } from '@tabler/icons-react';
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
          className={`fixed z-[70] bottom-6 ${isArabic ? 'left-6' : 'right-6'} w-14 h-14 rounded-full bg-[#F45A0A] text-white shadow-lg hover:scale-105 transition-transform flex items-center justify-center`}
          title={isArabic ? 'المستشار الذكي' : 'AI Copilot'}
        >
          <IconRobot size={26} />
        </button>
      )}
      {opened && (
        <>
          <div className="fixed inset-0 z-[75] bg-black/10" onClick={() => setOpened(false)} />
          <CopilotPanel opened={opened} onClose={() => setOpened(false)} />
        </>
      )}
    </>
  );
};
