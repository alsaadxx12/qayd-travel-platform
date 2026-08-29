import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { resolveBranchAccess } from './branch-access';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  /**
   * `validate()` runs on EVERY authenticated request, before any controller code.
   *
   * As originally written it issued a deeply nested `user.findUnique` — which Prisma
   * expands into several round trips (user, company, tenant, role, memberships, each
   * membership's tenant) — and then a separate `branch.findMany`. That is roughly six
   * sequential trips to a remote database on every call, which is why a single-row
   * endpoint like `print-templates/exchange_rate_settings` cost 1.14s, almost exactly
   * what a heavy report cost. The fixed floor was the guard, not the queries.
   *
   * Two changes: the branch listing now runs in parallel with the user lookup (the
   * token already carries companyId), and the resolved context is cached briefly.
   *
   * TRADE-OFF, stated plainly: with the cache on, deactivating a user or changing
   * their permissions takes effect within AUTH_CONTEXT_TTL_MS rather than on the very
   * next request. Default 30s. Set AUTH_CONTEXT_TTL_MS=0 to disable caching entirely
   * and restore the original per-request verification.
   */
  private static readonly CTX_TTL = Number(process.env.AUTH_CONTEXT_TTL_MS ?? 30_000);
  private static readonly MAX_CACHE_ENTRIES = 5_000;
  private static contextCache = new Map<string, { at: number; ctx: any }>();

  /** Call after changing a user's status, role, permissions or memberships. */
  static invalidateUserContext(userId?: string) {
    if (!userId) {
      JwtStrategy.contextCache.clear();
      return;
    }
    for (const key of JwtStrategy.contextCache.keys()) {
      if (key.startsWith(`${userId}|`)) JwtStrategy.contextCache.delete(key);
    }
  }

  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'super-secret-accounting-key-2026',
    });
  }

  async validate(payload: any) {
    if (JwtStrategy.CTX_TTL <= 0) {
      return this.buildContext(payload);
    }

    // Keyed by the token's issued-at as well as the user, so a re-login (new token)
    // always rebuilds the context instead of inheriting the previous session's.
    const key = `${payload.sub}|${payload.iat ?? ''}`;
    const hit = JwtStrategy.contextCache.get(key);
    if (hit && Date.now() - hit.at < JwtStrategy.CTX_TTL) {
      return hit.ctx;
    }

    // Rejections are never cached — a deactivated user must not be able to keep a
    // "denied" entry warm, and a transient DB error must not stick.
    const ctx = await this.buildContext(payload);

    if (JwtStrategy.contextCache.size >= JwtStrategy.MAX_CACHE_ENTRIES) {
      const cutoff = Date.now() - JwtStrategy.CTX_TTL;
      for (const [k, v] of JwtStrategy.contextCache) {
        if (v.at < cutoff) JwtStrategy.contextCache.delete(k);
      }
      // Still full of live entries? Drop the oldest insertion to bound memory.
      if (JwtStrategy.contextCache.size >= JwtStrategy.MAX_CACHE_ENTRIES) {
        const oldest = JwtStrategy.contextCache.keys().next().value;
        if (oldest) JwtStrategy.contextCache.delete(oldest);
      }
    }

    JwtStrategy.contextCache.set(key, { at: Date.now(), ctx });
    return ctx;
  }

  private async buildContext(payload: any) {
    const branchSelect = {
      id: true,
      code: true,
      nameAr: true,
      nameEn: true,
      status: true,
    } as const;

    // The token already carries companyId, so the branch listing no longer has to
    // wait for the user row to come back first.
    const [user, presetBranches] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: payload.sub },
        // `select` rather than `include`: only the fields this context actually uses.
        select: {
          id: true,
          email: true,
          name: true,
          isActive: true,
          companyId: true,
          company: {
            select: {
              name: true,
              tenantId: true,
              tenant: { select: { id: true, name: true, slug: true, isRoot: true } },
            },
          },
          role: { select: { name: true, permissions: true, allowedBranches: true } },
          memberships: {
            where: { isActive: true },
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
            select: {
              tenantId: true,
              role: true,
              isPrimary: true,
              customPermissions: true,
              allowedBranchIds: true,
              tenant: { select: { name: true, slug: true, isRoot: true } },
            },
          },
        },
      }),
      payload.companyId
        ? this.prisma.branch.findMany({
            where: { companyId: payload.companyId },
            select: branchSelect,
          })
        : Promise.resolve(null),
    ]);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('المستخدم غير مفعّل أو غير موجود');
    }

    // Only if the token predates companyId, or the user has since moved company.
    const companyBranches =
      presetBranches && payload.companyId === user.companyId
        ? presetBranches
        : await this.prisma.branch.findMany({
            where: { companyId: user.companyId },
            select: branchSelect,
          });

    const primaryMembership = user.memberships.find((m) => m.isPrimary) || user.memberships[0];
    const activeTenantId =
      primaryMembership?.tenantId || user.company?.tenantId || '00000000-0000-0000-0000-000000000001';
    const activeTenant = primaryMembership?.tenant || user.company?.tenant;

    let effectivePermissions: string[] = [];
    if (user.role?.permissions) {
      try {
        const rolePermissions = JSON.parse(user.role.permissions);
        if (Array.isArray(rolePermissions)) effectivePermissions = rolePermissions.map(String);
      } catch {}
    }
    if (primaryMembership?.customPermissions) {
      try {
        const raw = primaryMembership.customPermissions;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed) && parsed.length > 0) {
          effectivePermissions = parsed.map(String);
        }
      } catch {}
    }

    const branchAccess = resolveBranchAccess(
      companyBranches,
      primaryMembership?.allowedBranchIds || [],
      user.role?.allowedBranches,
      primaryMembership?.role,
    );

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      companyId: user.companyId,
      companyName: user.company.name,
      tenantId: activeTenantId,
      tenantName: activeTenant?.name || 'مؤسسة قسطاس المركزية',
      tenantSlug: activeTenant?.slug || 'qistas-prime',
      tenantRole: primaryMembership?.role || 'OWNER',
      isRootTenant: activeTenant?.isRoot || false,
      memberships: user.memberships.map((m) => ({
        tenantId: m.tenantId,
        tenantName: m.tenant.name,
        tenantSlug: m.tenant.slug,
        role: m.role,
        isPrimary: m.isPrimary,
      })),
      role: user.role?.name || (primaryMembership?.role === 'OWNER' ? 'مالك الشركة' : 'User'),
      permissions: effectivePermissions,
      allowedBranchIds: branchAccess.allowedBranchIds,
      canAccessAllBranches: branchAccess.canAccessAllBranches,
      branchAccessResolved: true,
    };
  }
}
