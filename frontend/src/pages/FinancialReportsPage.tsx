import React, { useState, useEffect } from 'react';
import { Paper, SegmentedControl, Button, Select, Badge } from '@mantine/core';
import {
  IconBook2,
  IconPrinter,
  IconFileSpreadsheet,
  IconDatabaseOff,
} from '@tabler/icons-react';
import { AccountingGrid, AccountingColumnDef } from '../components/common/AccountingGrid';
import { apiRequest } from '../api/client';

export const FinancialReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('trial-balance');
  const [branch, setBranch] = useState<string>('ALL');
  const [currency, setCurrency] = useState<string>('IQD');
  const [loading, setLoading] = useState<boolean>(true);
  const [trialBalanceData, setTrialBalanceData] = useState<any[]>([]);

  // Fetch Real Data from Backend API
  useEffect(() => {
    const fetchTrialBalance = async () => {
      setLoading(true);
      try {
        const data = await apiRequest('/api/reports/trial-balance').catch(() => []);
        if (Array.isArray(data) && data.length > 0) {
          setTrialBalanceData(data);
        } else {
          setTrialBalanceData([]);
        }
      } catch (err) {
        console.error('Error loading trial balance:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTrialBalance();
  }, [branch, currency]);

  const trialBalanceCols: AccountingColumnDef[] = [
    { field: 'accountCode', headerText: 'رمز الحساب', width: 'w-28', isPinned: true, render: (r) => <span className="font-bold text-emerald-800 tabular-nums">{r.accountCode || r.code}</span> },
    { field: 'accountName', headerText: 'اسم الحساب المحاسبي', width: 'w-56', isPinned: true, render: (r) => <span className="font-bold text-slate-900">{r.accountName || r.nameAr}</span> },
    { field: 'type', headerText: 'النوع', width: 'w-24', align: 'center', render: (r) => <Badge size="xs" color="gray">{r.type || 'أصول'}</Badge> },
    { field: 'debit', headerText: `إجمالي مدين (${currency})`, width: 'w-36', align: 'left', isMonetary: true, render: (r) => <span className="font-bold tabular-nums text-emerald-800">{Number(r.debit || 0).toLocaleString()}</span> },
    { field: 'credit', headerText: `إجمالي دائن (${currency})`, width: 'w-36', align: 'left', isMonetary: true, render: (r) => <span className="font-bold tabular-nums text-rose-800">{Number(r.credit || 0).toLocaleString()}</span> },
    { field: 'balance', headerText: 'الرصيد النهائي', width: 'w-36', align: 'left', isMonetary: true, render: (r) => <span className={`font-bold tabular-nums ${Number(r.balance || 0) >= 0 ? 'text-emerald-900' : 'text-rose-900'}`}>{Math.abs(Number(r.balance || 0)).toLocaleString()} {currency}</span> },
  ];

  return (
    <div className="space-y-3 w-full select-none text-xs">
      {/* 1. Header Toolbar & Report Sub-Tabs */}
      <Paper p="xs" radius="sm" withBorder className="bg-white space-y-2 no-print shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-1.5">
          <div className="flex items-center gap-2">
            <IconBook2 size={18} className="text-emerald-700" />
            <h1 className="font-extrabold text-xs text-slate-900">التقارير المحاسبية الختامية (Financial Reports)</h1>
          </div>

          <div className="flex items-center gap-1.5">
            <Button size="xs" variant="outline" color="gray" leftSection={<IconFileSpreadsheet size={14} />}>
              تصدير Excel
            </Button>

            <Button size="xs" variant="outline" color="gray" leftSection={<IconPrinter size={14} />} onClick={() => window.print()}>
              طباعة التقرير
            </Button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <SegmentedControl
            size="xs"
            value={activeTab}
            onChange={setActiveTab}
            data={[
              { label: 'ميزان المراجعة (Trial Balance)', value: 'trial-balance' },
              { label: 'قائمة الدخل والأرباح (Profit & Loss)', value: 'pnl' },
              { label: 'الميزانية العمومية (Balance Sheet)', value: 'balance-sheet' },
            ]}
            color="emerald"
          />

          <div className="flex items-center gap-2">
            <Select
              size="xs"
              className="w-36"
              data={[
                { label: 'جميع الفروع', value: 'ALL' },
                { label: 'فرع بغداد', value: 'BGD' },
                { label: 'فرع أربيل', value: 'ERB' },
              ]}
              value={branch}
              onChange={(v) => setBranch(v || 'ALL')}
            />

            <SegmentedControl
              size="xs"
              value={currency}
              onChange={setCurrency}
              data={[
                { label: 'IQD', value: 'IQD' },
                { label: 'USD', value: 'USD' },
              ]}
              color="emerald"
            />
          </div>
        </div>
      </Paper>

      {/* 2. Real Data Content Grid / Clean Empty State */}
      <Paper p="xs" radius="sm" withBorder className="bg-white shadow-2xs space-y-2">
        {trialBalanceData.length === 0 ? (
          <div className="py-12 text-center space-y-2 text-slate-500">
            <IconDatabaseOff size={32} className="mx-auto text-slate-400" />
            <p className="font-bold text-slate-700">لا توجد حركات ختامية أو أرصدة متراكمة في ميزان المراجعة حالياً.</p>
            <p className="text-[11px] text-slate-400">تأكد من ترحيل القيود والسندات لتوليد ميزان المراجعة الختامي الحقيقي.</p>
          </div>
        ) : (
          <AccountingGrid
            gridKey="financial_reports_grid"
            title="ميزان المراجعة بالأرصدة والمجاميع"
            data={trialBalanceData}
            columnDefs={trialBalanceCols}
          />
        )}
      </Paper>
    </div>
  );
};
