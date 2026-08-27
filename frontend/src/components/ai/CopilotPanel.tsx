import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CopilotHeader } from './CopilotHeader';
import { MessageList } from './MessageList';
import { Composer, compressImage } from './Composer';
import { ConversationHistory } from './ConversationHistory';
import { CopilotChatMessage } from './MessageBubble';
import { aiAssistantApi, ChatMessage } from '../../api/aiAssistant';
import { streamCopilotChat } from '../../api/aiStream';
import { useLanguageStore } from '../../store/useLanguageStore';
import { useAiContextStore } from '../../store/useAiContextStore';
import { useAdoptedExchangeRate } from '../../hooks/useAdoptedExchangeRate';
import { showErrorNotification } from '../../utils/notifications';
import { instantChatReply } from './instantChatReply';

export type CopilotMode = 'compact' | 'expanded' | 'fullscreen';

const MODE_KEY = 'qayd_ai_copilot_mode';
const LEGACY_KEY = 'qayd_ai_chat_sessions_v2';
const MIGRATED_KEY = 'qayd_ai_sessions_migrated_v1';

interface Props {
  opened: boolean;
  onClose: () => void;
}

/** A tool that never reported back must not keep spinning in the trace. */
function settleRunningTools(msg: CopilotChatMessage): CopilotChatMessage {
  if (!msg.tools?.length) return msg;
  return {
    ...msg,
    tools: msg.tools.map((t) => (t.status === 'running' ? { ...t, status: 'error' as const } : t)),
  };
}

export const CopilotPanel: React.FC<Props> = ({ opened, onClose }) => {
  const { language } = useLanguageStore();
  const isArabic = language === 'ar';
  const location = useLocation();
  const page = useAiContextStore((s) => s.page);
  const { adoptedRate } = useAdoptedExchangeRate();

  const [mode, setMode] = useState<CopilotMode>(() => (localStorage.getItem(MODE_KEY) as CopilotMode) || 'compact');
  const [showHistory, setShowHistory] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<CopilotChatMessage[]>([
    {
      role: 'assistant',
      content: isArabic
        ? 'أهلاً بك. اسأل عن الأرصدة والتذاكر، أو أي سؤال عام، أو اطلب تصميم صورة، أو الصق صورة مباشرة في المحادثة.'
        : 'Ask about balances and tickets, any general question, image design, or paste an image into the chat.',
    },
  ]);
  const [input, setInput] = useState('');
  const [attached, setAttached] = useState<{ name: string; data: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { data: brief } = useQuery({
    queryKey: ['ai-financial-brief'],
    queryFn: aiAssistantApi.getFinancialBrief,
    staleTime: 15_000,
    enabled: opened,
  });
  const { data: prompts } = useQuery({
    queryKey: ['ai-quick-prompts'],
    queryFn: aiAssistantApi.getQuickPrompts,
    staleTime: 60_000,
    enabled: opened,
  });
  const { data: conversations, refetch: refetchConversations } = useQuery({
    queryKey: ['ai-conversations'],
    queryFn: aiAssistantApi.listConversations,
    enabled: opened && showHistory,
  });

  useEffect(() => {
    localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    if (!opened) return;
    const migrate = async () => {
      if (localStorage.getItem(MIGRATED_KEY)) return;
      try {
        const raw = localStorage.getItem(LEGACY_KEY);
        if (!raw) {
          localStorage.setItem(MIGRATED_KEY, '1');
          return;
        }
        const sessions = JSON.parse(raw) as Array<{ title?: string; messages?: ChatMessage[] }>;
        for (const s of sessions.slice(0, 20)) {
          const msgs = (s.messages || []).filter((m) => m.role === 'user' || m.role === 'assistant');
          if (msgs.length <= 1) continue;
          await aiAssistantApi.importConversation({ title: s.title, messages: msgs });
        }
        localStorage.setItem(MIGRATED_KEY, '1');
      } catch {
        localStorage.setItem(MIGRATED_KEY, '1');
      }
    };
    migrate();
  }, [opened]);

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setStatus(null);
  };

  const startNew = () => {
    stop();
    setConversationId(undefined);
    setShowHistory(false);
    setMessages([
      {
        role: 'assistant',
        content: isArabic
          ? 'محادثة جديدة. كيف يمكنني مساعدتك؟'
          : 'New conversation. How can I help?',
      },
    ]);
  };

  const sendText = useCallback(
    async (text: string, imageBase64?: string) => {
      const trimmed = text.trim();
      if (!trimmed && !imageBase64) return;
      if (loading) return;

      const instant = !imageBase64 ? instantChatReply(trimmed, isArabic ? 'ar' : 'en') : null;
      const userMsg: CopilotChatMessage = {
        role: 'user',
        content: trimmed || (isArabic ? 'انظر إلى هذه الصورة' : 'Look at this image'),
        imageBase64,
      };
      const history = [...messages, userMsg];
      setMessages([...history, { role: 'assistant', content: instant || '', loading: !instant, tools: [] }]);
      setInput('');
      setAttached(null);
      setLoading(!instant);
      setStatus(instant ? null : isArabic ? 'جارٍ الفهم...' : 'Thinking...');
      setShowHistory(false);

      const payloadMessages: ChatMessage[] = history
        .filter((m) => m.role === 'user' || (m.role === 'assistant' && m.content))
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content, imageBase64: m.imageBase64 }));

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await streamCopilotChat(
          {
            messages: payloadMessages,
            currentPage: page?.route || location.pathname,
            conversationId,
            page: page || { route: location.pathname },
            locale: isArabic ? 'ar' : 'en',
          },
          {
            signal: controller.signal,
            onEvent: (event) => {
              if (event.type === 'status' && !instant) setStatus(event.message);
              if (event.type === 'delta') {
                setMessages((prev) => {
                  const next = [...prev];
                  const last = { ...next[next.length - 1] };
                  if (instant) {
                    last.content = event.text;
                    last.loading = false;
                  } else {
                    last.content = (last.content || '') + event.text;
                    last.loading = true;
                  }
                  next[next.length - 1] = last;
                  return next;
                });
              }
              if (event.type === 'tool_start') {
                setMessages((prev) => {
                  const next = [...prev];
                  const last = { ...next[next.length - 1] };
                  last.tools = [...(last.tools || []), { name: event.name, label: event.label, status: 'running' }];
                  next[next.length - 1] = last;
                  return next;
                });
              }
              if (event.type === 'tool_end') {
                setMessages((prev) => {
                  const next = [...prev];
                  const last = { ...next[next.length - 1] };
                  last.tools = (last.tools || []).map((t) =>
                    t.name === event.name && t.status === 'running'
                      ? { ...t, status: event.ok ? 'ok' : 'error' }
                      : t,
                  );
                  next[next.length - 1] = last;
                  return next;
                });
              }
              if (event.type === 'ui') {
                setMessages((prev) => {
                  const next = [...prev];
                  const last = { ...next[next.length - 1] };
                  last.uiBlocks = [...(last.uiBlocks || []), ...event.blocks];
                  next[next.length - 1] = last;
                  return next;
                });
              }
              if (event.type === 'suggestions') {
                setMessages((prev) => {
                  const next = [...prev];
                  const last = { ...next[next.length - 1] };
                  last.suggestions = event.items;
                  next[next.length - 1] = last;
                  return next;
                });
              }
              if (event.type === 'done') {
                setConversationId(event.conversationId);
                setMessages((prev) => {
                  const next = [...prev];
                  const last = settleRunningTools({ ...next[next.length - 1] });
                  last.loading = false;
                  last.id = event.messageId;
                  next[next.length - 1] = last;
                  return next;
                });
              }
              if (event.type === 'error') {
                setMessages((prev) => {
                  const next = [...prev];
                  const last = settleRunningTools({ ...next[next.length - 1] });
                  last.loading = false;
                  last.content = last.content || event.message;
                  next[next.length - 1] = last;
                  return next;
                });
              }
            },
          },
        );
      } catch (err: any) {
        const aborted = err?.name === 'AbortError';
        const msg = aborted
          ? isArabic
            ? 'تم إيقاف الطلب.'
            : 'Request stopped.'
          : err?.message || 'تعذر الحصول على إجابة.';
        if (!aborted) showErrorNotification('أينشتاين العراق', msg);
        setMessages((prev) => {
          const next = [...prev];
          // Always settle the bubble: an interrupted request must never leave a
          // permanent skeleton or a running tool spinner behind.
          const last = settleRunningTools({ ...next[next.length - 1] });
          last.loading = false;
          last.content = last.content || msg;
          next[next.length - 1] = last;
          return next;
        });
      } finally {
        setLoading(false);
        setStatus(null);
        abortRef.current = null;
      }
    },
    [messages, loading, conversationId, page, location.pathname, isArabic],
  );

  const onAttach = async (file: File) => {
    if (file.type.startsWith('image/')) {
      const data = await compressImage(file);
      setAttached({ name: file.name, data });
    } else {
      const data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.readAsDataURL(file);
      });
      setAttached({ name: file.name, data });
    }
  };

  const openConversation = async (id: string) => {
    const conv = await aiAssistantApi.getConversation(id);
    setConversationId(conv.id);
    setMessages(
      (conv.messages || []).map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        uiBlocks: m.uiBlocks || undefined,
        feedback: m.feedback,
      })),
    );
    setShowHistory(false);
  };

  const panelClass =
    mode === 'fullscreen'
      ? 'fixed inset-3 z-[80] w-auto h-auto'
      : `fixed z-[80] bottom-6 ${isArabic ? 'left-6' : 'right-6'} ${
          mode === 'expanded' ? 'w-[min(760px,96vw)] h-[min(820px,88vh)]' : 'w-[min(440px,94vw)] h-[min(640px,80vh)]'
        }`;

  if (!opened) return null;

  return (
    <div
      className={`${panelClass} bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden`}
      dir={isArabic ? 'rtl' : 'ltr'}
      onPaste={(e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.indexOf('image') !== -1) {
            const file = item.getAsFile();
            if (file) {
              e.preventDefault();
              onAttach(file);
              break;
            }
          }
        }
      }}
    >
      <CopilotHeader
        isArabic={isArabic}
        rate={brief?.adoptedRate || adoptedRate}
        mode={mode}
        onMode={setMode}
        onNew={startNew}
        onHistory={() => {
          setShowHistory((v) => !v);
          refetchConversations();
        }}
        onClose={onClose}
        connected
      />
      {showHistory ? (
        <ConversationHistory
          items={conversations || []}
          onOpen={openConversation}
          onDelete={async (id) => {
            await aiAssistantApi.deleteConversation(id);
            refetchConversations();
          }}
          isArabic={isArabic}
        />
      ) : (
        <MessageList
          messages={messages}
          isArabic={isArabic}
          copiedIndex={copiedIndex}
          onCopy={(i, text) => {
            navigator.clipboard.writeText(text);
            setCopiedIndex(i);
            setTimeout(() => setCopiedIndex(null), 1500);
          }}
          onPrompt={(t) => sendText(t)}
          onRegenerate={() => {
            const lastUser = [...messages].reverse().find((m) => m.role === 'user');
            if (lastUser) sendText(lastUser.content, lastUser.imageBase64);
          }}
          onFeedback={async (i, value) => {
            const msg = messages[i];
            if (!msg?.id) return;
            await aiAssistantApi.sendFeedback(msg.id, value);
            setMessages((prev) => prev.map((m, idx) => (idx === i ? { ...m, feedback: value } : m)));
          }}
          prompts={prompts}
          status={status}
        />
      )}
      {!showHistory && (
        <Composer
          value={input}
          onChange={setInput}
          onSend={() => sendText(input, attached?.data)}
          onStop={stop}
          loading={loading}
          isArabic={isArabic}
          attachedName={attached?.name}
          attachedPreview={attached?.data}
          onAttach={onAttach}
          onClearAttach={() => setAttached(null)}
        />
      )}
    </div>
  );
};
