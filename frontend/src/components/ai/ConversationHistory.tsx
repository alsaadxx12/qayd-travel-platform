import React from 'react';
import { IconMessageCircle, IconTrash } from '@tabler/icons-react';
import type { AiConversationSummary } from '../../api/aiAssistant';

export const ConversationHistory: React.FC<{
  items: AiConversationSummary[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  isArabic: boolean;
}> = ({ items, onOpen, onDelete, isArabic }) => (
  <div className="flex-1 overflow-y-auto p-2 space-y-1">
    {!items.length && (
      <div className="text-center text-[12px] text-slate-400 py-8">
        {isArabic ? 'لا توجد محادثات محفوظة بعد' : 'No saved conversations'}
      </div>
    )}
    {items.map((c) => (
      <div
        key={c.id}
        className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-slate-50 group"
      >
        <button type="button" onClick={() => onOpen(c.id)} className="flex-1 text-right min-w-0">
          <div className="flex items-center gap-1.5">
            <IconMessageCircle size={14} className="text-[#F45A0A] shrink-0" />
            <span className="text-[12px] font-semibold text-slate-800 truncate">{c.title}</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {new Date(c.lastMessageAt).toLocaleString(isArabic ? 'ar-IQ' : 'en-GB')}
          </div>
        </button>
        <button
          type="button"
          onClick={() => onDelete(c.id)}
          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500"
        >
          <IconTrash size={14} />
        </button>
      </div>
    ))}
  </div>
);
