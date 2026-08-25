import { create } from 'zustand';

export interface PermissionAlertData {
  isOpen: boolean;
  actionTitle?: string;
  permissionCode?: string;
  description?: string;
  moduleTitle?: string;
}

interface PermissionAlertState {
  alertData: PermissionAlertData;
  showPermissionAlert: (data: Omit<PermissionAlertData, 'isOpen'>) => void;
  hidePermissionAlert: () => void;
}

export const usePermissionAlertStore = create<PermissionAlertState>((set) => ({
  alertData: {
    isOpen: false,
  },
  showPermissionAlert: (data) =>
    set({
      alertData: {
        ...data,
        isOpen: true,
      },
    }),
  hidePermissionAlert: () =>
    set({
      alertData: {
        isOpen: false,
      },
    }),
}));
