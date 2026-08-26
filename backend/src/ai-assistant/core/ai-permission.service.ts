import { ForbiddenException, Injectable } from '@nestjs/common';
import { AiRequestContext, AiTool } from '../types/ai-tool.types';

/**
 * Applies the system RBAC to the AI tool layer.
 *
 * Tools the user cannot use are removed BEFORE the tool list reaches the model,
 * so the model never learns they exist and cannot attempt to call them. A second
 * check runs at execution time in case a model hallucinates a tool name.
 */
@Injectable()
export class AiPermissionService {
  /** Mirrors the frontend wildcard rules in usePermissions.ts */
  hasPermission(ctx: AiRequestContext, code: string): boolean {
    const perms = ctx.permissions || [];
    if (perms.includes('*') || perms.includes('SUPER_ADMIN')) return true;
    if (perms.includes(code)) return true;

    const moduleKey = code.split('.')[0];
    return perms.includes(`${moduleKey}.*`);
  }

  /** A tool is allowed when the user holds AT LEAST ONE of its required permissions. */
  canUseTool(ctx: AiRequestContext, tool: AiTool): boolean {
    if (!tool.requiredPermissions.length) return true;
    return tool.requiredPermissions.some((code) => this.hasPermission(ctx, code));
  }

  filterTools(ctx: AiRequestContext, tools: AiTool[]): AiTool[] {
    return tools.filter((tool) => this.canUseTool(ctx, tool));
  }

  assertToolAllowed(ctx: AiRequestContext, tool: AiTool): void {
    if (!this.canUseTool(ctx, tool)) {
      throw new ForbiddenException(
        `لا تملك صلاحية الوصول إلى هذه المعلومة (${tool.requiredPermissions.join(' أو ')})`,
      );
    }
  }

  /**
   * Validates a branch argument coming from the model against the user's branch access.
   * Returns the branch id to actually use, or undefined for "all branches".
   */
  resolveBranchId(ctx: AiRequestContext, requested?: string): string | undefined {
    const normalized = (requested || '').trim();

    if (!normalized || normalized.toUpperCase() === 'ALL') {
      if (ctx.canAccessAllBranches || !ctx.branchAccessResolved) return undefined;
      // Restricted user asking for "everything" only ever sees their own branches.
      return ctx.allowedBranchIds.length === 1 ? ctx.allowedBranchIds[0] : undefined;
    }

    if (!ctx.branchAccessResolved || ctx.canAccessAllBranches) return normalized;

    if (!ctx.allowedBranchIds.includes(normalized)) {
      throw new ForbiddenException('لا تملك صلاحية الوصول إلى بيانات هذا الفرع');
    }
    return normalized;
  }

  /** Branch ids a restricted user may see, used to post-filter aggregate results. */
  visibleBranchIds(ctx: AiRequestContext): string[] | null {
    if (!ctx.branchAccessResolved || ctx.canAccessAllBranches) return null;
    return ctx.allowedBranchIds;
  }
}
