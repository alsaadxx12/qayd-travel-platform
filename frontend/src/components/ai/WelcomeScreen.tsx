import React from 'react';
import {
  IconPlane,
  IconReportMoney,
  IconChartBar,
  IconMessageChatbot,
  IconPhoto,
  IconFileSearch,
  IconSparkles,
  IconArrowLeft,
  IconArrowRight,
} from '@tabler/icons-react';
import { AI_AVATAR, AI_NAME_AR, AI_NAME_EN } from './persona';

interface Props {
  isArabic: boolean;
  onDismiss: () => void;
}

const capabilities = {
  ar: [
    { icon: IconPlane, label: 'التذاكر والحجوزات', desc: 'بحث وتحليل' },
    { icon: IconReportMoney, label: 'الأرصدة المالية', desc: 'حسابات وصناديق' },
    { icon: IconChartBar, label: 'التقارير', desc: 'إحصائيات متقدمة' },
    { icon: IconMessageChatbot, label: 'أسئلة عامة', desc: 'أي سؤال تحتاجه' },
    { icon: IconPhoto, label: 'الصور', desc: 'تحليل وتصميم' },
    { icon: IconFileSearch, label: 'البحث', desc: 'سجلات وبيانات' },
  ],
  en: [
    { icon: IconPlane, label: 'Tickets', desc: 'Search & analyze' },
    { icon: IconReportMoney, label: 'Balances', desc: 'Accounts & cashbox' },
    { icon: IconChartBar, label: 'Reports', desc: 'Advanced stats' },
    { icon: IconMessageChatbot, label: 'Q&A', desc: 'Any question' },
    { icon: IconPhoto, label: 'Images', desc: 'Analyze & design' },
    { icon: IconFileSearch, label: 'Search', desc: 'Records & data' },
  ],
};

export const WelcomeScreen: React.FC<Props> = ({ isArabic, onDismiss }) => {
  const caps = isArabic ? capabilities.ar : capabilities.en;
  const ArrowIcon = isArabic ? IconArrowLeft : IconArrowRight;

  return (
    <div className="welcome-screen flex-1 flex flex-col justify-between overflow-y-auto overflow-x-hidden copilot-scroll px-4 py-4">
      {/* ── Hero Section ── */}
      <div className="welcome-hero relative flex flex-col items-center pt-2 pb-2 px-2">
        {/* Animated background orbs in warm brand orange */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="welcome-orb-1 absolute w-44 h-44 rounded-full bg-[#F45A0A]/[0.07] blur-3xl -top-8 -right-8" />
          <div className="welcome-orb-2 absolute w-32 h-32 rounded-full bg-[#DD4F05]/[0.05] blur-3xl -bottom-4 -left-6" />
        </div>

        {/* Avatar */}
        <div className="welcome-avatar relative mb-2.5 z-10">
          {/* Brand orange ring */}
          <div className="absolute -inset-1.5 rounded-full welcome-ring" />
          {/* Avatar image */}
          <div className="relative w-20 h-20 rounded-full overflow-hidden ring-2 ring-white shadow-lg shadow-orange-500/20">
            <img
              src={AI_AVATAR}
              alt={isArabic ? AI_NAME_AR : AI_NAME_EN}
              draggable={false}
              className="w-full h-full object-cover select-none"
            />
          </div>
          {/* Online indicator */}
          <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white shadow-xs" />
          {/* Sparkle */}
          <div className="absolute -top-1 -left-1 welcome-sparkle">
            <IconSparkles size={16} className="text-[#F45A0A]" fill="#F45A0A" />
          </div>
        </div>

        {/* Name badge */}
        <div className="welcome-name-badge z-10 inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#FFF3E8] border border-orange-200/80 mb-2">
          <IconSparkles size={12} className="text-[#F45A0A]" />
          <span className="text-[11.5px] font-extrabold text-[#C2410C] tracking-wide">
            {isArabic ? AI_NAME_AR : AI_NAME_EN}
          </span>
        </div>

        {/* Greeting text */}
        <h2 className="welcome-greeting z-10 text-[17px] font-black text-slate-900 mb-1 text-center leading-snug">
          {isArabic ? 'أهلاً بك!' : 'Hello there!'}
        </h2>
        <p className="welcome-subtitle z-10 text-[12.5px] text-slate-500 text-center leading-relaxed max-w-[280px] whitespace-pre-line">
          {isArabic
            ? 'أتيتُ من الماضي لمساعدتك في الحاضر ✨\nاسألني أي شيء يخصّ نظامك المحاسبي'
            : 'I came from the past to help you in the present ✨\nAsk me anything about your accounting system'}
        </p>
      </div>

      {/* ── Capabilities Grid ── */}
      <div className="px-1 py-1">
        <div className="welcome-section-label flex items-center gap-1.5 mb-2 px-1">
          <div className="w-1 h-3 rounded-full bg-gradient-to-b from-[#F45A0A] to-[#DD4F05]" />
          <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">
            {isArabic ? 'ماذا يمكنني أن أفعل' : 'What I can do'}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {caps.map((cap, i) => (
            <div
              key={cap.label}
              className="welcome-cap-card group flex flex-col items-center gap-1 py-2.5 px-1.5 rounded-xl bg-white border border-slate-200/80 cursor-default transition-all duration-200 hover:border-[#F45A0A] hover:bg-[#FFF7F0] hover:shadow-xs"
              style={{ animationDelay: `${0.3 + i * 0.04}s` }}
            >
              <div className="w-8 h-8 rounded-lg bg-[#FFF3E8] border border-orange-100 flex items-center justify-center shadow-2xs transition-transform duration-200 group-hover:scale-105 group-hover:bg-[#F45A0A] group-hover:border-[#F45A0A]">
                <cap.icon
                  size={16}
                  className="text-[#DD4F05] group-hover:text-white transition-colors duration-150"
                  stroke={2}
                />
              </div>
              <span className="text-[10.5px] font-bold text-slate-800 text-center leading-tight group-hover:text-[#DD4F05] transition-colors">
                {cap.label}
              </span>
              <span className="text-[9px] text-slate-500 font-medium text-center">{cap.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Start Button ── */}
      <div className="welcome-cta flex items-center justify-center pt-2 pb-1">
        <button
          type="button"
          onClick={onDismiss}
          className="group relative w-full max-w-[280px] h-[44px] rounded-2xl bg-gradient-to-r from-[#F45A0A] via-[#E8520A] to-[#DD4F05] text-white text-[13.5px] font-bold shadow-md shadow-orange-500/20 hover:shadow-lg hover:shadow-orange-500/30 active:scale-[0.97] transition-all duration-200 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.15] to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
          <span className="relative flex items-center justify-center gap-2">
            {isArabic ? 'ابدأ المحادثة' : 'Start chatting'}
            <ArrowIcon size={16} stroke={2.5} className="transition-transform duration-300 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
          </span>
        </button>
      </div>
    </div>
  );
};
