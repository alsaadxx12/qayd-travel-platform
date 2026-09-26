import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

/*
 * بوابة واتساب السحابية (WhatsApp Cloud API من Meta).
 *
 * ما يلزم من حساب Meta ليعمل الربط — وكلّه يُحفظ هنا لكل شركة على حدة:
 *   1. Phone Number ID  — معرّف رقم الهاتف في WhatsApp Manager (ليس الرقم نفسه).
 *   2. WABA ID          — معرّف حساب واتساب للأعمال (اختياري: لعرض حالة الحساب).
 *   3. Access Token     — رمز وصول دائم لمستخدم نظام (System User) بصلاحيتي
 *                          whatsapp_business_messaging و whatsapp_business_management.
 *   4. App Secret       — سرّ التطبيق للتحقق من توقيع الـWebhook (اختياري لكنه مستحسن).
 *   5. Verify Token     — كلمة يولّدها النظام هنا وتُلصق في إعداد الـWebhook عند Meta.
 *
 * الإعدادات تُخزَّن كسجلٍّ في مخزن القوالب (docType = whatsapp_cloud_settings) مثل
 * بقية إعدادات النظام، والرمز لا يُعاد إلى المتصفح إلا مقنَّعاً.
 */

const DOC_TYPE = 'whatsapp_cloud_settings';
const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || 'v21.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const GRAPH_TIMEOUT_MS = Number(process.env.WHATSAPP_TIMEOUT_MS || 25_000);

/**
 * عنوان الموقع العام كما تعرفه روابط الكشوفات نفسها: الـWebhook يُعلن على دومن
 * الموقع (الـWorker يمرّر /api إلى الخادم)، لا على عنوان الخادم الداخلي.
 */
const publicSiteBase = () =>
  (process.env.PORTAL_BASE_URL || process.env.APP_BASE_URL || process.env.FRONTEND_URL || 'https://qayd-travel-platform.alsaady-rrr123r.workers.dev')
    .trim()
    .replace(/\/+$/, '');

export interface WhatsAppSettings {
  enabled: boolean;
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
  appSecret: string;
  verifyToken: string;
  /** رمز الدولة الافتراضي لأرقامٍ تبدأ بصفر محلي (العراق 964). */
  defaultCountryCode: string;
  /** قالب الاختبار: hello_world يأتي جاهزاً مع كل حساب جديد. */
  testTemplateName: string;
  testTemplateLang: string;
  /** آخر ما عرفناه عن الرقم من Meta — يُحدَّث مع كل فحص حالة. */
  displayPhone?: string;
  verifiedName?: string;
  qualityRating?: string;
  lastCheckedAt?: string;
  updatedAt?: string;
}

const DEFAULTS: WhatsAppSettings = {
  enabled: false,
  phoneNumberId: '',
  wabaId: '',
  accessToken: '',
  appSecret: '',
  verifyToken: '',
  defaultCountryCode: '964',
  testTemplateName: 'hello_world',
  testTemplateLang: 'en_US',
};

export class SaveWhatsAppSettingsDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() @MaxLength(64) phoneNumberId?: string;
  @IsOptional() @IsString() @MaxLength(64) wabaId?: string;
  /** فارغ أو غائب = أبقِ الرمز المحفوظ كما هو. */
  @IsOptional() @IsString() @MaxLength(1024) accessToken?: string;
  @IsOptional() @IsString() @MaxLength(256) appSecret?: string;
  @IsOptional() @IsString() @MaxLength(128) verifyToken?: string;
  @IsOptional() @IsString() @MaxLength(6) defaultCountryCode?: string;
  @IsOptional() @IsString() @MaxLength(512) testTemplateName?: string;
  @IsOptional() @IsString() @MaxLength(16) testTemplateLang?: string;
}

export class SendTestDto {
  @IsString() @MaxLength(32) to!: string;
  /** template: يصل دائماً؛ text: لا يصل إلا داخل نافذة 24 ساعة بعد رسالةٍ من العميل. */
  @IsOptional() @IsIn(['template', 'text']) mode?: 'template' | 'text';
  @IsOptional() @IsString() @MaxLength(1024) text?: string;
}

export class SendTextDto {
  @IsString() @MaxLength(32) to!: string;
  @IsString() @MaxLength(4096) text!: string;
}

export class SendStatementDto {
  @IsString() @MaxLength(32) to!: string;
  @IsString() @MaxLength(200) accountName!: string;
  @IsOptional() @IsString() @MaxLength(64) accountCode?: string;
  @IsOptional() @IsString() @MaxLength(32) fromDate?: string;
  @IsOptional() @IsString() @MaxLength(32) toDate?: string;
  /** نصّ الملخّص المرافق (تعليق المستند أو الرسالة كلها إن لم يُرفق ملف). */
  @IsOptional() @IsString() @MaxLength(1024) caption?: string;
  /** ملف الكشف PDF مرمّزاً base64؛ غيابه يعني إرسال الملخّص نصاً فقط. */
  @IsOptional() @IsString() pdfBase64?: string;
  @IsOptional() @IsString() @MaxLength(120) fileName?: string;
}

/** ما تعنيه أشهر أكواد أخطاء Meta بالعربية — بدل رسالةٍ إنجليزية مبهمة. */
const META_ERROR_HINTS: Record<number, string> = {
  190: 'رمز الوصول منتهٍ أو غير صالح. أنشئ رمزاً دائماً لمستخدم نظام (System User) وأعد لصقه.',
  10: 'الرمز لا يملك الصلاحية المطلوبة. أضف whatsapp_business_messaging و whatsapp_business_management.',
  100: 'معرّف رقم الهاتف (Phone Number ID) غير صحيح أو لا يخص هذا الرمز.',
  33: 'معرّف رقم الهاتف (Phone Number ID) غير صحيح أو لا يخص هذا الرمز.',
  131030: 'الرقم غير مضاف إلى قائمة المستلمين المسموح بهم. في وضع التطوير يسمح Meta بخمسة أرقام فقط حتى يُعتمد التطبيق.',
  131047: 'خارج نافذة 24 ساعة: لا يُرسل نصٌّ حر إلا بعد أن يراسلك العميل. قبل ذلك تُرسل القوالب المعتمدة فقط.',
  131026: 'تعذّر التسليم: الرقم ليس على واتساب أو لم يقبل شروط الخدمة الجديدة.',
  131051: 'نوع الرسالة غير مدعوم لهذا المستلم.',
  132000: 'القالب غير موجود بهذا الاسم واللغة.',
  132001: 'القالب غير معتمد بعد أو لغته غير مطابقة.',
  133010: 'رقم الهاتف غير مسجَّل في Cloud API. أكمل تسجيل الرقم في WhatsApp Manager.',
  131042: 'مشكلة في طريقة الدفع لحساب واتساب للأعمال. أضف طريقة دفع في Meta Business.',
};

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────── الإعدادات ───────────────────────────

  private async load(companyId: string): Promise<WhatsAppSettings> {
    try {
      const row = await this.prisma.printTemplate.findFirst({ where: { companyId, docType: DOC_TYPE } });
      if (!row?.config) return { ...DEFAULTS };
      const parsed = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
      return { ...DEFAULTS, ...(parsed || {}) };
    } catch (e: any) {
      this.logger.warn(`whatsapp settings unreadable: ${e?.message}`);
      return { ...DEFAULTS };
    }
  }

  private async persist(companyId: string, settings: WhatsAppSettings) {
    const config = JSON.stringify({ ...settings, updatedAt: new Date().toISOString() });
    const existing = await this.prisma.printTemplate.findFirst({ where: { companyId, docType: DOC_TYPE }, select: { id: true } });
    if (existing) {
      await this.prisma.printTemplate.update({ where: { id: existing.id }, data: { config, name: 'WhatsApp Cloud Settings' } });
    } else {
      await this.prisma.printTemplate.create({
        data: { companyId, docType: DOC_TYPE, name: 'WhatsApp Cloud Settings', config, isDefault: true },
      });
    }
  }

  private mask(secret: string) {
    const s = String(secret || '');
    if (!s) return '';
    return s.length <= 8 ? '••••' : `${'•'.repeat(8)}${s.slice(-4)}`;
  }

  private isConfigured(s: WhatsAppSettings) {
    return Boolean(s.phoneNumberId && s.accessToken);
  }

  /** ما يراه المتصفح: كل شيء إلا الأسرار، وهي مقنَّعة. */
  async getSettings(companyId: string) {
    let s = await this.load(companyId);
    if (!s.verifyToken) {
      // كلمة التحقق تُولَّد مرةً واحدة وتبقى، لأنها تُلصق في إعداد Meta ولا يجوز أن تتبدل.
      s = { ...s, verifyToken: randomBytes(18).toString('hex') };
      await this.persist(companyId, s);
    }
    const { accessToken, appSecret, ...rest } = s;
    return {
      ...rest,
      configured: this.isConfigured(s),
      hasAccessToken: Boolean(accessToken),
      accessTokenMasked: this.mask(accessToken),
      hasAppSecret: Boolean(appSecret),
      appSecretMasked: this.mask(appSecret),
      webhookPath: '/api/whatsapp/webhook',
      webhookUrl: `${publicSiteBase()}/api/whatsapp/webhook`,
      graphVersion: GRAPH_VERSION,
    };
  }

  async saveSettings(companyId: string, dto: SaveWhatsAppSettingsDto) {
    const current = await this.load(companyId);
    const clean = (v?: string) => String(v ?? '').trim();
    const next: WhatsAppSettings = {
      ...current,
      enabled: dto.enabled ?? current.enabled,
      phoneNumberId: dto.phoneNumberId !== undefined ? clean(dto.phoneNumberId).replace(/\D/g, '') : current.phoneNumberId,
      wabaId: dto.wabaId !== undefined ? clean(dto.wabaId).replace(/\D/g, '') : current.wabaId,
      // الأسرار: الحقل الفارغ يعني «لا تغيير»، والمسح الصريح يكون بكلمة CLEAR.
      accessToken: dto.accessToken === 'CLEAR' ? '' : clean(dto.accessToken) || current.accessToken,
      appSecret: dto.appSecret === 'CLEAR' ? '' : clean(dto.appSecret) || current.appSecret,
      verifyToken: clean(dto.verifyToken) || current.verifyToken || randomBytes(18).toString('hex'),
      defaultCountryCode: dto.defaultCountryCode !== undefined ? clean(dto.defaultCountryCode).replace(/\D/g, '') || '964' : current.defaultCountryCode,
      testTemplateName: dto.testTemplateName !== undefined ? clean(dto.testTemplateName) || 'hello_world' : current.testTemplateName,
      testTemplateLang: dto.testTemplateLang !== undefined ? clean(dto.testTemplateLang) || 'en_US' : current.testTemplateLang,
    };
    if (next.enabled && !this.isConfigured(next)) {
      throw new BadRequestException('لا يمكن تفعيل البوابة قبل إدخال Phone Number ID ورمز الوصول.');
    }
    await this.persist(companyId, next);
    return this.getSettings(companyId);
  }

  // ─────────────────────────── Graph API ───────────────────────────

  private async graph<T = any>(settings: WhatsAppSettings, path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GRAPH_TIMEOUT_MS);
    try {
      const headers: Record<string, string> = { Authorization: `Bearer ${settings.accessToken}`, ...((init.headers as Record<string, string>) || {}) };
      const res = await fetch(`${GRAPH}/${path}`, { ...init, headers, signal: controller.signal });
      const text = await res.text();
      let body: any = {};
      try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
      if (!res.ok) {
        const err = body?.error || {};
        const code = Number(err.code);
        const sub = Number(err.error_subcode);
        const hint = META_ERROR_HINTS[sub] || META_ERROR_HINTS[code] || '';
        const detail = err.error_data?.details || err.error_user_msg || err.message || `HTTP ${res.status}`;
        this.logger.warn(`Meta ${path} -> ${res.status} code=${code} sub=${sub}: ${detail}`);
        throw new BadRequestException(hint ? `${hint} (Meta: ${detail})` : `Meta: ${detail}`);
      }
      return body as T;
    } catch (e: any) {
      if (e instanceof BadRequestException) throw e;
      if (e?.name === 'AbortError') throw new BadRequestException('انتهت مهلة الاتصال بخوادم Meta.');
      throw new BadRequestException(`تعذّر الوصول إلى Meta: ${e?.message || e}`);
    } finally {
      clearTimeout(timer);
    }
  }

  private async requireConfigured(companyId: string) {
    const s = await this.load(companyId);
    if (!this.isConfigured(s)) {
      throw new BadRequestException('بوابة واتساب غير مربوطة بعد. أدخل Phone Number ID ورمز الوصول من متجر الإضافات.');
    }
    return s;
  }

  /** رقم دولي بلا «+» ولا فراغات كما يريده Meta: 07701234567 ← 9647701234567. */
  normalizePhone(raw: string, countryCode: string) {
    let d = String(raw || '').replace(/\D/g, '');
    if (!d) throw new BadRequestException('رقم الهاتف فارغ.');
    if (d.startsWith('00')) d = d.slice(2);
    const cc = String(countryCode || '964').replace(/\D/g, '') || '964';
    if (d.startsWith('0')) d = cc + d.replace(/^0+/, '');
    else if (!d.startsWith(cc) && d.length <= 10) d = cc + d;
    if (d.length < 8 || d.length > 15) throw new BadRequestException(`رقم الهاتف غير صالح: ${raw}`);
    return d;
  }

  /** حالة الربط من Meta نفسها: الرقم المعروض، الاسم الموثّق، جودة الرقم، وحدّ الإرسال. */
  async getStatus(companyId: string) {
    const s = await this.load(companyId);
    if (!this.isConfigured(s)) return { configured: false, ok: false, enabled: s.enabled };
    try {
      const phone = await this.graph<any>(
        s,
        `${s.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,code_verification_status,name_status,messaging_limit_tier,platform_type`,
      );
      let waba: any = null;
      if (s.wabaId) {
        try { waba = await this.graph<any>(s, `${s.wabaId}?fields=name,account_review_status,message_template_namespace`); } catch (e: any) { waba = { error: e?.message }; }
      }
      const updated: WhatsAppSettings = {
        ...s,
        displayPhone: phone.display_phone_number || s.displayPhone,
        verifiedName: phone.verified_name || s.verifiedName,
        qualityRating: phone.quality_rating || s.qualityRating,
        lastCheckedAt: new Date().toISOString(),
      };
      await this.persist(companyId, updated);
      return {
        configured: true,
        ok: true,
        enabled: s.enabled,
        displayPhone: phone.display_phone_number || '',
        verifiedName: phone.verified_name || '',
        qualityRating: phone.quality_rating || '',
        codeVerificationStatus: phone.code_verification_status || '',
        nameStatus: phone.name_status || '',
        messagingLimitTier: phone.messaging_limit_tier || '',
        platformType: phone.platform_type || '',
        wabaName: waba?.name || '',
        accountReviewStatus: waba?.account_review_status || '',
        wabaError: waba?.error || '',
        checkedAt: updated.lastCheckedAt,
      };
    } catch (e: any) {
      return { configured: true, ok: false, enabled: s.enabled, error: e?.message || String(e), displayPhone: s.displayPhone || '', verifiedName: s.verifiedName || '' };
    }
  }

  // ─────────────────────────── الإرسال ───────────────────────────

  private async sendMessage(s: WhatsAppSettings, payload: Record<string, any>) {
    const res = await this.graph<any>(s, `${s.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', ...payload }),
    });
    const messageId = res?.messages?.[0]?.id || '';
    const waId = res?.contacts?.[0]?.wa_id || payload.to;
    this.logger.log(`whatsapp sent ${payload.type} to ${waId} id=${messageId}`);
    return { success: true, messageId, to: waId };
  }

  async sendTemplate(s: WhatsAppSettings, to: string, name: string, lang: string, components?: any[]) {
    return this.sendMessage(s, {
      to,
      type: 'template',
      template: { name, language: { code: lang }, ...(components?.length ? { components } : {}) },
    });
  }

  async sendText(s: WhatsAppSettings, to: string, body: string) {
    return this.sendMessage(s, { to, type: 'text', text: { preview_url: true, body } });
  }

  /** رفع ملف إلى Meta ثم إرساله مستنداً — الطريقة الوحيدة لإرسال PDF ليس له رابط عام. */
  async uploadMedia(s: WhatsAppSettings, buffer: Buffer, mime: string, fileName: string) {
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', mime);
    form.append('file', new Blob([new Uint8Array(buffer)], { type: mime }), fileName);
    const res = await this.graph<any>(s, `${s.phoneNumberId}/media`, { method: 'POST', body: form });
    if (!res?.id) throw new BadRequestException('لم يُعد Meta معرّفاً للملف المرفوع.');
    return String(res.id);
  }

  async sendDocument(s: WhatsAppSettings, to: string, mediaId: string, fileName: string, caption?: string) {
    return this.sendMessage(s, { to, type: 'document', document: { id: mediaId, filename: fileName, ...(caption ? { caption } : {}) } });
  }

  async sendTest(companyId: string, dto: SendTestDto) {
    const s = await this.requireConfigured(companyId);
    const to = this.normalizePhone(dto.to, s.defaultCountryCode);
    if (dto.mode === 'text') {
      return this.sendText(s, to, dto.text?.trim() || 'رسالة تجريبية من نظام قيد المحاسبي — البوابة تعمل ✔');
    }
    return this.sendTemplate(s, to, s.testTemplateName || 'hello_world', s.testTemplateLang || 'en_US');
  }

  async sendPlainText(companyId: string, dto: SendTextDto) {
    const s = await this.requireConfigured(companyId);
    return this.sendText(s, this.normalizePhone(dto.to, s.defaultCountryCode), dto.text.trim());
  }

  async sendStatement(companyId: string, dto: SendStatementDto) {
    const s = await this.requireConfigured(companyId);
    const to = this.normalizePhone(dto.to, s.defaultCountryCode);
    const title = `كشف حساب — ${dto.accountCode ? `${dto.accountCode} - ` : ''}${dto.accountName}`;
    const period = dto.fromDate && dto.toDate ? `\nالفترة: ${dto.fromDate} → ${dto.toDate}` : '';
    const caption = (dto.caption?.trim() || `${title}${period}`).slice(0, 1024);
    if (dto.pdfBase64) {
      const raw = dto.pdfBase64.includes(',') ? dto.pdfBase64.split(',').pop()! : dto.pdfBase64;
      const buffer = Buffer.from(raw, 'base64');
      if (!buffer.length) throw new BadRequestException('ملف الكشف فارغ.');
      if (buffer.length > 95 * 1024 * 1024) throw new BadRequestException('ملف الكشف أكبر من الحد المسموح (100MB).');
      const fileName = (dto.fileName || `statement-${(dto.accountCode || dto.accountName).replace(/[^\w؀-ۿ-]+/g, '_')}.pdf`).slice(0, 120);
      const mediaId = await this.uploadMedia(s, buffer, 'application/pdf', fileName);
      return this.sendDocument(s, to, mediaId, fileName, caption);
    }
    return this.sendText(s, to, caption);
  }

  // ─────────────────────────── Webhook ───────────────────────────

  /** التحقق الأول من Meta: تُعاد قيمة challenge إن طابقت كلمة التحقق أيَّ شركة. */
  async verifyWebhook(mode: string, token: string, challenge: string) {
    if (mode !== 'subscribe' || !token) return null;
    const rows = await this.prisma.printTemplate.findMany({ where: { docType: DOC_TYPE }, select: { config: true } });
    for (const r of rows) {
      try {
        const cfg = typeof r.config === 'string' ? JSON.parse(r.config) : r.config;
        if (cfg?.verifyToken && cfg.verifyToken === token) return challenge;
      } catch { /* سجلّ تالف — يُتجاوز */ }
    }
    return null;
  }

  /** توقيع Meta (X-Hub-Signature-256) يُقارن بسرّ التطبيق إن كان محفوظاً. */
  private async signatureValid(rawBody: Buffer | undefined, signature: string | undefined) {
    const rows = await this.prisma.printTemplate.findMany({ where: { docType: DOC_TYPE }, select: { config: true } });
    const secrets = rows
      .map((r) => { try { return (typeof r.config === 'string' ? JSON.parse(r.config) : r.config)?.appSecret || ''; } catch { return ''; } })
      .filter(Boolean) as string[];
    if (!secrets.length) return true; // لا سرّ محفوظ: لا شيء نتحقق به، ويُقبل مع تحذير
    if (!rawBody || !signature?.startsWith('sha256=')) return false;
    const given = Buffer.from(signature.slice(7), 'hex');
    return secrets.some((secret) => {
      const expected = createHmac('sha256', secret).update(rawBody).digest();
      return expected.length === given.length && timingSafeEqual(expected, given);
    });
  }

  async handleWebhook(body: any, rawBody: Buffer | undefined, signature: string | undefined) {
    if (!(await this.signatureValid(rawBody, signature))) {
      this.logger.warn('whatsapp webhook rejected: bad signature');
      return { received: false };
    }
    const entries = Array.isArray(body?.entry) ? body.entry : [];
    for (const entry of entries) {
      for (const change of entry?.changes || []) {
        const v = change?.value || {};
        for (const st of v.statuses || []) {
          this.logger.log(`whatsapp status ${st.status} id=${st.id} to=${st.recipient_id}${st.errors?.[0] ? ` err=${st.errors[0].code} ${st.errors[0].title}` : ''}`);
        }
        for (const m of v.messages || []) {
          this.logger.log(`whatsapp inbound ${m.type} from=${m.from} id=${m.id}`);
        }
      }
    }
    return { received: true };
  }
}
