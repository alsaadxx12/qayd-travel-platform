import { AccountReconciliationModal, type UnmatchedPartyData } from '../common/AccountReconciliationModal';
import { findSimilarAccounts } from '../../utils/accountSimilarity';
import { ManageAirlinesModal } from './ManageAirlinesModal';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Button,
  Select,
  Autocomplete,
  Tooltip,
  ActionIcon,
  Menu,
  Modal,
  Textarea,
  Switch,
} from '@mantine/core';
import {
  Plane,
  Check,
  Printer,
  Save,
  ArrowRight,
  ArrowLeft,
  History,
  MoreVertical,
  Settings,
  AlertCircle,
  Sparkles,
  User,
  Building2,
  Search,
  Plus,
  Trash2,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FlightRouteSelector } from './FlightRouteSelector';
import { TicketPassengersTable, PassengerLine } from './TicketPassengersTable';
import { TicketFinancialSummary } from './TicketFinancialSummary';
import { TicketAttachmentsSection, paymentNeedsAttachment, AttachmentItem } from './TicketAttachmentsSection';
import { InvoiceAuditLogModal } from './InvoiceAuditLogModal';
import { CurrencySwitchModal } from './CurrencySwitchModal';
import { UnsavedChangesModal } from './UnsavedChangesModal';
import { ParsedTicketData } from './SmartTicketImportModal';
import { SearchableCombobox } from '../ui/SearchableCombobox';
import { AccountFinderModal, type AccountFinderResult } from '../common/AccountFinderModal';
import { CurrencySegmentedControl } from '../ui/CurrencySegmentedControl';
import { DateTimeField } from '../ui/DateTimeField';
import { DeleteInvoiceModal } from '../ui/DeleteInvoiceModal';
import { partnersApi, Customer, Supplier } from '../../api/partners';
import { accountsApi } from '../../api/accounts';
import { airlinesApi, AirlineItem } from '../../api/airlines';
import { employeesApi } from '../../api/employees';
import { ticketsApi } from '../../api/tickets';
import { fetchPrintTemplate } from '../../api/printTemplates';
import { showSuccessNotification, showErrorNotification, showInfoNotification } from '../../utils/notifications';
import { getNextSequenceNumber } from '../../utils/sequenceUtils';
import { formatCurrency, getCurrencySymbol, getCurrencyLabel } from '../../utils/currencyUtils';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguageStore } from '../../store/useLanguageStore';
import { useAdoptedExchangeRate } from '../../hooks/useAdoptedExchangeRate';
import {
  TicketPageSettings,
  DEFAULT_TICKET_PAGE_SETTINGS,
  loadTicketPageSettings,
  saveTicketPageSettings,
  findDefaultCashCustomer,
  customerDisplayName,
} from '../../utils/ticketPageSettings';

interface TicketInvoiceEditorWorkspaceProps {
  opened: boolean;
  onClose: () => void;
  initialData?: any;
  onSuccess?: (savedTicket: any) => void;
}

export const TicketInvoiceEditorWorkspace: React.FC<TicketInvoiceEditorWorkspaceProps> = ({
  opened,
  onClose,
  initialData,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const adoptedEx = useAdoptedExchangeRate();
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  // Invoice State
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [issueDate, setIssueDate] = useState<Date>(new Date());
  const [travelDate, setTravelDate] = useState<Date | null>(new Date());
  const [customerName, setCustomerName] = useState<string>('');
  const [supplierAccount, setSupplierAccount] = useState<string>('');
  const [supplierAccountName, setSupplierAccountName] = useState<string>('');
  const [manageAirlinesModalOpened, setManageAirlinesModalOpened] = useState(false);
  /*
   * البحث المتقدّم: القائمة المنسدلة تعرض ما يخصّ الحقل، وهذه تفتح على الشجرة كلها.
   * تُفتح على ما كتبه المستخدم في الحقل، فلا يعيد كتابته مرة أخرى.
   */
  const [accountFinder, setAccountFinder] = useState<{
    open: boolean;
    scope: 'SUPPLIER' | 'CUSTOMER';
    query: string;
  }>({ open: false, scope: 'SUPPLIER', query: '' });
  const [reconciliationModalOpen, setReconciliationModalOpen] = useState(false);
  const [unmatchedCustomerData, setUnmatchedCustomerData] = useState<UnmatchedPartyData | null>(null);
  const [unmatchedSupplierData, setUnmatchedSupplierData] = useState<UnmatchedPartyData | null>(null);
  const [pendingImportData, setPendingImportData] = useState<any>(null);
  const [airline, setAirline] = useState<string>('');
  const [pnr, setPnr] = useState<string>('');
  const [employeeName, setEmployeeName] = useState<string>(''); // موظف الإصدار
  const [entryEmployee, setEntryEmployee] = useState<string>(''); // موظف الإدخال
  const [currency, setCurrency] = useState<string>('IQD');
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [paymentType, setPaymentType] = useState<string>('نقدي');
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH_HAND');
  const [receivingCashbox, setReceivingCashbox] = useState<string>('');
  const [payingCashbox, setPayingCashbox] = useState<string>('');
  const [fromAirport, setFromAirport] = useState<string>('MHD');
  const [toAirport, setToAirport] = useState<string>('BGW');
  const [stopovers, setStopovers] = useState<string[]>([]);
  const [fullRouteText, setFullRouteText] = useState<string>('MHD - BGW');
  const [entryDate, setEntryDate] = useState<Date>(new Date());
  const [reference, setReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [status, setStatus] = useState<string>('DRAFT');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [autoMatchedCashboxName, setAutoMatchedCashboxName] = useState<string | null>(null);
  const hydratedInvoiceKeyRef = useRef<string | null>(null);
  const defaultCustomerAppliedRef = useRef(false);
  const [pageSettings, setPageSettings] = useState<TicketPageSettings>(() => loadTicketPageSettings());
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false);
  const [draftPageSettings, setDraftPageSettings] = useState<TicketPageSettings>(DEFAULT_TICKET_PAGE_SETTINGS);

  // Passengers State
  const [passengers, setPassengers] = useState<PassengerLine[]>([
    {
      id: `p-${Date.now()}`,
      name: '',
      ticketType: 'ADULT',
      ticketNumber: '',
      documentNumber: '',
      pnr: '',
      fareBuy: 0,
      fareSell: 0,
      tax1: 0,
      tax2: 0,
      charge: 0,
      percentage: 0,
      status: 'باقي',
    },
  ]);

  // Attachments State
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);

  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Modals State
  const [currencySwitchModalOpen, setCurrencySwitchModalOpen] = useState<boolean>(false);
  const [pendingCurrency, setPendingCurrency] = useState<string>('');
  const [auditLogOpen, setAuditLogOpen] = useState<boolean>(false);
  const [cancelModalOpen, setCancelModalOpen] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [confirmExitOpen, setConfirmExitOpen] = useState<boolean>(false);

  // Mark form as dirty when user edits
  const markDirty = useCallback(() => {
    if (!isDirty) setIsDirty(true);
  }, [isDirty]);

  // Handle Close with Unsaved Changes Protection
  const handleRequestClose = useCallback(() => {
    if (isDirty) {
      setConfirmExitOpen(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  // Keyboard shortcut: ESC to safely request exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && opened && !currencySwitchModalOpen && !auditLogOpen && !cancelModalOpen && !confirmExitOpen && !pageSettingsOpen) {
        e.preventDefault();
        handleRequestClose();
      }
      // Ctrl+S: Save Draft
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveMutation.mutate('DRAFT');
      }
      // Ctrl+Enter: Post & Finalize
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        saveMutation.mutate('POSTED');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [opened, currencySwitchModalOpen, auditLogOpen, cancelModalOpen, confirmExitOpen, pageSettingsOpen, handleRequestClose]);

  // ── Fetch Real Business Data from APIs ──
  const { data: customersData } = useQuery({
    queryKey: ['customers-list'],
    queryFn: () => partnersApi.getCustomers(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: () => partnersApi.getSuppliers(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: accountsData } = useQuery({
    queryKey: ['cashbox-accounts-list'],
    queryFn: () => accountsApi.getFlat(undefined, undefined, true),
    staleTime: 5 * 60 * 1000,
  });

  const { data: airlinesData } = useQuery({
    queryKey: ['airlines-list'],
    queryFn: () => airlinesApi.getAll(),
    staleTime: 10 * 60 * 1000,
  });

  const { data: employeesData } = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => employeesApi.getAll(),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch payment methods configuration from System Settings (طرق الدفع في إعدادات النظام)
  const { data: paymentMethodsConfig } = useQuery({
    queryKey: ['system-settings-payment-methods'],
    queryFn: async () => {
      try {
        const res = await fetchPrintTemplate('payment_methods_mapping');
        if (res && res.config && Array.isArray(res.config.mappings) && res.config.mappings.length > 0) {
          return res.config.mappings.filter((m: any) => m.isActive !== false);
        }
      } catch (e) {
        console.warn('Failed to fetch payment_methods_mapping from settings:', e);
      }
      return null;
    },
    staleTime: 2 * 60 * 1000,
  });

  const customersList: Customer[] = useMemo(() => {
    return (customersData as any)?.data || (customersData as any) || [];
  }, [customersData]);

  const suppliersList: Supplier[] = useMemo(() => {
    return (suppliersData as any)?.data || (suppliersData as any) || [];
  }, [suppliersData]);

  const accountsList: any[] = useMemo(() => {
    return (accountsData as any)?.data || (accountsData as any) || [];
  }, [accountsData]);

  // Candidate Pools for Similarity Matching (matching Visas logic)
  const allCustomerCandidates = useMemo(() => {
    const list: any[] = [...customersList.filter((c: any) => c.isActive !== false && !c.isBlocked && c.overduePolicy !== 'BLOCK')];
    const seen = new Set(list.map((c) => c.id || c.nameAr || c.code || c.accountId));

    if (Array.isArray(accountsList)) {
      accountsList.forEach((acc: any) => {
        if (acc.isGroup || acc.isParent) return;
        if (acc.isBlocked || acc.isActive === false || acc.overduePolicy === 'BLOCK') return;

        const isCustomer =
          acc.category === 'CUSTOMER' ||
          acc.accountRole === 'CUSTOMER' ||
          acc.accountRole === 'BOTH' ||
          String(acc.code || '').startsWith('1614') ||
          String(acc.code || '').startsWith('141') ||
          String(acc.code || '').startsWith('142') ||
          String(acc.code || '').startsWith('143');

        const id = acc.id || acc.code;
        if (isCustomer && !seen.has(id) && !seen.has(acc.id) && !seen.has(acc.code)) {
          seen.add(id);
          list.push({
            id: acc.id,
            accountId: acc.id,
            source: 'account',
            code: acc.code,
            nameAr: acc.nameAr || acc.name || '',
            nameEn: acc.nameEn || '',
            name: acc.nameAr || acc.name || '',
            phone: acc.phone,
            type: acc.type,
            category: acc.category,
          });
        }
      });
    }
    return list;
  }, [customersList, accountsList]);

  useEffect(() => {
    setPageSettings(loadTicketPageSettings(user?.companyId, 'tickets'));
  }, [user?.companyId]);

  const applyDefaultCustomer = useCallback(() => {
    const found = findDefaultCashCustomer(allCustomerCandidates, pageSettings);
    if (!found) {
      if (pageSettings.defaultCustomerName) setCustomerName(pageSettings.defaultCustomerName);
      return Boolean(pageSettings.defaultCustomerName);
    }
    setCustomerName(customerDisplayName(found, isAr));
    return true;
  }, [allCustomerCandidates, pageSettings, isAr]);

  const allSupplierCandidates = useMemo(() => {
    const list: any[] = [...suppliersList.filter((s: any) => s.isActive !== false && !s.isBlocked && s.overduePolicy !== 'BLOCK')];
    const seen = new Set(list.map((s) => s.id || s.nameAr || s.code || s.accountId));

    if (Array.isArray(accountsList)) {
      accountsList.forEach((acc: any) => {
        if (acc.isGroup || acc.isParent) return;
        if (acc.isBlocked || acc.isActive === false || acc.overduePolicy === 'BLOCK') return;

        const isSupplier =
          acc.category === 'SUPPLIER' ||
          acc.accountRole === 'SUPPLIER' ||
          acc.accountRole === 'BOTH' ||
          String(acc.code || '').startsWith('2614') ||
          String(acc.code || '').startsWith('261') ||
          String(acc.code || '').startsWith('211') ||
          String(acc.code || '').startsWith('212');

        const id = acc.id || acc.code;
        if (isSupplier && !seen.has(id) && !seen.has(acc.id) && !seen.has(acc.code)) {
          seen.add(id);
          list.push({
            id: acc.id,
            accountId: acc.id,
            source: 'account',
            code: acc.code,
            nameAr: acc.nameAr || acc.name || '',
            nameEn: acc.nameEn || '',
            name: acc.nameAr || acc.name || '',
            phone: acc.phone,
            type: acc.type,
            category: acc.category,
          });
        }
      });
    }
    return list;
  }, [suppliersList, accountsList]);

  const airlinesList: AirlineItem[] = useMemo(() => {
    return (airlinesData as any)?.data || (airlinesData as any) || [];
  }, [airlinesData]);

  const resolveAirline = useCallback((hint?: string | null): AirlineItem | null => {
    const normalize = (value?: string | null) => String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[إأآ]/g, 'ا')
      .replace(/[ىي]/g, 'ي')
      .replace(/ک/g, 'ك')
      .replace(/ة/g, 'ه')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ');
    const target = normalize(hint);
    if (!target) return null;

    const exactMatch = airlinesList.find((item) => {
      const candidates = [item.id, item.code, item.nameAr, item.nameEn];
      return candidates.some((candidate) => normalize(candidate) === target);
    });
    if (exactMatch) return exactMatch;

    // Legacy tickets may contain a shortened name while the registered airline
    // includes an English name in parentheses. Accept only one unambiguous match.
    const partialMatches = airlinesList.filter((item) => {
      const names = [item.nameAr, item.nameEn]
        .map((candidate) => normalize(candidate))
        .filter(Boolean);
      return target.length >= 4 && names.some((candidate) =>
        candidate.includes(target) || target.includes(candidate),
      );
    });

    return partialMatches.length === 1 ? partialMatches[0] : null;
  }, [airlinesList]);

  const employeesList: any[] = useMemo(() => {
    return (employeesData as any)?.data || (employeesData as any) || [];
  }, [employeesData]);

  const resolveAccount = useCallback((hint?: string | null) => {
    const normalizedHint = String(hint || '').trim().toLowerCase();
    if (!normalizedHint) return null;

    return accountsList.find((account: any) => {
      const candidates = [account.id, account.code, account.nameAr, account.nameEn, account.name];
      return candidates.some((candidate) => String(candidate || '').trim().toLowerCase() === normalizedHint);
    }) || null;
  }, [accountsList]);

  // Filter accounts for cashboxes & bank accounts
  const availableCashboxes = useMemo(() => {
    return accountsList.filter((acc: any) => {
      if (acc.isGroup || acc.isParent) return false;
      const cat = (acc.category || '').toUpperCase();
      if (cat === 'CUSTOMER' || cat === 'SUPPLIER') return false;
      const type = (acc.type || acc.accountType || '').toUpperCase();
      const code = String(acc.code || '');
      const name = `${acc.nameAr || ''} ${acc.nameEn || ''} ${acc.name || ''}`.toLowerCase();
      return (
        cat === 'CASH' ||
        cat === 'BANK' ||
        type === 'CASH' ||
        type === 'BANK' ||
        type === 'TREASURY' ||
        code.startsWith('181') ||
        code.startsWith('101') ||
        code.startsWith('102') ||
        code.startsWith('110') ||
        code.startsWith('111') ||
        code.startsWith('112') ||
        code.startsWith('120') ||
        name.includes('صندوق') ||
        name.includes('كاش') ||
        name.includes('خزينة') ||
        name.includes('بورصة') ||
        name.includes('قاصة') ||
        name.includes('مصرف') ||
        name.includes('بنك') ||
        acc.isCashbox === true
      );
    });
  }, [accountsList]);

  // Formatted select options for Cashboxes & Bank accounts (Strictly without account codes)
  const formattedCashboxesData = useMemo(() => {
    const map = new Map<string, any>();

    availableCashboxes.forEach((c: any) => {
      const name = isAr ? (c.nameAr || c.name) : (c.nameEn || c.nameAr || c.name);
      const label = name || c.id;
      map.set(c.id, {
        value: c.id,
        label,
        code: c.code,
      });
    });

    // Fallback: If an account ID is assigned (e.g. from employee or draft) but was excluded by filter, resolve its real name from accountsList
    [receivingCashbox, payingCashbox].filter(Boolean).forEach((id) => {
      if (!map.has(id)) {
        const found = accountsList.find((a: any) => a.id === id || a.code === id);
        if (found) {
          const name = isAr ? (found.nameAr || found.name) : (found.nameEn || found.nameAr || found.name);
          const label = name || found.id;
          map.set(found.id, {
            value: found.id,
            label,
            code: found.code,
          });
        }
      }
    });

    return Array.from(map.values());
  }, [availableCashboxes, accountsList, receivingCashbox, payingCashbox, isAr]);

  // Formatted select options for Comboboxes
  const formattedCustomersData = useMemo(() => {
    return allCustomerCandidates.map((c) => ({
      value: c.id || c.nameAr,
      label: (isAr ? (c.nameAr || c.name) : (c.nameEn || c.nameAr || c.name)) || c.code || '',
      code: c.code,
      phone: c.phone || undefined,
    }));
  }, [allCustomerCandidates, isAr]);

  const formattedSuppliersData = useMemo(() => {
    const list = allSupplierCandidates.map((s) => ({
      value: s.id || s.nameAr,
      label: (isAr ? (s.nameAr || s.name) : (s.nameEn || s.nameAr || s.name)) || s.code || '',
      code: s.code,
      phone: s.phone || undefined,
    }));
    // ما اختير من البحث المتقدّم يُضاف خياراً، فيظهر محدَّداً حين تُفتح القائمة ثانيةً.
    if (supplierAccount && supplierAccountName && !list.some((o) => o.value === supplierAccount)) {
      list.unshift({ value: supplierAccount, label: supplierAccountName, code: undefined, phone: undefined });
    }
    return list;
  }, [allSupplierCandidates, isAr, supplierAccount, supplierAccountName]);

  // Format airline dropdown data cleanly
  const formattedAirlinesData = useMemo(() => {
    return airlinesList.map((a) => {
      const arabicName = (a.nameAr || '').trim();
      const englishName = (a.nameEn || '').trim();
      const code = (a.code || '').trim();

      let primaryName = isAr ? (arabicName || englishName || code) : (englishName || arabicName || code);
      if (!primaryName) primaryName = isAr ? 'شركة طيران' : 'Airline';
      let label = code ? `${primaryName} (${code})` : primaryName;

      return {
        value: a.id,
        label,
        code,
        nameAr: arabicName,
        nameEn: englishName,
        logo: a.logo,
      };
    });
  }, [airlinesList, isAr]);

  // Payment methods list fetched dynamically from System Settings (طرق الدفع في إعدادات النظام)
  const paymentMethodsList = useMemo(() => {
    if (Array.isArray(paymentMethodsConfig) && paymentMethodsConfig.length > 0) {
      return paymentMethodsConfig.map((pm: any) => {
        const displayLabel = isAr ? (pm.nameAr || pm.key) : (pm.nameEn || pm.nameAr || pm.key);
        return {
          value: pm.key || pm.id || pm.nameAr,
          label: displayLabel,
          targetAccountId: pm.targetAccountId,
          targetAccountName: pm.targetAccountName,
          type: pm.type,
          description: pm.description,
        };
      });
    }

    return [
      { value: 'CASH_HAND', label: isAr ? 'كاش باليد (نقدي)' : 'Cash in Hand (Immediate)', targetAccountId: 'EMPLOYEE_ASSIGNED' },
      { value: 'ZAIN_CASH', label: isAr ? 'زين كاش (Zain Cash)' : 'Zain Cash', targetAccountId: 'ZAIN_CASH' },
      { value: 'FIB', label: isAr ? 'مصرف العراق الأول (FIB)' : 'First Iraqi Bank (FIB)', targetAccountId: 'FIB' },
      { value: 'QI_CARD', label: isAr ? 'كي كارد (Qi Card)' : 'Qi Card', targetAccountId: 'QI_CARD' },
      { value: 'BANK_TRANSFER', label: isAr ? 'تحويل بنكي' : 'Bank Transfer', targetAccountId: 'BANK' },
      { value: 'CREDIT', label: isAr ? 'آجل (على الحساب)' : 'Credit (On Account)', targetAccountId: 'RECEIVABLE' },
    ];
  }, [paymentMethodsConfig, isAr]);

  /**
   * Cash across the counter leaves no document, so the attachments box only appears
   * for the methods that produce one: transfers, wallets, cards, credit.
   *
   * The `attachments.length` clause matters as much as the rule itself — if the user
   * attaches a transfer screenshot and then switches to cash, hiding the box would
   * leave those files still attached to the record with no way to see or remove
   * them. Nothing that is still saved is ever hidden.
   */
  const showAttachments = useMemo(() => {
    const selected = paymentMethodsList.find((pm: any) => pm.value === paymentMethod);
    return paymentNeedsAttachment(paymentMethod, selected) || attachments.length > 0;
  }, [paymentMethod, paymentMethodsList, attachments.length]);

  const applyEmployeeCashbox = useCallback((selectedEmpName: string, availableBoxes: any[]) => {
    if (!selectedEmpName || availableBoxes.length === 0) return false;

    const emp = employeesList.find((e: any) => {
      const names = [e.fullName, e.name, e.username, e.email, e.user?.name];
      return names.some((n) => String(n || '').trim() === String(selectedEmpName).trim());
    });

    const assigned = String(
      emp?.assignedCashbox || emp?.assignedCashboxId || emp?.cashboxId || emp?.cashboxAccountId || '',
    ).trim();

    const matchBox = (boxes: any[], hint: string) => {
      if (!hint) return null;
      const h = hint.toLowerCase();
      return (
        boxes.find((c: any) => c.id === hint || c.code === hint) ||
        boxes.find(
          (c: any) =>
            String(c.nameAr || '').trim() === hint ||
            String(c.nameEn || '').trim() === hint ||
            String(c.name || '').trim() === hint,
        ) ||
        boxes.find((c: any) => {
          const label = `${c.nameAr || ''} ${c.nameEn || ''} ${c.name || ''} ${c.code || ''}`.toLowerCase();
          return label.includes(h);
        }) ||
        null
      );
    };

    let targetCashbox = assigned ? matchBox(availableBoxes, assigned) : null;

    if (!targetCashbox) {
      const firstName = selectedEmpName.split(' ')[0];
      targetCashbox = availableBoxes.find((c: any) => {
        const cName = `${c.nameAr || ''} ${c.nameEn || ''} ${c.name || ''}`.toLowerCase();
        return (
          cName.includes(selectedEmpName.toLowerCase()) ||
          (firstName.length >= 3 && cName.includes(firstName.toLowerCase()))
        );
      }) || null;
    }

    if (targetCashbox) {
      setReceivingCashbox(targetCashbox.id);
      setPayingCashbox(targetCashbox.id);
      setAutoMatchedCashboxName(targetCashbox.nameAr || targetCashbox.nameEn || targetCashbox.name);
      return true;
    }

    setAutoMatchedCashboxName(null);
    return false;
  }, [employeesList]);

  const applyPageSettingsToForm = useCallback((settings: TicketPageSettings) => {
    if (status === 'POSTED') return;
    setCurrency(settings.defaultCurrency || 'IQD');
    setExchangeRate(settings.defaultCurrency === 'USD' ? adoptedEx.adoptedRate || 1 : 1);
    setPaymentType(settings.defaultPaymentType || 'نقدي');
    setPaymentMethod(settings.defaultPaymentMethod || 'CASH_HAND');
    if (settings.datesDefaultToday && !initialData) {
      const today = new Date();
      setIssueDate(today);
      setTravelDate(new Date(today));
    }
    const found = findDefaultCashCustomer(allCustomerCandidates, settings);
    if (found) {
      setCustomerName(customerDisplayName(found, isAr));
      defaultCustomerAppliedRef.current = true;
    } else if (settings.defaultCustomerName) {
      setCustomerName(settings.defaultCustomerName);
    }
    if (settings.linkCashboxToEmployee && employeeName) {
      applyEmployeeCashbox(employeeName, accountsList.length ? accountsList : availableCashboxes);
    }
    markDirty();
  }, [
    status,
    adoptedEx.adoptedRate,
    adoptedEx.adoptedRate,
    initialData,
    allCustomerCandidates,
    isAr,
    employeeName,
    applyEmployeeCashbox,
    accountsList,
    availableCashboxes,
    markDirty,
  ]);

  // Hydrate Data
  useEffect(() => {
    if (!opened) {
      hydratedInvoiceKeyRef.current = null;
      defaultCustomerAppliedRef.current = false;
      return;
    }

    const sourceData = initialData?.rawInvoice || initialData;
    const hydrationKey = sourceData
      ? `edit:${sourceData.id || sourceData.invoiceNumber || sourceData.number || 'unknown'}`
      : 'new';
    if (hydratedInvoiceKeyRef.current === hydrationKey) return;
    hydratedInvoiceKeyRef.current = hydrationKey;

    if (initialData) {
      const d = sourceData;
      setInvoiceNumber(d.invoiceNumber || d.number || '');
      setIssueDate(d.issueDate ? new Date(d.issueDate) : new Date());
      setTravelDate(d.travelDate ? new Date(d.travelDate) : new Date());
      setEntryDate(d.entryDate ? new Date(d.entryDate) : d.createdAt ? new Date(d.createdAt) : new Date());
      setCustomerName(d.customerName || d.customer || '');
      const rawSupplierHint = d.supplierId || d.supplierAccountId || d.supplierAccount || d.supplierAccountName || d.supplierName;
      const supplierHint = String(rawSupplierHint || '').trim();
      const resolvedSupplier = supplierHint
        ? suppliersList.find((supplier) =>
            [supplier.id, supplier.accountId, supplier.code, supplier.nameAr, supplier.nameEn]
              .filter(Boolean)
              .some((candidate) => String(candidate).trim().toLowerCase() === supplierHint.toLowerCase()),
          ) || null
        : null;
      const resolvedAirline = resolveAirline(d.airlineId || d.airline);
      const resolvedReceivingAccount = resolveAccount(d.cashboxAccountId || d.receivingCashbox);
      const resolvedPayingAccount = resolveAccount(d.cashbox);

      setSupplierAccount(resolvedSupplier?.id || (supplierHint ? d.supplierId || '' : ''));
      setSupplierAccountName(resolvedSupplier
        ? (isAr ? resolvedSupplier.nameAr : (resolvedSupplier.nameEn || resolvedSupplier.nameAr))
        : (supplierHint ? d.supplierAccountName || d.supplierName || '' : ''));
      setAirline(resolvedAirline?.id || d.airline || '');
      setPnr(d.pnr || '');
      setEmployeeName(d.employeeName || d.issuedBy || user?.name || (isAr ? 'علي جعفر' : 'Ali Jaafar'));
      setEntryEmployee(d.entryEmployee || user?.name || (isAr ? 'علي جعفر' : 'Ali Jaafar'));
      setCurrency(d.currency || 'IQD');
      setExchangeRate(d.exchangeRate || 1);
      setPaymentType(d.paymentType === 'CREDIT' || d.paymentType === 'آجل' ? 'آجل' : 'نقدي');
      setPaymentMethod(d.paymentMethod || 'CASH_HAND');
      setReceivingCashbox(resolvedReceivingAccount?.id || d.cashboxAccountId || d.receivingCashbox || '');
      setPayingCashbox(resolvedPayingAccount?.id || d.cashbox || '');
      setReference(d.reference || '');
      setNotes(d.notes || '');
      setStatus(d.status || 'POSTED');
      setDiscountAmount(d.discountAmount || d.totals?.discountAmount || 0);

      if (d.route) {
        const parts = d.route.split(/[-–—>]/).map((s: string) => s.trim().toUpperCase()).filter(Boolean);
        if (parts.length >= 2) {
          setFromAirport(parts[0]);
          setToAirport(parts[parts.length - 1]);
          setStopovers(parts.slice(1, -1));
          setFullRouteText(d.route);
        }
      }

      if (d.passengers && Array.isArray(d.passengers) && d.passengers.length > 0) {
        setPassengers(
          d.passengers.map((p: any, idx: number) => ({
            id: p.id || `p-${idx}-${Date.now()}`,
            name: p.name || '',
            ticketType: p.ticketType || 'ADULT',
            ticketNumber: p.ticketNumber || '',
            documentNumber: p.documentNumber || '',
            pnr: p.pnr || d.pnr || '',
            fareBuy: p.fareBuy !== undefined ? p.fareBuy : null,
            fareSell: p.fareSell !== undefined ? p.fareSell : null,
            tax1: p.tax1 || 0,
            tax2: p.tax2 || 0,
            charge: p.charge || 0,
            percentage: p.percentage || 0,
            status: p.status || 'باقي',
            batchId: p.batchId,
          })),
        );
      }

      if (d.transferImage) {
        setAttachments([
          {
            id: 'att-initial',
            name: isAr ? 'إيصال التحويل' : 'Transfer Receipt',
            url: d.transferImage,
            type: d.transferImage.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image',
          },
        ]);
      }

      setIsDirty(false);
    } else {
      // Create Mode: generate new invoice sequence
      const nextNum = getNextSequenceNumber('tickets');
      const settings = loadTicketPageSettings(user?.companyId, 'tickets');
      setPageSettings(settings);
      setInvoiceNumber(nextNum || `TK-${Date.now().toString().slice(-6)}`);
      const today = new Date();
      setIssueDate(settings.datesDefaultToday ? today : new Date());
      setTravelDate(settings.datesDefaultToday ? new Date(today) : new Date());
      setEntryDate(new Date());
      setSupplierAccount('');
      setSupplierAccountName('');
      setAirline('');
      setPnr('');
      const defaultEmp = user?.name || (isAr ? 'علي جعفر' : 'Ali Jaafar');
      setEmployeeName(defaultEmp);
      setEntryEmployee(defaultEmp);
      setCurrency(settings.defaultCurrency || 'IQD');
      setExchangeRate(settings.defaultCurrency === 'USD' ? adoptedEx.adoptedRate || 1 : 1);
      setPaymentType(settings.defaultPaymentType || 'نقدي');
      setPaymentMethod(settings.defaultPaymentMethod || 'CASH_HAND');
      setFromAirport('MHD');
      setToAirport('BGW');
      setStopovers([]);
      setFullRouteText('MHD - BGW');
      setReference('');
      setNotes('');
      setStatus('DRAFT');
      setDiscountAmount(0);
      defaultCustomerAppliedRef.current = false;
      const foundCustomer = findDefaultCashCustomer(allCustomerCandidates, settings);
      if (foundCustomer) {
        setCustomerName(customerDisplayName(foundCustomer, isAr));
        defaultCustomerAppliedRef.current = true;
      } else {
        setCustomerName(settings.defaultCustomerName || 'مسافر كاش');
      }

      if (settings.linkCashboxToEmployee) {
        applyEmployeeCashbox(defaultEmp, accountsList);
      }

      setPassengers([
        {
          id: `p-${Date.now()}`,
          name: '',
          ticketType: 'ADULT',
          ticketNumber: '',
          documentNumber: '',
          pnr: '',
          fareBuy: null,
          fareSell: null,
          tax1: 0,
          tax2: 0,
          charge: 0,
          percentage: 0,
          status: 'باقي',
        },
      ]);
      setAttachments([]);
      setIsDirty(false);
    }
  }, [opened, initialData, user, applyEmployeeCashbox, accountsList, resolveAccount, isAr, allCustomerCandidates]);

  // Convert legacy airline text to the registered airline ID once the list arrives.
  useEffect(() => {
    if (!opened || !airline || airlinesList.length === 0) return;
    const resolved = resolveAirline(airline);
    if (resolved && airline !== resolved.id) {
      setAirline(resolved.id);
      setErrors((current) => current.airline ? { ...current, airline: '' } : current);
    }
  }, [opened, airline, airlinesList.length, resolveAirline]);

  const handleSelectEmployee = (val: string) => {
    setEmployeeName(val);
    markDirty();
    if (pageSettings.linkCashboxToEmployee) {
      applyEmployeeCashbox(val, accountsList.length ? accountsList : availableCashboxes);
    }
  };

  useEffect(() => {
    if (!opened || !employeeName || !pageSettings.linkCashboxToEmployee) return;
    const method = paymentMethodsList.find((pm: any) => pm.value === paymentMethod);
    const target = String(method?.targetAccountId || '');
    if (target && !['EMPLOYEE_ASSIGNED', 'RECEIVABLE', ''].includes(target) && accountsList.some((a: any) => a.id === target)) {
      return;
    }
    applyEmployeeCashbox(employeeName, accountsList.length ? accountsList : availableCashboxes);
  }, [opened, employeeName, employeesList, accountsList, availableCashboxes, paymentMethod, paymentMethodsList, applyEmployeeCashbox, pageSettings.linkCashboxToEmployee]);

  useEffect(() => {
    if (!opened || initialData || defaultCustomerAppliedRef.current) return;
    if (!allCustomerCandidates.length) return;
    if (applyDefaultCustomer()) defaultCustomerAppliedRef.current = true;
  }, [opened, initialData, allCustomerCandidates, applyDefaultCustomer]);

  // Calculation Totals
  const totalBuy = useMemo(() => {
    return passengers.reduce((sum, p) => sum + (p.fareBuy || 0) + (p.tax1 || 0) + (p.tax2 || 0) + (p.charge || 0), 0);
  }, [passengers]);

  const totalSell = useMemo(() => {
    return passengers.reduce((sum, p) => sum + (p.fareSell || 0) + (p.tax1 || 0) + (p.tax2 || 0) + (p.charge || 0), 0);
  }, [passengers]);

  const totalTaxesBuy = useMemo(() => {
    return passengers.reduce((sum, p) => sum + (p.tax1 || 0) + (p.tax2 || 0), 0);
  }, [passengers]);

  const totalTaxesSell = useMemo(() => {
    return passengers.reduce((sum, p) => sum + (p.tax1 || 0) + (p.tax2 || 0), 0);
  }, [passengers]);

  const totalCharges = useMemo(() => {
    return passengers.reduce((sum, p) => sum + (p.charge || 0), 0);
  }, [passengers]);

  const passengersNamedCount = useMemo(() => {
    return passengers.filter((p) => p.name && p.name.trim().length > 0).length;
  }, [passengers]);

  const formatAmount = useCallback(
    (val: number | null | undefined) => {
      return formatCurrency(val, currency);
    },
    [currency],
  );

  const selectedAirlineItem = useMemo(() => {
    if (!airline) return null;
    const norm = (s?: string | null) => (s || '').trim().toLowerCase().replace(/[إأآ]/g, 'ا').replace(/ة/g, 'ه').replace(/\s+/g, ' ');
    const target = norm(airline);
    return airlinesList.find(
      (a) =>
        a.id === airline ||
        norm(a.code) === target ||
        norm(a.nameAr) === target ||
        norm(a.nameEn) === target ||
        (a.nameAr && norm(a.nameAr).includes(target)) ||
        (target.includes(norm(a.nameAr))) ||
        (a.nameEn && norm(a.nameEn).includes(target)) ||
        (a.code && target.includes(norm(a.code))),
    );
  }, [airline, airlinesList]);

  // Active adopted exchange rate
  const activeExchangeRate = useMemo(() => {
    return adoptedEx.adoptedRate || 1320;
  }, [adoptedEx.adoptedRate]);

  // ── Currency Switching Interception ──
  const handleCurrencyChange = (newCurrency: string) => {
    if (newCurrency === currency) return;

    const hasEnteredPrices = passengers.some(
      (p) => (p.fareBuy !== null && p.fareBuy > 0) || (p.fareSell !== null && p.fareSell > 0),
    );

    if (!hasEnteredPrices) {
      setCurrency(newCurrency);
      markDirty();
      return;
    }

    setPendingCurrency(newCurrency);
    setCurrencySwitchModalOpen(true);
  };

  const handleConfirmCurrencyConvert = useCallback(
    (appliedRate: number) => {
      const targetCurr = pendingCurrency;
      const rate = appliedRate || activeExchangeRate || 1320;

      const updatedPassengers = passengers.map((p) => {
        const newBuy =
          p.fareBuy !== null && p.fareBuy !== undefined
            ? targetCurr === 'USD'
              ? Math.round((p.fareBuy / rate) * 100) / 100
              : Math.round(p.fareBuy * rate)
            : null;
        const newSell =
          p.fareSell !== null && p.fareSell !== undefined
            ? targetCurr === 'USD'
              ? Math.round((p.fareSell / rate) * 100) / 100
              : Math.round(p.fareSell * rate)
            : null;
        const newTax1 = p.tax1
          ? targetCurr === 'USD'
            ? Math.round((p.tax1 / rate) * 100) / 100
            : Math.round(p.tax1 * rate)
          : 0;
        const newTax2 = p.tax2
          ? targetCurr === 'USD'
            ? Math.round((p.tax2 / rate) * 100) / 100
            : Math.round(p.tax2 * rate)
          : 0;
        const newCharge = p.charge
          ? targetCurr === 'USD'
            ? Math.round((p.charge / rate) * 100) / 100
            : Math.round(p.charge * rate)
          : 0;

        return {
          ...p,
          fareBuy: newBuy,
          fareSell: newSell,
          tax1: newTax1,
          tax2: newTax2,
          charge: newCharge,
        };
      });

      if (discountAmount > 0) {
        setDiscountAmount((prev) =>
          targetCurr === 'USD' ? Math.round((prev / rate) * 100) / 100 : Math.round(prev * rate),
        );
      }

      setCurrency(targetCurr);
      setPassengers(updatedPassengers);
      setExchangeRate(rate);
      markDirty();
    },
    [pendingCurrency, activeExchangeRate, passengers, discountAmount, markDirty],
  );

  const handleConfirmCurrencyReset = useCallback(() => {
    const targetCurr = pendingCurrency;
    const resetPassengers = passengers.map((p) => ({
      ...p,
      fareBuy: null,
      fareSell: null,
      tax1: 0,
      tax2: 0,
      charge: 0,
      batchId: undefined,
    }));

    setDiscountAmount(0);
    setPassengers(resetPassengers);
    setCurrency(targetCurr);
    markDirty();
  }, [pendingCurrency, passengers, markDirty]);

  // ── 1. Single Source of Truth Completion Calculation ──
  const completionData = useMemo(() => {
    const reqs: Array<{
      id: string;
      label: string;
      isCompleted: boolean;
      missingMessage: string;
      targetElementId: string;
    }> = [];

    // 1. Issue Date
    reqs.push({
      id: 'issueDate',
      label: isAr ? 'تاريخ الإصدار' : 'Issue Date',
      isCompleted: Boolean(issueDate),
      missingMessage: isAr ? 'يرجى تحديد تاريخ الإصدار' : 'Please select issue date',
      targetElementId: 'field-issue-date',
    });

    // 2. Airline (Optional - excluded from mandatory checklist)

    // 3. Flight Route
    reqs.push({
      id: 'route',
      label: isAr ? 'مسار الرحلة' : 'Flight Route',
      isCompleted: Boolean(fromAirport && fromAirport.trim() && toAirport && toAirport.trim()),
      missingMessage: isAr ? 'يرجى تحديد مطار الإقلاع ومطار الوصول' : 'Please select departure and arrival airports',
      targetElementId: 'field-route',
    });

    // 4. Issuing Employee
    reqs.push({
      id: 'employeeName',
      label: isAr ? 'موظف الإصدار' : 'Issuing Employee',
      isCompleted: Boolean(employeeName && employeeName.trim().length > 0),
      missingMessage: isAr ? 'يرجى تحديد اسم موظف الإصدار' : 'Please select issuing employee',
      targetElementId: 'field-employee',
    });

    // 5. Conditional Parties & Payment Method
    if (paymentType === 'آجل' || paymentType === 'CREDIT') {
      reqs.push({
        id: 'customerName',
        label: isAr ? 'العميل (البيع الآجل)' : 'Customer (Credit Sale)',
        isCompleted: Boolean(customerName && customerName.trim().length > 0),
        missingMessage: isAr ? 'العميل مطلوب لأن البيع آجل (على الحساب)' : 'Customer is required for credit sale',
        targetElementId: 'field-customer',
      });
    } else {
      // Cash
      reqs.push({
        id: 'paymentMethod',
        label: isAr ? 'طريقة الاستلام' : 'Receiving Method',
        isCompleted: Boolean(paymentMethod && paymentMethod.trim().length > 0),
        missingMessage: isAr ? 'طريقة الاستلام مطلوبة للبيع النقدي' : 'Payment method is required for cash sale',
        targetElementId: 'field-payment-method',
      });

      reqs.push({
        id: 'receivingCashbox',
        label: isAr ? 'صندوق استلام قيمة البيع' : 'Receiving Cashbox',
        isCompleted: Boolean(receivingCashbox && receivingCashbox.trim().length > 0),
        missingMessage: isAr ? 'صندوق استلام قيمة البيع مطلوب للتحصيل النقدي' : 'Receiving cashbox is required for cash receipt',
        targetElementId: 'field-receiving-cashbox',
      });
    }

    // 6. Passengers Existence
    const hasPassengers = passengers.length >= 1;
    reqs.push({
      id: 'passengersExistence',
      label: isAr ? 'إضافة المسافرين' : 'Add Passengers',
      isCompleted: hasPassengers,
      missingMessage: isAr ? 'يجب إضافة مسافر واحد على الأقل' : 'At least one passenger must be added',
      targetElementId: 'field-passengers-section',
    });

    // 7. Passengers Names
    if (hasPassengers) {
      const allNamed = passengers.every((p) => Boolean(p.name && p.name.trim().length > 0));
      reqs.push({
        id: 'passengersNames',
        label: isAr ? 'أسماء المسافرين' : 'Passenger Names',
        isCompleted: allNamed,
        missingMessage: isAr ? 'يرجى إدخال اسم لكل مسافر' : 'Please enter full names for all passengers',
        targetElementId: 'field-passengers-table',
      });

      // 8. Passengers Pricing
      const allPriced = passengers.every(
        (p) =>
          p.fareSell !== null &&
          p.fareSell !== undefined &&
          Number.isFinite(Number(p.fareSell)) &&
          p.fareBuy !== null &&
          p.fareBuy !== undefined &&
          Number.isFinite(Number(p.fareBuy))
      );
      reqs.push({
        id: 'passengersPricing',
        label: isAr ? 'تسعير التذاكر' : 'Ticket Pricing',
        isCompleted: allPriced,
        missingMessage: isAr ? 'يرجى التأكد من إدخال سعر بيع وشراء صحيح لجميع المسافرين' : 'Please ensure valid buy and sell fares for all passengers',
        targetElementId: 'field-price-batch-bar',
      });
    }

    const totalCount = reqs.length;
    const completedCount = reqs.filter((r) => r.isCompleted).length;
    const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    const isComplete = completionPercentage === 100;
    const missingRequirements = reqs.filter((r) => !r.isCompleted);

    return {
      requirements: reqs,
      totalCount,
      completedCount,
      completionPercentage,
      isComplete,
      missingRequirements,
    };
  }, [
    issueDate,
    airline,
    fromAirport,
    toAirport,
    employeeName,
    paymentType,
    customerName,
    paymentMethod,
    receivingCashbox,
    passengers,
    isAr,
  ]);

  // Navigate & Highlight missing field
  const handleNavigateToField = (targetElementId?: string) => {
    if (!targetElementId) return;
    const el = document.getElementById(targetElementId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-4', 'ring-orange-500/40', 'border-orange-500', 'transition-all');
      setTimeout(() => {
        el.classList.remove('ring-4', 'ring-orange-500/40', 'border-orange-500');
      }, 2000);
      const input = el.querySelector('input, select, button') || el;
      (input as HTMLElement)?.focus();
    }
  };

  // Validation
  const validateForm = (isPosting: boolean): boolean => {
    const errs: Record<string, string> = {};

    if (!invoiceNumber.trim()) errs.invoiceNumber = isAr ? 'رقم الفاتورة مطلوب' : 'Invoice number is required';

    if (isPosting) {
      // Airline is strictly optional per business requirement
      if (!fromAirport.trim() || !toAirport.trim()) errs.route = isAr ? 'يرجى تحديد مطار الإقلاع والوصول' : 'Please specify flight route';
      if (!employeeName.trim()) errs.employeeName = isAr ? 'يرجى تحديد موظف الإصدار' : 'Please select issuing employee';

      if (paymentType === 'آجل' || paymentType === 'CREDIT') {
        if (!customerName.trim()) errs.customerName = isAr ? 'العميل مطلوب لأن البيع آجل' : 'Customer is required for credit sale';
      } else {
        if (!receivingCashbox.trim()) errs.receivingCashbox = isAr ? 'يرجى تحديد صندوق استلام قيمة البيع' : 'Please select receiving cashbox';
        if (!paymentMethod.trim()) errs.paymentMethod = isAr ? 'يرجى تحديد طريقة الاستلام' : 'Please select receiving method';
      }

      if (passengers.length === 0) {
        errs.passengers = isAr ? 'يجب إضافة مسافر واحد على الأقل' : 'At least one passenger is required';
      }

      passengers.forEach((p, idx) => {
        if (!p.name.trim()) {
          errs[`passenger_${idx}_name`] = isAr ? 'اسم المسافر مطلوب' : 'Passenger name is required';
        }
        if (
          p.fareSell === null ||
          p.fareSell === undefined ||
          !Number.isFinite(Number(p.fareSell))
        ) {
          errs[`passenger_${idx}_fareSell`] = isAr ? 'سعر البيع مطلوب' : 'Sell fare is required';
        }
      });
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Helper: Safely parse date strings
  const safeParseDate = (raw?: string): Date | null => {
    if (!raw) return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;

    const ymd = trimmed.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (ymd) {
      const y = parseInt(ymd[1], 10);
      const m = parseInt(ymd[2], 10) - 1;
      const d = parseInt(ymd[3], 10);
      return new Date(y, m, d);
    }

    const dmy = trimmed.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (dmy) {
      const d = parseInt(dmy[1], 10);
      const m = parseInt(dmy[2], 10) - 1;
      const y = parseInt(dmy[3], 10);
      return new Date(y, m, d);
    }

    const standard = new Date(trimmed);
    return isNaN(standard.getTime()) ? null : standard;
  };

  // Smart Parser Import handler
  const handleSmartImport = (parsedData: ParsedTicketData) => {
    if (parsedData.pnr) setPnr(parsedData.pnr);
    if (parsedData.airline) setAirline(parsedData.airline);
    if (parsedData.routeFrom && parsedData.routeTo) {
      setFromAirport(parsedData.routeFrom);
      setToAirport(parsedData.routeTo);
      setStopovers(parsedData.routeStops || []);
      setFullRouteText(`${parsedData.routeFrom} - ${parsedData.routeTo}`);
    }
    if (parsedData.travelDate) {
      const td = safeParseDate(parsedData.travelDate);
      if (td) setTravelDate(td);
    }
    if (parsedData.issueDate) {
      const id = safeParseDate(parsedData.issueDate);
      if (id) setIssueDate(id);
    }
    if (parsedData.bookingRef) {
      setReference(parsedData.bookingRef);
    }
    if (parsedData.currency === 'USD' || parsedData.currency === 'IQD') {
      setCurrency(parsedData.currency);
    }
    if (parsedData.passengers && parsedData.passengers.length > 0) {
      const moneyOrNull = (v: any) => {
        const n = Number(v);
        return Number.isFinite(n) && n > 0 ? n : null;
      };
      const newRows: PassengerLine[] = parsedData.passengers.map((p: any, idx: number) => ({
        id: `p-parsed-${Date.now()}-${idx}`,
        name: p.name || '',
        ticketType: (p.ticketType as any) || 'ADULT',
        ticketNumber: p.ticketNumber || '',
        documentNumber: p.documentNumber || '',
        pnr: parsedData.pnr || pnr || '',
        fareBuy: moneyOrNull(p.fareBuy),
        fareSell: moneyOrNull(p.fareSell),
        tax1: Number(p.tax1) > 0 ? Number(p.tax1) : 0,
        tax2: Number(p.tax2) > 0 ? Number(p.tax2) : 0,
        charge: Number(p.charge) > 0 ? Number(p.charge) : 0,
      }));

      if (passengers.length === 1 && !passengers[0].name.trim() && !passengers[0].ticketNumber.trim()) {
        setPassengers(newRows);
      } else {
        setPassengers([...passengers, ...newRows]);
      }
    }
    markDirty();
    const ticketCount = (parsedData.passengers || []).filter((p: any) => p.ticketNumber).length;
    showSuccessNotification(
      isAr ? 'تم الاستيراد والتحليل الذكي بنجاح' : 'Smart Import Succeeded',
      isAr
        ? `تم استخراج ${parsedData.passengers?.length || 0} مسافرين و${ticketCount} رقم تذكرة`
        : `Extracted ${parsedData.passengers?.length || 0} passenger(s) and ${ticketCount} ticket number(s)`,
    );
  };

  const handleApplyReconciliationMatches = (results: {
    customer?: { id?: string; name: string; isNew?: boolean; accountCode?: string };
    supplier?: { id?: string; name: string; isNew?: boolean; accountCode?: string };
  }) => {
    queryClient.invalidateQueries({ queryKey: ['customers-list'] });
    queryClient.invalidateQueries({ queryKey: ['suppliers-list'] });
    queryClient.invalidateQueries({ queryKey: ['cashbox-accounts-list'] });

    if (results.customer) {
      setCustomerName(results.customer.name);
    }

    if (results.supplier) {
      if (results.supplier.id) {
        setSupplierAccount(results.supplier.id);
      }
      setSupplierAccountName(results.supplier.name);
    }

    if (pendingImportData?.passengers && typeof handleSmartImport === 'function') {
      handleSmartImport(pendingImportData);
    }

    setPendingImportData(null);
    setUnmatchedCustomerData(null);
    setUnmatchedSupplierData(null);
    setReconciliationModalOpen(false);
    markDirty();
  };

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async (targetStatus: string) => {
      const isValid = validateForm(targetStatus === 'POSTED');
      if (!isValid) {
        // Check unpriced passengers specific alert
      const hasUnpriced = passengers.some((p) => p.fareSell === null || p.fareSell === undefined || Number(p.fareSell) <= 0);
      if (hasUnpriced && targetStatus === 'POSTED') {
        showErrorNotification(
          isAr ? 'يرجى تسعير المسافرين' : 'Unpriced Passengers',
          isAr ? 'يوجد مسافرون بلا سعر — اكتب سعر البيع في سطر فئتهم (بالغ/طفل/رضيع)، أو في صفّ المسافر نفسه.' : 'Some passengers have no price — set it on their type row, or in the passenger row itself.'
        );
        handleNavigateToField('field-price-batch-bar');
        throw new Error('Unpriced passengers');
      }

      showErrorNotification(
        isAr ? 'بيانات غير مكتملة' : 'Incomplete Data',
          isAr ? 'يرجى مراجعة الحقول المطلوبة' : 'Please check the required fields'
        );
        throw new Error('Validation failed');
      }

      const isCashSale = paymentType === 'نقدي' || paymentType === 'CASH' || paymentType === 'DEBIT';
      const selectedCustomer = customersList.find(
        (c) => c.id === customerName || c.code === customerName || c.nameAr === customerName || c.nameEn === customerName,
      );
      const selectedSupplier = suppliersList.find(
        (s) => s.id === supplierAccount || s.accountId === supplierAccount || s.code === supplierAccount || s.nameAr === supplierAccountName || s.nameEn === supplierAccountName,
      );
      const selectedAirline = resolveAirline(airline);
      const selectedReceivingAccount = resolveAccount(receivingCashbox);
      const selectedPayingAccount = resolveAccount(payingCashbox);

      if (targetStatus === 'POSTED') {
        let relationError = '';
        const relationErrors: Record<string, string> = {};

        if (totalBuy > 0 && !selectedSupplier?.accountId && selectedSupplier?.source !== 'account') {
          relationErrors.supplierAccount = isAr ? 'اختر مورداً مربوطاً بحساب محاسبي' : 'Select a supplier linked to an accounting account';
          relationError = relationErrors.supplierAccount;
        } else if (totalSell > 0 && isCashSale && !selectedReceivingAccount) {
          relationErrors.receivingCashbox = isAr ? 'اختر حساب صندوق أو بنك مسجل' : 'Select a registered cashbox or bank account';
          relationError = relationErrors.receivingCashbox;
        } else if (totalSell > 0 && !isCashSale && !selectedCustomer?.accountId && selectedCustomer?.source !== 'account') {
          relationErrors.customerName = isAr ? 'اختر عميلاً مربوطاً بحساب محاسبي' : 'Select a customer linked to an accounting account';
          relationError = relationErrors.customerName;
        }

        if (relationError) {
          setErrors((current) => ({ ...current, ...relationErrors }));
          showErrorNotification(
            isAr ? 'تعذر الترحيل' : 'Unable to Post',
            relationError,
          );
          throw new Error('Validation failed');
        }
      }

      const payload: any = {
        invoiceNumber,
        issueDate: issueDate.toISOString(),
        travelDate: travelDate ? travelDate.toISOString() : null,
        customerName: customerName.trim(),
        customerId: selectedCustomer?.source === 'account' ? null : selectedCustomer?.id || null,
        customerAccountId: selectedCustomer?.accountId || (selectedCustomer?.source === 'account' ? selectedCustomer.id : null),
        supplierAccount: supplierAccount || null,
        supplierAccountName: supplierAccountName || null,
        supplierId: selectedSupplier?.source === 'account' ? null : selectedSupplier?.id || null,
        supplierAccountId: selectedSupplier?.accountId || (selectedSupplier?.source === 'account' ? selectedSupplier.id : null),
        airline: selectedAirline?.nameAr || selectedAirline?.nameEn || airline,
        airlineId: selectedAirline?.id || null,
        pnr: pnr.trim().toUpperCase(),
        employeeName: employeeName.trim(),
        entryEmployee: entryEmployee.trim() || user?.name || (isAr ? 'علي جعفر' : 'Ali Jaafar'),
        modifiedByEmployee: user?.name || (isAr ? 'علي جعفر' : 'Ali Jaafar'),
        currency,
        exchangeRate,
        paymentType: isCashSale ? 'DEBIT' : 'CREDIT',
        paymentMethod: isCashSale ? paymentMethod : null,
        receivingCashbox: isCashSale ? selectedReceivingAccount?.id || null : null,
        cashboxAccountId: isCashSale ? selectedReceivingAccount?.id || null : null,
        cashbox: selectedReceivingAccount?.id || selectedPayingAccount?.id || null,
        entryDate: entryDate.toISOString(),
        route: fullRouteText,
        reference: reference.trim(),
        notes: notes.trim(),
        status: targetStatus,
        discountAmount,
        totalBuy,
        totalSell,
        transferImage: attachments[0]?.url || null,
        passengers: passengers.map((p) => ({
          name: p.name.trim(),
          ticketType: p.ticketType,
          ticketNumber: p.ticketNumber.trim(),
          documentNumber: p.documentNumber?.trim(),
          pnr: p.pnr?.trim() || pnr.trim().toUpperCase(),
          fareBuy: p.fareBuy || 0,
          fareSell: p.fareSell || 0,
          tax1: p.tax1 || 0,
          tax2: p.tax2 || 0,
          charge: p.charge || 0,
          percentage: p.percentage || 0,
          status: p.status || 'باقي',
        })),
      };

      let result: any;
      if (initialData?.id || initialData?.invoiceNumber) {
        const idToUpdate = initialData.id || initialData.invoiceNumber;
        result = await ticketsApi.update(idToUpdate, payload);
      } else {
        result = await ticketsApi.create(payload);
      }
      return result;
    },
    onSuccess: (savedData, targetStatus) => {
      queryClient.invalidateQueries({ queryKey: ['tickets-list'] });
      setIsDirty(false);
      setStatus(targetStatus);

      if (targetStatus === 'POSTED') {
        showSuccessNotification(
          isAr ? 'تم اعتماد وترحيل الفاتورة' : 'Invoice Posted',
          isAr ? 'تم تسجيل الفاتورة بنجاح' : 'Invoice posted and recorded successfully'
        );
      } else {
        showSuccessNotification(
          isAr ? 'تم حفظ المسودة' : 'Draft Saved',
          isAr ? 'تم حفظ بيانات الفاتورة كمسودة' : 'Invoice saved as draft successfully'
        );
      }

      if (onSuccess) onSuccess(savedData);
    },
    onError: (err: any) => {
      if (err.message !== 'Validation failed') {
        showErrorNotification(
          isAr ? 'فشل الحفظ' : 'Save Failed',
          err?.message || (isAr ? 'تعذر حفظ الفاتورة' : 'Could not save invoice')
        );
      }
    },
  });

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Permanent deletion. Explicitly requested by the owner; guarded by a typed
  // confirmation in the modal, and only ever reachable for a saved invoice.
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const idToDelete = initialData?.id;
      if (!idToDelete) {
        throw new Error(isAr ? 'لا يمكن حذف فاتورة غير محفوظة' : 'Cannot delete an unsaved invoice');
      }
      return await ticketsApi.delete(idToDelete);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets-list'] });
      setDeleteModalOpen(false);
      setIsDirty(false);
      showSuccessNotification(
        isAr ? 'تم حذف الفاتورة' : 'Invoice deleted',
        isAr ? `حُذفت الفاتورة ${invoiceNumber} نهائياً` : `Invoice ${invoiceNumber} was permanently deleted`,
      );
      onClose();
    },
    onError: (err: any) => {
      showErrorNotification(
        isAr ? 'فشل الحذف' : 'Delete failed',
        err?.message || (isAr ? 'تعذر حذف الفاتورة' : 'Could not delete the invoice'),
      );
    },
  });

  // Cancel Mutation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!initialData?.id && !initialData?.invoiceNumber) {
        throw new Error('لا يمكن إلغاء فاتورة غير محفوظة');
      }
      const idToCancel = initialData.id || initialData.invoiceNumber;
      return await ticketsApi.cancel(idToCancel, cancelReason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets-list'] });
      setStatus('CANCELLED');
      setCancelModalOpen(false);
      showSuccessNotification(
        isAr ? 'تم إلغاء الفاتورة' : 'Invoice Cancelled',
        isAr ? 'تم إلغاء الفاتورة بنجاح' : 'Invoice was cancelled successfully'
      );
    },
    onError: (err: any) => {
      showErrorNotification(
        isAr ? 'فشل الإلغاء' : 'Cancellation Failed',
        err?.message || (isAr ? 'تعذر إلغاء الفاتورة' : 'Could not cancel invoice')
      );
    },
  });

  // Modal actions for exit confirmation
  const handleSaveAndExit = async () => {
    try {
      await saveMutation.mutateAsync('DRAFT');
      setConfirmExitOpen(false);
      setIsDirty(false);
      onClose();
    } catch (err) {
      throw err;
    }
  };

  const handleDiscardAndExit = () => {
    setConfirmExitOpen(false);
    setIsDirty(false);
    onClose();
  };

  const handleContinueEditing = () => {
    setConfirmExitOpen(false);
  };

  if (!opened) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#FAFAFA] flex flex-col overflow-hidden select-text text-[#111827]"
      style={{ fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}
      dir={direction}
    >
      {/* ── 1. CLEAN TOP HEADER (Responsive Height & Padding) ── */}
      <header className="min-h-[56px] sm:h-[60px] bg-white border-b border-[#E5E7EB] px-3 sm:px-6 py-2 sm:py-0 flex items-center justify-between shrink-0 shadow-2xs z-20">
        {/* Leading Side: Back, Icon, Title (19px/700), Badge, Status */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Tooltip label={isAr ? 'رجوع' : 'Back'} position="bottom" withArrow>
            <button
              type="button"
              onClick={handleRequestClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            >
              {direction === 'rtl' ? <ArrowRight size={18} /> : <ArrowLeft size={18} />}
            </button>
          </Tooltip>

          <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#F45A0A] flex items-center justify-center font-bold shrink-0">
            <Plane size={17} />
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
            <h2 className="font-bold text-[15px] sm:text-[19px] text-[#111827] leading-tight truncate">
              {isAr ? 'تذاكر الطيران' : 'Flight Invoicing'}
            </h2>
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono font-medium text-[11px] sm:text-xs border border-slate-200 shrink-0" dir="ltr">
              {invoiceNumber || 'TK-NEW'}
            </span>

            {/* Status Badge + Unsaved Indicator */}
            <div className={`flex items-center gap-1 shrink-0 ${isAr ? 'mr-0.5 sm:mr-1' : 'ml-0.5 sm:ml-1'}`}>
              {status === 'POSTED' ? (
                <span className="px-2 py-0.5 rounded text-[11px] sm:text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {isAr ? 'معتمدة' : 'Posted'}
                </span>
              ) : status === 'CANCELLED' ? (
                <span className="px-2 py-0.5 rounded text-[11px] sm:text-xs font-semibold bg-red-50 text-red-800 border border-red-200">
                  {isAr ? 'ملغاة' : 'Cancelled'}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[11px] sm:text-xs font-semibold bg-[#FFF3E8] text-[#F45A0A] border border-orange-200">
                  {isAr ? 'مسودة' : 'Draft'}
                </span>
              )}

              {isDirty && (
                <Tooltip label={isAr ? 'توجد تعديلات غير محفوظة' : 'Unsaved changes'} position="bottom" withArrow>
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F45A0A] inline-block animate-pulse shrink-0"></span>
                </Tooltip>
              )}
            </div>
          </div>
        </div>

        {/* Trailing Side: Print & Options */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {status === 'POSTED' && (
            <Button
              size="xs"
              variant="default"
              radius="md"
              leftSection={<Printer size={14} />}
              onClick={() => window.print()}
              className="hidden sm:inline-flex font-medium text-xs border-slate-200 text-slate-700 h-8.5 cursor-pointer"
            >
              {isAr ? 'طباعة' : 'Print'}
            </Button>
          )}

          <Menu position="bottom-end" shadow="sm" radius="md">
            <Menu.Target>
              <ActionIcon variant="default" size="md" radius="md" className="border-slate-200 text-slate-600 h-8.5 w-8.5 cursor-pointer">
                <MoreVertical size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown className="p-1 text-xs font-medium" dir={direction}>
              {status === 'POSTED' && (
                <Menu.Item
                  leftSection={<Printer size={14} />}
                  onClick={() => window.print()}
                  className="sm:hidden"
                >
                  {isAr ? 'طباعة الفاتورة' : 'Print Invoice'}
                </Menu.Item>
              )}
              <Menu.Item
                leftSection={<History size={14} />}
                onClick={() => setAuditLogOpen(true)}
              >
                {isAr ? 'سجل التعديلات' : 'Audit Trail Log'}
              </Menu.Item>
              <Menu.Item
                leftSection={<Settings size={14} />}
                onClick={() => {
                  setDraftPageSettings(loadTicketPageSettings(user?.companyId, 'tickets'));
                  setPageSettingsOpen(true);
                }}
              >
                {isAr ? 'إعدادات الصفحة' : 'Page settings'}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                color="red"
                leftSection={<Trash2 size={14} />}
                onClick={() => setDeleteModalOpen(true)}
                disabled={!initialData?.id}
              >
                {isAr ? 'حذف الفاتورة' : 'Delete Invoice'}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>
      </header>

      {/* ── 2. FULL WORKSPACE MAIN CONTENT ── */}
      <main className="flex-1 overflow-y-auto px-2.5 sm:px-4 md:px-6 py-3 sm:py-4">
        <div className="w-full max-w-[1680px] mx-auto space-y-3 sm:space-y-4">

          {/* ── TOP VISUAL STEP INDICATOR (Responsive) ── */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-2.5 sm:p-3 px-3 sm:px-6 shadow-2xs">
            <div className="flex items-center justify-between max-w-2xl mx-auto">
              <div className="flex items-center gap-1.5 sm:gap-2 text-slate-900 min-w-0">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#F45A0A] text-white font-bold text-[11px] sm:text-xs flex items-center justify-center shrink-0">
                  1
                </div>
                <span className="text-[11px] sm:text-xs font-semibold text-slate-900 truncate">
                  {isAr ? 'الفاتورة والرحلة' : 'Flight & Info'}
                </span>
              </div>

              <div className="flex-1 h-[1.5px] bg-orange-200 mx-2 sm:mx-4"></div>

              <div className="flex items-center gap-1.5 sm:gap-2 text-slate-900 min-w-0">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#F45A0A] text-white font-bold text-[11px] sm:text-xs flex items-center justify-center shrink-0">
                  2
                </div>
                <span className="text-[11px] sm:text-xs font-semibold text-slate-900 truncate">
                  {isAr ? 'المسافرون والتذاكر' : 'Passengers'}
                </span>
              </div>

              <div
                className={`flex-1 h-[1.5px] mx-2 sm:mx-4 ${
                  paymentMethod === 'CASH_HAND' || paymentMethod === 'CASH' || paymentMethod === 'كاش باليد (نقدي)'
                    ? 'bg-emerald-300'
                    : 'bg-slate-200'
                }`}
              ></div>

              {paymentMethod === 'CASH_HAND' || paymentMethod === 'CASH' || paymentMethod === 'كاش باليد (نقدي)' ? (
                <div className="flex items-center gap-1.5 sm:gap-2 text-emerald-700 min-w-0">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-300 font-bold text-[11px] sm:text-xs flex items-center justify-center shadow-2xs shrink-0">
                    ✓
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] sm:text-xs font-semibold text-emerald-800 leading-tight truncate">
                      {isAr ? 'المرفقات' : 'Review'}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-medium hidden sm:inline">
                      {isAr ? 'مكتملة تلقائياً (كاش باليد)' : 'Auto-waived (Cash)'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 sm:gap-2 text-slate-400 min-w-0">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-slate-100 text-slate-500 font-bold text-[11px] sm:text-xs flex items-center justify-center border border-slate-200 shrink-0">
                    3
                  </div>
                  <span className="text-[11px] sm:text-xs font-medium text-slate-400 truncate">
                    {isAr ? 'المرفقات والمراجعة' : 'Attachments'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── 2-COLUMN MAIN LAYOUT (Fluid Stack on Mobile, 360px Sidebar on Desktop) ── */}
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-3 sm:gap-4 items-start">
            
            {/* ── MAIN LEADING COLUMN ── */}
            <div className="space-y-3 sm:space-y-4">
              
              {/* ── CARD 1: INVOICE & FLIGHT INFO ── */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-3.5 sm:p-5 space-y-3 sm:space-y-4 font-sans">
                {/* Header (Title 17px/700, Desc 12.5px/400) */}
                <div className="flex items-start sm:items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#F45A0A] text-white font-bold text-sm flex items-center justify-center shrink-0">
                      1
                    </div>
                    <div>
                      <h3 className="font-bold text-[16px] sm:text-[17px] text-[#111827] leading-tight">
                        {isAr ? 'معلومات الفاتورة والرحلة' : 'Invoice & Flight Information'}
                      </h3>
                      <span className="text-[11.5px] sm:text-[12.5px] text-[#6B7280] font-normal block sm:inline">
                        {isAr ? 'التواريخ وموظف الإصدار ومسار الرحلة' : 'Dates, issuing staff, and flight route'}
                      </span>
                    </div>
                  </div>

                  {/* Currency Segmented Control */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <CurrencySegmentedControl
                      value={currency}
                      onChange={handleCurrencyChange}
                      showLabel={false}
                      disabled={status === 'POSTED'}
                    />
                  </div>
                </div>

                {/* 2-Column Grid: Employee + Entry Date & Time */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div id="field-employee">
                    <SearchableCombobox
                      label={isAr ? 'موظف الإصدار' : 'Issuing Employee'}
                      required
                      value={employeeName}
                      onChange={handleSelectEmployee}
                      options={employeesList.map((e) => ({
                        value: e.fullName || e.name || e.username || '',
                        label: e.fullName || e.name || e.username || '',
                      }))}
                      allowCustomValue
                    />
                  </div>

                  <div id="field-entry-date">
                    {/* One field, one popover: the calendar and the clock together.
                        The old pair of segmented pickers needed six separate edits
                        to set a single moment. */}
                    <DateTimeField
                      label={isAr ? 'تاريخ ووقت الإدخال' : 'Entry Date & Time'}
                      isArabic={isAr}
                      value={entryDate}
                      onChange={(next) => {
                        setEntryDate(next);
                        markDirty();
                      }}
                    />
                  </div>
                </div>
              </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  <section id="field-customer" className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-3.5 sm:p-5 space-y-3 font-sans">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-sky-50 text-sky-700 border border-sky-200 flex items-center justify-center shrink-0">
                          <User size={15} />
                        </div>
                        <div>
                          <h4 className="text-[15px] font-bold text-[#111827] leading-tight">
                            {isAr ? 'معلومات العميل' : 'Customer details'}
                          </h4>
                          <p className="text-[11.5px] text-[#6B7280]">
                            {isAr ? 'العميل ونوع البيع وطريقة الاستلام والصندوق' : 'Customer, sale type, receipt method, and cashbox'}
                          </p>
                        </div>
                      </div>
                      {(paymentType === 'آجل' || paymentType === 'CREDIT') && (
                        <span className="text-[10px] font-bold text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded shrink-0">
                          {isAr ? 'مطلوب للبيع الآجل' : 'Required for credit'}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <SearchableCombobox
                      label={isAr ? 'العميل' : 'Customer'}
                      labelAction={
                        <button
                          type="button"
                          onClick={() =>
                            setAccountFinder({
                              open: true,
                              scope: 'CUSTOMER',
                              query: /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(customerName || '') ? '' : customerName || '',
                            })
                          }
                          title={isAr ? 'البحث في كل حسابات العملاء والموردين' : 'Search every customer and supplier account'}
                          className="h-[18px] text-[10.5px] font-bold text-[#F45A0A] hover:text-[#dd4f05] flex items-center gap-1 cursor-pointer bg-orange-50/70 hover:bg-orange-100/80 px-1.5 rounded-md border border-orange-200/60 transition-colors leading-none"
                        >
                          <Search size={11} className="stroke-[2.5]" />
                          <span>{isAr ? 'بحث متقدّم' : 'Advanced'}</span>
                        </button>
                      }
                      required={paymentType === 'آجل' || paymentType === 'CREDIT'}
                      value={customerName}
                      onChange={(val) => {
                        const found = customersList.find((c) => c.id === val || c.code === val || c.nameAr === val || c.nameEn === val)
                          || allCustomerCandidates.find((c) => c.id === val || c.code === val || c.nameAr === val || c.nameEn === val);
                        setCustomerName(found ? customerDisplayName(found, isAr) : (val || ''));
                        markDirty();
                      }}
                      options={formattedCustomersData}
                      allowCustomValue
                      error={errors.customerName}
                    />
                    <div id="field-payment-type">
                    <SearchableCombobox
                      label={isAr ? 'نوع البيع' : 'Payment Term'}
                      value={paymentType}
                      onChange={(val) => {
                        const nextVal = val || 'نقدي';
                        setPaymentType(nextVal);
                        if (nextVal === 'آجل' || nextVal === 'CREDIT') {
                          setErrors((prev) => {
                            const next = { ...prev };
                            delete next.receivingCashbox;
                            delete next.paymentMethod;
                            return next;
                          });
                        }
                        markDirty();
                      }}
                      options={[
                        { value: 'نقدي', label: isAr ? 'نقدي (تحصيل فوري)' : 'Cash (Immediate)' },
                        { value: 'آجل', label: isAr ? 'آجل (ذمة العميل)' : 'Credit (On Account)' },
                      ]}
                      clearable={false}
                    />
                    </div>
                    {(paymentType === 'نقدي' || paymentType === 'CASH') && (
                      <>
                        <div id="field-payment-method">
                          <SearchableCombobox
                            label={isAr ? 'طريقة الاستلام' : 'Receiving Method'}
                            required
                            value={paymentMethod}
                            onChange={(val) => {
                              const nextMethod = val || 'CASH_HAND';
                              setPaymentMethod(nextMethod);
                              const matched = paymentMethodsList.find((pm: any) => pm.value === nextMethod);
                              if (matched?.targetAccountId && matched.targetAccountId !== 'EMPLOYEE_ASSIGNED' && matched.targetAccountId !== 'RECEIVABLE') {
                                setReceivingCashbox(matched.targetAccountId);
                                setPayingCashbox(matched.targetAccountId);
                              } else if (pageSettings.linkCashboxToEmployee && employeeName) {
                                applyEmployeeCashbox(employeeName, accountsList.length ? accountsList : availableCashboxes);
                              }
                              markDirty();
                            }}
                            options={paymentMethodsList}
                            clearable={false}
                          />
                        </div>
                        <div id="field-receiving-cashbox">
                          <SearchableCombobox
                            label={isAr ? 'صندوق استلام قيمة البيع' : 'Receiving Cashbox'}
                            required
                            value={receivingCashbox}
                            onChange={(val) => {
                              setReceivingCashbox(val);
                              setPayingCashbox(val);
                              markDirty();
                            }}
                            options={formattedCashboxesData}
                            error={errors.receivingCashbox}
                          />
                          {pageSettings.linkCashboxToEmployee && autoMatchedCashboxName && (
                            <p className="mt-1 text-[11px] text-emerald-700 font-medium">
                              {isAr
                                ? `تلقائي من صندوق الموظف: ${autoMatchedCashboxName}`
                                : `Auto from employee cashbox: ${autoMatchedCashboxName}`}
                            </p>
                          )}
                        </div>
                      </>
                    )}
                    </div>

                    {/* ── Attachments: only for methods that produce a document ── */}
                    {showAttachments && (
                      <div className="pt-3 border-t border-slate-100">
                        <TicketAttachmentsSection
                          attachments={attachments}
                          onChange={(updatedAtts) => {
                            setAttachments(updatedAtts);
                            markDirty();
                          }}
                        />
                      </div>
                    )}
                  </section>

                  <section id="field-supplier" className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-3.5 sm:p-5 space-y-3 font-sans">
                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                      <div className="w-8 h-8 rounded-full bg-violet-50 text-violet-700 border border-violet-200 flex items-center justify-center shrink-0">
                        <Building2 size={15} />
                      </div>
                      <div>
                        <h4 className="text-[15px] font-bold text-[#111827] leading-tight">
                          {isAr ? 'معلومات المورد' : 'Supplier details'}
                        </h4>
                        <p className="text-[11.5px] text-[#6B7280]">
                          {isAr ? 'المورد وشركة الطيران ورمز الحجز' : 'Supplier, airline, and PNR'}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <SearchableCombobox
                      label={isAr ? 'المورد' : 'Supplier'}
                      labelAction={
                        <button
                          type="button"
                          onClick={() =>
                            setAccountFinder({
                              open: true,
                              scope: 'SUPPLIER',
                              query: /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(supplierAccount || '')
                                ? supplierAccountName || ''
                                : supplierAccount || supplierAccountName || '',
                            })
                          }
                          title={isAr ? 'البحث في كل حسابات الموردين والعملاء' : 'Search every supplier and customer account'}
                          className="h-[18px] text-[10.5px] font-bold text-[#F45A0A] hover:text-[#dd4f05] flex items-center gap-1 cursor-pointer bg-orange-50/70 hover:bg-orange-100/80 px-1.5 rounded-md border border-orange-200/60 transition-colors leading-none"
                        >
                          <Search size={11} className="stroke-[2.5]" />
                          <span>{isAr ? 'بحث متقدّم' : 'Advanced'}</span>
                        </button>
                      }
                      value={supplierAccount}
                      onChange={(val) => {
                        setSupplierAccount(val);
                        const found = suppliersList.find((s) => s.id === val || s.code === val || s.nameAr === val || s.nameEn === val);
                        setSupplierAccountName(found ? (isAr ? found.nameAr : (found.nameEn || found.nameAr)) : val);
                        markDirty();
                      }}
                      options={formattedSuppliersData}
                      /*
                       * الحساب المختار من البحث المتقدّم قد لا يكون في قائمة الموردين
                       * أصلاً — وهذا هو سبب وجود البحث المتقدّم. والقائمة المنسدلة تعرض
                       * المعرّف الخام حين لا تجد له خياراً، فيبدو الحقل فارغاً. اسمُه
                       * المحفوظ هو ما يُعرض حينها.
                       */
                      displayValue={supplierAccountName}
                      error={errors.supplierAccount}
                    />
                    <div id="field-airline">
                      <SearchableCombobox
                        label={isAr ? 'شركة الطيران' : 'Airline'}
                        labelAction={
                          <Tooltip
                            label={isAr ? 'إدارة وإضافة شركات الطيران المسجلة في النظام' : 'Manage & Add Airlines'}
                            position="top"
                          >
                            <button
                              type="button"
                              onClick={() => setManageAirlinesModalOpened(true)}
                              className="h-[18px] text-[10.5px] font-bold text-[#F45A0A] hover:text-[#dd4f05] flex items-center gap-1 cursor-pointer bg-orange-50/70 hover:bg-orange-100/80 px-1.5 rounded-md border border-orange-200/60 transition-colors leading-none"
                            >
                              <Plus size={11} className="stroke-[2.5]" />
                              <span>{isAr ? 'إضافة / إدارة' : 'Add / Manage'}</span>
                            </button>
                          </Tooltip>
                        }
                        value={airline}
                        onChange={(val) => {
                          setAirline(val);
                          setErrors((current) => current.airline ? { ...current, airline: '' } : current);
                          markDirty();
                        }}
                        options={formattedAirlinesData}
                        error={errors.airline}
                        renderOption={(opt) => (
                          <div className="flex items-center gap-2.5 py-0.5 w-full text-xs">
                            {opt.logo ? (
                              <img
                                src={opt.logo}
                                alt={opt.nameAr || opt.value}
                                className="w-5 h-5 object-contain rounded shrink-0"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center shrink-0 text-slate-500 font-mono text-[10px] font-bold">
                                {opt.code || '✈'}
                              </div>
                            )}
                            <div className="flex items-center justify-between flex-1 min-w-0">
                              <span className="font-medium text-slate-900 truncate">{opt.label}</span>
                              {opt.code && (
                                <span className={`font-mono text-[11px] text-slate-400 font-semibold ${isAr ? 'mr-2' : 'ml-2'}`}>
                                  {opt.code}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      />
                    </div>
                    <div id="field-pnr">
                      <label className="block text-[12.5px] font-medium text-[#6B7280] mb-[7px]">
                        {isAr ? 'رمز الحجز PNR' : 'PNR Code'}
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={pnr}
                        onChange={(e) => {
                          setPnr(e.target.value.toUpperCase());
                          markDirty();
                        }}
                        placeholder="6-LETTER PNR"
                        className="w-full h-[46px] px-3.5 rounded-[11px] border border-[#E5E7EB] bg-[#FAFAFA] font-mono font-semibold text-xs text-slate-900 uppercase outline-none hover:bg-white hover:border-[#D1D5DB] focus:bg-white focus:border-[#F45A0A] focus:ring-4 focus:ring-[#F45A0A]/10 transition-all duration-150"
                      />
                    </div>
                    <div id="field-paying-cashbox">
                      <SearchableCombobox
                        label={isAr ? 'صندوق الاستلام (الدفع للمورد)' : 'Paying Cashbox (to Supplier)'}
                        value={payingCashbox}
                        onChange={(val) => {
                          setPayingCashbox(val);
                          markDirty();
                        }}
                        options={formattedCashboxesData}
                        error={errors.payingCashbox}
                      />
                    </div>
                    </div>

                    {/* ── Flight Route (full width below grid) ── */}
                    <div id="field-route" className="pt-3 border-t border-slate-100">
                      <FlightRouteSelector
                        fromAirport={fromAirport}
                        toAirport={toAirport}
                        stopovers={stopovers}
                        onChange={({ from, to, stops, fullRouteText }) => {
                          setFromAirport(from);
                          setToAirport(to);
                          setStopovers(stops);
                          setFullRouteText(fullRouteText);
                          markDirty();
                        }}
                        error={errors.route}
                      />
                    </div>
                  </section>
                </div>


              {/* ── CARD 2: PASSENGERS & TICKETS ── */}
              <div id="field-passengers-section">
                <TicketPassengersTable
                  passengers={passengers}
                  currency={currency}
                  globalPnr={pnr}
                  onChangePassengers={(updatedList) => {
                    setPassengers(updatedList);
                    markDirty();
                  }}
                  onSmartImport={handleSmartImport}
                  errors={errors}
                />
              </div>

              {/* ── CARD 3: TERMS & NOTES ONLY ── */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-5 space-y-4 font-sans">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#F45A0A] text-white font-bold text-sm flex items-center justify-center shrink-0">
                      3
                    </div>
                    <div>
                      <h3 className="font-bold text-[17px] text-[#111827] leading-tight">
                        {isAr ? 'شروط وملاحظات' : 'Terms & Notes'}
                      </h3>
                      <span className="text-[12.5px] text-[#6B7280] font-normal">
                        {isAr ? 'تدوين الشروط الخاصة وملاحظات الفاتورة' : 'Write specific ticket terms and invoice remarks'}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11.5px] text-slate-400 font-normal">
                    {isAr ? 'تظهر في الطباعة' : 'Printed on invoice'}
                  </span>
                </div>

                <Textarea
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    markDirty();
                  }}
                  placeholder={isAr ? 'اكتب أي شروط خاصة بالتذكرة وسياسة الاسترجاع والتعديل...' : 'Enter ticket terms, refund policy, and remarks...'}
                  radius="md"
                  styles={{
                    input: {
                      minHeight: 140,
                      fontSize: 13,
                      borderRadius: 9,
                      borderColor: '#E2E6EA',
                      backgroundColor: '#FAFAFA',
                      padding: 12,
                      fontFamily: 'inherit',
                      lineHeight: 1.6,
                    },
                  }}
                />
              </div>

            </div>

            {/* ── STICKY SIDEBAR (360px Width) ── */}
            <div className="xl:sticky xl:top-4">
              <TicketFinancialSummary
                invoiceNumber={invoiceNumber}
                status={status}
                airline={airline}
                airlineLogo={selectedAirlineItem?.logo}
                fromAirport={fromAirport}
                toAirport={toAirport}
                travelDate={travelDate}
                pnr={pnr}
                passengersCount={passengers.length}
                passengersNamedCount={passengersNamedCount}
                totalBuy={totalBuy}
                totalSell={totalSell}
                totalTaxesBuy={totalTaxesBuy}
                totalTaxesSell={totalTaxesSell}
                totalCharges={totalCharges}
                discountAmount={discountAmount}
                currency={currency}
                paymentType={paymentType}
                supplierAccountName={supplierAccountName}
                customerName={customerName}
                completionPercentage={completionData.completionPercentage}
                isComplete={completionData.isComplete}
                completedCount={completionData.completedCount}
                totalCount={completionData.totalCount}
                missingRequirements={completionData.missingRequirements}
                onNavigateToField={handleNavigateToField}
              />
            </div>

          </div>

        </div>
      </main>

      {/* ── 3. FIXED BOTTOM ACTIONS BAR (Responsive Height & Touch Buttons) ── */}
      <footer className="min-h-[58px] sm:h-[60px] bg-white border-t border-[#E5E7EB] px-3 sm:px-6 py-2 sm:py-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-4 shrink-0 shadow-2xs z-20 font-sans">
        {/* Leading info */}
        <div className="flex items-center justify-between sm:justify-start gap-3 sm:gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-slate-600 font-medium text-xs sm:text-sm">
              {isAr ? 'صافي الفاتورة:' : 'Net Total:'}
            </span>
            <span className="font-mono font-black text-sm sm:text-[16px] text-slate-900" dir="ltr">
              {formatAmount(Math.max(0, totalSell - discountAmount))}
            </span>
          </div>

          <span className="text-slate-300 hidden md:inline">|</span>

          <div className="hidden md:flex items-center gap-2 text-slate-400 text-[11.5px]">
            <span>{isAr ? 'Ctrl+S: حفظ مسودة' : 'Ctrl+S: Save Draft'}</span>
            <span>•</span>
            <span>{isAr ? 'Ctrl+Enter: اعتماد' : 'Ctrl+Enter: Post'}</span>
          </div>
        </div>

        {/* Trailing Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 w-full sm:w-auto">
          <Button
            size="xs"
            variant="subtle"
            color="gray"
            radius="md"
            onClick={handleRequestClose}
            className="font-medium text-xs text-slate-600 hover:text-slate-900 h-9 px-2 sm:px-3 cursor-pointer shrink-0"
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </Button>

          <Button
            size="xs"
            variant="default"
            radius="md"
            leftSection={<Save size={14} />}
            onClick={() => saveMutation.mutate('DRAFT')}
            loading={saveMutation.isPending}
            className="flex-1 sm:flex-initial font-semibold text-xs border-slate-300 text-slate-800 hover:bg-slate-50 h-9 px-3 sm:px-4 rounded-[8px] cursor-pointer whitespace-nowrap"
          >
            {isAr ? 'حفظ كمسودة' : 'Draft'}
          </Button>

          <Button
            size="xs"
            color="orange"
            variant="filled"
            radius="md"
            leftSection={<Check size={15} />}
            onClick={() => saveMutation.mutate('POSTED')}
            loading={saveMutation.isPending}
            className="flex-1 sm:flex-initial bg-[#F45A0A] hover:bg-orange-600 font-bold text-xs text-white shadow-xs cursor-pointer h-9 px-4 sm:px-5 rounded-[8px] whitespace-nowrap"
          >
            {isAr ? 'اعتماد وترحيل' : 'Post'}
          </Button>
        </div>
      </footer>

      {/* ── MODALS: AUDIT LOG, CANCEL, EXIT CONFIRM, CURRENCY SWITCH ── */}
      <Modal
        opened={pageSettingsOpen}
        onClose={() => setPageSettingsOpen(false)}
        size="520px"
        padding="md"
        radius="lg"
        centered
        dir={direction}
        title={
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <Settings size={18} className="text-orange-600" />
            <span>{isAr ? 'إعدادات صفحة التذاكر' : 'Ticket page settings'}</span>
          </div>
        }
      >
        <div className="space-y-4 font-sans text-xs">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-600 leading-relaxed">
            {isAr
              ? 'تُحفظ هذه الخيارات على هذا الجهاز وتُطبَّق تلقائياً عند إنشاء فاتورة تذاكر جديدة.'
              : 'These options are saved on this device and applied automatically when creating a new ticket invoice.'}
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1.5">
              {isAr ? 'العملة الافتراضية' : 'Default currency'}
            </label>
            <div className="h-9 flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-300 gap-1">
              <button
                type="button"
                onClick={() => setDraftPageSettings((s) => ({ ...s, defaultCurrency: 'USD' }))}
                className={`flex-1 h-full rounded-md text-xs font-bold transition-all cursor-pointer ${
                  draftPageSettings.defaultCurrency === 'USD' ? 'bg-[#F45A0A] text-white shadow-2xs' : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                $ USD
              </button>
              <button
                type="button"
                onClick={() => setDraftPageSettings((s) => ({ ...s, defaultCurrency: 'IQD' }))}
                className={`flex-1 h-full rounded-md text-xs font-bold transition-all cursor-pointer ${
                  draftPageSettings.defaultCurrency === 'IQD' ? 'bg-[#F45A0A] text-white shadow-2xs' : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                IQD
              </button>
            </div>
          </div>

          <SearchableCombobox
            label={isAr ? 'العميل الافتراضي' : 'Default customer'}
            value={draftPageSettings.defaultCustomerId || draftPageSettings.defaultCustomerName}
            onChange={(val) => {
              const found = allCustomerCandidates.find(
                (c) => c.id === val || c.accountId === val || c.code === val || c.nameAr === val || c.nameEn === val || c.name === val,
              );
              setDraftPageSettings((s) => ({
                ...s,
                defaultCustomerId: found?.id || found?.accountId || '',
                defaultCustomerName: found ? customerDisplayName(found, isAr) : (val || 'مسافر كاش'),
              }));
            }}
            options={formattedCustomersData}
            allowCustomValue
          />

          <SearchableCombobox
            label={isAr ? 'نوع البيع الافتراضي' : 'Default sale type'}
            value={draftPageSettings.defaultPaymentType}
            onChange={(val) => setDraftPageSettings((s) => ({ ...s, defaultPaymentType: (val === 'آجل' ? 'آجل' : 'نقدي') }))}
            options={[
              { value: 'نقدي', label: isAr ? 'نقدي (تحصيل فوري)' : 'Cash (Immediate)' },
              { value: 'آجل', label: isAr ? 'آجل (ذمة العميل)' : 'Credit (On Account)' },
            ]}
            clearable={false}
          />

          <SearchableCombobox
            label={isAr ? 'طريقة الاستلام الافتراضية' : 'Default receiving method'}
            value={draftPageSettings.defaultPaymentMethod}
            onChange={(val) => setDraftPageSettings((s) => ({ ...s, defaultPaymentMethod: val || 'CASH_HAND' }))}
            options={paymentMethodsList}
            clearable={false}
          />

          <Switch
            checked={draftPageSettings.linkCashboxToEmployee}
            onChange={(e) => setDraftPageSettings((s) => ({ ...s, linkCashboxToEmployee: e.currentTarget.checked }))}
            label={isAr ? 'ربط صندوق الاستلام بحساب الموظف' : 'Link receiving cashbox to the issuing employee'}
            description={isAr ? 'عند اختيار موظف الإصدار يُعبَّأ صندوقه تلقائياً' : 'Selecting the issuing employee fills their assigned cashbox'}
            color="orange"
            size="sm"
          />

          <Switch
            checked={draftPageSettings.datesDefaultToday}
            onChange={(e) => setDraftPageSettings((s) => ({ ...s, datesDefaultToday: e.currentTarget.checked }))}
            label={isAr ? 'تاريخ الإصدار وتاريخ السفر = اليوم' : 'Issue date and travel date default to today'}
            color="orange"
            size="sm"
          />

          <Switch
            checked={draftPageSettings.entryDateIncludesTime}
            onChange={(e) => setDraftPageSettings((s) => ({ ...s, entryDateIncludesTime: e.currentTarget.checked }))}
            label={isAr ? 'تاريخ الإدخال يشمل الوقت' : 'Entry date includes time'}
            description={isAr ? 'يعرض حقل الوقت بجانب تاريخ الإدخال' : 'Shows a time field next to the entry date'}
            color="orange"
            size="sm"
          />

          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <Button size="xs" variant="default" radius="md" onClick={() => setPageSettingsOpen(false)}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              size="xs"
              color="orange"
              radius="md"
              onClick={() => {
                saveTicketPageSettings(draftPageSettings, user?.companyId, 'tickets');
                setPageSettings(draftPageSettings);
                applyPageSettingsToForm(draftPageSettings);
                setPageSettingsOpen(false);
                showSuccessNotification(
                  isAr ? 'تم حفظ إعدادات الصفحة' : 'Page settings saved',
                  isAr ? 'ستُطبَّق هذه الإعدادات على فواتير التذاكر الجديدة وعلى المسودة الحالية.' : 'These defaults apply to new ticket invoices and the current draft.',
                );
              }}
              className="bg-[#F45A0A] hover:bg-orange-600 font-bold"
            >
              {isAr ? 'حفظ وتطبيق' : 'Save and apply'}
            </Button>
          </div>
        </div>
      </Modal>

      <CurrencySwitchModal
        opened={currencySwitchModalOpen}
        onClose={() => setCurrencySwitchModalOpen(false)}
        currentCurrency={currency}
        targetCurrency={pendingCurrency}
        exchangeRate={activeExchangeRate}
        totalSell={totalSell}
        onConfirmConvert={handleConfirmCurrencyConvert}
        onConfirmReset={handleConfirmCurrencyReset}
      />

      <InvoiceAuditLogModal
        opened={auditLogOpen}
        onClose={() => setAuditLogOpen(false)}
        ticketNumber={invoiceNumber}
        pnr={pnr}
        customerName={customerName}
      />

      <Modal
        opened={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title={<span className="font-semibold text-sm text-red-600">{isAr ? 'إلغاء الفاتورة' : 'Cancel Invoice'}</span>}
        size="md"
        radius="lg"
        dir={direction}
        centered
      >
        <div className="space-y-3 text-xs font-sans">
          <p className="text-slate-700 font-normal">
            {isAr ? 'سيتم إلغاء الفاتورة وتسجيل السبب في سجل التدقيق:' : 'The invoice will be marked as cancelled in the audit log:'}
          </p>

          <Textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder={isAr ? 'اكتب سبب إلغاء الفاتورة...' : 'Enter cancellation reason...'}
            minRows={3}
            radius="md"
            styles={{ input: { fontSize: 12 } }}
          />

      <DeleteInvoiceModal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        invoiceNumber={invoiceNumber}
        docLabel={isAr ? 'فاتورة التذكرة' : 'ticket invoice'}
        isArabic={isAr}
        posted={status === 'POSTED'}
        onConfirm={() => deleteMutation.mutateAsync()}
      />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button size="xs" variant="default" radius="md" onClick={() => setCancelModalOpen(false)}>
              {isAr ? 'تراجع' : 'Back'}
            </Button>
            <Button
              size="xs"
              color="red"
              variant="filled"
              radius="md"
              onClick={() => cancelMutation.mutate()}
              loading={cancelMutation.isPending}
              className="bg-red-600 hover:bg-red-700 font-semibold text-white cursor-pointer"
            >
              {isAr ? 'تأكيد الإلغاء' : 'Confirm Cancel'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── UNSAVED CHANGES SAFETY MODAL ── */}
      <UnsavedChangesModal
        opened={confirmExitOpen}
        isSaving={saveMutation.isPending}
        saveError={
          saveMutation.isError
            ? (saveMutation.error as any)?.message || (isAr ? 'تعذر حفظ التعديلات. تحقق من الاتصال وحاول مرة أخرى.' : 'Could not save changes. Please try again.')
            : null
        }
        onContinueEditing={handleContinueEditing}
        onSaveAndExit={handleSaveAndExit}
        onDiscardAndExit={handleDiscardAndExit}
      />
    
            {/* Manage & Add Airlines Modal */}
      <ManageAirlinesModal
        opened={manageAirlinesModalOpened}
        onClose={() => setManageAirlinesModalOpened(false)}
        onSelectAirline={(airlineName, airlineItem) => {
          setAirline(airlineItem?.id || airlineName);
          setErrors((current) => ({ ...current, airline: '' }));
          markDirty();
        }}
      />

      {/*
        * البحث المتقدّم في كل الحسابات.
        *
        * ما يُختار هنا يُكتب في الحقل بمعرّف حسابه واسمه معاً، فيرتبط القيدُ
        * بالحساب الصحيح ولو لم يكن مسجَّلاً في قائمة الموردين أو العملاء.
        */}
      <AccountFinderModal
        opened={accountFinder.open}
        initialQuery={accountFinder.query}
        initialScope={accountFinder.scope}
        onClose={() => setAccountFinder((prev) => ({ ...prev, open: false }))}
        onSelect={(account: AccountFinderResult) => {
          if (accountFinder.scope === 'SUPPLIER') {
            setSupplierAccount(account.id);
            setSupplierAccountName(account.name);
            setErrors((current) => (current.supplierAccount ? { ...current, supplierAccount: '' } : current));
          } else {
            setCustomerName(account.name);
            setErrors((current) => (current.customerName ? { ...current, customerName: '' } : current));
          }
          markDirty();
        }}
      />

      {/* Account Reconciliation Modal (Exact similarity matching for Supplier & Customer like Visas) */}
      <AccountReconciliationModal
        opened={reconciliationModalOpen}
        onClose={() => setReconciliationModalOpen(false)}
        unmatchedCustomer={unmatchedCustomerData}
        unmatchedSupplier={unmatchedSupplierData}
        onApplyMatches={handleApplyReconciliationMatches}
      />
</div>
  );
};

export default TicketInvoiceEditorWorkspace;
