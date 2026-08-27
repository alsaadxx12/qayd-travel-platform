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
import { SkeletonBlock } from './blocks/ToolTrace';
import { AI_NAME_AR, AI_NAME_EN } from './persona';
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
  a: ({ href, children }: any) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#C2410C] font-semibold underline decoration-orange-200 underline-offset-2 hover:decoration-[#F45A0A] break-all"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }: any) => (
    <blockquote className="my-2 ps-3 border-s-[3px] border-orange-200 bg-[#FFF7F0] rounded-e-lg py-1.5 pe-2 text-slate-700">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-slate-200" />,
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
    <div className={`copilot-msg-in flex ${isUser ? 'justify-start' : 'justify-end'}`}>
      <div className={isUser ? 'max-w-[85%]' : 'w-full max-w-full'}>
        {message.imageBase64?.startsWith('data:image/') && (
          <img src={message.imageBase64} alt="" className="rounded-lg mb-1.5 max-h-36 object-cover" />
        )}

        {message.loading && !message.content && !hasBlocks && (
          <div className="inline-flex bg-white border border-slate-200 rounded-2xl rounded-bl-md px-3 py-2 shadow-sm">
            <SkeletonBlock isArabic={isArabic} />
          </div>
        )}

        {isUser ? (
          <div className="rounded-2xl rounded-br-md px-3.5 py-2.5 text-[13px] leading-relaxed bg-gradient-to-br from-[#F45A0A] to-[#DD4F05] text-white whitespace-pre-wrap shadow-sm shadow-orange-500/20">
            {displayContent}
          </div>
        ) : (
          <div className="space-y-2">
            {text ? (
              <div className="rounded-2xl rounded-bl-md px-3.5 py-2.5 bg-white border border-slate-200/90 text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
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
          <div className="flex items-center gap-0.5 mt-1.5 text-slate-300">
            <button type="button" onClick={onCopy} className="p-1 rounded-md hover:text-[#F45A0A] hover:bg-orange-50 transition-colors" title="نسخ">
              {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
            </button>
            {onRegenerate && (
              <button type="button" onClick={onRegenerate} className="p-1 rounded-md hover:text-[#F45A0A] hover:bg-orange-50 transition-colors" title="إعادة التوليد">
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
            <span className="text-[10px] ms-1.5 text-slate-400">{isArabic ? AI_NAME_AR : AI_NAME_EN}</span>
          </div>
        )}
        {!isUser && message.suggestions?.length ? (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {message.suggestions.slice(0, 4).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onPrompt?.(s)}
                className="h-[28px] px-3 rounded-xl bg-white border border-slate-200 text-[11px] font-semibold text-slate-600 hover:border-[#F45A0A] hover:text-[#C2410C] hover:bg-[#FFF7F0] transition-colors"
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
