import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SchemaMapService, SchemaModel } from '../core/schema-map.service';
import { AiRequestContext, AiTool, AiToolResult, AiToolProvider } from '../types/ai-tool.types';

/** Comparison operators the model may use. Anything else is dropped, not passed through. */
const ALLOWED_OPS = new Set([
  'equals', 'not', 'contains', 'startsWith', 'endsWith', 'in', 'notIn', 'gt', 'gte', 'lt', 'lte',
]);

const MAX_TAKE = 200;
const DEFAULT_TAKE = 50;
const MAX_FIELDS = 14;

/**
 * Generic, read-only access to any table in the system.
 *
 * The model never writes SQL and never names the tenant filter: it describes what it
 * wants, and the server validates every identifier against the schema map and injects
 * the company/tenant predicate itself. That inversion is the whole safety story —
 * a wrong or manipulated argument can produce an empty result, never another
 * agency's data and never a write.
 */
@Injectable()
export class DataTools implements AiToolProvider {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schema: SchemaMapService,
  ) {}

  getTools(): AiTool[] {
    return [
      {
        name: 'describeSchema',
        description:
          'اعرض خريطة قاعدة البيانات: ما هي الجداول الموجودة وما حقول جدول معيّن وعلاقاته. ' +
          'استخدمها قبل queryData إذا لم تكن متأكداً من اسم الجدول أو الحقل، أو عندما يسأل المستخدم «شنو البيانات الموجودة عندك» أو «شنو تعرف عن التذاكر». ' +
          'Describe the database map: tables, fields and relations.',
        parameters: {
          type: 'object',
          properties: {
            model: { type: 'string', description: 'اسم الجدول للتفصيل، أو اتركه فارغاً لقائمة كل الجداول' },
          },
          additionalProperties: false,
        },
        requiredPermissions: [],
        sensitivity: 'read',
        handler: (args) => this.describeSchema(args),
      },
      {
        name: 'queryData',
        description:
          'استعلام قراءة حرّ عن أي جدول في النظام عندما لا تكفي الأدوات الجاهزة. ' +
          'صف ما تريد: الجدول، الحقول، الشرط، الترتيب، العدد — ولا تكتب SQL ولا تذكر الشركة، فالخادم يضيف عزل الشركة بنفسه. ' +
          'استخدمها للأسئلة غير المغطاة بأداة مخصّصة، وبعد describeSchema إن لم تعرف الأسماء بدقة. ' +
          'Guarded read-only query over any table; company isolation is injected server-side.',
        parameters: {
          type: 'object',
          properties: {
            model: { type: 'string', description: 'اسم الجدول كما في describeSchema، مثل Ticket أو Customer' },
            fields: { type: 'array', items: { type: 'string' }, description: 'الحقول المطلوبة' },
            where: {
              type: 'object',
              description:
                'الشرط: { "status": "POSTED" } أو { "totalSell": { "gt": 100 } } أو { "customerName": { "contains": "نور" } }',
              additionalProperties: true,
            },
            orderBy: { type: 'string', description: 'حقل الترتيب' },
            orderDir: { type: 'string', enum: ['asc', 'desc'] },
            take: { type: 'number', description: `عدد الصفوف (الحد الأقصى ${MAX_TAKE})` },
          },
          required: ['model'],
          additionalProperties: false,
        },
        requiredPermissions: [],
        sensitivity: 'read',
        handler: (args, ctx) => this.queryData(args, ctx),
      },
    ];
  }

  private async describeSchema(args: any): Promise<AiToolResult> {
    if (!this.schema.isReady()) {
      return { ok: false, data: { message: 'خريطة قاعدة البيانات غير جاهزة على الخادم' } };
    }
    const name = String(args?.model || '').trim();
    const described = this.schema.describe(name || undefined);
    if (name && !described) {
      const close = this.schema
        .list()
        .filter((m) => m.name.toLowerCase().includes(name.toLowerCase()))
        .map((m) => m.name)
        .slice(0, 6);
      return {
        ok: false,
        data: { found: false, message: `لا يوجد جدول باسم «${name}».`, suggestions: close },
        note: close.length ? `هل تقصد: ${close.join('، ')}؟` : `لا يوجد جدول باسم «${name}».`,
      };
    }
    return {
      ok: true,
      data: described,
      note: name ? `بنية جدول ${name}.` : `قاعدة البيانات تحتوي ${(described as any).count} جدولاً.`,
    };
  }

  /** Keeps only fields that exist on the model, capped so payloads stay small. */
  private pickFields(model: SchemaModel, requested?: any): Record<string, boolean> {
    const asked = Array.isArray(requested) ? requested.map(String) : [];
    const valid = asked.filter((f) => this.schema.hasField(model, f));
    const chosen = valid.length
      ? valid.slice(0, MAX_FIELDS)
      : model.fields
          .filter((f) => f.type !== 'Json' && f.type !== 'Bytes')
          .slice(0, 10)
          .map((f) => f.name);
    const select: Record<string, boolean> = {};
    for (const f of chosen) select[f] = true;
    if (!select.id && this.schema.hasField(model, 'id')) select.id = true;
    return select;
  }

  /** Drops any key that is not a real scalar field and any operator not allow-listed. */
  private sanitizeWhere(model: SchemaModel, raw: any): Record<string, any> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out: Record<string, any> = {};

    for (const [key, value] of Object.entries(raw)) {
      if (!this.schema.hasField(model, key)) continue;

      if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
        out[key] = value;
        continue;
      }
      if (Array.isArray(value)) {
        out[key] = { in: value.slice(0, 50) };
        continue;
      }
      if (typeof value === 'object') {
        const cond: Record<string, any> = {};
        for (const [op, opValue] of Object.entries(value as Record<string, any>)) {
          if (!ALLOWED_OPS.has(op)) continue;
          if (op === 'contains' || op === 'startsWith' || op === 'endsWith') {
            cond[op] = String(opValue);
            cond.mode = 'insensitive';
          } else if (op === 'in' || op === 'notIn') {
            cond[op] = Array.isArray(opValue) ? opValue.slice(0, 50) : [opValue];
          } else {
            cond[op] = opValue;
          }
        }
        if (Object.keys(cond).length) out[key] = cond;
      }
    }
    return out;
  }

  private async queryData(args: any, ctx: AiRequestContext): Promise<AiToolResult> {
    if (!this.schema.isReady()) {
      return { ok: false, data: { message: 'خريطة قاعدة البيانات غير جاهزة على الخادم' } };
    }

    const model = this.schema.get(String(args?.model || ''));
    if (!model) {
      return {
        ok: false,
        data: { found: false, message: `لا أعرف جدولاً باسم «${args?.model}». استخدم describeSchema أولاً.` },
        note: 'اسم جدول غير معروف.',
      };
    }
    if (!this.schema.isReadable(model)) {
      return {
        ok: false,
        data: { message: `الجدول ${model.name} غير متاح للقراءة العامة.` },
        note: `الجدول ${model.name} غير متاح للقراءة العامة.`,
      };
    }

    let scope: Record<string, any>;
    try {
      scope = this.schema.scopeWhere(model, ctx.companyId, ctx.tenantId);
    } catch (err: any) {
      return { ok: false, data: { message: err?.message || 'تعذّر تحديد عزل البيانات' }, note: err?.message };
    }

    const select = this.pickFields(model, args?.fields);
    const where = { AND: [scope, this.sanitizeWhere(model, args?.where)] };
    const take = Math.max(1, Math.min(Number(args?.take) || DEFAULT_TAKE, MAX_TAKE));

    const orderField = String(args?.orderBy || '').trim();
    const orderBy =
      orderField && this.schema.hasField(model, orderField)
        ? { [orderField]: args?.orderDir === 'asc' ? 'asc' : 'desc' }
        : this.schema.hasField(model, 'createdAt')
          ? { createdAt: 'desc' as const }
          : undefined;

    const client: any = (this.prisma as any)[model.clientKey];
    if (!client?.findMany) {
      return { ok: false, data: { message: `تعذّر الوصول إلى ${model.name}` }, note: 'جدول غير متاح' };
    }

    let rows: any[] = [];
    let total = 0;
    try {
      [rows, total] = await Promise.all([
        client.findMany({ where, select, orderBy, take }),
        client.count({ where }),
      ]);
    } catch (err: any) {
      return {
        ok: false,
        data: { message: `تعذّر تنفيذ الاستعلام على ${model.name}: ${err?.message || err}` },
        note: `تعذّر تنفيذ الاستعلام على ${model.name}.`,
      };
    }

    if (!rows.length) {
      return {
        ok: true,
        data: { found: false, model: model.name, count: 0, message: `لا توجد سجلات مطابقة في ${model.name}.` },
        note: `لا توجد سجلات مطابقة في ${model.name}.`,
      };
    }

    const columns = Object.keys(select).map((key) => ({ key, label: key }));
    const view = rows.map((row) => {
      const out: Record<string, any> = {};
      for (const key of Object.keys(select)) {
        const v = row[key];
        out[key] =
          v === null || v === undefined
            ? '—'
            : v instanceof Date
              ? v.toLocaleDateString('en-GB')
              : typeof v === 'object'
                ? String(v)
                : v;
      }
      return out;
    });

    return {
      ok: true,
      data: {
        found: true,
        model: model.name,
        isolation: model.scopeKind,
        count: total,
        returned: rows.length,
        rows: view.slice(0, 20),
      },
      ui: [
        {
          type: 'table',
          payload: { title: `${model.name} — ${total.toLocaleString('en-US')} سجل`, columns, rows: view, totalCount: total },
        },
      ],
      note: `وجدت ${total.toLocaleString('en-US')} سجلاً في ${model.name}، أعرض ${rows.length}.`,
    };
  }
}
