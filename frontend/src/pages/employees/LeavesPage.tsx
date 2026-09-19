import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CalendarRange,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  Calendar,
  Building2,
  AlertCircle,
  Sliders,
  Users,
  ShieldCheck,
  Edit2,
  Check,
  Award,
  Layers,
  ArrowRight,
  ArrowLeft,
  Filter,
} from 'lucide-react';
import { Modal, Select } from '@mantine/core';
import { hrApi, LeaveItem, CreateLeavePayload, LeaveBalanceItem, SetLeaveBalancePayload, BatchSetLeaveBalancesPayload } from '../../api/hr';
import { employeesApi } from '../../api/employees';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { useLanguageStore } from '../../store/useLanguageStore';
import { SegmentedDatePicker } from '../../components/ui/SegmentedDatePicker';
import { SearchableCombobox, ComboboxOption } from '../../components/ui/SearchableCombobox';

const todayISO = () => new Date().toISOString().slice(0, 10);
const CURRENT_YEAR = new Date().getFullYear();

export const LeavesPage: React.FC = () => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';
  const queryClient = useQueryClient();

  // Filters for the main requests log
  const [activeYear, setActiveYear] = useState<number>(CURRENT_YEAR);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('ALL');
  const [searchRequests, setSearchRequests] = useState('');

  // Modals State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [batchBalanceModalOpen, setBatchBalanceModalOpen] = useState(false);
  const [employeeBalancesModalOpen, setEmployeeBalancesModalOpen] = useState(false);

  // Employee Balances Modal Internal View: 'LIST' or 'EDIT'
  const [modalView, setModalView] = useState<'LIST' | 'EDIT'>('LIST');
  const [modalSearchEmp, setModalSearchEmp] = useState('');

  // Form: Set Leave Balance for Individual Employee (All 4 Types together)
  const [editEmpId, setEditEmpId] = useState('');
  const [multiAnnual, setMultiAnnual] = useState<number>(30);
  const [multiSick, setMultiSick] = useState<number>(15);
  const [multiEmergency, setMultiEmergency] = useState<number>(7);
  const [multiHourly, setMultiHourly] = useState<number>(5);
  const [multiNotes, setMultiNotes] = useState('');
  const [isSavingMulti, setIsSavingMulti] = useState(false);

  // Form: Batch Set Leave Balances (All 4 Types together with checkboxes)
  const [batchApplyAnnual, setBatchApplyAnnual] = useState(true);
  const [batchAnnualTotal, setBatchAnnualTotal] = useState<number>(30);

  const [batchApplySick, setBatchApplySick] = useState(true);
  const [batchSickTotal, setBatchSickTotal] = useState<number>(15);

  const [batchApplyEmergency, setBatchApplyEmergency] = useState(true);
  const [batchEmergencyTotal, setBatchEmergencyTotal] = useState<number>(7);

  const [batchApplyHourly, setBatchApplyHourly] = useState(true);
  const [batchHourlyTotal, setBatchHourlyTotal] = useState<number>(5);

  const [batchNotes, setBatchNotes] = useState('');
  const [isSavingBatch, setIsSavingBatch] = useState(false);

  // Form: Create Leave Request
  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [formLeaveType, setFormLeaveType] = useState<'ANNUAL' | 'SICK' | 'EMERGENCY' | 'HOURLY' | 'UNPAID' | 'OTHER'>('ANNUAL');
  const [formStartDate, setFormStartDate] = useState(todayISO());
  const [formEndDate, setFormEndDate] = useState(todayISO());
  const [formHoursCount, setFormHoursCount] = useState<number>(2);
  const [formReason, setFormReason] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // ── Queries ──
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

  // Leaves query
  const { data: leaves = [], isLoading: isLeavesLoading } = useQuery({
    queryKey: ['hr-leaves', selectedStatus, selectedTypeFilter],
    queryFn: () =>
      hrApi.getLeaves({
        status: selectedStatus === 'ALL' ? undefined : selectedStatus,
        leaveType: selectedTypeFilter === 'ALL' ? undefined : selectedTypeFilter,
      }),
    staleTime: 30000,
  });

  // Leave Balances query (All Types for the year)
  const { data: allYearBalances = [], isLoading: isBalancesLoading } = useQuery({
    queryKey: ['hr-leave-balances-all-year', activeYear],
    queryFn: () =>
      hrApi.getLeaveBalances({
        year: activeYear,
      }),
    staleTime: 30000,
  });

  // Employee Balances Map (empId -> { employee, annual, sick, emergency, hourly, totalDaysRemaining })
  const employeeBalancesMap = useMemo(() => {
    const map = new Map<
      string,
      {
        employee: any;
        annual: { total: number; used: number; remaining: number };
        sick: { total: number; used: number; remaining: number };
        emergency: { total: number; used: number; remaining: number };
        hourly: { total: number; used: number; remaining: number };
        totalDaysRemaining: number;
      }
    >();

    for (const emp of employees) {
      map.set(emp.id, {
        employee: emp,
        annual: { total: 0, used: 0, remaining: 0 },
        sick: { total: 0, used: 0, remaining: 0 },
        emergency: { total: 0, used: 0, remaining: 0 },
        hourly: { total: 0, used: 0, remaining: 0 },
        totalDaysRemaining: 0,
      });
    }

    for (const b of allYearBalances) {
      let entry = map.get(b.employeeId);
      if (!entry) {
        entry = {
          employee: b.employee,
          annual: { total: 0, used: 0, remaining: 0 },
          sick: { total: 0, used: 0, remaining: 0 },
          emergency: { total: 0, used: 0, remaining: 0 },
          hourly: { total: 0, used: 0, remaining: 0 },
          totalDaysRemaining: 0,
        };
        map.set(b.employeeId, entry);
      }
      const type = b.leaveType?.toUpperCase();
      const tot = Number(b.totalBalance) || 0;
      const usd = Number(b.usedBalance) || 0;
      const rem = Number(b.remainingBalance) || 0;

      if (type === 'ANNUAL') entry.annual = { total: tot, used: usd, remaining: rem };
      else if (type === 'SICK') entry.sick = { total: tot, used: usd, remaining: rem };
      else if (type === 'EMERGENCY') entry.emergency = { total: tot, used: usd, remaining: rem };
      else if (type === 'HOURLY') entry.hourly = { total: tot, used: usd, remaining: rem };
    }

    for (const entry of map.values()) {
      entry.totalDaysRemaining = entry.annual.remaining + entry.sick.remaining + entry.emergency.remaining;
    }

    return map;
  }, [employees, allYearBalances]);

  // Filtered employee list inside the Employee Balances Modal
  const modalFilteredEmployees = useMemo(() => {
    const q = modalSearchEmp.trim().toLowerCase();
    const list = Array.from(employeeBalancesMap.values());
    if (!q) return list;
    return list.filter((item) => {
      const name = item.employee?.fullName?.toLowerCase() || '';
      const branch = item.employee?.branchName?.toLowerCase() || '';
      const job = item.employee?.jobTitle?.toLowerCase() || '';
      return name.includes(q) || branch.includes(q) || job.includes(q);
    });
  }, [employeeBalancesMap, modalSearchEmp]);

  // Calculate Days Preview for Request Modal
  const calculatedDays = useMemo(() => {
    if (!formStartDate || !formEndDate) return 1;
    const start = new Date(formStartDate);
    const end = new Date(formEndDate);
    const diff = Math.abs(end.getTime() - start.getTime());
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
  }, [formStartDate, formEndDate, formLeaveType]);

  // Selected Employee Balance Preview in Request Modal
  const activeEmployeeBalance = useMemo(() => {
    if (!formEmployeeId) return null;
    const targetType = formLeaveType === 'UNPAID' || formLeaveType === 'OTHER' ? 'ANNUAL' : formLeaveType;
    return allYearBalances.find((b) => b.employeeId === formEmployeeId && b.leaveType === targetType);
  }, [allYearBalances, formEmployeeId, formLeaveType]);

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: (payload: CreateLeavePayload) => hrApi.createLeave(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['hr-leave-balances-all-year'] });
      queryClient.invalidateQueries({ queryKey: ['addons-hr-stats'] });
      showSuccessNotification(
        isAr ? 'تم التقديم' : 'Submitted',
        isAr ? 'تم تقديم طلب الإجازة بنجاح' : 'Leave request submitted'
      );
      setCreateModalOpen(false);
      resetCreateForm();
    },
    onError: (err: any) => {
      showErrorNotification(isAr ? 'خطأ' : 'Error', err?.message || 'Failed to submit leave');
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: 'APPROVED' | 'REJECTED'; notes?: string }) =>
      hrApi.updateLeaveStatus(id, status, notes),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['hr-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['hr-leave-balances-all-year'] });
      queryClient.invalidateQueries({ queryKey: ['addons-hr-stats'] });
      showSuccessNotification(
        isAr ? 'تم التحديث' : 'Updated',
        vars.status === 'APPROVED'
          ? isAr
            ? 'تمت الموافقة على طلب الإجازة وتحديث رصيد الموظف'
            : 'Leave request approved and balance updated'
          : isAr
          ? 'تم رفض طلب الإجازة'
          : 'Leave request rejected'
      );
    },
    onError: (err: any) => {
      showErrorNotification(isAr ? 'خطأ' : 'Error', err?.message || 'Action failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => hrApi.deleteLeave(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['hr-leave-balances-all-year'] });
      showSuccessNotification(
        isAr ? 'تم الحذف' : 'Deleted',
        isAr ? 'تم حذف طلب الإجازة وتحديث الرصيد' : 'Request deleted and balance refreshed'
      );
    },
    onError: (err: any) => {
      showErrorNotification(isAr ? 'خطأ' : 'Error', err?.message || 'Delete failed');
    },
  });

  // ── Helper Reset Forms ──
  const resetCreateForm = () => {
    setFormEmployeeId(employees[0]?.id || '');
    setFormLeaveType('ANNUAL');
    setFormStartDate(todayISO());
    setFormEndDate(todayISO());
    setFormHoursCount(2);
    setFormReason('');
    setFormNotes('');
  };

  const openCreateModal = () => {
    resetCreateForm();
    setCreateModalOpen(true);
  };

  const openEmployeeBalancesModal = (targetEmpId?: string) => {
    if (targetEmpId) {
      loadEmployeeToEdit(targetEmpId);
      setModalView('EDIT');
    } else {
      setModalView('LIST');
    }
    setModalSearchEmp('');
    setEmployeeBalancesModalOpen(true);
  };

  const loadEmployeeToEdit = (empId: string) => {
    setEditEmpId(empId);
    const empData = employeeBalancesMap.get(empId);
    if (empData) {
      setMultiAnnual(empData.annual.total || 30);
      setMultiSick(empData.sick.total || 15);
      setMultiEmergency(empData.emergency.total || 7);
      setMultiHourly(empData.hourly.total !== undefined ? empData.hourly.total : 5);
    } else {
      setMultiAnnual(30);
      setMultiSick(15);
      setMultiEmergency(7);
      setMultiHourly(5);
    }
    setMultiNotes('');
  };

  const handleSelectEmployeeInEdit = (empId: string) => {
    loadEmployeeToEdit(empId);
  };

  const openBatchBalanceModal = () => {
    setBatchApplyAnnual(true);
    setBatchAnnualTotal(30);

    setBatchApplySick(true);
    setBatchSickTotal(15);

    setBatchApplyEmergency(true);
    setBatchEmergencyTotal(7);

    setBatchApplyHourly(true);
    setBatchHourlyTotal(5);

    setBatchNotes('');
    setBatchBalanceModalOpen(true);
  };

  const handleSaveLeaveRequest = () => {
    if (!formEmployeeId) {
      showErrorNotification(isAr ? 'تنبيه' : 'Notice', isAr ? 'يرجى اختيار الموظف' : 'Select employee');
      return;
    }
    createMutation.mutate({
      employeeId: formEmployeeId,
      leaveType: formLeaveType,
      startDate: formStartDate,
      endDate: formEndDate,
      daysCount: calculatedDays,
      hoursCount: 0,
      reason: formReason,
      notes: formNotes,
    });
  };

  // Save all 4 leave types for individual employee simultaneously
  const handleSaveIndividualBalances = async () => {
    if (!editEmpId) {
      showErrorNotification(isAr ? 'تنبيه' : 'Notice', isAr ? 'يرجى تحديد الموظف' : 'Select employee');
      return;
    }
    setIsSavingMulti(true);
    try {
      await Promise.all([
        hrApi.setLeaveBalance({
          employeeId: editEmpId,
          year: activeYear,
          leaveType: 'ANNUAL',
          totalBalance: Number(multiAnnual) || 0,
          unit: 'DAYS',
          notes: multiNotes,
        }),
        hrApi.setLeaveBalance({
          employeeId: editEmpId,
          year: activeYear,
          leaveType: 'SICK',
          totalBalance: Number(multiSick) || 0,
          unit: 'DAYS',
          notes: multiNotes,
        }),
        hrApi.setLeaveBalance({
          employeeId: editEmpId,
          year: activeYear,
          leaveType: 'EMERGENCY',
          totalBalance: Number(multiEmergency) || 0,
          unit: 'DAYS',
          notes: multiNotes,
        }),
        hrApi.setLeaveBalance({
          employeeId: editEmpId,
          year: activeYear,
          leaveType: 'HOURLY',
          totalBalance: Number(multiHourly) || 0,
          unit: 'HOURS',
          notes: multiNotes,
        }),
      ]);

      queryClient.invalidateQueries({ queryKey: ['hr-leave-balances-all-year'] });
      showSuccessNotification(
        isAr ? 'تم الحفظ' : 'Saved',
        isAr ? 'تم تعيين وتحديث كافة أرصدة الإجازات للموظف بنجاح' : 'Leave balances updated successfully'
      );
      setModalView('LIST');
    } catch (err: any) {
      showErrorNotification(isAr ? 'خطأ' : 'Error', err?.message || 'Failed to set leave balances');
    } finally {
      setIsSavingMulti(false);
    }
  };

  // Save batch uniform balances for all selected leave types at once
  const handleSaveBatchBalances = async () => {
    if (!batchApplyAnnual && !batchApplySick && !batchApplyEmergency && !batchApplyHourly) {
      showErrorNotification(isAr ? 'تنبيه' : 'Notice', isAr ? 'يرجى تحديد نوع إجازة واحد على الأقل' : 'Select at least one leave type');
      return;
    }

    setIsSavingBatch(true);
    try {
      const promises = [];
      if (batchApplyAnnual) {
        promises.push(
          hrApi.batchSetLeaveBalances({
            year: activeYear,
            leaveType: 'ANNUAL',
            totalBalance: Number(batchAnnualTotal) || 0,
            unit: 'DAYS',
            notes: batchNotes,
          })
        );
      }
      if (batchApplySick) {
        promises.push(
          hrApi.batchSetLeaveBalances({
            year: activeYear,
            leaveType: 'SICK',
            totalBalance: Number(batchSickTotal) || 0,
            unit: 'DAYS',
            notes: batchNotes,
          })
        );
      }
      if (batchApplyEmergency) {
        promises.push(
          hrApi.batchSetLeaveBalances({
            year: activeYear,
            leaveType: 'EMERGENCY',
            totalBalance: Number(batchEmergencyTotal) || 0,
            unit: 'DAYS',
            notes: batchNotes,
          })
        );
      }
      if (batchApplyHourly) {
        promises.push(
          hrApi.batchSetLeaveBalances({
            year: activeYear,
            leaveType: 'HOURLY',
            totalBalance: Number(batchHourlyTotal) || 0,
            unit: 'HOURS',
            notes: batchNotes,
          })
        );
      }

      await Promise.all(promises);
      queryClient.invalidateQueries({ queryKey: ['hr-leave-balances-all-year'] });
      showSuccessNotification(
        isAr ? 'تم التطبيق بنجاح' : 'Applied',
        isAr ? 'تم تطبيق الأرصدة المحددة على كافة موظفي الشركة دفعة واحدة' : 'Batch leave balances assigned to all employees'
      );
      setBatchBalanceModalOpen(false);
    } catch (err: any) {
      showErrorNotification(isAr ? 'خطأ' : 'Error', err?.message || 'Failed to set batch leave balances');
    } finally {
      setIsSavingBatch(false);
    }
  };

  // ── Filters & Search for Leave Applications Log ──
  const filteredLeaves = useMemo(() => {
    const q = searchRequests.trim().toLowerCase();
    return leaves.filter((l) => {
      if (!q) return true;
      const name = l.employee?.fullName?.toLowerCase() || '';
      const branch = l.employee?.branchName?.toLowerCase() || '';
      const reason = l.reason?.toLowerCase() || '';
      return name.includes(q) || branch.includes(q) || reason.includes(q);
    });
  }, [leaves, searchRequests]);

  // ── KPI Summary Stats ──
  const stats = useMemo(() => {
    const totalAllocated = allYearBalances.reduce((sum, b) => sum + Number(b.totalBalance || 0), 0);
    const totalUsed = allYearBalances.reduce((sum, b) => sum + Number(b.usedBalance || 0), 0);
    const totalRemaining = allYearBalances.reduce((sum, b) => sum + Number(b.remainingBalance || 0), 0);
    const pendingRequests = leaves.filter((l) => l.status === 'PENDING').length;
    const approvedRequests = leaves.filter((l) => l.status === 'APPROVED').length;

    return {
      totalAllocated,
      totalUsed,
      totalRemaining,
      pendingRequests,
      approvedRequests,
    };
  }, [allYearBalances, leaves]);

  const getLeaveTypeLabel = (type: string) => {
    switch (type) {
      case 'ANNUAL':
        return isAr ? 'إجازة اعتيادية' : 'Annual Leave';
      case 'SICK':
        return isAr ? 'إجازة مرضية' : 'Sick Leave';
      case 'EMERGENCY':
        return isAr ? 'إجازة طارئة' : 'Emergency';
      case 'HOURLY':
        return isAr ? 'إجازة زمنية' : 'Hourly Permission';
      case 'UNPAID':
        return isAr ? 'إجازة بدون راتب' : 'Unpaid Leave';
      default:
        return isAr ? 'إجازة أخرى' : 'Other';
    }
  };

  return (
    <div
      className="p-4 md:p-6 space-y-5 max-w-[1550px] mx-auto select-none"
      dir={direction}
      style={{ fontFamily: isAr ? "'IBM Plex Sans Arabic', system-ui, sans-serif" : "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      {/* ── Top Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-orange-50 border border-orange-200/80 text-[#F45A0A] flex items-center justify-center shadow-2xs shrink-0">
            <CalendarRange size={22} strokeWidth={2.4} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-base text-slate-900 tracking-tight">
                {isAr ? 'إدارة وأرصدة إجازات الموظفين' : 'Employee Leave & Balance Management'}
              </h1>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-50 text-[#C2410C] border border-orange-200/80">
                {isAr ? 'شؤون الموظفين' : 'HR Suite'}
              </span>
              <span className="font-mono font-black text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 tabular-nums">
                {activeYear}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-bold mt-0.5">
              {isAr
                ? 'متابعة سجل طلبات الإجازات، واعتماد الطلبات، وتعيين وتخصيص أرصدة الموظفين لكافة الأنواع.'
                : 'Review leave requests, approve applications, and assign employee leave balances.'}
            </p>
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-2">
          {/* Button: Open Batch Uniform Balances Modal */}
          <button
            type="button"
            onClick={openBatchBalanceModal}
            className="flex items-center gap-1.5 bg-white hover:bg-orange-50/60 text-slate-700 hover:text-[#C2410C] border border-slate-300 hover:border-orange-300 px-3.5 py-2 rounded-xl text-xs font-black shadow-2xs transition-all cursor-pointer"
          >
            <Sliders size={15} strokeWidth={2.4} className="text-[#F45A0A]" />
            <span>{isAr ? 'تعيين رصيد موحد للجميع' : 'Batch Set Balances'}</span>
          </button>

          {/* Button: Open Employee Leave Balances Modal */}
          <button
            type="button"
            onClick={() => openEmployeeBalancesModal()}
            className="flex items-center gap-1.5 bg-white hover:bg-orange-50 text-slate-800 hover:text-[#C2410C] border border-orange-200 px-3.5 py-2 rounded-xl text-xs font-black shadow-2xs transition-all cursor-pointer"
          >
            <Users size={15} strokeWidth={2.4} className="text-[#F45A0A]" />
            <span>{isAr ? 'أرصدة إجازات الموظفين' : 'Employee Leave Balances'}</span>
          </button>

          {/* Button: Create New Leave Application */}
          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-1.5 bg-[#F45A0A] hover:bg-[#DC4B02] text-white px-4 py-2 rounded-xl text-xs font-black shadow-md shadow-orange-500/20 transition-all cursor-pointer active:scale-95"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>{isAr ? 'تقديم طلب إجازة' : 'New Leave Request'}</span>
          </button>
        </div>
      </div>

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">
              {isAr ? 'إجمالي الأرصدة المخصصة' : 'Total Allocated Balance'}
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
              {isAr ? 'كافة الأنواع' : 'All Types'}
            </span>
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="font-mono font-black text-2xl text-slate-900 tabular-nums lining-nums">
              {stats.totalAllocated}
            </span>
            <span className="text-xs font-bold text-slate-400">{isAr ? 'يوم' : 'days'}</span>
          </div>
          <span className="text-[10px] text-slate-400 font-bold mt-1">
            {isAr ? 'رصيد كافة الموظفين المسجلين' : 'Allocated across all staff'}
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700">
              {isAr ? 'الرصيد المستهلك (المعتمد)' : 'Consumed / Used'}
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
              {stats.totalAllocated > 0 ? `${Math.round((stats.totalUsed / stats.totalAllocated) * 100)}%` : '0%'}
            </span>
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="font-mono font-black text-2xl text-amber-600 tabular-nums lining-nums">
              {stats.totalUsed}
            </span>
            <span className="text-xs font-bold text-slate-400">{isAr ? 'يوم' : 'days'}</span>
          </div>
          <span className="text-[10px] text-amber-700 font-bold mt-1">
            {isAr ? `${stats.approvedRequests} إجازة معتمدة مسجلة` : `${stats.approvedRequests} approved leaves`}
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700">
              {isAr ? 'الرصيد المتبقي المتاح' : 'Remaining Available'}
            </span>
            <CheckCircle2 size={15} className="text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="font-mono font-black text-2xl text-emerald-600 tabular-nums lining-nums">
              {stats.totalRemaining}
            </span>
            <span className="text-xs font-bold text-slate-400">{isAr ? 'يوم' : 'days'}</span>
          </div>
          <span className="text-[10px] text-emerald-600 font-bold mt-1">
            {isAr ? 'جاهز للاستخدام المعتمد' : 'Available for scheduling'}
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#F45A0A]">
              {isAr ? 'طلبات بانتظار الاعتماد' : 'Pending Requests'}
            </span>
            <Clock size={15} className="text-[#F45A0A]" />
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="font-mono font-black text-2xl text-[#F45A0A] tabular-nums lining-nums">
              {stats.pendingRequests}
            </span>
            <span className="text-xs font-bold text-slate-400">{isAr ? 'طلب' : 'Requests'}</span>
          </div>
          <span className="text-[10px] text-slate-400 font-bold mt-1">
            {isAr ? 'تحتاج موافقة المشرف' : 'Awaiting review'}
          </span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MAIN SECTION: SUBMITTED LEAVE REQUESTS LOG (THE ONLY TABLE ON PAGE)    */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/40">
          <div className="flex items-center gap-2">
            <CalendarRange size={18} className="text-[#F45A0A]" />
            <h2 className="font-black text-sm text-slate-900">
              {isAr ? 'سجل طلبات الإجازات المسجلة' : 'Submitted Leave Applications'}
            </h2>
            <span className="text-[11px] font-mono font-bold text-slate-400">
              ({filteredLeaves.length} {isAr ? 'طلب' : 'records'})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Requests */}
            <div className="relative min-w-[200px]">
              <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchRequests}
                onChange={(e) => setSearchRequests(e.target.value)}
                placeholder={isAr ? 'بحث بالاسم، الفرع، السبب...' : 'Search employee or reason...'}
                className="w-full bg-white border border-slate-200 rounded-lg ps-8 pe-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-500 transition-all"
              />
            </div>

            {/* Leave Type Filter */}
            <div className="min-w-[130px]">
              <Select
                value={selectedTypeFilter}
                onChange={(val) => setSelectedTypeFilter(val || 'ALL')}
                data={[
                  { value: 'ALL', label: isAr ? 'كافة الأنواع' : 'All Types' },
                  { value: 'ANNUAL', label: isAr ? 'اعتيادية' : 'Annual' },
                  { value: 'SICK', label: isAr ? 'مرضية' : 'Sick' },
                  { value: 'EMERGENCY', label: isAr ? 'طارئة' : 'Emergency' },
                  { value: 'HOURLY', label: isAr ? 'زمنية' : 'Hourly' },
                  { value: 'UNPAID', label: isAr ? 'بدون راتب' : 'Unpaid' },
                ]}
                size="xs"
                radius="md"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              {[
                { key: 'ALL', label: isAr ? 'الكل' : 'All' },
                { key: 'PENDING', label: isAr ? 'قيد المراجعة' : 'Pending' },
                { key: 'APPROVED', label: isAr ? 'مقبولة' : 'Approved' },
                { key: 'REJECTED', label: isAr ? 'مرفوضة' : 'Rejected' },
              ].map((st) => (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => setSelectedStatus(st.key)}
                  className={`px-2.5 py-1 rounded-md text-xs font-black transition-all cursor-pointer ${
                    selectedStatus === st.key
                      ? 'bg-white text-[#F45A0A] shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-start border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/90 text-[11px] font-black text-slate-600 select-none">
                <th className="px-4 py-3 text-start">#</th>
                <th className="px-4 py-3 text-start">{isAr ? 'الموظف' : 'Employee'}</th>
                <th className="px-4 py-3 text-start">{isAr ? 'نوع الإجازة' : 'Type'}</th>
                <th className="px-4 py-3 text-center">{isAr ? 'من تاريخ' : 'From'}</th>
                <th className="px-4 py-3 text-center">{isAr ? 'إلى تاريخ' : 'To'}</th>
                <th className="px-4 py-3 text-center">{isAr ? 'المدة' : 'Duration'}</th>
                <th className="px-4 py-3 text-start">{isAr ? 'السبب' : 'Reason'}</th>
                <th className="px-4 py-3 text-center">{isAr ? 'الحالة' : 'Status'}</th>
                <th className="px-4 py-3 text-center">{isAr ? 'الاعتماد والإجراءات' : 'Approval & Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLeavesLoading ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-400 font-bold">
                    {isAr ? 'جاري تحميل الطلبات...' : 'Loading requests...'}
                  </td>
                </tr>
              ) : filteredLeaves.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-400 font-bold">
                    {isAr ? 'لا توجد طلبات إجازات مسجلة في هذا التصنيف' : 'No leave applications found'}
                  </td>
                </tr>
              ) : (
                filteredLeaves.map((item, idx) => {
                  const isPending = item.status === 'PENDING';
                  const isHourly = item.leaveType === 'HOURLY';

                  return (
                    <tr key={item.id} className="hover:bg-orange-50/20 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-400">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{item.employee?.fullName || '—'}</div>
                        <div className="text-[10px] text-slate-400 font-bold">{item.employee?.jobTitle || 'موظف'}</div>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-800">
                        {getLeaveTypeLabel(item.leaveType)}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-slate-700">
                        {item.startDate ? String(item.startDate).slice(0, 10) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-slate-700">
                        {item.endDate ? String(item.endDate).slice(0, 10) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-[#F45A0A]">
                        {`${item.daysCount || 1} ${isAr ? 'أيام' : 'd'}`}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate" title={item.reason}>
                        {item.reason || '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                            item.status === 'APPROVED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : item.status === 'REJECTED'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {item.status === 'APPROVED'
                            ? isAr
                              ? 'معتمدة'
                              : 'Approved'
                            : item.status === 'REJECTED'
                            ? isAr
                              ? 'مرفوضة'
                              : 'Rejected'
                            : isAr
                            ? 'قيد المراجعة'
                            : 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {isPending && (
                            <>
                              <button
                                type="button"
                                onClick={() => statusMutation.mutate({ id: item.id, status: 'APPROVED' })}
                                disabled={statusMutation.isPending}
                                className="p-1 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer"
                                title={isAr ? 'موافقة على الإجازة' : 'Approve'}
                              >
                                <Check size={14} strokeWidth={2.6} />
                              </button>
                              <button
                                type="button"
                                onClick={() => statusMutation.mutate({ id: item.id, status: 'REJECTED' })}
                                disabled={statusMutation.isPending}
                                className="p-1 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all cursor-pointer"
                                title={isAr ? 'رفض الإجازة' : 'Reject'}
                              >
                                <XCircle size={14} strokeWidth={2.4} />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(isAr ? 'هل أنت متأكد من حذف هذا السجل؟' : 'Delete this record?')) {
                                deleteMutation.mutate(item.id);
                              }
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                            title={isAr ? 'حذف' : 'Delete'}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 1: BATCH SET LEAVE BALANCES (ALL TYPES CONFIGURED TOGETHER)      */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        opened={batchBalanceModalOpen}
        onClose={() => setBatchBalanceModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <Sliders size={18} className="text-[#F45A0A]" />
            <span className="font-black text-sm text-slate-900">
              {isAr ? 'تعيين رصيد إجازات موحد لجميع الموظفين' : 'Batch Set Balances for All Employees'}
            </span>
          </div>
        }
        dir={direction}
        centered
        size="min(900px, 95vw)"
        radius="lg"
        styles={{
          content: {
            width: 'min(900px, 95vw)',
            maxHeight: '88vh',
            display: 'flex',
            flexDirection: 'column',
          },
          body: {
            overflowY: 'auto',
            padding: '20px',
          },
        }}
      >
        <div className="space-y-4 pt-2">
          <div className="bg-orange-50/70 border border-orange-200 rounded-xl p-3 text-xs text-[#9A3412] font-bold">
            {isAr
              ? `سيتم تطبيق هذه الأرصدة دفعة واحدة على جميع موظفي الشركة المسجلين (${employees.length} موظف). يمكنك تحديد الأرصدة المطلوبة وتفعيل ما ترغب بتطبيقه.`
              : `These balances will be applied simultaneously to all ${employees.length} employees. Select which types to assign.`}
          </div>

          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
            <span className="text-xs font-black text-slate-800">
              {isAr ? 'تحديد وتخصيص أرصدة الأنواع معاً:' : 'Configure All Leave Types Together:'}
            </span>
            <span className="text-xs font-mono font-bold text-slate-500">
              {isAr ? 'السنة المالية:' : 'Year:'} {activeYear}
            </span>
          </div>

          {/* 4 Types Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 1. Annual Leave */}
            <div className={`p-3 rounded-xl border transition-all ${batchApplyAnnual ? 'bg-orange-50/40 border-orange-300' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={batchApplyAnnual}
                    onChange={(e) => setBatchApplyAnnual(e.target.checked)}
                    className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 accent-[#F45A0A]"
                  />
                  <span className="text-xs font-black text-slate-900 flex items-center gap-1">
                    <Calendar size={13} className="text-[#F45A0A]" />
                    {isAr ? 'الإجازة الاعتيادية' : 'Annual Leave'}
                  </span>
                </label>
                <span className="text-[10px] font-bold text-slate-500">{isAr ? 'أيام' : 'Days'}</span>
              </div>
              <input
                type="number"
                min="0"
                disabled={!batchApplyAnnual}
                value={batchAnnualTotal}
                onChange={(e) => setBatchAnnualTotal(parseFloat(e.target.value) || 0)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono font-black text-slate-900 focus:outline-none focus:border-orange-500 disabled:bg-slate-100"
              />
              <div className="flex items-center gap-1 mt-1.5">
                {[15, 21, 30].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={!batchApplyAnnual}
                    onClick={() => setBatchAnnualTotal(preset)}
                    className="px-2 py-0.5 rounded bg-white hover:bg-orange-100 text-[10px] font-mono font-bold text-slate-700 hover:text-[#C2410C] border border-slate-200 cursor-pointer disabled:opacity-50"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Sick Leave */}
            <div className={`p-3 rounded-xl border transition-all ${batchApplySick ? 'bg-orange-50/40 border-orange-300' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={batchApplySick}
                    onChange={(e) => setBatchApplySick(e.target.checked)}
                    className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 accent-[#F45A0A]"
                  />
                  <span className="text-xs font-black text-slate-900 flex items-center gap-1">
                    <AlertCircle size={13} className="text-rose-500" />
                    {isAr ? 'الإجازة المرضية' : 'Sick Leave'}
                  </span>
                </label>
                <span className="text-[10px] font-bold text-slate-500">{isAr ? 'أيام' : 'Days'}</span>
              </div>
              <input
                type="number"
                min="0"
                disabled={!batchApplySick}
                value={batchSickTotal}
                onChange={(e) => setBatchSickTotal(parseFloat(e.target.value) || 0)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono font-black text-slate-900 focus:outline-none focus:border-orange-500 disabled:bg-slate-100"
              />
              <div className="flex items-center gap-1 mt-1.5">
                {[7, 10, 15].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={!batchApplySick}
                    onClick={() => setBatchSickTotal(preset)}
                    className="px-2 py-0.5 rounded bg-white hover:bg-orange-100 text-[10px] font-mono font-bold text-slate-700 hover:text-[#C2410C] border border-slate-200 cursor-pointer disabled:opacity-50"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Emergency Leave */}
            <div className={`p-3 rounded-xl border transition-all ${batchApplyEmergency ? 'bg-orange-50/40 border-orange-300' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={batchApplyEmergency}
                    onChange={(e) => setBatchApplyEmergency(e.target.checked)}
                    className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 accent-[#F45A0A]"
                  />
                  <span className="text-xs font-black text-slate-900 flex items-center gap-1">
                    <Clock size={13} className="text-amber-500" />
                    {isAr ? 'الإجازة الطارئة' : 'Emergency Leave'}
                  </span>
                </label>
                <span className="text-[10px] font-bold text-slate-500">{isAr ? 'أيام' : 'Days'}</span>
              </div>
              <input
                type="number"
                min="0"
                disabled={!batchApplyEmergency}
                value={batchEmergencyTotal}
                onChange={(e) => setBatchEmergencyTotal(parseFloat(e.target.value) || 0)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono font-black text-slate-900 focus:outline-none focus:border-orange-500 disabled:bg-slate-100"
              />
              <div className="flex items-center gap-1 mt-1.5">
                {[3, 5, 7].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={!batchApplyEmergency}
                    onClick={() => setBatchEmergencyTotal(preset)}
                    className="px-2 py-0.5 rounded bg-white hover:bg-orange-100 text-[10px] font-mono font-bold text-slate-700 hover:text-[#C2410C] border border-slate-200 cursor-pointer disabled:opacity-50"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Hourly Leave */}
            <div className={`p-3 rounded-xl border transition-all ${batchApplyHourly ? 'bg-orange-50/40 border-orange-300' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={batchApplyHourly}
                    onChange={(e) => setBatchApplyHourly(e.target.checked)}
                    className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 accent-[#F45A0A]"
                  />
                  <span className="text-xs font-black text-slate-900 flex items-center gap-1">
                    <Clock size={13} className="text-blue-500" />
                    {isAr ? 'الإجازة الزمنية' : 'Hourly Permission'}
                  </span>
                </label>
                <span className="text-[10px] font-bold text-slate-500">{isAr ? 'أيام' : 'Days'}</span>
              </div>
              <input
                type="number"
                min="0"
                disabled={!batchApplyHourly}
                value={batchHourlyTotal}
                onChange={(e) => setBatchHourlyTotal(parseFloat(e.target.value) || 0)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono font-black text-slate-900 focus:outline-none focus:border-orange-500 disabled:bg-slate-100"
              />
              <div className="flex items-center gap-1 mt-1.5">
                {[2, 3, 5].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={!batchApplyHourly}
                    onClick={() => setBatchHourlyTotal(preset)}
                    className="px-2 py-0.5 rounded bg-white hover:bg-orange-100 text-[10px] font-mono font-bold text-slate-700 hover:text-[#C2410C] border border-slate-200 cursor-pointer disabled:opacity-50"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">{isAr ? 'ملاحظات التعيين الموحد' : 'Notes'}</label>
            <textarea
              rows={2}
              value={batchNotes}
              onChange={(e) => setBatchNotes(e.target.value)}
              placeholder={isAr ? 'أي ملاحظات تخص تطبيق هذا التعيين...' : 'Notes...'}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setBatchBalanceModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-black text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleSaveBatchBalances}
              disabled={isSavingBatch}
              className="bg-[#F45A0A] hover:bg-[#DC4B02] text-white px-5 py-2 rounded-xl text-xs font-black shadow-md shadow-orange-500/20 transition-all cursor-pointer active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSavingBatch ? (
                isAr ? 'جاري التطبيق...' : 'Applying...'
              ) : (
                <>
                  <Check size={15} />
                  <span>{isAr ? 'تطبيق على جميع الموظفين' : 'Apply to All'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 2: EMPLOYEE LEAVE BALANCES (STANDALONE MODAL TO MANAGE & ASSIGN)  */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        opened={employeeBalancesModalOpen}
        onClose={() => setEmployeeBalancesModalOpen(false)}
        title={
          <div className="flex items-center justify-between w-full pe-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-[#F45A0A] flex items-center justify-center">
                <Users size={18} strokeWidth={2.5} />
              </div>
              <div>
                <span className="font-black text-sm text-slate-900 block">
                  {modalView === 'LIST'
                    ? isAr
                      ? 'أرصدة إجازات الموظفين (كافة الأنواع)'
                      : 'Employee Leave Balances'
                    : isAr
                    ? 'تعيين وتخصيص أرصدة إجازات الموظف'
                    : 'Assign Leave Balances to Employee'}
                </span>
                <span className="text-[11px] font-bold text-slate-400">
                  {isAr ? 'إدارة واستعراض وتعيين الأرصدة للموظفين' : 'Manage, view & assign leave entitlements'}
                </span>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-mono font-bold text-xs border border-slate-200">
                {isAr ? 'السنة:' : 'Year:'} {activeYear}
              </span>
            </div>
          </div>
        }
        dir={direction}
        centered
        size="min(1320px, 96vw)"
        radius="xl"
        styles={{
          content: {
            width: 'min(1320px, 96vw)',
            height: '84vh',
            maxHeight: '84vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          },
          header: {
            borderBottom: '1px solid #f1f5f9',
            paddingBottom: '14px',
            paddingTop: '16px',
            paddingInline: '20px',
          },
          body: {
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'hidden',
            padding: '20px',
          },
        }}
      >
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {modalView === 'LIST' ? (
            /* ── VIEW 1: EMPLOYEES BALANCES MATRIX INSIDE MODAL ── */
            <div className="flex-1 min-h-0 flex flex-col space-y-3 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/90 p-3 rounded-xl border border-slate-200 shrink-0">
                <div className="relative min-w-[240px] flex-1">
                  <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={modalSearchEmp}
                    onChange={(e) => setModalSearchEmp(e.target.value)}
                    placeholder={isAr ? 'بحث بالاسم، الفرع، أو المسمى...' : 'Search employee...'}
                    className="w-full bg-white border border-slate-200 rounded-lg ps-8 pe-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      loadEmployeeToEdit(employees[0]?.id || '');
                      setModalView('EDIT');
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-black text-[#C2410C] bg-orange-50 hover:bg-orange-100 border border-orange-200 transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Plus size={13} />
                    <span>{isAr ? 'تعيين رصيد موظف' : 'Assign Balance'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEmployeeBalancesModalOpen(false);
                      openBatchBalanceModal();
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-black text-slate-700 hover:text-[#C2410C] bg-white hover:bg-orange-50 border border-slate-200 transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Sliders size={13} className="text-[#F45A0A]" />
                    <span>{isAr ? 'تعيين موحد للجميع' : 'Batch Assign'}</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-2xs">
                <table className="w-full text-start border-collapse text-xs">
                  <thead className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 text-[11px] font-black text-slate-700 shadow-2xs select-none">
                    <tr>
                      <th className="px-3 py-2.5 text-start">#</th>
                      <th className="px-3 py-2.5 text-start">{isAr ? 'الموظف' : 'Employee'}</th>
                      <th className="px-3 py-2.5 text-start">{isAr ? 'الفرع' : 'Branch'}</th>
                      <th className="px-3 py-2.5 text-center">{isAr ? 'اعتيادية' : 'Annual'}</th>
                      <th className="px-3 py-2.5 text-center">{isAr ? 'مرضية' : 'Sick'}</th>
                      <th className="px-3 py-2.5 text-center">{isAr ? 'طارئة' : 'Emergency'}</th>
                      <th className="px-3 py-2.5 text-center">{isAr ? 'زمنية (أيام)' : 'Hourly (days)'}</th>
                      <th className="px-3 py-2.5 text-center">{isAr ? 'المتبقي' : 'Total'}</th>
                      <th className="px-3 py-2.5 text-center">{isAr ? 'إجراء' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isBalancesLoading ? (
                      <tr>
                        <td colSpan={9} className="text-center py-6 text-slate-400 font-bold">
                          {isAr ? 'جاري تحميل الأرصدة...' : 'Loading balances...'}
                        </td>
                      </tr>
                    ) : modalFilteredEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-6 text-slate-400 font-bold">
                          {isAr ? 'لا توجد بيانات مطابقة' : 'No records found'}
                        </td>
                      </tr>
                    ) : (
                      modalFilteredEmployees.map((item, idx) => (
                        <tr key={item.employee?.id || idx} className="hover:bg-orange-50/20 transition-colors">
                          <td className="px-3 py-2 font-mono font-bold text-slate-400">{idx + 1}</td>
                          <td className="px-3 py-2">
                            <div className="font-bold text-slate-900">{item.employee?.fullName || '—'}</div>
                            <div className="text-[10px] text-slate-400 font-bold">{item.employee?.jobTitle || 'موظف'}</div>
                          </td>
                          <td className="px-3 py-2 text-slate-600 font-medium">
                            {item.employee?.branchName || 'الفرع الرئيسي'}
                          </td>

                          {/* الاعتيادية */}
                          <td className="px-3 py-2 text-center">
                            <span className="font-mono font-black text-emerald-600">{item.annual.remaining}</span>
                            <span className="text-slate-300"> / </span>
                            <span className="font-mono font-bold text-slate-600">{item.annual.total}</span>
                          </td>

                          {/* المرضية */}
                          <td className="px-3 py-2 text-center">
                            <span className="font-mono font-black text-emerald-600">{item.sick.remaining}</span>
                            <span className="text-slate-300"> / </span>
                            <span className="font-mono font-bold text-slate-600">{item.sick.total}</span>
                          </td>

                          {/* الطارئة */}
                          <td className="px-3 py-2 text-center">
                            <span className="font-mono font-black text-emerald-600">{item.emergency.remaining}</span>
                            <span className="text-slate-300"> / </span>
                            <span className="font-mono font-bold text-slate-600">{item.emergency.total}</span>
                          </td>

                          {/* الزمنية */}
                          <td className="px-3 py-2 text-center">
                            <span className="font-mono font-black text-emerald-600">{item.hourly.remaining}</span>
                            <span className="text-slate-300"> / </span>
                            <span className="font-mono font-bold text-slate-600">{item.hourly.total}</span>
                          </td>

                          {/* إجمالي المتبقي بالأيام */}
                          <td className="px-3 py-2 text-center">
                            <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-mono font-black text-xs tabular-nums">
                              {item.totalDaysRemaining} {isAr ? 'ي' : 'd'}
                            </span>
                          </td>

                          {/* إجراء تعيين الأرصدة */}
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                loadEmployeeToEdit(item.employee?.id);
                                setModalView('EDIT');
                              }}
                              className="px-2.5 py-1 text-[11px] font-black text-[#C2410C] hover:text-white bg-orange-50 hover:bg-[#F45A0A] border border-orange-200 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 mx-auto"
                            >
                              <Edit2 size={11} />
                              <span>{isAr ? 'تعديل الأرصدة' : 'Edit'}</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footer Summary Bar */}
              <div className="flex items-center justify-between px-2 pt-1 text-xs text-slate-500 font-bold shrink-0">
                <span>
                  {isAr ? 'إجمالي الموظفين المعروضين:' : 'Showing employees:'}{' '}
                  <span className="font-mono text-slate-900 font-black">{modalFilteredEmployees.length}</span>{' '}
                  {isAr ? 'من أصل' : 'of'}{' '}
                  <span className="font-mono text-slate-600">{employees.length}</span>
                </span>
                <span className="text-[11px] text-slate-400">
                  {isAr ? 'يمكنك التمرير داخل الجدول عمودياً وأفقياً' : 'Scroll table vertically & horizontally'}
                </span>
              </div>
            </div>
          ) : (
            /* ── VIEW 2: EDIT EMPLOYEE BALANCES (ALL 4 TYPES TOGETHER) ── */
            <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalView('LIST')}
                  className="flex items-center gap-1.5 text-xs font-black text-slate-600 hover:text-[#F45A0A] transition-colors cursor-pointer"
                >
                  <ArrowRight size={14} />
                  <span>{isAr ? 'العودة لقائمة أرصدة الموظفين' : 'Back to List'}</span>
                </button>
                <span className="text-xs font-mono font-bold text-slate-500">
                  {isAr ? 'السنة المالية:' : 'Year:'} {activeYear}
                </span>
              </div>

              <div>
                <SearchableCombobox
                  label={isAr ? 'الموظف المستهدف' : 'Target Employee'}
                  options={employeeOptions}
                  value={editEmpId}
                  onChange={handleSelectEmployeeInEdit}
                  required={true}
                />
              </div>

              {/* 4 Types Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Annual Leave */}
                <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <Calendar size={13} className="text-[#F45A0A]" />
                      {isAr ? 'الإجازة الاعتيادية' : 'Annual Leave'}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">{isAr ? 'أيام' : 'Days'}</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={multiAnnual}
                    onChange={(e) => setMultiAnnual(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-mono font-black text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                  <div className="flex items-center gap-1">
                    {[15, 21, 30].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setMultiAnnual(p)}
                        className="px-2 py-0.5 rounded bg-white hover:bg-orange-50 text-[10px] font-mono font-bold text-slate-600 hover:text-[#C2410C] border border-slate-200 cursor-pointer"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Sick Leave */}
                <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <AlertCircle size={13} className="text-rose-500" />
                      {isAr ? 'الإجازة المرضية' : 'Sick Leave'}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">{isAr ? 'أيام' : 'Days'}</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={multiSick}
                    onChange={(e) => setMultiSick(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-mono font-black text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                  <div className="flex items-center gap-1">
                    {[7, 10, 15].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setMultiSick(p)}
                        className="px-2 py-0.5 rounded bg-white hover:bg-orange-50 text-[10px] font-mono font-bold text-slate-600 hover:text-[#C2410C] border border-slate-200 cursor-pointer"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Emergency Leave */}
                <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <Clock size={13} className="text-amber-500" />
                      {isAr ? 'الإجازة الطارئة' : 'Emergency Leave'}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">{isAr ? 'أيام' : 'Days'}</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={multiEmergency}
                    onChange={(e) => setMultiEmergency(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-mono font-black text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                  <div className="flex items-center gap-1">
                    {[3, 5, 7].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setMultiEmergency(p)}
                        className="px-2 py-0.5 rounded bg-white hover:bg-orange-50 text-[10px] font-mono font-bold text-slate-600 hover:text-[#C2410C] border border-slate-200 cursor-pointer"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Hourly Leave */}
                <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <Clock size={13} className="text-blue-500" />
                      {isAr ? 'الإجازة الزمنية' : 'Hourly Permission'}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">{isAr ? 'أيام' : 'Days'}</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={multiHourly}
                    onChange={(e) => setMultiHourly(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-mono font-black text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                  <div className="flex items-center gap-1">
                    {[2, 3, 5].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setMultiHourly(p)}
                        className="px-2 py-0.5 rounded bg-white hover:bg-orange-50 text-[10px] font-mono font-bold text-slate-600 hover:text-[#C2410C] border border-slate-200 cursor-pointer"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{isAr ? 'ملاحظات' : 'Notes'}</label>
                <input
                  type="text"
                  value={multiNotes}
                  onChange={(e) => setMultiNotes(e.target.value)}
                  placeholder={isAr ? 'ملاحظات تخص تخصيص أرصدة الموظف...' : 'Notes...'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalView('LIST')}
                  className="px-4 py-2 rounded-xl text-xs font-black text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  {isAr ? 'العودة للقائمة' : 'Back'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveIndividualBalances}
                  disabled={isSavingMulti}
                  className="bg-[#F45A0A] hover:bg-[#DC4B02] text-white px-5 py-2 rounded-xl text-xs font-black shadow-md shadow-orange-500/20 transition-all cursor-pointer active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSavingMulti ? (
                    isAr ? 'جاري الحفظ...' : 'Saving...'
                  ) : (
                    <>
                      <Check size={14} />
                      <span>{isAr ? 'حفظ وتحديث أرصدة الموظف' : 'Save Balances'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════ */}
      {/* MODAL 3: SUBMIT LEAVE REQUEST                  */}
      {/* ══════════════════════════════════════════════ */}
      <Modal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <CalendarRange size={18} className="text-[#F45A0A]" />
            <span className="font-black text-sm text-slate-900">
              {isAr ? 'تقديم طلب إجازة جديد للموظف' : 'New Leave Application'}
            </span>
          </div>
        }
        dir={direction}
        centered
        size="lg"
        radius="lg"
      >
        <div className="space-y-4 pt-2">
          <div>
            <SearchableCombobox
              label={isAr ? 'الموظف صاحب الطلب' : 'Employee'}
              options={employeeOptions}
              value={formEmployeeId}
              onChange={(val) => setFormEmployeeId(val)}
              required={true}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Select
                label={isAr ? 'نوع الإجازة' : 'Leave Type'}
                value={formLeaveType}
                onChange={(val) => setFormLeaveType((val as any) || 'ANNUAL')}
                data={[
                  { value: 'ANNUAL', label: isAr ? 'إجازة اعتيادية (سنوية)' : 'Annual Leave' },
                  { value: 'SICK', label: isAr ? 'إجازة مرضية' : 'Sick Leave' },
                  { value: 'EMERGENCY', label: isAr ? 'إجازة طارئة' : 'Emergency Leave' },
                  { value: 'HOURLY', label: isAr ? 'إجازة زمنية' : 'Hourly Permission (Days)' },
                  { value: 'UNPAID', label: isAr ? 'إجازة بدون راتب' : 'Unpaid Leave' },
                  { value: 'OTHER', label: isAr ? 'إجازة أخرى' : 'Other' },
                ]}
                size="xs"
                radius="md"
              />
            </div>

            {/* Current Balance Indicator */}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">
                {isAr ? 'رصيد الموظف الحالي لهذا النوع' : 'Current Available Balance'}
              </label>
              <div className="bg-orange-50/60 border border-orange-200/80 rounded-lg p-2 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">
                  {activeEmployeeBalance ? (
                    <span className="text-emerald-700 font-bold">
                      {isAr ? 'متاح: ' : 'Available: '}
                      <span className="font-mono font-black">{activeEmployeeBalance.remainingBalance}</span>{' '}
                      {isAr ? 'أيام' : 'days'}
                    </span>
                  ) : (
                    <span className="text-slate-400 font-bold">{isAr ? 'الرصيد غير مقيد' : 'No balance record'}</span>
                  )}
                </span>
                {activeEmployeeBalance && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    {isAr ? 'المستهلك: ' : 'Used: '}
                    {activeEmployeeBalance.usedBalance}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div>
              <SegmentedDatePicker
                label={isAr ? 'تاريخ البدء' : 'Start Date'}
                value={formStartDate}
                onChange={(_, iso) => setFormStartDate(iso || todayISO())}
                clearable={false}
              />
            </div>
            <div>
              <SegmentedDatePicker
                label={isAr ? 'تاريخ الانتهاء' : 'End Date'}
                value={formEndDate}
                onChange={(_, iso) => setFormEndDate(iso || todayISO())}
                clearable={false}
              />
            </div>
          </div>

          {/* Duration Summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
            <span className="text-xs font-black text-slate-700">
              {isAr ? 'المدة المحتسبة للإجازة:' : 'Calculated Duration:'}
            </span>
            <span className="font-mono font-black text-sm text-[#F45A0A] tabular-nums lining-nums">
              {`${calculatedDays} ${isAr ? 'أيام' : 'Days'}`}
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">{isAr ? 'سبب الإجازة' : 'Reason'}</label>
            <input
              type="text"
              value={formReason}
              onChange={(e) => setFormReason(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">{isAr ? 'ملاحظات إضافية' : 'Notes'}</label>
            <textarea
              rows={2}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-black text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleSaveLeaveRequest}
              disabled={createMutation.isPending}
              className="bg-[#F45A0A] hover:bg-[#DC4B02] text-white px-5 py-2 rounded-xl text-xs font-black shadow-md shadow-orange-500/20 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {createMutation.isPending
                ? isAr
                  ? 'جاري الإرسال...'
                  : 'Submitting...'
                : isAr
                ? 'إرسال طلب الإجازة'
                : 'Submit Request'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default LeavesPage;
