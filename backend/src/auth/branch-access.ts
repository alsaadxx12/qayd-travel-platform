export interface BranchAccessCandidate {
  id: string;
  code?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
  status?: string | null;
}

export interface BranchAccessResolution {
  allowedBranchIds: string[];
  canAccessAllBranches: boolean;
}

const normalize = (value?: string | null) =>
  (value || '')
    .trim()
    .toLocaleLowerCase('ar-IQ')
    .replace(/\s+/g, ' ');

const ALL_BRANCH_SCOPES = new Set([
  '*',
  'all',
  'all branches',
  'جميع الفروع',
  'كل الفروع',
]);

export const isActiveBranch = (branch: BranchAccessCandidate) => {
  const status = normalize(branch.status);
  return status === 'نشط' || status === 'active' || status === 'enabled';
};

const parseRoleScopes = (rawScope?: string | null): string[] => {
  const scope = (rawScope || '').trim();
  if (!scope) return [];

  try {
    const parsed = JSON.parse(scope);
    if (Array.isArray(parsed)) {
      return parsed.map((value) => normalize(String(value))).filter(Boolean);
    }
  } catch {
    // Legacy roles store a single branch name rather than a JSON array.
  }

  return scope
    .split(/[,،;|]/)
    .map(normalize)
    .filter(Boolean);
};

export function resolveBranchAccess(
  branches: BranchAccessCandidate[],
  membershipAllowedBranchIds: string[] = [],
  roleAllowedBranches?: string | null,
  tenantRole?: string | null,
): BranchAccessResolution {
  const activeBranches = branches.filter(isActiveBranch);
  const activeIds = new Set(activeBranches.map((branch) => branch.id));
  const explicitMembershipIds = [...new Set(membershipAllowedBranchIds.filter(Boolean))];

  if (explicitMembershipIds.length > 0) {
    return {
      allowedBranchIds: explicitMembershipIds.filter((id) => activeIds.has(id)),
      canAccessAllBranches: false,
    };
  }

  if (tenantRole === 'OWNER') {
    return {
      allowedBranchIds: activeBranches.map((branch) => branch.id),
      canAccessAllBranches: true,
    };
  }

  const roleScopes = parseRoleScopes(roleAllowedBranches);
  if (roleScopes.some((scope) => ALL_BRANCH_SCOPES.has(scope))) {
    return {
      allowedBranchIds: activeBranches.map((branch) => branch.id),
      canAccessAllBranches: true,
    };
  }

  // A user without a Role row keeps the legacy membership behaviour. An explicitly
  // empty Role scope is treated as no access so malformed role data never fails open.
  if (roleScopes.length === 0) {
    return roleAllowedBranches == null
      ? {
          allowedBranchIds: activeBranches.map((branch) => branch.id),
          canAccessAllBranches: true,
        }
      : { allowedBranchIds: [], canAccessAllBranches: false };
  }

  const requestedScopes = new Set(roleScopes);
  const allowedBranchIds = activeBranches
    .filter((branch) =>
      [branch.id, branch.code, branch.nameAr, branch.nameEn]
        .map(normalize)
        .some((identifier) => identifier && requestedScopes.has(identifier)),
    )
    .map((branch) => branch.id);

  return { allowedBranchIds, canAccessAllBranches: false };
}
