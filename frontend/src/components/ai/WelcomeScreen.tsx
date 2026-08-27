import React from 'react';
import {
  IconPlane,
  IconReportMoney,
  IconChartBar,
  IconMessageChatbot,
  IconPhoto,
  IconFileSearch,
} from '@tabler/icons-react';
import { AI_AVATAR, AI_NAME_AR, AI_NAME_EN } from './persona';

interface Props {
  isArabic: boolean;
  onDismiss: () => void;
}

const capabilities = {
  ar: [
    { icon: IconPlane, label: 'إدارة التذاكر والحجوزات', color: '#F45A0A' },
    { icon: IconReportMoney, label: 'الأرصدة والحسابات المالية', color: '#0EA5E9' },
    { icon: IconChartBar, label: 'التقارير والإحصائيات', color: '#8B5CF6' },
    { icon: IconMessageChatbot, label: 'أسئلة عامة ومحادثات', color: '#10B981' },
    { icon: IconPhoto, label: 'تصميم وتحليل الصور', color: '#EC4899' },
    { icon: IconFileSearch, label: 'البحث في البيانات والسجلات', color: '#F59E0B' },
  ],
  en: [
    { icon: IconPlane, label: 'Ticket & booking management', color: '#F45A0A' },
    { icon: IconReportMoney, label: 'Balances & financial accounts', color: '#0EA5E9' },
    { icon: IconChartBar, label: 'Reports & statistics', color: '#8B5CF6' },
    { icon: IconMessageChatbot, label: 'General questions & chat', color: '#10B981' },
    { icon: IconPhoto, label: 'Image design & analysis', color: '#EC4899' },
    { icon: IconFileSearch, label: 'Data & records search', color: '#F59E0B' },
  ],
};

export const WelcomeScreen: React.FC<Props> = ({ isArabic, onDismiss }) => {
  const caps = isArabic ? capabilities.ar : capabilities.en;

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 overflow-y-auto animate-[fadeIn_0.5s_ease-out]">
      {/* Avatar with glow */}
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#F45A0A]/25 to-[#DD4F05]/10 blur-xl scale-150 animate-pulse" />
        <div className="relative w-24 h-24 rounded-full overflow-hidden ring-[3px] ring-[#F45A0A]/20 shadow-lg shadow-orange-200/40">
          <img
            src={AI_AVATAR}
            alt={isArabic ? AI_NAME_AR : AI_NAME_EN}
            draggable={false}
            className="w-full h-full object-cover select-none"
          />
        </div>
        {/* Online dot */}
        <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-500 ring-[3px] ring-white" />
      </div>

      {/* Greeting */}
      <h2 className="text-[17px] font-extrabold text-slate-900 mb-1.5 text-center">
        {isArabic ? `أهلاً! أنا ${AI_NAME_AR}` : `Hello! I'm ${AI_NAME_EN}`}
      </h2>
      <p className="text-[13px] text-slate-500 text-center leading-relaxed max-w-[300px] mb-6">
        {isArabic
          ? 'أتيت من الماضي لمساعدتك في الحاضر 🚀\nيمكنني مساعدتك في كل شيء يخص نظامك المحاسبي'
          : 'I came from the past to help you in the present 🚀\nI can help you with everything about your accounting system'}
      </p>

      {/* Capability cards */}
      <div className="grid grid-cols-2 gap-2 w-full max-w-[360px] mb-6">
        {caps.map((cap) => (
          <div
            key={cap.label}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white border border-slate-100 shadow-[0_1px_3px_rgba(15,23,42,0.04)] hover:border-slate-200 hover:shadow-sm transition-all duration-200 cursor-default"
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${cap.color}12` }}
            >
              <cap.icon size={16} style={{ color: cap.color }} stroke={2} />
            </div>
            <span className="text-[11px] font-semibold text-slate-600 leading-tight">{cap.label}</span>
          </div>
        ))}
      </div>

      {/* Start button */}
      <button
        type="button"
        onClick={onDismiss}
        className="h-[42px] px-8 rounded-2xl bg-gradient-to-br from-[#F45A0A] to-[#DD4F05] text-white text-[13px] font-bold shadow-lg shadow-orange-400/25 hover:shadow-orange-400/40 hover:brightness-110 active:scale-[0.97] transition-all duration-200"
      >
        {isArabic ? 'ابدأ المحادثة' : 'Start chatting'}
      </button>
    </div>
  );
};
