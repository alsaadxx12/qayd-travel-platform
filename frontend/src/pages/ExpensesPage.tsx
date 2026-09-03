import React, { useState, useMemo, useEffect } from 'react';
import {
  Textarea,
  Modal,
  Switch,
  Tooltip,
  Menu,
} from '@mantine/core';
import {
  Coins,
  Plus,
  Search,
  Printer,
  Wallet,
  TrendingDown,
  DollarSign,
  Receipt,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  ChevronsRight,
  ChevronsLeft,
  AlertCircle,
  Trash2,
  Tag,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  X,
  Pencil,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api/client';
import { employeesApi } from '../api/employees';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { useAdoptedExchangeRate } from '../hooks/useAdoptedExchangeRate';
import { allocateDocumentNumber } from '../utils/sequenceUtils';
import { showSuccessNotification, showErrorNotification } from '../utils/notifications';
import { CurrencySegmentedControl } from '../components/ui/CurrencySegmentedControl';
import { SegmentedDatePicker } from '../components/ui/SegmentedDatePicker';
import { SearchableCombobox } from '../components/ui/SearchableCombobox';
import { FormattedNumberInput } from '../components/common/FormattedNumberInput';

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

const isExpenseLedgerAccount = (account: {
  id?: string;
  type?: string;
  code?: string;
  isParent?: boolean;
} | null | undefined): boolean => {
  if (!account || account.isParent) return false;
  if (account.type === 'EXPENSE') return true;
  const code = String(account.code || '');
  if (!code || code === '3' || code === '4' || code === '5') return false;
  if (['31', '32', '33', '34', '35', '36'].includes(code)) return false;
  return code.startsWith('3') || code.startsWith('5');
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
  const [cashboxAccountId, setCashboxAccountId] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<'IQD' | 'USD'>('USD');
  const [showConversion, setShowConversion] = useState(false);
  const [expenseParentId, setExpenseParentId] = useState<string>('ALL');
  const [exchangeRate, setExchangeRate] = useState<number>(1320);
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionTouched, setDescriptionTouched] = useState(false);
  const [expenseDate, setExpenseDate] = useState<string>(getLocalIsoDate());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [pendingDeleteExpense, setPendingDeleteExpense] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);

  // Sync exchange rate on load
  useEffect(() => {
    if (adoptedEx?.adoptedRate) {
      setExchangeRate(Number(adoptedEx.adoptedRate));
    }
  }, [adoptedEx?.adoptedRate]);

  // 1. Fetch Payment Vouchers (which record expenses)
  const { data: vouchersData = [], isLoading: vouchersLoading, isError: vouchersError, refetch } = useQuery({
    queryKey: ['expenses-vouchers-list'],
    queryFn: () => apiRequest('/api/payment-vouchers?limit=150'),
    staleTime: 30 * 1000,
    retry: 0,
    refetchOnWindowFocus: false,
  });

  // Lite chart of accounts for pickers (names/ids/types only — no balances).
  const { data: accountsData = [] } = useQuery({
    queryKey: ['lite-accounts-list'],
    queryFn: () => apiRequest('/api/accounts?lite=1', { ttl: 120_000 }),
    staleTime: 5 * 60 * 1000,
    retry: 0,
    refetchOnWindowFocus: false,
  });

  // 3. Fetch employees to resolve the logged-in employee's assigned cashbox.
  const { data: employeesData = [] } = useQuery({
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

  const accountChildCount = useMemo(() => {
    const counts = new Map<string, number>();
    if (Array.isArray(accountsData)) {
      accountsData.forEach((account: any) => {
        if (account.parentId) counts.set(account.parentId, (counts.get(account.parentId) || 0) + 1);
      });
    }
    return counts;
  }, [accountsData]);

  // Only postable leaves; group accounts such as "مصاريف" belong in the parent selector.
  const expenseAccounts = useMemo(() => {
    if (!Array.isArray(accountsData)) return [];
    return accountsData.filter(
      (account: any) => isExpenseLedgerAccount(account) && (accountChildCount.get(account.id) || 0) === 0,
    );
  }, [accountsData, accountChildCount]);

  const expenseAccountIds = useMemo(
    () => new Set(expenseAccounts.map((account: { id: string }) => account.id)),
    [expenseAccounts],
  );

  const expenseVouchers = useMemo(() => {
    if (!Array.isArray(vouchersData)) return [];
    return vouchersData.filter((item: any) => {
      const accountId = item.accountId || item.account?.id;
      if (accountId && expenseAccountIds.has(accountId)) return true;
      return isExpenseLedgerAccount(item.account);
    });
  }, [vouchersData, expenseAccountIds]);

  const accountDisplayName = (account: { nameAr?: string; nameEn?: string; name?: string } | null | undefined) => {
    if (!account) return '';
    return isAr
      ? (account.nameAr || account.nameEn || account.name || '')
      : (account.nameEn || account.nameAr || account.name || '');
  };

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

  const expenseComboboxOptions = useMemo(() => {
    return expenseAccounts.map((account: { id: string; nameAr?: string; nameEn?: string; name?: string; parentId?: string }) => {
      const parent = account.parentId ? allAccountsMap.get(account.parentId) : null;
      const label = isAr
        ? (account.nameAr || account.nameEn || account.name || '')
        : (account.nameEn || account.nameAr || account.name || '');
      const parentLabel = parent
        ? (isAr ? (parent.nameAr || parent.nameEn || parent.name || '') : (parent.nameEn || parent.nameAr || parent.name || ''))
        : undefined;
      return {
        value: account.id,
        label,
        subLabel: parentLabel || undefined,
      };
    });
  }, [expenseAccounts, allAccountsMap, isAr]);

  // Every group account inside the expenses branch of the chart of accounts tree.
  const expenseParentOptions = useMemo(() => {
    const allOption = { value: 'ALL', label: isAr ? 'كل بنود المصاريف' : 'All expense items' };
    if (!Array.isArray(accountsData)) return [allOption];

    const groups = (accountsData as any[])
      .filter((account: any) => {
        const code = String(account.code || '');
        const inExpenseBranch = account.type === 'EXPENSE' || code.startsWith('3') || code.startsWith('5');
        const hasChildren = Boolean(account.isParent) || (accountChildCount.get(account.id) || 0) > 0;
        return inExpenseBranch && hasChildren;
      })
      .sort((a: any, b: any) => String(a.code || '').localeCompare(String(b.code || '')));

    return [
      allOption,

      ...groups.map((group: any) => {
        const parent = group.parentId ? allAccountsMap.get(group.parentId) : null;
        return {
          value: group.id,
          label: isAr
            ? (group.nameAr || group.nameEn || group.name || '')
            : (group.nameEn || group.nameAr || group.name || ''),
          subLabel: parent
            ? (isAr
              ? (parent.nameAr || parent.nameEn || parent.name || '')
              : (parent.nameEn || parent.nameAr || parent.name || ''))
            : undefined,
        };
      }),
    ];
  }, [accountsData, allAccountsMap, accountChildCount, isAr]);

  // A group selection includes every level below it, not only its direct children.
  const modalExpenseAccounts = useMemo(() => {
    if (expenseParentId === 'ALL') return expenseAccounts;
    return expenseAccounts.filter((account: { parentId?: string }) => {
      let currentParentId = account.parentId;
      let depth = 0;
      while (currentParentId && depth < 20) {
        if (currentParentId === expenseParentId) return true;
        currentParentId = allAccountsMap.get(currentParentId)?.parentId;
        depth += 1;
      }
      return false;
    });
  }, [expenseAccounts, expenseParentId, allAccountsMap]);

  // Parent group is already shown in the toolbar, so options stay as clean names only.
  const modalExpenseOptions = useMemo(() => {
    const allowed = new Set(modalExpenseAccounts.map((account: { id: string }) => account.id));
    return expenseComboboxOptions
      .filter((option) => allowed.has(option.value))
      .map((option) => ({ value: option.value, label: option.label }));
  }, [expenseComboboxOptions, modalExpenseAccounts]);

  const cashboxComboboxOptions = useMemo(() => {
    return cashboxAccounts.map((account: { id: string; nameAr?: string; nameEn?: string; name?: string }) => ({
      value: account.id,
      label: isAr
        ? (account.nameAr || account.nameEn || account.name || '')
        : (account.nameEn || account.nameAr || account.name || ''),
    }));
  }, [cashboxAccounts, isAr]);

  // Suggested statement, kept in sync until the user writes their own text.
  const suggestedDescription = useMemo(() => {
    const expenseAccount = expenseAccountId ? allAccountsMap.get(expenseAccountId) : null;
    const cashboxAccount = cashboxAccountId ? allAccountsMap.get(cashboxAccountId) : null;
    if (!expenseAccount) return '';

    const expenseName = isAr
      ? (expenseAccount.nameAr || expenseAccount.nameEn || expenseAccount.name || '')
      : (expenseAccount.nameEn || expenseAccount.nameAr || expenseAccount.name || '');
    const cashboxName = cashboxAccount
      ? (isAr
        ? (cashboxAccount.nameAr || cashboxAccount.nameEn || cashboxAccount.name || '')
        : (cashboxAccount.nameEn || cashboxAccount.nameAr || cashboxAccount.name || ''))
      : '';

    const numericAmount = Number(String(amount).replace(/,/g, '')) || 0;
    const amountLabel = numericAmount > 0
      ? `${numericAmount.toLocaleString('en-US')} ${currency}`
      : '';

    if (isAr) {
      return [
        amountLabel ? `صرف مبلغ ${amountLabel}` : 'صرف',
        cashboxName ? `من ${cashboxName}` : '',
        `على بند ${expenseName}`,
      ].filter(Boolean).join(' ');
    }

    return [
      amountLabel ? `Paid ${amountLabel}` : 'Payment',
      cashboxName ? `from ${cashboxName}` : '',
      `for ${expenseName}`,
    ].filter(Boolean).join(' ');
  }, [expenseAccountId, cashboxAccountId, amount, currency, allAccountsMap, isAr]);

  useEffect(() => {
    if (!createModalOpen || descriptionTouched || !suggestedDescription) return;
    setDescription(suggestedDescription);
  }, [createModalOpen, descriptionTouched, suggestedDescription]);

  const frequentExpenseAccounts = useMemo(() => {
    const usage = new Map<string, number>();
    expenseVouchers.forEach((item: { accountId?: string; account?: { id?: string } }) => {
      const id = item.accountId || item.account?.id;
      if (id && expenseAccountIds.has(id)) usage.set(id, (usage.get(id) || 0) + 1);
    });

    return [...usage.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => expenseAccounts.find((account: { id: string }) => account.id === id))
      .filter((account): account is NonNullable<typeof account> => Boolean(account))
      .slice(0, 8);
  }, [expenseVouchers, expenseAccounts, expenseAccountIds]);

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
    if (modalExpenseAccounts.length > 0 && !expenseAccountId) {
      setExpenseAccountId(modalExpenseAccounts[0].id);
    }
  }, [activeExpenseId, assignedEmployeeCashbox, modalExpenseAccounts, expenseAccountId]);

  // Keep the selected expense item consistent with the chosen parent group.
  useEffect(() => {
    if (!expenseAccountId || expenseParentId === 'ALL') return;
    const stillAllowed = modalExpenseAccounts.some((account: { id: string }) => account.id === expenseAccountId);
    if (!stillAllowed) setExpenseAccountId('');
  }, [expenseParentId, modalExpenseAccounts, expenseAccountId]);

  // Mirror the chart of accounts: the parent group follows the selected expense item.
  useEffect(() => {
    if (!expenseAccountId) return;
    const parentId = allAccountsMap.get(expenseAccountId)?.parentId;
    if (parentId && parentId !== expenseParentId) setExpenseParentId(parentId);
  }, [expenseAccountId, allAccountsMap, expenseParentId]);

  // Filtered Expenses List
  const filteredExpenses = useMemo(() => {
    return expenseVouchers.filter((item: any) => {
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
  }, [expenseVouchers, searchTerm, selectedCategory, selectedCashbox, dateFilter]);

  const navigationExpenses = useMemo(() => {
    const byId = new Map(expenseVouchers.map((item: any) => [item.id, item]));
    return navigationExpenseIds
      .map((id) => byId.get(id))
      .filter(Boolean) as any[];
  }, [navigationExpenseIds, expenseVouchers]);

  // Statistics Calculations
  const stats = useMemo(() => {
    let totalIQD = 0;
    let totalUSD = 0;
    const categoryTotals: Record<string, number> = {};

    filteredExpenses.forEach((exp: any) => {
      const amt = parseFloat(exp.amount) || 0;
      const cur = String(exp.currency || 'IQD').toUpperCase();
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
    setCurrency('USD');
    setExpenseAccountId(expenseAccounts[0]?.id || '');
    setCashboxAccountId(assignedEmployeeCashbox?.id || '');
    setReference('');
    setDescription('');
    setDescriptionTouched(false);
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
    const itemCurrency = String(item.currency || 'IQD').toUpperCase();

    setActiveExpenseId(item.id || null);
    setActiveExpenseNumber(item.voucherNumber || `PV-${String(item.id || '').slice(0, 6)}`);
    setActiveCashboxName(
      item.cashboxOrBankAccount?.nameAr ||
      item.cashboxOrBankAccount?.nameEn ||
      item.cashboxOrBankAccount?.name ||
      ''
    );
    setCurrentExpenseIndex(index);
    setAmount(item.amount != null && item.amount !== '' ? String(Number(item.amount)) : '');
    setCurrency(itemCurrency.includes('USD') || itemCurrency.includes('$') ? 'USD' : 'IQD');
    setExchangeRate(Number(item.exchangeRate) || Number(adoptedEx?.adoptedRate) || exchangeRate);
    setExpenseAccountId(item.accountId || item.account?.id || '');
    setCashboxAccountId(item.cashboxOrBankAccountId || item.cashboxOrBankAccount?.id || '');
    setReference(item.reference || '');
    setDescription(parsedDescription.description);
    setDescriptionTouched(true);
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
      // Invalidate and refresh query list immediately
      queryClient.invalidateQueries({ queryKey: ['expenses-vouchers-list'] });
      showSuccessNotification(
        variables.expenseId
          ? (isAr ? 'تم تحديث قيد المصروف' : 'Expense Updated')
          : (isAr ? 'تم تسجيل المصروف بنجاح' : 'Expense Recorded'),
        variables.expenseId
          ? (isAr ? 'تم حفظ التعديلات وتحديث القيد المحاسبي المرتبط' : 'Changes and linked journal entry were updated')
          : (isAr ? 'تم قيد المصروف في الحسابات وخصمه من صندوق الموظف' : 'Expense booked and deducted from employee cashbox')
      );
      // Close modal immediately and reset state for snappy instant response
      setCreateModalOpen(false);
      resetExpenseForm();
    },
    onError: (err: any) => {
      showErrorNotification(
        isAr ? 'فشل حفظ المصروف' : 'Failed to Save Expense',
        err.message || (isAr ? 'حدث خطأ أثناء حفظ السند' : 'An error occurred')
      );
    },
  });

  const handleApplyFrequentAccount = (account: { id: string; nameAr?: string; nameEn?: string; name?: string }) => {
    setExpenseAccountId(account.id);
    setFormErrors((current) => ({ ...current, expenseAccountId: '' }));
  };

  const deleteExpenseMutation = useMutation({
    mutationFn: async (expenseId: string) =>
      apiRequest(`/api/payment-vouchers/${expenseId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses-vouchers-list'] });
      showSuccessNotification(
        isAr ? 'تم حذف السند' : 'Voucher deleted',
        isAr ? 'تم حذف قيد المصروف وعكس أثره على الأرصدة' : 'The expense entry and its balance effect were reversed',
      );
      setPendingDeleteExpense(null);
    },
    onError: (err: any) => {
      showErrorNotification(
        isAr ? 'تعذر حذف السند' : 'Delete failed',
        err.message || (isAr ? 'حدث خطأ أثناء حذف قيد المصروف' : 'An error occurred while deleting the expense'),
      );
    },
  });

  // ---- Row selection + bulk actions -------------------------------------
  const visibleIds = useMemo(() => filteredExpenses.map((item: any) => String(item.id)), [filteredExpenses]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedExpenses = useMemo(
    () => filteredExpenses.filter((item: any) => selectedSet.has(String(item.id))),
    [filteredExpenses, selectedSet],
  );
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id: string) => selectedSet.has(id));
  const someVisibleSelected = !allVisibleSelected && visibleIds.some((id: string) => selectedSet.has(id));

  // Drop ids that scrolled out of the current filter so the counter never lies.
  useEffect(() => {
    setSelectedIds((current) => {
      const next = current.filter((id) => visibleIds.includes(id));
      return next.length === current.length ? current : next;
    });
  }, [visibleIds]);

  const toggleRowSelection = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds(allVisibleSelected ? [] : visibleIds);
  };

  const clearSelection = () => setSelectedIds([]);

  const buildExportRows = () =>
    selectedExpenses.map((item: any, idx: number) => {
      const parts = splitBeneficiaryFromDescription(item.description);
      const itemDate = new Date(item.date || item.createdAt || Date.now());
      const itemCur = String(item.currency || 'IQD').toUpperCase().includes('USD') ? 'USD' : 'IQD';
      return {
        [isAr ? '#' : 'No.']: idx + 1,
        [isAr ? 'رقم السند' : 'Voucher #']: item.voucherNumber || `PV-${String(item.id).slice(0, 6)}`,
        [isAr ? 'التاريخ' : 'Date']: itemDate.toLocaleDateString('en-GB'),
        [isAr ? 'بند المصروف' : 'Expense account']:
          accountDisplayName(item.account) || (isAr ? 'مصروف عام' : 'General expense'),
        [isAr ? 'البيان' : 'Description']:
          `${parts.beneficiary ? `${parts.beneficiary} · ` : ''}${parts.description || ''}`.trim(),
        [isAr ? 'صندوق الصرف' : 'Paid from']:
          accountDisplayName(item.cashboxOrBankAccount) || (isAr ? 'غير محدد' : 'Unspecified'),
        [isAr ? 'المبلغ' : 'Amount']: parseFloat(String(item.amount)) || 0,
        [isAr ? 'العملة' : 'Currency']: itemCur,
        [isAr ? 'الحالة' : 'Status']:
          item.status === 'POSTED' ? (isAr ? 'مرحّل' : 'Posted') : String(item.status || '—'),
      };
    });

  const selectionTotalsLabel = useMemo(() => {
    const totals = selectedExpenses.reduce(
      (acc: Record<string, number>, item: any) => {
        const cur = String(item.currency || 'IQD').toUpperCase().includes('USD') ? 'USD' : 'IQD';
        acc[cur] = (acc[cur] || 0) + (parseFloat(String(item.amount)) || 0);
        return acc;
      },
      {} as Record<string, number>,
    );
    return Object.entries(totals)
      .map(([cur, value]) => `${value.toLocaleString('en-US')} ${cur}`)
      .join(' + ');
  }, [selectedExpenses]);

  // A standalone print sheet keeps the app chrome out of the paper.
  const buildPrintHtml = () => {
    const rows = buildExportRows();
    if (rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    const title = isAr ? 'كشف سندات المصاريف' : 'Expense vouchers statement';
    const head = headers.map((h) => `<th>${h}</th>`).join('');
    const body = rows
      .map(
        (row) =>
          `<tr>${headers
            .map((h) => {
              const value = (row as any)[h];
              const isNum = typeof value === 'number';
              return `<td class="${isNum ? 'num' : ''}">${
                isNum ? value.toLocaleString('en-US') : String(value ?? '')
              }</td>`;
            })
            .join('')}</tr>`,
      )
      .join('');
    return `<!doctype html><html dir="${isAr ? 'rtl' : 'ltr'}" lang="${isAr ? 'ar' : 'en'}"><head>
<meta charset="utf-8" /><title>${title}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:"Segoe UI",Tahoma,system-ui,sans-serif;margin:24px;color:#0f172a}
  h1{font-size:17px;margin:0 0 4px}
  .meta{font-size:11px;color:#64748b;margin-bottom:14px}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:center}
  th{background:#fff7ed;color:#9a3412;font-weight:700}
  td.num{font-variant-numeric:tabular-nums;font-weight:700}
  tfoot td{background:#f8fafc;font-weight:800}
  @page{size:A4 landscape;margin:12mm}
</style></head><body>
<h1>${title}</h1>
<div class="meta">${isAr ? 'عدد السندات' : 'Vouchers'}: ${rows.length} &nbsp;·&nbsp; ${
      isAr ? 'الإجمالي' : 'Total'
    }: ${selectionTotalsLabel} &nbsp;·&nbsp; ${new Date().toLocaleString('en-GB')}</div>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
</body></html>`;
  };

  const handleBulkPrint = () => {
    const html = buildPrintHtml();
    if (!html) return;
    const win = window.open('', '_blank', 'width=1100,height=760');
    if (!win) {
      showErrorNotification(
        isAr ? 'تعذّرت الطباعة' : 'Print blocked',
        isAr ? 'المتصفح منع فتح نافذة الطباعة، اسمح بالنوافذ المنبثقة.' : 'Allow pop-ups to print.',
      );
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 250);
  };

  const handleBulkExportExcel = async () => {
    const rows = buildExportRows();
    if (rows.length === 0) return;
    setBulkBusy(true);
    try {
      const XLSX = await import('xlsx');
      const sheet = XLSX.utils.json_to_sheet(rows);
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, isAr ? 'المصاريف' : 'Expenses');
      XLSX.writeFile(book, `expenses-${new Date().toISOString().slice(0, 10)}.xlsx`);
      showSuccessNotification(
        isAr ? 'تم التصدير' : 'Exported',
        isAr ? `تم تصدير ${rows.length} سند إلى إكسل` : `${rows.length} vouchers exported to Excel`,
      );
    } catch (err: any) {
      showErrorNotification(
        isAr ? 'تعذّر التصدير' : 'Export failed',
        err?.message || (isAr ? 'حدث خطأ أثناء إنشاء ملف إكسل' : 'Could not build the Excel file'),
      );
    } finally {
      setBulkBusy(false);
    }
  };

  // Arabic shaping breaks in jsPDF's core fonts, so the sheet is rasterised first.
  const handleBulkExportPdf = async () => {
    const html = buildPrintHtml();
    if (!html) return;
    setBulkBusy(true);
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-10000px;top:0;width:1120px;background:#ffffff;z-index:-1;';
    host.setAttribute('dir', isAr ? 'rtl' : 'ltr');
    host.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
    const style = document.createElement('style');
    style.textContent = html.slice(html.indexOf('<style>') + 7, html.indexOf('</style>'));
    host.prepend(style);
    document.body.appendChild(host);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas-pro'),
        import('jspdf'),
      ]);
      const canvas = await html2canvas(host, { scale: 2, backgroundColor: '#ffffff' });
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const image = canvas.toDataURL('image/png');
      let remaining = imgHeight;
      let offset = 0;
      // Slice tall tables across pages instead of squashing them onto one.
      while (remaining > 0) {
        pdf.addImage(image, 'PNG', margin, margin - offset, imgWidth, imgHeight, undefined, 'FAST');
        remaining -= pageHeight - margin * 2;
        offset += pageHeight - margin * 2;
        if (remaining > 0) pdf.addPage();
      }
      pdf.save(`expenses-${new Date().toISOString().slice(0, 10)}.pdf`);
      showSuccessNotification(
        isAr ? 'تم التصدير' : 'Exported',
        isAr ? 'تم إنشاء ملف PDF للسندات المحددة' : 'PDF created for the selected vouchers',
      );
    } catch (err: any) {
      showErrorNotification(
        isAr ? 'تعذّر التصدير' : 'Export failed',
        err?.message || (isAr ? 'حدث خطأ أثناء إنشاء ملف PDF' : 'Could not build the PDF file'),
      );
    } finally {
      host.remove();
      setBulkBusy(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedExpenses.length === 0) return;
    setBulkBusy(true);
    let done = 0;
    const failed: string[] = [];
    for (const item of selectedExpenses) {
      try {
        await apiRequest(`/api/payment-vouchers/${item.id}`, { method: 'DELETE' });
        done += 1;
      } catch {
        failed.push(item.voucherNumber || String(item.id).slice(0, 6));
      }
    }
    queryClient.invalidateQueries({ queryKey: ['expenses-vouchers-list'] });
    setSelectedIds([]);
    setBulkBusy(false);
    setPendingBulkDelete(false);
    if (done > 0) {
      showSuccessNotification(
        isAr ? 'تم الحذف' : 'Deleted',
        isAr ? `تم حذف ${done} سند وعكس أثرها على الأرصدة` : `${done} vouchers deleted`,
      );
    }
    if (failed.length > 0) {
      showErrorNotification(
        isAr ? 'تعذّر حذف بعض السندات' : 'Some deletions failed',
        failed.join(', '),
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
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

    /*
     * رقم سند المصروف يُخصَّص من التسلسل.
     *
     * كانت الصفحة ترسل الحمولة بلا رقم، فيولّده الخادم من عدّاده الاحتياطي
     * (PV-2026-0001) متجاوزاً إعدادات الترقيم كلها — ولهذا ظهرت في بياناتك
     * صيغتان لسندات الدفع. أما التعديل فيحتفظ برقمه ولا يأخذ رقماً جديداً.
     */
    const voucherNumber = activeExpenseId ? undefined : await allocateDocumentNumber('expenses');

    const payload = {
      ...(voucherNumber ? { voucherNumber } : {}),
      date: expenseDate,
      amount: Number(amount),
      currency,
      exchangeRate: currency === 'USD' ? exchangeRate : 1,
      accountId: expenseAccountId,
      cashboxOrBankAccountId: cashboxAccountId,
      reference: reference.trim() || undefined,
      description: description.trim(),
      status: 'POSTED',
    };

    saveExpenseMutation.mutate({ payload, expenseId: activeExpenseId });
  };

  const selectedCashboxAccount: any = Array.isArray(accountsData)
    ? (accountsData as any[]).find((account: any) => account.id === cashboxAccountId)
    : null;
  const selectedCashboxName = accountDisplayName(selectedCashboxAccount) || activeCashboxName || (isAr ? 'صندوق غير محدد' : 'Unspecified cashbox');

  const fieldClassNames = {
    label: '!font-bold !text-slate-800 text-[12.5px] mb-[7px]',
    input: 'h-[46px] rounded-[11px] border-[#E5E7EB] bg-[#FAFAFA] font-semibold',
  };

  return (
    <div className="p-5 md:p-6 space-y-5 max-w-[1750px] mx-auto w-full select-none font-sans" dir={direction}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-orange-50 text-[#F45A0A] border border-orange-200/80 flex items-center justify-center font-bold shadow-xs shrink-0">
            <Coins size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-black text-slate-900 leading-tight tracking-tight">
                {isAr ? 'سجل المصاريف والنثريات' : 'Expenses & Operating Ledger'}
              </h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black font-mono tabular-nums lining-nums bg-orange-50 text-[#F45A0A] border border-orange-200/80">
                <span>{stats.count.toLocaleString('en-US')}</span>
                <span className="text-[11.5px] font-sans font-bold">{isAr ? 'سند' : 'vouchers'}</span>
              </span>
            </div>
            <p className="text-xs font-normal text-slate-500 mt-1">
              {isAr
                ? 'تقييد مصروفات الفرع بالدينار والدولار مع الترحيل المحاسبي الفوري من صندوق الموظف'
                : 'Post branch expenses in IQD and USD with immediate accounting from the employee cashbox'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={vouchersLoading}
            className="h-10 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-2xs disabled:opacity-50"
          >
            <RefreshCw size={15} className={vouchersLoading ? 'animate-spin text-[#F45A0A]' : 'text-slate-500'} />
            <span>{isAr ? 'تحديث' : 'Refresh'}</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="h-10 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-2xs"
          >
            <Printer size={15} className="text-slate-500" />
            <span>{isAr ? 'طباعة' : 'Print'}</span>
          </button>
          <button
            type="button"
            onClick={openNewExpense}
            className="h-10 px-4 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer hover:shadow-md"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>{isAr ? 'مصروف جديد' : 'New Expense'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 block mb-1">{isAr ? 'إجمالي المصاريف (IQD)' : 'Total Expenses (IQD)'}</span>
            <span className="text-xl font-extrabold font-mono tabular-nums lining-nums text-slate-900 block">
              {stats.totalIQD.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              <span className="text-xs font-sans text-[#F45A0A] mx-1.5">IQD</span>
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-orange-50 text-[#F45A0A] flex items-center justify-center border border-orange-200">
            <Coins size={20} />
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 block mb-1">{isAr ? 'إجمالي المصاريف (USD)' : 'Total Expenses (USD)'}</span>
            <span className="text-xl font-extrabold font-mono tabular-nums lining-nums text-slate-900 block">
              {stats.totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-xs font-sans text-[#F45A0A] mx-1.5">USD</span>
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-orange-50 text-[#F45A0A] flex items-center justify-center border border-orange-200">
            <DollarSign size={20} />
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-500 block mb-1">{isAr ? 'أعلى بند صرف' : 'Top Expense Item'}</span>
            <span className="text-sm font-extrabold text-slate-800 truncate block" title={stats.topCategory}>{stats.topCategory}</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-orange-50 text-[#F45A0A] flex items-center justify-center border border-orange-200 shrink-0">
            <TrendingDown size={20} />
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 block mb-1">{isAr ? 'عدد العمليات المسجلة' : 'Recorded Vouchers'}</span>
            <span className="text-xl font-extrabold font-mono tabular-nums lining-nums text-slate-900 block">
              {stats.count.toLocaleString('en-US')}
              <span className="text-xs font-sans text-slate-500 ms-1">{isAr ? 'سند' : 'entries'}</span>
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-orange-50 text-[#F45A0A] flex items-center justify-center border border-orange-200">
            <Receipt size={20} />
          </div>
        </div>
      </div>

      {vouchersError && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{isAr ? 'تعذر تحميل سجل المصاريف من الخادم.' : 'Could not load the expenses ledger from the server.'}</span>
          </div>
          <button type="button" onClick={() => refetch()} className="h-8 px-3 rounded-xl bg-white border border-red-200 text-red-700 font-bold cursor-pointer">
            {isAr ? 'إعادة المحاولة' : 'Retry'}
          </button>
        </div>
      )}

      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search size={15} className="absolute top-1/2 -translate-y-1/2 start-3.5 text-slate-400 pointer-events-none" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={isAr ? 'بحث برقم السند أو البيان أو اسم الحساب...' : 'Search voucher, description, or account...'}
              className="w-full h-[46px] ps-10 pe-3.5 rounded-[11px] border border-[#E5E7EB] bg-[#FAFAFA] hover:bg-white focus:bg-white focus:border-[#F45A0A] outline-none text-sm font-medium"
            />
          </div>
          <div className="w-full sm:w-56">
            <SearchableCombobox
              value={selectedCategory}
              onChange={(val) => setSelectedCategory(val || 'ALL')}
              options={[
                { value: 'ALL', label: isAr ? 'كل بنود المصاريف' : 'All categories' },
                ...expenseComboboxOptions,
              ]}
              placeholder={isAr ? 'كل بنود المصاريف' : 'All categories'}
              clearable={false}
            />
          </div>
          <div className="w-full sm:w-52">
            <SearchableCombobox
              value={selectedCashbox}
              onChange={(val) => setSelectedCashbox(val || 'ALL')}
              options={[
                { value: 'ALL', label: isAr ? 'كل الصناديق والبنوك' : 'All cashboxes' },
                ...cashboxComboboxOptions,
              ]}
              placeholder={isAr ? 'كل الصناديق' : 'All cashboxes'}
              clearable={false}
            />
          </div>
          <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-200">
            {([
              { id: 'TODAY' as const, label: isAr ? 'اليوم' : 'Today' },
              { id: 'WEEK' as const, label: isAr ? 'الأسبوع' : 'Week' },
              { id: 'MONTH' as const, label: isAr ? 'الشهر' : 'Month' },
              { id: 'ALL' as const, label: isAr ? 'الكل' : 'All' },
            ]).map((period) => (
              <button
                key={period.id}
                type="button"
                onClick={() => setDateFilter(period.id)}
                className={`h-8 px-3 text-xs font-bold rounded-lg cursor-pointer ${
                  dateFilter === period.id ? 'bg-white text-[#C2410C] border border-orange-200 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt size={18} className="text-[#F45A0A]" />
            <span className="font-extrabold text-slate-900 text-sm">
              {isAr ? 'قائمة سندات المصاريف' : 'Expense vouchers'}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-black font-mono tabular-nums lining-nums bg-orange-50 text-[#F45A0A] border border-orange-200">
              {filteredExpenses.length.toLocaleString('en-US')}
            </span>
          </div>

          {selectedIds.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-orange-50 text-[#C2410C] border border-orange-200 font-mono tabular-nums lining-nums font-black">
                  {selectedIds.length.toLocaleString('en-US')}
                </span>
                <span>{isAr ? 'محدد' : 'selected'}</span>
              </span>

              <Menu shadow="md" width={200} position={isAr ? 'bottom-start' : 'bottom-end'} withinPortal>
                <Menu.Target>
                  <button
                    type="button"
                    disabled={bulkBusy}
                    className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-[#F45A0A] hover:bg-[#DC4F09] text-white text-xs font-extrabold shadow-xs cursor-pointer disabled:opacity-60"
                  >
                    {bulkBusy ? <RefreshCw size={13} className="animate-spin" /> : <Coins size={13} />}
                    {isAr ? 'إجراءات' : 'Actions'}
                    <ChevronDown size={13} />
                  </button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>
                    {isAr ? `${selectedIds.length} سند محدد` : `${selectedIds.length} selected`}
                  </Menu.Label>
                  <Menu.Item
                    leftSection={<Printer size={14} />}
                    onClick={handleBulkPrint}
                    disabled={bulkBusy}
                  >
                    {isAr ? 'طباعة' : 'Print'}
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<FileSpreadsheet size={14} />}
                    onClick={handleBulkExportExcel}
                    disabled={bulkBusy}
                  >
                    {isAr ? 'استخراج إكسل' : 'Export Excel'}
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<FileText size={14} />}
                    onClick={handleBulkExportPdf}
                    disabled={bulkBusy}
                  >
                    {isAr ? 'استخراج PDF' : 'Export PDF'}
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item
                    color="red"
                    leftSection={<Trash2 size={14} />}
                    onClick={() => setPendingBulkDelete(true)}
                    disabled={bulkBusy}
                  >
                    {isAr ? 'حذف' : 'Delete'}
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>

              <Tooltip label={isAr ? 'إلغاء التحديد' : 'Clear selection'}>
                <button
                  type="button"
                  onClick={clearSelection}
                  disabled={bulkBusy}
                  className="h-8 w-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 flex items-center justify-center cursor-pointer disabled:opacity-40"
                  aria-label={isAr ? 'إلغاء التحديد' : 'Clear selection'}
                >
                  <X size={14} />
                </button>
              </Tooltip>
            </div>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-start border-collapse text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[11.5px]">
              <tr>
                <th className="p-3 text-center w-14">
                  <Switch
                    size="xs"
                    color="orange"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    disabled={visibleIds.length === 0}
                    aria-label={isAr ? 'تحديد كل الأسطر' : 'Select all rows'}
                    styles={{ track: { cursor: visibleIds.length === 0 ? 'not-allowed' : 'pointer' } }}
                  />
                </th>
                <th className="p-3 text-center w-12 font-mono tabular-nums lining-nums">#</th>
                <th className="p-3 text-center">{isAr ? 'رقم السند' : 'Voucher #'}</th>
                <th className="p-3 text-center">{isAr ? 'التاريخ' : 'Date'}</th>
                <th className="p-3 text-center">{isAr ? 'بند المصروف' : 'Expense account'}</th>
                <th className="p-3 text-center">{isAr ? 'البيان' : 'Description'}</th>
                <th className="p-3 text-center">{isAr ? 'صندوق الصرف' : 'Paid from'}</th>
                <th className="p-3 text-center">{isAr ? 'المبلغ' : 'Amount'}</th>
                <th className="p-3 text-center">{isAr ? 'الحالة' : 'Status'}</th>
                <th className="p-3 text-center w-28">{isAr ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vouchersLoading && filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-10 text-center text-slate-500 font-medium">
                    <RefreshCw size={18} className="inline-block animate-spin text-[#F45A0A] me-2" />
                    {isAr ? 'جارٍ تحميل السجل...' : 'Loading ledger...'}
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center">
                    <div className="max-w-xs mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center mx-auto text-[#F45A0A]">
                        <Coins size={22} />
                      </div>
                      <p className="text-sm font-extrabold text-slate-800">
                        {isAr ? 'لا توجد مصاريف مطابقة' : 'No matching expenses'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {isAr ? 'ابدأ بتسجيل مصروف جديد من الزر أعلاه.' : 'Start by recording a new expense.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((item: { id: string; amount?: number | string; currency?: string; date?: string; createdAt?: string; voucherNumber?: string; reference?: string; description?: string; status?: string; exchangeRate?: number | string; account?: { nameAr?: string; nameEn?: string; name?: string }; cashboxOrBankAccount?: { nameAr?: string; nameEn?: string; name?: string } }, idx: number) => {
                  const amt = parseFloat(String(item.amount)) || 0;
                  const itemCur = String(item.currency || 'IQD').toUpperCase().includes('USD') ? 'USD' : 'IQD';
                  const itemDate = new Date(item.date || item.createdAt || Date.now());
                  const descParts = splitBeneficiaryFromDescription(item.description);

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        selectedSet.has(String(item.id)) ? 'bg-orange-50/70' : 'hover:bg-orange-50/30'
                      }`}
                    >
                      <td className="p-3 text-center">
                        <Switch
                          size="xs"
                          color="orange"
                          checked={selectedSet.has(String(item.id))}
                          onChange={() => toggleRowSelection(String(item.id))}
                          aria-label={isAr ? `تحديد السند ${item.voucherNumber || ''}` : `Select ${item.voucherNumber || 'voucher'}`}
                          styles={{ track: { cursor: 'pointer' } }}
                        />
                      </td>
                      <td className="p-3 text-center text-slate-400 font-mono font-extrabold tabular-nums lining-nums">{(idx + 1).toLocaleString('en-US')}</td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => openExpenseRecord(item)}
                          title={isAr ? 'فتح وتعديل القيد' : 'Open & edit record'}
                          className="font-mono font-extrabold tabular-nums lining-nums text-slate-900 hover:text-[#F45A0A] hover:underline underline-offset-2 cursor-pointer"
                        >
                          {item.voucherNumber || `PV-${String(item.id).slice(0, 6)}`}
                        </button>
                        {item.reference ? (
                          <span className="block text-[10px] text-slate-400 font-semibold">{item.reference}</span>
                        ) : null}
                      </td>
                      <td className="p-3 text-center font-mono font-extrabold tabular-nums lining-nums text-[11px] text-slate-600 whitespace-nowrap">
                        {itemDate.toLocaleDateString('en-GB')}
                      </td>
                      <td className="p-3 text-center">
                        <span className="inline-flex items-center justify-center gap-1.5 font-bold text-slate-900">
                          <Tag size={13} className="text-[#F45A0A] shrink-0" />
                          <span>{accountDisplayName(item.account) || (isAr ? 'مصروف عام' : 'General expense')}</span>
                        </span>
                      </td>
                      <td className="p-3 text-center max-w-[280px]">
                        <p className="text-slate-700 font-medium truncate" title={descParts.description || item.description}>
                          {descParts.beneficiary ? `${descParts.beneficiary} · ` : ''}
                          {descParts.description || '—'}
                        </p>
                      </td>
                      <td className="p-3 text-center">
                        <span className="inline-flex items-center justify-center gap-1.5 text-slate-700 font-medium">
                          <Wallet size={13} className="text-[#F45A0A] shrink-0" />
                          <span>{accountDisplayName(item.cashboxOrBankAccount) || (isAr ? 'صندوق غير محدد' : 'Unspecified cashbox')}</span>
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className="font-mono font-extrabold tabular-nums lining-nums text-sm text-slate-900 block">
                          {amt.toLocaleString('en-US')}
                          <span className="text-[11px] text-[#F45A0A] mx-1.5">{itemCur}</span>
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold border ${
                          item.status === 'POSTED'
                            ? 'bg-orange-50 text-[#C2410C] border-orange-200'
                            : item.status === 'CANCELLED'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}>
                          {item.status === 'POSTED' ? (isAr ? 'مرحّل' : 'Posted') : (item.status || '—')}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Tooltip label={isAr ? 'تعديل السند' : 'Edit voucher'} withArrow>
                            <button
                              type="button"
                              onClick={() => openExpenseRecord(item)}
                              className="h-8 px-2.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-[#F45A0A] font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors border border-orange-200 shadow-2xs"
                            >
                              <Pencil size={13} />
                              <span>{isAr ? 'تعديل' : 'Edit'}</span>
                            </button>
                          </Tooltip>
                          <Tooltip label={isAr ? 'حذف السند' : 'Delete voucher'} withArrow>
                            <button
                              type="button"
                              onClick={() => setPendingDeleteExpense(item)}
                              className="h-8 w-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center cursor-pointer transition-colors border border-rose-200 shadow-2xs shrink-0"
                            >
                              <Trash2 size={13} />
                            </button>
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

      <Modal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        transitionProps={{ duration: 0 }}
        title={
          <div className="flex items-center gap-3 pe-8" dir={direction}>
            <div className="w-11 h-11 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F45A0A] shrink-0">
              <Coins size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-[15px] text-slate-900 leading-tight truncate">
                {activeExpenseId
                  ? (isAr ? 'تعديل قيد المصروف' : 'Edit expense')
                  : (isAr ? 'تسجيل مصروف جديد' : 'New expense')}
              </h3>
              <p className="text-[11.5px] text-slate-500 font-medium mt-0.5 truncate">
                {activeExpenseId
                  ? (isAr ? `السند ${activeExpenseNumber} · ${selectedCashboxName}` : `${activeExpenseNumber} · ${selectedCashboxName}`)
                  : (isAr ? 'قيد مباشر على حساب المصروف وصندوق الصرف' : 'Posted against the expense account and cashbox')}
              </p>
            </div>
          </div>
        }
        size="1040px"
        padding={0}
        radius="16px"
        dir={direction}
        centered
        closeOnClickOutside={!saveExpenseMutation.isPending}
        closeOnEscape={!saveExpenseMutation.isPending}
        styles={{
          inner: { padding: '24px 16px', overflow: 'visible' },
          content: {
            width: 'min(1040px, 96vw)',
            maxWidth: '96vw',
            minHeight: 'min(640px, 90dvh)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'visible',
            border: '1px solid #e2e8f0',
          },
          header: { minHeight: '64px', padding: '12px 18px', borderBottom: '1px solid #e2e8f0' },
          body: { padding: 0, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'visible' },
        }}
      >
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-visible" dir={direction}>
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-[#FAFAFA] px-5 py-3">
            <div className="flex items-center gap-2 shrink-0">
              <Switch
                size="md"
                color="orange"
                checked={showConversion}
                onChange={(event) => setShowConversion(event.currentTarget.checked)}
                aria-label={isAr ? 'إظهار الصرافة' : 'Show conversion'}
              />
              <span className={`text-[11.5px] font-extrabold ${showConversion ? 'text-[#F45A0A]' : 'text-slate-500'}`}>
                {isAr ? 'الصرافة' : 'Conversion'}
              </span>
            </div>

            <div className="hidden sm:block h-7 w-px bg-slate-200" />

            <div className="flex items-center gap-2 min-w-[240px] flex-1">
              <span className="text-[11.5px] font-extrabold text-slate-500 shrink-0">
                {isAr ? 'صندوق الصرف' : 'Cashbox'}
              </span>
              <div className="min-w-0 flex-1">
                <SearchableCombobox
                  value={cashboxAccountId}
                  onChange={(v) => {
                    if (v) {
                      setCashboxAccountId(v);
                      setFormErrors((current) => ({ ...current, cashboxAccountId: '' }));
                    }
                  }}
                  options={cashboxComboboxOptions}
                  placeholder={isAr ? 'اختر صندوق الصرف...' : 'Select cashbox...'}
                  error={formErrors.cashboxAccountId}
                  clearable={false}
                  maxRendered={6}
                  maxListHeight={168}
                  leftIcon={<Wallet size={15} />}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 min-w-[240px] flex-1">
              <span className="text-[11.5px] font-extrabold text-slate-500 shrink-0">
                {isAr ? 'حساب أب المصاريف' : 'Parent account'}
              </span>
              <div className="min-w-0 flex-1">
                <SearchableCombobox
                  value={expenseParentId}
                  onChange={(v) => setExpenseParentId(v || 'ALL')}
                  options={expenseParentOptions}
                  placeholder={isAr ? 'كل بنود المصاريف' : 'All expense items'}
                  clearable={false}
                  maxRendered={12}
                  maxListHeight={240}
                  leftIcon={<Coins size={15} />}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col overflow-visible p-5 gap-4">
            {frequentExpenseAccounts.length > 0 && (
            <div>
              <p className="text-[11px] font-extrabold text-slate-500 mb-2">{isAr ? 'الأكثر استعمالاً' : 'Most used'}</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                  {frequentExpenseAccounts.map((account: { id: string; nameAr?: string; nameEn?: string; name?: string }) => {
                    const active = expenseAccountId === account.id;
                    const label = isAr
                      ? (account.nameAr || account.nameEn || account.name || '')
                      : (account.nameEn || account.nameAr || account.name || '');
                    return (
                      <button
                        key={account.id}
                        type="button"
                        onClick={() => handleApplyFrequentAccount(account)}
                        className={`flex items-center gap-1.5 h-9 px-3 rounded-xl border text-[11.5px] font-bold cursor-pointer ${
                          active
                            ? 'bg-[#F45A0A] text-white border-[#F45A0A]'
                            : 'border-slate-200 bg-white hover:bg-orange-50 hover:border-orange-200 hover:text-[#C2410C] text-slate-700'
                        }`}
                      >
                        <Coins size={13} className={active ? 'text-white' : 'text-[#F45A0A]'} />
                        <span>{label}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
            )}

            <SearchableCombobox
              label={isAr ? 'بند المصروف' : 'Expense item'}
              required
              value={expenseAccountId}
              onChange={(v) => {
                setExpenseAccountId(v);
                setFormErrors((current) => ({ ...current, expenseAccountId: '' }));
              }}
              options={modalExpenseOptions}
              placeholder={isAr ? 'ابحث باسم بند المصروف...' : 'Search expense item...'}
              error={formErrors.expenseAccountId}
              clearable={false}
              maxRendered={6}
              maxListHeight={168}
            />

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-7">
              <FormattedNumberInput
                label={isAr ? 'المبلغ' : 'Amount'}
                required
                value={amount}
                onChange={(val) => {
                  setAmount(val);
                  setFormErrors((current) => ({ ...current, amount: '' }));
                }}
                placeholder={currency === 'IQD' ? '25,000' : '50.00'}
                error={formErrors.amount}
                styles={{
                  input: {
                    height: 48,
                    minHeight: 48,
                    textAlign: 'center',
                    fontSize: 26,
                    fontWeight: 800,
                    lineHeight: 1,
                    letterSpacing: '-0.02em',
                  },
                }}
                classNames={{
                  ...fieldClassNames,
                  input: 'rounded-[12px] border-[#E5E7EB] bg-[#FAFAFA] font-mono tabular-nums lining-nums text-slate-900',
                }}
              />
              </div>
              <div className="md:col-span-5 flex items-end gap-2 min-w-0">
                <CurrencySegmentedControl
                  value={currency}
                  onChange={(val) => setCurrency(val === 'USD' ? 'USD' : 'IQD')}
                  showAllOption={false}
                  height="h-[48px]"
                  className="shrink-0 [&_[role=radiogroup]]:!w-[148px]"
                />
                <div className="min-w-0 flex-1">
                  <SegmentedDatePicker
                    label={isAr ? 'تاريخ المصروف' : 'Expense date'}
                    required
                    value={expenseDate}
                    onChange={(_date, isoString) => {
                      setExpenseDate(isoString);
                      setFormErrors((current) => ({ ...current, expenseDate: '' }));
                    }}
                    clearable={false}
                    dropdownPosition="bottom"
                    error={formErrors.expenseDate}
                    className="[&>label]:!text-[12.5px] [&>label]:!font-bold [&>label]:!text-slate-800 [&>label]:!mb-[7px] [&_.custom-seg-picker]:!rounded-[12px] [&_.custom-seg-picker]:!bg-[#FAFAFA] [&_.custom-seg-picker]:!border-[#E5E7EB]"
                  />
                </div>
              </div>
            </div>

            {showConversion && (
              <p dir="ltr" className="text-[11.5px] font-mono font-extrabold tabular-nums lining-nums text-slate-600 text-start">
                {currency === 'USD'
                  ? `100 USD = ${(exchangeRate * 100).toLocaleString('en-US')} IQD · ${(Number(amount) || 0).toLocaleString('en-US')} USD ≈ ${Math.round((Number(amount) || 0) * exchangeRate).toLocaleString('en-US')} IQD`
                  : `100 USD = ${(exchangeRate * 100).toLocaleString('en-US')} IQD · ${(Number(amount) || 0).toLocaleString('en-US')} IQD ≈ ${((Number(amount) || 0) / (exchangeRate || 1)).toLocaleString('en-US', { maximumFractionDigits: 2 })} USD`}
              </p>
            )}

            <div className="flex flex-1 flex-col min-h-[140px]">
              <Textarea
                label={isAr ? 'البيان وتفاصيل المصروف' : 'Description'}
                placeholder={isAr ? 'اكتب سبب الصرف وأي ملاحظات تدقيقية...' : 'Enter purpose and audit notes...'}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setDescriptionTouched(true);
                  setFormErrors((current) => ({ ...current, description: '' }));
                }}
                required
                error={formErrors.description}
                styles={{
                  root: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 },
                  wrapper: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 },
                  input: {
                    flex: 1,
                    height: '100%',
                    minHeight: 0,
                    resize: 'none',
                    fontSize: 15,
                    fontWeight: 700,
                  },
                }}
                classNames={{
                  label: fieldClassNames.label,
                  input: 'rounded-[12px] border-[#E5E7EB] bg-[#FAFAFA] text-slate-900',
                }}
              />
            </div>
          </div>

          <div className="mt-auto sticky bottom-0 z-20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-slate-200 bg-white px-5 py-3 rounded-b-[16px]">
            <div className="flex items-center gap-0.5 rounded-xl border border-slate-200 bg-slate-50 p-1 shrink-0">
              <Tooltip label={isAr ? 'أول قيد' : 'First'}>
                <button type="button" onClick={handleNavigateFirst} disabled={navigationExpenses.length === 0 || currentExpenseIndex === 0 || saveExpenseMutation.isPending} className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-white hover:text-[#F45A0A] disabled:opacity-30 cursor-pointer">
                  {direction === 'rtl' ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
                </button>
              </Tooltip>
              <Tooltip label={isAr ? 'السابق' : 'Prev'}>
                <button type="button" onClick={handleNavigatePrevious} disabled={currentExpenseIndex <= 0 || saveExpenseMutation.isPending} className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-white hover:text-[#F45A0A] disabled:opacity-30 cursor-pointer">
                  {direction === 'rtl' ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>
              </Tooltip>
              <span className="h-8 min-w-[80px] px-2 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-mono text-[11px] font-extrabold tabular-nums lining-nums text-slate-700" dir="ltr">
                {activeExpenseNumber || (isAr ? 'جديد' : 'New')}
              </span>
              <Tooltip label={isAr ? 'التالي' : 'Next'}>
                <button type="button" onClick={handleNavigateNext} disabled={navigationExpenses.length === 0 || currentExpenseIndex >= navigationExpenses.length - 1 || saveExpenseMutation.isPending} className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-white hover:text-[#F45A0A] disabled:opacity-30 cursor-pointer">
                  {direction === 'rtl' ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
                </button>
              </Tooltip>
              <Tooltip label={isAr ? 'آخر قيد' : 'Last'}>
                <button type="button" onClick={handleNavigateLast} disabled={navigationExpenses.length === 0 || currentExpenseIndex >= navigationExpenses.length - 1 || saveExpenseMutation.isPending} className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-white hover:text-[#F45A0A] disabled:opacity-30 cursor-pointer">
                  {direction === 'rtl' ? <ChevronsLeft size={14} /> : <ChevronsRight size={14} />}
                </button>
              </Tooltip>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={saveExpenseMutation.isPending}
                onClick={() => setCreateModalOpen(false)}
                className="h-11 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-semibold text-xs cursor-pointer disabled:opacity-50"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={saveExpenseMutation.isPending}
                className="h-11 px-5 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-bold text-xs shadow-xs cursor-pointer disabled:opacity-50"
              >
                {saveExpenseMutation.isPending
                  ? (isAr ? 'جارٍ الحفظ...' : 'Saving...')
                  : activeExpenseId
                    ? (isAr ? 'حفظ التعديلات' : 'Save changes')
                    : (isAr ? 'حفظ وترحيل المصروف' : 'Save & post')}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        opened={Boolean(pendingDeleteExpense)}
        onClose={() => {
          if (!deleteExpenseMutation.isPending) setPendingDeleteExpense(null);
        }}
        transitionProps={{ duration: 0 }}
        title={
          <div className="flex items-center gap-3 pe-8" dir={direction}>
            <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 shrink-0">
              <Trash2 size={18} />
            </div>
            <h3 className="font-extrabold text-[14.5px] text-slate-900">
              {isAr ? 'حذف قيد المصروف' : 'Delete expense'}
            </h3>
          </div>
        }
        size="460px"
        radius="16px"
        centered
        dir={direction}
        closeOnClickOutside={!deleteExpenseMutation.isPending}
        closeOnEscape={!deleteExpenseMutation.isPending}
      >
        <div className="space-y-4" dir={direction}>
          <p className="text-[13px] font-semibold text-slate-700 leading-relaxed">
            {isAr
              ? 'سيتم حذف السند مع القيد المحاسبي المرتبط به وعكس أثره على أرصدة الحسابات. لا يمكن التراجع عن هذا الإجراء.'
              : 'The voucher and its linked journal entry will be deleted and account balances reversed. This cannot be undone.'}
          </p>

          {pendingDeleteExpense && (
            <div className="rounded-xl border border-slate-200 bg-[#FAFAFA] px-3 py-2.5 space-y-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11.5px] font-bold text-slate-500">{isAr ? 'رقم السند' : 'Voucher'}</span>
                <span className="font-mono text-[12px] font-extrabold tabular-nums lining-nums text-slate-900" dir="ltr">
                  {pendingDeleteExpense.voucherNumber || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11.5px] font-bold text-slate-500">{isAr ? 'المبلغ' : 'Amount'}</span>
                <span className="font-mono text-[12px] font-extrabold tabular-nums lining-nums text-slate-900" dir="ltr">
                  {(Number(pendingDeleteExpense.amount) || 0).toLocaleString('en-US')}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11.5px] font-bold text-slate-500">{isAr ? 'بند المصروف' : 'Expense item'}</span>
                <span className="text-[12px] font-bold text-slate-900 truncate max-w-[220px]">
                  {accountDisplayName(pendingDeleteExpense.account) || '—'}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={deleteExpenseMutation.isPending}
              onClick={() => setPendingDeleteExpense(null)}
              className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-semibold text-xs cursor-pointer disabled:opacity-50"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              disabled={deleteExpenseMutation.isPending}
              onClick={() => {
                if (pendingDeleteExpense?.id) deleteExpenseMutation.mutate(pendingDeleteExpense.id);
              }}
              className="h-10 px-5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs cursor-pointer disabled:opacity-50"
            >
              {deleteExpenseMutation.isPending
                ? (isAr ? 'جارٍ الحذف...' : 'Deleting...')
                : (isAr ? 'تأكيد الحذف' : 'Delete')}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        opened={pendingBulkDelete}
        onClose={() => {
          if (!bulkBusy) setPendingBulkDelete(false);
        }}
        transitionProps={{ duration: 0 }}
        title={
          <div className="flex items-center gap-3 pe-8" dir={direction}>
            <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 shrink-0">
              <Trash2 size={18} />
            </div>
            <h3 className="font-extrabold text-[14.5px] text-slate-900">
              {isAr ? 'حذف السندات المحددة' : 'Delete selected vouchers'}
            </h3>
          </div>
        }
        size="460px"
        radius="16px"
        centered
        dir={direction}
        closeOnClickOutside={!bulkBusy}
        closeOnEscape={!bulkBusy}
      >
        <div className="space-y-4" dir={direction}>
          <p className="text-[13px] font-semibold text-slate-700 leading-relaxed">
            {isAr
              ? `سيتم حذف ${selectedExpenses.length} سند مع القيود المحاسبية المرتبطة بها وعكس أثرها على أرصدة الحسابات. لا يمكن التراجع عن هذا الإجراء.`
              : `${selectedExpenses.length} vouchers and their linked journal entries will be deleted and balances reversed. This cannot be undone.`}
          </p>

          <div className="rounded-xl border border-slate-200 bg-[#FAFAFA] px-3 py-2.5 space-y-1 max-h-[190px] overflow-y-auto">
            {selectedExpenses.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between gap-3">
                <span className="text-[12px] font-bold text-slate-700 truncate max-w-[220px]">
                  {accountDisplayName(item.account) || (isAr ? 'مصروف عام' : 'General expense')}
                </span>
                <span className="font-mono text-[12px] font-extrabold tabular-nums lining-nums text-slate-900" dir="ltr">
                  {(Number(item.amount) || 0).toLocaleString('en-US')}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2">
            <span className="text-[11.5px] font-bold text-[#9A3412]">{isAr ? 'الإجمالي' : 'Total'}</span>
            <span className="font-mono text-[12px] font-extrabold tabular-nums lining-nums text-[#9A3412]" dir="ltr">
              {selectionTotalsLabel || '—'}
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => setPendingBulkDelete(false)}
              className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-semibold text-xs cursor-pointer disabled:opacity-50"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={handleBulkDelete}
              className="h-10 px-5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs cursor-pointer disabled:opacity-50"
            >
              {bulkBusy ? (isAr ? 'جارٍ الحذف...' : 'Deleting...') : (isAr ? 'تأكيد الحذف' : 'Delete')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ExpensesPage;
