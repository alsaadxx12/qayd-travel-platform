import { Injectable, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { resolveBranchAccess } from './branch-access';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  private parsePermissions(raw: any): string[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch (e) {
        return [raw];
      }
    }
    return [];
  }

  async login(loginDto: LoginDto) {
    // Usernames for employee accounts are stored in the unique `email` login field.
    // Accepting a generic identifier here keeps existing email logins backward compatible.
    const cleanIdentifier = loginDto.email.toLowerCase().trim();
    const user = await this.prisma.user.findFirst({
      where: {
        email: {
          equals: cleanIdentifier,
          mode: 'insensitive',
        },
      },
      include: {
        company: true,
        role: true,
        memberships: {
          where: { isActive: true },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          include: { tenant: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }

    let isPasswordValid = false;
    if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$')) {
      isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    } else {
      isPasswordValid = user.password === loginDto.password;
      if (isPasswordValid) {
        // Auto upgrade to bcrypt
        const hashed = await bcrypt.hash(loginDto.password, 10);
        await this.prisma.user.update({
          where: { id: user.id },
          data: { password: hashed },
        });
      }
    }

    if (!isPasswordValid) {
      throw new UnauthorizedException('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('هذا الحساب معطل، يرجى التواصل مع المدير');
    }

    let permissions = this.parsePermissions(user.role?.permissions);

    // Match the JWT strategy exactly: only active memberships, with the primary one taking precedence.
    const activeMemberships = user.memberships?.filter((membership) => membership.isActive) || [];
    const primaryMembership =
      activeMemberships.find((membership) => membership.isPrimary) || activeMemberships[0];
    if (primaryMembership?.customPermissions) {
      try {
        const raw = primaryMembership.customPermissions;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed) && parsed.length > 0) {
          permissions = parsed;
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

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      companyId: user.companyId,
      companyName: user.company?.name || 'الشركة المركزية',
      role: user.role?.name || (primaryMembership?.role === 'OWNER' ? 'مالك الشركة' : 'مستخدم'),
      permissions,
      allowedBranchIds: branchAccess.allowedBranchIds,
      canAccessAllBranches: branchAccess.canAccessAllBranches,
    };

    const token = this.jwtService.sign(payload);

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        companyId: user.companyId,
        companyName: user.company?.name || 'الشركة المركزية',
        companyCurrency: user.company?.currency || 'IQD',
        role: user.role?.name || (primaryMembership?.role === 'OWNER' ? 'مالك الشركة' : 'مستخدم'),
        permissions,
        allowedBranchIds: branchAccess.allowedBranchIds,
        canAccessAllBranches: branchAccess.canAccessAllBranches,
      },
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        companyId: true,
        company: {
          select: {
            id: true,
            name: true,
            code: true,
            currency: true,
            vatNumber: true,
            address: true,
            phone: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
            permissions: true,
          },
        },
        memberships: {
          where: { isActive: true },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            role: true,
            customPermissions: true,
            allowedBranchIds: true,
            isActive: true,
            isPrimary: true,
            tenant: {
              select: {
                id: true,
                name: true,
                slug: true,
                status: true,
                isRoot: true,
              },
            },
          },
        },
      },
    });

    if (!user) throw new NotFoundException('المستخدم غير موجود');

    let effectivePermissions = this.parsePermissions(user.role?.permissions);
    const activeMemberships = user.memberships?.filter((membership) => membership.isActive) || [];
    const primaryMembership =
      activeMemberships.find((membership) => membership.isPrimary) || activeMemberships[0];
    if (primaryMembership?.customPermissions) {
      try {
        const raw = primaryMembership.customPermissions;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed) && parsed.length > 0) {
          effectivePermissions = parsed;
        }
      } catch {}
    }

    return {
      ...user,
      permissions: effectivePermissions,
      role: user.role
        ? {
            ...user.role,
            permissions: effectivePermissions,
          }
        : {
            id: 'owner',
            name: primaryMembership?.role === 'OWNER' ? 'مالك الشركة' : 'مستخدم',
            permissions: effectivePermissions,
          },
    };
  }

  async getAllUsers(companyId: string) {
    return this.prisma.user.findMany({
      where: { companyId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        isActive: true,
        createdAt: true,
        role: {
          select: {
            id: true,
            name: true,
            allowedBranches: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createUser(data: { name: string; email: string; password: string; companyId: string; roleId?: string; phone?: string }) {
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new UnauthorizedException('البريد الإلكتروني مستخدم بالفعل');
    }

    // Check Tenant Active Users Limit (suspended/inactive users do NOT count)
    const company = await this.prisma.company.findUnique({
      where: { id: data.companyId },
      select: { tenantId: true },
    });

    if (company?.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: company.tenantId },
        select: { isRoot: true },
      });

      if (tenant && !tenant.isRoot) {
        const activeSub = await this.prisma.tenantSubscription.findFirst({
          where: { tenantId: company.tenantId },
          orderBy: { createdAt: 'desc' },
          include: {
            planVersion: {
              include: { limits: true },
            },
          },
        });

        const maxUsersLimit = activeSub?.planVersion?.limits.find(l => l.limitCode === 'MAX_USERS')?.limitValue ?? 3;
        if (maxUsersLimit !== -1) {
          const currentActiveCount = await this.prisma.tenantMembership.count({
            where: { tenantId: company.tenantId, isActive: true },
          });

          if (currentActiveCount >= maxUsersLimit) {
            throw new BadRequestException(
              `لقد بلغت الحد الأقصى للمستخدمين النشطين (${maxUsersLimit} مستخدمين) في باقتك الحالية. يرجى ترقية الباقة أو تعطيل حسابات غير نشطة.`
            );
          }
        }
      }
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        companyId: data.companyId,
        roleId: data.roleId || null,
        phone: data.phone || null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        isActive: true,
        role: { select: { id: true, name: true } },
      },
    });

    // Create Tenant Membership if tenant exists
    if (company?.tenantId) {
      await this.prisma.tenantMembership.create({
        data: {
          tenantId: company.tenantId,
          userId: user.id,
          role: 'EMPLOYEE',
          isActive: true,
        },
      }).catch(() => {});
    }

    return user;
  }

  async updateUser(userId: string, data: { name?: string; email?: string; password?: string; roleId?: string; isActive?: boolean; phone?: string }) {
    if (data.isActive === true) {
      // Check if activating this user would exceed user limit
      const existingUser = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { company: true },
      });

      if (existingUser?.company?.tenantId && !existingUser.isActive) {
        const tenant = await this.prisma.tenant.findUnique({
          where: { id: existingUser.company.tenantId },
          select: { isRoot: true },
        });

        if (tenant && !tenant.isRoot) {
          const activeSub = await this.prisma.tenantSubscription.findFirst({
            where: { tenantId: existingUser.company.tenantId },
            orderBy: { createdAt: 'desc' },
            include: {
              planVersion: {
                include: { limits: true },
              },
            },
          });

          const maxUsersLimit = activeSub?.planVersion?.limits.find(l => l.limitCode === 'MAX_USERS')?.limitValue ?? 3;
          if (maxUsersLimit !== -1) {
            const currentActiveCount = await this.prisma.tenantMembership.count({
              where: { tenantId: existingUser.company.tenantId, isActive: true },
            });

            if (currentActiveCount >= maxUsersLimit) {
              throw new BadRequestException(
                `لا يمكن تفعيل المستخدم. لقد بلغت الحد الأقصى للمستخدمين النشطين (${maxUsersLimit} مستخدمين) في باقتك الحالية.`
              );
            }
          }
        }
      }
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.roleId !== undefined) updateData.roleId = data.roleId || null;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        isActive: true,
        role: { select: { id: true, name: true } },
      },
    });

    if (data.isActive !== undefined) {
      await this.prisma.tenantMembership.updateMany({
        where: { userId },
        data: { isActive: data.isActive },
      });
    }

    return updatedUser;
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('المستخدم غير موجود');

    const isOldValid = await bcrypt.compare(oldPassword, user.password);
    if (!isOldValid) {
      throw new UnauthorizedException('كلمة المرور الحالية غير صحيحة');
    }

    const hashedNew = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedNew },
    });

    return { message: 'تم تغيير كلمة المرور بنجاح' };
  }
}
