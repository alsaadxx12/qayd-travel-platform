import React, { useEffect, useState, useMemo, useRef } from 'react';
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
} from '@tabler/icons-react';
import { apiRequest } from '../../api/client';
import { fetchPrintTemplate } from '../../api/printTemplates';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { getNextSequenceNumber } from '../../utils/sequenceUtils';
import { useAdoptedExchangeRate } from '../../hooks/useAdoptedExchangeRate';
import { FormattedNumberInput } from '../common/FormattedNumberInput';
import { AccountingDatePicker } from '../common/date/AccountingDatePicker';
import { SmartAccountWizardModal } from '../accounts/SmartAccountWizardModal';
import { employeesApi } from '../../api/employees';

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
  const generateNewSequenceNumber = (type: 'RECEIPT' | 'PAYMENT' | 'EXCHANGE' | 'JOURNAL') => {
    const key = type === 'RECEIPT' ? 'receiptVouchers' : type === 'PAYMENT' ? 'paymentVouchers' : type === 'EXCHANGE' ? 'exchange' : 'journalEntries';
    return getNextSequenceNumber(key);
  };

  // Load vouchers list & accounts on open + Auto-detect employee's cashbox + Load Payment Methods
  useEffect(() => {
    if (opened) {
      const loadData = async () => {
        try {
          const [accs, receipts, payments, templateRes, emps, journalEntries, customAccountsRes] = await Promise.all([
            apiRequest('/api/accounts').catch(() => []),
            apiRequest('/api/receipt-vouchers').catch(() => []),
            apiRequest('/api/payment-vouchers').catch(() => []),
            apiRequest('/api/print-templates/payment_methods_mapping').catch(() => null),
            employeesApi.getAll().catch(() => []),
            apiRequest('/api/journal-entries').catch(() => []),
            apiRequest('/api/print-templates/custom_voucher_accounts').catch(() => null),
          ]);

          const loadedAccounts: AccountOption[] = accs || [];
          setAccounts(loadedAccounts);

          const all = [
            ...(receipts || []).map((r: any) => ({ ...r, voucherType: 'RECEIPT' })),
            ...(payments || []).map((p: any) => ({ ...p, voucherType: 'PAYMENT' })),
            ...(journalEntries || []).map((j: any) => ({ ...j, voucherType: 'JOURNAL' })),
          ].sort((a: any, b: any) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());

          setVouchersList(all);

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
          const customAccs: any[] = customAccountsRes?.config?.accounts || [];
          setConfiguredCustomAccounts(customAccs);
          if (customAccs.length > 0) {
            setSplitAllocations(
              customAccs.map((ca: any) => ({
                id: ca.id,
                accountId: ca.targetAccountId,
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
            const found = all.find((v: any) => v.id === initialVoucherId);
            const idx = all.findIndex((v: any) => v.id === initialVoucherId);
            if (found) {
              loadVoucherIntoForm(found, idx);
              return;
            } else {
              try {
                let single: any = null;
                if (defaultType === 'RECEIPT') {
                  single = await apiRequest(`/api/receipt-vouchers/${initialVoucherId}`);
                } else if (defaultType === 'PAYMENT') {
                  single = await apiRequest(`/api/payment-vouchers/${initialVoucherId}`);
                } else {
                  single = await apiRequest(`/api/journal-entries/${initialVoucherId}`);
                }
                if (single) {
                  loadVoucherIntoForm(single, 0);
                  return;
                }
              } catch (e) {}
            }
          }

          // Load Custom Voucher Split Accounts configured in System Settings
          try {
            const customAccountsRes = await fetchPrintTemplate('custom_voucher_accounts');
            if (customAccountsRes?.config?.accounts && Array.isArray(customAccountsRes.config.accounts)) {
              const activeCustoms = customAccountsRes.config.accounts.filter((a: any) => a.isActive !== false);
              setConfiguredCustomAccounts(activeCustoms);
              setSplitAllocations(
                activeCustoms.map((ca: any) => ({
                  id: ca.id || `split-${Math.random()}`,
                  accountId: ca.targetAccountId || '',
                  accountName: ca.nameAr,
                  amount: '',
                  note: '',
                }))
              );
            }
          } catch (e) {}

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

  const numAmount = Number(amount) || 0;

  // Split Allocations Helpers (حساب النظام يحتسب الرصيد المتبقي تلقائياً ويقل مع الحسابات المخصصة)
  const totalCustomSplitsAmount = useMemo(() => {
    return splitAllocations.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [splitAllocations]);

  const systemAccountAmount = Math.max(0, numAmount - totalCustomSplitsAmount);
  const isOverAllocated = totalCustomSplitsAmount > numAmount;
  const hasCustomSplits = splitAllocations.some((s) => Number(s.amount) > 0);

  const handleSplitAmountChange = (id: string, newAmt: string) => {
    setSplitAllocations((prev) =>
      prev.map((item) => (item.id === id ? { ...item, amount: newAmt } : item))
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
      .filter((item) => item.id !== id)
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const rem = Math.max(0, numAmount - othersTotal);
    setSplitAllocations((prev) =>
      prev.map((item) => (item.id === id ? { ...item, amount: String(rem) } : item))
    );
  };

  const handleResetCustomSplits = () => {
    setSplitAllocations((prev) => prev.map((item) => ({ ...item, amount: '' })));
  };

  const handleAddCustomSplitRow = (accId: string) => {
    if (!accId) return;
    const acc = accounts.find((a) => a.id === accId);
    if (!acc) return;
    const newEntry = {
      id: `split-${Date.now()}`,
      accountId: acc.id,
      accountName: acc.nameAr,
      amount: '',
      note: '',
    };
    setSplitAllocations((prev) => [...prev, newEntry]);
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
  const loadVoucherIntoForm = (voucher: any, index: number) => {
    setCurrentVoucherIndex(index);
    setEditingVoucherId(voucher.id || null);
    const vType = voucher.voucherType || (voucher.lines ? 'JOURNAL' : voucher.type === 'PAYMENT' || voucher.supplierId ? 'PAYMENT' : 'RECEIPT');
    setVoucherType(vType);
    setDate(voucher.date ? (typeof voucher.date === 'string' ? voucher.date.split('T')[0] : getTodayDate()) : getTodayDate());
    setVoucherNumber(voucher.voucherNumber || voucher.entryNumber || voucher.number || '');
    
    if (vType === 'JOURNAL' && voucher.lines && voucher.lines.length > 0) {
      const loadedLines: JournalLineItem[] = voucher.lines.map((l: any, idx: number) => ({
        id: l.id || `line-${idx}-${Date.now()}`,
        accountId: l.accountId || '',
        debit: Number(l.debit || 0) > 0 ? String(l.debit) : '',
        credit: Number(l.credit || 0) > 0 ? String(l.credit) : '',
        currency: l.currency || voucher.currency || 'IQD',
        exchangeRate: l.exchangeRate ? String(l.exchangeRate) : '1500',
        description: l.description || '',
        costCenter: l.costCenter || '',
      }));
      setJournalLines(loadedLines);
      const firstDebit = voucher.lines.find((l: any) => Number(l.debit) > 0) || voucher.lines[0];
      const amt = Number(firstDebit?.debit || voucher.totalDebit || voucher.amount || 0);
      setAmount(amt > 0 ? String(amt) : '');
    } else if (vType === 'JOURNAL') {
      setJournalLines([
        { id: '1', accountId: '', debit: '', credit: '', currency: 'IQD', exchangeRate: '1500', description: '', costCenter: '' },
        { id: '2', accountId: '', debit: '', credit: '', currency: 'IQD', exchangeRate: '1500', description: '', costCenter: '' },
      ]);
    } else {
      setAmount(String(voucher.amount || ''));
      setCashboxAccountId(voucher.cashboxOrBankAccountId || voucher.accountId || '');
      setOppositeAccountId(voucher.accountId || voucher.oppositeAccountId || '');
    }

    // Restore or initialize split allocations
    if (voucher.splitAccounts && Array.isArray(voucher.splitAccounts) && voucher.splitAccounts.length > 0) {
      setEnableSplitAllocation(true);
      setSplitAllocations(
        voucher.splitAccounts.map((s: any, idx: number) => ({
          id: s.id || `split-${idx}`,
          accountId: s.accountId || '',
          accountName: s.accountName || s.accountCode || `حساب ${idx + 1}`,
          amount: String(s.amount || ''),
          note: s.note || '',
        }))
      );
    } else {
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
    }

    setCurrency((voucher.currency as 'IQD' | 'USD') || 'IQD');
    setDescription(voucher.description || '');
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
    setVoucherNumber(generateNewSequenceNumber(finalType));
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

  // Shortcut hotkeys (Ctrl+S saves without closing)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!opened) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveVoucher();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [opened, amount, cashboxAccountId, oppositeAccountId, description, voucherType, date, currency, selectedPaymentMethodId, journalLines, isJournalBalanced]);

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

      const payload = {
        date,
        entryNumber: voucherNumber,
        reference: voucherNumber,
        description: description || 'سند قيد محاسبي',
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
        onSuccess({
          id: editingVoucherId,
          entryNumber: savedVoucherNumber,
          voucherNumber: savedVoucherNumber,
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

        apiRequest(endpoint, { method, body: JSON.stringify(payload) }).catch((err) => {
          showErrorNotification('خطأ في تعديل القيد', err.message || 'حدث خطأ أثناء حفظ التعديلات.');
        });
        return;
      }

      showSuccessNotification(
        'تم حفظ سند القيد',
        `تم حفظ سند القيد [${savedVoucherNumber || 'الجديد'}] وترحيل الحركة بنجاح.`
      );

      const tempId = `temp-${Date.now()}`;
      setVouchersList((prev) => [{
        id: tempId,
        voucherType: 'JOURNAL',
        entryNumber: savedVoucherNumber,
        voucherNumber: savedVoucherNumber,
        totalDebit: totalJournalDebit,
        totalCredit: totalJournalCredit,
        amount: totalJournalDebit,
        currency,
        date,
        createdAt: new Date().toISOString(),
        description: payload.description,
        lines: payload.lines,
      }, ...prev]);

      onSuccess({
        id: tempId,
        entryNumber: savedVoucherNumber,
        voucherNumber: savedVoucherNumber,
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

      handleNewVoucher('JOURNAL');

      apiRequest(endpoint, { method, body: JSON.stringify(payload) }).then((savedRes) => {
        if (savedRes?.id) {
          setVouchersList((prev) =>
            prev.map((v) => (v.id === tempId ? { ...v, id: savedRes.id, entryNumber: savedRes.entryNumber || v.entryNumber, voucherNumber: savedRes.entryNumber || v.voucherNumber } : v))
          );
          onSuccess({
            _replaceTemp: tempId,
            id: savedRes.id,
            entryNumber: savedRes.entryNumber || savedVoucherNumber,
            voucherNumber: savedRes.entryNumber || savedVoucherNumber,
            voucherType: 'JOURNAL',
            sourceType: 'JOURNAL',
            amount: numAmount,
            currency,
            date,
            description: payload.description,
          });
        }
      }).catch((err) => {
        showErrorNotification('خطأ في حفظ القيد', err.message || 'حدث خطأ أثناء حفظ سند القيد.');
        setVouchersList((prev) => prev.filter((v) => v.id !== tempId));
        onSuccess({ _removeTemp: tempId });
      });
      return;
    }

    let endpoint = isReceipt ? '/api/receipt-vouchers' : '/api/payment-vouchers';
    let method = 'POST';

    if (isEditing) {
      endpoint = `${endpoint}/${editingVoucherId}`;
      method = 'PUT';
    }

    const activeCustomSplits = splitAllocations
      .filter((s) => Number(s.amount) > 0)
      .map((s) => ({
        accountId: s.accountId,
        accountName: s.accountName,
        amount: Number(s.amount),
        currency,
        note: s.note || '',
      }));

    const activeSplits = hasCustomSplits
      ? [
          ...(systemAccountAmount > 0
            ? [
                {
                  accountId: oppositeAccountId || '',
                  accountName: `النظام (${oppositeAcc?.nameAr || 'الرصيد الأساسي'})`,
                  amount: systemAccountAmount,
                  currency,
                  note: 'رصيد حساب النظام الأساسي',
                },
              ]
            : []),
          ...activeCustomSplits,
        ]
      : [];

    const splitDesc = activeSplits.length > 0
      ? activeSplits.map((s) => `${s.accountName}: ${Number(s.amount).toLocaleString('en-US')} ${currency}`).join(' | ')
      : undefined;

    const payload = {
      voucherNumber,
      amount: numAmount,
      currency,
      date,
      accountId: oppositeAccountId,
      cashboxOrBankAccountId: cashboxAccountId,
      description: description || (isReceipt ? 'سند قبض مالي' : 'سند دفع مالي'),
      paymentMethodId: selectedPaymentMethodId,
      slipsCount: slipFiles.length,
      status: 'POSTED',
      splitAccounts: activeSplits.length > 0 ? activeSplits : undefined,
      splitDescription: splitDesc,
    };

    // Capture current values before resetting the form
    const savedVoucherNumber = voucherNumber;
    const savedVoucherType = voucherType;

    // ── Optimistic: Instant UI feedback ──
    if (isEditing) {
      // For edits: notify parent, close modal, fire API in background
      onSuccess({
        id: editingVoucherId,
        voucherType,
        voucherNumber: savedVoucherNumber,
        amount: numAmount,
        currency,
        date,
        accountId: oppositeAccountId,
        cashboxOrBankAccountId: cashboxAccountId,
        description: payload.description,
        splitAccounts: activeSplits.length > 0 ? activeSplits : undefined,
        splitDescription: splitDesc,
      });
      onClose();

      // Fire API in background (don't await)
      apiRequest(endpoint, { method, body: JSON.stringify(payload) }).catch((err) => {
        showErrorNotification('خطأ في تعديل السند', err.message || 'حدث خطأ أثناء حفظ التعديلات.');
      });
      return;
    }

    // For new vouchers: show notification and reset form instantly
    showSuccessNotification(
      'تم حفظ السند',
      `تم حفظ السند [${savedVoucherNumber || 'الجديد'}] بنجاح.`
    );

    // Add optimistic entry to navigation list
    const tempId = `temp-${Date.now()}`;
    setVouchersList((prev) => [{
      id: tempId,
      voucherType: savedVoucherType,
      voucherNumber: savedVoucherNumber,
      amount: numAmount,
      currency,
      date,
      createdAt: new Date().toISOString(),
      accountId: oppositeAccountId,
      cashboxOrBankAccountId: cashboxAccountId,
      description: payload.description,
      splitAccounts: activeSplits.length > 0 ? activeSplits : undefined,
      splitDescription: splitDesc,
    }, ...prev]);

    // Notify parent with optimistic data
    onSuccess({
      id: tempId,
      voucherType: savedVoucherType,
      voucherNumber: savedVoucherNumber,
      amount: numAmount,
      currency,
      date,
      accountId: oppositeAccountId,
      cashboxOrBankAccountId: cashboxAccountId,
      description: payload.description,
      splitAccounts: activeSplits.length > 0 ? activeSplits : undefined,
      splitDescription: splitDesc,
    });

    // Reset form instantly (user can start next voucher immediately)
    handleNewVoucher(savedVoucherType);

    // Fire API in background (don't block the UI)
    apiRequest(endpoint, { method, body: JSON.stringify(payload) }).then((savedRes) => {
      // Replace temp ID with real server ID in navigation list
      if (savedRes?.id) {
        setVouchersList((prev) =>
          prev.map((v) => (v.id === tempId ? { ...v, id: savedRes.id, voucherNumber: savedRes.voucherNumber || v.voucherNumber } : v))
        );
        // Also update the parent page's list with the real ID
        onSuccess({
          _replaceTemp: tempId,
          id: savedRes.id,
          voucherType: savedVoucherType,
          voucherNumber: savedRes.voucherNumber || savedVoucherNumber,
          amount: numAmount,
          currency,
          date,
          accountId: oppositeAccountId,
          cashboxOrBankAccountId: cashboxAccountId,
          description: payload.description,
          paymentMethodId: selectedPaymentMethodId,
        });
      }
    }).catch((err) => {
      showErrorNotification('خطأ في الحفظ', err.message || 'حدث خطأ أثناء حفظ السند.');
      // Remove the optimistic entry on failure
      setVouchersList((prev) => prev.filter((v) => v.id !== tempId));
      // Also remove from parent page
      onSuccess({ _removeTemp: tempId });
    });
  };

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
        size="1100px"
        padding="md"
        radius="16px"
        centered
        styles={{
          content: {
            maxWidth: '1120px',
            width: '1120px',
            maxHeight: '94vh',
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
                      if (currentVoucherIndex === -1) setVoucherNumber(generateNewSequenceNumber('RECEIPT'));
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
                      if (currentVoucherIndex === -1) setVoucherNumber(generateNewSequenceNumber('PAYMENT'));
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
                      if (currentVoucherIndex === -1) setVoucherNumber(generateNewSequenceNumber('EXCHANGE'));
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
                      if (currentVoucherIndex === -1) setVoucherNumber(generateNewSequenceNumber('JOURNAL'));
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

              {/* Dynamic Context: Employee Cashbox OR Journal Voucher Info */}
              <div className="md:col-span-3">
                {voucherType === 'JOURNAL' ? (
                  <div>
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
                ) : (
                  <div>
                    <label className="block font-bold text-slate-700 text-xs mb-1 flex items-center gap-1">
                      <IconBuildingBank size={14} className="text-amber-600" />
                      <span>الصندوق المرتبط بالموظف</span>
                    </label>
                    <div className="h-8.5 bg-white border border-slate-200 rounded-xl px-3 flex items-center justify-between text-xs font-bold text-slate-800 shadow-2xs">
                      <div className="flex items-center gap-2 truncate">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                        <span className="truncate">{cashboxDisplayName}</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">
                        نشط
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Advanced Accounting Date Picker */}
              <div className="md:col-span-2">
                <label className="block font-bold text-slate-700 text-xs mb-1">تاريخ السند *</label>
                <AccountingDatePicker
                  value={date}
                  onChange={(d) => setDate(d ? d.replace(/\//g, '-') : getTodayDate())}
                  placeholder="سنة/شهر/يوم"
                />
              </div>

              {/* User Creator & Settings + Audit Icons */}
              <div className="md:col-span-2 flex items-end justify-between gap-1.5">
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
              2. PAYMENT METHODS & MULTI-SLIPS (Only for Receipt and Payment Vouchers)
             ════════════════════════════════════════════════════════════════════ */}
          {voucherType !== 'JOURNAL' && (
            <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-2.5 shadow-2xs space-y-2 shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Payment Methods Buttons Bar */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-slate-700 text-xs">طريقة التسديد:</span>

                  <div className="flex flex-wrap items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                    {paymentMappings.map((method) => {
                      const isSelected = selectedPaymentMethodId === method.id;
                      return (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => handleSelectPaymentMethod(method)}
                          className={`h-7 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-[#F45A0A] text-white shadow-2xs font-black'
                              : 'text-slate-700 hover:bg-slate-100 bg-transparent'
                          }`}
                        >
                          {method.type === 'CASH' ? <IconCash size={14} /> : <IconCreditCard size={14} />}
                          <span>{method.nameAr}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Multi-Slip Attachment Trigger */}
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    accept="image/*,.pdf"
                    onChange={handleMultipleFilesChange}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`h-[32px] px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
                      slipFiles.length > 0
                        ? 'bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <IconPaperclip size={14} className="text-teal-600" />
                    <span>{slipFiles.length > 0 ? `+ إضافة وصل آخر (${slipFiles.length})` : 'إرفاق وصل التسديد 📎'}</span>
                  </button>
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
                                  data={postingAccounts.map((acc) => ({
                                    value: acc.id,
                                    label: acc.nameAr,
                                  }))}
                                  renderOption={({ option }: any) => (
                                    <div className="py-1 px-1 text-xs font-bold text-slate-900">
                                      {option.label}
                                    </div>
                                  )}
                                  filter={({ options, search }) => {
                                    const s = search.toLowerCase().trim();
                                    if (!s) return options;
                                    return options.filter((opt: any) => {
                                      const acc = accounts.find((a) => a.id === opt.value);
                                      if (!acc) return (opt.label || '').toLowerCase().includes(s);
                                      return acc.nameAr.toLowerCase().includes(s) || (acc.code && acc.code.toLowerCase().includes(s));
                                    });
                                  }}
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
                                <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-50 border border-slate-200 px-1.5 py-0.2 rounded shadow-2xs">
                                  {exchangeRate || '1,547.5'}
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
                              {isJournalBalanced
                                ? '✓ طرفا القيد متوازنان ومكتملان 100%'
                                : `الفارق: ${journalDifference.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${currency} (غير متوازن)`}
                            </span>
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
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  {/* Amount Field (Centered & Bold) */}
                  <div className="md:col-span-3">
                    <label className="block font-bold text-slate-800 text-xs mb-1">
                      المبلغ المطلوب *
                    </label>
                    <FormattedNumberInput
                      placeholder="0.00"
                      value={amount}
                      onChange={setAmount}
                      styles={{
                        input: {
                          height: '44px',
                          fontSize: '20px',
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

                  {/* Currency Toggle Directly Next to Amount Field */}
                  <div className={currency === 'USD' ? 'md:col-span-2' : 'md:col-span-3'}>
                    <label className="block font-bold text-slate-800 text-xs mb-1">
                      <span>عملة السند</span>
                    </label>
                    <div className="h-11 flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setCurrency('IQD');
                          setJournalLines((prev) => prev.map((l) => ({ ...l, currency: 'IQD' })));
                        }}
                        className={`flex-1 h-full rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
                          currency === 'IQD'
                            ? 'bg-[#F45A0A] text-white shadow-xs'
                            : 'text-slate-700 hover:bg-slate-200 bg-transparent'
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
                        className={`flex-1 h-full rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
                          currency === 'USD'
                            ? 'bg-[#F45A0A] text-white shadow-xs'
                            : 'text-slate-700 hover:bg-slate-200 bg-transparent'
                        }`}
                      >
                        USD ($)
                      </button>
                    </div>
                  </div>

                  {/* Clean Numeric Exchange Rate Input when USD */}
                  {currency === 'USD' && (
                    <div className="md:col-span-2">
                      <label className="block font-bold text-slate-800 text-xs mb-1">
                        سعر الصرف
                      </label>
                      <input
                        type="text"
                        value={exchangeRate}
                        onChange={(e) => setExchangeRate(e.target.value)}
                        placeholder="1550"
                        className="w-full h-11 px-2.5 rounded-xl border border-slate-300 bg-white font-mono font-black text-sm text-center text-slate-900 focus:outline-none focus:border-[#F45A0A] shadow-2xs"
                      />
                    </div>
                  )}

                  {/* Searchable Opposing Account */}
                  <div className={currency === 'USD' ? 'md:col-span-5' : 'md:col-span-6'}>
                    <label className="block font-bold text-slate-800 text-xs mb-1">
                      {isReceipt ? 'الحساب المقابل (الطرف الدائن ⬅️) *' : 'الحساب المقابل (الطرف المدين ➡️) *'}
                    </label>
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1">
                        <Select
                          searchable
                          clearable
                          placeholder="ابحث بالاسم (عميل، مورد، مكتب بورصة، شركة)..."
                          value={oppositeAccountId}
                          onChange={(val) => setOppositeAccountId(val || '')}
                          data={postingAccounts.map((acc) => ({
                            value: acc.id,
                            label: acc.nameAr,
                          }))}
                          renderOption={({ option }: any) => (
                            <div className="py-1 px-1 text-xs font-bold text-slate-900">
                              {option.label}
                            </div>
                          )}
                          filter={({ options, search }) => {
                            const s = search.toLowerCase().trim();
                            if (!s) return options;
                            return options.filter((opt: any) => {
                              const acc = accounts.find((a) => a.id === opt.value);
                              if (!acc) return (opt.label || '').toLowerCase().includes(s);
                              return acc.nameAr.toLowerCase().includes(s) || (acc.code && acc.code.toLowerCase().includes(s));
                            });
                          }}
                          nothingFoundMessage="لا توجد نتائج مطابقة"
                          maxDropdownHeight={280}
                          styles={{
                            input: {
                              height: '44px',
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
                          className="h-11 w-11 min-w-[44px] rounded-xl border border-slate-200 bg-white hover:bg-orange-50 hover:border-orange-300 text-slate-700 hover:text-[#F45A0A] flex items-center justify-center cursor-pointer transition-colors shadow-2xs"
                        >
                          <IconUserPlus size={18} />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                </div>

                {/* ── Custom Allocation & Split Section (Side-by-Side Unified Container) ── */}
                <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-200/70 pb-2">
                    <div>
                      <span className="font-extrabold text-xs text-slate-900 block leading-tight">
                        تقسيم وتوزيع السند المالي على الحسابات (Split Allocation)
                      </span>
                      <span className="text-[10.5px] text-slate-500 font-medium">
                        حساب النظام يحتسب الرصيد تلقائياً ويقل بمجرد كتابة المبلغ في الحساب المخصص بجانبه
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isOverAllocated ? (
                        <Badge size="xs" color="red" variant="filled" className="font-bold">
                          تجاوز الإجمالي ({totalCustomSplitsAmount.toLocaleString('en-US')} {currency})
                        </Badge>
                      ) : (
                        <Badge size="xs" color="emerald" variant="light" className="font-bold">
                          متطابق 100% مع إجمالي السند ({numAmount.toLocaleString('en-US')} {currency})
                        </Badge>
                      )}
                    </div>
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
                          محسوب آلياً
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
                          <span className="text-[10px] text-slate-400 font-medium block">
                            حساب مخصص
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

                          <button
                            type="button"
                            onClick={() => handleRemoveSplitRow(item.id)}
                            className="h-[38px] w-[34px] rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center cursor-pointer transition-colors shrink-0"
                          >
                            <IconTrash size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Bottom Line: Add Account & Reset */}
                  <div className="pt-1 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70">
                    <div className="flex-1 min-w-[240px]">
                      <Select
                        size="xs"
                        searchable
                        clearable
                        placeholder="+ إضافة حساب مخصص آخر للتقسيم من شجرة الحسابات..."
                        data={postingAccounts.map((a) => ({ value: a.id, label: `${a.code} - ${a.nameAr}` }))}
                        onChange={(val) => {
                          if (val) {
                            handleAddCustomSplitRow(val);
                          }
                        }}
                        value={null}
                        styles={{
                          input: { height: '32px', fontSize: '11px', borderRadius: '8px', backgroundColor: '#ffffff', borderColor: '#cbd5e1' },
                        }}
                      />
                    </div>

                    {hasCustomSplits && (
                      <button
                        type="button"
                        onClick={handleResetCustomSplits}
                        className="px-2.5 py-1 rounded-lg text-[10.5px] font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 cursor-pointer transition-colors"
                      >
                        تصفير المبالغ المخصصة ↺
                      </button>
                    )}
                  </div>
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
            const accs = await apiRequest('/api/accounts');
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
