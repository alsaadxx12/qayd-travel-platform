import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ActionIcon,
  Tooltip,
  Badge,
  Loader,
} from '@mantine/core';
import {
  IconRobot,
  IconPlus,
  IconSend,
  IconPaperclip,
  IconX,
  IconChevronDown,
  IconCheck,
  IconCopy,
  IconFileText,
  IconHistory,
  IconTrash,
  IconArrowLeft,
  IconArrowRight,
  IconMessageCircle,
} from '@tabler/icons-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useQuery } from '@tanstack/react-query';
import { aiAssistantApi, ChatMessage, FinancialContext } from '../../api/aiAssistant';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { useAdoptedExchangeRate } from '../../hooks/useAdoptedExchangeRate';
import { useLanguageStore } from '../../store/useLanguageStore';

interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  messages: ChatMessage[];
}

const STORAGE_SESSIONS_KEY = 'qayd_ai_chat_sessions_v2';

// Helper to downscale large screenshots/images for fast Groq Vision processing
const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 1024;
        let width = img.width;
        let height = img.height;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

const getWelcomeMessage = (isArabic: boolean): ChatMessage => ({
  role: 'assistant',
  content: isArabic
    ? `أهلاً بك! 👋 أنا مستشارك المالي والمحاسبي في **QAYD Travel Accounting**.\n\nكيف يمكنني مساعدتك اليوم في القيود المحاسبية، أسعار الصرف، باقات النظام، أو تحليل الملفات والتذاكر المرفقة؟`
    : `Hello! 👋 I am your financial & accounting AI assistant in **QAYD Travel Accounting**.\n\nHow can I help you today with journal entries, exchange rates, system pricing, or analyzing uploaded files and tickets?`,
});

export const AIAssistantFloatingButton: React.FC = () => {
  const { direction, language } = useLanguageStore();
  const isAr = language === 'ar';
  const [opened, setOpened] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => Date.now().toString());

  const [inputText, setInputText] = useState('');
  const [attachedFileBase64, setAttachedFileBase64] = useState<string | null>(null);
  const [attachedFileName, setAttachedFileName] = useState<string>('');
  const [attachedFileText, setAttachedFileText] = useState<string | null>(null);
  const [isFileTypeImage, setIsFileTypeImage] = useState<boolean>(true);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Chat sessions list
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SESSIONS_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const adoptedEx = useAdoptedExchangeRate();

  // Fetch live financial brief
  const { data: finBrief } = useQuery<FinancialContext>({
    queryKey: ['ai-financial-brief'],
    queryFn: aiAssistantApi.getFinancialBrief,
    staleTime: 15000,
  });

  const liveAdoptedRate = adoptedEx.adoptedRate || finBrief?.adoptedRate || 1552.5;

  // Auto scroll to bottom
  useEffect(() => {
    if (!showHistory) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, opened, showHistory]);

  // Initial welcome message handling & dynamic language response
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([getWelcomeMessage(isAr)]);
    } else if (messages.length === 1 && messages[0].role === 'assistant') {
      // If it's just the initial welcome message, refresh it with active language
      setMessages([getWelcomeMessage(isAr)]);
    }
  }, [isAr]);

  // Save sessions to localStorage
  const saveCurrentSession = useCallback((updatedMsgs: ChatMessage[]) => {
    if (updatedMsgs.length <= 1) return;

    // Find first user question for session title
    const firstUserMsg = updatedMsgs.find((m) => m.role === 'user');
    const rawTitle = firstUserMsg ? firstUserMsg.content.slice(0, 42).replace(/[\n\r]/g, ' ') : (isAr ? 'محادثة عامة' : 'General Chat');
    const title = rawTitle.length > 40 ? rawTitle + '...' : rawTitle;

    setSessions((prevSessions) => {
      const existingIdx = prevSessions.findIndex((s) => s.id === currentSessionId);
      let newSessions: ChatSession[];
      if (existingIdx >= 0) {
        newSessions = [...prevSessions];
        newSessions[existingIdx] = {
          ...newSessions[existingIdx],
          title: newSessions[existingIdx].title || title,
          messages: updatedMsgs,
        };
      } else {
        newSessions = [
          {
            id: currentSessionId,
            title,
            createdAt: new Date().toISOString(),
            messages: updatedMsgs,
          },
          ...prevSessions,
        ];
      }
      try {
        localStorage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify(newSessions));
      } catch {}
      return newSessions;
    });
  }, [currentSessionId, isAr]);

  // Handle Send with guaranteed synchronous loading state
  const handleSend = async () => {
    const text = inputText.trim();
    if ((!text && !attachedFileBase64 && !attachedFileText) || isLoading) return;

    let finalContent = text;
    if (attachedFileText) {
      finalContent = `${text ? text + '\n\n' : ''}📄 [${isAr ? 'محتوى الملف المرفق' : 'Attached file content'}: ${attachedFileName}]:\n\`\`\`\n${attachedFileText}\n\`\`\``;
    } else if (!finalContent && attachedFileBase64) {
      finalContent = isAr
        ? 'يرجى قراءة وتحليل هذا المستند/الصورة المرفقة واستخراج جميع البيانات المحاسبية وأسماء المسافرين وأرقام الجوازات بدقة.'
        : 'Please analyze this attached document/image and extract all financial details, passenger names, and passport/ticket numbers accurately.';
    }

    const userMsg: ChatMessage = {
      role: 'user',
      content: finalContent,
      imageBase64: attachedFileBase64 || undefined,
    };

    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInputText('');
    setAttachedFileBase64(null);
    setAttachedFileName('');
    setAttachedFileText(null);
    setIsLoading(true);

    try {
      const data = await aiAssistantApi.sendMessage(newMsgs, window.location.pathname);
      const withReply: ChatMessage[] = [
        ...newMsgs,
        { role: 'assistant', content: data.reply },
      ];
      setMessages(withReply);
      saveCurrentSession(withReply);
    } catch (err: any) {
      showErrorNotification(isAr ? 'خطأ في الاتصال بالذكاء' : 'AI Connection Error', err?.message || (isAr ? 'تعذر معالجة الطلب' : 'Failed to process request'));
      const withError: ChatMessage[] = [
        ...newMsgs,
        {
          role: 'assistant',
          content: isAr
            ? '⚠️ عذراً، حدث خطأ أثناء معالجة الطلب. يرجى المحاولة مرة أخرى.'
            : '⚠️ Sorry, an error occurred while processing the request. Please try again.',
        },
      ];
      setMessages(withError);
      saveCurrentSession(withError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  // Process uploaded file (Image, PDF, Text, CSV, JSON)
  const processUploadedFile = async (file: File, customLabel?: string) => {
    if (file.size > 15 * 1024 * 1024) {
      showErrorNotification(isAr ? 'حجم الملف كبير' : 'File too large', isAr ? 'الحد الأقصى هو 15 ميغابايت' : 'Maximum size is 15 MB');
      return;
    }

    const isImage = file.type.startsWith('image/');
    const isText = file.type.startsWith('text/') || /\.(txt|csv|json|sql|log|xml)$/i.test(file.name);
    setIsFileTypeImage(isImage);
    setAttachedFileName(customLabel || file.name);

    if (isImage) {
      const optimizedBase64 = await compressImage(file);
      setAttachedFileBase64(optimizedBase64);
      setAttachedFileText(null);
      showSuccessNotification(isAr ? 'تم إرفاق الصورة' : 'Image Attached', isAr ? 'جاهز للتحليل البصري الفوري.' : 'Ready for visual analysis.');
    } else if (isText) {
      const textReader = new FileReader();
      textReader.onload = () => {
        setAttachedFileText(textReader.result as string);
        setAttachedFileBase64(null);
        showSuccessNotification(isAr ? 'تم إرفاق الملف النصي' : 'Text File Attached', isAr ? 'جاهز للتحليل الفوري.' : 'Ready for analysis.');
      };
      textReader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachedFileBase64(reader.result as string);
        setAttachedFileText(null);
        showSuccessNotification(isAr ? 'تم إرفاق المستند' : 'Document Attached', isAr ? 'اكتب سؤالك أو اضغط إرسال للتحليل الفوري.' : 'Type your query or click send for analysis.');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processUploadedFile(file);
  };

  // Support Ctrl+V paste
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          processUploadedFile(file, isAr ? `صورة ملصوقة ${new Date().toLocaleTimeString('ar-IQ')}` : `Pasted Image ${new Date().toLocaleTimeString('en-US')}`);
          break;
        }
      }
    }
  }, [isAr]);

  const handleCopyText = (content: string, idx: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleStartNewChat = () => {
    setCurrentSessionId(Date.now().toString());
    setMessages([getWelcomeMessage(isAr)]);
    setInputText('');
    setAttachedFileBase64(null);
    setAttachedFileName('');
    setAttachedFileText(null);
    setIsLoading(false);
    setShowHistory(false);
    showSuccessNotification(isAr ? 'محادثة جديدة' : 'New Chat', isAr ? 'تم بدء محادثة جديدة وتصفير الشاشة.' : 'Started a new chat session.');
  };

  const handleSelectSession = (session: ChatSession) => {
    setCurrentSessionId(session.id);
    setMessages(session.messages && session.messages.length > 0 ? session.messages : [getWelcomeMessage(isAr)]);
    setShowHistory(false);
  };

  const handleDeleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== sessionId);
      try {
        localStorage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify(filtered));
      } catch {}
      return filtered;
    });
    if (currentSessionId === sessionId) {
      handleStartNewChat();
    }
  };

  return (
    <>
      {/* ── 1. CIRCULAR FLOATING AI BUTTON (Dynamic RTL / LTR Edge Placement) ── */}
      <div className={`fixed ${direction === 'rtl' ? 'left-6' : 'right-6'} bottom-6 z-40`}>
        <Tooltip
          label={isAr ? 'المستشار الذكي' : 'AI Assistant'}
          position={direction === 'rtl' ? 'right' : 'left'}
          withArrow
        >
          <button
            type="button"
            onClick={() => setOpened((prev) => !prev)}
            className="relative w-12 h-12 rounded-full flex items-center justify-center bg-[#F45A0A] hover:bg-[#DD4F05] text-white shadow-[0_8px_22px_rgba(244,90,10,0.38)] hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer border-2 border-white select-none group"
            aria-label={isAr ? 'المستشار الذكي' : 'AI Assistant'}
          >
            <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-300 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white"></span>
            </span>

            {/* New Modern AI Robot Icon */}
            <IconRobot size={24} className="text-white group-hover:scale-110 transition-transform drop-shadow-sm" stroke={1.9} />
          </button>
        </Tooltip>
      </div>

      {/* ── 2. BACKDROP OVERLAY ── */}
      {opened && (
        <div
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-[1.5px] z-50 transition-opacity"
          onClick={() => setOpened(false)}
        />
      )}

      {/* ── 3. CHAT PANEL (Clean, Pure White, Rounded-3xl, Minimalist) ── */}
      <div
        className={`fixed ${direction === 'rtl' ? 'left-6' : 'right-6'} bottom-20 z-50 w-[440px] max-w-[95vw] h-[620px] max-h-[88vh] bg-white rounded-3xl border border-slate-200/90 shadow-2xl transition-all duration-250 ease-out flex flex-col overflow-hidden ${
          opened
            ? 'opacity-100 scale-100 pointer-events-auto translate-y-0'
            : 'opacity-0 scale-95 pointer-events-none translate-y-6'
        }`}
        style={{
          fontFamily: isAr ? "'Cairo', 'IBM Plex Sans Arabic', 'Tajawal', sans-serif" : "'Plus Jakarta Sans', 'Inter', sans-serif",
        }}
        onPaste={handlePaste}
        dir={direction}
      >
        {/* ── Minimalist Clean Header (Reduced Texts) ── */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-white border-b border-slate-100 text-slate-900 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#F45A0A] text-white flex items-center justify-center font-black shadow-xs shrink-0">
              <IconRobot size={18} stroke={2} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-black text-xs text-slate-900 leading-tight">
                  {isAr ? 'المستشار الذكي' : 'AI Assistant'}
                </h3>
                <Badge size="xs" color="orange" variant="light" className="font-mono text-[9px] font-black rounded-full px-1.5 py-0">
                  AI
                </Badge>
              </div>
            </div>

            {/* Compact Rate Tag */}
            <div className="px-2 py-0.5 rounded-lg bg-orange-50 text-[#F45A0A] border border-orange-200/80 font-mono text-[10px] font-black tabular-nums">
              ${(1).toLocaleString('en-US')} = {liveAdoptedRate.toLocaleString('en-US')}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* History View Toggle Button */}
            <Tooltip label={showHistory ? (isAr ? 'العودة للمحادثة' : 'Back to Chat') : (isAr ? 'سجل المحادثات' : 'Chat History')} position="bottom" withArrow>
              <button
                type="button"
                onClick={() => setShowHistory((prev) => !prev)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  showHistory
                    ? 'bg-[#F45A0A] text-white'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100'
                }`}
              >
                <IconHistory size={16} />
              </button>
            </Tooltip>

            {/* New Chat Button */}
            <Tooltip label={isAr ? 'محادثة جديدة' : 'New Chat'} position="bottom" withArrow>
              <button
                type="button"
                onClick={handleStartNewChat}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-black text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200/90 rounded-xl transition-colors cursor-pointer active:scale-95 shadow-2xs"
              >
                <IconPlus size={13} stroke={3} />
                <span>{isAr ? 'جديدة' : 'New'}</span>
              </button>
            </Tooltip>

            {/* Minimize */}
            <Tooltip label={isAr ? 'إغلاق' : 'Minimize'} position="bottom" withArrow>
              <ActionIcon
                size="sm"
                variant="subtle"
                color="gray"
                radius="md"
                onClick={() => setOpened(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <IconChevronDown size={17} />
              </ActionIcon>
            </Tooltip>
          </div>
        </div>

        {/* ── Main Area: Either Chat History OR Messages Feed ── */}
        {showHistory ? (
          /* ── Chat History View ── */
          <div className="flex-1 overflow-y-auto p-3.5 space-y-2 bg-slate-50/60">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200">
              <span className="font-black text-xs text-slate-800 flex items-center gap-1.5">
                <IconHistory size={15} className="text-[#F45A0A]" />
                <span>{isAr ? 'سجل المحادثات السابقة' : 'Past Conversations'}</span>
              </span>
              <button
                type="button"
                onClick={handleStartNewChat}
                className="text-[11px] font-black text-[#F45A0A] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <IconPlus size={12} stroke={3} />
                <span>{isAr ? 'بدء محادثة جديدة' : '+ New Chat'}</span>
              </button>
            </div>

            {sessions.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <IconMessageCircle size={32} className="mx-auto text-slate-300" />
                <p className="text-xs font-bold">{isAr ? 'لا يوجد سجل محادثات بعد' : 'No previous chat sessions yet'}</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {sessions.map((sess) => {
                  const isActive = sess.id === currentSessionId;
                  const dateStr = new Date(sess.createdAt).toLocaleDateString(isAr ? 'ar-IQ' : 'en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={sess.id}
                      onClick={() => handleSelectSession(sess)}
                      className={`group p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer select-none ${
                        isActive
                          ? 'bg-orange-50/90 border-[#F45A0A] text-orange-950 shadow-2xs'
                          : 'bg-white border-slate-200 hover:border-orange-300 hover:bg-orange-50/40 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-1">
                        <IconMessageCircle size={16} className={isActive ? 'text-[#F45A0A] shrink-0' : 'text-slate-400 shrink-0'} />
                        <div className="min-w-0">
                          <span className="font-bold text-xs block truncate">{sess.title}</span>
                          <span className="text-[10px] text-slate-400 font-mono block tabular-nums">{dateStr}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSession(e, sess.id)}
                          className="p-1 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                          title={isAr ? 'حذف الجلسة' : 'Delete session'}
                        >
                          <IconTrash size={14} />
                        </button>
                        {direction === 'rtl' ? <IconArrowLeft size={14} className="text-slate-400" /> : <IconArrowRight size={14} className="text-slate-400" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* ── Normal Messages Feed ── */
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-white text-xs">
            {messages.map((msg, idx) => {
              const isAI = msg.role === 'assistant';
              return (
                <div
                  key={idx}
                  className={`flex flex-col group ${isAI ? 'items-start' : 'items-end'}`}
                >
                  <div
                    className={`max-w-[92%] p-3.5 select-text shadow-xs relative ${
                      isAI
                        ? 'bg-slate-50 text-slate-900 border border-slate-200/80 rounded-2xl rounded-tr-xs'
                        : 'bg-[#F45A0A] text-white rounded-2xl rounded-tl-xs font-bold'
                    }`}
                  >
                    {/* File / Image preview */}
                    {msg.imageBase64 && (
                      <div className="mb-2.5 max-w-full overflow-hidden rounded-xl border border-white/40 shadow-xs">
                        {msg.imageBase64.startsWith('data:image/') ? (
                          <img
                            src={msg.imageBase64}
                            alt="Attached"
                            className="max-h-48 w-auto object-contain bg-black/5 rounded-lg"
                          />
                        ) : (
                          <div className="p-2.5 bg-white/90 text-slate-800 flex items-center gap-2 rounded-lg font-black text-xs">
                            <IconFileText size={18} className="text-orange-600" />
                            <span>{isAr ? 'مستند / ملف مرفق للتحليل' : 'Attached document for analysis'}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Markdown Content */}
                    <div className={`text-[12.5px] font-bold leading-relaxed font-sans ${isAI ? 'text-slate-900' : 'text-white'}`}>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed font-bold">{children}</p>,
                          strong: ({ children }) => <strong className="font-black text-slate-950">{children}</strong>,
                          ul: ({ children }) => <ul className="list-disc list-inside space-y-1.5 my-2 pr-1 font-bold">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal list-inside space-y-1.5 my-2 pr-1 font-bold">{children}</ol>,
                          li: ({ children }) => <li className="leading-relaxed font-bold">{children}</li>,
                          table: ({ children }) => (
                            <div className="overflow-x-auto my-2.5 border border-slate-300 rounded-xl shadow-2xs">
                              <table className="min-w-full divide-y divide-slate-200 text-xs text-right font-sans">
                                {children}
                              </table>
                            </div>
                          ),
                          thead: ({ children }) => <thead className="bg-slate-100 font-black text-slate-950">{children}</thead>,
                          tbody: ({ children }) => <tbody className="divide-y divide-slate-100 bg-white font-bold">{children}</tbody>,
                          tr: ({ children }) => <tr className="hover:bg-slate-50">{children}</tr>,
                          th: ({ children }) => <th className="px-2.5 py-2 font-black text-slate-950 border-b border-slate-200">{children}</th>,
                          td: ({ children }) => <td className="px-2.5 py-2 font-bold text-slate-900">{children}</td>,
                          code: ({ children }) => (
                            <code className="px-1.5 py-0.5 rounded-md bg-orange-100/90 text-orange-950 font-mono text-[11px] font-black border border-orange-200">
                              {children}
                            </code>
                          ),
                          blockquote: ({ children }) => (
                            <blockquote className="border-r-3 border-orange-500 pr-3 my-2 text-slate-800 bg-orange-50/60 py-1.5 rounded-l font-bold">
                              {children}
                            </blockquote>
                          ),
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>

                    {/* Copy Button */}
                    {isAI && (
                      <button
                        type="button"
                        onClick={() => handleCopyText(msg.content, idx)}
                        className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 shadow-2xs cursor-pointer"
                        title={isAr ? 'نسخ الرد' : 'Copy response'}
                      >
                        {copiedIndex === idx ? (
                          <IconCheck size={12} className="text-emerald-600" />
                        ) : (
                          <IconCopy size={12} />
                        )}
                      </button>
                    )}
                  </div>

                  <span className="text-[9px] font-bold text-slate-400 mt-1 px-1 font-mono">
                    {isAI ? (isAr ? 'المستشار الذكي' : 'AI Assistant') : (isAr ? 'أنت' : 'You')}
                  </span>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200/80 rounded-2xl rounded-tr-xs w-fit shadow-2xs">
                <Loader size="xs" color="orange" />
                <span className="text-[11px] font-bold text-slate-600">
                  {isAr ? 'المستشار الذكي يحلل البيانات...' : 'AI Assistant is analyzing data...'}
                </span>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        )}

        {/* Attached File/Image Preview */}
        {!showHistory && (attachedFileBase64 || attachedFileText) && (
          <div className="px-3.5 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-[10.5px] font-bold text-slate-700 truncate max-w-[320px]">
              {isFileTypeImage && attachedFileBase64 ? (
                <div className="w-6 h-6 rounded-lg overflow-hidden border border-slate-300 shrink-0">
                  <img src={attachedFileBase64} alt="Thumb" className="w-full h-full object-cover" />
                </div>
              ) : (
                <IconFileText size={16} className="text-orange-600 shrink-0" />
              )}
              <span className="truncate font-mono">{attachedFileName}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setAttachedFileBase64(null);
                setAttachedFileText(null);
                setAttachedFileName('');
              }}
              className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 cursor-pointer"
            >
              <IconX size={14} />
            </button>
          </div>
        )}

        {/* ── Input Bar (Always available during chat) ── */}
        {!showHistory && (
          <div className="p-3 bg-white border-t border-slate-100 shrink-0">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*,application/pdf,text/*,.csv,.txt,.json,.xlsx"
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/90 rounded-2xl px-2.5 py-1.5 focus-within:border-orange-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-orange-500/10 transition-all shadow-2xs">
              {/* Attachment Button */}
              <Tooltip label={isAr ? 'إرفاق ملف، صورة تذكرة، أو لصق (Ctrl+V)' : 'Attach file, ticket screenshot, or paste (Ctrl+V)'} position="top" withArrow>
                <ActionIcon
                  variant="subtle"
                  size="md"
                  radius="xl"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-slate-400 hover:text-orange-600 hover:bg-orange-50 shrink-0"
                >
                  <IconPaperclip size={18} />
                </ActionIcon>
              </Tooltip>

              {/* Input Text Box */}
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={isAr ? 'اكتب سؤالك هنا أو الصق صورة...' : 'Type your question here or paste an image...'}
                className="flex-1 bg-transparent border-0 outline-none text-xs font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-bold px-1"
              />

              {/* Send Button */}
              <button
                type="button"
                onClick={handleSend}
                disabled={(!inputText.trim() && !attachedFileBase64 && !attachedFileText) || isLoading}
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                  (!inputText.trim() && !attachedFileBase64 && !attachedFileText) || isLoading
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                    : 'bg-[#F45A0A] hover:bg-[#DD4F05] text-white shadow-xs active:scale-95'
                }`}
              >
                {isLoading ? (
                  <Loader size="xs" color="white" />
                ) : (
                  <IconSend size={15} />
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
