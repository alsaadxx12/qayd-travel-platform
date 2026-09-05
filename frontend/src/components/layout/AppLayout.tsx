import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { FiscalYearBanner } from './FiscalYearBanner';
import { Modal, TextInput, Button } from '@mantine/core';
import { useWorkspaceStore, WorkspaceTab } from '../../store/useWorkspaceStore';
import { useLanguageStore } from '../../store/useLanguageStore';
import { useAuthStore } from '../../store/useAuthStore';
import { IconSearch } from '@tabler/icons-react';
import { SubscriptionExpiredLockoutModal } from '../pricing/SubscriptionExpiredLockoutModal';
import { FeedbackFloatingDrawer } from '../feedback/FeedbackFloatingDrawer';
import { ImpersonationBanner } from './ImpersonationBanner';
import { PermissionDeniedModal } from '../common/PermissionDeniedModal';

const CopilotRoot = lazy(() =>
  import('../ai/CopilotRoot').then((m) => ({ default: m.CopilotRoot })),
);

export const AppLayout: React.FC = () => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [newJvOpen, setNewJvOpen] = useState(false);

  const { openTab } = useWorkspaceStore();
  const { direction, language } = useLanguageStore();
  const { token, user, refreshPermissions } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Keep user permissions synchronized with server on mount
  useEffect(() => {
    if (token && user) {
      refreshPermissions();
    }
  }, [token, user, refreshPermissions]);

  // Keyboard Event Listeners for Shortcuts (Ctrl+K, Ctrl+N)
  useEffect(() => {
    if (!token || !user) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setNewJvOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [token, user]);

  // Redirect to login if user is not authenticated
  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const navigateTo = (id: string, title: string, path: string) => {
    const tab: WorkspaceTab = { id, title, path, closable: true };
    openTab(tab);
    navigate(path);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100" dir={direction}>
      {/* Live Tenant Impersonation Simulation Banner */}
      <ImpersonationBanner />

      <div className="flex-1 flex overflow-hidden">
        {/* Compact Sidebar */}
        <Sidebar />

        {/* Main Workspace Container */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Global Fiscal Year Warning Banner */}
        <FiscalYearBanner />

        {/* Top Command Bar */}
        <Header
          onOpenSearch={() => setSearchOpen(true)}
          onNewJournalEntry={() => setNewJvOpen(true)}
          onNewVoucher={() => navigateTo('vouchers', language === 'ar' ? 'السندات المالية' : 'Vouchers', '/vouchers')}
        />

        {/* Main Dense Workspace Canvas */}
        <main className="flex-1 overflow-y-auto bg-[#F7F8FA]">
          <Outlet />
        </main>
      </div>
      </div>

      {/* Mandatory Subscription Expired Lockout Guard */}
      <SubscriptionExpiredLockoutModal />

      {/* Global Quick Search Modal (Ctrl+K) */}
      <Modal
        opened={searchOpen}
        onClose={() => setSearchOpen(false)}
        title={language === 'ar' ? 'البحث المحاسبي الفوري (Quick Search)' : 'Quick Search'}
        size="lg"
      >
        <div className="space-y-3" dir={direction}>
          <TextInput
            placeholder={language === 'ar' ? 'اكتب رقم القيد، رقم السند، كود الحساب، أو اسم العميل...' : 'Type entry #, voucher #, account code, or customer name...'}
            leftSection={<IconSearch size={16} />}
            autoFocus
          />
          <div className="text-xs font-bold text-slate-500 mb-1">
            {language === 'ar' ? 'الانتقال السريع للشاشات:' : 'Quick Navigation:'}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="light"
              color="gray"
              justify="space-between"
              onClick={() => {
                setSearchOpen(false);
                navigateTo('accounts', language === 'ar' ? 'شجرة الحسابات' : 'Chart of Accounts', '/accounts');
              }}
            >
              {language === 'ar' ? 'شجرة الحسابات (COA)' : 'Chart of Accounts (COA)'}
            </Button>
            <Button
              variant="light"
              color="gray"
              justify="space-between"
              onClick={() => {
                setSearchOpen(false);
                navigateTo('journal-entries', language === 'ar' ? 'القيود اليومية' : 'Journal Entries', '/journal-entries');
              }}
            >
              {language === 'ar' ? 'القيود اليومية (Journal)' : 'Journal Entries'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Unified Single Floating Support Drawer Button */}
      <FeedbackFloatingDrawer />

      <Suspense fallback={null}>
        <CopilotRoot />
      </Suspense>

      {/* Global Permission Denied Alert Modal */}
      <PermissionDeniedModal />
    </div>
  );
};

export default AppLayout;
