import { Injectable } from '@nestjs/common';
import { SystemKnowledgeService } from '../core/system-knowledge.service';
import { AiPermissionService } from '../core/ai-permission.service';
import { LearningService, LearnedKind } from '../core/learning.service';
import { LlmProviderService } from '../core/llm-provider.service';
import { AiRequestContext, AiTool, AiToolResult, AiToolProvider } from '../types/ai-tool.types';
import { baghdadLongAr, baghdadYmd, nowContextLine } from '../core/baghdad-clock';
import { DEFAULT_AI_MODEL, DEFAULT_FAST_MODEL } from '../../common/openai-models';

@Injectable()
export class MetaTools implements AiToolProvider {
  constructor(
    private readonly knowledge: SystemKnowledgeService,
    private readonly permissions: AiPermissionService,
    private readonly learning: LearningService,
    private readonly llm: LlmProviderService,
  ) {}

  getTools(): AiTool[] {
    return [
      {
        name: 'generateImage',
        description:
          'صمّم أو ولّد صورة من وصف نصي (شعار، بوستر، مشهد، تصميم). ليست لتحليل تذكرة أو فاتورة مرفقة. Generate an image from a text prompt.',
        parameters: {
          type: 'object',
          properties: {
            prompt: { type: 'string', description: 'وصف الصورة المطلوب تصميمها' },
            size: {
              type: 'string',
              enum: ['1024x1024', '1536x1024', '1024x1536'],
              description: 'أبعاد الصورة',
            },
          },
          required: ['prompt'],
          additionalProperties: false,
        },
        requiredPermissions: [],
        sensitivity: 'read',
        handler: (args) => this.generateImage(args),
      },
      {
        name: 'getSystemCapabilities',
        description:
          'اشرح ما يستطيع النظام القيام به والوحدات المتاحة لهذا المستخدم. Use when the user asks what the system can do or which pages exist.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
        requiredPermissions: [],
        sensitivity: 'read',
        handler: (_args, ctx) => this.getSystemCapabilities(ctx),
      },
      {
        name: 'getUserContext',
        description:
          'اعرض سياق المستخدم الحالي: الاسم، الدور، الفرع، السنة المالية، الصفحة المفتوحة، والصلاحيات باختصار. Current user/session context.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
        requiredPermissions: [],
        sensitivity: 'read',
        handler: (_args, ctx) => this.getUserContext(ctx),
      },
      {
        name: 'searchCurrentInfo',
        description:
          'ابحث عن معلومة عامة حالية من الويب (أخبار، أسعار عالمية، طقس، شخصيات عامة، أحداث اليوم). ليست لأرصدة الشركة أو التذاكر داخل النظام. Use for live world facts after the model training cutoff.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'موضوع البحث بالعربية أو الإنجليزية' },
          },
          required: ['query'],
          additionalProperties: false,
        },
        requiredPermissions: [],
        sensitivity: 'read',
        handler: (args) => this.searchCurrentInfo(args),
      },
      {
        name: 'rememberFact',
        description:
          'احفظ قاعدة أو اسمًا أو تفضيلًا عن طريقة عمل هذه الشركة ليستخدمه المستشار لاحقًا. استخدمها عندما يقول المستخدم: تعلّم، احفظ، من الآن، عندنا نسمّي، القاعدة عندنا. Do NOT save changing financial amounts.',
        parameters: {
          type: 'object',
          properties: {
            kind: { type: 'string', enum: ['rule', 'alias', 'preference', 'correction'] },
            title: { type: 'string', description: 'عنوان قصير مثل: اسم شركة النور' },
            content: { type: 'string', description: 'المعلومة المراد تذكّرها' },
            entityKind: { type: 'string' },
            entityId: { type: 'string' },
            companyWide: { type: 'boolean', description: 'true لتصبح المعلومة لكل مستخدمي الشركة' },
          },
          required: ['kind', 'title', 'content'],
          additionalProperties: false,
        },
        requiredPermissions: [],
        sensitivity: 'write',
        handler: (args, ctx) => this.rememberFact(args, ctx),
      },
      {
        name: 'listLearnedFacts',
        description: 'اعرض ما تعلّمه المستشار عن هذه الشركة. List remembered rules, aliases and preferences.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
        requiredPermissions: [],
        sensitivity: 'read',
        handler: (_args, ctx) => this.listFacts(ctx),
      },
      {
        name: 'forgetLearnedFact',
        description: 'انسَ معلومة محفوظة بالمعرّف أو بالعنوان. Forget a previously learned fact.',
        parameters: {
          type: 'object',
          properties: { idOrTitle: { type: 'string' } },
          required: ['idOrTitle'],
          additionalProperties: false,
        },
        requiredPermissions: [],
        sensitivity: 'write',
        handler: (args, ctx) => this.forgetFact(args, ctx),
      },
    ];
  }

  private async generateImage(args: any): Promise<AiToolResult> {
    const prompt = String(args.prompt || args.description || '').trim();
    if (!prompt) return { ok: false, data: { message: 'اكتب وصف الصورة المطلوب تصميمها' } };
    const key = (await this.llm.getOpenAiKey())?.trim();
    if (!key) return { ok: false, data: { message: 'مفتاح OpenAI غير مضبوط لتوليد الصور' } };

    const size = ['1024x1024', '1536x1024', '1024x1536', '1792x1024', '1024x1792'].includes(String(args.size || ''))
      ? String(args.size)
      : '1024x1024';

    const src = await this.requestGeneratedImage(key, prompt, size);
    if (!src) {
      return { ok: false, data: { message: 'تعذر تصميم الصورة الآن. أعد المحاولة بوصف أوضح.' } };
    }

    return {
      ok: true,
      data: { generated: true, prompt: prompt.slice(0, 240) },
      ui: [{ type: 'generated_image', payload: { src, prompt } }],
      note: 'تم تصميم الصورة.',
      suggestions: ['عدّل التصميم', 'صيغة مربعة', 'صيغة أفقية'],
    };
  }

  private async requestGeneratedImage(key: string, prompt: string, size: string): Promise<string | null> {
    const attempts = [
      { model: 'gpt-image-1', body: { model: 'gpt-image-1', prompt, size, n: 1 } },
      {
        model: 'dall-e-3',
        body: { model: 'dall-e-3', prompt, size: size === '1536x1024' ? '1792x1024' : size === '1024x1536' ? '1024x1792' : '1024x1024', n: 1, response_format: 'b64_json' },
      },
    ];
    for (const attempt of attempts) {
      try {
        const res = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(attempt.body),
          signal: AbortSignal.timeout(45_000),
        });
        const json = await res.json();
        if (!res.ok) continue;
        const item = json?.data?.[0];
        if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
        if (item?.url) return String(item.url);
      } catch {
        continue;
      }
    }
    return null;
  }

  private async searchCurrentInfo(args: any): Promise<AiToolResult> {
    const query = String(args?.query || args?.q || '').trim();
    if (!query) return { ok: false, data: { message: 'اكتب موضوع البحث' } };

    const today = baghdadYmd();
    const todayAr = baghdadLongAr();
    const key = (await this.llm.getOpenAiKey())?.trim();
    if (!key) {
      return {
        ok: true,
        data: {
          today,
          todayAr,
          answer: `${nowContextLine()}. تعذر البحث الحي لأن مفتاح OpenAI غير مضبوط.`,
        },
        note: `اليوم ${todayAr}.`,
      };
    }

    const searched = await this.requestWebSearch(key, query, todayAr);
    if (searched?.answer) {
      return {
        ok: true,
        data: { today, todayAr, query, answer: searched.answer, sources: searched.sources },
        note: searched.answer.slice(0, 220),
        ui: searched.sources.length
          ? [
              {
                // Citations get their own compact block. As a generic table the raw
                // URL wrapped across five unreadable lines.
                type: 'sources',
                payload: { title: 'مصادر حديثة', items: searched.sources.slice(0, 5) },
              },
            ]
          : undefined,
      };
    }

    return {
      ok: true,
      data: {
        today,
        todayAr,
        query,
        answer: `${nowContextLine()}. لم يتوفر بحث ويب الآن. لا تستخدم حد تدريب يونيو 2024. أجب فقط بما هو مؤكد من التاريخ الحالي أو بيانات النظام.`,
      },
      note: `اليوم ${todayAr}.`,
    };
  }

  private async requestWebSearch(
    apiKey: string,
    query: string,
    todayAr: string,
  ): Promise<{ answer: string; sources: Array<{ title: string; url: string }> } | null> {
    const input = `Today is ${todayAr} (Asia/Baghdad). Answer the query with CURRENT facts. If the query is Arabic, answer in Arabic. Be concise. Query: ${query}`;
    const models = [process.env.AI_MODEL || DEFAULT_AI_MODEL, 'gpt-5.6-sol', 'gpt-5.6-terra', DEFAULT_FAST_MODEL];
    const toolTypes = ['web_search', 'web_search_preview'];

    for (const model of models) {
      for (const toolType of toolTypes) {
        try {
          const res = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              tools: [{ type: toolType }],
              input,
            }),
            signal: AbortSignal.timeout(22_000),
          });
          if (!res.ok) continue;
          const json = await res.json();
          const answer = this.extractResponseText(json);
          if (!answer) continue;
          return { answer, sources: this.extractResponseSources(json) };
        } catch {
          continue;
        }
      }
    }
    return null;
  }

  private extractResponseText(json: any): string {
    if (typeof json?.output_text === 'string' && json.output_text.trim()) return json.output_text.trim();
    const chunks: string[] = [];
    for (const item of json?.output || []) {
      for (const part of item?.content || []) {
        const text = part?.text || part?.output_text;
        if (typeof text === 'string' && text.trim()) chunks.push(text.trim());
      }
    }
    return chunks.join('\n').trim();
  }

  private extractResponseSources(json: any): Array<{ title: string; url: string }> {
    const out: Array<{ title: string; url: string }> = [];
    const seen = new Set<string>();
    const push = (title: string, url: string) => {
      const href = String(url || '').trim();
      if (!href || seen.has(href)) return;
      seen.add(href);
      out.push({ title: String(title || href).slice(0, 80), url: href });
    };
    const visit = (node: any) => {
      if (!node) return;
      if (Array.isArray(node)) {
        node.forEach(visit);
        return;
      }
      if (typeof node !== 'object') return;
      if (node.url && (node.title || node.type === 'url_citation' || node.type === 'citation')) {
        push(node.title || node.url, node.url);
      }
      for (const v of Object.values(node)) visit(v);
    };
    visit(json);
    return out.slice(0, 6);
  }

  private async getSystemCapabilities(ctx: AiRequestContext): Promise<AiToolResult> {
    const modules = this.knowledge.getModules(ctx, (code) => this.permissions.hasPermission(ctx, code));
    return {
      ok: true,
      data: {
        modules: modules.map((m) => ({ title: m.title, route: m.route, summary: m.summary })),
      },
    };
  }

  private async getUserContext(ctx: AiRequestContext): Promise<AiToolResult> {
    return {
      ok: true,
      data: {
        user: ctx.userName,
        role: ctx.role,
        company: ctx.companyName,
        baseCurrency: ctx.baseCurrency,
        activeBranchId: ctx.activeBranchId,
        canAccessAllBranches: ctx.canAccessAllBranches,
        fiscalYear: ctx.fiscalYear,
        page: ctx.page,
        permissionCount: ctx.permissions?.length || 0,
      },
    };
  }

  private async rememberFact(args: any, ctx: AiRequestContext): Promise<AiToolResult> {
    const result = await this.learning.remember({
      ctx,
      kind: (args.kind || 'rule') as LearnedKind,
      title: args.title,
      content: args.content,
      entityKind: args.entityKind,
      entityId: args.entityId,
      source: 'user',
      companyWide: args.companyWide !== false,
    });
    if (!result.ok) return { ok: false, data: { saved: false, message: result.message }, note: result.message };
    return {
      ok: true,
      data: { saved: true, id: result.fact.id, title: result.fact.title },
      note: `تم الحفظ: ${result.fact.title}`,
    };
  }

  private async listFacts(ctx: AiRequestContext): Promise<AiToolResult> {
    const facts = await this.learning.listActive(ctx.companyId, ctx.userId);
    return {
      ok: true,
      data: {
        count: facts.length,
        facts: facts.map((f) => ({
          id: f.id,
          kind: f.kind,
          title: f.title,
          content: f.content,
          source: f.source,
        })),
      },
      ui: facts.length
        ? [
            {
              type: 'table',
              payload: {
                title: 'ما يعرفه المستشار عن الشركة',
                columns: [
                  { key: 'kind', label: 'النوع', type: 'badge' },
                  { key: 'title', label: 'العنوان' },
                  { key: 'content', label: 'المحتوى' },
                ],
                rows: facts.map((f) => ({ kind: f.kind, title: f.title, content: f.content })),
              },
            },
          ]
        : undefined,
    };
  }

  private async forgetFact(args: any, ctx: AiRequestContext): Promise<AiToolResult> {
    const result = await this.learning.forget(ctx.companyId, args.idOrTitle);
    if (!result.ok) return { ok: false, data: { forgotten: false, message: result.message }, note: result.message };
    return { ok: true, data: { forgotten: true, title: result.title } };
  }
}
