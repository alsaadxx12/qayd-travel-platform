import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Banknote,
  Search,
  CheckCircle2,
  Clock,
  Coins,
  Award,
  Minus,
  Sparkles,
  User,
} from 'lucide-react';
import { hrApi, SalaryItem, PointSummaryItem, PointLogItem } from '../../api/hr';
import { employeesApi, Employee } from '../../api/employees';
import { apiRequest } from '../../api/client';
import { fetchPrintTemplate } from '../../api/printTemplates';
import { useLanguageStore } from '../../store/useLanguageStore';
import { SegmentedDatePicker } from '../../components/ui/SegmentedDatePicker';

const fmt = (n: number | string | undefined | null) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export const SalariesPage: React.FC = () => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  // Filters state
  const currentMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  // 1. Employees & Users with database salary structures
  const { data: unifiedPeople = [], isLoading: loadingPeople } = useQuery({
    queryKey: ['hr-unified-people-salaries'],
    queryFn: async () => {
      const [empList, userList, templateRes] = await Promise.all([
        employeesApi.getAll().catch(() => [] as Employee[]),
        apiRequest<any[]>('/auth/users').catch(() => [] as any[]),
        fetchPrintTemplate('employee_salary_allowances').catch(() => ({ config: {} } as any)),
      ]);

      const templateConfigs: Record<string, any> = (templateRes as any)?.config?.structures || {};

      const map = new Map<string, any>();
      (empList || []).forEach((e) => {
        const structFromDb = e.salaryStructure && typeof e.salaryStructure === 'object' && Object.keys(e.salaryStructure).length > 0
          ? e.salaryStructure
          : (templateConfigs[`emp_${e.id}`] || templateConfigs[e.id] || null);

        map.set(e.id, {
          id: e.id,
          fullName: e.fullName,
          branchName: e.branchName || (isAr ? 'الفرع الرئيسي' : 'Main Branch'),
          departmentName: e.departmentName || (isAr ? 'إدارة عامة' : 'General Dept'),
          jobTitle: e.jobTitle || (isAr ? 'موظف' : 'Employee'),
          isUser: false,
          isEmployee: true,
          baseSalary: e.baseSalary,
          salaryStructure: structFromDb,
        });
      });

      (userList || []).forEach((u) => {
        const existing = Array.from(map.values()).find(
          (m) => m.fullName.trim().toLowerCase() === (u.name || '').trim().toLowerCase()
        );
        const structFromDb = u.salaryStructure && typeof u.salaryStructure === 'object' && Object.keys(u.salaryStructure).length > 0
          ? u.salaryStructure
          : (templateConfigs[`usr_${u.id}`] || templateConfigs[u.id] || null);

        if (existing) {
          existing.isUser = true;
          existing.userId = u.id;
          if (!existing.salaryStructure && structFromDb) {
            existing.salaryStructure = structFromDb;
          }
          if ((!existing.baseSalary || Number(existing.baseSalary) === 0) && u.baseSalary) {
            existing.baseSalary = u.baseSalary;
          }
        } else {
          map.set(u.id, {
            id: u.id,
            fullName: u.name,
            branchName: isAr ? 'المركز الرئيسي' : 'Headquarters',
            departmentName: isAr ? 'إدارة النظام والتشغيل' : 'System Operations',
            jobTitle: u.role?.name || (isAr ? 'مستخدم نظام' : 'System User'),
            isUser: true,
            isEmployee: false,
            baseSalary: u.baseSalary,
            salaryStructure: structFromDb,
          });
        }
      });

      return Array.from(map.values());
    },
    staleTime: 30000,
  });

  // 2. Points Logs & Summary
  const { data: pointLogs = [] } = useQuery({
    queryKey: ['hr-points-logs-all'],
    queryFn: () => hrApi.getPointsLogs().catch(() => [] as PointLogItem[]),
    staleTime: 30000,
  });

  const { data: pointsSummary = [] } = useQuery({
    queryKey: ['hr-points-summary-salaries'],
    queryFn: () => hrApi.getPointsSummary().catch(() => [] as PointSummaryItem[]),
    staleTime: 30000,
  });

  // Compute points per employee
  const pointsMap = useMemo(() => {
    const map = new Map<string, { earnedPoints: number; deductedPoints: number; netPoints: number }>();

    pointLogs.forEach((log) => {
      const empId = log.employeeId;
      if (!empId) return;
      const cur = map.get(empId) || { earnedPoints: 0, deductedPoints: 0, netPoints: 0 };
      const pts = Number(log.points || 0);
      if (pts > 0) {
        cur.earnedPoints += pts;
      } else {
        cur.deductedPoints += Math.abs(pts);
      }
      cur.netPoints = cur.earnedPoints - cur.deductedPoints;
      map.set(empId, cur);
    });

    pointsSummary.forEach((s) => {
      if (!map.has(s.id)) {
        const total = Number(s.totalPoints || 0);
        const item = {
          earnedPoints: total > 0 ? total : 0,
          deductedPoints: total < 0 ? Math.abs(total) : 0,
          netPoints: total,
        };
        map.set(s.id, item);
        if (s.fullName) {
          map.set(s.fullName.trim().toLowerCase(), item);
        }
      }
    });

    return map;
  }, [pointLogs, pointsSummary]);

  // 3. Issued Salaries for the selected month
  const { data: recordedSalaries = [], isLoading: loadingSalaries } = useQuery({
    queryKey: ['hr-salaries', selectedMonth],
    queryFn: () => hrApi.getSalaries({ month: selectedMonth || undefined }),
    staleTime: 30000,
  });

  // Build Unified Table Rows: Every employee and user has their data directly from DB
  const unifiedSalaries = useMemo(() => {
    const recordedMap = new Map<string, SalaryItem>();
    recordedSalaries.forEach((s) => {
      recordedMap.set(s.employeeId, s);
    });

    return unifiedPeople.map((person) => {
      const rec = recordedMap.get(person.id);
      const rawStruct = person.salaryStructure || {};
      const pts = pointsMap.get(person.id) || 
        (person.userId ? pointsMap.get(person.userId) : null) || 
        pointsMap.get(person.fullName.trim().toLowerCase()) || 
        { earnedPoints: 0, deductedPoints: 0, netPoints: 0 };
      const ptPrice = rawStruct.pointPrice || 1000;

      const pointsRewardMoney = pts.earnedPoints * ptPrice;
      const pointsDeductionMoney = pts.deductedPoints * ptPrice;

      if (rec) {
        return {
          id: rec.id,
          employeeId: person.id,
          isRecorded: true,
          person,
          month: rec.month,
          baseSalary: Number(rec.baseSalary),
          allowances: Number(rec.allowances),
          bonuses: Number(rec.bonuses),
          deductions: Number(rec.deductions),
          netSalary: Number(rec.netSalary),
          currency: rec.currency || 'IQD',
          status: rec.status, // PAID, APPROVED, PENDING
          points: pts,
          pointsRewardMoney,
          pointsDeductionMoney,
          pensionDeduction: Number(rawStruct.pensionDeduction || 0),
          incentivesAndProfits: Math.max(0, Number(rec.bonuses) - pointsRewardMoney),
          notes: rec.notes || '',
        };
      }

      // Computed directly from database structure
      const base = rawStruct.nominalSalary !== undefined && Number(rawStruct.nominalSalary) > 0
        ? Number(rawStruct.nominalSalary)
        : (person.baseSalary !== undefined && Number(person.baseSalary) > 0
            ? Number(person.baseSalary)
            : 1000000);

      const allowances =
        Number(rawStruct.transportAllowance || 0) +
        Number(rawStruct.foodAllowance || 0) +
        Number(rawStruct.housingAllowance || 0) +
        Number(rawStruct.otherAllowances || 0);

      const monthlyIncentiveMoney = rawStruct.incentiveEnabled !== false ? Number(rawStruct.monthlyIncentive || 0) : 0;
      const issuanceMoney = rawStruct.issuanceProfitsEnabled ? Number(rawStruct.issuanceProfitRate || 0) : 0;
      const changesMoney = rawStruct.changesProfitsEnabled ? Number(rawStruct.changesProfitRate || 0) : 0;
      const weightMoney = rawStruct.baggageProfitsEnabled ? Number(rawStruct.baggageProfitRate || 0) : 0;

      const incentivesAndProfits = monthlyIncentiveMoney + issuanceMoney + changesMoney + weightMoney;
      const bonuses = incentivesAndProfits + pointsRewardMoney;

      const pensionDeduction = Number(rawStruct.pensionDeduction || 0);
      const otherDeductions = Number(rawStruct.otherDeductions || 0);
      const deductions = pensionDeduction + otherDeductions + pointsDeductionMoney;
      const netSalary = base + allowances + bonuses - deductions;

      return {
        id: `ready-${person.id}`,
        employeeId: person.id,
        isRecorded: false,
        person,
        month: selectedMonth,
        baseSalary: base,
        allowances,
        bonuses,
        deductions,
        netSalary,
        currency: rawStruct.currency || 'IQD',
        status: 'READY',
        points: pts,
        pointsRewardMoney,
        pointsDeductionMoney,
        pensionDeduction,
        incentivesAndProfits,
        notes: '',
      };
    });
  }, [unifiedPeople, recordedSalaries, pointsMap, selectedMonth]);

  // Filtered rows
  const filteredSalaries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return unifiedSalaries.filter((s) => {
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'PENDING' && s.status !== 'PENDING') return false;
        if (selectedStatus === 'APPROVED' && s.status !== 'APPROVED') return false;
        if (selectedStatus === 'PAID' && s.status !== 'PAID') return false;
        if (selectedStatus === 'READY' && s.status !== 'READY') return false;
      }
      if (!q) return true;
      const name = s.person?.fullName?.toLowerCase() || '';
      const branch = s.person?.branchName?.toLowerCase() || '';
      const job = s.person?.jobTitle?.toLowerCase() || '';
      return name.includes(q) || branch.includes(q) || job.includes(q);
    });
  }, [unifiedSalaries, search, selectedStatus]);

  // Aggregate Stats
  const stats = useMemo(() => {
    let totalBase = 0;
    let totalAllowancesBonuses = 0;
    let totalDeductions = 0;
    let totalNet = 0;
    let paidCount = 0;
    let readyCount = 0;
    let totalPointsReward = 0;
    let totalPointsDeduction = 0;

    for (const s of filteredSalaries) {
      totalBase += s.baseSalary;
      totalAllowancesBonuses += s.allowances + s.bonuses;
      totalDeductions += s.deductions;
      totalNet += s.netSalary;
      totalPointsReward += s.pointsRewardMoney;
      totalPointsDeduction += s.pointsDeductionMoney;
      if (s.status === 'PAID') paidCount++;
      if (s.status === 'READY') readyCount++;
    }

    return {
      totalBase,
      totalAllowancesBonuses,
      totalDeductions,
      totalNet,
      paidCount,
      readyCount,
      totalPointsReward,
      totalPointsDeduction,
    };
  }, [filteredSalaries]);

  return (
    <div
      className="p-4 md:p-6 space-y-5 max-w-[1600px] mx-auto select-none"
      dir={direction}
      style={{ fontFamily: isAr ? "'IBM Plex Sans Arabic', system-ui, sans-serif" : "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      {/* ── Top Header (Clean, No Unwanted Buttons) ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-orange-50 border border-orange-200 text-[#F45A0A] flex items-center justify-center shadow-xs">
            <Banknote size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-black text-lg text-slate-900 tracking-tight">
                {isAr ? 'مسيرات الرواتب والأجور الشهرية' : 'Salaries & Payroll Management'}
              </h1>
              <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {isAr ? 'نظام المخصصات والنقاط الذكي' : 'Smart Allowances & Points'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-bold mt-1">
              {isAr
                ? 'تطبيق الرواتب الاسمية والمخصصات الثابتة المخزنة، واحتساب مكافآت واستقطاعات النقاط آلياً لكل موظف.'
                : 'Persistent salary structures, automatic points rewards/deductions, and monthly payroll calculations.'}
            </p>
          </div>
        </div>
      </div>

      {/* ── KPI Summary Cards (Brand White & Orange Design) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Net */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">{isAr ? 'إجمالي صافي الرواتب' : 'Total Net Payroll'}</span>
            <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#F45A0A] flex items-center justify-center">
              <Banknote size={16} />
            </div>
          </div>
          <div className="mt-2">
            <div className="font-mono font-black text-xl text-slate-900 tabular-nums">
              {fmt(stats.totalNet)} <span className="text-xs font-bold text-slate-400">IQD</span>
            </div>
            <div className="text-[10px] font-bold text-slate-400 mt-0.5">
              {isAr ? 'شامل الرواتب الاسمية والبدلات والنقاط' : 'Includes base, allowances & points'}
            </div>
          </div>
        </div>

        {/* Total Base & Allowances */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">{isAr ? 'الرواتب الاسمية والبدلات' : 'Base & Allowances'}</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Coins size={16} />
            </div>
          </div>
          <div className="mt-2">
            <div className="font-mono font-black text-xl text-blue-600 tabular-nums">
              {fmt(stats.totalBase)} <span className="text-xs font-bold text-slate-400">IQD</span>
            </div>
            <div className="text-[10px] font-bold text-slate-400 mt-0.5">
              +{fmt(stats.totalAllowancesBonuses)} {isAr ? 'بدلات وحوافز مضافة' : 'allowances/incentives'}
            </div>
          </div>
        </div>

        {/* Points Rewards vs Deductions */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">{isAr ? 'أثر مكافآت واستقطاعات النقاط' : 'Points Financial Impact'}</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Award size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold text-emerald-600 block">{isAr ? 'مكافآت النقاط' : 'Rewards'}</span>
              <span className="font-mono font-black text-sm text-emerald-600 tabular-nums">+{fmt(stats.totalPointsReward)}</span>
            </div>
            <div className="text-end">
              <span className="text-[10px] font-bold text-rose-600 block">{isAr ? 'استقطاعات النقاط' : 'Deductions'}</span>
              <span className="font-mono font-black text-sm text-rose-600 tabular-nums">-{fmt(stats.totalPointsDeduction)}</span>
            </div>
          </div>
        </div>

        {/* Personnel & Point Pricing Info (Brand Palette) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">{isAr ? 'حالة الكادر والمسيرات' : 'Personnel Status'}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-orange-50 text-[#F45A0A] border border-orange-200">
              {filteredSalaries.length} {isAr ? 'موظف' : 'Staff'}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <div>
              <div className="font-mono font-black text-lg text-slate-900 tabular-nums">
                {stats.readyCount} <span className="text-xs text-slate-400">{isAr ? 'جاهز للاستحقاق' : 'Ready'}</span>
              </div>
              <span className="text-[10px] text-slate-400 font-bold block mt-0.5">
                {stats.paidCount} {isAr ? 'تم الصرف لهم' : 'Paid'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Controls & Filter Bar ── */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Month Picker */}
          <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
            <span className="text-[11px] font-black text-slate-700 shrink-0 select-none bg-slate-100 px-3 py-1.5 rounded-xl">
              {isAr ? 'الشهر المالي:' : 'Month:'}
            </span>
            <div className="w-full sm:w-[190px]">
              <SegmentedDatePicker
                placeholder={isAr ? 'اختر الشهر' : 'Select Month'}
                value={selectedMonth ? `${selectedMonth}-01` : null}
                onChange={(_, iso) => {
                  if (iso) setSelectedMonth(iso.slice(0, 7));
                }}
                clearable={false}
              />
            </div>
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {[
              { key: 'ALL', label: isAr ? 'الكل' : 'All' },
              { key: 'READY', label: isAr ? 'جاهز للاعتماد' : 'Ready' },
              { key: 'APPROVED', label: isAr ? 'معتمد' : 'Approved' },
              { key: 'PAID', label: isAr ? 'تم الصرف' : 'Paid' },
            ].map((st) => (
              <button
                key={st.key}
                type="button"
                onClick={() => setSelectedStatus(st.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  selectedStatus === st.key
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Search Box */}
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? 'بحث باسم الموظف أو الفرع أو الوظيفة...' : 'Search employee, branch, title...'}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl ps-9 pe-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 transition-all"
          />
        </div>
      </div>

      {/* ── Salaries Table (Clean Ledger, No Unwanted Buttons or Modals) ── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold text-[11px]">
                <th className="px-3.5 py-3 text-start w-10">#</th>
                <th className="px-3.5 py-3 text-start">{isAr ? 'الموظف / المستخدم' : 'Employee / User'}</th>
                <th className="px-3.5 py-3 text-start">{isAr ? 'الفرع والقسم' : 'Branch & Dept'}</th>
                <th className="px-3.5 py-3 text-end">{isAr ? 'الراتب الاسمي' : 'Base Salary'}</th>
                <th className="px-3.5 py-3 text-end">{isAr ? 'البدلات الثابتة' : 'Fixed Allowances'}</th>
                <th className="px-3.5 py-3 text-center">
                  <div>{isAr ? 'الحوافز والمكافآت (+)' : 'Incentives & Rewards (+)'}</div>
                  <div className="text-[10px] text-slate-400 font-normal">{isAr ? 'حوافز وأرباح + نقاط' : 'Incentives + Points'}</div>
                </th>
                <th className="px-3.5 py-3 text-center">
                  <div>{isAr ? 'الاستقطاعات والتقاعد (-)' : 'Deductions & Pension (-)'}</div>
                  <div className="text-[10px] text-slate-400 font-normal">{isAr ? 'ضمان تقاعدي + خصم نقاط' : 'Pension + Point Penalties'}</div>
                </th>
                <th className="px-3.5 py-3 text-end">{isAr ? 'صافي الراتب المستحق' : 'Net Salary'}</th>
                <th className="px-3.5 py-3 text-center">{isAr ? 'حالة المسير' : 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingPeople || loadingSalaries ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400 font-bold">
                    <div className="flex items-center justify-center gap-2">
                      <Sparkles size={16} className="animate-spin text-orange-500" />
                      <span>{isAr ? 'جاري جلب بيانات الموظفين والمخصصات والنقاط...' : 'Loading employees, allowances & points...'}</span>
                    </div>
                  </td>
                </tr>
              ) : filteredSalaries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400 font-bold">
                    {isAr ? 'لا يوجد موظفون مطابقون لخيارات البحث' : 'No matching employees found'}
                  </td>
                </tr>
              ) : (
                filteredSalaries.map((row, idx) => {
                  const isPaid = row.status === 'PAID';
                  const isApproved = row.status === 'APPROVED';
                  const isPending = row.status === 'PENDING';

                  return (
                    <tr key={row.id} className="hover:bg-orange-50/25 transition-colors">
                      <td className="px-3.5 py-3 font-mono font-bold text-slate-400">{idx + 1}</td>

                      {/* Employee Info */}
                      <td className="px-3.5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 font-black text-xs shrink-0">
                            {row.person.fullName ? row.person.fullName.charAt(0) : 'U'}
                          </div>
                          <div>
                            <div className="font-black text-slate-900 flex items-center gap-1.5">
                              <span>{row.person.fullName}</span>
                              {row.person.isUser && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  {isAr ? 'مستخدم' : 'User'}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-bold">{row.person.jobTitle}</div>
                          </div>
                        </div>
                      </td>

                      {/* Branch & Dept */}
                      <td className="px-3.5 py-3 text-slate-600 font-bold">
                        <div>{row.person.branchName}</div>
                        <div className="text-[10px] text-slate-400">{row.person.departmentName}</div>
                      </td>

                      {/* Base Salary */}
                      <td className="px-3.5 py-3 text-end font-mono font-bold text-slate-900 tabular-nums">
                        {fmt(row.baseSalary)} <span className="text-[10px] text-slate-400">{row.currency}</span>
                      </td>

                      {/* Allowances */}
                      <td className="px-3.5 py-3 text-end font-mono font-bold text-emerald-700 tabular-nums">
                        +{fmt(row.allowances)} <span className="text-[10px] text-slate-400">{row.currency}</span>
                      </td>

                      {/* Points Reward & Bonuses */}
                      <td className="px-3.5 py-3 text-center">
                        <div className="font-mono font-bold text-emerald-600 tabular-nums">
                          +{fmt(row.bonuses)} <span className="text-[10px] text-slate-400 font-normal">{row.currency}</span>
                        </div>
                        <div className="flex flex-col gap-0.5 mt-1">
                          {row.incentivesAndProfits > 0 && (
                            <div className="text-[10px] font-semibold text-slate-600 flex items-center justify-center gap-1">
                              <span className="text-slate-400">{isAr ? 'حوافز وأرباح:' : 'Incentives:'}</span>
                              <span className="font-mono font-bold text-emerald-600 tabular-nums">+{fmt(row.incentivesAndProfits)}</span>
                            </div>
                          )}
                          {row.points.earnedPoints > 0 ? (
                            <div className="text-[10px] font-black text-amber-600 flex items-center justify-center gap-1">
                              <Award size={11} />
                              <span>{row.points.earnedPoints} {isAr ? 'نقطة مكافأة' : 'reward pts'}</span>
                              <span className="text-slate-400">({fmt(row.pointsRewardMoney)})</span>
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-400 font-medium">
                              {isAr ? 'مكافأة نقاط: 0 (لا توجد)' : 'Points: 0'}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Deductions & Penalty Points */}
                      <td className="px-3.5 py-3 text-center">
                        <div className="font-mono font-bold text-rose-600 tabular-nums">
                          -{fmt(row.deductions)} <span className="text-[10px] text-slate-400 font-normal">{row.currency}</span>
                        </div>
                        <div className="flex flex-col gap-0.5 mt-1">
                          {row.pensionDeduction > 0 && (
                            <div className="text-[10px] font-semibold text-slate-600 flex items-center justify-center gap-1">
                              <span className="text-slate-400">{isAr ? 'استقطاع تقاعد:' : 'Pension:'}</span>
                              <span className="font-mono font-bold text-rose-600 tabular-nums">-{fmt(row.pensionDeduction)}</span>
                            </div>
                          )}
                          {row.points.deductedPoints > 0 ? (
                            <div className="text-[10px] font-black text-rose-600 flex items-center justify-center gap-1">
                              <Minus size={11} />
                              <span>{row.points.deductedPoints} {isAr ? 'نقطة جزاء' : 'penalty pts'}</span>
                              <span className="text-slate-400">({fmt(row.pointsDeductionMoney)})</span>
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-400 font-medium">
                              {isAr ? 'خصم نقاط: 0 (لا يوجد)' : 'Penalty points: 0'}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Net Salary */}
                      <td className="px-3.5 py-3 text-end font-mono font-black text-sm text-slate-900 tabular-nums">
                        <span className="bg-orange-50 px-2.5 py-1 rounded-md text-[#F45A0A] border border-orange-200/80 inline-block font-black">
                          {fmt(row.netSalary)} {row.currency}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-3.5 py-3 text-center">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={12} />
                            <span>{isAr ? 'تم الصرف' : 'Paid'}</span>
                          </span>
                        ) : isApproved ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                            <Clock size={12} />
                            <span>{isAr ? 'معتمد' : 'Approved'}</span>
                          </span>
                        ) : isPending ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock size={12} />
                            <span>{isAr ? 'مسجل قيد الصرف' : 'Pending'}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Sparkles size={11} className="text-emerald-600" />
                            <span>{isAr ? 'جاهز' : 'Ready'}</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
