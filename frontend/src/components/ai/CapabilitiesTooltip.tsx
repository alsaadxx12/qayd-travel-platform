import React, { useState, useRef, useEffect } from 'react';
import {
  IconBulb,
  IconPlane,
  IconReportMoney,
  IconChartBar,
  IconMessageChatbot,
  IconPhoto,
  IconFileSearch,
} from '@tabler/icons-react';
import { ActionIcon, Tooltip } from '@mantine/core';

interface Props {
  isArabic: boolean;
}

const tips = {
  ar: [
    { icon: IconPlane, text: 'اسألني عن أي تذكرة أو حجز', color: '#F45A0A' },
    { icon: IconReportMoney, text: 'اعرض أرصدة الحسابات والصناديق', color: '#0EA5E9' },
    { icon: IconChartBar, text: 'اطلب تقارير وإحصائيات مالية', color: '#8B5CF6' },
    { icon: IconMessageChatbot, text: 'اسأل أي سؤال عام', color: '#10B981' },
    { icon: IconPhoto, text: 'ارسل صورة لتحليلها أو صمم صورة', color: '#EC4899' },
    { icon: IconFileSearch, text: 'ابحث في سجلات العملاء والموردين', color: '#F59E0B' },
  ],
  en: [
    { icon: IconPlane, text: 'Ask about any ticket or booking', color: '#F45A0A' },
    { icon: IconReportMoney, text: 'View account & cashbox balances', color: '#0EA5E9' },
    { icon: IconChartBar, text: 'Request financial reports & stats', color: '#8B5CF6' },
    { icon: IconMessageChatbot, text: 'Ask any general question', color: '#10B981' },
    { icon: IconPhoto, text: 'Send an image for analysis or design', color: '#EC4899' },
    { icon: IconFileSearch, text: 'Search customer & supplier records', color: '#F59E0B' },
  ],
};

export const CapabilitiesTooltip: React.FC<Props> = ({ isArabic }) => {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const items = isArabic ? tips.ar : tips.en;

  return (
    <div className="relative" ref={popoverRef}>
      <Tooltip label={isArabic ? 'ماذا يمكنني أن أفعل؟' : 'What can I do?'} withArrow>
        <ActionIcon
          variant="subtle"
          color="orange"
          radius="md"
          onClick={() => setOpen((v) => !v)}
        >
          <IconBulb size={16} stroke={2} />
        </ActionIcon>
      </Tooltip>

      {open && (
        <div
          className={`absolute top-full mt-2 ${isArabic ? 'right-0' : 'left-0'} w-[260px] bg-white rounded-xl border border-slate-200 shadow-xl shadow-slate-900/8 z-50 overflow-hidden animate-[fadeIn_0.2s_ease-out]`}
        >
          <div className="px-3 pt-3 pb-2 border-b border-slate-100">
            <div className="text-[12px] font-bold text-slate-700">
              {isArabic ? '💡 كيف يمكنني مساعدتك؟' : '💡 How can I help you?'}
            </div>
          </div>
          <div className="py-1.5">
            {items.map((item) => (
              <div
                key={item.text}
                className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 transition-colors"
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${item.color}12` }}
                >
                  <item.icon size={14} style={{ color: item.color }} stroke={2} />
                </div>
                <span className="text-[11.5px] text-slate-600 font-medium leading-snug">
                  {item.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
