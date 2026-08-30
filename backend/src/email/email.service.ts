import { Injectable, Logger } from '@nestjs/common';
import { IsString, IsOptional, IsArray, IsNotEmpty, IsBoolean } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';

export interface BrevoAccountInfo {
  isConfigured: boolean;
  email: string;
  companyName: string;
  contactName: string;
  credits: number;
  planType: string;
  creditsType: string;
  status: string;
  relayEnabled: boolean;
  activeSenderEmail?: string;
  activeSenderName?: string;
  senders: Array<{ id: number; name: string; email: string; active: boolean }>;
}

export class UpdateSenderConfigDto {
  @IsString()
  @IsNotEmpty()
  senderEmail: string;

  @IsString()
  @IsOptional()
  senderName?: string;
}

export class SendEmailDto {
  @IsNotEmpty()
  to: string | Array<{ email: string; name?: string }>;

  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  htmlContent: string;

  @IsOptional()
  @IsString()
  textContent?: string;

  @IsOptional()
  @IsString()
  senderName?: string;

  @IsOptional()
  @IsString()
  senderEmail?: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsArray()
  attachment?: Array<{ name: string; content: string }>; // base64
}

export class SendStatementEmailDto {
  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsString()
  @IsNotEmpty()
  recipientEmail: string;

  @IsOptional()
  @IsString()
  recipientName?: string;

  @IsString()
  @IsNotEmpty()
  accountName: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  currentBalance?: number | string;

  @IsOptional()
  @IsString()
  fromDate?: string;

  @IsOptional()
  @IsString()
  toDate?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  customMessage?: string;

  @IsOptional()
  @IsString()
  accountCode?: string;

  @IsOptional()
  @IsString()
  pdfBase64?: string;

  /** Mail-safe (ASCII) file name for the attached statement. */
  @IsOptional()
  @IsString()
  attachmentName?: string;

  /** Off by default: the message carries the attached statement, not a balance recap. */
  @IsOptional()
  @IsBoolean()
  includeSummary?: boolean;

  /** Debts digest only. Account statements must attach a PDF. */
  @IsOptional()
  @IsBoolean()
  allowWithoutAttachment?: boolean;

  @IsOptional()
  @IsArray()
  rows?: Array<{
    date: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
  }>;
}

/**
 * Brevo puts this straight into the MIME part name, and non-ASCII names come back
 * as a mangled or dropped attachment in several mail clients.
 */
export function toMailSafeFileName(raw: string, fallback: string): string {
  const base = (raw || '')
    .replace(/\.pdf$/i, '')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._]+|[._]+$/g, '')
    .slice(0, 80);
  return `${base || fallback}.pdf`;
}

/**
 * Brevo network budgets. Node's global fetch has no default timeout, so a stalled
 * TCP connection used to hang the request (and the AI stream) forever.
 */
const BREVO_SEND_TIMEOUT_MS = Number(process.env.BREVO_TIMEOUT_MS || 25_000);
const BREVO_ATTACHMENT_TIMEOUT_MS = Number(process.env.BREVO_ATTACHMENT_TIMEOUT_MS || 60_000);
const BREVO_META_TIMEOUT_MS = 12_000;
const BREVO_MAX_ATTACHMENT_BYTES = 18 * 1024 * 1024;

function decodePdfBase64(raw?: string): Buffer | null {
  if (!raw || !raw.trim()) return null;
  const clean = raw.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
  if (clean.length < 32) return null;
  let buf: Buffer;
  try {
    buf = Buffer.from(clean, 'base64');
  } catch {
    return null;
  }
  if (buf.length < 8) return null;
  if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') return null;
  return buf;
}

async function brevoFetch(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err: any) {
    if (err?.name === 'AbortError' || controller.signal.aborted) {
      throw new Error(
        `تعذر الوصول إلى خدمة البريد (Brevo) خلال ${Math.round(timeoutMs / 1000)} ثانية. تحقق من الاتصال بالإنترنت أو حالة الخدمة ثم أعد المحاولة.`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async getApiKey(): Promise<string> {
    if (process.env.BREVO_API_KEY && process.env.BREVO_API_KEY.trim()) {
      return process.env.BREVO_API_KEY.trim();
    }
    try {
      const record = await this.prisma.printTemplate.findFirst({
        where: { docType: 'brevo_sender_config' },
        orderBy: { updatedAt: 'desc' },
      });
      if (record && record.config) {
        const parsed = typeof record.config === 'string' ? JSON.parse(record.config) : record.config;
        if (parsed.apiKey || parsed.brevoApiKey) {
          return String(parsed.apiKey || parsed.brevoApiKey).trim();
        }
      }
    } catch (err) {
      this.logger.warn(`Could not load db brevo api key: ${err}`);
    }
    return '';
  }

  async getSenderConfig(): Promise<{ senderEmail: string; senderName: string }> {
    try {
      const record = await this.prisma.printTemplate.findFirst({
        where: { docType: 'brevo_sender_config' },
        orderBy: { updatedAt: 'desc' },
      });
      if (record && record.config) {
        const parsed = typeof record.config === 'string' ? JSON.parse(record.config) : record.config;
        if (parsed.senderEmail) {
          return {
            senderEmail: parsed.senderEmail,
            senderName: parsed.senderName || 'Fly4All Accounts',
          };
        }
      }
    } catch (err) {
      this.logger.warn(`Could not load db sender config: ${err}`);
    }

    return {
      senderEmail: process.env.BREVO_SENDER_EMAIL || 'acc2.rooda10@gmail.com',
      senderName: process.env.BREVO_SENDER_NAME || 'Fly4All Accounts',
    };
  }

  async updateSenderConfig(dto: UpdateSenderConfigDto): Promise<{ success: boolean; senderEmail: string; senderName: string }> {
    const senderEmail = dto.senderEmail.trim();
    const senderName = dto.senderName ? dto.senderName.trim() : 'Fly4All Accounts';

    const configJson = JSON.stringify({ senderEmail, senderName });

    try {
      const existing = await this.prisma.printTemplate.findFirst({
        where: { docType: 'brevo_sender_config' },
      });

      if (existing) {
        await this.prisma.printTemplate.update({
          where: { id: existing.id },
          data: { config: configJson, name: 'Brevo Sender Config' },
        });
      } else {
        const company = await this.prisma.company.findFirst();
        await this.prisma.printTemplate.create({
          data: {
            companyId: company?.id || 'default',
            docType: 'brevo_sender_config',
            name: 'Brevo Sender Config',
            config: configJson,
            isDefault: true,
          },
        });
      }
    } catch (err: any) {
      this.logger.error(`Failed to persist sender config: ${err.message}`);
      throw new Error('تعذر حفظ إعدادات البريد في قاعدة البيانات');
    }

    return { success: true, senderEmail, senderName };
  }

  private async getDefaultSender(): Promise<{ name: string; email: string }> {
    const config = await this.getSenderConfig();
    return {
      name: config.senderName,
      email: config.senderEmail,
    };
  }

  async getAccountInfo(): Promise<BrevoAccountInfo> {
    const apiKey = await this.getApiKey();
    const currentSender = await this.getSenderConfig();
    if (!apiKey) {
      return {
        isConfigured: false,
        email: '',
        companyName: '',
        contactName: '',
        credits: 0,
        planType: 'none',
        creditsType: 'none',
        status: 'unconfigured',
        relayEnabled: false,
        activeSenderEmail: currentSender.senderEmail,
        activeSenderName: currentSender.senderName,
        senders: [],
      };
    }

    try {
      const [accRes, sendersRes] = await Promise.all([
        brevoFetch(
          'https://api.brevo.com/v3/account',
          { method: 'GET', headers: { 'api-key': apiKey, accept: 'application/json' } },
          BREVO_META_TIMEOUT_MS,
        ),
        brevoFetch(
          'https://api.brevo.com/v3/senders',
          { method: 'GET', headers: { 'api-key': apiKey, accept: 'application/json' } },
          BREVO_META_TIMEOUT_MS,
        ),
      ]);

      if (!accRes.ok) {
        const errText = await accRes.text();
        this.logger.error(`Brevo Account API error: ${errText}`);
        throw new Error(`فشل الاتصال بخدمة Brevo: ${accRes.statusText}`);
      }

      const accData = await accRes.json();
      let sendersData: any = { senders: [] };
      if (sendersRes.ok) {
        sendersData = await sendersRes.json();
      }

      const primaryPlan = accData.plan && accData.plan[0] ? accData.plan[0] : { type: 'free', credits: 300, creditsType: 'sendLimit' };

      return {
        isConfigured: true,
        email: accData.email || '',
        companyName: accData.companyName || 'accfly',
        contactName: `${accData.firstName || ''} ${accData.lastName || ''}`.trim(),
        credits: primaryPlan.credits ?? 300,
        planType: primaryPlan.type || 'free',
        creditsType: primaryPlan.creditsType || 'sendLimit',
        status: accData.planVerticals?.[0]?.status || 'active',
        relayEnabled: !!accData.relay?.enabled,
        activeSenderEmail: currentSender.senderEmail,
        activeSenderName: currentSender.senderName,
        senders: (sendersData.senders || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          email: s.email,
          active: s.active,
        })),
      };
    } catch (err: any) {
      this.logger.error(`Error fetching Brevo account info: ${err.message}`);
      throw new Error(err.message || 'حدث خطأ أثناء جلب بيانات Brevo');
    }
  }

  async sendEmail(dto: SendEmailDto): Promise<{ success: boolean; messageId?: string }> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      throw new Error('مفتاح خدمة Brevo غير مهيأ في النظام.');
    }

    const defaultSender = await this.getDefaultSender();
    const sender = {
      name: dto.senderName || defaultSender.name,
      email: dto.senderEmail || defaultSender.email,
    };

    let recipients: Array<{ email: string; name?: string }> = [];
    if (typeof dto.to === 'string') {
      recipients = [{ email: dto.to.trim() }];
    } else if (Array.isArray(dto.to)) {
      recipients = dto.to;
    }

    if (recipients.length === 0 || !recipients[0].email) {
      throw new Error('يرجى تحديد عنوان البريد الإلكتروني للمستلم.');
    }

    const bodyPayload: any = {
      sender,
      to: recipients,
      subject: dto.subject,
      htmlContent: dto.htmlContent,
    };

    if (dto.textContent) {
      bodyPayload.textContent = dto.textContent;
    }

    if (dto.attachment && dto.attachment.length > 0) {
      bodyPayload.attachment = dto.attachment.map((item) => ({
        name: item.name,
        content: item.content,
      }));
    }

    const tenantId = dto.tenantId || '00000000-0000-0000-0000-000000000001';
    const todayStr = new Date().toISOString().slice(0, 10);
    const monthStr = new Date().toISOString().slice(0, 7);

    // 1. Check Global Server Limit (280/300 safety threshold)
    const globalDaily = await this.prisma.usageCounter.findUnique({
      where: {
        tenantId_metric_periodKey: {
          tenantId: '00000000-0000-0000-0000-000000000001',
          metric: 'GLOBAL_BREVO_DAILY',
          periodKey: todayStr,
        },
      },
    });

    if (globalDaily && globalDaily.currentValue >= 280) {
      throw new Error('تم الوصول إلى سقف إرسال البريد اليومي الإجمالي لمزود الخدمة (280/300). يرجى المحاولة غداً أو استخدام مزود مخصص.');
    }

    // 2. Check Tenant Plan Limit. The platform owner is not a billable tenant.
    const [tenant, activeSub] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { isRoot: true } }),
      this.prisma.tenantSubscription.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        include: { planVersion: { include: { limits: true } } },
      }),
    ]);

    const dailyLimit = tenant?.isRoot
      ? -1
      : activeSub?.planVersion.limits.find((l) => l.limitCode === 'EMAIL_DAILY')?.limitValue ?? 100;
    const monthlyLimit = tenant?.isRoot
      ? -1
      : activeSub?.planVersion.limits.find((l) => l.limitCode === 'EMAIL_MONTHLY')?.limitValue ?? 1500;

    const tenantDaily = await this.prisma.usageCounter.findUnique({
      where: {
        tenantId_metric_periodKey: {
          tenantId,
          metric: 'EMAIL_DAILY',
          periodKey: todayStr,
        },
      },
    });

    if (tenantDaily && dailyLimit !== -1 && tenantDaily.currentValue >= dailyLimit) {
      throw new Error(`وصلت المؤسسة إلى حد الإرسال اليومي المسموح (${dailyLimit} رسالة/يوم) في باقتك الحالية. يرجى الترقية لزيادة الحد.`);
    }

    try {
      const res = await brevoFetch(
        'https://api.brevo.com/v3/smtp/email',
        {
          method: 'POST',
          headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify(bodyPayload),
        },
        dto.attachment?.length ? BREVO_ATTACHMENT_TIMEOUT_MS : BREVO_SEND_TIMEOUT_MS,
      );

      if (!res.ok) {
        const errorText = await res.text();
        this.logger.error(`Brevo Send Error: ${errorText}`);
        throw new Error(`خطأ في إرسال البريد عبر Brevo: ${errorText}`);
      }

      const resData = await res.json();

      // 3. Atomically increment counters on success
      await Promise.all([
        this.prisma.usageCounter.upsert({
          where: { tenantId_metric_periodKey: { tenantId, metric: 'EMAIL_DAILY', periodKey: todayStr } },
          update: { currentValue: { increment: 1 } },
          create: { tenantId, metric: 'EMAIL_DAILY', periodKey: todayStr, currentValue: 1 },
        }),
        this.prisma.usageCounter.upsert({
          where: { tenantId_metric_periodKey: { tenantId, metric: 'EMAIL_MONTHLY', periodKey: monthStr } },
          update: { currentValue: { increment: 1 } },
          create: { tenantId, metric: 'EMAIL_MONTHLY', periodKey: monthStr, currentValue: 1 },
        }),
        this.prisma.usageCounter.upsert({
          where: { tenantId_metric_periodKey: { tenantId: '00000000-0000-0000-0000-000000000001', metric: 'GLOBAL_BREVO_DAILY', periodKey: todayStr } },
          update: { currentValue: { increment: 1 } },
          create: { tenantId: '00000000-0000-0000-0000-000000000001', metric: 'GLOBAL_BREVO_DAILY', periodKey: todayStr, currentValue: 1 },
        }),
      ]).catch((cntErr) => this.logger.warn(`Failed to update email usage counters: ${cntErr}`));

      return {
        success: true,
        messageId: resData.messageId,
      };
    } catch (err: any) {
      this.logger.error(`Failed to send email via Brevo: ${err.message}`);
      throw new Error(err.message || 'فشل إرسال البريد الإلكتروني');
    }
  }

  async sendStatementEmail(dto: SendStatementEmailDto): Promise<{ success: boolean; messageId?: string }> {
    const pdfBuffer = decodePdfBase64(dto.pdfBase64);
    if (!pdfBuffer && dto.allowWithoutAttachment !== true) {
      throw new Error(
        'لا يمكن إرسال كشف الحساب بدون ملف PDF صالح. أعد توليد الكشف ثم حاول الإرسال من جديد.',
      );
    }
    if (pdfBuffer && pdfBuffer.length > BREVO_MAX_ATTACHMENT_BYTES) {
      throw new Error(
        `ملف الكشف أكبر من الحد المسموح للمرفق (${Math.round(pdfBuffer.length / (1024 * 1024))} MB). قلّص فترة الكشف ثم أعد الإرسال.`,
      );
    }

    const stamp = String(dto.toDate || new Date().toISOString().slice(0, 10)).replace(/[^0-9A-Za-z]+/g, '-');
    const attachmentName = toMailSafeFileName(
      dto.attachmentName || `Account_Statement_${dto.accountCode || ''}_${stamp}`,
      `Account_Statement_${stamp}`,
    );
    const greetingName = dto.recipientName || dto.accountName || '';
    const subject = dto.subject || `كشف حساب — ${dto.accountName}`;
    const bodyLine = pdfBuffer
      ? 'مرفق ملف كشف الحساب الرسمي (PDF).'
      : (dto.customMessage || 'تجدون تفاصيل الحساب في هذه الرسالة.');

    const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>${subject}</title>
    </head>
    <body style="margin:0;padding:24px 12px;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f8fafc;color:#0f172a;direction:rtl;text-align:right;">
      <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:22px 20px;">
        <p style="margin:0 0 12px 0;font-size:15px;line-height:1.7;">
          مرحباً${greetingName ? ` <strong>${greetingName}</strong>` : ''}،
        </p>
        <p style="margin:0;font-size:14px;line-height:1.7;color:#334155;">
          ${bodyLine}
        </p>
      </div>
    </body>
    </html>
    `;

    const result = await this.sendEmail({
      to: [{ email: dto.recipientEmail, name: greetingName || undefined }],
      subject,
      htmlContent,
      textContent: `مرحباً${greetingName ? ` ${greetingName}` : ''}،\n${bodyLine}\n`,
      attachment: pdfBuffer
        ? [{ name: attachmentName, content: pdfBuffer.toString('base64') }]
        : undefined,
    });

    this.logger.log(
      `Statement email sent to ${dto.recipientEmail} — attachment ${
        pdfBuffer ? `${attachmentName} (${Math.round(pdfBuffer.length / 1024)} KB)` : 'NONE'
      }`,
    );

    return result;
  }
}
