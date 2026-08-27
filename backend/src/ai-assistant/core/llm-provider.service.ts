import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import OpenAI from 'openai';
import { AiTool } from '../types/ai-tool.types';
import { parseLeakedToolCall, stripModelScratch } from './intent-router';
import { AiBillingService } from './ai-billing.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DEFAULT_AI_MODEL,
  DEFAULT_FAST_MODEL,
  chatModelParams,
} from '../../common/openai-models';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: any;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

export interface LlmToolCall {
  id: string;
  name: string;
  arguments: any;
}

export interface LlmCompletion {
  content: string;
  toolCalls: LlmToolCall[];
  model: string;
}

type ProviderKind = 'openai';

/**
 * Copilot, ticket parsing, and visa analysis all use OpenAI only.
 */
@Injectable()
export class LlmProviderService implements OnModuleInit {
  private readonly logger = new Logger(LlmProviderService.name);

  private cachedOpenAiKey = '';
  private readonly primaryModel = process.env.AI_MODEL || DEFAULT_AI_MODEL;
  private readonly fastModel = process.env.AI_FAST_MODEL || DEFAULT_FAST_MODEL;
  private readonly openaiTimeoutMs = Number(process.env.AI_OPENAI_TIMEOUT_MS || 50000);

  private openAiClient: OpenAI | null = null;
  private openAiKeyUsed = '';

  /** Skip a model until this timestamp (ms) after auth/quota/rate-limit failures. */
  private readonly disabledUntil = new Map<string, number>();

  constructor(
    private readonly billing: AiBillingService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    await this.getOpenAiKey();
  }

  async getOpenAiKey(): Promise<string> {
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()) {
      this.cachedOpenAiKey = process.env.OPENAI_API_KEY.trim();
      return this.cachedOpenAiKey;
    }
    if (this.cachedOpenAiKey) return this.cachedOpenAiKey;
    try {
      const record = await this.prisma.printTemplate.findFirst({
        where: { docType: 'ai_keys_config' },
        orderBy: { updatedAt: 'desc' },
      });
      if (record && record.config) {
        const parsed = typeof record.config === 'string' ? JSON.parse(record.config) : record.config;
        if (parsed.openaiApiKey || parsed.openAiKey || parsed.apiKey) {
          this.cachedOpenAiKey = String(parsed.openaiApiKey || parsed.openAiKey || parsed.apiKey).trim();
          return this.cachedOpenAiKey;
        }
      }
    } catch (err) {
      this.logger.warn(`Could not load db openai key: ${err}`);
    }
    return '';
  }

  get hasToolCapableProvider(): boolean {
    return Boolean(this.cachedOpenAiKey || process.env.OPENAI_API_KEY);
  }

  get hasOpenAi(): boolean {
    return Boolean(this.cachedOpenAiKey || process.env.OPENAI_API_KEY);
  }

  get primaryModelName(): string {
    return this.primaryModel;
  }

  private getOpenAi(): OpenAI | null {
    const key = this.cachedOpenAiKey || process.env.OPENAI_API_KEY || '';
    if (!key) return null;
    if (!this.openAiClient || this.openAiKeyUsed !== key) {
      this.openAiKeyUsed = key;
      this.openAiClient = new OpenAI({
        apiKey: key,
        maxRetries: 0,
        timeout: this.openaiTimeoutMs,
      });
    }
    return this.openAiClient;
  }

  toOpenAiTools(tools: AiTool[]) {
    return tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  async complete(params: {
    messages: LlmMessage[];
    tools?: AiTool[];
    temperature?: number;
    maxTokens?: number;
    toolChoice?: 'auto' | 'required';
  }): Promise<LlmCompletion> {
    const attempts = this.buildAttempts('complete');

    if (!attempts.length) {
      throw new Error('لا يوجد مزود ذكاء اصطناعي مهيأ. عيّن OPENAI_API_KEY.');
    }

    let lastError: Error | null = null;
    for (const attempt of attempts) {
      if (this.isDisabled(attempt.kind, attempt.model)) continue;
      try {
        return await this.runCompletion(attempt, params);
      } catch (err: any) {
        lastError = err;
        this.noteFailure(attempt.kind, attempt.model, err);
        this.logger.warn(`${attempt.kind}:${attempt.model} failed: ${err.message}`);
      }
    }
    throw lastError || new Error('فشل استدعاء OpenAI');
  }

  async *streamText(params: {
    messages: LlmMessage[];
    temperature?: number;
    maxTokens?: number;
  }): AsyncGenerator<string, void, unknown> {
    const attempts = this.buildAttempts('stream');

    let lastError: Error | null = null;
    for (const attempt of attempts) {
      if (this.isDisabled(attempt.kind, attempt.model)) continue;
      try {
        const stream = await attempt.client.chat.completions.create(
          {
            model: attempt.model,
            messages: params.messages as any,
            ...chatModelParams(attempt.model, {
              maxTokens: params.maxTokens ?? 800,
              temperature: params.temperature ?? 0.2,
              reasoning: 'medium',
            }),
            stream: true,
            stream_options: { include_usage: true },
          },
          { timeout: this.openaiTimeoutMs, maxRetries: 0 },
        );
        let usage: any;
        for await (const chunk of stream) {
          if ((chunk as any).usage) usage = (chunk as any).usage;
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        }
        this.noteUsage(usage);
        return;
      } catch (err: any) {
        lastError = err;
        this.noteFailure(attempt.kind, attempt.model, err);
        this.logger.warn(`stream ${attempt.kind}:${attempt.model} failed: ${err.message}`);
      }
    }
    if (lastError) throw lastError;
  }

  async completeWithFallback(params: {
    messages: LlmMessage[];
    temperature?: number;
    maxTokens?: number;
  }): Promise<LlmCompletion | null> {
    try {
      return await this.complete({ ...params, toolChoice: 'auto' });
    } catch {
      return null;
    }
  }

  private async runCompletion(
    attempt: { kind: ProviderKind; client: OpenAI; model: string },
    params: {
      messages: LlmMessage[];
      tools?: AiTool[];
      temperature?: number;
      maxTokens?: number;
      toolChoice?: 'auto' | 'required';
    },
  ): Promise<LlmCompletion> {
    const request: any = {
      model: attempt.model,
      messages: params.messages,
      ...chatModelParams(attempt.model, {
        maxTokens: params.maxTokens ?? 1200,
        temperature: params.temperature ?? 0.1,
        reasoning: 'high',
      }),
    };

    if (params.tools?.length) {
      request.tools = this.toOpenAiTools(params.tools);
      request.tool_choice = params.toolChoice || 'auto';
      request.parallel_tool_calls = true;
    }

    const response = await attempt.client.chat.completions.create(request, {
      timeout: this.openaiTimeoutMs,
      maxRetries: 0,
    });
    this.noteUsage((response as any).usage);
    const choice = response.choices?.[0]?.message;
    const nativeCalls = (choice?.tool_calls || [])
      .map((tc: any) => ({
        id: tc.id,
        name: tc.function?.name,
        arguments: this.safeParseArgs(tc.function?.arguments),
      }))
      .filter((c: LlmToolCall) => Boolean(c.name));

    if (!nativeCalls.length) {
      const leaked = parseLeakedToolCall(choice?.content || '');
      if (leaked) {
        return {
          content: '',
          toolCalls: [{ id: `leaked_${leaked.name}`, name: leaked.name, arguments: leaked.arguments }],
          model: response.model || attempt.model,
        };
      }
    }

    return {
      content: stripModelScratch(choice?.content || ''),
      toolCalls: nativeCalls,
      model: response.model || attempt.model,
    };
  }

  private buildAttempts(mode: 'complete' | 'stream' = 'complete'): Array<{
    kind: ProviderKind;
    client: OpenAI;
    model: string;
  }> {
    const openai = this.getOpenAi();
    if (!openai) return [];
    const preferred = [
      mode === 'stream' ? this.fastModel : this.primaryModel,
      this.primaryModel,
      this.fastModel,
      DEFAULT_AI_MODEL,
      'gpt-5.6-terra',
      'gpt-5.6-luna',
      'gpt-4.1',
    ];
    const models = preferred.filter(
      (model, index, all) => model && all.indexOf(model) === index && !this.isDisabled('openai', model),
    );
    return models.map((model) => ({ kind: 'openai' as const, client: openai, model }));
  }

  clearHold(kind?: ProviderKind) {
    if (!kind) {
      this.disabledUntil.clear();
      return;
    }
    for (const key of [...this.disabledUntil.keys()]) {
      if (key.startsWith(`${kind}:`)) this.disabledUntil.delete(key);
    }
  }

  private isDisabled(kind: ProviderKind, model: string) {
    const until = this.disabledUntil.get(`${kind}:${model}`) || 0;
    return until > Date.now();
  }

  private noteUsage(usage: any) {
    if (!usage) return;
    void this.billing.recordOpenAiUsage({
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      cachedTokens: usage.prompt_tokens_details?.cached_tokens,
    });
  }

  private noteFailure(kind: ProviderKind, model: string, err: any) {
    const msg = String(err?.message || err || '');
    const status = Number(err?.status || err?.statusCode || 0);
    const key = `${kind}:${model}`;

    if (
      status === 401 ||
      /invalid api key|incorrect api key/i.test(msg) ||
      /no credits remaining|insufficient_quota|exceeded your current quota/i.test(msg)
    ) {
      this.disabledUntil.set(key, Date.now() + 15 * 60 * 1000);
      this.logger.warn(
        `OpenAI معطّل لمدة 15 دقيقة بعد خطأ الرصيد/المفتاح. بعد الشحن أعد تشغيل الخادم أو انتظر انتهاء المهلة.`,
      );
      return;
    }

    if (status === 404 || /does not exist or you do not have access/i.test(msg)) {
      this.disabledUntil.set(key, Date.now() + 6 * 60 * 60 * 1000);
      return;
    }

    const retry = msg.match(/try again in ([\d.]+)\s*s/i);
    if (status === 429 || /rate limit/i.test(msg)) {
      const waitMs = retry ? Math.ceil(Number(retry[1]) * 1000) + 250 : 15_000;
      this.disabledUntil.set(key, Date.now() + waitMs);
    }
  }

  private safeParseArgs(raw: any): any {
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  /* -- Whisper Speech-to-Text (single fast call) -- */
  async transcribeAudio(audioBuffer: Buffer, mimeType: string, knownNames?: string[]): Promise<string> {
    const client = this.getOpenAi();
    if (!client) throw new Error('OpenAI API key is not configured');

    const ext = mimeType.includes('webm') ? 'webm'
      : mimeType.includes('mp4') ? 'mp4'
      : mimeType.includes('wav') ? 'wav'
      : mimeType.includes('ogg') ? 'ogg'
      : mimeType.includes('mpeg') ? 'mp3'
      : 'webm';

    const { toFile } = await import('openai/uploads');
    const uploadable = await toFile(audioBuffer, `voice.${ext}`, { type: mimeType });

    const realNames = knownNames?.length ? knownNames.slice(0, 50).join(', ') + ',' : '';
    const domainPrompt = [
      realNames,
      'سلف علي السعدي, كشف حساب علي السعدي, رصيد علي السعدي,',
      'كشف حساب, رصيد الصندوق, مبيعات اليوم, أرباح اليوم,',
      'ذمم العملاء, حوالة, فاتورة, قيد يومية, سند قبض, سند صرف,',
      'تذكرة طيران, حجز, تأشيرة, فيزا,',
      'دائن, مدين, الرصيد, المصروفات, الإيرادات,',
      'السعدي, المالكي, الحسيني, الموسوي, العبيدي,',
      'علي, أحمد, محمد, حسين, عباس, كرار, مصطفى, حيدر,',
    ].filter(Boolean).join(' ');

    const whisperRes = await client.audio.transcriptions.create({
      file: uploadable,
      model: 'whisper-1',
      language: 'ar',
      prompt: domainPrompt,
      temperature: 0,
    });

    return whisperRes.text?.trim() || '';
  }
}
