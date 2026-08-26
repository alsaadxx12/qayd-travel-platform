import { API_BASE_URL } from './client';
import type { ChatMessage, AiPageContextPayload } from './aiAssistant';

export type AiStreamEvent =
  | { type: 'status'; message: string }
  | { type: 'tool_start'; name: string; label: string }
  | { type: 'tool_end'; name: string; ok: boolean; durationMs: number }
  | { type: 'ui'; blocks: any[] }
  | { type: 'delta'; text: string }
  | { type: 'suggestions'; items: string[] }
  | {
      type: 'done';
      conversationId: string;
      messageId: string;
      model: string;
      toolsUsed: string[];
    }
  | { type: 'error'; message: string };

/**
 * The server sends a `: ping` keep-alive every 10s while a tool runs, so any gap
 * longer than this means the stream is genuinely dead (wedged tool, dropped
 * proxy connection). Without this watchdog the Copilot spins forever.
 */
const IDLE_TIMEOUT_MS = 45_000;
/** Absolute ceiling for one answer, however chatty the stream is. */
const TOTAL_TIMEOUT_MS = 180_000;

const IDLE_MESSAGE =
  'انقطع الاتصال بالمستشار الذكي أثناء تنفيذ العملية. لم يصل رد من الخادم — أعد المحاولة، وإن تكرر الأمر تحقق من خدمة توليد PDF أو خدمة البريد.';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function friendlyStreamError(err: any): string {
  const msg = String(err?.message || '');
  if (msg === IDLE_MESSAGE) return msg;
  if (err?.name === 'AbortError') return msg;
  if (/Failed to fetch|NetworkError|network|ECONNREFUSED|ERR_CONNECTION/i.test(msg)) {
    return 'تعذر الاتصال بالخادم. تأكد أن النظام يعمل ثم أعد إرسال السؤال.';
  }
  if (/502|503|504/.test(msg)) {
    return 'الخادم مشغول مؤقتًا. أعد المحاولة بعد لحظات.';
  }
  return msg || 'فشل الاتصال بالمستشار الذكي';
}

export async function streamCopilotChat(
  payload: {
    messages: ChatMessage[];
    currentPage?: string;
    conversationId?: string;
    page?: AiPageContextPayload;
    locale?: 'ar' | 'en';
  },
  handlers: {
    onEvent: (event: AiStreamEvent) => void;
    signal?: AbortSignal;
  },
): Promise<void> {
  let lastError: Error | null = null;
  let deliveredEvent = false;
  const wrapped = {
    ...handlers,
    onEvent: (event: AiStreamEvent) => {
      deliveredEvent = true;
      handlers.onEvent(event);
    },
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await attemptStream(payload, wrapped);
      if (result === 'done') return;
      if (result === 'dropped-after-start') {
        throw new Error('انقطع الاتصال أثناء الإجابة. اضغط إعادة التوليد.');
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || handlers.signal?.aborted) throw err;
      lastError = err instanceof Error ? err : new Error(String(err));
      if (deliveredEvent || attempt === 2) break;
      await sleep(700 * (attempt + 1));
    }
  }
  throw new Error(friendlyStreamError(lastError));
}

async function attemptStream(
  payload: Parameters<typeof streamCopilotChat>[0],
  handlers: { onEvent: (event: AiStreamEvent) => void; signal?: AbortSignal },
): Promise<'done' | 'dropped-after-start'> {
  // Watchdog controller: aborts the fetch when the stream goes quiet, so a stuck
  // backend surfaces as an error instead of an endless spinner.
  const watchdog = new AbortController();
  let timedOut = false;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;

  const onExternalAbort = () => watchdog.abort();
  handlers.signal?.addEventListener('abort', onExternalAbort, { once: true });

  const trip = () => {
    timedOut = true;
    watchdog.abort();
  };
  const resetIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(trip, IDLE_TIMEOUT_MS);
  };
  const totalTimer = setTimeout(trip, TOTAL_TIMEOUT_MS);
  const cleanup = () => {
    if (idleTimer) clearTimeout(idleTimer);
    clearTimeout(totalTimer);
    handlers.signal?.removeEventListener('abort', onExternalAbort);
  };

  try {
    return await readStream(payload, handlers, watchdog.signal, resetIdle);
  } catch (err: any) {
    // A watchdog abort is our own doing — report it as a timeout, not as a user cancel.
    if (timedOut && !handlers.signal?.aborted) throw new Error(IDLE_MESSAGE);
    throw err;
  } finally {
    cleanup();
  }
}

async function readStream(
  payload: Parameters<typeof streamCopilotChat>[0],
  handlers: { onEvent: (event: AiStreamEvent) => void; signal?: AbortSignal },
  signal: AbortSignal,
  resetIdle: () => void,
): Promise<'done' | 'dropped-after-start'> {
  const token = localStorage.getItem('token');
  const branchId =
    localStorage.getItem('active_branch_id') || localStorage.getItem('activeBranchId') || '';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (branchId) headers['x-branch-id'] = branchId;

  const response = await fetch(`${API_BASE_URL}/ai-assistant/chat/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok || !response.body) {
    let message = 'فشل الاتصال بالمستشار الذكي';
    try {
      const err = await response.json();
      message = err.message || message;
    } catch {
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        message = String(response.status);
      }
    }
    throw new Error(message);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let gotDone = false;
  let gotEvent = false;

  resetIdle();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    // Any traffic — including `: ping` keep-alives — proves the stream is alive.
    resetIdle();
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() || '';
    for (const chunk of chunks) {
      const line = chunk
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l.startsWith('data:'));
      if (!line) continue;
      const raw = line.replace(/^data:\s?/, '');
      try {
        const event = JSON.parse(raw) as AiStreamEvent;
        gotEvent = true;
        if (event.type === 'done') gotDone = true;
        handlers.onEvent(event);
      } catch {
        /* ignore malformed frames */
      }
    }
  }

  if (gotDone) return 'done';
  if (gotEvent) return 'dropped-after-start';
  throw new Error('ERR_CONNECTION');
}
