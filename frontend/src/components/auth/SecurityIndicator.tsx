import React from 'react';
import { Lock } from 'lucide-react';

interface SecurityIndicatorProps {
  lang?: 'ar' | 'en';
}

export const SecurityIndicator: React.FC<SecurityIndicatorProps> = ({ lang = 'ar' }) => {
  return (
    <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-[#64748B] select-none">
      <Lock size={14} className="text-[#059669] shrink-0" />
      <span>{lang === 'ar' ? 'اتصال مشفر وآمن' : 'Secure & Encrypted Connection'}</span>
    </div>
  );
};
