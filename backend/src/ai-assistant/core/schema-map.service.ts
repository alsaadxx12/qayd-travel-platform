import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface SchemaField {
  name: string;
  type: string;
  optional: boolean;
  isList: boolean;
}

export interface SchemaRelation {
  /** Field name used in Prisma queries, e.g. `ticket`. */
  name: string;
  /** Target model name, e.g. `Ticket`. */
  target: string;
  isList: boolean;
}

export type ScopeKind = 'direct' | 'tenant' | 'self' | 'parent' | 'grandparent' | 'global';

export interface SchemaModel {
  name: string;
  /** camelCase key on PrismaClient, e.g. `ticketPassenger`. */
  clientKey: string;
  fields: SchemaField[];
  relations: SchemaRelation[];
  scopeKind: ScopeKind;
  /** Relation field chain that reaches companyId, e.g. ['ticket'] or ['journalEntry']. */
  scopePath: string[];
}

/**
 * Models that legitimately hold no tenant column because the data is the same for
 * everyone (market FX snapshots, the SaaS plan catalogue). Anything else without a
 * scope path is refused rather than read unscoped.
 */
const GLOBAL_SAFE = new Set([
  'ExchangeRateSnapshot',
  'Plan',
  'PlanVersion',
  'PlanFeature',
  'PlanLimit',
  'SubscriptionEvent',
]);

/** Tables that ARE the tenant/company row: filtered by their own primary key. */
const SELF_SCOPED: Record<string, 'tenantId' | 'companyId'> = {
  Tenant: 'tenantId',
  Company: 'companyId',
};

const SCALARS = new Set([
  'String', 'Int', 'BigInt', 'Float', 'Decimal', 'Boolean', 'DateTime', 'Json', 'Bytes',
]);

/**
 * An in-memory map of the database, parsed once from schema.prisma at boot.
 *
 * Two jobs. It lets the assistant describe what data exists at all, and — more
 * importantly — it records HOW each table is isolated per company. Ten of the
 * tables here carry no companyId of their own (journal lines, ticket passengers,
 * chat messages); they are only reachable through a parent. Any generic query
 * layer that does not know those join paths will read another agency's books.
 */
@Injectable()
export class SchemaMapService implements OnModuleInit {
  private readonly logger = new Logger(SchemaMapService.name);
  private models = new Map<string, SchemaModel>();
  private loaded = false;

  onModuleInit() {
    try {
      this.load();
    } catch (err: any) {
      this.logger.error(`Failed to build schema map: ${err?.message || err}`);
    }
  }

  private schemaPath(): string | null {
    const candidates = [
      path.join(process.cwd(), 'prisma', 'schema.prisma'),
      path.join(process.cwd(), 'backend', 'prisma', 'schema.prisma'),
      path.join(__dirname, '..', '..', '..', 'prisma', 'schema.prisma'),
      path.join(__dirname, '..', '..', '..', '..', 'prisma', 'schema.prisma'),
    ];
    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) return p;
      } catch {
        /* keep looking */
      }
    }
    return null;
  }

  load() {
    const file = this.schemaPath();
    if (!file) {
      this.logger.warn('schema.prisma not found — data map unavailable');
      return;
    }
    const src = fs.readFileSync(file, 'utf8');
    const blocks = [...src.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)];

    for (const [, name, body] of blocks) {
      const fields: SchemaField[] = [];
      const relations: SchemaRelation[] = [];

      for (const rawLine of body.split('\n')) {
        const line = rawLine.trim();
        if (!line || line.startsWith('//') || line.startsWith('@@')) continue;
        const m = line.match(/^(\w+)\s+(\w+)(\[\])?(\?)?/);
        if (!m) continue;
        const [, fname, ftype, list, opt] = m;
        if (SCALARS.has(ftype)) {
          fields.push({ name: fname, type: ftype, optional: Boolean(opt), isList: Boolean(list) });
        } else if (/^[A-Z]/.test(ftype)) {
          // Enums look like relations to this regex; they are resolved below once
          // every model name is known.
          relations.push({ name: fname, target: ftype, isList: Boolean(list) });
        }
      }

      this.models.set(name, {
        name,
        clientKey: name.charAt(0).toLowerCase() + name.slice(1),
        fields,
        relations,
        scopeKind: 'global',
        scopePath: [],
      });
    }

    // Drop "relations" that actually pointed at enums, then resolve isolation.
    for (const model of this.models.values()) {
      model.relations = model.relations.filter((r) => this.models.has(r.target));
    }
    for (const model of this.models.values()) {
      const resolved = this.resolveScope(model);
      model.scopeKind = resolved.kind;
      model.scopePath = resolved.path;
    }

    this.loaded = true;
    const unscoped = [...this.models.values()].filter((m) => m.scopeKind === 'global').map((m) => m.name);
    this.logger.log(
      `Schema map ready: ${this.models.size} models, ${unscoped.length} without a company path (${unscoped.join(', ')})`,
    );
  }

  private hasCompanyId(model: SchemaModel): boolean {
    return model.fields.some((f) => f.name === 'companyId');
  }

  private hasTenantId(model: SchemaModel): boolean {
    return model.fields.some((f) => f.name === 'tenantId');
  }

  private resolveScope(model: SchemaModel): { kind: ScopeKind; path: string[] } {
    if (this.hasCompanyId(model)) return { kind: 'direct', path: [] };
    // The tenant and company rows are filtered by their own id, not by a foreign key.
    if (SELF_SCOPED[model.name]) return { kind: 'self', path: [] };
    // Subscription, usage and notification tables are isolated per tenant, not per company.
    if (this.hasTenantId(model)) return { kind: 'tenant', path: [] };

    for (const rel of model.relations) {
      if (rel.isList) continue;
      const target = this.models.get(rel.target);
      if (target && this.hasCompanyId(target)) return { kind: 'parent', path: [rel.name] };
    }
    for (const rel of model.relations) {
      if (rel.isList) continue;
      const target = this.models.get(rel.target);
      if (!target) continue;
      for (const rel2 of target.relations) {
        if (rel2.isList) continue;
        const target2 = this.models.get(rel2.target);
        if (target2 && this.hasCompanyId(target2)) {
          return { kind: 'grandparent', path: [rel.name, rel2.name] };
        }
      }
    }
    return { kind: 'global', path: [] };
  }

  isReady() {
    return this.loaded;
  }

  list(): SchemaModel[] {
    return [...this.models.values()];
  }

  get(name: string): SchemaModel | undefined {
    if (!name) return undefined;
    const exact = this.models.get(name);
    if (exact) return exact;
    const lower = name.toLowerCase();
    return [...this.models.values()].find(
      (m) => m.name.toLowerCase() === lower || m.clientKey.toLowerCase() === lower,
    );
  }

  /** True when this model may be read at all through the generic query tool. */
  isReadable(model: SchemaModel): boolean {
    return model.scopeKind !== 'global' || GLOBAL_SAFE.has(model.name);
  }

  /**
   * The company filter for a model, built from its own isolation path.
   * Returns `{}` only for the explicitly global-safe tables.
   */
  scopeWhere(model: SchemaModel, companyId: string, tenantId?: string): Record<string, any> {
    if (model.scopeKind === 'direct') return { companyId };
    if (model.scopeKind === 'self') {
      const key = SELF_SCOPED[model.name];
      const value = key === 'tenantId' ? tenantId : companyId;
      if (!value) throw new Error(`تعذّر تحديد هوية ${model.name} لهذه الجلسة`);
      return { id: value };
    }
    if (model.scopeKind === 'tenant') {
      if (!tenantId) throw new Error(`الجدول ${model.name} معزول بالمستأجر ولا يوجد مستأجر في الجلسة`);
      return { tenantId };
    }
    if (model.scopeKind === 'parent') return { [model.scopePath[0]]: { companyId } };
    if (model.scopeKind === 'grandparent') {
      return { [model.scopePath[0]]: { [model.scopePath[1]]: { companyId } } };
    }
    if (GLOBAL_SAFE.has(model.name)) return {};
    throw new Error(`الجدول ${model.name} غير معزول بالشركة ولا يُسمح بقراءته مباشرة`);
  }

  hasField(model: SchemaModel, field: string): boolean {
    return model.fields.some((f) => f.name === field);
  }

  /** Compact, model-readable description of one table or of the whole database. */
  describe(name?: string) {
    if (name) {
      const model = this.get(name);
      if (!model) return null;
      return {
        model: model.name,
        isolation: model.scopeKind,
        scopePath: model.scopePath,
        readable: this.isReadable(model),
        fields: model.fields.map((f) => `${f.name}:${f.type}${f.optional ? '?' : ''}`),
        relations: model.relations.map((r) => `${r.name}->${r.target}${r.isList ? '[]' : ''}`),
      };
    }
    return {
      count: this.models.size,
      models: this.list().map((m) => ({
        model: m.name,
        isolation: m.scopeKind,
        readable: this.isReadable(m),
        fieldCount: m.fields.length,
      })),
    };
  }
}
