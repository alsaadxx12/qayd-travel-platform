import { Injectable, Logger } from '@nestjs/common';
import { IsString, IsOptional, IsArray, IsNotEmpty } from 'class-validator';
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
  pdfBase64?: string;

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

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly prisma: PrismaService) {}

  private getApiKey(): string {
    return process.env.BREVO_API_KEY || '';
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
    const apiKey = this.getApiKey();
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
        fetch('https://api.brevo.com/v3/account', {
          method: 'GET',
          headers: {
            'api-key': apiKey,
            accept: 'application/json',
          },
        }),
        fetch('https://api.brevo.com/v3/senders', {
          method: 'GET',
          headers: {
            'api-key': apiKey,
            accept: 'application/json',
          },
        }),
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
    const apiKey = this.getApiKey();
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
      bodyPayload.attachment = dto.attachment;
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
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify(bodyPayload),
      });

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
    const subject = dto.subject || `كشف حساب مالي رسمي — ${dto.accountName}`;
    const cur = dto.currency || 'IQD';
    const balanceNum = typeof dto.currentBalance === 'number' ? dto.currentBalance : Number(dto.currentBalance) || 0;
    const balanceFormatted = balanceNum.toLocaleString('en-US', { minimumFractionDigits: 2 });
    const dateRangeStr = dto.fromDate && dto.toDate ? `${dto.fromDate} إلى ${dto.toDate}` : 'كافة الحركات المسجلة';

    const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 24px 12px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9; color: #1e293b; direction: rtl; text-align: right;">
      <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%); color: #ffffff; padding: 26px 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.3px;">كشف حساب مالي رسمي</h1>
          <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">قسم الإدارة المالية والمحاسبة</p>
        </div>

        <!-- Main Body -->
        <div style="padding: 26px 24px;">
          <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px 0; color: #0f172a;">
            مرحباً شريكنا <strong>${dto.recipientName || dto.accountName}</strong> المحترم،
          </p>
          
          <!-- Beautiful Styled Message Container -->
          <div style="background-color: #f8fafc; border-right: 4px solid #ea580c; border: 1px solid #e2e8f0; padding: 18px 20px; border-radius: 10px; font-size: 14px; line-height: 1.7; color: #1e293b; margin: 16px 0;">
            ${dto.customMessage ? `<p style="margin: 0 0 10px 0; color: #334155;">${dto.customMessage}</p>` : ''}
            <p style="margin: 0; font-weight: 600; color: #0f172a;">
              تجدون برفقه كشف الحساب المالي المعتمد (ملف PDF المرفق). لطفاً تسديد ما بذمتكم من متعلقات مالية.
            </p>
          </div>

          <!-- Account & Balance Summary Cards -->
          <div style="display: table; width: 100%; margin: 20px 0; border-collapse: separate; border-spacing: 10px 0;">
            <div style="display: table-cell; width: 50%; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; text-align: center;">
              <span style="font-size: 11px; color: #64748b; font-weight: bold; display: block;">الحساب المالي:</span>
              <strong style="font-size: 13.5px; color: #0f172a; display: block; margin-top: 4px;">${dto.accountName}</strong>
            </div>
            <div style="display: table-cell; width: 50%; background-color: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; padding: 14px; text-align: center;">
              <span style="font-size: 11px; color: #c2410c; font-weight: bold; display: block;">الرصيد الصافي المطلوب:</span>
              <strong style="font-size: 16px; color: #9a3412; font-family: monospace; display: block; margin-top: 4px;">${balanceFormatted} ${cur}</strong>
            </div>
          </div>

          <div style="font-size: 12px; color: #64748b; margin-bottom: 18px;">
            <span>📅 <strong>فترة الكشف:</strong> ${dateRangeStr}</span>
          </div>

          <!-- Attachment Notice Box -->
          <div style="background-color: #eff6ff; border: 1px dashed #93c5fd; border-radius: 10px; padding: 14px 18px; font-size: 13px; color: #1e40af; margin: 18px 0; text-align: center;">
            📎 <strong>ملف كشف الحساب الرسمي (PDF)</strong> مرفق بالكامل مع هذه الرسالة للتدقيق والمطابقة.
          </div>

          <!-- Signature Section as requested -->
          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 13.5px; line-height: 1.6;">
            <p style="margin: 0; font-weight: bold; color: #1e293b;">شكراً لتعاملكم معنا،</p>
            <p style="margin: 4px 0 0 0; color: #ea580c; font-weight: 800; font-size: 14px;">قسم الحسابات المالية</p>
          </div>
        </div>

        <!-- Minimal Footer -->
        <div style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 14px 20px; text-align: center; font-size: 11px; color: #94a3b8;">
          <p style="margin: 0;">تم الإرسال والتدقيق إلكترونياً • جميع الحقوق محفوظة © ${new Date().getFullYear()}</p>
        </div>
      </div>
    </body>
    </html>
    `;

    const attachments: Array<{ name: string; content: string }> = [];
    if (dto.pdfBase64) {
      attachments.push({
        name: `كشف_حساب_${dto.accountName.replace(/\s+/g, '_')}.pdf`,
        content: dto.pdfBase64,
      });
    }

    return this.sendEmail({
      to: [{ email: dto.recipientEmail, name: dto.recipientName || dto.accountName }],
      subject,
      htmlContent,
      attachment: attachments.length > 0 ? attachments : undefined,
    });
  }
}
