import React, { useEffect, useRef } from 'react';
import { CopilotChatMessage, MessageBubble } from './MessageBubble';
import { QuickPrompts } from './QuickPrompts';

interface Props {
  messages: CopilotChatMessage[];
  isArabic: boolean;
  copiedIndex: number | null;
  onCopy: (index: number, text: string) => void;
  onPrompt: (text: string) => void;
  onRegenerate: () => void;
  onFeedback: (index: number, value: 'up' | 'down') => void;
  prompts?: Array<{ text: string }>;
  status?: string | null;
}

export const MessageList: React.FC<Props> = ({
  messages,
  isArabic,
  copiedIndex,
  onCopy,
  onPrompt,
  onRegenerate,
  onFeedback,
  prompts,
  status,
}) => {
  const endRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (stickRef.current) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  return (
    <div
      ref={boxRef}
      className="copilot-scroll copilot-canvas flex-1 overflow-y-auto flex flex-col px-3 py-3.5 space-y-3.5"
      onScroll={() => {
        const el = boxRef.current;
        if (!el) return;
        const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
        stickRef.current = dist < 80;
      }}
    >
      {messages.length <= 1 && prompts?.length ? <QuickPrompts prompts={prompts} onPick={onPrompt} /> : null}
      {/* Suggestions stay pinned at the top; the spacer below pushes the conversation
          itself down against the composer so a short chat has no empty gap. */}
      <div className="flex-1 min-h-0" aria-hidden="true" />
      {messages.map((m, i) => (
        <MessageBubble
          key={m.id || i}
          message={m}
          isArabic={isArabic}
          copied={copiedIndex === i}
          onCopy={() => onCopy(i, m.content)}
          onPrompt={onPrompt}
          onRegenerate={i === messages.length - 1 && m.role === 'assistant' ? onRegenerate : undefined}
          onFeedback={m.id ? (v) => onFeedback(i, v) : undefined}
        />
      ))}
      {status && messages[messages.length - 1]?.content && (
        <div className="flex items-center gap-1.5 px-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F45A0A] animate-pulse" />
          <span className="text-[11px] text-slate-400">{status}</span>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
};
