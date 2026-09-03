import { notifications } from '@mantine/notifications';

// Patch Mantine notifications API so any direct or third-party invocation is completely silenced
if (typeof window !== 'undefined') {
  try {
    const n = notifications as any;
    n.show = () => '';
    n.update = () => '';
    n.hide = () => '';
    n.clean = () => {};
  } catch {
    // ignore
  }
}

/**
 * تم إلغاء وتعطيل جميع الإشعارات المنبثقة (Toasts/Popups) في النظام بالكامل بناءً على طلب المستخدم.
 * تم الإبقاء على الدوال كـ safe no-ops لضمان عدم حدوث أي كسر في استدعاءات الصفحات والمكونات.
 */
export const showSuccessNotification = (_title?: string, _message?: string) => {
  // Popups completely disabled
};

export const showErrorNotification = (title?: string, message?: string) => {
  if (typeof console !== 'undefined' && console.error) {
    console.error(`[Error Notification Silenced]: ${title || ''} - ${message || ''}`);
  }
};

export const showInfoNotification = (_title?: string, _message?: string) => {
  // Popups completely disabled
};

export const showWarningNotification = (title?: string, message?: string) => {
  if (typeof console !== 'undefined' && console.warn) {
    console.warn(`[Warning Notification Silenced]: ${title || ''} - ${message || ''}`);
  }
};

