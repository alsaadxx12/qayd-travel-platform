import React, { useState, useMemo, useEffect } from 'react';
import {
  Modal,
  TextInput,
  Switch,
} from '@mantine/core';
import { SearchableCombobox } from '../ui/SearchableCombobox';
import { arabicToEnglish } from '../../utils/arabicToEnglish';
import {
  IconWand,
  IconCheck,
  IconUser,
  IconBuilding,
  IconPlane,
  IconWallet,
  IconBuildingBank,
  IconReceipt,
  IconArrowRight,
  IconArrowLeft,
  IconPlus,
  IconCreditCard,
  IconUsers,
  IconWorld,
  IconTicket,
  IconBed,
  IconId,
  IconDeviceDesktopAnalytics,
  IconCashBanknote,
  IconCoins,
  IconAlertCircle,
  IconLoader2,
} from '@tabler/icons-react';
import { FormattedNumberInput } from '../common/FormattedNumberInput';
import { AccountNode } from '../common/AccountingTreeGrid';
import { accountsApi } from '../../api/accounts';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { useLanguageStore } from '../../store/useLanguageStore';

interface SmartAccountWizardModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode?: 'CREATE' | 'EDIT';
  initialData?: AccountNode | null;
  allAccounts?: AccountNode[];
  defaultAccountType?: string;
}

const STATIC_EMPTY_ACCOUNTS: AccountNode[] = [];

const getTodayInputDate = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

const CASH_CUSTOMER_NAME_AR = 'زبون نقدي';
const CASH_CUSTOMER_NAME_EN = 'Cash Customer';

const hasCashCustomerName = (name?: string | null) => {
  const normalized = String(name || '').trim().toLowerCase();
  return ['زبون نقدي', 'عميل نقدي', 'عميل نقدي عام', 'cash customer', 'cash client'].includes(normalized);
};

export const SmartAccountWizardModal: React.FC<SmartAccountWizardModalProps> = ({
  opened,
  onClose,
  onSuccess,
  mode = 'CREATE',
  initialData = null,
  allAccounts: externalAccounts = STATIC_EMPTY_ACCOUNTS,
  defaultAccountType,
}) => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  const [saving, setSaving] = useState(false);
  const [internalAccounts, setInternalAccounts] = useState<AccountNode[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState(false);
  const hasExternal = Boolean(externalAccounts && externalAccounts.length > 0);

  const allAccounts = useMemo(() => {
    return hasExternal ? externalAccounts : internalAccounts;
  }, [hasExternal, externalAccounts, internalAccounts]);

  // Fetch accounts safely only once when modal is opened if not provided from parent
  useEffect(() => {
    if (!opened) return;
    if (hasExternal || internalAccounts.length > 0) return;

    let isMounted = true;
    setAccountsLoading(true);
    setAccountsError(false);
    accountsApi
      .getTree(true)
      .then((data) => {
        if (isMounted && Array.isArray(data)) {
          setInternalAccounts(data);
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch accounts tree in wizard:', err);
        if (isMounted) setAccountsError(true);
      })
      .finally(() => {
        if (isMounted) setAccountsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [opened, hasExternal, internalAccounts.length]);

  // Step 1 or 2
  const [step, setStep] = useState<number>(1);

  // Group Category Tab
  const [activeGroup, setActiveGroup] = useState<'FINANCIAL' | 'CUSTOMERS' | 'SUPPLIERS' | 'EXPENSES' | 'REVENUES'>('FINANCIAL');

  // Step 1: Type Selection
  const [accountType, setAccountType] = useState<string>('INTERNAL_MASTER');

  // Currency: Default is BOTH currencies (MULTI = IQD + USD)
  const [currency, setCurrency] = useState<string>('MULTI');

  // Specific Parent Subcategory Selection for Expenses & Revenues
  const [expenseSubCategory, setExpenseSubCategory] = useState<string>('3319');
  const [revenueSubCategory, setRevenueSubCategory] = useState<string>('4231');

  // Step 1: Basic Form Fields
  const [nameAr, setNameAr] = useState<string>('');
  const [nameEn, setNameEn] = useState<string>('');
  const [nameEnManual, setNameEnManual] = useState(false);
  const [phone, setPhone] = useState<string>('');

  const handleNameArChange = (val: string) => {
    setNameAr(val);
    if (!nameEnManual) {
      setNameEn(arabicToEnglish(val));
    }
  };

  const handleNameEnChange = (val: string) => {
    setNameEn(val);
    setNameEnManual(true);
  };

  const [email, setEmail] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [contactPerson, setContactPerson] = useState<string>('');
  const [parentId, setParentId] = useState<string>('');
  const [parentManual, setParentManual] = useState(false);
  const [accountCode, setAccountCode] = useState<string>('');
  const [codeManual, setCodeManual] = useState(false);

  // Step 2: Financial & Scope Settings
  const [currentBranchId, setCurrentBranchId] = useState<string>('');

  useEffect(() => {
    if (!opened) return;
    const activeId = localStorage.getItem('active_branch_id') || localStorage.getItem('activeBranchId') || '';
    setCurrentBranchId(activeId);
  }, [opened]);

  // Credit Policy
  const [paymentMode, setPaymentMode] = useState<'CASH_ONLY' | 'CREDIT_ALLOWED'>('CASH_ONLY');
  const [creditLimit, setCreditLimit] = useState<string>('0');
  const [creditLimitUSD, setCreditLimitUSD] = useState<string>('0');
  const [paymentDays, setPaymentDays] = useState<string>('30');
  const [overduePolicy, setOverduePolicy] = useState<string>('BLOCK');

  // Account Role & Blocking
  const [accountRole, setAccountRole] = useState<'CUSTOMER' | 'SUPPLIER' | 'BOTH' | 'GENERAL'>('CUSTOMER');
  const [isBlocked, setIsBlocked] = useState<boolean>(false);

  // Collapsible Opening Balance Section
  const [openingBalanceOpen, setOpeningBalanceOpen] = useState<boolean>(false);
  const [openingNature, setOpeningNature] = useState<string>('DEBIT');
  const [openingAmount, setOpeningAmount] = useState<string>('0');
  const [openingAmountUSD, setOpeningAmountUSD] = useState<string>('0');
  const [openingDate, setOpeningDate] = useState<string>(getTodayInputDate);
  const [openingNotes, setOpeningNotes] = useState<string>('');

  // Populate data when in EDIT mode or reset when CREATE
  useEffect(() => {
    setStep(1);
    if (mode === 'EDIT' && initialData) {
      setNameAr(initialData.nameAr || '');
      setNameEn(initialData.nameEn || '');
      setNameEnManual(Boolean(initialData.nameEn));
      setPhone(initialData.phone || '');
      setEmail(initialData.email || '');
      setAddress(initialData.address || '');
      setContactPerson(initialData.contactPerson || '');
      setCurrency('MULTI');

      const rawRole = (initialData as any).accountRole;
      const initialCat = (initialData as any).category;
      const initialRole: 'CUSTOMER' | 'SUPPLIER' | 'BOTH' | 'GENERAL' = rawRole || (
        initialCat === 'CUSTOMER' ? 'CUSTOMER'
        : initialCat === 'SUPPLIER' ? 'SUPPLIER'
        : initialData.code.startsWith('161') ? 'CUSTOMER'
        : initialData.code.startsWith('261') ? 'SUPPLIER'
        : 'GENERAL'
      );
      setAccountRole(initialRole);
      setIsBlocked(Boolean((initialData as any).isBlocked || (initialData as any).isActive === false || ((initialData as any).overduePolicy === 'BLOCK' && (initialData as any).paymentMode === 'BLOCKED')));

      if (initialData.id) {
        accountsApi.getById(initialData.id).then((freshAcc) => {
          if (freshAcc) {
            if (freshAcc.accountRole) {
              setAccountRole(freshAcc.accountRole);
            }
            if (freshAcc.isBlocked !== undefined) {
              setIsBlocked(Boolean(freshAcc.isBlocked));
            }
            if (freshAcc.parentId) {
              setParentId(freshAcc.parentId);
              setParentManual(true);
            }
            if (freshAcc.code) {
              setAccountCode(String(freshAcc.code));
              setCodeManual(true);
            }
          }
        }).catch(() => {});
      }

      const opIQD = (initialData as any).openingAmountIQD ?? (initialData as any).openingBalance ?? (initialData as any).openingAmount ?? 0;
      const opUSD = (initialData as any).openingAmountUSD ?? 0;
      const opNat = (initialData as any).openingNature || 'DEBIT';
      const opDate = (initialData as any).openingDate ? new Date((initialData as any).openingDate).toISOString().split('T')[0] : getTodayInputDate();
      const opNotes = (initialData as any).openingNotes || '';

      setOpeningAmount(String(Math.abs(Number(opIQD))));
      setOpeningAmountUSD(String(Math.abs(Number(opUSD))));
      setOpeningNature(opNat);
      setOpeningDate(opDate);
      setOpeningNotes(opNotes);
      if (Number(opIQD) !== 0 || Number(opUSD) !== 0) {
        setOpeningBalanceOpen(true);
      } else {
        setOpeningBalanceOpen(false);
      }

      setCreditLimit(String(initialData.creditLimit ?? 0));
      setCreditLimitUSD(String(initialData.creditLimitUSD ?? 0));
      setPaymentDays(String(initialData.paymentDays ?? 0));
      setPaymentMode((initialData.paymentMode as any) || 'CASH_ONLY');
      setOverduePolicy(initialData.overduePolicy || 'BLOCK');
      setParentId(initialData.parentId || '');
      setParentManual(Boolean(initialData.parentId));
      setAccountCode(initialData.code || '');
      setCodeManual(true);

      const code = initialData.code || '';

      if (code.startsWith('13432') || code.startsWith('232146') || code.startsWith('232154')) {
        setActiveGroup('FINANCIAL');
        setAccountType('EXTERNAL_MASTER');
      } else if (code.startsWith('1343') || code.startsWith('134213') || code.startsWith('134223') || code.startsWith('134212') || code.startsWith('134222')) {
        setActiveGroup('FINANCIAL');
        setAccountType('CASHBOX');
      } else if (code.startsWith('1341')) {
        setActiveGroup('FINANCIAL');
        setAccountType('CASHBOX');
      } else if (code.startsWith('1342')) {
        setActiveGroup('FINANCIAL');
        setAccountType('BANK');
      } else if (code.startsWith('132141')) {
        setActiveGroup('CUSTOMERS');
        setAccountType(hasCashCustomerName(initialData.nameAr) || hasCashCustomerName(initialData.nameEn) ? 'CASH_CUSTOMER' : 'INDIVIDUAL_CLIENT');
      } else if (code.startsWith('132142')) {
        setActiveGroup('CUSTOMERS');
        setAccountType('CORPORATE_CLIENT');
      } else if (code.startsWith('132143')) {
        setActiveGroup('CUSTOMERS');
        setAccountType('TRAVEL_AGENCY');
      } else if (code.startsWith('132144')) {
        setActiveGroup('CUSTOMERS');
        setAccountType('SUB_AGENT');
      } else if (code.startsWith('13211')) {
        setActiveGroup('CUSTOMERS');
        setAccountType('PUBLIC_SECTOR_CLIENT');
      } else if (code.startsWith('13215')) {
        setActiveGroup('CUSTOMERS');
        setAccountType('FOREIGN_CLIENT');
      } else if (code.startsWith('232141') || code.startsWith('232151')) {
        setActiveGroup('SUPPLIERS');
        setAccountType('IATA_AIRLINE');
      } else if (code.startsWith('232142') || code.startsWith('232152')) {
        setActiveGroup('SUPPLIERS');
        setAccountType('TICKET_SUPPLIER');
      } else if (code.startsWith('232143') || code.startsWith('232153')) {
        setActiveGroup('SUPPLIERS');
        setAccountType('HOTEL_SUPPLIER');
      } else if (code.startsWith('232144')) {
        setActiveGroup('SUPPLIERS');
        setAccountType('VISA_SUPPLIER');
      } else if (code.startsWith('232145')) {
        setActiveGroup('SUPPLIERS');
        setAccountType('TOURISM_SUPPLIER');
      } else if (code.startsWith('3319')) {
        setActiveGroup('EXPENSES');
        setAccountType('GDS_SUBSCRIPTION');
      } else if (code.startsWith('3')) {
        setActiveGroup('EXPENSES');
        setAccountType('EXPENSE');
      } else if (code.startsWith('4')) {
        setActiveGroup('REVENUES');
        setAccountType('REVENUE');
      }
    } else {
      const initialType = defaultAccountType || 'INTERNAL_MASTER';
      setAccountType(initialType);
      setActiveGroup(
        initialType === 'CASH_CUSTOMER' || initialType.includes('CLIENT') || initialType === 'TRAVEL_AGENCY' || initialType === 'SUB_AGENT'
          ? 'CUSTOMERS'
          : initialType.includes('SUPPLIER') || initialType === 'IATA_AIRLINE'
            ? 'SUPPLIERS'
            : initialType === 'EXPENSE' || initialType === 'GDS_SUBSCRIPTION'
              ? 'EXPENSES'
              : initialType === 'REVENUE'
                ? 'REVENUES'
                : 'FINANCIAL',
      );
      setExpenseSubCategory('3');
      setRevenueSubCategory('4');
      setNameAr('');
      setNameEn('');
      setNameEnManual(false);
      setPhone('');
      setEmail('');
      setAddress('');
      setContactPerson('');
      setCurrency('MULTI');
      setParentId('');
      setParentManual(false);
      setAccountCode('');
      setCodeManual(false);
      setCreditLimit('0');
      setCreditLimitUSD('0');
      setPaymentDays('30');
      setPaymentMode('CASH_ONLY');
      setOverduePolicy('BLOCK');
      setOpeningBalanceOpen(false);
      setOpeningAmount('0');
      setOpeningAmountUSD('0');
      setOpeningNotes('');
      setOpeningNature('DEBIT');
      setOpeningDate(getTodayInputDate());
    }
  }, [mode, initialData, opened, defaultAccountType]);

  function getNextAvailableCode(parentCode: string, accounts: AccountNode[]): string {
    if (!parentCode) return '10101';
    if (!Array.isArray(accounts) || accounts.length === 0) return `${parentCode}01`;

    const parent = accounts.find((account) => String(account.code || '') === parentCode);
    const directChildren = parent?.children?.length
      ? parent.children
      : parent
        ? accounts.filter((account) => account.parentId === parent.id)
        : [];
    const childrenCodes = directChildren
      .map((account) => String(account.code || ''))
      .filter((code) => code.startsWith(parentCode) && code !== parentCode);

    if (childrenCodes.length === 0) {
      return `${parentCode}01`;
    }

    const suffixes = childrenCodes
      .map((c) => {
        const remainder = c.slice(parentCode.length);
        const num = parseInt(remainder, 10);
        return isNaN(num) ? 0 : num;
      })
      .filter((n) => n > 0);

    if (suffixes.length === 0) {
      return `${parentCode}01`;
    }

    const maxNum = Math.max(...suffixes);
    const nextNum = maxNum + 1;
    let padLen = 2;
    if (parentCode === '181' || parentCode === '182' || parentCode === '1614' || parentCode === '2614') padLen = 3;
    else padLen = Math.max(2, childrenCodes[0].slice(parentCode.length).length);
    return `${parentCode}${String(nextNum).padStart(padLen, '0')}`;
  }

  // Classification Engine
  const classificationRules = useMemo(() => {
    switch (accountType) {
      // 1. Customers (1614 - مدينون قطاع خاص / 1614200 - الموظفين)
      case 'CASH_CUSTOMER':
      case 'INDIVIDUAL_CLIENT':
      case 'CORPORATE_CLIENT':
      case 'TRAVEL_AGENCY':
      case 'SUB_AGENT':
      case 'FOREIGN_CLIENT':
      case 'PUBLIC_SECTOR_CLIENT':
        return {
          parentCode: '1614',
          controlAccount: isAr ? '1614 - مدينون قطاع خاص (العملاء)' : '1614 - Private Sector Debtors (Customers)',
          suggestedCode: initialData?.code || '',
          nature: 'DEBIT' as const,
          type: 'ASSET' as const,
          category: 'CUSTOMER' as const,
        };

      case 'STAFF_ADVANCE':
      case 'EMPLOYEE':
        return {
          parentCode: '1614200',
          controlAccount: isAr ? '1614200 - الموظفين وسلف الكادر' : '1614200 - Staff Advances & Employees',
          suggestedCode: initialData?.code || '',
          nature: 'DEBIT' as const,
          type: 'ASSET' as const,
          category: 'CUSTOMER' as const,
        };

      // 2. Suppliers (2614 - موردو التذاكر وشركات الطيران)
      case 'IATA_AIRLINE':
      case 'AIRLINE':
      case 'TICKET_SUPPLIER':
      case 'HOTEL_SUPPLIER':
      case 'VISA_SUPPLIER':
      case 'TOURISM_SUPPLIER':
        return {
          parentCode: '2614',
          controlAccount: isAr ? '2614 - موردو التذاكر وشركات الطيران' : '2614 - Ticket Suppliers & Airlines',
          suggestedCode: initialData?.code || '',
          nature: 'CREDIT' as const,
          type: 'LIABILITY' as const,
          category: 'SUPPLIER' as const,
        };

      // 3. Treasury, Cashboxes & Banks (181 نقدية بالصندوق / 182 نقدية لدى المصارف)
      case 'CASHBOX':
        return {
          parentCode: '181',
          controlAccount: isAr ? '181 - نقدية بالصندوق (الصناديق والقاصات)' : '181 - Cash on Hand (Cashboxes)',
          suggestedCode: initialData?.code || '',
          nature: 'DEBIT' as const,
          type: 'ASSET' as const,
          category: 'CASH' as const,
        };

      case 'BANK':
      case 'INTERNAL_MASTER':
      case 'EXTERNAL_MASTER':
        return {
          parentCode: '182',
          controlAccount: isAr ? '182 - نقدية لدى المصارف (البنوك والمحافظ)' : '182 - Cash at Banks & Wallets',
          suggestedCode: initialData?.code || '',
          nature: 'DEBIT' as const,
          type: 'ASSET' as const,
          category: 'BANK' as const,
        };

      // 4. Expenses (3 - الاستخدامات / المصروفات)
      case 'GDS_SUBSCRIPTION':
      case 'EXPENSE':
        return {
          parentCode: expenseSubCategory || '3',
          controlAccount: isAr ? `3 - الاستخدامات (المصروفات) [${expenseSubCategory || '3'}]` : `3 - Operating Expenses [${expenseSubCategory || '3'}]`,
          suggestedCode: initialData?.code || '',
          nature: 'DEBIT' as const,
          type: 'EXPENSE' as const,
          category: 'GENERAL' as const,
        };

      // 5. Revenues (4 - الموارد / الإيرادات)
      case 'REVENUE':
        return {
          parentCode: revenueSubCategory || '4',
          controlAccount: isAr ? `4 - الموارد (الإيرادات) [${revenueSubCategory || '4'}]` : `4 - Revenues [${revenueSubCategory || '4'}]`,
          suggestedCode: initialData?.code || '',
          nature: 'CREDIT' as const,
          type: 'REVENUE' as const,
          category: 'GENERAL' as const,
        };

      default:
        return {
          parentCode: '1614',
          controlAccount: isAr ? '1614 - مدينون قطاع خاص (العملاء)' : '1614 - Private Sector Debtors',
          suggestedCode: initialData?.code || '',
          nature: 'DEBIT' as const,
          type: 'ASSET' as const,
          category: 'CUSTOMER' as const,
        };
    }
  }, [accountType, expenseSubCategory, revenueSubCategory, initialData, isAr]);

  const flatAccounts = useMemo(() => {
    if (!opened) return [];
    const flat: AccountNode[] = [];
    const visited = new Set<string>();
    const walk = (nodes: AccountNode[]) => {
      for (const node of nodes || []) {
        const key = node.id || node.code;
        if (key && visited.has(key)) continue;
        if (key) visited.add(key);
        flat.push(node);
        if (node.children?.length) walk(node.children);
      }
    };
    walk(allAccounts);
    return flat;
  }, [opened, allAccounts]);

  const blockedParentIds = useMemo(() => {
    const blocked = new Set<string>();
    if (mode !== 'EDIT' || !initialData?.id) return blocked;
    const mark = (nodes: AccountNode[]) => {
      for (const node of nodes || []) {
        blocked.add(node.id);
        if (node.children?.length) mark(node.children);
      }
    };
    mark(initialData.children || []);
    blocked.add(initialData.id);
    return blocked;
  }, [mode, initialData]);

  const parentOptions = useMemo(() => {
    if (!opened) return [];
    const groups = flatAccounts.filter((account) => {
      if (blockedParentIds.has(account.id)) return false;
      return account.isGroup || Boolean(account.children?.length) || account.id === parentId;
    });
    const source = groups.length > 0 ? groups : flatAccounts.filter((account) => !blockedParentIds.has(account.id));
    return source.map((account) => ({
        value: account.id,
        label: isAr ? account.nameAr : (account.nameEn || account.nameAr),
        name: account.nameAr,
        nameAr: account.nameAr,
        nameEn: account.nameEn,
      }));
  }, [opened, flatAccounts, blockedParentIds, isAr, parentId]);

  useEffect(() => {
    if (!opened || parentManual) return;
    const suggested = flatAccounts.find((account) => account.code === classificationRules.parentCode);
    if (suggested) setParentId(suggested.id);
  }, [opened, parentManual, classificationRules.parentCode, flatAccounts]);

  useEffect(() => {
    if (!opened || codeManual) return;
    const parent = flatAccounts.find((account) => account.id === parentId);
    if (!parent) return;
    setAccountCode(getNextAvailableCode(parent.code, flatAccounts));
  }, [opened, codeManual, parentId, allAccounts, flatAccounts]);

  const parentAccount = flatAccounts.find((account) => account.id === parentId);
  const finalParentCode = parentAccount?.code || '';
  const finalCode = accountCode.trim() || classificationRules.suggestedCode;
  const isCashCustomer = activeGroup === 'CUSTOMERS' && accountType === 'CASH_CUSTOMER';

  const selectCustomerType = (type: 'CASH_CUSTOMER' | 'INDIVIDUAL_CLIENT' | 'CORPORATE_CLIENT') => {
    const wasCashCustomer = accountType === 'CASH_CUSTOMER';
    setAccountType(type);
    setParentManual(false);
    setCodeManual(false);
    if (type === 'CASH_CUSTOMER') {
      setNameAr(CASH_CUSTOMER_NAME_AR);
      setNameEn(CASH_CUSTOMER_NAME_EN);
      setNameEnManual(false);
      setPhone('');
      setEmail('');
      setAddress('');
      setContactPerson('');
      setPaymentMode('CASH_ONLY');
      setCreditLimit('0');
      setCreditLimitUSD('0');
      setPaymentDays('0');
    } else if (wasCashCustomer) {
      setNameAr('');
      setNameEn('');
      setNameEnManual(false);
      setPaymentDays('30');
    }
  };

  const selectGroup = (id: typeof activeGroup) => {
    setActiveGroup(id);
    setParentManual(false);
    setCodeManual(false);
    if (id === 'FINANCIAL') {
      setAccountType('CASHBOX');
      setAccountRole('GENERAL');
    } else if (id === 'CUSTOMERS') {
      selectCustomerType('CASH_CUSTOMER');
      setAccountRole('CUSTOMER');
    } else if (id === 'SUPPLIERS') {
      setAccountType('IATA_AIRLINE');
      setAccountRole('SUPPLIER');
    } else if (id === 'EXPENSES') {
      setAccountType('GDS_SUBSCRIPTION');
      setAccountRole('GENERAL');
    } else if (id === 'REVENUES') {
      setAccountType('REVENUE');
      setAccountRole('GENERAL');
    }
  };

  const chipClass = (active: boolean) =>
    `flex min-h-10 items-center gap-2 px-3 rounded-xl border text-start text-xs font-bold cursor-pointer transition-colors ${
      active
        ? 'bg-[#F45A0A] text-white border-[#F45A0A]'
        : 'bg-white border-slate-200 text-slate-700 hover:border-orange-200 hover:bg-orange-50'
    }`;

  const fieldClassNames = {
    label: '!font-bold !text-slate-800 text-[12.5px] mb-[7px]',
    input: 'h-[46px] rounded-[11px] border-[#E5E7EB] bg-[#FAFAFA] font-semibold',
  };

  const groupTabs = [
    { id: 'FINANCIAL' as const, label: isAr ? 'المالية' : 'Financial', icon: <IconWallet size={16} /> },
    { id: 'CUSTOMERS' as const, label: isAr ? 'العملاء' : 'Customers', icon: <IconUsers size={16} /> },
    { id: 'SUPPLIERS' as const, label: isAr ? 'الموردون' : 'Suppliers', icon: <IconPlane size={16} /> },
    { id: 'EXPENSES' as const, label: isAr ? 'المصروفات' : 'Expenses', icon: <IconCashBanknote size={16} /> },
    { id: 'REVENUES' as const, label: isAr ? 'الإيرادات' : 'Revenue', icon: <IconReceipt size={16} /> },
  ];

  const typeItems =
    activeGroup === 'FINANCIAL'
      ? [
          { id: 'INTERNAL_MASTER', label: isAr ? 'ماستر داخلي' : 'Internal Master', icon: <IconCreditCard size={16} /> },
          { id: 'EXTERNAL_MASTER', label: isAr ? 'ماستر خارجي' : 'External Master', icon: <IconCreditCard size={16} /> },
          { id: 'CASHBOX', label: isAr ? 'صندوق' : 'Cashbox', icon: <IconWallet size={16} /> },
          { id: 'BANK', label: isAr ? 'بنك' : 'Bank', icon: <IconBuildingBank size={16} /> },
        ]
      : activeGroup === 'CUSTOMERS'
        ? [
            { id: 'CASH_CUSTOMER', label: isAr ? 'زبون نقدي' : 'Cash Customer', icon: <IconCashBanknote size={16} /> },
            { id: 'INDIVIDUAL_CLIENT', label: isAr ? 'أفراد' : 'Individuals', icon: <IconUser size={16} /> },
            { id: 'CORPORATE_CLIENT', label: isAr ? 'شركة' : 'Company', icon: <IconBuilding size={16} /> },
          ]
        : activeGroup === 'SUPPLIERS'
          ? [
              { id: 'IATA_AIRLINE', label: isAr ? 'شركة طيران' : 'Airline', icon: <IconPlane size={16} /> },
              { id: 'TICKET_SUPPLIER', label: isAr ? 'مورد تذاكر' : 'Ticket Supplier', icon: <IconTicket size={16} /> },
              { id: 'HOTEL_SUPPLIER', label: isAr ? 'مورد فنادق' : 'Hotel Supplier', icon: <IconBed size={16} /> },
              { id: 'VISA_SUPPLIER', label: isAr ? 'مورد فيزا' : 'Visa Supplier', icon: <IconId size={16} /> },
              { id: 'TOURISM_SUPPLIER', label: isAr ? 'مورد سياحة' : 'Tour Supplier', icon: <IconWorld size={16} /> },
            ]
          : activeGroup === 'EXPENSES'
            ? [
                { id: 'GDS_SUBSCRIPTION', label: isAr ? 'اشتراكات GDS' : 'GDS Subscriptions', icon: <IconDeviceDesktopAnalytics size={16} /> },
                { id: 'EXPENSE', label: isAr ? 'مصروف تشغيلي' : 'Operating Expense', icon: <IconReceipt size={16} /> },
              ]
            : [];

  const selectedTypeLabel = typeItems.find((item) => item.id === accountType)?.label
    || (activeGroup === 'REVENUES' ? (isAr ? 'إيراد' : 'Revenue') : '');

  const parentDisplayName = parentAccount
    ? (isAr ? parentAccount.nameAr : (parentAccount.nameEn || parentAccount.nameAr))
    : '';

  const validateStepOne = () => {
    if (!nameAr.trim()) {
      showErrorNotification(isAr ? 'اسم الحساب مطلوب' : 'Account name required', isAr ? 'أدخل اسم الحساب بالعربية للمتابعة.' : 'Enter the Arabic account name to continue.');
      return false;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      showErrorNotification(isAr ? 'البريد الإلكتروني غير صحيح' : 'Invalid email', isAr ? 'تحقق من صيغة البريد الإلكتروني.' : 'Check the email address format.');
      return false;
    }
    if (accountsLoading) {
      showErrorNotification(isAr ? 'شجرة الحسابات قيد التحميل' : 'Accounts are loading', isAr ? 'انتظر اكتمال تحميل الدليل المحاسبي.' : 'Wait for the chart of accounts to finish loading.');
      return false;
    }
    if (accountsError) {
      showErrorNotification(isAr ? 'تعذر تحميل الدليل' : 'Chart unavailable', isAr ? 'أغلق النافذة وأعد فتحها بعد التحقق من الاتصال.' : 'Close and reopen the window after checking the connection.');
      return false;
    }
    const unchangedLegacyCode = mode === 'EDIT' && finalCode === initialData?.code;
    if (!/^\d{3,20}$/.test(finalCode) && !unchangedLegacyCode) {
      showErrorNotification(isAr ? 'رمز الحساب غير صالح' : 'Invalid account code', isAr ? 'يجب أن يتكون رمز الحساب من أرقام فقط.' : 'The account code must contain digits only.');
      return false;
    }
    if (!parentAccount) {
      showErrorNotification(isAr ? 'الحساب الأب مطلوب' : 'Parent account required', isAr ? 'حدد حساب الأب من الدليل قبل الحفظ.' : 'Select a parent account from the chart before saving.');
      return false;
    }
    if (!unchangedLegacyCode && (finalCode === finalParentCode || !finalCode.startsWith(finalParentCode))) {
      showErrorNotification(isAr ? 'مسار الرمز غير صحيح' : 'Invalid code hierarchy', isAr ? 'يجب أن يبدأ رمز الحساب برمز الحساب الأب.' : 'The account code must begin with its parent account code.');
      return false;
    }
    const duplicate = flatAccounts.some((account) => account.code === finalCode && account.id !== initialData?.id);
    if (duplicate) {
      showErrorNotification(isAr ? 'رمز مستخدم' : 'Code already used', isAr ? `رمز الحساب (${finalCode}) مستخدم مسبقاً.` : `Account code (${finalCode}) is already in use.`);
      return false;
    }
    return true;
  };

  const goToStepTwo = () => {
    if (validateStepOne()) setStep(2);
  };

  const parseAmount = (value: string) => Number(String(value || '0').replace(/,/g, ''));

  const validateStepTwo = () => {
    const amountIQD = parseAmount(openingAmount);
    const amountUSD = parseAmount(openingAmountUSD);
    if (!Number.isFinite(amountIQD) || !Number.isFinite(amountUSD) || amountIQD < 0 || amountUSD < 0) {
      showErrorNotification(isAr ? 'الرصيد الافتتاحي غير صحيح' : 'Invalid opening balance', isAr ? 'يجب أن تكون مبالغ الرصيد أرقاماً غير سالبة.' : 'Opening balance amounts must be non-negative numbers.');
      return false;
    }
    return true;
  };

  const handleSave = async (addAnother = false) => {
    if (!validateStepOne() || !validateStepTwo()) return;

    setSaving(true);
    try {
      const effectivePaymentMode = isCashCustomer ? 'CASH_ONLY' : paymentMode;
      const payload = {
        code: finalCode,
        nameAr: nameAr.trim(),
        nameEn: nameEn.trim() || undefined,
        type: classificationRules.type,
        category: classificationRules.category,
        accountRole,
        isBlocked,
        parentId: parentAccount!.id,
        branchScope: 'CURRENT_BRANCH',
        currency: 'MULTI',
        branchIds: currentBranchId ? [currentBranchId] : [],
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        contactPerson: contactPerson.trim() || undefined,
        creditLimit: 0,
        creditLimitUSD: 0,
        paymentDays: 0,
        paymentMode: effectivePaymentMode,
        overduePolicy: isBlocked ? 'BLOCK' : overduePolicy,
        ...(parseAmount(openingAmount) > 0 || parseAmount(openingAmountUSD) > 0 ? {
          openingAmountIQD: currency !== 'USD' ? parseAmount(openingAmount) : 0,
          openingAmountUSD: currency !== 'IQD' ? parseAmount(openingAmountUSD) : 0,
          openingNature,
          openingDate: getTodayInputDate(),
        } : {}),
      };

      if (mode === 'EDIT' && initialData) {
        await accountsApi.update(initialData.id, payload);
      } else {
        await accountsApi.create(payload);
      }

      const actionLabel = mode === 'EDIT' ? (isAr ? 'تحديث وتعديل' : 'Updated') : (isAr ? 'إنشاء' : 'Created');
      showSuccessNotification(
        isAr ? 'تمت العملية بنجاح' : 'Success',
        isAr ? `تم ${actionLabel} الحساب المحاسبي (${nameAr}) بنجاح.` : `Account (${nameAr}) was ${actionLabel.toLowerCase()} successfully.`
      );
      onSuccess();
      if (addAnother) {
        setNameAr(isCashCustomer ? CASH_CUSTOMER_NAME_AR : '');
        setNameEn(isCashCustomer ? CASH_CUSTOMER_NAME_EN : '');
        setNameEnManual(false);
        setPhone('');
        setEmail('');
        setAddress('');
        setContactPerson('');
        setAccountCode('');
        setCodeManual(false);
        setParentManual(false);
        setPaymentMode('CASH_ONLY');
        setCreditLimit('0');
        setCreditLimitUSD('0');
        setOpeningBalanceOpen(false);
        setOpeningAmount('0');
        setOpeningAmountUSD('0');
        setOpeningNotes('');
        setOpeningDate(getTodayInputDate());
        setStep(1);
      } else {
        onClose();
      }
    } catch (err: any) {
      showErrorNotification(isAr ? 'تعذر حفظ الحساب' : 'Save Error', err.message || (isAr ? 'حدث خطأ أثناء حفظ الحساب المحاسبي' : 'An error occurred while saving the account.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <div className="flex w-full items-center justify-between gap-4 pe-8" dir={direction}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F45A0A] shrink-0">
              <IconWand size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-[15px] text-slate-900 leading-tight truncate">
                {mode === 'EDIT'
                  ? (isAr ? 'تعديل الحساب' : 'Edit account')
                  : (isAr ? 'إضافة حساب جديد' : 'Add new account')}
              </h3>
              <p className="text-[11.5px] text-slate-500 font-medium mt-0.5 truncate">
                {isAr ? 'دليل الحسابات' : 'Chart of accounts'}
                {selectedTypeLabel ? ` · ${selectedTypeLabel}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setStep(1)}
              className={`h-8 px-3 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                step === 1 ? 'bg-[#F45A0A] text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="font-mono tabular-nums lining-nums">1</span>
              <span className="ms-1">{isAr ? 'البيانات' : 'Details'}</span>
            </button>
            <button
              type="button"
              onClick={goToStepTwo}
              className={`h-8 px-3 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                step === 2 ? 'bg-[#F45A0A] text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="font-mono tabular-nums lining-nums">2</span>
              <span className="ms-1">{isAr ? 'الإعدادات' : 'Settings'}</span>
            </button>
          </div>
        </div>
      }
      size="960px"
      padding={0}
      radius="16px"
      centered
      styles={{
        content: {
          height: 'min(720px, 92dvh)',
          maxHeight: '92dvh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '16px',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
        },
        header: {
          minHeight: '76px',
          padding: '14px 18px',
          borderBottom: '1px solid #e2e8f0',
          background: '#ffffff',
        },
        body: {
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          padding: 0,
        },
      }}
      overlayProps={{ opacity: 0.35, blur: 0 }}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden text-xs select-none font-sans font-medium [&_.mantine-InputWrapper-label]:font-bold [&_.mantine-Input-input]:font-semibold" dir={direction}>
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 bg-white">
          {(accountsLoading || accountsError) && (
            <div className={`mx-4 mt-4 flex items-center gap-2 rounded-xl border px-3 py-2 text-[11.5px] font-semibold ${accountsError ? 'border-red-200 bg-red-50 text-red-700' : 'border-orange-200 bg-orange-50 text-[#C2410C]'}`}>
              {accountsError ? <IconAlertCircle size={16} /> : <IconLoader2 size={16} className="animate-spin" />}
              <span>{accountsError ? (isAr ? 'تعذر تحميل شجرة الحسابات؛ الحفظ متوقف لحماية الترابط المحاسبي.' : 'Chart loading failed; saving is blocked to protect account hierarchy.') : (isAr ? 'جارٍ التحقق من شجرة الحسابات والرمز المقترح...' : 'Validating the account tree and suggested code...')}</span>
            </div>
          )}
          {step === 1 && (
            <div className="flex min-h-full flex-col lg:flex-row">
              <aside className="w-full lg:w-[248px] shrink-0 border-b lg:border-b-0 lg:border-e border-slate-200 bg-slate-50/70 p-4 space-y-4">
                <div>
                  <p className="text-[11px] font-extrabold text-slate-500 mb-2">
                    {isAr ? 'التصنيف' : 'Category'}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-1 gap-1.5">
                    {groupTabs.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => selectGroup(tab.id)}
                        className={`flex min-h-10 items-center gap-2 px-3 rounded-xl border text-start text-xs font-bold cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${
                          activeGroup === tab.id
                            ? 'bg-[#F45A0A] text-white border-[#F45A0A]'
                            : 'bg-transparent border-transparent text-slate-600 hover:bg-white hover:border-slate-200'
                        }`}
                      >
                        <span className={activeGroup === tab.id ? 'text-white' : 'text-slate-400'}>{tab.icon}</span>
                        <span>{tab.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-extrabold text-slate-500 mb-2">
                    {isAr ? 'النوع' : 'Type'}
                  </p>
                  {typeItems.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5">
                      {typeItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            if (activeGroup === 'CUSTOMERS') {
                              selectCustomerType(item.id as 'CASH_CUSTOMER' | 'INDIVIDUAL_CLIENT' | 'CORPORATE_CLIENT');
                            } else {
                              setAccountType(item.id);
                              setParentManual(false);
                              setCodeManual(false);
                            }
                          }}
                          className={chipClass(accountType === item.id)}
                        >
                          <span className={accountType === item.id ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                      {isAr ? 'اختر الحساب الأب من الدليل لوضع الإيراد في مكانه الصحيح.' : 'Choose the parent account to place this revenue in the chart.'}
                    </p>
                  )}
                  {(activeGroup === 'EXPENSES' || activeGroup === 'REVENUES') && typeItems.length > 0 && (
                    <p className="mt-2 text-[11px] text-slate-500 font-medium leading-relaxed">
                      {isAr ? 'حدد الحساب الأب من الدليل لوضعه في المسار الصحيح.' : 'Pick the parent account to place it in the correct path.'}
                    </p>
                  )}
                </div>
              </aside>

              <section className="min-w-0 flex-1 p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-orange-200 bg-[#FFF3E8] px-3.5 py-2.5">
                  <IconCoins size={16} className="text-[#F45A0A] shrink-0" />
                  <span className="text-xs font-extrabold text-[#DD4F05] font-mono tabular-nums lining-nums">IQD + USD</span>
                  <span className="text-[11px] text-slate-600 font-medium">
                    {isAr ? 'كل الحسابات تدعم العملتين معاً' : 'Every account supports both currencies'}
                  </span>
                  <span className="ms-auto text-[11px] font-bold text-slate-600">
                    {classificationRules.nature === 'DEBIT' ? (isAr ? 'طبيعة: مدين' : 'Nature: Debit') : (isAr ? 'طبيعة: دائن' : 'Nature: Credit')}
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <SearchableCombobox
                    label={isAr ? 'حساب الأب' : 'Parent account'}
                    required
                    value={parentId}
                    onChange={(value) => {
                      setParentId(value);
                      setParentManual(true);
                      setCodeManual(false);
                    }}
                    options={parentOptions}
                    placeholder={isAr ? 'ابحث باسم الحساب الأب...' : 'Search parent account name...'}
                    disabled={accountsLoading}
                    clearable={false}
                    maxRendered={80}
                  />
                  <div>
                    <label className="block text-[12.5px] font-bold text-slate-800 mb-[7px]">
                      {isAr ? 'رمز الحساب' : 'Account code'}
                      <span className="text-red-500 ms-0.5">*</span>
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      inputMode="numeric"
                      value={finalCode}
                      onChange={(e) => {
                        setAccountCode(e.target.value.replace(/[^\d]/g, ''));
                        setCodeManual(true);
                      }}
                      className="w-full h-[46px] px-3.5 rounded-[11px] border border-[#E5E7EB] bg-[#FAFAFA] hover:bg-white focus:bg-white focus:border-[#F45A0A] outline-none font-mono font-extrabold tabular-nums lining-nums text-slate-900 text-sm"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      {parentAccount
                        ? (isAr ? `مرتبط بـ ${parentDisplayName}` : `Linked to ${parentDisplayName}`)
                        : (isAr ? 'حدد الحساب الأب أولاً' : 'Select a parent account first')}
                    </p>
                  </div>
                </div>

                {!isCashCustomer && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <TextInput
                      label={isAr ? 'اسم الحساب' : 'Account name'}
                      placeholder={isAr ? 'أدخل الاسم' : 'Enter name'}
                      required
                      value={nameAr}
                      onChange={(e) => handleNameArChange(e.target.value)}
                      classNames={fieldClassNames}
                    />
                    <TextInput
                      label={isAr ? 'الاسم الإنجليزي' : 'English name'}
                      placeholder="English name"
                      value={nameEn}
                      onChange={(e) => handleNameEnChange(e.target.value)}
                      classNames={fieldClassNames}
                    />
                  </div>
                )}

                {isCashCustomer && (
                  <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                    <p className="text-xs font-extrabold text-slate-800">{isAr ? 'زبون نقدي' : 'Cash Customer'}</p>
                    <p className="text-[11px] text-slate-500 mt-1 font-medium">
                      {isAr ? 'يُنشأ باسم ثابت ولا يحتاج بيانات اتصال.' : 'Created with a fixed name and no contact details.'}
                    </p>
                  </div>
                )}

                {((activeGroup === 'CUSTOMERS' && !isCashCustomer) || activeGroup === 'SUPPLIERS') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <TextInput label={isAr ? 'الهاتف' : 'Phone'} placeholder="07701234567" value={phone} onChange={(e) => setPhone(e.target.value)} classNames={fieldClassNames} />
                    {(accountType === 'CORPORATE_CLIENT' || activeGroup === 'SUPPLIERS') && (
                      <TextInput label={isAr ? 'مسؤول الاتصال' : 'Contact'} placeholder={isAr ? 'الاسم' : 'Name'} value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} classNames={fieldClassNames} />
                    )}
                    <TextInput label={isAr ? 'البريد' : 'Email'} placeholder="contact@example.com" value={email} onChange={(e) => setEmail(e.target.value)} classNames={fieldClassNames} />
                    <TextInput label={isAr ? 'العنوان' : 'Address'} placeholder={isAr ? 'المحافظة والمنطقة' : 'City and district'} value={address} onChange={(e) => setAddress(e.target.value)} classNames={fieldClassNames} />
                  </div>
                )}
              </section>
            </div>
          )}

          {/* STEP 2: Financial Settings & Final Review */}
          {step === 2 && (
            <div className="p-4 sm:p-5 space-y-4">
              {/* 1. Account Business Role & Transaction Treatment */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#F45A0A] flex items-center justify-center font-bold">
                    <IconUsers size={18} />
                  </div>
                  <div>
                    <span className="font-extrabold text-xs text-slate-900 block">
                      {isAr ? 'طبيعة التعامل والتصنيف التجاري' : 'Business Role & Treatment'}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {isAr ? 'حدد كيف يعامل الحساب في شاشات وفواتير وسندات النظام' : 'Configure where this account appears in invoices and operations'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { id: 'CUSTOMER', label: isAr ? 'يعامل كعميل' : 'Customer', desc: isAr ? 'فواتير وسندات القبض' : 'Invoices & Receipts', icon: <IconUser size={16} /> },
                    { id: 'SUPPLIER', label: isAr ? 'يعامل كمورد' : 'Supplier', desc: isAr ? 'المشتريات وسندات الصرف' : 'Purchases & Payments', icon: <IconPlane size={16} /> },
                    { id: 'BOTH', label: isAr ? 'عميل ومورد معاً' : 'Customer & Supplier', desc: isAr ? 'كل العمليات' : 'All Operations', icon: <IconWorld size={16} /> },
                    { id: 'GENERAL', label: isAr ? 'حساب عام / مالي' : 'General / Financial', desc: isAr ? 'صندوق، بنك، مصروف، إيراد' : 'Cash, Bank, Expense', icon: <IconWallet size={16} /> },
                  ].map((role) => (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => setAccountRole(role.id as any)}
                      className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-start transition-colors cursor-pointer ${
                        accountRole === role.id
                          ? 'bg-[#F45A0A] text-white border-[#F45A0A]'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-orange-200 hover:bg-orange-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <span className={accountRole === role.id ? 'text-white' : 'text-slate-400'}>{role.icon}</span>
                        <span>{role.label}</span>
                      </div>
                      <span className={`text-[10px] font-medium line-clamp-1 ${accountRole === role.id ? 'text-white/80' : 'text-slate-500'}`}>{role.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 h-11 px-3 rounded-xl border border-slate-200 bg-white">
                  <span className={`text-xs font-extrabold ${!isBlocked ? 'text-[#F45A0A]' : 'text-slate-400'}`}>
                    {!isBlocked ? (isAr ? 'نشط' : 'Active') : (isAr ? 'موقوف' : 'Blocked')}
                  </span>
                  <Switch
                    size="md"
                    color="orange"
                    checked={!isBlocked}
                    onChange={(event) => setIsBlocked(!event.currentTarget.checked)}
                  />
                </div>
                {!isCashCustomer && (accountRole === 'CUSTOMER' || accountRole === 'SUPPLIER' || accountRole === 'BOTH') && (
                  <div className="flex items-center gap-2 h-11 px-3 rounded-xl border border-slate-200 bg-white">
                    <span className={`text-xs font-extrabold ${paymentMode === 'CREDIT_ALLOWED' ? 'text-[#F45A0A]' : 'text-slate-400'}`}>
                      {paymentMode === 'CREDIT_ALLOWED' ? (isAr ? 'آجل' : 'Credit') : (isAr ? 'نقد' : 'Cash')}
                    </span>
                    <Switch
                      size="md"
                      color="orange"
                      checked={paymentMode === 'CREDIT_ALLOWED'}
                      onChange={(event) => setPaymentMode(event.currentTarget.checked ? 'CREDIT_ALLOWED' : 'CASH_ONLY')}
                    />
                  </div>
                )}
                <div className="flex items-center gap-2 h-11 px-3 rounded-xl border border-slate-200 bg-white">
                  <span className={`text-xs font-extrabold ${openingNature === 'DEBIT' ? 'text-[#F45A0A]' : 'text-slate-400'}`}>
                    {openingNature === 'DEBIT' ? (isAr ? 'مدين' : 'Debit') : (isAr ? 'دائن' : 'Credit')}
                  </span>
                  <Switch
                    size="md"
                    color="orange"
                    checked={openingNature === 'DEBIT'}
                    onChange={(event) => setOpeningNature(event.currentTarget.checked ? 'DEBIT' : 'CREDIT')}
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#F45A0A] flex items-center justify-center font-bold">
                    <IconWallet size={18} />
                  </div>
                  <div>
                    <span className="font-extrabold text-xs text-slate-900 block">
                      {isAr ? 'الرصيد الافتتاحي' : 'Opening Balance'}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {isAr ? 'أدخل قيمة الرصيد الأولي إن وجد' : 'Enter an opening balance if applicable'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <FormattedNumberInput
                    label={isAr ? 'رصيد الدينار (IQD)' : 'IQD Amount'}
                    value={openingAmount}
                    onChange={setOpeningAmount}
                    styles={{ input: { height: 56, minHeight: 56 } }}
                    classNames={{
                      label: '!font-bold !text-slate-800 text-[12.5px] mb-[7px]',
                      input: 'h-[56px] min-h-[56px] rounded-[11px] border-[#E5E7EB] bg-[#FAFAFA] font-mono font-extrabold tabular-nums lining-nums text-[20px] text-slate-900',
                    }}
                  />
                  <FormattedNumberInput
                    label={isAr ? 'رصيد الدولار (USD)' : 'USD Amount'}
                    value={openingAmountUSD}
                    onChange={setOpeningAmountUSD}
                    styles={{ input: { height: 56, minHeight: 56 } }}
                    classNames={{
                      label: '!font-bold !text-slate-800 text-[12.5px] mb-[7px]',
                      input: 'h-[56px] min-h-[56px] rounded-[11px] border-[#E5E7EB] bg-[#FAFAFA] font-mono font-extrabold tabular-nums lining-nums text-[20px] text-slate-900',
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── 3. ACTION FOOTER BUTTONS ── */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2.5 border-t border-slate-200 bg-white px-4 sm:px-5 py-3 mt-auto">
          {step === 2 ? (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="h-11 w-full sm:w-auto px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {direction === 'rtl' ? <IconArrowRight size={14} /> : <IconArrowLeft size={14} />}
              <span>{isAr ? 'رجوع' : 'Back'}</span>
            </button>
          ) : (
            <div />
          )}

          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
            <button
              type="button"
              onClick={onClose}
              className="h-11 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-semibold text-xs transition-colors cursor-pointer"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            {step === 1 ? (
              <button
                type="button"
                onClick={goToStepTwo}
                disabled={accountsLoading}
                className="h-11 px-5 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>{isAr ? 'التالي' : 'Next'}</span>
                {direction === 'rtl' ? <IconArrowLeft size={14} /> : <IconArrowRight size={14} />}
              </button>
            ) : (
              <>
                {mode === 'CREATE' && (
                  <button
                    type="button"
                    onClick={() => handleSave(true)}
                    disabled={saving}
                    className="h-11 px-3 rounded-xl border border-[#F45A0A] bg-orange-50 hover:bg-orange-100 text-[#C2410C] font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <IconPlus size={14} />
                    <span>{isAr ? 'إنشاء وإضافة آخر' : 'Create & Add Another'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  className="col-span-2 h-11 px-5 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 sm:col-auto"
                >
                  <IconCheck size={14} />
                  <span>{mode === 'EDIT' ? (isAr ? 'تحديث الحساب' : 'Update Account') : (isAr ? 'إنشاء الحساب' : 'Create Account')}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default SmartAccountWizardModal;
