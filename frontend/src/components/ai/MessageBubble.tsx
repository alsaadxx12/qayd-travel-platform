import React from 'react';
import {
  IconCopy,
  IconCheck,
  IconThumbUp,
  IconThumbDown,
  IconRefresh,
} from '@tabler/icons-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { UiBlocks } from './blocks/UiBlocks';
import { DataTableBlock } from './blocks/DataTableBlock';
import { ToolTrace, SkeletonBlock } from './blocks/ToolTrace';
import { extractMarkdownTables, looksNumeric } from './extractMarkdownTables';

export interface CopilotChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  imageBase64?: string;
  uiBlocks?: any[];
  suggestions?: string[];
  tools?: Array<{ name: string; label: string; status: 'running' | 'ok' | 'error' }>;
  loading?: boolean;
  feedback?: 'up' | 'down' | null;
}

interface Props {
  message: CopilotChatMessage;
  isArabic: boolean;
  copied: boolean;
  onCopy: () => void;
  onPrompt?: (text: string) => void;
  onRegenerate?: () => void;
  onFeedback?: (value: 'up' | 'down') => void;
}

const markdownComponents = {
  table: ({ children }: any) => (
    <div className="my-2 overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full border-collapse text-[12px]">{children}</table>
    </div>
  ),
  thead: ({ children }: any) => <thead className="bg-slate-50">{children}</thead>,
  tbody: ({ children }: any) => <tbody>{children}</tbody>,
  tr: ({ children }: any) => <tr className="even:bg-slate-50/70">{children}</tr>,
  th: ({ children }: any) => (
    <th className="px-3 py-2 text-right font-bold text-slate-500 border-b border-slate-200 whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children }: any) => {
    const text = React.Children.toArray(children).map(String).join('');
    const numeric = looksNumeric(text);
    return (
      <td
        dir={numeric ? 'ltr' : undefined}
        className={`px-3 py-2 border-b border-slate-100 align-top ${
          numeric ? 'font-mono tabular-nums whitespace-nowrap text-left text-slate-900' : 'leading-6 text-slate-700'
        }`}
      >
        {children}
      </td>
    );
  },
  p: ({ children }: any) => <p className="my-1.5 leading-7 text-[13px] text-slate-800">{children}</p>,
  ul: ({ children }: any) => <ul className="my-1.5 list-disc space-y-1 pr-4 text-[13px]">{children}</ul>,
  ol: ({ children }: any) => <ol className="my-1.5 list-decimal space-y-1 pr-4 text-[13px]">{children}</ol>,
  li: ({ children }: any) => <li className="leading-7">{children}</li>,
  strong: ({ children }: any) => <strong className="font-bold text-slate-900">{children}</strong>,
  h1: ({ children }: any) => <h3 className="text-[14px] font-bold text-slate-900 mt-2 mb-1">{children}</h3>,
  h2: ({ children }: any) => <h3 className="text-[14px] font-bold text-slate-900 mt-2 mb-1">{children}</h3>,
  h3: ({ children }: any) => <h3 className="text-[13px] font-bold text-slate-800 mt-2 mb-1">{children}</h3>,
  code: ({ children }: any) => (
    <code className="font-mono text-[12px] bg-white/80 px-1 py-0.5 rounded border border-slate-200">{children}</code>
  ),
};

function stripModelScratch(text: string): string {
  let t = text || '';
  t = t.replace(/<think>[\s\S]*?<\/think>/gi, '');
  t = t.replace(/<think>[\s\S]*$/gi, '');
  t = t.replace(/<\/think>/gi, '');
  if (
    /I need to check the available tools|Self-Correction|call:\s*`?get[A-Z]|Wait, let me double-check|"tool"\s*:/i.test(
      t,
    )
  ) {
    return '';
  }
  return t.trim();
}

export const MessageBubble: React.FC<Props> = ({
  message,
  isArabic,
  copied,
  onCopy,
  onPrompt,
  onRegenerate,
  onFeedback,
}) => {
  const isUser = message.role === 'user';
  const parsed = !isUser ? extractMarkdownTables(stripModelScratch(message.content || '')) : null;
  const hasBlocks = Boolean(message.uiBlocks?.length || parsed?.tables.length);
  const displayContent = (message.content || '').replace(/\n?\[\[entity:[^\]]+\]\]/g, '').trim();
  const text = isUser ? displayContent : parsed?.text || '';

  return (
    <div className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}>
      <div className={isUser ? 'max-w-[85%]' : 'w-full max-w-full'}>
        {message.imageBase64?.startsWith('data:image/') && (
          <img src={message.imageBase64} alt="" className="rounded-lg mb-1.5 max-h-36 object-cover" />
        )}

        {message.loading && !message.content && !hasBlocks && (
          <div className="bg-slate-100 rounded-2xl rounded-bl-md px-3 py-2">
            <SkeletonBlock />
          </div>
        )}

        {message.tools?.length ? (
          <div className="mb-1.5">
            <ToolTrace tools={message.tools} />
          </div>
        ) : null}

        {isUser ? (
          <div className="rounded-2xl rounded-br-md px-3 py-2 text-[13px] leading-relaxed bg-[#F45A0A] text-white whitespace-pre-wrap">
            {displayContent}
          </div>
        ) : (
          <div className="space-y-2">
            {text ? (
              <div className="rounded-2xl rounded-bl-md px-3.5 py-2.5 bg-slate-100 text-slate-800">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {text}
                </ReactMarkdown>
              </div>
            ) : null}

            {parsed?.tables.length && !message.uiBlocks?.length
              ? parsed.tables.map((table, i) => (
                  <DataTableBlock
                    key={`md-${i}`}
                    payload={{
                      title: i === 0 ? 'التفاصيل' : undefined,
                      columns: table.columns,
                      rows: table.rows,
                    }}
                  />
                ))
              : null}

            <UiBlocks blocks={message.uiBlocks} onPrompt={onPrompt} />
          </div>
        )}

        {!isUser && !message.loading && (message.content || hasBlocks) && (
          <div className="flex items-center gap-1 mt-1 text-slate-400">
            <button type="button" onClick={onCopy} className="p-1 hover:text-[#F45A0A]" title="نسخ">
              {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
            </button>
            {onRegenerate && (
              <button type="button" onClick={onRegenerate} className="p-1 hover:text-[#F45A0A]" title="إعادة التوليد">
                <IconRefresh size={13} />
              </button>
            )}
            {onFeedback && (
              <>
                <button
                  type="button"
                  onClick={() => onFeedback('up')}
                  className={`p-1 ${message.feedback === 'up' ? 'text-emerald-600' : 'hover:text-emerald-600'}`}
                >
                  <IconThumbUp size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onFeedback('down')}
                  className={`p-1 ${message.feedback === 'down' ? 'text-red-500' : 'hover:text-red-500'}`}
                >
                  <IconThumbDown size={13} />
                </button>
              </>
            )}
            <span className="text-[10px] ms-1">{isArabic ? 'المستشار الذكي' : 'Copilot'}</span>
          </div>
        )}
        {!isUser && message.suggestions?.length ? (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {message.suggestions.slice(0, 4).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onPrompt?.(s)}
                className="text-[10px] px-2 py-1 rounded-full bg-white border border-slate-200 text-slate-600 hover:border-[#F45A0A] hover:text-[#F45A0A]"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};
