import { useVirtualizer } from '@tanstack/react-virtual';
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  RefreshCw,
  Printer,
  Plus,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  FileCode,
  Eye,
  Edit,
  Copy,
  Trash2,
  FilterX,
  FileSpreadsheet,
  FileUp,
  ListTree,
  MoreVertical,
  Lock,
  Columns,
  Check,
  Building,
  Tag,
  CreditCard,
  Wallet,
  Coins,
  FileText,
} from 'lucide-react';
import { Menu, Checkbox, Tooltip, Modal, Select } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { SmartAccountWizardModal } from '../accounts/SmartAccountWizardModal';
import { accountsApi } from '../../api/accounts';
import { branchesApi, type Branch } from '../../api/branches';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguageStore } from '../../store/useLanguageStore';

export interface ColumnConfig {
  code: boolean;
  name: boolean;
  nameEn: boolean;
  type: boolean;
  nature: boolean;
  classification: boolean;
  dealingType: boolean;
  creditLimit: boolean;
  paymentDays: boolean;
  overduePolicy: boolean;
  currency: boolean;
  debitIQD: boolean;
  creditIQD: boolean;
  balanceIQD: boolean;
  debitUSD: boolean;
  creditUSD: boolean;
  balanceUSD: boolean;
  status: boolean;
  actions: boolean;
}

const DEFAULT_COLUMNS: ColumnConfig = {
  code: true,
  name: true,
  nameEn: false,
  type: true,
  nature: true,
  classification: true,
  dealingType: false,
  creditLimit: false,
  paymentDays: false,
  overduePolicy: false,
  currency: true,
  debitIQD: false,
  creditIQD: false,
  balanceIQD: true,
  debitUSD: false,
  creditUSD: false,
  balanceUSD: true,
  status: true,
  actions: true,
};

export interface AccountNode {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  type: string;
  nature: 'DEBIT' | 'CREDIT';
  parentId?: string;
  level: number;
  isGroup: boolean;
  scope: string;
  currency: string;
  branchIds?: string[];
  debitIQD?: number;
  creditIQD?: number;
  balanceIQD?: number;
  debitUSD?: number;
  creditUSD?: number;
  balanceUSD?: number;
  debit: number;
  credit: number;
  balance: number;
  status: 'نشط' | 'معطل';
  category?: string;
  accountRole?: 'CUSTOMER' | 'SUPPLIER' | 'BOTH' | 'GENERAL';
  isBlocked?: boolean;
  customer?: any;
  supplier?: any;
  phone?: string;
  email?: string;
  address?: string;
  contactPerson?: string;
  creditLimit?: number;
  creditLimitUSD?: number;
  paymentDays?: number;
  paymentMode?: 'CASH_ONLY' | 'CREDIT_ALLOWED';
  overduePolicy?: string;
  children?: AccountNode[];
}

interface AccountingTreeGridProps {
  accounts: AccountNode[];
  loading?: boolean;
  onRefresh?: () => void;
  onAddAccount?: () => void;
  onRowDoubleClick?: (account: AccountNode) => void;
  onSelectAccount?: (account: AccountNode) => void;
}

export const AccountingTreeGrid: React.FC<AccountingTreeGridProps> = ({
  accounts = [],
  loading = false,
  onRefresh,
  onAddAccount,
  onRowDoubleClick,
  onSelectAccount,
}) => {
  const navigate = useNavigate();
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  const { user } = useAuthStore();
  const [branchesList, setBranchesList] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [accountTypeFilter, setAccountTypeFilter] = useState<string>('ALL');
  const [selectedCurrency, setSelectedCurrency] = useState<string>(() => localStorage.getItem('coa_currency') || 'ALL');
  const [showZeroBalances, setShowZeroBalances] = useState<boolean>(true);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Fetch branches and listen for branch change
  useEffect(() => {
    branchesApi.getAll().then((list) => {
      setBranchesList(list);
    }).catch(() => {});

    const activeId = localStorage.getItem('active_branch_id') || 'ALL';
    setSelectedBranch(activeId);

    const handleBranchChange = (e: any) => {
      const bId = e.detail || localStorage.getItem('active_branch_id') || 'ALL';
      setSelectedBranch(bId);
      if (onRefresh) onRefresh();
    };

    window.addEventListener('active-branch-changed', handleBranchChange);
    return () => {
      window.removeEventListener('active-branch-changed', handleBranchChange);
    };
  }, [onRefresh]);

  // Columns visibility state
  const [cols, setCols] = useState<ColumnConfig>(() => {
    try {
      const saved = localStorage.getItem('coa_table_columns_v5');
      if (saved) return { ...DEFAULT_COLUMNS, ...JSON.parse(saved), branchScope: false };
    } catch {}
    return { ...DEFAULT_COLUMNS, branchScope: false };
  });

  const toggleCol = (key: keyof ColumnConfig) => {
    setCols((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('coa_table_columns_v5', JSON.stringify(next));
      return next;
    });
  };

  const showAllCols = () => {
    const allTrue = (Object.keys(DEFAULT_COLUMNS) as (keyof ColumnConfig)[]).reduce((acc, k) => {
      acc[k] = true;
      return acc;
    }, {} as ColumnConfig);
    setCols(allTrue);
    localStorage.setItem('coa_table_columns_v5', JSON.stringify(allTrue));
  };

  const resetDefaultCols = () => {
    setCols(DEFAULT_COLUMNS);
    localStorage.setItem('coa_table_columns_v5', JSON.stringify(DEFAULT_COLUMNS));
  };

  // Modals state
  const [activeAccount, setActiveAccount] = useState<AccountNode | null>(null);
  const [wizardModalOpen, setWizardModalOpen] = useState<boolean>(false);
  const [wizardMode, setWizardMode] = useState<'CREATE' | 'EDIT'>('CREATE');
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);

  // Helper to check branch mapping
  const doesNodeBelongToBranch = (node: AccountNode, targetBranchId: string): boolean => {
    if (!targetBranchId || targetBranchId === 'ALL') return true;
    if (node.isGroup) return true;
    if (node.scope === 'ALL_BRANCHES') return true;
    if (node.branchIds && node.branchIds.length > 0) {
      return node.branchIds.includes(targetBranchId);
    }
    // Shared Chart of Accounts accounts with empty branchIds are available across branches
    return true;
  };

  // Build Hierarchy Tree with Rollup
  const treeData = useMemo(() => {
    if (!accounts || accounts.length === 0) return [];

    const hasNestedChildren = accounts.some((a) => a.children && a.children.length > 0);
    let rawRoots: AccountNode[] = [];

    if (hasNestedChildren) {
      const clone = (acc: AccountNode): AccountNode => ({
        ...acc,
        children: (acc.children || []).map(clone),
      });
      rawRoots = accounts.map(clone);
    } else {
      const accMap = new Map<string, AccountNode>();
      accounts.forEach((acc) => {
        accMap.set(acc.id, { ...acc, children: [] });
      });

      accounts.forEach((acc) => {
        const item = accMap.get(acc.id)!;
        if (acc.parentId && accMap.has(acc.parentId)) {
          accMap.get(acc.parentId)!.children!.push(item);
        } else {
          rawRoots.push(item);
        }
      });
    }

    const rollupScopedBalances = (node: AccountNode): AccountNode => {
      const isLeaf = !node.isGroup && (!node.children || node.children.length === 0);

      if (isLeaf) {
        const belongs = doesNodeBelongToBranch(node, selectedBranch);
        return {
          ...node,
          debitIQD: belongs ? Number(node.debitIQD ?? node.debit ?? 0) : 0,
          creditIQD: belongs ? Number(node.creditIQD ?? node.credit ?? 0) : 0,
          balanceIQD: belongs ? Number(node.balanceIQD ?? node.balance ?? 0) : 0,
          debitUSD: belongs ? Number(node.debitUSD ?? 0) : 0,
          creditUSD: belongs ? Number(node.creditUSD ?? 0) : 0,
          balanceUSD: belongs ? Number(node.balanceUSD ?? 0) : 0,
          debit: belongs ? Number(node.debit ?? 0) : 0,
          credit: belongs ? Number(node.credit ?? 0) : 0,
          balance: belongs ? Number(node.balance ?? 0) : 0,
          children: [],
        };
      }

      const processedChildren = (node.children || []).map(rollupScopedBalances);

      let sumDebitIQD = 0;
      let sumCreditIQD = 0;
      let sumBalanceIQD = 0;
      let sumDebitUSD = 0;
      let sumCreditUSD = 0;
      let sumBalanceUSD = 0;

      processedChildren.forEach((child) => {
        sumDebitIQD += Number(child.debitIQD || 0);
        sumCreditIQD += Number(child.creditIQD || 0);
        sumBalanceIQD += Number(child.balanceIQD || 0);
        sumDebitUSD += Number(child.debitUSD || 0);
        sumCreditUSD += Number(child.creditUSD || 0);
        sumBalanceUSD += Number(child.balanceUSD || 0);
      });

      return {
        ...node,
        children: processedChildren,
        debitIQD: sumDebitIQD,
        creditIQD: sumCreditIQD,
        balanceIQD: sumBalanceIQD,
        debitUSD: sumDebitUSD,
        creditUSD: sumCreditUSD,
        balanceUSD: sumBalanceUSD,
        debit: sumDebitIQD,
        credit: sumCreditIQD,
        balance: sumBalanceIQD,
      };
    };

    const finalRoots = rawRoots.map(rollupScopedBalances);

    return finalRoots;
  }, [accounts, selectedBranch]);

  useEffect(() => {
    if (treeData.length === 0 || expandedNodes.size > 0) return;
    setExpandedNodes(new Set(treeData.map((root) => root.id)));
  }, [treeData, expandedNodes.size]);

  const toggleExpand = (id: string) => {
    const next = new Set(expandedNodes);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedNodes(next);
  };

  const expandAll = () => {
    const all = new Set<string>();
    const collectGroups = (nodes: AccountNode[]) => {
      nodes.forEach((a) => {
        if (a.isGroup || (a.children && a.children.length > 0)) {
          all.add(a.id);
        }
        if (a.children && a.children.length > 0) {
          collectGroups(a.children);
        }
      });
    };
    collectGroups(treeData);
    setExpandedNodes(all);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  const resetDisplay = () => {
    setSearchQuery('');
    setSelectedBranch('ALL');
    setAccountTypeFilter('ALL');
    setSelectedCurrency('ALL');
    setShowZeroBalances(true);
    resetDefaultCols();
  };

  const nodeMatchesTypeFilter = (node: AccountNode): boolean => {
    if (accountTypeFilter === 'ALL') return true;

    const code = String(node.code || '');
    const nameAr = String(node.nameAr || '');
    const cat = String((node as any).category || '').toUpperCase();
    const role = String((node as any).accountRole || '').toUpperCase();
    const type = String(node.type || '').toUpperCase();

    if (accountTypeFilter === 'CUSTOMERS') {
      return (
        cat === 'CUSTOMER' ||
        role === 'CUSTOMER' ||
        role === 'BOTH' ||
        code.startsWith('1614') ||
        code.startsWith('141') ||
        code.startsWith('142') ||
        code.startsWith('143') ||
        type.includes('CUSTOMER') ||
        nameAr.includes('زبون') ||
        nameAr.includes('عميل')
      );
    }

    if (accountTypeFilter === 'SUPPLIERS') {
      return (
        cat === 'SUPPLIER' ||
        role === 'SUPPLIER' ||
        role === 'BOTH' ||
        code.startsWith('2614') ||
        code.startsWith('261') ||
        code.startsWith('211') ||
        code.startsWith('212') ||
        type.includes('SUPPLIER') ||
        nameAr.includes('مورد') ||
        nameAr.includes('طيران') ||
        nameAr.includes('فندق') ||
        nameAr.includes('فنادق') ||
        nameAr.includes('تأشيرة') ||
        nameAr.includes('فيزا')
      );
    }

    if (accountTypeFilter === 'EXPENSES') {
      return (
        cat === 'EXPENSE' ||
        code.startsWith('3') ||
        code.startsWith('5') ||
        type.includes('EXPENSE') ||
        nameAr.includes('مصروف') ||
        nameAr.includes('مصاريف')
      );
    }

    if (accountTypeFilter === 'REVENUES') {
      return (
        cat === 'REVENUE' ||
        code.startsWith('4') ||
        type.includes('REVENUE') ||
        nameAr.includes('إيراد') ||
        nameAr.includes('ايراد') ||
        nameAr.includes('مبيعات')
      );
    }

    if (accountTypeFilter === 'COMPANIES') {
      return (
        nameAr.includes('شركة') ||
        nameAr.includes('وكالة') ||
        nameAr.includes('مكتب') ||
        nameAr.includes('كروب') ||
        nameAr.includes('جروب') ||
        code.startsWith('16142') ||
        code.startsWith('16143') ||
        code.startsWith('2614') ||
        type.includes('CORPORATE') ||
        type.includes('AGENCY')
      );
    }

    return true;
  };

  const hasMatchingDescendant = (node: AccountNode): boolean => {
    if (nodeMatchesTypeFilter(node)) return true;
    if (node.children && node.children.length > 0) {
      return node.children.some((child) => hasMatchingDescendant(child));
    }
    return false;
  };

  // Flatten tree for table rendering with filters
  const flattenVisibleNodes = (
    nodes: AccountNode[],
    depth = 0
  ): { node: AccountNode; depth: number; isOrganizationalParent?: boolean }[] => {
    let result: { node: AccountNode; depth: number; isOrganizationalParent?: boolean }[] = [];

    nodes.forEach((node) => {
      const isSearchMatch =
        !searchQuery ||
        (node.nameAr && node.nameAr.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (node.nameEn && node.nameEn.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (node.code && node.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (node.type && node.type.toLowerCase().includes(searchQuery.toLowerCase()));

      const isTypeMatch = hasMatchingDescendant(node);

      const isZeroMatch =
        showZeroBalances ||
        (node.balanceIQD !== 0 || (node.balanceUSD || 0) !== 0 || node.isGroup);

      if (isSearchMatch && isTypeMatch && isZeroMatch) {
        result.push({ node, depth });
      }

      if (node.children && node.children.length > 0 && (expandedNodes.has(node.id) || searchQuery || accountTypeFilter !== 'ALL')) {
        result = result.concat(flattenVisibleNodes(node.children, depth + 1));
      }
    });

    return result;
  };

  const parentScrollRef = useRef<HTMLDivElement>(null);

  const visibleList = useMemo(() => {
    return flattenVisibleNodes(treeData, 0);
  }, [treeData, expandedNodes, searchQuery, selectedBranch, selectedCurrency, accountTypeFilter, showZeroBalances]);

  const totalVisibleCols = useMemo(() => {
    let count = 0;
    if (cols.code) count++;
    if (cols.name) count++;
    if (cols.nameEn) count++;
    if (cols.type) count++;
    if (cols.nature) count++;
    if (cols.classification) count++;
    if (cols.currency) count++;
    if (cols.debitIQD && (selectedCurrency === 'ALL' || selectedCurrency === 'IQD')) count++;
    if (cols.creditIQD && (selectedCurrency === 'ALL' || selectedCurrency === 'IQD')) count++;
    if (cols.balanceIQD && (selectedCurrency === 'ALL' || selectedCurrency === 'IQD')) count++;
    if (cols.debitUSD && (selectedCurrency === 'ALL' || selectedCurrency === 'USD')) count++;
    if (cols.creditUSD && (selectedCurrency === 'ALL' || selectedCurrency === 'USD')) count++;
    if (cols.balanceUSD && (selectedCurrency === 'ALL' || selectedCurrency === 'USD')) count++;
    if (cols.status) count++;
    if (cols.actions) count++;
    return count || 12;
  }, [cols, selectedCurrency]);

  const rowVirtualizer = useVirtualizer({
    count: visibleList.length,
    getScrollElement: () => parentScrollRef.current,
    estimateSize: () => 42,
    overscan: 25,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom = virtualRows.length > 0 ? totalHeight - virtualRows[virtualRows.length - 1].end : 0;

  const handleConfirmDelete = async () => {
    if (!activeAccount) return;
    const accountToDelete = activeAccount;
    setDeleteModalOpen(false);

    try {
      await accountsApi.delete(accountToDelete.id);
      showSuccessNotification(
        isAr ? 'تم حذف الحساب' : 'Account Deleted',
        isAr ? `تم حذف الحساب (${accountToDelete.nameAr}) بنجاح.` : `Account ${accountToDelete.nameAr} was deleted.`
      );

      if (onRefresh) onRefresh();
    } catch (err: any) {
      if (onRefresh) onRefresh();
      showErrorNotification(
        isAr ? 'فشل الحذف' : 'Delete Failed',
        err?.message || (isAr ? 'لا يمكن حذف حساب يحتوي على حركات أو حسابات فرعية.' : 'Cannot delete account with transactions.')
      );
    }
  };

  return (
    <div className="space-y-3 w-full font-sans select-none" dir={direction}>
      {/* ── 1. MODERN TOOLBAR (Search, Filters, Currency, Expanders, Columns) ── */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        {/* Left Side: Search, Branch, Type, Currency */}
        <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-0">
          {/* Search Input */}
          <div className="relative w-64 min-w-[200px]">
            <Search size={15} className="absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isAr ? 'البحث برمز أو اسم الحساب...' : 'Search by code or name...'}
              className="w-full h-[38px] ps-9 pe-8 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white focus:bg-white text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#F45A0A] focus:ring-2 focus:ring-[#F45A0A]/10 transition-all font-sans"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute top-1/2 -translate-y-1/2 end-2.5 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Account Type Filter */}
          <div className="w-40">
            <Select
              size="xs"
              radius="md"
              data={[
                { label: isAr ? 'جميع الحسابات' : 'All Accounts', value: 'ALL' },
                { label: isAr ? 'عملاء' : 'Customers', value: 'CUSTOMERS' },
                { label: isAr ? 'موردين' : 'Suppliers', value: 'SUPPLIERS' },
                { label: isAr ? 'مصاريف' : 'Expenses', value: 'EXPENSES' },
                { label: isAr ? 'إيرادات' : 'Revenues', value: 'REVENUES' },
                { label: isAr ? 'شركات' : 'Companies', value: 'COMPANIES' },
              ]}
              value={accountTypeFilter}
              onChange={(val) => setAccountTypeFilter(val || 'ALL')}
              className="font-sans"
            />
          </div>

          {/* Modern Currency Segmented Buttons */}
          <div className="flex items-center p-[3px] bg-slate-100 border border-slate-200 rounded-xl h-[38px] text-xs">
            {['ALL', 'IQD', 'USD'].map((curr) => {
              const isActive = selectedCurrency === curr;
              return (
                <button
                  key={curr}
                  type="button"
                  onClick={() => setSelectedCurrency(curr)}
                  className={`h-full px-3 rounded-[8px] font-bold text-xs transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#F45A0A] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  {curr === 'ALL' ? (isAr ? 'الكل' : 'ALL') : curr === 'USD' ? '$ USD' : 'IQD'}
                </button>
              );
            })}
          </div>

          <div className="w-px h-5 bg-slate-200 mx-1 hidden lg:block" />

          {/* Expand / Collapse Buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={expandAll}
              className="h-[34px] px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11.5px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>{isAr ? 'توسيع الكل' : 'Expand All'}</span>
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="h-[34px] px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11.5px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>{isAr ? 'طي الكل' : 'Collapse'}</span>
            </button>
          </div>
        </div>

        {/* Right Side: Columns Customizer & Filter Reset */}
        <div className="flex items-center gap-2 shrink-0">
          <Menu shadow="xl" width={320} position="bottom-end" closeOnItemClick={false}>
            <Menu.Target>
              <button
                type="button"
                className="h-[38px] px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-2xs"
              >
                <Columns size={14} className="text-slate-500" />
                <span>{isAr ? 'تخصيص الأعمدة' : 'Columns'}</span>
              </button>
            </Menu.Target>
            <Menu.Dropdown className="text-xs p-3 space-y-2.5 max-h-[460px] overflow-y-auto font-sans" dir={direction}>
              <div className="font-bold text-xs text-slate-900 border-b border-slate-100 pb-2 flex items-center justify-between">
                <span>{isAr ? 'تخصيص أعمدة شجرة الحسابات' : 'Configure Table Columns'}</span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={showAllCols} className="text-[11px] text-[#F45A0A] font-bold hover:underline cursor-pointer">
                    {isAr ? 'الكل' : 'All'}
                  </button>
                  <span className="text-slate-300">|</span>
                  <button type="button" onClick={resetDefaultCols} className="text-[11px] text-slate-500 hover:underline cursor-pointer">
                    {isAr ? 'الافتراضي' : 'Default'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <Checkbox label={isAr ? 'رمز الحساب' : 'Code'} size="xs" checked={cols.code} onChange={() => toggleCol('code')} />
                <Checkbox label={isAr ? 'اسم الحساب' : 'Name'} size="xs" checked={cols.name} onChange={() => toggleCol('name')} />
                <Checkbox label="English Name" size="xs" checked={cols.nameEn} onChange={() => toggleCol('nameEn')} />
                <Checkbox label={isAr ? 'نوع الحساب' : 'Type'} size="xs" checked={cols.type} onChange={() => toggleCol('type')} />
                <Checkbox label={isAr ? 'طبيعة الحساب' : 'Nature'} size="xs" checked={cols.nature} onChange={() => toggleCol('nature')} />
                <Checkbox label={isAr ? 'التصنيف' : 'Classification'} size="xs" checked={cols.classification} onChange={() => toggleCol('classification')} />
                <Checkbox label={isAr ? 'العملة' : 'Currency'} size="xs" checked={cols.currency} onChange={() => toggleCol('currency')} />
                <Checkbox label={isAr ? 'مدين (IQD)' : 'Debit (IQD)'} size="xs" checked={cols.debitIQD} onChange={() => toggleCol('debitIQD')} />
                <Checkbox label={isAr ? 'دائن (IQD)' : 'Credit (IQD)'} size="xs" checked={cols.creditIQD} onChange={() => toggleCol('creditIQD')} />
                <Checkbox label={isAr ? 'الرصيد (IQD)' : 'Balance (IQD)'} size="xs" checked={cols.balanceIQD} onChange={() => toggleCol('balanceIQD')} />
                <Checkbox label={isAr ? 'مدين (USD)' : 'Debit (USD)'} size="xs" checked={cols.debitUSD} onChange={() => toggleCol('debitUSD')} />
                <Checkbox label={isAr ? 'دائن (USD)' : 'Credit (USD)'} size="xs" checked={cols.creditUSD} onChange={() => toggleCol('creditUSD')} />
                <Checkbox label={isAr ? 'الرصيد (USD)' : 'Balance (USD)'} size="xs" checked={cols.balanceUSD} onChange={() => toggleCol('balanceUSD')} />
                <Checkbox label={isAr ? 'الحالة' : 'Status'} size="xs" checked={cols.status} onChange={() => toggleCol('status')} />
              </div>
            </Menu.Dropdown>
          </Menu>

          <button
            type="button"
            onClick={resetDisplay}
            className="h-[38px] w-[38px] rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-colors flex items-center justify-center cursor-pointer shadow-2xs"
            title={isAr ? 'إعادة ضبط الفلاتر' : 'Reset Filters'}
          >
            <FilterX size={15} />
          </button>
        </div>
      </div>

      {/* ── 2. MODERN TREEGRID TABLE WITH SMOOTH VIRTUAL SCROLLING ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden w-full">
        <div ref={parentScrollRef} className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] min-h-[500px] w-full">
          <table className="w-full text-xs text-start border-collapse font-sans whitespace-nowrap min-w-full">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-700 font-bold h-[42px] whitespace-nowrap">
                {cols.code && <th className="py-2.5 px-3 text-start whitespace-nowrap font-bold w-28">{isAr ? 'رمز الحساب' : 'Code'}</th>}
                {cols.name && <th className="py-2.5 px-3 text-start whitespace-nowrap font-bold min-w-[220px]">{isAr ? 'اسم الحساب والمسار الشجري' : 'Account Name & Path'}</th>}
                {cols.nameEn && <th className="py-2.5 px-3 text-start whitespace-nowrap font-bold min-w-[160px]">{isAr ? 'English Name' : 'English Name'}</th>}
                {cols.type && <th className="py-2.5 px-3 text-start whitespace-nowrap font-bold">{isAr ? 'نوع الحساب' : 'Type'}</th>}
                {cols.nature && <th className="py-2.5 px-3 text-center whitespace-nowrap font-bold">{isAr ? 'الطبيعة' : 'Nature'}</th>}
                {cols.classification && <th className="py-2.5 px-3 text-center whitespace-nowrap font-bold">{isAr ? 'التصنيف' : 'Posting'}</th>}
                {cols.currency && <th className="py-2.5 px-3 text-center whitespace-nowrap font-bold">{isAr ? 'العملة' : 'Curr'}</th>}

                {/* IQD Balances */}
                {cols.debitIQD && (selectedCurrency === 'ALL' || selectedCurrency === 'IQD') && (
                  <th className="py-2.5 px-3 text-end whitespace-nowrap font-mono font-bold">{isAr ? 'مدين (IQD)' : 'Debit (IQD)'}</th>
                )}
                {cols.creditIQD && (selectedCurrency === 'ALL' || selectedCurrency === 'IQD') && (
                  <th className="py-2.5 px-3 text-end whitespace-nowrap font-mono font-bold">{isAr ? 'دائن (IQD)' : 'Credit (IQD)'}</th>
                )}
                {cols.balanceIQD && (selectedCurrency === 'ALL' || selectedCurrency === 'IQD') && (
                  <th className="py-2.5 px-3 text-end whitespace-nowrap font-mono font-black text-slate-900">{isAr ? 'الرصيد الصافي (IQD)' : 'Balance (IQD)'}</th>
                )}

                {/* USD Balances */}
                {cols.debitUSD && (selectedCurrency === 'ALL' || selectedCurrency === 'USD') && (
                  <th className="py-2.5 px-3 text-end whitespace-nowrap font-mono font-bold text-blue-700">{isAr ? 'مدين ($)' : 'Debit ($)'}</th>
                )}
                {cols.creditUSD && (selectedCurrency === 'ALL' || selectedCurrency === 'USD') && (
                  <th className="py-2.5 px-3 text-end whitespace-nowrap font-mono font-bold text-blue-700">{isAr ? 'دائن ($)' : 'Credit ($)'}</th>
                )}
                {cols.balanceUSD && (selectedCurrency === 'ALL' || selectedCurrency === 'USD') && (
                  <th className="py-2.5 px-3 text-end whitespace-nowrap font-mono font-black text-blue-800">{isAr ? 'الرصيد ($ USD)' : 'Balance (USD)'}</th>
                )}

                {cols.status && <th className="py-2.5 px-3 text-center whitespace-nowrap font-bold w-16">{isAr ? 'الحالة' : 'Status'}</th>}
                {cols.actions && <th className="py-2.5 px-3 text-center whitespace-nowrap font-bold w-14">{isAr ? 'إجراءات' : 'Actions'}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={20} className="py-14 text-center text-slate-500 font-semibold">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw size={22} className="animate-spin text-[#F45A0A]" />
                      <span>{isAr ? 'جارٍ تحميل شجرة ودليل الحسابات...' : 'Loading Chart of Accounts...'}</span>
                    </div>
                  </td>
                </tr>
              ) : visibleList.length === 0 ? (
                <tr>
                  <td colSpan={20} className="py-14 text-center text-slate-500 font-semibold">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ListTree size={28} className="text-slate-300" />
                      <span>{isAr ? 'لا توجد حسابات مطابقة للبحث أو الفلاتر المحددة.' : 'No accounts matching current filters.'}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {paddingTop > 0 && (
                    <tr>
                      <td style={{ height: `${paddingTop}px` }} colSpan={totalVisibleCols} />
                    </tr>
                  )}
                  {(virtualRows.length > 0 ? virtualRows.map((v) => ({ ...visibleList[v.index], virtualIndex: v.index })) : visibleList.slice(0, 100).map((v, i) => ({ ...v, virtualIndex: i }))).map((item) => {
                    const { node, depth } = item;
                  const isExpanded = expandedNodes.has(node.id);
                  const isDebit = node.nature === 'DEBIT';
                  const hasChildren = node.children && node.children.length > 0;

                  const isRootParent = node.level === 1 || (!node.parentId && node.isGroup);
                  const isSubParent = node.isGroup && !isRootParent;
                  const isBoth = !node.isGroup && (node.accountRole === 'BOTH' || (Boolean(node.customer?.isActive) && Boolean(node.supplier?.isActive)));
                  const isCustomer = !node.isGroup && !isBoth && (node.accountRole === 'CUSTOMER' || node.category === 'CUSTOMER' || node.code.startsWith('1614') || node.code.startsWith('161'));
                  const isSupplier = !node.isGroup && !isBoth && (node.accountRole === 'SUPPLIER' || node.category === 'SUPPLIER' || node.code.startsWith('2614') || node.code.startsWith('261'));
                  const isCashbox = !node.isGroup && (node.code.startsWith('181') || node.code.startsWith('121') || node.nameAr.includes('صندوق') || node.nameAr.includes('قاصة'));
                  const isBank = !node.isGroup && (node.code.startsWith('182') || node.code.startsWith('122') || node.nameAr.includes('مصرف') || node.nameAr.includes('بنك'));

                  // Distinctive row backgrounds
                  const rowBgClass = isRootParent
                    ? 'bg-slate-100/90 hover:bg-slate-200/70 border-y border-slate-300/80 shadow-2xs'
                    : isSubParent
                    ? 'bg-amber-50/40 hover:bg-amber-100/50 border-b border-amber-100/80'
                    : isBoth
                    ? 'bg-orange-50/30 hover:bg-orange-100/40 border-b border-orange-100/80'
                    : isCustomer
                    ? 'bg-white hover:bg-blue-50/40 border-b border-slate-100/80'
                    : isSupplier
                    ? 'bg-white hover:bg-purple-50/40 border-b border-slate-100/80'
                    : isCashbox || isBank
                    ? 'bg-white hover:bg-emerald-50/40 border-b border-slate-100/80'
                    : 'bg-white hover:bg-slate-50/80 border-b border-slate-100/80';

                  return (
                    <tr
                      key={node.id}
                      onClick={() => onSelectAccount && onSelectAccount(node)}
                      onDoubleClick={() => onRowDoubleClick && onRowDoubleClick(node)}
                      className={`h-[42px] transition-colors cursor-pointer ${rowBgClass}`}
                    >
                      {/* Code */}
                      {cols.code && (
                        <td className="py-2 px-3" dir="ltr">
                          <span
                            className={`font-mono text-xs inline-block ${
                              isRootParent
                                ? 'bg-slate-900 text-white font-black px-2 py-0.5 rounded-md shadow-2xs'
                                : isSubParent
                                ? 'bg-amber-100 text-amber-950 border border-amber-300 font-extrabold px-2 py-0.5 rounded-md'
                                : isBoth
                                ? 'bg-orange-50 text-[#F45A0A] border border-orange-300 font-extrabold px-1.5 py-0.5 rounded'
                                : isCustomer
                                ? 'bg-blue-50 text-blue-700 border border-blue-200/80 font-bold px-1.5 py-0.5 rounded'
                                : isSupplier
                                ? 'bg-purple-50 text-purple-700 border border-purple-200/80 font-bold px-1.5 py-0.5 rounded'
                                : isCashbox || isBank
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-bold px-1.5 py-0.5 rounded'
                                : 'bg-slate-100 text-slate-700 border border-slate-200/80 font-semibold px-1.5 py-0.5 rounded'
                            }`}
                          >
                            {node.code}
                          </span>
                        </td>
                      )}

                      {/* Tree Indented Name */}
                      {cols.name && (
                        <td className="py-2 px-3">
                          <div
                            className="flex items-center gap-2"
                            style={{
                              [direction === 'rtl' ? 'paddingRight' : 'paddingLeft']: `${depth * 20}px`,
                            }}
                          >
                            {hasChildren || node.isGroup ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                   e.stopPropagation();
                                   toggleExpand(node.id);
                                }}
                                className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer shrink-0"
                              >
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </button>
                            ) : (
                              <span className="w-5 shrink-0" />
                            )}

                            {node.isGroup ? (
                              isExpanded ? (
                                <FolderOpen size={16} className="text-amber-500 shrink-0" />
                              ) : (
                                <Folder size={16} className="text-amber-500 shrink-0" />
                              )
                            ) : (
                              <FileCode size={15} className="text-slate-400 shrink-0" />
                            )}

                            <span className={`truncate ${node.isGroup ? 'font-black text-slate-900' : 'font-medium text-slate-800'}`}>
                              {node.nameAr}
                            </span>
                          </div>
                        </td>
                      )}

                      {/* English Name */}
                      {cols.nameEn && (
                        <td className="py-2 px-3 text-slate-500 font-sans truncate">
                          {node.nameEn || '—'}
                        </td>
                      )}

                      {/* Account Type */}
                      {cols.type && (
                        <td className="py-2 px-3">
                          <span className="text-[11.5px] font-semibold text-slate-700">
                            {node.type}
                          </span>
                        </td>
                      )}

                      {/* Nature */}
                      {cols.nature && (
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                              isDebit
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {isDebit ? (isAr ? 'مدين' : 'Debit') : (isAr ? 'دائن' : 'Credit')}
                          </span>
                        </td>
                      )}

                      {/* Classification / Posting Type */}
                      {cols.classification && (
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold inline-flex items-center gap-1 ${
                              isRootParent
                                ? 'bg-slate-900 text-white shadow-2xs'
                                : isSubParent
                                ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                : isBoth
                                ? 'bg-orange-50 text-[#EA580C] border border-orange-300'
                                : isCustomer
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : isSupplier
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : isCashbox
                                ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                : isBank
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {isRootParent
                              ? (isAr ? '👑 أب رئيسي L1' : 'Root L1')
                              : isSubParent
                              ? (isAr ? '📁 حساب أب' : 'Parent Group')
                              : isBoth
                              ? (isAr ? '🔄 عميل ومورد' : 'Customer & Supplier')
                              : isCustomer
                              ? (isAr ? '👤 عميل' : 'Customer')
                              : isSupplier
                              ? (isAr ? '🏢 مورد' : 'Supplier')
                              : isCashbox
                              ? (isAr ? '💵 صندوق' : 'Cashbox')
                              : isBank
                              ? (isAr ? '🏦 مصرف' : 'Bank')
                              : (isAr ? '📄 حساب فرعي' : 'Account')}
                          </span>
                        </td>
                      )}

                      {/* Currency */}
                      {cols.currency && (
                        <td className="py-2 px-3 text-center font-mono font-bold text-slate-600">
                          {node.currency === 'MULTI' ? 'ALL' : (node.currency || 'IQD')}
                        </td>
                      )}

                      {/* Debit IQD */}
                      {cols.debitIQD && (selectedCurrency === 'ALL' || selectedCurrency === 'IQD') && (
                        <td className="py-2 px-3 text-end font-mono font-semibold text-slate-700" dir="ltr">
                          {Number(node.debitIQD || 0) !== 0 ? Number(node.debitIQD || 0).toLocaleString() : '—'}
                        </td>
                      )}

                      {/* Credit IQD */}
                      {cols.creditIQD && (selectedCurrency === 'ALL' || selectedCurrency === 'IQD') && (
                        <td className="py-2 px-3 text-end font-mono font-semibold text-slate-700" dir="ltr">
                          {Number(node.creditIQD || 0) !== 0 ? Number(node.creditIQD || 0).toLocaleString() : '—'}
                        </td>
                      )}

                      {/* Balance IQD */}
                      {cols.balanceIQD && (selectedCurrency === 'ALL' || selectedCurrency === 'IQD') && (
                        <td className="py-2 px-3 text-end font-mono font-black text-slate-900" dir="ltr">
                          {Number(node.balanceIQD || 0) !== 0 ? Number(node.balanceIQD || 0).toLocaleString() : '0'}
                        </td>
                      )}

                      {/* Debit USD */}
                      {cols.debitUSD && (selectedCurrency === 'ALL' || selectedCurrency === 'USD') && (
                        <td className="py-2 px-3 text-end font-mono font-semibold text-blue-700" dir="ltr">
                          {Number(node.debitUSD || 0) !== 0 ? `$${Number(node.debitUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                      )}

                      {/* Credit USD */}
                      {cols.creditUSD && (selectedCurrency === 'ALL' || selectedCurrency === 'USD') && (
                        <td className="py-2 px-3 text-end font-mono font-semibold text-blue-700" dir="ltr">
                          {Number(node.creditUSD || 0) !== 0 ? `$${Number(node.creditUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                      )}

                      {/* Balance USD */}
                      {cols.balanceUSD && (selectedCurrency === 'ALL' || selectedCurrency === 'USD') && (
                        <td className="py-2 px-3 text-end font-mono font-black text-blue-800" dir="ltr">
                          {Number(node.balanceUSD || 0) !== 0 ? `$${Number(node.balanceUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '$0.00'}
                        </td>
                      )}

                      {/* Status */}
                      {cols.status && (
                        <td className="py-2 px-3 text-center">
                          <span className={`inline-block w-2.5 h-2.5 rounded-full ${node.status === 'معطل' ? 'bg-rose-500' : 'bg-emerald-500'}`} title={node.status || 'نشط'} />
                        </td>
                      )}

                      {/* Row Actions Menu */}
                      {cols.actions && (
                        <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <Menu shadow="md" width={180} position="bottom-end">
                            <Menu.Target>
                              <button
                                type="button"
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer mx-auto"
                              >
                                <MoreVertical size={15} />
                              </button>
                            </Menu.Target>
                            <Menu.Dropdown className="text-xs font-semibold font-sans min-w-[170px]" dir={direction}>
                              <Menu.Item
                                leftSection={<Edit size={14} className="text-blue-600" />}
                                onClick={() => {
                                  setActiveAccount(node);
                                  setWizardMode('EDIT');
                                  setWizardModalOpen(true);
                                }}
                              >
                                {isAr ? 'تعديل الحساب' : 'Edit Account'}
                              </Menu.Item>
                              <Menu.Item
                                leftSection={<FileText size={14} className="text-emerald-600" />}
                                onClick={() => navigate(`/reports?accountId=${node.id}`)}
                              >
                                {isAr ? 'كشف حركات الحساب' : 'Account Statement'}
                              </Menu.Item>
                              <Menu.Divider />
                              <Menu.Item
                                color="red"
                                leftSection={<Trash2 size={14} />}
                                onClick={() => {
                                  setActiveAccount(node);
                                  setDeleteModalOpen(true);
                                }}
                              >
                                {isAr ? 'حذف الحساب' : 'Delete'}
                              </Menu.Item>
                            </Menu.Dropdown>
                          </Menu>
                        </td>
                      )}
                    </tr>
                  );
                  })}
                  {paddingBottom > 0 && (
                    <tr>
                      <td style={{ height: `${paddingBottom}px` }} colSpan={totalVisibleCols} />
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 3. WIZARD MODAL ── */}
      <SmartAccountWizardModal
        opened={wizardModalOpen}
        onClose={() => setWizardModalOpen(false)}
        onSuccess={() => {
          if (onRefresh) onRefresh();
        }}
        allAccounts={accounts}
        mode={wizardMode}
        initialData={activeAccount}
        defaultAccountType={activeAccount?.type}
      />

      {/* ── 4. DELETE CONFIRMATION MODAL ── */}
      <Modal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title={<span className="font-bold text-sm text-red-600">{isAr ? 'تأكيد حذف الحساب المحاسبي' : 'Confirm Account Deletion'}</span>}
        centered
        radius="lg"
      >
        <div className="space-y-4 text-xs font-sans" dir={direction}>
          <p className="text-slate-700 leading-relaxed">
            {isAr
              ? `هل أنت متأكد من رغبتك في حذف الحساب المحاسبي (${activeAccount?.code} — ${activeAccount?.nameAr})؟`
              : `Are you sure you want to delete account (${activeAccount?.code} — ${activeAccount?.nameAr})?`}
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setDeleteModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer"
            >
              {isAr ? 'تأكيد الحذف' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AccountingTreeGrid;
