import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Modal,
  Paper,
  Button,
  Select,
  Badge,
  Tooltip,
  ActionIcon,
  Textarea,
  Loader,
  FileButton,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconId,
  IconPlus,
  IconDeviceFloppy,
  IconTrash,
  IconPrinter,
  IconUserPlus,
  IconUser,
  IconCash,
  IconCreditCard,
  IconBuildingBank,
  IconChevronRight,
  IconChevronLeft,
  IconChevronsRight,
  IconChevronsLeft,
  IconRefresh,
  IconHistory,
  IconWallet,
  IconFileInvoice,
  IconSettings,
  IconCheck,
  IconCalendar,
  IconAlertTriangle,
  IconPaperclip,
  IconPhoto,
  IconFileTypePdf,
  IconEye,
  IconDownload,
} from '@tabler/icons-react';
import { FormattedNumberInput } from '../common/FormattedNumberInput';
import { SmartAccountWizardModal } from '../accounts/SmartAccountWizardModal';
import { SmartVisaImportModal } from './SmartVisaImportModal';
import { InvoiceAuditLogModal, type AuditLogItem } from '../tickets/InvoiceAuditLogModal';
import { apiRequest } from '../../api/client';
import { ticketsApi, type TicketData } from '../../api/tickets';
import { allocateDocumentNumber, peekDocumentNumber } from '../../utils/sequenceUtils';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { useAuthStore } from '../../store/useAuthStore';
import { IconSparkles } from '@tabler/icons-react';

// Complete list of predefined visa types from system requirements
export const PREDEFINED_VISA_TYPES = [
  'فيزا تايلند',
  'فيزا دبي حرة',
  'فيزا دبي',
  'فيزا سلطنة عمان',
  'فيزا عمان',
  'فيزا مصر سياحية',
  'فيزا مصر حرة',
  'الاردنية حرة',
  'فلاي دبي',
  'ملكية اردنية',
  'فيزا اذربيجان',
  'كشف حساب تايلند',
  'فيزا الهند علاجية',
  'فيزا الهند سياحية',
  'موافقة سيارات',
  'فيزا قطر',
  'فيزا تركيا',
  'فيزا روسيا',
  'فيزا السعودية',
  'فيزا ايران',
  'فيزا اثيوبيا',
  'فيزا العراق',
  'فيزا سريلانكا',
  'فيزا كمبوديا',
  'فيزا اندونيسيا',
  'تغير استقبال',
  'تامين صحي',
  'تصريح دخول',
  'اجازة سوق دولية',
  'فيزا شنغن سياحية',
  'فيزا الصين تجارية',
  'فيزا المملكة المتحدة (بريطانيا)',
];

export interface VisaPassengerItem {
  id: string;
  name: string;
  passportNumber: string;
  visaType: string;
  personType: 'ADT' | 'CHD' | 'INF';
  status: 'Processing' | 'Issued' | 'Rejected' | 'Cancelled';
  voucherNumber: string;
  buyPrice: number | string;
  salePrice: number | string;
  supplierName?: string;
  customerName?: string;
  issueDate?: string;
  employeeName?: string;
  profit?: number | string;
  notes?: string;
}

export interface ReceiptAttachment {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'pdf';
  size?: number;
}

interface VisaIssueModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess?: (savedVisa: any) => void;
  initialVisaId?: string;
  initialVisaData?: any;
}

export const VisaIssueModal: React.FC<VisaIssueModalProps> = ({
  opened,
  onClose,
  onSuccess,
  initialVisaId,
  initialVisaData,
}) => {
  const { user } = useAuthStore();
  const loggedInUserName = user?.name || user?.email || 'علي جعفر محمود';

  // Master accounts state
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [createAccountModalOpened, setCreateAccountModalOpened] = useState(false);
  const [auditModalOpened, setAuditModalOpened] = useState(false);
  const [smartImportOpened, setSmartImportOpened] = useState(false);
  const [settingsModalOpened, setSettingsModalOpened] = useState(false);

  // Helper to get saved preferences from localStorage
  const getSavedVisaDefaults = useCallback(() => {
    try {
      const raw = localStorage.getItem('visa_form_defaults');
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.error('Failed to parse visa_form_defaults:', e);
    }
    return null;
  }, []);

  const savedPrefs = useMemo(() => getSavedVisaDefaults(), [getSavedVisaDefaults]);

  // Master Transaction Information
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [currency, setCurrency] = useState<'USD' | 'IQD'>(savedPrefs?.currency || 'USD');
  const [paymentType, setPaymentType] = useState<'DEBIT' | 'CASH'>(savedPrefs?.paymentType || 'DEBIT');
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH_HAND');
  const [exchangeRate, setExchangeRate] = useState(1530);

  // Receipt / Voucher Attachments
  const [transferImage, setTransferImage] = useState<string | null>(null);
  const [transferImagePreviewOpen, setTransferImagePreviewOpen] = useState(false);
  const [receiptAttachments, setReceiptAttachments] = useState<ReceiptAttachment[]>([]);

  const handleReceiptsUpload = useCallback((files: File[] | File | null) => {
    if (!files) return;
    const fileList = Array.isArray(files) ? files : [files];
    if (fileList.length === 0) return;

    fileList.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64Url = e.target?.result as string;
        if (!base64Url) return;
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const newAttachment: ReceiptAttachment = {
          id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          name: file.name,
          url: base64Url,
          type: isPdf ? 'pdf' : 'image',
          size: file.size,
        };
        setReceiptAttachments((prev) => [...prev, newAttachment]);
        setTransferImage(base64Url);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  // Employees
  const [entryEmployee, setEntryEmployee] = useState(loggedInUserName);
  const [issueEmployee, setIssueEmployee] = useState(loggedInUserName);

  // Parties & Cashboxes
  const [customerId, setCustomerId] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [receivingCashboxId, setReceivingCashboxId] = useState(savedPrefs?.receivingCashboxId || '');
  const [paymentCashboxId, setPaymentCashboxId] = useState(savedPrefs?.paymentCashboxId || '');

  // Configured Payment Methods from System Settings
  const [configuredPaymentMethods, setConfiguredPaymentMethods] = useState<{ id: string; nameAr: string; targetAccountId?: string }[]>([
    { id: 'CASH_HAND', nameAr: 'كاش باليد (نقدي)', targetAccountId: 'EMPLOYEE_ASSIGNED' },
  ]);

  // Discount & Notes
  const [discountType, setDiscountType] = useState<'AMOUNT' | 'PERCENT'>('AMOUNT');
  const [discountValue, setDiscountValue] = useState<number | string>(0);
  const [generalNotes, setGeneralNotes] = useState('');

  // Bulk Visa Type state
  const [bulkVisaType, setBulkVisaType] = useState(savedPrefs?.visaType || 'فيزا تايلند');

  // Default 1 passenger row
  const createDefault1Row = useCallback((visa: string = bulkVisaType): VisaPassengerItem[] => [
    {
      id: Math.random().toString(36).substring(2, 9),
      name: '',
      passportNumber: '',
      visaType: visa || 'فيزا تايلند',
      personType: 'ADT',
      status: 'Processing',
      voucherNumber: '',
      buyPrice: 0,
      salePrice: 0,
      notes: '',
    },
  ], [bulkVisaType]);

  // Multi-Passenger Grid State initialized with 1 clean row
  const [passengersList, setPassengersList] = useState<VisaPassengerItem[]>(() => createDefault1Row(savedPrefs?.visaType || 'فيزا تايلند'));

  const [saving, setSaving] = useState(false);

  // Apply visa type to all existing rows
  const handleApplyVisaTypeToAll = (newType: string) => {
    setBulkVisaType(newType);
    setPassengersList((prev) =>
      prev.map((p) => ({
        ...p,
        visaType: newType,
      }))
    );
  };

  // Load Accounts & Settings from database
  const loadAccounts = useCallback(async () => {
    try {
      setLoadingAccounts(true);
      const [accData, methodsData] = await Promise.all([
        apiRequest('/api/accounts').catch(() => []),
        apiRequest('/api/print-templates/payment_methods_mapping').catch(() => null),
      ]);

      if (Array.isArray(accData)) {
        setAccounts(accData);
      }

      if (methodsData && methodsData.config && Array.isArray(methodsData.config.mappings)) {
        const active = methodsData.config.mappings.filter((m: any) => m.isActive !== false);
        if (active.length > 0) {
          setConfiguredPaymentMethods(active.map((m: any) => ({
            id: m.key === 'CASH_HAND' || m.targetAccountId === 'EMPLOYEE_ASSIGNED' ? 'CASH_HAND' : m.targetAccountId || m.id || m.key,
            nameAr: m.nameAr,
            targetAccountId: m.targetAccountId,
          })));
        }
      }
    } catch (e) {
      console.error('Failed to fetch accounts & payment methods:', e);
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  useEffect(() => {
    if (opened) {
      loadAccounts();
    }
  }, [opened, loadAccounts]);

  // Filter Accounts by types - Strictly exclude groups/parents
  const customerAccounts = useMemo(() => {
    return accounts.filter((a) => {
      if (a.isGroup || a.isParent) return false;
      const isClientGroup =
        a.type === 'CUSTOMERS' ||
        a.category === 'CUSTOMERS' ||
        a.type === 'CLIENT' ||
        a.category === 'CURRENT_ASSETS' ||
        a.code?.startsWith('12');
      const isSupplier = a.type === 'SUPPLIERS' || a.category === 'SUPPLIERS' || a.code?.startsWith('21');
      return isClientGroup && !isSupplier;
    });
  }, [accounts]);

  const supplierAccounts = useMemo(() => {
    return accounts.filter((a) => {
      if (a.isGroup || a.isParent) return false;
      return (
        a.type === 'SUPPLIERS' ||
        a.category === 'SUPPLIERS' ||
        a.category === 'CURRENT_LIABILITIES' ||
        a.code?.startsWith('21') ||
        a.nameAr?.includes('مورد') ||
        a.nameAr?.includes('شركة') ||
        a.nameAr?.includes('طيران')
      );
    });
  }, [accounts]);

  const cashboxAccounts = useMemo(() => {
    return accounts.filter((a) => {
      if (a.isGroup || a.isParent) return false;
      return (
        a.type === 'CASH' ||
        a.type === 'BANK' ||
        a.category === 'CASH_AND_EQUIVALENTS' ||
        a.code?.startsWith('11') ||
        a.nameAr?.includes('صندوق') ||
        a.nameAr?.includes('مصرف') ||
        a.nameAr?.includes('قاصة') ||
        a.nameAr?.includes('كاش')
      );
    });
  }, [accounts]);

  // Preselect defaults when accounts are loaded
  useEffect(() => {
    if (!opened) return;

    if (accounts.length > 0) {
      if (!receivingCashboxId) {
        const defaultCashbox =
          cashboxAccounts.find((b) => b.isDefault || b.nameAr?.includes('الرئيسي') || b.nameAr?.includes('الكاش')) ||
          cashboxAccounts[0];
        if (defaultCashbox) setReceivingCashboxId(defaultCashbox.id);
      }

      if (!paymentCashboxId) {
        const defaultPayBox =
          cashboxAccounts.find((b) => b.isDefault || b.nameAr?.includes('الرئيسي') || b.nameAr?.includes('الكاش')) ||
          cashboxAccounts[0];
        if (defaultPayBox) setPaymentCashboxId(defaultPayBox.id);
      }

      if (!supplierId) {
        const defaultSup =
          supplierAccounts.find((s) => s.nameAr?.includes('العراق') || s.nameAr?.includes('دبي')) ||
          supplierAccounts[0];
        if (defaultSup) setSupplierId(defaultSup.id);
      }
    }
  }, [accounts, opened, cashboxAccounts, supplierAccounts, receivingCashboxId, paymentCashboxId, supplierId]);

  // Visa records list for seamless navigation
  const [visaList, setVisaList] = useState<any[]>([]);
  const [currentVisaIndex, setCurrentVisaIndex] = useState<number>(-1);
  const [activeVisaId, setActiveVisaId] = useState<string | undefined>(initialVisaId);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadVisaList = useCallback(async () => {
    try {
      const data = await apiRequest('/api/tickets');
      if (Array.isArray(data)) {
        const visas = data.filter((t: any) => t.tripType === 'VISA');
        setVisaList(visas);
        if (activeVisaId) {
          const idx = visas.findIndex((v: any) => v.id === activeVisaId || v.invoiceNumber === activeVisaId);
          if (idx !== -1) setCurrentVisaIndex(idx);
        }
      }
    } catch (e) {
      console.error('Failed to load visa list:', e);
    }
  }, [activeVisaId]);

  const handleConfirmDeleteCurrentVisa = async () => {
    const targetVisa = visaList[currentVisaIndex];
    if (!targetVisa?.id) return;
    try {
      setDeleting(true);
      await apiRequest(`/api/tickets/${targetVisa.id}`, { method: 'DELETE' });
      showSuccessNotification('تم الحذف', 'تم حذف معاملة التأشيرة بنجاح.');
      setDeleteConfirmOpen(false);
      loadVisaList();
      handleResetForm();
      setCurrentVisaIndex(-1);
    } catch (err: any) {
      showErrorNotification('خطأ في الحذف', err.message || 'فشل حذف المعاملة');
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (opened) {
      loadVisaList();
    }
  }, [opened, loadVisaList]);

  const loadVisaRecord = useCallback((record: any, index: number) => {
    if (!record) return;
    setCurrentVisaIndex(index);
    setActiveVisaId(record.id);
    if (record.invoiceNumber) setInvoiceNumber(record.invoiceNumber);
    else peekDocumentNumber('visas').then(setInvoiceNumber);
    setIssueDate(
      record.issueDate
        ? new Date(record.issueDate).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10)
    );
    setCurrency(record.currency || 'USD');
    setPaymentType(record.paymentType || 'DEBIT');
    setPaymentMethod(record.paymentMethod || 'CASH_HAND');
    setDiscountType(record.discountType || 'AMOUNT');
    setDiscountValue(record.discountValue || 0);
    setGeneralNotes(record.notes || '');
    setReceivingCashboxId(record.cashbox || '');
    setPaymentCashboxId(record.receivingCashbox || '');
    setEntryEmployee(record.entryEmployee || loggedInUserName);
    setIssueEmployee(record.employeeName || loggedInUserName);

    // Load receipt attachments
    if (record.transferImage || (record as any).receiptImage) {
      const raw = record.transferImage || (record as any).receiptImage;
      setTransferImage(raw);
      if (typeof raw === 'string' && (raw.startsWith('[') || raw.startsWith('{'))) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setReceiptAttachments(parsed);
          }
        } catch {
          setReceiptAttachments([{ id: '1', name: 'وصل التسديد', url: raw, type: raw.includes('pdf') ? 'pdf' : 'image' }]);
        }
      } else if (raw) {
        setReceiptAttachments([{ id: '1', name: 'وصل التسديد', url: raw, type: raw.includes('pdf') ? 'pdf' : 'image' }]);
      }
    } else {
      setReceiptAttachments([]);
      setTransferImage(null);
    }

    // Match customer & supplier by ID or name
    const foundCust = accounts.find(
      (a) => a.id === record.customerName || a.nameAr === record.customerName || a.id === record.agentName || a.nameAr === record.agentName
    );
    if (foundCust) setCustomerId(foundCust.id);
    else setCustomerId(record.customerName || record.agentName || '');

    const foundSup = accounts.find(
      (a) => a.id === record.supplierAccount || a.nameAr === record.supplierAccountName || a.id === record.supplierAccountName
    );
    if (foundSup) setSupplierId(foundSup.id);
    else setSupplierId(record.supplierAccount || '');

    if (Array.isArray(record.passengers) && record.passengers.length > 0) {
      setPassengersList(
        record.passengers.map((p: any) => ({
          id: p.id || Math.random().toString(36).substring(2, 9),
          name: p.name || '',
          passportNumber: p.documentNumber || p.passportNumber || '',
          visaType: p.pnr || p.visaType || bulkVisaType || 'فيزا تايلند',
          personType: p.ticketType || 'ADT',
          status: p.status || 'Processing',
          voucherNumber: p.ticketNumber || '',
          buyPrice: p.fareBuy || 0,
          salePrice: p.fareSell || 0,
          notes: p.notes || '',
        }))
      );
    } else {
      setPassengersList(createDefault1Row(bulkVisaType));
    }
  }, [accounts, loggedInUserName, bulkVisaType, createDefault1Row]);

  const handleNavigateFirst = () => {
    if (visaList.length === 0) return;
    loadVisaRecord(visaList[0], 0);
  };

  const handleNavigatePrevious = () => {
    if (visaList.length === 0) return;
    const nextIdx = currentVisaIndex <= 0 ? 0 : currentVisaIndex - 1;
    loadVisaRecord(visaList[nextIdx], nextIdx);
  };

  const handleNavigateNext = () => {
    if (visaList.length === 0) return;
    if (currentVisaIndex === -1) {
      loadVisaRecord(visaList[0], 0);
      return;
    }
    const nextIdx = currentVisaIndex >= visaList.length - 1 ? visaList.length - 1 : currentVisaIndex + 1;
    loadVisaRecord(visaList[nextIdx], nextIdx);
  };

  const handleNavigateLast = () => {
    if (visaList.length === 0) return;
    loadVisaRecord(visaList[visaList.length - 1], visaList.length - 1);
  };

  // Generate sequence invoice number on open
  useEffect(() => {
    if (opened && !initialVisaId && currentVisaIndex === -1) {
      peekDocumentNumber('visas').then(setInvoiceNumber);
    }
  }, [opened, initialVisaId, currentVisaIndex]);

  // Reset form
  const handleResetForm = () => {
    peekDocumentNumber('visas').then(setInvoiceNumber);
    setCurrentVisaIndex(-1);
    setActiveVisaId(undefined);

    setIssueDate(new Date().toISOString().slice(0, 10));
    setCustomerId('');
    setCustomerPhone('');
    setPaymentType('DEBIT');
    setPaymentMethod('CASH_HAND');
    setReceiptAttachments([]);
    setTransferImage(null);
    setDiscountValue(0);
    setGeneralNotes('');
    setPassengersList(createDefault1Row(bulkVisaType));
  };

  // Initial load
  useEffect(() => {
    if (opened) {
      if (initialVisaData) {
        setActiveVisaId(initialVisaData.id);
        if (initialVisaData.invoiceNumber) setInvoiceNumber(initialVisaData.invoiceNumber);
        else peekDocumentNumber('visas').then(setInvoiceNumber);
        setIssueDate(
          initialVisaData.issueDate
            ? new Date(initialVisaData.issueDate).toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10)
        );
        setCurrency(initialVisaData.currency || 'USD');
        setPaymentType(initialVisaData.paymentType || 'DEBIT');
        setPaymentMethod(initialVisaData.paymentMethod || 'CASH_HAND');
        setDiscountType(initialVisaData.discountType || 'AMOUNT');
        setDiscountValue(initialVisaData.discountValue || 0);
        setGeneralNotes(initialVisaData.notes || '');
        setReceivingCashboxId(initialVisaData.cashbox || '');
        setPaymentCashboxId(initialVisaData.receivingCashbox || '');
        setEntryEmployee(initialVisaData.entryEmployee || loggedInUserName);
        setIssueEmployee(initialVisaData.employeeName || loggedInUserName);

        // Load attachments if any
        if (initialVisaData.transferImage || (initialVisaData as any).receiptImage) {
          const raw = initialVisaData.transferImage || (initialVisaData as any).receiptImage;
          setTransferImage(raw);
          if (typeof raw === 'string' && (raw.startsWith('[') || raw.startsWith('{'))) {
            try {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) {
                setReceiptAttachments(parsed);
              }
            } catch {
              setReceiptAttachments([{ id: '1', name: 'وصل التسديد', url: raw, type: raw.includes('pdf') ? 'pdf' : 'image' }]);
            }
          } else if (raw) {
            setReceiptAttachments([{ id: '1', name: 'وصل التسديد', url: raw, type: raw.includes('pdf') ? 'pdf' : 'image' }]);
          }
        } else {
          setReceiptAttachments([]);
          setTransferImage(null);
        }

        if (Array.isArray(initialVisaData.passengers) && initialVisaData.passengers.length > 0) {
          setPassengersList(
            initialVisaData.passengers.map((p: any) => ({
              id: p.id || Math.random().toString(36).substring(2, 9),
              name: p.name || '',
              passportNumber: p.documentNumber || '',
              visaType: p.pnr || bulkVisaType || 'فيزا تايلند',
              personType: p.ticketType || 'ADT',
              status: p.status || 'Processing',
              voucherNumber: p.ticketNumber || '',
              buyPrice: p.fareBuy || 0,
              salePrice: p.fareSell || 0,
              notes: p.notes || '',
            }))
          );
        } else {
          setPassengersList(createDefault1Row(bulkVisaType));
        }
      } else {
        handleResetForm();
      }
    }
  }, [opened, initialVisaData, loggedInUserName, bulkVisaType]);

  // Auto-fill customer phone
  useEffect(() => {
    if (customerId) {
      const found = accounts.find((a) => a.id === customerId);
      if (found?.phone) setCustomerPhone(found.phone);
      else setCustomerPhone('');
    }
  }, [customerId, accounts]);

  // ── Multi-Line Passenger Handlers ──
  const handleAddPassengerLine = () => {
    const newLine: VisaPassengerItem = {
      id: Math.random().toString(36).substring(2, 9),
      name: '',
      passportNumber: '',
      visaType: bulkVisaType || 'فيزا تايلند',
      personType: 'ADT',
      status: 'Processing',
      voucherNumber: '',
      buyPrice: 0,
      salePrice: 0,
      notes: '',
    };
    setPassengersList((prev) => [...prev, newLine]);
  };

  const handleRemovePassengerLine = (id: string) => {
    if (passengersList.length <= 1) return;
    setPassengersList((prev) => prev.filter((p) => p.id !== id));
  };

  const handlePassengerChange = (id: string, field: keyof VisaPassengerItem, value: any) => {
    setPassengersList((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          return { ...p, [field]: value };
        }
        return p;
      })
    );
  };

  // ── Financial Calculations ──
  const sumBuy = useMemo(() => {
    return passengersList.reduce((acc, p) => acc + (Number(p.buyPrice) || 0), 0);
  }, [passengersList]);

  const sumSale = useMemo(() => {
    return passengersList.reduce((acc, p) => acc + (Number(p.salePrice) || 0), 0);
  }, [passengersList]);

  const discountAmount = useMemo(() => {
    const val = Number(discountValue) || 0;
    if (discountType === 'PERCENT') {
      return (sumSale * val) / 100;
    }
    return val;
  }, [sumSale, discountValue, discountType]);

  const netSale = useMemo(() => {
    return Math.max(0, sumSale - discountAmount);
  }, [sumSale, discountAmount]);

  const netBuy = useMemo(() => sumBuy, [sumBuy]);

  const netProfit = useMemo(() => {
    return netSale - netBuy;
  }, [netSale, netBuy]);

  // ── Save to Supabase DB ──
  const handleSaveTransaction = async () => {
    const customerAcc = accounts.find((a) => a.id === customerId);
    const customerName = customerAcc?.nameAr || '';

    if (!customerName) {
      showErrorNotification('حقل مطلوب', 'يرجى اختيار العميل أو الجهة الطالبة للتأشيرة.');
      return;
    }

    const supplierAcc = accounts.find((a) => a.id === supplierId);
    const supplierName = supplierAcc?.nameAr || 'المورد المزود';

    if (!supplierId) {
      showErrorNotification('حقل مطلوب', 'يرجى اختيار المورد أو الشركة المزودة للفيزا.');
      return;
    }

    const validPassengers = passengersList.filter(
      (p) => p.name?.trim() || p.passportNumber?.trim() || Number(p.salePrice) > 0
    );

    if (validPassengers.length === 0) {
      showErrorNotification('تنبيه', 'يرجى إدخال بيانات مسافر وتأشيرة واحدة على الأقل.');
      return;
    }

    const payload: any = {
      invoiceNumber: activeVisaId && invoiceNumber ? invoiceNumber : await allocateDocumentNumber('visas'),
      issueDate: new Date(issueDate),
      customerName: customerName,
      customerAccountId: customerId,
      agentName: customerName,
      supplierAccount: supplierId,
      supplierAccountName: supplierName,
      supplierAccountId: supplierId,
      tripType: 'VISA',
      currency: currency,
      exchangeRate: exchangeRate,
      paymentType: paymentType,
      paymentMethod: paymentType === 'CASH' ? paymentMethod : undefined,
      transferImage: receiptAttachments.length > 0 ? JSON.stringify(receiptAttachments) : (transferImage || null),
      discountType: discountType,
      discountValue: Number(discountValue) || 0,
      discountAmount: discountAmount,
      totalSell: sumSale,
      totalBuy: sumBuy,
      netSell: netSale,
      netBuy: netBuy,
      profit: netProfit,
      notes: generalNotes,
      employeeName: issueEmployee || loggedInUserName,
      entryEmployee: entryEmployee || loggedInUserName,
      status: 'POSTED',
      cashbox: receivingCashboxId,
      receivingCashbox: paymentCashboxId,
      cashboxAccountId: paymentType === 'CASH' ? (paymentCashboxId || receivingCashboxId) : null,
      passengers: validPassengers.map((p) => ({
        name: p.name || 'مسافر',
        documentNumber: p.passportNumber,
        ticketType: p.personType,
        ticketNumber: p.voucherNumber,
        pnr: p.visaType,
        fareBuy: Number(p.buyPrice) || 0,
        fareSell: Number(p.salePrice) || 0,
        status: p.status,
      })),
    };

    setSaving(true);
    try {
      let result;
      const targetId = activeVisaId || initialVisaId;
      if (targetId) {
        result = await apiRequest(`/api/tickets/${targetId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        result = await ticketsApi.create(payload);
      }

      showSuccessNotification('تم الحفظ بنجاح', `تم حفظ وتوليد القيود المحاسبية لمعاملة الفيزا (${payload.invoiceNumber}) بنجاح.`);

      loadVisaList();

      if (onSuccess) {
        onSuccess(result);
      }
      onClose();
    } catch (e: any) {
      console.error('Failed to save visa transaction:', e);
      showErrorNotification('فشل الحفظ', e.message || 'حدث خطأ أثناء حفظ معاملة التأشيرات.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        size="1080px"
        padding={0}
        radius="md"
        centered
        styles={{
          content: {
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: '12px',
            border: '1px solid #cbd5e1',
            boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden',
          },
          header: {
            borderBottom: '1px solid #e2e8f0',
            padding: '8px 16px',
            backgroundColor: '#ffffff',
          },
          body: {
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            padding: 0,
          },
        }}
        title={
          <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm">
            <IconId size={18} className="text-orange-600" />
            <span>إصدار تأشيرة وفيزا جديدة (Visa Management)</span>
          </div>
        }
      >
        <div className="flex flex-col flex-1 h-full min-h-0 font-['IBM_Plex_Sans_Arabic',sans-serif] text-xs select-none" dir="rtl">
          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-[#F8FAFC]">
            {/* ═══════════════════════════════════════════════════════════════════
                1. CONTAINER: صناديق الدفع والاستلام وموظفي العملية + أزرار السجل والإعدادات
               ═══════════════════════════════════════════════════════════════════ */}
            <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-2 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-1.5">
                <div className="flex items-center gap-1.5 font-bold text-[11.5px] text-slate-700">
                  <IconBuildingBank size={13} className="text-orange-600" />
                  <span>صناديق القبض والدفع وموظفي العملية</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAuditModalOpened(true)}
                    className="h-6 px-2 rounded-[5px] text-[11px] font-bold border border-[#E5E7EB] bg-slate-50 text-slate-700 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-950 flex items-center gap-1 transition-all cursor-pointer"
                    title="سجل التدقيق والتعديلات"
                  >
                    <IconHistory size={12} className="text-orange-600" />
                    <span>السجل</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettingsModalOpened(true)}
                    className="h-6 px-2 rounded-[5px] text-[11px] font-bold border border-[#E5E7EB] bg-slate-50 text-slate-700 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-950 flex items-center gap-1 transition-all cursor-pointer"
                    title="الإعدادات الافتراضية للنافذة"
                  >
                    <IconSettings size={12} className="text-slate-600" />
                    <span>الإعدادات</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
                {/* صندوق الاستلام (القبض) */}
                <div>
                  <label className="block font-bold text-slate-600 mb-0.5 text-[11px] flex items-center gap-1">
                    <IconBuildingBank size={12} className="text-emerald-700" />
                    <span>صندوق القبض (الاستلام)</span>
                  </label>
                  <Select
                    size="xs"
                    searchable
                    placeholder="اختر صندوق الاستلام..."
                    value={receivingCashboxId}
                    onChange={(val) => setReceivingCashboxId(val || '')}
                    data={cashboxAccounts.map((b) => ({ value: b.id, label: b.nameAr }))}
                    styles={{
                      input: {
                        height: '28px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: '#ffffff',
                        borderColor: '#E5E7EB',
                        borderRadius: '5px',
                      },
                    }}
                  />
                </div>

                {/* صندوق الدفع (الصرف) */}
                <div>
                  <label className="block font-bold text-slate-600 mb-0.5 text-[11px] flex items-center gap-1">
                    <IconBuildingBank size={12} className="text-rose-700" />
                    <span>صندوق الصرف (الدفع)</span>
                  </label>
                  <Select
                    size="xs"
                    searchable
                    placeholder="اختر صندوق الدفع..."
                    value={paymentCashboxId}
                    onChange={(val) => setPaymentCashboxId(val || '')}
                    data={cashboxAccounts.map((b) => ({ value: b.id, label: b.nameAr }))}
                    styles={{
                      input: {
                        height: '28px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: '#ffffff',
                        borderColor: '#E5E7EB',
                        borderRadius: '5px',
                      },
                    }}
                  />
                </div>

                {/* موظف الإدخال (Entry Employee) */}
                <div>
                  <label className="block font-bold text-slate-600 mb-0.5 text-[11px] flex items-center gap-1">
                    <IconUser size={12} className="text-slate-500" />
                    <span>موظف الإدخال</span>
                  </label>
                  <div className="h-7 bg-slate-50 border border-[#E5E7EB] rounded-[5px] px-2 flex items-center gap-1 text-[11px] font-bold text-slate-800">
                    <span className="truncate">{entryEmployee || loggedInUserName}</span>
                  </div>
                </div>

                {/* موظف الإصدار (Issue Employee) */}
                <div>
                  <label className="block font-bold text-slate-600 mb-0.5 text-[11px] flex items-center gap-1">
                    <IconUser size={12} className="text-orange-600" />
                    <span>موظف الإصدار *</span>
                  </label>
                  <input
                    type="text"
                    value={issueEmployee}
                    onChange={(e) => setIssueEmployee(e.target.value)}
                    placeholder="اسم موظف الإصدار..."
                    className="w-full h-7 px-2 border border-[#E5E7EB] rounded-[5px] text-[11px] font-bold text-slate-800 bg-white focus:outline-hidden focus:border-orange-500 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════
                2. CONTAINER: تفاصيل الفاتورة والأطراف المالية
               ═══════════════════════════════════════════════════════════════════ */}
            <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-2.5 space-y-2 shadow-2xs">
              {/* Row 1: Payment Type + Currency + Issue Date + Invoice Ref */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 items-end">
                {/* Payment Method Switcher */}
                <div>
                  <label className="block font-bold text-slate-600 mb-0.5 text-[11px]">نوع السداد والتعامل *</label>
                  <div className="h-7 flex items-center bg-slate-100 p-0.5 rounded-[5px] border border-[#E5E7EB] gap-0.5">
                    <button
                      type="button"
                      onClick={() => setPaymentType('DEBIT')}
                      className={`flex-1 h-full rounded-[4px] text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        paymentType === 'DEBIT'
                          ? 'bg-[#F97316] text-white shadow-2xs font-black'
                          : 'text-slate-700 hover:bg-slate-200/60 bg-transparent'
                      }`}
                    >
                      <IconCreditCard size={12} />
                      <span>آجل (على الحساب)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentType('CASH')}
                      className={`flex-1 h-full rounded-[4px] text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        paymentType === 'CASH'
                          ? 'bg-[#F97316] text-white shadow-2xs font-black'
                          : 'text-slate-700 hover:bg-slate-200/60 bg-transparent'
                      }`}
                    >
                      <IconCash size={12} />
                      <span>نقدي (كاش)</span>
                    </button>
                  </div>
                </div>

                {/* Currency Switcher */}
                <div>
                  <label className="block font-bold text-slate-600 mb-0.5 text-[11px] flex items-center justify-between">
                    <span>العملة المعتمدة</span>
                    {currency === 'USD' && (
                      <span className="text-[10px] font-mono text-orange-700 font-bold">1$ = {exchangeRate.toLocaleString()}</span>
                    )}
                  </label>
                  <div className="h-7 flex items-center bg-slate-100 p-0.5 rounded-[5px] border border-[#E5E7EB] gap-0.5">
                    <button
                      type="button"
                      onClick={() => setCurrency('IQD')}
                      className={`flex-1 h-full rounded-[4px] text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        currency === 'IQD'
                          ? 'bg-[#F97316] text-white shadow-2xs font-black'
                          : 'text-slate-700 hover:bg-slate-200/60 bg-transparent'
                      }`}
                    >
                      IQD (د.ع)
                    </button>

                    <button
                      type="button"
                      onClick={() => setCurrency('USD')}
                      className={`flex-1 h-full rounded-[4px] text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        currency === 'USD'
                          ? 'bg-[#F97316] text-white shadow-2xs font-black'
                          : 'text-slate-700 hover:bg-slate-200/60 bg-transparent'
                      }`}
                    >
                      USD ($)
                    </button>
                  </div>
                </div>

                {/* Issue Date with Advanced DatePickerInput */}
                <div>
                  <DatePickerInput
                    label="تاريخ المعاملة والإصدار *"
                    size="xs"
                    value={issueDate ? new Date(issueDate) : new Date()}
                    onChange={(val) => {
                      if (val) {
                        const d = new Date(val);
                        const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                        setIssueDate(str);
                      }
                    }}
                    leftSection={<IconCalendar size={12} className="text-slate-400" />}
                    valueFormat="YYYY/MM/DD"
                    monthLabelFormat="MM / YYYY"
                    popoverProps={{ withinPortal: true, zIndex: 1000 }}
                    locale="ar"
                    styles={{
                      input: {
                        height: '28px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: '#ffffff',
                        borderColor: '#E5E7EB',
                        borderRadius: '5px',
                      },
                    }}
                  />
                </div>

                {/* Invoice Number Reference */}
                <div>
                  <label className="block font-bold text-slate-600 mb-0.5 text-[11px]">رقم الفاتورة / المرجع</label>
                  <div className="h-7 bg-slate-50 border border-[#E5E7EB] rounded-[5px] px-2 flex items-center justify-between text-[11px] font-mono font-black text-orange-700">
                    <span>{invoiceNumber}</span>
                    <Badge size="xs" color="orange" variant="light" className="font-bold">
                      VISA
                    </Badge>
                  </div>
                </div>
              </div>

              {/* If CASH: Configured payment method buttons from System Settings */}
              {paymentType === 'CASH' && (
                <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold text-slate-600 shrink-0">طرق الدفع المعتمدة:</span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {configuredPaymentMethods.map((pm) => {
                        const isSelected = paymentMethod === pm.id;
                        return (
                          <button
                            key={pm.id}
                            type="button"
                            onClick={() => {
                              setPaymentMethod(pm.id);
                              if (pm.id !== 'CASH_HAND' && pm.targetAccountId && pm.targetAccountId !== 'EMPLOYEE_ASSIGNED') {
                                setReceivingCashboxId(pm.targetAccountId);
                              }
                              // Auto-open receipt attachment modal when choosing Master/electronic payment method
                              if (pm.id !== 'CASH_HAND' || pm.nameAr?.includes('ماستر') || pm.nameAr?.toLowerCase().includes('master')) {
                                setTransferImagePreviewOpen(true);
                              }
                            }}
                            className={`h-6 px-2.5 rounded-[5px] text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                              isSelected
                                ? 'bg-[#F97316] text-white shadow-2xs font-black'
                                : 'bg-slate-50 text-slate-700 border border-[#E5E7EB] hover:bg-orange-50 hover:border-orange-200'
                            }`}
                          >
                            {isSelected && <IconCheck size={11} strokeWidth={2.5} />}
                            <span>{pm.nameAr}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* زر إرفاق الوصل ومعاينة الوصولات */}
                  <div className="flex items-center gap-1">
                    {receiptAttachments.length > 0 ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setTransferImagePreviewOpen(true)}
                          className="h-6 px-2 rounded-[5px] font-black text-[10.5px] text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95 whitespace-nowrap"
                          title="معاينة وتعديل وحذف وإضافة وصولات التسديد المرفقة"
                        >
                          <IconPaperclip size={12} className="text-emerald-700 shrink-0" />
                          <span>إرفاق وصل</span>
                          <span className="bg-emerald-600 text-white rounded-full px-1.5 py-0.2 text-[9px] font-mono leading-none">
                            {receiptAttachments.length}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReceiptAttachments([]);
                            setTransferImage(null);
                          }}
                          className="h-6 w-6 rounded-[5px] text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 flex items-center justify-center transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0"
                          title="حذف كافة الوصولات المرفقة"
                        >
                          <IconTrash size={11} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setTransferImagePreviewOpen(true)}
                        className="h-6 px-2 rounded-[5px] font-bold text-[10.5px] text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 flex items-center gap-1 transition-all cursor-pointer shadow-2xs shrink-0 active:scale-95 whitespace-nowrap"
                        title="إرفاق وصل تسديد (يدعم صور متعددة أو ملفات PDF)"
                      >
                        <IconPaperclip size={12} className="text-emerald-700 shrink-0" />
                        <span>إرفاق وصل</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Row 2: Customer (الطرف المدين) + Supplier (الطرف الدائن) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-end pt-1.5 border-t border-slate-100">
                {/* Customer Select (الطرف المدين) */}
                <div>
                  <label className="block font-bold text-slate-700 mb-0.5 text-[11px] flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                      <span>العميل / الجهة الطالبة (الطرف المدين ⬅) *</span>
                    </span>
                    {customerPhone && (
                      <span className="text-[10px] font-mono text-slate-500 font-bold">هاتف: {customerPhone}</span>
                    )}
                  </label>
                  <div className="flex items-center gap-1">
                    <div className="flex-1">
                      <Select
                        size="xs"
                        searchable
                        clearable
                        placeholder="ابحث بالاسم (عميل، شركة، مكتب، مسافر)..."
                        value={customerId}
                        onChange={(val) => setCustomerId(val || '')}
                        data={customerAccounts.map((c) => ({
                          value: c.id,
                          label: c.nameAr,
                        }))}
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
                        maxDropdownHeight={220}
                        styles={{
                          input: {
                            height: '28px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: '#ffffff',
                            borderColor: '#E5E7EB',
                            borderRadius: '5px',
                          },
                        }}
                        required
                      />
                    </div>

                    {/* زر اختيار زبون نقدي مباشرة */}
                    <button
                      type="button"
                      onClick={() => {
                        const cashAcc = customerAccounts.find(
                          (c) =>
                            c.nameAr?.includes('نقدي') ||
                            c.nameAr?.includes('كاش') ||
                            c.code === '12011' ||
                            c.nameAr?.includes('زبون')
                        ) || customerAccounts[0];
                        if (cashAcc) {
                          setCustomerId(cashAcc.id);
                        }
                        setPaymentType('CASH');
                      }}
                      className="h-7 px-2 text-[11px] font-bold border border-[#E5E7EB] bg-slate-50 text-slate-700 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-900 shrink-0 shadow-2xs rounded-[5px] flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <IconCash size={13} className="text-orange-600" />
                      <span>زبون نقدي</span>
                    </button>
                  </div>
                </div>

                {/* Supplier Select (الطرف الدائن) */}
                <div>
                  <label className="block font-bold text-slate-700 mb-0.5 text-[11px] flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span>المورد / الشركة المزودة (الطرف الدائن ➡) *</span>
                  </label>
                  <div>
                    <Select
                      size="xs"
                      searchable
                      clearable
                      placeholder="اختر المورد (بوابة العراق، السعدي، فلاي دبي...)..."
                      value={supplierId}
                      onChange={(val) => setSupplierId(val || '')}
                      data={supplierAccounts.map((s) => ({
                        value: s.id,
                        label: s.nameAr,
                      }))}
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
                      maxDropdownHeight={220}
                      styles={{
                        input: {
                          height: '28px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: '#ffffff',
                          borderColor: '#E5E7EB',
                          borderRadius: '5px',
                        },
                      }}
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

          {/* ═══════════════════════════════════════════════════════════════════
              3. CONTAINER: جدول المسافرين والتأشيرات
             ═══════════════════════════════════════════════════════════════════ */}
          <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-2 space-y-1.5 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-1.5 gap-1.5">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-800 text-[11.5px]">قائمة المسافرين والتأشيرات:</span>
                <Badge size="xs" color="orange" variant="light" className="font-bold">
                  {passengersList.length} مسافر
                </Badge>
              </div>

              <div className="flex items-center gap-1.5">
                {/* تعيين نوع التأشيرة للجميع */}
                <div className="flex items-center gap-1 bg-slate-50 border border-[#E5E7EB] rounded-[5px] px-1.5 py-0.5">
                  <span className="text-[10.5px] font-bold text-slate-500 shrink-0">نوع التأشيرة للكل:</span>
                  <Select
                    size="xs"
                    searchable
                    allowDeselect={false}
                    value={bulkVisaType}
                    onChange={(val) => {
                      if (val) handleApplyVisaTypeToAll(val);
                    }}
                    data={PREDEFINED_VISA_TYPES.map((t) => ({ value: t, label: t }))}
                    placeholder="اختر للكل..."
                    maxDropdownHeight={200}
                    styles={{
                      input: {
                        height: '24px',
                        fontSize: '10.5px',
                        fontWeight: 700,
                        borderColor: '#E5E7EB',
                        width: '135px',
                        borderRadius: '4px',
                      },
                    }}
                  />
                </div>

                {/* زر النسخ والتحليل الذكي */}
                <button
                  type="button"
                  onClick={() => setSmartImportOpened(true)}
                  className="h-[26px] px-2.5 rounded-[5px] bg-orange-50 hover:bg-orange-100 active:scale-95 text-orange-800 border border-orange-200 font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer"
                >
                  <IconSparkles size={13} className="text-orange-600" />
                  <span>نسخ ولصق ذكي</span>
                </button>

                {/* إضافة سطر يدوي */}
                <button
                  type="button"
                  onClick={handleAddPassengerLine}
                  className="h-[26px] px-2.5 rounded-[5px] bg-[#F97316] hover:bg-[#EA580C] active:scale-95 text-white font-bold text-[11px] shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
                >
                  <IconPlus size={13} strokeWidth={2.4} />
                  <span>إضافة مسافر</span>
                </button>
              </div>
            </div>

            {/* Fixed Height Container with Internal Scroll */}
            <div className="overflow-y-auto overflow-x-auto border border-[#E5E7EB] rounded-[6px] h-[210px] min-h-[210px] max-h-[210px] bg-white">
              <table className="w-full text-xs text-right border-collapse table-fixed">
                <colgroup>
                  <col style={{ width: '32px' }} />
                  <col style={{ width: '23%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '32px' }} />
                </colgroup>
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#F8FAFC] border-b border-[#E5E7EB] font-bold text-slate-700 h-[28px] text-[11px]">
                    <th className="py-0.5 px-1 border-l border-[#F1F5F9] text-center text-slate-500">#</th>
                    <th className="py-0.5 px-1.5 border-l border-[#F1F5F9]">اسم المسافر *</th>
                    <th className="py-0.5 px-1 border-l border-[#F1F5F9] text-center">رقم الجواز (Passport)</th>
                    <th className="py-0.5 px-1.5 border-l border-[#F1F5F9]">نوع التأشيرة / الدولة *</th>
                    <th className="py-0.5 px-1 border-l border-[#F1F5F9] text-center text-emerald-900 bg-emerald-50/50">شراء (Buy)</th>
                    <th className="py-0.5 px-1 border-l border-[#F1F5F9] text-center text-rose-900 bg-rose-50/50">بيع (Sale)</th>
                    <th className="py-0.5 px-1 border-l border-[#F1F5F9] text-center text-blue-900">الربح</th>
                    <th className="py-0.5 px-1.5 border-l border-[#F1F5F9]">ملاحظات السطر</th>
                    <th className="py-0.5 px-1 text-center">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {passengersList.map((p, idx) => {
                    const rowProfit = (Number(p.salePrice) || 0) - (Number(p.buyPrice) || 0);
                    return (
                      <tr key={p.id} className={idx % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/40 hover:bg-slate-100'}>
                        {/* Row Number */}
                        <td className="py-0.5 px-1 border-l border-slate-100 text-center font-mono font-bold text-slate-500 text-[10.5px]">
                          {idx + 1}
                        </td>

                        {/* Passenger Name */}
                        <td className="py-0.5 px-1 border-l border-slate-100">
                          <input
                            type="text"
                            value={p.name}
                            onChange={(e) => handlePassengerChange(p.id, 'name', e.target.value)}
                            placeholder="اسم المسافر..."
                            className="w-full h-[26px] px-1.5 border border-slate-200 rounded-[4px] text-[11px] font-bold text-slate-900 bg-white focus:outline-hidden focus:border-orange-500 truncate"
                          />
                        </td>

                        {/* Passport Number */}
                        <td className="py-0.5 px-1 border-l border-slate-100">
                          <input
                            type="text"
                            value={p.passportNumber}
                            onChange={(e) => handlePassengerChange(p.id, 'passportNumber', e.target.value)}
                            placeholder="رقم الجواز..."
                            className="w-full h-[26px] px-1.5 border border-slate-200 rounded-[4px] text-[11px] font-mono font-bold text-slate-800 bg-white focus:outline-hidden focus:border-orange-500 text-center truncate"
                          />
                        </td>

                        {/* Visa Type Select */}
                        <td className="py-0.5 px-1 border-l border-slate-100">
                          <Select
                            searchable
                            allowDeselect={false}
                            size="xs"
                            placeholder="نوع التأشيرة..."
                            value={p.visaType || bulkVisaType || 'فيزا تايلند'}
                            onChange={(val) => {
                              if (val) handlePassengerChange(p.id, 'visaType', val);
                            }}
                            data={PREDEFINED_VISA_TYPES.map((t) => ({ value: t, label: t }))}
                            maxDropdownHeight={200}
                            styles={{
                              input: {
                                height: '26px',
                                fontSize: '10.5px',
                                fontWeight: 700,
                                borderColor: '#E5E7EB',
                                borderRadius: '4px',
                              },
                            }}
                          />
                        </td>

                        {/* Buy Price */}
                        <td className="py-0.5 px-1 border-l border-slate-100">
                          <FormattedNumberInput
                            size="xs"
                            placeholder="0.00"
                            value={p.buyPrice}
                            onChange={(val) => handlePassengerChange(p.id, 'buyPrice', val)}
                            styles={{
                              input: {
                                height: '26px',
                                fontSize: '11px',
                                fontWeight: 800,
                                fontFamily: 'monospace',
                                textAlign: 'left',
                                color: '#065f46',
                                backgroundColor: Number(p.buyPrice) > 0 ? '#ecfdf5' : '#ffffff',
                                borderColor: Number(p.buyPrice) > 0 ? '#10b981' : '#E5E7EB',
                                borderRadius: '4px',
                              },
                            }}
                          />
                        </td>

                        {/* Sale Price */}
                        <td className="py-0.5 px-1 border-l border-slate-100">
                          <FormattedNumberInput
                            size="xs"
                            placeholder="0.00"
                            value={p.salePrice}
                            onChange={(val) => handlePassengerChange(p.id, 'salePrice', val)}
                            styles={{
                              input: {
                                height: '26px',
                                fontSize: '11px',
                                fontWeight: 800,
                                fontFamily: 'monospace',
                                textAlign: 'left',
                                color: '#9f1239',
                                backgroundColor: Number(p.salePrice) > 0 ? '#fff1f2' : '#ffffff',
                                borderColor: Number(p.salePrice) > 0 ? '#f43f5e' : '#E5E7EB',
                                borderRadius: '4px',
                              },
                            }}
                          />
                        </td>

                        {/* Live Profit */}
                        <td className="py-0.5 px-1 border-l border-slate-100 text-center font-mono font-bold text-[11px] text-blue-800 tabular-nums">
                          {rowProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>

                        {/* Notes */}
                        <td className="py-0.5 px-1 border-l border-slate-100">
                          <input
                            type="text"
                            value={p.notes || ''}
                            onChange={(e) => handlePassengerChange(p.id, 'notes', e.target.value)}
                            placeholder="ملاحظات..."
                            className="w-full h-[26px] px-1.5 border border-slate-200 rounded-[4px] text-[10.5px] text-slate-700 bg-white truncate"
                          />
                        </td>

                        {/* Delete Action */}
                        <td className="py-0.5 px-1 text-center">
                          <ActionIcon
                            size="xs"
                            variant="subtle"
                            color="red"
                            onClick={() => handleRemovePassengerLine(p.id)}
                            disabled={passengersList.length <= 1}
                          >
                            <IconTrash size={13} />
                          </ActionIcon>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════
              4. CONTAINER: الملخص المالي والخصم والملاحظات
             ═══════════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-stretch">
            {/* Live Financial Totals Cards (7 cols) */}
            <div className="md:col-span-7 grid grid-cols-3 gap-1.5">
              <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-2 shadow-2xs flex flex-col justify-between">
                <span className="text-[10.5px] font-bold text-slate-500">إجمالي البيع (Sale)</span>
                <div className="font-mono font-black text-sm text-slate-900 mt-0.5">
                  {sumSale.toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                  <span className="text-[10px] font-bold text-slate-500">{currency}</span>
                </div>
              </div>

              <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-2 shadow-2xs flex flex-col justify-between">
                <span className="text-[10.5px] font-bold text-slate-500">إجمالي التكلفة (Buy)</span>
                <div className="font-mono font-black text-sm text-slate-900 mt-0.5">
                  {sumBuy.toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                  <span className="text-[10px] font-bold text-slate-500">{currency}</span>
                </div>
              </div>

              <div className="bg-emerald-50/50 border border-emerald-200 rounded-[8px] p-2 shadow-2xs flex flex-col justify-between">
                <span className="text-[10.5px] font-bold text-emerald-800">صافي الأرباح (Profit)</span>
                <div className="font-mono font-black text-sm text-emerald-800 mt-0.5">
                  {netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                  <span className="text-[10px] font-bold text-emerald-700">{currency}</span>
                </div>
              </div>
            </div>

            {/* Compact Notes & Discount (5 cols) */}
            <div className="md:col-span-5 bg-white border border-[#E2E8F0] rounded-[8px] p-2 flex flex-col justify-between space-y-1 shadow-2xs">
              {/* Compact Discount Bar */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-[5px] px-1.5 py-0.5">
                <span className="font-bold text-slate-600 text-[10.5px] shrink-0">الخصم:</span>
                <div className="flex items-center bg-white p-0.5 rounded-[4px] border border-slate-200 shrink-0">
                  <button
                    type="button"
                    onClick={() => setDiscountType('AMOUNT')}
                    className={`h-4.5 px-1.5 rounded-[3px] text-[9.5px] font-bold cursor-pointer transition-all ${
                      discountType === 'AMOUNT' ? 'bg-[#F97316] text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    مبلغ ({currency === 'USD' ? '$' : 'د.ع'})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('PERCENT')}
                    className={`h-4.5 px-1.5 rounded-[3px] text-[9.5px] font-bold cursor-pointer transition-all ${
                      discountType === 'PERCENT' ? 'bg-[#F97316] text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    نسبة %
                  </button>
                </div>
                <div className="flex-1">
                  <FormattedNumberInput
                    size="xs"
                    placeholder="0.00"
                    value={discountValue}
                    onChange={setDiscountValue}
                    styles={{
                      input: {
                        height: '22px',
                        fontSize: '11px',
                        fontWeight: 800,
                        borderColor: '#E5E7EB',
                        textAlign: 'left',
                        fontFamily: 'monospace',
                        borderRadius: '3px',
                      },
                    }}
                  />
                </div>
              </div>

              {/* General Statement / Notes */}
              <div>
                <input
                  type="text"
                  placeholder="ملاحظات وشرح المعاملة العام..."
                  value={generalNotes}
                  onChange={(e) => setGeneralNotes(e.target.value)}
                  className="w-full h-6 px-1.5 border border-slate-200 rounded-[4px] text-[10.5px] font-medium text-slate-800 bg-white focus:outline-hidden focus:border-orange-500"
                />
              </div>
            </div>
          </div>

          </div>

          {/* ═══════════════════════════════════════════════════════════════════
              5. FIXED BOTTOM ACTION BAR: Navigation + New + Delete + Cancel + Save Button
             ═══════════════════════════════════════════════════════════════════ */}
          <div className="sticky bottom-0 z-30 bg-white border-t border-[#E5E7EB] p-2 px-3 flex items-center justify-between gap-2 shadow-xs shrink-0">
            {/* Right: Navigation Controls + Reference + Reset New */}
            <div className="flex items-center gap-1.5">
              {/* Navigation Arrows */}
              <div className="flex items-center bg-slate-50 border border-[#E5E7EB] rounded-[5px] p-0.5 gap-0.5">
                <Tooltip label="الفاتورة الأولى (الأحدث)" withArrow>
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="gray"
                    onClick={handleNavigateFirst}
                    disabled={visaList.length === 0 || currentVisaIndex === 0}
                    className="h-6 w-6"
                  >
                    <IconChevronsRight size={13} />
                  </ActionIcon>
                </Tooltip>

                <Tooltip label="الفاتورة السابقة" withArrow>
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="gray"
                    onClick={handleNavigatePrevious}
                    disabled={visaList.length === 0 || currentVisaIndex === 0}
                    className="h-6 w-6"
                  >
                    <IconChevronRight size={13} />
                  </ActionIcon>
                </Tooltip>

                <div className="px-2 font-mono font-bold text-[11px] text-slate-700 min-w-[50px] text-center">
                  {currentVisaIndex >= 0 ? `${currentVisaIndex + 1} / ${visaList.length}` : `${visaList.length} فاتورة`}
                </div>

                <Tooltip label="الفاتورة التالية" withArrow>
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="gray"
                    onClick={handleNavigateNext}
                    disabled={visaList.length === 0 || currentVisaIndex >= visaList.length - 1}
                    className="h-6 w-6"
                  >
                    <IconChevronLeft size={13} />
                  </ActionIcon>
                </Tooltip>

                <Tooltip label="الفاتورة الأخيرة (الأقدم)" withArrow>
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="gray"
                    onClick={handleNavigateLast}
                    disabled={visaList.length === 0 || currentVisaIndex >= visaList.length - 1}
                    className="h-6 w-6"
                  >
                    <IconChevronsLeft size={13} />
                  </ActionIcon>
                </Tooltip>
              </div>

              <button
                type="button"
                onClick={handleResetForm}
                className="h-[28px] px-2.5 rounded-[5px] border border-[#E5E7EB] bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-700 font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
              >
                <IconPlus size={13} className="text-orange-600" />
                <span>معاملة جديدة</span>
              </button>

              <div className="bg-slate-50 border border-[#E5E7EB] px-2 py-0.5 rounded-[5px] flex items-center gap-1">
                <span className="text-[10px] text-slate-500 font-bold">المرجع:</span>
                <span className="font-mono font-black text-[11px] text-orange-700">{invoiceNumber}</span>
              </div>
            </div>

            {/* Left: Delete (if existing) + Cancel + Save */}
            <div className="flex items-center gap-1.5">
              {currentVisaIndex >= 0 && (
                <button
                  type="button"
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="h-[28px] px-2.5 rounded-[5px] border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-[11px] transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                >
                  <IconTrash size={13} />
                  <span>حذف</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="h-[28px] px-3 rounded-[5px] border border-[#E5E7EB] bg-white text-slate-700 hover:bg-slate-50 font-bold text-[11px] transition-all cursor-pointer shadow-2xs"
              >
                إلغاء
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={handleSaveTransaction}
                className="h-[30px] px-4 rounded-[5px] bg-[#F97316] hover:bg-[#EA580C] active:scale-95 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <IconDeviceFloppy size={14} />
                <span>{saving ? 'جاري الحفظ...' : currentVisaIndex >= 0 ? 'تحديث المعاملة' : 'حفظ وإصدار التأشيرة'}</span>
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title={
          <div className="flex items-center gap-2 font-black text-sm text-red-600">
            <IconAlertTriangle size={18} />
            <span>تأكيد حذف معاملة التأشيرة</span>
          </div>
        }
        size="md"
        centered
        radius="md"
      >
        <div className="space-y-3.5 text-xs font-['IBM_Plex_Sans_Arabic',sans-serif]" dir="rtl">
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-950 space-y-1">
            <p className="font-bold">هل أنت متأكد من رغبتك في حذف هذه المعاملة نهائياً؟</p>
            <p className="text-[11px] text-red-700">
              سيتم إلغاء القيود المحاسبية المرتبطة بهذه المعاملة وإزالة كافة المسافرين المسجلين فيها.
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-bold">رقم الفاتورة:</span>
              <span className="font-mono font-black text-slate-900">{invoiceNumber}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-bold">العميل:</span>
              <span className="font-bold text-slate-800">
                {accounts.find((a) => a.id === customerId)?.nameAr || customerId || 'عميل نقدي'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-bold">المبلغ الصافي:</span>
              <span className="font-mono font-black text-emerald-700">
                {Number(netSale || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} {currency}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <Button size="xs" variant="default" onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>
              إلغاء
            </Button>
            <Button
              size="xs"
              color="red"
              loading={deleting}
              leftSection={<IconTrash size={14} />}
              onClick={handleConfirmDeleteCurrentVisa}
              className="font-bold shadow-2xs"
            >
              تأكيد الحذف النهائي
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Receipt / Voucher Attachment & Preview Modal ── */}
      <Modal
        opened={transferImagePreviewOpen}
        onClose={() => setTransferImagePreviewOpen(false)}
        title={
          <div className="flex items-center gap-2 font-black text-sm text-slate-800">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <IconPaperclip size={16} />
            </div>
            <span>وصولات وإشعارات التسديد المرفقة (Receipts & Slips)</span>
            {receiptAttachments.length > 0 && (
              <Badge size="xs" color="emerald" variant="filled" className="font-mono">
                {receiptAttachments.length}
              </Badge>
            )}
          </div>
        }
        size="lg"
        centered
        radius="md"
      >
        <div className="space-y-3.5 text-xs font-['IBM_Plex_Sans_Arabic',sans-serif]" dir="rtl">
          <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-[11px] font-bold text-slate-600">
              معاينة وتنزيل وصولات الدفع، أو حذفها وتعديلها وإرفاق وصولات إضافية
            </span>
            <div className="flex items-center gap-1.5">
              <FileButton
                multiple
                accept="image/*,application/pdf"
                onChange={handleReceiptsUpload}
              >
                {(props) => (
                  <Button
                    {...props}
                    size="xs"
                    color="emerald"
                    variant="light"
                    leftSection={<IconPlus size={14} />}
                    className="font-black text-xs shrink-0 shadow-2xs"
                  >
                    + إضافة وصل إضافي
                  </Button>
                )}
              </FileButton>

              {receiptAttachments.length > 0 && (
                <Button
                  size="xs"
                  color="red"
                  variant="light"
                  leftSection={<IconTrash size={13} />}
                  onClick={() => {
                    setReceiptAttachments([]);
                    setTransferImage(null);
                  }}
                  className="font-black text-xs shrink-0 shadow-2xs"
                >
                  حذف كافة الوصولات
                </Button>
              )}
            </div>
          </div>

          {receiptAttachments.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto p-1">
              {receiptAttachments.map((att, idx) => (
                <div
                  key={att.id || idx}
                  className="border border-slate-200 rounded-xl p-2.5 bg-slate-50/60 hover:bg-white hover:shadow-md transition-all flex flex-col justify-between gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {att.type === 'pdf' ? (
                        <IconFileTypePdf size={18} className="text-red-500 shrink-0" />
                      ) : (
                        <IconPhoto size={16} className="text-emerald-600 shrink-0" />
                      )}
                      <span className="font-black text-xs text-slate-900 truncate" title={att.name}>
                        {att.name || `وصل تسديد ${idx + 1}`}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-slate-500 shrink-0 uppercase px-1.5 py-0.5 bg-white rounded border border-slate-200">
                      {att.type}
                    </span>
                  </div>

                  {att.type === 'pdf' ? (
                    <div className="h-36 rounded-lg bg-red-50/50 border border-red-100 flex flex-col items-center justify-center gap-2 p-3 text-center">
                      <IconFileTypePdf size={36} className="text-red-500" />
                      <span className="text-[11px] font-black text-red-800">مستند PDF لوصل التسديد</span>
                      <a
                        href={att.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-black text-white bg-red-600 hover:bg-red-700 px-3 py-1 rounded-md shadow-2xs flex items-center gap-1 transition-all"
                      >
                        <IconEye size={13} />
                        معاينة وفتح الملف
                      </a>
                    </div>
                  ) : (
                    <div className="h-36 rounded-lg bg-white border border-slate-200 overflow-hidden flex items-center justify-center relative group">
                      <img
                        src={att.url}
                        alt={att.name || 'وصل'}
                        className="max-h-full max-w-full object-contain"
                      />
                      <a
                        href={att.url}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-black text-xs gap-1 transition-all"
                      >
                        <IconEye size={16} />
                        عرض بالحجم الكامل
                      </a>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/80">
                    <a
                      href={att.url}
                      download={att.name || `receipt_${idx + 1}`}
                      className="text-[11px] font-bold text-slate-700 hover:text-slate-950 flex items-center gap-1 bg-white border border-slate-200 hover:border-slate-300 px-2 py-0.5 rounded shadow-2xs transition-all"
                    >
                      <IconDownload size={12} />
                      تنزيل
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = receiptAttachments.filter((_, i) => i !== idx);
                        setReceiptAttachments(updated);
                        if (updated.length > 0) {
                          setTransferImage(updated[0].url);
                        } else {
                          setTransferImage(null);
                        }
                      }}
                      className="text-[11px] font-bold text-red-600 hover:text-red-800 flex items-center gap-1 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-0.5 rounded cursor-pointer transition-all shadow-2xs"
                    >
                      <IconTrash size={12} />
                      <span>حذف هذا الوصل</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400 font-bold text-xs flex flex-col items-center gap-2.5">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <IconPaperclip size={28} />
              </div>
              <p className="font-extrabold text-slate-700 text-sm">لا توجد وصولات تسديد مرفقة حالياً</p>
              <p className="text-xs text-slate-500 max-w-xs">
                يمكنك إرفاق صور وصولات السداد والتحويلات البنكية أو مستندات PDF وحفظها مع المعاملة.
              </p>
              <FileButton
                multiple
                accept="image/*,application/pdf"
                onChange={handleReceiptsUpload}
              >
                {(props) => (
                  <Button
                    {...props}
                    size="xs"
                    color="emerald"
                    variant="filled"
                    leftSection={<IconPlus size={14} />}
                    className="font-black text-xs mt-2 shadow-sm"
                  >
                    + إرفاق وصل / صورة التسديد الآن
                  </Button>
                )}
              </FileButton>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <Button
              size="xs"
              color="orange"
              onClick={() => setTransferImagePreviewOpen(false)}
              className="font-bold shadow-2xs"
            >
              تم وحفظ المرفقات ({receiptAttachments.length})
            </Button>
          </div>
        </div>
      </Modal>

      {/* Smart Visa Import Modal */}
      <SmartVisaImportModal
        opened={smartImportOpened}
        onClose={() => setSmartImportOpened(false)}
        defaultVisaType={bulkVisaType}
        onImport={(importedRows) => {
          setPassengersList((prev) => {
            const isOnlyOneEmpty = prev.length === 1 && !prev[0].name?.trim() && !prev[0].passportNumber?.trim();
            if (isOnlyOneEmpty) return importedRows;
            return [...prev, ...importedRows];
          });
        }}
      />

      {/* Visa Form Settings Modal */}
      <Modal
        opened={settingsModalOpened}
        onClose={() => setSettingsModalOpened(false)}
        size="520px"
        padding="md"
        radius="sm"
        centered
        title={
          <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm">
            <IconSettings size={19} className="text-orange-600" />
            <span>الإعدادات الافتراضية لنافذة التأشيرات</span>
          </div>
        }
      >
        <VisaFormSettingsContent
          initialPrefs={getSavedVisaDefaults()}
          cashboxes={cashboxAccounts}
          onClose={() => setSettingsModalOpened(false)}
          onSave={(newDefaults) => {
            localStorage.setItem('visa_form_defaults', JSON.stringify(newDefaults));
            if (newDefaults.currency) setCurrency(newDefaults.currency);
            if (newDefaults.paymentType) setPaymentType(newDefaults.paymentType);
            if (newDefaults.visaType) {
              setBulkVisaType(newDefaults.visaType);
              handleApplyVisaTypeToAll(newDefaults.visaType);
            }
            if (newDefaults.receivingCashboxId) setReceivingCashboxId(newDefaults.receivingCashboxId);
            if (newDefaults.paymentCashboxId) setPaymentCashboxId(newDefaults.paymentCashboxId);

            showSuccessNotification('تم الحفظ', 'تم حفظ الإعدادات الافتراضية لنافذة التأشيرات وتطبيقها بنجاح.');
            setSettingsModalOpened(false);
          }}
        />
      </Modal>

      {/* Quick Add Account Modal */}
      <SmartAccountWizardModal
        opened={createAccountModalOpened}
        onClose={() => setCreateAccountModalOpened(false)}
        onSuccess={async () => {
          setCreateAccountModalOpened(false);
          await loadAccounts();
        }}
        mode="CREATE"
      />

      {/* Invoice Audit Log Modal */}
      <InvoiceAuditLogModal
        opened={auditModalOpened}
        onClose={() => setAuditModalOpened(false)}
        ticketNumber={invoiceNumber}
        pnr="VISA"
        customerName={accounts.find((a) => a.id === customerId)?.nameAr || customerId}
        initialLogs={[
          {
            id: 'audit-1',
            action: 'CREATE',
            actionTitle: 'إنشاء وحفظ الفاتورة',
            userName: entryEmployee || loggedInUserName,
            timestamp: new Date().toISOString(),
            changes: [
              { fieldLabel: 'نوع السداد', oldValue: '—', newValue: paymentType },
              { fieldLabel: 'المبلغ الإجمالي', oldValue: '0.00', newValue: `${netSale} ${currency}` },
            ],
            notes: 'تم تسجيل فاتورة التأشيرات وترحيل القيود المالية.',
          },
        ]}
      />
    </>
  );
};

// ── Settings Sub-Component for Visa Issue Modal Defaults ──
interface VisaFormSettingsContentProps {
  initialPrefs: any;
  cashboxes: any[];
  onClose: () => void;
  onSave: (prefs: {
    currency: 'USD' | 'IQD';
    paymentType: 'DEBIT' | 'CASH';
    visaType: string;
    receivingCashboxId?: string;
    paymentCashboxId?: string;
  }) => void;
}

const VisaFormSettingsContent: React.FC<VisaFormSettingsContentProps> = ({
  initialPrefs,
  cashboxes,
  onClose,
  onSave,
}) => {
  const [prefCurrency, setPrefCurrency] = useState<'USD' | 'IQD'>(initialPrefs?.currency || 'USD');
  const [prefPaymentType, setPrefPaymentType] = useState<'DEBIT' | 'CASH'>(initialPrefs?.paymentType || 'DEBIT');
  const [prefVisaType, setPrefVisaType] = useState<string>(initialPrefs?.visaType || 'فيزا تايلند');
  const [prefReceivingCashbox, setPrefReceivingCashbox] = useState<string>(initialPrefs?.receivingCashboxId || '');
  const [prefPaymentCashbox, setPrefPaymentCashbox] = useState<string>(initialPrefs?.paymentCashboxId || '');

  return (
    <div className="space-y-4 font-['IBM_Plex_Sans_Arabic',sans-serif] text-xs select-none" dir="rtl">
      <Paper p="xs" radius="sm" withBorder className="bg-slate-50 border-slate-200 text-slate-600">
        <p className="font-semibold leading-relaxed">
          ⚙️ يتم حفظ هذه الإعدادات كخيارات افتراضية يتم تفعيلها تلقائياً في كل مرة تفتح فيها نافذة إصدار التأشيرات.
        </p>
      </Paper>

      <div className="space-y-3">
        {/* Default Currency */}
        <div>
          <label className="block font-bold text-slate-800 mb-1">العملة الافتراضية للمعاملات:</label>
          <div className="h-8 flex items-center bg-slate-100 p-0.5 rounded border border-slate-300 gap-1">
            <button
              type="button"
              onClick={() => setPrefCurrency('USD')}
              className={`flex-1 h-full rounded text-xs font-black transition-all cursor-pointer ${
                prefCurrency === 'USD' ? 'bg-orange-600 text-white shadow-2xs' : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              الدولار الأمريكي ($ USD)
            </button>
            <button
              type="button"
              onClick={() => setPrefCurrency('IQD')}
              className={`flex-1 h-full rounded text-xs font-black transition-all cursor-pointer ${
                prefCurrency === 'IQD' ? 'bg-orange-600 text-white shadow-2xs' : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              الدينار العراقي (IQD د.ع)
            </button>
          </div>
        </div>

        {/* Default Payment Type */}
        <div>
          <label className="block font-bold text-slate-800 mb-1">نوع السداد الافتراضي:</label>
          <div className="h-8 flex items-center bg-slate-100 p-0.5 rounded border border-slate-300 gap-1">
            <button
              type="button"
              onClick={() => setPrefPaymentType('DEBIT')}
              className={`flex-1 h-full rounded text-xs font-black transition-all cursor-pointer ${
                prefPaymentType === 'DEBIT' ? 'bg-orange-600 text-white shadow-2xs' : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              آجل (على الحساب)
            </button>
            <button
              type="button"
              onClick={() => setPrefPaymentType('CASH')}
              className={`flex-1 h-full rounded text-xs font-black transition-all cursor-pointer ${
                prefPaymentType === 'CASH' ? 'bg-orange-600 text-white shadow-2xs' : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              نقدي (كاش)
            </button>
          </div>
        </div>

        {/* Default Visa Type */}
        <div>
          <label className="block font-bold text-slate-800 mb-1">نوع التأشيرة / الدولة الافتراضية:</label>
          <Select
            searchable
            allowDeselect={false}
            size="xs"
            value={prefVisaType}
            onChange={(val) => setPrefVisaType(val || 'فيزا تايلند')}
            data={PREDEFINED_VISA_TYPES.map((t) => ({ value: t, label: t }))}
            placeholder="اختر نوع التأشيرة الافتراضي..."
            maxDropdownHeight={220}
            styles={{
              input: {
                height: '34px',
                fontSize: '12px',
                fontWeight: 700,
                borderColor: '#cbd5e1',
              },
            }}
          />
        </div>

        {/* Default Receiving Cashbox */}
        <div>
          <label className="block font-bold text-slate-800 mb-1">صندوق الاستلام الافتراضي (القبض):</label>
          <Select
            searchable
            size="xs"
            placeholder="اختر صندوق الاستلام الافتراضي..."
            value={prefReceivingCashbox}
            onChange={(val) => setPrefReceivingCashbox(val || '')}
            data={cashboxes.map((b) => ({ value: b.id, label: b.nameAr }))}
            styles={{
              input: {
                height: '34px',
                fontSize: '12px',
                fontWeight: 700,
                borderColor: '#cbd5e1',
              },
            }}
          />
        </div>

        {/* Default Payment Cashbox */}
        <div>
          <label className="block font-bold text-slate-800 mb-1">صندوق الدفع الافتراضي (الصرف):</label>
          <Select
            searchable
            size="xs"
            placeholder="اختر صندوق الدفع الافتراضي..."
            value={prefPaymentCashbox}
            onChange={(val) => setPrefPaymentCashbox(val || '')}
            data={cashboxes.map((b) => ({ value: b.id, label: b.nameAr }))}
            styles={{
              input: {
                height: '34px',
                fontSize: '12px',
                fontWeight: 700,
                borderColor: '#cbd5e1',
              },
            }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-200">
        <Button size="xs" variant="default" onClick={onClose} className="border-slate-300 bg-white text-slate-700">
          إلغاء
        </Button>

        <Button
          size="xs"
          color="orange"
          leftSection={<IconCheck size={14} />}
          onClick={() =>
            onSave({
              currency: prefCurrency,
              paymentType: prefPaymentType,
              visaType: prefVisaType,
              receivingCashboxId: prefReceivingCashbox,
              paymentCashboxId: prefPaymentCashbox,
            })
          }
          className="font-bold px-5 bg-orange-600 hover:bg-orange-700 text-white shadow-xs"
        >
          حفظ كإعدادات افتراضية
        </Button>
      </div>
    </div>
  );
};
