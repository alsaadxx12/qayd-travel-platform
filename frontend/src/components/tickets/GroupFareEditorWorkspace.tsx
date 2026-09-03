import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Tooltip,
  Modal,
  Menu,
  ActionIcon,
  Checkbox,
} from '@mantine/core';
import {
  Layers,
  Search,
  Check,
  X,
  Plus,
  Trash2,
  Users,
  User,
  Plane,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  TrendingUp,
  CreditCard,
  Building2,
  Calendar,
  AlertTriangle,
  MoreVertical,
  History,
  ClipboardPaste,
  Coins,
} from 'lucide-react';
import { ticketsApi, type TicketData } from '../../api/tickets';
import { airlinesApi, type AirlineItem } from '../../api/airlines';
import { partnersApi } from '../../api/partners';
import { accountsApi } from '../../api/accounts';
import { employeesApi, type Employee } from '../../api/employees';
import { fetchPrintTemplate } from '../../api/printTemplates';
import { SearchableCombobox, ComboboxOption } from '../ui/SearchableCombobox';
import { AccountFinderModal, type AccountFinderResult } from '../common/AccountFinderModal';
import { SegmentedDatePicker } from '../ui/SegmentedDatePicker';
import { CurrencySegmentedControl } from '../ui/CurrencySegmentedControl';
import { InvoiceAuditLogModal } from './InvoiceAuditLogModal';
import { showSuccessNotification, showErrorNotification, showInfoNotification } from '../../utils/notifications';
import { useLanguageStore } from '../../store/useLanguageStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useAdoptedExchangeRate } from '../../hooks/useAdoptedExchangeRate';
import { allocateDocumentNumber } from '../../utils/sequenceUtils';

export interface GroupFarePnrLine {
  id: string;
  selected: boolean;
  pnr: string;
  ticketNumber?: string;
  route?: string;
  paxCount: number;
  buyPrice: number;
  sellPrice: number;
}

interface GroupFareEditorWorkspaceProps {
  opened: boolean;
  onClose: () => void;
  initialData?: TicketData | null;
  onSuccess?: () => void;
}

// English / Western numeral formatting helper
const formatNumberEnglish = (num: number): string => {
  if (isNaN(num) || num === null || num === undefined) return '0';
  return num.toLocaleString('en-US');
};

// Clean number parse helper (converts any Eastern Arabic digits to English and strips commas)
const parseCleanNumber = (val: string | number): number => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  let clean = String(val).replace(/[٠-٩]/g, (d) => arabicDigits.indexOf(d).toString());
  clean = clean.replace(/,/g, '').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};


/**
 * ما يُفهم من نصٍّ ملصوق يصف رحلة كروب.
 *
 * الحقول التي لم تُذكر تبقى غير معرَّفة — لا تُخمَّن ولا تُملأ بأصفار.
 */
export interface ParsedPnrItem {
  pnr: string;
  paxCount?: number;
  buyPrice?: number;
  sellPrice?: number;
}

export interface GroupFarePaste {
  travelDate?: Date;
  returnDate?: Date;
  supplierName?: string;
  customerName?: string;
  seats?: number;
  buy?: { amount: number; currency: 'USD' | 'IQD'; isTotal: boolean };
  sell?: { amount: number; currency: 'USD' | 'IQD'; isTotal: boolean };
  route?: string;
  pnrs: string[];
  pnrItems: ParsedPnrItem[];
  /** ما فُهم فعلاً، ليُعرض للمستخدم قبل التطبيق. */
  found: string[];
}

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const toLatinDigits = (s: string) => String(s || '').replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));

/**
 * رقمٌ كما يكتبه الناس: 2,304,000 و2.304.000 و1.296 و٢٤.
 *
 * النقطة تفصل الآلاف في أغلب ما يُلصق هنا («$1.296» تعني ألفاً ومئتين وستّة
 * وتسعين)، فتُعامل فاصلةَ آلاف إلا حين تسبق رقمين فأقلّ في آخر العدد — وتلك
 * كسورٌ حقيقية مثل 54.50.
 */
const parsePastedAmount = (raw: string): number => {
  let s = toLatinDigits(raw).replace(/[^\d.,]/g, '').trim();
  if (!s) return 0;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  const decimalSep = lastDot > lastComma ? '.' : lastComma > -1 ? ',' : '';
  if (decimalSep) {
    const tail = s.slice(s.lastIndexOf(decimalSep) + 1);
    const isDecimal = tail.length > 0 && tail.length <= 2 && !/[.,]/.test(tail);
    if (isDecimal) {
      const head = s.slice(0, s.lastIndexOf(decimalSep)).replace(/[.,]/g, '');
      return Number(`${head}.${tail}`) || 0;
    }
  }
  return Number(s.replace(/[.,]/g, '')) || 0;
};

/** يوم/شهر/سنة كما يُكتب هنا، لا الشهر أولاً. */
const parsePastedDate = (raw: string): Date | undefined => {
  const s = toLatinDigits(raw).trim();
  const m = s.match(/(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{2,4})/);
  if (!m) return undefined;
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  if (!day || !month || month > 12 || day > 31) return undefined;
  const d = new Date(year, month - 1, day);
  return isNaN(d.getTime()) ? undefined : d;
};

const currencyOf = (line: string): 'USD' | 'IQD' | undefined => {
  const s = line.toLowerCase();
  if (s.includes('$') || /\busd\b/.test(s) || s.includes('دولار')) return 'USD';
  if (/\biqd\b/.test(s) || s.includes('دينار') || s.includes('د.ع')) return 'IQD';
  return undefined;
};

/** «توتل» و«اجمالي» و«total» تعني أن الرقم للمجموعة كلها لا للمقعد. */
const isTotalLine = (line: string): boolean =>
  /توتل|إجمالي|اجمالي|الكلي|total/i.test(line);

/**
 * قراءة نصّ الكروب الملصوق.
 *
 * ما يصل من الموردين ليس جدولاً بل وصفٌ بالعربية: تاريخ، ومورد، ومستفيد، وعدد
 * مقاعد، وسعران غالباً بعملتين مختلفتين و«توتل» للمجموعة. وكان المستورد يقرأ كل
 * سطرٍ منه على أنه PNR فيخرج بأحد عشر سطراً لا معنى لها. فيُقرأ الآن بما هو.
 */
export const parseGroupFareText = (text: string): GroupFarePaste => {
  const out: GroupFarePaste = { pnrs: [], pnrItems: [], found: [] };
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    const bare = line.replace(/^[•\-*]\s*/, '');

    // التواريخ: «ذهاب: 5/9/2026» و«عودة: …»
    if (/ذهاب|مغادرة|departure|outbound/i.test(bare)) {
      const d = parsePastedDate(bare);
      if (d && !out.travelDate) {
        out.travelDate = d;
        out.found.push(`تاريخ الذهاب: ${d.toLocaleDateString('en-GB')}`);
        continue;
      }
    }
    if (/عودة|رجوع|return|inbound/i.test(bare)) {
      const d = parsePastedDate(bare);
      if (d && !out.returnDate) {
        out.returnDate = d;
        out.found.push(`تاريخ العودة: ${d.toLocaleDateString('en-GB')}`);
        continue;
      }
    }

    // الأطراف
    const supplier = bare.match(/(?:المورد|المجهز|المزود|supplier)\s*[:：]\s*(.+)$/i);
    if (supplier && !out.supplierName) {
      out.supplierName = supplier[1].trim();
      out.found.push(`المورد: ${out.supplierName}`);
      continue;
    }
    const customer = bare.match(/(?:المستفيد|العميل|الزبون|customer|client)\s*[:：]\s*(.+)$/i);
    if (customer && !out.customerName) {
      out.customerName = customer[1].trim();
      out.found.push(`المستفيد: ${out.customerName}`);
      continue;
    }

    // المقاعد العامة: «24 مقعد» أو «عدد المقاعد: 24» (إذا لم تكن مرتبطة برمز PNR)
    const seatsMatch =
      bare.match(/^(?:عدد\s*(?:المقاعد|المسافرين)|seats|pax)\s*[:：]?\s*([\d٠-٩]+)/i) ||
      bare.match(/^([\d٠-٩]+)\s*(?:مقعد|مقاعد|كرسي|seats?|pax)$/i);
    if (seatsMatch && !out.seats) {
      const n = Number(toLatinDigits(seatsMatch[1]));
      if (n > 0) {
        out.seats = n;
        out.found.push(`عدد المقاعد: ${n}`);
        continue;
      }
    }

    // الأسعار
    const isBuy = /(?:سعر\s*)?(?:الشراء|شراء|buy|cost)/i.test(bare);
    const isSell = /(?:سعر\s*)?(?:المبيع|البيع|بيع|sell|sale)/i.test(bare);
    if (isBuy || isSell) {
      const amount = parsePastedAmount(bare.replace(/[\d٠-٩]{1,2}\s*[\/\-.]\s*[\d٠-٩]{1,2}\s*[\/\-.]\s*[\d٠-٩]{2,4}/g, ''));
      if (amount > 0) {
        const entry = {
          amount,
          currency: currencyOf(bare) || 'IQD',
          isTotal: isTotalLine(bare),
        } as const;
        const label = `${entry.amount.toLocaleString('en-US')} ${entry.currency}${entry.isTotal ? ' (توتل)' : ''}`;
        if (isBuy && !out.buy) {
          out.buy = { ...entry };
          out.found.push(`سعر الشراء: ${label}`);
          continue;
        }
        if (isSell && !out.sell) {
          out.sell = { ...entry };
          out.found.push(`سعر البيع: ${label}`);
          continue;
        }
      }
    }

    // المسار: «BGW - IST» أو «بغداد - اسطنبول»
    const route = bare.match(/^\s*([A-Z]{3})\s*[-–>/]+\s*([A-Z]{3})\s*$/);
    if (route && !out.route) {
      out.route = `${route[1]} - ${route[2]}`;
      out.found.push(`المسار: ${out.route}`);
      continue;
    }

    // فحص أسطر الـ PNR مع العدد الخاص بكل PNR (أمثلة: "HWG83L 10" / "HWG83L: 10" / "HWG83L (10)" / "10 HWG83L" / "1. HWG83L 8")
    const cleanPnrLine = bare.replace(/^(?:\d+[\.\-\)]\s*|pnr\s*[:：]?\s*|حجز\s*[:：]?\s*)/i, '').trim();
    const tokenMatches = cleanPnrLine.toUpperCase().match(/\b[A-Z0-9]{5,7}\b/g);
    
    if (tokenMatches) {
      const reservedKeywords = new Set(['TOTAL', 'SEATS', 'DEPT', 'DATE', 'PRICE', 'ROUTE', 'ADULT', 'CHILD', 'INFANT', 'GROUP']);
      const validPnr = tokenMatches.find((t) => /[A-Z]/.test(t) && !reservedKeywords.has(t) && !/^\d+$/.test(t));
      
      if (validPnr) {
        // البحث عن عدد المقاعد الخاص بهذا الـ PNR في نفس السطر
        const remainder = cleanPnrLine.toUpperCase().replace(validPnr, ' ').trim();
        const pnrCountMatch =
          remainder.match(/(?:عدد\s*(?:المقاعد|المسافرين)?\s*[:：]?\s*|\(\s*|[-–:]\s*|\b|^)([\d٠-٩]{1,3})\s*(?:مقعد|مقاعد|مسافر|ركاب|seats?|pax|\)|\b|$)/i);

        let linePax: number | undefined = undefined;
        if (pnrCountMatch) {
          const parsedCount = Number(toLatinDigits(pnrCountMatch[1]));
          if (parsedCount > 0 && parsedCount < 1000) {
            linePax = parsedCount;
          }
        }

        out.pnrs.push(validPnr);
        out.pnrItems.push({
          pnr: validPnr,
          paxCount: linePax,
        });
        continue;
      }
    }
  }

  if (out.pnrItems.length > 0) {
    const pnrSummary = out.pnrItems.map((p) => (p.paxCount ? `${p.pnr} (${p.paxCount})` : p.pnr)).join(' - ');
    out.found.push(`أرقام الحجز (${out.pnrItems.length}): ${pnrSummary}`);
  }

  return out;
};

export const GroupFareEditorWorkspace: React.FC<GroupFareEditorWorkspaceProps> = ({
  opened,
  onClose,
  initialData,
  onSuccess,
}) => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';
  const { user } = useAuthStore();
  const { adoptedRate } = useAdoptedExchangeRate();

  // Audit Log Modal State
  const [auditLogOpen, setAuditLogOpen] = useState(false);

  // Bulk PNR Paste Modal State
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [accountFinder, setAccountFinder] = useState<{
    open: boolean;
    scope: 'SUPPLIER' | 'CUSTOMER';
    query: string;
  }>({ open: false, scope: 'SUPPLIER', query: '' });
  const [pasteDefaultPax, setPasteDefaultPax] = useState<number>(1);
  const [pasteDefaultBuy, setPasteDefaultBuy] = useState<string>('');
  const [pasteDefaultSell, setPasteDefaultSell] = useState<string>('');

  // Reference Datasets
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [accountsList, setAccountsList] = useState<any[]>([]);
  const [airlinesList, setAirlinesList] = useState<AirlineItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [paymentMethodsConfig, setPaymentMethodsConfig] = useState<any[] | null>(null);

  // Workspace Form State
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [issueDate, setIssueDate] = useState<Date>(new Date());
  const [travelDate, setTravelDate] = useState<Date | null>(null);
  const [returnDate, setReturnDate] = useState<Date | null>(null);
  const [currency, setCurrency] = useState<string>('IQD');
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [airline, setAirline] = useState<string>('');
  const [generalRoute, setGeneralRoute] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [supplierAccount, setSupplierAccount] = useState<string>('');
  const [supplierAccountName, setSupplierAccountName] = useState<string>('');
  const [employeeName, setEmployeeName] = useState<string>('');
  
  // Payment Type & Method States
  const [paymentType, setPaymentType] = useState<string>('نقدي'); // 'نقدي' | 'آجل'
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH_HAND');
  const [receivingCashbox, setReceivingCashbox] = useState<string>('');
  const [autoMatchedCashboxName, setAutoMatchedCashboxName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Multi-PNR Lines
  const [pnrLines, setPnrLines] = useState<GroupFarePnrLine[]>([
    {
      id: `pnr-${Date.now()}`,
      selected: true,
      pnr: '',
      ticketNumber: '',
      route: '',
      paxCount: 1,
      buyPrice: 0,
      sellPrice: 0,
    },
  ]);

  // Bulk Apply Bar States
  const [bulkPaxCount, setBulkPaxCount] = useState<string>('');
  const [bulkBuyPrice, setBulkBuyPrice] = useState<string>('');
  const [bulkSellPrice, setBulkSellPrice] = useState<string>('');

  // Helper to resolve clean human-readable customer name from UUID/ID
  const resolveCustomerDisplay = useCallback((raw?: string) => {
    if (!raw) return '';
    const found = customers.find((c) => c.id === raw || c.nameAr === raw || c.name === raw);
    return found ? (found.nameAr || found.name || raw) : raw;
  }, [customers]);

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

  // Formatted select options for Cashboxes (Exclusively clean account names, NO appended codes)
  const formattedCashboxesData: ComboboxOption[] = useMemo(() => {
    return availableCashboxes.map((c: any) => ({
      value: c.id || c.code,
      label: isAr ? (c.nameAr || c.name || c.id) : (c.nameEn || c.nameAr || c.name || c.id),
      subtitle: c.code || undefined,
    }));
  }, [availableCashboxes, isAr]);

  // Payment methods list fetched dynamically from System Settings
  const paymentMethodsList: ComboboxOption[] = useMemo(() => {
    if (Array.isArray(paymentMethodsConfig) && paymentMethodsConfig.length > 0) {
      return paymentMethodsConfig.map((pm: any) => {
        const displayLabel = isAr ? (pm.nameAr || pm.key) : (pm.nameEn || pm.nameAr || pm.key);
        return {
          value: pm.key || pm.id || pm.nameAr,
          label: displayLabel,
          subtitle: pm.description || undefined,
        };
      });
    }

    return [
      { value: 'CASH_HAND', label: isAr ? 'كاش باليد (نقدي)' : 'Cash in Hand (Immediate)' },
      { value: 'ZAIN_CASH', label: isAr ? 'زين كاش (Zain Cash)' : 'Zain Cash' },
      { value: 'FIB', label: isAr ? 'مصرف العراق الأول (FIB)' : 'First Iraqi Bank (FIB)' },
      { value: 'QI_CARD', label: isAr ? 'كي كارد (Qi Card)' : 'Qi Card' },
      { value: 'BANK_TRANSFER', label: isAr ? 'تحويل بنكي' : 'Bank Transfer' },
    ];
  }, [paymentMethodsConfig, isAr]);

  // Auto assign cashbox from selected employee
  const applyEmployeeCashbox = useCallback((selectedEmpName: string, availableBoxes: any[]) => {
    if (!selectedEmpName || availableBoxes.length === 0) return false;

    const emp = employees.find((e: any) => {
      const names = [e.fullName, e.name, e.username, e.email];
      return names.some((n) => String(n || '').trim() === String(selectedEmpName).trim());
    });

    const assigned = String(
      emp?.assignedCashbox || (emp as any)?.assignedCashboxId || (emp as any)?.cashboxId || (emp as any)?.cashboxAccountId || '',
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

    let targetBox = matchBox(availableBoxes, assigned);
    if (!targetBox && emp?.fullName) {
      targetBox = matchBox(availableBoxes, emp.fullName);
    }

    if (targetBox) {
      setReceivingCashbox(targetBox.id || targetBox.code);
      setAutoMatchedCashboxName(isAr ? (targetBox.nameAr || targetBox.name) : (targetBox.nameEn || targetBox.nameAr));
      return true;
    }

    if (availableBoxes.length > 0) {
      setReceivingCashbox(availableBoxes[0].id || availableBoxes[0].code);
      setAutoMatchedCashboxName(isAr ? (availableBoxes[0].nameAr || availableBoxes[0].name) : (availableBoxes[0].nameEn || availableBoxes[0].nameAr));
      return true;
    }

    return false;
  }, [employees, isAr]);

  // ── Financial Calculation Logic ──
  const activeLines = useMemo(() => pnrLines.filter((l) => l.selected), [pnrLines]);

  // Total calculated passengers across all active PNRs
  const totalCalculatedPax = useMemo(() => {
    return activeLines.reduce((sum, l) => sum + (Math.max(1, Number(l.paxCount) || 1)), 0);
  }, [activeLines]);

  // Total Buy = sum(paxCount * buyPrice)
  const totalBuy = useMemo(() => {
    return activeLines.reduce((sum, l) => {
      const count = Math.max(1, Number(l.paxCount) || 1);
      const buy = Number(l.buyPrice) || 0;
      return sum + (count * buy);
    }, 0);
  }, [activeLines]);

  // Total Sell = sum(paxCount * sellPrice)
  const totalSell = useMemo(() => {
    return activeLines.reduce((sum, l) => {
      const count = Math.max(1, Number(l.paxCount) || 1);
      const sell = Number(l.sellPrice) || 0;
      return sum + (count * sell);
    }, 0);
  }, [activeLines]);

  // Total Profit = Total Sell - Total Buy
  const totalProfit = useMemo(() => {
    return totalSell - totalBuy;
  }, [totalSell, totalBuy]);

  // Load Base Datasets & Initial Data
  useEffect(() => {
    if (opened) {
      if (initialData) {
        if (initialData.invoiceNumber) setInvoiceNumber(initialData.invoiceNumber);
        else allocateDocumentNumber('groups').then(setInvoiceNumber);
        setIssueDate(initialData.issueDate ? new Date(initialData.issueDate) : new Date());
        setTravelDate(initialData.travelDate ? new Date(initialData.travelDate) : null);
        setReturnDate(initialData.returnDate ? new Date(initialData.returnDate) : null);
        setCustomerName(resolveCustomerDisplay(initialData.customerName) || initialData.customerName || '');
        const initialSupplierName = initialData.supplierAccountName || initialData.supplier?.nameAr || (initialData as any).supplierNameDisplay || '';
        const initialSupplierValue = initialData.supplierAccountId || initialData.supplier?.accountId || initialData.supplierAccount || initialData.supplierId || initialSupplierName;
        setSupplierAccount(initialSupplierValue);
        setSupplierAccountName(initialSupplierName);
        setGeneralRoute(initialData.route || '');
        setCurrency(initialData.currency || 'IQD');
        setExchangeRate(initialData.exchangeRate || 1);
        setEmployeeName(initialData.employeeName || user?.name || '');
        
        const rawPayType = initialData.paymentType || '';
        const isCredit = rawPayType === 'CREDIT' || rawPayType === 'آجل' || rawPayType === 'ON_ACCOUNT';
        setPaymentType(isCredit ? 'آجل' : 'نقدي');
        setPaymentMethod(initialData.paymentMethod || 'CASH_HAND');
        setReceivingCashbox(initialData.receivingCashbox || (initialData as any).cashboxAccountId || initialData.cashbox || '');
        setNotes(initialData.notes || '');
        setAirline(initialData.airline || '');

        const rawPaxList = (initialData as any).detailedPassengers || initialData.passengers || [];
        if (rawPaxList && rawPaxList.length > 0) {
          setPnrLines(
            rawPaxList.map((p: any, idx: number) => {
              let count = 1;
              const match = (p.name || '').match(/(\d+)\s*مسافر/);
              if (match) {
                count = parseInt(match[1], 10) || 1;
              }
              const totalLineBuy = Math.abs(p.fareBuy || 0);
              const totalLineSell = Math.abs(p.fareSell || 0);
              const unitBuy = count > 0 ? (totalLineBuy / count) : totalLineBuy;
              const unitSell = count > 0 ? (totalLineSell / count) : totalLineSell;

              return {
                id: p.id || `pnr-${idx}-${Date.now()}`,
                selected: true,
                pnr: p.pnr || initialData.pnr || '',
                ticketNumber: p.ticketNumber || '',
                route: initialData.route || '',
                paxCount: count,
                buyPrice: unitBuy,
                sellPrice: unitSell,
              };
            })
          );
        } else {
          setPnrLines([
            {
              id: `pnr-${Date.now()}`,
              selected: true,
              pnr: initialData.pnr || '',
              ticketNumber: '',
              route: initialData.route || '',
              paxCount: 1,
              buyPrice: Math.abs(initialData.totalBuy || 0),
              sellPrice: Math.abs(initialData.totalSell || 0),
            },
          ]);
        }
      } else {
        allocateDocumentNumber('groups').then(setInvoiceNumber);
        setEmployeeName(user?.name || '');
        setPaymentType('نقدي');
        setPaymentMethod('CASH_HAND');
        setPnrLines([
          {
            id: `pnr-${Date.now()}`,
            selected: true,
            pnr: '',
            ticketNumber: '',
            route: '',
            paxCount: 1,
            buyPrice: 0,
            sellPrice: 0,
          },
        ]);
        setCustomerName('');
        setSupplierAccount('');
        setSupplierAccountName('');
        setAirline('');
        setGeneralRoute('');
        setNotes('');
      }

      // Fetch options
      partnersApi.getCustomers().then((data) => setCustomers(data || [])).catch(() => {});
      partnersApi.getSuppliers().then((data) => setSuppliers(data || [])).catch(() => {});
      airlinesApi.getAll().then((data) => setAirlinesList(data || [])).catch(() => {});
      employeesApi.getAll().then((data) => {
        const empList = data || [];
        setEmployees(empList);
      }).catch(() => {});
      
      accountsApi.getFlat(undefined, undefined, true).then((data) => {
        const accList = data || [];
        setAccountsList(accList);
      }).catch(() => {});

      // Fetch payment methods configuration
      fetchPrintTemplate('payment_methods_mapping')
        .then((res: any) => {
          if (res?.config?.mappings && Array.isArray(res.config.mappings)) {
            setPaymentMethodsConfig(res.config.mappings.filter((m: any) => m.isActive !== false));
          }
        })
        .catch(() => {});
    }
  }, [opened, initialData, user, resolveCustomerDisplay]);

  // Sync employee cashbox on load or employee change
  useEffect(() => {
    if (employeeName && availableCashboxes.length > 0 && !receivingCashbox) {
      applyEmployeeCashbox(employeeName, availableCashboxes);
    }
  }, [employeeName, availableCashboxes, receivingCashbox, applyEmployeeCashbox]);

  // Sync supplier name
  useEffect(() => {
    if (!supplierAccount || suppliers.length === 0) return;
    const matchedSupplier = suppliers.find((supplier) =>
      [
        supplier.id,
        supplier.accountId,
        supplier.account?.id,
        supplier.code,
        supplier.nameAr,
        supplier.nameEn,
        supplier.name,
      ].includes(supplierAccount)
    );

    if (matchedSupplier) {
      setSupplierAccountName(
        matchedSupplier.nameAr || matchedSupplier.nameEn || matchedSupplier.name || matchedSupplier.code || ''
      );
    }
  }, [supplierAccount, suppliers]);

  // Sync exchange rate
  useEffect(() => {
    if (currency === 'USD' && adoptedRate > 0) {
      setExchangeRate(adoptedRate);
    } else {
      setExchangeRate(1);
    }
  }, [currency, adoptedRate]);

  // Add a single PNR row
  const handleAddPnrRow = () => {
    setPnrLines((prev) => [
      ...prev,
      {
        id: `pnr-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        selected: true,
        pnr: '',
        ticketNumber: '',
        route: generalRoute || '',
        paxCount: 1,
        buyPrice: prev[prev.length - 1]?.buyPrice || 0,
        sellPrice: prev[prev.length - 1]?.sellPrice || 0,
      },
    ]);
  };

  // Remove PNR row
  const handleRemovePnrRow = (id: string) => {
    if (pnrLines.length <= 1) {
      showErrorNotification(isAr ? 'تنبيه' : 'Alert', isAr ? 'يجب أن تحتوي الفاتورة على PNR واحد على الأقل.' : 'At least one PNR required.');
      return;
    }
    setPnrLines((prev) => prev.filter((l) => l.id !== id));
  };

  // Update specific PNR field
  const updatePnrField = (id: string, field: keyof GroupFarePnrLine, val: any) => {
    setPnrLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: val } : l))
    );
  };

  // Bulk apply values to all selected PNRs
  const handleApplyBulk = () => {
    const buyVal = parseCleanNumber(bulkBuyPrice);
    const sellVal = parseCleanNumber(bulkSellPrice);
    const paxVal = parseCleanNumber(bulkPaxCount);

    if (!buyVal && !sellVal && !paxVal) {
      showErrorNotification(
        isAr ? 'تنبيه' : 'Alert',
        isAr ? 'يرجى إدخال قيمة واحدة على الأقل لتطبيقها (عدد مسافرين، سعر شراء، أو سعر بيع).' : 'Please enter at least one value to apply.'
      );
      return;
    }

    setPnrLines((prev) =>
      prev.map((l) => {
        if (!l.selected) return l;
        return {
          ...l,
          paxCount: paxVal > 0 ? paxVal : l.paxCount,
          buyPrice: buyVal > 0 ? buyVal : l.buyPrice,
          sellPrice: sellVal > 0 ? sellVal : l.sellPrice,
        };
      })
    );

    showSuccessNotification(
      isAr ? 'تم التطبيق بنجاح' : 'Applied',
      isAr ? `تم تطبيق القيم على (${activeLines.length}) PNR محدد.` : `Applied values to ${activeLines.length} selected PNRs.`
    );
  };

  // Parse and process pasted multi-line PNRs
  /** ما يفهمه النظام من النص المُلصق الآن — يُحسب أثناء الكتابة ليُعرض قبل التطبيق. */
  const pastedUnderstanding = useMemo(() => parseGroupFareText(pastedText), [pastedText]);

  /*
   * تطبيق ما فُهم على الرحلة.
   *
   * «توتل» تعني أن السعر للمجموعة كلّها، فيُقسَّم على المقاعد ليصير سعر المقعد —
   * وهو ما تحتاجه أسطر الحجز. وحين تختلف عملة الشراء عن عملة البيع لا يُخترع سعر
   * صرف: تُملأ القيمتان كما وردتا ويُقال للمستخدم صراحةً أن العملتين مختلفتان،
   * لأن تحويلاً بسعرٍ لم يذكره أحد أسوأ من تنبيهٍ يقرأه.
   */
  const handleApplyUnderstanding = () => {
    const info = pastedUnderstanding;
    if (info.found.length === 0) {
      showErrorNotification(
        isAr ? 'لم يُفهم النص' : 'Nothing recognised',
        isAr ? 'لم يُعثر على تاريخ أو مورد أو سعر أو عدد مقاعد في النص الملصوق.' : 'No date, supplier, price or seat count found.',
      );
      return;
    }

    if (info.travelDate) setTravelDate(info.travelDate);
    if (info.returnDate) setReturnDate(info.returnDate);
    if (info.customerName) setCustomerName(info.customerName);
    if (info.route) setGeneralRoute(info.route);

    if (info.supplierName) {
      setSupplierAccountName(info.supplierName);
      const needle = info.supplierName.trim().toLowerCase();
      const match =
        suppliers.find((s: any) => String(s.nameAr || s.name || '').trim().toLowerCase() === needle) ||
        suppliers.find((s: any) => String(s.nameAr || s.name || '').toLowerCase().includes(needle)) ||
        accountsList.find((a: any) => String(a.nameAr || '').toLowerCase().includes(needle));
      if (match) setSupplierAccount(match.id || match.accountId || info.supplierName);
    }

    // Calculate total seats: either explicit info.seats or sum of pnr pax counts
    const explicitPnrSeatsSum = info.pnrItems.reduce((acc, item) => acc + (item.paxCount || 0), 0);
    const totalSeats = info.seats && info.seats > 0 ? info.seats : (explicitPnrSeatsSum > 0 ? explicitPnrSeatsSum : undefined);

    if (info.sell) setCurrency(info.sell.currency);

    const perSeat = (p?: { amount: number; isTotal: boolean }) => {
      if (!p) return undefined;
      if (!p.isTotal) return p.amount;
      const denom = totalSeats || (info.pnrItems.length > 0 ? info.pnrItems.length : 1);
      return Math.round((p.amount / denom) * 100) / 100;
    };

    const buyEach = perSeat(info.buy);
    const sellEach = perSeat(info.sell);

    if (info.pnrItems.length > 0 || totalSeats || buyEach !== undefined || sellEach !== undefined) {
      const stamp = Date.now();
      let lines: GroupFarePnrLine[] = [];

      if (info.pnrItems.length > 0) {
        const hasIndividualCounts = info.pnrItems.some((item) => item.paxCount && item.paxCount > 0);
        const unspecifiedCount = info.pnrItems.filter((item) => !item.paxCount).length;
        const remainder = totalSeats && totalSeats > explicitPnrSeatsSum ? totalSeats - explicitPnrSeatsSum : 0;
        const defaultForUnspecified = unspecifiedCount > 0 ? Math.max(1, Math.floor(remainder / unspecifiedCount)) : 1;

        lines = info.pnrItems.map((item, i) => {
          let linePax = item.paxCount;
          if (!linePax || linePax <= 0) {
            if (hasIndividualCounts && unspecifiedCount > 0) {
              linePax = defaultForUnspecified;
            } else if (totalSeats && !hasIndividualCounts) {
              // Distribute total seats evenly across PNRs
              linePax = Math.max(1, Math.floor(totalSeats / info.pnrItems.length));
              // Give any remainder to the last item
              if (i === info.pnrItems.length - 1) {
                const alreadyAllocated = linePax * (info.pnrItems.length - 1);
                if (totalSeats > alreadyAllocated) {
                  linePax = totalSeats - alreadyAllocated;
                }
              }
            } else {
              linePax = 1;
            }
          }

          return {
            id: `pnr-${stamp}-${i}`,
            selected: true,
            pnr: item.pnr,
            ticketNumber: '',
            route: info.route || '',
            paxCount: linePax,
            buyPrice: buyEach || 0,
            sellPrice: sellEach || 0,
          };
        });
      } else {
        lines = [
          {
            id: `pnr-${stamp}`,
            selected: true,
            pnr: '',
            ticketNumber: '',
            route: info.route || '',
            paxCount: totalSeats || 1,
            buyPrice: buyEach || 0,
            sellPrice: sellEach || 0,
          },
        ];
      }

      setPnrLines(lines);
    }

    setPasteModalOpen(false);
    setPastedText('');

    const mixed = info.buy && info.sell && info.buy.currency !== info.sell.currency;
    showSuccessNotification(
      isAr ? 'تم استخراج وتطبيق البيانات' : 'Data extracted & applied',
      isAr ? `طُبّق ${info.found.length} حقول وحُددت أعداد المسافرين لكل PNR بنجاح.` : `Applied ${info.found.length} field(s) with per-PNR pax counts.`,
    );
    if (mixed) {
      showInfoNotification(
        isAr ? 'العملتان مختلفتان' : 'Two currencies',
        isAr
          ? `الشراء بـ${info.buy!.currency} والبيع بـ${info.sell!.currency} — عملة الفاتورة ضُبطت على ${info.sell!.currency}، فراجع سعر الشراء أو حوّله بسعر الصرف المعتمد.`
          : `Buy is in ${info.buy!.currency} while sell is in ${info.sell!.currency}. The invoice currency was set to ${info.sell!.currency}; review the buy price.`,
      );
    }
  };

  const handleProcessPastedPnrs = () => {
    if (!pastedText.trim()) {
      showErrorNotification(isAr ? 'تنبيه' : 'Alert', isAr ? 'يرجى لصق قائمة الـ PNRs أولاً.' : 'Please paste PNRs list.');
      return;
    }

    const lines = pastedText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) return;

    const parsedLines: GroupFarePnrLine[] = [];
    const defaultBuy = parseCleanNumber(pasteDefaultBuy);
    const defaultSell = parseCleanNumber(pasteDefaultSell);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const clean = line.replace(/^(?:\d+[\.\-\)]\s*|pnr\s*[:：]?\s*)/i, '').trim();
      const parts = clean.includes('\t')
        ? clean.split('\t').map((p) => p.trim())
        : clean.includes(',')
        ? clean.split(',').map((p) => p.trim())
        : clean.split(/\s+/).map((p) => p.trim());

      const rawPnr = (parts[0] || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!rawPnr) continue;

      let linePax = pasteDefaultPax > 0 ? pasteDefaultPax : 1;
      let lineBuy = defaultBuy;
      let lineSell = defaultSell;

      if (parts.length >= 2) {
        const countParsed = Number(toLatinDigits(parts[1]));
        if (!isNaN(countParsed) && countParsed > 0 && countParsed < 1000) {
          linePax = countParsed;
        }
      }

      if (parts.length >= 3) {
        lineBuy = parseCleanNumber(parts[2]);
      }

      if (parts.length >= 4) {
        lineSell = parseCleanNumber(parts[3]);
      }

      parsedLines.push({
        id: `pnr-paste-${i}-${Date.now()}`,
        selected: true,
        pnr: rawPnr,
        ticketNumber: '',
        route: generalRoute || '',
        paxCount: linePax,
        buyPrice: lineBuy,
        sellPrice: lineSell,
      });
    }

    if (parsedLines.length === 0) {
      showErrorNotification(isAr ? 'تنبيه' : 'Alert', isAr ? 'لم يتم العثور على أي PNR صالح في النص المُلصق.' : 'No valid PNRs detected.');
      return;
    }

    setPnrLines((prev) => {
      const isFirstRowEmpty = prev.length === 1 && !prev[0].pnr.trim();
      return isFirstRowEmpty ? parsedLines : [...prev, ...parsedLines];
    });

    setPasteModalOpen(false);
    setPastedText('');
    showSuccessNotification(
      isAr ? 'تم استيراد الـ PNRs بنجاح' : 'PNRs Imported',
      isAr ? `تمت إضافة (${parsedLines.length}) PNR إلى الجدول بنجاح.` : `Imported ${parsedLines.length} PNRs to the table.`
    );
  };

  // Save & Post Group Fare Invoice
  const handleSaveGroupFare = async () => {
    if (activeLines.length === 0) {
      showErrorNotification(isAr ? 'تنبيه' : 'Alert', isAr ? 'يرجى تحديد PNR واحد على الأقل.' : 'Select at least one PNR.');
      return;
    }

    const emptyPnrs = activeLines.filter((l) => !l.pnr.trim());
    if (emptyPnrs.length > 0) {
      showErrorNotification(isAr ? 'تنبيه' : 'Alert', isAr ? 'يرجى إدخال كود الـ PNR لجميع السطور المحددة.' : 'Fill in PNR code for all selected lines.');
      return;
    }

    if (!customerName.trim()) {
      showErrorNotification(isAr ? 'العميل مطلوب' : 'Customer required', isAr ? 'يرجى تحديد العميل / الحساب المستفيد.' : 'Select the customer account.');
      return;
    }

    if (totalSell <= 0) {
      showErrorNotification(isAr ? 'المبلغ غير صحيح' : 'Invalid total', isAr ? 'يجب أن يكون إجمالي البيع أكبر من صفر.' : 'Total sell must be greater than zero.');
      return;
    }

    if (!employeeName.trim()) {
      showErrorNotification(isAr ? 'الموظف مطلوب' : 'Employee required', isAr ? 'حدد موظف الإدخال والاعتماد.' : 'Select the issuing employee.');
      return;
    }

    const isCashSale = paymentType === 'نقدي' || paymentType === 'DEBIT';
    if (isCashSale && !receivingCashbox) {
      showErrorNotification(isAr ? 'صندوق التحصيل مطلوب' : 'Cashbox required', isAr ? 'اختر صندوق استلام قيمة البيع.' : 'Select receiving cashbox.');
      return;
    }

    const matchedCustomer = customers.find((customer) =>
      [customer.id, customer.code, customer.nameAr, customer.nameEn, customer.name].includes(customerName),
    );
    const matchedSupplier = suppliers.find((supplier) =>
      [supplier.id, supplier.accountId, supplier.account?.id, supplier.code, supplier.nameAr, supplier.nameEn, supplier.name].includes(supplierAccount)
      || [supplier.nameAr, supplier.nameEn, supplier.name].includes(supplierAccountName),
    );

    setSubmitting(true);
    try {
      const mainPnr = activeLines[0]?.pnr.trim().toUpperCase();
      const pnrListStr = activeLines.map((l) => l.pnr.trim().toUpperCase()).join(' - ');

      const payload: any = {
        invoiceNumber,
        issueDate: issueDate.toISOString(),
        travelDate: travelDate ? travelDate.toISOString() : null,
        returnDate: returnDate ? returnDate.toISOString() : null,
        pnr: mainPnr,
        customerName: customerName.trim(),
        customerId: matchedCustomer?.id || undefined,
        customerAccountId: matchedCustomer?.accountId || matchedCustomer?.account?.id || undefined,
        employeeName: employeeName.trim(),
        entryEmployee: user?.name || employeeName.trim(),
        cashbox: isCashSale ? receivingCashbox : null,
        cashboxAccountId: isCashSale ? receivingCashbox : null,
        receivingCashbox: isCashSale ? receivingCashbox : null,
        currency,
        exchangeRate,
        paymentType: isCashSale ? 'DEBIT' : 'CREDIT',
        paymentMethod: isCashSale ? paymentMethod : null,
        supplierAccount,
        supplierAccountName,
        supplierId: matchedSupplier?.id || undefined,
        supplierAccountId: matchedSupplier?.accountId || matchedSupplier?.account?.id || undefined,
        tripType: 'GROUP_FARE',
        airline: airline || undefined,
        route: generalRoute || undefined,
        totalSell,
        totalBuy,
        netSell: totalSell,
        netBuy: totalBuy,
        profit: totalProfit,
        notes: `[فاتورة كروب فير: ${activeLines.length} PNR | إجمالي المسافرين: ${totalCalculatedPax}] PNRs: ${pnrListStr} | ${notes || ''}`,
        status: 'POSTED',
        passengers: activeLines.map((l) => {
          const count = Math.max(1, Number(l.paxCount) || 1);
          const lineBuy = count * (Number(l.buyPrice) || 0);
          const lineSell = count * (Number(l.sellPrice) || 0);
          return {
            name: `كروب [${l.pnr.trim().toUpperCase()}] - (${count}) مسافر`,
            ticketType: 'ADULT',
            ticketNumber: l.ticketNumber || undefined,
            pnr: l.pnr.trim().toUpperCase(),
            fareBuy: lineBuy,
            fareSell: lineSell,
            tax1: 0,
            tax2: 0,
            charge: 0,
            status: 'Active',
          };
        }),
      };

      const existingId = initialData?.id;
      if (existingId) {
        await ticketsApi.update(existingId, payload);
      } else {
        await ticketsApi.create(payload);
      }

      showSuccessNotification(
        isAr ? 'تم حفظ وترحيل فاتورة الكروب فير' : 'Group Fare Saved & Posted',
        isAr
          ? `تم حفظ وترحيل فاتورة الكروب ${invoiceNumber} لعدد (${activeLines.length}) PNR بنجاح.`
          : `Group Fare invoice ${invoiceNumber} posted successfully.`
      );

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      showErrorNotification(
        isAr ? 'فشل حفظ الفاتورة' : 'Save Failed',
        err?.message || (isAr ? 'حدث خطأ أثناء حفظ قيد الكروب فير' : 'Error saving group fare')
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Select dropdown options
  const airlineOptions: ComboboxOption[] = useMemo(() => {
    return airlinesList.map((a) => ({
      value: a.nameAr || a.nameEn || a.id,
      label: a.nameAr || a.nameEn || a.id,
      subtitle: a.code || undefined,
    }));
  }, [airlinesList]);

  const customerOptions: ComboboxOption[] = useMemo(() => {
    return customers.map((c) => ({
      value: c.nameAr || c.name || c.id,
      label: c.nameAr || c.name || c.id,
      subtitle: c.code || undefined,
    }));
  }, [customers]);

  const supplierOptions: ComboboxOption[] = useMemo(() => {
    return suppliers.map((s) => ({
      value: s.accountId || s.account?.id || s.id,
      label: s.nameAr || s.name || s.id,
      subtitle: s.code || undefined,
    }));
  }, [suppliers]);

  const employeeOptions: ComboboxOption[] = useMemo(() => {
    return employees.map((e) => {
      const label = e.fullName || e.username || (e as any).name || '';
      return {
        value: label,
        label: label,
        subtitle: e.jobTitle || e.departmentName || undefined,
      };
    });
  }, [employees]);

  if (!opened) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#F7F8FA] flex flex-col h-screen w-screen overflow-hidden font-sans select-none"
      dir={direction}
      style={{ fontFamily: language === 'ar' ? "'IBM Plex Sans Arabic', system-ui, sans-serif" : "'IBM Plex Sans', system-ui, sans-serif" }}
    >
      {/* ── 1. Top Command Bar ── */}
      <header className="min-h-[56px] sm:h-[60px] bg-white border-b border-[#E5E7EB] px-4 sm:px-6 flex items-center justify-between shrink-0 shadow-2xs z-20 font-sans">
        
        {/* Leading Side: Close, Icon, Title, Badge */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          <Tooltip label={isAr ? 'إغلاق ومغادرة' : 'Close Workspace'} position="bottom" withArrow>
            <button
              type="button"
              onClick={onClose}
              className="w-8.5 h-8.5 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            >
              {direction === 'rtl' ? <ArrowRight size={18} /> : <ArrowLeft size={18} />}
            </button>
          </Tooltip>

          <div className="w-8.5 h-8.5 rounded-lg bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center font-bold shrink-0">
            <Layers size={18} strokeWidth={2.2} />
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-bold text-[15px] sm:text-[18px] text-[#111827] leading-tight truncate">
              {isAr ? 'فاتورة كروب فير (حجز جماعي PNRs)' : 'Group Fare Ticket Invoice'}
            </h2>
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono font-bold text-[11px] sm:text-xs border border-slate-200 shrink-0 select-all" dir="ltr">
              {invoiceNumber || 'GRP-NEW'}
            </span>
          </div>
        </div>

        {/* Trailing Side: 3-Dots Action Menu */}
        <div className="flex items-center gap-2 shrink-0">
          <Menu position="bottom-end" shadow="sm" radius="md">
            <Menu.Target>
              <ActionIcon variant="default" size="md" radius="md" className="border-slate-200 text-slate-600 h-8.5 w-8.5 cursor-pointer hover:bg-slate-50">
                <MoreVertical size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown className="p-1 text-xs font-medium" dir={direction}>
              <Menu.Item
                leftSection={<History size={14} className="text-blue-600" />}
                onClick={() => setAuditLogOpen(true)}
              >
                {isAr ? 'سجل التدقيق والتعديلات' : 'Audit Trail History'}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>

      </header>

      {/* ── 2. Scrollable Body ── */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden p-3.5 sm:p-5 md:p-6 max-w-[1760px] mx-auto w-full pb-28 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
          
          {/* Main Content Area */}
          <div className="space-y-4 min-w-0">

            {/* ── Top Header Strip: Currency Switcher ── */}
            <div className="flex items-center justify-between bg-white rounded-2xl border border-[#E5E7EB] p-3 px-4 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <Coins size={16} className="text-[#F45A0A]" />
                <span>{isAr ? 'عملة الفاتورة وسعر الصرف:' : 'Invoice Currency:'}</span>
              </div>
              <CurrencySegmentedControl
                value={currency}
                onChange={(val) => setCurrency(val as 'IQD' | 'USD')}
              />
            </div>

            {/* ── TWO SEPARATE CARDS: Customer Details (Left) + Supplier & Flight Details (Right) ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch font-sans">
              
              {/* ── CARD 1: CUSTOMER DETAILS (معلومات العميل) ── */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-5 shadow-2xs flex flex-col justify-between h-full">
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-sky-50 text-sky-700 border border-sky-200 flex items-center justify-center shrink-0">
                        <User size={16} />
                      </div>
                      <div>
                        <h4 className="text-[15px] font-bold text-[#111827] leading-tight">
                          {isAr ? 'معلومات العميل' : 'Customer Details'}
                        </h4>
                        <p className="text-[11px] text-[#6B7280]">
                          {isAr ? 'العميل ونوع البيع وطريقة الاستلام والصندوق' : 'Customer, payment term, receiving method & box'}
                        </p>
                      </div>
                    </div>

                    {paymentType === 'آجل' && (
                      <span className="text-[10px] font-bold text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full shrink-0">
                        {isAr ? 'بيع آجل' : 'Credit'}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Customer Combobox */}
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <label className="text-[12px] font-bold text-slate-700">
                          {isAr ? 'العميل *' : 'Customer *'}
                        </label>
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
                      </div>
                      <SearchableCombobox
                        value={customerName}
                        onChange={(val) => setCustomerName(val || '')}
                        options={customerOptions}
                        placeholder={isAr ? 'اختر العميل...' : 'Select customer...'}
                        allowCustomValue
                      />
                    </div>

                    {/* Payment Term / Sale Type */}
                    <div>
                      <label className="text-[12px] font-bold text-slate-700 block mb-1">
                        {isAr ? 'نوع البيع' : 'Sale Type'}
                      </label>
                      <SearchableCombobox
                        value={paymentType}
                        onChange={(val) => {
                          setPaymentType(val || 'نقدي');
                        }}
                        options={[
                          { value: 'نقدي', label: isAr ? 'نقدي (تحصيل فوري)' : 'Cash (Immediate)' },
                          { value: 'آجل', label: isAr ? 'آجل (ذمة العميل)' : 'Credit (On Account)' },
                        ]}
                        clearable={false}
                      />
                    </div>

                    {/* Cash Details: Receiving Method & Cashbox */}
                    {paymentType === 'نقدي' && (
                      <>
                        <div>
                          <label className="text-[12px] font-bold text-slate-700 block mb-1">
                            {isAr ? 'طريقة الاستلام *' : 'Receiving Method *'}
                          </label>
                          <SearchableCombobox
                            value={paymentMethod}
                            onChange={(val) => {
                              const nextMethod = val || 'CASH_HAND';
                              setPaymentMethod(nextMethod);
                              if (employeeName) {
                                applyEmployeeCashbox(employeeName, availableCashboxes);
                              }
                            }}
                            options={paymentMethodsList}
                            clearable={false}
                          />
                        </div>

                        <div>
                          <label className="text-[12px] font-bold text-slate-700 block mb-1">
                            {isAr ? 'صندوق استلام قيمة البيع *' : 'Receiving Cashbox *'}
                          </label>
                          <SearchableCombobox
                            value={receivingCashbox}
                            onChange={(val) => setReceivingCashbox(val || '')}
                            options={formattedCashboxesData}
                            placeholder={isAr ? 'اختر صندوق التحصيل...' : 'Select cashbox...'}
                          />
                          {autoMatchedCashboxName && (
                            <p className="mt-1 text-[11px] text-emerald-700 font-medium">
                              {isAr ? `تلقائي من صندوق الموظف: ${autoMatchedCashboxName}` : `Auto from employee box: ${autoMatchedCashboxName}`}
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Bottom Helper Bar in Customer Card to balance card height */}
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="font-semibold">
                    {paymentType === 'نقدي'
                      ? (isAr ? '✓ تحصيل فوري وقيد يومية للصندوق' : '✓ Immediate cash receipt posted to cashbox')
                      : (isAr ? '✓ قيد محاسبي مباشر على حساب ذمة العميل' : '✓ Directly billed to customer account receivable')}
                  </span>
                  <span className="text-[10.5px] font-mono text-slate-400">
                    {customerName ? (isAr ? 'العميل محدد' : 'Customer set') : (isAr ? 'بانتظار التحديد' : 'Pending')}
                  </span>
                </div>
              </div>

              {/* ── CARD 2: SUPPLIER & FLIGHT DETAILS (معلومات المورد والطيران) ── */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-5 shadow-2xs flex flex-col justify-between h-full space-y-3.5">
                <div>
                  <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 mb-3.5">
                    <div className="w-8 h-8 rounded-full bg-violet-50 text-violet-700 border border-violet-200 flex items-center justify-center shrink-0">
                      <Building2 size={16} />
                    </div>
                    <div>
                      <h4 className="text-[15px] font-bold text-[#111827] leading-tight">
                        {isAr ? 'معلومات المورد والطيران والرحلة' : 'Supplier & Flight Details'}
                      </h4>
                      <p className="text-[11px] text-[#6B7280]">
                        {isAr ? 'المورد والخطوط ومسار الكروب وموظف الإصدار' : 'Supplier, airline, route, staff & dates'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Supplier */}
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <label className="text-[12px] font-bold text-slate-700">
                          {isAr ? 'المورد / جهة الإصدار' : 'Supplier Account'}
                        </label>
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
                      </div>
                      <SearchableCombobox
                        value={supplierAccount}
                        onChange={(val) => {
                          setSupplierAccount(val || '');
                          const opt = supplierOptions.find((o: any) => o.value === val);
                          if (opt) setSupplierAccountName(opt.label);
                        }}
                        options={supplierOptions}
                        /* حسابٌ خارج قائمة الموردين يُعرض باسمه المحفوظ بدل معرّفٍ لا يُقرأ. */
                        displayValue={supplierAccountName}
                        placeholder={isAr ? 'اختر المورد...' : 'Select supplier...'}
                      />
                    </div>

                    {/* Airline */}
                    <div>
                      <label className="text-[12px] font-bold text-slate-700 block mb-1">
                        {isAr ? 'شركة الطيران' : 'Airline'}
                      </label>
                      <SearchableCombobox
                        value={airline}
                        onChange={(val) => setAirline(val || '')}
                        options={airlineOptions}
                        placeholder={isAr ? 'اختر شركة الطيران...' : 'Select airline...'}
                      />
                    </div>

                    {/* Issuing Employee */}
                    <div>
                      <label className="text-[12px] font-bold text-slate-700 block mb-1">
                        {isAr ? 'موظف الإصدار *' : 'Issuing Employee *'}
                      </label>
                      <SearchableCombobox
                        value={employeeName}
                        onChange={(val) => {
                          const nextEmp = val || '';
                          setEmployeeName(nextEmp);
                          if (nextEmp) {
                            applyEmployeeCashbox(nextEmp, availableCashboxes);
                          }
                        }}
                        options={employeeOptions}
                        placeholder={isAr ? 'اختر الموظف...' : 'Select employee...'}
                      />
                    </div>

                    {/* General Route */}
                    <div>
                      <label className="text-[12px] font-bold text-slate-700 block mb-1">
                        {isAr ? 'مسار الرحلة العام' : 'General Flight Route'}
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        placeholder="e.g. BGW-IST-BGW"
                        value={generalRoute}
                        onChange={(e) => setGeneralRoute(e.target.value.toUpperCase())}
                        style={{ fontFamily: "'JetBrains Mono', 'Consolas', 'Roboto', monospace" }}
                        className="w-full h-[46px] px-3.5 rounded-[11px] bg-[#FAFAFA] border border-[#E5E7EB] text-[13px] font-mono font-bold text-slate-900 uppercase outline-none hover:border-slate-300 focus:border-2 focus:border-[#F45A0A] transition-colors"
                      />
                    </div>

                    {/* Issue Date */}
                    <div>
                      <label className="text-[12px] font-bold text-slate-700 block mb-1">
                        {isAr ? 'تاريخ الإصدار' : 'Issue Date'}
                      </label>
                      <SegmentedDatePicker
                        value={issueDate}
                        onChange={(d) => d && setIssueDate(d)}
                      />
                    </div>

                    {/* Travel Date */}
                    <div>
                      <label className="text-[12px] font-bold text-slate-700 block mb-1">
                        {isAr ? 'تاريخ السفر' : 'Travel Date'}
                      </label>
                      <SegmentedDatePicker
                        value={travelDate}
                        onChange={(d) => setTravelDate(d)}
                        placeholder={isAr ? 'اختياري...' : 'Optional...'}
                      />
                    </div>

                  </div>
                </div>
              </div>

            </div>

            {/* ── B. Multi-PNR Management Table ── */}
            <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden shadow-2xs font-sans">
              
              {/* Header & Bulk Controls */}
              <div className="p-3.5 bg-[#F8FAFC] border-b border-[#E5E7EB] space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center font-bold shrink-0">
                      <Users size={16} />
                    </div>
                    <div>
                      <h3 className="font-bold text-[14px] text-[#111827]">
                        {isAr ? 'قائمة سجلات الـ PNR وأسعار الكروب' : 'Group PNR List & Pricing'}
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        {isAr ? 'أدخل قائمة الـ PNRs والعدد وسيتم احتساب إجمالي المسافرين والأرباح تلقائياً.' : 'Enter PNRs and counts. Total pax and profit auto-computed.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Bulk Paste Modal Button */}
                    <button
                      type="button"
                      onClick={() => setPasteModalOpen(true)}
                      className="h-[34px] px-3.5 rounded-lg bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    >
                      <ClipboardPaste size={14} className="text-emerald-700" />
                      <span>{isAr ? 'لصق سريع للـ PNRs' : 'Paste PNRs'}</span>
                    </button>

                    {/* Add Single PNR */}
                    <button
                      type="button"
                      onClick={handleAddPnrRow}
                      className="h-[34px] px-3.5 rounded-lg bg-[#FFF3E8] border border-[#FED7AA] hover:bg-orange-100 text-[#F45A0A] font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    >
                      <Plus size={14} strokeWidth={2.4} />
                      <span>{isAr ? 'إضافة PNR' : 'Add PNR'}</span>
                    </button>
                  </div>
                </div>

                {/* Quick Bulk Applicator Bar */}
                <div className="flex items-center gap-2 flex-wrap bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700 px-1">
                    <Sparkles size={14} className="text-[#F45A0A]" />
                    <span>{isAr ? `تطبيق موحد (${activeLines.length}):` : `Bulk Apply:`}</span>
                  </div>

                  {/* Pax Count */}
                  <input
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    placeholder={isAr ? 'العدد' : 'Pax'}
                    value={bulkPaxCount}
                    onChange={(e) => setBulkPaxCount(e.target.value.replace(/[^0-9]/g, ''))}
                    style={{ fontFamily: "'JetBrains Mono', 'Consolas', 'Roboto', monospace" }}
                    className="w-20 h-[30px] px-2 text-center bg-[#FAFAFA] border border-slate-200 rounded-md font-mono font-bold text-xs text-slate-800 outline-none"
                  />

                  {/* Buy Price */}
                  <input
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    placeholder={isAr ? 'سعر الشراء' : 'Buy'}
                    value={bulkBuyPrice}
                    onChange={(e) => setBulkBuyPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                    style={{ fontFamily: "'JetBrains Mono', 'Consolas', 'Roboto', monospace" }}
                    className="w-28 h-[30px] px-2 text-center bg-[#FAFAFA] border border-slate-200 rounded-md font-mono font-bold text-xs text-slate-800 outline-none"
                  />

                  {/* Sell Price */}
                  <input
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    placeholder={isAr ? 'سعر البيع' : 'Sell'}
                    value={bulkSellPrice}
                    onChange={(e) => setBulkSellPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                    style={{ fontFamily: "'JetBrains Mono', 'Consolas', 'Roboto', monospace" }}
                    className="w-28 h-[30px] px-2 text-center bg-[#FAFAFA] border border-slate-200 rounded-md font-mono font-bold text-xs text-slate-800 outline-none"
                  />

                  <button
                    type="button"
                    onClick={handleApplyBulk}
                    className="h-[30px] px-3.5 rounded-md bg-slate-800 hover:bg-black text-white font-bold text-xs transition-colors cursor-pointer shadow-2xs"
                  >
                    {isAr ? 'تطبيق' : 'Apply'}
                  </button>
                </div>
              </div>

              {/* Table Canvas with Max 10 Rows scrollable container */}
              <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
                <table className={`w-full text-${direction === 'rtl' ? 'right' : 'left'} border-collapse text-xs`}>
                  <thead className="sticky top-0 z-10 bg-[#F8FAFC] shadow-2xs">
                    <tr className="border-b border-[#E5E7EB] text-[#475569] font-bold select-none h-[40px]">
                      <th className="p-2.5 text-center w-10">
                        <Checkbox
                          checked={pnrLines.length > 0 && pnrLines.every((l) => l.selected)}
                          indeterminate={pnrLines.some((l) => l.selected) && !pnrLines.every((l) => l.selected)}
                          onChange={(e) => {
                            const val = e.currentTarget.checked;
                            setPnrLines((prev) => prev.map((l) => ({ ...l, selected: val })));
                          }}
                          color="orange"
                          size="xs"
                        />
                      </th>
                      <th className="p-2.5 whitespace-nowrap">{isAr ? 'كود الـ PNR' : 'PNR Code'}</th>
                      <th className="p-2.5 whitespace-nowrap text-center">{isAr ? 'عدد المسافرين' : 'Pax Count'}</th>
                      <th className="p-2.5 whitespace-nowrap text-left">{isAr ? 'سعر الشراء' : 'Buy Price'}</th>
                      <th className="p-2.5 whitespace-nowrap text-left">{isAr ? 'سعر البيع' : 'Sell Price'}</th>
                      <th className="p-2.5 whitespace-nowrap text-left">{isAr ? 'إجمالي الشراء' : 'Total Buy'}</th>
                      <th className="p-2.5 whitespace-nowrap text-left text-[#F45A0A]">{isAr ? 'إجمالي البيع' : 'Total Sell'}</th>
                      <th className="p-2.5 whitespace-nowrap text-left text-emerald-700">{isAr ? 'الربح' : 'Profit'}</th>
                      <th className="p-2.5 text-center w-10">{isAr ? 'حذف' : 'Del'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {pnrLines.map((l) => {
                      const count = Math.max(1, Number(l.paxCount) || 1);
                      const lineBuyTotal = count * (Number(l.buyPrice) || 0);
                      const lineSellTotal = count * (Number(l.sellPrice) || 0);
                      const lineProfit = lineSellTotal - lineBuyTotal;

                      return (
                        <tr
                          key={l.id}
                          className={`transition-colors ${
                            l.selected ? 'bg-white hover:bg-orange-50/25' : 'bg-slate-50/60 opacity-60'
                          }`}
                        >
                          {/* Selection Checkbox */}
                          <td className="p-2.5 text-center">
                            <Checkbox
                              checked={l.selected}
                              onChange={(e) => updatePnrField(l.id, 'selected', e.currentTarget.checked)}
                              color="orange"
                              size="xs"
                            />
                          </td>

                          {/* PNR Code */}
                          <td className="p-2.5">
                            <input
                              type="text"
                              dir="ltr"
                              placeholder="e.g. HWG83L"
                              value={l.pnr}
                              onChange={(e) => updatePnrField(l.id, 'pnr', e.target.value.toUpperCase().trim())}
                              style={{ fontFamily: "'JetBrains Mono', 'Consolas', 'Roboto', monospace" }}
                              className="h-[36px] px-3 text-center font-mono font-bold text-xs uppercase rounded-[8px] bg-[#FAFAFA] border border-[#E5E7EB] text-slate-900 outline-none hover:border-slate-300 focus:border-2 focus:border-[#F45A0A] w-36"
                            />
                          </td>

                          {/* Pax Count */}
                          <td className="p-2.5 text-center">
                            <input
                              type="text"
                              inputMode="numeric"
                              dir="ltr"
                              value={l.paxCount ? l.paxCount.toLocaleString('en-US') : '1'}
                              onChange={(e) => updatePnrField(l.id, 'paxCount', Math.max(1, parseCleanNumber(e.target.value)))}
                              style={{ fontFamily: "'JetBrains Mono', 'Consolas', 'Roboto', monospace" }}
                              className="w-20 h-[36px] px-1 text-center font-mono font-black text-xs text-[#F45A0A] rounded-[8px] bg-[#FFF3E8] border border-orange-200 outline-none focus:border-2 focus:border-[#F45A0A]"
                            />
                          </td>

                          {/* Buy Price */}
                          <td className="p-2.5 text-left">
                            <input
                              type="text"
                              inputMode="numeric"
                              dir="ltr"
                              placeholder="0"
                              value={l.buyPrice ? l.buyPrice.toLocaleString('en-US') : ''}
                              onChange={(e) => updatePnrField(l.id, 'buyPrice', parseCleanNumber(e.target.value))}
                              style={{ fontFamily: "'JetBrains Mono', 'Consolas', 'Roboto', monospace" }}
                              className="w-24 h-[36px] px-2 font-mono font-bold text-xs text-left rounded-[8px] bg-white border border-slate-200 text-slate-800 outline-none hover:border-slate-400 focus:border-2 focus:border-[#F45A0A]"
                            />
                          </td>

                          {/* Sell Price */}
                          <td className="p-2.5 text-left">
                            <input
                              type="text"
                              inputMode="numeric"
                              dir="ltr"
                              placeholder="0"
                              value={l.sellPrice ? l.sellPrice.toLocaleString('en-US') : ''}
                              onChange={(e) => updatePnrField(l.id, 'sellPrice', parseCleanNumber(e.target.value))}
                              style={{ fontFamily: "'JetBrains Mono', 'Consolas', 'Roboto', monospace" }}
                              className="w-24 h-[36px] px-2 font-mono font-bold text-xs text-left rounded-[8px] bg-white border border-slate-200 text-slate-800 outline-none hover:border-slate-400 focus:border-2 focus:border-[#F45A0A]"
                            />
                          </td>

                          {/* Line Total Buy */}
                          <td className="p-2.5 text-left font-mono font-bold text-slate-700 text-xs tabular-nums" dir="ltr">
                            {formatNumberEnglish(lineBuyTotal)}
                          </td>

                          {/* Line Total Sell */}
                          <td className="p-2.5 text-left font-mono font-black text-[#F45A0A] text-[13px] tabular-nums" dir="ltr">
                            {formatNumberEnglish(lineSellTotal)}
                          </td>

                          {/* Line Profit */}
                          <td className="p-2.5 text-left font-mono font-bold text-[#078B61] text-xs tabular-nums" dir="ltr">
                            {lineProfit > 0 ? `+${formatNumberEnglish(lineProfit)}` : formatNumberEnglish(lineProfit)}
                          </td>

                          {/* Delete */}
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemovePnrRow(l.id)}
                              className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center mx-auto transition-colors cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer Count Summary */}
              <div className="p-3 bg-[#F8FAFC] border-t border-[#E5E7EB] flex items-center justify-between flex-wrap gap-2 text-xs font-bold text-slate-700">
                <div className="flex items-center gap-3">
                  <span className="text-[#F45A0A]">
                    {isAr ? `إجمالي عدد المسافرين: ${totalCalculatedPax} مسافر` : `Total Passengers: ${totalCalculatedPax} pax`}
                  </span>
                  <span className="text-slate-400">|</span>
                  <span>
                    {isAr ? `إجمالي سجلات PNR: ${activeLines.length} من أصل ${pnrLines.length}` : `PNRs: ${activeLines.length} of ${pnrLines.length}`}
                  </span>
                </div>
              </div>
            </div>

            {/* ── C. Remarks & Notes Card ── */}
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-5 space-y-3 shadow-2xs font-sans">
              <label className="text-[12px] font-bold text-[#334155] block">
                {isAr ? 'ملاحظات وتفاصيل الكروب' : 'Group Booking Notes & Remarks'}
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={isAr ? 'تفاصيل الفوج، اسم المرشد، أرقام التواصل، شروط الحجز...' : 'Tour leader, group terms, instructions...'}
                className="w-full p-2.5 rounded-[8px] bg-[#FAFAFA] border border-[#E5E7EB] text-xs font-medium text-[#111827] outline-none hover:border-[#D1D5DB] focus:border-2 focus:border-[#F45A0A] transition-colors"
              />

              <div className="p-2.5 rounded-[8px] bg-[#F8FAFC] border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2">
                <ShieldCheck size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  {isAr
                    ? 'سيقوم النظام بتوليد قيد اليومية المزدوج، وتحديث أرصدة العملاء والموردين تلقائياً لجميع الـ PNRs.'
                    : 'Double-entry journal entries will be posted, updating customer and supplier ledger accounts instantly.'}
                </p>
              </div>
            </div>

          </div>

          {/* ── STICKY SIDEBAR (360px) ── */}
          <div className="xl:sticky xl:top-0 space-y-4 font-sans">
            <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-4 sm:p-5 space-y-4">
              
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center font-bold shrink-0">
                    <TrendingUp size={16} strokeWidth={2} />
                  </div>
                  <div>
                    <h4 className="font-bold text-[15px] text-[#111827] leading-tight">
                      {isAr ? 'الملخص المالي للكروب' : 'Group Financial Summary'}
                    </h4>
                    <span className="text-[11px] text-[#6B7280]">
                      {isAr ? 'المبيعات والتكلفة والأرباح' : 'Sales, cost & profit breakdown'}
                    </span>
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono font-bold text-[11px]">
                  {currency}
                </span>
              </div>

              {/* KPI Breakdown List */}
              <div className="space-y-2.5">
                {/* 1. Total Calculated Passengers */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-orange-50/60 border border-orange-100">
                  <span className="text-[12px] font-bold text-orange-950">
                    {isAr ? 'إجمالي عدد المسافرين' : 'Total Passengers'}
                  </span>
                  <span className="font-mono font-black text-[#F45A0A] text-sm tabular-nums" dir="ltr">
                    {formatNumberEnglish(totalCalculatedPax)} <span className="text-[10px] font-sans font-semibold">{isAr ? 'مسافر' : 'pax'}</span>
                  </span>
                </div>

                {/* 2. Total Buy Cost */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[12px] font-semibold text-slate-700">
                    {isAr ? 'تكلفة الشراء (المورد)' : 'Total Buy Cost'}
                  </span>
                  <span className="font-mono font-bold text-slate-900 text-sm tabular-nums" dir="ltr">
                    {formatNumberEnglish(totalBuy)} <span className="text-[10px] text-slate-400 font-sans">{currency}</span>
                  </span>
                </div>

                {/* 3. Realized Profit */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[12px] font-bold text-emerald-900">
                    {isAr ? 'صافي أرباح الكروب (+)' : 'Realized Profit (+)'}
                  </span>
                  <span className="font-mono font-black text-emerald-700 text-sm tabular-nums" dir="ltr">
                    {totalProfit > 0 ? `+${formatNumberEnglish(totalProfit)}` : formatNumberEnglish(totalProfit)} <span className="text-[10px] text-emerald-600 font-sans">{currency}</span>
                  </span>
                </div>

                {/* Divider */}
                <div className="border-t border-dashed border-slate-200 my-1" />

                {/* 4. Total Sell / Net Required from Customer (Hero Card) */}
                <div className="p-3.5 rounded-xl bg-[#FFF3E8] border border-[#FFD8B2] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#F45A0A]">
                      {isAr ? 'إجمالي المبيعات (المستحق)' : 'Total Sales (Due)'}
                    </span>
                    <span className="text-[10.5px] font-mono text-orange-600 font-bold">
                      ({activeLines.length} PNRs)
                    </span>
                  </div>
                  <div className="text-2xl font-black font-mono text-[#F45A0A] tabular-nums" dir="ltr">
                    {formatNumberEnglish(totalSell)} <span className="text-xs font-sans font-bold text-[#F45A0A]">{currency}</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {isAr
                      ? `التكلفة (${formatNumberEnglish(totalBuy)}) + الأرباح (${formatNumberEnglish(totalProfit)})`
                      : `Cost (${formatNumberEnglish(totalBuy)}) + Profit (${formatNumberEnglish(totalProfit)})`}
                  </div>
                </div>
              </div>

              {/* Action Buttons in Sidebar */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSaveGroupFare}
                  className="w-full h-[44px] rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] active:scale-[0.98] text-white font-bold text-[13.5px] shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Check size={18} strokeWidth={2.4} />
                  <span>{isAr ? 'حفظ وترحيل كروب فير' : 'Save & Post Group Fare'}</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full h-[38px] rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                >
                  {isAr ? 'إلغاء ومغادرة' : 'Cancel'}
                </button>
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* ── 3. Bottom Sticky Bar ── */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md text-slate-900 border-t border-slate-200 px-6 py-2.5 z-50 flex items-center justify-between flex-wrap gap-4 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] font-sans text-xs">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[11.5px] font-bold text-slate-500">{isAr ? 'رقم الفاتورة:' : 'Invoice #:'}</span>
            <span className="px-2.5 py-0.5 rounded-lg bg-[#FFF3E8] border border-orange-200 text-[#F45A0A] font-mono font-bold text-xs tracking-wider select-all" dir="ltr">
              {invoiceNumber}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          {/* Quick stats */}
          <div className="hidden lg:flex items-center gap-4 font-mono text-xs" dir="ltr">
            <div>
              <span className="text-slate-400 font-sans">{isAr ? 'المسافرين: ' : 'Pax: '}</span>
              <span className="font-bold text-[#F45A0A]">{formatNumberEnglish(totalCalculatedPax)}</span>
            </div>
            <div>
              <span className="text-slate-400 font-sans">{isAr ? 'التكلفة: ' : 'Cost: '}</span>
              <span className="font-bold text-slate-800">{formatNumberEnglish(totalBuy)}</span>
            </div>
            <div>
              <span className="text-slate-400 font-sans">{isAr ? 'المبيعات: ' : 'Sales: '}</span>
              <span className="font-bold text-slate-800">{formatNumberEnglish(totalSell)}</span>
            </div>
            <div>
              <span className="text-slate-400 font-sans">{isAr ? 'الأرباح: ' : 'Profit: '}</span>
              <span className="font-bold text-emerald-700">{totalProfit > 0 ? `+${formatNumberEnglish(totalProfit)}` : formatNumberEnglish(totalProfit)}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-orange-50 border border-orange-200">
            <span className="text-[#F45A0A] font-bold font-sans text-xs">{isAr ? 'الإجمالي: ' : 'Total: '}</span>
            <span className="font-black font-mono text-sm text-[#F45A0A]" dir="ltr">
              {formatNumberEnglish(totalSell)} <span className="text-[11px] font-sans font-bold">{currency}</span>
            </span>
          </div>
        </div>

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
            onClick={handleSaveGroupFare}
            className="h-[38px] px-5 rounded-xl bg-[#F45A0A] hover:bg-orange-600 active:scale-[0.98] text-white font-black text-xs shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <Check size={16} strokeWidth={2.4} />
            <span>{isAr ? 'حفظ وترحيل كروب فير' : 'Save & Post Group Fare'}</span>
          </button>
        </div>
      </footer>

      {/* ── 4. Bulk PNR Paste Modal ── */}
      <Modal
        opened={pasteModalOpen}
        onClose={() => setPasteModalOpen(false)}
        title={
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <ClipboardPaste size={18} className="text-[#F45A0A]" />
            <span>{isAr ? 'لصق ذكي — يقرأ نصّ الكروب ويستخرج بياناته' : 'Smart paste — reads the group text'}</span>
          </div>
        }
        size="lg"
        centered
        radius="lg"
      >
        <div className="space-y-4 text-xs font-sans" dir={direction}>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <span className="font-bold text-slate-800 block">
              {isAr ? 'إعدادات افتراضية للـ PNRs المُلصقة:' : 'Default values for pasted PNRs:'}
            </span>
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="text-[11px] text-slate-600 block mb-0.5">{isAr ? 'عدد المسافرين' : 'Pax/PNR'}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  placeholder="1"
                  value={pasteDefaultPax}
                  onChange={(e) => setPasteDefaultPax(Math.max(1, parseCleanNumber(e.target.value)))}
                  className="w-full h-8 px-2 rounded-md border border-slate-200 text-xs font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-600 block mb-0.5">{isAr ? 'سعر الشراء' : 'Buy'}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  placeholder="0"
                  value={pasteDefaultBuy}
                  onChange={(e) => setPasteDefaultBuy(e.target.value)}
                  className="w-full h-8 px-2 rounded-md border border-slate-200 text-xs font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-600 block mb-0.5">{isAr ? 'سعر البيع' : 'Sell'}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  placeholder="0"
                  value={pasteDefaultSell}
                  onChange={(e) => setPasteDefaultSell(e.target.value)}
                  className="w-full h-8 px-2 rounded-md border border-slate-200 text-xs font-mono font-bold"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              {isAr ? 'الصق قائمة الـ PNRs هنا (سطر تلو الآخر، أو منسخ من إكسل):' : 'Paste PNRs list here (line by line or from Excel):'}
            </label>
            <textarea
              rows={8}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder={"HWG83L\n92JKLS\nAB12CD\n..."}
              style={{ fontFamily: "'JetBrains Mono', 'Consolas', 'Roboto', monospace" }}
              className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 outline-none focus:border-2 focus:border-[#F45A0A]"
            />
          </div>

          {/*
            * ما فُهم يُعرض قبل أن يُطبَّق.
            *
            * النص الملصوق يأتي بصياغات الموردين لا بصيغة واحدة، فقد يُقرأ حقلٌ
            * خطأً. وعرضُ ما فُهم — ومعه سعر المقعد محسوباً — يجعل الخطأ مرئياً
            * قبل أن يدخل الفاتورة، لا بعدها.
            */}
          {pastedUnderstanding.found.length > 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11.5px] font-black text-emerald-900">
                <Sparkles size={13} className="text-emerald-700" />
                <span>{isAr ? 'ما فهمه النظام من النص:' : 'Understood from the text:'}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {pastedUnderstanding.found.map((f, i) => (
                  <span
                    key={i}
                    className="text-[11px] font-bold bg-white border border-emerald-200 text-emerald-900 rounded-lg px-2 py-0.5"
                  >
                    {f}
                  </span>
                ))}
              </div>
              {(() => {
                const u = pastedUnderstanding;
                if (!u.seats || (!u.buy && !u.sell)) return null;
                const each = (p?: { amount: number; isTotal: boolean }) =>
                  !p ? null : p.isTotal ? Math.round((p.amount / u.seats!) * 100) / 100 : p.amount;
                const b = each(u.buy);
                const s = each(u.sell);
                return (
                  <div className="text-[11px] font-bold text-slate-700 bg-white border border-emerald-200 rounded-lg px-2 py-1" dir="rtl">
                    {isAr ? 'للمقعد الواحد: ' : 'Per seat: '}
                    {b !== null && (
                      <span className="font-mono" dir="ltr">
                        {isAr ? 'شراء ' : 'buy '}{b.toLocaleString('en-US')} {u.buy!.currency}
                      </span>
                    )}
                    {b !== null && s !== null && <span className="text-slate-400"> · </span>}
                    {s !== null && (
                      <span className="font-mono" dir="ltr">
                        {isAr ? 'بيع ' : 'sell '}{s.toLocaleString('en-US')} {u.sell!.currency}
                      </span>
                    )}
                    {u.buy && u.sell && u.buy.currency !== u.sell.currency && (
                      <span className="block mt-0.5 text-amber-700 font-bold">
                        {isAr
                          ? '⚠ الشراء والبيع بعملتين مختلفتين — راجع سعر الشراء بعد التطبيق'
                          : '⚠ Buy and sell are in different currencies — review the buy price'}
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-slate-100">
            <span className="text-[11.5px] font-bold text-slate-500">
              {pastedUnderstanding.found.length > 0
                ? isAr
                  ? `فُهم ${pastedUnderstanding.found.length} حقلاً`
                  : `${pastedUnderstanding.found.length} field(s) understood`
                : isAr
                ? `الأسطر: ${pastedText.split(/\r?\n/).filter((l) => l.trim()).length}`
                : `Lines: ${pastedText.split(/\r?\n/).filter((l) => l.trim()).length}`}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPasteModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>

              {/* حين يُفهم النص يكون التطبيق هو الإجراء الأول؛ وإلا بقي الاستيراد سطراً سطراً. */}
              {pastedUnderstanding.found.length > 0 ? (
                <>
                  <button
                    type="button"
                    onClick={handleProcessPastedPnrs}
                    className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs cursor-pointer"
                  >
                    {isAr ? 'استيراد كأسطر PNR فقط' : 'Import as PNR lines'}
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyUnderstanding}
                    className="px-4 py-2 rounded-lg bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Sparkles size={13} />
                    {isAr ? 'تطبيق البيانات على الرحلة' : 'Apply to the trip'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleProcessPastedPnrs}
                  className="px-4 py-2 rounded-lg bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  {isAr ? 'إدراج الـ PNRs في الجدول' : 'Import PNRs'}
                </button>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/*
        * البحث المتقدّم في كل الحسابات — نفسه المستعمل في نافذة التذاكر.
        * والمختار يُكتب بمعرّفه واسمه معاً كي لا يبقى الحقل فارغاً حين لا يكون
        * الحساب ضمن قائمة الموردين أصلاً.
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
          } else {
            setCustomerName(account.name);
          }
        }}
      />

      {/* ── 5. Audit Log Modal ── */}
      <InvoiceAuditLogModal
        opened={auditLogOpen}
        onClose={() => setAuditLogOpen(false)}
        ticketNumber={invoiceNumber}
        pnr={activeLines[0]?.pnr || 'GROUP'}
        customerName={customerName || 'Group Fare Customer'}
      />
    </div>
  );
};
