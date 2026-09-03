import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  Modal,
  Textarea,
  Button,
  Badge,
  Paper,
  Tooltip,
  ActionIcon,
  Select,
} from '@mantine/core';
import {
  IconDeviceFloppy,
  IconReceipt,
  IconBuildingBank,
  IconHistory,
  IconUser,
  IconChevronRight,
  IconChevronLeft,
  IconChevronDown,
  IconChevronUp,
  IconPlus,
  IconEye,
  IconChevronsRight,
  IconChevronsLeft,
  IconRefresh,
  IconUserPlus,
  IconCreditCard,
  IconPaperclip,
  IconTrash,
  IconCash,
  IconFileText,
  IconSettings,
  IconCheck,
  IconFileInvoice,
  IconArrowsExchange,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { apiRequest, invalidateApiCache } from '../../api/client';
import { fetchPrintTemplate } from '../../api/printTemplates';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { allocateDocumentNumber, peekDocumentNumber } from '../../utils/sequenceUtils';
import { useAdoptedExchangeRate } from '../../hooks/useAdoptedExchangeRate';
import { FormattedNumberInput } from '../common/FormattedNumberInput';
import { AccountingDatePicker } from '../common/date/AccountingDatePicker';
import { SmartAccountWizardModal } from '../accounts/SmartAccountWizardModal';
import { employeesApi } from '../../api/employees';

export const parseCleanNumber = (val: any): number => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const clean = String(val).replace(/,/g, '').trim();
  const num = Number(clean);
  return isNaN(num) ? 0 : num;
};

export const VOUCHER_SPLIT_MARKER = '[[VOUCHER_SPLIT:';

export const readVoucherSplits = (desc?: string | null): { cleanDescription: string; splitAccounts: any[] } => {
  if (!desc) return { cleanDescription: '', splitAccounts: [] };
  
  let splitAccounts: any[] = [];

  // 1. Try to find and parse complete JSON marker
  const markerMatch = desc.match(/\[\[VOUCHER_SPLIT:\s*(\[.*?\])\s*\]\]/s);
  if (markerMatch && markerMatch[1]) {
    try {
      const parsed = JSON.parse(markerMatch[1]);
      if (Array.isArray(parsed)) {
        splitAccounts = parsed.map((item) => ({
          ...item,
          amount: parseCleanNumber(item.amount),
        }));
      }
    } catch (e) {
      console.warn('Failed to parse voucher split JSON:', e);
    }
  }

  // 2. Strip all split markers, brackets, and any trailing fragment lines
  let cleanDescription = desc
    .replace(/\[\[VOUCHER_SPLIT:.*?(\]\]|$)/gs, '')
    .replace(/\[\[.*?\]\]/gs, '')
    .trim();

  // Strip any stray lone bracket lines or artifacts
  cleanDescription = cleanDescription
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '' && line !== '[' && line !== ']' && line !== '[[' && line !== ']]')
    .join('\n')
    .trim();

  return {
    cleanDescription,
    splitAccounts,
  };
};

/**
 * The split used to be smuggled into the description as a marker, because there was
 * nowhere else to keep it. It now lives in the journal lines, which is where the
 * accounting actually is — so nothing writes the marker any more. Writing it would
 * only put raw JSON in front of the user in every account statement.
 *
 * `readVoucherSplits` stays, because vouchers saved before this change still carry
 * the marker and must still open correctly.
 */
export const stripVoucherSplitMarker = (desc: string | null | undefined): string =>
  readVoucherSplits(desc).cleanDescription;

interface AccountOption {
  id: string;
  code: string;
  nameAr: string;
  type: string;
  isGroup: boolean;
  balance: number;
}

interface SlipItem {
  id: string;
  file: File;
  previewUrl?: string;
  name: string;
}

interface PaymentMethodItem {
  id: string;
  nameAr: string;
  type: 'CASH' | 'MASTER' | 'BANK' | 'ELECTRONIC' | string;
  targetAccountId?: string;
  targetAccountName?: string;
  isActive?: boolean;
}

export interface JournalLineItem {
  id: string;
  accountId: string;
  debit: string;
  credit: string;
  currency?: 'IQD' | 'USD';
  exchangeRate?: string;
  description?: string;
  costCenter?: string;
}

interface FinancialVoucherUserDefaults {
  defaultCurrency: 'IQD' | 'USD';
  defaultPaymentMethodId: string;
  defaultVoucherType: 'RECEIPT' | 'PAYMENT' | 'EXCHANGE' | 'JOURNAL';
  defaultCashboxAccountId?: string;
}

const USER_DEFAULTS_STORAGE_KEY = 'financial_voucher_user_defaults';

interface FinancialVoucherFormProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: (savedVoucher?: any) => void;
  initialType?: 'RECEIPT' | 'PAYMENT' | 'EXCHANGE' | 'JOURNAL';
  initialVoucherType?: 'RECEIPT' | 'PAYMENT' | 'EXCHANGE' | 'JOURNAL';
  initialVoucherId?: string;
}

export const FinancialVoucherForm: React.FC<FinancialVoucherFormProps> = ({
  opened,
  onClose,
  onSuccess,
  initialType = 'RECEIPT',
  initialVoucherType,
  initialVoucherId,
}) => {
  const defaultType = initialVoucherType || initialType || 'RECEIPT';
  const getTodayDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const adoptedExchange = useAdoptedExchangeRate();
  const isEditing = Boolean(initialVoucherId);
  const [voucherType, setVoucherType] = useState<'RECEIPT' | 'PAYMENT' | 'EXCHANGE' | 'JOURNAL'>(defaultType);

  useEffect(() => {
    if (opened) {
      setVoucherType(defaultType);
    }
  }, [opened, defaultType]);
  const [date, setDate] = useState<string>(getTodayDate());
  const [voucherNumber, setVoucherNumber] = useState<string>('');

  // Payment methods list configured in system
  const [paymentMappings, setPaymentMappings] = useState<PaymentMethodItem[]>([]);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>('pm-cash');

  const [slipFiles, setSlipFiles] = useState<SlipItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<'IQD' | 'USD'>('IQD');
  const [exchangeRate, setExchangeRate] = useState<string>('1500');
  const [cashboxAccountId, setCashboxAccountId] = useState<string>('');
  const [oppositeAccountId, setOppositeAccountId] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isManualDescription, setIsManualDescription] = useState<boolean>(false);

  // Multi-line Journal Voucher Lines State
  const [journalLines, setJournalLines] = useState<JournalLineItem[]>([
    { id: '1', accountId: '', debit: '', credit: '', currency: 'IQD', exchangeRate: '1500', description: '', costCenter: '' },
    { id: '2', accountId: '', debit: '', credit: '', currency: 'IQD', exchangeRate: '1500', description: '', costCenter: '' },
  ]);

  // Custom Voucher Allocation & Split State
  const [configuredCustomAccounts, setConfiguredCustomAccounts] = useState<any[]>([]);
  const [enableSplitAllocation, setEnableSplitAllocation] = useState<boolean>(false);
  const [splitAllocations, setSplitAllocations] = useState<Array<{
    id: string;
    accountId: string;
    accountName: string;
    amount: string;
    note?: string;
  }>>([]);

  // Accounting Preview Toggle
  const [previewJournalOpened, setPreviewJournalOpened] = useState<boolean>(false);

  // Audit Log Modal
  const [auditModalOpened, setAuditModalOpened] = useState<boolean>(false);

  // Settings Modal (لإعداد وتخصيص الخيارات الافتراضية للموظف)
  const [settingsModalOpened, setSettingsModalOpened] = useState<boolean>(false);
  const [formDefaultCurrency, setFormDefaultCurrency] = useState<'IQD' | 'USD'>('IQD');
  const [formDefaultPaymentMethodId, setFormDefaultPaymentMethodId] = useState<string>('pm-cash');
  const [formDefaultVoucherType, setFormDefaultVoucherType] = useState<'RECEIPT' | 'PAYMENT' | 'EXCHANGE' | 'JOURNAL'>('RECEIPT');
  const [formDefaultCashboxId, setFormDefaultCashboxId] = useState<string>('');

  // Quick Create Account Modal
  const [createAccountModalOpened, setCreateAccountModalOpened] = useState<boolean>(false);

  const [vouchersList, setVouchersList] = useState<any[]>([]);
  const [currentVoucherIndex, setCurrentVoucherIndex] = useState<number>(-1);
  const [editingVoucherId, setEditingVoucherId] = useState<string | null>(null);

  // Accounts list
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Reopening the modal quickly used to let an older in-flight load win the race and
  // overwrite the newer voucher; only the latest run is allowed to touch state.
  const loadRunRef = useRef(0);

  // Logged in user profile
  const loggedInUser = useMemo(() => {
    try {
      const stored = localStorage.getItem('user') || localStorage.getItem('auth_user');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}
    return null;
  }, []);

  const loggedInUserName = loggedInUser?.name || loggedInUser?.username || 'المحاسب المسؤول';

  // Helper to load user defaults from localStorage
  const getUserDefaults = (): FinancialVoucherUserDefaults => {
    try {
      const raw = localStorage.getItem(USER_DEFAULTS_STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {}
    return {
      defaultCurrency: 'IQD',
      defaultPaymentMethodId: 'pm-cash',
      defaultVoucherType: 'RECEIPT',
    };
  };

  // Sync initial sequence number
  /*
   * رقم السند يُخصَّص في القاعدة لا في المتصفّح، فيصل بعد لحظة ويُملأ الحقل حين
   * يصل. وهذا ما يمنع موظفَين من أخذ الرقم نفسه.
   */
  const applyNewSequenceNumber = (type: 'RECEIPT' | 'PAYMENT' | 'EXCHANGE' | 'JOURNAL') => {
    const key =
      type === 'RECEIPT' ? 'receiptVouchers' : type === 'PAYMENT' ? 'paymentVouchers' : type === 'EXCHANGE' ? 'exchange' : 'journalEntries';
    // معاينة للعرض — التنقّل بين قبض/دفع/صرافة/قيد كان يحرق رقماً في كل نقرة.
    peekDocumentNumber(key).then(setVoucherNumber);
  };

  // Fast load config on open + Auto-detect employee's cashbox + Load Payment Methods
  useEffect(() => {
    if (opened) {
      const runId = ++loadRunRef.current;
      setLoadError(null);
      const loadData = async () => {
        try {
          // Fast parallel loading of essential config only (avoiding dumping massive table records)
          const editEndpoint = initialVoucherId
            ? defaultType === 'RECEIPT'
              ? `/api/receipt-vouchers/${initialVoucherId}`
              : defaultType === 'PAYMENT'
                ? `/api/payment-vouchers/${initialVoucherId}`
                : `/api/journal-entries/${initialVoucherId}`
            : null;

          const [accs, templateRes, emps, customAccountsRes, editedRes] = await Promise.all([
            apiRequest('/api/accounts?lite=1').catch(() => apiRequest('/api/accounts').catch(() => [])),
            apiRequest('/api/print-templates/payment_methods_mapping').catch(() => null),
            employeesApi.getAll().catch(() => []),
            apiRequest('/api/print-templates/custom_voucher_accounts').catch(() => null),
            // Fetched alongside the config instead of after it: on edit this used to be
            // a fifth round trip that only started once the other four had finished.
            editEndpoint
              ? apiRequest(editEndpoint).then(
                  (r: any) => ({ ok: true, data: r }),
                  (err: any) => ({ ok: false, error: err }),
                )
              : Promise.resolve(null),
          ]);

          if (runId !== loadRunRef.current) return;

          const loadedAccounts: AccountOption[] = accs || [];
          setAccounts(loadedAccounts);

          // Find current employee in database
          const currentEmp = (emps || []).find((e: any) =>
            e.fullName === loggedInUserName ||
            e.username === loggedInUserName ||
            (e.phone && loggedInUser?.phone && e.phone === loggedInUser.phone)
          );

          // Filter candidate cashboxes (leaf sub-accounts only, exclude parent group headers)
          const leafBoxes = loadedAccounts.filter(
            (a) =>
              !a.isGroup &&
              !a.nameAr?.includes('(الصناديق النقدية)') &&
              !a.nameAr?.includes('(نقدية بالصندوق)') &&
              a.code !== '11' &&
              a.code !== '1101' &&
              (a.code?.startsWith('1341') ||
                a.code?.startsWith('181') ||
                a.code?.startsWith('1101') ||
                a.type === 'CASH' ||
                a.nameAr?.includes('صندوق') ||
                a.nameAr?.includes('قاصة'))
          );

          let matchedCashbox: AccountOption | undefined = undefined;

          // 1. Direct match by assignedCashbox from Employee database record
          if (currentEmp?.assignedCashbox) {
            const assigned = currentEmp.assignedCashbox;
            matchedCashbox = loadedAccounts.find(
              (a) =>
                a.id === assigned ||
                a.code === assigned ||
                a.nameAr === assigned ||
                (a.nameAr && a.nameAr.includes(assigned))
            );
          }

          // 2. Direct match by user's stored cashbox ID
          const userCashboxId =
            loggedInUser?.defaultCashboxId ||
            loggedInUser?.cashboxAccountId ||
            loggedInUser?.cashboxId ||
            localStorage.getItem('userDefaultCashbox') ||
            localStorage.getItem('activeCashboxId');

          if (!matchedCashbox && userCashboxId) {
            matchedCashbox = leafBoxes.find((a) => a.id === userCashboxId);
          }

          // 3. Match by employee full name or first name in account name
          if (!matchedCashbox && loggedInUserName) {
            const firstName = loggedInUserName.split(' ')[0];
            matchedCashbox = leafBoxes.find(
              (a) =>
                a.nameAr?.includes(loggedInUserName) ||
                (firstName.length > 2 && a.nameAr?.includes(firstName))
            );
          }

          // 4. Match specific employee cashbox sub-account (134101, 18101, etc.)
          if (!matchedCashbox) {
            matchedCashbox =
              leafBoxes.find((a) => a.code?.startsWith('1341')) ||
              leafBoxes.find((a) => a.code?.startsWith('181')) ||
              leafBoxes.find((a) => a.nameAr?.includes('مبيعات') || a.nameAr?.includes('الفرع')) ||
              leafBoxes[0] ||
              loadedAccounts.find((a) => !a.isGroup);
          }

          const defaultCashboxId = matchedCashbox?.id || '';
          setCashboxAccountId(defaultCashboxId);

          // Load Payment Methods: strictly follow active methods configured in System Settings
          let mappings: PaymentMethodItem[] =
            templateRes?.config?.mappings?.filter((m: any) => m.isActive !== false) || [];

          // Only if no settings exist at all, provide standard cash default
          if (mappings.length === 0) {
            mappings = [
              {
                id: 'pm-cash',
                nameAr: 'كاش باليد (نقدي)',
                type: 'CASH',
                targetAccountId: defaultCashboxId,
              },
            ];
          }

          setPaymentMappings(mappings);

          // Load configured custom allocation accounts
          const customAccs: any[] = (customAccountsRes?.config?.accounts || []).filter((a: any) => a.isActive !== false);
          setConfiguredCustomAccounts(customAccs);
          if (customAccs.length > 0) {
            setSplitAllocations(
              customAccs.map((ca: any) => ({
                id: ca.id || `split-${Math.random()}`,
                accountId: ca.targetAccountId || '',
                accountName: ca.nameAr,
                amount: '',
                note: '',
              }))
            );
          }

          // Apply saved user defaults
          const savedDefaults = getUserDefaults();
          setFormDefaultCurrency(savedDefaults.defaultCurrency || 'IQD');
          setFormDefaultPaymentMethodId(savedDefaults.defaultPaymentMethodId || mappings[0]?.id || 'pm-cash');
          setFormDefaultVoucherType(savedDefaults.defaultVoucherType || defaultType);
          setFormDefaultCashboxId(savedDefaults.defaultCashboxAccountId || defaultCashboxId);

          if (initialVoucherId) {
            if (editedRes && (editedRes as any).ok && (editedRes as any).data) {
              loadVoucherIntoForm((editedRes as any).data, 0, customAccs);
              setLoadError(null);
              return;
            }
            // Say so instead of silently presenting an empty "new voucher" that the
            // user then saves over the top of the record they meant to edit.
            const err: any = editedRes && (editedRes as any).error;
            setLoadError(err?.message || 'تعذّر تحميل بيانات السند. تحقق من الاتصال ثم أعد فتح السند.');
            showErrorNotification(
              'تعذّر تحميل السند',
              err?.message || 'لم يتم جلب بيانات السند من الخادم، لذلك لم تُعبَّأ الحقول.',
            );
            return;
          }

          // Default new voucher state applying saved user preferences
          handleNewVoucher(defaultType, savedDefaults, mappings, defaultCashboxId);
        } catch (e) {
          console.error('Failed to load voucher data:', e);
        }
      };

      loadData();
      if (adoptedExchange?.adoptedRate) {
        setExchangeRate(String(adoptedExchange.adoptedRate));
      }
    }
  }, [opened, initialType, initialVoucherType, initialVoucherId]);

  // Handle Select Payment Method
  const handleSelectPaymentMethod = (method: PaymentMethodItem) => {
    setSelectedPaymentMethodId(method.id);
    if (method.type === 'CASH') {
      // Return to employee's default cashbox
      const defaultCashbox = accounts.find(
        (a) => !a.isGroup && (a.code?.startsWith('1101') || a.type === 'CASH')
      );
      if (defaultCashbox) setCashboxAccountId(defaultCashbox.id);
    } else if (method.targetAccountId && method.targetAccountId !== 'EMPLOYEE_ASSIGNED') {
      setCashboxAccountId(method.targetAccountId);
      if (slipFiles.length === 0 && fileInputRef.current) {
        fileInputRef.current.click();
      }
    }
  };

  // Handle Multi-Slip Upload
  const handleMultipleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newItems: SlipItem[] = [];
      Array.from(files).forEach((file) => {
        const item: SlipItem = {
          id: Math.random().toString(36).substring(2, 9),
          file,
          name: file.name,
        };
        if (file.type.startsWith('image/')) {
          item.previewUrl = URL.createObjectURL(file);
        }
        newItems.push(item);
      });
      setSlipFiles((prev) => [...prev, ...newItems]);
    }
  };

  const handleRemoveSingleSlip = (id: string) => {
    setSlipFiles((prev) => prev.filter((item) => item.id !== id));
  };

  // Auto-generate description whenever relevant fields change
  useEffect(() => {
    if (isManualDescription) return;
    const num = Number(amount) || 0;
    const formattedNum = num > 0 ? num.toLocaleString('en-US') : '';
    const oppAcc = accounts.find((a) => a.id === oppositeAccountId);
    const debitAcc = accounts.find((a) => a.id === cashboxAccountId);
    const targetParty = oppAcc?.nameAr || '';
    const activeMethod = paymentMappings.find((m) => m.id === selectedPaymentMethodId);
    const methodLabel = activeMethod && activeMethod.type !== 'CASH' ? ` عبر ${activeMethod.nameAr}` : '';

    if (voucherType === 'RECEIPT') {
      if (num > 0 && targetParty) {
        setDescription(`استلام دفعة بقيمة ${formattedNum} ${currency === 'IQD' ? 'د.ع' : '$'}${methodLabel} من ${targetParty}`);
      } else if (targetParty) {
        setDescription(`استلام دفعة${methodLabel} من ${targetParty}`);
      } else if (num > 0) {
        setDescription(`استلام دفعة بقيمة ${formattedNum} ${currency === 'IQD' ? 'د.ع' : '$'}${methodLabel}`);
      } else {
        setDescription(`سند قبض مالي${methodLabel}`);
      }
    } else if (voucherType === 'PAYMENT') {
      if (num > 0 && targetParty) {
        setDescription(`صرف دفعة بقيمة ${formattedNum} ${currency === 'IQD' ? 'د.ع' : '$'}${methodLabel} إلى ${targetParty}`);
      } else if (targetParty) {
        setDescription(`صرف دفعة${methodLabel} إلى ${targetParty}`);
      } else if (num > 0) {
        setDescription(`صرف دفعة بقيمة ${formattedNum} ${currency === 'IQD' ? 'د.ع' : '$'}${methodLabel}`);
      } else {
        setDescription(`سند دفع وصرف مالي${methodLabel}`);
      }
    }
  }, [voucherType, amount, currency, cashboxAccountId, oppositeAccountId, selectedPaymentMethodId, paymentMappings, accounts, isManualDescription]);
  // Computed Totals for Multi-Line Journal Entries
  const totalJournalDebit = useMemo(() => {
    return journalLines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
  }, [journalLines]);

  const totalJournalCredit = useMemo(() => {
    return journalLines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
  }, [journalLines]);

  const journalDifference = Math.abs(totalJournalDebit - totalJournalCredit);

  const isJournalBalanced = useMemo(() => {
    return (
      journalLines.length >= 2 &&
      totalJournalDebit > 0 &&
      totalJournalCredit > 0 &&
      journalDifference < 0.01 &&
      journalLines.every((l) => l.accountId && (Number(l.debit) > 0 || Number(l.credit) > 0))
    );
  }, [journalLines, totalJournalDebit, totalJournalCredit, journalDifference]);

  /**
   * The footer used to print `الفارق: 0.00 (غير متوازن)` — a sentence that
   * contradicts itself — because `isJournalBalanced` also requires an account on
   * every line, and a missing account was reported as a balance problem. The two
   * conditions are separated here so the badge names the thing the user must
   * actually fix.
   */
  const journalBlocker = useMemo(() => {
    if (isJournalBalanced) return null;
    if (journalDifference >= 0.01) {
      return `الفارق: ${journalDifference.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${currency} (غير متوازن)`;
    }
    if (journalLines.some((l) => !l.accountId)) return 'اختر الحساب المحاسبي لكل سطر';
    if (totalJournalDebit <= 0 || totalJournalCredit <= 0) return 'أدخل مبلغاً مديناً ومبلغاً دائناً';
    if (journalLines.some((l) => !Number(l.debit) && !Number(l.credit))) return 'كل سطر يحتاج مبلغاً في المدين أو الدائن';
    return 'القيد غير مكتمل';
  }, [isJournalBalanced, journalDifference, journalLines, totalJournalDebit, totalJournalCredit, currency]);

  // Multi-Line Journal Line Management Handlers
  const handleAddJournalLine = () => {
    const newId = Math.random().toString(36).substring(2, 9);
    const diff = totalJournalDebit - totalJournalCredit;
    const debitVal = diff < 0 ? String(Math.abs(diff)) : '';
    const creditVal = diff > 0 ? String(diff) : '';

    setJournalLines((prev) => [
      ...prev,
      {
        id: newId,
        accountId: '',
        debit: debitVal,
        credit: creditVal,
        currency,
        exchangeRate: '1500',
        description: '',
        costCenter: '',
      },
    ]);
  };

  const handleRemoveJournalLine = (id: string) => {
    if (journalLines.length <= 2) {
      showErrorNotification('تنبيه', 'يجب أن يحتوي سند القيد على طرفين على الأقل (مدين ودائن).');
      return;
    }
    setJournalLines((prev) => prev.filter((l) => l.id !== id));
  };

  const handleJournalLineChange = (id: string, field: keyof JournalLineItem, value: any) => {
    setJournalLines((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;
        const updated = { ...line, [field]: value };
        if (field === 'debit' && value) {
          updated.credit = '';
        } else if (field === 'credit' && value) {
          updated.debit = '';
        }
        return updated;
      })
    );
  };

  const handleAutoBalance = () => {
    const diff = totalJournalDebit - totalJournalCredit;
    if (diff === 0) return;
    const emptyLine = journalLines.find((l) => !l.debit && !l.credit);
    if (emptyLine) {
      handleJournalLineChange(emptyLine.id, diff > 0 ? 'credit' : 'debit', String(Math.abs(diff)));
    } else {
      handleAddJournalLine();
    }
  };

  const numAmount = parseCleanNumber(amount);

  // Split Allocations Helpers (حساب النظام يحتسب الرصيد المتبقي تلقائياً ويقل مع الحسابات المخصصة)
  const totalCustomSplitsAmount = useMemo(() => {
    return splitAllocations.reduce((sum, item) => sum + parseCleanNumber(item.amount), 0);
  }, [splitAllocations]);

  const systemAccountAmount = Math.max(0, numAmount - totalCustomSplitsAmount);
  const isOverAllocated = totalCustomSplitsAmount > numAmount;
  const hasCustomSplits = splitAllocations.some((s) => parseCleanNumber(s.amount) > 0);

  const handleSplitAmountChange = (id: string, newAmt: string) => {
    setSplitAllocations((prev) =>
      prev.map((item) => (item.id === id || item.accountName === id || item.accountId === id ? { ...item, amount: newAmt } : item))
    );
  };

  const handleDistributeEqually = () => {
    if (splitAllocations.length === 0 || numAmount <= 0) return;
    const count = splitAllocations.length;
    const equalAmt = (numAmount / count).toFixed(2);
    setSplitAllocations((prev) =>
      prev.map((item) => ({ ...item, amount: String(equalAmt) }))
    );
  };

  const handleFillRemaining = (id: string) => {
    const othersTotal = splitAllocations
      .filter((item) => item.id !== id && item.accountName !== id && item.accountId !== id)
      .reduce((sum, item) => sum + parseCleanNumber(item.amount), 0);
    const rem = Math.max(0, numAmount - othersTotal);
    setSplitAllocations((prev) =>
      prev.map((item) => (item.id === id || item.accountName === id || item.accountId === id ? { ...item, amount: String(rem) } : item))
    );
  };

  const handleResetCustomSplits = () => {
    setSplitAllocations((prev) => prev.map((item) => ({ ...item, amount: '' })));
  };

  const handleRemoveSplitRow = (id: string) => {
    setSplitAllocations((prev) => prev.filter((item) => item.id !== id));
  };

  const handleGenerateAutoJournalDescription = () => {
    const debitPart = journalLines
      .filter((l) => Number(l.debit) > 0 && l.accountId)
      .map((l) => accounts.find((a) => a.id === l.accountId)?.nameAr || '')
      .filter(Boolean);
    const creditPart = journalLines
      .filter((l) => Number(l.credit) > 0 && l.accountId)
      .map((l) => accounts.find((a) => a.id === l.accountId)?.nameAr || '')
      .filter(Boolean);

    if (debitPart.length > 0 && creditPart.length > 0) {
      const text = `قيد محاسبي: من حـ/ (${debitPart.join(' و ')}) إلى حـ/ (${creditPart.join(' و ')})`;
      setDescription(text);
    } else {
      setDescription('سند قيد محاسبي يومي');
    }
  };

  // Load a voucher into the form
  const loadVoucherIntoForm = (
    voucher: any,
    index: number,
    customAccountsOverride?: any[],
  ) => {
    setCurrentVoucherIndex(index);
    setEditingVoucherId(voucher.id || null);
    // `defaultType` is what the list told us this record is; trust it over shape
    // sniffing, because a payment voucher with a null supplierId used to read as a
    // receipt and load into the wrong side of the form.
    const vType =
      voucher.voucherType ||
      (voucher.lines
        ? 'JOURNAL'
        : voucher.type === 'PAYMENT' || voucher.supplierId
          ? 'PAYMENT'
          : defaultType === 'PAYMENT'
            ? 'PAYMENT'
            : 'RECEIPT');
    setVoucherType(vType);
    setDate(voucher.date ? (typeof voucher.date === 'string' ? voucher.date.split('T')[0] : getTodayDate()) : getTodayDate());
    setVoucherNumber(voucher.voucherNumber || voucher.entryNumber || voucher.number || '');
    
    if (vType === 'JOURNAL' && voucher.lines && voucher.lines.length > 0) {
      /**
       * A converted entry stores dinars in `debit`/`credit` and the typed figure in
       * `debitOriginal`/`creditOriginal`. The editor must show what was TYPED —
       * loading the dinar amount into a dollar row would convert it a second time
       * on the next save and multiply the entry by the rate.
       */
      const entryCurrency = voucher.currency === 'USD' ? 'USD' : 'IQD';
      const entryRate = Number(voucher.exchangeRate) > 0 ? String(voucher.exchangeRate) : exchangeRate;
      const asTyped = (converted: any, original: any) => {
        const value = original !== null && original !== undefined ? Number(original) : Number(converted || 0);
        return value > 0 ? String(value) : '';
      };

      const loadedLines: JournalLineItem[] = voucher.lines.map((l: any, idx: number) => ({
        id: l.id || `line-${idx}-${Date.now()}`,
        accountId: l.accountId || '',
        debit: asTyped(l.debit, l.debitOriginal),
        credit: asTyped(l.credit, l.creditOriginal),
        currency: entryCurrency,
        exchangeRate: entryRate,
        description: l.description || '',
        costCenter: l.costCenter || '',
      }));
      setJournalLines(loadedLines);
      setCurrency(entryCurrency);
      setExchangeRate(entryRate);
      const firstDebit = voucher.lines.find((l: any) => Number(l.debit) > 0) || voucher.lines[0];
      const amt = Number(firstDebit?.debitOriginal ?? firstDebit?.debit ?? voucher.totalDebit ?? voucher.amount ?? 0);
      setAmount(amt > 0 ? String(amt) : '');
    } else if (vType === 'JOURNAL') {
      setJournalLines([
        { id: '1', accountId: '', debit: '', credit: '', currency: 'IQD', exchangeRate: '1500', description: '', costCenter: '' },
        { id: '2', accountId: '', debit: '', credit: '', currency: 'IQD', exchangeRate: '1500', description: '', costCenter: '' },
      ]);
    } else {
      const rawAmount = voucher.amount;
      const numeric = Number(rawAmount);
      setAmount(Number.isFinite(numeric) && numeric !== 0 ? String(numeric) : '');
      // No `|| voucher.accountId` fallback here: it used to point the cashbox at the
      // opposite account whenever cashboxOrBankAccountId was missing, which silently
      // turned the entry into a self-transfer.
      setCashboxAccountId(voucher.cashboxOrBankAccountId || '');
      setOppositeAccountId(voucher.accountId || voucher.oppositeAccountId || '');
      setExchangeRate(voucher.exchangeRate ? String(voucher.exchangeRate) : exchangeRate);
    }

    // Restore or initialize split allocations
    const { cleanDescription, splitAccounts: parsedSplits } = readVoucherSplits(voucher.description);
    // `voucher.splitAccounts` now comes back derived from the posted journal lines,
    // so it is authoritative. The description marker is the fallback for vouchers
    // written before the split was booked into the ledger.
    const rawSplitSource = (voucher.splitAccounts && Array.isArray(voucher.splitAccounts) && voucher.splitAccounts.length > 0)
      ? voucher.splitAccounts
      : parsedSplits;

    // Vouchers saved before the fix carry the derived system row inside the payload.
    // Drop it on read so it is recomputed rather than double-counted; its signature
    // is the note and the name prefix this component itself wrote.
    const splitSource = (rawSplitSource || []).filter(
      (s: any) =>
        s &&
        s.note !== 'رصيد حساب النظام الأساسي' &&
        !String(s.accountName || '').startsWith('النظام ('),
    );

    if (splitSource && Array.isArray(splitSource) && splitSource.length > 0) {
      setEnableSplitAllocation(true);
      setSplitAllocations(
        splitSource.map((s: any, idx: number) => ({
          id: s.id || `split-${idx}`,
          accountId: s.accountId || '',
          accountName: s.accountName || s.accountCode || `حساب ${idx + 1}`,
          amount: String(s.amount || ''),
          note: s.note || '',
        }))
      );
    } else {
      setEnableSplitAllocation(false);
      // On the first load the state setter above has not committed yet, so read the
      // freshly fetched list when it is handed to us.
      const configured = customAccountsOverride ?? configuredCustomAccounts;
      if (configured.length > 0) {
        setSplitAllocations(
          configured.map((ca: any) => ({
            id: ca.id,
            accountId: ca.targetAccountId,
            accountName: ca.nameAr,
            amount: '',
            note: '',
          }))
        );
      }
    }

    setCurrency((voucher.currency as 'IQD' | 'USD') || 'IQD');
    setDescription(cleanDescription || voucher.description || '');
    // Mark it manual, otherwise the auto-description effect fires on the next render
    // and overwrites the stored text with a freshly generated sentence.
    setIsManualDescription(Boolean(cleanDescription || voucher.description));
    if (voucher.paymentMethodId) {
      setSelectedPaymentMethodId(voucher.paymentMethodId);
    }
    setSlipFiles([]);
  };

  // Reset to new voucher applying defaults
  const handleNewVoucher = (
    type: 'RECEIPT' | 'PAYMENT' | 'EXCHANGE' | 'JOURNAL' = voucherType,
    customDefaults?: FinancialVoucherUserDefaults,
    customMappings?: PaymentMethodItem[],
    customCashboxId?: string
  ) => {
    const defaults = customDefaults || getUserDefaults();
    const mappings = customMappings || paymentMappings;
    const finalType = type || defaults.defaultVoucherType || 'RECEIPT';

    setCurrentVoucherIndex(-1);
    setEditingVoucherId(null);
    setVoucherType(finalType);
    setDate(getTodayDate());
    applyNewSequenceNumber(finalType);
    setAmount('');
    setCurrency(defaults.defaultCurrency || 'IQD');
    setIsManualDescription(false);

    setEnableSplitAllocation(false);
    if (configuredCustomAccounts.length > 0) {
      setSplitAllocations(
        configuredCustomAccounts.map((ca: any) => ({
          id: ca.id,
          accountId: ca.targetAccountId,
          accountName: ca.nameAr,
          amount: '',
          note: '',
        }))
      );
    }

    if (finalType === 'JOURNAL') {
      setJournalLines([
        { id: '1', accountId: '', debit: '', credit: '', currency: defaults.defaultCurrency || 'IQD', exchangeRate: '1500', description: '', costCenter: '' },
        { id: '2', accountId: '', debit: '', credit: '', currency: defaults.defaultCurrency || 'IQD', exchangeRate: '1500', description: '', costCenter: '' },
      ]);
      setCashboxAccountId('');
      setOppositeAccountId('');
    } else {
      if (defaults.defaultPaymentMethodId && mappings.some((m) => m.id === defaults.defaultPaymentMethodId)) {
        setSelectedPaymentMethodId(defaults.defaultPaymentMethodId);
        const targetMethod = mappings.find((m) => m.id === defaults.defaultPaymentMethodId);
        if (targetMethod?.targetAccountId && targetMethod.targetAccountId !== 'EMPLOYEE_ASSIGNED') {
          setCashboxAccountId(targetMethod.targetAccountId);
        } else if (customCashboxId || defaults.defaultCashboxAccountId) {
          setCashboxAccountId(defaults.defaultCashboxAccountId || customCashboxId || '');
        }
      } else if (mappings.length > 0) {
        setSelectedPaymentMethodId(mappings[0].id);
        if (customCashboxId) setCashboxAccountId(customCashboxId);
      }
      setOppositeAccountId('');
    }

    setSlipFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Save Employee's Custom Defaults
  const handleSaveUserDefaults = () => {
    const newDefaults: FinancialVoucherUserDefaults = {
      defaultCurrency: formDefaultCurrency,
      defaultPaymentMethodId: formDefaultPaymentMethodId,
      defaultVoucherType: formDefaultVoucherType,
      defaultCashboxAccountId: formDefaultCashboxId || cashboxAccountId,
    };

    localStorage.setItem(USER_DEFAULTS_STORAGE_KEY, JSON.stringify(newDefaults));
    showSuccessNotification('تم حفظ الإعدادات الافتراضية', 'تم اعتماد إعداداتك بنجاح.');
    setSettingsModalOpened(false);

    // Apply to current form if it's currently a new voucher
    if (currentVoucherIndex === -1) {
      handleNewVoucher(formDefaultVoucherType, newDefaults);
    }
  };

  // Navigation handlers
  const handleNavigateFirst = () => {
    if (vouchersList.length > 0) {
      loadVoucherIntoForm(vouchersList[0], 0);
    }
  };

  const handleNavigatePrevious = () => {
    if (currentVoucherIndex < vouchersList.length - 1 && currentVoucherIndex >= 0) {
      const prevIdx = currentVoucherIndex + 1;
      loadVoucherIntoForm(vouchersList[prevIdx], prevIdx);
    } else if (currentVoucherIndex === 0) {
      handleNewVoucher();
    }
  };

  const handleNavigateNext = () => {
    if (currentVoucherIndex > 0) {
      const nextIdx = currentVoucherIndex - 1;
      loadVoucherIntoForm(vouchersList[nextIdx], nextIdx);
    }
  };

  const handleNavigateLast = () => {
    if (vouchersList.length > 0) {
      const lastIdx = vouchersList.length - 1;
      loadVoucherIntoForm(vouchersList[lastIdx], lastIdx);
    }
  };

  // Shortcut hotkeys (Ctrl+S saves without closing) using ref for high performance
  const saveHandlerRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!opened) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveHandlerRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [opened]);

  const isReceipt = voucherType === 'RECEIPT';

  const cashboxAcc = accounts.find((a) => a.id === cashboxAccountId);
  const oppositeAcc = accounts.find((a) => a.id === oppositeAccountId);

  const debitAmount = voucherType === 'JOURNAL' ? totalJournalDebit : numAmount;
  const creditAmount = voucherType === 'JOURNAL' ? totalJournalCredit : numAmount;
  const isReceiptOrPaymentBalanced = numAmount > 0 && cashboxAccountId !== '' && oppositeAccountId !== '';
  const isBalanced = voucherType === 'JOURNAL' ? isJournalBalanced : isReceiptOrPaymentBalanced;

  // Save Voucher (Does NOT close modal; saves and prepares next voucher)
  const handleSaveVoucher = async () => {
    const isEditing = Boolean(editingVoucherId);

    // ── JOURNAL VOUCHER (سند قيد متعدد الأسطر) ──
    if (voucherType === 'JOURNAL') {
      if (!isJournalBalanced) {
        showErrorNotification(
          'تنبيه التوازن',
          `القيد غير متوازن: مجموع المدين (${totalJournalDebit.toLocaleString()}) لا يساوي مجموع الدائن (${totalJournalCredit.toLocaleString()}). الفارق = ${journalDifference.toLocaleString()}`
        );
        return;
      }

      const hasEmptyAccount = journalLines.some((l) => !l.accountId);
      if (hasEmptyAccount) {
        showErrorNotification('تنبيه الإدخال', 'يرجى اختيار الحساب المحاسبي لجميع أسطر سند القيد.');
        return;
      }

      const endpoint = isEditing ? `/api/journal-entries/${editingVoucherId}` : '/api/journal-entries';
      const method = isEditing ? 'PATCH' : 'POST';

      const finalJvNumber = isEditing && voucherNumber ? voucherNumber : await allocateDocumentNumber('journalEntries');

      const payload = {
        date,
        entryNumber: finalJvNumber,
        reference: finalJvNumber,
        description: description || 'سند قيد محاسبي',
        // The rate is the entry's own, not the system's: the backend converts the
        // lines into the ledger's currency with exactly this number and stores both.
        currency,
        exchangeRate: currency === 'USD' ? Number(exchangeRate) || 0 : 1,
        postImmediately: true,
        lines: journalLines.map((line) => ({
          accountId: line.accountId,
          debit: Number(line.debit) || 0,
          credit: Number(line.credit) || 0,
          description: line.description || description || 'سند قيد محاسبي',
          costCenter: line.costCenter || (line.currency === 'USD' || currency === 'USD' ? 'USD' : undefined),
        })),
      };

      const savedVoucherNumber = voucherNumber;

      if (isEditing) {
        // The write is awaited. Firing it in the background and closing immediately
        // meant the page refreshed its list before the PATCH had landed, so the user
        // saw their own edit reverted and concluded saving was broken.
        setLoading(true);
        try {
          const saved = await apiRequest(endpoint, { method, body: JSON.stringify(payload) });
          showSuccessNotification(
            'تم حفظ التعديلات',
            `تم تحديث سند القيد [${savedVoucherNumber || ''}] بنجاح.`,
          );
          onSuccess({
            id: saved?.id || editingVoucherId,
            entryNumber: saved?.entryNumber || savedVoucherNumber,
            voucherNumber: saved?.entryNumber || savedVoucherNumber,
            voucherType: 'JOURNAL',
            sourceType: 'JOURNAL',
            totalDebit: totalJournalDebit,
            totalCredit: totalJournalCredit,
            amount: totalJournalDebit,
            currency,
            date,
            description: payload.description,
            lines: payload.lines,
          });
          onClose();
        } catch (err: any) {
          // Keep the modal open so the typed work is not lost.
          showErrorNotification('خطأ في تعديل القيد', err?.message || 'حدث خطأ أثناء حفظ التعديلات.');
        } finally {
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const saved = await apiRequest(endpoint, { method, body: JSON.stringify(payload) });

        showSuccessNotification(
          'تم حفظ سند القيد',
          `تم حفظ سند القيد [${saved?.entryNumber || savedVoucherNumber || 'الجديد'}] وترحيل الحركة بنجاح.`
        );

        const savedRow = {
          id: saved?.id,
          entryNumber: saved?.entryNumber || savedVoucherNumber,
          voucherNumber: saved?.entryNumber || savedVoucherNumber,
          voucherType: 'JOURNAL',
          sourceType: 'JOURNAL',
          totalDebit: totalJournalDebit,
          totalCredit: totalJournalCredit,
          amount: totalJournalDebit,
          currency,
          date,
          createdAt: new Date().toISOString(),
          description: payload.description,
          lines: payload.lines,
        };

        setVouchersList((prev) => [savedRow, ...prev]);
        onSuccess(savedRow);
        handleNewVoucher('JOURNAL');
      } catch (err: any) {
        showErrorNotification('خطأ في حفظ القيد', err?.message || 'حدث خطأ أثناء حفظ سند القيد.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!isReceiptOrPaymentBalanced) {
      if (!oppositeAccountId) {
        showErrorNotification('تنبيه', isReceipt ? 'يرجى اختيار الحساب المقابل (الطرف الدائن)' : 'يرجى اختيار الحساب المقابل (الطرف المدين)');
        return;
      }
      if (!cashboxAccountId) {
        showErrorNotification('تنبيه', 'يرجى اختيار حساب الصندوق أو البنك');
        return;
      }
      if (numAmount <= 0) {
        showErrorNotification('تنبيه', 'يرجى إدخال مبلغ السند أكبر من الصفر');
        return;
      }
    }

    if (isOverAllocated) {
      showErrorNotification(
        'تنبيه التقسيم',
        `مجموع المبالغ المخصصة (${totalCustomSplitsAmount.toLocaleString('en-US')}) يتجاوز مبلغ السند الإجمالي (${numAmount.toLocaleString('en-US')}).`
      );
      return;
    }

    const unassignedSplit = splitAllocations.find(
      (s) => parseCleanNumber(s.amount) > 0 && !s.accountId
    );
    if (unassignedSplit) {
      showErrorNotification(
        'تنبيه التقسيم',
        `سطر التقسيم بمبلغ (${parseCleanNumber(unassignedSplit.amount).toLocaleString('en-US')}) غير محدد له حساب محاسبي. يرجى اختيار الحساب أو مسح المبلغ.`
      );
      return;
    }

    let endpoint = isReceipt ? '/api/receipt-vouchers' : '/api/payment-vouchers';
    let method = 'POST';

    if (isEditing) {
      endpoint = `${endpoint}/${editingVoucherId}`;
      method = 'PUT';
    }

    const activeCustomSplits = splitAllocations
      .filter((s) => parseCleanNumber(s.amount) > 0)
      .map((s) => ({
        accountId: s.accountId,
        accountName: s.accountName,
        amount: parseCleanNumber(s.amount),
        currency,
        note: s.note || '',
      }));

    /**
     * Only the CUSTOM splits are persisted. The system account's share is derived
     * (`amount - sum(custom)`) and must never be written down.
     *
     * It used to be written into the same array, and on reopening the voucher the
     * whole array was loaded back into `splitAllocations` — so the system row was
     * counted as if it were a custom split. That pushed `totalCustomSplitsAmount`
     * up to the full amount, drove `systemAccountAmount` to zero, and made every
     * subsequent save store a different set than the one before. That feedback loop
     * is why editing a split appeared not to save.
     */
    const activeSplits = hasCustomSplits ? [...activeCustomSplits] : [];

    const splitDesc = activeSplits.length > 0
      ? activeSplits.map((s) => `${s.accountName}: ${Number(s.amount).toLocaleString('en-US')} ${currency}`).join(' | ')
      : undefined;

    // Only the user's own note is sent. The distribution travels as `splitAccounts`
    // and the backend writes it into the entry's lines and their descriptions.
    const finalDescription = stripVoucherSplitMarker(
      description || (isReceipt ? 'سند قبض مالي' : 'سند دفع مالي'),
    );

    const finalVoucherNumber =
      isEditing && voucherNumber
        ? voucherNumber
        : await allocateDocumentNumber(isReceipt ? 'receiptVouchers' : 'paymentVouchers');

    const payload = {
      voucherNumber: finalVoucherNumber,
      amount: numAmount,
      currency,
      exchangeRate: currency === 'USD' ? Number(exchangeRate) || 1 : 1,
      date,
      accountId: oppositeAccountId,
      cashboxOrBankAccountId: cashboxAccountId,
      description: finalDescription,
      ...(selectedPaymentMethodId ? { paymentMethodId: selectedPaymentMethodId } : {}),
      slipsCount: slipFiles.length,
      splitAccounts: activeSplits
        .filter((s) => s.accountId && Number(s.amount) > 0)
        .map((s) => ({
          accountId: s.accountId,
          accountName: s.accountName,
          amount: Number(s.amount),
        })),
    };

    // Capture current values before resetting the form
    const savedVoucherNumber = voucherNumber;
    const savedVoucherType = voucherType;

    // The write is awaited in both branches. The previous "optimistic" version told
    // the page it had saved and fired the request afterwards, so the page's refresh
    // raced the write: on edit it always read the pre-edit row back.
    setLoading(true);
    try {
      const saved = await apiRequest(endpoint, { method, body: JSON.stringify(payload) });

      // Invalidate relevant cache keys so list pages refresh instantly with latest data
      invalidateApiCache('/receipt-vouchers');
      invalidateApiCache('/payment-vouchers');
      invalidateApiCache('/journal-entries');
      invalidateApiCache('/accounts');

      const savedRow = {
        id: saved?.id || editingVoucherId,
        voucherType: savedVoucherType,
        type: savedVoucherType,
        voucherNumber: saved?.voucherNumber || savedVoucherNumber,
        amount: numAmount,
        currency,
        date,
        createdAt: saved?.createdAt || new Date().toISOString(),
        accountId: oppositeAccountId,
        cashboxOrBankAccountId: cashboxAccountId,
        description: finalDescription,
        paymentMethodId: selectedPaymentMethodId,
        splitAccounts: activeSplits.length > 0 ? activeSplits : undefined,
        splitDescription: splitDesc,
      };

      if (isEditing) {
        showSuccessNotification(
          'تم حفظ التعديلات',
          `تم تحديث السند [${savedRow.voucherNumber || ''}] بنجاح.`
        );
        onSuccess(savedRow);
        onClose();
        return;
      }

      showSuccessNotification(
        'تم حفظ السند',
        `تم حفظ السند [${savedRow.voucherNumber || 'الجديد'}] بنجاح.`
      );
      setVouchersList((prev) => [savedRow, ...prev]);
      onSuccess(savedRow);
      // Clear the form so the next voucher can be typed straight away.
      handleNewVoucher(savedVoucherType);
    } catch (err: any) {
      // Modal stays open on failure so nothing typed is thrown away.
      showErrorNotification(
        isEditing ? 'خطأ في تعديل السند' : 'خطأ في الحفظ',
        err?.message || 'حدث خطأ أثناء حفظ السند.'
      );
    } finally {
      setLoading(false);
    }
  };

  saveHandlerRef.current = handleSaveVoucher;

  // Only Operational / Sub-Accounts (No Parent Group Accounts)
  const postingAccounts = useMemo(() => {
    return accounts.filter((a) => {
      // Must NOT be a group account
      if (a.isGroup) return false;
      // Must NOT be a parent category header (1, 11, 111, 2, 23, 232, etc.)
      if (a.code && a.code.length <= 3) return false;
      return true;
    });
  }, [accounts]);

  /**
   * Account pickers used to rebuild their `data` array on every render and, worse,
   * run `accounts.find(...)` for EVERY option on EVERY keystroke — O(n²) over the
   * whole chart of accounts, which is what made the account field freeze while
   * typing. The list is built once and searched through a prebuilt index.
   */
  const ACCOUNT_OPTION_LIMIT = 80;

  const accountSearchIndex = useMemo(() => {
    const index = new Map<string, string>();
    accounts.forEach((a) => {
      index.set(a.id, `${a.nameAr || ''} ${a.code || ''}`.toLowerCase());
    });
    return index;
  }, [accounts]);

  const accountSelectData = useMemo(
    () => postingAccounts.map((acc) => ({ value: acc.id, label: acc.nameAr })),
    [postingAccounts],
  );

  const filterAccountOptions = useCallback(
    ({ options, search }: any) => {
      const q = String(search || '').toLowerCase().trim();
      const source = options as any[];
      const out: any[] = [];
      for (const opt of source) {
        if (q) {
          const hay = accountSearchIndex.get(opt.value) || String(opt.label || '').toLowerCase();
          if (!hay.includes(q)) continue;
        }
        out.push(opt);
        // Stop early: rendering thousands of rows is what stalls the dropdown.
        if (out.length >= ACCOUNT_OPTION_LIMIT) break;
      }
      return out;
    },
    [accountSearchIndex],
  );

  const renderAccountOption = useCallback(
    ({ option }: any) => (
      <div className="py-1 px-1 text-xs font-bold text-slate-900">{option.label}</div>
    ),
    [],
  );

  const cashboxAccounts = accounts.filter(
    (a) =>
      !a.isGroup &&
      (a.code?.startsWith('1101') ||
        a.code?.startsWith('1102') ||
        a.code?.startsWith('181') ||
        a.type === 'CASH' ||
        a.type === 'BANK' ||
        a.nameAr?.includes('صندوق') ||
        a.nameAr?.includes('قاصة') ||
        a.nameAr?.includes('كاش'))
  );

  const cashboxDisplayName = useMemo(() => {
    if (cashboxAcc) {
      return cashboxAcc.nameAr;
    }
    const defaultBox = accounts.find(
      (a) =>
        !a.isGroup &&
        (a.id === loggedInUser?.cashboxAccountId ||
          a.id === loggedInUser?.defaultCashboxId ||
          (loggedInUserName && a.nameAr?.includes(loggedInUserName.split(' ')[0])) ||
          a.code === '11011' ||
          a.code?.startsWith('1101') ||
          a.type === 'CASH')
    );
    if (defaultBox) return defaultBox.nameAr;
    return loggedInUserName ? `صندوق ${loggedInUserName}` : 'صندوق الفرع الافتراضي';
  }, [cashboxAcc, accounts, loggedInUser, loggedInUserName]);

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        transitionProps={{ duration: 0 }}
        size="1100px"
        padding="md"
        radius="16px"
        centered
        styles={{
          content: {
            maxWidth: '1120px',
            width: '1120px',
            height: '92vh',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
          },
          body: {
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            padding: '16px',
          },
        }}
        title={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-xs shrink-0 bg-gradient-to-tr from-[#F45A0A] to-amber-500">
                {voucherType === 'RECEIPT' ? (
                  <IconReceipt size={20} />
                ) : voucherType === 'PAYMENT' ? (
                  <IconCash size={20} />
                ) : voucherType === 'EXCHANGE' ? (
                  <IconArrowsExchange size={20} />
                ) : (
                  <IconFileInvoice size={20} />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-black text-slate-950 text-sm sm:text-base leading-tight">
                    {isEditing
                      ? `تعديل السند المالي [${voucherNumber}]`
                      : voucherType === 'RECEIPT'
                      ? 'إنشاء سند قبض مالي جديد'
                      : voucherType === 'PAYMENT'
                      ? 'إنشاء سند دفع وصرف جديد'
                      : voucherType === 'EXCHANGE'
                      ? 'إنشاء سند صرافة وتحويل جديد'
                      : 'إنشاء قيد محاسبي مزدوج جديد'}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-black border bg-orange-50 text-[#F45A0A] border-orange-200">
                    {voucherType === 'RECEIPT' ? 'سند قبض' : voucherType === 'PAYMENT' ? 'سند دفع' : voucherType === 'EXCHANGE' ? 'سند صرافة' : 'قيد يومية'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  {voucherType === 'RECEIPT'
                    ? 'إثبات استلام وقبض مبالغ نقدية أو بنكية من العملاء والشركات'
                    : voucherType === 'PAYMENT'
                    ? 'إثبات صرف وتسديد مبالغ نقدية للموردين أو المصروفات التشغيلية'
                    : voucherType === 'EXCHANGE'
                    ? 'إثبات تحويل وصرافة عملات بين الصناديق أو الحسابات المالية'
                    : 'تسجيل قيد محاسبي تسووي أو مركب متعدد الأطراف في دفتر اليومية'}
                </p>
              </div>
            </div>
          </div>
        }
      >
        <div className="flex-1 flex flex-col justify-between space-y-2.5 text-xs select-none h-full overflow-hidden" dir="rtl">
          {/* A failed load is stated, not hidden behind an empty-looking form. */}
          {loadError && (
            <div className="shrink-0 bg-rose-50 border border-rose-200 rounded-2xl px-3 py-2.5 flex items-start gap-2">
              <IconAlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="font-extrabold text-[12.5px] text-rose-900 leading-tight">
                  لم تُحمَّل بيانات السند
                </p>
                <p className="text-[11.5px] text-rose-700 font-medium leading-snug">{loadError}</p>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              1. TOP MASTER BAR: Voucher Type + Auto-detected Cashbox + Advanced Date + User + Settings Icon
             ════════════════════════════════════════════════════════════════════ */}
          <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-3 shadow-2xs shrink-0">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
              {/* Voucher Type Square Modern Buttons (Receipt / Payment / Exchange / Journal) */}
              <div className="md:col-span-5">
                <label className="block font-bold text-slate-700 text-xs mb-1">نوع السند المالي</label>
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => {
                      setVoucherType('RECEIPT');
                      if (currentVoucherIndex === -1) applyNewSequenceNumber('RECEIPT');
                    }}
                    className={`flex-1 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      voucherType === 'RECEIPT'
                        ? 'bg-[#F45A0A] text-white shadow-xs font-black'
                        : 'text-slate-700 hover:bg-slate-100 bg-transparent'
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${voucherType === 'RECEIPT' ? 'bg-orange-200' : 'bg-slate-300'}`} />
                    <span>سند قبض</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setVoucherType('PAYMENT');
                      if (currentVoucherIndex === -1) applyNewSequenceNumber('PAYMENT');
                    }}
                    className={`flex-1 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      voucherType === 'PAYMENT'
                        ? 'bg-[#F45A0A] text-white shadow-xs font-black'
                        : 'text-slate-700 hover:bg-slate-100 bg-transparent'
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${voucherType === 'PAYMENT' ? 'bg-orange-200' : 'bg-slate-300'}`} />
                    <span>سند دفع</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setVoucherType('EXCHANGE');
                      if (currentVoucherIndex === -1) applyNewSequenceNumber('EXCHANGE');
                    }}
                    className={`flex-1 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      voucherType === 'EXCHANGE'
                        ? 'bg-[#F45A0A] text-white shadow-xs font-black'
                        : 'text-slate-700 hover:bg-slate-100 bg-transparent'
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${voucherType === 'EXCHANGE' ? 'bg-orange-200' : 'bg-slate-300'}`} />
                    <span>سند صرافة</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setVoucherType('JOURNAL');
                      if (currentVoucherIndex === -1) applyNewSequenceNumber('JOURNAL');
                    }}
                    className={`flex-1 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      voucherType === 'JOURNAL'
                        ? 'bg-[#F45A0A] text-white shadow-xs font-black'
                        : 'text-slate-700 hover:bg-slate-100 bg-transparent'
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${voucherType === 'JOURNAL' ? 'bg-orange-200' : 'bg-slate-300'}`} />
                    <span>سند قيد</span>
                  </button>
                </div>
              </div>

              {/* Journal-only context. The employee cashbox now lives in the bottom bar. */}
              {voucherType === 'JOURNAL' && (
                <div className="md:col-span-3">
                  <label className="block font-bold text-slate-700 text-xs mb-1 flex items-center gap-1">
                    <IconFileInvoice size={14} className="text-[#F45A0A]" />
                    <span>تصنيف السند المحاسبي</span>
                  </label>
                  <div className="h-8.5 bg-orange-50/60 border border-orange-200 rounded-xl px-3 flex items-center justify-between text-xs font-bold text-orange-950 shadow-2xs">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="h-2 w-2 rounded-full bg-[#F45A0A] shrink-0" />
                      <span className="truncate">قيد محاسبي مزدوج / مركب</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-orange-100 text-orange-800 font-bold">
                      JV
                    </span>
                  </div>
                </div>
              )}

              {/* Advanced Accounting Date Picker */}
              <div className={voucherType === 'JOURNAL' ? 'md:col-span-2' : 'md:col-span-3'}>
                <label className="block font-bold text-slate-700 text-xs mb-1">تاريخ السند *</label>
                <AccountingDatePicker
                  value={date}
                  onChange={(d) => setDate(d ? d.replace(/\//g, '-') : getTodayDate())}
                  placeholder="سنة/شهر/يوم"
                />
              </div>

              {/* User Creator & Settings + Audit Icons */}
              <div className={`${voucherType === 'JOURNAL' ? 'md:col-span-2' : 'md:col-span-4'} flex items-end justify-between gap-1.5`}>
                <div className="flex-1 min-w-0">
                  <label className="block font-bold text-slate-700 text-xs mb-1 truncate">المستخدم</label>
                  <div className="h-8.5 px-2 bg-white border border-slate-200 rounded-xl flex items-center gap-1.5 truncate text-[11px] font-bold text-slate-800 shadow-2xs">
                    <IconUser size={13} className="text-slate-400 shrink-0" />
                    <span className="truncate">{loggedInUserName}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Settings Icon Button */}
                  <Tooltip label="تخصيص الإعدادات الافتراضية" withArrow>
                    <button
                      type="button"
                      onClick={() => setSettingsModalOpened(true)}
                      className="h-8.5 w-8.5 rounded-xl border border-slate-200 text-slate-600 hover:text-orange-600 hover:border-orange-300 bg-white flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
                    >
                      <IconSettings size={15} />
                    </button>
                  </Tooltip>

                  {/* Audit History Icon */}
                  <Tooltip label="سجل التعديلات والتدقيق" withArrow>
                    <button
                      type="button"
                      onClick={() => setAuditModalOpened(true)}
                      className="h-8.5 w-8.5 rounded-xl border border-slate-200 text-slate-600 hover:text-orange-600 hover:border-orange-300 bg-white flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
                    >
                      <IconHistory size={15} />
                    </button>
                  </Tooltip>
                </div>
              </div>
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════════════
              2. COUNTERPARTY ACCOUNT & ATTACHMENTS (Only for Receipt and Payment Vouchers)
             ════════════════════════════════════════════════════════════════════ */}
          {voucherType !== 'JOURNAL' && (
            <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-2.5 shadow-2xs space-y-2 shrink-0">
              <div className="flex items-end gap-2">
                {/* Opposing account — full width */}
                <div className="flex-1 min-w-0">
                  <label className="block font-bold text-slate-700 text-xs mb-1 truncate">
                    {isReceipt ? 'الحساب المقابل (الطرف الدائن ⬅️) *' : 'الحساب المقابل (الطرف المدين ➡️) *'}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 min-w-0">
                      <Select
                        searchable
                        clearable
                        placeholder="ابحث بالاسم (عميل، مورد، مكتب بورصة، شركة)..."
                        value={oppositeAccountId}
                        onChange={(val) => setOppositeAccountId(val || '')}
                        data={accountSelectData}
                        renderOption={renderAccountOption}
                        filter={filterAccountOptions}
                        limit={ACCOUNT_OPTION_LIMIT}
                        nothingFoundMessage="لا توجد نتائج مطابقة"
                        maxDropdownHeight={280}
                        styles={{
                          input: {
                            height: '42px',
                            fontSize: '13px',
                            fontWeight: 700,
                            backgroundColor: '#ffffff',
                            borderColor: '#cbd5e1',
                            borderRadius: '12px',
                          },
                        }}
                        required
                      />
                    </div>

                    <Tooltip label="إضافة حساب جديد في الدليل" withArrow>
                      <button
                        type="button"
                        onClick={() => setCreateAccountModalOpened(true)}
                        className="h-[42px] w-[42px] min-w-[42px] rounded-xl border border-slate-200 bg-white hover:bg-orange-50 hover:border-orange-300 text-slate-700 hover:text-[#F45A0A] flex items-center justify-center cursor-pointer transition-colors shadow-2xs"
                      >
                        <IconUserPlus size={17} />
                      </button>
                    </Tooltip>
                  </div>
                </div>

                {/* Multi-Slip Attachment Trigger */}
                <div className="shrink-0 w-36 min-w-[130px]">
                  <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    accept="image/*,.pdf"
                    onChange={handleMultipleFilesChange}
                    className="hidden"
                  />
                  <Tooltip label={slipFiles.length > 0 ? `إضافة وصل آخر (${slipFiles.length} مرفق)` : 'إرفاق وصل التسديد'} withArrow>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={`h-[42px] w-full rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs px-3 ${
                        slipFiles.length > 0
                          ? 'bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <IconPaperclip size={15} className="text-teal-600 shrink-0" />
                      <span>{slipFiles.length > 0 ? `الوصل (${slipFiles.length})` : 'إرفاق وصل'}</span>
                    </button>
                  </Tooltip>
                </div>
              </div>

              {/* Attached Slips Previews */}
              {slipFiles.length > 0 && (
                <div className="pt-1.5 border-t border-slate-200 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-600">الوصولات المرفقة ({slipFiles.length}):</span>
                  {slipFiles.map((slip, idx) => (
                    <div
                      key={slip.id}
                      className="flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-0.5 rounded-lg shadow-2xs text-xs font-bold text-slate-800"
                    >
                      {slip.previewUrl ? (
                        <img
                          src={slip.previewUrl}
                          alt="وصل"
                          className="h-5 w-5 object-cover rounded border border-slate-200 cursor-pointer"
                          onClick={() => window.open(slip.previewUrl, '_blank')}
                        />
                      ) : (
                        <IconFileText size={14} className="text-blue-600" />
                      )}
                      <span className="truncate max-w-[120px] text-[11px]">وصل #{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSingleSlip(slip.id)}
                        className="p-0.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded cursor-pointer transition-colors"
                      >
                        <IconTrash size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              3. FORM BODY: MULTI-LINE GRID (For JOURNAL) OR SINGLE FORM (For RV / PV)
             ════════════════════════════════════════════════════════════════════ */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-2xs space-y-2.5 flex-1 flex flex-col justify-between overflow-y-auto min-h-0">
            {voucherType === 'JOURNAL' ? (
              <div className="space-y-2 flex-1 flex flex-col justify-between">
                {/* Multi-Line Journal Grid Header Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 shrink-0">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAddJournalLine}
                      className="h-[32px] px-3 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                    >
                      <IconPlus size={14} />
                      <span>+ إضافة سطر قيد جديد</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleAutoBalance}
                      className="h-[32px] px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                    >
                      <IconRefresh size={14} className="text-[#F45A0A]" />
                      <span>⚡ موازنة القيد تلقائياً</span>
                    </button>
                  </div>

                  {/* Currency Selector */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700">عملة القيد:</span>
                    <div className="h-7.5 flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 gap-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setCurrency('IQD');
                          setJournalLines((prev) => prev.map((l) => ({ ...l, currency: 'IQD' })));
                        }}
                        className={`h-full px-3 rounded-lg text-xs font-black transition-all cursor-pointer ${
                          currency === 'IQD' ? 'bg-[#F45A0A] text-white shadow-2xs' : 'text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        IQD (د.ع)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCurrency('USD');
                          setJournalLines((prev) => prev.map((l) => ({ ...l, currency: 'USD' })));
                        }}
                        className={`h-full px-3 rounded-lg text-xs font-black transition-all cursor-pointer ${
                          currency === 'USD' ? 'bg-[#F45A0A] text-white shadow-2xs' : 'text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        USD ($)
                      </button>
                    </div>

                    {/* The rate was a fixed badge read from the system, which made a
                        foreign-currency entry impossible to record at the rate that
                        actually applied to it. It is the entry's own field now. */}
                    {currency === 'USD' && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-700">سعر الصرف:</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={exchangeRate}
                          onChange={(e) => setExchangeRate(e.target.value)}
                          placeholder="1550"
                          aria-label="سعر صرف الدولار لهذا القيد"
                          className="h-7.5 w-24 px-2 rounded-xl border border-slate-300 bg-white font-mono font-black text-xs text-center text-slate-900 tabular-nums lining-nums focus:outline-none focus:border-[#F45A0A] shadow-2xs"
                        />
                        {adoptedExchange?.adoptedRate && Number(exchangeRate) !== Number(adoptedExchange.adoptedRate) && (
                          <button
                            type="button"
                            onClick={() => setExchangeRate(String(adoptedExchange.adoptedRate))}
                            title={`استعادة السعر المعتمد في النظام: ${Number(adoptedExchange.adoptedRate).toLocaleString('en-US')}`}
                            className="h-7.5 px-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 font-bold text-[10.5px] hover:bg-amber-100 transition-colors cursor-pointer"
                          >
                            المعتمد {Number(adoptedExchange.adoptedRate).toLocaleString('en-US')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Multi-Line Table Grid */}
                <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-2xs max-h-[220px] overflow-y-auto flex-1">
                  <table className="w-full text-xs text-start border-collapse">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-100 border-b border-slate-200 font-bold text-slate-800 h-[34px]">
                        <th className="py-1 px-2.5 border-l border-slate-200 w-10 text-center text-slate-500">#</th>
                        <th className="py-1 px-2.5 border-l border-slate-200 min-w-[260px]">الحساب المحاسبي *</th>
                        <th className="py-1 px-2.5 border-l border-slate-200 w-36 text-center text-emerald-800 bg-emerald-50">مدين (Debit)</th>
                        <th className="py-1 px-2.5 border-l border-slate-200 w-36 text-center text-rose-800 bg-rose-50">دائن (Credit)</th>
                        <th className="py-1 px-2.5 border-l border-slate-200 w-24 text-center">العملة</th>
                        <th className="py-1 px-2.5 border-l border-slate-200 min-w-[220px]">البيان وملاحظات السطر</th>
                        <th className="py-1 px-2.5 w-10 text-center">حذف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {journalLines.map((line, idx) => (
                        <tr key={line.id} className={idx % 2 === 0 ? 'bg-white hover:bg-slate-50/80' : 'bg-slate-50/40 hover:bg-slate-100/70'}>
                          {/* Row Index */}
                          <td className="py-1 px-1.5 border-l border-slate-200 text-center font-mono font-bold text-slate-500">
                            {idx + 1}
                          </td>

                          {/* Account Select + Quick Add Modal */}
                          <td className="py-1 px-1.5 border-l border-slate-200">
                            <div className="flex items-center gap-1">
                              <div className="flex-1">
                                <Select
                                  searchable
                                  clearable
                                  size="xs"
                                  placeholder="اختر أو ابحث عن الحساب..."
                                  value={line.accountId}
                                  onChange={(val) => handleJournalLineChange(line.id, 'accountId', val || '')}
                                  data={accountSelectData}
                                  renderOption={renderAccountOption}
                                  filter={filterAccountOptions}
                                  limit={ACCOUNT_OPTION_LIMIT}
                                  nothingFoundMessage="لا توجد نتائج مطابقة"
                                  maxDropdownHeight={260}
                                  styles={{
                                    input: {
                                      height: '34px',
                                      fontSize: '12px',
                                      fontWeight: 700,
                                      backgroundColor: line.accountId ? '#ffffff' : '#fffbeb',
                                      borderColor: line.accountId ? '#cbd5e1' : '#f59e0b',
                                      borderRadius: '10px',
                                    },
                                  }}
                                />
                              </div>
                              <Tooltip label="إضافة حساب جديد" withArrow>
                                <button
                                  type="button"
                                  onClick={() => setCreateAccountModalOpened(true)}
                                  className="h-[34px] w-[34px] rounded-xl border border-slate-200 bg-white hover:bg-orange-50 hover:text-[#F45A0A] text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                                >
                                  <IconUserPlus size={14} />
                                </button>
                              </Tooltip>
                            </div>
                          </td>

                          {/* Debit Input */}
                          <td className="py-1 px-1.5 border-l border-slate-200">
                            <FormattedNumberInput
                              size="xs"
                              placeholder="0.00"
                              value={line.debit}
                              onChange={(val) => handleJournalLineChange(line.id, 'debit', val)}
                              styles={{
                                input: {
                                  height: '34px',
                                  fontSize: '13px',
                                  fontWeight: 800,
                                  fontFamily: 'monospace',
                                  textAlign: 'left',
                                  color: Number(line.debit) > 0 ? '#047857' : '#1e293b',
                                  backgroundColor: Number(line.debit) > 0 ? '#ecfdf5' : '#ffffff',
                                  borderColor: Number(line.debit) > 0 ? '#10b981' : '#cbd5e1',
                                  borderRadius: '10px',
                                },
                              }}
                            />
                          </td>

                          {/* Credit Input */}
                          <td className="py-1 px-1.5 border-l border-slate-200">
                            <FormattedNumberInput
                              size="xs"
                              placeholder="0.00"
                              value={line.credit}
                              onChange={(val) => handleJournalLineChange(line.id, 'credit', val)}
                              styles={{
                                input: {
                                  height: '34px',
                                  fontSize: '13px',
                                  fontWeight: 800,
                                  fontFamily: 'monospace',
                                  textAlign: 'left',
                                  color: Number(line.credit) > 0 ? '#be123c' : '#1e293b',
                                  backgroundColor: Number(line.credit) > 0 ? '#fff1f2' : '#ffffff',
                                  borderColor: Number(line.credit) > 0 ? '#f43f5e' : '#cbd5e1',
                                  borderRadius: '10px',
                                },
                              }}
                            />
                          </td>

                          {/* Currency & Exchange Rate beneath */}
                          <td className="py-1 px-1.5 border-l border-slate-200 text-center">
                            <div className="flex flex-col items-center justify-center gap-0.5">
                              <span className={`font-mono font-black text-xs px-2.5 py-0.5 rounded-md ${
                                (line.currency || currency) === 'USD'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs'
                                  : 'bg-slate-100 text-slate-800 border border-slate-200'
                              }`}>
                                {line.currency || currency}
                              </span>
                              {(line.currency || currency) === 'USD' && (
                                <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-50 border border-slate-200 px-1.5 py-0.2 rounded shadow-2xs tabular-nums lining-nums">
                                  {Number(exchangeRate) > 0 ? Number(exchangeRate).toLocaleString('en-US') : '—'}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Line Description / Notes */}
                          <td className="py-1 px-1.5 border-l border-slate-200">
                            <input
                              type="text"
                              value={line.description || ''}
                              onChange={(e) => handleJournalLineChange(line.id, 'description', e.target.value)}
                              placeholder="اكتب ملاحظة وبيان السطر..."
                              className="w-full h-[34px] px-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 bg-white focus:outline-hidden focus:border-blue-500 font-medium"
                            />
                          </td>

                          {/* Delete Line Action */}
                          <td className="py-1 px-1 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveJournalLine(line.id)}
                              disabled={journalLines.length <= 2}
                              className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer transition-colors disabled:opacity-30"
                            >
                              <IconTrash size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>

                    {/* Grid Footer with Totals & Balance Badge */}
                    <tfoot className="sticky bottom-0 z-10">
                      <tr className="bg-slate-100 border-t-2 border-slate-200 font-bold h-[40px]">
                        <td colSpan={2} className="py-1 px-3 text-start text-slate-800">
                          <span>مجموع الأسطر: </span>
                          <span className="font-mono text-slate-900 font-black">{journalLines.length}</span>
                        </td>
                        <td className="py-1 px-2.5 border-l border-slate-200 font-mono font-black text-left text-emerald-800 text-xs bg-emerald-50/50">
                          {totalJournalDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-1 px-2.5 border-l border-slate-200 font-mono font-black text-left text-rose-800 text-xs bg-rose-50/50">
                          {totalJournalCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td colSpan={3} className="py-1 px-3 text-center">
                          <div className="flex items-center justify-between">
                            <span
                              className={`px-3 py-1 rounded-lg text-xs font-black ${
                                isJournalBalanced
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-rose-600 text-white'
                              }`}
                            >
                              {isJournalBalanced ? '✓ طرفا القيد متوازنان ومكتملان 100%' : journalBlocker}
                            </span>

                            {/* The ledger is kept in dinars, so a dollar entry is posted
                                converted. Showing the converted figure here means the
                                user approves the number that will actually be booked. */}
                            {currency === 'USD' && Number(exchangeRate) > 0 && (
                              <span className="px-3 py-1 rounded-lg text-xs font-black bg-white border border-slate-300 text-slate-800 font-mono tabular-nums lining-nums">
                                يُرحَّل بالدينار: {(totalJournalDebit * Number(exchangeRate)).toLocaleString('en-US')}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* General Voucher Description / Note */}
                <div className="pt-1">
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-800 text-xs">
                      البيان والملاحظات العامة الشاملة لسند القيد:
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateAutoJournalDescription}
                      className="text-[11px] text-[#F45A0A] hover:underline font-bold cursor-pointer flex items-center gap-0.5"
                    >
                      <IconRefresh size={11} />
                      توليد البيان العام تلقائياً من أسماء الحسابات
                    </button>
                  </div>
                  <Textarea
                    placeholder="اكتب البيان والملاحظات العامة لسند القيد..."
                    rows={2}
                    minRows={2}
                    size="xs"
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      setIsManualDescription(true);
                    }}
                    styles={{
                      input: {
                        backgroundColor: '#ffffff',
                        borderColor: '#cbd5e1',
                        fontSize: '13px',
                        lineHeight: '1.6',
                        borderRadius: '12px',
                      },
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
                  {/* Amount Field (Centered & Bold) */}
                  <div className={currency === 'USD' ? 'md:col-span-4' : 'md:col-span-5'}>
                    <label className="block font-bold text-slate-800 text-xs mb-1">
                      المبلغ المطلوب *
                    </label>
                    <FormattedNumberInput
                      placeholder="0.00"
                      value={amount}
                      onChange={setAmount}
                      styles={{
                        input: {
                          height: '42px',
                          fontSize: '19px',
                          fontWeight: 900,
                          backgroundColor: '#ffffff',
                          borderColor: '#cbd5e1',
                          textAlign: 'center',
                          borderRadius: '12px',
                        },
                      }}
                      autoFocus
                      required
                    />
                  </div>

                  {/* Currency — sits directly beside the Amount field */}
                  <div className="md:col-span-2 min-w-0">
                    <label className="block font-bold text-slate-700 text-xs mb-1">عملة السند</label>
                    <div className="h-[42px] flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setCurrency('IQD');
                          setJournalLines((prev) => prev.map((l) => ({ ...l, currency: 'IQD' })));
                        }}
                        className={`flex-1 h-full rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center ${
                          currency === 'IQD'
                            ? 'bg-[#F45A0A] text-white shadow-xs'
                            : 'text-slate-700 hover:bg-slate-200 bg-transparent'
                        }`}
                      >
                        IQD
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCurrency('USD');
                          setJournalLines((prev) => prev.map((l) => ({ ...l, currency: 'USD' })));
                        }}
                        className={`flex-1 h-full rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center ${
                          currency === 'USD'
                            ? 'bg-[#F45A0A] text-white shadow-xs'
                            : 'text-slate-700 hover:bg-slate-200 bg-transparent'
                        }`}
                      >
                        USD
                      </button>
                    </div>
                  </div>

                  {/* Payment Method — sits directly beside Amount & Currency */}
                  <div className={currency === 'USD' ? 'md:col-span-4 min-w-0' : 'md:col-span-5 min-w-0'}>
                    <label className="block font-bold text-slate-700 text-xs mb-1">طريقة التسديد *</label>
                    <div className="min-h-[42px] flex flex-wrap items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                      {paymentMappings.map((method) => {
                        const isSelected = selectedPaymentMethodId === method.id;
                        return (
                          <button
                            key={method.id}
                            type="button"
                            onClick={() => handleSelectPaymentMethod(method)}
                            className={`h-8 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                              isSelected
                                ? 'bg-[#F45A0A] text-white shadow-2xs font-black'
                                : 'text-slate-700 hover:bg-slate-100 bg-transparent'
                            }`}
                          >
                            {method.type === 'CASH' ? <IconCash size={14} /> : <IconCreditCard size={14} />}
                            <span className="truncate">{method.nameAr}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Clean Numeric Exchange Rate Input when USD */}
                  {currency === 'USD' && (
                    <div className="md:col-span-2 min-w-0">
                      <label className="block font-bold text-slate-800 text-xs mb-1">
                        سعر الصرف
                      </label>
                      <input
                        type="text"
                        value={exchangeRate}
                        onChange={(e) => setExchangeRate(e.target.value)}
                        placeholder="1550"
                        className="w-full h-[42px] px-2.5 rounded-xl border border-slate-300 bg-white font-mono font-black text-sm text-center text-slate-900 focus:outline-none focus:border-[#F45A0A] shadow-2xs"
                      />
                    </div>
                  )}
                </div>

                {/* ── Custom Allocation & Split Section (Side-by-Side Unified Container) ── */}
                <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-200/70 pb-1.5">
                    <span className="font-extrabold text-xs text-slate-900">التقسيم</span>

                    {isOverAllocated ? (
                      <Badge size="xs" color="red" variant="filled" className="font-bold">
                        تجاوز {totalCustomSplitsAmount.toLocaleString('en-US')} {currency}
                      </Badge>
                    ) : (
                      <Badge size="xs" color="emerald" variant="light" className="font-bold">
                        متطابق {numAmount.toLocaleString('en-US')} {currency}
                      </Badge>
                    )}
                  </div>

                  {/* Side-by-Side Grid (واحد بجانب الآخر في نفس الحاوية) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 items-stretch">
                    {/* 1. حساب النظام (الرصيد الأساسي التلقائي) - في الجانب الأيمن */}
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-2 shadow-2xs">
                      <div className="min-w-0 flex-1">
                        <span className="font-black text-xs text-slate-800 block truncate">
                          حساب النظام (الأساسي)
                        </span>
                        <span className="text-[10.5px] text-slate-500 font-bold block truncate">
                          {oppositeAcc?.nameAr ? oppositeAcc.nameAr : 'الرصيد المتبقي'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="w-44 sm:w-52 h-[38px] rounded-lg bg-slate-50 border border-slate-300 px-2.5 flex items-center justify-center shadow-2xs">
                          <span className="font-mono font-black text-sm text-slate-900 tabular-nums">
                            {systemAccountAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-600 font-bold bg-slate-100 px-2 py-1.5 rounded border border-slate-200 shrink-0">
                          آلي
                        </span>
                      </div>
                    </div>

                    {/* 2. الحسابات المخصصة - بجانبها في نفس الحاوية والشبكة */}
                    {splitAllocations.map((item, sIdx) => (
                      <div
                        key={item.id || sIdx}
                        className="bg-white p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 transition-all flex items-center justify-between gap-2 shadow-2xs"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-xs text-slate-800 block truncate">
                            {item.accountName}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="w-44 sm:w-52">
                            <FormattedNumberInput
                              size="xs"
                              placeholder="0.00"
                              value={item.amount}
                              onChange={(v) => handleSplitAmountChange(item.id, v)}
                              styles={{
                                input: {
                                  height: '38px',
                                  fontSize: '14px',
                                  fontWeight: 800,
                                  fontFamily: 'monospace',
                                  textAlign: 'center',
                                  color: '#0f172a',
                                  backgroundColor: '#ffffff',
                                  borderColor: '#cbd5e1',
                                  borderRadius: '8px',
                                },
                              }}
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleFillRemaining(item.id)}
                            title="تعبئة كامل المبلغ المتبقي لهذا الحساب"
                            className="h-[38px] px-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-[11px] font-bold text-slate-700 border border-slate-200 cursor-pointer shadow-2xs transition-colors shrink-0"
                          >
                            المتبقي
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Split accounts are configured in Settings, so no inline picker here. */}
                  {hasCustomSplits && (
                    <div className="pt-1 flex items-center justify-end border-t border-slate-200/70">
                      <button
                        type="button"
                        onClick={handleResetCustomSplits}
                        className="px-2.5 py-1 rounded-lg text-[10.5px] font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 cursor-pointer transition-colors"
                      >
                        تصفير المبالغ المخصصة ↺
                      </button>
                    </div>
                  )}
                </div>

                {/* Description Field */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-800 text-xs">
                      البيان وشرح السند المحاسبي (يكتب تلقائياً ويمكن تعديله) *
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsManualDescription(false)}
                      className="text-[11px] text-[#F45A0A] hover:underline font-bold cursor-pointer flex items-center gap-0.5"
                    >
                      <IconRefresh size={11} />
                      إعادة إنشاء البيان التلقائي
                    </button>
                  </div>
                  <Textarea
                    placeholder="اكتب البيان والتفاصيل كاملة..."
                    rows={3}
                    minRows={3}
                    size="xs"
                    required
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      setIsManualDescription(true);
                    }}
                    styles={{
                      input: {
                        backgroundColor: '#ffffff',
                        borderColor: '#cbd5e1',
                        fontSize: '13px',
                        lineHeight: '1.6',
                        borderRadius: '12px',
                      },
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ════════════════════════════════════════════════════════════════════
              4. COLLAPSIBLE JOURNAL ENTRY PREVIEW (Only for RV / PV)
             ════════════════════════════════════════════════════════════════════ */}
          {voucherType !== 'JOURNAL' && (
            <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-3 shadow-2xs space-y-2">
              <button
                type="button"
                onClick={() => setPreviewJournalOpened(!previewJournalOpened)}
                className="w-full flex items-center justify-between cursor-pointer font-bold text-xs text-slate-800 hover:text-slate-900"
              >
                <div className="flex items-center gap-2">
                  <IconEye size={15} className="text-[#F45A0A]" />
                  <span>معاينة القيد المحاسبي التلقائي (Live Journal Entry Preview)</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isBalanced ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'}`}>
                    {isBalanced ? 'القيد متوازن 100%' : 'بانتظار إكمال الحقول والمبلغ'}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-slate-500 text-[11px]">
                  <span>{previewJournalOpened ? 'إخفاء' : 'عرض'}</span>
                  {previewJournalOpened ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                </div>
              </button>

              {previewJournalOpened && (
                <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white mt-2">
                  <table className="w-full text-xs text-start border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 font-bold text-slate-900 h-[32px]">
                        <th className="py-1 px-3 border-l border-slate-200">الحساب المحاسبي</th>
                        <th className="py-1 px-3 border-l border-slate-200">البيان الفرعي</th>
                        <th className="py-1 px-3 border-l border-slate-200 text-left font-mono">مدين (Debit)</th>
                        <th className="py-1 px-3 border-l border-slate-200 text-left font-mono">دائن (Credit)</th>
                        <th className="py-1 px-3 text-center w-16">العملة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {/* DEBIT SIDE — Cashbox (Receipt) or Opposite (Payment) */}
                      <tr className="h-[32px] bg-emerald-50/40">
                        <td className="py-1 px-3 border-l border-slate-100 font-bold text-slate-900">
                          {isReceipt
                            ? cashboxAcc ? cashboxAcc.nameAr : '[الصندوق / البنك]'
                            : oppositeAcc ? oppositeAcc.nameAr : '[الحساب المقابل]'}
                        </td>
                        <td className="py-1 px-3 border-l border-slate-100 text-slate-600 truncate max-w-[280px]">
                          {description}
                        </td>
                        <td className="py-1 px-3 border-l border-slate-100 font-mono font-black tabular-nums text-left text-emerald-800">
                          {debitAmount > 0 ? debitAmount.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                        </td>
                        <td className="py-1 px-3 border-l border-slate-100 font-mono text-left text-slate-400">-</td>
                        <td className="py-1 px-3 text-center font-mono font-bold text-slate-500">{currency}</td>
                      </tr>

                      {/* CREDIT SIDE — Split lines (if any) + primary account remainder */}
                      {(() => {
                        // When there are custom splits with amounts, show each split as a separate credit line
                        const activeSplitLines = splitAllocations.filter((s) => parseCleanNumber(s.amount) > 0);
                        if (activeSplitLines.length > 0) {
                          const rows: React.ReactNode[] = [];
                          activeSplitLines.forEach((split, idx) => {
                            const splitAmt = parseCleanNumber(split.amount);
                            rows.push(
                              <tr key={`split-${idx}`} className="h-[32px] bg-orange-50/30">
                                <td className="py-1 px-3 border-l border-slate-100 font-bold text-slate-900">
                                  {split.accountName || accounts.find((a) => a.id === split.accountId)?.nameAr || '[حساب تقسيم]'}
                                </td>
                                <td className="py-1 px-3 border-l border-slate-100 text-slate-600 truncate max-w-[280px]">
                                  {description}
                                </td>
                                <td className="py-1 px-3 border-l border-slate-100 font-mono text-left text-slate-400">-</td>
                                <td className="py-1 px-3 border-l border-slate-100 font-mono font-black tabular-nums text-left text-rose-800">
                                  {splitAmt > 0 ? splitAmt.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                                </td>
                                <td className="py-1 px-3 text-center font-mono font-bold text-slate-500">{currency}</td>
                              </tr>
                            );
                          });
                          // Primary account gets the remainder
                          if (systemAccountAmount > 0) {
                            rows.push(
                              <tr key="primary-remainder" className="h-[32px] bg-slate-50">
                                <td className="py-1 px-3 border-l border-slate-100 font-bold text-slate-900">
                                  {isReceipt
                                    ? oppositeAcc ? oppositeAcc.nameAr : '[الحساب المقابل]'
                                    : cashboxAcc ? cashboxAcc.nameAr : '[الصندوق / البنك]'}
                                </td>
                                <td className="py-1 px-3 border-l border-slate-100 text-slate-600 truncate max-w-[280px]">
                                  {description}
                                </td>
                                <td className="py-1 px-3 border-l border-slate-100 font-mono text-left text-slate-400">-</td>
                                <td className="py-1 px-3 border-l border-slate-100 font-mono font-black tabular-nums text-left text-rose-800">
                                  {systemAccountAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="py-1 px-3 text-center font-mono font-bold text-slate-500">{currency}</td>
                              </tr>
                            );
                          }
                          return rows;
                        }

                        // Default: single credit line for the primary account
                        return (
                          <tr className="h-[32px] bg-slate-50">
                            <td className="py-1 px-3 border-l border-slate-100 font-bold text-slate-900">
                              {isReceipt
                                ? oppositeAcc ? oppositeAcc.nameAr : '[الحساب المقابل]'
                                : cashboxAcc ? cashboxAcc.nameAr : '[الصندوق / البنك]'}
                            </td>
                            <td className="py-1 px-3 border-l border-slate-100 text-slate-600 truncate max-w-[280px]">
                              {description}
                            </td>
                            <td className="py-1 px-3 border-l border-slate-100 font-mono text-left text-slate-400">-</td>
                            <td className="py-1 px-3 border-l border-slate-100 font-mono font-black tabular-nums text-left text-rose-800">
                              {creditAmount > 0 ? creditAmount.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                            </td>
                            <td className="py-1 px-3 text-center font-mono font-bold text-slate-500">{currency}</td>
                          </tr>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              5. BOTTOM BAR: Single Clean Fixed Row with Voucher Number between Navigation
             ════════════════════════════════════════════════════════════════════ */}
          <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-2.5 flex items-center justify-between gap-2 select-none">
            {/* Right: Navigation Controls + Voucher Number In-Between */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
              <Tooltip label="السند الأول (الأحدث)" withArrow>
                <button
                  type="button"
                  onClick={handleNavigateFirst}
                  disabled={vouchersList.length === 0}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                >
                  <IconChevronsRight size={14} />
                </button>
              </Tooltip>

              <Tooltip label="السند السابق" withArrow>
                <button
                  type="button"
                  onClick={handleNavigatePrevious}
                  disabled={vouchersList.length === 0}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                >
                  <IconChevronRight size={14} />
                </button>
              </Tooltip>

              {/* رقم السند بين أزرار التنقل */}
              <div className="bg-slate-100 border border-slate-200 px-3 py-1 rounded-lg flex items-center gap-2 mx-1">
                <span className="text-[10.5px] text-slate-500 font-bold">رقم السند:</span>
                <span className="font-mono font-black text-xs text-slate-950 tabular-nums">
                  {voucherNumber || (voucherType === 'RECEIPT' ? 'KAB-RV-2026-0001' : voucherType === 'PAYMENT' ? 'KAB-PV-2026-0001' : 'KAB-JV-2026-0001')}
                </span>
                {currentVoucherIndex !== -1 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-teal-50 text-teal-700">
                    سجل #{currentVoucherIndex + 1}
                  </span>
                )}
              </div>

              {/* Index Counter */}
              {currentVoucherIndex !== -1 && (
                <span className="px-1.5 font-mono text-[11px] text-slate-700 font-bold min-w-[35px] text-center">
                  {currentVoucherIndex + 1} / {vouchersList.length}
                </span>
              )}

              <Tooltip label="السند التالي" withArrow>
                <button
                  type="button"
                  onClick={handleNavigateNext}
                  disabled={currentVoucherIndex === -1}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                >
                  <IconChevronLeft size={14} />
                </button>
              </Tooltip>

              <Tooltip label="السند الأخير (الأقدم)" withArrow>
                <button
                  type="button"
                  onClick={handleNavigateLast}
                  disabled={vouchersList.length === 0}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                >
                  <IconChevronsLeft size={14} />
                </button>
              </Tooltip>

              <div className="h-4 w-px bg-slate-200 mx-1" />

              <Tooltip label="إنشاء سند مالي جديد (تفريغ الحقول)" withArrow>
                <button
                  type="button"
                  onClick={() => handleNewVoucher()}
                  className="h-7 px-2.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-[#F45A0A] font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <IconPlus size={13} />
                  <span>سند جديد</span>
                </button>
              </Tooltip>
            </div>

            {/* Employee cashbox — moved here off the top bar, where it reads as context
                rather than as another field to fill. */}
            {voucherType !== 'JOURNAL' && (
              <Tooltip label="الصندوق المرتبط بالموظف" withArrow>
                <div className="hidden md:flex items-center gap-2 h-9 px-2.5 min-w-0 bg-white border border-slate-200 rounded-xl shadow-2xs">
                  <IconBuildingBank size={14} className="text-amber-600 shrink-0" />
                  <span className="text-[10.5px] text-slate-500 font-bold shrink-0">الصندوق:</span>
                  <span className="text-[11.5px] font-bold text-slate-800 truncate max-w-[190px]">
                    {cashboxDisplayName}
                  </span>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                </div>
              </Tooltip>
            )}

            {/* Left: Cancel + Save Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-[38px] px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                إلغاء
              </button>

              <button
                type="button"
                disabled={!isBalanced || loading}
                onClick={handleSaveVoucher}
                className="h-[38px] px-5 rounded-xl font-bold text-xs text-white flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50 bg-[#F45A0A] hover:bg-[#DD4F05]"
              >
                <IconDeviceFloppy size={15} />
                <span>
                  {loading
                    ? 'جارٍ الحفظ...'
                    : isEditing
                    ? 'حفظ التعديلات'
                    : voucherType === 'RECEIPT'
                    ? 'حفظ واعتماد سند القبض'
                    : voucherType === 'PAYMENT'
                    ? 'حفظ واعتماد سند الصرف'
                    : voucherType === 'EXCHANGE'
                    ? 'حفظ واعتماد سند الصرافة'
                    : 'حفظ واعتماد سند القيد'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* ════════════════════════════════════════════════════════════════════
          6. USER DEFAULTS SETTINGS MODAL (تخصيص الإعدادات الافتراضية للموظف)
         ════════════════════════════════════════════════════════════════════ */}
      <Modal
        opened={settingsModalOpened}
        onClose={() => setSettingsModalOpened(false)}
        title={
          <div className="flex items-center gap-2 text-slate-950 font-black text-sm">
            <div className="w-7 h-7 rounded-lg bg-orange-50 text-[#F45A0A] flex items-center justify-center">
              <IconSettings size={16} />
            </div>
            <span>تخصيص الإعدادات الافتراضية للسندات المالية</span>
          </div>
        }
        size="md"
        centered
        radius="16px"
      >
        <div className="space-y-3.5 text-xs select-none" dir="rtl">
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-slate-600 font-medium leading-relaxed">
            حدد خياراتك المفضلة ليتم اعتمادها وتطبيقها تلقائياً عند فتح نافذة السند المالي أو البدء بسند جديد:
          </div>

          <div className="space-y-3">
            {/* 1. Default Currency */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-3 space-y-1.5 shadow-2xs">
              <label className="block font-bold text-slate-800 text-xs">العملة الافتراضية للتعامل:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormDefaultCurrency('IQD')}
                  className={`h-9 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                    formDefaultCurrency === 'IQD'
                      ? 'bg-orange-50 border-[#F45A0A] text-[#F45A0A] ring-1 ring-[#F45A0A] font-black'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {formDefaultCurrency === 'IQD' && <IconCheck size={14} className="text-[#F45A0A]" />}
                  <span>دينار عراقي (IQD)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormDefaultCurrency('USD')}
                  className={`h-9 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                    formDefaultCurrency === 'USD'
                      ? 'bg-orange-50 border-[#F45A0A] text-[#F45A0A] ring-1 ring-[#F45A0A] font-black'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {formDefaultCurrency === 'USD' && <IconCheck size={14} className="text-[#F45A0A]" />}
                  <span>دولار أمريكي (USD)</span>
                </button>
              </div>
            </div>

            {/* 2. Default Voucher Type */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-3 space-y-1.5 shadow-2xs">
              <label className="block font-bold text-slate-800 text-xs">نوع السند الافتراضي:</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFormDefaultVoucherType('RECEIPT')}
                  className={`h-9 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 border ${
                    formDefaultVoucherType === 'RECEIPT'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-1 ring-emerald-500 font-black'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {formDefaultVoucherType === 'RECEIPT' && <IconCheck size={13} className="text-emerald-600" />}
                  <span>سند قبض</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormDefaultVoucherType('PAYMENT')}
                  className={`h-9 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 border ${
                    formDefaultVoucherType === 'PAYMENT'
                      ? 'bg-rose-50 border-rose-500 text-rose-700 ring-1 ring-rose-500 font-black'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {formDefaultVoucherType === 'PAYMENT' && <IconCheck size={13} className="text-rose-600" />}
                  <span>سند دفع</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormDefaultVoucherType('JOURNAL')}
                  className={`h-9 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 border ${
                    formDefaultVoucherType === 'JOURNAL'
                      ? 'bg-orange-50 border-[#F45A0A] text-[#F45A0A] ring-1 ring-[#F45A0A] font-black'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {formDefaultVoucherType === 'JOURNAL' && <IconCheck size={13} className="text-[#F45A0A]" />}
                  <span>سند قيد</span>
                </button>
              </div>
            </div>

            {/* 3. Default Payment Method */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-3 space-y-1.5 shadow-2xs">
              <label className="block font-bold text-slate-800 text-xs">طريقة التسديد الافتراضية:</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {paymentMappings.map((m) => {
                  const isSelected = formDefaultPaymentMethodId === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setFormDefaultPaymentMethodId(m.id)}
                      className={`h-9 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between border ${
                        isSelected
                          ? 'bg-orange-50 border-[#F45A0A] text-[#F45A0A] ring-1 ring-[#F45A0A] font-black'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="truncate">{m.nameAr}</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {m.type === 'CASH' ? 'نقدي' : 'إلكتروني'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="pt-2.5 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setSettingsModalOpened(false)}
              className="h-[36px] px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSaveUserDefaults}
              className="h-[36px] px-5 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <IconCheck size={14} />
              <span>حفظ التفضيلات</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* ════════════════════════════════════════════════════════════════════
          7. AUDIT LOG MODAL (سجل الحركات والتعديلات)
         ════════════════════════════════════════════════════════════════════ */}
      <Modal
        opened={auditModalOpened}
        onClose={() => setAuditModalOpened(false)}
        title={
          <div className="flex items-center gap-2 text-slate-950 font-black text-sm">
            <div className="w-7 h-7 rounded-lg bg-orange-50 text-[#F45A0A] flex items-center justify-center">
              <IconHistory size={16} />
            </div>
            <span>سجل التعديلات وحركات السند المالي</span>
          </div>
        }
        size="md"
        centered
        radius="16px"
      >
        <div className="space-y-3.5 text-xs select-none" dir="rtl">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-bold">رقم السند:</span>
              <span className="font-mono font-black text-slate-950">{voucherNumber}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-bold">تاريخ السند:</span>
              <span className="text-slate-800 font-medium font-mono">{date}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-bold">الموظف المنشئ:</span>
              <span className="font-bold text-slate-900">{loggedInUserName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-bold">الحالة الحالية:</span>
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {currentVoucherIndex === -1 ? 'مسودة قيد الإنشاء' : 'سند مسجل بالنظام'}
              </span>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setAuditModalOpened(false)}
              className="h-[36px] px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      </Modal>

      {/* ════════════════════════════════════════════════════════════════════
          8. QUICK CREATE ACCOUNT MODAL (عميل، مورد، شركة، قاصة)
         ════════════════════════════════════════════════════════════════════ */}
      <SmartAccountWizardModal
        opened={createAccountModalOpened}
        onClose={() => setCreateAccountModalOpened(false)}
        onSuccess={async () => {
          setCreateAccountModalOpened(false);
          try {
            // Same lite shape the form loaded with; the full endpoint would rescan
            // every posted journal line right after the cache was just invalidated.
            const accs = await apiRequest('/api/accounts?lite=1');
            setAccounts(accs || []);
            showSuccessNotification('تم إنشاء الحساب', 'تمت إضافة الحساب المحاسبي بنجاح، ويمكنك اختياره الآن.');
          } catch (e) {
            console.error('Failed to reload accounts:', e);
          }
        }}
        mode="CREATE"
      />
    </>
  );
};
