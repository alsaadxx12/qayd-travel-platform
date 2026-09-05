import React, { useState, useEffect, useMemo } from 'react';
import { WorkspaceContext } from './topbar/WorkspaceContext';
import { useWorkspaceStore, WorkspaceTab } from '../../store/useWorkspaceStore';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  PlaneTakeoff,
  BadgeCheck,
  UsersRound,
  Building2,
  Undo2,
  RefreshCw,
  Luggage,
  Landmark,
  ListTree,
  BookOpen,
  Receipt,
  Banknote,
  Coins,
  Wallet,
  CreditCard,
  CalendarRange,
  Scale,
  Users,
  TrendingUp,
  FileText,
  Building,
  ShieldCheck,
  Settings,
  Trash2,
  CircleHelp,
  Store,
  MessageSquare,
  Sparkles,
  ChevronDown,
  Search,
  X,
} from 'lucide-react';
import { Tooltip } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { tenantsApi } from '../../api/tenants';
import { motion, AnimatePresence } from 'framer-motion';
import { NavSection } from './CustomizeSidebarModal';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguageStore } from '../../store/useLanguageStore';
import { usePermissions, ROUTE_PERMISSION_MAP } from '../../hooks/usePermissions';

const LUCIDE_ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>> = {
  LayoutDashboard,
  Briefcase,
  PlaneTakeoff,
  BadgeCheck,
  UsersRound,
  Building2,
  Undo2,
  RefreshCw,
  Luggage,
  Landmark,
  ListTree,
  BookOpen,
  Receipt,
  Banknote,
  Coins,
  Wallet,
  CreditCard,
  CalendarRange,
  Scale,
  Users,
  TrendingUp,
  FileText,
  Building,
  ShieldCheck,
  Settings,
  CircleHelp,
  Store,
  MessageSquare,
  Sparkles,
  Trash2,
};

const DEFAULT_SIDEBAR_SECTIONS: NavSection[] = [
  {
    key: 'operations',
    title: 'العمليات والخدمات',
    iconKey: 'Briefcase',
    items: [
      { id: 'tickets', title: 'تذاكر الطيران', path: '/tickets', iconKey: 'PlaneTakeoff' },
      { id: 'visas', title: 'الفيزا والتأشيرات', path: '/visas', iconKey: 'BadgeCheck' },
      { id: 'groups', title: 'تذاكر الكروبات', path: '/groups', iconKey: 'UsersRound' },
      { id: 'hotels', title: 'حجوزات الفنادق', path: '/hotels', iconKey: 'Building2' },
      { id: 'refunds', title: 'استرجاع التذاكر', path: '/refunds', iconKey: 'Undo2' },
      { id: 'reissues', title: 'تغيير التذاكر', path: '/reissues', iconKey: 'RefreshCw' },
      { id: 'baggage', title: 'بيع الوزن', path: '/baggage', iconKey: 'Luggage' },
    ],
  },
  {
    key: 'accounts',
    title: 'الحسابات',
    iconKey: 'Landmark',
    items: [
      { id: 'coa', title: 'شجرة الحسابات', path: '/accounts', iconKey: 'ListTree' },
      { id: 'statement', title: 'كشف الحساب', path: '/reports', iconKey: 'FileText' },
      { id: 'statement-qr', title: 'باركود كشف الحساب', path: '/statement-qr', iconKey: 'QrCode' },
      { id: 'journal-entries', title: 'القيود اليومية', path: '/journal-entries', iconKey: 'BookOpen' },
      { id: 'vouchers', title: 'السندات المالية', path: '/vouchers', iconKey: 'Receipt' },
      { id: 'expenses', title: 'سجل المصاريف', path: '/expenses', iconKey: 'Coins' },
      { id: 'sub-cashboxes-settlement', title: 'تحصيل الصناديق الفرعية', path: '/sub-cashboxes-settlement', iconKey: 'Banknote' },
      { id: 'cashboxes-banks', title: 'الصناديق والبنوك', path: '/cashboxes-banks', iconKey: 'Wallet' },
      { id: 'fiscal-years', title: 'السنوات والفترات المالية', path: '/fiscal-years', iconKey: 'CalendarRange' },
      { id: 'external-clearings', title: 'التصفيات الخارجية', path: '/external-clearings', iconKey: 'Scale' },
      { id: 'partners', title: 'الأطراف والحسابات', path: '/partners', iconKey: 'Users' },
      { id: 'profits', title: 'تحليل الربحية', path: '/profits', iconKey: 'TrendingUp' },
    ],
  },
  {
    key: 'reports',
    title: 'التقارير',
    iconKey: 'FileText',
    items: [
      { id: 'debts-report', title: 'تقرير الديون والذمم', path: '/debts-report', iconKey: 'Scale' },
      { id: 'employee-profits', title: 'أرباح الموظفين', path: '/employee-profits', iconKey: 'TrendingUp' },
      { id: 'income-statement', title: 'القوائم المالية', path: '/income-statement', iconKey: 'FileText' },
    ],
  },
  {
    key: 'admin',
    title: 'الإدارة والرقابة',
    iconKey: 'ShieldCheck',
    items: [
      { id: 'branches-structure', title: 'الفروع والهيكل الإداري', path: '/branches-structure', iconKey: 'Building' },
      { id: 'permission-groups', title: 'مجموعات الصلاحيات', path: '/permission-groups', iconKey: 'ShieldCheck' },
      { id: 'subscription-settings', title: 'الاشتراك والاستهلاك', path: '/subscription-settings', iconKey: 'Coins' },
      { id: 'pricing', title: 'باقات التسعير والترقية', path: '/pricing', iconKey: 'Receipt' },
      { id: 'pricing-management', title: 'تصميم وإدارة الباقات والشروط', path: '/pricing-management', iconKey: 'Sparkles' },
      { id: 'feedback-tickets', title: 'مركز البلاغات والدعم الفني', path: '/feedback-tickets', iconKey: 'MessageSquare' },
      { id: 'saas-admin', title: 'لوحة إدارة المنصة (SaaS)', path: '/saas-admin', iconKey: 'Sparkles' },
      { id: 'deleted-records', title: 'سجل المحذوفات', path: '/deleted-records', iconKey: 'Trash2' },
      { id: 'print-settings', title: 'إعدادات الطباعة', path: '/print-settings', iconKey: 'Printer' },
      { id: 'system-settings', title: 'إعدادات النظام', path: '/system-settings', iconKey: 'Settings' },
    ],
  },
];

export const Sidebar: React.FC = () => {
  const { sidebarCollapsed, openTab } = useWorkspaceStore();
  const { t, language, direction } = useLanguageStore();
  const isAr = language === 'ar';
  const navigate = useNavigate();
  const location = useLocation();

  const [sections] = useState<NavSection[]>(DEFAULT_SIDEBAR_SECTIONS);

  // Accordion behavior: only section containing active item is open
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {
      operations: false,
      accounts: false,
      reports: false,
      admin: false,
    };
    for (const section of DEFAULT_SIDEBAR_SECTIONS) {
      for (const item of section.items) {
        if (location.pathname === item.path || location.pathname.startsWith(item.path + '/')) {
          initial[section.key] = true;
          return initial;
        }
      }
    }
    initial.operations = true;
    return initial;
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => {
      const willOpen = !prev[key];
      if (willOpen) {
        return {
          operations: false,
          accounts: false,
          reports: false,
          admin: false,
          [key]: true,
        };
      }
      return { ...prev, [key]: false };
    });
  };

  const handleNavClick = (item: { id: string; title: string; path: string }) => {
    const tab: WorkspaceTab = {
      id: item.id,
      title: item.title,
      path: item.path,
      closable: item.id !== 'dashboard',
    };
    openTab(tab);
    navigate(item.path);
  };

  const isDashboardActive = location.pathname === '/dashboard' || location.pathname === '/';

  const user = useAuthStore((s) => s.user);

  const { data: currentTenant } = useQuery({
    queryKey: ['current-tenant'],
    queryFn: () => tenantsApi.getCurrentTenant(),
    staleTime: 60000,
  });

  const activeSub = currentTenant?.subscriptions?.[0] || currentTenant?.subscription;
  const isRootPlatformAdmin = currentTenant?.isRoot === true;

  const planName = useMemo(() => {
    if (isRootPlatformAdmin) {
      return language === 'ar' ? 'إدارة الاشتراك' : 'Subscription Management';
    }
    if (activeSub?.planVersion?.plan) {
      return language === 'ar' 
        ? (activeSub.planVersion.plan.nameAr || activeSub.planVersion.plan.name || activeSub.planVersion.plan.code)
        : (activeSub.planVersion.plan.nameEn || activeSub.planVersion.plan.name || activeSub.planVersion.plan.code);
    }
    return language === 'ar' ? 'الباقة الشاملة' : 'Pro Plan';
  }, [isRootPlatformAdmin, activeSub, language]);

  const planExpiryInfo = useMemo(() => {
    if (isRootPlatformAdmin) {
      return {
        text: language === 'ar' ? 'الخطة الدائمة بلا حدود' : 'Permanent unlimited plan',
        daysLeftText: language === 'ar' ? 'دائم' : 'Permanent',
        isExpiringSoon: false,
        isExpired: false,
        daysLeft: 999,
      };
    }
    if (activeSub?.currentPeriodEnd) {
      const end = new Date(activeSub.currentPeriodEnd);
      const now = new Date();
      const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const formattedDate = end.toLocaleDateString(language === 'ar' ? 'ar-IQ' : 'en-GB', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

      return {
        text: language === 'ar' ? `ينتهي في ${formattedDate}` : `Expires: ${formattedDate}`,
        daysLeftText: diffDays > 0 
          ? (language === 'ar' ? `باقي ${diffDays} يوم` : `${diffDays}d left`)
          : (language === 'ar' ? 'منتهي' : 'Expired'),
        isExpiringSoon: diffDays <= 5 && diffDays > 0,
        isExpired: diffDays <= 0,
        daysLeft: diffDays,
      };
    }
    return {
      text: language === 'ar' ? 'اشتراك نشط' : 'Active Plan',
      daysLeftText: language === 'ar' ? 'نشط' : 'Active',
      isExpiringSoon: false,
      isExpired: false,
      daysLeft: 30,
    };
  }, [isRootPlatformAdmin, activeSub, language]);

  const { hasPermission, isWildcard } = usePermissions();

  const hasItemPermission = (item: { id: string; path: string }): boolean => {
    if (!user) return false;

    // Special case: SaaS Admin is exclusive to Root Platform Admin
    if (item.path === '/saas-admin') {
      return isRootPlatformAdmin;
    }

    // The add-ons store is a platform-owner workspace, not a tenant utility page.
    if (item.path === '/addons') {
      return isRootPlatformAdmin;
    }

    if (isWildcard) {
      return true;
    }

    // Public / generic utility pages
    if (item.path === '/help-center') return true;

    const routeInfo = ROUTE_PERMISSION_MAP[item.path];
    if (routeInfo) {
      return hasPermission(routeInfo.code);
    }

    return true;
  };

  const [sidebarSearch, setSidebarSearch] = useState('');

  const visibleSections = useMemo(() => {
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => hasItemPermission(item)),
      }))
      .filter((section) => section.items.length > 0);
  }, [sections, user, isRootPlatformAdmin, isWildcard, hasPermission]);

  const filteredVisibleSections = useMemo(() => {
    if (!sidebarSearch.trim()) return visibleSections;
    const q = sidebarSearch.trim().toLowerCase();

    return visibleSections
      .map((section) => {
        const sectionTitle = (t(`nav.${section.key}`) || section.title).toLowerCase();
        const matchingItems = section.items.filter((item) => {
          const itemTitle = (t(`nav.${item.id}`) || item.title).toLowerCase();
          return itemTitle.includes(q) || sectionTitle.includes(q);
        });

        return {
          ...section,
          items: matchingItems,
        };
      })
      .filter((section) => section.items.length > 0);
  }, [visibleSections, sidebarSearch, t]);

  const isDashboardVisibleWithSearch = useMemo(() => {
    if (!sidebarSearch.trim()) return true;
    const q = sidebarSearch.trim().toLowerCase();
    const dashboardTitle = (t('nav.dashboard') || 'الرئيسية').toLowerCase();
    return dashboardTitle.includes(q);
  }, [sidebarSearch, t]);

  const activeSectionKey = useMemo(() => {
    for (const section of visibleSections) {
      for (const item of section.items) {
        if (location.pathname === item.path || location.pathname.startsWith(item.path + '/')) {
          return section.key;
        }
      }
    }
    return null;
  }, [location.pathname, visibleSections]);

  useEffect(() => {
    if (activeSectionKey) {
      setOpenSections({
        operations: false,
        accounts: false,
        reports: false,
        admin: false,
        [activeSectionKey]: true,
      });
    }
  }, [activeSectionKey]);

  return (
    <aside
      className={`bg-white text-slate-700 min-h-screen flex flex-col ${
        direction === 'rtl' ? 'border-l' : 'border-r'
      } border-[#E5E7EB] transition-all duration-200 shrink-0 no-print select-none ${
        sidebarCollapsed ? 'w-[76px]' : 'w-[256px]'
      }`}
      dir={direction}
      style={{ fontFamily: language === 'ar' ? "'IBM Plex Sans Arabic', system-ui, sans-serif" : "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif" }}
    >
      {/* ─── 1. Header (60px height matching topbar) ─── */}
      <div className="h-[60px] border-b border-[#E5E7EB] flex items-center px-3 bg-white shrink-0">
        {!sidebarCollapsed ? (
          <div className="flex-1 min-w-0">
            <WorkspaceContext />
          </div>
        ) : (
          <div className="flex items-center justify-center w-full">
            <div className="w-10 h-10 rounded-xl bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center font-bold shadow-2xs">
              <Building2 size={20} />
            </div>
          </div>
        )}
      </div>

      {/* ─── Quick Search Input (Clean & Spacious) ─── */}
      {!sidebarCollapsed && (
        <div className="px-2.5 pt-2.5 pb-1 shrink-0">
          <div className="relative flex items-center">
            <Search
              size={14}
              className={`absolute ${direction === 'rtl' ? 'right-2.5' : 'left-2.5'} text-slate-400 pointer-events-none`}
            />
            <input
              type="search"
              aria-label={isAr ? 'بحث في قائمة التنقل' : 'Search the navigation menu'}
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              placeholder={isAr ? 'بحث في القائمة...' : 'Search in menu...'}
              className={`w-full h-8.5 ${
                direction === 'rtl' ? 'pr-8 pl-7' : 'pl-8 pr-7'
              } rounded-xl bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200/90 focus:border-[#F45A0A] text-xs font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal outline-none transition-all shadow-2xs`}
            />
            {sidebarSearch && (
              <button
                type="button"
                onClick={() => setSidebarSearch('')}
                aria-label={isAr ? 'مسح بحث القائمة' : 'Clear menu search'}
                className={`absolute ${direction === 'rtl' ? 'left-2' : 'right-2'} text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer`}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── 2. Navigation List ─── */}
      <nav className="flex-1 py-2 overflow-y-auto px-2.5 space-y-2 date-picker-scroll">
        {/* Direct Dashboard Button */}
        {isDashboardVisibleWithSearch && (!sidebarCollapsed ? (
          <button
            type="button"
            onClick={() => handleNavClick({ id: 'dashboard', title: t('nav.dashboard'), path: '/dashboard' })}
            className="group relative w-full h-[48px] px-2.5 rounded-xl flex items-center gap-3 transition-colors cursor-pointer select-none hover:bg-slate-100/70"
          >
            <div
              className={`w-9.5 h-9.5 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                isDashboardActive
                  ? 'bg-[#F45A0A] text-white shadow-xs'
                  : 'bg-slate-100/80 text-slate-600 group-hover:bg-slate-200/80 group-hover:text-slate-950'
              }`}
            >
              <LayoutDashboard size={20} strokeWidth={isDashboardActive ? 2.3 : 1.9} />
            </div>
            <span className={`truncate ${isDashboardActive ? 'font-black text-slate-950 text-[14px]' : 'font-bold text-slate-800 text-[14px] group-hover:text-slate-950'}`}>
              {t('nav.dashboard')}
            </span>
          </button>
        ) : (
          <Tooltip
            label={t('nav.dashboard')}
            position={language === 'ar' ? 'left' : 'right'}
            withArrow
            styles={{ tooltip: { backgroundColor: '#111827', color: '#FFFFFF', borderRadius: '8px', fontSize: '13px', fontWeight: 700 } }}
          >
            <button
              type="button"
              onClick={() => handleNavClick({ id: 'dashboard', title: t('nav.dashboard'), path: '/dashboard' })}
              className="relative w-11 h-11 rounded-xl flex items-center justify-center mx-auto transition-all cursor-pointer"
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                  isDashboardActive
                    ? 'bg-[#F45A0A] text-white shadow-xs'
                    : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80 hover:text-slate-950'
                }`}
              >
                <LayoutDashboard size={20} strokeWidth={isDashboardActive ? 2.3 : 1.9} />
              </div>
            </button>
          </Tooltip>
        ))}

        {isDashboardVisibleWithSearch && <div className="my-1.5 border-b border-slate-100" />}

        {/* Empty state when searching with no matching results */}
        {sidebarSearch.trim() && filteredVisibleSections.length === 0 && !isDashboardVisibleWithSearch && (
          <div className="py-8 text-center text-slate-400 space-y-1">
            <Search size={22} className="mx-auto text-slate-300" />
            <p className="text-xs font-bold">{isAr ? 'لا توجد عناصر مطابقة' : 'No matching items'}</p>
          </div>
        )}

        {/* Sections grouped cleanly */}
        {filteredVisibleSections.map((section, sIdx) => {
          const SectionIcon = LUCIDE_ICON_MAP[section.iconKey] || PlaneTakeoff;
          const isOpen = Boolean(sidebarSearch.trim()) || openSections[section.key];
          const sectionTitle = t(`nav.${section.key}`) || section.title;

          return (
            <div key={section.key} className="space-y-1">
              {/* Optional separator before accounts and admin */}
              {sIdx === 1 && <div className="my-2 border-b border-slate-100" />}

              {/* Section Header Toggle */}
              {!sidebarCollapsed ? (
                <button
                  type="button"
                  onClick={() => toggleSection(section.key)}
                  className="group w-full h-[44px] px-2.5 rounded-xl flex items-center justify-between text-xs font-bold text-slate-700 hover:bg-slate-100/70 hover:text-slate-950 transition-colors cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8.5 h-8.5 rounded-lg bg-slate-100/80 text-slate-600 flex items-center justify-center shrink-0 group-hover:bg-slate-200/80 group-hover:text-slate-950 transition-colors">
                      <SectionIcon size={18} strokeWidth={1.9} />
                    </div>
                    <span className="truncate font-black text-slate-900 text-[14px]">{sectionTitle}</span>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'}`}
                  />
                </button>
              ) : (
                <Tooltip
                  label={sectionTitle}
                  position={language === 'ar' ? 'left' : 'right'}
                  withArrow
                  styles={{ tooltip: { backgroundColor: '#111827', color: '#FFFFFF', borderRadius: '8px', fontSize: '13px', fontWeight: 700 } }}
                >
                  <button
                    type="button"
                    onClick={() => toggleSection(section.key)}
                    aria-label={sectionTitle}
                    className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto cursor-pointer transition-colors text-slate-600 hover:bg-slate-100"
                  >
                    <SectionIcon size={20} />
                  </button>
                </Tooltip>
              )}

              {/* Section Items */}
              {!sidebarCollapsed ? (
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.16, ease: 'easeInOut' }}
                      className="overflow-hidden pr-1.5 space-y-1"
                    >
                      {section.items.map((item) => {
                        const ItemIcon = LUCIDE_ICON_MAP[item.iconKey] || FileText;
                        const isActive =
                          location.pathname === item.path ||
                          (location.pathname.startsWith(item.path + '/') && item.path !== '/');
                        const rawT = t(`nav.${item.id}`);
                        const itemTitle = (rawT && !rawT.startsWith('nav.')) ? rawT : item.title;

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleNavClick({ ...item, title: itemTitle })}
                            className="group relative w-full h-[46px] px-2 rounded-xl flex items-center gap-3 transition-colors cursor-pointer select-none hover:bg-slate-100/70"
                          >
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                                isActive
                                  ? 'bg-[#F45A0A] text-white shadow-xs'
                                  : 'bg-slate-100/80 text-slate-600 group-hover:bg-slate-200/80 group-hover:text-slate-950'
                              }`}
                            >
                              <ItemIcon
                                size={19}
                                strokeWidth={isActive ? 2.3 : 1.9}
                              />
                            </div>
                            <span className={`truncate ${isActive ? 'font-black text-slate-950 text-[14px]' : 'font-bold text-slate-800 text-[13.5px] group-hover:text-slate-950'}`}>
                              {itemTitle}
                            </span>
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              ) : (
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const ItemIcon = LUCIDE_ICON_MAP[item.iconKey] || FileText;
                    const isActive =
                      location.pathname === item.path ||
                      (location.pathname.startsWith(item.path + '/') && item.path !== '/');
                    const rawT = t(`nav.${item.id}`);
                    const itemTitle = (rawT && !rawT.startsWith('nav.')) ? rawT : item.title;

                    return (
                      <Tooltip
                        key={item.id}
                        label={itemTitle}
                        position={language === 'ar' ? 'left' : 'right'}
                        withArrow
                        styles={{ tooltip: { backgroundColor: '#111827', color: '#FFFFFF', borderRadius: '8px', fontSize: '13px', fontWeight: 700 } }}
                      >
                        <button
                          type="button"
                          onClick={() => handleNavClick({ ...item, title: itemTitle })}
                          className="relative w-11 h-11 rounded-xl flex items-center justify-center mx-auto transition-all cursor-pointer"
                        >
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                              isActive
                                ? 'bg-[#F45A0A] text-white shadow-xs'
                                : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80 hover:text-slate-950'
                            }`}
                          >
                            <ItemIcon size={19} strokeWidth={isActive ? 2.3 : 1.9} />
                          </div>
                        </button>
                      </Tooltip>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* ─── 3. Fixed Bottom Area: Addons Store + Active Subscription ─── */}
      <div className="p-2 border-t border-[#E5E7EB] bg-slate-50/80 shrink-0 space-y-1.5">
        {!sidebarCollapsed ? (
          <>
            {/* Fixed Addons Store Card */}
            <button
              type="button"
              onClick={() => handleNavClick({ id: 'addons-store', title: isAr ? 'متجر الإضافات' : 'Addons Store', path: '/addons' })}
              className={`group w-full p-2 rounded-xl border bg-white text-start transition-all cursor-pointer shadow-2xs ${
                location.pathname === '/addons'
                  ? 'border-[#F45A0A] ring-2 ring-orange-100'
                  : 'border-slate-200 hover:border-orange-300 hover:bg-orange-50/40'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-xs transition-colors ${
                  location.pathname === '/addons'
                    ? 'bg-[#F45A0A] text-white'
                    : 'bg-[#FFF3E8] text-[#F45A0A] group-hover:bg-[#F45A0A] group-hover:text-white'
                }`}>
                  <Store size={16} strokeWidth={2.2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11.5px] font-black text-slate-950 truncate block">
                      {isAr ? 'متجر الإضافات' : 'Addons Store'}
                    </span>
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md shrink-0 bg-orange-100 text-[#F45A0A]">
                      {isAr ? 'المتجر' : 'Store'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block truncate mt-0.5 font-semibold">
                    {isAr ? 'ترقية وتفعيل الميزات الإضافية' : 'Activate extra modules'}
                  </span>
                </div>
              </div>
            </button>

            {/* Fixed Active Subscription Card */}
            <button
              type="button"
              onClick={() => handleNavClick({ id: 'subscription-settings', title: planName, path: '/subscription-settings' })}
              className={`group w-full p-2 rounded-xl border bg-white text-start transition-all cursor-pointer shadow-2xs ${
                location.pathname === '/subscription-settings'
                  ? 'border-[#F45A0A] ring-2 ring-orange-100'
                  : 'border-slate-200 hover:border-orange-300 hover:bg-orange-50/40'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-xs transition-colors ${
                  location.pathname === '/subscription-settings'
                    ? 'bg-[#F45A0A] text-white'
                    : 'bg-[#FFF3E8] text-[#F45A0A] group-hover:bg-[#F45A0A] group-hover:text-white'
                }`}>
                  <CreditCard size={16} strokeWidth={2.2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11.5px] font-black text-slate-950 truncate block">
                      {planName}
                    </span>
                    {planExpiryInfo.daysLeftText && (
                      <span
                        className={`text-[9px] font-black px-1.5 py-0.5 rounded-md shrink-0 ${
                          planExpiryInfo.isExpired
                            ? 'bg-rose-100 text-rose-700'
                            : planExpiryInfo.isExpiringSoon
                            ? 'bg-amber-100 text-amber-700 animate-pulse'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {planExpiryInfo.daysLeftText}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 block truncate mt-0.5 font-semibold">
                    {planExpiryInfo.text}
                  </span>
                </div>
              </div>
            </button>
          </>
        ) : (
          <div className="space-y-1.5">
            {/* Collapsed Addons Button */}
            <Tooltip
              label={isAr ? 'متجر الإضافات' : 'Addons Store'}
              position={language === 'ar' ? 'left' : 'right'}
              withArrow
              styles={{ tooltip: { backgroundColor: '#111827', color: '#FFFFFF', borderRadius: '8px', fontSize: '12px', fontWeight: 700 } }}
            >
              <button
                type="button"
                onClick={() => handleNavClick({ id: 'addons-store', title: isAr ? 'متجر الإضافات' : 'Addons Store', path: '/addons' })}
                aria-label={isAr ? 'متجر الإضافات' : 'Addons Store'}
                className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto transition-all cursor-pointer shadow-xs ${
                  location.pathname === '/addons'
                    ? 'bg-[#F45A0A] text-white ring-2 ring-orange-200'
                    : 'bg-[#FFF3E8] text-[#F45A0A] hover:bg-[#F45A0A] hover:text-white border border-orange-200/80'
                }`}
              >
                <Store size={18} strokeWidth={2.2} />
              </button>
            </Tooltip>

            {/* Collapsed Subscription Button */}
            <Tooltip
              label={`${planName} • ${planExpiryInfo.text}`}
              position={language === 'ar' ? 'left' : 'right'}
              withArrow
              styles={{ tooltip: { backgroundColor: '#111827', color: '#FFFFFF', borderRadius: '8px', fontSize: '12px', fontWeight: 700 } }}
            >
              <button
                type="button"
                onClick={() => handleNavClick({ id: 'subscription-settings', title: planName, path: '/subscription-settings' })}
                aria-label={isAr ? `الاشتراك: ${planName}` : `Subscription: ${planName}`}
                className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto transition-all cursor-pointer shadow-xs ${
                  location.pathname === '/subscription-settings'
                    ? 'bg-[#F45A0A] text-white ring-2 ring-orange-200'
                    : 'bg-[#FFF3E8] text-[#F45A0A] hover:bg-[#F45A0A] hover:text-white border border-orange-200/80'
                }`}
              >
                <CreditCard size={18} strokeWidth={2.2} />
              </button>
            </Tooltip>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
