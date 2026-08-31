import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Button,
  Select,
  SelectProps,
  Tooltip,
  ActionIcon,
  Menu,
  Modal,
  Textarea,
  Badge,
  Switch,
} from '@mantine/core';
import {
  FileCheck2,
  Check,
  Printer,
  Save,
  ArrowRight,
  ArrowLeft,
  History,
  MoreVertical,
  Settings,
  AlertCircle,
  FileText,
  Sparkles,
  User,
  Building2,
  Search,
  Plus,
  Trash2,
  Globe,
  UsersRound,
  IdCard,
  CreditCard,
  Percent,
  Wallet,
  ShieldCheck,
  Zap,
  X,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { VisaFinancialSummary } from './VisaFinancialSummary';
import { SmartVisaImportModal } from './SmartVisaImportModal';
import { VisaTypesManagerModal, type VisaTypeRecord, normalizeArabicNumbers } from './VisaTypesManagerModal';
import { AccountReconciliationModal, type UnmatchedPartyData } from '../common/AccountReconciliationModal';
import { findSimilarAccounts } from '../../utils/accountSimilarity';

import { CountryFlagImage, resolveCountryCode } from '../ui/CountryFlagImage';
import { type VisaPassengerItem, PREDEFINED_VISA_TYPES } from './VisaIssueModal';
import { TicketAttachmentsSection, AttachmentItem } from '../tickets/TicketAttachmentsSection';
import { InvoiceAuditLogModal } from '../tickets/InvoiceAuditLogModal';
import { CurrencySwitchModal } from '../tickets/CurrencySwitchModal';
import { UnsavedChangesModal } from '../tickets/UnsavedChangesModal';
import { SearchableCombobox } from '../ui/SearchableCombobox';
import { CurrencySegmentedControl } from '../ui/CurrencySegmentedControl';
import { SegmentedDatePicker } from '../ui/SegmentedDatePicker';
import { DateTimeField } from '../ui/DateTimeField';
import {
  TicketPageSettings,
  DEFAULT_TICKET_PAGE_SETTINGS,
  loadTicketPageSettings,
  saveTicketPageSettings,
  findDefaultCashCustomer,
  customerDisplayName,
} from '../../utils/ticketPageSettings';
import { partnersApi, Customer, Supplier } from '../../api/partners';
import { accountsApi } from '../../api/accounts';
import { employeesApi } from '../../api/employees';
import { ticketsApi } from '../../api/tickets';
import { fetchPrintTemplate, savePrintTemplate } from '../../api/printTemplates';
import { showSuccessNotification, showErrorNotification, showInfoNotification } from '../../utils/notifications';
import { getNextSequenceNumber } from '../../utils/sequenceUtils';
import { formatCurrency } from '../../utils/currencyUtils';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguageStore } from '../../store/useLanguageStore';
import { useAdoptedExchangeRate } from '../../hooks/useAdoptedExchangeRate';
import { Lottie } from 'lottie-react';
import visaAnimation from '../../assets/animations/visa.json';

export interface VisaPassengerLine {
  id: string;
  name: string;
  passportNumber: string;
  visaType: string;
  orderNumber?: string;
  status: 'Issued' | 'NotIssued';
  fareBuy: number | null;
  fareSell: number | null;
  notes?: string;
}

// ── Comma Formatter for Monetary Inputs ──
export const formatDisplayWithCommas = (val: string | number | null | undefined): string => {
  if (val === null || val === undefined || val === '') return '';
  const str = String(val).replace(/,/g, '');
  if (isNaN(Number(str))) return String(val);
  const parts = str.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
};

interface VisaInvoiceEditorWorkspaceProps {
  opened: boolean;
  onClose: () => void;
  initialData?: any;
  onSuccess?: (savedVisa: any) => void;
}

export const VisaInvoiceEditorWorkspace: React.FC<VisaInvoiceEditorWorkspaceProps> = ({
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

  // ── 1. REAL SUPABASE DATABASE: Fetch Real Visa Destinations / Types Catalog with Preset Pricing ──
  const { data: dbVisaRecords = [] } = useQuery<VisaTypeRecord[]>({
    queryKey: ['visa-types-catalog-full'],
    queryFn: async () => {
      try {
        const res = await fetchPrintTemplate('visa_types_catalog');
        if (res && res.config) {
          if (Array.isArray(res.config.items)) {
            return res.config.items.map((i: any) => ({
              ...i,
              defaultBuyPrice: i.defaultBuyPrice !== undefined && i.defaultBuyPrice !== null ? Number(i.defaultBuyPrice) : null,
              defaultSellPrice: i.defaultSellPrice !== undefined && i.defaultSellPrice !== null ? Number(i.defaultSellPrice) : null,
              defaultCurrency: i.defaultCurrency || 'USD',
            }));
          }
          if (Array.isArray(res.config.types)) {
            return res.config.types.map((nameStr: any, idx: number) => ({
              id: `vt-${idx + 1}`,
              name: String(nameStr),
              countryCode: resolveCountryCode(String(nameStr)) || undefined,
              defaultBuyPrice: null,
              defaultSellPrice: null,
              defaultCurrency: 'USD',
            }));
          }
        }
      } catch (e) {
        console.warn('Failed to fetch visa_types_catalog from Supabase database:', e);
      }
      return [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const visaCatalogMap = useMemo(() => {
    const map = new Map<string, VisaTypeRecord>();
    dbVisaRecords.forEach((r) => {
      if (r.name) map.set(r.name.trim().toLowerCase(), r);
    });
    return map;
  }, [dbVisaRecords]);

  const availableVisaTypes = useMemo(() => {
    return dbVisaRecords.map((r) => r.name).filter(Boolean);
  }, [dbVisaRecords]);

  const [newVisaTypeModalOpen, setNewVisaTypeModalOpen] = useState<boolean>(false);

  // Invoice State (Simplified Core Business Fields)
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [issueDate, setIssueDate] = useState<Date>(new Date());
  const [customerName, setCustomerName] = useState<string>('');
  const [supplierAccount, setSupplierAccount] = useState<string>('');
  const [supplierAccountName, setSupplierAccountName] = useState<string>('');
  const [visaDestination, setVisaDestination] = useState<string>('');
  const [employeeName, setEmployeeName] = useState<string>('');
  const [entryEmployee, setEntryEmployee] = useState<string>('');
  const [currency, setCurrency] = useState<string>('USD');
  const [exchangeRate, setExchangeRate] = useState<number>(0);
  const [paymentType, setPaymentType] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [receivingCashbox, setReceivingCashbox] = useState<string>('');
  const [payingCashbox, setPayingCashbox] = useState<string>('');
  const [entryDate, setEntryDate] = useState<Date>(new Date());
  const [reference, setReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [status, setStatus] = useState<string>('DRAFT');
  const [discountAmount, setDiscountAmount] = useState<number>(0);

  // Advanced Operation / Transaction Type (إصدار / استرجاع / تغيير / إعادة إصدار / كروبات)
  const [operationType, setOperationType] = useState<'ISSUE' | 'REFUND' | 'CHANGE' | 'REISSUE' | 'GROUP'>('ISSUE');
  const [groupName, setGroupName] = useState<string>('');
  const [groupCode, setGroupCode] = useState<string>('');
  const [refundPenalty, setRefundPenalty] = useState<string>('0');
  const [changeFee, setChangeFee] = useState<string>('0');

  // Batch Pricing State
  const [batchVisaType, setBatchVisaType] = useState<string>('');
  const [batchBuy, setBatchBuy] = useState<string>('');
  const [batchSell, setBatchSell] = useState<string>('');
  const [batchStatus, setBatchStatus] = useState<'Issued' | 'NotIssued'>('NotIssued');

  // Passengers State (Streamlined: Name, Passport, Visa Type, Order #, Buy, Sell, Profit, Status)
  const [passengers, setPassengers] = useState<VisaPassengerLine[]>([
    {
      id: `p-${Date.now()}`,
      name: '',
      passportNumber: '',
      visaType: '',
      orderNumber: '',
      status: 'NotIssued',
      fareBuy: null,
      fareSell: null,
      notes: '',
    },
  ]);

  // Clean structured options guaranteeing every active visa type exists in data
  const visaTypeOptions = useMemo(() => {
    const set = new Set<string>();
    if (Array.isArray(availableVisaTypes)) {
      availableVisaTypes.forEach((t) => t && set.add(t.trim()));
    }
    if (Array.isArray(PREDEFINED_VISA_TYPES)) {
      PREDEFINED_VISA_TYPES.forEach((t) => t && set.add(t.trim()));
    }
    if (Array.isArray(passengers)) {
      passengers.forEach((p) => p.visaType && set.add(p.visaType.trim()));
    }
    if (batchVisaType) set.add(batchVisaType.trim());
    if (visaDestination) set.add(visaDestination.trim());

    return Array.from(set)
      .filter(Boolean)
      .map((t) => ({
        value: t,
        label: t,
      }));
  }, [availableVisaTypes, passengers, batchVisaType, visaDestination]);

  // Render option with crisp country flag image
  const renderVisaTypeOption: SelectProps['renderOption'] = ({ option, checked }) => (
    <div className="flex items-center gap-2.5 py-1 w-full whitespace-nowrap">
      <CountryFlagImage countryCode={resolveCountryCode(option.value) || undefined} name={option.value} size="sm" />
      <span className="text-xs font-bold text-slate-900 flex-1 truncate">{option.label}</span>
      {checked && <Check size={14} className="text-[#F45A0A] shrink-0" />}
    </div>
  );

  // Attachments State
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);

  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submittingAction, setSubmittingAction] = useState<'DRAFT' | 'POSTED' | null>(null);

  // Modals State
  const [currencySwitchModalOpen, setCurrencySwitchModalOpen] = useState<boolean>(false);
  const [pendingCurrency, setPendingCurrency] = useState<string>('');
  const [auditLogOpen, setAuditLogOpen] = useState<boolean>(false);
  const [smartImportOpen, setSmartImportOpen] = useState<boolean>(false);
  const [confirmExitOpen, setConfirmExitOpen] = useState<boolean>(false);

  // Per-employee page defaults, stored under their own key so visa defaults
  // (often IQD) never overwrite the ticket editor's (often USD).
  const [pageSettings, setPageSettings] = useState<TicketPageSettings>(() =>
    loadTicketPageSettings(undefined, 'visas'),
  );
  const [pageSettingsOpen, setPageSettingsOpen] = useState<boolean>(false);
  const [draftPageSettings, setDraftPageSettings] = useState<TicketPageSettings>(
    DEFAULT_TICKET_PAGE_SETTINGS,
  );

  // Reconciliation Modal for Unmatched Customer / Supplier
  const [reconciliationModalOpen, setReconciliationModalOpen] = useState<boolean>(false);
  const [unmatchedCustomerData, setUnmatchedCustomerData] = useState<UnmatchedPartyData | null>(null);
  const [unmatchedSupplierData, setUnmatchedSupplierData] = useState<UnmatchedPartyData | null>(null);
  const [pendingImportData, setPendingImportData] = useState<{
    passengers: VisaPassengerItem[];
    meta?: any;
  } | null>(null);

  // Mark dirty
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
    queryFn: () => accountsApi.getFlat(),
    staleTime: 5 * 60 * 1000,
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

  const employeesList: any[] = useMemo(() => {
    return (employeesData as any)?.data || (employeesData as any) || [];
  }, [employeesData]);

  // Available cashboxes & bank accounts (Comprehensive & Validated from Database)
  const availableCashboxes = useMemo(() => {
    if (!Array.isArray(accountsList)) return [];
    return accountsList.filter((acc: any) => {
      if (acc.isGroup || acc.isParent) return false;
      const category = (acc.category || '').toUpperCase();
      if (category === 'CUSTOMER' || category === 'SUPPLIER') return false;
      const type = (acc.type || acc.accountType || '').toUpperCase();
      const code = String(acc.code || '');
      const name = (acc.nameAr || acc.nameEn || acc.name || '').toLowerCase();
      return (
        category === 'CASH' ||
        category === 'BANK' ||
        category === 'TREASURY' ||
        type === 'CASH' ||
        type === 'BANK' ||
        type === 'TREASURY' ||
        code.startsWith('181') ||
        code.startsWith('101') ||
        code.startsWith('102') ||
        name.includes('صندوق') ||
        name.includes('بنك') ||
        name.includes('مصرف') ||
        name.includes('كاش') ||
        name.includes('خزينة') ||
        name.includes('بورصة') ||
        name.includes('قاصة') ||
        acc.isCashbox === true
      );
    });
  }, [accountsList]);

  // Formatted Combobox Data & Candidate Pools (Comprehensive from DB & Chart of Accounts)
  const allCustomerCandidates = useMemo(() => {
    const list: any[] = [...customersList];
    const seen = new Set(list.map((c) => c.id || c.nameAr || c.code));

    if (Array.isArray(accountsList)) {
      accountsList.forEach((acc) => {
        const id = acc.id || acc.code;
        if (!seen.has(id)) {
          seen.add(id);
          list.push({
            id: acc.id,
            accountId: acc.id,
            source: 'account',
            code: acc.code,
            nameAr: acc.nameAr || acc.name || '',
            nameEn: acc.nameEn || '',
            name: acc.nameAr || acc.name || '',
            type: acc.type,
            category: acc.category,
          });
        }
      });
    }

    if (Array.isArray(suppliersList)) {
      suppliersList.forEach((s) => {
        const id = s.id || s.nameAr || s.code;
        if (!seen.has(id)) {
          seen.add(id);
          list.push(s);
        }
      });
    }

    return list;
  }, [customersList, accountsList, suppliersList]);

  const allSupplierCandidates = useMemo(() => {
    const list: any[] = [...suppliersList];
    const seen = new Set(list.map((s) => s.id || s.nameAr || s.code));

    if (Array.isArray(accountsList)) {
      accountsList.forEach((acc) => {
        const id = acc.id || acc.code;
        if (!seen.has(id)) {
          seen.add(id);
          list.push({
            id: acc.id,
            accountId: acc.id,
            source: 'account',
            code: acc.code,
            nameAr: acc.nameAr || acc.name || '',
            nameEn: acc.nameEn || '',
            name: acc.nameAr || acc.name || '',
            type: acc.type,
            category: acc.category,
          });
        }
      });
    }

    if (Array.isArray(customersList)) {
      customersList.forEach((c) => {
        const id = c.id || c.nameAr || c.code;
        if (!seen.has(id)) {
          seen.add(id);
          list.push(c);
        }
      });
    }

    return list;
  }, [suppliersList, accountsList, customersList]);

  const formattedCustomersData = useMemo(() => {
    const map = new Map<string, any>();
    customersList
      .filter((c: any) => c.isActive !== false && !c.isBlocked && c.overduePolicy !== 'BLOCK')
      .forEach((c) => {
        const cleanName = (isAr ? c.nameAr : (c.nameEn || c.nameAr)) || c.nameAr || (c as any).name || c.code || '';
        map.set(c.id || cleanName, {
          value: c.id || cleanName,
          label: cleanName,
          nameAr: c.nameAr,
          nameEn: c.nameEn,
          id: c.id,
          code: c.code,
          phone: c.phone || undefined,
        });
      });

    if (Array.isArray(accountsList)) {
      accountsList.forEach((acc) => {
        if (acc.isGroup || acc.isParent) return;
        if (acc.isBlocked || acc.isActive === false || acc.overduePolicy === 'BLOCK') return;

        const cleanName = (isAr ? acc.nameAr : (acc.nameEn || acc.nameAr)) || acc.nameAr || acc.name || acc.code || '';
        const code = String(acc.code || '');
        const type = (acc.type || '').toUpperCase();
        const category = (acc.category || '').toUpperCase();
        const role = (acc as any).accountRole || '';

        if (
          category === 'CUSTOMER' ||
          role === 'CUSTOMER' ||
          role === 'BOTH' ||
          code.startsWith('1614') ||
          code.startsWith('132') ||
          code.startsWith('14') ||
          type.includes('CUSTOMER') ||
          type.includes('RECEIVABLE')
        ) {
          if (!map.has(acc.id)) {
            map.set(acc.id, {
              value: acc.id,
              label: cleanName,
              nameAr: acc.nameAr,
              nameEn: acc.nameEn,
              id: acc.id,
              code: acc.code,
            });
          }
        }
      });
    }

    return Array.from(map.values());
  }, [customersList, accountsList, isAr]);

  const formattedSuppliersData = useMemo(() => {
    const map = new Map<string, any>();
    suppliersList
      .filter((s: any) => s.isActive !== false && !s.isBlocked && s.overduePolicy !== 'BLOCK')
      .forEach((s) => {
        const cleanName = (isAr ? s.nameAr : (s.nameEn || s.nameAr)) || s.nameAr || (s as any).name || s.code || '';
        map.set(s.id || cleanName, {
          value: s.id || cleanName,
          label: cleanName,
          nameAr: s.nameAr,
          nameEn: s.nameEn,
          id: s.id,
          code: s.code,
          phone: s.phone || undefined,
        });
      });

    if (Array.isArray(accountsList)) {
      accountsList.forEach((acc) => {
        if (acc.isGroup || acc.isParent) return;
        if (acc.isBlocked || acc.isActive === false || acc.overduePolicy === 'BLOCK') return;

        const cleanName = (isAr ? acc.nameAr : (acc.nameEn || acc.nameAr)) || acc.nameAr || acc.name || acc.code || '';
        const code = String(acc.code || '');
        const type = (acc.type || '').toUpperCase();
        const category = (acc.category || '').toUpperCase();
        const role = (acc as any).accountRole || '';

        if (
          category === 'SUPPLIER' ||
          role === 'SUPPLIER' ||
          role === 'BOTH' ||
          code.startsWith('2614') ||
          code.startsWith('23') ||
          code.startsWith('134') ||
          code.startsWith('10') ||
          type.includes('SUPPLIER') ||
          type.includes('BANK') ||
          type.includes('PAYABLE') ||
          type.includes('EXPENSE') ||
          cleanName.includes('ماستر') ||
          cleanName.includes('طيران') ||
          cleanName.includes('فيزا') ||
          cleanName.includes('تأشيرة') ||
          cleanName.includes('فلاي')
        ) {
          if (!map.has(acc.id)) {
            map.set(acc.id, {
              value: acc.id,
              label: cleanName,
              nameAr: acc.nameAr,
              nameEn: acc.nameEn,
              id: acc.id,
              code: acc.code,
            });
          }
        }
      });
    }

    return Array.from(map.values());
  }, [suppliersList, accountsList, isAr]);

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

    // Default dynamic fallbacks based on real database accounts
    const initialList: any[] = [
      { value: 'CASH_HAND', label: isAr ? 'كاش باليد (نقدي)' : 'Cash in Hand', targetAccountId: 'EMPLOYEE_ASSIGNED' },
    ];

    if (Array.isArray(accountsList)) {
      accountsList.forEach((acc: any) => {
        const accName = acc.nameAr || acc.name || '';
        const accCode = String(acc.code || '');
        const accType = (acc.type || '').toUpperCase();
        const accCat = (acc.category || '').toUpperCase();

        if (
          accType === 'BANK' ||
          accType === 'TREASURY' ||
          accCat === 'BANK' ||
          accName.includes('ماستر') ||
          accName.includes('Master') ||
          accName.includes('زين كاش') ||
          accName.includes('Zain') ||
          accName.includes('FIB') ||
          accName.includes('كي كارد') ||
          accName.includes('Qi') ||
          accName.includes('مصرف') ||
          accName.includes('بنك')
        ) {
          initialList.push({
            value: acc.id,
            label: `${accName} (${accCode})`,
            targetAccountId: acc.id,
            targetAccountName: accName,
            type: accType,
          });
        }
      });
    }

    initialList.push({
      value: 'CREDIT',
      label: isAr ? 'آجل (على الحساب)' : 'Credit (On Account)',
      targetAccountId: 'RECEIVABLE',
    });

    return initialList;
  }, [paymentMethodsConfig, accountsList, isAr]);

  // Robust Cashbox Options ensuring every account (including payment method targets and selected IDs) has a human label
  const cashboxOptions = useMemo(() => {
    const listMap = new Map<string, any>();
    availableCashboxes.forEach((c: any) => {
      if (c && c.id) listMap.set(c.id, c);
    });
    if (Array.isArray(accountsList)) {
      accountsList.forEach((acc: any) => {
        if (
          acc &&
          (acc.id === receivingCashbox ||
            acc.id === payingCashbox ||
            acc.code === receivingCashbox ||
            acc.code === payingCashbox)
        ) {
          listMap.set(acc.id, acc);
        }
      });
    }
    if (Array.isArray(paymentMethodsList)) {
      paymentMethodsList.forEach((pm: any) => {
        if (pm.targetAccountId && pm.targetAccountId !== 'EMPLOYEE_ASSIGNED' && pm.targetAccountId !== 'RECEIVABLE') {
          const acc = accountsList.find((a: any) => a.id === pm.targetAccountId || a.code === pm.targetAccountId);
          if (acc) {
            listMap.set(acc.id, acc);
          } else if (pm.targetAccountName) {
            listMap.set(pm.targetAccountId, {
              id: pm.targetAccountId,
              nameAr: pm.targetAccountName,
              nameEn: pm.targetAccountName,
              code: '',
            });
          }
        }
      });
    }

    return Array.from(listMap.values()).map((c) => ({
      value: c.id,
      label: isAr ? (c.nameAr || c.name || '') : (c.nameEn || c.nameAr || c.name || ''),
      code: c.code,
    }));
  }, [availableCashboxes, accountsList, paymentMethodsList, receivingCashbox, payingCashbox, isAr]);

  // Track if current customer/supplier text is not yet registered in database
  const isCustomerUnsaved = useMemo(() => {
    if (!customerName || customerName === 'عميل نقدي عام' || customerName === 'نقدي') return false;
    return !allCustomerCandidates.some(
      (c) =>
        c.nameAr?.trim().toLowerCase() === customerName.trim().toLowerCase() ||
        c.nameEn?.trim().toLowerCase() === customerName.trim().toLowerCase() ||
        (c as any).name?.trim().toLowerCase() === customerName.trim().toLowerCase() ||
        c.code === customerName ||
        c.id === customerName
    );
  }, [customerName, allCustomerCandidates]);

  const isSupplierUnsaved = useMemo(() => {
    const val = (supplierAccountName || supplierAccount || '').trim();
    if (!val || val === 'مزود تأشيرات' || val === 'نقدي') return false;
    return !allSupplierCandidates.some(
      (s) =>
        s.nameAr?.trim().toLowerCase() === val.toLowerCase() ||
        s.nameEn?.trim().toLowerCase() === val.toLowerCase() ||
        (s as any).name?.trim().toLowerCase() === val.toLowerCase() ||
        s.code === val ||
        s.id === val
    );
  }, [supplierAccountName, supplierAccount, allSupplierCandidates]);


  // Helper: Automatically match & set employee's assigned cashbox
  const applyEmployeeCashbox = useCallback((selectedEmpName: string, availableBoxes: any[]) => {
    if (!selectedEmpName || availableBoxes.length === 0) return;

    const emp = employeesList.find(
      (e: any) =>
        e.fullName === selectedEmpName ||
        e.name === selectedEmpName ||
        e.username === selectedEmpName ||
        e.email === selectedEmpName,
    );

    let targetCashbox: any = null;

    if (emp?.assignedCashbox) {
      targetCashbox = availableBoxes.find(
        (c: any) =>
          c.id === emp.assignedCashbox ||
          c.code === emp.assignedCashbox ||
          c.nameAr === emp.assignedCashbox ||
          c.name === emp.assignedCashbox ||
          (c.nameAr || c.name || '').toLowerCase().includes(emp.assignedCashbox.toLowerCase()),
      );
    }

    if (!targetCashbox) {
      const firstName = selectedEmpName.split(' ')[0];
      targetCashbox = availableBoxes.find((c: any) => {
        const cName = (c.nameAr || c.name || '').toLowerCase();
        return cName.includes(selectedEmpName.toLowerCase()) || (firstName.length >= 3 && cName.includes(firstName.toLowerCase()));
      });
    }

    if (targetCashbox) {
      setReceivingCashbox(targetCashbox.id);
      setPayingCashbox((prev) => prev || targetCashbox.id);
    }
  }, [employeesList]);

  // Read through a ref: the hydrate effect must not re-run (and wipe a half-typed
  // transaction) merely because the customer list finished loading.
  const customerCandidatesRef = useRef(allCustomerCandidates);
  useEffect(() => {
    customerCandidatesRef.current = allCustomerCandidates;
  }, [allCustomerCandidates]);

  /**
   * Pushes the saved defaults onto the live form. Used both when a new visa
   * transaction opens and right after the settings dialog saves, so the change is
   * visible immediately instead of only on the next transaction.
   */
  const applyPageSettingsToForm = useCallback(
    (settings: TicketPageSettings) => {
      setCurrency(settings.defaultCurrency);
      setPaymentType(settings.defaultPaymentType);
      setPaymentMethod(settings.defaultPaymentMethod);

      const match = findDefaultCashCustomer(allCustomerCandidates as any, settings);
      if (match) setCustomerName(customerDisplayName(match, isAr));
      else if (settings.defaultCustomerName) setCustomerName(settings.defaultCustomerName);

      if (settings.datesDefaultToday) {
        setIssueDate(new Date());
        setEntryDate(new Date());
      }

      if (settings.linkCashboxToEmployee) {
        const emp = user?.name || '';
        if (emp) applyEmployeeCashbox(emp, availableCashboxes);
      }
    },
    [allCustomerCandidates, isAr, user, applyEmployeeCashbox, availableCashboxes],
  );

  // Refresh the saved defaults each time the editor is opened, so a change made
  // in another tab is picked up.
  useEffect(() => {
    if (!opened) return;
    setPageSettings(loadTicketPageSettings(user?.companyId, 'visas'));
  }, [opened, user?.companyId]);

  // Hydrate Data
  useEffect(() => {
    if (!opened) return;

    if (initialData) {
      const d = initialData.rawInvoice || initialData;
      setInvoiceNumber(d.invoiceNumber || d.number || '');
      setIssueDate(d.issueDate ? new Date(d.issueDate) : new Date());

      // 1. Resolve Customer
      const rawCust = d.customerName || d.customer || d.agentName || '';
      let resolvedCust = rawCust;
      if (rawCust && Array.isArray(customersList) && customersList.length > 0) {
        const found = customersList.find(
          (c) =>
            c.id === rawCust ||
            c.code === rawCust ||
            c.nameAr === rawCust ||
            c.nameEn === rawCust ||
            (c as any).name === rawCust,
        );
        if (found) {
          resolvedCust = found.nameAr || found.nameEn || (found as any).name || rawCust;
        }
      }
      setCustomerName(resolvedCust);

      // 2. Resolve Supplier Account & Name
      const rawSuppAcc = d.supplierAccount || d.supplierId || '';
      const rawSuppName = d.supplierAccountName || d.supplierName || (d.airline && d.airline !== 'VISA' ? d.airline : '');
      let resolvedSuppAcc = rawSuppAcc;
      let resolvedSuppName = rawSuppName;

      if (Array.isArray(suppliersList) && suppliersList.length > 0) {
        const found = suppliersList.find(
          (s) =>
            s.id === rawSuppAcc ||
            (s as any).accountId === rawSuppAcc ||
            s.code === rawSuppAcc ||
            s.nameAr === rawSuppName ||
            s.nameAr === rawSuppAcc ||
            (s as any).name === rawSuppName ||
            (s as any).name === rawSuppAcc,
        );
        if (found) {
          resolvedSuppAcc = found.id || (found as any).accountId || found.code;
          resolvedSuppName = found.nameAr || found.nameEn || (found as any).name || rawSuppName;
        }
      }
      if (!resolvedSuppName && rawSuppAcc) {
        resolvedSuppName = rawSuppAcc;
      }
      setSupplierAccount(resolvedSuppAcc);
      setSupplierAccountName(resolvedSuppName);

      setVisaDestination(d.airline || d.route || d.pnr || '');
      setEmployeeName(d.employeeName || d.issuedBy || user?.name || '');
      setEntryEmployee(d.entryEmployee || user?.name || '');
      setCurrency(d.currency || 'USD');
      setExchangeRate(d.exchangeRate || 0);
      setPaymentType(d.paymentType === 'CREDIT' || d.paymentType === 'آجل' ? 'آجل' : d.paymentType === 'DEBIT' || d.paymentType === 'CASH' || d.paymentType === 'نقدي' ? 'نقدي' : '');
      setPaymentMethod(d.paymentMethod || '');
      setReceivingCashbox(d.receivingCashbox || '');
      setPayingCashbox(d.cashbox || '');
      setReference(d.reference || '');
      setNotes(d.notes || '');
      setStatus(d.status || 'POSTED');
      setDiscountAmount(d.discountAmount || d.totals?.discountAmount || 0);

      if (d.passengers && Array.isArray(d.passengers) && d.passengers.length > 0) {
        setPassengers(
          d.passengers.map((p: any, idx: number) => {
            const rawStatus = (p.status || '').toLowerCase();
            const isIssued = rawStatus === 'issued' || rawStatus === 'صادر' || rawStatus === 'مكتمل';

            // Clean up visa type and order number to avoid nested concatenation
            const rawType = (p.visaType || p.pnr || d.airline || '').trim();
            let cleanVisaType = '';
            let cleanOrder = p.orderNumber || p.voucherNumber || '';

            if (rawType) {
              const match = rawType.match(/^([^\[]+)(?:\[([^\]]+)\])?/);
              if (match) {
                cleanVisaType = match[1].trim();
                if (!cleanOrder && match[2]) {
                  cleanOrder = match[2].trim();
                }
              } else {
                cleanVisaType = rawType;
              }
            }

            cleanVisaType = cleanVisaType.replace(/\[.*?\]/g, '').trim();

            return {
              id: p.id || `p-${idx}-${Date.now()}`,
              name: p.name || '',
              passportNumber: p.passportNumber || p.documentNumber || p.ticketNumber || '',
              visaType: cleanVisaType,
              orderNumber: cleanOrder || '',
              status: isIssued ? 'Issued' : 'NotIssued',
              fareBuy: p.fareBuy !== undefined ? p.fareBuy : (p.buyPrice !== undefined ? p.buyPrice : null),
              fareSell: p.fareSell !== undefined ? p.fareSell : (p.salePrice !== undefined ? p.salePrice : null),
              notes: p.notes || '',
            };
          }),
        );
      }

      if (d.transferImage) {
        setAttachments([
          {
            id: 'att-initial',
            name: isAr ? 'إيصال التحويل / التأشيرة' : 'Visa Approval Receipt',
            url: d.transferImage,
            type: d.transferImage.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image',
          },
        ]);
      }

      setIsDirty(false);
    } else {
      // Create Mode — seeded from this employee's saved page defaults.
      const defaults = loadTicketPageSettings(user?.companyId, 'visas');
      const nextNum = getNextSequenceNumber('visas') || `VISA-${Date.now().toString().slice(-6)}`;
      setInvoiceNumber(nextNum);
      setIssueDate(new Date());
      setSupplierAccount('');
      setSupplierAccountName('');
      setVisaDestination('');
      const defaultEmp = user?.name || '';
      setEmployeeName(defaultEmp);
      setEntryEmployee(defaultEmp);
      setExchangeRate(0);
      setReference('');
      setNotes('');
      setStatus('DRAFT');
      setDiscountAmount(0);

      setCurrency(defaults.defaultCurrency);
      setPaymentType(defaults.defaultPaymentType);
      setPaymentMethod(defaults.defaultPaymentMethod);
      setEntryDate(new Date());

      const defaultCustomer = findDefaultCashCustomer(customerCandidatesRef.current as any, defaults);
      setCustomerName(
        defaultCustomer ? customerDisplayName(defaultCustomer, isAr) : defaults.defaultCustomerName || '',
      );

      if (defaultEmp && defaults.linkCashboxToEmployee) applyEmployeeCashbox(defaultEmp, availableCashboxes);

      setPassengers([
        {
          id: `p-${Date.now()}`,
          name: '',
          passportNumber: '',
          visaType: '',
          orderNumber: '',
          status: 'NotIssued',
          fareBuy: null,
          fareSell: null,
          notes: '',
        },
      ]);
      setAttachments([]);
      setIsDirty(false);
    }
  }, [opened, initialData, user, applyEmployeeCashbox, availableCashboxes, isAr]);

  // Financial Totals
  const totalBuy = useMemo(() => {
    return passengers.reduce((sum, p) => sum + (Number(p.fareBuy) || 0), 0);
  }, [passengers]);

  const totalSell = useMemo(() => {
    return passengers.reduce((sum, p) => sum + (Number(p.fareSell) || 0), 0);
  }, [passengers]);

  const passengersNamedCount = useMemo(() => {
    return passengers.filter((p) => p.name && p.name.trim().length > 0).length;
  }, [passengers]);

  // Distinct Visa Destinations from all travelers (clean without brackets)
  const activeVisaDestinations = useMemo(() => {
    const types = passengers
      .map((p) => (p.visaType || '').replace(/\[.*?\]/g, '').trim())
      .filter(Boolean);
    return Array.from(new Set(types));
  }, [passengers]);

  const formatAmount = useCallback(
    (val: number | null | undefined) => {
      return formatCurrency(val, currency);
    },
    [currency],
  );

  const activeExchangeRate = useMemo(() => {
    return adoptedEx.adoptedRate || 0;
  }, [adoptedEx.adoptedRate]);

  // Currency Switching
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
      const rate = appliedRate || activeExchangeRate;
      if (!rate || rate <= 0) {
        showErrorNotification(
          isAr ? 'سعر الصرف غير محدد' : 'Exchange Rate Missing',
          isAr ? 'لا يمكن تحويل المبالغ بدون سعر صرف حقيقي معتمد أو مدخل.' : 'Cannot convert amounts without a real exchange rate.'
        );
        return;
      }

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

        return {
          ...p,
          fareBuy: newBuy,
          fareSell: newSell,
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
    }));

    setDiscountAmount(0);
    setPassengers(resetPassengers);
    setCurrency(targetCurr);
    markDirty();
  }, [pendingCurrency, passengers, markDirty]);

  // ── Completion & Validation ──
  const completionData = useMemo(() => {
    const reqs: Array<{
      id: string;
      label: string;
      isCompleted: boolean;
      missingMessage: string;
      targetElementId: string;
    }> = [];

    // 1. Visa Destination / Type for Travelers
    const allHaveVisaType = passengers.length > 0 && passengers.every(
      (p) => Boolean(p.visaType && p.visaType.trim().length > 0)
    );
    reqs.push({
      id: 'visaDestination',
      label: isAr ? 'نوع التأشيرة للمسافرين' : 'Traveler Visa Types',
      isCompleted: allHaveVisaType,
      missingMessage: isAr ? 'يرجى اختيار نوع التأشيرة للمسافرين بالجدول' : 'Please select visa type for travelers in the table',
      targetElementId: 'field-passengers-table',
    });

    // 2. Customer or Cashbox
    if (paymentType === 'آجل' || paymentType === 'CREDIT') {
      reqs.push({
        id: 'customerName',
        label: isAr ? 'العميل (البيع الآجل)' : 'Customer (Credit Sale)',
        isCompleted: Boolean(customerName && customerName.trim().length > 0),
        missingMessage: isAr ? 'العميل مطلوب لأن المعاملة على الحساب (آجل)' : 'Customer is required for credit sale',
        targetElementId: 'field-customer',
      });
    } else {
      reqs.push({
        id: 'receivingCashbox',
        label: isAr ? 'صندوق استلام قيمة البيع' : 'Receiving Cashbox',
        isCompleted: Boolean(receivingCashbox && receivingCashbox.trim().length > 0),
        missingMessage: isAr ? 'صندوق التحصيل مطلوب للبيع النقدي' : 'Receiving cashbox required for cash sale',
        targetElementId: 'field-receiving-cashbox',
      });
    }

    // 3. Travelers Existence
    const hasPassengers = passengers.length >= 1;
    reqs.push({
      id: 'passengersExistence',
      label: isAr ? 'إضافة المسافرين' : 'Add Travelers',
      isCompleted: hasPassengers,
      missingMessage: isAr ? 'يجب إضافة مسافر واحد على الأقل' : 'At least one traveler is required',
      targetElementId: 'field-passengers-section',
    });

    // 4. Passenger Names & Passports
    if (hasPassengers) {
      const allNamedAndPass = passengers.every(
        (p) => Boolean(p.name && p.name.trim().length > 0) && Boolean(p.passportNumber && p.passportNumber.trim().length > 0)
      );
      reqs.push({
        id: 'passengersNames',
        label: isAr ? 'اسم المسافر ورقم الجواز' : 'Traveler Name & Passport #',
        isCompleted: allNamedAndPass,
        missingMessage: isAr ? 'يرجى إدخال اسم المسافر ورقم الجواز لكل سطر' : 'Please provide name and passport # for all travelers',
        targetElementId: 'field-passengers-table',
      });

      // 5. Pricing
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
        label: isAr ? 'سعر الشراء وسعر البيع' : 'Buy & Sell Pricing',
        isCompleted: allPriced,
        missingMessage: isAr ? 'يرجى إدخال سعر الشراء وسعر البيع لجميع المسافرين' : 'Please enter buy and sell fares',
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
    visaDestination,
    paymentType,
    customerName,
    receivingCashbox,
    passengers,
    isAr,
  ]);

  // Navigate & Highlight field
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

  // Validate form
  const validateForm = (isPosting: boolean): boolean => {
    const errs: Record<string, string> = {};

    if (!invoiceNumber.trim()) errs.invoiceNumber = isAr ? 'رقم المعاملة مطلوب' : 'Invoice number is required';

    if (isPosting) {
      if (!paymentType) {
        errs.paymentType = isAr ? 'طريقة السداد مطلوبة' : 'Payment type is required';
      }
      if (!supplierAccountName.trim() && !supplierAccount.trim()) {
        errs.supplierAccount = isAr ? 'المورد مطلوب ولا يمكن استبداله بقيمة افتراضية' : 'Supplier is required';
      }
      if (!employeeName.trim()) {
        errs.employeeName = isAr ? 'اسم الموظف مطلوب' : 'Employee name is required';
      }
      if (paymentType === 'آجل' || paymentType === 'CREDIT') {
        if (!customerName.trim()) errs.customerName = isAr ? 'العميل مطلوب لأن البيع آجل' : 'Customer required for credit sale';
      } else if (paymentType === 'نقدي' || paymentType === 'CASH' || paymentType === 'DEBIT') {
        if (!receivingCashbox.trim()) errs.receivingCashbox = isAr ? 'يرجى تحديد صندوق استلام قيمة البيع' : 'Receiving cashbox is required';
      }

      if (passengers.length === 0) {
        errs.passengers = isAr ? 'يجب إضافة مسافر واحد على الأقل' : 'At least one traveler is required';
      }

      passengers.forEach((p, idx) => {
        if (!p.name.trim()) {
          errs[`passenger_${idx}_name`] = isAr ? 'اسم المسافر مطلوب' : 'Traveler name is required';
        }
        if (!p.passportNumber.trim()) {
          errs[`passenger_${idx}_passport`] = isAr ? 'رقم الجواز مطلوب' : 'Passport # is required';
        }
        if (!p.visaType.trim()) {
          errs[`passenger_${idx}_visaType`] = isAr ? 'نوع التأشيرة مطلوب' : 'Visa type is required';
        }
        if (p.fareBuy === null || p.fareBuy === undefined || !Number.isFinite(Number(p.fareBuy))) {
          errs[`passenger_${idx}_fareBuy`] = isAr ? 'تكلفة الشراء مطلوبة' : 'Buy fare is required';
        }
        if (p.fareSell === null || p.fareSell === undefined || !Number.isFinite(Number(p.fareSell))) {
          errs[`passenger_${idx}_fareSell`] = isAr ? 'سعر البيع مطلوب' : 'Sell fare is required';
        }
      });
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Handle batch visa type change with optional preset pricing and auto currency sync
  const handleBatchVisaTypeChange = (selectedType: string | null) => {
    const tName = selectedType || '';
    setBatchVisaType(tName);
    if (tName) {
      const record = visaCatalogMap.get(tName.trim().toLowerCase());
      if (record) {
        // Auto-switch invoice currency to the visa type's preset currency (e.g. IQD or USD)
        if (record.defaultCurrency && record.defaultCurrency !== currency && status !== 'POSTED') {
          setCurrency(record.defaultCurrency);
        }
        if (record.defaultBuyPrice !== null && record.defaultBuyPrice !== undefined) {
          setBatchBuy(String(record.defaultBuyPrice));
        }
        if (record.defaultSellPrice !== null && record.defaultSellPrice !== undefined) {
          setBatchSell(String(record.defaultSellPrice));
        }
      }
    }
  };

  // Clear preset pricing to allow pure manual input
  const handleClearPresetPrices = () => {
    setBatchBuy('');
    setBatchSell('');
    showInfoNotification(
      isAr ? 'تم تفعيل التسعير اليدوي' : 'Manual Pricing Enabled',
      isAr ? 'تم تفريغ حقول السعر لتتمكن من كتابة أي مبالغ يدوياً' : 'Preset fares cleared for custom manual pricing'
    );
  };


  // Handle single row visa type change with auto preset fill
  const handleRowVisaTypeChange = (idx: number, selectedType: string | null) => {
    const tName = selectedType || '';
    const next = [...passengers];
    next[idx].visaType = tName;

    if (tName) {
      const record = visaCatalogMap.get(tName.trim().toLowerCase());
      if (record) {
        if ((next[idx].fareBuy === null || next[idx].fareBuy === 0 || !next[idx].fareBuy) && record.defaultBuyPrice !== null && record.defaultBuyPrice !== undefined) {
          next[idx].fareBuy = record.defaultBuyPrice;
        }
        if ((next[idx].fareSell === null || next[idx].fareSell === 0 || !next[idx].fareSell) && record.defaultSellPrice !== null && record.defaultSellPrice !== undefined) {
          next[idx].fareSell = record.defaultSellPrice;
        }
      }
    }
    setPassengers(next);
    markDirty();
  };

  // Re-apply preset prices explicitly to a specific row
  const handleApplyPresetToRow = (idx: number) => {
    const row = passengers[idx];
    if (!row.visaType) return;
    const record = visaCatalogMap.get(row.visaType.trim().toLowerCase());
    if (record) {
      const next = [...passengers];
      if (record.defaultBuyPrice !== null && record.defaultBuyPrice !== undefined) {
        next[idx].fareBuy = record.defaultBuyPrice;
      }
      if (record.defaultSellPrice !== null && record.defaultSellPrice !== undefined) {
        next[idx].fareSell = record.defaultSellPrice;
      }
      setPassengers(next);
      markDirty();
    }
  };

  // Add passenger row
  const handleAddPassenger = () => {
    const defaultType = batchVisaType || visaDestination || '';
    const record = defaultType ? visaCatalogMap.get(defaultType.trim().toLowerCase()) : null;

    setPassengers([
      ...passengers,
      {
        id: `p-${Date.now()}-${passengers.length}`,
        name: '',
        passportNumber: '',
        visaType: defaultType,
        orderNumber: '',
        status: batchStatus || 'NotIssued',
        fareBuy: batchBuy ? Number(batchBuy) : (record?.defaultBuyPrice ?? null),
        fareSell: batchSell ? Number(batchSell) : (record?.defaultSellPrice ?? null),
        notes: '',
      },
    ]);
    markDirty();
  };

  // Apply batch price to all passengers
  const handleApplyBatchPricing = () => {
    const bBuyNum = batchBuy ? Number(batchBuy) : null;
    const bSellNum = batchSell ? Number(batchSell) : null;

    setPassengers(
      passengers.map((p) => ({
        ...p,
        visaType: batchVisaType || p.visaType,
        status: batchStatus || p.status,
        fareBuy: bBuyNum !== null ? bBuyNum : p.fareBuy,
        fareSell: bSellNum !== null ? bSellNum : p.fareSell,
      })),
    );
    markDirty();
    showSuccessNotification(
      isAr ? 'تم تطبيق التسعير' : 'Pricing Applied',
      isAr ? 'تم تحديث أسعار ونوع وحالة التأشيرة لجميع المسافرين' : 'Updated fares and visa status for all travelers'
    );
  };


  // Core apply function for imported rows and meta
  const applyImportData = (
    importedPassengers: VisaPassengerItem[],
    meta?: {
      supplierName?: string;
      customerName?: string;
      issueDate?: string;
      employeeName?: string;
      detectedCurrency?: 'IQD' | 'USD';
    }
  ) => {
    if (!importedPassengers || importedPassengers.length === 0) return;

    const newRows: VisaPassengerLine[] = importedPassengers.map((imp, idx) => ({
      id: `p-imp-${Date.now()}-${idx}`,
      name: imp.name || '',
      passportNumber: imp.passportNumber || '',
      visaType: imp.visaType || visaDestination || 'فيزا العراق',
      orderNumber: imp.voucherNumber || '',
      status: imp.status === 'Issued' ? 'Issued' : 'NotIssued',
      fareBuy: imp.buyPrice ? Number(imp.buyPrice) : null,
      fareSell: imp.salePrice ? Number(imp.salePrice) : null,
      notes: imp.notes || '',
    }));

    if (passengers.length === 1 && !passengers[0].name.trim() && !passengers[0].passportNumber.trim()) {
      setPassengers(newRows);
    } else {
      setPassengers([...passengers, ...newRows]);
    }

    // Auto-populate invoice master fields if detected from Excel
    if (meta) {
      if (meta.detectedCurrency && meta.detectedCurrency !== currency && status !== 'POSTED') {
        setCurrency(meta.detectedCurrency);
      }
      if (meta.customerName && (!customerName || customerName === 'عميل نقدي عام')) {
        setCustomerName(meta.customerName);
      }
      if (meta.supplierName && !supplierAccountName) {
        setSupplierAccountName(meta.supplierName);
      }
      if (meta.employeeName) {
        setEmployeeName(meta.employeeName);
      }
      if (meta.issueDate) {
        const parts = meta.issueDate.replace(/\//g, '-').split('-');
        if (parts.length === 3) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10) - 1;
          const d = parseInt(parts[2], 10);
          if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
            setIssueDate(new Date(y, m, d, 12, 0, 0));
          }
        }
      }
    }

    if (newRows[0]?.visaType && !visaDestination) {
      setVisaDestination(newRows[0].visaType);
    }

    markDirty();
    showSuccessNotification(
      isAr ? 'تم الاستيراد الذكي' : 'Smart Import Successful',
      isAr ? `تم استيراد ${importedPassengers.length} مسافر مع الأسعار والجوازات بنجاح` : `Imported ${importedPassengers.length} traveler(s) successfully`
    );
  };

  // Smart Import with Fuzzy Match & Unmatched Party Warning
  const handleSmartImport = (
    importedPassengers: VisaPassengerItem[],
    meta?: {
      supplierName?: string;
      customerName?: string;
      issueDate?: string;
      employeeName?: string;
      detectedCurrency?: 'IQD' | 'USD';
    }
  ) => {
    if (!importedPassengers || importedPassengers.length === 0) return;

    // Check if Customer or Supplier from pasted data need similarity matching / account creation
    const custRaw = meta?.customerName?.trim();
    const suppRaw = meta?.supplierName?.trim();

    let custUnmatched: UnmatchedPartyData | null = null;
    let suppUnmatched: UnmatchedPartyData | null = null;

    if (custRaw && custRaw !== 'عميل نقدي عام' && custRaw !== 'نقدي') {
      const exact = allCustomerCandidates.find(
        (c) =>
          c.nameAr?.trim().toLowerCase() === custRaw.toLowerCase() ||
          c.nameEn?.trim().toLowerCase() === custRaw.toLowerCase() ||
          (c as any).name?.trim().toLowerCase() === custRaw.toLowerCase() ||
          c.code === custRaw
      );
      if (!exact) {
        const similars = findSimilarAccounts(custRaw, (allCustomerCandidates as any) || [], 30);
        custUnmatched = { rawName: custRaw, similarAccounts: similars };
      }
    }

    if (suppRaw) {
      const exact = allSupplierCandidates.find(
        (s) =>
          s.nameAr?.trim().toLowerCase() === suppRaw.toLowerCase() ||
          s.nameEn?.trim().toLowerCase() === suppRaw.toLowerCase() ||
          (s as any).name?.trim().toLowerCase() === suppRaw.toLowerCase() ||
          s.code === suppRaw
      );
      if (!exact) {
        const similars = findSimilarAccounts(suppRaw, (allSupplierCandidates as any) || [], 30);
        suppUnmatched = { rawName: suppRaw, similarAccounts: similars };
      }
    }

    if (custUnmatched || suppUnmatched) {
      setUnmatchedCustomerData(custUnmatched);
      setUnmatchedSupplierData(suppUnmatched);
      setPendingImportData({ passengers: importedPassengers, meta });
      setReconciliationModalOpen(true);
      return;
    }

    // Both matched or not specified, apply directly
    applyImportData(importedPassengers, meta);
  };

  const handleApplyReconciliationMatches = (results: {
    customer?: { id?: string; name: string; isNew?: boolean; accountCode?: string };
    supplier?: { id?: string; name: string; isNew?: boolean; accountCode?: string };
  }) => {
    queryClient.invalidateQueries({ queryKey: ['customers-list'] });
    queryClient.invalidateQueries({ queryKey: ['suppliers-list'] });
    queryClient.invalidateQueries({ queryKey: ['cashbox-accounts-list'] });

    const updatedMeta = { ...(pendingImportData?.meta || {}) };

    if (results.customer) {
      setCustomerName(results.customer.name);
      updatedMeta.customerName = results.customer.name;
    }

    if (results.supplier) {
      if (results.supplier.id) {
        setSupplierAccount(results.supplier.id);
      }
      setSupplierAccountName(results.supplier.name);
      updatedMeta.supplierName = results.supplier.name;
    }

    if (pendingImportData?.passengers) {
      applyImportData(pendingImportData.passengers, updatedMeta);
    }

    setPendingImportData(null);
    setUnmatchedCustomerData(null);
    setUnmatchedSupplierData(null);
    markDirty();
  };

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async (targetStatus: string) => {
      const isValid = validateForm(targetStatus === 'POSTED');
      if (!isValid) {
        showErrorNotification(
          isAr ? 'بيانات غير مكتملة' : 'Incomplete Data',
          isAr ? 'يرجى مراجعة الحقول المطلوبة باللون الأحمر' : 'Please check required fields'
        );
        throw new Error('Validation failed');
      }

      const finalCustomer = customerName.trim();
      const finalSupplierName = supplierAccountName.trim() || supplierAccount.trim();
      const destinationText = activeVisaDestinations.join('، ');
      const selectedCustomer = allCustomerCandidates.find(
        (c) => c.id === finalCustomer || c.code === finalCustomer || c.nameAr === finalCustomer || c.nameEn === finalCustomer || c.name === finalCustomer,
      );
      const selectedSupplier = allSupplierCandidates.find(
        (s) => s.id === supplierAccount || s.code === supplierAccount || s.nameAr === finalSupplierName || s.nameEn === finalSupplierName || s.name === finalSupplierName,
      );
      const customerSource = selectedCustomer?.source;
      const supplierSource = selectedSupplier?.source;
      const isCashSale = paymentType === 'نقدي' || paymentType === 'CASH' || paymentType === 'DEBIT';

      const payload: any = {
        invoiceNumber: String(invoiceNumber || '').startsWith('VISA-NEW') ? undefined : String(invoiceNumber || ''),
        issueDate: issueDate.toISOString(),
        entryDate: entryDate.toISOString(),
        customerName: finalCustomer || null,
        customerId: customerSource === 'customer' ? selectedCustomer?.id : null,
        customerAccountId: selectedCustomer?.accountId || (customerSource === 'account' ? selectedCustomer?.id : null),
        agentName: finalCustomer || null,
        supplierAccount: supplierAccount || null,
        supplierAccountName: finalSupplierName || null,
        supplierId: supplierSource === 'supplier' ? selectedSupplier?.id : null,
        supplierAccountId: selectedSupplier?.accountId || (supplierSource === 'account' ? selectedSupplier?.id : null),
        tripType: 'VISA',
        airline: destinationText || null,
        route: destinationText || null,
        pnr: destinationText || null,
        employeeName: employeeName.trim() || null,
        entryEmployee: entryEmployee.trim() || null,
        modifiedByEmployee: user?.name || null,
        currency,
        exchangeRate: exchangeRate || null,
        paymentType: paymentType === 'نقدي' || paymentType === 'CASH' || paymentType === 'DEBIT' ? 'DEBIT' : paymentType === 'آجل' || paymentType === 'CREDIT' ? 'CREDIT' : null,
        paymentMethod: paymentMethod || null,
        receivingCashbox: receivingCashbox || null,
        cashboxAccountId: isCashSale ? receivingCashbox || null : null,
        cashbox: payingCashbox || null,
        reference: reference.trim(),
        notes: notes.trim(),
        status: targetStatus,
        discountAmount,
        totalBuy,
        totalSell,
        profit: totalSell - discountAmount - totalBuy,
        transferImage: attachments[0]?.url || null,
        passengers: passengers.map((p) => {
          const cleanType = (p.visaType || '').replace(/\[.*?\]/g, '').trim();
          const cleanOrder = (p.orderNumber || '').trim();
          return {
            name: p.name.trim(),
            ticketType: 'ADT',
            ticketNumber: p.passportNumber.trim(),
            documentNumber: p.passportNumber.trim(),
            visaType: cleanType,
            orderNumber: cleanOrder || null,
            pnr: cleanType ? (cleanOrder ? `${cleanType} [${cleanOrder}]` : cleanType) : null,
            fareBuy: p.fareBuy !== null && p.fareBuy !== undefined ? Number(p.fareBuy) : null,
            fareSell: p.fareSell !== null && p.fareSell !== undefined ? Number(p.fareSell) : null,
            tax1: 0,
            tax2: 0,
            charge: 0,
            percentage: 0,
            status: p.status === 'Issued' ? 'Issued' : 'Processing',
          };
        }),
      };

      let result: any;
      const targetId =
        initialData?.rawInvoice?.id ||
        (initialData?.id && !String(initialData.id).startsWith('TK-AUTO-') && !String(initialData.id).startsWith('VISA-NEW') ? initialData.id : null) ||
        (initialData?.invoiceNumber && !String(initialData.invoiceNumber).startsWith('VISA-NEW') ? initialData.invoiceNumber : null) ||
        (invoiceNumber && !invoiceNumber.startsWith('VISA-NEW') && initialData ? invoiceNumber : null);

      if (targetId) {
        result = await ticketsApi.update(targetId, payload);
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
          isAr ? 'تم اعتماد وترحيل المعاملة' : 'Transaction Posted',
          isAr ? 'تم ترحيل قيد التأشيرة بنجاح إلى الحسابات والصناديق' : 'Visa transaction posted and recorded successfully'
        );
      } else {
        showSuccessNotification(
          isAr ? 'تم حفظ المسودة' : 'Draft Saved',
          isAr ? 'تم حفظ بيانات المعاملة كمسودة' : 'Visa saved as draft successfully'
        );
      }

      if (onSuccess) onSuccess(savedData);
      onClose();
    },
    onError: (err: any) => {
      if (err.message !== 'Validation failed') {
        showErrorNotification(
          isAr ? 'فشل الحفظ' : 'Save Failed',
          err?.message || (isAr ? 'تعذر حفظ المعاملة' : 'Could not save transaction')
        );
      }
    },
    onSettled: () => {
      setSubmittingAction(null);
    },
  });

  // Keyboard shortcut: ESC & Ctrl+S / Ctrl+Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && opened && !currencySwitchModalOpen && !auditLogOpen && !confirmExitOpen && !smartImportOpen && !pageSettingsOpen) {
        e.preventDefault();
        handleRequestClose();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && !submittingAction) {
        e.preventDefault();
        setSubmittingAction('DRAFT');
        saveMutation.mutate('DRAFT');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !submittingAction) {
        e.preventDefault();
        setSubmittingAction('POSTED');
        saveMutation.mutate('POSTED');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [opened, currencySwitchModalOpen, auditLogOpen, confirmExitOpen, smartImportOpen, pageSettingsOpen, submittingAction, handleRequestClose, saveMutation]);

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

  if (!opened) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#FAFAFA] flex flex-col overflow-hidden select-text text-[#111827]"
      style={{ fontFamily: isAr ? '"IBM Plex Sans Arabic", system-ui, sans-serif' : '"IBM Plex Sans", system-ui, sans-serif' }}
      dir={direction}
    >
      {/* ── 1. CLEAN TOP HEADER (60px Height) ── */}
      <header className="h-[60px] bg-white border-b border-[#E5E7EB] px-6 flex items-center justify-between shrink-0 shadow-2xs z-20">
        {/* Leading Side */}
        <div className="flex items-center gap-3">
          <Tooltip label={isAr ? 'رجوع' : 'Back'} position="bottom" withArrow>
            <button
              type="button"
              onClick={handleRequestClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {direction === 'rtl' ? <ArrowRight size={18} /> : <ArrowLeft size={18} />}
            </button>
          </Tooltip>

          <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#F45A0A] flex items-center justify-center font-bold">
            <FileCheck2 size={17} />
          </div>

          <div className="flex items-center gap-2.5">
            <h2 className="font-bold text-[19px] text-[#111827] leading-tight">
              {isAr ? 'معاملة التأشيرات والفيزا' : 'Visa Application & Transaction'}
            </h2>
            <span className="px-2.5 py-0.5 rounded bg-slate-100 text-slate-800 font-mono font-medium text-xs border border-slate-200" dir="ltr">
              {invoiceNumber || 'VISA-NEW'}
            </span>

            {/* Status Badge + Unsaved Indicator */}
            <div className={`flex items-center gap-1.5 ${isAr ? 'mr-1' : 'ml-1'}`}>
              {status === 'POSTED' ? (
                <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {isAr ? 'معتمدة ومرحلة' : 'Posted'}
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-[#FFF3E8] text-[#F45A0A] border border-orange-200">
                  {isAr ? 'مسودة' : 'Draft'}
                </span>
              )}

              {isDirty && (
                <Tooltip label={isAr ? 'توجد تعديلات غير محفوظة' : 'Unsaved changes'} position="bottom" withArrow>
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F45A0A] inline-block animate-pulse"></span>
                </Tooltip>
              )}
            </div>
          </div>
        </div>

        {/* Trailing Side */}
        <div className="flex items-center gap-2">
          {status === 'POSTED' && (
            <Button
              size="xs"
              variant="default"
              radius="md"
              leftSection={<Printer size={14} />}
              onClick={() => window.print()}
              className="font-medium text-xs border-slate-200 text-slate-700 h-8.5 cursor-pointer"
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
              <Menu.Item
                leftSection={<History size={14} />}
                onClick={() => setAuditLogOpen(true)}
              >
                {isAr ? 'سجل التعديلات' : 'Audit Trail Log'}
              </Menu.Item>
              <Menu.Item
                leftSection={<Settings size={14} />}
                onClick={() => {
                  setDraftPageSettings(loadTicketPageSettings(user?.companyId, 'visas'));
                  setPageSettingsOpen(true);
                }}
              >
                {isAr ? 'إعدادات الصفحة' : 'Page settings'}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>
      </header>

      {/* ── 2. FULL WORKSPACE MAIN CONTENT ── */}
      <main className="flex-1 overflow-y-auto px-6 py-4">
        <div className="w-full max-w-[1680px] mx-auto space-y-4">

          {/* ── 2-COLUMN MAIN LAYOUT (360px Sticky Sidebar) ── */}
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
            
            {/* ── MAIN LEADING COLUMN ── */}
            <div className="space-y-4">
              
              {/* ── CARD 1: CORE BUSINESS & ACCOUNTING DETAILS (Streamlined) ── */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-5 space-y-4 font-sans">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center font-bold shrink-0">
                      <Wallet size={18} />
                    </div>
                    <div>
                      <h3 className="font-bold text-[16.5px] text-[#111827] leading-tight">
                        {isAr ? 'بيانات المعاملة المحاسبية والأطراف' : 'Accounting & Settlement Parties'}
                      </h3>
                      <span className="text-[12px] text-[#6B7280] font-normal">
                        {isAr ? 'حدد العميل والمورد وطريقة الاستلام والصناديق النقدية المرتبطة' : 'Select client, supplier, receiving method, and cashbox accounts'}
                      </span>
                    </div>
                  </div>

                  {/* Currency Segmented Control */}
                  <div className="flex items-center gap-2">
                    <CurrencySegmentedControl
                      value={currency}
                      onChange={handleCurrencyChange}
                      showLabel={false}
                      disabled={status === 'POSTED'}
                    />
                  </div>
                </div>

                {/* 4-Column Clean Accounting Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                  {/* Customer */}
                  <div id="field-customer" className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-bold text-slate-700">
                        {isAr ? 'العميل / الجهة الطالبة' : 'Customer'}
                        {(paymentType === 'آجل' || paymentType === 'CREDIT') && <span className="text-red-500 mr-1">*</span>}
                      </label>
                      {isCustomerUnsaved && (
                        <button
                          type="button"
                          onClick={() => {
                            const similars = findSimilarAccounts(customerName, (allCustomerCandidates as any) || [], 30);
                            setUnmatchedCustomerData({ rawName: customerName, similarAccounts: similars });
                            setUnmatchedSupplierData(null);
                            setReconciliationModalOpen(true);
                          }}
                          className="text-[10px] text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                        >
                          <Sparkles size={11} className="text-[#F45A0A]" />
                          <span>{isAr ? 'فحص التشابه / فتح حساب' : 'Match / Create'}</span>
                        </button>
                      )}
                    </div>
                    <SearchableCombobox
                      required={paymentType === 'آجل' || paymentType === 'CREDIT'}
                      value={customerName}
                      onChange={(val) => {
                        const found = allCustomerCandidates.find((c) => c.id === val || c.code === val || c.nameAr === val || c.nameEn === val || (c as any).name === val);
                        setCustomerName(found ? (isAr ? (found.nameAr || found.nameEn) : (found.nameEn || found.nameAr)) : (val || ''));
                        markDirty();
                      }}
                      options={formattedCustomersData}
                      allowCustomValue
                      error={errors.customerName}
                    />
                  </div>

                  {/* Supplier */}
                  <div id="field-supplier" className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-bold text-slate-700">
                        {isAr ? 'المورد / الشركة المزودة' : 'Supplier'}
                      </label>
                      {isSupplierUnsaved && (
                        <button
                          type="button"
                          onClick={() => {
                            const val = supplierAccountName || supplierAccount;
                            const similars = findSimilarAccounts(val, (allSupplierCandidates as any) || [], 30);
                            setUnmatchedSupplierData({ rawName: val, similarAccounts: similars });
                            setUnmatchedCustomerData(null);
                            setReconciliationModalOpen(true);
                          }}
                          className="text-[10px] text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                        >
                          <Sparkles size={11} className="text-[#F45A0A]" />
                          <span>{isAr ? 'فحص التشابه / فتح حساب' : 'Match / Create'}</span>
                        </button>
                      )}
                    </div>
                    <SearchableCombobox
                      value={supplierAccountName || supplierAccount}
                      onChange={(val) => {
                        const found = allSupplierCandidates.find((s) => s.id === val || s.code === val || s.nameAr === val || s.nameEn === val || (s as any).name === val);
                        if (found) {
                          setSupplierAccount(found.id || (found as any).accountId || found.code);
                          setSupplierAccountName(isAr ? found.nameAr : (found.nameEn || found.nameAr));
                        } else {
                          setSupplierAccount(val);
                          setSupplierAccountName(val);
                        }
                        markDirty();
                      }}
                      options={formattedSuppliersData}
                      allowCustomValue
                    />
                  </div>

                  {/* Payment Term */}
                  <div id="field-payment-type">
                    <SearchableCombobox
                      label={isAr ? 'نوع السداد' : 'Payment Term'}
                      value={paymentType}
                      onChange={(val) => {
                        setPaymentType(val || 'نقدي');
                        markDirty();
                      }}
                      options={[
                        { value: 'نقدي', label: isAr ? 'نقدي (تحصيل فوري)' : 'Cash (Immediate)' },
                        { value: 'آجل', label: isAr ? 'آجل (ذمة العميل)' : 'Credit (On Account)' },
                      ]}
                      clearable={false}
                    />
                  </div>

                  {/* Receiving Method */}
                  <div id="field-payment-method">
                    <SearchableCombobox
                      label={isAr ? 'طريقة الاستلام' : 'Receiving Method'}
                      required={paymentType === 'نقدي' || paymentType === 'CASH'}
                      value={paymentMethod}
                      onChange={(val) => {
                        const nextMethod = val || 'CASH_HAND';
                        setPaymentMethod(nextMethod);
                        const matched = paymentMethodsList.find((pm: any) => pm.value === nextMethod);
                        if (matched?.targetAccountId && matched.targetAccountId !== 'EMPLOYEE_ASSIGNED') {
                          setReceivingCashbox(matched.targetAccountId);
                        } else if (nextMethod === 'CASH_HAND' && employeeName) {
                          applyEmployeeCashbox(employeeName, availableCashboxes);
                        }
                        markDirty();
                      }}
                      options={paymentMethodsList}
                      clearable={false}
                    />
                  </div>

                  {/* Receiving Cashbox (Validated & Populated with Full Account Label) */}
                  <div id="field-receiving-cashbox">
                    <SearchableCombobox
                      label={isAr ? 'صندوق استلام قيمة البيع' : 'Receiving Cashbox'}
                      required={paymentType === 'نقدي' || paymentType === 'CASH'}
                      value={receivingCashbox}
                      onChange={(val) => {
                        setReceivingCashbox(val);
                        markDirty();
                      }}
                      options={cashboxOptions}
                      error={errors.receivingCashbox}
                    />
                  </div>

                  {/* Paying Cashbox */}
                  <div id="field-paying-cashbox">
                    <SearchableCombobox
                      label={isAr ? 'صندوق دفع تكلفة الشراء' : 'Cost Paying Cashbox'}
                      value={payingCashbox}
                      onChange={(val) => {
                        setPayingCashbox(val);
                        markDirty();
                      }}
                      options={cashboxOptions}
                    />
                  </div>


                  {/* Issuing Employee */}
                  <div id="field-employee">
                    <SearchableCombobox
                      label={isAr ? 'موظف الإصدار' : 'Issuing Employee'}
                      value={employeeName}
                      onChange={(val) => {
                        setEmployeeName(val);
                        markDirty();
                        if (paymentMethod === 'CASH_HAND') {
                          applyEmployeeCashbox(val, availableCashboxes);
                        }
                      }}
                      options={employeesList.map((e) => ({
                        value: e.fullName || e.name || e.username || '',
                        label: e.fullName || e.name || e.username || '',
                      }))}
                      allowCustomValue
                    />
                  </div>

                  {/* Entry Date — one combined field when the page settings ask for a time */}
                  <div id="field-entry-date">
                    {pageSettings.entryDateIncludesTime ? (
                      <DateTimeField
                        label={isAr ? 'تاريخ ووقت الإدخال' : 'Entry date & time'}
                        isArabic={isAr}
                        value={entryDate}
                        onChange={(date) => {
                          setEntryDate(date);
                          markDirty();
                        }}
                      />
                    ) : (
                      <>
                        <label className="block text-[12.5px] font-medium text-[#6B7280] mb-[7px]">
                          {isAr ? 'تاريخ الإدخال' : 'Entry Date'}
                        </label>
                        <SegmentedDatePicker
                          value={entryDate}
                          onChange={(date) => {
                            if (date) setEntryDate(date);
                            markDirty();
                          }}
                          clearable={false}
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* ── CARD 2: TRAVELERS & PASSPORTS & PRICING TABLE (Clean & Focused) ── */}
              <div id="field-passengers-section" className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-5 space-y-4 font-sans">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center shrink-0 p-1 relative">
                      <Lottie src={visaAnimation} loop={true} autoplay={true} className="w-full h-full object-contain" />
                    </div>
                    <div>
                      <h3 className="font-bold text-[16.5px] text-[#111827] leading-tight flex items-center gap-2">
                        <span>{isAr ? 'بيانات المسافرين والجوازات والتسعير' : 'Travelers, Passports & Pricing'}</span>
                        <span className="text-[10px] font-black text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                          {isAr ? 'خطوة 2' : 'Step 2'}
                        </span>
                      </h3>
                      <span className="text-[12px] text-[#6B7280] font-normal">
                        {isAr ? `إجمالي: ${passengers.length} مسافر` : `${passengers.length} traveler(s)`}
                      </span>
                    </div>
                  </div>

                  {/* Actions: Add Visa Type (White), Smart Import (White), Add Passenger (Orange) */}
                  <div className="flex items-center gap-2">
                    <Button
                      size="xs"
                      variant="default"
                      radius="md"
                      leftSection={<Plus size={14} className="text-[#F45A0A]" />}
                      onClick={() => setNewVisaTypeModalOpen(true)}
                      className="font-semibold text-xs border-slate-300 text-slate-800 hover:bg-slate-50 cursor-pointer h-9 px-3.5"
                    >
                      {isAr ? 'نوع تأشيرة' : 'Visa Type'}
                    </Button>

                    <Button
                      size="xs"
                      variant="default"
                      radius="md"
                      leftSection={<Sparkles size={14} className="text-[#F45A0A]" />}
                      onClick={() => setSmartImportOpen(true)}
                      className="font-semibold text-xs border-slate-300 text-slate-800 hover:bg-slate-50 cursor-pointer h-9 px-3.5"
                    >
                      {isAr ? 'استيراد ذكي' : 'Smart Import'}
                    </Button>

                    <Button
                      size="xs"
                      color="orange"
                      radius="md"
                      leftSection={<Plus size={14} />}
                      onClick={handleAddPassenger}
                      className="bg-[#F45A0A] hover:bg-orange-600 font-bold text-xs text-white cursor-pointer h-9 px-4 shadow-2xs"
                    >
                      {isAr ? 'إضافة مسافر' : 'Add Traveler'}
                    </Button>
                  </div>
                </div>

                {/* Batch Pricing Quick Bar (Standardized 38px Height & Portal Dropdowns) */}
                <div id="field-price-batch-bar" className="bg-[#FFF3E8]/50 p-3.5 rounded-xl border border-[#FFD8B2]/80 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-bold text-orange-950 flex items-center gap-1.5">
                      <Percent size={14} className="text-[#F45A0A]" />
                      {isAr ? 'شريط التسعير السريع للدفعات' : 'Quick Batch Pricing Bar'}
                    </span>
                    {(batchBuy || batchSell || batchVisaType) && (
                      <button
                        type="button"
                        onClick={handleClearPresetPrices}
                        className="text-[11px] font-bold text-slate-600 hover:text-red-600 flex items-center gap-1 transition-colors cursor-pointer bg-white px-2 py-0.5 rounded-lg border border-slate-200 shadow-2xs"
                      >
                        <X size={12} />
                        <span>{isAr ? 'إلغاء الاعتماد (تسعير يدوي)' : 'Clear Preset (Manual Pricing)'}</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                    <div className="sm:col-span-3">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-semibold text-slate-600">
                          {isAr ? 'نوع التأشيرة' : 'Visa Type'}
                        </label>
                        {(() => {
                          const rec = batchVisaType ? visaCatalogMap.get(batchVisaType.trim().toLowerCase()) : null;
                          if (rec && (rec.defaultBuyPrice !== null || rec.defaultSellPrice !== null)) {
                            const cLabel = rec.defaultCurrency || 'USD';
                            return (
                              <span className="text-[10px] font-bold text-[#F45A0A] bg-[#FFF3E8] border border-[#FFD8B2] px-1.5 py-0.2 rounded font-mono">
                                {isAr ? 'مثبت:' : 'Preset:'} {rec.defaultBuyPrice ?? '—'}/{rec.defaultSellPrice ?? '—'} {cLabel}
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>

                      <Select
                        data={visaTypeOptions}
                        value={batchVisaType || null}
                        onChange={handleBatchVisaTypeChange}
                        renderOption={renderVisaTypeOption}
                        leftSection={
                          batchVisaType ? (
                            <CountryFlagImage countryCode={resolveCountryCode(batchVisaType) || undefined} name={batchVisaType} size="sm" />
                          ) : (
                            <Globe size={14} className="text-slate-400" />
                          )
                        }
                        leftSectionPointerEvents="none"
                        searchable
                        clearable
                        placeholder={isAr ? 'اختر التأشيرة' : 'Select visa'}
                        radius="md"
                        size="xs"
                        styles={{
                          input: {
                            height: 38,
                            fontSize: 12,
                            fontWeight: 600,
                            borderColor: '#E5E7EB',
                            borderRadius: 9,
                            backgroundColor: '#FFFFFF',
                            color: '#0F172A',
                            paddingInlineStart: 34,
                          },
                          dropdown: {
                            borderRadius: 12,
                            boxShadow: '0 10px 30px rgba(15,23,42,0.12)',
                            border: '1px solid #E5E7EB',
                            zIndex: 99999,
                          },
                          option: {
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 600,
                            padding: '6px 10px',
                          },
                        }}
                        comboboxProps={{ withinPortal: true, zIndex: 99999 }}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        {isAr ? `سعر الشراء (${currency})` : `Buy Fare (${currency})`}
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={formatDisplayWithCommas(batchBuy)}
                        onChange={(e) => {
                          const raw = normalizeArabicNumbers(e.target.value).replace(/,/g, '');
                          if (raw === '' || !isNaN(Number(raw))) {
                            setBatchBuy(raw);
                          }
                        }}
                        placeholder="0"
                        className="w-full h-[38px] px-3 rounded-[9px] border border-[#E5E7EB] bg-white text-xs font-black text-[#0F172A] outline-none hover:border-[#D1D5DB] focus:border-[#F45A0A] focus:ring-2 focus:ring-[#F45A0A]/10 transition-all text-center tabular-nums"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        {isAr ? `سعر البيع (${currency})` : `Sell Fare (${currency})`}
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={formatDisplayWithCommas(batchSell)}
                        onChange={(e) => {
                          const raw = normalizeArabicNumbers(e.target.value).replace(/,/g, '');
                          if (raw === '' || !isNaN(Number(raw))) {
                            setBatchSell(raw);
                          }
                        }}
                        placeholder="0"
                        className="w-full h-[38px] px-3 rounded-[9px] border border-[#E5E7EB] bg-white text-xs font-black text-[#0F172A] outline-none hover:border-[#D1D5DB] focus:border-[#F45A0A] focus:ring-2 focus:ring-[#F45A0A]/10 transition-all text-center tabular-nums"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        {isAr ? 'حالة التأشيرة' : 'Visa Status'}
                      </label>
                      <Select
                        data={[
                          { value: 'NotIssued', label: isAr ? 'غير صادر' : 'Not Issued' },
                          { value: 'Issued', label: isAr ? 'صادر' : 'Issued' },
                        ]}
                        value={batchStatus}
                        onChange={(val) => setBatchStatus((val as any) || 'NotIssued')}
                        radius="md"
                        size="xs"
                        styles={{
                          input: {
                            height: 38,
                            fontSize: 12,
                            fontWeight: 600,
                            borderColor: '#E5E7EB',
                            borderRadius: 9,
                            backgroundColor: '#FFFFFF',
                            color: '#0F172A',
                          },
                          dropdown: {
                            borderRadius: 12,
                            boxShadow: '0 10px 30px rgba(15,23,42,0.12)',
                            border: '1px solid #E5E7EB',
                            zIndex: 99999,
                          },
                          option: {
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 600,
                            padding: '8px 12px',
                          },
                        }}
                        comboboxProps={{ withinPortal: true, zIndex: 99999 }}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <Button
                        size="xs"
                        color="orange"
                        fullWidth
                        onClick={handleApplyBatchPricing}
                        styles={{
                          root: {
                            height: 38,
                            minHeight: 38,
                            maxHeight: 38,
                          },
                        }}
                        className="bg-[#F45A0A] hover:bg-orange-600 h-[38px] min-h-[38px] rounded-[9px] font-bold text-xs text-white cursor-pointer shadow-2xs leading-none whitespace-nowrap"
                      >
                        {isAr ? 'تطبيق على الجميع' : 'Apply to All'}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Travelers Table (Only Required Fields with Portal Selects) */}
                <div id="field-passengers-table" className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className={`w-full text-${direction === 'rtl' ? 'right' : 'left'} border-collapse text-xs whitespace-nowrap`}>
                      <thead>
                        <tr className="h-10 bg-slate-50 border-b border-slate-200 text-slate-700 font-extrabold text-[11.5px] whitespace-nowrap">
                          <th className="px-2 py-2 text-center w-8 whitespace-nowrap">#</th>
                          <th className="px-3 py-2 min-w-[200px] whitespace-nowrap">{isAr ? 'اسم المسافر (كما في الجواز) *' : 'Traveler Full Name *'}</th>
                          <th className="px-2 py-2 min-w-[130px] text-center whitespace-nowrap">{isAr ? 'رقم الجواز (Passport #) *' : 'Passport Number *'}</th>
                          <th className="px-2 py-2 min-w-[140px] w-[140px] text-center whitespace-nowrap">{isAr ? 'نوع التأشيرة / الوجهة' : 'Visa Destination'}</th>
                          <th className="px-2 py-2 min-w-[135px] text-center whitespace-nowrap">{isAr ? 'رقم الطلب (إن وجد)' : 'Application / Order #'}</th>
                          <th className="px-2 py-2 min-w-[110px] text-center whitespace-nowrap">{isAr ? `سعر الشراء (${currency})` : `Buy Fare (${currency})`}</th>
                          <th className="px-2 py-2 min-w-[110px] text-center whitespace-nowrap">{isAr ? `سعر البيع (${currency})` : `Sell Fare (${currency})`}</th>
                          <th className="px-2 py-2 min-w-[120px] text-center whitespace-nowrap">{isAr ? 'الربح' : 'Profit'}</th>
                          <th className="px-2 py-2 min-w-[85px] w-[85px] text-center whitespace-nowrap">{isAr ? 'حالة التأشيرة' : 'Status'}</th>
                          <th className="px-2 py-2 text-center w-10 whitespace-nowrap">{isAr ? 'حذف' : 'Del'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {passengers.map((p, idx) => {
                          const buyVal = Number(p.fareBuy) || 0;
                          const sellVal = Number(p.fareSell) || 0;
                          const lineProfit = sellVal - buyVal;
                          const isProfitPos = lineProfit > 0;
                          const rowPreset = p.visaType ? visaCatalogMap.get(p.visaType.trim().toLowerCase()) : null;
                          const hasPresetPrices = rowPreset && (rowPreset.defaultBuyPrice !== null || rowPreset.defaultSellPrice !== null);

                          return (
                            <tr key={p.id || idx} className="hover:bg-slate-50/70 transition-colors whitespace-nowrap">
                              {/* Index */}
                              <td className="px-2 py-2.5 text-center font-mono font-bold text-slate-400 whitespace-nowrap">
                                {idx + 1}
                              </td>

                              {/* Passenger Name */}
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                <input
                                  type="text"
                                  value={p.name}
                                  onChange={(e) => {
                                    const next = [...passengers];
                                    next[idx].name = e.target.value;
                                    setPassengers(next);
                                    markDirty();
                                  }}
                                  placeholder=""
                                  className={`w-full h-[38px] px-3 rounded-[9px] border text-xs font-bold text-[#0F172A] outline-none transition-colors whitespace-nowrap ${
                                    errors[`passenger_${idx}_name`]
                                      ? 'border-red-500 bg-red-50/50'
                                      : 'border-slate-200 bg-white hover:border-slate-300 focus:border-[#F45A0A]'
                                  }`}
                                />
                              </td>

                              {/* Passport Number */}
                              <td className="px-2 py-2.5 whitespace-nowrap">
                                <input
                                  type="text"
                                  dir="ltr"
                                  value={p.passportNumber}
                                  onChange={(e) => {
                                    const next = [...passengers];
                                    next[idx].passportNumber = e.target.value.toUpperCase();
                                    setPassengers(next);
                                    markDirty();
                                  }}
                                  placeholder=""
                                  className={`w-full h-[38px] px-2 rounded-[9px] border text-xs font-mono font-black uppercase text-[#0F172A] outline-none transition-colors text-center whitespace-nowrap ${
                                    errors[`passenger_${idx}_passport`]
                                      ? 'border-red-500 bg-red-50/50'
                                      : 'border-slate-200 bg-white hover:border-slate-300 focus:border-[#F45A0A]'
                                  }`}
                                />
                              </td>

                              {/* Visa Destination Mantine Select with Body Portal (Compact) */}
                              <td className="px-2 py-2.5 min-w-[140px] w-[140px] whitespace-nowrap">
                                <Select
                                  data={visaTypeOptions}
                                  value={p.visaType || null}
                                  onChange={(val) => handleRowVisaTypeChange(idx, val)}
                                  renderOption={renderVisaTypeOption}
                                  leftSection={
                                    p.visaType ? (
                                      <CountryFlagImage countryCode={resolveCountryCode(p.visaType) || undefined} name={p.visaType} size="sm" />
                                    ) : undefined
                                  }
                                  leftSectionPointerEvents="none"
                                  searchable
                                  clearable
                                  placeholder={isAr ? 'اختر التأشيرة' : 'Select visa'}
                                  radius="md"
                                  size="xs"
                                  styles={{
                                    input: {
                                      height: 38,
                                      fontSize: 11.5,
                                      fontWeight: 700,
                                      borderColor: '#E5E7EB',
                                      borderRadius: 9,
                                      backgroundColor: '#FFFFFF',
                                      color: '#0F172A',
                                      paddingInlineStart: p.visaType ? 30 : undefined,
                                    },
                                    dropdown: {
                                      borderRadius: 12,
                                      boxShadow: '0 10px 30px rgba(15,23,42,0.12)',
                                      border: '1px solid #E5E7EB',
                                      zIndex: 99999,
                                    },
                                    option: {
                                      borderRadius: 8,
                                      fontSize: 11.5,
                                      fontWeight: 700,
                                      padding: '6px 8px',
                                    },
                                  }}
                                  comboboxProps={{ withinPortal: true, zIndex: 99999 }}
                                />
                              </td>

                              {/* Order / Application # (Per Passenger) */}
                              <td className="px-2 py-2.5 whitespace-nowrap">
                                <input
                                  type="text"
                                  dir="ltr"
                                  value={p.orderNumber || ''}
                                  onChange={(e) => {
                                    const next = [...passengers];
                                    next[idx].orderNumber = e.target.value;
                                    setPassengers(next);
                                    markDirty();
                                  }}
                                  placeholder=""
                                  className="w-full h-[38px] px-2 rounded-[9px] border border-slate-200 bg-white text-xs font-mono font-bold text-[#0F172A] outline-none hover:border-slate-300 focus:border-[#F45A0A] text-center whitespace-nowrap"
                                />
                              </td>

                              {/* Buy Fare with 1-Click Preset Apply */}
                              <td className="px-2 py-2.5 whitespace-nowrap">
                                <div className="relative flex items-center">
                                  <input
                                    type="text"
                                    dir="ltr"
                                    value={p.fareBuy !== null && p.fareBuy !== undefined ? formatDisplayWithCommas(p.fareBuy) : ''}
                                    onChange={(e) => {
                                      const raw = normalizeArabicNumbers(e.target.value).replace(/,/g, '');
                                      const next = [...passengers];
                                      next[idx].fareBuy = raw === '' || isNaN(Number(raw)) ? null : Number(raw);
                                      setPassengers(next);
                                      markDirty();
                                    }}
                                    placeholder="0"
                                    className="w-full h-[38px] px-2 rounded-[9px] border border-slate-200 bg-white text-xs font-black text-[#0F172A] outline-none hover:border-slate-300 focus:border-[#F45A0A] text-center tabular-nums whitespace-nowrap"
                                  />
                                  {hasPresetPrices && (
                                    <Tooltip label={isAr ? `تطبيق السعر المثبت (${formatDisplayWithCommas(rowPreset?.defaultBuyPrice) ?? '—'})` : 'Apply preset buy price'} withArrow>
                                      <button
                                        type="button"
                                        onClick={() => handleApplyPresetToRow(idx)}
                                        className={`absolute ${direction === 'rtl' ? 'left-1' : 'right-1'} top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#F45A0A] p-1 rounded cursor-pointer transition-colors`}
                                      >
                                        <Zap size={12} className="stroke-[2.5]" />
                                      </button>
                                    </Tooltip>
                                  )}
                                </div>
                              </td>

                              {/* Sell Fare */}
                              <td className="px-2 py-2.5 whitespace-nowrap">
                                <input
                                  type="text"
                                  dir="ltr"
                                  value={p.fareSell !== null && p.fareSell !== undefined ? formatDisplayWithCommas(p.fareSell) : ''}
                                  onChange={(e) => {
                                    const raw = normalizeArabicNumbers(e.target.value).replace(/,/g, '');
                                    const next = [...passengers];
                                    next[idx].fareSell = raw === '' || isNaN(Number(raw)) ? null : Number(raw);
                                    setPassengers(next);
                                    markDirty();
                                  }}
                                  placeholder="0"
                                  className={`w-full h-[38px] px-2 rounded-[9px] border text-xs font-black text-[#0F172A] outline-none text-center tabular-nums whitespace-nowrap ${
                                    errors[`passenger_${idx}_fareSell`]
                                      ? 'border-red-500 bg-red-50/50'
                                      : 'border-slate-200 bg-white hover:border-slate-300 focus:border-[#F45A0A]'
                                  }`}
                                />
                              </td>

                              {/* Net Profit (Strict single-line horizontal badge) */}
                              <td className="px-2 py-2.5 font-mono font-black text-xs tabular-nums text-center whitespace-nowrap min-w-[120px]" dir="ltr">
                                <span
                                  className={`whitespace-nowrap inline-flex items-center justify-center gap-1 font-mono font-black text-xs px-2 py-1 rounded-md ${
                                    isProfitPos
                                      ? 'text-emerald-700 bg-emerald-50 border border-emerald-200/80'
                                      : lineProfit < 0
                                      ? 'text-rose-700 bg-rose-50 border border-rose-200/80'
                                      : 'text-slate-700 bg-slate-50 border border-slate-200/80'
                                  }`}
                                >
                                  {isProfitPos ? '+' : ''}
                                  {Number(lineProfit).toLocaleString('en-US')} {currency}
                                </span>
                              </td>

                              {/* Status Toggle Badge Button: صادر / غير صادر (Compact) */}
                              <td className="px-1.5 py-2.5 text-center min-w-[85px] w-[85px] whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = [...passengers];
                                    next[idx].status = p.status === 'Issued' ? 'NotIssued' : 'Issued';
                                    setPassengers(next);
                                    markDirty();
                                  }}
                                  className={`inline-flex items-center justify-center w-full h-[34px] px-1.5 rounded-[8px] text-[11px] font-black tracking-tight transition-all cursor-pointer border whitespace-nowrap ${
                                    p.status === 'Issued'
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                      : 'bg-[#FFF3E8] text-[#F45A0A] border-[#FFD8B2] hover:bg-orange-100'
                                  }`}
                                >
                                  {p.status === 'Issued' ? (isAr ? '✓ صادر' : '✓ Issued') : (isAr ? '○ غير صادر' : '○ Not Issued')}
                                </button>
                              </td>


                              {/* Delete Row */}
                              <td className="px-3 py-2.5 text-center">
                                <button
                                  type="button"
                                  disabled={passengers.length === 1}
                                  onClick={() => {
                                    if (passengers.length > 1) {
                                      setPassengers(passengers.filter((_, pIdx) => pIdx !== idx));
                                      markDirty();
                                    }
                                  }}
                                  className="text-slate-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed p-1 cursor-pointer transition-colors"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* ── CARD 3: ATTACHMENTS & REMARKS ── */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-5 space-y-4 font-sans">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center font-bold shrink-0">
                      <FileText size={18} />
                    </div>
                    <div>
                      <h3 className="font-bold text-[16.5px] text-[#111827] leading-tight">
                        {isAr ? 'المرفقات والملاحظات' : 'Attachments & Remarks'}
                      </h3>
                      <span className="text-[12px] text-[#6B7280] font-normal">
                        {isAr ? 'إرفاق صور الجوازات والتأشيرات وكتابة الملاحظات' : 'Upload passport copies, visa documents, and remarks'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                  <div className="h-full">
                    <TicketAttachmentsSection
                      attachments={attachments}
                      onChange={(updatedAtts) => {
                        setAttachments(updatedAtts);
                        markDirty();
                      }}
                    />
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-col h-full font-sans text-xs space-y-3">
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <FileText size={18} className="text-slate-600" />
                        <h4 className="font-bold text-[15px] text-slate-900 leading-tight">
                          {isAr ? 'ملاحظات المعاملة' : 'Remarks'}
                        </h4>
                      </div>
                      <span className="text-[11.5px] text-slate-400 font-normal">
                        {isAr ? 'تظهر في الطباعة' : 'Printed on voucher'}
                      </span>
                    </div>

                    <div className="flex-1 flex flex-col pt-0.5">
                      <Textarea
                        value={notes}
                        onChange={(e) => {
                          setNotes(e.target.value);
                          markDirty();
                        }}
                        placeholder=""
                        radius="md"
                        className="flex-1 flex flex-col h-full"
                        styles={{
                          root: { flex: 1, display: 'flex', flexDirection: 'column' },
                          wrapper: { flex: 1, display: 'flex', flexDirection: 'column' },
                          input: {
                            flex: 1,
                            height: '100% !important',
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
                </div>
              </div>

            </div>

            {/* ── STICKY SIDEBAR (360px Width) ── */}
            <div className="xl:sticky xl:top-4">
              <VisaFinancialSummary
                invoiceNumber={invoiceNumber}
                status={status}
                visaDestination={activeVisaDestinations.join('، ') || visaDestination}
                visaDestinations={activeVisaDestinations}
                issueDate={issueDate}
                passengersCount={passengers.length}
                passengersNamedCount={passengersNamedCount}
                totalBuy={totalBuy}
                totalSell={totalSell}
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

      {/* ── 3. FIXED BOTTOM ACTIONS BAR (60px Height) ── */}
      <footer className="h-[60px] bg-white border-t border-[#E5E7EB] px-6 flex items-center justify-between shrink-0 shadow-2xs z-20 font-sans">
        {/* Leading Info */}
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-medium">
              {isAr ? 'صافي الفاتورة:' : 'Net Total:'}
            </span>
            <span className="font-mono font-bold text-[15px] text-slate-900" dir="ltr">
              {formatAmount(Math.max(0, totalSell - discountAmount))}
            </span>
          </div>

          <span className="text-slate-300">|</span>

          <div className="flex items-center gap-2 text-slate-400 text-[11.5px]">
            <span>{isAr ? 'Ctrl+S: حفظ مسودة' : 'Ctrl+S: Save Draft'}</span>
            <span>•</span>
            <span>{isAr ? 'Ctrl+Enter: اعتماد' : 'Ctrl+Enter: Post'}</span>
          </div>
        </div>

        {/* Trailing Buttons */}
        <div className="flex items-center gap-2.5">
          <Button
            size="xs"
            variant="subtle"
            color="gray"
            radius="md"
            onClick={handleRequestClose}
            disabled={submittingAction !== null}
            className="font-medium text-xs text-slate-600 hover:text-slate-900 h-9 px-3 cursor-pointer disabled:opacity-50"
          >
            {isAr ? 'إلغاء ومغادرة' : 'Cancel & Exit'}
          </Button>

          <Button
            size="xs"
            variant="default"
            radius="md"
            leftSection={<Save size={14} />}
            onClick={() => {
              setSubmittingAction('DRAFT');
              saveMutation.mutate('DRAFT');
            }}
            loading={submittingAction === 'DRAFT'}
            disabled={submittingAction !== null}
            className="font-medium text-xs border-slate-300 text-slate-800 hover:bg-slate-50 h-9 px-4 rounded-[8px] cursor-pointer disabled:opacity-50"
          >
            {isAr ? 'حفظ كمسودة' : 'Save as Draft'}
          </Button>

          <Button
            size="xs"
            color="orange"
            variant="filled"
            radius="md"
            leftSection={<Check size={15} />}
            onClick={() => {
              setSubmittingAction('POSTED');
              saveMutation.mutate('POSTED');
            }}
            loading={submittingAction === 'POSTED'}
            disabled={submittingAction !== null}
            className="bg-[#F45A0A] hover:bg-orange-600 font-semibold text-xs text-white shadow-xs cursor-pointer h-9 px-5 rounded-[8px] disabled:opacity-50"
          >
            {isAr ? 'اعتماد وترحيل' : 'Post & Finalize'}
          </Button>
        </div>
      </footer>

      {/* ── MODALS: SMART IMPORT, AUDIT LOG, UNSAVED CHANGES, CURRENCY SWITCH ── */}
      <SmartVisaImportModal
        opened={smartImportOpen}
        onClose={() => setSmartImportOpen(false)}
        onImport={handleSmartImport}
        defaultVisaType={visaDestination}
        availableVisaTypes={availableVisaTypes}
      />

      <AccountReconciliationModal
        opened={reconciliationModalOpen}
        onClose={() => {
          setReconciliationModalOpen(false);
          setPendingImportData(null);
          setUnmatchedCustomerData(null);
          setUnmatchedSupplierData(null);
        }}
        unmatchedCustomer={unmatchedCustomerData}
        unmatchedSupplier={unmatchedSupplierData}
        onApplyMatches={handleApplyReconciliationMatches}
      />

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
            <span>{isAr ? 'إعدادات صفحة التأشيرات' : 'Visa page settings'}</span>
          </div>
        }
      >
        <div className="space-y-4 font-sans text-xs">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-600 leading-relaxed">
            {isAr
              ? 'تُحفظ هذه الخيارات على هذا الجهاز وتُطبَّق تلقائياً عند إنشاء معاملة تأشيرات جديدة، وهي مستقلة عن إعدادات صفحة التذاكر.'
              : 'These options are saved on this device and applied automatically when creating a new visa transaction. They are independent of the ticket page settings.'}
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
                (c: any) => c.id === val || c.accountId === val || c.code === val || c.nameAr === val || c.nameEn === val || c.name === val,
              );
              setDraftPageSettings((s) => ({
                ...s,
                defaultCustomerId: (found as any)?.id || (found as any)?.accountId || '',
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
            description={isAr ? 'عند اختيار موظف الإصدار يُعبَّأ صندوقه تلقائياً' : 'Selecting the issuing employee fills their assigned cashbox'}
            color="orange"
            size="sm"
          />

          <Switch
            checked={draftPageSettings.datesDefaultToday}
            onChange={(e) => setDraftPageSettings((s) => ({ ...s, datesDefaultToday: e.currentTarget.checked }))}
            label={isAr ? 'تاريخ الإصدار وتاريخ الإدخال = اليوم' : 'Issue date and entry date default to today'}
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
                saveTicketPageSettings(draftPageSettings, user?.companyId, 'visas');
                setPageSettings(draftPageSettings);
                applyPageSettingsToForm(draftPageSettings);
                setPageSettingsOpen(false);
                showSuccessNotification(
                  isAr ? 'تم حفظ إعدادات الصفحة' : 'Page settings saved',
                  isAr ? 'ستُطبَّق هذه الإعدادات على معاملات التأشيرات الجديدة وعلى المسودة الحالية.' : 'These defaults apply to new visa transactions and the current draft.',
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
        pnr={visaDestination}
        customerName={customerName}
      />

      <UnsavedChangesModal
        opened={confirmExitOpen}
        isSaving={saveMutation.isPending}
        saveError={
          saveMutation.isError
            ? (saveMutation.error as any)?.message || (isAr ? 'تعذر حفظ التعديلات. تحقق من الاتصال وحاول مرة أخرى.' : 'Could not save changes.')
            : null
        }
        onContinueEditing={() => setConfirmExitOpen(false)}
        onSaveAndExit={handleSaveAndExit}
        onDiscardAndExit={handleDiscardAndExit}
      />

      {/* ── MODAL: MANAGE & ADD VISA TYPES CATALOG WITH COUNTRY FLAGS (SUPABASE POSTGRESQL) ── */}
      <VisaTypesManagerModal
        opened={newVisaTypeModalOpen}
        onClose={() => setNewVisaTypeModalOpen(false)}
        onSelectVisaType={(selectedName) => {
          setVisaDestination(selectedName);
          setBatchVisaType(selectedName);
          markDirty();
        }}
      />
    </div>
  );
};

export default VisaInvoiceEditorWorkspace;
