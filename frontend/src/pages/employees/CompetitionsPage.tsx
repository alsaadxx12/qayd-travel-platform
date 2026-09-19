import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Trophy,
  Target,
  Plus,
  Search,
  Sparkles,
  Gift,
  Calendar,
  CheckCircle2,
  Clock,
  Trash2,
  Flame,
  Award,
  Crown,
} from 'lucide-react';
import { Modal, Select } from '@mantine/core';
import { hrApi, CompetitionItem, CreateCompetitionPayload, UpdateCompetitionPayload } from '../../api/hr';
import { employeesApi } from '../../api/employees';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { useLanguageStore } from '../../store/useLanguageStore';
import { SegmentedDatePicker } from '../../components/ui/SegmentedDatePicker';
import { SearchableCombobox, ComboboxOption } from '../../components/ui/SearchableCombobox';

const todayISO = () => new Date().toISOString().slice(0, 10);
const futureMonthISO = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
};

export const CompetitionsPage: React.FC = () => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';
  const queryClient = useQueryClient();

  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  // Modal Create State (Zero fake values)
  const [modalOpen, setModalOpen] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTargetType, setFormTargetType] = useState<'SALES_VOLUME' | 'TICKETS_COUNT' | 'ATTENDANCE_STREAK' | 'POINTS_EARNED'>('SALES_VOLUME');
  const [formTargetValue, setFormTargetValue] = useState<number | string>('');
  const [formReward, setFormReward] = useState('');
  const [formStartDate, setFormStartDate] = useState(todayISO());
  const [formEndDate, setFormEndDate] = useState(futureMonthISO());

  // Modal Winner State
  const [winnerModalOpen, setWinnerModalOpen] = useState(false);
  const [activeCompForWinner, setActiveCompForWinner] = useState<CompetitionItem | null>(null);
  const [winnerEmployeeId, setWinnerEmployeeId] = useState('');

  // Queries
  const { data: employees = [] } = useQuery({
    queryKey: ['hr-employees-list'],
    queryFn: employeesApi.getAll,
    staleTime: 60000,
  });

  const employeeOptions: ComboboxOption[] = useMemo(() => {
    return employees.map((emp) => ({
      value: emp.id,
      label: emp.fullName,
      subLabel: emp.branchName ? `${emp.branchName}${emp.jobTitle ? ` • ${emp.jobTitle}` : ''}` : emp.jobTitle || undefined,
    }));
  }, [employees]);

  const { data: competitions = [], isLoading } = useQuery({
    queryKey: ['hr-competitions', selectedStatus],
    queryFn: () =>
      hrApi.getCompetitions(selectedStatus === 'ALL' ? undefined : selectedStatus),
    staleTime: 30000,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: CreateCompetitionPayload) => hrApi.createCompetition(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-competitions'] });
      queryClient.invalidateQueries({ queryKey: ['addons-hr-stats'] });
      showSuccessNotification(
        isAr ? 'تم الإطلاق' : 'Launched',
        isAr ? 'تم إطلاق المسابقة بنجاح' : 'Competition created successfully'
      );
      setModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      showErrorNotification(isAr ? 'خطأ' : 'Error', err?.message || 'Failed to create competition');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateCompetitionPayload }) =>
      hrApi.updateCompetition(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-competitions'] });
      showSuccessNotification(
        isAr ? 'تم التحديث' : 'Updated',
        isAr ? 'تم تتويج الفائز وتحديث المسابقة بنجاح' : 'Competition updated'
      );
      setWinnerModalOpen(false);
    },
    onError: (err: any) => {
      showErrorNotification(isAr ? 'خطأ' : 'Error', err?.message || 'Update failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => hrApi.deleteCompetition(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-competitions'] });
      showSuccessNotification(
        isAr ? 'تم الحذف' : 'Deleted',
        isAr ? 'تم حذف المسابقة' : 'Competition deleted'
      );
    },
    onError: (err: any) => {
      showErrorNotification(isAr ? 'خطأ' : 'Error', err?.message || 'Delete failed');
    },
  });

  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormTargetType('SALES_VOLUME');
    setFormTargetValue('');
    setFormReward('');
    setFormStartDate(todayISO());
    setFormEndDate(futureMonthISO());
  };

  const handleCreate = () => {
    if (!formTitle.trim()) {
      showErrorNotification(isAr ? 'تنبيه' : 'Notice', isAr ? 'يرجى كتابة عنوان المسابقة' : 'Enter title');
      return;
    }
    if (!formReward.trim()) {
      showErrorNotification(isAr ? 'تنبيه' : 'Notice', isAr ? 'يرجى تحديد الجائزة أو المكافأة' : 'Enter reward');
      return;
    }
    createMutation.mutate({
      title: formTitle.trim(),
      description: formDescription.trim(),
      targetType: formTargetType,
      targetValue: Number(formTargetValue) || 0,
      reward: formReward.trim(),
      startDate: formStartDate,
      endDate: formEndDate,
    });
  };

  const handleCrownWinner = () => {
    if (!activeCompForWinner || !winnerEmployeeId) return;
    updateMutation.mutate({
      id: activeCompForWinner.id,
      payload: {
        status: 'COMPLETED',
        winnerEmployeeId,
      },
    });
  };

  // Filtered competitions
  const filteredCompetitions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return competitions.filter((c) => {
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q)) ||
        (c.reward && c.reward.toLowerCase().includes(q))
      );
    });
  }, [competitions, search]);

  const getTargetTypeBadge = (type: string, val: number) => {
    switch (type) {
      case 'SALES_VOLUME':
        return isAr ? `مبيعات بقيمة ${Number(val).toLocaleString('en-US')} $` : `$${Number(val).toLocaleString('en-US')} Sales Volume`;
      case 'TICKETS_COUNT':
        return isAr ? `إصدار ${Number(val).toLocaleString('en-US')} تذكرة` : `${Number(val).toLocaleString('en-US')} Flight Tickets`;
      case 'ATTENDANCE_STREAK':
        return isAr ? `التزام دوام ${Number(val).toLocaleString('en-US')} يوم` : `${Number(val).toLocaleString('en-US')} Days Attendance`;
      case 'POINTS_EARNED':
        return isAr ? `جمع ${Number(val).toLocaleString('en-US')} نقطة` : `${Number(val).toLocaleString('en-US')} Points Earned`;
      default:
        return '';
    }
  };

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
            <Trophy size={22} strokeWidth={2.4} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-base text-slate-900 tracking-tight">
                {isAr ? 'مسابقات وتحديات الموظفين' : 'Staff Competitions & Challenges'}
              </h1>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-50 text-[#C2410C] border border-orange-200/80">
                {isAr ? 'التحفيز والمكافآت' : 'Team Incentives'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-bold mt-0.5">
              {isAr
                ? 'إطلاق تحديات المبيعات وإصدار التذاكر، رصد تحقيق الأهداف وتتويج الفائزين بجوائز عينية ومالية.'
                : 'Launch sales challenges, monitor milestone progress, and crown top staff with prizes.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              resetForm();
              setModalOpen(true);
            }}
            className="flex items-center gap-1.5 bg-[#F45A0A] hover:bg-[#DC4B02] text-white px-3.5 py-2 rounded-xl text-xs font-black shadow-md shadow-orange-500/20 transition-all cursor-pointer active:scale-95"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>{isAr ? 'إطلاق مسابقة وتحدي جديد' : 'New Challenge'}</span>
          </button>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          {[
            { key: 'ALL', label: isAr ? 'الكل' : 'All' },
            { key: 'ACTIVE', label: isAr ? 'النشطة حالياً' : 'Active' },
            { key: 'COMPLETED', label: isAr ? 'المكتملة' : 'Completed' },
          ].map((st) => (
            <button
              key={st.key}
              type="button"
              onClick={() => setSelectedStatus(st.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                selectedStatus === st.key
                  ? 'bg-orange-50 text-[#F45A0A] border border-orange-200'
                  : 'text-slate-600 hover:bg-slate-100 border border-transparent'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? 'بحث عن تحدي أو جائزة...' : 'Search challenges...'}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg ps-8 pe-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-500 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* ── Grid of Competitions ── */}
      {isLoading ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400 font-bold">
          {isAr ? 'جاري تحميل المسابقات...' : 'Loading competitions...'}
        </div>
      ) : filteredCompetitions.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400 font-bold">
          {isAr ? 'لا توجد مسابقات مسجلة حالياً. اضغط "إطلاق مسابقة جديدة" لبدء التحدي.' : 'No competitions found.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {filteredCompetitions.map((comp) => {
            const isActive = comp.status === 'ACTIVE';
            const isCompleted = comp.status === 'COMPLETED';

            return (
              <div
                key={comp.id}
                className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex flex-col justify-between gap-3 hover:shadow-md hover:border-orange-300 transition-all"
              >
                {/* Header */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {isActive ? (isAr ? '🔥 نشطة وجارية' : 'Active') : (isAr ? '✔ مكتملة' : 'Completed')}
                    </span>

                    <span className="text-[10px] text-slate-400 font-mono font-bold">
                      {new Date(comp.startDate).toLocaleDateString('en-US')} ➔ {new Date(comp.endDate).toLocaleDateString('en-US')}
                    </span>
                  </div>

                  <h3 className="font-black text-slate-900 text-sm leading-snug">
                    {comp.title}
                  </h3>

                  {comp.description && (
                    <p className="text-xs text-slate-500 font-medium line-clamp-2">
                      {comp.description}
                    </p>
                  )}
                </div>

                {/* Target & Reward Box */}
                <div className="bg-[#FFF7ED] border border-orange-200/70 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-orange-950 font-bold">
                      <Target size={14} className="text-[#F45A0A]" />
                      <span>{isAr ? 'الهدف المطلوب:' : 'Target:'}</span>
                    </div>
                    <span className="font-mono font-black text-slate-900 text-xs tabular-nums">
                      {getTargetTypeBadge(comp.targetType, Number(comp.targetValue))}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-orange-200/50">
                    <div className="flex items-center gap-1.5 text-orange-950 font-bold">
                      <Gift size={14} className="text-[#F45A0A]" />
                      <span>{isAr ? 'الجائزة:' : 'Reward:'}</span>
                    </div>
                    <span className="font-black text-orange-800 text-xs">
                      {comp.reward}
                    </span>
                  </div>
                </div>

                {/* Winner Display if completed */}
                {isCompleted && comp.winnerEmployee && (
                  <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Crown size={16} className="text-amber-600" />
                      <span className="text-xs font-black text-amber-950">
                        {isAr ? 'الفائز بالمسابقة:' : 'Winner:'} {comp.winnerEmployee.fullName}
                      </span>
                    </div>
                    <span className="text-[10px] text-amber-700 font-bold">🏆 1st</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  {isActive ? (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveCompForWinner(comp);
                        setWinnerEmployeeId(employees[0]?.id || '');
                        setWinnerModalOpen(true);
                      }}
                      className="flex items-center gap-1 text-[11px] font-black text-[#F45A0A] hover:text-white bg-orange-50 hover:bg-[#F45A0A] border border-orange-200 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
                    >
                      <Crown size={13} />
                      <span>{isAr ? 'إعلان الفائز وإنهاء المسابقة' : 'Crown Winner'}</span>
                    </button>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-400">
                      {isAr ? 'تم إغلاق المسابقة' : 'Challenge closed'}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(isAr ? 'حذف هذه المسابقة؟' : 'Delete competition?')) {
                        deleteMutation.mutate(comp.id);
                      }
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                    title={isAr ? 'حذف' : 'Delete'}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal: Create Competition ── */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <Trophy size={18} className="text-[#F45A0A]" />
            <span className="font-black text-sm text-slate-900">
              {isAr ? 'إطلاق مسابقة وتحدي جديد' : 'Launch New Challenge'}
            </span>
          </div>
        }
        dir={direction}
        centered
        size="md"
        radius="lg"
      >
        <div className="space-y-3.5 pt-2">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">{isAr ? 'عنوان التحدي' : 'Title'}</label>
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder={isAr ? 'مثال: تحدي مبيعات سبتمبر، أسرع موظف إصدار...' : 'e.g. Top Flight Seller...'}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">{isAr ? 'وصف المسابقة' : 'Description'}</label>
            <textarea
              rows={2}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder={isAr ? 'تفاصيل وشروط المشاركة...' : 'Challenge details...'}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div>
              <Select
                label={isAr ? 'نوع الهدف' : 'Target Type'}
                value={formTargetType}
                onChange={(val) => setFormTargetType((val as any) || 'SALES_VOLUME')}
                data={[
                  { value: 'SALES_VOLUME', label: isAr ? 'حجم المبيعات بالدولار' : 'Sales Volume ($)' },
                  { value: 'TICKETS_COUNT', label: isAr ? 'عدد تذاكر الطيران' : 'Tickets Count' },
                  { value: 'ATTENDANCE_STREAK', label: isAr ? 'أيام الالتزام بالدوام' : 'Attendance Days' },
                  { value: 'POINTS_EARNED', label: isAr ? 'جمع نقاط تحفيز' : 'Incentive Points' },
                ]}
                size="xs"
                radius="md"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{isAr ? 'القيمة المستهدفة' : 'Target Value'}</label>
              <input
                type="number"
                value={formTargetValue}
                onChange={(e) => setFormTargetValue(e.target.value)}
                placeholder="5000"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono font-black text-slate-900 focus:outline-none focus:border-[#F45A0A] tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">{isAr ? 'الجائزة أو المكافأة' : 'Prize / Reward'}</label>
            <input
              type="text"
              value={formReward}
              onChange={(e) => setFormReward(e.target.value)}
              placeholder={isAr ? 'مثال: مكافأة مالية 200$ + درع تميز' : '$200 cash prize'}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#F45A0A]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div>
              <SegmentedDatePicker
                label={isAr ? 'تاريخ البدء' : 'Start Date'}
                placeholder={isAr ? 'اختر تاريخ البدء' : 'Select Start Date'}
                value={formStartDate}
                onChange={(_, iso) => setFormStartDate(iso || todayISO())}
                clearable={false}
              />
            </div>
            <div>
              <SegmentedDatePicker
                label={isAr ? 'تاريخ الانتهاء' : 'End Date'}
                placeholder={isAr ? 'اختر تاريخ الانتهاء' : 'Select End Date'}
                value={formEndDate}
                onChange={(_, iso) => setFormEndDate(iso || futureMonthISO())}
                clearable={false}
              />
            </div>
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
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="bg-[#F45A0A] hover:bg-[#DC4B02] text-white px-5 py-2 rounded-xl text-xs font-black shadow-md shadow-orange-500/20 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {createMutation.isPending
                ? isAr
                  ? 'جاري الإطلاق...'
                  : 'Launching...'
                : isAr
                ? 'إطلاق المسابقة'
                : 'Launch Challenge'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Crown Winner ── */}
      <Modal
        opened={winnerModalOpen}
        onClose={() => setWinnerModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <Crown size={18} className="text-amber-500" />
            <span className="font-black text-sm text-slate-900">
              {isAr ? 'تتويج الفائز بالمسابقة' : 'Crown Competition Winner'}
            </span>
          </div>
        }
        dir={direction}
        centered
        size="md"
        radius="lg"
      >
        <div className="space-y-3.5 pt-2">
          <p className="text-xs text-slate-600 font-medium">
            {isAr
              ? `اختر الموظف الفائز بمسابقة (${activeCompForWinner?.title}). سيتم إنهاء المسابقة وتوثيق الفائز في السجل.`
              : `Select the winning employee for (${activeCompForWinner?.title}).`}
          </p>

          <div>
            <SearchableCombobox
              label={isAr ? 'الموظف الفائز' : 'Winner'}
              placeholder={isAr ? 'ابحث عن الموظف بالاسم أو الفرع...' : 'Search employee...'}
              options={employeeOptions}
              value={winnerEmployeeId}
              onChange={(val) => setWinnerEmployeeId(val)}
              required={true}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setWinnerModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-black text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleCrownWinner}
              disabled={updateMutation.isPending}
              className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2 rounded-xl text-xs font-black shadow-md shadow-amber-500/20 transition-all cursor-pointer active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Crown size={14} />
              <span>{updateMutation.isPending ? (isAr ? 'جاري التتويج...' : 'Saving...') : (isAr ? 'تتويج الفائز' : 'Confirm Winner')}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
