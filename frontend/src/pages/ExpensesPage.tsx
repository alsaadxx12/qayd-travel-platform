import React, { useState, useMemo, useEffect } from 'react';
import {
  Button,
  Select,
  TextInput,
  Textarea,
  Modal,
  Badge,
  Tooltip,
  ActionIcon,
  NumberInput,
} from '@mantine/core';
import {
  Coins,
  Plus,
  Search,
  Printer,
  Wallet,
  TrendingDown,
  Building2,
  FileText,
  DollarSign,
  Coffee,
  Fuel,
  Wrench,
  Wifi,
  Receipt,
  RefreshCw,
  Eye,
  ChevronRight,
  ChevronLeft,
  ChevronsRight,
  ChevronsLeft,
  UserCheck,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api/client';
import { accountsApi } from '../api/accounts';
import { employeesApi } from '../api/employees';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { useAdoptedExchangeRate } from '../hooks/useAdoptedExchangeRate';
import { showSuccessNotification, showErrorNotification } from '../utils/notifications';
import { CurrencySegmentedControl } from '../components/ui/CurrencySegmentedControl';
import { SegmentedDatePicker } from '../components/ui/SegmentedDatePicker';

// Preset Expense Categories matching user's custom accounts
const EXPENSE_PRESETS = [
  { label: 'مصاريف ضيافة', icon: Coffee, defaultDesc: 'مصاريف ضيافة ومشروبات للمكتب', targetName: 'مصاريف ضيافة' },
  { label: 'مصاريف المولدة', icon: Fuel, defaultDesc: 'شراء وقود واشتراك مولدة المكتب', targetName: 'مصاريف المولدة' },
  { label: 'مصاريف إنترنت', icon: Wifi, defaultDesc: 'تسديد اشتراك شبكة الإنترنت', targetName: 'مصاريف إنترنت' },
  { label: 'مصاريف ماء وكهرباء', icon: Building2, defaultDesc: 'تسديد فواتير الماء والكهرباء', targetName: 'مصاريف ماء وكهرباء' },
  { label: 'مصاريف قرطاسية', icon: FileText, defaultDesc: 'شراء قرطاسية ومطبوعات مكتبية', targetName: 'مصاريف قرطاسية' },
  { label: 'مصاريف إيجار الشركة', icon: Building2, defaultDesc: 'دفعة إيجار مقر الشركة والفرع', targetName: 'مصاريف إيجار الشركة' },
  { label: 'مصاريف صيانة وإلكترونيات', icon: Wrench, defaultDesc: 'صيانة وشراء أجهزة وإلكترونيات', targetName: 'مصاريف صيانة وشراء الإلكترونيات' },
  { label: 'مصاريف أخرى', icon: Coins, defaultDesc: 'مصاريف تشغيلية ونثرية متنوعة', targetName: 'مصاريف أخرى' },
];

const getLocalIsoDate = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toDateInputValue = (value: unknown): string => {
  if (!value) return getLocalIsoDate();
  const raw = String(value);
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? getLocalIsoDate() : getLocalIsoDate(parsed);
};

const splitBeneficiaryFromDescription = (value: unknown): { beneficiary: string; description: string } => {
  const raw = String(value || '').trim();
  const match = raw.match(/^\[المدفوع له:\s*([^\]]+)\]\s*/);
  if (!match) return { beneficiary: '', description: raw };
  return {
    beneficiary: match[1].trim(),
    description: raw.slice(match[0].length).trim(),
  };
};

export const ExpensesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';
  const adoptedEx = useAdoptedExchangeRate();

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedCashbox, setSelectedCashbox] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'ALL'>('MONTH');

  // Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [activeExpenseId, setActiveExpenseId] = useState<string | null>(null);
  const [activeExpenseNumber, setActiveExpenseNumber] = useState('');
  const [activeCashboxName, setActiveCashboxName] = useState('');
  const [currentExpenseIndex, setCurrentExpenseIndex] = useState(-1);
  const [navigationExpenseIds, setNavigationExpenseIds] = useState<string[]>([]);

  // Form State
  const [expenseAccountId, setExpenseAccountId] = useState('');
  const [isChangingCashbox, setIsChangingCashbox] = useState(false);
  const [cashboxAccountId, setCashboxAccountId] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [currency, setCurrency] = useState<'IQD' | 'USD'>('IQD');
  const [exchangeRate, setExchangeRate] = useState<number>(1320);
  const [beneficiary, setBeneficiary] = useState('');
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState<string>(getLocalIsoDate());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Sync exchange rate on load
  useEffect(() => {
    if (adoptedEx?.adoptedRate) {
      setExchangeRate(Number(adoptedEx.adoptedRate));
    }
  }, [adoptedEx?.adoptedRate]);

  // 1. Fetch Payment Vouchers (which record expenses)
  const { data: vouchersData = [], isLoading: vouchersLoading, refetch } = useQuery({
    queryKey: ['expenses-vouchers-list'],
    queryFn: () => apiRequest('/api/payment-vouchers'),
    staleTime: 60 * 1000,
  });

  // 2. Fetch Accounts
  const { data: accountsData = [] } = useQuery({
    queryKey: ['flat-accounts-list'],
    queryFn: () => accountsApi.getFlat(),
    staleTime: 5 * 60 * 1000,
  });

  // 3. Fetch employees to resolve the logged-in employee's assigned cashbox.
  const { data: employeesData = [], isLoading: employeesLoading } = useQuery({
    queryKey: ['employees-for-expense-cashbox'],
    queryFn: () => employeesApi.getAll().catch(() => []),
    staleTime: 5 * 60 * 1000,
  });

  // 4. Filter Expense Accounts & Cashbox Accounts (Strictly non-parent postable accounts)
  const allAccountsMap = useMemo(() => {
    const map = new Map<string, any>();
    if (Array.isArray(accountsData)) {
      accountsData.forEach((a: any) => {
        map.set(a.id, a);
        if (a.code) map.set(a.code, a);
      });
    }
    return map;
  }, [accountsData]);

  const expenseAccounts = useMemo(() => {
    if (!Array.isArray(accountsData)) return [];
    return accountsData.filter(
      (a: any) =>
        !a.isParent &&
        (a.type === 'EXPENSE' || (a.code && (a.code.startsWith('3') || a.code.startsWith('5')))) &&
        a.code !== '3' &&
        a.code !== '31' &&
        a.code !== '32' &&
        a.code !== '33' &&
        a.code !== '34' &&
        a.code !== '35' &&
        a.code !== '36' &&
        a.code !== '4' &&
        a.code !== '5'
    );
  }, [accountsData]);

  // Mantine 7 Compatible Grouped Expense Accounts structure: Array<{ group: string, items: Array<{ value, label }> }>
  const expenseSelectOptions = useMemo(() => {
    if (!Array.isArray(expenseAccounts) || expenseAccounts.length === 0) return [];

    const groupsMap = new Map<string, Array<{ value: string; label: string }>>();

    expenseAccounts.forEach((a: any) => {
      let groupName = '3 - المصروفات التشغيلية';
      if (a.parentId && allAccountsMap.has(a.parentId)) {
        const parent = allAccountsMap.get(a.parentId);
        if (parent.parentId && allAccountsMap.has(parent.parentId)) {
          const grandParent = allAccountsMap.get(parent.parentId);
          groupName = `${grandParent.nameAr || grandParent.name || ''} ── ${parent.nameAr || parent.name || ''}`;
        } else {
          groupName = `${parent.code ? parent.code + ' - ' : ''}${parent.nameAr || parent.name || 'مصروفات'}`;
        }
      } else if (a.code) {
        if (a.code.startsWith('31')) groupName = '31 - تكاليف العاملين والرواتب';
        else if (a.code.startsWith('32')) groupName = '32 - المستلزمات السلعية والضيافة والوقود';
        else if (a.code.startsWith('33')) groupName = '33 - المستلزمات والخدمات والصيانة والإنترنت';
        else if (a.code.startsWith('34')) groupName = '34 - كلفة الخدمات المشتراة';
        else if (a.code.startsWith('35')) groupName = '35 - المصروفات التشغيلية والإيجارات';
        else if (a.code.startsWith('36')) groupName = '36 - المصروفات غير التشغيلية';
      }

      if (!groupsMap.has(groupName)) {
        groupsMap.set(groupName, []);
      }
      groupsMap.get(groupName)!.push({
        value: a.id,
        label: `${a.code ? a.code + ' - ' : ''}${a.nameAr || a.name || 'مصروف'}`,
      });
    });

    const result: Array<{ group: string; items: Array<{ value: string; label: string }> }> = [];
    groupsMap.forEach((items, group) => {
      result.push({ group, items });
    });

    return result;
  }, [expenseAccounts, allAccountsMap]);

  const cashboxAccounts = useMemo(() => {
    if (!Array.isArray(accountsData)) return [];
    return accountsData.filter(
      (a: any) =>
        (a.category === 'CASH' ||
          a.category === 'BANK' ||
          (a.type === 'ASSET' && (a.code.startsWith('18') || a.code.startsWith('12') || a.code.startsWith('10')))) &&
        !a.isParent
    );
  }, [accountsData]);

  const currentEmployee = useMemo(() => {
    if (!Array.isArray(employeesData) || !user) return null;
    const normalizedName = String(user.name || '').trim().toLowerCase();
    const normalizedEmail = String(user.email || '').trim().toLowerCase();
    const normalizedPhone = String(user.phone || '').replace(/\s+/g, '');

    return employeesData.find((employee: any) => {
      const employeeNames = [employee.fullName, employee.name, employee.username]
        .filter(Boolean)
        .map((value) => String(value).trim().toLowerCase());
      const employeeEmail = String(employee.email || '').trim().toLowerCase();
      const employeePhone = String(employee.phone || '').replace(/\s+/g, '');

      return (
        (normalizedEmail && employeeEmail === normalizedEmail) ||
        (normalizedEmail && employeeNames.includes(normalizedEmail)) ||
        (normalizedPhone && employeePhone === normalizedPhone) ||
        (normalizedName && employeeNames.includes(normalizedName))
      );
    }) || null;
  }, [employeesData, user]);

  const assignedEmployeeCashbox = useMemo(() => {
    if (!Array.isArray(accountsData) || accountsData.length === 0) return null;
    const allAccounts = accountsData as any[];
    const assigned = String(currentEmployee?.assignedCashbox || '').trim();

    if (assigned) {
      const normalizedAssigned = assigned.toLowerCase();
      const directMatch = allAccounts.find((account: any) => {
        if (account.isParent || account.isGroup) return false;
        const names = [account.nameAr, account.nameEn, account.name]
          .filter(Boolean)
          .map((value) => String(value).trim().toLowerCase());
        return (
          account.id === assigned ||
          account.code === assigned ||
          names.includes(normalizedAssigned) ||
          names.some((name) => name.includes(normalizedAssigned))
        );
      });
      if (directMatch) return directMatch;
    }

    const userWithCashbox = user as any;
    const storedCashboxId =
      userWithCashbox?.defaultCashboxId ||
      userWithCashbox?.cashboxAccountId ||
      userWithCashbox?.cashboxId ||
      localStorage.getItem('userDefaultCashbox') ||
      localStorage.getItem('activeCashboxId');
    if (storedCashboxId) {
      const storedMatch = allAccounts.find(
        (account: any) =>
          !account.isParent &&
          !account.isGroup &&
          (account.id === storedCashboxId || account.code === storedCashboxId)
      );
      if (storedMatch) return storedMatch;
    }

    const employeeName = String(currentEmployee?.fullName || user?.name || '').trim().toLowerCase();
    if (employeeName) {
      const firstName = employeeName.split(/\s+/)[0];
      const nameMatch = cashboxAccounts.find((account: any) => {
        const accountName = String(account.nameAr || account.nameEn || account.name || '').toLowerCase();
        return accountName.includes(employeeName) || (firstName.length >= 3 && accountName.includes(firstName));
      });
      if (nameMatch) return nameMatch;
    }

    return null;
  }, [accountsData, cashboxAccounts, currentEmployee, user]);

  // Apply employee-linked cashbox for new expenses; never silently pick the first cashbox.
  useEffect(() => {
    if (!activeExpenseId && assignedEmployeeCashbox?.id) {
      setCashboxAccountId(assignedEmployeeCashbox.id);
    }
    if (expenseAccounts.length > 0 && !expenseAccountId) {
      setExpenseAccountId(expenseAccounts[0].id);
    }
  }, [activeExpenseId, assignedEmployeeCashbox, expenseAccounts, expenseAccountId]);

  // Filtered Expenses List
  const filteredExpenses = useMemo(() => {
    if (!Array.isArray(vouchersData)) return [];

    return vouchersData.filter((item: any) => {
      // 1. Search Query
      const q = searchTerm.toLowerCase().trim();
      const descMatch = item.description?.toLowerCase().includes(q);
      const numMatch = item.voucherNumber?.toLowerCase().includes(q);
      const refMatch = item.reference?.toLowerCase().includes(q);
      const accMatch = item.account?.nameAr?.toLowerCase().includes(q) || item.account?.nameEn?.toLowerCase().includes(q);
      const suppMatch = item.supplier?.nameAr?.toLowerCase().includes(q) || item.supplier?.nameEn?.toLowerCase().includes(q);

      if (q && !descMatch && !numMatch && !refMatch && !accMatch && !suppMatch) {
        return false;
      }

      // 2. Category / Expense Account
      if (selectedCategory !== 'ALL' && item.accountId !== selectedCategory) {
        return false;
      }

      // 3. Cashbox Filter
      if (selectedCashbox !== 'ALL' && item.cashboxOrBankAccountId !== selectedCashbox) {
        return false;
      }

      // 4. Date Filter
      const itemDate = new Date(item.date || item.createdAt);
      const now = new Date();

      if (dateFilter === 'TODAY') {
        const isToday =
          itemDate.getDate() === now.getDate() &&
          itemDate.getMonth() === now.getMonth() &&
          itemDate.getFullYear() === now.getFullYear();
        if (!isToday) return false;
      } else if (dateFilter === 'WEEK') {
        const diffDays = (now.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
        if (diffDays > 7) return false;
      } else if (dateFilter === 'MONTH') {
        const isThisMonth =
          itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
        if (!isThisMonth) return false;
      }

      return true;
    });
  }, [vouchersData, searchTerm, selectedCategory, selectedCashbox, dateFilter]);

  const navigationExpenses = useMemo(() => {
    if (!Array.isArray(vouchersData)) return [];
    const byId = new Map(vouchersData.map((item: any) => [item.id, item]));
    return navigationExpenseIds
      .map((id) => byId.get(id))
      .filter(Boolean) as any[];
  }, [navigationExpenseIds, vouchersData]);

  // Statistics Calculations
  const stats = useMemo(() => {
    let totalIQD = 0;
    let totalUSD = 0;
    const categoryTotals: Record<string, number> = {};

    filteredExpenses.forEach((exp: any) => {
      const amt = parseFloat(exp.amount) || 0;
      const cur = exp.account?.currency || exp.currency || 'IQD';
      if (cur === 'USD' || cur === '$') {
        totalUSD += amt;
        totalIQD += amt * (parseFloat(exp.exchangeRate) || exchangeRate);
      } else {
        totalIQD += amt;
        totalUSD += amt / (parseFloat(exp.exchangeRate) || exchangeRate);
      }

      const catName = exp.account?.nameAr || exp.account?.name || 'مصروف عام';
      categoryTotals[catName] = (categoryTotals[catName] || 0) + amt;
    });

    // Find top category
    let topCategory = '—';
    let topAmount = 0;
    Object.entries(categoryTotals).forEach(([cat, sum]) => {
      if (sum > topAmount) {
        topAmount = sum;
        topCategory = cat;
      }
    });

    return {
      totalIQD,
      totalUSD,
      count: filteredExpenses.length,
      topCategory,
    };
  }, [filteredExpenses, exchangeRate]);

  const resetExpenseForm = () => {
    setActiveExpenseId(null);
    setActiveExpenseNumber('');
    setActiveCashboxName('');
    setCurrentExpenseIndex(-1);
    setAmount('');
    setCurrency('IQD');
    setExpenseAccountId(expenseAccounts[0]?.id || '');
    setCashboxAccountId(assignedEmployeeCashbox?.id || '');
    setBeneficiary('');
    setReference('');
    setDescription('');
    setExpenseDate(getLocalIsoDate());
    setFormErrors({});
  };

  const openNewExpense = () => {
    setNavigationExpenseIds(filteredExpenses.map((item: any) => item.id));
    resetExpenseForm();
    setCreateModalOpen(true);
  };

  const loadExpenseIntoForm = (item: any, index: number) => {
    const parsedDescription = splitBeneficiaryFromDescription(item.description);
    const itemCurrency = String(item.currency || item.account?.currency || 'IQD').toUpperCase();

    setActiveExpenseId(item.id || null);
    setActiveExpenseNumber(item.voucherNumber || `PV-${String(item.id || '').slice(0, 6)}`);
    setActiveCashboxName(
      item.cashboxOrBankAccount?.nameAr ||
      item.cashboxOrBankAccount?.nameEn ||
      item.cashboxOrBankAccount?.name ||
      ''
    );
    setCurrentExpenseIndex(index);
    setAmount(Number(item.amount) || '');
    setCurrency(itemCurrency.includes('USD') || itemCurrency.includes('$') ? 'USD' : 'IQD');
    setExchangeRate(Number(item.exchangeRate) || Number(adoptedEx?.adoptedRate) || exchangeRate);
    setExpenseAccountId(item.accountId || item.account?.id || '');
    setCashboxAccountId(item.cashboxOrBankAccountId || item.cashboxOrBankAccount?.id || '');
    setBeneficiary(parsedDescription.beneficiary || item.supplier?.nameAr || item.supplier?.nameEn || '');
    setReference(item.reference || '');
    setDescription(parsedDescription.description);
    setExpenseDate(toDateInputValue(item.date || item.createdAt));
    setFormErrors({});
  };

  const openExpenseRecord = (item: any) => {
    const snapshot = filteredExpenses.map((expense: any) => expense.id);
    const index = Math.max(0, snapshot.indexOf(item.id));
    setNavigationExpenseIds(snapshot);
    loadExpenseIntoForm(item, index);
    setCreateModalOpen(true);
  };

  const navigateToExpense = (index: number) => {
    const target = navigationExpenses[index];
    if (!target) return;
    loadExpenseIntoForm(target, index);
  };

  const handleNavigateFirst = () => navigateToExpense(0);
  const handleNavigatePrevious = () => {
    if (currentExpenseIndex > 0) navigateToExpense(currentExpenseIndex - 1);
  };
  const handleNavigateNext = () => {
    if (currentExpenseIndex === -1 && navigationExpenses.length > 0) navigateToExpense(0);
    else if (currentExpenseIndex < navigationExpenses.length - 1) navigateToExpense(currentExpenseIndex + 1);
  };
  const handleNavigateLast = () => navigateToExpense(navigationExpenses.length - 1);

  // Create or update an expense without duplicating a record opened through navigation.
  const saveExpenseMutation = useMutation({
    mutationFn: async ({ payload, expenseId }: { payload: any; expenseId: string | null }) => {
      return apiRequest(expenseId ? `/api/payment-vouchers/${expenseId}` : '/api/payment-vouchers', {
        method: expenseId ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['expenses-vouchers-list'] });
      queryClient.invalidateQueries({ queryKey: ['flat-accounts-list'] });
      queryClient.invalidateQueries({ queryKey: ['cashbox-accounts-list'] });
      showSuccessNotification(
        variables.expenseId
          ? (isAr ? 'تم تحديث قيد المصروف' : 'Expense Updated')
          : (isAr ? 'تم تسجيل المصروف بنجاح' : 'Expense Recorded'),
        variables.expenseId
          ? (isAr ? 'تم حفظ التعديلات وتحديث القيد المحاسبي المرتبط' : 'Changes and linked journal entry were updated')
          : (isAr ? 'تم قيد المصروف في الحسابات وخصمه من صندوق الموظف' : 'Expense booked and deducted from employee cashbox')
      );
      resetExpenseForm();
      setCreateModalOpen(false);
    },
    onError: (err: any) => {
      showErrorNotification(
        isAr ? 'فشل حفظ المصروف' : 'Failed to Save Expense',
        err.message || (isAr ? 'حدث خطأ أثناء حفظ السند' : 'An error occurred')
      );
    },
  });

  const handleApplyPreset = (preset: (typeof EXPENSE_PRESETS)[0]) => {
    setDescription(preset.defaultDesc);
    const match =
      expenseAccounts.find((a: any) => a.nameAr && a.nameAr.includes(preset.targetName)) ||
      expenseAccounts.find((a: any) => a.nameAr && a.nameAr.includes(preset.label));
    if (match) {
      setExpenseAccountId(match.id);
      setFormErrors((current) => ({ ...current, expenseAccountId: '' }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};

    if (!amount || Number(amount) <= 0) {
      errs.amount = isAr ? 'يرجى إدخال مبلغ المصروف بشكل صحيح' : 'Please enter valid expense amount';
    }
    if (!expenseAccountId) {
      errs.expenseAccountId = isAr ? 'يرجى اختيار بند المصروف' : 'Please select expense account';
    }
    if (!cashboxAccountId) {
      errs.cashboxAccountId = isAr ? 'يرجى تحديد صندوق أو بنك الصرف' : 'Please select payment cashbox';
    }
    if (!description.trim()) {
      errs.description = isAr ? 'يرجى كتابة بيان أو تفاصيل المصروف' : 'Please provide description';
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) {
      errs.expenseDate = isAr ? 'يرجى إدخال تاريخ صحيح' : 'Please enter a valid date';
    }

    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }

    const payload = {
      date: expenseDate,
      amount: Number(amount),
      currency,
      exchangeRate: currency === 'USD' ? exchangeRate : 1,
      accountId: expenseAccountId,
      cashboxOrBankAccountId: cashboxAccountId,
      reference: reference.trim(),
      description: beneficiary.trim()
        ? `[المدفوع له: ${beneficiary.trim()}] ${description.trim()}`
        : description.trim(),
      status: 'POSTED',
    };

    saveExpenseMutation.mutate({ payload, expenseId: activeExpenseId });
  };

  const selectedCashboxAccount: any = Array.isArray(accountsData)
    ? (accountsData as any[]).find((account: any) => account.id === cashboxAccountId)
    : null;
  const selectedCashboxName =
    selectedCashboxAccount?.nameAr ||
    selectedCashboxAccount?.nameEn ||
    selectedCashboxAccount?.name ||
    activeCashboxName ||
    (isAr ? 'صندوق غير محدد' : 'Unspecified cashbox');

  return (
    <div className="p-6 space-y-6 max-w-[1550px] mx-auto font-sans" dir={direction}>
      {/* ── HEADER & ACTIONS ── */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#F45A0A] flex items-center justify-center border border-orange-200 shadow-2xs">
            <Coins size={26} strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 leading-tight">
              {isAr ? 'سجل المصاريف والنثريات' : 'Expenses & Operating Ledger'}
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {isAr
                ? 'إدارة وتقييد مصروفات الفرع بالدينار والدولار مع الترحيل المحاسبي الفوري'
                : 'Manage and post branch operational expenses with multi-currency support'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="default"
            size="sm"
            leftSection={<RefreshCw size={14} className={vouchersLoading ? 'animate-spin' : ''} />}
            onClick={() => refetch()}
            className="rounded-xl font-bold h-10 border-slate-200 text-slate-700"
          >
            {isAr ? 'تحديث السجل' : 'Refresh'}
          </Button>

          <Button
            size="sm"
            color="orange"
            variant="filled"
            leftSection={<Plus size={16} />}
            onClick={openNewExpense}
            className="bg-[#F45A0A] hover:bg-[#dd4f05] rounded-xl font-black h-10 px-5 text-white shadow-xs cursor-pointer"
          >
            {isAr ? '+ تسجيل مصروف جديد' : '+ New Expense'}
          </Button>
        </div>
      </div>

      {/* ── STATS METRIC CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total IQD */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 block mb-1">
              {isAr ? 'إجمالي المصاريف (IQD)' : 'Total Expenses (IQD)'}
            </span>
            <span className="text-xl font-black font-mono text-slate-900 block">
              {stats.totalIQD.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-xs font-sans text-[#F45A0A]">د.ع</span>
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-orange-50 text-[#F45A0A] flex items-center justify-center border border-orange-100">
            <Coins size={22} />
          </div>
        </div>

        {/* Total USD */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 block mb-1">
              {isAr ? 'إجمالي المصاريف (USD)' : 'Total Expenses (USD)'}
            </span>
            <span className="text-xl font-black font-mono text-emerald-600 block">
              ${stats.totalUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <DollarSign size={22} />
          </div>
        </div>

        {/* Top Expense Category */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 block mb-1">
              {isAr ? 'أعلى بند صرف' : 'Top Expense Item'}
            </span>
            <span className="text-sm font-black text-slate-800 truncate max-w-[160px] block" title={stats.topCategory}>
              {stats.topCategory}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
            <TrendingDown size={22} />
          </div>
        </div>

        {/* Operations Count */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 block mb-1">
              {isAr ? 'عدد العمليات المسجلة' : 'Recorded Vouchers'}
            </span>
            <span className="text-xl font-black font-mono text-slate-900 block">
              {stats.count} <span className="text-xs font-sans text-slate-500">{isAr ? 'سند' : 'entries'}</span>
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
            <Receipt size={22} />
          </div>
        </div>
      </div>

      {/* ── FILTER TOOLBAR ── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* Search Box */}
          <div className="relative min-w-[260px] flex-1">
            <TextInput
              placeholder={isAr ? 'بحث برقم السند، البيان، أو اسم الحساب...' : 'Search by voucher#, description, or account...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftSection={<Search size={16} className="text-slate-400" />}
              radius="lg"
              size="sm"
              styles={{
                input: {
                  borderColor: '#E2E8F0',
                  fontSize: '12.5px',
                  backgroundColor: '#F8FAFC',
                },
              }}
            />
          </div>

          {/* Category Filter */}
          <div className="w-48">
            <Select
              placeholder={isAr ? 'كل بنود المصاريف' : 'All Categories'}
              value={selectedCategory}
              onChange={(val) => setSelectedCategory(val || 'ALL')}
              data={[
                { value: 'ALL', label: isAr ? '📌 كل بنود المصاريف' : 'All Categories' },
                ...expenseAccounts.map((a: any) => ({
                  value: a.id,
                  label: a.nameAr || a.name || a.code,
                })),
              ]}
              size="sm"
              radius="lg"
              styles={{ input: { fontSize: '12px' } }}
            />
          </div>

          {/* Cashbox Filter */}
          <div className="w-44">
            <Select
              placeholder={isAr ? 'كل الصناديق' : 'All Cashboxes'}
              value={selectedCashbox}
              onChange={(val) => setSelectedCashbox(val || 'ALL')}
              data={[
                { value: 'ALL', label: isAr ? '🏦 كل الصناديق والبنوك' : 'All Cashboxes' },
                ...cashboxAccounts.map((a: any) => ({
                  value: a.id,
                  label: a.nameAr || a.name || a.code,
                })),
              ]}
              size="sm"
              radius="lg"
              styles={{ input: { fontSize: '12px' } }}
            />
          </div>

          {/* Date Period Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setDateFilter('TODAY')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                dateFilter === 'TODAY' ? 'bg-white text-[#F45A0A] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isAr ? 'اليوم' : 'Today'}
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('WEEK')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                dateFilter === 'WEEK' ? 'bg-white text-[#F45A0A] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isAr ? 'هذا الأسبوع' : 'This Week'}
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('MONTH')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                dateFilter === 'MONTH' ? 'bg-white text-[#F45A0A] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isAr ? 'هذا الشهر' : 'This Month'}
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('ALL')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                dateFilter === 'ALL' ? 'bg-white text-[#F45A0A] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isAr ? 'الكل' : 'All'}
            </button>
          </div>
        </div>
      </div>

      {/* ── EXPENSES DATA TABLE ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt size={18} className="text-[#F45A0A]" />
            <span className="font-black text-slate-900 text-sm">
              {isAr ? 'قائمة سندات المصاريف المسجلة' : 'Recorded Expense Vouchers'}
            </span>
            <Badge color="orange" variant="light" size="sm" className="font-mono font-bold">
              {filteredExpenses.length} {isAr ? 'سند' : 'records'}
            </Badge>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold text-[11.5px]">
              <tr>
                <th className="p-3 text-center w-12">#</th>
                <th className="p-3">{isAr ? 'رقم السند' : 'Voucher #'}</th>
                <th className="p-3 text-center">{isAr ? 'التاريخ' : 'Date'}</th>
                <th className="p-3">{isAr ? 'بند المصروف' : 'Expense Account'}</th>
                <th className="p-3">{isAr ? 'البيان والتفاصيل' : 'Description / Notes'}</th>
                <th className="p-3">{isAr ? 'صندوق الصرف' : 'Paid From'}</th>
                <th className="p-3 text-center">{isAr ? 'المبلغ' : 'Amount'}</th>
                <th className="p-3 text-center">{isAr ? 'الحالة' : 'Status'}</th>
                <th className="p-3 text-center w-28">{isAr ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-400 font-medium">
                    <div className="max-w-xs mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                        <Coins size={24} />
                      </div>
                      <p className="text-sm font-bold text-slate-700">
                        {isAr ? 'لا توجد مصاريف مسجلة مطابقة' : 'No matching expenses found'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {isAr ? 'يمكنك البدء بإضافة مصروف جديد بالضغط على زر "تسجيل مصروف جديد"' : 'Click New Expense to create one'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((item: any, idx: number) => {
                  const amt = parseFloat(item.amount) || 0;
                  const itemCur = item.currency || 'IQD';
                  const itemDate = new Date(item.date || item.createdAt);

                  return (
                    <tr key={item.id} className="hover:bg-orange-50/20 transition-colors font-sans">
                      <td className="p-3 text-center text-slate-400 font-mono font-bold">{idx + 1}</td>
                      <td className="p-3 font-mono font-black text-slate-900 text-xs">
                        {item.voucherNumber || `PV-${item.id.slice(0, 6)}`}
                        {item.reference && (
                          <span className="block text-[10px] text-slate-400 font-normal">
                            مرجع: {item.reference}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        {itemDate.toLocaleDateString('en-GB')}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 text-xs">
                            {item.account?.nameAr || item.account?.name || (isAr ? 'مصروف عام' : 'General Expense')}
                          </span>
                          {item.account?.code && (
                            <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              {item.account.code}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 max-w-[280px]">
                        <p className="text-slate-700 font-medium text-xs truncate" title={item.description}>
                          {item.description || '—'}
                        </p>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                          <Wallet size={13} className="text-slate-400" />
                          <span>
                            {item.cashboxOrBankAccount?.nameAr ||
                              item.cashboxOrBankAccount?.name ||
                              (isAr ? 'الصندوق الرئيسي' : 'Main Cashbox')}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <span className="font-mono font-black text-sm text-slate-900 block">
                          {amt.toLocaleString()} <span className="text-[11px] font-bold text-[#F45A0A]">{itemCur}</span>
                        </span>
                        {itemCur === 'USD' && (
                          <span className="text-[10px] font-mono text-slate-400 block">
                            ≈ {(amt * (parseFloat(item.exchangeRate) || exchangeRate)).toLocaleString()} د.ع
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <Badge
                          size="xs"
                          variant="light"
                          color={item.status === 'POSTED' ? 'emerald' : item.status === 'CANCELLED' ? 'red' : 'gray'}
                          className="font-bold"
                        >
                          {item.status === 'POSTED' ? (isAr ? 'معتمد ومرحل' : 'Posted') : item.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Tooltip label={isAr ? 'فتح القيد والتنقل بين السجلات' : 'Open and browse records'}>
                            <ActionIcon
                              size="sm"
                              variant="light"
                              color="orange"
                              onClick={() => openExpenseRecord(item)}
                              className="rounded-lg"
                              aria-label={isAr ? `فتح القيد ${item.voucherNumber || ''}` : `Open ${item.voucherNumber || 'expense'}`}
                            >
                              <Eye size={14} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label={isAr ? 'طباعة سند الصرف' : 'Print Voucher'}>
                            <ActionIcon
                              size="sm"
                              variant="light"
                              color="gray"
                              onClick={() => window.print()}
                              className="rounded-lg hover:text-[#F45A0A]"
                            >
                              <Printer size={14} />
                            </ActionIcon>
                          </Tooltip>
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

      {/* ── MODAL: CREATE NEW EXPENSE ── */}
      <Modal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title={
          <div className="flex items-center gap-2.5" dir={direction}>
            <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#F45A0A] flex items-center justify-center border border-orange-100 shrink-0">
              <Coins size={17} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 leading-tight">
                {activeExpenseId
                  ? (isAr ? 'عرض وتعديل قيد المصروف' : 'View & Edit Expense')
                  : (isAr ? 'تسجيل وقيد مصروف جديد' : 'New Operating Expense')}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {activeExpenseId
                  ? (isAr ? `القيد ${activeExpenseNumber}` : `${activeExpenseNumber}`)
                  : (isAr ? 'قيد مالي مباشر لحسابات وصندوق الفرع' : 'Direct operational expense voucher')}
              </p>
            </div>
          </div>
        }
        size="780px"
        radius="16px"
        dir={direction}
        centered
        closeOnClickOutside={!saveExpenseMutation.isPending}
        closeOnEscape={!saveExpenseMutation.isPending}
        styles={{
          header: { padding: '14px 20px', borderBottom: '1px solid #F1F5F9' },
          body: { padding: '18px 20px', overflow: 'visible' },
        }}
      >
        <form onSubmit={handleSubmit} className="space-y-4 font-sans text-xs" dir={direction}>
          {/* ── 1. MINIMALIST PRESET CHIPS ── */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 ml-1">
              {isAr ? 'اختيار سريع:' : 'Quick Select:'}
            </span>
            {EXPENSE_PRESETS.map((preset, pIdx) => {
              const Icon = preset.icon;
              return (
                <button
                  key={pIdx}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-orange-50 hover:text-[#F45A0A] text-slate-700 text-[11.5px] font-bold transition-colors cursor-pointer"
                >
                  <Icon size={12} className="text-slate-500" />
                  <span>{preset.label}</span>
                </button>
              );
            })}
          </div>

          {/* ── 2. EXPENSE ACCOUNT (MAIN SELECTOR) ── */}
          <div>
            <label className="font-bold text-slate-700 text-xs block mb-1">
              {isAr ? 'بند / حساب المصروف *' : 'Expense Item *'}
            </label>
            <Select
              value={expenseAccountId}
              onChange={(v) => {
                setExpenseAccountId(v || '');
                setFormErrors((current) => ({ ...current, expenseAccountId: '' }));
              }}
              data={expenseSelectOptions || []}
              searchable
              clearable
              size="sm"
              radius="md"
              error={formErrors.expenseAccountId}
              autoFocus={!activeExpenseId}
              placeholder={isAr ? 'اختر أو ابحث عن بند المصروف...' : 'Search and select expense item...'}
              styles={{
                input: {
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#0F172A',
                  borderColor: formErrors.expenseAccountId ? '#EF4444' : '#CBD5E1',
                  height: '38px',
                },
              }}
            />
          </div>

          {/* ── 3. THREE-COLUMN ROW: AMOUNT & CURRENCY | DATE | CASHBOX ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-start">
            {/* Amount & Currency */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700 text-xs">
                  {isAr ? 'مبلغ وعملة المصروف *' : 'Amount & Currency *'}
                </label>
              </div>
              <div className="flex items-center gap-1.5">
                <NumberInput
                  placeholder={currency === 'IQD' ? '25,000' : '50.00'}
                  value={amount}
                  onChange={(val) => {
                    setAmount(val as number | '');
                    setFormErrors((current) => ({ ...current, amount: '' }));
                  }}
                  min={0}
                  thousandSeparator=","
                  size="sm"
                  radius="md"
                  error={formErrors.amount}
                  className="flex-1"
                  styles={{
                    input: {
                      fontFamily: 'monospace',
                      fontWeight: 800,
                      fontSize: '14.5px',
                      color: '#0F172A',
                      borderColor: formErrors.amount ? '#EF4444' : '#CBD5E1',
                      height: '36px',
                    },
                  }}
                />
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setCurrency('IQD')}
                    className={`px-2 py-1 text-[11px] font-black rounded-md transition-all cursor-pointer ${
                      currency === 'IQD' ? 'bg-[#F45A0A] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    IQD
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrency('USD')}
                    className={`px-2 py-1 text-[11px] font-black rounded-md transition-all cursor-pointer ${
                      currency === 'USD' ? 'bg-[#F45A0A] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    $ USD
                  </button>
                </div>
              </div>

              {currency === 'USD' && (
                <span className="block mt-1 font-mono text-[10.5px] text-slate-500 font-medium">
                  100$ = {(exchangeRate * 100).toLocaleString()} د.ع (≈ {((Number(amount) || 0) * exchangeRate).toLocaleString()} د.ع)
                </span>
              )}
            </div>

            {/* Expense Date */}
            <div>
              <SegmentedDatePicker
                label={isAr ? 'تاريخ المصروف' : 'Expense Date'}
                required
                value={expenseDate}
                onChange={(_date, isoString) => {
                  setExpenseDate(isoString);
                  setFormErrors((current) => ({ ...current, expenseDate: '' }));
                }}
                clearable={false}
                dropdownPosition="top"
                error={formErrors.expenseDate}
              />
            </div>

            {/* Paid From Cashbox / Bank */}
            <div>
              <label className="font-bold text-slate-700 text-xs block mb-1">
                {isAr ? 'صندوق / بنك الصرف *' : 'Paid From Cashbox *'}
              </label>
              <Select
                size="sm"
                radius="md"
                data={cashboxAccounts.map((a: any) => ({
                  value: a.id,
                  label: `${a.code ? a.code + ' - ' : ''}${a.nameAr || a.name || 'الصندوق'}`,
                }))}
                value={cashboxAccountId}
                onChange={(v) => {
                  if (v) {
                    setCashboxAccountId(v);
                    setFormErrors((current) => ({ ...current, cashboxAccountId: '' }));
                  }
                }}
                searchable
                error={formErrors.cashboxAccountId}
                placeholder={isAr ? 'اختر صندوق الصرف...' : 'Select cashbox...'}
                styles={{
                  input: {
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#0F172A',
                    borderColor: formErrors.cashboxAccountId ? '#EF4444' : '#CBD5E1',
                    height: '36px',
                  },
                }}
              />
            </div>
          </div>

          {/* ── 4. DESCRIPTION TEXTAREA ── */}
          <div>
            <label className="font-bold text-slate-700 text-xs block mb-1">
              {isAr ? 'البيان وتفاصيل المصروف *' : 'Description / Notes *'}
            </label>
            <Textarea
              placeholder={isAr ? 'اكتب تفاصيل وسبب صرف المبلغ والمستفيد وأي ملاحظات تدقيقية...' : 'Enter expense details and purpose...'}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setFormErrors((current) => ({ ...current, description: '' }));
              }}
              minRows={3}
              maxRows={6}
              size="sm"
              radius="md"
              error={formErrors.description}
              styles={{
                input: {
                  fontSize: '12.5px',
                  lineHeight: '1.5',
                  borderColor: formErrors.description ? '#EF4444' : '#CBD5E1',
                  backgroundColor: '#FFFFFF',
                },
              }}
            />
          </div>

          {/* ── 5. FOOTER: ACTIONS & REFERENCE & PAGINATION ── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
            {/* Actions: Save & Cancel */}
            <div className="flex items-center gap-2">
              <Button
                type="submit"
                size="sm"
                color="orange"
                variant="filled"
                loading={saveExpenseMutation.isPending}
                className="bg-[#F45A0A] hover:bg-[#dd4f05] rounded-xl font-bold h-9 px-5 text-white shadow-xs cursor-pointer"
              >
                {activeExpenseId ? (isAr ? 'حفظ التعديلات' : 'Save Changes') : (isAr ? 'حفظ وترحيل المصروف' : 'Save & Post Expense')}
              </Button>
              <Button
                size="sm"
                variant="default"
                disabled={saveExpenseMutation.isPending}
                onClick={() => setCreateModalOpen(false)}
                className="rounded-xl font-bold h-9 border-slate-200 text-slate-700"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </Button>
            </div>

            {/* Reference / Invoice # Input */}
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-500 text-[11px] shrink-0">
                {isAr ? 'رقم الوصل:' : 'Ref #:'}
              </span>
              <TextInput
                placeholder="INV-00123"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                size="xs"
                radius="md"
                className="w-32"
                styles={{ input: { fontFamily: 'monospace', fontSize: '11px', fontWeight: 600 } }}
              />
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              <Tooltip label={isAr ? 'أول قيد' : 'First'}>
                <button
                  type="button"
                  onClick={handleNavigateFirst}
                  disabled={navigationExpenses.length === 0 || currentExpenseIndex === 0 || saveExpenseMutation.isPending}
                  className="h-6 w-6 shrink-0 rounded flex items-center justify-center text-slate-600 hover:bg-white hover:text-[#F45A0A] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  {direction === 'rtl' ? <ChevronsRight size={13} /> : <ChevronsLeft size={13} />}
                </button>
              </Tooltip>
              <Tooltip label={isAr ? 'السابق' : 'Prev'}>
                <button
                  type="button"
                  onClick={handleNavigatePrevious}
                  disabled={currentExpenseIndex <= 0 || saveExpenseMutation.isPending}
                  className="h-6 w-6 shrink-0 rounded flex items-center justify-center text-slate-600 hover:bg-white hover:text-[#F45A0A] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  {direction === 'rtl' ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
                </button>
              </Tooltip>

              <div className="h-6 px-2 rounded bg-white border border-slate-200 flex items-center justify-center">
                <span className="font-mono text-[10px] font-bold text-slate-700" dir="ltr">
                  {activeExpenseNumber || (isAr ? 'قيد جديد' : 'New')}
                </span>
              </div>

              <Tooltip label={isAr ? 'التالي' : 'Next'}>
                <button
                  type="button"
                  onClick={handleNavigateNext}
                  disabled={navigationExpenses.length === 0 || currentExpenseIndex >= navigationExpenses.length - 1 || saveExpenseMutation.isPending}
                  className="h-6 w-6 shrink-0 rounded flex items-center justify-center text-slate-600 hover:bg-white hover:text-[#F45A0A] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  {direction === 'rtl' ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
                </button>
              </Tooltip>
              <Tooltip label={isAr ? 'آخر قيد' : 'Last'}>
                <button
                  type="button"
                  onClick={handleNavigateLast}
                  disabled={navigationExpenses.length === 0 || currentExpenseIndex >= navigationExpenses.length - 1 || saveExpenseMutation.isPending}
                  className="h-6 w-6 shrink-0 rounded flex items-center justify-center text-slate-600 hover:bg-white hover:text-[#F45A0A] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  {direction === 'rtl' ? <ChevronsLeft size={13} /> : <ChevronsRight size={13} />}
                </button>
              </Tooltip>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ExpensesPage;
