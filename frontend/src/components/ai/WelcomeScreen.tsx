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
    { icon: IconPlane, label: 'التذاكر والحجوزات', desc: 'بحث وتحليل', color: '#F45A0A', bg: '#FFF4ED' },
    { icon: IconReportMoney, label: 'الأرصدة المالية', desc: 'حسابات وصناديق', color: '#0EA5E9', bg: '#EFF9FF' },
    { icon: IconChartBar, label: 'التقارير', desc: 'إحصائيات متقدمة', color: '#8B5CF6', bg: '#F3F0FF' },
    { icon: IconMessageChatbot, label: 'أسئلة عامة', desc: 'أي سؤال تحتاجه', color: '#10B981', bg: '#EDFCF5' },
    { icon: IconPhoto, label: 'الصور', desc: 'تحليل وتصميم', color: '#EC4899', bg: '#FDF0F7' },
    { icon: IconFileSearch, label: 'البحث', desc: 'سجلات وبيانات', color: '#F59E0B', bg: '#FFFBEB' },
  ],
  en: [
    { icon: IconPlane, label: 'Tickets', desc: 'Search & analyze', color: '#F45A0A', bg: '#FFF4ED' },
    { icon: IconReportMoney, label: 'Balances', desc: 'Accounts & cashbox', color: '#0EA5E9', bg: '#EFF9FF' },
    { icon: IconChartBar, label: 'Reports', desc: 'Advanced stats', color: '#8B5CF6', bg: '#F3F0FF' },
    { icon: IconMessageChatbot, label: 'Q&A', desc: 'Any question', color: '#10B981', bg: '#EDFCF5' },
    { icon: IconPhoto, label: 'Images', desc: 'Analyze & design', color: '#EC4899', bg: '#FDF0F7' },
    { icon: IconFileSearch, label: 'Search', desc: 'Records & data', color: '#F59E0B', bg: '#FFFBEB' },
  ],
};

export const WelcomeScreen: React.FC<Props> = ({ isArabic, onDismiss }) => {
  const caps = isArabic ? capabilities.ar : capabilities.en;
  const ArrowIcon = isArabic ? IconArrowLeft : IconArrowRight;

  return (
    <div className="welcome-screen flex-1 flex flex-col overflow-y-auto copilot-scroll">
      {/* ── Hero Section ── */}
      <div className="welcome-hero relative flex flex-col items-center pt-7 pb-6 px-5">
        {/* Animated background orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="welcome-orb-1 absolute w-48 h-48 rounded-full bg-[#F45A0A]/[0.06] blur-3xl -top-10 -right-10" />
          <div className="welcome-orb-2 absolute w-36 h-36 rounded-full bg-[#8B5CF6]/[0.05] blur-3xl -bottom-4 -left-8" />
          <div className="welcome-orb-3 absolute w-28 h-28 rounded-full bg-[#0EA5E9]/[0.05] blur-2xl top-1/2 right-1/4" />
        </div>

        {/* Avatar */}
        <div className="welcome-avatar relative mb-4 z-10">
          {/* Spinning ring */}
          <div className="absolute -inset-2 rounded-full welcome-ring" />
          {/* Avatar image */}
          <div className="relative w-[88px] h-[88px] rounded-full overflow-hidden ring-[3px] ring-white shadow-xl shadow-orange-300/30">
            <img
              src={AI_AVATAR}
              alt={isArabic ? AI_NAME_AR : AI_NAME_EN}
              draggable={false}
              className="w-full h-full object-cover select-none"
            />
          </div>
          {/* Online indicator */}
          <span className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-emerald-500 ring-[2.5px] ring-white shadow-sm" />
          {/* Sparkle */}
          <div className="absolute -top-1 -left-1 welcome-sparkle">
            <IconSparkles size={18} className="text-[#F59E0B]" fill="#F59E0B" />
          </div>
        </div>

        {/* Name badge */}
        <div className="welcome-name-badge z-10 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-[#F45A0A]/[0.08] to-[#DD4F05]/[0.04] border border-[#F45A0A]/15 mb-3">
          <IconSparkles size={13} className="text-[#F45A0A]" />
          <span className="text-[12px] font-extrabold text-[#C2410C] tracking-wide">
            {isArabic ? AI_NAME_AR : AI_NAME_EN}
          </span>
        </div>

        {/* Greeting text */}
        <h2 className="welcome-greeting z-10 text-[18px] font-black text-slate-900 mb-2 text-center leading-snug">
          {isArabic ? '!أهلاً بك' : 'Hello there!'}
        </h2>
        <p className="welcome-subtitle z-10 text-[13px] text-slate-500 text-center leading-relaxed max-w-[280px] whitespace-pre-line">
          {isArabic
            ? 'أتيتُ من الماضي لمساعدتك في الحاضر ✨\nاسألني أي شيء يخصّ نظامك المحاسبي'
            : 'I came from the past to help you in the present ✨\nAsk me anything about your accounting system'}
        </p>
      </div>

      {/* ── Capabilities Grid ── */}
      <div className="px-4 pb-2">
        <div className="welcome-section-label flex items-center gap-1.5 mb-2.5 px-1">
          <div className="w-1 h-4 rounded-full bg-gradient-to-b from-[#F45A0A] to-[#F59E0B]" />
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            {isArabic ? 'ماذا يمكنني أن أفعل' : 'What I can do'}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {caps.map((cap, i) => (
            <div
              key={cap.label}
              className="welcome-cap-card group flex flex-col items-center gap-1.5 py-3.5 px-2 rounded-2xl border border-transparent cursor-default transition-all duration-300 hover:border-slate-200 hover:shadow-md hover:shadow-slate-100/80 hover:-translate-y-0.5"
              style={{ animationDelay: `${0.5 + i * 0.07}s`, backgroundColor: cap.bg }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm transition-transform duration-300 group-hover:scale-110"
                style={{ backgroundColor: `${cap.color}18` }}
              >
                <cap.icon size={20} style={{ color: cap.color }} stroke={1.8} />
              </div>
              <span className="text-[11px] font-bold text-slate-700 text-center leading-tight">{cap.label}</span>
              <span className="text-[9.5px] text-slate-400 font-medium text-center">{cap.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Start Button ── */}
      <div className="welcome-cta flex items-center justify-center px-5 pt-3 pb-5">
        <button
          type="button"
          onClick={onDismiss}
          className="group relative w-full max-w-[300px] h-[48px] rounded-2xl bg-gradient-to-r from-[#F45A0A] via-[#E8520A] to-[#DD4F05] text-white text-[14px] font-bold shadow-lg shadow-orange-500/20 hover:shadow-xl hover:shadow-orange-500/30 active:scale-[0.97] transition-all duration-300 overflow-hidden"
        >
          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.15] to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
          <span className="relative flex items-center justify-center gap-2">
            {isArabic ? 'ابدأ المحادثة' : 'Start chatting'}
            <ArrowIcon size={17} stroke={2.5} className="transition-transform duration-300 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
          </span>
        </button>
      </div>
    </div>
  );
};
