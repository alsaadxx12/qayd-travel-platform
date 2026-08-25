import React, { useState } from 'react';
import {
  Plane,
  FileSpreadsheet,
  CreditCard,
  TrendingUp,
  Building2,
  CheckCircle2,
  ArrowUpRight,
} from 'lucide-react';

interface InteractivePlatformStudioProps {
  isDark?: boolean;
  isAr?: boolean;
}

export const InteractivePlatformStudio: React.FC<InteractivePlatformStudioProps> = ({
  isDark = true,
  isAr = true,
}) => {
  const [activeTab, setActiveTab] = useState<'tickets' | 'accounts' | 'cashboxes' | 'reports'>('tickets');

  const tabs = [
    {
      id: 'tickets' as const,
      icon: <Plane size={17} />,
      labelAr: 'إدارة التذاكر والحجوزات',
      labelEn: 'Ticketing Ledger',
      badgeAr: 'أتمتة القيود',
      badgeEn: 'Auto-GL',
    },
    {
      id: 'accounts' as const,
      icon: <FileSpreadsheet size={17} />,
      labelAr: 'دليل الحسابات الشجري',
      labelEn: 'Chart of Accounts',
      badgeAr: 'معايير IFRS',
      badgeEn: 'Standard Tree',
    },
    {
      id: 'cashboxes' as const,
      icon: <CreditCard size={17} />,
      labelAr: 'الصناديق والعملات',
      labelEn: 'Multi-Currency Vaults',
      badgeAr: 'فروقات الصرف',
      badgeEn: 'FX Tracking',
    },
    {
      id: 'reports' as const,
      icon: <TrendingUp size={17} />,
      labelAr: 'التقارير والأرباح',
      labelEn: 'Financial Intelligence',
      badgeAr: 'ميزان مراجعة فوري',
      badgeEn: 'Instant P&L',
    },
  ];

  return (
    <div className="w-full space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Tab Switcher Buttons */}
      <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl font-black text-xs transition-all cursor-pointer border ${
                isActive
                  ? 'bg-[#F45A0A] text-white border-[#F45A0A] shadow-lg shadow-[#F45A0A]/25 scale-[1.02]'
                  : isDark
                  ? 'bg-slate-900 border-slate-800 text-slate-300 hover:border-[#F45A0A]/40 hover:text-white'
                  : 'bg-white border-orange-200/80 text-slate-800 hover:border-[#F45A0A] hover:text-[#F45A0A] hover:bg-orange-50/40 shadow-xs'
              }`}
            >
              <div className={isActive ? 'text-white' : 'text-[#F45A0A]'}>
                {tab.icon}
              </div>
              <span>{isAr ? tab.labelAr : tab.labelEn}</span>
              <span
                className={`text-[9.5px] font-black px-2.5 py-0.5 rounded-full ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-orange-100 text-[#ea580c] border border-orange-200 dark:bg-[#F45A0A]/15 dark:text-[#F45A0A] dark:border-[#F45A0A]/30'
                }`}
              >
                {isAr ? tab.badgeAr : tab.badgeEn}
              </span>
            </button>
          );
        })}
      </div>

      {/* Interactive Studio Workspace Box */}
      <div
        className={`rounded-3xl border overflow-hidden transition-all duration-300 shadow-xl ${
          isDark
            ? 'bg-slate-950 border-slate-800 shadow-black/40'
            : 'bg-white border-orange-200/90 shadow-orange-500/5'
        }`}
      >
        {/* Workspace Window Chrome Bar */}
        <div
          className={`px-5 py-3.5 border-b flex items-center justify-between gap-4 text-xs font-bold ${
            isDark
              ? 'bg-slate-900/90 border-slate-800 text-slate-300'
              : 'bg-orange-50/70 border-orange-200 text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-rose-500/80" />
              <div className="w-3 h-3 rounded-full bg-amber-500/80" />
              <div className="w-3 h-3 rounded-full bg-orange-500/80" />
            </div>
            <span className="text-[#ea580c] dark:text-orange-400 font-mono text-[11px] font-bold mr-2">
              QAYD Travel Accounting Enterprise Workspace v2.6
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="w-2 h-2 rounded-full bg-[#F45A0A] animate-pulse" />
            <span className="text-[#F45A0A] font-black">
              {isAr ? 'متصل بالسيرفر السحابي (PostgreSQL)' : 'Cloud Live Sync'}
            </span>
          </div>
        </div>

        {/* Tab Content Display */}
        <div className="p-5 sm:p-7 min-h-[380px] flex flex-col justify-between">
          {activeTab === 'tickets' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {isAr ? 'سجل تذاكر الطيران والمسافرين اليومي' : 'Daily Flight Tickets & Passenger Ledger'}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {isAr ? 'توليد القيود المحاسبية وحساب عمولات الوكالة تلقائياً مع كل حجز' : 'Automatic GL posting and commission calculations on every issuance'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black font-mono px-3.5 py-1.5 rounded-xl bg-orange-100 text-[#ea580c] border border-orange-200 dark:bg-[#F45A0A]/15 dark:text-[#F45A0A] dark:border-[#F45A0A]/30">
                    {isAr ? 'إجمالي أرباح اليوم: $1,420' : "Today's Profit: $1,420"}
                  </span>
                </div>
              </div>

              {/* Mock Tickets Table */}
              <div className={`overflow-x-auto rounded-2xl border ${isDark ? 'border-slate-800' : 'border-orange-200'}`}>
                <table className="w-full text-xs text-start border-collapse">
                  <thead>
                    <tr className={`font-black border-b ${isDark ? 'bg-slate-900 text-orange-400 border-slate-800' : 'bg-orange-100/70 text-[#ea580c] border-orange-200'}`}>
                      <th className="p-3.5 text-start">PNR / التذكرة</th>
                      <th className="p-3.5 text-start">المسافر</th>
                      <th className="p-3.5 text-start">الخط / المسار</th>
                      <th className="p-3.5 text-start">الشركة الناقلة</th>
                      <th className="p-3.5 text-start">سعر البيع</th>
                      <th className="p-3.5 text-start">التكلفة</th>
                      <th className="p-3.5 text-start">الربح</th>
                      <th className="p-3.5 text-start">حالة القيد</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y font-bold ${isDark ? 'divide-slate-800/60' : 'divide-orange-100'}`}>
                    {[
                      { pnr: 'IA-94821', pass: 'أحمد علي حسن', route: 'BGW ➔ DXB', air: 'الخطوط العراقية', sell: '$520', cost: '$470', profit: '+$50', st: 'مُرحّل آلياً' },
                      { pnr: 'TK-11045', pass: 'زينب حيدر فاضل', route: 'BSR ➔ IST', air: 'الخطوط التركية', sell: '$640', cost: '$580', profit: '+$60', st: 'مُرحّل آلياً' },
                      { pnr: 'FZ-39120', pass: 'محمد كاظم جابر', route: 'NJF ➔ DXB', air: 'فلاي دبي', sell: '$380', cost: '$345', profit: '+$35', st: 'مُرحّل آلياً' },
                      { pnr: 'QR-88712', pass: 'عمر طارق ياسين', route: 'EBL ➔ DOH', air: 'القطرية', sell: '$710', cost: '$640', profit: '+$70', st: 'مُرحّل آلياً' },
                    ].map((row, idx) => (
                      <tr key={idx} className={isDark ? 'hover:bg-slate-900/60 transition-colors' : 'hover:bg-orange-50/50 transition-colors'}>
                        <td className="p-3.5 font-mono font-black text-[#F45A0A]">{row.pnr}</td>
                        <td className={`p-3.5 font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{row.pass}</td>
                        <td className={`p-3.5 font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{row.route}</td>
                        <td className={`p-3.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{row.air}</td>
                        <td className="p-3.5 font-mono font-black text-slate-900 dark:text-white tabular-nums">{row.sell}</td>
                        <td className="p-3.5 font-mono font-bold text-slate-400 tabular-nums">{row.cost}</td>
                        <td className="p-3.5 font-mono font-black text-[#F45A0A] tabular-nums text-sm">{row.profit}</td>
                        <td className="p-3.5">
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-black px-2.5 py-1 rounded-full bg-orange-100 text-[#ea580c] border border-orange-200 dark:bg-[#F45A0A]/15 dark:text-[#F45A0A] dark:border-[#F45A0A]/30">
                            <CheckCircle2 size={12} />
                            <span>{row.st}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'accounts' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {isAr ? 'دليل الحسابات الشجري متعدد المستويات' : 'Standard Multi-Level Chart of Accounts'}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {isAr ? 'شجرة حسابات مالية مرنة معدة مسبقاً لشركات ووكالات السفر مع ميزان المراجعة اللحظي' : 'Pre-configured tree COA designed specifically for airline and tourism ledgers'}
                  </p>
                </div>
              </div>

              <div className="space-y-2 font-mono text-xs">
                {[
                  { code: '1', name: '1 — الأصول والموجودات (Assets)', type: 'رئيسي', balance: '$285,400', debit: '$285,400', credit: '$0' },
                  { code: '11', name: '├── 11 — الأصول المتداولة (Current Assets)', type: 'فرعي', balance: '$194,200', debit: '$194,200', credit: '$0' },
                  { code: '111', name: '│   ├── 111 — الصناديق النقدية والبنوك (Cash & Banks)', type: 'فرعي', balance: '$142,500', debit: '$142,500', credit: '$0' },
                  { code: '1111', name: '│   │   ├── 1111 — صندوق بغداد الرئيسي (USD / IQD)', type: 'تحليلي', balance: '$85,000', debit: '$85,000', credit: '$0', active: true },
                  { code: '2', name: '2 — الخصوم والالتزامات (Liabilities)', type: 'رئيسي', balance: '$120,600', debit: '$0', credit: '$120,600' },
                  { code: '4', name: '4 — الإيرادات التشغيلية (Revenues - Commissions)', type: 'رئيسي', balance: '$164,800', debit: '$0', credit: '$164,800' },
                ].map((node, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      node.active
                        ? 'bg-orange-100/70 border-orange-300 text-slate-900 shadow-xs dark:bg-[#F45A0A]/15 dark:border-[#F45A0A]/40 dark:text-white'
                        : isDark
                        ? 'bg-slate-900 border-slate-800 text-slate-300'
                        : 'bg-orange-50/40 border-orange-200/60 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-sans">
                      <span className="font-mono font-black text-[#F45A0A]">{node.code}</span>
                      <span className={`font-black text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>{node.name}</span>
                    </div>
                    <div className="flex items-center gap-4 tabular-nums font-mono font-black">
                      <span className="text-slate-400 text-[11px] hidden sm:inline">مدين: {node.debit}</span>
                      <span className="text-slate-400 text-[11px] hidden sm:inline">دائن: {node.credit}</span>
                      <span className="text-[#F45A0A] font-black">{node.balance}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'cashboxes' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {isAr ? 'الصناديق المتعددة وأسعار الصرف اللحظية' : 'Multi-Currency Drawers & FX Intelligence'}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {isAr ? 'متابعة أرصدة الخزائن بالدينار والدولار مع احتساب فروقات العملة آلياً' : 'Live balance tracking across USD and IQD vaults with automated exchange gain/loss'}
                  </p>
                </div>

                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-100 text-[#ea580c] border border-orange-200 dark:bg-orange-500/10 dark:text-[#F45A0A] dark:border-[#F45A0A]/25 text-xs font-mono font-bold">
                  <span>100 USD = 153,000 IQD</span>
                </div>
              </div>

              {/* Cashbox cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    title: isAr ? 'صندوق الفرع الرئيسي (USD)' : 'HQ Vault (USD)',
                    balance: '$48,250.00',
                    lastMovement: 'قبض تذكرة IA-9482 (+$520)',
                    status: 'مطابق ونشط',
                  },
                  {
                    title: isAr ? 'صندوق الفرع الرئيسي (IQD)' : 'HQ Vault (IQD)',
                    balance: '73,822,500 د.ع',
                    lastMovement: 'سند قبض تأشيرة (+306,000 د.ع)',
                    status: 'مطابق ونشط',
                  },
                  {
                    title: isAr ? 'حساب مصرفي - مصرف بغداد' : 'Bank Account (USD)',
                    balance: '$125,400.00',
                    lastMovement: 'حوالة تسوية مجهز (-$12,000)',
                    status: 'مطابق ونشط',
                  },
                ].map((box, idx) => (
                  <div
                    key={idx}
                    className={`p-4.5 rounded-2xl border space-y-3 ${
                      isDark ? 'bg-slate-900 border-slate-800' : 'bg-orange-50/40 border-orange-200/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{box.title}</span>
                      <span className="text-[10px] font-mono font-black px-2.5 py-0.5 rounded-full bg-orange-100 text-[#ea580c] border border-orange-200 dark:bg-[#F45A0A]/15 dark:text-[#F45A0A] dark:border-[#F45A0A]/30">
                        {box.status}
                      </span>
                    </div>
                    <div className="text-2xl font-black font-mono text-[#F45A0A] tabular-nums" style={{ fontWeight: 800 }}>
                      {box.balance}
                    </div>
                    <div className={`text-[11px] font-bold flex items-center gap-1 border-t pt-2 ${isDark ? 'text-slate-400 border-slate-800' : 'text-slate-500 border-orange-200/60'}`}>
                      <ArrowUpRight size={13} className="text-[#F45A0A]" />
                      <span className="truncate">{box.lastMovement}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {isAr ? 'لوحة التقارير والذكاء المالي المباشر' : 'Live Financial Intelligence & P&L'}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {isAr ? 'كشوفات حساب تفصيلية، تقرير الأرباح والخسائر، وميزان المراجعة بدقة فورية' : 'Real-time Income Statements, Balance Sheets, and Partner Ledgers'}
                  </p>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { labelAr: 'إجمالي المبيعات', labelEn: 'Gross Sales', val: '$148,920', change: '+18.4%' },
                  { labelAr: 'صافي أرباح العمولات', labelEn: 'Net Profit', val: '$22,450', change: '+24.1%' },
                  { labelAr: 'إجمالي التذاكر الصادرة', labelEn: 'Tickets Issued', val: '412 تذكرة', change: '+12%' },
                  { labelAr: 'مطابقة الحسابات', labelEn: 'Reconciliation', val: '100% متزن', change: 'Live' },
                ].map((stat, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-2xl border ${
                      isDark ? 'bg-slate-900 border-slate-800' : 'bg-orange-50/40 border-orange-200/80'
                    }`}
                  >
                    <span className="text-[10.5px] font-black text-slate-500 dark:text-slate-400 block mb-1">
                      {isAr ? stat.labelAr : stat.labelEn}
                    </span>
                    <span className={`text-lg font-black font-mono tabular-nums block ${isDark ? 'text-white' : 'text-slate-900'}`} style={{ fontWeight: 800 }}>
                      {stat.val}
                    </span>
                    <span className="text-[10.5px] font-mono font-black text-[#F45A0A] mt-1 block">
                      {stat.change}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InteractivePlatformStudio;
