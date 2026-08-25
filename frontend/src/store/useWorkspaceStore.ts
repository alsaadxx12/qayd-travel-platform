import { create } from 'zustand';

export interface WorkspaceTab {
  id: string;
  title: string;
  path: string;
  closable?: boolean;
  isPinned?: boolean;
  hasUnsavedChanges?: boolean;
}

interface WorkspaceState {
  tabs: WorkspaceTab[];
  activeTabId: string;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  openTab: (tab: WorkspaceTab) => void;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  closeTabsToRight: (tabId: string) => void;
  closeAllTabs: () => void;
  togglePinTab: (tabId: string) => void;
  setUnsavedChanges: (tabId: string, hasChanges: boolean) => void;
  setActiveTabId: (tabId: string) => void;
  setTabs: (tabs: WorkspaceTab[]) => void;
}

const STORAGE_KEY_TABS = 'enterprise_workspace_tabs';
const STORAGE_KEY_ACTIVE = 'enterprise_workspace_active_tab';

const defaultDashboardTab: WorkspaceTab = {
  id: 'dashboard',
  title: 'لوحة التحكم',
  path: '/dashboard',
  closable: false,
  isPinned: true,
};

const loadInitialTabs = (): WorkspaceTab[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_TABS);
    if (saved) {
      const parsed: WorkspaceTab[] = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure dashboard is always present
        if (!parsed.some((t) => t.id === 'dashboard')) {
          return [defaultDashboardTab, ...parsed];
        }
        return parsed;
      }
    }
  } catch (e) {}
  return [defaultDashboardTab];
};

const loadInitialActive = (): string => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_ACTIVE);
    if (saved) return saved;
  } catch (e) {}
  return 'dashboard';
};

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  tabs: loadInitialTabs(),
  activeTabId: loadInitialActive(),
  sidebarCollapsed: false,

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  openTab: (newTab) => {
    const { tabs } = get();
    const existing = tabs.find((t) => t.id === newTab.id || t.path === newTab.path);

    if (existing) {
      set({ activeTabId: existing.id });
      localStorage.setItem(STORAGE_KEY_ACTIVE, existing.id);
    } else {
      const updatedTabs = [...tabs, { ...newTab, closable: newTab.id !== 'dashboard' && (newTab.closable ?? true) }];
      set({ tabs: updatedTabs, activeTabId: newTab.id });
      localStorage.setItem(STORAGE_KEY_TABS, JSON.stringify(updatedTabs));
      localStorage.setItem(STORAGE_KEY_ACTIVE, newTab.id);
    }
  },

  closeTab: (tabId) => {
    const { tabs, activeTabId } = get();
    const tabToClose = tabs.find((t) => t.id === tabId);
    if (tabToClose && (tabToClose.isPinned || tabToClose.id === 'dashboard')) return;

    if (tabToClose?.hasUnsavedChanges) {
      if (!window.confirm(`هل أنت تأكد من إغلاق التبويب "${tabToClose.title}"؟ هناك تغييرات غير محفوظة.`)) {
        return;
      }
    }

    const filtered = tabs.filter((t) => t.id !== tabId);
    let nextActiveId = activeTabId;
    if (activeTabId === tabId) {
      const closedIndex = tabs.findIndex((t) => t.id === tabId);
      const nextTab = tabs[closedIndex - 1] || tabs[closedIndex + 1] || tabs[0];
      nextActiveId = nextTab ? nextTab.id : 'dashboard';
    }
    set({ tabs: filtered, activeTabId: nextActiveId });
    localStorage.setItem(STORAGE_KEY_TABS, JSON.stringify(filtered));
    localStorage.setItem(STORAGE_KEY_ACTIVE, nextActiveId);
  },

  closeOtherTabs: (tabId) => {
    const { tabs } = get();
    const filtered = tabs.filter((t) => t.id === tabId || t.isPinned || t.id === 'dashboard');
    set({ tabs: filtered, activeTabId: tabId });
    localStorage.setItem(STORAGE_KEY_TABS, JSON.stringify(filtered));
    localStorage.setItem(STORAGE_KEY_ACTIVE, tabId);
  },

  closeTabsToRight: (tabId) => {
    const { tabs } = get();
    const targetIdx = tabs.findIndex((t) => t.id === tabId);
    if (targetIdx === -1) return;

    const filtered = tabs.filter((t, idx) => idx <= targetIdx || t.isPinned || t.id === 'dashboard');
    set({ tabs: filtered, activeTabId: tabId });
    localStorage.setItem(STORAGE_KEY_TABS, JSON.stringify(filtered));
    localStorage.setItem(STORAGE_KEY_ACTIVE, tabId);
  },

  closeAllTabs: () => {
    const { tabs } = get();
    const filtered = tabs.filter((t) => t.isPinned || t.id === 'dashboard');
    set({ tabs: filtered, activeTabId: 'dashboard' });
    localStorage.setItem(STORAGE_KEY_TABS, JSON.stringify(filtered));
    localStorage.setItem(STORAGE_KEY_ACTIVE, 'dashboard');
  },

  togglePinTab: (tabId) => {
    const { tabs } = get();
    const updated = tabs.map((t) => {
      if (t.id === tabId && t.id !== 'dashboard') {
        return { ...t, isPinned: !t.isPinned };
      }
      return t;
    });
    set({ tabs: updated });
    localStorage.setItem(STORAGE_KEY_TABS, JSON.stringify(updated));
  },

  setUnsavedChanges: (tabId, hasChanges) => {
    const { tabs } = get();
    const updated = tabs.map((t) => (t.id === tabId ? { ...t, hasUnsavedChanges: hasChanges } : t));
    set({ tabs: updated });
  },

  setActiveTabId: (id) => {
    set({ activeTabId: id });
    localStorage.setItem(STORAGE_KEY_ACTIVE, id);
  },

  setTabs: (newTabs) => {
    set({ tabs: newTabs });
    localStorage.setItem(STORAGE_KEY_TABS, JSON.stringify(newTabs));
  },
}));
