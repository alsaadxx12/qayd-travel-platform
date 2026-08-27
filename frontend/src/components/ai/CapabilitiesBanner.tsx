import React from 'react';
import {
  IconPlane,
  IconReportMoney,
  IconChartBar,
  IconMessageChatbot,
  IconPhoto,
  IconFileSearch,
  IconX,
  IconSparkles,
} from '@tabler/icons-react';
import { ActionIcon } from '@mantine/core';

interface Props {
  isArabic: boolean;
  open: boolean;
  onClose: () => void;
  onSelectPrompt?: (text: string) => void;
}

const capabilities = {
  ar: [
    {
      icon: IconPlane,
      title: 'التذاكر والحجوزات',
      desc: 'استعلام، فلترة وتحليل التذاكر',
      prompt: 'ما هي آخر التذاكر الصادرة اليوم وما هو مجموعها؟',
    },
    {
      icon: IconReportMoney,
      title: 'الأرصدة المالية',
      desc: 'حسابات، صناديق، ومطابقات',
      prompt: 'اعرض لي ملخص أرصدة الصناديق والحسابات الرئيسية',
    },
    {
      icon: IconChartBar,
      title: 'التقارير والإحصائيات',
      desc: 'أرباح، مبيعات، ومؤشرات الأداء',
      prompt: 'أعطني تحليلاً سريعاً لأرباح هذا الشهر',
    },
    {
      icon: IconMessageChatbot,
      title: 'أسئلة عامة واستفسارات',
      desc: 'إجابة عن أي سؤال مالي أو إداري',
      prompt: 'كيف يمكنني تحسين دقة القيود المحاسبية؟',
    },
    {
      icon: IconPhoto,
      title: 'معالجة وتصميم الصور',
      desc: 'الصق صورة لفحصها أو اطلب تصميماً',
      prompt: 'صمم لي بطاقة تهنئة أنيقة لعملاء شركة الطيران',
    },
    {
      icon: IconFileSearch,
      title: 'البحث في السجلات',
      desc: 'عملاء، شركات طيران، وموردين',
      prompt: 'ابحث لي عن كشف حساب عميل',
    },
  ],
  en: [
    {
      icon: IconPlane,
      title: 'Tickets & Bookings',
      desc: 'Query, filter, and analyze tickets',
      prompt: 'What are the latest issued tickets today?',
    },
    {
      icon: IconReportMoney,
      title: 'Financial Balances',
      desc: 'Accounts, cashboxes, reconciliations',
      prompt: 'Show me a summary of main account balances',
    },
    {
      icon: IconChartBar,
      title: 'Reports & Analytics',
      desc: 'Profits, sales, and KPIs',
      prompt: 'Give me a quick analysis of this month profits',
    },
    {
      icon: IconMessageChatbot,
      title: 'General Q&A',
      desc: 'Answer financial & operational questions',
      prompt: 'How can I optimize accounting journal entries?',
    },
    {
      icon: IconPhoto,
      title: 'Image Analysis & Design',
      desc: 'Paste images to inspect or generate designs',
      prompt: 'Design an elegant greeting card for airline clients',
    },
    {
      icon: IconFileSearch,
      title: 'Search Records',
      desc: 'Customers, airlines, and suppliers',
      prompt: 'Search for customer account statement',
    },
  ],
};

export const CapabilitiesBanner: React.FC<Props> = ({
  isArabic,
  open,
  onClose,
  onSelectPrompt,
}) => {
  const items = isArabic ? capabilities.ar : capabilities.en;

  if (!open) return null;

  return (
    <div className="border-b border-orange-200/70 bg-gradient-to-b from-[#FFFBF7] to-white px-3.5 py-3 shadow-[0_4px_16px_-4px_rgba(244,90,10,0.08)] animate-[fadeIn_0.25s_ease-out] relative z-20">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[#FFF3E8] border border-orange-200 flex items-center justify-center text-[#DD4F05]">
            <IconSparkles size={14} />
          </div>
          <span className="text-[12px] font-extrabold text-slate-800">
            {isArabic ? 'بماذا يمكنني مساعدتك؟' : 'How can I help you?'}
          </span>
        </div>
        <ActionIcon
          variant="subtle"
          color="orange"
          size="sm"
          radius="md"
          onClick={onClose}
          aria-label={isArabic ? 'إغلاق' : 'Close'}
        >
          <IconX size={15} />
        </ActionIcon>
      </div>

      <div className="grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto copilot-scroll pe-0.5">
        {items.map((item) => (
          <button
            key={item.title}
            type="button"
            onClick={() => {
              if (onSelectPrompt) onSelectPrompt(item.prompt);
            }}
            className="flex items-start gap-2.5 p-2.5 rounded-xl text-start bg-white border border-slate-200/80 hover:border-[#F45A0A] hover:bg-[#FFF7F0] hover:shadow-xs transition-all duration-150 group cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-[#FFF3E8] border border-orange-100/80 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-[#F45A0A] group-hover:border-[#F45A0A] transition-all duration-150">
              <item.icon
                size={15}
                className="text-[#DD4F05] group-hover:text-white transition-colors duration-150"
                stroke={2}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11.5px] font-bold text-slate-800 leading-snug group-hover:text-[#DD4F05] transition-colors">
                {item.title}
              </div>
              <div className="text-[10px] text-slate-500 line-clamp-1 leading-normal mt-0.5">
                {item.desc}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
