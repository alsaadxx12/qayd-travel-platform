import {
  Injectable,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private getDevUser() {
    return {
      id: 'dev-user-id',
      userId: 'dev-user-id',
      email: 'admin@travel.com',
      name: 'أحمد المحمود',
      companyId: 'default-company-id',
      companyName: 'شركة الفرسان للسياحة والسفر',
      role: 'المدير العام',
      permissions: ['*'],
      branchAccessResolved: false,
    };
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      if (process.env.NODE_ENV === 'production') {
        throw new UnauthorizedException('يلزم تسجيل الدخول للوصول إلى هذا المورد');
      }

      // Preserve the zero-config local demo only outside production.
      req.user = this.getDevUser();
      return true;
    }

    const activated = await super.canActivate(context);
    if (!activated) return false;

    const rawBranchId = req.headers['x-branch-id'];
    const requestedBranchId = Array.isArray(rawBranchId) ? rawBranchId[0] : rawBranchId;
    const user = req.user;

    if (requestedBranchId && user?.branchAccessResolved === true) {
      const normalizedBranchId = String(requestedBranchId).trim();
      const isAllBranches = normalizedBranchId.toUpperCase() === 'ALL';
      const canUseBranch = isAllBranches
        ? user.canAccessAllBranches === true
        : Array.isArray(user.allowedBranchIds) && user.allowedBranchIds.includes(normalizedBranchId);

      if (!canUseBranch) {
        throw new ForbiddenException('لا تملك صلاحية الوصول إلى الفرع المحدد');
      }
    }

    return true;
  }

  handleRequest(err: any, user: any) {
    if (err) throw err;
    if (!user) throw new UnauthorizedException('انتهت الجلسة أو أن رمز الدخول غير صالح');
    return user;
  }
}
