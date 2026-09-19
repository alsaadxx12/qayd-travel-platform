import React, { useState, useEffect, useMemo } from 'react';
import {
  Banknote,
  Search,
  Filter,
  CheckCircle2,
  TrendingUp,
  Wallet,
  Building2,
  ShieldCheck,
  User,
  Users,
  Coins,
  PlaneTakeoff,
  RotateCcw,
  Luggage,
  Sparkles,
  Sliders,
  Utensils,
  Car,
  Award,
  AlertCircle,
  Save,
  RotateCw,
  LayoutGrid,
  List as ListIcon,
  HelpCircle,
  ChevronDown,
  Check,
  X,
  Plus
} from 'lucide-react';
import {
  Modal,
  Select,
  TextInput,
  NumberInput,
  Switch,
  Badge,
  Loader,
  Tooltip,
  SegmentedControl
} from '@mantine/core';
import { employeesApi, Employee } from '../../api/employees';
import { hrApi, PointLogItem, PointSummaryItem } from '../../api/hr';
import { branchesApi, Branch } from '../../api/branches';
import { departmentsApi, Department } from '../../api/departments';
import { apiRequest } from '../../api/client';
import { fetchPrintTemplate, savePrintTemplate } from '../../api/printTemplates';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { useLanguageStore } from '../../store/useLanguageStore';

export interface SalaryStructureConfig {
  nominalSalary: number; // الراتب الاسمي
  currency: 'IQD' | 'USD';
  transportAllowance: number; // بدل نقل
  foodAllowance: number; // بدل طعام
  housingAllowance: number; // بدل سكن / منصب
  otherAllowances: number; // مخصصات أخرى

  // حافز شهر
  monthlyIncentive: number;
  incentiveEnabled: boolean; // زر تشغيل / إطفاء الحافز

  // استقطاعات الضمان التقاعدي
  pensionDeduction: number;
  pointPrice?: number;
  earnedPoints?: number;
  deductedPoints?: number;
  otherDeductions: number;

  // أزرار تشغيل وإطفاء أرباح العمليات
  issuanceProfitsEnabled: boolean; // أرباح إصدارات
  issuanceProfitType: 'FIXED' | 'PERCENT';
  issuanceProfitRate: number;

  changesProfitsEnabled: boolean; // أرباح تغيرات
  changesProfitType: 'FIXED' | 'PERCENT';
  changesProfitRate: number;

  baggageProfitsEnabled: boolean; // أرباح شراء وزن
  baggageProfitType: 'FIXED' | 'PERCENT';
  baggageProfitRate: number;

  notes?: string;
  updatedAt?: string;
}

export interface UnifiedPerson {
  id: string;
  sourceId: string;
  fullName: string;
  jobTitle: string;
  branchName: string;
  departmentName: string;
  phone?: string;
  email?: string;
  personType: 'EMPLOYEE' | 'USER' | 'BOTH';
  assignedCashbox?: string;
  hasUserAccount: boolean;
  status: string;
  structure: SalaryStructureConfig;
}

const DEFAULT_STRUCTURE: SalaryStructureConfig = {
  nominalSalary: 1000000,
  currency: 'IQD',
  transportAllowance: 100000,
  foodAllowance: 100000,
  housingAllowance: 0,
  otherAllowances: 0,
  monthlyIncentive: 100000,
  incentiveEnabled: true,
  pensionDeduction: 50000,
  pointPrice: 1000,
  earnedPoints: 0,
  deductedPoints: 0,
  otherDeductions: 0,
  issuanceProfitsEnabled: true,
  issuanceProfitType: 'FIXED',
  issuanceProfitRate: 2,
  changesProfitsEnabled: true,
  changesProfitType: 'FIXED',
  changesProfitRate: 1.5,
  baggageProfitsEnabled: true,
  baggageProfitType: 'FIXED',
  baggageProfitRate: 1,
};

const fmt = (n: number | string | undefined | null) =>
  Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

export const SalaryAllowancesPage: React.FC = () => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'EMPLOYEE' | 'USER' | 'BOTH'>('ALL');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'CARDS' | 'TABLE'>('CARDS');

  const [people, setPeople] = useState<UnifiedPerson[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [savedConfigs, setSavedConfigs] = useState<Record<string, SalaryStructureConfig>>({});

  // Editing Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<UnifiedPerson | null>(null);
  const [formConfig, setFormConfig] = useState<SalaryStructureConfig>(DEFAULT_STRUCTURE);

  // 1. Load Data (Employees, Users, Branches, and Existing Allowances Configs)
  const loadData = async () => {
    setLoading(true);
    try {
      const [empRes, usersRes, branchesRes, depsRes, templateRes, pointLogsRes, pointSummaryRes] = await Promise.all([
        employeesApi.getAll().catch(() => []),
        apiRequest<any[]>('/auth/users').catch(() => []),
        branchesApi.getAll().catch(() => []),
        departmentsApi.getAll().catch(() => []),
        fetchPrintTemplate('employee_salary_allowances', { fresh: true }).catch(() => ({ config: {} } as any)),
        hrApi.getPointsLogs().catch(() => [] as PointLogItem[]),
        hrApi.getPointsSummary().catch(() => [] as PointSummaryItem[]),
      ]);

      const pointsMap = new Map<string, { earned: number; deducted: number }>();
      (pointLogsRes || []).forEach((log: any) => {
        if (!log.employeeId) return;
        const cur = pointsMap.get(log.employeeId) || { earned: 0, deducted: 0 };
        const pts = Number(log.points || 0);
        if (pts > 0) cur.earned += pts;
        else cur.deducted += Math.abs(pts);
        pointsMap.set(log.employeeId, cur);
      });
      (pointSummaryRes || []).forEach((s: any) => {
        if (!pointsMap.has(s.id)) {
          const tot = Number(s.totalPoints || 0);
          pointsMap.set(s.id, { earned: tot > 0 ? tot : 0, deducted: tot < 0 ? Math.abs(tot) : 0 });
        }
      });

      setBranches(Array.isArray(branchesRes) ? branchesRes : []);
      setDepartments(Array.isArray(depsRes) ? depsRes : []);

      const configsMap: Record<string, SalaryStructureConfig> = (templateRes as any)?.config?.structures || {};
      setSavedConfigs(configsMap);

      const empList: Employee[] = Array.isArray(empRes) ? empRes : [];
      const userList: any[] = Array.isArray(usersRes) ? usersRes : [];

      const combined: UnifiedPerson[] = [];
      const handledUserEmails = new Set<string>();
      const handledUserNames = new Set<string>();

      // 1. Add all employees
      for (const emp of empList) {
        const matchingUser = userList.find(
          (u) =>
            (emp.email && u.email && emp.email.toLowerCase() === u.email.toLowerCase()) ||
            (emp.fullName && u.name && emp.fullName.trim() === u.name.trim())
        );

        if (matchingUser) {
          if (matchingUser.email) handledUserEmails.add(matchingUser.email.toLowerCase());
          if (matchingUser.name) handledUserNames.add(matchingUser.name.trim());
        }

        const personId = 'emp_' + emp.id;
        const empPts = pointsMap.get(emp.id) || { earned: 0, deducted: 0 };

        // 1. Read real salaryStructure from employee record in PostgreSQL, fallback to savedConfigs
        const rawStruct = (emp.salaryStructure && typeof emp.salaryStructure === 'object' && Object.keys(emp.salaryStructure).length > 0)
          ? emp.salaryStructure
          : (configsMap[personId] || configsMap[emp.id] || null);

        const nominal = rawStruct?.nominalSalary !== undefined && rawStruct?.nominalSalary !== null && Number(rawStruct.nominalSalary) > 0
          ? Number(rawStruct.nominalSalary)
          : (emp.baseSalary !== undefined && emp.baseSalary !== null && Number(emp.baseSalary) > 0
              ? Number(emp.baseSalary)
              : DEFAULT_STRUCTURE.nominalSalary);

        const existingConf: SalaryStructureConfig = {
          ...DEFAULT_STRUCTURE,
          ...(rawStruct || {}),
          nominalSalary: nominal,
          earnedPoints: empPts.earned,
          deductedPoints: empPts.deducted,
          pointPrice: rawStruct?.pointPrice ?? 1000,
        };

        combined.push({
          id: personId,
          sourceId: emp.id,
          fullName: emp.fullName,
          jobTitle: emp.jobTitle || (isAr ? 'موظف' : 'Staff Member'),
          branchName: emp.branchName || (isAr ? 'الفرع الرئيسي' : 'Main Branch'),
          departmentName: emp.departmentName || (isAr ? 'القسم العام' : 'General Dept'),
          phone: emp.phone,
          email: emp.email,
          personType: matchingUser || emp.hasUserAccount ? 'BOTH' : 'EMPLOYEE',
          assignedCashbox: emp.assignedCashbox,
          hasUserAccount: !!matchingUser || !!emp.hasUserAccount,
          status: emp.status || (isAr ? 'نشط' : 'Active'),
          structure: existingConf,
        });
      }

      // 2. Add standalone users
      for (const usr of userList) {
        const emailKey = usr.email ? usr.email.toLowerCase() : '';
        const nameKey = usr.name ? usr.name.trim() : '';
        if (handledUserEmails.has(emailKey) || handledUserNames.has(nameKey)) {
          continue;
        }

        const personId = 'usr_' + usr.id;
        const rawStruct = (usr.salaryStructure && typeof usr.salaryStructure === 'object' && Object.keys(usr.salaryStructure).length > 0)
          ? usr.salaryStructure
          : (configsMap[personId] || configsMap[usr.id] || null);

        const nominal = rawStruct?.nominalSalary !== undefined && rawStruct?.nominalSalary !== null && Number(rawStruct.nominalSalary) > 0
          ? Number(rawStruct.nominalSalary)
          : (usr.baseSalary !== undefined && usr.baseSalary !== null && Number(usr.baseSalary) > 0
              ? Number(usr.baseSalary)
              : DEFAULT_STRUCTURE.nominalSalary);

        const existingConf: SalaryStructureConfig = {
          ...DEFAULT_STRUCTURE,
          ...(rawStruct || {}),
          nominalSalary: nominal,
          pointPrice: rawStruct?.pointPrice ?? 1000,
        };

        combined.push({
          id: personId,
          sourceId: usr.id,
          fullName: usr.name || usr.fullName || (isAr ? 'مستخدم نظام' : 'System User'),
          jobTitle: usr.role?.name || (isAr ? 'مستخدم نظام معتمد' : 'System User'),
          branchName: usr.role?.allowedBranches || (isAr ? 'كافة الفروع' : 'All Branches'),
          departmentName: isAr ? 'إدارة النظام والتشغيل' : 'System Operations',
          email: usr.email,
          phone: usr.phone,
          personType: 'USER',
          hasUserAccount: true,
          status: usr.isActive !== false ? (isAr ? 'نشط' : 'Active') : (isAr ? 'معلق' : 'Suspended'),
          structure: existingConf,
        });
      }

      setPeople(combined);
    } catch (err: any) {
      showErrorNotification(
        isAr ? 'خطأ في التحميل' : 'Loading Error',
        err?.message || (isAr ? 'تعذر جلب بيانات الموظفين والمخصصات' : 'Failed to load employees & allowances')
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleQuickToggle = async (personId: string, field: keyof SalaryStructureConfig) => {
    let updatedTarget: UnifiedPerson | undefined;
    setPeople((prev) =>
      prev.map((p) => {
        if (p.id === personId) {
          const currentVal = !!p.structure[field];
          const updatedStructure = { ...p.structure, [field]: !currentVal };
          updatedTarget = { ...p, structure: updatedStructure };
          return updatedTarget;
        }
        return p;
      })
    );

    // Auto-save toggle directly to PostgreSQL database
    if (updatedTarget) {
      const target = updatedTarget as UnifiedPerson;
      try {
        await employeesApi.updateSalaryStructure(
          target.id,
          target.structure,
          target.structure.nominalSalary
        );
      } catch (err) {
        console.error('Failed to auto-save toggle:', err);
      }
    }
  };

  const handleOpenEdit = (person: UnifiedPerson) => {
    setSelectedPerson(person);
    setFormConfig({ ...person.structure });
    setModalOpen(true);
  };

  const handleSaveModal = async () => {
    if (!selectedPerson) return;
    const target = selectedPerson;
    const updatedStructure = { ...formConfig };

    setPeople((prev) =>
      prev.map((p) => (p.id === target.id ? { ...p, structure: updatedStructure } : p))
    );
    setModalOpen(false);

    try {
      // Direct PostgreSQL persistence via NestJS API
      await employeesApi.updateSalaryStructure(
        target.id,
        updatedStructure,
        updatedStructure.nominalSalary
      );

      showSuccessNotification(
        isAr ? 'تم الحفظ والاعتماد بنجاح' : 'Allowances Saved',
        isAr
          ? `تم تثبيت وحفظ الراتب الاسمي (${fmt(updatedStructure.nominalSalary)} ${updatedStructure.currency}) والمخصصات للموظف (${target.fullName}) في قاعدة البيانات بنجاح.`
          : `Saved nominal salary and allowances for ${target.fullName} directly to the database.`
      );
    } catch (err: any) {
      showErrorNotification(
        isAr ? 'خطأ في الحفظ' : 'Save Error',
        err?.message || (isAr ? 'فشل حفظ المخصصات في قاعدة البيانات' : 'Could not save allowances to database')
      );
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const structuresMap: Record<string, SalaryStructureConfig> = {};
      for (const p of people) {
        structuresMap[p.id] = p.structure;
        structuresMap[p.sourceId] = p.structure;
      }

      // 1. Batch persist directly to real PostgreSQL via NestJS
      await employeesApi.batchUpdateSalaryStructures(structuresMap);

      // 2. Also backup to printTemplates
      await savePrintTemplate(
        'employee_salary_allowances',
        {
          structures: structuresMap,
          updatedAt: new Date().toISOString(),
          totalPersonnelCount: people.length,
        },
        'هيكل الرواتب والمخصصات المالية للموظفين'
      ).catch(() => {});

      showSuccessNotification(
        isAr ? 'تم الحفظ والاعتماد بنجاح' : 'Successfully Saved',
        isAr
          ? 'تم حفظ وتثبيت الراتب الاسمي والمخصصات المالية وأزرار الأرباح لكافة الموظفين والمستخدمين في قاعدة البيانات بنجاح.'
          : 'Saved nominal salaries, allowances, and profit toggles for all personnel in the database.'
      );
    } catch (err: any) {
      showErrorNotification(
        isAr ? 'فشل الحفظ' : 'Save Error',
        err?.message || (isAr ? 'تعذر حفظ المخصصات في قاعدة البيانات' : 'Could not save to database')
      );
    } finally {
      setSaving(false);
    }
  };

  const kpis = useMemo(() => {
    let totalNominal = 0;
    let totalAllowances = 0;
    let totalActiveBonuses = 0;
    let totalPension = 0;
    let totalWithProfits = 0;

    for (const p of people) {
      const s = p.structure;
      totalNominal += Number(s.nominalSalary || 0);
      totalAllowances +=
        Number(s.transportAllowance || 0) +
        Number(s.foodAllowance || 0) +
        Number(s.housingAllowance || 0) +
        Number(s.otherAllowances || 0);
      if (s.incentiveEnabled) {
        totalActiveBonuses += Number(s.monthlyIncentive || 0);
      }
      totalPension += Number(s.pensionDeduction || 0);
      if (s.issuanceProfitsEnabled || s.changesProfitsEnabled || s.baggageProfitsEnabled) {
        totalWithProfits += 1;
      }
    }

    return {
      totalNominal,
      totalAllowances,
      totalActiveBonuses,
      totalPension,
      totalWithProfits,
      totalPeople: people.length,
    };
  }, [people]);

  const filteredPeople = useMemo(() => {
    const q = search.trim().toLowerCase();
    return people.filter((p) => {
      const matchSearch =
        !q ||
        p.fullName.toLowerCase().includes(q) ||
        p.jobTitle.toLowerCase().includes(q) ||
        (p.email && p.email.toLowerCase().includes(q)) ||
        (p.phone && p.phone.includes(q)) ||
        (p.branchName && p.branchName.toLowerCase().includes(q));

      const matchType =
        typeFilter === 'ALL' ||
        (typeFilter === 'EMPLOYEE' && p.personType === 'EMPLOYEE') ||
        (typeFilter === 'USER' && p.personType === 'USER') ||
        (typeFilter === 'BOTH' && p.personType === 'BOTH');

      const matchBranch = branchFilter === 'ALL' || p.branchName === branchFilter;
      const matchDept = departmentFilter === 'ALL' || p.departmentName === departmentFilter;

      return matchSearch && matchType && matchBranch && matchDept;
    });
  }, [people, search, typeFilter, branchFilter, departmentFilter]);

  const branchOptions = useMemo(() => {
    const list = branches.map((b) => b.nameAr).filter(Boolean);
    return [{ value: 'ALL', label: isAr ? 'كافة الفروع' : 'All Branches' }, ...list.map((name) => ({ value: name, label: name }))];
  }, [branches, isAr]);

  const departmentOptions = useMemo(() => {
    const list = departments.map((d) => d.name).filter(Boolean);
    return [{ value: 'ALL', label: isAr ? 'كافة الأقسام' : 'All Departments' }, ...list.map((name) => ({ value: name, label: name }))];
  }, [departments, isAr]);

  const modalNetPreview = useMemo(() => {
    const nominal = Number(formConfig.nominalSalary || 0);
    const positiveAllowances =
      Number(formConfig.transportAllowance || 0) +
      Number(formConfig.foodAllowance || 0) +
      Number(formConfig.housingAllowance || 0) +
      Number(formConfig.otherAllowances || 0);
    const incentive = formConfig.incentiveEnabled ? Number(formConfig.monthlyIncentive || 0) : 0;
    const deductions = Number(formConfig.pensionDeduction || 0) + Number(formConfig.otherDeductions || 0);

    return nominal + positiveAllowances + incentive - deductions;
  }, [formConfig]);

  return (
    <div className="p-4 md:p-6 max-w-[1720px] mx-auto space-y-5 font-sans select-none" dir={direction}>
      {/* ─── 1. TOP HEADER ─── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F45A0A] to-[#D03B00] text-white flex items-center justify-center shadow-md shadow-orange-500/20 shrink-0">
            <Coins size={26} stroke={2.3} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl md:text-2xl font-black text-slate-950 tracking-tight leading-tight">
                {isAr ? 'الراتب الاسمي والمخصصات المالية' : 'Nominal Salaries & Financial Allowances'}
              </h1>
              <span className="px-3 py-0.5 rounded-full text-xs font-black bg-orange-50 text-[#F45A0A] border border-orange-200 font-mono">
                {people.length} {isAr ? 'كادر ومستخدم' : 'Personnel'}
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-500 font-medium mt-0.5">
              {isAr
                ? 'تعيين الرواتب الاسمية، بدلات النقل والطعام، حوافز الإنتاج، استقطاعات الضمان التقاعدي، وتفعيل أرباح الإصدارات والتغيرات وشراء الوزن.'
                : 'Configure nominal base pay, meal & transport allowances, production incentives, pension deductions, and operational commission toggles.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs md:text-sm flex items-center gap-2 transition-all cursor-pointer shadow-2xs"
          >
            <RotateCw size={16} className={loading ? 'animate-spin text-[#F45A0A]' : ''} />
            <span>{isAr ? 'تحديث' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving || loading}
            className="h-10 px-5 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-black text-xs md:text-sm flex items-center gap-2 shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-98 disabled:opacity-50"
          >
            {saving ? <Loader size="xs" color="white" /> : <Save size={18} />}
            <span>{isAr ? 'حفظ كافة التغييرات' : 'Save All Changes'}</span>
          </button>
        </div>
      </div>

      {/* ─── 2. EXECUTIVE KPI CARDS ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs md:text-sm font-black text-slate-700">{isAr ? 'إجمالي الرواتب الاسمية' : 'Total Base Pay'}</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/80 flex items-center justify-center">
              <Banknote size={19} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-2xl font-black text-slate-950 font-mono tracking-tight">
              {fmt(kpis.totalNominal)} <span className="text-xs text-slate-500 font-bold">د.ع</span>
            </div>
            <span className="text-xs font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
              {kpis.totalPeople} {isAr ? 'موظف' : 'Staff'}
            </span>
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs md:text-sm font-black text-slate-700">{isAr ? 'إجمالي البدلات والمخصصات' : 'Total Allowances'}</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/80 flex items-center justify-center">
              <Car size={19} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-2xl font-black text-emerald-900 font-mono tracking-tight">
              +{fmt(kpis.totalAllowances)} <span className="text-xs text-slate-500 font-bold">د.ع</span>
            </div>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
              نقل + طعام
            </span>
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs md:text-sm font-black text-slate-700">{isAr ? 'الحوافز الشهرية النشطة' : 'Active Bonuses'}</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/80 flex items-center justify-center">
              <Award size={19} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-2xl font-black text-amber-900 font-mono tracking-tight">
              +{fmt(kpis.totalActiveBonuses)} <span className="text-xs text-slate-500 font-bold">د.ع</span>
            </div>
            <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
              حوافز تشغيلية
            </span>
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs md:text-sm font-black text-slate-700">{isAr ? 'الضمان والعمولات النشطة' : 'Pension & Profit Toggles'}</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 border border-purple-200/80 flex items-center justify-center">
              <ShieldCheck size={19} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-2xl font-black text-purple-950 font-mono tracking-tight">
              {kpis.totalWithProfits} <span className="text-xs text-slate-500 font-bold">مشمول بالأرباح</span>
            </div>
            <span className="text-xs font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
              ضمان: -{fmt(kpis.totalPension)}
            </span>
          </div>
        </div>
      </div>

      {/* ─── 3. TOOLBAR & FILTER BAR ─── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl flex-wrap">
          {[
            { id: 'ALL', label: isAr ? 'الكل' : 'All', count: people.length, icon: Users },
            { id: 'EMPLOYEE', label: isAr ? 'الموظفون' : 'Employees', count: people.filter((p) => p.personType === 'EMPLOYEE' || p.personType === 'BOTH').length, icon: User },
            { id: 'USER', label: isAr ? 'مستخدمو النظام' : 'System Users', count: people.filter((p) => p.personType === 'USER').length, icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = typeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTypeFilter(tab.id as any)}
                className={'h-8 px-3.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ' + (
                  active ? 'bg-[#F45A0A] text-white shadow-xs' : 'text-slate-700 hover:text-slate-950 hover:bg-white/70'
                )}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
                <span className={'px-1.5 py-0.2 rounded-full text-[10px] font-mono ' + (active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800')}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2.5 flex-wrap flex-1 sm:flex-none justify-end">
          <div className="relative w-64 min-w-[200px]">
            <Search size={15} className="absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isAr ? 'بحث بالاسم، الفرع، الوظيفة...' : 'Search staff...'}
              className="w-full h-[36px] ps-9 pe-8 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white focus:bg-white text-xs font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#F45A0A] focus:ring-2 focus:ring-[#F45A0A]/10 transition-all font-sans"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute top-1/2 -translate-y-1/2 end-2.5 text-slate-400 hover:text-slate-700 font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <div className="w-40">
            <Select
              size="xs"
              radius="md"
              data={branchOptions}
              value={branchFilter}
              onChange={(val) => setBranchFilter(val || 'ALL')}
            />
          </div>

          <div className="w-40">
            <Select
              size="xs"
              radius="md"
              data={departmentOptions}
              value={departmentFilter}
              onChange={(val) => setDepartmentFilter(val || 'ALL')}
            />
          </div>

          <div className="flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('CARDS')}
              title={isAr ? 'عرض البطاقات' : 'Cards'}
              className={'h-[32px] w-[34px] rounded-lg flex items-center justify-center transition-all cursor-pointer ' + (
                viewMode === 'CARDS' ? 'bg-white text-[#F45A0A] shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
              )}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('TABLE')}
              title={isAr ? 'عرض الجدول' : 'Table'}
              className={'h-[32px] w-[34px] rounded-lg flex items-center justify-center transition-all cursor-pointer ' + (
                viewMode === 'TABLE' ? 'bg-white text-[#F45A0A] shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
              )}
            >
              <ListIcon size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ─── 4. STAFF DIRECTORY VIEW ─── */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-20 text-center space-y-3">
          <Loader size="md" color="orange" className="mx-auto" />
          <p className="font-bold text-slate-700 text-sm">{isAr ? 'جاري تحميل سجلات الموظفين والمخصصات...' : 'Loading personnel...'}</p>
        </div>
      ) : filteredPeople.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center space-y-3 shadow-2xs">
          <AlertCircle size={40} className="mx-auto text-slate-300" />
          <p className="font-bold text-slate-700 text-sm">{isAr ? 'لم يتم العثور على أي موظف أو مستخدم مطابق' : 'No personnel found'}</p>
        </div>
      ) : viewMode === 'CARDS' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredPeople.map((person) => {
            const s = person.structure;
            const net =
              Number(s.nominalSalary || 0) +
              Number(s.transportAllowance || 0) +
              Number(s.foodAllowance || 0) +
              Number(s.housingAllowance || 0) +
              Number(s.otherAllowances || 0) +
              (s.incentiveEnabled ? Number(s.monthlyIncentive || 0) : 0) -
              (Number(s.pensionDeduction || 0) + Number(s.otherDeductions || 0));

            return (
              <div
                key={person.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-md hover:border-orange-300 transition-all flex flex-col justify-between space-y-4 group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 font-black text-sm flex items-center justify-center border border-slate-200 group-hover:bg-orange-50 group-hover:text-[#F45A0A] group-hover:border-orange-200 transition-colors">
                        {person.fullName.substring(0, 2)}
                      </div>
                      <div>
                        <h3 className="font-black text-slate-900 text-sm group-hover:text-[#F45A0A] transition-colors leading-tight">
                          {person.fullName}
                        </h3>
                        <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1.5">
                          <span>{person.jobTitle}</span>
                          <span className="text-slate-300">•</span>
                          <span>{person.branchName}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {person.personType === 'BOTH' && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          موظف + مستخدم
                        </span>
                      )}
                      {person.personType === 'USER' && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                          مستخدم نظام
                        </span>
                      )}
                      {person.personType === 'EMPLOYEE' && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          موظف
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 block">الراتب الاسمي (الأساسي)</span>
                      <span className="text-base font-black text-slate-900 font-mono">
                        {fmt(s.nominalSalary)} <span className="text-xs font-bold text-slate-500">د.ع</span>
                      </span>
                    </div>
                    <div className="text-end">
                      <span className="text-[11px] font-bold text-emerald-700 block">صافي الاستحقاق التقديري</span>
                      <span className="text-base font-black text-emerald-700 font-mono">
                        {fmt(net)} <span className="text-xs font-bold text-emerald-600">د.ع</span>
                      </span>
                    </div>
                  </div>

                  <div className="mt-3.5 grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl border border-slate-100 bg-white flex items-center justify-between">
                      <span className="text-slate-600 font-bold text-[11px] flex items-center gap-1">
                        <Car size={13} className="text-blue-500" />
                        بدل نقل
                      </span>
                      <span className="font-mono font-black text-slate-900">+{fmt(s.transportAllowance)}</span>
                    </div>
                    <div className="p-2.5 rounded-xl border border-slate-100 bg-white flex items-center justify-between">
                      <span className="text-slate-600 font-bold text-[11px] flex items-center gap-1">
                        <Utensils size={13} className="text-amber-500" />
                        بدل طعام
                      </span>
                      <span className="font-mono font-black text-slate-900">+{fmt(s.foodAllowance)}</span>
                    </div>
                    <div className="p-2.5 rounded-xl border border-slate-100 bg-white flex items-center justify-between">
                      <span className="text-slate-600 font-bold text-[11px] flex items-center gap-1">
                        <Award size={13} className="text-emerald-500" />
                        حافز الإنتاج
                      </span>
                      <span className={'font-mono font-black ' + (s.incentiveEnabled ? 'text-emerald-700' : 'text-slate-400 line-through')}>
                        +{fmt(s.monthlyIncentive)}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl border border-slate-100 bg-white flex items-center justify-between">
                      <span className="text-slate-600 font-bold text-[11px] flex items-center gap-1">
                        <ShieldCheck size={13} className="text-rose-500" />
                        استقطاع الضمان
                      </span>
                      <span className="font-mono font-black text-rose-600">-{fmt(s.pensionDeduction)}</span>
                    </div>
                  </div>

                  {/* 4 Direct Operational Profit Switches */}
                  <div className="mt-4 pt-3.5 border-t border-slate-100">
                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block mb-2.5">
                      مفاتيح أرباح العمليات والحوافز
                    </span>

                    <div className="grid grid-cols-2 gap-2">
                      <div className={'p-2 rounded-xl border flex items-center justify-between transition-colors ' + (
                        s.incentiveEnabled ? 'bg-amber-50/60 border-amber-200' : 'bg-slate-50 border-slate-200'
                      )}>
                        <div className="flex items-center gap-1.5">
                          <Award size={13} className={s.incentiveEnabled ? 'text-amber-600' : 'text-slate-400'} />
                          <span className="text-[11px] font-bold text-slate-800">الحافز</span>
                        </div>
                        <Switch
                          size="xs"
                          color="orange"
                          checked={s.incentiveEnabled}
                          onChange={() => handleQuickToggle(person.id, 'incentiveEnabled')}
                        />
                      </div>

                      <div className={'p-2 rounded-xl border flex items-center justify-between transition-colors ' + (
                        s.issuanceProfitsEnabled ? 'bg-blue-50/60 border-blue-200' : 'bg-slate-50 border-slate-200'
                      )}>
                        <div className="flex items-center gap-1.5">
                          <PlaneTakeoff size={13} className={s.issuanceProfitsEnabled ? 'text-blue-600' : 'text-slate-400'} />
                          <span className="text-[11px] font-bold text-slate-800">أرباح إصدارات</span>
                        </div>
                        <Switch
                          size="xs"
                          color="blue"
                          checked={s.issuanceProfitsEnabled}
                          onChange={() => handleQuickToggle(person.id, 'issuanceProfitsEnabled')}
                        />
                      </div>

                      <div className={'p-2 rounded-xl border flex items-center justify-between transition-colors ' + (
                        s.changesProfitsEnabled ? 'bg-indigo-50/60 border-indigo-200' : 'bg-slate-50 border-slate-200'
                      )}>
                        <div className="flex items-center gap-1.5">
                          <RotateCcw size={13} className={s.changesProfitsEnabled ? 'text-indigo-600' : 'text-slate-400'} />
                          <span className="text-[11px] font-bold text-slate-800">أرباح تغيرات</span>
                        </div>
                        <Switch
                          size="xs"
                          color="indigo"
                          checked={s.changesProfitsEnabled}
                          onChange={() => handleQuickToggle(person.id, 'changesProfitsEnabled')}
                        />
                      </div>

                      <div className={'p-2 rounded-xl border flex items-center justify-between transition-colors ' + (
                        s.baggageProfitsEnabled ? 'bg-emerald-50/60 border-emerald-200' : 'bg-slate-50 border-slate-200'
                      )}>
                        <div className="flex items-center gap-1.5">
                          <Luggage size={13} className={s.baggageProfitsEnabled ? 'text-emerald-600' : 'text-slate-400'} />
                          <span className="text-[11px] font-bold text-slate-800">أرباح وزن</span>
                        </div>
                        <Switch
                          size="xs"
                          color="teal"
                          checked={s.baggageProfitsEnabled}
                          onChange={() => handleQuickToggle(person.id, 'baggageProfitsEnabled')}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenEdit(person)}
                  className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50 hover:bg-orange-50 hover:text-[#F45A0A] hover:border-orange-200 font-black text-xs text-slate-700 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Sliders size={14} />
                  <span>تعديل وتعيين المخصصات المالية</span>
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── TABLE VIEW ── */
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-black">
                  <th className="py-3 px-4 text-start">الموظف / المستخدم</th>
                  <th className="py-3 px-3 text-start">الفرع والقسم</th>
                  <th className="py-3 px-3 text-end">الراتب الاسمي</th>
                  <th className="py-3 px-3 text-end">بدل نقل</th>
                  <th className="py-3 px-3 text-end">بدل طعام</th>
                  <th className="py-3 px-3 text-center">حافز شهر</th>
                  <th className="py-3 px-3 text-end">استقطاع الضمان</th>
                  <th className="py-3 px-3 text-center">أرباح إصدارات</th>
                  <th className="py-3 px-3 text-center">أرباح تغيرات</th>
                  <th className="py-3 px-3 text-center">أرباح وزن</th>
                  <th className="py-3 px-3 text-end">صافي الاستحقاق</th>
                  <th className="py-3 px-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPeople.map((person) => {
                  const s = person.structure;
                  const net =
                    Number(s.nominalSalary || 0) +
                    Number(s.transportAllowance || 0) +
                    Number(s.foodAllowance || 0) +
                    Number(s.housingAllowance || 0) +
                    Number(s.otherAllowances || 0) +
                    (s.incentiveEnabled ? Number(s.monthlyIncentive || 0) : 0) -
                    (Number(s.pensionDeduction || 0) + Number(s.otherDeductions || 0));

                  return (
                    <tr key={person.id} className="hover:bg-orange-50/20 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-800 font-bold text-xs flex items-center justify-center">
                            {person.fullName.substring(0, 1)}
                          </div>
                          <div>
                            <span className="font-black text-slate-900 block">{person.fullName}</span>
                            <span className="text-[11px] text-slate-500 block">{person.jobTitle}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-slate-600 font-medium">
                        <span className="block font-bold text-slate-800">{person.branchName}</span>
                        <span className="text-[11px] text-slate-400">{person.departmentName}</span>
                      </td>

                      <td className="py-3 px-3 text-end font-mono font-black text-slate-900">
                        {fmt(s.nominalSalary)}
                      </td>

                      <td className="py-3 px-3 text-end font-mono font-bold text-blue-700">
                        +{fmt(s.transportAllowance)}
                      </td>

                      <td className="py-3 px-3 text-end font-mono font-bold text-amber-700">
                        +{fmt(s.foodAllowance)}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Switch
                            size="xs"
                            color="orange"
                            checked={s.incentiveEnabled}
                            onChange={() => handleQuickToggle(person.id, 'incentiveEnabled')}
                          />
                          <span className={'font-mono text-[11px] font-bold ' + (s.incentiveEnabled ? 'text-emerald-700' : 'text-slate-400 line-through')}>
                            {fmt(s.monthlyIncentive)}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-end font-mono font-bold text-rose-600">
                        -{fmt(s.pensionDeduction)}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <Switch
                          size="xs"
                          color="blue"
                          checked={s.issuanceProfitsEnabled}
                          onChange={() => handleQuickToggle(person.id, 'issuanceProfitsEnabled')}
                        />
                      </td>

                      <td className="py-3 px-3 text-center">
                        <Switch
                          size="xs"
                          color="indigo"
                          checked={s.changesProfitsEnabled}
                          onChange={() => handleQuickToggle(person.id, 'changesProfitsEnabled')}
                        />
                      </td>

                      <td className="py-3 px-3 text-center">
                        <Switch
                          size="xs"
                          color="teal"
                          checked={s.baggageProfitsEnabled}
                          onChange={() => handleQuickToggle(person.id, 'baggageProfitsEnabled')}
                        />
                      </td>

                      <td className="py-3 px-3 text-end font-mono font-black text-emerald-800 bg-emerald-50/50">
                        {fmt(net)}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(person)}
                          className="h-7 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-[#F45A0A] hover:text-white hover:border-[#F45A0A] font-bold text-[11px] text-slate-700 transition-all cursor-pointer"
                        >
                          تعديل
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── 5. EDIT MODAL ─── */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        size="lg"
        radius="lg"
        padding="lg"
        title={
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-50 text-[#F45A0A] border border-orange-200 shrink-0">
              <Sliders size={20} />
            </div>
            <div>
              <span className="block font-black text-slate-900 text-sm">
                تعيين الراتب والمخصصات المالية: {selectedPerson?.fullName}
              </span>
              <span className="text-[11px] font-normal text-slate-500 block">
                {selectedPerson?.jobTitle} • {selectedPerson?.branchName}
              </span>
            </div>
          </div>
        }
      >
        <div className="space-y-4 text-xs pt-1">
          {/* SECTION A: NOMINAL SALARY */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <span className="font-black text-slate-800 flex items-center gap-1.5 text-xs">
              <Banknote size={15} className="text-blue-600" />
              الراتب الاسمي (الأساسي)
            </span>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <NumberInput
                  label="مبلغ الراتب الاسمي"
                  placeholder="1,000,000"
                  thousandSeparator=","
                  value={formConfig.nominalSalary}
                  onChange={(val) => setFormConfig({ ...formConfig, nominalSalary: Number(val || 0) })}
                />
              </div>
              <div>
                <Select
                  label="العملة"
                  data={[
                    { value: 'IQD', label: 'دينار عراقي (IQD)' },
                    { value: 'USD', label: 'دولار أمريكي (USD)' },
                  ]}
                  value={formConfig.currency}
                  onChange={(val) => setFormConfig({ ...formConfig, currency: (val as any) || 'IQD' })}
                />
              </div>
            </div>
          </div>

          {/* SECTION B: POSITIVE ALLOWANCES */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <span className="font-black text-slate-800 flex items-center gap-1.5 text-xs">
              <Car size={15} className="text-emerald-600" />
              المخصصات والبدلات المالية الإيجابية
            </span>
            <div className="grid grid-cols-2 gap-3">
              <NumberInput
                label="بدل نقل ومواصلات"
                placeholder="100,000"
                thousandSeparator=","
                value={formConfig.transportAllowance}
                onChange={(val) => setFormConfig({ ...formConfig, transportAllowance: Number(val || 0) })}
              />
              <NumberInput
                label="بدل طعام وضيافة"
                placeholder="100,000"
                thousandSeparator=","
                value={formConfig.foodAllowance}
                onChange={(val) => setFormConfig({ ...formConfig, foodAllowance: Number(val || 0) })}
              />
              <NumberInput
                label="مخصصات منصب / مسؤولية / سكن"
                placeholder="0"
                thousandSeparator=","
                value={formConfig.housingAllowance}
                onChange={(val) => setFormConfig({ ...formConfig, housingAllowance: Number(val || 0) })}
              />
              <NumberInput
                label="مخصصات وبدلات إضافية أخرى"
                placeholder="0"
                thousandSeparator=","
                value={formConfig.otherAllowances}
                onChange={(val) => setFormConfig({ ...formConfig, otherAllowances: Number(val || 0) })}
              />
            </div>
          </div>

          {/* SECTION C: INCENTIVE & PENSION DEDUCTIONS */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <span className="font-black text-slate-800 flex items-center gap-1.5 text-xs">
              <Award size={15} className="text-amber-600" />
              حافز الإنتاج واستقطاعات الضمان التقاعدي
            </span>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-2.5 rounded-xl border border-slate-200 bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-[11px]">تشغيل حافز شهر</span>
                  <Switch
                    size="sm"
                    color="orange"
                    checked={formConfig.incentiveEnabled}
                    onChange={(e) => setFormConfig({ ...formConfig, incentiveEnabled: e.currentTarget.checked })}
                  />
                </div>
                <NumberInput
                  disabled={!formConfig.incentiveEnabled}
                  label="مبلغ الحافز الشهري"
                  placeholder="100,000"
                  thousandSeparator=","
                  value={formConfig.monthlyIncentive}
                  onChange={(val) => setFormConfig({ ...formConfig, monthlyIncentive: Number(val || 0) })}
                />
              </div>

              <div className="p-2.5 rounded-xl border border-slate-200 bg-white space-y-2">
                <span className="font-bold text-slate-800 text-[11px] block">استقطاع الضمان التقاعدي</span>
                <NumberInput
                  label="مبلغ استقطاع الضمان"
                  placeholder="50,000"
                  thousandSeparator=","
                  value={formConfig.pensionDeduction}
                  onChange={(val) => setFormConfig({ ...formConfig, pensionDeduction: Number(val || 0) })}
                />
              </div>
            </div>
          </div>

          {/* SECTION D: OPERATIONAL COMMISSIONS TOGGLES */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <span className="font-black text-slate-800 flex items-center gap-1.5 text-xs">
              <TrendingUp size={15} className="text-indigo-600" />
              أزرار تشغيل وإطفاء أرباح العمليات (إصدارات - تغيرات - شراء وزن)
            </span>

            <div className="space-y-2.5">
              {/* Toggle 1: أرباح إصدارات */}
              <div className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <PlaneTakeoff size={16} />
                  </div>
                  <div>
                    <span className="font-black text-slate-900 block text-xs">أرباح إصدارات التذاكر</span>
                    <span className="text-[10px] text-slate-500">عمولة أو نسبة الموظف عن كل تذكرة طيران يصدرها</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {formConfig.issuanceProfitsEnabled && (
                    <div className="w-28">
                      <NumberInput
                        size="xs"
                        placeholder="المبلغ/النسبة"
                        value={formConfig.issuanceProfitRate}
                        onChange={(val) => setFormConfig({ ...formConfig, issuanceProfitRate: Number(val || 0) })}
                      />
                    </div>
                  )}
                  <Switch
                    size="md"
                    color="blue"
                    checked={formConfig.issuanceProfitsEnabled}
                    onChange={(e) => setFormConfig({ ...formConfig, issuanceProfitsEnabled: e.currentTarget.checked })}
                  />
                </div>
              </div>

              {/* Toggle 2: أرباح تغيرات */}
              <div className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <RotateCcw size={16} />
                  </div>
                  <div>
                    <span className="font-black text-slate-900 block text-xs">أرباح تغيرات وإعادة الإصدار</span>
                    <span className="text-[10px] text-slate-500">عمولة عن كل عملية تغيير تاريخ أو خط سير</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {formConfig.changesProfitsEnabled && (
                    <div className="w-28">
                      <NumberInput
                        size="xs"
                        placeholder="المبلغ/النسبة"
                        value={formConfig.changesProfitRate}
                        onChange={(val) => setFormConfig({ ...formConfig, changesProfitRate: Number(val || 0) })}
                      />
                    </div>
                  )}
                  <Switch
                    size="md"
                    color="indigo"
                    checked={formConfig.changesProfitsEnabled}
                    onChange={(e) => setFormConfig({ ...formConfig, changesProfitsEnabled: e.currentTarget.checked })}
                  />
                </div>
              </div>

              {/* Toggle 3: أرباح شراء وزن */}
              <div className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Luggage size={16} />
                  </div>
                  <div>
                    <span className="font-black text-slate-900 block text-xs">أرباح شراء وزن إضافي</span>
                    <span className="text-[10px] text-slate-500">عمولة الموظف عن كل كيلوغرام أو معاملة وزن مسجلة</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {formConfig.baggageProfitsEnabled && (
                    <div className="w-28">
                      <NumberInput
                        size="xs"
                        placeholder="المبلغ/النسبة"
                        value={formConfig.baggageProfitRate}
                        onChange={(val) => setFormConfig({ ...formConfig, baggageProfitRate: Number(val || 0) })}
                      />
                    </div>
                  )}
                  <Switch
                    size="md"
                    color="teal"
                    checked={formConfig.baggageProfitsEnabled}
                    onChange={(e) => setFormConfig({ ...formConfig, baggageProfitsEnabled: e.currentTarget.checked })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION E: LIVE CALCULATION SUMMARY */}
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-emerald-800 block">صافي الاستحقاق الشهري التقديري</span>
              <span className="text-[10px] text-emerald-600">
                (الراتب الاسمي + البدلات + {formConfig.incentiveEnabled ? 'الحافز' : 'بدون حافز'} - استقطاع الضمان)
              </span>
            </div>
            <div className="text-end">
              <span className="text-xl font-black text-emerald-900 font-mono">
                {fmt(modalNetPreview)} <span className="text-xs">{formConfig.currency}</span>
              </span>
            </div>
          </div>

          {/* MODAL ACTIONS */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="h-9 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSaveModal}
              className="h-9 px-5 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Check size={16} />
              <span>تثبيت المخصصات للموظف</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
