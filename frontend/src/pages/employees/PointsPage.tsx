import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Award,
  Trophy,
  Plus,
  Minus,
  Search,
  Calendar,
  Settings,
  Clock,
  Coins,
  CheckCircle2,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  Trash2,
} from 'lucide-react';
import { Modal, Select } from '@mantine/core';
import { hrApi, PointSummaryItem, PointLogItem, AwardPointsPayload, PointsRulesConfig } from '../../api/hr';
import { employeesApi } from '../../api/employees';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { useLanguageStore } from '../../store/useLanguageStore';
import { SegmentedDatePicker } from '../../components/ui/SegmentedDatePicker';
import { SearchableCombobox, ComboboxOption } from '../../components/ui/SearchableCombobox';

const fmt = (n: number | string | undefined | null) =>
  Number(n || 0).toLocaleString('en-US');
const todayISO = () => new Date().toISOString().slice(0, 10);

const DEFAULT_RULES: PointsRulesConfig = {
  latePointsPerMinute: 0,
  latePointPrice: 0,
  overtimePointsPerMinute: 0,
  overtimePointPrice: 0,
  earlyLeavePointsPerMinute: 0,
  earlyLeavePointPrice: 0,
  earlyArrivalPointsPerMinute: 0,
  earlyArrivalPointPrice: 0,
  currency: 'IQD',
};

export const PointsPage: React.FC = () => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'LEADERBOARD' | 'LOGS'>('LEADERBOARD');
  const [search, setSearch] = useState('');

  // Award / Deduct Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [formPoints, setFormPoints] = useState<number | string>('');
  const [formDate, setFormDate] = useState(todayISO());
  const [formReason, setFormReason] = useState('');
  const [formCategory, setFormCategory] = useState('ACHIEVEMENT');
  const [isDeduction, setIsDeduction] = useState(false);

  // Settings Modal State
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [rulesForm, setRulesForm] = useState<PointsRulesConfig>(DEFAULT_RULES);

  // Queries
  const { data: employees = [] } = useQuery({
    queryKey: ['hr-employees-list'],
    queryFn: employeesApi.getAll,
    staleTime: 60000,
  });

  const { data: leaderboard = [], isLoading: loadingLeaderboard } = useQuery({
    queryKey: ['hr-points-summary'],
    queryFn: hrApi.getPointsSummary,
    staleTime: 30000,
  });

  const { data: logs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ['hr-points-logs'],
    queryFn: () => hrApi.getPointsLogs(),
    staleTime: 30000,
  });

  const { data: pointsRules } = useQuery({
    queryKey: ['hr-points-rules'],
    queryFn: hrApi.getPointsRules,
    staleTime: 60000,
  });

  useEffect(() => {
    if (pointsRules) {
      setRulesForm({
        ...DEFAULT_RULES,
        ...pointsRules,
      });
    }
  }, [pointsRules]);

  // Mutations
  const awardMutation = useMutation({
    mutationFn: (payload: AwardPointsPayload) => hrApi.awardPoints(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-points-summary'] });
      queryClient.invalidateQueries({ queryKey: ['hr-points-logs'] });
      showSuccessNotification(
        isAr ? 'تمت العملية' : 'Success',
        isAr ? 'تم تسجيل حركة النقاط بنجاح' : 'Points recorded successfully'
      );
      setModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      showErrorNotification(isAr ? 'خطأ' : 'Error', err?.message || 'Failed to award points');
    },
  });

  const saveRulesMutation = useMutation({
    mutationFn: (data: PointsRulesConfig) => hrApi.savePointsRules(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-points-rules'] });
      showSuccessNotification(
        isAr ? 'تم حفظ القواعد' : 'Rules Saved',
        isAr ? 'تم حفظ قواعد واحتساب وتسعير نقاط الحضور والانصراف بنجاح في قاعدة البيانات' : 'Points rules updated successfully'
      );
      setSettingsModalOpen(false);
    },
    onError: (err: any) => {
      showErrorNotification(isAr ? 'خطأ' : 'Error', err?.message || 'Failed to save points rules');
    },
  });

  const deleteLogMutation = useMutation({
    mutationFn: (id: string) => hrApi.deletePointLog(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-points-summary'] });
      queryClient.invalidateQueries({ queryKey: ['hr-points-logs'] });
      showSuccessNotification(
        isAr ? 'تم الحذف' : 'Deleted',
        isAr ? 'تم حذف سجل النقاط' : 'Log deleted'
      );
    },
    onError: (err: any) => {
      showErrorNotification(isAr ? 'خطأ' : 'Error', err?.message || 'Delete failed');
    },
  });

  const employeeOptions: ComboboxOption[] = useMemo(() => {
    return employees.map((emp) => ({
      value: emp.id,
      label: emp.fullName,
      subLabel: emp.branchName ? `${emp.branchName}${emp.jobTitle ? ` • ${emp.jobTitle}` : ''}` : emp.jobTitle || undefined,
    }));
  }, [employees]);

  const resetForm = () => {
    setFormEmployeeId(employees[0]?.id || '');
    setFormPoints('');
    setFormReason('');
    setFormCategory('ACHIEVEMENT');
    setFormDate(todayISO());
    setIsDeduction(false);
  };

  const openAwardModal = (deduction = false) => {
    setIsDeduction(deduction);
    setFormEmployeeId(employees[0]?.id || '');
    setFormPoints('');
    setFormReason('');
    setFormCategory(deduction ? 'DISCIPLINE' : 'ACHIEVEMENT');
    setFormDate(todayISO());
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!formEmployeeId) {
      showErrorNotification(isAr ? 'تنبيه' : 'Notice', isAr ? 'يرجى اختيار الموظف' : 'Select employee');
      return;
    }
    const sanitizedPoints = String(formPoints)
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/[^0-9.]/g, '');
    const pts = Math.abs(Number(sanitizedPoints) || 0);
    if (!pts) {
      showErrorNotification(isAr ? 'تنبيه' : 'Notice', isAr ? 'يرجى إدخال عدد النقاط' : 'Please enter points');
      return;
    }

    const finalReason = formReason.trim() || (isDeduction 
      ? (isAr ? 'ملاحظة انضباط وخصم نقاط' : 'Disciplinary deduction') 
      : (isAr ? 'مكافأة نقاط تشجيعية' : 'Incentive bonus'));

    const finalPoints = isDeduction ? -pts : pts;

    awardMutation.mutate({
      employeeId: formEmployeeId,
      points: finalPoints,
      reason: finalReason,
      category: formCategory,
      date: formDate,
    });
  };

  const handleFieldChange = (field: keyof PointsRulesConfig, rawValue: string) => {
    // Sanitize any Eastern Arabic digits to English Western digits
    const englishDigits = rawValue
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/[^0-9.]/g, '');
    setRulesForm((prev) => ({
      ...prev,
      [field]: englishDigits === '' ? ('' as any) : Number(englishDigits) || englishDigits,
    }));
  };

  const handleSaveRules = () => {
    saveRulesMutation.mutate({
      latePointsPerMinute: Number(rulesForm.latePointsPerMinute) || 0,
      latePointPrice: Number(rulesForm.latePointPrice) || 0,
      overtimePointsPerMinute: Number(rulesForm.overtimePointsPerMinute) || 0,
      overtimePointPrice: Number(rulesForm.overtimePointPrice) || 0,
      earlyLeavePointsPerMinute: Number(rulesForm.earlyLeavePointsPerMinute) || 0,
      earlyLeavePointPrice: Number(rulesForm.earlyLeavePointPrice) || 0,
      earlyArrivalPointsPerMinute: Number(rulesForm.earlyArrivalPointsPerMinute) || 0,
      earlyArrivalPointPrice: Number(rulesForm.earlyArrivalPointPrice) || 0,
      currency: 'IQD',
    });
  };

  // Filtered Leaderboard
  const filteredLeaderboard = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leaderboard;
    return leaderboard.filter(
      (e) =>
        e.fullName.toLowerCase().includes(q) ||
        (e.branchName && e.branchName.toLowerCase().includes(q))
    );
  }, [leaderboard, search]);

  // Top 3
  const top3 = leaderboard.slice(0, 3);

  return (
    <div
      className="p-4 md:p-6 space-y-5 max-w-[1500px] mx-auto select-none"
      dir={direction}
      style={{ fontFamily: isAr ? "'IBM Plex Sans Arabic', system-ui, sans-serif" : "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      {/* ── Top Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-orange-50 border border-orange-200/80 text-[#F45A0A] flex items-center justify-center shadow-2xs shrink-0">
            <Award size={22} strokeWidth={2.4} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-base text-slate-900 tracking-tight">
                {isAr ? 'نقاط وتحفيز الموظفين (Leaderboard)' : 'Employee Points & Gamification'}
              </h1>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-50 text-[#C2410C] border border-orange-200/80">
                {isAr ? 'نظام المكافآت' : 'Rewards System'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-bold mt-0.5">
              {isAr
                ? 'تحفيز الكوادر، ترتيب الموظفين حسب الأداء والأوسمة، وضبط قواعد وتسعير نقاط الحضور والانصراف.'
                : 'Motivate staff, rank performance with tiers and badges, and configure attendance point rules.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Settings Icon Button */}
          <button
            type="button"
            onClick={() => setSettingsModalOpen(true)}
            title={isAr ? 'إعدادات وقواعد احتساب النقاط والتسعير' : 'Points Rules & Pricing Settings'}
            className="flex items-center gap-1.5 bg-white hover:bg-orange-50/60 text-slate-700 hover:text-[#F45A0A] px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border border-slate-200 shadow-2xs active:scale-95"
          >
            <Settings size={16} className="text-[#F45A0A]" />
            <span>{isAr ? 'إعدادات وقواعد النقاط' : 'Points Settings'}</span>
          </button>

          <button
            type="button"
            onClick={() => openAwardModal(false)}
            className="flex items-center gap-1.5 bg-[#F45A0A] hover:bg-[#DC4B02] text-white px-3.5 py-2 rounded-xl text-xs font-black shadow-md shadow-orange-500/20 transition-all cursor-pointer active:scale-95"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>{isAr ? 'منح مكافأة نقاط' : 'Award Points'}</span>
          </button>
          <button
            type="button"
            onClick={() => openAwardModal(true)}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer"
          >
            <Minus size={15} />
            <span>{isAr ? 'خصم نقاط' : 'Deduct Points'}</span>
          </button>
        </div>
      </div>

      {/* ── Top 3 Podium Cards (Only shown if points actually exist > 0) ── */}
      {top3.length > 0 && top3.some((e) => e.totalPoints > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {top3.map((emp, index) => {
            const isFirst = index === 0;
            const isSecond = index === 1;
            const rankLabel = isFirst ? '1' : isSecond ? '2' : '3';
            const badgeColor = isFirst
              ? 'bg-amber-100 text-amber-800 border-amber-300'
              : isSecond
              ? 'bg-slate-200 text-slate-800 border-slate-300'
              : 'bg-orange-100 text-orange-900 border-orange-300';

            return (
              <div
                key={emp.id}
                className={`relative bg-white rounded-2xl border p-4 shadow-2xs flex items-center justify-between transition-all ${
                  isFirst
                    ? 'border-amber-300 bg-gradient-to-b from-amber-50/40 to-white'
                    : 'border-slate-200/90'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono font-black text-base border shadow-2xs ${badgeColor}`}
                  >
                    {isFirst ? <Trophy size={20} className="text-amber-600" /> : rankLabel}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-black text-slate-900 text-sm leading-tight">{emp.fullName}</h3>
                      {isFirst && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-500 text-white">
                          {isAr ? 'المتصدر 👑' : 'Top Performer 👑'}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 font-bold block mt-0.5">
                      {emp.branchName || 'الفرع الرئيسي'} • {emp.jobTitle || 'موظف'}
                    </span>
                  </div>
                </div>

                <div className="text-end">
                  <div className="flex items-baseline gap-1 justify-end">
                    <span className="font-mono font-black text-xl text-[#F45A0A] tabular-nums">
                      {fmt(emp.totalPoints)}
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">{isAr ? 'نقطة' : 'pts'}</span>
                  </div>
                  <span className="inline-block text-[9px] font-black px-2 py-0.5 rounded-full bg-orange-50 text-[#C2410C] border border-orange-200">
                    {emp.tierAr}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Tabs & Search Bar ── */}
      <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('LEADERBOARD')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
              activeTab === 'LEADERBOARD'
                ? 'bg-[#F45A0A] text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Trophy size={14} />
            <span>{isAr ? 'لوحة الترتيب العام' : 'Leaderboard'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('LOGS')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
              activeTab === 'LOGS'
                ? 'bg-[#F45A0A] text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Calendar size={14} />
            <span>{isAr ? 'سجل الحركات الأخير' : 'Points Activity'}</span>
          </button>
        </div>

        <div className="relative min-w-[240px]">
          <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? 'بحث عن موظف...' : 'Search employee...'}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg ps-8 pe-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-500 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* ── Tab Content: Leaderboard ── */}
      {activeTab === 'LEADERBOARD' && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/90 text-[11px] font-black text-slate-600 select-none">
                  <th className="px-4 py-3 text-start">{isAr ? 'الترتيب' : 'Rank'}</th>
                  <th className="px-4 py-3 text-start">{isAr ? 'الموظف' : 'Employee'}</th>
                  <th className="px-4 py-3 text-start">{isAr ? 'الفرع والقسم' : 'Branch / Department'}</th>
                  <th className="px-4 py-3 text-center">{isAr ? 'المستوى' : 'Tier'}</th>
                  <th className="px-4 py-3 text-end">{isAr ? 'إجمالي النقاط' : 'Total Points'}</th>
                  <th className="px-4 py-3 text-center">{isAr ? 'إجراء سريع' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingLeaderboard ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400 font-bold">
                      {isAr ? 'جاري تحميل لوحة الشرف...' : 'Loading leaderboard...'}
                    </td>
                  </tr>
                ) : filteredLeaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400 font-bold">
                      {isAr ? 'لا يوجد موظفون' : 'No employees found'}
                    </td>
                  </tr>
                ) : (
                  filteredLeaderboard.map((emp, idx) => (
                    <tr key={emp.id} className="hover:bg-orange-50/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-black text-slate-700">
                        <span
                          className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-[11px] ${
                            idx === 0
                              ? 'bg-amber-100 text-amber-800 font-black'
                              : idx === 1
                              ? 'bg-slate-200 text-slate-800'
                              : idx === 2
                              ? 'bg-orange-100 text-orange-900'
                              : 'text-slate-400'
                          }`}
                        >
                          {idx + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-black text-slate-900">
                        {emp.fullName}
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-bold">
                        <div>{emp.branchName || 'الفرع الرئيسي'}</div>
                        <div className="text-[10px] text-slate-400">{emp.jobTitle}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-block text-[10px] font-black px-2.5 py-0.5 rounded-full bg-orange-50 text-[#C2410C] border border-orange-200">
                          {emp.tierAr}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-end font-mono font-black text-sm text-slate-900 tabular-nums">
                        {fmt(emp.totalPoints)} <span className="text-[10px] text-slate-400">{isAr ? 'نقطة' : 'pts'}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setFormEmployeeId(emp.id);
                            setIsDeduction(false);
                            setFormPoints('');
                            setFormReason('');
                            setModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-black text-orange-700 hover:text-white bg-orange-50 hover:bg-[#F45A0A] border border-orange-200 transition-all cursor-pointer active:scale-95"
                        >
                          + {isAr ? 'مكافأة' : 'Reward'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab Content: Logs ── */}
      {activeTab === 'LOGS' && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/90 text-[11px] font-black text-slate-600 select-none">
                  <th className="px-4 py-3 text-start">{isAr ? 'التاريخ' : 'Date'}</th>
                  <th className="px-4 py-3 text-start">{isAr ? 'الموظف' : 'Employee'}</th>
                  <th className="px-4 py-3 text-start">{isAr ? 'السبب والتفاصيل' : 'Reason'}</th>
                  <th className="px-4 py-3 text-start">{isAr ? 'بواسطة' : 'Awarded By'}</th>
                  <th className="px-4 py-3 text-end">{isAr ? 'النقاط' : 'Points'}</th>
                  <th className="px-4 py-3 text-center">{isAr ? 'إجراء' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingLogs ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400 font-bold">
                      {isAr ? 'جاري تحميل السجلات...' : 'Loading logs...'}
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400 font-bold">
                      {isAr ? 'لا توجد حركات نقاط مسجلة بعد' : 'No points activity recorded yet'}
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const isPositive = log.points > 0;
                    return (
                      <tr key={log.id} className="hover:bg-orange-50/30 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-slate-500 font-bold">
                          {new Date(log.date).toLocaleDateString('en-US')}
                        </td>
                        <td className="px-4 py-2.5 font-bold text-slate-900">
                          {log.employee?.fullName || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-slate-700 font-medium">
                          {log.reason}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 font-bold">
                          {log.awardedBy || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-end font-mono font-black text-sm tabular-nums">
                          <span className={isPositive ? 'text-emerald-600' : 'text-rose-600'}>
                            {isPositive ? `+${log.points}` : log.points}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(isAr ? 'هل أنت متأكد من حذف هذا السجل؟' : 'Delete this log entry?')) {
                                deleteLogMutation.mutate(log.id);
                              }
                            }}
                            className="p-1 rounded text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                            title={isAr ? 'حذف الحركة' : 'Delete'}
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Settings Modal: Points Rules & Pricing ── */}
      <Modal
        opened={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-orange-50 border border-orange-200 text-[#F45A0A] flex items-center justify-center shrink-0">
              <Settings size={16} />
            </div>
            <span className="font-black text-sm text-slate-900">
              {isAr ? 'إعدادات وقواعد احتساب وتسعير النقاط' : 'Points Rules & Pricing'}
            </span>
          </div>
        }
        dir={direction}
        centered
        size="md"
        radius="xl"
        classNames={{
          body: 'no-scrollbar',
          content: 'no-scrollbar',
        }}
        styles={{
          body: {
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            overflowY: 'auto',
          },
          content: {
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          },
        }}
      >
        <div className="space-y-2 pt-0">
          {/* Card 1: Late Arrival */}
          <div className="bg-white rounded-xl border border-slate-200 p-2.5 space-y-1.5 shadow-2xs hover:border-orange-300 transition-colors">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-orange-50 border border-orange-200 text-[#F45A0A] flex items-center justify-center shrink-0">
                <Clock size={15} />
              </div>
              <span className="font-black text-xs text-slate-900">
                {isAr ? 'تأخير الحضور' : 'Late Arrival'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-black text-slate-800 mb-0.5 text-center">
                  {isAr ? 'نقاط الخصم / دقيقة' : 'Points / Min'}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  lang="en"
                  value={String(rulesForm.latePointsPerMinute ?? '')}
                  onChange={(e) => handleFieldChange('latePointsPerMinute', e.target.value)}
                  placeholder="0"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1 text-xs font-mono font-black tabular-nums lining-nums text-slate-900 text-center focus:outline-none focus:border-[#F45A0A] focus:ring-1 focus:ring-[#F45A0A] transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-800 mb-0.5 text-center">
                  {isAr ? 'سعر النقطة (IQD)' : 'Point Price (IQD)'}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  lang="en"
                  value={String(rulesForm.latePointPrice ?? '')}
                  onChange={(e) => handleFieldChange('latePointPrice', e.target.value)}
                  placeholder="0"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1 text-xs font-mono font-black tabular-nums lining-nums text-slate-900 text-center focus:outline-none focus:border-[#F45A0A] focus:ring-1 focus:ring-[#F45A0A] transition-all"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Overtime */}
          <div className="bg-white rounded-xl border border-slate-200 p-2.5 space-y-1.5 shadow-2xs hover:border-orange-300 transition-colors">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-orange-50 border border-orange-200 text-[#F45A0A] flex items-center justify-center shrink-0">
                <TrendingUp size={15} />
              </div>
              <span className="font-black text-xs text-slate-900">
                {isAr ? 'العمل الإضافي' : 'Overtime'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-black text-slate-800 mb-0.5 text-center">
                  {isAr ? 'نقاط الإضافي / دقيقة' : 'Points / Min'}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  lang="en"
                  value={String(rulesForm.overtimePointsPerMinute ?? '')}
                  onChange={(e) => handleFieldChange('overtimePointsPerMinute', e.target.value)}
                  placeholder="0"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1 text-xs font-mono font-black tabular-nums lining-nums text-slate-900 text-center focus:outline-none focus:border-[#F45A0A] focus:ring-1 focus:ring-[#F45A0A] transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-800 mb-0.5 text-center">
                  {isAr ? 'سعر النقطة (IQD)' : 'Point Price (IQD)'}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  lang="en"
                  value={String(rulesForm.overtimePointPrice ?? '')}
                  onChange={(e) => handleFieldChange('overtimePointPrice', e.target.value)}
                  placeholder="0"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1 text-xs font-mono font-black tabular-nums lining-nums text-slate-900 text-center focus:outline-none focus:border-[#F45A0A] focus:ring-1 focus:ring-[#F45A0A] transition-all"
                />
              </div>
            </div>
          </div>

          {/* Card 3: Early Departure */}
          <div className="bg-white rounded-xl border border-slate-200 p-2.5 space-y-1.5 shadow-2xs hover:border-orange-300 transition-colors">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-orange-50 border border-orange-200 text-[#F45A0A] flex items-center justify-center shrink-0">
                <Minus size={15} />
              </div>
              <span className="font-black text-xs text-slate-900">
                {isAr ? 'الخروج المبكر' : 'Early Departure'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-black text-slate-800 mb-0.5 text-center">
                  {isAr ? 'نقاط الخصم / دقيقة' : 'Points / Min'}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  lang="en"
                  value={String(rulesForm.earlyLeavePointsPerMinute ?? '')}
                  onChange={(e) => handleFieldChange('earlyLeavePointsPerMinute', e.target.value)}
                  placeholder="0"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1 text-xs font-mono font-black tabular-nums lining-nums text-slate-900 text-center focus:outline-none focus:border-[#F45A0A] focus:ring-1 focus:ring-[#F45A0A] transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-800 mb-0.5 text-center">
                  {isAr ? 'سعر النقطة (IQD)' : 'Point Price (IQD)'}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  lang="en"
                  value={String(rulesForm.earlyLeavePointPrice ?? '')}
                  onChange={(e) => handleFieldChange('earlyLeavePointPrice', e.target.value)}
                  placeholder="0"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1 text-xs font-mono font-black tabular-nums lining-nums text-slate-900 text-center focus:outline-none focus:border-[#F45A0A] focus:ring-1 focus:ring-[#F45A0A] transition-all"
                />
              </div>
            </div>
          </div>

          {/* Card 4: Early Arrival */}
          <div className="bg-white rounded-xl border border-slate-200 p-2.5 space-y-1.5 shadow-2xs hover:border-orange-300 transition-colors">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-orange-50 border border-orange-200 text-[#F45A0A] flex items-center justify-center shrink-0">
                <Award size={15} />
              </div>
              <span className="font-black text-xs text-slate-900">
                {isAr ? 'الحضور المبكر' : 'Early Arrival'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-black text-slate-800 mb-0.5 text-center">
                  {isAr ? 'نقاط الإضافة / دقيقة' : 'Points / Min'}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  lang="en"
                  value={String(rulesForm.earlyArrivalPointsPerMinute ?? '')}
                  onChange={(e) => handleFieldChange('earlyArrivalPointsPerMinute', e.target.value)}
                  placeholder="0"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1 text-xs font-mono font-black tabular-nums lining-nums text-slate-900 text-center focus:outline-none focus:border-[#F45A0A] focus:ring-1 focus:ring-[#F45A0A] transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-800 mb-0.5 text-center">
                  {isAr ? 'سعر النقطة (IQD)' : 'Point Price (IQD)'}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  lang="en"
                  value={String(rulesForm.earlyArrivalPointPrice ?? '')}
                  onChange={(e) => handleFieldChange('earlyArrivalPointPrice', e.target.value)}
                  placeholder="0"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1 text-xs font-mono font-black tabular-nums lining-nums text-slate-900 text-center focus:outline-none focus:border-[#F45A0A] focus:ring-1 focus:ring-[#F45A0A] transition-all"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setRulesForm({
                  latePointsPerMinute: 0,
                  latePointPrice: 0,
                  overtimePointsPerMinute: 0,
                  overtimePointPrice: 0,
                  earlyLeavePointsPerMinute: 0,
                  earlyLeavePointPrice: 0,
                  earlyArrivalPointsPerMinute: 0,
                  earlyArrivalPointPrice: 0,
                  currency: 'IQD',
                });
              }}
              className="px-3 py-2 rounded-xl text-xs font-black text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-all cursor-pointer"
            >
              {isAr ? 'تصفير الحقول' : 'Reset to 0'}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSettingsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-black text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSaveRules}
                disabled={saveRulesMutation.isPending}
                className="bg-[#F45A0A] hover:bg-[#DC4B02] text-white px-6 py-2 rounded-xl text-xs font-black shadow-md shadow-orange-500/20 transition-all cursor-pointer active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
              >
                <CheckCircle2 size={16} />
                <span>
                  {saveRulesMutation.isPending
                    ? isAr
                      ? 'جاري الحفظ...'
                      : 'Saving...'
                    : isAr
                    ? 'حفظ واعتماد القواعد'
                    : 'Save Rules'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Manual Award / Deduct ── */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          <span className="font-black text-sm text-slate-900">
            {isDeduction
              ? isAr
                ? 'تسجيل خصم نقاط لموظف'
                : 'Deduct Points from Employee'
              : isAr
              ? 'منح مكافأة نقاط تشجيعية'
              : 'Award Incentive Points'}
          </span>
        }
        dir={direction}
        centered
        size="md"
        radius="xl"
      >
        <div className="space-y-3.5 pt-1">
          <div>
            <SearchableCombobox
              label={isAr ? 'الموظف المستهدف *' : 'Target Employee *'}
              placeholder={isAr ? 'اختر الموظف...' : 'Select employee...'}
              options={employeeOptions}
              value={formEmployeeId}
              onChange={setFormEmployeeId}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{isAr ? 'التاريخ' : 'Date'}</label>
              <SegmentedDatePicker
                value={formDate}
                onChange={(_, iso) => setFormDate(iso || todayISO())}
                clearable={false}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{isAr ? 'عدد النقاط' : 'Points'}</label>
              <input
                type="number"
                value={formPoints}
                onChange={(e) => setFormPoints(e.target.value)}
                min={1}
                placeholder="50"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono font-black text-slate-900 focus:outline-none focus:border-[#F45A0A] tabular-nums"
              />
            </div>
          </div>

          <div>
            <Select
              label={isAr ? 'التصنيف' : 'Category'}
              value={formCategory}
              onChange={(val) => setFormCategory(val || 'ACHIEVEMENT')}
              data={[
                { value: 'ACHIEVEMENT', label: isAr ? 'إنجاز متميز' : 'Achievement' },
                { value: 'SALES', label: isAr ? 'تحقيق هدف مبيعات' : 'Sales Target' },
                { value: 'ATTENDANCE', label: isAr ? 'انضباط الدوام' : 'Attendance' },
                { value: 'BONUS', label: isAr ? 'مكافأة خاصة' : 'Special Bonus' },
                { value: 'DISCIPLINE', label: isAr ? 'ملاحظة انضباط' : 'Discipline' },
              ]}
              size="xs"
              radius="md"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">{isAr ? 'السبب / المناسبة' : 'Reason'}</label>
            <input
              type="text"
              value={formReason}
              onChange={(e) => setFormReason(e.target.value)}
              placeholder={isAr ? 'سبب منح أو خصم النقاط...' : 'Reason for points...'}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#F45A0A]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-black text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={awardMutation.isPending}
              className="bg-[#F45A0A] hover:bg-[#DC4B02] text-white px-5 py-2 rounded-xl text-xs font-black shadow-md shadow-orange-500/20 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {awardMutation.isPending
                ? isAr
                  ? 'جاري الحفظ...'
                  : 'Saving...'
                : isAr
                ? 'تأكيد التسجيل'
                : 'Confirm'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
