import React from 'react';
import { ActionIcon, Tooltip } from '@mantine/core';
import {
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconBulb,
  IconChevronDown,
  IconHistory,
  IconPlus,
} from '@tabler/icons-react';
import type { CopilotMode } from './CopilotPanel';
import { AI_AVATAR, AI_GREETING_AR, AI_GREETING_EN, AI_NAME_AR } from './persona';

interface Props {
  isArabic: boolean;
  rate?: number;
  mode: CopilotMode;
  onMode: (mode: CopilotMode) => void;
  onNew: () => void;
  onHistory: () => void;
  onToggleCapabilities?: () => void;
  showCapabilities?: boolean;
  onClose: () => void;
  connected: boolean;
}

export const CopilotHeader: React.FC<Props> = ({
  isArabic,
  rate,
  mode,
  onMode,
  onNew,
  onHistory,
  onToggleCapabilities,
  showCapabilities,
  onClose,
  connected,
}) => (
  // No coloured strip across the top: on a rounded panel its ends get clipped and
  // it reads as a stray line. The warmth comes from a soft wash instead, and the
  // brand colour is carried by the avatar where it belongs.
  <div className="relative flex items-center gap-2.5 px-3.5 py-3 bg-gradient-to-b from-[#FFFAF6] to-white border-b border-slate-200/70">
    <div className="relative shrink-0">
      <div className="w-10 h-10 rounded-full overflow-hidden bg-white ring-1 ring-slate-200 shadow-sm">
        <img
          src={AI_AVATAR}
          alt={AI_NAME_AR}
          draggable={false}
          className="w-full h-full object-cover select-none"
        />
      </div>
      <span
        className={`absolute -bottom-0.5 ${isArabic ? '-left-0.5' : '-right-0.5'} w-3 h-3 rounded-full ring-2 ring-white ${
          connected ? 'bg-emerald-500' : 'bg-slate-300'
        }`}
      />
    </div>

    <div className="flex-1 min-w-0">
      <div className="text-[12px] font-bold text-slate-900 leading-tight">
        {isArabic ? AI_GREETING_AR : AI_GREETING_EN}
      </div>
      <div className="text-[10.5px] text-slate-400 leading-tight">
        {connected ? (isArabic ? 'جاهز للإجابة' : 'Ready') : isArabic ? 'غير متصل' : 'Offline'}
      </div>
    </div>

    {rate ? (
      <Tooltip label={isArabic ? 'السعر المعتمد في النظام' : 'Adopted rate'} withArrow>
        <div className="hidden sm:flex items-baseline gap-1 shrink-0 px-2.5 h-[26px] rounded-lg bg-[#FFF3E8] border border-orange-100">
          <span className="text-[9.5px] font-bold text-[#C2410C]">USD</span>
          <span dir="ltr" className="font-mono tabular-nums lining-nums text-[12px] font-extrabold text-[#DD4F05]">
            {Number(rate).toLocaleString('en-US')}
          </span>
        </div>
      </Tooltip>
    ) : null}

    <div className="flex items-center gap-0.5 shrink-0 ps-1 border-s border-slate-200">
      <Tooltip label={isArabic ? 'محادثة جديدة' : 'New chat'} withArrow>
        <ActionIcon variant="subtle" color="orange" radius="md" onClick={onNew}>
          <IconPlus size={16} stroke={2.2} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label={isArabic ? 'السجل' : 'History'} withArrow>
        <ActionIcon variant="subtle" color="gray" radius="md" onClick={onHistory}>
          <IconHistory size={16} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label={isArabic ? 'ماذا يمكنني أن أفعل؟' : 'What can I do?'} withArrow>
        <ActionIcon
          variant={showCapabilities ? 'filled' : 'subtle'}
          color="orange"
          radius="md"
          onClick={onToggleCapabilities}
          aria-label={isArabic ? 'ماذا يمكنني أن أفعل؟' : 'What can I do?'}
        >
          <IconBulb size={16} stroke={2} />
        </ActionIcon>
      </Tooltip>
      <Tooltip
        label={mode === 'fullscreen' ? (isArabic ? 'تصغير' : 'Exit full') : isArabic ? 'تكبير' : 'Expand'}
        withArrow
      >
        <ActionIcon
          variant="subtle"
          color="gray"
          radius="md"
          onClick={() => onMode(mode === 'compact' ? 'expanded' : mode === 'expanded' ? 'fullscreen' : 'compact')}
        >
          {mode === 'compact' ? <IconArrowsMaximize size={15} /> : <IconArrowsMinimize size={15} />}
        </ActionIcon>
      </Tooltip>
      <Tooltip label={isArabic ? 'إغلاق' : 'Close'} withArrow>
        <ActionIcon variant="subtle" color="gray" radius="md" onClick={onClose}>
          <IconChevronDown size={17} />
        </ActionIcon>
      </Tooltip>
    </div>
  </div>
);
