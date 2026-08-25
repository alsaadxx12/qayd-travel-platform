import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatRequestDto, ChatMessageDto } from './ai-assistant.dto';

@Injectable()
export class AIAssistantService {
  private readonly logger = new Logger(AIAssistantService.name);
  private readonly groqApiKey = process.env.GROQ_API_KEY || '';

  constructor(private prisma: PrismaService) {}

  /**
   * Fetch complete real database context with custom learned rules
   */
  async getLiveFinancialContext(tenantId?: string, clientAdoptedRate?: number) {
    const snapshots = await this.prisma.exchangeRateSnapshot.findMany({
      take: 10,
      orderBy: { capturedAt: 'desc' },
    });

    const latestSnap = snapshots[0];
    const baghdadSell = latestSnap?.baghdadSell || 1547.5;
    const baghdadBuy = latestSnap?.baghdadBuy || 1545.0;
    const northernSell = latestSnap?.northernSell || 1545.0;
    const southernSell = latestSnap?.southernSell || 1540.0;

    let tenantInfo: any = null;
    let companyId = tenantId;
    let learnedRules: string[] = [];

    if (tenantId) {
      tenantInfo = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          subscriptions: {
            where: { status: 'ACTIVE' },
            include: {
              planVersion: {
                include: {
                  plan: true,
                  features: true,
                  limits: true,
                },
              },
            },
          },
        },
      });
      if (tenantInfo?.companyId) {
        companyId = tenantInfo.companyId;
      }
      if (tenantInfo?.customSettings) {
        try {
          const parsed = JSON.parse(tenantInfo.customSettings);
          if (Array.isArray(parsed.aiLearnedRules)) {
            learnedRules = parsed.aiLearnedRules;
          }
        } catch {}
      }
    }

    let adoptedRate = clientAdoptedRate || 1552.5;

    if (!clientAdoptedRate) {
      const rateTemplate = await this.prisma.printTemplate.findFirst({
        where: {
          docType: 'exchange_rate_settings',
          OR: [
            ...(companyId ? [{ companyId }] : []),
            ...(tenantId ? [{ companyId: tenantId }] : []),
            { companyId: 'default-company-id' },
          ],
        },
        orderBy: { updatedAt: 'desc' },
      });

      if (rateTemplate?.config) {
        try {
          const cfg = JSON.parse(rateTemplate.config);
          if (cfg.mode === 'FIXED') {
            adoptedRate = Number(cfg.fixedRate || 1530);
          } else {
            let baseMarket = baghdadSell;
            if (cfg.baseMarketSource === 'BAGHDAD_BUY') baseMarket = baghdadBuy;
            else if (cfg.baseMarketSource === 'NORTHERN_SELL') baseMarket = northernSell;
            else if (cfg.baseMarketSource === 'SOUTHERN_SELL') baseMarket = southernSell;
            else if (cfg.baseMarketSource === 'AVERAGE') {
              baseMarket = Number(((baghdadSell + northernSell + southernSell) / 3).toFixed(1));
            }

            const marginVal =
              cfg.marginUnit === 'PER_100_USD'
                ? Number(cfg.marginAmount || 0) / 100
                : Number(cfg.marginAmount || 0);

            adoptedRate = Number((baseMarket + marginVal).toFixed(1));
          }
        } catch (e: any) {
          this.logger.warn(`Failed to parse exchange_rate_settings: ${e.message}`);
        }
      }
    }

    const currentMargin = Number((adoptedRate - baghdadSell).toFixed(1));
    const isMarginSafe = currentMargin >= 3.0 && currentMargin <= 15.0;

    const allPlans = await this.prisma.plan.findMany({
      where: { isActive: true },
      include: {
        versions: {
          where: { isActive: true },
          include: {
            features: true,
            limits: true,
          },
        },
      },
    });

    const activeSub = tenantInfo?.subscriptions?.[0];
    const planName = activeSub?.planVersion?.plan?.nameAr || 'الفترة التجريبية';
    const planCode = activeSub?.planVersion?.plan?.code || 'FREE_TRIAL';

    return {
      adoptedRate,
      baghdadSell,
      baghdadBuy,
      northernSell,
      southernSell,
      currentMargin,
      isMarginSafe,
      tenantName: tenantInfo?.name || 'علاء الدين',
      planName,
      planCode,
      currency: tenantInfo?.baseCurrency || 'IQD',
      learnedRules,
      allPlans: allPlans.map((p) => {
        const v = p.versions[0];
        const monthlyPrice = v ? v.priceMonthlyCents / 100 : 0;
        return {
          code: p.code,
          nameAr: p.nameAr,
          priceMonthly: monthlyPrice,
          priceYearly: Math.round(monthlyPrice * 10),
          features: v?.features?.map((f) => f.nameAr || f.featureCode) || [],
          limits: v?.limits?.map((l) => `${l.nameAr || l.limitCode}: ${l.limitValue === -1 ? 'غير محدود' : l.limitValue}`) || [],
        };
      }),
    };
  }

  /**
   * Process interactive chat with Vision & Document Processing
   */
  async processChat(dto: ChatRequestDto, tenantId?: string) {
    const context = await this.getLiveFinancialContext(tenantId);

    const plansKnowledge = context.allPlans
      .map(
        (p) =>
          `* باقة ${p.nameAr} (${p.code}): السعر الشهري: $${p.priceMonthly} / السعر السنوي: $${p.priceYearly}. الميزات: [${p.features.slice(0, 8).join(', ')}]. الحدود: [${p.limits.join(', ')}]`,
      )
      .join('\n');

    const learnedRulesText = context.learnedRules.length
      ? `\nقواعد مخصصة تم تعلمها من تعليمات وتوجيهات المستخدم السابقة:\n${context.learnedRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
      : '';

    const systemPrompt = `أنت مساعد ووكيل ذكاء اصطناعي فائق الذكاء، متعدد المهارات (Multimodal Vision & Document AI)، ومتطور لنظام قيد المحاسبي للسياحة والسفر (QAYD Travel Accounting).
قواعد الإجابة الأساسية:
1. استجب بنفس لغة رسالة المستخدم (إن كان السؤال بالإنجليزية أجب بالإنجليزية بطلاقة واحترافية، وإن كان بالعربية أجب بالعربية).
2. كن ذكياً ومباشراً ومختصراً — لا تُكثر من الكلام أو الإسهاب أو الحشو غير الضروري. أجب بدقة وعمق في صلب السؤال.
3. يمكنك الإجابة عن **أي سؤال أو موضوع يطرحه المستخدم** (سواء كان في المحاسبة، تذاكر الطيران، الفنادق، التأشيرات، أسعار الصرف، باقات النظام، الترجمة، التقنية، الرياضيات، كتابة الإيميلات، السفر، أو الثقافة والعلوم العامة).
4. **تحليل الصور والمستندات والملفات (Vision & Document Analysis)**:
   - أنت تدعم قراءة الصور والمستندات والتذاكر مباشرة عبر الرؤية البصرية وتحليل النصوص.
   - عند رفع أي تذكرة أو فاتورة أو ملف، استخرج مباشرة: (أسماء المسافرين، أرقام الجوازات/التذاكر، رمز الـ PNR، خط السير، المبالغ، والقيد المحاسبي الموصى به) باختصار شديد.
5. **البيانات المالية الحية وهامش الأمان المحاسبي المعتمد**:
   - **السعر المعتمد حالياً في النظام**: ${context.adoptedRate} د.ع لكل 1 دولار (100$ = ${(context.adoptedRate * 100).toLocaleString('en-US')} د.ع).
   - **سعر بيع بورصة بغداد (السوق)**: ${context.baghdadSell} د.ع | **سعر الشراء**: ${context.baghdadBuy} د.ع.
   - **هامش الأمان المحاسبي الفعلي**: (+${context.currentMargin} د.ع لكل 1$) (أي +${(context.currentMargin * 100).toLocaleString('en-US')} د.ع لكل 100$).
   - **معادلة الهامش**: هامش الأمان = السعر المعتمد (${context.adoptedRate}) - سعر البورصة (${context.baghdadSell}) = +${context.currentMargin} د.ع.
   - **تقييم هامش الأمان**: ${
     context.currentMargin >= 3.0 && context.currentMargin <= 8.0
       ? `هامش الأمان الحالي (+${context.currentMargin} د.ع) مثالي ونموذجي (+3 إلى +8 د.ع) لحماية أرباح مبيعات التذاكر دون الحاجة لتغيير السعر.`
       : context.currentMargin > 8.0
       ? `هامش الأمان الحالي (+${context.currentMargin} د.ع) قوي وممتاز ويمنح حماية مضاعفة من تقلبات الصرف.`
       : `هامش الأمان الحالي (+${context.currentMargin} د.ع) منخفض ويُفضل زيادته لتغطية مخاطر الصرف.`
   }
6. **باقات النظام والأسعار الرسمية**:
${plansKnowledge || `* باقة الفترة التجريبية (FREE_TRIAL): مجاناً لمدة 14 يوماً.
* الباقة الأساسية (BASIC): $99 شهرياً ($999 سنوياً).
* الباقة الاحترافية (PRO): $199 شهرياً ($1,999 سنوياً).
* باقة المؤسسات (ENTERPRISE): تسعير مخصص سنوي.`}
   - المؤسسة الحالية: "${context.tenantName}" | باقتها الحالية: "${context.planName}" (${context.planCode}).${learnedRulesText}
7. لا تظهر أي وسوم تفكير داخلية إطلاقاً.`;

    const userMessages = dto.messages || [];
    const formattedMessages: any[] = [{ role: 'system', content: systemPrompt }];

    for (const m of userMessages) {
      if (m.imageBase64 && m.imageBase64.startsWith('data:image/')) {
        // Send proper multimodal vision payload
        formattedMessages.push({
          role: m.role,
          content: [
            {
              type: 'text',
              text: m.content || 'يرجى قراءة وتحليل هذه الصورة/المستند واستخراج البيانات المحاسبية وأسماء المسافرين والأرقام منها بدقة.',
            },
            {
              type: 'image_url',
              image_url: {
                url: m.imageBase64,
              },
            },
          ],
        });
      } else if (m.imageBase64 && !m.imageBase64.startsWith('data:image/')) {
        // Non-image document (PDF or text base64)
        let extractedPdfText = '';
        try {
          const rawBuffer = Buffer.from(m.imageBase64.split(',')[1] || m.imageBase64, 'base64').toString('latin1');
          const tokens = rawBuffer.match(/\(([^)]+)\)|\[([^\]]+)\]/g) || [];
          extractedPdfText = tokens
            .map((t) => t.replace(/[()[\]]/g, '').trim())
            .filter((t) => t.length > 2 && /^[a-zA-Z0-9\s/.,\-:;()#]+$/.test(t))
            .slice(0, 150)
            .join(' ');
        } catch {}

        formattedMessages.push({
          role: m.role,
          content: `${m.content || 'يرجى تحليل بيانات المستند المرفق بدقة.'}\n\n[محتوى المستند المرفق المستخرج]:\n${extractedPdfText || 'بيانات تذكرة طيران ومستند محاسبي'}`,
        });
      } else {
        formattedMessages.push({
          role: m.role,
          content: m.content || '',
        });
      }
    }

    const candidateModels = [
      'qwen/qwen3.6-27b',
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
      'canopylabs/orpheus-arabic-saudi',
      'groq/compound',
    ];

    for (const model of candidateModels) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.groqApiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: formattedMessages,
            temperature: 0.3,
            max_tokens: 1500,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          let rawContent = data.choices?.[0]?.message?.content || '';

          const cleanReply = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

          if (cleanReply) {
            return {
              reply: cleanReply,
              financialContext: context,
              modelUsed: model,
            };
          }
        } else {
          const errBody = await response.text();
          this.logger.warn(`Model ${model} error: ${response.status} - ${errBody.substring(0, 150)}`);
        }
      } catch (err: any) {
        this.logger.warn(`Model ${model} failed: ${err.message}`);
      }
    }

    // Fallback response
    const lastMsg = userMessages[userMessages.length - 1]?.content?.trim() || '';
    if (/^(مرحبا|أهلا|اهلا|سلام|hi|hello)/i.test(lastMsg)) {
      return {
        reply: `أهلاً بك! كيف يمكنني مساعدتك اليوم؟`,
        financialContext: context,
        modelUsed: 'conversational-engine',
      };
    }

    return {
      reply: `* **السعر المعتمد**: \`${context.adoptedRate} د.ع\` لكل 1$\n* **سعر البورصة**: \`${context.baghdadSell} د.ع\`\n* **هامش الأمان**: \`+${context.currentMargin} د.ع\``,
      financialContext: context,
      modelUsed: 'rule-engine',
    };
  }
}
