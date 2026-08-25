import React, { useState, useMemo, useEffect } from 'react';
import {
  Modal,
  TextInput,
  Select,
  SegmentedControl,
  MultiSelect,
  Switch,
} from '@mantine/core';
import { branchesApi, type Branch } from '../../api/branches';
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
  IconEdit,
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
  IconBuildingCommunity,
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
      .getTree()
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
  // Accounting Suggestion Override State
  const [showOverrideFields, setShowOverrideFields] = useState<boolean>(false);
  const [manualParentCode, setManualParentCode] = useState<string>('');
  const [manualCode, setManualCode] = useState<string>('');

  // Step 2: Financial & Scope Settings
  const [branchScope, setBranchScope] = useState<string>('CURRENT_BRANCH');
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchesError, setBranchesError] = useState(false);

  // Fetch branches from database
  useEffect(() => {
    if (!opened) return;
    let isMounted = true;
    setBranchesLoading(true);
    setBranchesError(false);
    branchesApi.getAll().then((data) => {
      if (!isMounted) return;
      setBranches(data);
      const activeBranchId = localStorage.getItem('active_branch_id') || localStorage.getItem('activeBranchId');
      const active = data.find((b) => b.id === activeBranchId) || data.find((b) => b.isMain) || data[0];
      if (active) {
        setCurrentBranch(active);
        if (mode === 'CREATE') setSelectedBranches([active.id]);
      }
    }).catch(() => {
      if (isMounted) setBranchesError(true);
    }).finally(() => {
      if (isMounted) setBranchesLoading(false);
    });
    return () => {
      isMounted = false;
    };
  }, [opened, mode]);

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
      setCurrency(initialData.currency || 'MULTI');
      setBranchScope(initialData.scope || 'ALL_BRANCHES');

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

      if (initialData.branchIds && initialData.branchIds.length > 0) {
        setSelectedBranches(initialData.branchIds);
      }
      setCreditLimit(String(initialData.creditLimit ?? 0));
      setCreditLimitUSD(String(initialData.creditLimitUSD ?? 0));
      setPaymentDays(String(initialData.paymentDays ?? 0));
      setPaymentMode((initialData.paymentMode as any) || 'CASH_ONLY');
      setOverduePolicy(initialData.overduePolicy || 'BLOCK');
      setShowOverrideFields(false);
      setManualParentCode('');
      setManualCode('');

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
      setShowOverrideFields(false);
      setManualParentCode('');
      setManualCode('');
      setBranchScope('CURRENT_BRANCH');
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

    const flat: AccountNode[] = [];
    const visited = new Set<string>();

    const walk = (nodes: AccountNode[]) => {
      if (!Array.isArray(nodes)) return;
      for (const n of nodes) {
        if (!n) continue;
        const key = n.id || n.code;
        if (key) {
          if (visited.has(key)) continue;
          visited.add(key);
        }
        flat.push(n);
        if (n.children && Array.isArray(n.children) && n.children.length > 0) {
          walk(n.children);
        }
      }
    };
    walk(accounts);

    const parent = flat.find((account) => String(account.code || '') === parentCode);
    const directChildren = parent?.children?.length
      ? parent.children
      : parent
        ? flat.filter((account) => account.parentId === parent.id)
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
    // Format based on parent code convention
    let padLen = 3;
    if (parentCode === '181' || parentCode === '182') padLen = 3;
    else if (parentCode === '1614' || parentCode === '2614') padLen = 3;
    else if (childrenCodes.length > 0) {
      padLen = Math.max(2, childrenCodes[0].slice(parentCode.length).length);
    }
    const paddedNext = String(nextNum).padStart(padLen, '0');

    return `${parentCode}${paddedNext}`;
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
          suggestedCode: initialData?.code || getNextAvailableCode('1614', allAccounts),
          nature: 'DEBIT' as const,
          type: 'ASSET' as const,
          category: 'CUSTOMER' as const,
        };

      case 'STAFF_ADVANCE':
      case 'EMPLOYEE':
        return {
          parentCode: '1614200',
          controlAccount: isAr ? '1614200 - الموظفين وسلف الكادر' : '1614200 - Staff Advances & Employees',
          suggestedCode: initialData?.code || getNextAvailableCode('1614200', allAccounts),
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
          suggestedCode: initialData?.code || getNextAvailableCode('2614', allAccounts),
          nature: 'CREDIT' as const,
          type: 'LIABILITY' as const,
          category: 'SUPPLIER' as const,
        };

      // 3. Treasury, Cashboxes & Banks (181 نقدية بالصندوق / 182 نقدية لدى المصارف)
      case 'CASHBOX':
        return {
          parentCode: '181',
          controlAccount: isAr ? '181 - نقدية بالصندوق (الصناديق والقاصات)' : '181 - Cash on Hand (Cashboxes)',
          suggestedCode: initialData?.code || getNextAvailableCode('181', allAccounts),
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
          suggestedCode: initialData?.code || getNextAvailableCode('182', allAccounts),
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
          suggestedCode: initialData?.code || getNextAvailableCode(expenseSubCategory || '3', allAccounts),
          nature: 'DEBIT' as const,
          type: 'EXPENSE' as const,
          category: 'GENERAL' as const,
        };

      // 5. Revenues (4 - الموارد / الإيرادات)
      case 'REVENUE':
        return {
          parentCode: revenueSubCategory || '4',
          controlAccount: isAr ? `4 - الموارد (الإيرادات) [${revenueSubCategory || '4'}]` : `4 - Revenues [${revenueSubCategory || '4'}]`,
          suggestedCode: initialData?.code || getNextAvailableCode(revenueSubCategory || '4', allAccounts),
          nature: 'CREDIT' as const,
          type: 'REVENUE' as const,
          category: 'GENERAL' as const,
        };

      default:
        return {
          parentCode: '1614',
          controlAccount: isAr ? '1614 - مدينون قطاع خاص (العملاء)' : '1614 - Private Sector Debtors',
          suggestedCode: initialData?.code || getNextAvailableCode('1614', allAccounts),
          nature: 'DEBIT' as const,
          type: 'ASSET' as const,
          category: 'CUSTOMER' as const,
        };
    }
  }, [accountType, expenseSubCategory, revenueSubCategory, allAccounts, initialData, isAr]);

  const flatAccounts = useMemo(() => {
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
  }, [allAccounts]);

  const finalCode = manualCode.trim() || classificationRules.suggestedCode;
  const existingParent = mode === 'EDIT' && initialData?.parentId
    ? flatAccounts.find((account) => account.id === initialData.parentId)
    : undefined;
  const finalParentCode = manualParentCode.trim() || existingParent?.code || classificationRules.parentCode;
  const parentAccount = flatAccounts.find((account) => account.code === finalParentCode);
  const isCashCustomer = activeGroup === 'CUSTOMERS' && accountType === 'CASH_CUSTOMER';

  const selectCustomerType = (type: 'CASH_CUSTOMER' | 'INDIVIDUAL_CLIENT' | 'CORPORATE_CLIENT') => {
    const wasCashCustomer = accountType === 'CASH_CUSTOMER';
    setAccountType(type);
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
      showErrorNotification(isAr ? 'الحساب الأب غير موجود' : 'Parent account missing', isAr ? `لم يتم العثور على الحساب الأب (${finalParentCode}) في الدليل.` : `Parent account (${finalParentCode}) was not found in the chart.`);
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
    if (branchesLoading && branchScope !== 'ALL_BRANCHES') {
      showErrorNotification(isAr ? 'الفروع قيد التحميل' : 'Branches are loading', isAr ? 'انتظر اكتمال تحميل الفروع.' : 'Wait for branches to finish loading.');
      return false;
    }
    if (branchesError && branchScope !== 'ALL_BRANCHES') {
      showErrorNotification(isAr ? 'تعذر تحميل الفروع' : 'Branches unavailable', isAr ? 'لا يمكن حفظ نطاق فرع غير متحقق منه.' : 'A branch scope cannot be saved before branches are loaded.');
      return false;
    }
    if (branchScope === 'CURRENT_BRANCH' && !currentBranch) {
      showErrorNotification(isAr ? 'الفرع الحالي غير محدد' : 'Current branch missing', isAr ? 'حدد فرع العمل الحالي أولاً.' : 'Select the active workspace branch first.');
      return false;
    }
    if (branchScope === 'SPECIFIC_BRANCHES' && selectedBranches.length === 0) {
      showErrorNotification(isAr ? 'اختر فرعاً واحداً على الأقل' : 'Select at least one branch', isAr ? 'نطاق الفروع المحددة لا يمكن أن يكون فارغاً.' : 'Specific branch scope cannot be empty.');
      return false;
    }
    if (paymentMode === 'CREDIT_ALLOWED' && !isCashCustomer) {
      const limitIQD = parseAmount(creditLimit);
      const limitUSD = parseAmount(creditLimitUSD);
      if (overduePolicy !== 'UNLIMITED' && ((currency !== 'USD' && limitIQD <= 0) || (currency !== 'IQD' && limitUSD <= 0))) {
        showErrorNotification(isAr ? 'سقف الائتمان غير مكتمل' : 'Credit limit required', isAr ? 'أدخل سقفاً موجباً لكل عملة مفعلة.' : 'Enter a positive limit for every enabled currency.');
        return false;
      }
      const days = Number(paymentDays);
      if (!Number.isInteger(days) || days < 0) {
        showErrorNotification(isAr ? 'مدة السداد غير صحيحة' : 'Invalid payment term', isAr ? 'مدة السداد يجب أن تكون عدداً صحيحاً غير سالب.' : 'Payment days must be a non-negative integer.');
        return false;
      }
    }
    if (openingBalanceOpen) {
      const amountIQD = parseAmount(openingAmount);
      const amountUSD = parseAmount(openingAmountUSD);
      if (!Number.isFinite(amountIQD) || !Number.isFinite(amountUSD) || amountIQD < 0 || amountUSD < 0) {
        showErrorNotification(isAr ? 'الرصيد الافتتاحي غير صحيح' : 'Invalid opening balance', isAr ? 'يجب أن تكون مبالغ الرصيد أرقاماً غير سالبة.' : 'Opening balance amounts must be non-negative numbers.');
        return false;
      }
      if (!openingDate || Number.isNaN(new Date(openingDate).getTime())) {
        showErrorNotification(isAr ? 'تاريخ الرصيد مطلوب' : 'Opening date required', isAr ? 'حدد تاريخاً صحيحاً للرصيد الافتتاحي.' : 'Select a valid opening balance date.');
        return false;
      }
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
        branchScope,
        currency,
        branchIds: branchScope === 'ALL_BRANCHES' ? [] : branchScope === 'CURRENT_BRANCH' ? (currentBranch ? [currentBranch.id] : []) : selectedBranches,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        contactPerson: contactPerson.trim() || undefined,
        creditLimit: effectivePaymentMode === 'CREDIT_ALLOWED' && overduePolicy !== 'UNLIMITED' && currency !== 'USD' ? parseAmount(creditLimit) : 0,
        creditLimitUSD: effectivePaymentMode === 'CREDIT_ALLOWED' && overduePolicy !== 'UNLIMITED' && currency !== 'IQD' ? parseAmount(creditLimitUSD) : 0,
        paymentDays: effectivePaymentMode === 'CREDIT_ALLOWED' ? Number(paymentDays) : 0,
        paymentMode: effectivePaymentMode,
        overduePolicy: isBlocked ? 'BLOCK' : overduePolicy,
        ...(openingBalanceOpen ? {
          openingAmountIQD: currency !== 'USD' ? parseAmount(openingAmount) : 0,
          openingAmountUSD: currency !== 'IQD' ? parseAmount(openingAmountUSD) : 0,
          openingNature,
          openingDate,
          openingNotes: openingNotes.trim() || undefined,
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
        setManualCode('');
        setManualParentCode('');
        setShowOverrideFields(false);
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
        <div className="flex items-center gap-3 py-0.5" dir={direction}>
          <div className="w-10 h-10 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F45A0A] shrink-0">
            <IconWand size={20} />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-slate-900 leading-tight">
              {mode === 'EDIT'
                ? (isAr ? `تعديل الحساب المحاسبي (${initialData?.code})` : `Edit Accounting Account (${initialData?.code})`)
                : (isAr ? 'إضافة حساب' : 'Add Account')}
            </h3>
            <span className="text-[11.5px] text-slate-500 font-normal">
              {isAr
                ? 'دليل الحسابات'
                : 'Chart of accounts'}
            </span>
          </div>
        </div>
      }
      size="1040px"
      padding={0}
      radius="12px"
      centered
      styles={{
        content: {
          height: 'min(760px, 92dvh)',
          maxHeight: '92dvh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '12px',
          overflow: 'hidden',
        },
        header: {
          minHeight: '72px',
          padding: '14px 22px',
          borderBottom: '1px solid #e2e8f0',
        },
        body: {
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          padding: 0,
        },
      }}
      overlayProps={{ opacity: 0.48, blur: 3 }}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden text-xs select-none font-sans font-medium [&_.mantine-InputWrapper-label]:font-bold [&_.mantine-Input-input]:font-semibold" dir={direction}>
        {/* ── 1. STEP PROGRESS INDICATOR ── */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50 px-5 py-3 gap-3">
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`flex items-center justify-center gap-2 flex-1 h-9 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
              step === 1
                ? 'bg-white text-slate-950 border border-slate-200 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-mono ${step === 1 ? 'bg-[#F45A0A] text-white font-black' : 'bg-slate-200 text-slate-600'}`}>
              1
            </span>
            <span>{isAr ? 'البيانات' : 'Details'}</span>
          </button>

          <div className="h-px w-10 bg-slate-300" />

          <button
            type="button"
            onClick={goToStepTwo}
            className={`flex items-center justify-center gap-2 flex-1 h-9 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
              step === 2
                ? 'bg-white text-slate-950 border border-slate-200 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-mono ${step === 2 ? 'bg-[#F45A0A] text-white font-black' : 'bg-slate-200 text-slate-600'}`}>
              2
            </span>
            <span>{isAr ? 'الإعدادات' : 'Settings'}</span>
          </button>
        </div>

        {/* ── 2. SCROLLABLE CONTENT AREA ── */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 px-5 py-4 space-y-4 bg-white">
          {(accountsLoading || accountsError) && (
            <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[11.5px] font-semibold ${accountsError ? 'border-red-200 bg-red-50 text-red-700' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
              {accountsError ? <IconAlertCircle size={16} /> : <IconLoader2 size={16} className="animate-spin" />}
              <span>{accountsError ? (isAr ? 'تعذر تحميل شجرة الحسابات؛ الحفظ متوقف لحماية الترابط المحاسبي.' : 'Chart loading failed; saving is blocked to protect account hierarchy.') : (isAr ? 'جارٍ التحقق من شجرة الحسابات والرمز المقترح...' : 'Validating the account tree and suggested code...')}</span>
            </div>
          )}
          {step === 1 && (
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_270px] gap-5 items-start">
              <div className="space-y-5 min-w-0">
              {/* Category Tabs (5 Tabs) */}
              <div>
                <label className="block font-extrabold text-slate-900 mb-2 text-xs">
                  {isAr ? 'تصنيف الحساب' : 'Account category'}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-1 border-b border-slate-200">
                  {[
                    { id: 'FINANCIAL', label: isAr ? 'المالية' : 'Financial', icon: <IconWallet size={16} /> },
                    { id: 'CUSTOMERS', label: isAr ? 'العملاء' : 'Customers', icon: <IconUsers size={16} /> },
                    { id: 'SUPPLIERS', label: isAr ? 'الموردون' : 'Suppliers', icon: <IconPlane size={16} /> },
                    { id: 'EXPENSES', label: isAr ? 'المصروفات' : 'Expenses', icon: <IconCashBanknote size={16} /> },
                    { id: 'REVENUES', label: isAr ? 'الإيرادات' : 'Revenue', icon: <IconReceipt size={16} /> },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setActiveGroup(tab.id as any);
                        if (tab.id === 'FINANCIAL') setAccountType('CASHBOX');
                        else if (tab.id === 'CUSTOMERS') selectCustomerType('CASH_CUSTOMER');
                        else if (tab.id === 'SUPPLIERS') setAccountType('IATA_AIRLINE');
                        else if (tab.id === 'EXPENSES') setAccountType('GDS_SUBSCRIPTION');
                        else if (tab.id === 'REVENUES') setAccountType('REVENUE');
                      }}
                      className={`relative flex min-h-12 items-center justify-center gap-1.5 px-2 py-2 transition-colors cursor-pointer font-bold text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${
                        activeGroup === tab.id
                          ? 'text-[#C2410C] after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-[#F45A0A]'
                          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <div className={activeGroup === tab.id ? 'text-[#F45A0A]' : 'text-slate-500'}>{tab.icon}</div>
                      <span className="leading-tight text-[11px]">{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sub-Type Cards */}
              <div>
                <label className="block font-extrabold text-slate-900 mb-2 text-xs">
                  {isAr ? 'نوع الحساب' : 'Account type'}
                </label>
                {activeGroup === 'FINANCIAL' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { id: 'INTERNAL_MASTER', label: isAr ? 'ماستر داخلي' : 'Internal Master', icon: <IconCreditCard size={18} /> },
                      { id: 'EXTERNAL_MASTER', label: isAr ? 'ماستر خارجي' : 'External Master', icon: <IconCreditCard size={18} /> },
                      { id: 'CASHBOX', label: isAr ? 'صندوق' : 'Cashbox', icon: <IconWallet size={18} /> },
                      { id: 'BANK', label: isAr ? 'بنك' : 'Bank', icon: <IconBuildingBank size={18} /> },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setAccountType(item.id)}
                        className={`flex min-h-11 items-center text-start p-3 rounded-lg border transition-colors cursor-pointer ${
                          accountType === item.id
                            ? 'bg-orange-50 border-[#F45A0A] text-[#9A3412]'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-bold text-xs">
                          <span className={accountType === item.id ? 'text-[#F45A0A]' : 'text-slate-500'}>{item.icon}</span>
                          <span>{item.label}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {activeGroup === 'CUSTOMERS' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'CASH_CUSTOMER', label: isAr ? 'زبون نقدي' : 'Cash Customer', icon: <IconCashBanknote size={17} /> },
                      { id: 'INDIVIDUAL_CLIENT', label: isAr ? 'أفراد' : 'Individuals', icon: <IconUser size={17} /> },
                      { id: 'CORPORATE_CLIENT', label: isAr ? 'شركة' : 'Company', icon: <IconBuilding size={17} /> },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => selectCustomerType(item.id as 'CASH_CUSTOMER' | 'INDIVIDUAL_CLIENT' | 'CORPORATE_CLIENT')}
                        className={`flex min-h-12 items-center justify-center gap-2.5 p-3 rounded-lg border transition-colors cursor-pointer font-extrabold text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${
                          accountType === item.id
                            ? 'bg-orange-50 border-[#F45A0A] text-[#9A3412]'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span className={accountType === item.id ? 'text-[#F45A0A]' : 'text-slate-500'}>{item.icon}</span>
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {activeGroup === 'SUPPLIERS' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { id: 'IATA_AIRLINE', label: isAr ? 'شركة طيران' : 'Airline', icon: <IconPlane size={16} /> },
                      { id: 'TICKET_SUPPLIER', label: isAr ? 'مورد تذاكر' : 'Ticket Supplier', icon: <IconTicket size={16} /> },
                      { id: 'HOTEL_SUPPLIER', label: isAr ? 'مورد فنادق' : 'Hotel Supplier', icon: <IconBed size={16} /> },
                      { id: 'VISA_SUPPLIER', label: isAr ? 'مورد فيزا' : 'Visa Supplier', icon: <IconId size={16} /> },
                      { id: 'TOURISM_SUPPLIER', label: isAr ? 'مورد سياحة' : 'Tour Supplier', icon: <IconWorld size={16} /> },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setAccountType(item.id)}
                        className={`flex min-h-11 items-center gap-2.5 p-3 rounded-lg border transition-colors cursor-pointer font-bold text-xs ${
                          accountType === item.id
                            ? 'bg-orange-50 border-[#F45A0A] text-[#9A3412]'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span className={accountType === item.id ? 'text-[#F45A0A]' : 'text-slate-500'}>{item.icon}</span>
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {activeGroup === 'EXPENSES' && (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setAccountType('GDS_SUBSCRIPTION')}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all cursor-pointer font-bold text-xs ${
                          accountType === 'GDS_SUBSCRIPTION'
                            ? 'bg-[#FFF7ED] border-[#F45A0A] ring-2 ring-[#F45A0A]/20 text-[#9A3412]'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <IconDeviceDesktopAnalytics size={16} className="text-[#F45A0A]" />
                        <span>{isAr ? 'اشتراكات GDS' : 'GDS Subscriptions'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAccountType('EXPENSE')}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all cursor-pointer font-bold text-xs ${
                          accountType === 'EXPENSE'
                            ? 'bg-[#FFF7ED] border-[#F45A0A] ring-2 ring-[#F45A0A]/20 text-[#9A3412]'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <IconReceipt size={16} className="text-[#F45A0A]" />
                        <span>{isAr ? 'مصروف تشغيلي' : 'Operating Expense'}</span>
                      </button>
                    </div>

                    {accountType === 'EXPENSE' && (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <Select
                          size="xs"
                          label={isAr ? 'بند المصروف' : 'Expense category'}
                          data={[
                            { value: '3111', label: isAr ? '3111 - رواتب الموظفين الأساسية' : '3111 - Staff Basic Salaries' },
                            { value: '3116', label: isAr ? '3116 - أجور أعمال إضافية (Overtime)' : '3116 - Overtime Wages' },
                            { value: '3118', label: isAr ? '3118 - مكافآت وحوافز مبيعات التذاكر' : '3118 - Ticketing Sales Incentives' },
                            { value: '3252', label: isAr ? '3252 - القرطاسية ومستلزمات المكاتب' : '3252 - Stationery & Office Supplies' },
                            { value: '3272', label: isAr ? '3272 - الكهرباء والمولدات' : '3272 - Electricity & Generators' },
                            { value: '3313', label: isAr ? '3313 - نفقات الاتصالات والإنترنت والهاتف' : '3313 - Telecom & Internet Expenses' },
                            { value: '33161', label: isAr ? '33161 - دعاية وإعلان وحملات التسويق' : '33161 - Marketing & Advertising' },
                            { value: '33163', label: isAr ? '33163 - ضيافة واستقبال العملاء' : '33163 - Hospitality & Client Reception' },
                            { value: '33412', label: isAr ? '33412 - إيجار مقرات وفروع المكتب' : '33412 - Office & Branch Rent' },
                            { value: '3355', label: isAr ? '3355 - خسائر فروقات أسعار الصرف الأجنبي' : '3355 - Foreign Exchange Losses' },
                            { value: '3366', label: isAr ? '3366 - خدمات وعمولات مصرفية وبوابات الدفع' : '3366 - Bank & Payment Gateway Fees' },
                            { value: '3399', label: isAr ? '3399 - مصروفات نثرية وتشغيلية متنوعة' : '3399 - Miscellaneous Petty Cash Expenses' },
                          ]}
                          value={expenseSubCategory}
                          onChange={(v) => setExpenseSubCategory(v || '331')}
                        />
                      </div>
                    )}
                  </div>
                )}

                {activeGroup === 'REVENUES' && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <Select
                      size="xs"
                      label={isAr ? 'بند الإيراد' : 'Revenue category'}
                      data={[
                        { value: '4231', label: isAr ? '4231 - عمولة بيع التذاكر' : '4231 - Ticketing Sales Commission' },
                        { value: '4232', label: isAr ? '4232 - عمولات شركات الطيران' : '4232 - Airline Commissions' },
                        { value: '4233', label: isAr ? '4233 - عمولات موردي ومنصات التذاكر' : '4233 - Ticket Supplier Overrides' },
                        { value: '4234', label: isAr ? '4234 - حوافز وتارجت شركات الطيران (Override & Incentives)' : '4234 - Airline Volume Incentives & Targets' },
                        { value: '4241', label: isAr ? '4241 - إيراد / عمولة حجوزات الفنادق' : '4241 - Hotel Booking Commission' },
                        { value: '4242', label: isAr ? '4242 - إيراد البرامج والرحلات السياحية' : '4242 - Tour Packages Revenue' },
                        { value: '4243', label: isAr ? '4243 - إيراد رحلات المجموعات والكروبات (Groups)' : '4243 - Group Travel & Charter Revenue' },
                        { value: '4355', label: isAr ? '4355 - أرباح فروقات أسعار الصرف الأجنبي' : '4355 - FX Gain on Currency Exchange' },
                        { value: '4361', label: isAr ? '4361 - أجور إصدار التذاكر (Issuance Fees)' : '4361 - Ticket Issuance Fees' },
                        { value: '4362', label: isAr ? '4362 - أجور خدمة الحجز وتعديل المواعيد' : '4362 - Date Change & Rebooking Fees' },
                        { value: '4363', label: isAr ? '4363 - أجور إعادة إصدار التذاكر (Reissue Fees)' : '4363 - Ticket Reissuance Fees' },
                        { value: '4364', label: isAr ? '4364 - أجور استرجاع التذاكر (Refund Fees)' : '4364 - Ticket Refund Admin Fees' },
                        { value: '4365', label: isAr ? '4365 - أجور ورسوم خدمة الفيزا والتأشيرات' : '4365 - Visa Processing & Admin Fees' },
                        { value: '4366', label: isAr ? '4366 - أجور خدمة حجز الفنادق' : '4366 - Hotel Reservation Service Fees' },
                        { value: '4392', label: isAr ? '4392 - إيراد عمولة بيع' : '4392 - Other Sales Commissions' },
                      ]}
                      value={revenueSubCategory}
                      onChange={(v) => setRevenueSubCategory(v || '4231')}
                    />
                  </div>
                )}
              </div>

              {/* Input Details & Currency Card */}
              <div className="pt-4 border-t border-slate-200 space-y-3.5">
                {!isCashCustomer && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <TextInput
                      label={isAr ? 'اسم الحساب' : 'Account name'}
                      placeholder={isAr ? 'أدخل الاسم' : 'Enter name'}
                      required
                      value={nameAr}
                      onChange={(e) => handleNameArChange(e.target.value)}
                    />
                    <TextInput
                      label={isAr ? 'الاسم الإنجليزي' : 'English name'}
                      placeholder="English name"
                      value={nameEn}
                      onChange={(e) => handleNameEnChange(e.target.value)}
                    />
                  </div>
                )}

                {/* Currency Selector with clear brand orange buttons */}
                <div>
                  <label className="font-bold text-slate-700 text-xs flex items-center gap-1.5 mb-1.5">
                    <IconCoins size={15} className="text-[#F45A0A]" />
                    <span>{isAr ? 'العملة' : 'Currency'}</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 p-1 bg-slate-100 border border-slate-200 rounded-lg">
                    {[
                      { id: 'MULTI', label: 'IQD + USD' },
                      { id: 'IQD', label: 'IQD' },
                      { id: 'USD', label: 'USD' },
                    ].map((cOpt) => {
                      const isActive = currency === cOpt.id;
                      return (
                        <button
                          key={cOpt.id}
                          type="button"
                          onClick={() => setCurrency(cOpt.id as any)}
                          className={`min-h-9 px-2 py-2 rounded-md font-bold text-[11.5px] transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-[#F45A0A] text-white shadow-xs'
                              : 'bg-transparent text-slate-600 hover:bg-white hover:text-slate-900'
                          }`}
                        >
                          {cOpt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {((activeGroup === 'CUSTOMERS' && !isCashCustomer) || activeGroup === 'SUPPLIERS') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
                    <TextInput label={isAr ? 'الهاتف' : 'Phone'} placeholder="07701234567" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    {(accountType === 'CORPORATE_CLIENT' || activeGroup === 'SUPPLIERS') && (
                      <TextInput label={isAr ? 'مسؤول الاتصال' : 'Contact'} placeholder={isAr ? 'الاسم' : 'Name'} value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
                    )}
                    <TextInput label={isAr ? 'البريد' : 'Email'} placeholder="contact@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <TextInput label={isAr ? 'العنوان' : 'Address'} placeholder={isAr ? 'المحافظة والمنطقة' : 'City and district'} value={address} onChange={(e) => setAddress(e.target.value)} />
                  </div>
                )}
              </div>
              </div>

              {/* Accounting Direction Preview Badge Box */}
              <aside className="xl:sticky xl:top-0 border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                <div className="p-3.5 space-y-3">
                <div className="flex items-center justify-between font-bold text-orange-950 text-xs">
                  <div className="flex items-center gap-1.5">
                    <IconCheck size={16} className="text-[#F45A0A]" />
                    <span>{isAr ? 'الربط المحاسبي' : 'Accounting link'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowOverrideFields(!showOverrideFields)}
                    className="text-[11.5px] font-bold text-[#F45A0A] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <IconEdit size={12} />
                    <span>{showOverrideFields ? (isAr ? 'إلغاء' : 'Cancel') : (isAr ? 'تعديل' : 'Edit')}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2 text-xs">
                  <div className="p-2.5 bg-white rounded-md border border-slate-200">
                    <span className="text-[10.5px] text-slate-500 block font-medium">{isAr ? 'الرمز' : 'Code'}</span>
                    <span className="font-mono font-black text-[#9A3412] text-sm" dir="ltr">{manualCode || classificationRules.suggestedCode}</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-md border border-slate-200">
                    <span className="text-[10.5px] text-slate-500 block font-medium">{isAr ? 'الحساب الأب' : 'Parent'}</span>
                    <span className="font-bold text-slate-900 line-clamp-1" title={classificationRules.controlAccount}>{classificationRules.controlAccount}</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-md border border-slate-200">
                    <span className="text-[10.5px] text-slate-500 block font-medium">{isAr ? 'الطبيعة' : 'Nature'}</span>
                    <span className={`font-bold ${classificationRules.nature === 'DEBIT' ? 'text-emerald-700' : 'text-blue-700'}`}>
                      {classificationRules.nature === 'DEBIT' ? (isAr ? 'مدين' : 'Debit') : (isAr ? 'دائن' : 'Credit')}
                    </span>
                  </div>
                </div>

                {/* Manual Override Fields */}
                {showOverrideFields && (
                  <div className="grid grid-cols-1 gap-2.5 pt-2 border-t border-slate-200">
                    <TextInput label={isAr ? 'كود الحساب الأب اليدوي' : 'Manual Parent Code'} placeholder={classificationRules.parentCode} value={manualParentCode} onChange={(e) => setManualParentCode(e.target.value)} />
                    <TextInput label={isAr ? 'الكود التسلسلي اليدوي' : 'Manual Serial Code'} placeholder={classificationRules.suggestedCode} value={manualCode} onChange={(e) => setManualCode(e.target.value)} />
                  </div>
                )}
                </div>
              </aside>
            </div>
          )}

          {/* STEP 2: Financial Settings & Final Review */}
          {step === 2 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-5 shadow-2xs">
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
                      className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-start transition-all cursor-pointer ${
                        accountRole === role.id
                          ? 'bg-orange-50/80 border-[#F45A0A] text-[#9A3412] shadow-xs ring-1 ring-[#F45A0A]/20'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <span className={accountRole === role.id ? 'text-[#F45A0A]' : 'text-slate-400'}>{role.icon}</span>
                        <span>{role.label}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium line-clamp-1">{role.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Account Block Status & Transaction Permission */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold shrink-0 ${isBlocked ? 'bg-red-100 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    {isBlocked ? <IconAlertCircle size={18} /> : <IconCheck size={18} />}
                  </div>
                  <div>
                    <span className="font-extrabold text-xs text-slate-900 block">
                      {isAr ? 'حالة التعامل وتجميد الحساب' : 'Transaction Access & Account Status'}
                    </span>
                    <span className={`text-[11px] font-medium ${isBlocked ? 'text-red-700' : 'text-slate-500'}`}>
                      {isBlocked
                        ? (isAr ? 'الحساب موقوف ومجمد نهائياً ولا يظهر في أي قائمة منسدلة أو فواتير' : 'Account is permanently blocked and hidden from all dropdowns')
                        : (isAr ? 'الحساب نشط ومتاح لإصدار الفواتير والسندات في النظام' : 'Account is active and ready for operations')}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0 bg-slate-50 px-3.5 py-1.5 rounded-xl border border-slate-200">
                  <span className={`text-xs font-bold ${!isBlocked ? 'text-emerald-700' : 'text-red-600'}`}>
                    {!isBlocked ? (isAr ? 'نشط ومتاح' : 'Active') : (isAr ? 'مجمد وموقوف' : 'Blocked')}
                  </span>
                  <Switch
                    size="md"
                    color="teal"
                    checked={!isBlocked}
                    onChange={(event) => setIsBlocked(!event.currentTarget.checked)}
                  />
                </div>
              </div>

              {/* 3. Opening Balance Section (Always Open, Clean Layout) */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#F45A0A] flex items-center justify-center font-bold">
                      <IconWallet size={18} />
                    </div>
                    <div>
                      <span className="font-extrabold text-xs text-slate-900 block">
                        {isAr ? 'الرصيد الافتتاحي' : 'Opening Balance'}
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {isAr ? 'حدد طبيعة وقيمة الرصيد الأولي للحساب إن وجد' : 'Specify initial opening balance if applicable'}
                      </span>
                    </div>
                  </div>

                  <SegmentedControl
                    size="xs"
                    value={openingNature}
                    onChange={(v) => setOpeningNature(v)}
                    data={[
                      { label: isAr ? 'مدين - لنا على الطرف' : 'Debit - due to us', value: 'DEBIT' },
                      { label: isAr ? 'دائن - للطرف علينا' : 'Credit - due to partner', value: 'CREDIT' },
                    ]}
                    color={openingNature === 'CREDIT' ? 'orange' : 'red'}
                    className="font-bold shrink-0"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                  {(currency === 'MULTI' || currency === 'IQD') && (
                    <FormattedNumberInput
                      size="xs"
                      label={isAr ? (currency === 'MULTI' ? 'رصيد الدينار (IQD)' : 'المبلغ (د.ع)') : 'IQD Amount'}
                      value={openingAmount}
                      onChange={setOpeningAmount}
                    />
                  )}
                  {(currency === 'MULTI' || currency === 'USD') && (
                    <FormattedNumberInput
                      size="xs"
                      label={isAr ? (currency === 'MULTI' ? 'رصيد الدولار (USD)' : 'المبلغ ($)') : 'USD Amount'}
                      value={openingAmountUSD}
                      onChange={setOpeningAmountUSD}
                    />
                  )}
                  <div className={currency === 'MULTI' ? 'sm:col-span-2 lg:col-span-1' : ''}>
                    <TextInput
                      size="xs"
                      label={isAr ? 'البيان' : 'Memo / Statement'}
                      placeholder={isAr ? 'رصيد مرحل' : 'Opening balance rollover'}
                      value={openingNotes}
                      onChange={(e) => setOpeningNotes(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── 3. ACTION FOOTER BUTTONS ── */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2.5 border-t border-slate-200 bg-slate-50 px-5 py-3 mt-auto">
          {step === 2 ? (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="h-10 w-full sm:w-auto px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
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
              className="h-10 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 font-semibold text-xs transition-colors cursor-pointer"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            {step === 1 ? (
              <button
                type="button"
                onClick={goToStepTwo}
                disabled={accountsLoading}
                className="h-10 px-4 rounded-lg bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
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
                    className="h-10 px-3 rounded-lg border border-[#F45A0A] bg-orange-50 hover:bg-orange-100 text-[#C2410C] font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <IconPlus size={14} />
                    <span>{isAr ? 'إنشاء وإضافة آخر' : 'Create & Add Another'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  className="col-span-2 h-10 px-5 rounded-lg bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 sm:col-auto"
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
