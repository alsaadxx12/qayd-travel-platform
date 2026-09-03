import React, { Suspense, lazy } from 'react';
import { PWAInstallPrompt } from './components/common/PWAInstallPrompt';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { PermissionRouteGuard } from './components/auth/PermissionRouteGuard';
import { useFont } from './hooks/useFont';
import { useAuthStore } from './store/useAuthStore';

const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const TicketsPage = lazy(() => import('./pages/tickets/TicketsPage').then((m) => ({ default: m.TicketsPage })));
const VisasPage = lazy(() => import('./pages/visas/VisasPage').then((m) => ({ default: m.VisasPage })));
const GroupsPage = lazy(() => import('./pages/groups/GroupsPage').then((m) => ({ default: m.GroupsPage })));
const HotelsPage = lazy(() => import('./pages/hotels/HotelsPage').then((m) => ({ default: m.HotelsPage })));
const RefundsPage = lazy(() => import('./pages/refunds/RefundsPage').then((m) => ({ default: m.RefundsPage })));
const ReissuesPage = lazy(() => import('./pages/reissues/ReissuesPage').then((m) => ({ default: m.ReissuesPage })));
const BaggagePage = lazy(() => import('./pages/baggage/BaggagePage').then((m) => ({ default: m.BaggagePage })));
const ChartOfAccountsPage = lazy(() => import('./pages/ChartOfAccountsPage').then((m) => ({ default: m.ChartOfAccountsPage })));
const JournalEntriesPage = lazy(() => import('./pages/JournalEntriesPage').then((m) => ({ default: m.JournalEntriesPage })));
const VouchersPage = lazy(() => import('./pages/VouchersPage').then((m) => ({ default: m.VouchersPage })));
const ExpensesPage = lazy(() => import('./pages/ExpensesPage').then((m) => ({ default: m.ExpensesPage })));
const CashboxesBanksPage = lazy(() => import('./pages/CashboxesBanksPage').then((m) => ({ default: m.CashboxesBanksPage })));
const PartnersPage = lazy(() => import('./pages/PartnersPage').then((m) => ({ default: m.PartnersPage })));
const ProfitsPage = lazy(() => import('./pages/ProfitsPage').then((m) => ({ default: m.ProfitsPage })));
const IncomeStatementPage = lazy(() => import('./pages/IncomeStatementPage').then((m) => ({ default: m.IncomeStatementPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const DebtsReportPage = lazy(() => import('./pages/DebtsReportPage').then((m) => ({ default: m.DebtsReportPage })));
const FinancialReportsPage = lazy(() => import('./pages/FinancialReportsPage').then((m) => ({ default: m.FinancialReportsPage })));
const ExternalClearingsPage = lazy(() => import('./pages/ExternalClearingsPage').then((m) => ({ default: m.ExternalClearingsPage })));
const ClearingAccountProfilePage = lazy(() => import('./pages/ClearingAccountProfilePage').then((m) => ({ default: m.ClearingAccountProfilePage })));
const BranchesStructurePage = lazy(() => import('./pages/admin/BranchesStructurePage').then((m) => ({ default: m.BranchesStructurePage })));
const PermissionGroupsPage = lazy(() => import('./pages/admin/PermissionGroupsPage').then((m) => ({ default: m.PermissionGroupsPage })));
const SystemSettingsPage = lazy(() => import('./pages/admin/SystemSettingsPage').then((m) => ({ default: m.SystemSettingsPage })));
const CompanySettingsPage = lazy(() => import('./pages/admin/CompanySettingsPage').then((m) => ({ default: m.CompanySettingsPage })));
const PrintSettingsPage = lazy(() => import('./pages/admin/PrintSettingsPage').then((m) => ({ default: m.PrintSettingsPage })));
const AddonsStorePage = lazy(() => import('./pages/AddonsStorePage').then((m) => ({ default: m.AddonsStorePage })));
const FiscalYearsPage = lazy(() => import('./pages/FiscalYearsPage').then((m) => ({ default: m.FiscalYearsPage })));
const SubCashboxesSettlementPage = lazy(() => import('./pages/SubCashboxesSettlementPage').then((m) => ({ default: m.SubCashboxesSettlementPage })));
const MapTestPage = lazy(() => import('./pages/MapTestPage').then((m) => ({ default: m.MapTestPage })));
const PricingPage = lazy(() => import('./pages/PricingPage').then((m) => ({ default: m.PricingPage })));
const PricingManagementPage = lazy(() => import('./pages/admin/PricingManagementPage').then((m) => ({ default: m.PricingManagementPage })));
const SubscriptionSettingsPage = lazy(() => import('./pages/admin/SubscriptionSettingsPage').then((m) => ({ default: m.SubscriptionSettingsPage })));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage').then((m) => ({ default: m.OnboardingPage })));
const SaasAdminDashboardPage = lazy(() => import('./pages/saas-admin/SaasAdminDashboardPage').then((m) => ({ default: m.SaasAdminDashboardPage })));
const FeedbackManagementPage = lazy(() => import('./pages/admin/FeedbackManagementPage').then((m) => ({ default: m.FeedbackManagementPage })));
const HelpCenterPage = lazy(() => import('./pages/help/HelpCenterPage').then((m) => ({ default: m.HelpCenterPage })));
const BranchesSettingsPage = lazy(() => import('./pages/BranchesSettingsPage').then((m) => ({ default: m.BranchesSettingsPage })));
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage').then((m) => ({ default: m.AuditLogsPage })));
const PrintTemplatesPage = lazy(() => import('./pages/admin/PrintTemplatesPage').then((m) => ({ default: m.PrintTemplatesPage })));
const InvoicesServicesPage = lazy(() => import('./pages/InvoicesServicesPage').then((m) => ({ default: m.InvoicesServicesPage })));
const ReceiptVouchersPage = lazy(() => import('./pages/ReceiptVouchersPage').then((m) => ({ default: m.ReceiptVouchersPage })));
const PaymentVouchersPage = lazy(() => import('./pages/PaymentVouchersPage').then((m) => ({ default: m.PaymentVouchersPage })));
const DeletedRecordsPage = lazy(() => import('./pages/archive/DeletedRecordsPage').then((m) => ({ default: m.DeletedRecordsPage })));
const StatementPortalPage = lazy(() => import('./pages/portal/StatementPortalPage').then((m) => ({ default: m.StatementPortalPage })));
const StatementQrPage = lazy(() => import('./pages/admin/StatementQrPage').then((m) => ({ default: m.StatementQrPage })));

// Smart Root Redirect: unauthenticated users always go to /login, authenticated users go to /dashboard
const RootRedirect: React.FC = () => {
  const { token, user } = useAuthStore();
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to="/dashboard" replace />;
};

export const App: React.FC = () => {
  // Initialize font from localStorage on app start
  useFont();

  return (
    <BrowserRouter>
      {/* PWA Install Prompt — floating banner when browser supports installation */}
      <PWAInstallPrompt />
      <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/map-test" element={<MapTestPage />} />

          {/* The customer-facing statement page. It sits OUTSIDE AppLayout on
              purpose: whoever scans the barcode is not a user of the system, has no
              login, and must not be shown the staff shell or redirected to it. */}
          <Route path="/s/:token" element={<StatementPortalPage />} />

          <Route element={<AppLayout />}>
            <Route path="/" element={<RootRedirect />} />
            
            <Route
              path="/dashboard"
              element={
                <PermissionRouteGuard routePath="/dashboard">
                  <DashboardPage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/tickets"
              element={
                <PermissionRouteGuard routePath="/tickets">
                  <TicketsPage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/visas"
              element={
                <PermissionRouteGuard routePath="/visas">
                  <VisasPage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/groups"
              element={
                <PermissionRouteGuard routePath="/groups">
                  <GroupsPage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/hotels"
              element={
                <PermissionRouteGuard routePath="/hotels">
                  <HotelsPage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/refunds"
              element={
                <PermissionRouteGuard routePath="/refunds">
                  <RefundsPage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/reissues"
              element={
                <PermissionRouteGuard routePath="/reissues">
                  <ReissuesPage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/baggage"
              element={
                <PermissionRouteGuard routePath="/baggage">
                  <BaggagePage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/journal-entries"
              element={
                <PermissionRouteGuard routePath="/journal-entries">
                  <JournalEntriesPage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/statement-qr"
              element={
                <PermissionRouteGuard routePath="/statement-qr">
                  <StatementQrPage />
                </PermissionRouteGuard>
              }
            />

            <Route
              path="/vouchers"
              element={
                <PermissionRouteGuard routePath="/vouchers">
                  <VouchersPage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/expenses"
              element={
                <PermissionRouteGuard routePath="/expenses">
                  <ExpensesPage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/receipt-vouchers"
              element={
                <PermissionRouteGuard routePath="/receipt-vouchers">
                  <ReceiptVouchersPage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/payment-vouchers"
              element={
                <PermissionRouteGuard routePath="/payment-vouchers">
                  <PaymentVouchersPage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/invoices-services"
              element={
                <PermissionRouteGuard routePath="/invoices-services">
                  <InvoicesServicesPage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/cashboxes-banks"
              element={
                <PermissionRouteGuard routePath="/cashboxes-banks">
                  <CashboxesBanksPage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/partners"
              element={
                <PermissionRouteGuard routePath="/partners">
                  <PartnersPage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/sub-cashboxes-settlement"
              element={
                <PermissionRouteGuard routePath="/sub-cashboxes-settlement">
                  <SubCashboxesSettlementPage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/fiscal-years"
              element={
                <PermissionRouteGuard routePath="/fiscal-years">
                  <FiscalYearsPage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/profits"
              element={
                <PermissionRouteGuard routePath="/profits">
                  <ProfitsPage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/income-statement"
              element={
                <PermissionRouteGuard routePath="/income-statement">
                  <IncomeStatementPage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/reports"
              element={
                <PermissionRouteGuard routePath="/reports">
                  <ReportsPage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/debts"
              element={
                <PermissionRouteGuard routePath="/debts">
                  <DebtsReportPage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/debts-report"
              element={
                <PermissionRouteGuard routePath="/debts-report">
                  <DebtsReportPage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/financial-reports"
              element={
                <PermissionRouteGuard routePath="/financial-reports">
                  <FinancialReportsPage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/external-clearings"
              element={
                <PermissionRouteGuard routePath="/external-clearings">
                  <ExternalClearingsPage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/clearing-account-profile/:id"
              element={
                <PermissionRouteGuard routePath="/clearing-account-profile/:id">
                  <ClearingAccountProfilePage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/branches-structure"
              element={
                <PermissionRouteGuard routePath="/branches-structure">
                  <BranchesStructurePage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/branches-settings"
              element={
                <PermissionRouteGuard routePath="/branches-settings">
                  <BranchesSettingsPage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/permission-groups"
              element={
                <PermissionRouteGuard routePath="/permission-groups">
                  <PermissionGroupsPage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/audit-logs"
              element={
                <PermissionRouteGuard routePath="/audit-logs">
                  <AuditLogsPage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/print-templates"
              element={
                <PermissionRouteGuard routePath="/print-templates">
                  <PrintTemplatesPage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/accounts"
              element={
                <PermissionRouteGuard routePath="/accounts">
                  <ChartOfAccountsPage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/chart-of-accounts"
              element={
                <PermissionRouteGuard routePath="/chart-of-accounts">
                  <ChartOfAccountsPage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/system-settings"
              element={
                <PermissionRouteGuard routePath="/system-settings">
                  <SystemSettingsPage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/company-settings"
              element={<Navigate to="/system-settings?tab=company_logo" replace />}
            />
            <Route
              path="/print-settings"
              element={
                <PermissionRouteGuard routePath="/system-settings">
                  <PrintSettingsPage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/pricing"
              element={
                <PermissionRouteGuard routePath="/pricing">
                  <PricingPage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/subscription-settings"
              element={
                <PermissionRouteGuard routePath="/subscription-settings">
                  <SubscriptionSettingsPage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/pricing-management"
              element={
                <PermissionRouteGuard routePath="/pricing-management">
                  <PricingManagementPage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/feedback"
              element={
                <PermissionRouteGuard routePath="/feedback">
                  <FeedbackManagementPage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/feedback-tickets"
              element={
                <PermissionRouteGuard routePath="/feedback-tickets">
                  <FeedbackManagementPage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/help-center"
              element={
                <PermissionRouteGuard routePath="/help-center">
                  <HelpCenterPage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/saas-admin"
              element={
                <PermissionRouteGuard routePath="/saas-admin">
                  <SaasAdminDashboardPage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/addons"
              element={
                <PermissionRouteGuard routePath="/addons">
                  <AddonsStorePage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/addons-store"
              element={
                <PermissionRouteGuard routePath="/addons-store">
                  <AddonsStorePage />
                </PermissionRouteGuard>
              }
            />
            <Route
              path="/deleted-records"
              element={
                <PermissionRouteGuard routePath="/deleted-records">
                  <DeletedRecordsPage />
                </PermissionRouteGuard>
              }
            />
          </Route>

          {/* Fallback for any unknown route */}
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;
