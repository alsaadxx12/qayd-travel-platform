import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MicroCache } from '../common/micro-cache';
import { Prisma, TenantRole, TenantStatus } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsIn,
  IsEnum,
  ValidateIf,
  IsArray,
  IsInt,
  Min,
  IsDateString,
} from 'class-validator';

export class UpdateOwnerPermissionsDto {
  @IsArray()
  @IsString({ each: true })
  customPermissions: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedBranchIds?: string[];
}

export class UpdateDatabaseProviderSettingsDto {
  @IsString()
  @IsNotEmpty()
  providerName: string;

  @IsString()
  @IsNotEmpty()
  planName: string;

  @IsInt()
  @Min(1)
  capacityBytes: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  storageCapacityBytes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  egressCapacityBytes?: number;

  @IsInt()
  @Min(0)
  invoiceAmountCents: number;

  @IsInt()
  @Min(0)
  paidAmountCents: number;

  @IsString()
  @IsIn(['USD', 'IQD'])
  currency: string;

  @IsDateString()
  billingPeriodStart: string;

  @IsDateString()
  billingPeriodEnd: string;
}

export class UpdateTenantDatabaseQuotaDto {
  @ValidateIf((value) => value.databaseQuotaBytes !== null)
  @IsInt()
  @Min(1)
  databaseQuotaBytes: number | null;
}

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  legalName?: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @ValidateIf((o) => o.email !== '' && o.email != null)
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  baseCurrency?: string;

  @IsString()
  @IsIn(['FREE_TRIAL', 'BASIC', 'PRO', 'ENTERPRISE'])
  planCode: 'FREE_TRIAL' | 'BASIC' | 'PRO' | 'ENTERPRISE';

  @IsString()
  @IsNotEmpty()
  ownerName: string;

  @IsEmail()
  @IsNotEmpty()
  ownerEmail: string;

  @IsString()
  @IsOptional()
  ownerPassword?: string;

  @IsString()
  @IsOptional()
  ownerPhone?: string;
}

export class UpdateTenantDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  legalName?: string;

  @IsString()
  @IsOptional()
  logo?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @ValidateIf((o) => o.email !== '' && o.email != null)
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsString()
  @IsOptional()
  baseCurrency?: string;

  @IsEnum(TenantStatus)
  @IsOptional()
  status?: TenantStatus;

  @IsString()
  @IsOptional()
  customSettings?: string;
}

type SupabaseManagementUsageSnapshot = {
  configured: boolean;
  connected: boolean;
  projectRef: string | null;
  projectName: string | null;
  projectStatus: string | null;
  measuredAt: string;
  interval: '1day';
  apiRequests: {
    auth: number;
    rest: number;
    storage: number;
    realtime: number;
    total: number;
  } | null;
  edgeFunctions: {
    deployed: number;
    active: number;
  } | null;
  billingEgressAvailable: false;
  source: 'SUPABASE_MANAGEMENT_API' | 'NOT_CONFIGURED' | 'CONNECTION_FAILED';
  error: string | null;
};

@Injectable()
export class TenantsService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  /**
   * `/tenants/current` is requested on nearly every screen, and the query behind it
   * is deep: the tenant, its five newest subscriptions, each with its plan version,
   * features, limits and five payments, plus every membership with its user, plus
   * every branch — then a usage roll-up on top. Against the hosted database that is
   * the 1.9s call seen in the network panel.
   *
   * None of that changes minute to minute, so the assembled result is held briefly.
   * The TTL is deliberately short: any plan or branch change shows up within it, and
   * writes that go through this service clear it outright.
   */
  private tenantCache = new MicroCache(60_000, 2000, { refreshAhead: true });

  public invalidateTenantCache() {
    this.tenantCache.invalidate();
  }

  private async fetchSupabaseManagementUsage(): Promise<SupabaseManagementUsageSnapshot> {
    const token = process.env.SUPABASE_MANAGEMENT_API_TOKEN?.trim();
    const projectRef = process.env.SUPABASE_PROJECT_REF?.trim();
    const measuredAt = new Date().toISOString();

    if (!token || !projectRef) {
      return {
        configured: false,
        connected: false,
        projectRef: projectRef || null,
        projectName: null,
        projectStatus: null,
        measuredAt,
        interval: '1day',
        apiRequests: null,
        edgeFunctions: null,
        billingEgressAvailable: false,
        source: 'NOT_CONFIGURED',
        error: 'Supabase Management API is not configured',
      };
    }

    const requestJson = async <T>(path: string): Promise<T> => {
      const response = await fetch(`https://api.supabase.com${path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        throw new Error(`Supabase Management API returned ${response.status}`);
      }
      return response.json() as Promise<T>;
    };

    try {
      const [project, apiUsage, edgeFunctions] = await Promise.all([
        requestJson<{ id?: string; name?: string; status?: string }>(`/v1/projects/${projectRef}`),
        requestJson<{
          result?: Array<{
            total_auth_requests?: number;
            total_realtime_requests?: number;
            total_rest_requests?: number;
            total_storage_requests?: number;
          }>;
        }>(`/v1/projects/${projectRef}/analytics/endpoints/usage.api-counts?interval=1day`),
        requestJson<Array<{ status?: string }>>(`/v1/projects/${projectRef}/functions`),
      ]);

      const requests = (Array.isArray(apiUsage.result) ? apiUsage.result : []).reduce(
        (totals, point) => {
          totals.auth += Number(point.total_auth_requests || 0);
          totals.rest += Number(point.total_rest_requests || 0);
          totals.storage += Number(point.total_storage_requests || 0);
          totals.realtime += Number(point.total_realtime_requests || 0);
          return totals;
        },
        { auth: 0, rest: 0, storage: 0, realtime: 0 },
      );
      const deployedFunctions = Array.isArray(edgeFunctions) ? edgeFunctions.length : 0;

      return {
        configured: true,
        connected: true,
        projectRef,
        projectName: project.name || null,
        projectStatus: project.status || null,
        measuredAt,
        interval: '1day',
        apiRequests: {
          ...requests,
          total: requests.auth + requests.rest + requests.storage + requests.realtime,
        },
        edgeFunctions: {
          deployed: deployedFunctions,
          active: edgeFunctions.filter((item) => item.status === 'ACTIVE').length,
        },
        billingEgressAvailable: false,
        source: 'SUPABASE_MANAGEMENT_API',
        error: null,
      };
    } catch (error) {
      return {
        configured: true,
        connected: false,
        projectRef,
        projectName: null,
        projectStatus: null,
        measuredAt,
        interval: '1day',
        apiRequests: null,
        edgeFunctions: null,
        billingEgressAvailable: false,
        source: 'CONNECTION_FAILED',
        error: error instanceof Error ? error.message : 'Supabase Management API request failed',
      };
    }
  }

  async getAllTenants(search?: string, status?: TenantStatus) {
    const currentMonthStart = new Date();
    currentMonthStart.setUTCDate(1);
    currentMonthStart.setUTCHours(0, 0, 0, 0);

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { legalName: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const tenants = await this.prisma.tenant.findMany({
      where,
      orderBy: [{ isRoot: 'desc' }, { createdAt: 'desc' }],
      include: {
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            planVersion: {
              include: { plan: true },
            },
          },
        },
        memberships: {
          include: {
            user: {
              select: { id: true, name: true, email: true, phone: true, isActive: true },
            },
          },
        },
        subscriptionPayments: {
          where: {
            status: 'COMPLETED',
            paidAt: { gte: currentMonthStart },
          },
          select: {
            amountCents: true,
            currency: true,
          },
        },
        _count: {
          select: {
            memberships: true,
            branches: true,
            accounts: true,
            tickets: true,
          },
        },
      },
    });

    return tenants.map((t) => {
      const activeSub = t.subscriptions[0];
      let platformOwnerUserId: string | undefined;
      if (t.isRoot && t.customSettings) {
        try {
          const settings = JSON.parse(t.customSettings);
          if (typeof settings?.platformOwnerUserId === 'string') {
            platformOwnerUserId = settings.platformOwnerUserId;
          }
        } catch {}
      }

      const ownerMembership =
        t.memberships.find(
          (m) => m.isActive && platformOwnerUserId && m.userId === platformOwnerUserId,
        ) ||
        t.memberships.find((m) => m.isActive && m.role === 'OWNER' && m.isPrimary) ||
        t.memberships.find((m) => m.isActive && m.role === 'OWNER') ||
        t.memberships.find((m) => m.isActive) ||
        t.memberships[0];
      const ownerUser = ownerMembership?.user;
      const collectedPaymentsThisMonth = t.subscriptionPayments.reduce(
        (totals, payment) => {
          const currency = payment.currency?.toUpperCase();
          if (currency === 'IQD') {
            totals.IQD += payment.amountCents / 100;
          } else if (currency === 'USD') {
            totals.USD += payment.amountCents / 100;
          }
          return totals;
        },
        { USD: 0, IQD: 0 },
      );

      let parsedOwnerPerms: string[] = ['*'];
      if (ownerMembership?.customPermissions) {
        try {
          const raw = ownerMembership.customPermissions;
          if (typeof raw === 'string') {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              parsedOwnerPerms = parsed;
            }
          } else if (Array.isArray(raw)) {
            parsedOwnerPerms = raw;
          }
        } catch {
          parsedOwnerPerms = ['*'];
        }
      }

      return {
        id: t.id,
        name: t.name,
        legalName: t.legalName,
        slug: t.slug,
        logo: t.logo,
        phone: t.phone,
        email: t.email,
        city: t.city,
        country: t.country,
        baseCurrency: t.baseCurrency,
        status: t.status,
        isRoot: t.isRoot,
        createdAt: t.createdAt,
        currentPlan: t.isRoot ? 'بلا حدود' : activeSub?.planVersion?.plan?.nameAr || 'غير محدد',
        currentPlanCode: t.isRoot ? 'PLATFORM' : activeSub?.planVersion?.plan?.code || 'NONE',
        currentPriceMonthly: t.isRoot ? 0 : activeSub ? activeSub.lockedPriceCents / 100 : 0,
        subscriptionStatus: t.isRoot ? 'ACTIVE' : activeSub?.status || t.status,
        currentPeriodEnd: t.isRoot ? null : activeSub?.currentPeriodEnd,
        collectedPaymentsThisMonth: t.isRoot ? { USD: 0, IQD: 0 } : collectedPaymentsThisMonth,
        ownerPermissions: parsedOwnerPerms,
        allowedBranchIds: ownerMembership?.allowedBranchIds || [],
        owner: ownerUser
          ? {
              id: ownerUser.id,
              name: ownerUser.name,
              email: ownerUser.email,
              phone: ownerUser.phone,
            }
          : null,
        stats: {
          usersCount: t._count.memberships,
          branchesCount: t._count.branches,
          accountsCount: t._count.accounts,
          ticketsCount: t._count.tickets,
        },
      };
    });
  }

  async getAllTenantDatabaseUsage(requester: {
    tenantId?: string;
    companyId?: string;
    userId?: string;
  }, options: { refreshProviderUsage?: boolean } = {}) {
    await this.assertRootTenantAccess(requester);

    const currentMonthStart = new Date();
    currentMonthStart.setUTCDate(1);
    currentMonthStart.setUTCHours(0, 0, 0, 0);

    type ColumnMetadata = { tableName: string; columnName: string };
    type ForeignKeyMetadata = {
      childTable: string;
      childColumn: string;
      parentTable: string;
      parentColumn: string;
    };
    type ScopedAggregate = {
      tableName: string;
      tenantId: string;
      recordCount: bigint;
      dataBytes: bigint;
    };
    type AttachmentAggregate = {
      tenantId: string;
      fileCount: bigint;
      fileBytes: bigint;
    };
    type AttachmentTypeAggregate = {
      tenantId: string;
      fileType: string;
      fileCount: bigint;
      fileBytes: bigint;
    };
    type DatabaseSizeAggregate = { physicalBytes: bigint };
    type TableSizeAggregate = {
      tableName: string;
      totalBytes: bigint;
      indexBytes: bigint;
    };

    const [
      tenants,
      columns,
      foreignKeys,
      attachmentTotals,
      attachmentTypeTotals,
      databaseSizeResult,
      tableSizeTotals,
    ] = await Promise.all([
      this.prisma.tenant.findMany({
        orderBy: [{ isRoot: 'desc' }, { createdAt: 'desc' }],
        include: {
          companies: { select: { id: true, name: true } },
          memberships: {
            include: {
              user: {
                select: { id: true, name: true, email: true, phone: true },
              },
            },
          },
          subscriptions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              planVersion: { include: { plan: true } },
              payments: { orderBy: { paidAt: 'desc' } },
            },
          },
          subscriptionPayments: {
            where: {
              status: 'COMPLETED',
              paidAt: { gte: currentMonthStart },
            },
            select: { amountCents: true, currency: true, paidAt: true },
          },
        },
      }),
      this.prisma.$queryRaw<ColumnMetadata[]>(Prisma.sql`
        SELECT c.table_name AS "tableName", c.column_name AS "columnName"
        FROM information_schema.columns c
        INNER JOIN information_schema.tables t
          ON t.table_schema = c.table_schema
         AND t.table_name = c.table_name
        WHERE c.table_schema = current_schema()
          AND t.table_type = 'BASE TABLE'
          AND c.table_name <> '_prisma_migrations'
        ORDER BY c.table_name, c.ordinal_position
      `),
      this.prisma.$queryRaw<ForeignKeyMetadata[]>(Prisma.sql`
        SELECT
          tc.table_name AS "childTable",
          kcu.column_name AS "childColumn",
          ccu.table_name AS "parentTable",
          ccu.column_name AS "parentColumn"
        FROM information_schema.table_constraints tc
        INNER JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.constraint_schema = kcu.constraint_schema
        INNER JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
         AND ccu.constraint_schema = tc.constraint_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = current_schema()
        ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position
      `),
      this.prisma.$queryRaw<AttachmentAggregate[]>(Prisma.sql`
        SELECT
          COALESCE(a.tenant_id, c.tenant_id) AS "tenantId",
          COUNT(*)::bigint AS "fileCount",
          COALESCE(SUM(COALESCE(a.size, 0)), 0)::bigint AS "fileBytes"
        FROM attachments a
        LEFT JOIN companies c ON c.id = a."companyId"
        WHERE COALESCE(a.tenant_id, c.tenant_id) IS NOT NULL
        GROUP BY COALESCE(a.tenant_id, c.tenant_id)
      `),
      this.prisma.$queryRaw<AttachmentTypeAggregate[]>(Prisma.sql`
        SELECT
          COALESCE(a.tenant_id, c.tenant_id) AS "tenantId",
          CASE
            WHEN LOWER(COALESCE(a."mimeType", '')) LIKE 'image/%' THEN 'IMAGES'
            WHEN LOWER(COALESCE(a."mimeType", '')) = 'application/pdf' THEN 'PDF'
            WHEN LOWER(COALESCE(a."mimeType", '')) LIKE '%word%'
              OR LOWER(COALESCE(a."mimeType", '')) LIKE '%document%'
              OR LOWER(COALESCE(a."mimeType", '')) LIKE '%sheet%'
              OR LOWER(COALESCE(a."mimeType", '')) LIKE '%excel%' THEN 'DOCUMENTS'
            ELSE 'OTHER'
          END AS "fileType",
          COUNT(*)::bigint AS "fileCount",
          COALESCE(SUM(COALESCE(a.size, 0)), 0)::bigint AS "fileBytes"
        FROM attachments a
        LEFT JOIN companies c ON c.id = a."companyId"
        WHERE COALESCE(a.tenant_id, c.tenant_id) IS NOT NULL
        GROUP BY COALESCE(a.tenant_id, c.tenant_id), "fileType"
      `),
      this.prisma.$queryRaw<DatabaseSizeAggregate[]>(Prisma.sql`
        SELECT pg_database_size(current_database())::bigint AS "physicalBytes"
      `),
      this.prisma.$queryRaw<TableSizeAggregate[]>(Prisma.sql`
        SELECT
          c.relname::text AS "tableName",
          pg_total_relation_size(c.oid)::bigint AS "totalBytes",
          pg_indexes_size(c.oid)::bigint AS "indexBytes"
        FROM pg_class c
        INNER JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = current_schema()
          AND c.relkind = 'r'
      `),
    ]);

    let storageUsage: { usedBytes: number; objectCount: number; source: string } | null = null;
    try {
      const storageResult = await this.prisma.$queryRaw<Array<{ usedBytes: bigint; objectCount: bigint }>>(Prisma.sql`
        SELECT
          COALESCE(SUM(COALESCE((metadata ->> 'size')::bigint, 0)), 0)::bigint AS "usedBytes",
          COUNT(*)::bigint AS "objectCount"
        FROM storage.objects
      `);
      storageUsage = {
        usedBytes: Number(storageResult[0]?.usedBytes || 0),
        objectCount: Number(storageResult[0]?.objectCount || 0),
        source: 'SUPABASE_STORAGE_OBJECTS',
      };
    } catch {
      storageUsage = null;
    }

    const columnsByTable = new Map<string, Set<string>>();
    for (const column of columns) {
      const tableColumns = columnsByTable.get(column.tableName) || new Set<string>();
      tableColumns.add(column.columnName);
      columnsByTable.set(column.tableName, tableColumns);
    }

    const foreignKeysByChild = new Map<string, ForeignKeyMetadata[]>();
    for (const foreignKey of foreignKeys) {
      const tableForeignKeys = foreignKeysByChild.get(foreignKey.childTable) || [];
      tableForeignKeys.push(foreignKey);
      foreignKeysByChild.set(foreignKey.childTable, tableForeignKeys);
    }

    const tenantColumnNames = ['tenant_id', 'tenantId'];
    const companyColumnNames = ['company_id', 'companyId'];
    const findColumn = (tableName: string, candidates: string[]) => {
      const tableColumns = columnsByTable.get(tableName);
      return candidates.find((candidate) => tableColumns?.has(candidate));
    };
    const hasDirectScope = (tableName: string) =>
      tableName === 'tenants' ||
      Boolean(findColumn(tableName, tenantColumnNames)) ||
      Boolean(findColumn(tableName, companyColumnNames));

    const quoteIdentifier = (value: string) => {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
        throw new BadRequestException('تعذر قياس قاعدة البيانات بسبب اسم جدول غير صالح');
      }
      return `"${value}"`;
    };

    const findScopePath = (startTable: string) => {
      const queue: { tableName: string; path: ForeignKeyMetadata[] }[] = [
        { tableName: startTable, path: [] },
      ];
      const visited = new Set<string>();

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current.tableName)) continue;
        visited.add(current.tableName);

        if (hasDirectScope(current.tableName)) {
          return { anchorTable: current.tableName, path: current.path };
        }

        if (current.path.length >= 8) continue;
        for (const foreignKey of foreignKeysByChild.get(current.tableName) || []) {
          if (!columnsByTable.has(foreignKey.parentTable)) continue;
          queue.push({
            tableName: foreignKey.parentTable,
            path: [...current.path, foreignKey],
          });
        }
      }

      return null;
    };

    const scopedQueries: string[] = [];
    for (const tableName of [...columnsByTable.keys()].sort()) {
      const scopePath = findScopePath(tableName);
      if (!scopePath) continue;

      const joins: string[] = [];
      scopePath.path.forEach((foreignKey, index) => {
        joins.push(
          `INNER JOIN ${quoteIdentifier(foreignKey.parentTable)} a${index + 1} ` +
          `ON a${index}.${quoteIdentifier(foreignKey.childColumn)} = ` +
          `a${index + 1}.${quoteIdentifier(foreignKey.parentColumn)}`,
        );
      });

      const anchorAlias = `a${scopePath.path.length}`;
      let tenantExpression: string;
      if (scopePath.anchorTable === 'tenants') {
        tenantExpression = `${anchorAlias}."id"::text`;
      } else {
        const tenantColumn = findColumn(scopePath.anchorTable, tenantColumnNames);
        const companyColumn = findColumn(scopePath.anchorTable, companyColumnNames);

        if (companyColumn) {
          joins.push(
            `LEFT JOIN "companies" scope_company ` +
            `ON scope_company."id" = ${anchorAlias}.${quoteIdentifier(companyColumn)}`,
          );
        }

        if (tenantColumn && companyColumn) {
          tenantExpression =
            `COALESCE(${anchorAlias}.${quoteIdentifier(tenantColumn)}::text, ` +
            `scope_company."tenant_id"::text)`;
        } else if (tenantColumn) {
          tenantExpression = `${anchorAlias}.${quoteIdentifier(tenantColumn)}::text`;
        } else {
          tenantExpression = `scope_company."tenant_id"::text`;
        }
      }

      const tableLiteral = tableName.replace(/'/g, "''");
      scopedQueries.push(`
        SELECT
          '${tableLiteral}'::text AS "tableName",
          ${tenantExpression} AS "tenantId",
          COUNT(*)::bigint AS "recordCount",
          COALESCE(SUM(pg_column_size(a0)), 0)::bigint AS "dataBytes"
        FROM ${quoteIdentifier(tableName)} a0
        ${joins.join('\n')}
        WHERE ${tenantExpression} IS NOT NULL
        GROUP BY ${tenantExpression}
      `);
    }

    const scopedAggregates = scopedQueries.length > 0
      ? await this.prisma.$queryRaw<ScopedAggregate[]>(
          Prisma.sql`${Prisma.raw(scopedQueries.join('\nUNION ALL\n'))}`,
        )
      : [];

    const attachmentByTenant = new Map(
      attachmentTotals.map((item) => [
        item.tenantId,
        { fileCount: Number(item.fileCount), fileBytes: Number(item.fileBytes) },
      ]),
    );
    const attachmentTypesByTenant = new Map<string, Array<{ fileType: string; fileCount: number; fileBytes: number }>>();
    for (const item of attachmentTypeTotals) {
      const values = attachmentTypesByTenant.get(item.tenantId) || [];
      values.push({
        fileType: item.fileType,
        fileCount: Number(item.fileCount),
        fileBytes: Number(item.fileBytes),
      });
      attachmentTypesByTenant.set(item.tenantId, values);
    }
    const physicalTableSizes = new Map(
      tableSizeTotals.map((item) => [
        item.tableName,
        { totalBytes: Number(item.totalBytes), indexBytes: Number(item.indexBytes) },
      ]),
    );
    const logicalBytesByTable = new Map<string, number>();
    const databaseByTenant = new Map<
      string,
      { databaseBytes: number; recordCount: number; tables: Map<string, { bytes: number; records: number }> }
    >();

    for (const aggregate of scopedAggregates) {
      const tenantUsage = databaseByTenant.get(aggregate.tenantId) || {
        databaseBytes: 0,
        recordCount: 0,
        tables: new Map<string, { bytes: number; records: number }>(),
      };
      const bytes = Number(aggregate.dataBytes);
      const records = Number(aggregate.recordCount);
      logicalBytesByTable.set(
        aggregate.tableName,
        (logicalBytesByTable.get(aggregate.tableName) || 0) + bytes,
      );
      tenantUsage.databaseBytes += bytes;
      tenantUsage.recordCount += records;
      tenantUsage.tables.set(aggregate.tableName, { bytes, records });
      databaseByTenant.set(aggregate.tenantId, tenantUsage);
    }

    const measuredAt = new Date().toISOString();
    const rootTenant = tenants.find((tenant) => tenant.isRoot);
    let rootSettings: Record<string, any> = {};
    if (rootTenant?.customSettings) {
      try {
        rootSettings = JSON.parse(rootTenant.customSettings);
      } catch {}
    }
    const cachedManagementUsage = rootSettings.supabaseManagementUsage as
      | SupabaseManagementUsageSnapshot
      | undefined;
    const managementUsage = options.refreshProviderUsage
      ? await this.fetchSupabaseManagementUsage()
      : cachedManagementUsage || {
          configured: Boolean(
            process.env.SUPABASE_MANAGEMENT_API_TOKEN && process.env.SUPABASE_PROJECT_REF,
          ),
          connected: false,
          projectRef: process.env.SUPABASE_PROJECT_REF || null,
          projectName: null,
          projectStatus: null,
          measuredAt,
          interval: '1day' as const,
          apiRequests: null,
          edgeFunctions: null,
          billingEgressAvailable: false as const,
          source: process.env.SUPABASE_MANAGEMENT_API_TOKEN && process.env.SUPABASE_PROJECT_REF
            ? 'CONNECTION_FAILED' as const
            : 'NOT_CONFIGURED' as const,
          error: null,
        };

    const tenantUsage = tenants.map((tenant) => {
      const ownerMembership =
        tenant.memberships.find((membership) => membership.role === 'OWNER') ||
        tenant.memberships[0];
      const database = databaseByTenant.get(tenant.id) || {
        databaseBytes: 0,
        recordCount: 0,
        tables: new Map<string, { bytes: number; records: number }>(),
      };
      const attachments = attachmentByTenant.get(tenant.id) || { fileCount: 0, fileBytes: 0 };
      const largestTables = [...database.tables.entries()]
        .map(([tableName, values]) => {
          const tablePhysical = physicalTableSizes.get(tableName);
          const totalLogicalBytes = logicalBytesByTable.get(tableName) || 0;
          const share = totalLogicalBytes > 0 ? values.bytes / totalLogicalBytes : 0;
          return {
            tableName,
            ...values,
            estimatedIndexBytes: tablePhysical
              ? Math.round(tablePhysical.indexBytes * share)
              : null,
            indexMeasurement: tablePhysical ? 'PROPORTIONAL_ESTIMATE' : 'UNAVAILABLE',
          };
        })
        .sort((a, b) => b.bytes - a.bytes)
        .slice(0, 10);
      const subscription = tenant.subscriptions[0];
      const periodStart = subscription?.currentPeriodStart
        ? new Date(subscription.currentPeriodStart)
        : null;
      const periodEnd = subscription?.currentPeriodEnd
        ? new Date(subscription.currentPeriodEnd)
        : null;
      const currentPeriodPayments = (subscription?.payments || []).filter((payment) => {
        const paidAt = new Date(payment.paidAt);
        return (!periodStart || paidAt >= periodStart) && (!periodEnd || paidAt <= periodEnd);
      });
      const paidCents = currentPeriodPayments
        .filter((payment) => payment.status === 'COMPLETED')
        .reduce((sum, payment) => sum + payment.amountCents, 0);
      const pendingCents = currentPeriodPayments
        .filter((payment) => payment.status === 'PENDING')
        .reduce((sum, payment) => sum + payment.amountCents, 0);
      const isBillable =
        !tenant.isRoot &&
        Boolean(subscription) &&
        !['CANCELLED', 'EXPIRED'].includes(subscription!.status) &&
        subscription!.lockedPriceCents > 0;
      const invoiceAmountCents = isBillable ? subscription!.lockedPriceCents : 0;
      const amountDueCents = Math.max(invoiceAmountCents - paidCents, 0);
      const monthlyRevenueByCurrency = tenant.subscriptionPayments.reduce<Record<string, number>>(
        (totals, payment) => {
          const currency = String(payment.currency || 'USD').toUpperCase();
          totals[currency] = (totals[currency] || 0) + payment.amountCents;
          return totals;
        },
        {},
      );
      let tenantSettings: Record<string, any> = {};
      if (tenant.customSettings) {
        try {
          tenantSettings = JSON.parse(tenant.customSettings);
        } catch {}
      }
      const databaseQuotaBytes = tenant.isRoot
        ? null
        : Number.isFinite(tenantSettings.databaseQuotaBytes) && tenantSettings.databaseQuotaBytes > 0
          ? Number(tenantSettings.databaseQuotaBytes)
          : null;
      const quotaUsagePercent = databaseQuotaBytes
        ? Math.round((database.databaseBytes / databaseQuotaBytes) * 10000) / 100
        : null;
      const usageStatus = tenant.isRoot
        ? 'UNLIMITED'
        : quotaUsagePercent === null
          ? 'UNCONFIGURED'
          : quotaUsagePercent >= 100
            ? 'OVER_LIMIT'
            : quotaUsagePercent >= 95
              ? 'CRITICAL'
              : quotaUsagePercent >= 85
                ? 'NEAR_LIMIT'
                : quotaUsagePercent >= 70
                  ? 'WATCH'
                  : 'NORMAL';

      return {
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        isRoot: tenant.isRoot,
        companyCount: tenant.companies.length,
        owner: ownerMembership?.user
          ? {
              id: ownerMembership.user.id,
              name: ownerMembership.user.name,
              email: ownerMembership.user.email,
              phone: ownerMembership.user.phone,
            }
          : null,
        databaseBytes: database.databaseBytes,
        recordCount: database.recordCount,
        measuredTableCount: database.tables.size,
        attachmentBytes: attachments.fileBytes,
        attachmentCount: attachments.fileCount,
        attachmentTypes: attachmentTypesByTenant.get(tenant.id) || [],
        largestTables,
        activeUserCount: tenant.memberships.filter((membership) => membership.isActive).length,
        databaseQuotaBytes,
        quotaUsagePercent,
        usageStatus,
        monthlyGrowthBytes: null as number | null,
        monthlyGrowthPercent: null as number | null,
        estimatedProviderCostCents: 0,
        costCurrency: 'USD',
        monthlyRevenueByCurrency,
        billing: {
          planName: tenant.isRoot ? 'بلا حدود' : subscription?.planVersion?.plan?.nameAr || 'غير محدد',
          status: tenant.isRoot ? 'ACTIVE' : subscription?.status || 'NONE',
          billingCycle: tenant.isRoot ? null : subscription?.billingCycle || null,
          currency: subscription?.currency || 'USD',
          periodStart: tenant.isRoot ? null : subscription?.currentPeriodStart || null,
          periodEnd: tenant.isRoot ? null : subscription?.currentPeriodEnd || null,
          invoiceAmountCents,
          paidCents,
          pendingCents,
          amountDueCents,
        },
      };
    }).sort((a, b) => b.databaseBytes - a.databaseBytes);
    let databaseProviderSettings: {
      providerName: string;
      planName: string;
      capacityBytes: number;
      storageCapacityBytes?: number;
      egressCapacityBytes?: number;
      egressUsedBytes?: number | null;
      invoiceAmountCents: number;
      paidAmountCents: number;
      currency: string;
      billingPeriodStart: string;
      billingPeriodEnd: string;
      updatedAt?: string;
    } | null = null;

    const configuredProvider = rootSettings?.databaseProvider;
    if (
      configuredProvider &&
      Number.isFinite(configuredProvider.capacityBytes) &&
      configuredProvider.capacityBytes > 0 &&
      Number.isFinite(configuredProvider.invoiceAmountCents) &&
      Number.isFinite(configuredProvider.paidAmountCents)
    ) {
      databaseProviderSettings = configuredProvider;
    }

    const physicalBytes = Number(databaseSizeResult[0]?.physicalBytes || 0);
    // Supabase guarantees at least the Free database-size quota for every hosted project.
    // Until the actual paid allocation is configured, expose this only as a lower bound.
    const supabaseMinimumCapacityBytes = 500 * 1024 * 1024;
    const hasExactProviderCapacity = Boolean(databaseProviderSettings?.capacityBytes);
    const providerCapacityBytes = databaseProviderSettings?.capacityBytes
      ?? supabaseMinimumCapacityBytes;
    const providerAvailableBytes = Math.max(providerCapacityBytes - physicalBytes, 0);
    const providerInvoiceDueCents = databaseProviderSettings
      ? Math.max(
          databaseProviderSettings.invoiceAmountCents - databaseProviderSettings.paidAmountCents,
          0,
        )
      : null;
    const storageCapacityBytes = databaseProviderSettings?.storageCapacityBytes || null;
    const egressCapacityBytes = databaseProviderSettings?.egressCapacityBytes || null;
    // Unified billing egress is organization-scoped and is not exposed by the
    // public project Management API. Do not substitute host network counters.
    const egressUsedBytes = null;
    const storageUsedBytes = storageUsage?.usedBytes ?? null;

    const storedHistory = (Array.isArray(rootSettings.databaseUsageHistory)
      ? rootSettings.databaseUsageHistory
      : [])
      .filter((snapshot: any) => snapshot && typeof snapshot.measuredAt === 'string')
      .slice(-399);
    const currentSnapshot = {
      id: `live-${Date.now()}`,
      measuredAt,
      databasePhysicalBytes: physicalBytes,
      databaseLogicalBytes: tenantUsage.reduce((sum, item) => sum + item.databaseBytes, 0),
      storageBytes: storageUsedBytes,
      egressBytes: egressUsedBytes,
      tenantUsage: tenantUsage.map((item) => ({
        tenantId: item.tenantId,
        databaseBytes: item.databaseBytes,
        attachmentBytes: item.attachmentBytes,
        recordCount: item.recordCount,
      })),
    };
    const history = [...storedHistory, currentSnapshot];

    const monthBaseline = storedHistory.find(
      (snapshot: any) => new Date(snapshot.measuredAt) >= currentMonthStart,
    );
    if (monthBaseline) {
      for (const tenant of tenantUsage) {
        const baselineTenant = Array.isArray(monthBaseline.tenantUsage)
          ? monthBaseline.tenantUsage.find((item: any) => item.tenantId === tenant.tenantId)
          : null;
        if (!baselineTenant || !Number.isFinite(baselineTenant.databaseBytes)) continue;
        tenant.monthlyGrowthBytes = tenant.databaseBytes - Number(baselineTenant.databaseBytes);
        tenant.monthlyGrowthPercent = Number(baselineTenant.databaseBytes) > 0
          ? Math.round((tenant.monthlyGrowthBytes / Number(baselineTenant.databaseBytes)) * 10000) / 100
          : null;
      }
    }

    const totalLogicalDatabaseBytes = tenantUsage.reduce((sum, item) => sum + item.databaseBytes, 0);
    const providerCostCents = databaseProviderSettings?.invoiceAmountCents ?? null;
    for (const tenant of tenantUsage) {
      const allocationShare = totalLogicalDatabaseBytes > 0
        ? tenant.databaseBytes / totalLogicalDatabaseBytes
        : 0;
      tenant.estimatedProviderCostCents = providerCostCents === null
        ? 0
        : Math.round(providerCostCents * allocationShare);
      tenant.costCurrency = databaseProviderSettings?.currency || 'USD';
    }

    const buildForecast = (
      resource: 'databasePhysicalBytes' | 'storageBytes' | 'egressBytes',
      currentBytes: number | null,
      capacityBytes: number | null,
    ) => {
      if (currentBytes === null) return { status: 'UNAVAILABLE', dailyGrowthBytes: null, at80Percent: null, at100Percent: null, projectedAtPeriodEndBytes: null };
      if (!capacityBytes) return { status: 'CAPACITY_NOT_CONFIGURED', dailyGrowthBytes: null, at80Percent: null, at100Percent: null, projectedAtPeriodEndBytes: null };
      const points = history
        .map((snapshot: any) => ({ measuredAt: snapshot.measuredAt, value: snapshot[resource] }))
        .filter((point: any) => Number.isFinite(point.value));
      if (points.length < 2) return { status: 'INSUFFICIENT_HISTORY', dailyGrowthBytes: null, at80Percent: null, at100Percent: null, projectedAtPeriodEndBytes: null };
      const first = points[0];
      const last = points[points.length - 1];
      const elapsedDays = (new Date(last.measuredAt).getTime() - new Date(first.measuredAt).getTime()) / 86400000;
      if (elapsedDays < 0.25) return { status: 'INSUFFICIENT_HISTORY', dailyGrowthBytes: null, at80Percent: null, at100Percent: null, projectedAtPeriodEndBytes: null };
      const dailyGrowthBytes = (Number(last.value) - Number(first.value)) / elapsedDays;
      if (dailyGrowthBytes <= 0) return { status: 'STABLE', dailyGrowthBytes, at80Percent: null, at100Percent: null, projectedAtPeriodEndBytes: currentBytes };
      const dateAt = (targetBytes: number) => {
        if (currentBytes >= targetBytes) return measuredAt;
        return new Date(Date.now() + ((targetBytes - currentBytes) / dailyGrowthBytes) * 86400000).toISOString();
      };
      const billingEnd = databaseProviderSettings?.billingPeriodEnd
        ? new Date(databaseProviderSettings.billingPeriodEnd)
        : null;
      const daysUntilBillingEnd = billingEnd
        ? Math.max((billingEnd.getTime() - Date.now()) / 86400000, 0)
        : null;
      return {
        status: 'PROJECTED',
        dailyGrowthBytes: Math.round(dailyGrowthBytes),
        at80Percent: dateAt(capacityBytes * 0.8),
        at100Percent: dateAt(capacityBytes),
        projectedAtPeriodEndBytes: daysUntilBillingEnd === null
          ? null
          : Math.round(currentBytes + dailyGrowthBytes * daysUntilBillingEnd),
      };
    };

    const resourcePercent = (used: number | null, capacity: number | null) =>
      used === null || !capacity ? null : Math.round((used / capacity) * 10000) / 100;
    const resourceAlerts: Array<{ resource: string; threshold: number; level: string; message: string }> = [];
    const addResourceAlert = (resource: string, percent: number | null) => {
      if (percent === null || percent < 70) return;
      const threshold = percent >= 95 ? 95 : percent >= 85 ? 85 : 70;
      resourceAlerts.push({
        resource,
        threshold,
        level: threshold === 95 ? 'CRITICAL' : threshold === 85 ? 'WARNING' : 'WATCH',
        message: `وصل استهلاك ${resource} إلى ${percent}%`,
      });
    };
    addResourceAlert('PostgreSQL', resourcePercent(physicalBytes, providerCapacityBytes));
    addResourceAlert('Storage', resourcePercent(storageUsedBytes, storageCapacityBytes));
    addResourceAlert('Egress', resourcePercent(egressUsedBytes, egressCapacityBytes));
    for (const tenant of tenantUsage) {
      if (tenant.quotaUsagePercent !== null && tenant.quotaUsagePercent >= 70) {
        addResourceAlert(`حصة ${tenant.tenantName}`, tenant.quotaUsagePercent);
      }
    }

    const monthlyRevenueTotals = new Map<string, number>();
    for (const tenant of tenantUsage) {
      if (tenant.isRoot) continue;
      for (const [currency, amountCents] of Object.entries(tenant.monthlyRevenueByCurrency)) {
        monthlyRevenueTotals.set(currency, (monthlyRevenueTotals.get(currency) || 0) + amountCents);
      }
    }
    const netProfitTotals = new Map(monthlyRevenueTotals);
    if (databaseProviderSettings) {
      netProfitTotals.set(
        databaseProviderSettings.currency,
        (netProfitTotals.get(databaseProviderSettings.currency) || 0) - databaseProviderSettings.invoiceAmountCents,
      );
    }

    const billingTotalsByCurrency = new Map<
      string,
      { invoiceAmountCents: number; paidCents: number; pendingCents: number; amountDueCents: number }
    >();
    for (const tenant of tenantUsage) {
      if (tenant.isRoot) continue;
      const currency = tenant.billing.currency;
      const totals = billingTotalsByCurrency.get(currency) || {
        invoiceAmountCents: 0,
        paidCents: 0,
        pendingCents: 0,
        amountDueCents: 0,
      };
      totals.invoiceAmountCents += tenant.billing.invoiceAmountCents;
      totals.paidCents += tenant.billing.paidCents;
      totals.pendingCents += tenant.billing.pendingCents;
      totals.amountDueCents += tenant.billing.amountDueCents;
      billingTotalsByCurrency.set(currency, totals);
    }

    const baselineDatabaseBytes = Number(monthBaseline?.databasePhysicalBytes);
    const baselineStorageBytes = Number(monthBaseline?.storageBytes);
    const comparison = {
      database: Number.isFinite(baselineDatabaseBytes)
        ? {
            changeBytes: physicalBytes - baselineDatabaseBytes,
            changePercent: baselineDatabaseBytes > 0
              ? Math.round(((physicalBytes - baselineDatabaseBytes) / baselineDatabaseBytes) * 10000) / 100
              : null,
          }
        : null,
      storage: storageUsedBytes !== null && Number.isFinite(baselineStorageBytes)
        ? {
            changeBytes: storageUsedBytes - baselineStorageBytes,
            changePercent: baselineStorageBytes > 0
              ? Math.round(((storageUsedBytes - baselineStorageBytes) / baselineStorageBytes) * 10000) / 100
              : null,
          }
        : null,
    };

    return {
      measuredAt,
      measurement: 'POSTGRESQL_LOGICAL_ROW_BYTES',
      database: {
        provider: databaseProviderSettings?.providerName || 'Supabase Managed PostgreSQL',
        planName: databaseProviderSettings?.planName || null,
        physicalBytes,
        capacityBytes: providerCapacityBytes,
        availableBytes: providerAvailableBytes,
        usagePercent: Math.min(
          Math.round((physicalBytes / providerCapacityBytes) * 10000) / 100,
          100,
        ),
        capacityIsExact: hasExactProviderCapacity,
        capacitySource: hasExactProviderCapacity
          ? 'CONFIGURED_PROVIDER_PLAN'
          : 'SUPABASE_PUBLIC_MINIMUM',
        billing: databaseProviderSettings
          ? {
              invoiceAmountCents: databaseProviderSettings.invoiceAmountCents,
              paidAmountCents: databaseProviderSettings.paidAmountCents,
              amountDueCents: providerInvoiceDueCents,
              currency: databaseProviderSettings.currency,
              billingPeriodStart: databaseProviderSettings.billingPeriodStart,
              billingPeriodEnd: databaseProviderSettings.billingPeriodEnd,
              updatedAt: databaseProviderSettings.updatedAt || null,
            }
          : null,
      },
      resources: {
        database: {
          usedBytes: physicalBytes,
          capacityBytes: providerCapacityBytes,
          usagePercent: resourcePercent(physicalBytes, providerCapacityBytes),
          source: 'POSTGRESQL_PHYSICAL_DATABASE_SIZE',
        },
        storage: {
          usedBytes: storageUsedBytes,
          capacityBytes: storageCapacityBytes,
          usagePercent: resourcePercent(storageUsedBytes, storageCapacityBytes),
          objectCount: storageUsage?.objectCount ?? null,
          source: storageUsage?.source || 'UNAVAILABLE',
        },
        egress: {
          usedBytes: egressUsedBytes,
          capacityBytes: egressCapacityBytes,
          usagePercent: resourcePercent(egressUsedBytes, egressCapacityBytes),
          source: 'SUPABASE_BILLING_USAGE_NOT_EXPOSED_BY_MANAGEMENT_API',
        },
        realtime: {
          usage: managementUsage.apiRequests?.realtime ?? null,
          unit: 'REQUESTS',
          interval: managementUsage.interval,
          source: managementUsage.connected ? 'SUPABASE_MANAGEMENT_API' : 'UNAVAILABLE',
        },
        edgeFunctions: {
          usage: managementUsage.edgeFunctions?.deployed ?? null,
          active: managementUsage.edgeFunctions?.active ?? null,
          unit: 'DEPLOYED_FUNCTIONS',
          source: managementUsage.connected ? 'SUPABASE_MANAGEMENT_API' : 'UNAVAILABLE',
        },
      },
      providerIntegration: managementUsage,
      forecast: {
        database: buildForecast('databasePhysicalBytes', physicalBytes, providerCapacityBytes),
        storage: buildForecast('storageBytes', storageUsedBytes, storageCapacityBytes),
        egress: buildForecast('egressBytes', egressUsedBytes, egressCapacityBytes),
      },
      comparison,
      alerts: resourceAlerts,
      history,
      measurementLog: (Array.isArray(rootSettings.databaseUsageMeasurementLog)
        ? rootSettings.databaseUsageMeasurementLog
        : []).slice(-50).reverse(),
      profitability: {
        providerCost: databaseProviderSettings
          ? {
              invoiceAmountCents: databaseProviderSettings.invoiceAmountCents,
              paidAmountCents: databaseProviderSettings.paidAmountCents,
              projectedCostCents: databaseProviderSettings.invoiceAmountCents,
              currency: databaseProviderSettings.currency,
              projectionBasis: 'RECORDED_PROVIDER_INVOICE',
            }
          : null,
        subscriptionRevenueByCurrency: [...monthlyRevenueTotals.entries()].map(([currency, amountCents]) => ({
          currency,
          amountCents,
        })),
        netProfitByCurrency: [...netProfitTotals.entries()].map(([currency, amountCents]) => ({
          currency,
          amountCents,
        })),
        costAllocationBasis: 'DATABASE_LOGICAL_BYTES',
      },
      customerBilling: {
        totalsByCurrency: [...billingTotalsByCurrency.entries()].map(([currency, totals]) => ({
          currency,
          ...totals,
        })),
      },
      totals: {
        tenantCount: tenantUsage.length,
        databaseBytes: tenantUsage.reduce((sum, item) => sum + item.databaseBytes, 0),
        recordCount: tenantUsage.reduce((sum, item) => sum + item.recordCount, 0),
        attachmentBytes: tenantUsage.reduce((sum, item) => sum + item.attachmentBytes, 0),
        attachmentCount: tenantUsage.reduce((sum, item) => sum + item.attachmentCount, 0),
        scopedTableCount: new Set(scopedAggregates.map((item) => item.tableName)).size,
      },
      tenants: tenantUsage,
    };
  }

  async measureAllTenantDatabaseUsage(requester: {
    tenantId?: string;
    companyId?: string;
    userId?: string;
  }) {
    try {
      const result = await this.getAllTenantDatabaseUsage(requester, {
        refreshProviderUsage: true,
      });
      const rootTenant = await this.prisma.tenant.findFirst({
        where: { isRoot: true },
        include: { companies: { select: { id: true } } },
      });
      if (!rootTenant) throw new NotFoundException('الحساب المركزي للمنصة غير موجود');

      let settings: Record<string, any> = {};
      if (rootTenant.customSettings) {
        try {
          settings = JSON.parse(rootTenant.customSettings);
        } catch {}
      }

      const measuredBy = requester.userId
        ? await this.prisma.user.findUnique({
            where: { id: requester.userId },
            select: { id: true, name: true, email: true },
          })
        : null;
      const snapshot = result.history[result.history.length - 1];
      const history = [
        ...(Array.isArray(settings.databaseUsageHistory) ? settings.databaseUsageHistory : []),
        { ...snapshot, id: `measurement-${Date.now()}` },
      ].slice(-400);
      const logEntry = {
        id: `measurement-log-${Date.now()}`,
        measuredAt: result.measuredAt,
        status: 'SUCCESS',
        providerStatus: result.providerIntegration.connected ? 'CONNECTED' : 'UNAVAILABLE',
        measuredBy: measuredBy
          ? { id: measuredBy.id, name: measuredBy.name, email: measuredBy.email }
          : null,
      };
      const measurementLog = [
        ...(Array.isArray(settings.databaseUsageMeasurementLog)
          ? settings.databaseUsageMeasurementLog
          : []),
        logEntry,
      ].slice(-200);

      settings.databaseUsageHistory = history;
      settings.databaseUsageMeasurementLog = measurementLog;
      settings.supabaseManagementUsage = result.providerIntegration;
      this.invalidateTenantCache();
      await this.prisma.tenant.update({
        where: { id: rootTenant.id },
        data: { customSettings: JSON.stringify(settings) },
      });

      const auditCompanyId = requester.companyId || rootTenant.companies[0]?.id;
      if (auditCompanyId) {
        await this.prisma.auditLog.create({
          data: {
            tenantId: rootTenant.id,
            companyId: auditCompanyId,
            userId: measuredBy?.id || null,
            action: 'MEASURE_PLATFORM_USAGE',
            entity: 'PlatformUsage',
            entityId: snapshot.id,
            details: JSON.stringify({
              databasePhysicalBytes: snapshot.databasePhysicalBytes,
              storageBytes: snapshot.storageBytes,
              egressBytes: snapshot.egressBytes,
              supabaseManagementConnected: result.providerIntegration.connected,
              realtimeRequestsLastDay: result.resources.realtime.usage,
              deployedEdgeFunctions: result.resources.edgeFunctions.usage,
            }),
          },
        });
      }

      return {
        ...result,
        history,
        measurementLog: [...measurementLog].reverse().slice(0, 50),
      };
    } catch (error) {
      await this.recordDatabaseMeasurementFailure(requester, error).catch(() => undefined);
      throw error;
    }
  }

  async updateDatabaseProviderSettings(
    requester: { tenantId?: string; companyId?: string; userId?: string },
    dto: UpdateDatabaseProviderSettingsDto,
  ) {
    await this.assertRootTenantAccess(requester);

    const periodStart = new Date(dto.billingPeriodStart);
    const periodEnd = new Date(dto.billingPeriodEnd);
    if (periodEnd <= periodStart) {
      throw new BadRequestException('نهاية دورة فاتورة قاعدة البيانات يجب أن تكون بعد بدايتها');
    }
    if (dto.paidAmountCents > dto.invoiceAmountCents) {
      throw new BadRequestException('المبلغ المدفوع لا يمكن أن يتجاوز قيمة الفاتورة');
    }

    const rootTenant = await this.prisma.tenant.findFirst({
      where: { isRoot: true },
      include: { companies: { select: { id: true } } },
    });
    if (!rootTenant) throw new NotFoundException('الحساب المركزي للمنصة غير موجود');

    let currentSettings: Record<string, any> = {};
    if (rootTenant.customSettings) {
      try {
        currentSettings = JSON.parse(rootTenant.customSettings);
      } catch {}
    }

    currentSettings.databaseProvider = {
      providerName: dto.providerName.trim(),
      planName: dto.planName.trim(),
      capacityBytes: dto.capacityBytes,
      storageCapacityBytes:
        dto.storageCapacityBytes ?? currentSettings.databaseProvider?.storageCapacityBytes ?? null,
      egressCapacityBytes:
        dto.egressCapacityBytes ?? currentSettings.databaseProvider?.egressCapacityBytes ?? null,
      egressUsedBytes: currentSettings.databaseProvider?.egressUsedBytes ?? null,
      invoiceAmountCents: dto.invoiceAmountCents,
      paidAmountCents: dto.paidAmountCents,
      currency: dto.currency,
      billingPeriodStart: periodStart.toISOString(),
      billingPeriodEnd: periodEnd.toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.invalidateTenantCache();
    await this.prisma.tenant.update({
      where: { id: rootTenant.id },
      data: { customSettings: JSON.stringify(currentSettings) },
    });

    const auditCompanyId = requester.companyId || rootTenant.companies[0]?.id;
    if (auditCompanyId) {
      await this.prisma.auditLog.create({
        data: {
          tenantId: rootTenant.id,
          companyId: auditCompanyId,
          userId: requester.userId || null,
          action: 'UPDATE_DATABASE_PROVIDER_SETTINGS',
          entity: 'DatabaseProviderSettings',
          entityId: rootTenant.id,
          details: JSON.stringify({ databaseProvider: currentSettings.databaseProvider }),
        },
      });
    }

    return { success: true, databaseProvider: currentSettings.databaseProvider };
  }

  async updateTenantDatabaseQuota(
    tenantId: string,
    requester: { tenantId?: string; companyId?: string; userId?: string },
    dto: UpdateTenantDatabaseQuotaDto,
  ) {
    await this.assertRootTenantAccess(requester);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { companies: { select: { id: true } } },
    });
    if (!tenant) throw new NotFoundException('المؤسسة غير موجودة');
    if (tenant.isRoot) throw new BadRequestException('مالك المنصة بلا حصة داخلية محددة');

    let settings: Record<string, any> = {};
    if (tenant.customSettings) {
      try {
        settings = JSON.parse(tenant.customSettings);
      } catch {}
    }
    const previousQuotaBytes = settings.databaseQuotaBytes ?? null;
    if (dto.databaseQuotaBytes === null) {
      delete settings.databaseQuotaBytes;
    } else {
      settings.databaseQuotaBytes = dto.databaseQuotaBytes;
    }

    this.invalidateTenantCache();
    await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: { customSettings: JSON.stringify(settings) },
    });

    const auditCompanyId = requester.companyId || tenant.companies[0]?.id;
    if (auditCompanyId) {
      await this.prisma.auditLog.create({
        data: {
          tenantId: tenant.id,
          companyId: auditCompanyId,
          userId: requester.userId || null,
          action: 'UPDATE_TENANT_DATABASE_QUOTA',
          entity: 'TenantDatabaseQuota',
          entityId: tenant.id,
          details: JSON.stringify({
            previousQuotaBytes,
            databaseQuotaBytes: dto.databaseQuotaBytes,
          }),
        },
      });
    }

    return { success: true, tenantId: tenant.id, databaseQuotaBytes: dto.databaseQuotaBytes };
  }

  private async recordDatabaseMeasurementFailure(
    requester: { tenantId?: string; companyId?: string; userId?: string },
    error: unknown,
  ) {
    const rootTenant = await this.prisma.tenant.findFirst({ where: { isRoot: true } });
    if (!rootTenant) return;
    let settings: Record<string, any> = {};
    if (rootTenant.customSettings) {
      try {
        settings = JSON.parse(rootTenant.customSettings);
      } catch {}
    }
    const measuredBy = requester.userId
      ? await this.prisma.user.findUnique({
          where: { id: requester.userId },
          select: { id: true, name: true, email: true },
        })
      : null;
    const measurementLog = [
      ...(Array.isArray(settings.databaseUsageMeasurementLog)
        ? settings.databaseUsageMeasurementLog
        : []),
      {
        id: `measurement-log-${Date.now()}`,
        measuredAt: new Date().toISOString(),
        status: 'FAILED',
        measuredBy,
        error: error instanceof Error ? error.message : 'تعذر إكمال القياس',
      },
    ].slice(-200);
    settings.databaseUsageMeasurementLog = measurementLog;
    this.invalidateTenantCache();
    await this.prisma.tenant.update({
      where: { id: rootTenant.id },
      data: { customSettings: JSON.stringify(settings) },
    });
  }

  private async assertRootTenantAccess(requester: {
    tenantId?: string;
    companyId?: string;
    userId?: string;
  }) {
    let tenantId = requester.tenantId;

    if (!tenantId && requester.companyId) {
      const company = await this.prisma.company.findUnique({
        where: { id: requester.companyId },
        select: { tenantId: true },
      });
      tenantId = company?.tenantId || undefined;
    }

    if (!tenantId && requester.userId) {
      const membership = await this.prisma.tenantMembership.findFirst({
        where: { userId: requester.userId, isActive: true },
        select: { tenantId: true },
      });
      tenantId = membership?.tenantId;
    }

    if (!tenantId && process.env.NODE_ENV !== 'production') {
      const rootTenant = await this.prisma.tenant.findFirst({
        where: { isRoot: true },
        select: { id: true },
      });
      tenantId = rootTenant?.id;
    }

    const tenant = tenantId
      ? await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { isRoot: true } })
      : null;

    if (!tenant?.isRoot) {
      throw new ForbiddenException('قياس استخدام قاعدة البيانات متاح لمالك المنصة فقط');
    }

    const ownerMembership = requester.userId
      ? await this.prisma.tenantMembership.findFirst({
          where: {
            tenantId,
            userId: requester.userId,
            role: 'OWNER',
            isActive: true,
          },
          select: { id: true },
        })
      : null;

    if (!ownerMembership) {
      throw new ForbiddenException('هذه العملية متاحة لمالك المنصة فقط');
    }
  }

  async getTenantById(id?: string, companyId?: string, userId?: string) {
    const cacheKey = `${id || ''}|${companyId || ''}|${userId || ''}`;
    return this.tenantCache.wrap(cacheKey, () => this.buildTenantById(id, companyId, userId));
  }

  private async buildTenantById(id?: string, companyId?: string, userId?: string) {
    let tenant: any = null;
    if (id) {
      tenant = await this.prisma.tenant.findUnique({
        where: { id },
        include: {
          subscriptions: {
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
              planVersion: {
                include: {
                  plan: true,
                  features: true,
                  limits: true,
                },
              },
              payments: {
                orderBy: { paidAt: 'desc' },
                take: 5,
              },
            },
          },
          memberships: {
            include: {
              user: {
                select: { id: true, name: true, email: true, phone: true, isActive: true },
              },
            },
          },
          branches: true,
        },
      });
    }

    if (!tenant && companyId) {
      const comp = await this.prisma.company.findUnique({ where: { id: companyId }, select: { tenantId: true } });
      if (comp?.tenantId) {
        return this.getTenantById(comp.tenantId);
      }
    }

    if (!tenant && userId) {
      const membership = await this.prisma.tenantMembership.findFirst({ where: { userId }, select: { tenantId: true } });
      if (membership?.tenantId) {
        return this.getTenantById(membership.tenantId);
      }
    }

    if (!tenant) {
      tenant = await this.prisma.tenant.findFirst({
        where: { isRoot: true },
        include: {
          subscriptions: {
            orderBy: { createdAt: 'desc' },
            take: 5,
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
          branches: true,
        },
      });
    }

    if (!tenant) {
      throw new NotFoundException('المؤسسة غير موجودة');
    }

    const activeSub = tenant.subscriptions[0];
    let daysRemaining = 0;
    if (activeSub?.currentPeriodEnd) {
      const now = new Date();
      const end = new Date(activeSub.currentPeriodEnd);
      const diffMs = end.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    const usage = await this.getTenantUsage(tenant.id);

    return {
      ...tenant,
      activeSubscription: activeSub,
      daysRemaining,
      usage,
    };
  }

  async createTenant(dto: CreateTenantDto) {
    // 1. Check slug uniqueness
    const existingSlug = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug.toLowerCase().trim() },
    });
    if (existingSlug) {
      throw new ConflictException('الرمز التعريفي للمؤسسة (Slug) مستخدم بالفعل');
    }

    // 2. Find selected plan version
    const plan = await this.prisma.plan.findUnique({
      where: { code: dto.planCode },
      include: {
        versions: {
          where: { isActive: true },
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    });

    if (!plan || !plan.versions[0]) {
      throw new BadRequestException('الباقة المختارة غير متوفرة');
    }

    const planVersion = plan.versions[0];

    // 3. Create Tenant in a transaction
    return await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const isFreeTrial = dto.planCode === 'FREE_TRIAL';
      const periodEnd = new Date(now);
      if (isFreeTrial) {
        periodEnd.setDate(periodEnd.getDate() + 14);
      } else if (dto.planCode === 'PRO' || dto.planCode === 'ENTERPRISE') {
        periodEnd.setMonth(periodEnd.getMonth() + 3);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      const tenant = await tx.tenant.create({
        data: {
          name: dto.name,
          legalName: dto.legalName,
          slug: dto.slug.toLowerCase().trim(),
          phone: dto.phone,
          email: dto.email,
          address: dto.address,
          city: dto.city || 'بغداد',
          country: dto.country || 'العراق',
          baseCurrency: dto.baseCurrency || 'IQD',
          status: 'ACTIVE',
          isRoot: false,
        },
      });

      // 4. Create primary company
      const companyCode = `CMP-${dto.slug.toUpperCase().slice(0, 4)}`;
      const company = await tx.company.create({
        data: {
          tenantId: tenant.id,
          name: dto.name,
          code: companyCode,
          currency: dto.baseCurrency || 'IQD',
          phone: dto.phone,
          email: dto.email,
          address: dto.address,
          isDefault: true,
        },
      });

      // 5. Create primary main branch
      const mainBranch = await tx.branch.create({
        data: {
          tenantId: tenant.id,
          companyId: company.id,
          code: 'BR-01',
          nameAr: 'الفرع الرئيسي',
          nameEn: 'Main Branch',
          city: dto.city || 'بغداد',
          address: dto.address,
          phone: dto.phone,
          email: dto.email,
          isMain: true,
          status: 'نشط',
        },
      });

      const adminDepartment = await tx.department.create({
        data: {
          tenantId: tenant.id,
          companyId: company.id,
          branchId: mainBranch.id,
          branchName: mainBranch.nameAr,
          code: 'ADMIN',
          name: 'الإدارة العامة',
          description: 'الإدارة التنفيذية للمؤسسة',
        },
      });

      // 5.1 Create Primary Admin Role for Company
      const adminRole = await tx.role.create({
        data: {
          name: 'المدير العام',
          description: 'صلاحيات كاملة للمؤسسة',
          permissions: JSON.stringify(['*']),
          allowedBranches: 'جميع الفروع',
          companyId: company.id,
        },
      });

      // 6. Find or create user
      let user = await tx.user.findUnique({
        where: { email: dto.ownerEmail.toLowerCase().trim() },
      });

      const rawPassword = dto.ownerPassword || '123456';
      const hashedPassword = rawPassword.startsWith('$2b$') ? rawPassword : await bcrypt.hash(rawPassword, 10);

      if (!user) {
        user = await tx.user.create({
          data: {
            email: dto.ownerEmail.toLowerCase().trim(),
            name: dto.ownerName,
            password: hashedPassword,
            plainPassword: rawPassword,
            phone: dto.ownerPhone || dto.phone,
            companyId: company.id,
            roleId: adminRole.id,
            isActive: true,
          },
        });
      } else {
        // Update user company / role / password if needed
        await tx.user.update({
          where: { id: user.id },
          data: {
            password: hashedPassword,
            plainPassword: rawPassword,
            companyId: company.id,
            roleId: adminRole.id,
            isActive: true,
          },
        });
      }

      // 6.1 Create Primary Employee record for Owner
      await tx.employee.create({
        data: {
          companyId: company.id,
          fullName: dto.ownerName,
          jobTitle: 'المدير العام',
          phone: dto.ownerPhone || dto.phone,
          email: dto.ownerEmail,
          branchId: mainBranch.id,
          branchName: mainBranch.nameAr,
          departmentId: adminDepartment.id,
          departmentName: adminDepartment.name,
          assignedCashbox: 'الصندوق الرئيسي',
          status: 'نشط',
          hasUserAccount: true,
          username: dto.ownerEmail,
          permissionGroupId: adminRole.id,
        },
      }).catch(() => null);
      await tx.tenantMembership.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          role: 'OWNER',
          isPrimary: true,
          isActive: true,
        },
      });

      // 8. Create Subscription
      const sub = await tx.tenantSubscription.create({
        data: {
          tenantId: tenant.id,
          planVersionId: planVersion.id,
          status: 'ACTIVE',
          billingCycle: 'MONTHLY',
          lockedPriceCents: planVersion.priceMonthlyCents,
          currency: planVersion.currency,
          startedAt: now,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });

      // 9. Log event
      await tx.subscriptionEvent.create({
        data: {
          subscriptionId: sub.id,
          eventType: 'CREATED',
          details: JSON.stringify({ plan: dto.planCode, price: planVersion.priceMonthlyCents / 100 }),
        },
      });

      // 10. Copy standard Chart of Accounts template from Root Tenant
      const standardAccounts = await tx.account.findMany({
        where: { isSystem: true },
        take: 30,
      });

      for (const acc of standardAccounts) {
        await tx.account.create({
          data: {
            tenantId: tenant.id,
            companyId: company.id,
            code: acc.code,
            nameAr: acc.nameAr,
            nameEn: acc.nameEn,
            type: acc.type,
            category: acc.category,
            level: acc.level,
            currency: acc.currency,
            isParent: acc.isParent,
            isSystem: true,
          },
        }).catch(() => null); // Skip if duplicates
      }

      return tenant;
    });
  }

  async updateTenant(id: string, dto: UpdateTenantDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('المؤسسة غير موجودة');

    this.invalidateTenantCache();
    return await this.prisma.tenant.update({
      where: { id },
      data: {
        name: dto.name,
        legalName: dto.legalName,
        logo: dto.logo,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        city: dto.city,
        timezone: dto.timezone,
        baseCurrency: dto.baseCurrency,
        status: dto.status,
        customSettings: dto.customSettings,
      },
    });
  }

  async getTenantUsage(id?: string, companyId?: string, userId?: string) {
    let tenantId = id;

    if (!tenantId && companyId) {
      const comp = await this.prisma.company.findUnique({ where: { id: companyId }, select: { tenantId: true } });
      if (comp?.tenantId) {
        tenantId = comp.tenantId;
      }
    }

    if (!tenantId && userId) {
      const membership = await this.prisma.tenantMembership.findFirst({ where: { userId }, select: { tenantId: true } });
      if (membership?.tenantId) {
        tenantId = membership.tenantId;
      }
    }

    if (!tenantId) {
      const root = await this.prisma.tenant.findFirst({ where: { isRoot: true }, select: { id: true } });
      tenantId = root?.id;
    }

    if (!tenantId) {
      return {
        tenantId: '',
        planName: 'غير محدد',
        planCode: 'NONE',
        branches: { current: 0, limit: -1, isUnlimited: true },
        users: { current: 0, limit: -1, isUnlimited: true },
        emailsDaily: { current: 0, limit: -1, isUnlimited: true },
        emailsMonthly: { current: 0, limit: -1, isUnlimited: true },
        storageMB: { current: 0, limit: -1, isUnlimited: true },
        accountsCount: 0,
        ticketsCount: 0,
        warnings: [],
      };
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const monthStr = new Date().toISOString().slice(0, 7);

    const [
      tenantRecord,
      branchesCount,
      usersCount,
      accountsCount,
      ticketsCount,
      emailDailyCounter,
      emailMonthlyCounter,
      totalAttachmentBytes,
    ] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { isRoot: true } }),
      this.prisma.branch.count({ where: { tenantId } }),
      this.prisma.tenantMembership.count({ where: { tenantId, isActive: true } }),
      this.prisma.account.count({ where: { tenantId } }),
      this.prisma.ticket.count({ where: { tenantId } }),
      this.prisma.usageCounter.findUnique({
        where: {
          tenantId_metric_periodKey: {
            tenantId,
            metric: 'EMAIL_DAILY',
            periodKey: todayStr,
          },
        },
      }),
      this.prisma.usageCounter.findUnique({
        where: {
          tenantId_metric_periodKey: {
            tenantId,
            metric: 'EMAIL_MONTHLY',
            periodKey: monthStr,
          },
        },
      }),
      this.prisma.attachment.aggregate({
        where: { tenantId },
        _sum: { size: true },
      }),
    ]);

    // Active sub limits
    const activeSub = await this.prisma.tenantSubscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        planVersion: {
          include: { limits: true, plan: true },
        },
      },
    });

    const limitsMap: Record<string, number> = {};
    if (!tenantRecord?.isRoot && activeSub?.planVersion?.limits) {
      for (const lim of activeSub.planVersion.limits) {
        limitsMap[lim.limitCode] = lim.limitValue;
      }
    }

    const storageUsedMB = Math.round(((totalAttachmentBytes._sum?.size || 0) / (1024 * 1024)) * 100) / 100;
    const warnings: { metric: string; message: string; level: 'warning' | 'danger' }[] = [];

    // User limit warning
    const userLimit = tenantRecord?.isRoot ? -1 : limitsMap['MAX_USERS'] ?? -1;
    if (userLimit !== -1) {
      const userPct = (usersCount / userLimit) * 100;
      if (userPct >= 100) {
        warnings.push({ metric: 'USERS', message: `بلغت الحد الأقصى للمستخدمين (${usersCount}/${userLimit})`, level: 'danger' });
      } else if (userPct >= 80) {
        warnings.push({ metric: 'USERS', message: `اقتربت من استنفاد حد المستخدمين (${usersCount}/${userLimit})`, level: 'warning' });
      }
    }

    // Branch limit warning
    const branchLimit = tenantRecord?.isRoot ? -1 : limitsMap['MAX_BRANCHES'] ?? -1;
    if (branchLimit !== -1) {
      const branchPct = (branchesCount / branchLimit) * 100;
      if (branchPct >= 100) {
        warnings.push({ metric: 'BRANCHES', message: `بلغت الحد الأقصى للفروع (${branchesCount}/${branchLimit})`, level: 'danger' });
      } else if (branchPct >= 80) {
        warnings.push({ metric: 'BRANCHES', message: `اقتربت من استنفاد حد الفروع (${branchesCount}/${branchLimit})`, level: 'warning' });
      }
    }

    // Daily Email limit warning
    const emailDailyLimit = tenantRecord?.isRoot ? -1 : limitsMap['EMAIL_DAILY'] ?? 100;
    const emailDailyCurrent = emailDailyCounter?.currentValue || 0;
    if (emailDailyLimit !== -1) {
      const emailPct = (emailDailyCurrent / emailDailyLimit) * 100;
      if (emailPct >= 100) {
        warnings.push({ metric: 'EMAIL_DAILY', message: `تم استنفاد حد الرسائل اليومي (${emailDailyCurrent}/${emailDailyLimit}) — سيتجدد عند منتصف الليل`, level: 'danger' });
      } else if (emailPct >= 80) {
        warnings.push({ metric: 'EMAIL_DAILY', message: `استهلكت ${Math.round(emailPct)}% من حد الرسائل اليومي (${emailDailyCurrent}/${emailDailyLimit})`, level: 'warning' });
      }
    }

    // Storage warning
    const storageLimitMB = tenantRecord?.isRoot ? -1 : limitsMap['STORAGE_MB'] ?? 1024;
    if (storageLimitMB !== -1) {
      const storagePct = (storageUsedMB / storageLimitMB) * 100;
      if (storagePct >= 100) {
        warnings.push({ metric: 'STORAGE', message: `تم امتلاء مساحة التخزين السحابي (${storageUsedMB} MB / ${storageLimitMB} MB)`, level: 'danger' });
      } else if (storagePct >= 80) {
        warnings.push({ metric: 'STORAGE', message: `اقتربت مساحة التخزين من الامتلاء (${storageUsedMB} MB / ${storageLimitMB} MB)`, level: 'warning' });
      }
    }

    return {
      tenantId,
      planName: tenantRecord?.isRoot ? 'بلا حدود' : activeSub?.planVersion?.plan?.nameAr || 'غير محدد',
      planCode: tenantRecord?.isRoot ? 'PLATFORM' : activeSub?.planVersion?.plan?.code || 'NONE',
      branches: {
        current: branchesCount,
        limit: branchLimit,
        isUnlimited: branchLimit === -1,
      },
      users: {
        current: usersCount,
        limit: userLimit,
        isUnlimited: userLimit === -1,
      },
      emailsDaily: {
        current: emailDailyCurrent,
        limit: emailDailyLimit,
        isUnlimited: emailDailyLimit === -1,
      },
      emailsMonthly: {
        current: emailMonthlyCounter?.currentValue || 0,
        limit: tenantRecord?.isRoot ? -1 : limitsMap['EMAIL_MONTHLY'] ?? 3000,
        isUnlimited: tenantRecord?.isRoot || (limitsMap['EMAIL_MONTHLY'] ?? -1) === -1,
      },
      storageMB: {
        current: storageUsedMB,
        limit: storageLimitMB,
        isUnlimited: storageLimitMB === -1,
      },
      accountsCount,
      ticketsCount,
      warnings,
      canCreateTransactions: tenantRecord?.isRoot || (activeSub?.status !== 'EXPIRED' && activeSub?.status !== 'SUSPENDED'),
      canUploadAttachments: storageLimitMB === -1 || storageUsedMB < storageLimitMB,
    };
  }

  async suspendTenant(id: string, reason?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('المؤسسة غير موجودة');
    if (tenant.isRoot) throw new BadRequestException('لا يمكن تعليق المؤسسة الرئيسية للمنصة');

    return await this.prisma.$transaction(async (tx) => {
      const updatedTenant = await tx.tenant.update({
        where: { id },
        data: { status: TenantStatus.SUSPENDED },
      });

      const sub = await tx.tenantSubscription.findFirst({
        where: { tenantId: id },
        orderBy: { createdAt: 'desc' },
      });

      if (sub && sub.status === 'ACTIVE') {
        await tx.tenantSubscription.update({
          where: { id: sub.id },
          data: { status: 'SUSPENDED' },
        });

        await tx.subscriptionEvent.create({
          data: {
            subscriptionId: sub.id,
            eventType: 'SUSPENDED',
            details: JSON.stringify({ reason: reason || 'تعليق إداري من لوحة SaaS' }),
          },
        });
      }

      return updatedTenant;
    });
  }

  async reactivateTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('المؤسسة غير موجودة');

    return await this.prisma.$transaction(async (tx) => {
      const updatedTenant = await tx.tenant.update({
        where: { id },
        data: { status: TenantStatus.ACTIVE },
      });

      const sub = await tx.tenantSubscription.findFirst({
        where: { tenantId: id },
        orderBy: { createdAt: 'desc' },
      });

      if (sub && sub.status === 'SUSPENDED') {
        await tx.tenantSubscription.update({
          where: { id: sub.id },
          data: { status: 'ACTIVE' },
        });

        await tx.subscriptionEvent.create({
          data: {
            subscriptionId: sub.id,
            eventType: 'REACTIVATED',
            details: JSON.stringify({ reason: 'إعادة تفعيل من لوحة SaaS' }),
          },
        });
      }

      return updatedTenant;
    });
  }

  async deleteTenant(
    id: string,
    requester: { tenantId?: string; companyId?: string; userId?: string },
  ) {
    await this.assertRootTenantAccess(requester);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        companies: true,
        memberships: true,
      },
    });

    if (!tenant) throw new NotFoundException('المؤسسة غير موجودة');

    if (tenant.isRoot) {
      throw new BadRequestException('لا يمكن حذف الحساب المركزي الرئيسي للمنصة السحابية (Root Platform Tenant).');
    }

    const companyIds = tenant.companies.map((c) => c.id);
    const userIds = tenant.memberships.map((m) => m.userId);

    return await this.prisma.$transaction(async (tx) => {
      // 0. Delete ancillary & operational records
      await (tx as any).attachment?.deleteMany({ where: { tenantId: id } }).catch(() => null);
      await (tx as any).exchangeVoucher?.deleteMany({ where: { OR: [{ tenantId: id }, { companyId: { in: companyIds } }] } }).catch(() => null);
      await (tx as any).invoicePayment?.deleteMany({ where: { invoice: { OR: [{ tenantId: id }, { companyId: { in: companyIds } }] } } }).catch(() => null);
      await (tx as any).invoiceItem?.deleteMany({ where: { invoice: { OR: [{ tenantId: id }, { companyId: { in: companyIds } }] } } }).catch(() => null);
      await (tx as any).invoice?.deleteMany({ where: { OR: [{ tenantId: id }, { companyId: { in: companyIds } }] } }).catch(() => null);
      await (tx as any).visaPassenger?.deleteMany({ where: { visa: { OR: [{ tenantId: id }, { companyId: { in: companyIds } }] } } }).catch(() => null);
      await (tx as any).visa?.deleteMany({ where: { OR: [{ tenantId: id }, { companyId: { in: companyIds } }] } }).catch(() => null);
      await (tx as any).hotelBooking?.deleteMany({ where: { OR: [{ tenantId: id }, { companyId: { in: companyIds } }] } }).catch(() => null);
      await (tx as any).groupPassenger?.deleteMany({ where: { group: { OR: [{ tenantId: id }, { companyId: { in: companyIds } }] } } }).catch(() => null);
      await (tx as any).flightGroup?.deleteMany({ where: { OR: [{ tenantId: id }, { companyId: { in: companyIds } }] } }).catch(() => null);
      await (tx as any).subCashboxSettlementLine?.deleteMany({ where: { settlement: { OR: [{ tenantId: id }, { companyId: { in: companyIds } }] } } }).catch(() => null);
      await (tx as any).subCashboxSettlement?.deleteMany({ where: { OR: [{ tenantId: id }, { companyId: { in: companyIds } }] } }).catch(() => null);
      await (tx as any).externalClearing?.deleteMany({ where: { OR: [{ tenantId: id }, { companyId: { in: companyIds } }] } }).catch(() => null);
      await (tx as any).partnerShare?.deleteMany({ where: { partner: { OR: [{ tenantId: id }, { companyId: { in: companyIds } }] } } }).catch(() => null);
      await (tx as any).partner?.deleteMany({ where: { OR: [{ tenantId: id }, { companyId: { in: companyIds } }] } }).catch(() => null);
      await (tx as any).debtPayment?.deleteMany({ where: { debt: { OR: [{ tenantId: id }, { companyId: { in: companyIds } }] } } }).catch(() => null);
      await (tx as any).debt?.deleteMany({ where: { OR: [{ tenantId: id }, { companyId: { in: companyIds } }] } }).catch(() => null);
      await (tx as any).dailyReport?.deleteMany({ where: { OR: [{ tenantId: id }, { companyId: { in: companyIds } }] } }).catch(() => null);

      // 1. Delete tickets and passengers
      const tickets = await tx.ticket.findMany({
        where: { OR: [{ tenantId: id }, { companyId: { in: companyIds } }] },
        select: { id: true },
      });
      const ticketIds = tickets.map((t) => t.id);
      if (ticketIds.length > 0) {
        await tx.ticketPassenger.deleteMany({ where: { ticketId: { in: ticketIds } } });
        await tx.ticket.deleteMany({ where: { id: { in: ticketIds } } });
      }

      // 2. Delete payment and receipt vouchers
      await tx.paymentVoucher.deleteMany({
        where: { OR: [{ tenantId: id }, { companyId: { in: companyIds } }] },
      });
      await tx.receiptVoucher.deleteMany({
        where: { OR: [{ tenantId: id }, { companyId: { in: companyIds } }] },
      });

      // 3. Delete journal entries and lines
      const journalEntries = await tx.journalEntry.findMany({
        where: { OR: [{ tenantId: id }, { companyId: { in: companyIds } }] },
        select: { id: true },
      });
      const jEntryIds = journalEntries.map((j) => j.id);
      if (jEntryIds.length > 0) {
        await tx.journalEntryLine.deleteMany({ where: { journalEntryId: { in: jEntryIds } } });
        await tx.journalEntry.deleteMany({ where: { id: { in: jEntryIds } } });
      }

      // 4. Delete accounts
      await tx.account.deleteMany({
        where: { OR: [{ tenantId: id }, { companyId: { in: companyIds } }] },
      });

      // 5. Delete fiscal years & periods
      await tx.fiscalPeriod.deleteMany({
        where: { fiscalYear: { OR: [{ tenantId: id }, { companyId: { in: companyIds } }] } },
      });
      await tx.fiscalYear.deleteMany({
        where: { OR: [{ tenantId: id }, { companyId: { in: companyIds } }] },
      });

      // 6. Delete customers, suppliers, banks, cashboxes
      await tx.customer.deleteMany({
        where: { OR: [{ tenantId: id }, { companyId: { in: companyIds } }] },
      });
      await tx.supplier.deleteMany({
        where: { OR: [{ tenantId: id }, { companyId: { in: companyIds } }] },
      });
      await tx.bank.deleteMany({
        where: { OR: [{ tenantId: id }, { companyId: { in: companyIds } }] },
      });
      await tx.cashbox.deleteMany({
        where: { OR: [{ tenantId: id }, { companyId: { in: companyIds } }] },
      });

      // 7. Delete employees, departments, roles, printTemplates, airlines, branches
      await tx.employee.deleteMany({
        where: { OR: [{ tenantId: id }, { companyId: { in: companyIds } }] },
      });
      await tx.department.deleteMany({
        where: { OR: [{ tenantId: id }, { companyId: { in: companyIds } }] },
      });
      await tx.role.deleteMany({
        where: { companyId: { in: companyIds } },
      });
      await tx.printTemplate.deleteMany({
        where: { OR: [{ tenantId: id }, { companyId: { in: companyIds } }] },
      });
      await tx.airline.deleteMany({
        where: { OR: [{ tenantId: id }, { companyId: { in: companyIds } }] },
      });
      await tx.branch.deleteMany({
        where: { OR: [{ tenantId: id }, { companyId: { in: companyIds } }] },
      });

      // 8. Delete audit logs, usage counters, subscriptions, events, payments
      await tx.auditLog.deleteMany({ where: { tenantId: id } });
      await tx.balanceAuditLog.deleteMany({ where: { tenantId: id } });
      await tx.usageCounter.deleteMany({ where: { tenantId: id } });

      const subs = await tx.tenantSubscription.findMany({
        where: { tenantId: id },
        select: { id: true },
      });
      const subIds = subs.map((s) => s.id);
      if (subIds.length > 0) {
        await tx.subscriptionEvent.deleteMany({ where: { subscriptionId: { in: subIds } } });
        await tx.subscriptionPayment.deleteMany({ where: { subscriptionId: { in: subIds } } });
        await tx.tenantSubscription.deleteMany({ where: { id: { in: subIds } } });
      }

      // 9. Delete memberships
      await tx.tenantMembership.deleteMany({ where: { tenantId: id } });

      // 10. Delete companies
      await tx.company.deleteMany({ where: { tenantId: id } });

      // 11. Delete orphaned users of this tenant
      for (const uId of userIds) {
        const remainingMemberships = await tx.tenantMembership.count({ where: { userId: uId } });
        if (remainingMemberships === 0) {
          await tx.user.delete({ where: { id: uId } }).catch(() => null);
        }
      }

      // 12. Delete Tenant
      await tx.tenant.delete({ where: { id } });

      return { success: true, message: `تم حذف المؤسسة (${tenant.name}) وكافة بياناتها بنجاح` };
    }, {
      maxWait: 15_000,
      timeout: 120_000,
    });
  }

  async updateOwnerPermissions(tenantId: string, customPermissions: string[], allowedBranchIds: string[] = []) {
    const ownerMembership = await this.prisma.tenantMembership.findFirst({
      where: { tenantId, role: 'OWNER' },
    });

    if (!ownerMembership) {
      const anyMembership = await this.prisma.tenantMembership.findFirst({
        where: { tenantId },
      });
      if (!anyMembership) throw new NotFoundException('لا يوجد عضوية مسجلة لهذه الشركة');
      return this.prisma.tenantMembership.update({
        where: { id: anyMembership.id },
        data: {
          customPermissions: JSON.stringify(customPermissions),
          allowedBranchIds,
        },
      });
    }

    return this.prisma.tenantMembership.update({
      where: { id: ownerMembership.id },
      data: {
        customPermissions: JSON.stringify(customPermissions),
        allowedBranchIds,
      },
    });
  }

  async impersonateTenantOwner(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        memberships: {
          include: {
            user: {
              include: {
                company: true,
                role: true,
              },
            },
          },
        },
      },
    });

    if (!tenant) throw new NotFoundException('المؤسسة غير موجودة');

    const ownerMembership =
      tenant.memberships.find((m) => m.role === 'OWNER') || tenant.memberships[0];

    if (!ownerMembership?.user) {
      throw new NotFoundException('لا يوجد مستخدم مسجل لهذه المؤسسة');
    }

    const ownerUser = ownerMembership.user;

    let effectivePermissions: string[] = ['*'];
    if (ownerMembership.customPermissions) {
      try {
        const raw = ownerMembership.customPermissions;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed) && parsed.length > 0) {
          effectivePermissions = parsed;
        }
      } catch {}
    } else if (ownerUser.role?.permissions) {
      try {
        const raw = ownerUser.role.permissions;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed)) effectivePermissions = parsed;
      } catch {}
    }

    const payload = {
      sub: ownerUser.id,
      email: ownerUser.email,
      name: ownerUser.name,
      companyId: ownerUser.companyId,
      companyName: tenant.name,
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      tenantRole: ownerMembership.role,
      role: 'مالك الشركة',
      permissions: effectivePermissions,
      isImpersonating: true,
    };

    const token = this.jwtService.sign(payload);

    return {
      accessToken: token,
      user: {
        id: ownerUser.id,
        email: ownerUser.email,
        name: ownerUser.name,
        phone: ownerUser.phone,
        companyId: ownerUser.companyId,
        companyName: tenant.name,
        companyCurrency: tenant.baseCurrency || 'IQD',
        role: 'مالك الشركة',
        permissions: effectivePermissions,
        isImpersonating: true,
        impersonatedTenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
        },
      },
    };
  }
}
