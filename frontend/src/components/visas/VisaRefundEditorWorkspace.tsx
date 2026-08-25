import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Tooltip,
  Radio,
  Checkbox,
  Select,
  Modal,
  SegmentedControl,
  Switch,
} from '@mantine/core';
import {
  RotateCcw,
  Search,
  Check,
  X,
  Plus,
  Edit3,
  History,
  Trash2,
  Users,
  User,
  Sparkles,
  ShieldCheck,
  Coins,
  Receipt,
  ArrowRight,
  ArrowLeft,
  TrendingUp,
  CreditCard,
  Building2,
  Calendar,
  AlertTriangle,
  Globe,
  FileCheck2,
  Copy,
} from 'lucide-react';
import { ticketsApi, type TicketData } from '../../api/tickets';
import { partnersApi } from '../../api/partners';
import { accountsApi } from '../../api/accounts';
import { SearchableCombobox, ComboboxOption } from '../ui/SearchableCombobox';
import { SegmentedDatePicker } from '../ui/SegmentedDatePicker';
import { CountryFlagImage } from '../ui/CountryFlagImage';
import { InvoiceAuditLogModal } from '../tickets/InvoiceAuditLogModal';
import { TicketAttachmentsSection, type AttachmentItem } from '../tickets/TicketAttachmentsSection';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { useLanguageStore } from '../../store/useLanguageStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useAdoptedExchangeRate } from '../../hooks/useAdoptedExchangeRate';
import { getNextSequenceNumber } from '../../utils/sequenceUtils';

export interface VisaRefundApplicantLine {
  id: string;
  selected: boolean;
  name: string;
  passportNumber: string;
  visaType: string;
  orderNumber: string;
  buyRefund: number;
  supplierPenalty: number;
  sellRefund: number;
  agencyRetention: number;
}

interface VisaRefundEditorWorkspaceProps {
  opened: boolean;
  onClose: () => void;
  initialData?: any | null;
  onSuccess?: () => void;
  initialManualMode?: boolean;
}

// English / Western numeral formatting helper
const formatNumberEnglish = (num: number): string => {
  if (isNaN(num) || num === null || num === undefined) return '0';
  return num.toLocaleString('en-US');
};

// Clean number parse helper (converts Eastern Arabic digits to English digits)
const parseCleanNumber = (val: string | number): number => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  let clean = String(val).replace(/[٠-٩]/g, (d) => arabicDigits.indexOf(d).toString());
  clean = clean.replace(/,/g, '').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

const monoFontStyle = { fontFamily: "'JetBrains Mono', 'Consolas', 'Roboto', monospace" };

export const VisaRefundEditorWorkspace: React.FC<VisaRefundEditorWorkspaceProps> = ({
  opened,
  onClose,
  initialData,
  onSuccess,
  initialManualMode = false,
}) => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';
  const { user } = useAuthStore();
  const adoptedEx = useAdoptedExchangeRate();

  // Audit Log Modal State
  const [auditLogOpen, setAuditLogOpen] = useState(false);

  // Refund Mode: From Issued Visa vs. Manual
  const [refundMode, setRefundMode] = useState<'FROM_VISA' | 'MANUAL'>(initialManualMode ? 'MANUAL' : 'FROM_VISA');

  // Search & Auto-fill from Existing Visas
  const [searchQuery, setSearchQuery] = useState('');
  const [availableVisas, setAvailableVisas] = useState<TicketData[]>([]);
  const [selectedOriginalVisa, setSelectedOriginalVisa] = useState<any | null>(null);

  // Reference Datasets
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [cashboxes, setCashboxes] = useState<any[]>([]);

  // Workspace Form State
  const [refundNumber, setRefundNumber] = useState<string>('');
  const [issueDate, setIssueDate] = useState<Date>(new Date());
  const [currency, setCurrency] = useState<string>('USD');
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [visaType, setVisaType] = useState<string>('');
  const [orderNumber, setOrderNumber] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [supplierAccount, setSupplierAccount] = useState<string>('');
  const [supplierAccountName, setSupplierAccountName] = useState<string>('');

  // Supplier Refunded Switch Toggle: أرجع المورد / لم يرجع المورد
  const [isSupplierRefunded, setIsSupplierRefunded] = useState<boolean>(true);

  // Multi-Applicant Refund List
  const [applicants, setApplicants] = useState<VisaRefundApplicantLine[]>([
    {
      id: `p-${Date.now()}`,
      selected: true,
      name: '',
      passportNumber: '',
      visaType: '',
      orderNumber: '',
      buyRefund: 0,
      supplierPenalty: 0,
      sellRefund: 0,
      agencyRetention: 0,
    },
  ]);

  // Bulk Apply Penalties to All Selected Applicants
  const [bulkSupplierPenalty, setBulkSupplierPenalty] = useState<string>('');
  const [bulkAgencyRetention, setBulkAgencyRetention] = useState<string>('');

  // Settlement & Attachments Info
  const [paymentType, setPaymentType] = useState<string>('CASH_HAND');
  const [cashboxId, setCashboxId] = useState<string>('');
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [bankAccountId, setBankAccountId] = useState<string>('');
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [paperReceiptNumber, setPaperReceiptNumber] = useState<string>('');
  const [employeeName, setEmployeeName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Helper to resolve clean human-readable customer name from UUID/ID
  const resolveCustomerDisplay = useCallback((raw?: string) => {
    if (!raw) return '';
    const found = customers.find((c) => c.id === raw || c.nameAr === raw || c.name === raw);
    return found ? (found.nameAr || found.name || raw) : raw;
  }, [customers]);

  // Financial Calculation Logic
  const activeApplicants = useMemo(() => applicants.filter((p) => p.selected), [applicants]);

  // 1. Total Original Sell & Buy
  const totalSellRefund = useMemo(
    () => activeApplicants.reduce((sum, p) => sum + (Number(p.sellRefund) || 0), 0),
    [activeApplicants]
  );
  const totalBuyRefund = useMemo(
    () => activeApplicants.reduce((sum, p) => sum + (Number(p.buyRefund) || 0), 0),
    [activeApplicants]
  );

  // 2. Penalties & Retention
  const totalSupplierPenalty = useMemo(
    () => activeApplicants.reduce((sum, p) => sum + (Number(p.supplierPenalty) || 0), 0),
    [activeApplicants]
  );
  const totalAgencyRetention = useMemo(
    () => activeApplicants.reduce((sum, p) => sum + (Number(p.agencyRetention) || 0), 0),
    [activeApplicants]
  );

  // 3. Net Refund Paid Back to Customer = Sell - Supplier Penalty - Agency Retention
  const totalNetRefundToCustomer = useMemo(
    () => Math.max(0, totalSellRefund - totalSupplierPenalty - totalAgencyRetention),
    [totalSellRefund, totalSupplierPenalty, totalAgencyRetention]
  );

  // 4. Net Refund Recovered from Supplier = Buy - Supplier Penalty (or 0 if supplier did not refund)
  const totalNetBuyReturn = useMemo(
    () => (isSupplierRefunded ? Math.max(0, totalBuyRefund - totalSupplierPenalty) : 0),
    [isSupplierRefunded, totalBuyRefund, totalSupplierPenalty]
  );

  // 5. Agency Profit from Refund = Agency Retention
  const totalRealizedProfit = useMemo(() => {
    return totalAgencyRetention;
  }, [totalAgencyRetention]);

  // Load Base Datasets
  useEffect(() => {
    if (opened) {
      if (initialData) {
        const isExistingRefund = initialData.tripType === 'REFUND' || String(initialData.invoiceNumber || '').startsWith('REF-');
        setRefundNumber(isExistingRefund ? (initialData.invoiceNumber || '') : getNextSequenceNumber('refunds'));
        if (!isExistingRefund) {
          setSelectedOriginalVisa(initialData);
        }
        setIssueDate(initialData.issueDate ? new Date(initialData.issueDate) : new Date());
        setCustomerName(resolveCustomerDisplay(initialData.customerName) || initialData.customerName || '');
        const initialSupplierName = initialData.supplierAccountName || initialData.supplierNameDisplay || initialData.supplierName || '';
        setSupplierAccount(initialData.supplierAccount || initialSupplierName);
        setSupplierAccountName(initialSupplierName);
        setCurrency(initialData.currency || 'USD');
        setExchangeRate(initialData.exchangeRate || 1);
        setEmployeeName(initialData.employeeName || user?.name || '');
        setNotes(initialData.notes || '');
        setVisaType(initialData.primaryVisaType || initialData.visaType || initialData.airline || '');
        setOrderNumber(initialData.visaOrderNumber || initialData.orderNumber || initialData.pnr || '');

        const rawPaxList = initialData.detailedPassengers || initialData.passengers || [];
        // Only load applicants who have NOT been refunded yet if creating a new refund
        const candidateApplicants = isExistingRefund
          ? rawPaxList
          : rawPaxList.filter((p: any) => !p.isRefunded && p.status !== 'REFUNDED' && p.status !== 'مسترجع');

        const activePaxToLoad = candidateApplicants.length > 0 ? candidateApplicants : rawPaxList;

        if (activePaxToLoad && activePaxToLoad.length > 0) {
          const paxCount = activePaxToLoad.length;
          let fallbackSupplierPenalty = 0;
          let fallbackAgencyRetention = 0;
          if (initialData.notes) {
            const penaltyMatch = initialData.notes.match(/غرامة مورد:\s*([0-9.]+)/);
            const retentionMatch = initialData.notes.match(/ربح:\s*([0-9.]+)/);
            if (penaltyMatch) fallbackSupplierPenalty = (parseFloat(penaltyMatch[1]) || 0) / paxCount;
            if (retentionMatch) fallbackAgencyRetention = (parseFloat(retentionMatch[1]) || 0) / paxCount;
          }

          setApplicants(
            activePaxToLoad.map((p: any, idx: number) => {
              const supPen = (p.tax1 !== undefined && p.tax1 !== null && p.tax1 > 0) ? p.tax1 : fallbackSupplierPenalty;
              const agencyRet = (p.charge !== undefined && p.charge !== null && p.charge > 0) ? p.charge : fallbackAgencyRetention;
              return {
                id: p.id || `p-${idx}-${Date.now()}`,
                selected: true,
                name: p.name || p.displayName || '',
                passportNumber: p.passportNumber || p.documentNumber || p.ticketNumber || '',
                visaType: p.visaType || initialData.primaryVisaType || initialData.visaType || '',
                orderNumber: p.orderNumber || p.voucherNumber || initialData.visaOrderNumber || '',
                buyRefund: Math.abs(p.fareBuy || p.buyPrice || 0),
                supplierPenalty: supPen,
                sellRefund: Math.abs(p.fareSell || p.salePrice || 0),
                agencyRetention: agencyRet,
              };
            })
          );
        } else {
          setApplicants([
            {
              id: `p-${Date.now()}`,
              selected: true,
              name: initialData.customerName || '',
              passportNumber: '',
              visaType: initialData.primaryVisaType || initialData.visaType || '',
              orderNumber: initialData.visaOrderNumber || '',
              buyRefund: Math.abs(initialData.totalBuy || 0),
              supplierPenalty: 0,
              sellRefund: Math.abs(initialData.totalSell || 0),
              agencyRetention: 0,
            },
          ]);
        }
      } else {
        setRefundNumber(getNextSequenceNumber('refunds'));
        setEmployeeName(user?.name || '');
        setApplicants([
          {
            id: `p-${Date.now()}`,
            selected: true,
            name: '',
            passportNumber: '',
            visaType: '',
            orderNumber: '',
            buyRefund: 0,
            supplierPenalty: 0,
            sellRefund: 0,
            agencyRetention: 0,
          },
        ]);
        setSelectedOriginalVisa(null);
        setVisaType('');
      }

      // Fetch reference lists
      ticketsApi.getVisas().then((list) => setAvailableVisas(list || [])).catch(() => {});
      partnersApi.getCustomers().then((list) => setCustomers(list || [])).catch(() => {});
      partnersApi.getSuppliers().then((list) => setSuppliers(list || [])).catch(() => {});
      
      accountsApi.getFlat('ASSET', 'CASH').then((data) => {
        const cashList = data || [];
        setCashboxes(cashList);
        if (cashList.length > 0) {
          setCashboxId(cashList[0].id || cashList[0].code);
        }
      }).catch(() => {});

      accountsApi.getFlat('ASSET', 'BANK').then((data) => {
        const bankList = data || [];
        setBankAccounts(bankList);
        if (bankList.length > 0) {
          setBankAccountId(bankList[0].id || bankList[0].code);
        }
      }).catch(() => {});
    }
  }, [opened, initialData, user, resolveCustomerDisplay]);

  // Handle Select from Fast Lookup
  const handleSelectVisa = (t: TicketData) => {
    setSelectedOriginalVisa(t);
    setVisaType(t.airline || (t as any).primaryVisaType || '');
    setOrderNumber(t.pnr || (t as any).visaOrderNumber || '');
    setCurrency((t.currency as any) === 'IQD' ? 'IQD' : 'USD');
    setExchangeRate(t.exchangeRate || 1);

    const resolvedCust = resolveCustomerDisplay(t.customerName || (t as any).customerId);
    setCustomerName(resolvedCust);
    const selectedSupplierName = t.supplierAccountName || t.supplier?.nameAr || (t as any).supplierNameDisplay || (t as any).supplierName || '';
    setSupplierAccount(t.supplierAccount || selectedSupplierName);
    setSupplierAccountName(selectedSupplierName);

    // Populate only non-refunded applicants
    const rawList = (t as any).detailedPassengers || t.passengers || [];
    const unrefundedList = rawList.filter((p: any) => !p.isRefunded && p.status !== 'REFUNDED' && p.status !== 'مسترجع');
    const paxToPopulate = unrefundedList.length > 0 ? unrefundedList : rawList;

    if (paxToPopulate && paxToPopulate.length > 0) {
      setApplicants(
        paxToPopulate.map((p: any, idx: number) => ({
          id: p.id || `p-${idx}-${Date.now()}`,
          selected: true,
          name: p.name || p.displayName || '',
          passportNumber: p.passportNumber || p.documentNumber || p.ticketNumber || '',
          visaType: p.visaType || t.airline || '',
          orderNumber: p.orderNumber || t.pnr || '',
          buyRefund: Math.abs(p.fareBuy || p.buyPrice || (t.totalBuy || 0) / (t.passengers?.length || 1) || 0),
          supplierPenalty: 0,
          sellRefund: Math.abs(p.fareSell || p.salePrice || (t.totalSell || 0) / (t.passengers?.length || 1) || 0),
          agencyRetention: 0,
        }))
      );
    } else {
      const origSell = Math.abs(t.totalSell || t.netSell || 0);
      const origBuy = Math.abs(t.totalBuy || t.netBuy || 0);
      setApplicants([
        {
          id: `p-${Date.now()}`,
          selected: true,
          name: resolvedCust || 'مسافر',
          passportNumber: '',
          visaType: t.airline || '',
          orderNumber: t.pnr || '',
          buyRefund: origBuy,
          supplierPenalty: 0,
          sellRefund: origSell,
          agencyRetention: 0,
        },
      ]);
    }

    setSearchQuery('');
  };

  // Filtered search list
  const filteredSearchVisas = useMemo(() => {
    if (!searchQuery || searchQuery.trim().length < 2) return [];
    const q = searchQuery.toLowerCase().trim();
    return availableVisas.filter(
      (v) =>
        v.invoiceNumber?.toLowerCase().includes(q) ||
        v.pnr?.toLowerCase().includes(q) ||
        v.customerName?.toLowerCase().includes(q) ||
        v.passengers?.some((p) => p.name?.toLowerCase().includes(q) || p.passportNumber?.toLowerCase().includes(q))
    ).slice(0, 6);
  }, [searchQuery, availableVisas]);

  // Bulk Apply Penalty & Retention
  const handleApplyBulkPenalty = () => {
    const penaltyVal = parseCleanNumber(bulkSupplierPenalty);
    const retentionVal = parseCleanNumber(bulkAgencyRetention);

    if (penaltyVal === 0 && retentionVal === 0) {
      showErrorNotification(
        isAr ? 'تنبيه' : 'Alert',
        isAr ? 'يرجى إدخال غرامة المورد أو رسوم الوكالة أولاً.' : 'Please enter supplier penalty or agency retention.'
      );
      return;
    }

    setApplicants((prev) =>
      prev.map((p) => {
        if (!p.selected) return p;
        return {
          ...p,
          supplierPenalty: penaltyVal >= 0 ? penaltyVal : p.supplierPenalty,
          agencyRetention: retentionVal >= 0 ? retentionVal : p.agencyRetention,
        };
      })
    );

    showSuccessNotification(
      isAr ? 'تم التطبيق' : 'Applied',
      isAr ? 'تم تطبيق الغرامات والرسوم على جميع المتقدمين المحددين.' : 'Applied penalties to all selected applicants.'
    );
  };

  // Update specific applicant field
  const updateApplicant = (id: string, field: keyof VisaRefundApplicantLine, val: any) => {
    setApplicants((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: val } : p))
    );
  };

  // Customer options for Combobox
  const customerOptions: ComboboxOption[] = useMemo(() => {
    return customers.map((c) => {
      const label = c.nameAr || c.name || c.id || (isAr ? 'عميل' : 'Customer');
      return {
        value: label,
        label: label,
        subtitle: c.code || undefined,
      };
    });
  }, [customers, isAr]);

  // Supplier options for Combobox
  const supplierOptions: ComboboxOption[] = useMemo(() => {
    return suppliers.map((s) => {
      const label = s.nameAr || s.name || s.id || (isAr ? 'مورد' : 'Supplier');
      return {
        value: label,
        label: label,
        subtitle: s.code || undefined,
      };
    });
  }, [suppliers, isAr]);

  // Add a new manual applicant line
  const handleAddApplicant = () => {
    setApplicants((prev) => [
      ...prev,
      {
        id: `p-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        selected: true,
        name: '',
        passportNumber: '',
        visaType: visaType || '',
        orderNumber: orderNumber || '',
        buyRefund: 0,
        supplierPenalty: 0,
        sellRefund: 0,
        agencyRetention: 0,
      },
    ]);
  };

  const handleRemoveApplicant = (id: string) => {
    if (applicants.length <= 1) {
      showErrorNotification(isAr ? 'تنبيه' : 'Alert', isAr ? 'يجب أن تحتوي المعاملة على مسافر واحد على الأقل.' : 'At least one applicant required.');
      return;
    }
    setApplicants((prev) => prev.filter((p) => p.id !== id));
  };

  // Save & Post Visa Refund Document
  const handleSaveRefund = async () => {
    if (activeApplicants.length === 0) {
      showErrorNotification(isAr ? 'تنبيه' : 'Alert', isAr ? 'يرجى تحديد مسافر واحد على الأقل لإتمام الاسترجاع.' : 'Select at least one applicant.');
      return;
    }

    if (!refundNumber.trim() || Number.isNaN(issueDate.getTime())) {
      showErrorNotification(isAr ? 'بيانات السند غير مكتملة' : 'Incomplete voucher', isAr ? 'تحقق من رقم سند الاسترجاع وتاريخه.' : 'Check the refund number and date.');
      return;
    }
    if (activeApplicants.some((applicant) => !applicant.name.trim())) {
      showErrorNotification(isAr ? 'اسم المسافر مطلوب' : 'Applicant name required', isAr ? 'أدخل اسم كل مسافر محدد للاسترجاع.' : 'Enter a name for every selected applicant.');
      return;
    }
    if (totalSellRefund <= 0 || totalNetRefundToCustomer <= 0) {
      showErrorNotification(isAr ? 'مبلغ الاسترجاع غير صحيح' : 'Invalid refund amount', isAr ? 'يجب أن يكون المبلغ المسترجع للعميل أكبر من صفر.' : 'The customer refund must be greater than zero.');
      return;
    }
    if (totalSupplierPenalty + totalAgencyRetention > totalSellRefund) {
      showErrorNotification(isAr ? 'الاستقطاعات تتجاوز المبلغ' : 'Deductions exceed refund', isAr ? 'مجموع غرامة المورد ورسوم الشركة لا يجوز أن يتجاوز مسترجع البيع.' : 'Supplier penalty and agency retention cannot exceed the sales refund.');
      return;
    }
    if (isSupplierRefunded && totalSupplierPenalty > totalBuyRefund) {
      showErrorNotification(isAr ? 'غرامة المورد غير صحيحة' : 'Invalid supplier penalty', isAr ? 'غرامة المورد لا يجوز أن تتجاوز مسترجع الشراء.' : 'The supplier penalty cannot exceed the supplier refund.');
      return;
    }
    if (!employeeName.trim()) {
      showErrorNotification(isAr ? 'الموظف مطلوب' : 'Employee required', isAr ? 'حدد موظف الإدخال والاعتماد.' : 'Select the issuing employee.');
      return;
    }
    if (currency === 'USD' && (!Number.isFinite(exchangeRate) || exchangeRate <= 0)) {
      showErrorNotification(isAr ? 'سعر الصرف غير صحيح' : 'Invalid exchange rate', isAr ? 'يجب أن يكون سعر الصرف أكبر من صفر.' : 'Exchange rate must be greater than zero.');
      return;
    }

    const settlementAccountId = paymentType === 'CASH_HAND' ? cashboxId : paymentType === 'MASTER_CARD' ? bankAccountId : '';
    if (paymentType !== 'ON_ACCOUNT' && !settlementAccountId) {
      showErrorNotification(isAr ? 'حساب الصرف مطلوب' : 'Settlement account required', isAr ? 'اختر الصندوق أو الحساب البنكي الذي سيُصرف منه المبلغ.' : 'Select the cashbox or bank account used for the refund.');
      return;
    }
    if (paymentType === 'ON_ACCOUNT' && !customerName.trim()) {
      showErrorNotification(isAr ? 'حساب العميل مطلوب' : 'Customer account required', isAr ? 'اختر العميل عند تسجيل الاسترجاع على الحساب.' : 'Select the customer for an on-account refund.');
      return;
    }
    if (isSupplierRefunded && totalNetBuyReturn > 0 && !supplierAccount.trim() && !supplierAccountName.trim()) {
      showErrorNotification(isAr ? 'حساب المورد مطلوب' : 'Supplier account required', isAr ? 'اختر المورد الذي أعاد مبلغ الاسترجاع.' : 'Select the supplier that returned the refund.');
      return;
    }

    const sourceVisa = selectedOriginalVisa || initialData;
    const matchedCustomer = customers.find((customer) =>
      [customer.id, customer.code, customer.nameAr, customer.nameEn, customer.name].includes(customerName),
    );
    const matchedSupplier = suppliers.find((supplier) =>
      [supplier.id, supplier.code, supplier.nameAr, supplier.nameEn, supplier.name].includes(supplierAccount)
      || [supplier.nameAr, supplier.nameEn, supplier.name].includes(supplierAccountName),
    );
    const originalReference = initialData?.originalInvoiceNumber
      || selectedOriginalVisa?.invoiceNumber
      || (String(initialData?.invoiceNumber || '').startsWith('REF-') ? initialData?.reference : initialData?.invoiceNumber)
      || paperReceiptNumber
      || undefined;

    setSubmitting(true);
    try {
      const payload: any = {
        invoiceNumber: refundNumber,
        issueDate: issueDate.toISOString(),
        pnr: orderNumber || activeApplicants[0]?.orderNumber || undefined,
        customerName: customerName.trim() || activeApplicants[0].name.trim(),
        customerId: sourceVisa?.customerId || matchedCustomer?.id || undefined,
        customerAccountId: sourceVisa?.customerAccountId || sourceVisa?.customer?.accountId || matchedCustomer?.accountId || matchedCustomer?.account?.id || undefined,
        employeeName: employeeName.trim(),
        entryEmployee: user?.name || employeeName.trim(),
        cashbox: settlementAccountId || null,
        cashboxAccountId: settlementAccountId || null,
        currency,
        exchangeRate,
        paymentType,
        supplierAccount,
        supplierAccountName,
        supplierId: sourceVisa?.supplierId || matchedSupplier?.id || undefined,
        supplierAccountId: sourceVisa?.supplierAccountId || sourceVisa?.supplier?.accountId || matchedSupplier?.accountId || matchedSupplier?.account?.id || undefined,
        tripType: 'REFUND',
        airline: visaType || selectedOriginalVisa?.primaryVisaType || selectedOriginalVisa?.visaType || 'VISA',
        totalSell: -Math.abs(totalSellRefund),
        totalBuy: isSupplierRefunded ? -Math.abs(totalBuyRefund) : 0,
        netSell: -Math.abs(totalNetRefundToCustomer),
        netBuy: isSupplierRefunded ? -Math.abs(totalNetBuyReturn) : 0,
        profit: totalRealizedProfit,
        transferImage: attachments[0]?.url || undefined,
        notes: `[استرجاع فيزا ${activeApplicants.length} مسافر] ${isSupplierRefunded ? 'المورد: أرجع المبلغ' : 'المورد: لم يرجع'} | غرامة مورد: ${totalSupplierPenalty} ${currency} | رسوم وكالة: ${totalAgencyRetention} ${currency} | ${notes || ''}`,
        reference: originalReference,
        status: 'REFUNDED',
        passengers: activeApplicants.map((p) => ({
          name: p.name.trim(),
          ticketType: 'ADULT',
          ticketNumber: p.passportNumber || undefined,
          pnr: p.orderNumber || orderNumber || undefined,
          fareBuy: -Math.abs(p.buyRefund),
          fareSell: -Math.abs(p.sellRefund),
          tax1: Number(p.supplierPenalty) || 0,
          charge: Number(p.agencyRetention) || 0,
          status: 'مسترجع',
        })),
      };

      const isExistingRefund = initialData?.id && (initialData.tripType === 'REFUND' || String(initialData.invoiceNumber || '').startsWith('REF-'));
      if (isExistingRefund) {
        await ticketsApi.update(initialData.id, payload);
      } else {
        await ticketsApi.create(payload);
      }

      showSuccessNotification(
        isAr ? 'تم حفظ الاسترجاع' : 'Visa Refund Saved',
        isAr
          ? `تم حفظ وترحيل سند استرجاع الفيزا ${refundNumber} لعدد (${activeApplicants.length}) مسافر بنجاح.`
          : `Visa refund voucher ${refundNumber} saved and posted successfully.`
      );

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      showErrorNotification(
        isAr ? 'فشل حفظ الاسترجاع' : 'Refund Failed',
        err?.message || (isAr ? 'حدث خطأ أثناء حفظ استرجاع الفيزا' : 'Error saving visa refund')
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!opened) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-[#F1F5F9] overflow-y-auto flex flex-col font-sans"
      dir={direction}
    >
      {/* Header Workspace Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E5E7EB] px-6 py-3 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
            title={isAr ? 'رجوع' : 'Back'}
          >
            {direction === 'rtl' ? <ArrowRight size={18} /> : <ArrowLeft size={18} />}
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-50 text-[#F45A0A] border border-orange-200 flex items-center justify-center shrink-0">
              <RotateCcw size={20} strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-[15px] text-slate-900 leading-tight">
                  {isAr ? 'مساحة عمل استرجاع الفيزا والتأشيرات' : 'Visa Refund Workspace'}
                </h1>
                <span
                  className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-[#FFF3E8] text-[#F45A0A] border border-orange-200 tabular-nums"
                  dir="ltr"
                  style={monoFontStyle}
                >
                  {refundNumber}
                </span>
              </div>
              <p className="text-[11.5px] text-slate-500 font-medium mt-0.5">
                {isAr
                  ? 'تسوية استرجاع التأشيرات، حساب غرامات المورد ورسوم الوكالة والترحيل المالي'
                  : 'Settle visa refunds, compute supplier penalties, agency retention & ledger balances'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-[38px] px-4 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleSaveRefund}
            className="h-[38px] px-5 rounded-xl text-xs font-black text-white bg-[#F45A0A] hover:bg-orange-600 border border-orange-600 transition-all flex items-center gap-2 cursor-pointer shadow-sm hover:shadow-md disabled:opacity-50"
          >
            {submitting ? <RotateCcw size={15} className="animate-spin" /> : <Check size={16} strokeWidth={2.5} />}
            <span>{isAr ? 'حفظ وترحيل الاسترجاع' : 'Save & Post Refund'}</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto p-6 space-y-6 pb-28">
        {/* Mode Switcher */}
        <div className="p-4 bg-white rounded-[14px] border border-[#E5E7EB] shadow-2xs flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center">
              <Sparkles size={16} />
            </div>
            <span className="text-[13px] font-bold text-[#111827]">
              {isAr ? 'طريقة إنشاء الاسترجاع' : 'Refund Mode'}
            </span>
          </div>

          <SegmentedControl
            value={refundMode}
            onChange={(val) => setRefundMode(val as any)}
            data={[
              { label: isAr ? 'استرجاع من معاملة فيزا صادرة ⚡' : 'From Issued Visa', value: 'FROM_VISA' },
              { label: isAr ? 'استرجاع مباشر (يدوي مخصص) ✍️' : 'Manual Visa Refund', value: 'MANUAL' },
            ]}
            radius="md"
            size="xs"
            styles={{
              root: { backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' },
              label: { fontWeight: 700, fontSize: '11.5px', padding: '5px 12px' },
            }}
          />
        </div>

        {/* Fast Visa Search (if FROM_VISA) */}
        {refundMode === 'FROM_VISA' && (
          <div className="p-4 bg-white rounded-[14px] border border-[#E5E7EB] shadow-2xs space-y-2">
            <label className="text-xs font-bold text-slate-700 block">
              {isAr ? 'البحث عن الفيزا الصادرة (رقم الفاتورة أو اسم المسافر أو رقم الجواز):' : 'Search Visa to Refund:'}
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder={isAr ? 'اكتب رقم الفاتورة أو اسم المسافر...' : 'Search by invoice # or traveler name...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 px-4 pr-10 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 outline-none focus:border-[#F45A0A] transition-colors"
              />
              <Search size={16} className="absolute top-3.5 right-3 text-slate-400" />
            </div>

            {filteredSearchVisas.length > 0 && (
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-48 overflow-y-auto mt-2 bg-white shadow-md">
                {filteredSearchVisas.map((v) => (
                  <button
                    key={v.id || v.invoiceNumber}
                    type="button"
                    onClick={() => handleSelectVisa(v)}
                    className="w-full p-3 text-right hover:bg-orange-50 flex items-center justify-between text-xs cursor-pointer transition-colors"
                  >
                    <div>
                      <span className="font-bold text-slate-900 font-mono" dir="ltr">{v.invoiceNumber}</span>
                      <span className="text-slate-500 mx-2">|</span>
                      <span className="text-slate-600 font-medium">{v.customerName}</span>
                    </div>
                    <span className="font-mono font-bold text-[#F45A0A]" dir="ltr" style={monoFontStyle}>
                      {formatNumberEnglish(v.totalSell || 0)} {v.currency}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Primary Visa & Settlement Info */}
        <div className="p-5 bg-white rounded-[14px] border border-[#E5E7EB] shadow-2xs space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Issue Date */}
            <div>
              <label className="text-[12px] font-bold text-slate-700 block mb-1">
                {isAr ? 'تاريخ الاسترجاع' : 'Refund Date'}
              </label>
              <SegmentedDatePicker
                value={issueDate}
                onChange={(d) => d && setIssueDate(d)}
              />
            </div>

            {/* Visa Type / Country */}
            <div>
              <label className="text-[12px] font-bold text-slate-700 block mb-1 flex items-center gap-1">
                <span>{isAr ? 'نوع الفيزا / الوجهة' : 'Visa Type'}</span>
                {visaType && <CountryFlagImage name={visaType} size="xs" className="w-4 h-4 rounded-sm" />}
              </label>
              <input
                type="text"
                value={visaType}
                onChange={(e) => setVisaType(e.target.value)}
                placeholder={isAr ? 'مثال: فيزا دبي السياحية' : 'Dubai Tourist Visa'}
                className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 outline-none focus:border-[#F45A0A]"
              />
            </div>

            {/* Customer */}
            <div>
              <label className="text-[12px] font-bold text-slate-700 block mb-1">
                {isAr ? 'العميل المسترجع له' : 'Customer Account'}
              </label>
              <SearchableCombobox
                options={customerOptions}
                value={customerName}
                onChange={(val) => setCustomerName(val)}
                placeholder={isAr ? 'اختر العميل' : 'Select customer'}
              />
            </div>

            {/* Supplier Account & Refund Switch */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[12px] font-bold text-slate-700">
                  {isAr ? 'المورد المسترجع منه' : 'Supplier Account'}
                </label>
                {/* Supplier Refunded Toggle Switch */}
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg border bg-slate-50 border-slate-200">
                  <span className={`text-[10.5px] font-extrabold ${isSupplierRefunded ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {isSupplierRefunded
                      ? (isAr ? 'أرجع المورد' : 'Supplier Refunded')
                      : (isAr ? 'لم يرجع المورد' : 'No Supplier Return')}
                  </span>
                  <Switch
                    checked={isSupplierRefunded}
                    onChange={(e) => setIsSupplierRefunded(e.currentTarget.checked)}
                    color="teal"
                    size="xs"
                  />
                </div>
              </div>
              <SearchableCombobox
                options={supplierOptions}
                value={supplierAccount}
                onChange={(val) => {
                  setSupplierAccount(val);
                  const found = suppliers.find((s) => s.id === val || s.nameAr === val);
                  if (found) setSupplierAccountName(found.nameAr || found.name);
                }}
                placeholder={isAr ? 'اختر المورد' : 'Select supplier'}
              />
            </div>
          </div>
        </div>

        {/* Applicants Refund Breakdown Table */}
        <div className="bg-white rounded-[14px] border border-[#E5E7EB] shadow-2xs overflow-hidden">
          {/* Table Header Controls */}
          <div className="p-4 bg-[#F8FAFC] border-b border-[#E5E7EB] flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-[#F45A0A]" />
              <span className="font-bold text-sm text-slate-900">
                {isAr ? 'قائمة المسافرين المطلوب استرجاعهم' : 'Applicants to Refund'}
              </span>
              <span
                className="px-2.5 py-0.5 rounded-full bg-orange-100 text-[#F45A0A] font-mono font-bold text-xs tabular-nums"
                dir="ltr"
                style={monoFontStyle}
              >
                {activeApplicants.length} / {applicants.length}
              </span>
            </div>

            {/* Bulk Penalty Apply */}
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                placeholder={isAr ? 'غرامة المورد' : 'Supplier penalty'}
                value={bulkSupplierPenalty}
                onChange={(e) => {
                  const raw = e.target.value;
                  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
                  const clean = raw.replace(/[٠-٩]/g, (d) => arabicDigits.indexOf(d).toString()).replace(/[^0-9]/g, '');
                  setBulkSupplierPenalty(clean ? Number(clean).toLocaleString('en-US') : '');
                }}
                style={monoFontStyle}
                className="w-32 h-8 px-2.5 rounded-lg bg-white border border-slate-300 text-xs font-mono font-bold text-rose-700 outline-none focus:border-[#F45A0A] text-left"
              />
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                placeholder={isAr ? 'رسوم الوكالة' : 'Agency retention'}
                value={bulkAgencyRetention}
                onChange={(e) => {
                  const raw = e.target.value;
                  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
                  const clean = raw.replace(/[٠-٩]/g, (d) => arabicDigits.indexOf(d).toString()).replace(/[^0-9]/g, '');
                  setBulkAgencyRetention(clean ? Number(clean).toLocaleString('en-US') : '');
                }}
                style={monoFontStyle}
                className="w-28 h-8 px-2.5 rounded-lg bg-white border border-slate-300 text-xs font-mono font-bold text-amber-800 outline-none focus:border-[#F45A0A] text-left"
              />
              <button
                type="button"
                onClick={handleApplyBulkPenalty}
                className="h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                {isAr ? 'تطبيق على الكل' : 'Apply Bulk'}
              </button>
              <button
                type="button"
                onClick={handleAddApplicant}
                className="h-8 px-3 rounded-lg bg-orange-50 hover:bg-orange-100 text-[#F45A0A] border border-orange-200 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus size={14} />
                <span>{isAr ? 'إضافة مسافر' : 'Add Person'}</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="h-11 bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="p-3 w-10 text-center">
                    <Checkbox
                      checked={applicants.every((p) => p.selected)}
                      indeterminate={applicants.some((p) => p.selected) && !applicants.every((p) => p.selected)}
                      onChange={(e) => {
                        const checked = e.currentTarget.checked;
                        setApplicants((prev) => prev.map((p) => ({ ...p, selected: checked })));
                      }}
                    />
                  </th>
                  <th className="p-3 w-10 text-center font-mono" dir="ltr">#</th>
                  <th className="p-3 min-w-[160px]">{isAr ? 'اسم المسافر *' : 'Applicant Name'}</th>
                  <th className="p-3 min-w-[130px]">{isAr ? 'رقم الجواز' : 'Passport #'}</th>
                  <th className="p-3 min-w-[130px]">{isAr ? 'نوع الفيزا' : 'Visa Type'}</th>
                  <th className="p-3 min-w-[120px] font-mono text-left" dir="ltr">{isAr ? 'سعر الشراء' : 'Buy Cost'}</th>
                  <th className="p-3 min-w-[120px] font-mono text-left text-rose-700" dir="ltr">{isAr ? 'غرامة المورد (-)' : 'Supplier Penalty (-)'}</th>
                  <th className="p-3 min-w-[120px] font-mono text-left text-slate-800" dir="ltr">{isAr ? 'الصافي من المورد' : 'Net Supplier'}</th>
                  <th className="p-3 min-w-[120px] font-mono text-left" dir="ltr">{isAr ? 'سعر البيع' : 'Sell Price'}</th>
                  <th className="p-3 min-w-[120px] font-mono text-left text-amber-800" dir="ltr">{isAr ? 'رسوم الوكالة (-)' : 'Agency Fee (-)'}</th>
                  <th className="p-3 min-w-[130px] font-mono text-left text-[#F45A0A]" dir="ltr">{isAr ? 'الصافي للعميل' : 'Net to Customer'}</th>
                  <th className="p-3 text-center w-12">{isAr ? 'حذف' : 'Del'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applicants.map((p, idx) => {
                  const netCust = Math.max(0, (p.sellRefund || 0) - (p.supplierPenalty || 0) - (p.agencyRetention || 0));
                  const netSupp = isSupplierRefunded ? Math.max(0, (p.buyRefund || 0) - (p.supplierPenalty || 0)) : 0;

                  return (
                    <tr key={p.id || idx} className={`hover:bg-orange-50/40 transition-colors ${!p.selected ? 'opacity-40 bg-slate-50' : ''}`}>
                      <td className="p-3 text-center">
                        <Checkbox
                          checked={p.selected}
                          onChange={(e) => updateApplicant(p.id, 'selected', e.currentTarget.checked)}
                        />
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-slate-400" dir="ltr" style={monoFontStyle}>
                        {idx + 1}
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          value={p.name}
                          onChange={(e) => updateApplicant(p.id, 'name', e.target.value)}
                          placeholder={isAr ? 'اسم المسافر' : 'Name'}
                          className="w-full h-8 px-2.5 rounded-lg bg-white border border-slate-200 font-bold text-slate-900 outline-none focus:border-[#F45A0A]"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          dir="ltr"
                          value={p.passportNumber}
                          onChange={(e) => updateApplicant(p.id, 'passportNumber', e.target.value.toUpperCase())}
                          placeholder="A12345678"
                          style={monoFontStyle}
                          className="w-full h-8 px-2.5 rounded-lg bg-white border border-slate-200 font-mono font-bold text-slate-800 uppercase outline-none focus:border-[#F45A0A]"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          value={p.visaType}
                          onChange={(e) => updateApplicant(p.id, 'visaType', e.target.value)}
                          placeholder={isAr ? 'نوع الفيزا' : 'Visa Type'}
                          className="w-full h-8 px-2.5 rounded-lg bg-white border border-slate-200 text-slate-700 outline-none focus:border-[#F45A0A]"
                        />
                      </td>
                      {/* Buy Cost */}
                      <td className="p-3">
                        <input
                          type="text"
                          inputMode="numeric"
                          dir="ltr"
                          value={p.buyRefund ? formatNumberEnglish(p.buyRefund) : ''}
                          onChange={(e) => updateApplicant(p.id, 'buyRefund', parseCleanNumber(e.target.value))}
                          style={monoFontStyle}
                          className="w-full h-8 px-2.5 rounded-lg bg-white border border-slate-200 font-mono font-bold text-left text-slate-900 outline-none focus:border-[#F45A0A] tabular-nums"
                        />
                      </td>
                      {/* Supplier Penalty */}
                      <td className="p-3">
                        <input
                          type="text"
                          inputMode="numeric"
                          dir="ltr"
                          placeholder="0"
                          value={p.supplierPenalty ? formatNumberEnglish(p.supplierPenalty) : ''}
                          onChange={(e) => updateApplicant(p.id, 'supplierPenalty', parseCleanNumber(e.target.value))}
                          style={monoFontStyle}
                          className="w-full h-8 px-2.5 rounded-lg bg-white border border-rose-200 text-rose-700 font-mono font-bold text-left outline-none focus:border-[#F45A0A] tabular-nums"
                        />
                      </td>
                      {/* Net Supplier */}
                      <td className="p-3 font-mono font-bold text-left text-slate-700 tabular-nums" dir="ltr" style={monoFontStyle}>
                        {formatNumberEnglish(isSupplierRefunded ? netSupp : 0)}
                      </td>
                      {/* Sell Price */}
                      <td className="p-3">
                        <input
                          type="text"
                          inputMode="numeric"
                          dir="ltr"
                          value={p.sellRefund ? formatNumberEnglish(p.sellRefund) : ''}
                          onChange={(e) => updateApplicant(p.id, 'sellRefund', parseCleanNumber(e.target.value))}
                          style={monoFontStyle}
                          className="w-full h-8 px-2.5 rounded-lg bg-white border border-slate-200 font-mono font-bold text-left text-slate-900 outline-none focus:border-[#F45A0A] tabular-nums"
                        />
                      </td>
                      {/* Agency Retention */}
                      <td className="p-3">
                        <input
                          type="text"
                          inputMode="numeric"
                          dir="ltr"
                          placeholder="0"
                          value={p.agencyRetention ? formatNumberEnglish(p.agencyRetention) : ''}
                          onChange={(e) => updateApplicant(p.id, 'agencyRetention', parseCleanNumber(e.target.value))}
                          style={monoFontStyle}
                          className="w-full h-8 px-2.5 rounded-lg bg-white border border-amber-200 text-amber-800 font-mono font-bold text-left outline-none focus:border-[#F45A0A] tabular-nums"
                        />
                      </td>
                      {/* Net Customer */}
                      <td className="p-3 font-mono font-black text-left text-[#F45A0A] tabular-nums" dir="ltr" style={monoFontStyle}>
                        {formatNumberEnglish(netCust)}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveApplicant(p.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
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

        {/* 📊 Comprehensive Financial Summary & Settlement Breakdown 📊 */}
        <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-5 shadow-2xs space-y-4">
          <h3 className="font-bold text-[14px] text-[#111827] flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-[#F45A0A]" />
              <span>{isAr ? 'ملخص التسوية والاسترجاع المالي' : 'Financial Settlement Summary'}</span>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {currency} ({isAr ? 'سعر الصرف:' : 'Rate:'} {exchangeRate})
            </span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* 1. Buy Refund (From Supplier) */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[11.5px] font-bold text-slate-500 block mb-1">
                {isAr ? 'مسترجع الشراء (من المورد)' : 'Gross Buy Refund'}
              </span>
              <span className="text-lg font-black font-mono text-slate-900 tabular-nums block" dir="ltr" style={monoFontStyle}>
                {formatNumberEnglish(isSupplierRefunded ? totalBuyRefund : 0)} <span className="text-xs font-sans font-bold text-slate-400">{currency}</span>
              </span>
              <span className={`text-[10px] font-bold block mt-1 ${isSupplierRefunded ? 'text-emerald-700' : 'text-rose-600'}`}>
                {isSupplierRefunded ? (isAr ? '✓ المورد أرجع المبلغ' : '✓ Supplier Refunded') : (isAr ? '✗ لم يرجع المورد (0)' : '✗ No Supplier Return')}
              </span>
            </div>

            {/* 2. Supplier Penalty */}
            <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200">
              <span className="text-[11.5px] font-bold text-rose-700 block mb-1">
                {isAr ? 'غرامات المورد والسفارة (-)' : 'Supplier Penalties (-)'}
              </span>
              <span className="text-lg font-black font-mono text-rose-700 tabular-nums block" dir="ltr" style={monoFontStyle}>
                -{formatNumberEnglish(totalSupplierPenalty)} <span className="text-xs font-sans font-bold text-rose-400">{currency}</span>
              </span>
              <span className="text-[10px] text-rose-600 font-bold block mt-1">
                {isAr ? `صافي من المورد: ${formatNumberEnglish(totalNetBuyReturn)}` : `Net from supplier: ${formatNumberEnglish(totalNetBuyReturn)}`}
              </span>
            </div>

            {/* 3. Agency Retention Fee / Profit */}
            <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200">
              <span className="text-[11.5px] font-bold text-emerald-800 block mb-1">
                {isAr ? 'رسوم وربح الوكالة (+)' : 'Agency Retention Fee (+)'}
              </span>
              <span className="text-lg font-black font-mono text-emerald-700 tabular-nums block" dir="ltr" style={monoFontStyle}>
                +{formatNumberEnglish(totalAgencyRetention)} <span className="text-xs font-sans font-bold text-emerald-500">{currency}</span>
              </span>
              <span className="text-[10px] text-emerald-600 font-bold block mt-1">
                {isAr ? 'ربح صافي للشركة من الاسترجاع' : 'Agency Net Realized Profit'}
              </span>
            </div>

            {/* 4. Net Refund to Customer */}
            <div className="p-3.5 rounded-xl bg-[#FFF3E8] border border-[#FFD8B2]">
              <span className="text-[11.5px] font-bold text-[#F45A0A] block mb-1">
                {isAr ? 'الصافي المستحق للعميل' : 'Net Paid to Customer'}
              </span>
              <span className="text-xl font-black font-mono text-[#F45A0A] tabular-nums block" dir="ltr" style={monoFontStyle}>
                {formatNumberEnglish(totalNetRefundToCustomer)} <span className="text-xs font-sans font-bold text-[#F45A0A]">{currency}</span>
              </span>
              <span className="text-[10px] text-slate-500 font-bold block mt-1">
                {isAr ? `(مسترجع البيع ${formatNumberEnglish(totalSellRefund)} - الخصومات)` : `(Sell ${formatNumberEnglish(totalSellRefund)} - Deductions)`}
              </span>
            </div>
          </div>
        </div>

        {/* Payment Method & Financial Settlement Section */}
        <div className="p-5 bg-white rounded-[14px] border border-[#E5E7EB] shadow-2xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <CreditCard size={17} className="text-[#F45A0A]" />
            <span>{isAr ? 'طريقة صرف وإرجاع المبلغ للعميل' : 'Customer Payment Refund Method'}</span>
          </h3>

          <div className="flex items-center gap-5 flex-wrap">
            <Radio
              checked={paymentType === 'CASH_HAND'}
              onChange={() => setPaymentType('CASH_HAND')}
              label={isAr ? 'نقدي (صرف من الصندوق)' : 'Cash Refund'}
              className="font-bold text-xs"
            />
            <Radio
              checked={paymentType === 'MASTER_CARD'}
              onChange={() => setPaymentType('MASTER_CARD')}
              label={isAr ? 'ماستركارد / حوالة بنكية' : 'Mastercard / Bank'}
              className="font-bold text-xs"
            />
            <Radio
              checked={paymentType === 'ON_ACCOUNT'}
              onChange={() => setPaymentType('ON_ACCOUNT')}
              label={isAr ? 'قيد على حساب العميل (آجل)' : 'Credit on Account'}
              className="font-bold text-xs"
            />
          </div>

          {paymentType === 'CASH_HAND' && (
            <div className="max-w-md">
              <label className="text-[12px] font-bold text-slate-700 block mb-1">
                {isAr ? 'اختر الصندوق المراد الصرف منه' : 'Cashbox'}
              </label>
              <Select
                value={cashboxId}
                onChange={(val) => val && setCashboxId(val)}
                data={cashboxes.map((c) => ({
                  value: c.id || c.code,
                  label: c.nameAr || c.name || 'الصندوق الرئيسي',
                }))}
                radius="md"
              />
            </div>
          )}

          {paymentType === 'MASTER_CARD' && (
            <div className="max-w-md">
              <label className="text-[12px] font-bold text-slate-700 block mb-1">
                {isAr ? 'اختر الحساب البنكي / الماستركارد' : 'Bank Account'}
              </label>
              <Select
                value={bankAccountId}
                onChange={(val) => val && setBankAccountId(val)}
                data={bankAccounts.map((b) => ({
                  value: b.id || b.code,
                  label: b.nameAr || b.name || 'حساب البنك',
                }))}
                radius="md"
              />
            </div>
          )}
        </div>
      </main>

      {/* 🔹 White Modern Sticky Bottom Bar with Real-time KPIs 🔹 */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md text-slate-900 border-t border-slate-200 px-6 py-2.5 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] flex items-center justify-between flex-wrap gap-4 font-sans text-xs">
        {/* Left / Leading Stats */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[11.5px] font-bold text-slate-500">{isAr ? 'رقم السند:' : 'Voucher #:'}</span>
            <span className="px-2.5 py-0.5 rounded-lg bg-[#FFF3E8] border border-orange-200 text-[#F45A0A] font-mono font-bold text-xs tracking-wider select-all" dir="ltr" style={monoFontStyle}>
              {refundNumber}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          {/* Quick KPI stats */}
          <div className="hidden lg:flex items-center gap-4 font-mono text-xs" dir="ltr" style={monoFontStyle}>
            <div>
              <span className="text-slate-400 font-sans">{isAr ? 'مسترجع الشراء: ' : 'Buy: '}</span>
              <span className="font-bold text-slate-800">{formatNumberEnglish(isSupplierRefunded ? totalBuyRefund : 0)}</span>
            </div>
            <div>
              <span className="text-slate-400 font-sans">{isAr ? 'غرامة المورد: ' : 'Penalty: '}</span>
              <span className="font-bold text-rose-600">{formatNumberEnglish(totalSupplierPenalty)}</span>
            </div>
            <div>
              <span className="text-slate-400 font-sans">{isAr ? 'مسترجع البيع: ' : 'Sell: '}</span>
              <span className="font-bold text-slate-800">{formatNumberEnglish(totalSellRefund)}</span>
            </div>
            <div>
              <span className="text-slate-400 font-sans">{isAr ? 'رسوم الوكالة: ' : 'Fee: '}</span>
              <span className="font-bold text-emerald-700">+{formatNumberEnglish(totalAgencyRetention)}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-orange-50 border border-orange-200">
            <span className="text-[#F45A0A] font-bold font-sans text-xs">{isAr ? 'الصافي للعميل: ' : 'Net Customer: '}</span>
            <span className="font-black font-mono text-sm text-[#F45A0A]" dir="ltr" style={monoFontStyle}>
              {formatNumberEnglish(totalNetRefundToCustomer)} <span className="text-[11px] font-sans font-bold">{currency}</span>
            </span>
          </div>
        </div>

        {/* Right / Actions */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="h-[38px] px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>

          <button
            type="button"
            disabled={submitting}
            onClick={handleSaveRefund}
            className="h-[38px] px-5 rounded-xl bg-[#F45A0A] hover:bg-orange-600 active:scale-[0.98] text-white font-black text-xs shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {submitting ? <RotateCcw size={14} className="animate-spin" /> : <Check size={16} strokeWidth={2.4} />}
            <span>{isAr ? 'حفظ وترحيل الاسترجاع' : 'Save & Post Refund'}</span>
          </button>
        </div>
      </footer>
    </div>
  );
};
export default VisaRefundEditorWorkspace;
