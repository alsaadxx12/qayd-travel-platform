import { create } from 'zustand';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone?: string;
  companyId: string;
  companyName: string;
  companyCurrency: string;
  role: string;
  permissions: string[];
  allowedBranchIds?: string[];
  canAccessAllBranches?: boolean;
  activeBranchId?: string;
  activeBranchName?: string;
  activeBranchCode?: string;
  isImpersonating?: boolean;
}

export interface ImpersonatedTenantInfo {
  id: string;
  name: string;
  slug: string;
}

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isImpersonating: boolean;
  impersonatedTenant: ImpersonatedTenantInfo | null;
  originalAdminUser: UserProfile | null;
  originalAdminToken: string | null;
  setAuth: (user: UserProfile, token: string) => void;
  logout: () => void;
  startImpersonation: (
    impersonatedUser: UserProfile,
    impersonatedToken: string,
    tenantInfo: ImpersonatedTenantInfo,
  ) => void;
  stopImpersonation: () => void;
  refreshPermissions: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('token'),
  isImpersonating: localStorage.getItem('isImpersonating') === 'true',
  impersonatedTenant: JSON.parse(localStorage.getItem('impersonatedTenant') || 'null'),
  originalAdminUser: JSON.parse(localStorage.getItem('originalAdminUser') || 'null'),
  originalAdminToken: localStorage.getItem('originalAdminToken'),

  setAuth: (user, token) => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', token);
    set({ user, token });
  },

  logout: () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('isImpersonating');
    localStorage.removeItem('impersonatedTenant');
    localStorage.removeItem('originalAdminUser');
    localStorage.removeItem('originalAdminToken');
    set({
      user: null,
      token: null,
      isImpersonating: false,
      impersonatedTenant: null,
      originalAdminUser: null,
      originalAdminToken: null,
    });
  },

  startImpersonation: (impersonatedUser, impersonatedToken, tenantInfo) => {
    const currentAdminUser = get().user;
    const currentAdminToken = get().token;

    if (currentAdminUser && currentAdminToken) {
      localStorage.setItem('originalAdminUser', JSON.stringify(currentAdminUser));
      localStorage.setItem('originalAdminToken', currentAdminToken);
    }

    localStorage.setItem('isImpersonating', 'true');
    localStorage.setItem('impersonatedTenant', JSON.stringify(tenantInfo));
    localStorage.setItem('user', JSON.stringify(impersonatedUser));
    localStorage.setItem('token', impersonatedToken);

    set({
      user: impersonatedUser,
      token: impersonatedToken,
      isImpersonating: true,
      impersonatedTenant: tenantInfo,
      originalAdminUser: currentAdminUser,
      originalAdminToken: currentAdminToken,
    });
  },

  stopImpersonation: () => {
    const adminUser = get().originalAdminUser || JSON.parse(localStorage.getItem('originalAdminUser') || 'null');
    const adminToken = get().originalAdminToken || localStorage.getItem('originalAdminToken');

    localStorage.removeItem('isImpersonating');
    localStorage.removeItem('impersonatedTenant');
    localStorage.removeItem('originalAdminUser');
    localStorage.removeItem('originalAdminToken');

    if (adminUser && adminToken) {
      localStorage.setItem('user', JSON.stringify(adminUser));
      localStorage.setItem('token', adminToken);
      set({
        user: adminUser,
        token: adminToken,
        isImpersonating: false,
        impersonatedTenant: null,
        originalAdminUser: null,
        originalAdminToken: null,
      });
    }
  },

  refreshPermissions: async () => {
    const { token, user } = get();
    if (!token || !user) return;
    try {
      const response = await fetch('http://localhost:4000/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;
      const profile = await response.json();
      
      let permissions: string[] = [];
      if (profile.role?.permissions) {
        permissions = Array.isArray(profile.role.permissions)
          ? profile.role.permissions
          : typeof profile.role.permissions === 'string'
          ? JSON.parse(profile.role.permissions)
          : [];
      } else if (profile.permissions) {
        permissions = Array.isArray(profile.permissions) ? profile.permissions : [];
      }
      
      const roleName = profile.role?.name || user.role;
      const updatedUser = { ...user, permissions, role: roleName };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      set({ user: updatedUser });
    } catch {
      // Silent fallback — keep current permissions
    }
  },
}));
