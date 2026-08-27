import { Injectable } from '@nestjs/common';
import { DailyBriefService } from '../core/daily-brief.service';
import { AiRequestContext, AiTool, AiToolResult, AiToolProvider } from '../types/ai-tool.types';

/** The same checks the morning brief runs, available on demand. */
@Injectable()
export class BriefTools implements AiToolProvider {
  constructor(private readonly brief: DailyBriefService) {}

  getTools(): AiTool[] {
    return [
      {
        name: 'getDailyBrief',
        description:
          'فحص سريع لوضع الشركة اليوم: قيود غير متوازنة، هامش الأمان، العمليات الآجلة غير المسدّدة، أكبر مدين وأكبر مستحق. ' +
          'استخدمها لأسئلة «شنو الوضع اليوم؟»، «شلون الشركة؟»، «شي محتاج انتباه؟»، «اعطيني ملخص». ' +
          'Daily health check of the company.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
        requiredPermissions: [],
        sensitivity: 'read',
        handler: (_args, ctx) => this.daily(ctx),
      },
    ];
  }

  private async daily(ctx: AiRequestContext): Promise<AiToolResult> {
    const brief = await this.brief.build(ctx.companyId, ctx.tenantId);

    if (!brief.findings.length) {
      return {
        ok: true,
        data: { needsAttention: false, findings: [] },
        note: 'كلشي تمام، ما عدنا شي يحتاج انتباه اليوم.',
      };
    }

    return {
      ok: true,
      data: { needsAttention: brief.needsAttention, count: brief.findings.length, findings: brief.findings },
      ui: [
        {
          type: 'table',
          payload: {
            title: brief.needsAttention ? 'أمور تحتاج انتباهك اليوم' : 'وضع اليوم',
            columns: [
              { key: 'flag', label: '' },
              { key: 'text', label: 'الملاحظة' },
            ],
            rows: brief.findings.map((f) => ({
              flag: f.severity === 'attention' ? 'انتباه' : 'معلومة',
              text: f.text,
            })),
          },
        },
      ],
      suggestions: ['القيود غير المتوازنة', 'الذمم المستحقة على العملاء', 'سعر الصرف'],
      note: brief.needsAttention
        ? `عدنا ${brief.findings.filter((f) => f.severity === 'attention').length} شي يحتاج انتباه.`
        : 'وضع اليوم مستقر.',
    };
  }
}
