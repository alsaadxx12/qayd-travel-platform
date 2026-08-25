import { useMemo } from 'react';
import { useAuthStore } from '../store/useAuthStore';

export const ROUTE_PERMISSION_MAP: Record<string, { code: string; title: string }> = {
  '/dashboard': { code: 'dashboard.view', title: 'لوحة التحكم والمؤشرات' },
  '/tickets': { code: 'tickets.view', title: 'تذاكر الطيران' },
  '/visas': { code: 'visas.view', title: 'تأشيرات الدخول (الفيزا)' },
  '/groups': { code: 'groups.view', title: 'المجموعات والكروبات السياحية' },
  '/hotels': { code: 'hotels.view', title: 'حجوزات الفنادق' },
  '/refunds': { code: 'refunds.view', title: 'استرجاع التذاكر والخدمات' },
  '/reissues': { code: 'reissues.view', title: 'تغيير الحجوزات وإعادة الإصدار' },
  '/accounts': { code: 'accounts.view', title: 'شجرة الحسابات والدليل المالي' },
  '/chart-of-accounts': { code: 'accounts.view', title: 'شجرة الحسابات والدليل المالي' },
  '/journal-entries': { code: 'journal.view', title: 'القيود اليومية المحاسبية' },
  '/vouchers': { code: 'vouchers.view', title: 'السندات المالية (قبض وصرف)' },
  '/expenses': { code: 'vouchers.view', title: 'سجل المصاريف والنثريات' },
  '/receipt-vouchers': { code: 'vouchers.view', title: 'سندات القبض' },
  '/payment-vouchers': { code: 'vouchers.view', title: 'سندات الدفع' },
  '/invoices-services': { code: 'tickets.view', title: 'فواتير الخدمات' },
  '/sub-cashboxes-settlement': { code: 'subCashboxes.view', title: 'تسوية صناديق وعهد الموظفين' },
  '/cashboxes-banks': { code: 'cashboxes.view', title: 'الصناديق والبنوك' },
  '/partners': { code: 'partners.view', title: 'الشركاء والعملاء والموردين' },
  '/external-clearings': { code: 'clearings.view', title: 'المقاصات الخارجية ومزودي الخدمات' },
  '/profits': { code: 'profits.view', title: 'الأرباح وقائمة الدخل' },
  '/reports': { code: 'reports.statement.view', title: 'كشف الحساب والتقارير' },
  '/debts': { code: 'debts.view', title: 'تقرير الديون وأعمار الذمم' },
  '/debts-report': { code: 'debts.view', title: 'تقرير الديون وأعمار الذمم' },
  '/financial-reports': { code: 'financials.trialBalance', title: 'القوائم وميزان المراجعة' },
  '/trial-balance': { code: 'financials.trialBalance', title: 'القوائم وميزان المراجعة' },
  '/income-statement': { code: 'financials.incomeStatement', title: 'قائمة الدخل' },
  '/financial-statements': { code: 'financials.incomeStatement', title: 'القوائم المالية' },
  '/fiscal-years': { code: 'fiscal.view', title: 'السنوات والفترات المالية' },
  '/branches-structure': { code: 'branches.view', title: 'الفروع والهيكل الإداري والموظفين' },
  '/branches-settings': { code: 'branches.view', title: 'إعدادات الفروع' },
  '/audit-logs': { code: 'settings.view', title: 'سجل التدقيق' },
  '/print-templates': { code: 'settings.templates', title: 'قوالب الطباعة' },
  '/permission-groups': { code: 'roles.view', title: 'صلاحيات وأدوار الموظفين' },
  '/system-settings': { code: 'settings.view', title: 'إعدادات النظام والشركة' },
  '/subscription-settings': { code: 'subscription.view', title: 'الاشتراك والاستهلاك السحابي' },
  '/addons': { code: 'addons.view', title: 'متجر الإضافات السحابية' },
  '/addons-store': { code: 'addons.view', title: 'متجر الإضافات السحابية' },
  '/pricing-management': { code: 'pricing.manage', title: 'إدارة وتصميم باقات الأسعار' },
  '/pricing': { code: 'pricing.view', title: 'باقات الأسعار العامة' },
  '/feedback': { code: 'feedback.view', title: 'تذاكر الدعم والشكاوى' },
  '/feedback-tickets': { code: 'feedback.view', title: 'تذاكر الدعم والشكاوى' },
  '/help-center': { code: 'help.view', title: 'مركز المساعدة والتوثيق' },
  '/saas-admin': { code: 'saas.view', title: 'لوحة تحكم المنصة (SaaS Super Admin)' },
  '/deleted-records': { code: 'settings.view', title: 'سجل المحذوفات' },
};

export const usePermissions = () => {
  const user = useAuthStore((s) => s.user);
  const permissions = useMemo(() => user?.permissions || [], [user?.permissions]);

  const isWildcard = useMemo(() => {
    return permissions.includes('*') || user?.role === 'SUPER_ADMIN';
  }, [permissions, user?.role]);

  const hasPermission = (code: string): boolean => {
    if (!user) return false;
    if (isWildcard) return true;
    if (!code) return true;
    if (permissions.includes(code)) return true;

    // Check wildcard module prefix (e.g. 'tickets.*' grants 'tickets.view')
    const [mod] = code.split('.');
    if (mod && permissions.includes(`${mod}.*`)) return true;

    return false;
  };

  const hasRoutePermission = (pathname: string): boolean => {
    if (isWildcard) return true;
    const cleanPath = pathname.split('?')[0];
    const match = ROUTE_PERMISSION_MAP[cleanPath];
    if (!match) return true; // Unmapped paths default to open
    return hasPermission(match.code);
  };

  const hasAnyPermission = (codes: string[]): boolean => {
    if (isWildcard) return true;
    return codes.some((code) => hasPermission(code));
  };

  const hasAllPermissions = (codes: string[]): boolean => {
    if (isWildcard) return true;
    return codes.every((code) => hasPermission(code));
  };

  return {
    permissions,
    isWildcard,
    hasPermission,
    hasRoutePermission,
    hasAnyPermission,
    hasAllPermissions,
    userRole: user?.role,
  };
};
