import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { resolveBranchAccess } from './branch-access';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'super-secret-accounting-key-2026',
    });
  }

  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        company: {
          include: { tenant: true },
        },
        role: true,
        memberships: {
          where: { isActive: true },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          include: { tenant: true },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('المستخدم غير مفعّل أو غير موجود');
    }

    const primaryMembership = user.memberships.find((m) => m.isPrimary) || user.memberships[0];
    const activeTenantId = primaryMembership?.tenantId || user.company?.tenantId || '00000000-0000-0000-0000-000000000001';
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

    const companyBranches = await this.prisma.branch.findMany({
      where: { companyId: user.companyId },
      select: {
        id: true,
        code: true,
        nameAr: true,
        nameEn: true,
        status: true,
      },
    });
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
