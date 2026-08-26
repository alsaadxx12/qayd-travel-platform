import React from 'react';
import { ActionIcon, Badge, Tooltip } from '@mantine/core';
import {
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconChevronDown,
  IconHistory,
  IconPlus,
  IconRobot,
} from '@tabler/icons-react';
import type { CopilotMode } from './CopilotPanel';

interface Props {
  isArabic: boolean;
  rate?: number;
  mode: CopilotMode;
  onMode: (mode: CopilotMode) => void;
  onNew: () => void;
  onHistory: () => void;
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
  onClose,
  connected,
}) => (
  <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-white">
    <div className="w-8 h-8 rounded-full bg-[#F45A0A] text-white flex items-center justify-center">
      <IconRobot size={16} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="text-[13px] font-bold text-slate-800">{isArabic ? 'المستشار الذكي' : 'Copilot'}</span>
        <Badge size="xs" color="orange" variant="light">AI</Badge>
      </div>
      <div className="flex items-center gap-1 text-[10px] text-slate-500">
        <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
        {connected ? (isArabic ? 'متصل' : 'Online') : isArabic ? 'غير متصل' : 'Offline'}
      </div>
    </div>
    {rate ? (
      <Badge size="sm" color="orange" variant="light" className="font-mono">
        1$ = {Number(rate).toLocaleString('en-US')}
      </Badge>
    ) : null}
    <Tooltip label={isArabic ? 'السجل' : 'History'}>
      <ActionIcon variant="subtle" color="gray" onClick={onHistory}>
        <IconHistory size={16} />
      </ActionIcon>
    </Tooltip>
    <Tooltip label={isArabic ? 'محادثة جديدة' : 'New'}>
      <ActionIcon variant="light" color="orange" onClick={onNew}>
        <IconPlus size={16} />
      </ActionIcon>
    </Tooltip>
    <Tooltip label={mode === 'fullscreen' ? (isArabic ? 'تصغير' : 'Exit full') : isArabic ? 'ملء الشاشة' : 'Full screen'}>
      <ActionIcon
        variant="subtle"
        color="gray"
        onClick={() =>
          onMode(mode === 'compact' ? 'expanded' : mode === 'expanded' ? 'fullscreen' : 'compact')
        }
      >
        {mode === 'compact' ? <IconArrowsMaximize size={15} /> : <IconArrowsMinimize size={15} />}
      </ActionIcon>
    </Tooltip>
    <ActionIcon variant="subtle" color="gray" onClick={onClose}>
      <IconChevronDown size={16} />
    </ActionIcon>
  </div>
);
