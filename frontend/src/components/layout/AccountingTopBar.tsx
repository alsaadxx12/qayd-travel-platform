import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tooltip } from '@mantine/core';
import { GlobalSearch } from './topbar/GlobalSearch';
import { NotificationCenter } from './topbar/NotificationCenter';
import { UserMenu } from './topbar/UserMenu';
import { PerformanceInspector } from './topbar/PerformanceInspector';
import { FinancialVoucherForm } from '../vouchers/FinancialVoucherForm';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { useLanguageStore } from '../../store/useLanguageStore';
import { useAdoptedExchangeRate } from '../../hooks/useAdoptedExchangeRate';
import calculatorSvg from '../../assets/calculator.svg';
import { DraggableCalculatorModal } from '../common/DraggableCalculatorModal';
import { Menu as MenuIcon } from 'lucide-react';

interface AccountingTopBarProps {
  onNewJournalEntry?: () => void;
}

export const AccountingTopBar: React.FC<AccountingTopBarProps> = () => {
  const [voucherModalOpen, setVoucherModalOpen] = useState(false);
  const [voucherModalType] = useState<'RECEIPT' | 'PAYMENT'>('RECEIPT');
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const { toggleSidebar, sidebarCollapsed, openTab } = useWorkspaceStore();
  const { direction, language } = useLanguageStore();
  const navigate = useNavigate();
  const adoptedExchange = useAdoptedExchangeRate();

  return (
    <header
      className="h-[60px] bg-white px-4 flex items-center justify-between sticky top-0 z-40 no-print shrink-0 text-xs select-none border-b border-[#E5E7EB] font-sans relative"
      dir={direction}
      style={{ fontFamily: language === 'ar' ? "'IBM Plex Sans Arabic', system-ui, sans-serif" : "'IBM Plex Sans', system-ui, sans-serif" }}
    >
      {/* Sidebar toggle button + Search (Positioned towards Sidebar / Start) */}
      <div className="flex items-center gap-3 shrink-0 z-10">
        <button
          type="button"
          onClick={toggleSidebar}
          className="w-9 h-9 rounded-[9px] hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer shrink-0"
          title={sidebarCollapsed ? (language === 'ar' ? 'توسيع القائمة' : 'Expand Sidebar') : (language === 'ar' ? 'تصغير القائمة' : 'Collapse Sidebar')}
        >
          <MenuIcon size={18} />
        </button>

        <div className="hidden sm:flex w-[300px] md:w-[380px] lg:w-[440px]">
          <GlobalSearch />
        </div>
      </div>

      {/* Clean Neutral Exchange Rate Pill + Lottie Calculator + Notifications + User */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Modern Clean Exchange Rate Pill (No Dollar icon, neutral modern palette) */}
        <Tooltip
          label={
            <div className={`text-${direction === 'rtl' ? 'right' : 'left'} text-[11px] p-1 font-sans space-y-0.5`} dir={direction}>
              <div className="font-bold text-white mb-1 border-b border-slate-600 pb-0.5">
                {language === 'ar' ? 'سعر الصرف المعتمد للنظام' : 'System Adopted Exchange Rate'}
              </div>
              <div>
                {language === 'ar' ? 'سعر السوق المرجعي: ' : 'Base Market Rate: '}
                <strong className="font-mono text-slate-200">{adoptedExchange.baseMarketRate.toLocaleString()} {language === 'ar' ? 'د.ع' : 'IQD'}</strong>
              </div>
              <div>
                {language === 'ar' ? 'هامش الإضافة المعتمد: ' : 'Margin: '}
                <strong className="font-mono text-amber-300">+{adoptedExchange.marginPerUSD.toLocaleString()} {language === 'ar' ? 'د.ع/$' : 'IQD/$'}</strong>
              </div>
              <div className="pt-1 text-orange-300 font-bold font-mono">
                100$ = {adoptedExchange.adoptedRatePer100.toLocaleString()} {language === 'ar' ? 'د.ع' : 'IQD'}
              </div>
              <div className="text-[9px] text-slate-400 mt-1">
                {language === 'ar' ? 'انقر لفتح إعدادات سعر الصرف ⚙️' : 'Click to open exchange rate settings ⚙️'}
              </div>
            </div>
          }
          withArrow
          position="bottom"
        >
          <button
            type="button"
            onClick={() => {
              openTab({ id: 'system-settings', title: language === 'ar' ? 'إعدادات النظام' : 'System Settings', path: '/system-settings', closable: true });
              navigate('/system-settings');
            }}
            className="h-[36px] flex items-center px-3 bg-[#F8FAFC] hover:bg-slate-100 border border-[#E2E8F0] text-[#334155] rounded-[9px] transition-all cursor-pointer shadow-2xs font-mono font-bold text-xs"
          >
            <span dir="ltr">1 USD = {adoptedExchange.adoptedRate.toLocaleString()} IQD</span>
          </button>
        </Tooltip>

        {/* Smart Interactive Calculator Button (Icon only, enlarged & clear) */}
        <Tooltip
          label={language === 'ar' ? 'الحاسبة الإلكترونية الذكية ⚡' : 'Smart Interactive Calculator ⚡'}
          withArrow
          position="bottom"
        >
          <button
            type="button"
            onClick={() => setCalculatorOpen((prev) => !prev)}
            aria-label={language === 'ar' ? 'الحاسبة الإلكترونية' : 'Smart Calculator'}
            className={`w-[38px] h-[36px] flex items-center justify-center rounded-[9px] border transition-all cursor-pointer shadow-2xs ${
              calculatorOpen
                ? 'bg-[#FFF3E8] border-[#F45A0A] ring-2 ring-orange-200 shadow-xs'
                : 'bg-[#F8FAFC] hover:bg-[#FFF3E8] hover:border-orange-300 border-[#E2E8F0]'
            }`}
          >
            <img
              src={calculatorSvg}
              alt="Calculator"
              className="w-[22px] h-[22px] object-contain transition-transform hover:scale-110 active:scale-95"
            />
          </button>
        </Tooltip>

        {/* Network profiler — badge shows how many calls crossed the slow threshold */}
        <PerformanceInspector />

        {/* Notifications Center */}
        <NotificationCenter />

        {/* User Account Menu */}
        <UserMenu />
      </div>

      {/* Draggable Electronic Calculator */}
      <DraggableCalculatorModal
        opened={calculatorOpen}
        onClose={() => setCalculatorOpen(false)}
      />

      {/* New Voucher Modal */}
      <FinancialVoucherForm
        opened={voucherModalOpen}
        onClose={() => setVoucherModalOpen(false)}
        onSuccess={() => setVoucherModalOpen(false)}
        initialType={voucherModalType}
      />
    </header>
  );
};

export default AccountingTopBar;
