import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Paper,
  Button,
  TextInput,
  Select,
  Badge,
  Modal,
  SegmentedControl,
  Tooltip,
  ActionIcon,
  Textarea,
  Tabs,
  Loader,
  Table,
  Switch,
  Checkbox,
  Group,
  Menu,
  Divider,
} from '@mantine/core';
import {
  IconScale,
  IconPlus,
  IconArrowLeft,
  IconRefresh,
  IconFileText,
  IconCheck,
  IconReceipt,
  IconArrowDownLeft,
  IconArrowUpRight,
  IconArrowsLeftRight,
  IconDeviceFloppy,
  IconFileInvoice,
  IconArrowsExchange,
  IconCoins,
  IconPhone,
  IconUser,
  IconInfoCircle,
  IconFileSpreadsheet,
  IconEdit,
  IconTrash,
  IconLayersLinked,
  IconPrinter,
  IconDownload,
  IconShieldCheck,
  IconX,
  IconEye,
  IconFileExport,
  IconChecklist,
  IconNotes,
  IconFilter,
  IconCalendar,
  IconSearch,
  IconRotate,
} from '@tabler/icons-react';
import { clearingsApi, type ClearingAccountItem, type StatementRow, DEFAULT_RATES } from '../api/clearings';
import { accountsApi } from '../api/accounts';
import { journalEntriesApi } from '../api/journalEntries';
import { showSuccessNotification, showErrorNotification } from '../utils/notifications';
import { FormattedNumberInput } from '../components/common/FormattedNumberInput';
import { AccountingDatePicker } from '../components/common/date/AccountingDatePicker';
import { useAdoptedExchangeRate } from '../hooks/useAdoptedExchangeRate';

export const ClearingAccountProfilePage: React.FC = () => {
  // المسار يسمّي المعامل :id — والصفحة كانت تقرأ accountId فيبقى فارغاً بلا تحميل.
  const { id: accountId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [account, setAccount] = useState<ClearingAccountItem | null>(null);
  const [statementRows, setStatementRows] = useState<StatementRow[]>([]);
  const [realCashAccounts, setRealCashAccounts] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit Account Modal State
  const [editAccountModalOpen, setEditAccountModalOpen] = useState(false);
  const [editNameAr, setEditNameAr] = useState('');
  const [editNameEn, setEditNameEn] = useState('');
  const [editContactPerson, setEditContactPerson] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [updatingAccount, setUpdatingAccount] = useState(false);

  // Rates for conversions
  const adoptedEx = useAdoptedExchangeRate();
  const iqdRate = adoptedEx.adoptedRate || DEFAULT_RATES.IQD_PER_USD;
  const tomanRate = DEFAULT_RATES.TOMAN_PER_USD;
  /** حساب العميل لا يتعامل بالتومان إطلاقاً — عملاته الدينار والدولار فقط. */
  const isClientAccount = account?.category === 'CLIENT';

  // Unified Voucher Modal State (Creating & Editing Vouchers in One Unified Modal)
  const [voucherModalOpen, setVoucherModalOpen] = useState(false);
  const [voucherModalMode, setVoucherModalMode] = useState<'CREATE' | 'EDIT'>('CREATE');
  const [editingVoucherEntryId, setEditingVoucherEntryId] = useState<string | null>(null);
  const [voucherMode, setVoucherMode] = useState<'SINGLE' | 'BATCH'>('SINGLE');
  const [voucherType, setVoucherType] = useState<'RECEIPT' | 'PAYMENT' | 'JOURNAL'>('RECEIPT');
  const [voucherCounterAccountId, setVoucherCounterAccountId] = useState<string | null>(null);
  const [voucherBeneficiary, setVoucherBeneficiary] = useState('');
  const [voucherCurrency, setVoucherCurrency] = useState<'USD' | 'IQD' | 'TOMAN'>('TOMAN');
  const [voucherAmount, setVoucherAmount] = useState<number>(0);
  const [voucherCustomRate, setVoucherCustomRate] = useState<number>(0);
  const [voucherDate, setVoucherDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [voucherNotes, setVoucherNotes] = useState('');
  const [submittingVoucher, setSubmittingVoucher] = useState(false);

  // Batch Transactions State (إضافة معاملات متعددة)
  const [batchRows, setBatchRows] = useState<Array<{
    id: string;
    voucherType: 'RECEIPT' | 'PAYMENT' | 'JOURNAL';
    counterAccountId: string;
    currency: 'USD' | 'IQD' | 'TOMAN';
    amount: number;
    customRate: number;
    beneficiary: string;
    notes: string;
  }>>([
    { id: '1', voucherType: 'RECEIPT', counterAccountId: '', currency: 'TOMAN', amount: 0, customRate: 0, beneficiary: '', notes: '' },
    { id: '2', voucherType: 'RECEIPT', counterAccountId: '', currency: 'TOMAN', amount: 0, customRate: 0, beneficiary: '', notes: '' },
  ]);

  // Currency Exchange Modal State
  const [exchangeModalOpen, setExchangeModalOpen] = useState(false);
  const [fromCurrency, setFromCurrency] = useState<'USD' | 'IQD' | 'TOMAN'>('TOMAN');
  const [fromAmount, setFromAmount] = useState<number>(0);
  const [toCurrency, setToCurrency] = useState<'USD' | 'IQD' | 'TOMAN'>('USD');
  const [exchangeCustomRate, setExchangeCustomRate] = useState<number>(92000);
  const [exchangeDate, setExchangeDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [exchangeNotes, setExchangeNotes] = useState('');
  const [submittingExchange, setSubmittingExchange] = useState(false);

  // Advanced Table Filters State (فلترة احترافية بالتاريخ، الملاحظة، المستفيد، النوع، والعملة)
  const [filterSearch, setFilterSearch] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterCurrency, setFilterCurrency] = useState<string>('ALL');
  const [filterAudited, setFilterAudited] = useState<string>('ALL');

  // Row Selection & Audit State (تحديد الأسطر والتدقيق)
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [auditedRowIds, setAuditedRowIds] = useState<Record<string, boolean>>({});

  // Delete Confirm Modal State
  const [deleteConfirmModalOpen, setDeleteConfirmModalOpen] = useState(false);
  const [deletingRows, setDeletingRows] = useState(false);

  // Print Slip Modal State
  const [printModalOpen, setPrintModalOpen] = useState(false);

  // Instant Refresh of Single Account and Statement (Blazing fast < 20ms)
  const refreshAccountAndStatement = useCallback(async () => {
    if (!accountId) return;
    try {
      const [acc, statement] = await Promise.all([
        clearingsApi.getById(accountId, { iqdRate, tomanRate }),
        clearingsApi.getStatement(accountId),
      ]);
      if (acc) {
        setAccount({ ...acc });
      }
      if (statement) setStatementRows(statement);
    } catch (e) {
      console.warn('Error refreshing account statement:', e);
    }
  }, [accountId, iqdRate, tomanRate]);

  // Filtered Statement Rows
  const filteredStatementRows = useMemo(() => {
    return statementRows.filter(r => {
      // 1. Text Search (description, beneficiary, notes, reference)
      if (filterSearch.trim()) {
        const q = filterSearch.trim().toLowerCase();
        const matchDesc = (r.description || '').toLowerCase().includes(q);
        const matchBenef = (r.beneficiary || '').toLowerCase().includes(q);
        const matchNotes = (r.notes || '').toLowerCase().includes(q);
        const matchRef = (r.reference || '').toLowerCase().includes(q);
        if (!matchDesc && !matchBenef && !matchNotes && !matchRef) return false;
      }

      // 2. Date Range Filter
      if (filterStartDate && r.date < filterStartDate) return false;
      if (filterEndDate && r.date > filterEndDate) return false;

      // 3. Currency Filter
      if (filterCurrency !== 'ALL' && r.currency !== filterCurrency) return false;

      // 4. Audit Filter
      const isAud = Boolean(auditedRowIds[r.id] !== undefined ? auditedRowIds[r.id] : r.isAudited);
      if (filterAudited === 'AUDITED' && !isAud) return false;
      if (filterAudited === 'UNAUDITED' && isAud) return false;

      // 5. Type Filter
      if (filterType !== 'ALL') {
        const descLower = (r.description || '').toLowerCase();
        const refUpper = (r.reference || '').toUpperCase();
        if (filterType === 'OPENING' && !refUpper.startsWith('OPEN') && !descLower.includes('افتتاحي')) return false;
        if (filterType === 'RECEIPT' && !refUpper.startsWith('REC') && !descLower.includes('قبض') && !descLower.includes('استلام') && r.credit <= 0) return false;
        if (filterType === 'PAYMENT' && !refUpper.startsWith('PAY') && !descLower.includes('دفع') && !descLower.includes('تسديد') && r.debit <= 0) return false;
        if (filterType === 'EXCHANGE' && !refUpper.startsWith('EXC') && !descLower.includes('صرافة')) return false;
      }

      return true;
    });
  }, [statementRows, filterSearch, filterStartDate, filterEndDate, filterCurrency, filterAudited, filterType, auditedRowIds]);

  // Reset Filters
  const handleResetFilters = () => {
    setFilterSearch('');
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterType('ALL');
    setFilterCurrency('ALL');
    setFilterAudited('ALL');
  };

  // Toggle Row Selection Switch
  const toggleRowSelection = (id: string) => {
    setSelectedRowIds(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  // Toggle All Selection Switch
  const toggleAllSelection = () => {
    if (selectedRowIds.length === filteredStatementRows.length) {
      setSelectedRowIds([]);
    } else {
      setSelectedRowIds(filteredStatementRows.map(r => r.id));
    }
  };

  // Toggle Audit Status for a single row
  const toggleAudit = (rowId: string) => {
    setAuditedRowIds(prev => {
      const newVal = !prev[rowId];
      showSuccessNotification(
        newVal ? 'تم التدقيق ✅' : 'إلغاء التدقيق',
        newVal ? 'تم تعليم الحركة كـ (مدققة ومعتمدة)' : 'تم إرجاع الحركة إلى قيد التدقيق'
      );
      return { ...prev, [rowId]: newVal };
    });
  };

  // Batch Audit Selected Rows
  const handleAuditSelected = () => {
    if (selectedRowIds.length === 0) return;
    const updated = { ...auditedRowIds };
    selectedRowIds.forEach(id => {
      updated[id] = true;
    });
    setAuditedRowIds(updated);
    showSuccessNotification('تم التدقيق بنجاح ✅', `تم اعتماد وتدقيق ${selectedRowIds.length} حركة مالية بنجاح`);
  };

  // Open Edit Modal according to transaction type (Unified Modal: Same as Create)
  const handleOpenEditTransaction = (row: StatementRow) => {
    const descLower = (row.description || '').toLowerCase();
    const refUpper = (row.reference || '').toUpperCase();

    if (refUpper.startsWith('EXC') || descLower.includes('صرافة') || descLower.includes('مبادلة')) {
      // Open exchange modal
      setFromAmount(row.debit > 0 ? row.debit : row.credit);
      setExchangeDate(row.date);
      setExchangeNotes(row.description);
      setExchangeModalOpen(true);
    } else {
      // Open unified voucher modal in EDIT mode
      setVoucherModalMode('EDIT');
      setEditingVoucherEntryId(row.entryId || null);
      setVoucherMode('SINGLE');

      const isPay = refUpper.startsWith('PAY') || descLower.includes('دفع') || descLower.includes('تسديد') || row.debit > 0;
      const isRec = refUpper.startsWith('REC') || descLower.includes('قبض') || descLower.includes('استلام') || row.credit > 0;
      setVoucherType(isPay ? 'PAYMENT' : isRec ? 'RECEIPT' : 'JOURNAL');

      setVoucherCurrency(row.currency || 'USD');
      setVoucherAmount(row.debit > 0 ? row.debit : row.credit);
      setVoucherDate(row.date);
      setVoucherBeneficiary(row.beneficiary || '');
      setVoucherNotes(row.notes || '');
      setVoucherCustomRate(0);

      if (realCashAccounts.length > 0 && !voucherCounterAccountId) {
        const defaultCash =
          realCashAccounts.find(c => c.label.includes('1811') || c.label.includes('الرئيسي') || c.label.includes('صندوق')) ||
          realCashAccounts[0];
        setVoucherCounterAccountId(defaultCash.value);
      }

      setVoucherModalOpen(true);
    }
  };

  // Handle Delete Selected Rows
  const handleDeleteSelected = async () => {
    if (selectedRowIds.length === 0) return;
    setDeletingRows(true);
    try {
      const selectedRows = statementRows.filter(r => selectedRowIds.includes(r.id));
      const entryIdsToDelete = Array.from(new Set(selectedRows.map(r => r.entryId).filter(Boolean)));

      for (const entryId of entryIdsToDelete) {
        await journalEntriesApi.delete(entryId);
      }

      /*
       * مزامنة رصيد التصفية بعد الحذف — العلّة التي جعلت الحذف يبدو بلا أثر.
       *
       * رصيد حساب التصفية يُخزَّن في JSON منفصل (usd/iqd/toman) لا في حقل balance
       * وحده؛ وحذف القيد يعكس حقل balance فقط، فيبقى JSON على قيمته القديمة
       * فتظل بطاقة الرصيد كما هي وكأن الحذف لم يحدث. فنُعيد بناء JSON من الحركات
       * الباقية (المصدر الوحيد للحقيقة) ونحفظه على الحساب.
       */
      if (account) {
        const remaining = await clearingsApi.getStatement(account.id).catch(() => [] as StatementRow[]);
        const totals = { usd: 0, iqd: 0, toman: 0, note: '' };
        remaining.forEach((r) => {
          const nativeSigned = r.debit - r.credit; // رصيد الطرف = مجموع (مدين − دائن)
          if (r.currency === 'USD') totals.usd += nativeSigned;
          else if (r.currency === 'IQD') totals.iqd += Math.round(nativeSigned * iqdRate);
          else if (r.currency === 'TOMAN') totals.toman += Math.round(nativeSigned * tomanRate);
        });
        await accountsApi.update(account.id, { address: JSON.stringify(totals) }).catch(() => {});
      }

      showSuccessNotification(
        'تم الحذف بنجاح',
        `تم حذف ${entryIdsToDelete.length} حركة محاسبية وتحديث الأرصدة تلقائياً`
      );

      setSelectedRowIds([]);
      setDeleteConfirmModalOpen(false);
      await refreshAccountAndStatement();
    } catch (err: any) {
      showErrorNotification('خطأ في الحذف', err.message || 'تعذر حذف الحركات المحددة');
    } finally {
      setDeletingRows(false);
    }
  };

  // Export Selected Rows to CSV
  const handleExportSelected = () => {
    const rowsToExport = statementRows.filter(r => selectedRowIds.includes(r.id));
    if (rowsToExport.length === 0) return;

    const headers = ['التاريخ', 'المرجع', 'نوع السند', 'البيان', 'الجهة المحول لها / المستفيد', 'الملاحظات', 'العملة', 'مدين ($)', 'دائن ($)', 'الرصيد التراكمي ($)', 'حالة التدقيق'];
    const rowsData = rowsToExport.map(r => [
      r.date,
      r.reference || '',
      r.credit > 0 ? 'سند قبض' : 'سند دفع',
      `"${(r.description || '').replace(/"/g, '""')}"`,
      `"${(r.beneficiary || '').replace(/"/g, '""')}"`,
      `"${(r.notes || '').replace(/"/g, '""')}"`,
      r.currency,
      r.debit || 0,
      r.credit || 0,
      r.balance || 0,
      auditedRowIds[r.id] ? 'مدقق' : 'قيد التدقيق',
    ]);

    const csvContent = [headers.join(','), ...rowsData.map(e => e.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `كشف_${account?.nameAr || 'حساب'}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showSuccessNotification('تم التصدير بنجاح', `تم تصدير ${rowsToExport.length} حركة بصيغة ملف CSV`);
  };

  // Print Selected Rows
  const handlePrintSelected = () => {
    if (selectedRowIds.length === 0) {
      showErrorNotification('تنبيه', 'يرجى تحديد حركة واحدة على الأقل للطباعة');
      return;
    }
    setPrintModalOpen(true);
  };

  // Load account data, statement rows, and cashboxes
  const loadAccountData = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      // Parallel fast fetch: Single Account + Single Statement + Cash list
      const [acc, statement, allAccounts] = await Promise.all([
        clearingsApi.getById(accountId, { iqdRate, tomanRate }),
        clearingsApi.getStatement(accountId),
        accountsApi.getFlat('ASSET'),
      ]);

      if (acc) {
        setAccount({ ...acc });
      }
      if (statement) setStatementRows(statement);

      if (allAccounts) {
        let cashList = allAccounts
          .filter(a =>
            !a.isGroup &&
            (a.code.startsWith('18') || a.nameAr.includes('صندوق') || a.nameAr.includes('مصرف') || a.nameAr.includes('بنك') || a.nameAr.includes('ماستر'))
          )
          .map(a => ({
            value: a.id,
            label: a.nameAr,
          }));

        if (cashList.length === 0) {
          cashList = allAccounts
            .filter(a => !a.isGroup && !a.code.startsWith('9'))
            .map(a => ({
              value: a.id,
              label: a.nameAr,
            }));
        }

        setRealCashAccounts(cashList);

        if (cashList.length > 0) {
          const defaultCash =
            cashList.find(c => c.label.includes('1811')) ||
            cashList.find(c => c.label.includes('الصندوق الرئيسي')) ||
            cashList.find(c => c.label.includes('صندوق')) ||
            cashList[0];
          if (defaultCash && !voucherCounterAccountId) {
            setVoucherCounterAccountId(defaultCash.value);
            // Default batch rows to first cashbox
            setBatchRows(prev => prev.map(r => ({ ...r, counterAccountId: r.counterAccountId || defaultCash.value })));
          }
        }
      }
    } catch (err: any) {
      console.error('Error loading clearing account profile:', err);
      showErrorNotification('خطأ في جلب البيانات', 'تعذر تحميل بيانات حساب التصفية');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, iqdRate, tomanRate]);

  useEffect(() => {
    loadAccountData();
  }, [loadAccountData]);

  // Live USD Conversion for Voucher Modal
  const voucherConvertedUSD = useMemo(() => {
    if (!voucherAmount || voucherAmount <= 0) return 0;
    if (voucherCurrency === 'USD') return voucherAmount;
    if (voucherCurrency === 'IQD') {
      const rate = voucherCustomRate > 0 ? voucherCustomRate : iqdRate;
      return voucherAmount / rate;
    }
    if (voucherCurrency === 'TOMAN') {
      const rate = voucherCustomRate > 0 ? voucherCustomRate : tomanRate;
      return voucherAmount / rate;
    }
    return voucherAmount;
  }, [voucherAmount, voucherCurrency, voucherCustomRate, iqdRate, tomanRate]);

  // Total USD for Batch Rows
  const batchTotalUSD = useMemo(() => {
    return batchRows.reduce((sum, r) => {
      if (!r.amount || r.amount <= 0) return sum;
      const rate = r.customRate > 0 ? r.customRate : r.currency === 'TOMAN' ? tomanRate : r.currency === 'IQD' ? iqdRate : 1;
      return sum + clearingsApi.convertToUSD(r.amount, r.currency, rate);
    }, 0);
  }, [batchRows, iqdRate, tomanRate]);

  // Auto-generated professional legal description (بيان محاسبي تلقائي)
  const autoGeneratedDescription = useMemo(() => {
    if (!account || voucherAmount <= 0) return '';
    const counterAcc = realCashAccounts.find(c => c.value === voucherCounterAccountId);

    const currLabel = voucherCurrency === 'USD' ? 'دولار أمريكي' : voucherCurrency === 'IQD' ? 'دينار عراقي' : 'تومان إيراني';
    const formattedAmount = voucherAmount.toLocaleString('en-US');
    const formattedUSD = voucherConvertedUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const rate = voucherCustomRate > 0 ? voucherCustomRate : voucherCurrency === 'TOMAN' ? tomanRate : voucherCurrency === 'IQD' ? iqdRate : 1;
    const dateStr = voucherDate || new Date().toISOString().split('T')[0];
    const beneficiaryPart = voucherBeneficiary.trim() ? ` لصالح / بواسطة: ${voucherBeneficiary.trim()}` : '';
    const counterName = counterAcc?.label?.split(' (')[0] || 'الصندوق';

    if (voucherType === 'RECEIPT') {
      let desc = `استلام مبلغ ${formattedAmount} ${currLabel} من حساب ${account.nameAr}`;
      if (voucherCurrency !== 'USD') desc += ` بسعر صرف ${rate.toLocaleString()} (ما يعادل $${formattedUSD})`;
      desc += ` وإيداعه في ${counterName}`;
      desc += beneficiaryPart;
      desc += ` — بتاريخ ${dateStr}`;
      return desc;
    } else if (voucherType === 'PAYMENT') {
      let desc = `دفع مبلغ ${formattedAmount} ${currLabel} من ${counterName} إلى حساب ${account.nameAr}`;
      if (voucherCurrency !== 'USD') desc += ` بسعر صرف ${rate.toLocaleString()} (ما يعادل $${formattedUSD})`;
      desc += beneficiaryPart;
      desc += ` — بتاريخ ${dateStr}`;
      return desc;
    } else {
      let desc = `قيد تسوية ومقاصة: تحويل ${formattedAmount} ${currLabel} بين حساب ${account.nameAr} و${counterName}`;
      if (voucherCurrency !== 'USD') desc += ` بسعر صرف ${rate.toLocaleString()} (ما يعادل $${formattedUSD})`;
      desc += beneficiaryPart;
      desc += ` — بتاريخ ${dateStr}`;
      return desc;
    }
  }, [voucherType, account, voucherCounterAccountId, voucherAmount, voucherCurrency, voucherCustomRate, voucherConvertedUSD, voucherBeneficiary, voucherDate, realCashAccounts, iqdRate, tomanRate]);

  // Live Calculated Result for Currency Exchange Modal
  const calculatedToAmount = useMemo(() => {
    if (!fromAmount || fromAmount <= 0) return 0;
    const rate = exchangeCustomRate > 0 ? exchangeCustomRate : 1;

    // e.g. From TOMAN/IQD to USD -> fromAmount / rate
    if (toCurrency === 'USD' && (fromCurrency === 'TOMAN' || fromCurrency === 'IQD')) {
      return fromAmount / rate;
    }
    // e.g. From USD to TOMAN/IQD -> fromAmount * rate
    if (fromCurrency === 'USD' && (toCurrency === 'TOMAN' || toCurrency === 'IQD')) {
      return fromAmount * rate;
    }
    // e.g. From TOMAN to IQD -> (fromAmount / tomanRate) * iqdRate
    return fromAmount;
  }, [fromAmount, fromCurrency, toCurrency, exchangeCustomRate]);

  // Handle Submit Voucher (Single mode, supports Create & Edit modes)
  const handleSubmitVoucher = async (keepOpen = false) => {
    if (!account) return;
    if (voucherAmount <= 0) {
      showErrorNotification('تنبيه', 'يرجى إدخال مبلغ صحيح');
      return;
    }

    setSubmittingVoucher(true);
    try {
      const fullDesc = [
        autoGeneratedDescription,
        voucherNotes.trim() ? `[ملاحظات: ${voucherNotes.trim()}]` : '',
      ].filter(Boolean).join(' | ') || undefined;

      if (voucherModalMode === 'EDIT' && editingVoucherEntryId) {
        if (!voucherCounterAccountId) {
          showErrorNotification('تنبيه', 'يرجى اختيار الصندوق أو المصرف');
          setSubmittingVoucher(false);
          return;
        }
        const counterAcc = realCashAccounts.find(c => c.value === voucherCounterAccountId);
        const rate = voucherCustomRate > 0 ? voucherCustomRate : voucherCurrency === 'TOMAN' ? tomanRate : voucherCurrency === 'IQD' ? iqdRate : 1;

        await clearingsApi.updateVoucher(editingVoucherEntryId, {
          voucherType,
          clearingAccountId: account.id,
          clearingAccountName: account.nameAr,
          counterAccountId: voucherCounterAccountId,
          counterAccountName: counterAcc?.label || 'الصندوق/البنك',
          amount: voucherAmount,
          currency: voucherCurrency,
          exchangeRate: rate,
          convertedUSDAmount: voucherConvertedUSD,
          date: voucherDate || undefined,
          description: fullDesc,
        });

        showSuccessNotification('تم التعديل بنجاح', 'تم تحديث بيانات السند المحاسبي وتحديث كشف الحساب فورياً');
        setVoucherModalOpen(false);
        await loadAccountData();
      } else {
        if (!voucherCounterAccountId) {
          showErrorNotification('تنبيه', 'يرجى اختيار الصندوق أو المصرف');
          setSubmittingVoucher(false);
          return;
        }
        const counterAcc = realCashAccounts.find(c => c.value === voucherCounterAccountId);
        const rate = voucherCustomRate > 0 ? voucherCustomRate : voucherCurrency === 'TOMAN' ? tomanRate : voucherCurrency === 'IQD' ? iqdRate : 1;

        await clearingsApi.createVoucher({
          voucherType,
          clearingAccountId: account.id,
          clearingAccountName: account.nameAr,
          counterAccountId: voucherCounterAccountId,
          counterAccountName: counterAcc?.label || 'الصندوق/البنك',
          amount: voucherAmount,
          currency: voucherCurrency,
          exchangeRate: rate,
          convertedUSDAmount: voucherConvertedUSD,
          date: voucherDate || undefined,
          description: fullDesc,
        });

        const label = voucherType === 'RECEIPT' ? 'سند القبض' : voucherType === 'PAYMENT' ? 'سند الدفع' : 'قيد التصفية';
        showSuccessNotification(
          'تم الحفظ والترحيل بنجاح',
          `تم حفظ ${label} بمبلغ ${voucherAmount.toLocaleString()} ${voucherCurrency} وتحديث الرصيد فورياً`
        );

        setVoucherAmount(0);
        setVoucherBeneficiary('');
        setVoucherNotes('');

        if (!keepOpen) {
          setVoucherModalOpen(false);
        }
        await refreshAccountAndStatement();
      }
    } catch (err: any) {
      showErrorNotification('خطأ في الحفظ', err.message || 'تعذر ترحيل السند');
    } finally {
      setSubmittingVoucher(false);
    }
  };

  // Handle Submit Batch Vouchers (حفظ وترحيل معاملات متعددة دفعة واحدة)
  const handleSubmitBatchVouchers = async () => {
    if (!account) return;
    const validRows = batchRows.filter(r => r.amount > 0 && r.counterAccountId);
    if (validRows.length === 0) {
      showErrorNotification('تنبيه', 'يرجى تعبئة الحساب والمبلغ لمعاملة واحدة على الأقل');
      return;
    }

    setSubmittingVoucher(true);
    try {
      for (const row of validRows) {
        const counterAcc = realCashAccounts.find(c => c.value === row.counterAccountId);
        const effRate = row.customRate > 0 ? row.customRate : row.currency === 'TOMAN' ? tomanRate : row.currency === 'IQD' ? iqdRate : 1;
        const convUSD = clearingsApi.convertToUSD(row.amount, row.currency, effRate);

        const currLabel = row.currency === 'USD' ? 'دولار أمريكي' : row.currency === 'IQD' ? 'دينار عراقي' : 'تومان إيراني';
        const formattedAmount = row.amount.toLocaleString('en-US');
        const formattedUSD = convUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const counterName = counterAcc?.label?.split(' (')[0] || 'الصندوق';
        const dateStr = voucherDate || new Date().toISOString().split('T')[0];

        let desc = row.voucherType === 'RECEIPT'
          ? `استلام مبلغ ${formattedAmount} ${currLabel} من حساب ${account.nameAr} وإيداعه في ${counterName}`
          : row.voucherType === 'PAYMENT'
          ? `دفع مبلغ ${formattedAmount} ${currLabel} من ${counterName} إلى حساب ${account.nameAr}`
          : `قيد تسوية ومقاصة: تحويل ${formattedAmount} ${currLabel} بين حساب ${account.nameAr} و${counterName}`;

        if (row.currency !== 'USD') desc += ` بسعر صرف ${effRate.toLocaleString()} (ما يعادل $${formattedUSD})`;
        if (row.beneficiary.trim()) desc += ` لصالح / بواسطة: ${row.beneficiary.trim()}`;
        desc += ` — بتاريخ ${dateStr}`;
        if (row.notes.trim()) desc += ` | [ملاحظات: ${row.notes.trim()}]`;

        await clearingsApi.createVoucher({
          voucherType: row.voucherType,
          clearingAccountId: account.id,
          clearingAccountName: account.nameAr,
          counterAccountId: row.counterAccountId,
          counterAccountName: counterAcc?.label || 'الصندوق/البنك',
          amount: row.amount,
          currency: row.currency,
          exchangeRate: effRate,
          convertedUSDAmount: convUSD,
          date: voucherDate || undefined,
          description: desc,
        });
      }

      showSuccessNotification(
        'تم حفظ وترحيل الدفعة بنجاح',
        `تم حفظ ${validRows.length} معاملات وترحيلها وتحديث الرصيد فورياً`
      );

      setVoucherModalOpen(false);
      setBatchRows([
        { id: '1', voucherType: 'RECEIPT', counterAccountId: voucherCounterAccountId || '', currency: 'TOMAN', amount: 0, customRate: 0, beneficiary: '', notes: '' },
        { id: '2', voucherType: 'RECEIPT', counterAccountId: voucherCounterAccountId || '', currency: 'TOMAN', amount: 0, customRate: 0, beneficiary: '', notes: '' },
      ]);
      await refreshAccountAndStatement();
    } catch (err: any) {
      showErrorNotification('خطأ في حفظ الدفعة', err.message || 'تعذر ترحيل المعاملات');
    } finally {
      setSubmittingVoucher(false);
    }
  };

  // Handle Submit Currency Exchange Operation
  const handleSubmitExchange = async () => {
    if (!account || fromAmount <= 0 || calculatedToAmount <= 0) {
      showErrorNotification('تنبيه', 'يرجى إدخال المبلغ وتحديد سعر الصرف');
      return;
    }

    if (fromCurrency === toCurrency) {
      showErrorNotification('تنبيه', 'يرجى اختيار عملتين مختلفتين للصرافة');
      return;
    }

    setSubmittingExchange(true);
    try {
      await clearingsApi.exchangeCurrency({
        clearingAccountId: account.id,
        clearingAccountName: account.nameAr,
        fromCurrency,
        fromAmount,
        toCurrency,
        toAmount: calculatedToAmount,
        exchangeRate: exchangeCustomRate,
        date: exchangeDate || undefined,
        description: exchangeNotes.trim() || undefined,
      });

      showSuccessNotification(
        'تمت حركة الصرافة بنجاح',
        `تم تصريف ${fromAmount.toLocaleString()} ${fromCurrency} إلى ${calculatedToAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${toCurrency} وتحديث أرصدة الحساب فورياً`
      );

      setExchangeModalOpen(false);
      setFromAmount(0);
      setExchangeNotes('');
      await loadAccountData();
    } catch (err: any) {
      showErrorNotification('خطأ في الصرافة', err.message || 'تعذر تسجيل حركة الصرافة');
    } finally {
      setSubmittingExchange(false);
    }
  };

  // Open Edit Account Modal
  const handleOpenEditAccount = () => {
    if (!account) return;
    setEditNameAr(account.nameAr || '');
    setEditNameEn(account.nameEn || '');
    setEditContactPerson(account.contactPerson || '');
    setEditPhone(account.phone || '');
    setEditNotes(account.notes || '');
    setEditAccountModalOpen(true);
  };

  // Handle Save Edit Account
  const handleSaveEditAccount = async () => {
    if (!accountId || !editNameAr.trim()) {
      showErrorNotification('تنبيه', 'يرجى إدخال اسم الحساب بالعربية');
      return;
    }
    setUpdatingAccount(true);
    try {
      await clearingsApi.update(accountId, {
        nameAr: editNameAr.trim(),
        nameEn: editNameEn.trim() || undefined,
        contactPerson: editContactPerson.trim() || undefined,
        phone: editPhone.trim() || undefined,
        notes: editNotes.trim() || undefined,
      });
      showSuccessNotification('تم التعديل بنجاح', `تم تحديث بيانات حساب "${editNameAr}" بنجاح`);
      setEditAccountModalOpen(false);
      await loadAccountData();
    } catch (err: any) {
      showErrorNotification('خطأ', err.message || 'تعذر تحديث بيانات الحساب');
    } finally {
      setUpdatingAccount(false);
    }
  };

  // Handle Delete Entire Account from Profile
  const [deletingAccount, setDeletingAccount] = useState(false);
  const handleDeleteThisAccount = async () => {
    if (!account) return;
    const confirm = window.confirm(`هل أنت متأكد من رغبتك في حذف حساب "${account.nameAr}" نهائياً من النظام؟`);
    if (!confirm) return;
    setDeletingAccount(true);
    try {
      await accountsApi.delete(account.id);
      showSuccessNotification('تم الحذف بنجاح', `تم حذف حساب "${account.nameAr}" نهائياً`);
      setEditAccountModalOpen(false);
      navigate('/external-clearings');
    } catch (err: any) {
      showErrorNotification('خطأ في الحذف', err.message || 'تعذر حذف الحساب');
    } finally {
      setDeletingAccount(false);
    }
  };

  if (loading && !account) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500 font-['IBM_Plex_Sans_Arabic',sans-serif]">
        <Loader color="orange" size="md" />
        <span className="text-xs font-bold">جاري تحميل بروفايل حساب التصفية...</span>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="p-8 text-center bg-white border border-slate-200 rounded-xl space-y-3 font-['IBM_Plex_Sans_Arabic',sans-serif]">
        <h2 className="text-sm font-bold text-slate-800">حساب التصفية غير موجود</h2>
        <Button size="xs" color="orange" onClick={() => navigate('/external-clearings')}>
          العودة إلى دليل التصفيات
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 w-full select-none text-slate-800 font-['IBM_Plex_Sans_Arabic',sans-serif]">
      {/* ═══════════════ 1. رأس الصفحة والبروفايل وأزرار الحركات ═══════════════ */}
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Tooltip label="العودة إلى الدليل الرئيسي" withArrow>
            <ActionIcon
              size="md"
              variant="default"
              onClick={() => navigate('/external-clearings')}
              className="bg-white hover:bg-slate-50 border-slate-300 text-slate-700"
            >
              <IconArrowLeft size={16} />
            </ActionIcon>
          </Tooltip>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black text-slate-900 leading-tight">{account.nameAr}</h1>
              <Badge color="orange" variant="light" size="sm" className="font-mono font-bold">
                {account.code}
              </Badge>
              {account.category === 'BOURSE' ? (
                <Badge size="xs" color="blue" variant="light" className="font-bold">
                  حساب بورصة
                </Badge>
              ) : account.category === 'OFFICE' ? (
                <Badge size="xs" color="grape" variant="light" className="font-bold">
                  مكتب وسيط
                </Badge>
              ) : (
                <Badge size="xs" color="gray" variant="light" className="font-bold">
                  حساب عميل
                </Badge>
              )}
            </div>

            {/* تفاصيل جهة الاتصال */}
            <div className="flex items-center gap-3 text-xs text-slate-500 font-medium mt-1">
              {account.contactPerson && (
                <span className="flex items-center gap-1">
                  <IconUser size={12} className="text-slate-400" />
                  <span>{account.contactPerson}</span>
                </span>
              )}
              {account.phone && (
                <span className="flex items-center gap-1 font-mono text-[11px]">
                  <IconPhone size={12} className="text-slate-400" />
                  <span>{account.phone}</span>
                </span>
              )}
              {account.notes && <span className="text-slate-400">({account.notes})</span>}
            </div>
          </div>
        </div>

        {/* أزرار الحركات السريعة (قبض / دفع / صرافة / قيد / تعديل) */}
        <div className="flex items-center gap-2">
          <Button
            size="xs"
            variant="default"
            onClick={loadAccountData}
            leftSection={<IconRefresh size={14} className={loading ? 'animate-spin' : ''} />}
            className="font-bold bg-white hover:bg-slate-50 border-slate-300"
          >
            تحديث
          </Button>

          {/* زر سند قبض */}
          <Button
            size="xs"
            color="teal"
            onClick={() => {
              setVoucherType('RECEIPT');
              setVoucherCurrency(isClientAccount ? 'IQD' : 'TOMAN');
              setVoucherAmount(0);
              setVoucherCustomRate(0);
              setVoucherNotes('');
              setVoucherModalOpen(true);
            }}
            leftSection={<IconArrowDownLeft size={14} />}
            className="font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
          >
            + سند قبض
          </Button>

          {/* زر سند دفع */}
          <Button
            size="xs"
            color="red"
            onClick={() => {
              setVoucherType('PAYMENT');
              setVoucherCurrency(isClientAccount ? 'IQD' : 'TOMAN');
              setVoucherAmount(0);
              setVoucherCustomRate(0);
              setVoucherNotes('');
              setVoucherModalOpen(true);
            }}
            leftSection={<IconArrowUpRight size={14} />}
            className="font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
          >
            + سند دفع
          </Button>

          {/* زر حركة صرافة ومبادلة عملات */}
          <Button
            size="xs"
            color="orange"
            variant="light"
            onClick={() => {
              setFromCurrency(isClientAccount ? 'IQD' : 'TOMAN');
              setToCurrency('USD');
              setFromAmount(0);
              setExchangeCustomRate(92000);
              setExchangeNotes('');
              setExchangeModalOpen(true);
            }}
            leftSection={<IconArrowsExchange size={14} />}
            className="font-bold bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-300"
          >
            + صرافة عملات
          </Button>

          {/* زر قيد تصفية ومقاصة */}
          <Button
            size="xs"
            color="gray"
            variant="default"
            onClick={() => {
              setVoucherType('JOURNAL');
              setVoucherCurrency(isClientAccount ? 'IQD' : 'TOMAN');
              setVoucherAmount(0);
              setVoucherCustomRate(0);
              setVoucherNotes('');
              setVoucherModalOpen(true);
            }}
            leftSection={<IconArrowsLeftRight size={14} />}
            className="font-bold bg-slate-100 hover:bg-slate-200 text-slate-800"
          >
            + قيد مقاصة
          </Button>
        </div>
      </div>

      {/* ═══════════════ 2. بطاقات أرصدة العملات الثلاث والمعادل بالدولار لهذا الحساب ═══════════════ */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 ${isClientAccount ? 'lg:grid-cols-2' : 'lg:grid-cols-4'}`}>
        {/* 1. إجمالي التقييم الشامل بالدولار — يُخفى لحساب العميل */}
        {!isClientAccount && (
        <Paper p="sm" radius="md" withBorder className="bg-white border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-600 font-bold mb-1">
            <span>إجمالي الرصيد المعادل بالدولار</span>
            <Badge size="xs" color="orange" variant="light" className="font-mono font-bold">
              Consolidated
            </Badge>
          </div>
          <div className="text-xl font-black text-slate-900 font-mono tracking-tight">
            ${account.totalConsolidatedUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] font-medium text-slate-400 mt-1">
            التقييم الشامل لأرصدة العملات الثلاث
          </div>
        </Paper>
        )}

        {/* 2. رصيد الدولار */}
        <Paper p="sm" radius="md" withBorder className="bg-white border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-600 font-bold mb-1">
            <span>رصيد الدولار ($ USD)</span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">USD</span>
          </div>
          <div className="text-xl font-black text-emerald-900 font-mono">
            ${account.balanceUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] font-medium text-slate-400 mt-1">
            الرصيد المباشر بالدولار الأمريكي
          </div>
        </Paper>

        {/* 3. رصيد الدينار العراقي */}
        <Paper p="sm" radius="md" withBorder className="bg-white border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-600 font-bold mb-1">
            <span>رصيد الدينار (IQD)</span>
            <span className="text-[10px] font-mono font-bold text-slate-500">
              ≈ ${(account.balanceIQD / (iqdRate || 1530)).toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="text-xl font-black text-slate-900 font-mono">
            {account.balanceIQD.toLocaleString()} <span className="text-xs font-sans font-bold text-slate-500">د.ع</span>
          </div>
          <div className="text-[10px] font-medium text-slate-400 mt-1">
            سعر الصرف المرجعي: {iqdRate.toLocaleString()} د.ع/$
          </div>
        </Paper>

        {/* 4. رصيد التومان — يُخفى لحساب العميل (لا يتعامل بالتومان) */}
        {!isClientAccount && (
        <Paper p="sm" radius="md" withBorder className="bg-white border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-600 font-bold mb-1">
            <span>رصيد التومان (TOMAN)</span>
            <span className="text-[10px] font-mono font-bold text-slate-500">
              ≈ ${(account.balanceTOMAN / (tomanRate || 92000)).toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="text-xl font-black text-slate-900 font-mono">
            {account.balanceTOMAN.toLocaleString()} <span className="text-xs font-sans font-bold text-slate-500">تومان</span>
          </div>
          <div className="text-[10px] font-medium text-slate-400 mt-1">
            سعر الصرف المرجعي: {tomanRate.toLocaleString()} تومان/$
          </div>
        </Paper>
        )}
      </div>

      {/* ═══════════════ 3. كشف الحساب وسجل الحركات المحاسبية مع الفلترة المتقدمة ═══════════════ */}
      <Paper radius="lg" withBorder className="bg-white border-slate-200 shadow-2xs overflow-hidden p-3 space-y-2.5">
        {/* ─── شريط الفلترة والبحث المتقدم الذكي ─── */}
        <div className="bg-slate-50/80 border border-slate-200 rounded-lg p-2.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <IconFilter size={15} className="text-orange-600" />
              <span>فلاتر وبحث كشف الحساب</span>
              <Badge size="xs" color="orange" variant="light" className="font-mono font-bold">
                عرض {filteredStatementRows.length} من أصل {statementRows.length} حركة
              </Badge>
            </div>

            {(filterSearch || filterStartDate || filterEndDate || filterType !== 'ALL' || filterCurrency !== 'ALL' || filterAudited !== 'ALL') && (
              <Button
                size="compact-xs"
                variant="subtle"
                color="red"
                onClick={handleResetFilters}
                leftSection={<IconRotate size={12} />}
                className="font-bold text-[11px]"
              >
                إعادة تعيين الفلاتر
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 items-end">
            {/* 1. البحث النصي */}
            <div className="lg:col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">بحث بالبيان / الملاحظة / المستفيد</label>
              <TextInput
                size="xs"
                placeholder="ابحث بالبيان، الملاحظة، المستفيد، المرجع..."
                leftSection={<IconSearch size={14} className="text-slate-400" />}
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                className="font-medium"
              />
            </div>

            {/* 2. من تاريخ */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">من تاريخ</label>
              <AccountingDatePicker
                value={filterStartDate}
                onChange={setFilterStartDate}
                placeholder="من تاريخ..."
              />
            </div>

            {/* 3. إلى تاريخ */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">إلى تاريخ</label>
              <AccountingDatePicker
                value={filterEndDate}
                onChange={setFilterEndDate}
                placeholder="إلى تاريخ..."
              />
            </div>

            {/* 4. نوع السند */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">نوع السند</label>
              <Select
                size="xs"
                value={filterType}
                onChange={v => setFilterType(v || 'ALL')}
                data={[
                  { value: 'ALL', label: 'كل الأنواع' },
                  { value: 'RECEIPT', label: 'سندات قبض' },
                  { value: 'PAYMENT', label: 'سندات دفع' },
                  { value: 'OPENING', label: 'رصيد افتتاحي' },
                  { value: 'EXCHANGE', label: 'صرافة عملات' },
                ]}
                className="font-medium"
              />
            </div>

            {/* 5. العملة */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">العملة</label>
              <Select
                size="xs"
                value={filterCurrency}
                onChange={v => setFilterCurrency(v || 'ALL')}
                data={[
                  { value: 'ALL', label: 'كل العملات' },
                  { value: 'USD', label: 'دولار ($)' },
                  { value: 'IQD', label: 'دينار (IQD)' },
                  { value: 'TOMAN', label: 'تومان (TOM)' },
                ]}
                className="font-medium"
              />
            </div>
          </div>
        </div>

        {/* ─── جدول كشف الحساب ─── */}
        {statementRows.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50 space-y-2">
            <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-500">
              <IconReceipt size={20} />
            </div>
            <h3 className="font-bold text-slate-800 text-sm">لا توجد حركات مسجلة لهذا الحساب حتى الآن</h3>
            <p className="text-xs text-slate-500 font-medium max-w-md mx-auto">
              يمكنك إجراء أول سند قبض أو دفع أو حركة صرافة بالضغط على الأزرار العلوية وسيتم تسجيل الحركة واحتسابها فورياً.
            </p>
          </div>
        ) : filteredStatementRows.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50 space-y-1.5">
            <IconFilter size={24} className="mx-auto text-slate-400" />
            <h4 className="font-bold text-slate-800 text-xs">لا توجد حركات مطابقة لمعايير الفلترة</h4>
            <p className="text-[11px] text-slate-500">جرب تغيير التاريخ أو تفريغ كلمات البحث</p>
            <Button size="compact-xs" variant="light" color="orange" onClick={handleResetFilters} className="font-bold mt-1">
              إلغاء الفلترة
            </Button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {/* شريط الإحصائيات السريع للكشف */}
            <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700">إجمالي الحركات:</span>
                <Badge size="xs" color="gray" variant="light" className="font-bold font-mono">
                  {filteredStatementRows.length}
                </Badge>
                <span className="text-slate-300">|</span>
                <span className="font-bold text-slate-700">الحركات المدققة:</span>
                <Badge size="xs" color="teal" variant="light" className="font-bold font-mono">
                  {filteredStatementRows.filter(r => auditedRowIds[r.id] || r.isAudited).length}
                </Badge>
                {selectedRowIds.length > 0 && (
                  <>
                    <span className="text-slate-300">|</span>
                    <Badge size="xs" color="orange" variant="filled" className="font-bold">
                      المحدد: {selectedRowIds.length}
                    </Badge>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="xs"
                  variant="subtle"
                  color="orange"
                  onClick={toggleAllSelection}
                  className="font-bold text-[11px] h-7"
                >
                  {selectedRowIds.length === filteredStatementRows.length ? 'إلغاء تحديد الكل' : 'تحديد كل الحركات'}
                </Button>
                <Button
                  size="xs"
                  variant="default"
                  leftSection={<IconFileExport size={13} className="text-emerald-700" />}
                  onClick={handleExportSelected}
                  disabled={selectedRowIds.length === 0}
                  className="font-bold text-[11px] h-7"
                >
                  تصدير المحدد ({selectedRowIds.length})
                </Button>
              </div>
            </div>

            {/* ═══════════════ حاوية الإجراءات العلوية الشفافة والأنيقة (Top Glassmorphic Action Bar) ═══════════════ */}
            {selectedRowIds.length > 0 && (
              <div className="bg-white/90 backdrop-blur-md border border-orange-200/90 shadow-sm rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2.5 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2.5">
                  <Badge size="md" color="orange" variant="light" className="font-bold border border-orange-300">
                    تم تحديد {selectedRowIds.length} حركة
                  </Badge>
                  <span className="text-xs text-slate-600 font-medium">
                    إجراءات الحركات المالية المحددة:
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* اعتماد وتدقيق */}
                  <Button
                    size="xs"
                    variant="light"
                    color="teal"
                    leftSection={<IconShieldCheck size={14} />}
                    onClick={handleAuditSelected}
                    className="font-bold bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100"
                  >
                    اعتماد وتدقيق ({selectedRowIds.length})
                  </Button>

                  {/* طباعة السندات */}
                  <Button
                    size="xs"
                    variant="light"
                    color="blue"
                    leftSection={<IconPrinter size={14} />}
                    onClick={handlePrintSelected}
                    className="font-bold bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100"
                  >
                    طباعة السندات
                  </Button>

                  {/* تصدير */}
                  <Button
                    size="xs"
                    variant="light"
                    color="emerald"
                    leftSection={<IconFileExport size={14} />}
                    onClick={handleExportSelected}
                    className="font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
                  >
                    تصدير Excel / CSV
                  </Button>

                  {/* تعديل السند (إذا تم تحديد حركة واحدة) */}
                  {selectedRowIds.length === 1 && (
                    <Button
                      size="xs"
                      variant="light"
                      color="orange"
                      leftSection={<IconEdit size={14} />}
                      onClick={() => {
                        const row = statementRows.find(r => r.id === selectedRowIds[0]);
                        if (row) handleOpenEditTransaction(row);
                      }}
                      className="font-bold bg-orange-50 text-orange-900 border border-orange-300 hover:bg-orange-100"
                    >
                      تعديل الحركة
                    </Button>
                  )}

                  {/* حذف السندات */}
                  <Button
                    size="xs"
                    color="red"
                    variant="light"
                    leftSection={<IconTrash size={14} />}
                    onClick={() => setDeleteConfirmModalOpen(true)}
                    className="font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                  >
                    حذف ({selectedRowIds.length})
                  </Button>

                  {/* زر إلغاء التحديد */}
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    color="gray"
                    onClick={() => setSelectedRowIds([])}
                    title="إلغاء التحديد"
                  >
                    <IconX size={15} className="text-slate-500 hover:text-slate-950" />
                  </ActionIcon>
                </div>
              </div>
            )}

            {/* جدول الحركات المحاسبية المطور والشامل */}
            <div className="border border-slate-200 rounded-lg overflow-x-auto">
              <Table highlightOnHover withColumnBorders verticalSpacing="xs" className="text-xs text-right min-w-[950px]">
                <Table.Thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <Table.Tr>
                    <Table.Th className="text-center w-12">
                      <Checkbox
                        size="xs"
                        checked={selectedRowIds.length === filteredStatementRows.length && filteredStatementRows.length > 0}
                        indeterminate={selectedRowIds.length > 0 && selectedRowIds.length < filteredStatementRows.length}
                        onChange={toggleAllSelection}
                        title="تحديد الكل"
                      />
                    </Table.Th>
                    <Table.Th className="text-center w-24">التدقيق</Table.Th>
                    <Table.Th className="text-center w-24">التاريخ</Table.Th>
                    <Table.Th className="text-center w-28">نوع السند</Table.Th>
                    <Table.Th className="min-w-[200px]">البيان / تفاصيل الحركة</Table.Th>
                    <Table.Th className="w-40">الجهة المحول لها / المستفيد</Table.Th>
                    <Table.Th className="w-36">الملاحظات</Table.Th>
                    <Table.Th className="text-center w-20">العملة</Table.Th>
                    <Table.Th className="text-center w-28 whitespace-nowrap">مدين {isClientAccount ? '(د.ع)' : '($)'}</Table.Th>
                    <Table.Th className="text-center w-28 whitespace-nowrap">دائن {isClientAccount ? '(د.ع)' : '($)'}</Table.Th>
                    <Table.Th className="text-center w-32 font-black text-slate-900 bg-slate-200/50 whitespace-nowrap">
                      الرصيد التراكمي {isClientAccount ? '(د.ع)' : '($)'}
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredStatementRows.map((row, idx) => {
                    const isSelected = selectedRowIds.includes(row.id);
                    const isAudited = Boolean(auditedRowIds[row.id] !== undefined ? auditedRowIds[row.id] : row.isAudited);
                    
                    // تحديد نوع السند المحاسبي بدقة
                    const descLower = (row.description || '').toLowerCase();
                    const refUpper = (row.reference || '').toUpperCase();
                    let moveType = { label: 'سند قبض', color: 'teal', variant: 'light' as const };

                    if (refUpper.startsWith('OPEN') || descLower.includes('افتتاحي') || descLower.includes('opening')) {
                      moveType = { label: 'رصيد افتتاحي', color: 'blue', variant: 'light' };
                    } else if (refUpper.startsWith('EXC') || descLower.includes('صرافة') || descLower.includes('مبادلة')) {
                      moveType = { label: 'صرافة عملات', color: 'orange', variant: 'light' };
                    } else if (refUpper.startsWith('PAY') || descLower.includes('دفع') || descLower.includes('تسديد') || descLower.includes('سداد')) {
                      moveType = { label: 'سند دفع', color: 'red', variant: 'light' };
                    } else if (refUpper.startsWith('REC') || descLower.includes('قبض') || descLower.includes('استلام') || row.credit > 0) {
                      moveType = { label: 'سند قبض', color: 'teal', variant: 'light' };
                    } else if (row.debit > 0) {
                      moveType = { label: 'سند دفع', color: 'red', variant: 'light' };
                    }

                    return (
                      <Table.Tr
                        key={row.id || idx}
                        className={`transition-colors ${isSelected ? 'bg-orange-50/80 font-medium' : 'hover:bg-slate-50/70'}`}
                      >
                        {/* زر التشغيل والإطفاء / تحديد السطر */}
                        <Table.Td className="text-center">
                          <Switch
                            size="xs"
                            color="orange"
                            checked={isSelected}
                            onChange={() => toggleRowSelection(row.id)}
                            title={isSelected ? 'إلغاء تحديد السطر' : 'تحديد وتفعيل السطر'}
                          />
                        </Table.Td>

                        {/* عمود التدقيق التفاعلي */}
                        <Table.Td className="text-center">
                          <Tooltip label="انقر لتغيير حالة التدقيق والاعتماد">
                            <Badge
                              size="xs"
                              color={isAudited ? 'teal' : 'gray'}
                              variant={isAudited ? 'filled' : 'light'}
                              onClick={() => toggleAudit(row.id)}
                              className="cursor-pointer font-bold select-none hover:opacity-90"
                            >
                              {isAudited ? 'مدقق ✅' : 'قيد التدقيق ⏳'}
                            </Badge>
                          </Tooltip>
                        </Table.Td>

                        {/* التاريخ */}
                        <Table.Td className="text-center font-mono font-bold text-slate-700">
                          {row.date}
                        </Table.Td>

                        {/* نوع السند المعرف محاسبياً بدقة */}
                        <Table.Td className="text-center">
                          <Badge size="xs" color={moveType.color} variant={moveType.variant} className="font-bold">
                            {moveType.label}
                          </Badge>
                        </Table.Td>

                        {/* البيان / تفاصيل الحركة */}
                        <Table.Td>
                          <div className="font-bold text-slate-900 text-xs">{row.description}</div>
                          {row.reference && (
                            <div className="text-[10px] font-mono text-slate-400">مرجع: {row.reference}</div>
                          )}
                        </Table.Td>

                        {/* الجهة المحول لها / المستفيد */}
                        <Table.Td>
                          {row.beneficiary ? (
                            <div className="flex items-center gap-1 font-bold text-slate-800 text-xs bg-slate-100/80 px-2 py-0.5 rounded border border-slate-200">
                              <IconUser size={12} className="text-orange-700 shrink-0" />
                              <span className="truncate">{row.beneficiary}</span>
                            </div>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </Table.Td>

                        {/* الملاحظات */}
                        <Table.Td>
                          {row.notes ? (
                            <div className="flex items-center gap-1 text-slate-700 text-[11px]">
                              <IconNotes size={12} className="text-slate-400 shrink-0" />
                              <span className="truncate max-w-[140px]" title={row.notes}>{row.notes}</span>
                            </div>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </Table.Td>

                        {/* العملة */}
                        <Table.Td className="text-center font-mono font-bold text-slate-700">
                          {row.currency}
                        </Table.Td>

                        {/* مدين — بالدينار لحساب العميل، وإلا بالدولار */}
                        <Table.Td className="text-center font-mono font-bold text-rose-700 whitespace-nowrap">
                          {row.debit > 0
                            ? isClientAccount
                              ? `${Math.round(row.debit * iqdRate).toLocaleString('en-US')} د.ع`
                              : `$${row.debit.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                            : '—'}
                        </Table.Td>

                        {/* دائن */}
                        <Table.Td className="text-center font-mono font-bold text-emerald-800 whitespace-nowrap">
                          {row.credit > 0
                            ? isClientAccount
                              ? `${Math.round(row.credit * iqdRate).toLocaleString('en-US')} د.ع`
                              : `$${row.credit.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                            : '—'}
                        </Table.Td>

                        {/* الرصيد التراكمي */}
                        <Table.Td className="text-center font-mono font-black text-slate-900 bg-slate-50/70 whitespace-nowrap">
                          {isClientAccount
                            ? `${Math.round(row.balance * iqdRate).toLocaleString('en-US')} د.ع`
                            : `$${row.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </div>
          </div>
        )}
      </Paper>

      {/* ═══════════════ MODAL 1: إضافة سند قبض / دفع لهذا المكتب ═══════════════ */}
      <Modal
        opened={voucherModalOpen}
        onClose={() => setVoucherModalOpen(false)}
        title={
          <div className="flex items-center justify-between w-full pr-1">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                {voucherModalMode === 'CREATE' ? <IconFileInvoice size={16} /> : <IconEdit size={16} />}
              </div>
              <span>
                {voucherModalMode === 'CREATE'
                  ? `إضافة سند لحساب ${account.nameAr}`
                  : `تعديل سند الحركة المالية (${voucherType === 'RECEIPT' ? 'سند قبض' : voucherType === 'PAYMENT' ? 'سند دفع' : 'قيد مقاصة'})`}
              </span>
            </div>
            {voucherModalMode === 'CREATE' && (
              <SegmentedControl
                size="xs"
                value={voucherMode}
                onChange={v => setVoucherMode(v as 'SINGLE' | 'BATCH')}
                data={[
                  { label: 'معاملة واحدة (سريعة)', value: 'SINGLE' },
                  { label: `معاملات متعددة (${batchRows.length})`, value: 'BATCH' },
                ]}
                color="orange"
                className="bg-slate-100 font-bold text-xs"
              />
            )}
          </div>
        }
        size={voucherMode === 'BATCH' && voucherModalMode === 'CREATE' ? 'xl' : 920}
        centered
        radius="lg"
      >
        {voucherMode === 'SINGLE' ? (
          <div className="space-y-3.5 text-xs select-none">
            {/* نوع السند في الأعلى */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">نوع السند / الحركة</label>
              <SegmentedControl
                fullWidth
                size="xs"
                value={voucherType}
                onChange={v => setVoucherType(v as any)}
                data={[
                  {
                    label: (
                      <div className="flex items-center justify-center gap-1.5 py-0.5">
                        <IconArrowDownLeft size={14} className="text-emerald-700" />
                        <span>سند قبض</span>
                      </div>
                    ),
                    value: 'RECEIPT',
                  },
                  {
                    label: (
                      <div className="flex items-center justify-center gap-1.5 py-0.5">
                        <IconArrowUpRight size={14} className="text-rose-700" />
                        <span>سند دفع</span>
                      </div>
                    ),
                    value: 'PAYMENT',
                  },
                  {
                    label: (
                      <div className="flex items-center justify-center gap-1.5 py-0.5">
                        <IconArrowsLeftRight size={14} className="text-amber-700" />
                        <span>قيد مقاصة</span>
                      </div>
                    ),
                    value: 'JOURNAL',
                  },
                ]}
                color={voucherType === 'RECEIPT' ? 'teal' : voucherType === 'PAYMENT' ? 'red' : 'orange'}
                className="bg-slate-100 font-bold"
              />
            </div>

            {/* الترتيب العرضي: عمودين متوازنين بمساحة مريحة */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              {/* ══ العمود الأيمن: الأطراف والتوثيق ══ */}
              <div className="space-y-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* حساب التصفية */}
                  <TextInput
                    label="حساب التصفية"
                    value={`${account.nameAr} (${account.code})`}
                    disabled
                    size="xs"
                    className="font-bold"
                  />

                  {/* الحساب المقابل */}
                  <Select
                    label={voucherType === 'RECEIPT' ? 'الصندوق / المصرف (المقبوض إليه)' : 'الصندوق / المصرف (المدفوع منه)'}
                    placeholder="اختر الصندوق أو البنك..."
                    searchable
                    nothingFoundMessage="لا توجد حسابات مالية"
                    data={realCashAccounts}
                    value={voucherCounterAccountId}
                    onChange={(val) => setVoucherCounterAccountId(val || '')}
                    size="xs"
                    className="font-bold"
                  />
                </div>

                {/* حقل اسم الجهة المرسل إليها الحوالة / المستفيد */}
                <TextInput
                  label="الجهة المحول لها / المستفيد (اختياري)"
                  placeholder="مثال: شركة المسافر / مكتب أربيل / المستفيد أحمد..."
                  value={voucherBeneficiary}
                  onChange={e => setVoucherBeneficiary(e.target.value)}
                  size="xs"
                  className="font-medium"
                />

                {/* تقويم متطور مع اختصارات سريعة */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-slate-700">تاريخ الحركة</label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date(voucherDate || new Date());
                          d.setDate(d.getDate() - 1);
                          setVoucherDate(d.toISOString().split('T')[0]);
                        }}
                        className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-700 transition-colors"
                        title="اليوم السابق"
                      >
                        ◀ أمس
                      </button>
                      <button
                        type="button"
                        onClick={() => setVoucherDate(new Date().toISOString().split('T')[0])}
                        className="px-2 py-0.5 rounded bg-orange-100 hover:bg-orange-200 text-[10px] font-bold text-orange-800 transition-colors"
                        title="اليوم الحالي"
                      >
                        اليوم
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date(voucherDate || new Date());
                          d.setDate(d.getDate() + 1);
                          setVoucherDate(d.toISOString().split('T')[0]);
                        }}
                        className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-700 transition-colors"
                        title="اليوم التالي"
                      >
                        غداً ▶
                      </button>
                    </div>
                  </div>

                  <AccountingDatePicker
                    value={voucherDate}
                    onChange={val => setVoucherDate(val)}
                    placeholder="اختر التاريخ..."
                  />
                </div>

                {/* نص إرشادي لطيف ومختصر */}
                <div className="bg-white border border-slate-200 rounded-lg p-2 text-[11px] text-slate-600 font-medium">
                  {voucherType === 'RECEIPT' ? (
                    <span>🟢 <strong>سند قبض:</strong> استلام مبالغ للصندوق / المصرف.</span>
                  ) : voucherType === 'PAYMENT' ? (
                    <span>🔴 <strong>سند دفع:</strong> صرف مبالغ من الصندوق / المصرف.</span>
                  ) : (
                    <span>⚖️ <strong>قيد مقاصة:</strong> تسوية محاسبية مباشرة بين الحسابين.</span>
                  )}
                </div>
              </div>

              {/* ══ العمود الأيسر: العملة، المبلغ، الصرف، والمعادل ══ */}
              <div className="space-y-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
                {/* أزرار العملة (افتراضياً تومان) */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">العملة</label>
                  <SegmentedControl
                    fullWidth
                    size="xs"
                    value={voucherCurrency}
                    onChange={v => {
                      const c = v as 'USD' | 'IQD' | 'TOMAN';
                      setVoucherCurrency(c);
                      setVoucherCustomRate(0);
                    }}
                    data={[
                      ...(isClientAccount ? [] : [{ label: 'تومان (TOM)', value: 'TOMAN' }]),
                      { label: 'دينار (IQD)', value: 'IQD' },
                      { label: 'دولار ($)', value: 'USD' },
                    ]}
                    color="orange"
                    className="bg-white border border-slate-200 font-bold"
                  />
                </div>

                {/* حقول المبلغ وسعر الصرف */}
                {voucherCurrency === 'USD' ? (
                  <FormattedNumberInput
                    label="المبلغ بالدولار ($ USD)"
                    value={voucherAmount}
                    onChange={v => setVoucherAmount(typeof v === 'number' ? v : parseFloat(String(v || '0')) || 0)}
                    size="xs"
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormattedNumberInput
                      label={voucherCurrency === 'TOMAN' ? 'المبلغ بالتومان' : 'المبلغ بالدينار'}
                      value={voucherAmount}
                      onChange={v => setVoucherAmount(typeof v === 'number' ? v : parseFloat(String(v || '0')) || 0)}
                      size="xs"
                    />

                    <FormattedNumberInput
                      label="سعر الصرف (لكل 1$)"
                      placeholder={voucherCurrency === 'TOMAN' ? '92,000' : '1,530'}
                      value={voucherCustomRate}
                      onChange={v => setVoucherCustomRate(typeof v === 'number' ? v : parseFloat(String(v || '0')) || 0)}
                      size="xs"
                    />
                  </div>
                )}

                {/* المعادل بالدولار — يُخفى لحساب العميل: يُتابَع بعملته لا بمعادل. */}
                {!isClientAccount && (
                <div className="bg-white border border-slate-200 rounded-lg p-2.5 flex items-center justify-between font-mono">
                  <span className="text-slate-700 font-bold text-xs">المعادل بالدولار:</span>
                  <span className="text-base font-black text-emerald-900">
                    ${voucherConvertedUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                )}

                {/* البيان التلقائي المولّد */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-700">البيان المحاسبي (يُكتب تلقائياً)</label>
                  {autoGeneratedDescription ? (
                    <div className="bg-orange-50/60 border border-orange-200/80 rounded-lg p-2.5 text-[11px] text-slate-800 font-medium leading-relaxed">
                      {autoGeneratedDescription}
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[11px] text-slate-400 font-medium italic">
                      سيظهر البيان تلقائياً عند تعبئة الحقول أعلاه...
                    </div>
                  )}

                  <Textarea
                    label="ملاحظات إضافية (اختياري)"
                    placeholder="أي ملاحظات خاصة تُضاف للبيان..."
                    rows={1}
                    value={voucherNotes}
                    onChange={e => setVoucherNotes(e.target.value)}
                    size="xs"
                    className="font-medium"
                  />
                </div>
              </div>
            </div>

            {/* الأزرار: حفظ وإضافة آخر + حفظ وترحيل */}
            <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
              <Button size="xs" variant="default" onClick={() => setVoucherModalOpen(false)} className="font-medium">
                إلغاء
              </Button>
              <div className="flex items-center gap-2">
                {voucherModalMode === 'CREATE' && (
                  <Button
                    size="xs"
                    variant="light"
                    color="orange"
                    loading={submittingVoucher}
                    onClick={() => handleSubmitVoucher(true)}
                    leftSection={<IconPlus size={14} />}
                    className="font-bold border border-orange-200 hover:bg-orange-100"
                  >
                    حفظ وإضافة معاملة أخرى
                  </Button>
                )}
                <Button
                  size="xs"
                  color={voucherType === 'RECEIPT' ? 'teal' : voucherType === 'PAYMENT' ? 'red' : 'orange'}
                  loading={submittingVoucher}
                  onClick={() => handleSubmitVoucher(false)}
                  leftSection={<IconDeviceFloppy size={14} />}
                  className="font-bold text-white shadow-xs"
                >
                  {voucherModalMode === 'CREATE' ? 'حفظ وترحيل السند' : 'حفظ التعديلات'}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* ══════════ BATCH MODE: إضافة معاملات متعددة دفعة واحدة ══════════ */
          <div className="space-y-3.5 text-xs select-none">
            {/* التاريخ العام للدفعة */}
            <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700">تاريخ جميع المعاملات:</span>
                <span className="font-mono font-bold text-slate-800">{voucherDate}</span>
              </div>
              <div className="w-48">
                <AccountingDatePicker
                  value={voucherDate}
                  onChange={val => setVoucherDate(val)}
                  placeholder="اختر التاريخ..."
                />
              </div>
            </div>

            {/* جدول المعاملات المتعددة */}
            <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-[380px] overflow-y-auto">
              <Table highlightOnHover withColumnBorders verticalSpacing="xs" className="text-xs text-right">
                <Table.Thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10">
                  <Table.Tr>
                    <Table.Th className="w-10 text-center">#</Table.Th>
                    <Table.Th className="w-32">نوع السند</Table.Th>
                    <Table.Th className="w-44">الصندوق / المصرف</Table.Th>
                    <Table.Th className="w-28">العملة</Table.Th>
                    <Table.Th className="w-36">المبلغ</Table.Th>
                    <Table.Th className="w-28">سعر الصرف</Table.Th>
                    <Table.Th className="w-28 text-center font-mono">المعادل ($)</Table.Th>
                    <Table.Th className="min-w-[140px]">المستفيد / بيان</Table.Th>
                    <Table.Th className="w-10 text-center"></Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {batchRows.map((row, idx) => {
                    const effRate = row.customRate > 0 ? row.customRate : row.currency === 'TOMAN' ? tomanRate : row.currency === 'IQD' ? iqdRate : 1;
                    const rowUSD = clearingsApi.convertToUSD(row.amount, row.currency, effRate);

                    return (
                      <Table.Tr key={row.id}>
                        <Table.Td className="text-center font-bold text-slate-400">{idx + 1}</Table.Td>
                        <Table.Td>
                          <Select
                            size="xs"
                            value={row.voucherType}
                            onChange={val => {
                              const updated = [...batchRows];
                              updated[idx].voucherType = (val as any) || 'RECEIPT';
                              setBatchRows(updated);
                            }}
                            data={[
                              { value: 'RECEIPT', label: '🟢 سند قبض' },
                              { value: 'PAYMENT', label: '🔴 سند دفع' },
                              { value: 'JOURNAL', label: '⚖️ قيد مقاصة' },
                            ]}
                            className="font-bold"
                          />
                        </Table.Td>
                        <Table.Td>
                          <Select
                            size="xs"
                            searchable
                            placeholder="اختر الصندوق..."
                            value={row.counterAccountId}
                            onChange={val => {
                              const updated = [...batchRows];
                              updated[idx].counterAccountId = val || '';
                              setBatchRows(updated);
                            }}
                            data={realCashAccounts}
                            className="font-bold"
                          />
                        </Table.Td>
                        <Table.Td>
                          <Select
                            size="xs"
                            value={row.currency}
                            onChange={val => {
                              const updated = [...batchRows];
                              updated[idx].currency = (val as any) || 'TOMAN';
                              updated[idx].customRate = 0;
                              setBatchRows(updated);
                            }}
                            data={[
                              { value: 'TOMAN', label: 'تومان' },
                              { value: 'IQD', label: 'دينار' },
                              { value: 'USD', label: 'دولار' },
                            ]}
                            className="font-bold"
                          />
                        </Table.Td>
                        <Table.Td>
                          <FormattedNumberInput
                            size="xs"
                            value={row.amount}
                            onChange={v => {
                              const updated = [...batchRows];
                              updated[idx].amount = typeof v === 'number' ? v : parseFloat(String(v || '0')) || 0;
                              setBatchRows(updated);
                            }}
                          />
                        </Table.Td>
                        <Table.Td>
                          {row.currency === 'USD' ? (
                            <span className="text-[11px] text-slate-400 text-center block font-mono">1.00</span>
                          ) : (
                            <FormattedNumberInput
                              size="xs"
                              placeholder={row.currency === 'TOMAN' ? '92,000' : '1,530'}
                              value={row.customRate}
                              onChange={v => {
                                const updated = [...batchRows];
                                updated[idx].customRate = typeof v === 'number' ? v : parseFloat(String(v || '0')) || 0;
                                setBatchRows(updated);
                              }}
                            />
                          )}
                        </Table.Td>
                        <Table.Td className="text-center font-mono font-bold text-emerald-800 bg-emerald-50/40">
                          ${rowUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Table.Td>
                        <Table.Td>
                          <TextInput
                            size="xs"
                            placeholder="المستفيد / ملاحظات..."
                            value={row.beneficiary}
                            onChange={e => {
                              const updated = [...batchRows];
                              updated[idx].beneficiary = e.target.value;
                              setBatchRows(updated);
                            }}
                          />
                        </Table.Td>
                        <Table.Td className="text-center">
                          {batchRows.length > 1 && (
                            <ActionIcon
                              size="xs"
                              color="red"
                              variant="subtle"
                              onClick={() => {
                                setBatchRows(batchRows.filter((_, i) => i !== idx));
                              }}
                              title="حذف هذا السطر"
                            >
                              <IconTrash size={13} />
                            </ActionIcon>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </div>

            {/* شريط الإضافة والمجاميع */}
            <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <Button
                size="xs"
                variant="light"
                color="orange"
                leftSection={<IconPlus size={14} />}
                onClick={() => {
                  setBatchRows([
                    ...batchRows,
                    {
                      id: String(Date.now()),
                      voucherType: 'RECEIPT',
                      counterAccountId: voucherCounterAccountId || (realCashAccounts[0]?.value || ''),
                      currency: 'TOMAN',
                      amount: 0,
                      customRate: 0,
                      beneficiary: '',
                      notes: '',
                    },
                  ]);
                }}
                className="font-bold"
              >
                + إضافة معاملة أخرى للقائمة
              </Button>

              <div className="flex items-center gap-3 font-mono">
                <span className="text-slate-600 font-bold text-xs">إجمالي المعاملات بالدولار:</span>
                <span className="text-base font-black text-emerald-900 bg-white px-3 py-1 rounded border border-emerald-300">
                  ${batchTotalUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* الأزرار */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button size="xs" variant="default" onClick={() => setVoucherModalOpen(false)} className="font-medium">
                إلغاء
              </Button>
              <Button
                size="xs"
                color="orange"
                loading={submittingVoucher}
                onClick={handleSubmitBatchVouchers}
                leftSection={<IconDeviceFloppy size={14} />}
                className="font-bold text-white bg-orange-600 hover:bg-orange-700 shadow-xs"
              >
                حفظ وترحيل جميع المعاملات ({batchRows.filter(r => r.amount > 0).length})
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ═══════════════ MODAL 2: حركة صرافة ومبادلة عملات داخل الحساب ═══════════════ */}
      <Modal
        opened={exchangeModalOpen}
        onClose={() => setExchangeModalOpen(false)}
        title={
          <div className="flex items-center gap-2.5 text-slate-900 font-bold text-sm">
            <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
              <IconArrowsExchange size={16} />
            </div>
            <span>حركة صرافة ومبادلة عملات ({account.nameAr})</span>
          </div>
        }
        size="lg"
        centered
        radius="lg"
      >
        <div className="space-y-3.5 text-xs select-none">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-700 font-medium text-[11px] leading-relaxed">
            تتيح لك حركة الصرافة تحويل رصيد من عملة إلى أخرى داخل حساب التصفية (مثلاً: تصريف التومان إلى دولار بسعر الصرف المتفق عليه) لتعديل الأرصدة تلقائياً.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* من عملة */}
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-2">
              <label className="block font-bold text-slate-800">تحويل من (العملة المصرفة):</label>
              <SegmentedControl
                fullWidth
                size="xs"
                value={fromCurrency}
                onChange={v => setFromCurrency(v as any)}
                data={[
                  ...(isClientAccount ? [] : [{ label: 'تومان (TOMAN)', value: 'TOMAN' }]),
                  { label: 'دينار (IQD)', value: 'IQD' },
                  { label: 'دولار ($)', value: 'USD' },
                ]}
                color="orange"
                className="bg-white font-bold"
              />
              <FormattedNumberInput
                label="المبلغ المصرف"
                value={fromAmount}
                onChange={v => setFromAmount(typeof v === 'number' ? v : parseFloat(String(v || '0')) || 0)}
                size="xs"
              />
            </div>

            {/* إلى عملة */}
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-2">
              <label className="block font-bold text-slate-800">تحويل إلى (العملة المستلمة):</label>
              <SegmentedControl
                fullWidth
                size="xs"
                value={toCurrency}
                onChange={v => setToCurrency(v as any)}
                data={[
                  { label: 'دولار ($ USD)', value: 'USD' },
                  { label: 'دينار (IQD)', value: 'IQD' },
                  ...(isClientAccount ? [] : [{ label: 'تومان (TOMAN)', value: 'TOMAN' }]),
                ]}
                color="teal"
                className="bg-white font-bold"
              />
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">المبلغ المحصل الناتج:</label>
                <div className="h-7 px-2.5 bg-white rounded border border-slate-300 flex items-center justify-between font-mono font-bold text-emerald-900">
                  <span>{calculatedToAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                  <span className="text-xs font-sans text-slate-500">{toCurrency}</span>
                </div>
              </div>
            </div>
          </div>

          {/* سعر الصرف المعتمد */}
          <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormattedNumberInput
                label={`سعر الصرف المعتمد (لكل 1 دولار)`}
                value={exchangeCustomRate}
                onChange={v => setExchangeCustomRate(typeof v === 'number' ? v : parseFloat(String(v || '0')) || 1)}
                size="xs"
              />

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">تاريخ الصرافة</label>
                <AccountingDatePicker
                  value={exchangeDate}
                  onChange={val => setExchangeDate(val)}
                  placeholder="اختر التاريخ..."
                />
              </div>
            </div>
          </div>

          <Textarea
            label="بيان حركة الصرافة"
            placeholder="مثال: تصريف رصيد تومان إلى دولار بسعر 92,000..."
            rows={2}
            value={exchangeNotes}
            onChange={e => setExchangeNotes(e.target.value)}
            size="xs"
            className="font-medium"
          />

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button size="xs" variant="default" onClick={() => setExchangeModalOpen(false)} className="font-medium">
              إلغاء
            </Button>
            <Button
              size="xs"
              color="orange"
              loading={submittingExchange}
              onClick={handleSubmitExchange}
              leftSection={<IconDeviceFloppy size={14} />}
              className="font-bold bg-orange-600 hover:bg-orange-700 text-white shadow-xs"
            >
              حفظ وترحيل الصرافة
            </Button>
          </div>
        </div>
      </Modal>

      {/* ═══════════════ MODAL 3: تعديل بيانات الحساب (مع قفل الرصيد الافتتاحي) ═══════════════ */}
      <Modal
        opened={editAccountModalOpen}
        onClose={() => setEditAccountModalOpen(false)}
        title={
          <div className="flex items-center gap-2.5 text-slate-900 font-bold text-sm">
            <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
              <IconEdit size={16} />
            </div>
            <span>تعديل بيانات حساب {account?.nameAr} ({account?.code})</span>
          </div>
        }
        size="lg"
        centered
        radius="lg"
      >
        <div className="space-y-3.5 text-xs select-none">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-700 font-medium text-[11px] leading-relaxed">
            يمكنك تعديل اسم الحساب وبيانات التواصل والملاحظات. الأرصدة الافتتاحية مقفلة ولا يمكن تعديلها بعد إنشاء الحساب لضمان سلامة العمليات المحاسبية.
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">نوع حساب التصفية</label>
            <SegmentedControl
              fullWidth
              size="xs"
              value={account?.category || 'BOURSE'}
              disabled
              data={[
                { label: 'حساب بورصة', value: 'BOURSE' },
                { label: 'مكتب وسيط', value: 'OFFICE' },
                { label: 'مقاصة', value: 'SUSPENSE' },
              ]}
              color="orange"
              className="bg-slate-100 font-bold"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextInput
              label="اسم الحساب / المكتب بالعربية *"
              placeholder="مثال: بورصة السوري / مكتب الكرادة..."
              value={editNameAr}
              onChange={e => setEditNameAr(e.target.value)}
              required
              size="xs"
              className="font-bold"
            />

            <TextInput
              label="English Name (اختياري)"
              placeholder="e.g. Al-Souri Bourse"
              value={editNameEn}
              onChange={e => setEditNameEn(e.target.value)}
              size="xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextInput
              label="الشخص المسؤول / المندوب"
              placeholder="مثال: السيد أحمد..."
              value={editContactPerson}
              onChange={e => setEditContactPerson(e.target.value)}
              size="xs"
            />

            <TextInput
              label="رقم الهاتف للتواصل"
              placeholder="مثال: 07701234567"
              value={editPhone}
              onChange={e => setEditPhone(e.target.value)}
              size="xs"
              className="font-mono"
            />
          </div>

          {/* الأرصدة الحالية (مقفلة وغير قابلة للتعديل) */}
          <div className="border border-amber-200/80 rounded-lg p-3 bg-amber-50/40 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <span className="flex items-center gap-1.5 text-amber-900">
                <span>🔒 الأرصدة الافتتاحية مقفلة</span>
              </span>
              <span className="text-[10px] text-amber-800 font-medium">تعديل الأرصدة يتم حصراً عبر سندات القبض والدفع والقيود</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center font-mono">
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="text-[10px] block text-slate-500 font-sans font-bold mb-0.5">الدولار ($)</span>
                <span className="font-black text-emerald-800 text-xs">${(account?.balanceUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="text-[10px] block text-slate-500 font-sans font-bold mb-0.5">الدينار (IQD)</span>
                <span className="font-black text-slate-900 text-xs">{(account?.balanceIQD || 0).toLocaleString()} د.ع</span>
              </div>
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="text-[10px] block text-slate-500 font-sans font-bold mb-0.5">التومان (TOM)</span>
                <span className="font-black text-slate-900 text-xs">{(account?.balanceTOMAN || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          <Textarea
            label="ملاحظات الحساب"
            placeholder="ملاحظات إضافية حول الحساب..."
            rows={2}
            value={editNotes}
            onChange={e => setEditNotes(e.target.value)}
            size="xs"
          />

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <Button
              size="xs"
              color="red"
              variant="subtle"
              loading={deletingAccount}
              onClick={handleDeleteThisAccount}
              leftSection={<IconTrash size={14} />}
              className="font-bold text-rose-700 hover:bg-rose-50"
            >
              حذف هذا الحساب نهائياً
            </Button>
            <div className="flex items-center gap-2">
              <Button size="xs" variant="default" onClick={() => setEditAccountModalOpen(false)}>
                إلغاء
              </Button>
              <Button
                size="xs"
                color="orange"
                loading={updatingAccount}
                onClick={handleSaveEditAccount}
                leftSection={<IconCheck size={14} />}
                className="font-bold bg-orange-600 hover:bg-orange-700 text-white"
              >
                حفظ التعديلات
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* ═══════════════ MODAL 5: تأكيد حذف الحركات المالية ═══════════════ */}
      <Modal
        opened={deleteConfirmModalOpen}
        onClose={() => setDeleteConfirmModalOpen(false)}
        title={
          <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
            <div className="w-7 h-7 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center shrink-0">
              <IconTrash size={16} />
            </div>
            <span>تأكيد حذف الحركات المالية</span>
          </div>
        }
        size="sm"
        centered
        overlayProps={{ opacity: 0.4, blur: 2 }}
        radius="lg"
      >
        <div className="space-y-3 pt-1 text-right text-xs">
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 leading-relaxed font-medium">
            هل أنت متأكد من رغبتك في حذف <b>{selectedRowIds.length}</b> حركة مالية محددة؟
            <div className="mt-1.5 text-[11px] text-rose-700 font-bold">
              ⚠️ سيتم إلغاء القيود اليومية وتعديل أرصدة الحسابات والصناديق تلقائياً.
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button size="xs" variant="default" onClick={() => setDeleteConfirmModalOpen(false)}>
              تراجع
            </Button>
            <Button
              size="xs"
              color="red"
              loading={deletingRows}
              onClick={handleDeleteSelected}
              leftSection={<IconTrash size={14} />}
              className="font-bold bg-rose-600 hover:bg-rose-700 text-white"
            >
              تأكيد الحذف
            </Button>
          </div>
        </div>
      </Modal>

      {/* ═══════════════ MODAL 6: طباعة سندات الحركات المحددة ═══════════════ */}
      <Modal
        opened={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        title={
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
              <IconPrinter size={16} />
            </div>
            <span>معاينة وطباعة السندات ({selectedRowIds.length})</span>
          </div>
        }
        size="lg"
        centered
        overlayProps={{ opacity: 0.35, blur: 2 }}
        radius="lg"
      >
        <div className="space-y-4 pt-1 text-right">
          {/* المعاينة الطباعية */}
          <div className="border border-slate-300 rounded-xl p-4 bg-white space-y-4 print:border-none">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200">
              <div>
                <h2 className="text-base font-black text-slate-900">سند حركة محاسبية</h2>
                <div className="text-xs text-slate-500 font-bold mt-0.5">حساب: {account?.nameAr} ({account?.code})</div>
              </div>
              <div className="text-left font-mono text-xs text-slate-500">
                <div>التاريخ: {new Date().toISOString().split('T')[0]}</div>
                <div>عدد الحركات: {selectedRowIds.length}</div>
              </div>
            </div>

            <div className="space-y-3">
              {statementRows.filter(r => selectedRowIds.includes(r.id)).map((r, i) => (
                <div key={r.id || i} className="border border-slate-200 rounded-lg p-3 bg-slate-50/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Badge size="xs" color={r.credit > 0 ? 'teal' : 'red'} variant="filled" className="font-bold">
                        {r.credit > 0 ? 'سند قبض' : 'سند دفع'}
                      </Badge>
                      <span className="font-bold text-slate-800">{r.description}</span>
                    </div>
                    <span className="font-mono font-black text-orange-950 text-sm">
                      ${(r.debit || r.credit).toLocaleString()} {r.currency}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-100">
                    <div><b>المرجع:</b> <span className="font-mono">{r.reference || '—'}</span></div>
                    <div><b>المستفيد:</b> <span>{r.beneficiary || '—'}</span></div>
                    <div><b>الملاحظات:</b> <span>{r.notes || '—'}</span></div>
                  </div>
                </div>
              ))}
            </div>

            {/* التواقيع الرسمية */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-200 text-center text-xs text-slate-600 font-bold">
              <div>المستلم / المستفيد</div>
              <div>المحاسب المسؤول</div>
              <div>المدير العام / الاعتماد</div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button size="xs" variant="default" onClick={() => setPrintModalOpen(false)}>
              إغلاق
            </Button>
            <Button
              size="xs"
              color="blue"
              onClick={() => window.print()}
              leftSection={<IconPrinter size={14} />}
              className="font-bold bg-blue-600 hover:bg-blue-700 text-white"
            >
              طباعة الآن (Print)
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ClearingAccountProfilePage;
